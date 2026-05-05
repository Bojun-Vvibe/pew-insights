import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenWestenbergHalves,
  buildDailyTokenWestenbergHalves,
  quantileType7Westenberg,
  standardNormalUpperTailWestenberg,
} from '../src/dailytokenwestenberghalves.js';
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

// ---------- helpers ----------

test('quantileType7Westenberg: median of 1..5 is 3', () => {
  assert.equal(quantileType7Westenberg([1, 2, 3, 4, 5], 0.5), 3);
});

test('quantileType7Westenberg: Q1 of 1..5 is 2', () => {
  assert.equal(quantileType7Westenberg([1, 2, 3, 4, 5], 0.25), 2);
});

test('quantileType7Westenberg: Q3 of 1..5 is 4', () => {
  assert.equal(quantileType7Westenberg([1, 2, 3, 4, 5], 0.75), 4);
});

test('quantileType7Westenberg: handles unsorted input', () => {
  assert.equal(quantileType7Westenberg([5, 2, 4, 1, 3], 0.5), 3);
});

test('quantileType7Westenberg: p=0 returns min', () => {
  assert.equal(quantileType7Westenberg([3, 1, 2], 0), 1);
});

test('quantileType7Westenberg: p=1 returns max', () => {
  assert.equal(quantileType7Westenberg([3, 1, 2], 1), 3);
});

test('quantileType7Westenberg: single-element returns value', () => {
  assert.equal(quantileType7Westenberg([42], 0.25), 42);
});

test('quantileType7Westenberg: empty throws', () => {
  assert.throws(() => quantileType7Westenberg([], 0.5), /empty/);
});

test('quantileType7Westenberg: invalid p throws', () => {
  assert.throws(() => quantileType7Westenberg([1, 2, 3], -0.1), /p in/);
  assert.throws(() => quantileType7Westenberg([1, 2, 3], 1.1), /p in/);
});

test('quantileType7Westenberg: linear interpolation at p=0.5 of [10,20,30,40]', () => {
  // h = 3*0.5 = 1.5, j = 1, g = 0.5, Q = 20 + 0.5 * 10 = 25
  assert.equal(quantileType7Westenberg([10, 20, 30, 40], 0.5), 25);
});

test('standardNormalUpperTailWestenberg: Q(0) = 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailWestenberg(0) - 0.5) < 1e-6);
});

test('standardNormalUpperTailWestenberg: Q(1.96) ~ 0.025', () => {
  assert.ok(
    Math.abs(standardNormalUpperTailWestenberg(1.96) - 0.025) < 0.001,
  );
});

test('standardNormalUpperTailWestenberg: Q(-1.96) ~ 0.975', () => {
  assert.ok(
    Math.abs(standardNormalUpperTailWestenberg(-1.96) - 0.975) < 0.001,
  );
});

test('standardNormalUpperTailWestenberg: rejects non-finite', () => {
  assert.throws(() => standardNormalUpperTailWestenberg(NaN), /finite/);
});

// ---------- core: Westenberg ----------

test('dailyTokenWestenbergHalves: rejects too few samples', () => {
  assert.throws(
    () =>
      dailyTokenWestenbergHalves([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
      ]),
    /at least 16 samples/,
  );
});

test('dailyTokenWestenbergHalves: rejects non-finite', () => {
  const bad = new Array(16).fill(1);
  bad[3] = NaN;
  assert.throws(
    () => dailyTokenWestenbergHalves(bad),
    /finite/,
  );
});

test('dailyTokenWestenbergHalves: rejects all-constant', () => {
  assert.throws(
    () => dailyTokenWestenbergHalves(new Array(16).fill(5)),
    /zero centred variance/,
  );
});

test('dailyTokenWestenbergHalves: rejects degenerate IQR (constant first half)', () => {
  // First half constant -> Q1=Q3, but full series has variance.
  const x = [
    5, 5, 5, 5, 5, 5, 5, 5,
    1, 2, 3, 4, 5, 6, 7, 8,
  ];
  assert.throws(
    () => dailyTokenWestenbergHalves(x),
    /degenerate IQR/,
  );
});

test('dailyTokenWestenbergHalves: equal-distribution halves give k near n2/2', () => {
  // First half = 1..8, second half = a permutation of 1..8.
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 5, 1, 8, 4, 6, 3, 7, 2];
  const r = dailyTokenWestenbergHalves(x);
  assert.equal(r.westN1, 8);
  assert.equal(r.westN2, 8);
  // Q1_A=2.75, Q3_A=6.25; B has values 5,1,8,4,6,3,7,2.
  // Outside [2.75, 6.25]: 1,8,2,7 -> k=4. Expected 4. westZ = 0.
  assert.equal(r.westK, 4);
  assert.equal(r.westZ, 0);
  assert.equal(r.westPValue, 1);
});

