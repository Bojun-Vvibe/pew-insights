import test from 'node:test';
import assert from 'node:assert/strict';
import {
  andersonDarlingSurvival,
  andersonDarlingCumulativePeriodogramStatistic,
  dailyTokenAndersonDarlingCumulativePeriodogram,
  buildDailyTokenAndersonDarlingCumulativePeriodogram,
} from '../src/dailytokenandersondarlingcumulativeperiodogram.js';
import { cramerVonMisesCumulativePeriodogramStatistic } from '../src/dailytokencramervonmisescumulativeperiodogram.js';
import { bartlettCumulativePeriodogramStatistic } from '../src/dailytokenbartlettcumulativeperiodogram.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    hour_start,
    source,
    total_tokens,
  } as unknown as QueueLine;
}

function dayIso(i: number): string {
  return (
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z'
  );
}

// ---------- andersonDarlingSurvival ----------

test('andersonDarlingSurvival: z <= 0 -> p = 1', () => {
  assert.equal(andersonDarlingSurvival(0), 1);
  assert.equal(andersonDarlingSurvival(-1), 1);
});

test('andersonDarlingSurvival: very large z -> p ~ 0', () => {
  assert.ok(andersonDarlingSurvival(50) < 1e-30);
});

test('andersonDarlingSurvival: monotone non-increasing in z', () => {
  let prev = Infinity;
  for (let z = 0; z < 6; z += 0.05) {
    const p = andersonDarlingSurvival(z);
    assert.ok(p <= prev + 1e-9, `non-monotone at z=${z}: ${p} > ${prev}`);
    prev = p;
  }
});

test('andersonDarlingSurvival: result in [0, 1]', () => {
  for (let z = 0; z < 8; z += 0.1) {
    const p = andersonDarlingSurvival(z);
    assert.ok(p >= 0 && p <= 1, `z=${z} -> p=${p} out of [0,1]`);
  }
});

test('andersonDarlingSurvival: published critical values within Marsaglia tolerance', () => {
  // Anderson-Darling published asymptotic critical values
  // (Stephens 1974 JASA 69(347) Table 1):
  //   P(A^2 > 1.933) = 0.10
  //   P(A^2 > 2.492) = 0.05
  //   P(A^2 > 3.070) = 0.025
  //   P(A^2 > 3.857) = 0.01
  // Marsaglia (2004) approximation is accurate to ~1e-4 in
  // the body and ~1e-6 in the tail. We allow 5e-3 absolute.
  assert.ok(
    Math.abs(andersonDarlingSurvival(1.933) - 0.10) < 5e-3,
    `at 1.933 got ${andersonDarlingSurvival(1.933)}`,
  );
  assert.ok(
    Math.abs(andersonDarlingSurvival(2.492) - 0.05) < 5e-3,
    `at 2.492 got ${andersonDarlingSurvival(2.492)}`,
  );
  assert.ok(
    Math.abs(andersonDarlingSurvival(3.070) - 0.025) < 5e-3,
    `at 3.070 got ${andersonDarlingSurvival(3.070)}`,
  );
  assert.ok(
    Math.abs(andersonDarlingSurvival(3.857) - 0.01) < 5e-3,
    `at 3.857 got ${andersonDarlingSurvival(3.857)}`,
  );
});

test('andersonDarlingSurvival: rejects non-finite input', () => {
  assert.throws(() => andersonDarlingSurvival(Number.NaN));
  assert.throws(() => andersonDarlingSurvival(Infinity));
});

test('andersonDarlingSurvival: piecewise seam at z=2 is C^0 continuous', () => {
  // The piecewise approximation has its seam at z = 2. The
  // two pieces must agree to within Marsaglia's ~1e-5
  // tolerance there (continuity guard).
  const eps = 1e-9;
  const left = andersonDarlingSurvival(2 - eps);
  const right = andersonDarlingSurvival(2 + eps);
  assert.ok(
    Math.abs(left - right) < 1e-4,
    `seam discontinuity at z=2: left=${left}, right=${right}`,
  );
});

