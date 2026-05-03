import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenHellingerDistanceHalves,
  buildDailyTokenHellingerDistanceHalves,
  H_GRID_K,
  H_SILVERMAN_MULTIPLIER,
  H_GRID_EXTENSION_H,
} from '../src/dailytokenhellingerdistancehalves.js';
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

test('h primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenHellingerDistanceHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('h primitive: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenHellingerDistanceHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () =>
      dailyTokenHellingerDistanceHalves([1, 2, 3, 4, Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('h primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenHellingerDistanceHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('h primitive: n1 = floor(n/2), n2 = n - n1 (even)', () => {
  const r = dailyTokenHellingerDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.hN1, 5);
  assert.equal(r.hN2, 5);
});

test('h primitive: n1 = floor(n/2), n2 = n - n1 (odd)', () => {
  const r = dailyTokenHellingerDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.hN1, 4);
  assert.equal(r.hN2, 5);
});

test('h primitive: hGridK === 257', () => {
  const r = dailyTokenHellingerDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.hGridK, 257);
});

test('h primitive: hBandwidth > 0', () => {
  const r = dailyTokenHellingerDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.hBandwidth > 0);
});

test('h primitive: grid endpoints flank min/max with 3*h padding', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10];
  const r = dailyTokenHellingerDistanceHalves(x);
  assert.ok(Math.abs(r.hGridLo - (1 - 3 * r.hBandwidth)) < 1e-10);
  assert.ok(Math.abs(r.hGridHi - (10 + 3 * r.hBandwidth)) < 1e-10);
});

// ---------- primitive: bounds and identities ----------

test('h primitive: hDist in [0, 1]', () => {
  const r = dailyTokenHellingerDistanceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.hDist >= 0);
  assert.ok(r.hDist <= 1 + 1e-12);
});

test('h primitive: hBhattacharyya in [0, 1]', () => {
  const r = dailyTokenHellingerDistanceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.hBhattacharyya >= 0);
  assert.ok(r.hBhattacharyya <= 1 + 1e-12);
});

test('h primitive: identical halves give near-zero hDist', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const x = [...half, ...half];
  const r = dailyTokenHellingerDistanceHalves(x);
  assert.ok(r.hDist < 1e-10, `expected near zero, got ${r.hDist}`);
});

test('h primitive: identical halves give near-one BC', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const x = [...half, ...half];
  const r = dailyTokenHellingerDistanceHalves(x);
  assert.ok(Math.abs(r.hBhattacharyya - 1) < 1e-10);
});

test('h primitive: well-separated halves produce sizeable hDist', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r = dailyTokenHellingerDistanceHalves(x);
  assert.ok(r.hDist > 0.5, `expected sizeable H, got ${r.hDist}`);
});

test('h primitive: algebraic identity hDist^2 + BC === 1', () => {
  const r = dailyTokenHellingerDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  const lhs = r.hDist * r.hDist + r.hBhattacharyya;
  assert.ok(
    Math.abs(lhs - 1) < 1e-10,
    `H^2 + BC = ${lhs} should equal 1`,
  );
});

test('h primitive: translation-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenHellingerDistanceHalves(x);
  const r2 = dailyTokenHellingerDistanceHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.hDist - r2.hDist) < 1e-8);
});

test('h primitive: positive-scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenHellingerDistanceHalves(x);
  const r2 = dailyTokenHellingerDistanceHalves(x.map((v) => 7 * v));
  assert.ok(
    Math.abs(r1.hDist - r2.hDist) < 1e-8,
    `H ${r1.hDist} vs ${r2.hDist}`,
  );
});

test('h primitive: BC translation- and positive-scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenHellingerDistanceHalves(x);
  const r2 = dailyTokenHellingerDistanceHalves(x.map((v) => 5 * v + 1000));
  assert.ok(Math.abs(r1.hBhattacharyya - r2.hBhattacharyya) < 1e-8);
});

test('h primitive: symmetric (reverse halves preserves hDist)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r1 = dailyTokenHellingerDistanceHalves(x);
  const xSwap = [
    100, 101, 102, 103, 104, 105, 106, 107, 1, 2, 3, 4, 5, 6, 7, 8,
  ];
  const r2 = dailyTokenHellingerDistanceHalves(xSwap);
  assert.ok(Math.abs(r1.hDist - r2.hDist) < 1e-10);
});

test('h primitive: hMaxBin in [0, K-1]', () => {
  const r = dailyTokenHellingerDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.hMaxBin >= 0 && r.hMaxBin < r.hGridK);
});

