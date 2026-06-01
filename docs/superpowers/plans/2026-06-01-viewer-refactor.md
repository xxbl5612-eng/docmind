# Viewer Architecture Refactor + PDF Viewer + UI/UX Upgrade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor DocumentEditor into a pluggable viewer architecture, add PDF rendering, and polish dashboard UX.

**Architecture:** Extract a ViewerRegistry that maps file formats to viewer components. DocumentEditor becomes a thin shell (~150 lines) that delegates to the registry. A new PdfViewer renders pages via pdfjs-dist onto canvas. Dashboard cards get colored format icons and drag-drop polish.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, pdfjs-dist 5.x

---

## File Structure

```
frontend/src/
  components/
    viewer/                          # NEW directory
      ViewerRegistry.ts              # format → viewer mapping + metadata
      PdfViewer.tsx                  # NEW
      PptxViewer.tsx                 # MOVED from components/document/
      ImageViewer.tsx                # MOVED from components/document/
      TextViewer.tsx                 # NEW — extracted from DocumentEditor
    document/                        # DELETE (empty after move)
    common/ErrorBoundary.tsx         # NEW — global error boundary
    ui/FileIcon.tsx                  # NEW — colored format icon
  pages/
    DocumentEditor.tsx               # SLIM: ~150 lines of routing + toolbar
    AiToolPanel.tsx                  # NEW — extracted AI sidebar from DocumentEditor
    Dashboard.tsx                    # MODIFY: new cards with FileIcon + drag polish
  lib/
    api.ts                           # MODIFY: add pdfApi
  types/
    index.ts                         # MODIFY: add ViewerConfig type
  locales/
    en.json, zh.json                 # MODIFY: add new keys
```

---

### Task 1: Install pdfjs-dist dependency

**Files:** `frontend/package.json`

- [ ] **Step 1: Install pdfjs-dist**

```bash
cd frontend && npm install pdfjs-dist
```

Expected: package.json updated with pdfjs-dist dependency.

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add pdfjs-dist for PDF rendering"
```

---

### Task 2: Create ViewerRegistry and types

**Files:**
- Create: `frontend/src/components/viewer/ViewerRegistry.ts`
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add ViewerConfig type**

```typescript
// frontend/src/types/index.ts — append after existing types

export interface ViewerConfig {
  formats: string[];
  component: React.ComponentType<{ docId: string; content: string; onContentChange: (c: string) => void }>;
  defaultView: 'preview' | 'text';
  label: string;
  icon: string; // SVG path d string for the format icon
}
```

- [ ] **Step 2: Create ViewerRegistry**

```typescript
// frontend/src/components/viewer/ViewerRegistry.ts
import type { ViewerConfig } from '@/types';

const registry = new Map<string, ViewerConfig>();

export function registerViewer(config: ViewerConfig): void {
  for (const fmt of config.formats) {
    registry.set(fmt.toLowerCase(), config);
  }
}

export function getViewer(format: string): ViewerConfig | undefined {
  return registry.get(format.toLowerCase());
}

