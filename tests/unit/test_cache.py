import pytest
from src.core.cache import CacheManager


class TestCacheManager:
    @pytest.fixture
    def cache(self) -> CacheManager:
        return CacheManager(redis=None)  # L1-only for unit tests

    async def test_set_and_get(self, cache: CacheManager):
        await cache.set("test:key", {"value": 42}, ttl=60)
        assert await cache.get("test:key") == {"value": 42}

    async def test_get_missing_key_returns_none(self, cache: CacheManager):
        assert await cache.get("nonexistent") is None

    async def test_delete(self, cache: CacheManager):
        await cache.set("test:delete", 123)
        await cache.delete("test:delete")
        assert await cache.get("test:delete") is None

    async def test_get_with_source_fn(self, cache: CacheManager):
        call_count = 0

        async def source():
            nonlocal call_count
            call_count += 1
            return {"from": "source"}

        result = await cache.get("test:source", source)
        assert result == {"from": "source"}
        assert call_count == 1
        # Second call returns cached value without calling source
        result2 = await cache.get("test:source", source)
        assert result2 == {"from": "source"}
        assert call_count == 1  # source not called again

    async def test_increment_redis_only(self, cache: CacheManager):
        # increment only works with Redis (L2), with L1-only it returns amount without storing
        val = await cache.increment("test:counter", amount=5)
        assert val == 5  # returned but not stored in L1

    async def test_delete_pattern(self, cache: CacheManager):
        await cache.set("prefix:a", 1)
        await cache.set("prefix:b", 2)
        await cache.set("other:c", 3)
        await cache.delete_pattern("prefix:*")
        assert await cache.get("prefix:a") is None
        assert await cache.get("prefix:b") is None
        assert await cache.get("other:c") == 3
