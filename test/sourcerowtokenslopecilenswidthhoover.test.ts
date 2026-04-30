/**
 * Unit + integration tests for
 * source-row-token-slope-ci-lens-width-hoover (axis 25).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiLensWidthHoover,
  renderSourceRowTokenSlopeCiLensWidthHoover,
  lensWidthHoover,
  SLOPE_LENS_WIDTH_HOOVER_LENS_NAMES,
} from '../src/sourcerowtokenslopecilenswidthhoover.js';
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

// ---------- pure helper: lensWidthHoover ----------

test('axis25 helper: perfectly equal half-widths give H = 0', () => {
  const out = lensWidthHoover([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.equal(out.degenerateFlag, false);
  assert.equal(out.degenerateReason, null);
  assert.equal(out.nShared, 6);
  assert.equal(out.totalHalfWidth, 3);
  assert.equal(out.meanHalfWidth, 0.5);
  assert.equal(out.hoover, 0);
  assert.equal(out.hooverNormalised, 0);
  assert.ok(Math.abs(out.hooverMax - (1 - 1 / 6)) < 1e-12);
});

test('axis25 helper: H bounded in [0, 1 - 1/n] for any non-negative distribution', () => {
  const cases = [
    [1, 2, 3, 4, 5],
    [0.1, 0.2, 100, 200, 1000],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1000],
    [0, 0, 0, 1, 2, 3, 100],
    [0.0001, 0.0002, 0.0003, 0.0004, 0.0005],
    [0, 0, 0, 0, 0, 0, 1],
  ];
  for (const xs of cases) {
    const out = lensWidthHoover(xs);
    const hMax = 1 - 1 / xs.length;
    assert.ok(
      out.hoover >= 0 && out.hoover <= hMax + 1e-12,
      `xs=${JSON.stringify(xs)}: H=${out.hoover} not in [0, ${hMax}]`,
    );
    assert.ok(
      out.hooverNormalised >= 0 && out.hooverNormalised <= 1 + 1e-12,
      `xs=${JSON.stringify(xs)}: Hnorm=${out.hooverNormalised} not in [0, 1]`,
    );
  }
});

test('axis25 helper: matches direct (1/2)*sum|w/S - 1/n| closed form (n=8 worked example)', () => {
  // Worked example: n=8, weights [1,1,1,1,2,2,4,8], S=20, mean share 1/8=0.125
  // shares = [0.05, 0.05, 0.05, 0.05, 0.10, 0.10, 0.20, 0.40]
  // |share - 0.125| = [.075, .075, .075, .075, -.025, -.025, .075, .275] absolute:
  //   [.075, .075, .075, .075, .025, .025, .075, .275] sum=0.700
  // H = 0.5 * 0.700 = 0.350
  const xs = [1, 1, 1, 1, 2, 2, 4, 8];
  const out = lensWidthHoover(xs);
  assert.equal(out.nShared, 8);
  assert.equal(out.totalHalfWidth, 20);
  assert.ok(Math.abs(out.hoover - 0.35) < 1e-12, `H=${out.hoover}`);
  assert.ok(
    Math.abs(out.hooverNormalised - 0.35 / (1 - 1 / 8)) < 1e-12,
    `Hnorm=${out.hooverNormalised}`,
  );
});

test('axis25 helper: scale-invariance under multiplicative rescale', () => {
  const xs = [0.1, 0.4, 0.5, 1.0, 2.0, 5.0];
  const out1 = lensWidthHoover(xs);
  const out2 = lensWidthHoover(xs.map((x) => x * 1e6));
  const out3 = lensWidthHoover(xs.map((x) => x * 1e-9));
  assert.ok(Math.abs(out1.hoover - out2.hoover) < 1e-12);
  assert.ok(Math.abs(out1.hoover - out3.hoover) < 1e-12);
});

test('axis25 helper: zero-immunity -- up to n-1 zeros are tolerated, only all-zero is degenerate', () => {
  // n=6, five zeros, one positive: only that source has all the mass.
  const out1 = lensWidthHoover([0, 0, 0, 0, 0, 5]);
  assert.equal(out1.degenerateFlag, false);
  // shares = [0,0,0,0,0,1], |share - 1/6| five times = 5*(1/6); for the
  // 6th, |1 - 1/6| = 5/6. Sum = 5/6 + 5/6 = 10/6. H = 5/6 = 0.8333..
  // = hooverMax for n=6.
  assert.ok(Math.abs(out1.hoover - 5 / 6) < 1e-12, `H=${out1.hoover}`);
  assert.ok(
    Math.abs(out1.hoover - out1.hooverMax) < 1e-12,
    'concentrated extreme should saturate hooverMax',
  );
  // All-zero -> zero-mass degeneracy.
  const out2 = lensWidthHoover([0, 0, 0, 0, 0, 0]);
  assert.equal(out2.degenerateFlag, true);
  assert.equal(out2.degenerateReason, 'zero-mass');
  assert.equal(out2.hoover, 0);
});

test('axis25 helper: degenerate on n < 4 (too-few-sources)', () => {
  for (const n of [0, 1, 2, 3]) {
    const xs = Array.from({ length: n }, (_, i) => 1 + i);
    const out = lensWidthHoover(xs);
    assert.equal(out.degenerateFlag, true);
    assert.equal(out.degenerateReason, 'too-few-sources');
    assert.equal(out.hoover, 0);
  }
});

test('axis25 helper: throws on negative or non-finite inputs', () => {
  assert.throws(() => lensWidthHoover([1, -0.1, 1, 1, 1]), /non-negative/);
  assert.throws(
    () => lensWidthHoover([1, NaN, 1, 1, 1]),
    /finite/,
  );
  assert.throws(
    () => lensWidthHoover([1, Infinity, 1, 1, 1]),
    /finite/,
  );
});

test('axis25 helper: ROBUSTNESS sensitivity -- a single 1000x outlier dominates H (vs QCD which is robust)', () => {
  const baseline = [1, 1, 1, 1, 1, 1];
  const perturbed = [1, 1, 1, 1, 1, 1000];
  const baseOut = lensWidthHoover(baseline);
  const pertOut = lensWidthHoover(perturbed);
  // Hoover is NOT a robust statistic (this is by design and orthogonal to
  // axis-24 QCD which IS robust). The outlier should move H significantly.
  assert.equal(baseOut.hoover, 0);
  assert.ok(
    pertOut.hoover > 0.5,
    `expected single-outlier H > 0.5 (sensitivity), got ${pertOut.hoover}`,
  );
});

test('axis25 helper: monotone in concentration -- moving mass to one source increases H', () => {
  // Start uniform, progressively concentrate into source 0
  const cases = [
    [1, 1, 1, 1, 1, 1],
    [2, 1, 1, 1, 1, 1],
    [5, 1, 1, 1, 1, 1],
    [20, 1, 1, 1, 1, 1],
    [100, 1, 1, 1, 1, 1],
  ];
  let prev = -Infinity;
  for (const xs of cases) {
    const out = lensWidthHoover(xs);
    assert.ok(
      out.hoover >= prev - 1e-12,
      `H non-monotone: ${prev} -> ${out.hoover} on ${JSON.stringify(xs)}`,
    );
    prev = out.hoover;
  }
});

test('axis25 helper: Lorenz-gap supremum identity -- H = sup_p |L(p) - p| (closed-form check)', () => {
  // For sorted shares p_(1) <= ... <= p_(n), Hoover equals
  // (k*/n) - L(k*/n) where k* maximises p - L(p). For symmetric
  // worked example [1,1,1,1,2,2,4,8] (n=8, sorted), cumsum/total =
  // [.05, .10, .15, .20, .30, .40, .60, 1.0]. Equality line at k/n =
  // [.125, .25, .375, .5, .625, .75, .875, 1.0].
  // gap p - L(p) = [.075, .15, .225, .30, .325, .35, .275, 0]. max = .35.
  const xs = [1, 1, 1, 1, 2, 2, 4, 8];
  const out = lensWidthHoover(xs);
  assert.ok(
    Math.abs(out.hoover - 0.35) < 1e-12,
    `Lorenz-sup identity: H=${out.hoover}, expected 0.35`,
  );
});

