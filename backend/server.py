from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import bcrypt
import jwt
import re
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Set

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, WebSocket, WebSocketDisconnect, status, UploadFile, File, Query, Header
from fastapi.responses import Response as FastAPIResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from storage import init_storage, put_object, get_object, APP_NAME as STORAGE_APP_NAME


# ------------- Config -------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@cinemasync.app")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="CinemaSync API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ------------- Helpers -------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user.get("email"),
        "name": user.get("name"),
        "unique_id": user.get("unique_id"),
        "profile_image": user.get("profile_image"),
        "friends": user.get("friends", []),
        "requests_in": user.get("requests_in", []),
        "requests_out": user.get("requests_out", []),
        "is_admin": bool(user.get("is_admin", False)),
        "created_at": user.get("created_at"),
    }


def generate_unique_id(name: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9]", "", name) or "User"
    today = datetime.now(timezone.utc).strftime("%d%m%Y")
    return f"CinemaSync_{safe}_{today}"


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user


async def get_user_from_token_str(token: str) -> Optional[dict]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        return user
    except Exception:
        return None


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )


# ------------- Models -------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=40)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileIn(BaseModel):
    name: Optional[str] = None
    profile_image: Optional[str] = None


class FriendRequestIn(BaseModel):
    unique_id: str


class FriendActionIn(BaseModel):
    user_id: str


class CreateRoomIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=40)
    platform: str = Field(default="custom")


class JoinRoomIn(BaseModel):
    room_id: str
    password: str


class ChatMessageIn(BaseModel):
    room_id: str
    text: str


class InviteIn(BaseModel):
    friend_id: str
    password: str


# ------------- Auth Routes -------------
@api_router.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "name": body.name.strip(),
        "password_hash": hash_password(body.password),
        "unique_id": generate_unique_id(body.name),
        "profile_image": None,
        "friends": [],
        "requests_in": [],
        "requests_out": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email)
    set_auth_cookie(response, token)
    return {"user": public_user(doc), "token": token}


@api_router.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user["id"], email)
    set_auth_cookie(response, token)
    return {"user": public_user(user), "token": token}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": public_user(user)}


# ------------- Profile -------------
@api_router.patch("/profile")
async def update_profile(body: UpdateProfileIn, user: dict = Depends(get_current_user)):
    update = {}
    if body.name is not None and body.name.strip():
        update["name"] = body.name.strip()
        update["unique_id"] = generate_unique_id(body.name)
    if body.profile_image is not None:
        update["profile_image"] = body.profile_image
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"user": public_user(fresh)}


# --- Profile picture upload (Emergent Object Storage, up to 10MB) ---
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}


@api_router.post("/profile/picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP or GIF images are allowed")
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds 10 MB limit")

    ext = ALLOWED_IMAGE_TYPES[file.content_type]
    path = f"{STORAGE_APP_NAME}/avatars/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(path, data, file.content_type)
    except Exception as e:
        logger.error(f"Profile image upload failed for {user['id']}: {e}")
        raise HTTPException(status_code=503, detail="Image storage temporarily unavailable")

    file_id = str(uuid.uuid4())
    record = {
        "id": file_id,
        "owner_id": user["id"],
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "kind": "avatar",
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.files.insert_one(record)

    # Public URL served by our backend (avatars readable to logged-in users)
    public_url = f"/api/files/{result['path']}"
    await db.users.update_one({"id": user["id"]}, {"$set": {"profile_image": public_url}})

    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"user": public_user(fresh), "url": public_url, "size": record["size"]}


@api_router.get("/files/{path:path}")
async def serve_file(
    path: str,
    user: dict = Depends(get_current_user),
):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data, content_type = get_object(path)
    except Exception as e:
        logger.error(f"File fetch failed for {path}: {e}")
        raise HTTPException(status_code=503, detail="Storage temporarily unavailable")
    return FastAPIResponse(
        content=data,
        media_type=record.get("content_type") or content_type,
        headers={"Cache-Control": "private, max-age=300"},
    )


