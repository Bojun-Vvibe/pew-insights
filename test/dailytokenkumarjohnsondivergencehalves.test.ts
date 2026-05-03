import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenKumarJohnsonDivergenceHalves,
  buildDailyTokenKumarJohnsonDivergenceHalves,
  kumarJohnsonSummand,
  KJ_GRID_K,
  KJ_SILVERMAN_MULTIPLIER,
  KJ_GRID_EXTENSION_H,
  KJ_PMF_FLOOR,
} from '../src/dailytokenkumarjohnsondivergencehalves.js';
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

test('kj primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenKumarJohnsonDivergenceHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('kj primitive: accepts exactly 8 samples', () => {
  const r = dailyTokenKumarJohnsonDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.kjN1, 4);
  assert.equal(r.kjN2, 4);
});

test('kj primitive: rejects NaN', () => {
  assert.throws(
    () => dailyTokenKumarJohnsonDivergenceHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
});

test('kj primitive: rejects +Infinity', () => {
  assert.throws(
    () => dailyTokenKumarJohnsonDivergenceHalves([1, 2, 3, 4, Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('kj primitive: rejects -Infinity', () => {
  assert.throws(
    () => dailyTokenKumarJohnsonDivergenceHalves([1, 2, 3, 4, -Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('kj primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenKumarJohnsonDivergenceHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('kj primitive: n1 = floor(n/2), n2 = n - n1 (even)', () => {
  const r = dailyTokenKumarJohnsonDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.kjN1, 5);
  assert.equal(r.kjN2, 5);
});

test('kj primitive: n1 = floor(n/2), n2 = n - n1 (odd)', () => {
  const r = dailyTokenKumarJohnsonDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.kjN1, 4);
  assert.equal(r.kjN2, 5);
});

test('kj primitive: nSamples reports actual length', () => {
  const r = dailyTokenKumarJohnsonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
  assert.equal(r.nSamples, 12);
});

test('kj primitive: gridK matches KJ_GRID_K constant', () => {
  const r = dailyTokenKumarJohnsonDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.kjGridK, KJ_GRID_K);
  assert.equal(r.kjGridK, 257);
});

test('kj primitive: madPool and bandwidth strictly positive on varied input', () => {
  const r = dailyTokenKumarJohnsonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
  assert.ok(r.kjMadPool > 0);
  assert.ok(r.kjBandwidth > 0);
});

test('kj primitive: bandwidth = 0.9 * mad * n^(-1/5)', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = dailyTokenKumarJohnsonDivergenceHalves(xs);
  const expected = KJ_SILVERMAN_MULTIPLIER * r.kjMadPool * Math.pow(xs.length, -1 / 5);
  assert.ok(Math.abs(r.kjBandwidth - expected) < 1e-12);
});

test('kj primitive: grid extends 3*h beyond min and max', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = dailyTokenKumarJohnsonDivergenceHalves(xs);
  const mn = Math.min(...xs);
  const mx = Math.max(...xs);
  assert.ok(Math.abs(r.kjGridLo - (mn - KJ_GRID_EXTENSION_H * r.kjBandwidth)) < 1e-9);
  assert.ok(Math.abs(r.kjGridHi - (mx + KJ_GRID_EXTENSION_H * r.kjBandwidth)) < 1e-9);
});

test('kj primitive: grid dx = (gHi - gLo) / (K - 1)', () => {
  const r = dailyTokenKumarJohnsonDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  const expected = (r.kjGridHi - r.kjGridLo) / (KJ_GRID_K - 1);
  assert.ok(Math.abs(r.kjGridDx - expected) < 1e-12);
});

// ---------- primitive: divergence non-negativity & finiteness ----------

test('kj primitive: divergence is non-negative on uniform-ish data', () => {
  const r = dailyTokenKumarJohnsonDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(r.kumarJohnsonDivergence >= 0);
});

test('kj primitive: divergence is non-negative on bimodal data', () => {
  const xs = [1, 1, 1, 1, 100, 100, 100, 100, 1, 1, 1, 1, 100, 100, 100, 100];
  const r = dailyTokenKumarJohnsonDivergenceHalves(xs);
  assert.ok(r.kumarJohnsonDivergence >= 0);
});

test('kj primitive: divergence finite on large range data', () => {
  const xs = [
    1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 100, 200, 500, 1000, 2000,
  ];
  const r = dailyTokenKumarJohnsonDivergenceHalves(xs);
  assert.ok(Number.isFinite(r.kumarJohnsonDivergence));
  assert.ok(Number.isFinite(r.kumarJohnsonMaxBin));
  assert.ok(Number.isFinite(r.kumarJohnsonMaxRelGap));
  assert.ok(Number.isFinite(r.kumarJohnsonSpreadRatio));
});

test('kj primitive: maxBin >= 0', () => {
  const r = dailyTokenKumarJohnsonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
  assert.ok(r.kumarJohnsonMaxBin >= 0);
});

test('kj primitive: maxRelGap in [0, 1]', () => {
  const r = dailyTokenKumarJohnsonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
  assert.ok(r.kumarJohnsonMaxRelGap >= 0);
  assert.ok(r.kumarJohnsonMaxRelGap <= 1);
});

test('kj primitive: spreadRatio in [0, 1]', () => {
  const r = dailyTokenKumarJohnsonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
  ]);
  assert.ok(r.kumarJohnsonSpreadRatio >= 0);
  assert.ok(r.kumarJohnsonSpreadRatio <= 1);
});

test('kj primitive: spreadRatio = divergence / (K * maxBin) when maxBin > 0', () => {
  const r = dailyTokenKumarJohnsonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
  ]);
  if (r.kumarJohnsonMaxBin > 0) {
    const expected =
      r.kumarJohnsonDivergence / (KJ_GRID_K * r.kumarJohnsonMaxBin);
    assert.ok(Math.abs(r.kumarJohnsonSpreadRatio - expected) < 1e-12);
  }
});

// ---------- primitive: invariances ----------

test('kj primitive: translation invariant (data + constant)', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r1 = dailyTokenKumarJohnsonDivergenceHalves(xs);
  const r2 = dailyTokenKumarJohnsonDivergenceHalves(xs.map((x) => x + 1000));
  assert.ok(Math.abs(r1.kumarJohnsonDivergence - r2.kumarJohnsonDivergence) < 1e-9);
});

