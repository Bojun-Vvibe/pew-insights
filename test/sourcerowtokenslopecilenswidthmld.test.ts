/**
 * Unit + integration tests for
 * source-row-token-slope-ci-lens-width-mld (axis 32).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiLensWidthMld,
  renderSourceRowTokenSlopeCiLensWidthMld,
  lensWidthMld,
  lensWidthMldTheilPair,
  lensWidthMldAlphaSweep,
  SLOPE_LENS_WIDTH_MLD_LENS_NAMES,
} from '../src/sourcerowtokenslopecilenswidthmld.js';
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

// ---------- pure helper: lensWidthMld ----------

test('axis32 helper: identical half-widths give MLD = 0', () => {
  const out = lensWidthMld([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.equal(out.degenerateFlag, false);
  assert.equal(out.degenerateReason, null);
  assert.equal(out.nShared, 6);
  assert.equal(out.meanHalfWidth, 0.5);
  assert.ok(Math.abs(out.mld) < 1e-12, `MLD=${out.mld}`);
  assert.ok(Math.abs(out.atkinsonEps1) < 1e-12, `A=${out.atkinsonEps1}`);
  // GM == AM when identical
  assert.ok(
    Math.abs(out.geometricMeanHalfWidth - 0.5) < 1e-12,
    `GM=${out.geometricMeanHalfWidth}`,
  );
});

test('axis32 helper: MLD >= 0 always (AM >= GM)', () => {
  const cases = [
    [1, 2, 3, 4, 5],
    [0.1, 0.2, 100, 200, 1000],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1000],
    [0.0001, 0.0002, 0.0003, 0.0004, 0.0005],
    [1, 100, 1000, 10000],
  ];
  for (const xs of cases) {
    const out = lensWidthMld(xs);
    assert.ok(
      Number.isFinite(out.mld) && out.mld >= 0,
      `xs=${JSON.stringify(xs)}: MLD=${out.mld}`,
    );
  }
});

test('axis32 helper: SCALE INVARIANCE -- multiplying every x by c leaves MLD unchanged', () => {
  const xs = [0.1, 0.5, 1.2, 3.7, 8.0, 100];
  const baseline = lensWidthMld(xs);
  for (const c of [0.5, 5, 100, 1000]) {
    const scaled = xs.map((v) => v * c);
    const out = lensWidthMld(scaled);
    assert.ok(
      Math.abs(out.mld - baseline.mld) < 1e-12,
      `c=${c}: MLD scaled ${out.mld} vs baseline ${baseline.mld}`,
    );
  }
});

test('axis32 helper: TRANSLATION DEPENDENCE -- adding c reduces MLD towards 0', () => {
  const xs = [0.1, 0.5, 1.2, 3.7, 8.0];
  const baseline = lensWidthMld(xs);
  const shifted = lensWidthMld(xs.map((v) => v + 10000));
  assert.ok(
    shifted.mld < baseline.mld,
    `shifted MLD=${shifted.mld} should be < baseline MLD=${baseline.mld}`,
  );
  assert.ok(
    shifted.mld < 1e-3,
    `shifted MLD=${shifted.mld} should be near 0`,
  );
});

test('axis32 helper: MLD = log(AM/GM) closed-form check', () => {
  const xs = [1, 2, 4, 8];
  const out = lensWidthMld(xs);
  // AM = 15/4 = 3.75; GM = (1*2*4*8)^(1/4) = 64^(1/4) = 2*sqrt(2) ~ 2.828427
  const amExpected = 3.75;
  const gmExpected = Math.pow(64, 0.25);
  const mldExpected = Math.log(amExpected / gmExpected);
  assert.ok(
    Math.abs(out.meanHalfWidth - amExpected) < 1e-12,
    `AM=${out.meanHalfWidth}`,
  );
  assert.ok(
    Math.abs(out.geometricMeanHalfWidth - gmExpected) < 1e-12,
    `GM=${out.geometricMeanHalfWidth} expected ${gmExpected}`,
  );
  assert.ok(
    Math.abs(out.mld - mldExpected) < 1e-12,
    `MLD=${out.mld} expected ${mldExpected}`,
  );
});

test('axis32 helper: atkinsonEps1 = 1 - exp(-MLD)', () => {
  const xs = [1, 2, 4, 8, 16, 32];
  const out = lensWidthMld(xs);
  const expected = 1 - Math.exp(-out.mld);
  assert.ok(
    Math.abs(out.atkinsonEps1 - expected) < 1e-12,
    `A=${out.atkinsonEps1} expected ${expected}`,
  );
  assert.ok(
    out.atkinsonEps1 > 0 && out.atkinsonEps1 < 1,
    `A in (0,1) got ${out.atkinsonEps1}`,
  );
});

test('axis32 helper: degenerate -- too-few-sources for n < 4', () => {
  const out = lensWidthMld([0.5, 0.5, 0.5]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'too-few-sources');
  assert.equal(out.mld, 0);
});

test('axis32 helper: degenerate -- zero-mean for all-zeros', () => {
  const out = lensWidthMld([0, 0, 0, 0, 0]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'zero-mean');
  assert.equal(out.mld, 0);
});

test('axis32 helper: degenerate -- zero-element if any x_i = 0 (UNIQUE to MLD)', () => {
  const out = lensWidthMld([0, 1, 2, 3, 4]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'zero-element');
  assert.equal(out.mld, 0);
  assert.equal(out.atkinsonEps1, 0);
});

test('axis32 helper: throws on negative input', () => {
  assert.throws(
    () => lensWidthMld([1, 2, -3, 4]),
    /halfWidths must be non-negative/,
  );
});

test('axis32 helper: throws on non-finite input', () => {
  assert.throws(
    () => lensWidthMld([1, 2, NaN, 4]),
    /halfWidths must be finite/,
  );
  assert.throws(
    () => lensWidthMld([1, 2, Infinity, 4]),
    /halfWidths must be finite/,
  );
});

test('axis32 helper: more concentrated input has larger MLD', () => {
  const equal = lensWidthMld([1, 1, 1, 1, 1, 1]);
  const mild = lensWidthMld([1, 1, 1, 2, 3, 4]);
  const big = lensWidthMld([0.1, 0.5, 1, 2, 5, 100]);
  assert.ok(equal.mld <= mild.mld, `equal=${equal.mld} mild=${mild.mld}`);
  assert.ok(mild.mld < big.mld, `mild=${mild.mld} big=${big.mld}`);
});

test('axis32 helper: MLD distinct from Theil-T on the same widths', () => {
  const xs = [0.1, 0.5, 1.2, 3.7, 8.0, 100];
  const pair = lensWidthMldTheilPair(xs);
  assert.ok(pair !== null);
  if (pair === null) return;
  // MLD bottom-emphasises, Theil-T equal-weighted -- distinct values
  assert.ok(pair.mld > 0, `MLD=${pair.mld}`);
  assert.ok(pair.theilT > 0, `T=${pair.theilT}`);
  assert.ok(
    Math.abs(pair.mld - pair.theilT) > 1e-6,
    `MLD ${pair.mld} should differ from T ${pair.theilT}`,
  );
  // Ratio is a finite positive number
  assert.ok(
    Number.isFinite(pair.ratio) && pair.ratio > 0,
    `ratio=${pair.ratio}`,
  );
});

test('axis32 helper: theilPair returns null on degenerate', () => {
  assert.equal(lensWidthMldTheilPair([0.5, 0.5, 0.5]), null);
  assert.equal(lensWidthMldTheilPair([0, 0, 0, 0]), null);
  assert.equal(lensWidthMldTheilPair([0, 1, 2, 3]), null);
});

test('axis32 helper: bottomKernelWeight is the largest single-source contribution', () => {
  const xs = [0.001, 1, 1, 1, 1, 1];
  const out = lensWidthMld(xs);
  // For x_i = 0.001, contribution = log(mean / 0.001) / n
  const contrib0 = (Math.log(out.meanHalfWidth) - Math.log(0.001)) / 6;
  assert.ok(
    Math.abs(out.bottomKernelWeight - contrib0) < 1e-12,
    `bottomW=${out.bottomKernelWeight} expected ${contrib0}`,
  );
});

// ---------- integration: build report ----------

test('axis32 build: synthetic queue with 6 sources -> all six lenses, MLD finite', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 50, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 50, slope: 1.5, noise: 10 },
    { source: 'c', nRows: 50, slope: 0.5, noise: 3 },
    { source: 'd', nRows: 50, slope: 2.0, noise: 20 },
    { source: 'e', nRows: 50, slope: 0.2, noise: 1 },
    { source: 'f', nRows: 50, slope: 3.0, noise: 30 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthMld(queue, {
    bootstraps: 200,
    seed: 7,
  });
  assert.equal(r.rows.length, 6);
  for (const lens of SLOPE_LENS_WIDTH_MLD_LENS_NAMES) {
    const row = r.rows.find((x) => x.lens === lens);
    assert.ok(row, `lens ${lens} missing`);
  }
  for (const row of r.rows) {
    if (!row.degenerateFlag) {
      assert.ok(
        Number.isFinite(row.mld) && row.mld >= 0,
        `${row.lens}: MLD=${row.mld}`,
      );
      assert.ok(
        row.atkinsonEps1 >= 0 && row.atkinsonEps1 <= 1,
        `${row.lens}: A=${row.atkinsonEps1}`,
      );
    }
  }
  assert.ok(Number.isFinite(r.meanMLD));
  assert.ok(Number.isFinite(r.medianMLD));
  assert.ok(r.maxMLD >= r.minMLD);
});

test('axis32 build: empty queue -> all lenses degenerate', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthMld([], {
    bootstraps: 100,
    seed: 1,
  });
  for (const row of r.rows) {
    assert.equal(row.degenerateFlag, true);
    assert.equal(row.degenerateReason, 'too-few-sources');
  }
  assert.equal(r.nDegenerate, 6);
});

test('axis32 build: alert filter keeps only lenses above threshold', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 50, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 50, slope: 1.5, noise: 10 },
    { source: 'c', nRows: 50, slope: 0.5, noise: 3 },
    { source: 'd', nRows: 50, slope: 2.0, noise: 20 },
    { source: 'e', nRows: 50, slope: 0.2, noise: 1 },
    { source: 'f', nRows: 50, slope: 3.0, noise: 30 },
  ]);
  const all = buildSourceRowTokenSlopeCiLensWidthMld(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const threshold = all.medianMLD;
  const filtered = buildSourceRowTokenSlopeCiLensWidthMld(queue, {
    bootstraps: 200,
    seed: 7,
    alertMld: threshold,
  });
  for (const row of filtered.rows) {
    assert.ok(
      row.mld > threshold,
      `kept row ${row.lens} MLD=${row.mld} not > ${threshold}`,
    );
  }
});

test('axis32 build: validates options', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthMld([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthMld([], { confidence: 1.5 }),
    /confidence must be a finite number in/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthMld([], { lambda: -1 }),
    /lambda must be a finite/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthMld([], { bootstraps: 50 }),
    /bootstraps must be an integer >= 100/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthMld([], { alertMld: -0.1 }),
    /alertMld must be a finite number >= 0/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthMld([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('axis32 render: pretty output contains header and lens rows', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 40, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 40, slope: 1.5, noise: 10 },
    { source: 'c', nRows: 40, slope: 0.5, noise: 3 },
    { source: 'd', nRows: 40, slope: 2.0, noise: 20 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthMld(queue, {
    bootstraps: 150,
    seed: 11,
  });
  const text = renderSourceRowTokenSlopeCiLensWidthMld(r, {
    showSummary: true,
    showConcentrationAggregate: true,
    showLensAttribution: true,
    showTheilPair: true,
  });
  assert.ok(text.includes('source-row-token-slope-ci-lens-width-mld'));
  assert.ok(text.includes('MLD'));
  assert.ok(text.includes('atkE1'));
  for (const lens of SLOPE_LENS_WIDTH_MLD_LENS_NAMES) {
    assert.ok(text.includes(lens), `render missing lens ${lens}`);
  }
  assert.ok(text.includes('[concentration aggregate]'));
  assert.ok(text.includes('[lens attribution]'));
});

test('axis32 render: empty rows -> "(no lenses)"', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthMld([], {
    bootstraps: 100,
    alertMld: 1e9,
  });
  const text = renderSourceRowTokenSlopeCiLensWidthMld(r);
  assert.ok(
    text.includes('(no lenses)'),
    `text was: ${text.substring(0, 200)}`,
  );
});

test('axis32 render: degenerate reason surfaces in table', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthMld([], {
    bootstraps: 100,
  });
  const text = renderSourceRowTokenSlopeCiLensWidthMld(r);
  assert.ok(text.includes('too-few-sources'));
});

// ---------- alphaSweep helper ----------

test('axis32 alphaSweep: GE(0) matches MLD; GE(1) matches Theil-T from theilPair', () => {
  const xs = [0.1, 0.5, 1.2, 3.7, 8.0, 100];
  const sweep = lensWidthMldAlphaSweep(xs, [0, 1]);
  assert.ok(sweep !== null);
  if (sweep === null) return;
  const mld = lensWidthMld(xs);
  const pair = lensWidthMldTheilPair(xs);
  assert.ok(pair !== null);
  if (pair === null) return;
  const ge0 = sweep.find((s) => s.alpha === 0)!;
  const ge1 = sweep.find((s) => s.alpha === 1)!;
  assert.ok(
    Math.abs(ge0.ge - mld.mld) < 1e-12,
    `GE(0)=${ge0.ge} MLD=${mld.mld}`,
  );
  assert.ok(
    Math.abs(ge1.ge - pair.theilT) < 1e-12,
    `GE(1)=${ge1.ge} TheilT=${pair.theilT}`,
  );
});

test('axis32 alphaSweep: top-heavy input -- GE(2) > GE(1) > 0 (top-tail emphasis)', () => {
  const xs = [1, 1, 1, 1, 1, 100];
  const sweep = lensWidthMldAlphaSweep(xs, [1, 2]);
  assert.ok(sweep !== null);
  if (sweep === null) return;
  const ge1 = sweep.find((s) => s.alpha === 1)!;
  const ge2 = sweep.find((s) => s.alpha === 2)!;
  assert.ok(ge1.ge > 0, `GE(1)=${ge1.ge}`);
  assert.ok(ge2.ge > ge1.ge, `GE(2)=${ge2.ge} should exceed GE(1)=${ge1.ge}`);
});

test('axis32 alphaSweep: GE(0) returns inf with x_i=0; GE(1) is finite', () => {
  const xs = [0, 1, 2, 3, 4];
  const sweep = lensWidthMldAlphaSweep(xs, [0, 1, 2]);
  assert.ok(sweep !== null);
  if (sweep === null) return;
  const ge0 = sweep.find((s) => s.alpha === 0)!;
  const ge1 = sweep.find((s) => s.alpha === 1)!;
  const ge2 = sweep.find((s) => s.alpha === 2)!;
  assert.equal(ge0.ge, Infinity);
  assert.ok(Number.isFinite(ge1.ge), `GE(1)=${ge1.ge}`);
  assert.ok(Number.isFinite(ge2.ge), `GE(2)=${ge2.ge}`);
});

test('axis32 alphaSweep: negative alpha returns inf if x_i=0', () => {
  const xs = [0, 1, 2, 3, 4];
  const sweep = lensWidthMldAlphaSweep(xs, [-1, -0.5]);
  assert.ok(sweep !== null);
  if (sweep === null) return;
  for (const s of sweep) {
    assert.equal(s.ge, Infinity, `alpha=${s.alpha} ge=${s.ge}`);
  }
});

test('axis32 alphaSweep: returns null for too-few-sources or zero-mean', () => {
  assert.equal(lensWidthMldAlphaSweep([1, 2, 3], [0, 1]), null);
  assert.equal(lensWidthMldAlphaSweep([0, 0, 0, 0, 0], [0, 1]), null);
});

test('axis32 alphaSweep: empty alphas returns []', () => {
  const sweep = lensWidthMldAlphaSweep([1, 2, 3, 4, 5], []);
  assert.deepEqual(sweep, []);
});

test('axis32 alphaSweep: throws on non-finite alpha or negative width', () => {
  assert.throws(
    () => lensWidthMldAlphaSweep([1, 2, 3, 4], [NaN]),
    /alphas must be finite/,
  );
  assert.throws(
    () => lensWidthMldAlphaSweep([1, 2, -3, 4], [0]),
    /halfWidths must be non-negative/,
  );
});

test('axis32 render: --show-alpha-sweep includes GE family line', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 40, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 40, slope: 1.5, noise: 10 },
    { source: 'c', nRows: 40, slope: 0.5, noise: 3 },
    { source: 'd', nRows: 40, slope: 2.0, noise: 20 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthMld(queue, {
    bootstraps: 150,
    seed: 11,
  });
  const text = renderSourceRowTokenSlopeCiLensWidthMld(r, {
    showAlphaSweep: true,
  });
  assert.ok(text.includes('alphaSweep'));
  assert.ok(text.includes('GE(0.0)'));
  assert.ok(text.includes('GE(1.0)'));
  assert.ok(text.includes('GE(2.0)'));
});
