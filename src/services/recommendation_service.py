"""Personalized recommendation engine based on user behavior and document patterns."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cache import CacheManager
from src.models.operation_log import OperationLog
from src.models.document import Document
from src.models.collaboration import AIProcessingJob


class RecommendationService:
    """Analyze user behavior and generate personalized recommendations."""

    def __init__(self, db: AsyncSession, cache: CacheManager) -> None:
        self.db = db
        self.cache = cache

    async def get_recommendations(self, user_id: str) -> dict:
        """Generate personalized recommendations based on user's history."""
        stats = await self._gather_stats(user_id)
        return {
            "suggested_tools": self._suggest_tools(stats),
            "usage_tips": self._generate_tips(stats),
            "productivity_score": self._calc_productivity(stats),
            "stats_summary": stats,
        }

    async def _gather_stats(self, user_id: str) -> dict:
        """Collect usage statistics from operation logs, documents, and jobs."""
        # Document stats
        doc_count = await self.db.scalar(
            select(func.count()).select_from(Document).where(
                Document.owner_id == user_id, Document.is_deleted.is_(False)
            )
        ) or 0

        # Document formats used
        format_result = await self.db.execute(
            select(Document.input_format, func.count()).where(
                Document.owner_id == user_id, Document.is_deleted.is_(False)
            ).group_by(Document.input_format)
        )
        formats = {row[0]: row[1] for row in format_result.all()}

        # AI tool usage
        tool_result = await self.db.execute(
            select(AIProcessingJob.job_type, func.count()).where(
                AIProcessingJob.user_id == user_id
            ).group_by(AIProcessingJob.job_type)
        )
        tools = {row[0]: row[1] for row in tool_result.all()}

        # Operation count
        op_count = await self.db.scalar(
            select(func.count()).select_from(OperationLog).where(
                OperationLog.user_id == user_id
            )
        ) or 0

        # Favorite time of day
        time_result = await self.db.execute(
            select(func.strftime("%H", OperationLog.created_at), func.count()).where(
                OperationLog.user_id == user_id
            ).group_by(func.strftime("%H", OperationLog.created_at)).order_by(func.count().desc()).limit(1)
        )
        peak_hour = time_result.scalar_one_or_none()

        return {
            "total_documents": doc_count,
            "total_operations": op_count,
            "formats_used": formats,
            "tools_used": tools,
            "peak_hour": peak_hour or "N/A",
            "favorite_format": max(formats, key=formats.get) if formats else None,
            "favorite_tool": max(tools, key=tools.get) if tools else None,
        }

    def _suggest_tools(self, stats: dict) -> list[dict]:
        """Suggest AI tools based on usage patterns."""
        suggestions = []
        tools_used = stats.get("tools_used", {})

        if "proofread" not in tools_used:
            suggestions.append({"tool": "proofread", "reason": "试试智能校对，自动检查文档中的语法和拼写错误"})
        if "summarize" not in tools_used:
            suggestions.append({"tool": "summarize", "reason": "长文档太耗时？试试一键生成摘要"})
        if "extract" not in tools_used and stats.get("total_documents", 0) > 5:
            suggestions.append({"tool": "extract", "reason": "文档多了？用信息提取快速找到关键数据"})
        if stats.get("total_documents", 0) > 3 and "convert" not in tools_used:
            suggestions.append({"tool": "convert", "reason": "需要格式互转？试试无损格式转换"})

        return suggestions[:3]

    def _generate_tips(self, stats: dict) -> list[str]:
        """Generate personalized usage tips."""
        tips = []
        if stats.get("total_documents", 0) == 0:
            tips.append("上传您的第一份文档，开始体验 AI 处理能力")
        if stats.get("total_documents", 0) > 10:
            tips.append("您已上传超过10份文档，试试创建文件夹来整理它们")
        fav = stats.get("favorite_format")
        if fav and fav in ("pdf", "docx"):
            tips.append(f"您常用 {fav.upper()} 格式，试试一键导出为其他格式")
        return tips[:2]

    def _calc_productivity(self, stats: dict) -> int:
        """Calculate a productivity score (0-100)."""
        score = 0
        doc_count = stats.get("total_documents", 0)
        tool_count = len(stats.get("tools_used", {}))
        op_count = stats.get("total_operations", 0)

        score += min(doc_count * 5, 30)
        score += min(tool_count * 10, 30)
        score += min(op_count // 5, 40)

        return min(score, 100)
