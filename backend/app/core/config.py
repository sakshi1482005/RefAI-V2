import json
import re

from pydantic_settings import BaseSettings


REQUIRED_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://refaiog.vercel.app",
)
VERCEL_ORIGIN_REGEX = r"https://[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app"


def parse_cors_origins(raw_value: str | None) -> list[str]:
    """Parse JSON arrays or common delimited environment-variable formats."""
    raw = (raw_value or "").strip()
    configured: list[str] = []
    if raw.startswith("["):
        try:
            parsed = json.loads(raw)
            configured = [str(origin) for origin in parsed] if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            configured = []
    else:
        configured = re.split(r"[,;\s]+", raw)

    normalized = []
    for origin in (*REQUIRED_CORS_ORIGINS, *configured):
        clean = origin.strip().strip("\"'").rstrip("/")
        if clean and clean not in normalized:
            normalized.append(clean)
    return normalized


class Settings(BaseSettings):
    groq_api_key: str = ""
    supabase_url: str
    supabase_service_key: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""
    resume_storage_bucket: str = ""
    chroma_persist_dir: str = "./chroma_data"
    ai_apply_default_min_compatibility: int = 55
    ai_apply_max_matches: int = 10
    ai_apply_weekly_request_cap: int = 3
    ai_apply_initial_credit_balance: int = 5
    ai_apply_submission_rate_limit: int = 6
    ai_apply_submission_rate_window_seconds: int = 600
    cors_origins: str = ",".join(REQUIRED_CORS_ORIGINS)

    class Config:
        env_file = ".env"

    @property
    def cors_origin_list(self) -> list[str]:
        return parse_cors_origins(self.cors_origins)

    @property
    def cors_origin_regex(self) -> str:
        return VERCEL_ORIGIN_REGEX

    @property
    def supabase_client_key(self) -> str:
        """Use the service key when available, otherwise an anon key for Auth checks."""
        key = self.supabase_service_key.strip() or self.supabase_anon_key.strip()
        if not key:
            raise ValueError("Configure SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY")
        return key


settings = Settings()
