"""Extract slide structure from PPTX files for frontend rendering."""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SlideShapeData:
    shape_idx: int
    shape_type: str  # "text", "picture", "table", "group", "other"
    left: float
    top: float
    width: float
    height: float
    text: str | None = None
    font_size: float | None = None
    font_name: str | None = None
    font_bold: bool = False
    font_italic: bool = False
    font_color: str | None = None  # #RRGGBB
    fill_color: str | None = None
    alignment: str | None = None
    has_image: bool = False
    image_index: int | None = None
    table_rows: list[list[str]] | None = None
    paragraphs: list[dict[str, Any]] = field(default_factory=list)
    is_title: bool = False


@dataclass
class SlideData:
    slide_index: int
    width_emu: int
    height_emu: int
    width_px: float
    height_px: float
    shapes: list[SlideShapeData] = field(default_factory=list)
    bg_color: str | None = None


@dataclass
class PptxSlideExtract:
    slides: list[SlideData]
    image_count: int


EMU_TO_PX = 96.0 / 914400.0
FALLBACK_WIDTH_EMU = 12192000
FALLBACK_HEIGHT_EMU = 6858000
MAX_SLIDE_WIDTH_PX = 960

# Default theme colors (approximate Office theme)
THEME_COLORS: dict[str, str] = {
    "tx1": "000000", "tx2": "1F497D", "bg1": "FFFFFF", "bg2": "EEECE1",
    "accent1": "4F81BD", "accent2": "C0504D", "accent3": "9BBB59",
    "accent4": "8064A2", "accent5": "4BACC6", "accent6": "F79646",
}


def _resolve_color(color_obj) -> str | None:
    """Resolve a pptx color to hex string, including theme colors."""
    try:
        if color_obj is None:
            return None
        if hasattr(color_obj, "rgb") and color_obj.rgb:
            return str(color_obj.rgb)
        if hasattr(color_obj, "theme_color") and color_obj.theme_color:
            tc = str(color_obj.theme_color).lower()
            return THEME_COLORS.get(tc, "333333")
    except Exception:
        pass
    return None


def _get_effective_font(run, shape_is_title: bool) -> dict[str, Any]:
    """Get font properties from a run, with fallback defaults."""
    font = run.font
    result: dict[str, Any] = {}

    # Font size with fallback based on role
    if font.size:
        result["font_size"] = round(font.size / 12700, 1)
    else:
        result["font_size"] = 28 if shape_is_title else 18

    result["bold"] = font.bold if font.bold is not None else shape_is_title
    result["italic"] = bool(font.italic)

    name = font.name
    result["font_name"] = name if name else None

    color = _resolve_color(font.color)
    result["color"] = f"#{color}" if color else None

    return result


def _get_shape_fill(shape) -> str | None:
    """Extract shape fill color."""
    try:
        fill = shape.fill
        if fill is None:
            return None
        ft = str(fill.type) if hasattr(fill, "type") else ""
        if ft == "SOLID" or not ft:
            fc = _resolve_color(fill.fore_color)
            if fc:
                return f"#{fc}"
    except Exception:
        pass
    return None


def _get_slide_bg(slide) -> str | None:
    """Extract slide background color."""
    try:
        bg = slide.background
        if bg and bg.fill:
            fc = _resolve_color(bg.fill.fore_color)
            if fc:
                return f"#{fc}"
    except Exception:
        pass
    return None


def _get_alignment(para) -> str:
    try:
        from pptx.enum.text import PP_ALIGN
        mapping = {
            PP_ALIGN.LEFT: "left", PP_ALIGN.CENTER: "center",
            PP_ALIGN.RIGHT: "right", PP_ALIGN.JUSTIFY: "justify",
        }
        return mapping.get(para.alignment, "left") if para.alignment else "left"
    except Exception:
        return "left"


def _shape_role(shape) -> str:
    """Determine if a shape is a title, subtitle, or body."""
    try:
        if shape.is_placeholder:
            ph = shape.placeholder_format
            if ph.type is not None:
                from pptx.enum.shapes import PP_PLACEHOLDER
                if ph.type == PP_PLACEHOLDER.TITLE:
                    return "title"
                if ph.type == PP_PLACEHOLDER.SUBTITLE:
                    return "subtitle"
                if ph.type == PP_PLACEHOLDER.CENTER_TITLE:
                    return "title"
        # Heuristic: check shape name
        name = shape.name.lower() if hasattr(shape, "name") else ""
        if "title" in name:
            return "title"
        if "subtitle" in name:
            return "subtitle"
    except Exception:
        pass
    return "body"


def extract_slides(data: bytes) -> PptxSlideExtract:
    """Extract slide structure from PPTX bytes."""
    from pptx import Presentation

    prs = Presentation(io.BytesIO(data))
    slide_width = prs.slide_width or FALLBACK_WIDTH_EMU
    slide_height = prs.slide_height or FALLBACK_HEIGHT_EMU
    scale = min(MAX_SLIDE_WIDTH_PX / (slide_width * EMU_TO_PX), 1.0)

    slides: list[SlideData] = []
    image_index = 0

    for s_idx, slide in enumerate(prs.slides):
        bg = _get_slide_bg(slide)
        sd = SlideData(
            slide_index=s_idx,
            width_emu=slide_width,
            height_emu=slide_height,
            width_px=round(slide_width * EMU_TO_PX * scale, 1),
            height_px=round(slide_height * EMU_TO_PX * scale, 1),
            bg_color=bg,
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

            if hasattr(shape, "image") and shape.image:
                sh_data.shape_type = "picture"
                sh_data.has_image = True
                sh_data.image_index = image_index
                image_index += 1
                sd.shapes.append(sh_data)
                continue

            if shape.has_table:
                sh_data.shape_type = "table"
                sh_data.table_rows = [
                    [cell.text for cell in row.cells]
                    for row in shape.table.rows
                ]
                sd.shapes.append(sh_data)
                continue

            if not shape.has_text_frame:
                sd.shapes.append(sh_data)
                continue

            sh_data.shape_type = "text"
            role = _shape_role(shape)
            sh_data.is_title = (role == "title")
            tf = shape.text_frame
            paragraphs: list[dict[str, Any]] = []
            all_text: list[str] = []

            for para in tf.paragraphs:
                para_runs: list[dict[str, Any]] = []
                para_text_parts: list[str] = []

                for run in para.runs:
                    font_info = _get_effective_font(run, role == "title")
                    run_data: dict[str, Any] = {"text": run.text, **font_info}
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

            # Shape-level font from first run of first non-empty paragraph
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

            # If no runs had text, still use defaults
            if sh_data.font_size is None:
                sh_data.font_size = 28 if role == "title" else 18
            if role == "title" and not sh_data.font_bold:
                sh_data.font_bold = True

            fill = _get_shape_fill(shape)
            if fill:
                sh_data.fill_color = fill

            sd.shapes.append(sh_data)
        slides.append(sd)

    return PptxSlideExtract(slides=slides, image_count=image_index)


def extract_slide_image(data: bytes, slide_index: int, image_index: int) -> tuple[bytes, str] | None:
    """Extract a specific embedded image from a PPTX file."""
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
