import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenRunsTestDetrended,
  buildDailyTokenRunsTestDetrended,
} from '../src/dailytokenrunstestdetrended.js';
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

test('dailyTokenRunsTestDetrended: rejects fewer than 4 samples', () => {
  assert.throws(
    () => dailyTokenRunsTestDetrended([1, 2, 3]),
    /at least 4 samples/,
  );
});

test('dailyTokenRunsTestDetrended: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenRunsTestDetrended([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenRunsTestDetrended([1, 2, 3, Infinity]),
    /finite values/,
  );
});

test('dailyTokenRunsTestDetrended: zero level variance throws', () => {
  assert.throws(
    () => dailyTokenRunsTestDetrended([7, 7, 7, 7, 7, 7, 7, 7]),
    /zero level variance/,
  );
});

test('dailyTokenRunsTestDetrended: zero residual variance (perfect linear ramp) throws', () => {
  // Perfect linear: x_t = 100 + 5*t -> residuals all 0 -> rss = 0
  const x = Array.from({ length: 12 }, (_, t) => 100 + 5 * t);
  assert.throws(
    () => dailyTokenRunsTestDetrended(x),
    /zero residual variance/,
  );
});

// ---------- primitive: identities ----------

test('dailyTokenRunsTestDetrended: invariant under additive shift x -> x + c', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12];
  const a = dailyTokenRunsTestDetrended(x);
  const b = dailyTokenRunsTestDetrended(x.map((v) => v + 1000));
  assert.equal(a.runs, b.runs);
  assert.equal(a.nPos, b.nPos);
  assert.equal(a.nNeg, b.nNeg);
  assert.ok(Math.abs(a.rtZ - b.rtZ) < 1e-10);
});

test('dailyTokenRunsTestDetrended: invariant under positive scalar x -> a*x', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12];
  const a = dailyTokenRunsTestDetrended(x);
  const b = dailyTokenRunsTestDetrended(x.map((v) => v * 7.5));
  assert.equal(a.runs, b.runs);
  assert.equal(a.nPos, b.nPos);
  assert.equal(a.nNeg, b.nNeg);
  assert.ok(Math.abs(a.rtZ - b.rtZ) < 1e-10);
  // slope DOES scale
  assert.ok(Math.abs(b.trendSlope / a.trendSlope - 7.5) < 1e-8);
});

test('dailyTokenRunsTestDetrended: invariant under sign flip x -> -x (R unchanged, nPos<->nNeg swap)', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12];
  const a = dailyTokenRunsTestDetrended(x);
  const b = dailyTokenRunsTestDetrended(x.map((v) => -v));
  assert.equal(a.runs, b.runs);
  assert.equal(a.nPos, b.nNeg);
  assert.equal(a.nNeg, b.nPos);
  assert.ok(Math.abs(a.rtZ - b.rtZ) < 1e-10);
});

// ---------- primitive: closed-form anchors ----------

test('dailyTokenRunsTestDetrended: rtZ === (R - mu_R)/sqrt(var_R) exactly', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12, 5, 8, 3, 9];
  const r = dailyTokenRunsTestDetrended(x);
  const n = r.nPos + r.nNeg;
  const npn = r.nPos * r.nNeg;
  const expectedMu = (2 * npn) / n + 1;
  const expectedVar = (2 * npn * (2 * npn - n)) / (n * n * (n - 1));
  const expectedRtZ = (r.runs - expectedMu) / Math.sqrt(expectedVar);
  assert.ok(Math.abs(r.expectedRuns - expectedMu) < 1e-12);
  assert.ok(Math.abs(r.varRuns - expectedVar) < 1e-12);
  assert.ok(Math.abs(r.rtZ - expectedRtZ) < 1e-10);
});

test('dailyTokenRunsTestDetrended: perfectly alternating residuals -> R = nEff (max anti-clustering)', () => {
  // Build x_t = t * 0 + alternating +1 / -1 (no trend, alt residuals)
  const n = 20;
  const x = Array.from({ length: n }, (_, t) => (t % 2 === 0 ? 1 : -1));
  const r = dailyTokenRunsTestDetrended(x);
  // Slope ~ 0, residuals = x_t (since xbar = 0), all alternate -> runs = n
  assert.equal(r.runs, n);
  assert.equal(r.nPos + r.nNeg, n);
  assert.ok(r.rtZ > 3, `expected rtZ > 3, got ${r.rtZ}`);
});

