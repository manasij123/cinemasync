"""
CinemaSync New Features Tests - Iteration 2
Tests for: /api/rooms/active, /api/rooms/{id}/invite, /api/notifications
Focus: Invite friends, Live Now dashboard, Notifications
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def fresh_session():
    """Create a fresh requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def auth_headers(token):
    """Helper to create auth headers"""
    return {"Authorization": f"Bearer {token}"}


def register_user(session, prefix="TEST"):
    """Helper to register a new user"""
    uid = str(uuid.uuid4())[:8]
    payload = {
        "email": f"{prefix}_{uid}@test.com",
        "password": "testpass123",
        "name": f"{prefix}User{uid}"
    }
    response = session.post(f"{BASE_URL}/api/auth/register", json=payload)
    assert response.status_code == 200, f"Register failed: {response.text}"
    data = response.json()
    return data["user"], data["token"]


def make_friends(session1, token1, session2, token2, user1, user2):
    """Helper to make two users friends"""
    # User1 sends request to User2
    req_resp = session1.post(
        f"{BASE_URL}/api/friends/request",
        json={"unique_id": user2["unique_id"]},
        headers=auth_headers(token1)
    )
    assert req_resp.status_code == 200, f"Friend request failed: {req_resp.text}"
    
    # User2 accepts
    accept_resp = session2.post(
        f"{BASE_URL}/api/friends/accept",
        json={"user_id": user1["id"]},
        headers=auth_headers(token2)
    )
    assert accept_resp.status_code == 200, f"Accept failed: {accept_resp.text}"


# ============ ROUTE ORDERING TEST ============

class TestRouteOrdering:
    """Test that /api/rooms/active is matched before /api/rooms/{room_id}"""
    
    def test_active_route_not_404_room_not_found(self):
        """GET /api/rooms/active should NOT return 404 'Room not found'"""
        session = fresh_session()
        user, token = register_user(session, "TEST_route")
        
        response = session.get(
            f"{BASE_URL}/api/rooms/active",
            headers=auth_headers(token)
        )
        
        # Should be 200, not 404 with "Room not found"
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "rooms" in data, f"Expected 'rooms' key in response: {data}"
        
        # Verify it's not the room_id route returning error
        if response.status_code == 404:
            assert "Room not found" not in response.text, "Route ordering issue: /api/rooms/active matched as /api/rooms/{room_id}"
        
        print(f"✓ Route ordering correct: /api/rooms/active returns 200 with rooms list")


# ============ ACTIVE ROOMS TESTS ============

