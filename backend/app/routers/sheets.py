from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import json
from uuid import UUID

from app.database import get_db
from app.models import User, SheetComment
from app.schemas import BalanceSheetResponse, GLEntryCreate, TransitionRequest, AssignCheckerRequest, SheetCommentResponse, SheetCommentCreate
from app.crud import create_balance_sheet, get_balance_sheet, get_balance_sheets, update_balance_sheet
from app.auth import get_current_user, require_role
from app.storage import get_storage_provider
from app.workflow_engine import transition_sheet

router = APIRouter(prefix="/api/sheets", tags=["sheets"])

@router.post("", response_model=BalanceSheetResponse, status_code=status.HTTP_201_CREATED)
def create_sheet(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    deadline: Optional[str] = Form(None),  # Parse as datetime if provided
    file: Optional[UploadFile] = File(None),
    gl_entries: str = Form(...),  # JSON string of GLEntryCreate items
    current_user: User = Depends(require_role(["MAKER"])),
    db: Session = Depends(get_db)
):
    # 1. Parse GL Entries JSON
    try:
        entries_data = json.loads(gl_entries)
        if not isinstance(entries_data, list):
            raise ValueError("GL entries must be a JSON array")
        gl_entries_list = [GLEntryCreate(**entry) for entry in entries_data]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid GL entries format: {str(e)}"
        )

    # 2. Parse Deadline
    parsed_deadline = None
    if deadline:
        try:
            # Handle ISO string from javascript
            parsed_deadline = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid deadline date format: {str(e)}"
            )

    # 3. Handle File Upload
    file_url = None
    file_name = None
    if file:
        try:
            content = file.file.read()
            storage_provider = get_storage_provider()
            file_url = storage_provider.upload_file(
                file_content=content,
                filename=file.filename,
                content_type=file.content_type
            )
            file_name = file.filename
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload attachment: {str(e)}"
            )

    # 4. Save to Database
    return create_balance_sheet(
        db=db,
        maker_id=current_user.emp_id,
        title=title,
        description=description,
        deadline=parsed_deadline,
        file_url=file_url,
        file_name=file_name,
        gl_entries_in=gl_entries_list
    )

@router.put("/{sheet_id}", response_model=BalanceSheetResponse)
def update_sheet_endpoint(
    sheet_id: UUID,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    deadline: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    gl_entries: str = Form(...),  # JSON string of GLEntryCreate items
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sheet = get_balance_sheet(db, sheet_id=sheet_id)
    if not sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Balance sheet not found"
        )

    if sheet.is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This balance sheet is locked and cannot be modified."
        )

    role = current_user.role
    emp_id = current_user.emp_id
    
    is_authorized = False
    if role == "MAKER" and sheet.maker_id == emp_id:
        if sheet.status in ["DRAFT", "CHECKER_REJECTED", "CFO_REJECTED"]:
            is_authorized = True
    elif role == "CHECKER" and sheet.assigned_checker_id == emp_id:
        if sheet.status in ["FC_REJECTED"]:
            is_authorized = True

    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to edit this balance sheet in its current status."
        )

    try:
        entries_data = json.loads(gl_entries)
        if not isinstance(entries_data, list):
            raise ValueError("GL entries must be a JSON array")
        gl_entries_list = [GLEntryCreate(**entry) for entry in entries_data]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid GL entries format: {str(e)}"
        )

    parsed_deadline = None
    if deadline:
        try:
            parsed_deadline = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid deadline date format: {str(e)}"
            )

    file_url = None
    file_name = None
    if file:
        try:
            content = file.file.read()
            storage_provider = get_storage_provider()
            file_url = storage_provider.upload_file(
                file_content=content,
                filename=file.filename,
                content_type=file.content_type
            )
            file_name = file.filename
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload attachment: {str(e)}"
            )

    return update_balance_sheet(
        db=db,
        sheet=sheet,
        title=title,
        description=description,
        deadline=parsed_deadline,
        file_url=file_url,
        file_name=file_name,
        gl_entries_in=gl_entries_list,
        user=current_user
    )

@router.get("", response_model=List[BalanceSheetResponse])
def list_sheets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_balance_sheets(db, user=current_user)

@router.get("/comments/unread-count")
def get_unread_comments_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    count = db.query(SheetComment).filter(
        SheetComment.recipient_id == current_user.emp_id,
        SheetComment.is_read == False
    ).count()
    return {"unread_count": count}

@router.get("/{sheet_id}", response_model=BalanceSheetResponse)
def get_sheet(
    sheet_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sheet = get_balance_sheet(db, sheet_id=sheet_id)
    if not sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Balance sheet not found"
        )
        
    # Verify authorization
    emp_id = current_user.emp_id
    role = current_user.role
    
    # Maker can only see their own sheets
    if role == "MAKER" and sheet.maker_id != emp_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this balance sheet."
        )
    # Reviewers can see if assigned or in the audit trail, or CFO if it is approved
    elif role == "CHECKER" and sheet.assigned_checker_id != emp_id and not any(evt.get("action_by") == emp_id for evt in sheet.audit_trail):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this balance sheet."
        )
    elif role == "FC" and sheet.assigned_fc_id != emp_id and not any(evt.get("action_by") == emp_id for evt in sheet.audit_trail):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this balance sheet."
        )
    elif role == "CFO" and sheet.assigned_cfo_id != emp_id and sheet.status != "CFO_APPROVED" and not any(evt.get("action_by") == emp_id for evt in sheet.audit_trail):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this balance sheet."
        )
        
    return sheet

