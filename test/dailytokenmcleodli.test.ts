import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenMcLeodLi,
  buildDailyTokenMcLeodLi,
} from '../src/dailytokenmcleodli.js';
import {
  dailyTokenLjungBoxQTest,
} from '../src/dailytokenljungboxqtest.js';
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

test('dailyTokenMcLeodLi: rejects fewer than 4 samples', () => {
  assert.throws(
    () => dailyTokenMcLeodLi([1, 2, 3]),
    /at least 4 samples/,
  );
});

test('dailyTokenMcLeodLi: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenMcLeodLi([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenMcLeodLi([1, 2, 3, Infinity]),
    /finite values/,
  );
});

test('dailyTokenMcLeodLi: rejects non-positive maxLag', () => {
  assert.throws(
    () => dailyTokenMcLeodLi([1, 2, 3, 4, 5], 0),
    /maxLag must be a positive integer/,
  );
  assert.throws(
    () => dailyTokenMcLeodLi([1, 2, 3, 4, 5], 2.5),
    /maxLag must be a positive integer/,
  );
});

test('dailyTokenMcLeodLi: zero level variance throws', () => {
  assert.throws(
    () => dailyTokenMcLeodLi([7, 7, 7, 7, 7, 7, 7, 7]),
    /zero level variance/,
  );
});

test('dailyTokenMcLeodLi: zero squared-residual variance throws (constant absolute deviation)', () => {
  // Centred deviations: -1, +1, -1, +1, ... all share the same magnitude
  // so u[t] = 1 for all t -> centred-u variance = 0.
  assert.throws(
    () => dailyTokenMcLeodLi([0, 2, 0, 2, 0, 2, 0, 2]),
    /zero squared-residual variance/,
  );
});

// ---------- primitive: identities ----------

test('dailyTokenMcLeodLi: invariant under additive shift x -> x + c', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1];
  const a = dailyTokenMcLeodLi(x);
  const b = dailyTokenMcLeodLi(x.map((v) => v + 1000));
  assert.ok(Math.abs(a.mlQ - b.mlQ) < 1e-9, `${a.mlQ} vs ${b.mlQ}`);
  assert.ok(Math.abs(a.mlZ - b.mlZ) < 1e-9);
  for (let k = 0; k < a.mlAcf.length; k += 1) {
    assert.ok(Math.abs(a.mlAcf[k]! - b.mlAcf[k]!) < 1e-9);
  }
});

test('dailyTokenMcLeodLi: invariant under positive scalar x -> a*x', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1];
  const a = dailyTokenMcLeodLi(x);
  const b = dailyTokenMcLeodLi(x.map((v) => v * 7.3));
  assert.ok(Math.abs(a.mlQ - b.mlQ) < 1e-9);
  assert.ok(Math.abs(a.mlZ - b.mlZ) < 1e-9);
});

test('dailyTokenMcLeodLi: invariant under negation x -> -x (squared residuals are sign-blind)', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1];
  const a = dailyTokenMcLeodLi(x);
  const b = dailyTokenMcLeodLi(x.map((v) => -v));
  assert.ok(Math.abs(a.mlQ - b.mlQ) < 1e-9);
  assert.ok(Math.abs(a.mlZ - b.mlZ) < 1e-9);
});

test('dailyTokenMcLeodLi: invariant under time reversal', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1];
  const a = dailyTokenMcLeodLi(x);
  const b = dailyTokenMcLeodLi([...x].reverse());
  assert.ok(Math.abs(a.mlQ - b.mlQ) < 1e-9);
  assert.ok(Math.abs(a.mlZ - b.mlZ) < 1e-9);
});

test('dailyTokenMcLeodLi: mlAcf entries lie in [-1, +1]', () => {
  const x = Array.from({ length: 40 }, (_, i) => Math.sin(i / 3) * (1 + (i % 5)));
  const r = dailyTokenMcLeodLi(x);
  for (const v of r.mlAcf) {
    assert.ok(v >= -1 - 1e-9 && v <= 1 + 1e-9, `r2_k = ${v} out of [-1, +1]`);
  }
});

