"""Document management service: upload, parse, CRUD, export."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.cache import (
    KEY_DOC_CONTENT, KEY_DOC_META, TTL_DOC_CONTENT, TTL_DOC_META,
    CacheManager,
)
from src.core.storage import (
    download_file,
    download_text,
    file_exists,
    generate_object_path,
    get_presigned_url,
    upload_file,
    upload_text,
)
from src.models.document import Document
from src.models.document_version import DocumentVersion
from src.utils.file_utils import detect_format, get_file_extension


class DocumentService:
    def __init__(self, db: AsyncSession, cache: CacheManager) -> None:
        self.db = db
        self.cache = cache

    async def upload(
        self,
        user_id: uuid.UUID,
        filename: str,
        content: bytes,
        mime_type: str | None = None,
        folder: str | None = None,
    ) -> Document:
        """Upload and parse a document."""
        input_format = detect_format(filename, mime_type) or get_file_extension(filename)
        file_size = len(content)
        checksum = hashlib.sha256(content).hexdigest()

        # Store original file
        object_path = generate_object_path(str(user_id), filename, folder or "")
        upload_file(content, object_path, mime_type or "application/octet-stream")

        doc = Document(
            owner_id=user_id,
            title=filename,
            input_format=input_format,
            mime_type=mime_type,
            file_size_bytes=file_size,
            storage_path=object_path,
            checksum_sha256=checksum,
            folder=folder,
            status="uploading",
        )
        self.db.add(doc)
        await self.db.commit()
        await self.db.refresh(doc)
        return doc

    async def save_parsed_content(self, doc_id: uuid.UUID, content: str) -> Document:
        """Save parsed/cleaned content and create initial version."""
        doc = await self._get_doc(doc_id)
        if doc is None:
            raise ValueError("Document not found")

        content_path = doc.storage_path.rsplit(".", 1)[0] + "_parsed.txt"
        upload_text(content, content_path)

        doc.parsed_content_path = content_path
        doc.char_count = len(content)
        doc.status = "ready"

        # Create version 1
        version = DocumentVersion(
            document_id=doc.id,
            version_number=1,
            content_path=content_path,
            char_count=len(content),
            change_summary="Initial upload",
            source="import",
            created_by=doc.owner_id,
        )
        self.db.add(version)
        await self.db.flush()

        doc.current_version_id = version.id
        await self.db.commit()
        await self.db.refresh(doc)

        await self.cache.invalidate_document(str(doc.id))
        return doc

    async def get_document(self, doc_id: uuid.UUID, user_id: uuid.UUID) -> Document | None:
        """Get document by ID with access check."""
        doc = await self._get_doc(doc_id)
        if doc is None or doc.is_deleted:
            return None
        if str(doc.owner_id) != str(user_id):
            return None
        return doc

    async def list_documents(
        self,
        user_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
        doc_type: str | None = None,
    ) -> tuple[list[Document], int]:
        """List user's documents with optional filters."""
        conditions = [
            Document.owner_id == user_id,
            Document.is_deleted.is_(False),
        ]
        if status:
            conditions.append(Document.status == status)
        if doc_type:
            conditions.append(Document.input_format == doc_type)

        stmt = select(Document).where(*conditions)
        count_stmt = select(func.count()).select_from(Document).where(*conditions)

        total = (await self.db.execute(count_stmt)).scalar() or 0
        docs = (await self.db.execute(
            stmt.order_by(Document.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )).scalars().all()

        return list(docs), total

    async def update_metadata(self, doc_id: uuid.UUID, user_id: uuid.UUID, data: dict) -> Document | None:
        doc = await self.get_document(doc_id, user_id)
        if doc is None:
            return None

        for key, value in data.items():
            if value is not None and hasattr(doc, key):
                setattr(doc, key, value)

        doc.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(doc)
        await self.cache.invalidate_document(str(doc_id))
        return doc

    async def delete_document(self, doc_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Soft delete a document."""
        doc = await self.get_document(doc_id, user_id)
        if doc is None:
            return False

        doc.is_deleted = True
        doc.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.cache.invalidate_document(str(doc_id))
        return True

    async def get_content(self, doc_id: uuid.UUID, user_id: uuid.UUID) -> str | None:
        """Get parsed document content."""
        doc = await self.get_document(doc_id, user_id)
        if doc is None or doc.parsed_content_path is None:
            return None

        # Check cache
        cached = await self.cache.get(KEY_DOC_CONTENT.format(doc_id=str(doc_id)))
        if cached:
            return cached

        content = download_text(doc.parsed_content_path)

        if len(content) < 500_000:  # Only cache if < 500KB
            await self.cache.set(KEY_DOC_CONTENT.format(doc_id=str(doc_id)), content, ttl=TTL_DOC_CONTENT)

        return content

    async def update_content(
        self,
        doc_id: uuid.UUID,
        user_id: uuid.UUID,
        content: str,
        change_summary: str | None = None,
    ) -> DocumentVersion | None:
        """Save edited content as a new version."""
        doc = await self.get_document(doc_id, user_id)
        if doc is None:
            return None

        # Get current max version number
        stmt = select(func.max(DocumentVersion.version_number)).where(
            DocumentVersion.document_id == doc.id
        )
        result = await self.db.execute(stmt)
        max_ver = result.scalar() or 1

        # Save content snapshot
        content_path = f"users/{user_id}/versions/{doc_id}_v{max_ver + 1}.txt"
        upload_text(content, content_path)

        version = DocumentVersion(
            document_id=doc.id,
            version_number=max_ver + 1,
            content_path=content_path,
            char_count=len(content),
            change_summary=change_summary or "Manual edit",
            source="user_edit",
            created_by=user_id,
        )
        self.db.add(version)
        await self.db.flush()

        doc.current_version_id = version.id
        doc.char_count = len(content)
        doc.updated_at = datetime.now(timezone.utc)
        await self.db.commit()

        await self.cache.invalidate_document(str(doc_id))
        return version

    async def get_export_url(self, doc_id: uuid.UUID, user_id: uuid.UUID, target_format: str) -> str | None:
        """Get a presigned download URL for an exported document."""
        doc = await self.get_document(doc_id, user_id)
        if doc is None:
            return None

        export_path = f"exports/{doc_id}.{target_format}"
        if not file_exists(export_path):
            return None

        return get_presigned_url(export_path, expires=3600)

    def get_original_file(self, doc: Document) -> bytes | None:
        """Get original uploaded file bytes."""
        try:
            return download_file(doc.storage_path)
        except Exception:
            return None

    async def _get_doc(self, doc_id: uuid.UUID) -> Document | None:
        stmt = select(Document).where(Document.id == doc_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
