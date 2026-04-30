/**
 * Unit + integration tests for
 * source-row-token-slope-ci-lens-width-theil (axis 22).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiLensWidthTheil,
  renderSourceRowTokenSlopeCiLensWidthTheil,
  lensWidthTheil,
  SLOPE_LENS_WIDTH_THEIL_LENS_NAMES,
} from '../src/sourcerowtokenslopecilenswidththeil.js';
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

// ---------- pure helper: lensWidthTheil ----------

test('axis22 helper: perfectly equal half-widths gives theil = 0', () => {
  const out = lensWidthTheil([0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.equal(out.degenerateFlag, false);
  assert.equal(out.degenerateReason, null);
  assert.equal(out.nShared, 5);
  assert.ok(Math.abs(out.theil) < 1e-12, `theil should be ~0, got ${out.theil}`);
  assert.ok(Math.abs(out.theilNorm) < 1e-12);
  // shannon entropy of uniform-5 should equal ln(5)
  assert.ok(Math.abs(out.shannonEntropy - Math.log(5)) < 1e-12);
  assert.ok(Math.abs(out.lnN - Math.log(5)) < 1e-12);
  assert.ok(Math.abs(out.topShareMax - 1 / 5) < 1e-12);
});

test('axis22 helper: one source absorbs entire budget gives theil = ln(n)', () => {
  const out = lensWidthTheil([0, 0, 0, 0, 1]);
  assert.equal(out.degenerateFlag, false);
  // theil = ln(5) - 0 (only one positive share)
  assert.ok(
    Math.abs(out.theil - Math.log(5)) < 1e-12,
    `theil should be ln(5), got ${out.theil}`,
  );
  assert.ok(Math.abs(out.theilNorm - 1) < 1e-12);
  assert.ok(Math.abs(out.shannonEntropy) < 1e-12);
  assert.ok(Math.abs(out.topShareMax - 1) < 1e-12);
});

test('axis22 helper: theil equals KL(p || uniform) by direct definition', () => {
  // Distribution: half-widths 1, 2, 3, 4 -> total 10 -> p = 0.1 0.2 0.3 0.4
  // Theil via mean form:
  //   mean = 2.5; theil = (1/4) * sum (x/mu) ln(x/mu)
  //        = (1/4)[(0.4)ln(0.4) + (0.8)ln(0.8) + (1.2)ln(1.2) + (1.6)ln(1.6)]
  // Equivalent share form:
  //   theil = sum p_i ln(n p_i)
  //        = 0.1 ln(0.4) + 0.2 ln(0.8) + 0.3 ln(1.2) + 0.4 ln(1.6)
  const expected =
    0.1 * Math.log(0.4) +
    0.2 * Math.log(0.8) +
    0.3 * Math.log(1.2) +
    0.4 * Math.log(1.6);
  const out = lensWidthTheil([1, 2, 3, 4]);
  assert.ok(
    Math.abs(out.theil - expected) < 1e-12,
    `theil should equal share-form definition: got ${out.theil}, expected ${expected}`,
  );
  assert.ok(out.theil > 0 && out.theil < Math.log(4));
});

test('axis22 helper: scale invariance under positive scalar multiplication', () => {
  // T(c * x) = T(x) for c > 0 (because shares p_i are invariant)
  const a = lensWidthTheil([1, 2, 3, 4, 5]);
  const b = lensWidthTheil([100, 200, 300, 400, 500]);
  assert.ok(
    Math.abs(a.theil - b.theil) < 1e-12,
    `theil should be scale-invariant: a=${a.theil} b=${b.theil}`,
  );
  // mean and shannonEntropy do change in absolute scale: mean does, H does not.
  assert.ok(Math.abs(a.shannonEntropy - b.shannonEntropy) < 1e-12);
});

test('axis22 helper: NOT shift-invariant (Theil is shift-sensitive)', () => {
  // Adding a constant changes shares -> changes Theil.
  const a = lensWidthTheil([1, 2, 3]);
  const b = lensWidthTheil([11, 12, 13]);
  assert.ok(
    Math.abs(a.theil - b.theil) > 1e-3,
    `theil should differ between shifted distributions: a=${a.theil} b=${b.theil}`,
  );
});

test('axis22 helper: theil <= ln(n) always (clamped)', () => {
  // Stress: 100 sources, only one nonzero
  const xs = new Array(100).fill(0);
  xs[7] = 42;
  const out = lensWidthTheil(xs);
  assert.ok(out.theil <= Math.log(100) + 1e-12);
  assert.ok(out.theil >= Math.log(100) - 1e-12);
});

test('axis22 helper: zero-mean degenerate', () => {
  const out = lensWidthTheil([0, 0, 0, 0]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'zero-mean-halfwidth');
  assert.equal(out.theil, 0);
  assert.equal(out.theilNorm, 0);
});

test('axis22 helper: too few sources degenerate', () => {
  const out = lensWidthTheil([1, 2]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'too-few-sources');
  assert.equal(out.theil, 0);
});

test('axis22 helper: rejects negative half-widths', () => {
  assert.throws(() => lensWidthTheil([1, -2, 3]), /non-negative/);
});

test('axis22 helper: rejects non-finite half-widths', () => {
  assert.throws(() => lensWidthTheil([1, Number.NaN, 3]), /finite/);
  assert.throws(() => lensWidthTheil([1, Infinity, 3]), /finite/);
});

// ---------- integration: builder + render ----------

test('axis22 builder: produces six lens rows in canonical order', () => {
  const queue = syntheticQueue([
    { source: 's-alpha', nRows: 30, slope: 1.0, noise: 5 },
    { source: 's-beta', nRows: 30, slope: 0.5, noise: 8 },
    { source: 's-gamma', nRows: 30, slope: 2.0, noise: 3 },
    { source: 's-delta', nRows: 30, slope: 0.1, noise: 12 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthTheil(queue, {
    bootstraps: 200,
    seed: 7,
    generatedAt: '2026-04-30T00:00:00Z',
  });
  assert.equal(r.rows.length, 6);
  for (const lens of SLOPE_LENS_WIDTH_THEIL_LENS_NAMES) {
    assert.ok(r.rows.some((x) => x.lens === lens), `missing lens ${lens}`);
  }
  // Each row should have nShared <= 4 and theil in [0, ln(nShared)] when non-degenerate.
  for (const row of r.rows) {
    if (!row.degenerateFlag) {
      assert.ok(row.theil >= 0);
      assert.ok(row.theil <= Math.log(row.nShared) + 1e-9);
      assert.ok(row.theilNorm >= 0 && row.theilNorm <= 1 + 1e-9);
    }
  }
});

test('axis22 builder: option validation', () => {
  const queue = syntheticQueue([{ source: 's', nRows: 30, slope: 1, noise: 1 }]);
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthTheil(queue, { minRows: 2 }),
    /minRows/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthTheil(queue, { confidence: 0 }),
    /confidence/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthTheil(queue, { lambda: 0 }),
    /lambda/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthTheil(queue, { bootstraps: 50 }),
    /bootstraps/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthTheil(queue, { seed: 1.5 }),
    /seed/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthTheil(queue, { alertTheil: -1 }),
    /alertTheil/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthTheil(queue, { alertTheilNorm: 1.5 }),
    /alertTheilNorm/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthTheil(queue, {
        sort: 'bogus' as 'theil-desc',
      }),
    /sort/,
  );
});

test('axis22 render: produces table and respects show flags', () => {
  const queue = syntheticQueue([
    { source: 's-alpha', nRows: 30, slope: 1, noise: 5 },
    { source: 's-beta', nRows: 30, slope: 0.5, noise: 8 },
    { source: 's-gamma', nRows: 30, slope: 2, noise: 3 },
    { source: 's-delta', nRows: 30, slope: 0.1, noise: 12 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthTheil(queue, {
    bootstraps: 200,
    seed: 7,
    generatedAt: '2026-04-30T00:00:00Z',
  });
  const out = renderSourceRowTokenSlopeCiLensWidthTheil(r, {
    showSummary: true,
    showConcentrationAggregate: true,
    showLensAttribution: true,
    showMoments: true,
    showPerSourceWidths: true,
    showShares: true,
  });
  assert.match(out, /pew-insights source-row-token-slope-ci-lens-width-theil/);
  assert.match(out, /theilNorm/);
  assert.match(out, /\[concentration aggregate\]/);
  assert.match(out, /\[lens attribution\]/);
  assert.match(out, /summary: lens=/);
  assert.match(out, /moments: meanHalf=/);
  assert.match(out, /shares: /);
});

test('axis22 builder: alert-theil filter keeps only above threshold', () => {
  const queue = syntheticQueue([
    { source: 's-alpha', nRows: 30, slope: 1, noise: 5 },
    { source: 's-beta', nRows: 30, slope: 0.5, noise: 8 },
    { source: 's-gamma', nRows: 30, slope: 2, noise: 3 },
  ]);
  const all = buildSourceRowTokenSlopeCiLensWidthTheil(queue, {
    bootstraps: 200,
    seed: 7,
  });
  // Set alertTheil higher than any observed theil -> empty rows.
  const huge = Math.max(...all.rows.map((r) => r.theil), 0) + 100;
  const filtered = buildSourceRowTokenSlopeCiLensWidthTheil(queue, {
    bootstraps: 200,
    seed: 7,
    alertTheil: huge,
  });
  assert.equal(filtered.rows.length, 0);
});

// ---------- boundary tests (axis-22) ----------

test('axis22 boundary: n=3 minimum non-degenerate case', () => {
  // Smallest valid n: theil bound is ln(3) ~ 1.0986
  const out = lensWidthTheil([0, 0, 1]);
  assert.equal(out.degenerateFlag, false);
  assert.ok(Math.abs(out.theil - Math.log(3)) < 1e-12);
  assert.ok(Math.abs(out.theilNorm - 1) < 1e-12);
});

test('axis22 boundary: theil monotone under Pigou-Dalton transfer', () => {
  // Transfer mass from a richer source to a poorer one (with neither
  // crossing the other) must DECREASE inequality: theil(after) < theil(before).
  const before = lensWidthTheil([1, 2, 3, 10]);
  // Transfer 1 unit from the richest (10) to the second-poorest (2):
  const after = lensWidthTheil([1, 3, 3, 9]);
  assert.ok(
    after.theil < before.theil,
    `Pigou-Dalton: after(${after.theil}) should be < before(${before.theil})`,
  );
});

test('axis22 boundary: replication invariance (Cowell GE family)', () => {
  // GE indices including Theil are POPULATION-REPLICATION-INVARIANT:
  // doubling each source (each appearing twice with same value) must
  // give the same theil.
  const single = lensWidthTheil([1, 2, 3, 4]);
  const doubled = lensWidthTheil([1, 1, 2, 2, 3, 3, 4, 4]);
  assert.ok(
    Math.abs(single.theil - doubled.theil) < 1e-12,
    `replication invariance: single=${single.theil} doubled=${doubled.theil}`,
  );
});

test('axis22 boundary: many-zero sparse distribution clamp at ln(n)', () => {
  // n large, all-but-one are zero -> theil = ln(n) exactly.
  for (const n of [10, 50, 1000]) {
    const xs = new Array(n).fill(0);
    xs[0] = 1;
    const out = lensWidthTheil(xs);
    assert.equal(out.degenerateFlag, false);
    assert.ok(
      Math.abs(out.theil - Math.log(n)) < 1e-9,
      `n=${n}: theil=${out.theil} expected ln(n)=${Math.log(n)}`,
    );
    assert.ok(Math.abs(out.theilNorm - 1) < 1e-9);
  }
});

test('axis22 boundary: numerically tiny shares do not produce -Infinity', () => {
  // Very small but positive share should contribute small positive amount,
  // not blow up the sum (we never call ln(0)).
  const xs = [1e-15, 1, 1, 1];
  const out = lensWidthTheil(xs);
  assert.equal(out.degenerateFlag, false);
  assert.ok(Number.isFinite(out.theil));
  assert.ok(Number.isFinite(out.theilNorm));
  assert.ok(out.theil >= 0);
  assert.ok(out.theil <= Math.log(4) + 1e-9);
});

test('axis22 boundary: theil concordant with shannonEntropy direction', () => {
  // theil is exactly ln(n) - H(p). So if H decreases (more concentrated),
  // theil increases. Verify on a controlled pair.
  const more_equal = lensWidthTheil([2, 3, 4, 5]); // shares fairly close
  const less_equal = lensWidthTheil([1, 1, 1, 100]); // one dominates
  assert.ok(more_equal.shannonEntropy > less_equal.shannonEntropy);
  assert.ok(more_equal.theil < less_equal.theil);
  // Sum identity.
  assert.ok(
    Math.abs(more_equal.theil + more_equal.shannonEntropy - more_equal.lnN) <
      1e-12,
  );
  assert.ok(
    Math.abs(less_equal.theil + less_equal.shannonEntropy - less_equal.lnN) <
      1e-12,
  );
});

test('axis22 boundary: two-element extremes inside the valid n=3 floor', () => {
  // Confirm the n < 3 cutoff bites correctly at n = 0, 1, 2.
  for (const n of [0, 1, 2]) {
    const xs = new Array(n).fill(1);
    const out = lensWidthTheil(xs);
    assert.equal(out.degenerateFlag, true, `n=${n} should be degenerate`);
    assert.equal(out.degenerateReason, 'too-few-sources');
    assert.equal(out.theil, 0);
    assert.equal(out.theilNorm, 0);
  }
});
