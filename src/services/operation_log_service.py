"""Operation log (audit trail) service."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.operation_log import OperationLog


class OperationLogService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def log(
        self,
        user_id: str,
        action: str,
        action_category: str,
        document_id: str | None = None,
        details: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> OperationLog:
        """Record an operation in the audit log."""
        op = OperationLog(
            user_id=user_id,
            document_id=document_id,
            action=action,
            action_category=action_category,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(op)
        await self.db.commit()
        return op

    async def get_document_operations(
        self, doc_id: str, page: int = 1, page_size: int = 50,
    ) -> tuple[list[OperationLog], int]:
        """Get operation history for a document."""
        stmt = select(OperationLog).where(OperationLog.document_id == doc_id)
        count_stmt = select(func.count()).select_from(OperationLog).where(OperationLog.document_id == doc_id)

        total = (await self.db.execute(count_stmt)).scalar() or 0
        ops = (await self.db.execute(
            stmt.order_by(OperationLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )).scalars().all()

        return list(ops), total

    async def get_user_operations(
        self, user_id: str, page: int = 1, page_size: int = 50,
    ) -> tuple[list[OperationLog], int]:
        """Get operation history for a user."""
        stmt = select(OperationLog).where(OperationLog.user_id == user_id)
        count_stmt = select(func.count()).select_from(OperationLog).where(OperationLog.user_id == user_id)

        total = (await self.db.execute(count_stmt)).scalar() or 0
        ops = (await self.db.execute(
            stmt.order_by(OperationLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )).scalars().all()

        return list(ops), total