test('h primitive: hMaxBinX is in [gridLo, gridHi]', () => {
  const r = dailyTokenHellingerDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.hMaxBinX >= r.hGridLo - 1e-9);
  assert.ok(r.hMaxBinX <= r.hGridHi + 1e-9);
});

test('h primitive: hMaxBinValue >= 0', () => {
  const r = dailyTokenHellingerDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.hMaxBinValue >= 0);
});

test('h primitive: hMaxBinValue <= 0.5 (per-bin contribution bounded)', () => {
  // Each per-bin H^2 contribution is 0.5 * (sqrt p - sqrt q)^2.
  // Since sqrt p, sqrt q in [0, 1], the squared difference is at
  // most 1, and halving gives 0.5.
  const r = dailyTokenHellingerDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(
    r.hMaxBinValue <= 0.5 + 1e-10,
    `per-bin contribution ${r.hMaxBinValue} exceeds 0.5`,
  );
});

test('h primitive: median-bandwidth on integers is positive (n=10)', () => {
  const r = dailyTokenHellingerDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.hMadPool > 0);
});

test('h primitive: constants exposed', () => {
  assert.equal(H_GRID_K, 257);
  assert.equal(H_SILVERMAN_MULTIPLIER, 0.9);
  assert.equal(H_GRID_EXTENSION_H, 3);
});

test('h primitive: bandwidth scales linearly with positive scaling', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenHellingerDistanceHalves(x);
  const r2 = dailyTokenHellingerDistanceHalves(x.map((v) => 7 * v));
  assert.ok(Math.abs(r2.hBandwidth / r1.hBandwidth - 7) < 1e-8);
});

test('h primitive: bandwidth invariant under translation', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenHellingerDistanceHalves(x);
  const r2 = dailyTokenHellingerDistanceHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.hBandwidth - r2.hBandwidth) < 1e-10);
});

// ---------- builder: input validation ----------

