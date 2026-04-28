/**
 * Cross-analyzer ladder properties for the L-estimator suite at
 * alpha = 0.20 (TM-20 vs WM-20) and alpha-monotonicity
 * (TM-10 < TM-20 < TM-25 in trim aggressiveness).
 *
 * Mathematical claims tested empirically on pseudo-random series
 * (seeded RNG, deterministic):
 *
 *   1. **TM-20 vs WM-20 (same alpha, drop vs clip).** On the same
 *      ascending-sorted samples, with `k = floor(0.20 n)`:
 *        WM = (sum(x_(k+1..n-k)) + k*x_(k+1) + k*x_(n-k)) / n
 *        TM = sum(x_(k+1..n-k)) / (n - 2k)
 *      Therefore:
 *        WM - TM = (k/n) * ((x_(k+1) + x_(n-k)) - 2*TM)
 *      So **`sign(WM - TM) == sign((lo + hi)/2 - TM)`** —
 *      WM > TM iff the boundary midpoint is above the central
 *      mean, and they coincide iff the central body mean equals
 *      the boundary midpoint.
 *
 *   2. **Both estimators are bounded by `[lo, hi]`** where
 *      `lo = x_(k+1)` and `hi = x_(n-k)`, since both are convex
 *      combinations of order statistics in `[lo, hi]`.
 *
 *   3. **k_alpha monotonicity at fixed n.** k_10 = floor(0.10 n),
 *      k_20 = floor(0.20 n), k_25 = floor(0.25 n). Always
 *      `k_10 <= k_20 <= k_25`, with strict inequality at any n
 *      where 0.10n, 0.20n, 0.25n straddle integers.
 *
 *   4. **Heavy-upper-tail diagnostic ordering.** On a series with
 *      a tight body of 100 plus a fixed-size set of upper outliers,
 *      the trimmed means filter progressively more outlier mass
 *      as alpha increases. So:
 *        mean > TM-10 >= TM-20 >= TM-25
 *      with the inequalities becoming strict whenever the next
 *      alpha level trims away additional outliers that the
 *      lower alpha had admitted.
 *
 *   5. **WM-20 == TM-20 on a constant series.** Both equal the
 *      constant; gap is zero.
 *
 * These are end-to-end tests against the actual exported
 * builders, not against in-test reference implementations.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenTrimMean10 } from '../src/sourcerowtokentrimmean10.js';
import { buildSourceRowTokenTrimMean20 } from '../src/sourcerowtokentrimmean20.js';
import { buildSourceRowTokenTrimMean25 } from '../src/sourcerowtokentrimmean25.js';
import { buildSourceRowTokenWinsorizedMean20 } from '../src/sourcerowtokenwinsorizedmean20.js';
import type { QueueLine } from '../src/types.js';

const GEN = '2026-04-29T12:00:00.000Z';

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

test('ladder-20: TM-20 == WM-20 == constant on constant series', () => {
  const xs = new Array(40).fill(777);
  const tm20 = buildSourceRowTokenTrimMean20(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const wm20 = buildSourceRowTokenWinsorizedMean20(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  assert.equal(tm20.trimMean, 777);
  assert.equal(wm20.winsorizedMean, 777);
  assert.equal(tm20.tmMeanGap, 0);
  assert.equal(wm20.wmMeanGap, 0);
});

test('ladder-20: TM-20 and WM-20 both bounded by [lo, hi] across 30 random series', () => {
  const r = rng(20260429);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 20 + Math.floor(r() * 200);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 1_000_000));
    const tm = buildSourceRowTokenTrimMean20(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const wm = buildSourceRowTokenWinsorizedMean20(mkSeries('a', xs), {
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

test('ladder-20: sign(WM-20 − TM-20) == sign((lo + hi)/2 − TM-20) across 30 random series', () => {
  const r = rng(2026);
  let mismatches = 0;
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 20 + Math.floor(r() * 200);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 1_000_000));
    const tm = buildSourceRowTokenTrimMean20(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const wm = buildSourceRowTokenWinsorizedMean20(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const wmMinusTm = wm.winsorizedMean - tm.trimMean;
    const midMinusTm = (tm.loBoundary + tm.hiBoundary) / 2 - tm.trimMean;
    if (Math.abs(wmMinusTm) < 1e-9 && Math.abs(midMinusTm) < 1e-9) continue;
    if (Math.sign(wmMinusTm) !== Math.sign(midMinusTm)) {
      mismatches += 1;
    }
  }
  assert.equal(mismatches, 0, `${mismatches}/30 sign mismatches`);
});

test('ladder-20: k monotonicity — k_10 <= k_20 <= k_25 across 30 random sizes', () => {
  const r = rng(31337);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 20 + Math.floor(r() * 500);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 1_000_000));
    const tm10 = buildSourceRowTokenTrimMean10(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const tm20 = buildSourceRowTokenTrimMean20(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const tm25 = buildSourceRowTokenTrimMean25(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.ok(
      tm10.trimmedPerTail <= tm20.trimmedPerTail,
      `n=${n}: k_10=${tm10.trimmedPerTail} > k_20=${tm20.trimmedPerTail}`,
    );
    assert.ok(
      tm20.trimmedPerTail <= tm25.trimmedPerTail,
      `n=${n}: k_20=${tm20.trimmedPerTail} > k_25=${tm25.trimmedPerTail}`,
    );
  }
});

test('ladder-20: heavy upper tail — mean > TM-10 >= TM-20 >= TM-25 (canonical diagnostic ordering)', () => {
  // n=100. k_10=10, k_20=20, k_25=25.
  // Body of b=78 rows of value 100, then 22 upper outliers.
  // TM-25 keeps x_(26..75): all 50 are body -> TM-25 = 100.
  // TM-20 keeps x_(21..80): includes x_(79..80) = 2 outliers -> TM-20 > 100.
  // TM-10 keeps x_(11..90): includes x_(79..90) = 12 outliers -> TM-10 > TM-20.
  const xs = [
    ...new Array(78).fill(100),
    ...new Array(15).fill(10_000_000),
    ...new Array(7).fill(50_000_000),
  ];
  const tm10 = buildSourceRowTokenTrimMean10(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const tm20 = buildSourceRowTokenTrimMean20(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const tm25 = buildSourceRowTokenTrimMean25(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  // TM-25 at 100 (body fully covers central 26..75)
  assert.equal(tm25.trimMean, 100);
  // TM-20 above 100 (admits 2 outliers)
  assert.ok(tm20.trimMean > 100, `TM-20 ${tm20.trimMean} should be > 100`);
  // TM-10 above TM-20 (admits more outliers)
  assert.ok(
    tm10.trimMean > tm20.trimMean,
    `TM-10 ${tm10.trimMean} should be > TM-20 ${tm20.trimMean}`,
  );
  assert.ok(
    tm20.trimMean > tm25.trimMean,
    `TM-20 ${tm20.trimMean} should be > TM-25 ${tm25.trimMean}`,
  );
  // Raw mean dominated by outliers, well above all trimmed means.
  assert.ok(tm10.mean > tm10.trimMean);
  // All gaps negative.
  assert.ok(tm10.tmMeanGap < 0);
  assert.ok(tm20.tmMeanGap < 0);
  assert.ok(tm25.tmMeanGap < 0);
  // |gap| is monotonically increasing in alpha.
  assert.ok(
    Math.abs(tm10.tmMeanGap) <= Math.abs(tm20.tmMeanGap),
    `|TM-10 gap| ${Math.abs(tm10.tmMeanGap)} should be <= |TM-20 gap| ${Math.abs(tm20.tmMeanGap)}`,
  );
  assert.ok(
    Math.abs(tm20.tmMeanGap) <= Math.abs(tm25.tmMeanGap),
    `|TM-20 gap| ${Math.abs(tm20.tmMeanGap)} should be <= |TM-25 gap| ${Math.abs(tm25.tmMeanGap)}`,
  );
});

test('ladder-20: heavy upper tail — TM-10/TM-20/TM-25 all produce strongly negative gaps across 10 random series', () => {
  const r = rng(31415);
  for (let trial = 0; trial < 10; trial += 1) {
    const body = Array.from({ length: 70 }, () => 100 + Math.floor(r() * 50));
    const outliers = Array.from({ length: 30 }, () =>
      1_000_000 + Math.floor(r() * 1_000_000),
    );
    const xs = [...body, ...outliers];
    const tm10 = buildSourceRowTokenTrimMean10(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const tm20 = buildSourceRowTokenTrimMean20(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const tm25 = buildSourceRowTokenTrimMean25(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.ok(
      tm10.tmMeanGap < -1000,
      `trial=${trial}: TM-10 gap ${tm10.tmMeanGap} should be strongly negative`,
    );
    assert.ok(
      tm20.tmMeanGap < -1000,
      `trial=${trial}: TM-20 gap ${tm20.tmMeanGap} should be strongly negative`,
    );
    assert.ok(
      tm25.tmMeanGap < -1000,
      `trial=${trial}: TM-25 gap ${tm25.tmMeanGap} should be strongly negative`,
    );
    // All three should agree on raw mean (same input).
    assert.ok(Math.abs(tm10.mean - tm20.mean) < 1e-6);
    assert.ok(Math.abs(tm20.mean - tm25.mean) < 1e-6);
  }
});

test('ladder-20: tail-symmetric series — all three trimmed means equal raw mean (gap = 0)', () => {
  // Symmetric around 1000: matched pairs of (1000+o, 1000-o).
  // Mean is 1000 by construction; any symmetric trim leaves the
  // central body symmetric so trim_mean == mean. Centre at 1000
  // so all values stay positive (negative total_tokens would be
  // dropped by the validator).
  const offsets = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500];
  const xs: number[] = [];
  for (const o of offsets) {
    xs.push(1000 + o, 1000 - o);
  }
  // Add the centre point so n is odd and ordering remains symmetric.
  xs.push(1000);
  const tm10 = buildSourceRowTokenTrimMean10(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const tm20 = buildSourceRowTokenTrimMean20(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const tm25 = buildSourceRowTokenTrimMean25(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  // Tolerance 1e-6 for FP rounding on integer inputs averaged.
  assert.ok(Math.abs(tm10.mean - 1000) < 1e-6, `tm10.mean=${tm10.mean}`);
  assert.ok(Math.abs(tm10.trimMean - 1000) < 1e-6, `tm10.trimMean=${tm10.trimMean}`);
  assert.ok(Math.abs(tm10.tmMeanGap) < 1e-6);
  assert.ok(Math.abs(tm20.trimMean - 1000) < 1e-6, `tm20.trimMean=${tm20.trimMean}`);
  assert.ok(Math.abs(tm20.tmMeanGap) < 1e-6);
  assert.ok(Math.abs(tm25.trimMean - 1000) < 1e-6, `tm25.trimMean=${tm25.trimMean}`);
  assert.ok(Math.abs(tm25.tmMeanGap) < 1e-6);
});
