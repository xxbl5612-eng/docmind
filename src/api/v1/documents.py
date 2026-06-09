"""Document management endpoints: upload, list, CRUD, content, export."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import (
    get_cache,
    get_current_active_user,
    get_db,
    require_document_access,
    require_quota,
    require_tier,
)
from src.config import settings
from src.core.cache import CacheManager
from src.core.celery_app import celery_app
from src.models.user import User
from src.schemas.common import APIResponse, PaginationParams
from src.schemas.document import (
    DocumentContentResponse,
    DocumentContentUpdateRequest,
    DocumentListResponse,
    DocumentResponse,
    DocumentUpdateRequest,
    ExportRequest,
    ExportStatusResponse,
    PdfCompressRequest,
    PdfEncryptRequest,
    PdfMergeRequest,
    PdfOperationResponse,
    PdfWatermarkRequest,
    SlidesResponse,
)
from src.services.document_service import DocumentService
from src.services.operation_log_service import OperationLogService
from src.services.parsing_service import parse_document

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=APIResponse[DocumentResponse], status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    folder: str = Form(default=""),
    current_user: User = Depends(get_current_active_user),
    _: User = Depends(require_quota("documents")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    # Validate file size
    content = await file.read()
    if len(content) > settings.doc_max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")

    svc = DocumentService(db, cache)
    doc = await svc.upload(
        user_id=current_user.id,
        filename=file.filename or "untitled",
        content=content,
        mime_type=file.content_type,
        folder=folder or None,
    )

    # Parse document synchronously (in dev fallback mode) or via Celery
    try:
        parsed = parse_document(content, doc.input_format)
        doc = await svc.save_parsed_content(doc.id, parsed)

        # Pre-render PPTX slides in background for instant viewing
        if doc.input_format == "pptx":
            from src.services.pptx_render_service import pre_render_async
            pre_render_async(str(doc.id), content)

        # Auto-build semantic search index
        if settings.search_enabled and settings.search_auto_index:
            try:
                from src.services.search_service import auto_index_on_upload
                auto_index_on_upload(str(doc.id), parsed, doc.input_format)
            except Exception:
                pass
    except Exception:
        # If parsing fails, try async via Celery (only if Redis available)
        if not settings.use_dev_fallback:
            try:
                celery_app.send_task(
                    "src.workers.document_tasks.parse_document_task",
                    args=[str(doc.id), doc.storage_path, doc.input_format],
                    queue="default",
                )
            except Exception:
                pass

    # Log operation
    log_svc = OperationLogService(db)
    await log_svc.log(
        user_id=current_user.id,
        document_id=doc.id,
        action="document.create",
        action_category="document",
        details={"filename": file.filename, "format": doc.input_format, "size": doc.file_size_bytes},
    )

    # Increment quota (documents count + storage bytes)
    from src.services.user_service import UserService
    user_svc = UserService(db, cache)
    await user_svc.increment_quota(current_user, "documents")
    await user_svc.increment_quota(current_user, "storage", doc.file_size_bytes)

    return APIResponse(success=True, data=DocumentResponse.model_validate(doc), message="Document uploaded")


@router.get("/", response_model=APIResponse[DocumentListResponse])
async def list_documents(
    pagination: PaginationParams = Depends(),
    status_filter: str | None = None,
    doc_type: str | None = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = DocumentService(db, cache)
    docs, total = await svc.list_documents(
        user_id=current_user.id,
        page=pagination.page,
        page_size=pagination.page_size,
        status=status_filter,
        doc_type=doc_type,
    )
    items: list[DocumentResponse] = []
    for d in docs:
        resp = DocumentResponse.model_validate(d)
        resp.is_shared = str(d.owner_id) != str(current_user.id)
        items.append(resp)
    return APIResponse(
        success=True,
        data=DocumentListResponse(
            items=items,
            total=total,
            page=pagination.page,
            page_size=pagination.page_size,
            total_pages=(total + pagination.page_size - 1) // pagination.page_size,
        ),
    )


@router.get("/{doc_id}", response_model=APIResponse[DocumentResponse])
async def get_document(
    doc: DocumentService = Depends(require_document_access("view")),
):
    return APIResponse(success=True, data=DocumentResponse.model_validate(doc))


@router.patch("/{doc_id}", response_model=APIResponse[DocumentResponse])
async def update_document(
    body: DocumentUpdateRequest,
    doc = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = DocumentService(db, cache)
    updated = await svc.update_metadata(doc.id, current_user.id, body.model_dump(exclude_none=True))
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return APIResponse(success=True, data=DocumentResponse.model_validate(updated))


@router.delete("/{doc_id}", response_model=APIResponse)
async def delete_document(
    doc = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = DocumentService(db, cache)
    ok = await svc.delete_document(doc.id, current_user.id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    # Decrement document quota (documents count + storage bytes)
    from src.services.user_service import UserService
    user_svc = UserService(db, cache)
    await user_svc.decrement_quota(current_user, "documents")
    await user_svc.decrement_quota(current_user, "storage", doc.file_size_bytes)

    log_svc = OperationLogService(db)
    await log_svc.log(
        user_id=current_user.id,
        document_id=doc.id,
        action="document.delete",
        action_category="document",
    )
    return APIResponse(success=True, message="Document deleted")


@router.get("/{doc_id}/content", response_model=APIResponse[DocumentContentResponse])
async def get_content(
    doc = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = DocumentService(db, cache)
    content = await svc.get_content(doc.id, current_user.id)
    if content is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not available yet")

    version_id = str(doc.current_version_id) if doc.current_version_id else ""
    return APIResponse(
        success=True,
        data=DocumentContentResponse(
            id=str(doc.id),
            content=content,
            char_count=len(content),
            version_id=version_id,
        ),
    )


@router.put("/{doc_id}/content", response_model=APIResponse[dict])
async def update_content(
    body: DocumentContentUpdateRequest,
    doc = Depends(require_document_access("edit")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    svc = DocumentService(db, cache)
    version = await svc.update_content(
        doc.id, current_user.id, body.content, body.change_summary
    )
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    log_svc = OperationLogService(db)
    await log_svc.log(
        user_id=current_user.id,
        document_id=doc.id,
        action="document.update",
        action_category="document",
        details={"version": version.version_number},
    )
    return APIResponse(success=True, data={"version_id": str(version.id), "version_number": version.version_number})


@router.post("/{doc_id}/export", response_model=APIResponse[ExportStatusResponse])
async def export_document(
    body: ExportRequest,
    doc = Depends(require_document_access("view")),
    _: User = Depends(require_quota("ai_calls")),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    """Start a document export. For large documents, this is async via Celery."""
    opts = body.options or {}
    opts["compress"] = body.compress
    opts["compress_quality"] = body.compress_quality
    if body.watermark_text:
        opts["watermark_text"] = body.watermark_text
        opts["watermark_opacity"] = body.watermark_opacity
        opts["watermark_rotation"] = body.watermark_rotation
    if body.encrypt_password:
        opts["encrypt_password"] = body.encrypt_password

    task = celery_app.send_task(
        "src.workers.export_tasks.export_document",
        args=[str(doc.id), doc.storage_path, doc.parsed_content_path or doc.storage_path,
              body.target_format, doc.input_format, opts],
        queue="export",
    )

    return APIResponse(
        success=True,
        data=ExportStatusResponse(
            task_id=str(task.id),
            status="queued",
            progress_pct=0,
            download_url=None,
        ),
        message="Export task started",
    )


# ── PDF operations ──


@router.post("/{doc_id}/pdf/compress", response_model=APIResponse[PdfOperationResponse])
async def compress_pdf_endpoint(
    body: PdfCompressRequest,
    doc = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    if doc.input_format != "pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF documents can be compressed")
    svc = DocumentService(db, cache)
    original_bytes = svc.get_original_file(doc)
    if original_bytes is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original file not found")

    from src.services.pdf_export_service import compress_pdf
    result = compress_pdf(original_bytes, body.quality)
    if result is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="PDF compression failed. Ensure Ghostscript is installed.")

    from src.core.storage import upload_file
    out_path = f"exports/{doc.id}_compressed.pdf"
    upload_file(result, out_path, "application/pdf")
    ratio = round(len(result) / max(len(original_bytes), 1), 4)
    return APIResponse(
        success=True,
        data=PdfOperationResponse(
            download_path=out_path, size_bytes=len(result),
            original_size_bytes=len(original_bytes), compression_ratio=ratio,
        ),
    )


@router.post("/{doc_id}/pdf/watermark", response_model=APIResponse[PdfOperationResponse])
async def watermark_pdf_endpoint(
    body: PdfWatermarkRequest,
    doc = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    if doc.input_format != "pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF documents support watermark")
    svc = DocumentService(db, cache)
    original_bytes = svc.get_original_file(doc)
    if original_bytes is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    from src.services.pdf_export_service import add_watermark
    result = add_watermark(original_bytes, body.text, body.opacity, body.rotation)
    if result is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="PDF watermark failed. Ensure reportlab is installed.")

    from src.core.storage import upload_file
    out_path = f"exports/{doc.id}_watermarked.pdf"
    upload_file(result, out_path, "application/pdf")
    return APIResponse(
        success=True,
        data=PdfOperationResponse(
            download_path=out_path, size_bytes=len(result),
            original_size_bytes=len(original_bytes),
        ),
    )


@router.post("/{doc_id}/pdf/encrypt", response_model=APIResponse[PdfOperationResponse])
async def encrypt_pdf_endpoint(
    body: PdfEncryptRequest,
    doc = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    if doc.input_format != "pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF documents support encryption")
    svc = DocumentService(db, cache)
    original_bytes = svc.get_original_file(doc)
    if original_bytes is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    from src.services.pdf_export_service import encrypt_pdf
    result = encrypt_pdf(original_bytes, body.password)
    if result is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="PDF encryption failed")

    from src.core.storage import upload_file
    out_path = f"exports/{doc.id}_encrypted.pdf"
    upload_file(result, out_path, "application/pdf")
    return APIResponse(
        success=True,
        data=PdfOperationResponse(
            download_path=out_path, size_bytes=len(result),
            original_size_bytes=len(original_bytes),
        ),
    )


@router.post("/pdf/merge", response_model=APIResponse[PdfOperationResponse])
async def merge_pdfs_endpoint(
    body: PdfMergeRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    from src.models.document import Document as DocModel
    svc = DocumentService(db, cache)
    pdf_parts: list[bytes] = []
    total_original = 0
    for did_str in body.document_ids:
        try:
            did = uuid.UUID(did_str)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid document ID: {did_str}")
        doc = await svc.get_document(did, current_user.id)
        if doc is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document {did_str} not found")
        data = svc.get_original_file(doc)
        if data is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Original file not found for {did_str}")
        pdf_parts.append(data)
        total_original += len(data)

    from src.services.pdf_export_service import merge_pdfs
    result = merge_pdfs(pdf_parts)
    if result is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="PDF merge failed")

    from src.core.storage import upload_file
    import uuid as _uuid
    out_path = f"exports/merged_{_uuid.uuid4().hex}.pdf"
    upload_file(result, out_path, "application/pdf")
    return APIResponse(
        success=True,
        data=PdfOperationResponse(
            download_path=out_path, size_bytes=len(result),
            original_size_bytes=total_original,
        ),
    )


@router.get("/{doc_id}/slides", response_model=APIResponse[SlidesResponse])
async def get_slides(
    doc = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    """Get slide structure for PPTX documents."""
    if doc.input_format not in ("pptx",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slide view is only available for PPTX documents",
        )

    svc = DocumentService(db, cache)
    original_bytes = svc.get_original_file(doc)
    if original_bytes is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original file not found",
        )

    from src.services.pptx_slide_service import extract_slides
    slide_data = extract_slides(original_bytes)

    from src.schemas.document import SlideData, SlideShapeData, SlideParagraph, SlideParagraphRun, TableData, TableCellStyle

    slides_resp: list[SlideData] = []
    for sd in slide_data.slides:
        shapes_resp: list[SlideShapeData] = []
        for sh in sd.shapes:
            paragraphs_resp: list[SlideParagraph] = []
            for p in sh.paragraphs:
                runs_resp: list[SlideParagraphRun] = []
                for r in p.get("runs", []):
                    runs_resp.append(SlideParagraphRun(
                        text=r.get("text", ""),
                        font_size=r.get("font_size"),
                        bold=r.get("bold", False),
                        italic=r.get("italic", False),
                        color=r.get("color"),
                        font_name=r.get("font_name"),
                    ))
                paragraphs_resp.append(SlideParagraph(
                    text=p.get("text", ""),
                    runs=runs_resp,
                    alignment=p.get("alignment", "left"),
                    level=p.get("level", 0),
                    bullet_type=p.get("bullet_type"),
                    bullet_char=p.get("bullet_char"),
                ))
            # Build TableData if present
            td = None
            if sh.table_data:
                cs = [TableCellStyle(**s) for s in sh.table_data.get("cell_styles", [])]
                td = TableData(
                    rows=sh.table_data.get("rows", []),
                    col_widths=sh.table_data.get("col_widths"),
                    header_count=sh.table_data.get("header_count", 0),
                    cell_styles=cs,
                    row_count=sh.table_data.get("row_count", 0),
                    col_count=sh.table_data.get("col_count", 0),
                )
            shapes_resp.append(SlideShapeData(
                shape_idx=sh.shape_idx, shape_type=sh.shape_type,
                left=sh.left, top=sh.top, width=sh.width, height=sh.height,
                text=sh.text, font_size=sh.font_size, font_name=sh.font_name,
                font_bold=sh.font_bold, font_italic=sh.font_italic,
                font_color=sh.font_color, fill_color=sh.fill_color,
                alignment=sh.alignment, has_image=sh.has_image,
                image_index=sh.image_index, table_rows=sh.table_rows,
                paragraphs=paragraphs_resp, is_title=sh.is_title,
                fill_type=sh.fill_type, gradient_angle=sh.gradient_angle,
                gradient_stops=sh.gradient_stops,
                border_color=sh.border_color, border_width=sh.border_width,
                border_style=sh.border_style, border_radius=sh.border_radius,
                shadow=sh.shadow, rotation=sh.rotation,
                table_data=td,
            ))
        slides_resp.append(SlideData(
            slide_index=sd.slide_index,
            width_emu=sd.width_emu, height_emu=sd.height_emu,
            width_px=sd.width_px, height_px=sd.height_px,
            shapes=shapes_resp,
            bg_color=sd.bg_color,
            bg_fill_type=sd.bg_fill_type,
            bg_gradient_stops=sd.bg_gradient_stops,
            bg_gradient_angle=sd.bg_gradient_angle,
        ))

    return APIResponse(
        success=True,
        data=SlidesResponse(
            slides=slides_resp,
            image_count=slide_data.image_count,
            total_slides=len(slides_resp),
        ),
    )


@router.get("/{doc_id}/slides/{slide_idx}/images/{image_idx}")
async def get_slide_image(
    slide_idx: int,
    image_idx: int,
    doc = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    """Serve an embedded image from a PPTX slide."""
    if doc.input_format not in ("pptx",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slide view is only available for PPTX documents",
        )

    svc = DocumentService(db, cache)
    original_bytes = svc.get_original_file(doc)
    if original_bytes is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    from src.services.pptx_slide_service import extract_slide_image
    result = extract_slide_image(original_bytes, slide_idx, image_idx)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    image_bytes, content_type = result
    from fastapi.responses import Response
    return Response(content=image_bytes, media_type=content_type)


@router.get("/{doc_id}/slides/render/{slide_idx}")
async def get_rendered_slide_image(
    doc = Depends(require_document_access("view")),
    slide_idx: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    """Render a PPTX slide as PNG via PowerPoint COM (cached)."""
    if doc.input_format not in ("pptx", "pptx"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PPTX supported")

    svc = DocumentService(db, cache)
    original_bytes = svc.get_original_file(doc)
    if original_bytes is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    from src.services.pptx_render_service import render_slides_cached
    images = render_slides_cached(str(doc.id), original_bytes)
    if not images or slide_idx >= len(images):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slide not found")

    from fastapi.responses import Response
    return Response(content=images[slide_idx], media_type="image/png")


@router.get("/{doc_id}/slides/render-count")
async def get_rendered_slide_count(
    doc = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    """Get slide count (from cached render or fast parse)."""
    if doc.input_format not in ("pptx", "pptx"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PPTX supported")

    svc = DocumentService(db, cache)
    original_bytes = svc.get_original_file(doc)
    if original_bytes is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    from src.services.pptx_render_service import render_slides_cached
    images = render_slides_cached(str(doc.id), original_bytes)
    count = len(images) if images else 0
    return APIResponse(success=True, data={"count": count})


@router.get("/{doc_id}/original")
async def get_original_file(
    doc = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    """Serve the original uploaded file for direct viewing/download."""
    svc = DocumentService(db, cache)
    original_bytes = svc.get_original_file(doc)
    if original_bytes is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    from fastapi.responses import Response
    return Response(
        content=original_bytes,
        media_type=doc.mime_type or "application/octet-stream",
    )


@router.get("/{doc_id}/pandoc-render")
async def get_pandoc_render(
    doc = Depends(require_document_access("view")),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    """Render PPTX/DOCX slides as HTML via Pandoc for high-fidelity viewing."""
    if doc.input_format not in ("pptx", "pptx", "docx"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pandoc render only supports PPTX/DOCX")

    svc = DocumentService(db, cache)
    original_bytes = svc.get_original_file(doc)
    if original_bytes is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    from src.services.pptx_pandoc_render import pptx_to_html
    html = pptx_to_html(original_bytes)
    if html is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Pandoc rendering failed")

    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html, media_type="text/html")
