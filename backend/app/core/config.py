from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    groq_api_key: str = ""
    supabase_url: str
    supabase_service_key: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""
    resume_storage_bucket: str = ""
    chroma_persist_dir: str = "./chroma_data"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"

    class Config:
        env_file = ".env"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def supabase_client_key(self) -> str:
        """Use the service key when available, otherwise an anon key for Auth checks."""
        key = self.supabase_service_key.strip() or self.supabase_anon_key.strip()
        if not key:
            raise ValueError("Configure SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY")
        return key


settings = Settings()
