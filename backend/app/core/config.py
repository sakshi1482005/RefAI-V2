import json

from pydantic_settings import BaseSettings


REQUIRED_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://refaiog.vercel.app",
)


class Settings(BaseSettings):
    groq_api_key: str = ""
    supabase_url: str
    supabase_service_key: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""
    resume_storage_bucket: str = ""
    chroma_persist_dir: str = "./chroma_data"
    cors_origins: str = ",".join(REQUIRED_CORS_ORIGINS)

    class Config:
        env_file = ".env"

    @property
    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins.strip()
        configured: list[str]
        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
                configured = [str(origin) for origin in parsed] if isinstance(parsed, list) else []
            except json.JSONDecodeError:
                configured = []
        else:
            configured = raw.split(",")

        normalized = [origin.strip().rstrip("/") for origin in (*REQUIRED_CORS_ORIGINS, *configured) if origin.strip()]
        return list(dict.fromkeys(normalized))

    @property
    def supabase_client_key(self) -> str:
        """Use the service key when available, otherwise an anon key for Auth checks."""
        key = self.supabase_service_key.strip() or self.supabase_anon_key.strip()
        if not key:
            raise ValueError("Configure SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY")
        return key


settings = Settings()
