from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, CHAR, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import UUIDMixin, TimestampMixin, Base as _Base


class OAuthAccount(_Base, UUIDMixin, TimestampMixin):
    __tablename__ = "oauth_accounts"

    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    provider_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_login: Mapped[str | None] = mapped_column(String(128), nullable=True)
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    provider_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    user = relationship("User", back_populates="oauth_accounts")
