import logging

from app.core.config import settings
from app.db.supabase_client import supabase

logger = logging.getLogger(__name__)
SIGNED_RESUME_TTL_SECONDS = 600


class ResumeStorageUnavailable(RuntimeError):
    """Private resume Storage cannot complete a requested operation."""


def store_resume(user_id: str, resume_id: str, file_bytes: bytes) -> tuple[str | None, str]:
    bucket = settings.resume_storage_bucket.strip()
    storage_path = f"{user_id}/{resume_id}.pdf"

    if not bucket or not settings.supabase_service_key.strip():
        logger.warning("Private resume Storage is not configured for upload")
        raise ResumeStorageUnavailable("Private resume storage is temporarily unavailable")

    try:
        supabase.storage.from_(bucket).upload(
            path=storage_path,
            file=file_bytes,
            file_options={
                "content-type": "application/pdf",
                "upsert": "true",
            },
        )

        return storage_path, "stored"
    except Exception as exc:
        logger.warning("Private resume Storage upload failed user=%s resume=%s", user_id, resume_id)
        raise ResumeStorageUnavailable("Private resume storage is temporarily unavailable") from exc


def find_latest_student_resume(user_id: str) -> dict | None:
    """Prefer the persisted analysis path; list Storage only for legacy records."""
    bucket = settings.resume_storage_bucket.strip()
    if not bucket or not settings.supabase_service_key.strip():
        return None
    try:
        rows = (
            supabase.table("resume_analyses")
            .select("storage_path,file_name,updated_at")
            .eq("student_id", user_id)
            .eq("storage_status", "stored")
            .not_.is_("storage_path", "null")
            .order("updated_at", desc=True)
            .limit(1)
            .execute().data or []
        )
        if rows and rows[0].get("storage_path"):
            return {
                "path": str(rows[0]["storage_path"]),
                "file_name": str(rows[0].get("file_name") or "resume.pdf"),
            }
    except Exception:
        logger.exception("Persisted resume lookup failed for student=%s", user_id)

    # Explicit compatibility fallback for uploads created before resume_analyses
    # stored the authoritative Storage path.
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
        logger.warning("Private resume Storage is not configured for signing")
        raise ResumeStorageUnavailable("Private resume storage is temporarily unavailable")
    try:
        result = supabase.storage.from_(bucket).create_signed_url(path, expires_in)
        signed_url = result.get("signedURL") or result.get("signedUrl") or result.get("signed_url")
        if not signed_url:
            raise ValueError("Signed URL response was empty")
        return str(signed_url)
    except Exception as exc:
        logger.warning("Private resume Storage signing failed")
        raise ResumeStorageUnavailable("Private resume storage is temporarily unavailable") from exc
