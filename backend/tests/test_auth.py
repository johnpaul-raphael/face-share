"""Unit tests for /api/v1/auth endpoints."""
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.services.dynamodb_auth_service import DynamoDBUser

client = TestClient(app)

FAKE_USER_OBJ = DynamoDBUser({
    "user_id": "user-new-001",
    "email": "newuser@example.com",
    "name": "New User",
    "avatar_url": None,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": None,
})


class TestRefreshToken:
    def test_refresh_success(self):
        from app.core.security import create_refresh_token
        refresh_token = create_refresh_token(data={"sub": "user-new-001"})
        with patch("app.api.auth.dynamodb_get_user_by_id", return_value=FAKE_USER_OBJ):
            resp = client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": refresh_token},
            )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_refresh_invalid_token(self):
        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "bad.token.here"})
        assert resp.status_code == 401
