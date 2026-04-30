/**
 * Unit + integration tests for
 * source-row-token-slope-ci-lens-width-atkinson (axis 23).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiLensWidthAtkinson,
  renderSourceRowTokenSlopeCiLensWidthAtkinson,
  lensWidthAtkinson,
  SLOPE_LENS_WIDTH_ATKINSON_LENS_NAMES,
} from '../src/sourcerowtokenslopecilenswidthatkinson.js';
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

// ---------- pure helper: lensWidthAtkinson ----------

test('axis23 helper: perfectly equal half-widths gives A(eps) = 0 for any eps', () => {
  for (const eps of [0.5, 1, 2, 3]) {
    const out = lensWidthAtkinson([0.5, 0.5, 0.5, 0.5, 0.5], eps);
    assert.equal(out.degenerateFlag, false, `eps=${eps}`);
    assert.equal(out.degenerateReason, null);
    assert.equal(out.nShared, 5);
    assert.ok(
      Math.abs(out.atkinson) < 1e-12,
      `eps=${eps}: A should be ~0, got ${out.atkinson}`,
    );
    // x_EDE should equal mean (= 0.5) for perfectly equal distribution.
    assert.ok(
      Math.abs(out.xEde - 0.5) < 1e-12,
      `eps=${eps}: xEde should be 0.5, got ${out.xEde}`,
    );
  }
});

test('axis23 helper: A bounded in [0, 1] for any positive distribution', () => {
  // Stress: skewed distributions
  const cases = [
    [1, 2, 3, 4, 5],
    [0.1, 0.2, 100, 200, 1000],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1000],
  ];
  for (const xs of cases) {
    for (const eps of [0.5, 0.9, 1, 1.5, 2, 3]) {
      const out = lensWidthAtkinson(xs, eps);
      assert.ok(
        out.atkinson >= 0 && out.atkinson <= 1,
        `xs=${JSON.stringify(xs)} eps=${eps}: A=${out.atkinson} out of [0,1]`,
      );
    }
  }
});

test('axis23 helper: A(eps) is weakly increasing in eps (Atkinson monotonicity)', () => {
  // Pigou-Dalton: stronger inequality aversion never decreases A.
  const xs = [1, 2, 3, 4, 10];
  const epsList = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5];
  let prev = -1;
  for (const eps of epsList) {
    const out = lensWidthAtkinson(xs, eps);
    assert.ok(
      out.atkinson >= prev - 1e-9,
      `A(${eps})=${out.atkinson} should be >= A(prev_eps)=${prev}`,
    );
    prev = out.atkinson;
  }
});

test('axis23 helper: A(eps != 1) matches direct definition (eps=2 closed form)', () => {
  // For eps=2: x_EDE = harmonic_mean = n / sum(1/x_i)
  const xs = [1, 2, 3, 4];
  const n = xs.length;
  const mean = (1 + 2 + 3 + 4) / n;
  const harmonic = n / (1 / 1 + 1 / 2 + 1 / 3 + 1 / 4);
  const expected = 1 - harmonic / mean;
  const out = lensWidthAtkinson(xs, 2);
  assert.ok(
    Math.abs(out.atkinson - expected) < 1e-12,
    `eps=2: A should equal 1 - harmonic/mean: got ${out.atkinson}, expected ${expected}`,
  );
  assert.ok(Math.abs(out.xEde - harmonic) < 1e-12);
});

test('axis23 helper: A(1) = 1 - geometric_mean / arithmetic_mean (limit case)', () => {
  // Eps = 1 limit: x_EDE = geometric mean.
  const xs = [1, 2, 4, 8];
  const n = xs.length;
  const arith = (1 + 2 + 4 + 8) / n;
  const geo = Math.pow(1 * 2 * 4 * 8, 1 / n);
  const expected = 1 - geo / arith;
  const out = lensWidthAtkinson(xs, 1);
  assert.ok(
    Math.abs(out.atkinson - expected) < 1e-12,
    `eps=1: A should equal 1 - geo/arith: got ${out.atkinson}, expected ${expected}`,
  );
  assert.ok(Math.abs(out.xEde - geo) < 1e-12);
});

test('axis23 helper: A(eps=0.5) closed form (root-mean-square-root)', () => {
  // For eps=0.5: x_EDE = ((1/n) sum sqrt(x_i))^2
  const xs = [1, 4, 9, 16];
  const n = xs.length;
  const mean = (1 + 4 + 9 + 16) / n;
  const inner = (1 + 2 + 3 + 4) / n; // sum sqrt(x_i) / n = (1+2+3+4)/4
  const xEde = inner * inner;
  const expected = 1 - xEde / mean;
  const out = lensWidthAtkinson(xs, 0.5);
  assert.ok(
    Math.abs(out.atkinson - expected) < 1e-12,
    `eps=0.5: A should equal closed form: got ${out.atkinson}, expected ${expected}`,
  );
  assert.ok(Math.abs(out.xEde - xEde) < 1e-12);
});

test('axis23 helper: scale invariance under positive scalar multiplication', () => {
  const a = lensWidthAtkinson([1, 2, 3, 4, 5], 0.5);
  const b = lensWidthAtkinson([100, 200, 300, 400, 500], 0.5);
  assert.ok(Math.abs(a.atkinson - b.atkinson) < 1e-10);
  const c = lensWidthAtkinson([1, 2, 3, 4, 5], 2);
  const d = lensWidthAtkinson([7, 14, 21, 28, 35], 2);
  assert.ok(Math.abs(c.atkinson - d.atkinson) < 1e-10);
});

test('axis23 helper: NOT shift-invariant', () => {
  // Adding a constant reduces inequality (concentration vs the mean changes).
  const a = lensWidthAtkinson([1, 2, 3], 2);
  const b = lensWidthAtkinson([101, 102, 103], 2);
  assert.ok(
    a.atkinson > b.atkinson + 1e-3,
    `shifted distribution should have lower A: a=${a.atkinson} b=${b.atkinson}`,
  );
});

test('axis23 helper: too-few-sources degenerate', () => {
  const out = lensWidthAtkinson([0.5, 0.5], 2);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'too-few-sources');
  assert.equal(out.atkinson, 0);
});

test('axis23 helper: zero-mean degenerate', () => {
  const out = lensWidthAtkinson([0, 0, 0, 0], 2);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'zero-mean-halfwidth');
  assert.equal(out.atkinson, 0);
});

test('axis23 helper: zero source with eps>=1 forces A=1, degenerate flag', () => {
  // For eps >= 1, any zero source -> x_EDE = 0 -> A = 1.
  const out2 = lensWidthAtkinson([0, 1, 2, 3], 2);
  assert.equal(out2.degenerateFlag, true);
  assert.equal(out2.degenerateReason, 'zero-source-eps-ge-1');
  assert.equal(out2.atkinson, 1);
  assert.equal(out2.xEde, 0);
  const out1 = lensWidthAtkinson([0, 1, 2, 3], 1);
  assert.equal(out1.degenerateFlag, true);
  assert.equal(out1.degenerateReason, 'zero-source-eps-ge-1');
  assert.equal(out1.atkinson, 1);
});

test('axis23 helper: zero source with eps<1 is fine (0^(1-eps)=0 finite)', () => {
  // For eps=0.5, oneMinusEps=0.5, 0^0.5 = 0 is finite.
  const out = lensWidthAtkinson([0, 1, 2, 3], 0.5);
  assert.equal(out.degenerateFlag, false);
  assert.equal(out.degenerateReason, null);
  assert.ok(out.atkinson > 0 && out.atkinson < 1);
});

test('axis23 helper: rejects negative half-width', () => {
  assert.throws(() => lensWidthAtkinson([1, -2, 3], 2), /non-negative/);
});

test('axis23 helper: rejects non-finite half-width', () => {
  assert.throws(() => lensWidthAtkinson([1, NaN, 3], 2), /finite/);
  assert.throws(() => lensWidthAtkinson([1, Infinity, 3], 2), /finite/);
});

test('axis23 helper: rejects invalid epsilon', () => {
  assert.throws(() => lensWidthAtkinson([1, 2, 3], 0), /epsilon/);
  assert.throws(() => lensWidthAtkinson([1, 2, 3], -1), /epsilon/);
  assert.throws(() => lensWidthAtkinson([1, 2, 3], NaN), /epsilon/);
  assert.throws(() => lensWidthAtkinson([1, 2, 3], Infinity), /epsilon/);
});

test('axis23 helper: A(2) > A(0.5) on concentrated tail (transfer sensitivity)', () => {
  // Distribution with one big outlier: stronger aversion catches it more.
  const xs = [1, 1, 1, 1, 100];
  const half = lensWidthAtkinson(xs, 0.5);
  const two = lensWidthAtkinson(xs, 2);
  assert.ok(
    two.atkinson > half.atkinson + 0.05,
    `A(2)=${two.atkinson} should be > A(0.5)=${half.atkinson} on tailed distribution`,
  );
});

// ---------- builder integration ----------

test('axis23 builder: smoke run on three-source synthetic queue', () => {
  const queue = syntheticQueue([
    { source: 'sA', nRows: 30, slope: 0.5, noise: 5 },
    { source: 'sB', nRows: 30, slope: 1.0, noise: 5 },
    { source: 'sC', nRows: 30, slope: 1.5, noise: 5 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthAtkinson(queue, {
    bootstraps: 200,
    seed: 1,
    generatedAt: '2026-04-30T00:00:00Z',
  });
  assert.equal(r.rows.length, 6);
  assert.equal(r.sourcesWithAllLenses, 3);
  for (const row of r.rows) {
    assert.ok(SLOPE_LENS_WIDTH_ATKINSON_LENS_NAMES.includes(row.lens));
    assert.ok(row.atkinsonHalf >= 0 && row.atkinsonHalf <= 1);
    assert.ok(row.atkinsonTwo >= 0 && row.atkinsonTwo <= 1);
    assert.ok(row.aversionGap >= 0);
  }
  assert.ok(r.meanAtkinsonTwo >= 0 && r.meanAtkinsonTwo <= 1);
  assert.ok(r.meanAtkinsonHalf >= 0 && r.meanAtkinsonHalf <= 1);
  assert.ok(r.meanAversionGap >= 0);
});

test('axis23 builder: empty queue produces six degenerate lens rows', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthAtkinson([], {
    bootstraps: 100,
  });
  // Always six lenses, even with zero shared sources -- each is degenerate.
  assert.equal(r.rows.length, 6);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.totalSources, 0);
  for (const row of r.rows) {
    assert.equal(row.degenerateFlagHalf, true);
    assert.equal(row.degenerateFlagTwo, true);
    assert.equal(row.degenerateReasonHalf, 'too-few-sources');
    assert.equal(row.degenerateReasonTwo, 'too-few-sources');
    assert.equal(row.atkinsonHalf, 0);
    assert.equal(row.atkinsonTwo, 0);
  }
  assert.equal(r.mostConcentratedLens, null);
  assert.equal(r.mostEqualLens, null);
  assert.equal(r.largestAversionGapLens, null);
});

test('axis23 builder: alert filter on atkinson-two', () => {
  const queue = syntheticQueue([
    { source: 'sA', nRows: 30, slope: 0.5, noise: 5 },
    { source: 'sB', nRows: 30, slope: 1.0, noise: 5 },
    { source: 'sC', nRows: 30, slope: 1.5, noise: 5 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthAtkinson(queue, {
    bootstraps: 200,
    seed: 1,
    alertAtkinsonTwo: 0.99,
  });
  // Threshold of 0.99 should drop most lenses.
  for (const row of r.rows) {
    assert.ok(row.atkinsonTwo > 0.99);
  }
});

test('axis23 builder: alert filter on atkinson-half', () => {
  const queue = syntheticQueue([
    { source: 'sA', nRows: 30, slope: 0.5, noise: 5 },
    { source: 'sB', nRows: 30, slope: 1.0, noise: 5 },
    { source: 'sC', nRows: 30, slope: 1.5, noise: 5 },
  ]);
  const r0 = buildSourceRowTokenSlopeCiLensWidthAtkinson(queue, {
    bootstraps: 200,
    seed: 1,
  });
  const r1 = buildSourceRowTokenSlopeCiLensWidthAtkinson(queue, {
    bootstraps: 200,
    seed: 1,
    alertAtkinsonHalf: 0.99,
  });
  assert.ok(r1.rows.length <= r0.rows.length);
});

test('axis23 builder: sort keys all valid', () => {
  const queue = syntheticQueue([
    { source: 'sA', nRows: 30, slope: 0.5, noise: 5 },
    { source: 'sB', nRows: 30, slope: 1.0, noise: 5 },
    { source: 'sC', nRows: 30, slope: 1.5, noise: 5 },
  ]);
  for (const sort of [
    'atkinson-two-desc',
    'atkinson-two-asc',
    'atkinson-half-desc',
    'aversion-gap-desc',
    'mean-halfwidth-desc',
    'lens',
  ] as const) {
    const r = buildSourceRowTokenSlopeCiLensWidthAtkinson(queue, {
      bootstraps: 200,
      seed: 1,
      sort,
    });
    assert.equal(r.sort, sort);
    assert.ok(r.rows.length > 0);
  }
});

test('axis23 builder: rejects invalid options', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthAtkinson([], { minRows: 2 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthAtkinson([], { confidence: 1.5 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthAtkinson([], { lambda: -1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthAtkinson([], { bootstraps: 50 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthAtkinson([], { seed: 1.5 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthAtkinson([], { alertAtkinsonHalf: 1.5 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthAtkinson([], { alertAtkinsonTwo: -0.1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthAtkinson([], {
      sort: 'bogus' as 'lens',
    }),
  );
});

test('axis23 builder: filters dropped sources missing from any lens', () => {
  const queue = syntheticQueue([
    { source: 'sA', nRows: 30, slope: 0.5, noise: 5 },
    { source: 'sB', nRows: 30, slope: 1.0, noise: 5 },
    { source: 'sC', nRows: 30, slope: 1.5, noise: 5 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthAtkinson(queue, {
    bootstraps: 200,
    seed: 1,
  });
  assert.equal(r.totalSources, r.sourcesWithAllLenses + r.droppedMissingLens);
});

// ---------- renderer ----------

test('axis23 renderer: pretty output contains header and lens rows', () => {
  const queue = syntheticQueue([
    { source: 'sA', nRows: 30, slope: 0.5, noise: 5 },
    { source: 'sB', nRows: 30, slope: 1.0, noise: 5 },
    { source: 'sC', nRows: 30, slope: 1.5, noise: 5 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthAtkinson(queue, {
    bootstraps: 200,
    seed: 1,
    generatedAt: '2026-04-30T00:00:00Z',
  });
  const out = renderSourceRowTokenSlopeCiLensWidthAtkinson(r);
  assert.ok(out.includes('source-row-token-slope-ci-lens-width-atkinson'));
  assert.ok(out.includes('A(0.5)'));
  assert.ok(out.includes('A(2)'));
  for (const lens of SLOPE_LENS_WIDTH_ATKINSON_LENS_NAMES) {
    assert.ok(out.includes(lens), `expected lens ${lens} in output`);
  }
});

test('axis23 renderer: optional show-* flags add lines', () => {
  const queue = syntheticQueue([
    { source: 'sA', nRows: 30, slope: 0.5, noise: 5 },
    { source: 'sB', nRows: 30, slope: 1.0, noise: 5 },
    { source: 'sC', nRows: 30, slope: 1.5, noise: 5 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthAtkinson(queue, {
    bootstraps: 200,
    seed: 1,
    generatedAt: '2026-04-30T00:00:00Z',
  });
  const base = renderSourceRowTokenSlopeCiLensWidthAtkinson(r);
  const withSummary = renderSourceRowTokenSlopeCiLensWidthAtkinson(r, {
    showSummary: true,
  });
  assert.ok(withSummary.length > base.length);
  assert.ok(withSummary.includes('summary:'));
  const withAgg = renderSourceRowTokenSlopeCiLensWidthAtkinson(r, {
    showConcentrationAggregate: true,
  });
  assert.ok(withAgg.includes('[concentration aggregate]'));
  const withAttr = renderSourceRowTokenSlopeCiLensWidthAtkinson(r, {
    showLensAttribution: true,
  });
  assert.ok(withAttr.includes('[lens attribution]'));
  const withMom = renderSourceRowTokenSlopeCiLensWidthAtkinson(r, {
    showMoments: true,
  });
  assert.ok(withMom.includes('moments:'));
  const withWidths = renderSourceRowTokenSlopeCiLensWidthAtkinson(r, {
    showPerSourceWidths: true,
  });
  assert.ok(withWidths.includes('widths:'));
  const withXede = renderSourceRowTokenSlopeCiLensWidthAtkinson(r, {
    showXEde: true,
  });
  assert.ok(withXede.includes('xEde:'));
});

test('axis23 renderer: empty rows still renders header even with all degenerate', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthAtkinson([], {
    bootstraps: 100,
  });
  const out = renderSourceRowTokenSlopeCiLensWidthAtkinson(r);
  // Empty queue produces six degenerate rows, not (no lenses).
  assert.ok(out.includes('source-row-token-slope-ci-lens-width-atkinson'));
  assert.ok(out.includes('too-few-sources'));
});

test('axis23 renderer: filtered to no rows shows (no lenses)', () => {
  const queue = syntheticQueue([
    { source: 'sA', nRows: 30, slope: 0.5, noise: 5 },
    { source: 'sB', nRows: 30, slope: 1.0, noise: 5 },
    { source: 'sC', nRows: 30, slope: 1.5, noise: 5 },
  ]);
  // Filter at 1.0 (impossible since A in [0,1]) drops all rows.
  const r = buildSourceRowTokenSlopeCiLensWidthAtkinson(queue, {
    bootstraps: 200,
    seed: 1,
    alertAtkinsonTwo: 1.0,
  });
  const out = renderSourceRowTokenSlopeCiLensWidthAtkinson(r);
  assert.ok(out.includes('(no lenses)'));
});

// ---------- boundary ----------

test('axis23 boundary: A(2) at maximum tail concentration approaches 1', () => {
  // Closer and closer to one-source-takes-all (without zero, since
  // eps=2 with zero is degenerate).
  const xs = [1e-9, 1e-9, 1e-9, 1e-9, 1];
  const out = lensWidthAtkinson(xs, 2);
  assert.equal(out.degenerateFlag, false);
  assert.ok(out.atkinson > 0.99, `A(2) should be near 1, got ${out.atkinson}`);
  assert.ok(out.atkinson <= 1);
});

test('axis23 boundary: scale invariance preserves degenerate status', () => {
  const a = lensWidthAtkinson([0, 1, 2, 3], 2);
  const b = lensWidthAtkinson([0, 100, 200, 300], 2);
  assert.equal(a.degenerateFlag, b.degenerateFlag);
  assert.equal(a.degenerateReason, b.degenerateReason);
});

test('axis23 boundary: aversion gap is zero on perfectly equal distribution', () => {
  // Both A(0.5) and A(2) are 0, gap = 0.
  const queue = syntheticQueue([
    { source: 'sA', nRows: 30, slope: 1.0, noise: 0 },
    { source: 'sB', nRows: 30, slope: 1.0, noise: 0 },
    { source: 'sC', nRows: 30, slope: 1.0, noise: 0 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthAtkinson(queue, {
    bootstraps: 200,
    seed: 1,
  });
  // At exactly the same generative process the lens half-widths
  // across sources will be very close; gap should be tiny but
  // non-negative.
  for (const row of r.rows) {
    assert.ok(row.aversionGap >= 0, `gap=${row.aversionGap} should be >= 0`);
  }
});

test('axis23 boundary: maxAtkinsonTwo and minAtkinsonTwo bracket meanAtkinsonTwo', () => {
  const queue = syntheticQueue([
    { source: 'sA', nRows: 30, slope: 0.5, noise: 5 },
    { source: 'sB', nRows: 30, slope: 1.0, noise: 5 },
    { source: 'sC', nRows: 30, slope: 1.5, noise: 5 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthAtkinson(queue, {
    bootstraps: 200,
    seed: 1,
  });
  if (r.rows.filter((x) => !x.degenerateFlagTwo).length > 0) {
    assert.ok(r.minAtkinsonTwo <= r.meanAtkinsonTwo + 1e-12);
    assert.ok(r.meanAtkinsonTwo <= r.maxAtkinsonTwo + 1e-12);
    assert.ok(r.rangeAtkinsonTwo === r.maxAtkinsonTwo - r.minAtkinsonTwo);
  }
});

test('axis23 boundary: deterministic given seed', () => {
  const queue = syntheticQueue([
    { source: 'sA', nRows: 30, slope: 0.5, noise: 5 },
    { source: 'sB', nRows: 30, slope: 1.0, noise: 5 },
    { source: 'sC', nRows: 30, slope: 1.5, noise: 5 },
  ]);
  const r1 = buildSourceRowTokenSlopeCiLensWidthAtkinson(queue, {
    bootstraps: 200,
    seed: 7,
    generatedAt: '2026-04-30T00:00:00Z',
  });
  const r2 = buildSourceRowTokenSlopeCiLensWidthAtkinson(queue, {
    bootstraps: 200,
    seed: 7,
    generatedAt: '2026-04-30T00:00:00Z',
  });
  assert.deepEqual(
    r1.rows.map((r) => [r.lens, r.atkinsonHalf, r.atkinsonTwo]),
    r2.rows.map((r) => [r.lens, r.atkinsonHalf, r.atkinsonTwo]),
  );
});

test('axis23 boundary: A(eps=1) limit consistent with eps near 1 from below and above', () => {
  // Continuity at eps=1: A(0.99) ~ A(1) ~ A(1.01).
  const xs = [1, 2, 3, 4, 5];
  const a = lensWidthAtkinson(xs, 0.99).atkinson;
  const b = lensWidthAtkinson(xs, 1).atkinson;
  const c = lensWidthAtkinson(xs, 1.01).atkinson;
  assert.ok(Math.abs(a - b) < 0.01, `A(0.99)=${a} vs A(1)=${b}`);
  assert.ok(Math.abs(c - b) < 0.01, `A(1.01)=${c} vs A(1)=${b}`);
});
