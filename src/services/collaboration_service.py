"""Collaboration session management service."""

from __future__ import annotations

import secrets
import uuid
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
        doc_id: uuid.UUID,
        owner_id: uuid.UUID,
        max_collaborators: int = 10,
        expires_in_hours: int = 24,
    ) -> CollaborationSession:
        """Create a new collaboration session."""
        session = CollaborationSession(
            document_id=doc_id,
            owner_id=owner_id,
            settings={"max_collaborators": max_collaborators, "expires_in_hours": expires_in_hours},
            expires_at=(datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)).replace(tzinfo=None),
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

    async def get_session(self, session_id: uuid.UUID) -> CollaborationSession | None:
        stmt = select(CollaborationSession).where(CollaborationSession.id == session_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_sessions(self, doc_id: uuid.UUID) -> list[CollaborationSession]:
        stmt = (select(CollaborationSession)
                .where(CollaborationSession.document_id == doc_id)
                .where(CollaborationSession.status == "active"))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def invite_collaborator(
        self,
        session_id: uuid.UUID,
        inviter_id: uuid.UUID,
        invitee_email: str,
        permission: str = "view",
    ) -> CollaborationInvitation:
        """Create an invitation for a collaborator."""
        token = secrets.token_urlsafe(32)
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=72)).replace(tzinfo=None)

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

    async def accept_invitation(self, invite_id: uuid.UUID, user_id: uuid.UUID) -> Collaborator | None:
        """Accept an invitation and join the session. Works with both email-based and ID-based invites."""
        from src.models.user import User

        stmt = select(CollaborationInvitation).where(CollaborationInvitation.id == invite_id)
        result = await self.db.execute(stmt)
        invitation = result.scalar_one_or_none()

        if invitation is None or invitation.status != "pending":
            return None
        if invitation.expires_at and invitation.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            invitation.status = "expired"
            await self.db.commit()
            return None

        # Verify the accepting user matches the invitation
        user_result = await self.db.execute(select(User.email).where(User.id == user_id))
        user_email = user_result.scalar_one_or_none()

        if invitation.invitee_id is not None and invitation.invitee_id != user_id:
            return None
        if invitation.invitee_id is None and invitation.invitee_email != user_email:
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
        self, session_id: uuid.UUID, user_id: uuid.UUID, permission: str
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

    async def leave_all_sessions(self, doc_id: uuid.UUID, user_id: uuid.UUID) -> int:
        """Remove the current user from all active collaboration sessions on a document. Returns count of sessions left."""
        stmt = select(Collaborator).join(CollaborationSession).where(
            CollaborationSession.document_id == doc_id,
            CollaborationSession.status == "active",
            Collaborator.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        collaborators = list(result.scalars().all())
        for c in collaborators:
            await self.db.delete(c)
        if collaborators:
            await self.db.commit()
            await self._invalidate_collab_cache(str(doc_id))
        return len(collaborators)

    async def remove_collaborator(self, session_id: uuid.UUID, user_id: uuid.UUID) -> bool:
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

    async def end_session(self, session_id: uuid.UUID, user_id: uuid.UUID) -> bool:
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

    async def get_collaborators(self, session_id: uuid.UUID) -> list[Collaborator]:
        stmt = select(Collaborator).where(Collaborator.session_id == session_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def reject_invitation(self, invitation_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Reject a collaboration invitation. Matches by invitee_id or invitee_email."""
        from sqlalchemy import update as _update
        from src.models.user import User

        user_result = await self.db.execute(select(User.email).where(User.id == user_id))
        user_email = user_result.scalar_one_or_none()

        conditions = [
            CollaborationInvitation.id == invitation_id,
            CollaborationInvitation.status == "pending",
        ]
        from sqlalchemy import or_
        id_cond = [CollaborationInvitation.invitee_id == user_id]
        if user_email:
            id_cond.append(CollaborationInvitation.invitee_email == user_email)
        conditions.append(or_(*id_cond))

        stmt = _update(CollaborationInvitation).where(*conditions).values(status="rejected")
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount > 0

    async def get_pending_invitations(self, user_id: uuid.UUID) -> list[CollaborationInvitation]:
        """Get pending invitations: by invitee_id match OR by email match (unregistered invitee)."""
        from sqlalchemy import or_, select as _select
        from src.models.user import User

        # Get user email for matching
        user_result = await self.db.execute(_select(User.email).where(User.id == user_id))
        user_email = user_result.scalar_one_or_none()

        conditions = [CollaborationInvitation.status == "pending"]
        id_or_email = [CollaborationInvitation.invitee_id == user_id]
        if user_email:
            id_or_email.append(CollaborationInvitation.invitee_email == user_email)
        conditions.append(or_(*id_or_email))

        stmt = select(CollaborationInvitation).where(*conditions)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _invalidate_collab_cache(self, doc_id: str) -> None:
        await self.cache.delete(KEY_DOC_COLLABORATORS.format(doc_id=doc_id))


_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"]


def _random_color() -> str:
    return _COLORS[hash(str(secrets.randbits(32))) % len(_COLORS)]
