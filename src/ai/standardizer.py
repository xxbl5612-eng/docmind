"""Format standardization for document conversion without AI (format detection, basic transforms)."""

from __future__ import annotations

import re
from html import escape


def standardize_to_markdown(text: str, input_format: str) -> str:
    """Convert various input formats to normalized Markdown."""
    if input_format in ("txt", "md"):
        return text
    if input_format == "html":
        return _html_to_markdown(text)
    return text


def standardize_to_plain(text: str, input_format: str) -> str:
    """Convert to plain text, stripping formatting artifacts."""
    if input_format in ("txt", "md"):
        return text
    if input_format == "html":
        return _html_to_plain(text)
    return text


def _html_to_markdown(html_text: str) -> str:
    """Basic HTML to Markdown conversion."""
    text = html_text
    # Remove script/style blocks
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # Headings
    for i in range(6, 0, -1):
        text = re.sub(f"<h{i}[^>]*>(.*?)</h{i}>", lambda m, l=i: f"{'#' * l} {m.group(1).strip()}\n\n", text, flags=re.DOTALL | re.IGNORECASE)
    # Bold/strong
    text = re.sub(r"<(?:b|strong)[^>]*>(.*?)</(?:b|strong)>", r"**\1**", text, flags=re.DOTALL | re.IGNORECASE)
    # Italic
    text = re.sub(r"<(?:i|em)[^>]*>(.*?)</(?:i|em)>", r"*\1*", text, flags=re.DOTALL | re.IGNORECASE)
    # Links
    text = re.sub(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', r"[\2](\1)", text, flags=re.DOTALL | re.IGNORECASE)
    # Lists
    text = re.sub(r"<li[^>]*>(.*?)</li>", r"- \1\n", text, flags=re.DOTALL | re.IGNORECASE)
    # Paragraphs → double newline
    text = re.sub(r"</?p[^>]*>", "\n\n", text, flags=re.IGNORECASE)
    # Line breaks
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    # Remove remaining tags
    text = re.sub(r"<[^>]+>", "", text)
    # Clean up whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _html_to_plain(html_text: str) -> str:
    """Strip all HTML tags to get plain text."""
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;", '"', text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
