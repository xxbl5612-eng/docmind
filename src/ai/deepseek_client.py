"""DeepSeek API client with retry, rate limiting, circuit breaker, and streaming."""

from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

import httpx
import orjson
import structlog

from src.config import settings
from src.utils.rate_limit import TokenBucketRateLimiter

logger = structlog.get_logger()


@dataclass
class ChatResponse:
    content: str
    model: str
    usage: dict
    finish_reason: str


@dataclass
class ChatDelta:
    content: str
    finish_reason: str | None


class CircuitBreaker:
    """Circuit breaker pattern for API resilience."""

    def __init__(self, threshold: int, window: float, recovery: float) -> None:
        self.threshold = threshold
        self.window = window
        self.recovery = recovery
        self._failures: list[float] = []
        self._opened_at: float | None = None

    @property
    def is_open(self) -> bool:
        if self._opened_at is None:
            return False
        if time.monotonic() - self._opened_at > self.recovery:
            self._opened_at = None
            self._failures.clear()
            return False
        return True

    def success(self) -> None:
        self._failures.clear()
        self._opened_at = None

    def failure(self) -> None:
        now = time.monotonic()
        self._failures.append(now)
        # Prune old failures
        self._failures = [f for f in self._failures if now - f < self.window]
        if len(self._failures) >= self.threshold:
            self._opened_at = now
            logger.warning("circuit_breaker_opened", failures=len(self._failures))


