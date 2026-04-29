/**
 * Unit + integration tests for source-row-token-slope-ci-precision-pull.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiPrecisionPull,
  renderSourceRowTokenSlopeCiPrecisionPull,
  precisionPull,
  giniOfWeights,
  SLOPE_PRECISION_PULL_LENS_NAMES,
} from '../src/sourcerowtokenslopeciprecisionpull.js';
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

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

function ascending(source: string, n: number, slope = 10, base = 100): QueueLine[] {
  const vals: number[] = [];
  for (let i = 0; i < n; i++) vals.push(base + i * slope);
  return mkSeries(source, vals);
}

// --- giniOfWeights ---

test('giniOfWeights: empty vector -> 0', () => {
  assert.equal(giniOfWeights([]), 0);
});

test('giniOfWeights: equal weights -> 0', () => {
  const eq = new Array(6).fill(1 / 6);
  assert.ok(Math.abs(giniOfWeights(eq) - 0) < 1e-12);
});

test('giniOfWeights: one lens has all the weight -> (n-1)/n', () => {
  const w = [1, 0, 0, 0, 0, 0];
  // Standard formula: G = sum|wi-wj| / (2n*sum). For n=6 sum=1, with one
  // entry=1: each pair (1, x) and (x, 1) contributes 1+1=2 across the 5
  // other entries -> 2*(2*5)=20? Recompute: sum_i sum_j |wi-wj|. Pairs
  // where one is the 1 and other is 0 contribute 1, count = 2*5=10.
  // All others = 0. So G = 10 / (2*6*1) = 10/12 = 5/6.
  assert.ok(Math.abs(giniOfWeights(w) - 5 / 6) < 1e-12);
});

test('giniOfWeights: zero-sum vector -> 0', () => {
  assert.equal(giniOfWeights([0, 0, 0, 0, 0, 0]), 0);
});

// --- precisionPull: pure helper ---

test('precisionPull: rejects wrong-length midpoint vector', () => {
  assert.throws(() => precisionPull([1, 2, 3], [1, 1, 1, 1, 1, 1]));
});

test('precisionPull: rejects wrong-length width vector', () => {
  assert.throws(() => precisionPull([1, 2, 3, 4, 5, 6], [1, 1, 1]));
});

test('precisionPull: rejects negative widths', () => {
  assert.throws(() =>
    precisionPull([1, 2, 3, 4, 5, 6], [1, 1, -1, 1, 1, 1]),
  );
});

test('precisionPull: rejects non-finite widths', () => {
  assert.throws(() =>
    precisionPull([1, 2, 3, 4, 5, 6], [1, 1, NaN, 1, 1, 1]),
  );
});

test('precisionPull: equal widths -> precisionMid == equalMid; pull = 0; alignment = 1', () => {
  const r = precisionPull([1, 2, 3, 4, 5, 6], [2, 2, 2, 2, 2, 2]);
  assert.equal(r.equalMid, 3.5);
  assert.equal(r.equalWidth, 2);
  assert.ok(Math.abs(r.precisionMid - 3.5) < 1e-12);
  assert.equal(r.signedPull, 0);
  assert.equal(r.pull, 0);
  assert.equal(r.pullStd, 0);
  assert.equal(r.pullDirection, 'neutral');
  assert.equal(r.precisionAlignmentScore, 1);
  // All weights equal -> Gini ~ 0
  assert.ok(r.weightGini < 1e-12);
  for (const s of r.weightShares) {
    assert.ok(Math.abs(s - 1 / 6) < 1e-12);
  }
});

test('precisionPull: identical midpoints -> pull = 0 regardless of widths', () => {
  const r = precisionPull([7, 7, 7, 7, 7, 7], [1, 2, 3, 4, 5, 6]);
  assert.ok(Math.abs(r.precisionMid - 7) < 1e-12);
  assert.ok(Math.abs(r.pull) < 1e-12);
  assert.ok(r.precisionAlignmentScore >= 1 - 1e-12);
  // Weights are NOT equal (Gini > 0) but pull is still 0.
  assert.ok(r.weightGini > 0);
});

test('precisionPull: all widths 0 -> equal-weight fallback', () => {
  const r = precisionPull([1, 2, 3, 4, 5, 6], [0, 0, 0, 0, 0, 0]);
  assert.equal(r.equalMid, 3.5);
  assert.equal(r.equalWidth, 0);
  assert.equal(r.precisionMid, 3.5);
  assert.equal(r.pull, 0);
  assert.equal(r.pullStd, 0);
  assert.equal(r.precisionAlignmentScore, 1);
  for (const s of r.weightShares) {
    assert.ok(Math.abs(s - 1 / 6) < 1e-12);
  }
  assert.ok(r.weightGini < 1e-12);
});

test('precisionPull: one zero-width lens absorbs all the weight', () => {
  // Lens 2 (bca) is degenerate - infinitely precise.
  const r = precisionPull([10, 10, 99, 10, 10, 10], [1, 1, 0, 1, 1, 1]);
  assert.equal(r.precisionMid, 99);
  assert.equal(r.weightShares[2], 1);
  for (let i = 0; i < 6; i++) {
    if (i !== 2) assert.equal(r.weightShares[i], 0);
  }
  assert.equal(r.dominantLens, 'bca');
  assert.equal(r.dominantWeightShare, 1);
});

test('precisionPull: two zero-width lenses split the weight equally', () => {
  // Lens 0 and lens 5 are both degenerate.
  const r = precisionPull([20, 5, 5, 5, 5, 40], [0, 1, 1, 1, 1, 0]);
  assert.equal(r.precisionMid, 30); // (20+40)/2
  assert.equal(r.weightShares[0], 0.5);
  assert.equal(r.weightShares[5], 0.5);
  for (let i = 1; i <= 4; i++) assert.equal(r.weightShares[i], 0);
});

test('precisionPull: tighter lens pulls consensus toward its midpoint', () => {
  // Five lenses say slope ~ 10 with width 10; one lens (bca) says slope = 100
  // with width 1 (much tighter). PrecisionMid should pull strongly toward 100.
  const r = precisionPull([10, 10, 100, 10, 10, 10], [10, 10, 1, 10, 10, 10]);
  assert.equal(r.equalMid, (10 * 5 + 100) / 6);
  assert.ok(r.precisionMid > r.equalMid); // pulled UP toward 100
  assert.equal(r.pullDirection, 'up');
  assert.ok(r.signedPull > 0);
  assert.equal(r.dominantLens, 'bca');
  // bca weight = 1/1 = 1; others = 1/10 each, total = 1 + 5*0.1 = 1.5
  assert.ok(Math.abs(r.dominantWeightShare - 1 / 1.5) < 1e-12);
  assert.equal(r.mostPrecisionPullingLens, 'bca');
});

test('precisionPull: signedPull negative when tight lens is below equalMid', () => {
  // bca is tight and LOW; others say high.
  const r = precisionPull(
    [100, 100, 1, 100, 100, 100],
    [10, 10, 1, 10, 10, 10],
  );
  assert.ok(r.signedPull < 0);
  assert.equal(r.pullDirection, 'down');
});

test('precisionPull: pullStd is unitless and uses equalWidth', () => {
  const r = precisionPull([10, 10, 100, 10, 10, 10], [10, 10, 1, 10, 10, 10]);
  // Manually verify pullStd = pull / equalWidth
  const equalWidth = (10 * 5 + 1) / 6;
  assert.ok(Math.abs(r.equalWidth - equalWidth) < 1e-12);
  assert.ok(Math.abs(r.pullStd - r.pull / equalWidth) < 1e-12);
});

test('precisionPull: mostPrecisionPullingLens defaults to dominantLens when no lens above-average', () => {
  // All weights equal -> none is above 1/6; should default to dominantLens
  // (canonical-order tie-break = bootstrap).
  const r = precisionPull([1, 2, 3, 4, 5, 6], [1, 1, 1, 1, 1, 1]);
  assert.equal(r.dominantLens, 'bootstrap');
  assert.equal(r.mostPrecisionPullingLens, 'bootstrap');
});

test('precisionPull: weight shares always sum to 1', () => {
  const r = precisionPull([1, 2, 3, 4, 5, 6], [1.5, 0.7, 3.2, 0.1, 4, 2]);
  let s = 0;
  for (const w of r.weightShares) s += w;
  assert.ok(Math.abs(s - 1) < 1e-12);
});

// --- buildSourceRowTokenSlopeCiPrecisionPull: integration ---

test('build: validates minRows', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiPrecisionPull([], { minRows: 3 }),
  );
});

test('build: validates confidence', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiPrecisionPull([], { confidence: 1.5 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiPrecisionPull([], { confidence: 0 }),
  );
});

test('build: validates lambda', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiPrecisionPull([], { lambda: -1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiPrecisionPull([], { lambda: 0 }),
  );
});

test('build: validates bootstraps', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiPrecisionPull([], { bootstraps: 50 }),
  );
});

test('build: validates seed (must be integer)', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiPrecisionPull([], { seed: 1.5 }),
  );
});

test('build: validates alertMisaligned in (0, 1]', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiPrecisionPull([], { alertMisaligned: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiPrecisionPull([], { alertMisaligned: 1.5 }),
  );
});

test('build: validates top (positive integer)', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiPrecisionPull([], { top: 0 }),
  );
});

test('build: validates sort key', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiPrecisionPull([], {
      sort: 'bogus' as 'alignment-desc',
    }),
  );
});

test('build: empty queue -> empty report with zero aggregates', () => {
  const r = buildSourceRowTokenSlopeCiPrecisionPull([], {
    bootstraps: 200,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.droppedMissingLens, 0);
  assert.equal(r.rows.length, 0);
  assert.equal(r.meanPrecisionAlignment, 0);
  assert.equal(r.medianPrecisionAlignment, 0);
  assert.equal(r.meanWeightGini, 0);
  assert.equal(r.globalDominantLens, null);
  assert.equal(r.globalPullDirection, null);
});

test('build: ascending source produces a row with computed precisionPull fields', () => {
  const queue = ascending('s1', 30, 5);
  const r = buildSourceRowTokenSlopeCiPrecisionPull(queue, {
    bootstraps: 200,
    seed: 42,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.rows.length, 1);
  const row = r.rows[0]!;
  assert.equal(row.source, 's1');
  assert.ok(row.rowsKept >= 4);
  assert.equal(row.weightShares.length, 6);
  // weights sum to 1
  let s = 0;
  for (const w of row.weightShares) s += w;
  assert.ok(Math.abs(s - 1) < 1e-9);
  // alignment in (0, 1]
  assert.ok(row.precisionAlignmentScore > 0);
  assert.ok(row.precisionAlignmentScore <= 1);
  // dominantLens is one of the canonical names
  assert.ok(SLOPE_PRECISION_PULL_LENS_NAMES.includes(row.dominantLens));
  // direction matches signedPull sign
  if (row.signedPull > 0) assert.equal(row.pullDirection, 'up');
  else if (row.signedPull < 0) assert.equal(row.pullDirection, 'down');
  else assert.equal(row.pullDirection, 'neutral');
});

test('build: alertMisaligned filter drops aligned sources', () => {
  // Two sources, both very stable -> alertMisaligned 0.5 should drop both
  const queue = [
    ...ascending('s1', 30, 5),
    ...ascending('s2', 30, 7),
  ];
  const baseline = buildSourceRowTokenSlopeCiPrecisionPull(queue, {
    bootstraps: 200,
    seed: 42,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  // Both should be very well-aligned
  for (const r of baseline.rows) {
    assert.ok(r.precisionAlignmentScore > 0.5);
  }
  const filtered = buildSourceRowTokenSlopeCiPrecisionPull(queue, {
    bootstraps: 200,
    seed: 42,
    alertMisaligned: 0.5,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(filtered.rows.length, 0);
  assert.equal(filtered.droppedAboveAlert, baseline.rows.length);
});

test('build: top caps the output', () => {
  const queue = [
    ...ascending('s1', 30, 5),
    ...ascending('s2', 30, 7),
    ...ascending('s3', 30, 3),
  ];
  const r = buildSourceRowTokenSlopeCiPrecisionPull(queue, {
    bootstraps: 200,
    seed: 42,
    top: 2,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.ok(r.rows.length <= 2);
});

test('build: sort=source orders alphabetically', () => {
  const queue = [
    ...ascending('zeta', 30, 5),
    ...ascending('alpha', 30, 7),
    ...ascending('mid', 30, 3),
  ];
  const r = buildSourceRowTokenSlopeCiPrecisionPull(queue, {
    bootstraps: 200,
    seed: 42,
    sort: 'source',
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const sources = r.rows.map((x) => x.source);
  assert.deepEqual(sources, [...sources].sort());
});

test('render: pretty output mentions header and columns', () => {
  const queue = ascending('s1', 30, 5);
  const r = buildSourceRowTokenSlopeCiPrecisionPull(queue, {
    bootstraps: 200,
    seed: 42,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionPull(r);
  assert.ok(out.includes('source-row-token-slope-ci-precision-pull'));
  assert.ok(out.includes('precisionMid'));
  assert.ok(out.includes('dominantLens'));
});

test('render: empty rows -> "(no sources)"', () => {
  const out = renderSourceRowTokenSlopeCiPrecisionPull({
    generatedAt: '2026-04-30T00:00:00.000Z',
    windowStart: null,
    windowEnd: null,
    source: null,
    minRows: 4,
    confidence: 0.95,
    lambda: 1,
    bootstraps: 1000,
    seed: 42,
    alertMisaligned: null,
    top: null,
    sort: 'alignment-desc',
    totalSources: 0,
    sourcesWithAllLenses: 0,
    droppedMissingLens: 0,
    droppedAboveAlert: 0,
    meanPrecisionAlignment: 0,
    medianPrecisionAlignment: 0,
    meanWeightGini: 0,
    globalDominantLens: null,
    globalPullDirection: null,
    rows: [],
  });
  assert.ok(out.includes('(no sources)'));
});

test('render: showWeights appends 6-row sub-table', () => {
  const queue = ascending('s1', 30, 5);
  const r = buildSourceRowTokenSlopeCiPrecisionPull(queue, {
    bootstraps: 200,
    seed: 42,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionPull(r, { showWeights: true });
  assert.ok(out.includes('weightShare'));
  for (const lens of SLOPE_PRECISION_PULL_LENS_NAMES) {
    assert.ok(out.includes(lens));
  }
});

test('render: showPullSummary appends a one-line directional summary per source', () => {
  const queue = ascending('s1', 30, 5);
  const r = buildSourceRowTokenSlopeCiPrecisionPull(queue, {
    bootstraps: 200,
    seed: 42,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionPull(r, {
    showPullSummary: true,
  });
  assert.ok(out.includes('summary: dominant'));
  assert.ok(out.includes('signedPull='));
  // arrow appears
  assert.ok(out.includes('^') || out.includes('v') || out.includes('='));
});

test('render: showPullSummary off by default', () => {
  const queue = ascending('s1', 30, 5);
  const r = buildSourceRowTokenSlopeCiPrecisionPull(queue, {
    bootstraps: 200,
    seed: 42,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionPull(r);
  assert.ok(!out.includes('summary: dominant'));
});