test('dailyTokenRunsTestDetrended: clustered residuals (constant first half, constant second half) -> few runs, strong negative rtZ', () => {
  // A step function. After OLS linear detrend, residuals carry an
  // "S-shape" -- positive at the front of each plateau, negative at
  // the back -- so runs <= 3. Either way rtZ is strongly negative
  // (clustering), since 3 runs over n=20 with balanced n_+/n_- is
  // far below the WW null mean of ~11.
  const n = 20;
  const x = Array.from({ length: n }, (_, t) => (t < n / 2 ? 0 : 100));
  const r = dailyTokenRunsTestDetrended(x);
  assert.ok(
    r.runs <= 5,
    `expected runs <= 5 for step function, got ${r.runs}`,
  );
  assert.ok(r.rtZ < -2, `expected rtZ < -2 (clustering), got ${r.rtZ}`);
});

test('dailyTokenRunsTestDetrended: detrending removes monotone trend (cf. axis-149 raw-series runs-test)', () => {
  // A pure linear ramp PLUS small alternating noise:
  // x_t = 100 * t + (t % 2 === 0 ? +1 : -1)
  // axis-149 (raw-series above/below median): n=20, median ~ midpoint,
  //   first half all '-', second half all '+' -> R=2, rtZ ~ -sqrt(n).
  // THIS axis (detrended): linear trend stripped; residuals are the
  //   alternating noise -> R=20, rtZ ~ +sqrt(n) (anti-clustering).
  const n = 20;
  const x = Array.from(
    { length: n },
    (_, t) => 100 * t + (t % 2 === 0 ? 1 : -1),
  );
  const r = dailyTokenRunsTestDetrended(x);
  // After OLS detrend the residuals should alternate strongly
  assert.ok(
    r.runs >= n - 2,
    `expected runs >= ${n - 2} after detrend, got ${r.runs}`,
  );
  assert.ok(r.rtZ > 3, `expected rtZ > 3 (anti-clustering), got ${r.rtZ}`);
});

test('dailyTokenRunsTestDetrended: nPos + nNeg + nZero === nSamples', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12];
  const r = dailyTokenRunsTestDetrended(x);
  assert.equal(r.nPos + r.nNeg + r.nZero, r.nSamples);
});

test('dailyTokenRunsTestDetrended: runs is in [2, nEff]', () => {
  const x = [3, 1, 7, 2, 9, 4, 8, 5, 6, 11, 2, 13, 4, 10, 1, 12, 5, 8, 3, 9];
  const r = dailyTokenRunsTestDetrended(x);
  const nEff = r.nPos + r.nNeg;
  assert.ok(r.runs >= 2);
  assert.ok(r.runs <= nEff);
});

test('dailyTokenRunsTestDetrended: expected runs formula matches reference (n_+ = n_- = 10, n = 20 -> mu = 11)', () => {
  // Construct so n_+ = n_- = 10 after detrending.
  // x_t = (t < 10 ? 0 : 1) + small alternating noise so detrended
  // residuals split evenly. Easier: directly check formula with a
  // known sequence.
  const n = 20;
  // Pure alt above/below 0 with no trend: 10 pos, 10 neg, runs = 20.
  const x = Array.from({ length: n }, (_, t) => (t % 2 === 0 ? 1 : -1));
  const r = dailyTokenRunsTestDetrended(x);
  assert.equal(r.nPos, 10);
  assert.equal(r.nNeg, 10);
  // mu_R = 2 * 10 * 10 / 20 + 1 = 11
  assert.ok(Math.abs(r.expectedRuns - 11) < 1e-10);
});

// ---------- builder: filtering / aggregation ----------

test('buildDailyTokenRunsTestDetrended: empty queue -> zero rows', () => {
  const r = buildDailyTokenRunsTestDetrended([]);
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenRunsTestDetrended: drops source with tenure < min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'shorty', 5000));
  }
  const r = buildDailyTokenRunsTestDetrended(queue, { minTenureDays: 14 });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenRunsTestDetrended: drops source with total_tokens < min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'sparse', 10));
  }
  const r = buildDailyTokenRunsTestDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenRunsTestDetrended: alternating residuals source surfaces strong-anti-clustering', () => {
  const queue: QueueLine[] = [];
  // 30 days, alternating high/low around constant level (no trend).
  for (let i = 0; i < 30; i += 1) {
    const v = i % 2 === 0 ? 200_000 : 100_000;
    queue.push(ql(dayIso(i), 'alt', v));
  }
  const r = buildDailyTokenRunsTestDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'rtZAbsDesc',
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'alt');
  assert.ok(
    s.verdict === 'strong-anti-clustering',
    `expected strong-anti-clustering, got ${s.verdict} (rtZ=${s.rtZ})`,
  );
});

