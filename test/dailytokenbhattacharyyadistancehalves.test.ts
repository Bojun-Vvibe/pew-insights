import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenBhattacharyyaDistanceHalves,
  buildDailyTokenBhattacharyyaDistanceHalves,
  BDIST_GRID_K,
  BDIST_SILVERMAN_MULTIPLIER,
  BDIST_GRID_EXTENSION_H,
  BDIST_BC_FLOOR,
} from '../src/dailytokenbhattacharyyadistancehalves.js';
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

test('bDist primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenBhattacharyyaDistanceHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('bDist primitive: rejects non-finite values', () => {
  assert.throws(
    () =>
      dailyTokenBhattacharyyaDistanceHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () =>
      dailyTokenBhattacharyyaDistanceHalves([
        1, 2, 3, 4, Infinity, 6, 7, 8,
      ]),
    /finite values/,
  );
});

test('bDist primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenBhattacharyyaDistanceHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('bDist primitive: n1 = floor(n/2), n2 = n - n1 (even)', () => {
  const r = dailyTokenBhattacharyyaDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.equal(r.bDistN1, 5);
  assert.equal(r.bDistN2, 5);
});

test('bDist primitive: n1 = floor(n/2), n2 = n - n1 (odd)', () => {
  const r = dailyTokenBhattacharyyaDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9,
  ]);
  assert.equal(r.bDistN1, 4);
  assert.equal(r.bDistN2, 5);
});

test('bDist primitive: gridK === 257', () => {
  const r = dailyTokenBhattacharyyaDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.equal(r.bDistGridK, 257);
});

test('bDist primitive: bandwidth > 0', () => {
  const r = dailyTokenBhattacharyyaDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.ok(r.bDistBandwidth > 0);
});

test('bDist primitive: grid endpoints flank min/max with 3*h padding', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10];
  const r = dailyTokenBhattacharyyaDistanceHalves(x);
  assert.ok(Math.abs(r.bDistGridLo - (1 - 3 * r.bDistBandwidth)) < 1e-10);
  assert.ok(Math.abs(r.bDistGridHi - (10 + 3 * r.bDistBandwidth)) < 1e-10);
});

// ---------- primitive: bounds and identities ----------

test('bDist primitive: BC in [0, 1]', () => {
  const r = dailyTokenBhattacharyyaDistanceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.bcCoefficient >= 0);
  assert.ok(r.bcCoefficient <= 1 + 1e-12);
});

test('bDist primitive: bDist >= 0', () => {
  const r = dailyTokenBhattacharyyaDistanceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.bDist >= -1e-12);
});

test('bDist primitive: identical halves give BC near 1 and bDist near 0', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const x = [...half, ...half];
  const r = dailyTokenBhattacharyyaDistanceHalves(x);
  assert.ok(Math.abs(r.bcCoefficient - 1) < 1e-9, `BC=${r.bcCoefficient}`);
  assert.ok(r.bDist < 1e-9, `bDist=${r.bDist}`);
});

test('bDist primitive: well-separated halves produce BC < 1 and bDist > 0.1', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r = dailyTokenBhattacharyyaDistanceHalves(x);
  assert.ok(r.bcCoefficient < 0.9, `expected small BC, got ${r.bcCoefficient}`);
  assert.ok(r.bDist > 0.1, `expected sizeable bDist, got ${r.bDist}`);
});

test('bDist primitive: nearly-disjoint halves drive bDist large', () => {
  const r = dailyTokenBhattacharyyaDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 1e6, 1e6 + 1, 1e6 + 2, 1e6 + 3, 1e6 + 4, 1e6 + 5,
    1e6 + 6, 1e6 + 7,
  ]);
  assert.ok(r.bDist > 0.5, `expected bDist > 0.5, got ${r.bDist}`);
  assert.ok(Number.isFinite(r.bDist));
});

test('bDist primitive: translation-invariant (BC and bDist)', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenBhattacharyyaDistanceHalves(x);
  const r2 = dailyTokenBhattacharyyaDistanceHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.bcCoefficient - r2.bcCoefficient) < 1e-8);
  assert.ok(Math.abs(r1.bDist - r2.bDist) < 1e-8);
});

