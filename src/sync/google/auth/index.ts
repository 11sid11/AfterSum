/**
 * Google Identity Services browser authorization.
 *
 * Access tokens intentionally live in module memory only. They are never
 * written to IndexedDB, localStorage, exports, or logs.
 */

import { GOOGLE_CLIENT_ID, GOOGLE_SYNC_CONFIGURED } from '../config';

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GOOGLE_SCOPES = `openid email ${DRIVE_FILE_SCOPE}`;
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

type AuthPrompt = '' | 'none' | 'consent' | 'select_account';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(config?: { prompt?: AuthPrompt; login_hint?: string }): void;
}

interface GoogleOAuth2Api {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    include_granted_scopes: boolean;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string }) => void;
  }): TokenClient;
  revoke(accessToken: string, callback?: () => void): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: GoogleOAuth2Api;
      };
    };
  }
}

export interface GoogleAuthState {
  authorized: boolean;
  /** Stable Google OpenID subject identifier. */
  accountId?: string;
  email?: string;
  expiresAt?: number;
}

export interface GoogleSession {
  accountId: string;
  email?: string;
  accessToken: string;
  expiresAt: number;
}

let state: GoogleAuthState = { authorized: false };
let accessToken: string | null = null;
let gisLoadPromise: Promise<void> | null = null;

export function isGoogleAuthConfigured(): boolean {
  return GOOGLE_SYNC_CONFIGURED;
}

export function getGoogleAuthState(): GoogleAuthState {
  return state;
}

export function setGoogleAuthState(next: GoogleAuthState): void {
  state = next;
}

export function clearGoogleAuthState(): void {
  accessToken = null;
  state = { authorized: false };
}

export function getGoogleSession(): GoogleSession | null {
  if (
    !state.authorized ||
    !state.accountId ||
    !state.expiresAt ||
    !accessToken ||
    Date.now() >= state.expiresAt
  ) {
    if (state.authorized) clearGoogleAuthState();
    return null;
  }

  return {
    accountId: state.accountId,
    email: state.email,
    accessToken,
    expiresAt: state.expiresAt,
  };
}

export async function requestGoogleAuthorization(options: {
  prompt?: AuthPrompt;
  loginHint?: string;
} = {}): Promise<GoogleAuthState> {
  if (!GOOGLE_SYNC_CONFIGURED) {
    throw new Error('Google Sheets backup is not configured for this build.');
  }

  await loadGoogleIdentityServices();
  const oauth2 = window.google?.accounts.oauth2;
  if (!oauth2) throw new Error('Google Identity Services did not load.');

  const token = await new Promise<TokenResponse>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      include_granted_scopes: true,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        resolve(response);
      },
      error_callback: (error) => {
        reject(new Error(error.type === 'popup_closed' ? 'Google sign-in was cancelled.' : 'Google sign-in failed.'));
      },
    });

    client.requestAccessToken({
      prompt: options.prompt ?? 'select_account',
      ...(options.loginHint ? { login_hint: options.loginHint } : {}),
    });
  });

  if (!token.access_token) throw new Error('Google did not return an access token.');
  const granted = new Set((token.scope ?? '').split(/\s+/).filter(Boolean));
  if (!granted.has(DRIVE_FILE_SCOPE) || !granted.has('openid')) {
    throw new Error('AfterSum needs account identity and access to its own Drive files to use cloud backup.');
  }

  const profileResponse = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) throw new Error('Could not verify the connected Google account.');

  const profile = (await profileResponse.json()) as { sub?: string; email?: string };
  if (!profile.sub) throw new Error('Google account identity was unavailable.');

  const expiresAt = Date.now() + Math.max(0, (token.expires_in ?? 3600) - 30) * 1000;
  accessToken = token.access_token;
  state = {
    authorized: true,
    accountId: profile.sub,
    email: profile.email,
    expiresAt,
  };
  return state;
}

/** Revoke the current grant when possible, then clear all in-memory auth state. */
export async function disconnectGoogleAuthorization(): Promise<void> {
  const token = accessToken;
  const oauth2 = window.google?.accounts.oauth2;
  if (token && oauth2) {
    await new Promise<void>((resolve) => oauth2.revoke(token, resolve));
  }
  clearGoogleAuthState();
}

async function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts.oauth2) return;
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_URL}"]`);
    const script = existing ?? document.createElement('script');

    const handleLoad = () => {
      cleanup();
      if (window.google?.accounts.oauth2) resolve();
      else reject(new Error('Google Identity Services did not initialize.'));
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Could not load Google Identity Services. Check your connection and try again.'));
    };
    const cleanup = () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    if (!existing) {
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.referrerPolicy = 'no-referrer-when-downgrade';
      document.head.appendChild(script);
    }
  }).catch((error) => {
    gisLoadPromise = null;
    throw error;
  });

  return gisLoadPromise;
}
