import { describe, expect, it } from 'vitest';
import {
  csvOfPeople,
  csvOfSplitExpenses,
  csvOfTrackTransactions,
  csvOfLendEntries,
} from './serializer';

describe('CSV serializer', () => {
  it('handles special characters in names and titles', () => {
    const csv = csvOfPeople([
      {
        id: 'p1',
        name: 'Rahul "the boss"',
        isSelf: false,
        phone: undefined,
        email: undefined,
        note: 'line\nbreak, comma',
        createdAt: '2026-08-13T00:00:00.000Z',
        updatedAt: '2026-08-13T00:00:00.000Z',
        revision: 1,
      },
    ]);
    // The name field must be quoted with escaped quotes.
    expect(csv).toMatch(/Rahul ""the boss""/);
    // Comma + newline must be inside a quoted field.
    expect(csv).toMatch(/"line\r?\nbreak, comma"/);
  });

  it('uses decimal + minor + currency in track transactions', () => {
    const csv = csvOfTrackTransactions(
      [
        {
          id: 't1',
          type: 'expense',
          title: 'Dinner',
          amountMinor: 125050,
          currency: 'INR',
          date: '2026-08-13',
          categoryId: 'c1',
          createdAt: '2026-08-13T00:00:00.000Z',
          updatedAt: '2026-08-13T00:00:00.000Z',
          revision: 1,
        },
      ],
      [{ id: 'c1', name: 'Food', type: 'expense', archived: false, createdAt: '', updatedAt: '', revision: 1 }],
      'INR',
    );
    const lines = csv.split(/\r?\n/);
    // header + 1 row + trailing empty
    expect(lines[0]).toContain('amount');
    expect(lines[0]).toContain('amount_minor');
    expect(lines[0]).toContain('currency');
    expect(lines[1]).toContain('1250.50');
    expect(lines[1]).toContain('125050');
    expect(lines[1]).toContain('INR');
    expect(lines[1]).toContain('Food');
  });

  it('uses ISO date and decimal amount for split expenses', () => {
    const csv = csvOfSplitExpenses(
      [
        {
          id: 'e1',
          groupId: 'g1',
          title: 'Hotel',
          amountMinor: 600000,
          currency: 'INR',
          date: '2026-08-13',
          splitMethod: 'equal',
          createdAt: '',
          updatedAt: '',
          revision: 1,
        },
      ],
      [{ id: 'g1', name: 'Goa Trip', currency: 'INR', archived: false, createdAt: '', updatedAt: '', revision: 1 }],
    );
    expect(csv).toMatch(/2026-08-13/);
    expect(csv).toMatch(/6000\.00/);
    expect(csv).toMatch(/Goa Trip/);
    expect(csv).toMatch(/Hotel/);
  });

  it('Lend entries include currency, person, and ISO date', () => {
    const csv = csvOfLendEntries(
      [
        {
          id: 'le1',
          ledgerId: 'll1',
          type: 'lent',
          amountMinor: 500000,
          date: '2026-08-13',
          createdAt: '',
          updatedAt: '',
          revision: 1,
        },
      ],
      [
        {
          id: 'll1',
          personId: 'pr',
          currency: 'INR',
          archived: false,
          createdAt: '',
          updatedAt: '',
          revision: 1,
        },
      ],
      [{ id: 'pr', name: 'Rahul', createdAt: '', updatedAt: '', revision: 1 }],
    );
    expect(csv).toMatch(/lent/);
    expect(csv).toMatch(/2026-08-13/);
    expect(csv).toMatch(/5000\.00/);
    expect(csv).toMatch(/Rahul/);
  });

  it('UTF-8 BOM at the start', () => {
    expect(csvOfPeople([]).charCodeAt(0)).toBe(0xfeff);
  });
});