export function hasViewer(format: string): boolean {
  return registry.has(format.toLowerCase());
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/viewer/ViewerRegistry.ts
git commit -m "feat: add ViewerRegistry pattern for pluggable document viewers"
```

---

### Task 3: Extract TextViewer from DocumentEditor

**Files:**
- Create: `frontend/src/components/viewer/TextViewer.tsx`

- [ ] **Step 1: Create TextViewer component**

```typescript
// frontend/src/components/viewer/TextViewer.tsx
interface TextViewerProps {
  content: string;
  onContentChange: (content: string) => void;
}

export default function TextViewer({ content, onContentChange }: TextViewerProps) {
  return (
    <div className="p-6 overflow-y-auto h-full">
      <textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        className="w-full h-full min-h-[500px] p-4 rounded-lg border border-surface-200 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
        placeholder="Document content will appear here..."
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/viewer/TextViewer.tsx
git commit -m "feat: extract TextViewer component from DocumentEditor"
```

---

### Task 4: Move PptxViewer and ImageViewer to viewer/ directory

**Files:**
- Move: `frontend/src/components/document/PptxViewer.tsx` → `frontend/src/components/viewer/PptxViewer.tsx`
- Move: `frontend/src/components/document/ImageViewer.tsx` → `frontend/src/components/viewer/ImageViewer.tsx`
- Modify: `frontend/src/components/viewer/PptxViewer.tsx` (update relative imports)
- Modify: `frontend/src/components/viewer/ImageViewer.tsx` (update relative imports)

- [ ] **Step 1: Move and update PptxViewer imports**

```bash
mv frontend/src/components/document/PptxViewer.tsx frontend/src/components/viewer/PptxViewer.tsx
```

Update imports at top of PptxViewer.tsx — the relative paths don't change since both use `@/` aliases:
- `import { slideApi } from '@/lib/api';` → OK
- `import type { ... } from '@/types';` → OK

- [ ] **Step 2: Move and update ImageViewer imports**

```bash
mv frontend/src/components/document/ImageViewer.tsx frontend/src/components/viewer/ImageViewer.tsx
```

Same — imports use `@/` aliases, no changes needed.

- [ ] **Step 3: Remove empty document/ directory**

```bash
rmdir frontend/src/components/document/
```

- [ ] **Step 4: Register all viewer types**

Add registration calls in a new file `frontend/src/components/viewer/index.ts`:

```typescript
// frontend/src/components/viewer/index.ts
import { registerViewer } from './ViewerRegistry';
import PptxViewer from './PptxViewer';
import ImageViewer from './ImageViewer';
import TextViewer from './TextViewer';
import PdfViewer from './PdfViewer';

// PPTX
registerViewer({
  formats: ['pptx'],
  component: ({ docId }) => <ViewerWithToggle docId={docId} Preview={PptxViewer} />,
  defaultView: 'preview',
  label: 'Slide View',
  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
});

// PNG / JPG
registerViewer({
  formats: ['png', 'jpg', 'jpeg'],
  component: ({ docId }) => <ViewerWithToggle docId={docId} Preview={ImageViewer} />,
  defaultView: 'preview',
  label: 'Image View',
  icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
});

// PDF (placeholder until PdfViewer is built)
// Will be registered in Task 6

// All other text-based formats
const textFormats = ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'md', 'html', 'doc'];
registerViewer({
  formats: textFormats,
  component: ({ content, onContentChange }) => <TextViewer content={content} onContentChange={onContentChange} />,
  defaultView: 'text',
  label: 'Text View',
  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
});
```

Note: ViewerWithToggle is a simple wrapper created in Task 5 that renders tabs for preview/text mode switching. Viewers that support both modes (like PptxViewer/ImageViewer which have built-in toggles) handle it internally.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/viewer/
git rm frontend/src/components/document/PptxViewer.tsx frontend/src/components/document/ImageViewer.tsx 2>/dev/null
git commit -m "refactor: move viewers to viewer/ directory, add ViewerRegistry"
```

---

### Task 5: Rewrite DocumentEditor to use ViewerRegistry + extract AiToolPanel

**Files:**
- Create: `frontend/src/pages/AiToolPanel.tsx`
- Modify: `frontend/src/pages/DocumentEditor.tsx` (complete rewrite)

- [ ] **Step 1: Create AiToolPanel**

```typescript
// frontend/src/pages/AiToolPanel.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiApi, documentApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import type { ApiResponse, AsyncTaskResponse, TaskStatus, Document } from '@/types';

type AiTool = 'proofread' | 'rewrite' | 'summarize' | 'extract' | 'convert' | 'qa';

const aiToolIcons: Record<AiTool, string> = {
  proofread: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  rewrite: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125',
  summarize: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5',
  extract: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
  convert: 'M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3-3m0 0l3 3m-3-3v10.5',
  qa: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const aiTools: AiTool[] = ['proofread', 'rewrite', 'summarize', 'extract', 'convert', 'qa'];

function formatNumber(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function StatsCards({ stats }: { stats: Record<string, unknown> | null }) {
  const { t } = useTranslation();
  if (!stats) return null;
  const tokens = stats.tokens_used as Record<string, number> | undefined;
  const scalarEntries = Object.entries(stats).filter(([k]) => k !== 'tokens_used');
  return (
    <div className="space-y-3">
      {tokens && (
        <div className="bg-primary-50 rounded-lg p-3">
          <p className="text-xs font-medium text-primary-700 mb-2">{t('editor.token_usage')}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white rounded-md p-2">
              <p className="text-lg font-bold text-surface-900">{formatNumber(tokens.prompt_tokens || 0)}</p>
              <p className="text-[10px] text-surface-400">{t('editor.prompt_tokens')}</p>
            </div>
            <div className="bg-white rounded-md p-2">
              <p className="text-lg font-bold text-surface-900">{formatNumber(tokens.completion_tokens || 0)}</p>
              <p className="text-[10px] text-surface-400">{t('editor.completion_tokens')}</p>
            </div>
            <div className="bg-white rounded-md p-2">
              <p className="text-lg font-bold text-primary-700">{formatNumber(tokens.total_tokens || 0)}</p>
              <p className="text-[10px] text-primary-500 font-medium">{t('editor.total_tokens')}</p>
            </div>
          </div>
        </div>
      )}
      {scalarEntries.length > 0 && (
        <div className="space-y-1.5">
          {scalarEntries.map(([k, v]) => {
            if (v && typeof v === 'object') return null;
            const label = k.replace(/_/g, ' ').replace(/ratio$/, 'rate').replace(/\b\w/g, (c) => c.toUpperCase());
            const display = k.includes('ratio') && typeof v === 'number'
              ? `${(v * 100).toFixed(1)}%`
              : k.includes('char_count') && typeof v === 'number'
                ? v.toLocaleString()
                : String(v ?? '-');
            return (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="text-surface-400">{label}</span>
                <span className="text-surface-700 font-mono">{display}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Props {
  docId: string;
  doc: Document | null | undefined;
}

export default function AiToolPanel({ docId, doc }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeTool, setActiveTool] = useState<AiTool | null>(null);
  const [toolResult, setToolResult] = useState<string | null>(null);
  const [resultStats, setResultStats] = useState<Record<string, unknown> | null>(null);
  const [resultTab, setResultTab] = useState<'result' | 'stats'>('result');
  const [processing, setProcessing] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);

  const [proofreadOpts, setProofreadOpts] = useState({ language: 'auto', check_grammar: true, check_spelling: true, check_style: true });
  const [rewriteOpts, setRewriteOpts] = useState({ tone: 'professional', audience: 'general', length: 'similar' });
  const [summarizeOpts, setSummarizeOpts] = useState({ length: 'medium', format: 'paragraph' });
  const [extractType, setExtractType] = useState('entities');
  const [convertFormat, setConvertFormat] = useState('docx');
  const [question, setQuestion] = useState('');

  // ... (all the AI tool logic from current DocumentEditor — handleToolResult, runAiTool, task polling, etc.)
  // Exact duplicate of lines 127-218 from current DocumentEditor.tsx

  return (
    <div className="w-64 border-r border-surface-200 bg-white flex flex-col flex-shrink-0 overflow-y-auto">
      <div className="p-4 border-b border-surface-200">
        <h2 className="font-semibold text-surface-900 text-sm">{t('editor.ai_tools')}</h2>
      </div>
      <div className="flex-1 p-2 space-y-1">
        {aiTools.map((key) => (
          <button
            key={key}
            onClick={() => { setActiveTool(key); setToolResult(null); setTaskId(null); setTaskStatus(null); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${activeTool === key ? 'bg-primary-50 text-primary-700 font-medium' : 'text-surface-600 hover:bg-surface-50'}`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={aiToolIcons[key]} />
            </svg>
            {t(`editor.${key}`)}
          </button>
        ))}
      </div>
      <div className="p-4 border-t border-surface-200 space-y-2">
        <Link to={`/documents/${docId}/versions`} className="block text-sm text-surface-600 hover:text-primary-600">{t('editor.version_history')}</Link>
        <Link to={`/documents/${docId}/collaboration`} className="block text-sm text-surface-600 hover:text-primary-600">{t('editor.collaboration')}</Link>
      </div>
    </div>
  );
}
```

Note: For brevity above, the full AI logic (handleToolResult, runAiTool, task polling effects) should be copied exactly from DocumentEditor.tsx lines 127-218.

- [ ] **Step 2: Rewrite DocumentEditor to use registry**

```typescript
// frontend/src/pages/DocumentEditor.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { documentApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { formatBytes } from '@/lib/utils';
import { getViewer } from '@/components/viewer/ViewerRegistry';
import AiToolPanel from '@/pages/AiToolPanel';
import type { ApiResponse, Document, DocumentContent } from '@/types';

