import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenJeffreysDivergenceHalves,
  buildDailyTokenJeffreysDivergenceHalves,
  JEFFREYS_GRID_K,
  JEFFREYS_SILVERMAN_MULTIPLIER,
  JEFFREYS_GRID_EXTENSION_H,
  JEFFREYS_PMF_FLOOR,
} from '../src/dailytokenjeffreysdivergencehalves.js';
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

test('jeffreys primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenJeffreysDivergenceHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('jeffreys primitive: rejects non-finite values', () => {
  assert.throws(
    () =>
      dailyTokenJeffreysDivergenceHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () =>
      dailyTokenJeffreysDivergenceHalves([
        1, 2, 3, 4, Infinity, 6, 7, 8,
      ]),
    /finite values/,
  );
});

test('jeffreys primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenJeffreysDivergenceHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('jeffreys primitive: n1 = floor(n/2), n2 = n - n1 (even)', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.equal(r.jeffreysN1, 5);
  assert.equal(r.jeffreysN2, 5);
});

test('jeffreys primitive: n1 = floor(n/2), n2 = n - n1 (odd)', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9,
  ]);
  assert.equal(r.jeffreysN1, 4);
  assert.equal(r.jeffreysN2, 5);
});

test('jeffreys primitive: gridK === 257', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.equal(r.jeffreysGridK, 257);
});

test('jeffreys primitive: bandwidth > 0', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.ok(r.jeffreysBandwidth > 0);
});

test('jeffreys primitive: grid endpoints flank min/max with 3*h padding', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10];
  const r = dailyTokenJeffreysDivergenceHalves(x);
  assert.ok(Math.abs(r.jeffreysGridLo - (1 - 3 * r.jeffreysBandwidth)) < 1e-10);
  assert.ok(Math.abs(r.jeffreysGridHi - (10 + 3 * r.jeffreysBandwidth)) < 1e-10);
});

test('jeffreys primitive: nSamples reported correctly', () => {
  const r = dailyTokenJeffreysDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.nSamples, 9);
});

// ---------- primitive: bounds and identities ----------

test('jeffreys primitive: KL(p||q) >= 0 (Gibbs)', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.klPQ >= -1e-12);
});

test('jeffreys primitive: KL(q||p) >= 0 (Gibbs)', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.klQP >= -1e-12);
});

test('jeffreys primitive: J >= 0', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.jeffreys >= -1e-12);
});

test('jeffreys primitive: decomposition J === KL(p||q) + KL(q||p)', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(Math.abs(r.jeffreys - (r.klPQ + r.klQP)) < 1e-12);
});

test('jeffreys primitive: identical halves give J near 0', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const x = [...half, ...half];
  const r = dailyTokenJeffreysDivergenceHalves(x);
  assert.ok(r.jeffreys < 1e-9, `J=${r.jeffreys}`);
  assert.ok(r.klPQ < 1e-9, `KLpq=${r.klPQ}`);
  assert.ok(r.klQP < 1e-9, `KLqp=${r.klQP}`);
});

test('jeffreys primitive: well-separated halves produce J > 0.1', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r = dailyTokenJeffreysDivergenceHalves(x);
  assert.ok(r.jeffreys > 0.1, `expected sizeable J, got ${r.jeffreys}`);
});

test('jeffreys primitive: nearly-disjoint halves drive J large', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 1e6, 1e6 + 1, 1e6 + 2, 1e6 + 3, 1e6 + 4, 1e6 + 5,
    1e6 + 6, 1e6 + 7,
  ]);
  assert.ok(r.jeffreys > 1, `expected J > 1, got ${r.jeffreys}`);
  assert.ok(Number.isFinite(r.jeffreys));
});

