import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenTopsoeDivergenceHalves,
  buildDailyTokenTopsoeDivergenceHalves,
  topsoeSummand,
  TOPSOE_GRID_K,
  TOPSOE_SILVERMAN_MULTIPLIER,
  TOPSOE_GRID_EXTENSION_H,
  TOPSOE_PMF_FLOOR,
} from '../src/dailytokentopsoedivergencehalves.js';
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

test('topsoe primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenTopsoeDivergenceHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('topsoe primitive: accepts exactly 8 samples', () => {
  const r = dailyTokenTopsoeDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.topsoeN1, 4);
  assert.equal(r.topsoeN2, 4);
});

test('topsoe primitive: rejects NaN', () => {
  assert.throws(
    () => dailyTokenTopsoeDivergenceHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
});

test('topsoe primitive: rejects +Infinity', () => {
  assert.throws(
    () => dailyTokenTopsoeDivergenceHalves([1, 2, 3, 4, Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('topsoe primitive: rejects -Infinity', () => {
  assert.throws(
    () => dailyTokenTopsoeDivergenceHalves([1, 2, 3, 4, -Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('topsoe primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenTopsoeDivergenceHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('topsoe primitive: n1 = floor(n/2), n2 = n - n1 (even)', () => {
  const r = dailyTokenTopsoeDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.topsoeN1, 5);
  assert.equal(r.topsoeN2, 5);
});

test('topsoe primitive: n1 = floor(n/2), n2 = n - n1 (odd)', () => {
  const r = dailyTokenTopsoeDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.topsoeN1, 4);
  assert.equal(r.topsoeN2, 5);
});

test('topsoe primitive: nSamples reports actual length', () => {
  const r = dailyTokenTopsoeDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
  assert.equal(r.nSamples, 12);
});

test('topsoe primitive: gridK matches TOPSOE_GRID_K constant', () => {
  const r = dailyTokenTopsoeDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.topsoeGridK, TOPSOE_GRID_K);
  assert.equal(r.topsoeGridK, 257);
});

test('topsoe primitive: madPool and bandwidth strictly positive on varied input', () => {
  const r = dailyTokenTopsoeDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
  assert.ok(r.topsoeMadPool > 0);
  assert.ok(r.topsoeBandwidth > 0);
});

test('topsoe primitive: bandwidth = 0.9 * mad * n^(-1/5)', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = dailyTokenTopsoeDivergenceHalves(xs);
  const expected = TOPSOE_SILVERMAN_MULTIPLIER * r.topsoeMadPool * Math.pow(xs.length, -1 / 5);
  assert.ok(Math.abs(r.topsoeBandwidth - expected) < 1e-12);
});

test('topsoe primitive: grid extends 3*h beyond min and max', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = dailyTokenTopsoeDivergenceHalves(xs);
  const mn = Math.min(...xs);
  const mx = Math.max(...xs);
  assert.ok(Math.abs(r.topsoeGridLo - (mn - TOPSOE_GRID_EXTENSION_H * r.topsoeBandwidth)) < 1e-9);
  assert.ok(Math.abs(r.topsoeGridHi - (mx + TOPSOE_GRID_EXTENSION_H * r.topsoeBandwidth)) < 1e-9);
});

test('topsoe primitive: grid dx = (gHi - gLo) / (K - 1)', () => {
  const r = dailyTokenTopsoeDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  const expected = (r.topsoeGridHi - r.topsoeGridLo) / (TOPSOE_GRID_K - 1);
  assert.ok(Math.abs(r.topsoeGridDx - expected) < 1e-12);
});

// ---------- primitive: divergence non-negativity & finiteness ----------

test('topsoe primitive: divergence is non-negative on uniform-ish data', () => {
  const r = dailyTokenTopsoeDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(r.topsoeDivergence >= 0);
});

test('topsoe primitive: divergence is non-negative on bimodal data', () => {
  const xs = [1, 1, 1, 1, 100, 100, 100, 100, 1, 1, 1, 1, 100, 100, 100, 100];
  const r = dailyTokenTopsoeDivergenceHalves(xs);
  assert.ok(r.topsoeDivergence >= 0);
});

test('topsoe primitive: divergence finite on large range data', () => {
  const xs = [
    1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 100, 200, 500, 1000, 2000,
  ];
  const r = dailyTokenTopsoeDivergenceHalves(xs);
  assert.ok(Number.isFinite(r.topsoeDivergence));
  assert.ok(Number.isFinite(r.topsoeMaxBin));
  assert.ok(Number.isFinite(r.topsoeMaxRelGap));
  assert.ok(Number.isFinite(r.topsoeSpreadRatio));
});

test('topsoe primitive: maxBin >= 0', () => {
  const r = dailyTokenTopsoeDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
  assert.ok(r.topsoeMaxBin >= 0);
});

test('topsoe primitive: maxRelGap in [0, 1]', () => {
  const r = dailyTokenTopsoeDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
  assert.ok(r.topsoeMaxRelGap >= 0);
  assert.ok(r.topsoeMaxRelGap <= 1);
});

test('topsoe primitive: spreadRatio in [0, 1]', () => {
  const r = dailyTokenTopsoeDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
  ]);
  assert.ok(r.topsoeSpreadRatio >= 0);
  assert.ok(r.topsoeSpreadRatio <= 1);
});

test('topsoe primitive: spreadRatio = divergence / (K * maxBin) when maxBin > 0', () => {
  const r = dailyTokenTopsoeDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
  ]);
  if (r.topsoeMaxBin > 0) {
    const expected =
      r.topsoeDivergence / (TOPSOE_GRID_K * r.topsoeMaxBin);
    assert.ok(Math.abs(r.topsoeSpreadRatio - expected) < 1e-12);
  }
});

// ---------- primitive: invariances ----------

test('topsoe primitive: translation invariant (data + constant)', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r1 = dailyTokenTopsoeDivergenceHalves(xs);
  const r2 = dailyTokenTopsoeDivergenceHalves(xs.map((x) => x + 1000));
  assert.ok(Math.abs(r1.topsoeDivergence - r2.topsoeDivergence) < 1e-9);
});