// Import viewer registration side-effects
import '@/components/viewer';

export default function DocumentEditor() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);

  const { data: doc } = useQuery({
    queryKey: ['document', id],
    queryFn: async () => {
      const { data } = await documentApi.get(id!);
      return (data as ApiResponse<Document>).data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (id) {
      documentApi.getContent(id).then(({ data }) => {
        const res = data as ApiResponse<DocumentContent>;
        if (res.data) setContent(res.data.content);
      });
    }
  }, [id]);

  const saveContent = async () => {
    if (!id) return;
    try {
      await documentApi.updateContent(id, content, 'Manual edit');
      toast(t('editor.saved'), 'success');
    } catch { toast(t('editor.save_failed'), 'error'); }
  };

  if (!id) return null;

  const viewerConfig = doc ? getViewer(doc.input_format) : undefined;
  const ViewerComponent = viewerConfig?.component;
  const isPreview = viewerConfig?.defaultView === 'preview';

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {showAiPanel && <AiToolPanel docId={id} doc={doc} />}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <div className="px-6 py-3 border-b border-surface-200 bg-white flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-surface-900">{doc?.title || t('common.loading')}</h1>
            <p className="text-xs text-surface-400">
              {doc && `${doc.input_format.toUpperCase()} · ${formatBytes(doc.file_size_bytes)} · ${doc.char_count?.toLocaleString() || 0} chars`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!showAiPanel && (
              <Button size="sm" variant="ghost" onClick={() => setShowAiPanel(true)}>
                {t('editor.ai_tools')}
              </Button>
            )}
            {doc && <Badge variant={doc.status === 'completed' ? 'success' : 'info'}>{doc.status}</Badge>}
            {!isPreview && <Button size="sm" onClick={saveContent}>{t('editor.save')}</Button>}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {ViewerComponent ? (
            <ViewerComponent docId={id} content={content} onContentChange={setContent} />
          ) : (
            <div className="flex items-center justify-center h-full text-surface-400">
              <p>Unsupported format: {doc?.input_format}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update PptxViewer and ImageViewer props to match ViewerConfig interface**

PptxViewer currently: `{ docId: string }`
PdfViewer and ImageViewer currently: `{ docId: string }`
TextViewer: `{ content: string; onContentChange: (c: string) => void }`

Wrap PptxViewer and ImageViewer in the registry to accept the unified ViewerProps:

In `frontend/src/components/viewer/index.ts`, the registration wraps them to accept the unified interface `{ docId, content, onContentChange }`.

- [ ] **Step 4: TypeScript check and build**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/DocumentEditor.tsx frontend/src/pages/AiToolPanel.tsx frontend/src/components/viewer/index.ts
git commit -m "refactor: slim DocumentEditor to ~120 lines with ViewerRegistry delegation"
```

---

### Task 6: Create PdfViewer component

**Files:**
- Create: `frontend/src/components/viewer/PdfViewer.tsx`

- [ ] **Step 1: Write PdfViewer**

```typescript
// frontend/src/components/viewer/PdfViewer.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface Props {
  docId: string;
}

export default function PdfViewer({ docId }: Props) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('access_token');
    fetch(`/api/v1/documents/${docId}/original`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.arrayBuffer())
      .then(data => pdfjsLib.getDocument({ data }).promise)
      .then(pdf => {
        if (!cancelled) {
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
        }
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
  }, [docId]);

  // Render page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;
    const canvas = canvasRef.current;

    pdfDoc.getPage(currentPage).then(page => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale: zoom });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d')!;
      renderTaskRef.current = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current.promise.then(() => {
        if (!cancelled) renderTaskRef.current = null;
      });
    });

    return () => {
      cancelled = true;
      if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
  }, [pdfDoc, currentPage, zoom]);

  const goTo = useCallback((p: number) => {
    if (p >= 1 && p <= numPages) setCurrentPage(p);
  }, [numPages]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        <p className="text-surface-500 text-sm">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-surface-500">
        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-3 px-4 py-2 border-b border-slate-200 bg-white">
        <button
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-2 py-1 rounded text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-medium text-slate-600 tabular-nums">
          {currentPage} / {numPages}
        </span>
        <button
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage >= numPages}
          className="px-2 py-1 rounded text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
        <div className="w-px h-5 bg-slate-300" />
        <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} disabled={zoom <= 0.5} className="px-2 py-1 rounded text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer">−</button>
        <span className="text-xs text-slate-500 w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} disabled={zoom >= 3} className="px-2 py-1 rounded text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer">+</button>
        <button onClick={() => setZoom(1)} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 cursor-pointer">{t('editor.reset_zoom') ?? 'Reset'}</button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto p-4 flex justify-center">
        <canvas ref={canvasRef} className="shadow-lg" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register PdfViewer in viewer/index.ts**

