import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenTotalVariationHalves,
  buildDailyTokenTotalVariationHalves,
  TV_GRID_K,
  TV_SILVERMAN_MULTIPLIER,
  TV_GRID_EXTENSION_H,
} from '../src/dailytokentotalvariationhalves.js';
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

test('tv primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenTotalVariationHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('tv primitive: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenTotalVariationHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () =>
      dailyTokenTotalVariationHalves([1, 2, 3, 4, Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('tv primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenTotalVariationHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('tv primitive: n1 = floor(n/2), n2 = n - n1 (even)', () => {
  const r = dailyTokenTotalVariationHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.tvN1, 5);
  assert.equal(r.tvN2, 5);
});

test('tv primitive: n1 = floor(n/2), n2 = n - n1 (odd)', () => {
  const r = dailyTokenTotalVariationHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.tvN1, 4);
  assert.equal(r.tvN2, 5);
});

test('tv primitive: tvGridK === 257', () => {
  const r = dailyTokenTotalVariationHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.tvGridK, 257);
});

test('tv primitive: tvBandwidth > 0', () => {
  const r = dailyTokenTotalVariationHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.tvBandwidth > 0);
});

test('tv primitive: grid endpoints flank min/max with 3*h padding', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10];
  const r = dailyTokenTotalVariationHalves(x);
  assert.ok(Math.abs(r.tvGridLo - (1 - 3 * r.tvBandwidth)) < 1e-10);
  assert.ok(Math.abs(r.tvGridHi - (10 + 3 * r.tvBandwidth)) < 1e-10);
});

// ---------- primitive: bounds and identities ----------

test('tv primitive: tvDist in [0, 1]', () => {
  const r = dailyTokenTotalVariationHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.tvDist >= 0);
  assert.ok(r.tvDist <= 1 + 1e-12);
});

test('tv primitive: identical halves give near-zero tvDist', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const x = [...half, ...half];
  const r = dailyTokenTotalVariationHalves(x);
  assert.ok(r.tvDist < 1e-10, `expected near zero, got ${r.tvDist}`);
});

test('tv primitive: well-separated halves produce sizeable tvDist', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r = dailyTokenTotalVariationHalves(x);
  assert.ok(r.tvDist > 0.5, `expected sizeable TV, got ${r.tvDist}`);
});

test('tv primitive: translation-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenTotalVariationHalves(x);
  const r2 = dailyTokenTotalVariationHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.tvDist - r2.tvDist) < 1e-8);
});

test('tv primitive: positive-scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenTotalVariationHalves(x);
  const r2 = dailyTokenTotalVariationHalves(x.map((v) => 7 * v));
  assert.ok(
    Math.abs(r1.tvDist - r2.tvDist) < 1e-8,
    `tv ${r1.tvDist} vs ${r2.tvDist}`,
  );
});

test('tv primitive: symmetric (reverse halves preserves tvDist)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r1 = dailyTokenTotalVariationHalves(x);
  const xSwap = [
    100, 101, 102, 103, 104, 105, 106, 107, 1, 2, 3, 4, 5, 6, 7, 8,
  ];
  const r2 = dailyTokenTotalVariationHalves(xSwap);
  assert.ok(Math.abs(r1.tvDist - r2.tvDist) < 1e-10);
});

test('tv primitive: tvMaxBin in [0, K-1]', () => {
  const r = dailyTokenTotalVariationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.tvMaxBin >= 0 && r.tvMaxBin < r.tvGridK);
});

test('tv primitive: tvMaxBinX is in [gridLo, gridHi]', () => {
  const r = dailyTokenTotalVariationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.tvMaxBinX >= r.tvGridLo - 1e-9);
  assert.ok(r.tvMaxBinX <= r.tvGridHi + 1e-9);
});

test('tv primitive: tvMaxBinValue >= 0', () => {
  const r = dailyTokenTotalVariationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.tvMaxBinValue >= 0);
});

