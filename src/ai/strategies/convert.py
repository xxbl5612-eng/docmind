"""AI format conversion strategy."""

from __future__ import annotations

from src.ai.deepseek_client import DeepSeekClient, get_deepseek_client
from src.ai.prompts import CONVERT_SYSTEM, convert_user


async def convert(
    text: str,
    target_format: str,
    preserve_structure: bool = True,
    client: DeepSeekClient | None = None,
) -> dict:
    """Convert document content to a target format using AI."""
    cl = client or get_deepseek_client()

    system = CONVERT_SYSTEM
    if preserve_structure:
        system += "\nPreserve the original document structure including headings, lists, and tables."

    user_msg = convert_user(text, target_format)

    response = await cl.chat_with_system(system, user_msg, temperature=0.1, max_tokens=16384)
    return {
        "converted_content": response.content,
        "target_format": target_format,
        "tokens_used": response.usage.get("total_tokens", 0),
    }
