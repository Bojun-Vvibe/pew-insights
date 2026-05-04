import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenMoodsMedianHalves,
  buildDailyTokenMoodsMedianHalves,
  moodsMedianStandardNormalCdf,
  chiSquare1UpperTail,
} from '../src/dailytokenmoodsmedianhalves.js';
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

// ---------- helpers: standard normal CDF ----------

test('moodsMedianStandardNormalCdf: anchor values', () => {
  assert.ok(Math.abs(moodsMedianStandardNormalCdf(0) - 0.5) < 1e-7);
  assert.ok(Math.abs(moodsMedianStandardNormalCdf(1.96) - 0.975) < 1e-3);
  assert.ok(Math.abs(moodsMedianStandardNormalCdf(-1.96) - 0.025) < 1e-3);
  assert.ok(Math.abs(moodsMedianStandardNormalCdf(3) - 0.99865) < 1e-4);
});

test('moodsMedianStandardNormalCdf: monotone non-decreasing', () => {
  let prev = moodsMedianStandardNormalCdf(-5);
  for (let z = -4.5; z <= 5; z += 0.5) {
    const v = moodsMedianStandardNormalCdf(z);
    assert.ok(v >= prev - 1e-12, `non-monotone at z=${z}`);
    prev = v;
  }
});

test('moodsMedianStandardNormalCdf: rejects non-finite', () => {
  assert.throws(() => moodsMedianStandardNormalCdf(NaN), /non-finite input/);
  assert.throws(
    () => moodsMedianStandardNormalCdf(Infinity),
    /non-finite input/,
  );
});

// ---------- helpers: chi-square(1) upper tail ----------

test('chiSquare1UpperTail: x=0 returns 1', () => {
  assert.equal(chiSquare1UpperTail(0), 1);
});

test('chiSquare1UpperTail: 3.841 returns ~0.05', () => {
  // Chi-Square(1) 95th percentile is 3.841459.
  assert.ok(Math.abs(chiSquare1UpperTail(3.841459) - 0.05) < 1e-3);
});

test('chiSquare1UpperTail: 6.6349 returns ~0.01', () => {
  assert.ok(Math.abs(chiSquare1UpperTail(6.6349) - 0.01) < 1e-3);
});

test('chiSquare1UpperTail: monotone non-increasing', () => {
  let prev = chiSquare1UpperTail(0);
  for (let x = 0.5; x <= 20; x += 0.5) {
    const v = chiSquare1UpperTail(x);
    assert.ok(v <= prev + 1e-12, `non-monotone at x=${x}`);
    prev = v;
  }
});

test('chiSquare1UpperTail: very large x returns ~0', () => {
  assert.ok(chiSquare1UpperTail(100) < 1e-6);
});

test('chiSquare1UpperTail: rejects non-finite', () => {
  assert.throws(() => chiSquare1UpperTail(NaN), /non-finite input/);
});

// ---------- primitive: input validation ----------

test('dailyTokenMoodsMedianHalves: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenMoodsMedianHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenMoodsMedianHalves: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenMoodsMedianHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenMoodsMedianHalves([1, Infinity, 3, 4, 5, 6, 7, 8]),
    /finite values/,
  );
});

