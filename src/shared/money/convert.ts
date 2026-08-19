import { currencyDecimals } from './types';
import type { CurrencyCode } from './types';

/**
 * Convert a decimal amount (e.g. `12.50`) to integer minor units
 * (e.g. `1250`) for the given currency.
 *
 * String inputs must use no more fractional digits than the currency supports.
 * This avoids silently changing what a user typed. Numeric inputs are rounded
 * to the currency precision before conversion because their original textual
 * precision is no longer available.
 */
export function decimalToMinor(amount: number | string, currency: CurrencyCode): number {
  const decimals = currencyDecimals(currency);
  const str = typeof amount === 'number' ? amount.toFixed(decimals) : amount.trim();
  if (!/^-?\d+(?:\.\d*)?$/.test(str)) {
    throw new Error(`decimalToMinor: invalid decimal amount "${amount}"`);
  }

  const negative = str.startsWith('-');
  const body = negative ? str.slice(1) : str;
  const [intPart, fracPart = ''] = body.split('.');
  if (fracPart.length > decimals) {
    throw new Error(
      `decimalToMinor: ${currency} supports at most ${decimals} fractional digit${decimals === 1 ? '' : 's'}`,
    );
  }

  const paddedFrac = fracPart.padEnd(decimals, '0');
  const combined = `${intPart}${paddedFrac}`.replace(/^0+(?=\d)/, '');
  const minor = Number(combined);
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`decimalToMinor: amount is outside the safe integer range: "${amount}"`);
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

/**
 * Render minor units as a locale-neutral decimal string using the currency's
 * exact fractional precision. This is intended for CSV/JSON-style exports,
 * where values must not be forced to two decimals (for example JPY or KWD).
 */
export function minorToDecimalString(amountMinor: number, currency: CurrencyCode): string {
  const decimals = currencyDecimals(currency);
  if (decimals === 0) return String(amountMinor);

  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const raw = abs.toString().padStart(decimals + 1, '0');
  const integer = raw.slice(0, -decimals) || '0';
  const fraction = raw.slice(-decimals);
  return `${negative ? '-' : ''}${integer}.${fraction}`;
}
