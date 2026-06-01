"""FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.api.v1.router import v1_router
from src.api.ws.collaboration import ws_router
from src.config import settings
from src.core.logging import configure_logging, get_logger
from src.models.base import Base

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    configure_logging()
    logger.info("starting", env=settings.app_env, fallback=settings.use_dev_fallback)

    # Startup: init DB tables
    from src.api.deps import _engine
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_tiers()

    # Try Redis ping if available
    try:
        from src.core.cache import get_redis
        redis = get_redis()
        if redis is not None:
            await redis.ping()
            logger.info("redis connected")
    except Exception:
        logger.warning("redis unavailable, using L1 cache only")

    yield

    # Shutdown
    try:
        from src.ai.deepseek_client import get_deepseek_client
        await get_deepseek_client().close()
    except Exception:
        logger.warning("deepseek client close failed", exc_info=True)
    try:
        from src.core.cache import close_redis
        await close_redis()
    except Exception:
        logger.warning("redis close failed", exc_info=True)


async def _seed_tiers() -> None:
    """Seed default tier definitions if they don't exist."""
    from sqlalchemy import select
    from src.api.deps import _async_session_factory
    from src.models.tier import TierDefinition

    tiers = [
        TierDefinition(name="novice", display_name="Novice", max_documents_per_month=10, max_ai_calls_per_month=20, max_storage_bytes=100_000_000, max_document_size_bytes=5_000_000, max_document_chars=50_000, max_file_types=["pdf","docx","txt","md","html","pptx","xlsx","csv"], supports_async_processing=False, supports_collaboration=False, supports_api_access=False, max_collaborators_per_doc=0, price_monthly_usd=0),
        TierDefinition(name="white_collar", display_name="White-Collar", max_documents_per_month=50, max_ai_calls_per_month=100, max_storage_bytes=500_000_000, max_document_size_bytes=25_000_000, max_document_chars=200_000, max_file_types=["pdf","docx","txt","md","html","pptx","xlsx","csv","png","jpg"], supports_async_processing=True, supports_collaboration=True, supports_api_access=False, max_collaborators_per_doc=3, price_monthly_usd=9.99),
        TierDefinition(name="professional", display_name="Professional", max_documents_per_month=200, max_ai_calls_per_month=500, max_storage_bytes=2_000_000_000, max_document_size_bytes=100_000_000, max_document_chars=None, max_file_types=["pdf","docx","txt","md","html","pptx","xlsx","csv","png","jpg"], supports_async_processing=True, supports_collaboration=True, supports_api_access=False, max_collaborators_per_doc=10, price_monthly_usd=29.99),
        TierDefinition(name="enterprise", display_name="Enterprise", max_documents_per_month=2_147_483_647, max_ai_calls_per_month=2_147_483_647, max_storage_bytes=50_000_000_000, max_document_size_bytes=500_000_000, max_document_chars=None, max_file_types=["pdf","docx","txt","md","html","pptx","xlsx","csv","png","jpg"], supports_async_processing=True, supports_collaboration=True, supports_api_access=True, max_collaborators_per_doc=None, price_monthly_usd=99.99),
    ]

    async with _async_session_factory() as session:
        result = await session.execute(select(TierDefinition))
        existing = result.scalars().all()
        if not existing:
            session.add_all(tiers)
            await session.commit()


def create_app() -> FastAPI:
    app = FastAPI(
        title="DocMind",
        description="Full-Scenario Intelligent Document Processing Assistant",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.app_debug else None,
        redoc_url="/redoc" if settings.app_debug else None,
    )

    # CORS
    cors_origins = ["http://localhost:5173", "http://localhost:3000"]
    if settings.app_env == "production":
        cors_origins = settings.cors_allowed_origins_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security headers
    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains" if settings.app_env == "production" else "max-age=0"
        return response

    # Routers
    app.include_router(v1_router)
    app.include_router(ws_router)

    # Serve local storage files in dev mode
    if settings.use_dev_fallback:
        from src.core.storage import _LOCAL_ROOT
        _LOCAL_ROOT.mkdir(exist_ok=True)
        app.mount("/local-storage", StaticFiles(directory=str(_LOCAL_ROOT)), name="local_storage")

    @app.get("/api/v1/health")
    async def health():
        return {"status": "ok", "version": "0.1.0", "fallback_mode": settings.use_dev_fallback}

    @app.get("/api/v1/health/ready")
    async def ready():
        return {"status": "ready", "fallback_mode": settings.use_dev_fallback}

    return app


app = create_app()
