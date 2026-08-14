import { describe, expect, it } from 'vitest';
import { previewSplitCsv } from './importCsv';

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
});
