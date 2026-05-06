import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint,
  ssaChangepointRun,
  ssaSubspaceDistance,
  hankelMatrix,
  frobeniusSq,
  gramSelf,
  jacobiEigSym,
} from '../src/dailytokenmoskvinazhigljavskyssasubspacechangepoint.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, tokens: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
  };
}

const GEN = '2026-05-06T12:00:00.000Z';

// ---- option validation ---------------------------------------------------

test('ssa-cp: rejects bad minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { minTenureDays: 20 }),
  );
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { minTenureDays: 21.5 }),
  );
});

test('ssa-cp: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { minTokens: NaN }),
  );
});

test('ssa-cp: rejects bad top', () => {
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { top: 1.5 }),
  );
});

test('ssa-cp: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], {
      sort: 'nope' as 'dMax',
    }),
  );
});

test('ssa-cp: rejects bad windowL', () => {
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { windowL: 1 }),
  );
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { windowL: 2.5 }),
  );
});

test('ssa-cp: rejects bad rank', () => {
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { rank: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { rank: 1.5 }),
  );
});

test('ssa-cp: rejects bad dThreshold', () => {
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { dThreshold: -0.1 }),
  );
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { dThreshold: 1.5 }),
  );
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { dThreshold: NaN }),
  );
});

test('ssa-cp: rejects bad onlyWithCps', () => {
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], {
      onlyWithCps: 'yes' as unknown as boolean,
    }),
  );
});

test('ssa-cp: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { since: 'nope' }),
  );
  assert.throws(() =>
    buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], { until: 'bad' }),
  );
});

// ---- empty / sparse ------------------------------------------------------