test('bDist primitive: positive-scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenBhattacharyyaDistanceHalves(x);
  const r2 = dailyTokenBhattacharyyaDistanceHalves(x.map((v) => 7 * v));
  assert.ok(Math.abs(r1.bcCoefficient - r2.bcCoefficient) < 1e-8);
  assert.ok(Math.abs(r1.bDist - r2.bDist) < 1e-8);
});

test('bDist primitive: symmetric (reverse halves preserves bDist)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r1 = dailyTokenBhattacharyyaDistanceHalves(x);
  const xSwap = [
    100, 101, 102, 103, 104, 105, 106, 107, 1, 2, 3, 4, 5, 6, 7, 8,
  ];
  const r2 = dailyTokenBhattacharyyaDistanceHalves(xSwap);
  assert.ok(Math.abs(r1.bDist - r2.bDist) < 1e-10);
  assert.ok(Math.abs(r1.bcCoefficient - r2.bcCoefficient) < 1e-10);
});

test('bDist primitive: median-bandwidth on integers is positive (n=10)', () => {
  const r = dailyTokenBhattacharyyaDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.ok(r.bDistMadPool > 0);
});

test('bDist primitive: constants exposed', () => {
  assert.equal(BDIST_GRID_K, 257);
  assert.equal(BDIST_SILVERMAN_MULTIPLIER, 0.9);
  assert.equal(BDIST_GRID_EXTENSION_H, 3);
  assert.equal(BDIST_BC_FLOOR, 1e-300);
});

test('bDist primitive: bandwidth scales linearly with positive scaling', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenBhattacharyyaDistanceHalves(x);
  const r2 = dailyTokenBhattacharyyaDistanceHalves(x.map((v) => 7 * v));
  assert.ok(Math.abs(r2.bDistBandwidth / r1.bDistBandwidth - 7) < 1e-8);
});

test('bDist primitive: bandwidth invariant under translation', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenBhattacharyyaDistanceHalves(x);
  const r2 = dailyTokenBhattacharyyaDistanceHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.bDistBandwidth - r2.bDistBandwidth) < 1e-10);
});

// ---------- builder: input validation ----------

test('build: rejects negative minTokens', () => {
  assert.throws(
    () =>
      buildDailyTokenBhattacharyyaDistanceHalves([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('build: rejects non-integer minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenBhattacharyyaDistanceHalves([], {
        minTenureDays: 7.5,
      }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects below-floor minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenBhattacharyyaDistanceHalves([], { minTenureDays: 7 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenBhattacharyyaDistanceHalves([], { top: -1 }),
    /top must be a non-negative integer/,
  );
});

test('build: rejects invalid sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenBhattacharyyaDistanceHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('build: rejects invalid since/until', () => {
  assert.throws(
    () =>
      buildDailyTokenBhattacharyyaDistanceHalves([], {
        since: 'not-a-date',
      }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenBhattacharyyaDistanceHalves([], {
        until: 'not-a-date',
      }),
    /invalid until/,
  );
});

// ---------- builder: end-to-end & sorting ----------

function makeQueueWithTwoSources(): QueueLine[] {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    const v = i < 10 ? 100 + (i % 3) * 10 : 1000 + (i % 3) * 10;
    q.push(ql(dayIso(i), 'src-a', v));
  }
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i), 'src-b', 500 + ((i * 7) % 11)));
  }
  return q;
}

test('build: returns rows for two-source fixture', () => {
  const r = buildDailyTokenBhattacharyyaDistanceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  assert.equal(r.sources.length, 2);
  assert.equal(r.gridK, 257);
  assert.ok(Math.abs(r.silvermanMultiplier - 0.9) < 1e-12);
});

test('build: sort bDistDesc puts biggest bDist first', () => {
  const r = buildDailyTokenBhattacharyyaDistanceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'bDistDesc' },
  );
  assert.ok(r.sources[0]!.bDist >= r.sources[1]!.bDist);
});

test('build: sort bDist asc puts smallest bDist first', () => {
  const r = buildDailyTokenBhattacharyyaDistanceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'bDist' },
  );
  assert.ok(r.sources[0]!.bDist <= r.sources[1]!.bDist);
});

test('build: sort bcCoefficient asc puts smallest BC first', () => {
  const r = buildDailyTokenBhattacharyyaDistanceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'bcCoefficient' },
  );
  assert.ok(r.sources[0]!.bcCoefficient <= r.sources[1]!.bcCoefficient);
});

