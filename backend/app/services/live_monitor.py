import logging
from typing import Dict, Any, List
from app.services.system_info import get_system_info
from app.services.metrics_provider import metrics_factory

from app.db.session import SessionLocal
from app.models.system_setting import SystemSetting

logger = logging.getLogger(__name__)


class LiveMonitorService:
    """
    Service responsible for orchestrating live device monitoring data,
    host system info detection, and mode state (live vs demo).
    """

    def __init__(self):
        self.mode = "demo"  # Fallback in-memory mode

    def get_mode(self) -> str:
        try:
            with SessionLocal() as session:
                setting = session.query(SystemSetting).filter_by(key="monitoring_mode").first()
                if setting:
                    return setting.value
        except Exception as e:
            logger.error(f"Error reading mode from database: {e}")
        return self.mode

    def set_mode(self, mode: str, caller_filename: str = "unknown", caller_function: str = "unknown", reason: str = "unspecified") -> str:
        prev_mode = self.get_mode()
        if mode in ["live", "demo"]:
            self.mode = mode
            try:
                with SessionLocal() as session:
                    setting = session.query(SystemSetting).filter_by(key="monitoring_mode").first()
                    if setting:
                        setting.value = mode
                    else:
                        setting = SystemSetting(key="monitoring_mode", value=mode)
                        session.add(setting)
                    session.commit()
            except Exception as e:
                logger.error(f"Error saving mode to database: {e}")
            from datetime import datetime
            logger.info(
                f"[MODE_TRACE] timestamp={datetime.now().isoformat()} | previous_mode={prev_mode} | new_mode={mode} | "
                f"filename={caller_filename} | function={caller_function} | reason={reason}"
            )
        return mode

    def get_live_state(self) -> Dict[str, Any]:
        """
        Retrieves real-time system hardware info, live metrics from active MetricsProvider,
        and threshold alerts.
        """
        sys_info = get_system_info()
        provider = metrics_factory.get_provider()
        telemetry = provider.get_metrics()
        alerts = provider.get_active_alerts()
        current_mode = self.get_mode()

        return {
            "mode": current_mode,
            "provider": provider.provider_name,
            "system_info": sys_info,
            "status": telemetry.get("status", "healthy"),
            "services": telemetry.get("services", []),
            "alerts": alerts,
            "logs": [
                f"[INFO] Monitoring mode: {current_mode.upper()} | Active provider: {provider.provider_name.upper()}",
                f"[INFO] Host OS: {sys_info['os']} | CPU Cores: {sys_info['cpu_cores_logical']} | RAM: {sys_info['memory']['total_gb']}GB",
                f"[INFO] Primary IP: {sys_info['ip']} | Hostname: {sys_info['hostname']}"
            ]
        }


# Singleton instance
live_monitor_service = LiveMonitorService()
