"""User management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_cache, get_current_active_user, get_db
from src.core.cache import CacheManager
from src.models.user import User
from src.schemas.common import APIResponse, PaginatedResponse
from src.schemas.user import (
    AdminUserUpdateRequest,
    TierUpgradeRequest,
    UserProfileResponse,
    UserUpdateRequest,
    UserUsageResponse,
)
from src.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=APIResponse[UserProfileResponse])
async def get_me(current_user: User = Depends(get_current_active_user)):
    return APIResponse(success=True, data=UserProfileResponse.model_validate(current_user))


@router.patch("/me", response_model=APIResponse[UserProfileResponse])
async def update_me(
    body: UserUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = UserService(db, cache)
    user = await svc.update_user(current_user, body.model_dump(exclude_none=True))
    return APIResponse(success=True, data=UserProfileResponse.model_validate(user))


@router.get("/me/usage", response_model=APIResponse[dict])
async def get_usage(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = UserService(db, cache)
    usage = await svc.get_usage(current_user)
    return APIResponse(success=True, data=usage)


@router.put("/me/tier", response_model=APIResponse)
async def request_tier_upgrade(
    body: TierUpgradeRequest,
    current_user: User = Depends(get_current_active_user),
):
    # Tier upgrade would normally go through a payment flow
    # For now, we allow direct upgrades (demo purposes)
    tier_order = ["novice", "white_collar", "professional", "enterprise"]
    if tier_order.index(body.target_tier) <= tier_order.index(current_user.tier) and body.target_tier != "enterprise":
        raise HTTPException(status_code=400, detail="Cannot downgrade tier")
    return APIResponse(success=True, message=f"Tier upgrade to {body.target_tier} requested")
