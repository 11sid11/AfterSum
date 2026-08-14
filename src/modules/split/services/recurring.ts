import { getDB } from '@db/database';
import type { SplitRecurringTemplate } from '@db/schema';
import { splitExpenseRepository } from '../repositories/splitExpenseRepository';
import { splitGroupRepository } from '../repositories/splitGroupRepository';
import { allocationSnapshotToInput, itemizedAllocation, nextRecurringDate } from '../domain/entry';
import { todayDateOnly } from '@shared/dates';

const MAX_OCCURRENCES_PER_PASS = 36;

export interface RecurringMaterializeResult {
  created: number;
  blocked: number;
}

/**
 * Materialize due recurring expenses for one trip.
 *
 * This is intentionally local and idempotent: an occurrence is keyed by
 * template id + occurrence date, so reopening the app cannot duplicate it.
 * Invalid templates are left in place for the user to fix instead of silently
 * changing participants or money.
 */
export async function materializeDueSplitRecurring(
  groupId: string,
  throughDate: string = todayDateOnly(),
): Promise<RecurringMaterializeResult> {
  const db = getDB();
  const group = await db.splitGroups.get(groupId);
  if (!group || group.deletedAt || group.archived) return { created: 0, blocked: 0 };

  const templates = group.recurringTemplates ?? [];
  if (templates.length === 0) return { created: 0, blocked: 0 };

  const members = await db.splitGroupMembers.where('groupId').equals(groupId).toArray();
  const activeIds = new Set(
    members.filter((member) => !member.deletedAt && member.active).map((member) => member.personId),
  );
  const existing = await db.splitExpenses.where('groupId').equals(groupId).toArray();
  const occurrenceKeys = new Set(
    existing
      .filter((expense) => !expense.deletedAt && expense.recurrenceTemplateId && expense.recurrenceOccurrenceDate)
      .map((expense) => `${expense.recurrenceTemplateId}:${expense.recurrenceOccurrenceDate}`),
  );

  let created = 0;
  let blocked = 0;
  let changed = false;
  const nextTemplates: SplitRecurringTemplate[] = [];

  for (const template of templates) {
    if (!template.enabled) {
      nextTemplates.push(template);
      continue;
    }
    if (
      !activeIds.has(template.payerPersonId) ||
      template.participantIds.length === 0 ||
      template.participantIds.some((id) => !activeIds.has(id))
    ) {
      blocked += 1;
      nextTemplates.push(template);
      continue;
    }

    let nextDate = template.nextDate;
    let processed = 0;
    while (nextDate <= throughDate && processed < MAX_OCCURRENCES_PER_PASS) {
      const key = `${template.id}:${nextDate}`;
      if (!occurrenceKeys.has(key)) {
        let participantIds = template.participantIds;
        let splitMethod = template.splitMethod;
        let allocation = allocationSnapshotToInput(splitMethod, participantIds, template.allocation ?? {});
        let amountMinor = template.amountMinor;

        if (template.items && template.items.length > 0) {
          const itemized = itemizedAllocation(template.items);
          participantIds = itemized.participantIds;
          amountMinor = itemized.totalAmountMinor;
          splitMethod = 'exact';
          allocation = { method: 'exact', amountsByPersonId: itemized.amountsByPersonId };
        }

        await splitExpenseRepository.createAtomic({
          groupId,
          title: template.title,
          amountMinor,
          currency: group.currency,
          date: nextDate,
          splitMethod,
          category: template.category,
          note: template.note,
          payers: [{ personId: template.payerPersonId, amountMinor }],
          participantIds,
          allocation,
          originalCurrency: template.originalCurrency,
          originalAmountMinor: template.originalAmountMinor,
          exchangeRate: template.exchangeRate,
          items: template.items,
          recurrenceTemplateId: template.id,
          recurrenceOccurrenceDate: nextDate,
        });
        occurrenceKeys.add(key);
        created += 1;
      }
      nextDate = nextRecurringDate(nextDate, template.frequency);
      processed += 1;
      changed = true;
    }

    nextTemplates.push(nextDate === template.nextDate ? template : { ...template, nextDate });
  }

  if (changed) await splitGroupRepository.setRecurringTemplates(groupId, nextTemplates);
  return { created, blocked };
}
