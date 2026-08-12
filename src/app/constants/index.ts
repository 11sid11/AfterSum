/**
 * App-level constants.
 */

export const APP_NAME = 'Finance Utility';
export const APP_VERSION = '0.1.0';
export const SCHEMA_VERSION = 1;

export const CURRENCY_OPTIONS: Array<{ code: string; label: string; symbol: string }> = [
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ' },
];

/** Number of milliseconds for a typical "undo" window. */
export const UNDO_TIMEOUT_MS = 5000;
