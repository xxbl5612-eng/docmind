"""Operation log (audit trail) endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_active_user, get_db, require_document_access
from src.models.user import User
from src.schemas.common import APIResponse, PaginatedResponse
from src.services.operation_log_service import OperationLogService

router = APIRouter(tags=["operations"])


@router.get("/documents/{doc_id}/operations", response_model=APIResponse[PaginatedResponse])
async def get_document_operations(
    doc = Depends(require_document_access("view")),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    svc = OperationLogService(db)
    ops, total = await svc.get_document_operations(doc.id, page=page, page_size=page_size)
    items = [_serialize_op(op) for op in ops]
    return APIResponse(
        success=True,
        data=PaginatedResponse(items=items, total=total, page=page, page_size=page_size, total_pages=(total + page_size - 1) // page_size),
    )


@router.get("/users/me/operations", response_model=APIResponse[PaginatedResponse])
async def get_user_operations(
    current_user: User = Depends(get_current_active_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    svc = OperationLogService(db)
    ops, total = await svc.get_user_operations(current_user.id, page=page, page_size=page_size)
    items = [_serialize_op(op) for op in ops]
    return APIResponse(
        success=True,
        data=PaginatedResponse(items=items, total=total, page=page, page_size=page_size, total_pages=(total + page_size - 1) // page_size),
    )


def _serialize_op(op) -> dict:
    return {
        "id": str(op.id),
        "user_id": str(op.user_id),
        "document_id": str(op.document_id) if op.document_id else None,
        "action": op.action,
        "action_category": op.action_category,
        "details": op.details,
        "created_at": op.created_at.isoformat(),
    }
