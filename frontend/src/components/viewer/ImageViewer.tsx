import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { documentApi } from '@/lib/api';

interface Props {
  docId: string;
}

export default function ImageViewer({ docId }: Props) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError(null);
    // Fetch original image as blob and create object URL
    fetch(`/api/v1/documents/${docId}/original`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load image');
        const blob = await res.blob();
        setUrl(URL.createObjectURL(blob));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [docId]);

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
          onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
          disabled={zoom <= 0.25}
          className="px-2 py-1 rounded text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <span className="text-xs font-medium text-slate-600 w-12 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
          disabled={zoom >= 5}
          className="px-2 py-1 rounded text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={() => setZoom(1)}
          className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 cursor-pointer"
        >
          {t('editor.reset_zoom') ?? 'Reset'}
        </button>
      </div>

      {/* Image area */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        {url && (
          <img
            src={url}
            alt="document"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              maxWidth: '100%',
              transition: 'transform 0.15s',
            }}
            draggable={false}
          />
        )}
      </div>
    </div>
  );
}
