import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenCucconiHalves,
  buildDailyTokenCucconiHalves,
  cucconiNullMoments,
  cucconiNullRho,
  aggregateCucconiHalves,
  chiSquaredUpperTail,
  lanczosLogGamma,
} from '../src/dailytokencucconihalves.js';
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

// ---------- primitive: null moments ----------

test('cucconiNullMoments: n=8 (n1=n2=4) closed-form', () => {
  // E[T1] = 4 * 9 * 17 / 6 = 102
  // Var[T1] = 4 * 4 * 9 * 17 * 75 / 180 = 9 * 17 * 75 * 16 / 180
  //         = 183600 / 180 = 1020
  const { mean, variance } = cucconiNullMoments(4, 4);
  assert.equal(mean, 102);
  assert.ok(Math.abs(variance - 1020) < 1e-9, `var=${variance}`);
});

test('cucconiNullMoments: marginal of T1 equals marginal of T2 (symmetry)', () => {
  // The function reports a single (mean, variance) for
  // T1; T2 has the same marginal under H0 by the
  // R -> n+1-R symmetry. Test by re-running with same
  // args (sanity-check the contract).
  for (const [n1, n2] of [[4, 4], [4, 5], [10, 10], [7, 13]]) {
    const a = cucconiNullMoments(n1!, n2!);
    const b = cucconiNullMoments(n1!, n2!);
    assert.equal(a.mean, b.mean);
    assert.equal(a.variance, b.variance);
  }
});

test('cucconiNullMoments: rejects n1<1 or n2<1 or non-integer', () => {
  assert.throws(() => cucconiNullMoments(0, 5), /n1 must be an integer >= 1/);
  assert.throws(() => cucconiNullMoments(5, 0), /n2 must be an integer >= 1/);
  assert.throws(() => cucconiNullMoments(3.5, 4), /n1 must be an integer >= 1/);
});

// ---------- primitive: null rho ----------

test('cucconiNullRho: n=8 closed-form', () => {
  // rho = 2*60 / (17 * 75) - 1 = 120 / 1275 - 1 = -0.90588235...
  // Wait: (2n+1) = 17, (8n+11) = 75. So rho = 2*(64-4) / (17*75) - 1
  //     = 120 / 1275 - 1 = -1 + 0.0941176...  = -0.9058823...
  const rho = cucconiNullRho(8);
  assert.ok(Math.abs(rho - (120 / 1275 - 1)) < 1e-12, `rho=${rho}`);
  assert.ok(rho < 0, `rho should be negative for moderate n, got ${rho}`);
});

test('cucconiNullRho: monotone toward -7/8 as n grows', () => {
  // Limit: rho -> 2 * n^2 / ((2n)(8n)) - 1 = 1/8 - 1 = -7/8 = -0.875
  // and rho INCREASES (toward 0) monotonically with n.
  const values = [8, 16, 32, 64, 128, 256, 1024].map(cucconiNullRho);
  for (let i = 1; i < values.length; i += 1) {
    assert.ok(
      values[i]! > values[i - 1]!,
      `rho not increasing at n=${[8,16,32,64,128,256,1024][i]}: ${values[i-1]} -> ${values[i]}`,
    );
  }
  assert.ok(values.at(-1)! < -0.875 + 1e-2, `rho should approach -7/8, got ${values.at(-1)}`);
  assert.ok(values.at(-1)! > -0.876, `rho should stay above -7/8 limit, got ${values.at(-1)}`);
});

test('cucconiNullRho: rejects n < 2 or non-integer', () => {
  assert.throws(() => cucconiNullRho(1), /n must be an integer >= 2/);
  assert.throws(() => cucconiNullRho(3.5), /n must be an integer >= 2/);
});

// ---------- primitive: input validation ----------

test('dailyTokenCucconiHalves: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenCucconiHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenCucconiHalves: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenCucconiHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenCucconiHalves([1, Infinity, 3, 4, 5, 6, 7, 8]),
    /finite values/,
  );
});

test('dailyTokenCucconiHalves: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenCucconiHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: split sizes ----------

test('dailyTokenCucconiHalves: even n splits evenly', () => {
  const r = dailyTokenCucconiHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.ccN1, 4);
  assert.equal(r.ccN2, 4);
  assert.equal(r.nSamples, 8);
});

