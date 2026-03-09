"""Unit tests for /api/v1/users endpoints."""
from unittest.mock import patch
from tests.conftest import FAKE_USER, FAKE_USER_ITEM, FAKE_FACE_PROFILE

BASE = "/api/v1/users"


class TestGetCurrentUser:
    def test_get_me_success(self, client):
        resp = client.get(f"{BASE}/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == FAKE_USER["id"]
        assert data["email"] == FAKE_USER["email"]


class TestUpdateProfile:
    def test_update_name_success(self, client):
        # get_user_by_id returns raw DynamoDB item (dict with user_id key)
        updated_item = {**FAKE_USER_ITEM, "name": "Updated Name"}
        with patch("app.api.users.dynamodb_service") as mock_db:
            mock_db.update_user.return_value = True
            mock_db.get_user_by_id.return_value = updated_item
            resp = client.patch(f"{BASE}/me", json={"name": "Updated Name"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"

    def test_update_email_success(self, client):
        updated_item = {**FAKE_USER_ITEM, "email": "new@example.com"}
        with patch("app.api.users.dynamodb_service") as mock_db:
            mock_db.update_user.return_value = True
            mock_db.get_user_by_id.return_value = updated_item
            resp = client.patch(f"{BASE}/me", json={"email": "new@example.com"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "new@example.com"

    def test_update_invalid_email(self, client):
        resp = client.patch(f"{BASE}/me", json={"email": "not-an-email"})
        assert resp.status_code == 422


class TestGetFaceProfile:
    def test_get_face_profile_empty(self, client):
        with patch("app.api.users.dynamodb_service") as mock_db:
            mock_db.get_user_face_profiles.return_value = []
            resp = client.get(f"{BASE}/me/face-profile")
        assert resp.status_code == 200
        data = resp.json()
        assert data["image_count"] == 0
        assert data["is_complete"] is False
        assert data["images"] == []

    def test_get_face_profile_complete(self, client):
        three_images = [
            {**FAKE_FACE_PROFILE, "image_id": f"face-00{i}"} for i in range(3)
        ]
        with patch("app.api.users.dynamodb_service") as mock_db, \
             patch("app.api.users.generate_presigned_download_url", return_value="https://s3.example.com/signed"):
            mock_db.get_user_face_profiles.return_value = three_images
            resp = client.get(f"{BASE}/me/face-profile")
        assert resp.status_code == 200
        data = resp.json()
        assert data["image_count"] == 3
        assert data["is_complete"] is True


class TestDeleteFaceProfileImage:
    def test_delete_success(self, client):
        with patch("app.api.users.dynamodb_service") as mock_db, \
             patch("app.api.users.rekognition_service") as mock_rek, \
             patch("app.api.users.delete_s3_object", return_value=True):
            mock_db.get_face_profile_image.return_value = FAKE_FACE_PROFILE
            mock_rek.delete_face.return_value = True
            mock_db.delete_face_profile.return_value = True
            resp = client.delete(f"{BASE}/me/face-profile/face-001")
        assert resp.status_code == 204

    def test_delete_not_found(self, client):
        with patch("app.api.users.dynamodb_service") as mock_db:
            mock_db.get_face_profile_image.return_value = None
            resp = client.delete(f"{BASE}/me/face-profile/nonexistent")
        assert resp.status_code == 404


class TestGetMyPhotos:
    def test_get_my_photos_empty(self, client):
        with patch("app.api.users.dynamodb_service") as mock_db:
            mock_db.get_user_photos_with_details.return_value = []
            resp = client.get(f"{BASE}/me/photos")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_my_photos_grouped_by_event(self, client):
        match_records = [
            {
                "photo_id": "photo-001",
                "event_id": "event-xyz-456",
                "event_name": "Test Event",
                "confidence": 0.98,
                "is_confirmed": True,
            }
        ]
        photo_record = {
            "photo_id": "photo-001",
            "s3_key": "events/event-xyz-456/photo-001.jpg",
        }
        with patch("app.api.users.dynamodb_service") as mock_db, \
             patch("app.api.users.generate_presigned_download_url", return_value="https://s3.example.com/photo.jpg"):
            mock_db.get_user_photos_with_details.return_value = match_records
            mock_db.get_photo.return_value = photo_record
            resp = client.get(f"{BASE}/me/photos")
        assert resp.status_code == 200
        groups = resp.json()
        assert len(groups) == 1
        assert groups[0]["event_id"] == "event-xyz-456"
        assert len(groups[0]["photos"]) == 1
