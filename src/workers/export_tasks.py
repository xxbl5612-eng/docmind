"""Celery tasks for document format export/conversion."""

from __future__ import annotations

from src.core.celery_app import celery_app


@celery_app.task(bind=True, queue="export", max_retries=2)
def export_document(self, doc_id: str, storage_path: str, content_path: str, target_format: str,
                    input_format: str = "txt", options: dict | None = None):
    """Export a document to the target format.

    Engine priority:
      1. LibreOffice for DOCX/PPTX/ODT → PDF (highest quality)
      2. Pandoc for supported format pairs
      3. Manual conversion from parsed text
    Supports post-processing: compression, watermark, encryption.
    """
    from src.core.storage import download_file, download_text, upload_file

    try:
        options = options or {}
        result_bytes: bytes | None = None
        engine = "manual"

        # ── LibreOffice path (highest quality for DOCX/PPTX/ODT → PDF) ──
        if target_format == "pdf" and input_format in ("docx", "pptx", "odt", "rtf", "doc"):
            try:
                from src.services.pdf_export_service import export_via_libreoffice
                original_bytes = download_file(storage_path)
                result_bytes = export_via_libreoffice(original_bytes, input_format, "pdf")
                if result_bytes:
                    engine = "libreoffice"
            except Exception:
                pass

        # ── Pandoc path ──
        if result_bytes is None:
            try:
                from src.services.pandoc_service import can_pandoc_convert, pandoc_convert
                if can_pandoc_convert(input_format, target_format):
                    original_bytes = download_file(storage_path)
                    result_bytes = pandoc_convert(original_bytes, input_format, target_format)
                    if result_bytes:
                        engine = "pandoc"
            except Exception:
                pass

        # ── Post-processing for PDF ──
        if result_bytes and target_format == "pdf":
            result_bytes = _apply_pdf_post_processing(result_bytes, options)

        if result_bytes:
            export_path = f"exports/{doc_id}.{target_format}"
            upload_file(result_bytes, export_path)
            return {
                "doc_id": doc_id, "export_path": export_path, "format": target_format,
                "size": len(result_bytes), "engine": engine,
            }

        # ── Manual fallback from parsed text ──
        content = download_text(content_path)

        if target_format in ("txt", "md"):
            result_bytes = content.encode("utf-8")
        elif target_format == "html":
            escaped = content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            html = f"<!DOCTYPE html>\n<html>\n<head><meta charset=\"utf-8\"></head>\n<body>\n<pre>{escaped}</pre>\n</body>\n</html>"
            result_bytes = html.encode("utf-8")
        elif target_format == "json":
            import orjson
            result_bytes = orjson.dumps({"content": content, "doc_id": doc_id, "format": target_format},
                                          option=orjson.OPT_INDENT_2)
        elif target_format == "pdf":
            from io import BytesIO
            try:
                from reportlab.lib.pagesizes import A4
                from reportlab.platypus import SimpleDocTemplate, Paragraph
                from reportlab.lib.styles import getSampleStyleSheet
                buf = BytesIO()
                doc = SimpleDocTemplate(buf, pagesize=A4)
                styles = getSampleStyleSheet()
                parts_list = [Paragraph(line.replace("&", "&amp;").replace("<", "&lt;"), styles["Normal"])
                            for line in content.split("\n") if line.strip()]
                doc.build(parts_list)
                result_bytes = buf.getvalue()
            except ImportError:
                result_bytes = content.encode("utf-8")
        elif target_format == "docx":
            from docx import Document
            from io import BytesIO
            doc = Document()
            for line in content.split("\n"):
                if line.strip():
                    doc.add_paragraph(line)
            buf = BytesIO()
            doc.save(buf)
            result_bytes = buf.getvalue()
        else:
            result_bytes = content.encode("utf-8")

        if result_bytes and target_format == "pdf":
            result_bytes = _apply_pdf_post_processing(result_bytes, options)

        export_path = f"exports/{doc_id}.{target_format}"
        upload_file(result_bytes, export_path)
        return {"doc_id": doc_id, "export_path": export_path, "format": target_format, "size": len(result_bytes)}
    except Exception as exc:
        self.retry(exc=exc, countdown=2 ** self.request.retries * 30)


def _apply_pdf_post_processing(pdf_bytes: bytes, options: dict) -> bytes:
    """Apply compression, watermark, and encryption to PDF bytes based on options."""
    result = pdf_bytes

    if options.get("compress"):
        try:
            from src.services.pdf_export_service import compress_pdf
            quality = options.get("compress_quality", "screen")
            compressed = compress_pdf(result, quality)
            if compressed:
                result = compressed
        except Exception:
            pass

    if options.get("watermark_text"):
        try:
            from src.services.pdf_export_service import add_watermark
            wm_opacity = float(options.get("watermark_opacity", 0.3))
            wm_rotation = float(options.get("watermark_rotation", 45.0))
            watermarked = add_watermark(result, options["watermark_text"], wm_opacity, wm_rotation)
            if watermarked:
                result = watermarked
        except Exception:
            pass

    if options.get("page_numbers"):
        try:
            from src.services.pdf_export_service import add_page_numbers
            fmt = options.get("page_numbers_format", "Page {page} of {total}")
            numbered = add_page_numbers(result, format_str=fmt)
            if numbered:
                result = numbered
        except Exception:
            pass

    if options.get("encrypt_password"):
        try:
            from src.services.pdf_export_service import encrypt_pdf
            encrypted = encrypt_pdf(result, options["encrypt_password"])
            if encrypted:
                result = encrypted
        except Exception:
            pass

    return result
