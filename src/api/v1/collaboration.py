"""Collaboration endpoints: sessions, invitations, permissions."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_cache, get_current_active_user, get_db, require_document_access, require_tier
from src.core.cache import CacheManager
from src.models.user import User
from src.schemas.collaboration import (
    CollaboratorResponse,
    CreateSessionRequest,
    InvitationResponse,
    InviteRequest,
    SessionResponse,
    UpdatePermissionRequest,
)
from src.schemas.common import APIResponse
from src.services.collaboration_service import CollaborationService
from src.services.operation_log_service import OperationLogService

router = APIRouter(prefix="/documents/{doc_id}/collaboration", tags=["collaboration"])


@router.post("/", response_model=APIResponse[SessionResponse], status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CreateSessionRequest,
    doc = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(require_tier("white_collar")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = CollaborationService(db, cache)
    session = await svc.create_session(
        doc_id=doc.id,
        owner_id=current_user.id,
        max_collaborators=body.max_collaborators or 10,
        expires_in_hours=body.expires_in_hours or 24,
    )
    collaborators = await svc.get_collaborators(session.id)
    session_data = SessionResponse.model_validate(session)
    session_data.collaborators = [CollaboratorResponse.model_validate(c) for c in collaborators]

    log_svc = OperationLogService(db)
    await log_svc.log(user_id=current_user.id, document_id=doc.id, action="collaboration.create", action_category="collaboration", details={"session_id": str(session.id)})

    return APIResponse(success=True, data=session_data, message="Session created")


@router.get("/", response_model=APIResponse[list[SessionResponse]])
async def get_sessions(
    doc = Depends(require_document_access("view")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = CollaborationService(db, cache)
    sessions = await svc.get_active_sessions(doc.id)
    result: list[SessionResponse] = []
    for s in sessions:
        collaborators = await svc.get_collaborators(s.id)
        sd = SessionResponse.model_validate(s)
        sd.collaborators = [CollaboratorResponse.model_validate(c) for c in collaborators]
        result.append(sd)
    return APIResponse(success=True, data=result)


@router.post("/{session_id}/invite", response_model=APIResponse[InvitationResponse])
async def invite_collaborator(
    session_id: str,
    body: InviteRequest,
    doc = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = CollaborationService(db, cache)
    invite = await svc.invite_collaborator(
        session_id=session_id,
        inviter_id=current_user.id,
        invitee_email=body.email,
        permission=body.permission,
    )
    log_svc = OperationLogService(db)
    await log_svc.log(user_id=current_user.id, document_id=doc.id, action="collaboration.invite", action_category="collaboration", details={"invitee": body.email, "permission": body.permission})

    return APIResponse(success=True, data=InvitationResponse.model_validate(invite))


@router.patch("/{session_id}/user/{user_id}", response_model=APIResponse)
async def update_permission(
    session_id: str,
    user_id: str,
    body: UpdatePermissionRequest,
    doc = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = CollaborationService(db, cache)
    ok = await svc.update_permission(session_id, user_id, body.permission)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    log_svc = OperationLogService(db)
    await log_svc.log(user_id=current_user.id, document_id=doc.id, action="collaboration.update_permission", action_category="collaboration")

    return APIResponse(success=True, message="Permission updated")


@router.delete("/{session_id}/user/{user_id}", response_model=APIResponse)
async def remove_collaborator(
    session_id: str,
    user_id: str,
    doc = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = CollaborationService(db, cache)
    ok = await svc.remove_collaborator(session_id, user_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    log_svc = OperationLogService(db)
    await log_svc.log(user_id=current_user.id, document_id=doc.id, action="collaboration.remove", action_category="collaboration")

    return APIResponse(success=True, message="Collaborator removed")


@router.delete("/{session_id}", response_model=APIResponse)
async def end_session(
    session_id: str,
    doc = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = CollaborationService(db, cache)
    ok = await svc.end_session(session_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    log_svc = OperationLogService(db)
    await log_svc.log(user_id=current_user.id, document_id=doc.id, action="collaboration.end", action_category="collaboration")

    return APIResponse(success=True, message="Session ended")
