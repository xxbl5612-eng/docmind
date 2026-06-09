"""PDF generation from HTML content using fpdf2 with Chinese font support."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path

from fpdf import FPDF

_FONT_PATHS = [
    Path("C:/Windows/Fonts/msyh.ttc"),
    Path("C:/Windows/Fonts/simhei.ttf"),
    Path("C:/Windows/Fonts/simsun.ttc"),
]


class _BlockCollector(HTMLParser):
    """Parse HTML into a flat list of block-level elements."""

    def __init__(self):
        super().__init__()
        self.blocks: list[dict] = []  # {type, text, tag, attrs}
        self._current: dict | None = None
        self._text_buf: list[str] = []
        self._in_body = False
        self._skip_tags = {"html", "head", "meta", "title", "style", "script", "link"}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        tag = tag.lower()
        if tag in self._skip_tags:
            return
        if tag == "body":
            self._in_body = True
            return
        if not self._in_body:
            return
        self._flush_inline()
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._current = {"type": "heading", "tag": tag, "level": int(tag[1]), "text": ""}
        elif tag == "p":
            self._current = {"type": "paragraph", "tag": "p", "text": ""}
        elif tag == "li":
            self._current = {"type": "list_item", "tag": "li", "text": ""}
        elif tag in ("pre", "code"):
            self._current = {"type": "code", "tag": tag, "text": ""}
        elif tag == "table":
            self._current = {"type": "table", "tag": "table", "rows": [], "_row": []}
        elif tag == "tr":
            if self._current and self._current["type"] == "table":
                self._current["_row"] = []
                self._current["_in_cell"] = False
        elif tag in ("th", "td"):
            if self._current and self._current["type"] == "table":
                self._current["_cell_text"] = []
                self._current["_in_cell"] = True
        elif tag == "hr":
            self.blocks.append({"type": "hr", "tag": "hr", "text": ""})

    def handle_endtag(self, tag: str):
        tag = tag.lower()
        if tag in self._skip_tags:
            return
        if tag == "body":
            self._in_body = False
            self._flush_inline()
            return
        if not self._in_body:
            return
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "pre", "code"):
            self._flush_block()
        elif tag in ("th", "td"):
            if self._current and self._current["type"] == "table":
                text = "".join(self._current.get("_cell_text", []))
                self._current["_row"].append(text)
                self._current["_in_cell"] = False
        elif tag == "tr":
            if self._current and self._current["type"] == "table":
                if self._current["_row"]:
                    self._current["rows"].append(self._current["_row"])
                self._current["_row"] = []
        elif tag == "table":
            self._flush_block()
        self._text_buf = []

    def handle_data(self, data: str):
        if self._in_body:
            self._text_buf.append(data)

    def _flush_inline(self):
        text = "".join(self._text_buf).strip()
        self._text_buf = []
        if not text:
            return
        # Attach inline text to current block or create a paragraph
        if self._current:
            if self._current["type"] == "table" and self._current.get("_in_cell"):
                self._current.setdefault("_cell_text", []).append(text)
            else:
                self._current["text"] = (self._current["text"] + " " + text).strip()
        else:
            self.blocks.append({"type": "paragraph", "tag": "p", "text": text})

    def _flush_block(self):
        self._flush_inline()
        if self._current:
            if self._current["type"] == "table":
                # Flush remaining row
                if self._current.get("_row"):
                    self._current["rows"].append(self._current["_row"])
                self._current.pop("_row", None)
                self._current.pop("_cell_text", None)
                self._current.pop("_in_cell", None)
            self.blocks.append(self._current)
            self._current = None

    def close(self):
        self._flush_block()
        super().close()


def generate_pdf_from_html(html: str, title: str = "Document") -> bytes:
    """Convert HTML to PDF bytes with CJK support."""

    parser = _BlockCollector()
    parser.feed(html)
    parser.close()
    blocks = parser.blocks

    pdf = _make_pdf()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    for block in blocks:
        _render_block(pdf, block)

    return bytes(pdf.output())


def _make_pdf() -> FPDF:
    pdf = FPDF()
    for path in _FONT_PATHS:
        if path.exists():
            pdf.add_font("CJK", "", str(path))
            return pdf
    return pdf


def _use_font(pdf: FPDF, size: float = 10) -> None:
    try:
        pdf.set_font("CJK", "", size)
    except Exception:
        pdf.set_font("Helvetica", "", size)


def _render_block(pdf: FPDF, block: dict) -> None:
    btype = block["type"]
    text = block.get("text", "")

    if btype == "heading":
        level = block.get("level", 1)
        sizes = {1: 20, 2: 16, 3: 13, 4: 11, 5: 10, 6: 9}
        _use_font(pdf, sizes.get(level, 11))
        pdf.ln(3)
        pdf.multi_cell(w=0, h=sizes.get(level, 11) * 0.35, text=text, align="L")
        pdf.ln(1)
        _use_font(pdf, 10)

    elif btype == "paragraph":
        _use_font(pdf, 10)
        pdf.ln(1.5)
        pdf.multi_cell(w=0, h=5.5, text=text, align="L")

    elif btype == "list_item":
        _use_font(pdf, 10)
        pdf.set_x(pdf.l_margin + 6)
        pdf.cell(w=4, h=5.5, text="•")
        pdf.multi_cell(w=pdf.w - pdf.r_margin - pdf.l_margin - 12, h=5.5, text=text, align="L")

    elif btype == "code":
        pdf.set_fill_color(245, 245, 245)
        pdf.set_font("Courier", "", 7.5)
        for line in text.split("\n"):
            if pdf.get_y() > pdf.h - 20:
                pdf.add_page()
            pdf.set_x(pdf.l_margin + 3)
            pdf.cell(w=pdf.w - pdf.r_margin - pdf.l_margin - 6, h=4.2, text=line[:200], fill=True)
            pdf.ln(4.2)
        pdf.set_fill_color(255, 255, 255)
        _use_font(pdf, 10)

    elif btype == "hr":
        pdf.ln(3)
        y = pdf.get_y()
        pdf.set_draw_color(200, 200, 200)
        pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
        pdf.set_draw_color(0, 0, 0)
        pdf.ln(3)

    elif btype == "table":
        rows = block.get("rows", [])
        if not rows:
            return
        col_count = max(len(r) for r in rows)
        col_w = (pdf.w - pdf.l_margin - pdf.r_margin) / max(col_count, 1)
        _use_font(pdf, 8)
        for ri, row in enumerate(rows):
            if pdf.get_y() > pdf.h - 20:
                pdf.add_page()
                _use_font(pdf, 8)
            if ri == 0:
                pdf.set_fill_color(235, 235, 240)
            else:
                pdf.set_fill_color(255, 255, 255)
            x_start = pdf.get_x()
            for ci, cell_text in enumerate(row[:col_count]):
                pdf.set_xy(x_start + ci * col_w, pdf.get_y())
                pdf.multi_cell(w=col_w, h=5.5, text=cell_text[:200], border=1, fill=True, align="L")
            pdf.set_fill_color(255, 255, 255)
        pdf.ln(2)
