"""Health check endpoint tests."""

import pytest


@pytest.mark.asyncio
async def test_health_check(async_client):
    resp = await async_client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"


@pytest.mark.asyncio
async def test_ready_check(async_client):
    resp = await async_client.get("/api/v1/health/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ready"


@pytest.mark.asyncio
async def test_docs_available(async_client):
    resp = await async_client.get("/docs")
    assert resp.status_code == 200  # docs available with APP_DEBUG=true
