import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wallisMoorePhaseSigns,
  wallisMoorePhaseCount,
  wallisMooreExpectedH,
  wallisMooreVarianceH,
  standardNormalUpperTailWallisMoorePhaseFrequency,
  dailyTokenWallisMoorePhaseFrequency,
  aggregateWallisMoorePhaseFrequency,
  buildDailyTokenWallisMoorePhaseFrequency,
} from '../src/dailytokenwallismoorephasefrequency.ts';
import type { QueueLine } from '../src/types.ts';

// ----- wallisMoorePhaseSigns -----

test('wallisMoorePhaseSigns: monotone up gives all +1', () => {
  assert.deepEqual(wallisMoorePhaseSigns([1, 2, 3, 4, 5]), [1, 1, 1, 1]);
});

test('wallisMoorePhaseSigns: monotone down gives all -1', () => {
  assert.deepEqual(wallisMoorePhaseSigns([5, 4, 3, 2, 1]), [-1, -1, -1, -1]);
});

test('wallisMoorePhaseSigns: ties are skipped', () => {
  assert.deepEqual(wallisMoorePhaseSigns([1, 1, 2, 2, 3]), [1, 1]);
});

test('wallisMoorePhaseSigns: zigzag alternating', () => {
  assert.deepEqual(wallisMoorePhaseSigns([1, 2, 1, 2, 1]), [1, -1, 1, -1]);
});

test('wallisMoorePhaseSigns: empty input', () => {
  assert.deepEqual(wallisMoorePhaseSigns([]), []);
});

test('wallisMoorePhaseSigns: single element', () => {
  assert.deepEqual(wallisMoorePhaseSigns([42]), []);
});

test('wallisMoorePhaseSigns: all-equal sequence is empty', () => {
  assert.deepEqual(wallisMoorePhaseSigns([7, 7, 7, 7]), []);
});

// ----- wallisMoorePhaseCount -----

test('wallisMoorePhaseCount: empty -> 0', () => {
  assert.equal(wallisMoorePhaseCount([]), 0);
});

test('wallisMoorePhaseCount: single-run sign vector -> 0 complete phases', () => {
  assert.equal(wallisMoorePhaseCount([1, 1, 1, 1]), 0);
});

test('wallisMoorePhaseCount: two-run -> 0 complete phases', () => {
  assert.equal(wallisMoorePhaseCount([1, 1, -1, -1]), 0);
});

test('wallisMoorePhaseCount: three-run -> 1 complete phase', () => {
  assert.equal(wallisMoorePhaseCount([1, -1, 1]), 1);
});

test('wallisMoorePhaseCount: zigzag of length 8 sign vec -> 6 complete phases', () => {
  const z = [1, -1, 1, -1, 1, -1, 1, -1];
  assert.equal(wallisMoorePhaseCount(z), 6);
});

// ----- moments -----

test('wallisMooreExpectedH: known values', () => {
  // n=5: (10-7)/3 = 1
  assert.equal(wallisMooreExpectedH(5), 1);
  // n=12: (24-7)/3 = 17/3
  assert.ok(Math.abs(wallisMooreExpectedH(12) - 17 / 3) < 1e-12);
  // n=30: (60-7)/3 = 53/3
  assert.ok(Math.abs(wallisMooreExpectedH(30) - 53 / 3) < 1e-12);
});

test('wallisMooreExpectedH: throws for n < 5', () => {
  assert.throws(() => wallisMooreExpectedH(4));
  assert.throws(() => wallisMooreExpectedH(0));
  assert.throws(() => wallisMooreExpectedH(-1));
});

test('wallisMooreExpectedH: throws for non-integer', () => {
  assert.throws(() => wallisMooreExpectedH(12.5));
});

test('wallisMooreVarianceH: known values', () => {
  // n=5: (80-29)/90 = 51/90
  assert.ok(Math.abs(wallisMooreVarianceH(5) - 51 / 90) < 1e-12);
  // n=12: (192-29)/90 = 163/90
  assert.ok(Math.abs(wallisMooreVarianceH(12) - 163 / 90) < 1e-12);
});