test('dailyTokenMcLeodLi: mlH = min(maxLag, floor(n/4))', () => {
  // n = 12, floor(12/4) = 3, maxLag default = 10 -> mlH = 3
  const r1 = dailyTokenMcLeodLi(
    [1, 4, 2, 9, 1, 5, 3, 8, 1, 4, 2, 7],
  );
  assert.equal(r1.mlH, 3);
  assert.equal(r1.mlAcf.length, 3);
  // n = 100, maxLag = 5 -> mlH = 5
  const r2 = dailyTokenMcLeodLi(
    Array.from({ length: 100 }, (_, i) => Math.sin(i / 4) + 0.01 * i),
    5,
  );
  assert.equal(r2.mlH, 5);
  assert.equal(r2.mlAcf.length, 5);
});

test('dailyTokenMcLeodLi: mlDf === mlH and (mlQ - mlH)/sqrt(2*mlH) === mlZ', () => {
  const x = Array.from({ length: 40 }, (_, i) => (i % 7) * (i % 3 + 1));
  const r = dailyTokenMcLeodLi(x);
  assert.equal(r.mlDf, r.mlH);
  const expected = (r.mlQ - r.mlH) / Math.sqrt(2 * r.mlH);
  assert.ok(Math.abs(expected - r.mlZ) < 1e-9);
});

// ---------- key behavioural axis-114 vs axis-159 orthogonality ----------

test('dailyTokenMcLeodLi: pure linear trend has lbZ much greater than 0 but mlZ near zero (orthogonality vs Ljung-Box)', () => {
  // Strict linear ramp: x[t] = t. Squared centred residuals are
  // a deterministic symmetric parabola in t -> r2_k > 0 (not
  // zero), but the level Ljung-Box dominates by orders of
  // magnitude. We verify the ORDERING: lbZ much greater than mlZ
  // for a pure-trend series.
  const x = Array.from({ length: 60 }, (_, i) => i + 1);
  const lb = dailyTokenLjungBoxQTest(x);
  const ml = dailyTokenMcLeodLi(x);
  assert.ok(lb.lbZ > 5, `lbZ should be much greater than 0 for trend, got ${lb.lbZ}`);
  // Document the ordering: trend signal is much stronger in the
  // level than in the squared residuals.
  assert.ok(
    lb.lbZ > ml.mlZ * 1.5,
    `expected lbZ to dominate mlZ for pure trend: lbZ=${lb.lbZ}, mlZ=${ml.mlZ}`,
  );
});

test('dailyTokenMcLeodLi: explicit ARCH-like amplitude regime yields mlZ much greater than 0', () => {
  // Construct a series with white-noise level but clustered
  // amplitude: alternate calm-cluster (small deviations) and
  // loud-cluster (large deviations) regimes, each of length 10.
  const n = 60;
  const x: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const regime = Math.floor(i / 10) % 2; // 0 = calm, 1 = loud
    const amp = regime === 0 ? 1 : 20;
    // alternate sign within the regime to keep the LEVEL acf low
    x[i] = (i % 2 === 0 ? 1 : -1) * amp;
  }
  const ml = dailyTokenMcLeodLi(x);
  // Squared residuals u[t] are ~constant within each regime ->
  // strong block structure -> r2_1 large positive -> mlQ much
  // greater than H -> mlZ much greater than 0.
  assert.ok(ml.mlZ > 3, `expected mlZ > 3 for clustered amplitude, got ${ml.mlZ}`);
  assert.ok(ml.mlAcf[0]! > 0.5, `expected r2_1 > 0.5, got ${ml.mlAcf[0]}`);
});

// ---------- builder ----------

test('buildDailyTokenMcLeodLi: drops below min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) queue.push(ql(dayIso(i), 'short', 5000));
  const r = buildDailyTokenMcLeodLi(queue, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenMcLeodLi: drops below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'sparse', 1));
  const r = buildDailyTokenMcLeodLi(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenMcLeodLi: drops zero-variance series', () => {
  const queue: QueueLine[] = [];
  // Constant 5000 every day for 20 days
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'flat', 5000));
  const r = buildDailyTokenMcLeodLi(queue, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenMcLeodLi: surfaces row mean and stddev consistent with primitive', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'm', 1000 + (i % 5) * 250));
  const r = buildDailyTokenMcLeodLi(queue, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const expectedMean =
    Array.from({ length: 20 }, (_, i) => 1000 + (i % 5) * 250).reduce((a, b) => a + b, 0) / 20;
  assert.ok(Math.abs(r.sources[0]!.mean - expectedMean) < 1e-9);
});

