/**
 * Money types.
 *
 * Money is always stored as integer minor units (e.g. paise, cents).
 * The currency is carried alongside the amount so we never
 * accidentally mix currencies.
 *
 * `amountMinor` is signed: a Split balance may be negative
 * ("I owe them"). Track transactions are stored as the absolute
 * amount the user entered; the `type` field determines direction.
 */

export type CurrencyCode = string;

export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

/** ISO-style exceptions to the common two-decimal rule. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF',
  'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

const THREE_DECIMAL_CURRENCIES = new Set([
  'BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND',
]);

/** Number of fractional digits for a given currency. Defaults to 2. */
export function currencyDecimals(currency: CurrencyCode): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}
