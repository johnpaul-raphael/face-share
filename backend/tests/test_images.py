"""Unit tests for /api/v1/images endpoints."""
from unittest.mock import patch
from tests.conftest import FAKE_USER, FAKE_EVENT, FAKE_PHOTO

PRESIGNED_BASE = "/api/v1/images"
EVENT_ID = "event-xyz-456"


class TestPresignedUpload:
    def test_presigned_upload_event_photo(self, client):
        with patch("app.api.images.dynamodb_service") as mock_db, \
             patch("app.api.images.generate_presigned_upload_url", return_value="https://s3.example.com/upload"):
            mock_db.create_photo.return_value = True
            resp = client.post(f"{PRESIGNED_BASE}/presigned-upload", json={
                "filename": "photo.jpg",
                "content_type": "image/jpeg",
                "event_id": EVENT_ID,
            })
        assert resp.status_code == 200
        data = resp.json()
        assert "upload_url" in data
        assert "s3_key" in data
        assert "photo_id" in data
        assert data["photo_id"] is not None

    def test_presigned_upload_face_profile(self, client):
        with patch("app.api.images.generate_presigned_upload_url", return_value="https://s3.example.com/face"):
            resp = client.post(f"{PRESIGNED_BASE}/presigned-upload", json={
                "filename": "selfie.jpg",
                "content_type": "image/jpeg",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert "upload_url" in data
        assert "s3_key" in data
        assert data["photo_id"] is None

    def test_presigned_upload_missing_filename(self, client):
        resp = client.post(f"{PRESIGNED_BASE}/presigned-upload", json={
            "content_type": "image/jpeg",
        })
        assert resp.status_code == 422


class TestPresignedDownload:
    def test_presigned_download_success(self, client):
        with patch("app.api.images.generate_presigned_download_url", return_value="https://s3.example.com/download"):
            resp = client.post(f"{PRESIGNED_BASE}/presigned-download", json={
                "s3_key": "events/event-xyz-456/photos/photo-001.jpg"
            })
        assert resp.status_code == 200
        assert "download_url" in resp.json()

    def test_presigned_download_missing_key(self, client):
        resp = client.post(f"{PRESIGNED_BASE}/presigned-download", json={})
        assert resp.status_code == 422


class TestConfirmFaceProfileUpload:
    def test_confirm_face_upload_success(self, client):
        rek_result = {"face_id": "rek-face-001", "confidence": 99.0}
        with patch("app.api.images.dynamodb_service") as mock_db, \
             patch("app.api.images.rekognition_service") as mock_rek, \
             patch("app.api.images.check_s3_object_exists", return_value=True):
            mock_db.get_user_face_profiles.return_value = []  # 0 existing → under limit
            mock_rek.index_face.return_value = rek_result
            mock_db.create_face_profile.return_value = True
            resp = client.post(
                f"{PRESIGNED_BASE}/face-profile/confirm-upload",
                params={"face_image_id": "face-001", "s3_key": "users/test/face.jpg"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "face-001"

    def test_confirm_face_upload_limit_exceeded(self, client):
        five_faces = [{"image_id": f"face-00{i}"} for i in range(5)]
        with patch("app.api.images.dynamodb_service") as mock_db:
            mock_db.get_user_face_profiles.return_value = five_faces
            resp = client.post(
                f"{PRESIGNED_BASE}/face-profile/confirm-upload",
                params={"face_image_id": "face-new", "s3_key": "users/test/face-new.jpg"},
            )
        assert resp.status_code == 400

    def test_confirm_face_upload_no_face_detected(self, client):
        with patch("app.api.images.dynamodb_service") as mock_db, \
             patch("app.api.images.rekognition_service") as mock_rek:
            mock_db.get_user_face_profiles.return_value = []
            mock_rek.index_face.return_value = None  # no face found
            resp = client.post(
                f"{PRESIGNED_BASE}/face-profile/confirm-upload",
                params={"face_image_id": "face-001", "s3_key": "users/test/noface.jpg"},
            )
        assert resp.status_code == 400


class TestGetEventPhotos:
    def test_get_event_photos_success(self, client):
        with patch("app.api.images.dynamodb_service") as mock_db, \
             patch("app.api.images.generate_presigned_download_url", return_value="https://s3.example.com/photo.jpg"):
            mock_db.get_event.return_value = FAKE_EVENT
            mock_db.get_event_photos_page.return_value = ([FAKE_PHOTO], None)
            resp = client.get(f"/api/v1/events/{EVENT_ID}/photos")
        assert resp.status_code == 200
        photos = resp.json()["items"]
        assert len(photos) == 1
        assert photos[0]["photo_id"] == "photo-111"
        assert photos[0]["url"] == "https://s3.example.com/photo.jpg"
        assert photos[0]["match_count"] == 2

    def test_get_event_photos_not_found(self, client):
        with patch("app.api.images.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = None
            resp = client.get(f"/api/v1/events/nonexistent/photos")
        assert resp.status_code == 404


class TestMatchActions:
    def test_confirm_match_success(self, client):
        with patch("app.api.images.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = FAKE_EVENT
            mock_db.update_match.return_value = True
            resp = client.patch(
                f"/api/v1/events/{EVENT_ID}/photos/photo-111/matches/match-001/confirm"
            )
        assert resp.status_code == 200

    def test_delete_match_success(self, client):
        with patch("app.api.images.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = FAKE_EVENT
            mock_db.delete_match.return_value = True
            resp = client.delete(
                f"/api/v1/events/{EVENT_ID}/photos/photo-111/matches/match-001"
            )
        assert resp.status_code == 204
