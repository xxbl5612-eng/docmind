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
    OCRRequest,
    OCRResponse,
    ProofreadRequest,
    QARequest,
    QAResponse,
    RAGQAResponse,
    RewriteRequest,
    RewriteResponse,
    SearchQARequest,
    SearchRequest,
    SearchResponse,
    SearchResultItem,
    SearchSourceItem,
    SummarizeRequest,
    SummarizeResponse,
    TaskStatusResponse,
)
from src.services.ai_service import AIService
from src.services.document_service import DocumentService
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


# ── OCR endpoint ──


@router.post("/ocr", response_model=APIResponse[OCRResponse])
async def ai_ocr(
    body: OCRRequest,
    doc: Document = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(require_quota("ai_calls")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = AIService(db, cache)
    doc_svc = DocumentService(db, cache)
    original_bytes = doc_svc.get_original_file(doc)
    if original_bytes is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original file not found")

    engine = body.engine
    language = body.language if body.language != "auto" else "ch"
    result_text = ""
    tables = None
    barcodes = None
    detected_lang = None
    lines = None
    page_count = None

    if doc.input_format in ("png", "jpg", "jpeg"):
        from src.services.ocr_service import ocr_image
        ocr_result = ocr_image(original_bytes, engine=engine, language=language,
                              min_confidence=body.min_confidence)
        result_text = ocr_result["text"]
        engine_used = ocr_result["engine_used"]
        lines = ocr_result.get("lines")
        if body.language == "auto" and result_text:
            from src.services.ocr_service import detect_language
            detected_lang = detect_language(result_text)
    elif doc.input_format == "pdf":
        from src.services.ocr_service import ocr_pdf
        ocr_result = ocr_pdf(original_bytes, engine=engine, language=language,
                            min_confidence=body.min_confidence)
        result_text = ocr_result["text"]
        engine_used = ocr_result["engine_used"]
        page_count = len(ocr_result.get("pages", []))
        if body.language == "auto" and result_text:
            from src.services.ocr_service import detect_language
            detected_lang = detect_language(result_text)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"OCR is only supported for PDF and image formats, not {doc.input_format}")

    if body.detect_tables and result_text and engine in ("paddle", "auto"):
        try:
            from src.services.ocr_service import ocr_table
            tables = ocr_table(original_bytes, output_format=body.table_format,
                             min_confidence=body.min_confidence)
        except Exception:
            pass

    if body.detect_barcodes:
        try:
            from src.services.ocr_service import detect_barcodes, detect_barcodes_in_pdf
            if doc.input_format == "pdf":
                barcodes = detect_barcodes_in_pdf(original_bytes)
            else:
                barcodes = detect_barcodes(original_bytes)
        except Exception:
            pass

    await _log_operation(db, cache, current_user, doc.id, "ai.ocr")
    return APIResponse(
        success=True,
        data=OCRResponse(
            text=result_text, engine_used=engine_used,
            detected_language=detected_lang,
            page_count=page_count,
            char_count=len(result_text), tables=tables, barcodes=barcodes, lines=lines,
        ),
    )


# ── Semantic search endpoints ──


@router.post("/search", response_model=APIResponse[SearchResponse])
async def semantic_search_doc(
    body: SearchRequest,
    doc: Document = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    from src.ai.semantic_search import hybrid_search, semantic_search, search_available
    from src.services.search_service import index_exists, auto_index_on_upload

    if not search_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Semantic search is not available. Install search dependencies: pip install docmind[search]",
        )

    doc_id = str(doc.id)
    if not index_exists(doc_id):
        doc_svc = DocumentService(db, cache)
        content = await doc_svc.get_content(doc.id, current_user.id)
        if content:
            built = auto_index_on_upload(doc_id, content, doc.input_format)
            if not built:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Search index not yet built. Try POST /search/index first.",
                )

    if body.mode == "hybrid":
        results = hybrid_search(body.query, doc_id, body.top_k, body.vector_weight)
    else:
        results = semantic_search(body.query, doc_id, body.top_k)
    await _log_operation(db, cache, current_user, doc.id, "search.query")
    return APIResponse(
        success=True,
        data=SearchResponse(
            query=body.query,
            results=[SearchResultItem(
                chunk_index=r.chunk_index, text=r.text, score=r.score,
                highlights=r.highlights, keyword_score=r.keyword_score,
                vector_score=r.vector_score, doc_id=r.doc_id, doc_title=r.doc_title,
            ) for r in results],
            total_chunks_searched=len(results),
        ),
    )


