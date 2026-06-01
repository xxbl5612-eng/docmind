"""Celery tasks for document parsing, chunking, and indexing."""

from __future__ import annotations

import hashlib

from celery import chord, group

from src.core.celery_app import celery_app
from src.core.storage import download_file, upload_text
from src.services.parsing_service import parse_document


@celery_app.task(bind=True, queue="default", max_retries=3)
def parse_document_task(self, doc_id: str, storage_path: str, input_format: str):
    """Parse uploaded document and save cleaned text."""
    try:
        raw = download_file(storage_path)
        parsed = parse_document(raw, input_format)
        checksum = hashlib.sha256(parsed.encode("utf-8")).hexdigest()

        # Save parsed content
        parsed_path = storage_path.rsplit(".", 1)[0] + "_parsed.txt"
        upload_text(parsed, parsed_path)

        return {
            "doc_id": doc_id,
            "parsed_path": parsed_path,
            "char_count": len(parsed),
            "checksum": checksum,
        }
    except Exception as exc:
        self.retry(exc=exc, countdown=2 ** self.request.retries * 30)


@celery_app.task(queue="maintenance")
def reset_user_quotas() -> None:
    """Daily quota reset task (called by Celery Beat)."""
    # This would be run by a scheduler (celery beat or cron)
    from datetime import date
    from sqlalchemy import update

    from src.models.user import User
    from src.core.celery_app import celery_app

    # Reset quotas where period_start < today
    pass  # Implementation requires DB sync session management for Celery


@celery_app.task(queue="maintenance")
def flush_quota_counters_to_db() -> None:
    """Periodically flush Redis quota counters to PostgreSQL."""
    pass  # Implementation requires Redis + DB access
