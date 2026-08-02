# Runbook: Authentication Service Latency Spike (AuthServiceLatencyHigh)

## Target Services
* `auth-service`
* `redis-cache`
* `user-db`

## Description
This document provides instructions to diagnose and resolve high response latencies (exceeding 800ms) on auth-service endpoints, particularly during peak usage.

---

## Symptoms & Alerts
1. Prometheus alert `AuthLatencySpike` fires (average HTTP duration > 800ms).
2. Users report slow logins, browser timeouts, or "408 Request Timeout" pages.
3. System metrics indicate High CPU utilization (near 100%) on the `auth-service` pod/container.

---

## Probable Root Causes
1. **Inefficient Bcrypt Rounds**: High password hashing work factor (e.g. bcrypt log rounds > 14) running synchronously on the main thread, choking the single-threaded Node.js or async Python loop.
2. **Redis Cache Downtime**: The session caching database (`redis-cache`) is offline or slow, forcing the auth-service to query the SQL database on every token validation request.
3. **CPU Throttling**: Kubernetes CPU limits are too restrictive (e.g., `limits.cpu = 200m`), causing CPU throttling during active auth verification.

---

## Recovery & Mitigation Steps

### Step 1: Check Redis Connection Cache Status
Determine if Redis is online and responding. Run the check command:
```bash
redis-cli -h redis-cache-service ping
```
If it does not return `PONG`, check the redis service logs and restart the redis pod:
```bash
kubectl rollout restart deployment/redis-cache
```

### Step 2: Adjust Bcrypt Log Rounds Setting (Application Code)
Ensure the password hashing log rounds are configured via environment variables. For production, set log rounds to `10` or `12`. Avoid setting it to `14+` as it causes extreme CPU stress.
Update `.env` configuration file:
```env
AUTH_BCRYPT_ROUNDS=10
```

### Step 3: Increase Kubernetes CPU Limits (Infrastructure)
Edit the deployment manifest for `auth-service` and raise CPU limits to prevent throttling:
```yaml
resources:
  requests:
    cpu: "250m"
    memory: "256Mi"
  limits:
    cpu: "1000m"  # Raise limit from 500m to 1000m
    memory: "512Mi"
```
Apply the changes:
```bash
kubectl apply -f infrastructure/k8s/auth-deployment.yaml
```

### Step 4: Scale Replicas to Distribute Crypto Load
If CPU usage is due to authenticating a large number of concurrent users, scale up the `auth-service` deployment to distribute the cryptographic workload:
```bash
kubectl scale deployment/auth-service --replicas=4
```
