/**
 * Google Identity Services + Google API client bootstrap.
 *
 * AfterSum is a browser-only OAuth client. It uses the narrow `drive.file`
 * scope, keeps authorization in memory only, and never uses a client secret
 * or stores refresh tokens.
 */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GAPI_SCRIPT_URL = 'https://apis.google.com/js/api.js';
const DRIVE_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SHEETS_DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

type AuthPrompt = '' | 'consent' | 'select_account';

interface TokenResponse {
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
}

export interface GoogleApiResponse<T> {
  result: T;
  status?: number;
}

export interface GoogleApiClient {
  setToken(token: unknown): void;
  drive: {
    about: {
      get(input: { fields: string }): Promise<GoogleApiResponse<{
        user?: { permissionId?: string; emailAddress?: string };
      }>>;
    };
    files: {
      list(input: Record<string, unknown>): Promise<GoogleApiResponse<{ files?: unknown[] }>>;
      get(input: Record<string, unknown>): Promise<GoogleApiResponse<unknown>>;
      update(input: Record<string, unknown>): Promise<GoogleApiResponse<unknown>>;
    };
  };
  sheets: {
    spreadsheets: {
      create(input: Record<string, unknown>): Promise<GoogleApiResponse<unknown>>;
      values: {
        get(input: Record<string, unknown>): Promise<GoogleApiResponse<unknown>>;
        clear(input: Record<string, unknown>): Promise<GoogleApiResponse<unknown>>;
        update(input: Record<string, unknown>): Promise<GoogleApiResponse<unknown>>;
      };
    };
  };
}

interface GapiRoot {
  load(name: string, callback: () => void): void;
  client: GoogleApiClient & {
    init(input: { discoveryDocs: string[] }): Promise<void>;
  };
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: GoogleOAuth2Api;
      };
    };
    gapi?: GapiRoot;
  }
}

export interface GoogleAuthState {
  authorized: boolean;
  /** Stable Drive permission ID for the signed-in Google account. */
  accountId?: string;
  /** Display-only label; never used as the account identity key. */
  email?: string;
  expiresAt?: number;
}

export interface GoogleSession {
  accountId: string;
  email?: string;
  expiresAt: number;
}

let state: GoogleAuthState = { authorized: false };
let loadPromise: Promise<void> | null = null;

export function isGoogleAuthConfigured(): boolean {
  return GOOGLE_CLIENT_ID.length > 0;
}

export function getGoogleAuthState(): GoogleAuthState {
  return state;
}

export function clearGoogleAuthState(): void {
  window.gapi?.client.setToken(null);
  state = { authorized: false };
}

export function getGoogleSession(): GoogleSession | null {
  if (!state.authorized || !state.accountId || !state.expiresAt || Date.now() >= state.expiresAt) {
    if (state.authorized) clearGoogleAuthState();
    return null;
  }

  return {
    accountId: state.accountId,
    email: state.email,
    expiresAt: state.expiresAt,
  };
}

export function requireGoogleApiClient(): GoogleApiClient {
  if (!getGoogleSession() || !window.gapi?.client) {
    throw new Error('Google authorization expired. Reconnect and try again.');
  }
  return window.gapi.client;
}

export async function requestGoogleAuthorization(options: {
  prompt?: AuthPrompt;
  loginHint?: string;
} = {}): Promise<GoogleAuthState> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google Sheets backup is not configured for this build.');
  }

  await loadGoogleLibraries();
  const oauth2 = window.google?.accounts.oauth2;
  const gapi = window.gapi;
  if (!oauth2 || !gapi) throw new Error('Google libraries did not initialize.');

  const token = await new Promise<TokenResponse>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_FILE_SCOPE,
      include_granted_scopes: true,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        resolve(response);
      },
      error_callback: (error) => {
        reject(
          new Error(
            error.type === 'popup_closed'
              ? 'Google sign-in was cancelled.'
              : 'Google sign-in failed.',
          ),
        );
      },
    });

    client.requestAccessToken({
      prompt: options.prompt ?? 'select_account',
      ...(options.loginHint ? { login_hint: options.loginHint } : {}),
    });
  });

  const grantedScopes = new Set((token.scope ?? '').split(/\s+/).filter(Boolean));
  if (!grantedScopes.has(DRIVE_FILE_SCOPE)) {
    throw new Error('AfterSum needs access to files it creates in Google Drive.');
  }

  // Hand the short-lived credential to Google's client library; AfterSum does
  // not persist or inspect it.
  gapi.client.setToken(token);

  const about = await gapi.client.drive.about.get({ fields: 'user(permissionId,emailAddress)' });
  const account = about.result.user;
  if (!account?.permissionId) throw new Error('Google account identity was unavailable.');

  const expiresAt = Date.now() + Math.max(0, (token.expires_in ?? 3600) - 30) * 1000;
  state = {
    authorized: true,
    accountId: account.permissionId,
    email: account.emailAddress,
    expiresAt,
  };
  return state;
}

/** Disconnect this device. The remote Google authorization grant is left untouched. */
export async function disconnectGoogleAuthorization(): Promise<void> {
  clearGoogleAuthState();
}

async function loadGoogleLibraries(): Promise<void> {
  if (window.google?.accounts.oauth2 && window.gapi?.client.drive && window.gapi.client.sheets) return;
  if (loadPromise) return loadPromise;

  loadPromise = Promise.all([
    loadScript(GIS_SCRIPT_URL, () => !!window.google?.accounts.oauth2),
    loadScript(GAPI_SCRIPT_URL, () => !!window.gapi),
  ])
    .then(async () => {
      const gapi = window.gapi;
      if (!gapi) throw new Error('Google API client did not load.');

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timeout = window.setTimeout(() => {
          if (!settled) reject(new Error('Google API client initialization timed out.'));
        }, 10_000);
        gapi.load('client', () => {
          settled = true;
          window.clearTimeout(timeout);
          resolve();
        });
      });

      await gapi.client.init({
        discoveryDocs: [DRIVE_DISCOVERY_DOC, SHEETS_DISCOVERY_DOC],
      });
    })
    .catch((error) => {
      loadPromise = null;
      throw error;
    });

  return loadPromise;
}

function loadScript(src: string, ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    const script = existing ?? document.createElement('script');

    const cleanup = () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
    const handleLoad = () => {
      cleanup();
      if (ready()) resolve();
      else reject(new Error('A Google library loaded but did not initialize.'));
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Could not load Google services. Check your connection and try again.'));
    };

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    if (!existing) {
      script.src = src;
      script.async = true;
      script.defer = true;
      script.referrerPolicy = 'no-referrer-when-downgrade';
      document.head.appendChild(script);
    }
  });
}