Add after existing registrations:
```typescript
import PdfViewer from './PdfViewer';

registerViewer({
  formats: ['pdf'],
  component: ({ docId }) => <PdfViewer docId={docId} />,
  defaultView: 'preview',
  label: 'PDF View',
  icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
});
```

Also remove 'pdf' from the textFormats array.

- [ ] **Step 3: TypeScript check and build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/viewer/PdfViewer.tsx frontend/src/components/viewer/index.ts
git commit -m "feat: add PDF viewer with pdfjs-dist canvas rendering"
```

---

### Task 7: Add ErrorBoundary and FileIcon components

**Files:**
- Create: `frontend/src/components/common/ErrorBoundary.tsx`
- Create: `frontend/src/components/ui/FileIcon.tsx`

- [ ] **Step 1: Create ErrorBoundary**

```typescript
// frontend/src/components/common/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-surface-600 font-medium">Something went wrong</p>
          <p className="text-surface-400 text-sm">{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm cursor-pointer">
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Create FileIcon**

```typescript
// frontend/src/components/ui/FileIcon.tsx
import { cn } from '@/lib/utils';

const formatColors: Record<string, string> = {
  pdf: 'bg-red-100 text-red-600',
  docx: 'bg-blue-100 text-blue-600',
  doc: 'bg-blue-100 text-blue-600',
  pptx: 'bg-orange-100 text-orange-600',
  xlsx: 'bg-green-100 text-green-600',
  csv: 'bg-green-100 text-green-600',
  png: 'bg-purple-100 text-purple-600',
  jpg: 'bg-purple-100 text-purple-600',
  jpeg: 'bg-purple-100 text-purple-600',
  txt: 'bg-gray-100 text-gray-600',
  md: 'bg-gray-100 text-gray-600',
  html: 'bg-amber-100 text-amber-600',
};

const formatLabels: Record<string, string> = {
  pdf: 'PDF', docx: 'DOC', pptx: 'PPT', xlsx: 'XLS', csv: 'CSV',
  png: 'IMG', jpg: 'IMG', jpeg: 'IMG', txt: 'TXT', md: 'MD', html: 'HTML',
};

interface Props { format: string; className?: string; }

export default function FileIcon({ format, className }: Props) {
  const fmt = format.toLowerCase();
  const color = formatColors[fmt] || 'bg-gray-100 text-gray-600';
  const label = formatLabels[fmt] || fmt.toUpperCase().slice(0, 3);
  return (
    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold', color, className)}>
      {label}
    </div>
  );
}

export { formatColors, formatLabels };
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/common/ErrorBoundary.tsx frontend/src/components/ui/FileIcon.tsx
git commit -m "feat: add ErrorBoundary and FileIcon components"
```

---

### Task 8: Upgrade Dashboard with FileIcon and drag-drop polish

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/locales/en.json`, `frontend/src/locales/zh.json`

- [ ] **Step 1: Update Dashboard cards with FileIcon**

Replace the document icon in Dashboard.tsx (line ~166-170) with:

```tsx
import FileIcon from '@/components/ui/FileIcon';

// Inside the card rendering, replace the generic SVG icon:
<FileIcon format={doc.input_format} />
```

- [ ] **Step 2: Add drag-over visual feedback**

Modify the upload drop zone div to add an animation state:

```tsx
const [isDragOver, setIsDragOver] = useState(false);

// On the drop zone div:
onDragEnter={() => setIsDragOver(true)}
onDragLeave={() => setIsDragOver(false)}
onDragOver={(e) => e.preventDefault()}
onDrop={handleDrop}
className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
  isDragOver
    ? 'border-primary-500 bg-primary-50 scale-[1.02] shadow-lg'
    : 'border-surface-300 hover:border-primary-400'
}`}
```

