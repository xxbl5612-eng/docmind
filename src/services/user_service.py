"""User management service."""

from __future__ import annotations

import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cache import KEY_USER_PROFILE, KEY_USER_QUOTAS, TTL_USER_PROFILE, CacheManager
from src.models.tier import TierDefinition
from src.models.user import User


class UserService:
    def __init__(self, db: AsyncSession, cache: CacheManager) -> None:
        self.db = db
        self.cache = cache

    async def get_user(self, user_id: uuid.UUID) -> User | None:
        cached = await self.cache.get(KEY_USER_PROFILE.format(user_id=str(user_id)))
        if cached:
            stmt = select(User).where(User.id == user_id)
            result = await self.db.execute(stmt)
            return result.scalar_one_or_none()

        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if user:
            await self.cache.set(
                KEY_USER_PROFILE.format(user_id=str(user_id)),
                _serialize(user),
                ttl=TTL_USER_PROFILE,
            )
        return user

    async def update_user(self, user: User, data: dict) -> User:
        for key, value in data.items():
            if value is not None and hasattr(user, key):
                setattr(user, key, value)
        await self.db.commit()
        await self.db.refresh(user)
        await self.cache.delete(KEY_USER_PROFILE.format(user_id=str(user.id)))
        return user

    async def get_usage(self, user: User) -> dict:
        cached = await self.cache.get(KEY_USER_QUOTAS.format(user_id=str(user.id)))
        if cached:
            return cached

        # Get tier limits
        tier = await self._get_tier(user.tier)
        if tier is None:
            tier_limits = {}
        else:
            tier_limits = {
                "max_documents_per_month": tier.max_documents_per_month,
                "max_ai_calls_per_month": tier.max_ai_calls_per_month,
                "max_storage_bytes": tier.max_storage_bytes,
                "max_document_size_bytes": tier.max_document_size_bytes,
                "max_document_chars": tier.max_document_chars,
                "supports_async_processing": tier.supports_async_processing,
                "supports_collaboration": tier.supports_collaboration,
                "supports_api_access": tier.supports_api_access,
            }

        usage = {
            "tier": user.tier,
            "quota_used_docs": user.quota_used_docs,
            "quota_used_ai_calls": user.quota_used_ai_calls,
            "quota_used_storage_bytes": user.quota_used_storage_bytes,
            "quota_period_start": str(user.quota_period_start),
            "tier_limits": tier_limits,
        }

        await self.cache.set(
            KEY_USER_QUOTAS.format(user_id=str(user.id)),
            usage,
            ttl=120,
        )
        return usage

    async def check_quota(self, user: User, resource: str) -> bool:
        """Check if user has remaining quota for the given resource."""
        tier = await self._get_tier(user.tier)
        if tier is None:
            return False

        if resource == "documents":
            return user.quota_used_docs < tier.max_documents_per_month
        elif resource == "ai_calls":
            return user.quota_used_ai_calls < tier.max_ai_calls_per_month
        elif resource == "storage":
            return user.quota_used_storage_bytes < tier.max_storage_bytes
        return False

    async def increment_quota(self, user: User, resource: str, amount: int = 1) -> None:
        """Increment quota usage."""
        if resource == "documents":
            user.quota_used_docs += amount
        elif resource == "ai_calls":
            user.quota_used_ai_calls += amount
        elif resource == "storage":
            user.quota_used_storage_bytes += amount
        await self.db.commit()
        await self.cache.delete(KEY_USER_QUOTAS.format(user_id=str(user.id)))

    async def _get_tier(self, tier_name: str) -> TierDefinition | None:
        cache_key = f"docmind:tier:{tier_name}"
        cached = await self.cache.get(cache_key)
        if cached:
            return None  # Can't deserialize to ORM model

        stmt = select(TierDefinition).where(
            TierDefinition.name == tier_name,
            TierDefinition.is_active.is_(True),
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_users(self, page: int = 1, page_size: int = 20) -> tuple[list[User], int]:
        stmt = select(User).where(User.is_active.is_(True))
        count_stmt = select(func.count()).select_from(User).where(User.is_active.is_(True))

        total = (await self.db.execute(count_stmt)).scalar() or 0
        users = (await self.db.execute(
            stmt.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )).scalars().all()

        return list(users), total


def _serialize(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "tier": user.tier,
        "tier_expires_at": user.tier_expires_at.isoformat() if user.tier_expires_at else None,
        "is_verified": user.is_verified,
        "is_superuser": user.is_superuser,
        "preferences": user.preferences,
        "created_at": user.created_at.isoformat(),
    }
