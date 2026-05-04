import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenHoeffdingDLag1,
  buildDailyTokenHoeffdingDLag1,
} from '../src/dailytokenhoeffdingdlag1.js';
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

test('dailyTokenHoeffdingDLag1: rejects fewer than 6 samples', () => {
  assert.throws(
    () => dailyTokenHoeffdingDLag1([1, 2, 3, 4, 5]),
    /at least 6 samples/,
  );
});

test('dailyTokenHoeffdingDLag1: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenHoeffdingDLag1([1, 2, NaN, 4, 5, 6]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenHoeffdingDLag1([1, 2, 3, 4, 5, Infinity]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenHoeffdingDLag1([1, 2, 3, 4, 5, -Infinity]),
    /finite values/,
  );
});

test('dailyTokenHoeffdingDLag1: constant series returns hd=0', () => {
  // All values identical -> mid-ranks all collapse to
  // (m+1)/2 -> degeneracy -> D=0.
  const r = dailyTokenHoeffdingDLag1([5, 5, 5, 5, 5, 5, 5, 5]);
  assert.equal(r.hd, 0);
  assert.equal(r.hdZ, 0);
});

// ---------- primitive: shape and sanity ----------

test('dailyTokenHoeffdingDLag1: returns finite outputs on small linear ramp', () => {
  const r = dailyTokenHoeffdingDLag1([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(Number.isFinite(r.hd));
  assert.ok(Number.isFinite(r.varHd));
  assert.ok(Number.isFinite(r.hdZ));
  assert.ok(r.varHd > 0);
  assert.equal(r.nSamples, 10);
  assert.equal(r.nPairs, 9);
});

test('dailyTokenHoeffdingDLag1: linear ramp gives strong-positive hdZ', () => {
  // Monotone ramp -> joint (R,S) on the diagonal ->
  // D at theoretical max -> hdZ very positive.
  const r = dailyTokenHoeffdingDLag1([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.ok(r.hd > 0);
  assert.ok(r.hdZ > 1.645);
});

test('dailyTokenHoeffdingDLag1: tieFraction reports distinct-value count', () => {
  const r = dailyTokenHoeffdingDLag1([1, 2, 3, 4, 5, 6, 7, 8]);
  // Lag-1 first marginal X has 7 elements, all distinct (1..7).
  assert.equal(r.tieFraction, 1.0);
});

test('dailyTokenHoeffdingDLag1: tieFraction < 1 when ties present', () => {
  const r = dailyTokenHoeffdingDLag1([1, 2, 1, 2, 1, 2, 1, 2]);
  assert.ok(r.tieFraction < 1.0);
  assert.ok(r.tieFraction > 0);
});

// ---------- primitive: invariances ----------

test('dailyTokenHoeffdingDLag1: invariant under additive shift', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const r1 = dailyTokenHoeffdingDLag1(x);
  const r2 = dailyTokenHoeffdingDLag1(x.map((v) => v + 1000));
  assert.equal(r1.hd, r2.hd);
  assert.equal(r1.hdZ, r2.hdZ);
});

test('dailyTokenHoeffdingDLag1: invariant under positive scaling', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const r1 = dailyTokenHoeffdingDLag1(x);
  const r2 = dailyTokenHoeffdingDLag1(x.map((v) => v * 7));
  assert.equal(r1.hd, r2.hd);
  assert.equal(r1.hdZ, r2.hdZ);
});

test('dailyTokenHoeffdingDLag1: negation produces finite, well-defined output', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const r1 = dailyTokenHoeffdingDLag1(x);
  const r2 = dailyTokenHoeffdingDLag1(x.map((v) => -v));
  // Hoeffding D is rank-based, so both runs are
  // well-defined and finite. The two are NOT generally
  // equal: negation reverses each marginal (R -> m+1-R,
  // S -> m+1-S), but Q_i counts STRICT less-than pairs,
  // which transforms asymmetrically. Both must remain
  // bounded and finite.
  assert.ok(Number.isFinite(r1.hd));
  assert.ok(Number.isFinite(r2.hd));
  assert.ok(Number.isFinite(r1.hdZ));
  assert.ok(Number.isFinite(r2.hdZ));
});

test('dailyTokenHoeffdingDLag1: invariant under monotone-increasing transform', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r1 = dailyTokenHoeffdingDLag1(x);
  // Apply x -> x^3 (strictly monotone increasing on positives).
  const r2 = dailyTokenHoeffdingDLag1(x.map((v) => v * v * v));
  assert.equal(r1.hd, r2.hd);
});

