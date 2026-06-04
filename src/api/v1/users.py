"""User management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_cache, get_current_active_user, get_db
from src.core.cache import CacheManager
from src.models.user import User
from src.schemas.common import APIResponse, PaginatedResponse
from src.schemas.user import (
    UserProfileResponse,
    UserUpdateRequest,
)
from src.services.achievement_service import AchievementService
from src.services.recommendation_service import RecommendationService
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


@router.get("/me/recommendations", response_model=APIResponse[dict])
async def get_recommendations(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    """Get personalized AI tool recommendations based on usage patterns."""
    svc = RecommendationService(db, cache)
    recs = await svc.get_recommendations(str(current_user.id))
    return APIResponse(success=True, data=recs)


@router.get("/me/achievements", response_model=APIResponse[dict])
async def get_achievements(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    """Get user achievements, points, and progress."""
    svc = AchievementService(db, cache)
    achievements = await svc.get_achievements(str(current_user.id))
    return APIResponse(success=True, data=achievements)


@router.get("/me/points-history", response_model=APIResponse[list])
async def get_points_history(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    """Get recent points earning history."""
    svc = AchievementService(db, cache)
    history = await svc.get_points_history(str(current_user.id))
    return APIResponse(success=True, data=history)
