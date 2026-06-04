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
import '@/components/viewer';

// Formats with built-in preview/text toggle
const PREVIEW_FORMATS = new Set(['pptx', 'png', 'jpg', 'jpeg', 'pdf']);

export default function DocumentEditor() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'text'>('preview');

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

  const fmt = doc?.input_format || '';
  const viewerConfig = getViewer(fmt);
  const hasPreview = PREVIEW_FORMATS.has(fmt);
  const ViewerComponent = viewerConfig?.component;

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {showAiPanel && <AiToolPanel docId={id} doc={doc} onClose={() => setShowAiPanel(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-3 border-b border-surface-200 bg-white flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-surface-900">{doc?.title || t('common.loading')}</h1>
            <p className="text-xs text-surface-400">
              {doc && `${fmt.toUpperCase()} · ${formatBytes(doc.file_size_bytes)} · ${doc.char_count?.toLocaleString() || 0} chars`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!showAiPanel && (
              <Button size="sm" variant="ghost" onClick={() => setShowAiPanel(true)}>
                {t('editor.ai_tools')}
              </Button>
            )}
            {doc && <Badge variant={doc.status === 'completed' ? 'success' : 'info'}>{doc.status}</Badge>}
            {(!hasPreview || viewMode === 'text') && (
              <Button size="sm" onClick={saveContent}>{t('editor.save')}</Button>
            )}
          </div>
        </div>

        {/* Preview/Text toggle for formats that support both */}
        {hasPreview && (
          <div className="flex items-center gap-2 px-6 py-2 border-b border-surface-200 bg-surface-50">
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${viewMode === 'preview' ? 'bg-primary-600 text-white' : 'text-surface-600 hover:bg-surface-200'}`}
            >
              {t(`editor.${fmt === 'pptx' ? 'slide_view' : 'image_view'}`)}
            </button>
            <button
              onClick={() => setViewMode('text')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${viewMode === 'text' ? 'bg-primary-600 text-white' : 'text-surface-600 hover:bg-surface-200'}`}
            >
              {t('editor.text_view')}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {hasPreview && viewMode === 'text' ? (
            <div className="p-6 overflow-y-auto h-full">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-full min-h-[500px] p-4 rounded-lg border border-surface-200 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Document content will appear here..."
              />
            </div>
          ) : ViewerComponent ? (
            <ViewerComponent docId={id} content={content} onContentChange={setContent} />
          ) : (
            <div className="flex items-center justify-center h-full text-surface-400 text-sm">
              Unsupported format: {fmt}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
