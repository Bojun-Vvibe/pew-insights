/**
 * Unit + integration tests for
 * source-row-token-slope-ci-lens-width-midpoint-correlation
 * (axis 20).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation,
  renderSourceRowTokenSlopeCiLensWidthMidpointCorrelation,
  lensWidthMidpointCorrelation,
  SLOPE_LENS_WIDTH_MID_CORR_LENS_NAMES,
} from '../src/sourcerowtokenslopecilenswidthmidpointcorrelation.js';
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

// Build a synthetic queue with K sources, each with N rows of
// monotone-increasing tokens. Different per-source slopes give
// different midpoints; configurable noise gives different widths.
function syntheticQueue(
  spec: { source: string; nRows: number; slope: number; noise: number }[],
): QueueLine[] {
  const out: QueueLine[] = [];
  for (const s of spec) {
    let seed = 1;
    const rng = () => {
      // Mulberry32-ish.
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

// ---------- pure helper: lensWidthMidpointCorrelation ----------

test('axis20 helper: perfect positive correlation gives r ~ +1', () => {
  // Linear: halfWidth_i = 2 * absMid_i + 0.1
  const absMids = [0.1, 0.5, 1.0, 2.0, 3.0];
  const halfs = absMids.map((a) => 2 * a + 0.1);
  const out = lensWidthMidpointCorrelation(absMids, halfs);
  assert.equal(out.degenerateFlag, false);
  assert.equal(out.degenerateReason, null);
  assert.equal(out.nShared, 5);
  assert.ok(Math.abs(out.pearsonR - 1) < 1e-9, `got r=${out.pearsonR}`);
  assert.ok(Math.abs(out.pearsonRSquared - 1) < 1e-9);
});

test('axis20 helper: perfect negative correlation gives r ~ -1', () => {
  const absMids = [0.1, 0.5, 1.0, 2.0, 3.0];
  const halfs = absMids.map((a) => 5 - 1.5 * a);
  const out = lensWidthMidpointCorrelation(absMids, halfs);
  assert.equal(out.degenerateFlag, false);
  assert.ok(Math.abs(out.pearsonR + 1) < 1e-9, `got r=${out.pearsonR}`);
});

test('axis20 helper: zero correlation when halfs are constant -> degenerate zero-variance-halfwidth', () => {
  const absMids = [0.1, 0.5, 1.0, 2.0, 3.0];
  const halfs = [0.7, 0.7, 0.7, 0.7, 0.7];
  const out = lensWidthMidpointCorrelation(absMids, halfs);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'zero-variance-halfwidth');
  assert.equal(out.pearsonR, 0);
});

test('axis20 helper: zero variance in absMid -> degenerate zero-variance-absmid', () => {
  const absMids = [1.0, 1.0, 1.0, 1.0];
  const halfs = [0.1, 0.5, 1.0, 2.0];
  const out = lensWidthMidpointCorrelation(absMids, halfs);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'zero-variance-absmid');
});

test('axis20 helper: too-few-sources (n < 3) -> degenerate', () => {
  for (const n of [0, 1, 2]) {
    const out = lensWidthMidpointCorrelation(
      Array.from({ length: n }, (_, i) => i + 0.1),
      Array.from({ length: n }, (_, i) => i + 0.2),
    );
    assert.equal(out.degenerateFlag, true);
    assert.equal(out.degenerateReason, 'too-few-sources');
    assert.equal(out.nShared, n);
  }
});

test('axis20 helper: r is in [-1, +1] for arbitrary jittered data', () => {
  const absMids: number[] = [];
  const halfs: number[] = [];
  let s = 1234567;
  for (let i = 0; i < 50; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    const a = (s & 0xffff) / 0xffff;
    s = (s * 1103515245 + 12345) >>> 0;
    const b = (s & 0xffff) / 0xffff;
    absMids.push(a * 10);
    halfs.push(b * 5);
  }
  const out = lensWidthMidpointCorrelation(absMids, halfs);
  assert.equal(out.degenerateFlag, false);
  assert.ok(out.pearsonR >= -1 && out.pearsonR <= 1, `r=${out.pearsonR}`);
  assert.ok(out.pearsonRSquared >= 0 && out.pearsonRSquared <= 1);
});

test('axis20 helper: pearsonR == covariance / sqrt(varA * varH) algebraically', () => {
  const absMids = [0.5, 1.5, 2.5, 3.5, 4.5];
  const halfs = [0.4, 0.7, 1.2, 1.5, 2.1];
  const out = lensWidthMidpointCorrelation(absMids, halfs);
  const expected = out.covariance / Math.sqrt(out.varAbsMidpoint * out.varHalfWidth);
  assert.ok(Math.abs(out.pearsonR - expected) < 1e-12);
});

test('axis20 helper: rejects negative inputs', () => {
  assert.throws(() => lensWidthMidpointCorrelation([-1, 0, 1], [1, 1, 1]));
  assert.throws(() => lensWidthMidpointCorrelation([1, 1, 1], [-1, 0, 1]));
});

test('axis20 helper: rejects non-finite inputs', () => {
  assert.throws(() => lensWidthMidpointCorrelation([NaN, 0, 1], [1, 1, 1]));
  assert.throws(() => lensWidthMidpointCorrelation([1, 1, 1], [Infinity, 0, 1]));
});

test('axis20 helper: rejects length mismatch', () => {
  assert.throws(() => lensWidthMidpointCorrelation([1, 2, 3], [1, 2]));
});

// ---------- builder integration tests ----------

test('axis20 builder: empty queue yields all-degenerate report', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation([], {
    bootstraps: 100,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.rows.length, 6);
  for (const row of r.rows) {
    assert.equal(row.degenerateFlag, true);
    assert.equal(row.degenerateReason, 'too-few-sources');
    assert.equal(row.regimeLabel, 'degenerate');
    assert.equal(row.pearsonR, 0);
  }
  assert.equal(r.nDegenerate, 6);
  assert.equal(r.mostHeteroscedasticLens, null);
  assert.equal(r.mostHomoscedasticLens, null);
  assert.equal(r.mostAntiHeteroscedasticLens, null);
});

test('axis20 builder: produces six lens rows with valid pearsonR for synthetic data', () => {
  const queue = syntheticQueue([
    { source: 'src-a', nRows: 24, slope: 1.0, noise: 5 },
    { source: 'src-b', nRows: 24, slope: 5.0, noise: 25 },
    { source: 'src-c', nRows: 24, slope: 10.0, noise: 50 },
    { source: 'src-d', nRows: 24, slope: 0.1, noise: 1 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation(queue, {
    bootstraps: 200,
  });
  assert.equal(r.rows.length, 6);
  // Lens names match the canonical six.
  const seen = new Set(r.rows.map((row) => row.lens));
  for (const lens of SLOPE_LENS_WIDTH_MID_CORR_LENS_NAMES) {
    assert.ok(seen.has(lens), `missing lens ${lens}`);
  }
  // Each non-degenerate r in [-1, 1].
  for (const row of r.rows) {
    if (!row.degenerateFlag) {
      assert.ok(row.pearsonR >= -1 && row.pearsonR <= 1);
      assert.ok(row.pearsonRSquared >= 0 && row.pearsonRSquared <= 1);
    }
  }
});

test('axis20 builder: --alert-pearson filter behaves as |r| > threshold', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
    { source: 's4', nRows: 24, slope: 0.1, noise: 1 },
  ]);
  const baseline = buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation(
    queue,
    { bootstraps: 200 },
  );
  const filtered = buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation(
    queue,
    { bootstraps: 200, alertPearson: 0.99 },
  );
  // After filtering at near-1, only lenses with |r| > 0.99 survive
  // (a strict subset).
  assert.ok(filtered.rows.length <= baseline.rows.length);
  for (const row of filtered.rows) {
    assert.ok(Math.abs(row.pearsonR) > 0.99);
  }
});

test('axis20 builder: report-level aggregates are consistent with per-row data', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
    { source: 's4', nRows: 24, slope: 0.1, noise: 1 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation(queue, {
    bootstraps: 200,
  });
  const nonDegen = r.rows.filter((row) => !row.degenerateFlag);
  if (nonDegen.length === 0) return;
  const prs = nonDegen.map((row) => row.pearsonR);
  const expectedMean = prs.reduce((a, b) => a + b, 0) / prs.length;
  assert.ok(Math.abs(r.meanPearsonR - expectedMean) < 1e-12);
  assert.ok(Math.abs(r.maxPearsonR - Math.max(...prs)) < 1e-12);
  assert.ok(Math.abs(r.minPearsonR - Math.min(...prs)) < 1e-12);
  assert.ok(Math.abs(r.rangePearsonR - (r.maxPearsonR - r.minPearsonR)) < 1e-12);
});

test('axis20 builder: input validation -- invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation([], {
        sort: 'nope' as never,
      }),
    /sort must be one of/,
  );
});

test('axis20 builder: input validation -- alertPearson out of range throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation([], {
        alertPearson: 2,
      }),
    /alertPearson/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation([], {
        alertPearson: -0.1,
      }),
    /alertPearson/,
  );
});

test('axis20 builder: input validation -- alertPositive out of range throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation([], {
        alertPositive: 1.5,
      }),
    /alertPositive/,
  );
});

test('axis20 builder: input validation -- minRows < 4 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation([], {
        minRows: 3,
      }),
    /minRows/,
  );
});

test('axis20 builder: sort=lens preserves canonical lens order', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation(queue, {
    bootstraps: 200,
    sort: 'lens',
  });
  for (let i = 0; i < r.rows.length; i++) {
    assert.equal(r.rows[i]!.lens, SLOPE_LENS_WIDTH_MID_CORR_LENS_NAMES[i]);
  }
});

test('axis20 builder: sort=pearson-desc orders by pearsonR descending', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
    { source: 's4', nRows: 24, slope: 0.1, noise: 1 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation(queue, {
    bootstraps: 200,
    sort: 'pearson-desc',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.pearsonR >= r.rows[i]!.pearsonR);
  }
});

// ---------- renderer ----------

test('axis20 renderer: emits header and lens table', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation(queue, {
    bootstraps: 200,
    generatedAt: '2026-04-30T00:00:00Z',
  });
  const txt = renderSourceRowTokenSlopeCiLensWidthMidpointCorrelation(r);
  assert.ok(txt.includes('source-row-token-slope-ci-lens-width-midpoint-correlation'));
  assert.ok(txt.includes('lens'));
  assert.ok(txt.includes('pearsonR'));
  assert.ok(txt.includes('regime'));
  for (const lens of SLOPE_LENS_WIDTH_MID_CORR_LENS_NAMES) {
    assert.ok(txt.includes(lens), `renderer missing ${lens}`);
  }
});

test('axis20 renderer: --show-regime-aggregate appends aggregate line', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation(queue, {
    bootstraps: 200,
  });
  const txt = renderSourceRowTokenSlopeCiLensWidthMidpointCorrelation(r, {
    showRegimeAggregate: true,
  });
  assert.ok(txt.includes('[regime aggregate]'));
});

test('axis20 renderer: --show-lens-attribution appends attribution line', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation(queue, {
    bootstraps: 200,
  });
  const txt = renderSourceRowTokenSlopeCiLensWidthMidpointCorrelation(r, {
    showLensAttribution: true,
  });
  assert.ok(txt.includes('[lens attribution]'));
});

test('axis20 renderer: --show-moments appends moments line per lens', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation(queue, {
    bootstraps: 200,
  });
  const txt = renderSourceRowTokenSlopeCiLensWidthMidpointCorrelation(r, {
    showMoments: true,
  });
  assert.ok(txt.includes('moments:'));
  assert.ok(txt.includes('meanAbsMid='));
  assert.ok(txt.includes('cov='));
});

test('axis20 renderer: empty rows shows "(no lenses)"', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 24, slope: 1.0, noise: 5 },
    { source: 's2', nRows: 24, slope: 5.0, noise: 25 },
    { source: 's3', nRows: 24, slope: 10.0, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthMidpointCorrelation(queue, {
    bootstraps: 200,
    alertPearson: 1.0, // strictly > 1 is impossible
  });
  const txt = renderSourceRowTokenSlopeCiLensWidthMidpointCorrelation(r);
  assert.ok(txt.includes('(no lenses)'));
});
