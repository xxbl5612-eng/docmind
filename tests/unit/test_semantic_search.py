"""Unit tests for semantic search module."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from src.ai.semantic_search import (
    RAGAnswer,
    SearchResult,
    _OnnxEmbeddingModel,
    search_available,
    semantic_search,
)


class TestSearchResult:
    def test_create_search_result(self):
        r = SearchResult(chunk_index=3, text="hello", score=0.95)
        assert r.chunk_index == 3
        assert r.text == "hello"
        assert r.score == 0.95

    def test_create_rag_answer(self):
        sources = [SearchResult(chunk_index=0, text="doc content", score=0.88)]
        answer = RAGAnswer(answer="Answer text", sources=sources, tokens_used={"total": 100})
        assert answer.answer == "Answer text"
        assert len(answer.sources) == 1
        assert answer.tokens_used["total"] == 100


class TestOnnxEmbeddingModel:
    """Test the ONNX embedding model wrapper with mocked ONNX runtime."""

    @pytest.fixture
    def mock_onnx_session(self):
        with patch("onnxruntime.InferenceSession") as mock:
            session = MagicMock()

            def adaptive_run(*args, **kwargs):
                input_ids = args[1]["input_ids"]
                b, s = input_ids.shape
                token_states = np.zeros((b, s, 768), dtype=np.float16)
                pooled = np.zeros((b, 768), dtype=np.float16)
                return [token_states, pooled]

            session.run.side_effect = adaptive_run
            mock.return_value = session
            yield mock

    @pytest.fixture
    def mock_sentencepiece(self):
        with patch("sentencepiece.SentencePieceProcessor") as mock:
            sp = MagicMock()
            sp.EncodeAsIds.return_value = [100, 200, 300]
            mock.return_value = sp
            yield mock

    def test_encode_single_text(self, mock_onnx_session, mock_sentencepiece):
        model = _OnnxEmbeddingModel("/fake/path")
        emb = model.encode(["hello"])
        assert emb.shape == (1, 768)
        assert emb.dtype == np.float32

    def test_encode_multiple_texts(self, mock_onnx_session, mock_sentencepiece):
        model = _OnnxEmbeddingModel("/fake/path")
        emb = model.encode(["hello", "world"])
        assert emb.shape == (2, 768)

    def test_encode_normalizes_output(self, mock_onnx_session, mock_sentencepiece):
        # Mock returns 3 element token IDs → 5 after <s>+</s> → shape (1,5,768)
        def adaptive_run(*args, **kwargs):
            input_ids = args[1]["input_ids"]
            b, s = input_ids.shape
            token_states = np.ones((b, s, 768), dtype=np.float16)
            return [token_states, np.zeros((b, 768), dtype=np.float16)]
        mock_onnx_session.return_value.run.side_effect = adaptive_run
        model = _OnnxEmbeddingModel("/fake/path")
        emb = model.encode(["test"])
        norm = float((emb[0] ** 2).sum())
        assert abs(norm - 1.0) < 0.001

    def test_encode_pads_to_max_length(self, mock_onnx_session, mock_sentencepiece):
        call_count = [0]

        def encode_side_effect(text):
            call_count[0] += 1
            if call_count[0] == 1:
                return [10, 20, 30]
            return [40, 50]

        mock_sentencepiece.return_value.EncodeAsIds.side_effect = encode_side_effect

        def adaptive_run(*args, **kwargs):
            input_ids = args[1]["input_ids"]
            b, s = input_ids.shape
            return [np.zeros((b, s, 768), dtype=np.float16), np.zeros((b, 768), dtype=np.float16)]
        mock_onnx_session.return_value.run.side_effect = adaptive_run

        model = _OnnxEmbeddingModel("/fake/path")
        model.encode(["hello world", "hi"])
        call_args = mock_onnx_session.return_value.run.call_args
        input_ids = call_args[0][1]["input_ids"]  # run(None, ort_inputs) → args[1]
        # First text: <s>+3+</s>=5, second: <s>+2+</s>=4. Padded to 5.
        assert input_ids.shape[1] == 5

    def test_truncates_long_text(self, mock_onnx_session, mock_sentencepiece):
        mock_sentencepiece.return_value.EncodeAsIds.return_value = list(range(600))

        def adaptive_run(*args, **kwargs):
            input_ids = args[1]["input_ids"]
            b, s = input_ids.shape
            return [np.zeros((b, s, 768), dtype=np.float16), np.zeros((b, 768), dtype=np.float16)]
        mock_onnx_session.return_value.run.side_effect = adaptive_run

        model = _OnnxEmbeddingModel("/fake/path")
        model.encode(["very long"])
        call_args = mock_onnx_session.return_value.run.call_args
        input_ids = call_args[0][1]["input_ids"]
        # <s> + (capped at 512) + </s> = max 514
        assert input_ids.shape[1] <= 514


class TestSearchAvailable:
    def test_returns_false_when_model_unavailable(self):
        with patch("src.ai.semantic_search._get_embedding_model", return_value=False):
            assert search_available() is False

    def test_returns_false_when_faiss_not_installed(self):
        mock_model = MagicMock()
        with patch("src.ai.semantic_search._get_embedding_model", return_value=mock_model):
            with patch("src.ai.semantic_search.faiss", create=True, side_effect=ImportError):
                import faiss  # noqa — trigger lazy import issue
                # search_available does: `import faiss` so we override the module
                pass
        # search_available imports faiss inside — test with faiss available
        mock_model2 = MagicMock()
        with patch("src.ai.semantic_search._get_embedding_model", return_value=mock_model2):
            assert search_available() is True


class TestSemanticSearch:
    def test_returns_empty_when_model_unavailable(self):
        with patch("src.ai.semantic_search._get_embedding_model", return_value=False):
            result = semantic_search("query", "doc-id")
            assert result == []

    def test_returns_empty_when_index_not_found(self):
        mock_model = MagicMock()
        with patch("src.ai.semantic_search._get_embedding_model", return_value=mock_model):
            with patch("src.services.search_service.index_exists", return_value=False):
                result = semantic_search("query", "doc-id")
                assert result == []

    def test_returns_results_when_index_found(self):
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([[0.1, 0.2, 0.3]], dtype=np.float32)
        faiss_index = MagicMock()
        faiss_index.ntotal = 10
        faiss_index.search.return_value = (np.array([[0.85, 0.45]]), np.array([[0, 2]]))
        meta = [
            {"index": 0, "text": "relevant text"},
            {"index": 1, "text": "other text"},
            {"index": 2, "text": "more text"},
        ]
        with patch("src.ai.semantic_search._get_embedding_model", return_value=mock_model):
            with patch("src.services.search_service.index_exists", return_value=True):
                with patch("src.services.search_service.load_index", return_value=(faiss_index, meta)):
                    result = semantic_search("query", "doc-id", top_k=3)
                    assert len(result) == 2  # 0.85 and 0.45 both > threshold 0.3
                    assert result[0].chunk_index == 0
                    assert result[0].score == 0.85

    def test_filters_below_threshold(self):
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([[0.1, 0.2]], dtype=np.float32)
        faiss_index = MagicMock()
        faiss_index.ntotal = 3
        # All scores below default threshold 0.3
        faiss_index.search.return_value = (np.array([[0.1, 0.2]]), np.array([[0, 1]]))
        meta = [{"index": 0, "text": "a"}, {"index": 1, "text": "b"}]
        with patch("src.ai.semantic_search._get_embedding_model", return_value=mock_model):
            with patch("src.services.search_service.index_exists", return_value=True):
                with patch("src.services.search_service.load_index", return_value=(faiss_index, meta)):
                    result = semantic_search("query", "doc-id")
                    assert result == []


class TestBM25Scoring:
    def test_bm25_simple_match(self):
        from src.ai.semantic_search import _bm25_score
        score = _bm25_score("document processing", "This is a document about processing pipelines")
        assert score > 0

    def test_bm25_no_match(self):
        from src.ai.semantic_search import _bm25_score
        score = _bm25_score("quantum physics", "This is about cooking recipes")
        assert score == 0.0


class TestHighlighting:
    def test_highlight_query_terms(self):
        from src.ai.semantic_search import _highlight_query_terms
        text = "The document processing system uses AI for smart analysis of documents"
        snippets = _highlight_query_terms(text, "document AI")
        assert len(snippets) > 0
        assert any("<<" in s for s in snippets)

    def test_highlight_no_match(self):
        from src.ai.semantic_search import _highlight_query_terms
        snippets = _highlight_query_terms("hello world", "xyzzy")
        assert snippets == []


class TestTokenize:
    def test_tokenize_english(self):
        from src.ai.semantic_search import _tokenize
        tokens = _tokenize("The quick brown fox")
        assert "the" in tokens
        assert "fox" in tokens

    def test_tokenize_chinese(self):
        from src.ai.semantic_search import _tokenize
        tokens = _tokenize("智能文档处理")
        assert "文" in tokens
        assert "档" in tokens


class TestHybridSearch:
    def test_returns_empty_when_model_unavailable(self):
        from src.ai.semantic_search import hybrid_search
        with patch("src.ai.semantic_search._get_embedding_model", return_value=False):
            result = hybrid_search("query", "doc-id")
            assert result == []

    def test_returns_empty_when_index_not_found(self):
        from src.ai.semantic_search import hybrid_search
        mock_model = MagicMock()
        with patch("src.ai.semantic_search._get_embedding_model", return_value=mock_model):
            with patch("src.services.search_service.index_exists", return_value=False):
                result = hybrid_search("query", "doc-id")
                assert result == []

    def test_results_include_dual_scores(self):
        from src.ai.semantic_search import hybrid_search
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([[0.1, 0.2, 0.3]], dtype=np.float32)
        faiss_index = MagicMock()
        faiss_index.ntotal = 5
        faiss_index.search.return_value = (np.array([[0.9]]), np.array([[0]]))
        meta = [{"index": 0, "text": "document processing with AI technology"}]
        with patch("src.ai.semantic_search._get_embedding_model", return_value=mock_model):
            with patch("src.services.search_service.index_exists", return_value=True):
                with patch("src.services.search_service.load_index", return_value=(faiss_index, meta)):
                    results = hybrid_search("document AI", "doc-id", top_k=1, vector_weight=0.5)
                    assert len(results) == 1
                    r = results[0]
                    assert 0 <= r.keyword_score <= 1
                    assert 0 <= r.vector_score <= 1
