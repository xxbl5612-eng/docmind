"""Authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_cache, get_db, rate_limit
from src.core.cache import CacheManager
from src.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from src.schemas.common import APIResponse
from src.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=APIResponse[dict], status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
    _: None = Depends(rate_limit(max_requests=5, window_seconds=60)),
):
    svc = AuthService(db, cache)
    try:
        user = await svc.register(body.email, body.password, body.display_name)
        return APIResponse(success=True, data={"id": str(user.id), "email": user.email}, message="Registration successful")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/login", response_model=APIResponse[TokenResponse])
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
    _: None = Depends(rate_limit(max_requests=10, window_seconds=60)),
):
    svc = AuthService(db, cache)
    try:
        device_info = request.headers.get("User-Agent")
        result = await svc.login(body.email, body.password, device_info)
        return APIResponse(
            success=True,
            data=TokenResponse(
                access_token=result["access_token"],
                refresh_token=result["refresh_token"],
                expires_in=result["expires_in"],
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/refresh", response_model=APIResponse[TokenResponse])
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AuthService(db, cache)
    try:
        result = await svc.refresh_access_token(body.refresh_token)
        return APIResponse(
            success=True,
            data=TokenResponse(
                access_token=result["access_token"],
                refresh_token=result["refresh_token"],
                expires_in=result["expires_in"],
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/logout", response_model=APIResponse)
async def logout(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AuthService(db, cache)
    await svc.logout(body.refresh_token)
    return APIResponse(success=True, message="Logged out")
