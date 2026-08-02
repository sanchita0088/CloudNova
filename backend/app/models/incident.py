from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import String, Text, Integer, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Incident(Base):
    """
    ORM model for a persisted incident record.

    This is intentionally NOT the same shape as app/schemas/incidents.py's
    IncidentResponse - that's the API's public contract, this is the
    storage layout. `PostgresIncidentRepository` is the seam that
    translates between the two, so a column can be renamed here or the
    API response can gain a field without the other needing to change.

    Column naming follows the task's spec (title, description,
    service_name) rather than mirroring the API's field names
    (message, service) 1:1.
    """
    __tablename__ = "incidents"

    # Internal surrogate primary key - NOT the same as the business-facing
    # "INC-2026-001" style ID (that's `incident_id` below).
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Business-facing ID, e.g. "INC-2026-001". Unique + indexed since it's
    # how the API and every lookup (get_by_id, resolve, attach_ai_analysis)
    # addresses a specific incident.
    incident_id: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)

    # Short human-readable label, derived from service + incident_type at
    # creation time. Not currently surfaced via the API, but useful for
    # anyone querying the table directly (psql, Grafana in a later phase).
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    # Maps to IncidentResponse.message - the raw log/exception text.
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Maps to IncidentResponse.service.
    service_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="warning")
    incident_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # JSONB (Postgres-native binary JSON) rather than plain JSON: it's
    # indexable/queryable later and is the standard choice for
    # semi-structured data on Postgres.
    timeline: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, nullable=True)
    ai_analysis: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)

    # --- Enriched metadata, mirroring IncidentResponse's extra fields so
    # nothing is lost when persisting (Phase 1's in-memory dict kept these
    # too - this just gives them typed columns). ---
    environment: Mapped[str] = mapped_column(String(100), nullable=False, default="Production Kubernetes")
    affected_users: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    business_impact: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detection_source: Mapped[str] = mapped_column(String(100), nullable=False, default="Prometheus AlertManager")
    namespace: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="cloudshop-prod")
    pod_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<Incident {self.incident_id} status={self.status}>"
