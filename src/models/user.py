"""User and RefreshToken models."""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, CHAR, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import UUIDMixin, TimestampMixin, Base as _Base


class User(_Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    tier: Mapped[str] = mapped_column(String(32), nullable=False, default="novice")
    tier_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    preferences: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    quota_used_docs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quota_used_ai_calls: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quota_used_storage_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quota_period_start: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    refresh_tokens = relationship("RefreshToken", back_populates="user")
    documents = relationship("Document", back_populates="owner", foreign_keys="Document.owner_id")
    collaboration_sessions = relationship("CollaborationSession", back_populates="owner", foreign_keys="CollaborationSession.owner_id")
    collaborators = relationship("Collaborator", back_populates="user", foreign_keys="Collaborator.user_id")
    operation_logs = relationship("OperationLog", back_populates="user", foreign_keys="OperationLog.user_id")
    processing_jobs = relationship("AIProcessingJob", back_populates="user", foreign_keys="AIProcessingJob.user_id")
    oauth_accounts = relationship("OAuthAccount", back_populates="user")


class RefreshToken(_Base, UUIDMixin):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    device_info: Mapped[str | None] = mapped_column(String(512), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )

    user = relationship("User", back_populates="refresh_tokens")
