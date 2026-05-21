from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.models import Deadline, User
from app.schemas import DeadlineResponse, DeadlineCreate
from app.auth import require_role

router = APIRouter(prefix="/api/deadlines", tags=["deadlines"])

@router.get("", response_model=List[DeadlineResponse])
def get_deadlines(db: Session = Depends(get_db)):
    return db.query(Deadline).filter(Deadline.is_active == True).order_by(Deadline.cutoff_date.asc()).all()

@router.post("", response_model=DeadlineResponse, status_code=status.HTTP_201_CREATED)
def create_deadline(
    request: DeadlineCreate,
    current_user: User = Depends(require_role(["FC", "CFO"])),
    db: Session = Depends(get_db)
):
    db_deadline = Deadline(
        title=request.title,
        cutoff_date=request.cutoff_date,
        is_active=request.is_active
    )
    db.add(db_deadline)
    db.commit()
    db.refresh(db_deadline)
    return db_deadline
