/**
 * Unit + property tests for source-row-token-profile-likelihood-slope-ci.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenProfileLikelihoodSlopeCi,
  bracketAndBisect,
  demingProfileRss,
  wilksStatistic,
} from '../src/sourcerowtokenprofilelikelihoodslopeci.js';
import { demingSlopeFromSums } from '../src/sourcerowtokendemingslope.js';
import { inverseStandardNormalCdf } from '../src/sourcerowtokenjackknifeslopeci.js';
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
// demingProfileRss
// =========================================================================

test('demingProfileRss: minimum is at the closed-form Deming MLE slope', () => {
  // Synthetic centered sums.
  const sxx = 10;
  const syy = 40;
  const sxy = 18;
  const lambda = 1;
  const thetaHat = demingSlopeFromSums(sxx, syy, sxy, lambda);
  const rssMle = demingProfileRss(sxx, syy, sxy, lambda, thetaHat);
  // Probe ten neighborhood beta values; all must be >= the MLE RSS.
  for (let k = -10; k <= 10; k += 1) {
    if (k === 0) continue;
    const beta = thetaHat + 0.05 * k;
    const rss = demingProfileRss(sxx, syy, sxy, lambda, beta);
    assert.ok(
      rss >= rssMle - 1e-9,
      `rss(${beta})=${rss} < rss(theta)=${rssMle}`,
    );
  }
});

test('demingProfileRss: closed-form sanity at beta = 0', () => {
  // R(0) = s_yy / 1 = s_yy.
  assert.equal(demingProfileRss(10, 40, 5, 1, 0), 40);
});

test('demingProfileRss: degenerate sxx=sxy=0 gives R(beta) = syy/(1+lambda*beta^2) (decreasing in |beta|)', () => {
  // Flat-x degenerate: any non-zero slope reduces R via the
  // 1/(1+lambda*beta^2) denominator without adding numerator.
  const r0 = demingProfileRss(0, 25, 0, 1, 0);
  const r1 = demingProfileRss(0, 25, 0, 1, 0.1);
  assert.equal(r0, 25);
  assert.ok(r1 < r0);
});

// =========================================================================
// wilksStatistic
// =========================================================================

test('wilksStatistic: zero at the MLE', () => {
  assert.equal(wilksStatistic(10, 5, 5), 0);
});

test('wilksStatistic: positive away from MLE', () => {
  // R(beta) = 2 * R(MLE) -> W = 2*n*log(2).
  const W = wilksStatistic(10, 10, 5);
  assert.ok(Math.abs(W - 20 * Math.log(2)) < 1e-9);
});

test('wilksStatistic: rssAtMle = 0 + rssAtBeta > 0 -> +Infinity', () => {
  assert.equal(wilksStatistic(10, 1, 0), Number.POSITIVE_INFINITY);
});

test('wilksStatistic: both 0 -> NaN (degenerate)', () => {
  assert.ok(Number.isNaN(wilksStatistic(10, 0, 0)));
});

// =========================================================================
// bracketAndBisect
// =========================================================================

test('bracketAndBisect: finds a known crossing for a quadratic-RSS case', () => {
  // Use a perfect linear series. y_i = 3*i, n=8, so sxy/sxx = 3 and
  // the MLE slope at lambda=1 is 3. The chi-square threshold at
  // c=0.95 is z_{0.975}^2 ~ 3.841459.
  const n = 8;
  let sxx = 0,
    syy = 0,
    sxy = 0;
  const xbar = (n - 1) / 2;
  const ybar = 3 * xbar;
  for (let i = 0; i < n; i += 1) {
    const dx = i - xbar;
    const dy = 3 * i - ybar;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  // R(thetaHat) is 0 here (perfect fit). The CI should collapse,
  // which the builder handles upstream — this test instead uses a
  // noisy series where R(theta) > 0.
  const data = [0, 4, 5, 9, 11, 16, 17, 22];
  let sxx2 = 0,
    syy2 = 0,
    sxy2 = 0;
  let xs = 0,
    ys = 0;
  for (let i = 0; i < data.length; i += 1) {
    xs += i;
    ys += data[i]!;
  }
  const xb = xs / data.length;
  const yb = ys / data.length;
  for (let i = 0; i < data.length; i += 1) {
    const dx = i - xb;
    const dy = data[i]! - yb;
    sxx2 += dx * dx;
    syy2 += dy * dy;
    sxy2 += dx * dy;
  }
  const lambda = 1;
  const thetaHat = demingSlopeFromSums(sxx2, syy2, sxy2, lambda);
  const rssMle = demingProfileRss(sxx2, syy2, sxy2, lambda, thetaHat);
  const z = inverseStandardNormalCdf(0.975);
  const threshold = z * z;
  const upper = bracketAndBisect(
    data.length,
    sxx2,
    syy2,
    sxy2,
    lambda,
    thetaHat,
    rssMle,
    threshold,
    1,
    +1,
    64,
    60,
  );
  const lower = bracketAndBisect(
    data.length,
    sxx2,
    syy2,
    sxy2,
    lambda,
    thetaHat,
    rssMle,
    threshold,
    1,
    -1,
    64,
    60,
  );
  // Both endpoints should be on the correct sides of thetaHat.
  assert.ok(upper.endpoint > thetaHat);
  assert.ok(lower.endpoint < thetaHat);
  // And W at the endpoint should be very close to threshold.
  const wU = wilksStatistic(
    data.length,
    demingProfileRss(sxx2, syy2, sxy2, lambda, upper.endpoint),
    rssMle,
  );
  const wL = wilksStatistic(
    data.length,
    demingProfileRss(sxx2, syy2, sxy2, lambda, lower.endpoint),
    rssMle,
  );
  assert.ok(Math.abs(wU - threshold) < 1e-3, `wU=${wU} vs ${threshold}`);
  assert.ok(Math.abs(wL - threshold) < 1e-3, `wL=${wL} vs ${threshold}`);
  assert.equal(upper.saturated, false);
  assert.equal(lower.saturated, false);
});

// =========================================================================
// buildSourceRowTokenProfileLikelihoodSlopeCi
// =========================================================================

test('builder: rejects min-rows below 4', () => {
  assert.throws(
    () =>
      buildSourceRowTokenProfileLikelihoodSlopeCi([], {
        minRows: 3,
        generatedAt: GEN,
      }),
    /minRows must be an integer >= 4/,
  );
});

test('builder: rejects confidence outside (0,1)', () => {
  assert.throws(
    () =>
      buildSourceRowTokenProfileLikelihoodSlopeCi([], {
        confidence: 0,
        generatedAt: GEN,
      }),
    /confidence must be a finite number in/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenProfileLikelihoodSlopeCi([], {
        confidence: 1,
        generatedAt: GEN,
      }),
    /confidence must be a finite number in/,
  );
});

test('builder: rejects lambda <= 0', () => {
  assert.throws(
    () =>
      buildSourceRowTokenProfileLikelihoodSlopeCi([], {
        lambda: 0,
        generatedAt: GEN,
      }),
    /lambda must be a finite, strictly positive number/,
  );
});

test('builder: rejects bisection-iterations < 1', () => {
  assert.throws(
    () =>
      buildSourceRowTokenProfileLikelihoodSlopeCi([], {
        bisectionIterations: 0,
        generatedAt: GEN,
      }),
    /bisectionIterations must be a positive integer/,
  );
});

test('builder: rejects max-bracket-doublings < 1', () => {
  assert.throws(
    () =>
      buildSourceRowTokenProfileLikelihoodSlopeCi([], {
        maxBracketDoublings: 0,
        generatedAt: GEN,
      }),
    /maxBracketDoublings must be a positive integer/,
  );
});

test('builder: rejects bad sort', () => {
  assert.throws(
    () =>
      buildSourceRowTokenProfileLikelihoodSlopeCi([], {
        sort: 'bogus' as never,
        generatedAt: GEN,
      }),
    /sort must be one of/,
  );
});

test('builder: drops sources below min-rows', () => {
  const queue = mkSeries('s1', [1, 2, 3]); // n=3 < default min-rows=4
  const r = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('builder: produces a CI that brackets the point Deming slope on a noisy series', () => {
  // Noisy upward-trending series.
  const queue = mkSeries('s1', [10, 14, 12, 18, 21, 19, 25, 28, 30, 33]);
  const r = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    confidence: 0.95,
    lambda: 1,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  // CI must bracket thetaHat (point slope).
  assert.ok(
    s.ciLower <= s.slope + 1e-6 && s.slope <= s.ciUpper + 1e-6,
    `slope ${s.slope} not in [${s.ciLower}, ${s.ciUpper}]`,
  );
  // Width is positive on a non-degenerate series.
  assert.ok(s.ciWidth > 0);
  // chi2Threshold = z_{0.975}^2 ~ 3.841459.
  assert.ok(Math.abs(s.chi2Threshold - 3.841459) < 1e-3);
  // wilksAtZero should be large for a clearly increasing series, so
  // rejectZero should be true.
  assert.ok(s.wilksAtZero > s.chi2Threshold);
  assert.equal(s.rejectZero, true);
  assert.equal(s.ciContainsZero, false);
  assert.equal(s.bracketSaturated, false);
});

test('builder: flat series collapses CI to [0, 0]', () => {
  const queue = mkSeries('flat', [7, 7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.slope, 0);
  assert.equal(s.ciLower, 0);
  assert.equal(s.ciUpper, 0);
  assert.equal(s.ciWidth, 0);
  assert.equal(s.ciContainsZero, true);
  // For a perfectly flat series rssAtMle = 0, wilksAtZero is NaN
  // (both 0/0), so rejectZero is false.
  assert.equal(s.rejectZero, false);
});

test('builder: alert-zero-in-ci filters to sources with CI that straddles zero', () => {
  // s1: clearly trending up (CI should exclude zero).
  // s2: noisy flat (CI should include zero).
  const queue = [
    ...mkSeries('s1', [10, 20, 30, 40, 50, 60, 70, 80]),
    ...mkSeries('s2', [10, 11, 9, 12, 8, 11, 10, 9]),
  ];
  const r = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    alertZeroInCi: true,
    generatedAt: GEN,
  });
  // Only s2 should survive the alert filter.
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's2');
  assert.equal(r.droppedNotZeroInCi, 1);
});

test('builder: alert-reject-zero filters to sources where LR test rejects slope=0', () => {
  const queue = [
    ...mkSeries('s1', [10, 20, 30, 40, 50, 60, 70, 80]),
    ...mkSeries('s2', [10, 11, 9, 12, 8, 11, 10, 9]),
  ];
  const r = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    alertRejectZero: true,
    generatedAt: GEN,
  });
  // Only s1 should survive.
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedNotRejectZero, 1);
});

test('builder: ciAsymmetry signs correctly', () => {
  const queue = mkSeries('s1', [10, 14, 12, 18, 21, 19, 25, 28, 30, 33]);
  const r = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  const expected = s.ciUpper - s.slope - (s.slope - s.ciLower);
  assert.ok(Math.abs(s.ciAsymmetry - expected) < 1e-9);
});

test('builder: invariance under y-translation (slope unchanged, CI shape preserved)', () => {
  const base = [10, 14, 12, 18, 21, 19, 25, 28];
  const r1 = buildSourceRowTokenProfileLikelihoodSlopeCi(
    mkSeries('s1', base),
    { generatedAt: GEN },
  );
  const r2 = buildSourceRowTokenProfileLikelihoodSlopeCi(
    mkSeries('s1', base.map((v) => v + 1000)),
    { generatedAt: GEN },
  );
  // Slope, CI width, asymmetry are all translation-invariant.
  const a = r1.sources[0]!;
  const b = r2.sources[0]!;
  assert.ok(Math.abs(a.slope - b.slope) < 1e-9);
  assert.ok(Math.abs(a.ciWidth - b.ciWidth) < 1e-6);
  assert.ok(Math.abs(a.ciAsymmetry - b.ciAsymmetry) < 1e-6);
});

test('builder: tighter CI at lower confidence', () => {
  const queue = mkSeries('s1', [10, 14, 12, 18, 21, 19, 25, 28, 30, 33]);
  const r95 = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    confidence: 0.95,
    generatedAt: GEN,
  });
  const r80 = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    confidence: 0.8,
    generatedAt: GEN,
  });
  assert.ok(
    r80.sources[0]!.ciWidth < r95.sources[0]!.ciWidth,
    `80% CI width ${r80.sources[0]!.ciWidth} should be < 95% ${r95.sources[0]!.ciWidth}`,
  );
});

test('builder: source-asc sort breaks ties deterministically', () => {
  const queue = [
    ...mkSeries('z', [1, 2, 3, 4, 5]),
    ...mkSeries('a', [5, 4, 3, 2, 1]),
  ];
  const r = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'z');
});

test('builder: deterministic across repeated invocations on same input', () => {
  const queue = mkSeries('s1', [1, 5, 3, 9, 11, 8, 14, 16, 20, 18]);
  const r1 = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    generatedAt: GEN,
  });
  assert.deepEqual(r1.sources[0], r2.sources[0]);
});

test('builder: top cap applies after sort and reports droppedBelowTopCap', () => {
  const queue = [
    ...mkSeries('s1', [1, 2, 3, 4, 5, 6]),
    ...mkSeries('s2', [10, 20, 30, 40, 50, 60]),
    ...mkSeries('s3', [100, 200, 300, 400, 500, 600]),
  ];
  const r = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    sort: 'magnitude-desc',
    top: 1,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's3');
  assert.equal(r.droppedBelowTopCap, 2);
});

test('builder: drops bad rows into the dropped buckets', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 's1', 5),
    ql('2026-04-27T00:00:00.000Z', 's1', Number.NaN),
    ql('2026-04-27T00:01:00.000Z', 's1', -1),
    ...mkSeries('s1', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenProfileLikelihoodSlopeCi(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 5);
});

test('builder: source filter only emits the chosen source', () => {
  const queue = [
    ...mkSeries('s1', [1, 2, 3, 4, 5]),
    ...mkSeries('s2', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    source: 's2',
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's2');
  assert.equal(r.droppedSourceFilter, 5);
});

// =========================================================================
// v0.6.226 refinement: bracketDoublingsTotal + alertBracketSaturated +
// 'bracket-doublings-total-desc' sort key.
// =========================================================================

test('refinement: bracketDoublingsTotal = lower + upper', () => {
  const queue = mkSeries('s1', [10, 14, 12, 18, 21, 19, 25, 28, 30, 33]);
  const r = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(
    s.bracketDoublingsTotal,
    s.bracketDoublingsLower + s.bracketDoublingsUpper,
  );
});

test('refinement: alert-bracket-saturated filters to saturated rows; clean series drops to empty', () => {
  // A clean noisy series should NOT saturate at default 64 doublings.
  const queue = mkSeries('s1', [10, 14, 12, 18, 21, 19, 25, 28, 30, 33]);
  const r = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    alertBracketSaturated: true,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedNotBracketSaturated, 1);
});

test('refinement: alert-bracket-saturated drop counter is wired (returns empty when no source saturates)', () => {
  // With default max-bracket-doublings = 64 and a clean series the
  // search converges in 1-2 rounds and never saturates. The alert
  // filter should drop the source and the counter should reflect
  // it. (Forcing saturation is hard without contriving a series
  // whose Fisher-information seed step is microscopic; this test
  // just verifies the alert wiring rather than the saturation
  // pathology.)
  const queue = mkSeries('s1', [10, 14, 12, 18, 21, 19, 25, 28, 30, 33]);
  const r = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    alertBracketSaturated: true,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedNotBracketSaturated, 1);
  assert.equal(r.bracketSaturatedCount, 0);
});

test('refinement: bracket-doublings-total-desc sort key works', () => {
  const queue = [
    ...mkSeries('s1', [1, 2, 3, 4, 5, 6, 7, 8]),
    ...mkSeries('s2', [10, 100, 50, 200, 150, 300, 250, 400]),
  ];
  const r = buildSourceRowTokenProfileLikelihoodSlopeCi(queue, {
    sort: 'bracket-doublings-total-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  // Whichever has more doublings comes first.
  assert.ok(
    r.sources[0]!.bracketDoublingsTotal >= r.sources[1]!.bracketDoublingsTotal,
  );
});
