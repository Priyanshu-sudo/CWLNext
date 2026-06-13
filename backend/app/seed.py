from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import CaseStatus, Division, MonthlyReview, ReviewStatus, RoleType, User, WatchlistCase


USERS = [
    ("Priya Nair", "priya@mycwl.demo", RoleType.CASE_OWNER, Division.PNC),
    ("Marcus Reed", "marcus@mycwl.demo", RoleType.APPROVER, Division.PNC),
    ("Elena Voss", "elena@mycwl.demo", RoleType.CASE_OWNER, Division.GWMA),
    ("Daniel Cho", "daniel@mycwl.demo", RoleType.APPROVER, Division.GWMA),
    ("Aisha Grant", "aisha@mycwl.demo", RoleType.CASE_OWNER, Division.GWMSI),
    ("Thomas Bell", "thomas@mycwl.demo", RoleType.APPROVER, Division.GWMSI),
    ("Vikram Shah", "vikram@mycwl.demo", RoleType.CASE_OWNER, Division.IB),
    ("Sofia Marin", "sofia@mycwl.demo", RoleType.APPROVER, Division.IB),
    ("Jordan Lee", "jordan@mycwl.demo", RoleType.ADMIN, None),
]


def seed(db: Session) -> None:
    if db.scalar(select(User.id).limit(1)):
        return

    users = [User(name=name, email=email, role=role, division=division) for name, email, role, division in USERS]
    db.add_all(users)
    db.flush()

    cases = [
        WatchlistCase(
            reference="CWL-2026-0142",
            borrower="Aperture Retail Group",
            division=Division.PNC,
            sector="Consumer discretionary",
            exposure=Decimal("48200000"),
            risk_rating="6 - Special mention",
            previous_rating="5 - Acceptable",
            status=CaseStatus.ACTIVE,
            summary="Two consecutive quarters of margin compression and delayed inventory conversion.",
            triggers="Covenant breach|Liquidity pressure",
            owner_id=users[0].id,
            approver_id=users[1].id,
            next_review_date=date(2026, 6, 18),
        ),
        WatchlistCase(
            reference="CWL-2026-0138",
            borrower="Northstar Renewables",
            division=Division.IB,
            sector="Energy",
            exposure=Decimal("126500000"),
            risk_rating="7 - Substandard",
            previous_rating="6 - Special mention",
            status=CaseStatus.PENDING_APPROVAL,
            summary="Construction completion moved by five months; contingency facility is heavily utilized.",
            triggers="Project delay|Sponsor support",
            owner_id=users[6].id,
            approver_id=users[7].id,
            next_review_date=date(2026, 6, 15),
        ),
        WatchlistCase(
            reference="CWL-2026-0111",
            borrower="Morrow Health Systems",
            division=Division.GWMSI,
            sector="Healthcare",
            exposure=Decimal("73800000"),
            risk_rating="6 - Special mention",
            previous_rating="6 - Special mention",
            status=CaseStatus.ACTIVE,
            summary="Receivables above 90 days remain elevated while the new CFO resets collections.",
            triggers="Receivables aging|Management change",
            owner_id=users[4].id,
            approver_id=users[5].id,
            next_review_date=date(2026, 6, 21),
        ),
        WatchlistCase(
            reference="CWL-2026-0096",
            borrower="Canopy Hospitality Partners",
            division=Division.GWMA,
            sector="Real estate",
            exposure=Decimal("31900000"),
            risk_rating="7 - Substandard",
            previous_rating="6 - Special mention",
            status=CaseStatus.REMOVAL_PENDING,
            summary="Occupancy and debt service coverage have remained above exit thresholds for 90 days.",
            triggers="Debt service coverage|Occupancy",
            owner_id=users[2].id,
            approver_id=users[3].id,
            next_review_date=date(2026, 6, 12),
        ),
        WatchlistCase(
            reference="CWL-2026-0153",
            borrower="BluePeak Components",
            division=Division.PNC,
            sector="Industrials",
            exposure=Decimal("26700000"),
            risk_rating="5 - Acceptable",
            previous_rating="5 - Acceptable",
            status=CaseStatus.DRAFT,
            summary="Largest customer announced a supplier consolidation review.",
            triggers="Customer concentration",
            owner_id=users[0].id,
            approver_id=users[1].id,
            next_review_date=date(2026, 7, 1),
        ),
    ]
    db.add_all(cases)
    db.flush()
    db.add_all(
        [
            MonthlyReview(case_id=cases[0].id, period="2026-06", due_date=date(2026, 6, 18), status=ReviewStatus.DRAFT, recommendation="Remain on watchlist"),
            MonthlyReview(case_id=cases[1].id, period="2026-06", due_date=date(2026, 6, 15), status=ReviewStatus.PENDING_APPROVAL, recommendation="Escalate risk rating"),
            MonthlyReview(case_id=cases[2].id, period="2026-06", due_date=date(2026, 6, 21), status=ReviewStatus.DUE, recommendation="Not started"),
            MonthlyReview(case_id=cases[3].id, period="2026-06", due_date=date(2026, 6, 12), status=ReviewStatus.PENDING_APPROVAL, recommendation="Remove from watchlist"),
            MonthlyReview(case_id=cases[0].id, period="2026-05", due_date=date(2026, 5, 20), status=ReviewStatus.APPROVED, recommendation="Remain on watchlist"),
            MonthlyReview(case_id=cases[2].id, period="2026-05", due_date=date(2026, 5, 20), status=ReviewStatus.RETURNED, recommendation="Remain on watchlist"),
        ]
    )
    db.commit()