test('andersonDarlingSurvival: tail beyond z=6 stays positive and decreasing', () => {
  let prev = andersonDarlingSurvival(6);
  for (let z = 6.5; z < 20; z += 0.5) {
    const p = andersonDarlingSurvival(z);
    assert.ok(p >= 0, `tail underflow to <0 at z=${z}: ${p}`);
    assert.ok(p <= prev + 1e-12, `tail not non-increasing at z=${z}: ${p} > ${prev}`);
    prev = p;
  }
});

// ---------- andersonDarlingCumulativePeriodogramStatistic ----------

test('ad: uniform spectrum -> A^2 = 0, pValue = 1', () => {
  const power = [1, 1, 1, 1, 1, 1, 1, 1];
  const r = andersonDarlingCumulativePeriodogramStatistic(power);
  assert.equal(r.adA2, 0);
  assert.equal(r.adAStar, 0);
  assert.equal(r.adPValue, 1);
  assert.equal(r.adWeightedSignedMean, 0);
});

test('ad: spike at first bin -> A^2 matches closed form', () => {
  // For P=[1,0,...,0], C[j]=1 for j=1..K-1, dev[j] = 1 - j/K.
  // term[j] = (1 - j/K)^2 / ((j/K)*(1-j/K)) = (1 - j/K) / (j/K)
  //        = (K - j) / j.
  // sumWeighted = sum_{j=1..K-1} (K - j) / j
  //             = K * H_{K-1} - (K-1)
  // where H_m = sum_{i=1..m} 1/i (the harmonic number).
  const K = 10;
  const power = new Array(K).fill(0);
  power[0] = 1;
  const r = andersonDarlingCumulativePeriodogramStatistic(power);
  let expected = 0;
  for (let j = 1; j <= K - 1; j += 1) expected += (K - j) / j;
  assert.ok(
    Math.abs(r.adAStar - expected) < 1e-12,
    `adAStar=${r.adAStar} != ${expected}`,
  );
  assert.ok(
    r.adWeightedSignedMean > 0,
    'wDevMean should be positive (low-frequency tail overshoot)',
  );
});

test('ad: spike at last bin -> A^2 matches closed form, signed mean negative', () => {
  // For P=[0,...,0,1], C[j]=0 for j=1..K-1, dev[j] = -j/K.
  // term[j] = (j/K)^2 / ((j/K)*(1-j/K)) = (j/K)/(1-j/K)
  //        = j / (K - j).
  // sumWeighted = sum_{j=1..K-1} j / (K-j) = sum_{i=1..K-1} (K-i)/i
  // SAME magnitude as spike-at-first-bin (the AD weight is
  // symmetric about 1/2); SIGN of wDevMean flips.
  const K = 10;
  const power = new Array(K).fill(0);
  power[K - 1] = 1;
  const r = andersonDarlingCumulativePeriodogramStatistic(power);
  let expected = 0;
  for (let j = 1; j <= K - 1; j += 1) expected += (K - j) / j;
  assert.ok(
    Math.abs(r.adAStar - expected) < 1e-12,
    `adAStar=${r.adAStar} != ${expected}`,
  );
  assert.ok(
    r.adWeightedSignedMean < 0,
    'wDevMean should be negative (high-frequency tail overshoot)',
  );
});

test('ad: bin-reversal preserves adAStar magnitude (weight symmetry)', () => {
  // The AD weight 1/(t*(1-t)) is symmetric about t=1/2, so the
  // statistic is invariant under reflection of the cumulative
  // direction.
  const power = [5, 4, 3, 2, 1, 1, 1, 1];
  const reversed = [...power].reverse();
  const a = andersonDarlingCumulativePeriodogramStatistic(power);
  const b = andersonDarlingCumulativePeriodogramStatistic(reversed);
  assert.ok(
    Math.abs(a.adAStar - b.adAStar) < 1e-10,
    `adAStar not reversal-symmetric: ${a.adAStar} vs ${b.adAStar}`,
  );
});

