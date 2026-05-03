import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenTriangularDiscriminationHalves,
  buildDailyTokenTriangularDiscriminationHalves,
  DELTA_GRID_K,
  DELTA_SILVERMAN_MULTIPLIER,
  DELTA_GRID_EXTENSION_H,
} from '../src/dailytokentriangulardiscriminationhalves.js';
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

test('delta primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenTriangularDiscriminationHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('delta primitive: rejects non-finite values', () => {
  assert.throws(
    () =>
      dailyTokenTriangularDiscriminationHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () =>
      dailyTokenTriangularDiscriminationHalves([
        1, 2, 3, 4, Infinity, 6, 7, 8,
      ]),
    /finite values/,
  );
});

test('delta primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenTriangularDiscriminationHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('delta primitive: n1 = floor(n/2), n2 = n - n1 (even)', () => {
  const r = dailyTokenTriangularDiscriminationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.equal(r.deltaN1, 5);
  assert.equal(r.deltaN2, 5);
});

test('delta primitive: n1 = floor(n/2), n2 = n - n1 (odd)', () => {
  const r = dailyTokenTriangularDiscriminationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9,
  ]);
  assert.equal(r.deltaN1, 4);
  assert.equal(r.deltaN2, 5);
});

test('delta primitive: deltaGridK === 257', () => {
  const r = dailyTokenTriangularDiscriminationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.equal(r.deltaGridK, 257);
});

test('delta primitive: deltaBandwidth > 0', () => {
  const r = dailyTokenTriangularDiscriminationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.ok(r.deltaBandwidth > 0);
});

test('delta primitive: grid endpoints flank min/max with 3*h padding', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10];
  const r = dailyTokenTriangularDiscriminationHalves(x);
  assert.ok(Math.abs(r.deltaGridLo - (1 - 3 * r.deltaBandwidth)) < 1e-10);
  assert.ok(Math.abs(r.deltaGridHi - (10 + 3 * r.deltaBandwidth)) < 1e-10);
});

// ---------- primitive: bounds and identities ----------

test('delta primitive: delta in [0, 2]', () => {
  const r = dailyTokenTriangularDiscriminationHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.delta >= 0);
  assert.ok(r.delta <= 2 + 1e-12);
});

test('delta primitive: deltaMetric === sqrt(delta)', () => {
  const r = dailyTokenTriangularDiscriminationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(Math.abs(r.deltaMetric - Math.sqrt(r.delta)) < 1e-12);
});

test('delta primitive: identical halves give near-zero delta', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const x = [...half, ...half];
  const r = dailyTokenTriangularDiscriminationHalves(x);
  assert.ok(r.delta < 1e-10, `expected near zero, got ${r.delta}`);
});

test('delta primitive: well-separated halves produce sizeable delta', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r = dailyTokenTriangularDiscriminationHalves(x);
  assert.ok(r.delta > 0.5, `expected sizeable Delta, got ${r.delta}`);
});

test('delta primitive: translation-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenTriangularDiscriminationHalves(x);
  const r2 = dailyTokenTriangularDiscriminationHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.delta - r2.delta) < 1e-8);
});

test('delta primitive: positive-scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenTriangularDiscriminationHalves(x);
  const r2 = dailyTokenTriangularDiscriminationHalves(x.map((v) => 7 * v));
  assert.ok(
    Math.abs(r1.delta - r2.delta) < 1e-8,
    `delta ${r1.delta} vs ${r2.delta}`,
  );
});

test('delta primitive: symmetric (reverse halves preserves delta)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r1 = dailyTokenTriangularDiscriminationHalves(x);
  const xSwap = [
    100, 101, 102, 103, 104, 105, 106, 107, 1, 2, 3, 4, 5, 6, 7, 8,
  ];
  const r2 = dailyTokenTriangularDiscriminationHalves(xSwap);
  assert.ok(Math.abs(r1.delta - r2.delta) < 1e-10);
});

test('delta primitive: deltaMaxBin in [0, K-1]', () => {
  const r = dailyTokenTriangularDiscriminationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.deltaMaxBin >= 0 && r.deltaMaxBin < r.deltaGridK);
});

test('delta primitive: deltaMaxBinX is in [gridLo, gridHi]', () => {
  const r = dailyTokenTriangularDiscriminationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.deltaMaxBinX >= r.deltaGridLo - 1e-9);
  assert.ok(r.deltaMaxBinX <= r.deltaGridHi + 1e-9);
});

test('delta primitive: deltaMaxBinValue >= 0', () => {
  const r = dailyTokenTriangularDiscriminationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.deltaMaxBinValue >= 0);
});

test('delta primitive: median-bandwidth on integers is positive (n=10)', () => {
  const r = dailyTokenTriangularDiscriminationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.ok(r.deltaMadPool > 0);
});