test('kj primitive: positive-scale invariant (data * positive constant)', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r1 = dailyTokenKumarJohnsonDivergenceHalves(xs);
  const r2 = dailyTokenKumarJohnsonDivergenceHalves(xs.map((x) => x * 7.5));
  assert.ok(Math.abs(r1.kumarJohnsonDivergence - r2.kumarJohnsonDivergence) < 1e-9);
});

test('kj primitive: symmetric under reversal of halves', () => {
  // Build A then B vs B then A — Kumar-Johnson is symmetric in p, q.
  const A = [1, 2, 3, 4, 5, 6];
  const B = [10, 12, 14, 16, 18, 20];
  const r1 = dailyTokenKumarJohnsonDivergenceHalves([...A, ...B]);
  const r2 = dailyTokenKumarJohnsonDivergenceHalves([...B, ...A]);
  // grid identical (same pooled stats), divergence symmetric in p, q.
  assert.ok(Math.abs(r1.kumarJohnsonDivergence - r2.kumarJohnsonDivergence) < 1e-9);
});

test('kj primitive: maxBin symmetric under reversal of halves', () => {
  const A = [1, 2, 3, 4, 5, 6];
  const B = [10, 12, 14, 16, 18, 20];
  const r1 = dailyTokenKumarJohnsonDivergenceHalves([...A, ...B]);
  const r2 = dailyTokenKumarJohnsonDivergenceHalves([...B, ...A]);
  assert.ok(Math.abs(r1.kumarJohnsonMaxBin - r2.kumarJohnsonMaxBin) < 1e-9);
});

test('kj primitive: maxRelGap symmetric under reversal of halves', () => {
  const A = [1, 2, 3, 4, 5, 6];
  const B = [10, 12, 14, 16, 18, 20];
  const r1 = dailyTokenKumarJohnsonDivergenceHalves([...A, ...B]);
  const r2 = dailyTokenKumarJohnsonDivergenceHalves([...B, ...A]);
  assert.ok(Math.abs(r1.kumarJohnsonMaxRelGap - r2.kumarJohnsonMaxRelGap) < 1e-9);
});

// ---------- primitive: equal halves -> small divergence ----------

test('kj primitive: identical halves yield very small divergence', () => {
  const half = [1, 5, 3, 7, 2, 6, 4, 8];
  const xs = [...half, ...half];
  const r = dailyTokenKumarJohnsonDivergenceHalves(xs);
  // KDE on identical halves still differs slightly because the grid
  // extends by 3h, but divergence should be tiny.
  assert.ok(r.kumarJohnsonDivergence < 0.5);
});

test('kj primitive: identical halves yield small maxRelGap', () => {
  const half = [1, 5, 3, 7, 2, 6, 4, 8];
  const xs = [...half, ...half];
  const r = dailyTokenKumarJohnsonDivergenceHalves(xs);
  assert.ok(r.kumarJohnsonMaxRelGap < 0.5);
});

