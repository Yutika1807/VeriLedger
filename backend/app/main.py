from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.database import engine, Base
from app.config import UPLOAD_DIR
from app.routers import auth, users, sheets, deadlines

# Create database tables if they do not exist
Base.metadata.create_all(bind=engine)

# Safely apply column migration if columns do not exist
from sqlalchemy import text
try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE balance_sheets ADD COLUMN system_flags JSON"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE balance_sheets ADD COLUMN export_pdf_url VARCHAR"))
except Exception:
    pass

# Seed default users if they do not exist (ephemeral SQLite support)
from app.database import SessionLocal
from app.crud import get_user_by_email, create_user
from app.schemas import UserCreate
from app.models import User

db = SessionLocal()
try:
    if db.query(User).count() == 0:
        # Seed standard demo roles
        for role in ['MAKER', 'CHECKER', 'FC', 'CFO']:
            email = f"{role.lower()}@veriledger.com"
            user_in = UserCreate(
                name=f"Demo {role.capitalize()}",
                email=email,
                password="password123",
                role=role
            )
            create_user(db, user_in)
        # Seed Deepak's test user
        if not get_user_by_email(db, "deepak@gmail.com"):
            create_user(db, UserCreate(
                name="Deepak Maker",
                email="deepak@gmail.com",
                password="password123",
                role="MAKER"
            ))
finally:
    db.close()

app = FastAPI(title="Veriledger API", version="1.0.0")

# Setup CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev ease; adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local uploads folder for static retrieval of balance sheet documents
app.mount("/api/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Register Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(sheets.router)
app.include_router(deadlines.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Veriledger Balance Sheet Management System API!"}