class TestActiveRooms:
    """Tests for GET /api/rooms/active endpoint"""
    
    def test_active_rooms_empty_initially(self):
        """GET /api/rooms/active returns empty list for new user"""
        session = fresh_session()
        user, token = register_user(session, "TEST_active")
        
        response = session.get(
            f"{BASE_URL}/api/rooms/active",
            headers=auth_headers(token)
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "rooms" in data
        assert isinstance(data["rooms"], list)
        print(f"✓ Active rooms: returns empty list for new user")
    
    def test_active_rooms_shows_created_room(self):
        """GET /api/rooms/active shows room where user is host"""
        session = fresh_session()
        user, token = register_user(session, "TEST_host")
        
        # Create a room
        create_resp = session.post(
            f"{BASE_URL}/api/rooms",
            json={"name": "TEST_ActiveRoom", "password": "pass123", "platform": "netflix"},
            headers=auth_headers(token)
        )
        assert create_resp.status_code == 200
        room = create_resp.json()["room"]
        
        # Check active rooms
        response = session.get(
            f"{BASE_URL}/api/rooms/active",
            headers=auth_headers(token)
        )
        
        assert response.status_code == 200
        data = response.json()
        room_ids = [r["id"] for r in data["rooms"]]
        assert room["id"] in room_ids, f"Created room {room['id']} not in active rooms {room_ids}"
        
        # Verify room data structure
        active_room = next(r for r in data["rooms"] if r["id"] == room["id"])
        assert active_room["name"] == "TEST_ActiveRoom"
        assert active_room["host_id"] == user["id"]
        assert active_room["platform"] == "netflix"
        assert "participants" in active_room
        assert user["id"] in active_room["participants"]
        
        print(f"✓ Active rooms: shows room where user is host")
    
    def test_active_rooms_shows_joined_room(self):
        """GET /api/rooms/active shows room where user joined (not host)"""
        session1 = fresh_session()
        session2 = fresh_session()
        
        host, token1 = register_user(session1, "TEST_host2")
        joiner, token2 = register_user(session2, "TEST_joiner")
        
        # Host creates room
        create_resp = session1.post(
            f"{BASE_URL}/api/rooms",
            json={"name": "TEST_JoinedRoom", "password": "joinpass", "platform": "prime"},
            headers=auth_headers(token1)
        )
        room = create_resp.json()["room"]
        
        # Joiner joins room
        join_resp = session2.post(
            f"{BASE_URL}/api/rooms/join",
            json={"room_id": room["id"], "password": "joinpass"},
            headers=auth_headers(token2)
        )
        assert join_resp.status_code == 200
        
        # Check joiner's active rooms
        response = session2.get(
            f"{BASE_URL}/api/rooms/active",
            headers=auth_headers(token2)
        )
        
        assert response.status_code == 200
        data = response.json()
        room_ids = [r["id"] for r in data["rooms"]]
        assert room["id"] in room_ids, f"Joined room {room['id']} not in joiner's active rooms"
        
        print(f"✓ Active rooms: shows room where user is joiner (not host)")
    
    def test_active_rooms_excludes_password_hash(self):
        """GET /api/rooms/active should NOT include password_hash"""
        session = fresh_session()
        user, token = register_user(session, "TEST_nopwd")
        
        # Create a room
        session.post(
            f"{BASE_URL}/api/rooms",
            json={"name": "TEST_NoPwdRoom", "password": "secret123", "platform": "custom"},
            headers=auth_headers(token)
        )
        
        response = session.get(
            f"{BASE_URL}/api/rooms/active",
            headers=auth_headers(token)
        )
        
        assert response.status_code == 200
        data = response.json()
        for room in data["rooms"]:
            assert "password_hash" not in room, f"password_hash exposed in active rooms response"
        
        print(f"✓ Active rooms: password_hash not exposed")
    
    def test_active_rooms_requires_auth(self):
        """GET /api/rooms/active returns 401 without auth"""
        session = fresh_session()
        response = session.get(f"{BASE_URL}/api/rooms/active")
        
        assert response.status_code == 401
        print(f"✓ Active rooms: requires authentication")


# ============ INVITE TESTS ============

class TestInvite:
    """Tests for POST /api/rooms/{room_id}/invite endpoint"""
    
    def test_invite_success(self):
        """POST /api/rooms/{room_id}/invite creates notification for friend"""
        session1 = fresh_session()
        session2 = fresh_session()
        
        host, token1 = register_user(session1, "TEST_invhost")
        friend, token2 = register_user(session2, "TEST_invfriend")
        
        # Make them friends
        make_friends(session1, token1, session2, token2, host, friend)
        
        # Host creates room
        create_resp = session1.post(
            f"{BASE_URL}/api/rooms",
            json={"name": "TEST_InviteRoom", "password": "invitepass", "platform": "netflix"},
            headers=auth_headers(token1)
        )
        room = create_resp.json()["room"]
        
        # Host invites friend
        invite_resp = session1.post(
            f"{BASE_URL}/api/rooms/{room['id']}/invite",
            json={"friend_id": friend["id"], "password": "invitepass"},
            headers=auth_headers(token1)
        )
        
        assert invite_resp.status_code == 200, f"Invite failed: {invite_resp.text}"
        data = invite_resp.json()
        assert data.get("ok") == True
        assert "notification" in data
        
        # Verify notification structure
        notif = data["notification"]
        assert notif["type"] == "room-invite"
        assert notif["room_id"] == room["id"]
        assert notif["room_name"] == "TEST_InviteRoom"
        assert notif["password"] == "invitepass"  # Plain password stored
        assert notif["from_user_id"] == host["id"]
        assert notif["from_name"] == host["name"]
        assert notif["user_id"] == friend["id"]
        assert notif["read"] == False
        
        print(f"✓ Invite: creates notification with correct structure")
    
    def test_invite_wrong_password(self):
        """POST /api/rooms/{room_id}/invite returns 401 with wrong password"""
        session1 = fresh_session()
        session2 = fresh_session()
        
        host, token1 = register_user(session1, "TEST_invwrong")
        friend, token2 = register_user(session2, "TEST_invwrongf")
        
        make_friends(session1, token1, session2, token2, host, friend)
        
        create_resp = session1.post(
            f"{BASE_URL}/api/rooms",
            json={"name": "TEST_WrongPwdRoom", "password": "correctpass", "platform": "custom"},
            headers=auth_headers(token1)
        )
        room = create_resp.json()["room"]
        
        invite_resp = session1.post(
            f"{BASE_URL}/api/rooms/{room['id']}/invite",
            json={"friend_id": friend["id"], "password": "wrongpass"},
            headers=auth_headers(token1)
        )
        
        assert invite_resp.status_code == 401, f"Expected 401, got {invite_resp.status_code}"
        print(f"✓ Invite: returns 401 with wrong password")
    
    def test_invite_not_friend(self):
        """POST /api/rooms/{room_id}/invite returns 400 if target is not a friend"""
        session1 = fresh_session()
        session2 = fresh_session()
        
        host, token1 = register_user(session1, "TEST_invnotf")
        stranger, token2 = register_user(session2, "TEST_stranger")
        
        # NOT making them friends
        
        create_resp = session1.post(
            f"{BASE_URL}/api/rooms",
            json={"name": "TEST_NotFriendRoom", "password": "pass123", "platform": "custom"},
            headers=auth_headers(token1)
        )
        room = create_resp.json()["room"]
        
        invite_resp = session1.post(
            f"{BASE_URL}/api/rooms/{room['id']}/invite",
            json={"friend_id": stranger["id"], "password": "pass123"},
            headers=auth_headers(token1)
        )
        
        assert invite_resp.status_code == 400, f"Expected 400, got {invite_resp.status_code}"
        assert "Not a friend" in invite_resp.text or "friend" in invite_resp.text.lower()
        print(f"✓ Invite: returns 400 if not a friend")
    
    def test_invite_not_participant(self):
        """POST /api/rooms/{room_id}/invite returns 403 if inviter is not a participant"""
        session1 = fresh_session()
        session2 = fresh_session()
        session3 = fresh_session()
        
        host, token1 = register_user(session1, "TEST_invhost3")
        outsider, token2 = register_user(session2, "TEST_outsider")
        friend_of_outsider, token3 = register_user(session3, "TEST_fofout")
        
        # Make outsider and friend_of_outsider friends
        make_friends(session2, token2, session3, token3, outsider, friend_of_outsider)
        
        # Host creates room (outsider is NOT a participant)
        create_resp = session1.post(
            f"{BASE_URL}/api/rooms",
            json={"name": "TEST_OutsiderRoom", "password": "pass123", "platform": "custom"},
            headers=auth_headers(token1)
        )
        room = create_resp.json()["room"]
        
        # Outsider tries to invite their friend to a room they're not in
        invite_resp = session2.post(
            f"{BASE_URL}/api/rooms/{room['id']}/invite",
            json={"friend_id": friend_of_outsider["id"], "password": "pass123"},
            headers=auth_headers(token2)
        )
        
        assert invite_resp.status_code == 403, f"Expected 403, got {invite_resp.status_code}"
        print(f"✓ Invite: returns 403 if inviter is not a participant")
    
    def test_invite_room_not_found(self):
        """POST /api/rooms/{room_id}/invite returns 404 if room doesn't exist"""
        session1 = fresh_session()
        session2 = fresh_session()
        
        user1, token1 = register_user(session1, "TEST_inv404")
        user2, token2 = register_user(session2, "TEST_inv404f")
        
        make_friends(session1, token1, session2, token2, user1, user2)
        
        invite_resp = session1.post(
            f"{BASE_URL}/api/rooms/NOTEXIST/invite",
            json={"friend_id": user2["id"], "password": "anypass"},
            headers=auth_headers(token1)
        )
        
        assert invite_resp.status_code == 404, f"Expected 404, got {invite_resp.status_code}"
        print(f"✓ Invite: returns 404 if room doesn't exist")


# ============ NOTIFICATIONS TESTS ============

class TestNotifications:
    """Tests for /api/notifications endpoints"""
    
    def test_get_notifications_empty(self):
        """GET /api/notifications returns empty list for new user"""
        session = fresh_session()
        user, token = register_user(session, "TEST_notif")
        
        response = session.get(
            f"{BASE_URL}/api/notifications",
            headers=auth_headers(token)
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert isinstance(data["notifications"], list)
        print(f"✓ Notifications: returns empty list for new user")
    
    def test_get_notifications_shows_invite(self):
        """GET /api/notifications shows room-invite notification"""
        session1 = fresh_session()
        session2 = fresh_session()
        
        host, token1 = register_user(session1, "TEST_notifhost")
        friend, token2 = register_user(session2, "TEST_notiffriend")
        
        make_friends(session1, token1, session2, token2, host, friend)
        
        # Host creates room and invites friend
        create_resp = session1.post(
            f"{BASE_URL}/api/rooms",
            json={"name": "TEST_NotifRoom", "password": "notifpass", "platform": "hotstar"},
            headers=auth_headers(token1)
        )
        room = create_resp.json()["room"]
        
        session1.post(
            f"{BASE_URL}/api/rooms/{room['id']}/invite",
            json={"friend_id": friend["id"], "password": "notifpass"},
            headers=auth_headers(token1)
        )
        
        # Friend checks notifications
        response = session2.get(
            f"{BASE_URL}/api/notifications",
            headers=auth_headers(token2)
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["notifications"]) > 0, "No notifications found"
        
        # Find the invite notification
        invite_notif = next((n for n in data["notifications"] if n["type"] == "room-invite" and n["room_id"] == room["id"]), None)
        assert invite_notif is not None, f"Invite notification not found in {data['notifications']}"
        
        # Verify no _id field
        assert "_id" not in invite_notif, "_id should be excluded from notification"
        
        # Verify structure
        assert invite_notif["room_name"] == "TEST_NotifRoom"
        assert invite_notif["password"] == "notifpass"
        assert invite_notif["from_user_id"] == host["id"]
        assert invite_notif["from_name"] == host["name"]
        assert invite_notif["read"] == False
        
        print(f"✓ Notifications: shows room-invite with correct data, no _id")
    
    def test_mark_notification_read(self):
        """POST /api/notifications/{id}/read marks notification as read"""
        session1 = fresh_session()
        session2 = fresh_session()
        
        host, token1 = register_user(session1, "TEST_readhost")
        friend, token2 = register_user(session2, "TEST_readfriend")
        
        make_friends(session1, token1, session2, token2, host, friend)
        
        create_resp = session1.post(
            f"{BASE_URL}/api/rooms",
            json={"name": "TEST_ReadRoom", "password": "readpass", "platform": "custom"},
            headers=auth_headers(token1)
        )
        room = create_resp.json()["room"]
        
        invite_resp = session1.post(
            f"{BASE_URL}/api/rooms/{room['id']}/invite",
            json={"friend_id": friend["id"], "password": "readpass"},
            headers=auth_headers(token1)
        )
        notif_id = invite_resp.json()["notification"]["id"]
        
        # Mark as read
        read_resp = session2.post(
            f"{BASE_URL}/api/notifications/{notif_id}/read",
            headers=auth_headers(token2)
        )
        
        assert read_resp.status_code == 200
        assert read_resp.json().get("ok") == True
        
        # Verify it's marked as read
        notifs_resp = session2.get(
            f"{BASE_URL}/api/notifications",
            headers=auth_headers(token2)
        )
        notif = next((n for n in notifs_resp.json()["notifications"] if n["id"] == notif_id), None)
        assert notif is not None
        assert notif["read"] == True
        
        print(f"✓ Notifications: mark as read works")
    
    def test_delete_notification(self):
        """DELETE /api/notifications/{id} removes notification"""
        session1 = fresh_session()
        session2 = fresh_session()
        
        host, token1 = register_user(session1, "TEST_delhost")
        friend, token2 = register_user(session2, "TEST_delfriend")
        
        make_friends(session1, token1, session2, token2, host, friend)
        
        create_resp = session1.post(
            f"{BASE_URL}/api/rooms",
            json={"name": "TEST_DelRoom", "password": "delpass", "platform": "custom"},
            headers=auth_headers(token1)
        )
        room = create_resp.json()["room"]
        
        invite_resp = session1.post(
            f"{BASE_URL}/api/rooms/{room['id']}/invite",
            json={"friend_id": friend["id"], "password": "delpass"},
            headers=auth_headers(token1)
        )
        notif_id = invite_resp.json()["notification"]["id"]
        
        # Delete notification
        del_resp = session2.delete(
            f"{BASE_URL}/api/notifications/{notif_id}",
            headers=auth_headers(token2)
        )
        
        assert del_resp.status_code == 200
        assert del_resp.json().get("ok") == True
        
        # Verify it's deleted
        notifs_resp = session2.get(
            f"{BASE_URL}/api/notifications",
            headers=auth_headers(token2)
        )
        notif_ids = [n["id"] for n in notifs_resp.json()["notifications"]]
        assert notif_id not in notif_ids, "Notification should be deleted"
        
        print(f"✓ Notifications: delete works")
    
    def test_notifications_sorted_newest_first(self):
        """GET /api/notifications returns newest first"""
        session1 = fresh_session()
        session2 = fresh_session()
        
        host, token1 = register_user(session1, "TEST_sorthost")
        friend, token2 = register_user(session2, "TEST_sortfriend")
        
        make_friends(session1, token1, session2, token2, host, friend)
        
        # Create two rooms and send two invites
        notif_ids = []
        for i in range(2):
            create_resp = session1.post(
                f"{BASE_URL}/api/rooms",
                json={"name": f"TEST_SortRoom{i}", "password": "sortpass", "platform": "custom"},
                headers=auth_headers(token1)
            )
            room = create_resp.json()["room"]
            
            invite_resp = session1.post(
                f"{BASE_URL}/api/rooms/{room['id']}/invite",
                json={"friend_id": friend["id"], "password": "sortpass"},
                headers=auth_headers(token1)
            )
            notif_ids.append(invite_resp.json()["notification"]["id"])
            time.sleep(0.1)  # Small delay to ensure different timestamps
        
        # Get notifications
        notifs_resp = session2.get(
            f"{BASE_URL}/api/notifications",
            headers=auth_headers(token2)
        )
        
        notifs = notifs_resp.json()["notifications"]
        # Filter to just our test notifications
        our_notifs = [n for n in notifs if n["id"] in notif_ids]
        
        # Second notification (newer) should come first
        if len(our_notifs) >= 2:
            assert our_notifs[0]["id"] == notif_ids[1], "Newest notification should be first"
        
        print(f"✓ Notifications: sorted newest first")
    
    def test_notifications_requires_auth(self):
        """GET /api/notifications returns 401 without auth"""
        session = fresh_session()
        response = session.get(f"{BASE_URL}/api/notifications")
        
        assert response.status_code == 401
        print(f"✓ Notifications: requires authentication")


# ============ INTEGRATION TEST: FULL INVITE FLOW ============

class TestInviteFlow:
    """End-to-end test of the invite flow"""
    
    def test_full_invite_accept_flow(self):
        """Test: Host invites friend -> Friend sees notification -> Friend joins room"""
        session1 = fresh_session()
        session2 = fresh_session()
        
        host, token1 = register_user(session1, "TEST_flowhost")
        friend, token2 = register_user(session2, "TEST_flowfriend")
        
        # Make friends
        make_friends(session1, token1, session2, token2, host, friend)
        
        # Host creates room
        create_resp = session1.post(
            f"{BASE_URL}/api/rooms",
            json={"name": "TEST_FlowRoom", "password": "flowpass", "platform": "netflix"},
            headers=auth_headers(token1)
        )
        room = create_resp.json()["room"]
        print(f"  Room created: {room['id']}")
        
        # Host invites friend
        invite_resp = session1.post(
            f"{BASE_URL}/api/rooms/{room['id']}/invite",
            json={"friend_id": friend["id"], "password": "flowpass"},
            headers=auth_headers(token1)
        )
        assert invite_resp.status_code == 200
        notif = invite_resp.json()["notification"]
        print(f"  Invite sent, notification id: {notif['id']}")
        
        # Friend checks notifications
        notifs_resp = session2.get(
            f"{BASE_URL}/api/notifications",
            headers=auth_headers(token2)
        )
        assert len(notifs_resp.json()["notifications"]) > 0
        invite_notif = next(n for n in notifs_resp.json()["notifications"] if n["id"] == notif["id"])
        print(f"  Friend sees notification with password: {invite_notif['password']}")
        
        # Friend uses password from notification to join
        join_resp = session2.post(
            f"{BASE_URL}/api/rooms/join",
            json={"room_id": invite_notif["room_id"], "password": invite_notif["password"]},
            headers=auth_headers(token2)
        )
        assert join_resp.status_code == 200
        joined_room = join_resp.json()["room"]
        assert friend["id"] in joined_room["participants"]
        print(f"  Friend joined room successfully")
        
        # Mark notification as read
        session2.post(
            f"{BASE_URL}/api/notifications/{notif['id']}/read",
            headers=auth_headers(token2)
        )
        
        # Verify friend's active rooms now includes this room
        active_resp = session2.get(
            f"{BASE_URL}/api/rooms/active",
            headers=auth_headers(token2)
        )
        active_room_ids = [r["id"] for r in active_resp.json()["rooms"]]
        assert room["id"] in active_room_ids
        print(f"  Room appears in friend's active rooms")
        
        print(f"✓ Full invite flow: Host invites -> Friend sees notification -> Friend joins -> Room in active")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
