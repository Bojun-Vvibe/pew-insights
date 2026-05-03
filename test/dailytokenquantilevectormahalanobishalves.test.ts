import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenQuantileVectorMahalanobisHalves,
  buildDailyTokenQuantileVectorMahalanobisHalves,
  QV_PROBABILITY_GRID,
} from '../src/dailytokenquantilevectormahalanobishalves.js';
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

// Brute-force reference: Hyndman-Fan TYPE-7 quantile.
function quantile7(values: number[], p: number): number {
  const s = values.slice().sort((a, b) => a - b);
  const m = s.length;
  if (m === 1) return s[0]!;
  if (p <= 0) return s[0]!;
  if (p >= 1) return s[m - 1]!;
  const h = (m - 1) * p;
  const j = Math.floor(h);
  const gamma = h - j;
  return s[j]! + gamma * (s[j + 1]! - s[j]!);
}

function bruteD2Diag(a: number[], b: number[], pooled: number[]): number {
  const grid = QV_PROBABILITY_GRID;
  const k = grid.length;
  const iqr = quantile7(pooled, 0.75) - quantile7(pooled, 0.25);
  let s = 0;
  for (const p of grid) {
    const d = quantile7(b, p) - quantile7(a, p);
    s += d * d;
  }
  return s / (k * iqr * iqr);
}

// ---------- primitive: input validation ----------

test('dailyTokenQuantileVectorMahalanobisHalves: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenQuantileVectorMahalanobisHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenQuantileVectorMahalanobisHalves: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenQuantileVectorMahalanobisHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () =>
      dailyTokenQuantileVectorMahalanobisHalves([
        1, Infinity, 3, 4, 5, 6, 7, 8,
      ]),
    /finite values/,
  );
  assert.throws(
    () =>
      dailyTokenQuantileVectorMahalanobisHalves([
        1, -Infinity, 3, 4, 5, 6, 7, 8,
      ]),
    /finite values/,
  );
});

test('dailyTokenQuantileVectorMahalanobisHalves: zero centred variance throws', () => {
  assert.throws(
    () =>
      dailyTokenQuantileVectorMahalanobisHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

test('dailyTokenQuantileVectorMahalanobisHalves: zero pooled IQR throws', () => {
  // n=10, but middle 50% all equal -> q25 == q75.
  // Construct: 1,1,1,1,1,1,1,1,2,3 -> q25 and q75 both = 1.
  assert.throws(
    () =>
      dailyTokenQuantileVectorMahalanobisHalves([1, 1, 1, 1, 1, 1, 1, 1, 2, 3]),
    /pooled IQR is non-positive/,
  );
});

// ---------- primitive: half-split sizes ----------

test('dailyTokenQuantileVectorMahalanobisHalves: n1 = floor(n/2), even n', () => {
  const r = dailyTokenQuantileVectorMahalanobisHalves([
    1, 2, 3, 4, 5, 6, 7, 8,
  ]);
  assert.equal(r.qvN1, 4);
  assert.equal(r.qvN2, 4);
  assert.equal(r.nSamples, 8);
});

test('dailyTokenQuantileVectorMahalanobisHalves: n1 = floor(n/2), odd n', () => {
  const r = dailyTokenQuantileVectorMahalanobisHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9,
  ]);
  assert.equal(r.qvN1, 4);
  assert.equal(r.qvN2, 5);
});

// ---------- primitive: matches brute-force ----------

test('dailyTokenQuantileVectorMahalanobisHalves: d2Diag matches brute-force on length 16', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  const r = dailyTokenQuantileVectorMahalanobisHalves(x);
  const ref = bruteD2Diag(x.slice(0, 8), x.slice(8), x);
  assert.ok(
    Math.abs(r.qvD2Diag - ref) < 1e-12,
    `expected d2Diag = ${ref}, got ${r.qvD2Diag}`,
  );
});

test('dailyTokenQuantileVectorMahalanobisHalves: d2Diag matches brute-force on noisy 30-sample series', () => {
  const x: number[] = [];
  for (let i = 0; i < 30; i += 1) {
    x.push(((i * 9301 + 49297) % 233280) / 100);
  }
  const r = dailyTokenQuantileVectorMahalanobisHalves(x);
  const ref = bruteD2Diag(x.slice(0, 15), x.slice(15), x);
  assert.ok(
    Math.abs(r.qvD2Diag - ref) < 1e-10,
    `expected d2Diag = ${ref}, got ${r.qvD2Diag}`,
  );
});