test('jeffreys primitive: translation-invariant (J, klPQ, klQP)', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenJeffreysDivergenceHalves(x);
  const r2 = dailyTokenJeffreysDivergenceHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.jeffreys - r2.jeffreys) < 1e-8);
  assert.ok(Math.abs(r1.klPQ - r2.klPQ) < 1e-8);
  assert.ok(Math.abs(r1.klQP - r2.klQP) < 1e-8);
});

test('jeffreys primitive: positive-scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenJeffreysDivergenceHalves(x);
  const r2 = dailyTokenJeffreysDivergenceHalves(x.map((v) => 7 * v));
  assert.ok(Math.abs(r1.jeffreys - r2.jeffreys) < 1e-8);
  assert.ok(Math.abs(r1.klPQ - r2.klPQ) < 1e-8);
  assert.ok(Math.abs(r1.klQP - r2.klQP) < 1e-8);
});

test('jeffreys primitive: symmetric (reverse halves preserves J; KL pair swaps)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r1 = dailyTokenJeffreysDivergenceHalves(x);
  const xSwap = [
    100, 101, 102, 103, 104, 105, 106, 107, 1, 2, 3, 4, 5, 6, 7, 8,
  ];
  const r2 = dailyTokenJeffreysDivergenceHalves(xSwap);
  assert.ok(Math.abs(r1.jeffreys - r2.jeffreys) < 1e-10);
  assert.ok(Math.abs(r1.klPQ - r2.klQP) < 1e-10);
  assert.ok(Math.abs(r1.klQP - r2.klPQ) < 1e-10);
});

test('jeffreys primitive: median-bandwidth on integers is positive (n=10)', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.ok(r.jeffreysMadPool > 0);
});

test('jeffreys primitive: constants exposed', () => {
  assert.equal(JEFFREYS_GRID_K, 257);
  assert.equal(JEFFREYS_SILVERMAN_MULTIPLIER, 0.9);
  assert.equal(JEFFREYS_GRID_EXTENSION_H, 3);
  assert.equal(JEFFREYS_PMF_FLOOR, 1e-300);
});

test('jeffreys primitive: bandwidth scales linearly with positive scaling', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenJeffreysDivergenceHalves(x);
  const r2 = dailyTokenJeffreysDivergenceHalves(x.map((v) => 7 * v));
  assert.ok(Math.abs(r2.jeffreysBandwidth / r1.jeffreysBandwidth - 7) < 1e-8);
});

test('jeffreys primitive: bandwidth invariant under translation', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenJeffreysDivergenceHalves(x);
  const r2 = dailyTokenJeffreysDivergenceHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.jeffreysBandwidth - r2.jeffreysBandwidth) < 1e-10);
});

test('jeffreys primitive: jeffreysAsymmetry in [0, 1]', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.jeffreysAsymmetry >= 0);
  assert.ok(r.jeffreysAsymmetry <= 1 + 1e-12);
});

test('jeffreys primitive: jeffreysNormalized = J / (J + 1) in [0, 1)', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(
    Math.abs(r.jeffreysNormalized - r.jeffreys / (r.jeffreys + 1)) < 1e-12,
  );
  assert.ok(r.jeffreysNormalized >= 0);
  assert.ok(r.jeffreysNormalized < 1);
});

// ---------- builder: input validation ----------

