import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { storeApi, getStoreToken, setStoreToken, clearStoreToken, getAnonId, trackEvent } from './lib/storeApi';

export interface StoreCustomer {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface StoreAuthValue {
  customer: StoreCustomer | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (body: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<StoreAuthValue | null>(null);

export function StoreAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<StoreCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getStoreToken()) {
      setLoading(false);
      return;
    }
    storeApi
      .get('/auth/me')
      .then((r) => setCustomer(r.data.data as StoreCustomer))
      .catch(() => clearStoreToken())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const r = await storeApi.post('/auth/login', { email, password, anonymousId: getAnonId() });
    setStoreToken(r.data.data.token);
    setCustomer(r.data.data.customer);
    trackEvent('login');
  };

  const register = async (body: { name: string; email: string; password: string; phone?: string }) => {
    const r = await storeApi.post('/auth/register', { ...body, anonymousId: getAnonId() });
    setStoreToken(r.data.data.token);
    setCustomer(r.data.data.customer);
    trackEvent('signup');
  };

  const logout = () => {
    clearStoreToken();
    setCustomer(null);
  };

  return <Ctx.Provider value={{ customer, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

export function useStoreAuth(): StoreAuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStoreAuth must be used within StoreAuthProvider');
  return v;
}
