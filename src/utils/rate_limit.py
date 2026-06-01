"""Token bucket rate limiter."""

from __future__ import annotations

import asyncio
import time


class TokenBucketRateLimiter:
    """Token bucket algorithm for rate limiting async operations."""

    def __init__(self, rate: float, burst: int) -> None:
        self.rate = rate  # tokens per second
        self.burst = burst  # max tokens (burst capacity)
        self.tokens = float(burst)
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, tokens: float = 1.0) -> bool:
        """Acquire tokens, waiting if necessary. Returns True when acquired."""
        async with self._lock:
            while True:
                self._refill()
                if self.tokens >= tokens:
                    self.tokens -= tokens
                    return True
                wait = (tokens - self.tokens) / self.rate
                await asyncio.sleep(wait)

    async def try_acquire(self, tokens: float = 1.0) -> bool:
        """Try to acquire tokens without waiting."""
        async with self._lock:
            self._refill()
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.burst, self.tokens + elapsed * self.rate)
        self.last_refill = now
