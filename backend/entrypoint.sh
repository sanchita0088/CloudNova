#!/bin/sh
# CloudOps AI — Backend container entrypoint
# 1. Run Alembic migrations to bring the database schema up to date.
# 2. Start the FastAPI application via uvicorn.
#
# The DATABASE_URL environment variable is injected by Docker Compose
# so migrations always target the correct Postgres container.

set -e

echo "=== CloudOps AI Backend ==="
echo "Running Alembic migrations..."
alembic upgrade head
echo "Migrations complete."

echo "Starting FastAPI application on 0.0.0.0:${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
