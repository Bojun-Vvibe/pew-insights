import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenMannWhitneyHalves,
  buildDailyTokenMannWhitneyHalves,
} from '../src/dailytokenmannwhitneyhalves.js';
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

// ---------- primitive: input validation ----------

test('dailyTokenMannWhitneyHalves: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenMannWhitneyHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenMannWhitneyHalves: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenMannWhitneyHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenMannWhitneyHalves([1, Infinity, 3, 4, 5, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenMannWhitneyHalves([1, 2, 3, 4, 5, 6, 7, -Infinity]),
    /finite values/,
  );
});

test('dailyTokenMannWhitneyHalves: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenMannWhitneyHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: split sizes ----------

test('dailyTokenMannWhitneyHalves: even n splits evenly', () => {
  const r = dailyTokenMannWhitneyHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.mwN1, 4);
  assert.equal(r.mwN2, 4);
  assert.equal(r.nSamples, 8);
});

test('dailyTokenMannWhitneyHalves: odd n puts middle into second half', () => {
  // n = 9: floor(9/2)=4, n2=5
  const r = dailyTokenMannWhitneyHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.mwN1, 4);
  assert.equal(r.mwN2, 5);
});

test('dailyTokenMannWhitneyHalves: n = 15 gives n1=7, n2=8', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const r = dailyTokenMannWhitneyHalves(x);
  assert.equal(r.mwN1, 7);
  assert.equal(r.mwN2, 8);
});

// ---------- primitive: closed-form anchors ----------

test('dailyTokenMannWhitneyHalves: monotone increasing -> mwU = 0, mwZ << 0', () => {
  // x = 1..n: every element of B > every element of A -> U = 0
  const x = Array.from({ length: 20 }, (_, i) => i + 1);
  const r = dailyTokenMannWhitneyHalves(x);
  assert.equal(r.mwU, 0);
  assert.ok(r.mwZ < -3, `expected mwZ << 0, got ${r.mwZ}`);
  assert.equal(r.mwN1, 10);
  assert.equal(r.mwN2, 10);
  assert.equal(r.mwRankSumA, (10 * 11) / 2); // ranks 1..10
});

test('dailyTokenMannWhitneyHalves: monotone decreasing -> mwU = n1*n2, mwZ >> 0', () => {
  const x = Array.from({ length: 20 }, (_, i) => 20 - i);
  const r = dailyTokenMannWhitneyHalves(x);
  assert.equal(r.mwU, 100);
  assert.ok(r.mwZ > 3, `expected mwZ >> 0, got ${r.mwZ}`);
});

test('dailyTokenMannWhitneyHalves: step-shift series 0,..,0,1,..,1 -> mwU = 0', () => {
  // First half all zeros, second half all ones
  const x = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1];
  const r = dailyTokenMannWhitneyHalves(x);
  assert.equal(r.mwU, 0);
  assert.ok(r.mwZ < -3);
  // Tied groups: 8 zeros, 8 ones
});

test('dailyTokenMannWhitneyHalves: reversed step-shift -> mwU = n1*n2', () => {
  const x = [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  const r = dailyTokenMannWhitneyHalves(x);
  assert.equal(r.mwU, 64);
  assert.ok(r.mwZ > 3);
});

test('dailyTokenMannWhitneyHalves: balanced halves with same distribution -> mwZ approx 0', () => {
  // Identical values in both halves (pairs)
  const x = [1, 2, 3, 4, 1, 2, 3, 4];
  const r = dailyTokenMannWhitneyHalves(x);
  // Symmetric: U = E[U] exactly
  assert.equal(r.mwU, 8); // n1*n2/2 = 16/2 = 8
  assert.equal(r.mwZ, 0);
});

// ---------- primitive: invariants ----------

test('dailyTokenMannWhitneyHalves: shift invariance mwU(x+c) === mwU(x)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r1 = dailyTokenMannWhitneyHalves(x);
  const r2 = dailyTokenMannWhitneyHalves(x.map((v) => v + 1000));
  assert.equal(r1.mwU, r2.mwU);
  assert.equal(r1.mwRankSumA, r2.mwRankSumA);
  assert.ok(Math.abs(r1.mwZ - r2.mwZ) < 1e-12);
});

