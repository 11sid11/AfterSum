/**
 * CSV serializer.
 *
 * Implements work.md section 57 (human-readable CSV rule):
 *   - machine IDs + meaningful names
 *   - decimal amounts + currency + amount_minor optional
 *   - ISO-friendly dates
 *
 * No locale-specific ambiguous dates.
 *
 * Used by:
 *   - "Export current Track month"  -> one file
 *   - "Export current Split group"  -> one file
 *   - "Export full data package"     -> ZIP
 */

import type {
  Person,
  TrackTransaction,
  TrackCategory,
  TrackBudget,
  TrackRecurringRule,
  SplitGroup,
  SplitGroupMember,
  SplitExpense,
  SplitPayer,
  SplitShare,
  SplitSettlement,
  LendLedger,
  LendEntry,
} from '@db/schema';
import { minorToDecimalString } from '@shared/money';

const BOM = '\uFEFF';

function escapeField(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function csvRow(values: Array<string | number | undefined | null>): string {
  return values.map(escapeField).join(',');
}

export function csvOfPeople(people: Person[]): string {
  const lines: string[] = [];
  lines.push(csvRow(['person_id', 'name', 'is_self', 'phone', 'email', 'note', 'created_at']));
  for (const p of people) {
    lines.push(csvRow([p.id, p.name, p.isSelf ? 'true' : 'false', p.phone, p.email, p.note, p.createdAt]));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvOfTrackTransactions(
  txs: TrackTransaction[],
  categories: TrackCategory[],
): string {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const lines: string[] = [];
  lines.push(
    csvRow([
      'transaction_id',
      'date',
      'type',
      'title',
      'amount',
      'amount_minor',
      'currency',
      'category_id',
      'category_name',
      'payment_method',
      'note',
    ]),
  );
  for (const t of txs) {
    lines.push(
      csvRow([
        t.id,
        t.date,
        t.type,
        t.title,
        minorToDecimalString(t.amountMinor, t.currency),
        t.amountMinor,
        t.currency,
        t.categoryId,
        t.categoryId ? catMap.get(t.categoryId) : '',
        t.paymentMethod,
        t.note,
      ]),
    );
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvOfTrackCategories(cats: TrackCategory[]): string {
  const lines: string[] = [];
  lines.push(csvRow(['category_id', 'name', 'type', 'icon', 'archived']));
  for (const c of cats) {
    lines.push(csvRow([c.id, c.name, c.type, c.icon, c.archived ? 'true' : 'false']));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvOfTrackBudgets(b: TrackBudget[]): string {
  const lines: string[] = [];
  lines.push(csvRow(['month', 'amount', 'amount_minor', 'currency']));
  for (const x of b) {
    lines.push(
      csvRow([x.month, minorToDecimalString(x.amountMinor, x.currency), x.amountMinor, x.currency]),
    );
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvOfTrackRecurring(r: TrackRecurringRule[]): string {
  const lines: string[] = [];
  lines.push(csvRow(['rule_id', 'title', 'amount', 'amount_minor', 'currency', 'frequency', 'next_date', 'enabled']));
  for (const x of r) {
    const amountMinor = x.amountMinor ?? 0;
    lines.push(
      csvRow([
        x.id,
        x.title,
        x.amountMinor !== undefined ? minorToDecimalString(amountMinor, x.currency) : '',
        x.amountMinor ?? '',
        x.currency,
        x.frequency,
        x.nextDate,
        x.enabled ? 'true' : 'false',
      ]),
    );
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvOfSplitGroups(g: SplitGroup[]): string {
  const lines: string[] = [];
  lines.push(csvRow(['group_id', 'name', 'description', 'currency', 'archived', 'created_at']));
  for (const x of g) {
    lines.push(csvRow([x.id, x.name, x.description, x.currency, x.archived ? 'true' : 'false', x.createdAt]));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvOfSplitMembers(m: SplitGroupMember[], people: Person[]): string {
  const pMap = new Map(people.map((p) => [p.id, p.name]));
  const lines: string[] = [];
  lines.push(
    csvRow(['member_id', 'group_id', 'person_id', 'person_name', 'active', 'joined_at']),
  );
  for (const x of m) {
    lines.push(csvRow([x.id, x.groupId, x.personId, pMap.get(x.personId) ?? '', x.active ? 'true' : 'false', x.joinedAt]));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvOfSplitExpenses(
  e: SplitExpense[],
  groups: SplitGroup[],
): string {
  const gMap = new Map(groups.map((g) => [g.id, g.name]));
  const lines: string[] = [];
  lines.push(
    csvRow([
      'expense_id',
      'date',
      'group_id',
      'group_name',
      'title',
      'amount',
      'amount_minor',
      'currency',
      'category',
      'split_method',
      'note',
    ]),
  );
  for (const x of e) {
    lines.push(
      csvRow([
        x.id,
        x.date,
        x.groupId,
        gMap.get(x.groupId) ?? '',
        x.title,
        minorToDecimalString(x.amountMinor, x.currency),
        x.amountMinor,
        x.currency,
        x.category ?? '',
        x.splitMethod,
        x.note,
      ]),
    );
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvOfSplitPayers(p: SplitPayer[], expenses: SplitExpense[], people: Person[]): string {
  const eMap = new Map(expenses.map((e) => [e.id, e]));
  const pMap = new Map(people.map((person) => [person.id, person.name]));
  const lines: string[] = [];
  lines.push(
    csvRow([
      'expense_id',
      'expense_title',
      'person_id',
      'person_name',
      'amount',
      'amount_minor',
      'currency',
    ]),
  );
  for (const x of p) {
    const expense = eMap.get(x.expenseId);
    lines.push(
      csvRow([
        x.expenseId,
        expense?.title ?? '',
        x.personId,
        pMap.get(x.personId) ?? '',
        expense ? minorToDecimalString(x.amountMinor, expense.currency) : '',
        x.amountMinor,
        expense?.currency ?? '',
      ]),
    );
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvOfSplitShares(s: SplitShare[], expenses: SplitExpense[], people: Person[]): string {
  const eMap = new Map(expenses.map((e) => [e.id, e]));
  const pMap = new Map(people.map((person) => [person.id, person.name]));
  const lines: string[] = [];
  lines.push(
    csvRow([
      'expense_id',
      'expense_title',
      'person_id',
      'person_name',
      'amount',
      'amount_minor',
      'currency',
    ]),
  );
  for (const x of s) {
    const expense = eMap.get(x.expenseId);
    lines.push(
      csvRow([
        x.expenseId,
        expense?.title ?? '',
        x.personId,
        pMap.get(x.personId) ?? '',
        expense ? minorToDecimalString(x.amountMinor, expense.currency) : '',
        x.amountMinor,
        expense?.currency ?? '',
      ]),
    );
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvOfSplitSettlements(s: SplitSettlement[], groups: SplitGroup[], people: Person[]): string {
  const gMap = new Map(groups.map((g) => [g.id, g.name]));
  const pMap = new Map(people.map((p) => [p.id, p.name]));
  const lines: string[] = [];
  lines.push(
    csvRow([
      'settlement_id',
      'date',
      'group_id',
      'group_name',
      'from_person_id',
      'from_person_name',
      'to_person_id',
      'to_person_name',
      'amount',
      'amount_minor',
      'currency',
      'note',
    ]),
  );
  for (const x of s) {
    lines.push(
      csvRow([
        x.id,
        x.date,
        x.groupId,
        gMap.get(x.groupId) ?? '',
        x.fromPersonId,
        pMap.get(x.fromPersonId) ?? '',
        x.toPersonId,
        pMap.get(x.toPersonId) ?? '',
        minorToDecimalString(x.amountMinor, x.currency),
        x.amountMinor,
        x.currency,
        x.note,
      ]),
    );
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvOfLendLedgers(l: LendLedger[], people: Person[]): string {
  const pMap = new Map(people.map((p) => [p.id, p.name]));
  const lines: string[] = [];
  lines.push(
    csvRow(['ledger_id', 'person_id', 'person_name', 'currency', 'label', 'archived']),
  );
  for (const x of l) {
    lines.push(csvRow([x.id, x.personId, pMap.get(x.personId) ?? '', x.currency, x.label, x.archived ? 'true' : 'false']));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvOfLendEntries(e: LendEntry[], ledgers: LendLedger[], people: Person[]): string {
  const lMap = new Map(ledgers.map((l) => [l.id, l]));
  const pMap = new Map(people.map((p) => [p.id, p.name]));
  const lines: string[] = [];
  lines.push(
    csvRow([
      'entry_id',
      'date',
      'ledger_id',
      'person_id',
      'person_name',
      'type',
      'amount',
      'amount_minor',
      'currency',
      'due_date',
      'note',
    ]),
  );
  for (const x of e) {
    const ledger = lMap.get(x.ledgerId);
    const currency = ledger?.currency ?? '';
    const personId = ledger?.personId ?? '';
    lines.push(
      csvRow([
        x.id,
        x.date,
        x.ledgerId,
        personId,
        pMap.get(personId) ?? '',
        x.type,
        ledger ? minorToDecimalString(x.amountMinor, currency) : '',
        x.amountMinor,
        currency,
        x.dueDate,
        x.note,
      ]),
    );
  }
  return BOM + lines.join('\r\n') + '\r\n';
}
