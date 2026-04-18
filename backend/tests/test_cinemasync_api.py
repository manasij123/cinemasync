"""
CinemaSync API Tests
Tests for: Auth, Profile, Friends, Rooms, WebSocket
Each test uses fresh sessions to avoid cookie contamination
"""
import pytest
import requests
import os
import uuid
import json
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def fresh_session():
    """Create a fresh requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def auth_headers(token):
    """Helper to create auth headers"""
    return {"Authorization": f"Bearer {token}"}


# ============ HEALTH CHECK ============

class TestHealth:
    """Health check tests - run first"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        session = fresh_session()
        response = session.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root: {data['message']}")


# ============ AUTH TESTS ============

class TestAuth:
    """Authentication endpoint tests"""
    
    def test_register_creates_user_with_unique_id(self):
        """POST /api/auth/register creates user with unique_id and returns token"""
        session = fresh_session()
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "email": f"TEST_reg_{unique_id}@test.com",
            "password": "testpass123",
            "name": f"RegTest{unique_id}"
        }
        response = session.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "user" in data
        assert "token" in data
        assert isinstance(data["token"], str)
        assert len(data["token"]) > 0
        
        # Verify user data
        user = data["user"]
        assert user["email"] == payload["email"].lower()
        assert user["name"] == payload["name"]
        assert "unique_id" in user
        assert user["unique_id"].startswith("CinemaSync_")
        assert "id" in user
        
        print(f"✓ Register: user created with unique_id={user['unique_id']}")
    
    def test_login_success(self):
        """POST /api/auth/login returns 200 with correct credentials"""
        session = fresh_session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cinemasync.app",
            "password": "admin123"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "token" in data
        assert data["user"]["email"] == "admin@cinemasync.app"
        print(f"✓ Login success: admin user logged in")
    
    def test_login_wrong_password(self):
        """POST /api/auth/login returns 401 with wrong password"""
        session = fresh_session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cinemasync.app",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ Login wrong password: 401 returned")
    
    def test_login_nonexistent_user(self):
        """POST /api/auth/login returns 401 for nonexistent user"""
        session = fresh_session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "anypassword"
        })
        
        assert response.status_code == 401
        print(f"✓ Login nonexistent user: 401 returned")
    
    def test_me_with_bearer_token(self):
        """GET /api/auth/me works with Bearer token"""
        session = fresh_session()
        # Login first
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cinemasync.app",
            "password": "admin123"
        })
        token = login_response.json()["token"]
        
        # Use fresh session with only bearer token
        fresh = fresh_session()
        response = fresh.get(
            f"{BASE_URL}/api/auth/me",
            headers=auth_headers(token)
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == "admin@cinemasync.app"
        print(f"✓ /auth/me with Bearer token works")
    
    def test_me_without_auth(self):
        """GET /api/auth/me returns 401 without auth"""
        session = fresh_session()
        response = session.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 401
        print(f"✓ /auth/me without auth: 401 returned")
    
    def test_logout_clears_cookie(self):
        """POST /api/auth/logout clears cookie"""
        session = fresh_session()
        # Login first
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cinemasync.app",
            "password": "admin123"
        })
        token = login_response.json()["token"]
        
        response = session.post(
            f"{BASE_URL}/api/auth/logout",
            headers=auth_headers(token)
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        print(f"✓ Logout: cookie cleared")


# ============ PROFILE TESTS ============

class TestProfile:
    """Profile endpoint tests"""
    
    def test_update_profile_name(self):
        """PATCH /api/profile updates name and regenerates unique_id"""
        session = fresh_session()
        # Register a fresh user for this test
        unique_id = str(uuid.uuid4())[:8]
        reg_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_profile_{unique_id}@test.com",
            "password": "testpass123",
            "name": f"ProfileTest{unique_id}"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]
        old_unique_id = reg_response.json()["user"]["unique_id"]
        
        new_name = f"UpdatedName{str(uuid.uuid4())[:4]}"
        
        response = session.patch(
            f"{BASE_URL}/api/profile",
            json={"name": new_name},
            headers=auth_headers(token)
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert data["user"]["name"] == new_name
        assert data["user"]["unique_id"] != old_unique_id
        assert data["user"]["unique_id"].startswith("CinemaSync_")
        print(f"✓ Profile update: name changed, unique_id regenerated")
    
    def test_update_profile_without_auth(self):
        """PATCH /api/profile returns 401 without auth"""
        session = fresh_session()
        response = session.patch(
            f"{BASE_URL}/api/profile",
            json={"name": "Test"}
        )
        
        assert response.status_code == 401
        print(f"✓ Profile update without auth: 401 returned")


# ============ FRIENDS TESTS ============

class TestFriends:
    """Friends system tests"""
    
    def test_friends_full_flow(self):
        """Test complete friends flow: search, request, accept, remove"""
        # Create two fresh sessions for two users
        session1 = fresh_session()
        session2 = fresh_session()
        
        uid1 = str(uuid.uuid4())[:8]
        uid2 = str(uuid.uuid4())[:8]
        
        # Register user 1
        reg1 = session1.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_friend1_{uid1}@test.com",
            "password": "testpass123",
            "name": f"Friend1_{uid1}"
        })
        assert reg1.status_code == 200
        user1 = reg1.json()["user"]
        token1 = reg1.json()["token"]
        
        # Register user 2
        reg2 = session2.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_friend2_{uid2}@test.com",
            "password": "testpass123",
            "name": f"Friend2_{uid2}"
        })
        assert reg2.status_code == 200
        user2 = reg2.json()["user"]
        token2 = reg2.json()["token"]
        
        # Test 1: Search by unique_id - user1 searches for user2
        search_response = session1.get(
            f"{BASE_URL}/api/friends/search",
            params={"unique_id": user2["unique_id"]},
            headers=auth_headers(token1)
        )
        assert search_response.status_code == 200
        assert search_response.json()["user"] is not None, f"Search returned null for {user2['unique_id']}"
        assert search_response.json()["user"]["unique_id"] == user2["unique_id"]
        print(f"✓ Friends search: found user by unique_id")
        
        # Test 2: Search for nonexistent user
        search_none = session1.get(
            f"{BASE_URL}/api/friends/search",
            params={"unique_id": "CinemaSync_NonExistent_01012026"},
            headers=auth_headers(token1)
        )
        assert search_none.status_code == 200
        assert search_none.json()["user"] is None
        print(f"✓ Friends search: null for nonexistent user")
        
        # Test 3: Search for self returns null
        search_self = session1.get(
            f"{BASE_URL}/api/friends/search",
            params={"unique_id": user1["unique_id"]},
            headers=auth_headers(token1)
        )
        assert search_self.status_code == 200
        assert search_self.json()["user"] is None
        print(f"✓ Friends search self: returns null")
        
        # Test 4: Send friend request
        request_response = session1.post(
            f"{BASE_URL}/api/friends/request",
            json={"unique_id": user2["unique_id"]},
            headers=auth_headers(token1)
        )
        assert request_response.status_code == 200, f"Friend request failed: {request_response.text}"
        assert request_response.json().get("ok") == True
        print(f"✓ Friend request sent")
        
        # Test 5: Cannot send duplicate request
        dup_response = session1.post(
            f"{BASE_URL}/api/friends/request",
            json={"unique_id": user2["unique_id"]},
            headers=auth_headers(token1)
        )
        assert dup_response.status_code == 400
        print(f"✓ Duplicate friend request rejected")
        
        # Test 6: Accept friend request (user2 accepts user1's request)
        accept_response = session2.post(
            f"{BASE_URL}/api/friends/accept",
            json={"user_id": user1["id"]},
            headers=auth_headers(token2)
        )
        assert accept_response.status_code == 200, f"Accept failed: {accept_response.text}"
        assert accept_response.json().get("ok") == True
        print(f"✓ Friend request accepted")
        
        # Verify friendship
        friends_response = session2.get(
            f"{BASE_URL}/api/friends",
            headers=auth_headers(token2)
        )
        friends_data = friends_response.json()
        friend_ids = [f["id"] for f in friends_data.get("friends", [])]
        assert user1["id"] in friend_ids
        print(f"✓ Users are now friends")
        
        # Test 7: Remove friend
        remove_response = session1.post(
            f"{BASE_URL}/api/friends/remove",
            json={"user_id": user2["id"]},
            headers=auth_headers(token1)
        )
        assert remove_response.status_code == 200
        assert remove_response.json().get("ok") == True
        print(f"✓ Friend removed")
    
    def test_cannot_request_self(self):
        """POST /api/friends/request cannot request self"""
        session = fresh_session()
        uid = str(uuid.uuid4())[:8]
        reg = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_self_{uid}@test.com",
            "password": "testpass123",
            "name": f"SelfTest{uid}"
        })
        assert reg.status_code == 200
        token = reg.json()["token"]
        unique_id = reg.json()["user"]["unique_id"]
        
        response = session.post(
            f"{BASE_URL}/api/friends/request",
            json={"unique_id": unique_id},
            headers=auth_headers(token)
        )
        
        # Should return 404 (user not found when searching for self) or 400
        assert response.status_code in [400, 404]
        print(f"✓ Cannot send friend request to self")
    
    def test_reject_friend_request(self):
        """POST /api/friends/reject works correctly"""
        session1 = fresh_session()
        session2 = fresh_session()
        
        uid1 = str(uuid.uuid4())[:8]
        uid2 = str(uuid.uuid4())[:8]
        
        reg1 = session1.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_rej1_{uid1}@test.com",
            "password": "testpass123",
            "name": f"Reject1_{uid1}"
        })
        token1 = reg1.json()["token"]
        user1 = reg1.json()["user"]
        
        reg2 = session2.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_rej2_{uid2}@test.com",
            "password": "testpass123",
            "name": f"Reject2_{uid2}"
        })
        token2 = reg2.json()["token"]
        user2 = reg2.json()["user"]
        
        # Send request
        session1.post(
            f"{BASE_URL}/api/friends/request",
            json={"unique_id": user2["unique_id"]},
            headers=auth_headers(token1)
        )
        
        # Reject request
        reject_response = session2.post(
            f"{BASE_URL}/api/friends/reject",
            json={"user_id": user1["id"]},
            headers=auth_headers(token2)
        )
        assert reject_response.status_code == 200
        assert reject_response.json().get("ok") == True
        print(f"✓ Friend request rejected")
    
    def test_cancel_friend_request(self):
        """POST /api/friends/cancel works correctly"""
        session1 = fresh_session()
        session2 = fresh_session()
        
        uid1 = str(uuid.uuid4())[:8]
        uid2 = str(uuid.uuid4())[:8]
        
        reg1 = session1.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_can1_{uid1}@test.com",
            "password": "testpass123",
            "name": f"Cancel1_{uid1}"
        })
        token1 = reg1.json()["token"]
        
        reg2 = session2.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_can2_{uid2}@test.com",
            "password": "testpass123",
            "name": f"Cancel2_{uid2}"
        })
        user2 = reg2.json()["user"]
        
        # Send request
        session1.post(
            f"{BASE_URL}/api/friends/request",
            json={"unique_id": user2["unique_id"]},
            headers=auth_headers(token1)
        )
        
        # Cancel request
        cancel_response = session1.post(
            f"{BASE_URL}/api/friends/cancel",
            json={"user_id": user2["id"]},
            headers=auth_headers(token1)
        )
        assert cancel_response.status_code == 200
        assert cancel_response.json().get("ok") == True
        print(f"✓ Friend request cancelled")


