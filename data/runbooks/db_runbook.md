# Runbook: Database Connection Pool Exhaustion (MaxConnectionsError)

## Target Services
* `payment-gateway`
* `order-service`
* `user-db` (PostgreSQL / MySQL)

## Description
This runbook guides Cloud and DevOps engineers through diagnosing and recovering from database connection exhaustion alerts. The primary symptom is the service throwing `MaxConnectionsError` or `pool-exhausted` errors, leading to client 500 timeouts.

---

## Symptoms & Alerts
1. Prometheus alert `DatabaseConnectionPoolExhausted` is triggered.
2. `payment-gateway` logs indicate: `sqlalchemy.exc.TimeoutError: QueuePool limit of size 10 overflow 10 reached, connection timed out`.
3. Client responses fail with HTTP 504 Gateway Timeout or HTTP 500 Internal Server Error.

---

## Probable Root Causes
1. **Connection Leaks**: API route handlers are opening database connections but failing to close them (e.g., missing context managers or db session close blocks).
2. **Traffic Surge**: Sudden spike in API requests exceeding the connection pool capacity.
3. **Slow Queries**: Long-running queries keeping database connections occupied, preventing reuse.
4. **Underdimensioned Pool**: Default connection pool limits are set too low (e.g., default size is 5 or 10) for production loads.

---

## Recovery & Mitigation Steps

### Step 1: Query Diagnostics (Immediate)
Identify if the database is holding idle sessions or running slow queries. Run the following command on the SQL terminal:
```sql
SELECT pid, state, query, age(clock_timestamp(), query_start) 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY age DESC;
```
If there are many idle connections in transaction, it indicates connection leakage.

### Step 2: Terminate Idle Leaked Connections
If database performance is degraded due to blocked queries or leaked sessions, terminate them to free up the pool:
```sql
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle in transaction' AND age(clock_timestamp(), query_start) > interval '5 minutes';
```

### Step 3: Increase Connection Pool Settings (Hotfix)
In the application configuration settings, modify the Database Pool constraints.
For SQLAlchemy / FastAPI applications:
* Set `pool_size` to `30` (up from default 10).
* Set `max_overflow` to `20`.
* Set `pool_timeout` to `30`.

Example configuration patch:
```python
engine = create_engine(
    DATABASE_URL, 
    pool_size=30, 
    max_overflow=20, 
    pool_timeout=30
)
```

### Step 4: Scale DB Replica (If Load Spike)
If the pool exhaustion is due to legitimate traffic spikes, scale up the database instance or enable read replicas to offload read operations.
```bash
kubectl scale deployment/payment-gateway-db --replicas=3
```
