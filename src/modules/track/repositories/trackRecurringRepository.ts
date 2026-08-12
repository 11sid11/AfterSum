/**
 * TrackRecurringRule repository.
 *
 * V1 recurring rules are REMINDERS / TEMPLATES only. They
 * never auto-insert transactions. The UI offers a "Create
 * transaction from this rule" action that copies the
 * template's fields into a manual entry.
 */

import { getDB } from '@db/database';
import {
  repoCreate,
  repoUpdate,
  repoSoftDelete,
  repoRestore,
  type CreateInput,
} from '@db/repositories/base';
import {
  TrackRecurringRuleInputSchema,
  cleanRecurringRuleInput,
  type TrackRecurringRuleInput,
} from '../domain/validation';
import { compareDateOnly, todayDateOnly } from '@shared/dates';
import type { TrackRecurringRule } from '@db/schema';

function clean(input: Partial<TrackRecurringRuleInput>): Partial<TrackRecurringRuleInput> {
  return cleanRecurringRuleInput(input as TrackRecurringRuleInput);
}

export const trackRecurringRepository = {
  /** All active (non-deleted) rules, sorted by nextDate asc. */
  async listActive(): Promise<TrackRecurringRule[]> {
    const all = await getDB().trackRecurringRules.toArray();
    return all
      .filter((r) => !r.deletedAt)
      .sort((a, b) => compareDateOnly(a.nextDate, b.nextDate));
  },

  /** Active rules whose nextDate is on or before today. */
  async due(asOf: string = todayDateOnly()): Promise<TrackRecurringRule[]> {
    const all = await getDB().trackRecurringRules.toArray();
    return all
      .filter((r) => !r.deletedAt && r.enabled && r.nextDate <= asOf)
      .sort((a, b) => compareDateOnly(a.nextDate, b.nextDate));
  },

  async get(id: string): Promise<TrackRecurringRule | undefined> {
    return getDB().trackRecurringRules.get(id);
  },

  async create(input: TrackRecurringRuleInput): Promise<TrackRecurringRule> {
    const parsed = TrackRecurringRuleInputSchema.parse(input);
    const cleaned = clean(parsed);
    return repoCreate<TrackRecurringRule>(getDB().trackRecurringRules, cleaned as CreateInput<TrackRecurringRule>);
  },

  async update(id: string, patch: Partial<TrackRecurringRuleInput>): Promise<TrackRecurringRule> {
    const parsed = TrackRecurringRuleInputSchema.partial().parse(patch);
    return repoUpdate<TrackRecurringRule>(getDB().trackRecurringRules, id, clean(parsed));
  },

  async setEnabled(id: string, enabled: boolean): Promise<TrackRecurringRule> {
    return repoUpdate<TrackRecurringRule>(getDB().trackRecurringRules, id, { enabled });
  },

  /** Advance `nextDate` to its next occurrence based on frequency. */
  async advance(id: string): Promise<TrackRecurringRule | undefined> {
    const rule = await trackRecurringRepository.get(id);
    if (!rule) return undefined;
    const next = computeNextDate(rule.nextDate, rule.frequency);
    return repoUpdate<TrackRecurringRule>(getDB().trackRecurringRules, id, { nextDate: next });
  },

  async softDelete(id: string): Promise<void> {
    return repoSoftDelete(getDB().trackRecurringRules, id);
  },

  async restore(id: string): Promise<void> {
    return repoRestore(getDB().trackRecurringRules, id);
  },

  /** Bulk-replace (used by JSON restore). */
  async replaceAll(rules: TrackRecurringRule[]): Promise<void> {
    const db = getDB();
    await db.trackRecurringRules.clear();
    if (rules.length > 0) await db.trackRecurringRules.bulkPut(rules);
  },
};

/** Compute the next occurrence of a YYYY-MM-DD date by frequency. */
export function computeNextDate(date: string, frequency: TrackRecurringRule['frequency']): string {
  const [y, m, d] = date.split('-').map(Number);
  const originalDay = d ?? 1;
  const dt = new Date(y, (m ?? 1) - 1, 1);
  if (frequency === 'weekly') {
    dt.setDate(dt.getDate() + 7 + (originalDay - 1));
  } else if (frequency === 'monthly') {
    dt.setMonth(dt.getMonth() + 1);
    // Clamp the day to the last day of the target month.
    const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    dt.setDate(Math.min(originalDay, lastDay));
  } else {
    dt.setFullYear(dt.getFullYear() + 1);
    // Feb 29 → Feb 28 in non-leap years.
    const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    dt.setDate(Math.min(originalDay, lastDay));
  }
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export type TrackRecurringRepository = typeof trackRecurringRepository;
