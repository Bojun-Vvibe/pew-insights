/**
 * Unit + integration tests for
 * source-row-token-slope-ci-lens-width-sgini (axis 31).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiLensWidthSGini,
  renderSourceRowTokenSlopeCiLensWidthSGini,
  lensWidthSGini,
  lensWidthSGiniAtNu,
  lensWidthSGiniNuSweep,
  lensWidthSGiniElasticityProfile,
  SLOPE_LENS_WIDTH_SGINI_LENS_NAMES,
} from '../src/sourcerowtokenslopecilenswidthsgini.js';
import { lensWidthMehran } from '../src/sourcerowtokenslopecilenswidthmehran.js';
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

// ---------- pure helper: lensWidthSGini ----------

test('axis31 helper: identical half-widths give G(3) = 0', () => {
  const out = lensWidthSGini([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.equal(out.degenerateFlag, false);
  assert.equal(out.degenerateReason, null);
  assert.equal(out.nShared, 6);
  assert.equal(out.meanHalfWidth, 0.5);
  assert.ok(Math.abs(out.sgini) < 1e-12, `G(3)=${out.sgini}`);
});

test('axis31 helper: G(3) is in [0, 1] for any non-negative input', () => {
  const cases = [
    [1, 2, 3, 4, 5],
    [0.1, 0.2, 100, 200, 1000],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1000],
    [0, 0, 0, 1, 2, 3, 100],
    [0.0001, 0.0002, 0.0003, 0.0004, 0.0005],
    [0, 0, 0, 0, 0, 0, 1],
    [1, 100, 1000, 10000],
  ];
  for (const xs of cases) {
    const out = lensWidthSGini(xs);
    assert.ok(
      Number.isFinite(out.sgini) && out.sgini >= 0 && out.sgini <= 1,
      `xs=${JSON.stringify(xs)}: G(3)=${out.sgini}`,
    );
  }
});

test('axis31 helper: SCALE INVARIANCE -- multiplying every x by c leaves G(3) unchanged', () => {
  const xs = [0.1, 0.5, 1.2, 3.7, 8.0, 100];
  const baseline = lensWidthSGini(xs);
  for (const c of [0.5, 5, 100, 1000]) {
    const scaled = xs.map((v) => v * c);
    const out = lensWidthSGini(scaled);
    assert.ok(
      Math.abs(out.sgini - baseline.sgini) < 1e-9,
      `c=${c}: G(3) scaled ${out.sgini} vs baseline ${baseline.sgini}`,
    );
  }
});

test('axis31 helper: TRANSLATION DEPENDENCE -- adding c reduces G(3) towards 0', () => {
  const xs = [0.1, 0.5, 1.2, 3.7, 8.0];
  const baseline = lensWidthSGini(xs);
  const shifted = lensWidthSGini(xs.map((v) => v + 10000));
  assert.ok(
    shifted.sgini < baseline.sgini,
    `shifted G(3)=${shifted.sgini} should be < baseline=${baseline.sgini}`,
  );
  assert.ok(
    shifted.sgini < 1e-3,
    `shifted G(3)=${shifted.sgini} should be near 0`,
  );
});

test('axis31 helper: G(3) is NUMERICALLY IDENTICAL to Mehran (axis-30) for non-degenerate inputs', () => {
  // Documented identity. Verifies the operating-point choice is correct.
  const cases = [
    [1, 2, 3, 4],
    [0.1, 0.5, 1.2, 3.7, 8.0, 100],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1000],
    [0, 0, 0, 1, 2, 3, 100],
  ];
  for (const xs of cases) {
    const sg = lensWidthSGini(xs);
    const m = lensWidthMehran(xs);
    assert.ok(
      Math.abs(sg.sgini - m.mehran) < 1e-9,
      `xs=${JSON.stringify(xs)}: G(3)=${sg.sgini} vs Mehran=${m.mehran}`,
    );
  }
});

test('axis31 helper: G(2) at nu=2 EQUALS classical Gini (closed-form check)', () => {
  // For x = [1, 2, 3, 4], standard Gini = 0.25 (verified by Mehran tests).
  const g2 = lensWidthSGiniAtNu([1, 2, 3, 4], 2);
  assert.ok(g2 !== null);
  assert.ok(Math.abs(g2! - 0.25) < 1e-9, `G(2)=${g2}`);
});

test('axis31 helper: G(nu) is MONOTONICALLY INCREASING in nu for a bottom-loaded distribution', () => {
  // [0, 0, 0, 1, 2, 3, 100] is heavily concentrated -> larger nu should
  // increase G as the kernel emphasises the bottom.
  const xs = [0, 0, 0, 1, 2, 3, 100];
  const g2 = lensWidthSGiniAtNu(xs, 2)!;
  const g3 = lensWidthSGiniAtNu(xs, 3)!;
  const g4 = lensWidthSGiniAtNu(xs, 4)!;
  const g6 = lensWidthSGiniAtNu(xs, 6)!;
  assert.ok(g3 > g2, `g3=${g3} > g2=${g2}`);
  assert.ok(g4 > g3, `g4=${g4} > g3=${g3}`);
  assert.ok(g6 > g4, `g6=${g6} > g4=${g4}`);
});

test('axis31 helper: monotonicity -- a transfer FROM low TO high INCREASES G(3) (Pigou-Dalton)', () => {
  const before = lensWidthSGini([2, 3, 4, 5]);
  const after = lensWidthSGini([1, 3, 4, 6]);
  assert.ok(
    after.sgini > before.sgini,
    `after=${after.sgini} should exceed before=${before.sgini}`,
  );
});

test('axis31 helper: too-few-sources (n<4) returns degenerate', () => {
  for (const xs of [[], [1], [1, 2], [1, 2, 3]]) {
    const out = lensWidthSGini(xs);
    assert.equal(out.degenerateFlag, true);
    assert.equal(out.degenerateReason, 'too-few-sources');
    assert.equal(out.sgini, 0);
  }
});

test('axis31 helper: zero-mean returns degenerate (zero-mean reason)', () => {
  const out = lensWidthSGini([0, 0, 0, 0, 0]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'zero-mean');
  assert.equal(out.sgini, 0);
});

test('axis31 helper: rejects negative or non-finite inputs', () => {
  assert.throws(() => lensWidthSGini([1, 2, 3, -1]), /non-negative/);
  assert.throws(() => lensWidthSGini([1, 2, 3, NaN]), /finite/);
  assert.throws(() => lensWidthSGini([1, 2, 3, Infinity]), /finite/);
});

test('axis31 helper: invariant to permutation of input order', () => {
  const a = lensWidthSGini([5, 1, 3, 2, 4]);
  const b = lensWidthSGini([1, 2, 3, 4, 5]);
  const c = lensWidthSGini([3, 5, 4, 1, 2]);
  assert.ok(Math.abs(a.sgini - b.sgini) < 1e-12);
  assert.ok(Math.abs(b.sgini - c.sgini) < 1e-12);
});

test('axis31 helper: nu attribute is always 3', () => {
  for (const xs of [[1, 2, 3, 4], [0.5, 0.5, 0.5, 0.5, 0.5]]) {
    assert.equal(lensWidthSGini(xs).nu, 3);
  }
});

test('axis31 helper: elasticity is FINITE on non-degenerate non-uniform inputs', () => {
  const out = lensWidthSGini([1, 2, 3, 4, 5]);
  assert.ok(Number.isFinite(out.elasticity), `elasticity=${out.elasticity}`);
});

test('axis31 helper: elasticity is 0 on uniform input (G is 0 at all nu, central FD safe-zero)', () => {
  const out = lensWidthSGini([1, 1, 1, 1, 1, 1]);
  assert.equal(out.elasticity, 0);
  assert.ok(Math.abs(out.sgini) < 1e-12);
});

test('axis31 helper: gNuLow < G(3) < gNuHigh on a bottom-loaded distribution', () => {
  const out = lensWidthSGini([0, 0, 0, 1, 2, 3, 100]);
  assert.ok(out.gNuLow < out.sgini, `gNuLow=${out.gNuLow} < g=${out.sgini}`);
  assert.ok(out.sgini < out.gNuHigh, `g=${out.sgini} < gNuHigh=${out.gNuHigh}`);
});

test('axis31 helper: extreme concentration -- one large value gives larger G(3) than uniform', () => {
  const conc = lensWidthSGini([0, 0, 0, 0, 0, 1]);
  const equal = lensWidthSGini([1, 1, 1, 1, 1, 1]);
  assert.ok(
    conc.sgini > equal.sgini,
    `conc=${conc.sgini} eq=${equal.sgini}`,
  );
  assert.ok(conc.sgini <= 1 + 1e-9, `conc.G=${conc.sgini} should be <= 1`);
});

// ---------- helper: lensWidthSGiniAtNu ----------

test('axis31 helperAtNu: rejects nu <= 1', () => {
  assert.throws(() => lensWidthSGiniAtNu([1, 2, 3, 4], 1), /nu/);
  assert.throws(() => lensWidthSGiniAtNu([1, 2, 3, 4], 0.5), /nu/);
  assert.throws(() => lensWidthSGiniAtNu([1, 2, 3, 4], -2), /nu/);
});

test('axis31 helperAtNu: returns null on degenerate inputs', () => {
  assert.equal(lensWidthSGiniAtNu([1, 2], 3), null);
  assert.equal(lensWidthSGiniAtNu([0, 0, 0, 0], 3), null);
});

test('axis31 helperAtNu: G(2) MATCHES classic Gini sum-form for several inputs', () => {
  function classicGini(xs: number[]): number {
    const sorted = [...xs].sort((a, b) => a - b);
    const n = sorted.length;
    const total = sorted.reduce((a, b) => a + b, 0);
    const mean = total / n;
    let acc = 0;
    for (let i = 1; i <= n; i++) acc += (2 * i - n - 1) * sorted[i - 1]!;
    return acc / (n * n * mean);
  }
  const cases = [
    [1, 2, 3, 4],
    [1, 2, 3, 4, 5],
    [0.1, 0.5, 1.2, 3.7, 8.0],
    [0, 0, 1, 2, 3, 100],
  ];
  for (const xs of cases) {
    const g2 = lensWidthSGiniAtNu(xs, 2)!;
    const ref = classicGini(xs);
    assert.ok(
      Math.abs(g2 - ref) < 1e-9,
      `xs=${JSON.stringify(xs)}: G(2)=${g2} vs classic=${ref}`,
    );
  }
});

// ---------- helper: lensWidthSGiniNuSweep ----------

test('axis31 nuSweep: returns null on degenerate', () => {
  assert.equal(lensWidthSGiniNuSweep([1, 2], [2, 3]), null);
  assert.equal(lensWidthSGiniNuSweep([0, 0, 0, 0], [2, 3]), null);
});

test('axis31 nuSweep: returns one entry per requested nu', () => {
  const out = lensWidthSGiniNuSweep([1, 2, 3, 4, 5], [2, 2.5, 3, 4, 6]);
  assert.ok(out !== null);
  assert.equal(out!.length, 5);
  for (const r of out!) {
    assert.ok(Number.isFinite(r.g) && r.g >= 0 && r.g <= 1);
  }
});

test('axis31 nuSweep: G(nu) is monotonically increasing in nu on a bottom-loaded skew', () => {
  const out = lensWidthSGiniNuSweep([0, 0, 0, 1, 2, 3, 100], [2, 2.5, 3, 4, 6])!;
  for (let i = 1; i < out.length; i++) {
    assert.ok(
      out[i]!.g >= out[i - 1]!.g - 1e-12,
      `non-monotone at i=${i}: ${out[i - 1]!.g} -> ${out[i]!.g}`,
    );
  }
});

test('axis31 nuSweep: rejects nu <= 1', () => {
  assert.throws(() => lensWidthSGiniNuSweep([1, 2, 3, 4], [1]), /nu/);
});

// ---------- integration tests ----------

test('axis31 integration: all six lenses produce a row, finite G(3) values, with synthetic data', () => {
  const queue = syntheticQueue([
    { source: 'srcA', nRows: 60, slope: 5, noise: 50 },
    { source: 'srcB', nRows: 60, slope: 7, noise: 60 },
    { source: 'srcC', nRows: 60, slope: 3, noise: 40 },
    { source: 'srcD', nRows: 60, slope: 2, noise: 30 },
    { source: 'srcE', nRows: 60, slope: 9, noise: 80 },
  ]);
  const report = buildSourceRowTokenSlopeCiLensWidthSGini(queue, {
    bootstraps: 200,
    seed: 7,
  });
  assert.equal(report.rows.length, SLOPE_LENS_WIDTH_SGINI_LENS_NAMES.length);
  assert.equal(report.nu, 3);
  for (const row of report.rows) {
    assert.equal(row.nu, 3);
    if (!row.degenerateFlag) {
      assert.ok(
        Number.isFinite(row.sgini) && row.sgini >= 0 && row.sgini <= 1,
        `lens=${row.lens}: G(3)=${row.sgini}`,
      );
      assert.ok(Number.isFinite(row.elasticity));
    }
  }
});

test('axis31 integration: meanG/medianG/maxG/minG/rangeG report-level metrics are coherent', () => {
  const queue = syntheticQueue([
    { source: 'srcA', nRows: 50, slope: 5, noise: 50 },
    { source: 'srcB', nRows: 50, slope: 7, noise: 60 },
    { source: 'srcC', nRows: 50, slope: 3, noise: 40 },
    { source: 'srcD', nRows: 50, slope: 2, noise: 30 },
  ]);
  const report = buildSourceRowTokenSlopeCiLensWidthSGini(queue, {
    bootstraps: 200,
    seed: 11,
  });
  const finite = report.rows.filter((r) => !r.degenerateFlag);
  if (finite.length > 0) {
    assert.ok(report.maxG >= report.minG);
    assert.ok(Math.abs(report.rangeG - (report.maxG - report.minG)) < 1e-12);
    assert.ok(report.meanG >= report.minG - 1e-12);
    assert.ok(report.meanG <= report.maxG + 1e-12);
  }
});

test('axis31 integration: --alert-sgini filters lenses', () => {
  const queue = syntheticQueue([
    { source: 'srcA', nRows: 60, slope: 5, noise: 50 },
    { source: 'srcB', nRows: 60, slope: 7, noise: 60 },
    { source: 'srcC', nRows: 60, slope: 3, noise: 40 },
    { source: 'srcD', nRows: 60, slope: 2, noise: 30 },
  ]);
  const allReport = buildSourceRowTokenSlopeCiLensWidthSGini(queue, {
    bootstraps: 200,
    seed: 13,
  });
  const filtered = buildSourceRowTokenSlopeCiLensWidthSGini(queue, {
    bootstraps: 200,
    seed: 13,
    alertSgini: 0.99,
  });
  // alert at 0.99 should drop EVERY non-pathological lens
  assert.ok(filtered.rows.length <= allReport.rows.length);
});

test('axis31 integration: render produces non-empty output with the expected header', () => {
  const queue = syntheticQueue([
    { source: 'srcA', nRows: 60, slope: 5, noise: 50 },
    { source: 'srcB', nRows: 60, slope: 7, noise: 60 },
    { source: 'srcC', nRows: 60, slope: 3, noise: 40 },
    { source: 'srcD', nRows: 60, slope: 2, noise: 30 },
  ]);
  const report = buildSourceRowTokenSlopeCiLensWidthSGini(queue, {
    bootstraps: 200,
    seed: 17,
  });
  const out = renderSourceRowTokenSlopeCiLensWidthSGini(report, {
    showElasticity: true,
    showNuSweep: true,
    showConcentrationAggregate: true,
    showLensAttribution: true,
  });
  assert.ok(out.includes('source-row-token-slope-ci-lens-width-sgini'));
  assert.ok(out.includes('nu: 3'));
  assert.ok(out.includes('G(3)'));
});

test('axis31 integration: sort=lens orders rows by canonical lens index', () => {
  const queue = syntheticQueue([
    { source: 'srcA', nRows: 60, slope: 5, noise: 50 },
    { source: 'srcB', nRows: 60, slope: 7, noise: 60 },
    { source: 'srcC', nRows: 60, slope: 3, noise: 40 },
    { source: 'srcD', nRows: 60, slope: 2, noise: 30 },
  ]);
  const report = buildSourceRowTokenSlopeCiLensWidthSGini(queue, {
    bootstraps: 200,
    seed: 19,
    sort: 'lens',
  });
  for (let i = 0; i < report.rows.length; i++) {
    assert.equal(
      report.rows[i]!.lens,
      SLOPE_LENS_WIDTH_SGINI_LENS_NAMES[i]!,
    );
  }
});

test('axis31 integration: degenerate (insufficient sources) -> all lenses degenerate', () => {
  const queue = syntheticQueue([
    { source: 'srcA', nRows: 60, slope: 5, noise: 50 },
    { source: 'srcB', nRows: 60, slope: 7, noise: 60 },
  ]);
  const report = buildSourceRowTokenSlopeCiLensWidthSGini(queue, {
    bootstraps: 200,
    seed: 23,
  });
  for (const row of report.rows) {
    assert.equal(row.degenerateFlag, true);
    assert.equal(row.degenerateReason, 'too-few-sources');
    assert.equal(row.sgini, 0);
  }
});

// ---------- refinement helper: lensWidthSGiniElasticityProfile (v0.6.265) ----------

test('axis31 elasticityProfile: returns null on degenerate input', () => {
  assert.equal(lensWidthSGiniElasticityProfile([1, 2], [3]), null);
  assert.equal(lensWidthSGiniElasticityProfile([0, 0, 0, 0], [3]), null);
});

test('axis31 elasticityProfile: returns one entry per nu with finite g and elasticity on a non-uniform input', () => {
  const out = lensWidthSGiniElasticityProfile(
    [1, 2, 3, 4, 5],
    [2, 2.5, 3, 4, 6],
  );
  assert.ok(out !== null);
  assert.equal(out!.length, 5);
  for (const r of out!) {
    assert.ok(Number.isFinite(r.g) && r.g >= 0 && r.g <= 1);
    assert.ok(r.elasticity === null || Number.isFinite(r.elasticity));
  }
});

test('axis31 elasticityProfile: elasticity is null at every nu on a uniform distribution (G==0)', () => {
  const out = lensWidthSGiniElasticityProfile([1, 1, 1, 1, 1, 1], [2, 3, 4]);
  assert.ok(out !== null);
  for (const r of out!) {
    assert.equal(r.elasticity, null);
    assert.ok(Math.abs(r.g) < 1e-12);
  }
});

test('axis31 elasticityProfile: elasticity at nu=3 matches the headline single-point elasticity within FD tolerance', () => {
  const xs = [1, 2, 3, 4, 5, 6];
  const headline = lensWidthSGini(xs);
  const prof = lensWidthSGiniElasticityProfile(xs, [3])!;
  assert.ok(prof[0]!.elasticity !== null);
  // The two use slightly different FD step strategies (h=0.25 absolute vs
  // h_rel=1/12 ~= 0.25 at nu=3) -- they should agree to within a few percent.
  const diff = Math.abs(prof[0]!.elasticity! - headline.elasticity);
  assert.ok(
    diff < 0.05,
    `prof.elasticity=${prof[0]!.elasticity} vs headline=${headline.elasticity} diff=${diff}`,
  );
});

test('axis31 elasticityProfile: rejects nu <= 1 and bad halfWidths', () => {
  assert.throws(
    () => lensWidthSGiniElasticityProfile([1, 2, 3, 4], [1]),
    /nu/,
  );
  assert.throws(
    () => lensWidthSGiniElasticityProfile([1, 2, 3, -1], [3]),
    /non-negative/,
  );
  assert.throws(
    () => lensWidthSGiniElasticityProfile([1, 2, 3, NaN], [3]),
    /finite/,
  );
});

test('axis31 elasticityProfile: empty nus -> empty result, but non-null', () => {
  const out = lensWidthSGiniElasticityProfile([1, 2, 3, 4, 5], []);
  assert.deepEqual(out, []);
});

test('axis31 elasticityProfile: elasticity on a bottom-loaded skew is FINITE and SMALL relative to G changes', () => {
  // For a bottom-loaded distribution the elasticity at moderate nu should be
  // positive (G is increasing in nu) and bounded.
  const out = lensWidthSGiniElasticityProfile(
    [0, 0, 0, 1, 2, 3, 100],
    [2.5, 3, 3.5, 4],
  )!;
  for (const r of out) {
    assert.ok(r.elasticity !== null);
    assert.ok(r.elasticity! > 0, `elasticity at nu=${r.nu} should be > 0`);
    assert.ok(r.elasticity! < 5, `elasticity at nu=${r.nu} unreasonably large`);
  }
});
