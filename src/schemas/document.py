"""Document request/response schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class DocumentResponse(BaseModel):
    id: str
    owner_id: str
    title: str
    input_format: str
    output_format: str | None = None
    mime_type: str | None = None
    file_size_bytes: int
    page_count: int | None = None
    char_count: int | None = None
    status: str
    metadata_: dict | None = Field(default=None, alias="metadata_")
    tags: list | None = None
    folder: str | None = None
    checksum_sha256: str | None = None
    current_version_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_validator("id", "owner_id", "current_version_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v: Any) -> str | None:
        if v is None:
            return None
        if isinstance(v, uuid.UUID):
            return str(v)
        return str(v)

    @field_validator("tags", mode="before")
    @classmethod
    def coerce_tags(cls, v: Any) -> list:
        if v is None:
            return []
        if isinstance(v, list):
            return v
        return list(v) if hasattr(v, "__iter__") else []

    @field_validator("metadata_", mode="before")
    @classmethod
    def coerce_metadata(cls, v: Any) -> dict:
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        return {}


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class DocumentUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    tags: list[str] | None = None
    folder: str | None = None


class DocumentContentResponse(BaseModel):
    id: str
    content: str
    char_count: int
    version_id: str


class DocumentContentUpdateRequest(BaseModel):
    content: str
    change_summary: str | None = None


class ExportRequest(BaseModel):
    target_format: str = Field(pattern=r"^(pdf|docx|md|html|txt|json)$")
    options: dict | None = None


class ExportStatusResponse(BaseModel):
    task_id: str
    status: str
    progress_pct: int
    download_url: str | None = None


# ── PPTX Slide schemas ──


class SlideParagraphRun(BaseModel):
    text: str
    font_size: float | None = None
    bold: bool = False
    italic: bool = False
    color: str | None = None
    font_name: str | None = None


class SlideParagraph(BaseModel):
    text: str
    runs: list[SlideParagraphRun] = []
    alignment: str = "left"
    level: int = 0
    bullet_type: str | None = None
    bullet_char: str | None = None


class TableCellStyle(BaseModel):
    row: int
    col: int
    bg_color: str | None = None
    bold: bool = False
    align: str = "left"
    colspan: int = 1
    rowspan: int = 1


class TableData(BaseModel):
    rows: list[list[str]]
    col_widths: list[float] | None = None
    header_count: int = 0
    cell_styles: list[TableCellStyle] = []
    row_count: int = 0
    col_count: int = 0


class SlideShapeData(BaseModel):
    shape_idx: int
    shape_type: str
    left: float
    top: float
    width: float
    height: float
    text: str | None = None
    font_size: float | None = None
    font_name: str | None = None
    font_bold: bool = False
    font_italic: bool = False
    font_color: str | None = None
    fill_color: str | None = None
    alignment: str | None = None
    has_image: bool = False
    image_index: int | None = None
    table_rows: list[list[str]] | None = None
    paragraphs: list[SlideParagraph] = []
    is_title: bool = False
    fill_type: str | None = None
    gradient_angle: float | None = None
    gradient_stops: list[dict] = []
    border_color: str | None = None
    border_width: float | None = None
    border_style: str | None = None
    border_radius: float | None = None
    shadow: bool = False
    rotation: float | None = None
    table_data: TableData | None = None


class SlideData(BaseModel):
    slide_index: int
    width_emu: int
    height_emu: int
    width_px: float
    height_px: float
    shapes: list[SlideShapeData] = []
    bg_color: str | None = None
    bg_fill_type: str | None = None
    bg_gradient_stops: list[dict] = []
    bg_gradient_angle: float | None = None


class SlidesResponse(BaseModel):
    slides: list[SlideData]
    image_count: int
    total_slides: int
