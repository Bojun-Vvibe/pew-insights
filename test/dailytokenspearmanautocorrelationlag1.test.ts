import test from 'node:test';
import assert from 'node:assert/strict';
import {
  midranks,
  dailyTokenSpearmanAutocorrelationLag1,
  buildDailyTokenSpearmanAutocorrelationLag1,
} from '../src/dailytokenspearmanautocorrelationlag1.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return { hour_start, source, total_tokens } as unknown as QueueLine;
}

function dayIso(i: number): string {
  return (
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z'
  );
}

// ---------- midranks helper ----------

test('midranks: empty input returns empty ranks and zero ties', () => {
  const { ranks, nTies } = midranks([]);
  assert.deepEqual(ranks, []);
  assert.equal(nTies, 0);
});

test('midranks: distinct values give 1..n', () => {
  const { ranks, nTies } = midranks([10, 30, 20]);
  assert.deepEqual(ranks, [1, 3, 2]);
  assert.equal(nTies, 0);
});

test('midranks: ties get averaged rank, nTies counts pairs', () => {
  const { ranks, nTies } = midranks([10, 20, 20, 30]);
  assert.deepEqual(ranks, [1, 2.5, 2.5, 4]);
  // one tied group of size 2 -> binomial(2,2) = 1
  assert.equal(nTies, 1);
});

test('midranks: triple tie averages to (i+1+j)/2', () => {
  const { ranks, nTies } = midranks([5, 5, 5, 9]);
  // first three are tied, ranks 1,2,3 -> average 2; last is rank 4
  assert.deepEqual(ranks, [2, 2, 2, 4]);
  // group of size 3 -> 3 choose 2 = 3
  assert.equal(nTies, 3);
});

test('midranks: all tied -> all rank (n+1)/2, nTies = n*(n-1)/2', () => {
  const { ranks, nTies } = midranks([7, 7, 7, 7]);
  assert.deepEqual(ranks, [2.5, 2.5, 2.5, 2.5]);
  assert.equal(nTies, 6);
});

// ---------- primitive ----------

test('dailyTokenSpearmanAutocorrelationLag1: rejects fewer than 3 samples', () => {
  assert.throws(
    () => dailyTokenSpearmanAutocorrelationLag1([5, 6]),
    /at least 3 samples/,
  );
});

test('dailyTokenSpearmanAutocorrelationLag1: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenSpearmanAutocorrelationLag1([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenSpearmanAutocorrelationLag1([1, Infinity, 3]),
    /finite values/,
  );
});

