/**
 * Google Identity Services — minimal auth façade.
 *
 * Real Google Drive/Sheets integration is implemented in
 * `src/sync/google/`. The V1 of this app is designed to work
 * fully offline; the auth module is the gate to optional
 * cloud features.
 *
 * The token model is browser-only (no refresh tokens stored
 * on a server). Access tokens are short-lived.
 */

export interface GoogleAuthState {
  authorized: boolean;
  email?: string;
  expiresAt?: number;
}

let _state: GoogleAuthState = { authorized: false };

export function getGoogleAuthState(): GoogleAuthState {
  return _state;
}

export function setGoogleAuthState(next: GoogleAuthState): void {
  _state = next;
}

export function clearGoogleAuthState(): void {
  _state = { authorized: false };
}

/**
 * Request authorization via GIS.
 * If the GIS script has not been loaded yet, this returns
 * `{ authorized: false }` and the UI should show a "Connect"
 * button. Real implementation lives in
 * `src/sync/google/auth/client.ts` once the gis script is
 * loaded.
 */
export async function requestGoogleAuthorization(): Promise<GoogleAuthState> {
  // Stub for V1. Real implementation requires loading the GIS
  // script and is a no-op when running in environments where
  // the user has not enabled Google sync.
  return { authorized: false };
}
