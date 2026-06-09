"""Pandoc document conversion service — fast, local, format-to-format conversion."""

from __future__ import annotations

import structlog
import tempfile
from pathlib import Path

import pypandoc

from src.config import settings

logger = structlog.get_logger()

# DocMind format → Pandoc format name mapping
_TO_PANDOC: dict[str, str] = {
    "docx": "docx",
    "doc": "docx",
    "pptx": "pptx",
    "md": "markdown",
    "html": "html",
    "pdf": "pdf",
    "txt": "plain",
    "rst": "rst",
    "epub": "epub",
    "latex": "latex",
    "odt": "odt",
    "rtf": "rtf",
    "csv": "csv",
    "json": "json",
    "xlsx": None,   # Not supported by Pandoc
}

# Formats Pandoc can output to (subset of above)
_PANDOC_OUTPUT: set[str] = set()


def _check_availability() -> None:
    """Lazy-init: check Pandoc version and available output formats."""
    global _PANDOC_OUTPUT
    if _PANDOC_OUTPUT:
        return
    try:
        ver = pypandoc.get_pandoc_version()
        logger.info("pandoc_available", version=ver)
        # Get available output formats
        formats = pypandoc.get_pandoc_formats()[1]  # [0]=input, [1]=output
        _PANDOC_OUTPUT = set(formats)
    except Exception as e:
        logger.warning("pandoc_unavailable", error=str(e))


def pandoc_available() -> bool:
    """Check if Pandoc is installed and functional."""
    if not settings.pandoc_enabled:
        return False
    try:
        _check_availability()
        return len(_PANDOC_OUTPUT) > 0
    except Exception:
        return False


def can_pandoc_convert(input_fmt: str, target_fmt: str) -> bool:
    """Check if Pandoc can convert between two DocMind format names."""
    if not pandoc_available():
        return False
    src = _TO_PANDOC.get(input_fmt)
    dst = _TO_PANDOC.get(target_fmt)
    if src is None or dst is None:
        return False
    _check_availability()
    return dst in _PANDOC_OUTPUT


def pandoc_convert(
    input_bytes: bytes,
    input_format: str,
    target_format: str,
    extra_args: list[str] | None = None,
) -> bytes | None:
    """Convert document bytes between formats using Pandoc.

    Returns None if Pandoc is unavailable or the conversion fails.
    """
    if not can_pandoc_convert(input_format, target_format):
        return None

    src = _TO_PANDOC[input_format]
    dst = _TO_PANDOC[target_format]

    # PDF requires a PDF engine
    pdf_engine = None
    if dst == "pdf":
        pdf_engine = settings.pandoc_pdf_engine or _detect_pdf_engine()
        if not pdf_engine:
            logger.warning("pandoc_no_pdf_engine")
            return None
        extra_args = (extra_args or []) + [f"--pdf-engine={pdf_engine}"]

    # Write input to temp file, run Pandoc, read output
    suffix_in = f".{input_format.split('/')[0] if '/' in input_format else input_format}"
    suffix_out = f".{target_format}"

    with tempfile.NamedTemporaryFile(suffix=suffix_in, delete=False) as f_in:
        f_in.write(input_bytes)
        input_path = Path(f_in.name)

    output_path = input_path.with_suffix(suffix_out)

    try:
        pypandoc.convert_file(
            str(input_path),
            dst,
            format=src,
            outputfile=str(output_path),
            extra_args=extra_args or [],
        )
        result = output_path.read_bytes()
        logger.info(
            "pandoc_convert_success",
            input_format=input_format,
            target_format=target_format,
            size=len(result),
            engine="pandoc",
        )
        return result
    except Exception as e:
        logger.warning("pandoc_convert_failed", error=str(e))
        return None
    finally:
        # Clean up temp files
        try:
            input_path.unlink(missing_ok=True)
        except Exception:
            pass
        try:
            output_path.unlink(missing_ok=True)
        except Exception:
            pass


def _detect_pdf_engine() -> str | None:
    """Find an available PDF engine."""
    import shutil
    for engine in ("wkhtmltopdf", "weasyprint", "pdflatex", "xelatex"):
        if shutil.which(engine):
            return engine
    return None


def pandoc_convert_doc_bytes(
    input_bytes: bytes,
    input_format: str,
    target_format: str,
) -> dict | None:
    """Convenience: convert and return a result dict with output path for storage.

    Returns None on failure, or {"output_bytes": bytes, "size": int} on success.
    """
    result_bytes = pandoc_convert(input_bytes, input_format, target_format)
    if result_bytes is None:
        return None
    return {"output_bytes": result_bytes, "size": len(result_bytes)}
