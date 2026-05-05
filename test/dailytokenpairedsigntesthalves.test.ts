import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenPairedSignTestHalves,
  buildDailyTokenPairedSignTestHalves,
  binomialHalfPmf,
  binomialHalfCdfLower,
  binomialHalfCdfUpper,
  binomialHalfTwoSidedP,
  pairedSignTestDecision,
} from '../src/dailytokenpairedsigntesthalves.js';
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

// ---------- pairedSignTestDecision ----------

test('pst: decision highly-significant at .0005', () => {
  assert.equal(pairedSignTestDecision(0.0005), 'highly-significant');
  assert.equal(pairedSignTestDecision(0.001), 'highly-significant');
});

test('pst: decision very-significant at .005', () => {
  assert.equal(pairedSignTestDecision(0.005), 'very-significant');
  assert.equal(pairedSignTestDecision(0.01), 'very-significant');
});

test('pst: decision significant at .03', () => {
  assert.equal(pairedSignTestDecision(0.03), 'significant');
  assert.equal(pairedSignTestDecision(0.05), 'significant');
});

test('pst: decision marginal at .08', () => {
  assert.equal(pairedSignTestDecision(0.08), 'marginal');
  assert.equal(pairedSignTestDecision(0.10), 'marginal');
});

test('pst: decision ns above .10', () => {
  assert.equal(pairedSignTestDecision(0.11), 'ns');
  assert.equal(pairedSignTestDecision(0.5), 'ns');
  assert.equal(pairedSignTestDecision(1.0), 'ns');
});

test('pst: decision throws on out-of-range', () => {
  assert.throws(() => pairedSignTestDecision(-0.01), /\[0, 1\]/);
  assert.throws(() => pairedSignTestDecision(1.01), /\[0, 1\]/);
  assert.throws(() => pairedSignTestDecision(NaN), /\[0, 1\]/);
});

// ---------- binomialHalfPmf ----------

test('pst: binomialHalfPmf small exact', () => {
  // Bin(4, 0.5) PMF = [1,4,6,4,1]/16.
  assert.ok(Math.abs(binomialHalfPmf(4, 0) - 1 / 16) < 1e-12);
  assert.ok(Math.abs(binomialHalfPmf(4, 1) - 4 / 16) < 1e-12);
  assert.ok(Math.abs(binomialHalfPmf(4, 2) - 6 / 16) < 1e-12);
  assert.ok(Math.abs(binomialHalfPmf(4, 3) - 4 / 16) < 1e-12);
  assert.ok(Math.abs(binomialHalfPmf(4, 4) - 1 / 16) < 1e-12);
});

test('pst: binomialHalfPmf sums to 1', () => {
  for (const n of [1, 5, 10, 30, 100]) {
    let s = 0;
    for (let k = 0; k <= n; k += 1) s += binomialHalfPmf(n, k);
    assert.ok(Math.abs(s - 1) < 1e-10, `n=${n} sum=${s}`);
  }
});

test('pst: binomialHalfPmf out-of-range returns 0', () => {
  assert.equal(binomialHalfPmf(10, -1), 0);
  assert.equal(binomialHalfPmf(10, 11), 0);
});

// ---------- binomialHalfCdfLower / Upper ----------

test('pst: cdfLower full range', () => {
  // Bin(10, .5): P(X<=5) ≈ 0.6230...
  const v = binomialHalfCdfLower(10, 5);
  assert.ok(Math.abs(v - 0.623046875) < 1e-9, `got ${v}`);
});

test('pst: cdfLower endpoints', () => {
  assert.equal(binomialHalfCdfLower(10, -1), 0);
  assert.equal(binomialHalfCdfLower(10, 10), 1);
  assert.equal(binomialHalfCdfLower(10, 100), 1);
});

test('pst: cdfUpper symmetry of Bin(N, .5)', () => {
  for (const n of [10, 25, 50]) {
    for (let k = 0; k <= n; k += 1) {
      const lo = binomialHalfCdfLower(n, k);
      const up = binomialHalfCdfUpper(n, n - k);
      // Pr(X <= k) == Pr(X >= n-k) by symmetry.
      assert.ok(Math.abs(lo - up) < 1e-12, `n=${n} k=${k} lo=${lo} up=${up}`);
    }
  }
});

// ---------- binomialHalfTwoSidedP ----------

