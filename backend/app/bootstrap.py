from alembic import command
from alembic.config import Config

from .database import SessionLocal
from .seed import seed


def bootstrap() -> None:
    config = Config("alembic.ini")
    command.upgrade(config, "head")
    with SessionLocal() as db:
        seed(db)


if __name__ == "__main__":
    bootstrap()

