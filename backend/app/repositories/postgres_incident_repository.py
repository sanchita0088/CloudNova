import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError

from app.models.incident import Incident
from app.repositories.incident_repository import IncidentRepository
from app.core.exceptions import DatabaseUnavailableError, DuplicateIncidentError

logger = logging.getLogger(__name__)

# Matches the format IncidentService previously stored directly as a string
# (e.g. "2026-07-30T14:05:12Z"). Kept identical so API responses are
# byte-for-byte the same shape as before the storage swap.
_TIMESTAMP_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


class PostgresIncidentRepository(IncidentRepository):
    """
    Production incident storage, backed by Postgres via SQLAlchemy.

    Takes a Session rather than opening its own connection - the caller
    (either a request-scoped `Depends(get_db)` for HTTP routes, or
    `incident_service_scope()` in incidents_service.py for the sandbox
    background thread) owns the session's lifecycle and decides when it's
    closed. This repository commits after each write (one repository call
    == one unit of work), matching the instant-write semantics the
    in-memory repository had.

    This class is the ONLY place that knows both the ORM column names
    (title, description, service_name, ...) and the plain-dict shape
    IncidentService/IncidentResponse use (message, service, ...) - that
    translation is its whole job.
    """

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Translation helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _to_record(row: Incident) -> Dict[str, Any]:
        """Converts an ORM row into the plain dict IncidentService expects."""
        return {
            "id": row.incident_id,
            "service": row.service_name,
            "status": row.status,
            "severity": row.severity,
            "message": row.description,
            "timestamp": row.created_at.strftime(_TIMESTAMP_FORMAT),
            "ai_analysis": row.ai_analysis,
            "incident_type": row.incident_type,
            "environment": row.environment,
            "affected_users": row.affected_users,
            "business_impact": row.business_impact,
            "detection_source": row.detection_source,
            "namespace": row.namespace,
            "pod_name": row.pod_name,
            "timeline": row.timeline,
        }

    # ------------------------------------------------------------------
    # IncidentRepository interface
    # ------------------------------------------------------------------
    def add(self, incident_id: str, record: Dict[str, Any]) -> None:
        title = f"{record.get('service', 'unknown-service')} — {record.get('incident_type') or 'incident'}"
        row = Incident(
            incident_id=incident_id,
            title=title,
            description=record.get("message", ""),
            service_name=record.get("service", "unknown-service"),
            severity=record.get("severity", "warning"),
            incident_type=record.get("incident_type"),
            status=record.get("status", "active"),
            timeline=record.get("timeline"),
            ai_analysis=record.get("ai_analysis"),
            environment=record.get("environment", "Production Kubernetes"),
            affected_users=record.get("affected_users"),
            business_impact=record.get("business_impact"),
            detection_source=record.get("detection_source", "Prometheus AlertManager"),
            namespace=record.get("namespace", "cloudshop-prod"),
            pod_name=record.get("pod_name"),
        )
        try:
            self.db.add(row)
            self.db.commit()
        except IntegrityError as e:
            self.db.rollback()
            logger.warning(f"Duplicate incident_id on insert: {incident_id}")
            raise DuplicateIncidentError(f"Incident '{incident_id}' already exists.") from e
        except OperationalError as e:
            self.db.rollback()
            logger.error(f"Database unavailable while inserting incident {incident_id}: {e}")
            raise DatabaseUnavailableError("Could not reach the database.") from e
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Unexpected database error while inserting incident {incident_id}: {e}")
            raise

    def get_all(self) -> List[Dict[str, Any]]:
        try:
            rows = self.db.execute(select(Incident)).scalars().all()
            return [self._to_record(row) for row in rows]
        except OperationalError as e:
            logger.error(f"Database unavailable while listing incidents: {e}")
            raise DatabaseUnavailableError("Could not reach the database.") from e

    def get_by_id(self, incident_id: str) -> Optional[Dict[str, Any]]:
        try:
            row = self.db.execute(
                select(Incident).where(Incident.incident_id == incident_id)
            ).scalar_one_or_none()
            return self._to_record(row) if row else None
        except OperationalError as e:
            logger.error(f"Database unavailable while fetching incident {incident_id}: {e}")
            raise DatabaseUnavailableError("Could not reach the database.") from e

    def update(self, incident_id: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        # Maps IncidentResponse-shaped patch keys (e.g. "status", "ai_analysis")
        # back onto ORM column names where they differ.
        column_map = {"service": "service_name", "message": "description"}

        try:
            row = self.db.execute(
                select(Incident).where(Incident.incident_id == incident_id)
            ).scalar_one_or_none()
            if not row:
                return None

            for key, value in patch.items():
                column_name = column_map.get(key, key)
                if hasattr(row, column_name):
                    setattr(row, column_name, value)

            if patch.get("status") == "resolved" and row.resolved_at is None:
                row.resolved_at = datetime.now(timezone.utc)

            self.db.commit()
            self.db.refresh(row)
            return self._to_record(row)
        except OperationalError as e:
            self.db.rollback()
            logger.error(f"Database unavailable while updating incident {incident_id}: {e}")
            raise DatabaseUnavailableError("Could not reach the database.") from e
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Unexpected database error while updating incident {incident_id}: {e}")
            raise

    def count_with_id_prefix(self, prefix: str) -> int:
        try:
            count = self.db.execute(
                select(func.count()).select_from(Incident).where(Incident.incident_id.like(f"{prefix}%"))
            ).scalar_one()
            return count or 0
        except OperationalError as e:
            logger.error(f"Database unavailable while counting incidents: {e}")
            raise DatabaseUnavailableError("Could not reach the database.") from e
