import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenAnsariBradleyHalves,
  buildDailyTokenAnsariBradleyHalves,
  ansariBradleyRanksFor,
  ansariBradleyNullMoments,
} from '../src/dailytokenansaribradleyhalves.js';
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

// ---------- primitive: rank generator ----------

test('ansariBradleyRanksFor: even n folds symmetrically', () => {
  assert.deepEqual(ansariBradleyRanksFor(8), [1, 2, 3, 4, 4, 3, 2, 1]);
  assert.deepEqual(ansariBradleyRanksFor(10), [1, 2, 3, 4, 5, 5, 4, 3, 2, 1]);
});

test('ansariBradleyRanksFor: odd n has unique median rank', () => {
  assert.deepEqual(ansariBradleyRanksFor(9), [1, 2, 3, 4, 5, 4, 3, 2, 1]);
  assert.deepEqual(ansariBradleyRanksFor(11), [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]);
});

test('ansariBradleyRanksFor: even-n sum = n(n+2)/4', () => {
  for (const n of [8, 10, 12, 16, 30]) {
    const ranks = ansariBradleyRanksFor(n);
    const s = ranks.reduce((a, b) => a + b, 0);
    assert.equal(s, (n * (n + 2)) / 4, `n=${n} sum=${s}`);
  }
});

test('ansariBradleyRanksFor: odd-n sum = (n+1)^2/4', () => {
  for (const n of [9, 11, 13, 17, 31]) {
    const ranks = ansariBradleyRanksFor(n);
    const s = ranks.reduce((a, b) => a + b, 0);
    assert.equal(s, ((n + 1) * (n + 1)) / 4, `n=${n} sum=${s}`);
  }
});

test('ansariBradleyRanksFor: rejects n < 2', () => {
  assert.throws(() => ansariBradleyRanksFor(1), /n must be an integer >= 2/);
  assert.throws(() => ansariBradleyRanksFor(0), /n must be an integer >= 2/);
  assert.throws(() => ansariBradleyRanksFor(2.5), /n must be an integer >= 2/);
});

// ---------- primitive: null moments ----------

test('ansariBradleyNullMoments: even n=8 closed-form', () => {
  // n=8, n1=n2=4: mean = 4*10/4 = 10; var = 4*4*10*6/(48*7) = 960/336 = 2.857142857...
  const { mean, variance } = ansariBradleyNullMoments(4, 4);
  assert.equal(mean, 10);
  assert.ok(Math.abs(variance - 960 / 336) < 1e-12, `var=${variance}`);
});

test('ansariBradleyNullMoments: odd n=9 closed-form', () => {
  // n=9, n1=4, n2=5: mean = 4*100/(4*9) = 400/36 = 11.111...
  // var = 4*5*10*84/(48*81) = 16800/3888 = 4.32098765...
  const { mean, variance } = ansariBradleyNullMoments(4, 5);
  assert.ok(Math.abs(mean - 400 / 36) < 1e-12);
  assert.ok(Math.abs(variance - 16800 / 3888) < 1e-12);
});

test('ansariBradleyNullMoments: rejects n1<1 or n2<1', () => {
  assert.throws(() => ansariBradleyNullMoments(0, 5), /n1 must be an integer >= 1/);
  assert.throws(() => ansariBradleyNullMoments(5, 0), /n2 must be an integer >= 1/);
  assert.throws(() => ansariBradleyNullMoments(2.5, 5), /n1 must be an integer >= 1/);
});

// ---------- primitive: input validation ----------

test('dailyTokenAnsariBradleyHalves: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenAnsariBradleyHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenAnsariBradleyHalves: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenAnsariBradleyHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenAnsariBradleyHalves([1, Infinity, 3, 4, 5, 6, 7, 8]),
    /finite values/,
  );
});

test('dailyTokenAnsariBradleyHalves: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenAnsariBradleyHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: split sizes ----------

test('dailyTokenAnsariBradleyHalves: even n splits evenly', () => {
  const r = dailyTokenAnsariBradleyHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.abN1, 4);
  assert.equal(r.abN2, 4);
  assert.equal(r.nSamples, 8);
});

