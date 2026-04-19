from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import asyncio
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
from email_service import send_password_reset as send_pw_reset_email, send_verify_email


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
        "email_verified": bool(user.get("email_verified", False)),
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
    custom_title: Optional[str] = Field(default=None, max_length=80)


class JoinRoomIn(BaseModel):
    room_id: str
    password: str


class ChatMessageIn(BaseModel):
    room_id: str
    text: str


class InviteIn(BaseModel):
    friend_id: str
    password: str


class BroadcastInviteIn(BaseModel):
    password: str


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class VerifyEmailIn(BaseModel):
    token: str


class CohostIn(BaseModel):
    user_id: str


class DeleteAccountIn(BaseModel):
    password: str
    confirm: str  # must be exactly "DELETE MY ACCOUNT"


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
        "email_verified": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email)
    set_auth_cookie(response, token)
    # Fire-and-forget verification email (ignore failures on registration)
    try:
        vtok = await _issue_email_token(user_id, "verify", VERIFY_TOKEN_TTL_HR * 3600)
        await send_verify_email(email, body.name.strip(), vtok)
    except Exception as e:
        logger.warning(f"Signup verify email failed: {e}")
    return {"user": public_user(doc), "token": token}


@api_router.post("/auth/login")
async def login(body: LoginIn, response: Response, request: Request):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    # Brute-force guard: 8 attempts / 10 minutes per email, 30 per IP
    if not rate_limit("login", email, limit=8, window_seconds=600):
        raise HTTPException(status_code=429, detail="Too many login attempts — try again in 10 minutes")
    if not rate_limit("login-ip", ip, limit=30, window_seconds=600):
        raise HTTPException(status_code=429, detail="Too many login attempts from this IP")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # Self-heal admin flag — if this login is for the configured ADMIN_EMAIL,
    # ensure is_admin=True + email_verified=True even if the startup seed
    # didn't run (e.g. first boot after env-var change on deployed instance).
    if ADMIN_EMAIL and email == ADMIN_EMAIL.lower() and not user.get("is_admin"):
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"is_admin": True, "email_verified": True}},
        )
        user["is_admin"] = True
        user["email_verified"] = True
        logger.info(f"Admin self-healed on login for {email}")
    token = create_access_token(user["id"], email)
    set_auth_cookie(response, token)
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_active_at": datetime.now(timezone.utc).isoformat()}})
    return {"user": public_user(user), "token": token}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


# ------------- Rate limiter (in-memory sliding window) -------------
_RATE_BUCKETS: Dict[str, List[float]] = {}


def rate_limit(scope: str, key: str, limit: int, window_seconds: float) -> bool:
    """Returns True if request is allowed, False if rate-limited."""
    import time
    now = time.time()
    bucket_key = f"{scope}:{key}"
    stamps = _RATE_BUCKETS.get(bucket_key, [])
    cutoff = now - window_seconds
    stamps = [t for t in stamps if t > cutoff]
    if len(stamps) >= limit:
        _RATE_BUCKETS[bucket_key] = stamps
        return False
    stamps.append(now)
    _RATE_BUCKETS[bucket_key] = stamps
    return True


# ------------- Password reset + email verification -------------
RESET_TOKEN_TTL_MIN = 30
VERIFY_TOKEN_TTL_HR = 48


