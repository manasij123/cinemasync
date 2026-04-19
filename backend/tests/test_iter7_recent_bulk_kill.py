"""Iteration 7 — Recent-rooms bulk kill + admin-alert notification cascade.

Covers:
- DELETE /api/rooms/history/{room_id}: 404, guest-row-only, host cascade, admin alert
- POST /api/rooms/history/bulk-delete: dedupe, mixed host/guest, cap, response schema
- admin-alert notification schema + exclusion of actor
- Guest cascade: guest's /rooms/history no longer contains room after host kills it
- Existing DELETE /api/rooms/{id} end-room flow must NOT fire admin-alert (regression)
"""
import os
import uuid
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://playback-sync-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "manasijmandal1999@gmail.com"
ADMIN_PASS = "Manasij@081199"


# -------------------- helpers --------------------
def _sess():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register(name_prefix="host"):
    s = _sess()
    email = f"{name_prefix}_{uuid.uuid4().hex[:8]}@cinemasync.co.in"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "test1234", "name": name_prefix.title()})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s, data["user"], data["token"], email


def _login(email, password):
    s = _sess()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s, data["user"], data["token"]


def _create_room(sess, name="TEST_room", password="pw1234", platform="custom"):
    r = sess.post(f"{API}/rooms", json={"name": name, "password": password, "platform": platform})
    assert r.status_code == 200, f"create room: {r.status_code} {r.text}"
    return r.json()["room"]


def _join_room(sess, rid, password="pw1234"):
    r = sess.post(f"{API}/rooms/join", json={"room_id": rid, "password": password})
    assert r.status_code == 200, f"join room: {r.status_code} {r.text}"
    return r.json()["room"]


def _history_ids(sess):
    r = sess.get(f"{API}/rooms/history")
    assert r.status_code == 200, r.text
    return [h["room_id"] for h in r.json().get("history", [])]


