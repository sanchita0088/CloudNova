## Overview

This repository is a CloudOps demo platform for simulating infrastructure incidents, viewing them in a web UI, and getting AI-assisted root-cause analysis with retrieval-augmented guidance from runbooks. In practice, it is a full-stack “SRE playground” that combines a FastAPI backend, a React/Vite frontend, PostgreSQL persistence, Chroma vector search, and Docker/Kubernetes deployment assets.

---

## 1) Purpose and problem it solves

The project aims to help developers, SREs, or demos show how a cloud operations workflow could work:

- simulate realistic incidents such as DB pool exhaustion, auth latency, pod crash loops, memory leaks, etc.
- expose those incidents through a dashboard
- use AI/RAG to generate recovery suggestions from runbooks
- provide a sandbox-style view of live or demo infrastructure metrics and alerts

The main problem it solves is making incident response and root-cause analysis easier to visualize and demonstrate without needing a real production environment.

Sources:
- [README.md](README.md)
- [backend/app/api/incidents_router.py](backend/app/api/incidents_router.py)
- [backend/app/services/ai_service.py](backend/app/services/ai_service.py)
- [backend/app/services/sandbox_service.py](backend/app/services/sandbox_service.py)

---

## 2) Tech stack

| Layer | Technologies | Why it is likely used |
|---|---|---|
| Backend | Python, FastAPI, Uvicorn | Fast API server with clean routing and async-friendly request handling |
| Data/DB | PostgreSQL, SQLAlchemy, Alembic | Persistent incident storage and schema migrations |
| AI/RAG | LangChain, Chroma, Ollama, Gemini-related packages | AI analysis and vector search over runbooks |
| Frontend | React, Vite, Tailwind CSS, Axios, Recharts, lucide-react | Modern SPA dashboard with charts, icons, and API calls |
| Monitoring | psutil, Docker SDK, Prometheus-style concepts | Host/container metrics and live monitoring support |
| Deployment | Docker Compose, Kubernetes manifests | Local orchestration and cloud deployment support |

### Key dependencies from the repo
- Backend: [backend/requirements.txt](backend/requirements.txt)
- Frontend: [frontend/package.json](frontend/package.json)

### Notable libraries
- FastAPI: API layer and request handling
- Pydantic/Pydantic Settings: request/response schemas and configuration loading
- SQLAlchemy + Alembic: ORM and migrations
- LangChain Community + Chroma: vector store and embeddings-based retrieval
- Ollama / Gemini integration: LLM-based RCA generation
- psutil and docker: live system/container metrics
- React + Vite: frontend build and runtime

---

## 3) Architecture and folder structure

### Top-level structure
- [backend/](backend/): Python service
- [frontend/](frontend/): React app
- [data/runbooks/](data/runbooks/): markdown runbooks used by the RAG system
- [k8s/](k8s/): Kubernetes YAML manifests
- [docker-compose.yml](docker-compose.yml): local Docker orchestration

### Backend architecture
- [backend/app/main.py](backend/app/main.py): FastAPI app entry point, router registration, CORS, health endpoint
- [backend/app/api/](backend/app/api/): routers for incidents, analysis, RAG, sandbox, system
- [backend/app/services/](backend/app/services/): business logic for incidents, AI analysis, RAG, sandbox, metrics, monitoring
- [backend/app/repositories/](backend/app/repositories/): repository layer for persistence
- [backend/app/models/](backend/app/models/): ORM models
- [backend/app/schemas/](backend/app/schemas/): Pydantic request/response models
- [backend/app/db/](backend/app/db/): DB engine/session/migration support
- [backend/alembic/](backend/alembic/): Alembic migration scripts

### Frontend architecture
- [frontend/src/main.jsx](frontend/src/main.jsx): React bootstrap
- [frontend/src/App.jsx](frontend/src/App.jsx): main dashboard UI
- [frontend/src/services/api.js](frontend/src/services/api.js): API client wrapper
- [frontend/src/components/RecoveryModal.jsx](frontend/src/components/RecoveryModal.jsx): recovery workflow UI

### Deployment assets
- [docker-compose.yml](docker-compose.yml): compose stack for PostgreSQL + backend + frontend
- [k8s/](k8s/): manifests for Kubernetes deployment, ingress, HPA, service monitors

### Entry points
- Backend entry point: [backend/app/main.py](backend/app/main.py) and [backend/entrypoint.sh](backend/entrypoint.sh)
- Frontend entry point: [frontend/src/main.jsx](frontend/src/main.jsx)
- Local orchestration entry point: [docker-compose.yml](docker-compose.yml)

---

## 4) How it works

### Backend request flow
A typical request follows this path:

1. The frontend calls an endpoint via [frontend/src/services/api.js](frontend/src/services/api.js)
2. FastAPI routes in [backend/app/api/](backend/app/api/) receive the request
3. Dependencies from [backend/app/api/deps.py](backend/app/api/deps.py) provide scoped services
4. Business logic lives in services such as [backend/app/services/incidents_service.py](backend/app/services/incidents_service.py)
5. Data is persisted through repositories into PostgreSQL via [backend/app/repositories/postgres_incident_repository.py](backend/app/repositories/postgres_incident_repository.py)
6. The response is returned as a Pydantic model to the frontend

### Incident + AI analysis flow
A typical incident lifecycle is:

