"""Extract slide structure from PPTX files for frontend rendering."""

from __future__ import annotations

import base64
import io
import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SlideShapeData:
    shape_idx: int
    shape_type: str  # "text", "picture", "table", "group", "chart", "other"
    left: float
    top: float
    width: float
    height: float
    text: str | None = None
    font_size: float | None = None
    font_name: str | None = None
    font_bold: bool = False
    font_italic: bool = False
    font_color: str | None = None  # hex
    fill_color: str | None = None  # hex background
    alignment: str | None = None  # left, center, right, justify
    has_image: bool = False
    image_index: int | None = None
    table_rows: list[list[str]] | None = None
    # Bullet/multiline paragraphs
    paragraphs: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class SlideData:
    slide_index: int
    width_emu: int
    height_emu: int
    width_px: float
    height_px: float
    shapes: list[SlideShapeData] = field(default_factory=list)


@dataclass
class PptxSlideExtract:
    slides: list[SlideData]
    image_count: int


# Scale factor: EMU (English Metric Units) to pixels at 96 DPI
# 1 EMU = 1/914400 inch, 1 inch = 96 pixels → 1 EMU = 96/914400 px
EMU_TO_PX = 96.0 / 914400.0

# Fallback slide dimensions (standard 16:9)
FALLBACK_WIDTH_EMU = 12192000
FALLBACK_HEIGHT_EMU = 6858000

MAX_SLIDE_WIDTH_PX = 960  # max rendering width in frontend


def _get_font_color(run) -> str | None:
    try:
        from pptx.dml.color import RGBColor
        color = run.font.color
        if color and color.rgb:
            return str(color.rgb)
        if color and color.theme_color:
            return f"theme:{color.theme_color}"
    except Exception:
        pass
    return None


def _get_fill_color(shape) -> str | None:
    try:
        fill = shape.fill
        if fill and fill.fore_color and fill.fore_color.rgb:
            return str(fill.fore_color.rgb)
    except Exception:
        pass
    return None


def _get_alignment(para) -> str | None:
    try:
        from pptx.enum.text import PP_ALIGN
        mapping = {
            PP_ALIGN.LEFT: "left",
            PP_ALIGN.CENTER: "center",
            PP_ALIGN.RIGHT: "right",
            PP_ALIGN.JUSTIFY: "justify",
        }
        return mapping.get(para.alignment, "left") if para.alignment else "left"
    except Exception:
        return "left"


def extract_slides(data: bytes) -> PptxSlideExtract:
    """Extract slide structure from PPTX bytes."""
    from pptx import Presentation
    from pptx.shapes.base import BaseShape
    from pptx.shapes.picture import Picture

    prs = Presentation(io.BytesIO(data))
    slide_width = prs.slide_width or FALLBACK_WIDTH_EMU
    slide_height = prs.slide_height or FALLBACK_HEIGHT_EMU
    scale = min(MAX_SLIDE_WIDTH_PX / (slide_width * EMU_TO_PX), 1.0)

    slides: list[SlideData] = []
    image_index = 0

    for s_idx, slide in enumerate(prs.slides):
        sd = SlideData(
            slide_index=s_idx,
            width_emu=slide_width,
            height_emu=slide_height,
            width_px=round(slide_width * EMU_TO_PX * scale, 1),
            height_px=round(slide_height * EMU_TO_PX * scale, 1),
        )

        for sh_idx, shape in enumerate(slide.shapes):
            sh_data = SlideShapeData(
                shape_idx=sh_idx,
                shape_type="other",
                left=round(shape.left * EMU_TO_PX * scale, 1),
                top=round(shape.top * EMU_TO_PX * scale, 1),
                width=round(shape.width * EMU_TO_PX * scale, 1),
                height=round(shape.height * EMU_TO_PX * scale, 1),
            )

            # Determine shape type
            shape_type = str(shape.shape_type) if hasattr(shape, "shape_type") else ""
            is_placeholder = getattr(shape, "is_placeholder", False)

            if hasattr(shape, "image") and shape.image:
                sh_data.shape_type = "picture"
                sh_data.has_image = True
                sh_data.image_index = image_index
                image_index += 1
            elif shape.has_table:
                sh_data.shape_type = "table"
                table = shape.table
                sh_data.table_rows = [
                    [cell.text for cell in row.cells]
                    for row in table.rows
                ]
            elif shape.has_text_frame:
                sh_data.shape_type = "text"
                tf = shape.text_frame
                paragraphs: list[dict[str, Any]] = []
                all_text: list[str] = []

                for para in tf.paragraphs:
                    para_text_parts: list[str] = []
                    para_runs: list[dict[str, Any]] = []

                    for run in para.runs:
                        run_data: dict[str, Any] = {"text": run.text}
                        font = run.font
                        if font.size:
                            run_data["font_size"] = round(font.size / 12700, 1)  # EMU → pt
                        if font.bold:
                            run_data["bold"] = True
                        if font.italic:
                            run_data["italic"] = True
                        color = _get_font_color(run)
                        if color:
                            run_data["color"] = f"#{color}" if not color.startswith("theme:") else color
                        if font.name:
                            run_data["font_name"] = font.name
                        para_runs.append(run_data)
                        para_text_parts.append(run.text)

                    para_text = "".join(para_text_parts)
                    if para_text.strip():
                        all_text.append(para_text)

                    paragraphs.append({
                        "text": para_text,
                        "runs": para_runs,
                        "alignment": _get_alignment(para),
                        "level": para.level if para.level else 0,
                    })

                sh_data.paragraphs = paragraphs
                sh_data.text = "\n".join(all_text)

                # Inherit font style from first run of first paragraph
                for para in paragraphs:
                    if para["runs"]:
                        first = para["runs"][0]
                        sh_data.font_size = first.get("font_size")
                        sh_data.font_name = first.get("font_name")
                        sh_data.font_bold = first.get("bold", False)
                        sh_data.font_italic = first.get("italic", False)
                        sh_data.font_color = first.get("color")
                        sh_data.alignment = para["alignment"]
                        break

                # Try fill color
                fill = _get_fill_color(shape)
                if fill:
                    sh_data.fill_color = f"#{fill}"

            sd.shapes.append(sh_data)
        slides.append(sd)

    return PptxSlideExtract(slides=slides, image_count=image_index)


def extract_slide_image(data: bytes, slide_index: int, image_index: int) -> tuple[bytes, str] | None:
    """Extract a specific embedded image from a PPTX file.

    Returns (image_bytes, content_type) or None if not found.
    """
    from pptx import Presentation

    prs = Presentation(io.BytesIO(data))
    if slide_index >= len(prs.slides):
        return None

    slide = prs.slides[slide_index]
    current_img = 0

    for shape in slide.shapes:
        if hasattr(shape, "image") and shape.image:
            if current_img == image_index:
                img = shape.image
                content_type = img.content_type or "image/png"
                return img.blob, content_type
            current_img += 1

    return None