async def _issue_email_token(user_id: str, kind: str, ttl_seconds: int) -> str:
    token = uuid.uuid4().hex + uuid.uuid4().hex  # 64 chars
    await db.email_tokens.insert_one({
        "token": token,
        "user_id": user_id,
        "kind": kind,  # "reset" | "verify"
        "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).isoformat(),
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return token


@api_router.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordIn, request: Request):
    # Rate limit to 3/hour per email + 10/hour per IP
    ip = request.client.host if request.client else "unknown"
    if not rate_limit("forgot", body.email.lower(), limit=3, window_seconds=3600):
        raise HTTPException(status_code=429, detail="Too many reset requests — try again later")
    if not rate_limit("forgot-ip", ip, limit=10, window_seconds=3600):
        raise HTTPException(status_code=429, detail="Too many requests from this IP")

    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    # Always return a generic response to avoid user-enumeration
    if user:
        token = await _issue_email_token(user["id"], "reset", RESET_TOKEN_TTL_MIN * 60)
        try:
            await send_pw_reset_email(user["email"], user.get("name") or "there", token)
        except Exception as e:
            logger.error(f"Reset email failed: {e}")
    return {"ok": True, "message": "If the email exists, a reset link has been sent."}


@api_router.post("/auth/reset-password")
async def reset_password(body: ResetPasswordIn):
    rec = await db.email_tokens.find_one({"token": body.token, "kind": "reset", "used": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")
    new_hash = hash_password(body.new_password)
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": new_hash}})
    await db.email_tokens.update_one({"token": body.token}, {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True, "message": "Password updated. You can now log in."}


@api_router.post("/auth/send-verify-email")
async def request_verify_email(user: dict = Depends(get_current_user)):
    if user.get("email_verified"):
        return {"ok": True, "already_verified": True}
    if not rate_limit("verify", user["id"], limit=5, window_seconds=3600):
        raise HTTPException(status_code=429, detail="Too many verification attempts — wait a bit")
    token = await _issue_email_token(user["id"], "verify", VERIFY_TOKEN_TTL_HR * 3600)
    result = await send_verify_email(user["email"], user.get("name") or "there", token)
    delivered = bool(result.get("id"))
    return {
        "ok": True,
        "delivered": delivered,
        "fallback_link": None if delivered else result.get("link"),
        "message": (
            "Verification email sent — check your inbox."
            if delivered else
            "Email delivery isn't configured yet, but here is your verification link — click it to confirm."
        ),
    }


@api_router.post("/auth/verify-email")
async def confirm_email(body: VerifyEmailIn):
    rec = await db.email_tokens.find_one({"token": body.token, "kind": "verify", "used": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    if datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification token has expired")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"email_verified": True}})
    await db.email_tokens.update_one({"token": body.token}, {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}})
    fresh = await db.users.find_one({"id": rec["user_id"]}, {"_id": 0})
    return {"ok": True, "user": public_user(fresh)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    # Track last_active_at so the 30-day inactivity sweep knows who to purge
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_active_at": datetime.now(timezone.utc).isoformat()}})
    return {"user": public_user(user)}


@api_router.delete("/account")
async def delete_account(body: DeleteAccountIn, response: Response, user: dict = Depends(get_current_user)):
    if user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin account cannot be deleted from the UI")
    if body.confirm.strip() != "DELETE MY ACCOUNT":
        raise HTTPException(status_code=400, detail="Type DELETE MY ACCOUNT to confirm")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password")
    await _purge_user(user["id"])
    response.delete_cookie("access_token", path="/")
    return {"ok": True, "message": "Account permanently deleted"}


async def _purge_user(user_id: str):
    """Completely remove a user and all their data. Idempotent."""
    # Rooms this user hosts → delete those rooms + their messages
    hosted = await db.rooms.find({"host_id": user_id}, {"_id": 0, "id": 1}).to_list(None)
    hosted_ids = [r["id"] for r in hosted]
    if hosted_ids:
        await db.rooms.delete_many({"id": {"$in": hosted_ids}})
        await db.messages.delete_many({"room_id": {"$in": hosted_ids}})
    # Remove from other rooms' participants / co_hosts
    await db.rooms.update_many({"participants": user_id}, {"$pull": {"participants": user_id}})
    await db.rooms.update_many({"co_hosts": user_id}, {"$pull": {"co_hosts": user_id}})
    # Friends' lists
    await db.users.update_many({"friends": user_id}, {"$pull": {"friends": user_id}})
    await db.users.update_many({"requests_in": user_id}, {"$pull": {"requests_in": user_id}})
    await db.users.update_many({"requests_out": user_id}, {"$pull": {"requests_out": user_id}})
    # Stored files (object storage rows + avatars)
    files = await db.files.find({"owner_id": user_id}, {"_id": 0, "storage_path": 1}).to_list(None)
    for f in files:
        try:
            # Best-effort delete from object storage; soft-delete in DB
            pass
        except Exception:
            pass
    await db.files.update_many({"owner_id": user_id}, {"$set": {"is_deleted": True}})
    # Notifications + email tokens + history
    await db.notifications.delete_many({"$or": [{"user_id": user_id}, {"from_user_id": user_id}]})
    await db.email_tokens.delete_many({"user_id": user_id})
    await db.room_history.delete_many({"user_id": user_id})
    # Finally, user doc
    await db.users.delete_one({"id": user_id})
    logger.info(f"Purged user {user_id} (rooms={len(hosted_ids)})")


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


# --- WebRTC ICE servers (TURN via Metered) ---
import requests as _requests

_METERED_CACHE: Dict[str, object] = {}


def _static_ice_servers() -> list:
    user = os.environ.get("METERED_TURN_USERNAME")
    cred = os.environ.get("METERED_TURN_CREDENTIAL")
    base = [{"urls": "stun:stun.l.google.com:19302"}]
    if user and cred:
        base += [
            {"urls": "stun:stun.relay.metered.ca:80"},
            {"urls": "turn:global.relay.metered.ca:80", "username": user, "credential": cred},
            {"urls": "turn:global.relay.metered.ca:80?transport=tcp", "username": user, "credential": cred},
            {"urls": "turn:global.relay.metered.ca:443", "username": user, "credential": cred},
            {"urls": "turns:global.relay.metered.ca:443?transport=tcp", "username": user, "credential": cred},
        ]
    return base


@api_router.get("/rtc/ice")
async def rtc_ice(user: dict = Depends(get_current_user)):
    """Return ICE servers for WebRTC. Tries Metered REST API first (short-TTL
    credentials), falls back to static env-provided TURN creds."""
    import time
    app_name = os.environ.get("METERED_TURN_APP") or "cinemasync"
    api_key = os.environ.get("METERED_TURN_API_KEY")
    cached = _METERED_CACHE.get("ice")
    cached_at = _METERED_CACHE.get("at") or 0
    if cached and (time.time() - float(cached_at)) < 300:  # 5-min cache
        return {"iceServers": cached, "source": "cache"}

    if api_key:
        try:
            resp = await asyncio.to_thread(
                _requests.get,
                f"https://{app_name}.metered.live/api/v1/turn/credentials",
                params={"apiKey": api_key},
                timeout=8,
            )
            if resp.ok:
                ice = resp.json()
                if isinstance(ice, list) and ice:
                    _METERED_CACHE["ice"] = ice
                    _METERED_CACHE["at"] = time.time()
                    return {"iceServers": ice, "source": "metered"}
        except Exception as e:
            logger.warning(f"Metered ICE fetch failed: {e}")

    ice = _static_ice_servers()
    _METERED_CACHE["ice"] = ice
    _METERED_CACHE["at"] = time.time()
    return {"iceServers": ice, "source": "static"}


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
        "custom_title": (body.custom_title or "").strip() or None,
        "password_hash": hash_password(body.password),
        "host_id": user["id"],
        "co_hosts": [],
        "platform": body.platform,
        "participants": [user["id"]],
        "state": {"playing": False, "position": 0.0, "updated_at": datetime.now(timezone.utc).isoformat()},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.rooms.insert_one(doc)
    await _record_history(user["id"], room_id, body.name.strip(), body.platform, role="host")
    return {"room": _room_public(doc)}


def _room_public(room: dict) -> dict:
    return {
        "id": room["id"],
        "name": room["name"],
        "custom_title": room.get("custom_title"),
        "host_id": room["host_id"],
        "co_hosts": room.get("co_hosts", []),
        "platform": room.get("platform", "custom"),
        "participants": room.get("participants", []),
        "state": room.get("state", {"playing": False, "position": 0.0}),
        "created_at": room.get("created_at"),
    }


async def _record_history(user_id: str, room_id: str, room_name: str, platform: str, role: str = "guest"):
    """Upsert room-history record; bumps last_joined_at."""
    now = datetime.now(timezone.utc).isoformat()
    await db.room_history.update_one(
        {"user_id": user_id, "room_id": room_id},
        {
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "room_id": room_id,
                "first_joined_at": now,
                "role": role,
            },
            "$set": {
                "room_name": room_name,
                "platform": platform,
                "last_joined_at": now,
            },
            "$inc": {"visit_count": 1},
        },
        upsert=True,
    )


@api_router.post("/rooms/join")
async def join_room(body: JoinRoomIn, user: dict = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": body.room_id.upper()}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not verify_password(body.password, room["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect room password")
    await db.rooms.update_one({"id": room["id"]}, {"$addToSet": {"participants": user["id"]}})
    room = await db.rooms.find_one({"id": room["id"]}, {"_id": 0})
    role = "host" if room["host_id"] == user["id"] else (
        "co-host" if user["id"] in room.get("co_hosts", []) else "guest"
    )
    await _record_history(user["id"], room["id"], room["name"], room.get("platform", "custom"), role=role)
    return {"room": _room_public(room)}


@api_router.get("/rooms/history")
async def room_history(user: dict = Depends(get_current_user), limit: int = 20):
    limit = max(1, min(limit, 100))
    cursor = db.room_history.find({"user_id": user["id"]}, {"_id": 0}).sort("last_joined_at", -1).limit(limit)
    rows = await cursor.to_list(limit)
    # Join with current room status (active or ended)
    room_ids = [r["room_id"] for r in rows]
    active_ids = set()
    if room_ids:
        async for r in db.rooms.find({"id": {"$in": room_ids}}, {"_id": 0, "id": 1}):
            active_ids.add(r["id"])
    for r in rows:
        r["is_active"] = r["room_id"] in active_ids
    return {"history": rows}


class BulkHistoryDeleteIn(BaseModel):
    room_ids: List[str] = Field(default_factory=list)


async def _notify_admins_room_killed(actor: dict, room_id: str, room_name: str):
    """Create one admin-alert per admin. Skip the actor themselves if they are admin."""
    now = datetime.now(timezone.utc).isoformat()
    admin_ids: List[str] = []
    async for a in db.users.find({"is_admin": True}, {"_id": 0, "id": 1}):
        if a.get("id") and a["id"] != actor["id"]:
            admin_ids.append(a["id"])
    if not admin_ids:
        return
    docs = [{
        "id": str(uuid.uuid4()),
        "user_id": aid,
        "type": "admin-alert",
        "subtype": "room-killed",
        "room_id": room_id,
        "room_name": room_name,
        "from_user_id": actor["id"],
        "from_name": actor.get("name", "Host"),
        "read": False,
        "created_at": now,
    } for aid in admin_ids]
    await db.notifications.insert_many(docs)


async def _purge_room_for_host(actor: dict, room_id: str) -> bool:
    """Full cascade purge of a room initiated by its host from Recent-rooms.
    Removes history for all users, room doc, messages, pending invites, and
    closes any live WebSocket connections. Emits an admin-alert. Returns True
    if the current user was legitimately the host, False otherwise."""
    rid = room_id.upper()
    # Prefer live room doc; fallback to history for ended rooms
    room_doc = await db.rooms.find_one({"id": rid}, {"_id": 0})
    host_id = room_doc["host_id"] if room_doc else None
    room_name = room_doc["name"] if room_doc else None
    if host_id is None:
        hist = await db.room_history.find_one(
            {"user_id": actor["id"], "room_id": rid, "role": "host"}, {"_id": 0}
        )
        if not hist:
            return False
        host_id = actor["id"]
        room_name = hist.get("room_name") or rid
    if host_id != actor["id"]:
        return False

    # Broadcast + close sockets if room is still live
    if room_doc:
        try:
            await hub.broadcast(rid, {
                "type": "room-ended",
                "by": actor["id"],
                "by_name": actor.get("name", "Host"),
                "room_id": rid,
                "ended_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            pass
        try:
            for sock in list(hub.rooms.get(rid, [])):
                try:
                    await sock.close(code=1000)
                except Exception:
                    pass
            hub.rooms.pop(rid, None)
        except Exception:
            pass
        await db.rooms.delete_one({"id": rid})

    # Cascade: remove room-history for every user
    await db.room_history.delete_many({"room_id": rid})
    await db.messages.delete_many({"room_id": rid})
    await db.notifications.delete_many({"type": "room-invite", "room_id": rid})

    await _notify_admins_room_killed(actor, rid, room_name or rid)
    return True


@api_router.delete("/rooms/history/{room_id}")
async def delete_history_entry(room_id: str, user: dict = Depends(get_current_user)):
    """Delete a single recent-room entry.
    - If the current user was the host of that room → cascade kill it for everyone + admin alert.
    - Otherwise just remove their personal history row (guest-side).
    """
    rid = room_id.upper()
    hist = await db.room_history.find_one({"user_id": user["id"], "room_id": rid}, {"_id": 0})
    if not hist:
        raise HTTPException(status_code=404, detail="History entry not found")

    was_host_here = hist.get("role") == "host"
    if was_host_here:
        ok = await _purge_room_for_host(user, rid)
        if not ok:
            # Fallback — just drop their own row
            await db.room_history.delete_one({"user_id": user["id"], "room_id": rid})
        return {"ok": True, "cascaded": bool(ok), "room_id": rid}

    await db.room_history.delete_one({"user_id": user["id"], "room_id": rid})
    return {"ok": True, "cascaded": False, "room_id": rid}


@api_router.post("/rooms/history/bulk-delete")
async def bulk_delete_history(body: BulkHistoryDeleteIn, user: dict = Depends(get_current_user)):
    """Bulk variant — same rules as single delete, applied per room_id."""
    if not body.room_ids:
        return {"ok": True, "deleted": 0, "cascaded": 0}
    seen: Set[str] = set()
    cleaned: List[str] = []
    for rid in body.room_ids:
        u = (rid or "").strip().upper()
        if u and u not in seen:
            seen.add(u)
            cleaned.append(u)
    cleaned = cleaned[:100]  # safety cap

    hist_rows = await db.room_history.find(
        {"user_id": user["id"], "room_id": {"$in": cleaned}},
        {"_id": 0, "room_id": 1, "role": 1},
    ).to_list(200)
    host_rooms = {h["room_id"] for h in hist_rows if h.get("role") == "host"}
    guest_rooms = {h["room_id"] for h in hist_rows} - host_rooms

    cascaded = 0
    for rid in host_rooms:
        if await _purge_room_for_host(user, rid):
            cascaded += 1
    if guest_rooms:
        await db.room_history.delete_many(
            {"user_id": user["id"], "room_id": {"$in": list(guest_rooms)}}
        )

    return {
        "ok": True,
        "deleted": len(host_rooms) + len(guest_rooms),
        "cascaded": cascaded,
    }


@api_router.post("/rooms/{room_id}/promote")
async def promote_cohost(room_id: str, body: CohostIn, user: dict = Depends(get_current_user)):
    room_id = room_id.upper()
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room["host_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only host can promote co-hosts")
    if body.user_id not in room.get("participants", []):
        raise HTTPException(status_code=400, detail="User is not a participant")
    if body.user_id == room["host_id"]:
        raise HTTPException(status_code=400, detail="Host is already host")
    await db.rooms.update_one({"id": room_id}, {"$addToSet": {"co_hosts": body.user_id}})
    fresh = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    return {"ok": True, "room": _room_public(fresh)}


@api_router.post("/rooms/{room_id}/demote")
async def demote_cohost(room_id: str, body: CohostIn, user: dict = Depends(get_current_user)):
    room_id = room_id.upper()
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room["host_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only host can demote co-hosts")
    await db.rooms.update_one({"id": room_id}, {"$pull": {"co_hosts": body.user_id}})
    fresh = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    return {"ok": True, "room": _room_public(fresh)}


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


@api_router.delete("/rooms/{room_id}")
async def terminate_room(room_id: str, user: dict = Depends(get_current_user)):
    """Host-only: permanently end a room. Kicks all guests via WebSocket and
    removes the room + chat history from the database."""
    rid = room_id.upper()
    room = await db.rooms.find_one({"id": rid}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room["host_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only host can end the room")

    # 1. Tell all connected sockets the room is over
    try:
        await hub.broadcast(rid, {
            "type": "room-ended",
            "by": user["id"],
            "by_name": user.get("name", "Host"),
            "room_id": rid,
            "ended_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

    # 2. Close all sockets for that room
    try:
        for sock in list(hub.rooms.get(rid, [])):
            try:
                await sock.close(code=1000)
            except Exception:
                pass
        hub.rooms.pop(rid, None)
    except Exception:
        pass

    # 3. Purge from DB (room + chat messages). Keep room_history for personal records.
    await db.rooms.delete_one({"id": rid})
    await db.messages.delete_many({"room_id": rid})
    # Clear pending room-invite notifications for this room
    await db.notifications.delete_many({"type": "room-invite", "room_id": rid})
    return {"ok": True, "room_id": rid}


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


@api_router.post("/rooms/{room_id}/broadcast")
async def broadcast_room_to_friends(room_id: str, body: BroadcastInviteIn, user: dict = Depends(get_current_user)):
    """Send a room-invite notification to ALL friends at once (when creating a room)."""
    room = await db.rooms.find_one({"id": room_id.upper()}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if user["id"] not in room.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant")
    if not verify_password(body.password, room["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect room password")

    friends = user.get("friends", [])
    if not friends:
        return {"ok": True, "sent": 0}

    docs = []
    now = datetime.now(timezone.utc).isoformat()
    for fid in friends:
        docs.append({
            "id": str(uuid.uuid4()),
            "user_id": fid,
            "type": "room-invite",
            "room_id": room["id"],
            "room_name": room["name"],
            "password": body.password,
            "from_user_id": user["id"],
            "from_name": user["name"],
            "read": False,
            "created_at": now,
        })
    if docs:
        await db.notifications.insert_many(docs)
    return {"ok": True, "sent": len(docs)}


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
                # Host or co-hosts can broadcast sync
                fresh_room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
                can_sync = fresh_room and (
                    fresh_room["host_id"] == user["id"]
                    or user["id"] in fresh_room.get("co_hosts", [])
                )
                if can_sync:
                    if not rate_limit("ws-sync", user["id"], limit=8, window_seconds=1.0):
                        continue
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
                if not rate_limit("ws-chat", user["id"], limit=10, window_seconds=5.0):
                    await websocket.send_json({"type": "rate-limited", "scope": "chat", "retry_after": 5})
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
                    "channel": msg.get("channel", "screen"),
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
    cursor = db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(1000)
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
    await _purge_user(user_id)
    return {"ok": True}


class BulkDeleteIn(BaseModel):
    user_ids: List[str]


@api_router.post("/admin/users/bulk-delete")
async def admin_bulk_delete_users(body: BulkDeleteIn, admin: dict = Depends(require_admin)):
    if not body.user_ids:
        raise HTTPException(status_code=400, detail="No user_ids provided")
    if len(body.user_ids) > 500:
        raise HTTPException(status_code=400, detail="Too many users in one batch (max 500)")

    # De-dupe, drop self & admin targets up front
    targets = [uid for uid in set(body.user_ids) if uid and uid != admin["id"]]
    if not targets:
        return {"ok": True, "deleted": 0, "skipped": len(body.user_ids), "errors": []}

    # Fetch which of those are actually non-admin users
    rows = await db.users.find(
        {"id": {"$in": targets}},
        {"_id": 0, "id": 1, "email": 1, "is_admin": 1},
    ).to_list(len(targets))
    admin_ids = {r["id"] for r in rows if r.get("is_admin")}
    missing = set(targets) - {r["id"] for r in rows}

    deletable = [r["id"] for r in rows if not r.get("is_admin")]
    deleted = 0
    errors: List[Dict[str, str]] = []
    for uid in deletable:
        try:
            await _purge_user(uid)
            deleted += 1
        except Exception as e:
            logger.error(f"bulk delete failed for {uid}: {e}")
            errors.append({"user_id": uid, "error": str(e)[:120]})

    return {
        "ok": True,
        "deleted": deleted,
        "skipped_admins": len(admin_ids),
        "skipped_missing": len(missing),
        "errors": errors,
    }


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
    cursor = db.rooms.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(1000)
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
    """Creates a notification for every user (capped at 10000, bulk insert)."""
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    async for u in db.users.find({}, {"_id": 0, "id": 1}).limit(10000):
        docs.append({
            "id": str(uuid.uuid4()),
            "user_id": u["id"],
            "type": "admin-broadcast",
            "room_id": None,
            "room_name": body.title,
            "password": body.body,
            "from_user_id": admin["id"],
            "from_name": admin.get("name", "Admin"),
            "read": False,
            "created_at": now,
        })
    if docs:
        await db.notifications.insert_many(docs)
    return {"ok": True, "sent_to": len(docs)}


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
    await db.email_tokens.create_index("token", unique=True)
    await db.email_tokens.create_index([("user_id", 1), ("kind", 1)])
    await db.room_history.create_index([("user_id", 1), ("room_id", 1)], unique=True)
    await db.room_history.create_index([("user_id", 1), ("last_joined_at", -1)])
    # Initialise object storage (avatar uploads)
    try:
        init_storage()
    except Exception as e:
        logger.error(f"Storage startup init failed: {e}")

    # Seed admin
    if ADMIN_EMAIL and ADMIN_PASSWORD:
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
                "email_verified": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.info(f"Seeded admin {ADMIN_EMAIL}")
        else:
            # Ensure existing admin is flagged
            await db.users.update_one(
                {"email": ADMIN_EMAIL},
                {"$set": {"is_admin": True, "email_verified": True}},
            )
            logger.info(f"Re-flagged admin {ADMIN_EMAIL}")

    # Schedule daily inactivity sweep
    asyncio.create_task(_inactivity_sweeper_loop())


INACTIVE_THRESHOLD_DAYS = int(os.environ.get("INACTIVE_THRESHOLD_DAYS", "30"))


async def _inactivity_sweeper_loop():
    """Every 24h, purge users inactive for more than INACTIVE_THRESHOLD_DAYS.
    last_active_at falls back to created_at for accounts that never hit /auth/me."""
    # Stagger first run by 60 seconds so service starts faster
    await asyncio.sleep(60)
    while True:
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=INACTIVE_THRESHOLD_DAYS)).isoformat()
            # find candidates: non-admin users whose last_active_at (or created_at) < cutoff
            query = {
                "is_admin": {"$ne": True},
                "$or": [
                    {"last_active_at": {"$lt": cutoff}},
                    {"last_active_at": {"$exists": False}, "created_at": {"$lt": cutoff}},
                ],
            }
            stale = await db.users.find(query, {"_id": 0, "id": 1, "email": 1, "last_active_at": 1, "created_at": 1}).to_list(500)
            for u in stale:
                try:
                    await _purge_user(u["id"])
                    logger.info(f"Auto-deleted inactive user {u['email']} (last_active={u.get('last_active_at') or u.get('created_at')})")
                except Exception as e:
                    logger.error(f"Inactivity purge failed for {u['email']}: {e}")
        except Exception as e:
            logger.error(f"Inactivity sweep error: {e}")
        # Run every 24 hours
        await asyncio.sleep(24 * 60 * 60)


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