1. User triggers an incident simulation from the UI
2. [backend/app/services/incidents_service.py](backend/app/services/incidents_service.py) creates an incident record
3. The incident is stored in PostgreSQL
4. The analysis endpoint calls [backend/app/services/ai_service.py](backend/app/services/ai_service.py)
5. The AI service uses [backend/app/services/rca_strategies.py](backend/app/services/rca_strategies.py) to build RCA
6. RAG retrieval pulls relevant runbooks from Chroma via [backend/app/services/rag_service.py](backend/app/services/rag_service.py)
7. The result is attached back to the incident and returned to the UI

### Sandbox/demo flow
The sandbox experience is more interactive:

- [backend/app/services/sandbox_service.py](backend/app/services/sandbox_service.py) runs a background worker
- it advances simulated service metrics over time
- alerts, incidents, and recovery states are updated in memory and shared with the frontend
- the UI polls the sandbox state endpoint and renders the evolving dashboard

---

## 5) Key components

### Backend
- [backend/app/services/incidents_service.py](backend/app/services/incidents_service.py)
  - creates, lists, resolves, and enriches incidents
  - generates incident IDs and timeline metadata

- [backend/app/services/ai_service.py](backend/app/services/ai_service.py)
  - chooses between real LLM/RCA and mock fallback strategies

- [backend/app/services/rca_strategies.py](backend/app/services/rca_strategies.py)
  - implements the RCA strategy pattern
  - includes mock canned responses and Ollama-based generation

- [backend/app/services/rag_service.py](backend/app/services/rag_service.py)
  - loads and queries Chroma vector store
  - ingests runbook documents

- [backend/app/services/sandbox_service.py](backend/app/services/sandbox_service.py)
  - simulates infrastructure failures and recovery flow

- [backend/app/services/metrics_provider.py](backend/app/services/metrics_provider.py)
  - abstracts live metrics collection from Docker or system metrics

- [backend/app/services/live_monitor.py](backend/app/services/live_monitor.py)
  - manages monitoring mode and live/demo telemetry

### Frontend
- [frontend/src/App.jsx](frontend/src/App.jsx)
  - main dashboard and UI state
  - handles incident simulation, sandbox control, analysis, recovery

- [frontend/src/services/api.js](frontend/src/services/api.js)
  - central API wrapper for backend calls

---

## 6) Setup and run locally

### Fastest path: Docker Compose
This is the easiest local approach:

```bash
docker compose up --build
```

Then visit:
- frontend: http://localhost:3000
- backend: http://localhost:8000
- docs: http://localhost:8000/docs

Relevant config:
- [docker-compose.yml](docker-compose.yml)
- [backend/Dockerfile](backend/Dockerfile)
- [backend/entrypoint.sh](backend/entrypoint.sh)

### Backend-only local setup
You would typically need:
- Python 3.12
- PostgreSQL running
- dependencies from [backend/requirements.txt](backend/requirements.txt)

Environment variables you may need:
- DATABASE_URL
- OLLAMA_BASE_URL
- OLLAMA_MODEL
- OLLAMA_EMBEDDING_MODEL
- GEMINI_API_KEY
- PROMETHEUS_URL
- PROJECT_NAME
- API_V1_STR

These are wired through [backend/app/core/config.py](backend/app/core/config.py).

### Frontend-only setup
From [frontend/package.json](frontend/package.json):

```bash
cd frontend
npm install
npm run dev
```

### DB setup
The app uses Alembic migrations:
- [backend/alembic/](backend/alembic/)
- [backend/app/db/database.py](backend/app/db/database.py)

In Docker, migration runs automatically. For manual runs, the docs in [README.md](README.md) show the commands.

---

## 7) Notable patterns and design decisions

A few things are worth learning from this repo:

- Clear separation of concerns
  - routers handle HTTP
  - services handle logic
  - repositories handle persistence
  - schemas define contracts

- Strategy pattern for AI RCA
  - [backend/app/services/rca_strategies.py](backend/app/services/rca_strategies.py) cleanly separates mock and real LLM implementations

- Factory pattern for metrics
  - [backend/app/services/metrics_provider.py](backend/app/services/metrics_provider.py) chooses a provider at runtime

- Dependency injection
  - [backend/app/api/deps.py](backend/app/api/deps.py) centralizes service construction

- Demo-first design
  - the project is intentionally very UI-driven and simulation-heavy, which makes it good for demos and education

---

## 8) Gaps and issues

A few weaknesses are visible:

- Tests exist, but they are mostly script-style and not fully integrated into a modern CI flow
  - [backend/app/tests/test_incidents.py](backend/app/tests/test_incidents.py)
  - [backend/app/tests/test_analysis.py](backend/app/tests/test_analysis.py)
  - [backend/app/tests/test_rag.py](backend/app/tests/test_rag.py)
  - [backend/app/tests/test_sandbox.py](backend/app/tests/test_sandbox.py)

- The README is strong on Docker/Kubernetes, but local development instructions are a bit implicit rather than fully polished

- The app uses a demo-oriented architecture with hardcoded defaults and fallback logic; it is great for showcasing patterns, but not yet a production-grade SRE platform

- Some defaults, such as DB credentials in [docker-compose.yml](docker-compose.yml), are fine for demos but should be externalized in real deployments

- The frontend README in [frontend/README.md](frontend/README.md) is still generic Vite boilerplate and does not describe this application specifically

---

## Plain-English summary

This project is a hands-on cloud operations simulator that lets you create fake incidents, view them in a dashboard, and ask an AI system for likely root causes and recovery steps. It blends a FastAPI backend, a React frontend, PostgreSQL, vector search over runbooks, and Docker/Kubernetes deployment support into one cohesive demo platform. The main idea is to make incident response feel tangible and interactive, especially for teaching, showcasing, or experimenting with SRE workflows.
