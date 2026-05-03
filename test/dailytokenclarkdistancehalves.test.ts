import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenClarkDistanceHalves,
  buildDailyTokenClarkDistanceHalves,
  CLARK_GRID_K,
  CLARK_SILVERMAN_MULTIPLIER,
  CLARK_GRID_EXTENSION_H,
  CLARK_PMF_FLOOR,
} from '../src/dailytokenclarkdistancehalves.js';
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

test('clark primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenClarkDistanceHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('clark primitive: accepts exactly 8 samples', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.clarkN1, 4);
  assert.equal(r.clarkN2, 4);
});

test('clark primitive: rejects NaN', () => {
  assert.throws(
    () => dailyTokenClarkDistanceHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
});

test('clark primitive: rejects +Infinity', () => {
  assert.throws(
    () => dailyTokenClarkDistanceHalves([1, 2, 3, 4, Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('clark primitive: rejects -Infinity', () => {
  assert.throws(
    () => dailyTokenClarkDistanceHalves([1, 2, 3, 4, -Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('clark primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenClarkDistanceHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('clark primitive: n1 = floor(n/2), n2 = n - n1 (even)', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.clarkN1, 5);
  assert.equal(r.clarkN2, 5);
});

test('clark primitive: n1 = floor(n/2), n2 = n - n1 (odd)', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.clarkN1, 4);
  assert.equal(r.clarkN2, 5);
});

test('clark primitive: gridK === CLARK_GRID_K', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.clarkGridK, CLARK_GRID_K);
  assert.equal(r.clarkGridK, 257);
});

test('clark primitive: bandwidth > 0', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.clarkBandwidth > 0);
});

test('clark primitive: nSamples reflects input length', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.nSamples, 10);
});

test('clark primitive: grid is monotone (gHi > gLo)', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.clarkGridHi > r.clarkGridLo);
  assert.ok(r.clarkGridDx > 0);
});

test('clark primitive: dx === (gHi-gLo)/(K-1)', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const expected = (r.clarkGridHi - r.clarkGridLo) / (CLARK_GRID_K - 1);
  assert.ok(Math.abs(r.clarkGridDx - expected) < 1e-12);
});

// ---------- primitive: clark mathematical bounds & identities ----------

test('clark primitive: clarkDistance >= 0', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.clarkDistance >= 0);
});

test('clark primitive: clarkDistance <= sqrt(K)', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.clarkDistance <= Math.sqrt(CLARK_GRID_K) + 1e-12);
});

test('clark primitive: clarkNormalised in [0, 1]', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.clarkNormalised >= 0);
  assert.ok(r.clarkNormalised <= 1 + 1e-12);
});

test('clark primitive: normalised identity clarkNormalised === clarkDistance / sqrt(K)', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  const expected = r.clarkDistance / Math.sqrt(CLARK_GRID_K);
  assert.ok(Math.abs(r.clarkNormalised - expected) <= 1e-12);
});

test('clark primitive: clarkMeanRelGap in [0, 1]', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.clarkMeanRelGap >= 0 && r.clarkMeanRelGap <= 1 + 1e-12);
});

test('clark primitive: clarkMaxRelGap in [0, 1]', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.clarkMaxRelGap >= 0 && r.clarkMaxRelGap <= 1 + 1e-12);
});

test('clark primitive: clarkMaxRelGap >= clarkMeanRelGap', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.clarkMaxRelGap >= r.clarkMeanRelGap - 1e-12);
});

test('clark primitive: identical halves give clarkDistance ~ 0', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 1, 2, 3, 4]);
  assert.ok(r.clarkDistance < 1e-10);
  assert.ok(r.clarkNormalised < 1e-10);
  assert.ok(r.clarkMeanRelGap < 1e-10);
  assert.ok(r.clarkMaxRelGap < 1e-10);
});

test('clark primitive: large half-vs-half drift gives larger Clark than mild drift', () => {
  const mild = dailyTokenClarkDistanceHalves([
    100, 110, 120, 130, 140, 150, 160, 170,
  ]);
  const severe = dailyTokenClarkDistanceHalves([
    100, 110, 120, 130, 1000, 1100, 1200, 1300,
  ]);
  assert.ok(severe.clarkDistance > mild.clarkDistance);
  assert.ok(severe.clarkMaxRelGap > mild.clarkMaxRelGap);
});

// ---------- primitive: invariances ----------

