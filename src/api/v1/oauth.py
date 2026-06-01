"""GitHub OAuth authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_cache, get_current_active_user, get_db
from src.core.cache import CacheManager
from src.models.user import User
from src.schemas.auth import TokenResponse
from src.schemas.common import APIResponse
from src.schemas.oauth import (
    GitHubLinkRequest,
    GitHubOAuthCallbackRequest,
    OAuthAccountResponse,
)
from src.services.oauth_service import OAuthService

router = APIRouter(prefix="/auth", tags=["oauth"])


@router.get("/github/authorize")
async def github_authorize(
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = OAuthService(db, cache)
    try:
        result = svc.generate_authorization_url("github")
        return APIResponse(success=True, data=result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/github/callback", response_model=APIResponse[TokenResponse])
async def github_callback(
    body: GitHubOAuthCallbackRequest,
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = OAuthService(db, cache)
    try:
        result = await svc.handle_github_callback(body.code, body.state)
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


@router.post("/github/link", response_model=APIResponse[OAuthAccountResponse])
async def github_link(
    body: GitHubLinkRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = OAuthService(db, cache)
    try:
        account = await svc.link_github(current_user, body.code, body.state)
        return APIResponse(
            success=True,
            data=OAuthAccountResponse(
                provider=account.provider,
                provider_login=account.provider_login,
                provider_email=account.provider_email,
                linked_at=account.created_at,
            ),
            message="GitHub account linked",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/github/unlink", response_model=APIResponse)
async def github_unlink(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = OAuthService(db, cache)
    await svc.unlink_oauth_account(current_user, "github")
    return APIResponse(success=True, message="GitHub account unlinked")


@router.get("/oauth-accounts", response_model=APIResponse[list[OAuthAccountResponse]])
async def get_oauth_accounts(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = OAuthService(db, cache)
    accounts = await svc.get_user_oauth_accounts(current_user)
    return APIResponse(
        success=True,
        data=[
            OAuthAccountResponse(
                provider=a.provider,
                provider_login=a.provider_login,
                provider_email=a.provider_email,
                linked_at=a.created_at,
            )
            for a in accounts
        ],
    )
