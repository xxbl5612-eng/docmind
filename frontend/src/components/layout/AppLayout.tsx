import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from './Navbar';
import DraggableAiAssistant from '@/components/ai/DraggableAiAssistant';

export default function AppLayout() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Only show assistant on authenticated pages (not landing/login/register)
  const showAssistant = isAuthenticated && !['/', '/login', '/register'].includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-surface-200 py-6 text-center text-sm text-surface-400">
        <div className="max-w-7xl mx-auto px-4">
          {t('footer.copyright', { year: new Date().getFullYear() })}
        </div>
      </footer>
      {showAssistant && <DraggableAiAssistant />}
    </div>
  );
}