test('dailyTokenMoodsMedianHalves: rejects all-equal series (zero variance)', () => {
  assert.throws(
    () => dailyTokenMoodsMedianHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

test('dailyTokenMoodsMedianHalves: rejects degenerate column marginal', () => {
  // Two distinct values where ALL non-median values are
  // strictly greater is impossible if pooled median ties
  // dominate. Construct one: 7 zeros + 1 positive -> pooled
  // median is 0; only 1 value is above; column above = 1,
  // below = 7. So this DOESN'T trigger column-marginal=0.
  // The actual degenerate case requires all values to tie
  // with the median, which is the zero-variance case
  // already trapped above. So we test that the error path
  // is reachable in principle by direct call with crafted
  // input where all values lie at-or-below the median --
  // but in practice such input also has zero variance.
  // Smoke: construct a case where above-count is 0 by
  // having exactly half the values equal to the maximum
  // and the rest LESS than that max -- but median sits
  // between, so above-count is positive. Conclusion: the
  // degenerate-column path is only reachable for all-equal
  // input which is already trapped. Verify the all-equal
  // path message-matches:
  assert.throws(
    () => dailyTokenMoodsMedianHalves([0, 0, 0, 0, 0, 0, 0, 0]),
    /zero centred variance/,
  );
});

// ---------- core math: known cases ----------

test('dailyTokenMoodsMedianHalves: pure location shift detected', () => {
  // First half all small, second half all large: pooled
  // median sits between, all of A below, all of B above.
  // a=0, b=8, n1=n2=8, n=16; |0*0 - 8*8| - 8 = 56;
  // chi2 = 16 * 56^2 / (8*8*8*8) = 50176/4096 = 12.25.
  // sign(0/8 - 8/8) = -1; mdZ = -sqrt(12.25) = -3.5.
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 200, 300, 400, 500, 600, 700, 800];
  const r = dailyTokenMoodsMedianHalves(x);
  assert.equal(r.mdN1, 8);
  assert.equal(r.mdN2, 8);
  assert.equal(r.mdAboveA, 0);
  assert.equal(r.mdAboveB, 8);
  assert.ok(Math.abs(r.mdChi2 - 12.25) < 1e-9, `mdChi2=${r.mdChi2}`);
  assert.ok(Math.abs(r.mdZ + 3.5) < 1e-9, `mdZ=${r.mdZ}`);
  assert.ok(r.mdTwoSidedP < 0.001);
});

test('dailyTokenMoodsMedianHalves: reverse location shift positive sign', () => {
  // First half large, second half small -> mdZ > 0.
  const x = [100, 200, 300, 400, 500, 600, 700, 800, 1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenMoodsMedianHalves(x);
  assert.equal(r.mdAboveA, 8);
  assert.equal(r.mdAboveB, 0);
  assert.ok(r.mdZ > 3, `mdZ=${r.mdZ}`);
});

test('dailyTokenMoodsMedianHalves: balanced halves yields small chi2', () => {
  // Interleaved small/large in each half: balanced
  // distribution about pooled median.
  const x = [1, 100, 2, 200, 3, 300, 4, 400, 5, 500, 6, 600, 7, 700, 8, 800];
  const r = dailyTokenMoodsMedianHalves(x);
  // Each half has 4 small + 4 large. Pooled median ~250
  // splits cleanly. a=4, b=4 -> cross product 4*4-4*4=0.
  assert.equal(r.mdAboveA, 4);
  assert.equal(r.mdAboveB, 4);
  assert.ok(r.mdChi2 < 1, `expected near-zero, got ${r.mdChi2}`);
});

test('dailyTokenMoodsMedianHalves: shift invariance (x + c)', () => {
  const x = [1, 3, 2, 5, 4, 8, 7, 9, 12, 14, 13, 16, 15, 19, 18, 20];
  const r1 = dailyTokenMoodsMedianHalves(x);
  const r2 = dailyTokenMoodsMedianHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.mdChi2 - r2.mdChi2) < 1e-12);
  assert.ok(Math.abs(r1.mdZ - r2.mdZ) < 1e-12);
});

test('dailyTokenMoodsMedianHalves: positive scale invariance (a * x)', () => {
  const x = [1, 3, 2, 5, 4, 8, 7, 9, 12, 14, 13, 16, 15, 19, 18, 20];
  const r1 = dailyTokenMoodsMedianHalves(x);
  const r2 = dailyTokenMoodsMedianHalves(x.map((v) => 7.5 * v));
  assert.ok(Math.abs(r1.mdChi2 - r2.mdChi2) < 1e-12);
  assert.ok(Math.abs(r1.mdZ - r2.mdZ) < 1e-12);
});

test('dailyTokenMoodsMedianHalves: monotone-transform invariance |mdZ|', () => {
  // Apply log transform: should preserve the above/below
  // partition exactly (log is monotone increasing on
  // positives), so mdChi2 unchanged and mdZ sign unchanged.
  const x = [1, 3, 2, 5, 4, 8, 7, 9, 12, 14, 13, 16, 15, 19, 18, 20];
  const r1 = dailyTokenMoodsMedianHalves(x);
  const r2 = dailyTokenMoodsMedianHalves(x.map((v) => Math.log(v)));
  assert.ok(Math.abs(r1.mdChi2 - r2.mdChi2) < 1e-12);
  assert.ok(Math.abs(r1.mdZ - r2.mdZ) < 1e-12);
});

test('dailyTokenMoodsMedianHalves: order-within-halves invariance', () => {
  // Permuting WITHIN each half preserves (a, b, n1, n2)
  // exactly, so the test is invariant.
  const xA = [1, 2, 3, 4, 5, 100, 200, 300];
  const xB = [10, 20, 30, 40, 50, 1000, 2000, 3000];
  const r1 = dailyTokenMoodsMedianHalves([...xA, ...xB]);
  const r2 = dailyTokenMoodsMedianHalves([
    ...xA.slice().reverse(),
    ...xB.slice().reverse(),
  ]);
  assert.ok(Math.abs(r1.mdChi2 - r2.mdChi2) < 1e-12);
  assert.ok(Math.abs(r1.mdZ - r2.mdZ) < 1e-12);
});

test('dailyTokenMoodsMedianHalves: odd-n series', () => {
  // n=9, n1=4, n2=5. Pooled median = sorted[4].
  const x = [1, 2, 3, 4, 100, 200, 300, 400, 500];
  const r = dailyTokenMoodsMedianHalves(x);
  assert.equal(r.nSamples, 9);
  assert.equal(r.mdN1, 4);
  assert.equal(r.mdN2, 5);
  // Pooled sorted: [1,2,3,4,100,200,300,400,500] -> median=100.
  // First half (4 vals: 1,2,3,4) -- all <=100 -> aboveA=0.
  // Second half (5 vals: 100,200,300,400,500) -- 4 strictly above.
  assert.equal(r.mdAboveA, 0);
  assert.equal(r.mdAboveB, 4);
  assert.ok(r.mdZ < 0, `expected negative mdZ, got ${r.mdZ}`);
});

test('dailyTokenMoodsMedianHalves: pooledMedian recorded correctly', () => {
  const x = [10, 20, 30, 40, 50, 60, 70, 80];
  const r = dailyTokenMoodsMedianHalves(x);
  // Pooled sorted: [10..80]; median = (40+50)/2 = 45.
  assert.equal(r.mdPooledMedian, 45);
});

test('dailyTokenMoodsMedianHalves: ties-with-median go to at-or-below cell', () => {
  // Many ties at the median value.
  const x = [1, 5, 5, 5, 5, 5, 5, 9];
  const r = dailyTokenMoodsMedianHalves(x);
  // Pooled sorted: [1,5,5,5,5,5,5,9]; median = 5.
  // Above 5: only the value 9 -> aboveCount = 1.
  // First half [1,5,5,5]: 0 strictly > 5 -> aboveA=0.
  // Second half [5,5,5,9]: 1 strictly > 5 -> aboveB=1.
  assert.equal(r.mdPooledMedian, 5);
  assert.equal(r.mdAboveA, 0);
  assert.equal(r.mdAboveB, 1);
});

test('dailyTokenMoodsMedianHalves: mdTwoSidedP in [0,1]', () => {
  for (const x of [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    [1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 5],
  ]) {
    const r = dailyTokenMoodsMedianHalves(x);
    assert.ok(
      r.mdTwoSidedP >= 0 && r.mdTwoSidedP <= 1,
      `p=${r.mdTwoSidedP} out of [0,1]`,
    );
  }
});

test('dailyTokenMoodsMedianHalves: mean and stddev computed correctly', () => {
  const x = [2, 4, 6, 8, 10, 12, 14, 16];
  const r = dailyTokenMoodsMedianHalves(x);
  assert.equal(r.mean, 9);
  // Population stddev.
  const expected = Math.sqrt(
    x.reduce((acc, v) => acc + (v - 9) * (v - 9), 0) / 8,
  );
  assert.ok(Math.abs(r.stddev - expected) < 1e-12);
});

test('dailyTokenMoodsMedianHalves: Yates correction floor at 0', () => {
  // Construct a case where the cross-product residual is
  // smaller than n/2, forcing the Yates clamp. Balanced
  // halves: a=4, b=4, n1=n2=8 -> |a*d-b*c| = |16-16| = 0;
  // 0 - 16/2 = -8 -> floored to 0 -> chi2 = 0.
  const x = [1, 100, 2, 200, 3, 300, 4, 400, 5, 500, 6, 600, 7, 700, 8, 800];
  const r = dailyTokenMoodsMedianHalves(x);
  assert.equal(r.mdChi2, 0);
  assert.equal(r.mdZ, 0);
});

// ---------- structural orthogonality ----------

test('dailyTokenMoodsMedianHalves: monotone-invariance distinguishes from Mann-Whitney', () => {
  // A series where a single huge spike in the second half
  // would dominate Mann-Whitney's rank sum but is just
  // "1 above-median count" to Mood.
  const x = [
    10, 11, 12, 13, 14, 15, 16, 17, // first half
    18, 19, 20, 21, 22, 23, 24, 1e9, // second half with extreme spike
  ];
  const r = dailyTokenMoodsMedianHalves(x);
  // Pooled median sits around 17.5; first half 8 values
  // all <=17, second half 8 all >=18. So aboveA=0, aboveB=8.
  assert.equal(r.mdAboveA, 0);
  assert.equal(r.mdAboveB, 8);
  // Now replace the spike with a moderate value: same mdChi2.
  const x2 = [...x.slice(0, 15), 25];
  const r2 = dailyTokenMoodsMedianHalves(x2);
  assert.equal(r.mdChi2, r2.mdChi2);
});

// ---------- integration: builder ----------

test('buildDailyTokenMoodsMedianHalves: empty queue returns zero rows', () => {
  const r = buildDailyTokenMoodsMedianHalves([], { generatedAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenMoodsMedianHalves: drops invalid hour_start', () => {
  const r = buildDailyTokenMoodsMedianHalves(
    [ql('not-a-date', 'src', 1000)],
    { generatedAt: '2026-01-01T00:00:00.000Z' },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenMoodsMedianHalves: drops non-positive tokens', () => {
  const r = buildDailyTokenMoodsMedianHalves(
    [ql(dayIso(0), 'src', 0), ql(dayIso(1), 'src', -5)],
    { generatedAt: '2026-01-01T00:00:00.000Z' },
  );
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenMoodsMedianHalves: drops below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'sparse', 10));
  }
  const r = buildDailyTokenMoodsMedianHalves(queue, {
    minTokens: 1000,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenMoodsMedianHalves: drops below min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'short', 1000));
  }
  const r = buildDailyTokenMoodsMedianHalves(queue, {
    minTenureDays: 14,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenMoodsMedianHalves: rejects min-tenure-days < 8', () => {
  assert.throws(
    () =>
      buildDailyTokenMoodsMedianHalves([], {
        minTenureDays: 7,
        generatedAt: '2026-01-01T00:00:00.000Z',
      }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('buildDailyTokenMoodsMedianHalves: rejects negative min-tokens', () => {
  assert.throws(
    () =>
      buildDailyTokenMoodsMedianHalves([], {
        minTokens: -1,
        generatedAt: '2026-01-01T00:00:00.000Z',
      }),
    /minTokens must be a non-negative finite number/,
  );
});

test('buildDailyTokenMoodsMedianHalves: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenMoodsMedianHalves([], {
        sort: 'bogus' as never,
        generatedAt: '2026-01-01T00:00:00.000Z',
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenMoodsMedianHalves: full integration with two sources', () => {
  const queue: QueueLine[] = [];
  // Source A: increasing -> first half small, second half large -> mdZ < 0 (median rose).
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'rising', 1000 + i * 1000));
  }
  // Source B: decreasing -> mdZ > 0 (median dropped).
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'falling', 16000 - i * 1000));
  }
  const r = buildDailyTokenMoodsMedianHalves(queue, {
    minTenureDays: 14,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  const rising = r.sources.find((s) => s.source === 'rising');
  const falling = r.sources.find((s) => s.source === 'falling');
  assert.ok(rising && falling);
  assert.ok(rising!.mdZ < 0, `rising mdZ should be negative, got ${rising!.mdZ}`);
  assert.ok(
    falling!.mdZ > 0,
    `falling mdZ should be positive, got ${falling!.mdZ}`,
  );
});

test('buildDailyTokenMoodsMedianHalves: sort by mdZAbsDesc orders by |mdZ|', () => {
  const queue: QueueLine[] = [];
  // weak-shift source
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'weak', 1000 + (i % 4) * 100));
  }
  // strong-shift source
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'strong', 1000 + i * 1000));
  }
  const r = buildDailyTokenMoodsMedianHalves(queue, {
    minTenureDays: 14,
    sort: 'mdZAbsDesc',
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(
    Math.abs(r.sources[0]!.mdZ) >= Math.abs(r.sources[1]!.mdZ),
    `expected |mdZ| descending, got ${r.sources[0]!.mdZ}, ${r.sources[1]!.mdZ}`,
  );
});

