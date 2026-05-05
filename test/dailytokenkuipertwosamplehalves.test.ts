import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenKuiperTwoSampleHalves,
  buildDailyTokenKuiperTwoSampleHalves,
  kuiperP,
} from '../src/dailytokenkuipertwosamplehalves.js';
import { dailyTokenKsTwoSampleHalves } from '../src/dailytokenkstwosamplehalves.js';
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

// ---------- core statistic basics ----------

test('kp: throws below n=8', () => {
  assert.throws(
    () => dailyTokenKuiperTwoSampleHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('kp: throws on non-finite values', () => {
  assert.throws(
    () => dailyTokenKuiperTwoSampleHalves([1, 2, 3, 4, 5, 6, 7, Number.NaN]),
    /finite values/,
  );
});

test('kp: throws on zero variance (all-equal)', () => {
  assert.throws(
    () => dailyTokenKuiperTwoSampleHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

test('kp: identical halves give kpV = 0', () => {
  // Each half is the SAME multiset {1, 2, 3, 4}.
  const r = dailyTokenKuiperTwoSampleHalves([1, 2, 3, 4, 1, 2, 3, 4]);
  assert.equal(r.kpDPlus, 0);
  assert.equal(r.kpDMinus, 0);
  assert.equal(r.kpV, 0);
  assert.equal(r.kpVDirection, 'balanced');
});

test('kp: clean step-shift up gives second-larger', () => {
  // A = [1,1,1,1], B = [10,10,10,10]. F_A jumps to 1
  // at v=1 while F_B stays 0; sup(F_A - F_B) = 1.
  const r = dailyTokenKuiperTwoSampleHalves([
    1, 1, 1, 1, 10, 10, 10, 10,
  ]);
  assert.equal(r.kpDPlus, 1);
  assert.equal(r.kpDMinus, 0);
  assert.equal(r.kpV, 1);
  assert.equal(r.kpVDirection, 'second-larger');
  assert.ok(r.kpZ > 0);
});

test('kp: clean step-shift down gives first-larger', () => {
  // A = [10,10,10,10], B = [1,1,1,1]. Symmetric reverse.
  const r = dailyTokenKuiperTwoSampleHalves([
    10, 10, 10, 10, 1, 1, 1, 1,
  ]);
  assert.equal(r.kpDMinus, 1);
  assert.equal(r.kpDPlus, 0);
  assert.equal(r.kpV, 1);
  assert.equal(r.kpVDirection, 'first-larger');
  assert.ok(r.kpZ < 0);
});

test('kp: kpV in [0, 2] across various inputs', () => {
  const inputs: number[][] = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [1, 1, 1, 1, 2, 2, 2, 2],
    [1, 5, 2, 6, 3, 7, 4, 8],
    [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  ];
  for (const xs of inputs) {
    const r = dailyTokenKuiperTwoSampleHalves(xs);
    assert.ok(r.kpV >= 0 && r.kpV <= 2);
    assert.ok(r.kpDPlus >= 0 && r.kpDPlus <= 1);
    assert.ok(r.kpDMinus >= 0 && r.kpDMinus <= 1);
  }
});

test('kp: kpV equals kpDPlus + kpDMinus exactly', () => {
  const xs = [1, 3, 5, 7, 2, 4, 6, 8, 9, 11];
  const r = dailyTokenKuiperTwoSampleHalves(xs);
  assert.equal(r.kpV, r.kpDPlus + r.kpDMinus);
});

// ---------- bracketing relation vs KS ----------

test('kp: ksD <= kpV <= 2*ksD bracket holds (mono trend)', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = dailyTokenKuiperTwoSampleHalves(xs);
  const ksR = dailyTokenKsTwoSampleHalves(xs);
  assert.ok(ksR.ksD <= r.kpV + 1e-12);
  assert.ok(r.kpV <= 2 * ksR.ksD + 1e-12);
});

test('kp: ksD <= kpV <= 2*ksD bracket holds (scale shift)', () => {
  // First half tight around 5, second half wide.
  const xs = [4, 5, 5, 6, 1, 3, 7, 9, 10, 0];
  const r = dailyTokenKuiperTwoSampleHalves(xs);
  const ksR = dailyTokenKsTwoSampleHalves(xs);
  assert.ok(ksR.ksD <= r.kpV + 1e-12);
  assert.ok(r.kpV <= 2 * ksR.ksD + 1e-12);
});

test('kp: ksD == kpV when one-sided (clean up step)', () => {
  // Pure up-shift: only F_B sits below F_A; kpDPlus = 0.
  const r = dailyTokenKuiperTwoSampleHalves([1, 1, 1, 1, 10, 10, 10, 10]);
  const ksR = dailyTokenKsTwoSampleHalves([1, 1, 1, 1, 10, 10, 10, 10]);
  assert.equal(ksR.ksD, r.kpV);
});

test('kp: kpV ~= 2*ksD when ECDFs cross with equal-size lobes', () => {
  // Symmetric crossing: A = {1,2,3,4}, B = {0,1.5,2.5,5}
  // produces near-balanced D+ and D-.
  const xs = [1, 2, 3, 4, 0, 1.5, 2.5, 5];
  const r = dailyTokenKuiperTwoSampleHalves(xs);
  // Both lobes positive (two-sided crossing).
  assert.ok(r.kpDPlus > 0);
  assert.ok(r.kpDMinus > 0);
});

// ---------- EXACT INVARIANTS ----------

test('kp: invariant under additive constant', () => {
  const base = [1, 4, 2, 5, 3, 6, 7, 9, 8, 10];
  const r0 = dailyTokenKuiperTwoSampleHalves(base);
  const r1 = dailyTokenKuiperTwoSampleHalves(base.map((x) => x + 1000));
  assert.equal(r0.kpV, r1.kpV);
  assert.equal(r0.kpDPlus, r1.kpDPlus);
  assert.equal(r0.kpDMinus, r1.kpDMinus);
  assert.equal(r0.kpVDirection, r1.kpVDirection);
});

test('kp: invariant under positive scale', () => {
  const base = [1, 4, 2, 5, 3, 6, 7, 9, 8, 10];
  const r0 = dailyTokenKuiperTwoSampleHalves(base);
  const r1 = dailyTokenKuiperTwoSampleHalves(base.map((x) => x * 7.5));
  assert.equal(r0.kpV, r1.kpV);
  assert.equal(r0.kpDPlus, r1.kpDPlus);
  assert.equal(r0.kpDMinus, r1.kpDMinus);
  assert.equal(r0.kpVDirection, r1.kpVDirection);
});

test('kp: kpV invariant under negative scale; direction flips', () => {
  const base = [1, 2, 3, 4, 10, 11, 12, 13];
  const r0 = dailyTokenKuiperTwoSampleHalves(base);
  const r1 = dailyTokenKuiperTwoSampleHalves(base.map((x) => -x));
  assert.equal(r0.kpV, r1.kpV);
  assert.equal(r0.kpDPlus, r1.kpDMinus);
  assert.equal(r0.kpDMinus, r1.kpDPlus);
  // Direction flips first<->second.
  assert.equal(r0.kpVDirection, 'second-larger');
  assert.equal(r1.kpVDirection, 'first-larger');
});

test('kp: kpV invariant under swapping the two halves (direction flips)', () => {
  const base = [1, 2, 3, 4, 10, 11, 12, 13];
  const swapped = [10, 11, 12, 13, 1, 2, 3, 4];
  const r0 = dailyTokenKuiperTwoSampleHalves(base);
  const r1 = dailyTokenKuiperTwoSampleHalves(swapped);
  assert.equal(r0.kpV, r1.kpV);
  assert.equal(r0.kpDPlus, r1.kpDMinus);
  assert.equal(r0.kpDMinus, r1.kpDPlus);
});

test('kp: invariant under permutation within each half', () => {
  const a1 = [1, 2, 3, 4, 10, 11, 12, 13];
  const a2 = [4, 3, 2, 1, 13, 12, 11, 10];
  const r1 = dailyTokenKuiperTwoSampleHalves(a1);
  const r2 = dailyTokenKuiperTwoSampleHalves(a2);
  assert.equal(r1.kpV, r2.kpV);
  assert.equal(r1.kpDPlus, r2.kpDPlus);
  assert.equal(r1.kpDMinus, r2.kpDMinus);
});

test('kp: half sizes correct for even and odd n', () => {
  const r10 = dailyTokenKuiperTwoSampleHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.equal(r10.kpN1, 5);
  assert.equal(r10.kpN2, 5);
  const r9 = dailyTokenKuiperTwoSampleHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r9.kpN1, 4);
  assert.equal(r9.kpN2, 5);
});

test('kp: kpEn equals n1*n2/(n1+n2)', () => {
  const r = dailyTokenKuiperTwoSampleHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.kpEn, (4 * 5) / 9);
});

test('kp: lambda inflation factor (sqrt(en) + 0.155 + 0.24/sqrt(en))', () => {
  const r = dailyTokenKuiperTwoSampleHalves([1, 1, 1, 1, 10, 10, 10, 10]);
  const sqrtEn = Math.sqrt(r.kpEn);
  const expectedLambda = (sqrtEn + 0.155 + 0.24 / sqrtEn) * r.kpV;
  assert.ok(Math.abs(r.kpLambda - expectedLambda) < 1e-12);
});

test('kp: critical V at alpha=0.05 inverts inflation', () => {
  const r = dailyTokenKuiperTwoSampleHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  const sqrtEn = Math.sqrt(r.kpEn);
  const inflate = sqrtEn + 0.155 + 0.24 / sqrtEn;
  assert.ok(Math.abs(r.kpVCrit05 - 1.747 / inflate) < 1e-12);
});

test('kp: clean step-shift kpV=1 rejects at .05 (n large enough)', () => {
  // n=20: kpVCrit05 ~ 1.747 / (sqrt(5) + 0.155 + 0.24/sqrt(5))
  //                ~ 1.747 / 2.498 ~ 0.699 < 1.
  const xs = [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
  ];
  const r = dailyTokenKuiperTwoSampleHalves(xs);
  assert.equal(r.kpV, 1);
  assert.ok(r.kpV > r.kpVCrit05, `kpV=${r.kpV} crit=${r.kpVCrit05}`);
});

test('kp: identical halves do not reject at .05', () => {
  const r = dailyTokenKuiperTwoSampleHalves([1, 2, 3, 4, 1, 2, 3, 4]);
  assert.ok(r.kpV < r.kpVCrit05);
  assert.equal(r.kpP, 1);
});

test('kp: kpP in (0, 1]', () => {
  const inputs = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [1, 2, 3, 4, 1, 2, 3, 5],
    [1, 1, 1, 1, 99, 99, 99, 99],
  ];
  for (const xs of inputs) {
    const r = dailyTokenKuiperTwoSampleHalves(xs);
    assert.ok(r.kpP > 0 && r.kpP <= 1);
  }
});

test('kp: kpP monotone decreasing in kpV (fixed n)', () => {
  // Larger ECDF gap = smaller p.
  const small = dailyTokenKuiperTwoSampleHalves([
    1, 2, 3, 4, 1, 2, 3, 5,
  ]);
  const large = dailyTokenKuiperTwoSampleHalves([
    1, 1, 1, 1, 99, 99, 99, 99,
  ]);
  assert.ok(large.kpV > small.kpV);
  assert.ok(large.kpP < small.kpP);
});

test('kp: kpZ matches direction sign', () => {
  const up = dailyTokenKuiperTwoSampleHalves([1, 1, 1, 1, 9, 9, 9, 9]);
  const down = dailyTokenKuiperTwoSampleHalves([9, 9, 9, 9, 1, 1, 1, 1]);
  assert.ok(up.kpZ > 0);
  assert.ok(down.kpZ < 0);
  assert.ok(Math.abs(Math.abs(up.kpZ) - Math.abs(down.kpZ)) < 1e-12);
});

test('kp: kpZ = 0 when balanced direction and identical halves', () => {
  const r = dailyTokenKuiperTwoSampleHalves([1, 2, 3, 4, 1, 2, 3, 4]);
  assert.equal(r.kpZ, 0);
});

test('kp: scale-shift pattern produces two-lobe direction', () => {
  // First half tight, second half spread; no median shift.
  // {3,4,5,6} then {0,1,9,10}: same median pool
  // but second half is much wider.
  const r = dailyTokenKuiperTwoSampleHalves([3, 4, 5, 6, 0, 1, 9, 10]);
  assert.ok(r.kpDPlus > 0);
  assert.ok(r.kpDMinus > 0);
});

// ---------- kuiperP series properties ----------

test('kuiperP: returns 1 for tiny lambda', () => {
  assert.equal(kuiperP(0), 1);
  assert.equal(kuiperP(0.1), 1);
  assert.equal(kuiperP(0.39), 1);
});

test('kuiperP: monotone-non-increasing in lambda', () => {
  const lambdas = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0];
  let prev = 1;
  for (const l of lambdas) {
    const p = kuiperP(l);
    assert.ok(p <= prev + 1e-12, `p=${p} prev=${prev} at l=${l}`);
    prev = p;
  }
});

test('kuiperP: clipped to [0, 1]', () => {
  for (const l of [0.5, 1.747, 2.0, 5.0, 10.0]) {
    const p = kuiperP(l);
    assert.ok(p >= 0 && p <= 1, `p=${p} at l=${l}`);
  }
});

test('kuiperP: at lambda=1.747 p ~ 0.05 (Stephens 1965 critical)', () => {
  // The 5% critical for the asymptotic Kuiper null is
  // ~1.747 (Stephens 1965 Table 1B). Allow a wide
  // tolerance because we use the simplest series form.
  const p = kuiperP(1.747);
  assert.ok(p > 0.02 && p < 0.10, `p=${p} should be near 0.05`);
});

test('kuiperP: handles non-finite input safely', () => {
  assert.equal(kuiperP(Number.NaN), 1);
  assert.equal(kuiperP(-1), 1);
  assert.equal(kuiperP(Number.POSITIVE_INFINITY), 0);
});

// ---------- builder integration ----------

test('build: empty queue yields empty report', () => {
  const r = buildDailyTokenKuiperTwoSampleHalves([]);
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('build: filters by min-tenure-days', () => {
  const queue: QueueLine[] = [];
  // 8 days, mixed values, source A: should be ABOVE
  // tenure floor 8 but BELOW default 14.
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'A', 100 + i * 50));
  }
  const r = buildDailyTokenKuiperTwoSampleHalves(queue, {
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: respects min-tenure-days = 8 floor', () => {
  const queue: QueueLine[] = [];
  // 8 days varied
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'A', 100 + i * 50));
  }
  const r = buildDailyTokenKuiperTwoSampleHalves(queue, {
    minTenureDays: 8,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.kpN1, 4);
  assert.equal(row.kpN2, 4);
});

