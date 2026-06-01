"""AI rewriting strategy."""

from __future__ import annotations

from src.ai.deepseek_client import DeepSeekClient, get_deepseek_client
from src.ai.prompts import REWRITE_SYSTEM, rewrite_user


async def rewrite(
    text: str,
    tone: str = "professional",
    audience: str = "general",
    length: str = "similar",
    instructions: str | None = None,
    client: DeepSeekClient | None = None,
) -> dict:
    """Rewrite text with specified tone, audience, and length."""
    cl = client or get_deepseek_client()

    user_msg = rewrite_user(text, tone, audience, length, instructions)

    response = await cl.chat_with_system(REWRITE_SYSTEM, user_msg, temperature=0.5, max_tokens=8192)
    return {
        "rewritten_text": response.content,
        "tokens_used": response.usage.get("total_tokens", 0),
    }