test('wallisMooreVarianceH: throws for n < 5', () => {
  assert.throws(() => wallisMooreVarianceH(3));
});

test('wallisMooreVarianceH: positive for all valid n', () => {
  for (let n = 5; n <= 100; n += 1) {
    assert.ok(wallisMooreVarianceH(n) > 0);
  }
});

// ----- normal tail -----

test('standardNormalUpperTailWallisMoorePhaseFrequency: Q(0) = 0.5', () => {
  assert.ok(
    Math.abs(standardNormalUpperTailWallisMoorePhaseFrequency(0) - 0.5) < 1e-6,
  );
});

test('standardNormalUpperTailWallisMoorePhaseFrequency: Q(1.96) ~ 0.025', () => {
  assert.ok(
    Math.abs(
      standardNormalUpperTailWallisMoorePhaseFrequency(1.96) - 0.025,
    ) < 1e-3,
  );
});

test('standardNormalUpperTailWallisMoorePhaseFrequency: symmetry Q(-z) = 1 - Q(z)', () => {
  for (const z of [0.5, 1.0, 1.5, 2.0, 3.0]) {
    const a = standardNormalUpperTailWallisMoorePhaseFrequency(z);
    const b = standardNormalUpperTailWallisMoorePhaseFrequency(-z);
    assert.ok(Math.abs(a + b - 1) < 1e-7);
  }
});

test('standardNormalUpperTailWallisMoorePhaseFrequency: throws non-finite', () => {
  assert.throws(() =>
    standardNormalUpperTailWallisMoorePhaseFrequency(Number.NaN),
  );
});

// ----- dailyTokenWallisMoorePhaseFrequency -----

test('dailyTokenWallisMoorePhaseFrequency: throws if n < 12', () => {
  assert.throws(() =>
    dailyTokenWallisMoorePhaseFrequency([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  );
});

test('dailyTokenWallisMoorePhaseFrequency: throws on non-finite values', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, Number.NaN];
  assert.throws(() => dailyTokenWallisMoorePhaseFrequency(arr));
});

test('dailyTokenWallisMoorePhaseFrequency: throws on zero variance', () => {
  const arr = new Array(12).fill(7);
  assert.throws(() => dailyTokenWallisMoorePhaseFrequency(arr));
});

test('dailyTokenWallisMoorePhaseFrequency: monotone up gives wmH=0 and very negative wmZ', () => {
  const arr = Array.from({ length: 20 }, (_, i) => i + 1);
  const r = dailyTokenWallisMoorePhaseFrequency(arr);
  assert.equal(r.wmH, 0);
  assert.ok(r.wmZ < -2);
  assert.ok(r.wmPValue < 0.05);
});

test('dailyTokenWallisMoorePhaseFrequency: monotone down gives wmH=0 and very negative wmZ', () => {
  const arr = Array.from({ length: 20 }, (_, i) => 20 - i);
  const r = dailyTokenWallisMoorePhaseFrequency(arr);
  assert.equal(r.wmH, 0);
  assert.ok(r.wmZ < -2);
});

test('dailyTokenWallisMoorePhaseFrequency: perfect zigzag gives many phases and large positive wmZ', () => {
  const arr: number[] = [];
  for (let i = 0; i < 30; i += 1) arr.push(i % 2 === 0 ? 1 : 2);
  const r = dailyTokenWallisMoorePhaseFrequency(arr);
  assert.ok(r.wmH > r.wmHExpected);
  assert.ok(r.wmZ > 2);
});

test('dailyTokenWallisMoorePhaseFrequency: returns finite mean and stddev', () => {
  const arr = Array.from({ length: 20 }, (_, i) => Math.sin(i) + i * 0.1);
  const r = dailyTokenWallisMoorePhaseFrequency(arr);
  assert.ok(Number.isFinite(r.mean));
  assert.ok(Number.isFinite(r.stddev));
  assert.ok(r.stddev > 0);
});

