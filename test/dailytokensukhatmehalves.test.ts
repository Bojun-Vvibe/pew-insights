import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenSukhatmeHalves,
  buildDailyTokenSukhatmeHalves,
  pooledMedianSukhatme,
  standardNormalUpperTailSukhatme,
} from '../src/dailytokensukhatmehalves.js';
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

// ---------- primitive: pooledMedianSukhatme ----------

test('pooledMedianSukhatme: odd n returns central value', () => {
  assert.equal(pooledMedianSukhatme([1, 5, 3]), 3);
});

test('pooledMedianSukhatme: even n averages central pair', () => {
  assert.equal(pooledMedianSukhatme([1, 2, 3, 4]), 2.5);
});

test('pooledMedianSukhatme: handles unsorted input', () => {
  assert.equal(pooledMedianSukhatme([7, 2, 9, 4, 1]), 4);
});

test('pooledMedianSukhatme: throws on empty', () => {
  assert.throws(() => pooledMedianSukhatme([]));
});

test('pooledMedianSukhatme: throws on non-finite', () => {
  assert.throws(() => pooledMedianSukhatme([1, 2, Number.NaN]));
});

// ---------- primitive: standardNormalUpperTailSukhatme ----------

test('standardNormalUpperTailSukhatme: Q(0) ~ 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailSukhatme(0) - 0.5) < 1e-7);
});

test('standardNormalUpperTailSukhatme: Q(1.96) ~ 0.025', () => {
  const q = standardNormalUpperTailSukhatme(1.96);
  assert.ok(Math.abs(q - 0.025) < 1e-4, `got ${q}`);
});

test('standardNormalUpperTailSukhatme: Q(-z) = 1 - Q(z)', () => {
  const z = 1.5;
  const qPos = standardNormalUpperTailSukhatme(z);
  const qNeg = standardNormalUpperTailSukhatme(-z);
  assert.ok(Math.abs(qPos + qNeg - 1) < 1e-7);
});

test('standardNormalUpperTailSukhatme: throws on non-finite', () => {
  assert.throws(() => standardNormalUpperTailSukhatme(Number.NaN));
});

// ---------- core: dailyTokenSukhatmeHalves ----------

test('dailyTokenSukhatmeHalves: throws under min length 16', () => {
  assert.throws(() => dailyTokenSukhatmeHalves([1, 2, 3, 4, 5, 6, 7, 8]));
});

test('dailyTokenSukhatmeHalves: throws on non-finite', () => {
  const v = Array.from({ length: 16 }, (_, i) => i + 1);
  v[5] = Number.NaN;
  assert.throws(() => dailyTokenSukhatmeHalves(v));
});

test('dailyTokenSukhatmeHalves: throws on constant input (zero variance)', () => {
  const v = Array.from({ length: 16 }, () => 7);
  assert.throws(() => dailyTokenSukhatmeHalves(v));
});

test('dailyTokenSukhatmeHalves: closed-form null moments at n=20', () => {
  const v = Array.from({ length: 20 }, (_, i) => i + 1);
  const r = dailyTokenSukhatmeHalves(v);
  assert.equal(r.sukhatmeN1, 10);
  assert.equal(r.sukhatmeN2, 10);
  assert.equal(r.sukhatmeExpS, 50);
  // Var = n1 n2 (n+1) / 12 = 10 * 10 * 21 / 12 = 175
  assert.equal(r.sukhatmeVarS, 175);
});

test('dailyTokenSukhatmeHalves: constant-shift invariance', () => {
  const base = [1, 3, 5, 2, 8, 4, 6, 9, 11, 13, 7, 14, 12, 10, 17, 15];
  const a = dailyTokenSukhatmeHalves(base);
  const b = dailyTokenSukhatmeHalves(base.map((v) => v + 1000));
  assert.ok(Math.abs(a.sukhatmeZ - b.sukhatmeZ) < 1e-12);
  assert.equal(a.sukhatmeS, b.sukhatmeS);
});

test('dailyTokenSukhatmeHalves: positive-scale invariance', () => {
  const base = [1, 3, 5, 2, 8, 4, 6, 9, 11, 13, 7, 14, 12, 10, 17, 15];
  const a = dailyTokenSukhatmeHalves(base);
  const b = dailyTokenSukhatmeHalves(base.map((v) => v * 7));
  assert.ok(Math.abs(a.sukhatmeZ - b.sukhatmeZ) < 1e-12);
});

test('dailyTokenSukhatmeHalves: reverse negates Z (n1=n2, no |X-M| ties between halves)', () => {
  // Construct a series with no |X - M| ties between halves
  const base = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  const a = dailyTokenSukhatmeHalves(base);
  const b = dailyTokenSukhatmeHalves(base.slice().reverse());
  // Sukhatme Z should be exactly negated when halves are swapped (no ties).
  assert.ok(
    Math.abs(a.sukhatmeZ + b.sukhatmeZ) < 1e-12,
    `a=${a.sukhatmeZ} b=${b.sukhatmeZ}`,
  );
});

test('dailyTokenSukhatmeHalves: detects second-half dispersion (positive Z)', () => {
  // first half tightly clustered, second half spread out
  const v = [
    100, 101, 99, 100, 102, 98, 101, 100, // first half
    50, 200, 30, 220, 10, 250, 5, 260, // second half (spread)
  ];
  const r = dailyTokenSukhatmeHalves(v);
  assert.ok(r.sukhatmeZ > 0, `expected Z > 0, got ${r.sukhatmeZ}`);
});

