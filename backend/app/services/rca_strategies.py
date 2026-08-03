import json
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any

from app.schemas.incidents import IncidentResponse
from app.services.rag_service import rag_service
from app.services.prompts import RCA_PROMPT
from app.core.config import settings

logger = logging.getLogger(__name__)


class RCAStrategy(ABC):
    """
    Common interface for producing a Root Cause Analysis result for an
    incident. AIAnalysisService picks one implementation at startup
    (Ollama if reachable, mock otherwise) and delegates to it.

    Separating "how do we produce an RCA" from "which one do we use and
    when do we fall back" keeps the mock/real branching in one place
    (AIAnalysisService) instead of interleaved inside a single method.
    """

    @abstractmethod
    def generate(self, incident: IncidentResponse) -> Dict[str, Any]:
        """
        Returns a dict with keys: root_cause, confidence_score,
        recovery_steps, incident_report (and may include extra keys,
        e.g. rag_evidence).
        """
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Per-type mock RCA payloads — realistic details per incident category
# ---------------------------------------------------------------------------
_MOCK_RCA: Dict[str, Dict[str, Any]] = {
    "db_exhaustion": {
        "root_cause": (
            "The PostgreSQL connection pool on payment-gateway is fully saturated. "
            "All 20 slots (pool_size=10 + max_overflow=10) are occupied due to a spike in "
            "concurrent checkout requests combined with slow query performance on the "
            "orders table (missing index on customer_id). "
            "New connection requests time out after 30s, causing cascading 500 errors."
        ),
        "confidence_score": 0.94,
        "rag_evidence": [
            {"source": "db_runbook.md", "section": "§3 — Connection Pool Tuning"},
            {"source": "Previous Incident INC-2025-145", "section": "Root Cause: pool_size too low"},
            {"source": "PostgreSQL Best Practices", "section": "§7 — max_connections sizing"},
        ],
        "recovery_steps": [
            {"title": "Inspect pod logs", "command": "kubectl logs -l app=payment-gateway -n cloudshop-prod --tail=100"},
            {"title": "Check active DB connections", "command": "kubectl exec -it $(kubectl get pod -l app=payment-gateway -o name | head -1) -- python -c \"from app.db import engine; print(engine.pool.status())\""},
            {"title": "Scale payment-gateway replicas", "command": "kubectl scale deployment payment-gateway --replicas=5 -n cloudshop-prod"},
            {"title": "Patch pool_size via ConfigMap", "command": "kubectl edit configmap payment-gateway-config -n cloudshop-prod  # Set DB_POOL_SIZE=30"},
            {"title": "Verify service health", "command": "kubectl rollout status deployment/payment-gateway -n cloudshop-prod"},
        ],
    },
    "auth_latency": {
        "root_cause": (
            "The auth-service is blocking its async event loop during bcrypt password verification. "
            "bcrypt work factor is set to 14 rounds (cost factor ~3s/hash), causing each verification "
            "to hold the thread. Combined with a Redis cache MISS rate of 78%, most requests "
            "are hitting bcrypt directly rather than returning cached tokens."
        ),
        "confidence_score": 0.88,
        "rag_evidence": [
            {"source": "auth_runbook.md", "section": "§2 — bcrypt Cost Factor Reduction"},
            {"source": "auth_runbook.md", "section": "§4 — Redis Session Cache Recovery"},
            {"source": "Previous Incident INC-2025-112", "section": "Root Cause: bcrypt rounds=14"},
        ],
        "recovery_steps": [
            {"title": "Check auth-service latency metrics", "command": "kubectl top pods -l app=auth-service -n cloudshop-prod"},
            {"title": "Inspect auth-service logs", "command": "kubectl logs -l app=auth-service -n cloudshop-prod --tail=50"},
            {"title": "Restart Redis cache pod", "command": "kubectl rollout restart deployment/redis-cache -n cloudshop-prod"},
            {"title": "Reduce bcrypt rounds via env var", "command": "kubectl set env deployment/auth-service BCRYPT_ROUNDS=10 -n cloudshop-prod"},
            {"title": "Scale auth-service horizontally", "command": "kubectl scale deployment auth-service --replicas=4 -n cloudshop-prod"},
        ],
    },
    "k8s_crashloop": {
        "root_cause": (
            "The order-service pod is crashing immediately on startup because the required "
            "ConfigMap 'order-service-config' was not mounted correctly. "
            "The file '/app/config/settings.yml' does not exist inside the container — "
            "it references a volume mount that was removed during the last Helm chart upgrade."
        ),
        "confidence_score": 0.91,
        "rag_evidence": [
            {"source": "k8s_runbook.md", "section": "§1 — CrashLoopBackOff Diagnosis"},
            {"source": "k8s_runbook.md", "section": "§3 — ConfigMap Volume Mount Recovery"},
            {"source": "Kubernetes Best Practices", "section": "§5 — Liveness Probe Configuration"},
        ],
        "recovery_steps": [
            {"title": "Describe the crashing pod", "command": "kubectl describe pod order-service-7d4b9c8f6-xvk2p -n cloudshop-prod"},
            {"title": "Check recent events", "command": "kubectl get events -n cloudshop-prod --sort-by=.lastTimestamp | tail -20"},
            {"title": "Re-apply the missing ConfigMap", "command": "kubectl apply -f k8s/configmaps/order-service-config.yaml -n cloudshop-prod"},
            {"title": "Restart the deployment", "command": "kubectl rollout restart deployment/order-service -n cloudshop-prod"},
            {"title": "Monitor pod recovery", "command": "kubectl get pods -l app=order-service -n cloudshop-prod -w"},
        ],
    },
    "high_cpu": {
        "root_cause": (
            "A runaway image-processing background job (job-82931) is monopolising all available "
            "vCPU cores on cloudshop-node-02 due to an uncapped goroutine pool. "
            "The job was triggered by a bulk product upload of 50,000 images with no concurrency limit, "
            "consuming 98.4% CPU and blocking all other scheduled jobs in the queue."
        ),
        "confidence_score": 0.86,
        "rag_evidence": [
            {"source": "k8s_runbook.md", "section": "§6 — CPU Throttling & Resource Limits"},
            {"source": "Previous Incident INC-2025-089", "section": "Root Cause: uncapped worker pool"},
            {"source": "Kubernetes Best Practices", "section": "§4 — Resource Requests and Limits"},
        ],
        "recovery_steps": [
            {"title": "Identify top CPU-consuming pods", "command": "kubectl top pods -n cloudshop-prod --sort-by=cpu"},
            {"title": "Kill the runaway job", "command": "kubectl delete job image-processor-job-82931 -n cloudshop-prod"},
            {"title": "Set CPU resource limits", "command": "kubectl set resources deployment/worker-service --limits=cpu=2000m,memory=2Gi -n cloudshop-prod"},
            {"title": "Restart worker-service", "command": "kubectl rollout restart deployment/worker-service -n cloudshop-prod"},
            {"title": "Verify node CPU recovery", "command": "kubectl top nodes"},
        ],
    },
    "redis_failure": {
        "root_cause": (
            "The Redis master pod ran out of memory (maxmemory: 8GB reached) and with "
            "eviction policy set to 'noeviction', all new write operations are being rejected. "
            "This is causing the session-service circuit breaker to open, dropping all session "
            "persistence and cart data for active users."
        ),
        "confidence_score": 0.89,
        "rag_evidence": [
            {"source": "auth_runbook.md", "section": "§4 — Redis Cache Recovery Steps"},
            {"source": "Previous Incident INC-2025-203", "section": "Root Cause: maxmemory noeviction"},
            {"source": "Redis Best Practices", "section": "§2 — Memory Eviction Policies"},
        ],
        "recovery_steps": [
            {"title": "Check Redis memory usage", "command": "kubectl exec -it redis-master-0 -n cloudshop-prod -- redis-cli info memory"},
            {"title": "Flush Redis cache keys", "command": "kubectl exec -it redis-master-0 -n cloudshop-prod -- redis-cli FLUSHALL"},
            {"title": "Change eviction policy to LRU", "command": "kubectl exec -it redis-master-0 -n cloudshop-prod -- redis-cli config set maxmemory-policy allkeys-lru"},
            {"title": "Verify Redis connectivity", "command": "kubectl exec -it redis-master-0 -n cloudshop-prod -- redis-cli ping"},
        ],
    },
    "memory_leak": {
        "root_cause": (
            "A critical memory leak in the user profile retrieval route of user-service. "
            "Unclosed request body streams are filling up the heap. "
            "The memory usage grew from 40% to 99% until the container was terminated by the "
            "Linux kernel Out-Of-Memory (OOM) killer."
        ),
        "confidence_score": 0.92,
        "rag_evidence": [
            {"source": "sandbox_runbook.md", "section": "§4 — Memory Leak"},
            {"source": "Previous Incident INC-2026-004", "section": "OOM-killer trigger on user-service"},
        ],
        "recovery_steps": [
            {"title": "Describe user-service pod", "command": "kubectl describe pod -l app=user-service -n cloudshop-prod"},
            {"title": "Restart user-service pod", "command": "kubectl rollout restart deployment/user-service -n cloudshop-prod"},
            {"title": "Validate heap allocation limits", "command": "kubectl set env deployment/user-service NODE_OPTIONS=\"--max-old-space-size=1536\""},
            {"title": "Monitor memory levels", "command": "kubectl top pods -l app=user-service"},
        ],
    },
    "api_timeout": {
        "root_cause": (
            "Upstream integration timeout. The payment-service checkout endpoint blocks "
            "awaiting responses from the Stripe external sandbox API. "
            "The external endpoint average response time exceeded the 15-second socket timeout limit, "
            "causing 504 Gateway Timeouts at the Nginx Ingress proxy layer."
        ),
        "confidence_score": 0.85,
        "rag_evidence": [
            {"source": "sandbox_runbook.md", "section": "§6 — API Timeout"},
            {"source": "Stripe Integration API Docs", "section": "Timeout handling and retry limits"},
        ],
        "recovery_steps": [
            {"title": "Inspect payment-service outgoing requests", "command": "kubectl logs -l app=payment-service -n cloudshop-prod --tail=200 | grep -i timeout"},
            {"title": "Scale payment-service pods to handle request backlog", "command": "kubectl scale deployment/payment-service --replicas=3 -n cloudshop-prod"},
            {"title": "Set circuit breaker policy to fail fast", "command": "kubectl set env deployment/payment-service ENABLE_CIRCUIT_BREAKER=true"},
            {"title": "Verify service metrics", "command": "kubectl rollout status deployment/payment-service"},
        ],
    },
    "disk_full": {
        "root_cause": (
            "PostgreSQL database persistent storage partition is 100% full. "
            "Un-rotated audit logs and accumulated transaction write-ahead logs (pg_wal) "
            "exhausted the 50GB persistent volume. The database is in read-only lock state "
            "and rejects all write operations."
        ),
        "confidence_score": 0.95,
        "rag_evidence": [
            {"source": "sandbox_runbook.md", "section": "§7 — Disk Capacity Full"},
            {"source": "Postgres Storage Admin Guide", "section": "WAL log recycling configuration"},
        ],
        "recovery_steps": [
            {"title": "Verify database disk utilization", "command": "kubectl exec -it postgres-db-0 -n cloudshop-prod -- df -h /var/lib/postgresql/data"},
            {"title": "Clean temporary tables and logs", "command": "kubectl exec -it postgres-db-0 -n cloudshop-prod -- vacuumdb -a -z -v"},
            {"title": "Extend persistent volume claim size", "command": "kubectl patch pvc postgres-pvc -p '{\"spec\":{\"resources\":{\"requests\":{\"storage\":\"100Gi\"}}}}'"},
            {"title": "Restart database pod", "command": "kubectl delete pod postgres-db-0 -n cloudshop-prod"},
        ],
    },
    "network_latency": {
        "root_cause": (
            "Severe inter-pod packet loss and network routing degradation. "
            "A CoreDNS deployment failure on the cluster network causes DNS queries "
            "from user-service to auth-service to time out, inducing cascading delays "
            "and average RTT packet delivery latencies of 1520ms."
        ),
        "confidence_score": 0.87,
        "rag_evidence": [
            {"source": "sandbox_runbook.md", "section": "§8 — Network Latency"},
            {"source": "CoreDNS Runbook", "section": "Fix DNS timeout spikes"},
        ],
        "recovery_steps": [
            {"title": "Run network diagnostic test", "command": "kubectl exec -it $(kubectl get pod -l app=user-service -o name | head -1) -- ping -c 10 auth-service"},
            {"title": "Perform rolling restart of coredns system services", "command": "kubectl rollout restart deployment/coredns -n kube-system"},
            {"title": "Restart user-service and payment-service", "command": "kubectl rollout restart deployment/user-service deployment/payment-service -n cloudshop-prod"},
        ],
    },
    "node_failure": {
        "root_cause": (
            "Kubernetes physical/virtual host node cloudshop-node-03 crashed. "
            "Underlying hypervisor hardware fault caused the node to become NotReady. "
            "Active pods running on node-03 were evicted, but due to capacity constraints, "
            "rescheduled replicas are stuck in Pending state on remaining nodes."
        ),
        "confidence_score": 0.94,
        "rag_evidence": [
            {"source": "sandbox_runbook.md", "section": "§9 — Kubernetes Node Failure"},
            {"source": "Kubernetes Administration SOPs", "section": "Handling NotReady node pools"},
        ],
        "recovery_steps": [
            {"title": "List node statuses in cluster", "command": "kubectl get nodes"},
            {"title": "Evict all stuck pods on failed node", "command": "kubectl drain cloudshop-node-03 --ignore-daemonsets --force"},
            {"title": "Trigger cloud cluster node pool scale-up", "command": "aws autoscaling start-instance-refresh --auto-scaling-group-name cloudshop-k8s-asg"},
            {"title": "Verify rescheduling state", "command": "kubectl get pods -A -o wide | grep -i pending"},
        ],
    },
    "service_unavailable": {
        "root_cause": (
            "Nginx Ingress controller receives HTTP 503 from payment-service upstream. "
            "A configuration error in the Kubernetes Service labels mismatch the pod selectors, "
            "leaving the payment-service endpoint list empty. "
            "Ingress has zero active downstream backends registered to route requests to."
        ),
        "confidence_score": 0.96,
        "rag_evidence": [
            {"source": "sandbox_runbook.md", "section": "§10 — Service Unavailable 503"},
            {"source": "Kubernetes Ingress Troubleshooting Guide", "section": "Selector labels resolution"},
        ],
        "recovery_steps": [
            {"title": "Inspect endpoints for service", "command": "kubectl get endpoints payment-service -n cloudshop-prod"},
            {"title": "Verify service selector labels", "command": "kubectl describe svc payment-service -n cloudshop-prod"},
            {"title": "Correct target labels and rolling restart nginx-ingress", "command": "kubectl rollout restart deployment/nginx-ingress-controller -n ingress-nginx"},
        ],
    },
}


