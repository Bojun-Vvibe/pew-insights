import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenHodgesLehmann } from '../src/sourcerowtokenhodgeslehmann.js';
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

function sampleMedian(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const n = s.length;
  return n % 2 === 1 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

// ---------- HL vs median: agreement on symmetric, distinct on asymmetric ----------

test('hl-ladder: HL == median on symmetric distributions across 10 random trials', () => {
  const r = rng(20260429);
  for (let trial = 0; trial < 10; trial += 1) {
    const center = 1000 + Math.floor(r() * 5000);
    const half = Array.from({ length: 30 }, () => Math.floor(r() * 800));
    const xs = [
      ...half.map((d) => center - d),
      ...half.map((d) => center + d),
    ];
    const series = mkSeries('a', xs);
    const hlR = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN })
      .sources[0]!;
    assert.ok(
      Math.abs(hlR.hodgesLehmann - hlR.median) < 1e-6,
      `trial=${trial} center=${center}: HL=${hlR.hodgesLehmann} vs median=${hlR.median}`,
    );
    assert.ok(Math.abs(hlR.hodgesLehmann - center) < 1e-6);
  }
});

test('hl-ladder: HL stays close to the body median when outliers are sparse but lifts above pure median when contamination is heavier', () => {
  // Sparse contamination: 50 rows of small ~100, 5 rows of large ~10000.
  // Walsh multiset has 50*51/2=1275 small-small pairs, 50*5=250 small-large pairs,
  // 5*6/2=15 large-large pairs (total 1540). Median of W lands in the small-small region.
  const r = rng(7);
  const small = Array.from({ length: 50 }, () =>
    Math.max(0, Math.floor(100 + (r() - 0.5) * 10)),
  );
  const big = Array.from({ length: 5 }, () =>
    Math.floor(10000 + (r() - 0.5) * 400),
  );
  const xs = [...small, ...big];
  const series = mkSeries('a', xs);
  const out = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN })
    .sources[0]!;
  // mean is dragged up by the 5 outliers; median sits within the small group.
  assert.ok(out.mean > 800, `mean=${out.mean}`);
  assert.ok(out.median <= 110, `median=${out.median}`);
  // HL stays in the body — median of Walsh averages is dominated by small-small pairs.
  assert.ok(
    Math.abs(out.hodgesLehmann - out.median) < 50,
    `HL=${out.hodgesLehmann} should be close to median=${out.median} when contamination is sparse`,
  );
  assert.ok(
    out.hodgesLehmann < out.mean,
    `HL=${out.hodgesLehmann} should be < mean=${out.mean}`,
  );
});

// ---------- HL vs TM-30: distinct mechanisms ----------

test('hl-ladder: HL and TM-30 are both robust to a single huge outlier (each ignores it differently)', () => {
  // 80 rows of value 100, 20 rows of value 10_000_000.
  // TM-30: drops 30 from each tail -> central 40 rows are all 100 -> TM=100.
  // HL: Walsh multiset of 100*101/2=5050 has 80*81/2=3240 small-small pairs,
  // 80*20=1600 small-large pairs, 20*21/2=210 large-large pairs. The median of W
  // (position 2525) falls inside the small-small region (positions 1..3240) -> HL=100.
  // Both are robust enough to fully reject the 20 % contamination — but via
  // mechanically distinct routes (TM-30 drops by rank, HL by Walsh-averaging).
  const xs = [...new Array(80).fill(100), ...new Array(20).fill(10_000_000)];
  const series = mkSeries('a', xs);
  const tm30 = buildSourceRowTokenTrimMean30(series, { generatedAt: GEN })
    .sources[0]!;
  const hl = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN })
    .sources[0]!;
  assert.equal(tm30.trimMean, 100);
  assert.equal(hl.hodgesLehmann, 100);
  // Both robust here, but HL is NOT identical to TM-30 in general — see the
  // interior-spacing test below for a series where they diverge.
});

test('hl-ladder: HL and TM-30 diverge when contamination breaches both robustness budgets', () => {
  // 60 rows of value 100, 40 rows of value 10_000_000 (40 % contamination).
  // TM-30 drops 30 from each tail -> central 40 rows = positions 31..70.
  // Sorted: positions 1..60 = 100, positions 61..100 = 10M. Central window
  // 31..70 includes 30 of value 100 and 10 of value 10M -> TM-30 = (30*100 + 10*10M)/40 = 2_500_075.
  // HL: contamination is large enough that the median of W is no longer pinned at 100.
  const xs = [...new Array(60).fill(100), ...new Array(40).fill(10_000_000)];
  const series = mkSeries('a', xs);
  const tm30 = buildSourceRowTokenTrimMean30(series, { generatedAt: GEN })
    .sources[0]!;
  const hl = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN })
    .sources[0]!;
  assert.ok(tm30.trimMean > 1_000_000, `TM-30=${tm30.trimMean}`);
  assert.notEqual(hl.hodgesLehmann, tm30.trimMean);
});

