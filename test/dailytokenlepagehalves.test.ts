import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenLepageHalves,
  buildDailyTokenLepageHalves,
  wilcoxonNullMoments,
  ansariBradleyNullMomentsLep,
  ansariBradleyRanksForLep,
  lepageSignedChannels,
  lepageDirectionLabel,
  aggregateLepageHalves,
  chiSquaredUpperTailLep,
  lanczosLogGammaLep,
} from '../src/dailytokenlepagehalves.js';
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

// ---------- primitive: Wilcoxon null moments ----------

test('wilcoxonNullMoments: n=8 (n1=n2=4) closed-form', () => {
  // E[W_A] = 4*9/2 = 18; Var = 4*4*9/12 = 12
  const { mean, variance } = wilcoxonNullMoments(4, 4);
  assert.equal(mean, 18);
  assert.equal(variance, 12);
});

test('wilcoxonNullMoments: n=10 (5,5)', () => {
  const { mean, variance } = wilcoxonNullMoments(5, 5);
  assert.equal(mean, 5 * 11 / 2);
  assert.equal(variance, 5 * 5 * 11 / 12);
});

test('wilcoxonNullMoments: rejects bad inputs', () => {
  assert.throws(() => wilcoxonNullMoments(0, 5), /n1 must be an integer >= 1/);
  assert.throws(() => wilcoxonNullMoments(5, 0), /n2 must be an integer >= 1/);
  assert.throws(() => wilcoxonNullMoments(2.5, 4), /n1 must be an integer >= 1/);
});

// ---------- primitive: Ansari-Bradley null moments ----------

test('ansariBradleyNullMomentsLep: n=8 even closed-form', () => {
  // E = n1(n+2)/4 = 4*10/4 = 10; Var = n1 n2 (n+2)(n-2)/(48(n-1)) = 4*4*10*6/(48*7) = 960/336
  const { mean, variance } = ansariBradleyNullMomentsLep(4, 4);
  assert.equal(mean, 10);
  assert.ok(Math.abs(variance - 960 / 336) < 1e-12);
});

test('ansariBradleyNullMomentsLep: n=9 odd closed-form', () => {
  // n=9, n1=4, n2=5: E = 4*100/(36) = 11.111...; Var = 4*5*10*84/(48*81)
  const { mean, variance } = ansariBradleyNullMomentsLep(4, 5);
  assert.ok(Math.abs(mean - (4 * 100) / 36) < 1e-12);
  assert.ok(Math.abs(variance - (4 * 5 * 10 * 84) / (48 * 81)) < 1e-12);
});

test('ansariBradleyNullMomentsLep: rejects bad inputs', () => {
  assert.throws(() => ansariBradleyNullMomentsLep(0, 5), /n1 must be an integer >= 1/);
  assert.throws(() => ansariBradleyNullMomentsLep(5, 0), /n2 must be an integer >= 1/);
});

// ---------- primitive: AB folded ranks ----------

test('ansariBradleyRanksForLep: n=8 even', () => {
  assert.deepEqual(ansariBradleyRanksForLep(8), [1, 2, 3, 4, 4, 3, 2, 1]);
});

test('ansariBradleyRanksForLep: n=9 odd', () => {
  assert.deepEqual(ansariBradleyRanksForLep(9), [1, 2, 3, 4, 5, 4, 3, 2, 1]);
});

test('ansariBradleyRanksForLep: rejects n<2', () => {
  assert.throws(() => ansariBradleyRanksForLep(1), /n must be an integer >= 2/);
  assert.throws(() => ansariBradleyRanksForLep(2.5), /n must be an integer >= 2/);
});

// ---------- core: dailyTokenLepageHalves ----------

test('dailyTokenLepageHalves: rejects n<8', () => {
  assert.throws(() => dailyTokenLepageHalves([1, 2, 3, 4, 5, 6, 7]), /need at least 8/);
});

test('dailyTokenLepageHalves: rejects non-finite', () => {
  assert.throws(
    () => dailyTokenLepageHalves([1, 2, 3, 4, 5, 6, 7, Number.NaN]),
    /requires finite values/,
  );
});

