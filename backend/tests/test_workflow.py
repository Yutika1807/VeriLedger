import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
from decimal import Decimal
import uuid

from app.database import Base
from app.models import User, BalanceSheet, GLEntry
from app.crud import create_user, create_balance_sheet, generate_emp_id
from app.schemas import UserCreate, GLEntryCreate
from app.workflow_engine import (
    transition_sheet, 
    DRAFT, SENT_TO_CHECKER, CHECKER_REJECTED, SENT_TO_FC, FC_REJECTED, SENT_TO_CFO, CFO_APPROVED,
    ACTION_SUBMIT, ACTION_ACCEPT, ACTION_REJECT, ACTION_APPROVE
)
from fastapi import HTTPException

# Configure sqlite in-memory database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

def test_emp_id_sequential_generation(db):
    user_maker = UserCreate(name="Alice Maker", email="alice@veriledger.com", password="password123", role="MAKER")
    user_checker = UserCreate(name="Bob Checker", email="bob@veriledger.com", password="password123", role="CHECKER")
    
    created_maker = create_user(db, user_maker)
    created_checker = create_user(db, user_checker)
    
    year = datetime.utcnow().year
    assert created_maker.emp_id == f"EMP-{year}-0001"
    assert created_checker.emp_id == f"EMP-{year}-0002"

def test_workflow_happy_path(db):
    # 1. Create all 4 roles
    m = create_user(db, UserCreate(name="Maker", email="maker@test.com", password="pwd", role="MAKER"))
    c = create_user(db, UserCreate(name="Checker", email="checker@test.com", password="pwd", role="CHECKER"))
    fc = create_user(db, UserCreate(name="FC", email="fc@test.com", password="pwd", role="FC"))
    cfo = create_user(db, UserCreate(name="CFO", email="cfo@test.com", password="pwd", role="CFO"))

    # 2. Create Sheet
    deadline = datetime.utcnow() + timedelta(days=2)
    entries = [
        GLEntryCreate(account_code="1001", account_name="Cash", debit=Decimal("1000.00"), credit=Decimal("0.00")),
        GLEntryCreate(account_code="2001", account_name="Loan", debit=Decimal("0.00"), credit=Decimal("800.00")),
        GLEntryCreate(account_code="3001", account_name="Equity", debit=Decimal("0.00"), credit=Decimal("200.00"))
    ]
    sheet = create_balance_sheet(db, m.emp_id, "Q1 Balance Sheet", "Testing flow", deadline, None, None, entries)
    
    assert sheet.status == DRAFT
    assert sheet.total_assets == Decimal("1000.00")
    assert sheet.total_liabilities == Decimal("800.00")
    assert sheet.total_equity == Decimal("200.00")

    # 3. Maker Submits to Checker
    sheet = transition_sheet(db, sheet, m, ACTION_SUBMIT, target_user_id=c.emp_id, notes="Submitting for Q1")
    assert sheet.status == SENT_TO_CHECKER
    assert sheet.assigned_checker_id == c.emp_id

    # 4. Checker Accepts and routes to FC
    sheet = transition_sheet(db, sheet, c, ACTION_ACCEPT, target_user_id=fc.emp_id, notes="Verified. Looks good.")
    assert sheet.status == SENT_TO_FC
    assert sheet.assigned_fc_id == fc.emp_id

    # 5. FC Accepts and routes to CFO
    sheet = transition_sheet(db, sheet, fc, ACTION_ACCEPT, target_user_id=cfo.emp_id, notes="Double verified.")
    assert sheet.status == SENT_TO_CFO
    assert sheet.assigned_cfo_id == cfo.emp_id

    # 6. CFO Approves (Locks)
    sheet = transition_sheet(db, sheet, cfo, ACTION_APPROVE, notes="Final release approval.")
    assert sheet.status == CFO_APPROVED
    assert sheet.is_locked is True

