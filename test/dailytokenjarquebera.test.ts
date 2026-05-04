import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenJarqueBera,
  buildDailyTokenJarqueBera,
} from '../src/dailytokenjarquebera.js';
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

test('dailyTokenJarqueBera: rejects fewer than 4 samples', () => {
  assert.throws(
    () => dailyTokenJarqueBera([1, 2, 3]),
    /at least 4 samples/,
  );
});

test('dailyTokenJarqueBera: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenJarqueBera([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenJarqueBera([1, 2, 3, Infinity]),
    /finite values/,
  );
});

test('dailyTokenJarqueBera: zero level variance throws', () => {
  assert.throws(
    () => dailyTokenJarqueBera([7, 7, 7, 7, 7, 7, 7, 7]),
    /zero level variance/,
  );
});

// ---------- primitive: identities ----------

test('dailyTokenJarqueBera: invariant under additive shift x -> x + c', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1];
  const a = dailyTokenJarqueBera(x);
  const b = dailyTokenJarqueBera(x.map((v) => v + 1000));
  assert.ok(Math.abs(a.jb - b.jb) < 1e-8);
  assert.ok(Math.abs(a.skewness - b.skewness) < 1e-8);
  assert.ok(Math.abs(a.excessKurtosis - b.excessKurtosis) < 1e-8);
});

test('dailyTokenJarqueBera: invariant under positive scalar x -> a*x', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1];
  const a = dailyTokenJarqueBera(x);
  const b = dailyTokenJarqueBera(x.map((v) => v * 7.5));
  assert.ok(Math.abs(a.jb - b.jb) < 1e-8);
  assert.ok(Math.abs(a.skewness - b.skewness) < 1e-8);
  assert.ok(Math.abs(a.excessKurtosis - b.excessKurtosis) < 1e-8);
});

test('dailyTokenJarqueBera: invariant under sign flip x -> -x for KURTOSIS, skew flips sign', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1];
  const a = dailyTokenJarqueBera(x);
  const b = dailyTokenJarqueBera(x.map((v) => -v));
  assert.ok(Math.abs(a.excessKurtosis - b.excessKurtosis) < 1e-8);
  assert.ok(Math.abs(a.skewness + b.skewness) < 1e-8);
  // jb depends on S^2 so unchanged
  assert.ok(Math.abs(a.jb - b.jb) < 1e-8);
});

test('dailyTokenJarqueBera: time-reversal invariant (permutation-invariant)', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1];
  const a = dailyTokenJarqueBera(x);
  const b = dailyTokenJarqueBera([...x].reverse());
  assert.ok(Math.abs(a.jb - b.jb) < 1e-12);
  assert.ok(Math.abs(a.skewness - b.skewness) < 1e-12);
  assert.ok(Math.abs(a.excessKurtosis - b.excessKurtosis) < 1e-12);
});

test('dailyTokenJarqueBera: full permutation invariance (any reordering)', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1];
  const a = dailyTokenJarqueBera(x);
  const shuffled = [11, 2, 1, 8, 4, 5, 6, 13, 9, 3, 5, 7, 1, 2, 4, 8];
  const b = dailyTokenJarqueBera(shuffled);
  assert.ok(Math.abs(a.jb - b.jb) < 1e-10);
  assert.ok(Math.abs(a.skewness - b.skewness) < 1e-10);
  assert.ok(Math.abs(a.excessKurtosis - b.excessKurtosis) < 1e-10);
});

// ---------- primitive: closed-form anchors ----------

test('dailyTokenJarqueBera: jbZ === (jb - 2) / 2 exactly', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1];
  const r = dailyTokenJarqueBera(x);
  assert.ok(Math.abs(r.jbZ - (r.jb - 2) / 2) < 1e-12);
});

test('dailyTokenJarqueBera: jbPApprox === exp(-jb / 2)', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1];
  const r = dailyTokenJarqueBera(x);
  assert.ok(Math.abs(r.jbPApprox - Math.exp(-r.jb / 2)) < 1e-15);
  assert.ok(r.jbPApprox >= 0 && r.jbPApprox <= 1);
});

test('dailyTokenJarqueBera: two-point alternating {-1,+1} gives JB === n/6', () => {
  // x = [-1, 1, -1, 1, ...] : mean 0, m2 = 1, m3 = 0, m4 = 1
  // S = 0, K = 1/1 - 3 = -2, JB = (n/6)(0 + 4/4) = n/6
  const n = 24;
  const x: number[] = [];
  for (let i = 0; i < n; i += 1) x.push(i % 2 === 0 ? -1 : 1);
  const r = dailyTokenJarqueBera(x);
  assert.ok(Math.abs(r.skewness) < 1e-10);
  assert.ok(Math.abs(r.excessKurtosis - -2) < 1e-10);
  assert.ok(Math.abs(r.jb - n / 6) < 1e-10);
});

test('dailyTokenJarqueBera: two-point alternating {a,b} (any a<b) gives same JB===n/6', () => {
  // Scale invariance check on the closed-form anchor.
  const n = 16;
  const x: number[] = [];
  for (let i = 0; i < n; i += 1) x.push(i % 2 === 0 ? 3 : 17);
  const r = dailyTokenJarqueBera(x);
  assert.ok(Math.abs(r.skewness) < 1e-10);
  assert.ok(Math.abs(r.excessKurtosis - -2) < 1e-10);
  assert.ok(Math.abs(r.jb - n / 6) < 1e-10);
});

test('dailyTokenJarqueBera: symmetric distribution has near-zero skew', () => {
  // Truly symmetric: each value paired with its mirror around the mean (3).
  // Even number of values, exactly mirror-symmetric -> S = 0 by construction.
  const x = [1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 1, 5, 5, 1, 2, 4, 4, 2, 3, 3];
  const r = dailyTokenJarqueBera(x);
  assert.ok(Math.abs(r.skewness) < 1e-10);
});

