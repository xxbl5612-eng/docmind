"""Celery application factory and configuration."""

from __future__ import annotations

from celery import Celery

from src.config import settings

celery_app = Celery(
    "docmind",
    broker=settings.redis_broker_url,
    backend=settings.redis_result_backend,
    include=[
        "src.workers.document_tasks",
        "src.workers.ai_tasks",
        "src.workers.export_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
    task_soft_time_limit=settings.celery_task_soft_time_limit,
    task_time_limit=settings.celery_task_time_limit,
    result_expires=3600,
    # Queue topology
    task_routes={
        "src.workers.ai_tasks.process_chunk": {"queue": "high_priority"},
        "src.workers.ai_tasks.conduct_long_document_processing": {"queue": "default"},
        "src.workers.ai_tasks.aggregate_results": {"queue": "default"},
        "src.workers.document_tasks.*": {"queue": "default"},
        "src.workers.export_tasks.*": {"queue": "export"},
    },
    task_queues={
        "high_priority": {"binding_key": "high_priority"},
        "default": {"binding_key": "default"},
        "export": {"binding_key": "export"},
        "maintenance": {"binding_key": "maintenance"},
    },
    task_default_queue="default",
    task_default_exchange="tasks",
    task_default_routing_key="default",
)