test('ad: rejects too few bins', () => {
  assert.throws(() => andersonDarlingCumulativePeriodogramStatistic([1]));
});

test('ad: rejects negative power', () => {
  assert.throws(() =>
    andersonDarlingCumulativePeriodogramStatistic([1, -1, 2]),
  );
});

test('ad: rejects non-finite power', () => {
  assert.throws(() =>
    andersonDarlingCumulativePeriodogramStatistic([1, Number.NaN, 2]),
  );
});

test('ad: rejects all-zero spectrum', () => {
  assert.throws(() =>
    andersonDarlingCumulativePeriodogramStatistic([0, 0, 0, 0]),
  );
});

test('ad: scale invariance', () => {
  const power = [1, 2, 3, 4, 5, 1, 2, 3];
  const r1 = andersonDarlingCumulativePeriodogramStatistic(power);
  const r2 = andersonDarlingCumulativePeriodogramStatistic(
    power.map((p) => p * 1000),
  );
  assert.ok(Math.abs(r1.adAStar - r2.adAStar) < 1e-10);
  assert.ok(Math.abs(r1.adPValue - r2.adPValue) < 1e-10);
});

test('ad: adAStar = (K-1) * adA2 identity', () => {
  const power = [1, 5, 2, 4, 3, 1, 2, 1];
  const r = andersonDarlingCumulativePeriodogramStatistic(power);
  const K = power.length;
  assert.ok(
    Math.abs(r.adAStar - (K - 1) * r.adA2) < 1e-12,
    `adAStar=${r.adAStar}, (K-1)*adA2=${(K - 1) * r.adA2}`,
  );
});

test('ad: ORTHOGONALITY witness vs CvM (tail-weighted vs uniform-L^2)', () => {
  // Construct two spectra with comparable CvM-W^2 but very
  // different AD-A^2 -- the textbook tail-weight orthogonality.
  // Spectrum A: ALL deviation concentrated in the first bin
  //   (j=1 contribution; AD weight ~ K).
  // Spectrum B: SAME total deviation but spread mid-band.
  const K = 32;
  // A: low-frequency excess concentrated at the very first bin.
  const A = new Array(K).fill(1);
  A[0] = 30;
  // B: mid-band excess at bin K/2 with the same total power
  //    boost so total power is comparable.
  const B = new Array(K).fill(1);
  B[Math.floor(K / 2)] = 30;

  const aCvm = cramerVonMisesCumulativePeriodogramStatistic(A);
  const aAd = andersonDarlingCumulativePeriodogramStatistic(A);
  const bCvm = cramerVonMisesCumulativePeriodogramStatistic(B);
  const bAd = andersonDarlingCumulativePeriodogramStatistic(B);

  // Orthogonality demonstration: the AD-vs-CvM ratio is
  // SUBSTANTIALLY larger for the j=1-concentrated spectrum
  // (A) than for the mid-band spectrum (B), because AD's
  // weight up-weights the j=1 bin by ~K. We require the ratio
  // adAStar/cvmW2 to be at least 2x larger for A than for B.
  const ratioA = aAd.adAStar / aCvm.cvmW2;
  const ratioB = bAd.adAStar / bCvm.cvmW2;
  assert.ok(
    ratioA > ratioB * 2,
    `expected j=1-concentrated spectrum to have a higher AD/CvM ratio than mid-band spectrum: ratioA=${ratioA}, ratioB=${ratioB}`,
  );
});