test('dailyTokenWestenbergHalves: second half all far outside -> westZ very positive', () => {
  // First half clustered around 0..10, second half all >> Q3_A.
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8,
    100, 200, 300, 400, 500, 600, 700, 800,
  ];
  const r = dailyTokenWestenbergHalves(x);
  // All B values are >> Q3_A=6.25 -> k=8 -> westZ = (16-8)/sqrt(8) ~ 2.828
  assert.equal(r.westK, 8);
  assert.ok(Math.abs(r.westZ - 2.828) < 0.01);
  assert.ok(r.westPValue < 0.01);
});

test('dailyTokenWestenbergHalves: second half all inside A IQR -> westZ very negative', () => {
  // First half spans wide; second half all inside Q1_A..Q3_A.
  const x = [
    -100, -50, 1, 2, 3, 4, 50, 100,
    2, 3, 2, 3, 2, 3, 2, 3,
  ];
  const r = dailyTokenWestenbergHalves(x);
  // Q1_A=-12.25, Q3_A=15.5; all B values 2,3 are inside -> k=0
  assert.equal(r.westK, 0);
  assert.ok(r.westZ < -2.5);
  assert.ok(r.westPValue < 0.01);
});

test('dailyTokenWestenbergHalves: shift invariance westZ(x+c) = westZ(x)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 5, 1, 8, 4, 6, 3, 9, 0];
  const r1 = dailyTokenWestenbergHalves(x);
  const r2 = dailyTokenWestenbergHalves(x.map((v) => v + 1000));
  assert.equal(r1.westZ, r2.westZ);
  assert.equal(r1.westK, r2.westK);
});

test('dailyTokenWestenbergHalves: positive scale invariance westZ(a*x) = westZ(x)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 5, 1, 8, 4, 6, 3, 9, 0];
  const r1 = dailyTokenWestenbergHalves(x);
  const r2 = dailyTokenWestenbergHalves(x.map((v) => v * 7));
  assert.equal(r1.westZ, r2.westZ);
  assert.equal(r1.westK, r2.westK);
});

test('dailyTokenWestenbergHalves: independent within-half shift does NOT alter westZ if monotone overall', () => {
  // Shifting only B uniformly translates it, so its inside/outside status changes.
  // We demonstrate with a B shift that the test IS sensitive (it is NOT invariant
  // under within-half shifts -- this distinguishes it from FK).
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8];
  const r1 = dailyTokenWestenbergHalves(x);
  const xShiftB = [1, 2, 3, 4, 5, 6, 7, 8, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008];
  const r2 = dailyTokenWestenbergHalves(xShiftB);
  assert.notEqual(r1.westK, r2.westK);
});

test('dailyTokenWestenbergHalves: pValue between 0 and 1', () => {
  const x = [
    1, 4, 2, 9, 3, 7, 5, 8,
    11, 14, 12, 19, 13, 17, 15, 18,
  ];
  const r = dailyTokenWestenbergHalves(x);
  assert.ok(r.westPValue >= 0 && r.westPValue <= 1);
});

test('dailyTokenWestenbergHalves: nSamples and counts populated', () => {
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8,
    9, 10, 11, 12, 13, 14, 15, 16,
  ];
  const r = dailyTokenWestenbergHalves(x);
  assert.equal(r.nSamples, 16);
  assert.equal(r.westN1, 8);
  assert.equal(r.westN2, 8);
  assert.equal(r.westExpectedK, 4);
  assert.ok(r.westQ3A > r.westQ1A);
});

test('dailyTokenWestenbergHalves: monotonic transformation invariance', () => {
  // Strict-increasing monotone transform applied UNIFORMLY preserves order
  // hence preserves quantile-membership status.
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 5, 1, 8, 4, 6, 3, 9, 0];
  const r1 = dailyTokenWestenbergHalves(x);
  // Apply x -> x*x + 1 (strict increasing on non-negatives; we need x>=0)
  const xPos = x.map((v) => v + 0.5);
  const xMono = xPos.map((v) => v * v + 1);
  // Note: this is not exactly equivalent because we're using continuous values
  // so just verify both produce valid output (full monotone-invariance is by design
  // proven mathematically; numerically this serves as smoke).
  const r2 = dailyTokenWestenbergHalves(xMono);
  // Same k count: monotonic transform of all 16 values preserves order so
  // the IQR boundaries of A move accordingly and B's inside/outside status
  // is preserved.
  assert.equal(r1.westK, r2.westK);
});

// ---------- builder ----------

test('buildDailyTokenWestenbergHalves: empty queue -> zero rows', () => {
  const r = buildDailyTokenWestenbergHalves([], { generatedAt: '2026-05-05T00:00:00.000Z' });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
});

test('buildDailyTokenWestenbergHalves: single source with 16 days produces 1 row', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 1000 + i * 100));
  }
  const r = buildDailyTokenWestenbergHalves(queue, {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.equal(r.sources[0]!.westN1, 8);
  assert.equal(r.sources[0]!.westN2, 8);
});