test('dailyTokenLepageHalves: rejects all-equal', () => {
  assert.throws(
    () => dailyTokenLepageHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

test('dailyTokenLepageHalves: shift invariance lepL(x+c) === lepL(x)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const a = dailyTokenLepageHalves(x);
  const b = dailyTokenLepageHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(a.lepL - b.lepL) < 1e-9, `${a.lepL} vs ${b.lepL}`);
  assert.ok(Math.abs(a.lepZW - b.lepZW) < 1e-9);
  assert.ok(Math.abs(a.lepZAB - b.lepZAB) < 1e-9);
});

test('dailyTokenLepageHalves: positive scale invariance lepL(a*x) === lepL(x)', () => {
  const x = [1, 3, 2, 7, 4, 9, 8, 5, 6, 10];
  const a = dailyTokenLepageHalves(x);
  const b = dailyTokenLepageHalves(x.map((v) => v * 17.5));
  assert.ok(Math.abs(a.lepL - b.lepL) < 1e-9);
});

test('dailyTokenLepageHalves: identity lepL = lepZW^2 + lepZAB^2', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const r = dailyTokenLepageHalves(x);
  const expected = r.lepZW * r.lepZW + r.lepZAB * r.lepZAB;
  assert.ok(Math.abs(r.lepL - expected) < 1e-12);
});

test('dailyTokenLepageHalves: identity lepZ = sqrt(lepL)', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const r = dailyTokenLepageHalves(x);
  assert.ok(Math.abs(r.lepZ - Math.sqrt(r.lepL)) < 1e-12);
});

test('dailyTokenLepageHalves: lepPValue = exp(-L/2)', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const r = dailyTokenLepageHalves(x);
  assert.ok(Math.abs(r.lepPValue - Math.exp(-r.lepL / 2)) < 1e-12);
});

test('dailyTokenLepageHalves: pure null (sorted ascending) -> small location signal', () => {
  // Sorted ascending: rank-sum of first half is minimal -> zW very negative.
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = dailyTokenLepageHalves(x);
  // First half {1..5} has rank-sum 15; E = 27.5; Var = 25*11/12 = 22.91; zW ~ -2.61
  assert.ok(r.lepZW < -2, `expected zW < -2, got ${r.lepZW}`);
  // L should be large -> small p-value
  assert.ok(r.lepPValue < 0.05);
});

test('dailyTokenLepageHalves: pure null (random shuffle) -> moderate L', () => {
  // Use a deterministic interleaving that should give modest signal.
  const x = [5, 3, 8, 1, 9, 2, 7, 4, 6, 10];
  const r = dailyTokenLepageHalves(x);
  // No catastrophic outcome
  assert.ok(Number.isFinite(r.lepL));
  assert.ok(r.lepL >= 0);
  assert.ok(r.lepPValue > 0 && r.lepPValue <= 1);
});

test('dailyTokenLepageHalves: pure scale shift -> AB component dominant', () => {
  // First half tightly clustered; second half symmetric around same median but spread.
  const x = [9, 10, 10, 11, 1, 5, 10, 15, 19, 20];
  const r = dailyTokenLepageHalves(x);
  // Expect zAB to carry most of the signal
  assert.ok(Math.abs(r.lepZAB) > 0.5, `zAB should be non-trivial, got ${r.lepZAB}`);
});

test('dailyTokenLepageHalves: n=8 minimum size accepted', () => {
  const r = dailyTokenLepageHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.lepN1, 4);
  assert.equal(r.lepN2, 4);
  assert.equal(r.nSamples, 8);
});

test('dailyTokenLepageHalves: returns expected fields', () => {
  const r = dailyTokenLepageHalves([1, 5, 2, 8, 3, 7, 4, 6, 9, 10]);
  assert.ok('mean' in r);
  assert.ok('stddev' in r);
  assert.ok('lepWA' in r);
  assert.ok('lepABA' in r);
  assert.ok('lepZW' in r);
  assert.ok('lepZAB' in r);
  assert.ok('lepL' in r);
  assert.ok('lepPValue' in r);
  assert.ok('lepZ' in r);
});

test('dailyTokenLepageHalves: exact W rank-sum with no ties on small example', () => {
  // x = [10, 20, 30, 40, 50, 60, 70, 80]; n1 = 4, n2 = 4
  // First half {10,20,30,40} -> ranks {1,2,3,4} -> sum = 10
  // E = 18, Var = 12, zW = (10-18)/sqrt(12) = -2.3094
  const r = dailyTokenLepageHalves([10, 20, 30, 40, 50, 60, 70, 80]);
  assert.equal(r.lepWA, 10);
  assert.ok(Math.abs(r.lepZW - (-2.3094010767585034)) < 1e-9);
});

// ---------- signed channels ----------

test('lepageSignedChannels: lepLocZ = -zW, lepScaleZ = +zAB', () => {
  const { lepLocZ, lepScaleZ } = lepageSignedChannels(2.5, -1.7);
  assert.equal(lepLocZ, -2.5);
  assert.equal(lepScaleZ, -1.7);
});

