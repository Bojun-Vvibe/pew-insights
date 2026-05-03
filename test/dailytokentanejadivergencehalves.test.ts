import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenTanejaDivergenceHalves,
  buildDailyTokenTanejaDivergenceHalves,
  TANEJA_GRID_K,
  TANEJA_SILVERMAN_MULTIPLIER,
  TANEJA_GRID_EXTENSION_H,
  TANEJA_PMF_FLOOR,
} from '../src/dailytokentanejadivergencehalves.js';
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

test('taneja primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('taneja primitive: accepts exactly 8 samples', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.tanejaN1, 4);
  assert.equal(r.tanejaN2, 4);
});

test('taneja primitive: rejects NaN', () => {
  assert.throws(
    () => dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
});

test('taneja primitive: rejects +Infinity', () => {
  assert.throws(
    () => dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('taneja primitive: rejects -Infinity', () => {
  assert.throws(
    () => dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, -Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('taneja primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenTanejaDivergenceHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('taneja primitive: n1 = floor(n/2), n2 = n - n1 (even)', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.tanejaN1, 5);
  assert.equal(r.tanejaN2, 5);
});

test('taneja primitive: n1 = floor(n/2), n2 = n - n1 (odd)', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.tanejaN1, 4);
  assert.equal(r.tanejaN2, 5);
});

test('taneja primitive: gridK === TANEJA_GRID_K', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.tanejaGridK, TANEJA_GRID_K);
  assert.equal(r.tanejaGridK, 257);
});

test('taneja primitive: bandwidth > 0', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.tanejaBandwidth > 0);
});

test('taneja primitive: nSamples reflects input length', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.nSamples, 10);
});

test('taneja primitive: grid is monotone (gHi > gLo)', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.tanejaGridHi > r.tanejaGridLo);
  assert.ok(r.tanejaGridDx > 0);
});

test('taneja primitive: dx === (gHi-gLo)/(K-1)', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const expected = (r.tanejaGridHi - r.tanejaGridLo) / (TANEJA_GRID_K - 1);
  assert.ok(Math.abs(r.tanejaGridDx - expected) < 1e-12);
});

// ---------- primitive: math identities ----------

test('taneja primitive: tanejaDivergence >= 0', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.tanejaDivergence >= 0);
});

test('taneja primitive: tanejaMaxBin >= 0', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.tanejaMaxBin >= 0);
});

test('taneja primitive: tanejaMaxAmGmRatio >= 1', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.tanejaMaxAmGmRatio >= 1 - 1e-12);
});

test('taneja primitive: identical halves give tanejaDivergence ~ 0', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 1, 2, 3, 4]);
  assert.ok(r.tanejaDivergence < 1e-10);
  assert.ok(r.tanejaMaxBin < 1e-10);
});

test('taneja primitive: severe drift > mild drift', () => {
  const mild = dailyTokenTanejaDivergenceHalves([
    100, 110, 120, 130, 140, 150, 160, 170,
  ]);
  const severe = dailyTokenTanejaDivergenceHalves([
    100, 110, 120, 130, 1000, 1100, 1200, 1300,
  ]);
  assert.ok(severe.tanejaDivergence > mild.tanejaDivergence);
  assert.ok(severe.tanejaMaxBin > mild.tanejaMaxBin);
});

// ---------- primitive: invariances ----------

test('taneja primitive: translation invariant (x + c)', () => {
  const base = [1, 2, 3, 4, 50, 60, 70, 80, 9, 10];
  const r0 = dailyTokenTanejaDivergenceHalves(base);
  const r1 = dailyTokenTanejaDivergenceHalves(base.map((v) => v + 1e6));
  assert.ok(
    Math.abs(r0.tanejaDivergence - r1.tanejaDivergence) <=
      1e-9 * Math.max(1, r0.tanejaDivergence),
  );
});

test('taneja primitive: positive-scale invariant (k*x)', () => {
  const base = [1, 2, 3, 4, 50, 60, 70, 80, 9, 10];
  const r0 = dailyTokenTanejaDivergenceHalves(base);
  const r1 = dailyTokenTanejaDivergenceHalves(base.map((v) => v * 7));
  assert.ok(
    Math.abs(r0.tanejaDivergence - r1.tanejaDivergence) <=
      1e-9 * Math.max(1, r0.tanejaDivergence),
  );
});