# ------------- Friends -------------
@api_router.get("/friends/search")
async def search_by_unique_id(unique_id: str, user: dict = Depends(get_current_user)):
    other = await db.users.find_one({"unique_id": unique_id}, {"_id": 0, "password_hash": 0})
    if not other or other["id"] == user["id"]:
        return {"user": None}
    return {"user": public_user(other)}


@api_router.post("/friends/request")
async def send_friend_request(body: FriendRequestIn, user: dict = Depends(get_current_user)):
    target = await db.users.find_one({"unique_id": body.unique_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")
    if target["id"] in user.get("friends", []):
        raise HTTPException(status_code=400, detail="Already friends")
    if target["id"] in user.get("requests_out", []):
        raise HTTPException(status_code=400, detail="Request already sent")
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"requests_out": target["id"]}})
    await db.users.update_one({"id": target["id"]}, {"$addToSet": {"requests_in": user["id"]}})
    return {"ok": True}


@api_router.post("/friends/accept")
async def accept_friend(body: FriendActionIn, user: dict = Depends(get_current_user)):
    other_id = body.user_id
    if other_id not in user.get("requests_in", []):
        raise HTTPException(status_code=400, detail="No such request")
    await db.users.update_one({"id": user["id"]}, {
        "$pull": {"requests_in": other_id},
        "$addToSet": {"friends": other_id},
    })
    await db.users.update_one({"id": other_id}, {
        "$pull": {"requests_out": user["id"]},
        "$addToSet": {"friends": user["id"]},
    })
    return {"ok": True}


@api_router.post("/friends/reject")
async def reject_friend(body: FriendActionIn, user: dict = Depends(get_current_user)):
    other_id = body.user_id
    await db.users.update_one({"id": user["id"]}, {"$pull": {"requests_in": other_id}})
    await db.users.update_one({"id": other_id}, {"$pull": {"requests_out": user["id"]}})
    return {"ok": True}


@api_router.post("/friends/cancel")
async def cancel_friend_request(body: FriendActionIn, user: dict = Depends(get_current_user)):
    other_id = body.user_id
    await db.users.update_one({"id": user["id"]}, {"$pull": {"requests_out": other_id}})
    await db.users.update_one({"id": other_id}, {"$pull": {"requests_in": user["id"]}})
    return {"ok": True}


@api_router.post("/friends/remove")
async def remove_friend(body: FriendActionIn, user: dict = Depends(get_current_user)):
    other_id = body.user_id
    await db.users.update_one({"id": user["id"]}, {"$pull": {"friends": other_id}})
    await db.users.update_one({"id": other_id}, {"$pull": {"friends": user["id"]}})
    return {"ok": True}


@api_router.get("/friends")
async def list_friends(user: dict = Depends(get_current_user)):
    friend_ids = user.get("friends", [])
    in_ids = user.get("requests_in", [])
    out_ids = user.get("requests_out", [])
    all_ids = list(set(friend_ids + in_ids + out_ids))
    users_map = {}
    if all_ids:
        async for u in db.users.find({"id": {"$in": all_ids}}, {"_id": 0, "password_hash": 0}):
            users_map[u["id"]] = public_user(u)
    return {
        "friends": [users_map[i] for i in friend_ids if i in users_map],
        "requests_in": [users_map[i] for i in in_ids if i in users_map],
        "requests_out": [users_map[i] for i in out_ids if i in users_map],
    }


# ------------- Rooms -------------
def generate_room_id() -> str:
    return uuid.uuid4().hex[:8].upper()