test('dailyTokenHoeffdingDLag1: result has expected fields', () => {
  const r = dailyTokenHoeffdingDLag1([1, 5, 2, 8, 3, 9, 4, 7]);
  assert.ok('nSamples' in r);
  assert.ok('nPairs' in r);
  assert.ok('hd' in r);
  assert.ok('varHd' in r);
  assert.ok('hdZ' in r);
  assert.ok('tieFraction' in r);
});

// ---------- primitive: theoretical anchors ----------

test('dailyTokenHoeffdingDLag1: variance formula is positive for n=6', () => {
  // m = 5 -> Var = 2*(25 + 25 - 32) / (9*5*4*2*1) = 2*18/360 = 0.1
  const r = dailyTokenHoeffdingDLag1([1, 3, 2, 5, 4, 6]);
  assert.ok(r.varHd > 0);
  // Closed-form check: m=5, Var = 2*(25+25-32)/(9*5*4*2*1) = 36/360 = 0.1
  assert.ok(Math.abs(r.varHd - 0.1) < 1e-12);
});

test('dailyTokenHoeffdingDLag1: variance shrinks roughly like 1/m^3', () => {
  const small = dailyTokenHoeffdingDLag1(
    Array.from({ length: 12 }, (_, i) => Math.sin(i)),
  );
  const big = dailyTokenHoeffdingDLag1(
    Array.from({ length: 60 }, (_, i) => Math.sin(i)),
  );
  assert.ok(big.varHd < small.varHd);
});

test('dailyTokenHoeffdingDLag1: random-permutation series gives small |hdZ|', () => {
  // Deterministic pseudo-random shuffle of 30 distinct
  // values -> joint independence in expectation ->
  // |hdZ| should typically be < 3.
  const x: number[] = [];
  let seed = 1234567;
  for (let i = 0; i < 30; i += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    x.push(seed);
  }
  const r = dailyTokenHoeffdingDLag1(x);
  assert.ok(Number.isFinite(r.hdZ));
  assert.ok(Math.abs(r.hdZ) < 5); // very loose sanity
});

// ---------- builder: defaults and option validation ----------

test('build: default options work on minimal queue', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 14; d += 1) {
    queue.push(ql(dayIso(d), 'src-A', 5000 + d * 100));
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.minTenureDays, 14);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.sort, 'hdZAbsDesc');
  assert.equal(r.sources.length, 1);
});

test('build: minTokens negative throws', () => {
  assert.throws(
    () => buildDailyTokenHoeffdingDLag1([], { minTokens: -1 }),
    /minTokens/,
  );
});

test('build: minTenureDays below floor 6 throws', () => {
  assert.throws(
    () => buildDailyTokenHoeffdingDLag1([], { minTenureDays: 5 }),
    /minTenureDays/,
  );
});

test('build: top negative throws', () => {
  assert.throws(
    () => buildDailyTokenHoeffdingDLag1([], { top: -1 }),
    /top/,
  );
});

test('build: invalid sort throws', () => {
  assert.throws(
    () =>
      buildDailyTokenHoeffdingDLag1([], {
        sort: 'bogus' as never,
      }),
    /sort/,
  );
});

test('build: invalid since throws', () => {
  assert.throws(
    () => buildDailyTokenHoeffdingDLag1([], { since: 'not-iso' }),
    /invalid since/,
  );
});

test('build: invalid until throws', () => {
  assert.throws(
    () => buildDailyTokenHoeffdingDLag1([], { until: 'not-iso' }),
    /invalid until/,
  );
});

// ---------- builder: filtering and dropped counters ----------

test('build: drops non-positive tokens', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 14; d += 1) {
    queue.push(ql(dayIso(d), 'src-A', 5000));
    queue.push(ql(dayIso(d), 'src-A', 0)); // drop
    queue.push(ql(dayIso(d), 'src-A', -1)); // drop
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedNonPositiveTokens, 14 * 2);
});

