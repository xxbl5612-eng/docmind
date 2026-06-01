# PPTX Rendering Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add shape borders/rotation, bullet lists, gradient fills, and table formatting to PPTX slide rendering.

**Architecture:** Extend backend `SlideShapeData` dataclass with new styling fields, extract them via python-pptx APIs, then render in frontend `PptxViewer.tsx` with CSS. All changes within `pptx_slide_service.py` + `PptxViewer.tsx` + `types/index.ts`.

**Tech Stack:** python-pptx, React 19, TypeScript, Tailwind CSS 4

---

### Task 1: Extend backend data model with shape styling fields

**Files:** `src/services/pptx_slide_service.py`, `src/schemas/document.py`, `frontend/src/types/index.ts`

- [ ] **Step 1: Add new fields to SlideShapeData dataclass**

In `src/services/pptx_slide_service.py`, extend the dataclass:

```python
@dataclass
class SlideShapeData:
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
    paragraphs: list[dict[str, Any]] = field(default_factory=list)
    is_title: bool = False
    # NEW fields
    fill_type: str | None = None           # "solid" | "gradient" | None
    gradient_angle: float | None = None
    gradient_stops: list[dict] = field(default_factory=list)
    border_color: str | None = None
    border_width: float | None = None
    border_style: str | None = None
    border_radius: float | None = None
    shadow: bool = False
    rotation: float | None = None
    table_data: dict | None = None          # replaces table_rows for enhanced tables
```

Also add `bg_fill_type: str | None = None` and `bg_gradient_stops: list[dict] = field(default_factory=list)` and `bg_gradient_angle: float | None = None` to `SlideData`.

- [ ] **Step 2: Update Pydantic schema**

In `src/schemas/document.py`, add the new fields to `SlideShapeData` and `SlideData` models with the same names and defaults.

- [ ] **Step 3: Update TypeScript types**

In `frontend/src/types/index.ts`, add the new fields to `SlideShape` and `SlideData` interfaces:

```typescript
interface SlideShape {
  // ...existing fields...
  fill_type: string | null;
  gradient_angle: number | null;
  gradient_stops: { color: string; position: number }[];
  border_color: string | null;
  border_width: number | null;
  border_style: string | null;
  border_radius: number | null;
  shadow: boolean;
  rotation: number | null;
  table_data: TableData | null;
}

interface TableData {
  rows: string[][];
  col_widths: number[] | null;
  header_count: number;
  cell_styles: CellStyle[];
}

interface CellStyle {
  row: number; col: number;
  bg_color: string | null;
  bold: boolean;
  align: string | null;
  colspan: number; rowspan: number;
}
```

- [ ] **Step 4: Update API response mapping**

In `src/api/v1/documents.py` (~line 301-330), in the `get_slides` endpoint, update the `SlideShapeData(...)` and `SlideData(...)` constructors to include all new fields from the dataclass. Ensure `table_data` is passed through.

- [ ] **Step 5: Commit**

```bash
git add src/services/pptx_slide_service.py src/schemas/document.py frontend/src/types/index.ts src/api/v1/documents.py
git commit -m "feat: extend PPTX data model with shape styling, gradient, and table fields"
```

---

### Task 2: Backend — extract shape borders, rotation, shadow

**File:** `src/services/pptx_slide_service.py`

- [ ] **Step 1: Add border extraction helper**

