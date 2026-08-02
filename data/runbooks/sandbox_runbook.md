# Runbook: Cloud Sandbox Infrastructure Troubleshooting

This runbook covers diagnostics, root cause indicators, and recovery procedures for simulated failure modes in the sandbox environment.

---

## 1. Database Connection Pool Exhaustion (db_exhaustion)
* **Affected Service**: `postgresql-db` (primary), `payment-service` (consumer)
* **Root Cause**: Runaway client queries or missing index combined with high traffic volume, exhausting the SQLAlchemy connection pool.
* **Diagnostics**:
  - Payment service reports: `sqlalchemy.exc.TimeoutError: QueuePool limit of size 10 overflow 10 reached`
  - Database status shows: `FATAL: remaining connection slots are reserved for non-replication superuser connections`
* **Recovery Actions**:
  - Clear connections: `kubectl exec -it <db-pod> -- pg_terminate_backend(pid)`
  - Increase connection pool limits via configuration map: `DB_POOL_SIZE=30` and `DB_MAX_OVERFLOW=20`
  - Restart the consumer deployment to release leaky connections: `kubectl rollout restart deployment/payment-service`

---

## 2. Pod CrashLoopBackOff (k8s_crashloop)
* **Affected Service**: `user-service` / `payment-service`
* **Root Cause**: Missing application ConfigMap or file permissions error during container boot-up.
* **Diagnostics**:
  - `kubectl describe pod <pod-name>` reports container exited with exit code 1.
  - Log snippet: `FileNotFoundError: [Errno 2] No such file or directory: '/app/config/settings.yml'`
* **Recovery Actions**:
  - Re-apply the application ConfigMap containing `settings.yml`.
  - Perform a rolling update to restart the pods: `kubectl rollout restart deployment/<service-name>`
  - Verify container status transitioned to `Running`.

---

## 3. High CPU Usage (high_cpu)
* **Affected Service**: `auth-service`
* **Root Cause**: Runaway bcrypt password hashing execution or un-optimized loop blocking event loop.
* **Diagnostics**:
  - Pod CPU utilization reaches 98-100%.
  - Event loop latency exceeds 2000ms.
* **Recovery Actions**:
  - Scale deployment replicas to distribute load: `kubectl scale deployment/auth-service --replicas=4`
  - Temporarily lower the bcrypt work factor in configuration settings.
  - Restart deployment to clear runaway threads.

---

## 4. Memory Leak (memory_leak)
* **Affected Service**: `user-service`
* **Root Cause**: Unclosed socket streams or connection buffer leak in the user profile cache layer.
* **Diagnostics**:
  - Memory consumption increases linearly over time.
  - `dmesg` reports: `Killed process: user-service (OOM-killer)`.
* **Recovery Actions**:
  - Trigger pod restart to immediately release memory: `kubectl rollout restart deployment/user-service`
  - Fix buffer management logic and release idle connection references.
  - Set container memory limit config to prevent node-level degradation.

---

## 5. Redis Cache Failure (redis_failure)
* **Affected Service**: `redis-cache` (primary), `auth-service` (consumer)
* **Root Cause**: Memory saturation under high load with eviction policy set to `noeviction`.
* **Diagnostics**:
  - Logs show: `redis.exceptions.ConnectionError: Connection refused`
  - CLI: `used_memory_rss` exceeds `maxmemory`.
* **Recovery Actions**:
  - Flush the Redis cache: `redis-cli FLUSHALL`
  - Change eviction policy: `redis-cli CONFIG SET maxmemory-policy allkeys-lru`
  - Restart consumer services.

---

## 6. API Timeout (api_timeout)
* **Affected Service**: `payment-service`
* **Root Cause**: Sluggish response times from third-party gateway providers (Stripe/Paypal sandbox) blocking the API thread.
* **Diagnostics**:
  - Ingress logs: `504 Gateway Timeout` on checkout endpoint.
  - Client response delays exceed 15000ms.
* **Recovery Actions**:
  - Enable circuit breaker (Hystrix or equivalent proxy rule) to fast-fail on timeout.
  - Increase retry timeout limits or scale payment processing pods to support parallel queues.

---

## 7. Disk Capacity Full (disk_full)
* **Affected Service**: `postgresql-db`
* **Root Cause**: Database transaction log segment buildup (`pg_wal` path) on un-rotated partitions.
* **Diagnostics**:
  - Log: `ERROR: could not write to file: No space left on device`
  - Queries fail to write or create temp tables.
* **Recovery Actions**:
  - Clean up database audit logs and historical trace files.
  - Run vacuum check: `VACUUM FULL;`
  - Increase volume storage allocation on the cloud persistent volume claim (PVC).

---

## 8. Network Latency (network_latency)
* **Affected Service**: Kubernetes Cluster Node Communication
* **Root Cause**: Cross-AZ routing issues or cloud provider network package drop.
* **Diagnostics**:
  - Latency spikes from 5ms to 1500ms.
  - `ping` tools report package loss rates above 10%.
* **Recovery Actions**:
  - Run rolling restart of the routing layer / CoreDNS: `kubectl rollout restart deployment/coredns -n kube-system`
  - Relocate pods to same AZ if node degradation persists.

---

## 9. Kubernetes Node Failure (node_failure)
* **Affected Service**: `k8s-cluster`
* **Root Cause**: Hypervisor hardware crash or kernel panic on virtual node.
* **Diagnostics**:
  - `kubectl get nodes` shows node in `NotReady` status.
  - Rescheduling alerts for multiple service pods.
* **Recovery Actions**:
  - Evict stale pods from the failed node: `kubectl drain <node-name> --ignore-daemonsets --force`
  - Re-provision or reboot the node instance in the cloud manager portal.

---

## 10. Service Unavailable 503 (service_unavailable)
* **Affected Service**: `nginx-ingress`
* **Root Cause**: Target service has no ready pod endpoints, or selector misconfiguration in Kubernetes Service manifest.
* **Diagnostics**:
  - Nginx logs: `503 Service Unavailable: no active endpoints for upstream`
* **Recovery Actions**:
  - Verify liveness probes are passing on backend pods.
  - Correct the selector labels in the Service configuration.
  - Scale deployment to ensure at least one healthy pod is registered: `kubectl scale deployment/<service-name> --replicas=3`
