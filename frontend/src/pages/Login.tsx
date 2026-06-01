import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast(t('auth.logged_in'), 'success');
      navigate('/dashboard');
    } catch {
      toast(t('auth.login_failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-surface-900">{t('auth.welcome_back')}</h1>
          <p className="mt-2 text-surface-500">{t('auth.sign_in_desc')}</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-surface-200 p-6 space-y-4 shadow-sm">
          <Input id="email" label={t('auth.email')} type="email" placeholder={t('auth.email_placeholder')} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input id="password" label={t('auth.password')} type="password" placeholder={t('auth.password_placeholder')} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" loading={loading} className="w-full">{t('auth.sign_in')}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-surface-500">
          {t('auth.no_account')}{' '}
          <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">{t('auth.create_one')}</Link>
        </p>
      </div>
    </div>
  );
}