```python
def _get_shape_border(shape) -> dict:
    """Extract shape border/line properties."""
    result = {"border_color": None, "border_width": None, "border_style": None, "border_radius": None}
    try:
        line = shape.line
        if line and line.fill:
            fc = _resolve_color(line.fill.fore_color)
            if fc:
                result["border_color"] = f"#{fc}"
        if line and line.width:
            result["border_width"] = round(line.width / 12700, 1)  # EMU → pt
        if line and line.dash_style is not None:
            from pptx.enum.dml import MSO_LINE_DASH_STYLE
            dash_map = {
                MSO_LINE_DASH_STYLE.SOLID: "solid",
                MSO_LINE_DASH_STYLE.DASH: "dashed",
                MSO_LINE_DASH_STYLE.DOT: "dotted",
                MSO_LINE_DASH_STYLE.DASH_DOT: "dashed",
            }
            result["border_style"] = dash_map.get(line.dash_style, "solid")
    except Exception:
        pass
    # Check for rounded corners via XML
    try:
        from lxml import etree
        sp = shape._element
        prstGeom = sp.find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}prstGeom')
        if prstGeom is not None:
            prst = prstGeom.get('prst')
            if prst in ('roundRect', 'snipRoundRect', 'roundSameRect'):
                avLst = prstGeom.find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}avLst')
                if avLst is not None:
                    gd = avLst.find('{http://schemas.openxmlformats.org/drawingml/2006/main}gd')
                    if gd is not None:
                        result["border_radius"] = round(int(gd.get('fmla').replace('val ', '')) / 12700, 1)
                    else:
                        result["border_radius"] = 8  # fallback round rect
                else:
                    result["border_radius"] = 8
    except Exception:
        pass
    return result
```

- [ ] **Step 2: Add shadow and rotation extraction**

```python
def _get_shape_effects(shape) -> dict:
    """Extract shadow and rotation from shape."""
    result = {"shadow": False, "rotation": None}
    try:
        # Rotation
        if shape.rotation:
            result["rotation"] = round(shape.rotation, 1)
        # Shadow via XML
        from lxml import etree
        sp = shape._element
        effectLst = sp.find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}effectLst')
        if effectLst is not None:
            outerShdw = effectLst.find('{http://schemas.openxmlformats.org/drawingml/2006/main}outerShdw')
            if outerShdw is not None:
                result["shadow"] = True
    except Exception:
        pass
    return result
```

- [ ] **Step 3: Wire into _count_images_recursive and _process_text_shape**

In `_count_images_recursive`, after creating `sh_data`, call the helpers:
```python
border = _get_shape_border(shape)
sh_data.border_color = border["border_color"]
sh_data.border_width = border["border_width"]
sh_data.border_style = border["border_style"]
sh_data.border_radius = border["border_radius"]
effects = _get_shape_effects(shape)
sh_data.shadow = effects["shadow"]
sh_data.rotation = effects["rotation"]
```

- [ ] **Step 4: Commit**

```bash
git add src/services/pptx_slide_service.py
git commit -m "feat: extract PPTX shape borders, rotation, and shadow"
```

---

### Task 3: Backend — extract gradients and bullet info

**File:** `src/services/pptx_slide_service.py`

- [ ] **Step 1: Update _get_shape_fill to detect gradients**

Replace `_get_shape_fill` with:

```python
def _get_shape_fill_detail(shape) -> dict:
    """Extract fill type, solid color, and gradient stops."""
    result = {"fill_type": None, "fill_color": None, "gradient_angle": None, "gradient_stops": []}
    try:
        fill = shape.fill
        ft = str(fill.type) if hasattr(fill, "type") else ""
        if ft == "SOLID" or not ft:
            result["fill_type"] = "solid"
            fc = _resolve_color(fill.fore_color)
            if fc:
                result["fill_color"] = f"#{fc}"
        elif ft == "GRADIENT" or "GRADIENT" in ft:
            result["fill_type"] = "gradient"
            try:
                gradient_stops = fill.gradient_stops
                for gs in gradient_stops:
                    color = _resolve_color(gs.color)
                    if color:
                        result["gradient_stops"].append({
                            "color": f"#{color}",
                            "position": round(gs.position, 2),
                        })
            except Exception:
                pass
            try:
                result["gradient_angle"] = fill.gradient_angle or 0
            except Exception:
                pass
    except Exception:
        pass
    return result

def _get_slide_bg_detail(slide) -> dict:
    """Extract slide background including gradient and image."""
    result = {"bg_color": None, "bg_fill_type": None, "bg_gradient_stops": [], "bg_gradient_angle": None}
    try:
        bg = slide.background
        if bg and bg.fill:
            ft = str(bg.fill.type) if hasattr(bg.fill, "type") else ""
            if ft == "SOLID" or not ft:
                result["bg_fill_type"] = "solid"
                fc = _resolve_color(bg.fill.fore_color)
                if fc:
                    result["bg_color"] = f"#{fc}"
            elif "GRADIENT" in ft:
                result["bg_fill_type"] = "gradient"
                try:
                    for gs in bg.fill.gradient_stops:
                        color = _resolve_color(gs.color)
                        if color:
                            result["bg_gradient_stops"].append({"color": f"#{color}", "position": round(gs.position, 2)})
                    result["bg_gradient_angle"] = bg.fill.gradient_angle or 0
                except Exception:
                    pass
    except Exception:
        pass
    return result
```

