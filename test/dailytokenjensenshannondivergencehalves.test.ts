import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenJensenShannonDivergenceHalves,
  buildDailyTokenJensenShannonDivergenceHalves,
  JSD_GRID_K,
  JSD_SILVERMAN_MULTIPLIER,
  JSD_GRID_EXTENSION_H,
} from '../src/dailytokenjensenshannondivergencehalves.js';
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

test('jsd primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenJensenShannonDivergenceHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('jsd primitive: rejects non-finite values', () => {
  assert.throws(
    () =>
      dailyTokenJensenShannonDivergenceHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () =>
      dailyTokenJensenShannonDivergenceHalves([
        1, 2, 3, 4, Infinity, 6, 7, 8,
      ]),
    /finite values/,
  );
});

test('jsd primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenJensenShannonDivergenceHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('jsd primitive: n1 = floor(n/2), n2 = n - n1 (even)', () => {
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.equal(r.jsdN1, 5);
  assert.equal(r.jsdN2, 5);
});

test('jsd primitive: n1 = floor(n/2), n2 = n - n1 (odd)', () => {
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9,
  ]);
  assert.equal(r.jsdN1, 4);
  assert.equal(r.jsdN2, 5);
});

test('jsd primitive: jsdGridK === 257', () => {
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.equal(r.jsdGridK, 257);
});

test('jsd primitive: jsdBandwidth > 0', () => {
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.ok(r.jsdBandwidth > 0);
});

test('jsd primitive: grid endpoints flank min/max with 3*h padding', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10];
  const r = dailyTokenJensenShannonDivergenceHalves(x);
  assert.ok(Math.abs(r.jsdGridLo - (1 - 3 * r.jsdBandwidth)) < 1e-10);
  assert.ok(Math.abs(r.jsdGridHi - (10 + 3 * r.jsdBandwidth)) < 1e-10);
});

// ---------- primitive: bounds and identities ----------

test('jsd primitive: jsdBits in [0, 1]', () => {
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.jsdBits >= 0);
  assert.ok(r.jsdBits <= 1 + 1e-12);
});

test('jsd primitive: jsdDist === sqrt(jsdBits)', () => {
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(Math.abs(r.jsdDist - Math.sqrt(r.jsdBits)) < 1e-12);
});

test('jsd primitive: jsdDist in [0, 1]', () => {
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.jsdDist >= 0);
  assert.ok(r.jsdDist <= 1 + 1e-12);
});

test('jsd primitive: identical halves give near-zero jsdBits', () => {
  // Both halves are exactly the same sequence.
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const x = [...half, ...half];
  const r = dailyTokenJensenShannonDivergenceHalves(x);
  assert.ok(r.jsdBits < 1e-10, `expected near zero, got ${r.jsdBits}`);
  assert.ok(r.jsdDist < 1e-5);
});

test('jsd primitive: well-separated halves produce sizeable jsdBits', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r = dailyTokenJensenShannonDivergenceHalves(x);
  assert.ok(r.jsdBits > 0.5, `expected sizeable JSD, got ${r.jsdBits}`);
});

test('jsd primitive: translation-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenJensenShannonDivergenceHalves(x);
  const r2 = dailyTokenJensenShannonDivergenceHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.jsdBits - r2.jsdBits) < 1e-8);
  assert.ok(Math.abs(r1.jsdDist - r2.jsdDist) < 1e-8);
});

test('jsd primitive: positive-scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenJensenShannonDivergenceHalves(x);
  const r2 = dailyTokenJensenShannonDivergenceHalves(x.map((v) => 7 * v));
  assert.ok(
    Math.abs(r1.jsdBits - r2.jsdBits) < 1e-8,
    `jsd ${r1.jsdBits} vs ${r2.jsdBits}`,
  );
});

test('jsd primitive: symmetric (reverse halves preserves jsdBits)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r1 = dailyTokenJensenShannonDivergenceHalves(x);
  // Swap the two halves explicitly.
  const xSwap = [
    100, 101, 102, 103, 104, 105, 106, 107, 1, 2, 3, 4, 5, 6, 7, 8,
  ];
  const r2 = dailyTokenJensenShannonDivergenceHalves(xSwap);
  assert.ok(Math.abs(r1.jsdBits - r2.jsdBits) < 1e-10);
  assert.ok(Math.abs(r1.jsdDist - r2.jsdDist) < 1e-10);
});

test('jsd primitive: jsdMaxBin in [0, K-1]', () => {
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.jsdMaxBin >= 0 && r.jsdMaxBin < r.jsdGridK);
});

test('jsd primitive: jsdMaxBinX is in [gridLo, gridHi]', () => {
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.jsdMaxBinX >= r.jsdGridLo - 1e-9);
  assert.ok(r.jsdMaxBinX <= r.jsdGridHi + 1e-9);
});

test('jsd primitive: jsdMaxBinValue >= 0', () => {
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.jsdMaxBinValue >= 0);
});

test('jsd primitive: median-bandwidth on integers is positive (n=10)', () => {
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.ok(r.jsdMadPool > 0);
});