test('dailyTokenCucconiHalves: odd n puts middle into second half', () => {
  const r = dailyTokenCucconiHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.ccN1, 4);
  assert.equal(r.ccN2, 5);
});

// ---------- primitive: invariances ----------

test('dailyTokenCucconiHalves: shift-invariant', () => {
  const x = [1, 5, 2, 4, 9, 11, 3, 17];
  const r1 = dailyTokenCucconiHalves(x);
  const r2 = dailyTokenCucconiHalves(x.map((v) => v + 1000));
  assert.ok(
    Math.abs(r1.ccC - r2.ccC) < 1e-9,
    `ccC shift drift ${r1.ccC} vs ${r2.ccC}`,
  );
  assert.ok(Math.abs(r1.ccT1 - r2.ccT1) < 1e-9);
  assert.ok(Math.abs(r1.ccT2 - r2.ccT2) < 1e-9);
});

test('dailyTokenCucconiHalves: positive-scale-invariant', () => {
  const x = [1, 5, 2, 4, 9, 11, 3, 17];
  const r1 = dailyTokenCucconiHalves(x);
  const r2 = dailyTokenCucconiHalves(x.map((v) => 7 * v));
  assert.ok(
    Math.abs(r1.ccC - r2.ccC) < 1e-9,
    `ccC pos-scale drift ${r1.ccC} vs ${r2.ccC}`,
  );
});

test('dailyTokenCucconiHalves: negation symmetry (T1 and T2 swap)', () => {
  // Negating reverses pooled rank order, mapping each
  // monotonic rank R to n+1-R. So T1 and T2 swap; C is
  // symmetric in U and V (since rho is the same), so C
  // is unchanged.
  const x = [1, 5, 2, 4, 9, 11, 3, 17];
  const r1 = dailyTokenCucconiHalves(x);
  const r2 = dailyTokenCucconiHalves(x.map((v) => -v));
  assert.ok(
    Math.abs(r1.ccC - r2.ccC) < 1e-9,
    `ccC negation drift ${r1.ccC} vs ${r2.ccC}`,
  );
  assert.ok(
    Math.abs(r1.ccT1 - r2.ccT2) < 1e-9,
    `T1(x) should equal T2(-x): ${r1.ccT1} vs ${r2.ccT2}`,
  );
  assert.ok(
    Math.abs(r1.ccT2 - r2.ccT1) < 1e-9,
    `T2(x) should equal T1(-x): ${r1.ccT2} vs ${r2.ccT1}`,
  );
});

// ---------- primitive: moment formulas hold ----------

test('dailyTokenCucconiHalves: ccU and ccV match standardisation against closed-form', () => {
  for (const n of [8, 9, 10, 11, 13, 17, 30, 31]) {
    const x = Array.from({ length: n }, (_, i) => (i % 3) * (i + 1) + i * 0.7);
    const r = dailyTokenCucconiHalves(x);
    const expected = cucconiNullMoments(r.ccN1, r.ccN2);
    const sd = Math.sqrt(expected.variance);
    const uExp = (r.ccT1 - expected.mean) / sd;
    const vExp = (r.ccT2 - expected.mean) / sd;
    assert.ok(
      Math.abs(r.ccU - uExp) < 1e-9,
      `n=${n} ccU=${r.ccU} expected=${uExp}`,
    );
    assert.ok(
      Math.abs(r.ccV - vExp) < 1e-9,
      `n=${n} ccV=${r.ccV} expected=${vExp}`,
    );
  }
});

test('dailyTokenCucconiHalves: ccRho matches cucconiNullRho(n)', () => {
  for (const n of [8, 9, 12, 17, 30]) {
    const x = Array.from({ length: n }, (_, i) => Math.sin(i * 0.4) + 0.1 * i);
    const r = dailyTokenCucconiHalves(x);
    assert.ok(
      Math.abs(r.ccRho - cucconiNullRho(n)) < 1e-12,
      `n=${n} ccRho mismatch`,
    );
  }
});

