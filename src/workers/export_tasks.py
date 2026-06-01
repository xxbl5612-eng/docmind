"""Celery tasks for document format export/conversion."""

from __future__ import annotations

from src.core.celery_app import celery_app


@celery_app.task(bind=True, queue="export", max_retries=2)
def export_document(self, doc_id: str, content_path: str, target_format: str, options: dict | None = None):
    """Export a document to the target format."""
    from src.core.storage import download_text, upload_file

    try:
        content = download_text(content_path)
        result_bytes: bytes = b""

        if target_format == "txt":
            result_bytes = content.encode("utf-8")
        elif target_format == "md":
            result_bytes = content.encode("utf-8")
        elif target_format == "html":
            # Basic HTML conversion
            escaped = content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            html = f"<!DOCTYPE html>\n<html>\n<head><meta charset=\"utf-8\"></head>\n<body>\n<pre>{escaped}</pre>\n</body>\n</html>"
            result_bytes = html.encode("utf-8")
        elif target_format == "json":
            import orjson
            result_bytes = orjson.dumps({"content": content, "doc_id": doc_id, "format": target_format}, option=orjson.OPT_INDENT_2)
        elif target_format == "pdf":
            # Use a PDF generation library or convert via AI
            # For now, use basic reportlab-based approach
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

        # Save exported file
        export_path = f"exports/{doc_id}.{target_format}"
        upload_file(result_bytes, export_path)

        return {"doc_id": doc_id, "export_path": export_path, "format": target_format, "size": len(result_bytes)}
    except Exception as exc:
        self.retry(exc=exc, countdown=2 ** self.request.retries * 30)