test('jsd primitive: constants exposed', () => {
  assert.equal(JSD_GRID_K, 257);
  assert.equal(JSD_SILVERMAN_MULTIPLIER, 0.9);
  assert.equal(JSD_GRID_EXTENSION_H, 3);
});

// ---------- primitive: refinement contracts ----------

test('refinement: jsdMaxBinValue <= 0.5 (per-bin contribution bounded by 0.5 bit)', () => {
  // Each per-bin contribution is 0.5*(p*log2(p/m)+q*log2(q/m)) where
  // p+q at one bin sum to at most 1 (they are pmf entries), so the
  // contribution is bounded by 0.5*1*log2(2) = 0.5.
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(
    r.jsdMaxBinValue <= 0.5 + 1e-10,
    `per-bin contribution ${r.jsdMaxBinValue} exceeds 0.5`,
  );
});

test('refinement: identical halves give jsdMaxBinValue ~ 0', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenJensenShannonDivergenceHalves([...half, ...half]);
  assert.ok(r.jsdMaxBinValue < 1e-10);
});

test('refinement: bandwidth scales linearly with positive scaling', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenJensenShannonDivergenceHalves(x);
  const r2 = dailyTokenJensenShannonDivergenceHalves(x.map((v) => 7 * v));
  assert.ok(Math.abs(r2.jsdBandwidth / r1.jsdBandwidth - 7) < 1e-8);
});

test('refinement: bandwidth invariant under translation', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenJensenShannonDivergenceHalves(x);
  const r2 = dailyTokenJensenShannonDivergenceHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.jsdBandwidth - r2.jsdBandwidth) < 1e-10);
});

// ---------- builder: input validation ----------

test('build: rejects negative minTokens', () => {
  assert.throws(
    () =>
      buildDailyTokenJensenShannonDivergenceHalves([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('build: rejects non-integer minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenJensenShannonDivergenceHalves([], {
        minTenureDays: 7.5,
      }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects below-floor minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenJensenShannonDivergenceHalves([], {
        minTenureDays: 7,
      }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenJensenShannonDivergenceHalves([], { top: -1 }),
    /top must be a non-negative integer/,
  );
});

test('build: rejects invalid sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenJensenShannonDivergenceHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('build: rejects invalid since/until', () => {
  assert.throws(
    () =>
      buildDailyTokenJensenShannonDivergenceHalves([], {
        since: 'not-a-date',
      }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenJensenShannonDivergenceHalves([], {
        until: 'not-a-date',
      }),
    /invalid until/,
  );
});

// ---------- builder: end-to-end & sorting ----------

function makeQueueWithTwoSources(): QueueLine[] {
  const q: QueueLine[] = [];
  // src-a: clear half-shift (low first, high second)
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
  const r = buildDailyTokenJensenShannonDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  assert.equal(r.sources.length, 2);
  assert.equal(r.gridK, 257);
  assert.ok(Math.abs(r.silvermanMultiplier - 0.9) < 1e-12);
});

test('build: sort jsdBitsDesc puts biggest jsdBits first', () => {
  const r = buildDailyTokenJensenShannonDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'jsdBitsDesc' },
  );
  assert.ok(r.sources[0]!.jsdBits >= r.sources[1]!.jsdBits);
});

test('build: sort jsdDistDesc puts biggest jsdDist first', () => {
  const r = buildDailyTokenJensenShannonDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'jsdDistDesc' },
  );
  assert.ok(r.sources[0]!.jsdDist >= r.sources[1]!.jsdDist);
});

test('build: sort source asc orders alphabetically', () => {
  const r = buildDailyTokenJensenShannonDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, sort: 'source' },
  );
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.equal(r.sources[1]!.source, 'src-b');
});

