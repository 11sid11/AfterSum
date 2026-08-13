import type { GoogleSession } from './auth';

const ALLOWED_ORIGINS = new Set([
  'https://www.googleapis.com',
  'https://sheets.googleapis.com',
]);

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

export async function googleApiJson<T = unknown>(
  session: GoogleSession,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const parsed = new URL(url);
  if (!ALLOWED_ORIGINS.has(parsed.origin)) {
    throw new Error('Refusing to send Google authorization to an unexpected origin.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  const response = await fetch(parsed.toString(), { ...init, headers });

  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      detail = body.error?.message ? ` ${body.error.message}` : '';
    } catch {
      // Ignore non-JSON error bodies and never expose request credentials.
    }
    throw new GoogleApiError(`Google API request failed (${response.status}).${detail}`, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
