import axios, { AxiosError } from 'axios';
import { getToken, clearToken, emitUnauthorized } from './authToken';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 20000,
});

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On an expired/invalid session, clear the token and let the app react (redirect to login).
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    if (status === 401 && !url.includes('/auth/login')) {
      clearToken();
      emitUnauthorized();
    }
    return Promise.reject(error);
  },
);

export interface ApiErrorShape {
  message: string;
  code?: string;
  details?: Record<string, string[] | string>;
}

/** Normalise any thrown/rejected value into a human-readable message. */
export function getApiError(error: unknown): ApiErrorShape {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ERR_NETWORK') {
      return { message: 'Cannot reach the server. Check your connection and try again.', code: 'NETWORK' };
    }
    const data = error.response?.data as { error?: ApiErrorShape } | undefined;
    if (data?.error) return data.error;
    return { message: error.message };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: 'Something went wrong' };
}

/** Thin helper so callers get `data` directly from the `{ data, meta }` envelope. */
export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await api.get(url, { params });
  return res.data.data as T;
}

/** Upload image/video files (multipart) and get back their served URLs. */
export async function uploadFiles(files: File[]): Promise<{ url: string; type: 'image' | 'video' }[]> {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const res = await api.post('/uploads', form); // axios sets the multipart boundary automatically
  return res.data.data as { url: string; type: 'image' | 'video' }[];
}
