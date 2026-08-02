import logging
from typing import Dict, Any, List
from app.services.system_info import get_system_info
from app.services.metrics_provider import metrics_factory

logger = logging.getLogger(__name__)


class LiveMonitorService:
    """
    Service responsible for orchestrating live device monitoring data,
    host system info detection, and mode state (live vs demo).
    """

    def __init__(self):
        self.mode = "demo"  # Default mode: 'demo' (preserving SandboxService default for initial load), can toggle to 'live'

    def get_mode(self) -> str:
        return self.mode

    def set_mode(self, mode: str) -> str:
        if mode in ["live", "demo"]:
            self.mode = mode
        return self.mode

    def get_live_state(self) -> Dict[str, Any]:
        """
        Retrieves real-time system hardware info, live metrics from active MetricsProvider,
        and threshold alerts.
        """
        sys_info = get_system_info()
        provider = metrics_factory.get_provider()
        telemetry = provider.get_metrics()
        alerts = provider.get_active_alerts()

        return {
            "mode": self.mode,
            "provider": provider.provider_name,
            "system_info": sys_info,
            "status": telemetry.get("status", "healthy"),
            "services": telemetry.get("services", []),
            "alerts": alerts,
            "logs": [
                f"[INFO] Monitoring mode: {self.mode.upper()} | Active provider: {provider.provider_name.upper()}",
                f"[INFO] Host OS: {sys_info['os']} | CPU Cores: {sys_info['cpu_cores_logical']} | RAM: {sys_info['memory']['total_gb']}GB",
                f"[INFO] Primary IP: {sys_info['ip']} | Hostname: {sys_info['hostname']}"
            ]
        }


# Singleton instance
live_monitor_service = LiveMonitorService()