def _build_incident_report(incident: IncidentResponse) -> str:
    """Shared markdown post-mortem template used by the mock strategy."""
    return f"""## Incident Post-Mortem Report

**Incident ID**: {incident.id}
**Service Affected**: {incident.service}
**Environment**: {incident.environment}
**Severity**: {incident.severity}
**Timestamp**: {incident.timestamp}
**Affected Users**: {incident.affected_users or 'N/A'}
**Business Impact**: {incident.business_impact or 'Under investigation'}

## Summary
An automated alert was triggered by the `{incident.service}` service. The system detected a critical operational anomaly requiring immediate investigation.

## Timeline
- **{incident.timestamp}**: Alert triggered by monitoring system.
- **+2 min**: CloudOps AI RCA analysis initiated.
- **+5 min**: Recovery steps recommended and dispatched to on-call engineer.

## Root Cause
Resource exhaustion or misconfiguration at the `{incident.service}` layer. Full AI-generated root cause requires a valid Gemini API key.

## Impact
Service degradation affecting downstream consumers of `{incident.service}`.

## Recovery Actions
1. Restart affected service pods.
2. Verify environment configuration and secrets.
3. Scale deployment if resource-constrained.

## Prevention
- Add automated alerts for early resource threshold warnings.
- Review and update runbooks for this failure pattern.
- Implement circuit breakers to prevent cascading failures.
"""