// ---------- primitive: identities ----------

test('dailyTokenQuantileVectorMahalanobisHalves: translation-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenQuantileVectorMahalanobisHalves(x);
  const r2 = dailyTokenQuantileVectorMahalanobisHalves(
    x.map((v) => v + 1000),
  );
  assert.ok(Math.abs(r1.qvD2Diag - r2.qvD2Diag) < 1e-10);
  assert.ok(Math.abs(r1.qvT - r2.qvT) < 1e-10);
  assert.ok(Math.abs(r1.qvZ - r2.qvZ) < 1e-10);
  assert.ok(Math.abs(r1.qvLinf - r2.qvLinf) < 1e-10);
  // pooled IQR is translation-invariant
  assert.ok(Math.abs(r1.qvIqrPool - r2.qvIqrPool) < 1e-10);
});

test('dailyTokenQuantileVectorMahalanobisHalves: positive-scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenQuantileVectorMahalanobisHalves(x);
  const r2 = dailyTokenQuantileVectorMahalanobisHalves(
    x.map((v) => 7 * v),
  );
  assert.ok(Math.abs(r1.qvD2Diag - r2.qvD2Diag) < 1e-10);
  assert.ok(Math.abs(r1.qvT - r2.qvT) < 1e-10);
  assert.ok(Math.abs(r1.qvZ - r2.qvZ) < 1e-10);
  assert.ok(Math.abs(r1.qvLinf - r2.qvLinf) < 1e-10);
});

test('dailyTokenQuantileVectorMahalanobisHalves: identical halves gives d2Diag = 0', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenQuantileVectorMahalanobisHalves(half.concat(half));
  assert.ok(r.qvD2Diag < 1e-12, `expected ~0, got ${r.qvD2Diag}`);
  assert.ok(r.qvZ < 1e-6);
  assert.ok(r.qvT < 1e-9);
  assert.equal(r.qvDir, 0);
  assert.equal(r.qvZSigned, 0);
  assert.ok(r.qvLinf < 1e-12);
});

test('dailyTokenQuantileVectorMahalanobisHalves: d2Diag >= 0 always', () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const x: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      x.push(((i * seed * 7 + 11) % 97) + 1);
    }
    let allEq = true;
    for (let i = 1; i < x.length; i += 1) if (x[i] !== x[0]) allEq = false;
    if (allEq) continue;
    let r;
    try {
      r = dailyTokenQuantileVectorMahalanobisHalves(x);
    } catch {
      continue;
    }
    assert.ok(r.qvD2Diag >= 0, `seed ${seed}: d2Diag=${r.qvD2Diag} < 0`);
  }
});

test('dailyTokenQuantileVectorMahalanobisHalves: shifted halves produce positive d2Diag', () => {
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ];
  const r = dailyTokenQuantileVectorMahalanobisHalves(x);
  assert.ok(r.qvD2Diag > 0);
  assert.equal(r.qvDir, 1, 'second half median > first half median');
  assert.ok(r.qvZSigned > 0);
});

test('dailyTokenQuantileVectorMahalanobisHalves: swapping halves preserves d2Diag, negates qvDir', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  const b = [50, 51, 52, 53, 54, 55, 56, 57];
  const r1 = dailyTokenQuantileVectorMahalanobisHalves(a.concat(b));
  const r2 = dailyTokenQuantileVectorMahalanobisHalves(b.concat(a));
  assert.ok(Math.abs(r1.qvD2Diag - r2.qvD2Diag) < 1e-10);
  assert.ok(Math.abs(r1.qvT - r2.qvT) < 1e-10);
  assert.ok(Math.abs(r1.qvZ - r2.qvZ) < 1e-10);
  assert.equal(r1.qvDir, 1);
  assert.equal(r2.qvDir, -1);
  assert.ok(Math.abs(r1.qvZSigned + r2.qvZSigned) < 1e-10);
});

