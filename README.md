# CloudOps AI

Intelligent Cloud Operations Platform — Phase 2 + Phase 3 (Docker).

---

## 🐳 Docker — Running the Full Stack

All three services (PostgreSQL, FastAPI backend, React frontend) are
orchestrated by Docker Compose.  A single command starts everything.

### Prerequisites

| Tool | Minimum version |
|------|----------------|
| Docker Desktop (Windows / macOS) | 4.x |
| Docker Engine (Linux) | 20.10+ |
| Docker Compose plugin | v2 (`docker compose`, not `docker-compose`) |

---

### Quick Start

```bash
# Clone / navigate to the project root
cd CloudOpsAI

# Build images and start all services (first run or after code changes)
docker compose up --build
```

Once all containers are healthy the app is available at:

| Service | URL |
|---------|-----|
| **Frontend** (React) | http://localhost:3000 |
| **Backend** (FastAPI) | http://localhost:8000 |
| **API docs** (Swagger) | http://localhost:8000/docs |
| **PostgreSQL** | localhost:5432 |

> **Alembic migrations run automatically** — the backend `entrypoint.sh`
> executes `alembic upgrade head` every time the container starts, _after_
> PostgreSQL has passed its health check.  No manual step is required.

---

### Common Commands

#### Start in the background (detached)

```bash
docker compose up --build -d
```

#### Stop containers (data volumes are preserved)

```bash
docker compose down
```

#### Stop containers **and** delete all data volumes

```bash
# ⚠️  This permanently deletes the PostgreSQL database and ChromaDB embeddings.
docker compose down -v
```

#### Rebuild a single service after a code change

```bash
# e.g. after changing backend code
docker compose up --build backend

# e.g. after changing frontend code
docker compose up --build frontend
```

#### Force a full rebuild (no Docker cache)

```bash
docker compose build --no-cache
docker compose up
```

---

### Viewing Logs

```bash
# All services — live-tail
docker compose logs -f

# Single service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

---

### Running Alembic Migrations Manually Inside Docker

Migrations run automatically on backend startup.  If you ever need to run
them manually (e.g. to generate a new revision or check the current state):

```bash
# Apply all pending migrations
docker compose exec backend alembic upgrade head

# Check current migration version
docker compose exec backend alembic current

# Show migration history
docker compose exec backend alembic history

# Generate a new auto-migration revision (after editing ORM models)
docker compose exec backend alembic revision --autogenerate -m "describe_change"

# Roll back one migration
docker compose exec backend alembic downgrade -1
```

> All `alembic` commands inside the container automatically use the
> `DATABASE_URL` environment variable injected by Docker Compose, so they
> always target the correct Postgres container.

---

### Environment Variables

Sensitive or environment-specific values are set in `docker-compose.yml`.
Override any value by creating a `.env` file **in the project root** alongside
`docker-compose.yml`:

```dotenv
# .env  (project root — git-ignored)
POSTGRES_PASSWORD=my_secure_password
GEMINI_API_KEY=AIza...
```

Then reference them in `docker-compose.yml` with `${VARIABLE_NAME}`.

---

### Accessing PostgreSQL Directly

```bash
# psql inside the db container
docker compose exec db psql -U postgres -d cloudops

# Or connect from your host with any GUI tool (pgAdmin, DBeaver, etc.)
# Host: localhost  Port: 5432  User: postgres  DB: cloudops
```

---

### Service Dependency Order

```
db (healthy) → backend (healthy) → frontend
```

Docker Compose enforces this automatically via `depends_on` + `condition: service_healthy`.

---

### ⚠️  Notes on Host Services (Ollama / Prometheus)

If you run **Ollama** or **Prometheus** on your host machine, the containers
reach them via `host.docker.internal` (configured in `docker-compose.yml`).
This works automatically on **Windows and macOS** Docker Desktop.

On **Linux** Docker Engine, add the following under the `backend` service in
`docker-compose.yml` if `host.docker.internal` does not resolve:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```