test('topsoe primitive: positive-scale invariant (data * positive constant)', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r1 = dailyTokenTopsoeDivergenceHalves(xs);
  const r2 = dailyTokenTopsoeDivergenceHalves(xs.map((x) => x * 7.5));
  assert.ok(Math.abs(r1.topsoeDivergence - r2.topsoeDivergence) < 1e-9);
});

test('topsoe primitive: symmetric under reversal of halves', () => {
  // Build A then B vs B then A — Kumar-Johnson is symmetric in p, q.
  const A = [1, 2, 3, 4, 5, 6];
  const B = [10, 12, 14, 16, 18, 20];
  const r1 = dailyTokenTopsoeDivergenceHalves([...A, ...B]);
  const r2 = dailyTokenTopsoeDivergenceHalves([...B, ...A]);
  // grid identical (same pooled stats), divergence symmetric in p, q.
  assert.ok(Math.abs(r1.topsoeDivergence - r2.topsoeDivergence) < 1e-9);
});

test('topsoe primitive: maxBin symmetric under reversal of halves', () => {
  const A = [1, 2, 3, 4, 5, 6];
  const B = [10, 12, 14, 16, 18, 20];
  const r1 = dailyTokenTopsoeDivergenceHalves([...A, ...B]);
  const r2 = dailyTokenTopsoeDivergenceHalves([...B, ...A]);
  assert.ok(Math.abs(r1.topsoeMaxBin - r2.topsoeMaxBin) < 1e-9);
});

test('topsoe primitive: maxRelGap symmetric under reversal of halves', () => {
  const A = [1, 2, 3, 4, 5, 6];
  const B = [10, 12, 14, 16, 18, 20];
  const r1 = dailyTokenTopsoeDivergenceHalves([...A, ...B]);
  const r2 = dailyTokenTopsoeDivergenceHalves([...B, ...A]);
  assert.ok(Math.abs(r1.topsoeMaxRelGap - r2.topsoeMaxRelGap) < 1e-9);
});

// ---------- primitive: equal halves -> small divergence ----------

test('topsoe primitive: identical halves yield very small divergence', () => {
  const half = [1, 5, 3, 7, 2, 6, 4, 8];
  const xs = [...half, ...half];
  const r = dailyTokenTopsoeDivergenceHalves(xs);
  // KDE on identical halves still differs slightly because the grid
  // extends by 3h, but divergence should be tiny.
  assert.ok(r.topsoeDivergence < 0.5);
});

test('topsoe primitive: identical halves yield small maxRelGap', () => {
  const half = [1, 5, 3, 7, 2, 6, 4, 8];
  const xs = [...half, ...half];
  const r = dailyTokenTopsoeDivergenceHalves(xs);
  assert.ok(r.topsoeMaxRelGap < 0.5);
});

