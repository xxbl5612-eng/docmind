"""Operation log (audit trail) model."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, CHAR, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import UUIDMixin, Base as _Base


class OperationLog(_Base, UUIDMixin):
    __tablename__ = "operation_logs"

    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=False, index=True)
    document_id: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("documents.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    action_category: Mapped[str] = mapped_column(String(32), nullable=False)
    details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), server_default=func.now(), index=True
    )

    user = relationship("User", back_populates="operation_logs")
    document = relationship("Document", back_populates="operation_logs")
