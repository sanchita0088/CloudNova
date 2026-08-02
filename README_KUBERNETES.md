# CloudOps AI — Kubernetes Deployment Guide (Phase 4)

Complete guide for deploying the CloudOps AI stack to a Kubernetes cluster.

---

## Prerequisites

| Tool | Minimum Version | Check |
|------|----------------|-------|
| kubectl | 1.28+ | `kubectl version --client` |
| Docker | 24+ | `docker version` |
| Kubernetes cluster | 1.28+ | `kubectl cluster-info` |
| nginx Ingress Controller | any | see below |
| metrics-server | any | see below (HPA) |

### Minikube Quick Setup (local development)

```bash
# Start cluster
minikube start --cpus=4 --memory=6144

# Enable required addons
minikube addons enable ingress        # nginx Ingress controller
minikube addons enable metrics-server # required for HPA

# Get the Minikube IP (use this instead of 127.0.0.1 in /etc/hosts)
minikube ip
```

### nginx Ingress Controller (non-Minikube clusters)

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml
```

---

## Step 1 — Build and Tag the Docker Images

> **IMPORTANT:** The frontend image **must** be rebuilt for Kubernetes because
> `VITE_API_URL` (baked into the JS bundle at build time) must point to the
> Ingress hostname, not `localhost:8000`.

### Build backend image

```bash
docker build -t cloudops-ai/backend:latest ./backend
```

### Build frontend image (Kubernetes-specific build arg)

```bash
docker build \
  --build-arg VITE_API_URL=http://cloudops.local/api/v1 \
  -t cloudops-ai/frontend:latest \
  ./frontend
```

### Load images into Minikube (skip if using a registry)

```bash
minikube image load cloudops-ai/backend:latest
minikube image load cloudops-ai/frontend:latest
```

### Push to a container registry (cloud clusters)

```bash
# Example with Docker Hub — replace with your registry
docker tag cloudops-ai/backend:latest  your-registry/cloudops-ai/backend:latest
docker tag cloudops-ai/frontend:latest your-registry/cloudops-ai/frontend:latest
docker push your-registry/cloudops-ai/backend:latest
docker push your-registry/cloudops-ai/frontend:latest

# Then update the image: field in k8s/backend/deployment.yaml
#   and k8s/frontend/deployment.yaml to match your registry path.
```

---

## Step 2 — Configure Local DNS

Add this line to your hosts file so the browser resolves `cloudops.local`:

**Windows:** `C:\Windows\System32\drivers\etc\hosts`
**Linux / macOS:** `/etc/hosts`

```
# Minikube — replace with the output of: minikube ip
192.168.49.2   cloudops.local

# Standard cluster / Docker Desktop Kubernetes
127.0.0.1      cloudops.local
```

---

## Step 3 — Deploy (in order)

Apply all manifests in the correct order. Each group waits for the
previous one to be healthy before proceeding.

```bash
# 1. Namespace (must be first)
kubectl apply -f k8s/namespace.yaml

# 2. PostgreSQL (Secret → PVC → Deployment → Service)
kubectl apply -f k8s/postgres/secret.yaml
kubectl apply -f k8s/postgres/pvc.yaml
kubectl apply -f k8s/postgres/deployment.yaml
kubectl apply -f k8s/postgres/service.yaml

# Wait for Postgres to be ready before applying backend
kubectl wait --for=condition=ready pod -l app=postgres -n cloudops-ai --timeout=120s

# 3. Backend (ConfigMap → PVC → Deployment → Service)
kubectl apply -f k8s/backend/configmap.yaml
kubectl apply -f k8s/backend/pvc.yaml
kubectl apply -f k8s/backend/deployment.yaml
kubectl apply -f k8s/backend/service.yaml

# Wait for backend (init container runs migrations automatically)
kubectl wait --for=condition=ready pod -l app=backend -n cloudops-ai --timeout=180s

# 4. Frontend
kubectl apply -f k8s/frontend/deployment.yaml
kubectl apply -f k8s/frontend/service.yaml

# 5. Ingress
kubectl apply -f k8s/ingress/ingress.yaml

