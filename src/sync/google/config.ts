export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';

export const GOOGLE_SYNC_CONFIGURED = GOOGLE_CLIENT_ID.length > 0;
