"""Unified PDF export via LibreOffice, Ghostscript, and PyPDF2."""

from __future__ import annotations

import io
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Literal

import structlog
from pypdf import PdfReader, PdfWriter

from src.config import settings

logger = structlog.get_logger()

_WINDOWS = os.name == "nt"


# ── LibreOffice ──

_WIN_LO_PATHS = [
    "C:/Program Files/LibreOffice/program/soffice.exe",
    "C:/Program Files (x86)/LibreOffice/program/soffice.exe",
]
_UNIX_LO_PATHS = [
    "/usr/bin/soffice",
    "/usr/lib/libreoffice/program/soffice",
    "/opt/libreoffice/program/soffice",
]


def _detect_libreoffice() -> str | None:
    if settings.libreoffice_path:
        p = Path(settings.libreoffice_path)
        if p.exists():
            return str(p)
    paths = _WIN_LO_PATHS if _WINDOWS else _UNIX_LO_PATHS
    for p in paths:
        if Path(p).exists():
            return p
    # Try PATH
    exe = "soffice.exe" if _WINDOWS else "soffice"
    found = shutil.which(exe)
    if found:
        return found
    return None


def libreoffice_available() -> bool:
    return _detect_libreoffice() is not None


def export_via_libreoffice(
    input_bytes: bytes,
    input_format: str,
    output_format: str = "pdf",
) -> bytes | None:
    lo_path = _detect_libreoffice()
    if not lo_path:
        logger.debug("libreoffice_not_found")
        return None

    ext_map = {
        "docx": "docx", "pptx": "pptx", "xlsx": "xlsx",
        "odt": "odt", "ods": "ods", "odp": "odp",
        "rtf": "rtf", "html": "html", "txt": "txt",
        "csv": "csv", "pdf": "pdf", "doc": "doc",
    }
    in_ext = ext_map.get(input_format, input_format)
    out_ext = output_format

    with tempfile.NamedTemporaryFile(suffix=f".{in_ext}", delete=False) as f:
        f.write(input_bytes)
        input_path = Path(f.name)

    try:
        out_dir = str(input_path.parent)
        subprocess.run(
            [lo_path, "--headless", "--convert-to", out_ext, "--outdir", out_dir, str(input_path)],
            capture_output=True, text=True, timeout=300,
            env={**os.environ, "HOME": os.environ.get("TEMP", "/tmp")},
        )
        output_path = input_path.with_suffix(f".{out_ext}")
        if output_path.exists():
            result = output_path.read_bytes()
            output_path.unlink(missing_ok=True)
            logger.info("libreoffice_export", input_format=input_format, output_format=output_format,
                        size=len(result))
            return result
        logger.warning("libreoffice_no_output", input_format=input_format)
        return None
    except subprocess.TimeoutExpired:
        logger.error("libreoffice_timeout")
        return None
    except Exception as e:
        logger.debug("libreoffice_failed", error=str(e))
        return None
    finally:
        input_path.unlink(missing_ok=True)


# ── Ghostscript ──

_WIN_GS_PATHS = [
    "C:/Program Files/gs/gs10.04.0/bin/gswin64c.exe",
    "C:/Program Files/gs/gs10.03.1/bin/gswin64c.exe",
    "C:/Program Files/gs/gs10.02.1/bin/gswin64c.exe",
    "C:/Program Files/gs/gs9.56.1/bin/gswin64c.exe",
]
_UNIX_GS_EXE = "gs"

_QUALITY_PRESETS = {
    "screen":   "/screen",
    "ebook":    "/ebook",
    "printer":  "/printer",
    "prepress": "/prepress",
}


