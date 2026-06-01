import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentApi, userApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import FileIcon from '@/components/ui/FileIcon';
import { formatBytes, formatDate } from '@/lib/utils';
import type { Document, ApiResponse, DocumentListResponse, UsageData } from '@/types';

export default function Dashboard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folder, setFolder] = useState('');
  const [page, setPage] = useState(1);
  const [isDragOver, setIsDragOver] = useState(false);

  const { data: docsData, isLoading } = useQuery({
    queryKey: ['documents', page],
    queryFn: async () => {
      const { data } = await documentApi.list({ page, page_size: 12 });
      return (data as ApiResponse<DocumentListResponse>).data;
    },
  });

  const { data: usageData } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const { data } = await userApi.usage();
      return (data as ApiResponse<UsageData>).data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data } = await documentApi.upload(file, folder || undefined);
      return (data as ApiResponse<Document>).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['usage'] });
      setUploadOpen(false);
      toast(t('dashboard.uploaded'), 'success');
    },
    onError: () => toast(t('dashboard.upload_failed'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast(t('dashboard.deleted'), 'success');
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) uploadMutation.mutate(file);
  }, [uploadMutation]);

  const quotaLimit = (v: number | null) => v ? String(v) : t('common.no_limit');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('dashboard.title')}</h1>
          <p className="text-surface-500 mt-1">
            {usageData && (
              <span>{usageData.quota_used_docs} / {usageData.tier_limits.max_documents_per_month || '?'} {t('dashboard.usage_docs')}</span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setUploadOpen(true)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('dashboard.upload')}
          </Button>
          <Button variant="outline" onClick={() => navigate('/github/import')}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            {t('dashboard.import_from_github')}
          </Button>
        </div>
      </div>

      {usageData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <p className="text-sm text-surface-500">{t('dashboard.quota_documents')}</p>
            <p className="text-lg font-semibold text-surface-900">{usageData.quota_used_docs} / {quotaLimit(usageData.tier_limits.max_documents_per_month)}</p>
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <p className="text-sm text-surface-500">{t('dashboard.quota_ai')}</p>
            <p className="text-lg font-semibold text-surface-900">{usageData.quota_used_ai_calls} / {quotaLimit(usageData.tier_limits.max_ai_calls_per_month)}</p>
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <p className="text-sm text-surface-500">{t('dashboard.quota_storage')}</p>
            <p className="text-lg font-semibold text-surface-900">
              {formatBytes(usageData.quota_used_storage_bytes)} / {usageData.tier_limits.max_storage_bytes ? formatBytes(Number(usageData.tier_limits.max_storage_bytes)) : '∞'}
            </p>
          </div>
        </div>
      )}

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title={t('dashboard.upload_title')}>
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => { setIsDragOver(false); handleDrop(e); }}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${isDragOver ? 'border-primary-500 bg-primary-50 scale-[1.02] shadow-lg' : 'border-surface-300 hover:border-primary-400'}`}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input
              id="fileInput"
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt,.md,.html,.pptx,.xlsx,.csv,.png,.jpg"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate(f); }}
            />
            <svg className={`w-10 h-10 mx-auto mb-3 transition-all ${isDragOver ? 'text-primary-500 scale-110' : 'text-surface-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-surface-600 font-medium">{isDragOver ? (t('dashboard.drop_active') || 'Drop your file here') : t('dashboard.drop_text')}</p>
            <p className="text-sm text-surface-400 mt-1">{t('dashboard.drop_hint')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t('dashboard.folder_label')}</label>
            <input
              type="text"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('dashboard.folder_placeholder')}
            />
          </div>
        </div>
      </Modal>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-surface-200 p-5 animate-pulse">
              <div className="h-4 bg-surface-100 rounded w-3/4 mb-3" />
              <div className="h-3 bg-surface-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-surface-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {docsData?.items.map((doc: Document) => (
              <div
                key={doc.id}
                className="bg-white rounded-xl border border-surface-200 p-5 hover:shadow-md transition-shadow group cursor-pointer"
                onClick={() => navigate(`/documents/${doc.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <FileIcon format={doc.input_format} />
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(t('dashboard.delete_confirm'))) deleteMutation.mutate(doc.id); }}
                    className="opacity-0 group-hover:opacity-100 text-surface-400 hover:text-red-500 transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <h3 className="font-medium text-surface-900 truncate">{doc.title}</h3>
                <p className="text-sm text-surface-500 mt-1">{doc.input_format.toUpperCase()} &middot; {formatBytes(doc.file_size_bytes)}</p>
                <div className="flex items-center justify-between mt-3">
                  <Badge variant={doc.status === 'completed' ? 'success' : doc.status === 'processing' ? 'info' : 'default'}>
                    {doc.status}
                  </Badge>
                  <span className="text-xs text-surface-400">{formatDate(doc.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
          {docsData && docsData.total_pages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {[...Array(docsData.total_pages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ${page === i + 1 ? 'bg-primary-600 text-white' : 'text-surface-600 hover:bg-surface-100'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
          {docsData?.items.length === 0 && (
            <div className="text-center py-16">
              <svg className="w-16 h-16 text-surface-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-surface-500 text-lg font-medium">{t('dashboard.empty_title')}</p>
              <p className="text-surface-400 mt-1">{t('dashboard.empty_desc')}</p>
              <Button className="mt-4" onClick={() => setUploadOpen(true)}>{t('dashboard.upload')}</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