test('pst: twoSidedP at the mean is 1', () => {
  assert.equal(binomialHalfTwoSidedP(10, 5), 1);
  assert.equal(binomialHalfTwoSidedP(20, 10), 1);
});

test('pst: twoSidedP at extremes equals 2 * (.5)^n', () => {
  // For n=10, sPlus=10: pTwoSided = Pr(X<=0)+Pr(X>=10) = 2/1024.
  const p = binomialHalfTwoSidedP(10, 10);
  assert.ok(Math.abs(p - 2 / 1024) < 1e-12, `got ${p}`);
  const p2 = binomialHalfTwoSidedP(10, 0);
  assert.ok(Math.abs(p2 - 2 / 1024) < 1e-12, `got ${p2}`);
});

test('pst: twoSidedP symmetric around n/2', () => {
  for (const n of [10, 20, 33]) {
    for (let k = 0; k <= n; k += 1) {
      const a = binomialHalfTwoSidedP(n, k);
      const b = binomialHalfTwoSidedP(n, n - k);
      assert.ok(Math.abs(a - b) < 1e-12, `n=${n} k=${k} a=${a} b=${b}`);
    }
  }
});

test('pst: twoSidedP <= 1 always', () => {
  for (const n of [1, 5, 12, 50]) {
    for (let k = 0; k <= n; k += 1) {
      const p = binomialHalfTwoSidedP(n, k);
      assert.ok(p >= 0 && p <= 1 + 1e-12, `n=${n} k=${k} p=${p}`);
    }
  }
});

// ---------- dailyTokenPairedSignTestHalves ----------

test('pst: stat throws on n<16', () => {
  assert.throws(
    () => dailyTokenPairedSignTestHalves([1, 2, 3, 4, 5, 6, 7, 8]),
    /at least 16/,
  );
});

test('pst: stat throws on non-finite values', () => {
  const v = Array.from({ length: 16 }, (_, i) => (i === 5 ? NaN : i + 1));
  assert.throws(
    () => dailyTokenPairedSignTestHalves(v),
    /finite values/,
  );
});

test('pst: large clean positive shift gives sPlus=half, tiny p, positive Z', () => {
  // First half ~10, second half ~100. Every paired diff strongly positive.
  const v = [
    10, 11, 12, 13, 14, 15, 16, 17, // first half (8 vals)
    100, 110, 120, 130, 140, 150, 160, 170, // second half (8 vals)
  ];
  const r = dailyTokenPairedSignTestHalves(v);
  assert.equal(r.nPairs, 8);
  assert.equal(r.nNonZero, 8);
  assert.equal(r.sPlus, 8);
  assert.equal(r.sMinus, 0);
  assert.equal(r.piPlus, 1);
  assert.equal(r.delta, 1);
  assert.ok(r.z > 0, `z=${r.z}`);
  assert.ok(r.pTwoSided < 0.01, `pTwoSided=${r.pTwoSided}`);
  assert.ok(Math.abs(r.pTwoSided - 2 / 256) < 1e-12, `pTwoSided=${r.pTwoSided}`);
});

test('pst: large clean negative shift gives sPlus=0, tiny p, negative Z', () => {
  const v = [
    100, 110, 120, 130, 140, 150, 160, 170,
    10, 11, 12, 13, 14, 15, 16, 17,
  ];
  const r = dailyTokenPairedSignTestHalves(v);
  assert.equal(r.sPlus, 0);
  assert.equal(r.sMinus, 8);
  assert.equal(r.piPlus, 0);
  assert.equal(r.delta, -1);
  assert.ok(r.z < 0, `z=${r.z}`);
  assert.ok(r.pTwoSided < 0.01, `pTwoSided=${r.pTwoSided}`);
});

test('pst: balanced signs gives p=1', () => {
  // 8 pairs: 4 positive, 4 negative.
  // First half: 1..8. Second half: alternating +/- around firsts.
  // Want sPlus=4, sMinus=4 deterministically.
  const a = [10, 10, 10, 10, 10, 10, 10, 10];
  const b = [11, 9, 11, 9, 11, 9, 11, 9];
  const v = a.concat(b);
  const r = dailyTokenPairedSignTestHalves(v);
  assert.equal(r.sPlus, 4);
  assert.equal(r.sMinus, 4);
  assert.equal(r.pTwoSided, 1);
  assert.equal(r.z, 0);
});