test('dailyTokenWallisMoorePhaseFrequency: nNonTied <= n - 1', () => {
  const arr = Array.from({ length: 20 }, (_, i) => Math.sin(i));
  const r = dailyTokenWallisMoorePhaseFrequency(arr);
  assert.ok(r.nNonTied <= arr.length - 1);
});

test('dailyTokenWallisMoorePhaseFrequency: shift invariance', () => {
  const a = [1, 3, 2, 5, 4, 6, 7, 5, 8, 9, 7, 10, 11, 8];
  const b = a.map((v) => v + 1000);
  const ra = dailyTokenWallisMoorePhaseFrequency(a);
  const rb = dailyTokenWallisMoorePhaseFrequency(b);
  assert.equal(ra.wmH, rb.wmH);
  assert.ok(Math.abs(ra.wmZ - rb.wmZ) < 1e-12);
});

test('dailyTokenWallisMoorePhaseFrequency: positive scale invariance', () => {
  const a = [1, 3, 2, 5, 4, 6, 7, 5, 8, 9, 7, 10, 11, 8];
  const b = a.map((v) => v * 2.5);
  const ra = dailyTokenWallisMoorePhaseFrequency(a);
  const rb = dailyTokenWallisMoorePhaseFrequency(b);
  assert.equal(ra.wmH, rb.wmH);
  assert.ok(Math.abs(ra.wmZ - rb.wmZ) < 1e-12);
});

test('dailyTokenWallisMoorePhaseFrequency: pValue in [0,1]', () => {
  const arr = Array.from({ length: 30 }, (_, i) => Math.cos(i * 0.7));
  const r = dailyTokenWallisMoorePhaseFrequency(arr);
  assert.ok(r.wmPValue >= 0 && r.wmPValue <= 1);
});

test('dailyTokenWallisMoorePhaseFrequency: wmZ matches manual calc on small example', () => {
  // Construct a series with a known phase pattern.
  // Differences: +,+,-,-,+,-,-,+,+,-,+,+,-  (n=14, sign-len=13)
  // Runs: ++ -- + -- ++ - ++ -  -> 8 runs, complete = 6
  const vals = [0, 1, 2, 1, 0, 2, 1, 0, 1, 2, 1, 2, 3, 2];
  const r = dailyTokenWallisMoorePhaseFrequency(vals);
  const eh = (2 * 14 - 7) / 3;
  const vh = (16 * 14 - 29) / 90;
  const expectedZ = (r.wmH - eh) / Math.sqrt(vh);
  assert.ok(Math.abs(r.wmZ - expectedZ) < 1e-12);
});

// ----- aggregateWallisMoorePhaseFrequency -----

test('aggregateWallisMoorePhaseFrequency: empty rows -> rowsUsed 0', () => {
  const a = aggregateWallisMoorePhaseFrequency([]);
  assert.equal(a.rowsUsed, 0);
  assert.equal(a.rowsSkipped, 0);
  assert.equal(a.stoufferZ, 0);
  assert.equal(a.stoufferTwoSidedPValue, 1);
});

test('aggregateWallisMoorePhaseFrequency: single row Stouffer = its own Z', () => {
  const a = aggregateWallisMoorePhaseFrequency([
    { wmZ: 2.5, wmPValue: 0.012, nTenureDays: 20 },
  ]);
  assert.equal(a.rowsUsed, 1);
  assert.ok(Math.abs(a.stoufferZ - 2.5) < 1e-12);
});