test('axis25 helper: hooverNormalised = H / (1 - 1/n) on saturated extreme', () => {
  // [0,0,0,0,9] -- saturated extreme on n=5
  const out = lensWidthHoover([0, 0, 0, 0, 9]);
  assert.equal(out.degenerateFlag, false);
  assert.ok(Math.abs(out.hoover - (1 - 1 / 5)) < 1e-12);
  assert.ok(Math.abs(out.hooverNormalised - 1) < 1e-12);
});

test('axis25 helper: redistributableShare alias matches hoover exactly', () => {
  const out = lensWidthHoover([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
  // (We assert via the report row in integration test below; the bare
  // helper does not expose redistributableShare. Here just sanity-check
  // hoover is finite, in-range.)
  assert.ok(out.hoover >= 0 && out.hoover < 1);
});

// ---------- integration: buildSourceRowTokenSlopeCiLensWidthHoover ----------

test('axis25 integration: report has six lens rows, all stats bounded, sorted desc by H', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 60, slope: 1.5, noise: 30 },
    { source: 'c', nRows: 60, slope: 2.0, noise: 60 },
    { source: 'd', nRows: 60, slope: 0.5, noise: 2 },
    { source: 'e', nRows: 60, slope: 1.2, noise: 80 },
    { source: 'f', nRows: 60, slope: 0.8, noise: 15 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
    bootstraps: 200,
    seed: 7,
  });
  assert.equal(r.rows.length, 6);
  for (const row of r.rows) {
    assert.ok(SLOPE_LENS_WIDTH_HOOVER_LENS_NAMES.includes(row.lens));
    assert.ok(row.hoover >= 0 && row.hoover <= 1);
    assert.ok(row.hooverNormalised >= 0 && row.hooverNormalised <= 1);
    assert.ok(row.totalHalfWidth >= 0);
    assert.equal(row.redistributableShare, row.hoover);
  }
  // Default sort hoover-desc
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.hoover >= r.rows[i]!.hoover - 1e-12);
  }
  assert.ok(r.maxHoover >= r.minHoover);
  assert.ok(Math.abs(r.rangeHoover - (r.maxHoover - r.minHoover)) < 1e-12);
});

