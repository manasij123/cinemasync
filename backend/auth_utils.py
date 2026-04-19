"""Authentication & password helpers for CinemaSync API.

Extracted from server.py as part of the P2 refactor. Uses dependency
injection for the Motor database handle so server.py remains the
single owner of the DB client.
"""
import os
import re
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, Request, Response


JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"


# -- password hashing ---------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# -- JWT access tokens --------------------------------------------------------
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


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


# -- user shape & unique-id ---------------------------------------------------
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


# -- auth dependency factories ------------------------------------------------
def make_auth_deps(db):
    """Builds FastAPI dependencies bound to the given Motor database.

    Returns a triple (get_current_user, require_admin, get_user_from_token_str)
    ready to be used with `Depends(...)` or called directly.
    """

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

    return get_current_user, require_admin, get_user_from_token_str
