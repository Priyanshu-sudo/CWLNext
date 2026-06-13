from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import CaseStatus, Division, ReviewStatus, RoleType


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    role: RoleType
    division: Division | None
    is_active: bool


class CaseCreate(BaseModel):
    borrower: str = Field(min_length=2, max_length=180)
    division: Division
    sector: str
    exposure: Decimal = Field(gt=0)
    risk_rating: str
    previous_rating: str
    summary: str = Field(min_length=20)
    triggers: list[str] = []
    next_review_date: date


class CaseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    reference: str
    borrower: str
    division: Division
    sector: str
    exposure: Decimal
    risk_rating: str
    previous_rating: str
    status: CaseStatus
    summary: str
    triggers: list[str]
    owner: UserRead
    approver: UserRead
    next_review_date: date
    created_at: datetime
    updated_at: datetime

    @field_validator("triggers", mode="before")
    @classmethod
    def split_triggers(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item for item in value.split("|") if item]
        return value


class TransitionRequest(BaseModel):
    action: str
    note: str = ""


class ReviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    case_id: int
    borrower: str
    owner: str
    division: Division
    period: str
    due_date: date
    status: ReviewStatus
    recommendation: str
    commentary: str


class ReviewUpdate(BaseModel):
    recommendation: str = Field(min_length=3, max_length=100)
    commentary: str = Field(min_length=10)


class ReviewTransitionRequest(BaseModel):
    action: str
    note: str = ""


class DashboardRead(BaseModel):
    active_cases: int
    exposure: Decimal
    pending_decisions: int
    reviews_due: int
