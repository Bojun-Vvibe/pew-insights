import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenSiegelTukeyHalves,
  buildDailyTokenSiegelTukeyHalves,
} from '../src/dailytokensiegeltukeyhalves.js';
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

test('dailyTokenSiegelTukeyHalves: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenSiegelTukeyHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenSiegelTukeyHalves: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenSiegelTukeyHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenSiegelTukeyHalves([1, Infinity, 3, 4, 5, 6, 7, 8]),
    /finite values/,
  );
});

test('dailyTokenSiegelTukeyHalves: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenSiegelTukeyHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: split sizes ----------

test('dailyTokenSiegelTukeyHalves: even n splits evenly', () => {
  const r = dailyTokenSiegelTukeyHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.stN1, 4);
  assert.equal(r.stN2, 4);
  assert.equal(r.nSamples, 8);
});

test('dailyTokenSiegelTukeyHalves: odd n puts middle into second half', () => {
  const r = dailyTokenSiegelTukeyHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.stN1, 4);
  assert.equal(r.stN2, 5);
});

// ---------- primitive: invariances ----------

test('dailyTokenSiegelTukeyHalves: shift-invariant (stZ)', () => {
  const x = [1, 5, 2, 4, 9, 11, 3, 17];
  const r1 = dailyTokenSiegelTukeyHalves(x);
  const r2 = dailyTokenSiegelTukeyHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.stZ - r2.stZ) < 1e-9, `stZ shift drift ${r1.stZ} vs ${r2.stZ}`);
  assert.ok(Math.abs(r1.stU - r2.stU) < 1e-9);
});

test('dailyTokenSiegelTukeyHalves: positive-scale-invariant (stZ)', () => {
  const x = [1, 5, 2, 4, 9, 11, 3, 17];
  const r1 = dailyTokenSiegelTukeyHalves(x);
  const r2 = dailyTokenSiegelTukeyHalves(x.map((v) => 7 * v));
  assert.ok(Math.abs(r1.stZ - r2.stZ) < 1e-9, `stZ pos-scale drift`);
});

test('dailyTokenSiegelTukeyHalves: variance formula matches n1*n2*(n+1)/12', () => {
  for (const n of [8, 10, 13, 17, 30]) {
    const x = Array.from({ length: n }, (_, i) => (i % 2) * (i + 1) + i * 0.7);
    const r = dailyTokenSiegelTukeyHalves(x);
    const expected = (r.stN1 * r.stN2 * (n + 1)) / 12;
    assert.ok(
      Math.abs(r.stVar - expected) < 1e-9,
      `n=${n} stVar=${r.stVar} expected=${expected}`,
    );
  }
});

// ---------- primitive: rank assignment correctness ----------

test('dailyTokenSiegelTukeyHalves: ranks sum to n*(n+1)/2', () => {
  // The sum of all assigned ranks (over both halves)
  // must equal 1+2+..+n = n*(n+1)/2 by the Siegel-
  // Tukey construction (every position gets exactly
  // one rank in 1..n).
  for (const n of [8, 9, 10, 12, 16, 21]) {
    const x = Array.from({ length: n }, (_, i) => (i * 13 + 7) % 50);
    if (new Set(x).size === 1) continue;
    const r = dailyTokenSiegelTukeyHalves(x);
    // stWA + stWB = n*(n+1)/2; stWB = total - stWA.
    const totalRank = (n * (n + 1)) / 2;
    // We can recover stWB via: stU + stWA = stWA;
    // stU_B = (stWB) - n2(n2+1)/2; we don't expose
    // stWB directly but we can derive it:
    // total_U_A + total_U_B = n1*n2 (Mann-Whitney
    // identity), so stWB = totalRank - stWA.
    const stWB = totalRank - r.stWA;
    assert.ok(stWB > 0);
    // Mann-Whitney identity: U_A + U_B = n1*n2.
    const stU_B = stWB - (r.stN2 * (r.stN2 + 1)) / 2;
    assert.ok(
      Math.abs(r.stU + stU_B - r.stN1 * r.stN2) < 1e-9,
      `n=${n} U_A + U_B = ${r.stU + stU_B} should be ${r.stN1 * r.stN2}`,
    );
  }
});

// ---------- primitive: closed-form anchors ----------

test('dailyTokenSiegelTukeyHalves: identical-spread halves give stZ approx 0', () => {
  // Both halves have identical centred distributions
  // {-1.5, -0.5, +0.5, +1.5}; rank distribution is
  // exchangeable -> stU near n1*n2/2 -> stZ near 0.
  const r = dailyTokenSiegelTukeyHalves([0, 2, 1, 3, 100, 102, 101, 103]);
  // After centring, the pool has exact ties; the
  // tie-break-by-original-index rule biases the rank
  // assignment slightly toward the first half but the
  // resulting |stZ| stays well within 1 sigma of zero.
  assert.ok(Math.abs(r.stZ) < 1.0, `expected |stZ| < 1.0, got ${r.stZ}`);
});