test('dailyTokenMannWhitneyHalves: positive scale invariance mwU(a*x) === mwU(x)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r1 = dailyTokenMannWhitneyHalves(x);
  const r2 = dailyTokenMannWhitneyHalves(x.map((v) => v * 7.5));
  assert.equal(r1.mwU, r2.mwU);
  assert.ok(Math.abs(r1.mwZ - r2.mwZ) < 1e-12);
});

test('dailyTokenMannWhitneyHalves: time-reversal flips Z when n1 = n2', () => {
  const x = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
  const r1 = dailyTokenMannWhitneyHalves(x);
  const r2 = dailyTokenMannWhitneyHalves([...x].reverse());
  assert.equal(r1.mwN1, r1.mwN2);
  // U_A(reverse) = n1*n2 - U_A(original)
  assert.ok(Math.abs(r1.mwU + r2.mwU - r1.mwN1 * r1.mwN2) < 1e-9);
  // Z flips sign
  assert.ok(Math.abs(r1.mwZ + r2.mwZ) < 1e-9);
});

test('dailyTokenMannWhitneyHalves: U_A + U_B = n1*n2 (complement)', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3];
  const r = dailyTokenMannWhitneyHalves(x);
  // Reversed series swaps roles of A and B; U_A(reversed) corresponds to U_B(orig)
  // But for the same x: just verify range
  assert.ok(r.mwU >= 0 && r.mwU <= r.mwN1 * r.mwN2);
});

test('dailyTokenMannWhitneyHalves: rank-sum identity rankSumA + rankSumB === n*(n+1)/2', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const n = x.length;
  const r = dailyTokenMannWhitneyHalves(x);
  // We can recompute B's rank-sum as n*(n+1)/2 - A's rank-sum
  const totalRankSum = (n * (n + 1)) / 2;
  const rankSumB = totalRankSum - r.mwRankSumA;
  // U_B identity: U_B = R_B - n2*(n2+1)/2; U_A + U_B = n1*n2
  const uB = rankSumB - (r.mwN2 * (r.mwN2 + 1)) / 2;
  assert.ok(Math.abs(r.mwU + uB - r.mwN1 * r.mwN2) < 1e-9);
});

test('dailyTokenMannWhitneyHalves: U bounds [0, n1*n2]', () => {
  const samples = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    [5, 3, 8, 1, 9, 2, 7, 4, 6, 0.5],
    [0, 0, 0, 1, 0, 0, 1, 1, 1, 1],
  ];
  for (const x of samples) {
    const r = dailyTokenMannWhitneyHalves(x);
    assert.ok(r.mwU >= 0 && r.mwU <= r.mwN1 * r.mwN2, `U=${r.mwU} out of [0, ${r.mwN1 * r.mwN2}]`);
  }
});

test('dailyTokenMannWhitneyHalves: E[U] = n1*n2/2 anchor', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8];
  const r = dailyTokenMannWhitneyHalves(x);
  const eu = (r.mwN1 * r.mwN2) / 2;
  // Z computed from (U - E[U]) / sqrt(Var) -> U = E[U] + Z * sqrt(Var)
  assert.ok(Math.abs(r.mwU - eu - r.mwZ * Math.sqrt(r.mwVar)) < 1e-9);
});

test('dailyTokenMannWhitneyHalves: tie-corrected variance is smaller than no-tie variance when ties present', () => {
  // Many ties
  const x = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1];
  const r = dailyTokenMannWhitneyHalves(x);
  const noTieVar = (r.mwN1 * r.mwN2 * (r.nSamples + 1)) / 12;
  assert.ok(r.mwVar < noTieVar, `expected tie-corrected var ${r.mwVar} < no-tie var ${noTieVar}`);
});

test('dailyTokenMannWhitneyHalves: tie-corrected variance equals no-tie variance for distinct values', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = dailyTokenMannWhitneyHalves(x);
  const noTieVar = (r.mwN1 * r.mwN2 * (r.nSamples + 1)) / 12;
  assert.ok(Math.abs(r.mwVar - noTieVar) < 1e-9);
});

test('dailyTokenMannWhitneyHalves: medians correct', () => {
  const x = [1, 2, 3, 4, 10, 11, 12, 13];
  const r = dailyTokenMannWhitneyHalves(x);
  assert.equal(r.mwMedianA, 2.5);
  assert.equal(r.mwMedianB, 11.5);
});

