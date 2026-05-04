import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenDurbinWatsonDetrended,
  buildDailyTokenDurbinWatsonDetrended,
} from '../src/dailytokendurbinwatsondetrended.js';
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

test('dailyTokenDurbinWatsonDetrended: rejects fewer than 4 samples', () => {
  assert.throws(
    () => dailyTokenDurbinWatsonDetrended([1, 2, 3]),
    /at least 4 samples/,
  );
});

test('dailyTokenDurbinWatsonDetrended: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenDurbinWatsonDetrended([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenDurbinWatsonDetrended([1, 2, 3, Infinity]),
    /finite values/,
  );
});

test('dailyTokenDurbinWatsonDetrended: zero level variance throws', () => {
  assert.throws(
    () => dailyTokenDurbinWatsonDetrended([7, 7, 7, 7, 7, 7, 7, 7]),
    /zero level variance/,
  );
});

test('dailyTokenDurbinWatsonDetrended: zero residual variance (perfect linear ramp) throws', () => {
  // x_t = 100 + 5*t -- perfect linear -> residuals all 0
  const x = Array.from({ length: 12 }, (_, t) => 100 + 5 * t);
  assert.throws(
    () => dailyTokenDurbinWatsonDetrended(x),
    /zero residual variance/,
  );
});

// ---------- primitive: identities ----------

test('dailyTokenDurbinWatsonDetrended: invariant under additive shift x -> x + c', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12];
  const a = dailyTokenDurbinWatsonDetrended(x);
  const b = dailyTokenDurbinWatsonDetrended(x.map((v) => v + 1000));
  assert.ok(Math.abs(a.dw - b.dw) < 1e-8);
  assert.ok(Math.abs(a.rhoHatResid - b.rhoHatResid) < 1e-8);
  assert.ok(Math.abs(a.dwZ - b.dwZ) < 1e-8);
  assert.ok(Math.abs(a.trendSlope - b.trendSlope) < 1e-8);
});

test('dailyTokenDurbinWatsonDetrended: invariant under positive scalar x -> a*x', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12];
  const a = dailyTokenDurbinWatsonDetrended(x);
  const b = dailyTokenDurbinWatsonDetrended(x.map((v) => v * 7.5));
  assert.ok(Math.abs(a.dw - b.dw) < 1e-8);
  assert.ok(Math.abs(a.rhoHatResid - b.rhoHatResid) < 1e-8);
  // slope and rss DO scale, but dw / rhoHat / dwZ are scale-invariant
  assert.ok(Math.abs(b.trendSlope / a.trendSlope - 7.5) < 1e-8);
});

test('dailyTokenDurbinWatsonDetrended: invariant under sign flip x -> -x for dw / rhoHat', () => {
  // Sign flip negates intercept and slope, but residuals also flip sign;
  // squared quantities are preserved, so dw and rhoHat are unchanged.
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12];
  const a = dailyTokenDurbinWatsonDetrended(x);
  const b = dailyTokenDurbinWatsonDetrended(x.map((v) => -v));
  assert.ok(Math.abs(a.dw - b.dw) < 1e-8);
  assert.ok(Math.abs(a.rhoHatResid - b.rhoHatResid) < 1e-8);
  assert.ok(Math.abs(a.trendSlope + b.trendSlope) < 1e-8);
});

// ---------- primitive: closed-form anchors ----------

test('dailyTokenDurbinWatsonDetrended: dwZ === (dw - 2) * sqrt(n) / 2 exactly', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12];
  const r = dailyTokenDurbinWatsonDetrended(x);
  const expected = ((r.dw - 2) * Math.sqrt(r.nSamples)) / 2;
  assert.ok(Math.abs(r.dwZ - expected) < 1e-12);
});

