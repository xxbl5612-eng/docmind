import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collabApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';
import type { ApiResponse, CollaborationSession } from '@/types';

export default function Collaboration() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePerm, setInvitePerm] = useState('view');

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions', id],
    queryFn: async () => {
      const { data } = await collabApi.listSessions(id!);
      return (data as ApiResponse<CollaborationSession[]>).data || [];
    },
    enabled: !!id,
  });

  const createMutation = useMutation({
    mutationFn: () => collabApi.createSession(id!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sessions', id] }); setCreateOpen(false); toast(t('collaboration.created'), 'success'); },
    onError: () => toast(t('collaboration.create_failed'), 'error'),
  });

  const inviteMutation = useMutation({
    mutationFn: ({ sessionId, email, permission }: { sessionId: string; email: string; permission: string }) =>
      collabApi.invite(id!, sessionId, email, permission),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sessions', id] }); setInviteOpen(null); toast(t('collaboration.invite_sent'), 'success'); },
    onError: () => toast(t('collaboration.invite_failed'), 'error'),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => collabApi.deleteSession(id!, sessionId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sessions', id] }); toast(t('collaboration.ended'), 'success'); },
  });

  const updatePermMutation = useMutation({
    mutationFn: ({ sessionId, userId, permission }: { sessionId: string; userId: string; permission: string }) =>
      collabApi.updatePermission(id!, sessionId, userId, permission),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sessions', id] }); toast(t('collaboration.perm_updated'), 'success'); },
  });

  const removeUserMutation = useMutation({
    mutationFn: ({ sessionId, userId }: { sessionId: string; userId: string }) =>
      collabApi.removeUser(id!, sessionId, userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sessions', id] }); toast(t('collaboration.removed'), 'success'); },
  });

  if (!id) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('collaboration.title')}</h1>
          <Link to={`/documents/${id}`} className="text-sm text-primary-600 hover:text-primary-700">&larr; {t('collaboration.back')}</Link>
        </div>
        <Button onClick={() => setCreateOpen(true)}>{t('collaboration.new_session')}</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (<div key={i} className="h-24 bg-white rounded-lg border border-surface-200 animate-pulse" />))}
        </div>
      ) : sessions?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-surface-200">
          <p className="text-surface-500">{t('collaboration.empty')}</p>
          <p className="text-sm text-surface-400 mt-1">{t('collaboration.empty_hint')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions?.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-surface-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-surface-900">Session {s.id.slice(0, 8)}</h3>
                    <Badge variant={s.status === 'active' ? 'success' : 'default'}>{s.status === 'active' ? t('common.status_active') : s.status}</Badge>
                  </div>
                  <p className="text-sm text-surface-500">
                    {s.collaborators.length} {s.collaborators.length !== 1 ? t('collaboration.collaborators_plural') : t('collaboration.collaborators')} &middot; {t('collaboration.created_at')} {formatDate(s.created_at)}
                    {s.expires_at && <> &middot; {t('collaboration.expires')} {formatDate(s.expires_at)}</>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setInviteOpen(s.id)}>{t('collaboration.invite')}</Button>
                  <Button variant="danger" size="sm" onClick={() => { if (confirm(t('collaboration.end_confirm'))) deleteSessionMutation.mutate(s.id); }}>{t('collaboration.end')}</Button>
                </div>
              </div>
              <div className="space-y-2">
                {s.collaborators.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-t border-surface-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium">
                        {c.display_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm text-surface-700">{c.display_name || t('common.unknown')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={c.permission}
                        onChange={(e) => updatePermMutation.mutate({ sessionId: s.id, userId: c.user_id, permission: e.target.value })}
                        className="text-sm rounded border border-surface-200 px-2 py-1"
                      >
                        <option value="view">{t('collaboration.view')}</option>
                        <option value="comment">{t('collaboration.comment')}</option>
                        <option value="edit">{t('collaboration.edit')}</option>
                      </select>
                      <button
                        onClick={() => { if (confirm(t('collaboration.remove_confirm'))) removeUserMutation.mutate({ sessionId: s.id, userId: c.user_id }); }}
                        className="text-surface-400 hover:text-red-500 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('collaboration.create_title')}>
        <p className="text-sm text-surface-500 mb-4">{t('collaboration.create_desc')}</p>
        <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>{t('collaboration.create_btn')}</Button>
      </Modal>

      <Modal open={!!inviteOpen} onClose={() => setInviteOpen(null)} title={t('collaboration.invite_title')}>
        <div className="space-y-4">
          <Input label={t('auth.email')} type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@example.com" />
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t('collaboration.permission')}</label>
            <select value={invitePerm} onChange={(e) => setInvitePerm(e.target.value)} className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
              <option value="view">{t('collaboration.view')}</option>
              <option value="comment">{t('collaboration.comment')}</option>
              <option value="edit">{t('collaboration.edit')}</option>
            </select>
          </div>
          <Button
            onClick={() => { if (inviteOpen) inviteMutation.mutate({ sessionId: inviteOpen, email: inviteEmail, permission: invitePerm }); }}
            loading={inviteMutation.isPending}
            className="w-full"
          >
            {t('collaboration.send_invite')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