def test_workflow_rejection_path(db):
    m = create_user(db, UserCreate(name="Maker", email="maker@test.com", password="pwd", role="MAKER"))
    c = create_user(db, UserCreate(name="Checker", email="checker@test.com", password="pwd", role="CHECKER"))
    
    deadline = datetime.utcnow() + timedelta(days=2)
    sheet = create_balance_sheet(db, m.emp_id, "Q1", "Test rejection", deadline, None, None, [])
    
    # Maker Submits
    sheet = transition_sheet(db, sheet, m, ACTION_SUBMIT, target_user_id=c.emp_id)
    assert sheet.status == SENT_TO_CHECKER
    
    # Checker Rejects back to Maker
    sheet = transition_sheet(db, sheet, c, ACTION_REJECT, notes="Discrepancy found.")
    assert sheet.status == CHECKER_REJECTED
    assert sheet.is_locked is False
    
    # Audit trail verifies details
    assert len(sheet.audit_trail) == 3 # creation, submit, reject
    assert sheet.audit_trail[-1]["notes"] == "Discrepancy found."
    assert sheet.audit_trail[-1]["from_state"] == SENT_TO_CHECKER
    assert sheet.audit_trail[-1]["to_state"] == CHECKER_REJECTED

def test_role_enforcement(db):
    m = create_user(db, UserCreate(name="Maker", email="maker@test.com", password="pwd", role="MAKER"))
    c = create_user(db, UserCreate(name="Checker", email="checker@test.com", password="pwd", role="CHECKER"))
    
    sheet = create_balance_sheet(db, m.emp_id, "Q1", "Test roles", datetime.utcnow() + timedelta(days=2), None, None, [])
    
    # Checker attempts to Submit (not allowed)
    with pytest.raises(HTTPException) as excinfo:
        transition_sheet(db, sheet, c, ACTION_SUBMIT, target_user_id=c.emp_id)
    assert excinfo.value.status_code in [400, 403]

    # Maker attempts to Accept (not allowed)
    with pytest.raises(HTTPException) as excinfo:
        transition_sheet(db, sheet, m, ACTION_ACCEPT, target_user_id=c.emp_id)
    assert excinfo.value.status_code == 400

def test_deadline_lapse(db):
    m = create_user(db, UserCreate(name="Maker", email="maker@test.com", password="pwd", role="MAKER"))
    c = create_user(db, UserCreate(name="Checker", email="checker@test.com", password="pwd", role="CHECKER"))
    
    # Set deadline in the past
    past_deadline = datetime.utcnow() - timedelta(hours=1)
    sheet = create_balance_sheet(db, m.emp_id, "Q1", "Expired", past_deadline, None, None, [])
    
    # Maker attempts to Submit, fails due to expired deadline
    with pytest.raises(HTTPException) as excinfo:
        transition_sheet(db, sheet, m, ACTION_SUBMIT, target_user_id=c.emp_id)
    assert excinfo.value.status_code == 400
    assert "lapsed" in excinfo.value.detail.lower()

def test_immutability_post_approval(db):
    m = create_user(db, UserCreate(name="Maker", email="maker@test.com", password="pwd", role="MAKER"))
    cfo = create_user(db, UserCreate(name="CFO", email="cfo@test.com", password="pwd", role="CFO"))
    
    sheet = create_balance_sheet(db, m.emp_id, "Q1", "Final Lock", datetime.utcnow() + timedelta(days=2), None, None, [])
    sheet.status = SENT_TO_CFO
    sheet.assigned_cfo_id = cfo.emp_id
    db.commit()
    
    # CFO Approves (Locks)
    sheet = transition_sheet(db, sheet, cfo, ACTION_APPROVE)
    assert sheet.is_locked is True
    
    # Attempt any action, fails
    with pytest.raises(HTTPException) as excinfo:
        transition_sheet(db, sheet, cfo, ACTION_REJECT)
    assert excinfo.value.status_code == 403
    assert "locked" in excinfo.value.detail.lower()

