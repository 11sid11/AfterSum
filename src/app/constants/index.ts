/**
 * App-level constants.
 */

export const APP_NAME = 'Finance Utility';
export const APP_VERSION = '0.1.0';
export const SCHEMA_VERSION = 1;

/**
 * ISO 4217 currency catalogue used by local pickers.
 *
 * Labels and symbols are derived with Intl so the app can support a broad
 * currency set without shipping a hand-maintained exchange-rate service.
 * AfterSum never fetches rates automatically; foreign-expense conversion is
 * explicit and manual.
 */
const CURRENCY_CODES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
  'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
  'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR',
  'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF',
  'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL',
  'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR',
  'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR',
  'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR',
  'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD',
  'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS',
  'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD',
  'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF',
  'YER', 'ZAR', 'ZMW', 'ZWL',
] as const;

function currencyLabel(code: string): string {
  try {
    if (typeof Intl.DisplayNames === 'function') {
      return new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) ?? code;
    }
  } catch {
    // Fall through to the code below.
  }
  return code;
}

function currencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}

export const CURRENCY_OPTIONS: Array<{ code: string; label: string; symbol: string }> =
  CURRENCY_CODES.map((code) => ({
    code,
    label: currencyLabel(code),
    symbol: currencySymbol(code),
  }));

/** Number of milliseconds for a typical "undo" window. */
export const UNDO_TIMEOUT_MS = 5000;
