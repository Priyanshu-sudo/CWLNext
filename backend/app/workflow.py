from fastapi import HTTPException
from sqlalchemy.orm import Session

from datetime import datetime, timezone

from .models import (
    AuditEvent,
    CaseStatus,
    MonthlyReview,
    ReviewStatus,
    RoleType,
    User,
    WatchlistCase,
)


TRANSITIONS = {
    (CaseStatus.DRAFT, "submit"): CaseStatus.PENDING_APPROVAL,
    (CaseStatus.RETURNED, "submit"): CaseStatus.PENDING_APPROVAL,
    (CaseStatus.PENDING_APPROVAL, "approve"): CaseStatus.ACTIVE,
    (CaseStatus.PENDING_APPROVAL, "return"): CaseStatus.RETURNED,
    (CaseStatus.ACTIVE, "request_removal"): CaseStatus.REMOVAL_PENDING,
    (CaseStatus.REMOVAL_PENDING, "approve_removal"): CaseStatus.CLOSED,
    (CaseStatus.REMOVAL_PENDING, "decline_removal"): CaseStatus.ACTIVE,
}

REVIEW_TRANSITIONS = {
    (ReviewStatus.DUE, "start"): ReviewStatus.DRAFT,
    (ReviewStatus.DRAFT, "submit"): ReviewStatus.PENDING_APPROVAL,
    (ReviewStatus.RETURNED, "submit"): ReviewStatus.PENDING_APPROVAL,
    (ReviewStatus.PENDING_APPROVAL, "approve"): ReviewStatus.APPROVED,
    (ReviewStatus.PENDING_APPROVAL, "return"): ReviewStatus.RETURNED,
}


def transition_case(
    db: Session,
    case: WatchlistCase,
    actor: User,
    action: str,
    note: str,
) -> WatchlistCase:
    target = TRANSITIONS.get((case.status, action))
    if target is None:
        raise HTTPException(status_code=409, detail="Action is invalid for current status")

    owner_actions = {"submit", "request_removal"}
    approval_actions = {"approve", "return", "approve_removal", "decline_removal"}

    if action in owner_actions and actor.id != case.owner_id:
        raise HTTPException(status_code=403, detail="Only the assigned case owner can do this")
    if action in approval_actions:
        if actor.role != RoleType.APPROVER or actor.division != case.division:
            raise HTTPException(status_code=403, detail="Division approver role required")
        if actor.id == case.owner_id:
            raise HTTPException(status_code=403, detail="Maker-checker separation required")

    previous = case.status
    case.status = target
    db.add(
        AuditEvent(
            case_id=case.id,
            actor_id=actor.id,
            event_type=f"CASE_{action.upper()}",
            from_status=previous.value,
            to_status=target.value,
            note=note,
        )
    )
    db.commit()
    db.refresh(case)
    return case


def transition_review(
    db: Session,
    review: MonthlyReview,
    actor: User,
    action: str,
    note: str,
) -> MonthlyReview:
    target = REVIEW_TRANSITIONS.get((review.status, action))
    if target is None:
        raise HTTPException(status_code=409, detail="Action is invalid for current review status")

    case = review.case
    if action in {"start", "submit"} and actor.id != case.owner_id:
        raise HTTPException(status_code=403, detail="Only the assigned case owner can do this")
    if action in {"approve", "return"}:
        if actor.role != RoleType.APPROVER or actor.division != case.division:
            raise HTTPException(status_code=403, detail="Division approver role required")

    previous = review.status
    review.status = target
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if action == "submit":
        review.submitted_at = now
    if action in {"approve", "return"}:
        review.decided_at = now
    db.add(
        AuditEvent(
            case_id=case.id,
            actor_id=actor.id,
            event_type=f"REVIEW_{action.upper()}",
            from_status=previous.value,
            to_status=target.value,
            note=note,
        )
    )
    db.commit()
    db.refresh(review)
    return review