test('clark primitive: translation invariant (x + c)', () => {
  const base = [1, 2, 3, 4, 50, 60, 70, 80, 9, 10];
  const r0 = dailyTokenClarkDistanceHalves(base);
  const r1 = dailyTokenClarkDistanceHalves(base.map((v) => v + 1e6));
  assert.ok(
    Math.abs(r0.clarkDistance - r1.clarkDistance) <=
      1e-9 * Math.max(1, r0.clarkDistance),
  );
});

test('clark primitive: positive-scale invariant (k*x)', () => {
  const base = [1, 2, 3, 4, 50, 60, 70, 80, 9, 10];
  const r0 = dailyTokenClarkDistanceHalves(base);
  const r1 = dailyTokenClarkDistanceHalves(base.map((v) => v * 7));
  assert.ok(
    Math.abs(r0.clarkDistance - r1.clarkDistance) <=
      1e-9 * Math.max(1, r0.clarkDistance),
  );
});

test('clark primitive: half-swap symmetry preserves clarkDistance', () => {
  const base = [1, 2, 3, 4, 50, 60, 70, 80, 9, 10, 11, 12];
  const n = base.length;
  const n1 = Math.floor(n / 2);
  const swapped = base.slice(n1).concat(base.slice(0, n1));
  const r0 = dailyTokenClarkDistanceHalves(base);
  const r1 = dailyTokenClarkDistanceHalves(swapped);
  assert.ok(
    Math.abs(r0.clarkDistance - r1.clarkDistance) <=
      1e-12 * Math.max(1, r0.clarkDistance),
  );
  assert.ok(
    Math.abs(r0.clarkMaxRelGap - r1.clarkMaxRelGap) <=
      1e-12 * Math.max(1, r0.clarkMaxRelGap),
  );
});

test('clark primitive: CLARK_PMF_FLOOR is small enough to be a no-op', () => {
  assert.ok(CLARK_PMF_FLOOR > 0);
  assert.ok(CLARK_PMF_FLOOR <= 1e-12);
});

test('clark primitive: silverman multiplier matches axes 126-134', () => {
  assert.equal(CLARK_SILVERMAN_MULTIPLIER, 0.9);
});

test('clark primitive: grid extension matches axes 126-134', () => {
  assert.equal(CLARK_GRID_EXTENSION_H, 3);
});

// ---------- builder: empty and degenerate ----------

test('clark builder: empty queue returns no rows', () => {
  const r = buildDailyTokenClarkDistanceHalves([], { generatedAt: 'X' });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('clark builder: rejects non-integer minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenClarkDistanceHalves([], {
        minTenureDays: 7.5 as unknown as number,
      }),
    /minTenureDays/,
  );
});

test('clark builder: rejects minTenureDays below floor 8', () => {
  assert.throws(
    () => buildDailyTokenClarkDistanceHalves([], { minTenureDays: 7 }),
    /minTenureDays/,
  );
});

test('clark builder: rejects negative minTokens', () => {
  assert.throws(
    () => buildDailyTokenClarkDistanceHalves([], { minTokens: -1 }),
    /minTokens/,
  );
});

test('clark builder: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenClarkDistanceHalves([], { top: -1 }),
    /top/,
  );
});

test('clark builder: rejects unknown sort', () => {
  assert.throws(
    () =>
      buildDailyTokenClarkDistanceHalves([], {
        sort: 'bogus' as unknown as 'clark',
      }),
    /sort/,
  );
});

