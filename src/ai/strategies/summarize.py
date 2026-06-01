"""AI summarization strategy with multi-stage long-doc support."""

from __future__ import annotations

from src.ai.deepseek_client import DeepSeekClient, get_deepseek_client
from src.ai.prompts import SUMMARIZE_SYSTEM, summarize_user


async def summarize(
    text: str,
    length: str = "medium",
    format_type: str = "paragraph",
    focus: str | None = None,
    client: DeepSeekClient | None = None,
) -> dict:
    """Summarize text, single-chunk."""
    cl = client or get_deepseek_client()
    user_msg = summarize_user(text, length, format_type, focus)

    response = await cl.chat_with_system(SUMMARIZE_SYSTEM, user_msg, temperature=0.2, max_tokens=4096)
    summary = response.content

    return {
        "summary": summary,
        "original_char_count": len(text),
        "summary_char_count": len(summary),
        "compression_ratio": round(len(summary) / max(len(text), 1), 4),
        "tokens_used": response.usage.get("total_tokens", 0),
    }


async def summarize_chunks(
    chunk_summaries: list[str],
    length: str = "medium",
    format_type: str = "paragraph",
    client: DeepSeekClient | None = None,
) -> dict:
    """Summarize a collection of chunk-level summaries (multi-stage for long docs)."""
    cl = client or get_deepseek_client()
    combined = "\n\n---\n\n".join(chunk_summaries)

    system = "You are an expert summarizer. Synthesize these chunk summaries into one coherent summary."
    user_msg = summarize_user(combined, length, format_type)

    response = await cl.chat_with_system(system, user_msg, temperature=0.2, max_tokens=4096)
    return {
        "summary": response.content,
        "summary_char_count": len(response.content),
        "tokens_used": response.usage.get("total_tokens", 0),
    }
