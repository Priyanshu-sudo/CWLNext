from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import CaseStatus, Division, RoleType, User, WatchlistCase
from app.workflow import transition_case


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def people(db: Session):
    owner = User(name="Owner", email="owner@test", role=RoleType.CASE_OWNER, division=Division.PNC)
    approver = User(name="Approver", email="approver@test", role=RoleType.APPROVER, division=Division.PNC)
    db.add_all([owner, approver])
    db.flush()
    return owner, approver


def make_case(db: Session, owner: User, approver: User):
    case = WatchlistCase(
        reference="CWL-TEST-1",
        borrower="Test Borrower",
        division=Division.PNC,
        sector="Industrials",
        exposure=Decimal("1000000"),
        risk_rating="6",
        previous_rating="5",
        summary="A sufficiently detailed watchlist rationale.",
        triggers="Liquidity",
        owner_id=owner.id,
        approver_id=approver.id,
        next_review_date=date(2026, 7, 1),
    )
    db.add(case)
    db.commit()
    return case


def test_owner_submits_and_approver_approves(db: Session):
    owner, approver = people(db)
    case = make_case(db, owner, approver)

    transition_case(db, case, owner, "submit", "Ready")
    assert case.status == CaseStatus.PENDING_APPROVAL

    transition_case(db, case, approver, "approve", "Approved")
    assert case.status == CaseStatus.ACTIVE
    assert len(case.events) == 2


def test_owner_cannot_approve_own_case(db: Session):
    owner, approver = people(db)
    case = make_case(db, owner, approver)
    transition_case(db, case, owner, "submit", "")

    with pytest.raises(HTTPException) as error:
        transition_case(db, case, owner, "approve", "")
    assert error.value.status_code == 403

