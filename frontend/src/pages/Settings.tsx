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
  const { user, refreshUser, logout } = useAuth();
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
