/**
 * Unit + property tests for source-row-token-theil-sen-slope.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenTheilSenSlope,
  theilSenSlope,
} from '../src/sourcerowtokentheilsenslope.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-29T12:00:00.000Z';

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

test('theilSenSlope: perfect line slope=2, intercept=3', () => {
  const xs = [3, 5, 7, 9, 11, 13];
  const r = theilSenSlope(xs);
  assert.equal(r.slope, 2);
  assert.equal(r.intercept, 3);
  assert.equal(r.pairsPositive, 15);
  assert.equal(r.pairsNegative, 0);
  assert.equal(r.pairsZero, 0);
  assert.equal(r.pairsTotal, 15);
});

test('theilSenSlope: flat constant series slope=0', () => {
  const xs = [42, 42, 42, 42, 42];
  const r = theilSenSlope(xs);
  assert.equal(r.slope, 0);
  assert.equal(r.intercept, 42);
  assert.equal(r.pairsPositive, 0);
  assert.equal(r.pairsNegative, 0);
  assert.equal(r.pairsZero, 10);
  assert.equal(r.pairsTotal, 10);
});

test('theilSenSlope: strictly decreasing series slope<0', () => {
  const xs = [10, 8, 6, 4, 2];
  const r = theilSenSlope(xs);
  assert.equal(r.slope, -2);
  assert.equal(r.intercept, 10);
  assert.equal(r.pairsPositive, 0);
  assert.equal(r.pairsNegative, 10);
  assert.equal(r.pairsZero, 0);
});

test('theilSenSlope: robustness — single huge outlier does NOT swing the slope', () => {
  // Pristine line y = i, then last point becomes 1e9.
  const xs = [0, 1, 2, 3, 4, 5, 6, 7, 1e9];
  const r = theilSenSlope(xs);
  // The single outlier corrupts only the pairs (i, n-1) for i in 0..7
  // which is 8 of the 36 pairs (~22%). Median pairwise slope is therefore
  // dominated by the pristine pairs whose slope is 1.
  assert.equal(r.slope, 1);
});

test('theilSenSlope: rejects n < 2', () => {
  assert.throws(() => theilSenSlope([5]), /at least 2 points/);
});

test('theilSenSlope: pair counts always sum to n*(n-1)/2', () => {
  const xs = [3, -1, 4, 1, -5, 9, 2, 6];
  const r = theilSenSlope(xs);
  assert.equal(r.pairsTotal, (xs.length * (xs.length - 1)) / 2);
  assert.equal(
    r.pairsPositive + r.pairsNegative + r.pairsZero,
    r.pairsTotal,
  );
});

test('theilSenSlope: translation-equivariant in x (slope unchanged, intercept shifts)', () => {
  const xs = [1, 4, 2, 8, 5, 7];
  const r1 = theilSenSlope(xs);
  const r2 = theilSenSlope(xs.map((v) => v + 100));
  assert.equal(r2.slope, r1.slope);
  assert.equal(r2.intercept, r1.intercept + 100);
  assert.equal(r2.pairsPositive, r1.pairsPositive);
  assert.equal(r2.pairsNegative, r1.pairsNegative);
});

test('theilSenSlope: scale-equivariant in x (slope and intercept scale by k)', () => {
  const xs = [1, 4, 2, 8, 5, 7];
  const r1 = theilSenSlope(xs);
  const r2 = theilSenSlope(xs.map((v) => v * 7));
  assert.ok(Math.abs(r2.slope - 7 * r1.slope) < 1e-12);
  assert.ok(Math.abs(r2.intercept - 7 * r1.intercept) < 1e-12);
});

test('theilSenSlope: sign-resolved S = pairsPositive - pairsNegative matches Mann-Kendall convention', () => {
  // y = i: every pair concordant, so S = C(n,2).
  const xs = [0, 1, 2, 3, 4];
  const r = theilSenSlope(xs);
  assert.equal(r.pairsPositive - r.pairsNegative, 10);
  assert.equal(r.pairsTotal, 10);
});

test('builder: rejects minRows < 4', () => {
  assert.throws(
    () =>
      buildSourceRowTokenTheilSenSlope([], { minRows: 3, generatedAt: GEN }),
    /minRows must be an integer >= 4/,
  );
});

test('builder: rejects negative minSlopeMagnitude', () => {
  assert.throws(
    () =>
      buildSourceRowTokenTheilSenSlope([], {
        minSlopeMagnitude: -0.1,
        generatedAt: GEN,
      }),
    /minSlopeMagnitude must be a finite, non-negative number/,
  );
});

test('builder: rejects non-positive maxPairs', () => {
  assert.throws(
    () =>
      buildSourceRowTokenTheilSenSlope([], { maxPairs: 0, generatedAt: GEN }),
    /maxPairs must be a positive integer/,
  );
});

test('builder: rejects unknown sort key', () => {
  assert.throws(
    () =>
      buildSourceRowTokenTheilSenSlope([], {
        sort: 'bogus' as never,
        generatedAt: GEN,
      }),
    /sort must be one of/,
  );
});

test('builder: end-to-end with two sources, distinct slopes', () => {
  const queue: QueueLine[] = [
    ...mkSeries('alpha', [1, 2, 3, 4, 5, 6]),
    ...mkSeries('beta', [10, 8, 6, 4, 2, 0]),
  ];
  const r = buildSourceRowTokenTheilSenSlope(queue, { generatedAt: GEN });
  assert.equal(r.totalSources, 2);
  assert.equal(r.totalRowsKept, 12);
  // default sort is magnitude-desc; both have |slope|=1 and 2 respectively
  // alpha slope = +1, beta slope = -2 -> beta sorts first by |slope| desc
  const beta = r.sources.find((s) => s.source === 'beta')!;
  const alpha = r.sources.find((s) => s.source === 'alpha')!;
  assert.equal(beta.slope, -2);
  assert.equal(alpha.slope, 1);
  assert.equal(beta.slopeSign, 'down');
  assert.equal(alpha.slopeSign, 'up');
  assert.equal(r.sources[0]!.source, 'beta');
});

test('builder: drops sources below minRows', () => {
  const queue: QueueLine[] = [
    ...mkSeries('tiny', [1, 2, 3]), // 3 rows < 4
    ...mkSeries('big', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenTheilSenSlope(queue, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('builder: drops sources above pair cap', () => {
  // n=6 -> 15 pairs; cap at 10 should drop it.
  const queue: QueueLine[] = mkSeries('big', [1, 2, 3, 4, 5, 6]);
  const r = buildSourceRowTokenTheilSenSlope(queue, {
    maxPairs: 10,
    generatedAt: GEN,
  });
  assert.equal(r.droppedAbovePairCap, 1);
  assert.equal(r.sources.length, 0);
});

test('builder: applies min-slope-magnitude cohort filter', () => {
  const queue: QueueLine[] = [
    ...mkSeries('flat', [5, 5, 5, 5, 5]), // slope 0
    ...mkSeries('steep', [0, 10, 20, 30, 40]), // slope 10
  ];
  const r = buildSourceRowTokenTheilSenSlope(queue, {
    minSlopeMagnitude: 1,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinSlopeMagnitude, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'steep');
});

test('builder: drops bad hour_start, bad/negative tokens', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 5),
    ql('2026-04-27T00:00:00.000Z', 'a', Number.NaN),
    ql('2026-04-27T00:01:00.000Z', 'a', -3),
    ...mkSeries('a', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenTheilSenSlope(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 5);
});

test('builder: top cap surfaces droppedBelowTopCap', () => {
  const queue: QueueLine[] = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [5, 4, 3, 2, 1]),
    ...mkSeries('c', [2, 4, 6, 8, 10]),
  ];
  const r = buildSourceRowTokenTheilSenSlope(queue, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.sources.length, 2);
});

test('builder: source filter restricts and counts droppedSourceFilter', () => {
  const queue: QueueLine[] = [
    ...mkSeries('keep', [1, 2, 3, 4, 5]),
    ...mkSeries('drop', [9, 9, 9, 9, 9]),
  ];
  const r = buildSourceRowTokenTheilSenSlope(queue, {
    source: 'keep',
    generatedAt: GEN,
  });
  assert.equal(r.droppedSourceFilter, 5);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
});

test('builder: sort=slope-asc puts most negative first', () => {
  const queue: QueueLine[] = [
    ...mkSeries('up', [1, 2, 3, 4, 5]),
    ...mkSeries('downhard', [100, 50, 25, 12, 6]),
    ...mkSeries('downsoft', [10, 9, 8, 7, 6]),
  ];
  const r = buildSourceRowTokenTheilSenSlope(queue, {
    sort: 'slope-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'downhard');
  assert.equal(r.sources[r.sources.length - 1]!.source, 'up');
});

test('builder: naiveSlope matches (last-first)/(n-1)', () => {
  const queue: QueueLine[] = mkSeries('s', [10, 12, 14, 100, 18, 20]);
  const r = buildSourceRowTokenTheilSenSlope(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.firstX, 10);
  assert.equal(row.lastX, 20);
  assert.equal(row.naiveSlope, (20 - 10) / 5);
  // Theil-Sen ignores the 100 outlier — slope stays = 2 (the pristine line slope).
  assert.equal(row.slope, 2);
});

test('builder: empty source name maps to "unknown"', () => {
  const queue: QueueLine[] = mkSeries('', [1, 2, 3, 4]);
  const r = buildSourceRowTokenTheilSenSlope(queue, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('builder: chronological sort respected even when input is shuffled', () => {
  // Shuffled input order, but hour_start says: row 1 first, row 0 second.
  const queue: QueueLine[] = [
    ql('2026-04-27T00:05:00.000Z', 's', 50), // ord 0, ms larger
    ql('2026-04-27T00:01:00.000Z', 's', 10), // ord 1, ms smaller -> first chronologically
    ql('2026-04-27T00:02:00.000Z', 's', 20),
    ql('2026-04-27T00:03:00.000Z', 's', 30),
    ql('2026-04-27T00:04:00.000Z', 's', 40),
  ];
  const r = buildSourceRowTokenTheilSenSlope(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.firstX, 10);
  assert.equal(row.lastX, 50);
  // After chronological sort: [10, 20, 30, 40, 50] -> Theil-Sen slope = 10
  assert.equal(row.slope, 10);
});

test('builder: pairsPositive + pairsNegative + pairsZero == pairsTotal per source', () => {
  const queue: QueueLine[] = [
    ...mkSeries('a', [1, 1, 2, 3, 5, 8]),
    ...mkSeries('b', [3, 1, 4, 1, 5, 9, 2, 6]),
  ];
  const r = buildSourceRowTokenTheilSenSlope(queue, { generatedAt: GEN });
  for (const row of r.sources) {
    assert.equal(
      row.pairsPositive + row.pairsNegative + row.pairsZero,
      row.pairsTotal,
    );
    assert.equal(row.pairsTotal, (row.rowsKept * (row.rowsKept - 1)) / 2);
  }
});

test('builder: report carries echoed options and counters', () => {
  const queue: QueueLine[] = mkSeries('s', [1, 2, 3, 4, 5]);
  const r = buildSourceRowTokenTheilSenSlope(queue, {
    minRows: 4,
    minSlopeMagnitude: 0.5,
    maxPairs: 1000,
    sort: 'rows',
    top: 10,
    generatedAt: GEN,
  });
  assert.equal(r.minRows, 4);
  assert.equal(r.minSlopeMagnitude, 0.5);
  assert.equal(r.maxPairs, 1000);
  assert.equal(r.sort, 'rows');
  assert.equal(r.top, 10);
  assert.equal(r.generatedAt, GEN);
});