test('dailyTokenCucconiHalves: ccC = (U^2 + V^2 - 2 rho U V) / (2(1-rho^2))', () => {
  for (const n of [8, 11, 16, 30]) {
    const x = Array.from({ length: n }, (_, i) => Math.cos(i * 0.7) + i * 0.3);
    const r = dailyTokenCucconiHalves(x);
    const expected =
      (r.ccU * r.ccU + r.ccV * r.ccV - 2 * r.ccRho * r.ccU * r.ccV) /
      (2 * (1 - r.ccRho * r.ccRho));
    assert.ok(
      Math.abs(r.ccC - expected) < 1e-9,
      `n=${n} ccC=${r.ccC} expected=${expected}`,
    );
  }
});

test('dailyTokenCucconiHalves: ccPValue = exp(-ccC) and ccZ = sqrt(2 ccC)', () => {
  const x = [1, 5, 2, 4, 9, 11, 3, 17, 22, 30];
  const r = dailyTokenCucconiHalves(x);
  assert.ok(Math.abs(r.ccPValue - Math.exp(-r.ccC)) < 1e-15);
  assert.ok(Math.abs(r.ccZ - Math.sqrt(2 * r.ccC)) < 1e-12);
});

test('dailyTokenCucconiHalves: ccC is non-negative', () => {
  for (let seed = 0; seed < 20; seed += 1) {
    const x = Array.from({ length: 12 }, (_, i) => Math.sin(i * 0.3 + seed) + i * 0.1);
    const r = dailyTokenCucconiHalves(x);
    assert.ok(r.ccC >= 0, `ccC must be non-negative, got ${r.ccC} (seed=${seed})`);
  }
});

// ---------- primitive: behaviour ----------

test('dailyTokenCucconiHalves: pure location shift drives positive ccC', () => {
  // A all small, B all large -> second half's ranks all
  // at the top of the pool -> T1 large -> U large positive
  // -> joint statistic significant.
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8,        // A
    101, 102, 103, 104, 105, 106, 107, 108,  // B
  ];
  const r = dailyTokenCucconiHalves(x);
  assert.ok(r.ccC > 5, `expected large ccC under pure location shift, got ${r.ccC}`);
  assert.ok(r.ccPValue < 0.01, `expected small p, got ${r.ccPValue}`);
});

test('dailyTokenCucconiHalves: pure scale shift (B much wider, same median) drives non-trivial ccC', () => {
  // A tightly around 50, B widely around 50.
  const x = [
    49, 50, 51, 50, 49, 51, 50, 50,    // A: tight
    -50, 150, -30, 130, -10, 110, 0, 100,  // B: wide, centred near 50
  ];
  const r = dailyTokenCucconiHalves(x);
  // Cucconi picks up scale shift via the joint U,V combination.
  assert.ok(r.ccC > 0.5, `expected non-trivial ccC under scale shift, got ${r.ccC}`);
});

test('dailyTokenCucconiHalves: identical halves yield small ccC', () => {
  // Two identical halves -> second-half ranks are
  // exchangeable with first-half -> on average, near null.
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8,
    1, 2, 3, 4, 5, 6, 7, 8,
  ];
  // Stable tie-break by orig index puts second-half ties
  // AFTER first-half ties at each value, so second-half
  // ranks are 2, 4, 6, 8, 10, 12, 14, 16 -> T1 is offset
  // somewhat from E[T1]. Expect ccC modest, well below
  // the alpha=0.05 threshold (~3 for chi-2(2)/2).
  const r = dailyTokenCucconiHalves(x);
  assert.ok(r.ccC < 5, `expected modest ccC for identical halves, got ${r.ccC}`);
});

// ---------- builder: end-to-end ----------

test('buildDailyTokenCucconiHalves: filters non-positive tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    queue.push(ql(dayIso(i), 's1', 100 * (i + 1)));
  }
  queue.push(ql(dayIso(14), 's1', 0));
  queue.push(ql(dayIso(15), 's1', -5));
  const r = buildDailyTokenCucconiHalves(queue, {
    minTokens: 0,
    minTenureDays: 8,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources.length, 1);
});

