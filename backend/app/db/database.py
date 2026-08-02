import logging
from sqlalchemy import create_engine
from app.core.config import settings

logger = logging.getLogger(__name__)

# pool_pre_ping issues a lightweight "SELECT 1" before handing out a pooled
# connection, and transparently reconnects if it's gone stale. This matters
# once this app runs in Kubernetes: the Postgres pod can restart or a
# network blip can silently drop a pooled TCP connection, and without this
# the next query would fail with an unhelpful "server closed the connection
# unexpectedly" instead of just working.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    future=True,
)

logger.info(f"Database engine created for {engine.url.render_as_string(hide_password=True)}")
