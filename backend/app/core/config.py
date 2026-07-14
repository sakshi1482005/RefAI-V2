from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    groq_api_key: str
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    chroma_persist_dir: str = "./chroma_data"
    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
