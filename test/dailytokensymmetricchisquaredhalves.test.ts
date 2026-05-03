import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenSymmetricChiSquaredHalves,
  buildDailyTokenSymmetricChiSquaredHalves,
  PSCHI_GRID_K,
  PSCHI_SILVERMAN_MULTIPLIER,
  PSCHI_GRID_EXTENSION_H,
  PSCHI_PMF_FLOOR,
} from '../src/dailytokensymmetricchisquaredhalves.js';
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

test('psChi primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('psChi primitive: accepts exactly 8 samples', () => {
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.psChiN1, 4);
  assert.equal(r.psChiN2, 4);
});

test('psChi primitive: rejects NaN', () => {
  assert.throws(
    () => dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
});

test('psChi primitive: rejects +Infinity', () => {
  assert.throws(
    () => dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('psChi primitive: rejects -Infinity', () => {
  assert.throws(
    () => dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, -Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('psChi primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenSymmetricChiSquaredHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('psChi primitive: n1 = floor(n/2), n2 = n - n1 (even)', () => {
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.psChiN1, 5);
  assert.equal(r.psChiN2, 5);
});

test('psChi primitive: n1 = floor(n/2), n2 = n - n1 (odd)', () => {
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.psChiN1, 4);
  assert.equal(r.psChiN2, 5);
});

test('psChi primitive: gridK === PSCHI_GRID_K', () => {
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.psChiGridK, PSCHI_GRID_K);
  assert.equal(r.psChiGridK, 257);
});

test('psChi primitive: bandwidth > 0', () => {
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.psChiBandwidth > 0);
});

test('psChi primitive: nSamples reflects input length', () => {
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.nSamples, 10);
});

test('psChi primitive: grid is monotone (gHi > gLo)', () => {
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.psChiGridHi > r.psChiGridLo);
  assert.ok(r.psChiGridDx > 0);
});

test('psChi primitive: dx === (gHi-gLo)/(K-1)', () => {
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const expected = (r.psChiGridHi - r.psChiGridLo) / (PSCHI_GRID_K - 1);
  assert.ok(Math.abs(r.psChiGridDx - expected) < 1e-12);
});

// ---------- primitive: psChi2 mathematical bounds & identities ----------

test('psChi primitive: psChi2 >= 0', () => {
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.psChi2 >= 0);
});

test('psChi primitive: pearsonForward >= 0', () => {
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.pearsonForward >= 0);
});

test('psChi primitive: pearsonReverse >= 0', () => {
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.pearsonReverse >= 0);
});

test('psChi primitive: additive identity psChi2 === pearsonForward + pearsonReverse', () => {
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  const sum = r.pearsonForward + r.pearsonReverse;
  assert.ok(Math.abs(r.psChi2 - sum) <= 1e-12 * Math.max(1, sum));
});

test('psChi primitive: pearsonAsymmetryRatio >= 1', () => {
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.pearsonAsymmetryRatio >= 1);
});

test('psChi primitive: identical halves give psChi2 ~ 0', () => {
  // Two halves with same KDE distribution => pmf nearly identical => psChi2 ~ 0.
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 1, 2, 3, 4]);
  assert.ok(r.psChi2 < 1e-20);
  // Forward and reverse Pearson are both ~0 => asymmetry ratio == 1 by convention.
  assert.equal(r.pearsonAsymmetryRatio, 1);
  // Bounded form approaches 0; forward share defined as 0.5 in vacuous case.
  assert.ok(r.psChi2Bounded < 1e-20);
  assert.equal(r.pearsonForwardShare, 0.5);
});

test('psChi primitive: psChi2Bounded in [0, 1) and monotone in psChi2', () => {
  const mild = dailyTokenSymmetricChiSquaredHalves([
    100, 110, 120, 130, 140, 150, 160, 170,
  ]);
  const severe = dailyTokenSymmetricChiSquaredHalves([
    100, 110, 120, 130, 1000, 1100, 1200, 1300,
  ]);
  assert.ok(mild.psChi2Bounded >= 0 && mild.psChi2Bounded < 1);
  assert.ok(severe.psChi2Bounded >= 0 && severe.psChi2Bounded < 1);
  assert.ok(severe.psChi2Bounded > mild.psChi2Bounded);
  // Identity check: psChi2Bounded === psChi2 / (1 + psChi2).
  assert.ok(
    Math.abs(mild.psChi2Bounded - mild.psChi2 / (1 + mild.psChi2)) <= 1e-12,
  );
});

test('psChi primitive: pearsonForwardShare in [0, 1] and decomposes psChi2', () => {
  const r = dailyTokenSymmetricChiSquaredHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.pearsonForwardShare >= 0 && r.pearsonForwardShare <= 1);
  // Identity check: pearsonForwardShare === pearsonForward / psChi2 when psChi2 > 0.
  assert.ok(
    Math.abs(r.pearsonForwardShare - r.pearsonForward / r.psChi2) <= 1e-12,
  );
});