test('dailyTokenQuantileVectorMahalanobisHalves: qvT scaling identity', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r = dailyTokenQuantileVectorMahalanobisHalves(x);
  const expected = ((r.qvN1 * r.qvN2) / (r.qvN1 + r.qvN2)) * r.qvD2Diag;
  assert.ok(Math.abs(r.qvT - expected) < 1e-12);
});

test('dailyTokenQuantileVectorMahalanobisHalves: qvZ = sqrt(d2Diag)', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r = dailyTokenQuantileVectorMahalanobisHalves(x);
  assert.ok(Math.abs(r.qvZ - Math.sqrt(r.qvD2Diag)) < 1e-12);
});

test('dailyTokenQuantileVectorMahalanobisHalves: qvLinfArgmax index in range', () => {
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ];
  const r = dailyTokenQuantileVectorMahalanobisHalves(x);
  assert.ok(r.qvLinfArgmax >= 0);
  assert.ok(r.qvLinfArgmax < QV_PROBABILITY_GRID.length);
});

test('dailyTokenQuantileVectorMahalanobisHalves: qvLinf >= per-quantile gap on grid', () => {
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ];
  const r = dailyTokenQuantileVectorMahalanobisHalves(x);
  const a = x.slice(0, r.qvN1);
  const b = x.slice(r.qvN1);
  for (const p of QV_PROBABILITY_GRID) {
    const gap = Math.abs(quantile7(b, p) - quantile7(a, p)) / r.qvIqrPool;
    assert.ok(r.qvLinf >= gap - 1e-10);
  }
});

test('dailyTokenQuantileVectorMahalanobisHalves: medianA, medianB equal sample median', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r = dailyTokenQuantileVectorMahalanobisHalves(x);
  // n=12 -> n1=6, n2=6; A=[1,4,2,9,5,7] sorted=[1,2,4,5,7,9] median=(4+5)/2=4.5
  // B=[3,6,8,10,11,12] sorted=[3,6,8,10,11,12] median=(8+10)/2=9
  assert.equal(r.qvMedianA, 4.5);
  assert.equal(r.qvMedianB, 9);
});

test('dailyTokenQuantileVectorMahalanobisHalves: pooled IQR matches type-7 quantile defs', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r = dailyTokenQuantileVectorMahalanobisHalves(x);
  const expected = quantile7(x, 0.75) - quantile7(x, 0.25);
  assert.ok(Math.abs(r.qvIqrPool - expected) < 1e-12);
});

// ---------- primitive: probability grid is fixed and frozen ----------

test('QV_PROBABILITY_GRID: is the fixed 9-point interior grid {0.1,..,0.9}', () => {
  assert.equal(QV_PROBABILITY_GRID.length, 9);
  assert.deepEqual(
    QV_PROBABILITY_GRID.slice(),
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
  );
});

test('QV_PROBABILITY_GRID: is frozen', () => {
  assert.ok(Object.isFrozen(QV_PROBABILITY_GRID));
});

test('QV_PROBABILITY_GRID: excludes 0 and 1 by design', () => {
  assert.ok(!QV_PROBABILITY_GRID.includes(0));
  assert.ok(!QV_PROBABILITY_GRID.includes(1));
});

// ---------- builder: input validation ----------

test('build: rejects negative minTokens', () => {
  assert.throws(
    () => buildDailyTokenQuantileVectorMahalanobisHalves([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('build: rejects non-integer minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenQuantileVectorMahalanobisHalves([], {
        minTenureDays: 7.5,
      }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects minTenureDays below hard floor 8', () => {
  assert.throws(
    () =>
      buildDailyTokenQuantileVectorMahalanobisHalves([], {
        minTenureDays: 7,
      }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenQuantileVectorMahalanobisHalves([], { top: -1 }),
    /top must be a non-negative integer/,
  );
});

test('build: rejects invalid sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenQuantileVectorMahalanobisHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('build: rejects invalid since/until', () => {
  assert.throws(
    () =>
      buildDailyTokenQuantileVectorMahalanobisHalves([], {
        since: 'not-a-date',
      }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenQuantileVectorMahalanobisHalves([], {
        until: 'not-a-date',
      }),
    /invalid until/,
  );
});

// ---------- builder: sorting ----------

function makeQueueWithTwoSources(): QueueLine[] {
  const q: QueueLine[] = [];
  // source A: noisy, big shift between halves
  for (let i = 0; i < 20; i += 1) {
    const v = i < 10 ? 100 + (i % 3) * 10 : 1000 + (i % 3) * 10;
    q.push(ql(dayIso(i), 'src-a', v));
  }
  // source B: stable, no shift
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i), 'src-b', 500 + ((i * 7) % 11)));
  }
  return q;
}

