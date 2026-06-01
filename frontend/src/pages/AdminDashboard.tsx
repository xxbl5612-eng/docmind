import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import type { ApiResponse, AdminStats } from '@/types';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await adminApi.stats();
      return (data as ApiResponse<AdminStats>).data;
    },
  });

  if (!user?.is_superuser) return <Navigate to="/dashboard" replace />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-surface-900 mb-6">{t('admin.title')}</h1>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-surface-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="py-6">
                <p className="text-surface-500 text-sm">{t('admin.total_users')}</p>
                <p className="text-3xl font-bold text-surface-900 mt-1">{stats?.total_users ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-6">
                <p className="text-surface-500 text-sm">{t('admin.total_documents')}</p>
                <p className="text-3xl font-bold text-surface-900 mt-1">{stats?.total_documents ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-6">
                <p className="text-surface-500 text-sm">{t('admin.total_chars')}</p>
                <p className="text-3xl font-bold text-surface-900 mt-1">{(stats?.total_characters ?? 0).toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-surface-900">{t('admin.supported_formats')}</h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-surface-500 mb-2">{t('admin.input_formats')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {stats?.supported_formats.input.map((f) => (
                      <span key={f} className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium">{f.toUpperCase()}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-surface-500 mb-2">{t('admin.output_formats')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {stats?.supported_formats.output.map((f) => (
                      <span key={f} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">{f.toUpperCase()}</span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