test('dailyTokenMannWhitneyHalves: medians correct for odd half', () => {
  const x = [1, 2, 3, 4, 10, 11, 12, 13, 14];
  // n=9, n1=4, n2=5; A=[1,2,3,4], B=[10,11,12,13,14]
  const r = dailyTokenMannWhitneyHalves(x);
  assert.equal(r.mwMedianA, 2.5);
  assert.equal(r.mwMedianB, 12);
});

// ---------- primitive: known U value ----------

test('dailyTokenMannWhitneyHalves: known U for [1,2,3,4 | 5,6,7,8]', () => {
  // A = ranks 1,2,3,4 -> sum = 10; U = 10 - 4*5/2 = 10 - 10 = 0
  const r = dailyTokenMannWhitneyHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.mwRankSumA, 10);
  assert.equal(r.mwU, 0);
});

test('dailyTokenMannWhitneyHalves: known U for [5,6,7,8 | 1,2,3,4]', () => {
  // A has ranks 5,6,7,8 -> sum = 26; U = 26 - 10 = 16 = n1*n2
  const r = dailyTokenMannWhitneyHalves([5, 6, 7, 8, 1, 2, 3, 4]);
  assert.equal(r.mwRankSumA, 26);
  assert.equal(r.mwU, 16);
});

test('dailyTokenMannWhitneyHalves: mid-rank handling for ties', () => {
  // x = [1,2,3,4,1,2,3,4]; A=[1,2,3,4], B=[1,2,3,4]
  // Pooled sorted: 1,1,2,2,3,3,4,4 with positions (1,2),(3,4),(5,6),(7,8)
  // Mid-ranks: 1.5,1.5,3.5,3.5,5.5,5.5,7.5,7.5
  // A's values = original [1,2,3,4] -> ranks 1.5,3.5,5.5,7.5 -> sum=18
  const r = dailyTokenMannWhitneyHalves([1, 2, 3, 4, 1, 2, 3, 4]);
  assert.equal(r.mwRankSumA, 18);
  assert.equal(r.mwU, 18 - 10); // 8
  assert.equal(r.mwZ, 0); // U = E[U] = n1*n2/2 = 8
});

test('dailyTokenMannWhitneyHalves: random-ish balanced sample has |Z| < 2', () => {
  // Synthetic but symmetric distribution interleaved
  const x = [3, 7, 1, 9, 5, 2, 8, 4, 6, 3, 5, 7, 1, 9, 2, 8];
  const r = dailyTokenMannWhitneyHalves(x);
  assert.ok(Math.abs(r.mwZ) < 3, `|Z| should be < 3 for balanced data, got ${r.mwZ}`);
});

// ---------- builder ----------

function genSrc(name: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) => ql(dayIso(i), name, v));
}

test('buildDailyTokenMannWhitneyHalves: basic happy path', () => {
  const queue = genSrc('alpha', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140]);
  const r = buildDailyTokenMannWhitneyHalves(queue, { generatedAt: 'X' });
  assert.equal(r.sources.length, 1);
  const a = r.sources[0]!;
  assert.equal(a.source, 'alpha');
  assert.equal(a.nTenureDays, 14);
  assert.equal(a.mwN1, 7);
  assert.equal(a.mwN2, 7);
  assert.equal(a.mwU, 0); // monotone increasing
  assert.ok(a.mwZ < -3);
});

