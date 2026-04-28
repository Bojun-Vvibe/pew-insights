/**
 * Cross-builder ladder property tests for the L-estimator
 * robustness spectrum. Verifies that
 * `source-row-token-winsorized-mean-20` slots into the
 * mean / WM-10 / WM-20 / trim-mean-25 / median ladder in the
 * documented order.
 *
 * Specifically:
 *
 *   - On a heavy-upper-tail series, WM-20's wmMeanGap should be
 *     **at least as negative** as WM-10's wmMeanGap (more
 *     attenuation = larger magnitude gap on the same data).
 *   - On a constant series, both winsorized means equal the
 *     constant and both gaps are exactly zero.
 *   - WM-20's clippedPerTail is always >= WM-10's
 *     clippedPerTail at every n >= 10 (since
 *     floor(0.20 n) >= floor(0.10 n) for all integer n >= 10).
 *   - WM-20's [loBoundary, hiBoundary] always sits INSIDE
 *     WM-10's [loBoundary, hiBoundary] (more aggressive
 *     clipping pulls the boundaries inward).
 *   - WM-20 is at least as robust as WM-10 against a single
 *     extreme outlier injected into a tame body.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenWinsorizedMean10 } from '../src/sourcerowtokenwinsorizedmean10.js';
import { buildSourceRowTokenWinsorizedMean20 } from '../src/sourcerowtokenwinsorizedmean20.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm',
    hour_start,
    device_id: 'd',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-28T12:00:00.000Z';

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

function lcgSeries(n: number, seed: number, mod: number): number[] {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i += 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out.push(s % mod);
  }
  return out;
}

test('ladder: WM-20 clippedPerTail >= WM-10 clippedPerTail at every n', () => {
  for (const n of [10, 11, 13, 19, 20, 21, 49, 50, 99, 100, 137, 256, 500]) {
    const xs = lcgSeries(n, n + 1, 5000);
    const w10 = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const w20 = buildSourceRowTokenWinsorizedMean20(mkSeries('s1', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.ok(
      w20.clippedPerTail >= w10.clippedPerTail,
      `n=${n}: WM-20 k=${w20.clippedPerTail} should be >= WM-10 k=${w10.clippedPerTail}`,
    );
    assert.equal(w20.clippedPerTail, Math.floor(0.2 * n));
    assert.equal(w10.clippedPerTail, Math.floor(0.1 * n));
  }
});

test('ladder: WM-20 [lo,hi] sits inside WM-10 [lo,hi] for any series', () => {
  for (const seed of [1, 7, 31, 127, 511, 2048]) {
    const xs = lcgSeries(50, seed, 100000);
    const w10 = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const w20 = buildSourceRowTokenWinsorizedMean20(mkSeries('s1', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    // More clipping -> tighter boundary interval (larger lo, smaller hi).
    assert.ok(
      w20.loBoundary >= w10.loBoundary,
      `seed=${seed}: WM-20 lo=${w20.loBoundary} should be >= WM-10 lo=${w10.loBoundary}`,
    );
    assert.ok(
      w20.hiBoundary <= w10.hiBoundary,
      `seed=${seed}: WM-20 hi=${w20.hiBoundary} should be <= WM-10 hi=${w10.hiBoundary}`,
    );
  }
});

test('ladder: WM-20 |wmMeanGap| >= WM-10 |wmMeanGap| on heavy-upper-tail series', () => {
  // n=20 right-skew: WM-20 clips 4 from each tail, WM-10 clips 2.
  // The 4 most extreme top rows are pulled to a smaller hi than the
  // 2 most extreme top rows are. That means WM-20 sits strictly below
  // WM-10 on this distribution, so its gap (vs the same shared raw mean)
  // is strictly more negative.
  const xs = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 1000000,
  ];
  const w10 = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const w20 = buildSourceRowTokenWinsorizedMean20(mkSeries('s1', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  // Sanity: same raw mean
  assert.ok(Math.abs(w10.mean - w20.mean) < 1e-9);
  // Both gaps negative (upper-tail-dominant raw mean)
  assert.ok(w10.wmMeanGap < 0);
  assert.ok(w20.wmMeanGap < 0);
  // WM-20 attenuates more aggressively -> |gap_20| >= |gap_10|
  assert.ok(
    Math.abs(w20.wmMeanGap) >= Math.abs(w10.wmMeanGap),
    `|WM-20 gap|=${Math.abs(w20.wmMeanGap)} should be >= |WM-10 gap|=${Math.abs(w10.wmMeanGap)}`,
  );
});

test('ladder: WM-20 is at least as outlier-robust as WM-10 (delta after injecting 10M into a tame body)', () => {
  const base = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const withOutlier = [...base, 10_000_000];
  const w10Base = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', base), {
    generatedAt: GEN,
  }).sources[0]!;
  const w10Out = buildSourceRowTokenWinsorizedMean10(
    mkSeries('s1', withOutlier),
    { generatedAt: GEN },
  ).sources[0]!;
  const w20Base = buildSourceRowTokenWinsorizedMean20(mkSeries('s1', base), {
    generatedAt: GEN,
  }).sources[0]!;
  const w20Out = buildSourceRowTokenWinsorizedMean20(
    mkSeries('s1', withOutlier),
    { generatedAt: GEN },
  ).sources[0]!;
  const delta10 = Math.abs(w10Out.winsorizedMean - w10Base.winsorizedMean);
  const delta20 = Math.abs(w20Out.winsorizedMean - w20Base.winsorizedMean);
  // Both bounded
  assert.ok(delta10 < 100);
  assert.ok(delta20 < 100);
  // WM-20 should not move more than WM-10 on a single-outlier injection.
  // (The 10M row sits in the top tail of both; WM-20 clips it harder.)
  assert.ok(
    delta20 <= delta10 + 1e-6,
    `WM-20 delta=${delta20} should be <= WM-10 delta=${delta10}`,
  );
});

test('ladder: constant series — both WM-10 and WM-20 collapse to the constant', () => {
  const c = 7777;
  const xs = new Array(20).fill(c);
  const w10 = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const w20 = buildSourceRowTokenWinsorizedMean20(mkSeries('s1', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  assert.equal(w10.winsorizedMean, c);
  assert.equal(w20.winsorizedMean, c);
  assert.equal(w10.wmMeanGap, 0);
  assert.equal(w20.wmMeanGap, 0);
});
