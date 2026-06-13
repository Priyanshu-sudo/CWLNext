from contextlib import asynccontextmanager
from decimal import Decimal
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .auth import current_user
from .database import SessionLocal, get_db
from .models import CaseStatus, MonthlyReview, ReviewStatus, RoleType, User, WatchlistCase
from .schemas import (
    CaseCreate,
    CaseRead,
    DashboardRead,
    ReviewRead,
    ReviewTransitionRequest,
    ReviewUpdate,
    TransitionRequest,
    UserRead,
)
from .seed import seed
from .settings import settings
from .workflow import transition_case, transition_review


@asynccontextmanager
async def lifespan(_: FastAPI):
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(
    title="MYCWLNext API",
    description="Credit watchlist workflow and monthly review API.",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def case_query():
    return select(WatchlistCase).options(
        selectinload(WatchlistCase.owner),
        selectinload(WatchlistCase.approver),
    )


def serialize_case(case: WatchlistCase) -> CaseRead:
    return CaseRead.model_validate(case, from_attributes=True)


def review_query():
    return select(MonthlyReview).options(
        selectinload(MonthlyReview.case).selectinload(WatchlistCase.owner),
    )


def serialize_review(review: MonthlyReview) -> ReviewRead:
    return ReviewRead(
        id=review.id,
        case_id=review.case_id,
        borrower=review.case.borrower,
        owner=review.case.owner.name,
        division=review.case.division,
        period=review.period,
        due_date=review.due_date,
        status=review.status,
        recommendation=review.recommendation,
        commentary=review.commentary,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/users", response_model=list[UserRead])
def list_users(db: Annotated[Session, Depends(get_db)]) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id)))


@app.get("/api/dashboard", response_model=DashboardRead)
def dashboard(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(current_user)],
) -> DashboardRead:
    filters = [] if user.role == RoleType.ADMIN else [WatchlistCase.division == user.division]
    active_statuses = [CaseStatus.ACTIVE, CaseStatus.PENDING_APPROVAL, CaseStatus.REMOVAL_PENDING]
    active = db.scalar(select(func.count()).select_from(WatchlistCase).where(*filters, WatchlistCase.status.in_(active_statuses))) or 0
    exposure = db.scalar(select(func.coalesce(func.sum(WatchlistCase.exposure), 0)).where(*filters, WatchlistCase.status.in_(active_statuses))) or Decimal(0)
    pending = db.scalar(select(func.count()).select_from(WatchlistCase).where(*filters, WatchlistCase.status.in_([CaseStatus.PENDING_APPROVAL, CaseStatus.REMOVAL_PENDING]))) or 0
    due = db.scalar(select(func.count()).select_from(MonthlyReview).join(WatchlistCase).where(*filters, MonthlyReview.status.in_([ReviewStatus.DUE, ReviewStatus.DRAFT, ReviewStatus.RETURNED]))) or 0
    return DashboardRead(active_cases=active, exposure=exposure, pending_decisions=pending, reviews_due=due)


@app.get("/api/cases", response_model=list[CaseRead])
def list_cases(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(current_user)],
) -> list[CaseRead]:
    query = case_query().order_by(WatchlistCase.next_review_date)
    if user.role != RoleType.ADMIN:
        query = query.where(WatchlistCase.division == user.division)
    return [serialize_case(case) for case in db.scalars(query)]


@app.get("/api/cases/{case_id}", response_model=CaseRead)
def get_case(
    case_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(current_user)],
) -> CaseRead:
    case = db.scalar(case_query().where(WatchlistCase.id == case_id))
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if user.role != RoleType.ADMIN and user.division != case.division:
        raise HTTPException(status_code=403, detail="Case belongs to another division")
    return serialize_case(case)


@app.post("/api/cases", response_model=CaseRead, status_code=201)
def create_case(
    payload: CaseCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(current_user)],
) -> CaseRead:
    if user.role != RoleType.CASE_OWNER or user.division != payload.division:
        raise HTTPException(status_code=403, detail="A case owner can create cases only for their division")
    approver = db.scalar(select(User).where(User.division == payload.division, User.role == RoleType.APPROVER))
    if not approver:
        raise HTTPException(status_code=409, detail="Division has no active approver")
    sequence = (db.scalar(select(func.count()).select_from(WatchlistCase)) or 0) + 154
    case = WatchlistCase(
        reference=f"CWL-2026-{sequence:04d}",
        owner_id=user.id,
        approver_id=approver.id,
        triggers="|".join(payload.triggers),
        **payload.model_dump(exclude={"triggers"}),
    )
    db.add(case)
    db.commit()
    return serialize_case(db.scalar(case_query().where(WatchlistCase.id == case.id)))


@app.post("/api/cases/{case_id}/transition", response_model=CaseRead)
def transition(
    case_id: int,
    payload: TransitionRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(current_user)],
) -> CaseRead:
    case = db.scalar(case_query().where(WatchlistCase.id == case_id))
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return serialize_case(transition_case(db, case, user, payload.action, payload.note))


@app.get("/api/reviews", response_model=list[ReviewRead])
def list_reviews(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(current_user)],
) -> list[ReviewRead]:
    query = review_query().join(WatchlistCase).order_by(MonthlyReview.due_date)
    if user.role != RoleType.ADMIN:
        query = query.where(WatchlistCase.division == user.division)
    return [serialize_review(review) for review in db.scalars(query)]


@app.patch("/api/reviews/{review_id}", response_model=ReviewRead)
def update_review(
    review_id: int,
    payload: ReviewUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(current_user)],
) -> ReviewRead:
    review = db.scalar(review_query().where(MonthlyReview.id == review_id))
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if user.id != review.case.owner_id:
        raise HTTPException(status_code=403, detail="Only the assigned case owner can edit this review")
    if review.status not in {ReviewStatus.DUE, ReviewStatus.DRAFT, ReviewStatus.RETURNED}:
        raise HTTPException(status_code=409, detail="Review is not editable")
    review.recommendation = payload.recommendation
    review.commentary = payload.commentary
    if review.status == ReviewStatus.DUE:
        review.status = ReviewStatus.DRAFT
    db.commit()
    db.refresh(review)
    return serialize_review(review)


@app.post("/api/reviews/{review_id}/transition", response_model=ReviewRead)
def review_transition(
    review_id: int,
    payload: ReviewTransitionRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(current_user)],
) -> ReviewRead:
    review = db.scalar(review_query().where(MonthlyReview.id == review_id))
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return serialize_review(transition_review(db, review, user, payload.action, payload.note))