- [ ] **Step 2: Add bullet extraction to _process_text_shape**

In the paragraph loop in `_process_text_shape`, add bullet detection:

```python
# Before appending to paragraphs, detect bullet type:
bullet_char = None
bullet_type = "none"
try:
    pPr = para._element.find('{http://schemas.openxmlformats.org/drawingml/2006/main}pPr')
    if pPr is not None:
        buChar = pPr.find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}buChar')
        if buChar is not None:
            bullet_char = buChar.get('char')
            bullet_type = "bullet"
        else:
            buNone = pPr.find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}buNone')
            if buNone is None and para.level and para.level > 0:
                # If indented with no buNone, default to bullet
                bullet_type = "bullet"
                bullet_char = "●" if para.level == 1 else "○"
except Exception:
    pass

paragraphs.append({
    "text": para_text,
    "runs": para_runs,
    "alignment": _get_alignment(para),
    "level": para.level if para.level else 0,
    "bullet_type": bullet_type,
    "bullet_char": bullet_char,
})
```

- [ ] **Step 3: Update extract_slides to use new bg and fill functions**

```python
# Replace old bg extraction:
bg_detail = _get_slide_bg_detail(slide)
sd = SlideData(..., bg_color=bg_detail["bg_color"],
               bg_fill_type=bg_detail["bg_fill_type"],
               bg_gradient_stops=bg_detail["bg_gradient_stops"],
               bg_gradient_angle=bg_detail["bg_gradient_angle"])

# Replace old fill extraction in _process_text_shape:
fill = _get_shape_fill_detail(shape)
sh_data.fill_type = fill["fill_type"]
if fill["fill_type"] == "solid":
    sh_data.fill_color = fill["fill_color"]
elif fill["fill_type"] == "gradient":
    sh_data.gradient_stops = fill["gradient_stops"]
    sh_data.gradient_angle = fill["gradient_angle"]
```

- [ ] **Step 4: Commit**

```bash
git add src/services/pptx_slide_service.py
git commit -m "feat: extract PPTX gradients, slide bg, and bullet points"
```

---

### Task 4: Backend — extract enhanced table data

**File:** `src/services/pptx_slide_service.py`

- [ ] **Step 1: Add table extraction helper**

```python
def _extract_table_data(shape) -> dict:
    """Extract enhanced table data with merged cells and styles."""
    table = shape.table
    rows: list[list[str]] = []
    cell_styles: list[dict] = []
    row_count = len(table.rows)
    col_count = len(table.columns)
    
    # Column widths as ratio
    total_w = sum(c.width for c in table.columns) or 1
    col_widths = [round(c.width / total_w, 3) for c in table.columns]
    
    # Detect header (first row with bold text)
    header_count = 0
    if row_count > 0:
        first_row = table.rows[0]
        if any(cell.text and cell.text.strip() for cell in first_row.cells):
            header_count = 1
    
    for ri, row in enumerate(table.rows):
        row_texts: list[str] = []
        for ci, cell in enumerate(row.cells):
            row_texts.append(cell.text)
            style: dict = {"row": ri, "col": ci, "bg_color": None, "bold": False, "align": None, "colspan": 1, "rowspan": 1}
            # Cell fill
            try:
                if cell.fill and cell.fill.fore_color:
                    fc = _resolve_color(cell.fill.fore_color)
                    if fc:
                        style["bg_color"] = f"#{fc}"
            except Exception:
                pass
            # Cell text style from first paragraph
            try:
                if cell.text_frame and cell.text_frame.paragraphs:
                    para = cell.text_frame.paragraphs[0]
                    if para.runs:
                        style["bold"] = bool(para.runs[0].font.bold)
                    style["align"] = _get_alignment(para)
            except Exception:
                pass
            # Merged cell detection
            try:
                if cell.is_merge_origin:
                    style["rowspan"] = cell.span_height or 1
                    style["colspan"] = cell.span_width or 1
                if cell.is_spanned:
                    # Skip spanned cells (rendered as part of merge origin)
                    pass
            except Exception:
                pass
            cell_styles.append(style)
        rows.append(row_texts)
    
    return {
        "rows": rows, "col_widths": col_widths,
        "header_count": header_count, "cell_styles": cell_styles,
        "row_count": row_count, "col_count": col_count,
    }
```

