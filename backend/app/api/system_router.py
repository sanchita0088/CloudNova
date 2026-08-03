from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.services.system_info import get_system_info
from app.services.live_monitor import LiveMonitorService
from app.services.metrics_provider import MetricsProviderFactory
from app.api.deps import get_live_monitor_service, get_metrics_factory

router = APIRouter(prefix="/system", tags=["System & Device Information"])


class ModeRequest(BaseModel):
    mode: str  # 'live' or 'demo'


@router.get("/info")
def get_host_info(
    live_monitor_service: LiveMonitorService = Depends(get_live_monitor_service),
    metrics_factory: MetricsProviderFactory = Depends(get_metrics_factory),
):
    """
    Returns hardware, OS, CPU, RAM, Disk, IP, and active provider info for the target host machine.
    """
    import os
    import time
    from datetime import datetime
    import logging
    logger = logging.getLogger(__name__)
    current_mode = live_monitor_service.get_mode()
    pod_name = os.environ.get("HOSTNAME", os.environ.get("POD_NAME", f"pid-{os.getpid()}"))
    logger.info(f"[ENDPOINT_TRACE] GET /system/info | current_mode={current_mode} | timestamp={datetime.now().isoformat()} | process_id={os.getpid()} | pod_name={pod_name}")

    info = get_system_info()
    provider = metrics_factory.get_provider()
    return {
        "system_info": info,
        "active_provider": provider.provider_name,
        "mode": current_mode
    }


@router.get("/mode")
def get_monitoring_mode(live_monitor_service: LiveMonitorService = Depends(get_live_monitor_service)):
    """
    Returns the current active monitoring mode: 'live' or 'demo'.
    """
    import os
    from datetime import datetime
    import logging
    logger = logging.getLogger(__name__)
    current_mode = live_monitor_service.get_mode()
    pod_name = os.environ.get("HOSTNAME", os.environ.get("POD_NAME", f"pid-{os.getpid()}"))
    logger.info(f"[ENDPOINT_TRACE] GET /system/mode | current_mode={current_mode} | timestamp={datetime.now().isoformat()} | process_id={os.getpid()} | pod_name={pod_name}")
    return {"mode": current_mode}


@router.post("/mode")
def set_monitoring_mode(
    req: ModeRequest,
    live_monitor_service: LiveMonitorService = Depends(get_live_monitor_service),
):
    """
    Toggles or sets the active monitoring mode ('live' or 'demo').
    Switching to live mode cancels any running demo simulation so the
    background worker stops advancing demo state in the background.
    """
    if req.mode not in ["live", "demo"]:
        raise HTTPException(status_code=400, detail="Mode must be 'live' or 'demo'.")
    new_mode = live_monitor_service.set_mode(
        req.mode,
        caller_filename="system_router.py",
        caller_function="set_monitoring_mode",
        reason="HTTP POST /api/v1/system/mode requested by user toggle"
    )

    # When switching to live, immediately cancel any active demo simulation.
    # This prevents the worker thread from continuing to advance simulation
    # phases in the background, and clears stale demo state so the next
    # GET /sandbox/state returns clean live data (not leftover demo alerts).
    if req.mode == "live":
        from app.services.sandbox_service import sandbox_service
        sandbox_service.stop_simulation()

    return {"mode": new_mode, "status": "success"}

