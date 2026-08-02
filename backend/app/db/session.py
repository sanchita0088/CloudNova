from typing import Generator
from sqlalchemy.orm import sessionmaker, Session
from app.db.database import engine

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields one Session per request and always
    closes it afterward, even if the request raised an exception.

    Usage in a router:
        def endpoint(db: Session = Depends(get_db)): ...

    In practice, routers don't call this directly - app/api/deps.py wraps
    it to hand routers a fully-built IncidentService instead of a bare
    Session (see get_incident_service).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
