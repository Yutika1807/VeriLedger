import os

IS_VERCEL = os.getenv("VERCEL") == "1"

if IS_VERCEL:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////tmp/veriledger.db")
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/tmp/uploads")
else:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./veriledger.db")
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

JWT_SECRET = os.getenv("JWT_SECRET", "supersecretjwtkeyforveriledger123!")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

STORAGE_PROVIDER = os.getenv("STORAGE_PROVIDER", "local")
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "")

os.makedirs(UPLOAD_DIR, exist_ok=True)
