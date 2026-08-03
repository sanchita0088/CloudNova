from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SystemSetting(Base):
    """
    ORM model for runtime system key-value settings.

    Stores operational flags such as 'monitoring_mode' ('live' | 'demo')
    and 'simulation_active' ('true' | 'false') so all Uvicorn workers
    and replicas maintain synchronized state.
    """
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(String(100), nullable=False)