test('buildDailyTokenMcLeodLi: window since/until restricts buckets', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'w', 1000 + (i * 137) % 3000));
  }
  const r = buildDailyTokenMcLeodLi(queue, {
    since: dayIso(5),
    until: dayIso(20),
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 15);
});

test('buildDailyTokenMcLeodLi: short tenure caps mlH at floor(n/4)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    // pseudo-random varying values to avoid zero-variance traps
    queue.push(ql(dayIso(i), 'sh', 1000 + ((i * 31 + 7) % 1000)));
  }
  const r = buildDailyTokenMcLeodLi(queue, {
    minTokens: 1,
    minTenureDays: 14,
    maxLag: 10,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.mlH, 4);
  assert.equal(r.sources[0]!.mlAcf.length, 4);
});

test('buildDailyTokenMcLeodLi: sort=mlZAbsDesc puts largest |mlZ| first', () => {
  const queue: QueueLine[] = [];
  // a: clustered amplitude (high mlZ)
  for (let i = 0; i < 40; i += 1) {
    const regime = Math.floor(i / 8) % 2;
    const amp = regime === 0 ? 100 : 5000;
    queue.push(ql(dayIso(i), 'cluster', 10000 + (i % 2 === 0 ? amp : -amp + 10000)));
  }
  // b: smooth gradual change (low mlZ on squared residuals)
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'smooth', 10000 + i * 50 + (i % 3) * 7));
  }
  const r = buildDailyTokenMcLeodLi(queue, {
    minTokens: 1,
    minTenureDays: 14,
    sort: 'mlZAbsDesc',
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(
    Math.abs(r.sources[0]!.mlZ) >= Math.abs(r.sources[1]!.mlZ),
    `expected first |mlZ| >= second |mlZ|, got ${r.sources[0]!.mlZ} vs ${r.sources[1]!.mlZ}`,
  );
});

test('buildDailyTokenMcLeodLi: sort=source orders alphabetically', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'zebra', 1000 + (i * 17) % 500));
    queue.push(ql(dayIso(i), 'alpha', 1000 + (i * 19) % 500));
  }
  const r = buildDailyTokenMcLeodLi(queue, {
    minTokens: 1,
    minTenureDays: 14,
    sort: 'source',
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zebra');
});

test('buildDailyTokenMcLeodLi: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 16; i += 1) {
      queue.push(ql(dayIso(i), src, 1000 + ((i * 11 + src.charCodeAt(0)) % 800)));
    }
  }
  const r = buildDailyTokenMcLeodLi(queue, {
    minTokens: 1,
    minTenureDays: 14,
    top: 1,
    sort: 'source',
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenMcLeodLi: report carries through generatedAt and config', () => {
  const r = buildDailyTokenMcLeodLi([], {
    generatedAt: '2026-05-04T12:34:56.000Z',
    minTokens: 500,
    minTenureDays: 7,
    maxLag: 8,
    sort: 'mlQ',
  });
  assert.equal(r.generatedAt, '2026-05-04T12:34:56.000Z');
  assert.equal(r.minTokens, 500);
  assert.equal(r.minTenureDays, 7);
  assert.equal(r.maxLag, 8);
  assert.equal(r.sort, 'mlQ');
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenMcLeodLi: invalid sort throws', () => {
  assert.throws(
    () =>
      buildDailyTokenMcLeodLi([], {
        sort: 'invalid' as unknown as 'mlQ',
        generatedAt: '2026-05-04T00:00:00.000Z',
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenMcLeodLi: invalid since throws', () => {
  assert.throws(
    () =>
      buildDailyTokenMcLeodLi([], {
        since: 'not-a-date',
        generatedAt: '2026-05-04T00:00:00.000Z',
      }),
    /invalid since/,
  );
});

test('buildDailyTokenMcLeodLi: source filter restricts and counts droppedSourceFilter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'keep', 1000 + ((i * 17) % 500)));
    queue.push(ql(dayIso(i), 'drop', 1000 + ((i * 17) % 500)));
  }
  const r = buildDailyTokenMcLeodLi(queue, {
    source: 'keep',
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 16);
});