test('dailyTokenSukhatmeHalves: detects first-half dispersion (negative Z)', () => {
  const v = [
    50, 200, 30, 220, 10, 250, 5, 260, // first half (spread)
    100, 101, 99, 100, 102, 98, 101, 100, // second half (tight)
  ];
  const r = dailyTokenSukhatmeHalves(v);
  assert.ok(r.sukhatmeZ < 0, `expected Z < 0, got ${r.sukhatmeZ}`);
});

test('dailyTokenSukhatmeHalves: equal halves give Z near 0', () => {
  const v = [
    1, 2, 3, 4, 5, 6, 7, 8,
    1, 2, 3, 4, 5, 6, 7, 8,
  ];
  const r = dailyTokenSukhatmeHalves(v);
  assert.ok(Math.abs(r.sukhatmeZ) < 1.0, `got ${r.sukhatmeZ}`);
  assert.ok(r.sukhatmePValue > 0.3);
});

test('dailyTokenSukhatmeHalves: S in [0, n1*n2]', () => {
  const v = Array.from({ length: 20 }, (_, i) => Math.sin(i) * 100);
  const r = dailyTokenSukhatmeHalves(v);
  assert.ok(r.sukhatmeS >= 0 && r.sukhatmeS <= r.sukhatmeN1 * r.sukhatmeN2);
});

test('dailyTokenSukhatmeHalves: PValue in [0, 1]', () => {
  const v = Array.from({ length: 30 }, (_, i) => i * i);
  const r = dailyTokenSukhatmeHalves(v);
  assert.ok(r.sukhatmePValue >= 0 && r.sukhatmePValue <= 1);
});

test('dailyTokenSukhatmeHalves: deterministic on identical input', () => {
  const v = Array.from({ length: 24 }, (_, i) => i * 13 + 7);
  const a = dailyTokenSukhatmeHalves(v);
  const b = dailyTokenSukhatmeHalves(v.slice());
  assert.deepEqual(a, b);
});

test('dailyTokenSukhatmeHalves: handles all-tied second half', () => {
  // First half varies, second half is constant => |B - M| all equal.
  const v = [
    1, 5, 9, 2, 8, 3, 7, 4,
    100, 100, 100, 100, 100, 100, 100, 100,
  ];
  const r = dailyTokenSukhatmeHalves(v);
  assert.ok(Number.isFinite(r.sukhatmeZ));
  // All B-deviations are equal (constant) => well-defined U-count.
  assert.ok(r.sukhatmeS >= 0 && r.sukhatmeS <= r.sukhatmeN1 * r.sukhatmeN2);
});

// ---------- builder: buildDailyTokenSukhatmeHalves ----------

test('buildDailyTokenSukhatmeHalves: throws on minTenureDays < 16', () => {
  assert.throws(() =>
    buildDailyTokenSukhatmeHalves([], { minTenureDays: 8 }),
  );
});

test('buildDailyTokenSukhatmeHalves: throws on negative minTokens', () => {
  assert.throws(() =>
    buildDailyTokenSukhatmeHalves([], { minTokens: -1 }),
  );
});

test('buildDailyTokenSukhatmeHalves: throws on bad sort key', () => {
  assert.throws(() =>
    buildDailyTokenSukhatmeHalves([], {
      sort: 'bogus' as never,
    }),
  );
});

test('buildDailyTokenSukhatmeHalves: throws on negative top', () => {
  assert.throws(() => buildDailyTokenSukhatmeHalves([], { top: -1 }));
});

test('buildDailyTokenSukhatmeHalves: bad hour_start counted', () => {
  const queue = [ql('not-a-date', 'src-A', 1000)];
  const r = buildDailyTokenSukhatmeHalves(queue);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenSukhatmeHalves: non-positive tokens counted', () => {
  const queue = [ql(dayIso(0), 'src-A', 0), ql(dayIso(1), 'src-A', -5)];
  const r = buildDailyTokenSukhatmeHalves(queue);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenSukhatmeHalves: source filter counted', () => {
  const queue = [ql(dayIso(0), 'src-A', 100), ql(dayIso(0), 'src-B', 100)];
  const r = buildDailyTokenSukhatmeHalves(queue, { source: 'src-A' });
  assert.equal(r.droppedSourceFilter, 1);
});

test('buildDailyTokenSukhatmeHalves: below-min-tenure counted', () => {
  const queue = Array.from({ length: 5 }, (_, i) =>
    ql(dayIso(i), 'src-A', 5000),
  );
  const r = buildDailyTokenSukhatmeHalves(queue);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenSukhatmeHalves: empty queue gives empty rows', () => {
  const r = buildDailyTokenSukhatmeHalves([]);
  assert.deepEqual(r.sources, []);
  assert.equal(r.totalSources, 0);
});

test('buildDailyTokenSukhatmeHalves: end-to-end with two sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src-A', 1000 + i * 10));
    queue.push(ql(dayIso(i), 'src-B', 500 + (i % 5) * 200));
  }
  const r = buildDailyTokenSukhatmeHalves(queue);
  assert.equal(r.sources.length, 2);
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.sukhatmeZ));
    assert.ok(s.sukhatmePValue >= 0 && s.sukhatmePValue <= 1);
    assert.ok(s.sukhatmeS >= 0);
    assert.ok(s.pooledMedian > 0);
  }
});

test('buildDailyTokenSukhatmeHalves: top-cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['src-A', 'src-B', 'src-C']) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), src, 1000 + i));
    }
  }
  const r = buildDailyTokenSukhatmeHalves(queue, { top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});
