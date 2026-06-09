"""Integration tests for document features: upload, OCR, PPTX, search index."""

from __future__ import annotations

import io
from pathlib import Path

import pytest

from tests.conftest import settings  # noqa


def _create_test_docx() -> io.BytesIO:
    """Create a minimal DOCX file for testing."""
    import zipfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("[Content_Types].xml", (
            '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            '</Types>'
        ))
        zf.writestr("_rels/.rels", (
            '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            '</Relationships>'
        ))
        zf.writestr("word/document.xml", (
            '<?xml version="1.0"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            '<w:body>'
            '<w:p><w:r><w:t>智能文档处理助手项目规划书</w:t></w:r></w:p>'
            '<w:p><w:r><w:t>本项目旨在通过完整开发实践AGI全栈技术。文档处理系统支持上传、解析、校对和总结功能。</w:t></w:r></w:p>'
            '<w:p><w:r><w:t>技术方案采用FastAPI后端、React前端、DeepSeek AI和PostgreSQL数据库。</w:t></w:r></w:p>'
            '</w:body>'
            '</w:document>'
        ))
    buf.seek(0)
    return buf


@pytest.fixture
def test_docx():
    return _create_test_docx()


class TestDocumentUpload:
    @pytest.mark.asyncio
    async def test_upload_docx(self, async_client, auth_headers):
        docx = _create_test_docx()
        resp = await async_client.post(
            "/api/v1/documents/upload",
            headers=auth_headers,
            files={"file": ("test.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["input_format"] == "docx"
        assert data["data"]["char_count"] > 0
        assert data["data"]["status"] == "ready"

    @pytest.mark.asyncio
    async def test_upload_unauthorized(self, async_client):
        docx = _create_test_docx()
        resp = await async_client.post(
            "/api/v1/documents/upload",
            files={"file": ("test.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_get_document_content(self, async_client, auth_headers):
        docx = _create_test_docx()
        upload_resp = await async_client.post(
            "/api/v1/documents/upload",
            headers=auth_headers,
            files={"file": ("test.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        assert upload_resp.status_code == 201
        doc_id = upload_resp.json()["data"]["id"]

        resp = await async_client.get(f"/api/v1/documents/{doc_id}/content", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert len(data["data"]["content"]) > 0


class TestOCR:
    @pytest.mark.asyncio
    async def test_ocr_docx_not_supported(self, async_client, auth_headers):
        docx = _create_test_docx()
        upload_resp = await async_client.post(
            "/api/v1/documents/upload",
            headers=auth_headers,
            files={"file": ("test.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        doc_id = upload_resp.json()["data"]["id"]

        resp = await async_client.post(
            f"/api/v1/documents/{doc_id}/ai/ocr",
            headers=auth_headers,
            json={"engine": "easyocr", "language": "ch"},
        )
        # OCR on non-image/non-PDF returns 400
        assert resp.status_code == 400


class TestPPTXSlides:
    @pytest.mark.asyncio
    async def test_slides_not_available_for_docx(self, async_client, auth_headers):
        docx = _create_test_docx()
        upload_resp = await async_client.post(
            "/api/v1/documents/upload",
            headers=auth_headers,
            files={"file": ("test.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        doc_id = upload_resp.json()["data"]["id"]

        resp = await async_client.get(f"/api/v1/documents/{doc_id}/slides", headers=auth_headers)
        assert resp.status_code == 400  # Only PPTX supported


class TestSearchIndex:
    @pytest.mark.asyncio
    async def test_build_and_delete_index(self, async_client, auth_headers):
        docx = _create_test_docx()
        upload_resp = await async_client.post(
            "/api/v1/documents/upload",
            headers=auth_headers,
            files={"file": ("test.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        doc_id = upload_resp.json()["data"]["id"]

        resp = await async_client.post(
            f"/api/v1/documents/{doc_id}/ai/search/index",
            headers=auth_headers,
        )
        if resp.status_code == 503:
            pytest.skip("Search dependencies not available (ONNX model not loaded)")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["chunks_indexed"] > 0

        # Delete index
        del_resp = await async_client.delete(
            f"/api/v1/documents/{doc_id}/ai/search/index",
            headers=auth_headers,
        )
        assert del_resp.status_code == 200

    @pytest.mark.asyncio
    async def test_search_without_index(self, async_client, auth_headers):
        docx = _create_test_docx()
        upload_resp = await async_client.post(
            "/api/v1/documents/upload",
            headers=auth_headers,
            files={"file": ("test.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        doc_id = upload_resp.json()["data"]["id"]

        resp = await async_client.post(
            f"/api/v1/documents/{doc_id}/ai/search",
            headers=auth_headers,
            json={"query": "test"},
        )
        # Without index, should return 503 or empty results
        assert resp.status_code in (200, 503)
