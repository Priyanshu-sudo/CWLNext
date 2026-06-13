from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.seed import seed


@pytest.fixture
def client(tmp_path: Path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'api.db'}",
        connect_args={"check_same_thread": False},
    )
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)
    with testing_session() as db:
        seed(db)

    def override_db():
        with testing_session() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        test_client.close()
        app.dependency_overrides.clear()


def test_division_scoping_and_case_creation(client: TestClient):
    pnc_cases = client.get("/api/cases", headers={"x-user-id": "1"})
    assert pnc_cases.status_code == 200
    assert {case["division"] for case in pnc_cases.json()} == {"PNC"}

    created = client.post(
        "/api/cases",
        headers={"x-user-id": "1"},
        json={
            "borrower": "Atlas Packaging",
            "division": "PNC",
            "sector": "Industrials",
            "exposure": "12000000",
            "risk_rating": "6 - Special mention",
            "previous_rating": "5 - Acceptable",
            "summary": "Customer losses caused a material decline in projected debt service coverage.",
            "triggers": ["Revenue decline"],
            "next_review_date": "2026-07-15",
        },
    )
    assert created.status_code == 201
    assert created.json()["status"] == "DRAFT"


def test_review_submit_and_approve(client: TestClient):
    updated = client.patch(
        "/api/reviews/1",
        headers={"x-user-id": "1"},
        json={
            "recommendation": "Remain on watchlist",
            "commentary": "Liquidity remains constrained and covenant headroom is limited.",
        },
    )
    assert updated.status_code == 200

    submitted = client.post(
        "/api/reviews/1/transition",
        headers={"x-user-id": "1"},
        json={"action": "submit", "note": "Ready for approval"},
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "PENDING_APPROVAL"

    approved = client.post(
        "/api/reviews/1/transition",
        headers={"x-user-id": "2"},
        json={"action": "approve", "note": "Approved"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "APPROVED"