test('pst: zero diffs are dropped Pratt-style', () => {
  // 10 pairs total, 4 with d=0, 6 with d>0.
  const a = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
  const b = [5, 5, 5, 5, 6, 7, 8, 9, 10, 11];
  const v = a.concat(b);
  const r = dailyTokenPairedSignTestHalves(v);
  assert.equal(r.nPairs, 10);
  assert.equal(r.nZeroDropped, 4);
  assert.equal(r.nNonZero, 6);
  assert.equal(r.sPlus, 6);
  assert.equal(r.sMinus, 0);
});

test('pst: throws when too few non-zero pairs after Pratt', () => {
  // 8 pairs, 7 zero, only 1 non-zero -> below floor 6.
  const a = [5, 5, 5, 5, 5, 5, 5, 5];
  const b = [5, 5, 5, 5, 5, 5, 5, 9];
  const v = a.concat(b);
  assert.throws(
    () => dailyTokenPairedSignTestHalves(v),
    /at least 6 non-zero/,
  );
});

test('pst: odd-n drops median day', () => {
  // n=17. Pairs after dropping median => 8 pairs.
  const v = Array.from({ length: 17 }, (_, i) => 10 + i);
  const r = dailyTokenPairedSignTestHalves(v);
  assert.equal(r.nPairs, 8);
});

test('pst: sPlus + sMinus + nZeroDropped = nPairs always', () => {
  const v = Array.from({ length: 20 }, (_, i) => (i * 1009) % 73);
  const r = dailyTokenPairedSignTestHalves(v);
  assert.equal(r.sPlus + r.sMinus + r.nZeroDropped, r.nPairs);
});

test('pst: continuity correction pulls Z toward 0', () => {
  // sPlus=8 of 10 non-zero => deviation +3. Naive Z = 3/sqrt(2.5) ≈ 1.897.
  // CC Z = 2.5/sqrt(2.5) ≈ 1.581. Both positive, |cc| < |naive|.
  const a = Array.from({ length: 10 }, () => 10);
  const b = [11, 11, 11, 11, 11, 11, 11, 11, 9, 9];
  const v = a.concat(b);
  const r = dailyTokenPairedSignTestHalves(v);
  assert.equal(r.sPlus, 8);
  assert.equal(r.sMinus, 2);
  const naive = (8 - 5) / Math.sqrt(10 / 4);
  assert.ok(Math.abs(r.z) < Math.abs(naive), `z=${r.z} naive=${naive}`);
  assert.ok(Math.sign(r.z) === Math.sign(naive));
});

test('pst: exact p matches manual computation for small case', () => {
  // 8 pairs, sPlus=7, sMinus=1.
  // pTwoSided = 2 * Pr(X >= 7 | Bin(8,.5)) = 2 * (8 + 1)/256 = 18/256.
  const a = Array.from({ length: 8 }, () => 10);
  const b = [11, 11, 11, 11, 11, 11, 11, 9];
  const v = a.concat(b);
  const r = dailyTokenPairedSignTestHalves(v);
  assert.equal(r.sPlus, 7);
  assert.equal(r.sMinus, 1);
  assert.ok(Math.abs(r.pTwoSided - 18 / 256) < 1e-12, `pTwoSided=${r.pTwoSided}`);
});

test('pst: piPlus and delta consistency', () => {
  const a = Array.from({ length: 10 }, () => 10);
  const b = [11, 11, 11, 11, 11, 11, 9, 9, 9, 9];
  const v = a.concat(b);
  const r = dailyTokenPairedSignTestHalves(v);
  assert.equal(r.sPlus, 6);
  assert.equal(r.sMinus, 4);
  assert.equal(r.piPlus, 0.6);
  assert.ok(Math.abs(r.delta - 0.2) < 1e-12);
  assert.ok(Math.abs(r.delta - (2 * r.piPlus - 1)) < 1e-12);
});

test('pst: pUpper + pLower - pAtSPlus = 1', () => {
  // Standard CDF identity for discrete distributions.
  for (const n of [8, 12, 25]) {
    for (let k = 0; k <= n; k += 1) {
      const lo = binomialHalfCdfLower(n, k);
      const up = binomialHalfCdfUpper(n, k);
      const pmf = binomialHalfPmf(n, k);
      assert.ok(Math.abs(lo + up - pmf - 1) < 1e-10, `n=${n} k=${k}`);
    }
  }
});

