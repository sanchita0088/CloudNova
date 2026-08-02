import os
import glob
import logging
from langchain_core.documents import Document
from app.services.rag_service import rag_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def ingest_runbooks(runbooks_dir: str = None) -> int:
    """
    Scans the runbooks directory, loads all Markdown files, 
    and inserts them into the ChromaDB vector store.
    """
    candidates = []
    if runbooks_dir:
        candidates.append(runbooks_dir)
    
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    repo_root = os.path.dirname(backend_dir)
    
    candidates.extend([
        os.path.join(repo_root, "data", "runbooks"),
        os.path.join(backend_dir, "data", "runbooks"),
        os.path.join(backend_dir, "app", "data", "runbooks"),
        "/app/data/runbooks",
        "/data/runbooks"
    ])

    valid_dir = None
    markdown_files = []
    for cand in candidates:
        if os.path.exists(cand):
            files = glob.glob(os.path.join(cand, "*.md"))
            if files:
                valid_dir = cand
                markdown_files = files
                break

    documents = []
    if valid_dir and markdown_files:
        logger.info(f"Scanning for runbooks in: {valid_dir}")
        for filepath in markdown_files:
            filename = os.path.basename(filepath)
            logger.info(f"Reading runbook: {filename}")
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                doc = Document(
                    page_content=content,
                    metadata={"source": filename, "path": filepath, "type": "runbook"}
                )
                documents.append(doc)
            except Exception as e:
                logger.error(f"Error reading file {filename}: {e}")
    else:
        logger.info("Using embedded default runbooks for indexing...")
        fallback_runbooks = {
            "auth_runbook.md": "# Runbook: Authentication Service Latency Spike (AuthServiceLatencyHigh)\n\n## Target Services\n* `auth-service`\n* `redis-cache`\n* `user-db`\n\n## Description\nThis document provides instructions to diagnose and resolve high response latencies (exceeding 800ms) on auth-service endpoints.\n\n## Symptoms & Alerts\n1. Prometheus alert `AuthLatencySpike` fires (average HTTP duration > 800ms).\n2. Users report slow logins, browser timeouts.\n3. System metrics indicate High CPU utilization (near 100%) on the `auth-service` pod.\n\n## Recovery & Mitigation Steps\nStep 1: Check Redis Connection Cache Status `redis-cli -h redis-cache-service ping`\nStep 2: Adjust Bcrypt Log Rounds Setting (`AUTH_BCRYPT_ROUNDS=10`)\nStep 3: Increase Kubernetes CPU Limits (`limits.cpu: 1000m`)\nStep 4: Scale Replicas `kubectl scale deployment/auth-service --replicas=4`\n",
            "db_runbook.md": "# Runbook: Database Connection Pool Exhaustion (MaxConnectionsError)\n\n## Target Services\n* `payment-gateway`\n* `order-service`\n* `user-db` (PostgreSQL / MySQL)\n\n## Description\nThis runbook guides Cloud and DevOps engineers through diagnosing and recovering from database connection pool exhaustion alerts.\n\n## Symptoms & Alerts\n1. Prometheus alert `DatabaseConnectionPoolExhausted` is triggered.\n2. `payment-gateway` logs indicate: `sqlalchemy.exc.TimeoutError: QueuePool limit of size 10 overflow 10 reached`.\n3. Client responses fail with HTTP 504 Gateway Timeout.\n\n## Recovery & Mitigation Steps\nStep 1: Query Diagnostics `SELECT pid, state, query FROM pg_stat_activity WHERE state != 'idle'`\nStep 2: Terminate Idle Leaked Connections `SELECT pg_terminate_backend(pid) FROM pg_stat_activity`\nStep 3: Increase Connection Pool Settings `pool_size=30`, `max_overflow=20`\nStep 4: Scale DB Replica `kubectl scale deployment/payment-gateway-db --replicas=3`\n",
            "k8s_runbook.md": "# Runbook: Kubernetes Pod Failures & CrashLoopBackOff\n\n## Target Scope\n* All containerized microservices running on the Kubernetes Cluster.\n\n## Description\nThis guide explains recovery steps when microservice containers fail to start or transition into `CrashLoopBackOff` status.\n\n## Common Pod Failure States\n1. CrashLoopBackOff: `kubectl logs <pod-name> --previous`\n2. ImagePullBackOff: `kubectl describe pod <pod-name>`\n\n## Recovery Steps\nStep 1: Fix Startup Configuration Errors (`kubectl edit configmap/app-config`, `kubectl rollout restart`)\nStep 2: Fix Liveness/Readiness Probe Configuration (`initialDelaySeconds: 30`)\nStep 3: Resolve Storage/Volume Mounting Conflicts (`kubectl delete pod <old-failed-pod> --force`)\n",
            "sandbox_runbook.md": "# Runbook: Cloud Sandbox Infrastructure Troubleshooting\n\nThis runbook covers diagnostics, root cause indicators, and recovery procedures for simulated failure modes in the sandbox environment.\n\n## 1. Database Connection Pool Exhaustion (db_exhaustion)\n* Affected Service: `postgresql-db` (primary), `payment-service` (consumer)\n* Recovery: Clear connections `pg_terminate_backend`, increase pool limits `DB_POOL_SIZE=30`, restart consumer `kubectl rollout restart deployment/payment-service`\n\n## 2. Pod CrashLoopBackOff (k8s_crashloop)\n* Affected Service: `user-service` / `payment-service`\n* Recovery: Re-apply ConfigMap, rolling update `kubectl rollout restart deployment/<service-name>`\n\n## 3. High CPU Usage (high_cpu)\n* Affected Service: `auth-service`\n* Recovery: Scale deployment `kubectl scale deployment/auth-service --replicas=4`, lower bcrypt factor, restart deployment.\n\n## 4. Memory Leak (memory_leak)\n* Affected Service: `user-service`\n* Recovery: Trigger pod restart `kubectl rollout restart deployment/user-service`, fix buffer memory leak.\n\n## 5. Redis Cache Failure (redis_failure)\n* Affected Service: `redis-cache`\n* Recovery: Flush cache `redis-cli FLUSHALL`, set eviction policy `allkeys-lru`.\n\n## 6. API Timeout (api_timeout)\n* Affected Service: `payment-service`\n* Recovery: Enable circuit breaker, increase timeout limits, scale processing pods.\n\n## 7. Disk Capacity Full (disk_full)\n* Affected Service: `postgresql-db`\n* Recovery: Clean audit logs, `VACUUM FULL;`, increase volume storage allocation PVC.\n\n## 8. Network Latency (network_latency)\n* Affected Service: Kubernetes Cluster Node Communication\n* Recovery: Restart CoreDNS `kubectl rollout restart deployment/coredns -n kube-system`\n\n## 9. Kubernetes Node Failure (node_failure)\n* Affected Service: `k8s-cluster`\n* Recovery: Evict stale pods `kubectl drain <node-name> --force`, reboot node.\n\n## 10. Service Unavailable 503 (service_unavailable)\n* Affected Service: `nginx-ingress`\n* Recovery: Verify liveness probes, correct selector labels, scale deployment `kubectl scale deployment/<service-name> --replicas=3`\n"
        }
        for name, text in fallback_runbooks.items():
            documents.append(Document(
                page_content=text,
                metadata={"source": name, "path": f"/embedded/{name}", "type": "runbook"}
            ))

    if not documents:
        logger.warning("No documents loaded for ingestion.")
        return 0

    logger.info(f"Loaded {len(documents)} document(s). Sending to RAG Service for indexing...")
    try:
        inserted_ids = rag_service.ingest_documents(documents)
        logger.info(f"Ingestion successful! Added {len(inserted_ids)} chunks.")
        return len(inserted_ids)
    except Exception as e:
        logger.error(f"Failed to ingest documents: {e}")
        return 0


if __name__ == "__main__":
    import sys
    print("Starting manual runbook ingestion...")
    count = ingest_runbooks()
    print(f"Ingestion completed. Total chunks ingested: {count}")
    sys.exit(0 if count > 0 else 1)
