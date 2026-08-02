import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.incidents_service import IncidentService
from app.schemas.incidents import IncidentType, IncidentSimulateRequest


def test_incident_simulation_and_lifecycle():
    print("=== Running Incident Simulation & Lifecycle Test ===")

    # Use a fresh isolated service instance for tests
    svc = IncidentService()

    # 1. Simulate db_exhaustion
    print("\n[1] Simulating db_exhaustion incident...")
    inc = svc.simulate(IncidentType.DB_EXHAUSTION)
    assert inc.id.startswith("INC-"), f"Expected ID starting with 'INC-', got: {inc.id}"
    assert inc.service == "payment-gateway", f"Expected service 'payment-gateway', got: {inc.service}"
    assert inc.severity == "critical", f"Expected severity 'critical', got: {inc.severity}"
    assert inc.status == "active", f"Expected status 'active', got: {inc.status}"
    assert inc.ai_analysis is None, "Expected ai_analysis to be None initially"
    print(f"   Created: {inc.id} | service={inc.service} | severity={inc.severity} | status={inc.status}")

    # 2. Simulate auth_latency
    print("\n[2] Simulating auth_latency incident...")
    inc2 = svc.simulate(IncidentType.AUTH_LATENCY)
    assert inc2.service == "auth-service"
    assert inc2.severity == "warning"
    print(f"   Created: {inc2.id} | service={inc2.service} | severity={inc2.severity}")

    # 3. List all incidents
    print("\n[3] Listing all incidents...")
    all_incidents = svc.get_all()
    assert len(all_incidents) == 2, f"Expected 2 incidents, got: {len(all_incidents)}"
    print(f"   Found {len(all_incidents)} incidents (ordered newest-first)")

    # 4. Get incident by ID
    print(f"\n[4] Fetching incident by ID: {inc.id}...")
    fetched = svc.get_by_id(inc.id)
    assert fetched is not None, f"Incident {inc.id} not found"
    assert fetched.id == inc.id
    print(f"   Fetched: {fetched.id} | message snippet: '{fetched.message[:60]}...'")

    # 5. Resolve an incident
    print(f"\n[5] Resolving incident {inc.id}...")
    resolved = svc.resolve(inc.id)
    assert resolved is not None
    assert resolved.status == "resolved", f"Expected status 'resolved', got: {resolved.status}"
    print(f"   Status after resolve: {resolved.status}")

    # 6. Filter by active
    print("\n[6] Filtering only active incidents...")
    active = svc.get_all(status_filter="active")
    assert len(active) == 1, f"Expected 1 active incident, got: {len(active)}"
    assert active[0].id == inc2.id
    print(f"   Active incidents remaining: {len(active)}")

    # 7. Attach AI analysis
    print(f"\n[7] Attaching mock AI analysis to {inc2.id}...")
    analysis_data = {
        "root_cause": "Redis cache saturation causing bcrypt to block async loop",
        "recovery_steps": ["Restart redis-cache deployment", "Scale auth-service replicas"],
        "confidence": 0.91
    }
    updated = svc.attach_ai_analysis(inc2.id, analysis_data)
    assert updated is not None
    assert updated.ai_analysis == analysis_data
    print(f"   AI analysis attached: confidence={updated.ai_analysis['confidence']}")

    print("\n[SUCCESS] All Incident Simulation & Lifecycle tests passed!")


if __name__ == "__main__":
    try:
        test_incident_simulation_and_lifecycle()
        sys.exit(0)
    except Exception as e:
        print(f"\n[FAILURE] Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