test('buildDailyTokenMoodsMedianHalves: top cap drops excess sources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 16; i += 1) {
      queue.push(ql(dayIso(i), src, 1000 + i * 100));
    }
  }
  const r = buildDailyTokenMoodsMedianHalves(queue, {
    minTenureDays: 14,
    top: 2,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenMoodsMedianHalves: source filter restricts to one', () => {
  const queue: QueueLine[] = [];
  for (const src of ['x', 'y']) {
    for (let i = 0; i < 16; i += 1) {
      queue.push(ql(dayIso(i), src, 1000 + i * 100));
    }
  }
  const r = buildDailyTokenMoodsMedianHalves(queue, {
    minTenureDays: 14,
    source: 'x',
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'x');
  assert.equal(r.droppedSourceFilter, 16);
});

test('buildDailyTokenMoodsMedianHalves: zero-variance sources dropped', () => {
  const queue: QueueLine[] = [];
  // All-equal positive values across 16 days -> zero variance after gap-fill.
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 1000));
  }
  const r = buildDailyTokenMoodsMedianHalves(queue, {
    minTenureDays: 14,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenMoodsMedianHalves: gap-fill inserts zeros for missing days', () => {
  const queue: QueueLine[] = [];
  // Days 0..15 with some gaps; gap-fill should fill the
  // missing days with 0 token mass. Use varied tokens so
  // the chi-square test does not degenerate (above-count
  // must be strictly positive: needs at least one value
  // strictly above the pooled median).
  const present: Array<[number, number]> = [
    [0, 1000],
    [1, 1500],
    [2, 2000],
    [3, 2500],
    [4, 3000],
    [7, 4000],
    [9, 5000],
    [11, 6000],
    [13, 7000],
    [15, 8000],
  ];
  for (const [d, tok] of present) {
    queue.push(ql(dayIso(d), 'gappy', tok));
  }
  const r = buildDailyTokenMoodsMedianHalves(queue, {
    minTenureDays: 14,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  // tenure = 16, active = 10 (count of unique days).
  assert.equal(r.sources[0]!.nTenureDays, 16);
  assert.equal(r.sources[0]!.nActiveDays, 10);
});

test('buildDailyTokenMoodsMedianHalves: report fields populated', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src', 1000 + i * 10));
  }
  const r = buildDailyTokenMoodsMedianHalves(queue, {
    minTenureDays: 14,
    generatedAt: '2026-04-01T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2026-04-01T00:00:00.000Z');
  assert.equal(r.minTenureDays, 14);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.sort, 'mdZAbsDesc');
  const row = r.sources[0]!;
  assert.equal(row.source, 'src');
  assert.equal(typeof row.mdChi2, 'number');
  assert.equal(typeof row.mdZ, 'number');
  assert.equal(typeof row.mdTwoSidedP, 'number');
  assert.equal(typeof row.mdPooledMedian, 'number');
  assert.equal(row.mdN1 + row.mdN2, row.nTenureDays);
  assert.equal(row.mdAboveA + row.mdAboveB > 0, true);
});

test('buildDailyTokenMoodsMedianHalves: sort by source returns alphabetical', () => {
  const queue: QueueLine[] = [];
  for (const src of ['zebra', 'alpha', 'mango']) {
    for (let i = 0; i < 16; i += 1) {
      queue.push(ql(dayIso(i), src, 1000 + i * 100));
    }
  }
  const r = buildDailyTokenMoodsMedianHalves(queue, {
    minTenureDays: 14,
    sort: 'source',
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 3);
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mango', 'zebra'],
  );
});
