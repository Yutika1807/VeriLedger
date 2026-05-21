from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from app.models import BalanceSheet, User

# Define workflow states
DRAFT = "DRAFT"
SENT_TO_CHECKER = "SENT_TO_CHECKER"
CHECKER_REJECTED = "CHECKER_REJECTED"
SENT_TO_FC = "SENT_TO_FC"
FC_REJECTED = "FC_REJECTED"
SENT_TO_CFO = "SENT_TO_CFO"
CFO_APPROVED = "CFO_APPROVED"
CFO_REJECTED = "CFO_REJECTED"

# Define workflow actions
ACTION_SUBMIT = "SUBMIT"
ACTION_ACCEPT = "ACCEPT"
ACTION_REJECT = "REJECT"
ACTION_APPROVE = "APPROVE"

def transition_sheet(
    db: Session,
    sheet: BalanceSheet,
    user: User,
    action: str,
    target_user_id: Optional[str] = None,
    notes: Optional[str] = None
) -> BalanceSheet:
    # 1. Check if sheet is locked
    if sheet.is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This balance sheet is locked (approved by CFO) and cannot be modified."
        )

    # 2. Check if deadline has lapsed
    if sheet.deadline and datetime.utcnow() > sheet.deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The deadline for this balance sheet has lapsed. Transitions are disabled."
        )

    from_state = sheet.status
    to_state = None
    assigned_to = None

    action = action.upper()

    # 3. Maker Workflow
    if user.role == "MAKER":
        if action != ACTION_SUBMIT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Makers can only perform 'SUBMIT' actions. Received: {action}"
            )
        if sheet.maker_id != user.emp_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the Maker who created this balance sheet can submit it."
            )
        if from_state not in [DRAFT, CHECKER_REJECTED, FC_REJECTED, CFO_REJECTED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot submit sheet in status '{from_state}'"
            )
        if not target_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A specific Checker's Employee ID must be provided."
            )
        
        # Segregation of Duties check
        if target_user_id == sheet.maker_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Compliance Error: Maker and Checker must be distinct individuals."
            )

        # Verify target user is a Checker
        checker_user = db.query(User).filter(User.emp_id == target_user_id, User.role == "CHECKER").first()
        if not checker_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target User '{target_user_id}' does not exist or is not a CHECKER."
            )

        # Force comment if sheet has HIGH_VARIANCE flag
        if sheet.system_flags and "HIGH_VARIANCE" in sheet.system_flags:
            if not notes or not notes.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Compliance Error: High variance detected. An explanatory comment is required to submit."
                )

        to_state = SENT_TO_CHECKER
        sheet.assigned_checker_id = target_user_id
        assigned_to = target_user_id

    # 4. Checker Workflow
    elif user.role == "CHECKER":
        if sheet.assigned_checker_id != user.emp_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not the assigned Checker for this sheet."
            )
        if from_state not in [SENT_TO_CHECKER, FC_REJECTED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot review sheet in status '{from_state}'"
            )

        if action == ACTION_ACCEPT:
            if not target_user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A specific FC's Employee ID must be provided to forward."
                )
            fc_user = db.query(User).filter(User.emp_id == target_user_id, User.role == "FC").first()
            if not fc_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Target User '{target_user_id}' does not exist or is not an FC."
                )
            to_state = SENT_TO_FC
            sheet.assigned_fc_id = target_user_id
            assigned_to = target_user_id
            
        elif action == ACTION_REJECT:
            to_state = CHECKER_REJECTED
            assigned_to = sheet.maker_id
            
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Checkers can only perform 'ACCEPT' or 'REJECT' actions. Received: {action}"
            )

    # 5. Financial Controller (FC) Workflow
    elif user.role == "FC":
        if sheet.assigned_fc_id != user.emp_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not the assigned FC for this sheet."
            )
        if from_state != SENT_TO_FC:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot review sheet in status '{from_state}'"
            )

        if action == ACTION_ACCEPT:
            if not target_user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A specific CFO's Employee ID must be provided to forward."
                )
            cfo_user = db.query(User).filter(User.emp_id == target_user_id, User.role == "CFO").first()
            if not cfo_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Target User '{target_user_id}' does not exist or is not a CFO."
                )
            to_state = SENT_TO_CFO
            sheet.assigned_cfo_id = target_user_id
            assigned_to = target_user_id
            
        elif action == ACTION_REJECT:
            to_state = FC_REJECTED
            assigned_to = sheet.assigned_checker_id
            
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"FCs can only perform 'ACCEPT' or 'REJECT' actions. Received: {action}"
            )

    # 6. CFO Workflow
    elif user.role == "CFO":
        if sheet.assigned_cfo_id != user.emp_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not the assigned CFO for this sheet."
            )
        if from_state != SENT_TO_CFO:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot review sheet in status '{from_state}'"
            )

        if action == ACTION_APPROVE:
            to_state = CFO_APPROVED
            sheet.is_locked = True
            assigned_to = None
            
        elif action == ACTION_REJECT:
            to_state = CFO_REJECTED
            assigned_to = sheet.maker_id
            
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"CFOs can only perform 'APPROVE' or 'REJECT' actions. Received: {action}"
            )

    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account role is invalid for this workflow."
        )

    # Update sheet state
    sheet.status = to_state
    
    # Create audit trail entry
    new_audit_entry = {
        "from_state": from_state,
        "to_state": to_state,
        "action": action,
        "action_by": user.emp_id,
        "action_to": assigned_to,
        "timestamp": datetime.utcnow().isoformat(),
        "notes": notes or ""
    }
    
    # Note: re-assigning is necessary for SQLAlchemy to detect modifications on JSONB fields
    sheet.audit_trail = list(sheet.audit_trail) + [new_audit_entry]

    db.commit()
    db.refresh(sheet)

    # Generate corporate compliance export if sheet was just locked
    if to_state == CFO_APPROVED and sheet.is_locked:
        try:
            from app.export_manager import generate_audit_certificate_pdf
            pdf_url = generate_audit_certificate_pdf(db, sheet)
            sheet.export_pdf_url = pdf_url
            db.commit()
            db.refresh(sheet)
        except Exception as e:
            import logging
            logging.getLogger("veriledger.workflow").error(f"Failed to generate audit certificate: {e}")

    return sheet


def run_flux_analysis(db: Session, sheet: BalanceSheet) -> list:
    previous_sheet = db.query(BalanceSheet).filter(
        BalanceSheet.id != sheet.id
    ).order_by(BalanceSheet.created_at.desc()).first()

    flags = []
    if not previous_sheet:
        return flags

    # Assets Flux
    curr_assets = float(sheet.total_assets)
    prev_assets = float(previous_sheet.total_assets)
    if prev_assets == 0:
        asset_var = 1.0 if curr_assets != 0 else 0.0
    else:
        asset_var = abs(curr_assets - prev_assets) / prev_assets

    # Liabilities Flux
    curr_liab = float(sheet.total_liabilities)
    prev_liab = float(previous_sheet.total_liabilities)
    if prev_liab == 0:
        liab_var = 1.0 if curr_liab != 0 else 0.0
    else:
        liab_var = abs(curr_liab - prev_liab) / prev_liab

    if asset_var > 0.15 or liab_var > 0.15:
        flags.append("HIGH_VARIANCE")

    return flags

