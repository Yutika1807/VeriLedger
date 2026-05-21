import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Numeric, Boolean, DateTime, ForeignKey, text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    emp_id = Column(String(15), unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String(10), nullable=False)  # MAKER, CHECKER, FC, CFO
    created_at = Column(DateTime, default=datetime.utcnow)

class BalanceSheet(Base):
    __tablename__ = "balance_sheets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="DRAFT")  # DRAFT, SENT_TO_CHECKER, CHECKER_REJECTED, SENT_TO_FC, FC_REJECTED, SENT_TO_CFO, CFO_APPROVED, CFO_REJECTED
    
    maker_id = Column(String(15), ForeignKey("users.emp_id"), nullable=False)
    assigned_checker_id = Column(String(15), ForeignKey("users.emp_id"), nullable=True)
    assigned_fc_id = Column(String(15), ForeignKey("users.emp_id"), nullable=True)
    assigned_cfo_id = Column(String(15), ForeignKey("users.emp_id"), nullable=True)

    file_url = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    
    total_assets = Column(Numeric(precision=15, scale=2), default=0.00)
    total_liabilities = Column(Numeric(precision=15, scale=2), default=0.00)
    total_equity = Column(Numeric(precision=15, scale=2), default=0.00)
    
    deadline = Column(DateTime, nullable=True)
    audit_trail = Column(JSON, default=list, server_default='[]')
    is_locked = Column(Boolean, default=False)
    system_flags = Column(JSON, default=list, server_default='[]')
    export_pdf_url = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    maker = relationship("User", foreign_keys=[maker_id], backref="maker_sheets")
    checker = relationship("User", foreign_keys=[assigned_checker_id], backref="checker_sheets")
    fc = relationship("User", foreign_keys=[assigned_fc_id], backref="fc_sheets")
    cfo = relationship("User", foreign_keys=[assigned_cfo_id], backref="cfo_sheets")
    
    gl_entries = relationship("GLEntry", back_populates="balance_sheet", cascade="all, delete-orphan")
    comments = relationship("SheetComment", back_populates="balance_sheet", cascade="all, delete-orphan")

class GLEntry(Base):
    __tablename__ = "gl_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    balance_sheet_id = Column(UUID(as_uuid=True), ForeignKey("balance_sheets.id"), nullable=False)
    account_code = Column(String, nullable=False)
    account_name = Column(String, nullable=False)
    debit = Column(Numeric(precision=15, scale=2), default=0.00)
    credit = Column(Numeric(precision=15, scale=2), default=0.00)
    created_at = Column(DateTime, default=datetime.utcnow)

    balance_sheet = relationship("BalanceSheet", back_populates="gl_entries")

class Deadline(Base):
    __tablename__ = "deadlines"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    cutoff_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

class SheetComment(Base):
    __tablename__ = "sheet_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    balance_sheet_id = Column(UUID(as_uuid=True), ForeignKey("balance_sheets.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(String(15), ForeignKey("users.emp_id"), nullable=False)
    text = Column(String, nullable=False)
    recipient_id = Column(String(15), ForeignKey("users.emp_id"), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    balance_sheet = relationship("BalanceSheet", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])
    recipient = relationship("User", foreign_keys=[recipient_id])

    @property
    def author_name(self):
        return self.author.name if self.author else "System"

    @property
    def author_role(self):
        return self.author.role if self.author else "SYSTEM"


