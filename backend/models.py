"""Pydantic request/response models for CinemaSync API.

Extracted from server.py as part of the P2 refactor. All models are
request-body schemas consumed by the route handlers; response shapes
are still built with plain dicts via _room_public / public_user.
"""
from typing import List, Optional
from pydantic import BaseModel, Field, EmailStr


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


class BulkHistoryDeleteIn(BaseModel):
    room_ids: List[str] = Field(default_factory=list)
