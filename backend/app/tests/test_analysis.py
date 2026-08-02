import sys
import os

# Adjust path to import app modules correctly
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.incidents_service import incident_service_scope
from app.schemas.incidents import IncidentType
from app.services.ai_service import ai_service


def test_ai_analysis_pipeline():
    print("=== Running AI RCA Analysis Pipeline Test ===")
    print("(Requires DATABASE_URL to point at a reachable Postgres instance)")

    # 1. Simulate an incident (e.g., db_exhaustion)
    print("Simulating a db_exhaustion incident...")
    with incident_service_scope() as incident_service:
        incident = incident_service.simulate(IncidentType.DB_EXHAUSTION)
    print(f"Created Incident: {incident.id} for service {incident.service}")

    # 2. Run the analysis service directly
    print("\nTriggering AI Analysis Service...")
    analysis_result = ai_service.analyze(incident)

    print(f"Analysis result keys: {list(analysis_result.keys())}")
    
    # Assertions
    assert "root_cause" in analysis_result, "Missing 'root_cause' in analysis result"
    assert "confidence_score" in analysis_result, "Missing 'confidence_score' in analysis result"
    assert "recovery_steps" in analysis_result, "Missing 'recovery_steps' in analysis result"
    assert "incident_report" in analysis_result, "Missing 'incident_report' in analysis result"

    print("\n--- AI Root Cause ---")
    print(analysis_result["root_cause"])
    
    print("\n--- AI Recommended Recovery Steps ---")
    for idx, step in enumerate(analysis_result["recovery_steps"], 1):
        print(f"{idx}. {step}")

    print("\n--- AI Markdown Report Snippet ---")
    print(analysis_result["incident_report"][:200] + "...")

    # 3. Attach back to store
    print("\nAttaching analysis back to the incident store...")
    with incident_service_scope() as incident_service:
        updated_incident = incident_service.attach_ai_analysis(incident.id, analysis_result)
    assert updated_incident is not None, "Failed to update incident with analysis"
    assert updated_incident.ai_analysis == analysis_result, "Stored analysis doesn't match generated analysis"

    print("\n[SUCCESS] AI RCA Analysis Pipeline test passed!")


if __name__ == "__main__":
    try:
        test_ai_analysis_pipeline()
        sys.exit(0)
    except Exception as e:
        print(f"\n[FAILURE] Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