test('ad: ORTHOGONALITY witness vs Bartlett-bD (sup vs tail-weighted L^2)', () => {
  // Construct a spectrum with a single sharp spike mid-band:
  // Bartlett's bD picks it up strongly; AD's tail-weighted
  // norm de-emphasises it (the spike is at j=K/2 where the
  // AD weight is its smallest).
  const K = 32;
  const spectrum = new Array(K).fill(1);
  spectrum[Math.floor(K / 2)] = 50;

  const bart = bartlettCumulativePeriodogramStatistic(spectrum);
  const ad = andersonDarlingCumulativePeriodogramStatistic(spectrum);

  // Now the SAME statistic on a low-freq-concentrated spectrum:
  // AD picks it up strongly; Bartlett picks it up only at one
  // point of the cumulative.
  const low = new Array(K).fill(1);
  low[0] = 50;
  const bartLow = bartlettCumulativePeriodogramStatistic(low);
  const adLow = andersonDarlingCumulativePeriodogramStatistic(low);

  // Orthogonality demo: ratio adAStar/bD^2 is LARGER for
  // low-freq-concentrated than for mid-band-concentrated.
  const ratioMid = ad.adAStar / (bart.bD * bart.bD);
  const ratioLow = adLow.adAStar / (bartLow.bD * bartLow.bD);
  assert.ok(
    ratioLow > ratioMid * 1.2,
    `expected low-freq-concentrated spectrum to have a higher AD/bD^2 ratio than mid-band: ratioLow=${ratioLow}, ratioMid=${ratioMid}`,
  );
});

// ---------- dailyTokenAndersonDarlingCumulativePeriodogram ----------

test('dailyToken: rejects too-short series', () => {
  assert.throws(() =>
    dailyTokenAndersonDarlingCumulativePeriodogram([1, 2, 3]),
  );
});

test('dailyToken: rejects zero-variance series', () => {
  assert.throws(() =>
    dailyTokenAndersonDarlingCumulativePeriodogram([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]),
  );
});

test('dailyToken: rejects non-finite values', () => {
  assert.throws(() =>
    dailyTokenAndersonDarlingCumulativePeriodogram([1, 2, Number.NaN, 4, 5, 6, 7, 8]),
  );
});

test('dailyToken: pure sinusoid concentrates spectrum (adAStar large, pValue small)', () => {
  const values: number[] = [];
  for (let i = 0; i < 32; i += 1) {
    values.push(100 + 50 * Math.sin((2 * Math.PI * i) / 4));
  }
  const r = dailyTokenAndersonDarlingCumulativePeriodogram(values);
  assert.ok(r.adAStar > 0.5, `expected large adAStar, got ${r.adAStar}`);
  assert.ok(
    r.adPValue < 0.5,
    `expected non-trivial pValue, got ${r.adPValue}`,
  );
});

test('dailyToken: adAStar = (K-1) * adA2 identity', () => {
  const values: number[] = [];
  for (let i = 0; i < 20; i += 1) {
    values.push(10 + i * 0.5 + Math.sin(i));
  }
  const r = dailyTokenAndersonDarlingCumulativePeriodogram(values);
  assert.ok(
    Math.abs(r.adAStar - (r.nFreqBins - 1) * r.adA2) < 1e-9,
  );
});

// ---------- buildDailyTokenAndersonDarlingCumulativePeriodogram ----------

