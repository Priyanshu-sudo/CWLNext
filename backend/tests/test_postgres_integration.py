import os

import pytest
from sqlalchemy import create_engine, inspect, text


POSTGRES_TEST_URL = os.getenv("POSTGRES_TEST_URL")


@pytest.mark.skipif(not POSTGRES_TEST_URL, reason="POSTGRES_TEST_URL is not configured")
def test_migrated_postgres_database():
    engine = create_engine(POSTGRES_TEST_URL)

    assert engine.dialect.name == "postgresql"
    assert {
        "alembic_version",
        "audit_events",
        "monthly_reviews",
        "users",
        "watchlist_cases",
    }.issubset(inspect(engine).get_table_names())

    with engine.connect() as connection:
        revision = connection.scalar(text("SELECT version_num FROM alembic_version"))
        user_count = connection.scalar(text("SELECT count(*) FROM users"))
        case_count = connection.scalar(text("SELECT count(*) FROM watchlist_cases"))

    assert revision == "20260613_01"
    assert user_count == 9
    assert case_count == 5

