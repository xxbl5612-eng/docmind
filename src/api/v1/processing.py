"""AI processing endpoints: proofread, rewrite, summarize, extract, convert, Q&A."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import (
    get_cache,
    get_current_active_user,
    get_db,
    require_document_access,
    require_quota,
    require_tier,
)
from src.core.cache import CacheManager
from src.models.document import Document
from src.models.user import User
from src.schemas.common import APIResponse
from src.schemas.processing import (
    AsyncTaskResponse,
    ConvertRequest,
    ExtractRequest,
    ExtractResponse,
    ProofreadRequest,
    QARequest,
    QAResponse,
    RewriteRequest,
    RewriteResponse,
    SummarizeRequest,
    SummarizeResponse,
    TaskStatusResponse,
)
from src.services.ai_service import AIService
from src.services.operation_log_service import OperationLogService

router = APIRouter(prefix="/documents/{doc_id}/ai", tags=["ai"])


# ── Sync AI endpoints ──

@router.post("/proofread", response_model=APIResponse[dict])
async def ai_proofread(
    body: ProofreadRequest,
    doc: Document = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(require_tier("white_collar")),
    _q: User = Depends(require_quota("ai_calls")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AIService(db, cache)
    if await svc.is_long_document(doc):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Document is too long for synchronous processing. Use /ai/async/proofread instead.",
        )

    result = await svc.proofread(doc, language=body.language, style_guide=body.style_guide)
    await _log_operation(db, cache, current_user, doc.id, "ai.proofread")
    return APIResponse(success=result.status == "completed", data=result.result, message=result.error)


@router.post("/rewrite", response_model=APIResponse[dict])
async def ai_rewrite(
    body: RewriteRequest,
    doc: Document = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(require_tier("white_collar")),
    _q: User = Depends(require_quota("ai_calls")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AIService(db, cache)
    if await svc.is_long_document(doc):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Document too long for sync processing. Use /ai/async/rewrite.",
        )

    result = await svc.rewrite(doc, tone=body.tone, audience=body.audience, length=body.length, instructions=body.instructions)
    await _log_operation(db, cache, current_user, doc.id, "ai.rewrite")
    return APIResponse(success=result.status == "completed", data=result.result, message=result.error)


@router.post("/summarize", response_model=APIResponse[dict])
async def ai_summarize(
    body: SummarizeRequest,
    doc: Document = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(require_quota("ai_calls")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AIService(db, cache)
    if await svc.is_long_document(doc):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Document too long for sync processing. Use /ai/async/summarize.",
        )

    result = await svc.summarize(doc, length=body.length, format_type=body.format, focus=body.focus)
    await _log_operation(db, cache, current_user, doc.id, "ai.summarize")
    return APIResponse(success=result.status == "completed", data=result.result, message=result.error)


@router.post("/extract", response_model=APIResponse[dict])
async def ai_extract(
    body: ExtractRequest,
    doc: Document = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(require_quota("ai_calls")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AIService(db, cache)
    if await svc.is_long_document(doc):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Document too long for sync processing. Use /ai/async/extract.",
        )

    result = await svc.extract(doc, extract_type=body.extract_type, custom_schema=body.custom_schema)
    await _log_operation(db, cache, current_user, doc.id, "ai.extract")
    return APIResponse(success=result.status == "completed", data=result.result, message=result.error)


@router.post("/convert", response_model=APIResponse[dict])
async def ai_convert(
    body: ConvertRequest,
    doc: Document = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(require_quota("ai_calls")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AIService(db, cache)
    if await svc.is_long_document(doc):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Document too long for sync processing. Use /ai/async/convert.",
        )

    result = await svc.convert(doc, target_format=body.target_format, preserve_structure=body.preserve_structure)
    await _log_operation(db, cache, current_user, doc.id, "ai.convert")
    return APIResponse(success=result.status == "completed", data=result.result, message=result.error)


@router.post("/qa", response_model=APIResponse[dict])
async def ai_qa(
    body: QARequest,
    doc: Document = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(require_quota("ai_calls")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AIService(db, cache)
    result = await svc.qa(doc, question=body.question)
    await _log_operation(db, cache, current_user, doc.id, "ai.qa")
    return APIResponse(success=True, data=result.result)


# ── Async AI endpoints (long documents) ──

@router.post("/async/proofread", response_model=APIResponse[AsyncTaskResponse])
async def ai_async_proofread(
    body: ProofreadRequest,
    doc: Document = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(require_tier("white_collar")),
    _q: User = Depends(require_quota("ai_calls")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AIService(db, cache)
    job = await svc.dispatch_async(doc, current_user.id, "proofread", body.model_dump())
    await _log_operation(db, cache, current_user, doc.id, "ai.proofread.async")
    return APIResponse(
        success=True,
        data=AsyncTaskResponse(task_id=str(job.task_id), status="queued", message="Processing started"),
    )


@router.post("/async/rewrite", response_model=APIResponse[AsyncTaskResponse])
async def ai_async_rewrite(
    body: RewriteRequest,
    doc: Document = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(require_tier("white_collar")),
    _q: User = Depends(require_quota("ai_calls")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AIService(db, cache)
    job = await svc.dispatch_async(doc, current_user.id, "rewrite", body.model_dump())
    await _log_operation(db, cache, current_user, doc.id, "ai.rewrite.async")
    return APIResponse(
        success=True,
        data=AsyncTaskResponse(task_id=str(job.task_id), status="queued", message="Processing started"),
    )


@router.post("/async/summarize", response_model=APIResponse[AsyncTaskResponse])
async def ai_async_summarize(
    body: SummarizeRequest,
    doc: Document = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(require_quota("ai_calls")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AIService(db, cache)
    job = await svc.dispatch_async(doc, current_user.id, "summarize", body.model_dump())
    await _log_operation(db, cache, current_user, doc.id, "ai.summarize.async")
    return APIResponse(
        success=True,
        data=AsyncTaskResponse(task_id=str(job.task_id), status="queued", message="Processing started"),
    )


@router.post("/async/extract", response_model=APIResponse[AsyncTaskResponse])
async def ai_async_extract(
    body: ExtractRequest,
    doc: Document = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(require_quota("ai_calls")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AIService(db, cache)
    job = await svc.dispatch_async(doc, current_user.id, "extract", body.model_dump())
    await _log_operation(db, cache, current_user, doc.id, "ai.extract.async")
    return APIResponse(
        success=True,
        data=AsyncTaskResponse(task_id=str(job.task_id), status="queued", message="Processing started"),
    )


@router.post("/async/convert", response_model=APIResponse[AsyncTaskResponse])
async def ai_async_convert(
    body: ConvertRequest,
    doc: Document = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(require_quota("ai_calls")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AIService(db, cache)
    job = await svc.dispatch_async(doc, current_user.id, "convert", body.model_dump())
    await _log_operation(db, cache, current_user, doc.id, "ai.convert.async")
    return APIResponse(
        success=True,
        data=AsyncTaskResponse(task_id=str(job.task_id), status="queued", message="Processing started"),
    )


# ── Task status ──

@router.get("/tasks/{task_id}", response_model=APIResponse[TaskStatusResponse])
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AIService(db, cache)
    job = await svc.get_job_status(uuid.UUID(task_id))
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if str(job.user_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    return APIResponse(success=True, data=TaskStatusResponse.model_validate(job))


@router.get("/tasks", response_model=APIResponse[list[TaskStatusResponse]])
async def list_tasks(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AIService(db, cache)
    jobs = await svc.list_jobs(current_user.id)
    return APIResponse(success=True, data=[TaskStatusResponse.model_validate(j) for j in jobs])


async def _log_operation(
    db: AsyncSession, cache: CacheManager, current_user: User,
    doc_id: uuid.UUID, action: str,
) -> None:
    from src.services.user_service import UserService
    user_svc = UserService(db, cache)
    await user_svc.increment_quota(current_user, "ai_calls")
    svc = OperationLogService(db)
    await svc.log(user_id=current_user.id, document_id=doc_id, action=action, action_category="ai")