test('delta primitive: constants exposed', () => {
  assert.equal(DELTA_GRID_K, 257);
  assert.equal(DELTA_SILVERMAN_MULTIPLIER, 0.9);
  assert.equal(DELTA_GRID_EXTENSION_H, 3);
});

test('delta primitive: bandwidth scales linearly with positive scaling', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenTriangularDiscriminationHalves(x);
  const r2 = dailyTokenTriangularDiscriminationHalves(x.map((v) => 7 * v));
  assert.ok(Math.abs(r2.deltaBandwidth / r1.deltaBandwidth - 7) < 1e-8);
});

test('delta primitive: bandwidth invariant under translation', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenTriangularDiscriminationHalves(x);
  const r2 = dailyTokenTriangularDiscriminationHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.deltaBandwidth - r2.deltaBandwidth) < 1e-10);
});

// ---------- builder: input validation ----------

test('build: rejects negative minTokens', () => {
  assert.throws(
    () =>
      buildDailyTokenTriangularDiscriminationHalves([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('build: rejects non-integer minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenTriangularDiscriminationHalves([], {
        minTenureDays: 7.5,
      }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects below-floor minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenTriangularDiscriminationHalves([], { minTenureDays: 7 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenTriangularDiscriminationHalves([], { top: -1 }),
    /top must be a non-negative integer/,
  );
});

test('build: rejects invalid sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenTriangularDiscriminationHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('build: rejects invalid since/until', () => {
  assert.throws(
    () =>
      buildDailyTokenTriangularDiscriminationHalves([], {
        since: 'not-a-date',
      }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenTriangularDiscriminationHalves([], {
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
  const r = buildDailyTokenTriangularDiscriminationHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  assert.equal(r.sources.length, 2);
  assert.equal(r.gridK, 257);
  assert.ok(Math.abs(r.silvermanMultiplier - 0.9) < 1e-12);
});

test('build: sort deltaDesc puts biggest delta first', () => {
  const r = buildDailyTokenTriangularDiscriminationHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'deltaDesc' },
  );
  assert.ok(r.sources[0]!.delta >= r.sources[1]!.delta);
});

test('build: sort delta asc puts smallest delta first', () => {
  const r = buildDailyTokenTriangularDiscriminationHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'delta' },
  );
  assert.ok(r.sources[0]!.delta <= r.sources[1]!.delta);
});

test('build: sort source asc orders alphabetically', () => {
  const r = buildDailyTokenTriangularDiscriminationHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'source' },
  );
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.equal(r.sources[1]!.source, 'src-b');
});

test('build: drops sparse sources below minTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'tiny', 1));
  const r = buildDailyTokenTriangularDiscriminationHalves(q, {
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('build: drops below-min-tenure sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 6; i += 1) q.push(ql(dayIso(i), 'short', 5000));
  const r = buildDailyTokenTriangularDiscriminationHalves(q, {
    minTokens: 0,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: drops zero-variance sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'flat', 100));
  const r = buildDailyTokenTriangularDiscriminationHalves(q, {
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
  const r = buildDailyTokenTriangularDiscriminationHalves(q, {
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
  const r = buildDailyTokenTriangularDiscriminationHalves(q, {
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
  const r = buildDailyTokenTriangularDiscriminationHalves(q, {
    minTokens: 0,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('build: empty queue returns empty sources', () => {
  const r = buildDailyTokenTriangularDiscriminationHalves([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('build: generatedAt override is honoured', () => {
  const r = buildDailyTokenTriangularDiscriminationHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, generatedAt: '2030-01-01T00:00:00.000Z' },
  );
  assert.equal(r.generatedAt, '2030-01-01T00:00:00.000Z');
});

test('build: rows expose delta, deltaMetric, deltaMaxBinValue all finite & in-range', () => {
  const r = buildDailyTokenTriangularDiscriminationHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.delta));
    assert.ok(Number.isFinite(s.deltaMetric));
    assert.ok(Number.isFinite(s.deltaMaxBinValue));
    assert.ok(s.delta >= 0 && s.delta <= 2 + 1e-12);
    assert.ok(s.deltaMetric >= 0 && s.deltaMetric <= Math.SQRT2 + 1e-10);
    assert.ok(s.deltaMaxBinValue >= 0);
  }
});

test('build: respects all valid sort keys without throwing', () => {
  const q = makeQueueWithTwoSources();
  const sorts = [
    'delta',
    'deltaDesc',
    'deltaMaxBinValue',
    'deltaMaxBinValueDesc',
    'tokens',
    'tenure',
    'source',
  ] as const;
  for (const s of sorts) {
    const r = buildDailyTokenTriangularDiscriminationHalves(q, {
      minTokens: 0,
      sort: s,
    });
    assert.equal(r.sort, s);
    assert.equal(r.sources.length, 2);
  }
});

// ---------- refinement: monotonicity & determinism ----------

test('refinement: bigger half-shift gives strictly larger delta', () => {
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const small = dailyTokenTriangularDiscriminationHalves([
    ...first,
    9, 10, 11, 12, 13, 14, 15, 16,
  ]);
  const big = dailyTokenTriangularDiscriminationHalves([
    ...first,
    100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(
    big.delta > small.delta,
    `expected big ${big.delta} > small ${small.delta}`,
  );
});

test('refinement: deterministic on identical input', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenTriangularDiscriminationHalves(x);
  const r2 = dailyTokenTriangularDiscriminationHalves(x);
  assert.equal(r1.delta, r2.delta);
  assert.equal(r1.deltaMaxBin, r2.deltaMaxBin);
  assert.equal(r1.deltaMetric, r2.deltaMetric);
});

test('refinement: delta monotone w.r.t. shift magnitude (3 levels)', () => {
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const r10 = dailyTokenTriangularDiscriminationHalves([
    ...first,
    11, 12, 13, 14, 15, 16, 17, 18,
  ]);
  const r50 = dailyTokenTriangularDiscriminationHalves([
    ...first,
    51, 52, 53, 54, 55, 56, 57, 58,
  ]);
  const r200 = dailyTokenTriangularDiscriminationHalves([
    ...first,
    201, 202, 203, 204, 205, 206, 207, 208,
  ]);
  assert.ok(r10.delta < r50.delta);
  assert.ok(r50.delta <= r200.delta + 1e-12);
});

// ---------- Topsoe inequalities: 4*H^2 <= Delta <= 2*TV anchors ----------

test('topsoe: well-separated halves saturate near upper bound delta <= 2', () => {
  // For nearly disjoint supports, delta approaches 2.
  const r = dailyTokenTriangularDiscriminationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 1e6, 1e6 + 1, 1e6 + 2, 1e6 + 3, 1e6 + 4, 1e6 + 5,
    1e6 + 6, 1e6 + 7,
  ]);
  assert.ok(r.delta > 1.0, `expected sizable delta > 1, got ${r.delta}`);
  assert.ok(r.delta <= 2 + 1e-12);
});

test('topsoe: identical halves saturate the lower bound (delta = 0)', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenTriangularDiscriminationHalves([...half, ...half]);
  assert.ok(r.delta < 1e-10);
});

test('topsoe: deltaMetric is a true metric: deltaMetric(p,p) = 0', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenTriangularDiscriminationHalves([...half, ...half]);
  assert.ok(r.deltaMetric < 1e-5);
});

// ---------- refactor follow-up: deltaMetric diagnostic ----------

test('refactor: deltaMetric translation- and positive-scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenTriangularDiscriminationHalves(x);
  const r2 = dailyTokenTriangularDiscriminationHalves(
    x.map((v) => 5 * v + 1000),
  );
  assert.ok(Math.abs(r1.deltaMetric - r2.deltaMetric) < 1e-8);
});

test('refactor: rows expose deltaMetric in [0, sqrt(2)]', () => {
  const r = buildDailyTokenTriangularDiscriminationHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.deltaMetric));
    assert.ok(s.deltaMetric >= 0);
    assert.ok(s.deltaMetric <= Math.SQRT2 + 1e-10);
  }
});

// ---------- diagnostic: deltaNormalized in [0, 1] ----------

test('diagnostic: deltaNormalized === delta / 2 in [0, 1]', () => {
  const r = dailyTokenTriangularDiscriminationHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(Math.abs(r.deltaNormalized - r.delta / 2) < 1e-12);
  assert.ok(r.deltaNormalized >= 0);
  assert.ok(r.deltaNormalized <= 1 + 1e-12);
});

test('diagnostic: deltaNormalized is 0 for identical halves', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenTriangularDiscriminationHalves([...half, ...half]);
  assert.ok(r.deltaNormalized < 1e-10);
});

test('diagnostic: deltaNormalized translation- and scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenTriangularDiscriminationHalves(x);
  const r2 = dailyTokenTriangularDiscriminationHalves(
    x.map((v) => 5 * v + 1000),
  );
  assert.ok(Math.abs(r1.deltaNormalized - r2.deltaNormalized) < 1e-8);
});

test('diagnostic: rows expose deltaNormalized in [0, 1]', () => {
  const r = buildDailyTokenTriangularDiscriminationHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.deltaNormalized));
    assert.ok(s.deltaNormalized >= 0);
    assert.ok(s.deltaNormalized <= 1 + 1e-12);
    assert.ok(Math.abs(s.deltaNormalized - s.delta / 2) < 1e-12);
  }
});