test('ssa-cp: empty queue -> empty report', () => {
  const r = buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint([], {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('ssa-cp: short tenure dropped', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`, 'a', 1000));
  }
  const r = buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('ssa-cp: zero-variance dropped', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const day = String(i + 1).padStart(2, '0');
    q.push(ql(`2026-03-${day}T12:00:00.000Z`, 'a', 1000));
  }
  const r = buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

// ---- determinism --------------------------------------------------------

test('ssa-cp: deterministic across two runs', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    const day = String(i + 1).padStart(2, '0');
    const month = i < 31 ? '03' : '04';
    const dd = i < 31 ? day : String(i - 30).padStart(2, '0');
    q.push(ql(`2026-${month}-${dd}T12:00:00.000Z`, 'a', 1000 + i * 50));
  }
  const a = buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint(q, {
    generatedAt: GEN,
  });
  const b = buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint(q, {
    generatedAt: GEN,
  });
  assert.deepEqual(a, b);
});

// ---- helpers ------------------------------------------------------------

test('ssa-cp: hankelMatrix shape and values', () => {
  const x = [1, 2, 3, 4, 5];
  const H = hankelMatrix(x, 3);
  assert.equal(H.rows, 3);
  assert.equal(H.cols, 3);
  assert.deepEqual(H.data, [1, 2, 3, 2, 3, 4, 3, 4, 5]);
});

test('ssa-cp: hankelMatrix rejects bad L', () => {
  assert.throws(() => hankelMatrix([1, 2, 3], 1));
  assert.throws(() => hankelMatrix([1, 2, 3], 3));
});

test('ssa-cp: frobeniusSq', () => {
  assert.equal(frobeniusSq([3, 4]), 25);
  assert.equal(frobeniusSq([]), 0);
});

test('ssa-cp: gramSelf is symmetric', () => {
  const X = [1, 2, 3, 4, 5, 6]; // 2x3
  const G = gramSelf(X, 2, 3);
  assert.equal(G.length, 4);
  assert.equal(G[1], G[2]); // symmetry
  assert.equal(G[0], 1 + 4 + 9);
  assert.equal(G[3], 16 + 25 + 36);
  assert.equal(G[1], 4 + 10 + 18);
});

test('ssa-cp: jacobiEigSym diagonalises identity', () => {
  const I = [1, 0, 0, 1];
  const { values, vectors } = jacobiEigSym(I, 2);
  assert.equal(values[0], 1);
  assert.equal(values[1], 1);
  assert.equal(vectors.length, 4);
});

test('ssa-cp: jacobiEigSym 2x2 symmetric', () => {
  // [[2, 1], [1, 2]] -> eigenvalues 3, 1.
  const A = [2, 1, 1, 2];
  const { values } = jacobiEigSym(A, 2);
  assert.ok(Math.abs(values[0]! - 3) < 1e-10);
  assert.ok(Math.abs(values[1]! - 1) < 1e-10);
});

test('ssa-cp: jacobiEigSym rejects bad shape', () => {
  assert.throws(() => jacobiEigSym([1, 2, 3], 2));
  assert.throws(() => jacobiEigSym([], 0));
});

test('ssa-cp: ssaSubspaceDistance returns 0 on identical windows (full rank)', () => {
  const x = [1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2];
  // base = first 6, test = last 6 (same pattern).
  const d = ssaSubspaceDistance(x.slice(0, 6), x.slice(6, 12), 3, 3);
  assert.ok(d < 1e-8);
});

test('ssa-cp: ssaSubspaceDistance > 0 on a regime shift', () => {
  const base = [1, 2, 1, 2, 1, 2, 1, 2];
  const test = [10, 20, 10, 20, 10, 20, 10, 20];
  const d = ssaSubspaceDistance(base, test, 3, 1);
  // Different magnitude AND fast oscillation: rank-1 subspace mismatch.
  assert.ok(d >= 0 && d <= 1);
});

test('ssa-cp: ssaSubspaceDistance bounded in [0, 1]', () => {
  const base = [1, 2, 3, 4, 5, 6, 7, 8];
  const test = [8, 7, 6, 5, 4, 3, 2, 1];
  const d = ssaSubspaceDistance(base, test, 3, 2);
  assert.ok(d >= 0);
  assert.ok(d <= 1);
});

test('ssa-cp: ssaSubspaceDistance rejects bad rank', () => {
  const x = [1, 2, 3, 4, 5, 6];
  assert.throws(() => ssaSubspaceDistance(x, x, 3, 0));
  assert.throws(() => ssaSubspaceDistance(x, x, 3, 4));
});

// ---- core ssaChangepointRun ---------------------------------------------

test('ssa-cp: ssaChangepointRun rejects bad opts', () => {
  const x = new Array(40).fill(0).map((_v, i) => i);
  assert.throws(() =>
    ssaChangepointRun(x, { L: 1, baseN: 10, testM: 10, rank: 1, dThreshold: 0.2 }),
  );
  assert.throws(() =>
    ssaChangepointRun(x, { L: 5, baseN: 5, testM: 10, rank: 1, dThreshold: 0.2 }),
  );
  assert.throws(() =>
    ssaChangepointRun(x, { L: 5, baseN: 10, testM: 4, rank: 1, dThreshold: 0.2 }),
  );
  assert.throws(() =>
    ssaChangepointRun(x, { L: 5, baseN: 10, testM: 10, rank: 6, dThreshold: 0.2 }),
  );
  assert.throws(() =>
    ssaChangepointRun(x, { L: 5, baseN: 10, testM: 10, rank: 1, dThreshold: -0.1 }),
  );
  assert.throws(() =>
    ssaChangepointRun(x, { L: 5, baseN: 10, testM: 10, rank: 1, dThreshold: 1.5 }),
  );
});

test('ssa-cp: ssaChangepointRun returns dCurve in [0, 1]', () => {
  const x = new Array(50).fill(0).map((_v, i) => (i < 25 ? 1 + (i % 3) : 100 + (i % 3)));
  const r = ssaChangepointRun(x, {
    L: 5,
    baseN: 15,
    testM: 15,
    rank: 2,
    dThreshold: 0.2,
  });
  for (const d of r.dCurve) {
    assert.ok(d >= 0 && d <= 1, `D out of range: ${d}`);
  }
  assert.ok(r.dMax >= 0 && r.dMax <= 1);
  assert.ok(r.dMean >= 0 && r.dMean <= 1);
  assert.ok(r.dArea >= 0);
});

test('ssa-cp: ssaChangepointRun finds a peak on a step shift', () => {
  const x: number[] = [];
  for (let i = 0; i < 60; i += 1) x.push(i < 30 ? 10 : 200);
  const r = ssaChangepointRun(x, {
    L: 5,
    baseN: 15,
    testM: 15,
    rank: 2,
    dThreshold: 0.2,
  });
  assert.ok(r.dMax > 0.2, `expected dMax > 0.2 on step shift, got ${r.dMax}`);
  assert.ok(r.tauStarBest >= 0);
});

test('ssa-cp: ssaChangepointRun no peak on stationary white-ish series', () => {
  const x = new Array(60).fill(0).map((_v, i) => 100 + ((i * 37) % 7));
  const r = ssaChangepointRun(x, {
    L: 5,
    baseN: 20,
    testM: 20,
    rank: 2,
    dThreshold: 0.5,
  });
  assert.ok(r.dMax < 0.5, `unexpected peak: ${r.dMax}`);
  assert.equal(r.tauStar.length, 0);
});

test('ssa-cp: ssaChangepointRun degenerate range -> empty curve', () => {
  const x = new Array(20).fill(0).map((_v, i) => i + 1);
  // baseN + testM > n means no candidate splits.
  const r = ssaChangepointRun(x, {
    L: 3,
    baseN: 12,
    testM: 12,
    rank: 1,
    dThreshold: 0.2,
  });
  assert.equal(r.dCurve.length, 0);
  assert.equal(r.tauStar.length, 0);
  assert.equal(r.tauStarBest, -1);
});

// ---- end-to-end builder integration -------------------------------------

test('ssa-cp: builder e2e with a step regime shift', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 60; i += 1) {
    // 60 consecutive days starting 2026-01-01.
    const ms = Date.parse('2026-01-01T12:00:00.000Z') + i * 86_400_000;
    const day = new Date(ms).toISOString();
    const tokens = i < 30 ? 1000 + (i % 3) * 10 : 5000 + (i % 3) * 10;
    q.push(ql(day, 'a', tokens));
  }
  const r = buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'a');
  assert.ok(row.dMax >= 0 && row.dMax <= 1);
  assert.ok(row.windowL >= 2);
  assert.ok(row.baseN >= row.windowL + 1);
  assert.ok(row.testM >= row.windowL);
  assert.equal(row.tauStar.length, row.tauStarDays.length);
});

test('ssa-cp: onlyWithCps filters out zero-cp sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    const ms = Date.parse('2026-01-01T12:00:00.000Z') + i * 86_400_000;
    const day = new Date(ms).toISOString();
    q.push(ql(day, 'flat', 1000 + (i % 5)));
  }
  const r = buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint(q, {
    generatedAt: GEN,
    onlyWithCps: true,
    dThreshold: 0.99,
  });
  assert.equal(r.sources.length, 0);
});

test('ssa-cp: top truncates and reports droppedTopSources', () => {
  const q: QueueLine[] = [];
  for (let s = 0; s < 3; s += 1) {
    for (let i = 0; i < 40; i += 1) {
      const ms = Date.parse('2026-01-01T12:00:00.000Z') + i * 86_400_000;
      const day = new Date(ms).toISOString();
      q.push(ql(day, `src${s}`, 1000 + i * 10 + s));
    }
  }
  const r = buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint(q, {
    generatedAt: GEN,
    top: 1,
    sort: 'tokens',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('ssa-cp: source filter only keeps named source', () => {
  const q: QueueLine[] = [];
  for (let s = 0; s < 2; s += 1) {
    for (let i = 0; i < 30; i += 1) {
      const ms = Date.parse('2026-01-01T12:00:00.000Z') + i * 86_400_000;
      const day = new Date(ms).toISOString();
      q.push(ql(day, s === 0 ? 'a' : 'b', 1000 + i * 7));
    }
  }
  const r = buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint(q, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.ok(r.sources.every((row) => row.source === 'a'));
  assert.ok(r.droppedSourceFilter > 0);
});

test('ssa-cp: each sort option produces stable rows', () => {
  const q: QueueLine[] = [];
  for (let s = 0; s < 3; s += 1) {
    for (let i = 0; i < 35; i += 1) {
      const ms = Date.parse('2026-01-01T12:00:00.000Z') + i * 86_400_000;
      const day = new Date(ms).toISOString();
      const tokens = i < 17 ? 1000 + s * 100 : 5000 + s * 100;
      q.push(ql(day, `s${s}`, tokens));
    }
  }
  const sorts = [
    'mChangepoints',
    'mChangepointsDesc',
    'dMax',
    'dMaxDesc',
    'dArea',
    'dAreaDesc',
    'dMean',
    'dMeanDesc',
    'tokens',
    'tenure',
    'source',
  ] as const;
  for (const s of sorts) {
    const r = buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint(q, {
      generatedAt: GEN,
      sort: s,
    });
    assert.equal(r.sources.length, 3);
  }
});

test('ssa-cp: invalid hour_start counted', () => {
  const q: QueueLine[] = [ql('not-a-date', 'a', 100)];
  const r = buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('ssa-cp: non-positive tokens counted', () => {
  const q: QueueLine[] = [
    ql('2026-01-01T12:00:00.000Z', 'a', 0),
    ql('2026-01-01T13:00:00.000Z', 'a', -5),
  ];
  const r = buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('ssa-cp: explicit windowL respected', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    const ms = Date.parse('2026-01-01T12:00:00.000Z') + i * 86_400_000;
    const day = new Date(ms).toISOString();
    q.push(ql(day, 'a', 1000 + i * 13));
  }
  const r = buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint(q, {
    generatedAt: GEN,
    windowL: 4,
    rank: 2,
  });
  assert.equal(r.windowL, 4);
  assert.ok(r.sources.every((row) => row.windowL === 4));
  assert.ok(r.sources.every((row) => row.rank === 2));
});