test('taneja primitive: half-swap symmetry preserves tanejaDivergence', () => {
  const base = [1, 2, 3, 4, 50, 60, 70, 80, 9, 10, 11, 12];
  const n = base.length;
  const n1 = Math.floor(n / 2);
  const swapped = base.slice(n1).concat(base.slice(0, n1));
  const r0 = dailyTokenTanejaDivergenceHalves(base);
  const r1 = dailyTokenTanejaDivergenceHalves(swapped);
  assert.ok(
    Math.abs(r0.tanejaDivergence - r1.tanejaDivergence) <=
      1e-12 * Math.max(1, r0.tanejaDivergence),
  );
  assert.ok(
    Math.abs(r0.tanejaMaxBin - r1.tanejaMaxBin) <=
      1e-12 * Math.max(1, r0.tanejaMaxBin),
  );
});

test('taneja primitive: TANEJA_PMF_FLOOR small enough to be a no-op', () => {
  assert.ok(TANEJA_PMF_FLOOR > 0);
  assert.ok(TANEJA_PMF_FLOOR <= 1e-12);
});

test('taneja primitive: silverman multiplier matches axes 126-135', () => {
  assert.equal(TANEJA_SILVERMAN_MULTIPLIER, 0.9);
});

test('taneja primitive: grid extension matches axes 126-135', () => {
  assert.equal(TANEJA_GRID_EXTENSION_H, 3);
});

// ---------- builder: validation ----------

test('taneja builder: empty queue returns no rows', () => {
  const r = buildDailyTokenTanejaDivergenceHalves([], { generatedAt: 'X' });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('taneja builder: rejects non-integer minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenTanejaDivergenceHalves([], {
        minTenureDays: 7.5 as unknown as number,
      }),
    /minTenureDays/,
  );
});

test('taneja builder: rejects minTenureDays below floor 8', () => {
  assert.throws(
    () => buildDailyTokenTanejaDivergenceHalves([], { minTenureDays: 7 }),
    /minTenureDays/,
  );
});

test('taneja builder: rejects negative minTokens', () => {
  assert.throws(
    () => buildDailyTokenTanejaDivergenceHalves([], { minTokens: -1 }),
    /minTokens/,
  );
});

test('taneja builder: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenTanejaDivergenceHalves([], { top: -1 }),
    /top/,
  );
});

test('taneja builder: rejects unknown sort', () => {
  assert.throws(
    () =>
      buildDailyTokenTanejaDivergenceHalves([], {
        sort: 'bogus' as unknown as 'taneja',
      }),
    /sort/,
  );
});

