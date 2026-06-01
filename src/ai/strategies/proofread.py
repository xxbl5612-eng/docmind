"""AI proofreading strategy."""

from __future__ import annotations

from src.ai.deepseek_client import DeepSeekClient, get_deepseek_client
from src.ai.prompts import PROOFREAD_SYSTEM


async def proofread(
    text: str,
    language: str = "auto",
    style_guide: str | None = None,
    client: DeepSeekClient | None = None,
) -> dict:
    """Proofread text and return corrections."""
    cl = client or get_deepseek_client()

    system = PROOFREAD_SYSTEM
    if style_guide:
        system += f"\n\nStyle guide: {style_guide}"

    response = await cl.proofread(text, system, language)
    return {
        "corrected_text": response.content,
        "language": language,
        "tokens_used": response.usage.get("total_tokens", 0),
    }


async def proofread_with_diff(
    text: str,
    language: str = "auto",
    client: DeepSeekClient | None = None,
) -> dict:
    """Proofread and return structured diff."""
    cl = client or get_deepseek_client()

    system = """You are a professional proofreader. Return corrections as JSON.

For each change provide: original text, corrected text, reason, type (grammar/spelling/style/punctuation).
Format: {"corrections": [...], "summary": "..."}

Return valid JSON only."""

    response = await cl.proofread(text, system, language)
    import orjson
    try:
        return orjson.loads(response.content)
    except Exception:
        return {"corrections": [], "summary": response.content}
