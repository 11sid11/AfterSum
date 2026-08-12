import { currencyDecimals } from './types';
import type { CurrencyCode } from './types';

/**
 * Convert a decimal amount (e.g. `12.50`) to integer minor units
 * (e.g. `1250`) for the given currency.
 *
 * Uses banker-safe integer math. Truncates the input to the
 * currency's number of decimals first to avoid float surprises.
 */
export function decimalToMinor(amount: number | string, currency: CurrencyCode): number {
  const decimals = currencyDecimals(currency);
  const str = typeof amount === 'number' ? amount.toFixed(decimals) : amount.trim();
  // Reject any non-numeric characters
  if (!/^-?\d+(\.\d+)?$/.test(str)) {
    throw new Error(`decimalToMinor: invalid decimal amount "${amount}"`);
  }
  const negative = str.startsWith('-');
  const body = negative ? str.slice(1) : str;
  const [intPart, fracPart = ''] = body.split('.');
  const paddedFrac = (fracPart + '0'.repeat(decimals)).slice(0, decimals);
  const combined = `${intPart}${paddedFrac}`.replace(/^0+(?=\d)/, '');
  const minor = Number(combined);
  if (!Number.isFinite(minor)) {
    throw new Error(`decimalToMinor: failed to convert "${amount}"`);
  }
  return negative ? -minor : minor;
}

/**
 * Convert integer minor units back to a decimal number.
 * E.g. `(1250, 'USD')` -> `12.5`.
 */
export function minorToDecimal(amountMinor: number, currency: CurrencyCode): number {
  const decimals = currencyDecimals(currency);
  if (decimals === 0) return amountMinor;
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const str = abs.toString().padStart(decimals + 1, '0');
  const intPart = str.slice(0, str.length - decimals) || '0';
  const fracPart = str.slice(str.length - decimals);
  const num = Number(`${intPart}.${fracPart}`);
  return negative ? -num : num;
}
