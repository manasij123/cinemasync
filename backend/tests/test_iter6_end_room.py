"""
Iteration 6 – End Room + Room Name customization tests.
Covers:
  A. Host can DELETE /api/rooms/{id} -> 200 {ok, room_id}; GET -> 404
  B. Non-host DELETE -> 403 "Only host can end the room"
  D. POST /api/rooms with optional custom_title, echoed back; GET returns custom_title
  G. After termination: /rooms/active drops the room, /rooms/history still has it with is_active:false
  Back-compat: creating room without custom_title still works
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://playback-sync-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "manasijmandal1999@gmail.com", "password": "Manasij@081199"}


def _client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(email, password):
    s = _client()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


def _register_and_login(name_prefix="guest"):
    s = _client()
    tag = uuid.uuid4().hex[:8]
    email = f"{name_prefix}_{tag}@cinemasync.co.in"
    password = "test1234"
    name = f"{name_prefix.capitalize()}{tag}"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": password, "name": name})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return s, {"email": email, "password": password, "name": name}


@pytest.fixture(scope="module")
def host_client():
    return _login(ADMIN["email"], ADMIN["password"])


@pytest.fixture(scope="module")
def guest_client_and_user():
    return _register_and_login("guest")


# ---------- D. custom_title round-trip ----------
class TestRoomNameCustomTitle:
    def test_create_room_with_custom_title(self, host_client):
        pw = "pw12345"
        r = host_client.post(f"{API}/rooms", json={
            "name": "Netflix · Stranger Things",
            "password": pw,
            "platform": "netflix",
            "custom_title": "Stranger Things",
        })
        assert r.status_code == 200, r.text
        room = r.json()["room"]
        assert room["custom_title"] == "Stranger Things"
        assert room["platform"] == "netflix"
        assert room["name"].startswith("Netflix")
        rid = room["id"]

        g = host_client.get(f"{API}/rooms/{rid}")
        assert g.status_code == 200
        assert g.json()["room"]["custom_title"] == "Stranger Things"

        # cleanup
        host_client.delete(f"{API}/rooms/{rid}")

    def test_create_room_without_custom_title_backcompat(self, host_client):
        r = host_client.post(f"{API}/rooms", json={
            "name": "Custom Watch Party",
            "password": "pw12345",
            "platform": "custom",
        })
        assert r.status_code == 200, r.text
        room = r.json()["room"]
        # optional field — may be None or absent, but should not error
        assert room.get("custom_title") in (None, "")
        rid = room["id"]
        host_client.delete(f"{API}/rooms/{rid}")

    def test_custom_title_max_length_80_enforced(self, host_client):
        long_title = "x" * 81
        r = host_client.post(f"{API}/rooms", json={
            "name": "Prime · " + long_title,
            "password": "pw12345",
            "platform": "prime",
            "custom_title": long_title,
        })
        assert r.status_code in (400, 422), f"expected validation error, got {r.status_code}"


# ---------- A/B/G. end-room permissions + purge + listings ----------
class TestEndRoom:
    def test_full_flow_host_ends_room(self, host_client, guest_client_and_user):
        guest_s, guest_info = guest_client_and_user
        pw = "pw12345"
        # host creates
        r = host_client.post(f"{API}/rooms", json={
            "name": "Netflix · End Test",
            "password": pw, "platform": "netflix", "custom_title": "End Test",
        })
        assert r.status_code == 200
        rid = r.json()["room"]["id"]

        # guest joins
        jr = guest_s.post(f"{API}/rooms/join", json={"room_id": rid, "password": pw})
        assert jr.status_code == 200, jr.text

        # B. non-host delete -> 403
        bad = guest_s.delete(f"{API}/rooms/{rid}")
        assert bad.status_code == 403, f"expected 403, got {bad.status_code} {bad.text}"
        assert "host" in bad.json().get("detail", "").lower()

        # A. host delete -> 200 {ok,room_id}
        d = host_client.delete(f"{API}/rooms/{rid}")
        assert d.status_code == 200, d.text
        body = d.json()
        assert body.get("ok") is True
        assert body.get("room_id") == rid

        # GET after delete -> 404
        g = host_client.get(f"{API}/rooms/{rid}")
        assert g.status_code == 404

        # G. /rooms/active no longer includes it (for both host & guest)
        a_host = host_client.get(f"{API}/rooms/active").json()["rooms"]
        assert not any(x["id"] == rid for x in a_host)
        a_guest = guest_s.get(f"{API}/rooms/active").json()["rooms"]
        assert not any(x["id"] == rid for x in a_guest)

        # G. /rooms/history still contains it with is_active:false (host side)
        h = host_client.get(f"{API}/rooms/history").json()["history"]
        match = [x for x in h if x["room_id"] == rid]
        assert len(match) >= 1, "history entry should persist after room end"
        assert match[0]["is_active"] is False

    def test_delete_nonexistent_room_404(self, host_client):
        r = host_client.delete(f"{API}/rooms/DOESNOTEX")
        assert r.status_code == 404

    def test_delete_unauth(self):
        s = _client()
        r = s.delete(f"{API}/rooms/XXXXXXXX")
        assert r.status_code in (401, 403)


# ---------- quick regression: existing flows still work ----------
class TestRegression:
    def test_auth_me(self, host_client):
        r = host_client.get(f"{API}/auth/me")
        assert r.status_code == 200

    def test_active_rooms_listing(self, host_client):
        r = host_client.get(f"{API}/rooms/active")
        assert r.status_code == 200
        assert "rooms" in r.json()
