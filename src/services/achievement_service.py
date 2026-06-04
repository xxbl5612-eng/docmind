"""Achievement and incentive system — points, badges, and milestones."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cache import CacheManager
from src.models.operation_log import OperationLog
from src.models.document import Document
from src.models.collaboration import AIProcessingJob, Collaborator


ACHIEVEMENTS = [
    {"id": "first_doc", "name": "初次上传", "desc": "上传第一份文档", "icon": "upload_file", "points": 10},
    {"id": "doc_10", "name": "文档达人", "desc": "累计上传10份文档", "icon": "folder", "points": 30},
    {"id": "doc_50", "name": "文档专家", "desc": "累计上传50份文档", "icon": "archive", "points": 80},
    {"id": "first_ai", "name": "AI 初体验", "desc": "首次使用 AI 处理", "icon": "psychology", "points": 15},
    {"id": "ai_10", "name": "AI 熟练用户", "desc": "累计完成10次 AI 处理", "icon": "auto_awesome", "points": 40},
    {"id": "ai_50", "name": "AI 高级玩家", "desc": "累计完成50次 AI 处理", "icon": "rocket_launch", "points": 100},
    {"id": "first_collab", "name": "团队协作", "desc": "首次发起协作会话", "icon": "group_work", "points": 20},
    {"id": "collab_5", "name": "协作达人", "desc": "参与5次协作会话", "icon": "diversity_3", "points": 50},
    {"id": "multi_format", "name": "格式全能", "desc": "上传过3种以上格式的文档", "icon": "description", "points": 25},
    {"id": "github_link", "name": "GitHub 集成者", "desc": "关联 GitHub 账户", "icon": "code", "points": 15},
    {"id": "daily_streak_3", "name": "连续3天", "desc": "连续3天使用 DocMind", "icon": "local_fire_department", "points": 20},
    {"id": "daily_streak_7", "name": "周活跃用户", "desc": "连续7天使用 DocMind", "icon": "whatshot", "points": 60},
    {"id": "productivity_80", "name": "高效之星", "desc": "生产力评分达到80分", "icon": "star", "points": 50},
    {"id": "all_tools", "name": "全能大师", "desc": "使用过全部6种 AI 工具", "icon": "workspace_premium", "points": 120},
]


class AchievementService:
    """Track user achievements, points, and milestones."""

    def __init__(self, db: AsyncSession, cache: CacheManager) -> None:
        self.db = db
        self.cache = cache

    async def get_achievements(self, user_id: str) -> dict:
        """Get user's achievement status and points summary."""
        stats = await self._collect_stats(user_id)
        unlocked = self._check_achievements(stats)
        total_points = sum(a["points"] for a in unlocked)

        return {
            "total_points": total_points,
            "achievements_unlocked": len(unlocked),
            "achievements_total": len(ACHIEVEMENTS),
            "achievements": [{
                **a, "unlocked": a in unlocked,
                "progress": self._calc_progress(a["id"], stats),
            } for a in ACHIEVEMENTS],
        }

    async def get_points_history(self, user_id: str) -> list[dict]:
        """Get recent point-earning events for the user."""
        # Derive points from recent operation logs
        result = await self.db.execute(
            select(OperationLog.action, OperationLog.created_at).where(
                OperationLog.user_id == user_id
            ).order_by(OperationLog.created_at.desc()).limit(20)
        )
        history = []
        point_map = {
            "document.upload": 5, "ai.proofread": 3, "ai.rewrite": 3,
            "ai.summarize": 3, "ai.extract": 3, "ai.convert": 3,
            "collaboration.create": 5, "collaboration.invite": 3,
        }
        for action, created_at in result.all():
            pts = point_map.get(action, 1)
            history.append({
                "action": action,
                "points": pts,
                "created_at": created_at.isoformat() if created_at else None,
            })
        return history

    async def _collect_stats(self, user_id: str) -> dict:
        """Gather all statistics needed for achievement checks."""
        doc_count = await self.db.scalar(
            select(func.count()).select_from(Document).where(
                Document.owner_id == user_id, Document.is_deleted.is_(False)
            )
        ) or 0

        format_count = await self.db.scalar(
            select(func.count(func.distinct(Document.input_format))).where(
                Document.owner_id == user_id, Document.is_deleted.is_(False)
            )
        ) or 0

        ai_count = await self.db.scalar(
            select(func.count()).select_from(AIProcessingJob).where(
                AIProcessingJob.user_id == user_id
            )
        ) or 0

        ai_tools = await self.db.execute(
            select(func.distinct(AIProcessingJob.job_type)).where(
                AIProcessingJob.user_id == user_id
            )
        )
        unique_tools = [row[0] for row in ai_tools.all()]

        collab_count = await self.db.scalar(
            select(func.count()).select_from(Collaborator).where(
                Collaborator.user_id == user_id
            )
        ) or 0

        # Daily streak
        streak = await self._calc_streak(user_id)

        return {
            "doc_count": doc_count,
            "format_count": format_count,
            "ai_count": ai_count,
            "unique_tools": unique_tools,
            "collab_count": collab_count,
            "daily_streak": streak,
        }

    async def _calc_streak(self, user_id: str) -> int:
        """Calculate consecutive days of activity."""
        result = await self.db.execute(
            select(func.date(OperationLog.created_at)).where(
                OperationLog.user_id == user_id
            ).distinct().order_by(func.date(OperationLog.created_at).desc()).limit(30)
        )
        dates = [row[0] for row in result.all()]

        if not dates:
            return 0

        from datetime import date, timedelta
        today = date.today()
        streak = 0
        for i in range(30):
            check_date = today - timedelta(days=i)
            if str(check_date) in dates:
                streak += 1
            elif i > 0:
                break
        return streak

    def _check_achievements(self, stats: dict) -> list[dict]:
        """Check which achievements are unlocked."""
        unlocked = []

        checks = {
            "first_doc": stats["doc_count"] >= 1,
            "doc_10": stats["doc_count"] >= 10,
            "doc_50": stats["doc_count"] >= 50,
            "first_ai": stats["ai_count"] >= 1,
            "ai_10": stats["ai_count"] >= 10,
            "ai_50": stats["ai_count"] >= 50,
            "first_collab": stats["collab_count"] >= 1,
            "collab_5": stats["collab_count"] >= 5,
            "multi_format": stats["format_count"] >= 3,
            "daily_streak_3": stats["daily_streak"] >= 3,
            "daily_streak_7": stats["daily_streak"] >= 7,
            "all_tools": len(stats["unique_tools"]) >= 6,
        }

        for a in ACHIEVEMENTS:
            if checks.get(a["id"], False):
                unlocked.append(a)

        return unlocked

    def _calc_progress(self, achievement_id: str, stats: dict) -> dict | None:
        """Calculate progress toward an achievement."""
        progress_map = {
            "first_doc": (stats["doc_count"], 1),
            "doc_10": (stats["doc_count"], 10),
            "doc_50": (stats["doc_count"], 50),
            "first_ai": (stats["ai_count"], 1),
            "ai_10": (stats["ai_count"], 10),
            "ai_50": (stats["ai_count"], 50),
            "first_collab": (stats["collab_count"], 1),
            "collab_5": (stats["collab_count"], 5),
            "multi_format": (stats["format_count"], 3),
            "daily_streak_3": (stats["daily_streak"], 3),
            "daily_streak_7": (stats["daily_streak"], 7),
            "all_tools": (len(stats["unique_tools"]), 6),
        }
        if achievement_id in progress_map:
            current, target = progress_map[achievement_id]
            return {"current": min(current, target), "target": target}
        return None
