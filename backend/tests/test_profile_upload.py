"""
CinemaSync Iteration 3 Tests
- Profile picture upload via Emergent Object Storage (POST /api/profile/picture)
- File serving (GET /api/files/{path})
- Regression: PATCH /api/profile, auth, rooms, friends, notifications, admin/stats
"""
import io
import os
import uuid

import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_EMAIL = "manasijmandal1999@gmail.com"
ADMIN_PASSWORD = "Manasij@081199"


# -------------- helpers --------------
def fresh_session():
    s = requests.Session()
    return s


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def register_user(session, prefix="TEST_upload"):
    uid = uuid.uuid4().hex[:8]
    payload = {
        "email": f"{prefix}_{uid}@test.com",
        "password": "testpass123",
        "name": f"{prefix}{uid}",
    }
    r = session.post(f"{BASE_URL}/api/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.text}"
    data = r.json()
    return data["user"], data["token"]


def make_png_bytes(size_px=64, compress=6):
    img = Image.new("RGB", (size_px, size_px), (120, 80, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG", compress_level=compress)
    return buf.getvalue()


def make_large_png_bytes(target_bytes=10 * 1024 * 1024 + 512 * 1024):
    """Random-noise PNG to defeat compression, sized > 10MB."""
    import random
    # 2500x2500 random-noise RGB => ~18-19MB PNG at compress_level=1
    px = 2500
    rnd = random.Random(42)
    raw = bytes(rnd.randint(0, 255) for _ in range(px * px * 3))
    img = Image.frombytes("RGB", (px, px), raw)
    buf = io.BytesIO()
    img.save(buf, format="PNG", compress_level=1)
    data = buf.getvalue()
    assert len(data) > target_bytes, f"only {len(data)} bytes, need > {target_bytes}"
    return data


# -------------- Profile picture upload --------------
class TestProfilePictureUpload:
    def test_upload_valid_png(self):
        s = fresh_session()
        user, token = register_user(s, "TEST_up_png")
        png = make_png_bytes()
        files = {"file": ("avatar.png", png, "image/png")}
        r = s.post(f"{BASE_URL}/api/profile/picture", files=files, headers=auth_headers(token))
        assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
        body = r.json()
        assert "user" in body and "url" in body and "size" in body
        assert body["url"].startswith("/api/files/"), f"bad url: {body['url']}"
        assert body["size"] == len(png)
        assert body["user"]["profile_image"] == body["url"]

    def test_upload_jpg(self):
        s = fresh_session()
        user, token = register_user(s, "TEST_up_jpg")
        img = Image.new("RGB", (32, 32), (200, 100, 50))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        jpg = buf.getvalue()
        files = {"file": ("avatar.jpg", jpg, "image/jpeg")}
        r = s.post(f"{BASE_URL}/api/profile/picture", files=files, headers=auth_headers(token))
        assert r.status_code == 200, r.text
        assert r.json()["url"].startswith("/api/files/")

    def test_upload_rejects_non_image(self):
        s = fresh_session()
        user, token = register_user(s, "TEST_up_txt")
        files = {"file": ("note.txt", b"hello world", "text/plain")}
        r = s.post(f"{BASE_URL}/api/profile/picture", files=files, headers=auth_headers(token))
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        assert "JPG" in r.text or "image" in r.text.lower()

    def test_upload_rejects_svg(self):
        s = fresh_session()
        user, token = register_user(s, "TEST_up_svg")
        svg = b"<svg xmlns='http://www.w3.org/2000/svg'/>"
        files = {"file": ("icon.svg", svg, "image/svg+xml")}
        r = s.post(f"{BASE_URL}/api/profile/picture", files=files, headers=auth_headers(token))
        assert r.status_code == 400, f"expected 400 for svg, got {r.status_code}"

    def test_upload_rejects_oversize(self):
        s = fresh_session()
        user, token = register_user(s, "TEST_up_big")
        big = make_large_png_bytes()
        files = {"file": ("big.png", big, "image/png")}
        r = s.post(f"{BASE_URL}/api/profile/picture", files=files, headers=auth_headers(token))
        assert r.status_code == 413, f"expected 413, got {r.status_code}: {r.text[:300]}"
        assert "10" in r.text

    def test_upload_requires_auth(self):
        s = fresh_session()
        png = make_png_bytes()
        files = {"file": ("avatar.png", png, "image/png")}
        r = s.post(f"{BASE_URL}/api/profile/picture", files=files)
        assert r.status_code == 401

    def test_serve_file_and_auth(self):
        s = fresh_session()
        user, token = register_user(s, "TEST_srv")
        png = make_png_bytes()
        files = {"file": ("avatar.png", png, "image/png")}
        up = s.post(f"{BASE_URL}/api/profile/picture", files=files, headers=auth_headers(token))
        assert up.status_code == 200, up.text
        url = up.json()["url"]

        # Authenticated fetch -> 200 with image bytes
        r = s.get(f"{BASE_URL}{url}", headers=auth_headers(token))
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("image/"), r.headers.get("content-type")
        assert len(r.content) == len(png)

        # Unauthenticated -> 401
        s2 = fresh_session()
        r2 = s2.get(f"{BASE_URL}{url}")
        assert r2.status_code == 401, f"expected 401, got {r2.status_code}"


# -------------- PATCH /api/profile regression --------------
class TestProfilePatch:
    def test_patch_name_only_regenerates_unique_id(self):
        s = fresh_session()
        user, token = register_user(s, "TEST_patch")
        original_uid = user["unique_id"]
        r = s.patch(
            f"{BASE_URL}/api/profile",
            json={"name": "NewDisplayName"},
            headers=auth_headers(token),
        )
        assert r.status_code == 200, r.text
        fresh = r.json()["user"]
        assert fresh["name"] == "NewDisplayName"
        assert fresh["unique_id"].startswith("CinemaSync_NewDisplayName_"), fresh["unique_id"]
        assert fresh["unique_id"] != original_uid


# -------------- Regression: auth / rooms / friends / admin --------------
class TestRegressionCore:
    def test_auth_me(self):
        s = fresh_session()
        user, token = register_user(s, "TEST_me")
        r = s.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["user"]["id"] == user["id"]

    def test_logout_unauth_fallback_header(self):
        s = fresh_session()
        r = s.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_room_create_join_active_leave(self):
        host_s = fresh_session()
        joiner_s = fresh_session()
        host, host_tok = register_user(host_s, "TEST_rhost")
        joiner, join_tok = register_user(joiner_s, "TEST_rjoin")

        # create
        c = host_s.post(
            f"{BASE_URL}/api/rooms",
            json={"name": "TEST_Room", "password": "pw123", "platform": "netflix"},
            headers=auth_headers(host_tok),
        )
        assert c.status_code == 200, c.text
        room = c.json()["room"]

        # join
        j = joiner_s.post(
            f"{BASE_URL}/api/rooms/join",
            json={"room_id": room["id"], "password": "pw123"},
            headers=auth_headers(join_tok),
        )
        assert j.status_code == 200, j.text

        # active for joiner
        a = joiner_s.get(f"{BASE_URL}/api/rooms/active", headers=auth_headers(join_tok))
        assert a.status_code == 200
        assert room["id"] in [r["id"] for r in a.json()["rooms"]]

        # leave
        lv = joiner_s.post(
            f"{BASE_URL}/api/rooms/{room['id']}/leave", headers=auth_headers(join_tok)
        )
        assert lv.status_code == 200

    def test_friends_search_request_accept(self):
        s1 = fresh_session()
        s2 = fresh_session()
        u1, t1 = register_user(s1, "TEST_f1")
        u2, t2 = register_user(s2, "TEST_f2")

        r = s1.get(
            f"{BASE_URL}/api/friends/search",
            params={"unique_id": u2["unique_id"]},
            headers=auth_headers(t1),
        )
        assert r.status_code == 200 and r.json()["user"]["id"] == u2["id"]

        r = s1.post(
            f"{BASE_URL}/api/friends/request",
            json={"unique_id": u2["unique_id"]},
            headers=auth_headers(t1),
        )
        assert r.status_code == 200

        r = s2.post(
            f"{BASE_URL}/api/friends/accept",
            json={"user_id": u1["id"]},
            headers=auth_headers(t2),
        )
        assert r.status_code == 200

        r = s1.get(f"{BASE_URL}/api/friends", headers=auth_headers(t1))
        assert r.status_code == 200
        assert any(f["id"] == u2["id"] for f in r.json()["friends"])

    def test_notifications_list(self):
        s = fresh_session()
        u, t = register_user(s, "TEST_n")
        r = s.get(f"{BASE_URL}/api/notifications", headers=auth_headers(t))
        assert r.status_code == 200
        assert "notifications" in r.json()

    def test_admin_stats(self):
        s = fresh_session()
        r = s.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        if r.status_code != 200:
            pytest.skip(f"admin login failed: {r.status_code}")
        tok = r.json()["token"]
        assert r.json()["user"].get("is_admin") is True
        rs = s.get(f"{BASE_URL}/api/admin/stats", headers=auth_headers(tok))
        assert rs.status_code == 200, rs.text
        data = rs.json()
        for k in ["total_users", "total_rooms", "total_messages", "total_notifications"]:
            assert k in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
