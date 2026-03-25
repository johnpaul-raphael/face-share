"""Unit tests for /api/v1/events endpoints."""
import pytest
from unittest.mock import patch, MagicMock
from tests.conftest import FAKE_USER, FAKE_EVENT, FAKE_PARTICIPANT


BASE = "/api/v1/events"


class TestCreateEvent:
    def test_create_event_success(self, client):
        with patch("app.api.events.dynamodb_service") as mock_db:
            mock_db.get_event_by_join_code.return_value = None  # join code is available
            mock_db.create_event.return_value = True
            mock_db.create_join_code_lookup.return_value = True
            mock_db.add_event_participant.return_value = True
            mock_db.get_event.return_value = FAKE_EVENT
            resp = client.post(BASE, json={"name": "My Event", "description": "A great event"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == FAKE_EVENT["name"]  # from mocked get_event return value
        assert "join_code" in data
        assert data["owner_id"] == FAKE_USER["id"]

    def test_create_event_missing_name(self, client):
        resp = client.post(BASE, json={"description": "No name"})
        assert resp.status_code == 422

    def test_create_event_no_name(self, client):
        """Name is required; missing name should fail validation."""
        resp = client.post(BASE, json={"description": "No name provided here"})
        assert resp.status_code == 422


class TestListEvents:
    def test_list_events_success(self, client):
        with patch("app.api.events.dynamodb_service") as mock_db:
            mock_db.get_user_events.return_value = [FAKE_EVENT]
            mock_db.get_events_user_joined.return_value = []
            mock_db.get_event_participants.return_value = [FAKE_PARTICIPANT]
            resp = client.get(BASE)
        assert resp.status_code == 200
        events = resp.json()["items"]
        assert isinstance(events, list)
        assert events[0]["id"] == FAKE_EVENT["event_id"]

    def test_list_events_deduplicates(self, client):
        """Owner event and joined event with same ID should appear once."""
        with patch("app.api.events.dynamodb_service") as mock_db:
            mock_db.get_user_events.return_value = [FAKE_EVENT]
            mock_db.get_events_user_joined.return_value = [FAKE_EVENT]  # same event
            mock_db.get_event_participants.return_value = []
            resp = client.get(BASE)
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1

    def test_list_events_empty(self, client):
        with patch("app.api.events.dynamodb_service") as mock_db:
            mock_db.get_user_events.return_value = []
            mock_db.get_events_user_joined.return_value = []
            resp = client.get(BASE)
        assert resp.status_code == 200
        assert resp.json()["items"] == []


class TestGetEvent:
    def test_get_event_success(self, client):
        with patch("app.api.events.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = FAKE_EVENT
            mock_db.get_event_participants.return_value = [FAKE_PARTICIPANT]
            resp = client.get(f"{BASE}/event-xyz-456")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "event-xyz-456"

    def test_get_event_not_found(self, client):
        with patch("app.api.events.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = None
            resp = client.get(f"{BASE}/nonexistent")
        assert resp.status_code == 404

    def test_get_event_not_participant_returns_403(self, client):
        other_event = {**FAKE_EVENT, "owner_id": "other-user"}
        with patch("app.api.events.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = other_event
            mock_db.get_participant.return_value = None  # current user is not a participant
            resp = client.get(f"{BASE}/event-xyz-456")
        assert resp.status_code == 403


class TestUpdateEvent:
    def test_update_event_success(self, client):
        updated = {**FAKE_EVENT, "name": "Updated Name"}
        with patch("app.api.events.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = FAKE_EVENT
            mock_db.update_event.return_value = True
            mock_db.get_event.side_effect = [FAKE_EVENT, updated]
            mock_db.get_event_participants.return_value = [FAKE_PARTICIPANT]
            resp = client.patch(f"{BASE}/event-xyz-456", json={"name": "Updated Name"})
        assert resp.status_code == 200

    def test_update_event_not_owner_returns_403(self, client):
        other_event = {**FAKE_EVENT, "owner_id": "other-user"}
        with patch("app.api.events.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = other_event
            resp = client.patch(f"{BASE}/event-xyz-456", json={"name": "Hacked"})
        assert resp.status_code == 403


class TestDeleteEvent:
    def test_delete_event_success(self, client):
        with patch("app.api.events.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = FAKE_EVENT
            mock_db.delete_join_code_lookup.return_value = True
            mock_db.delete_event.return_value = True
            resp = client.delete(f"{BASE}/event-xyz-456")
        assert resp.status_code == 204

    def test_delete_event_not_owner_returns_403(self, client):
        other_event = {**FAKE_EVENT, "owner_id": "other-user"}
        with patch("app.api.events.dynamodb_service") as mock_db:
            mock_db.get_event.return_value = other_event
            resp = client.delete(f"{BASE}/event-xyz-456")
        assert resp.status_code == 403


class TestJoinEvent:
    def test_join_event_success(self, client):
        with patch("app.api.events.dynamodb_service") as mock_db:
            mock_db.get_event_by_join_code.return_value = {**FAKE_EVENT, "event_id": "event-new"}
            mock_db.get_participant.return_value = None
            mock_db.add_event_participant.return_value = True
            resp = client.post(f"{BASE}/join", json={"join_code": "ABCDEF"})
        assert resp.status_code == 200
        data = resp.json()
        assert "event" in data
        assert data["status"] == "approved"

    def test_join_event_invalid_code(self, client):
        with patch("app.api.events.dynamodb_service") as mock_db:
            mock_db.get_event_by_join_code.return_value = None
            resp = client.post(f"{BASE}/join", json={"join_code": "XXXXXX"})
        assert resp.status_code == 404

    def test_join_event_already_participant(self, client):
        with patch("app.api.events.dynamodb_service") as mock_db:
            mock_db.get_event_by_join_code.return_value = FAKE_EVENT
            mock_db.get_participant.return_value = FAKE_PARTICIPANT
            resp = client.post(f"{BASE}/join", json={"join_code": "TEST01"})
        assert resp.status_code == 400
        assert "already a participant" in resp.json()["detail"].lower()
