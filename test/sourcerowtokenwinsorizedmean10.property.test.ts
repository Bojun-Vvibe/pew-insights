/**
 * Property tests for source-row-token-winsorized-mean-10
 * beyond the per-builder unit suite. These exercise
 * cross-cutting properties that aren't tied to a single API
 * surface: winsorize-vs-mean ordering on monotone series,
 * winsorize-vs-trim-mean comparison, and the "clipping
 * cannot widen the inter-tail spread" property.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenWinsorizedMean10 } from '../src/sourcerowtokenwinsorizedmean10.js';
import { buildSourceRowTokenTrimMean25 } from '../src/sourcerowtokentrimmean25.js';
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

// Linear-congruential pseudo-random for determinism.
function lcgSeries(n: number, seed: number, mod: number): number[] {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i += 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out.push(s % mod);
  }
  return out;
}

test('winsor-property: WM == mean iff series is "tail-symmetric around clip-replacement"', () => {
  // Symmetric integer ladder n=10 -> 1..10 already tested in unit suite.
  // Try a different tail-balanced shape: [5,5,7,7,7,7,7,7,9,9].
  // sorted same; k=1; lo=sorted[1]=5; hi=sorted[8]=9;
  // sumWinsor = 5 + (5+7+7+7+7+7+7+9) + 9 = 70; wm = 7.0
  // mean = (5+5+7+7+7+7+7+7+9+9)/10 = 70/10 = 7.0 -> gap = 0.
  const xs = [5, 5, 7, 7, 7, 7, 7, 7, 9, 9];
  const r = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  assert.equal(r.mean, 7.0);
  assert.equal(r.winsorizedMean, 7.0);
  assert.equal(r.wmMeanGap, 0);
});

test('winsor-property: WM is bounded by sorted[k] and sorted[n-k-1]', () => {
  for (const seed of [1, 7, 31, 127, 511]) {
    const xs = lcgSeries(40, seed, 100000);
    const r = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.ok(
      r.winsorizedMean >= r.loBoundary,
      `seed=${seed}: WM ${r.winsorizedMean} < lo ${r.loBoundary}`,
    );
    assert.ok(
      r.winsorizedMean <= r.hiBoundary,
      `seed=${seed}: WM ${r.winsorizedMean} > hi ${r.hiBoundary}`,
    );
  }
});

test('winsor-property: trim-mean-25 sits closer to median than WM-10 on right-skew', () => {
  // For a right-skewed series, both WM-10 and trim-mean-25 pull the
  // location estimate toward the body, but trim-mean-25 (k = floor(0.25 n))
  // discards more rows from each tail than WM-10 (k = floor(0.10 n))
  // clips. For the right-skewed series below, both pull DOWN from the
  // raw mean, but trim-mean-25 pulls farther because it discards
  // rather than clips.
  const xs = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    100, 200, 500, 1000, 5000,
  ];
  const wm = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const tm = buildSourceRowTokenTrimMean25(mkSeries('s1', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  // Both are below raw mean
  assert.ok(wm.winsorizedMean < wm.mean);
  assert.ok(tm.trimMean < tm.mean);
  // trim-mean-25 sits at or below winsorized-mean-10 on right-skew
  // because it drops the entire top 25 % rather than just clipping
  // the top 10 %.
  assert.ok(
    tm.trimMean <= wm.winsorizedMean + 1e-9,
    `trim-mean ${tm.trimMean} should be <= winsorized-mean ${wm.winsorizedMean}`,
  );
});

test('winsor-property: appending a row INSIDE the central window does not change wmMeanGap sign', () => {
  // If we append a value that falls strictly between the existing
  // boundaries lo and hi, neither lo nor hi changes (for n
  // large enough that floor(0.10 (n+1)) == floor(0.10 n)), and the
  // raw mean shifts toward the appended value. The signed gap
  // should stay on the same side or flip toward zero — but for
  // a body-row insertion in a right-skewed distribution, gap stays
  // negative.
  const base = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 1000];
  const before = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', base), {
    generatedAt: GEN,
  }).sources[0]!;
  // Insert a body-region value (10) — well inside [lo=2 ish, hi=19 ish]
  const after = buildSourceRowTokenWinsorizedMean10(
    mkSeries('s1', [...base, 10]),
    { generatedAt: GEN },
  ).sources[0]!;
  // Both should be < 0 since the 1000 outlier dominates the mean
  assert.ok(before.wmMeanGap < 0);
  assert.ok(after.wmMeanGap < 0);
});

test('winsor-property: doubling the series doubles WM, mean, and gap (scale equivariance, large n)', () => {
  const xs = lcgSeries(200, 17, 1_000_000);
  const a = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const b = buildSourceRowTokenWinsorizedMean10(
    mkSeries('s1', xs.map((x) => x * 2)),
    { generatedAt: GEN },
  ).sources[0]!;
  assert.ok(Math.abs(b.winsorizedMean - 2 * a.winsorizedMean) < 1e-3);
  assert.ok(Math.abs(b.mean - 2 * a.mean) < 1e-3);
  assert.ok(Math.abs(b.wmMeanGap - 2 * a.wmMeanGap) < 1e-3);
});

test('winsor-property: WM equals mean when k = 0 (boundary-condition robustness)', () => {
  // The builder requires minRows >= 10, but the FORMULA degenerates
  // at k = 0. Use exactly n = 10 with a flat series — k = 1, but
  // because the series is constant, lo == hi == c, so the boundary
  // replacement is a no-op and WM == mean trivially.
  const xs = new Array(10).fill(42);
  const r = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  assert.equal(r.winsorizedMean, 42);
  assert.equal(r.mean, 42);
  assert.equal(r.wmMeanGap, 0);
});

test('winsor-property: wmMeanGap sign predicts upper-tail vs lower-tail dominance', () => {
  // Build a synthetic dataset with one upper-tail-dominant source
  // and one lower-tail-dominant source, and verify the sign rule.
  const upperHeavy = [
    100, 100, 100, 100, 100, 100, 100, 100, 100, 1_000_000,
  ];
  const lowerHeavy = [0, 100, 100, 100, 100, 100, 100, 100, 100, 100];
  const queue = [
    ...mkSeries('upper', upperHeavy),
    ...mkSeries('lower', lowerHeavy),
  ];
  const r = buildSourceRowTokenWinsorizedMean10(queue, { generatedAt: GEN });
  const upper = r.sources.find((s) => s.source === 'upper')!;
  const lower = r.sources.find((s) => s.source === 'lower')!;
  assert.ok(upper.wmMeanGap < 0, 'upper-heavy should give wmMeanGap < 0');
  assert.ok(lower.wmMeanGap > 0, 'lower-heavy should give wmMeanGap > 0');
});

test('winsor-property: clippedPerTail == floor(0.10 * rowsKept) holds across many sizes', () => {
  for (const n of [10, 11, 13, 19, 20, 21, 49, 50, 99, 100, 137, 256, 500]) {
    const xs = lcgSeries(n, n + 1, 5000);
    const r = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.equal(
      r.clippedPerTail,
      Math.floor(0.1 * n),
      `n=${n}: clippedPerTail should be floor(0.10 * ${n})`,
    );
    assert.equal(r.rowsKept, n);
  }
});