test('axis25 integration: --alert-hoover filter respected', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 60, slope: 1.5, noise: 30 },
    { source: 'c', nRows: 60, slope: 2.0, noise: 60 },
    { source: 'd', nRows: 60, slope: 0.5, noise: 2 },
    { source: 'e', nRows: 60, slope: 1.2, noise: 80 },
    { source: 'f', nRows: 60, slope: 0.8, noise: 15 },
  ]);
  const r0 = buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const r1 = buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
    bootstraps: 200,
    seed: 7,
    alertHoover: 0.99,
  });
  assert.ok(r1.rows.length <= r0.rows.length);
  for (const row of r1.rows) assert.ok(row.hoover > 0.99);
});

test('axis25 integration: --alert-mass filter respected', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 60, slope: 1.5, noise: 30 },
    { source: 'c', nRows: 60, slope: 2.0, noise: 60 },
    { source: 'd', nRows: 60, slope: 0.5, noise: 2 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
    bootstraps: 200,
    seed: 7,
    alertMass: 1e9,
  });
  assert.equal(r.rows.length, 0);
});

test('axis25 integration: sort=lens preserves canonical lens order', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 60, slope: 1.5, noise: 30 },
    { source: 'c', nRows: 60, slope: 2.0, noise: 60 },
    { source: 'd', nRows: 60, slope: 0.5, noise: 2 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
    bootstraps: 200,
    seed: 7,
    sort: 'lens',
  });
  for (let i = 0; i < r.rows.length; i++) {
    assert.equal(r.rows[i]!.lens, SLOPE_LENS_WIDTH_HOOVER_LENS_NAMES[i]);
  }
});

