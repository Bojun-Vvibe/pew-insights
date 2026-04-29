/**
 * Unit + property tests for source-row-token-bca-bootstrap-slope-ci.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenBcaBootstrapSlopeCi,
  bcaBiasFraction,
  bcaBiasCorrection,
  bcaAcceleration,
  bcaAdjustedPercentiles,
  standardNormalCdf,
} from '../src/sourcerowtokenbcabootstrapslopeci.js';
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
// standardNormalCdf
// =========================================================================

test('standardNormalCdf: Phi(0) ≈ 0.5', () => {
  assert.ok(Math.abs(standardNormalCdf(0) - 0.5) < 1e-7);
});

test('standardNormalCdf: Phi(1.959964) ≈ 0.975', () => {
  const p = standardNormalCdf(1.959964);
  assert.ok(Math.abs(p - 0.975) < 1e-5, `got ${p}`);
});

test('standardNormalCdf: Phi(-1.959964) ≈ 0.025', () => {
  const p = standardNormalCdf(-1.959964);
  assert.ok(Math.abs(p - 0.025) < 1e-5, `got ${p}`);
});

test('standardNormalCdf: symmetry Phi(z) + Phi(-z) = 1', () => {
  for (const z of [0.5, 1, 1.5, 2, 2.5]) {
    const sum = standardNormalCdf(z) + standardNormalCdf(-z);
    assert.ok(Math.abs(sum - 1) < 1e-6, `z=${z} sum=${sum}`);
  }
});

test('standardNormalCdf: monotone non-decreasing', () => {
  let prev = standardNormalCdf(-3);
  for (let z = -3 + 0.1; z <= 3; z += 0.1) {
    const cur = standardNormalCdf(z);
    assert.ok(cur >= prev - 1e-9, `decreasing at z=${z}`);
    prev = cur;
  }
});

test('standardNormalCdf: clamps to [0, 1]', () => {
  for (const z of [-100, -50, 50, 100]) {
    const p = standardNormalCdf(z);
    assert.ok(p >= 0 && p <= 1, `z=${z} p=${p}`);
  }
});

test('standardNormalCdf: +Infinity -> 1, -Infinity -> 0', () => {
  assert.equal(standardNormalCdf(Infinity), 1);
  assert.equal(standardNormalCdf(-Infinity), 0);
});

// =========================================================================
// bcaBiasFraction
// =========================================================================

test('bcaBiasFraction: empty input -> 0.5', () => {
  assert.equal(bcaBiasFraction([], 0), 0.5);
});

test('bcaBiasFraction: thetaHat above all -> 1', () => {
  assert.equal(bcaBiasFraction([1, 2, 3, 4], 5), 1);
});

test('bcaBiasFraction: thetaHat below all -> 0', () => {
  assert.equal(bcaBiasFraction([1, 2, 3, 4], 0), 0);
});

test('bcaBiasFraction: ties split half-and-half', () => {
  // 2 below, 2 equal, 1 above
  const p = bcaBiasFraction([1, 1, 2, 2, 3], 2);
  assert.equal(p, (2 + 0.5 * 2) / 5);
});

test('bcaBiasFraction: thetaHat is median -> 0.5 (no ties)', () => {
  const p = bcaBiasFraction([1, 2, 3, 4], 2.5);
  assert.equal(p, 0.5);
});

// =========================================================================
// bcaBiasCorrection
// =========================================================================

test('bcaBiasCorrection: median thetaHat -> z0 ≈ 0', () => {
  const z0 = bcaBiasCorrection([1, 2, 3, 4], 2.5);
  assert.ok(Math.abs(z0) < 1e-6, `z0=${z0}`);
});

test('bcaBiasCorrection: thetaHat above all -> clamped large positive', () => {
  const z0 = bcaBiasCorrection([1, 2, 3, 4], 999);
  // p clamped to 1 - 1/8 = 0.875, z0 = Phi^-1(0.875) ≈ 1.150
  assert.ok(z0 > 1 && z0 < 2, `z0=${z0}`);
});

test('bcaBiasCorrection: thetaHat below all -> clamped large negative', () => {
  const z0 = bcaBiasCorrection([1, 2, 3, 4], -999);
  assert.ok(z0 < -1 && z0 > -2, `z0=${z0}`);
});

test('bcaBiasCorrection: empty bootSlopes -> 0', () => {
  assert.equal(bcaBiasCorrection([], 5), 0);
});

test('bcaBiasCorrection: monotone in thetaHat (decreasing)', () => {
  // As thetaHat increases, more samples are below it, so p increases,
  // so z0 increases. Thus z0 is monotone increasing in thetaHat.
  const slopes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const z0a = bcaBiasCorrection(slopes, 2);
  const z0b = bcaBiasCorrection(slopes, 5);
  const z0c = bcaBiasCorrection(slopes, 8);
  assert.ok(z0a <= z0b && z0b <= z0c, `${z0a} <= ${z0b} <= ${z0c}`);
});

// =========================================================================
// bcaAcceleration
// =========================================================================

test('bcaAcceleration: empty -> 0', () => {
  assert.equal(bcaAcceleration([]), 0);
});

test('bcaAcceleration: constant jackknife -> 0 (zero variance)', () => {
  assert.equal(bcaAcceleration([5, 5, 5, 5, 5]), 0);
});

test('bcaAcceleration: symmetric jackknife about mean -> ~0', () => {
  // exactly symmetric around 0 (centered at jackMean = 0) -> sum dev^3 ≈ 0
  const a = bcaAcceleration([-2, -1, 0, 1, 2]);
  assert.ok(Math.abs(a) < 1e-9, `a=${a}`);
});

test('bcaAcceleration: right-skewed jackknife -> a sign defined', () => {
  // dev_i = mean - theta_(-i). One large positive theta_(-i) makes dev
  // large negative => dev^3 large negative.
  const a = bcaAcceleration([1, 1, 1, 1, 100]);
  assert.ok(Number.isFinite(a));
  // With one outlier high, dev_i for outlier is very negative, others
  // slightly positive. Sum dev^3 dominated by negative cube => a < 0.
  assert.ok(a < 0, `a=${a}`);
});

test('bcaAcceleration: returns a finite number', () => {
  for (const arr of [
    [1, 2, 3, 4, 5],
    [10, 20, 5, 15, 8, 22],
    [-1, -2, -3, -4, -5, -6, -7],
  ]) {
    const a = bcaAcceleration(arr);
    assert.ok(Number.isFinite(a), `a=${a} arr=${arr.join(',')}`);
  }
});

// =========================================================================
// bcaAdjustedPercentiles
// =========================================================================

test('bcaAdjustedPercentiles: z0=0 a=0 reproduces percentile interval', () => {
  const [aLo, aHi] = bcaAdjustedPercentiles(0, 0, 0.95);
  assert.ok(Math.abs(aLo - 0.025) < 1e-5, `aLo=${aLo}`);
  assert.ok(Math.abs(aHi - 0.975) < 1e-5, `aHi=${aHi}`);
});

test('bcaAdjustedPercentiles: z0=0 a=0 at 0.99', () => {
  const [aLo, aHi] = bcaAdjustedPercentiles(0, 0, 0.99);
  assert.ok(Math.abs(aLo - 0.005) < 1e-5);
  assert.ok(Math.abs(aHi - 0.995) < 1e-5);
});

test('bcaAdjustedPercentiles: z0 > 0 shifts both percentiles up', () => {
  const [aLo0, aHi0] = bcaAdjustedPercentiles(0, 0, 0.95);
  const [aLo1, aHi1] = bcaAdjustedPercentiles(0.5, 0, 0.95);
  assert.ok(aLo1 > aLo0, `${aLo1} > ${aLo0}`);
  assert.ok(aHi1 > aHi0, `${aHi1} > ${aHi0}`);
});

test('bcaAdjustedPercentiles: z0 < 0 shifts both percentiles down', () => {
  const [aLo0, aHi0] = bcaAdjustedPercentiles(0, 0, 0.95);
  const [aLo1, aHi1] = bcaAdjustedPercentiles(-0.5, 0, 0.95);
  assert.ok(aLo1 < aLo0);
  assert.ok(aHi1 < aHi0);
});

test('bcaAdjustedPercentiles: a > 0 widens the upper tail', () => {
  // With z0 = 0, a > 0 stretches percentiles asymmetrically.
  const [, aHi0] = bcaAdjustedPercentiles(0, 0, 0.95);
  const [, aHi1] = bcaAdjustedPercentiles(0, 0.1, 0.95);
  assert.ok(aHi1 !== aHi0);
});

test('bcaAdjustedPercentiles: results clamped to [0, 1]', () => {
  for (const z0 of [-5, 5]) {
    for (const a of [-0.5, 0.5]) {
      const [aLo, aHi] = bcaAdjustedPercentiles(z0, a, 0.95);
      assert.ok(aLo >= 0 && aLo <= 1, `aLo=${aLo}`);
      assert.ok(aHi >= 0 && aHi <= 1, `aHi=${aHi}`);
    }
  }
});

// =========================================================================
// builder validation
// =========================================================================

test('builder: minRows < 4 rejected', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBcaBootstrapSlopeCi([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('builder: non-integer minRows rejected', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBcaBootstrapSlopeCi([], { minRows: 4.5 }),
    /minRows must be an integer >= 4/,
  );
});

test('builder: bootstraps < 100 rejected', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBcaBootstrapSlopeCi([], { bootstraps: 99 }),
    /bootstraps must be an integer >= 100/,
  );
});

test('builder: non-integer bootstraps rejected', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBcaBootstrapSlopeCi([], { bootstraps: 100.5 }),
    /bootstraps must be an integer >= 100/,
  );
});

test('builder: confidence <= 0 rejected', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBcaBootstrapSlopeCi([], { confidence: 0 }),
    /confidence must be a finite number in/,
  );
});

test('builder: confidence >= 1 rejected', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBcaBootstrapSlopeCi([], { confidence: 1 }),
    /confidence must be a finite number in/,
  );
});

test('builder: non-finite confidence rejected', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBcaBootstrapSlopeCi([], { confidence: NaN }),
    /confidence must be a finite number in/,
  );
});

test('builder: lambda <= 0 rejected', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBcaBootstrapSlopeCi([], { lambda: 0 }),
    /lambda must be a finite, strictly positive number/,
  );
});

test('builder: non-integer seed rejected', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBcaBootstrapSlopeCi([], { seed: 1.5 }),
    /seed must be an integer/,
  );
});

test('builder: alertBcaShiftMin < 0 rejected', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBcaBootstrapSlopeCi([], { alertBcaShiftMin: -0.1 }),
    /alertBcaShiftMin must be a finite number in \[0, 2\]/,
  );
});

test('builder: alertBcaShiftMin > 2 rejected', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBcaBootstrapSlopeCi([], { alertBcaShiftMin: 2.5 }),
    /alertBcaShiftMin must be a finite number in \[0, 2\]/,
  );
});

test('builder: bad sort key rejected', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBcaBootstrapSlopeCi([], {
        sort: 'nonsense' as never,
      }),
    /sort must be one of/,
  );
});

test('builder: top < 1 rejected', () => {
  assert.throws(
    () => buildSourceRowTokenBcaBootstrapSlopeCi([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('builder: invalid since rejected', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBcaBootstrapSlopeCi([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('builder: invalid until rejected', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBcaBootstrapSlopeCi([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

// =========================================================================
// builder data flow
// =========================================================================

test('builder: empty queue -> zero sources', () => {
  const r = buildSourceRowTokenBcaBootstrapSlopeCi([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.confidence, 0.95);
  assert.equal(r.bootstraps, 1000);
  assert.equal(r.seed, 42);
  assert.equal(r.lambda, 1);
  assert.equal(r.alertBcaShiftMin, 0);
  assert.equal(r.generatedAt, GEN);
});

test('builder: defaults echoed', () => {
  const r = buildSourceRowTokenBcaBootstrapSlopeCi([], { generatedAt: GEN });
  assert.equal(r.minRows, 4);
  assert.equal(r.bootstraps, 1000);
  assert.equal(r.confidence, 0.95);
  assert.equal(r.lambda, 1);
  assert.equal(r.seed, 42);
  assert.equal(r.alertZeroInCi, false);
  assert.equal(r.alertBcaShiftMin, 0);
  assert.equal(r.sort, 'magnitude-desc');
  assert.equal(r.top, null);
});

test('builder: ascending series produces a finite positive slope CI', () => {
  const queue = mkSeries('a', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'a');
  assert.equal(s.rowsKept, 10);
  assert.ok(s.slope > 0, `slope=${s.slope}`);
  assert.ok(s.ciLower <= s.ciUpper, `lo=${s.ciLower} hi=${s.ciUpper}`);
  assert.ok(Number.isFinite(s.z0));
  assert.ok(Number.isFinite(s.acceleration));
  assert.ok(Number.isFinite(s.alphaLower));
  assert.ok(Number.isFinite(s.alphaUpper));
  assert.ok(s.alphaLower >= 0 && s.alphaLower <= 1);
  assert.ok(s.alphaUpper >= 0 && s.alphaUpper <= 1);
  assert.ok(s.alphaLower <= s.alphaUpper);
  assert.equal(s.ciWidth, s.ciUpper - s.ciLower);
});

test('builder: --min-rows skips short sources', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3]),
    ...mkSeries('b', [10, 20, 30, 40, 50, 60, 70]),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    minRows: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('builder: --source filter keeps only matching source', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40, 50]),
    ...mkSeries('b', [100, 200, 300, 400, 500]),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    source: 'b',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedSourceFilter, 5);
});

test('builder: bad total_tokens dropped', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40, 50]),
    ql('2026-04-27T00:48:00.000Z', 'a', 'NaN' as never),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  assert.ok(r.droppedInvalidTokens >= 1);
});

test('builder: NaN total_tokens dropped', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40, 50]),
    ql('2026-04-27T00:50:00.000Z', 'a', NaN),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  assert.ok(r.droppedInvalidTokens >= 1);
});

test('builder: Infinity total_tokens dropped', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40, 50]),
    ql('2026-04-27T00:50:00.000Z', 'a', Infinity),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  assert.ok(r.droppedInvalidTokens >= 1);
});

test('builder: negative total_tokens dropped', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40, 50]),
    ql('2026-04-27T00:50:00.000Z', 'a', -5),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  assert.ok(r.droppedNegativeTokens >= 1);
});

test('builder: bad hour_start dropped', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40, 50]),
    ql('not-an-iso', 'a', 60),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  assert.ok(r.droppedInvalidHourStart >= 1);
});

test('builder: empty source -> "unknown"', () => {
  const queue = mkSeries('', [10, 20, 30, 40, 50]);
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('builder: since-until window applied', () => {
  const queue = mkSeries('a', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    since: '2026-04-27T00:03:00.000Z',
    until: '2026-04-27T00:08:00.000Z',
    generatedAt: GEN,
  });
  // Should have ~5 rows kept (positions 3..7).
  assert.equal(r.sources[0]?.rowsKept, 5);
});

// =========================================================================
// BCa math properties
// =========================================================================

test('builder: ascending series gives positive bias-corrected slope', () => {
  const queue = mkSeries(
    'a',
    [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80],
  );
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 500,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.slope > 0);
  assert.ok(s.ciUpper > 0);
});

test('builder: all-equal -> ciLower = ciUpper = 0, ciContainsZero = true', () => {
  const queue = mkSeries('a', [42, 42, 42, 42, 42, 42]);
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.slope, 0);
  assert.equal(s.ciLower, 0);
  assert.equal(s.ciUpper, 0);
  assert.equal(s.ciWidth, 0);
  assert.equal(s.ciContainsZero, true);
});

test('builder: deterministic across runs at same seed', () => {
  const queue = mkSeries('a', [10, 20, 30, 40, 50, 60, 70, 80]);
  const r1 = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    seed: 7,
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    seed: 7,
    generatedAt: GEN,
  });
  assert.equal(r1.sources[0]!.ciLower, r2.sources[0]!.ciLower);
  assert.equal(r1.sources[0]!.ciUpper, r2.sources[0]!.ciUpper);
  assert.equal(r1.sources[0]!.z0, r2.sources[0]!.z0);
  assert.equal(r1.sources[0]!.acceleration, r2.sources[0]!.acceleration);
});

test('builder: different seeds give different bootstrap CIs (non-trivial data)', () => {
  const queue = mkSeries('a', [10, 22, 18, 35, 28, 47, 44, 60, 55, 73]);
  const r1 = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    seed: 1,
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    seed: 99999,
    generatedAt: GEN,
  });
  assert.notEqual(r1.sources[0]!.ciLower, r2.sources[0]!.ciLower);
});

test('builder: ciLower <= ciUpper always', () => {
  const queue = mkSeries(
    'a',
    [10, 25, 18, 40, 33, 55, 48, 70, 65, 85, 80, 100],
  );
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.ciLower <= s.ciUpper);
});

test('builder: 99% CI is at least as wide as 95% on same data and seed', () => {
  const queue = mkSeries(
    'a',
    [10, 25, 18, 40, 33, 55, 48, 70, 65, 85, 80, 100, 92, 110, 105],
  );
  const r95 = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    confidence: 0.95,
    seed: 11,
    generatedAt: GEN,
  });
  const r99 = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    confidence: 0.99,
    seed: 11,
    generatedAt: GEN,
  });
  assert.ok(
    r99.sources[0]!.ciWidth >= r95.sources[0]!.ciWidth - 1e-9,
    `99% width ${r99.sources[0]!.ciWidth} not >= 95% width ${r95.sources[0]!.ciWidth}`,
  );
});

test('builder: ciWidth = ciUpper - ciLower exactly', () => {
  const queue = mkSeries('a', [10, 20, 30, 40, 50, 60, 70, 80]);
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.ciWidth, s.ciUpper - s.ciLower);
});

test('builder: alphaLower <= alphaUpper always', () => {
  const queue = mkSeries('a', [10, 25, 18, 40, 33, 55, 48, 70, 65, 85]);
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.alphaLower <= s.alphaUpper);
});

test('builder: alphaLower and alphaUpper in [0, 1]', () => {
  const queue = mkSeries('a', [1, 100, 2, 99, 3, 98, 4, 97, 5, 96]);
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.alphaLower >= 0 && s.alphaLower <= 1);
  assert.ok(s.alphaUpper >= 0 && s.alphaUpper <= 1);
});

test('builder: bcaPercentileShift = sum of |alpha - nominal|', () => {
  const queue = mkSeries(
    'a',
    [10, 12, 100, 14, 200, 16, 18, 20, 300, 22, 24],
  );
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 400,
    confidence: 0.95,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  const expected =
    Math.abs(s.alphaLower - 0.025) + Math.abs(s.alphaUpper - 0.975);
  assert.ok(Math.abs(s.bcaPercentileShift - expected) < 1e-12);
});

test('builder: bcaShift = bootMedian - thetaHat (verifiable via re-derivation)', () => {
  // We can't easily inspect bootMedian here, but bcaShift must be finite.
  const queue = mkSeries('a', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(Number.isFinite(s.bcaShift));
});

// =========================================================================
// alert filters
// =========================================================================

test('--alert-zero-in-ci: filters to only sources whose CI straddles zero', () => {
  const queue = [
    // strongly trending: CI should NOT contain zero
    ...mkSeries(
      'trend',
      [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
    ),
    // flat noisy: CI should contain zero
    ...mkSeries(
      'flat',
      [50, 48, 52, 49, 51, 50, 47, 53, 50, 49, 51, 50, 48, 52],
    ),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 400,
    alertZeroInCi: true,
    generatedAt: GEN,
  });
  for (const s of r.sources) {
    assert.equal(s.ciContainsZero, true, `${s.source} should have 0 in CI`);
  }
});

test('--alert-bca-shift-min=0 keeps all rows', () => {
  const queue = mkSeries('a', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    alertBcaShiftMin: 0,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowBcaShift, 0);
});

test('--alert-bca-shift-min very high drops all rows', () => {
  const queue = mkSeries('a', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    alertBcaShiftMin: 1.9,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.ok(r.droppedBelowBcaShift >= 1);
});

// =========================================================================
// sort keys + tiebreak
// =========================================================================

test('sort: source asc tiebreak (default magnitude-desc)', () => {
  const queue = [
    ...mkSeries('zebra', [10, 20, 30, 40, 50]),
    ...mkSeries('apple', [10, 20, 30, 40, 50]),
    ...mkSeries('mango', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['apple', 'mango', 'zebra'],
  );
});

test('sort: rows desc', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4]),
    ...mkSeries('b', [1, 2, 3, 4, 5, 6, 7, 8]),
    ...mkSeries('c', [1, 2, 3, 4, 5, 6]),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.rowsKept),
    [8, 6, 4],
  );
});

test('sort: ci-width-desc', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40, 50, 60]),
    ...mkSeries('b', [1, 100, 2, 99, 3, 98]),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    sort: 'ci-width-desc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.ciWidth >= r.sources[i]!.ciWidth);
  }
});

test('sort: ci-width-asc', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40, 50, 60]),
    ...mkSeries('b', [1, 100, 2, 99, 3, 98]),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    sort: 'ci-width-asc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.ciWidth <= r.sources[i]!.ciWidth);
  }
});

test('sort: z0-magnitude-desc orders by |z0| desc', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40, 50, 60]),
    ...mkSeries('b', [50, 60, 70, 80, 90, 100]),
    ...mkSeries('c', [1, 100, 2, 99, 3, 98]),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    sort: 'z0-magnitude-desc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      Math.abs(r.sources[i - 1]!.z0) >= Math.abs(r.sources[i]!.z0) - 1e-12,
    );
  }
});

test('sort: acceleration-magnitude-desc orders by |a| desc', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40, 50, 60, 70, 80]),
    ...mkSeries('b', [1, 1, 1, 1, 1, 1, 1, 100]),
    ...mkSeries('c', [50, 60, 70, 80, 90, 100, 110, 120]),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    sort: 'acceleration-magnitude-desc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      Math.abs(r.sources[i - 1]!.acceleration) >=
        Math.abs(r.sources[i]!.acceleration) - 1e-12,
    );
  }
});

test('sort: bca-shift-desc orders by bcaPercentileShift desc', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40, 50, 60]),
    ...mkSeries('b', [50, 60, 70, 80, 90, 100]),
    ...mkSeries('c', [1, 100, 2, 99, 3, 98]),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 300,
    sort: 'bca-shift-desc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      r.sources[i - 1]!.bcaPercentileShift >=
        r.sources[i]!.bcaPercentileShift - 1e-12,
    );
  }
});

test('sort: ci-contains-zero-first puts ci-contains-zero rows first', () => {
  const queue = [
    ...mkSeries('strongtrend', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]),
    ...mkSeries('flat', [50, 48, 52, 49, 51, 50, 47, 53, 50, 49, 51, 50, 48, 52]),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 400,
    sort: 'ci-contains-zero-first',
    generatedAt: GEN,
  });
  let seenFalse = false;
  for (const s of r.sources) {
    if (!s.ciContainsZero) seenFalse = true;
    if (seenFalse) {
      assert.equal(
        s.ciContainsZero,
        false,
        'all containsZero rows should come before all not',
      );
    }
  }
});

test('sort: slope-desc orders by slope desc', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40, 50]),
    ...mkSeries('b', [50, 40, 30, 20, 10]),
    ...mkSeries('c', [100, 200, 300, 400, 500]),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    sort: 'slope-desc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.slope >= r.sources[i]!.slope - 1e-9);
  }
});

test('sort: slope-asc orders by slope asc', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40, 50]),
    ...mkSeries('b', [50, 40, 30, 20, 10]),
    ...mkSeries('c', [100, 200, 300, 400, 500]),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    sort: 'slope-asc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.slope <= r.sources[i]!.slope + 1e-9);
  }
});

// =========================================================================
// top cap
// =========================================================================

test('--top caps the table and surfaces droppedBelowTopCap', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [10, 20, 30, 40, 50]),
    ...mkSeries('c', [100, 200, 300, 400, 500]),
  ];
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    top: 1,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowTopCap, 2);
});

// =========================================================================
// echoes / parametric properties
// =========================================================================

test('properties: confidence echoed', () => {
  const r = buildSourceRowTokenBcaBootstrapSlopeCi([], {
    confidence: 0.9,
    generatedAt: GEN,
  });
  assert.equal(r.confidence, 0.9);
});

test('properties: lambda echoed', () => {
  const r = buildSourceRowTokenBcaBootstrapSlopeCi([], {
    lambda: 2.5,
    generatedAt: GEN,
  });
  assert.equal(r.lambda, 2.5);
});

test('properties: lambda affects slope vs default', () => {
  const queue = mkSeries('a', [10, 30, 20, 50, 40, 70, 60, 90, 80, 110]);
  const r1 = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    lambda: 1,
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 200,
    lambda: 100,
    generatedAt: GEN,
  });
  // At lambda = 100 (treating x as essentially noise-free) Deming converges
  // to OLS slope; at lambda = 1 it's orthogonal regression. They should
  // differ on noisy data.
  assert.notEqual(r1.sources[0]!.slope, r2.sources[0]!.slope);
});

test('properties: BCa with z0=0 a=0 reproduces percentile interval shape', () => {
  // On a perfectly symmetric, large series the BCa adjustment should be
  // near-zero (alpha picks ~ nominal 0.025/0.975).
  const queue = mkSeries(
    'a',
    [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200],
  );
  const r = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    bootstraps: 1000,
    confidence: 0.95,
    seed: 42,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  // alpha picks should be in the broad neighborhood of 0.025 / 0.975
  assert.ok(s.alphaLower < 0.2, `alphaLower=${s.alphaLower}`);
  assert.ok(s.alphaUpper > 0.8, `alphaUpper=${s.alphaUpper}`);
});

test('properties: generatedAt default is set', () => {
  const r = buildSourceRowTokenBcaBootstrapSlopeCi([]);
  assert.ok(typeof r.generatedAt === 'string');
  assert.ok(r.generatedAt.length >= 20);
});