test('lepageSignedChannels: norm-preserving identity', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const r = dailyTokenLepageHalves(x);
  const { lepLocZ, lepScaleZ } = lepageSignedChannels(r.lepZW, r.lepZAB);
  assert.ok(Math.abs(lepLocZ * lepLocZ + lepScaleZ * lepScaleZ - r.lepL) < 1e-12);
});

test('lepageSignedChannels: rejects non-finite', () => {
  assert.throws(() => lepageSignedChannels(Number.NaN, 1), /non-finite/);
  assert.throws(() => lepageSignedChannels(1, Number.POSITIVE_INFINITY), /non-finite/);
});

// ---------- direction label ----------

test('lepageDirectionLabel: null-like', () => {
  assert.equal(lepageDirectionLabel(0.1, 0.1), 'null-like');
});

test('lepageDirectionLabel: location-dominant', () => {
  assert.equal(lepageDirectionLabel(3, 1), 'location-dominant');
  assert.equal(lepageDirectionLabel(-5, 1), 'location-dominant');
  assert.equal(lepageDirectionLabel(2, 0), 'location-dominant');
});

test('lepageDirectionLabel: scale-dominant', () => {
  assert.equal(lepageDirectionLabel(1, 3), 'scale-dominant');
  assert.equal(lepageDirectionLabel(1, -5), 'scale-dominant');
  assert.equal(lepageDirectionLabel(0, 2), 'scale-dominant');
});

test('lepageDirectionLabel: mixed', () => {
  assert.equal(lepageDirectionLabel(2, 1.5), 'mixed');
  assert.equal(lepageDirectionLabel(1.5, 2), 'mixed');
});

test('lepageDirectionLabel: rejects non-finite', () => {
  assert.throws(() => lepageDirectionLabel(Number.NaN, 1), /non-finite/);
});

// ---------- chi-squared upper tail ----------

test('chiSquaredUpperTailLep: chi-2(2) survival = exp(-x/2)', () => {
  for (const x of [0.5, 1, 2, 3, 5, 10]) {
    const got = chiSquaredUpperTailLep(x, 2);
    const exact = Math.exp(-x / 2);
    assert.ok(Math.abs(got - exact) < 1e-10, `x=${x}: got=${got}, exact=${exact}`);
  }
});

test('chiSquaredUpperTailLep: chi-2(2) at x=5.991 ~ 0.05', () => {
  const got = chiSquaredUpperTailLep(5.991, 2);
  assert.ok(Math.abs(got - 0.05) < 1e-3, `got=${got}`);
});

test('chiSquaredUpperTailLep: x<=0 returns 1', () => {
  assert.equal(chiSquaredUpperTailLep(0, 4), 1);
  assert.equal(chiSquaredUpperTailLep(-1, 4), 1);
});

test('chiSquaredUpperTailLep: rejects bad inputs', () => {
  assert.throws(() => chiSquaredUpperTailLep(Number.NaN, 2), /non-finite/);
  assert.throws(() => chiSquaredUpperTailLep(5, 0), /k must be positive/);
});

test('lanczosLogGammaLep: x=1 returns 0', () => {
  assert.ok(Math.abs(lanczosLogGammaLep(1)) < 1e-13);
});

test('lanczosLogGammaLep: x=5 returns log(24)', () => {
  assert.ok(Math.abs(lanczosLogGammaLep(5) - Math.log(24)) < 1e-12);
});

test('lanczosLogGammaLep: rejects non-positive', () => {
  assert.throws(() => lanczosLogGammaLep(0), /must be > 0/);
  assert.throws(() => lanczosLogGammaLep(-1), /must be > 0/);
});

// ---------- corpus aggregator ----------

test('aggregateLepageHalves: empty -> rowsUsed=0, p=1', () => {
  const r = aggregateLepageHalves([]);
  assert.equal(r.rowsUsed, 0);
  assert.equal(r.fisherCombinedPValue, 1);
});

test('aggregateLepageHalves: skips malformed rows', () => {
  const r = aggregateLepageHalves([
    { lepL: 5, lepPValue: 0.1 },
    { lepL: Number.NaN, lepPValue: 0.5 },
    { lepL: -1, lepPValue: 0.5 },
    { lepL: 3, lepPValue: 0 },
    { lepL: 3, lepPValue: 1.5 },
    { lepL: 2, lepPValue: 0.5 },
  ]);
  assert.equal(r.rowsUsed, 2);
  assert.equal(r.rowsSkipped, 4);
});