test('topsoe primitive: very disparate halves yield large maxRelGap', () => {
  const xs = [
    1, 1, 1, 1, 1, 1, 1, 1, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000,
  ];
  const r = dailyTokenTopsoeDivergenceHalves(xs);
  assert.ok(r.topsoeMaxRelGap > 0.9);
});

test('topsoe primitive: very disparate halves yield large divergence', () => {
  const xs = [
    1, 1, 1, 1, 1, 1, 1, 1, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000,
  ];
  const r = dailyTokenTopsoeDivergenceHalves(xs);
  assert.ok(r.topsoeDivergence > 0);
});

test('topsoe primitive: divergence monotone in disparity (mild < strong)', () => {
  const mild = [1, 2, 3, 4, 5, 6, 7, 8, 2, 3, 4, 5, 6, 7, 8, 9];
  const strong = [1, 1, 2, 2, 3, 3, 4, 4, 100, 200, 300, 400, 500, 600, 700, 800];
  const rMild = dailyTokenTopsoeDivergenceHalves(mild);
  const rStrong = dailyTokenTopsoeDivergenceHalves(strong);
  assert.ok(rStrong.topsoeDivergence > rMild.topsoeDivergence);
});

// ---------- summand helper ----------

test('topsoe summand: rejects NaN p', () => {
  assert.throws(() => topsoeSummand(NaN, 0.1), /finite inputs/);
});

test('topsoe summand: rejects NaN q', () => {
  assert.throws(() => topsoeSummand(0.1, NaN), /finite inputs/);
});

test('topsoe summand: rejects +Infinity', () => {
  assert.throws(() => topsoeSummand(Infinity, 0.1), /finite inputs/);
});

test('topsoe summand: rejects negative p', () => {
  assert.throws(() => topsoeSummand(-0.1, 0.1), /non-negative/);
});

test('topsoe summand: rejects negative q', () => {
  assert.throws(() => topsoeSummand(0.1, -0.1), /non-negative/);
});

test('topsoe summand: equal p, q yields exactly 0', () => {
  assert.equal(topsoeSummand(0.4, 0.4), 0);
});

test('topsoe summand: equal p, q yields exactly 0 at small magnitude', () => {
  assert.equal(topsoeSummand(1e-6, 1e-6), 0);
});

test('topsoe summand: symmetric under swap', () => {
  const a = topsoeSummand(0.3, 0.7);
  const b = topsoeSummand(0.7, 0.3);
  assert.ok(Math.abs(a - b) < 1e-12);
});

test('topsoe summand: symmetric under swap (small values)', () => {
  const a = topsoeSummand(0.001, 0.5);
  const b = topsoeSummand(0.5, 0.001);
  assert.ok(Math.abs(a - b) < 1e-9);
});

test('topsoe summand: non-negative on disparate inputs', () => {
  assert.ok(topsoeSummand(0.01, 0.99) >= 0);
});

test('topsoe summand: non-negative on tiny inputs', () => {
  assert.ok(topsoeSummand(1e-10, 1e-3) >= 0);
});

test('topsoe summand: matches closed-form formula', () => {
  const p = 0.3;
  const q = 0.7;
  const expected =
    p * Math.log((2 * p) / (p + q)) + q * Math.log((2 * q) / (p + q));
  const got = topsoeSummand(p, q);
  assert.ok(Math.abs(got - expected) < 1e-12);
});

test('topsoe summand: equals 2 * JS midpoint contribution', () => {
  // Topsoe per-bin equals KL(p||M) + KL(q||M) with M = (p+q)/2.
  const p = 0.4;
  const q = 0.1;
  const M = (p + q) / 2;
  const expected = p * Math.log(p / M) + q * Math.log(q / M);
  const got = topsoeSummand(p, q);
  assert.ok(Math.abs(got - expected) < 1e-12);
});

test('topsoe summand: bounded by 2 * log(2) per bin (pmf-scale)', () => {
  // Worst per-bin case is one of {p,q} near 0 with the other near a value
  // that maximises p log(2p/(p+q)) + q log(2q/(p+q)). For p+q <= 1 the
  // per-bin summand is bounded above by (p+q)*log(2) <= 2*log(2).
  const cases = [
    [0.5, 0],
    [0.5, 0.5],
    [0.99, 0.01],
    [0.001, 0.999],
  ];
  const cap = 2 * Math.log(2) + 1e-9;
  for (const [p, q] of cases) {
    assert.ok(topsoeSummand(p!, q!) <= cap);
  }
});