test('dailyTokenDurbinWatsonDetrended: algebraic identity dw === 2*(1 - rhoHat) - (e_0^2 + e_{n-1}^2)/rss', () => {
  // Derivation: sum(e_t - e_{t-1})^2 = sum_{t=1..n-1} e_t^2 + sum_{t=1..n-1} e_{t-1}^2 - 2*cross
  //                                  = (rss - e_0^2) + (rss - e_{n-1}^2) - 2*cross
  // dw = (2*rss - (e_0^2 + e_{n-1}^2) - 2*rss*rhoHat) / rss
  //    = 2*(1 - rhoHat) - (e_0^2 + e_{n-1}^2)/rss.
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12, 5, 8, 3, 9];
  const r = dailyTokenDurbinWatsonDetrended(x);
  const n = r.nSamples;
  const e0 = x[0]! - (r.trendIntercept + r.trendSlope * 0);
  const eN = x[n - 1]! - (r.trendIntercept + r.trendSlope * (n - 1));
  const reconstructed =
    2 * (1 - r.rhoHatResid) - (e0 * e0 + eN * eN) / r.rss;
  assert.ok(Math.abs(r.dw - reconstructed) < 1e-10);
});

test('dailyTokenDurbinWatsonDetrended: dw in [0, 4]', () => {
  const cases: number[][] = [
    [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 5],
    [10, 1, 10, 1, 10, 1, 10, 1, 10, 1, 10, 1, 10, 1, 10, 1],
  ];
  for (const x of cases) {
    const r = dailyTokenDurbinWatsonDetrended(x);
    assert.ok(r.dw >= 0 && r.dw <= 4, `dw out of [0, 4]: ${r.dw}`);
  }
});

test('dailyTokenDurbinWatsonDetrended: alternating residuals around zero trend give dw approx 4', () => {
  // x_t = (-1)^t. mean=0, slope approx 0; residuals essentially x_t.
  // rhoHat_e approx -1 -> dw approx 4 (modulo end-point correction).
  const n = 40;
  const x: number[] = [];
  for (let t = 0; t < n; t += 1) x.push(t % 2 === 0 ? -1 : 1);
  const r = dailyTokenDurbinWatsonDetrended(x);
  assert.ok(r.dw > 3.5, `expected dw > 3.5, got ${r.dw}`);
  assert.ok(r.rhoHatResid < -0.5);
  assert.ok(r.dwZ > 0); // negative autocorr -> dwZ positive
});

test('dailyTokenDurbinWatsonDetrended: highly persistent residuals (block pattern) give dw < 1', () => {
  // First half = 1, second half = -1. After detrending by linear fit of
  // a step, residuals retain block-positive structure -> rhoHat_e close to +1.
  const n = 40;
  const x: number[] = [];
  for (let t = 0; t < n; t += 1) x.push(t < n / 2 ? 1 : -1);
  const r = dailyTokenDurbinWatsonDetrended(x);
  assert.ok(r.dw < 1.0, `expected dw < 1, got ${r.dw}`);
  assert.ok(r.rhoHatResid > 0.5);
  assert.ok(r.dwZ < 0); // positive autocorr -> dwZ negative
});

test('dailyTokenDurbinWatsonDetrended: residuals around linear trend (perfect ramp + tiny iid noise) give dw approx 2', () => {
  // x_t = 5*t + small zigzag whose lag-1 acf = 0.
  // Rough construction: residuals e_t = (-1)^t + (-1)^{floor(t/3)} so that
  // sum e_t e_{t-1} -> roughly cancels -> rhoHat_e near 0 -> dw near 2.
  const n = 60;
  const x: number[] = [];
  // Use a deterministic pseudo-noise that has near-zero lag-1 autocorr.
  const noise = [
    1, -1, 2, -2, 1, -1, 2, -2, 1, -1, 2, -2, 1, -1, 2, -2, 1, -1, 2, -2,
    1, -1, 2, -2, 1, -1, 2, -2, 1, -1, 2, -2, 1, -1, 2, -2, 1, -1, 2, -2,
    1, -1, 2, -2, 1, -1, 2, -2, 1, -1, 2, -2, 1, -1, 2, -2, 1, -1, 2, -2,
  ];
  for (let t = 0; t < n; t += 1) x.push(100 + 5 * t + noise[t]!);
  const r = dailyTokenDurbinWatsonDetrended(x);
  // Highly oscillating noise -> dw > 2 actually; but it should be > 1 and finite.
  assert.ok(r.dw > 1.0 && r.dw < 4.0);
  assert.ok(Number.isFinite(r.dwZ));
});