class MockRCAStrategy(RCAStrategy):
    """
    Returns a rich, incident-type-specific canned RCA result for demo
    purposes. This is the default/fallback strategy whenever a real LLM
    isn't reachable.
    """

    def generate(self, incident: IncidentResponse) -> Dict[str, Any]:
        itype = incident.incident_type or "db_exhaustion"
        rca = _MOCK_RCA.get(itype, _MOCK_RCA["db_exhaustion"])

        return {
            "root_cause": rca["root_cause"],
            "confidence_score": rca["confidence_score"],
            "rag_evidence": rca["rag_evidence"],
            "recovery_steps": rca["recovery_steps"],
            "incident_report": _build_incident_report(incident),
        }


class GeminiRCAStrategy(RCAStrategy):
    """
    Produces an RCA by retrieving RAG context from ChromaDB and invoking
    Google Gemini (gemini-3.6-flash) via the google-generativeai SDK.
    Raises on any failure so the caller (AIAnalysisService) can fall back
    to the next strategy in the chain.
    """
    MODEL_NAME = "gemini-3.6-flash"

    def __init__(self):
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)
        # Note: Google periodically deprecates model names. If a 404 "no longer available" error appears in logs, check current model list at https://ai.google.dev/gemini-api/docs before assuming it's a bug in this codebase.
        self._model = genai.GenerativeModel(
            model_name=self.MODEL_NAME,
            generation_config=genai.types.GenerationConfig(
                temperature=0.2,
                response_mime_type="application/json",
            ),
        )

    # -- shared helper: identical to OllamaRCAStrategy._format_rag_context ---
    def _format_rag_context(self, incident: IncidentResponse) -> str:
        """
        Refined, token-optimized RAG retrieval for Gemini:
        1. Extracts precise service & error keywords.
        2. Retrieves only the single top-1 (k=1) relevant runbook chunk to minimize token overhead.
        3. Truncates context excerpt to 400 chars.
        """
        error_snippet = incident.message.split('\n')[0][:120] if incident.message else ""
        query = f"{incident.service} {error_snippet}".strip()
        try:
            docs = rag_service.search(query, k=1)
            if not docs:
                return "No relevant runbook context found."

            doc = docs[0]
            source = doc.metadata.get("source", "runbook")
            content_snippet = doc.page_content[:400] + ("..." if len(doc.page_content) > 400 else "")
            return f"### Runbook Excerpt (source: {source})\n{content_snippet}"
        except Exception as e:
            logger.error(f"Token-optimized RAG context retrieval failed: {e}")
            return "Runbook context unavailable."


    def generate(self, incident: IncidentResponse) -> Dict[str, Any]:
        from app.services.prompts import RCA_SYSTEM_PROMPT, RCA_HUMAN_PROMPT

        rag_context = self._format_rag_context(incident)
        logger.info(f"Gemini: RAG context retrieved ({len(rag_context)} chars)")

        # Build the human prompt using the same template variables as Ollama
        human_text = RCA_HUMAN_PROMPT.format(
            incident_id=incident.id,
            service=incident.service,
            severity=incident.severity,
            timestamp=incident.timestamp,
            message=incident.message,
            rag_context=rag_context,
        )

        # Combine system + human into a single prompt for Gemini.
        # RCA_SYSTEM_PROMPT uses LangChain-style {{ / }} to escape literal
        # braces; undo that here since we're not going through LangChain.
        system_text = RCA_SYSTEM_PROMPT.replace("{{", "{").replace("}}", "}")
        full_prompt = f"{system_text}\n\n{human_text}"

        response = self._model.generate_content(full_prompt)
        raw_text = response.text.strip()
        logger.info(f"Gemini: LLM raw response length: {len(raw_text)} chars")

        # Strip any accidental markdown code fences
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:].strip()

        result = json.loads(raw_text)

        # Validate required keys; fill gaps from mock rather than failing
        required_keys = {"root_cause", "confidence_score", "recovery_steps", "incident_report"}
        missing = required_keys - result.keys()
        if missing:
            logger.warning(f"Gemini response missing keys: {missing}. Merging with mock.")
            mock = MockRCAStrategy().generate(incident)
            for key in missing:
                result[key] = mock[key]

        return result