test('kj primitive: very disparate halves yield large maxRelGap', () => {
  const xs = [
    1, 1, 1, 1, 1, 1, 1, 1, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000,
  ];
  const r = dailyTokenKumarJohnsonDivergenceHalves(xs);
  assert.ok(r.kumarJohnsonMaxRelGap > 0.9);
});

test('kj primitive: very disparate halves yield large divergence', () => {
  const xs = [
    1, 1, 1, 1, 1, 1, 1, 1, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000,
  ];
  const r = dailyTokenKumarJohnsonDivergenceHalves(xs);
  assert.ok(r.kumarJohnsonDivergence > 0);
});

test('kj primitive: divergence monotone in disparity (mild < strong)', () => {
  const mild = [1, 2, 3, 4, 5, 6, 7, 8, 2, 3, 4, 5, 6, 7, 8, 9];
  const strong = [1, 1, 2, 2, 3, 3, 4, 4, 100, 200, 300, 400, 500, 600, 700, 800];
  const rMild = dailyTokenKumarJohnsonDivergenceHalves(mild);
  const rStrong = dailyTokenKumarJohnsonDivergenceHalves(strong);
  assert.ok(rStrong.kumarJohnsonDivergence > rMild.kumarJohnsonDivergence);
});

// ---------- summand helper ----------

test('kj summand: rejects NaN p', () => {
  assert.throws(() => kumarJohnsonSummand(NaN, 0.1), /finite inputs/);
});

test('kj summand: rejects NaN q', () => {
  assert.throws(() => kumarJohnsonSummand(0.1, NaN), /finite inputs/);
});

test('kj summand: rejects +Infinity', () => {
  assert.throws(() => kumarJohnsonSummand(Infinity, 0.1), /finite inputs/);
});

test('kj summand: rejects negative p', () => {
  assert.throws(() => kumarJohnsonSummand(-0.1, 0.1), /non-negative/);
});

test('kj summand: rejects negative q', () => {
  assert.throws(() => kumarJohnsonSummand(0.1, -0.1), /non-negative/);
});

test('kj summand: equal p, q yields exactly 0', () => {
  assert.equal(kumarJohnsonSummand(0.4, 0.4), 0);
});

test('kj summand: equal p, q yields exactly 0 at small magnitude', () => {
  assert.equal(kumarJohnsonSummand(1e-6, 1e-6), 0);
});

test('kj summand: symmetric under swap', () => {
  const a = kumarJohnsonSummand(0.3, 0.7);
  const b = kumarJohnsonSummand(0.7, 0.3);
  assert.ok(Math.abs(a - b) < 1e-12);
});

test('kj summand: symmetric under swap (small values)', () => {
  const a = kumarJohnsonSummand(0.001, 0.5);
  const b = kumarJohnsonSummand(0.5, 0.001);
  assert.ok(Math.abs(a - b) < 1e-9);
});

test('kj summand: non-negative on disparate inputs', () => {
  assert.ok(kumarJohnsonSummand(0.01, 0.99) >= 0);
});

test('kj summand: non-negative on tiny inputs', () => {
  assert.ok(kumarJohnsonSummand(1e-10, 1e-3) >= 0);
});

test('kj summand: matches closed-form formula', () => {
  const p = 0.3;
  const q = 0.7;
  const expected =
    Math.pow(p * p - q * q, 2) / (2 * Math.pow(p * q, 1.5));
  const got = kumarJohnsonSummand(p, q);
  assert.ok(Math.abs(got - expected) < 1e-12);
});

test('kj summand: floors at KJ_PMF_FLOOR for tiny p', () => {
  // Very small p < KJ_PMF_FLOOR should be lifted to floor and stay finite.
  const r = kumarJohnsonSummand(0, 0.5);
  assert.ok(Number.isFinite(r));
  assert.ok(r > 0);
});

test('kj summand: floors at KJ_PMF_FLOOR for tiny q', () => {
  const r = kumarJohnsonSummand(0.5, 0);
  assert.ok(Number.isFinite(r));
  assert.ok(r > 0);
});

test('kj summand: zero p, zero q yields zero', () => {
  // Both floored to KJ_PMF_FLOOR -> equal -> 0.
  assert.equal(kumarJohnsonSummand(0, 0), 0);
});

test('kj summand: monotone in |p - q| at fixed p+q', () => {
  // Hold AM = 0.5; vary the gap.
  const small = kumarJohnsonSummand(0.45, 0.55);
  const large = kumarJohnsonSummand(0.1, 0.9);
  assert.ok(large > small);
});

