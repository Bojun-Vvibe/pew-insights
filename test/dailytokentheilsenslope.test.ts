import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenTheilSenSlope,
  buildDailyTokenTheilSenSlope,
} from '../src/dailytokentheilsenslope.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return { hour_start, source, total_tokens } as unknown as QueueLine;
}

function dayIso(i: number): string {
  return (
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z'
  );
}

// ---------- primitive ----------

test('dailyTokenTheilSenSlope: rejects fewer than 4 samples', () => {
  assert.throws(
    () => dailyTokenTheilSenSlope([5, 6, 7]),
    /at least 4 samples/,
  );
});

test('dailyTokenTheilSenSlope: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenTheilSenSlope([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenTheilSenSlope([1, Infinity, 3, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenTheilSenSlope([1, 2, 3, -Infinity]),
    /finite values/,
  );
});

test('dailyTokenTheilSenSlope: rejects confidenceLevel out of (0, 1)', () => {
  assert.throws(
    () => dailyTokenTheilSenSlope([1, 2, 3, 4], 0),
    /confidenceLevel must be in/,
  );
  assert.throws(
    () => dailyTokenTheilSenSlope([1, 2, 3, 4], 1),
    /confidenceLevel must be in/,
  );
  assert.throws(
    () => dailyTokenTheilSenSlope([1, 2, 3, 4], -0.1),
    /confidenceLevel must be in/,
  );
  assert.throws(
    () => dailyTokenTheilSenSlope([1, 2, 3, 4], NaN),
    /confidenceLevel must be in/,
  );
});

test('dailyTokenTheilSenSlope: strictly monotone increasing -> slope = 1', () => {
  const r = dailyTokenTheilSenSlope([1, 2, 3, 4, 5, 6, 7, 8]);
  const n = 8;
  assert.equal(r.theilSenSlope, 1);
  assert.equal(r.theilSenIntercept, 1);
  assert.equal(r.naiveEndpointSlope, 1);
  assert.equal(r.nPairs, (n * (n - 1)) / 2);
  assert.equal(r.pairsPositive, (n * (n - 1)) / 2);
  assert.equal(r.pairsNegative, 0);
  assert.equal(r.pairsZero, 0);
});

test('dailyTokenTheilSenSlope: strictly monotone decreasing -> slope = -1', () => {
  const r = dailyTokenTheilSenSlope([8, 7, 6, 5, 4, 3, 2, 1]);
  const n = 8;
  assert.equal(r.theilSenSlope, -1);
  assert.equal(r.theilSenIntercept, 8);
  assert.equal(r.naiveEndpointSlope, -1);
  assert.equal(r.pairsNegative, (n * (n - 1)) / 2);
  assert.equal(r.pairsPositive, 0);
  assert.equal(r.pairsZero, 0);
});

test('dailyTokenTheilSenSlope: scale factor of 5 -> slope = 5', () => {
  const r = dailyTokenTheilSenSlope([0, 5, 10, 15, 20, 25, 30, 35]);
  assert.equal(r.theilSenSlope, 5);
  assert.equal(r.theilSenIntercept, 0);
  assert.equal(r.naiveEndpointSlope, 5);
});

test('dailyTokenTheilSenSlope: constant series -> slope = 0, all pairs zero', () => {
  const r = dailyTokenTheilSenSlope([7, 7, 7, 7, 7, 7]);
  const n = 6;
  assert.equal(r.theilSenSlope, 0);
  assert.equal(r.theilSenIntercept, 7);
  assert.equal(r.naiveEndpointSlope, 0);
  assert.equal(r.pairsZero, (n * (n - 1)) / 2);
  assert.equal(r.pairsPositive, 0);
  assert.equal(r.pairsNegative, 0);
});

test('dailyTokenTheilSenSlope: pairsPositive + pairsNegative + pairsZero == nPairs', () => {
  const r = dailyTokenTheilSenSlope([1, 3, 2, 5, 4, 7, 6, 9, 8, 10]);
  assert.equal(r.pairsPositive + r.pairsNegative + r.pairsZero, r.nPairs);
});