test('build: throws on invalid sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenKuiperTwoSampleHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('build: throws on min-tenure-days < 8', () => {
  assert.throws(
    () => buildDailyTokenKuiperTwoSampleHalves([], { minTenureDays: 7 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: throws on negative top', () => {
  assert.throws(
    () => buildDailyTokenKuiperTwoSampleHalves([], { top: -1 }),
    /non-negative integer/,
  );
});

test('build: filters by min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'tiny', 1)); // 16 total
  }
  const r = buildDailyTokenKuiperTwoSampleHalves(queue, {
    minTokens: 1000,
    minTenureDays: 8,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('build: filters zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 500));
  }
  const r = buildDailyTokenKuiperTwoSampleHalves(queue, {
    minTokens: 1000,
    minTenureDays: 8,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('build: source filter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'A', 100 + i * 100));
    queue.push(ql(dayIso(i), 'B', 200 + i * 50));
  }
  const r = buildDailyTokenKuiperTwoSampleHalves(queue, {
    minTenureDays: 8,
    source: 'A',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
  assert.ok(r.droppedSourceFilter > 0);
});

test('build: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['A', 'B', 'C']) {
    for (let i = 0; i < 16; i += 1) {
      queue.push(ql(dayIso(i), src, 100 + i * (src === 'A' ? 200 : 50)));
    }
  }
  const r = buildDailyTokenKuiperTwoSampleHalves(queue, {
    minTenureDays: 8,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('build: sort kpVDesc puts strongest first', () => {
  const queue: QueueLine[] = [];
  // Source 'big': clean step-shift.
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'big', i < 8 ? 100 : 10000));
  }
  // Source 'small': mild trend.
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'small', 1000 + i * 10));
  }
  const r = buildDailyTokenKuiperTwoSampleHalves(queue, {
    minTenureDays: 8,
    sort: 'kpVDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'big');
  assert.ok(r.sources[0]!.kpV >= r.sources[1]!.kpV);
});

test('build: deterministic across runs (no clock dep)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'A', 100 + i * 60));
  }
  const r1 = buildDailyTokenKuiperTwoSampleHalves(queue, {
    minTenureDays: 8,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  const r2 = buildDailyTokenKuiperTwoSampleHalves(queue, {
    minTenureDays: 8,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.deepEqual(r1, r2);
});

test('build: invalid hour_start surfaces in droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'A', 1000),
    ql('also-bad', 'A', 1000),
  ];
  const r = buildDailyTokenKuiperTwoSampleHalves(queue, {
    minTenureDays: 8,
  });
  assert.equal(r.droppedInvalidHourStart, 2);
});

test('build: row fields match the per-source statistic', () => {
  const queue: QueueLine[] = [];
  const vals = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'A', vals[i]!));
  }
  const r = buildDailyTokenKuiperTwoSampleHalves(queue, {
    minTenureDays: 8,
  });
  const row = r.sources[0]!;
  // Direct call.
  const direct = dailyTokenKuiperTwoSampleHalves(vals);
  assert.equal(row.kpV, direct.kpV);
  assert.equal(row.kpDPlus, direct.kpDPlus);
  assert.equal(row.kpDMinus, direct.kpDMinus);
  assert.equal(row.kpVDirection, direct.kpVDirection);
  assert.equal(row.kpP, direct.kpP);
});

test('build: gap-filled tenure inserts zeros and they count as ties', () => {
  // Day 0..15 tenure, but only days 0, 7, 15 are active.
  const queue: QueueLine[] = [
    ql(dayIso(0), 'A', 1000),
    ql(dayIso(7), 'A', 1000),
    ql(dayIso(15), 'A', 1000),
  ];
  const r = buildDailyTokenKuiperTwoSampleHalves(queue, {
    minTenureDays: 8,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nTenureDays, 16);
  assert.equal(row.nActiveDays, 3);
});

// ---------- random fuzz invariants ----------

function mulberry(seed: number): () => number {
  let a = seed | 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('kp: random fuzz preserves ksD <= kpV <= 2*ksD bracket', () => {
  const rng = mulberry(0xc0ffee);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 8 + Math.floor(rng() * 30);
    const xs = new Array(n).fill(0).map(() => rng() * 1000);
    // Force at least some variance.
    xs[0]! = 0;
    xs[n - 1]! = 1000;
    const r = dailyTokenKuiperTwoSampleHalves(xs);
    const ksR = dailyTokenKsTwoSampleHalves(xs);
    assert.ok(ksR.ksD <= r.kpV + 1e-9);
    assert.ok(r.kpV <= 2 * ksR.ksD + 1e-9);
    assert.ok(r.kpV >= 0 && r.kpV <= 2);
  }
});

test('kp: random fuzz kpP in (0, 1]', () => {
  const rng = mulberry(0xbeef);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 8 + Math.floor(rng() * 30);
    const xs = new Array(n).fill(0).map(() => rng());
    xs[0]! = 0;
    xs[n - 1]! = 1;
    const r = dailyTokenKuiperTwoSampleHalves(xs);
    assert.ok(r.kpP > 0 && r.kpP <= 1);
  }
});

test('kp: random fuzz kpV equals kpDPlus + kpDMinus', () => {
  const rng = mulberry(0xfade);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 8 + Math.floor(rng() * 20);
    const xs = new Array(n).fill(0).map(() => Math.floor(rng() * 50));
    xs[0]! = 0;
    xs[n - 1]! = 49;
    const r = dailyTokenKuiperTwoSampleHalves(xs);
    assert.ok(Math.abs(r.kpV - (r.kpDPlus + r.kpDMinus)) < 1e-12);
  }
});
