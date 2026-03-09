"""Unit tests for /api/v1/events/{event_id}/participants endpoints."""
from unittest.mock import patch
from tests.conftest import FAKE_USER, FAKE_EVENT, FAKE_PARTICIPANT

BASE = "/api/v1/events/event-xyz-456/participants"
OWNER_EVENT = FAKE_EVENT  # current user IS the owner


class TestListParticipants:
    def test_list_success(self, client):
        second = {**FAKE_PARTICIPANT, "user_id": "user-other", "user_name": "Other"}
        with patch("app.api.participants.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = OWNER_EVENT
            mock_db.get_event_participants.return_value = [FAKE_PARTICIPANT, second]
            resp = client.get(BASE)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_list_event_not_found(self, client):
        with patch("app.api.participants.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = None
            resp = client.get(BASE)
        assert resp.status_code == 404

    def test_list_not_participant_returns_403(self, client):
        other_event = {**FAKE_EVENT, "owner_id": "other-owner"}
        with patch("app.api.participants.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = other_event
            mock_db.get_participant.return_value = None  # current user not a participant
            resp = client.get(BASE)
        assert resp.status_code == 403


class TestApproveParticipant:
    def test_approve_success(self, client):
        pending = {**FAKE_PARTICIPANT, "user_id": "user-other", "status": "pending"}
        approved = {**FAKE_PARTICIPANT, "user_id": "user-other", "status": "approved"}
        with patch("app.api.participants.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = OWNER_EVENT
            # first get_participant = existence check, second = fetch updated record
            mock_db.get_participant.side_effect = [pending, approved]
            mock_db.update_participant_status.return_value = True
            resp = client.patch(f"{BASE}/user-other/approve")
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"

    def test_approve_not_owner_returns_403(self, client):
        other_event = {**FAKE_EVENT, "owner_id": "other-owner"}
        with patch("app.api.participants.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = other_event
            resp = client.patch(f"{BASE}/user-other/approve")
        assert resp.status_code == 403

    def test_approve_participant_not_found(self, client):
        with patch("app.api.participants.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = OWNER_EVENT
            mock_db.get_participant.return_value = None
            resp = client.patch(f"{BASE}/nonexistent/approve")
        assert resp.status_code == 404


class TestRemoveParticipant:
    def test_owner_removes_other(self, client):
        with patch("app.api.participants.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = OWNER_EVENT
            mock_db.delete_participant.return_value = True
            resp = client.delete(f"{BASE}/user-other")
        assert resp.status_code == 204

    def test_self_removal(self, client):
        """A non-owner participant can remove themselves."""
        other_event = {**FAKE_EVENT, "owner_id": "other-owner"}
        with patch("app.api.participants.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = other_event
            mock_db.delete_participant.return_value = True
            # current user removing themselves
            resp = client.delete(f"{BASE}/{FAKE_USER['id']}")
        assert resp.status_code == 204

    def test_remove_other_as_non_owner_returns_403(self, client):
        other_event = {**FAKE_EVENT, "owner_id": "other-owner"}
        with patch("app.api.participants.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = other_event
            resp = client.delete(f"{BASE}/yet-another-user")
        assert resp.status_code == 403
