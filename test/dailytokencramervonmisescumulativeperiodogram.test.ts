import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cramerVonMisesSurvival,
  cramerVonMisesCumulativePeriodogramStatistic,
  dailyTokenCramerVonMisesCumulativePeriodogram,
  buildDailyTokenCramerVonMisesCumulativePeriodogram,
} from '../src/dailytokencramervonmisescumulativeperiodogram.js';
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

// ---------- cramerVonMisesSurvival ----------

test('cramerVonMisesSurvival: w2 <= 0 -> p = 1', () => {
  assert.equal(cramerVonMisesSurvival(0), 1);
  assert.equal(cramerVonMisesSurvival(-1), 1);
});

test('cramerVonMisesSurvival: very large w2 -> p ~ 0', () => {
  assert.ok(cramerVonMisesSurvival(50) < 1e-50);
});

test('cramerVonMisesSurvival: monotone non-increasing in w2', () => {
  let prev = Infinity;
  for (let w = 0; w < 5; w += 0.05) {
    const p = cramerVonMisesSurvival(w);
    assert.ok(p <= prev + 1e-12, `non-monotone at w2=${w}: ${p} > ${prev}`);
    prev = p;
  }
});

test('cramerVonMisesSurvival: result in [0, 1]', () => {
  for (let w = 0; w < 5; w += 0.1) {
    const p = cramerVonMisesSurvival(w);
    assert.ok(p >= 0 && p <= 1, `w2=${w} -> p=${p} out of [0,1]`);
  }
});

test('cramerVonMisesSurvival: published critical values match table to 1%', () => {
  // Anderson-Darling (1952) Table 1 critical values:
  //   P(W^2 > 0.46136) = 0.05
  //   P(W^2 > 0.74346) = 0.01
  //   P(W^2 > 0.34730) = 0.10
  // The interpolation is exact at table grid points.
  assert.ok(Math.abs(cramerVonMisesSurvival(0.46136) - 0.05) < 1e-9);
  assert.ok(Math.abs(cramerVonMisesSurvival(0.74346) - 0.01) < 1e-9);
  assert.ok(Math.abs(cramerVonMisesSurvival(0.34730) - 0.10) < 1e-9);
});

test('cramerVonMisesSurvival: rejects non-finite input', () => {
  assert.throws(() => cramerVonMisesSurvival(Number.NaN));
  assert.throws(() => cramerVonMisesSurvival(Infinity));
});

test('cramerVonMisesSurvival: tail extrapolation positive and decreasing', () => {
  // Beyond the table tail (w2 > 1.16786), the asymptotic
  // closure must remain positive and strictly decreasing.
  let prev = cramerVonMisesSurvival(1.16786);
  for (let w = 1.5; w < 10; w += 0.5) {
    const p = cramerVonMisesSurvival(w);
    assert.ok(p > 0, `tail underflow to <=0 at w=${w}: ${p}`);
    assert.ok(p < prev, `tail not strictly decreasing at w=${w}: ${p} >= ${prev}`);
    prev = p;
  }
});

// ---------- cramerVonMisesCumulativePeriodogramStatistic ----------

test('cvm: uniform spectrum -> w2 = 0, pValue = 1', () => {
  const power = [1, 1, 1, 1, 1, 1, 1, 1];
  const r = cramerVonMisesCumulativePeriodogramStatistic(power);
  assert.equal(r.cvmOmega2, 0);
  assert.equal(r.cvmW2, 0);
  assert.equal(r.cvmPValue, 1);
  assert.equal(r.cvmSignedMean, 0);
});

test('cvm: spike at first bin -> w2 matches closed form', () => {
  // For P=[1,0,...,0], C[j]=1 for j=1..K-1, dev[j] = 1 - j/K.
  // sumSq = sum_{j=1..K-1} (1 - j/K)^2
  //       = sum_{j=1..K-1} ((K-j)/K)^2
  //       = (1/K^2) sum_{i=1..K-1} i^2  (i=K-j)
  //       = (1/K^2) * (K-1)K(2K-1)/6
  // cvmW2 = sumSq.
  const K = 10;
  const power = new Array(K).fill(0);
  power[0] = 1;
  const r = cramerVonMisesCumulativePeriodogramStatistic(power);
  const expected = ((K - 1) * K * (2 * K - 1)) / 6 / (K * K);
  assert.ok(Math.abs(r.cvmW2 - expected) < 1e-12, `cvmW2=${r.cvmW2} != ${expected}`);
  assert.ok(r.cvmSignedMean > 0, 'devMean should be positive (low-frequency mass overshoot)');
});

