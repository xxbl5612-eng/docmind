"""Semantic search RAG pipeline: BCE embedding + FAISS + DeepSeek LLM."""

from __future__ import annotations

from dataclasses import dataclass

import structlog

from src.config import settings

logger = structlog.get_logger()

_embedding_model = None


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is not None:
        return _embedding_model
    try:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer(settings.search_embedding_model)
        logger.info("embedding_model_loaded", model=settings.search_embedding_model)
    except ImportError:
        logger.debug("sentence_transformers_not_installed")
        _embedding_model = False
    except Exception as e:
        logger.warning("embedding_model_failed", error=str(e))
        _embedding_model = False
    return _embedding_model


def search_available() -> bool:
    model = _get_embedding_model()
    if model is None or model is False:
        return False
    try:
        import faiss  # noqa: F401
        return True
    except ImportError:
        return False


@dataclass
class SearchResult:
    chunk_index: int
    text: str
    score: float


@dataclass
class RAGAnswer:
    answer: str
    sources: list[SearchResult]
    tokens_used: dict


def semantic_search(
    query: str,
    doc_id: str,
    top_k: int | None = None,
) -> list[SearchResult]:
    model = _get_embedding_model()
    if model is None or model is False:
        logger.warning("search_no_embedding_model")
        return []

    from src.services.search_service import index_exists, load_index
    if not index_exists(doc_id):
        logger.debug("search_index_not_found", doc_id=doc_id)
        return []

    loaded = load_index(doc_id)
    if loaded is None:
        return []

    faiss_index, meta = loaded
    k = top_k or settings.search_top_k
    k = min(k, faiss_index.ntotal)

    import numpy as np
    query_vec = model.encode([query], normalize_embeddings=True)
    query_vec = np.array(query_vec).astype(np.float32)
    distances, indices = faiss_index.search(query_vec, k)

    threshold = settings.search_similarity_threshold
    results: list[SearchResult] = []
    for dist, idx in zip(distances[0], indices[0], strict=False):
        if idx < 0 or idx >= len(meta):
            continue
        score = float(dist)
        if score < threshold:
            continue
        results.append(SearchResult(
            chunk_index=meta[idx]["index"],
            text=meta[idx]["text"],
            score=score,
        ))
    return results


async def rag_qa(
    query: str,
    doc_id: str,
    top_k: int | None = None,
) -> RAGAnswer:
    search_results = semantic_search(query, doc_id, top_k)

    if not search_results:
        return RAGAnswer(
            answer="No relevant content found in this document.",
            sources=[],
            tokens_used={},
        )

    from src.ai.deepseek_client import get_deepseek_client
    from src.ai.prompts import RAG_QA_SYSTEM, rag_qa_user

    chunks_for_prompt = [
        {"score": r.score, "text": r.text}
        for r in search_results
    ]
    user_msg = rag_qa_user(query, chunks_for_prompt)

    client = get_deepseek_client()
    response = await client.chat_with_system(RAG_QA_SYSTEM, user_msg, temperature=0.2, max_tokens=4096)

    return RAGAnswer(
        answer=response.content,
        sources=search_results,
        tokens_used=response.usage,
    )