class DeepSeekClient:
    """Async client for DeepSeek API with full resilience (retry, rate limit, circuit breaker)."""

    def __init__(self) -> None:
        self._api_key = settings.deepseek_api_key_value
        self._base_url = settings.deepseek_base_url.rstrip("/")
        self._default_model = settings.deepseek_default_model
        self._reasoner_model = settings.deepseek_reasoner_model
        self._max_retries = settings.deepseek_max_retries
        self._timeout = settings.deepseek_request_timeout

        self._rate_limiter = TokenBucketRateLimiter(
            rate=settings.deepseek_rate_limit_rpm / 60.0,
            burst=settings.deepseek_rate_limit_burst,
        )
        self._circuit_breaker = CircuitBreaker(
            threshold=settings.deepseek_circuit_breaker_threshold,
            window=settings.deepseek_circuit_breaker_window,
            recovery=settings.deepseek_circuit_breaker_recovery,
        )
        self._session: httpx.AsyncClient | None = None

    async def _get_session(self) -> httpx.AsyncClient:
        if self._session is None:
            self._session = httpx.AsyncClient(
                base_url=self._base_url,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                timeout=httpx.Timeout(self._timeout),
            )
        return self._session

    async def close(self) -> None:
        if self._session:
            await self._session.aclose()
            self._session = None

    # ── Core chat API ──

    async def chat(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        response_format: dict | None = None,
    ) -> ChatResponse:
        """Send a chat completion request with retry and rate limiting."""
        if self._circuit_breaker.is_open:
            raise DeepSeekCircuitOpenError("Circuit breaker is open")

        await self._rate_limiter.acquire()

        payload: dict[str, Any] = {
            "model": model or self._default_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        if response_format:
            payload["response_format"] = response_format

        session = await self._get_session()

        last_error: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                start = time.monotonic()
                response = await session.post("/chat/completions", json=payload)
                elapsed = time.monotonic() - start

                if response.status_code == 200:
                    data = response.json()
                    self._circuit_breaker.success()
                    choice = data["choices"][0]
                    return ChatResponse(
                        content=choice["message"]["content"],
                        model=data["model"],
                        usage=data.get("usage", {}),
                        finish_reason=choice.get("finish_reason", "stop"),
                    )

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", "1"))
                    logger.warning("deepseek_rate_limited", attempt=attempt, retry_after=retry_after)
                    await asyncio.sleep(retry_after + (2**attempt))
                    continue

                if response.status_code >= 500:
                    logger.warning("deepseek_server_error", status=response.status_code, attempt=attempt)
                    self._circuit_breaker.failure()
                    await asyncio.sleep(2**attempt + (hash(str(time.monotonic())) % 1000) / 1000)
                    continue

                if response.status_code >= 400:
                    error_text = response.text
                    logger.error("deepseek_client_error", status=response.status_code, body=error_text)
                    raise DeepSeekClientError(f"HTTP {response.status_code}: {error_text}")

                last_error = DeepSeekError(f"Unexpected status {response.status_code}")

            except httpx.TimeoutException as e:
                logger.warning("deepseek_timeout", attempt=attempt)
                last_error = e
                await asyncio.sleep(2**attempt)
            except (httpx.NetworkError, httpx.RemoteProtocolError) as e:
                logger.warning("deepseek_network_error", attempt=attempt, error=str(e))
                self._circuit_breaker.failure()
                last_error = e
                await asyncio.sleep(2**attempt)

        raise DeepSeekMaxRetriesError(f"Max retries ({self._max_retries}) exceeded") from last_error

    # ── Streaming API ──

    async def chat_stream(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> AsyncIterator[ChatDelta]:
        """Stream chat completion deltas."""
        if self._circuit_breaker.is_open:
            raise DeepSeekCircuitOpenError("Circuit breaker is open")

        await self._rate_limiter.acquire()

        payload = {
            "model": model or self._default_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        session = await self._get_session()

        async with session.stream("POST", "/chat/completions", json=payload) as response:
            if response.status_code != 200:
                text = await response.aread()
                raise DeepSeekClientError(f"Stream error HTTP {response.status_code}: {text}")

            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        data = orjson.loads(data_str)
                        delta = data["choices"][0].get("delta", {})
                        yield ChatDelta(
                            content=delta.get("content", ""),
                            finish_reason=data["choices"][0].get("finish_reason"),
                        )
                    except orjson.JSONDecodeError:
                        continue

    # ── Convenience methods ──

    async def proofread(self, text: str, system_prompt: str, language: str = "auto") -> ChatResponse:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Language: {language}\n\nText to proofread:\n```\n{text}\n```"},
        ]
        return await self.chat(messages, temperature=0.1, max_tokens=8192)

    async def rewrite(self, text: str, system_prompt: str) -> ChatResponse:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Text to rewrite:\n```\n{text}\n```"},
        ]
        return await self.chat(messages, temperature=0.5, max_tokens=8192)

    async def summarize(self, text: str, system_prompt: str) -> ChatResponse:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Text to summarize:\n```\n{text}\n```"},
        ]
        return await self.chat(messages, temperature=0.2, max_tokens=4096)

    async def extract(self, text: str, system_prompt: str) -> ChatResponse:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Text to extract from:\n```\n{text}\n```"},
        ]
        return await self.chat(
            messages,
            temperature=0.0,
            max_tokens=8192,
            response_format={"type": "json_object"},
        )

    async def convert(self, text: str, system_prompt: str) -> ChatResponse:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Content to convert:\n```\n{text}\n```"},
        ]
        return await self.chat(messages, temperature=0.1, max_tokens=16384)

    async def answer_question(self, question: str, context: str, system_prompt: str) -> ChatResponse:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Context:\n```\n{context}\n```\n\nQuestion: {question}"},
        ]
        return await self.chat(messages, temperature=0.2, max_tokens=4096)

    async def chat_with_system(
        self, system_prompt: str, user_message: str, temperature: float = 0.3, max_tokens: int = 4096
    ) -> ChatResponse:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]
        return await self.chat(messages, temperature=temperature, max_tokens=max_tokens)


# ── Exceptions ──

class DeepSeekError(Exception):
    """Base exception for DeepSeek errors."""


class DeepSeekClientError(DeepSeekError):
    """Client-side error (4xx)."""


class DeepSeekMaxRetriesError(DeepSeekError):
    """All retries exhausted."""


class DeepSeekCircuitOpenError(DeepSeekError):
    """Circuit breaker is open."""


# ── Singleton ──

_deepseek_client: DeepSeekClient | None = None


def get_deepseek_client() -> DeepSeekClient:
    global _deepseek_client
    if _deepseek_client is None:
        _deepseek_client = DeepSeekClient()
    return _deepseek_client