test('topsoe summand: floors at TOPSOE_PMF_FLOOR for tiny p', () => {
  // Very small p < TOPSOE_PMF_FLOOR should be lifted to floor and stay finite.
  const r = topsoeSummand(0, 0.5);
  assert.ok(Number.isFinite(r));
  assert.ok(r > 0);
});

test('topsoe summand: floors at TOPSOE_PMF_FLOOR for tiny q', () => {
  const r = topsoeSummand(0.5, 0);
  assert.ok(Number.isFinite(r));
  assert.ok(r > 0);
});

test('topsoe summand: zero p, zero q yields zero', () => {
  // Both floored to TOPSOE_PMF_FLOOR -> equal -> 0.
  assert.equal(topsoeSummand(0, 0), 0);
});

test('topsoe summand: monotone in |p - q| at fixed p+q', () => {
  // Hold AM = 0.5; vary the gap.
  const small = topsoeSummand(0.45, 0.55);
  const large = topsoeSummand(0.1, 0.9);
  assert.ok(large > small);
});

test('topsoe summand: TOPSOE_PMF_FLOOR is 1e-15', () => {
  assert.equal(TOPSOE_PMF_FLOOR, 1e-15);
});

// ---------- builder: empty / minimal ----------

test('topsoe builder: empty queue yields empty sources', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
});

test('topsoe builder: drops invalid hour_start', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves([
    ql('not-a-date', 'src', 1000),
  ]);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('topsoe builder: drops non-positive tokens', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves([
    ql(dayIso(0), 'src', 0),
    ql(dayIso(1), 'src', -5),
  ]);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('topsoe builder: source filter increments droppedSourceFilter', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(
    [ql(dayIso(0), 'a', 1000), ql(dayIso(1), 'b', 1000)],
    { source: 'a' },
  );
  assert.equal(r.droppedSourceFilter, 1);
});

test('topsoe builder: drops sources below min-tokens', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) lines.push(ql(dayIso(i), 'src', 10));
  const r = buildDailyTokenTopsoeDivergenceHalves(lines, {
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('topsoe builder: drops sources below min-tenure-days', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) lines.push(ql(dayIso(i), 'src', 10000));
  const r = buildDailyTokenTopsoeDivergenceHalves(lines, {
    minTokens: 1000,
    minTenureDays: 14,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('topsoe builder: drops zero-variance sources', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) lines.push(ql(dayIso(i), 'src', 10000));
  const r = buildDailyTokenTopsoeDivergenceHalves(lines, {
    minTokens: 1000,
    minTenureDays: 14,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('topsoe builder: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenTopsoeDivergenceHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('topsoe builder: rejects negative minTokens', () => {
  assert.throws(
    () =>
      buildDailyTokenTopsoeDivergenceHalves([], { minTokens: -1 }),
    /non-negative/,
  );
});

test('topsoe builder: rejects minTenureDays < 8', () => {
  assert.throws(
    () =>
      buildDailyTokenTopsoeDivergenceHalves([], { minTenureDays: 7 }),
    />= 8/,
  );
});

test('topsoe builder: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenTopsoeDivergenceHalves([], { top: -1 }),
    /non-negative integer/,
  );
});

test('topsoe builder: rejects invalid since', () => {
  assert.throws(
    () =>
      buildDailyTokenTopsoeDivergenceHalves([], { since: 'not-iso' }),
    /invalid since/,
  );
});

test('topsoe builder: rejects invalid until', () => {
  assert.throws(
    () =>
      buildDailyTokenTopsoeDivergenceHalves([], { until: 'not-iso' }),
    /invalid until/,
  );
});

// ---------- builder: end-to-end on synthetic queue ----------

function syntheticQueue(): QueueLine[] {
  const lines: QueueLine[] = [];
  // source A: 30 days, varied
  for (let i = 0; i < 30; i += 1) {
    lines.push(ql(dayIso(i), 'src-a', 1000 + i * 100 + (i % 3) * 50));
  }
  // source B: 30 days, bimodal halves
  for (let i = 0; i < 15; i += 1) {
    lines.push(ql(dayIso(i), 'src-b', 500 + (i % 4) * 25));
  }
  for (let i = 15; i < 30; i += 1) {
    lines.push(ql(dayIso(i), 'src-b', 5000 + (i % 5) * 100));
  }
  return lines;
}

test('topsoe builder: produces rows for varied + bimodal sources', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 2);
});

test('topsoe builder: bimodal source has larger divergence than varied', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'source',
  });
  const a = r.sources.find((s) => s.source === 'src-a');
  const b = r.sources.find((s) => s.source === 'src-b');
  assert.ok(a !== undefined);
  assert.ok(b !== undefined);
  assert.ok(b!.topsoeDivergence > a!.topsoeDivergence);
});

