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

# ==================== REGISTER ROUTERS ====================
# This explicitly maps backend endpoints to match the frontend fetch paths
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(sheets.router, prefix="/api")
app.include_router(deadlines.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Welcome to Veriledger Balance Sheet Management System API!"}
