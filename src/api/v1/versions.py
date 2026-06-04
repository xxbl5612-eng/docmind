"""Document version endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_cache, get_current_active_user, get_db, require_document_access
from src.core.cache import CacheManager
from src.models.user import User
from src.schemas.common import APIResponse
from src.schemas.version import DiffResponse, VersionContentResponse, VersionListResponse, VersionResponse
from src.services.operation_log_service import OperationLogService
from src.services.version_service import VersionService

router = APIRouter(prefix="/documents/{doc_id}/versions", tags=["versions"])


@router.get("/", response_model=APIResponse[VersionListResponse])
async def list_versions(
    doc = Depends(require_document_access("view")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = VersionService(db, cache)
    versions = await svc.list_versions(doc.id)
    def _to_response(v):
        return VersionResponse(
            id=str(v.id),
            document_id=str(v.document_id),
            version_number=v.version_number,
            char_count=v.char_count,
            change_summary=v.change_summary,
            source=v.source,
            created_by=str(v.created_by) if v.created_by else None,
            created_at=v.created_at,
        )

    return APIResponse(
        success=True,
        data=VersionListResponse(
            items=[_to_response(v) for v in versions],
            total=len(versions),
        ),
    )


@router.get("/{version_id}", response_model=APIResponse[VersionContentResponse])
async def get_version_content(
    version_id: str,
    doc = Depends(require_document_access("view")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = VersionService(db, cache)
    content = await svc.get_version_content(doc.id, uuid.UUID(version_id))
    if content is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    version = await svc.get_version(doc.id, uuid.UUID(version_id))
    return APIResponse(
        success=True,
        data=VersionContentResponse(
            id=str(version.id),
            version_number=version.version_number,
            content=content,
            char_count=version.char_count,
        ),
    )


@router.post("/{version_id}/restore", response_model=APIResponse[VersionResponse])
async def restore_version(
    version_id: str,
    doc = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = VersionService(db, cache)
    new_version = await svc.restore_version(doc.id, uuid.UUID(version_id), current_user.id)
    if new_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    log_svc = OperationLogService(db)
    await log_svc.log(user_id=current_user.id, document_id=doc.id, action="version.restore", action_category="version", details={"restored_from": version_id})

    vr = new_version
    return APIResponse(success=True, data=VersionResponse(
        id=str(vr.id),
        document_id=str(vr.document_id),
        version_number=vr.version_number,
        char_count=vr.char_count,
        change_summary=vr.change_summary,
        source=vr.source,
        created_by=str(vr.created_by) if vr.created_by else None,
        created_at=vr.created_at,
    ))


@router.get("/{ver_a}/diff/{ver_b}", response_model=APIResponse[DiffResponse])
async def diff_versions(
    ver_a: str,
    ver_b: str,
    doc = Depends(require_document_access("view")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = VersionService(db, cache)
    diff = await svc.diff_versions(doc.id, uuid.UUID(ver_a), uuid.UUID(ver_b))
    if diff is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    return APIResponse(success=True, data=DiffResponse(**diff))