test('dailyTokenAnsariBradleyHalves: odd n puts middle into second half', () => {
  const r = dailyTokenAnsariBradleyHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.abN1, 4);
  assert.equal(r.abN2, 5);
});

// ---------- primitive: invariances ----------

test('dailyTokenAnsariBradleyHalves: shift-invariant (abZ)', () => {
  const x = [1, 5, 2, 4, 9, 11, 3, 17];
  const r1 = dailyTokenAnsariBradleyHalves(x);
  const r2 = dailyTokenAnsariBradleyHalves(x.map((v) => v + 1000));
  assert.ok(
    Math.abs(r1.abZ - r2.abZ) < 1e-9,
    `abZ shift drift ${r1.abZ} vs ${r2.abZ}`,
  );
  assert.ok(Math.abs(r1.abWA - r2.abWA) < 1e-9);
});

test('dailyTokenAnsariBradleyHalves: positive-scale-invariant (abZ)', () => {
  const x = [1, 5, 2, 4, 9, 11, 3, 17];
  const r1 = dailyTokenAnsariBradleyHalves(x);
  const r2 = dailyTokenAnsariBradleyHalves(x.map((v) => 7 * v));
  assert.ok(
    Math.abs(r1.abZ - r2.abZ) < 1e-9,
    `abZ pos-scale drift ${r1.abZ} vs ${r2.abZ}`,
  );
});

test('dailyTokenAnsariBradleyHalves: negation-invariant (abZ)', () => {
  // The folded rank vector is symmetric about its centre.
  // After median-centring, negating x reverses the pooled
  // sort but each ORIGINAL element ends up at the mirror
  // position, which has the SAME folded rank by symmetry.
  const x = [1, 5, 2, 4, 9, 11, 3, 17];
  const r1 = dailyTokenAnsariBradleyHalves(x);
  const r2 = dailyTokenAnsariBradleyHalves(x.map((v) => -v));
  assert.ok(
    Math.abs(r1.abZ - r2.abZ) < 1e-9,
    `abZ negation drift ${r1.abZ} vs ${r2.abZ}`,
  );
});

// ---------- primitive: moment formulas hold ----------

test('dailyTokenAnsariBradleyHalves: abMean and abVar match closed-form', () => {
  for (const n of [8, 9, 10, 11, 13, 17, 30, 31]) {
    const x = Array.from({ length: n }, (_, i) => (i % 3) * (i + 1) + i * 0.7);
    const r = dailyTokenAnsariBradleyHalves(x);
    const expected = ansariBradleyNullMoments(r.abN1, r.abN2);
    assert.ok(
      Math.abs(r.abMean - expected.mean) < 1e-9,
      `n=${n} abMean=${r.abMean} expected=${expected.mean}`,
    );
    assert.ok(
      Math.abs(r.abVar - expected.variance) < 1e-9,
      `n=${n} abVar=${r.abVar} expected=${expected.variance}`,
    );
  }
});

// ---------- primitive: abWA bounds ----------

test('dailyTokenAnsariBradleyHalves: abWA in [n1, n1*ceil(n/2)] (folded-rank range)', () => {
  // Min folded rank is 1; max folded rank is ceil(n/2).
  for (const n of [8, 9, 10, 11, 13, 17, 30]) {
    const x = Array.from({ length: n }, (_, i) => Math.cos(i * 0.7) + i * 0.3);
    const r = dailyTokenAnsariBradleyHalves(x);
    const lo = r.abN1; // n1 elements each with min rank 1
    const hi = r.abN1 * Math.ceil(n / 2); // n1 elements each with max rank
    assert.ok(
      r.abWA >= lo && r.abWA <= hi,
      `n=${n} abWA=${r.abWA} not in [${lo}, ${hi}]`,
    );
  }
});

// ---------- primitive: behaviour ----------

test('dailyTokenAnsariBradleyHalves: second-half-more-dispersed gives positive abZ', () => {
  // Half A tightly clustered, half B widely spread.
  const x = [
    10, 10, 11, 9, 10, 11, 9, 10,        // A: low scale around 10
    10, 100, -50, 200, -80, 150, -30, 90, // B: huge scale
  ];
  const r = dailyTokenAnsariBradleyHalves(x);
  assert.ok(r.abZ > 0, `expected positive abZ, got ${r.abZ}`);
});

