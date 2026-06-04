"""OAuth authentication service for GitHub (and future providers)."""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.cache import KEY_USER_PROFILE, TTL_USER_PROFILE, CacheManager
from src.core.encryption import decrypt_token, encrypt_token
from src.core.security import create_access_token, create_refresh_token, hash_password
from src.models.oauth import OAuthAccount
from src.models.user import User


class OAuthService:
    def __init__(self, db: AsyncSession, cache: CacheManager) -> None:
        self.db = db
        self.cache = cache

    def generate_authorization_url(self, provider: str) -> dict:
        """Generate authorization URL and CSRF state for a provider."""
        if provider == "github":
            state = _create_csrf_state()
            params = {
                "client_id": settings.github_oauth_client_id,
                "redirect_uri": settings.github_oauth_redirect_uri,
                "scope": "read:user user:email repo",
                "state": state,
            }
            qs = "&".join(f"{k}={httpx.URL._encode_param(v)}" for k, v in params.items() if v)
            url = f"https://github.com/login/oauth/authorize?{qs}"
            return {"authorization_url": url, "state": state}
        raise ValueError(f"Unsupported provider: {provider}")

    async def handle_github_callback(self, code: str, state: str) -> dict:
        """Exchange GitHub code, create/find user, return tokens."""
        _verify_csrf_state(state)

        access_token = await _exchange_github_code(code)
        github_user, github_emails = await _get_github_user(access_token)

        provider_user_id = str(github_user["id"])
        provider_login = github_user["login"]
        provider_email = _pick_primary_email(github_emails) if github_emails else github_user.get("email")

        user = await self._find_or_create_github_user(
            provider_user_id=provider_user_id,
            provider_login=provider_login,
            provider_email=provider_email,
            access_token=access_token,
            provider_data=github_user,
        )

        return self._issue_tokens(user)

    async def link_github(self, user: User, code: str, state: str) -> OAuthAccount:
        """Link a GitHub account to an existing user."""
        _verify_csrf_state(state)

        access_token = await _exchange_github_code(code)
        github_user, github_emails = await _get_github_user(access_token)

        provider_user_id = str(github_user["id"])

        existing = await self.db.execute(
            select(OAuthAccount).where(
                OAuthAccount.provider == "github",
                OAuthAccount.provider_user_id == provider_user_id,
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("This GitHub account is already linked to another user")

        account = OAuthAccount(
            user_id=user.id,
            provider="github",
            provider_user_id=provider_user_id,
            provider_email=_pick_primary_email(github_emails) if github_emails else github_user.get("email"),
            provider_login=github_user["login"],
            access_token=encrypt_token(access_token),
            provider_data=github_user,
        )
        self.db.add(account)
        await self.db.commit()
        return account

    async def unlink_oauth_account(self, user: User, provider: str) -> None:
        """Remove an OAuth link from a user."""
        result = await self.db.execute(
            select(OAuthAccount).where(
                OAuthAccount.user_id == user.id,
                OAuthAccount.provider == provider,
            )
        )
        account = result.scalar_one_or_none()
        if account:
            await self.db.delete(account)
            await self.db.commit()

    async def get_user_oauth_accounts(self, user: User) -> list[OAuthAccount]:
        result = await self.db.execute(
            select(OAuthAccount).where(OAuthAccount.user_id == user.id)
        )
        return list(result.scalars().all())

    async def _find_or_create_github_user(
        self,
        provider_user_id: str,
        provider_login: str,
        provider_email: str | None,
        access_token: str,
        provider_data: dict,
    ) -> User:
        existing = await self.db.execute(
            select(OAuthAccount).where(
                OAuthAccount.provider == "github",
                OAuthAccount.provider_user_id == provider_user_id,
            )
        )
        account = existing.scalar_one_or_none()
        if account:
            account.access_token = encrypt_token(access_token)
            account.provider_data = provider_data
            await self.db.commit()

            user_result = await self.db.execute(select(User).where(User.id == account.user_id))
            return user_result.scalar_one()

        if provider_email:
            email_result = await self.db.execute(select(User).where(User.email == provider_email))
            existing_user = email_result.scalar_one_or_none()
            if existing_user:
                account = OAuthAccount(
                    user_id=existing_user.id,
                    provider="github",
                    provider_user_id=provider_user_id,
                    provider_email=provider_email,
                    provider_login=provider_login,
                    access_token=encrypt_token(access_token),
                    provider_data=provider_data,
                )
                self.db.add(account)
                await self.db.commit()
                return existing_user

        user = User(
            email=provider_email or f"github-{provider_user_id}@oauth.docmind.local",
            password_hash=hash_password(secrets.token_urlsafe(32)),
            display_name=provider_login,
            is_verified=True,
            avatar_url=provider_data.get("avatar_url"),
        )
        self.db.add(user)
        await self.db.flush()

        account = OAuthAccount(
            user_id=user.id,
            provider="github",
            provider_user_id=provider_user_id,
            provider_email=provider_email,
            provider_login=provider_login,
            access_token=encrypt_token(access_token),
            provider_data=provider_data,
        )
        self.db.add(account)
        await self.db.commit()
        await self.db.refresh(user)

        await self.cache.set(
            KEY_USER_PROFILE.format(user_id=str(user.id)),
            _user_to_cache(user),
            ttl=TTL_USER_PROFILE,
        )
        return user

    def _issue_tokens(self, user: User) -> dict:
        access_token = create_access_token(str(user.id), user.tier)
        plain_refresh, token_hash, expires_at = create_refresh_token()

        from src.models.user import RefreshToken
        refresh = RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.db.add(refresh)

        user.last_login_at = datetime.now(timezone.utc)

        return {
            "access_token": access_token,
            "refresh_token": plain_refresh,
            "token_type": "bearer",
            "expires_in": settings.jwt_access_token_expire_minutes * 60,
            "user": _user_to_cache(user),
        }


# ── helpers ──

def _create_csrf_state() -> str:
    """Create a signed CSRF state token with a short TTL."""
    from jose import jwt as jose_jwt

    nonce = secrets.token_hex(16)
    payload = {
        "nonce": nonce,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        "type": "github_oauth_state",
    }
    return jose_jwt.encode(payload, settings.app_secret_key_value, algorithm=settings.jwt_algorithm)


def _verify_csrf_state(state: str) -> None:
    from jose import JWTError
    from jose import jwt as jose_jwt

    try:
        payload = jose_jwt.decode(state, settings.app_secret_key_value, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "github_oauth_state":
            raise ValueError("Invalid state type")
    except JWTError:
        raise ValueError("Invalid or expired state parameter")


async def _exchange_github_code(code: str) -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.github_oauth_client_id,
                "client_secret": settings.github_oauth_client_secret_value,
                "code": code,
                "redirect_uri": settings.github_oauth_redirect_uri,
            },
            headers={"Accept": "application/json"},
            timeout=15.0,
        )
        data = resp.json()
        if "error" in data:
            raise ValueError(f"GitHub OAuth error: {data.get('error_description', data['error'])}")
        return data["access_token"]


async def _get_github_user(access_token: str) -> tuple[dict, list[dict] | None]:
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"}
        user_resp = await client.get("https://api.github.com/user", headers=headers, timeout=15.0)
        user_resp.raise_for_status()
        user_data = user_resp.json()

        emails_resp = await client.get("https://api.github.com/user/emails", headers=headers, timeout=15.0)
        emails = emails_resp.json() if emails_resp.status_code == 200 else None

        return user_data, emails


def _pick_primary_email(emails: list[dict]) -> str | None:
    for e in emails:
        if e.get("primary") and e.get("verified"):
            return e["email"]
    for e in emails:
        if e.get("verified"):
            return e["email"]
    return emails[0]["email"] if emails else None


def _user_to_cache(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "tier": user.tier,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "is_superuser": user.is_superuser,
        "preferences": user.preferences,
    }
