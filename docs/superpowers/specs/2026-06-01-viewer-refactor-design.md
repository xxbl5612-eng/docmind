# DocMind Viewer Architecture Refactor & PDF Viewer

## Overview

Three interlinked improvements:
1. **Frontend architecture refactor** — extract ViewerRegistry pattern from bloated DocumentEditor
2. **PDF viewer** — render PDFs via pdfjs-dist with canvas
3. **UI/UX upgrade** — dashboard thumbnails, file icons, error boundary, drag-drop polish

## 1. Viewer Architecture

```
src/components/viewer/
  ViewerRegistry.ts      # format → component mapping + metadata
  PdfViewer.tsx           # NEW
  PptxViewer.tsx          # migrated
  ImageViewer.tsx         # migrated
  TextViewer.tsx          # extracted from DocumentEditor
  TableViewer.tsx         # skeleton for XLSX/CSV

src/pages/
  DocumentEditor.tsx       # slimmed to ~150 lines
  AiToolPanel.tsx          # extracted AI sidebar
```

### ViewerRegistry contract
```typescript
interface ViewerConfig {
  formats: string[];
  component: React.FC<ViewerProps>;
  defaultView: 'preview' | 'text';
  label: string;
}
```

DocumentEditor queries registry by format → renders component. No more if/else chains.

## 2. PDF Viewer

- `npm install pdfjs-dist`
- Uses `GET /documents/{id}/original` (already exists)
- Canvas rendering with page navigation + zoom
- MVP: page nav + zoom; no text search or thumbnails

## 3. UI/UX

- Colored file-type icons on dashboard cards
- Enhanced drag-drop visual feedback
- ErrorBoundary component
- Unified empty states
- Responsive sidebar collapse

## Implementation Order

1. Architecture refactor (foundation)
2. PDF viewer (depends on #1)
3. UI/UX polish (depends on #1)
