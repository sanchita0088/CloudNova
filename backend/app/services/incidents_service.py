import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from app.schemas.incidents import (
    IncidentCreate,
    IncidentResponse,
    IncidentUpdate,
    IncidentType
)
from app.repositories.incident_repository import (
    IncidentRepository,
    InMemoryIncidentRepository,
)

logger = logging.getLogger(__name__)


def _build_timeline(detected_at: datetime) -> List[Dict[str, str]]:
    """Generates a realistic incident lifecycle timeline from detection time."""
    fmt = "%H:%M"
    return [
        {"time": detected_at.strftime(fmt),          "event": "Prometheus Alert Triggered",              "icon": "alert"},
        {"time": (detected_at + timedelta(minutes=1)).strftime(fmt), "event": "CloudOps AI Received Alert",    "icon": "dot"},
        {"time": (detected_at + timedelta(minutes=2)).strftime(fmt), "event": "RAG Retrieved Runbooks",        "icon": "search"},
        {"time": (detected_at + timedelta(minutes=3)).strftime(fmt), "event": "Gemini Generated Root Cause",   "icon": "brain"},
        {"time": (detected_at + timedelta(minutes=4)).strftime(fmt), "event": "Recovery Checklist Dispatched", "icon": "check"},
        {"time": (detected_at + timedelta(minutes=5)).strftime(fmt), "event": "Pending Admin Approval",        "icon": "resolve"},
    ]


