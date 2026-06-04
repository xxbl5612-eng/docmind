import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi, userApi, githubApi } from '@/lib/api';
import type { User, TokenResponse, OAuthAccount, ApiResponse } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loginWithGitHub: () => Promise<void>;
  handleGitHubCallback: (code: string, state: string) => Promise<void>;
  linkGitHub: () => Promise<void>;
  unlinkGitHub: () => Promise<void>;
  githubAccounts: OAuthAccount[];
  isLoadingGitHub: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [githubAccounts, setGithubAccounts] = useState<OAuthAccount[]>([]);
  const [isLoadingGitHub, setIsLoadingGitHub] = useState(false);

  const storeTokens = (token: TokenResponse) => {
    localStorage.setItem('access_token', token.access_token);
    localStorage.setItem('refresh_token', token.refresh_token);
  };

  const clearTokens = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  };

  const fetchUser = useCallback(async () => {
    try {
      const { data } = await userApi.me();
      const res = data as ApiResponse<User>;
      if (res.success && res.data) {
        setUser(res.data);
      }
    } catch {
      setUser(null);
    }
  }, []);

  const fetchGithubAccounts = useCallback(async () => {
    try {
      const { data } = await githubApi.getAccounts();
      const res = data as ApiResponse<OAuthAccount[]>;
      if (res.success && res.data) {
        setGithubAccounts(res.data);
      }
    } catch {
      setGithubAccounts([]);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      Promise.all([fetchUser(), fetchGithubAccounts()]).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [fetchUser, fetchGithubAccounts]);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    const res = data as ApiResponse<TokenResponse>;
    if (res.success && res.data) {
      storeTokens(res.data);
      await fetchUser();
      await fetchGithubAccounts();
    } else {
      throw new Error(res.message || 'Login failed');
    }
  };

  const register = async (email: string, password: string, displayName: string) => {
    await authApi.register(email, password, displayName);
    await login(email, password);
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // ignore
    }
    clearTokens();
    setUser(null);
    setGithubAccounts([]);
  };

  const loginWithGitHub = async () => {
    setIsLoadingGitHub(true);
    try {
      const { data } = await githubApi.getAuthorizationUrl();
      const res = data as ApiResponse<{ authorization_url: string; state: string }>;
      if (res.success && res.data) {
        sessionStorage.setItem('github_oauth_state', res.data.state);
        window.location.href = res.data.authorization_url;
      }
    } catch {
      throw new Error('Failed to initiate GitHub login');
    } finally {
      setIsLoadingGitHub(false);
    }
  };

  const handleGitHubCallback = async (code: string, state: string) => {
    const savedState = sessionStorage.getItem('github_oauth_state');
    sessionStorage.removeItem('github_oauth_state');
    if (state !== savedState) {
      throw new Error('Invalid state parameter');
    }
    const { data } = await githubApi.callback(code, state);
    const res = data as ApiResponse<TokenResponse>;
    if (res.success && res.data) {
      storeTokens(res.data);
      await fetchUser();
      await fetchGithubAccounts();
    } else {
      throw new Error(res.message || 'GitHub login failed');
    }
  };

  const linkGitHub = async () => {
    setIsLoadingGitHub(true);
    try {
      const { data } = await githubApi.getAuthorizationUrl();
      const res = data as ApiResponse<{ authorization_url: string; state: string }>;
      if (res.success && res.data) {
        sessionStorage.setItem('github_link_state', res.data.state);
        window.location.href = res.data.authorization_url;
      }
    } catch {
      throw new Error('Failed to initiate GitHub linking');
    } finally {
      setIsLoadingGitHub(false);
    }
  };

  const unlinkGitHub = async () => {
    try {
      await githubApi.unlink();
      await fetchGithubAccounts();
    } catch {
      throw new Error('Failed to unlink GitHub');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
        loginWithGitHub,
        handleGitHubCallback,
        linkGitHub,
        unlinkGitHub,
        githubAccounts,
        isLoadingGitHub,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
