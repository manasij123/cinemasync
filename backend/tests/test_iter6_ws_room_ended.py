"""WebSocket room-ended broadcast end-to-end test.
Host creates room + connects WS, guest joins + connects WS.
Host DELETEs the room. Both sockets must receive a {type: 'room-ended'} frame
with by_name, room_id, ended_at populated.
"""
import asyncio
import json
import os
import uuid
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://playback-sync-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws/room"

ADMIN = {"email": "manasijmandal1999@gmail.com", "password": "Manasij@081199"}


def _login_token(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"], r.cookies


def _register(email, password, name):
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": password, "name": name})
    assert r.status_code == 200, r.text
    return r.json()["token"]


async def _collect_ws(url, events, label, stop_after=8.0):
    try:
        async with websockets.connect(url, open_timeout=10, close_timeout=5) as ws:
            end = asyncio.get_event_loop().time() + stop_after
            while asyncio.get_event_loop().time() < end:
                remaining = end - asyncio.get_event_loop().time()
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
                    data = json.loads(raw)
                    events.append((label, data))
                    if data.get("type") == "room-ended":
                        return
                except asyncio.TimeoutError:
                    return
                except websockets.ConnectionClosed:
                    return
    except Exception as e:
        events.append((label, {"error": str(e)}))


@pytest.mark.asyncio
async def test_room_ended_ws_broadcast():
    host_token, _ = _login_token(ADMIN["email"], ADMIN["password"])
    tag = uuid.uuid4().hex[:8]
    guest_email = f"guest_{tag}@cinemasync.co.in"
    guest_token = _register(guest_email, "test1234", f"Guest{tag}")

    # Host creates room
    r = requests.post(
        f"{API}/rooms",
        json={"name": "Netflix · WS Test", "password": "pw12345", "platform": "netflix", "custom_title": "WS Test"},
        headers={"Authorization": f"Bearer {host_token}"},
        cookies={"access_token": host_token},
    )
    assert r.status_code == 200, r.text
    rid = r.json()["room"]["id"]

    # Guest joins
    jr = requests.post(
        f"{API}/rooms/join",
        json={"room_id": rid, "password": "pw12345"},
        headers={"Authorization": f"Bearer {guest_token}"},
        cookies={"access_token": guest_token},
    )
    assert jr.status_code == 200, jr.text

    host_events, guest_events = [], []
    host_ws_url = f"{WS_BASE}/{rid}?token={host_token}"
    guest_ws_url = f"{WS_BASE}/{rid}?token={guest_token}"

    async def host_task():
        await _collect_ws(host_ws_url, host_events, "host")

    async def guest_task():
        await _collect_ws(guest_ws_url, guest_events, "guest")

    async def terminate_after_delay():
        await asyncio.sleep(2.0)  # let both sockets connect + hello
        rr = requests.delete(
            f"{API}/rooms/{rid}",
            headers={"Authorization": f"Bearer {host_token}"},
            cookies={"access_token": host_token},
        )
        assert rr.status_code == 200, rr.text
        body = rr.json()
        assert body.get("ok") is True and body.get("room_id") == rid

    await asyncio.gather(host_task(), guest_task(), terminate_after_delay())

    # Validate both received room-ended frame
    host_ended = [e for (_, e) in host_events if e.get("type") == "room-ended"]
    guest_ended = [e for (_, e) in guest_events if e.get("type") == "room-ended"]

    assert host_ended, f"host never got room-ended. events={host_events}"
    assert guest_ended, f"guest never got room-ended. events={guest_events}"
    for ev in host_ended + guest_ended:
        assert ev["room_id"] == rid
        assert "by_name" in ev and ev["by_name"]
        assert "ended_at" in ev and ev["ended_at"]

    # Room is gone
    g = requests.get(f"{API}/rooms/{rid}",
                     headers={"Authorization": f"Bearer {host_token}"},
                     cookies={"access_token": host_token})
    assert g.status_code == 404