test('build: empty queue -> empty rows', () => {
  const r = buildDailyTokenAndersonDarlingCumulativePeriodogram([], {
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('build: drops below-min-tokens sources', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    lines.push(ql(dayIso(i), 'src1', 10));
  }
  const r = buildDailyTokenAndersonDarlingCumulativePeriodogram(lines, {
    minTokens: 1000,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('build: drops below-min-tenure sources', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    lines.push(ql(dayIso(i), 'src1', 10000));
  }
  const r = buildDailyTokenAndersonDarlingCumulativePeriodogram(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: produces row for sufficient source', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    const tt = 1000 + 500 * Math.sin((2 * Math.PI * i) / 7);
    lines.push(ql(dayIso(i), 'src1', tt));
  }
  const r = buildDailyTokenAndersonDarlingCumulativePeriodogram(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src1');
  assert.ok(row.adAStar > 0);
  assert.ok(row.adPValue >= 0 && row.adPValue <= 1);
  assert.equal(row.nTenureDays, 40);
});

test('build: rejects invalid sort', () => {
  assert.throws(() =>
    buildDailyTokenAndersonDarlingCumulativePeriodogram([], {
      sort: 'nonsense' as unknown as 'adAStar',
    }),
  );
});

test('build: rejects too-small minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenAndersonDarlingCumulativePeriodogram([], { minTenureDays: 4 }),
  );
});

test('build: source filter restricts rows', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    lines.push(ql(dayIso(i), 'src1', 1000 + i * 10));
    lines.push(ql(dayIso(i), 'src2', 2000 + i * 5));
  }
  const r = buildDailyTokenAndersonDarlingCumulativePeriodogram(lines, {
    source: 'src1',
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src1');
  assert.equal(r.droppedSourceFilter, 40);
});

test('build: sort by adPValue ascending', () => {
  const lines: QueueLine[] = [];
  // src1: low-frequency excess (will produce small adPValue).
  for (let i = 0; i < 40; i += 1) {
    lines.push(ql(dayIso(i), 'src1', i < 5 ? 5000 : 1000));
  }
  // src2: noisy (will produce larger adPValue).
  for (let i = 0; i < 40; i += 1) {
    lines.push(
      ql(dayIso(i), 'src2', 1000 + Math.floor(((i * 7919) % 100) - 50)),
    );
  }
  const r = buildDailyTokenAndersonDarlingCumulativePeriodogram(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: '2026-05-04T00:00:00.000Z',
    sort: 'adPValue',
  });
  // Both sources should appear; first one has the smallest p.
  assert.ok(r.sources.length >= 1);
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      r.sources[i - 1]!.adPValue <= r.sources[i]!.adPValue + 1e-12,
      `not sorted by adPValue at i=${i}`,
    );
  }
});

// ---------- aggregateAndersonDarlingCumulativePeriodogram ----------

import {
  aggregateAndersonDarlingCumulativePeriodogram,
  chiSquaredUpperTail,
} from '../src/dailytokenandersondarlingcumulativeperiodogram.js';

test('aggregate: empty rows -> trivial neutral aggregate', () => {
  const r = aggregateAndersonDarlingCumulativePeriodogram([]);
  assert.equal(r.tenureWeightedAdAStar, 0);
  assert.equal(r.fisherCombinedPValue, 1);
  assert.equal(r.totalTenureWeight, 0);
  assert.equal(r.rowsUsed, 0);
  assert.equal(r.rowsSkipped, 0);
});

test('aggregate: skips malformed rows defensively', () => {
  const r = aggregateAndersonDarlingCumulativePeriodogram([
    { nTenureDays: 30, adAStar: 1.0, adPValue: 0.3 },
    { nTenureDays: 30, adAStar: Number.NaN, adPValue: 0.3 },
    { nTenureDays: 30, adAStar: 1.0, adPValue: Number.NaN },
    { nTenureDays: 1, adAStar: 1.0, adPValue: 0.3 }, // tenure < 2
    { nTenureDays: 30.5, adAStar: 1.0, adPValue: 0.3 } as unknown as {
      nTenureDays: number;
      adAStar: number;
      adPValue: number;
    },
  ]);
  assert.equal(r.rowsUsed, 1);
  assert.equal(r.rowsSkipped, 4);
  assert.ok(r.tenureWeightedAdAStar > 0);
});

test('aggregate: tenure-weighted average matches manual computation', () => {
  // Two rows: tenure 41 (w=40), adAStar=2; tenure 11 (w=10), adAStar=10.
  // Weighted average = (40*2 + 10*10) / (40+10) = 180/50 = 3.6.
  const r = aggregateAndersonDarlingCumulativePeriodogram([
    { nTenureDays: 41, adAStar: 2, adPValue: 0.5 },
    { nTenureDays: 11, adAStar: 10, adPValue: 0.5 },
  ]);
  assert.ok(Math.abs(r.tenureWeightedAdAStar - 3.6) < 1e-12);
  assert.equal(r.totalTenureWeight, 50);
  assert.equal(r.rowsUsed, 2);
});

