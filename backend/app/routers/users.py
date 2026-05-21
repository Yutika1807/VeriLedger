from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import UserResponse
from app.crud import get_users_by_role
from app.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/reviewers", response_model=List[UserResponse])
def get_reviewers(
    role: str = Query(..., description="Role of the reviewer to list (CHECKER, FC, CFO)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role = role.upper()
    if role not in ["CHECKER", "FC", "CFO"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only query reviewer roles: CHECKER, FC, CFO"
        )
    return get_users_by_role(db, role=role)
