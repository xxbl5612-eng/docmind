"""Document version management service."""

from __future__ import annotations

import difflib
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cache import KEY_DOC_VERSIONS, TTL_DOC_VERSIONS, CacheManager
from src.core.storage import download_text
from src.models.document import Document
from src.models.document_version import DocumentVersion


class VersionService:
    def __init__(self, db: AsyncSession, cache: CacheManager) -> None:
        self.db = db
        self.cache = cache

    async def list_versions(self, doc_id: uuid.UUID) -> list[DocumentVersion]:
        stmt = (select(DocumentVersion)
                .where(DocumentVersion.document_id == doc_id)
                .order_by(DocumentVersion.version_number.desc()))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_version(self, doc_id: uuid.UUID, version_id: uuid.UUID) -> DocumentVersion | None:
        stmt = select(DocumentVersion).where(
            DocumentVersion.id == version_id,
            DocumentVersion.document_id == doc_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_version_content(self, doc_id: uuid.UUID, version_id: uuid.UUID) -> str | None:
        version = await self.get_version(doc_id, version_id)
        if version is None:
            return None
        return download_text(version.content_path)

    async def restore_version(self, doc_id: uuid.UUID, version_id: uuid.UUID, user_id: uuid.UUID) -> DocumentVersion | None:
        """Restore document to a previous version (creates new version)."""
        old_version = await self.get_version(doc_id, version_id)
        if old_version is None:
            return None

        content = download_text(old_version.content_path)

        # Get current max version number
        stmt = select(func.max(DocumentVersion.version_number)).where(
            DocumentVersion.document_id == doc_id
        )
        result = await self.db.execute(stmt)
        max_ver = result.scalar() or 0

        # Save restored content
        content_path = f"users/{user_id}/versions/{doc_id}_v{max_ver + 1}.txt"
        from src.core.storage import upload_text
        upload_text(content, content_path)

        new_version = DocumentVersion(
            document_id=doc_id,
            version_number=max_ver + 1,
            content_path=content_path,
            char_count=len(content),
            change_summary=f"Restored from version {old_version.version_number}",
            source="restore",
            created_by=user_id,
        )
        self.db.add(new_version)
        await self.db.flush()

        # Update document pointer
        stmt = select(Document).where(Document.id == doc_id)
        result = await self.db.execute(stmt)
        doc = result.scalar_one()
        doc.current_version_id = new_version.id
        doc.char_count = len(content)

        await self.db.commit()
        await self.cache.invalidate_document(str(doc_id))
        return new_version

    async def diff_versions(self, doc_id: uuid.UUID, ver_a: uuid.UUID, ver_b: uuid.UUID) -> dict | None:
        """Generate a unified diff between two versions."""
        v_a = await self.get_version(doc_id, ver_a)
        v_b = await self.get_version(doc_id, ver_b)
        if v_a is None or v_b is None:
            return None

        text_a = download_text(v_a.content_path)
        text_b = download_text(v_b.content_path)

        diff = list(difflib.unified_diff(
            text_a.splitlines(keepends=True),
            text_b.splitlines(keepends=True),
            fromfile=f"Version {v_a.version_number}",
            tofile=f"Version {v_b.version_number}",
        ))

        diff_text = "".join(diff)
        additions = sum(1 for line in diff_text.splitlines() if line.startswith("+") and not line.startswith("+++"))
        deletions = sum(1 for line in diff_text.splitlines() if line.startswith("-") and not line.startswith("---"))

        return {
            "version_a": v_a.version_number,
            "version_b": v_b.version_number,
            "diff_text": diff_text,
            "changes_count": additions + deletions,
            "additions": additions,
            "deletions": deletions,
        }
