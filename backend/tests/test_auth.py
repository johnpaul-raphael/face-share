"""Unit tests for /api/v1/auth endpoints."""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.dynamodb_auth_service import DynamoDBUser

client = TestClient(app)


REGISTER_PAYLOAD = {
    "email": "newuser@example.com",
    "name": "New User",
    "password": "securepassword123",
}

LOGIN_PAYLOAD = {
    "email": "newuser@example.com",
    "password": "securepassword123",
}

# DynamoDB stores user_id (not id) — DynamoDBUser maps it to .id
FAKE_USER_OBJ = DynamoDBUser({
    "user_id": "user-new-001",
    "email": "newuser@example.com",
    "name": "New User",
    "avatar_url": None,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": None,
})


class TestRegister:
    def test_register_success(self):
        with patch("app.api.auth.dynamodb_get_user_by_email", return_value=None), \
             patch("app.api.auth.dynamodb_create_user", return_value=FAKE_USER_OBJ):
            resp = client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "newuser@example.com"
        assert data["name"] == "New User"
        assert "id" in data

    def test_register_duplicate_email(self):
        with patch("app.api.auth.dynamodb_get_user_by_email", return_value=FAKE_USER_OBJ):
            resp = client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
        assert resp.status_code == 400
        assert "already registered" in resp.json()["detail"].lower()

    def test_register_invalid_email(self):
        bad_payload = {**REGISTER_PAYLOAD, "email": "not-an-email"}
        resp = client.post("/api/v1/auth/register", json=bad_payload)
        assert resp.status_code == 422

    def test_register_missing_name(self):
        bad_payload = {"email": "test@example.com", "password": "password123"}
        resp = client.post("/api/v1/auth/register", json=bad_payload)
        assert resp.status_code == 422


class TestLogin:
    def test_login_success(self):
        with patch("app.api.auth.dynamodb_authenticate_user", return_value=FAKE_USER_OBJ):
            resp = client.post("/api/v1/auth/login", json=LOGIN_PAYLOAD)
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self):
        with patch("app.api.auth.dynamodb_authenticate_user", return_value=None):
            resp = client.post("/api/v1/auth/login", json=LOGIN_PAYLOAD)
        assert resp.status_code == 401

    def test_login_missing_fields(self):
        resp = client.post("/api/v1/auth/login", json={"email": "test@example.com"})
        assert resp.status_code == 422


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
