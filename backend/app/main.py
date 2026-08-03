from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.exceptions import DatabaseUnavailableError, DuplicateIncidentError
from app.api.rag_router import router as rag_router
from app.api.incidents_router import router as incidents_router
from app.api.analysis_router import router as analysis_router
from app.api.sandbox_router import router as sandbox_router
from app.api.system_router import router as system_router
from app.api.auth_router import router as auth_router

from prometheus_fastapi_instrumentator import Instrumentator

setup_logging()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Instrument Prometheus metrics endpoint for Kubernetes ServiceMonitor
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Register routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(rag_router, prefix=settings.API_V1_STR)
app.include_router(incidents_router, prefix=settings.API_V1_STR)
app.include_router(analysis_router, prefix=settings.API_V1_STR)
app.include_router(sandbox_router, prefix=settings.API_V1_STR)
app.include_router(system_router, prefix=settings.API_V1_STR)



# Set up CORS origins (sourced from settings so it can be overridden via
# .env per-environment without a code change; defaults are unchanged)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global handlers for storage-layer errors (Phase 2). Repositories raise
# these typed exceptions instead of letting raw psycopg/sqlalchemy errors
# escape; handling them here means individual routers don't need
# repeated try/except blocks to turn a DB failure into a clean HTTP
# response instead of an unhandled 500 / crash.
@app.exception_handler(DatabaseUnavailableError)
async def database_unavailable_handler(request: Request, exc: DatabaseUnavailableError):
    return JSONResponse(
        status_code=503,
        content={"detail": f"Service temporarily unavailable: {exc}"},
    )


@app.exception_handler(DuplicateIncidentError)
async def duplicate_incident_handler(request: Request, exc: DuplicateIncidentError):
    return JSONResponse(
        status_code=409,
        content={"detail": str(exc)},
    )


@app.get("/health", tags=["Health"])
def health_check():
    """
    Health check endpoint to verify backend status.
    """
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": "1.0.0"
    }


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to the {settings.PROJECT_NAME} API. Access API docs at /docs"
    }
