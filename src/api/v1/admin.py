"""Admin endpoints: stats, quotas, API keys."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_active_user, get_db
from src.models.user import User
from src.schemas.common import APIResponse
from src.utils.file_utils import SUPPORTED_OUTPUT_FORMATS

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.get("/stats", response_model=APIResponse[dict])
async def system_stats(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func, select
    from src.models.user import User as UserModel
    from src.models.document import Document

    user_count = (await db.execute(select(func.count()).select_from(UserModel).where(UserModel.is_active.is_(True)))).scalar() or 0
    doc_count = (await db.execute(select(func.count()).select_from(Document).where(Document.is_deleted.is_(False)))).scalar() or 0
    total_chars = (await db.execute(select(func.sum(Document.char_count)).select_from(Document).where(Document.is_deleted.is_(False)))).scalar() or 0

    return APIResponse(
        success=True,
        data={
            "total_users": user_count,
            "total_documents": doc_count,
            "total_characters": total_chars,
            "supported_formats": {"input": list(SUPPORTED_OUTPUT_FORMATS), "output": SUPPORTED_OUTPUT_FORMATS},
        },
    )
