/**
 * Date utilities.
 *
 * All persisted timestamps are ISO 8601 strings.
 *
 * For "month" routing the canonical form is `YYYY-MM` (e.g. `2026-08`).
 * For calendar dates without time the canonical form is `YYYY-MM-DD`.
 *
 * No Date object is persisted directly.
 */

/** Now as ISO string. */
export function nowISO(): string {
  return new Date().toISOString();
}

/** Today as YYYY-MM-DD in the local timezone. */
export function todayDateOnly(): string {
  return toDateOnly(new Date());
}

/** Format a Date as YYYY-MM-DD in local timezone. */
export function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string as a Date in local timezone. */
export function fromDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Format a Date as YYYY-MM month key. */
export function toMonthKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Parse a YYYY-MM month key as a Date (first day of the month). */
export function fromMonthKey(s: string): Date {
  const [y, m] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, 1);
}

/** Add (or subtract) N months to a YYYY-MM key. */
export function shiftMonth(month: string, delta: number): string {
  const d = fromMonthKey(month);
  d.setMonth(d.getMonth() + delta);
  return toMonthKey(d);
}

/** Compare two YYYY-MM-DD strings. Returns -1, 0, 1. */
export function compareDateOnly(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Check if date string falls within a YYYY-MM month. */
export function isInMonth(dateISO: string, month: string): boolean {
  return dateISO.slice(0, 7) === month;
}

/** Get the next N days as YYYY-MM-DD strings, starting at today. */
export function nextDays(count: number, from: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    out.push(toDateOnly(d));
  }
  return out;
}

/** Format an ISO timestamp for human display in the user's locale. */
export function formatHumanDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Format an ISO timestamp for human display with time. */
export function formatHumanDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
