"""Render PPTX slides as high-fidelity HTML using Pandoc."""

from __future__ import annotations


def pptx_to_html(data: bytes) -> str | None:
    """Convert PPTX bytes to a single HTML document via Pandoc.

    Returns HTML string, or None if Pandoc is unavailable.
    """
    try:
        from src.services.pandoc_service import pandoc_convert
        html_bytes = pandoc_convert(
            data, "pptx", "html",
            extra_args=[
                "--standalone",
                "--embed-resources",
                "--metadata", "title=Presentation",
                "--slide-level=1",
            ],
        )
        if html_bytes:
            return html_bytes.decode("utf-8", errors="replace")
    except Exception:
        pass
    return None