// ---------- buildDailyTokenPairedSignTestHalves ----------

test('pst: build returns deterministic report on synthetic shift', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-shift', i < 8 ? 1000 : 5000));
  }
  const report = buildDailyTokenPairedSignTestHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(report.totalSources, 1);
  assert.equal(report.sources.length, 1);
  const r = report.sources[0]!;
  assert.equal(r.source, 'src-shift');
  assert.equal(r.pstSPlus, 8);
  assert.equal(r.pstSMinus, 0);
  assert.equal(r.pstSign, 1);
  assert.equal(r.pstDecision, 'very-significant');
});

test('pst: build drops sparse sources by minTokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'big', 5000));
    queue.push(ql(dayIso(i), 'small', 10));
  }
  const report = buildDailyTokenPairedSignTestHalves(queue, {
    minTokens: 1000,
    minTenureDays: 16,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(report.totalSources, 2);
  assert.equal(report.droppedSparseSources, 1);
});

test('pst: build drops zero-variance flat sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 1000));
  }
  const report = buildDailyTokenPairedSignTestHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(report.droppedZeroVariance, 1);
  assert.equal(report.sources.length, 0);
});

test('pst: build sort=absDeltaDesc orders by |delta| desc', () => {
  const queue: QueueLine[] = [];
  // src-A: full positive delta = +1.
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-A', i < 8 ? 100 : 500));
  }
  // src-B: half/half delta = 0.
  for (let i = 0; i < 16; i += 1) {
    const second = i < 8 ? false : true;
    const odd = i % 2 === 1;
    queue.push(ql(dayIso(i), 'src-B', second === odd ? 200 : 100));
  }
  const report = buildDailyTokenPairedSignTestHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    sort: 'absDeltaDesc',
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.ok(report.sources.length >= 1);
  assert.equal(report.sources[0]!.source, 'src-A');
});

test('pst: build invalid sort throws', () => {
  assert.throws(
    () =>
      buildDailyTokenPairedSignTestHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('pst: build invalid minTenureDays throws', () => {
  assert.throws(
    () => buildDailyTokenPairedSignTestHalves([], { minTenureDays: 4 }),
    /min-tenure|minTenureDays/i,
  );
});

// ---------- invariant tests ----------

test('pst: sign(z) agrees with sign(sPlus - n_nz/2) (cc may zero out half-integer dev)', () => {
  const seed = (n: number) => {
    let x = n + 1;
    return () => {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      return x;
    };
  };
  const rng = seed(42);
  for (let trial = 0; trial < 20; trial += 1) {
    const v: number[] = [];
    for (let i = 0; i < 20; i += 1) v.push(rng() % 1000);
    const r = dailyTokenPairedSignTestHalves(v);
    const expectedSign =
      r.sPlus > r.expectedSPlus
        ? 1
        : r.sPlus < r.expectedSPlus
          ? -1
          : 0;
    // Continuity correction can collapse a half-integer
    // deviation (|sPlus - n_nz/2| == 0.5) to z = 0; in
    // that case sign(z) is permitted to be 0.
    const halfIntegerCancel =
      Math.abs(r.sPlus - r.expectedSPlus) <= 0.5 + 1e-12;
    if (halfIntegerCancel && Math.sign(r.z) === 0) continue;
    assert.equal(Math.sign(r.z), expectedSign, `trial=${trial}`);
  }
});

test('pst: pTwoSided <= 2 * min(pUpper, pLower) always', () => {
  // Standard discrete two-sided p sanity check.
  for (const n of [8, 12, 20, 30]) {
    for (let s = 0; s <= n; s += 1) {
      const a = Array.from({ length: n }, () => 10);
      const b = Array.from({ length: n }, (_, i) => (i < s ? 11 : 9));
      const v = a.concat(b);
      if (n < 16) continue;
      const r = dailyTokenPairedSignTestHalves(v);
      const minOne = Math.min(r.pUpper, r.pLower);
      assert.ok(
        r.pTwoSided <= 2 * minOne + 1e-12,
        `n=${n} s=${s} pTwo=${r.pTwoSided} pU=${r.pUpper} pL=${r.pLower}`,
      );
    }
  }
});
