import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { userApi } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { formatBytes } from '@/lib/utils';
import type { ApiResponse, UsageData } from '@/types';

export default function Settings() {
  const { t } = useTranslation();
  const { user, refreshUser, logout, githubAccounts, linkGitHub, unlinkGitHub, isLoadingGitHub } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);

  const { data: usage } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const { data } = await userApi.usage();
      return (data as ApiResponse<UsageData>).data;
    },
  });

  const saveProfile = async () => {
    setSaving(true);
    try {
      await userApi.updateMe({ display_name: displayName });
      await refreshUser();
      toast(t('settings.updated'), 'success');
    } catch {
      toast(t('settings.update_failed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const upgradeTier = async (tier: string) => {
    try {
      await userApi.upgradeTier(tier);
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['usage'] });
      toast(`${t('settings.upgraded')} ${t(`tiers.${tier}`)}`, 'success');
    } catch {
      toast(t('settings.upgrade_failed'), 'error');
    }
  };

  const tierNames = ['white_collar', 'professional', 'enterprise'] as const;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-surface-900">{t('settings.title')}</h1>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900">{t('settings.profile')}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold">
              {user?.display_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-medium text-surface-900">{user?.display_name}</p>
              <p className="text-sm text-surface-500">{user?.email}</p>
              <Badge variant="info">{t(`tiers.${user?.tier || 'novice'}`)}</Badge>
            </div>
          </div>
          <Input label={t('auth.display_name')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Button onClick={saveProfile} loading={saving}>{t('settings.save_changes')}</Button>
        </CardContent>
      </Card>

      {usage && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-surface-900">{t('settings.usage')}</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-surface-500">{t('dashboard.quota_documents')}</p>
                <p className="font-semibold">{usage.quota_used_docs} / {usage.tier_limits.max_documents_per_month || '∞'}</p>
              </div>
              <div>
                <p className="text-sm text-surface-500">{t('dashboard.quota_ai')}</p>
                <p className="font-semibold">{usage.quota_used_ai_calls} / {usage.tier_limits.max_ai_calls_per_month || '∞'}</p>
              </div>
              <div>
                <p className="text-sm text-surface-500">{t('dashboard.quota_storage')}</p>
                <p className="font-semibold">{formatBytes(usage.quota_used_storage_bytes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900">{t('settings.connected_accounts')}</h2>
        </CardHeader>
        <CardContent>
          {githubAccounts.length > 0 ? (
            <div className="space-y-3">
              {githubAccounts.map((acc) => (
                <div key={acc.provider} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    <div>
                      <p className="font-medium text-surface-900">{acc.provider_login || 'GitHub'}</p>
                      <p className="text-xs text-surface-500">{t('settings.linked_since')}: {new Date(acc.linked_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={async () => { try { await unlinkGitHub(); toast(t('auth.github_unlinked'), 'success'); } catch { toast(t('auth.github_link_failed'), 'error'); } }}>
                    {t('auth.unlink_github')}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-surface-500">{t('settings.no_connected_accounts')}</p>
              <Button variant="outline" size="sm" onClick={async () => { try { await linkGitHub(); } catch { toast(t('auth.github_link_failed'), 'error'); } }} loading={isLoadingGitHub}>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                {t('auth.link_github')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900">{t('settings.plan')}</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-surface-500 mb-4">
            {t('settings.current_plan')}: <Badge variant="info">{t(`tiers.${user?.tier || 'novice'}`)}</Badge>
          </p>
          <div className="flex flex-wrap gap-2">
            {tierNames.map((tier) => (
              <Button
                key={tier}
                variant={user?.tier === tier ? 'primary' : 'outline'}
                size="sm"
                onClick={() => upgradeTier(tier)}
                disabled={user?.tier === tier}
              >
                {t(`tiers.${tier}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <h2 className="font-semibold text-red-600">{t('settings.danger_zone')}</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-surface-500 mb-4">{t('settings.sign_out_desc')}</p>
          <Button variant="danger" onClick={async () => { await logout(); navigate('/'); }}>
            {t('settings.sign_out')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