def test_segregation_of_duties_validation(db):
    m = create_user(db, UserCreate(name="Maker", email="maker@test.com", password="pwd", role="MAKER"))
    
    deadline = datetime.utcnow() + timedelta(days=2)
    sheet = create_balance_sheet(db, m.emp_id, "Q1", "Test segregation", deadline, None, None, [])
    
    # Maker attempts to assign themselves as Checker (not allowed)
    with pytest.raises(HTTPException) as excinfo:
        transition_sheet(db, sheet, m, ACTION_SUBMIT, target_user_id=m.emp_id)
    assert excinfo.value.status_code == 400
    assert "distinct individuals" in excinfo.value.detail

def test_flux_analysis_anomaly_detection(db):
    m = create_user(db, UserCreate(name="Maker", email="maker@test.com", password="pwd", role="MAKER"))
    c = create_user(db, UserCreate(name="Checker", email="checker@test.com", password="pwd", role="CHECKER"))
    
    deadline = datetime.utcnow() + timedelta(days=2)
    
    # 1. Create first submission (Base)
    entries1 = [
        GLEntryCreate(account_code="1001", account_name="Cash", debit=Decimal("1000.00"), credit=Decimal("0.00"))
    ]
    sheet1 = create_balance_sheet(db, m.emp_id, "Q1", "First submission", deadline, None, None, entries1)
    
    # 2. Create second submission with > 15% flux (Assets = 2000, 100% variance)
    entries2 = [
        GLEntryCreate(account_code="1001", account_name="Cash", debit=Decimal("2000.00"), credit=Decimal("0.00"))
    ]
    sheet2 = create_balance_sheet(db, m.emp_id, "Q2", "Second submission", deadline, None, None, entries2)
    
    assert "HIGH_VARIANCE" in sheet2.system_flags
    
    # 3. Attempt to submit with empty notes (fails)
    with pytest.raises(HTTPException) as excinfo:
        transition_sheet(db, sheet2, m, ACTION_SUBMIT, target_user_id=c.emp_id, notes="")
    assert excinfo.value.status_code == 400
    assert "explanatory comment is required" in excinfo.value.detail.lower()
    
    # 4. Submit with valid comment (succeeds)
    sheet2 = transition_sheet(db, sheet2, m, ACTION_SUBMIT, target_user_id=c.emp_id, notes="Assets doubled due to funding round.")
    assert sheet2.status == SENT_TO_CHECKER

def test_deadlines_api(db):
    from app.models import Deadline
    # Create a deadline
    d = Deadline(title="Q1 Close", cutoff_date=datetime.utcnow() + timedelta(days=5))
    db.add(d)
    db.commit()
    
    retrieved = db.query(Deadline).filter(Deadline.title == "Q1 Close").first()
    assert retrieved is not None
    assert retrieved.is_active is True

def test_comments_flow(db):
    from app.models import SheetComment
    m = create_user(db, UserCreate(name="Maker", email="maker@test.com", password="pwd", role="MAKER"))
    c = create_user(db, UserCreate(name="Checker", email="checker@test.com", password="pwd", role="CHECKER"))
    
    deadline = datetime.utcnow() + timedelta(days=2)
    sheet = create_balance_sheet(db, m.emp_id, "Q1", "Test comment flow", deadline, None, None, [])
    
    # 1. Maker submits to checker
    sheet = transition_sheet(db, sheet, m, ACTION_SUBMIT, target_user_id=c.emp_id)
    
    # 2. Checker posts comment (should resolve recipient to Maker)
    comment1 = SheetComment(
        balance_sheet_id=sheet.id,
        author_id=c.emp_id,
        text="Please check cash account.",
        recipient_id=m.emp_id,
        is_read=False
    )
    db.add(comment1)
    db.commit()
    
    assert comment1.author_name == "Checker"
    assert comment1.author_role == "CHECKER"
    
    # Check unread count for Maker
    unread_maker = db.query(SheetComment).filter(
        SheetComment.recipient_id == m.emp_id,
        SheetComment.is_read == False
    ).count()
    assert unread_maker == 1

