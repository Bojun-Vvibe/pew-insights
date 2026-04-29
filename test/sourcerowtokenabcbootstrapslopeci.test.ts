/**
 * Unit + property tests for source-row-token-abc-bootstrap-slope-ci.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenAbcBootstrapSlopeCi,
  weightedDemingSlope,
  abcDirectionalDerivatives,
  abcAcceleration,
  abcBias,
  abcSigmaHat,
  abcCurvature,
  abcEndpoint,
} from '../src/sourcerowtokenabcbootstrapslopeci.js';
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

const GEN = '2026-04-29T12:00:00.000Z';

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

// =========================================================================
// weightedDemingSlope
// =========================================================================

test('weightedDemingSlope: equal weights matches unweighted Deming on linear data', () => {
  const ys = [1, 2, 3, 4, 5, 6];
  const w = [1, 1, 1, 1, 1, 1];
  const slope = weightedDemingSlope(ys, w, 1);
  // Perfectly linear: Deming slope (ys vs row index) should be ~1 in
  // the dx-per-dy convention used by demingSlopeFromSums (slope = 1).
  assert.ok(Math.abs(slope - 1) < 1e-6, `slope=${slope}`);
});

test('weightedDemingSlope: doubling all weights does not change slope', () => {
  const ys = [10, 20, 15, 30, 25, 40];
  const wA = [1, 1, 1, 1, 1, 1];
  const wB = [2, 2, 2, 2, 2, 2];
  const a = weightedDemingSlope(ys, wA, 1);
  const b = weightedDemingSlope(ys, wB, 1);
  assert.ok(Math.abs(a - b) < 1e-9);
});

test('weightedDemingSlope: zero weights collapse to 0', () => {
  const ys = [1, 2, 3, 4];
  const slope = weightedDemingSlope(ys, [0, 0, 0, 0], 1);
  assert.equal(slope, 0);
});

test('weightedDemingSlope: constant ys -> slope 0', () => {
  const ys = [5, 5, 5, 5, 5];
  const slope = weightedDemingSlope(ys, [1, 1, 1, 1, 1], 1);
  assert.equal(slope, 0);
});

// =========================================================================
// abcDirectionalDerivatives
// =========================================================================

test('abcDirectionalDerivatives: returns 2n+1 effective Deming evaluations worth of values', () => {
  const ys = [1, 2, 3, 4, 5, 6];
  const { tDot, tDdot, thetaHat } = abcDirectionalDerivatives(ys, 1, 0.01);
  assert.equal(tDot.length, ys.length);
  assert.equal(tDdot.length, ys.length);
  assert.ok(Math.abs(thetaHat - 1) < 1e-6);
  // Symmetry: for perfectly linear data with symmetric weights, the
  // T_dot influence pattern should sum approximately to zero (the
  // sample influence function integrates to 0).
  const sum = tDot.reduce((acc, v) => acc + v, 0);
  assert.ok(Math.abs(sum) < 1e-6, `sum tDot = ${sum}`);
});

test('abcDirectionalDerivatives: constant ys -> all T_dot ~ 0', () => {
  const ys = [7, 7, 7, 7, 7];
  const { tDot } = abcDirectionalDerivatives(ys, 1, 0.01);
  for (const v of tDot) assert.ok(Math.abs(v) < 1e-9);
});

// =========================================================================
// abcAcceleration / abcBias / abcSigmaHat
// =========================================================================

test('abcAcceleration: symmetric T_dot -> a == 0', () => {
  // Perfectly antisymmetric T_dot sums to zero in the cube too.
  const tDot = [-2, -1, 0, 1, 2];
  const a = abcAcceleration(tDot);
  assert.ok(Math.abs(a) < 1e-12);
});

test('abcAcceleration: empty -> 0', () => {
  assert.equal(abcAcceleration([]), 0);
});

test('abcAcceleration: all-zero T_dot -> 0', () => {
  assert.equal(abcAcceleration([0, 0, 0]), 0);
});

test('abcAcceleration: positive-skew T_dot -> a > 0', () => {
  const tDot = [-1, -1, -1, -1, 4];
  const a = abcAcceleration(tDot);
  assert.ok(a > 0);
});

test('abcBias: constant T_ddot averages to that value over 2n', () => {
  const tDdot = [4, 4, 4, 4];
  // b = (1/(2n^2)) * sum = (1/32) * 16 = 0.5
  const b = abcBias(tDdot);
  assert.ok(Math.abs(b - 0.5) < 1e-12);
});

test('abcBias: empty -> 0', () => {
  assert.equal(abcBias([]), 0);
});

test('abcSigmaHat: matches sqrt(sum sq)/n', () => {
  const tDot = [3, 4]; // sum sq = 25, sqrt = 5, /n = 2.5
  assert.ok(Math.abs(abcSigmaHat(tDot) - 2.5) < 1e-12);
});

test('abcSigmaHat: empty -> 0', () => {
  assert.equal(abcSigmaHat([]), 0);
});

// =========================================================================
// abcCurvature
// =========================================================================

test('abcCurvature: zero sigma -> 0', () => {
  assert.equal(abcCurvature([1, 1, 1, 1], [0, 0, 0, 0], 0, 0, 1, 0.01), 0);
});

// =========================================================================
// abcEndpoint
// =========================================================================

test('abcEndpoint: zero T_dot -> theta == thetaHat', () => {
  const ys = [5, 5, 5, 5];
  const tDot = [0, 0, 0, 0];
  const r = abcEndpoint(ys, tDot, 0, 0, 0, -1.96, 1);
  assert.equal(r.thetaAlpha, 0);
  assert.equal(r.wAlpha, 0);
});

test('abcEndpoint: nonzero T_dot, a=b=0 -> wAlpha == zAlpha', () => {
  const ys = [1, 4, 2, 7, 5, 9, 6, 11];
  const { tDot } = abcDirectionalDerivatives(ys, 1, 0.01);
  // Confirm we have nonzero influence on this noisy series.
  const s2 = tDot.reduce((acc, v) => acc + v * v, 0);
  assert.ok(s2 > 0, `degenerate tDot: ${tDot}`);
  const r = abcEndpoint(ys, tDot, 1, 0, 0, -1.96, 1);
  assert.ok(Math.abs(r.wAlpha - -1.96) < 1e-9);
});

// =========================================================================
// buildSourceRowTokenAbcBootstrapSlopeCi
// =========================================================================

test('build: valid linear series -> ci brackets slope ~ 1', () => {
  const queue: QueueLine[] = mkSeries('A', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = buildSourceRowTokenAbcBootstrapSlopeCi(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'A');
  assert.equal(row.rowsKept, 10);
  assert.ok(Math.abs(row.slope - 1) < 1e-6, `slope=${row.slope}`);
  assert.ok(row.ciLower <= row.slope + 1e-6);
  assert.ok(row.ciUpper >= row.slope - 1e-6);
  assert.ok(row.ciWidth >= 0);
});

test('build: deterministic — repeated runs identical', () => {
  const queue: QueueLine[] = mkSeries('A', [3, 7, 1, 9, 4, 6, 2, 8]);
  const a = buildSourceRowTokenAbcBootstrapSlopeCi(queue, { generatedAt: GEN });
  const b = buildSourceRowTokenAbcBootstrapSlopeCi(queue, { generatedAt: GEN });
  assert.deepEqual(a, b);
});

test('build: constant series -> ciWidth == 0, contains zero', () => {
  const queue = mkSeries('K', [5, 5, 5, 5, 5, 5]);
  const r = buildSourceRowTokenAbcBootstrapSlopeCi(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.slope, 0);
  assert.equal(row.ciWidth, 0);
  assert.equal(row.ciContainsZero, true);
});

test('build: respects --min-rows', () => {
  const queue = mkSeries('A', [1, 2, 3]);
  const r = buildSourceRowTokenAbcBootstrapSlopeCi(queue, {
    minRows: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('build: rejects bad confidence', () => {
  assert.throws(
    () =>
      buildSourceRowTokenAbcBootstrapSlopeCi([], {
        confidence: 1.5,
        generatedAt: GEN,
      }),
    /confidence/,
  );
});

test('build: rejects bad lambda', () => {
  assert.throws(
    () =>
      buildSourceRowTokenAbcBootstrapSlopeCi([], {
        lambda: 0,
        generatedAt: GEN,
      }),
    /lambda/,
  );
});

test('build: rejects bad abcEps', () => {
  assert.throws(
    () =>
      buildSourceRowTokenAbcBootstrapSlopeCi([], {
        abcEps: 0.6,
        generatedAt: GEN,
      }),
    /abcEps/,
  );
});

test('build: rejects bad sort', () => {
  assert.throws(
    () =>
      buildSourceRowTokenAbcBootstrapSlopeCi([], {
        sort: 'bogus' as never,
        generatedAt: GEN,
      }),
    /sort/,
  );
});

test('build: alert-zero-in-ci filters as expected', () => {
  // Linear monotone series: CI should NOT contain zero.
  const queue = mkSeries('A', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = buildSourceRowTokenAbcBootstrapSlopeCi(queue, {
    alertZeroInCi: true,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedNotZeroInCi, 1);
});

test('build: drops invalid hour_start', () => {
  const q: QueueLine[] = [ql('not-a-date', 'A', 5)];
  const r = buildSourceRowTokenAbcBootstrapSlopeCi(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: drops negative total_tokens', () => {
  const q = mkSeries('A', [1, 2, 3, 4, 5]);
  q[2]!.total_tokens = -1;
  const r = buildSourceRowTokenAbcBootstrapSlopeCi(q, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('build: per-source isolation (two sources)', () => {
  const q = [
    ...mkSeries('A', [1, 2, 3, 4, 5, 6, 7, 8]),
    ...mkSeries('B', [10, 20, 30, 40, 50, 60, 70, 80]),
  ];
  const r = buildSourceRowTokenAbcBootstrapSlopeCi(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  const A = r.sources.find((s) => s.source === 'A')!;
  const B = r.sources.find((s) => s.source === 'B')!;
  assert.ok(Math.abs(A.slope - 1) < 1e-6);
  assert.ok(Math.abs(B.slope - 10) < 1e-5, `B.slope=${B.slope}`);
});

test('build: sort=slope-asc returns ascending', () => {
  const q = [
    ...mkSeries('A', [1, 2, 3, 4, 5, 6, 7, 8]),
    ...mkSeries('B', [10, 20, 30, 40, 50, 60, 70, 80]),
  ];
  const r = buildSourceRowTokenAbcBootstrapSlopeCi(q, {
    sort: 'slope-asc',
    generatedAt: GEN,
  });
  assert.ok(r.sources[0]!.slope <= r.sources[1]!.slope);
});

test('build: top cap surfaces droppedBelowTopCap', () => {
  const q = [
    ...mkSeries('A', [1, 2, 3, 4, 5, 6, 7, 8]),
    ...mkSeries('B', [10, 20, 30, 40, 50, 60, 70, 80]),
    ...mkSeries('C', [5, 4, 3, 2, 1, 0, 1, 2]),
  ];
  const r = buildSourceRowTokenAbcBootstrapSlopeCi(q, {
    top: 1,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowTopCap, 2);
});

test('build: ciLower <= ciUpper invariant on a stress series', () => {
  // Scattered noisy series.
  const ys = [3, 11, 2, 17, 5, 8, 14, 1, 9, 12, 4, 19, 6, 13];
  const q = mkSeries('S', ys);
  const r = buildSourceRowTokenAbcBootstrapSlopeCi(q, { generatedAt: GEN });
  for (const row of r.sources) {
    assert.ok(row.ciLower <= row.ciUpper, `bad order: ${JSON.stringify(row)}`);
    assert.ok(row.ciWidth >= 0);
  }
});

test('build: dotDispersion >= 1 for non-degenerate influence', () => {
  const q = mkSeries('A', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = buildSourceRowTokenAbcBootstrapSlopeCi(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  // max/mean is by definition >= 1 for non-empty positive vector.
  assert.ok(row.dotDispersion >= 1 - 1e-12);
});
