import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast(t('auth.password_requirement'), 'error');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, displayName);
      toast(t('auth.account_created'), 'success');
      navigate('/dashboard');
    } catch {
      toast(t('auth.register_failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-surface-900">{t('auth.create_account')}</h1>
          <p className="mt-2 text-surface-500">{t('auth.register_desc')}</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-surface-200 p-6 space-y-4 shadow-sm">
          <Input id="displayName" label={t('auth.display_name')} placeholder={t('auth.display_name_placeholder')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <Input id="email" label={t('auth.email')} type="email" placeholder={t('auth.email_placeholder')} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input id="password" label={t('auth.password')} type="password" placeholder={t('auth.password_requirement')} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" loading={loading} className="w-full">{t('auth.create_button')}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-surface-500">
          {t('auth.have_account')}{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">{t('auth.sign_in_link')}</Link>
        </p>
      </div>
    </div>
  );
}
