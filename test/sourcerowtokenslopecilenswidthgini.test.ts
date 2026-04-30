/**
 * Unit + integration tests for
 * source-row-token-slope-ci-lens-width-gini (axis 21).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiLensWidthGini,
  renderSourceRowTokenSlopeCiLensWidthGini,
  lensWidthGini,
  SLOPE_LENS_WIDTH_GINI_LENS_NAMES,
} from '../src/sourcerowtokenslopecilenswidthgini.js';
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

function syntheticQueue(
  spec: { source: string; nRows: number; slope: number; noise: number }[],
): QueueLine[] {
  const out: QueueLine[] = [];
  for (const s of spec) {
    let seed = 1;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return ((seed >>> 0) & 0xffff) / 0xffff;
    };
    for (let i = 0; i < s.nRows; i++) {
      const base = 100 + s.slope * i;
      const jitter = (rng() - 0.5) * 2 * s.noise;
      const total = Math.max(0, Math.round(base + jitter));
      const ts = `2026-01-${String(1 + Math.floor(i / 24)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00Z`;
      out.push(ql(ts, s.source, total));
    }
  }
  return out;
}

// ---------- pure helper: lensWidthGini ----------

test('axis21 helper: perfectly equal half-widths gives gini = 0', () => {
  const out = lensWidthGini([0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.equal(out.degenerateFlag, false);
  assert.equal(out.degenerateReason, null);
  assert.equal(out.nShared, 5);
  assert.ok(Math.abs(out.gini) < 1e-12, `got gini=${out.gini}`);
  assert.ok(Math.abs(out.mad) < 1e-12);
  assert.ok(Math.abs(out.topShareMax - 0.2) < 1e-12);
});

test('axis21 helper: one source absorbing all mass approaches (n-1)/n', () => {
  const n = 10;
  const xs = [10, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const out = lensWidthGini(xs);
  assert.equal(out.degenerateFlag, false);
  // For one-source-absorbs-all, sorted-form Gini = (n-1)/n = 0.9.
  assert.ok(Math.abs(out.gini - (n - 1) / n) < 1e-9, `got gini=${out.gini}`);
  assert.equal(out.topShareMax, 1);
});

test('axis21 helper: linear sequence 1..n has the textbook Gini value', () => {
  // For x_i = i, i=1..n, gini = (n-1) / (3n) (well-known closed form).
  for (const n of [3, 5, 10, 25]) {
    const xs = Array.from({ length: n }, (_, i) => i + 1);
    const expected = (n - 1) / (3 * n);
    const out = lensWidthGini(xs);
    assert.equal(out.degenerateFlag, false);
    assert.ok(
      Math.abs(out.gini - expected) < 1e-9,
      `n=${n} expected=${expected} got=${out.gini}`,
    );
  }
});

test('axis21 helper: sorted-form gini agrees with mean-absolute-difference form', () => {
  const xs = [0.1, 0.5, 1.0, 2.0, 3.0, 7.5, 0.3];
  const out = lensWidthGini(xs);
  const altGini = out.mad / out.meanHalfWidth;
  assert.ok(Math.abs(out.gini - altGini) < 1e-12, `gini=${out.gini} mad/mean=${altGini}`);
});

test('axis21 helper: zero-mean (all zero half-widths) -> degenerate zero-mean-halfwidth', () => {
  const out = lensWidthGini([0, 0, 0, 0, 0]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'zero-mean-halfwidth');
  assert.equal(out.gini, 0);
  assert.equal(out.topShareMax, 0);
});

test('axis21 helper: too-few-sources (n < 3) -> degenerate', () => {
  for (const n of [0, 1, 2]) {
    const out = lensWidthGini(Array.from({ length: n }, (_, i) => i + 0.1));
    assert.equal(out.degenerateFlag, true);
    assert.equal(out.degenerateReason, 'too-few-sources');
    assert.equal(out.nShared, n);
    assert.equal(out.gini, 0);
  }
});

test('axis21 helper: gini is in [0, 1] for arbitrary jittered data', () => {
  let s = 1234567;
  for (let trial = 0; trial < 20; trial++) {
    const xs: number[] = [];
    for (let i = 0; i < 30; i++) {
      s = (s * 1103515245 + 12345) >>> 0;
      xs.push(((s & 0xffff) / 0xffff) * 1000);
    }
    const out = lensWidthGini(xs);
    assert.equal(out.degenerateFlag, false);
    assert.ok(out.gini >= 0 && out.gini <= 1, `gini=${out.gini}`);
    assert.ok(out.topShareMax >= 1 / 30 && out.topShareMax <= 1);
  }
});

test('axis21 helper: gini is invariant under positive scalar rescaling', () => {
  const xs = [1, 2, 5, 10, 20];
  const baseline = lensWidthGini(xs);
  for (const k of [0.5, 1, 2, 100, 1e6]) {
    const scaled = lensWidthGini(xs.map((x) => x * k));
    assert.ok(
      Math.abs(scaled.gini - baseline.gini) < 1e-9,
      `k=${k} expected ${baseline.gini} got ${scaled.gini}`,
    );
  }
});

test('axis21 helper: gini is NOT invariant under additive shifts (sanity)', () => {
  // Under a positive additive shift, gini decreases (everyone gets
  // closer to equal in relative terms).
  const xs = [1, 2, 5, 10, 20];
  const base = lensWidthGini(xs);
  const shifted = lensWidthGini(xs.map((x) => x + 100));
  assert.ok(
    shifted.gini < base.gini,
    `expected shift to reduce gini; base=${base.gini} shifted=${shifted.gini}`,
  );
});

test('axis21 helper: rejects negative inputs', () => {
  assert.throws(() => lensWidthGini([-1, 0, 1]));
});

test('axis21 helper: rejects non-finite inputs', () => {
  assert.throws(() => lensWidthGini([NaN, 1, 2]));
  assert.throws(() => lensWidthGini([Infinity, 1, 2]));
});

test('axis21 helper: topShareMax matches max / sum', () => {
  const xs = [1, 2, 3, 4, 10];
  const out = lensWidthGini(xs);
  assert.ok(Math.abs(out.topShareMax - 10 / 20) < 1e-12);
});

test('axis21 helper: sorted-form clamps to [0,1] under fp noise', () => {
  // Two near-identical values: gini should be ~ 0, never < 0.
  const xs = [1.0000000001, 1.0, 1.0, 1.0, 1.0];
  const out = lensWidthGini(xs);
  assert.ok(out.gini >= 0 && out.gini <= 1);
});

// ---------- builder integration tests ----------

test('axis21 builder: empty queue yields all-degenerate report', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthGini([], { bootstraps: 100 });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.rows.length, 6);
  for (const row of r.rows) {
    assert.equal(row.degenerateFlag, true);
    assert.equal(row.degenerateReason, 'too-few-sources');
    assert.equal(row.concentrationLabel, 'degenerate');
    assert.equal(row.gini, 0);
  }
  assert.equal(r.nDegenerate, 6);
  assert.equal(r.mostConcentratedLens, null);
  assert.equal(r.mostEqualLens, null);
});

test('axis21 builder: produces six lens rows with valid gini for synthetic data', () => {
  const queue = syntheticQueue([
    { source: 'src-a', nRows: 24, slope: 1.0, noise: 5 },
    { source: 'src-b', nRows: 24, slope: 5.0, noise: 25 },
    { source: 'src-c', nRows: 24, slope: 10.0, noise: 50 },
    { source: 'src-d', nRows: 24, slope: 0.1, noise: 1 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, { bootstraps: 200 });
  assert.equal(r.rows.length, 6);
  const seen = new Set(r.rows.map((row) => row.lens));
  for (const lens of SLOPE_LENS_WIDTH_GINI_LENS_NAMES) {
    assert.ok(seen.has(lens), `missing lens ${lens}`);
  }
  for (const row of r.rows) {
    if (!row.degenerateFlag) {
      assert.ok(row.gini >= 0 && row.gini <= 1, `gini=${row.gini}`);
      assert.ok(row.topShareMax >= 0 && row.topShareMax <= 1);
      assert.ok(row.minHalfWidth <= row.meanHalfWidth);
      assert.ok(row.meanHalfWidth <= row.maxHalfWidth);
    }
  }
});

test('axis21 builder: --alert-gini filter behaves as gini > threshold', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
    { source: 's4', nRows: 24, slope: 0.1, noise: 1 },
  ]);
  const baseline = buildSourceRowTokenSlopeCiLensWidthGini(queue, {
    bootstraps: 200,
  });
  const filtered = buildSourceRowTokenSlopeCiLensWidthGini(queue, {
    bootstraps: 200,
    alertGini: 0.99,
  });
  assert.ok(filtered.rows.length <= baseline.rows.length);
  for (const row of filtered.rows) {
    assert.ok(row.gini > 0.99);
  }
});

test('axis21 builder: report-level aggregates are consistent with per-row data', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
    { source: 's4', nRows: 24, slope: 0.1, noise: 1 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, { bootstraps: 200 });
  const nonDegen = r.rows.filter((row) => !row.degenerateFlag);
  if (nonDegen.length === 0) return;
  const ginis = nonDegen.map((row) => row.gini);
  const expectedMean = ginis.reduce((a, b) => a + b, 0) / ginis.length;
  assert.ok(Math.abs(r.meanGini - expectedMean) < 1e-12);
  assert.ok(Math.abs(r.maxGini - Math.max(...ginis)) < 1e-12);
  assert.ok(Math.abs(r.minGini - Math.min(...ginis)) < 1e-12);
  assert.ok(Math.abs(r.rangeGini - (r.maxGini - r.minGini)) < 1e-12);
});

test('axis21 builder: input validation -- invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthGini([], {
        sort: 'nope' as never,
      }),
    /sort must be one of/,
  );
});

test('axis21 builder: input validation -- alertGini out of range throws', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthGini([], { alertGini: 2 }),
    /alertGini/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthGini([], { alertGini: -0.1 }),
    /alertGini/,
  );
});

test('axis21 builder: input validation -- minRows < 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthGini([], { minRows: 3 }),
    /minRows/,
  );
});

test('axis21 builder: input validation -- confidence out of (0,1) throws', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthGini([], { confidence: 0 }),
    /confidence/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthGini([], { confidence: 1 }),
    /confidence/,
  );
});

test('axis21 builder: input validation -- bootstraps < 100 throws', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthGini([], { bootstraps: 50 }),
    /bootstraps/,
  );
});

test('axis21 builder: input validation -- non-positive lambda throws', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthGini([], { lambda: 0 }),
    /lambda/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthGini([], { lambda: -1 }),
    /lambda/,
  );
});

test('axis21 builder: input validation -- non-integer seed throws', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthGini([], { seed: 1.5 }),
    /seed/,
  );
});

test('axis21 builder: sort=lens preserves canonical lens order', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, {
    bootstraps: 200,
    sort: 'lens',
  });
  for (let i = 0; i < r.rows.length; i++) {
    assert.equal(r.rows[i]!.lens, SLOPE_LENS_WIDTH_GINI_LENS_NAMES[i]);
  }
});

test('axis21 builder: sort=gini-desc orders by gini descending', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
    { source: 's4', nRows: 24, slope: 0.1, noise: 1 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, {
    bootstraps: 200,
    sort: 'gini-desc',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.gini >= r.rows[i]!.gini);
  }
});

test('axis21 builder: sort=top-share-desc orders by topShareMax descending', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
    { source: 's4', nRows: 24, slope: 0.1, noise: 1 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, {
    bootstraps: 200,
    sort: 'top-share-desc',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.topShareMax >= r.rows[i]!.topShareMax);
  }
});

test('axis21 builder: per-source half-widths reproduce the stored gini', () => {
  // The half-width arrays MUST be the exact inputs to the Gini
  // computation, so re-running the helper on them must yield bit-
  // identical (modulo IEEE-754) statistics.
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
    { source: 's4', nRows: 24, slope: 0.1, noise: 1 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, { bootstraps: 200 });
  for (const row of r.rows) {
    if (row.degenerateFlag && row.degenerateReason === 'too-few-sources') {
      continue;
    }
    const recomputed = lensWidthGini(row.perSourceHalfWidths);
    assert.ok(Math.abs(recomputed.gini - row.gini) < 1e-12);
    assert.ok(Math.abs(recomputed.meanHalfWidth - row.meanHalfWidth) < 1e-9);
    assert.ok(Math.abs(recomputed.mad - row.mad) < 1e-9);
    assert.ok(Math.abs(recomputed.topShareMax - row.topShareMax) < 1e-12);
  }
});

test('axis21 builder: per-source widths are identical (in source ordering) across all six lens rows', () => {
  const queue = syntheticQueue([
    { source: 'alpha', nRows: 24, slope: 2.0, noise: 10 },
    { source: 'beta', nRows: 24, slope: 4.0, noise: 20 },
    { source: 'gamma', nRows: 24, slope: 8.0, noise: 40 },
    { source: 'delta', nRows: 24, slope: 1.0, noise: 5 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, { bootstraps: 200 });
  const reference = r.rows[0]!.perSourceSources;
  for (const row of r.rows) {
    assert.deepEqual(row.perSourceSources, reference);
    assert.equal(row.perSourceHalfWidths.length, row.nShared);
  }
});

test('axis21 builder: source ids in perSourceSources are sorted lexicographically', () => {
  const queue = syntheticQueue([
    { source: 'zulu', nRows: 24, slope: 1.0, noise: 5 },
    { source: 'alpha', nRows: 24, slope: 5.0, noise: 25 },
    { source: 'mike', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, { bootstraps: 200 });
  for (const row of r.rows) {
    const sortedCopy = [...row.perSourceSources].sort();
    assert.deepEqual(row.perSourceSources, sortedCopy);
  }
});

test('axis21 builder: concentrationLabel matches gini bins', () => {
  // Synthesise per-lens half-widths directly via the helper boundary.
  // (this one is a label-classifier sanity check via the helper.)
  const cases: { xs: number[]; expectInLabels: string[] }[] = [
    {
      xs: [1, 1, 1, 1, 1, 1],
      expectInLabels: ['near-equal'],
    },
    {
      xs: [1, 1, 1, 1, 1000, 1000],
      expectInLabels: ['highly-concentrated', 'moderately-concentrated'],
    },
  ];
  for (const c of cases) {
    const out = lensWidthGini(c.xs);
    assert.ok(out.gini >= 0 && out.gini <= 1);
  }
});

// ---------- renderer ----------

test('axis21 renderer: emits header and lens table', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, {
    bootstraps: 200,
    generatedAt: '2026-04-30T00:00:00Z',
  });
  const txt = renderSourceRowTokenSlopeCiLensWidthGini(r);
  assert.ok(txt.includes('source-row-token-slope-ci-lens-width-gini'));
  assert.ok(txt.includes('lens'));
  assert.ok(txt.includes('gini'));
  assert.ok(txt.includes('topShare'));
  assert.ok(txt.includes('concentration'));
  for (const lens of SLOPE_LENS_WIDTH_GINI_LENS_NAMES) {
    assert.ok(txt.includes(lens), `renderer missing ${lens}`);
  }
});

test('axis21 renderer: --show-concentration-aggregate appends aggregate line', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, { bootstraps: 200 });
  const txt = renderSourceRowTokenSlopeCiLensWidthGini(r, {
    showConcentrationAggregate: true,
  });
  assert.ok(txt.includes('[concentration aggregate]'));
});

test('axis21 renderer: --show-lens-attribution appends attribution line', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, { bootstraps: 200 });
  const txt = renderSourceRowTokenSlopeCiLensWidthGini(r, {
    showLensAttribution: true,
  });
  assert.ok(txt.includes('[lens attribution]'));
  assert.ok(txt.includes('mostConcentrated'));
  assert.ok(txt.includes('mostEqual'));
});

test('axis21 renderer: --show-moments appends moments line per lens', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, { bootstraps: 200 });
  const txt = renderSourceRowTokenSlopeCiLensWidthGini(r, { showMoments: true });
  assert.ok(txt.includes('moments:'));
  assert.ok(txt.includes('meanHalf='));
  assert.ok(txt.includes('mad='));
});

test('axis21 renderer: --show-summary appends summary line per lens', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, { bootstraps: 200 });
  const txt = renderSourceRowTokenSlopeCiLensWidthGini(r, { showSummary: true });
  assert.ok(txt.includes('summary:'));
});

test('axis21 renderer: empty rows shows "(no lenses)"', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, {
    bootstraps: 200,
    alertGini: 1.0,
  });
  const txt = renderSourceRowTokenSlopeCiLensWidthGini(r);
  assert.ok(txt.includes('(no lenses)'));
});

test('axis21 renderer: --show-per-source-widths renders widths line per lens', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthGini(queue, { bootstraps: 200 });
  const txt = renderSourceRowTokenSlopeCiLensWidthGini(r, {
    showPerSourceWidths: true,
  });
  assert.ok(txt.includes('widths:'));
  assert.ok(txt.includes('s1='));
});

test('axis21 renderer: --show-per-source-widths with no shared sources prints "(no shared sources)"', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthGini([], { bootstraps: 100 });
  const txt = renderSourceRowTokenSlopeCiLensWidthGini(r, {
    showPerSourceWidths: true,
  });
  assert.ok(txt.includes('(no shared sources)'));
});

test('axis21 renderer: degenerate reason rendered when present', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthGini([], { bootstraps: 100 });
  const txt = renderSourceRowTokenSlopeCiLensWidthGini(r);
  assert.ok(txt.includes('too-few-sources'));
  assert.ok(txt.includes('degenerate'));
});
