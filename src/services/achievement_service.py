"""Achievement and incentive system for DocMind."""
from __future__ import annotations
import uuid
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
    {"id": "multi_format", "name": "格式全能", "desc": "上传过3种以上格式", "icon": "description", "points": 25},
    {"id": "daily_streak_3", "name": "连续3天", "desc": "连续3天使用 DocMind", "icon": "local_fire_department", "points": 20},
    {"id": "daily_streak_7", "name": "周活跃", "desc": "连续7天使用 DocMind", "icon": "whatshot", "points": 60},
    {"id": "all_tools", "name": "全能大师", "desc": "使用过全部6种 AI 工具", "icon": "workspace_premium", "points": 120},
]

class AchievementService:
    def __init__(self, db: AsyncSession, cache: CacheManager) -> None:
        self.db = db; self.cache = cache

    async def get_achievements(self, user_id: str) -> dict:
        uid = uuid.UUID(user_id)
        doc_count = (await self.db.scalar(select(func.count()).select_from(Document).where(
            Document.owner_id == uid, Document.is_deleted == False))) or 0
        ai_count = (await self.db.scalar(select(func.count()).select_from(AIProcessingJob).where(
            AIProcessingJob.user_id == uid))) or 0
        ai_result = await self.db.execute(select(func.distinct(AIProcessingJob.job_type)).where(
            AIProcessingJob.user_id == uid))
        unique_tools = [r[0] for r in ai_result.all()]
        format_count = (await self.db.scalar(select(func.count(func.distinct(Document.input_format))).where(
            Document.owner_id == uid, Document.is_deleted == False))) or 0
        collab_count = (await self.db.scalar(select(func.count()).select_from(Collaborator).where(
            Collaborator.user_id == uid))) or 0
        checks = {"first_doc": doc_count >= 1, "doc_10": doc_count >= 10, "doc_50": doc_count >= 50,
                  "first_ai": ai_count >= 1, "ai_10": ai_count >= 10, "ai_50": ai_count >= 50,
                  "first_collab": collab_count >= 1, "collab_5": collab_count >= 5,
                  "multi_format": format_count >= 3, "all_tools": len(unique_tools) >= 6}
        unlocked = [a for a in ACHIEVEMENTS if checks.get(a["id"], False)]
        return {"total_points": sum(a["points"] for a in unlocked),
                "achievements_unlocked": len(unlocked), "achievements_total": len(ACHIEVEMENTS),
                "achievements": [{**a, "unlocked": checks.get(a["id"], False)} for a in ACHIEVEMENTS]}

    async def get_points_history(self, user_id: str) -> list:
        uid = uuid.UUID(user_id)
        result = await self.db.execute(select(OperationLog.action, OperationLog.created_at).where(
            OperationLog.user_id == uid).order_by(OperationLog.created_at.desc()).limit(20))
        pts = {"document.create": 5, "document.update": 3, "collaboration.create": 5, "collaboration.invite": 3}
        return [{"action": a, "points": pts.get(a, 1), "created_at": t.isoformat() if t else None}
                for a, t in result.all()]