test('aggregateLepageHalves: Fisher combined p with 3 sources', () => {
  const r = aggregateLepageHalves([
    { lepL: 4, lepPValue: 0.1 },
    { lepL: 3, lepPValue: 0.2 },
    { lepL: 2, lepPValue: 0.3 },
  ]);
  // chi2 = -2 * (ln 0.1 + ln 0.2 + ln 0.3) = -2 * ln(0.006) ~ 10.232
  const expectedChi2 = -2 * (Math.log(0.1) + Math.log(0.2) + Math.log(0.3));
  assert.ok(Math.abs(r.fisherChi2 - expectedChi2) < 1e-10);
  assert.equal(r.rowsUsed, 3);
  // p-value = chi-2(6) upper tail at expectedChi2
  assert.ok(r.fisherCombinedPValue > 0 && r.fisherCombinedPValue < 1);
});

test('aggregateLepageHalves: meanLepL', () => {
  const r = aggregateLepageHalves([
    { lepL: 4, lepPValue: 0.1 },
    { lepL: 6, lepPValue: 0.05 },
  ]);
  assert.equal(r.meanLepL, 5);
});

// ---------- builder integration ----------

test('buildDailyTokenLepageHalves: empty queue -> empty report', () => {
  const r = buildDailyTokenLepageHalves([], { generatedAt: '2026-05-04T00:00:00Z' });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenLepageHalves: filters below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    queue.push(ql(dayIso(i), 'small', 5));
  }
  const r = buildDailyTokenLepageHalves(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenLepageHalves: filters below min-tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 's', 1000));
  }
  const r = buildDailyTokenLepageHalves(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
    minTokens: 0,
    minTenureDays: 14,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenLepageHalves: produces row for sufficient source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src', 100 + i * 50));
  }
  const r = buildDailyTokenLepageHalves(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
    minTokens: 100,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src');
  // Monotone-increasing series -> first half has small ranks -> zW very negative -> large L
  assert.ok(r.sources[0]!.lepZW < -2);
  assert.ok(r.sources[0]!.lepL > 5);
});

test('buildDailyTokenLepageHalves: zero-variance dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 1000));
  }
  const r = buildDailyTokenLepageHalves(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
    minTokens: 100,
    minTenureDays: 14,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenLepageHalves: source filter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'a', 100 + i * 50));
    queue.push(ql(dayIso(i), 'b', 200 + i * 30));
  }
  const r = buildDailyTokenLepageHalves(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
    minTokens: 100,
    minTenureDays: 14,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenLepageHalves: rejects bad sort', () => {
  assert.throws(
    () => buildDailyTokenLepageHalves([], { sort: 'bogus' as never }),
    /sort must be one of/,
  );
});

test('buildDailyTokenLepageHalves: rejects min-tenure-days < 8', () => {
  assert.throws(
    () => buildDailyTokenLepageHalves([], { minTenureDays: 5 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('buildDailyTokenLepageHalves: rejects negative min-tokens', () => {
  assert.throws(
    () => buildDailyTokenLepageHalves([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('buildDailyTokenLepageHalves: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenLepageHalves([], { top: -3 }),
    /top must be a non-negative integer/,
  );
});

test('buildDailyTokenLepageHalves: rejects bad since', () => {
  assert.throws(
    () => buildDailyTokenLepageHalves([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('buildDailyTokenLepageHalves: top cap', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), `s${s}`, 100 + i * 50 + s * 10));
    }
  }
  const r = buildDailyTokenLepageHalves(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
    minTokens: 100,
    minTenureDays: 14,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('buildDailyTokenLepageHalves: sort stability', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 3; s += 1) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), `src${s}`, 100 + i * 50));
    }
  }
  const r = buildDailyTokenLepageHalves(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
    minTokens: 100,
    minTenureDays: 14,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['src0', 'src1', 'src2'],
  );
});

test('buildDailyTokenLepageHalves: dropped non-positive tokens', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'x', -5),
    ql(dayIso(1), 'x', 0),
  ];
  const r = buildDailyTokenLepageHalves(queue);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenLepageHalves: dropped invalid hour_start', () => {
  const queue: QueueLine[] = [ql('not-a-date', 'x', 100)];
  const r = buildDailyTokenLepageHalves(queue);
  assert.equal(r.droppedInvalidHourStart, 1);
});

// ---------- tenure-weighted corpus aggregator (refinement) ----------

import { aggregateLepageHalvesTenureWeighted } from '../src/dailytokenlepagehalves.js';

