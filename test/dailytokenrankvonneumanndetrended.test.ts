import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenRankVonNeumannDetrended,
  buildDailyTokenRankVonNeumannDetrended,
} from '../src/dailytokenrankvonneumanndetrended.js';
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

// ---------- primitive: input validation ----------

test('dailyTokenRankVonNeumannDetrended: rejects fewer than 4 samples', () => {
  assert.throws(
    () => dailyTokenRankVonNeumannDetrended([1, 2, 3]),
    /at least 4 samples/,
  );
});

test('dailyTokenRankVonNeumannDetrended: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenRankVonNeumannDetrended([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenRankVonNeumannDetrended([1, 2, 3, Infinity]),
    /finite values/,
  );
});

test('dailyTokenRankVonNeumannDetrended: zero level variance throws', () => {
  assert.throws(
    () => dailyTokenRankVonNeumannDetrended([7, 7, 7, 7, 7, 7, 7, 7]),
    /zero level variance/,
  );
});

test('dailyTokenRankVonNeumannDetrended: perfect linear ramp throws (zero residual variance)', () => {
  const x = Array.from({ length: 12 }, (_, t) => 100 + 5 * t);
  assert.throws(
    () => dailyTokenRankVonNeumannDetrended(x),
    /zero residual variance/,
  );
});

// ---------- primitive: identities ----------

test('dailyTokenRankVonNeumannDetrended: invariant under additive shift x -> x + c', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12];
  const a = dailyTokenRankVonNeumannDetrended(x);
  const b = dailyTokenRankVonNeumannDetrended(x.map((v) => v + 1000));
  assert.ok(Math.abs(a.rvn - b.rvn) < 1e-10);
  assert.ok(Math.abs(a.bvnZ - b.bvnZ) < 1e-10);
});

test('dailyTokenRankVonNeumannDetrended: invariant under positive scalar x -> a*x', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12];
  const a = dailyTokenRankVonNeumannDetrended(x);
  const b = dailyTokenRankVonNeumannDetrended(x.map((v) => v * 7.5));
  assert.ok(Math.abs(a.rvn - b.rvn) < 1e-10);
  assert.ok(Math.abs(a.bvnZ - b.bvnZ) < 1e-10);
  assert.ok(Math.abs(b.trendSlope / a.trendSlope - 7.5) < 1e-8);
});

test('dailyTokenRankVonNeumannDetrended: invariant under sign flip x -> -x (rank reversal)', () => {
  // Negating residuals reverses the rank order:
  // R'[t] = n + 1 - R[t]. Squared consecutive differences and
  // squared deviations from Rbar are preserved.
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12];
  const a = dailyTokenRankVonNeumannDetrended(x);
  const b = dailyTokenRankVonNeumannDetrended(x.map((v) => -v));
  assert.ok(Math.abs(a.rvn - b.rvn) < 1e-10);
  assert.ok(Math.abs(a.bvnZ - b.bvnZ) < 1e-10);
});

// ---------- primitive: closed-form anchors ----------

test('dailyTokenRankVonNeumannDetrended: bvnZ === (rvn - 2)/sqrt(varRvn) exactly', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12, 5, 8, 3, 9];
  const r = dailyTokenRankVonNeumannDetrended(x);
  const expected = (r.rvn - 2) / Math.sqrt(r.varRvn);
  assert.ok(Math.abs(r.bvnZ - expected) < 1e-12);
});

test('dailyTokenRankVonNeumannDetrended: Var[RVN] matches Bartels closed-form', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12];
  const r = dailyTokenRankVonNeumannDetrended(x);
  const n = r.nSamples;
  const expectedVar =
    (4 * (n - 2) * (5 * n * n - 2 * n - 9)) /
    (5 * n * (n + 1) * (n - 1) * (n - 1));
  assert.ok(Math.abs(r.varRvn - expectedVar) < 1e-14);
});

test('dailyTokenRankVonNeumannDetrended: alternating residuals -> rvn > 2 (negative rank-autocorr)', () => {
  // No trend, alternating large jumps: residuals = +1, -1, +1, -1...
  // Ranks alternate between extremes -> large consecutive diffs -> rvn > 2.
  const n = 20;
  const x = Array.from({ length: n }, (_, t) => (t % 2 === 0 ? 1 : -1));
  const r = dailyTokenRankVonNeumannDetrended(x);
  assert.ok(r.rvn > 2.5, `expected rvn > 2.5 for alternating, got ${r.rvn}`);
  assert.ok(r.bvnZ > 1.5, `expected bvnZ > 1.5, got ${r.bvnZ}`);
});

test('dailyTokenRankVonNeumannDetrended: clustered residuals (step) -> rvn < 2 (positive rank-autocorr)', () => {
  // Step function: first half low, second half high.
  // Detrended residuals have most negative ranks at start, most
  // positive at end (with a smaller dip from S-shape) -> small
  // consecutive rank diffs -> rvn < 2.
  const n = 20;
  const x = Array.from({ length: n }, (_, t) => (t < n / 2 ? 0 : 100));
  const r = dailyTokenRankVonNeumannDetrended(x);
  assert.ok(r.rvn < 2, `expected rvn < 2 for step, got ${r.rvn}`);
  assert.ok(r.bvnZ < -1.5, `expected bvnZ < -1.5 (positive rank-autocorr), got ${r.bvnZ}`);
});