test('topsoe builder: topsoeDesc sort puts highest divergence first', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'topsoeDesc',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      r.sources[i - 1]!.topsoeDivergence >=
        r.sources[i]!.topsoeDivergence,
    );
  }
});

test('topsoe builder: kj (asc) sort puts lowest divergence first', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'topsoe',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      r.sources[i - 1]!.topsoeDivergence <=
        r.sources[i]!.topsoeDivergence,
    );
  }
});

test('topsoe builder: maxBinDesc sort puts highest maxBin first', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'maxBinDesc',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      r.sources[i - 1]!.topsoeMaxBin >= r.sources[i]!.topsoeMaxBin,
    );
  }
});

test('topsoe builder: tokens sort puts highest totalTokens first', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'tokens',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.totalTokens >= r.sources[i]!.totalTokens);
  }
});

test('topsoe builder: tenure sort puts longest tenure first', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'tenure',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.nTenureDays >= r.sources[i]!.nTenureDays);
  }
});

test('topsoe builder: source sort puts sources alphabetical', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'source',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.source <= r.sources[i]!.source);
  }
});

test('topsoe builder: top cap drops tail rows', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 1);
});

test('topsoe builder: source filter restricts to one source', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    source: 'src-a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
});

test('topsoe builder: report records grid constants', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
  });
  assert.equal(r.gridK, TOPSOE_GRID_K);
  assert.equal(r.silvermanMultiplier, TOPSOE_SILVERMAN_MULTIPLIER);
  assert.equal(r.pmfFloor, TOPSOE_PMF_FLOOR);
});

test('topsoe builder: generatedAt is the supplied value when provided', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves([], {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2026-05-03T00:00:00.000Z');
});

test('topsoe builder: windowStart and windowEnd echo since/until', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves([], {
    since: '2026-01-01T00:00:00.000Z',
    until: '2026-12-31T23:59:59.999Z',
  });
  assert.equal(r.windowStart, '2026-01-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-12-31T23:59:59.999Z');
});

test('topsoe builder: every row has a finite divergence', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
  });
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.topsoeDivergence));
    assert.ok(Number.isFinite(s.topsoeMaxBin));
    assert.ok(Number.isFinite(s.topsoeMaxRelGap));
    assert.ok(Number.isFinite(s.topsoeSpreadRatio));
  }
});

test('topsoe builder: every row has divergence >= 0', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
  });
  for (const s of r.sources) {
    assert.ok(s.topsoeDivergence >= 0);
  }
});

test('topsoe builder: every row has maxRelGap in [0, 1]', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
  });
  for (const s of r.sources) {
    assert.ok(s.topsoeMaxRelGap >= 0);
    assert.ok(s.topsoeMaxRelGap <= 1);
  }
});

test('topsoe builder: every row has spreadRatio in [0, 1]', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
  });
  for (const s of r.sources) {
    assert.ok(s.topsoeSpreadRatio >= 0);
    assert.ok(s.topsoeSpreadRatio <= 1);
  }
});

test('topsoe builder: row n1 + n2 equals nTenureDays', () => {
  const r = buildDailyTokenTopsoeDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
  });
  for (const s of r.sources) {
    assert.equal(s.topsoeN1 + s.topsoeN2, s.nTenureDays);
  }
});

test('topsoe builder: deterministic across two runs', () => {
  const q = syntheticQueue();
  const r1 = buildDailyTokenTopsoeDivergenceHalves(q, {
    minTokens: 1000,
    minTenureDays: 14,
    generatedAt: 'fixed',
  });
  const r2 = buildDailyTokenTopsoeDivergenceHalves(q, {
    minTokens: 1000,
    minTenureDays: 14,
    generatedAt: 'fixed',
  });
  assert.deepEqual(r1, r2);
});

// ---------- refinement: topsoePerBinAverage ----------