- [ ] **Step 2: Wire into _count_images_recursive**

Replace the old table branch:
```python
elif shape.has_table:
    sh_data.shape_type = "table"
    sh_data.table_data = _extract_table_data(shape)
    all_shapes.append(sh_data)
    continue
```

- [ ] **Step 3: Commit**

```bash
git add src/services/pptx_slide_service.py
git commit -m "feat: extract enhanced PPTX table data with merged cells and styles"
```

---

### Task 5: Frontend — render shape borders, rotation, shadow

**File:** `frontend/src/components/viewer/PptxViewer.tsx`

- [ ] **Step 1: Update ShapeElement to apply new styles**

In the `style` object of `ShapeElement`, add:

```typescript
if (shape.border_color) {
  style.borderColor = shape.border_color;
  style.borderWidth = `${shape.border_width || 1}px`;
  style.borderStyle = shape.border_style || 'solid';
}
if (shape.border_radius) {
  style.borderRadius = `${shape.border_radius}px`;
}
if (shape.rotation) {
  style.transform = `rotate(${shape.rotation}deg)`;
}
if (shape.shadow) {
  style.boxShadow = '2px 2px 8px rgba(0,0,0,0.15)';
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/viewer/PptxViewer.tsx
git commit -m "feat: render PPTX shape borders, rotation, and shadow"
```

---

### Task 6: Frontend — render bullet points, gradients, enhanced tables

**File:** `frontend/src/components/viewer/PptxViewer.tsx`

- [ ] **Step 1: Update RichParagraph for bullets**

Add bullet rendering before text:
```typescript
function RichParagraph({ p, defaultFontSize, scale }: { ... }) {
  const fontSize = defaultFontSize * scale;
  const indent = (p.level || 0) * 16;
  const bullet = p.bullet_type === 'bullet' ? (p.bullet_char || '●') : null;

  // Build content with optional bullet prefix
  const content = p.runs?.length ? (
    p.runs.map((r, i) => <span key={i} style={{...}}>{r.text}</span>)
  ) : p.text;

  return (
    <p style={{ textAlign: p.alignment, fontSize, margin: 0, lineHeight: 1.3, marginLeft: indent }}>
      {bullet && <span style={{ marginRight: 6 }}>{bullet}</span>}
      {content}
    </p>
  );
}
```

- [ ] **Step 2: Update ShapeElement for gradients**

Replace the simple `fill_color` CSS with gradient support:
```typescript
if (shape.fill_type === 'solid' && shape.fill_color) {
  style.backgroundColor = shape.fill_color;
} else if (shape.fill_type === 'gradient' && shape.gradient_stops.length >= 2) {
  const stops = shape.gradient_stops
    .map(s => `${s.color} ${Math.round(s.position * 100)}%`)
    .join(', ');
  style.background = `linear-gradient(${shape.gradient_angle || 0}deg, ${stops})`;
}
```

- [ ] **Step 3: Update SlideRenderer bg**

