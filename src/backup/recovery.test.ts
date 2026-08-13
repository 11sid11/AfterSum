import { beforeEach, describe, expect, it } from 'vitest';
import { ensureFirstLaunch } from '@db/seed';
import { freshDB, wipeDB } from '@/tests/db-test-utils';
import {
  _resetRecoveryDBForTests,
  createRecoverySnapshot,
  ensureDailyRecoverySnapshot,
  listRecoverySnapshots,
} from './recovery';

describe('local recovery checkpoints', () => {
  beforeEach(async () => {
    await wipeDB();
    freshDB();
    await _resetRecoveryDBForTests();
    await ensureFirstLaunch();
  });

  it('creates at most one automatic checkpoint per local date', async () => {
    const morning = new Date(2026, 7, 13, 8, 0, 0);
    const evening = new Date(2026, 7, 13, 20, 0, 0);

    await ensureDailyRecoverySnapshot(morning);
    await ensureDailyRecoverySnapshot(evening);

    const daily = (await listRecoverySnapshots()).filter((snapshot) => snapshot.reason === 'daily');
    expect(daily).toHaveLength(1);
    expect(daily[0]?.createdAt).toBe(morning.toISOString());
  });

  it('replaces the previous automatic checkpoint instead of accumulating daily copies', async () => {
    const firstDay = new Date(2026, 7, 13, 8, 0, 0);
    const nextDay = new Date(2026, 7, 14, 8, 0, 0);

    const first = await createRecoverySnapshot('daily', firstDay);
    const second = await createRecoverySnapshot('daily', nextDay);

    const daily = (await listRecoverySnapshots()).filter((snapshot) => snapshot.reason === 'daily');
    expect(daily).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(daily[0]?.createdAt).toBe(nextDay.toISOString());
  });

  it('keeps only the three newest pre-restore safety checkpoints', async () => {
    for (let index = 1; index <= 5; index += 1) {
      await createRecoverySnapshot('before_restore', new Date(2026, 7, 13, 8, index, 0));
    }

    const safety = (await listRecoverySnapshots()).filter(
      (snapshot) => snapshot.reason === 'before_restore',
    );
    expect(safety).toHaveLength(3);
    expect(safety[0]?.createdAt).toBe(new Date(2026, 7, 13, 8, 5, 0).toISOString());
  });
});
