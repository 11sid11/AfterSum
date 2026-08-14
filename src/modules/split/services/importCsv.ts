import { getDB } from '@db/database';
import type { SplitExpenseCategory } from '@db/schema';
import { decimalToMinor } from '@shared/money';
import { personRepository } from '@shared/people/repository';
import { splitExpenseRepository } from '../repositories/splitExpenseRepository';
import { splitGroupMemberRepository } from '../repositories/splitGroupMemberRepository';
import { allocationSnapshotToInput, resolveTripDefaultSplit } from '../domain/entry';

export type SplitCsvKind = 'splitwise' | 'generic';

export interface SplitCsvRowPreview {
  rowNumber: number;
  date: string;
  title: string;
  amountMinor: number;
  category?: SplitExpenseCategory;
  payerAmountsByName?: Record<string, number>;
  shareAmountsByName?: Record<string, number>;
}

export interface SplitCsvPreview {
  kind: SplitCsvKind;
  rows: SplitCsvRowPreview[];
  participantNames: string[];
  warnings: string[];
  skippedRows: number;
}

export interface SplitCsvImportResult {
  imported: number;
  peopleAdded: number;
}

/** Parse a CSV locally. Nothing is written until executeSplitCsvImport is called. */
export function previewSplitCsv(text: string, groupCurrency: string): SplitCsvPreview {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error('CSV does not contain any expense rows.');

  const headers = table[0]!.map(normalizeHeader);
  const titleIndex = firstHeader(headers, ['description', 'title', 'expense', 'name']);
  const amountIndex = firstHeader(headers, ['cost', 'amount', 'total']);
  const dateIndex = firstHeader(headers, ['date', 'expense date']);
  const currencyIndex = firstHeader(headers, ['currency', 'currency code']);
  const categoryIndex = firstHeader(headers, ['category']);

  if (titleIndex < 0 || amountIndex < 0) {
    throw new Error('CSV needs at least Description/Title and Cost/Amount columns.');
  }

  const paidColumns = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header.endsWith(' paid'));
  const owedColumns = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header.endsWith(' owed'));
  const isSplitwise = paidColumns.length > 0 && owedColumns.length > 0;
  const warnings: string[] = [];
  const rows: SplitCsvRowPreview[] = [];
  const participantNames = new Set<string>();
  let skippedRows = 0;

  for (let index = 1; index < table.length; index += 1) {
    const source = table[index]!;
    const rowNumber = index + 1;
    const title = (source[titleIndex] ?? '').trim();
    const rawAmount = (source[amountIndex] ?? '').trim();
    if (!title && !rawAmount) continue;

    const currency = ((currencyIndex >= 0 ? source[currencyIndex] : groupCurrency) ?? groupCurrency)
      .trim()
      .toUpperCase();
    if (currency && currency !== groupCurrency.toUpperCase()) {
      warnings.push(`Row ${rowNumber}: skipped ${currency} expense; this trip accounts in ${groupCurrency}.`);
      skippedRows += 1;
      continue;
    }

    let amountMinor: number;
    try {
      amountMinor = decimalToMinor(rawAmount, groupCurrency);
    } catch {
      warnings.push(`Row ${rowNumber}: invalid amount.`);
      skippedRows += 1;
      continue;
    }
    if (amountMinor <= 0) {
      warnings.push(`Row ${rowNumber}: refunds/negative expenses are not imported into Split.`);
      skippedRows += 1;
      continue;
    }

    const date = normalizeDate(dateIndex >= 0 ? source[dateIndex] ?? '' : '');
    if (!date) {
      warnings.push(`Row ${rowNumber}: invalid or missing date.`);
      skippedRows += 1;
      continue;
    }

    const base: SplitCsvRowPreview = {
      rowNumber,
      date,
      title: title || 'Imported expense',
      amountMinor,
      category: mapCategory(categoryIndex >= 0 ? source[categoryIndex] ?? '' : ''),
    };

    if (isSplitwise) {
      const payerAmountsByName: Record<string, number> = {};
      const shareAmountsByName: Record<string, number> = {};
      for (const column of paidColumns) {
        const name = displayNameFromColumn(table[0]![column.index] ?? '', 'paid');
        const amount = parseOptionalMinor(source[column.index] ?? '', groupCurrency);
        if (name && amount > 0) {
          payerAmountsByName[name] = amount;
          participantNames.add(name);
        }
      }
      for (const column of owedColumns) {
        const name = displayNameFromColumn(table[0]![column.index] ?? '', 'owed');
        const amount = parseOptionalMinor(source[column.index] ?? '', groupCurrency);
        if (name && amount > 0) {
          shareAmountsByName[name] = amount;
          participantNames.add(name);
        }
      }
      const paidTotal = sumValues(payerAmountsByName);
      const owedTotal = sumValues(shareAmountsByName);
      if (paidTotal !== amountMinor || owedTotal !== amountMinor) {
        warnings.push(`Row ${rowNumber}: paid/owed columns do not add up to the expense total.`);
        skippedRows += 1;
        continue;
      }
      base.payerAmountsByName = payerAmountsByName;
      base.shareAmountsByName = shareAmountsByName;
    }

    rows.push(base);
  }

  if (rows.length === 0) throw new Error(warnings[0] ?? 'No importable expenses found.');

  return {
    kind: isSplitwise ? 'splitwise' : 'generic',
    rows,
    participantNames: [...participantNames].sort((a, b) => a.localeCompare(b)),
    warnings,
    skippedRows,
  };
}

