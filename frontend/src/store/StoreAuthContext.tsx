import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { storeApi, getStoreToken, setStoreToken, clearStoreToken, getAnonId, trackEvent } from './lib/storeApi';

export interface StoreCustomer {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface OtpRequestResult {
  sent: boolean;
  isNewCustomer: boolean;
  hint: string;
  devOtp?: string;
}

interface StoreAuthValue {
  customer: StoreCustomer | null;
  loading: boolean;
  requestOtp: (phone: string) => Promise<OtpRequestResult>;
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<void>;
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

  const requestOtp = async (phone: string): Promise<OtpRequestResult> => {
    const r = await storeApi.post('/auth/otp/request', { phone });
    return r.data.data as OtpRequestResult;
  };

  const verifyOtp = async (phone: string, otp: string, name?: string) => {
    const r = await storeApi.post('/auth/otp/verify', { phone, otp, name, anonymousId: getAnonId() });
    setStoreToken(r.data.data.token);
    const cust = r.data.data.customer as StoreCustomer;
    setCustomer(cust);
    trackEvent('login');
  };

  const logout = () => {
    clearStoreToken();
    setCustomer(null);
  };

  return <Ctx.Provider value={{ customer, loading, requestOtp, verifyOtp, logout }}>{children}</Ctx.Provider>;
}

export function useStoreAuth(): StoreAuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStoreAuth must be used within StoreAuthProvider');
  return v;
}
