from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from app.schemas.incidents import (
    IncidentSimulateRequest,
    IncidentResponse,
    IncidentType,
)
from app.services.incidents_service import IncidentService
from app.core.exceptions import RepositoryError
from app.api.deps import get_incident_service, get_current_user
from app.models.user import User

router = APIRouter(prefix="/incidents", tags=["Incident Management"])


@router.post("/simulate", response_model=IncidentResponse, status_code=201)
def simulate_incident(
    request: IncidentSimulateRequest,
    incident_service: IncidentService = Depends(get_incident_service),
    current_user: User = Depends(get_current_user),
):
    """
    Simulates a realistic infrastructure incident by type.

    Supported types:
    - **db_exhaustion**: Database connection pool fully saturated (payment-gateway)
    - **auth_latency**: Auth-service response latency spike above threshold
    - **k8s_crashloop**: Kubernetes pod CrashLoopBackOff due to missing config
    """
    try:
        incident = incident_service.simulate(request.type)
        return incident
    except RepositoryError:
        # Let main.py's global exception handlers turn these into a
        # 503 (DB unavailable) or 409 (duplicate incident_id).
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")


@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    status: Optional[str] = Query(
        None,
        description="Filter by incident status: 'active' or 'resolved'"
    ),
    incident_service: IncidentService = Depends(get_incident_service),
):
    """
    Retrieves all incidents in the in-memory store, ordered newest-first.
    Optionally filter by status using the `status` query parameter.
    """
    return incident_service.get_all(status_filter=status)


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(
    incident_id: str,
    incident_service: IncidentService = Depends(get_incident_service),
):
    """
    Retrieves a specific incident by its ID (e.g. INC-2026-001).
    """
    incident = incident_service.get_by_id(incident_id)
    if not incident:
        raise HTTPException(
            status_code=404,
            detail=f"Incident '{incident_id}' not found."
        )
    return incident


@router.post("/{incident_id}/resolve", response_model=IncidentResponse)
def resolve_incident(
    incident_id: str,
    incident_service: IncidentService = Depends(get_incident_service),
    current_user: User = Depends(get_current_user),
):
    """
    Marks an active incident as resolved.
    """
    incident = incident_service.resolve(incident_id)
    if not incident:
        raise HTTPException(
            status_code=404,
            detail=f"Incident '{incident_id}' not found."
        )
    return incident


@router.get("/types/available")
def list_incident_types():
    """
    Lists all available incident simulation types and their descriptions.
    """
    return {
        "types": [
            {
                "key": IncidentType.DB_EXHAUSTION,
                "label": "Database Connection Pool Exhaustion",
                "service": "postgresql-db",
                "severity": "critical",
                "description": "SQLAlchemy pool saturated — checkout database calls failing",
                "affected_users": 1200
            },
            {
                "key": IncidentType.AUTH_LATENCY,
                "label": "Auth Service High Latency",
                "service": "auth-service",
                "severity": "warning",
                "description": "bcrypt blocking event loop — login latency 4x normal",
                "affected_users": 340
            },
            {
                "key": IncidentType.K8S_CRASHLOOP,
                "label": "Kubernetes Pod CrashLoopBackOff",
                "service": "payment-service",
                "severity": "critical",
                "description": "Missing application ConfigMap — payment pod unable to boot",
                "affected_users": 890
            },
            {
                "key": IncidentType.HIGH_CPU,
                "label": "High CPU Usage",
                "service": "auth-service",
                "severity": "critical",
                "description": "Runaway CPU execution on auth node (99% CPU)",
                "affected_users": 0
            },
            {
                "key": IncidentType.REDIS_FAILURE,
                "label": "Redis Cache Failure",
                "service": "redis-cache",
                "severity": "warning",
                "description": "Redis OOM — writes rejected, circuit breaker open",
                "affected_users": 620
            },
            {
                "key": IncidentType.MEMORY_LEAK,
                "label": "Memory Leak",
                "service": "user-service",
                "severity": "critical",
                "description": "Linear heap increase leading to Linux kernel OOM termination",
                "affected_users": 750
            },
            {
                "key": IncidentType.API_TIMEOUT,
                "label": "API Timeout",
                "service": "payment-service",
                "severity": "critical",
                "description": "Outgoing connections to Stripe gateway timeout after 15s",
                "affected_users": 1500
            },
            {
                "key": IncidentType.DISK_FULL,
                "label": "Disk Full",
                "service": "postgresql-db",
                "severity": "critical",
                "description": "WAL log directory at 100% space limit — DB locked read-only",
                "affected_users": 2200
            },
            {
                "key": IncidentType.NETWORK_LATENCY,
                "label": "Network Latency",
                "service": "user-service",
                "severity": "warning",
                "description": "Inter-pod packet delivery delay averaging 1500ms",
                "affected_users": 1800
            },
            {
                "key": IncidentType.NODE_FAILURE,
                "label": "Kubernetes Node Failure",
                "service": "k8s-cluster",
                "severity": "critical",
                "description": "Hypervisor host node-03 goes NotReady — evicting pods",
                "affected_users": 3500
            },
            {
                "key": IncidentType.SERVICE_UNAVAILABLE,
                "label": "Service Unavailable (503)",
                "service": "nginx-ingress",
                "severity": "critical",
                "description": "Target endpoint selector labels mismatch — zero ready pods",
                "affected_users": 4000
            },
        ]
    }