test('taneja builder: rejects invalid since', () => {
  assert.throws(
    () =>
      buildDailyTokenTanejaDivergenceHalves([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('taneja builder: rejects invalid until', () => {
  assert.throws(
    () =>
      buildDailyTokenTanejaDivergenceHalves([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

// ---------- builder: end-to-end ----------

function makeQueue(source: string, n: number, scale = 1): QueueLine[] {
  const out: QueueLine[] = [];
  for (let i = 0; i < n; i += 1) {
    const v = (i < n / 2 ? 100 + i : 1000 + i) * scale;
    out.push(ql(dayIso(i), source, v));
  }
  return out;
}

test('taneja builder: detects half-vs-half drift on synthetic source', () => {
  const queue = makeQueue('alpha', 16);
  const r = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'alpha');
  assert.ok(row.tanejaDivergence > 0);
  assert.ok(row.tanejaMaxBin > 0);
  assert.ok(row.tanejaMaxAmGmRatio >= 1);
});

test('taneja builder: source filter narrows rows', () => {
  const queue = [...makeQueue('alpha', 16), ...makeQueue('beta', 16)];
  const r = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'X',
    source: 'alpha',
    minTokens: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.ok(r.droppedSourceFilter > 0);
});

test('taneja builder: top cap drops surplus rows', () => {
  const queue = [
    ...makeQueue('alpha', 16),
    ...makeQueue('beta', 16, 2),
    ...makeQueue('gamma', 16, 3),
  ];
  const r = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('taneja builder: sort tanejaDesc puts largest divergence first', () => {
  const queue = [
    ...makeQueue('mild', 16, 0.001),
    ...makeQueue('big', 16, 1),
  ];
  const r = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'tanejaDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.tanejaDivergence >= r.sources[1]!.tanejaDivergence);
});

test('taneja builder: sort taneja (asc) puts smallest divergence first', () => {
  const queue = [
    ...makeQueue('mild', 16, 0.001),
    ...makeQueue('big', 16, 1),
  ];
  const r = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'taneja',
  });
  assert.ok(r.sources[0]!.tanejaDivergence <= r.sources[1]!.tanejaDivergence);
});

test('taneja builder: sort source breaks ties alphabetically', () => {
  const queue = [
    ...makeQueue('zeta', 16),
    ...makeQueue('alpha', 16),
  ];
  const r = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('taneja builder: dropping invalid hour_start counted', () => {
  const queue = [
    ql('not-a-date', 'alpha', 100),
    ...makeQueue('alpha', 16),
  ];
  const r = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('taneja builder: dropping non-positive tokens counted', () => {
  const queue = [
    ql(dayIso(0), 'alpha', 0),
    ql(dayIso(1), 'alpha', -5),
    ...makeQueue('alpha', 16),
  ];
  const r = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('taneja builder: below min-tokens drops sparse sources', () => {
  const queue = [...makeQueue('alpha', 16), ...makeQueue('tiny', 16, 0.0001)];
  const r = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1000,
  });
  assert.ok(r.droppedSparseSources >= 1);
});

test('taneja builder: below min-tenure-days drops short sources', () => {
  const queue = makeQueue('alpha', 8);
  const r = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    minTenureDays: 14,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('taneja builder: gridK and silvermanMultiplier surface in report', () => {
  const queue = makeQueue('alpha', 16);
  const r = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
  });
  assert.equal(r.gridK, 257);
  assert.equal(r.silvermanMultiplier, 0.9);
  assert.equal(r.pmfFloor, TANEJA_PMF_FLOOR);
});

test('taneja builder: sort maxBinDesc orders by tanejaMaxBin desc', () => {
  const queue = [
    ...makeQueue('alpha', 16, 1),
    ...makeQueue('beta', 16, 5),
  ];
  const r = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'maxBinDesc',
  });
  assert.ok(r.sources[0]!.tanejaMaxBin >= r.sources[1]!.tanejaMaxBin);
});

test('taneja builder: sort tokens descending by totalTokens', () => {
  const queue = [
    ...makeQueue('big', 16, 10),
    ...makeQueue('small', 16, 1),
  ];
  const r = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'tokens',
  });
  assert.equal(r.sources[0]!.source, 'big');
});

test('taneja builder: pure builder is deterministic w.r.t. fixed generatedAt', () => {
  const queue = makeQueue('alpha', 16);
  const r1 = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'fixed',
    minTokens: 1,
  });
  const r2 = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'fixed',
    minTokens: 1,
  });
  assert.deepEqual(r1, r2);
});

// ---------- diagnostic: tanejaSpreadRatio ----------

test('taneja primitive: tanejaSpreadRatio in [0, 1]', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.tanejaSpreadRatio >= 0 && r.tanejaSpreadRatio <= 1 + 1e-12);
});

test('taneja primitive: tanejaSpreadRatio identity K*maxBin*spread === taneja', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  const reconstructed =
    r.tanejaGridK * r.tanejaMaxBin * r.tanejaSpreadRatio;
  assert.ok(
    Math.abs(reconstructed - r.tanejaDivergence) <=
      1e-10 * Math.max(1, r.tanejaDivergence),
  );
});

test('taneja primitive: identical halves give tanejaSpreadRatio === 0 (vacuous case)', () => {
  const r = dailyTokenTanejaDivergenceHalves([1, 2, 3, 4, 1, 2, 3, 4]);
  assert.equal(r.tanejaSpreadRatio, 0);
});

test('taneja builder: tanejaSpreadRatio surfaces on every row', () => {
  const queue = makeQueue('alpha', 16);
  const r = buildDailyTokenTanejaDivergenceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(typeof row.tanejaSpreadRatio === 'number');
  assert.ok(row.tanejaSpreadRatio >= 0 && row.tanejaSpreadRatio <= 1 + 1e-12);
});
