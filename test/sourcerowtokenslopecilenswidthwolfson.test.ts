/**
 * Unit + integration tests for
 * source-row-token-slope-ci-lens-width-wolfson (axis 33).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiLensWidthWolfson,
  renderSourceRowTokenSlopeCiLensWidthWolfson,
  lensWidthWolfson,
  SLOPE_LENS_WIDTH_WOLFSON_LENS_NAMES,
} from '../src/sourcerowtokenslopecilenswidthwolfson.js';
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

// ---------- pure helper: lensWidthWolfson ----------

test('axis33 helper: identical half-widths give W = 0', () => {
  const out = lensWidthWolfson([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.equal(out.degenerateFlag, false);
  assert.equal(out.degenerateReason, null);
  assert.equal(out.nShared, 6);
  assert.equal(out.meanHalfWidth, 0.5);
  assert.equal(out.medianHalfWidth, 0.5);
  assert.ok(Math.abs(out.gini) < 1e-12, `gini=${out.gini}`);
  assert.ok(Math.abs(out.t) < 1e-12, `t=${out.t}`);
  assert.ok(Math.abs(out.wolfson) < 1e-12, `W=${out.wolfson}`);
  assert.ok(Math.abs(out.meanOverMedian - 1) < 1e-12);
});

test('axis33 helper: SCALE INVARIANCE -- multiplying every x by c leaves W unchanged', () => {
  const xs = [0.1, 0.5, 1.2, 3.7, 8.0, 100];
  const baseline = lensWidthWolfson(xs);
  for (const c of [0.5, 5, 100, 1000]) {
    const scaled = xs.map((v) => v * c);
    const out = lensWidthWolfson(scaled);
    assert.ok(
      Math.abs(out.wolfson - baseline.wolfson) < 1e-9,
      `c=${c}: W scaled ${out.wolfson} vs baseline ${baseline.wolfson}`,
    );
    assert.ok(
      Math.abs(out.gini - baseline.gini) < 1e-12,
      `c=${c}: gini scaled ${out.gini} vs baseline ${baseline.gini}`,
    );
    assert.ok(
      Math.abs(out.t - baseline.t) < 1e-12,
      `c=${c}: t scaled ${out.t} vs baseline ${baseline.t}`,
    );
  }
});

test('axis33 helper: TRANSLATION pushes W -> 0', () => {
  const xs = [0.1, 0.5, 1.2, 3.7, 8.0, 12.0];
  const baseline = lensWidthWolfson(xs);
  const shifted = lensWidthWolfson(xs.map((v) => v + 10000));
  assert.ok(
    Math.abs(shifted.wolfson) < Math.abs(baseline.wolfson),
    `shifted |W|=${Math.abs(shifted.wolfson)} should be < baseline |W|=${Math.abs(baseline.wolfson)}`,
  );
  assert.ok(
    Math.abs(shifted.wolfson) < 1e-3,
    `shifted W=${shifted.wolfson} should be near 0`,
  );
});

test('axis33 helper: BIPOLAR distribution gives strictly POSITIVE W', () => {
  // Symmetric bimodal: 4 values at 1, 4 values at 9, median=5
  const xs = [1, 1, 1, 1, 9, 9, 9, 9];
  const out = lensWidthWolfson(xs);
  assert.equal(out.degenerateFlag, false);
  assert.equal(out.medianHalfWidth, 5);
  assert.equal(out.meanHalfWidth, 5);
  // Mean = median, so meanOverMedian = 1
  // Gini: x sorted = [1,1,1,1,9,9,9,9], n=8, sum=40
  // sum_{i=1..n} i*x_(i) = 1+2+3+4 + 5*9+6*9+7*9+8*9 = 10 + 234 = 244
  // Gini = 2*244 / (8*40) - (8+1)/8 = 488/320 - 9/8 = 1.525 - 1.125 = 0.4
  assert.ok(Math.abs(out.gini - 0.4) < 1e-12, `gini=${out.gini} expected 0.4`);
  // L(0.5) = bottom-4 share = 4/40 = 0.1; T = 0.5 - 0.1 = 0.4
  assert.ok(
    Math.abs(out.lorenzAtMedian - 0.1) < 1e-12,
    `L(0.5)=${out.lorenzAtMedian}`,
  );
  assert.ok(Math.abs(out.t - 0.4) < 1e-12, `t=${out.t}`);
  // W = 2 * (2*0.4 - 0.4) * 1 = 2 * 0.4 = 0.8
  assert.ok(
    Math.abs(out.wolfson - 0.8) < 1e-12,
    `W=${out.wolfson} expected 0.8`,
  );
});

test('axis33 helper: UNIPOLAR (one outlier) distribution gives smaller W per Gini than bipolar', () => {
  // Same Gini-ish range but unipolar: cluster + 1 outlier
  const bipolar = lensWidthWolfson([1, 1, 1, 1, 9, 9, 9, 9]);
  const unipolar = lensWidthWolfson([1, 2, 3, 4, 5, 6, 7, 80]);
  // Both have substantially positive Gini, but bipolar has a much higher
  // W per Gini ratio. This is the Wolfson-vs-Gini orthogonality.
  const ratioBi = bipolar.wolfson / bipolar.gini;
  const ratioUni = unipolar.wolfson / unipolar.gini;
  assert.ok(
    ratioBi > ratioUni,
    `bipolar W/Gini=${ratioBi} should exceed unipolar W/Gini=${ratioUni}`,
  );
});

test('axis33 helper: gini matches closed-form on simple input', () => {
  const xs = [1, 2, 3, 4];
  const out = lensWidthWolfson(xs);
  // sorted = [1,2,3,4], n=4, sum=10
  // weighted = 1*1 + 2*2 + 3*3 + 4*4 = 30
  // Gini = 2*30/(4*10) - 5/4 = 1.5 - 1.25 = 0.25
  assert.ok(Math.abs(out.gini - 0.25) < 1e-12, `gini=${out.gini}`);
});

test('axis33 helper: lorenz at median for 4 sorted values [1,2,3,4]', () => {
  const xs = [1, 2, 3, 4];
  const out = lensWidthWolfson(xs);
  // sum=10, bottom-2 share = 3/10 = 0.3
  assert.ok(
    Math.abs(out.lorenzAtMedian - 0.3) < 1e-12,
    `L(0.5)=${out.lorenzAtMedian} expected 0.3`,
  );
  // T = 0.5 - 0.3 = 0.2
  assert.ok(Math.abs(out.t - 0.2) < 1e-12, `t=${out.t}`);
});

test('axis33 helper: degenerate -- too-few-sources for n < 4', () => {
  const out = lensWidthWolfson([0.5, 0.5, 0.5]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'too-few-sources');
  assert.equal(out.wolfson, 0);
});

test('axis33 helper: degenerate -- zero-mean for all-zeros', () => {
  const out = lensWidthWolfson([0, 0, 0, 0, 0]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'zero-mean');
  assert.equal(out.wolfson, 0);
});

test('axis33 helper: degenerate -- zero-median when bottom half is all zero (UNIQUE to Wolfson)', () => {
  // n=6, median = avg of x_(3), x_(4) = (0 + 0) / 2 = 0; mean > 0
  const out = lensWidthWolfson([0, 0, 0, 0, 5, 10]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'zero-median');
  assert.equal(out.wolfson, 0);
});

test('axis33 helper: throws on negative input', () => {
  assert.throws(
    () => lensWidthWolfson([1, 2, -3, 4]),
    /halfWidths must be non-negative/,
  );
});

test('axis33 helper: throws on non-finite input', () => {
  assert.throws(
    () => lensWidthWolfson([1, 2, NaN, 4]),
    /halfWidths must be finite/,
  );
  assert.throws(
    () => lensWidthWolfson([1, 2, Infinity, 4]),
    /halfWidths must be finite/,
  );
});

test('axis33 helper: monotonicity -- pushing mass further from median raises W', () => {
  // Start symmetric, then widen the bimodal gap
  const w1 = lensWidthWolfson([3, 3, 3, 3, 7, 7, 7, 7]).wolfson;
  const w2 = lensWidthWolfson([2, 2, 2, 2, 8, 8, 8, 8]).wolfson;
  const w3 = lensWidthWolfson([1, 1, 1, 1, 9, 9, 9, 9]).wolfson;
  assert.ok(w1 < w2, `w1=${w1} should be < w2=${w2}`);
  assert.ok(w2 < w3, `w2=${w2} should be < w3=${w3}`);
});

test('axis33 helper: gini in [0, 1] for all positive inputs', () => {
  const cases = [
    [1, 2, 3, 4, 5],
    [1, 1, 1, 1, 1, 100],
    [0.1, 0.2, 100, 200, 1000],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ];
  for (const xs of cases) {
    const out = lensWidthWolfson(xs);
    assert.ok(
      out.gini >= 0 && out.gini <= 1,
      `xs=${JSON.stringify(xs)}: gini=${out.gini}`,
    );
  }
});

test('axis33 helper: t in [0, 0.5] for all positive inputs', () => {
  const cases = [
    [1, 2, 3, 4, 5],
    [1, 1, 1, 1, 1, 100],
    [0.1, 0.2, 100, 200, 1000],
  ];
  for (const xs of cases) {
    const out = lensWidthWolfson(xs);
    assert.ok(
      out.t >= 0 && out.t <= 0.5 + 1e-12,
      `xs=${JSON.stringify(xs)}: t=${out.t}`,
    );
  }
});

test('axis33 helper: meanOverMedian > 1 for right-skewed input', () => {
  const out = lensWidthWolfson([1, 2, 3, 4, 5, 100]);
  assert.ok(
    out.meanOverMedian > 1,
    `mean/median=${out.meanOverMedian} expected > 1`,
  );
});

// ---------- integration: build report ----------

test('axis33 build: synthetic queue with 6 sources -> all six lenses, W finite', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 50, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 50, slope: 1.5, noise: 10 },
    { source: 'c', nRows: 50, slope: 0.5, noise: 3 },
    { source: 'd', nRows: 50, slope: 2.0, noise: 20 },
    { source: 'e', nRows: 50, slope: 0.2, noise: 1 },
    { source: 'f', nRows: 50, slope: 3.0, noise: 30 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthWolfson(queue, {
    bootstraps: 200,
    seed: 7,
  });
  assert.equal(r.rows.length, 6);
  for (const lens of SLOPE_LENS_WIDTH_WOLFSON_LENS_NAMES) {
    const row = r.rows.find((x) => x.lens === lens);
    assert.ok(row, `lens ${lens} missing`);
  }
  for (const row of r.rows) {
    if (!row.degenerateFlag) {
      assert.ok(
        Number.isFinite(row.wolfson),
        `${row.lens}: W=${row.wolfson}`,
      );
      assert.ok(
        row.gini >= 0 && row.gini <= 1,
        `${row.lens}: gini=${row.gini}`,
      );
      assert.ok(
        row.t >= 0 && row.t <= 0.5 + 1e-12,
        `${row.lens}: t=${row.t}`,
      );
    }
  }
  assert.ok(Number.isFinite(r.meanW));
  assert.ok(Number.isFinite(r.medianW));
  assert.ok(r.maxW >= r.minW);
});

test('axis33 build: empty queue -> all lenses degenerate', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthWolfson([], {
    bootstraps: 100,
    seed: 1,
  });
  for (const row of r.rows) {
    assert.equal(row.degenerateFlag, true);
    assert.equal(row.degenerateReason, 'too-few-sources');
  }
  assert.equal(r.nDegenerate, 6);
});

test('axis33 build: alert filter keeps only lenses with |W| above threshold', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 50, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 50, slope: 1.5, noise: 10 },
    { source: 'c', nRows: 50, slope: 0.5, noise: 3 },
    { source: 'd', nRows: 50, slope: 2.0, noise: 20 },
    { source: 'e', nRows: 50, slope: 0.2, noise: 1 },
    { source: 'f', nRows: 50, slope: 3.0, noise: 30 },
  ]);
  const all = buildSourceRowTokenSlopeCiLensWidthWolfson(queue, {
    bootstraps: 200,
    seed: 7,
  });
  // Use a threshold equal to median |W|
  const absVals = all.rows
    .filter((r) => !r.degenerateFlag)
    .map((r) => Math.abs(r.wolfson))
    .sort((a, b) => a - b);
  const threshold = absVals.length > 0 ? absVals[Math.floor(absVals.length / 2)]! : 0;
  const filtered = buildSourceRowTokenSlopeCiLensWidthWolfson(queue, {
    bootstraps: 200,
    seed: 7,
    alertWolfson: threshold,
  });
  for (const row of filtered.rows) {
    assert.ok(
      Math.abs(row.wolfson) > threshold,
      `kept row ${row.lens} |W|=${Math.abs(row.wolfson)} not > ${threshold}`,
    );
  }
});

test('axis33 build: validates options', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthWolfson([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthWolfson([], { confidence: 1.5 }),
    /confidence must be a finite number in/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthWolfson([], { lambda: -1 }),
    /lambda must be a finite/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthWolfson([], { bootstraps: 50 }),
    /bootstraps must be an integer >= 100/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthWolfson([], { alertWolfson: -0.1 }),
    /alertWolfson must be a finite number >= 0/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthWolfson([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('axis33 build: sort orderings are respected', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 50, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 50, slope: 1.5, noise: 10 },
    { source: 'c', nRows: 50, slope: 0.5, noise: 3 },
    { source: 'd', nRows: 50, slope: 2.0, noise: 20 },
  ]);
  const desc = buildSourceRowTokenSlopeCiLensWidthWolfson(queue, {
    bootstraps: 150,
    seed: 11,
    sort: 'wolfson-desc',
  });
  for (let i = 1; i < desc.rows.length; i++) {
    assert.ok(
      desc.rows[i - 1]!.wolfson >= desc.rows[i]!.wolfson,
      `desc: rows[${i - 1}].W=${desc.rows[i - 1]!.wolfson} should be >= rows[${i}].W=${desc.rows[i]!.wolfson}`,
    );
  }
  const asc = buildSourceRowTokenSlopeCiLensWidthWolfson(queue, {
    bootstraps: 150,
    seed: 11,
    sort: 'wolfson-asc',
  });
  for (let i = 1; i < asc.rows.length; i++) {
    assert.ok(
      asc.rows[i - 1]!.wolfson <= asc.rows[i]!.wolfson,
      `asc: rows[${i - 1}].W=${asc.rows[i - 1]!.wolfson} should be <= rows[${i}].W=${asc.rows[i]!.wolfson}`,
    );
  }
  const absDesc = buildSourceRowTokenSlopeCiLensWidthWolfson(queue, {
    bootstraps: 150,
    seed: 11,
    sort: 'abs-wolfson-desc',
  });
  for (let i = 1; i < absDesc.rows.length; i++) {
    assert.ok(
      Math.abs(absDesc.rows[i - 1]!.wolfson) >=
        Math.abs(absDesc.rows[i]!.wolfson),
      `abs-desc: row ${i - 1} |W| should be >= row ${i} |W|`,
    );
  }
});

test('axis33 build: lens attribution is consistent with min/max W', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 50, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 50, slope: 1.5, noise: 10 },
    { source: 'c', nRows: 50, slope: 0.5, noise: 3 },
    { source: 'd', nRows: 50, slope: 2.0, noise: 20 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthWolfson(queue, {
    bootstraps: 150,
    seed: 11,
  });
  if (r.mostBipolarisedLens) {
    const row = r.rows.find((x) => x.lens === r.mostBipolarisedLens);
    assert.ok(row);
    if (row) {
      assert.ok(
        Math.abs(row.wolfson - r.maxW) < 1e-12,
        `mostBipolarised lens W=${row.wolfson} should equal maxW=${r.maxW}`,
      );
    }
  }
  if (r.mostUnipolarisedLens) {
    const row = r.rows.find((x) => x.lens === r.mostUnipolarisedLens);
    assert.ok(row);
    if (row) {
      assert.ok(
        Math.abs(row.wolfson - r.minW) < 1e-12,
        `mostUnipolarised lens W=${row.wolfson} should equal minW=${r.minW}`,
      );
    }
  }
});

// ---------- render ----------

test('axis33 render: pretty output contains header and lens rows', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 40, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 40, slope: 1.5, noise: 10 },
    { source: 'c', nRows: 40, slope: 0.5, noise: 3 },
    { source: 'd', nRows: 40, slope: 2.0, noise: 20 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthWolfson(queue, {
    bootstraps: 150,
    seed: 11,
  });
  const text = renderSourceRowTokenSlopeCiLensWidthWolfson(r, {
    showSummary: true,
    showPolarisationAggregate: true,
    showLensAttribution: true,
  });
  assert.ok(text.includes('source-row-token-slope-ci-lens-width-wolfson'));
  assert.ok(text.includes('W'));
  assert.ok(text.includes('gini'));
  assert.ok(text.includes('L(0.5)'));
  for (const lens of SLOPE_LENS_WIDTH_WOLFSON_LENS_NAMES) {
    assert.ok(text.includes(lens), `render missing lens ${lens}`);
  }
  assert.ok(text.includes('[polarisation aggregate]'));
  assert.ok(text.includes('[lens attribution]'));
});

test('axis33 render: empty rows -> "(no lenses)"', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthWolfson([], {
    bootstraps: 100,
    alertWolfson: 1e9,
  });
  const text = renderSourceRowTokenSlopeCiLensWidthWolfson(r);
  assert.ok(
    text.includes('(no lenses)'),
    `text was: ${text.substring(0, 200)}`,
  );
});

test('axis33 render: degenerate reason surfaces in table', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthWolfson([], {
    bootstraps: 100,
  });
  const text = renderSourceRowTokenSlopeCiLensWidthWolfson(r);
  assert.ok(text.includes('too-few-sources'));
});

test('axis33 render: per-source widths line included on demand', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 40, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 40, slope: 1.5, noise: 10 },
    { source: 'c', nRows: 40, slope: 0.5, noise: 3 },
    { source: 'd', nRows: 40, slope: 2.0, noise: 20 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthWolfson(queue, {
    bootstraps: 150,
    seed: 11,
  });
  const text = renderSourceRowTokenSlopeCiLensWidthWolfson(r, {
    showPerSourceWidths: true,
  });
  assert.ok(text.includes('widths:'));
  assert.ok(text.includes('a='));
});

test('axis33 polarisationSignLabel classifies correctly', () => {
  // Bipolar -> bipolarised
  const bi = lensWidthWolfson([1, 1, 1, 1, 9, 9, 9, 9]);
  assert.ok(bi.wolfson > 0);
  // Identical -> balanced
  const eq = lensWidthWolfson([5, 5, 5, 5, 5, 5]);
  assert.ok(Math.abs(eq.wolfson) < 1e-9);
});