test('buildDailyTokenRunsTestDetrended: clustered residuals source surfaces strong-clustering', () => {
  const queue: QueueLine[] = [];
  // 30 days: first 15 below trend, next 15 above trend (no linear
  // trend present, so OLS slope ~ 0; residuals = x - mean).
  for (let i = 0; i < 30; i += 1) {
    const v = i < 15 ? 50_000 : 250_000;
    queue.push(ql(dayIso(i), 'clust', v));
  }
  const r = buildDailyTokenRunsTestDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'rtZAbsDesc',
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.ok(
    s.verdict === 'strong-clustering' || s.verdict === 'borderline-clustering',
    `expected clustering verdict, got ${s.verdict} (rtZ=${s.rtZ})`,
  );
});

test('buildDailyTokenRunsTestDetrended: respects sort=source (alphabetical)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'b-src', i % 2 === 0 ? 200_000 : 100_000));
    queue.push(ql(dayIso(i), 'a-src', i % 2 === 0 ? 100_000 : 200_000));
  }
  const r = buildDailyTokenRunsTestDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'a-src');
  assert.equal(r.sources[1]!.source, 'b-src');
});

test('buildDailyTokenRunsTestDetrended: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'a', i % 2 === 0 ? 100_000 : 200_000));
    queue.push(ql(dayIso(i), 'b', i % 2 === 0 ? 200_000 : 100_000));
    queue.push(ql(dayIso(i), 'c', i % 2 === 0 ? 150_000 : 50_000));
  }
  const r = buildDailyTokenRunsTestDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    top: 2,
  });
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources.length, 2);
});

test('buildDailyTokenRunsTestDetrended: invalid sort throws', () => {
  assert.throws(
    () =>
      buildDailyTokenRunsTestDetrended([], {
        sort: 'nonsense' as unknown as 'rtZ',
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenRunsTestDetrended: invalid min-tenure-days throws', () => {
  assert.throws(
    () => buildDailyTokenRunsTestDetrended([], { minTenureDays: 3 }),
    /minTenureDays must be an integer >= 4/,
  );
});

test('buildDailyTokenRunsTestDetrended: invalid since throws', () => {
  assert.throws(
    () => buildDailyTokenRunsTestDetrended([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

// ---------- refinement: runsRatio + sort key ----------

test('buildDailyTokenRunsTestDetrended: runsRatio === runs / expectedRuns exactly', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'alt', i % 2 === 0 ? 200_000 : 100_000));
  }
  const r = buildDailyTokenRunsTestDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.runsRatio - s.runs / s.expectedRuns) < 1e-12);
});

test('buildDailyTokenRunsTestDetrended: clustered residuals -> runsRatio < 1; anti-cluster -> > 1', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'alt', i % 2 === 0 ? 200_000 : 100_000)); // anti-cluster
    queue.push(ql(dayIso(i), 'clust', i < 15 ? 50_000 : 250_000)); // cluster
  }
  const r = buildDailyTokenRunsTestDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'source',
  });
  const alt = r.sources.find((s) => s.source === 'alt')!;
  const clust = r.sources.find((s) => s.source === 'clust')!;
  assert.ok(
    alt.runsRatio > 1.5,
    `expected alt runsRatio > 1.5, got ${alt.runsRatio}`,
  );
  assert.ok(
    clust.runsRatio < 0.7,
    `expected clust runsRatio < 0.7, got ${clust.runsRatio}`,
  );
});

test('buildDailyTokenRunsTestDetrended: sort=runsRatio orders ascending (most clustered first)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'alt', i % 2 === 0 ? 200_000 : 100_000));
    queue.push(ql(dayIso(i), 'clust', i < 15 ? 50_000 : 250_000));
  }
  const r = buildDailyTokenRunsTestDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'runsRatio',
  });
  assert.equal(r.sources.length, 2);
  // 'clust' has runsRatio < 1 (clustering), 'alt' > 1 (anti-cluster)
  // Ascending: smallest runsRatio (most clustered) first.
  assert.equal(r.sources[0]!.source, 'clust');
  assert.equal(r.sources[1]!.source, 'alt');
});

test('buildDailyTokenRunsTestDetrended: sort=runsRatioDesc orders descending', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'alt', i % 2 === 0 ? 200_000 : 100_000));
    queue.push(ql(dayIso(i), 'clust', i < 15 ? 50_000 : 250_000));
  }
  const r = buildDailyTokenRunsTestDetrended(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'runsRatioDesc',
  });
  assert.equal(r.sources[0]!.source, 'alt');
  assert.equal(r.sources[1]!.source, 'clust');
});
