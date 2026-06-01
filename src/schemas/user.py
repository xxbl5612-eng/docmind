"""User request/response schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class UserProfileResponse(BaseModel):
    id: str
    email: str
    display_name: str
    avatar_url: str | None = None
    tier: str
    tier_expires_at: datetime | None = None
    is_verified: bool
    is_superuser: bool
    preferences: dict | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_validator("id", mode="before")
    @classmethod
    def coerce_uuid(cls, v: Any) -> str:
        if isinstance(v, uuid.UUID):
            return str(v)
        return str(v)


class UserUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=128)
    avatar_url: str | None = None
    preferences: dict | None = None


class UserUsageResponse(BaseModel):
    tier: str
    quota_used_docs: int
    quota_used_ai_calls: int
    quota_used_storage_bytes: int
    quota_period_start: date
    tier_limits: dict


class TierUpgradeRequest(BaseModel):
    target_tier: str = Field(pattern=r"^(white_collar|professional|enterprise)$")


class AdminUserUpdateRequest(BaseModel):
    tier: str | None = None
    is_active: bool | None = None
    is_verified: bool | None = None
    is_superuser: bool | None = None