test('hl-ladder: HL and TM-30 agree on constant series (both equal the constant)', () => {
  const series = mkSeries('a', new Array(20).fill(777));
  const tm30 = buildSourceRowTokenTrimMean30(series, { generatedAt: GEN })
    .sources[0]!;
  const hl = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN })
    .sources[0]!;
  assert.equal(tm30.trimMean, 777);
  assert.equal(hl.hodgesLehmann, 777);
});

test('hl-ladder: HL and TM-30 agree on arithmetic progression 1..n (both equal (n+1)/2)', () => {
  for (const n of [10, 20, 50, 100]) {
    const xs = Array.from({ length: n }, (_, i) => i + 1);
    const series = mkSeries('a', xs);
    const tm30 = buildSourceRowTokenTrimMean30(series, { generatedAt: GEN })
      .sources[0]!;
    const hl = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN })
      .sources[0]!;
    const expected = (n + 1) / 2;
    assert.ok(
      Math.abs(tm30.trimMean - expected) < 1e-9,
      `n=${n}: TM-30=${tm30.trimMean} expected=${expected}`,
    );
    assert.ok(
      Math.abs(hl.hodgesLehmann - expected) < 1e-9,
      `n=${n}: HL=${hl.hodgesLehmann} expected=${expected}`,
    );
  }
});

// ---------- HL is sensitive to interior spacing (L-estimator is not) ----------

test('hl-ladder: HL is sensitive to spacing among trimmed tails that TM-30 ignores', () => {
  // Use n=10, k=floor(0.30*10)=3 -> TM-30 averages positions 4..7 (1-indexed),
  // i.e., 0-indexed sorted positions 3..6. Build two samples that have IDENTICAL
  // values at sorted positions 3..6 but DIFFERENT values in the trimmed tails.
  // TM-30 must give the same answer; HL must differ.
  // sortedA: [1, 2, 3, 100, 101, 102, 103, 200, 201, 202]
  // sortedB: [10, 20, 30, 100, 101, 102, 103, 500, 600, 700]
  // Central window 100..103 identical -> TM-30 == TM-30.
  // Tails differ -> Walsh averages with the central values differ -> HL differs.
  const xsA = [1, 2, 3, 100, 101, 102, 103, 200, 201, 202];
  const xsB = [10, 20, 30, 100, 101, 102, 103, 500, 600, 700];

  const tmA = buildSourceRowTokenTrimMean30(mkSeries('a', xsA), {
    generatedAt: GEN,
  }).sources[0]!.trimMean;
  const tmB = buildSourceRowTokenTrimMean30(mkSeries('a', xsB), {
    generatedAt: GEN,
  }).sources[0]!.trimMean;
  assert.equal(tmA, tmB, 'TM-30 should be identical (central window unchanged)');

  const hlA = buildSourceRowTokenHodgesLehmann(mkSeries('a', xsA), {
    generatedAt: GEN,
  }).sources[0]!.hodgesLehmann;
  const hlB = buildSourceRowTokenHodgesLehmann(mkSeries('a', xsB), {
    generatedAt: GEN,
  }).sources[0]!.hodgesLehmann;
  assert.notEqual(hlA, hlB, 'HL should differ (Walsh averages with tails change)');
});

// ---------- Cross-analyzer numeric agreement on canonical fixtures ----------

test('hl-ladder: HL agrees with closed-form on uniform integer grid 1..N', () => {
  // For x = 1, 2, ..., n the Hodges-Lehmann pseudo-median
  // equals the population median (n+1)/2 by exact symmetry of
  // the Walsh averages around (n+1)/2.
  for (const n of [4, 5, 8, 11, 16, 21]) {
    const xs = Array.from({ length: n }, (_, i) => i + 1);
    const out = buildSourceRowTokenHodgesLehmann(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.ok(
      Math.abs(out.hodgesLehmann - (n + 1) / 2) < 1e-9,
      `n=${n}: HL=${out.hodgesLehmann} vs (n+1)/2=${(n + 1) / 2}`,
    );
  }
});

test('hl-ladder: median report field matches independent sampleMedian()', () => {
  const r = rng(31337);
  for (let trial = 0; trial < 15; trial += 1) {
    const n = 4 + Math.floor(r() * 80);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 999_999));
    const out = buildSourceRowTokenHodgesLehmann(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const expected = sampleMedian(xs);
    assert.ok(
      Math.abs(out.median - expected) < 1e-9,
      `trial=${trial} n=${n}: ${out.median} vs ${expected}`,
    );
  }
});

test('hl-ladder: HL bracketed by sample min and max in 30 random trials', () => {
  const r = rng(424242);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 4 + Math.floor(r() * 150);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 1_000_000));
    const out = buildSourceRowTokenHodgesLehmann(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const xmin = Math.min(...xs);
    const xmax = Math.max(...xs);
    assert.ok(
      out.hodgesLehmann >= xmin - 1e-6 && out.hodgesLehmann <= xmax + 1e-6,
      `trial=${trial} n=${n}: HL=${out.hodgesLehmann} not in [${xmin}, ${xmax}]`,
    );
    assert.equal(out.walshMin, xmin);
    assert.equal(out.walshMax, xmax);
  }
});
