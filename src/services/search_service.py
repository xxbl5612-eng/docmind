"""Semantic search index management.

Each document's FAISS index is stored at _storage/search_indexes/{doc_id}.index
with metadata at _storage/search_indexes/{doc_id}.json.
"""

from __future__ import annotations

import json
from pathlib import Path

import structlog

from src.config import settings

logger = structlog.get_logger()

INDEX_DIR = Path("_storage/search_indexes")


def _ensure_dir() -> None:
    INDEX_DIR.mkdir(parents=True, exist_ok=True)


def get_index_path(doc_id: str) -> Path:
    _ensure_dir()
    return INDEX_DIR / f"{doc_id}.index"


def get_meta_path(doc_id: str) -> Path:
    _ensure_dir()
    return INDEX_DIR / f"{doc_id}.json"


def index_exists(doc_id: str) -> bool:
    return get_index_path(doc_id).exists() and get_meta_path(doc_id).exists()


def build_index(doc_id: str, chunks: list[dict]) -> bool:
    if not chunks:
        logger.warning("search_index_empty_chunks", doc_id=doc_id)
        return False

    try:
        import numpy as np

        from src.ai.semantic_search import _get_embedding_model

        model = _get_embedding_model()
        if model is None or model is False:
            return False

        texts = [c["text"] for c in chunks]
        embeddings = model.encode(texts, normalize_embeddings=True)
        embeddings = np.array(embeddings).astype("float32")

        import faiss
        dim = embeddings.shape[1]
        index = faiss.IndexFlatIP(dim)
        index.add(embeddings)

        faiss.write_index(index, str(get_index_path(doc_id)))

        meta = [{"index": c["index"], "text": c["text"][:500]} for c in chunks]
        get_meta_path(doc_id).write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

        logger.info("search_index_built", doc_id=doc_id, chunks=len(chunks), dim=dim)
        return True
    except ImportError as e:
        logger.debug("search_build_missing_deps", error=str(e))
        return False
    except Exception as e:
        logger.error("search_index_build_failed", doc_id=doc_id, error=str(e))
        return False


def load_index(doc_id: str):
    try:
        import faiss
        idx_path = get_index_path(doc_id)
        meta_path = get_meta_path(doc_id)
        if not idx_path.exists() or not meta_path.exists():
            return None
        index = faiss.read_index(str(idx_path))
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        return index, meta
    except ImportError:
        logger.debug("faiss_not_installed")
        return None
    except Exception as e:
        logger.debug("search_load_failed", doc_id=doc_id, error=str(e))
        return None


def delete_index(doc_id: str) -> None:
    import contextlib
    for p in (get_index_path(doc_id), get_meta_path(doc_id)):
        with contextlib.suppress(Exception):
            p.unlink(missing_ok=True)


async def list_user_indexes(user_id: str) -> list[tuple[str, str]]:
    """Return list of (doc_id, doc_title) for all indexed documents owned by user.

    Looks up document ownership from the database, filtering to only those
    that have a search index on disk.
    """
    from uuid import UUID

    _ensure_dir()
    indexed: list[tuple[str, str]] = []
    index_files = list(INDEX_DIR.glob("*.index"))
    if not index_files:
        return indexed

    doc_ids = [f.stem for f in index_files]

    try:
        from src.api.deps import _async_session_factory
        from sqlalchemy import select
        from src.models.document import Document

        async with _async_session_factory() as session:
            result = await session.execute(
                select(Document.id, Document.title).where(
                    Document.id.in_([UUID(d) for d in doc_ids]),
                    Document.owner_id == UUID(user_id),
                    Document.is_deleted.is_(False),
                )
            )
            indexed = [(str(r[0]), r[1]) for r in result.all()]
    except Exception:
        # Fallback: return doc IDs without titles
        indexed = [(d, d) for d in doc_ids]

    return indexed


def auto_index_on_upload(doc_id: str, content: str, input_format: str) -> bool:
    if not settings.search_enabled or not settings.search_auto_index:
        return False
    if not content or len(content) < 200:
        return False

    try:
        from src.ai.chunker import ChunkStrategy, chunk_text
        from src.ai.cleaner import clean
        cleaned = clean(content, input_format)
        chunks = chunk_text(
            cleaned.clean_text,
            strategy=ChunkStrategy.SLIDING_WINDOW,
            chunk_size=settings.search_chunk_size,
            chunk_overlap=settings.search_chunk_overlap,
        )
        chunk_dicts = [{"index": c.index, "text": c.text} for c in chunks]
        return build_index(doc_id, chunk_dicts)
    except Exception as e:
        logger.debug("auto_index_failed", doc_id=doc_id, error=str(e))
        return False
