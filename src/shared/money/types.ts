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

/** Known decimal places per ISO 4217-ish list. Default = 2. */
const KNOWN_DECIMALS: Record<string, number> = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  KRW: 0,
  BHD: 3,
  KWD: 3,
};

/** Number of fractional digits for a given currency. Defaults to 2. */
export function currencyDecimals(currency: CurrencyCode): number {
  return KNOWN_DECIMALS[currency.toUpperCase()] ?? 2;
}
