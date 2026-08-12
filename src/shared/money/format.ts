import { currencyDecimals } from './types';
import { minorToDecimal, decimalToMinor } from './convert';
import type { CurrencyCode, Money } from './types';

/**
 * Format a Money value for human display using `Intl.NumberFormat`.
 * Falls back to a manual format if the runtime lacks `Intl`.
 *
 * Example: format({ amountMinor: 125050, currency: 'INR' })
 *          -> "₹1,250.50" (en-IN) or "$1,250.50" (en-US)
 */
export function formatMoney(money: Money, locale?: string): string {
  const { amountMinor, currency } = money;
  const decimals = currencyDecimals(currency);
  const value = minorToDecimal(amountMinor, currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    // Manual fallback for unsupported currency codes / runtimes.
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value).toFixed(decimals);
    return `${sign}${currency} ${abs}`;
  }
}

/**
 * Parse a user-entered string (e.g. "1,250.50" or "₹1,250.50")
 * into a Money value.
 *
 * Strips currency symbols and thousands separators, then
 * delegates to `decimalToMinor`.
 */
export function parseMoney(input: string, currency: CurrencyCode): Money {
  const cleaned = input
    .replace(/[\s,]/g, '')
    .replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') {
    throw new Error('parseMoney: empty amount');
  }
  const amountMinor = decimalToMinor(cleaned, currency);
  return { amountMinor, currency };
}
