import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "CloudOps AI"
    API_V1_STR: str = "/api/v1"
    
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

    # Database. The default below is a local-dev convenience value only -
    # it is always overridden via the DATABASE_URL environment variable in
    # Docker Compose (Phase 3) and via a Kubernetes Secret (Phase 4), so no
    # code change is needed to point this at a different Postgres instance.
    # Uses the psycopg 3 driver (postgresql+psycopg://), per Phase 2 scope.
    DATABASE_URL: str = "postgresql+psycopg://postgres:jasnoor2409@localhost:5432/cloudops"

    # CORS - allowed frontend origins. Kept as the same defaults that were
    # previously hardcoded directly in main.py; moving them here means a
    # production origin can be added via .env without a code change.
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",  # React app development port
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    # Environment variables configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
