from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    Shared declarative base for all SQLAlchemy ORM models.

    Kept in its own module (rather than in database.py) so that
    alembic/env.py can import Base.metadata for autogenerate without
    also importing the engine/session machinery.
    """
    pass
