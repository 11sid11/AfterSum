/**
 * Dev-only seed/fixture data.
 *
 * Provides a small, realistic dataset that developers can
 * load into a fresh local DB to see the app in action.
 *
 * NEVER run automatically. Gated behind Settings → Developer
 * (not implemented in V1 UI) or `import { seedFixtures }`
 * from devtools.
 *
 * See work.md section 92.
 */

import { getDB } from '@db/database';
import { newId, prefixedId } from '@shared/ids';
import { nowISO, todayDateOnly } from '@shared/dates';
import { ensureFirstLaunch, SELF_PERSON_ID } from '@db/seed';

export interface SeedOptions {
  includeSplit?: boolean;
  includeLend?: boolean;
  includeTrack?: boolean;
}

const PEOPLE = [
  { id: SELF_PERSON_ID, name: 'Me' },
  { id: 'p_rahul', name: 'Rahul' },
  { id: 'p_aman', name: 'Aman' },
  { id: 'p_priya', name: 'Priya' },
];

/**
 * Seed the local DB with a small fixture dataset.
 * Idempotent only at the level of "creates if missing".
 * Will not overwrite existing data.
 */
export async function seedFixtures(opts: SeedOptions = {}): Promise<void> {
  await ensureFirstLaunch();
  const db = getDB();
  const now = nowISO();
  const today = todayDateOnly();

  // People
  for (const p of PEOPLE) {
    const existing = await db.people.get(p.id);
    if (!existing) {
      await db.people.put({
        id: p.id,
        name: p.name,
        isSelf: p.id === SELF_PERSON_ID,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      });
    }
  }

  if (opts.includeTrack !== false) {
    const cats = await db.trackCategories.toArray();
    const foodCat = cats.find((c) => c.name === 'Food');
    const travelCat = cats.find((c) => c.name === 'Travel');
    const otherCat = cats.find((c) => c.name === 'Other');
    const billCat = cats.find((c) => c.name === 'Bills');
    const tx = [
      {
        id: prefixedId('tx'),
        type: 'expense' as const,
        title: 'Coffee',
        amountMinor: 15000,
        currency: 'INR',
        date: today,
        categoryId: foodCat?.id,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      },
      {
        id: prefixedId('tx'),
        type: 'expense' as const,
        title: 'Uber',
        amountMinor: 25000,
        currency: 'INR',
        date: today,
        categoryId: travelCat?.id,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      },
      {
        id: prefixedId('tx'),
        type: 'expense' as const,
        title: 'Groceries',
        amountMinor: 85000,
        currency: 'INR',
        date: today,
        categoryId: otherCat?.id,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      },
      {
        id: prefixedId('tx'),
        type: 'expense' as const,
        title: 'Electricity',
        amountMinor: 220000,
        currency: 'INR',
        date: today,
        categoryId: billCat?.id,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      },
    ];
    for (const t of tx) {
      const existing = await db.trackTransactions.get(t.id);
      if (!existing) await db.trackTransactions.put(t);
    }
  }

  if (opts.includeSplit !== false) {
    // Goa Trip
    let goa = await db.splitGroups.get('grp_goa');
    if (!goa) {
      goa = {
        id: 'grp_goa',
        name: 'Goa Trip',
        currency: 'INR',
        archived: false,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      };
      await db.splitGroups.put(goa);
    }
    for (const personId of [SELF_PERSON_ID, 'p_rahul', 'p_aman', 'p_priya']) {
      const memberId = `${goa.id}_${personId}`;
      const existing = await db.splitGroupMembers.get(memberId);
      if (!existing) {
        await db.splitGroupMembers.put({
          id: memberId,
          groupId: goa.id,
          personId,
          active: true,
          joinedAt: now,
          createdAt: now,
          updatedAt: now,
          revision: 1,
        });
      }
    }
    // Hotel
    const hotelId = 'exp_hotel';
    if (!(await db.splitExpenses.get(hotelId))) {
      await db.splitExpenses.put({
        id: hotelId,
        groupId: goa.id,
        title: 'Hotel',
        amountMinor: 600000,
        currency: 'INR',
        date: today,
        splitMethod: 'equal',
        createdAt: now,
        updatedAt: now,
        revision: 1,
      });
      await db.splitPayers.put({
        id: newId(),
        expenseId: hotelId,
        personId: SELF_PERSON_ID,
        amountMinor: 600000,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      });
      const share = Math.floor(600000 / 4);
      for (const personId of [SELF_PERSON_ID, 'p_rahul', 'p_aman', 'p_priya']) {
        await db.splitShares.put({
          id: newId(),
          expenseId: hotelId,
          personId,
          amountMinor: share,
          createdAt: now,
          updatedAt: now,
          revision: 1,
        });
      }
    }
  }

  if (opts.includeLend !== false) {
    let ledger = await db.lendLedgers.get('lend_rahul_inr');
    if (!ledger) {
      ledger = {
        id: 'lend_rahul_inr',
        personId: 'p_rahul',
        currency: 'INR',
        archived: false,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      };
      await db.lendLedgers.put(ledger);
    }
    if (!(await db.lendEntries.get('le_rahul_5k'))) {
      await db.lendEntries.put({
        id: 'le_rahul_5k',
        ledgerId: ledger.id,
        type: 'lent',
        amountMinor: 500000,
        date: today,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      });
    }
  }
}
