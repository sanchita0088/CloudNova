class RepositoryError(Exception):
    """
    Base class for storage-layer errors. Repositories raise these instead
    of letting raw driver/ORM exceptions (psycopg, sqlalchemy) escape into
    the service or API layer. main.py registers a FastAPI exception
    handler per subclass so routers don't need repeated try/except
    boilerplate to turn a storage failure into a proper HTTP response.
    """


class DatabaseUnavailableError(RepositoryError):
    """The database could not be reached (connection refused, timeout, DNS failure, etc.)."""


class DuplicateIncidentError(RepositoryError):
    """Attempted to insert an incident whose incident_id already exists."""