test('cvm: spike at last bin -> w2 matches closed form, signed mean negative', () => {
  // For P=[0,...,0,1], C[j]=0 for j=1..K-1, dev[j] = -j/K.
  // sumSq = sum_{j=1..K-1} (j/K)^2 = (1/K^2)(K-1)K(2K-1)/6.
  // SAME magnitude as spike-at-first-bin (the L^2 norm is
  // bin-reversal symmetric); SIGN of cvmSignedMean flips.
  const K = 10;
  const power = new Array(K).fill(0);
  power[K - 1] = 1;
  const r = cramerVonMisesCumulativePeriodogramStatistic(power);
  const expected = ((K - 1) * K * (2 * K - 1)) / 6 / (K * K);
  assert.ok(Math.abs(r.cvmW2 - expected) < 1e-12);
  assert.ok(r.cvmSignedMean < 0, 'devMean should be negative (high-frequency mass overshoot)');
});

test('cvm: bin-reversal preserves cvmW2 magnitude (orthogonality witness)', () => {
  const power = [5, 4, 3, 2, 1, 1, 1, 1];
  const reversed = [...power].reverse();
  const a = cramerVonMisesCumulativePeriodogramStatistic(power);
  const b = cramerVonMisesCumulativePeriodogramStatistic(reversed);
  // The L^2 cumulative deviation is symmetric under reversal
  // of the cumulative direction: integral of (1 - F)^2 over
  // [0,1] equals integral of F^2 over [0,1] for a reflected
  // CDF. Verify numerically.
  assert.ok(Math.abs(a.cvmW2 - b.cvmW2) < 1e-12, `cvmW2 not reversal-symmetric: ${a.cvmW2} vs ${b.cvmW2}`);
});

test('cvm: rejects too few bins', () => {
  assert.throws(() => cramerVonMisesCumulativePeriodogramStatistic([1]));
});

test('cvm: rejects negative power', () => {
  assert.throws(() =>
    cramerVonMisesCumulativePeriodogramStatistic([1, -1, 2]),
  );
});

test('cvm: rejects non-finite power', () => {
  assert.throws(() =>
    cramerVonMisesCumulativePeriodogramStatistic([1, Number.NaN, 2]),
  );
});

test('cvm: rejects all-zero spectrum', () => {
  assert.throws(() =>
    cramerVonMisesCumulativePeriodogramStatistic([0, 0, 0, 0]),
  );
});

test('cvm: scale invariance', () => {
  const power = [1, 2, 3, 4, 5, 1, 2, 3];
  const r1 = cramerVonMisesCumulativePeriodogramStatistic(power);
  const r2 = cramerVonMisesCumulativePeriodogramStatistic(
    power.map((p) => p * 1000),
  );
  assert.ok(Math.abs(r1.cvmW2 - r2.cvmW2) < 1e-12);
  assert.ok(Math.abs(r1.cvmPValue - r2.cvmPValue) < 1e-12);
});

test('cvm: w2 = K * omega2 identity', () => {
  const power = [1, 5, 2, 4, 3, 1, 2, 1];
  const r = cramerVonMisesCumulativePeriodogramStatistic(power);
  assert.ok(Math.abs(r.cvmW2 - power.length * r.cvmOmega2) < 1e-12);
});

