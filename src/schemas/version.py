"""Version management schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class VersionResponse(BaseModel):
    id: str
    document_id: str
    version_number: int
    char_count: int
    change_summary: str | None
    source: str
    created_by: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class VersionListResponse(BaseModel):
    items: list[VersionResponse]
    total: int


class VersionContentResponse(BaseModel):
    id: str
    version_number: int
    content: str
    char_count: int


class DiffResponse(BaseModel):
    version_a: int
    version_b: int
    diff_text: str
    changes_count: int
    additions: int
    deletions: int
