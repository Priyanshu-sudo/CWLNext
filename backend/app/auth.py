from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import User


def current_user(
    db: Annotated[Session, Depends(get_db)],
    x_user_id: Annotated[int, Header()] = 1,
) -> User:
    user = db.get(User, x_user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Unknown or inactive demo user")
    return user

