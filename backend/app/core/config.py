import os
from typing import List, Any
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "CloudOps AI"
    API_V1_STR: str = "/api/v1"
    
    # Auth & Security — REQUIRED. Must be supplied via environment variable or .env
    # file.  The application will refuse to start if this is missing.
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    
    # AI & Vector DB Settings
    GEMINI_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OLLAMA_EMBEDDING_MODEL: str = "llama3.2"
    # Max seconds to wait on a single LLM request before failing over to the mock response
    LLM_TIMEOUT_SECONDS: int = 30
    
    CHROMA_DB_DIR: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "chromadb_data"
    )
    
    # Monitoring url
    PROMETHEUS_URL: str = "http://localhost:9090"

    # Database — REQUIRED.  Must be supplied via environment variable or .env
    # file.  The application will refuse to start if this is missing.
    # Uses the psycopg 3 driver (postgresql+psycopg://), per Phase 2 scope.
    # Example: postgresql+psycopg://postgres:changeme@localhost:5432/cloudops
    DATABASE_URL: str

    # CORS - allowed frontend origins. Kept as the same defaults that were
    # previously hardcoded directly in main.py; moving them here means a
    # production origin can be added via .env without a code change.
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",  # React app development port
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        return v

    # Environment variables configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