test('tv primitive: tvMaxBinValue <= 0.5 (per-bin contribution bounded by 0.5)', () => {
  // Each per-bin contribution is 0.5 * |p_k - q_k| where p_k, q_k in
  // [0, 1] with sum_k p_k = sum_k q_k = 1, so |p_k - q_k| <= 1 and
  // contribution <= 0.5.
  const r = dailyTokenTotalVariationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(
    r.tvMaxBinValue <= 0.5 + 1e-10,
    `per-bin contribution ${r.tvMaxBinValue} exceeds 0.5`,
  );
});

test('tv primitive: median-bandwidth on integers is positive (n=10)', () => {
  const r = dailyTokenTotalVariationHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.tvMadPool > 0);
});

test('tv primitive: constants exposed', () => {
  assert.equal(TV_GRID_K, 257);
  assert.equal(TV_SILVERMAN_MULTIPLIER, 0.9);
  assert.equal(TV_GRID_EXTENSION_H, 3);
});

test('tv primitive: bandwidth scales linearly with positive scaling', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenTotalVariationHalves(x);
  const r2 = dailyTokenTotalVariationHalves(x.map((v) => 7 * v));
  assert.ok(Math.abs(r2.tvBandwidth / r1.tvBandwidth - 7) < 1e-8);
});

test('tv primitive: bandwidth invariant under translation', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenTotalVariationHalves(x);
  const r2 = dailyTokenTotalVariationHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.tvBandwidth - r2.tvBandwidth) < 1e-10);
});

// ---------- builder: input validation ----------

