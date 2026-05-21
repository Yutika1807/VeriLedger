from abc import ABC, abstractmethod
import os
import shutil
import logging
from app.config import STORAGE_PROVIDER, GCS_BUCKET_NAME, UPLOAD_DIR

logger = logging.getLogger("veriledger.storage")

class StorageProvider(ABC):
    @abstractmethod
    def upload_file(self, file_content: bytes, filename: str, content_type: str) -> str:
        """Uploads a file and returns its URL."""
        pass

class LocalStorageProvider(StorageProvider):
    def __init__(self, upload_dir: str = UPLOAD_DIR):
        self.upload_dir = upload_dir
        os.makedirs(self.upload_dir, exist_ok=True)

    def upload_file(self, file_content: bytes, filename: str, content_type: str) -> str:
        # Create safe filename
        safe_filename = f"{os.urandom(8).hex()}_{filename}"
        file_path = os.path.join(self.upload_dir, safe_filename)
        
        with open(file_path, "wb") as f:
            f.write(file_content)
            
        # Return path that can be retrieved via the /api/uploads/ static mount
        return f"/api/uploads/{safe_filename}"

class GCSStorageProvider(StorageProvider):
    def __init__(self, bucket_name: str = GCS_BUCKET_NAME):
        self.bucket_name = bucket_name
        self.client = None
        
        if not self.bucket_name:
            logger.warning("GCS_BUCKET_NAME is not set. GCSStorageProvider will fall back to local storage behavior.")
            self.fallback = LocalStorageProvider()
        else:
            try:
                from google.cloud import storage
                # This will attempt to use Application Default Credentials (ADC)
                self.client = storage.Client()
                self.bucket = self.client.bucket(self.bucket_name)
                self.fallback = None
            except Exception as e:
                logger.error(f"Failed to initialize GCS client: {e}. Falling back to local storage.")
                self.fallback = LocalStorageProvider()

    def upload_file(self, file_content: bytes, filename: str, content_type: str) -> str:
        if self.fallback:
            return self.fallback.upload_file(file_content, filename, content_type)
            
        try:
            safe_filename = f"{os.urandom(8).hex()}_{filename}"
            blob = self.bucket.blob(safe_filename)
            blob.upload_from_string(file_content, content_type=content_type)
            
            # Make the file public or return its authenticated access link depending on requirement
            # Here we return the public URL
            return blob.public_url
        except Exception as e:
            logger.error(f"GCS upload failed: {e}. Attempting local fallback.")
            fallback_provider = LocalStorageProvider()
            return fallback_provider.upload_file(file_content, filename, content_type)

def get_storage_provider() -> StorageProvider:
    if STORAGE_PROVIDER == "gcs":
        return GCSStorageProvider()
    return LocalStorageProvider()