# 6. HPA (requires metrics-server)
kubectl apply -f k8s/hpa/backend-hpa.yaml

# 7. Monitoring (optional — requires Prometheus Operator)
# kubectl apply -f k8s/monitoring/servicemonitor.yaml
```

### Apply everything at once (after first successful deployment)

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres/
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress/
kubectl apply -f k8s/hpa/
```

---

## Step 4 — Verify the Deployment

### Check pod status

```bash
kubectl get pods -n cloudops-ai
# Expected output:
# NAME                        READY   STATUS    RESTARTS
# postgres-xxxxx              1/1     Running   0
# backend-xxxxx               1/1     Running   0
# backend-yyyyy               1/1     Running   0
# frontend-xxxxx              1/1     Running   0
# frontend-yyyyy              1/1     Running   0
```

### Check services

```bash
kubectl get svc -n cloudops-ai
# NAME       TYPE        CLUSTER-IP   PORT(S)
# postgres   ClusterIP   10.x.x.x     5432/TCP
# backend    ClusterIP   10.x.x.x     8000/TCP
# frontend   ClusterIP   10.x.x.x     80/TCP
```

### Check Ingress

```bash
kubectl get ingress -n cloudops-ai
# NAME               CLASS   HOSTS            ADDRESS
# cloudops-ingress   nginx   cloudops.local   <ip>
```

### Check HPA

```bash
kubectl get hpa -n cloudops-ai
# NAME          REFERENCE             TARGETS   MINPODS   MAXPODS   REPLICAS
# backend-hpa   Deployment/backend   15%/70%   2         5         2
```

---

## Accessing the Application

| Service | URL |
|---------|-----|
| **Frontend** | http://cloudops.local |
| **API Docs (Swagger)** | http://cloudops.local/docs |
| **Health Check** | http://cloudops.local/health |
| **OpenAPI Spec** | http://cloudops.local/openapi.json |

---

## Viewing Logs

```bash
# All pods in namespace
kubectl logs -n cloudops-ai -l app=backend --all-containers=true

# A specific pod
kubectl logs -n cloudops-ai <pod-name>

# Follow live logs
kubectl logs -n cloudops-ai -l app=backend -f

# Init container logs (Alembic migrations)
kubectl logs -n cloudops-ai <backend-pod-name> -c migrate

# Previous container logs (after a crash)
kubectl logs -n cloudops-ai <pod-name> --previous
```

---

## Running Alembic Migrations Manually

Migrations run automatically via the init container on every backend pod
start.  To run them manually inside the cluster:

```bash
# Exec into a running backend pod
kubectl exec -it -n cloudops-ai deployment/backend -- alembic upgrade head

# Check current migration version
kubectl exec -it -n cloudops-ai deployment/backend -- alembic current

# Show migration history
kubectl exec -it -n cloudops-ai deployment/backend -- alembic history

# Generate a new revision after editing ORM models
kubectl exec -it -n cloudops-ai deployment/backend -- \
  alembic revision --autogenerate -m "describe_change"

# Rollback one migration
kubectl exec -it -n cloudops-ai deployment/backend -- alembic downgrade -1
```

---

## Rollout and Rollback

```bash
# Check rollout status
kubectl rollout status deployment/backend -n cloudops-ai

# Rollback to the previous version
kubectl rollout undo deployment/backend -n cloudops-ai
kubectl rollout undo deployment/frontend -n cloudops-ai

# View rollout history
kubectl rollout history deployment/backend -n cloudops-ai
```

---

## Scaling

```bash
# Manually scale backend (HPA will still override if metrics warrant)
kubectl scale deployment/backend -n cloudops-ai --replicas=3

# Manually scale frontend
kubectl scale deployment/frontend -n cloudops-ai --replicas=3

# Describe HPA to see current state and events
kubectl describe hpa backend-hpa -n cloudops-ai
```

---

## Updating Images