test('dailyTokenRankVonNeumannDetrended: detrending removes monotone trend (cf. axis-112 raw Bartels)', () => {
  // Pure linear ramp + alternating noise: axis-112 (raw Bartels) sees
  // an essentially monotone rank sequence (1, 2, 3, ..., n) and
  // bvnZ is strongly negative. THIS axis, after detrend, sees the
  // alternating noise residuals -> rvn > 2, bvnZ > 0.
  const n = 30;
  const x = Array.from(
    { length: n },
    (_, t) => 100 * t + (t % 2 === 0 ? 1 : -1),
  );
  const r = dailyTokenRankVonNeumannDetrended(x);
  assert.ok(
    r.bvnZ > 1.5,
    `expected bvnZ > 1.5 after detrend (anti-clustering), got ${r.bvnZ}`,
  );
});

test('dailyTokenRankVonNeumannDetrended: tieFraction == 1 for all-distinct residuals', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12, 5, 8, 3, 9];
  const r = dailyTokenRankVonNeumannDetrended(x);
  // Residuals from this sequence are unlikely to tie exactly under
  // OLS with floating point arithmetic; expect tieFraction == 1.
  assert.equal(r.tieFraction, 1.0);
});

// ---------- builder: filtering / aggregation ----------

test('buildDailyTokenRankVonNeumannDetrended: empty queue -> zero rows', () => {
  const r = buildDailyTokenRankVonNeumannDetrended([]);
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenRankVonNeumannDetrended: drops source with tenure < min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'shorty', 5000));
  }
  const r = buildDailyTokenRankVonNeumannDetrended(queue, { minTenureDays: 14 });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenRankVonNeumannDetrended: drops source with total_tokens < min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'sparse', 10));
  }
  const r = buildDailyTokenRankVonNeumannDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenRankVonNeumannDetrended: alternating-residual source surfaces strong-negative-rank-autocorr', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const v = i % 2 === 0 ? 200_000 : 100_000;
    queue.push(ql(dayIso(i), 'alt', v));
  }
  const r = buildDailyTokenRankVonNeumannDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'bvnZAbsDesc',
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'alt');
  assert.ok(
    s.verdict === 'strong-negative-rank-autocorr',
    `expected strong-negative-rank-autocorr, got ${s.verdict} (bvnZ=${s.bvnZ})`,
  );
});

test('buildDailyTokenRankVonNeumannDetrended: clustered-residual source surfaces positive-rank-autocorr', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const v = i < 15 ? 50_000 : 250_000;
    queue.push(ql(dayIso(i), 'clust', v));
  }
  const r = buildDailyTokenRankVonNeumannDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'bvnZAbsDesc',
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.ok(
    s.verdict === 'strong-positive-rank-autocorr' ||
      s.verdict === 'borderline-positive-rank-autocorr',
    `expected positive-rank-autocorr verdict, got ${s.verdict} (bvnZ=${s.bvnZ})`,
  );
});

test('buildDailyTokenRankVonNeumannDetrended: respects sort=source (alphabetical)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'b-src', i % 2 === 0 ? 200_000 : 100_000));
    queue.push(ql(dayIso(i), 'a-src', i % 2 === 0 ? 100_000 : 200_000));
  }
  const r = buildDailyTokenRankVonNeumannDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'a-src');
  assert.equal(r.sources[1]!.source, 'b-src');
});

test('buildDailyTokenRankVonNeumannDetrended: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'a', i % 2 === 0 ? 100_000 : 200_000));
    queue.push(ql(dayIso(i), 'b', i % 2 === 0 ? 200_000 : 100_000));
    queue.push(ql(dayIso(i), 'c', i % 2 === 0 ? 150_000 : 50_000));
  }
  const r = buildDailyTokenRankVonNeumannDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    top: 2,
  });
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources.length, 2);
});

test('buildDailyTokenRankVonNeumannDetrended: invalid sort throws', () => {
  assert.throws(
    () =>
      buildDailyTokenRankVonNeumannDetrended([], {
        sort: 'nonsense' as unknown as 'bvnZ',
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenRankVonNeumannDetrended: invalid min-tenure-days throws', () => {
  assert.throws(
    () => buildDailyTokenRankVonNeumannDetrended([], { minTenureDays: 3 }),
    /minTenureDays must be an integer >= 4/,
  );
});

test('buildDailyTokenRankVonNeumannDetrended: sort=rvn orders ascending', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'alt', i % 2 === 0 ? 200_000 : 100_000));
    queue.push(ql(dayIso(i), 'clust', i < 15 ? 50_000 : 250_000));
  }
  const r = buildDailyTokenRankVonNeumannDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'rvn',
  });
  assert.equal(r.sources.length, 2);
  // 'clust' has rvn < 2, 'alt' has rvn > 2 -> ascending puts clust first.
  assert.equal(r.sources[0]!.source, 'clust');
  assert.equal(r.sources[1]!.source, 'alt');
});

test('buildDailyTokenRankVonNeumannDetrended: tieFraction reported per source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'alt', i % 2 === 0 ? 200_000 : 100_000));
  }
  const r = buildDailyTokenRankVonNeumannDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
  });
  const s = r.sources[0]!;
  assert.ok(s.tieFraction > 0 && s.tieFraction <= 1);
});