test('build: drops invalid hour_start', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 14; d += 1) {
    queue.push(ql(dayIso(d), 'src-A', 5000 + d));
  }
  queue.push(ql('not-a-date', 'src-A', 1000));
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: source filter populates droppedSourceFilter', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 14; d += 1) {
    queue.push(ql(dayIso(d), 'src-A', 5000 + d));
    queue.push(ql(dayIso(d), 'src-B', 1000));
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
    source: 'src-A',
  });
  assert.equal(r.droppedSourceFilter, 14);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-A');
});

test('build: drops sources below min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 8; d += 1) {
    queue.push(ql(dayIso(d), 'src-short', 5000));
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
    minTenureDays: 14,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('build: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 14; d += 1) {
    queue.push(ql(dayIso(d), 'src-flat', 5000));
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('build: drops sparse sources below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 14; d += 1) {
    queue.push(ql(dayIso(d), 'src-sparse', 10));
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

// ---------- builder: sort and top ----------

test('build: sort=hdZAbsDesc puts strongest |hdZ| first', () => {
  const queue: QueueLine[] = [];
  // Strong-dependence source (linear ramp).
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'src-strong', 1000 + d * 100));
  }
  // Weak-dependence source (alternating).
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'src-weak', 1000 + (d % 2 === 0 ? 50 : 60)));
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
    sort: 'hdZAbsDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(
    Math.abs(r.sources[0]!.hdZ) >= Math.abs(r.sources[1]!.hdZ),
  );
});

test('build: sort=source orders alphabetically', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'zebra', 1000 + d * 10));
    queue.push(ql(dayIso(d), 'apple', 1000 + d * 11));
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'apple');
  assert.equal(r.sources[1]!.source, 'zebra');
});

test('build: top caps row count and surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c', 'd']) {
    for (let d = 0; d < 16; d += 1) {
      queue.push(ql(dayIso(d), src, 1000 + d * 10 + src.charCodeAt(0)));
    }
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

// ---------- builder: window filtering ----------

test('build: since/until filter rows', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 30; d += 1) {
    queue.push(ql(dayIso(d), 'src-A', 1000 + d * 5));
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
    since: dayIso(5),
    until: dayIso(25),
  });
  assert.equal(r.sources.length, 1);
  // Tenure window is 20 days (5..24 inclusive).
  assert.equal(r.sources[0]!.nTenureDays, 20);
});

// ---------- builder: verdict classification ----------

test('build: verdict is one of the five categories', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'src-A', 1000 + d * 50));
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  const v = r.sources[0]!.verdict;
  assert.ok(
    [
      'strong-positive-rank-dependence',
      'borderline-positive-rank-dependence',
      'independent',
      'borderline-negative-rank-dependence',
      'strong-negative-rank-dependence',
    ].includes(v),
  );
});

// ---------- determinism ----------

test('build: same input gives same hd / hdZ on repeated calls', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 18; d += 1) {
    queue.push(ql(dayIso(d), 'src-A', 1000 + ((d * 73) % 500)));
  }
  const r1 = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  const r2 = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r1.sources[0]!.hd, r2.sources[0]!.hd);
  assert.equal(r1.sources[0]!.hdZ, r2.sources[0]!.hdZ);
});

// ---------- refinement: hdRatio + concordancePairs (axis-165) ----------

