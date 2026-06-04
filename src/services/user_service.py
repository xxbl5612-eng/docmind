"""User management service."""

from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cache import KEY_USER_PROFILE, TTL_USER_PROFILE, CacheManager
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
        """Return placeholder usage data (tier system removed)."""
        return {
            "tier": "free",
            "quota_used_docs": 0,
            "quota_used_ai_calls": 0,
            "quota_used_storage_bytes": 0,
            "quota_period_start": "",
            "tier_limits": {},
        }

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
        is_active=data.get("is_active", True),
        is_verified=data.get("is_verified", False),
        is_superuser=data.get("is_superuser", False),
        preferences=data.get("preferences", {}),
    )



