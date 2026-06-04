import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallback() {
  const { t } = useTranslation();
  const { handleGitHubCallback } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      setError(t('auth.oauth_callback_error'));
      return;
    }

    handleGitHubCallback(code, state)
      .then(() => navigate('/dashboard'))
      .catch((e: Error) => setError(e.message || t('auth.oauth_callback_error')));
  }, [searchParams, handleGitHubCallback, navigate, t]);

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-red-500 text-lg font-medium mb-4">{error}</div>
          <a href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            {t('auth.sign_in_link')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
        <p className="text-surface-500">{t('auth.oauth_callback_processing')}</p>
      </div>
    </div>
  );
}
