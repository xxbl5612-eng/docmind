"""Collaboration request/response schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class CreateSessionRequest(BaseModel):
    max_collaborators: int | None = Field(default=None, ge=1, le=50)
    expires_in_hours: int | None = Field(default=24, ge=1, le=720)


class SessionResponse(BaseModel):
    id: str
    document_id: str
    owner_id: str
    status: str
    settings: dict
    collaborators: list["CollaboratorResponse"]
    created_at: datetime
    expires_at: datetime | None

    model_config = {"from_attributes": True}


class CollaboratorResponse(BaseModel):
    id: str
    user_id: str
    display_name: str | None = None
    permission: str
    cursor_color: str | None
    joined_at: datetime | None
    last_active_at: datetime | None

    model_config = {"from_attributes": True}


class InviteRequest(BaseModel):
    email: EmailStr
    permission: str = Field(default="view", pattern=r"^(view|comment|edit)$")


class UpdatePermissionRequest(BaseModel):
    permission: str = Field(pattern=r"^(view|comment|edit)$")


class InvitationResponse(BaseModel):
    id: str
    session_id: str
    inviter_id: str
    invitee_email: str
    permission: str
    status: str
    token: str
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