test('topsoe primitive: topsoePerBinAverage equals divergence / K', () => {
  const r = dailyTokenTopsoeDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
  ]);
  const expected = r.topsoeDivergence / TOPSOE_GRID_K;
  assert.ok(Math.abs(r.topsoePerBinAverage - expected) < 1e-12);
});

test('topsoe primitive: topsoePerBinAverage non-negative', () => {
  const r = dailyTokenTopsoeDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
  assert.ok(r.topsoePerBinAverage >= 0);
});

test('topsoe primitive: topsoePerBinAverage finite on bimodal halves', () => {
  const xs = [
    1, 1, 2, 2, 3, 3, 4, 4, 100, 200, 300, 400, 500, 600, 700, 800,
  ];
  const r = dailyTokenTopsoeDivergenceHalves(xs);
  assert.ok(Number.isFinite(r.topsoePerBinAverage));
});

test('topsoe primitive: topsoePerBinAverage translation invariant', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r1 = dailyTokenTopsoeDivergenceHalves(xs);
  const r2 = dailyTokenTopsoeDivergenceHalves(xs.map((x) => x + 500));
  assert.ok(Math.abs(r1.topsoePerBinAverage - r2.topsoePerBinAverage) < 1e-9);
});

test('topsoe primitive: topsoePerBinAverage scale invariant', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r1 = dailyTokenTopsoeDivergenceHalves(xs);
  const r2 = dailyTokenTopsoeDivergenceHalves(xs.map((x) => x * 3.25));
  assert.ok(Math.abs(r1.topsoePerBinAverage - r2.topsoePerBinAverage) < 1e-9);
});

test('topsoe builder: every row has finite non-negative perBinAverage', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    lines.push(ql(dayIso(i), 'src-a', 1000 + i * 100 + (i % 3) * 50));
  }
  for (let i = 0; i < 15; i += 1) {
    lines.push(ql(dayIso(i), 'src-b', 500 + (i % 4) * 25));
  }
  for (let i = 15; i < 30; i += 1) {
    lines.push(ql(dayIso(i), 'src-b', 5000 + (i % 5) * 100));
  }
  const r = buildDailyTokenTopsoeDivergenceHalves(lines, {
    minTokens: 1000,
    minTenureDays: 14,
  });
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.topsoePerBinAverage));
    assert.ok(s.topsoePerBinAverage >= 0);
    assert.ok(
      Math.abs(
        s.topsoePerBinAverage - s.topsoeDivergence / TOPSOE_GRID_K,
      ) < 1e-9,
    );
  }
});

// ---------- refinement: topsoeSaturation + TOPSOE_MAX_VALUE ----------

import {
  topsoeSaturation,
  TOPSOE_MAX_VALUE,
} from '../src/dailytokentopsoedivergencehalves.js';

test('topsoe refinement: TOPSOE_MAX_VALUE equals 2*log(2)', () => {
  assert.ok(Math.abs(TOPSOE_MAX_VALUE - 2 * Math.log(2)) < 1e-15);
});

test('topsoe refinement: saturation(0) === 0', () => {
  assert.equal(topsoeSaturation(0), 0);
});

test('topsoe refinement: saturation(TOPSOE_MAX_VALUE) === 1', () => {
  assert.ok(Math.abs(topsoeSaturation(TOPSOE_MAX_VALUE) - 1) < 1e-15);
});

test('topsoe refinement: saturation clamps above 1', () => {
  // Numerical drift could push T just above the bound; saturation must clamp.
  assert.equal(topsoeSaturation(TOPSOE_MAX_VALUE + 1e-10), 1);
});

test('topsoe refinement: saturation rejects NaN', () => {
  assert.throws(() => topsoeSaturation(NaN), /finite input/);
});

test('topsoe refinement: saturation rejects negative', () => {
  assert.throws(() => topsoeSaturation(-1e-12), /non-negative/);
});

test('topsoe refinement: saturation matches divergence/T_max for builder rows', () => {
  const queue: QueueLine[] = [];
  const rng = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  };
  const r1 = rng(11);
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 1000 + Math.floor(r1() * 50000)));
  }
  const rep = buildDailyTokenTopsoeDivergenceHalves(queue, {
    minTenureDays: 14,
  });
  for (const s of rep.sources) {
    const sat = topsoeSaturation(s.topsoeDivergence);
    assert.ok(
      Math.abs(sat - s.topsoeDivergence / TOPSOE_MAX_VALUE) < 1e-12,
    );
    assert.ok(sat >= 0);
    assert.ok(sat <= 1);
  }
});
