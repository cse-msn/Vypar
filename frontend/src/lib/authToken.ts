// Single source of truth for the auth token in web storage, with small events so the
// API layer and React can stay in sync without a circular import.

const TOKEN_KEY = 'mnm_token';
export const UNAUTHORIZED_EVENT = 'mnm:unauthorized';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);

export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/** Fired by the API layer when the server rejects the token (expired / revoked). */
export const emitUnauthorized = () => window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
