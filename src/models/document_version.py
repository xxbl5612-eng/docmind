"""Document version model."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import BigInteger, CHAR, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import UUIDMixin, Base as _Base


class DocumentVersion(_Base, UUIDMixin):
    __tablename__ = "document_versions"

    document_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("documents.id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content_path: Mapped[str] = mapped_column(Text, nullable=False)
    char_count: Mapped[int] = mapped_column(BigInteger, nullable=False)
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    created_by: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )

    document = relationship("Document", back_populates="versions")
