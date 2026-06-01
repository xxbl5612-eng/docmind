"""Document cleaning and normalization engine."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from src.utils.text_utils import decode_bytes, normalize_whitespace


@dataclass
class StructureHint:
    type: str  # "paragraph", "heading", "table", "list", "code_block"
    start: int
    end: int
    confidence: float = 1.0


@dataclass
class CleanedDocument:
    clean_text: str
    detected_language: str
    structure_hints: list[StructureHint] = field(default_factory=list)
    original_char_count: int = 0
    char_count: int = 0
    tables: list[str] = field(default_factory=list)


# ── Patterns ──

_RE_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")
_RE_PAGE_NUMBER = re.compile(r"^\s*\d{1,5}\s*$", re.MULTILINE)
_RE_HEADER_FOOTER = re.compile(r"^(?:Page\s+\d+\s+of\s+\d+|©.*?\d{4}|Confidential|Draft)\s*$", re.MULTILINE | re.IGNORECASE)
_RE_WATERMARK = re.compile(r"(?:CONFIDENTIAL|DRAFT|DO NOT DISTRIBUTE|INTERNAL USE ONLY|SAMPLE)", re.IGNORECASE)
_RE_PAGE_BREAK = re.compile(r"\f|\[PAGE\s+BREAK\]|---Page\s+\d+---")
_RE_TABLE_LINE = re.compile(r"^[\s\|]+[\-\+\=]+[\s\|]+$|^\|.+\|$|^\+[\-\+]+\+$|^\s*[\-\+]{3,}\s*$")
_RE_HEADING = re.compile(r"^(?:#{1,6}\s+.+|.+\n[=\-]{3,}|(?:Chapter|Section|第)\s*[\d一二三四五六七八九十]+)", re.MULTILINE)
_RE_LEADING_NUM = re.compile(r"^\s*[\d]+[\.\)、]\s*", re.MULTILINE)
_RE_CODE_BLOCK = re.compile(r"```[\s\S]*?```|`[^`\n]+`")


def clean(raw: bytes | str, input_format: str = "txt") -> CleanedDocument:
    """Clean raw document bytes into normalized text ready for AI processing."""

    if isinstance(raw, bytes):
        text = decode_bytes(raw)
    else:
        text = raw

    original_char_count = len(text)

    # 1. Normalize encoding artifacts
    text = text.replace("﻿", "")  # BOM
    text = text.replace(" ", " ")  # NBSP
    text = _RE_CONTROL_CHARS.sub("", text)

    # 2. Normalize whitespace
    text = normalize_whitespace(text)

    # 3. Remove page artifacts
    text = _RE_PAGE_BREAK.sub("\n", text)
    text = _RE_HEADER_FOOTER.sub("", text)
    text = _RE_PAGE_NUMBER.sub("", text)
    text = _RE_WATERMARK.sub("", text)

    # 4. Detect structure
    structure_hints: list[StructureHint] = []
    tables: list[str] = []

    # Find tables
    for match in re.finditer(r"(\+[\-\+]+\+\n(?:\|.+\|\n)*\+[\-\+]+\+)", text):
        tables.append(match.group())
        structure_hints.append(StructureHint(type="table", start=match.start(), end=match.end()))

    # Find headings
    for match in _RE_HEADING.finditer(text):
        structure_hints.append(StructureHint(type="heading", start=match.start(), end=match.end()))

    # Find code blocks
    for match in _RE_CODE_BLOCK.finditer(text):
        structure_hints.append(StructureHint(type="code_block", start=match.start(), end=match.end()))

    # 5. Detect language (simplified: check for CJK characters)
    cjk_count = len(re.findall(r"[一-鿿㐀-䶿豈-﫿]", text))
    detected_language = "zh" if cjk_count > len(text) * 0.1 else "en"

    # 6. Final cleanup
    text = text.strip()
    # Collapse remaining 3+ newlines after previous cleanups
    text = re.sub(r"\n{3,}", "\n\n", text)

    return CleanedDocument(
        clean_text=text,
        detected_language=detected_language,
        structure_hints=structure_hints,
        original_char_count=original_char_count,
        char_count=len(text),
        tables=tables,
    )
