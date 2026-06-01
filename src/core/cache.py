"""Two-level cache: L1 in-process LRU + L2 Redis distributed."""

from __future__ import annotations

import asyncio
import hashlib
import time
from collections.abc import Callable, Coroutine
from functools import wraps
from typing import Any, TypeVar

import orjson
from cachetools import LRUCache
from redis.asyncio import Redis

from src.config import settings

F = TypeVar("F", bound=Callable[..., Coroutine[Any, Any, Any]])

# ── Cache key prefixes ──
KEY_USER_PROFILE = "docmind:user:{user_id}:profile"
KEY_USER_QUOTAS = "docmind:user:{user_id}:quotas"
KEY_DOC_META = "docmind:doc:{doc_id}:meta"
KEY_DOC_CONTENT = "docmind:doc:{doc_id}:content"
KEY_DOC_VERSIONS = "docmind:doc:{doc_id}:versions"
KEY_DOC_COLLABORATORS = "docmind:doc:{doc_id}:collaborators"
KEY_TIER = "docmind:tier:{tier_name}"
KEY_AI_PROMPT = "docmind:ai:prompt:{task_type}:{language}"
KEY_API_KEY = "docmind:apikey:{key_hash}"
KEY_TASK_STATUS = "docmind:task:{task_id}"
KEY_CACHE_VERSION = "docmind:cache_version:{prefix}"
KEY_GITHUB_REPOS = "docmind:github:{user_id}:repos"
KEY_GITHUB_CONTENTS = "docmind:github:{user_id}:contents:{owner}:{repo}:{path}"
KEY_GITHUB_RATE_LIMIT = "docmind:github:{user_id}:rate_limit"

# ── TTL definitions (seconds) ──
TTL_USER_PROFILE = 900        # 15 min
TTL_USER_QUOTAS = 120         # 2 min
TTL_DOC_META = 300            # 5 min
TTL_DOC_CONTENT = 1800        # 30 min
TTL_DOC_VERSIONS = 300        # 5 min
TTL_DOC_COLLABORATORS = 30    # 30 sec
TTL_TIER = 3600               # 1 hour
TTL_AI_PROMPT = 86400         # 24 hours
TTL_API_KEY = 300             # 5 min
TTL_TASK_STATUS = 10          # 10 sec
TTL_GITHUB_REPOS = 300        # 5 min
TTL_GITHUB_CONTENTS = 120     # 2 min
TTL_GITHUB_RATE_LIMIT = 60    # 1 min