# -------------------- A. DELETE /api/rooms/history/{room_id} --------------------
class TestDeleteHistoryEntry:
    def test_404_for_nonexistent_history(self):
        sess, *_ = _register("host")
        r = sess.delete(f"{API}/rooms/history/NOPE{uuid.uuid4().hex[:4].upper()}")
        assert r.status_code == 404, r.text
        assert "not found" in r.json().get("detail", "").lower()

    def test_guest_delete_only_removes_own_row(self):
        host_sess, host_user, *_ = _register("host")
        guest_sess, guest_user, *_ = _register("guest")
        room = _create_room(host_sess, name="TEST_guest_only")
        rid = room["id"]
        _join_room(guest_sess, rid)

        # Guest deletes → should NOT cascade
        r = guest_sess.delete(f"{API}/rooms/history/{rid}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body == {"ok": True, "cascaded": False, "room_id": rid}

        # Guest history no longer has it
        assert rid not in _history_ids(guest_sess)
        # Host history still has it (no cascade)
        assert rid in _history_ids(host_sess)
        # Room still live
        assert host_sess.get(f"{API}/rooms/{rid}").status_code == 200

        # Cleanup — host ends room
        host_sess.delete(f"{API}/rooms/{rid}")

    def test_host_delete_cascades_and_purges(self):
        host_sess, host_user, *_ = _register("host")
        guest_sess, guest_user, *_ = _register("guest")
        room = _create_room(host_sess, name="TEST_cascade")
        rid = room["id"]
        _join_room(guest_sess, rid)
        # Sanity: both have history
        assert rid in _history_ids(host_sess)
        assert rid in _history_ids(guest_sess)

        r = host_sess.delete(f"{API}/rooms/history/{rid}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["cascaded"] is True
        assert body["room_id"] == rid

        # Room gone
        assert host_sess.get(f"{API}/rooms/{rid}").status_code == 404
        # Host + guest history purged
        assert rid not in _history_ids(host_sess)
        assert rid not in _history_ids(guest_sess), "cascade to guest history failed"


# -------------------- C. admin-alert notification semantics --------------------
class TestAdminAlertNotification:
    def test_non_admin_host_kill_creates_admin_alert(self):
        # Fresh non-admin host so the admin receives an alert
        host_sess, host_user, _, host_email = _register("nonadmin_host")
        room = _create_room(host_sess, name="TEST_alert_room")
        rid = room["id"]

        # Admin inbox baseline
        admin_sess, admin_user, _ = _login(ADMIN_EMAIL, ADMIN_PASS)
        before_ids = {n["id"] for n in admin_sess.get(f"{API}/notifications").json().get("notifications", [])}

        # Host kills from Recent
        r = host_sess.delete(f"{API}/rooms/history/{rid}")
        assert r.status_code == 200 and r.json()["cascaded"] is True

        # Admin should now see a new admin-alert for this room
        time.sleep(0.3)
        notifs = admin_sess.get(f"{API}/notifications").json().get("notifications", [])
        new_alerts = [
            n for n in notifs
            if n["id"] not in before_ids and n.get("type") == "admin-alert"
            and n.get("room_id") == rid
        ]
        assert new_alerts, f"no admin-alert found for {rid}; notifs={notifs[:3]}"
        a = new_alerts[0]
        assert a.get("subtype") == "room-killed"
        assert a.get("room_name") == "TEST_alert_room"
        assert a.get("from_user_id") == host_user["id"]
        assert a.get("from_name") == host_user["name"]
        assert "created_at" in a
        assert a.get("read") is False

        # Dismiss via existing DELETE /notifications/{nid}
        nid = a["id"]
        dr = admin_sess.delete(f"{API}/notifications/{nid}")
        assert dr.status_code == 200, dr.text
        # Confirm removed
        after = admin_sess.get(f"{API}/notifications").json().get("notifications", [])
        assert nid not in {n["id"] for n in after}

    def test_admin_actor_does_not_receive_own_alert(self):
        # Admin itself hosts + kills; admin should NOT receive an alert for self.
        admin_sess, admin_user, _ = _login(ADMIN_EMAIL, ADMIN_PASS)
        room = _create_room(admin_sess, name="TEST_admin_self_kill")
        rid = room["id"]
        before_ids = {n["id"] for n in admin_sess.get(f"{API}/notifications").json().get("notifications", [])}

        r = admin_sess.delete(f"{API}/rooms/history/{rid}")
        assert r.status_code == 200 and r.json()["cascaded"] is True

        time.sleep(0.3)
        notifs = admin_sess.get(f"{API}/notifications").json().get("notifications", [])
        self_alerts = [
            n for n in notifs
            if n["id"] not in before_ids and n.get("type") == "admin-alert"
            and n.get("room_id") == rid
        ]
        assert not self_alerts, f"actor admin incorrectly received own alert: {self_alerts}"


# -------------------- B. POST /api/rooms/history/bulk-delete --------------------
class TestBulkDeleteHistory:
    def test_bulk_dedupe_and_mixed_host_guest(self):
        host_sess, host_user, *_ = _register("host")
        guest_sess, *_ = _register("guest")

        # host creates two rooms
        r1 = _create_room(host_sess, name="TEST_bulk_h1")["id"]
        r2 = _create_room(host_sess, name="TEST_bulk_h2")["id"]
        # guest joins both → guest-role history
        _join_room(guest_sess, r1)
        _join_room(guest_sess, r2)
        # a third room hosted by guest for host's history to be "guest-role"
        other = _create_room(guest_sess, name="TEST_bulk_other")["id"]
        _join_room(host_sess, other)

        # From host's perspective: r1, r2 → host-role, other → guest-role
        payload = {"room_ids": [r1, r2, r2, other, "  " + r1.lower() + "  "]}  # dedupe + case-insensitive
        r = host_sess.post(f"{API}/rooms/history/bulk-delete", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        # deleted counts unique rooms from host's own history (3 unique)
        assert body["deleted"] == 3, body
        assert body["cascaded"] == 2, body  # only r1 + r2 were host-role

        # r1, r2 purged globally; `other` still exists (host was guest there)
        assert host_sess.get(f"{API}/rooms/{r1}").status_code == 404
        assert host_sess.get(f"{API}/rooms/{r2}").status_code == 404
        assert guest_sess.get(f"{API}/rooms/{other}").status_code == 200
        # Guest's history for r1,r2 cascaded too
        g_ids = _history_ids(guest_sess)
        assert r1 not in g_ids and r2 not in g_ids
        # host's own history for `other` removed
        assert other not in _history_ids(host_sess)

        # Cleanup
        guest_sess.delete(f"{API}/rooms/{other}")

    def test_bulk_empty_payload(self):
        sess, *_ = _register("host")
        r = sess.post(f"{API}/rooms/history/bulk-delete", json={"room_ids": []})
        assert r.status_code == 200
        assert r.json() == {"ok": True, "deleted": 0, "cascaded": 0}

    def test_bulk_cap_100(self):
        sess, *_ = _register("host")
        # Give bogus 150 ids — none exist; should silently cap + return 0 deleted
        payload = {"room_ids": [f"NOPE{i:04X}" for i in range(150)]}
        r = sess.post(f"{API}/rooms/history/bulk-delete", json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["deleted"] == 0 and b["cascaded"] == 0


# -------------------- D. Cascade verification (guest view) --------------------
class TestGuestCascadeView:
    def test_guest_history_no_longer_has_room_after_host_kill(self):
        host_sess, *_ = _register("host")
        guest_sess, guest_user, *_ = _register("guest")
        room = _create_room(host_sess, name="TEST_guest_cascade")
        rid = room["id"]
        _join_room(guest_sess, rid)
        assert rid in _history_ids(guest_sess)

        # Host kills from Recent
        r = host_sess.delete(f"{API}/rooms/history/{rid}")
        assert r.status_code == 200 and r.json()["cascaded"] is True

        # Guest's /rooms/history no longer lists it
        assert rid not in _history_ids(guest_sess)


# -------------------- G. Regression: End Room via DELETE /rooms/{id} must NOT alert --------------------
class TestEndRoomNoAlertRegression:
    def test_end_room_endpoint_does_not_fire_admin_alert(self):
        host_sess, host_user, *_ = _register("nonadmin_host_end")
        room = _create_room(host_sess, name="TEST_endroom_no_alert")
        rid = room["id"]

        admin_sess, *_ = _login(ADMIN_EMAIL, ADMIN_PASS)
        before = admin_sess.get(f"{API}/notifications").json().get("notifications", [])
        before_ids = {n["id"] for n in before}

        # End via legacy endpoint
        r = host_sess.delete(f"{API}/rooms/{rid}")
        assert r.status_code == 200, r.text

        time.sleep(0.3)
        after = admin_sess.get(f"{API}/notifications").json().get("notifications", [])
        new_alerts = [
            n for n in after
            if n["id"] not in before_ids and n.get("type") == "admin-alert"
            and n.get("room_id") == rid
        ]
        assert not new_alerts, f"End Room endpoint unexpectedly emitted admin-alert: {new_alerts}"