test('psChi primitive: half-swap flips forward share around 0.5', () => {
  const base = [1, 2, 3, 4, 50, 60, 70, 80, 9, 10, 11, 12];
  const n = base.length;
  const n1 = Math.floor(n / 2);
  const swapped = base.slice(n1).concat(base.slice(0, n1));
  const r0 = dailyTokenSymmetricChiSquaredHalves(base);
  const r1 = dailyTokenSymmetricChiSquaredHalves(swapped);
  // forward(swapped) ~ reverse(original) => share(swapped) === 1 - share(original).
  assert.ok(
    Math.abs((1 - r0.pearsonForwardShare) - r1.pearsonForwardShare) <= 1e-12,
  );
});

test('psChi primitive: large half-vs-half drift gives larger psChi2 than mild drift', () => {
  // Mild drift: same scale, small shift.
  const mild = dailyTokenSymmetricChiSquaredHalves([
    100, 110, 120, 130, 140, 150, 160, 170,
  ]);
  // Severe drift: order-of-magnitude shift.
  const severe = dailyTokenSymmetricChiSquaredHalves([
    100, 110, 120, 130, 1000, 1100, 1200, 1300,
  ]);
  assert.ok(severe.psChi2 > mild.psChi2);
});

// ---------- primitive: invariances ----------

test('psChi primitive: translation invariant (x + c)', () => {
  const base = [1, 2, 3, 4, 50, 60, 70, 80, 9, 10];
  const r0 = dailyTokenSymmetricChiSquaredHalves(base);
  const r1 = dailyTokenSymmetricChiSquaredHalves(base.map((v) => v + 1e6));
  assert.ok(
    Math.abs(r0.psChi2 - r1.psChi2) <= 1e-9 * Math.max(1, r0.psChi2),
  );
});

test('psChi primitive: positive-scale invariant (k*x)', () => {
  const base = [1, 2, 3, 4, 50, 60, 70, 80, 9, 10];
  const r0 = dailyTokenSymmetricChiSquaredHalves(base);
  const r1 = dailyTokenSymmetricChiSquaredHalves(base.map((v) => v * 7));
  assert.ok(
    Math.abs(r0.psChi2 - r1.psChi2) <= 1e-9 * Math.max(1, r0.psChi2),
  );
});

test('psChi primitive: half-swap symmetry preserves psChi2 and swaps F/R', () => {
  const base = [1, 2, 3, 4, 50, 60, 70, 80, 9, 10, 11, 12];
  // Swap halves: take second half then first half.
  const n = base.length;
  const n1 = Math.floor(n / 2);
  const swapped = base.slice(n1).concat(base.slice(0, n1));
  const r0 = dailyTokenSymmetricChiSquaredHalves(base);
  const r1 = dailyTokenSymmetricChiSquaredHalves(swapped);
  assert.ok(Math.abs(r0.psChi2 - r1.psChi2) <= 1e-12 * Math.max(1, r0.psChi2));
  // Forward of original ~ Reverse of swapped.
  assert.ok(
    Math.abs(r0.pearsonForward - r1.pearsonReverse)
      <= 1e-12 * Math.max(1, r0.pearsonForward),
  );
  // Asymmetry ratio is invariant under swap.
  assert.ok(
    Math.abs(r0.pearsonAsymmetryRatio - r1.pearsonAsymmetryRatio) <= 1e-12,
  );
});

test('psChi primitive: PSCHI_PMF_FLOOR is small enough to be a no-op', () => {
  // A genuine KDE pmf bin always exceeds the floor by many OoM.
  assert.ok(PSCHI_PMF_FLOOR > 0);
  assert.ok(PSCHI_PMF_FLOOR <= 1e-12);
});

test('psChi primitive: silverman multiplier matches axes 126-133', () => {
  assert.equal(PSCHI_SILVERMAN_MULTIPLIER, 0.9);
});

test('psChi primitive: grid extension matches axes 126-133', () => {
  assert.equal(PSCHI_GRID_EXTENSION_H, 3);
});

// ---------- builder: empty and degenerate ----------

test('psChi builder: empty queue returns no rows', () => {
  const r = buildDailyTokenSymmetricChiSquaredHalves([], { generatedAt: 'X' });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('psChi builder: rejects non-integer minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenSymmetricChiSquaredHalves([], {
        minTenureDays: 7.5 as unknown as number,
      }),
    /minTenureDays/,
  );
});

test('psChi builder: rejects minTenureDays below floor 8', () => {
  assert.throws(
    () => buildDailyTokenSymmetricChiSquaredHalves([], { minTenureDays: 7 }),
    /minTenureDays/,
  );
});

test('psChi builder: rejects negative minTokens', () => {
  assert.throws(
    () => buildDailyTokenSymmetricChiSquaredHalves([], { minTokens: -1 }),
    /minTokens/,
  );
});

test('psChi builder: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenSymmetricChiSquaredHalves([], { top: -1 }),
    /top/,
  );
});

test('psChi builder: rejects unknown sort', () => {
  assert.throws(
    () =>
      buildDailyTokenSymmetricChiSquaredHalves([], {
        sort: 'bogus' as unknown as 'psChi2',
      }),
    /sort/,
  );
});

