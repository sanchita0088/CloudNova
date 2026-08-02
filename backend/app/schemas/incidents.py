from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from enum import Enum


class IncidentType(str, Enum):
    DB_EXHAUSTION = "db_exhaustion"
    AUTH_LATENCY = "auth_latency"
    K8S_CRASHLOOP = "k8s_crashloop"
    HIGH_CPU = "high_cpu"
    REDIS_FAILURE = "redis_failure"
    MEMORY_LEAK = "memory_leak"
    API_TIMEOUT = "api_timeout"
    DISK_FULL = "disk_full"
    NETWORK_LATENCY = "network_latency"
    NODE_FAILURE = "node_failure"
    SERVICE_UNAVAILABLE = "service_unavailable"


class IncidentSimulateRequest(BaseModel):
    type: IncidentType = Field(
        ...,
        description="The type of infrastructure incident to simulate"
    )


class TimelineEvent(BaseModel):
    time: str = Field(..., description="Relative time label e.g. T+00:00")
    event: str = Field(..., description="Human-readable event description")
    icon: str = Field("dot", description="Icon hint: dot | alert | search | brain | check | resolve")


class IncidentBase(BaseModel):
    service: str = Field(..., description="The name of the affected microservice")
    status: str = Field("active", description="Active or resolved state")
    severity: str = Field("warning", description="Severity level: critical, warning, info")
    message: str = Field(..., description="The error exception log or diagnostic message")


class IncidentCreate(IncidentBase):
    pass


class IncidentUpdate(BaseModel):
    status: Optional[str] = None
    ai_analysis: Optional[Dict[str, Any]] = None


class IncidentResponse(IncidentBase):
    id: str = Field(..., description="Unique generated incident ID (e.g. INC-2026-001)")
    timestamp: str = Field(..., description="ISO 8601 formatted timestamp of the event")
    ai_analysis: Optional[Dict[str, Any]] = Field(None, description="AI-generated Root Cause Analysis results")

    # --- Enriched metadata fields ---
    incident_type: Optional[str] = Field(None, description="Enum key for the incident type")
    environment: str = Field("Production Kubernetes", description="Target environment")
    affected_users: Optional[int] = Field(None, description="Estimated number of end users impacted")
    business_impact: Optional[str] = Field(None, description="Human-readable business impact statement")
    detection_source: str = Field("Prometheus AlertManager", description="System that detected the alert")
    namespace: Optional[str] = Field("cloudshop-prod", description="Kubernetes namespace")
    pod_name: Optional[str] = Field(None, description="Affected pod name if applicable")
    timeline: Optional[List[Dict[str, str]]] = Field(
        None, description="Ordered sequence of incident lifecycle events"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": "INC-2026-001",
                "service": "payment-gateway",
                "status": "active",
                "severity": "critical",
                "message": "sqlalchemy.exc.TimeoutError: QueuePool limit of size 10 overflow 10 reached",
                "timestamp": "2026-07-21T12:00:00Z",
                "incident_type": "db_exhaustion",
                "environment": "Production Kubernetes",
                "affected_users": 1200,
                "business_impact": "Payment processing unavailable",
                "detection_source": "Prometheus AlertManager",
                "namespace": "cloudshop-prod",
                "pod_name": "payment-gateway-7f9d8c-xvk2p",
                "timeline": [],
                "ai_analysis": None
            }
        }
    }