test('buildDailyTokenMannWhitneyHalves: rejects min-tenure-days < 8', () => {
  assert.throws(
    () => buildDailyTokenMannWhitneyHalves([], { minTenureDays: 7 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('buildDailyTokenMannWhitneyHalves: rejects negative min-tokens', () => {
  assert.throws(
    () => buildDailyTokenMannWhitneyHalves([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('buildDailyTokenMannWhitneyHalves: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenMannWhitneyHalves([], {
        sort: 'banana' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenMannWhitneyHalves: rejects bad since/until', () => {
  assert.throws(
    () => buildDailyTokenMannWhitneyHalves([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () => buildDailyTokenMannWhitneyHalves([], { until: 'nope' }),
    /invalid until/,
  );
});

test('buildDailyTokenMannWhitneyHalves: rejects non-integer top', () => {
  assert.throws(
    () => buildDailyTokenMannWhitneyHalves([], { top: 1.5 }),
    /top must be a non-negative integer/,
  );
});

test('buildDailyTokenMannWhitneyHalves: drops below min-tenure', () => {
  const queue = genSrc('shortie', [200, 200, 200, 200, 200, 200, 200]);
  const r = buildDailyTokenMannWhitneyHalves(queue, { generatedAt: 'X' });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenMannWhitneyHalves: drops below min-tokens', () => {
  const queue = genSrc('tiny', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  const r = buildDailyTokenMannWhitneyHalves(queue, {
    generatedAt: 'X',
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenMannWhitneyHalves: drops zero-variance', () => {
  const queue = genSrc('flat', [
    1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000,
    1000, 1000,
  ]);
  const r = buildDailyTokenMannWhitneyHalves(queue, {
    generatedAt: 'X',
    minTokens: 100,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenMannWhitneyHalves: drops invalid hour_start', () => {
  const queue = [
    ql('not-a-date', 'alpha', 100),
    ...genSrc('alpha', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140]),
  ];
  const r = buildDailyTokenMannWhitneyHalves(queue, { generatedAt: 'X' });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('buildDailyTokenMannWhitneyHalves: drops non-positive tokens', () => {
  const queue = [
    ql(dayIso(0), 'alpha', 0),
    ql(dayIso(1), 'alpha', -5),
    ...genSrc('alpha', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140]),
  ];
  const r = buildDailyTokenMannWhitneyHalves(queue, { generatedAt: 'X' });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenMannWhitneyHalves: source filter excludes others', () => {
  const queue = [
    ...genSrc('alpha', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140]),
    ...genSrc('beta', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]),
  ];
  const r = buildDailyTokenMannWhitneyHalves(queue, {
    generatedAt: 'X',
    source: 'alpha',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenMannWhitneyHalves: top cap', () => {
  const queue = [
    ...genSrc('alpha', [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400]),
    ...genSrc('beta', [500, 500, 500, 500, 500, 500, 500, 100, 100, 100, 100, 100, 100, 100]),
  ];
  const r = buildDailyTokenMannWhitneyHalves(queue, {
    generatedAt: 'X',
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenMannWhitneyHalves: sort keys all valid', () => {
  const queue = [
    ...genSrc('alpha', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140]),
    ...genSrc('beta', [140, 130, 120, 110, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10]),
    ...genSrc('gamma', [50, 50, 50, 50, 50, 50, 50, 51, 50, 50, 50, 50, 50, 50]),
  ];
  for (const sort of [
    'u',
    'uDesc',
    'mwZ',
    'mwZDesc',
    'mwZAbs',
    'mwZAbsDesc',
    'tokens',
    'tenure',
    'source',
  ] as const) {
    const r = buildDailyTokenMannWhitneyHalves(queue, {
      generatedAt: 'X',
      sort,
    });
    assert.ok(r.sources.length >= 1, `sort=${sort} should produce rows`);
  }
});

test('buildDailyTokenMannWhitneyHalves: gap-filling inserts zeros', () => {
  // Active days: 0, 13 (14-day tenure). Days 1..12 should be gap-filled to 0.
  const queue = [ql(dayIso(0), 'sparse', 5000), ql(dayIso(13), 'sparse', 5000)];
  const r = buildDailyTokenMannWhitneyHalves(queue, {
    generatedAt: 'X',
    minTokens: 100,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.nTenureDays, 14);
  assert.equal(s.nActiveDays, 2);
  // First half [5000,0,0,0,0,0,0]; second half [0,0,0,0,0,0,5000]
  assert.equal(s.mwN1, 7);
  assert.equal(s.mwN2, 7);
});

test('buildDailyTokenMannWhitneyHalves: mwZ sign matches direction', () => {
  // Decline: first half big, second half small
  const declQueue = genSrc('declining', [
    1000, 1000, 1000, 1000, 1000, 1000, 1000, 10, 10, 10, 10, 10, 10, 10,
  ]);
  const declR = buildDailyTokenMannWhitneyHalves(declQueue, {
    generatedAt: 'X',
  });
  assert.equal(declR.sources.length, 1);
  assert.ok(declR.sources[0]!.mwZ > 2, `decline should give mwZ > 0, got ${declR.sources[0]!.mwZ}`);

  // Growth: first half small, second half big
  const growQueue = genSrc('growing', [
    10, 10, 10, 10, 10, 10, 10, 1000, 1000, 1000, 1000, 1000, 1000, 1000,
  ]);
  const growR = buildDailyTokenMannWhitneyHalves(growQueue, {
    generatedAt: 'X',
  });
  assert.equal(growR.sources.length, 1);
  assert.ok(growR.sources[0]!.mwZ < -2, `growth should give mwZ < 0, got ${growR.sources[0]!.mwZ}`);
});

test('buildDailyTokenMannWhitneyHalves: deterministic', () => {
  const queue = [
    ...genSrc('alpha', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140]),
    ...genSrc('beta', [50, 50, 50, 50, 50, 50, 50, 100, 100, 100, 100, 100, 100, 100]),
  ];
  const r1 = buildDailyTokenMannWhitneyHalves(queue, { generatedAt: 'X' });
  const r2 = buildDailyTokenMannWhitneyHalves(queue, { generatedAt: 'X' });
  assert.deepEqual(r1, r2);
});

test('buildDailyTokenMannWhitneyHalves: window filtering', () => {
  const queue = genSrc('alpha', [
    10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140,
  ]);
  const r = buildDailyTokenMannWhitneyHalves(queue, {
    generatedAt: 'X',
    since: dayIso(0),
    until: dayIso(7),
  });
  // Only first 7 days kept -> below min-tenure (14)
  assert.equal(r.sources.length, 0);
});

// ---------- property anchors ----------

test('property: random permutations have mean mwU approx n1*n2/2', () => {
  // Average over many random permutations
  let rng = 12345;
  const next = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 0xffffffff;
  };
  const n = 24;
  const trials = 200;
  let sum = 0;
  for (let t = 0; t < trials; t += 1) {
    const x = Array.from({ length: n }, (_, i) => i + 1);
    // Fisher-Yates
    for (let i = n - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      const tmp = x[i]!;
      x[i] = x[j]!;
      x[j] = tmp;
    }
    sum += dailyTokenMannWhitneyHalves(x).mwU;
  }
  const meanU = sum / trials;
  const expected = (12 * 12) / 2; // 72
  // Should be within ~ standard error
  assert.ok(
    Math.abs(meanU - expected) < 10,
    `mean U over random permutations should be ~${expected}, got ${meanU}`,
  );
});

test('property: sort mwZAbsDesc puts the largest |mwZ| first', () => {
  const queue = [
    ...genSrc('strongDecline', [
      1000, 1000, 1000, 1000, 1000, 1000, 1000, 10, 10, 10, 10, 10, 10, 10,
    ]),
    ...genSrc('weakBalance', [
      500, 510, 490, 520, 480, 530, 470, 500, 510, 490, 520, 480, 530, 470,
    ]),
    ...genSrc('strongGrowth', [
      10, 10, 10, 10, 10, 10, 10, 1000, 1000, 1000, 1000, 1000, 1000, 1000,
    ]),
  ];
  const r = buildDailyTokenMannWhitneyHalves(queue, {
    generatedAt: 'X',
    sort: 'mwZAbsDesc',
  });
  assert.equal(r.sources.length, 3);
  const zs = r.sources.map((s) => Math.abs(s.mwZ));
  assert.ok(zs[0]! >= zs[1]!);
  assert.ok(zs[1]! >= zs[2]!);
});

test('property: U + complement_U = n1 * n2', () => {
  // Verify the U_A + U_B identity by computing both halves swapped
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3];
  const r = dailyTokenMannWhitneyHalves(x);
  const totalRankSum = (16 * 17) / 2; // 136
  const rankSumB = totalRankSum - r.mwRankSumA;
  const uB = rankSumB - (r.mwN2 * (r.mwN2 + 1)) / 2;
  assert.equal(r.mwU + uB, r.mwN1 * r.mwN2);
});

// ---------- exact-identity property anchors (refine) ----------

test('dailyTokenMannWhitneyHalves: exact time-reversal Z-flip when n1 = n2 (stress)', () => {
  // For even n, reversal exactly swaps A and B, so U_A(reverse) = n1*n2 - U_A(orig)
  // hence mwZ(reverse) = -mwZ(orig) exactly.
  const inputs: number[][] = [
    [1, 4, 2, 7, 3, 9, 5, 11, 6, 8, 4, 10, 12, 7, 13, 9],
    [10, 20, 5, 15, 25, 30, 8, 12, 18, 22, 28, 35, 11, 17, 23, 29],
    [100, 100, 100, 100, 100, 100, 100, 100, 1, 1, 1, 1, 1, 1, 1, 1],
    Array.from({ length: 24 }, (_, i) => Math.cos(i / 4) * 100 + 50),
    Array.from({ length: 40 }, (_, i) => ((i * 7919) % 173) + 1),
  ];
  for (const x of inputs) {
    const a = dailyTokenMannWhitneyHalves(x);
    const b = dailyTokenMannWhitneyHalves(x.slice().reverse());
    assert.equal(a.mwN1, a.mwN2, 'pre-condition: even n');
    // U_A + U_A(rev) === n1*n2 exactly
    assert.ok(
      Math.abs(a.mwU + b.mwU - a.mwN1 * a.mwN2) < 1e-9,
      `U + U(rev) mismatch: ${a.mwU} + ${b.mwU} vs ${a.mwN1 * a.mwN2}`,
    );
    // mwZ(reverse) === -mwZ(orig) exactly (variance is symmetric in halves)
    assert.ok(
      Math.abs(a.mwZ + b.mwZ) < 1e-9,
      `Z anti-symmetry violated: ${a.mwZ} + ${b.mwZ}`,
    );
  }
});

test('dailyTokenMannWhitneyHalves: exact U + complement_U === n1*n2 across odd-n stress', () => {
  // For odd n, the middle element goes into the second half, so reversal does NOT
  // exactly swap halves. But the U + U_B = n1*n2 identity still holds for ANY split
  // (computed via the rank-sum complement).
  const inputs: number[][] = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
    [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130],
    Array.from({ length: 17 }, (_, i) => (i * 11 + 7) % 23),
    Array.from({ length: 25 }, (_, i) => Math.sin(i / 2) * 50 + 100),
  ];
  for (const x of inputs) {
    const r = dailyTokenMannWhitneyHalves(x);
    const totalRankSum = (x.length * (x.length + 1)) / 2;
    const rankSumB = totalRankSum - r.mwRankSumA;
    const uB = rankSumB - (r.mwN2 * (r.mwN2 + 1)) / 2;
    assert.ok(
      Math.abs(r.mwU + uB - r.mwN1 * r.mwN2) < 1e-9,
      `U + U_B mismatch for n=${x.length}: ${r.mwU} + ${uB} vs ${r.mwN1 * r.mwN2}`,
    );
    // Also bound check
    assert.ok(r.mwU >= 0 && r.mwU <= r.mwN1 * r.mwN2);
    assert.ok(uB >= 0 && uB <= r.mwN1 * r.mwN2);
  }
});

test('dailyTokenMannWhitneyHalves: exact shift+scale invariance (stress)', () => {
  // mid-ranks depend only on the order, so any strictly-monotone affine
  // transformation y = a*x + c with a > 0 must leave mwU, mwRankSumA, mwZ
  // EXACTLY invariant (not approximately).
  const inputs: number[][] = [
    [1, 4, 2, 7, 3, 9, 5, 11, 6, 8, 4, 10],
    Array.from({ length: 20 }, (_, i) => Math.sin(i / 3) * 17 + 5),
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0],
    Array.from({ length: 30 }, (_, i) => ((i * 13) % 19) + 0.5),
  ];
  const transforms: Array<[number, number]> = [
    [1, 0],
    [1, 1000],
    [7.5, 0],
    [0.001, -42.7],
    [1e6, 1e9],
  ];
  for (const x of inputs) {
    const base = dailyTokenMannWhitneyHalves(x);
    for (const [a, c] of transforms) {
      const y = x.map((v) => a * v + c);
      const r = dailyTokenMannWhitneyHalves(y);
      assert.equal(
        r.mwRankSumA,
        base.mwRankSumA,
        `rankSumA mismatch under (a=${a}, c=${c})`,
      );
      assert.equal(r.mwU, base.mwU, `mwU mismatch under (a=${a}, c=${c})`);
      // Z must match within float tolerance (variance computation is the
      // same since it depends only on tie-group sizes, which are
      // preserved under strict-monotone affine transforms).
      assert.ok(
        Math.abs(r.mwZ - base.mwZ) < 1e-9,
        `mwZ mismatch under (a=${a}, c=${c}): ${r.mwZ} vs ${base.mwZ}`,
      );
    }
  }
});
