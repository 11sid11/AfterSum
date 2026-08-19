import { beforeEach, describe, expect, it } from 'vitest';
import { freshDB, wipeDB } from '@tests/db-test-utils';
import { getDB } from '@db/database';
import { personRepository } from '@shared/people/repository';
import { splitGroupRepository } from '../repositories/splitGroupRepository';
import { splitGroupMemberRepository } from '../repositories/splitGroupMemberRepository';
import { executeSplitCsvImport, previewSplitCsv, type SplitCsvPreview } from './importCsv';

beforeEach(async () => {
  await wipeDB();
  freshDB();
});

describe('previewSplitCsv', () => {
  it('detects Splitwise paid/owed columns and preserves exact amounts', () => {
    const csv = [
      'Date,Description,Category,Cost,Currency,Sid paid,Sid owed,Rahul paid,Rahul owed',
      '2026-08-14,Dinner,Dining out,100.00,INR,100.00,50.00,0.00,50.00',
    ].join('\n');

    const preview = previewSplitCsv(csv, 'INR');

    expect(preview.kind).toBe('splitwise');
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({
      date: '2026-08-14',
      title: 'Dinner',
      amountMinor: 10000,
      category: 'food',
      payerAmountsByName: { Sid: 10000 },
      shareAmountsByName: { Sid: 5000, Rahul: 5000 },
    });
    expect(preview.participantNames).toEqual(['Rahul', 'Sid']);
  });

  it('accepts a simple generic CSV and keeps writes out of the preview phase', () => {
    const csv = [
      'Date,Description,Amount,Category',
      '2026-08-14,Taxi,450.50,Travel',
      '2026-08-15,Hotel,2000,Stay',
    ].join('\n');

    const preview = previewSplitCsv(csv, 'INR');

    expect(preview.kind).toBe('generic');
    expect(preview.rows.map((row) => [row.title, row.amountMinor, row.category])).toEqual([
      ['Taxi', 45050, 'travel'],
      ['Hotel', 200000, 'stay'],
    ]);
    expect(preview.participantNames).toEqual([]);
  });

  it('skips a foreign-currency row rather than guessing an exchange rate', () => {
    const csv = [
      'Date,Description,Amount,Currency',
      '2026-08-14,Local dinner,1000,INR',
      '2026-08-14,Museum,20,EUR',
    ].join('\n');

    const preview = previewSplitCsv(csv, 'INR');

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]?.title).toBe('Local dinner');
    expect(preview.skippedRows).toBe(1);
    expect(preview.warnings[0]).toMatch(/skipped EUR expense/);
  });

  it('rejects impossible ISO-looking calendar dates during preview', () => {
    const csv = [
      'Date,Description,Amount',
      '2026-02-30,Dinner,100',
    ].join('\n');

    expect(() => previewSplitCsv(csv, 'INR')).toThrow(/invalid or missing date/i);
  });
});

describe('executeSplitCsvImport', () => {
  async function seedTrip() {
    const self = await personRepository.ensureSelf();
    const group = await splitGroupRepository.create({ name: 'Trip', currency: 'INR' });
    await splitGroupMemberRepository.getOrCreate(group.id, self.id);
    return { self, group };
  }

  it('maps the chosen Splitwise participant to self instead of creating a duplicate person', async () => {
    const { self, group } = await seedTrip();
    const preview = previewSplitCsv([
      'Date,Description,Cost,Currency,Siddharth paid,Siddharth owed,Rahul paid,Rahul owed',
      '2026-08-14,Dinner,100.00,INR,100.00,50.00,0.00,50.00',
    ].join('\n'), 'INR');

    const result = await executeSplitCsvImport(group.id, preview, {
      selfParticipantName: 'Siddharth',
    });

    expect(result.imported).toBe(1);
    expect(result.peopleAdded).toBe(1);
    const people = await getDB().people.toArray();
    expect(people.filter((person) => !person.isSelf).map((person) => person.name)).toEqual(['Rahul']);

    const expense = (await getDB().splitExpenses.toArray())[0]!;
    const payers = await getDB().splitPayers.where('expenseId').equals(expense.id).toArray();
    const shares = await getDB().splitShares.where('expenseId').equals(expense.id).toArray();
    expect(payers.find((payer) => payer.personId === self.id)?.amountMinor).toBe(10000);
    expect(shares.find((share) => share.personId === self.id)?.amountMinor).toBe(5000);
  });

  it('rolls back people, memberships and earlier expenses when a later row fails', async () => {
    const { group } = await seedTrip();
    const preview: SplitCsvPreview = {
      kind: 'splitwise',
      participantNames: ['Rahul'],
      warnings: [],
      skippedRows: 0,
      rows: [
        {
          rowNumber: 2,
          sourceKey: 'row-1',
          date: '2026-08-14',
          title: 'Valid',
          amountMinor: 10000,
          payerAmountsByName: { Rahul: 10000 },
          shareAmountsByName: { Rahul: 10000 },
        },
        {
          rowNumber: 3,
          sourceKey: 'row-2',
          date: '2026-08-15',
          title: 'Invalid payer total',
          amountMinor: 10000,
          payerAmountsByName: { Rahul: 5000 },
          shareAmountsByName: { Rahul: 10000 },
        },
      ],
    };

    await expect(
      executeSplitCsvImport(group.id, preview, { selfParticipantName: null }),
    ).rejects.toThrow(/Payer totals/);

    expect(await getDB().splitExpenses.count()).toBe(0);
    expect((await getDB().people.toArray()).filter((person) => !person.isSelf)).toHaveLength(0);
    expect(await getDB().splitGroupMembers.where('groupId').equals(group.id).count()).toBe(1);
  });
});