test('build: rejects negative minTokens', () => {
  assert.throws(
    () =>
      buildDailyTokenJeffreysDivergenceHalves([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('build: rejects non-integer minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenJeffreysDivergenceHalves([], {
        minTenureDays: 7.5,
      }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects below-floor minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenJeffreysDivergenceHalves([], { minTenureDays: 7 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenJeffreysDivergenceHalves([], { top: -1 }),
    /top must be a non-negative integer/,
  );
});

test('build: rejects invalid sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenJeffreysDivergenceHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('build: rejects invalid since/until', () => {
  assert.throws(
    () =>
      buildDailyTokenJeffreysDivergenceHalves([], {
        since: 'not-a-date',
      }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenJeffreysDivergenceHalves([], {
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
  const r = buildDailyTokenJeffreysDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  assert.equal(r.sources.length, 2);
  assert.equal(r.gridK, 257);
  assert.ok(Math.abs(r.silvermanMultiplier - 0.9) < 1e-12);
});

test('build: sort jeffreysDesc puts biggest J first', () => {
  const r = buildDailyTokenJeffreysDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'jeffreysDesc' },
  );
  assert.ok(r.sources[0]!.jeffreys >= r.sources[1]!.jeffreys);
});

test('build: sort jeffreys asc puts smallest J first', () => {
  const r = buildDailyTokenJeffreysDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'jeffreys' },
  );
  assert.ok(r.sources[0]!.jeffreys <= r.sources[1]!.jeffreys);
});

test('build: sort klPQ asc puts smallest klPQ first', () => {
  const r = buildDailyTokenJeffreysDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'klPQ' },
  );
  assert.ok(r.sources[0]!.klPQ <= r.sources[1]!.klPQ);
});

test('build: sort klPQDesc puts biggest klPQ first', () => {
  const r = buildDailyTokenJeffreysDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'klPQDesc' },
  );
  assert.ok(r.sources[0]!.klPQ >= r.sources[1]!.klPQ);
});

test('build: sort klQP asc puts smallest klQP first', () => {
  const r = buildDailyTokenJeffreysDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'klQP' },
  );
  assert.ok(r.sources[0]!.klQP <= r.sources[1]!.klQP);
});

test('build: sort klQPDesc puts biggest klQP first', () => {
  const r = buildDailyTokenJeffreysDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'klQPDesc' },
  );
  assert.ok(r.sources[0]!.klQP >= r.sources[1]!.klQP);
});

test('build: sort source asc orders alphabetically', () => {
  const r = buildDailyTokenJeffreysDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'source' },
  );
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.equal(r.sources[1]!.source, 'src-b');
});

