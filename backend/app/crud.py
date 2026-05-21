from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional
import uuid

from app.models import User, BalanceSheet, GLEntry
from app.schemas import UserCreate, GLEntryCreate
from app.auth import get_password_hash

def generate_emp_id(db: Session) -> str:
    year = datetime.utcnow().year
    prefix = f"EMP-{year}-"
    # Query with FOR UPDATE lock to prevent race conditions during concurrent signup
    last_user = (
        db.query(User)
        .filter(User.emp_id.like(f"{prefix}%"))
        .order_by(User.emp_id.desc())
        .with_for_update()
        .first()
    )
    if last_user:
        try:
            last_num = int(last_user.emp_id.split("-")[-1])
            new_num = last_num + 1
        except ValueError:
            new_num = 1
    else:
        new_num = 1
    return f"{prefix}{new_num:04d}"

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def get_user_by_emp_id(db: Session, emp_id: str) -> Optional[User]:
    return db.query(User).filter(User.emp_id == emp_id).first()

def create_user(db: Session, user_in: UserCreate) -> User:
    emp_id = generate_emp_id(db)
    db_user = User(
        emp_id=emp_id,
        name=user_in.name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        role=user_in.role.upper(),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_users_by_role(db: Session, role: str) -> List[User]:
    return db.query(User).filter(User.role == role.upper()).all()

def create_balance_sheet(
    db: Session,
    maker_id: str,
    title: str,
    description: Optional[str],
    deadline: Optional[datetime],
    file_url: Optional[str],
    file_name: Optional[str],
    gl_entries_in: List[GLEntryCreate],
) -> BalanceSheet:
    # 1. Map assets, liabilities, equity from GL codes
    # Asset code starts with 1, Liability with 2, Equity with 3
    total_assets = Decimal("0.00")
    total_liabilities = Decimal("0.00")
    total_equity = Decimal("0.00")

    for entry in gl_entries_in:
        code = entry.account_code.strip()
        debit = Decimal(str(entry.debit))
        credit = Decimal(str(entry.credit))
        if code.startswith("1"):
            total_assets += (debit - credit)
        elif code.startswith("2"):
            total_liabilities += (credit - debit)
        elif code.startswith("3"):
            total_equity += (credit - debit)
        else:
            # Fallback categorisation if other format is used
            total_assets += debit
            total_liabilities += credit

    initial_audit = [{
        "from_state": "None",
        "to_state": "DRAFT",
        "action_by": maker_id,
        "action_to": maker_id,
        "timestamp": datetime.utcnow().isoformat(),
        "notes": "Balance sheet draft created."
    }]

    db_sheet = BalanceSheet(
        title=title,
        description=description,
        status="DRAFT",
        maker_id=maker_id,
        file_url=file_url,
        file_name=file_name,
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        total_equity=total_equity,
        deadline=deadline,
        audit_trail=initial_audit,
        is_locked=False,
        system_flags=[]
    )
    
    db.add(db_sheet)
    db.flush()  # Generate sheet ID for FK references

    from app.workflow_engine import run_flux_analysis
    db_sheet.system_flags = run_flux_analysis(db, db_sheet)

    for entry in gl_entries_in:
        db_entry = GLEntry(
            balance_sheet_id=db_sheet.id,
            account_code=entry.account_code,
            account_name=entry.account_name,
            debit=entry.debit,
            credit=entry.credit,
        )
        db.add(db_entry)
        
    db.commit()
    db.refresh(db_sheet)
    return db_sheet

def update_balance_sheet(
    db: Session,
    sheet: BalanceSheet,
    title: str,
    description: Optional[str],
    deadline: Optional[datetime],
    file_url: Optional[str],
    file_name: Optional[str],
    gl_entries_in: List[GLEntryCreate],
    user: User,
) -> BalanceSheet:
    total_assets = Decimal("0.00")
    total_liabilities = Decimal("0.00")
    total_equity = Decimal("0.00")

    for entry in gl_entries_in:
        code = entry.account_code.strip()
        debit = Decimal(str(entry.debit))
        credit = Decimal(str(entry.credit))
        if code.startswith("1"):
            total_assets += (debit - credit)
        elif code.startswith("2"):
            total_liabilities += (credit - debit)
        elif code.startswith("3"):
            total_equity += (credit - debit)
        else:
            total_assets += debit
            total_liabilities += credit

    sheet.title = title
    sheet.description = description
    sheet.deadline = deadline
    if file_url is not None:
        sheet.file_url = file_url
    if file_name is not None:
        sheet.file_name = file_name
    sheet.total_assets = total_assets
    sheet.total_liabilities = total_liabilities
    sheet.total_equity = total_equity

    # Clear old entries (SQLAlchemy will delete them due to delete-orphan)
    sheet.gl_entries.clear()

    for entry in gl_entries_in:
        db_entry = GLEntry(
            balance_sheet_id=sheet.id,
            account_code=entry.account_code,
            account_name=entry.account_name,
            debit=entry.debit,
            credit=entry.credit,
        )
        sheet.gl_entries.append(db_entry)

    from app.workflow_engine import run_flux_analysis
    sheet.system_flags = run_flux_analysis(db, sheet)

    # Create audit trail entry for update
    new_audit_entry = {
        "from_state": sheet.status,
        "to_state": sheet.status,
        "action": "UPDATE_LEDGER",
        "action_by": user.emp_id,
        "action_to": sheet.assigned_checker_id or sheet.maker_id,
        "timestamp": datetime.utcnow().isoformat(),
        "notes": f"Balance sheet details updated by {user.role}."
    }
    sheet.audit_trail = list(sheet.audit_trail) + [new_audit_entry]

    db.commit()
    db.refresh(sheet)
    return sheet

def get_balance_sheet(db: Session, sheet_id: uuid.UUID) -> Optional[BalanceSheet]:
    return db.query(BalanceSheet).filter(BalanceSheet.id == sheet_id).first()

def get_balance_sheets(db: Session, user: User) -> List[BalanceSheet]:
    role = user.role.upper()
    emp_id = user.emp_id

    if role == "MAKER":
        # Makers see sheets they created
        return db.query(BalanceSheet).filter(BalanceSheet.maker_id == emp_id).order_by(BalanceSheet.created_at.desc()).all()
    elif role == "CHECKER":
        # Checkers see sheets assigned to them, or sheets where they were in the audit trail
        return db.query(BalanceSheet).filter(
            or_(
                BalanceSheet.assigned_checker_id == emp_id,
                BalanceSheet.audit_trail.contains([{"action_by": emp_id}]),
                BalanceSheet.audit_trail.contains([{"action_to": emp_id}])
            )
        ).order_by(BalanceSheet.created_at.desc()).all()
    elif role == "FC":
        # FCs see sheets assigned to them, or sheets where they were in the audit trail
        return db.query(BalanceSheet).filter(
            or_(
                BalanceSheet.assigned_fc_id == emp_id,
                BalanceSheet.audit_trail.contains([{"action_by": emp_id}]),
                BalanceSheet.audit_trail.contains([{"action_to": emp_id}])
            )
        ).order_by(BalanceSheet.created_at.desc()).all()
    elif role == "CFO":
        # CFOs see sheets assigned to them, or sheets where they were in the audit trail, or all approved sheets
        return db.query(BalanceSheet).filter(
            or_(
                BalanceSheet.assigned_cfo_id == emp_id,
                BalanceSheet.status == "CFO_APPROVED",
                BalanceSheet.audit_trail.contains([{"action_by": emp_id}]),
                BalanceSheet.audit_trail.contains([{"action_to": emp_id}])
            )
        ).order_by(BalanceSheet.created_at.desc()).all()
        
    return []