```typescript
let bgStyle = slide.bg_color || '#ffffff';
if (slide.bg_fill_type === 'gradient' && slide.bg_gradient_stops?.length >= 2) {
  const stops = slide.bg_gradient_stops.map(s => `${s.color} ${Math.round(s.position * 100)}%`).join(', ');
  bgStyle = `linear-gradient(${slide.bg_gradient_angle || 0}deg, ${stops})`;
}
```

- [ ] **Step 4: Replace table rendering with enhanced version**

Replace the `case 'table':` block with:

```tsx
case 'table': {
  const td = shape.table_data;
  if (!td) return null;
  return (
    <div style={{ ...style, overflow: 'auto', padding: 0 }}>
      <table className="w-full border-collapse text-[10px]">
        <colgroup>
          {td.col_widths?.map((w, i) => <col key={i} style={{ width: `${w * 100}%` }} />)}
        </colgroup>
        <tbody>
          {td.rows.map((row, ri) => (
            <tr key={ri} className={ri < td.header_count ? 'font-bold bg-slate-100' : ''}>
              {row.map((cell, ci) => {
                const styl = td.cell_styles?.find(s => s.row === ri && s.col === ci);
                if (styl?.colspan === 0 || styl?.rowspan === 0) return null;
                return (
                  <td key={ci}
                    colSpan={styl?.colspan || 1}
                    rowSpan={styl?.rowspan || 1}
                    style={{
                      border: '1px solid #cbd5e1',
                      padding: '1px 4px',
                      backgroundColor: styl?.bg_color || undefined,
                      fontWeight: styl?.bold ? 700 : 400,
                      textAlign: (styl?.align as any) || 'left',
                    }}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/viewer/PptxViewer.tsx
git commit -m "feat: render PPTX bullets, gradients, and enhanced tables"
```

---

### Task 7: Update schemas, rebuild, test, push

- [ ] **Step 1: Update Pydantic and TypeScript schemas**

In `src/schemas/document.py`, add new fields to `SlideShapeData`, `SlideData`, `SlideParagraph`:
```python
class SlideParagraph(BaseModel):
    text: str
    runs: list[SlideParagraphRun] = []
    alignment: str = "left"
    level: int = 0
    bullet_type: str | None = None
    bullet_char: str | None = None
```

Also add a `TableData` and `CellStyle` Pydantic model.

In `src/api/v1/documents.py`, update the response construction to pass through the new fields (bullet, gradient, table_data).

- [ ] **Step 2: TypeScript check and build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

Fix any type errors. The build must succeed.

- [ ] **Step 3: Create test PPTX and verify**

```bash
python -c "
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

prs = Presentation()
# Slide: shape with border, rotation, gradient fill, bullet list
slide = prs.slides.add_slide(prs.slide_layouts[1])
slide.shapes.title.text = 'Enhanced PPTX Test'

# Shape with border and rotation
from pptx.enum.shapes import MSO_SHAPE
shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1), Inches(2), Inches(4), Inches(3))
shape.text = 'Bordered shape'
shape.rotation = 15
shape.line.color.rgb = RGBColor(0x4F, 0x46, 0xE5)
shape.line.width = Pt(2)

# Bullet list
txBox = slide.shapes.add_textbox(Inches(6), Inches(2), Inches(6), Inches(4))
tf = txBox.text_frame
for i, (level, text) in enumerate([(0, 'Main point'), (1, 'Sub-point A'), (1, 'Sub-point B'), (2, 'Sub-sub point')]):
    p = tf.add_paragraph() if i > 0 else tf.paragraphs[0]
    p.text = text
    p.level = level

prs.save('E:/projects/docmind/_enhanced_test.pptx')
print('Enhanced test PPTX created')
"
```

- [ ] **Step 4: Upload and verify visually**

Upload `_enhanced_test.pptx`, open in browser, verify:
- Rounded rectangle has border and 15deg rotation
- Bullet list shows indented bullets
- Tables have header styling

- [ ] **Step 5: Commit and push**

```bash
git add -A && git commit -m "chore: finalize PPTX rendering enhancements" && git push
```
