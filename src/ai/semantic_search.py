"""Semantic search RAG pipeline: BCE embedding + BM25 hybrid + FAISS + DeepSeek LLM.

Phase 2: hybrid search (vector + keyword), passage highlighting, cross-document search.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import structlog

from src.config import settings

logger = structlog.get_logger()

_embedding_model = None

_MODELSCOPE_MAP = {
    "maidalun1020/bce-embedding-base_v1": "netease-youdao/bce-embedding-base_v1",
}


def _modelscope_model_path(hf_name: str) -> str | None:
    ms_name = _MODELSCOPE_MAP.get(hf_name)
    if not ms_name:
        return None
    candidate = os.path.join(
        os.path.expanduser("~"), ".cache", "modelscope", "hub", "models", ms_name,
    )
    if os.path.isdir(candidate):
        return candidate
    return None


class _OnnxEmbeddingModel:
    """Lightweight wrapper around an ONNX embedding model with SentencePiece tokenizer."""

    def __init__(self, model_dir: str):
        import onnxruntime as ort
        self._session = ort.InferenceSession(
            os.path.join(model_dir, "embed.onnx"),
            providers=["CPUExecutionProvider"],
        )
        from sentencepiece import SentencePieceProcessor
        self._sp = SentencePieceProcessor()
        self._sp.Load(os.path.join(model_dir, "sentencepiece.bpe.model"))
        self._dim = 768

    def encode(self, texts: list[str], normalize_embeddings: bool = True) -> np.ndarray:
        input_ids_list: list[list[int]] = []
        attention_mask_list: list[list[int]] = []
        max_len = 0
        for text in texts:
            ids = self._sp.EncodeAsIds(text)
            ids = [0] + ids + [2]  # <s> + tokens + </s>
            if len(ids) > 512:
                ids = ids[:512]
            input_ids_list.append(ids)
            max_len = max(max_len, len(ids))
        for ids in input_ids_list:
            pad_len = max_len - len(ids)
            attention_mask_list.append([1] * len(ids) + [0] * pad_len)
            ids.extend([1] * pad_len)  # pad_token_id = 1
        input_ids = np.array(input_ids_list, dtype=np.int64)
        attention_mask = np.array(attention_mask_list, dtype=np.int64)

        ort_inputs = {
            "input_ids": input_ids,
            "attention_mask": attention_mask,
        }
        # Model outputs: [token_states (b,s,768) float16, cls_embedding (b,768) float16]
        token_states, _ = self._session.run(None, ort_inputs)
        hidden = token_states.astype(np.float32)

        # Mean pooling over valid tokens (excluding padding)
        mask = np.expand_dims(attention_mask.astype(np.float32), -1)
        summed = (hidden * mask).sum(axis=1)
        counts = mask.sum(axis=1).clip(min=1)
        embeddings = summed / counts

        if normalize_embeddings:
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True).clip(min=1e-9)
            embeddings = embeddings / norms
        return embeddings


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is not None:
        return _embedding_model
    # Try sentence_transformers first (HF model)
    try:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer(settings.search_embedding_model)
        logger.info("embedding_model_loaded", model=settings.search_embedding_model)
        return _embedding_model
    except ImportError:
        logger.debug("sentence_transformers_not_installed")
    except Exception as e:
        logger.debug("hf_embedding_failed", error=str(e))
    # Fallback: load ONNX model from ModelScope cache
    local_path = _modelscope_model_path(settings.search_embedding_model)
    if local_path:
        try:
            _embedding_model = _OnnxEmbeddingModel(local_path)
            logger.info("embedding_model_loaded_onnx", path=local_path)
            return _embedding_model
        except Exception as e:
            logger.warning("onnx_embedding_failed", error=str(e))
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
    highlights: list[str] | None = None
    keyword_score: float = 0.0
    vector_score: float = 0.0
    doc_id: str | None = None
    doc_title: str | None = None


@dataclass
class RAGAnswer:
    answer: str
    sources: list[SearchResult]
    tokens_used: dict


# ── BM25 keyword scoring ──

def _tokenize(text: str) -> list[str]:
    """Simple tokenizer for BM25: splits on whitespace and CJK chars."""
    import re
    # Split on whitespace, keeping CJK characters as individual tokens
    tokens: list[str] = []
    for part in text.split():
        # Split CJK runs into individual characters
        cjk_run: list[str] = []
        for ch in part:
            if "一" <= ch <= "鿿" or "぀" <= ch <= "ヿ":
                if cjk_run:
                    tokens.append("".join(cjk_run))
                    cjk_run = []
                tokens.append(ch)
            else:
                cjk_run.append(ch)
        if cjk_run:
            tokens.append("".join(cjk_run))
    return [t.lower() for t in tokens if len(t.strip()) > 0]


def _bm25_score(query: str, doc_text: str, k1: float = 1.2, b: float = 0.75) -> float:
    """Compute BM25 score between query and a single document chunk."""
    query_terms = _tokenize(query)
    doc_terms = _tokenize(doc_text)
    if not query_terms or not doc_terms:
        return 0.0

    doc_len = len(doc_terms)
    # Count term frequencies in doc
    tf: dict[str, int] = {}
    for t in doc_terms:
        tf[t] = tf.get(t, 0) + 1

    # Simple IDF: treat all chunks as the same "collection" for scoring
    score = 0.0
    for term in set(query_terms):
        t = tf.get(term, 0)
        if t == 0:
            continue
        # Simplified BM25: IDF≈1, use raw TF saturation
        score += t / (t + k1 * (1 - b + b * doc_len / max(doc_len, 1)))
    return score / max(len(query_terms), 1)


def _highlight_query_terms(text: str, query: str, max_snippets: int = 3) -> list[str]:
    """Extract snippets from text that contain query terms, with << >> markers."""
    query_terms = set(_tokenize(query))
    if not query_terms:
        return []

    words = text.split()
    if not words:
        return []

    # Find windows around matching terms
    window = 15
    snippets: list[str] = []
    seen_starts: set[int] = set()

    for i, word in enumerate(words):
        word_lower = word.lower().strip(",.!?;:()[]{}")
        if word_lower in query_terms or any(
            t in word_lower for t in query_terms
        ):
            start = max(0, i - window // 2)
            if start in seen_starts:
                continue
            seen_starts.add(start)
            end = min(len(words), start + window)
            snippet_words = words[start:end]
            # Highlight matching terms
            highlighted: list[str] = []
            for w in snippet_words:
                clean = w.lower().strip(",.!?;:()[]{}")
                if clean in query_terms or any(t in clean for t in query_terms):
                    highlighted.append(f"<<{w}>>")
                else:
                    highlighted.append(w)
            prefix = "..." if start > 0 else ""
            suffix = "..." if end < len(words) else ""
            snippets.append(prefix + " ".join(highlighted) + suffix)
            if len(snippets) >= max_snippets:
                break
    return snippets


def hybrid_search(
    query: str,
    doc_id: str,
    top_k: int | None = None,
    vector_weight: float = 0.7,
) -> list[SearchResult]:
    """Combine vector (FAISS) and keyword (BM25) search with score fusion."""
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
    k = min(k * 2, faiss_index.ntotal)  # Fetch more candidates for re-ranking

    query_vec = model.encode([query], normalize_embeddings=True)
    query_vec = np.array(query_vec).astype(np.float32)
    distances, indices = faiss_index.search(query_vec, k)

    threshold = settings.search_similarity_threshold
    results: list[SearchResult] = []
    for dist, idx in zip(distances[0], indices[0], strict=False):
        if idx < 0 or idx >= len(meta):
            continue
        vector_score = float(dist)
        text = meta[idx]["text"]
        # Compute BM25 score
        kw_score = _bm25_score(query, text)
        # Weighted fusion (normalize BM25 to [0, 1] range)
        kw_score_norm = min(kw_score * 3.0, 1.0)  # Scale up BM25 to be comparable
        fused_score = vector_weight * vector_score + (1 - vector_weight) * kw_score_norm
        if fused_score < threshold:
            continue
        highlights = _highlight_query_terms(text, query)
        results.append(SearchResult(
            chunk_index=meta[idx]["index"],
            text=text,
            score=fused_score,
            highlights=highlights,
            keyword_score=kw_score_norm,
            vector_score=vector_score,
        ))

    # Sort by fused score descending, take top_k
    results.sort(key=lambda r: r.score, reverse=True)
    return results[:top_k or settings.search_top_k]


def cross_document_search(
    query: str,
    user_id: str,
    top_k_per_doc: int = 5,
    max_docs: int = 10,
    vector_weight: float = 0.7,
) -> list[SearchResult]:
    """Search across all indexed documents owned by a user."""
    model = _get_embedding_model()
    if model is None or model is False:
        return []

    from src.services.search_service import list_user_indexes, load_index
    doc_indexes = list_user_indexes(user_id)
    if not doc_indexes:
        return []

    query_vec = model.encode([query], normalize_embeddings=True)
    query_vec = np.array(query_vec).astype(np.float32)

    threshold = settings.search_similarity_threshold
    all_results: list[SearchResult] = []

    for doc_id, doc_title in doc_indexes[:max_docs]:
        loaded = load_index(doc_id)
        if loaded is None:
            continue
        faiss_index, meta = loaded
        k = min(top_k_per_doc, faiss_index.ntotal)
        distances, indices = faiss_index.search(query_vec, k)

        for dist, idx in zip(distances[0], indices[0], strict=False):
            if idx < 0 or idx >= len(meta):
                continue
            vector_score = float(dist)
            text = meta[idx]["text"]
            kw_score = _bm25_score(query, text)
            kw_score_norm = min(kw_score * 3.0, 1.0)
            fused_score = vector_weight * vector_score + (1 - vector_weight) * kw_score_norm
            if fused_score < threshold:
                continue
            highlights = _highlight_query_terms(text, query)
            all_results.append(SearchResult(
                chunk_index=meta[idx]["index"],
                text=text,
                score=fused_score,
                highlights=highlights,
                keyword_score=kw_score_norm,
                vector_score=vector_score,
                doc_id=doc_id,
                doc_title=doc_title,
            ))

    all_results.sort(key=lambda r: r.score, reverse=True)
    return all_results[:max_docs * top_k_per_doc]


def semantic_search(
    query: str,
    doc_id: str,
    top_k: int | None = None,
) -> list[SearchResult]:
    """Legacy pure vector search. Use hybrid_search for combined results."""
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