test('aggregate: Fisher combined p clamps zero p-values', () => {
  // Row with effectively-zero p must not produce -Infinity in
  // chi^2 (clamp to 1e-300); the combined p should be ~0 but
  // finite and in [0, 1].
  const r = aggregateAndersonDarlingCumulativePeriodogram([
    { nTenureDays: 30, adAStar: 100, adPValue: 0 },
    { nTenureDays: 30, adAStar: 100, adPValue: 0 },
  ]);
  assert.ok(Number.isFinite(r.fisherCombinedPValue));
  assert.ok(r.fisherCombinedPValue >= 0 && r.fisherCombinedPValue <= 1);
  assert.ok(r.fisherCombinedPValue < 1e-100);
});

test('aggregate: Fisher combined p of two p=0.5 rows ~ 0.406', () => {
  // chi^2 = -2 * (ln(0.5) + ln(0.5)) = -2 * 2 * ln(0.5) = 4 ln(2) ~ 2.7726.
  // dof = 2 * 2 = 4.
  // P(Chi^2_4 > 2.7726) ~ 0.5963 (R: pchisq(4*log(2), 4, lower.tail=FALSE)
  //                                = 0.5963).
  const r = aggregateAndersonDarlingCumulativePeriodogram([
    { nTenureDays: 30, adAStar: 1, adPValue: 0.5 },
    { nTenureDays: 30, adAStar: 1, adPValue: 0.5 },
  ]);
  assert.ok(
    Math.abs(r.fisherCombinedPValue - 0.5963) < 0.01,
    `expected ~0.5963, got ${r.fisherCombinedPValue}`,
  );
});

// ---------- chiSquaredUpperTail ----------

test('chiSquaredUpperTail: x <= 0 -> p = 1', () => {
  assert.equal(chiSquaredUpperTail(0, 4), 1);
  assert.equal(chiSquaredUpperTail(-1, 4), 1);
});

test('chiSquaredUpperTail: rejects bad inputs', () => {
  assert.throws(() => chiSquaredUpperTail(Number.NaN, 4));
  assert.throws(() => chiSquaredUpperTail(1, 0));
  assert.throws(() => chiSquaredUpperTail(1, -1));
});

test('chiSquaredUpperTail: published critical values within 1e-3', () => {
  // Standard chi-squared critical values:
  //   P(Chi^2_2 > 5.991) = 0.05  (verified against R: pchisq)
  //   P(Chi^2_4 > 9.488) = 0.05
  //   P(Chi^2_6 > 12.592) = 0.05
  //   P(Chi^2_2 > 9.210) = 0.01
  assert.ok(Math.abs(chiSquaredUpperTail(5.991, 2) - 0.05) < 1e-3);
  assert.ok(Math.abs(chiSquaredUpperTail(9.488, 4) - 0.05) < 1e-3);
  assert.ok(Math.abs(chiSquaredUpperTail(12.592, 6) - 0.05) < 1e-3);
  assert.ok(Math.abs(chiSquaredUpperTail(9.210, 2) - 0.01) < 1e-3);
});

test('chiSquaredUpperTail: monotone non-increasing in x', () => {
  let prev = Infinity;
  for (let x = 0; x < 30; x += 0.5) {
    const p = chiSquaredUpperTail(x, 4);
    assert.ok(p <= prev + 1e-12, `non-monotone at x=${x}: ${p} > ${prev}`);
    prev = p;
  }
});

test('chiSquaredUpperTail: result in [0, 1]', () => {
  for (let x = 0; x < 100; x += 1) {
    for (const k of [1, 2, 4, 10, 50]) {
      const p = chiSquaredUpperTail(x, k);
      assert.ok(p >= 0 && p <= 1, `k=${k} x=${x} -> p=${p}`);
    }
  }
});
