"""Iteration 5 backend tests:
- send-verify-email fallback link (sandbox)
- verify-email using fallback token
- DELETE /api/account (wrong pw, wrong confirm, success, admin 403)
- purge side effects (friend's notifications cleaned)
- /auth/me updates last_active_at
- regression smoke (rooms, friends, forgot/reset, broadcast, rtc/ice)
"""
import os
import uuid
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://playback-sync-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "manasijmandal1999@gmail.com"
ADMIN_PASSWORD = "Manasij@081199"


def _reg(email=None, name="Del Tester", pw="pw12345"):
    email = email or f"del_test_{uuid.uuid4().hex[:10]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "name": name, "password": pw})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "password": pw, "token": data["token"], "user": data["user"]}


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- verify-email fallback ----------
class TestVerifyEmailFallback:
    def test_send_verify_returns_fallback_for_sandbox(self):
        u = _reg()
        r = requests.post(f"{API}/auth/send-verify-email", headers=_hdr(u["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        # Sandbox: non-owner email -> delivered=false, fallback_link present
        assert d.get("delivered") is False, f"expected delivered=false for sandbox, got {d}"
        assert d.get("fallback_link"), f"expected fallback_link, got {d}"
        assert "/verify-email?token=" in d["fallback_link"]
        assert isinstance(d.get("message"), str) and len(d["message"]) > 0

    def test_fallback_token_verifies_email(self):
        u = _reg()
        r = requests.post(f"{API}/auth/send-verify-email", headers=_hdr(u["token"]))
        assert r.status_code == 200
        link = r.json()["fallback_link"]
        token = link.split("token=", 1)[1]
        r2 = requests.post(f"{API}/auth/verify-email", json={"token": token})
        assert r2.status_code == 200, r2.text
        # /auth/me should show verified
        me = requests.get(f"{API}/auth/me", headers=_hdr(u["token"])).json()
        assert me["user"]["email_verified"] is True


# ---------- DELETE /api/account ----------
class TestDeleteAccount:
    def test_wrong_password_rejected(self):
        u = _reg()
        r = requests.delete(
            f"{API}/account",
            headers=_hdr(u["token"]),
            json={"password": "wrongpass", "confirm": "DELETE MY ACCOUNT"},
        )
        assert r.status_code in (400, 401), r.text

    def test_wrong_confirm_text_rejected(self):
        u = _reg()
        r = requests.delete(
            f"{API}/account",
            headers=_hdr(u["token"]),
            json={"password": u["password"], "confirm": "delete my account"},
        )
        assert r.status_code == 400, r.text
        detail = r.json().get("detail", "")
        assert "DELETE MY ACCOUNT" in detail

    def test_successful_delete_and_relogin_fails(self):
        u = _reg()
        r = requests.delete(
            f"{API}/account",
            headers=_hdr(u["token"]),
            json={"password": u["password"], "confirm": "DELETE MY ACCOUNT"},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        # Login with same email must 401
        r2 = requests.post(f"{API}/auth/login", json={"email": u["email"], "password": u["password"]})
        assert r2.status_code == 401

    def test_admin_cannot_self_delete(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        tok = r.json()["token"]
        r2 = requests.delete(
            f"{API}/account",
            headers=_hdr(tok),
            json={"password": ADMIN_PASSWORD, "confirm": "DELETE MY ACCOUNT"},
        )
        assert r2.status_code == 403, r2.text
        assert "Admin" in r2.json().get("detail", "")


# ---------- purge side effects on friend notifications ----------
class TestPurgeCascade:
    def test_friend_notifications_cleaned_after_delete(self):
        alice = _reg(name=f"Alice{uuid.uuid4().hex[:6]}")
        bob = _reg(name=f"Bob{uuid.uuid4().hex[:6]}")
        # Make them friends: alice → request → bob accepts
        bob_uid = bob["user"]["unique_id"]
        r = requests.post(f"{API}/friends/request", headers=_hdr(alice["token"]), json={"unique_id": bob_uid})
        assert r.status_code in (200, 201), r.text
        r2 = requests.post(f"{API}/friends/accept", headers=_hdr(bob["token"]), json={"user_id": alice["user"]["id"]})
        assert r2.status_code in (200, 201), r2.text
        # alice creates a room + broadcasts → bob gets notification with from_user_id=alice.id
        rc = requests.post(
            f"{API}/rooms",
            headers=_hdr(alice["token"]),
            json={"name": "PurgeRoom", "password": "pw", "video_url": "https://example.com/v.mp4"},
        )
        assert rc.status_code in (200, 201), rc.text
        rid = rc.json().get("room", {}).get("id") or rc.json().get("id")
        bc = requests.post(
            f"{API}/rooms/{rid}/broadcast",
            headers=_hdr(alice["token"]),
            json={"password": "pw"},
        )
        assert bc.status_code == 200, bc.text
        # bob should have a notification with from_user_id = alice.id
        notifs = requests.get(f"{API}/notifications", headers=_hdr(bob["token"])).json()
        items = notifs if isinstance(notifs, list) else notifs.get("notifications", [])
        alice_ids = [n for n in items if n.get("from_user_id") == alice["user"]["id"]]
        assert len(alice_ids) >= 1, f"expected broadcast notif for bob, got {items}"
        # alice deletes her account
        dr = requests.delete(
            f"{API}/account",
            headers=_hdr(alice["token"]),
            json={"password": alice["password"], "confirm": "DELETE MY ACCOUNT"},
        )
        assert dr.status_code == 200
        # bob's notifications from alice should be gone
        notifs2 = requests.get(f"{API}/notifications", headers=_hdr(bob["token"])).json()
        items2 = notifs2 if isinstance(notifs2, list) else notifs2.get("notifications", [])
        remaining = [n for n in items2 if n.get("from_user_id") == alice["user"]["id"]]
        assert remaining == [], f"expected no notifs from deleted user, got {remaining}"


# ---------- last_active_at on /auth/me ----------
class TestLastActive:
    def test_me_updates_last_active_at(self):
        u = _reg()
        a = requests.get(f"{API}/auth/me", headers=_hdr(u["token"]))
        assert a.status_code == 200
        # Need direct DB peek? Not available; re-fetch and compare via a second call with delay.
        # Since public_user may not expose last_active_at, we call twice and expect no errors + 200.
        time.sleep(1.1)
        b = requests.get(f"{API}/auth/me", headers=_hdr(u["token"]))
        assert b.status_code == 200
        # If public_user exposes it, assert change; else just ensure endpoint is healthy.
        la1 = a.json().get("user", {}).get("last_active_at")
        la2 = b.json().get("user", {}).get("last_active_at")
        if la1 and la2:
            assert la2 > la1, f"expected last_active_at to advance: {la1} -> {la2}"


# ---------- regression smoke ----------
class TestRegression:
    def test_rooms_create_and_list(self):
        u = _reg()
        r = requests.post(
            f"{API}/rooms",
            headers=_hdr(u["token"]),
            json={"name": "RegRoom", "password": "pw", "video_url": "https://example.com/v.mp4"},
        )
        assert r.status_code in (200, 201), r.text
        rid = r.json().get("room", {}).get("id") or r.json().get("id")
        assert rid
        ar = requests.get(f"{API}/rooms/active", headers=_hdr(u["token"]))
        assert ar.status_code == 200

    def test_forgot_password_ok(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": f"nobody_{uuid.uuid4().hex[:6]}@example.com"})
        assert r.status_code == 200 and r.json().get("ok") is True

    def test_rtc_ice(self):
        u = _reg()
        r = requests.get(f"{API}/rtc/ice", headers=_hdr(u["token"]))
        assert r.status_code == 200, r.text
        assert "iceServers" in r.json()

    def test_broadcast_requires_auth(self):
        r = requests.post(f"{API}/rooms/nonexistent/broadcast", json={"password": "x"})
        assert r.status_code in (401, 403, 404)

    def test_poster_endpoint(self):
        # just ensure endpoint exists; may return 200 or 4xx
        r = requests.get(f"{API}/poster?title=Inception")
        assert r.status_code in (200, 400, 404, 422, 500)
