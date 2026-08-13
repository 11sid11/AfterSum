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

  it('creates at most one daily checkpoint per local date', async () => {
    const morning = new Date(2026, 7, 13, 8, 0, 0);
    const evening = new Date(2026, 7, 13, 20, 0, 0);

    await ensureDailyRecoverySnapshot(morning);
    await ensureDailyRecoverySnapshot(evening);

    const daily = (await listRecoverySnapshots()).filter((snapshot) => snapshot.reason === 'daily');
    expect(daily).toHaveLength(1);
  });

  it('keeps only the five newest daily checkpoints', async () => {
    for (let day = 1; day <= 7; day += 1) {
      await createRecoverySnapshot('daily', new Date(2026, 7, day, 8, 0, 0));
    }

    const daily = (await listRecoverySnapshots()).filter((snapshot) => snapshot.reason === 'daily');
    expect(daily).toHaveLength(5);
    expect(daily[0]?.createdAt).toBe(new Date(2026, 7, 7, 8, 0, 0).toISOString());
  });
});
