import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { versionApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';
import type { ApiResponse, Version, VersionListResponse, VersionContent, DiffResponse } from '@/types';

export default function VersionHistory() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVersion, setSelectedVersion] = useState<VersionContent | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResponse | null>(null);
  const [diffA, setDiffA] = useState('');
  const [diffB, setDiffB] = useState('');

  const { data: versionsData, isLoading } = useQuery({
    queryKey: ['versions', id],
    queryFn: async () => {
      const { data } = await versionApi.list(id!);
      return (data as ApiResponse<VersionListResponse>).data;
    },
    enabled: !!id,
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => versionApi.restore(id!, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions', id] });
      toast(t('versions.restored'), 'success');
    },
    onError: () => toast(t('versions.restore_failed'), 'error'),
  });

  const viewVersion = async (versionId: string) => {
    const { data } = await versionApi.get(id!, versionId);
    setSelectedVersion((data as ApiResponse<VersionContent>).data);
  };

  const runDiff = async () => {
    if (!diffA || !diffB) return;
    const { data } = await versionApi.diff(id!, diffA, diffB);
    setDiffResult((data as ApiResponse<DiffResponse>).data);
  };

  if (!id) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('versions.title')}</h1>
          <Link to={`/documents/${id}`} className="text-sm text-primary-600 hover:text-primary-700">&larr; {t('versions.back')}</Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-surface-200 p-4 mb-6">
        <h2 className="font-semibold text-surface-900 mb-3">{t('versions.compare')}</h2>
        <div className="flex items-center gap-3">
          <select value={diffA} onChange={(e) => setDiffA(e.target.value)} className="rounded-lg border border-surface-300 px-3 py-2 text-sm flex-1">
            <option value="">{t('versions.select_a')}</option>
            {versionsData?.items.map((v: Version) => (
              <option key={v.id} value={v.id}>v{v.version_number} - {formatDate(v.created_at)}</option>
            ))}
          </select>
          <span className="text-surface-400">vs</span>
          <select value={diffB} onChange={(e) => setDiffB(e.target.value)} className="rounded-lg border border-surface-300 px-3 py-2 text-sm flex-1">
            <option value="">{t('versions.select_b')}</option>
            {versionsData?.items.map((v: Version) => (
              <option key={v.id} value={v.id}>v{v.version_number} - {formatDate(v.created_at)}</option>
            ))}
          </select>
          <Button size="sm" onClick={runDiff}>{t('versions.compare_btn')}</Button>
        </div>
        {diffResult && (
          <div className="mt-4 p-3 bg-surface-50 rounded-lg">
            <div className="flex gap-4 text-sm mb-2">
              <span className="text-green-600">+{diffResult.additions} {t('versions.added')}</span>
              <span className="text-red-600">-{diffResult.deletions} {t('versions.deleted')}</span>
              <span className="text-surface-500">{diffResult.changes_count} {t('versions.changes')}</span>
            </div>
            <pre className="text-xs text-surface-600 whitespace-pre-wrap max-h-60 overflow-y-auto font-mono">{diffResult.diff_text}</pre>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-lg border border-surface-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {versionsData?.items.map((v: Version) => (
            <div key={v.id} className="bg-white rounded-lg border border-surface-200 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <Badge variant="info">{`v${v.version_number}`}</Badge>
                  <span className="text-sm text-surface-500">{formatDate(v.created_at)}</span>
                  <Badge>{v.source}</Badge>
                </div>
                {v.change_summary && <p className="text-sm text-surface-600 mt-1">{v.change_summary}</p>}
                <p className="text-xs text-surface-400 mt-1">{v.char_count.toLocaleString()} {t('versions.characters')}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => viewVersion(v.id)}>{t('versions.view')}</Button>
                <Button variant="ghost" size="sm" onClick={() => { if (confirm(t('versions.restore_confirm'))) restoreMutation.mutate(v.id); }}>{t('versions.restore')}</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selectedVersion} onClose={() => setSelectedVersion(null)} title={`Version ${selectedVersion?.version_number}`} size="lg">
        <pre className="text-sm text-surface-700 whitespace-pre-wrap max-h-96 overflow-y-auto font-mono">{selectedVersion?.content}</pre>
      </Modal>
    </div>
  );
}
