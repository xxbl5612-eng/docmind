# PPTX Rendering Enhancement Design

## Goal
Enhance PPTX slide display quality by adding shape styling, bullet lists,
gradient fills, and table formatting.

## 1. Shape Styles (Border / Radius / Shadow / Rotation)

### Backend: New fields on SlideShapeData
```
border_color: str | None
border_width: float | None (px)
border_style: str | None   ("solid" | "dashed" | "dotted")
border_radius: float | None (px)
shadow: bool
rotation: float | None     (degrees)
```

Extract via python-pptx:
- `shape.line.color` / `shape.line.width` / `shape.line.dash_style`
- `shape.rotation`
- Shadow: check XML for `<a:effectLst>` containing outer shadow

### Frontend: Apply CSS in ShapeElement
- `borderWidth/borderColor/borderStyle` → CSS `border`
- `borderRadius` → CSS `border-radius`
- `rotation` → CSS `transform: rotate(Xdeg)`
- `shadow` → CSS `box-shadow`

## 2. Bullet Points and Lists

### Backend: New paragraph fields
```
bullet_type: str | None   ("none" | "bullet" | "number")
bullet_char: str | None   ("●" | "○" | "■" | "1." | null)
indent_level: int          (paragraph.level from python-pptx)
```

### Frontend: RichParagraph rendering
```
level 0 → marginLeft: 0, no bullet
level 1 → marginLeft: 16px, "●" prefix
level 2 → marginLeft: 32px, "○" prefix
```

## 3. Gradients and Backgrounds

### Backend: Fill type detection
```
fill_type: str | None              ("solid" | "gradient" | "image")
gradient_angle: float | None
gradient_stops: [{color, position}] | None
```

Read from `shape.fill.type == "GRADIENT"` or slide background fill.

### Frontend
- CSS `linear-gradient(angle, color1 pos1%, color2 pos2%)`
- Slide bg image: `<img>` at z-index 0

Scope: linear gradients only (skip radial/rectangular).

## 4. Table Enhancements

### Backend: Extended table data
```
table_data: {
  rows: [[cell]], col_widths: [ratio],
  header_count: int,
  cell_styles: [{row, col, bg_color, bold, align, colspan, rowspan}]
}
```

Read from `table.iter_cells()`, check `cell.is_merge_origin` and span counts.

### Frontend
- Header row: bold + gray bg
- `colSpan` / `rowSpan` for merged cells
- `textAlign` and `backgroundColor` per cell

## Implementation Order
All changes touch two files: `pptx_slide_service.py` and `PptxViewer.tsx`.
Recommended order: back-end extraction → front-end rendering, area by area.
