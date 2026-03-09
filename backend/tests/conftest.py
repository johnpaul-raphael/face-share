"""
Shared fixtures for FaceShare unit tests.
All AWS calls (DynamoDB, S3, Rekognition) are mocked.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.api.deps import get_current_user
from app.core.security import create_access_token
from app.services.dynamodb_auth_service import DynamoDBUser


# ─── Fake data ────────────────────────────────────────────────────────────────

# DynamoDB item format (what the DB returns)
FAKE_USER_ITEM = {
    "user_id": "user-abc-123",
    "email": "test@example.com",
    "name": "Test User",
    "avatar_url": None,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": None,
}

# DynamoDBUser object (what get_current_user returns — attribute access)
FAKE_USER_OBJ = DynamoDBUser(FAKE_USER_ITEM)

# Plain dict representation (used in response assertions)
FAKE_USER = {
    "id": "user-abc-123",
    "email": "test@example.com",
    "name": "Test User",
    "avatar_url": None,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": None,
}

FAKE_EVENT = {
    "event_id": "event-xyz-456",
    "name": "Test Event",
    "description": "A test event description",
    "owner_id": "user-abc-123",
    "owner_name": "Test User",
    "join_code": "TEST01",
    "cover_image_url": None,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": None,
}

FAKE_PARTICIPANT = {
    "user_id": "user-abc-123",
    "user_name": "Test User",
    "user_email": "test@example.com",
    "status": "approved",
    "joined_at": "2024-01-01T00:00:00",
}

FAKE_PHOTO = {
    "photo_id": "photo-111",
    "event_id": "event-xyz-456",
    "uploader_id": "user-abc-123",
    "s3_key": "events/event-xyz-456/photos/photo-111.jpg",
    "is_processing": False,
    "uploaded_at": "2024-01-01T00:00:00",
}

FAKE_FACE_PROFILE = {
    "image_id": "face-001",
    "user_id": "user-abc-123",
    "s3_key": "users/user-abc-123/faces/face-001.jpg",
    "rekognition_face_id": "rek-face-001",
    "confidence": 99.5,
    "created_at": "2024-01-01T00:00:00",
}


# ─── Auth override ─────────────────────────────────────────────────────────────

def override_get_current_user():
    """Return DynamoDBUser object, bypassing JWT + DynamoDB lookup."""
    return FAKE_USER_OBJ


app.dependency_overrides[get_current_user] = override_get_current_user


# ─── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    """TestClient with auth override applied."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_headers():
    token = create_access_token(subject="user-abc-123")
    return {"Authorization": f"Bearer {token}"}
