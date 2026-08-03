def test_auth_register_and_login(client):
    """
    Test user registration and JWT login.
    """
    # 1. Register test user
    reg_payload = {
        "username": "testoperator",
        "email": "testoperator@cloudops.ai",
        "password": "securepassword123",
        "role": "operator"
    }
    reg_response = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_response.status_code in [201, 400]  # 201 created or 400 if exists

    # 2. Login to get JWT Bearer token
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    login_response = client.post("/api/v1/auth/login", data=login_data)
    assert login_response.status_code == 200
    token_data = login_response.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