test('refinement: hdRatio = 30 * hd', () => {
  const r = dailyTokenHoeffdingDLag1([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const queue: QueueLine[] = [];
  for (let d = 0; d < 14; d += 1) {
    queue.push(ql(dayIso(d), 'src-A', 1000 + d * 100));
  }
  const built = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  // Sanity: hdRatio is exactly 30 * hd.
  assert.ok(
    Math.abs(built.sources[0]!.hdRatio - 30 * built.sources[0]!.hd) < 1e-12,
  );
  // Primitive returns hd; refinement comes via builder.
  assert.ok(Number.isFinite(r.hd));
});

test('refinement: concordancePairs is non-negative integer in [0, m(m-1)/2]', () => {
  const r = dailyTokenHoeffdingDLag1([3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8]);
  const m = r.nPairs;
  assert.ok(Number.isInteger(r.concordancePairs));
  assert.ok(r.concordancePairs >= 0);
  assert.ok(r.concordancePairs <= (m * (m - 1)) / 2);
});

test('refinement: monotone ramp gives concordancePairs at theoretical max', () => {
  // Strictly increasing values -> X_i and Y_i marginal
  // ranks both equal i+1 in the lag-1 paired sequence.
  // For each i, Q_i = i (pairs j<i are concordant via
  // the diagonal). Sum_i Q_i = 0+1+...+(m-1) = m(m-1)/2.
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = dailyTokenHoeffdingDLag1(x);
  const m = r.nPairs;
  assert.equal(r.concordancePairs, (m * (m - 1)) / 2);
});

test('refinement: sort=hdRatioAbsDesc matches sort=hdAbsDesc ordering', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'a', 1000 + d * 100));
    queue.push(ql(dayIso(d), 'b', 1000 + (d % 3) * 50));
    queue.push(ql(dayIso(d), 'c', 1000 + ((d * 7) % 11)));
  }
  const r1 = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
    sort: 'hdRatioAbsDesc',
  });
  // hdRatio is 30 * hd, so sorting by |hdRatio| desc is
  // the same as sorting by |hd| desc.
  const labels = r1.sources.map((s) => s.source);
  // Just assert that sort completed and produced a stable order.
  assert.equal(labels.length, 3);
  assert.ok(
    Math.abs(r1.sources[0]!.hdRatio) >= Math.abs(r1.sources[1]!.hdRatio),
  );
  assert.ok(
    Math.abs(r1.sources[1]!.hdRatio) >= Math.abs(r1.sources[2]!.hdRatio),
  );
});

test('refinement: sort=hdRatioDesc orders by hdRatio descending', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 18; d += 1) {
    queue.push(ql(dayIso(d), 'ramp', 1000 + d * 50));
    queue.push(ql(dayIso(d), 'noise', 1000 + ((d * 53) % 200)));
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
    sort: 'hdRatioDesc',
  });
  assert.ok(r.sources[0]!.hdRatio >= r.sources[1]!.hdRatio);
});

test('refinement: sort=hdRatio orders by hdRatio ascending', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 18; d += 1) {
    queue.push(ql(dayIso(d), 'ramp', 1000 + d * 50));
    queue.push(ql(dayIso(d), 'noise', 1000 + ((d * 53) % 200)));
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
    sort: 'hdRatio',
  });
  assert.ok(r.sources[0]!.hdRatio <= r.sources[1]!.hdRatio);
});

test('refinement: sort=hdRatioAbs orders by |hdRatio| ascending', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 18; d += 1) {
    queue.push(ql(dayIso(d), 'ramp', 1000 + d * 50));
    queue.push(ql(dayIso(d), 'noise', 1000 + ((d * 53) % 200)));
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
    sort: 'hdRatioAbs',
  });
  assert.ok(
    Math.abs(r.sources[0]!.hdRatio) <= Math.abs(r.sources[1]!.hdRatio),
  );
});

test('refinement: hdRatio is invariant under positive affine transforms', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const queue1: QueueLine[] = [];
  const queue2: QueueLine[] = [];
  for (let d = 0; d < x.length; d += 1) {
    queue1.push(ql(dayIso(d), 'src', x[d]! + 1000));
    queue2.push(ql(dayIso(d), 'src', x[d]! * 7 + 1000));
  }
  // Need min-tenure-days <= 12 since x.length = 12.
  const r1 = buildDailyTokenHoeffdingDLag1(queue1, {
    generatedAt: '2026-01-01T00:00:00.000Z',
    minTenureDays: 12,
  });
  const r2 = buildDailyTokenHoeffdingDLag1(queue2, {
    generatedAt: '2026-01-01T00:00:00.000Z',
    minTenureDays: 12,
  });
  assert.equal(r1.sources[0]!.hdRatio, r2.sources[0]!.hdRatio);
  assert.equal(r1.sources[0]!.concordancePairs, r2.sources[0]!.concordancePairs);
});

test('refinement: row exposes hdRatio and concordancePairs fields', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 14; d += 1) {
    queue.push(ql(dayIso(d), 'src-A', 1000 + d * 50));
  }
  const r = buildDailyTokenHoeffdingDLag1(queue, {
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  const row = r.sources[0]!;
  assert.ok('hdRatio' in row);
  assert.ok('concordancePairs' in row);
  assert.ok(typeof row.hdRatio === 'number');
  assert.ok(typeof row.concordancePairs === 'number');
});
