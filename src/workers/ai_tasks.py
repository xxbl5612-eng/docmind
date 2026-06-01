"""Celery tasks for long-document AI processing."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from celery import chord, group

from src.core.celery_app import celery_app


@celery_app.task(bind=True, queue="default", max_retries=2, acks_late=True)
def conduct_long_document_processing(self, job_id: str, doc_id: str, user_id: str, job_type: str, params: dict):
    """Conductor task: orchestrates chunked AI processing for long documents.

    1. Loads document, runs cleaner, chunker
    2. Dispatches chunk tasks as a Celery group
    3. Chains group with aggregator task via chord
    """
    # Mark job as processing
    _update_job_status(job_id, "processing", started_at=datetime.now(timezone.utc))

    # Load and prepare document
    from src.core.storage import download_text
    from src.ai.cleaner import clean
    from src.ai.chunker import chunk_text, select_strategy
    from src.models.document import Document

    # This runs synchronously in the worker
    doc = _get_document(doc_id)
    if doc is None:
        _update_job_status(job_id, "failed", error="Document not found")
        return

    content_path = doc.parsed_content_path or doc.storage_path
    content = download_text(content_path)

    # Clean and chunk
    cleaned = clean(content, doc.input_format)
    strategy = select_strategy(cleaned, doc.page_count)
    chunks = chunk_text(
        cleaned.clean_text,
        strategy=strategy,
        structure_hints=cleaned.structure_hints,
    )

    # Update job with total chunks
    _update_job_status(job_id, "processing", chunks_total=len(chunks))

    # Serialize chunks for Celery
    chunk_data = [
        {"index": c.index, "text": c.text, "boundary_type": c.boundary_type}
        for c in chunks
    ]

    # Create chunk task group → aggregator chord
    chunk_tasks = [
        process_chunk.s(chunk, job_type, params)
        for chunk in chunk_data
    ]

    if chunk_tasks:
        # Use chord: all chunk tasks run in parallel, then aggregator
        workflow = chord(group(chunk_tasks))(aggregate_results.s(job_id, job_type))
        result = workflow.apply_async()
        return result.id


@celery_app.task(bind=True, queue="high_priority", max_retries=3, acks_late=True, soft_time_limit=600)
def process_chunk(self, chunk: dict, job_type: str, params: dict):
    """Process a single chunk through the AI pipeline."""
    import asyncio

    async def _run():
        from src.ai.pipeline import process_chunk as pipeline_process_chunk
        from src.ai.chunker import Chunk

        c = Chunk(
            index=chunk["index"],
            text=chunk["text"],
            boundary_type=chunk.get("boundary_type", "paragraph"),
        )
        return await pipeline_process_chunk(c, job_type, params)

    try:
        result = asyncio.run(_run())
        # Update chunk completion
        _increment_chunks_completed(chunk.get("_job_id", ""))
        return result
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 10)


@celery_app.task(bind=True, queue="default", max_retries=2)
def aggregate_results(self, chunk_results: list[dict], job_id: str, job_type: str):
    """Aggregate chunk results into a final output."""
    from src.ai.pipeline import aggregate_chunk_results
    from src.core.storage import upload_text

    try:
        # Aggregate
        final_result = aggregate_chunk_results(job_type, chunk_results)

        # Calculate total tokens
        total_tokens = sum(r.get("tokens", {}).get("total_tokens", 0) for r in chunk_results if isinstance(r, dict))

        # Save result
        result_text = final_result if isinstance(final_result, str) else str(final_result)
        import orjson
        result_text = orjson.dumps(final_result).decode("utf-8") if not isinstance(final_result, str) else final_result

        result_path = f"ai_results/{job_id}_{job_type}.txt"
        upload_text(result_text, result_path)

        # Update job as completed
        _update_job_status(
            job_id, "completed",
            result_path=result_path,
            result_summary={"output_length": len(result_text)},
            tokens_used=total_tokens,
            completed_at=datetime.now(timezone.utc),
            progress_pct=100,
        )

        await asyncio.sleep(0)  # Actually this is synchronous in Celery
        # Publish completion event
        _publish_completion(job_id, result_path)

        return {"job_id": job_id, "status": "completed", "result_path": result_path}
    except Exception as exc:
        _update_job_status(job_id, "failed", error=str(exc))
        raise


# ── Synchronous helpers (Celery tasks are sync) ──

def _get_document(doc_id: str):
    """Sync DB lookup for document."""
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session

    from src.config import settings
    from src.models.document import Document

    engine = create_engine(settings.database_url_sync)
    with Session(engine) as session:
        return session.execute(select(Document).where(Document.id == uuid.UUID(doc_id))).scalar_one_or_none()


def _update_job_status(job_id: str, status: str, **kwargs):
    """Sync DB update for AI processing job."""
    from sqlalchemy import create_engine, update
    from sqlalchemy.orm import Session

    from src.config import settings
    from src.models.collaboration import AIProcessingJob

    engine = create_engine(settings.database_url_sync)
    with Session(engine) as session:
        stmt = update(AIProcessingJob).where(AIProcessingJob.id == uuid.UUID(job_id)).values(status=status, **kwargs)
        session.execute(stmt)
        session.commit()


def _increment_chunks_completed(job_id: str):
    """Increment chunks_completed counter."""
    from sqlalchemy import create_engine, text
    from src.config import settings

    engine = create_engine(settings.database_url_sync)
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE ai_processing_jobs SET chunks_completed = COALESCE(chunks_completed, 0) + 1, progress_pct = LEAST(99, (COALESCE(chunks_completed, 0) + 1) * 100.0 / NULLIF(chunks_total, 0)) WHERE id = :id"),
            {"id": job_id},
        )
        conn.commit()


def _publish_completion(job_id: str, result_path: str):
    """Publish job completion event to Redis."""
    import orjson
    from redis import Redis
    from src.config import settings

    try:
        redis = Redis.from_url(settings.redis_cache_url)
        redis.publish(f"docmind:task_complete:{job_id}", orjson.dumps({"job_id": job_id, "status": "completed", "result_path": result_path}))
        redis.close()
    except Exception:
        pass