@router.post("/{sheet_id}/transition", response_model=BalanceSheetResponse)
def transition_sheet_endpoint(
    sheet_id: UUID,
    request: TransitionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sheet = get_balance_sheet(db, sheet_id=sheet_id)
    if not sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Balance sheet not found"
        )
        
    return transition_sheet(
        db=db,
        sheet=sheet,
        user=current_user,
        action=request.action,
        target_user_id=request.target_user_id,
        notes=request.notes
    )

@router.post("/assign-checker", response_model=BalanceSheetResponse)
def assign_checker_route(
    request: AssignCheckerRequest,
    current_user: User = Depends(require_role(["MAKER"])),
    db: Session = Depends(get_db)
):
    sheet = get_balance_sheet(db, sheet_id=request.sheet_id)
    if not sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Balance sheet not found"
        )
    # Check segregation of duties
    if request.checker_id == sheet.maker_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Compliance Error: Maker and Checker must be distinct individuals."
        )
    return transition_sheet(
        db=db,
        sheet=sheet,
        user=current_user,
        action="SUBMIT",
        target_user_id=request.checker_id,
        notes="Checker assigned."
    )

@router.post("/{sheet_id}/assign-checker", response_model=BalanceSheetResponse)
def assign_checker_path_route(
    sheet_id: UUID,
    checker_id: str,
    current_user: User = Depends(require_role(["MAKER"])),
    db: Session = Depends(get_db)
):
    sheet = get_balance_sheet(db, sheet_id=sheet_id)
    if not sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Balance sheet not found"
        )
    # Check segregation of duties
    if checker_id == sheet.maker_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Compliance Error: Maker and Checker must be distinct individuals."
        )
    return transition_sheet(
        db=db,
        sheet=sheet,
        user=current_user,
        action="SUBMIT",
        target_user_id=checker_id,
        notes="Checker assigned."
    )

@router.get("/{sheet_id}/comments", response_model=List[SheetCommentResponse])
def get_sheet_comments(
    sheet_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sheet = get_balance_sheet(db, sheet_id=sheet_id)
    if not sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Balance sheet not found"
        )
    # Verify authorization
    emp_id = current_user.emp_id
    role = current_user.role
    if role == "MAKER" and sheet.maker_id != emp_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view comments for this balance sheet."
        )
    elif role == "CHECKER" and sheet.assigned_checker_id != emp_id and not any(evt.get("action_by") == emp_id for evt in sheet.audit_trail):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view comments for this balance sheet."
        )
    elif role == "FC" and sheet.assigned_fc_id != emp_id and not any(evt.get("action_by") == emp_id for evt in sheet.audit_trail):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view comments for this balance sheet."
        )
    elif role == "CFO" and sheet.assigned_cfo_id != emp_id and sheet.status != "CFO_APPROVED" and not any(evt.get("action_by") == emp_id for evt in sheet.audit_trail):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view comments for this balance sheet."
        )

    return db.query(SheetComment).filter(SheetComment.balance_sheet_id == sheet_id).order_by(SheetComment.created_at.asc()).all()

@router.post("/{sheet_id}/comments", response_model=SheetCommentResponse, status_code=status.HTTP_201_CREATED)
def create_sheet_comment(
    sheet_id: UUID,
    comment_in: SheetCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sheet = get_balance_sheet(db, sheet_id=sheet_id)
    if not sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Balance sheet not found"
        )
    
    # Verify authorization
    emp_id = current_user.emp_id
    role = current_user.role
    if role == "MAKER" and sheet.maker_id != emp_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to post comments on this balance sheet."
        )
    elif role == "CHECKER" and sheet.assigned_checker_id != emp_id and not any(evt.get("action_by") == emp_id for evt in sheet.audit_trail):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to post comments on this balance sheet."
        )
    elif role == "FC" and sheet.assigned_fc_id != emp_id and not any(evt.get("action_by") == emp_id for evt in sheet.audit_trail):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to post comments on this balance sheet."
        )
    elif role == "CFO" and sheet.assigned_cfo_id != emp_id and sheet.status != "CFO_APPROVED" and not any(evt.get("action_by") == emp_id for evt in sheet.audit_trail):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to post comments on this balance sheet."
        )

    # Determine recipient
    recipient_id = None
    if role == "MAKER":
        if sheet.status in ["SENT_TO_CHECKER", "CHECKER_REJECTED"]:
            recipient_id = sheet.assigned_checker_id
        elif sheet.status in ["SENT_TO_FC", "FC_REJECTED"]:
            recipient_id = sheet.assigned_fc_id
        elif sheet.status in ["SENT_TO_CFO", "CFO_REJECTED"]:
            recipient_id = sheet.assigned_cfo_id
        else:
            recipient_id = sheet.assigned_cfo_id or sheet.assigned_fc_id or sheet.assigned_checker_id
    else:
        recipient_id = sheet.maker_id

    db_comment = SheetComment(
        balance_sheet_id=sheet_id,
        author_id=emp_id,
        text=comment_in.text,
        recipient_id=recipient_id,
        is_read=False
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment

@router.post("/{sheet_id}/comments/read")
def mark_comments_as_read(
    sheet_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sheet = get_balance_sheet(db, sheet_id=sheet_id)
    if not sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Balance sheet not found"
        )
        
    comments = db.query(SheetComment).filter(
        SheetComment.balance_sheet_id == sheet_id,
        SheetComment.recipient_id == current_user.emp_id,
        SheetComment.is_read == False
    ).all()
    
    updated_count = len(comments)
    for comment in comments:
        comment.is_read = True
    
    db.commit()
    return {"status": "success", "updated_count": updated_count}

