"""MIME detection, file size helpers, format validation."""

from __future__ import annotations

import mimetypes
import os.path

SUPPORTED_INPUT_MIMES: dict[str, list[str]] = {
    "pdf": ["application/pdf"],
    "docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    "txt": ["text/plain"],
    "md": ["text/markdown", "text/x-markdown"],
    "html": ["text/html"],
    "pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    "xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    "csv": ["text/csv"],
    "png": ["image/png"],
    "jpg": ["image/jpeg"],
}

SUPPORTED_OUTPUT_FORMATS = ["txt", "md", "html", "pdf", "docx", "json"]


def detect_format(filename: str, mime_type: str | None = None) -> str | None:
    """Detect document format from filename or MIME type."""
    if mime_type:
        for fmt, mimes in SUPPORTED_INPUT_MIMES.items():
            if mime_type.lower() in mimes:
                return fmt
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in SUPPORTED_INPUT_MIMES:
        return ext
    # Try mimetypes module
    if not mime_type:
        mime_type, _ = mimetypes.guess_type(filename)
    if mime_type:
        for fmt, mimes in SUPPORTED_INPUT_MIMES.items():
            if mime_type.lower() in mimes:
                return fmt
    return None


def validate_file_size(size: int, max_bytes: int) -> bool:
    return 0 < size <= max_bytes


def get_file_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