test('cvm: ORTHOGONALITY witness vs Bartlett-bD (sup vs L^2)', () => {
  // Construct a spectrum with ONE sharp jump and ELSE-uniform:
  // Bartlett's sup-norm bD picks up the single jump strongly;
  // CvM's L^2 norm averages it out across many bins so the
  // statistic is comparatively SMALLER (relative to a
  // SUSTAINED-bias spectrum of the same Bartlett bD).
  const K = 32;
  // Spectrum A: single concentrated spike at bin 8.
  const A = new Array(K).fill(1);
  A[7] = 50; // one big spike
  // Spectrum B: sustained low-frequency overshoot (first
  // half all 2x, second half all 1x). Total power and bD-
  // family of properties differ structurally.
  const B = new Array(K).fill(1);
  for (let i = 0; i < K / 2; i += 1) B[i] = 2;

  const aBartlett = bartlettCumulativePeriodogramStatistic(A);
  const aCvm = cramerVonMisesCumulativePeriodogramStatistic(A);
  const bBartlett = bartlettCumulativePeriodogramStatistic(B);
  const bCvm = cramerVonMisesCumulativePeriodogramStatistic(B);

  // The RATIO cvmW2/bD^2 differs between A and B: the L^2
  // norm sees the sustained bias of B more than the single
  // spike of A, RELATIVE to what their Bartlett-bD says.
  // Concretely:
  //   ratio_A = aCvm.cvmW2 / aBartlett.bD^2
  //   ratio_B = bCvm.cvmW2 / bBartlett.bD^2
  // We require ratio_B > ratio_A as a robust orthogonality
  // demonstration (sustained-bias spectrum has a higher
  // CvM-vs-bD^2 ratio than the single-spike spectrum, which
  // is the textbook L^infty-vs-L^2 power complement).
  const ratioA = aCvm.cvmW2 / (aBartlett.bD * aBartlett.bD);
  const ratioB = bCvm.cvmW2 / (bBartlett.bD * bBartlett.bD);
  assert.ok(
    ratioB > ratioA * 1.1,
    `expected sustained-bias spectrum to have a higher CvM/bD^2 ratio than spike spectrum: ratioA=${ratioA}, ratioB=${ratioB}`,
  );
});

// ---------- dailyTokenCramerVonMisesCumulativePeriodogram ----------

test('dailyToken: rejects too-short series', () => {
  assert.throws(() =>
    dailyTokenCramerVonMisesCumulativePeriodogram([1, 2, 3]),
  );
});

test('dailyToken: rejects zero-variance series', () => {
  assert.throws(() =>
    dailyTokenCramerVonMisesCumulativePeriodogram([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]),
  );
});

test('dailyToken: rejects non-finite values', () => {
  assert.throws(() =>
    dailyTokenCramerVonMisesCumulativePeriodogram([1, 2, Number.NaN, 4, 5, 6, 7, 8]),
  );
});

test('dailyToken: pure sinusoid concentrates spectrum (cvmW2 large, pValue small)', () => {
  const values: number[] = [];
  for (let i = 0; i < 32; i += 1) {
    values.push(100 + 50 * Math.sin((2 * Math.PI * i) / 4));
  }
  const r = dailyTokenCramerVonMisesCumulativePeriodogram(values);
  assert.ok(r.cvmW2 > 0.5, `expected large cvmW2, got ${r.cvmW2}`);
  assert.ok(r.cvmPValue < 0.05, `expected significant pValue, got ${r.cvmPValue}`);
});

test('dailyToken: cvmW2 = K * cvmOmega2 identity', () => {
  const values: number[] = [];
  for (let i = 0; i < 20; i += 1) {
    values.push(10 + i * 0.5 + Math.sin(i));
  }
  const r = dailyTokenCramerVonMisesCumulativePeriodogram(values);
  assert.ok(Math.abs(r.cvmW2 - r.nFreqBins * r.cvmOmega2) < 1e-9);
});

// ---------- buildDailyTokenCramerVonMisesCumulativePeriodogram ----------

test('build: empty queue -> empty rows', () => {
  const r = buildDailyTokenCramerVonMisesCumulativePeriodogram([], {
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
  const r = buildDailyTokenCramerVonMisesCumulativePeriodogram(lines, {
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
  const r = buildDailyTokenCramerVonMisesCumulativePeriodogram(lines, {
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
  const r = buildDailyTokenCramerVonMisesCumulativePeriodogram(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src1');
  assert.ok(row.cvmW2 > 0);
  assert.ok(row.cvmPValue >= 0 && row.cvmPValue <= 1);
  assert.equal(row.nTenureDays, 40);
});

test('build: rejects invalid sort', () => {
  assert.throws(() =>
    buildDailyTokenCramerVonMisesCumulativePeriodogram([], {
      sort: 'nonsense' as unknown as 'cvmW2',
    }),
  );
});

test('build: rejects too-small minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenCramerVonMisesCumulativePeriodogram([], { minTenureDays: 4 }),
  );
});

test('build: source filter restricts rows', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    lines.push(ql(dayIso(i), 'src1', 1000 + i * 10));
    lines.push(ql(dayIso(i), 'src2', 2000 + i * 5));
  }
  const r = buildDailyTokenCramerVonMisesCumulativePeriodogram(lines, {
    source: 'src1',
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src1');
  assert.equal(r.droppedSourceFilter, 40);
});