test('dailyTokenJarqueBera: outlier injection raises jb (skew + nonzero kurt deviation)', () => {
  // Otherwise-symmetric Gaussian-ish base, then inject one extreme outlier.
  const base = [
    -3, -2, -2, -1, -1, -1, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3,
  ];
  const r1 = dailyTokenJarqueBera(base);
  const withOutlier = [...base, 50];
  const r2 = dailyTokenJarqueBera(withOutlier);
  assert.ok(r2.jb > r1.jb);
  assert.ok(r2.skewness > r1.skewness);
});

test('dailyTokenJarqueBera: pApprox monotone-decreasing in jb', () => {
  const x1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  const x2 = [...x1.slice(0, 15), 1000];
  const r1 = dailyTokenJarqueBera(x1);
  const r2 = dailyTokenJarqueBera(x2);
  assert.ok(r2.jb > r1.jb);
  assert.ok(r2.jbPApprox < r1.jbPApprox);
});

// ---------- builder: pipeline filters ----------

test('buildDailyTokenJarqueBera: drops sparse + below-tenure sources', () => {
  const queue: QueueLine[] = [];
  // sparse source
  queue.push(ql(dayIso(0), 'sparse', 100));
  // tenure 5 days source (below default 14)
  for (let i = 0; i < 5; i += 1) queue.push(ql(dayIso(10 + i), 'short', 5000));
  // long-tenure source over 30 days
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(50 + i), 'long', 1000 + i * 7));
  }
  const r = buildDailyTokenJarqueBera(queue, {
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'long');
  assert.equal(r.sources[0]!.nTenureDays, 30);
});

test('buildDailyTokenJarqueBera: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'flat', 1000));
  const r = buildDailyTokenJarqueBera(queue, {});
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenJarqueBera: defaults to jbDesc sort', () => {
  const queue: QueueLine[] = [];
  // src A: highly skewed (one big spike)
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'A', i === 10 ? 100000 : 1000));
  }
  // src B: roughly linear (closer to uniform / symmetric)
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(40 + i), 'B', 1000 + i * 50));
  }
  const r = buildDailyTokenJarqueBera(queue, {});
  assert.equal(r.sources.length, 2);
  assert.equal(r.sort, 'jbDesc');
  assert.ok(r.sources[0]!.jb >= r.sources[1]!.jb);
  assert.equal(r.sources[0]!.source, 'A');
});

test('buildDailyTokenJarqueBera: per-row jbZ === (jb - 2) / 2 in builder output', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    queue.push(ql(dayIso(i), 'X', 1000 + i * 100));
  }
  const r = buildDailyTokenJarqueBera(queue, {});
  for (const s of r.sources) {
    assert.ok(Math.abs(s.jbZ - (s.jb - 2) / 2) < 1e-12);
    assert.ok(Math.abs(s.jbPApprox - Math.exp(-s.jb / 2)) < 1e-12);
  }
});

test('buildDailyTokenJarqueBera: verdict matches Chi-Square(2) cutoffs', () => {
  const queue: QueueLine[] = [];
  // Approximately Gaussian-ish source: linear ramp -> low jb
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'gaussian-ish', 1000 + i * 50));
  }
  // Strongly non-Gaussian: large outlier
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(40 + i), 'spike', i === 15 ? 1_000_000 : 1000));
  }
  const r = buildDailyTokenJarqueBera(queue, {});
  const spike = r.sources.find((s) => s.source === 'spike')!;
  assert.equal(spike.verdict, 'strongly-non-gaussian');
  assert.ok(spike.jb >= 9.21);
});

test('buildDailyTokenJarqueBera: --top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['A', 'B', 'C', 'D']) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), src, 1000 + i * (src.charCodeAt(0) - 64) * 7));
    }
  }
  const r = buildDailyTokenJarqueBera(queue, { top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenJarqueBera: rejects invalid sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenJarqueBera([], {
        sort: 'nonsense' as unknown as DailyTokenJarqueBeraSort_unused,
      } as never),
    /sort must be one of/,
  );
});

// dummy type alias to keep TS happy on the negative-path test above
type DailyTokenJarqueBeraSort_unused = never;

test('buildDailyTokenJarqueBera: source filter restricts to one source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'keep', 1000 + i * 50));
    queue.push(ql(dayIso(i), 'drop', 2000 + i * 25));
  }
  const r = buildDailyTokenJarqueBera(queue, { source: 'keep' });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenJarqueBera: window filter (since/until)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 60; i += 1) {
    queue.push(ql(dayIso(i), 'X', 1000 + i * 30));
  }
  const r = buildDailyTokenJarqueBera(queue, {
    since: dayIso(10),
    until: dayIso(40),
  });
  assert.equal(r.sources.length, 1);
  // filtered window: indices 10..39 -> tenure 30 days
  assert.equal(r.sources[0]!.nTenureDays, 30);
});

test('buildDailyTokenJarqueBera: rejects bad min-tokens', () => {
  assert.throws(
    () => buildDailyTokenJarqueBera([], { minTokens: -1 }),
    /minTokens/,
  );
});

test('buildDailyTokenJarqueBera: rejects bad min-tenure-days', () => {
  assert.throws(
    () => buildDailyTokenJarqueBera([], { minTenureDays: 3 }),
    /minTenureDays/,
  );
});

test('buildDailyTokenJarqueBera: deterministic given fixed input', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'X', 1000 + i * 50 + (i % 3) * 200));
  }
  const a = buildDailyTokenJarqueBera(queue, {
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  const b = buildDailyTokenJarqueBera(queue, {
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.deepEqual(a, b);
});
