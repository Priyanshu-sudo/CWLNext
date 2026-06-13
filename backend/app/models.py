import enum
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Division(str, enum.Enum):
    PNC = "PNC"
    GWMA = "GWMA"
    GWMSI = "GWMSI"
    IB = "IB"


class RoleType(str, enum.Enum):
    CASE_OWNER = "CASE_OWNER"
    APPROVER = "APPROVER"
    ADMIN = "ADMIN"


class CaseStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    ACTIVE = "ACTIVE"
    RETURNED = "RETURNED"
    REMOVAL_PENDING = "REMOVAL_PENDING"
    CLOSED = "CLOSED"


class ReviewStatus(str, enum.Enum):
    DUE = "DUE"
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    RETURNED = "RETURNED"


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(180), unique=True)
    role: Mapped[RoleType] = mapped_column(Enum(RoleType))
    division: Mapped[Division | None] = mapped_column(Enum(Division), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)


class WatchlistCase(Base):
    __tablename__ = "watchlist_cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(30), unique=True)
    borrower: Mapped[str] = mapped_column(String(180))
    division: Mapped[Division] = mapped_column(Enum(Division))
    sector: Mapped[str] = mapped_column(String(100))
    exposure: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    risk_rating: Mapped[str] = mapped_column(String(50))
    previous_rating: Mapped[str] = mapped_column(String(50))
    status: Mapped[CaseStatus] = mapped_column(Enum(CaseStatus), default=CaseStatus.DRAFT)
    summary: Mapped[str] = mapped_column(Text)
    triggers: Mapped[str] = mapped_column(Text, default="")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    approver_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    next_review_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)

    owner: Mapped[User] = relationship(foreign_keys=[owner_id])
    approver: Mapped[User] = relationship(foreign_keys=[approver_id])
    reviews: Mapped[list["MonthlyReview"]] = relationship(back_populates="case")
    events: Mapped[list["AuditEvent"]] = relationship(back_populates="case")


class MonthlyReview(Base):
    __tablename__ = "monthly_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("watchlist_cases.id"))
    period: Mapped[str] = mapped_column(String(7))
    due_date: Mapped[date] = mapped_column(Date)
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), default=ReviewStatus.DUE)
    recommendation: Mapped[str] = mapped_column(String(100), default="")
    commentary: Mapped[str] = mapped_column(Text, default="")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    case: Mapped[WatchlistCase] = relationship(back_populates="reviews")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("watchlist_cases.id"))
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    event_type: Mapped[str] = mapped_column(String(60))
    from_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    case: Mapped[WatchlistCase] = relationship(back_populates="events")
    actor: Mapped[User] = relationship()
