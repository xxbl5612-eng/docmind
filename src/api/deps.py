"""FastAPI dependency injection: DB session, current user, permissions, quotas."""

from __future__ import annotations

import uuid
from typing import AsyncGenerator

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings
from src.core.cache import CacheManager, get_redis
from src.core.security import decode_access_token
from src.models.user import User
from src.services.user_service import UserService

# ── Database engine (module-level singleton) ──

_db_url = settings.sqlite_url if settings.use_dev_fallback else settings.database_url
_engine = create_async_engine(_db_url, pool_size=5, echo=settings.app_debug)
_async_session_factory = async_sessionmaker(_engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with _async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_cache() -> AsyncGenerator[CacheManager, None]:
    redis = get_redis()
    cache = CacheManager(redis)
    yield cache


# ── Auth dependencies ──

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
    authorization: str = Header(default=""),
) -> User:
    """Validate JWT and return current user."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header")

    token = authorization[7:]
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token claims")

    # Check revocation (JWT blacklist)
    jti = payload.get("jti")
    if jti:
        try:
            revoked = await cache.get(f"docmind:blacklist:{jti}")
            if revoked:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")
        except Exception:
            pass

    svc = UserService(db, cache)
    user = await svc.get_user(uuid.UUID(user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    request.state.user = user
    request.state.cache = cache
    request.state.db = db
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")
    return current_user


def require_tier(min_tier: str):
    """Dependency factory: require minimum tier level."""
    tiers = {"novice": 0, "white_collar": 1, "professional": 2, "enterprise": 3}

    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        user_level = tiers.get(current_user.tier, 0)
        required_level = tiers.get(min_tier, 0)
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires at least {min_tier} tier",
            )
        return current_user

    return dependency


def require_document_access(permission: str = "view"):
    """Dependency factory: verify document access (owner or collaborator)."""
    from sqlalchemy import select
    from src.models.document import Document
    from src.models.collaboration import Collaborator, CollaborationSession

    async def dependency(
        doc_id: str,
        current_user: User = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db),
    ) -> Document:
        doc_uuid = uuid.UUID(doc_id)
        result = await db.execute(select(Document).where(Document.id == doc_uuid, Document.is_deleted.is_(False)))
        doc = result.scalar_one_or_none()

        if doc is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

        if doc.owner_id == current_user.id:
            return doc

        collab_result = await db.execute(
            select(Collaborator).join(CollaborationSession).where(
                CollaborationSession.document_id == doc_uuid,
                Collaborator.user_id == current_user.id,
                CollaborationSession.status == "active",
            )
        )
        collab = collab_result.scalar_one_or_none()

        if collab is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this document")

        if permission == "edit" and collab.permission == "view":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You only have view access")
        if permission == "edit" and collab.permission == "comment":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You only have comment access")

        return doc

    return dependency


def require_quota(resource: str):
    """Dependency factory: check user has remaining quota."""
    async def dependency(
        current_user: User = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db),
        cache: CacheManager = Depends(get_cache),
    ) -> User:
        svc = UserService(db, cache)
        ok = await svc.check_quota(current_user, resource)
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"You have exhausted your {resource} quota for this period",
            )
        return current_user

    return dependency


# ── Rate limiter for public endpoints ──

_rate_limiters: dict[str, dict] = {}  # keyed by client IP


def rate_limit(max_requests: int = 5, window_seconds: int = 60):
    """Dependency factory: rate limit based on client IP.
    Default: 5 requests per 60s for auth endpoints.
    Skipped in dev fallback / test mode.
    """
    from src.utils.rate_limit import TokenBucketRateLimiter

    async def dependency(request: Request) -> None:
        if settings.use_dev_fallback:
            return  # skip rate limiting in test/dev mode

        key = request.client.host if request.client else "unknown"
        if key not in _rate_limiters:
            _rate_limiters[key] = {
                "limiter": TokenBucketRateLimiter(rate=max_requests / window_seconds, burst=max_requests),
            }
        limiter = _rate_limiters[key]["limiter"]
        if not await limiter.try_acquire(1):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
            )

    return dependency