test('clark builder: rejects invalid since', () => {
  assert.throws(
    () =>
      buildDailyTokenClarkDistanceHalves([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('clark builder: rejects invalid until', () => {
  assert.throws(
    () =>
      buildDailyTokenClarkDistanceHalves([], { until: 'not-a-date' }),
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

test('clark builder: detects half-vs-half drift on synthetic source', () => {
  const queue = makeQueue('alpha', 16);
  const r = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'alpha');
  assert.ok(row.clarkDistance > 0);
  assert.ok(row.clarkMaxRelGap > 0);
});

test('clark builder: source filter narrows rows', () => {
  const queue = [...makeQueue('alpha', 16), ...makeQueue('beta', 16)];
  const r = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'X',
    source: 'alpha',
    minTokens: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.ok(r.droppedSourceFilter > 0);
});

test('clark builder: top cap drops surplus rows', () => {
  const queue = [
    ...makeQueue('alpha', 16),
    ...makeQueue('beta', 16, 2),
    ...makeQueue('gamma', 16, 3),
  ];
  const r = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('clark builder: sort clarkDesc puts largest distance first', () => {
  const queue = [
    ...makeQueue('mild', 16, 0.001),
    ...makeQueue('big', 16, 1),
  ];
  const r = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'clarkDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.clarkDistance >= r.sources[1]!.clarkDistance);
});

test('clark builder: sort clark (asc) puts smallest distance first', () => {
  const queue = [
    ...makeQueue('mild', 16, 0.001),
    ...makeQueue('big', 16, 1),
  ];
  const r = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'clark',
  });
  assert.ok(r.sources[0]!.clarkDistance <= r.sources[1]!.clarkDistance);
});

test('clark builder: sort source breaks ties alphabetically', () => {
  const queue = [
    ...makeQueue('zeta', 16),
    ...makeQueue('alpha', 16),
  ];
  const r = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('clark builder: dropping invalid hour_start counted', () => {
  const queue = [
    ql('not-a-date', 'alpha', 100),
    ...makeQueue('alpha', 16),
  ];
  const r = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('clark builder: dropping non-positive tokens counted', () => {
  const queue = [
    ql(dayIso(0), 'alpha', 0),
    ql(dayIso(1), 'alpha', -5),
    ...makeQueue('alpha', 16),
  ];
  const r = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('clark builder: below min-tokens drops sparse sources', () => {
  const queue = [...makeQueue('alpha', 16), ...makeQueue('tiny', 16, 0.0001)];
  const r = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1000,
  });
  assert.ok(r.droppedSparseSources >= 1);
});

test('clark builder: below min-tenure-days drops short sources', () => {
  const queue = makeQueue('alpha', 8);
  const r = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    minTenureDays: 14,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('clark builder: gridK and silvermanMultiplier surface in report', () => {
  const queue = makeQueue('alpha', 16);
  const r = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
  });
  assert.equal(r.gridK, 257);
  assert.equal(r.silvermanMultiplier, 0.9);
  assert.equal(r.pmfFloor, CLARK_PMF_FLOOR);
});

test('clark builder: sort maxRelDesc orders by clarkMaxRelGap desc', () => {
  const queue = [
    ...makeQueue('alpha', 16, 1),
    ...makeQueue('beta', 16, 5),
  ];
  const r = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'maxRelDesc',
  });
  assert.ok(r.sources[0]!.clarkMaxRelGap >= r.sources[1]!.clarkMaxRelGap);
});

test('clark builder: sort tokens descending by totalTokens', () => {
  const queue = [
    ...makeQueue('big', 16, 10),
    ...makeQueue('small', 16, 1),
  ];
  const r = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
    sort: 'tokens',
  });
  assert.equal(r.sources[0]!.source, 'big');
});

test('clark builder: pure builder is deterministic w.r.t. fixed generatedAt', () => {
  const queue = makeQueue('alpha', 16);
  const r1 = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'fixed',
    minTokens: 1,
  });
  const r2 = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'fixed',
    minTokens: 1,
  });
  assert.deepEqual(r1, r2);
});

// ---------- diagnostic: clarkSpreadRatio ----------

test('clark primitive: clarkSpreadRatio in [0, 1]', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.clarkSpreadRatio >= 0 && r.clarkSpreadRatio <= 1 + 1e-12);
});

test('clark primitive: clarkSpreadRatio identity sqrt(K)*maxRel*spread === clark', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  const reconstructed =
    Math.sqrt(r.clarkGridK) * r.clarkMaxRelGap * r.clarkSpreadRatio;
  assert.ok(
    Math.abs(reconstructed - r.clarkDistance) <=
      1e-10 * Math.max(1, r.clarkDistance),
  );
});

test('clark primitive: identical halves give clarkSpreadRatio === 0 (vacuous case)', () => {
  const r = dailyTokenClarkDistanceHalves([1, 2, 3, 4, 1, 2, 3, 4]);
  assert.equal(r.clarkSpreadRatio, 0);
});

test('clark builder: clarkSpreadRatio surfaces on every row', () => {
  const queue = makeQueue('alpha', 16);
  const r = buildDailyTokenClarkDistanceHalves(queue, {
    generatedAt: 'X',
    minTokens: 1,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(typeof row.clarkSpreadRatio === 'number');
  assert.ok(row.clarkSpreadRatio >= 0 && row.clarkSpreadRatio <= 1 + 1e-12);
});
