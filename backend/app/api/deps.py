"""
Centralized FastAPI dependency providers.

Routers should import from here (e.g. `Depends(get_incident_service)`)
instead of importing service singletons directly. This keeps "where do
I get my services from" in one place, and lets tests override any of
these with `app.dependency_overrides[get_x_service] = ...` without
needing a custom DI container.

get_incident_service is the one provider that is now request-scoped
(Phase 2): each HTTP request gets its own Session (via get_db) and its
own IncidentService bound to a PostgresIncidentRepository over that
session. Every other provider below still returns the existing
module-level singleton, unchanged from Phase 1.
"""
from sqlalchemy.orm import Session
from fastapi import Depends

from app.db.session import get_db
from app.services.incidents_service import IncidentService
from app.services.ai_service import ai_service, AIAnalysisService
from app.services.rag_service import rag_service, RAGService
from app.services.metrics_provider import metrics_factory, MetricsProviderFactory
from app.services.live_monitor import live_monitor_service, LiveMonitorService
from app.services.sandbox_service import sandbox_service, SandboxService
from app.repositories.incident_repository import IncidentRepository
from app.repositories.postgres_incident_repository import PostgresIncidentRepository


def get_incident_repository(db: Session = Depends(get_db)) -> IncidentRepository:
    return PostgresIncidentRepository(db)


def get_incident_service(
    repository: IncidentRepository = Depends(get_incident_repository),
) -> IncidentService:
    return IncidentService(repository=repository)


def get_ai_service() -> AIAnalysisService:
    return ai_service


def get_rag_service() -> RAGService:
    return rag_service


def get_metrics_factory() -> MetricsProviderFactory:
    return metrics_factory


def get_live_monitor_service() -> LiveMonitorService:
    return live_monitor_service


def get_sandbox_service() -> SandboxService:
    return sandbox_service


from fastapi import HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.models.user import User
from app.core import security

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False
)


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(reusable_oauth2)
) -> User:
    if token:
        payload = security.decode_access_token(token)
        if payload and payload.get("sub"):
            user = db.query(User).filter(User.username == payload.get("sub")).first()
            if user:
                return user
    # Fallback to default admin user so dashboard operates seamlessly without login
    return User(id=1, username="admin", email="admin@cloudops.ai", role="admin", is_active=True)


def get_optional_user(
    db: Session = Depends(get_db),
    token: str = Depends(reusable_oauth2)
) -> User | None:
    if not token:
        return None
    payload = security.decode_access_token(token)
    if not payload:
        return None
    username: str = payload.get("sub")
    if not username:
        return None
    user = db.query(User).filter(User.username == username).first()
    return user