@router.post("/search/qa", response_model=APIResponse[RAGQAResponse])
async def semantic_search_qa(
    body: SearchQARequest,
    doc: Document = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    from src.ai.semantic_search import rag_qa, search_available
    from src.services.search_service import index_exists, auto_index_on_upload

    if not search_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Semantic search is not available. Install search dependencies: pip install docmind[search]",
        )

    doc_id = str(doc.id)
    if not index_exists(doc_id):
        doc_svc = DocumentService(db, cache)
        content = await doc_svc.get_content(doc.id, current_user.id)
        if content:
            auto_index_on_upload(doc_id, content, doc.input_format)

    result = await rag_qa(body.question, doc_id, body.top_k or settings.search_top_k)
    await _log_operation(db, cache, current_user, doc.id, "search.qa")
    return APIResponse(
        success=True,
        data=RAGQAResponse(
            question=body.question,
            answer=result.answer,
            sources=[SearchSourceItem(chunk_index=s.chunk_index, text_snippet=s.text[:300], score=s.score)
                     for s in result.sources],
            tokens_used=result.tokens_used,
        ),
    )


@router.post("/search/index", response_model=APIResponse[dict])
async def build_search_index_endpoint(
    doc: Document = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    from src.services.search_service import auto_index_on_upload, index_exists

    doc_svc = DocumentService(db, cache)
    content = await doc_svc.get_content(doc.id, current_user.id)
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document has no parsed content yet")

    built = auto_index_on_upload(str(doc.id), content, doc.input_format)
    if not built:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Index build failed. Ensure search dependencies are installed: pip install docmind[search]",
        )

    metadata = {}
    if index_exists(str(doc.id)):
        from src.services.search_service import get_meta_path
        import json
        meta = json.loads(get_meta_path(str(doc.id)).read_text(encoding="utf-8"))
        metadata["chunks_indexed"] = len(meta)

    await _log_operation(db, cache, current_user, doc.id, "search.index")
    return APIResponse(success=True, data=metadata, message="Index built")


@router.delete("/search/index", response_model=APIResponse)
async def delete_search_index_endpoint(
    doc: Document = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
):
    from src.services.search_service import delete_index
    delete_index(str(doc.id))
    return APIResponse(success=True, message="Search index deleted")


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


@router.get("/convert/download")
async def download_converted_pdf(
    path: str,
    current_user: User = Depends(get_current_active_user),
):
    """Download a generated file from the convert pipeline (PDF, DOCX, etc.)."""
    from fastapi.responses import Response
    from src.core.storage import download_file

    if ".." in path or not (path.startswith("converted/") or path.startswith("exports/")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid path")

    # Detect MIME from extension
    ext = path.rsplit(".", 1)[-1] if "." in path else "bin"
    mimes = {"pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
             "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
             "md": "text/markdown", "html": "text/html", "txt": "text/plain",
             "epub": "application/epub+zip", "odt": "application/vnd.oasis.opendocument.text"}
    media_type = mimes.get(ext, "application/octet-stream")
    filename = f"converted.{ext}"

    try:
        data = download_file(path)
        return Response(content=data, media_type=media_type,
                        headers={"Content-Disposition": f"attachment; filename={filename}"})
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")


async def _log_operation(
    db: AsyncSession, cache: CacheManager, current_user: User,
    doc_id: uuid.UUID, action: str,
) -> None:
    from src.services.user_service import UserService
    user_svc = UserService(db, cache)
    await user_svc.increment_quota(current_user, "ai_calls")
    svc = OperationLogService(db)
    await svc.log(user_id=current_user.id, document_id=doc_id, action=action, action_category="ai")