And on the inner text, animate the icon:
```tsx
<svg className={`w-10 h-10 mx-auto mb-3 transition-transform ${isDragOver ? 'text-primary-500 scale-110' : 'text-surface-400'}`} ...>
```

- [ ] **Step 3: Add translation keys for new UI elements**

en.json dashboard section:
```json
"drag_active": "Drop your file here",
"preview": "Preview"
```

zh.json:
```json
"drag_active": "释放文件以上传",
"preview": "预览"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/locales/en.json frontend/src/locales/zh.json
git commit -m "feat: Dashboard UX upgrade — FileIcon, drag-drop animation"
```

---

### Task 9: Wire ErrorBoundary into App and add locale keys

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/locales/en.json`, `frontend/src/locales/zh.json`

- [ ] **Step 1: Read App.tsx and wrap routes with ErrorBoundary**

```bash
# Check current App.tsx structure
cat frontend/src/App.tsx
```

Wrap the main content area or each page route with `<ErrorBoundary>`.

Example for route-level wrapping:
```tsx
import ErrorBoundary from '@/components/common/ErrorBoundary';

// In route definitions:
<Route path="/documents/:id" element={
  <ErrorBoundary>
    <DocumentEditor />
  </ErrorBoundary>
} />
```

- [ ] **Step 2: Add any missing locale keys**

Key additions for the viewer refactor:

en.json editor section:
```json
"ai_tools_toggle": "AI Tools",
"unsupported_format": "Unsupported format"
```

zh.json:
```json
"ai_tools_toggle": "AI 工具",
"unsupported_format": "不支持的格式"
```

- [ ] **Step 3: Final build and commit**

```bash
cd frontend && npx tsc --noEmit && npm run build
git add frontend/src/App.tsx frontend/src/locales/
git commit -m "feat: wire ErrorBoundary, finalize locale keys"
```

---

### Task 10: End-to-end verification

- [ ] **Step 1: Restart backend**

```bash
taskkill //F //IM python.exe 2>/dev/null
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 &
sleep 3
```

- [ ] **Step 2: Start frontend dev server**

```bash
cd frontend && npm run dev &
```

- [ ] **Step 3: Test scenarios**

1. Upload a PDF file → open → verify page canvas renders with navigation
2. Open an existing PPTX → verify slide viewer still works
3. Open an image → verify image viewer with zoom works
4. Dashboard → verify FileIcon colors and drag-drop animation
5. Trigger an error → verify ErrorBoundary shows fallback UI

- [ ] **Step 4: Commit final state**

```bash
git add . && git commit -m "chore: final verification passes for viewer refactor" && git push
```