test('aggregateWallisMoorePhaseFrequency: skips invalid rows', () => {
  const a = aggregateWallisMoorePhaseFrequency([
    { wmZ: Number.NaN, wmPValue: 0.5, nTenureDays: 20 },
    { wmZ: 1.0, wmPValue: 0.3, nTenureDays: 5 }, // tenure too low
    { wmZ: 1.5, wmPValue: -0.1, nTenureDays: 20 }, // bad p
    { wmZ: 0.5, wmPValue: 0.6, nTenureDays: 20 }, // valid
  ]);
  assert.equal(a.rowsUsed, 1);
  assert.equal(a.rowsSkipped, 3);
  assert.ok(Math.abs(a.stoufferZ - 0.5) < 1e-12);
});

test('aggregateWallisMoorePhaseFrequency: tenure-weighted mean', () => {
  const a = aggregateWallisMoorePhaseFrequency([
    { wmZ: 1.0, wmPValue: 0.3, nTenureDays: 10 },
    { wmZ: 3.0, wmPValue: 0.003, nTenureDays: 30 },
  ]);
  // Both rows pass tenure floor of 12? row 1: 10 < 12 -> skipped.
  // Hmm reconsider - the floor in aggregate is 12. row1 is skipped.
  assert.equal(a.rowsUsed, 1);
  assert.ok(Math.abs(a.tenureWeightedMeanWmZ - 3.0) < 1e-12);
});

test('aggregateWallisMoorePhaseFrequency: Stouffer combines signed Zs', () => {
  // Two rows with wmZ = 1.0 each, n=12 valid -> Stouffer = 2/sqrt(2) = sqrt(2)
  const a = aggregateWallisMoorePhaseFrequency([
    { wmZ: 1.0, wmPValue: 0.3, nTenureDays: 12 },
    { wmZ: 1.0, wmPValue: 0.3, nTenureDays: 12 },
  ]);
  assert.equal(a.rowsUsed, 2);
  assert.ok(Math.abs(a.stoufferZ - Math.sqrt(2)) < 1e-10);
});

// ----- buildDailyTokenWallisMoorePhaseFrequency -----

function makeQueue(perDay: Record<string, number>, source: string): QueueLine[] {
  const out: QueueLine[] = [];
  for (const [day, tt] of Object.entries(perDay)) {
    out.push({
      hour_start: `${day}T00:00:00.000Z`,
      total_tokens: tt,
      source,
    } as QueueLine);
  }
  return out;
}

