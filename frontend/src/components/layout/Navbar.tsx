import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useState, useEffect, useRef, useCallback } from 'react';
import { invitationApi } from '@/lib/api';

interface InviteData {
  id: string;
  session_id: string;
  inviter_id: string;
  invitee_email: string;
  permission: string;
  status: string;
  created_at: string;
}

export default function Navbar() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitations, setInvitations] = useState<InviteData[]>([]);
  const inviteRef = useRef<HTMLDivElement>(null);

  const loadInvitations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await invitationApi.list();
      const list = (data as { data?: InviteData[] }).data || [];
      setInvitations(list);
    } catch { /* ignore */ }
  }, [isAuthenticated]);

  useEffect(() => {
    loadInvitations();
    const timer = setInterval(loadInvitations, 30000);
    return () => clearInterval(timer);
  }, [loadInvitations]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inviteRef.current && !inviteRef.current.contains(e.target as Node)) setInviteOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAccept = async (id: string) => {
    try {
      await invitationApi.accept(id);
      loadInvitations();
    } catch { /* ignore */ }
  };

  const handleReject = async (id: string) => {
    try {
      await invitationApi.reject(id);
      loadInvitations();
    } catch { /* ignore */ }
  };

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

                {/* Invitation Bell */}
                <div className="relative" ref={inviteRef}>
                  <button
                    onClick={() => { setInviteOpen(!inviteOpen); if (!inviteOpen) loadInvitations(); }}
                    className="relative text-surface-500 hover:text-surface-700 cursor-pointer p-1"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {invitations.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                        {invitations.length > 9 ? '9+' : invitations.length}
                      </span>
                    )}
                  </button>
                  {inviteOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-surface-200 py-1 z-50">
                      <div className="px-3 py-2 border-b border-surface-100">
                        <span className="text-xs font-medium text-surface-500">协作邀请</span>
                      </div>
                      {invitations.length === 0 ? (
                        <p className="px-3 py-4 text-sm text-surface-400 text-center">暂无邀请</p>
                      ) : (
                        invitations.map((inv) => (
                          <div key={inv.id} className="px-3 py-2 border-b border-surface-50 last:border-0">
                            <p className="text-xs text-surface-500">
                              被邀请加入协作文档 &middot; {inv.permission === 'edit' ? '可编辑' : inv.permission === 'comment' ? '可评论' : '只读'}
                            </p>
                            <div className="flex gap-2 mt-1">
                              <button onClick={() => handleAccept(inv.id)} className="text-xs px-2 py-1 bg-primary-500 text-white rounded hover:bg-primary-600 cursor-pointer">
                                接受
                              </button>
                              <button onClick={() => handleReject(inv.id)} className="text-xs px-2 py-1 bg-surface-100 text-surface-600 rounded hover:bg-surface-200 cursor-pointer">
                                拒绝
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* User Menu */}
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
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-surface-200 py-1">
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

          <button className="md:hidden text-surface-600 cursor-pointer" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-surface-200 py-4 space-y-2">
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
