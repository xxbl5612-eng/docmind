"""Personalized recommendation engine for DocMind."""
from __future__ import annotations
import uuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.cache import CacheManager
from src.models.operation_log import OperationLog
from src.models.document import Document
from src.models.collaboration import AIProcessingJob


class RecommendationService:
    def __init__(self, db: AsyncSession, cache: CacheManager) -> None:
        self.db = db; self.cache = cache

    async def get_recommendations(self, user_id: str) -> dict:
        uid = uuid.UUID(user_id)
        doc_count = (await self.db.scalar(select(func.count()).select_from(Document).where(
            Document.owner_id == uid, Document.is_deleted == False))) or 0
        ai_result = await self.db.execute(select(AIProcessingJob.job_type, func.count()).where(
            AIProcessingJob.user_id == uid).group_by(AIProcessingJob.job_type))
        tools = {r[0]: r[1] for r in ai_result.all()}
        format_result = await self.db.execute(select(Document.input_format, func.count()).where(
            Document.owner_id == uid, Document.is_deleted == False).group_by(Document.input_format))
        formats = {r[0]: r[1] for r in format_result.all()}
        suggestions = []
        if "proofread" not in tools: suggestions.append({"tool": "proofread", "reason": "试试智能校对，自动检查语法和拼写错误"})
        if "summarize" not in tools: suggestions.append({"tool": "summarize", "reason": "长文档太耗时？试试一键生成摘要"})
        if doc_count > 5 and "extract" not in tools: suggestions.append({"tool": "extract", "reason": "文档多了？用信息提取快速找到关键数据"})
        tips = []
        if doc_count == 0: tips.append("上传第一份文档，开始体验 AI 处理能力")
        if doc_count > 10: tips.append("已上传超过10份文档，试试创建文件夹整理")
        score = min(doc_count * 5, 30) + min(len(tools) * 10, 30) + min(doc_count * 2, 40)
        return {"suggested_tools": suggestions[:3], "usage_tips": tips[:2], "productivity_score": min(score, 100),
                "stats_summary": {"total_documents": doc_count, "formats_used": formats, "tools_used": tools}}