test('build: sort qvTDesc puts the biggest qvT first', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 0,
    sort: 'qvTDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.qvT >= r.sources[1]!.qvT);
});

test('build: sort source asc orders alphabetically', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 0,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.equal(r.sources[1]!.source, 'src-b');
});

test('build: sort tokens orders by descending tokens', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 0,
    sort: 'tokens',
  });
  assert.ok(r.sources[0]!.totalTokens >= r.sources[1]!.totalTokens);
});

test('build: sort qvLinfDesc puts biggest qvLinf first', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 0,
    sort: 'qvLinfDesc',
  });
  assert.ok(r.sources[0]!.qvLinf >= r.sources[1]!.qvLinf);
});

// ---------- builder: filtering & dropped counts ----------

test('build: drops sparse sources below minTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i), 'tiny', 1));
  }
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('build: drops below-min-tenure sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 6; i += 1) {
    q.push(ql(dayIso(i), 'short', 5000));
  }
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 0,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: drops zero-variance sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i), 'flat', 100));
  }
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 0,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: counts droppedNonPositiveTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i), 'mixed', 100));
  }
  q.push(ql(dayIso(20), 'mixed', 0));
  q.push(ql(dayIso(21), 'mixed', -5));
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 0,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: counts droppedInvalidHourStart', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'src', 100),
    ql('also-bad', 'src', 100),
  ];
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i), 'src', 100));
  }
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 0,
  });
  assert.equal(r.droppedInvalidHourStart, 2);
});

test('build: source filter restricts and counts droppedSourceFilter', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i), 'keep', 100 + i));
    q.push(ql(dayIso(i), 'drop', 100 + i));
  }
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 0,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 20);
});

test('build: top truncates and counts droppedTopSources', () => {
  const q: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    for (let i = 0; i < 20; i += 1) {
      q.push(ql(dayIso(i), `src-${s}`, 100 + s * 10 + i));
    }
  }
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 0,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('build: window since/until applies', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    q.push(ql(dayIso(i), 'src', 100 + i));
  }
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 0,
    since: dayIso(5),
    until: dayIso(25),
  });
  // 20 days kept; tenure 20.
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 20);
});

test('build: report includes probabilityGrid and matches QV_PROBABILITY_GRID', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 0,
  });
  assert.deepEqual(r.probabilityGrid, [
    0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
  ]);
});

test('build: empty queue returns empty sources', () => {
  const r = buildDailyTokenQuantileVectorMahalanobisHalves([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
});

test('build: generatedAt override is honoured', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 0,
    generatedAt: '2030-01-01T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2030-01-01T00:00:00.000Z');
});

test('build: gap-filled tenure correctly inflates with missing days', () => {
  const q: QueueLine[] = [];
  // Active days 0, 5, 10, 15 only -> tenure 16 calendar days, 4 active.
  for (const i of [0, 5, 10, 15]) {
    q.push(ql(dayIso(i), 'sparse', 1000));
  }
  // Pad to push above min-tokens and force more tenure
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i + 16), 'sparse', 100 + i));
  }
  const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 36);
  assert.equal(r.sources[0]!.nActiveDays, 24);
});

test('build: respects all 13 valid sort keys without throwing', () => {
  const q = makeQueueWithTwoSources();
  const sorts = [
    'd2Diag',
    'd2DiagDesc',
    'qvT',
    'qvTDesc',
    'qvZ',
    'qvZDesc',
    'qvZSigned',
    'qvZSignedDesc',
    'qvLinf',
    'qvLinfDesc',
    'tokens',
    'tenure',
    'source',
  ] as const;
  for (const s of sorts) {
    const r = buildDailyTokenQuantileVectorMahalanobisHalves(q, {
      minTokens: 0,
      sort: s,
    });
    assert.equal(r.sort, s);
    assert.ok(r.sources.length === 2);
  }
});