def _detect_gs() -> str | None:
    if settings.ghostscript_path:
        p = Path(settings.ghostscript_path)
        if p.exists():
            return str(p)
    if _WINDOWS:
        for p in _WIN_GS_PATHS:
            if Path(p).exists():
                return p
        # Try gs dirs that might match any version
        gs_base = Path("C:/Program Files/gs")
        if gs_base.exists():
            for d in sorted(gs_base.iterdir(), reverse=True):
                exe = d / "bin" / "gswin64c.exe"
                if exe.exists():
                    return str(exe)
    else:
        found = shutil.which(_UNIX_GS_EXE)
        if found:
            return found
    return None


def gs_available() -> bool:
    return settings.ghostscript_enabled and _detect_gs() is not None


def compress_pdf(
    pdf_bytes: bytes,
    quality: Literal["screen", "ebook", "printer", "prepress"] = "screen",
) -> bytes | None:
    gs_path = _detect_gs()
    if not gs_path or not settings.ghostscript_enabled:
        logger.debug("ghostscript_unavailable")
        return None

    preset = _QUALITY_PRESETS.get(quality, "/screen")
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as fin, \
         tempfile.NamedTemporaryFile(suffix="_out.pdf", delete=False) as fout:
        fin.write(pdf_bytes)
        input_path = Path(fin.name)
        output_path = Path(fout.name)

    try:
        result = subprocess.run(
            [
                gs_path, "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.7",
                f"-dPDFSETTINGS={preset}", "-dNOPAUSE", "-dQUIET", "-dBATCH",
                f"-sOutputFile={output_path}", str(input_path),
            ],
            capture_output=True, text=True, timeout=120,
        )
        if output_path.exists():
            output_bytes = output_path.read_bytes()
            output_path.unlink(missing_ok=True)
            ratio = round(len(output_bytes) / max(len(pdf_bytes), 1), 4)
            logger.info("pdf_compressed", quality=quality, original=len(pdf_bytes),
                        compressed=len(output_bytes), ratio=ratio)
            return output_bytes
        logger.error("gs_compress_failed", stderr=result.stderr[:500])
        return None
    except subprocess.TimeoutExpired:
        logger.error("gs_compress_timeout")
        return None
    except Exception as e:
        logger.debug("gs_compress_error", error=str(e))
        return None
    finally:
        input_path.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)


# ── PyPDF2 watermark ──

def _make_watermark_pdf(pw: float, ph: float, text: str, opacity: float, rotation: float) -> bytes:
    """Create a watermark PDF using built-in pypdf content stream manipulation."""
    from pypdf.generic import (
        ArrayObject, DictionaryObject, NameObject, FloatObject,
        TextStringObject, ByteStringObject, NumberObject,
    )

    writer = PdfWriter()
    writer.add_blank_page(width=pw, height=ph)
    page = writer.pages[0]

    import math
    rad = math.radians(rotation)
    cos_r, sin_r = math.cos(rad), math.sin(rad)

    font_size = min(pw, ph) / 15
    # Center text
    text_width_est = len(text) * font_size * 0.5
    tx = pw / 2 - (text_width_est / 2) * cos_r
    ty = ph / 2 - (text_width_est / 2) * sin_r * (-1)

    content = (
        "q\n"
        f"BT\n"
        f"1 0 0 1 {tx:.1f} {ty:.1f} Tm\n"
        f"{cos_r:.4f} {sin_r:.4f} {-sin_r:.4f} {cos_r:.4f} 0 0 Tm\n"
        f"/F1 {font_size:.1f} Tf\n"
    )
    if opacity < 1.0:
        gs_name = "gs1"
        # Already have the graphics state set in resources
        content += f"/{gs_name} gs\n"
    content += (
        f"({text}) Tj\n"
        "ET\n"
        "Q\n"
    )

    writer.add_blank_page(width=pw, height=ph)
    # Simpler approach: use merge_page with a blank page that has content
    from io import BytesIO

    # Build minimal PDF bytes with watermark only
    pdf_str = f"""%PDF-1.7
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 {pw:.0f} {ph:.0f}]/Contents 4 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj
4 0 obj<</Length {len(content.encode())}>>stream
{content}
endstream endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000320 00000 n
trailer<</Size 5/Root 1 0 R>>
startxref
420
%%EOF"""
    return pdf_str.encode()


