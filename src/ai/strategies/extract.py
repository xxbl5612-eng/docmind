"""AI extraction strategy."""

from __future__ import annotations

import orjson

from src.ai.deepseek_client import DeepSeekClient, get_deepseek_client
from src.ai.prompts import (
    EXTRACT_ENTITIES_SYSTEM,
    EXTRACT_TABLES_SYSTEM,
    EXTRACT_KEY_FACTS_SYSTEM,
    extract_user,
)

_PROMPTS = {
    "entities": EXTRACT_ENTITIES_SYSTEM,
    "tables": EXTRACT_TABLES_SYSTEM,
    "key_facts": EXTRACT_KEY_FACTS_SYSTEM,
}


async def extract(
    text: str,
    extract_type: str = "entities",
    custom_schema: dict | None = None,
    client: DeepSeekClient | None = None,
) -> dict:
    """Extract structured data from text."""
    cl = client or get_deepseek_client()
    system = _PROMPTS.get(extract_type, EXTRACT_ENTITIES_SYSTEM)
    if custom_schema:
        system += f"\n\nUse this JSON schema: {custom_schema}"

    response = await cl.extract(text, system)
    try:
        result = orjson.loads(response.content)
    except Exception:
        result = {"raw": response.content}

    return {
        "result": result,
        "extract_type": extract_type,
        "tokens_used": response.usage.get("total_tokens", 0),
    }