test('aggregateLepageHalvesTenureWeighted: empty -> rowsUsed=0, p=1', () => {
  const r = aggregateLepageHalvesTenureWeighted([]);
  assert.equal(r.rowsUsed, 0);
  assert.equal(r.weightedCombinedPValue, 1);
  assert.equal(r.weightSum, 0);
  assert.equal(r.effectiveDof, 0);
});

test('aggregateLepageHalvesTenureWeighted: equal tenures reduce to standard Fisher chi-2(2m)', () => {
  // When all w_i = 1 (equal tenures), weightedChi2 = sum -2 ln p_i,
  // effectiveDof = 2 * m^2 / m = 2m. Identical to Fisher.
  const rows = [
    { lepL: 4, lepPValue: 0.1, nTenureDays: 30 },
    { lepL: 3, lepPValue: 0.2, nTenureDays: 30 },
    { lepL: 2, lepPValue: 0.3, nTenureDays: 30 },
  ];
  const w = aggregateLepageHalvesTenureWeighted(rows);
  const expectedChi2 = -2 * (Math.log(0.1) + Math.log(0.2) + Math.log(0.3));
  assert.ok(Math.abs(w.weightedChi2 - expectedChi2) < 1e-10);
  assert.ok(Math.abs(w.effectiveDof - 6) < 1e-10);
  // p-value should match Fisher's chi-2(6) upper tail at expectedChi2
  const fisher = aggregateLepageHalves(rows);
  assert.ok(Math.abs(w.weightedCombinedPValue - fisher.fisherCombinedPValue) < 1e-10);
});

test('aggregateLepageHalvesTenureWeighted: skips malformed rows', () => {
  const rows = [
    { lepL: 5, lepPValue: 0.1, nTenureDays: 30 },
    { lepL: Number.NaN, lepPValue: 0.5, nTenureDays: 30 },
    { lepL: -1, lepPValue: 0.5, nTenureDays: 30 },
    { lepL: 3, lepPValue: 0, nTenureDays: 30 },
    { lepL: 3, lepPValue: 1.5, nTenureDays: 30 },
    { lepL: 2, lepPValue: 0.5, nTenureDays: 0 }, // bad tenure
    { lepL: 2, lepPValue: 0.5, nTenureDays: -5 },
    { lepL: 2, lepPValue: 0.5, nTenureDays: 30 },
  ];
  const w = aggregateLepageHalvesTenureWeighted(rows);
  assert.equal(w.rowsUsed, 2);
  assert.equal(w.rowsSkipped, 6);
});

test('aggregateLepageHalvesTenureWeighted: heavy-tenure source dominates chi2', () => {
  // 1 long-tenure source (200 days) with strong signal, 2 short ones.
  const rows = [
    { lepL: 50, lepPValue: 1e-12, nTenureDays: 200 },
    { lepL: 1, lepPValue: 0.5, nTenureDays: 20 },
    { lepL: 1, lepPValue: 0.5, nTenureDays: 20 },
  ];
  const w = aggregateLepageHalvesTenureWeighted(rows);
  // Mean tenure = 80; weights = (2.5, 0.25, 0.25); weightSum = 3 = m; weightSqSum = 6.375
  // effectiveDof = 2 * 9 / 6.375 ~ 2.823
  assert.ok(Math.abs(w.weightSum - 3) < 1e-10);
  assert.ok(Math.abs(w.effectiveDof - (2 * 9) / 6.375) < 1e-10);
  // Heavy chi2 contribution from the long-tenure source
  // weightedChi2 = 2.5 * (-2 ln 1e-12) + 0.25 * (-2 ln 0.5) * 2
  const expected = 2.5 * (-2 * Math.log(1e-12)) + 0.5 * (-2 * Math.log(0.5));
  assert.ok(Math.abs(w.weightedChi2 - expected) < 1e-10);
  // Should still reject strongly
  assert.ok(w.weightedCombinedPValue < 1e-5);
});

test('aggregateLepageHalvesTenureWeighted: meanLepL is unweighted arithmetic mean', () => {
  const w = aggregateLepageHalvesTenureWeighted([
    { lepL: 4, lepPValue: 0.1, nTenureDays: 100 },
    { lepL: 6, lepPValue: 0.05, nTenureDays: 10 },
  ]);
  assert.equal(w.meanLepL, 5);
});

test('aggregateLepageHalvesTenureWeighted: rejects non-integer tenure', () => {
  const w = aggregateLepageHalvesTenureWeighted([
    { lepL: 5, lepPValue: 0.1, nTenureDays: 14.5 as number },
  ]);
  assert.equal(w.rowsUsed, 0);
  assert.equal(w.rowsSkipped, 1);
});
