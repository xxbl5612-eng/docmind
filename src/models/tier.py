"""Tier definition, enterprise API key, and cache invalidation models."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, Numeric, String, Text, Uuid, func
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import UUIDMixin, Base as _Base


class TierDefinition(_Base):
    __tablename__ = "tier_definitions"

    name: Mapped[str] = mapped_column(String(32), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    max_documents_per_month: Mapped[int] = mapped_column(Integer, nullable=False)
    max_ai_calls_per_month: Mapped[int] = mapped_column(Integer, nullable=False)
    max_storage_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    max_document_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    max_document_chars: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    max_file_types: Mapped[list] = mapped_column(JSON, nullable=False)
    supports_async_processing: Mapped[bool] = mapped_column(Boolean, nullable=False)
    supports_collaboration: Mapped[bool] = mapped_column(Boolean, nullable=False)
    supports_api_access: Mapped[bool] = mapped_column(Boolean, nullable=False)
    max_collaborators_per_doc: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_monthly_usd: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )


class EnterpriseAPIKey(_Base, UUIDMixin):
    __tablename__ = "enterprise_api_keys"

    organization_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    permissions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )


class CacheInvalidationKey(_Base):
    __tablename__ = "cache_invalidation_keys"

    key_prefix: Mapped[str] = mapped_column(String(255), primary_key=True)
    version: Mapped[int] = mapped_column(BigInteger, nullable=False, default=1)