test('build: rejects negative minTokens', () => {
  assert.throws(
    () => buildDailyTokenHellingerDistanceHalves([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('build: rejects non-integer minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenHellingerDistanceHalves([], { minTenureDays: 7.5 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects below-floor minTenureDays', () => {
  assert.throws(
    () => buildDailyTokenHellingerDistanceHalves([], { minTenureDays: 7 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenHellingerDistanceHalves([], { top: -1 }),
    /top must be a non-negative integer/,
  );
});

test('build: rejects invalid sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenHellingerDistanceHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('build: rejects invalid since/until', () => {
  assert.throws(
    () =>
      buildDailyTokenHellingerDistanceHalves([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenHellingerDistanceHalves([], { until: 'not-a-date' }),
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
  const r = buildDailyTokenHellingerDistanceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.gridK, 257);
  assert.ok(Math.abs(r.silvermanMultiplier - 0.9) < 1e-12);
});

test('build: sort hDistDesc puts biggest hDist first', () => {
  const r = buildDailyTokenHellingerDistanceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    sort: 'hDistDesc',
  });
  assert.ok(r.sources[0]!.hDist >= r.sources[1]!.hDist);
});

test('build: sort hDist asc puts smallest hDist first', () => {
  const r = buildDailyTokenHellingerDistanceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    sort: 'hDist',
  });
  assert.ok(r.sources[0]!.hDist <= r.sources[1]!.hDist);
});

test('build: sort source asc orders alphabetically', () => {
  const r = buildDailyTokenHellingerDistanceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.equal(r.sources[1]!.source, 'src-b');
});

test('build: drops sparse sources below minTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'tiny', 1));
  const r = buildDailyTokenHellingerDistanceHalves(q, { minTokens: 1000 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('build: drops below-min-tenure sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 6; i += 1) q.push(ql(dayIso(i), 'short', 5000));
  const r = buildDailyTokenHellingerDistanceHalves(q, {
    minTokens: 0,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: drops zero-variance sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'flat', 100));
  const r = buildDailyTokenHellingerDistanceHalves(q, { minTokens: 0 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: counts droppedNonPositiveTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'mixed', 100));
  q.push(ql(dayIso(20), 'mixed', 0));
  q.push(ql(dayIso(21), 'mixed', -5));
  const r = buildDailyTokenHellingerDistanceHalves(q, { minTokens: 0 });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: source filter restricts and counts droppedSourceFilter', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i), 'keep', 100 + i));
    q.push(ql(dayIso(i), 'drop', 100 + i));
  }
  const r = buildDailyTokenHellingerDistanceHalves(q, {
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
  const r = buildDailyTokenHellingerDistanceHalves(q, {
    minTokens: 0,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('build: empty queue returns empty sources', () => {
  const r = buildDailyTokenHellingerDistanceHalves([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('build: generatedAt override is honoured', () => {
  const r = buildDailyTokenHellingerDistanceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    generatedAt: '2030-01-01T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2030-01-01T00:00:00.000Z');
});

test('build: rows expose hDist, hBhattacharyya, hMaxBinValue all finite & in-range', () => {
  const r = buildDailyTokenHellingerDistanceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
  });
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.hDist));
    assert.ok(Number.isFinite(s.hBhattacharyya));
    assert.ok(Number.isFinite(s.hMaxBinValue));
    assert.ok(s.hDist >= 0 && s.hDist <= 1 + 1e-12);
    assert.ok(s.hBhattacharyya >= 0 && s.hBhattacharyya <= 1 + 1e-12);
    assert.ok(s.hMaxBinValue >= 0 && s.hMaxBinValue <= 0.5 + 1e-10);
  }
});

test('build: respects all valid sort keys without throwing', () => {
  const q = makeQueueWithTwoSources();
  const sorts = [
    'hDist',
    'hDistDesc',
    'hMaxBinValue',
    'hMaxBinValueDesc',
    'tokens',
    'tenure',
    'source',
  ] as const;
  for (const s of sorts) {
    const r = buildDailyTokenHellingerDistanceHalves(q, {
      minTokens: 0,
      sort: s,
    });
    assert.equal(r.sort, s);
    assert.equal(r.sources.length, 2);
  }
});

test('build: rows preserve hDist^2 + BC = 1 identity', () => {
  const r = buildDailyTokenHellingerDistanceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
  });
  for (const s of r.sources) {
    const sum = s.hDist * s.hDist + s.hBhattacharyya;
    assert.ok(
      Math.abs(sum - 1) < 1e-10,
      `source ${s.source}: H^2+BC=${sum}`,
    );
  }
});

// ---------- refinement: monotonicity & determinism ----------

test('refinement: bigger half-shift gives strictly larger hDist', () => {
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const small = dailyTokenHellingerDistanceHalves([
    ...first,
    9, 10, 11, 12, 13, 14, 15, 16,
  ]);
  const big = dailyTokenHellingerDistanceHalves([
    ...first,
    100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(
    big.hDist > small.hDist,
    `expected big ${big.hDist} > small ${small.hDist}`,
  );
});

test('refinement: deterministic on identical input', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenHellingerDistanceHalves(x);
  const r2 = dailyTokenHellingerDistanceHalves(x);
  assert.equal(r1.hDist, r2.hDist);
  assert.equal(r1.hMaxBin, r2.hMaxBin);
  assert.equal(r1.hBhattacharyya, r2.hBhattacharyya);
});

test('refinement: hDist monotone w.r.t. shift magnitude (3 levels)', () => {
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const r10 = dailyTokenHellingerDistanceHalves([
    ...first,
    11, 12, 13, 14, 15, 16, 17, 18,
  ]);
  const r50 = dailyTokenHellingerDistanceHalves([
    ...first,
    51, 52, 53, 54, 55, 56, 57, 58,
  ]);
  const r200 = dailyTokenHellingerDistanceHalves([
    ...first,
    201, 202, 203, 204, 205, 206, 207, 208,
  ]);
  assert.ok(r10.hDist < r50.hDist);
  assert.ok(r50.hDist <= r200.hDist + 1e-12);
});

test('refinement: BC monotone-decreasing with shift magnitude', () => {
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const r10 = dailyTokenHellingerDistanceHalves([
    ...first,
    11, 12, 13, 14, 15, 16, 17, 18,
  ]);
  const r200 = dailyTokenHellingerDistanceHalves([
    ...first,
    201, 202, 203, 204, 205, 206, 207, 208,
  ]);
  assert.ok(r200.hBhattacharyya < r10.hBhattacharyya);
});

// ---------- Le Cam sandwich: H^2 <= TV <= sqrt(2) * H ----------

test('lecam: hDist^2 <= sqrt(2) * hDist (trivial slack of the upper bound)', () => {
  // hDist^2 <= hDist always (since hDist in [0,1]); just sanity.
  const r = dailyTokenHellingerDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.hDist * r.hDist <= Math.SQRT2 * r.hDist + 1e-12);
});

test('lecam: identical halves saturate the lower bound (H = 0)', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenHellingerDistanceHalves([...half, ...half]);
  assert.ok(r.hDist < 1e-10);
});