test('kj summand: KJ_PMF_FLOOR is 1e-15', () => {
  assert.equal(KJ_PMF_FLOOR, 1e-15);
});

// ---------- builder: empty / minimal ----------

test('kj builder: empty queue yields empty sources', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
});

test('kj builder: drops invalid hour_start', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves([
    ql('not-a-date', 'src', 1000),
  ]);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('kj builder: drops non-positive tokens', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves([
    ql(dayIso(0), 'src', 0),
    ql(dayIso(1), 'src', -5),
  ]);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('kj builder: source filter increments droppedSourceFilter', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(
    [ql(dayIso(0), 'a', 1000), ql(dayIso(1), 'b', 1000)],
    { source: 'a' },
  );
  assert.equal(r.droppedSourceFilter, 1);
});

test('kj builder: drops sources below min-tokens', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) lines.push(ql(dayIso(i), 'src', 10));
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(lines, {
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('kj builder: drops sources below min-tenure-days', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) lines.push(ql(dayIso(i), 'src', 10000));
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(lines, {
    minTokens: 1000,
    minTenureDays: 14,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('kj builder: drops zero-variance sources', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) lines.push(ql(dayIso(i), 'src', 10000));
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(lines, {
    minTokens: 1000,
    minTenureDays: 14,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('kj builder: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenKumarJohnsonDivergenceHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('kj builder: rejects negative minTokens', () => {
  assert.throws(
    () =>
      buildDailyTokenKumarJohnsonDivergenceHalves([], { minTokens: -1 }),
    /non-negative/,
  );
});

test('kj builder: rejects minTenureDays < 8', () => {
  assert.throws(
    () =>
      buildDailyTokenKumarJohnsonDivergenceHalves([], { minTenureDays: 7 }),
    />= 8/,
  );
});

test('kj builder: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenKumarJohnsonDivergenceHalves([], { top: -1 }),
    /non-negative integer/,
  );
});

test('kj builder: rejects invalid since', () => {
  assert.throws(
    () =>
      buildDailyTokenKumarJohnsonDivergenceHalves([], { since: 'not-iso' }),
    /invalid since/,
  );
});

test('kj builder: rejects invalid until', () => {
  assert.throws(
    () =>
      buildDailyTokenKumarJohnsonDivergenceHalves([], { until: 'not-iso' }),
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

test('kj builder: produces rows for varied + bimodal sources', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 2);
});

test('kj builder: bimodal source has larger divergence than varied', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'source',
  });
  const a = r.sources.find((s) => s.source === 'src-a');
  const b = r.sources.find((s) => s.source === 'src-b');
  assert.ok(a !== undefined);
  assert.ok(b !== undefined);
  assert.ok(b!.kumarJohnsonDivergence > a!.kumarJohnsonDivergence);
});

test('kj builder: kjDesc sort puts highest divergence first', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'kjDesc',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      r.sources[i - 1]!.kumarJohnsonDivergence >=
        r.sources[i]!.kumarJohnsonDivergence,
    );
  }
});

test('kj builder: kj (asc) sort puts lowest divergence first', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'kj',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      r.sources[i - 1]!.kumarJohnsonDivergence <=
        r.sources[i]!.kumarJohnsonDivergence,
    );
  }
});

test('kj builder: maxBinDesc sort puts highest maxBin first', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'maxBinDesc',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      r.sources[i - 1]!.kumarJohnsonMaxBin >= r.sources[i]!.kumarJohnsonMaxBin,
    );
  }
});

test('kj builder: tokens sort puts highest totalTokens first', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'tokens',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.totalTokens >= r.sources[i]!.totalTokens);
  }
});

test('kj builder: tenure sort puts longest tenure first', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'tenure',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.nTenureDays >= r.sources[i]!.nTenureDays);
  }
});

test('kj builder: source sort puts sources alphabetical', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    sort: 'source',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.source <= r.sources[i]!.source);
  }
});

test('kj builder: top cap drops tail rows', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 1);
});

test('kj builder: source filter restricts to one source', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
    source: 'src-a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
});

test('kj builder: report records grid constants', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
  });
  assert.equal(r.gridK, KJ_GRID_K);
  assert.equal(r.silvermanMultiplier, KJ_SILVERMAN_MULTIPLIER);
  assert.equal(r.pmfFloor, KJ_PMF_FLOOR);
});

