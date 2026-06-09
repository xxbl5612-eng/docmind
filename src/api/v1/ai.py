"""General AI assistant chat endpoint (not tied to a specific document)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.deepseek_client import get_deepseek_client
from src.ai.prompts import (
    ASSISTANT_DOC_CONTEXT_SYSTEM,
    ASSISTANT_SYSTEM,
    assistant_doc_user,
    assistant_chat_user,
)
from src.api.deps import get_cache, get_current_active_user, get_db
from src.core.cache import CacheManager
from src.models.document import Document
from src.models.user import User
from src.schemas.common import APIResponse
from src.schemas.processing import ChatRequest, ChatResponse
from src.services.document_service import DocumentService

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat", response_model=APIResponse[ChatResponse])
async def ai_chat(
    body: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    client = get_deepseek_client()

    if body.document_id:
        try:
            doc_id = uuid.UUID(body.document_id)
        except ValueError:
            return APIResponse(success=False, data=None, message="Invalid document ID")

        result = await db.execute(
            select(Document).where(
                Document.id == doc_id,
                Document.owner_id == current_user.id,
                Document.is_deleted.is_(False),
            )
        )
        doc = result.scalar_one_or_none()
        if doc:
            doc_svc = DocumentService(db, cache)
            content_data = await doc_svc.get_content(doc.id, current_user.id)
            content_preview = content_data[:3000] if content_data else "(empty)"

            system_prompt = ASSISTANT_DOC_CONTEXT_SYSTEM.format(
                title=doc.title,
                format=doc.input_format,
                size=f"{doc.file_size_bytes / 1024:.1f} KB",
                chars=doc.char_count or 0,
                content_preview=content_preview,
            )
            user_message = assistant_doc_user(body.messages[-1].content, doc.title)
        else:
            system_prompt = ASSISTANT_SYSTEM
            user_message = assistant_chat_user(body.messages[-1].content)
    else:
        system_prompt = ASSISTANT_SYSTEM
        user_message = assistant_chat_user(body.messages[-1].content)

    api_messages = [{"role": "system", "content": system_prompt}]
    for msg in body.messages[:-1]:
        api_messages.append({"role": msg.role, "content": msg.content})
    api_messages.append({"role": "user", "content": user_message})

    response = await client.chat(api_messages, temperature=0.7, max_tokens=2000)

    return APIResponse(
        success=True,
        data=ChatResponse(
            message=response.content,
            tokens_used=response.usage,
        ),
    )