test('build: drops sparse sources below minTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'tiny', 1));
  const r = buildDailyTokenJensenShannonDivergenceHalves(q, {
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('build: drops below-min-tenure sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 6; i += 1) q.push(ql(dayIso(i), 'short', 5000));
  const r = buildDailyTokenJensenShannonDivergenceHalves(q, {
    minTokens: 0,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: drops zero-variance sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'flat', 100));
  const r = buildDailyTokenJensenShannonDivergenceHalves(q, {
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
  const r = buildDailyTokenJensenShannonDivergenceHalves(q, {
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
  const r = buildDailyTokenJensenShannonDivergenceHalves(q, {
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
  const r = buildDailyTokenJensenShannonDivergenceHalves(q, {
    minTokens: 0,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('build: empty queue returns empty sources', () => {
  const r = buildDailyTokenJensenShannonDivergenceHalves([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('build: generatedAt override is honoured', () => {
  const r = buildDailyTokenJensenShannonDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0, generatedAt: '2030-01-01T00:00:00.000Z' },
  );
  assert.equal(r.generatedAt, '2030-01-01T00:00:00.000Z');
});

test('build: rows expose jsdBits, jsdDist, jsdMaxBinValue all finite', () => {
  const r = buildDailyTokenJensenShannonDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.jsdBits));
    assert.ok(Number.isFinite(s.jsdDist));
    assert.ok(Number.isFinite(s.jsdMaxBinValue));
    assert.ok(s.jsdBits >= 0 && s.jsdBits <= 1 + 1e-12);
    assert.ok(s.jsdDist >= 0 && s.jsdDist <= 1 + 1e-12);
  }
});

test('build: respects all valid sort keys without throwing', () => {
  const q = makeQueueWithTwoSources();
  const sorts = [
    'jsdBits',
    'jsdBitsDesc',
    'jsdDist',
    'jsdDistDesc',
    'jsdMaxBinValue',
    'jsdMaxBinValueDesc',
    'tokens',
    'tenure',
    'source',
  ] as const;
  for (const s of sorts) {
    const r = buildDailyTokenJensenShannonDivergenceHalves(q, {
      minTokens: 0,
      sort: s,
    });
    assert.equal(r.sort, s);
    assert.equal(r.sources.length, 2);
  }
});

// ---------- refinement: monotonicity check & determinism ----------

test('refinement: bigger half-shift gives strictly larger jsdBits', () => {
  // Same first half, increasingly large second half.
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const small = dailyTokenJensenShannonDivergenceHalves([
    ...first,
    9, 10, 11, 12, 13, 14, 15, 16,
  ]);
  const big = dailyTokenJensenShannonDivergenceHalves([
    ...first,
    100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(
    big.jsdBits > small.jsdBits,
    `expected big ${big.jsdBits} > small ${small.jsdBits}`,
  );
});

test('refinement: deterministic on identical input', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenJensenShannonDivergenceHalves(x);
  const r2 = dailyTokenJensenShannonDivergenceHalves(x);
  assert.equal(r1.jsdBits, r2.jsdBits);
  assert.equal(r1.jsdDist, r2.jsdDist);
  assert.equal(r1.jsdMaxBin, r2.jsdMaxBin);
});

test('refinement: jsdBits monotone w.r.t. shift magnitude (3 levels)', () => {
  const first = [1, 2, 3, 4, 5, 6, 7, 8];
  const r10 = dailyTokenJensenShannonDivergenceHalves([
    ...first,
    11, 12, 13, 14, 15, 16, 17, 18,
  ]);
  const r50 = dailyTokenJensenShannonDivergenceHalves([
    ...first,
    51, 52, 53, 54, 55, 56, 57, 58,
  ]);
  const r200 = dailyTokenJensenShannonDivergenceHalves([
    ...first,
    201, 202, 203, 204, 205, 206, 207, 208,
  ]);
  assert.ok(r10.jsdBits < r50.jsdBits);
  assert.ok(r50.jsdBits <= r200.jsdBits + 1e-12);
});

// ---------- refactor follow-up: jsdAsymmetry diagnostic ----------

test('refactor: jsdAsymmetry >= 0 and finite', () => {
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.jsdAsymmetry >= 0);
  assert.ok(Number.isFinite(r.jsdAsymmetry));
});

test('refactor: jsdAsymmetry <= 1 bit', () => {
  // Each KL summand is bounded by 1 bit, so |KL1 - KL2| <= 1.
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.jsdAsymmetry <= 1 + 1e-10);
});

test('refactor: jsdAsymmetry ~ 0 for identical halves', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenJensenShannonDivergenceHalves([...half, ...half]);
  assert.ok(r.jsdAsymmetry < 1e-10);
  assert.equal(r.jsdAsymmetryDir, 0);
});

test('refactor: jsdAsymmetryDir flips sign on swap', () => {
  const xUp = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const xDown = [
    100, 101, 102, 103, 104, 105, 106, 107, 1, 2, 3, 4, 5, 6, 7, 8,
  ];
  const rUp = dailyTokenJensenShannonDivergenceHalves(xUp);
  const rDown = dailyTokenJensenShannonDivergenceHalves(xDown);
  assert.ok(rUp.jsdAsymmetryDir === -rDown.jsdAsymmetryDir);
  assert.ok(Math.abs(rUp.jsdAsymmetry - rDown.jsdAsymmetry) < 1e-10);
});

test('refactor: jsdAsymmetryDir in {-1, 0, 1}', () => {
  const r = dailyTokenJensenShannonDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(
    r.jsdAsymmetryDir === -1 ||
      r.jsdAsymmetryDir === 0 ||
      r.jsdAsymmetryDir === 1,
  );
});

test('refactor: jsdAsymmetry translation- and positive-scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenJensenShannonDivergenceHalves(x);
  const r2 = dailyTokenJensenShannonDivergenceHalves(x.map((v) => 5 * v + 1000));
  assert.ok(Math.abs(r1.jsdAsymmetry - r2.jsdAsymmetry) < 1e-8);
  assert.equal(r1.jsdAsymmetryDir, r2.jsdAsymmetryDir);
});

test('refactor: rows expose jsdAsymmetry and jsdAsymmetryDir', () => {
  const r = buildDailyTokenJensenShannonDivergenceHalves(
    makeQueueWithTwoSources(),
    { minTokens: 0 },
  );
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.jsdAsymmetry));
    assert.ok(s.jsdAsymmetry >= 0);
    assert.ok(
      s.jsdAsymmetryDir === -1 ||
        s.jsdAsymmetryDir === 0 ||
        s.jsdAsymmetryDir === 1,
    );
  }
});
