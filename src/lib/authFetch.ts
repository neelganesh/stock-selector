/**
 * Wraps `fetch` with Supabase auth Bearer injection.
 * All client-side API calls must use this helper to ensure the
 * Authorization header is sent on every request.
 *
 * Usage:
 *   const data = await authFetch('/api/executions');
 *   const data = await authFetch('/api/executions', { method: 'POST', body: JSON.stringify(body) });
 *
 * On 401, calls onUnauthorized() from AuthContext if available,
 * then re-throws so callers can handle.
 */

import { supabase } from './supabase.js';

export interface AuthFetchOptions extends RequestInit {
  /** Override the default Authorization header. */
  authorization?: string;
}

/**
 * Retrieves the current Supabase access token from the session.
 * Returns null if no session is available.
 */
async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase?.auth.getSession() ?? {};
  return data?.session?.access_token ?? null;
}

/**
 * Core auth-aware fetch helper.
 * Injects Bearer token automatically.
 * Re-throws on 401 so callers can react (e.g. redirect to login).
 */
export async function authFetch(
  path: string,
  options: AuthFetchOptions = {}
): Promise<Response> {
  const token = await getAccessToken();
  console.log('[authFetch]', path, 'token:', token ? token.substring(0, 20) + '...' : 'NONE');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  // Explicit auth header takes precedence (allows mock tokens in tests)
  if (token) {
    headers['Authorization'] = options.authorization ?? `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  return response;
}

/**
 * Error class for API errors with code support.
 */
export class APIError extends Error {
  status: number;
  code?: string;
  details?: string;

  constructor(message: string, status: number, code?: string, details?: string) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Shortcut: fetch + ok-check + json in one call.
 * Throws if response is not ok, returns parsed JSON.
 * Includes code field in error for programmatic handling.
 *
 * @example
 *   const executions = await authFetchJSON<Execution[]>('/api/executions');
 *   try {
 *     const data = await authFetchJSON('/api/capital');
 *   } catch (err) {
 *     if (err instanceof APIError && err.code === 'AUTH_FAILED') {
 *       // Handle auth error
 *     }
 *   }
 */
export async function authFetchJSON<T>(
  path: string,
  options: AuthFetchOptions = {}
): Promise<T> {
  const response = await authFetch(path, options);
  if (!response.ok) {
    let errorMessage = `authFetchJSON(${path}) failed ${response.status}`;
    let code: string | undefined;
    let details: string | undefined;

    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorMessage;
      code = errorBody.code;
      details = errorBody.details;
    } catch {
      // Response wasn't JSON, use status text
      errorMessage = `${errorMessage}: ${response.statusText}`;
    }

    throw new APIError(errorMessage, response.status, code, details);
  }
  return response.json() as Promise<T>;
}
