"""OCR module using EasyOCR for image and image-based PDF text extraction.

Lazy-loads the model on first use to minimize memory footprint.
"""

from __future__ import annotations

import io
from pathlib import Path

_reader = None


def _get_reader():
    """Lazy-init EasyOCR reader with Chinese + English support."""
    global _reader
    if _reader is None:
        import easyocr
        _reader = easyocr.Reader(["ch_sim", "en"], gpu=False)
    return _reader


def ocr_image(image_bytes: bytes) -> str:
    """Run OCR on an image (JPEG/PNG) and return extracted text."""
    import numpy as np
    from PIL import Image
    reader = _get_reader()
    img = Image.open(io.BytesIO(image_bytes))
    img_array = np.array(img)
    results = reader.readtext(img_array, detail=0)
    return "\n".join(results)


def ocr_pdf_pages(pdf_bytes: bytes) -> str:
    """Run OCR on each page of a PDF (for image-based/scanned PDFs).

    Uses PyMuPDF (fitz) to render pages as images, then OCRs each page.
    """
    import fitz
    import numpy as np

    reader = _get_reader()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    all_text: list[str] = []

    for page in doc:
        # Render page at 200 DPI for good OCR quality
        pix = page.get_pixmap(dpi=200)
        img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
            pix.height, pix.width, pix.n
        )
        results = reader.readtext(img_array, detail=0)
        if results:
            all_text.append("\n".join(results))

    doc.close()
    return "\n\n".join(all_text)