test('build: sort bcCoefficientDesc puts biggest BC first', () => {
  const r = buildDailyTokenBhattacharyyaDistanceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'bcCoefficientDesc' },
  );
  assert.ok(r.sources[0]!.bcCoefficient >= r.sources[1]!.bcCoefficient);
});

test('build: sort source asc orders alphabetically', () => {
  const r = buildDailyTokenBhattacharyyaDistanceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'source' },
  );
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.equal(r.sources[1]!.source, 'src-b');
});

test('build: drops sparse sources below minTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'tiny', 1));
  const r = buildDailyTokenBhattacharyyaDistanceHalves(q, {
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('build: drops below-min-tenure sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 6; i += 1) q.push(ql(dayIso(i), 'short', 5000));
  const r = buildDailyTokenBhattacharyyaDistanceHalves(q, {
    minTokens: 0,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: drops zero-variance sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'flat', 100));
  const r = buildDailyTokenBhattacharyyaDistanceHalves(q, {
    minTokens: 0,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: counts droppedNonPositiveTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'mixed', 100));
  q.push(ql(dayIso(20), 'mixed', 0));
  q.push(ql(dayIso(21), 'mixed', -5));
  const r = buildDailyTokenBhattacharyyaDistanceHalves(q, {
    minTokens: 0,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: source filter restricts and counts droppedSourceFilter', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i), 'keep', 100 + i));
    q.push(ql(dayIso(i), 'drop', 100 + i));
  }
  const r = buildDailyTokenBhattacharyyaDistanceHalves(q, {
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
  const r = buildDailyTokenBhattacharyyaDistanceHalves(q, {
    minTokens: 0,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('build: empty queue returns empty sources', () => {
  const r = buildDailyTokenBhattacharyyaDistanceHalves([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('build: generatedAt override is honoured', () => {
  const r = buildDailyTokenBhattacharyyaDistanceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, generatedAt: '2030-01-01T00:00:00.000Z' },
  );
  assert.equal(r.generatedAt, '2030-01-01T00:00:00.000Z');
});

test('build: rows expose bcCoefficient, bDist, bDistNormalized all finite & in-range', () => {
  const r = buildDailyTokenBhattacharyyaDistanceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.bcCoefficient));
    assert.ok(Number.isFinite(s.bDist));
    assert.ok(Number.isFinite(s.bDistNormalized));
    assert.ok(s.bcCoefficient >= 0 && s.bcCoefficient <= 1 + 1e-12);
    assert.ok(s.bDist >= -1e-12);
    assert.ok(s.bDistNormalized >= 0 && s.bDistNormalized <= 1 + 1e-12);
  }
});

test('build: respects all valid sort keys without throwing', () => {
  const q = makeQueueWithTwoSources();
  const sorts = [
    'bDist',
    'bDistDesc',
    'bcCoefficient',
    'bcCoefficientDesc',
    'tokens',
    'tenure',
    'source',
  ] as const;
  for (const s of sorts) {
    const r = buildDailyTokenBhattacharyyaDistanceHalves(q, {
      minTokens: 0,
      sort: s,
    });
    assert.equal(r.sort, s);
    assert.equal(r.sources.length, 2);
  }
});

// ---------- refinement: monotonicity & determinism ----------

test('refinement: bigger half-shift gives strictly larger bDist', () => {
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const small = dailyTokenBhattacharyyaDistanceHalves([
    ...first,
    9, 10, 11, 12, 13, 14, 15, 16,
  ]);
  const big = dailyTokenBhattacharyyaDistanceHalves([
    ...first,
    100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(
    big.bDist > small.bDist,
    `expected big ${big.bDist} > small ${small.bDist}`,
  );
});

test('refinement: bigger half-shift gives strictly smaller BC', () => {
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const small = dailyTokenBhattacharyyaDistanceHalves([
    ...first,
    9, 10, 11, 12, 13, 14, 15, 16,
  ]);
  const big = dailyTokenBhattacharyyaDistanceHalves([
    ...first,
    100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(big.bcCoefficient < small.bcCoefficient);
});

test('refinement: deterministic on identical input', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenBhattacharyyaDistanceHalves(x);
  const r2 = dailyTokenBhattacharyyaDistanceHalves(x);
  assert.equal(r1.bcCoefficient, r2.bcCoefficient);
  assert.equal(r1.bDist, r2.bDist);
  assert.equal(r1.bDistNormalized, r2.bDistNormalized);
});

test('refinement: bDist monotone w.r.t. shift magnitude (3 levels)', () => {
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const r10 = dailyTokenBhattacharyyaDistanceHalves([
    ...first,
    11, 12, 13, 14, 15, 16, 17, 18,
  ]);
  const r50 = dailyTokenBhattacharyyaDistanceHalves([
    ...first,
    51, 52, 53, 54, 55, 56, 57, 58,
  ]);
  const r200 = dailyTokenBhattacharyyaDistanceHalves([
    ...first,
    201, 202, 203, 204, 205, 206, 207, 208,
  ]);
  assert.ok(r10.bDist < r50.bDist);
  assert.ok(r50.bDist <= r200.bDist + 1e-12);
});

// ---------- log-identity & relation to Hellinger ----------

test('relation: bDist === -ln(bcCoefficient) (log-identity)', () => {
  const r = dailyTokenBhattacharyyaDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 50, 51, 52, 53, 54, 55, 56, 57,
  ]);
  assert.ok(Math.abs(r.bDist - -Math.log(r.bcCoefficient)) < 1e-12);
});

test('relation: bDistNormalized === 1 - bcCoefficient (Hellinger-squared)', () => {
  const r = dailyTokenBhattacharyyaDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 50, 51, 52, 53, 54, 55, 56, 57,
  ]);
  assert.ok(Math.abs(r.bDistNormalized - (1 - r.bcCoefficient)) < 1e-12);
});

test('relation: identical halves saturate the lower bound (bDist = 0, BC = 1)', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenBhattacharyyaDistanceHalves([...half, ...half]);
  assert.ok(r.bDist < 1e-9);
  assert.ok(Math.abs(r.bcCoefficient - 1) < 1e-9);
});

// ---------- refactor follow-up: bDistNormalized diagnostic ----------

test('refactor: bDistNormalized translation- and positive-scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenBhattacharyyaDistanceHalves(x);
  const r2 = dailyTokenBhattacharyyaDistanceHalves(
    x.map((v) => 5 * v + 1000),
  );
  assert.ok(Math.abs(r1.bDistNormalized - r2.bDistNormalized) < 1e-8);
});

test('refactor: rows expose bDistNormalized in [0, 1]', () => {
  const r = buildDailyTokenBhattacharyyaDistanceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.bDistNormalized));
    assert.ok(s.bDistNormalized >= 0);
    assert.ok(s.bDistNormalized <= 1 + 1e-12);
  }
});

// ---------- diagnostic: bDistNormalized in [0, 1] ----------

test('diagnostic: bDistNormalized === 1 - BC in [0, 1]', () => {
  const r = dailyTokenBhattacharyyaDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(Math.abs(r.bDistNormalized - (1 - r.bcCoefficient)) < 1e-12);
  assert.ok(r.bDistNormalized >= 0);
  assert.ok(r.bDistNormalized <= 1 + 1e-12);
});

test('diagnostic: bDistNormalized is 0 for identical halves', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenBhattacharyyaDistanceHalves([...half, ...half]);
  assert.ok(r.bDistNormalized < 1e-9);
});

test('diagnostic: bDistNormalized translation- and scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenBhattacharyyaDistanceHalves(x);
  const r2 = dailyTokenBhattacharyyaDistanceHalves(
    x.map((v) => 5 * v + 1000),
  );
  assert.ok(Math.abs(r1.bDistNormalized - r2.bDistNormalized) < 1e-8);
});

test('diagnostic: rows expose bDistNormalized in [0, 1] coherently with BC', () => {
  const r = buildDailyTokenBhattacharyyaDistanceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.bDistNormalized));
    assert.ok(s.bDistNormalized >= 0);
    assert.ok(s.bDistNormalized <= 1 + 1e-12);
    assert.ok(Math.abs(s.bDistNormalized - (1 - s.bcCoefficient)) < 1e-12);
  }
});

// ---------- Cauchy-Schwarz / BC bounds ----------

test('cauchy-schwarz: BC respects sum_k sqrt(p*q) <= sqrt(sum p)*sqrt(sum q) = 1', () => {
  const r = dailyTokenBhattacharyyaDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.bcCoefficient <= 1 + 1e-12);
});

test('cauchy-schwarz: BC >= 0 for non-negative pmfs', () => {
  const r = dailyTokenBhattacharyyaDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.bcCoefficient >= 0);
});