# ---------------------------------------------------------------------------
# 5 Realistic incident simulation templates for the CloudShop demo application
# ---------------------------------------------------------------------------
INCIDENT_TEMPLATES: Dict[str, dict] = {
    IncidentType.DB_EXHAUSTION: {
        "service": "payment-gateway",
        "severity": "critical",
        "incident_type": "db_exhaustion",
        "namespace": "cloudshop-prod",
        "pod_name": "payment-gateway-7f9d8c-xvk2p",
        "environment": "Production Kubernetes",
        "detection_source": "Prometheus AlertManager",
        "affected_users": 1200,
        "business_impact": "Payment processing unavailable — checkout flow failing for all users",
        "message": (
            "sqlalchemy.exc.TimeoutError: QueuePool limit of size 10 overflow 10 reached, "
            "connection timed out after 30 seconds. "
            "All connections in pool are busy. "
            "Last error: psycopg2.OperationalError: FATAL: remaining connection slots "
            "are reserved for non-replication superuser connections."
        ),
    },
    IncidentType.AUTH_LATENCY: {
        "service": "auth-service",
        "severity": "warning",
        "incident_type": "auth_latency",
        "namespace": "cloudshop-prod",
        "pod_name": "auth-service-5dc7f-mnp98",
        "environment": "Production Kubernetes",
        "detection_source": "Prometheus AlertManager",
        "affected_users": 340,
        "business_impact": "User login latency degraded — session token issuance averaging 4x normal response time",
        "message": (
            "High latency detected: API response time averaged 892ms over 5-minute window. "
            "Threshold: 500ms. "
            "Probable cause: bcrypt verification blocking async event loop. "
            "Error: asyncio.TimeoutError raised on /api/v1/auth/verify after 30s. "
            "Redis cache MISS rate at 78% — possible Redis connection saturation."
        ),
    },
    IncidentType.K8S_CRASHLOOP: {
        "service": "order-service",
        "severity": "critical",
        "incident_type": "k8s_crashloop",
        "namespace": "cloudshop-prod",
        "pod_name": "order-service-7d4b9c8f6-xvk2p",
        "environment": "Production Kubernetes",
        "detection_source": "Kubernetes Controller Manager",
        "affected_users": 890,
        "business_impact": "Order creation and tracking fully unavailable — pods unable to start",
        "message": (
            "Pod order-service-7d4b9c8f6-xvk2p is in CrashLoopBackOff state. "
            "Restart count: 7. "
            "Exit code: 1. "
            "Last log: FileNotFoundError: [Errno 2] No such file or directory: '/app/config/settings.yml'. "
            "Liveness probe failed: HTTP probe failed with statuscode 500 after 3 attempts. "
            "Back-off restarting failed container."
        ),
    },
    IncidentType.HIGH_CPU: {
        "service": "worker-service",
        "severity": "critical",
        "incident_type": "high_cpu",
        "namespace": "cloudshop-prod",
        "pod_name": "worker-service-6bc44d-qr7xt",
        "environment": "Production Kubernetes",
        "detection_source": "Prometheus AlertManager",
        "affected_users": 0,
        "business_impact": "Background job processing stalled — CPU throttled at 98%, queue depth increasing",
        "message": (
            "Alert: HighCPUUsage firing for node cloudshop-node-02. "
            "worker-service CPU usage at 98.4% for 8 minutes (threshold: 80%). "
            "container_cpu_throttled_seconds_total increasing exponentially. "
            "Runaway goroutine detected: image-processing job with ID job-82931 consuming 6 vCPU cores. "
            "OOMKiller event pending — pod eviction likely within 2 minutes."
        ),
    },
    IncidentType.REDIS_FAILURE: {
        "service": "redis-cache",
        "severity": "warning",
        "incident_type": "redis_failure",
        "namespace": "cloudshop-prod",
        "pod_name": "redis-master-0",
        "environment": "Production Kubernetes",
        "detection_source": "Prometheus AlertManager",
        "affected_users": 620,
        "business_impact": "User sessions not persisting — cart and wishlist data lost on page reload",
        "message": (
            "redis.exceptions.ConnectionError: Error 111 connecting to redis-master:6379. Connection refused. "
            "redis_connected_clients dropped from 120 to 0. "
            "used_memory_rss: 8.1GB (maxmemory: 8GB). "
            "eviction_policy: noeviction — writes rejected. "
            "Redis replication lag: 14.2s (replica redis-replica-0 lagging behind master). "
            "session-service circuit breaker OPEN after 50 consecutive failures."
        ),
    },
    IncidentType.MEMORY_LEAK: {
        "service": "user-service",
        "severity": "critical",
        "incident_type": "memory_leak",
        "namespace": "cloudshop-prod",
        "pod_name": "user-service-58d9cfb4f-xpt23",
        "environment": "Production Kubernetes",
        "detection_source": "Kubernetes NodeExporter",
        "affected_users": 750,
        "business_impact": "User profile edits and user dashboard latency high - microservice restarted due to OOM",
        "message": (
            "WARNING: memory usage exceeds 95% limit. "
            "Killed process: user-service (OOM-killer) by Linux kernel. "
            "used_memory_rss: 2048MB (limit: 2048MB). "
            "Liveness probe failed: connection refused. Container terminated."
        ),
    },
    IncidentType.API_TIMEOUT: {
        "service": "payment-service",
        "severity": "critical",
        "incident_type": "api_timeout",
        "namespace": "cloudshop-prod",
        "pod_name": "payment-service-b2f9cd74-mnw29",
        "environment": "Production Kubernetes",
        "detection_source": "Prometheus AlertManager",
        "affected_users": 1500,
        "business_impact": "Checkout transactions stalling and timing out - Stripe provider sandbox interface not responding",
        "message": (
            "httpx.ReadTimeout: Stripe API call timed out after 15.0 seconds. "
            "Event loop blocked on sync network call. "
            "Ingress HTTP 504 gateway timeout rate: 45%. "
            "Upstream response time averaged 15.24s."
        ),
    },
    IncidentType.DISK_FULL: {
        "service": "postgresql-db",
        "severity": "critical",
        "incident_type": "disk_full",
        "namespace": "cloudshop-prod",
        "pod_name": "postgres-db-0",
        "environment": "Production Kubernetes",
        "detection_source": "Prometheus AlertManager",
        "affected_users": 2200,
        "business_impact": "All persistence writing operations blocked - checkout, cart saving, and user registrations failing",
        "message": (
            "psycopg2.OperationalError: FATAL: could not write to file 'base/16384/12345': No space left on device. "
            "Write IOPS dropped to 0. "
            "Transaction log WAL allocation failed. pg_wal partition utilization at 100%."
        ),
    },
    IncidentType.NETWORK_LATENCY: {
        "service": "user-service",
        "severity": "warning",
        "incident_type": "network_latency",
        "namespace": "cloudshop-prod",
        "pod_name": "user-service-58d9cfb4f-xpt23",
        "environment": "Production Kubernetes",
        "detection_source": "Kubernetes Cluster CoreDNS",
        "affected_users": 1800,
        "business_impact": "Cascading page load delay across the entire site - inter-pod communication latency averaging 1500ms",
        "message": (
            "Network latency spike: Average round-trip-time (RTT) on eth0 reached 1520ms. "
            "Packet loss at 12.4%. "
            "DNS lookup times for auth-service.cloudshop-prod.svc.cluster.local exceed 2.5s."
        ),
    },
    IncidentType.NODE_FAILURE: {
        "service": "k8s-cluster",
        "severity": "critical",
        "incident_type": "node_failure",
        "namespace": "cloudshop-prod",
        "pod_name": "node/cloudshop-node-03",
        "environment": "Production Kubernetes",
        "detection_source": "Kubernetes Controller Manager",
        "affected_users": 3500,
        "business_impact": "Cluster capacity reduced by 33% - multiple replica pods evicting and stuck in Pending state",
        "message": (
            "Kubelet stopped posting status. Node cloudshop-node-03 transitioned to NotReady state. "
            "Reason: Node lease renew timeout / kernel panic. "
            "14 pods evicted and pending rescheduling due to unschedulable nodes."
        ),
    },
    IncidentType.SERVICE_UNAVAILABLE: {
        "service": "nginx-ingress",
        "severity": "critical",
        "incident_type": "service_unavailable",
        "namespace": "cloudshop-prod",
        "pod_name": "nginx-ingress-controller-4d82b",
        "environment": "Production Kubernetes",
        "detection_source": "Prometheus AlertManager",
        "affected_users": 4000,
        "business_impact": "Global storefront unreachable - HTTP 503 Service Unavailable returned on all entry routes",
        "message": (
            "nginx error: Ingress controller received HTTP 503 from backend upstream 'payment-service'. "
            "Reason: No active endpoints registered for service 'payment-service'. "
            "Endpoint selector mismatch or readiness probes failing for all replicas."
        ),
    },
}