def test_pdf_generation_on_approval(db):
    # Mock storage upload
    from unittest.mock import patch
    m = create_user(db, UserCreate(name="Maker", email="maker@test.com", password="pwd", role="MAKER"))
    cfo = create_user(db, UserCreate(name="CFO", email="cfo@test.com", password="pwd", role="CFO"))
    
    sheet = create_balance_sheet(db, m.emp_id, "Q1", "Final Release", datetime.utcnow() + timedelta(days=2), None, None, [])
    sheet.status = SENT_TO_CFO
    sheet.assigned_cfo_id = cfo.emp_id
    db.commit()
    
    with patch("app.storage.LocalStorageProvider.upload_file") as mock_upload:
        mock_upload.return_value = "/mock/path/audit_cert.pdf"
        sheet = transition_sheet(db, sheet, cfo, ACTION_APPROVE)
        assert sheet.is_locked is True
        assert sheet.export_pdf_url == "/mock/path/audit_cert.pdf"
        assert mock_upload.called

def test_fc_rejection_routes_to_checker(db):
    m = create_user(db, UserCreate(name="Maker", email="maker@test.com", password="pwd", role="MAKER"))
    c = create_user(db, UserCreate(name="Checker", email="checker@test.com", password="pwd", role="CHECKER"))
    fc = create_user(db, UserCreate(name="FC", email="fc@test.com", password="pwd", role="FC"))

    deadline = datetime.utcnow() + timedelta(days=2)
    sheet = create_balance_sheet(db, m.emp_id, "Q1", "Test FC rejection", deadline, None, None, [])
    
    # 1. Submit to checker
    sheet = transition_sheet(db, sheet, m, ACTION_SUBMIT, target_user_id=c.emp_id)
    # 2. Checker accepts and routes to FC
    sheet = transition_sheet(db, sheet, c, ACTION_ACCEPT, target_user_id=fc.emp_id)
    assert sheet.status == SENT_TO_FC
    assert sheet.assigned_fc_id == fc.emp_id
    
    # 3. FC rejects -> must route back to Checker
    sheet = transition_sheet(db, sheet, fc, ACTION_REJECT, notes="FC found errors")
    assert sheet.status == FC_REJECTED
    assert sheet.assigned_checker_id == c.emp_id
    assert sheet.audit_trail[-1]["action_to"] == c.emp_id
    assert sheet.audit_trail[-1]["to_state"] == FC_REJECTED

def test_sheet_update_ledger(db):
    from app.crud import update_balance_sheet
    m = create_user(db, UserCreate(name="Maker", email="maker@test.com", password="pwd", role="MAKER"))

    deadline = datetime.utcnow() + timedelta(days=2)
    sheet = create_balance_sheet(db, m.emp_id, "Q1", "Initial Title", deadline, None, None, [
        GLEntryCreate(account_code="1001", account_name="Cash", debit=Decimal("1000.00"), credit=Decimal("0.00"))
    ])
    
    assert sheet.total_assets == Decimal("1000.00")
    
    updated_entries = [
        GLEntryCreate(account_code="1001", account_name="Cash", debit=Decimal("1200.00"), credit=Decimal("0.00")),
        GLEntryCreate(account_code="2001", account_name="Loan", debit=Decimal("0.00"), credit=Decimal("200.00"))
    ]
    
    sheet = update_balance_sheet(
        db=db,
        sheet=sheet,
        title="Updated Title",
        description="Updated Description",
        deadline=deadline,
        file_url="/new/file.pdf",
        file_name="new.pdf",
        gl_entries_in=updated_entries,
        user=m
    )
    
    assert sheet.title == "Updated Title"
    assert sheet.description == "Updated Description"
    assert sheet.file_url == "/new/file.pdf"
    assert sheet.file_name == "new.pdf"
    assert sheet.total_assets == Decimal("1200.00")
    assert sheet.total_liabilities == Decimal("200.00")
    assert len(sheet.gl_entries) == 2
    assert sheet.audit_trail[-1]["action"] == "UPDATE_LEDGER"
    assert sheet.audit_trail[-1]["action_by"] == m.emp_id


