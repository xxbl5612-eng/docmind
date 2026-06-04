"""Collaboration session management service."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cache import KEY_DOC_COLLABORATORS, TTL_DOC_COLLABORATORS, CacheManager
from src.models.collaboration import CollaborationSession, Collaborator, CollaborationInvitation
from src.models.document import Document


class CollaborationService:
    def __init__(self, db: AsyncSession, cache: CacheManager) -> None:
        self.db = db
        self.cache = cache

    async def create_session(
        self,
        doc_id: str,
        owner_id: str,
        max_collaborators: int = 10,
        expires_in_hours: int = 24,
    ) -> CollaborationSession:
        """Create a new collaboration session."""
        session = CollaborationSession(
            document_id=doc_id,
            owner_id=owner_id,
            settings={"max_collaborators": max_collaborators, "expires_in_hours": expires_in_hours},
            expires_at=datetime.now(timezone.utc) + timedelta(hours=expires_in_hours),
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)

        # Add owner as collaborator with edit permission
        collab = Collaborator(
            session_id=session.id,
            user_id=owner_id,
            permission="edit",
            cursor_color=_random_color(),
            joined_at=datetime.now(timezone.utc),
        )
        self.db.add(collab)
        await self.db.commit()

        await self._invalidate_collab_cache(str(doc_id))
        return session

    async def get_session(self, session_id: str) -> CollaborationSession | None:
        stmt = select(CollaborationSession).where(CollaborationSession.id == session_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_sessions(self, doc_id: str) -> list[CollaborationSession]:
        stmt = (select(CollaborationSession)
                .where(CollaborationSession.document_id == doc_id)
                .where(CollaborationSession.status == "active"))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def invite_collaborator(
        self,
        session_id: str,
        inviter_id: str,
        invitee_email: str,
        permission: str = "view",
    ) -> CollaborationInvitation:
        """Create an invitation for a collaborator."""
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=72)

        invitation = CollaborationInvitation(
            session_id=session_id,
            inviter_id=inviter_id,
            invitee_email=invitee_email,
            permission=permission,
            token=token,
            expires_at=expires_at,
        )
        self.db.add(invitation)
        await self.db.commit()
        await self.db.refresh(invitation)
        return invitation

    async def accept_invitation(self, invite_id: str, user_id: str) -> Collaborator | None:
        """Accept an invitation and join the session."""
        stmt = select(CollaborationInvitation).where(CollaborationInvitation.id == invite_id)
        result = await self.db.execute(stmt)
        invitation = result.scalar_one_or_none()

        if invitation is None or invitation.status != "pending":
            return None
        if invitation.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
            invitation.status = "expired"
            await self.db.commit()
            return None

        invitation.status = "accepted"
        invitation.invitee_id = user_id

        collab = Collaborator(
            session_id=invitation.session_id,
            user_id=user_id,
            permission=invitation.permission,
            cursor_color=_random_color(),
            joined_at=datetime.now(timezone.utc),
        )
        self.db.add(collab)
        await self.db.commit()
        await self.db.refresh(collab)

        # Get session to invalidate cache
        session = await self.get_session(invitation.session_id)
        if session:
            await self._invalidate_collab_cache(str(session.document_id))

        return collab

    async def update_permission(
        self, session_id: str, user_id: str, permission: str
    ) -> bool:
        """Update a collaborator's permission."""
        stmt = select(Collaborator).where(
            Collaborator.session_id == session_id,
            Collaborator.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        collab = result.scalar_one_or_none()
        if collab is None:
            return False

        collab.permission = permission
        await self.db.commit()
        return True

    async def remove_collaborator(self, session_id: str, user_id: str) -> bool:
        """Remove a collaborator from a session."""
        stmt = select(Collaborator).where(
            Collaborator.session_id == session_id,
            Collaborator.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        collab = result.scalar_one_or_none()
        if collab is None:
            return False

        await self.db.delete(collab)
        await self.db.commit()

        session = await self.get_session(session_id)
        if session:
            await self._invalidate_collab_cache(str(session.document_id))
        return True

    async def end_session(self, session_id: str, user_id: str) -> bool:
        """End a collaboration session (owner only)."""
        session = await self.get_session(session_id)
        if session is None or str(session.owner_id) != str(user_id):
            return False

        session.status = "closed"
        session.closed_at = datetime.now(timezone.utc)
        await self.db.commit()
        if session:
            await self._invalidate_collab_cache(str(session.document_id))
        return True

    async def get_collaborators(self, session_id: str) -> list[Collaborator]:
        stmt = select(Collaborator).where(Collaborator.session_id == session_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_pending_invitations(self, user_id: str) -> list[CollaborationInvitation]:
        # This would match by email-to-user-id mapping
        stmt = select(CollaborationInvitation).where(
            CollaborationInvitation.invitee_id == user_id,
            CollaborationInvitation.status == "pending",
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _invalidate_collab_cache(self, doc_id: str) -> None:
        await self.cache.delete(KEY_DOC_COLLABORATORS.format(doc_id=doc_id))


_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"]


def _random_color() -> str:
    return _COLORS[hash(str(secrets.randbits(32))) % len(_COLORS)]
