import os

os.environ.setdefault("SECRET_KEY", "test_secret_key_for_unit_tests_only_32_bytes_hex")

from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="module")
def client():
    """
    FastAPI TestClient fixture for integration testing.
    """
    with TestClient(app) as test_client:
        yield test_client
