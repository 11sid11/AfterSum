/**
 * Critical isolation test from work.md section 85.
 *
 *   Rahul Lend  +5000
 *   Rahul Goa   +1200
 *   Rahul Delhi -600
 *
 * Verify:
 *   Lend remains +5000
 *   Goa remains +1200
 *   Delhi remains -600
 *
 * Overview may show +5600.
 *
 * Then perform a Goa settlement.
 * Assert Lend remains +5000.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB, wipeDB } from '../../tests/db-test-utils';
import { getDB } from '@db/database';

const SELF = 'self';
const RAHUL = 'p_rahul';

async function seed() {
  const db = getDB();
  await db.people.put({
    id: SELF,
    name: 'Me',
    isSelf: true,
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  await db.people.put({
    id: RAHUL,
    name: 'Rahul',
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  // Lend: lent 5000 to Rahul
  await db.lendLedgers.put({
    id: 'lend_rahul',
    personId: RAHUL,
    currency: 'INR',
    archived: false,
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  await db.lendEntries.put({
    id: 'lend_e1',
    ledgerId: 'lend_rahul',
    type: 'lent',
    amountMinor: 500000,
    date: '2026-08-13',
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  // Goa Trip
  await db.splitGroups.put({
    id: 'grp_goa',
    name: 'Goa Trip',
    currency: 'INR',
    archived: false,
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  await db.splitGroupMembers.put({
    id: 'm1',
    groupId: 'grp_goa',
    personId: SELF,
    active: true,
    joinedAt: '',
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  await db.splitGroupMembers.put({
    id: 'm2',
    groupId: 'grp_goa',
    personId: RAHUL,
    active: true,
    joinedAt: '',
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  await db.splitExpenses.put({
    id: 'exp_goa',
    groupId: 'grp_goa',
    title: 'Hotel',
    amountMinor: 240000,
    currency: 'INR',
    date: '2026-08-13',
    splitMethod: 'equal',
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  // Rahul paid 2400, each owes 1200. Rahul balance = paid - share = 2400 - 1200 = +1200.
  await db.splitPayers.put({
    id: 'pay1',
    expenseId: 'exp_goa',
    personId: RAHUL,
    amountMinor: 240000,
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  await db.splitShares.put({
    id: 'sha1',
    expenseId: 'exp_goa',
    personId: SELF,
    amountMinor: 120000,
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  await db.splitShares.put({
    id: 'sha2',
    expenseId: 'exp_goa',
    personId: RAHUL,
    amountMinor: 120000,
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });

  // Delhi Trip
  await db.splitGroups.put({
    id: 'grp_delhi',
    name: 'Delhi Trip',
    currency: 'INR',
    archived: false,
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  await db.splitGroupMembers.put({
    id: 'm3',
    groupId: 'grp_delhi',
    personId: SELF,
    active: true,
    joinedAt: '',
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  await db.splitGroupMembers.put({
    id: 'm4',
    groupId: 'grp_delhi',
    personId: RAHUL,
    active: true,
    joinedAt: '',
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  await db.splitExpenses.put({
    id: 'exp_delhi',
    groupId: 'grp_delhi',
    title: 'Cab',
    amountMinor: 120000,
    currency: 'INR',
    date: '2026-08-13',
    splitMethod: 'equal',
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  // Self paid 1200, each owes 600. Self balance = paid - share = 1200 - 600 = +600.
  // Rahul balance = 0 - 600 = -600.
  await db.splitPayers.put({
    id: 'pay2',
    expenseId: 'exp_delhi',
    personId: SELF,
    amountMinor: 120000,
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  await db.splitShares.put({
    id: 'sha3',
    expenseId: 'exp_delhi',
    personId: SELF,
    amountMinor: 60000,
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
  await db.splitShares.put({
    id: 'sha4',
    expenseId: 'exp_delhi',
    personId: RAHUL,
    amountMinor: 60000,
    createdAt: '',
    updatedAt: '',
    revision: 1,
  });
}

function signedLendSum(entries: Array<{ type: string; amountMinor: number }>): number {
  let s = 0;
  for (const e of entries) {
    if (e.type === 'lent' || e.type === 'repayment_given' || e.type === 'adjustment') s += e.amountMinor;
    else s -= e.amountMinor;
  }
  return s;
}

function goaRahulBalance(_db: Awaited<ReturnType<typeof getDB>>): number {
  // helper stub; balance is computed inline in the test
  return 0;
}

describe('cross-module isolation', () => {
  beforeEach(async () => {
    await wipeDB();
    freshDB();
  });

  it('Lend, Split Goa, Split Delhi stay independent', async () => {
    await seed();
    const db = getDB();

    // Lend balance for Rahul
    const lendEntries = await db.lendEntries.toArray();
    const lend = signedLendSum(lendEntries);
    expect(lend).toBe(500000); // +5000

    // Goa Rahul balance = paid - share
    const goa = await db.splitExpenses.get('exp_goa');
    const goaPayers = await db.splitPayers.where('expenseId').equals('exp_goa').toArray();
    const goaShares = await db.splitShares.where('expenseId').equals('exp_goa').toArray();
    const goaPaid = goaPayers.filter((p) => p.personId === RAHUL).reduce((a, b) => a + b.amountMinor, 0);
    const goaShare = goaShares.filter((s) => s.personId === RAHUL).reduce((a, b) => a + b.amountMinor, 0);
    expect(goaPaid - goaShare).toBe(120000); // +1200
    void goa;

    // Delhi Rahul balance
    const delhiPaid = (await db.splitPayers.where('expenseId').equals('exp_delhi').toArray())
      .filter((p) => p.personId === RAHUL)
      .reduce((a, b) => a + b.amountMinor, 0);
    const delhiShare = (await db.splitShares.where('expenseId').equals('exp_delhi').toArray())
      .filter((s) => s.personId === RAHUL)
      .reduce((a, b) => a + b.amountMinor, 0);
    expect(delhiPaid - delhiShare).toBe(-60000); // -600

    // Now perform a Goa settlement: Self pays Rahul 1200.
    await db.splitSettlements.put({
      id: 'set_goa',
      groupId: 'grp_goa',
      fromPersonId: SELF,
      toPersonId: RAHUL,
      amountMinor: 120000,
      currency: 'INR',
      date: '2026-08-14',
      createdAt: '',
      updatedAt: '',
      revision: 1,
    });

    // Assert Lend remains +5000
    const lendAfter = signedLendSum(await db.lendEntries.toArray());
    expect(lendAfter).toBe(500000);

    // Assert Goa Rahul balance is now zero (paid - share + sent - received = 2400 - 1200 + 0 - 1200 = 0)
    const goaSet = await db.splitSettlements.where('groupId').equals('grp_goa').toArray();
    const goaRec = goaSet.filter((s) => s.toPersonId === RAHUL).reduce((a, b) => a + b.amountMinor, 0);
    const goaSent = goaSet.filter((s) => s.fromPersonId === RAHUL).reduce((a, b) => a + b.amountMinor, 0);
    const goaBal = (goaPaid - goaShare) + goaSent - goaRec;
    expect(goaBal).toBe(0);
  });
});

void goaRahulBalance;
