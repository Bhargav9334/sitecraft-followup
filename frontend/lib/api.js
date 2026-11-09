// Talks to the backend. Base URL comes from NEXT_PUBLIC_API_URL (.env.local).
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001').replace(/\/+$/, '');

const TOKEN_KEY = 'fus_session';

export function saveSession(token, hours) {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: Date.now() + hours * 3600 * 1000 }));
  } catch {}
}

export function getToken() {
  try {
    const s = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    if (!s || !s.token || s.exp < Date.now()) return null;
    return s.token;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  if (!token && path !== '/api/auth/login') {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') window.location.href = '/login';
    throw new ApiError(401, 'Please log in');
  }
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, `Could not connect to the backend (${API_URL}). Is the backend running?`);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (res.status === 401 && path !== '/api/auth/login') {
    clearSession();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') window.location.href = '/login';
  }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `Error ${res.status}`);
  return data;
}
