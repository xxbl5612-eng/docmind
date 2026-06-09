"""High-fidelity PPTX slide rendering.

Engine priority: PowerPoint COM > LibreOffice > Pandoc+PyMuPDF.
Pre-render on first access, cache in memory for instant subsequent access.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
import structlog
from pathlib import Path

import fitz  # PyMuPDF

logger = structlog.get_logger()

LO_PATH = "C:/Program Files/LibreOffice/program/soffice.exe"  # fallback; overridden by settings.libreoffice_path

_cache: dict[str, list[bytes]] = {}


def _render_via_powerpoint(pptx_path: str) -> list[bytes] | None:
    """PowerPoint COM: pixel-perfect, ~7s for 20 slides."""
    try:
        import pythoncom
        import win32com.client
        pythoncom.CoInitialize()
        pp = presentation = None
        try:
            pp = win32com.client.Dispatch("PowerPoint.Application")
            presentation = pp.Presentations.Open(pptx_path, WithWindow=False, ReadOnly=True)
            images = []
            export_dir = Path(pptx_path).parent
            for i in range(1, presentation.Slides.Count + 1):
                p = str(export_dir / f"_s_{i}.png")
                presentation.Slides(i).Export(p, "PNG", 1920, 1080)
                images.append(Path(p).read_bytes())
                Path(p).unlink(missing_ok=True)
            logger.info("pptx_render", engine="powerpoint", slides=len(images))
            return images
        finally:
            try:
                if presentation: presentation.Close()
            except: pass
            try:
                if pp: pp.Quit()
            except: pass
            pythoncom.CoUninitialize()
    except Exception as e:
        logger.debug("powerpoint_unavailable", error=str(e))
        return None


def _get_lo_path() -> str:
    from src.config import settings
    if settings.libreoffice_path and os.path.exists(settings.libreoffice_path):
        return settings.libreoffice_path
    return LO_PATH


def _render_via_libreoffice(pptx_path: str) -> list[bytes] | None:
    """LibreOffice headless: good fidelity, ~10s for 20 slides."""
    lo_path = _get_lo_path()
    if not os.path.exists(lo_path):
        return None
    try:
        out_dir = str(Path(pptx_path).parent)
        subprocess.run(
            [lo_path, "--headless", "--convert-to", "pdf", "--outdir", out_dir, pptx_path],
            capture_output=True, text=True, timeout=120,
            env={**os.environ, "HOME": os.environ.get("TEMP", "/tmp")},
        )
        pdf_path = pptx_path.replace(".pptx", ".pdf")
        if not os.path.exists(pdf_path):
            return None

        doc = fitz.open(pdf_path)
        images = [doc[i].get_pixmap(dpi=150).tobytes("png") for i in range(doc.page_count)]
        doc.close()
        os.unlink(pdf_path)
        logger.info("pptx_render", engine="libreoffice", slides=len(images))
        return images
    except Exception as e:
        logger.debug("libreoffice_unavailable", error=str(e))
        return None


def _render_via_pandoc(data: bytes) -> list[bytes] | None:
    """Pandoc + wkhtmltopdf: basic fidelity, fast."""
    try:
        from src.services.pandoc_service import pandoc_convert
        pdf = pandoc_convert(data, "pptx", "pdf")
        if not pdf: return None
        doc = fitz.open(stream=pdf, filetype="pdf")
        images = [doc[i].get_pixmap(dpi=150).tobytes("png") for i in range(doc.page_count)]
        doc.close()
        logger.info("pptx_render", engine="pandoc", slides=len(images))
        return images
    except Exception as e:
        logger.debug("pandoc_unavailable", error=str(e))
        return None


def render_slides_cached(doc_id: str, data: bytes) -> list[bytes] | None:
    """Get slide images from cache or render + cache via best available engine."""
    if doc_id in _cache:
        return _cache[doc_id]

    with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as f:
        f.write(data)
        pptx_path = f.name

    try:
        for engine in (_render_via_powerpoint, _render_via_libreoffice, lambda p: _render_via_pandoc(data)):
            result = engine(pptx_path)
            if result:
                _cache[doc_id] = result
                return result
    finally:
        try: Path(pptx_path).unlink(missing_ok=True)
        except: pass

    return None


def pre_render_async(doc_id: str, data: bytes) -> None:
    """Trigger pre-render in background (fire-and-forget). Call after PPTX upload."""
    import threading
    def _run():
        try:
            render_slides_cached(doc_id, data)
        except Exception:
            pass
    t = threading.Thread(target=_run, daemon=True)
    t.start()


def invalidate_cache(doc_id: str) -> None:
    _cache.pop(doc_id, None)