test('dailyTokenSpearmanAutocorrelationLag1: strictly monotone increasing -> rs1 = +1', () => {
  const r = dailyTokenSpearmanAutocorrelationLag1([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(Math.abs(r.rs1 - 1) < 1e-12, `expected rs1 ~ 1, got ${r.rs1}`);
  assert.equal(r.nPairs, 7);
  assert.equal(r.nTiesU, 0);
  assert.equal(r.nTiesV, 0);
});

test('dailyTokenSpearmanAutocorrelationLag1: strictly monotone decreasing -> rs1 = +1', () => {
  // Both u-rank and v-rank decrease in lockstep so the
  // Pearson correlation of the ranks is +1.
  const r = dailyTokenSpearmanAutocorrelationLag1([10, 9, 8, 7, 6, 5]);
  assert.ok(Math.abs(r.rs1 - 1) < 1e-12, `expected rs1 ~ 1, got ${r.rs1}`);
});

test('dailyTokenSpearmanAutocorrelationLag1: rank-invariant under monotone transform', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  // monotone transforms: log(x+1), x^2 (positive monotone on positives, but
  // ties may move — instead use x*7+11 which is strictly monotone on integers)
  const xLin = x.map((v) => v * 7 + 11);
  const r1 = dailyTokenSpearmanAutocorrelationLag1(x);
  const r2 = dailyTokenSpearmanAutocorrelationLag1(xLin);
  assert.ok(
    Math.abs(r1.rs1 - r2.rs1) < 1e-12,
    `rs1 should be invariant under affine monotone transform: ${r1.rs1} vs ${r2.rs1}`,
  );
});

test('dailyTokenSpearmanAutocorrelationLag1: strict 2-cycle gives rs1 < 0 (anti-persistence)', () => {
  const x = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  const r = dailyTokenSpearmanAutocorrelationLag1(x);
  assert.ok(r.rs1 < 0, `expected anti-persistence rs1 < 0, got ${r.rs1}`);
  // For exact 2-cycle of length n=12, u and v are perfectly anti-correlated
  // in their values but ties dominate (only two distinct values) so rs1 -> -1.
  assert.ok(
    Math.abs(r.rs1 - -1) < 1e-12,
    `expected rs1 ~ -1 for exact 2-cycle, got ${r.rs1}`,
  );
});

test('dailyTokenSpearmanAutocorrelationLag1: constant series throws zero-variance', () => {
  assert.throws(
    () => dailyTokenSpearmanAutocorrelationLag1([7, 7, 7, 7, 7]),
    /zero-variance rank vector/,
  );
});

test('dailyTokenSpearmanAutocorrelationLag1: rs1Z = rs1 * sqrt(n-2)', () => {
  const r = dailyTokenSpearmanAutocorrelationLag1([1, 2, 3, 4, 5]);
  assert.ok(
    Math.abs(r.rs1Z - 1 * Math.sqrt(3)) < 1e-12,
    `expected rs1Z = sqrt(3), got ${r.rs1Z}`,
  );
});

test('dailyTokenSpearmanAutocorrelationLag1: surfaces tie counts on ties in u/v', () => {
  // x = [5, 5, 9, 9, 12]
  // u = [5, 5, 9, 9]   ties: 1 (one tied pair) + 1 (another) = 2
  // v = [5, 9, 9, 12]  ties: 1
  const r = dailyTokenSpearmanAutocorrelationLag1([5, 5, 9, 9, 12]);
  assert.equal(r.nTiesU, 2);
  assert.equal(r.nTiesV, 1);
});

// ---------- builder ----------

test('buildDailyTokenSpearmanAutocorrelationLag1: validates options', () => {
  assert.throws(
    () =>
      buildDailyTokenSpearmanAutocorrelationLag1([], {
        minTokens: -1,
      }),
    /minTokens must be a non-negative finite number/,
  );
  assert.throws(
    () =>
      buildDailyTokenSpearmanAutocorrelationLag1([], {
        minTenureDays: 3,
      }),
    /minTenureDays must be an integer >= 4/,
  );
  assert.throws(
    () =>
      buildDailyTokenSpearmanAutocorrelationLag1([], {
        top: -1,
      }),
    /top must be a non-negative integer/,
  );
  assert.throws(
    () =>
      buildDailyTokenSpearmanAutocorrelationLag1([], {
        // @ts-expect-error invalid sort key
        sort: 'bogus',
      }),
    /sort must be one of/,
  );
  assert.throws(
    () =>
      buildDailyTokenSpearmanAutocorrelationLag1([], {
        since: 'not-a-date',
      }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenSpearmanAutocorrelationLag1([], {
        until: 'not-a-date',
      }),
    /invalid until/,
  );
});

test('buildDailyTokenSpearmanAutocorrelationLag1: drops invalid hour_start and non-positive tokens', () => {
  const queue: QueueLine[] = [
    ql('not-iso', 'src-a', 1000),
    ql(dayIso(0), 'src-a', 0),
    ql(dayIso(1), 'src-a', -5),
    ql(dayIso(2), 'src-a', NaN as unknown as number),
  ];
  const r = buildDailyTokenSpearmanAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 3);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenSpearmanAutocorrelationLag1: monotone-up source has rs1 ~ +1', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'climb', 100 + 50 * i));
  }
  const r = buildDailyTokenSpearmanAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'climb');
  assert.equal(s.nTenureDays, 16);
  assert.equal(s.nPairs, 15);
  assert.ok(Math.abs(s.rs1 - 1) < 1e-12, `expected rs1 ~ 1, got ${s.rs1}`);
  assert.ok(s.rs1Z > 0);
});

test('buildDailyTokenSpearmanAutocorrelationLag1: gap-fills missing days as zero', () => {
  // Days 0, 5, 10 active; gap-filled tenure = 11 days, mostly zero.
  const queue: QueueLine[] = [
    ql(dayIso(0), 'sparse', 1000),
    ql(dayIso(5), 'sparse', 2000),
    ql(dayIso(10), 'sparse', 3000),
  ];
  const r = buildDailyTokenSpearmanAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.nTenureDays, 11);
  assert.equal(s.nActiveDays, 3);
  // Zero-padding creates a long tied group, both u and v have many tied
  // ranks; nTiesU and nTiesV should be > 0.
  assert.ok(s.nTiesU > 0);
  assert.ok(s.nTiesV > 0);
  // rs1 should be finite and well-defined (not NaN). The exact sign with
  // heavy tie blocks depends on tie placement; just assert it stays in
  // [-1, +1] and is reproducible.
  assert.ok(Number.isFinite(s.rs1));
  assert.ok(s.rs1 >= -1 && s.rs1 <= 1, `rs1 must be in [-1, 1], got ${s.rs1}`);
});

test('buildDailyTokenSpearmanAutocorrelationLag1: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 500));
  }
  const r = buildDailyTokenSpearmanAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenSpearmanAutocorrelationLag1: drops below-min-tenure sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'short', 1000 + i * 10));
  }
  const r = buildDailyTokenSpearmanAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenSpearmanAutocorrelationLag1: source filter restricts and counts dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'keep', 1000 + i * 10));
    queue.push(ql(dayIso(i), 'drop', 500 + i * 5));
  }
  const r = buildDailyTokenSpearmanAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 8);
});

test('buildDailyTokenSpearmanAutocorrelationLag1: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  const sources = ['a', 'b', 'c'];
  for (const src of sources) {
    for (let i = 0; i < 8; i += 1) {
      queue.push(ql(dayIso(i), src, 1000 + i * 100 + src.charCodeAt(0)));
    }
  }
  const r = buildDailyTokenSpearmanAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenSpearmanAutocorrelationLag1: deterministic given identical input', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'det', 100 * Math.sin(i) + 1000));
  }
  const r1 = buildDailyTokenSpearmanAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  const r2 = buildDailyTokenSpearmanAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.deepEqual(r1, r2);
});