test('build: drops sparse sources below minTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'tiny', 1));
  const r = buildDailyTokenJeffreysDivergenceHalves(q, {
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('build: drops below-min-tenure sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 6; i += 1) q.push(ql(dayIso(i), 'short', 5000));
  const r = buildDailyTokenJeffreysDivergenceHalves(q, {
    minTokens: 0,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: drops zero-variance sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'flat', 100));
  const r = buildDailyTokenJeffreysDivergenceHalves(q, {
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
  const r = buildDailyTokenJeffreysDivergenceHalves(q, {
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
  const r = buildDailyTokenJeffreysDivergenceHalves(q, {
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
  const r = buildDailyTokenJeffreysDivergenceHalves(q, {
    minTokens: 0,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('build: empty queue returns empty sources', () => {
  const r = buildDailyTokenJeffreysDivergenceHalves([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('build: generatedAt override is honoured', () => {
  const r = buildDailyTokenJeffreysDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, generatedAt: '2030-01-01T00:00:00.000Z' },
  );
  assert.equal(r.generatedAt, '2030-01-01T00:00:00.000Z');
});

test('build: rows expose klPQ, klQP, jeffreys, jeffreysNormalized all finite & in-range', () => {
  const r = buildDailyTokenJeffreysDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.klPQ));
    assert.ok(Number.isFinite(s.klQP));
    assert.ok(Number.isFinite(s.jeffreys));
    assert.ok(Number.isFinite(s.jeffreysNormalized));
    assert.ok(s.klPQ >= -1e-12);
    assert.ok(s.klQP >= -1e-12);
    assert.ok(s.jeffreys >= -1e-12);
    assert.ok(s.jeffreysNormalized >= 0 && s.jeffreysNormalized < 1);
  }
});

test('build: respects all valid sort keys without throwing', () => {
  const q = makeQueueWithTwoSources();
  const sorts = [
    'jeffreys',
    'jeffreysDesc',
    'klPQ',
    'klPQDesc',
    'klQP',
    'klQPDesc',
    'tokens',
    'tenure',
    'source',
  ] as const;
  for (const s of sorts) {
    const r = buildDailyTokenJeffreysDivergenceHalves(q, {
      minTokens: 0,
      sort: s,
    });
    assert.equal(r.sort, s);
    assert.equal(r.sources.length, 2);
  }
});

test('build: window since/until filters by hour_start', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenJeffreysDivergenceHalves(q, {
    minTokens: 0,
    since: dayIso(0),
    until: dayIso(20),
  });
  assert.equal(r.windowStart, dayIso(0));
  assert.equal(r.windowEnd, dayIso(20));
});

// ---------- refinement: monotonicity & determinism ----------

test('refinement: bigger half-shift gives strictly larger J', () => {
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const small = dailyTokenJeffreysDivergenceHalves([
    ...first,
    9, 10, 11, 12, 13, 14, 15, 16,
  ]);
  const big = dailyTokenJeffreysDivergenceHalves([
    ...first,
    100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(
    big.jeffreys > small.jeffreys,
    `expected big ${big.jeffreys} > small ${small.jeffreys}`,
  );
});

test('refinement: deterministic on identical input', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenJeffreysDivergenceHalves(x);
  const r2 = dailyTokenJeffreysDivergenceHalves(x);
  assert.equal(r1.jeffreys, r2.jeffreys);
  assert.equal(r1.klPQ, r2.klPQ);
  assert.equal(r1.klQP, r2.klQP);
  assert.equal(r1.jeffreysNormalized, r2.jeffreysNormalized);
});

test('refinement: J monotone w.r.t. shift magnitude (3 levels)', () => {
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const r10 = dailyTokenJeffreysDivergenceHalves([
    ...first,
    11, 12, 13, 14, 15, 16, 17, 18,
  ]);
  const r50 = dailyTokenJeffreysDivergenceHalves([
    ...first,
    51, 52, 53, 54, 55, 56, 57, 58,
  ]);
  const r200 = dailyTokenJeffreysDivergenceHalves([
    ...first,
    201, 202, 203, 204, 205, 206, 207, 208,
  ]);
  assert.ok(r10.jeffreys < r50.jeffreys);
  assert.ok(r50.jeffreys <= r200.jeffreys + 1e-12);
});

// ---------- decomposition / asymmetry ----------

test('decomposition: J === klPQ + klQP exactly', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 50, 51, 52, 53, 54, 55, 56, 57,
  ]);
  assert.ok(Math.abs(r.jeffreys - (r.klPQ + r.klQP)) < 1e-12);
});

test('asymmetry: in [0, 1] for non-degenerate halves', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 50, 51, 52, 53, 54, 55, 56, 57,
  ]);
  assert.ok(r.jeffreysAsymmetry >= 0);
  assert.ok(r.jeffreysAsymmetry <= 1 + 1e-12);
});

test('asymmetry: identical halves give defined asymmetry = 0 (J=0 branch)', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenJeffreysDivergenceHalves([...half, ...half]);
  // jeffreys is ~0; asymmetry is defined as 0 in that branch.
  assert.equal(r.jeffreysAsymmetry, 0);
});

test('asymmetry: |klPQ - klQP| / J consistent with formula', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  const expected = Math.abs(r.klPQ - r.klQP) / r.jeffreys;
  assert.ok(Math.abs(r.jeffreysAsymmetry - expected) < 1e-12);
});

// ---------- normalised diagnostic ----------

test('diagnostic: jeffreysNormalized === J / (J + 1)', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(
    Math.abs(r.jeffreysNormalized - r.jeffreys / (r.jeffreys + 1)) < 1e-12,
  );
});

test('diagnostic: jeffreysNormalized in [0, 1)', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.jeffreysNormalized >= 0);
  assert.ok(r.jeffreysNormalized < 1);
});

