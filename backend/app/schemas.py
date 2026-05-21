from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any
from datetime import datetime
from decimal import Decimal
from uuid import UUID

# User Schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = Field(..., description="Role must be one of: MAKER, CHECKER, FC, CFO")

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    emp_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# GL Entry Schemas
class GLEntryBase(BaseModel):
    account_code: str
    account_name: str
    debit: Decimal = Decimal("0.00")
    credit: Decimal = Decimal("0.00")

class GLEntryCreate(GLEntryBase):
    pass

class GLEntryResponse(GLEntryBase):
    id: UUID
    balance_sheet_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

# Balance Sheet Schemas
class BalanceSheetBase(BaseModel):
    title: str
    description: Optional[str] = None
    deadline: Optional[datetime] = None

class BalanceSheetCreate(BalanceSheetBase):
    gl_entries: List[GLEntryCreate]

class BalanceSheetResponse(BalanceSheetBase):
    id: UUID
    status: str
    maker_id: str
    assigned_checker_id: Optional[str] = None
    assigned_fc_id: Optional[str] = None
    assigned_cfo_id: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    total_assets: Decimal
    total_liabilities: Decimal
    total_equity: Decimal
    audit_trail: List[Any]
    is_locked: bool
    created_at: datetime
    updated_at: datetime
    gl_entries: List[GLEntryResponse]
    system_flags: Optional[List[str]] = []
    export_pdf_url: Optional[str] = None

    class Config:
        from_attributes = True

class TransitionRequest(BaseModel):
    action: str = Field(..., description="Action must be: SUBMIT, ACCEPT, REJECT, APPROVE")
    target_user_id: Optional[str] = None
    notes: Optional[str] = None

class AssignCheckerRequest(BaseModel):
    sheet_id: UUID
    checker_id: str

# Compliance Deadline Schemas
class DeadlineBase(BaseModel):
    title: str
    cutoff_date: datetime
    is_active: bool = True

class DeadlineCreate(DeadlineBase):
    pass

class DeadlineResponse(DeadlineBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Workspace Comments Schemas
class SheetCommentBase(BaseModel):
    text: str

class SheetCommentCreate(SheetCommentBase):
    pass

class SheetCommentResponse(BaseModel):
    id: UUID
    balance_sheet_id: UUID
    author_id: str
    author_name: Optional[str] = None
    author_role: Optional[str] = None
    text: str
    recipient_id: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