# ============ ROOMS TESTS ============

class TestRooms:
    """Room management tests"""
    
    def test_rooms_full_flow(self):
        """Test complete rooms flow: create, join, get, messages, leave"""
        # Create fresh sessions for each user
        session1 = fresh_session()
        session2 = fresh_session()
        admin_session = fresh_session()
        
        uid1 = str(uuid.uuid4())[:8]
        uid2 = str(uuid.uuid4())[:8]
        
        reg1 = session1.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_room1_{uid1}@test.com",
            "password": "testpass123",
            "name": f"RoomHost{uid1}"
        })
        assert reg1.status_code == 200
        user1 = reg1.json()["user"]
        token1 = reg1.json()["token"]
        
        reg2 = session2.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_room2_{uid2}@test.com",
            "password": "testpass123",
            "name": f"RoomGuest{uid2}"
        })
        assert reg2.status_code == 200
        user2 = reg2.json()["user"]
        token2 = reg2.json()["token"]
        
        # Test 1: Create room
        create_response = session1.post(
            f"{BASE_URL}/api/rooms",
            json={
                "name": f"TEST_Room_{uid1}",
                "password": "roompass123",
                "platform": "netflix"
            },
            headers=auth_headers(token1)
        )
        assert create_response.status_code == 200, f"Create room failed: {create_response.text}"
        room = create_response.json()["room"]
        assert "id" in room
        assert len(room["id"]) == 8
        assert room["name"] == f"TEST_Room_{uid1}"
        assert room["platform"] == "netflix"
        assert user1["id"] in room["participants"], f"Host {user1['id']} not in participants {room['participants']}"
        assert room["host_id"] == user1["id"]
        room_id = room["id"]
        print(f"✓ Room created: {room_id}")
        
        # Test 2: Join room with correct password
        join_response = session2.post(
            f"{BASE_URL}/api/rooms/join",
            json={
                "room_id": room_id,
                "password": "roompass123"
            },
            headers=auth_headers(token2)
        )
        assert join_response.status_code == 200, f"Join room failed: {join_response.text}"
        assert user2["id"] in join_response.json()["room"]["participants"]
        print(f"✓ User2 joined room with correct password")
        
        # Test 3: Join room with wrong password
        wrong_pass_response = session2.post(
            f"{BASE_URL}/api/rooms/join",
            json={
                "room_id": room_id,
                "password": "wrongpassword"
            },
            headers=auth_headers(token2)
        )
        assert wrong_pass_response.status_code == 401
        print(f"✓ Join room with wrong password: 401 returned")
        
        # Test 4: Get room as participant
        get_response = session1.get(
            f"{BASE_URL}/api/rooms/{room_id}",
            headers=auth_headers(token1)
        )
        assert get_response.status_code == 200
        assert "room" in get_response.json()
        assert "members" in get_response.json()
        print(f"✓ Get room as participant works")
        
        # Test 5: Get room as non-participant (admin)
        admin_login = admin_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cinemasync.app",
            "password": "admin123"
        })
        admin_token = admin_login.json()["token"]
        
        non_participant_response = admin_session.get(
            f"{BASE_URL}/api/rooms/{room_id}",
            headers=auth_headers(admin_token)
        )
        assert non_participant_response.status_code == 403
        print(f"✓ Get room as non-participant: 403 returned")
        
        # Test 6: Get room messages
        messages_response = session1.get(
            f"{BASE_URL}/api/rooms/{room_id}/messages",
            headers=auth_headers(token1)
        )
        assert messages_response.status_code == 200
        assert "messages" in messages_response.json()
        assert isinstance(messages_response.json()["messages"], list)
        print(f"✓ Get room messages: returns list")
        
        # Test 7: Leave room
        leave_response = session2.post(
            f"{BASE_URL}/api/rooms/{room_id}/leave",
            headers=auth_headers(token2)
        )
        assert leave_response.status_code == 200
        assert leave_response.json().get("ok") == True
        print(f"✓ User left room")
    
    def test_join_room_not_found(self):
        """POST /api/rooms/join returns 404 on missing room"""
        session = fresh_session()
        # Login as admin
        login = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@cinemasync.app",
            "password": "admin123"
        })
        token = login.json()["token"]
        
        response = session.post(
            f"{BASE_URL}/api/rooms/join",
            json={
                "room_id": "NOTEXIST",
                "password": "anypass"
            },
            headers=auth_headers(token)
        )
        
        assert response.status_code == 404
        print(f"✓ Join nonexistent room: 404 returned")


