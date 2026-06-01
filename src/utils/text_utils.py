"""Text encoding detection, whitespace normalization utilities."""

from __future__ import annotations

import re

import chardet


def detect_encoding(raw: bytes) -> str:
    result = chardet.detect(raw)
    return result["encoding"] or "utf-8"


def decode_bytes(raw: bytes) -> str:
    encoding = detect_encoding(raw)
    try:
        return raw.decode(encoding)
    except (UnicodeDecodeError, LookupError):
        return raw.decode("utf-8", errors="replace")


def normalize_whitespace(text: str) -> str:
    """Collapse excessive whitespace while preserving paragraph breaks."""
    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse 3+ newlines into 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove trailing whitespace per line
    text = re.sub(r"[ \t]+$", "", text, flags=re.MULTILINE)
    # Collapse multiple spaces (not newlines)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def estimate_char_count(text: str) -> int:
    return len(text)


def estimate_pages(char_count: int, chars_per_page: int = 3000) -> int:
    return max(1, char_count // chars_per_page)


def truncate_for_preview(text: str, max_chars: int = 500) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "..."
