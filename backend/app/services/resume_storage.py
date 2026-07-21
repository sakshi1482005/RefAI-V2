import logging

from app.core.config import settings
from app.db.supabase_client import supabase

logger = logging.getLogger(__name__)
SIGNED_RESUME_TTL_SECONDS = 600


def store_resume(user_id: str, resume_id: str, file_bytes: bytes) -> tuple[str | None, str]:
    bucket = settings.resume_storage_bucket.strip()

    logger.info(f"Bucket = {bucket}")
    logger.info(f"Using service key = {bool(settings.supabase_service_key)}")

    storage_path = f"{user_id}/{resume_id}.pdf"

    try:
        result = supabase.storage.from_(bucket).upload(
            path=storage_path,
            file=file_bytes,
            file_options={
                "content-type": "application/pdf",
                "upsert": "true",
            },
        )

        logger.info("Upload Result: %s", result)

        return storage_path, "stored"

    except Exception as e:
        logger.exception("FULL STORAGE ERROR")
        raise


def find_latest_student_resume(user_id: str) -> dict | None:
    """Find a PDF only inside the authorized student's private folder."""
    bucket = settings.resume_storage_bucket.strip()
    if not bucket or not settings.supabase_service_key.strip():
        return None
    try:
        files = supabase.storage.from_(bucket).list(
            user_id,
            {"limit": 100, "sortBy": {"column": "created_at", "order": "desc"}},
        ) or []
    except Exception:
        logger.exception("Resume listing failed for authorized student=%s", user_id)
        return None
    pdfs = [item for item in files if str(item.get("name", "")).lower().endswith(".pdf")]
    if not pdfs:
        return None
    item = pdfs[0]
    return {"path": f"{user_id}/{item['name']}", "file_name": item["name"]}


def create_resume_signed_url(path: str, expires_in: int = SIGNED_RESUME_TTL_SECONDS) -> str:
    bucket = settings.resume_storage_bucket.strip()
    if not bucket or not settings.supabase_service_key.strip():
        raise RuntimeError("Private resume storage is not configured")
    result = supabase.storage.from_(bucket).create_signed_url(path, expires_in)
    signed_url = result.get("signedURL") or result.get("signedUrl") or result.get("signed_url")
    if not signed_url:
        raise RuntimeError("Supabase Storage did not return a signed resume URL")
    return str(signed_url)