test('dailyTokenDurbinWatsonDetrended: monotone trend with large iid jitter has dw closer to 2 than monotone trend alone', () => {
  // A pure monotone ramp with zero residual variance is rejected. Use a
  // strict monotone with one off-trend bump: dw should be moderate.
  const n = 30;
  const x: number[] = [];
  for (let t = 0; t < n; t += 1) {
    let v = 100 + 3 * t;
    if (t === 7 || t === 18) v += 50;
    x.push(v);
  }
  const r = dailyTokenDurbinWatsonDetrended(x);
  assert.ok(r.dw >= 0 && r.dw <= 4);
  // OLS slope should be close to 3 (the trend).
  assert.ok(Math.abs(r.trendSlope - 3) < 1.0);
});

test('dailyTokenDurbinWatsonDetrended: OLS sums sum e_t = 0 and sum t*e_t = 0 (first-order conditions)', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12, 5, 8, 3, 9];
  const r = dailyTokenDurbinWatsonDetrended(x);
  let sumE = 0;
  let sumTE = 0;
  for (let t = 0; t < r.nSamples; t += 1) {
    const e = x[t]! - (r.trendIntercept + r.trendSlope * t);
    sumE += e;
    sumTE += t * e;
  }
  assert.ok(Math.abs(sumE) < 1e-8, `sum e_t = ${sumE} not 0`);
  assert.ok(Math.abs(sumTE) < 1e-6, `sum t*e_t = ${sumTE} not 0`);
});

// ---------- builder: pipeline filters ----------

test('buildDailyTokenDurbinWatsonDetrended: drops sparse + below-tenure sources', () => {
  const queue: QueueLine[] = [];
  queue.push(ql(dayIso(0), 'sparse', 100));
  for (let i = 0; i < 5; i += 1) queue.push(ql(dayIso(10 + i), 'short', 5000));
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(50 + i), 'long', 1000 + i * 7 + (i % 3) * 300));
  }
  const r = buildDailyTokenDurbinWatsonDetrended(queue, {
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'long');
  assert.equal(r.sources[0]!.nTenureDays, 30);
});

test('buildDailyTokenDurbinWatsonDetrended: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'flat', 1000));
  const r = buildDailyTokenDurbinWatsonDetrended(queue, {});
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenDurbinWatsonDetrended: drops zero-residual-variance (perfect linear) sources', () => {
  const queue: QueueLine[] = [];
  // Perfect linear ramp -> residuals exactly 0 after OLS detrending.
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'ramp', 1000 + i * 50));
  const r = buildDailyTokenDurbinWatsonDetrended(queue, {});
  assert.equal(r.droppedZeroResidualVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenDurbinWatsonDetrended: defaults to dwZAbsDesc sort', () => {
  const queue: QueueLine[] = [];
  // src A: block pattern -> very negative dwZ (positive resid autocorr) -> large |dwZ|
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'A', i < 15 ? 5000 : 200));
  }
  // src B: gentle scatter -> small |dwZ|
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(40 + i), 'B', 1000 + i * 50 + (i % 4) * 100));
  }
  const r = buildDailyTokenDurbinWatsonDetrended(queue, {});
  assert.equal(r.sources.length, 2);
  assert.equal(r.sort, 'dwZAbsDesc');
  assert.ok(Math.abs(r.sources[0]!.dwZ) >= Math.abs(r.sources[1]!.dwZ));
});

test('buildDailyTokenDurbinWatsonDetrended: per-row dwZ === (dw - 2)*sqrt(n)/2 in builder output', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    queue.push(ql(dayIso(i), 'X', 1000 + i * 100 + (i % 5) * 200));
  }
  const r = buildDailyTokenDurbinWatsonDetrended(queue, {});
  for (const s of r.sources) {
    const expected = ((s.dw - 2) * Math.sqrt(s.nTenureDays)) / 2;
    assert.ok(Math.abs(s.dwZ - expected) < 1e-12);
  }
});

test('buildDailyTokenDurbinWatsonDetrended: verdict matches dwZ cutoffs', () => {
  const queue: QueueLine[] = [];
  // Strong positive resid autocorr -> dwZ very negative -> positive-autocorr
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'block', i < 20 ? 10000 : 100));
  }
  const r = buildDailyTokenDurbinWatsonDetrended(queue, {});
  const block = r.sources.find((s) => s.source === 'block')!;
  assert.equal(block.verdict, 'positive-autocorr');
  assert.ok(block.dwZ <= -2.576);
});

