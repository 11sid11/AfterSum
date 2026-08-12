/**
 * Split method tests.
 *
 * Critical: per work.md §86, ₹100 / 3 must sum to exactly ₹100.
 * That's the foundational invariant the rest of the module relies on.
 */

import { describe, it, expect } from 'vitest';
import {
  computeEqualShares,
  computeExactShares,
  computePercentageShares,
  computeShareWeightedShares,
} from './splits';

describe('computeEqualShares', () => {
  it('100 / 3 sums to exactly 100', () => {
    const out = computeEqualShares(10000, ['a', 'b', 'c']);
    expect(out.reduce((s, v) => s + v, 0)).toBe(10000);
    expect(out).toEqual([3334, 3333, 3333]);
  });

  it('100 / 2 = 50/50', () => {
    const out = computeEqualShares(10000, ['a', 'b']);
    expect(out).toEqual([5000, 5000]);
  });

  it('100 / 1 returns the full amount', () => {
    const out = computeEqualShares(10000, ['a']);
    expect(out).toEqual([10000]);
  });

  it('100 / 7 distributes the remainder across the first slots', () => {
    const out = computeEqualShares(10000, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(out.reduce((s, v) => s + v, 0)).toBe(10000);
    // 10000 / 7 = 1428 rem 4 → first 4 slots get an extra paise.
    expect(out).toEqual([1429, 1429, 1429, 1429, 1428, 1428, 1428]);
  });

  it('zero amount returns all zeros', () => {
    const out = computeEqualShares(0, ['a', 'b', 'c']);
    expect(out).toEqual([0, 0, 0]);
  });

  it('throws on empty participants', () => {
    expect(() => computeEqualShares(100, [])).toThrow();
  });

  it('handles single-participant equal split (per §86)', () => {
    const out = computeEqualShares(7500, ['only']);
    expect(out).toEqual([7500]);
  });
});

describe('computeExactShares', () => {
  it('accepts amounts that sum exactly to the total', () => {
    const out = computeExactShares(
      10000,
      ['a', 'b', 'c'],
      { a: 3000, b: 3500, c: 3500 },
    );
    expect(out).toEqual([3000, 3500, 3500]);
  });

  it('throws when amounts do not sum to the total', () => {
    expect(() =>
      computeExactShares(10000, ['a', 'b'], { a: 3000, b: 3000 }),
    ).toThrow();
  });

  it('throws when a participant is missing an exact amount', () => {
    expect(() =>
      computeExactShares(10000, ['a', 'b'], { a: 10000 }),
    ).toThrow(/missing exact amount/);
  });

  it('throws on non-positive amounts', () => {
    expect(() =>
      computeExactShares(10000, ['a', 'b'], { a: 0, b: 10000 }),
    ).toThrow();
  });
});

describe('computePercentageShares', () => {
  it('handles standard 50/50', () => {
    const out = computePercentageShares(10000, ['a', 'b'], { a: 50, b: 50 });
    expect(out.reduce((s, v) => s + v, 0)).toBe(10000);
  });

  it('100 / 3 via 33.34 + 33.33 + 33.33 sums exactly to 100', () => {
    const out = computePercentageShares(10000, ['a', 'b', 'c'], {
      a: 33.34,
      b: 33.33,
      c: 33.33,
    });
    expect(out.reduce((s, v) => s + v, 0)).toBe(10000);
  });

  it('handles uneven percentages with remainder to largest share', () => {
    const out = computePercentageShares(10000, ['a', 'b', 'c'], {
      a: 60,
      b: 30,
      c: 10,
    });
    expect(out.reduce((s, v) => s + v, 0)).toBe(10000);
    // 60% of 10000 = 6000, 30% = 3000, 10% = 1000
    expect(out).toEqual([6000, 3000, 1000]);
  });

  it('throws when percentages do not sum to 100', () => {
    expect(() =>
      computePercentageShares(10000, ['a', 'b'], { a: 40, b: 40 }),
    ).toThrow();
  });

  it('rejects a percentage > 100', () => {
    expect(() =>
      computePercentageShares(10000, ['a', 'b'], { a: 150, b: 50 }),
    ).toThrow();
  });
});

describe('computeShareWeightedShares', () => {
  it('1/1/1/2 weights allocate proportionally', () => {
    const out = computeShareWeightedShares(1000, ['a', 'b', 'c', 'd'], {
      a: 1,
      b: 1,
      c: 1,
      d: 2,
    });
    expect(out.reduce((s, v) => s + v, 0)).toBe(1000);
    // 5 share-units total; 1000/5 = 200 per share; a/b/c get 200, d gets 400
    expect(out).toEqual([200, 200, 200, 400]);
  });

  it('3/1 weights give three quarters to A', () => {
    const out = computeShareWeightedShares(10000, ['a', 'b'], {
      a: 3,
      b: 1,
    });
    expect(out.reduce((s, v) => s + v, 0)).toBe(10000);
    expect(out).toEqual([7500, 2500]);
  });

  it('throws when shares include zero', () => {
    expect(() =>
      computeShareWeightedShares(1000, ['a', 'b'], { a: 0, b: 1 }),
    ).toThrow();
  });

  it('throws when a share is non-integer', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      computeShareWeightedShares(1000, ['a', 'b'], { a: 1.5, b: 1 } as any),
    ).toThrow();
  });

  it('throws on empty participants', () => {
    expect(() => computeShareWeightedShares(100, [], {})).toThrow();
  });
});

describe('work.md §86 critical cases', () => {
  it('₹100 / 3 minor units = ₹100 exactly (the canonical critical test)', () => {
    const out = computeEqualShares(10000, ['a', 'b', 'c']);
    expect(out.reduce((s, v) => s + v, 0)).toBe(10000);
    expect(out).toEqual([3334, 3333, 3333]);
  });

  it('single-participant expense', () => {
    const out = computeEqualShares(7500, ['a']);
    expect(out.reduce((s, v) => s + v, 0)).toBe(7500);
  });

  it('many-participant expense (10 people, ₹100)', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const out = computeEqualShares(10000, ids);
    expect(out.reduce((s, v) => s + v, 0)).toBe(10000);
  });
});
