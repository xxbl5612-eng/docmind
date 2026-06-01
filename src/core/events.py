"""Internal event bus backed by Redis Pub/Sub for cross-process communication."""

from __future__ import annotations

from typing import Any

import orjson
from redis.asyncio import Redis

# ── Channel names ──
CHANNEL_COLLAB_SESSION = "docmind:ws:session:{session_id}"
CHANNEL_DOC_PROCESSING = "docmind:processing:{doc_id}"
CHANNEL_INVALIDATION = "docmind:invalidation"
CHANNEL_USER_NOTIFY = "docmind:notify:{user_id}"


async def publish(redis: Redis, channel: str, message: dict[str, Any]) -> int:
    """Publish a JSON message to a Redis channel."""
    return await redis.publish(channel, orjson.dumps(message))


async def subscribe(redis: Redis, *channels: str):
    """Subscribe to channels and yield parsed messages."""
    pubsub = redis.pubsub()
    await pubsub.subscribe(*channels)
    async for msg in pubsub.listen():
        if msg["type"] == "message":
            try:
                data = orjson.loads(msg["data"])
                yield msg["channel"].decode() if isinstance(msg["channel"], bytes) else msg["channel"], data
            except Exception:
                continue
