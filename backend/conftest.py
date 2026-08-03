import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="module")
def client():
    """
    FastAPI TestClient fixture for integration testing.
    """
    with TestClient(app) as test_client:
        yield test_client
