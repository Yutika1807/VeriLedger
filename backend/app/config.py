import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./veriledger.db")
JWT_SECRET = os.getenv("JWT_SECRET", "supersecretjwtkeyforveriledger123!")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

STORAGE_PROVIDER = os.getenv("STORAGE_PROVIDER", "local")
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

os.makedirs(UPLOAD_DIR, exist_ok=True)
