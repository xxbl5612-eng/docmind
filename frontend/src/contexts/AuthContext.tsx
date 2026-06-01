import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi, userApi } from '@/lib/api';
import type { User, TokenResponse, ApiResponse } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    const res = data as ApiResponse<TokenResponse>;
    if (res.success && res.data) {
      storeTokens(res.data);
      await fetchUser();
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