test('dailyTokenAnsariBradleyHalves: first-half-more-dispersed gives negative abZ', () => {
  // Mirror of the above: half A widely spread, half B tight.
  const x = [
    10, 100, -50, 200, -80, 150, -30, 90, // A: huge scale
    10, 10, 11, 9, 10, 11, 9, 10,         // B: low scale
  ];
  const r = dailyTokenAnsariBradleyHalves(x);
  assert.ok(r.abZ < 0, `expected negative abZ, got ${r.abZ}`);
});

test('dailyTokenAnsariBradleyHalves: pure location shift yields small |abZ|', () => {
  // After median-centring, A and B are essentially identical;
  // abZ should be near 0.
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8,         // A
    101, 102, 103, 104, 105, 106, 107, 108, // B = A + 100
  ];
  const r = dailyTokenAnsariBradleyHalves(x);
  assert.ok(
    Math.abs(r.abZ) < 0.5,
    `expected small |abZ| under pure location shift, got ${r.abZ}`,
  );
});

// ---------- builder: end-to-end ----------

test('buildDailyTokenAnsariBradleyHalves: filters non-positive tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    queue.push(ql(dayIso(i), 's1', 100 * (i + 1)));
  }
  queue.push(ql(dayIso(14), 's1', 0));
  queue.push(ql(dayIso(15), 's1', -5));
  const r = buildDailyTokenAnsariBradleyHalves(queue, {
    minTokens: 0,
    minTenureDays: 8,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources.length, 1);
});

test('buildDailyTokenAnsariBradleyHalves: drops sources below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'busy', 1000 + i * 50));
    queue.push(ql(dayIso(i), 'sparse', 5));
  }
  const r = buildDailyTokenAnsariBradleyHalves(queue, {
    minTokens: 100,
    minTenureDays: 8,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'busy');
});

test('buildDailyTokenAnsariBradleyHalves: drops below min-tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'short', 1000));
  }
  const r = buildDailyTokenAnsariBradleyHalves(queue, {
    minTokens: 0,
    minTenureDays: 8,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenAnsariBradleyHalves: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    // exactly one event per day, same tokens -> after gap-fill all equal
    queue.push(ql(dayIso(i), 'flat', 100));
  }
  const r = buildDailyTokenAnsariBradleyHalves(queue, {
    minTokens: 0,
    minTenureDays: 8,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenAnsariBradleyHalves: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenAnsariBradleyHalves([], {
        sort: 'bogus' as 'abZ',
        minTenureDays: 8,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenAnsariBradleyHalves: rejects bad min-tenure', () => {
  assert.throws(
    () =>
      buildDailyTokenAnsariBradleyHalves([], {
        minTenureDays: 4,
      }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('buildDailyTokenAnsariBradleyHalves: top-k cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 12; i += 1) {
      queue.push(ql(dayIso(i), src, 100 + i * 7 + src.charCodeAt(0)));
    }
  }
  const r = buildDailyTokenAnsariBradleyHalves(queue, {
    minTokens: 0,
    minTenureDays: 8,
    top: 2,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenAnsariBradleyHalves: sort=abZAbsDesc orders by |abZ|', () => {
  const queue: QueueLine[] = [];
  // src1: dispersion grows -> large positive abZ
  // src2: roughly stable -> abZ near zero
  const grow = [10, 11, 9, 10, 11, 10, 9, 10, 200, -150, 300, -100, 250, -200, 180, -120];
  const stable = [10, 12, 9, 11, 10, 8, 13, 9, 11, 10, 12, 8, 9, 11, 10, 12];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src1', grow[i]! + 1000));
    queue.push(ql(dayIso(i), 'src2', stable[i]! + 1000));
  }
  const r = buildDailyTokenAnsariBradleyHalves(queue, {
    minTokens: 0,
    minTenureDays: 8,
    sort: 'abZAbsDesc',
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(
    Math.abs(r.sources[0]!.abZ) >= Math.abs(r.sources[1]!.abZ),
    `expected abZAbsDesc; got ${r.sources[0]!.abZ} vs ${r.sources[1]!.abZ}`,
  );
});