```bash
# After rebuilding an image and loading/pushing it:
kubectl set image deployment/backend  backend=cloudops-ai/backend:v2  -n cloudops-ai
kubectl set image deployment/frontend frontend=cloudops-ai/frontend:v2 -n cloudops-ai

# Monitor the rolling update
kubectl rollout status deployment/backend  -n cloudops-ai
kubectl rollout status deployment/frontend -n cloudops-ai
```

---

## Port-Forwarding (Bypass Ingress)

Useful for debugging without DNS setup:

```bash
# Access backend directly
kubectl port-forward -n cloudops-ai svc/backend 8000:8000
# → http://localhost:8000/docs

# Access frontend directly
kubectl port-forward -n cloudops-ai svc/frontend 3000:80
# → http://localhost:3000

# Access postgres directly
kubectl port-forward -n cloudops-ai svc/postgres 5432:5432
# → connect with psql -h localhost -U postgres -d cloudops
```

---

## Teardown

```bash
# Remove all application resources (keeps the namespace)
kubectl delete -f k8s/hpa/
kubectl delete -f k8s/ingress/
kubectl delete -f k8s/frontend/
kubectl delete -f k8s/backend/
kubectl delete -f k8s/postgres/

# Remove the namespace and ALL resources inside it
kubectl delete namespace cloudops-ai

# Stop Minikube
minikube stop
```

> **Warning:** Deleting the namespace also deletes the PVCs. The PostgreSQL
> data and ChromaDB embeddings are permanently lost. To preserve data,
> delete individual resources and keep the PVCs.

---

## Directory Structure

```
k8s/
├── namespace.yaml                # Namespace: cloudops-ai
├── postgres/
│   ├── secret.yaml               # Credentials + DATABASE_URL
│   ├── pvc.yaml                  # 5Gi persistent volume for /var/lib/postgresql/data
│   ├── deployment.yaml           # postgres:16-alpine, 1 replica, Recreate strategy
│   └── service.yaml              # ClusterIP on port 5432 (cluster-internal only)
├── backend/
│   ├── configmap.yaml            # Non-sensitive env vars (CORS, Ollama, Prometheus)
│   ├── pvc.yaml                  # 2Gi persistent volume for /app/chromadb_data
│   ├── deployment.yaml           # FastAPI, 2 replicas, init container for migrations
│   └── service.yaml              # ClusterIP on port 8000
├── frontend/
│   ├── deployment.yaml           # nginx, 2 replicas
│   └── service.yaml              # ClusterIP on port 80
├── ingress/
│   └── ingress.yaml              # nginx Ingress: cloudops.local → frontend + backend
├── hpa/
│   └── backend-hpa.yaml          # HPA: 2–5 replicas at 70% CPU
└── monitoring/
    └── servicemonitor.yaml       # Optional: Prometheus Operator ServiceMonitor
```

---

## Configuration Reference

### Changing the Ingress hostname

1. Edit `k8s/ingress/ingress.yaml` → update `host: cloudops.local`
2. Edit `k8s/backend/configmap.yaml` → update `CORS_ORIGINS`
3. Rebuild the frontend image with the new `VITE_API_URL`:
   ```bash
   docker build --build-arg VITE_API_URL=http://your-domain.com/api/v1 \
     -t cloudops-ai/frontend:latest ./frontend
   ```
4. Re-apply the changed manifests.

### Adding a Gemini API key

Add the key to the existing Secret (no Secret recreate needed):

```bash
kubectl patch secret postgres-secret -n cloudops-ai \
  -p '{"stringData":{"GEMINI_API_KEY":"AIza...your-key..."}}'
```

Then restart the backend to pick up the new value:

```bash
kubectl rollout restart deployment/backend -n cloudops-ai
```

### Pointing Ollama / Prometheus to a cluster-internal service

If Ollama or Prometheus run inside the cluster, edit
`k8s/backend/configmap.yaml`:

```yaml
OLLAMA_BASE_URL: "http://ollama.default.svc.cluster.local:11434"
PROMETHEUS_URL:  "http://prometheus.monitoring.svc.cluster.local:9090"
```

Then apply the ConfigMap and restart the backend:

```bash
kubectl apply -f k8s/backend/configmap.yaml
kubectl rollout restart deployment/backend -n cloudops-ai
```