test('axis25 integration: sort=hoover-asc reverses order vs hoover-desc', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 60, slope: 1.5, noise: 30 },
    { source: 'c', nRows: 60, slope: 2.0, noise: 60 },
    { source: 'd', nRows: 60, slope: 0.5, noise: 2 },
  ]);
  const desc = buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
    bootstraps: 200,
    seed: 7,
    sort: 'hoover-desc',
  });
  const asc = buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
    bootstraps: 200,
    seed: 7,
    sort: 'hoover-asc',
  });
  for (let i = 1; i < asc.rows.length; i++) {
    assert.ok(asc.rows[i - 1]!.hoover <= asc.rows[i]!.hoover + 1e-12);
  }
  assert.equal(asc.rows.length, desc.rows.length);
});

test('axis25 integration: render emits all section markers (--show-* flags)', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 60, slope: 1.5, noise: 30 },
    { source: 'c', nRows: 60, slope: 2.0, noise: 60 },
    { source: 'd', nRows: 60, slope: 0.5, noise: 2 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiLensWidthHoover(r, {
    showSummary: true,
    showConcentrationAggregate: true,
    showLensAttribution: true,
    showRedistribution: true,
    showPerSourceWidths: true,
  });
  assert.match(out, /pew-insights source-row-token-slope-ci-lens-width-hoover/);
  assert.match(out, /summary: lens=/);
  assert.match(out, /\[concentration aggregate\]/);
  assert.match(out, /\[lens attribution\]/);
  assert.match(out, /redistribution: /);
  assert.match(out, /widths: /);
});

test('axis25 integration: render handles empty rows gracefully', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 60, slope: 1.5, noise: 30 },
    { source: 'c', nRows: 60, slope: 2.0, noise: 60 },
    { source: 'd', nRows: 60, slope: 0.5, noise: 2 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
    bootstraps: 200,
    seed: 7,
    alertHoover: 1, // strict > 1 -> empty
  });
  const out = renderSourceRowTokenSlopeCiLensWidthHoover(r);
  assert.match(out, /\(no lenses\)/);
});

test('axis25 integration: invalid options throw clearly', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 60, slope: 1.5, noise: 30 },
    { source: 'c', nRows: 60, slope: 2.0, noise: 60 },
    { source: 'd', nRows: 60, slope: 0.5, noise: 2 },
  ]);
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthHoover(queue, { minRows: 2 }),
    /minRows/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthHoover(queue, { confidence: 1.5 }),
    /confidence/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthHoover(queue, { lambda: -1 }),
    /lambda/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthHoover(queue, { bootstraps: 50 }),
    /bootstraps/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
        alertHoover: -0.1,
      }),
    /alertHoover/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthHoover(queue, { alertHoover: 1.5 }),
    /alertHoover/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthHoover(queue, { alertMass: -1 }),
    /alertMass/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
        // @ts-expect-error -- testing runtime validation
        sort: 'bogus',
      }),
    /sort/,
  );
});

test('axis25 integration: meanConcentrated and mostUniform identify the extremal lenses', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 60, slope: 1.5, noise: 30 },
    { source: 'c', nRows: 60, slope: 2.0, noise: 60 },
    { source: 'd', nRows: 60, slope: 0.5, noise: 2 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
    bootstraps: 200,
    seed: 7,
    sort: 'lens',
  });
  if (r.mostConcentratedLens && r.mostUniformLens) {
    const hi = r.rows.find((x) => x.lens === r.mostConcentratedLens)!;
    const lo = r.rows.find((x) => x.lens === r.mostUniformLens)!;
    assert.ok(hi.hoover >= lo.hoover - 1e-12);
  }
});

