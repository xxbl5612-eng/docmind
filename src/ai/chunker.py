"""Intelligent document chunking strategies."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable

from src.ai.cleaner import CleanedDocument, StructureHint
from src.config import settings


class ChunkStrategy(str, Enum):
    SEMANTIC = "semantic"
    SLIDING_WINDOW = "sliding_window"
    TABLE_AWARE = "table_aware"
    PAGE_BASED = "page_based"
    TOKEN_AWARE = "token_aware"


@dataclass
class Chunk:
    index: int
    text: str
    boundary_type: str = "paragraph"  # paragraph, heading, table_start, table_end, overlap
    estimated_tokens: int = 0
    metadata: dict = field(default_factory=dict)


def select_strategy(cleaned: CleanedDocument, page_count: int | None = None) -> ChunkStrategy:
    """Auto-select the best chunking strategy based on document characteristics."""
    if cleaned.char_count < settings.doc_max_sync_chars:
        return ChunkStrategy.SEMANTIC  # single chunk

    table_hints = [h for h in cleaned.structure_hints if h.type == "table"]
    if len(table_hints) > len(cleaned.structure_hints) * 0.3:
        return ChunkStrategy.TABLE_AWARE

    if page_count and cleaned.char_count / page_count < 8000:
        return ChunkStrategy.PAGE_BASED

    return ChunkStrategy.SEMANTIC


def chunk_text(
    text: str,
    strategy: ChunkStrategy = ChunkStrategy.SEMANTIC,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
    structure_hints: list[StructureHint] | None = None,
) -> list[Chunk]:
    """Split text into chunks using the specified strategy."""
    chunk_size = chunk_size or settings.doc_chunk_size
    chunk_overlap = chunk_overlap or settings.doc_chunk_overlap

    if len(text) <= chunk_size:
        return [Chunk(index=0, text=text, estimated_tokens=_estimate_tokens(text))]

    strategy_fn: dict[ChunkStrategy, Callable[..., list[Chunk]]] = {
        ChunkStrategy.SEMANTIC: _chunk_semantic,
        ChunkStrategy.SLIDING_WINDOW: _chunk_sliding_window,
        ChunkStrategy.TABLE_AWARE: _chunk_table_aware,
        ChunkStrategy.PAGE_BASED: _chunk_by_page,
        ChunkStrategy.TOKEN_AWARE: _chunk_token_aware,
    }
    return strategy_fn[strategy](text, chunk_size, chunk_overlap, structure_hints or [])


# ── Strategy implementations ──

def _chunk_semantic(text: str, size: int, overlap: int, hints: list[StructureHint]) -> list[Chunk]:
    """Split at paragraph and heading boundaries."""
    paragraphs = re.split(r"\n\n+", text)
    chunks: list[Chunk] = []
    current = ""
    index = 0

    for para in paragraphs:
        if len(current) + len(para) + 1 <= size:
            current = (current + "\n\n" + para).strip() if current else para
        else:
            if current:
                boundary = "heading" if _is_heading(current, hints) else "paragraph"
                chunks.append(Chunk(index=index, text=current, boundary_type=boundary, estimated_tokens=_estimate_tokens(current)))
                index += 1
            current = para

    if current.strip():
        boundary = "heading" if _is_heading(current, hints) else "paragraph"
        chunks.append(Chunk(index=index, text=current.strip(), boundary_type=boundary, estimated_tokens=_estimate_tokens(current.strip())))

    return chunks


def _chunk_sliding_window(text: str, size: int, overlap: int, hints: list[StructureHint]) -> list[Chunk]:
    """Fixed-size sliding windows with overlap, respecting sentence boundaries."""
    chunks: list[Chunk] = []
    start = 0
    idx = 0
    text_len = len(text)

    while start < text_len:
        end = min(start + size, text_len)
        if end < text_len:
            # Try to break at sentence ending
            window = text[start:end]
            sentence_break = max(window.rfind(". "), window.rfind("。"), window.rfind("！\n"), window.rfind("?\n"), window.rfind(".\n"))
            if sentence_break > size // 2:
                end = start + sentence_break + 1

        chunk_text_val = text[start:end]
        chunks.append(Chunk(index=idx, text=chunk_text_val, boundary_type="overlap", estimated_tokens=_estimate_tokens(chunk_text_val)))
        start = end - overlap if end < text_len else text_len
        idx += 1

    return chunks


def _chunk_table_aware(text: str, size: int, overlap: int, hints: list[StructureHint]) -> list[Chunk]:
    """Keep tables intact as atomic chunks; chunk surrounding text separately."""
    chunks: list[Chunk] = []
    idx = 0
    table_hints = sorted([h for h in hints if h.type == "table"], key=lambda h: h.start)

    pos = 0
    for th in table_hints:
        # Chunk text before table
        if th.start > pos:
            before = text[pos : th.start]
            sub = _chunk_semantic(before, size, overlap, [])
            for c in sub:
                c.index = idx
                idx += 1
                chunks.append(c)

        # Keep table as one chunk
        table_text = text[th.start : th.end]
        chunks.append(Chunk(index=idx, text=table_text, boundary_type="table_start", estimated_tokens=_estimate_tokens(table_text)))
        idx += 1
        pos = th.end

    # Remaining text after last table
    if pos < len(text):
        after = text[pos:]
        sub = _chunk_semantic(after, size, overlap, [])
        for c in sub:
            c.index = idx
            idx += 1
            chunks.append(c)

    return chunks


def _chunk_by_page(text: str, size: int, overlap: int, hints: list[StructureHint]) -> list[Chunk]:
    """Split by form-feed page markers, or roughly by character count."""
    parts = text.split("\f")
    chunks: list[Chunk] = []
    idx = 0

    for part in parts:
        part = part.strip()
        if not part:
            continue
        if len(part) <= size:
            chunks.append(Chunk(index=idx, text=part, boundary_type="paragraph", estimated_tokens=_estimate_tokens(part)))
            idx += 1
        else:
            sub = _chunk_semantic(part, size, overlap, [])
            for c in sub:
                c.index = idx
                idx += 1
                chunks.append(c)

    return chunks


def _chunk_token_aware(text: str, size: int, overlap: int, hints: list[StructureHint]) -> list[Chunk]:
    """Chunk based on token estimates rather than character count."""
    token_limit = size // 4  # Rough: 4 chars ≈ 1 token
    paragraphs = re.split(r"\n\n+", text)

    chunks: list[Chunk] = []
    current = ""
    current_tokens = 0
    idx = 0

    for para in paragraphs:
        para_tokens = _estimate_tokens(para)
        if current_tokens + para_tokens <= token_limit:
            current = (current + "\n\n" + para).strip() if current else para
            current_tokens += para_tokens
        else:
            if current:
                chunks.append(Chunk(index=idx, text=current, boundary_type="paragraph", estimated_tokens=current_tokens))
                idx += 1
            current = para
            current_tokens = para_tokens

    if current:
        chunks.append(Chunk(index=idx, text=current, boundary_type="paragraph", estimated_tokens=current_tokens))

    return chunks


# ── Helpers ──

def _estimate_tokens(text: str) -> int:
    """Rough token estimation for English + Chinese text."""
    english_chars = len(re.findall(r"[a-zA-Z0-9\s]", text))
    other_chars = len(text) - english_chars
    return english_chars // 4 + other_chars // 2


def _is_heading(text: str, hints: list[StructureHint]) -> bool:
    first_line = text.split("\n")[0].strip()
    return bool(re.match(r"^(?:#{1,6}\s|Chapter|Section|第|[A-Z][a-z]+:)", first_line))
