import time
import random
import logging
import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from app.schemas.incidents import IncidentType
from app.services.incidents_service import incident_service_scope
from app.services.ai_service import ai_service

from app.core.config import settings

logger = logging.getLogger(__name__)

# Base base metrics for the 7 services when healthy
HEALTHY_METRICS = {
    "k8s-cluster": {"cpu": 15, "memory": 45, "disk": 22, "network": 8},
    "payment-service": {"cpu": 10, "memory": 35, "disk": 12, "network": 12},
    "auth-service": {"cpu": 8, "memory": 38, "disk": 10, "network": 15},
    "user-service": {"cpu": 12, "memory": 32, "disk": 14, "network": 6},
    "nginx-ingress": {"cpu": 5, "memory": 18, "disk": 8, "network": 4},
    "postgresql-db": {"cpu": 18, "memory": 52, "disk": 38, "network": 20},
    "redis-cache": {"cpu": 6, "memory": 22, "disk": 5, "network": 3},
}

class SandboxService:
    def __init__(self):
        # Reentrant: _update_sandbox_metrics() holds this lock and, in the demo
        # auto-recovery phase, calls trigger_recovery() which re-acquires it.
        # A plain Lock would self-deadlock the worker thread there.
        self.lock = threading.RLock()
        self.stop_event = threading.Event()
        self.thread = None
        self._pending_analysis: Optional[str] = None  # incident_id queued for out-of-lock LLM analysis
        self.reset_sandbox_state()
        self.start_background_worker()

    # ── DB helpers: keep simulation_active flag in system_settings ──────────
    @staticmethod
    def _db_set_simulation_active(active: bool) -> None:
        """Write simulation_active flag to shared DB so all replicas agree."""
        try:
            from app.db.session import SessionLocal
            from app.models.system_setting import SystemSetting
            val = "true" if active else "false"
            with SessionLocal() as session:
                setting = session.query(SystemSetting).filter_by(key="simulation_active").first()
                if setting:
                    setting.value = val
                else:
                    setting = SystemSetting(key="simulation_active", value=val)
                    session.add(setting)
                session.commit()
        except Exception as e:
            logger.error(f"Error writing simulation_active to DB: {e}")

    @staticmethod
    def _db_get_simulation_active() -> bool:
        """Read simulation_active flag from shared DB."""
        try:
            from app.db.session import SessionLocal
            from app.models.system_setting import SystemSetting
            with SessionLocal() as session:
                setting = session.query(SystemSetting).filter_by(key="simulation_active").first()
                if setting:
                    return setting.value == "true"
        except Exception as e:
            logger.error(f"Error reading simulation_active from DB: {e}")
        return False


    def reset_sandbox_state(self):
        with self.lock:
            self.services = {
                "k8s-cluster": {
                    "key": "k8s-cluster",
                    "name": "Kubernetes Cluster",
                    "status": "healthy",
                    "cpu": HEALTHY_METRICS["k8s-cluster"]["cpu"],
                    "memory": HEALTHY_METRICS["k8s-cluster"]["memory"],
                    "disk": HEALTHY_METRICS["k8s-cluster"]["disk"],
                    "network": HEALTHY_METRICS["k8s-cluster"]["network"],
                    "logs": ["Cluster bootstrap completed.", "All nodes reporting Ready status."]
                },
                "payment-service": {
                    "key": "payment-service",
                    "name": "payment-service",
                    "status": "healthy",
                    "cpu": HEALTHY_METRICS["payment-service"]["cpu"],
                    "memory": HEALTHY_METRICS["payment-service"]["memory"],
                    "disk": HEALTHY_METRICS["payment-service"]["disk"],
                    "network": HEALTHY_METRICS["payment-service"]["network"],
                    "logs": ["Service listener active on port 8080.", "Database connection verified."]
                },
                "auth-service": {
                    "key": "auth-service",
                    "name": "auth-service",
                    "status": "healthy",
                    "cpu": HEALTHY_METRICS["auth-service"]["cpu"],
                    "memory": HEALTHY_METRICS["auth-service"]["memory"],
                    "disk": HEALTHY_METRICS["auth-service"]["disk"],
                    "network": HEALTHY_METRICS["auth-service"]["network"],
                    "logs": ["Token controller running.", "Redis connectivity established."]
                },
                "user-service": {
                    "key": "user-service",
                    "name": "user-service",
                    "status": "healthy",
                    "cpu": HEALTHY_METRICS["user-service"]["cpu"],
                    "memory": HEALTHY_METRICS["user-service"]["memory"],
                    "disk": HEALTHY_METRICS["user-service"]["disk"],
                    "network": HEALTHY_METRICS["user-service"]["network"],
                    "logs": ["User metadata cache initialized.", "Serving user profile endpoints."]
                },
                "nginx-ingress": {
                    "key": "nginx-ingress",
                    "name": "nginx ingress",
                    "status": "healthy",
                    "cpu": HEALTHY_METRICS["nginx-ingress"]["cpu"],
                    "memory": HEALTHY_METRICS["nginx-ingress"]["memory"],
                    "disk": HEALTHY_METRICS["nginx-ingress"]["disk"],
                    "network": HEALTHY_METRICS["nginx-ingress"]["network"],
                    "logs": ["Ingress controller configuration reloaded.", "Upstream route mappings verified."]
                },
                "postgresql-db": {
                    "key": "postgresql-db",
                    "name": "PostgreSQL database",
                    "status": "healthy",
                    "cpu": HEALTHY_METRICS["postgresql-db"]["cpu"],
                    "memory": HEALTHY_METRICS["postgresql-db"]["memory"],
                    "disk": HEALTHY_METRICS["postgresql-db"]["disk"],
                    "network": HEALTHY_METRICS["postgresql-db"]["network"],
                    "logs": ["PostgreSQL database engine started.", "Listening on TCP port 5432.", "Connection pool slots: 100 max."]
                },
                "redis-cache": {
                    "key": "redis-cache",
                    "name": "Redis cache",
                    "status": "healthy",
                    "cpu": HEALTHY_METRICS["redis-cache"]["cpu"],
                    "memory": HEALTHY_METRICS["redis-cache"]["memory"],
                    "disk": HEALTHY_METRICS["redis-cache"]["disk"],
                    "network": HEALTHY_METRICS["redis-cache"]["network"],
                    "logs": ["Redis server v7.2 started.", "Running in memory-only eviction mode."]
                }
            }
            self.active_simulation: Optional[Dict[str, Any]] = None
            self.alerts: List[Dict[str, Any]] = []
            self.logs: List[str] = ["Sandbox environment started in Healthy mode."]
        # On reset, also clear the shared DB flag so other replicas agree.
        self._db_set_simulation_active(False)


    def get_state(self) -> Dict[str, Any]:
        from app.services.live_monitor import live_monitor_service
        from app.services.system_info import get_system_info
        from app.services.metrics_provider import metrics_factory

        current_mode = live_monitor_service.get_mode()
        sys_info = get_system_info()
        active_prov = metrics_factory.get_provider().provider_name

        if current_mode == "live":
            live_data = live_monitor_service.get_live_state()
            return {
                "mode": "live",
                "provider": live_data["provider"],
                "system_info": live_data["system_info"],
                "services": live_data["services"],
                "active_simulation": None,
                "alerts": live_data["alerts"],
                "logs": live_data["logs"]
            }

        with self.lock:
            # Use DB flag as source of truth so both replicas agree.
            # If the shared DB says no simulation is running, report None
            # even if this pod has stale in-memory state.
            sim_active_in_db = self._db_get_simulation_active()
            reported_simulation = self.active_simulation if sim_active_in_db else None
            if not sim_active_in_db and self.active_simulation is not None:
                # Stale local state — clear it so this pod catches up.
                self.active_simulation = None
                self._pending_analysis = None
                self.alerts = []
                for key, service in self.services.items():
                    service["status"] = "healthy"
                    base = HEALTHY_METRICS[key]
                    service["cpu"] = base["cpu"]
                    service["memory"] = base["memory"]
                    service["disk"] = base["disk"]
                    service["network"] = base["network"]
            return {
                "mode": "demo",
                "provider": active_prov,
                "system_info": sys_info,
                "services": list(self.services.values()),
                "active_simulation": reported_simulation,
                "alerts": self.alerts,
                "logs": self.logs[-40:]
            }


    def start_background_worker(self):
        self.stop_event.clear()
        self.thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.thread.start()
        logger.info("SandboxService background worker started.")

    def stop_background_worker(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=1.0)
        logger.info("SandboxService background worker stopped.")

    def simulate(self, incident_type: IncidentType, demo_mode: bool = False) -> Dict[str, Any]:
        with self.lock:
            # Ensure mode is set to 'demo' so simulation state and recovery pipeline execute cleanly
            from app.services.live_monitor import live_monitor_service
            live_monitor_service.set_mode("demo", caller_filename="sandbox_service.py", caller_function="simulate", reason="simulation_started")

            # Cancel any previously running simulation before starting a new one.
            self.active_simulation = None

            self._pending_analysis = None
            self.alerts = []

            # Setup new simulation state
            type_str = incident_type.value if hasattr(incident_type, "value") else str(incident_type)
            self.active_simulation = {
                "type": type_str,
                "demo_mode": demo_mode,
                "start_time": time.time(),
                "step": "healthy",
                "incident_id": None,
                "recovery_triggered": False,
                "recovery_start_time": None,
                "timeline": [
                    {"step": "healthy", "status": "completed", "time": "T+0s", "label": "Healthy Infrastructure"},
                    {"step": "metric_spike", "status": "pending", "time": "T+2s", "label": "Metric Spike"},
                    {"step": "alert_triggered", "status": "pending", "time": "T+4s", "label": "Alert Triggered"},
                    {"step": "incident_created", "status": "pending", "time": "T+6s", "label": "Incident Created"},
                    {"step": "rag_search", "status": "pending", "time": "T+8s", "label": "RAG Runbook Search"},
                    {"step": "gemini_analysis", "status": "pending", "time": "T+11s", "label": "Ollama AI Analysis"},
                    {"step": "recovery_recommendation", "status": "pending", "time": "T+14s", "label": "Recovery Recommendation"},
                    {"step": "incident_resolved", "status": "pending", "time": "Manual", "label": "Incident Resolved"}
                ]
            }
            msg = f"Started simulation of '{type_str}' (Demo Mode: {demo_mode})"
            self.logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] SYSTEM: {msg}")
            logger.info(msg)
            # Mark simulation active in shared DB so other replicas know.
            self._db_set_simulation_active(True)
            return self.active_simulation


    def stop_simulation(self) -> None:
        """Cancel and clear any active simulation and pending analysis.
        Called when switching to live mode to prevent demo state leaking.
        """
        with self.lock:
            if self.active_simulation:
                logger.info("Stopping active simulation due to mode switch.")
                self.active_simulation = None
                self._pending_analysis = None
                self.alerts = []
                for key, service in self.services.items():
                    service["status"] = "healthy"
                    base = HEALTHY_METRICS[key]
                    service["cpu"] = base["cpu"]
                    service["memory"] = base["memory"]
                    service["disk"] = base["disk"]
                    service["network"] = base["network"]
                self.logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] SYSTEM: Demo simulation cancelled. Switched to Live Monitoring mode.")
        # Always write DB flag even if local state was already None,
        # so the other replica also stops showing an active simulation.
        self._db_set_simulation_active(False)


    def trigger_recovery(self) -> Dict[str, Any]:
        with self.lock:
            if not self.active_simulation:
                return {"status": "error", "message": "No active simulation to recover from."}
            
            self.active_simulation["recovery_triggered"] = True
            self.active_simulation["recovery_start_time"] = time.time()
            self.active_simulation["step"] = "recovering"
            
            # Update affected services status to recovering
            for key, service in self.services.items():
                if service["status"] in ["degraded", "critical"]:
                    service["status"] = "recovering"
                    service["logs"].append(f"[{datetime.now().strftime('%H:%M:%S')}] RECOVERY: Initiating repair procedures...")

            msg = "Recovery sequence triggered by administrator."
            self.logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] SYSTEM: {msg}")
            logger.info(msg)
            return {"status": "success", "message": "Recovery started."}

    def _worker_loop(self):
        while not self.stop_event.is_set():
            try:
                self._update_sandbox_metrics()
                self._run_pending_analysis()
            except Exception as e:
                logger.error(f"Error in sandbox update: {e}")
            time.sleep(1.0)

    def _run_pending_analysis(self):
        """
        Runs the AI RCA pipeline for a queued incident WITHOUT holding self.lock.
        Phase 5 of the simulation only sets self._pending_analysis; the actual
        (potentially multi-second) LLM/RAG call happens here so it never blocks
        get_state(), simulate(), or trigger_recovery().
        """
        with self.lock:
            incident_id = self._pending_analysis
            self._pending_analysis = None
        if not incident_id:
            return

        with incident_service_scope() as incident_service:
            incident = incident_service.get_by_id(incident_id)
        if not incident:
            return

        now_str = datetime.now().strftime("%H:%M:%S")
        try:
            analysis_result = ai_service.analyze(incident)  # lock NOT held here, no DB session open here either
            with incident_service_scope() as incident_service:
                incident_service.attach_ai_analysis(incident.id, analysis_result)
            with self.lock:
                self.logs.append(f"[{now_str}] Ollama LLM: Root cause diagnosed. Recommendations loaded.")
        except Exception as ex:
            logger.error(f"Async LLM analysis failed: {ex}")
            with self.lock:
                self.logs.append(f"[{now_str}] Ollama LLM: [ERROR] Analysis pipeline failure, fallback to SOP diagnostics.")

    def _update_sandbox_metrics(self):
        from app.services.live_monitor import live_monitor_service
        with self.lock:
            now_str = datetime.now().strftime("%H:%M:%S")

            # Do not advance simulation steps when in live monitoring mode.
            if live_monitor_service.get_mode() == "live":
                return

            # 2. Advance active simulation steps — nothing to do if idle
            if not self.active_simulation:
                return

            # 1. Fluctuating metrics of healthy services — ONLY while a demo is running.
            # When no simulation is active the services stay static at HEALTHY_METRICS
            # so the dashboard looks idle until the user explicitly presses Start Demo Loop.
            for key, service in self.services.items():
                if service["status"] == "healthy":
                    base = HEALTHY_METRICS[key]
                    service["cpu"] = max(1, min(100, int(base["cpu"] + random.uniform(-2, 2))))
                    service["memory"] = max(1, min(100, int(base["memory"] + random.uniform(-1, 1))))
                    service["disk"] = max(1, min(100, int(base["disk"] + random.uniform(-0.1, 0.1))))
                    service["network"] = max(1, min(2000, int(base["network"] + random.uniform(-1, 1))))


            sim = self.active_simulation
            elapsed = time.time() - sim["start_time"]
            itype = sim["type"]

            # If recovering, handle linear metrics reduction to normal
            if sim["recovery_triggered"]:
                rec_elapsed = time.time() - sim["recovery_start_time"]
                if rec_elapsed >= 6.0:
                    # Recovery complete! Transition to resolved
                    sim["step"] = "resolved"
                    sim["recovery_triggered"] = False
                    
                    # Update timeline
                    for t_step in sim["timeline"]:
                        if t_step["step"] in ["recovery_recommendation", "incident_resolved"]:
                            t_step["status"] = "completed"
                    
                    # Resolve incident in incidents service
                    if sim["incident_id"]:
                        with incident_service_scope() as incident_service:
                            incident_service.resolve(sim["incident_id"])

                    # Set services back to healthy
                    for key, service in self.services.items():
                        service["status"] = "healthy"
                        service["logs"].append(f"[{now_str}] RECOVERY: All metrics restored. Pod status verified HEALTHY.")

                    self.logs.append(f"[{now_str}] SYSTEM: Recovery successfully completed. Infrastructure returned to normal state.")
                    self.active_simulation = None  # End simulation record
                    # Clear shared DB flag so other replicas also see no simulation.
                    self._db_set_simulation_active(False)

                else:
                    # Linearly restore metrics back to normal
                    pct_done = rec_elapsed / 6.0
                    for key, service in self.services.items():
                        if service["status"] == "recovering":
                            base = HEALTHY_METRICS[key]
                            service["cpu"] = int(service["cpu"] + (base["cpu"] - service["cpu"]) * pct_done)
                            service["memory"] = int(service["memory"] + (base["memory"] - service["memory"]) * pct_done)
                            service["disk"] = int(service["disk"] + (base["disk"] - service["disk"]) * pct_done)
                            service["network"] = int(service["network"] + (base["network"] - service["network"]) * pct_done)
                return

            # Apply simulation failure states based on timeline phase
            # Phase 1: Metric Spike (elapsed >= 2s)
            if elapsed >= 2.0 and sim["step"] == "healthy":
                sim["step"] = "metric_spike"
                self._update_timeline_status(sim, "metric_spike", "completed")
                
                # Update metrics and statuses according to failure type
                self._apply_failure_metrics(itype)
                self.logs.append(f"[{now_str}] WARNING: Anomalous behavior detected in system telemetry.")

            # Phase 2: Alert Triggered (elapsed >= 4s)
            elif elapsed >= 4.0 and sim["step"] == "metric_spike":
                sim["step"] = "alert_triggered"
                self._update_timeline_status(sim, "alert_triggered", "completed")
                
                # Trigger Prometheus Alert
                alert_name, service_name, alert_desc = self._get_alert_details(itype)
                self.alerts.append({
                    "id": f"AL-{int(time.time()) % 1000:03d}",
                    "alert_name": alert_name,
                    "service": service_name,
                    "severity": "critical" if "critical" in alert_desc.lower() or itype in ["db_exhaustion", "k8s_crashloop", "node_failure"] else "warning",
                    "description": alert_desc,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                self.logs.append(f"[{now_str}] Prometheus AlertManager: ALERT TRIGGERED [{alert_name}] affecting service '{service_name}'")

            # Phase 3: Incident Created (elapsed >= 6s)
            elif elapsed >= 6.0 and sim["step"] == "alert_triggered":
                sim["step"] = "incident_created"
                self._update_timeline_status(sim, "incident_created", "completed")
                
                # Create Incident in incident_service
                with incident_service_scope() as incident_service:
                    incident = incident_service.simulate(itype)
                sim["incident_id"] = incident.id
                self.logs.append(f"[{now_str}] API Gateway: Automatically spawned Incident ticket {incident.id} for alert mitigation.")

            # Phase 4: RAG Search (elapsed >= 8s)
            elif elapsed >= 8.0 and sim["step"] == "incident_created":
                sim["step"] = "rag_search"
                self._update_timeline_status(sim, "rag_search", "completed")
                self.logs.append(f"[{now_str}] RAG Pipeline: Querying vector store 'cloudops_runbooks' for runbooks matching '{itype}'...")
                self.logs.append(f"[{now_str}] RAG Pipeline: Retrieved context document 'sandbox_runbook.md' with high semantic match score.")

            # Phase 5: Ollama Analysis (elapsed >= 11s)
            elif elapsed >= 11.0 and sim["step"] == "rag_search":
                sim["step"] = "gemini_analysis"
                self._update_timeline_status(sim, "gemini_analysis", "completed")
                self.logs.append(f"[{now_str}] LangChain Client: Requesting Root Cause Analysis from local Ollama ({settings.OLLAMA_MODEL})...")

                # Queue the AI analysis to run OUTSIDE this lock (see _run_pending_analysis).
                # This avoids holding self.lock across a multi-second LLM/RAG call, which
                # would otherwise block get_state()/simulate()/trigger_recovery().
                self._pending_analysis = sim["incident_id"]

            # Phase 6: Recovery Recommendation (elapsed >= 14s)
            # The simulation STOPS here and waits for the user to press
            # "Recover Infrastructure". There is NO automatic recovery.
            elif elapsed >= 14.0 and sim["step"] == "gemini_analysis":
                sim["step"] = "recovery_recommendation"
                self._update_timeline_status(sim, "recovery_recommendation", "completed")
                self.logs.append(f"[{now_str}] SYSTEM: Remediation steps dispatch completed. Awaiting operator recovery run approval.")

            # NOTE: There is intentionally NO Phase 7 here.
            # Recovery is ONLY triggered by the user pressing "Recover Infrastructure".
            # The POST /sandbox/recover endpoint calls trigger_recovery() directly.

    def _update_timeline_status(self, sim: Dict[str, Any], step_key: str, status: str):
        for item in sim["timeline"]:
            if item["step"] == step_key:
                item["status"] = status

    def _apply_failure_metrics(self, itype: str):
        """Modifies services and metrics dynamically based on the failure simulation type."""
        now_str = datetime.now().strftime("%H:%M:%S")
        if itype == "db_exhaustion":
            # Postgres pool fully saturated
            db = self.services["postgresql-db"]
            db["status"] = "critical"
            db["cpu"] = 96
            db["memory"] = 92
            db["network"] = 1500  # Latency spike
            db["logs"].append(f"[{now_str}] FATAL: remaining connection slots are reserved for non-replication superuser connections")
            
            pay = self.services["payment-service"]
            pay["status"] = "degraded"
            pay["cpu"] = 40
            pay["network"] = 800  # Connection wait time
            pay["logs"].append(f"[{now_str}] sqlalchemy.exc.TimeoutError: QueuePool limit reached. Connection timed out after 30s.")

        elif itype == "k8s_crashloop":
            # Pod CrashLoopBackOff
            pay = self.services["payment-service"]
            pay["status"] = "critical"
            pay["cpu"] = 0
            pay["memory"] = 0
            pay["network"] = 0
            pay["logs"].append(f"[{now_str}] FileNotFoundError: [Errno 2] No such file or directory: '/app/config/settings.yml'")
            pay["logs"].append(f"[{now_str}] Container crashed. Exit code: 1. Restarting container in back-off mode...")
            
            k8s = self.services["k8s-cluster"]
            k8s["status"] = "degraded"
            k8s["logs"].append(f"[{now_str}] ControllerManager: Pod payment-service-7f9d8c is in CrashLoopBackOff state (restart count 7).")

        elif itype == "high_cpu":
            # Runaway CPU in auth-service
            auth = self.services["auth-service"]
            auth["status"] = "critical"
            auth["cpu"] = 99
            auth["memory"] = 55
            auth["network"] = 450
            auth["logs"].append(f"[{now_str}] WARNING: bcrypt hashing cost factor 14 rounds blocking JS single-threaded event loop.")
            auth["logs"].append(f"[{now_str}] High CPU load threshold reached. Throttling applied.")

        elif itype == "memory_leak":
            # Linear memory leak in user-service
            user = self.services["user-service"]
            user["status"] = "critical"
            user["cpu"] = 35
            user["memory"] = 99
            user["logs"].append(f"[{now_str}] ERROR: OutOfMemoryError. Java heap space depleted / Linux kernel OOMKiller initiated.")
            user["logs"].append(f"[{now_str}] Container terminated. Restarting pod user-service-58d9cfb4f-xpt23.")

        elif itype == "redis_failure":
            # Redis OOM Failure
            redis = self.services["redis-cache"]
            redis["status"] = "critical"
            redis["cpu"] = 5
            redis["memory"] = 98
            redis["logs"].append(f"[{now_str}] redis_connected_clients dropped to 0. Writing rejected under noeviction configuration policy.")
            
            auth = self.services["auth-service"]
            auth["status"] = "degraded"
            auth["network"] = 350  # Cache misses latency
            auth["logs"].append(f"[{now_str}] redis.exceptions.ConnectionError: Error 111 connecting to redis-cache:6379. Connection refused.")

        elif itype == "api_timeout":
            # Stripe API Timeout
            pay = self.services["payment-service"]
            pay["status"] = "critical"
            pay["network"] = 15000  # Extreme latency timeout
            pay["logs"].append(f"[{now_str}] httpx.ReadTimeout: Connection closed after 15.00 seconds waiting for Stripe upstream portal.")
            
            ingress = self.services["nginx-ingress"]
            ingress["status"] = "degraded"
            ingress["logs"].append(f"[{now_str}] Nginx error: upstream timeout. HTTP 504 returned on route /api/v1/payments/checkout.")

        elif itype == "disk_full":
            # Database disk full
            db = self.services["postgresql-db"]
            db["status"] = "critical"
            db["disk"] = 100
            db["logs"].append(f"[{now_str}] ERROR: could not write to file 'base/16384/12345': No space left on device.")
            db["logs"].append(f"[{now_str}] Database engine locked in READ-ONLY mode. Transaction commit requests rejected.")

        elif itype == "network_latency":
            # Network Latency Spike
            user = self.services["user-service"]
            user["status"] = "degraded"
            user["network"] = 1520
            user["logs"].append(f"[{now_str}] WARNING: Network package drop rates reached 12.4% on interface eth0.")
            
            pay = self.services["payment-service"]
            pay["status"] = "degraded"
            pay["network"] = 1480
            pay["logs"].append(f"[{now_str}] WARNING: Outgoing request latency to auth-service exceeds threshold of 1000ms.")

        elif itype == "node_failure":
            # Node 03 Failure
            k8s = self.services["k8s-cluster"]
            k8s["status"] = "critical"
            k8s["cpu"] = 5
            k8s["logs"].append(f"[{now_str}] Kubelet connection lease renew failed. Node cloudshop-node-03 changed to NotReady.")
            
            # Downstream degraded
            for key in ["payment-service", "auth-service"]:
                self.services[key]["status"] = "degraded"
                self.services[key]["logs"].append(f"[{now_str}] Evicting replica container due to Node NodeNotReady status.")

        elif itype == "service_unavailable":
            # nginx-ingress returns 503
            ingress = self.services["nginx-ingress"]
            ingress["status"] = "critical"
            ingress["logs"].append(f"[{now_str}] Nginx 503: payment-service has no registered endpoint destinations in service manifest.")
            
            pay = self.services["payment-service"]
            pay["status"] = "degraded"
            pay["logs"].append(f"[{now_str}] Readiness probe failed. Pod payment-service-b2f9cd74 was removed from Service endpoints.")

    def _get_alert_details(self, itype: str) -> tuple:
        """Returns (alert_name, service_name, alert_desc) for alert notification records."""
        if itype == "db_exhaustion":
            return "PostgreSQLConnectionPoolExhausted", "postgresql-db", "Database client connections reached pool limit. Checkout failing."
        elif itype == "k8s_crashloop":
            return "PodCrashLoopBackOff", "payment-service", "Container exiting repeatedly due to missing settings file."
        elif itype == "high_cpu":
            return "HighCPUThrottling", "auth-service", "CPU utilization exceeded 95% limit for 3 polling intervals."
        elif itype == "memory_leak":
            return "ContainerMemoryUsageCritical", "user-service", "Memory utilization close to cgroup hard limits. eviction imminent."
        elif itype == "redis_failure":
            return "RedisConnectionRefused", "redis-cache", "Redis cache engine not responding to socket ping queries."
        elif itype == "api_timeout":
            return "APIGatewayTimeout", "payment-service", "Ingress gateway reporting high rate of 504 timeouts to upstream Stripe."
        elif itype == "disk_full":
            return "DatabaseDiskVolumeFull", "postgresql-db", "Persistent volume volume mounts exhausted 100% capacity."
        elif itype == "network_latency":
            return "NetworkLatencySpike", "user-service", "High packet delivery RTT delay and dropped sockets detected."
        elif itype == "node_failure":
            return "KubernetesNodeNotReady", "k8s-cluster", "Node cloudshop-node-03 is unresponsive to control plane sync."
        elif itype == "service_unavailable":
            return "IngressHttp5xxRateHigh", "nginx-ingress", "Ingress returns high rate of HTTP 503 errors to public gateway."
        else:
            return "GenericSystemFailure", "unknown", "An unclassified anomaly was registered in the cluster."

# Global sandbox service singleton instance
sandbox_service = SandboxService()