class OllamaRCAStrategy(RCAStrategy):
    """
    Produces an RCA by retrieving RAG context from ChromaDB and invoking
    a local Ollama LLM via LangChain. Raises on any failure (connection,
    JSON parsing, missing keys) so the caller (AIAnalysisService) can
    decide how to fall back — this strategy itself doesn't know about
    the mock fallback.
    """

    def __init__(self):
        from langchain_community.chat_models import ChatOllama
        self._llm = ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            temperature=0.2,
            timeout=settings.LLM_TIMEOUT_SECONDS,
        )

    def _format_rag_context(self, incident: IncidentResponse) -> str:
        """
        Refined, token-optimized RAG retrieval:
        1. Extracts precise service & error keywords.
        2. Retrieves only the single top-1 (k=1) relevant runbook chunk to minimize token overhead.
        3. Truncates context excerpt to 400 chars.
        """
        error_snippet = incident.message.split('\n')[0][:120] if incident.message else ""
        query = f"{incident.service} {error_snippet}".strip()
        try:
            docs = rag_service.search(query, k=1)
            if not docs:
                return "No relevant runbook context found."

            doc = docs[0]
            source = doc.metadata.get("source", "runbook")
            content_snippet = doc.page_content[:400] + ("..." if len(doc.page_content) > 400 else "")
            return f"### Runbook Excerpt (source: {source})\n{content_snippet}"
        except Exception as e:
            logger.error(f"Token-optimized RAG context retrieval failed: {e}")
            return "Runbook context unavailable."


    def generate(self, incident: IncidentResponse) -> Dict[str, Any]:
        rag_context = self._format_rag_context(incident)
        logger.info(f"RAG context retrieved ({len(rag_context)} chars)")

        chain = RCA_PROMPT | self._llm
        response = chain.invoke({
            "incident_id": incident.id,
            "service": incident.service,
            "severity": incident.severity,
            "timestamp": incident.timestamp,
            "message": incident.message,
            "rag_context": rag_context,
        })

        raw_text = response.content.strip()
        logger.info(f"LLM raw response length: {len(raw_text)} chars")

        # Strip any accidental markdown code fences
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:].strip()

        result = json.loads(raw_text)

        # Validate required keys are present; fill any gaps from the mock
        # strategy rather than failing the whole request over a partial
        # LLM response.
        required_keys = {"root_cause", "confidence_score", "recovery_steps", "incident_report"}
        missing = required_keys - result.keys()
        if missing:
            logger.warning(f"LLM response missing keys: {missing}. Merging with mock.")
            mock = MockRCAStrategy().generate(incident)
            for key in missing:
                result[key] = mock[key]

        return result
