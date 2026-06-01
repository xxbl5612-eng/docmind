import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useState } from 'react';

export default function Navbar() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-surface-200 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary-700">
            <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="currentColor" className="text-primary-600" />
              <path d="M8 10h16M8 16h12M8 22h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            DocMind
          </Link>

          <div className="hidden md:flex items-center gap-4">
            <LanguageSwitcher />
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="text-sm text-surface-600 hover:text-surface-900 transition-colors">
                  {t('nav.dashboard')}
                </Link>
                {user?.is_superuser && (
                  <Link to="/admin" className="text-sm text-surface-600 hover:text-surface-900 transition-colors">
                    {t('nav.admin')}
                  </Link>
                )}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 text-sm text-surface-700 hover:text-surface-900 cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium">
                      {user?.display_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="hidden lg:inline">{user?.display_name}</span>
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-surface-200 py-1 animate-in">
                        <Link to="/settings" className="block px-4 py-2 text-sm text-surface-700 hover:bg-surface-50" onClick={() => setMenuOpen(false)}>
                          {t('nav.settings')}
                        </Link>
                        <hr className="border-surface-100" />
                        <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-surface-50 cursor-pointer">
                          {t('nav.signOut')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">{t('nav.signIn')}</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">{t('nav.getStarted')}</Button>
                </Link>
              </>
            )}
          </div>

          <button className="md:hidden text-surface-600 cursor-pointer" onClick={() => setMenuOpen(!menuOpen)}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-surface-200 py-4 space-y-2 animate-in">
            <div className="px-3 py-2">
              <LanguageSwitcher />
            </div>
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="block px-3 py-2 text-sm rounded-lg hover:bg-surface-50" onClick={() => setMenuOpen(false)}>{t('nav.dashboard')}</Link>
                {user?.is_superuser && (
                  <Link to="/admin" className="block px-3 py-2 text-sm rounded-lg hover:bg-surface-50" onClick={() => setMenuOpen(false)}>{t('nav.admin')}</Link>
                )}
                <Link to="/settings" className="block px-3 py-2 text-sm rounded-lg hover:bg-surface-50" onClick={() => setMenuOpen(false)}>{t('nav.settings')}</Link>
                <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-surface-50 cursor-pointer">{t('nav.signOut')}</button>
              </>
            ) : (
              <>
                <Link to="/login" className="block px-3 py-2 text-sm rounded-lg hover:bg-surface-50" onClick={() => setMenuOpen(false)}>{t('nav.signIn')}</Link>
                <Link to="/register" className="block px-3 py-2 text-sm rounded-lg hover:bg-surface-50" onClick={() => setMenuOpen(false)}>{t('nav.getStarted')}</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
