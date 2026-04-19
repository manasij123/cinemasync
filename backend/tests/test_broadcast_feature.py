"""Tests for POST /api/rooms/{id}/broadcast and regression for auth/rooms."""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://playback-sync-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _register(email, password="pw12345", name="T"):
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": password, "name": name})
    assert r.status_code == 200, r.text
    return r.json()["token"], r.json()["user"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def _friend_pair():
    ts = uuid.uuid4().hex[:10]
    host_tok, host = _register(f"host_{ts}@example.com", name=f"Hostie{ts[:5]}")
    f1_tok, f1 = _register(f"f1_{ts}@example.com", name=f"Friend1{ts[:5]}")
    f2_tok, f2 = _register(f"f2_{ts}@example.com", name=f"Friend2{ts[:5]}")
    non_tok, non = _register(f"non_{ts}@example.com", name=f"Nonpart{ts[:5]}")

    # host sends friend requests to f1 and f2 then accept
    for fu in (f1, f2):
        r = requests.post(f"{API}/friends/request", json={"unique_id": fu["unique_id"]}, headers=_h(host_tok))
        assert r.status_code == 200
    for ftok, fu in ((f1_tok, f1), (f2_tok, f2)):
        r = requests.post(f"{API}/friends/accept", json={"user_id": host["id"]}, headers=_h(ftok))
        assert r.status_code == 200

    return {
        "host": (host_tok, host),
        "f1": (f1_tok, f1),
        "f2": (f2_tok, f2),
        "non": (non_tok, non),
    }


def _create_room(host_tok, password="secret"):
    r = requests.post(f"{API}/rooms", json={"name": "Party", "password": password, "platform": "netflix"}, headers=_h(host_tok))
    assert r.status_code == 200, r.text
    return r.json()["room"]


class TestBroadcast:
    def test_broadcast_success_sends_to_all_friends(self):
        ctx = _friend_pair()
        host_tok, host = ctx["host"]
        room = _create_room(host_tok, password="secret")

        r = requests.post(f"{API}/rooms/{room['id']}/broadcast", json={"password": "secret"}, headers=_h(host_tok))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["sent"] == 2  # host has 2 friends

        # each friend sees a fresh notification
        for key in ("f1", "f2"):
            ftok, fu = ctx[key]
            nr = requests.get(f"{API}/notifications", headers=_h(ftok))
            assert nr.status_code == 200
            notifs = nr.json()["notifications"]
            matches = [n for n in notifs if n.get("room_id") == room["id"] and n.get("type") == "room-invite"]
            assert len(matches) >= 1
            n = matches[0]
            assert n["password"] == "secret"
            assert n["from_user_id"] == host["id"]
            assert n["from_name"] == host["name"]
            assert n["read"] is False

    def test_broadcast_wrong_password_401(self):
        ctx = _friend_pair()
        host_tok, _ = ctx["host"]
        room = _create_room(host_tok, password="secret")
        r = requests.post(f"{API}/rooms/{room['id']}/broadcast", json={"password": "WRONG"}, headers=_h(host_tok))
        assert r.status_code == 401

    def test_broadcast_non_participant_403(self):
        ctx = _friend_pair()
        host_tok, _ = ctx["host"]
        non_tok, _ = ctx["non"]
        room = _create_room(host_tok, password="secret")
        r = requests.post(f"{API}/rooms/{room['id']}/broadcast", json={"password": "secret"}, headers=_h(non_tok))
        assert r.status_code == 403

    def test_broadcast_no_friends_returns_zero(self):
        ts = uuid.uuid4().hex[:10]
        tok, _ = _register(f"lonely_{ts}@example.com")
        r_room = requests.post(f"{API}/rooms", json={"name": "Solo", "password": "p", "platform": "custom"}, headers=_h(tok))
        room = r_room.json()["room"]
        r = requests.post(f"{API}/rooms/{room['id']}/broadcast", json={"password": "p"}, headers=_h(tok))
        assert r.status_code == 200
        assert r.json()["sent"] == 0


class TestRegression:
    """Quick regression for core flows."""

    def test_register_and_me(self):
        ts = uuid.uuid4().hex[:10]
        tok, user = _register(f"reg_{ts}@example.com", name="Reggie")
        r = requests.get(f"{API}/auth/me", headers=_h(tok))
        assert r.status_code == 200
        assert r.json()["user"]["email"] == f"reg_{ts}@example.com"

    def test_login_admin(self):
        r = requests.post(f"{API}/auth/login", json={"email": "manasijmandal1999@gmail.com", "password": "Manasij@081199"})
        assert r.status_code == 200
        assert r.json()["user"]["is_admin"] is True

    def test_room_create_join_active_history(self):
        ts = uuid.uuid4().hex[:10]
        tok, _ = _register(f"rc_{ts}@example.com")
        tok2, _ = _register(f"rc2_{ts}@example.com")
        room = _create_room(tok, password="pw")

        # join
        r = requests.post(f"{API}/rooms/join", json={"room_id": room["id"], "password": "pw"}, headers=_h(tok2))
        assert r.status_code == 200

        # active
        r = requests.get(f"{API}/rooms/active", headers=_h(tok))
        assert r.status_code == 200
        assert any(rr["id"] == room["id"] for rr in r.json()["rooms"])

        # history
        r = requests.get(f"{API}/rooms/history", headers=_h(tok))
        assert r.status_code == 200
        assert any(h["room_id"] == room["id"] for h in r.json()["history"])

    def test_promote_demote(self):
        ts = uuid.uuid4().hex[:10]
        htok, host = _register(f"ph_{ts}@example.com")
        gtok, guest = _register(f"pg_{ts}@example.com")
        room = _create_room(htok, password="pp")
        requests.post(f"{API}/rooms/join", json={"room_id": room["id"], "password": "pp"}, headers=_h(gtok))
        r = requests.post(f"{API}/rooms/{room['id']}/promote", json={"user_id": guest["id"]}, headers=_h(htok))
        assert r.status_code == 200
        assert guest["id"] in r.json()["room"]["co_hosts"]
        r = requests.post(f"{API}/rooms/{room['id']}/demote", json={"user_id": guest["id"]}, headers=_h(htok))
        assert r.status_code == 200
        assert guest["id"] not in r.json()["room"]["co_hosts"]

    def test_rtc_ice(self):
        ts = uuid.uuid4().hex[:10]
        tok, _ = _register(f"ice_{ts}@example.com")
        r = requests.get(f"{API}/rtc/ice", headers=_h(tok))
        assert r.status_code == 200
        assert isinstance(r.json()["iceServers"], list) and len(r.json()["iceServers"]) >= 1

    def test_forgot_password_generic(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": "nobody@example.com"})
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_reset_password_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "zz", "new_password": "abcdef"})
        assert r.status_code == 400

    def test_verify_email_invalid_token(self):
        r = requests.post(f"{API}/auth/verify-email", json={"token": "zz"})
        assert r.status_code == 400