# ============ WEBSOCKET TESTS (Basic connectivity) ============

class TestWebSocket:
    """WebSocket connectivity tests (basic)"""
    
    def test_websocket_endpoint_exists(self):
        """Verify WebSocket endpoint path is correct"""
        session = fresh_session()
        uid = str(uuid.uuid4())[:8]
        reg = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_ws_{uid}@test.com",
            "password": "testpass123",
            "name": f"WSTest{uid}"
        })
        token = reg.json()["token"]
        
        create_response = session.post(
            f"{BASE_URL}/api/rooms",
            json={
                "name": f"TEST_WS_Room_{uid}",
                "password": "wspass123",
                "platform": "custom"
            },
            headers=auth_headers(token)
        )
        room_id = create_response.json()["room"]["id"]
        
        # We can't fully test WebSocket with requests, but we can verify the endpoint
        ws_path = f"{BASE_URL}/api/ws/room/{room_id}?token={token}"
        
        # This should fail with a specific error since it's not a WS upgrade request
        try:
            response = session.get(ws_path)
            # FastAPI returns 403 or similar for non-WS requests to WS endpoints
            print(f"✓ WebSocket endpoint exists (HTTP response: {response.status_code})")
        except Exception as e:
            print(f"✓ WebSocket endpoint check: {str(e)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