test('buildDailyTokenWallisMoorePhaseFrequency: empty queue', () => {
  const r = buildDailyTokenWallisMoorePhaseFrequency([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('buildDailyTokenWallisMoorePhaseFrequency: single source ascending series', () => {
  const days: Record<string, number> = {};
  for (let i = 0; i < 20; i += 1) {
    const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
    days[d] = 1000 * (i + 1);
  }
  const queue = makeQueue(days, 'src-a');
  const r = buildDailyTokenWallisMoorePhaseFrequency(queue);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.wmH, 0);
  assert.ok(r.sources[0]!.wmZ < -2);
});

test('buildDailyTokenWallisMoorePhaseFrequency: throws on bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenWallisMoorePhaseFrequency([], { minTokens: -1 }),
  );
});

test('buildDailyTokenWallisMoorePhaseFrequency: throws on minTenureDays < 12', () => {
  assert.throws(() =>
    buildDailyTokenWallisMoorePhaseFrequency([], { minTenureDays: 5 }),
  );
});

test('buildDailyTokenWallisMoorePhaseFrequency: throws on bad sort', () => {
  assert.throws(() =>
    // @ts-expect-error - intentional bad sort
    buildDailyTokenWallisMoorePhaseFrequency([], { sort: 'bogus' }),
  );
});

test('buildDailyTokenWallisMoorePhaseFrequency: drops below min-tenure source', () => {
  const days: Record<string, number> = {};
  for (let i = 0; i < 5; i += 1) {
    const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
    days[d] = 5000;
  }
  const queue = makeQueue(days, 'short');
  const r = buildDailyTokenWallisMoorePhaseFrequency(queue);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenWallisMoorePhaseFrequency: drops sparse source below min-tokens', () => {
  const days: Record<string, number> = {};
  for (let i = 0; i < 20; i += 1) {
    const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
    days[d] = 10;
  }
  const queue = makeQueue(days, 'sparse');
  const r = buildDailyTokenWallisMoorePhaseFrequency(queue, {
    minTokens: 10000,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenWallisMoorePhaseFrequency: zero-variance source dropped', () => {
  const days: Record<string, number> = {};
  for (let i = 0; i < 20; i += 1) {
    const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
    days[d] = 5000;
  }
  const queue = makeQueue(days, 'flat');
  const r = buildDailyTokenWallisMoorePhaseFrequency(queue);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenWallisMoorePhaseFrequency: source filter works', () => {
  const days: Record<string, number> = {};
  for (let i = 0; i < 20; i += 1) {
    const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
    days[d] = 1000 * (i + 1);
  }
  const q1 = makeQueue(days, 'a');
  const q2 = makeQueue(days, 'b');
  const r = buildDailyTokenWallisMoorePhaseFrequency([...q1, ...q2], {
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 20);
});

test('buildDailyTokenWallisMoorePhaseFrequency: top cap works', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    for (let i = 0; i < 20; i += 1) {
      const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
      queue.push({
        hour_start: `${d}T00:00:00.000Z`,
        total_tokens: 1000 * (i + 1) + s,
        source: `src-${s}`,
      } as QueueLine);
    }
  }
  const r = buildDailyTokenWallisMoorePhaseFrequency(queue, { top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenWallisMoorePhaseFrequency: invalid hour_start counted', () => {
  const queue: QueueLine[] = [
    {
      hour_start: 'not-a-date',
      total_tokens: 1000,
      source: 'x',
    } as QueueLine,
  ];
  const r = buildDailyTokenWallisMoorePhaseFrequency(queue);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenWallisMoorePhaseFrequency: non-positive tokens counted', () => {
  const days: Record<string, number> = {};
  for (let i = 0; i < 20; i += 1) {
    const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
    days[d] = 1000 * (i + 1);
  }
  const queue = makeQueue(days, 'src');
  queue.push({
    hour_start: '2024-02-01T00:00:00.000Z',
    total_tokens: 0,
    source: 'src',
  } as QueueLine);
  queue.push({
    hour_start: '2024-02-02T00:00:00.000Z',
    total_tokens: -5,
    source: 'src',
  } as QueueLine);
  const r = buildDailyTokenWallisMoorePhaseFrequency(queue);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenWallisMoorePhaseFrequency: report has all required fields', () => {
  const days: Record<string, number> = {};
  for (let i = 0; i < 20; i += 1) {
    const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
    days[d] = 1000 + i * 50 + (i % 3) * 100;
  }
  const queue = makeQueue(days, 'src');
  const r = buildDailyTokenWallisMoorePhaseFrequency(queue, {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2026-05-05T00:00:00.000Z');
  assert.equal(r.minTokens, 1000);
  assert.equal(r.minTenureDays, 12);
  assert.equal(r.sort, 'wmZAbsDesc');
  assert.ok(r.sources.length === 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src');
  assert.ok(Number.isInteger(row.wmH));
  assert.ok(Number.isFinite(row.wmZ));
  assert.ok(row.wmPValue >= 0 && row.wmPValue <= 1);
});

test('buildDailyTokenWallisMoorePhaseFrequency: deterministic', () => {
  const days: Record<string, number> = {};
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
    days[d] = 1000 + Math.floor(Math.sin(i) * 500 + 500);
  }
  const queue = makeQueue(days, 'src');
  const r1 = buildDailyTokenWallisMoorePhaseFrequency(queue, {
    generatedAt: 'fixed',
  });
  const r2 = buildDailyTokenWallisMoorePhaseFrequency(queue, {
    generatedAt: 'fixed',
  });
  assert.deepEqual(r1, r2);
});
