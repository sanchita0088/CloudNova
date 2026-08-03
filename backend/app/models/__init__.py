# Import every ORM model here so that a single `import app.models` (used by
# alembic/env.py for autogenerate) registers all tables on Base.metadata.
from app.models.incident import Incident  # noqa: F401
from app.models.system_setting import SystemSetting  # noqa: F401
from app.models.user import User  # noqa: F401


