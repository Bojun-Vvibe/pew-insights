/**
 * Cross-analyzer ladder properties for the L-estimator suite at
 * alpha = 0.10 (TM-10 vs WM-10) and alpha-monotonicity (TM-10
 * vs TM-25).
 *
 * Mathematical claims tested empirically on pseudo-random series
 * (seeded RNG, deterministic):
 *
 *   1. **TM-10 vs WM-10 (same alpha, drop vs clip).** On the same
 *      ascending-sorted samples, with `k = floor(0.10 n)`:
 *        WM = (sum(x_(k+1..n-k)) + k*x_(k+1) + k*x_(n-k)) / n
 *        TM = sum(x_(k+1..n-k)) / (n - 2k)
 *      Therefore:
 *        WM - TM = (k*(x_(k+1) + x_(n-k)) - 2k*TM) / n
 *               = (k/n) * ((x_(k+1) + x_(n-k)) - 2*TM)
 *      So **`sign(WM - TM) == sign((lo + hi)/2 - TM)`** —
 *      WM > TM iff the boundary midpoint is above the central
 *      mean (i.e. the central body is left-heavy relative to
 *      the boundary span), and they coincide iff the central
 *      body mean equals the boundary midpoint.
 *
 *   2. **Both estimators are bounded by `[lo, hi]`** where
 *      `lo = x_(k+1)` and `hi = x_(n-k)`, since both are convex
 *      combinations of order statistics in `[lo, hi]`.
 *
 *   3. **TM-10 lies between mean and TM-25 in tail-attenuation
 *      behaviour on the canonical "single huge row" pattern.**
 *      Specifically, on a series with a tight body of 50 plus
 *      a small set of escalating upper outliers, TM-25 trims
 *      *all* the outliers (k = 15) and stays at the body
 *      value, while TM-10 (k = 6) only trims half and lets a
 *      few outliers leak into the central body — so we expect
 *      `mean > TM-10 > TM-25` and both gaps negative. (Not a
 *      universal mathematical inequality — it depends on body
 *      shape — but it is the canonical diagnostic ordering.)
 *
 *   4. **WM-10 == TM-10 on a constant series.** Both equal the
 *      constant; gap is zero.
 *
 * These are end-to-end tests against the actual exported
 * builders, not against in-test reference implementations, so
 * they verify the wired code paths agree with the analytical
 * relationships.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenTrimMean10 } from '../src/sourcerowtokentrimmean10.js';
import { buildSourceRowTokenTrimMean25 } from '../src/sourcerowtokentrimmean25.js';
import { buildSourceRowTokenWinsorizedMean10 } from '../src/sourcerowtokenwinsorizedmean10.js';
import type { QueueLine } from '../src/types.js';

const GEN = '2026-04-28T12:00:00.000Z';

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

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('ladder: TM-10 == WM-10 == constant on constant series', () => {
  const xs = new Array(40).fill(777);
  const tm10 = buildSourceRowTokenTrimMean10(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const wm10 = buildSourceRowTokenWinsorizedMean10(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  assert.equal(tm10.trimMean, 777);
  assert.equal(wm10.winsorizedMean, 777);
  assert.equal(tm10.tmMeanGap, 0);
  assert.equal(wm10.wmMeanGap, 0);
});

test('ladder: TM-10 and WM-10 both bounded by [lo, hi] across 30 random series', () => {
  const r = rng(20260429);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 20 + Math.floor(r() * 200);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 1_000_000));
    const tm = buildSourceRowTokenTrimMean10(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const wm = buildSourceRowTokenWinsorizedMean10(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    // Same k by construction (same alpha, same n)
    assert.equal(tm.trimmedPerTail, wm.clippedPerTail);
    assert.ok(
      tm.trimMean >= tm.loBoundary - 1e-6 &&
        tm.trimMean <= tm.hiBoundary + 1e-6,
      `n=${n}: TM=${tm.trimMean} not in [${tm.loBoundary}, ${tm.hiBoundary}]`,
    );
    assert.ok(
      wm.winsorizedMean >= wm.loBoundary - 1e-6 &&
        wm.winsorizedMean <= wm.hiBoundary + 1e-6,
      `n=${n}: WM=${wm.winsorizedMean} not in [${wm.loBoundary}, ${wm.hiBoundary}]`,
    );
    // Lo and Hi boundaries must agree (same k, same sorted order)
    assert.equal(tm.loBoundary, wm.loBoundary);
    assert.equal(tm.hiBoundary, wm.hiBoundary);
  }
});

test('ladder: sign(WM-10 − TM-10) == sign((lo + hi)/2 − TM-10) across 30 random series', () => {
  const r = rng(2026);
  let mismatches = 0;
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 20 + Math.floor(r() * 200);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 1_000_000));
    const tm = buildSourceRowTokenTrimMean10(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const wm = buildSourceRowTokenWinsorizedMean10(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const wmMinusTm = wm.winsorizedMean - tm.trimMean;
    const midMinusTm = (tm.loBoundary + tm.hiBoundary) / 2 - tm.trimMean;
    // Both zero (degenerate) is OK; otherwise signs must agree.
    if (Math.abs(wmMinusTm) < 1e-9 && Math.abs(midMinusTm) < 1e-9) continue;
    if (Math.sign(wmMinusTm) !== Math.sign(midMinusTm)) {
      mismatches += 1;
    }
  }
  assert.equal(mismatches, 0, `${mismatches}/30 sign mismatches`);
});

test('ladder: heavy upper tail — mean > TM-10 > TM-25 (canonical "single huge row" diagnostic ordering)', () => {
  // Body of 100, then escalating outliers
  const xs = [
    ...new Array(50).fill(100),
    ...new Array(8).fill(10_000_000),
    ...new Array(2).fill(50_000_000),
  ];
  const tm10 = buildSourceRowTokenTrimMean10(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const tm25 = buildSourceRowTokenTrimMean25(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  // TM-25 trims 25 % per tail = 15 rows; the 10 extreme rows fit
  // entirely inside the trimmed top tail, so TM-25 stays at 100.
  assert.equal(tm25.trimMean, 100);
  // TM-10 trims 10 % per tail = 6 rows; only 6 of the 10 extreme
  // rows are trimmed, so 4 outliers leak into the central body.
  assert.ok(tm10.trimMean > 100, `TM-10 should be > 100, got ${tm10.trimMean}`);
  // The raw mean is dominated by the outliers and is much larger.
  assert.ok(
    tm10.mean > tm10.trimMean,
    `mean ${tm10.mean} should be > TM-10 ${tm10.trimMean}`,
  );
  assert.ok(
    tm10.trimMean > tm25.trimMean,
    `TM-10 ${tm10.trimMean} should be > TM-25 ${tm25.trimMean} on this heavy-upper-tail pattern`,
  );
  // Both gaps should be negative (raw mean pulled up).
  assert.ok(tm10.tmMeanGap < 0);
  assert.ok(tm25.tmMeanGap < 0);
  // TM-25's gap should be MORE negative than TM-10's (it trims
  // away more of the outlier mass, so its gap to the mean is larger).
  assert.ok(
    Math.abs(tm25.tmMeanGap) > Math.abs(tm10.tmMeanGap),
    `|TM-25 gap| ${Math.abs(tm25.tmMeanGap)} should exceed |TM-10 gap| ${Math.abs(tm10.tmMeanGap)}`,
  );
});

test('ladder: heavy upper tail — both TM-10 and TM-25 produce strongly negative gaps across 10 random series', () => {
  // Construct heavy-tailed: 90 % body + 10 % outliers (so both
  // trimmed means filter out a substantial chunk of the upper
  // tail and leave a gap to the raw mean).
  const r = rng(31415);
  for (let trial = 0; trial < 10; trial += 1) {
    const body = Array.from({ length: 90 }, () => 100 + Math.floor(r() * 50));
    const outliers = Array.from({ length: 10 }, () =>
      1_000_000 + Math.floor(r() * 1_000_000),
    );
    const xs = [...body, ...outliers];
    const tm10 = buildSourceRowTokenTrimMean10(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const tm25 = buildSourceRowTokenTrimMean25(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    // Both gaps strongly negative — outliers are pulling raw mean up.
    assert.ok(
      tm10.tmMeanGap < -1000,
      `trial=${trial}: TM-10 gap ${tm10.tmMeanGap} should be strongly negative`,
    );
    assert.ok(
      tm25.tmMeanGap < -1000,
      `trial=${trial}: TM-25 gap ${tm25.tmMeanGap} should be strongly negative`,
    );
    // Both should agree on raw mean (same input, different filters).
    assert.ok(Math.abs(tm10.mean - tm25.mean) < 1e-6);
  }
});