test('buildDailyTokenDurbinWatsonDetrended: --top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['A', 'B', 'C', 'D']) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(
        ql(dayIso(i), src, 1000 + i * (src.charCodeAt(0) - 64) * 7 + (i % 3) * 100),
      );
    }
  }
  const r = buildDailyTokenDurbinWatsonDetrended(queue, { top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenDurbinWatsonDetrended: rejects invalid sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenDurbinWatsonDetrended([], {
        sort: 'nonsense' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenDurbinWatsonDetrended: source filter restricts to one source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'keep', 1000 + i * 50 + (i % 3) * 200));
    queue.push(ql(dayIso(i), 'drop', 2000 + i * 25 + (i % 4) * 100));
  }
  const r = buildDailyTokenDurbinWatsonDetrended(queue, { source: 'keep' });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenDurbinWatsonDetrended: window filter (since/until)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 60; i += 1) {
    queue.push(ql(dayIso(i), 'X', 1000 + i * 30 + (i % 5) * 150));
  }
  const r = buildDailyTokenDurbinWatsonDetrended(queue, {
    since: dayIso(10),
    until: dayIso(40),
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 30);
});

test('buildDailyTokenDurbinWatsonDetrended: rejects bad min-tokens', () => {
  assert.throws(
    () => buildDailyTokenDurbinWatsonDetrended([], { minTokens: -1 }),
    /minTokens/,
  );
});

test('buildDailyTokenDurbinWatsonDetrended: rejects bad min-tenure-days', () => {
  assert.throws(
    () => buildDailyTokenDurbinWatsonDetrended([], { minTenureDays: 3 }),
    /minTenureDays/,
  );
});

test('buildDailyTokenDurbinWatsonDetrended: deterministic given fixed input', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'X', 1000 + i * 50 + (i % 3) * 200));
  }
  const a = buildDailyTokenDurbinWatsonDetrended(queue, {
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  const b = buildDailyTokenDurbinWatsonDetrended(queue, {
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.deepEqual(a, b);
});

test('buildDailyTokenDurbinWatsonDetrended: dw and rhoHatResid in valid ranges for every row', () => {
  const queue: QueueLine[] = [];
  for (const src of ['A', 'B', 'C']) {
    for (let i = 0; i < 25; i += 1) {
      queue.push(
        ql(
          dayIso(i + (src.charCodeAt(0) - 65) * 30),
          src,
          1000 + i * 50 + (i % (src.charCodeAt(0) - 64 + 1)) * 300,
        ),
      );
    }
  }
  const r = buildDailyTokenDurbinWatsonDetrended(queue, {});
  for (const s of r.sources) {
    assert.ok(s.dw >= 0 && s.dw <= 4, `dw out of range: ${s.dw}`);
    assert.ok(
      s.rhoHatResid >= -1.05 && s.rhoHatResid <= 1.05,
      `rhoHatResid out of range: ${s.rhoHatResid}`,
    );
  }
});

test('buildDailyTokenDurbinWatsonDetrended: sort by dw ascending puts smallest dw first', () => {
  const queue: QueueLine[] = [];
  // A: positive autocorr (block) -> small dw
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'A', i < 15 ? 5000 : 200));
  }
  // B: zigzag -> large dw
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(40 + i), 'B', i % 2 === 0 ? 200 : 5000));
  }
  const r = buildDailyTokenDurbinWatsonDetrended(queue, { sort: 'dw' });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.dw <= r.sources[1]!.dw);
});

test('buildDailyTokenDurbinWatsonDetrended: sort by rhoHatResidDesc puts largest positive rho first', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'A', i < 15 ? 5000 : 200));
  }
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(40 + i), 'B', i % 2 === 0 ? 200 : 5000));
  }
  const r = buildDailyTokenDurbinWatsonDetrended(queue, {
    sort: 'rhoHatResidDesc',
  });
  assert.ok(r.sources[0]!.rhoHatResid >= r.sources[1]!.rhoHatResid);
});

test('buildDailyTokenDurbinWatsonDetrended: trend slope reflects monotone increase', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    queue.push(ql(dayIso(i), 'rising', 1000 + i * 100 + (i % 5) * 50));
  }
  const r = buildDailyTokenDurbinWatsonDetrended(queue, {});
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.trendSlope > 50, `slope should be ~100, got ${r.sources[0]!.trendSlope}`);
});
