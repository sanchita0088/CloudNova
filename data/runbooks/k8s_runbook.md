# Runbook: Kubernetes Pod Failures & CrashLoopBackOff

## Target Scope
* All containerized microservices running on the Kubernetes Cluster.

## Description
This guide explains recovery steps when microservice containers fail to start, crash immediately, or transition into a `CrashLoopBackOff` status.

---

## Common Pod Failure States

### 1. CrashLoopBackOff
* **Meaning**: The container starts, crashes, restarts, and crashes again in a loop. Kubernetes applies an exponential backoff delay before restarting it.
* **Diagnostics**:
  ```bash
  kubectl logs <pod-name> --previous
  kubectl describe pod <pod-name>
  ```
* **Common Causes**:
  * Missing environment variables or configuration files.
  * DB connection failure during startup initialization.
  * File permission issues.

### 2. ImagePullBackOff / ErrImagePull
* **Meaning**: Kubernetes cannot pull the specified Docker image from the registry.
* **Diagnostics**: Look at the "Events" section at the bottom of the describe output:
  ```bash
  kubectl describe pod <pod-name>
  ```
* **Common Causes**:
  * Typos in the image tag (e.g. `latest` vs `v1.0.1`).
  * Registry authorization credentials missing (missing `imagePullSecrets`).

---

## Recovery Steps

### Step 1: Fix Startup Configuration Errors
If logs indicate a missing database connection configuration or config folder permission issue:
1. Verify the `ConfigMap` or `Secret` contains all key-values requested by the pod's environment specifications.
2. If environment variables are missing, patch the configmap:
   ```bash
   kubectl edit configmap/app-config
   ```
3. Restart the failed deployment:
   ```bash
   kubectl rollout restart deployment/<service-name>
   ```

### Step 2: Fix Liveness/Readiness Probe Configuration
Sometimes, pods crash or get restarted because liveness probes fail because the startup delay is too short.
If `kubectl describe` shows: `Liveness probe failed: HTTP probe failed with statuscode 500`.
1. Modify the `initialDelaySeconds` in the deployment manifest to give the container more time to boot up (e.g., raise from 5s to 30s).
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30  # Increase this value
  periodSeconds: 10
```

### Step 3: Resolve Storage/Volume Mounting Conflicts
If a pod is in a `Pending` state with volume errors (e.g., `Multi-Attach error for volume`), it means the cloud storage volume is locked by a terminated node.
Force the deletion of the old terminated pod to release the volume mount lock:
```bash
kubectl delete pod <old-failed-pod> --grace-period=0 --force
```