@api_router.post("/rooms")
async def create_room(body: CreateRoomIn, user: dict = Depends(get_current_user)):
    room_id = generate_room_id()
    doc = {
        "id": room_id,
        "name": body.name.strip(),
        "password_hash": hash_password(body.password),
        "host_id": user["id"],
        "platform": body.platform,
        "participants": [user["id"]],
        "state": {"playing": False, "position": 0.0, "updated_at": datetime.now(timezone.utc).isoformat()},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.rooms.insert_one(doc)
    return {"room": _room_public(doc)}


def _room_public(room: dict) -> dict:
    return {
        "id": room["id"],
        "name": room["name"],
        "host_id": room["host_id"],
        "platform": room.get("platform", "custom"),
        "participants": room.get("participants", []),
        "state": room.get("state", {"playing": False, "position": 0.0}),
        "created_at": room.get("created_at"),
    }


@api_router.post("/rooms/join")
async def join_room(body: JoinRoomIn, user: dict = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": body.room_id.upper()}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not verify_password(body.password, room["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect room password")
    await db.rooms.update_one({"id": room["id"]}, {"$addToSet": {"participants": user["id"]}})
    room = await db.rooms.find_one({"id": room["id"]}, {"_id": 0})
    return {"room": _room_public(room)}


@api_router.get("/rooms/active")
async def active_rooms(user: dict = Depends(get_current_user)):
    rooms = []
    async for r in db.rooms.find({"participants": user["id"]}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(20):
        rooms.append({
            "id": r["id"],
            "name": r["name"],
            "host_id": r["host_id"],
            "platform": r.get("platform", "custom"),
            "participants": r.get("participants", []),
            "state": r.get("state", {}),
            "created_at": r.get("created_at"),
        })
    return {"rooms": rooms}


@api_router.get("/rooms/{room_id}")
async def get_room(room_id: str, user: dict = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id.upper()}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if user["id"] not in room.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant")
    # Resolve participants
    p_ids = room.get("participants", [])
    members = []
    if p_ids:
        async for u in db.users.find({"id": {"$in": p_ids}}, {"_id": 0, "password_hash": 0}):
            members.append(public_user(u))
    return {"room": _room_public(room), "members": members}


@api_router.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, user: dict = Depends(get_current_user)):
    await db.rooms.update_one({"id": room_id.upper()}, {"$pull": {"participants": user["id"]}})
    return {"ok": True}


@api_router.get("/rooms/{room_id}/messages")
async def get_messages(room_id: str, user: dict = Depends(get_current_user)):
    cursor = db.messages.find({"room_id": room_id.upper()}, {"_id": 0}).sort("time", 1).limit(200)
    msgs = await cursor.to_list(200)
    return {"messages": msgs}


@api_router.post("/rooms/{room_id}/invite")
async def invite_friend(room_id: str, body: InviteIn, user: dict = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id.upper()}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if user["id"] not in room.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant")
    if not verify_password(body.password, room["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect room password")
    if body.friend_id not in user.get("friends", []):
        raise HTTPException(status_code=400, detail="Not a friend")
    # Create notification for the friend
    notif = {
        "id": str(uuid.uuid4()),
        "user_id": body.friend_id,
        "type": "room-invite",
        "room_id": room["id"],
        "room_name": room["name"],
        "password": body.password,
        "from_user_id": user["id"],
        "from_name": user["name"],
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(dict(notif))
    notif.pop("_id", None)
    return {"ok": True, "notification": notif}


# --- Share Party Poster (Gemini Nano Banana image generation) ---
PLATFORM_VIBES = {
    "netflix":   "bold cinematic crimson and ink-black poster, filmic grain",
    "prime":     "deep navy night-sky with Prime Video blue highlights",
    "hotstar":   "hot pink-to-indigo neon gradient with playful sparkles",
    "hoichoi":   "royal purple Bengali theatre curtain with gold filigree",
    "addatimes": "warm red and cream retro Kolkata coffee-house bokeh",
    "zee5":      "pink-violet gradient bokeh, shiny holographic accents",
    "custom":    "pastel purple and neon pink vaporwave theatre",
}


@api_router.post("/rooms/{room_id}/poster")
async def generate_room_poster(
    room_id: str,
    user: dict = Depends(get_current_user),
):
    from emergentintegrations.llm.chat import LlmChat, UserMessage  # lazy import

    room = await db.rooms.find_one({"id": room_id.upper()}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if user["id"] not in room.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant")

    host = await db.users.find_one({"id": room["host_id"]}, {"_id": 0})
    host_name = host["name"] if host else "Host"
    platform = room.get("platform", "custom")
    vibe = PLATFORM_VIBES.get(platform, PLATFORM_VIBES["custom"])
    platform_label = {
        "netflix": "Netflix", "prime": "Prime Video", "hotstar": "JioHotstar",
        "hoichoi": "Hoichoi", "addatimes": "Addatimes", "zee5": "ZEE5", "custom": "Custom stream",
    }.get(platform, "Custom stream")

    prompt = (
        "Design a beautiful square vertical watch-party invitation poster, 1024x1024. "
        f"Aesthetic: {vibe}. Art-deco movie-theatre marquee with bold stencil typography, "
        "subtle film-reel + popcorn motifs, faint halftone grain. "
        f"Title at top in huge uppercase stencil letters: 'CINEMASYNC'. "
        f"Below title, a prominent headline with the room name: '{room['name']}'. "
        f"A sub-line reads: 'Hosted by {host_name} · Streaming on {platform_label}'. "
        f"Bottom banner shows the room code in large monospace: '{room['id']}'. "
        "Include a soft glow, layered gradient, and theatre curtain edges. "
        "No stock-photo faces, no real celebrity likeness, high-contrast readable text."
    )

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Image generation key not configured")

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"poster-{room_id}-{uuid.uuid4()}",
            system_message="You are a graphic designer creating luxurious event posters.",
        ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

        _text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    except Exception as e:
        logger.error(f"Poster gen failed: {e}")
        raise HTTPException(status_code=503, detail="Poster generation temporarily unavailable")

    if not images:
        raise HTTPException(status_code=502, detail="No image returned from generator")

    import base64 as _b64
    img = images[0]
    data = _b64.b64decode(img["data"])
    mime = img.get("mime_type", "image/png")
    ext = "png" if "png" in mime else ("jpg" if "jpeg" in mime else "png")

    storage_path = f"{STORAGE_APP_NAME}/posters/{room['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(storage_path, data, mime)
    except Exception as e:
        logger.error(f"Poster storage failed: {e}")
        raise HTTPException(status_code=503, detail="Poster storage failed")

    file_id = str(uuid.uuid4())
    record = {
        "id": file_id,
        "owner_id": user["id"],
        "room_id": room["id"],
        "storage_path": result["path"],
        "original_filename": f"cinemasync-{room['id']}.{ext}",
        "content_type": mime,
        "size": result.get("size", len(data)),
        "kind": "poster",
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.files.insert_one(record)

    return {
        "url": f"/api/files/{result['path']}",
        "download_name": record["original_filename"],
        "size": record["size"],
        "room_id": room["id"],
    }


@api_router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    cursor = db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(50)
    items = await cursor.to_list(50)
    return {"notifications": items}


@api_router.post("/notifications/{nid}/read")
async def mark_notification_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": nid, "user_id": user["id"]},
        {"$set": {"read": True}},
    )
    return {"ok": True}


@api_router.delete("/notifications/{nid}")
async def delete_notification(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.delete_one({"id": nid, "user_id": user["id"]})
    return {"ok": True}


# ------------- WebSocket (sync + chat + webrtc signaling) -------------
class RoomHub:
    def __init__(self):
        self.rooms: Dict[str, Set[WebSocket]] = {}
        self.socket_user: Dict[WebSocket, dict] = {}

    async def connect(self, room_id: str, ws: WebSocket, user: dict):
        await ws.accept()
        self.rooms.setdefault(room_id, set()).add(ws)
        self.socket_user[ws] = {"user": user, "room": room_id}

    def disconnect(self, ws: WebSocket):
        meta = self.socket_user.pop(ws, None)
        if meta:
            room = self.rooms.get(meta["room"])
            if room and ws in room:
                room.discard(ws)
            return meta
        return None

    async def broadcast(self, room_id: str, payload: dict, exclude: Optional[WebSocket] = None):
        for sock in list(self.rooms.get(room_id, [])):
            if sock is exclude:
                continue
            try:
                await sock.send_json(payload)
            except Exception:
                pass

    def participants(self, room_id: str) -> List[dict]:
        return [
            {"id": self.socket_user[s]["user"]["id"], "name": self.socket_user[s]["user"]["name"]}
            for s in self.rooms.get(room_id, set())
            if s in self.socket_user
        ]


hub = RoomHub()


@app.websocket("/api/ws/room/{room_id}")
async def websocket_room(websocket: WebSocket, room_id: str):
    room_id = room_id.upper()
    token = websocket.query_params.get("token")
    user = await get_user_from_token_str(token) if token else None
    if not user:
        # Also allow cookie
        cookie_token = websocket.cookies.get("access_token")
        user = await get_user_from_token_str(cookie_token) if cookie_token else None
    if not user:
        await websocket.close(code=1008)
        return
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room or user["id"] not in room.get("participants", []):
        await websocket.close(code=1008)
        return

    await hub.connect(room_id, websocket, user)

    # Send initial state & presence
    await websocket.send_json({
        "type": "hello",
        "state": room.get("state", {}),
        "host_id": room["host_id"],
        "participants": hub.participants(room_id),
        "you": {"id": user["id"], "name": user["name"]},
    })
    await hub.broadcast(room_id, {
        "type": "presence",
        "participants": hub.participants(room_id),
        "joined": {"id": user["id"], "name": user["name"]},
    }, exclude=websocket)

    try:
        while True:
            msg = await websocket.receive_json()
            mtype = msg.get("type")
            if mtype == "sync":
                # Only host can broadcast sync
                fresh_room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
                if fresh_room and fresh_room["host_id"] == user["id"]:
                    new_state = {
                        "playing": bool(msg.get("playing", False)),
                        "position": float(msg.get("position", 0)),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "action": msg.get("action", "sync"),
                    }
                    await db.rooms.update_one({"id": room_id}, {"$set": {"state": new_state}})
                    await hub.broadcast(room_id, {"type": "sync", "state": new_state})
            elif mtype == "chat":
                text = (msg.get("text") or "").strip()
                if not text:
                    continue
                entry = {
                    "id": str(uuid.uuid4()),
                    "room_id": room_id,
                    "sender_id": user["id"],
                    "sender_name": user["name"],
                    "text": text[:500],
                    "time": datetime.now(timezone.utc).isoformat(),
                }
                await db.messages.insert_one(dict(entry))
                entry.pop("_id", None)
                await hub.broadcast(room_id, {"type": "chat", "message": entry})
            elif mtype == "webrtc-signal":
                # Relay signaling between peers: to (user_id), payload
                target_id = msg.get("to")
                payload = {
                    "type": "webrtc-signal",
                    "from": user["id"],
                    "from_name": user["name"],
                    "signal": msg.get("signal"),
                    "kind": msg.get("kind"),  # 'offer' | 'answer' | 'ice'
                }
                for sock, meta in hub.socket_user.items():
                    if meta["room"] == room_id and meta["user"]["id"] == target_id:
                        try:
                            await sock.send_json(payload)
                        except Exception:
                            pass
            elif mtype == "screenshare-start":
                await hub.broadcast(room_id, {
                    "type": "screenshare-start",
                    "from": user["id"],
                    "from_name": user["name"],
                }, exclude=websocket)
            elif mtype == "screenshare-stop":
                await hub.broadcast(room_id, {
                    "type": "screenshare-stop",
                    "from": user["id"],
                }, exclude=websocket)
            elif mtype == "platform-change":
                platform = msg.get("platform", "custom")
                fresh_room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
                if fresh_room and fresh_room["host_id"] == user["id"]:
                    await db.rooms.update_one({"id": room_id}, {"$set": {"platform": platform}})
                    await hub.broadcast(room_id, {"type": "platform-change", "platform": platform})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception("ws error: %s", e)
    finally:
        meta = hub.disconnect(websocket)
        await hub.broadcast(room_id, {
            "type": "presence",
            "participants": hub.participants(room_id),
            "left": {"id": user["id"], "name": user["name"]},
        })


# ------------- Admin Routes -------------
@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    users_count = await db.users.count_documents({})
    rooms_count = await db.rooms.count_documents({})
    msgs_count = await db.messages.count_documents({})
    notifs_count = await db.notifications.count_documents({})
    # recent signups (last 7d)
    seven_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_users = await db.users.count_documents({"created_at": {"$gte": seven_ago}})
    recent_rooms = await db.rooms.count_documents({"created_at": {"$gte": seven_ago}})
    return {
        "total_users": users_count,
        "total_rooms": rooms_count,
        "total_messages": msgs_count,
        "total_notifications": notifs_count,
        "new_users_7d": recent_users,
        "new_rooms_7d": recent_rooms,
    }


@api_router.get("/admin/users")
async def admin_list_users(admin: dict = Depends(require_admin)):
    cursor = db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1)
    out = []
    async for u in cursor:
        out.append({
            "id": u["id"],
            "email": u.get("email"),
            "name": u.get("name"),
            "unique_id": u.get("unique_id"),
            "is_admin": bool(u.get("is_admin", False)),
            "friends_count": len(u.get("friends", [])),
            "created_at": u.get("created_at"),
        })
    return {"users": out}


@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("is_admin"):
        raise HTTPException(status_code=400, detail="Cannot delete another admin")
    await db.users.delete_one({"id": user_id})
    # Cleanup: pull from friends/requests of others, remove from rooms, delete their rooms-as-host, delete notifications
    await db.users.update_many({}, {"$pull": {"friends": user_id, "requests_in": user_id, "requests_out": user_id}})
    await db.rooms.update_many({}, {"$pull": {"participants": user_id}})
    await db.rooms.delete_many({"host_id": user_id})
    await db.notifications.delete_many({"$or": [{"user_id": user_id}, {"from_user_id": user_id}]})
    await db.messages.delete_many({"sender_id": user_id})
    return {"ok": True}


@api_router.post("/admin/users/{user_id}/promote")
async def admin_promote_user(user_id: str, admin: dict = Depends(require_admin)):
    res = await db.users.update_one({"id": user_id}, {"$set": {"is_admin": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


@api_router.post("/admin/users/{user_id}/demote")
async def admin_demote_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    res = await db.users.update_one({"id": user_id}, {"$set": {"is_admin": False}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


@api_router.get("/admin/rooms")
async def admin_list_rooms(admin: dict = Depends(require_admin)):
    cursor = db.rooms.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1)
    out = []
    async for r in cursor:
        out.append({
            "id": r["id"],
            "name": r["name"],
            "host_id": r["host_id"],
            "platform": r.get("platform"),
            "participants": r.get("participants", []),
            "state": r.get("state", {}),
            "created_at": r.get("created_at"),
        })
    return {"rooms": out}


@api_router.delete("/admin/rooms/{room_id}")
async def admin_delete_room(room_id: str, admin: dict = Depends(require_admin)):
    res = await db.rooms.delete_one({"id": room_id.upper()})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    await db.messages.delete_many({"room_id": room_id.upper()})
    return {"ok": True}


class BroadcastIn(BaseModel):
    title: str
    body: str


@api_router.post("/admin/broadcast")
async def admin_broadcast(body: BroadcastIn, admin: dict = Depends(require_admin)):
    """Creates a notification for every user."""
    created = 0
    async for u in db.users.find({}, {"_id": 0, "id": 1}):
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": u["id"],
            "type": "admin-broadcast",
            "room_id": None,
            "room_name": body.title,
            "password": body.body,  # re-using password field for body text
            "from_user_id": admin["id"],
            "from_name": admin.get("name", "Admin"),
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        created += 1
    return {"ok": True, "sent_to": created}


# ------------- Health -------------
@api_router.get("/")
async def root():
    return {"message": "CinemaSync API is live"}


# ------------- Startup -------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("unique_id")
    await db.rooms.create_index("id", unique=True)
    await db.messages.create_index([("room_id", 1), ("time", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.files.create_index("storage_path", unique=True)
    await db.files.create_index([("owner_id", 1), ("created_at", -1)])
    # Initialise object storage (avatar uploads)
    try:
        init_storage()
    except Exception as e:
        logger.error(f"Storage startup init failed: {e}")
    # Seed admin
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "name": "Admin",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "unique_id": generate_unique_id("Admin"),
            "profile_image": None,
            "friends": [],
            "requests_in": [],
            "requests_out": [],
            "is_admin": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    else:
        # Ensure existing admin is flagged
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"is_admin": True}})


@app.on_event("shutdown")
async def shutdown():
    client.close()


# Mount
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)
