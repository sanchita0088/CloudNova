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
        self.mode = "demo"  # Fallback in-memory mode
        self._table_initialized = False

    def _init_db_table(self):
        if self._table_initialized:
            return
        try:
            from app.db.database import engine
            from sqlalchemy import text
            with engine.begin() as conn:
                conn.execute(text("CREATE TABLE IF NOT EXISTS system_settings (key VARCHAR(50) PRIMARY KEY, value VARCHAR(100));"))
                conn.execute(text("INSERT INTO system_settings (key, value) VALUES ('monitoring_mode', 'demo') ON CONFLICT (key) DO NOTHING;"))
            self._table_initialized = True
        except Exception as e:
            logger.error(f"Error initializing system_settings table: {e}")

    def get_mode(self) -> str:
        self._init_db_table()
        try:
            from app.db.database import engine
            from sqlalchemy import text
            with engine.connect() as conn:
                res = conn.execute(text("SELECT value FROM system_settings WHERE key = 'monitoring_mode';")).fetchone()
                if res:
                    return res[0]
        except Exception as e:
            logger.error(f"Error reading mode from database: {e}")
        return self.mode

    def set_mode(self, mode: str, caller_filename: str = "unknown", caller_function: str = "unknown", reason: str = "unspecified") -> str:
        self._init_db_table()
        prev_mode = self.get_mode()
        if mode in ["live", "demo"]:
            self.mode = mode
            try:
                from app.db.database import engine
                from sqlalchemy import text
                with engine.begin() as conn:
                    conn.execute(
                        text("INSERT INTO system_settings (key, value) VALUES ('monitoring_mode', :val) ON CONFLICT (key) DO UPDATE SET value = :val;"),
                        {"val": mode}
                    )
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