/**
 * Import a validated preview into one trip.
 * Splitwise paid/owed columns are preserved as exact payer/share values.
 * Generic CSV rows use the trip's saved split (or You + everyone equally).
 */
export async function executeSplitCsvImport(
  groupId: string,
  preview: SplitCsvPreview,
): Promise<SplitCsvImportResult> {
  const db = getDB();
  const group = await db.splitGroups.get(groupId);
  if (!group || group.deletedAt || group.archived) throw new Error('Trip is not available for import.');

  const people = (await db.people.toArray()).filter((person) => !person.deletedAt);
  const self = people.find((person) => person.isSelf);
  if (!self) throw new Error('Your profile is missing.');

  const peopleByName = new Map(people.map((person) => [normalizeName(person.name), person]));
  let peopleAdded = 0;

  for (const name of preview.participantNames) {
    const key = normalizeName(name);
    if (peopleByName.has(key)) continue;
    const person = await personRepository.create({ name: name.trim() });
    peopleByName.set(key, person);
    peopleAdded += 1;
  }

  for (const name of preview.participantNames) {
    const person = peopleByName.get(normalizeName(name));
    if (person) await splitGroupMemberRepository.getOrCreate(groupId, person.id);
  }

  const members = await db.splitGroupMembers.where('groupId').equals(groupId).toArray();
  const activePersonIds = members
    .filter((member) => !member.deletedAt && member.active)
    .map((member) => member.personId);
  const fallback = resolveTripDefaultSplit({
    saved: group.defaultSplit,
    activePersonIds,
    preferredPayerId: self.id,
  });
  if (!fallback.payerPersonId || fallback.participantIds.length === 0) {
    throw new Error('Add at least one participant before importing expenses.');
  }

  let imported = 0;
  for (const row of preview.rows) {
    if (preview.kind === 'splitwise' && row.payerAmountsByName && row.shareAmountsByName) {
      const payers = Object.entries(row.payerAmountsByName).map(([name, amountMinor]) => {
        const person = peopleByName.get(normalizeName(name));
        if (!person) throw new Error(`Could not resolve payer ${name}.`);
        return { personId: person.id, amountMinor };
      });
      const shareEntries = Object.entries(row.shareAmountsByName).map(([name, amountMinor]) => {
        const person = peopleByName.get(normalizeName(name));
        if (!person) throw new Error(`Could not resolve participant ${name}.`);
        return [person.id, amountMinor] as const;
      });
      const participantIds = shareEntries.map(([personId]) => personId);
      await splitExpenseRepository.createAtomic({
        groupId,
        title: row.title,
        amountMinor: row.amountMinor,
        currency: group.currency,
        date: row.date,
        splitMethod: 'exact',
        category: row.category,
        payers,
        participantIds,
        allocation: { method: 'exact', amountsByPersonId: Object.fromEntries(shareEntries) },
      });
    } else {
      await splitExpenseRepository.createAtomic({
        groupId,
        title: row.title,
        amountMinor: row.amountMinor,
        currency: group.currency,
        date: row.date,
        splitMethod: fallback.splitMethod,
        category: row.category,
        payers: [{ personId: fallback.payerPersonId, amountMinor: row.amountMinor }],
        participantIds: fallback.participantIds,
        allocation: allocationSnapshotToInput(
          fallback.splitMethod,
          fallback.participantIds,
          fallback.allocation,
        ),
      });
    }
    imported += 1;
  }

  return { imported, peopleAdded };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      pushCell();
    } else if (char === '\n') {
      pushRow();
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) pushRow();
  return rows;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function firstHeader(headers: string[], choices: string[]): number {
  for (const choice of choices) {
    const index = headers.indexOf(choice);
    if (index >= 0) return index;
  }
  return -1;
}

function displayNameFromColumn(header: string, suffix: 'paid' | 'owed'): string {
  return header.replace(new RegExp(`\\s+${suffix}\\s*$`, 'i'), '').trim();
}

function parseOptionalMinor(value: string, currency: string): number {
  if (!value.trim()) return 0;
  try {
    return decimalToMinor(value, currency);
  } catch {
    return 0;
  }
}

function normalizeDate(value: string): string | undefined {
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (us) {
    const [, month, day, year] = us;
    return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mapCategory(value: string): SplitExpenseCategory | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (/food|dining|restaurant|grocer/.test(normalized)) return 'food';
  if (/stay|hotel|lodg|rent|accommodation/.test(normalized)) return 'stay';
  if (/travel|transport|taxi|uber|flight|train|fuel|gas/.test(normalized)) return 'travel';
  if (/fun|entertain|movie|activity|game/.test(normalized)) return 'fun';
  if (/shop|clothes|gift/.test(normalized)) return 'shopping';
  return 'other';
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function sumValues(values: Record<string, number>): number {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}
