"""Authentication endpoint tests."""

import pytest


class TestRegister:
    @pytest.mark.asyncio
    async def test_register_success(self, async_client):
        resp = await async_client.post("/api/v1/auth/register", json={
            "email": "newuser@example.com",
            "password": "securepass123",
            "display_name": "New User",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["email"] == "newuser@example.com"

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, async_client):
        body = {"email": "dup@example.com", "password": "securepass123", "display_name": "Dup"}
        await async_client.post("/api/v1/auth/register", json=body)
        resp = await async_client.post("/api/v1/auth/register", json=body)
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_register_short_password(self, async_client):
        resp = await async_client.post("/api/v1/auth/register", json={
            "email": "short@example.com",
            "password": "1234567",  # < 8 chars
            "display_name": "Short",
        })
        assert resp.status_code == 422  # validation error


class TestLogin:
    @pytest.mark.asyncio
    async def test_login_success(self, async_client):
        await async_client.post("/api/v1/auth/register", json={
            "email": "login@example.com",
            "password": "securepass123",
            "display_name": "Login User",
        })
        resp = await async_client.post("/api/v1/auth/login", json={
            "email": "login@example.com",
            "password": "securepass123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "access_token" in data["data"]
        assert "refresh_token" in data["data"]
        assert data["data"]["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, async_client):
        await async_client.post("/api/v1/auth/register", json={
            "email": "wrong@example.com",
            "password": "securepass123",
            "display_name": "Wrong PW",
        })
        resp = await async_client.post("/api/v1/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, async_client):
        resp = await async_client.post("/api/v1/auth/login", json={
            "email": "nobody@example.com",
            "password": "whatever",
        })
        assert resp.status_code == 401


class TestProtectedRoutes:
    @pytest.mark.asyncio
    async def test_unauthenticated_access_returns_401(self, async_client):
        resp = await async_client.get("/api/v1/users/me")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_authenticated_access_works(self, async_client, auth_headers):
        resp = await async_client.get("/api/v1/users/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["email"] == "test@example.com"


class TestTokenRefresh:
    @pytest.mark.asyncio
    async def test_refresh_token_works(self, async_client):
        await async_client.post("/api/v1/auth/register", json={
            "email": "refresh@example.com",
            "password": "securepass123",
            "display_name": "Refresh",
        })
        login_resp = await async_client.post("/api/v1/auth/login", json={
            "email": "refresh@example.com",
            "password": "securepass123",
        })
        refresh_token = login_resp.json()["data"]["refresh_token"]

        resp = await async_client.post("/api/v1/auth/refresh", json={
            "refresh_token": refresh_token,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data["data"]

    @pytest.mark.asyncio
    async def test_refresh_with_invalid_token(self, async_client):
        resp = await async_client.post("/api/v1/auth/refresh", json={
            "refresh_token": "invalid-token",
        })
        assert resp.status_code == 401