test('psChi builder: rejects invalid since', () => {
  assert.throws(
    () =>
      buildDailyTokenSymmetricChiSquaredHalves([], {
        since: 'not-a-date',
      }),
    /invalid since/,
  );
});

test('psChi builder: rejects invalid until', () => {
  assert.throws(
    () =>
      buildDailyTokenSymmetricChiSquaredHalves([], {
        until: 'not-a-date',
      }),
    /invalid until/,
  );
});

// ---------- builder: end-to-end ----------

function makeQueue(source: string, n: number, scale = 1): QueueLine[] {
  const out: QueueLine[] = [];
  for (let i = 0; i < n; i += 1) {
    // Drift series: first half low-mean, second half high-mean.
    const v = (i < n / 2 ? 100 + i : 1000 + i) * scale;
    out.push(ql(dayIso(i), source, v));
  }
  return out;
}

test('psChi builder: detects half-vs-half drift on synthetic source', () => {
  const queue = makeQueue('alpha', 16);
  const r = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'alpha');
  assert.ok(row.psChi2 > 0);
  assert.ok(row.pearsonForward > 0);
  assert.ok(row.pearsonReverse > 0);
  assert.ok(row.pearsonAsymmetryRatio >= 1);
});

test('psChi builder: source filter narrows rows', () => {
  const queue = [...makeQueue('alpha', 16), ...makeQueue('beta', 16)];
  const r = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'X',
    source: 'alpha',
    minTokens: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.ok(r.droppedSourceFilter > 0);
});

test('psChi builder: top cap drops surplus rows', () => {
  const queue = [
    ...makeQueue('alpha', 16),
    ...makeQueue('beta', 16, 2),
    ...makeQueue('gamma', 16, 3),
  ];
  const r = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('psChi builder: sort psChi2Desc puts largest divergence first', () => {
  const queue = [
    ...makeQueue('mild', 16, 0.001), // small drift
    ...makeQueue('big', 16, 1), // big drift
  ];
  const r = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'psChi2Desc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.psChi2 >= r.sources[1]!.psChi2);
});

test('psChi builder: sort psChi2 (asc) puts smallest divergence first', () => {
  const queue = [
    ...makeQueue('mild', 16, 0.001),
    ...makeQueue('big', 16, 1),
  ];
  const r = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'psChi2',
  });
  assert.ok(r.sources[0]!.psChi2 <= r.sources[1]!.psChi2);
});

test('psChi builder: sort source breaks ties alphabetically', () => {
  const queue = [
    ...makeQueue('zeta', 16),
    ...makeQueue('alpha', 16),
  ];
  const r = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('psChi builder: dropping invalid hour_start counted', () => {
  const queue = [
    ql('not-a-date', 'alpha', 100),
    ...makeQueue('alpha', 16),
  ];
  const r = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('psChi builder: dropping non-positive tokens counted', () => {
  const queue = [
    ql(dayIso(0), 'alpha', 0),
    ql(dayIso(1), 'alpha', -5),
    ...makeQueue('alpha', 16),
  ];
  const r = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('psChi builder: below min-tokens drops sparse sources', () => {
  const queue = [...makeQueue('alpha', 16), ...makeQueue('tiny', 16, 0.0001)];
  const r = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'X',
    minTokens: 1000,
  });
  assert.ok(r.droppedSparseSources >= 1);
});

test('psChi builder: below min-tenure-days drops short sources', () => {
  const queue = makeQueue('alpha', 8); // tenure < 14
  const r = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    minTenureDays: 14,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('psChi builder: gridK and silvermanMultiplier surface in report', () => {
  const queue = makeQueue('alpha', 16);
  const r = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
  });
  assert.equal(r.gridK, 257);
  assert.equal(r.silvermanMultiplier, 0.9);
  assert.equal(r.pmfFloor, PSCHI_PMF_FLOOR);
});

test('psChi builder: sort asymmetry orders by pearsonAsymmetryRatio asc', () => {
  const queue = [
    ...makeQueue('alpha', 16, 1),
    ...makeQueue('beta', 16, 5),
  ];
  const r = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'asymmetry',
  });
  assert.ok(
    r.sources[0]!.pearsonAsymmetryRatio <= r.sources[1]!.pearsonAsymmetryRatio,
  );
});

test('psChi builder: sort tokens descending by totalTokens', () => {
  const queue = [
    ...makeQueue('big', 16, 10),
    ...makeQueue('small', 16, 1),
  ];
  const r = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'tokens',
  });
  assert.equal(r.sources[0]!.source, 'big');
});

test('psChi builder: pure builder is deterministic w.r.t. fixed generatedAt', () => {
  const queue = makeQueue('alpha', 16);
  const r1 = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'fixed',
    minTokens: 1,
  });
  const r2 = buildDailyTokenSymmetricChiSquaredHalves(queue, {
    generatedAt: 'fixed',
    minTokens: 1,
  });
  assert.deepEqual(r1, r2);
});
