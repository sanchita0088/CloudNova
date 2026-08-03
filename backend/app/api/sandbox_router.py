from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from app.schemas.incidents import IncidentType
from app.services.sandbox_service import SandboxService
from app.api.deps import get_sandbox_service

router = APIRouter(prefix="/sandbox", tags=["Infrastructure Sandbox"])

class SimulateRequest(BaseModel):
    type: IncidentType
    demo_mode: bool = False

import asyncio
import json
from fastapi.responses import StreamingResponse

@router.get("/state")
def get_sandbox_state(sandbox_service: SandboxService = Depends(get_sandbox_service)):
    """
    Retrieves the real-time status of simulated services, live metrics,
    alerts list, timeline step progression, and recent log statements.
    """
    return sandbox_service.get_state()


@router.get("/stream")
async def stream_sandbox_telemetry(sandbox_service: SandboxService = Depends(get_sandbox_service)):
    """
    Server-Sent Events (SSE) stream yielding real-time cluster state
    and telemetry every 2 seconds.
    """
    async def event_generator():
        while True:
            try:
                state = sandbox_service.get_state()
                data = json.dumps(state)
                yield f"data: {data}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/simulate")
def start_simulation(
    req: SimulateRequest,
    sandbox_service: SandboxService = Depends(get_sandbox_service),
):
    """
    Starts a failure simulation scenario by key type,
    with an option to enable automated demo-mode.
    """
    try:
        return sandbox_service.simulate(req.type, req.demo_mode)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to start simulation: {str(e)}")

@router.post("/recover")
def trigger_recovery(sandbox_service: SandboxService = Depends(get_sandbox_service)):
    """
    Triggers recovery automation to gradually repair metrics
    and restore the services back to healthy operational state.
    """
    try:
        return sandbox_service.trigger_recovery()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to trigger recovery: {str(e)}")

