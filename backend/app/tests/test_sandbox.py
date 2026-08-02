import sys
import os
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.sandbox_service import SandboxService
from app.schemas.incidents import IncidentType

def test_sandbox_state_and_simulation():
    print("=== Running Sandbox State & Simulation Unit Tests ===")
    
    # Initialize isolated sandbox service
    sandbox = SandboxService()
    
    # 1. Verify initial health
    state = sandbox.get_state()
    assert len(state["services"]) == 7, f"Expected 7 services, got {len(state['services'])}"
    for svc in state["services"]:
        assert svc["status"] == "healthy", f"Expected healthy service, got {svc['name']}: {svc['status']}"
    print("[1] Initial service states successfully verified as healthy.")

    # 2. Trigger Memory Leak simulation
    print("\n[2] Triggering simulated memory leak...")
    sandbox.simulate(IncidentType.MEMORY_LEAK, demo_mode=False)
    state = sandbox.get_state()
    assert state["active_simulation"] is not None
    assert state["active_simulation"]["type"] == "memory_leak"
    assert state["active_simulation"]["step"] == "healthy"
    
    # 3. Simulate background update loop steps
    print("\n[3] Ticking state engine manually...")
    # Manually call _update_sandbox_metrics to trigger transitions
    # Set start_time to 3 seconds ago to trigger metric_spike
    sandbox.active_simulation["start_time"] = time.time() - 3.0
    sandbox._update_sandbox_metrics()
    
    state = sandbox.get_state()
    assert state["active_simulation"]["step"] == "metric_spike"
    assert sandbox.services["user-service"]["status"] == "critical"
    assert sandbox.services["user-service"]["memory"] == 99
    print("   Service 'user-service' memory spiked to 99% as expected.")

    # Set start_time to 5 seconds ago to trigger alert_triggered
    sandbox.active_simulation["start_time"] = time.time() - 5.0
    sandbox._update_sandbox_metrics()
    state = sandbox.get_state()
    assert state["active_simulation"]["step"] == "alert_triggered"
    assert len(state["alerts"]) > 0
    print(f"   Alert raised: {state['alerts'][0]['alert_name']}")

    # Set start_time to 7 seconds ago to trigger incident_created
    sandbox.active_simulation["start_time"] = time.time() - 7.0
    sandbox._update_sandbox_metrics()
    state = sandbox.get_state()
    assert state["active_simulation"]["step"] == "incident_created"
    assert state["active_simulation"]["incident_id"] is not None
    print(f"   Incident ticket registered: {state['active_simulation']['incident_id']}")

    # 4. Trigger recovery manually
    print("\n[4] Triggering manual recovery...")
    sandbox.trigger_recovery()
    state = sandbox.get_state()
    assert state["active_simulation"]["recovery_triggered"] is True
    assert sandbox.services["user-service"]["status"] == "recovering"
    
    # Set recovery_start_time to 7 seconds ago to simulate complete recovery
    sandbox.active_simulation["recovery_start_time"] = time.time() - 7.0
    sandbox._update_sandbox_metrics()
    
    state = sandbox.get_state()
    assert state["active_simulation"] is None
    assert sandbox.services["user-service"]["status"] == "healthy"
    print("   Recovery complete. Service is healthy again.")
    
    # Stop background thread
    sandbox.stop_background_worker()
    print("\n[SUCCESS] Sandbox service tests completed successfully!")

if __name__ == "__main__":
    try:
        test_sandbox_state_and_simulation()
        sys.exit(0)
    except Exception as e:
        print(f"\n[FAILURE] Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
