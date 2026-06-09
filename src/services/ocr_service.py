"""Unified OCR service: PaddleOCR primary, EasyOCR fallback."""

from __future__ import annotations

import io

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


def ocr_image(
    image_bytes: bytes,
    engine: str = "auto",
    language: str = "ch",
) -> str:
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
                    lines = [line[1][0] for line in results[0] if line and len(line) >= 2]
                    text = "\n".join(lines)
                    if text.strip():
                        logger.info("ocr_paddle", chars=len(text))
                        return text
            except Exception as e:
                logger.debug("paddleocr_image_failed", error=str(e))
                if engine == "paddle":
                    raise

    if engine in ("easyocr", "auto"):
        try:
            from src.ai.ocr import ocr_image as easyocr_image
            result = easyocr_image(image_bytes)
            if result.strip():
                logger.info("ocr_easyocr_fallback", chars=len(result))
                return result
        except Exception as e:
            logger.debug("easyocr_fallback_failed", error=str(e))
            if engine == "easyocr":
                raise

    logger.warning("ocr_no_engine_available")
    return ""


def ocr_pdf(
    pdf_bytes: bytes,
    engine: str = "auto",
    language: str = "ch",
) -> str:
    if engine in ("paddle", "auto"):
        reader = _get_paddle_ocr(language)
        if reader and reader is not False:
            try:
                images = _pdf_to_images(pdf_bytes)
                if images:
                    page_texts = []
                    for img_bytes in images:
                        page_text = ocr_image(img_bytes, engine="paddle", language=language)
                        page_texts.append(page_text)
                    return "\n\n".join(page_texts)
            except Exception as e:
                logger.debug("paddleocr_pdf_failed", error=str(e))
                if engine == "paddle":
                    raise

    if engine in ("easyocr", "auto"):
        try:
            from src.ai.ocr import ocr_pdf_pages as easyocr_pdf
            result = easyocr_pdf(pdf_bytes)
            if result.strip():
                return result
        except Exception as e:
            logger.debug("easyocr_pdf_fallback_failed", error=str(e))
            if engine == "easyocr":
                raise

    logger.warning("ocr_pdf_no_engine")
    return ""


def ocr_table(image_bytes: bytes) -> list[dict]:
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
            rows: dict[float, list[dict]] = {}
            for line in results[0]:
                if not line or len(line) < 2:
                    continue
                box = line[0]
                text = line[1][0]
                y_center = sum(p[1] for p in box) / 4
                row_key = round(y_center / 20) * 20
                if row_key not in rows:
                    rows[row_key] = []
                rows[row_key].append({"text": text, "x": min(p[0] for p in box)})

            sorted_rows = sorted(rows.items())
            tables.append({
                "row_count": len(sorted_rows),
                "cells": [
                    [c["text"] for c in sorted(cells, key=lambda c: c["x"])]
                    for _, cells in sorted_rows
                ],
            })
        return tables
    except Exception as e:
        logger.debug("ocr_table_failed", error=str(e))
        return []


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
