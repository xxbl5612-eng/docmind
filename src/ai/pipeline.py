"""AI processing pipeline orchestrator: cleaner → chunker → strategies → aggregator."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

import structlog

from src.ai.cleaner import clean, CleanedDocument
from src.ai.chunker import (
    Chunk,
    ChunkStrategy,
    chunk_text,
    select_strategy,
)
from src.ai.deepseek_client import get_deepseek_client, DeepSeekClient
from src.ai.prompts import (
    PROOFREAD_SYSTEM, REWRITE_SYSTEM, SUMMARIZE_SYSTEM,
    EXTRACT_ENTITIES_SYSTEM, EXTRACT_TABLES_SYSTEM, EXTRACT_KEY_FACTS_SYSTEM,
    CONVERT_SYSTEM, QA_SYSTEM,
    proofread_user, rewrite_user, summarize_user, extract_user, convert_user,
)
from src.config import settings

logger = structlog.get_logger()


def _clean_usage(usage: dict) -> dict:
    """Keep only essential token fields: prompt, completion, total."""
    return {
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
        "total_tokens": usage.get("total_tokens", 0),
    }


@dataclass
class ProcessingResult:
    """Unified result from any AI processing task."""
    task_id: str
    status: str  # "completed" or "failed"
    result: Any
    chunks_processed: int = 0
    tokens_used: int = 0
    error: str | None = None


# ── Strategy functions ──

async def process_proofread(
    text: str,
    client: DeepSeekClient | None = None,
    language: str = "auto",
    style_guide: str | None = None,
) -> ProcessingResult:
    client = client or get_deepseek_client()
    system_prompt = PROOFREAD_SYSTEM
    if style_guide:
        system_prompt += f"\n\nStyle guide to follow: {style_guide}"

    response = await client.proofread(text, system_prompt, language)
    return ProcessingResult(
        task_id=uuid.uuid4().hex,
        status="completed",
        result={"corrected_text": response.content, "tokens_used": _clean_usage(response.usage)},
        chunks_processed=1,
        tokens_used=response.usage.get("total_tokens", 0),
    )


async def process_rewrite(
    text: str,
    tone: str = "professional",
    audience: str = "general",
    length: str = "similar",
    instructions: str | None = None,
    client: DeepSeekClient | None = None,
) -> ProcessingResult:
    client = client or get_deepseek_client()
    system_prompt = REWRITE_SYSTEM
    user_msg = rewrite_user(text, tone, audience, length, instructions)

    response = await client.chat_with_system(system_prompt, user_msg, temperature=0.5, max_tokens=8192)
    return ProcessingResult(
        task_id=uuid.uuid4().hex,
        status="completed",
        result={"rewritten_text": response.content, "tokens_used": _clean_usage(response.usage)},
        chunks_processed=1,
        tokens_used=response.usage.get("total_tokens", 0),
    )


async def process_summarize(
    text: str,
    length: str = "medium",
    format_type: str = "paragraph",
    focus: str | None = None,
    client: DeepSeekClient | None = None,
) -> ProcessingResult:
    client = client or get_deepseek_client()
    system_prompt = SUMMARIZE_SYSTEM
    user_msg = summarize_user(text, length, format_type, focus)

    response = await client.chat_with_system(system_prompt, user_msg, temperature=0.2, max_tokens=4096)
    summary = response.content
    compression = round(len(summary) / max(len(text), 1), 4)

    return ProcessingResult(
        task_id=uuid.uuid4().hex,
        status="completed",
        result={
            "summary": summary,
            "original_char_count": len(text),
            "summary_char_count": len(summary),
            "compression_ratio": compression,
            "tokens_used": _clean_usage(response.usage),
        },
        chunks_processed=1,
        tokens_used=response.usage.get("total_tokens", 0),
    )


async def process_extract(
    text: str,
    extract_type: str = "entities",
    custom_schema: dict | None = None,
    client: DeepSeekClient | None = None,
) -> ProcessingResult:
    client = client or get_deepseek_client()

    prompt_map = {
        "entities": EXTRACT_ENTITIES_SYSTEM,
        "tables": EXTRACT_TABLES_SYSTEM,
        "key_facts": EXTRACT_KEY_FACTS_SYSTEM,
    }
    system_prompt = prompt_map.get(extract_type, EXTRACT_ENTITIES_SYSTEM)
    if custom_schema:
        system_prompt += f"\n\nUse this schema: {custom_schema}"

    response = await client.extract(text, system_prompt)
    import orjson
    try:
        result_data = orjson.loads(response.content)
    except Exception:
        result_data = {"raw": response.content}

    return ProcessingResult(
        task_id=uuid.uuid4().hex,
        status="completed",
        result={"result": result_data, "extract_type": extract_type, "tokens_used": _clean_usage(response.usage)},
        chunks_processed=1,
        tokens_used=response.usage.get("total_tokens", 0),
    )


async def process_convert(
    text: str,
    target_format: str,
    preserve_structure: bool = True,
    client: DeepSeekClient | None = None,
) -> ProcessingResult:
    client = client or get_deepseek_client()

    # For PDF: first convert to HTML, then render to actual PDF bytes
    actual_target = "html" if target_format in ("pdf", "pdf") else target_format

    system_prompt = CONVERT_SYSTEM
    if preserve_structure:
        system_prompt += "\nPreserve the original document structure including headings, lists, and tables."
    user_msg = convert_user(text, actual_target)

    response = await client.chat_with_system(system_prompt, user_msg, temperature=0.1, max_tokens=16384)
    converted = response.content

    result: dict = {
        "converted_content": converted,
        "target_format": target_format,
        "tokens_used": _clean_usage(response.usage),
    }

    # If target is PDF, generate actual PDF from the HTML output
    if target_format in ("pdf", "PDF"):
        from src.ai.pdf_generator import generate_pdf_from_html
        import uuid as _uuid
        from src.core.storage import upload_file

        pdf_bytes = generate_pdf_from_html(converted, title="Converted Document")
        pdf_path = f"converted/{_uuid.uuid4().hex}.pdf"
        upload_file(pdf_bytes, pdf_path, "application/pdf")
        result["pdf_path"] = pdf_path
        result["pdf_size_bytes"] = len(pdf_bytes)

    return ProcessingResult(
        task_id=uuid.uuid4().hex,
        status="completed",
        result=result,
        chunks_processed=1,
        tokens_used=response.usage.get("total_tokens", 0),
    )


async def process_qa(
    question: str,
    context: str,
    client: DeepSeekClient | None = None,
) -> ProcessingResult:
    client = client or get_deepseek_client()
    system_prompt = QA_SYSTEM
    user_msg = f"Document Context:\n```\n{context}\n```\n\nQuestion: {question}"

    response = await client.chat_with_system(system_prompt, user_msg, temperature=0.2, max_tokens=4096)
    return ProcessingResult(
        task_id=uuid.uuid4().hex,
        status="completed",
        result={"question": question, "answer": response.content, "tokens_used": _clean_usage(response.usage)},
        chunks_processed=1,
        tokens_used=response.usage.get("total_tokens", 0),
    )


# ── Chunked processing (for async/long docs) ──

async def process_chunk(
    chunk: Chunk,
    task_type: str,
    params: dict[str, Any],
    client: DeepSeekClient | None = None,
) -> dict[str, Any]:
    """Process a single chunk. Used by Celery workers."""
    client = client or get_deepseek_client()

    handlers = {
        "proofread": _chunk_proofread,
        "rewrite": _chunk_rewrite,
        "summarize": _chunk_summarize,
        "extract": _chunk_extract,
        "convert": _chunk_convert,
    }

    handler = handlers.get(task_type)
    if handler is None:
        raise ValueError(f"Unknown task_type: {task_type}")

    return await handler(client, chunk, params)


async def _chunk_proofread(client: DeepSeekClient, chunk: Chunk, params: dict) -> dict:
    response = await client.proofread(chunk.text, PROOFREAD_SYSTEM, params.get("language", "auto"))
    return {"index": chunk.index, "corrected_text": response.content, "tokens": _clean_usage(response.usage)}


async def _chunk_rewrite(client: DeepSeekClient, chunk: Chunk, params: dict) -> dict:
    user_msg = rewrite_user(chunk.text, params.get("tone", "professional"), params.get("audience", "general"), params.get("length", "similar"), params.get("instructions"))
    response = await client.chat_with_system(REWRITE_SYSTEM, user_msg, temperature=0.5, max_tokens=8192)
    return {"index": chunk.index, "rewritten_text": response.content, "tokens": _clean_usage(response.usage)}


async def _chunk_summarize(client: DeepSeekClient, chunk: Chunk, params: dict) -> dict:
    response = await client.summarize(chunk.text, SUMMARIZE_SYSTEM)
    return {"index": chunk.index, "summary": response.content, "tokens": _clean_usage(response.usage)}


async def _chunk_extract(client: DeepSeekClient, chunk: Chunk, params: dict) -> dict:
    prompt_map = {"entities": EXTRACT_ENTITIES_SYSTEM, "tables": EXTRACT_TABLES_SYSTEM, "key_facts": EXTRACT_KEY_FACTS_SYSTEM}
    system_prompt = prompt_map.get(params.get("extract_type", "entities"), EXTRACT_ENTITIES_SYSTEM)
    response = await client.extract(chunk.text, system_prompt)
    return {"index": chunk.index, "extracted": response.content, "tokens": _clean_usage(response.usage)}


async def _chunk_convert(client: DeepSeekClient, chunk: Chunk, params: dict) -> dict:
    user_msg = convert_user(chunk.text, params.get("target_format", "txt"))
    response = await client.chat_with_system(CONVERT_SYSTEM, user_msg, temperature=0.1, max_tokens=16384)
    return {"index": chunk.index, "converted_content": response.content, "tokens": _clean_usage(response.usage)}


# ── Aggregation ──

def aggregate_chunk_results(task_type: str, chunk_results: list[dict]) -> Any:
    """Merge chunk processing results into a single output."""
    if not chunk_results:
        return None

    sorted_results = sorted(chunk_results, key=lambda r: r["index"])

    if task_type == "proofread":
        return "\n\n".join(r["corrected_text"] for r in sorted_results)
    elif task_type == "rewrite":
        return "\n\n".join(r["rewritten_text"] for r in sorted_results)
    elif task_type == "summarize":
        if len(sorted_results) == 1:
            return sorted_results[0]["summary"]
        summaries = [r["summary"] for r in sorted_results]
        return "\n\n".join(summaries)
    elif task_type == "extract":
        # Merge extractions
        merged: dict = {"entities": [], "key_facts": [], "numbers": [], "dates": [], "people": [], "organizations": []}
        for r in sorted_results:
            extracted = r["extracted"]
            if isinstance(extracted, str):
                import orjson
                try:
                    extracted = orjson.loads(extracted)
                except Exception:
                    continue
            for key in merged:
                if key in extracted:
                    merged[key].extend(extracted[key] if isinstance(extracted[key], list) else [extracted[key]])
        return merged
    elif task_type == "convert":
        return "\n\n".join(r["converted_content"] for r in sorted_results)

    return None
