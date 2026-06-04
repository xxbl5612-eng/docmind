"""Authentication service: registration, login, token management."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.cache import KEY_API_KEY, KEY_USER_PROFILE, TTL_USER_PROFILE, CacheManager
from src.core.security import (
    create_access_token,
    create_refresh_token,
    hash_api_key,
    hash_password,
    hash_token,
    verify_password,
)
from src.models.tier import EnterpriseAPIKey
from src.models.user import RefreshToken, User


class AuthService:
    def __init__(self, db: AsyncSession, cache: CacheManager) -> None:
        self.db = db
        self.cache = cache

    async def register(self, email: str, password: str, display_name: str) -> User:
        """Create a new user account."""
        # Check existing
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        if result.scalar_one_or_none():
            raise ValueError("Email already registered")

        user = User(
            email=email,
            password_hash=hash_password(password),
            display_name=display_name,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        # Cache profile
        await self.cache.set(
            KEY_USER_PROFILE.format(user_id=str(user.id)),
            _user_to_cache(user),
            ttl=TTL_USER_PROFILE,
        )

        return user

    async def login(self, email: str, password: str, device_info: str | None = None) -> dict:
        """Authenticate user and return token pair."""
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")

        if not user.is_active:
            raise ValueError("Account is deactivated")

        # Create tokens
        access_token = create_access_token(str(user.id), user.tier)
        plain_refresh, token_hash, expires_at = create_refresh_token()

        refresh = RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            device_info=device_info,
            expires_at=expires_at,
        )
        self.db.add(refresh)

        # Update last login
        user.last_login_at = datetime.now(timezone.utc)
        await self.db.commit()

        # Update cache
        await self.cache.set(
            KEY_USER_PROFILE.format(user_id=str(user.id)),
            _user_to_cache(user),
            ttl=TTL_USER_PROFILE,
        )

        return {
            "access_token": access_token,
            "refresh_token": plain_refresh,
            "token_type": "bearer",
            "expires_in": settings.jwt_access_token_expire_minutes * 60,
            "user": _user_to_cache(user),
        }

    async def refresh_access_token(self, refresh_token: str) -> dict:
        """Exchange refresh token for a new access token."""
        token_hash = hash_token(refresh_token)

        stmt = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
        result = await self.db.execute(stmt)
        token_record = result.scalar_one_or_none()

        if not token_record:
            raise ValueError("Invalid or expired refresh token")

        # Revoke old token (rotation)
        token_record.revoked_at = datetime.now(timezone.utc)

        # Get user
        stmt = select(User).where(User.id == token_record.user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one()
        assert user is not None

        if not user.is_active:
            raise ValueError("Account is deactivated")

        # Issue new tokens
        access_token = create_access_token(str(user.id), user.tier)
        plain_refresh, new_hash, expires_at = create_refresh_token()

        new_token = RefreshToken(
            user_id=user.id,
            token_hash=new_hash,
            device_info=token_record.device_info,
            expires_at=expires_at,
        )
        self.db.add(new_token)
        await self.db.commit()

        return {
            "access_token": access_token,
            "refresh_token": plain_refresh,
            "token_type": "bearer",
            "expires_in": settings.jwt_access_token_expire_minutes * 60,
        }

    async def logout(self, refresh_token: str) -> None:
        """Revoke a refresh token."""
        token_hash = hash_token(refresh_token)
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        result = await self.db.execute(stmt)
        token_record = result.scalar_one_or_none()
        if token_record:
            token_record.revoked_at = datetime.now(timezone.utc)
            await self.db.commit()

    async def get_user_by_id(self, user_id: str) -> User | None:
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def verify_api_key(self, api_key: str) -> User | None:
        """Verify enterprise API key and return associated user/organization."""
        key_hash = hash_api_key(api_key)

        # Check cache first
        cached = await self.cache.get(KEY_API_KEY.format(key_hash=key_hash))
        if cached:
            user = await self.get_user_by_id(cached["user_id"])
            return user

        stmt = select(EnterpriseAPIKey).where(
            EnterpriseAPIKey.key_hash == key_hash,
            EnterpriseAPIKey.is_active.is_(True),
        )
        result = await self.db.execute(stmt)
        api_key_record = result.scalar_one_or_none()

        if api_key_record and (api_key_record.expires_at is None or api_key_record.expires_at > datetime.now(timezone.utc)):
            # Update last used
            api_key_record.last_used_at = datetime.now(timezone.utc)
            await self.db.commit()
            # Cache
            await self.cache.set(
                KEY_API_KEY.format(key_hash=key_hash),
                {"organization_id": str(api_key_record.organization_id) if api_key_record.organization_id else None},
                ttl=300,
            )
            # Return associated user (organization admin)
            return None  # Enterprise key mapping via organization

        return None


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