test('dailyTokenTheilSenSlope: outlier-robust -- single huge spike does not move slope', () => {
  // Linear ramp 1..10, then spike the last to 1000.
  const baseline = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const baseR = dailyTokenTheilSenSlope(baseline);
  assert.equal(baseR.theilSenSlope, 1);

  const spiked = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000];
  const spikedR = dailyTokenTheilSenSlope(spiked);
  // Theil-Sen median should still be ~1 because the spike
  // only contaminates ~10% of pairs (those touching index 9).
  // OLS would give a slope of ~9.0 here; Theil-Sen should be 1.
  assert.equal(spikedR.theilSenSlope, 1);
  // Naive endpoint slope IS dragged by the spike -> (1000-1)/9 = 111.
  assert.equal(spikedR.naiveEndpointSlope, 111);
});

test('dailyTokenTheilSenSlope: theilSenSlope is invariant to additive shift in x', () => {
  const a = dailyTokenTheilSenSlope([1, 2, 3, 4, 5, 6, 7]);
  const b = dailyTokenTheilSenSlope([101, 102, 103, 104, 105, 106, 107]);
  assert.equal(a.theilSenSlope, b.theilSenSlope);
  // Intercept shifts by the same amount.
  assert.equal(b.theilSenIntercept - a.theilSenIntercept, 100);
});

test('dailyTokenTheilSenSlope: time-reversal negates the slope', () => {
  const fwd = dailyTokenTheilSenSlope([1, 4, 9, 16, 25, 36]);
  const rev = dailyTokenTheilSenSlope([36, 25, 16, 9, 4, 1]);
  assert.equal(fwd.theilSenSlope, -rev.theilSenSlope);
});

test('dailyTokenTheilSenSlope: known small example -- slope = median of pairwise slopes', () => {
  // x = [1, 3, 2, 5]. Pairs:
  //   (0,1): (3-1)/1 = 2
  //   (0,2): (2-1)/2 = 0.5
  //   (0,3): (5-1)/3 = 1.333...
  //   (1,2): (2-3)/1 = -1
  //   (1,3): (5-3)/2 = 1
  //   (2,3): (5-2)/1 = 3
  // sorted: [-1, 0.5, 1, 1.333..., 2, 3]
  // median (n=6 even) = (1 + 1.333...)/2 = 1.166...
  const r = dailyTokenTheilSenSlope([1, 3, 2, 5]);
  assert.ok(Math.abs(r.theilSenSlope - (1 + 4 / 3) / 2) < 1e-12);
  assert.equal(r.nPairs, 6);
  assert.equal(r.pairsPositive, 5);
  assert.equal(r.pairsNegative, 1);
  assert.equal(r.pairsZero, 0);
});