test('build: rejects negative minTokens', () => {
  assert.throws(
    () => buildDailyTokenTotalVariationHalves([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('build: rejects non-integer minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenTotalVariationHalves([], { minTenureDays: 7.5 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects below-floor minTenureDays', () => {
  assert.throws(
    () => buildDailyTokenTotalVariationHalves([], { minTenureDays: 7 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenTotalVariationHalves([], { top: -1 }),
    /top must be a non-negative integer/,
  );
});

test('build: rejects invalid sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenTotalVariationHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('build: rejects invalid since/until', () => {
  assert.throws(
    () =>
      buildDailyTokenTotalVariationHalves([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenTotalVariationHalves([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

// ---------- builder: end-to-end & sorting ----------

function makeQueueWithTwoSources(): QueueLine[] {
  const q: QueueLine[] = [];
  // src-a: clear half-shift
  for (let i = 0; i < 20; i += 1) {
    const v = i < 10 ? 100 + (i % 3) * 10 : 1000 + (i % 3) * 10;
    q.push(ql(dayIso(i), 'src-a', v));
  }
  // src-b: stable around a fixed value
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i), 'src-b', 500 + ((i * 7) % 11)));
  }
  return q;
}

test('build: returns rows for two-source fixture', () => {
  const r = buildDailyTokenTotalVariationHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.gridK, 257);
  assert.ok(Math.abs(r.silvermanMultiplier - 0.9) < 1e-12);
});

test('build: sort tvDistDesc puts biggest tvDist first', () => {
  const r = buildDailyTokenTotalVariationHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    sort: 'tvDistDesc',
  });
  assert.ok(r.sources[0]!.tvDist >= r.sources[1]!.tvDist);
});

test('build: sort tvDist asc puts smallest tvDist first', () => {
  const r = buildDailyTokenTotalVariationHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    sort: 'tvDist',
  });
  assert.ok(r.sources[0]!.tvDist <= r.sources[1]!.tvDist);
});

test('build: sort source asc orders alphabetically', () => {
  const r = buildDailyTokenTotalVariationHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.equal(r.sources[1]!.source, 'src-b');
});

test('build: drops sparse sources below minTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'tiny', 1));
  const r = buildDailyTokenTotalVariationHalves(q, { minTokens: 1000 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('build: drops below-min-tenure sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 6; i += 1) q.push(ql(dayIso(i), 'short', 5000));
  const r = buildDailyTokenTotalVariationHalves(q, {
    minTokens: 0,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: drops zero-variance sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'flat', 100));
  const r = buildDailyTokenTotalVariationHalves(q, { minTokens: 0 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: counts droppedNonPositiveTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'mixed', 100));
  q.push(ql(dayIso(20), 'mixed', 0));
  q.push(ql(dayIso(21), 'mixed', -5));
  const r = buildDailyTokenTotalVariationHalves(q, { minTokens: 0 });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: source filter restricts and counts droppedSourceFilter', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i), 'keep', 100 + i));
    q.push(ql(dayIso(i), 'drop', 100 + i));
  }
  const r = buildDailyTokenTotalVariationHalves(q, {
    minTokens: 0,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 20);
});

test('build: top truncates and counts droppedTopSources', () => {
  const q: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    for (let i = 0; i < 20; i += 1) {
      q.push(ql(dayIso(i), `src-${s}`, 100 + s * 10 + i));
    }
  }
  const r = buildDailyTokenTotalVariationHalves(q, {
    minTokens: 0,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('build: empty queue returns empty sources', () => {
  const r = buildDailyTokenTotalVariationHalves([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('build: generatedAt override is honoured', () => {
  const r = buildDailyTokenTotalVariationHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    generatedAt: '2030-01-01T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2030-01-01T00:00:00.000Z');
});

test('build: rows expose tvDist, tvMaxBinValue all finite & in-range', () => {
  const r = buildDailyTokenTotalVariationHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
  });
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.tvDist));
    assert.ok(Number.isFinite(s.tvMaxBinValue));
    assert.ok(s.tvDist >= 0 && s.tvDist <= 1 + 1e-12);
    assert.ok(s.tvMaxBinValue >= 0 && s.tvMaxBinValue <= 0.5 + 1e-10);
  }
});

test('build: respects all valid sort keys without throwing', () => {
  const q = makeQueueWithTwoSources();
  const sorts = [
    'tvDist',
    'tvDistDesc',
    'tvMaxBinValue',
    'tvMaxBinValueDesc',
    'tokens',
    'tenure',
    'source',
  ] as const;
  for (const s of sorts) {
    const r = buildDailyTokenTotalVariationHalves(q, {
      minTokens: 0,
      sort: s,
    });
    assert.equal(r.sort, s);
    assert.equal(r.sources.length, 2);
  }
});

// ---------- refinement: monotonicity & determinism ----------

test('refinement: bigger half-shift gives strictly larger tvDist', () => {
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const small = dailyTokenTotalVariationHalves([
    ...first,
    9, 10, 11, 12, 13, 14, 15, 16,
  ]);
  const big = dailyTokenTotalVariationHalves([
    ...first,
    100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(
    big.tvDist > small.tvDist,
    `expected big ${big.tvDist} > small ${small.tvDist}`,
  );
});

test('refinement: deterministic on identical input', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenTotalVariationHalves(x);
  const r2 = dailyTokenTotalVariationHalves(x);
  assert.equal(r1.tvDist, r2.tvDist);
  assert.equal(r1.tvMaxBin, r2.tvMaxBin);
});

test('refinement: tvDist monotone w.r.t. shift magnitude (3 levels)', () => {
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const r10 = dailyTokenTotalVariationHalves([
    ...first,
    11, 12, 13, 14, 15, 16, 17, 18,
  ]);
  const r50 = dailyTokenTotalVariationHalves([
    ...first,
    51, 52, 53, 54, 55, 56, 57, 58,
  ]);
  const r200 = dailyTokenTotalVariationHalves([
    ...first,
    201, 202, 203, 204, 205, 206, 207, 208,
  ]);
  assert.ok(r10.tvDist < r50.tvDist);
  assert.ok(r50.tvDist <= r200.tvDist + 1e-12);
});
