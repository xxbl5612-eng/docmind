"""Shared test fixtures for DocMind."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Force dev fallback mode for all tests — no external deps needed
import os
os.environ["USE_DEV_FALLBACK"] = "true"
os.environ["APP_ENV"] = "development"
os.environ["APP_DEBUG"] = "true"
os.environ["APP_SECRET_KEY"] = "test-secret-key-for-pytest-do-not-use-in-production"

from src.config import settings  # noqa: E402
from src.main import create_app, _seed_tiers  # noqa: E402
from src.models.base import Base  # noqa: E402
from src.api.deps import _engine, _async_session_factory  # noqa: E402


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture(autouse=True)
async def reset_db() -> AsyncGenerator[None, None]:
    """Reset database tables before each test and seed tier definitions."""
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await _seed_tiers()
    yield
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    """Get a raw DB session."""
    async with _async_session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def auth_headers(async_client: AsyncClient) -> dict:
    """Register a test user and return auth headers with Bearer token."""
    await async_client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "testpass123",
        "display_name": "Test User",
    })
    resp = await async_client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "testpass123",
    })
    data = resp.json()
    token = data["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