def add_watermark(
    pdf_bytes: bytes,
    text: str,
    opacity: float = 0.3,
    rotation: float = 45.0,
) -> bytes | None:
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        writer = PdfWriter()

        for page in reader.pages:
            mediabox = page.mediabox
            pw = float(mediabox.width)
            ph = float(mediabox.height)
            wm_bytes = _make_watermark_pdf(pw, ph, text, opacity, rotation)
            wm_reader = PdfReader(io.BytesIO(wm_bytes))
            page.merge_page(wm_reader.pages[0])
            writer.add_page(page)

        out = io.BytesIO()
        writer.write(out)
        logger.info("watermark_added", text=text, pages=len(reader.pages))
        return out.getvalue()
    except Exception as e:
        logger.warning("watermark_failed", error=str(e))
        return None


# ── PyPDF2 encryption ──

def encrypt_pdf(pdf_bytes: bytes, password: str) -> bytes | None:
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        writer = PdfWriter()

        for page in reader.pages:
            writer.add_page(page)

        algo = settings.pdf_encrypt_algorithm
        if algo == "AES-256":
            writer.encrypt(password, algorithm="AES-256")
        else:
            writer.encrypt(password, algorithm="RC4-128")

        out = io.BytesIO()
        writer.write(out)
        logger.info("pdf_encrypted", algorithm=algo, pages=len(reader.pages))
        return out.getvalue()
    except Exception as e:
        logger.debug("encrypt_failed", error=str(e))
        return None


# ── Page numbering ──

def add_page_numbers(
    pdf_bytes: bytes,
    format_str: str = "Page {page} of {total}",
    font_size: int = 8,
) -> bytes | None:
    """Stamp page numbers onto an existing PDF using PyPDF2."""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        writer = PdfWriter()
        total = len(reader.pages)

        for i, page in enumerate(reader.pages):
            pw = float(page.mediabox.width)
            ph = float(page.mediabox.height)
            text = format_str.format(page=i + 1, total=total)

            # Build a minimal page-number PDF overlay
            content = (
                "q\n"
                "BT\n"
                f"/F1 {font_size:.1f} Tf\n"
                "0.5 0.5 0.5 rg\n"
                f"1 0 0 1 {pw / 2 - len(text) * font_size * 0.2:.1f} 20 Tm\n"
                f"({text}) Tj\n"
                "ET\n"
                "Q\n"
            )
            pn_bytes = f"""%PDF-1.7
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 {pw:.0f} {ph:.0f}]/Contents 4 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj
4 0 obj<</Length {len(content.encode())}>>stream
{content}
endstream endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000320 00000 n
trailer<</Size 5/Root 1 0 R>>
startxref
420
%%EOF"""
            pn_reader = PdfReader(io.BytesIO(pn_bytes.encode()))
            page.merge_page(pn_reader.pages[0])
            writer.add_page(page)

        out = io.BytesIO()
        writer.write(out)
        logger.info("page_numbers_added", pages=total)
        return out.getvalue()
    except Exception as e:
        logger.warning("page_numbers_failed", error=str(e))
        return None


# ── PyPDF2 merge ──

def merge_pdfs(pdf_list: list[bytes]) -> bytes | None:
    if len(pdf_list) < 2:
        return None

    try:
        writer = PdfWriter()
        total_pages = 0
        for data in pdf_list:
            reader = PdfReader(io.BytesIO(data))
            for page in reader.pages:
                writer.add_page(page)
            total_pages += len(reader.pages)

        out = io.BytesIO()
        writer.write(out)
        logger.info("pdf_merged", files=len(pdf_list), pages=total_pages)
        return out.getvalue()
    except Exception as e:
        logger.debug("merge_failed", error=str(e))
        return None
