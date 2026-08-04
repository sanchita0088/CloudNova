# ─────────────────────────────────────────────
# CloudOps AI — Backend Dockerfile
# Base: python:3.12-slim  (Debian Bookworm slim)
# ─────────────────────────────────────────────

FROM python:3.12-slim

# Keeps Python from buffering stdout/stderr so logs appear immediately
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# ── System build dependencies ───────────────────────────────────────────────
# gcc / g++ / cmake are needed to compile native extensions in:
#   • chromadb  (hnswlib)
#   • tokenizers (Rust wheels cover most platforms, but cmake is a fallback)
# They are installed, used for pip, then purged — all in one RUN layer so
# the final image layer does NOT contain the build toolchain.
# ───────────────────────────────────────────────────────────────────────────
COPY requirements.txt .

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        cmake \
    && pip install --upgrade pip \
    && pip install -r requirements.txt \
    && apt-get purge -y --auto-remove gcc g++ cmake \
    && rm -rf /var/lib/apt/lists/*

# ── Application source ──────────────────────────────────────────────────────
COPY . .

# Normalise line endings (CRLF → LF) in case the file was edited on Windows,
# then make the entrypoint executable.
RUN sed -i 's/\r$//' entrypoint.sh \
    && chmod +x entrypoint.sh

# ── Port ────────────────────────────────────────────────────────────────────
EXPOSE 8000

# ── Health check ────────────────────────────────────────────────────────────
# Docker checks /health every 30 s; the service is marked healthy after 3
# consecutive successes.  The frontend depends_on this.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://localhost:{os.environ.get(\"PORT\",8000)}/health')" \
    || exit 1

# ── Entrypoint ──────────────────────────────────────────────────────────────
# entrypoint.sh: runs `alembic upgrade head` then starts uvicorn
ENTRYPOINT ["./entrypoint.sh"]