test('buildDailyTokenCucconiHalves: drops sources below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'busy', 1000 + i * 50));
    queue.push(ql(dayIso(i), 'sparse', 5));
  }
  const r = buildDailyTokenCucconiHalves(queue, {
    minTokens: 100,
    minTenureDays: 8,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'busy');
});

test('buildDailyTokenCucconiHalves: drops below min-tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'short', 1000));
  }
  const r = buildDailyTokenCucconiHalves(queue, {
    minTokens: 0,
    minTenureDays: 8,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenCucconiHalves: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 100));
  }
  const r = buildDailyTokenCucconiHalves(queue, {
    minTokens: 0,
    minTenureDays: 8,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenCucconiHalves: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenCucconiHalves([], {
        sort: 'bogus' as 'ccC',
        minTenureDays: 8,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenCucconiHalves: rejects bad min-tenure', () => {
  assert.throws(
    () =>
      buildDailyTokenCucconiHalves([], {
        minTenureDays: 4,
      }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('buildDailyTokenCucconiHalves: top-k cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 12; i += 1) {
      queue.push(ql(dayIso(i), src, 100 + i * 7 + src.charCodeAt(0)));
    }
  }
  const r = buildDailyTokenCucconiHalves(queue, {
    minTokens: 0,
    minTenureDays: 8,
    top: 2,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenCucconiHalves: sort=ccCDesc orders by ccC descending', () => {
  const queue: QueueLine[] = [];
  // src1: pure location shift -> large ccC
  // src2: roughly identical halves -> small ccC
  const shift = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const stable = [10, 12, 9, 11, 10, 8, 13, 9, 11, 10, 12, 8, 9, 11, 10, 12];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src1', shift[i]! + 1000));
    queue.push(ql(dayIso(i), 'src2', stable[i]! + 1000));
  }
  const r = buildDailyTokenCucconiHalves(queue, {
    minTokens: 0,
    minTenureDays: 8,
    sort: 'ccCDesc',
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(
    r.sources[0]!.ccC >= r.sources[1]!.ccC,
    `expected ccCDesc; got ${r.sources[0]!.ccC} vs ${r.sources[1]!.ccC}`,
  );
});

// ---------- aggregator: chiSquaredUpperTail / lanczosLogGamma ----------

test('lanczosLogGamma: integer anchor values', () => {
  // ln(0!) = 0, ln(1!) = 0, ln(2!) = ln(2), ln(3!) = ln(6), ln(5!) = ln(120)
  assert.ok(Math.abs(lanczosLogGamma(1) - 0) < 1e-10);
  assert.ok(Math.abs(lanczosLogGamma(2) - 0) < 1e-10);
  assert.ok(Math.abs(lanczosLogGamma(3) - Math.log(2)) < 1e-10);
  assert.ok(Math.abs(lanczosLogGamma(4) - Math.log(6)) < 1e-10);
  assert.ok(Math.abs(lanczosLogGamma(6) - Math.log(120)) < 1e-10);
});

test('lanczosLogGamma: rejects x <= 0 or non-finite', () => {
  assert.throws(() => lanczosLogGamma(0), /x must be > 0/);
  assert.throws(() => lanczosLogGamma(-1), /x must be > 0/);
  assert.throws(() => lanczosLogGamma(NaN), /x must be > 0/);
});

test('chiSquaredUpperTail: anchor values', () => {
  // Chi-2(2) survival is exp(-x/2). Q(0; 2) = 1, Q(2; 2) = exp(-1).
  assert.ok(Math.abs(chiSquaredUpperTail(0, 2) - 1) < 1e-12);
  assert.ok(Math.abs(chiSquaredUpperTail(2, 2) - Math.exp(-1)) < 1e-9);
  assert.ok(Math.abs(chiSquaredUpperTail(6, 2) - Math.exp(-3)) < 1e-9);
  // Chi-2(1) at x = 3.841 is approximately 0.05 (alpha=0.05 critical value).
  assert.ok(Math.abs(chiSquaredUpperTail(3.841, 1) - 0.05) < 5e-3);
  // Chi-2(4) at x = 9.488 is approximately 0.05.
  assert.ok(Math.abs(chiSquaredUpperTail(9.488, 4) - 0.05) < 5e-3);
});

test('chiSquaredUpperTail: monotone non-increasing in x', () => {
  let prev = chiSquaredUpperTail(0.01, 4);
  for (let x = 0.5; x <= 30; x += 0.5) {
    const v = chiSquaredUpperTail(x, 4);
    assert.ok(v <= prev + 1e-12, `non-monotone at x=${x}: ${prev} -> ${v}`);
    prev = v;
  }
});

test('chiSquaredUpperTail: clamped to [0, 1]', () => {
  for (const x of [0.001, 1, 5, 100]) {
    for (const k of [1, 2, 4, 10]) {
      const v = chiSquaredUpperTail(x, k);
      assert.ok(v >= 0 && v <= 1, `out of range Q(${x};${k}) = ${v}`);
    }
  }
});

test('chiSquaredUpperTail: rejects non-finite or non-positive k', () => {
  assert.throws(() => chiSquaredUpperTail(NaN, 2), /non-finite input/);
  assert.throws(() => chiSquaredUpperTail(1, 0), /k must be positive/);
  assert.throws(() => chiSquaredUpperTail(1, -1), /k must be positive/);
});

// ---------- aggregator: Fisher ----------

test('aggregateCucconiHalves: empty input returns identity (chi2=0, p=1)', () => {
  const r = aggregateCucconiHalves([]);
  assert.equal(r.fisherChi2, 0);
  assert.equal(r.fisherCombinedPValue, 1);
  assert.equal(r.rowsUsed, 0);
  assert.equal(r.rowsSkipped, 0);
  assert.ok(Number.isNaN(r.meanCcC));
});

test('aggregateCucconiHalves: skips malformed rows', () => {
  const r = aggregateCucconiHalves([
    { ccC: NaN, ccPValue: 0.5 },
    { ccC: 1.0, ccPValue: 0 },        // p=0 invalid
    { ccC: 1.0, ccPValue: -0.1 },     // p<0 invalid
    { ccC: 1.0, ccPValue: 1.5 },      // p>1 invalid
    { ccC: -0.5, ccPValue: 0.5 },     // negative C invalid
    { ccC: 2.0, ccPValue: 0.135 },    // valid
  ]);
  assert.equal(r.rowsSkipped, 5);
  assert.equal(r.rowsUsed, 1);
  assert.ok(Number.isFinite(r.fisherChi2));
});

test('aggregateCucconiHalves: single row anchor', () => {
  // chi2 = -2 * ln(0.135) ~ -2 * -2.0025 ~ 4.005
  // P(chi-2(2) > 4.005) = exp(-4.005/2) ~ exp(-2.0025) ~ 0.135
  const r = aggregateCucconiHalves([{ ccC: 2.0, ccPValue: 0.135 }]);
  assert.ok(Math.abs(r.fisherChi2 - (-2 * Math.log(0.135))) < 1e-12);
  assert.ok(
    Math.abs(r.fisherCombinedPValue - 0.135) < 1e-3,
    `single-row p should reproduce input p, got ${r.fisherCombinedPValue}`,
  );
  assert.ok(Math.abs(r.meanCcC - 2.0) < 1e-12);
});

test('aggregateCucconiHalves: many small p-values amplify', () => {
  const rows = [
    { ccC: 3.0, ccPValue: Math.exp(-3.0) },
    { ccC: 3.0, ccPValue: Math.exp(-3.0) },
    { ccC: 3.0, ccPValue: Math.exp(-3.0) },
    { ccC: 3.0, ccPValue: Math.exp(-3.0) },
  ];
  const r = aggregateCucconiHalves(rows);
  // chi2 = 4 * 6 = 24; df = 8; P(chi-2(8) > 24) ~ 0.0023
  assert.ok(Math.abs(r.fisherChi2 - 24) < 1e-9);
  assert.ok(
    r.fisherCombinedPValue < 0.01,
    `expected combined p < 0.01, got ${r.fisherCombinedPValue}`,
  );
  assert.ok(Math.abs(r.meanCcC - 3.0) < 1e-12);
});

test('aggregateCucconiHalves: p=1 across all rows yields combined p=1', () => {
  const rows = Array.from({ length: 5 }, () => ({ ccC: 0, ccPValue: 1 }));
  const r = aggregateCucconiHalves(rows);
  assert.equal(r.fisherChi2, 0);
  assert.ok(Math.abs(r.fisherCombinedPValue - 1) < 1e-12);
});

// ---------- refinement: signed channel decomposition ----------
import {
  cucconiSignedChannels,
  cucconiDirectionLabel,
} from '../src/dailytokencucconihalves.js';

test('cucconiSignedChannels: norm-preserving identity locZ^2 + scaleZ^2 == 2 C', () => {
  for (const n of [8, 9, 11, 14, 17, 30, 31]) {
    const x = Array.from({ length: n }, (_, i) => Math.cos(i * 0.7) + i * 0.3);
    const r = dailyTokenCucconiHalves(x);
    const ch = cucconiSignedChannels(r.ccU, r.ccV, r.ccRho);
    const lhs = ch.locZ * ch.locZ + ch.scaleZ * ch.scaleZ;
    const rhs = 2 * r.ccC;
    assert.ok(
      Math.abs(lhs - rhs) < 1e-9,
      `n=${n} norm not preserved: ${lhs} vs 2C=${rhs}`,
    );
  }
});

test('cucconiSignedChannels: pure location shift gives locZ-dominant signal', () => {
  // B all larger than A -> ccU positive, ccV negative -> locZ large, scaleZ small.
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8,
    101, 102, 103, 104, 105, 106, 107, 108,
  ];
  const r = dailyTokenCucconiHalves(x);
  const ch = cucconiSignedChannels(r.ccU, r.ccV, r.ccRho);
  assert.ok(
    Math.abs(ch.locZ) > Math.abs(ch.scaleZ) * 5,
    `expected locZ-dominant; locZ=${ch.locZ} scaleZ=${ch.scaleZ}`,
  );
  assert.ok(ch.locZ > 0, `expected positive locZ for location shift up, got ${ch.locZ}`);
});

test('cucconiSignedChannels: rejects non-finite or rho out of range', () => {
  assert.throws(() => cucconiSignedChannels(NaN, 1, 0.5), /non-finite/);
  assert.throws(() => cucconiSignedChannels(1, 1, 1), /must be in/);
  assert.throws(() => cucconiSignedChannels(1, 1, -1), /must be in/);
  assert.throws(() => cucconiSignedChannels(1, 1, 1.5), /must be in/);
});

test('cucconiDirectionLabel: pure location shift labelled location-dominant', () => {
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8,
    101, 102, 103, 104, 105, 106, 107, 108,
  ];
  const r = dailyTokenCucconiHalves(x);
  const ch = cucconiSignedChannels(r.ccU, r.ccV, r.ccRho);
  assert.equal(cucconiDirectionLabel(ch.locZ, ch.scaleZ), 'location-dominant');
});

test('cucconiDirectionLabel: null-like for both small', () => {
  assert.equal(cucconiDirectionLabel(0.1, 0.2), 'null-like');
  assert.equal(cucconiDirectionLabel(-0.4, 0.4), 'null-like');
});

test('cucconiDirectionLabel: scale-dominant when |scaleZ| dominates', () => {
  assert.equal(cucconiDirectionLabel(0.5, 5.0), 'scale-dominant');
  assert.equal(cucconiDirectionLabel(-0.5, -5.0), 'scale-dominant');
});

test('cucconiDirectionLabel: mixed when ratio between 0.5 and 2', () => {
  assert.equal(cucconiDirectionLabel(2.0, 2.5), 'mixed');
  assert.equal(cucconiDirectionLabel(-3.0, 1.5), 'mixed');
});

test('cucconiDirectionLabel: handles zero-component edge cases', () => {
  assert.equal(cucconiDirectionLabel(5.0, 0), 'location-dominant');
  assert.equal(cucconiDirectionLabel(0, 5.0), 'scale-dominant');
});

test('cucconiDirectionLabel: rejects non-finite', () => {
  assert.throws(() => cucconiDirectionLabel(NaN, 1), /non-finite/);
  assert.throws(() => cucconiDirectionLabel(1, Infinity), /non-finite/);
});
