import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { setToken, clearToken, getToken, UNAUTHORIZED_EVENT } from '@/lib/authToken';
import { clearPersistedCache } from '@/lib/queryClient';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMe();
    // React to token rejection from the API layer (expired/revoked session).
    const onUnauthorized = () => {
      setUser(null);
      clearPersistedCache();
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    setToken(res.data.data.token);
    setUser(res.data.data.user);
  };

  const logout = () => {
    clearToken();
    clearPersistedCache(); // clear sensitive cached data on logout
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, isAuthenticated: !!user, login, logout, refresh: loadMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