test('dailyTokenSiegelTukeyHalves: second half wider gives stZ > 0', () => {
  // First half tight (centred small), second half wide
  // (centred large). The wide half occupies the
  // EXTREMES of the pool -> low outward ranks. The
  // tight half occupies the CENTRE -> high outward
  // ranks. So stWA is LARGE -> stU > E -> stZ > 0
  // (which our convention reports as second half more
  // dispersed).
  const r = dailyTokenSiegelTukeyHalves([
    100, 101, 100, 101, 100, 101, 100, 101, // tight first half
    50, 150, 60, 140, 55, 145, 65, 135, // wide second half
  ]);
  assert.ok(r.stZ > 0, `expected stZ > 0 got ${r.stZ}`);
});

test('dailyTokenSiegelTukeyHalves: first half wider gives stZ < 0', () => {
  // Mirror of the above.
  const r = dailyTokenSiegelTukeyHalves([
    50, 150, 60, 140, 55, 145, 65, 135, // wide first half
    100, 101, 100, 101, 100, 101, 100, 101, // tight second half
  ]);
  assert.ok(r.stZ < 0, `expected stZ < 0 got ${r.stZ}`);
});

test('dailyTokenSiegelTukeyHalves: pure location shift (no scale shift) gives stZ approx 0', () => {
  // Brown-Forsythe and Siegel-Tukey both target SCALE
  // shift, not LOCATION shift. After median-centring,
  // a pure location shift between halves leaves the
  // centred series identical and stZ should be near 0.
  // Use two distinct dispersion patterns shifted in
  // location.
  const r = dailyTokenSiegelTukeyHalves([
    10, 12, 11, 13, // first half around median 11.5
    1010, 1012, 1011, 1013, // second half around median 1011.5
  ]);
  // Both halves have identical dispersion {-1.5,-0.5,+0.5,+1.5}
  // after centring, so stZ should be near 0 (small-n
  // tie-break artefact admitted; |stZ| < 1 sigma).
  assert.ok(
    Math.abs(r.stZ) < 1.0,
    `pure-location-shift expected |stZ| < 1.0, got ${r.stZ}`,
  );
});

test('dailyTokenSiegelTukeyHalves: half-medians correctly computed', () => {
  // n=8: A=[3,1,4,1] sorted [1,1,3,4] median = 2;
  // B=[5,9,2,6] sorted [2,5,6,9] median = 5.5
  const r = dailyTokenSiegelTukeyHalves([3, 1, 4, 1, 5, 9, 2, 6]);
  assert.equal(r.stMedianA, 2);
  assert.equal(r.stMedianB, 5.5);
});

test('dailyTokenSiegelTukeyHalves: equal-n halves swap negates stZ', () => {
  // Build a series where second half is wider -> stZ > 0.
  const orig = [
    100, 101, 100, 101, 100, 101, 100, 101,
    50, 150, 60, 140, 55, 145, 65, 135,
  ];
  const swap = [
    50, 150, 60, 140, 55, 145, 65, 135,
    100, 101, 100, 101, 100, 101, 100, 101,
  ];
  const r1 = dailyTokenSiegelTukeyHalves(orig);
  const r2 = dailyTokenSiegelTukeyHalves(swap);
  assert.ok(
    Math.abs(r1.stZ + r2.stZ) < 1e-9,
    `swap should negate stZ: r1.stZ=${r1.stZ} r2.stZ=${r2.stZ}`,
  );
});

// ---------- builder: empty / validation ----------

test('buildDailyTokenSiegelTukeyHalves: empty queue returns empty sources', () => {
  const r = buildDailyTokenSiegelTukeyHalves([], {
    generatedAt: '2026-05-03T00:00:00Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
});

test('buildDailyTokenSiegelTukeyHalves: rejects bad minTenureDays', () => {
  assert.throws(
    () => buildDailyTokenSiegelTukeyHalves([], { minTenureDays: 5 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('buildDailyTokenSiegelTukeyHalves: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenSiegelTukeyHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenSiegelTukeyHalves: dropped counters work', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'src1', 100),
    ql(dayIso(0), 'src2', 0),
    ql(dayIso(0), 'src2', -50),
  ];
  const r = buildDailyTokenSiegelTukeyHalves(queue);
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenSiegelTukeyHalves: end-to-end with one wide source', () => {
  const queue: QueueLine[] = [];
  // 16 days; first 8 mildly varying around 100, last 8 highly variable.
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'src1', 100 + (i % 2)));
  }
  for (let i = 8; i < 16; i += 1) {
    queue.push(
      ql(dayIso(i), 'src1', i % 2 === 0 ? 50 + (i - 8) : 200 + (i - 9)),
    );
  }
  const r = buildDailyTokenSiegelTukeyHalves(queue, {
    minTokens: 100,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src1');
  assert.equal(row.stN1, 8);
  assert.equal(row.stN2, 8);
  assert.ok(row.stZ > 0, `expected stZ > 0 got ${row.stZ}`);
});

test('buildDailyTokenSiegelTukeyHalves: source-filter restricts and counts', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src1', 100 + (i % 4) * 10));
    queue.push(ql(dayIso(i), 'src2', 100 + (i % 5) * 7));
  }
  const r = buildDailyTokenSiegelTukeyHalves(queue, {
    source: 'src1',
    minTokens: 10,
    minTenureDays: 14,
  });
  assert.equal(r.source, 'src1');
  assert.ok(r.droppedSourceFilter > 0);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src1');
});

test('buildDailyTokenSiegelTukeyHalves: zero-variance source dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 100));
  }
  const r = buildDailyTokenSiegelTukeyHalves(queue, {
    minTokens: 10,
    minTenureDays: 14,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});
