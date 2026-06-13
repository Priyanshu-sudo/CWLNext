"""Initial MYCWLNext schema."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM


revision: str = "20260613_01"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

division = ENUM("PNC", "GWMA", "GWMSI", "IB", name="division", create_type=False)
role_type = ENUM("CASE_OWNER", "APPROVER", "ADMIN", name="roletype", create_type=False)
case_status = ENUM(
    "DRAFT",
    "PENDING_APPROVAL",
    "ACTIVE",
    "RETURNED",
    "REMOVAL_PENDING",
    "CLOSED",
    name="casestatus",
    create_type=False,
)
review_status = ENUM(
    "DUE",
    "DRAFT",
    "PENDING_APPROVAL",
    "APPROVED",
    "RETURNED",
    name="reviewstatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    division.create(bind, checkfirst=True)
    role_type.create(bind, checkfirst=True)
    case_status.create(bind, checkfirst=True)
    review_status.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(180), nullable=False, unique=True),
        sa.Column("role", role_type, nullable=False),
        sa.Column("division", division, nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "watchlist_cases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reference", sa.String(30), nullable=False, unique=True),
        sa.Column("borrower", sa.String(180), nullable=False),
        sa.Column("division", division, nullable=False),
        sa.Column("sector", sa.String(100), nullable=False),
        sa.Column("exposure", sa.Numeric(18, 2), nullable=False),
        sa.Column("risk_rating", sa.String(50), nullable=False),
        sa.Column("previous_rating", sa.String(50), nullable=False),
        sa.Column("status", case_status, nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("triggers", sa.Text(), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("approver_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("next_review_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "monthly_reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("case_id", sa.Integer(), sa.ForeignKey("watchlist_cases.id"), nullable=False),
        sa.Column("period", sa.String(7), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("status", review_status, nullable=False),
        sa.Column("recommendation", sa.String(100), nullable=False),
        sa.Column("commentary", sa.Text(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("case_id", sa.Integer(), sa.ForeignKey("watchlist_cases.id"), nullable=False),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("event_type", sa.String(60), nullable=False),
        sa.Column("from_status", sa.String(40), nullable=True),
        sa.Column("to_status", sa.String(40), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("monthly_reviews")
    op.drop_table("watchlist_cases")
    op.drop_table("users")
    review_status.drop(op.get_bind(), checkfirst=True)
    case_status.drop(op.get_bind(), checkfirst=True)
    role_type.drop(op.get_bind(), checkfirst=True)
    division.drop(op.get_bind(), checkfirst=True)
