"""User management service."""

from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cache import KEY_USER_PROFILE, KEY_USER_QUOTAS, TTL_USER_PROFILE, CacheManager
from src.models.tier import TierDefinition
from src.models.user import User


class UserService:
    def __init__(self, db: AsyncSession, cache: CacheManager) -> None:
        self.db = db
        self.cache = cache

    async def get_user(self, user_id: str) -> User | None:
        cached = await self.cache.get(KEY_USER_PROFILE.format(user_id=str(user_id)))
        if cached:
            return _deserialize(cached)

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

        # Always reload from DB to get the latest quota values
        # (user may be a cached/deserialized object with stale quota data)
        stmt = select(User.quota_used_docs, User.quota_used_ai_calls,
                      User.quota_used_storage_bytes, User.tier,
                      User.quota_period_start).where(User.id == user.id)
        result = await self.db.execute(stmt)
        row = result.one()

        # Get tier limits
        tier = await self._get_tier(row.tier)
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
            "tier": row.tier,
            "quota_used_docs": row.quota_used_docs,
            "quota_used_ai_calls": row.quota_used_ai_calls,
            "quota_used_storage_bytes": row.quota_used_storage_bytes,
            "quota_period_start": str(row.quota_period_start),
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
        user = await self._ensure_attached(user)
        if resource == "documents":
            user.quota_used_docs += amount
        elif resource == "ai_calls":
            user.quota_used_ai_calls += amount
        elif resource == "storage":
            user.quota_used_storage_bytes += amount
        user_id = str(user.id)
        await self.db.commit()
        await self.cache.delete(KEY_USER_QUOTAS.format(user_id=user_id))
        await self.cache.delete(KEY_USER_PROFILE.format(user_id=user_id))

    async def decrement_quota(self, user: User, resource: str, amount: int = 1) -> None:
        """Decrement quota usage (e.g. on document delete)."""
        user = await self._ensure_attached(user)
        if resource == "documents":
            user.quota_used_docs = max(0, user.quota_used_docs - amount)
        elif resource == "ai_calls":
            user.quota_used_ai_calls = max(0, user.quota_used_ai_calls - amount)
        elif resource == "storage":
            user.quota_used_storage_bytes = max(0, user.quota_used_storage_bytes - amount)
        user_id = str(user.id)
        await self.db.commit()
        await self.cache.delete(KEY_USER_QUOTAS.format(user_id=user_id))
        await self.cache.delete(KEY_USER_PROFILE.format(user_id=user_id))

    async def _ensure_attached(self, user: User) -> User:
        """Reload user from DB to ensure it's attached to the current session.

        This is necessary because get_user() may return a deserialized object
        from cache that is detached from any SQLAlchemy session.
        """
        stmt = select(User).where(User.id == user.id)
        result = await self.db.execute(stmt)
        fresh = result.scalar_one_or_none()
        if fresh is None:
            raise ValueError("User not found")
        return fresh

    async def _get_tier(self, tier_name: str) -> TierDefinition | None:
        cache_key = f"docmind:tier:{tier_name}"
        cached = await self.cache.get(cache_key)
        if cached:
            return _tier_from_cache(cached)

        stmt = select(TierDefinition).where(
            TierDefinition.name == tier_name,
            TierDefinition.is_active.is_(True),
        )
        result = await self.db.execute(stmt)
        tier = result.scalar_one_or_none()
        if tier:
            await self.cache.set(cache_key, _serialize_tier(tier), ttl=3600)
        return tier

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
        "type": "user",
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "tier": user.tier,
        "tier_expires_at": user.tier_expires_at.isoformat() if user.tier_expires_at else None,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "is_superuser": user.is_superuser,
        "preferences": user.preferences,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _deserialize(data: dict) -> User:
    return User(
        id=data["id"],
        email=data["email"],
        display_name=data["display_name"],
        avatar_url=data.get("avatar_url"),
        tier=data.get("tier", "novice"),
        is_active=data.get("is_active", True),
        is_verified=data.get("is_verified", False),
        is_superuser=data.get("is_superuser", False),
        preferences=data.get("preferences", {}),
    )


def _serialize_tier(tier: TierDefinition) -> dict:
    return {
        "type": "tier",
        "name": tier.name,
        "display_name": tier.display_name,
        "max_documents_per_month": tier.max_documents_per_month,
        "max_ai_calls_per_month": tier.max_ai_calls_per_month,
        "max_storage_bytes": tier.max_storage_bytes,
        "max_document_size_bytes": tier.max_document_size_bytes,
        "max_document_chars": tier.max_document_chars,
        "max_file_types": tier.max_file_types,
        "supports_async_processing": tier.supports_async_processing,
        "supports_collaboration": tier.supports_collaboration,
        "supports_api_access": tier.supports_api_access,
        "max_collaborators_per_doc": tier.max_collaborators_per_doc,
    }


def _tier_from_cache(data: dict) -> TierDefinition | None:
    if data.get("type") != "tier":
        return None
    return TierDefinition(
        name=data["name"],
        display_name=data["display_name"],
        max_documents_per_month=data["max_documents_per_month"],
        max_ai_calls_per_month=data["max_ai_calls_per_month"],
        max_storage_bytes=data["max_storage_bytes"],
        max_document_size_bytes=data["max_document_size_bytes"],
        max_document_chars=data.get("max_document_chars"),
        max_file_types=data.get("max_file_types", []),
        supports_async_processing=data.get("supports_async_processing", False),
        supports_collaboration=data.get("supports_collaboration", False),
        supports_api_access=data.get("supports_api_access", False),
        max_collaborators_per_doc=data.get("max_collaborators_per_doc"),
    )