test('dailyTokenTheilSenSlope: CI brackets the slope', () => {
  const r = dailyTokenTheilSenSlope([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.theilSenSlopeCiLow <= r.theilSenSlope);
  assert.ok(r.theilSenSlopeCiHigh >= r.theilSenSlope);
  assert.ok(r.mLo >= 1 && r.mLo <= r.nPairs);
  assert.ok(r.mHi >= 1 && r.mHi <= r.nPairs);
  assert.ok(r.mLo <= r.mHi);
});

test('dailyTokenTheilSenSlope: tighter confidenceLevel -> wider CI', () => {
  const data = [3, 7, 2, 9, 5, 11, 4, 13, 6, 15, 8];
  const r95 = dailyTokenTheilSenSlope(data, 0.95);
  const r99 = dailyTokenTheilSenSlope(data, 0.99);
  // 99% CI must be at least as wide as 95% CI on each side.
  assert.ok(r99.theilSenSlopeCiLow <= r95.theilSenSlopeCiLow);
  assert.ok(r99.theilSenSlopeCiHigh >= r95.theilSenSlopeCiHigh);
  assert.equal(r95.confidenceLevel, 0.95);
  assert.equal(r99.confidenceLevel, 0.99);
});

test('dailyTokenTheilSenSlope: monotone series CI excludes 0 at 95%', () => {
  // Strict ramp; CI should NOT include 0.
  const r = dailyTokenTheilSenSlope([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.ok(r.theilSenSlopeCiLow > 0);
});

test('dailyTokenTheilSenSlope: tied zeros contribute to pairsZero and tie-correct VarS', () => {
  // 4 zeros + linear ramp.
  const r = dailyTokenTheilSenSlope([0, 0, 0, 0, 1, 2, 3, 4]);
  assert.ok(r.pairsZero >= 6); // C(4, 2) = 6 pairs of tied zeros.
  // Tie-corrected VarS must be <= raw VarS.
  const n = 8;
  const rawVar = (n * (n - 1) * (2 * n + 5)) / 18;
  assert.ok(r.mannKendallVarS < rawVar);
});

test('dailyTokenTheilSenSlope: pairsPositive - pairsNegative == sign-resolved Mann-Kendall S', () => {
  // The Theil-Sen pair partition exactly recovers the
  // Mann-Kendall S statistic when slopes have known signs.
  // For x = [1, 2, 3, ..., 10], all pairs concordant.
  const r = dailyTokenTheilSenSlope([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.pairsPositive - r.pairsNegative, r.nPairs);
});

// ---------- builder ----------

test('buildDailyTokenTheilSenSlope: rejects bad min-tokens', () => {
  assert.throws(
    () => buildDailyTokenTheilSenSlope([], { minTokens: -5 }),
    /minTokens/,
  );
  assert.throws(
    () => buildDailyTokenTheilSenSlope([], { minTokens: NaN }),
    /minTokens/,
  );
});

test('buildDailyTokenTheilSenSlope: rejects bad min-tenure-days', () => {
  assert.throws(
    () => buildDailyTokenTheilSenSlope([], { minTenureDays: 3 }),
    /minTenureDays/,
  );
  assert.throws(
    () => buildDailyTokenTheilSenSlope([], { minTenureDays: 1.5 }),
    /minTenureDays/,
  );
});

test('buildDailyTokenTheilSenSlope: rejects bad confidence-level', () => {
  assert.throws(
    () => buildDailyTokenTheilSenSlope([], { confidenceLevel: 0 }),
    /confidenceLevel/,
  );
  assert.throws(
    () => buildDailyTokenTheilSenSlope([], { confidenceLevel: 1 }),
    /confidenceLevel/,
  );
  assert.throws(
    () => buildDailyTokenTheilSenSlope([], { confidenceLevel: -0.1 }),
    /confidenceLevel/,
  );
});

test('buildDailyTokenTheilSenSlope: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenTheilSenSlope([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenTheilSenSlope: rejects bad top', () => {
  assert.throws(
    () => buildDailyTokenTheilSenSlope([], { top: -1 }),
    /top/,
  );
  assert.throws(
    () => buildDailyTokenTheilSenSlope([], { top: 1.5 }),
    /top/,
  );
});

test('buildDailyTokenTheilSenSlope: rejects malformed since/until', () => {
  assert.throws(
    () => buildDailyTokenTheilSenSlope([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () => buildDailyTokenTheilSenSlope([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('buildDailyTokenTheilSenSlope: empty queue -> empty sources', () => {
  const r = buildDailyTokenTheilSenSlope([], {
    minTenureDays: 4,
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
});

test('buildDailyTokenTheilSenSlope: end-to-end on a 14-day ramp', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    lines.push(ql(dayIso(i), 'src-a', 100 * (i + 1)));
  }
  const r = buildDailyTokenTheilSenSlope(lines, {
    minTokens: 0,
    minTenureDays: 4,
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src-a');
  assert.equal(row.nTenureDays, 14);
  // Slope = 100 tokens/day.
  assert.equal(row.theilSenSlope, 100);
  assert.equal(row.naiveEndpointSlope, 100);
  assert.ok(row.theilSenSlopeCiLow > 0);
});

test('buildDailyTokenTheilSenSlope: gap-filled -- inactive days zero-padded', () => {
  // Active on day 0 with 5000 tokens, day 13 with 5000 tokens.
  // Gap-filled length = 14 days, mostly zeros.
  const lines: QueueLine[] = [
    ql(dayIso(0), 'src-a', 5000),
    ql(dayIso(13), 'src-a', 5000),
  ];
  const r = buildDailyTokenTheilSenSlope(lines, {
    minTokens: 0,
    minTenureDays: 4,
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nTenureDays, 14);
  assert.equal(row.nActiveDays, 2);
  // Most pairs are between two zeros (slope = 0); pairsZero
  // should dominate.
  assert.ok(row.pairsZero > row.pairsPositive + row.pairsNegative);
  // Median pairwise slope over mostly-zeros = 0.
  assert.equal(row.theilSenSlope, 0);
});

test('buildDailyTokenTheilSenSlope: drops below-min-tenure sources', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    lines.push(ql(dayIso(i), 'short', 1000));
  }
  const r = buildDailyTokenTheilSenSlope(lines, {
    minTokens: 0,
    minTenureDays: 14,
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenTheilSenSlope: drops zero-variance sources', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    lines.push(ql(dayIso(i), 'flat', 1000));
  }
  const r = buildDailyTokenTheilSenSlope(lines, {
    minTokens: 0,
    minTenureDays: 4,
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenTheilSenSlope: drops below-min-tokens sources', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    lines.push(ql(dayIso(i), 'sparse', 10 * (i + 1)));
  }
  const r = buildDailyTokenTheilSenSlope(lines, {
    minTokens: 100_000,
    minTenureDays: 4,
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenTheilSenSlope: source filter restricts output', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    lines.push(ql(dayIso(i), 'a', 100 * (i + 1)));
    lines.push(ql(dayIso(i), 'b', 50 * (i + 1)));
  }
  const r = buildDailyTokenTheilSenSlope(lines, {
    source: 'a',
    minTokens: 0,
    minTenureDays: 4,
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenTheilSenSlope: drops invalid hour_start', () => {
  const lines: QueueLine[] = [
    ql('not-a-date', 'src', 1000),
    ...Array.from({ length: 14 }, (_, i) => ql(dayIso(i), 'src', 100 * (i + 1))),
  ];
  const r = buildDailyTokenTheilSenSlope(lines, {
    minTokens: 0,
    minTenureDays: 4,
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('buildDailyTokenTheilSenSlope: drops non-positive total_tokens', () => {
  const lines: QueueLine[] = [
    ql(dayIso(0), 'src', 0),
    ql(dayIso(0), 'src', -5),
    ...Array.from({ length: 14 }, (_, i) => ql(dayIso(i), 'src', 100 * (i + 1))),
  ];
  const r = buildDailyTokenTheilSenSlope(lines, {
    minTokens: 0,
    minTenureDays: 4,
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenTheilSenSlope: top cap drops remainder', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    lines.push(ql(dayIso(i), 'a', 100 * (i + 1)));
    lines.push(ql(dayIso(i), 'b', 50 * (i + 1)));
    lines.push(ql(dayIso(i), 'c', 25 * (i + 1)));
  }
  const r = buildDailyTokenTheilSenSlope(lines, {
    minTokens: 0,
    minTenureDays: 4,
    top: 2,
    sort: 'tokens',
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenTheilSenSlope: sort by slopeAbsDesc puts steepest first', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    lines.push(ql(dayIso(i), 'fast', 1000 * (i + 1))); // slope = 1000/day
    lines.push(ql(dayIso(i), 'slow', 10 * (i + 1))); // slope = 10/day
  }
  const r = buildDailyTokenTheilSenSlope(lines, {
    minTokens: 0,
    minTenureDays: 4,
    sort: 'slopeAbsDesc',
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'fast');
  assert.equal(r.sources[1]!.source, 'slow');
});

test('buildDailyTokenTheilSenSlope: sort by slope ascending puts most-negative first', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    lines.push(ql(dayIso(i), 'up', 100 * (i + 1)));
    lines.push(ql(dayIso(i), 'down', 100 * (14 - i)));
  }
  const r = buildDailyTokenTheilSenSlope(lines, {
    minTokens: 0,
    minTenureDays: 4,
    sort: 'slope',
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.source, 'down');
  assert.equal(r.sources[1]!.source, 'up');
});

test('buildDailyTokenTheilSenSlope: window since/until honoured', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    lines.push(ql(dayIso(i), 'src', 100 * (i + 1)));
  }
  // Restrict to days 0..13 inclusive (since=day0, until=day14).
  const r = buildDailyTokenTheilSenSlope(lines, {
    since: dayIso(0),
    until: dayIso(14),
    minTokens: 0,
    minTenureDays: 4,
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 14);
});

test('buildDailyTokenTheilSenSlope: report shape includes confidenceLevel and Sen CI ranks', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    lines.push(ql(dayIso(i), 'src', 100 * (i + 1)));
  }
  const r = buildDailyTokenTheilSenSlope(lines, {
    minTokens: 0,
    minTenureDays: 4,
    confidenceLevel: 0.9,
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.confidenceLevel, 0.9);
  const row = r.sources[0]!;
  assert.equal(row.confidenceLevel, 0.9);
  assert.ok(Number.isInteger(row.mLo));
  assert.ok(Number.isInteger(row.mHi));
  assert.ok(row.mLo >= 1 && row.mLo <= row.nPairs);
  assert.ok(row.mHi >= 1 && row.mHi <= row.nPairs);
});

// ---------- refinement: edge-case CI degeneracy + intercept algebra ----------

test('dailyTokenTheilSenSlope: extreme confidenceLevel near 1 saturates CI to full pair range', () => {
  // With cl very close to 1, C_alpha grows; M_lo clamps to
  // 1 and M_hi clamps to nPairs. CI must equal the min and
  // max pairwise slopes (post-sort).
  const data = [1, 5, 2, 9, 3, 11, 4, 13];
  const r = dailyTokenTheilSenSlope(data, 0.999_999);
  assert.equal(r.mLo, 1);
  assert.equal(r.mHi, r.nPairs);
  // CI low must be the smallest pairwise slope.
  // CI high must be the largest pairwise slope.
  // Both must exist as actual pairwise slopes.
  const slopes: number[] = [];
  for (let i = 0; i < data.length - 1; i += 1) {
    for (let j = i + 1; j < data.length; j += 1) {
      slopes.push((data[j]! - data[i]!) / (j - i));
    }
  }
  slopes.sort((a, b) => a - b);
  assert.equal(r.theilSenSlopeCiLow, slopes[0]);
  assert.equal(r.theilSenSlopeCiHigh, slopes[slopes.length - 1]);
});

test('dailyTokenTheilSenSlope: intercept algebra -- y = a + b*t recovers (a, b) exactly', () => {
  // Linear y = 7 + 3*t, t = 0..9.
  const data = Array.from({ length: 10 }, (_, i) => 7 + 3 * i);
  const r = dailyTokenTheilSenSlope(data);
  assert.equal(r.theilSenSlope, 3);
  assert.equal(r.theilSenIntercept, 7);
});

test('dailyTokenTheilSenSlope: scale-invariance of pair-partition under positive multiplicative shift', () => {
  // Multiplying all values by a positive constant must
  // scale the slope by that constant but leave the
  // pair partition (pos/neg/zero) unchanged.
  const a = dailyTokenTheilSenSlope([1, 3, 2, 5, 4, 7]);
  const b = dailyTokenTheilSenSlope([100, 300, 200, 500, 400, 700]);
  assert.equal(a.pairsPositive, b.pairsPositive);
  assert.equal(a.pairsNegative, b.pairsNegative);
  assert.equal(a.pairsZero, b.pairsZero);
  assert.ok(Math.abs(b.theilSenSlope - 100 * a.theilSenSlope) < 1e-9);
});

test('dailyTokenTheilSenSlope: degenerate CI clamp -- tiny n with cl close to 1', () => {
  // n=4, cl=0.999_999 forces both mLo and mHi to clamp.
  const r = dailyTokenTheilSenSlope([1, 2, 3, 5], 0.999_999);
  // Both clamps should be hit; CI should equal min/max
  // pairwise slope.
  assert.equal(r.mLo, 1);
  assert.equal(r.mHi, r.nPairs);
});