test('diagnostic: jeffreysNormalized monotone-increasing in J', () => {
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const small = dailyTokenJeffreysDivergenceHalves([
    ...first,
    9, 10, 11, 12, 13, 14, 15, 16,
  ]);
  const big = dailyTokenJeffreysDivergenceHalves([
    ...first,
    100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(big.jeffreysNormalized > small.jeffreysNormalized);
});

test('diagnostic: jeffreysNormalized 0 for identical halves', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenJeffreysDivergenceHalves([...half, ...half]);
  assert.ok(r.jeffreysNormalized < 1e-9);
});

test('diagnostic: jeffreysNormalized translation- and scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenJeffreysDivergenceHalves(x);
  const r2 = dailyTokenJeffreysDivergenceHalves(
    x.map((v) => 5 * v + 1000),
  );
  assert.ok(Math.abs(r1.jeffreysNormalized - r2.jeffreysNormalized) < 1e-8);
});

test('diagnostic: rows expose jeffreysNormalized in [0, 1) coherently with J', () => {
  const r = buildDailyTokenJeffreysDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.jeffreysNormalized));
    assert.ok(s.jeffreysNormalized >= 0);
    assert.ok(s.jeffreysNormalized < 1);
    assert.ok(
      Math.abs(s.jeffreysNormalized - s.jeffreys / (s.jeffreys + 1)) < 1e-12,
    );
  }
});

// ---------- f-divergence properties ----------

test('f-divergence: KL(p||q) = 0 for identical halves', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenJeffreysDivergenceHalves([...half, ...half]);
  assert.ok(Math.abs(r.klPQ) < 1e-9);
  assert.ok(Math.abs(r.klQP) < 1e-9);
});

test('f-divergence: directional KLs are non-negative', () => {
  for (const seed of [3, 7, 11, 13, 17]) {
    const x: number[] = [];
    for (let i = 0; i < 16; i += 1) x.push(((i * seed) % 19) + 1);
    const r = dailyTokenJeffreysDivergenceHalves(x);
    assert.ok(r.klPQ >= -1e-12, `seed=${seed} klPQ=${r.klPQ}`);
    assert.ok(r.klQP >= -1e-12, `seed=${seed} klQP=${r.klQP}`);
  }
});

// ---------- builder rows mirror primitive ----------

test('build rows: KL/J/asym/norm fields all coherent', () => {
  const r = buildDailyTokenJeffreysDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  for (const s of r.sources) {
    assert.ok(Math.abs(s.jeffreys - (s.klPQ + s.klQP)) < 1e-10);
    if (s.jeffreys > 0) {
      assert.ok(
        Math.abs(s.jeffreysAsymmetry - Math.abs(s.klPQ - s.klQP) / s.jeffreys) <
          1e-10,
      );
    } else {
      assert.equal(s.jeffreysAsymmetry, 0);
    }
  }
});

// ---------- bounds vs related axes ----------

test('bound: J >= 0 across many random seeds', () => {
  for (let seed = 1; seed < 20; seed += 1) {
    const x: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      x.push(((i * seed * 13) % 97) + 1);
    }
    let mn = x[0]!, mx = x[0]!;
    for (const v of x) { if (v < mn) mn = v; if (v > mx) mx = v; }
    if (mn === mx) continue;
    const r = dailyTokenJeffreysDivergenceHalves(x);
    assert.ok(r.jeffreys >= -1e-12, `seed=${seed} J=${r.jeffreys}`);
  }
});

test('bound: jeffreysNormalized strictly less than 1 even for huge separation', () => {
  const r = dailyTokenJeffreysDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 1e9, 1e9 + 1, 1e9 + 2, 1e9 + 3, 1e9 + 4, 1e9 + 5,
    1e9 + 6, 1e9 + 7,
  ]);
  assert.ok(r.jeffreysNormalized < 1);
  assert.ok(r.jeffreysNormalized > 0.5);
});