test('kj builder: generatedAt is the supplied value when provided', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves([], {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2026-05-03T00:00:00.000Z');
});

test('kj builder: windowStart and windowEnd echo since/until', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves([], {
    since: '2026-01-01T00:00:00.000Z',
    until: '2026-12-31T23:59:59.999Z',
  });
  assert.equal(r.windowStart, '2026-01-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-12-31T23:59:59.999Z');
});

test('kj builder: every row has a finite divergence', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
  });
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.kumarJohnsonDivergence));
    assert.ok(Number.isFinite(s.kumarJohnsonMaxBin));
    assert.ok(Number.isFinite(s.kumarJohnsonMaxRelGap));
    assert.ok(Number.isFinite(s.kumarJohnsonSpreadRatio));
  }
});

test('kj builder: every row has divergence >= 0', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
  });
  for (const s of r.sources) {
    assert.ok(s.kumarJohnsonDivergence >= 0);
  }
});

test('kj builder: every row has maxRelGap in [0, 1]', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
  });
  for (const s of r.sources) {
    assert.ok(s.kumarJohnsonMaxRelGap >= 0);
    assert.ok(s.kumarJohnsonMaxRelGap <= 1);
  }
});

test('kj builder: every row has spreadRatio in [0, 1]', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
  });
  for (const s of r.sources) {
    assert.ok(s.kumarJohnsonSpreadRatio >= 0);
    assert.ok(s.kumarJohnsonSpreadRatio <= 1);
  }
});

test('kj builder: row n1 + n2 equals nTenureDays', () => {
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(syntheticQueue(), {
    minTokens: 1000,
    minTenureDays: 14,
  });
  for (const s of r.sources) {
    assert.equal(s.kjN1 + s.kjN2, s.nTenureDays);
  }
});

test('kj builder: deterministic across two runs', () => {
  const q = syntheticQueue();
  const r1 = buildDailyTokenKumarJohnsonDivergenceHalves(q, {
    minTokens: 1000,
    minTenureDays: 14,
    generatedAt: 'fixed',
  });
  const r2 = buildDailyTokenKumarJohnsonDivergenceHalves(q, {
    minTokens: 1000,
    minTenureDays: 14,
    generatedAt: 'fixed',
  });
  assert.deepEqual(r1, r2);
});

// ---------- refinement: kumarJohnsonPerBinAverage ----------

test('kj primitive: kumarJohnsonPerBinAverage equals divergence / K', () => {
  const r = dailyTokenKumarJohnsonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
  ]);
  const expected = r.kumarJohnsonDivergence / KJ_GRID_K;
  assert.ok(Math.abs(r.kumarJohnsonPerBinAverage - expected) < 1e-12);
});

test('kj primitive: kumarJohnsonPerBinAverage non-negative', () => {
  const r = dailyTokenKumarJohnsonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
  assert.ok(r.kumarJohnsonPerBinAverage >= 0);
});

test('kj primitive: kumarJohnsonPerBinAverage finite on bimodal halves', () => {
  const xs = [
    1, 1, 2, 2, 3, 3, 4, 4, 100, 200, 300, 400, 500, 600, 700, 800,
  ];
  const r = dailyTokenKumarJohnsonDivergenceHalves(xs);
  assert.ok(Number.isFinite(r.kumarJohnsonPerBinAverage));
});

test('kj primitive: kumarJohnsonPerBinAverage translation invariant', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r1 = dailyTokenKumarJohnsonDivergenceHalves(xs);
  const r2 = dailyTokenKumarJohnsonDivergenceHalves(xs.map((x) => x + 500));
  assert.ok(Math.abs(r1.kumarJohnsonPerBinAverage - r2.kumarJohnsonPerBinAverage) < 1e-9);
});

test('kj primitive: kumarJohnsonPerBinAverage scale invariant', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r1 = dailyTokenKumarJohnsonDivergenceHalves(xs);
  const r2 = dailyTokenKumarJohnsonDivergenceHalves(xs.map((x) => x * 3.25));
  assert.ok(Math.abs(r1.kumarJohnsonPerBinAverage - r2.kumarJohnsonPerBinAverage) < 1e-9);
});

test('kj builder: every row has finite non-negative perBinAverage', () => {
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
  const r = buildDailyTokenKumarJohnsonDivergenceHalves(lines, {
    minTokens: 1000,
    minTenureDays: 14,
  });
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.kumarJohnsonPerBinAverage));
    assert.ok(s.kumarJohnsonPerBinAverage >= 0);
    assert.ok(
      Math.abs(
        s.kumarJohnsonPerBinAverage - s.kumarJohnsonDivergence / KJ_GRID_K,
      ) < 1e-9,
    );
  }
});
