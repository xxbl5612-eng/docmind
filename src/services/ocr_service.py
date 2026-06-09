"""Unified OCR service: PaddleOCR primary, EasyOCR fallback.

Phase 2: structured table output, confidence filtering, language auto-detect, barcode detection.
"""

from __future__ import annotations

import io
import re
from typing import Literal

import structlog

logger = structlog.get_logger()

_paddle_ocr = None


def _get_paddle_ocr(lang: str = "ch"):
    global _paddle_ocr
    if _paddle_ocr is not None:
        return _paddle_ocr
    try:
        from paddleocr import PaddleOCR
        _paddle_ocr = PaddleOCR(lang=lang, use_angle_cls=True, show_log=False)
        logger.info("paddleocr_initialized", lang=lang)
    except ImportError:
        logger.debug("paddleocr_not_installed")
        _paddle_ocr = False
    except Exception as e:
        logger.warning("paddleocr_init_failed", error=str(e))
        _paddle_ocr = False
    return _paddle_ocr


def paddle_available() -> bool:
    ocr = _get_paddle_ocr()
    return ocr is not None and ocr is not False


def _filter_by_confidence(lines: list, min_conf: float) -> list:
    """Filter OCR lines by confidence score."""
    if min_conf <= 0:
        return lines
    return [line for line in lines if line and len(line) >= 2 and line[1][1] >= min_conf]


def ocr_image(
    image_bytes: bytes,
    engine: str = "auto",
    language: str = "ch",
    min_confidence: float = 0.0,
) -> dict:
    """OCR a single image. Returns dict with text, confidence scores, and engine info.

    Result keys: text, engine_used, lines (list of {text, confidence, bbox}).
    """
    result = {"text": "", "engine_used": engine, "lines": []}

    if engine in ("paddle", "auto"):
        reader = _get_paddle_ocr(language)
        if reader and reader is not False:
            try:
                from PIL import Image
                img = Image.open(io.BytesIO(image_bytes))
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")
                import numpy as np
                arr = np.array(img)
                results = reader.ocr(arr)
                if results and results[0]:
                    filtered = _filter_by_confidence(results[0], min_confidence)
                    lines = [
                        {"text": line[1][0], "confidence": float(line[1][1]), "bbox": line[0]}
                        for line in filtered
                        if line and len(line) >= 2
                    ]
                    text = "\n".join(l["text"] for l in lines)
                    if text.strip():
                        result["text"] = text
                        result["lines"] = lines
                        result["engine_used"] = "paddle"
                        logger.info("ocr_paddle", chars=len(text), lines=len(lines))
                        return result
            except Exception as e:
                logger.debug("paddleocr_image_failed", error=str(e))
                if engine == "paddle":
                    raise

    if engine in ("easyocr", "auto"):
        try:
            from src.ai.ocr import ocr_image as easyocr_image
            text = easyocr_image(image_bytes)
            if text.strip():
                result["text"] = text
                result["engine_used"] = "easyocr"
                logger.info("ocr_easyocr_fallback", chars=len(text))
                return result
        except Exception as e:
            logger.debug("easyocr_fallback_failed", error=str(e))
            if engine == "easyocr":
                raise

    logger.warning("ocr_no_engine_available")
    return result


def ocr_pdf(
    pdf_bytes: bytes,
    engine: str = "auto",
    language: str = "ch",
    min_confidence: float = 0.0,
) -> dict:
    """OCR a PDF (renders pages as images, then OCRs each page)."""
    result = {"text": "", "engine_used": engine, "pages": []}

    if engine in ("paddle", "auto"):
        reader = _get_paddle_ocr(language)
        if reader and reader is not False:
            try:
                images = _pdf_to_images(pdf_bytes)
                if images:
                    for i, img_bytes in enumerate(images):
                        page_result = ocr_image(img_bytes, engine="paddle", language=language,
                                               min_confidence=min_confidence)
                        result["pages"].append({
                            "page": i + 1, "text": page_result["text"], "lines": page_result["lines"],
                        })
                    result["text"] = "\n\n".join(p["text"] for p in result["pages"])
                    result["engine_used"] = "paddle"
                    return result
            except Exception as e:
                logger.debug("paddleocr_pdf_failed", error=str(e))
                if engine == "paddle":
                    raise

    if engine in ("easyocr", "auto"):
        try:
            from src.ai.ocr import ocr_pdf_pages as easyocr_pdf
            text = easyocr_pdf(pdf_bytes)
            if text.strip():
                result["text"] = text
                result["engine_used"] = "easyocr"
                return result
        except Exception as e:
            logger.debug("easyocr_pdf_fallback_failed", error=str(e))
            if engine == "easyocr":
                raise

    logger.warning("ocr_pdf_no_engine")
    return result