test('buildDailyTokenWestenbergHalves: respects min-tokens filter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'tiny', 1));
  }
  const r = buildDailyTokenWestenbergHalves(queue, {
    minTokens: 1000,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenWestenbergHalves: respects min-tenure-days filter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 5000));
  }
  const r = buildDailyTokenWestenbergHalves(queue, {
    minTenureDays: 20,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenWestenbergHalves: rejects min-tenure-days below 16', () => {
  assert.throws(
    () =>
      buildDailyTokenWestenbergHalves([], {
        minTenureDays: 15,
        generatedAt: '2026-05-05T00:00:00.000Z',
      }),
    />= 16/,
  );
});

test('buildDailyTokenWestenbergHalves: rejects negative min-tokens', () => {
  assert.throws(
    () =>
      buildDailyTokenWestenbergHalves([], {
        minTokens: -1,
        generatedAt: '2026-05-05T00:00:00.000Z',
      }),
    /non-negative/,
  );
});

test('buildDailyTokenWestenbergHalves: rejects bogus sort', () => {
  assert.throws(
    () =>
      buildDailyTokenWestenbergHalves([], {
        sort: 'bogus' as never,
        generatedAt: '2026-05-05T00:00:00.000Z',
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenWestenbergHalves: rejects bad since/until', () => {
  assert.throws(
    () =>
      buildDailyTokenWestenbergHalves([], {
        since: 'not-a-date',
        generatedAt: '2026-05-05T00:00:00.000Z',
      }),
    /invalid since/,
  );
});

test('buildDailyTokenWestenbergHalves: drops invalid hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'src-a', 1000),
  ];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 5000));
  }
  const r = buildDailyTokenWestenbergHalves(queue, {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenWestenbergHalves: drops non-positive tokens', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'src-a', 0),
    ql(dayIso(0), 'src-a', -5),
  ];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 5000));
  }
  const r = buildDailyTokenWestenbergHalves(queue, {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenWestenbergHalves: source filter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 1000 + i * 100));
    queue.push(ql(dayIso(i), 'src-b', 2000 + i * 50));
  }
  const r = buildDailyTokenWestenbergHalves(queue, {
    source: 'src-a',
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.equal(r.droppedSourceFilter, 16);
});

test('buildDailyTokenWestenbergHalves: top cap', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 16; i += 1) {
      queue.push(ql(dayIso(i), src, 5000 + i * (src.charCodeAt(0) - 96) * 100));
    }
  }
  const r = buildDailyTokenWestenbergHalves(queue, {
    top: 2,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenWestenbergHalves: sort westZAbsDesc puts largest |z| first', () => {
  const queue: QueueLine[] = [];
  // src-a: stable
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 1000 + (i % 4) * 50));
  }
  // src-b: blow-up in second half
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'src-b', 1000 + i * 10));
  }
  for (let i = 8; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-b', 100000 + i * 1000));
  }
  const r = buildDailyTokenWestenbergHalves(queue, {
    sort: 'westZAbsDesc',
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(
    Math.abs(r.sources[0]!.westZ) >= Math.abs(r.sources[1]!.westZ),
  );
});

test('buildDailyTokenWestenbergHalves: sort source -> alphabetical', () => {
  const queue: QueueLine[] = [];
  for (const src of ['c', 'a', 'b']) {
    for (let i = 0; i < 16; i += 1) {
      queue.push(ql(dayIso(i), src, 5000 + i * 100));
    }
  }
  const r = buildDailyTokenWestenbergHalves(queue, {
    sort: 'source',
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b', 'c'],
  );
});

test('buildDailyTokenWestenbergHalves: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  // Only one active day in tenure -> rest are gap-filled zeros.
  // Actually need n>=16 with all values equal: insert 16 days all same tokens
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-flat', 5000));
  }
  const r = buildDailyTokenWestenbergHalves(queue, {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  // All 16 equal -> zero variance -> dropped.
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenWestenbergHalves: drops degenerate-IQR sources via droppedNonFiniteFit', () => {
  const queue: QueueLine[] = [];
  // First 8 days same, last 8 different: variance > 0 but Q1=Q3 in first half.
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'src-x', 5000));
  }
  for (let i = 8; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-x', 5000 + i * 100));
  }
  const r = buildDailyTokenWestenbergHalves(queue, {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.droppedNonFiniteFit, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenWestenbergHalves: window since/until', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 5000));
  }
  const r = buildDailyTokenWestenbergHalves(queue, {
    since: dayIso(5),
    until: dayIso(25),
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  // 20 days within window but all equal -> zero variance.
  assert.equal(r.windowStart, dayIso(5));
  assert.equal(r.windowEnd, dayIso(25));
});

test('buildDailyTokenWestenbergHalves: westExpectedK matches n2/2', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 17; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 1000 + i * 100));
  }
  const r = buildDailyTokenWestenbergHalves(queue, {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.westExpectedK, row.westN2 / 2);
});
