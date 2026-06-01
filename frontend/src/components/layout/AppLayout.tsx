import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from './Navbar';

export default function AppLayout() {
  const { t } = useTranslation();
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
    </div>
  );
}
