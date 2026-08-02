import logging
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from app.services.incidents_service import IncidentService
from app.services.ai_service import AIAnalysisService
from app.api.deps import get_incident_service, get_ai_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["AI Root Cause Analysis"])


class AnalysisResponse:
    pass


@router.post("/{incident_id}", response_model=Dict[str, Any])
def analyze_incident(
    incident_id: str,
    incident_service: IncidentService = Depends(get_incident_service),
    ai_service: AIAnalysisService = Depends(get_ai_service),
):
    """
    Triggers AI-powered Root Cause Analysis on an existing incident.

    This endpoint:
    1. Fetches the incident from the in-memory store.
    2. Queries ChromaDB for relevant runbook context (RAG).
    3. Invokes the Gemini LLM via LangChain with a structured prompt.
    4. Parses and returns a structured JSON response containing:
       - **root_cause**: Most probable explanation for the failure.
       - **confidence_score**: AI confidence level (0.0 - 1.0).
       - **recovery_steps**: Ordered list of recommended remediation actions.
       - **incident_report**: A full markdown post-mortem report.
    5. Attaches the analysis result back to the incident record.
    """
    # Step 1: Fetch incident
    incident = incident_service.get_by_id(incident_id)
    if not incident:
        raise HTTPException(
            status_code=404,
            detail=f"Incident '{incident_id}' not found. Simulate one first via POST /api/v1/incidents/simulate"
        )

    # Step 2: Run AI analysis pipeline
    try:
        logger.info(f"Running AI analysis for incident {incident_id}...")
        analysis_result = ai_service.analyze(incident)
    except Exception as e:
        logger.error(f"AI analysis failed for {incident_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"AI analysis pipeline failed: {str(e)}"
        )

    # Step 3: Attach result to incident record
    try:
        updated_incident = incident_service.attach_ai_analysis(incident_id, analysis_result)
        if not updated_incident:
            logger.warning(f"Could not attach analysis to incident {incident_id} — incident may have been removed.")
    except Exception as e:
        logger.warning(f"Could not persist AI analysis to incident store: {e}")

    # Step 4: Return full structured analysis
    return {
        "incident_id": incident_id,
        "service": incident.service,
        "severity": incident.severity,
        "analysis": analysis_result
    }


@router.get("/{incident_id}/report")
def get_incident_report(
    incident_id: str,
    incident_service: IncidentService = Depends(get_incident_service),
):
    """
    Returns the stored AI analysis and post-mortem report for an incident
    that has already been analyzed.
    """
    incident = incident_service.get_by_id(incident_id)
    if not incident:
        raise HTTPException(
            status_code=404,
            detail=f"Incident '{incident_id}' not found."
        )

    if not incident.ai_analysis:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Incident '{incident_id}' has not been analyzed yet. "
                f"Trigger analysis via POST /api/v1/analysis/{incident_id}"
            )
        )

    return {
        "incident_id": incident_id,
        "service": incident.service,
        "severity": incident.severity,
        "status": incident.status,
        "analysis": incident.ai_analysis
    }
