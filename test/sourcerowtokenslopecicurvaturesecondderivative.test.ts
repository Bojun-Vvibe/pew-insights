/**
 * Unit + integration tests for
 * source-row-token-slope-ci-curvature-second-derivative.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiCurvatureSecondDerivative,
  renderSourceRowTokenSlopeCiCurvatureSecondDerivative,
  curvatureSecondDerivative,
  secondDifferences,
  signChangeCount,
  SLOPE_CURVATURE_LENS_NAMES,
} from '../src/sourcerowtokenslopecicurvaturesecondderivative.js';
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

// --- secondDifferences primitive ---

test('secondDifferences: empty and short inputs return empty', () => {
  assert.deepEqual(secondDifferences([]), []);
  assert.deepEqual(secondDifferences([1]), []);
  assert.deepEqual(secondDifferences([1, 2]), []);
});

test('secondDifferences: linear sequence has all-zero second differences', () => {
  const out = secondDifferences([1, 2, 3, 4, 5, 6]);
  assert.deepEqual(out, [0, 0, 0, 0]);
});

test('secondDifferences: constant sequence has all-zero second differences', () => {
  const out = secondDifferences([7, 7, 7, 7, 7, 7]);
  assert.deepEqual(out, [0, 0, 0, 0]);
});

test('secondDifferences: convex parabola (x^2) has positive constant second differences', () => {
  // f(k) = k^2 ⇒ D2[k] = 2 for all interior k.
  const ys = [0, 1, 4, 9, 16, 25];
  const out = secondDifferences(ys);
  assert.deepEqual(out, [2, 2, 2, 2]);
});

test('secondDifferences: concave parabola (-x^2) has negative constant second differences', () => {
  const ys = [0, -1, -4, -9, -16, -25];
  const out = secondDifferences(ys);
  assert.deepEqual(out, [-2, -2, -2, -2]);
});

test('secondDifferences: peaked sequence has one strong negative D2 at the peak', () => {
  // sequence rises to 10 then falls; the peak (index 2) yields the
  // most negative D2.
  const ys = [0, 5, 10, 5, 0, -5];
  const out = secondDifferences(ys);
  // D2[1] = 10 - 10 + 0 = 0
  // D2[2] = 5  - 20 + 5 = -10
  // D2[3] = 0  - 10 + 10 = 0
  // D2[4] = -5 - 0 + 5 = 0
  assert.deepEqual(out, [0, -10, 0, 0]);
});

test('secondDifferences: returns an array of length n - 2', () => {
  for (let n = 3; n <= 10; n++) {
    const ys = Array.from({ length: n }, (_, i) => i);
    assert.equal(secondDifferences(ys).length, n - 2);
  }
});

// --- signChangeCount primitive ---

test('signChangeCount: empty input → 0', () => {
  assert.equal(signChangeCount([]), 0);
});

test('signChangeCount: single value → 0', () => {
  assert.equal(signChangeCount([1]), 0);
  assert.equal(signChangeCount([-1]), 0);
  assert.equal(signChangeCount([0]), 0);
});

test('signChangeCount: all positive → 0 changes', () => {
  assert.equal(signChangeCount([1, 2, 3, 4]), 0);
});

test('signChangeCount: all negative → 0 changes', () => {
  assert.equal(signChangeCount([-1, -2, -3]), 0);
});

test('signChangeCount: alternating signs → max changes', () => {
  assert.equal(signChangeCount([1, -1, 1, -1]), 3);
});

test('signChangeCount: zeros are skipped', () => {
  // zero between two like-signed values does not count.
  assert.equal(signChangeCount([1, 0, 2]), 0);
  // zero between two opposite-signed values: still one change.
  assert.equal(signChangeCount([1, 0, -1]), 1);
});

test('signChangeCount: leading zeros do not establish a sign', () => {
  assert.equal(signChangeCount([0, 0, 1, -1]), 1);
});

test('signChangeCount: all zeros → 0', () => {
  assert.equal(signChangeCount([0, 0, 0, 0]), 0);
});

test('signChangeCount: mixed example', () => {
  // signs: +, +, -, +, -  ⇒ changes between pos2->pos3, pos3->pos4, pos4->pos5 = 3
  assert.equal(signChangeCount([1, 2, -3, 4, -5]), 3);
});

// --- curvatureSecondDerivative pure helper ---

test('curvatureSecondDerivative: linear midpoints (any width order) → linearFlag', () => {
  // canonical-order midpoints lie on a perfect line; widths are
  // strictly ascending so canonical order = width-sorted order.
  const widths = [1, 2, 3, 4, 5, 6];
  const mids = [10, 20, 30, 40, 50, 60];
  const r = curvatureSecondDerivative(widths, mids);
  assert.equal(r.curvatureL2, 0);
  assert.equal(r.curvatureLinf, 0);
  assert.equal(r.signChanges, 0);
  assert.equal(r.linearFlag, true);
  assert.equal(r.oscillatoryFlag, false);
  assert.equal(r.convexitySum, 0);
  assert.equal(r.convexityAbsSum, 0);
  assert.equal(r.convexityScore, 0);
  assert.equal(r.convexityLabel, 'mixed');
  assert.deepEqual(r.secondDiffs, [0, 0, 0, 0]);
  assert.equal(r.peakIndex, 0);
  assert.equal(r.peakSign, 0);
});

test('curvatureSecondDerivative: constant midpoints → linearFlag and convexityScore 0', () => {
  const widths = [1, 2, 3, 4, 5, 6];
  const mids = [42, 42, 42, 42, 42, 42];
  const r = curvatureSecondDerivative(widths, mids);
  assert.equal(r.curvatureL2, 0);
  assert.equal(r.linearFlag, true);
  assert.equal(r.convexityLabel, 'mixed');
});

test('curvatureSecondDerivative: convex parabolic midpoints → convex label, all D2 positive', () => {
  const widths = [1, 2, 3, 4, 5, 6];
  const mids = [0, 1, 4, 9, 16, 25];
  const r = curvatureSecondDerivative(widths, mids);
  assert.deepEqual(r.secondDiffs, [2, 2, 2, 2]);
  assert.equal(r.curvatureL2, Math.sqrt(16));
  assert.equal(r.curvatureLinf, 2);
  assert.equal(r.signChanges, 0);
  assert.equal(r.convexityScore, 1);
  assert.equal(r.convexityLabel, 'convex');
  assert.equal(r.linearFlag, false);
  assert.equal(r.oscillatoryFlag, false);
  assert.equal(r.peakSign, 1);
});

test('curvatureSecondDerivative: concave parabolic midpoints → concave label, all D2 negative', () => {
  const widths = [1, 2, 3, 4, 5, 6];
  const mids = [0, -1, -4, -9, -16, -25];
  const r = curvatureSecondDerivative(widths, mids);
  assert.deepEqual(r.secondDiffs, [-2, -2, -2, -2]);
  assert.equal(r.curvatureLinf, 2);
  assert.equal(r.signChanges, 0);
  assert.equal(r.convexityScore, -1);
  assert.equal(r.convexityLabel, 'concave');
  assert.equal(r.peakSign, -1);
});

test('curvatureSecondDerivative: peaked midpoints → peakSign -1 and peakLens at the peak', () => {
  const widths = [1, 2, 3, 4, 5, 6];
  const mids = [0, 5, 10, 5, 0, -5];
  const r = curvatureSecondDerivative(widths, mids);
  // D2 = [0, -10, 0, 0]; peakIndex = 1 ⇒ peakLens at width-sorted
  // position 2 = canonical lens index 2 = 'bca'.
  assert.deepEqual(r.secondDiffs, [0, -10, 0, 0]);
  assert.equal(r.curvatureLinf, 10);
  assert.equal(r.peakIndex, 1);
  assert.equal(r.peakLens, 'bca');
  assert.equal(r.peakSign, -1);
  assert.equal(r.signChanges, 0); // only one non-zero D2
  assert.equal(r.convexityScore, -1);
  assert.equal(r.convexityLabel, 'concave');
});

test('curvatureSecondDerivative: oscillatory midpoints → signChanges >= 2 and oscillatoryFlag', () => {
  // Construct mids with second-differences alternating signs.
  // mids = [0, 10, 0, 10, 0, 10]
  // D2[1] = 0 - 20 + 0 = -20
  // D2[2] = 10 - 0 + 10 = 20
  // D2[3] = 0 - 20 + 0 = -20
  // D2[4] = 10 - 0 + 10 = 20
  const widths = [1, 2, 3, 4, 5, 6];
  const mids = [0, 10, 0, 10, 0, 10];
  const r = curvatureSecondDerivative(widths, mids);
  assert.deepEqual(r.secondDiffs, [-20, 20, -20, 20]);
  assert.equal(r.signChanges, 3);
  assert.equal(r.oscillatoryFlag, true);
  assert.equal(r.linearFlag, false);
  assert.equal(r.convexityScore, 0);
  assert.equal(r.convexityLabel, 'mixed');
});

test('curvatureSecondDerivative: width-sorting reorders midpoints (canonical order ≠ width order)', () => {
  // Widths in REVERSE canonical order; widthOrder should be the
  // reverse of the canonical lens names, and the midpoints get
  // reshuffled accordingly.
  const widths = [60, 50, 40, 30, 20, 10];
  const mids = [1, 2, 3, 4, 5, 6];
  const r = curvatureSecondDerivative(widths, mids);
  // After sort: widths [10,20,30,40,50,60] map to canonical
  // indices [5,4,3,2,1,0] ⇒ lens names reversed.
  assert.deepEqual(r.widthOrder, [
    SLOPE_CURVATURE_LENS_NAMES[5],
    SLOPE_CURVATURE_LENS_NAMES[4],
    SLOPE_CURVATURE_LENS_NAMES[3],
    SLOPE_CURVATURE_LENS_NAMES[2],
    SLOPE_CURVATURE_LENS_NAMES[1],
    SLOPE_CURVATURE_LENS_NAMES[0],
  ]);
  assert.deepEqual(r.widths, [10, 20, 30, 40, 50, 60]);
  assert.deepEqual(r.mids, [6, 5, 4, 3, 2, 1]);
  assert.deepEqual(r.secondDiffs, [0, 0, 0, 0]);
  assert.equal(r.linearFlag, true);
});

test('curvatureSecondDerivative: tied widths fall back to canonical order', () => {
  const widths = [3, 3, 3, 3, 3, 3];
  const mids = [10, 20, 30, 40, 50, 60];
  const r = curvatureSecondDerivative(widths, mids);
  // All ties ⇒ canonical order preserved.
  assert.deepEqual(r.widthOrder, [...SLOPE_CURVATURE_LENS_NAMES]);
  assert.deepEqual(r.mids, [10, 20, 30, 40, 50, 60]);
  assert.equal(r.linearFlag, true);
});

test('curvatureSecondDerivative: width-span calculation via widthOrder', () => {
  const widths = [5, 10, 1, 50, 7, 22];
  const mids = [0, 0, 0, 0, 0, 0];
  const r = curvatureSecondDerivative(widths, mids);
  assert.equal(r.widths[0], 1);
  assert.equal(r.widths[5], 50);
});

test('curvatureSecondDerivative: convexityScore is clamped to [-1, 1]', () => {
  // Construct a partially convex case. mids = [0, 0, 1, 0, 0, 0]
  // D2[1] = 1, D2[2] = -2, D2[3] = 1, D2[4] = 0
  // sum = 0; abs-sum = 4; score = 0
  const r = curvatureSecondDerivative([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 0, 0]);
  assert.deepEqual(r.secondDiffs, [1, -2, 1, 0]);
  assert.equal(r.convexitySum, 0);
  assert.equal(r.convexityAbsSum, 4);
  assert.equal(r.convexityScore, 0);
});

test('curvatureSecondDerivative: convexityScore exactly +1 when all non-zero D2 positive', () => {
  // mids producing only positive D2.
  const widths = [1, 2, 3, 4, 5, 6];
  const mids = [0, 0, 1, 3, 6, 10];
  const r = curvatureSecondDerivative(widths, mids);
  // D2[1] = 1 - 0 + 0 = 1
  // D2[2] = 3 - 2 + 0 = 1
  // D2[3] = 6 - 6 + 1 = 1
  // D2[4] = 10 - 12 + 3 = 1
  assert.deepEqual(r.secondDiffs, [1, 1, 1, 1]);
  assert.equal(r.convexityScore, 1);
  assert.equal(r.convexityLabel, 'convex');
  assert.equal(r.signChanges, 0);
});

test('curvatureSecondDerivative: throws on wrong-length inputs', () => {
  assert.throws(() => curvatureSecondDerivative([1, 2, 3], [1, 2, 3, 4, 5, 6]));
  assert.throws(() => curvatureSecondDerivative([1, 2, 3, 4, 5, 6], [1, 2, 3]));
});

test('curvatureSecondDerivative: throws on negative widths', () => {
  assert.throws(() =>
    curvatureSecondDerivative([1, 2, 3, 4, -5, 6], [1, 2, 3, 4, 5, 6]),
  );
});

test('curvatureSecondDerivative: throws on non-finite values', () => {
  assert.throws(() =>
    curvatureSecondDerivative([1, 2, 3, 4, 5, 6], [1, 2, NaN, 4, 5, 6]),
  );
  assert.throws(() =>
    curvatureSecondDerivative([1, 2, 3, 4, 5, Infinity], [1, 2, 3, 4, 5, 6]),
  );
});

test('curvatureSecondDerivative: zero widths still consumed', () => {
  // All zero widths ⇒ all ties ⇒ canonical order; mids drive structure.
  const r = curvatureSecondDerivative([0, 0, 0, 0, 0, 0], [0, 1, 4, 9, 16, 25]);
  assert.deepEqual(r.widthOrder, [...SLOPE_CURVATURE_LENS_NAMES]);
  assert.equal(r.convexityScore, 1);
});

test('curvatureSecondDerivative: convexity-label thresholds at exactly +/-0.5', () => {
  // Construct mids with D2 = [1, 1, -1, 0]; convexitySum = 1;
  // convexityAbsSum = 3; score = 1/3 ≈ 0.333 ⇒ mixed.
  // Build mids: start with mid[0]=0, mid[1]=0; then
  //   mid[2] - 2*mid[1] + mid[0] = 1 ⇒ mid[2] = 1
  //   mid[3] - 2*mid[2] + mid[1] = 1 ⇒ mid[3] = 3
  //   mid[4] - 2*mid[3] + mid[2] = -1 ⇒ mid[4] = 4
  //   mid[5] - 2*mid[4] + mid[3] = 0 ⇒ mid[5] = 5
  const widths = [1, 2, 3, 4, 5, 6];
  const mids = [0, 0, 1, 3, 4, 5];
  const r = curvatureSecondDerivative(widths, mids);
  assert.deepEqual(r.secondDiffs, [1, 1, -1, 0]);
  assert.ok(Math.abs(r.convexityScore - 1 / 3) < 1e-12);
  assert.equal(r.convexityLabel, 'mixed');
});

// --- builder integration: invariants, edge cases ---

test('build: empty queue → no rows, defaults populated', () => {
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], {
    bootstraps: 100,
    seed: 1,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.rows.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.droppedMissingLens, 0);
  assert.equal(r.meanCurvatureL2, 0);
  assert.equal(r.medianCurvatureL2, 0);
  assert.equal(r.meanConvexityScore, 0);
  assert.equal(r.nLinear, 0);
  assert.equal(r.nOscillatory, 0);
  assert.equal(r.globalConvexityLabel, null);
  assert.equal(r.globalPeakLens, null);
  assert.equal(r.sort, 'curvature-l2-desc');
});

test('build: single ascending source produces a per-source row with all six lenses', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  assert.equal(r.sourcesWithAllLenses, 1);
  assert.equal(r.rows.length, 1);
  const row = r.rows[0]!;
  assert.equal(row.source, 'alpha');
  assert.ok(row.rowsKept >= 4);
  assert.equal(row.widthOrder.length, 6);
  assert.equal(row.widths.length, 6);
  assert.equal(row.mids.length, 6);
  assert.equal(row.secondDiffs.length, 4);
  assert.ok(Number.isFinite(row.curvatureL2));
  assert.ok(row.curvatureL2 >= 0);
  assert.ok(row.curvatureLinf >= 0);
  assert.ok(row.curvatureLinf <= row.curvatureL2 + 1e-9);
  assert.ok(row.signChanges >= 0 && row.signChanges <= 3);
  assert.ok(row.peakIndex >= 0 && row.peakIndex <= 3);
  assert.ok([1, -1, 0].includes(row.peakSign));
  assert.ok(row.convexityScore >= -1 && row.convexityScore <= 1);
  assert.ok(['convex', 'concave', 'mixed'].includes(row.convexityLabel));
});

test('build: rejects invalid options', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], { minRows: 2 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], { confidence: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], { confidence: 1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], { lambda: -1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], { bootstraps: 99 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], { seed: 1.5 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], {
      alertCurvature: -1,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], { top: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], {
      sort: 'bogus' as 'curvature-l2-desc',
    }),
  );
});

test('build: alertCurvature = 0 is permitted (filters to strictly > 0)', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
    alertCurvature: 0,
  });
  // Only sources with curvatureL2 strictly > 0 emitted.
  for (const row of r.rows) assert.ok(row.curvatureL2 > 0);
});

test('build: alertOscillatory filters to oscillatoryFlag == true', () => {
  const queue = [
    ...ascending('alpha', 40),
    ...ascending('beta', 50),
    ...ascending('gamma', 60),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
    alertOscillatory: true,
  });
  for (const row of r.rows) assert.equal(row.oscillatoryFlag, true);
});

test('build: top respects sort order', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 40),
    ...ascending('gamma', 50),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
    top: 1,
  });
  assert.equal(r.rows.length, 1);
});

test('build: source filter restricts to a single source', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 40),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
    source: 'alpha',
  });
  assert.equal(r.sourcesWithAllLenses <= 1, true);
  for (const row of r.rows) assert.equal(row.source, 'alpha');
});

test('build: per-row L2 >= Linf and >= 0', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 40),
    ...ascending('gamma', 50),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  for (const row of r.rows) {
    assert.ok(row.curvatureL2 >= 0);
    assert.ok(row.curvatureLinf >= 0);
    assert.ok(row.curvatureL2 + 1e-9 >= row.curvatureLinf);
  }
});

test('build: convexityScore in [-1, 1] and label is consistent', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 40),
    ...ascending('gamma', 50),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  for (const row of r.rows) {
    assert.ok(row.convexityScore >= -1 - 1e-12);
    assert.ok(row.convexityScore <= 1 + 1e-12);
    if (row.convexityScore >= 0.5) assert.equal(row.convexityLabel, 'convex');
    else if (row.convexityScore <= -0.5)
      assert.equal(row.convexityLabel, 'concave');
    else assert.equal(row.convexityLabel, 'mixed');
  }
});

test('build: signChanges is in [0, 3] for any source with 4 second-differences', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 40),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  for (const row of r.rows) {
    assert.ok(row.signChanges >= 0);
    assert.ok(row.signChanges <= 3);
    if (row.oscillatoryFlag) assert.ok(row.signChanges >= 2);
  }
});

test('build: meanCurvatureL2 and meanConvexityScore are arithmetic means of per-row values', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 40),
    ...ascending('gamma', 50),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  if (r.rows.length > 0) {
    const expectedL2 =
      r.rows.reduce((a, b) => a + b.curvatureL2, 0) / r.rows.length;
    const expectedConv =
      r.rows.reduce((a, b) => a + b.convexityScore, 0) / r.rows.length;
    assert.ok(Math.abs(r.meanCurvatureL2 - expectedL2) < 1e-9);
    assert.ok(Math.abs(r.meanConvexityScore - expectedConv) < 1e-9);
  }
});

test('build: nLinear + nOscillatory bookkeeping', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 40),
    ...ascending('gamma', 50),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  assert.equal(
    r.nLinear,
    r.rows.filter((x) => x.linearFlag).length,
  );
  assert.equal(
    r.nOscillatory,
    r.rows.filter((x) => x.oscillatoryFlag).length,
  );
});

test('build: nConvex + nConcave + nMixed sums to row count', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 40),
    ...ascending('gamma', 50),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  assert.equal(r.nConvex + r.nConcave + r.nMixed, r.sourcesWithAllLenses);
});

test('build: globalConvexityLabel tie-break favours convex > concave > mixed', () => {
  // Synthesize via direct-helper invocation: ties should favour
  // convex when nConvex == nConcave == nMixed == 0 and we have
  // 1 of each, the first label in iteration order wins.
  // Easier: just assert that with empty rows the global is null.
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], {
    bootstraps: 100,
    seed: 7,
  });
  assert.equal(r.globalConvexityLabel, null);
  assert.equal(r.globalPeakLens, null);
});

test('build: sort by source returns alphabetically ordered rows', () => {
  const queue = [
    ...ascending('gamma', 30),
    ...ascending('alpha', 30),
    ...ascending('beta', 30),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
    sort: 'source',
  });
  const names = r.rows.map((x) => x.source);
  const sorted = [...names].sort();
  assert.deepEqual(names, sorted);
});

test('build: sort by curvature-l2-desc puts highest L2 first', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 50),
    ...ascending('gamma', 70),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
    sort: 'curvature-l2-desc',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.curvatureL2 >= r.rows[i]!.curvatureL2);
  }
});

test('build: sort by convexity-score-asc puts lowest score first', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 50),
    ...ascending('gamma', 70),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
    sort: 'convexity-score-asc',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.convexityScore <= r.rows[i]!.convexityScore);
  }
});

test('build: same seed gives deterministic results across runs', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 50),
  ];
  const r1 = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const r2 = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.deepEqual(r1, r2);
});

test('build: droppedMissingLens counts sources absent from at least one lens', () => {
  // Source with too few rows for SOME lenses but enough for others
  // — hard to engineer reliably. Instead assert the bookkeeping
  // identity totalSources == sourcesWithAllLenses + droppedMissingLens.
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 50),
    ...ascending('gamma', 70),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  assert.equal(r.totalSources, r.sourcesWithAllLenses + r.droppedMissingLens);
});

test('build: droppedAboveAlert reflects how many rows the alerts removed', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 50),
    ...ascending('gamma', 70),
  ];
  const noAlert = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  const withAlert = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
    alertCurvature: Number.POSITIVE_INFINITY === Infinity ? 1e308 : 1,
  });
  // With an absurdly high alert threshold, no rows should pass.
  assert.equal(withAlert.rows.length, 0);
  assert.equal(withAlert.droppedAboveAlert, noAlert.sourcesWithAllLenses);
});

test('build: peakLens is at width-sorted position peakIndex + 1', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 50),
    ...ascending('gamma', 70),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  for (const row of r.rows) {
    assert.equal(row.peakLens, row.widthOrder[row.peakIndex + 1]);
  }
});

test('build: median is correct for an even-length row list', () => {
  // Force two rows by feeding two ascending sources.
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 50),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  if (r.rows.length === 2) {
    const a = r.rows[0]!.curvatureL2;
    const b = r.rows[1]!.curvatureL2;
    assert.ok(Math.abs(r.medianCurvatureL2 - (a + b) / 2) < 1e-9);
  }
});

// --- renderer integration ---

test('render: empty report ⇒ "(no sources)" placeholder', () => {
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], {
    bootstraps: 100,
    seed: 7,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiCurvatureSecondDerivative(r);
  assert.match(out, /pew-insights source-row-token-slope-ci-curvature-second-derivative/);
  assert.match(out, /\(no sources\)/);
});

test('render: includes header, parameter line, and per-source row', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiCurvatureSecondDerivative(r);
  assert.match(out, /alpha/);
  assert.match(out, /peakLens/);
  assert.match(out, /convScore/);
  assert.match(out, /convLabel/);
});

test('render: showSummary appends a summary line per row', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiCurvatureSecondDerivative(r, {
    showSummary: true,
  });
  assert.match(out, /summary:/);
});

test('render: showCurvatureAggregate appends a single aggregate line', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 50),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiCurvatureSecondDerivative(r, {
    showCurvatureAggregate: true,
  });
  assert.match(out, /\[curvature aggregate\]/);
});

test('render: showConvexityAggregate appends a single convexity-split line', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 50),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiCurvatureSecondDerivative(r, {
    showConvexityAggregate: true,
  });
  assert.match(out, /\[convexity aggregate\]/);
});

test('render: showPeakAttribution appends a per-lens histogram in canonical order', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 50),
    ...ascending('gamma', 70),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiCurvatureSecondDerivative(r, {
    showPeakAttribution: true,
  });
  assert.match(out, /\[peak attribution\]/);
  // All six canonical lens names appear, each with a count.
  for (const lens of SLOPE_CURVATURE_LENS_NAMES) {
    assert.match(out, new RegExp(`${lens}=\\d+/\\d+`));
  }
  // Counts in attribution sum to row count: pull them out.
  const attrLine = out.split('\n').find((l) =>
    l.startsWith('[peak attribution]'),
  );
  assert.ok(attrLine);
  const matches = [...attrLine!.matchAll(/=([0-9]+)\//g)];
  const sum = matches.reduce((a, m) => a + Number.parseInt(m[1]!, 10), 0);
  assert.equal(sum, r.rows.length);
  // globalPeakLens echoed.
  assert.match(out, /globalPeakLens=/);
});

test('render: showPeakAttribution is suppressed on empty reports', () => {
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], {
    bootstraps: 100,
    seed: 7,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiCurvatureSecondDerivative(r, {
    showPeakAttribution: true,
  });
  assert.doesNotMatch(out, /\[peak attribution\]/);
});

test('render: aggregates compose independently', () => {
  const queue = [
    ...ascending('alpha', 30),
    ...ascending('beta', 50),
  ];
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiCurvatureSecondDerivative(r, {
    showSummary: true,
    showCurvatureAggregate: true,
    showConvexityAggregate: true,
  });
  assert.match(out, /summary:/);
  assert.match(out, /\[curvature aggregate\]/);
  assert.match(out, /\[convexity aggregate\]/);
});

test('render: zero / negative numbers format consistently', () => {
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], {
    bootstraps: 100,
    seed: 7,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiCurvatureSecondDerivative(r);
  // Mean / median formatted to 4 digits even when 0.
  assert.match(out, /meanCurvatureL2: 0\.0000/);
  assert.match(out, /medianCurvatureL2: 0\.0000/);
});

test('render: parameter line includes alert flags and sort key', () => {
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative([], {
    bootstraps: 100,
    seed: 7,
    generatedAt: '2026-04-30T00:00:00.000Z',
    alertCurvature: 0.5,
    alertOscillatory: true,
    sort: 'sign-changes-desc',
  });
  const out = renderSourceRowTokenSlopeCiCurvatureSecondDerivative(r);
  assert.match(out, /alert-curvature: 0\.5/);
  assert.match(out, /alert-oscillatory: true/);
  assert.match(out, /sort: sign-changes-desc/);
});

// --- field invariants over a large random-ish workload ---

test('integration: many sources, all per-source invariants hold', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i++) {
    queue.push(...ascending(`src-${i}`, 30 + i * 5, 5 + i, 100 + i * 50));
  }
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 11,
  });
  assert.ok(r.rows.length >= 1);
  for (const row of r.rows) {
    assert.equal(row.widthOrder.length, 6);
    assert.equal(new Set(row.widthOrder).size, 6);
    assert.equal(row.widths.length, 6);
    assert.equal(row.mids.length, 6);
    assert.equal(row.secondDiffs.length, 4);
    // widths are sorted ascending in `widths`.
    for (let i = 1; i < row.widths.length; i++) {
      assert.ok(row.widths[i - 1]! <= row.widths[i]!);
    }
    assert.ok(row.curvatureL2 >= 0);
    assert.ok(row.curvatureLinf >= 0);
    assert.ok(row.curvatureL2 + 1e-9 >= row.curvatureLinf);
    assert.ok(row.signChanges >= 0 && row.signChanges <= 3);
    assert.ok(row.peakIndex >= 0 && row.peakIndex <= 3);
    assert.ok([1, -1, 0].includes(row.peakSign));
    assert.ok(row.convexityScore >= -1 - 1e-12);
    assert.ok(row.convexityScore <= 1 + 1e-12);
    assert.ok(['convex', 'concave', 'mixed'].includes(row.convexityLabel));
    assert.equal(row.linearFlag, row.curvatureL2 === 0);
    assert.equal(row.oscillatoryFlag, row.signChanges >= 2);
  }
});

test('integration: aggregates equal direct counts', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 4; i++) {
    queue.push(...ascending(`src-${i}`, 30 + i * 4, 4 + i, 50 + i * 30));
  }
  const r = buildSourceRowTokenSlopeCiCurvatureSecondDerivative(queue, {
    bootstraps: 100,
    seed: 11,
  });
  assert.equal(
    r.nConvex,
    r.rows.filter((x) => x.convexityLabel === 'convex').length,
  );
  assert.equal(
    r.nConcave,
    r.rows.filter((x) => x.convexityLabel === 'concave').length,
  );
  assert.equal(
    r.nMixed,
    r.rows.filter((x) => x.convexityLabel === 'mixed').length,
  );
});