def ocr_table(
    image_bytes: bytes,
    output_format: Literal["cells", "csv", "markdown"] = "cells",
    min_confidence: float = 0.0,
) -> list[dict]:
    """Extract tables from an image. Returns structured output.

    Each result dict: {row_count, cells (or csv/md depending on format)}.
    """
    reader = _get_paddle_ocr()
    if not reader or reader is False:
        logger.debug("ocr_table_paddle_unavailable")
        return []

    try:
        import numpy as np
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        arr = np.array(img)
        results = reader.ocr(arr)

        tables: list[dict] = []
        if results and results[0]:
            filtered = _filter_by_confidence(results[0], min_confidence)
            rows: dict[float, list[dict]] = {}
            for line in filtered:
                if not line or len(line) < 2:
                    continue
                box = line[0]
                text = line[1][0]
                conf = float(line[1][1]) if len(line[1]) > 1 else 0.0
                y_center = sum(p[1] for p in box) / 4
                row_key = round(y_center / 20) * 20
                if row_key not in rows:
                    rows[row_key] = []
                rows[row_key].append({"text": text, "x": min(p[0] for p in box), "confidence": conf})

            sorted_rows = sorted(rows.items())
            cells = [
                [c["text"] for c in sorted(cells, key=lambda c: c["x"])]
                for _, cells in sorted_rows
            ]

            table_data = {"row_count": len(sorted_rows), "cells": cells}

            if output_format in ("csv", "markdown"):
                table_data[output_format] = _format_table(cells, output_format)

            tables.append(table_data)
        return tables
    except Exception as e:
        logger.debug("ocr_table_failed", error=str(e))
        return []


def _format_table(cells: list[list[str]], fmt: str) -> str:
    """Format table cells as CSV or Markdown."""
    if not cells:
        return ""
    max_cols = max(len(row) for row in cells)
    # Normalize row lengths
    normalized = [row + [""] * (max_cols - len(row)) for row in cells]

    if fmt == "csv":
        import csv as csv_mod
        import io as csv_io
        buf = csv_io.StringIO()
        writer = csv_mod.writer(buf)
        for row in normalized:
            writer.writerow(row)
        return buf.getvalue().strip()

    if fmt == "markdown":
        lines = []
        # Header row + separator
        header = normalized[0]
        lines.append("| " + " | ".join(header) + " |")
        lines.append("| " + " | ".join("---" for _ in header) + " |")
        for row in normalized[1:]:
            lines.append("| " + " | ".join(row) + " |")
        return "\n".join(lines)

    return ""


# ── Language auto-detection ──

def detect_language(text: str) -> str:
    """Auto-detect the primary language from OCR text.

    Returns 'ch', 'en', or 'ch_en'.
    """
    if not text.strip():
        return "ch"  # default
    # Count CJK characters vs Latin characters
    cjk = sum(1 for c in text if "一" <= c <= "鿿" or "㐀" <= c <= "䶿")
    latin = sum(1 for c in text if c.isascii() and c.isalpha())
    total = cjk + latin or 1
    cjk_ratio = cjk / total
    latin_ratio = latin / total
    if cjk_ratio > 0.6:
        return "ch"
    if latin_ratio > 0.8:
        return "en"
    if cjk_ratio > 0.15 and latin_ratio > 0.15:
        return "ch_en"
    return "ch" if cjk_ratio > latin_ratio else "en"


# ── Barcode / QR code detection ──

def detect_barcodes(image_bytes: bytes) -> list[dict]:
    """Detect and decode barcodes and QR codes in an image.

    Returns list of {type, data, bbox}.
    """
    try:
        from pyzbar.pyzbar import decode
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        results = decode(img)
        codes = []
        for r in results:
            codes.append({
                "type": r.type,
                "data": r.data.decode("utf-8", errors="replace"),
                "bbox": [
                    r.rect.left, r.rect.top,
                    r.rect.left + r.rect.width, r.rect.top + r.rect.height,
                ],
            })
        if codes:
            logger.info("barcodes_detected", count=len(codes))
        return codes
    except ImportError:
        logger.debug("pyzbar_not_installed")
        return []
    except Exception as e:
        logger.debug("barcode_detect_failed", error=str(e))
        return []


def detect_barcodes_in_pdf(pdf_bytes: bytes) -> list[dict]:
    """Detect barcodes/QR codes across all pages of a PDF."""
    images = _pdf_to_images(pdf_bytes)
    all_codes = []
    for i, img_bytes in enumerate(images):
        codes = detect_barcodes(img_bytes)
        for c in codes:
            c["page"] = i + 1
        all_codes.extend(codes)
    return all_codes


# ── PDF rendering helpers ──

def _pdf_to_images(pdf_bytes: bytes) -> list[bytes]:
    try:
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(pdf_bytes, dpi=200)
        result = []
        for img in images:
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            result.append(buf.getvalue())
        logger.info("pdf2image_converted", pages=len(result))
        return result
    except ImportError:
        logger.debug("pdf2image_not_installed")
    except Exception as e:
        logger.debug("pdf2image_failed", error=str(e))
    return _pdf_fitz_fallback(pdf_bytes)


def _pdf_fitz_fallback(pdf_bytes: bytes) -> list[bytes]:
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        images = []
        for i in range(doc.page_count):
            pix = doc[i].get_pixmap(dpi=200)
            images.append(pix.tobytes("png"))
        doc.close()
        logger.info("fitz_rendered", pages=len(images))
        return images
    except Exception as e:
        logger.debug("fitz_failed", error=str(e))
        return []
