"""Document model."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, CHAR, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import UUIDMixin, TimestampMixin, Base as _Base


class Document(_Base, UUIDMixin, TimestampMixin):
    __tablename__ = "documents"

    owner_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    input_format: Mapped[str] = mapped_column(String(16), nullable=False)
    output_format: Mapped[str | None] = mapped_column(String(16), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    char_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="uploading")
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_content_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    folder: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    current_version_id: Mapped[str | None] = mapped_column(CHAR(36), nullable=True)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)

    owner = relationship("User", back_populates="documents")
    versions = relationship("DocumentVersion", back_populates="document", order_by="DocumentVersion.version_number")
    operation_logs = relationship("OperationLog", back_populates="document")
    collaboration_sessions = relationship("CollaborationSession", back_populates="document")
    processing_jobs = relationship("AIProcessingJob", back_populates="document")
