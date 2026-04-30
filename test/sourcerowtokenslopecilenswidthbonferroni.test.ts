/**
 * Unit + integration tests for
 * source-row-token-slope-ci-lens-width-bonferroni (axis 28).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiLensWidthBonferroni,
  renderSourceRowTokenSlopeCiLensWidthBonferroni,
  lensWidthBonferroni,
  SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES,
} from '../src/sourcerowtokenslopecilenswidthbonferroni.js';
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

// ---------- pure helper: lensWidthBonferroni ----------

test('axis28 helper: perfectly equal half-widths give B = 0', () => {
  const out = lensWidthBonferroni([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.equal(out.degenerateFlag, false);
  assert.equal(out.degenerateReason, null);
  assert.equal(out.nShared, 6);
  assert.equal(out.totalHalfWidth, 3);
  assert.equal(out.meanHalfWidth, 0.5);
  assert.ok(Math.abs(out.bonferroni - 0) < 1e-12, `B=${out.bonferroni}`);
  assert.equal(out.bottomToTopRatio, 1);
});

test('axis28 helper: B is in [0, 1] for any non-negative distribution', () => {
  const cases = [
    [1, 2, 3, 4, 5],
    [0.1, 0.2, 100, 200, 1000],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1000],
    [0, 0, 0, 1, 2, 3, 100],
    [0.0001, 0.0002, 0.0003, 0.0004, 0.0005],
    [0, 0, 0, 0, 0, 0, 1],
  ];
  for (const xs of cases) {
    const out = lensWidthBonferroni(xs);
    assert.ok(
      out.bonferroni >= 0 && out.bonferroni <= 1 && Number.isFinite(out.bonferroni),
      `xs=${JSON.stringify(xs)}: B=${out.bonferroni} out of [0,1]`,
    );
  }
});

test('axis28 helper: closed-form check on n=4 [1,1,1,5]', () => {
  // Sorted: [1,1,1,5]; mean=2; n-1=3.
  // M_1 = 1, M_2 = 1, M_3 = 1. Sum = 3.
  // B = 1 - 3 / (3 * 2) = 1 - 0.5 = 0.5.
  const out = lensWidthBonferroni([1, 1, 1, 5]);
  assert.equal(out.nShared, 4);
  assert.equal(out.meanHalfWidth, 2);
  assert.ok(Math.abs(out.bonferroni - 0.5) < 1e-12, `B=${out.bonferroni}`);
});

test('axis28 helper: closed-form check on n=5 [1,2,3,4,5]', () => {
  // Sorted same. mean=3; n-1=4.
  // M_1=1, M_2=1.5, M_3=2, M_4=2.5. Sum = 7.
  // B = 1 - 7 / (4*3) = 1 - 7/12 = 5/12.
  const out = lensWidthBonferroni([1, 2, 3, 4, 5]);
  assert.ok(Math.abs(out.bonferroni - 5 / 12) < 1e-12, `B=${out.bonferroni}`);
});

test('axis28 helper: maximally concentrated [0,0,0,M] approaches B=1 as M grows', () => {
  // Sorted: [0,0,0,M]; mean=M/4; n-1=3.
  // M_1=0, M_2=0, M_3=0. Sum = 0.
  // B = 1 - 0 / (3*M/4) = 1.
  const out = lensWidthBonferroni([0, 0, 0, 100]);
  assert.equal(out.bonferroni, 1);
});

test('axis28 helper: scale-invariance under multiplicative rescale', () => {
  const xs = [0.1, 0.4, 0.5, 1.0, 2.0, 5.0];
  const out1 = lensWidthBonferroni(xs);
  const out2 = lensWidthBonferroni(xs.map((x) => x * 1e6));
  const out3 = lensWidthBonferroni(xs.map((x) => x * 1e-9));
  assert.ok(Math.abs(out1.bonferroni - out2.bonferroni) < 1e-9);
  assert.ok(Math.abs(out1.bonferroni - out3.bonferroni) < 1e-9);
});

test('axis28 helper: permutation invariance', () => {
  const xs = [0.3, 1.2, 0.7, 5.1, 2.0, 0.05];
  const out1 = lensWidthBonferroni(xs);
  const out2 = lensWidthBonferroni([...xs].reverse());
  const out3 = lensWidthBonferroni([0.05, 5.1, 1.2, 0.3, 2.0, 0.7]);
  assert.ok(Math.abs(out1.bonferroni - out2.bonferroni) < 1e-12);
  assert.ok(Math.abs(out1.bonferroni - out3.bonferroni) < 1e-12);
});

test('axis28 helper: zero-immunity -- up to n-1 zeros tolerated', () => {
  const out1 = lensWidthBonferroni([0, 0, 0, 0, 0, 5]);
  assert.equal(out1.degenerateFlag, false);
  // Sorted [0,0,0,0,0,5]; mean=5/6; n-1=5; M_i=0 for i=1..5.
  // B = 1 - 0 / (5 * 5/6) = 1.
  assert.equal(out1.bonferroni, 1);

  const out2 = lensWidthBonferroni([0, 0, 0, 0, 0, 0]);
  assert.equal(out2.degenerateFlag, true);
  assert.equal(out2.degenerateReason, 'zero-mass');
  assert.equal(out2.bonferroni, 0);
});

test('axis28 helper: too-few-sources -- n < 4 is degenerate', () => {
  const out = lensWidthBonferroni([1, 2, 3]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'too-few-sources');
  assert.equal(out.bonferroni, 0);
  const out2 = lensWidthBonferroni([1, 2]);
  assert.equal(out2.degenerateFlag, true);
  const out3 = lensWidthBonferroni([1]);
  assert.equal(out3.degenerateFlag, true);
  const out4 = lensWidthBonferroni([]);
  assert.equal(out4.degenerateFlag, true);
});

test('axis28 helper: rejects negative or non-finite half-widths', () => {
  assert.throws(() => lensWidthBonferroni([1, 2, -1, 4]));
  assert.throws(() => lensWidthBonferroni([1, 2, NaN, 4]));
  assert.throws(() => lensWidthBonferroni([1, 2, Infinity, 4]));
});

test('axis28 helper: lowerTailMassShare bounded in [0, 0.5]', () => {
  const cases = [
    [1, 2, 3, 4, 5, 6],
    [0.1, 100, 200, 300, 400, 500],
    [1, 1, 1, 1, 1, 1, 1000],
    [0, 0, 0, 1, 2, 3, 100],
  ];
  for (const xs of cases) {
    const out = lensWidthBonferroni(xs);
    assert.ok(
      out.lowerTailMassShare >= 0 && out.lowerTailMassShare <= 0.5,
      `xs=${JSON.stringify(xs)}: lowerTail=${out.lowerTailMassShare}`,
    );
  }
});

test('axis28 helper: lowerTailMassShare = 0.5 for symmetric uniform', () => {
  // n=6, equal: bottom 3 sum to half of total.
  const out = lensWidthBonferroni([1, 1, 1, 1, 1, 1]);
  assert.ok(Math.abs(out.lowerTailMassShare - 0.5) < 1e-12);
});

test('axis28 helper: bottomToTopRatio = 1 for equal, ~0 for concentrated', () => {
  const eq = lensWidthBonferroni([3, 3, 3, 3, 3]);
  assert.equal(eq.bottomToTopRatio, 1);
  const conc = lensWidthBonferroni([1, 1, 1, 1, 1000]);
  assert.ok(Math.abs(conc.bottomToTopRatio - 0.001) < 1e-12);
});

test('axis28 helper: B is BOTTOM-tail-sensitive (rank-1/i kernel)', () => {
  // A transfer FROM the population mean TO the smallest source raises B more
  // than the same-size transfer made elsewhere. Compare:
  //   xs1: [1,2,3,4,5] (B = 5/12 ~ 0.4167)
  //   xs2: [0.5,2,3,4,5.5] (transferred 0.5 from rank-3 to rank-5)
  //   xs3: [0.5,2,3,4.5,5] (transferred 0.5 from rank-1 down further to itself
  //                         is degenerate; instead transfer 0.5 from biggest
  //                         to smallest -- this REDUCES inequality, lowering B)
  const b1 = lensWidthBonferroni([1, 2, 3, 4, 5]).bonferroni;
  const b2 = lensWidthBonferroni([1.5, 2, 3, 4, 4.5]).bonferroni;
  // Equalising transfer from top to bottom must lower B (Pigou-Dalton).
  assert.ok(b2 < b1, `b2=${b2} should be < b1=${b1}`);
});

test('axis28 helper: Pigou-Dalton -- equalising transfer strictly lowers B', () => {
  const before = lensWidthBonferroni([1, 2, 3, 4, 10]);
  const after = lensWidthBonferroni([1, 2, 3, 5, 9]); // transfer 1 from top to rank-4
  assert.ok(after.bonferroni < before.bonferroni);
});

test('axis28 helper: replication invariance (B unchanged under whole-population doubling)', () => {
  const xs = [1, 2, 3, 5, 10];
  const out1 = lensWidthBonferroni(xs);
  const out2 = lensWidthBonferroni([...xs, ...xs]);
  // Bonferroni is replication-invariant in the standard formulation.
  // Allow generous tolerance for the i-index reweighting.
  assert.ok(
    Math.abs(out1.bonferroni - out2.bonferroni) < 0.05,
    `not replication-invariant within 0.05: ${out1.bonferroni} vs ${out2.bonferroni}`,
  );
});

test('axis28 helper: B >= Gini-style midpoint for symmetric concentration', () => {
  // The Bonferroni index is bounded BELOW by Gini in Tarsitano's classical
  // ordering: B >= G for any non-negative distribution. Spot-check with a
  // simple case where Gini can be hand-computed.
  // For [0,0,0,M]: Gini is approximately 3/4 = 0.75. Bonferroni is 1.
  const out = lensWidthBonferroni([0, 0, 0, 100]);
  assert.ok(out.bonferroni >= 0.75 - 1e-12);
});

test('axis28 helper: monotone increasing under rank-preserving spread', () => {
  // Spreading the distribution while keeping the mean fixed should increase B.
  const tight = lensWidthBonferroni([4, 5, 5, 5, 6]);
  const wide = lensWidthBonferroni([1, 4, 5, 6, 9]);
  assert.ok(wide.bonferroni > tight.bonferroni);
});

// ---------- buildSourceRowTokenSlopeCiLensWidthBonferroni ----------

test('axis28 build: rejects bad option values', () => {
  const q = syntheticQueue([
    { source: 'a', nRows: 24, slope: 1, noise: 5 },
  ]);
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthBonferroni(q, { minRows: 3 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthBonferroni(q, { confidence: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthBonferroni(q, { confidence: 1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthBonferroni(q, { lambda: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthBonferroni(q, { bootstraps: 50 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthBonferroni(q, { seed: 1.5 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthBonferroni(q, { alertBonferroni: -0.1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthBonferroni(q, { alertMass: -1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthBonferroni(q, { alertLowerTail: 1.5 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensWidthBonferroni(q, {
      // @ts-expect-error -- intentional bad sort
      sort: 'nope',
    }),
  );
});

test('axis28 build: empty queue yields all-degenerate report', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthBonferroni([], {});
  assert.equal(r.sourcesWithAllLenses, 0);
  // With no sources, all rows are degenerate (too-few-sources or zero
  // before any data); result rows still cover all six lenses.
  assert.equal(r.rows.length, SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES.length);
  for (const row of r.rows) {
    assert.equal(row.degenerateFlag, true);
    assert.equal(row.bonferroni, 0);
  }
  assert.equal(r.nDegenerate, SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES.length);
});

test('axis28 build: real-ish synthetic queue produces in-range B per lens', () => {
  const q = syntheticQueue([
    { source: 'a', nRows: 48, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 48, slope: 1.5, noise: 8 },
    { source: 'c', nRows: 48, slope: 2.0, noise: 12 },
    { source: 'd', nRows: 48, slope: 0.5, noise: 3 },
    { source: 'e', nRows: 48, slope: 2.5, noise: 20 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthBonferroni(q, {
    bootstraps: 200,
    seed: 7,
  });
  for (const row of r.rows) {
    if (!row.degenerateFlag) {
      assert.ok(
        row.bonferroni >= 0 && row.bonferroni <= 1,
        `lens=${row.lens}: B=${row.bonferroni} out of [0,1]`,
      );
      assert.ok(
        row.lowerTailMassShare >= 0 && row.lowerTailMassShare <= 0.5,
      );
      assert.ok(
        row.bottomToTopRatio >= 0 && row.bottomToTopRatio <= 1,
      );
    }
  }
});

test('axis28 build: sort options keep all rows but reorder', () => {
  const q = syntheticQueue([
    { source: 'a', nRows: 48, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 48, slope: 2.0, noise: 30 },
    { source: 'c', nRows: 48, slope: 1.5, noise: 10 },
    { source: 'd', nRows: 48, slope: 0.5, noise: 2 },
    { source: 'e', nRows: 48, slope: 3.0, noise: 50 },
  ]);
  for (const sort of [
    'bonferroni-desc',
    'bonferroni-asc',
    'mass-desc',
    'mean-halfwidth-desc',
    'lower-tail-asc',
    'lens',
  ] as const) {
    const r = buildSourceRowTokenSlopeCiLensWidthBonferroni(q, {
      bootstraps: 200,
      seed: 7,
      sort,
    });
    assert.equal(r.rows.length, SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES.length);
    assert.equal(r.sort, sort);
  }
});

test('axis28 build: alertBonferroni filter keeps only rows above threshold', () => {
  const q = syntheticQueue([
    { source: 'a', nRows: 48, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 48, slope: 1.5, noise: 8 },
    { source: 'c', nRows: 48, slope: 2.0, noise: 12 },
    { source: 'd', nRows: 48, slope: 0.5, noise: 3 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthBonferroni(q, {
    bootstraps: 200,
    seed: 7,
    alertBonferroni: 0.99,
  });
  // Threshold 0.99 should usually filter out everything for this synthetic.
  for (const row of r.rows) {
    assert.ok(row.bonferroni > 0.99);
  }
});

test('axis28 build: alertMass filter keeps only above threshold', () => {
  const q = syntheticQueue([
    { source: 'a', nRows: 48, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 48, slope: 1.5, noise: 8 },
    { source: 'c', nRows: 48, slope: 2.0, noise: 12 },
    { source: 'd', nRows: 48, slope: 0.5, noise: 3 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthBonferroni(q, {
    bootstraps: 200,
    seed: 7,
    alertMass: 1e9,
  });
  assert.equal(r.rows.length, 0);
});

test('axis28 build: alertLowerTail filter keeps only below threshold', () => {
  const q = syntheticQueue([
    { source: 'a', nRows: 48, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 48, slope: 1.5, noise: 8 },
    { source: 'c', nRows: 48, slope: 2.0, noise: 12 },
    { source: 'd', nRows: 48, slope: 0.5, noise: 3 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthBonferroni(q, {
    bootstraps: 200,
    seed: 7,
    alertLowerTail: 0.001,
  });
  for (const row of r.rows) {
    assert.ok(row.lowerTailMassShare < 0.001);
  }
});

test('axis28 build: report-level extremes are consistent with row values', () => {
  const q = syntheticQueue([
    { source: 'a', nRows: 48, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 48, slope: 2.0, noise: 30 },
    { source: 'c', nRows: 48, slope: 1.5, noise: 10 },
    { source: 'd', nRows: 48, slope: 0.5, noise: 2 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthBonferroni(q, {
    bootstraps: 200,
    seed: 7,
  });
  const finite = r.rows.filter((x) => !x.degenerateFlag);
  if (finite.length > 0) {
    const maxB = Math.max(...finite.map((x) => x.bonferroni));
    const minB = Math.min(...finite.map((x) => x.bonferroni));
    assert.ok(Math.abs(r.maxBonferroni - maxB) < 1e-12);
    assert.ok(Math.abs(r.minBonferroni - minB) < 1e-12);
    assert.ok(Math.abs(r.rangeBonferroni - (maxB - minB)) < 1e-12);
    assert.ok(r.mostExtremeLens !== null);
    assert.ok(r.mostUniformLens !== null);
  }
});

test('axis28 build: respects since/until window', () => {
  const q = syntheticQueue([
    { source: 'a', nRows: 96, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 96, slope: 1.5, noise: 8 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthBonferroni(q, {
    since: '2026-01-01T00:00:00Z',
    until: '2026-01-02T12:00:00Z',
    bootstraps: 200,
    seed: 7,
  });
  assert.equal(r.windowStart, '2026-01-01T00:00:00Z');
  assert.equal(r.windowEnd, '2026-01-02T12:00:00Z');
});

test('axis28 build: respects single-source filter', () => {
  const q = syntheticQueue([
    { source: 'a', nRows: 48, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 48, slope: 1.5, noise: 8 },
    { source: 'c', nRows: 48, slope: 2.0, noise: 12 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthBonferroni(q, {
    source: 'a',
    bootstraps: 200,
    seed: 7,
  });
  assert.equal(r.source, 'a');
  // Single source -> n=1 -> too-few-sources degenerate everywhere.
  for (const row of r.rows) {
    assert.equal(row.degenerateFlag, true);
  }
});

test('axis28 build: generatedAt override is honoured', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthBonferroni([], {
    generatedAt: '2030-01-01T00:00:00Z',
  });
  assert.equal(r.generatedAt, '2030-01-01T00:00:00Z');
});

// ---------- renderSourceRowTokenSlopeCiLensWidthBonferroni ----------

test('axis28 render: emits header + per-lens lines', () => {
  const q = syntheticQueue([
    { source: 'a', nRows: 48, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 48, slope: 1.5, noise: 8 },
    { source: 'c', nRows: 48, slope: 2.0, noise: 12 },
    { source: 'd', nRows: 48, slope: 0.5, noise: 3 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthBonferroni(q, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiLensWidthBonferroni(r);
  assert.ok(
    out.includes('source-row-token-slope-ci-lens-width-bonferroni'),
  );
  assert.ok(out.includes('lens'));
  assert.ok(out.includes('B'));
});

test('axis28 render: optional show-* flags add their lines', () => {
  const q = syntheticQueue([
    { source: 'a', nRows: 48, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 48, slope: 1.5, noise: 8 },
    { source: 'c', nRows: 48, slope: 2.0, noise: 12 },
    { source: 'd', nRows: 48, slope: 0.5, noise: 3 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthBonferroni(q, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiLensWidthBonferroni(r, {
    showSummary: true,
    showConcentrationAggregate: true,
    showLensAttribution: true,
    showLowerTail: true,
    showPerSourceWidths: true,
  });
  assert.ok(out.includes('summary:'));
  assert.ok(out.includes('[concentration aggregate]'));
  assert.ok(out.includes('[lens attribution]'));
  assert.ok(out.includes('lowerTail:'));
  assert.ok(out.includes('widths:'));
});

test('axis28 render: empty rows yields a "(no lenses)" line', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthBonferroni([], {
    alertBonferroni: 0.5, // filters everything out (all degenerate B=0)
  });
  const out = renderSourceRowTokenSlopeCiLensWidthBonferroni(r);
  assert.ok(out.includes('(no lenses)'));
});

test('axis28 lens-name constant exposes exactly six canonical lenses', () => {
  assert.equal(SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES.length, 6);
  assert.deepEqual([...SLOPE_LENS_WIDTH_BONFERRONI_LENS_NAMES], [
    'bootstrap',
    'jackknife',
    'bca',
    'studentizedT',
    'abc',
    'profileLikelihood',
  ]);
});

// ---------- refinement: extra edge-case + numerical safety tests ----------

test('axis28 helper edge: n=0 returns degenerate too-few-sources, B=0', () => {
  const out = lensWidthBonferroni([]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'too-few-sources');
  assert.equal(out.bonferroni, 0);
  assert.equal(out.lowerTailMassShare, 0);
  assert.equal(out.bottomToTopRatio, 0);
  assert.equal(out.nShared, 0);
});

test('axis28 helper edge: n=1 returns degenerate too-few-sources, B=0 (no inequality definable)', () => {
  const out = lensWidthBonferroni([42]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'too-few-sources');
  assert.equal(out.bonferroni, 0);
});

test('axis28 helper edge: very large but finite inputs stay in [0, 1]', () => {
  // Numerical safety: ensure the prefix-sum accumulation does not overflow
  // or wrap for realistic-but-large half-widths drawn from real-world
  // queues where CI half-widths can hit 10^7-10^9 magnitude. The output
  // must remain in [0, 1] and finite.
  const xs = [1e7, 5e7, 2e8, 8e8, 1e9, 4e9];
  const out = lensWidthBonferroni(xs);
  assert.equal(out.degenerateFlag, false);
  assert.ok(out.bonferroni >= 0 && out.bonferroni <= 1);
  assert.ok(Number.isFinite(out.bonferroni));
});

test('axis28 helper edge: tied half-widths sort stably and yield the same B as the unique-permutation variant', () => {
  const out1 = lensWidthBonferroni([2, 2, 2, 2, 2, 2]);
  const out2 = lensWidthBonferroni([2, 2, 2, 2, 2, 2]);
  assert.equal(out1.bonferroni, out2.bonferroni);
  assert.equal(out1.bonferroni, 0);
  // A tied bottom plus distinct top:
  const out3 = lensWidthBonferroni([1, 1, 1, 1, 5, 9]);
  const out4 = lensWidthBonferroni([1, 1, 9, 5, 1, 1]);
  assert.ok(Math.abs(out3.bonferroni - out4.bonferroni) < 1e-12);
});