class IncidentService:
    """
    Manages simulation, retrieval, and state transitions of CloudShop
    infrastructure incidents.

    Storage is delegated to an IncidentRepository. The default
    (InMemoryIncidentRepository) is only used when this service is
    constructed with no arguments, which isolated unit tests rely on
    (see app/tests/test_incidents.py) - production code always passes an
    explicit PostgresIncidentRepository, either per-request via
    app/api/deps.py or per-call via incident_service_scope() below.
    """

    def __init__(self, repository: Optional[IncidentRepository] = None):
        self._repo: IncidentRepository = repository or InMemoryIncidentRepository()

    def _generate_id(self) -> str:
        # Sequence is derived from the repository (a COUNT query against
        # Postgres) rather than an in-memory counter, so IDs stay
        # sequential and collision-free across process restarts now that
        # incidents are durably stored. Format is unchanged: INC-YYYY-NNN.
        year = datetime.now(timezone.utc).year
        prefix = f"INC-{year}-"
        seq = self._repo.count_with_id_prefix(prefix) + 1
        return f"{prefix}{seq:03d}"

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    def simulate(self, incident_type: IncidentType) -> IncidentResponse:
        """
        Creates and stores a pre-defined simulated infrastructure incident with rich metadata.
        """
        template = INCIDENT_TEMPLATES[incident_type]
        incident_id = self._generate_id()
        now = datetime.now(timezone.utc)

        record = {
            "id": incident_id,
            "service": template["service"],
            "status": "active",
            "severity": template["severity"],
            "message": template["message"],
            "timestamp": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "ai_analysis": None,
            # Enriched fields
            "incident_type": template["incident_type"],
            "environment": template["environment"],
            "affected_users": template["affected_users"],
            "business_impact": template["business_impact"],
            "detection_source": template["detection_source"],
            "namespace": template["namespace"],
            "pod_name": template["pod_name"],
            "timeline": _build_timeline(now),
        }

        self._repo.add(incident_id, record)
        logger.info(f"Simulated incident created: {incident_id} | type={incident_type}")
        return IncidentResponse(**record)

    def get_all(self, status_filter: Optional[str] = None) -> List[IncidentResponse]:
        """Returns all incidents, optionally filtered by status, newest first."""
        incidents = self._repo.get_all()
        if status_filter:
            incidents = [i for i in incidents if i["status"] == status_filter]
        incidents = sorted(incidents, key=lambda i: i["timestamp"], reverse=True)
        return [IncidentResponse(**i) for i in incidents]

    def get_by_id(self, incident_id: str) -> Optional[IncidentResponse]:
        """Fetches a specific incident by its ID."""
        record = self._repo.get_by_id(incident_id)
        if not record:
            return None
        return IncidentResponse(**record)

    def update(self, incident_id: str, update_data: IncidentUpdate) -> Optional[IncidentResponse]:
        """Applies a partial update to an incident record."""
        patch = update_data.model_dump(exclude_none=True)
        record = self._repo.update(incident_id, patch)
        if not record:
            return None
        logger.info(f"Incident {incident_id} updated: {list(patch.keys())}")
        return IncidentResponse(**record)

    def resolve(self, incident_id: str) -> Optional[IncidentResponse]:
        """Marks an active incident as resolved."""
        return self.update(incident_id, IncidentUpdate(status="resolved"))

    def attach_ai_analysis(self, incident_id: str, analysis: Dict[str, Any]) -> Optional[IncidentResponse]:
        """Attaches AI Root Cause Analysis results to an existing incident record."""
        return self.update(incident_id, IncidentUpdate(ai_analysis=analysis))


from contextlib import contextmanager


@contextmanager
def incident_service_scope():
    """
    Provides a short-lived, Postgres-backed IncidentService for code that
    runs outside FastAPI's request scope - specifically the sandbox
    background thread (app/services/sandbox_service.py), which has no
    HTTP request to hang a `Depends(get_db)` off of.

    This mirrors what app/api/deps.py does for HTTP routes (build an
    IncidentService around a PostgresIncidentRepository bound to a fresh
    Session), but manages the Session's open/close lifecycle itself since
    there's no request lifecycle to do it for us.

    Usage:
        with incident_service_scope() as incident_service:
            incident_service.simulate(IncidentType.DB_EXHAUSTION)
    """
    from app.db.session import SessionLocal
    from app.repositories.postgres_incident_repository import PostgresIncidentRepository

    db = SessionLocal()
    try:
        yield IncidentService(repository=PostgresIncidentRepository(db))
    finally:
        db.close()