class CacheManager:
    """Two-level cache: L1 (in-process LRU) + L2 (Redis). Falls back to L1-only if Redis unavailable."""

    def __init__(self, redis: Redis | None) -> None:
        self._redis = redis
        self._l1 = LRUCache(maxsize=settings.l1_cache_max_entries)
        self._l1_max_size = settings.l1_cache_max_size_mb * 1024 * 1024
        self._l1_size = 0
        self._stats = {"l1_hits": 0, "l2_hits": 0, "misses": 0, "evictions": 0}
        self._pubsub: asyncio.Task[None] | None = None

    # ── Read path: L1 → L2 → source ──

    async def get(self, key: str, source: Callable[[], Coroutine[Any, Any, Any]] | None = None) -> Any:
        """Get from cache with fallback to source. If source is None, return None on miss."""
        # L1 check
        if key in self._l1:
            self._stats["l1_hits"] += 1
            return self._l1[key]

        # L2 check (skip if no Redis)
        if self._redis is not None:
            try:
                raw = await self._redis.get(key)
                if raw is not None:
                    self._stats["l2_hits"] += 1
                    value = orjson.loads(raw)
                    self._set_l1(key, value)
                    return value
            except Exception:
                pass

        # Miss
        self._stats["misses"] += 1
        if source is None:
            return None

        value = await source()
        if value is not None:
            await self.set(key, value)
        return value

    # ── Write path ──

    async def set(self, key: str, value: Any, ttl: int = TTL_DOC_CONTENT) -> None:
        """Write to both L1 and L2."""
        self._set_l1(key, value)
        if self._redis is not None:
            try:
                await self._redis.set(key, orjson.dumps(value), ex=ttl)
            except Exception:
                pass

    async def delete(self, key: str) -> None:
        """Remove from both levels."""
        self._l1.pop(key, None)
        if self._redis is not None:
            try:
                await self._redis.delete(key)
            except Exception:
                pass

    async def delete_pattern(self, pattern: str) -> None:
        """Remove all L2 keys matching pattern. L1 eviction via prefix matching."""
        prefix = pattern.split(":")[0] if ":" in pattern else pattern
        to_evict = [k for k in self._l1 if k.startswith(prefix)]
        for k in to_evict:
            del self._l1[k]

        if self._redis is not None:
            try:
                keys = await self._redis.keys(pattern)
                if keys:
                    await self._redis.delete(*keys)
            except Exception:
                pass

    async def increment(self, key: str, amount: int = 1, ttl: int = TTL_USER_QUOTAS) -> int:
        """Atomically increment a counter in L2."""
        if self._redis is None:
            return amount
        try:
            val = await self._redis.incrby(key, amount)
            if val == amount:
                await self._redis.expire(key, ttl)
            return val
        except Exception:
            return -1

    # ── Cache versioning for distributed invalidation ──

    async def get_version(self, prefix: str) -> int:
        version_key = KEY_CACHE_VERSION.format(prefix=prefix)
        if self._redis is None:
            return 1
        try:
            v = await self._redis.get(version_key)
            return int(v) if v else 1
        except Exception:
            return 1

    async def bump_version(self, prefix: str) -> int:
        version_key = KEY_CACHE_VERSION.format(prefix=prefix)
        if self._redis is None:
            return 1
        try:
            return await self._redis.incr(version_key)
        except Exception:
            return 1

    async def invalidate_document(self, doc_id: str) -> None:
        """Invalidate all cache entries related to a document."""
        await self.delete(KEY_DOC_META.format(doc_id=doc_id))
        await self.delete(KEY_DOC_CONTENT.format(doc_id=doc_id))
        await self.delete(KEY_DOC_VERSIONS.format(doc_id=doc_id))
        await self.delete(KEY_DOC_COLLABORATORS.format(doc_id=doc_id))
        await self.bump_version(f"doc:{doc_id}")

    async def invalidate_user(self, user_id: str) -> None:
        await self.delete(KEY_USER_PROFILE.format(user_id=user_id))
        await self.delete(KEY_USER_QUOTAS.format(user_id=user_id))
        await self.bump_version(f"user:{user_id}")

    # ── Internal ──

    def _set_l1(self, key: str, value: Any) -> None:
        """Set L1 entry with size-based eviction of overflow."""
        self._l1[key] = value
        # Estimate: largest entries evicted until under limit
        while self._l1_size > self._l1_max_size and len(self._l1) > 1:
            oldest = next(iter(self._l1))
            del self._l1[oldest]
            self._stats["evictions"] += 1

    @property
    def stats(self) -> dict[str, int]:
        return dict(self._stats)

    async def start_invalidation_listener(self) -> None:
        """Listen for cache invalidation messages via Redis Pub/Sub."""
        pubsub = self._redis.pubsub()
        await pubsub.subscribe("docmind:invalidation")
        self._pubsub = asyncio.create_task(self._listen(pubsub))

    async def _listen(self, pubsub: Any) -> None:
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    data = orjson.loads(message["data"])
                    prefix = data.get("prefix", "")
                    to_evict = [k for k in self._l1 if prefix in k]
                    for k in to_evict:
                        del self._l1[k]
                except Exception:
                    pass


# ── Decorator for easy caching ──

def cached(
    key_template: str,
    ttl: int = TTL_DOC_CONTENT,
    unless: Any = None,
):
    """Decorator that caches the return value of an async function.

    The decorated function must accept a `cache` keyword argument (the CacheManager).
    """
    def decorator(func: F) -> F:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            cache: CacheManager = kwargs.pop("cache", None)
            if cache is None:
                return await func(*args, **kwargs)

            cache_key = key_template.format(**kwargs)

            async def source() -> Any:
                return await func(*args, **kwargs, cache=cache)

            result = await cache.get(cache_key, source=source)
            if result is not None and unless is not None and result == unless:
                return result
            if result is not None:
                await cache.set(cache_key, result, ttl=ttl)
            return result

        return wrapper  # type: ignore[return-value]
    return decorator


# ── Redis singleton ──

_redis_instance: Redis | None = None
_redis_disabled: bool = False


def get_redis() -> Redis | None:
    global _redis_instance, _redis_disabled
    if _redis_disabled:
        return None
    if _redis_instance is None:
        from src.config import settings
        if settings.use_dev_fallback:
            _redis_disabled = True
            return None
        try:
            _redis_instance = Redis.from_url(settings.redis_cache_url, decode_responses=False)
        except Exception:
            _redis_disabled = True
            return None
    return _redis_instance


async def close_redis() -> None:
    global _redis_instance
    if _redis_instance is not None:
        await _redis_instance.close()
        _redis_instance = None
