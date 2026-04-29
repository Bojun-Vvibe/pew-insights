/**
 * Cross-analyzer ladder properties for the trim-mean family
 * TM-10 (alpha=0.10) ≤ TM-20 (alpha=0.20) ≤ TM-25 (alpha=0.25) ≤ TM-30 (alpha=0.30)
 * on the *trimmedPerTail* axis and on the *robustness* axis:
 *
 *   1. For any input, trimmedPerTail is monotone non-decreasing in alpha
 *      (k_10 ≤ k_20 ≤ k_25 ≤ k_30 for all n).
 *
 *   2. For any input, the surviving central window size n - 2k is monotone
 *      non-increasing in alpha (window_10 ≥ window_20 ≥ window_25 ≥ window_30).
 *
 *   3. On a constant series, every trim-mean equals the constant
 *      (identity invariant across the whole ladder).
 *
 *   4. On a right-heavy-tail series (huge upper outliers), the trim-mean
 *      is monotone non-increasing in alpha
 *      (TM-10 ≥ TM-20 ≥ TM-25 ≥ TM-30): more aggressive trimming pulls
 *      the location estimate further away from the contaminated tail.
 *
 *   5. On a left-heavy-tail series (tiny lower outliers), the trim-mean
 *      is monotone non-decreasing in alpha
 *      (TM-10 ≤ TM-20 ≤ TM-25 ≤ TM-30): symmetric trimming shaves off
 *      the contaminated lower tail and the estimate rises.
 *
 *   6. tmMeanGap signs propagate down the ladder: on a right-heavy-tail
 *      series, gap_alpha < 0 is preserved AND the magnitude is monotone
 *      non-decreasing in alpha (|gap_10| ≤ |gap_20| ≤ |gap_25| ≤ |gap_30|).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenTrimMean10 } from '../src/sourcerowtokentrimmean10.js';
import { buildSourceRowTokenTrimMean20 } from '../src/sourcerowtokentrimmean20.js';
import { buildSourceRowTokenTrimMean25 } from '../src/sourcerowtokentrimmean25.js';
import { buildSourceRowTokenTrimMean30 } from '../src/sourcerowtokentrimmean30.js';
import type { QueueLine } from '../src/types.js';

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

const GEN = '2026-04-29T12:00:00.000Z';

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

function ladder(series: QueueLine[]) {
  const r10 = buildSourceRowTokenTrimMean10(series, {
    generatedAt: GEN,
  }).sources[0]!;
  const r20 = buildSourceRowTokenTrimMean20(series, {
    generatedAt: GEN,
  }).sources[0]!;
  const r25 = buildSourceRowTokenTrimMean25(series, {
    generatedAt: GEN,
  }).sources[0]!;
  const r30 = buildSourceRowTokenTrimMean30(series, {
    generatedAt: GEN,
  }).sources[0]!;
  return { r10, r20, r25, r30 };
}

// Use n big enough to satisfy every minRows in the ladder:
// TM-10 minRows = 10, TM-20 = 5, TM-25 = 4, TM-30 = 4 → use n >= 10.

test('ladder: trimmedPerTail monotone non-decreasing alpha=0.10..0.30', () => {
  const r = rng(1);
  for (let trial = 0; trial < 25; trial += 1) {
    const n = 10 + Math.floor(r() * 200);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 999_999));
    const { r10, r20, r25, r30 } = ladder(mkSeries('a', xs));
    assert.ok(
      r10.trimmedPerTail <= r20.trimmedPerTail,
      `n=${n}: k_10=${r10.trimmedPerTail} > k_20=${r20.trimmedPerTail}`,
    );
    assert.ok(
      r20.trimmedPerTail <= r25.trimmedPerTail,
      `n=${n}: k_20=${r20.trimmedPerTail} > k_25=${r25.trimmedPerTail}`,
    );
    assert.ok(
      r25.trimmedPerTail <= r30.trimmedPerTail,
      `n=${n}: k_25=${r25.trimmedPerTail} > k_30=${r30.trimmedPerTail}`,
    );
  }
});

test('ladder: central window n - 2k monotone non-increasing alpha=0.10..0.30', () => {
  const r = rng(2);
  for (let trial = 0; trial < 25; trial += 1) {
    const n = 10 + Math.floor(r() * 200);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 999_999));
    const { r10, r20, r25, r30 } = ladder(mkSeries('a', xs));
    const w10 = r10.rowsKept - 2 * r10.trimmedPerTail;
    const w20 = r20.rowsKept - 2 * r20.trimmedPerTail;
    const w25 = r25.rowsKept - 2 * r25.trimmedPerTail;
    const w30 = r30.rowsKept - 2 * r30.trimmedPerTail;
    assert.ok(w10 >= w20 && w20 >= w25 && w25 >= w30, `windows: ${w10}/${w20}/${w25}/${w30}`);
  }
});

test('ladder: identity on constant series — every TM equals the constant', () => {
  const c = 7777;
  const series = mkSeries('a', new Array(50).fill(c));
  const { r10, r20, r25, r30 } = ladder(series);
  assert.equal(r10.trimMean, c);
  assert.equal(r20.trimMean, c);
  assert.equal(r25.trimMean, c);
  assert.equal(r30.trimMean, c);
});

test('ladder: right-heavy-tail series — TM monotone non-increasing in alpha', () => {
  // n=50 base of 100, then 10 huge outliers added to top
  const xs = [
    ...new Array(50).fill(100),
    ...new Array(10).fill(10_000_000),
  ];
  const { r10, r20, r25, r30 } = ladder(mkSeries('a', xs));
  // Each successive rung trims more of the upper tail and pulls the
  // estimate further away from the inflated mean.
  assert.ok(r10.trimMean >= r20.trimMean, `${r10.trimMean} >= ${r20.trimMean}`);
  assert.ok(r20.trimMean >= r25.trimMean, `${r20.trimMean} >= ${r25.trimMean}`);
  assert.ok(r25.trimMean >= r30.trimMean, `${r25.trimMean} >= ${r30.trimMean}`);
  // Sanity: TM-30 should have fully trimmed the outliers (k=18, central window
  // entirely inside the 100s), so TM-30 = 100.
  assert.equal(r30.trimMean, 100);
});

test('ladder: left-heavy-tail series — TM monotone non-decreasing in alpha', () => {
  // 10 tiny outliers at bottom, then n=50 base of 1000
  const xs = [
    ...new Array(10).fill(1),
    ...new Array(50).fill(1000),
  ];
  const { r10, r20, r25, r30 } = ladder(mkSeries('a', xs));
  assert.ok(r10.trimMean <= r20.trimMean, `${r10.trimMean} <= ${r20.trimMean}`);
  assert.ok(r20.trimMean <= r25.trimMean, `${r20.trimMean} <= ${r25.trimMean}`);
  assert.ok(r25.trimMean <= r30.trimMean, `${r25.trimMean} <= ${r30.trimMean}`);
  // TM-30 should fully trim the lower outliers
  assert.equal(r30.trimMean, 1000);
});

test('ladder: right-heavy-tail series — |tmMeanGap| monotone non-decreasing in alpha', () => {
  const xs = [
    ...new Array(50).fill(100),
    ...new Array(10).fill(10_000_000),
  ];
  const { r10, r20, r25, r30 } = ladder(mkSeries('a', xs));
  // All gaps negative (raw mean inflated by upper tail)
  assert.ok(r10.tmMeanGap < 0);
  assert.ok(r20.tmMeanGap < 0);
  assert.ok(r25.tmMeanGap < 0);
  assert.ok(r30.tmMeanGap < 0);
  // Magnitudes monotone non-decreasing as more of the contaminated tail is trimmed
  assert.ok(Math.abs(r10.tmMeanGap) <= Math.abs(r20.tmMeanGap));
  assert.ok(Math.abs(r20.tmMeanGap) <= Math.abs(r25.tmMeanGap));
  assert.ok(Math.abs(r25.tmMeanGap) <= Math.abs(r30.tmMeanGap));
});

test('ladder: TM-30 strictly more robust than TM-25 on a series where k differs', () => {
  // n=20: k_25 = floor(5)=5, k_30 = floor(6)=6, so TM-30 trims one more per side.
  const r = rng(20260429);
  const base = Array.from({ length: 20 }, () => Math.floor(r() * 100));
  // Inject one extreme outlier at the top to make TM differ between TM-25 and TM-30.
  const xs = [...base, 1_000_000_000];
  const { r25, r30 } = ladder(mkSeries('a', xs));
  // n=21, k_25=5, k_30=6 — different windows, generally different TMs.
  assert.equal(r25.trimmedPerTail, 5);
  assert.equal(r30.trimmedPerTail, 6);
  // Both must filter out the giant outlier (it sits in the trimmed top tail).
  assert.ok(r25.trimMean < 1_000_000);
  assert.ok(r30.trimMean < 1_000_000);
});