test('axis25 integration: concentrationLabel binning is consistent with H thresholds', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 60, slope: 1.5, noise: 30 },
    { source: 'c', nRows: 60, slope: 2.0, noise: 60 },
    { source: 'd', nRows: 60, slope: 0.5, noise: 2 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
    bootstraps: 200,
    seed: 7,
  });
  for (const row of r.rows) {
    if (row.degenerateFlag) {
      assert.equal(row.concentrationLabel, 'degenerate');
      continue;
    }
    if (row.hoover > 0.5) {
      assert.equal(row.concentrationLabel, 'highly-concentrated');
    } else if (row.hoover > 0.3) {
      assert.equal(row.concentrationLabel, 'moderately-concentrated');
    } else if (row.hoover > 0.1) {
      assert.equal(row.concentrationLabel, 'mild-concentration');
    } else {
      assert.equal(row.concentrationLabel, 'near-uniform');
    }
  }
});

test('axis25 integration: report metadata fields populated correctly', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 60, slope: 1.5, noise: 30 },
    { source: 'c', nRows: 60, slope: 2.0, noise: 60 },
    { source: 'd', nRows: 60, slope: 0.5, noise: 2 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
    bootstraps: 200,
    seed: 7,
    confidence: 0.9,
    lambda: 1.5,
    alertHoover: 0.1,
    alertMass: 0,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.confidence, 0.9);
  assert.equal(r.lambda, 1.5);
  assert.equal(r.bootstraps, 200);
  assert.equal(r.seed, 7);
  assert.equal(r.alertHoover, 0.1);
  assert.equal(r.alertMass, 0);
  assert.equal(r.generatedAt, '2026-04-30T00:00:00.000Z');
  assert.equal(r.sort, 'hoover-desc');
  assert.equal(r.sourcesWithAllLenses + r.droppedMissingLens, r.totalSources);
});

test('axis25 integration: tie-break uses canonical lens order on equal H', () => {
  // All-uniform inputs across all sources -> H should be ~0 for every
  // lens, so the secondary lens-order tie-break should kick in.
  const queue = syntheticQueue([
    { source: 'a', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'c', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'd', nRows: 60, slope: 1.0, noise: 5 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
    bootstraps: 200,
    seed: 7,
    sort: 'hoover-desc',
  });
  // If two adjacent rows share H exactly, the row that comes earlier
  // in the canonical lens enum should appear first.
  for (let i = 1; i < r.rows.length; i++) {
    if (Math.abs(r.rows[i - 1]!.hoover - r.rows[i]!.hoover) < 1e-15) {
      assert.ok(
        SLOPE_LENS_WIDTH_HOOVER_LENS_NAMES.indexOf(r.rows[i - 1]!.lens) <
          SLOPE_LENS_WIDTH_HOOVER_LENS_NAMES.indexOf(r.rows[i]!.lens),
      );
    }
  }
});

test('axis25 integration: hooverMax = 1 - 1/n for non-degenerate rows', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 60, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 60, slope: 1.5, noise: 30 },
    { source: 'c', nRows: 60, slope: 2.0, noise: 60 },
    { source: 'd', nRows: 60, slope: 0.5, noise: 2 },
    { source: 'e', nRows: 60, slope: 1.2, noise: 80 },
    { source: 'f', nRows: 60, slope: 0.8, noise: 15 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthHoover(queue, {
    bootstraps: 200,
    seed: 7,
  });
  for (const row of r.rows) {
    if (row.degenerateFlag) continue;
    assert.ok(
      Math.abs(row.hooverMax - (1 - 1 / row.nShared)) < 1e-12,
      `lens=${row.lens}: hooverMax=${row.hooverMax}, expected ${1 - 1 / row.nShared}`,
    );
  }
});
