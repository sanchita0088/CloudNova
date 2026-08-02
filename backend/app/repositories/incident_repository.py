from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any


class IncidentRepository(ABC):
    """
    Storage interface for incident records.

    IncidentService depends on this abstraction rather than a concrete
    storage mechanism. Two implementations exist: InMemoryIncidentRepository
    (used for isolated unit tests) and PostgresIncidentRepository (the
    production implementation, see app/repositories/postgres_incident_repository.py).

    Records are stored as plain dicts (matching IncidentResponse fields)
    rather than typed models here, since persistence-layer concerns
    (serialization, storage format) shouldn't leak the Pydantic schema
    used by the API layer.
    """

    @abstractmethod
    def add(self, incident_id: str, record: Dict[str, Any]) -> None:
        """Stores a new incident record under the given id."""
        raise NotImplementedError

    @abstractmethod
    def get_all(self) -> List[Dict[str, Any]]:
        """Returns all stored incident records, in no particular order."""
        raise NotImplementedError

    @abstractmethod
    def get_by_id(self, incident_id: str) -> Optional[Dict[str, Any]]:
        """Returns a single incident record, or None if it doesn't exist."""
        raise NotImplementedError

    @abstractmethod
    def update(self, incident_id: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Merges `patch` into the existing record and returns the updated
        record, or None if the incident doesn't exist.
        """
        raise NotImplementedError

    @abstractmethod
    def count_with_id_prefix(self, prefix: str) -> int:
        """
        Returns how many stored incidents have an id starting with `prefix`.
        Used by IncidentService to generate the next sequential incident_id
        (e.g. prefix="INC-2026-" -> count -> next id "INC-2026-{count+1:03d}")
        in a way that survives process restarts once storage is durable.
        """
        raise NotImplementedError


class InMemoryIncidentRepository(IncidentRepository):
    """
    In-memory incident store — the same Dict[str, dict] storage
    IncidentService previously owned directly, just moved behind the
    IncidentRepository interface. Behavior is unchanged: data does not
    survive a process restart.
    """

    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}

    def add(self, incident_id: str, record: Dict[str, Any]) -> None:
        self._store[incident_id] = record

    def get_all(self) -> List[Dict[str, Any]]:
        return list(self._store.values())

    def get_by_id(self, incident_id: str) -> Optional[Dict[str, Any]]:
        return self._store.get(incident_id)

    def update(self, incident_id: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        record = self._store.get(incident_id)
        if not record:
            return None
        record.update(patch)
        self._store[incident_id] = record
        return record

    def count_with_id_prefix(self, prefix: str) -> int:
        return sum(1 for key in self._store if key.startswith(prefix))
