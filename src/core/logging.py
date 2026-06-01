"""Structured logging configuration using structlog."""

from __future__ import annotations

import logging
import structlog

from src.config import settings


def configure_logging() -> None:
    renderer: structlog.types.Processor
    if settings.app_env == "production":
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.set_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(settings.log_level)),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Reduce noisy library loggers
    logging.getLogger("aiosqlite").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("redis").setLevel(logging.WARNING)
    logging.getLogger("celery").setLevel(logging.WARNING)


def get_logger(name: str | None = None) -> structlog.BoundLogger:
    return structlog.get_logger(name or __name__)
