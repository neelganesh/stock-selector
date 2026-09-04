import { supabase } from './supabase';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Wrapper around fetch for our `/api/*` Vercel serverless routes.
 *
 * Automatically attaches the current Supabase access token as
 * `Authorization: Bearer <token>`. Throws ApiError on non-2xx responses.
 *
 * If Supabase isn't configured or there is no active session, the
 * Authorization header is omitted and the server will respond 401.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('/') ? path : `/${path}`;

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const res = await fetch(url, { ...init, headers });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string')
        ? (body as { error: string }).error
        : `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, body);
  }

  return body as T;
}

export const api = {
  get: <T = unknown>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T = unknown>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
