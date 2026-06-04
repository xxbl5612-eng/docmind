"""AI processing service: orchestrates sync and async AI operations."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.chunker import Chunk, chunk_text, select_strategy
from src.ai.cleaner import clean, CleanedDocument
from src.ai.pipeline import (
    ProcessingResult,
    process_proofread,
    process_rewrite,
    process_summarize,
    process_extract,
    process_convert,
    process_qa,
)
from src.config import settings
from src.core.cache import CacheManager
from src.core.celery_app import celery_app
from src.models.collaboration import AIProcessingJob
from src.models.document import Document


class AIService:
    def __init__(self, db: AsyncSession, cache: CacheManager) -> None:
        self.db = db
        self.cache = cache

    # ── Sync operations (short documents) ──

    async def _safe_run(self, coro, task_name: str) -> ProcessingResult:
        try:
            return await coro
        except Exception as e:
            import uuid as _uuid
            logger = __import__('structlog').get_logger()
            logger.error(f"ai_{task_name}_failed", error=str(e))
            return ProcessingResult(
                task_id=_uuid.uuid4().hex,
                status="failed",
                result=None,
                error=f"{task_name} failed: {str(e)[:200]}",
            )

    async def proofread(self, doc: Document, language: str = "auto", style_guide: str | None = None) -> ProcessingResult:
        content = await self._get_content(doc)
        cleaned = clean(content, doc.input_format)
        return await self._safe_run(process_proofread(cleaned.clean_text, language=language, style_guide=style_guide), "proofread")

    async def rewrite(
        self, doc: Document, tone: str = "professional", audience: str = "general",
        length: str = "similar", instructions: str | None = None,
    ) -> ProcessingResult:
        content = await self._get_content(doc)
        cleaned = clean(content, doc.input_format)
        return await self._safe_run(process_rewrite(cleaned.clean_text, tone=tone, audience=audience, length=length, instructions=instructions), "rewrite")

    async def summarize(
        self, doc: Document, length: str = "medium", format_type: str = "paragraph", focus: str | None = None,
    ) -> ProcessingResult:
        content = await self._get_content(doc)
        cleaned = clean(content, doc.input_format)
        return await self._safe_run(process_summarize(cleaned.clean_text, length=length, format_type=format_type, focus=focus), "summarize")

    async def extract(
        self, doc: Document, extract_type: str = "entities", custom_schema: dict | None = None,
    ) -> ProcessingResult:
        content = await self._get_content(doc)
        cleaned = clean(content, doc.input_format)
        return await self._safe_run(process_extract(cleaned.clean_text, extract_type=extract_type, custom_schema=custom_schema), "extract")

    async def convert(self, doc: Document, target_format: str, preserve_structure: bool = True) -> ProcessingResult:
        content = await self._get_content(doc)
        cleaned = clean(content, doc.input_format)
        return await self._safe_run(process_convert(cleaned.clean_text, target_format=target_format, preserve_structure=preserve_structure), "convert")

    async def qa(self, doc: Document, question: str) -> ProcessingResult:
        content = await self._get_content(doc)
        return await self._safe_run(process_qa(question=question, context=content), "qa")

    # ── Async operations (long documents) ──

    async def dispatch_async(
        self,
        doc: Document,
        user_id: uuid.UUID,
        job_type: str,
        params: dict[str, Any],
    ) -> AIProcessingJob:
        """Dispatch a long-document AI task to Celery."""
        job = AIProcessingJob(
            task_id=uuid.uuid4(),
            user_id=user_id,
            document_id=doc.id,
            job_type=job_type,
            status="queued",
            input_params=params,
        )
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)

        # Dispatch conductor task
        celery_app.send_task(
            "src.workers.ai_tasks.conduct_long_document_processing",
            args=[str(job.id), str(doc.id), str(user_id), job_type, params],
            queue="default",
        )

        return job

    async def is_long_document(self, doc: Document) -> bool:
        """Check if document exceeds sync processing threshold."""
        threshold = settings.doc_max_sync_chars
        return (doc.char_count or 0) > threshold

    async def get_job_status(self, task_id: uuid.UUID) -> AIProcessingJob | None:
        stmt = select(AIProcessingJob).where(AIProcessingJob.task_id == task_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_jobs(self, user_id: uuid.UUID, page: int = 1, page_size: int = 20) -> list[AIProcessingJob]:
        stmt = (select(AIProcessingJob)
                .where(AIProcessingJob.user_id == user_id)
                .order_by(AIProcessingJob.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def cancel_job(self, task_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        job = await self.get_job_status(task_id)
        if job is None or str(job.user_id) != str(user_id):
            return False
        if job.status in ("completed", "failed", "cancelled"):
            return False

        job.status = "cancelled"
        job.completed_at = datetime.now(timezone.utc)
        await self.db.commit()

        # Send cancellation signal via Redis
        await self.cache._redis.publish("docmind:cancellation", str(task_id))
        return True

    async def _get_content(self, doc: Document) -> str:
        from src.core.storage import download_text
        if doc.parsed_content_path:
            return download_text(doc.parsed_content_path)
        return download_text(doc.storage_path)
