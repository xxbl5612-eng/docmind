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

    # Serve frontend static files (must be after API routes)
    import os as _os
    frontend_dist = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), "frontend", "dist", "browser")
    if _os.path.isdir(frontend_dist):
        app.mount("/assets", StaticFiles(directory=_os.path.join(frontend_dist, "assets")), name="frontend_assets")

        @app.get("/favicon.ico", include_in_schema=False)
        async def favicon():
            from fastapi.responses import FileResponse
            return FileResponse(_os.path.join(frontend_dist, "favicon.ico"))

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_frontend(full_path: str):
            if full_path.startswith("api/") or full_path.startswith("local-storage/"):
                from fastapi import HTTPException as _HE
                raise _HE(status_code=404)
            from fastapi.responses import FileResponse
            import os as _os2
            file_path = _os2.path.join(frontend_dist, full_path)
            if full_path and _os2.path.isfile(file_path):
                return FileResponse(file_path)
            return FileResponse(_os2.path.join(frontend_dist, "index.html"))

    return app


app = create_app()
