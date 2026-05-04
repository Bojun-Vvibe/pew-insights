import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenBds,
  buildDailyTokenBds,
} from '../src/dailytokenbds.js';
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

test('dailyTokenBds: rejects fewer than 4 samples', () => {
  assert.throws(
    () => dailyTokenBds([1, 2, 3]),
    /at least 4 samples/,
  );
});

test('dailyTokenBds: rejects non-finite values', () => {
  assert.throws(() => dailyTokenBds([1, 2, NaN, 4]), /finite values/);
  assert.throws(() => dailyTokenBds([1, 2, 3, Infinity]), /finite values/);
});

test('dailyTokenBds: rejects embeddingDim < 2', () => {
  assert.throws(
    () => dailyTokenBds([1, 2, 3, 4, 5, 6], 1),
    /embeddingDim must be an integer >= 2/,
  );
  assert.throws(
    () => dailyTokenBds([1, 2, 3, 4, 5, 6], 2.5),
    /embeddingDim must be an integer >= 2/,
  );
});

test('dailyTokenBds: rejects non-positive epsSigma', () => {
  assert.throws(
    () => dailyTokenBds([1, 2, 3, 4, 5, 6], 2, 0),
    /epsSigma must be a positive finite number/,
  );
  assert.throws(
    () => dailyTokenBds([1, 2, 3, 4, 5, 6], 2, -0.5),
    /epsSigma must be a positive finite number/,
  );
});

test('dailyTokenBds: rejects embeddingDim too large for n', () => {
  assert.throws(
    () => dailyTokenBds([1, 2, 3, 4, 5], 5),
    /exceeds n-1/,
  );
});

test('dailyTokenBds: zero variance throws', () => {
  assert.throws(
    () => dailyTokenBds([7, 7, 7, 7, 7, 7, 7, 7]),
    /zero variance/,
  );
});

// ---------- primitive: identities ----------

test('dailyTokenBds: invariant under additive shift x -> x + c', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1, 7, 3, 6, 2];
  const a = dailyTokenBds(x);
  const b = dailyTokenBds(x.map((v) => v + 1000));
  assert.ok(Math.abs(a.bdsV - b.bdsV) < 1e-9, `${a.bdsV} vs ${b.bdsV}`);
  assert.ok(Math.abs(a.cM - b.cM) < 1e-9);
  assert.ok(Math.abs(a.c1 - b.c1) < 1e-9);
});

test('dailyTokenBds: invariant under positive scalar x -> a*x (eps tracks stddev)', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1, 7, 3, 6, 2];
  const a = dailyTokenBds(x);
  const b = dailyTokenBds(x.map((v) => v * 7.3));
  assert.ok(Math.abs(a.bdsV - b.bdsV) < 1e-9, `${a.bdsV} vs ${b.bdsV}`);
  assert.ok(Math.abs(a.c1 - b.c1) < 1e-9);
  assert.ok(Math.abs(a.cM - b.cM) < 1e-9);
});

test('dailyTokenBds: invariant under negation x -> -x', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1, 7, 3, 6, 2];
  const a = dailyTokenBds(x);
  const b = dailyTokenBds(x.map((v) => -v));
  assert.ok(Math.abs(a.bdsV - b.bdsV) < 1e-9);
  assert.ok(Math.abs(a.c1 - b.c1) < 1e-9);
});

test('dailyTokenBds: bdsZ === bdsV (alias)', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1];
  const a = dailyTokenBds(x);
  assert.equal(a.bdsZ, a.bdsV);
});

test('dailyTokenBds: C(1) and C(m) in [0, 1]', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1];
  const a = dailyTokenBds(x);
  assert.ok(a.c1 >= 0 && a.c1 <= 1, `c1=${a.c1}`);
  assert.ok(a.cM >= 0 && a.cM <= 1, `cM=${a.cM}`);
  assert.ok(a.bdsK >= 0 && a.bdsK <= 1, `K=${a.bdsK}`);
});

test('dailyTokenBds: bdsM equals embeddingDim and bdsEps = epsSigma * stddev', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5];
  const a = dailyTokenBds(x, 3, 1.0);
  assert.equal(a.bdsM, 3);
  assert.ok(
    Math.abs(a.bdsEps - 1.0 * a.stddev) < 1e-12,
    `${a.bdsEps} vs ${a.stddev}`,
  );
});

// ---------- primitive: closed-form anchors ----------

test('dailyTokenBds: deterministic period-2 pattern produces bdsV >> 0', () => {
  // Strict period-2 series: m=2 history pairs match deterministically
  // when stepping by 2 -> excess m-history coincidences -> bdsV >> 0.
  const x: number[] = [];
  for (let i = 0; i < 60; i += 1) x.push(i % 2 === 0 ? 0 : 100);
  const a = dailyTokenBds(x, 2, 0.5);
  // Period-2 in level means [0, 100] repeats; 2-history embedding has
  // exactly 2 distinct vectors -> C(2) is much larger than C(1)^2.
  assert.ok(
    a.cM > a.c1 * a.c1 + 0.05,
    `expected cM=${a.cM} >> c1^2=${a.c1 * a.c1}`,
  );
  assert.ok(a.bdsV > 3, `expected bdsV >> 0, got ${a.bdsV}`);
});

test('dailyTokenBds: low-amplitude white noise around constant gives small |bdsV|', () => {
  // Deterministic pseudo-i.i.d. sequence sampled from a fixed-seed LCG
  // to keep the test reproducible. Under the i.i.d. null bdsV ~ N(0, 1),
  // so a |bdsV| < 4 bound is generously satisfied.
  let seed = 12345;
  const next = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const x: number[] = [];
  for (let i = 0; i < 200; i += 1) x.push(next());
  const a = dailyTokenBds(x, 2, 0.7);
  assert.ok(Math.abs(a.bdsV) < 4, `expected |bdsV| < 4, got ${a.bdsV}`);
});

test('dailyTokenBds: sigma is non-negative', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 6, 7, 11, 2, 5, 13, 4, 8, 1, 7, 3, 6, 2];
  const a = dailyTokenBds(x);
  assert.ok(a.bdsSigma >= 0);
});

test('dailyTokenBds: m=3 also produces finite bdsV on a clean sequence', () => {
  const x: number[] = [];
  for (let i = 0; i < 40; i += 1) x.push(((i * 7) % 11) + 1);
  const a = dailyTokenBds(x, 3, 0.7);
  assert.ok(Number.isFinite(a.bdsV));
  assert.ok(a.bdsM === 3);
});

// ---------- builder ----------

test('buildDailyTokenBds: empty queue', () => {
  const r = buildDailyTokenBds([], { generatedAt: '2026-05-04T00:00:00Z' });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.embeddingDim, 2);
  assert.equal(r.epsSigma, 0.7);
});

test('buildDailyTokenBds: invalid hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's1', 100),
    ql('still-not', 's1', 100),
  ];
  const r = buildDailyTokenBds(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.droppedInvalidHourStart, 2);
});

test('buildDailyTokenBds: source filter respected', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 's1', 1000 + i * 50));
    queue.push(ql(dayIso(i), 's2', 800 + i * 30));
  }
  const r = buildDailyTokenBds(queue, {
    source: 's1',
    generatedAt: '2026-05-04T00:00:00Z',
  });
  for (const row of r.sources) assert.equal(row.source, 's1');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenBds: below min-tenure-days dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'sShort', 5000));
  }
  const r = buildDailyTokenBds(queue, {
    minTenureDays: 14,
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenBds: zero variance series filtered', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'sFlat', 1000));
  }
  const r = buildDailyTokenBds(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenBds: deterministic period-2 source produces large bdsZ', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    const tok = i % 2 === 0 ? 100 : 5000;
    queue.push(ql(dayIso(i), 'sCycle', tok));
  }
  const r = buildDailyTokenBds(queue, {
    epsSigma: 0.5,
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(
    Math.abs(row.bdsZ) > 3,
    `expected |bdsZ| > 3 for period-2 source, got ${row.bdsZ}`,
  );
});

test('buildDailyTokenBds: sort bdsZAbsDesc orders by absolute z desc', () => {
  const queue: QueueLine[] = [];
  // Two sources with different signal regimes to get varied z scores.
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'sCycle', i % 2 === 0 ? 100 : 5000));
    queue.push(ql(dayIso(i), 'sLinear', 1000 + i * 100));
    queue.push(ql(dayIso(i), 'sFlat2', 1000 + (i % 3) * 10));
  }
  const r = buildDailyTokenBds(queue, {
    sort: 'bdsZAbsDesc',
    generatedAt: '2026-05-04T00:00:00Z',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      Math.abs(r.sources[i - 1]!.bdsZ) >= Math.abs(r.sources[i]!.bdsZ),
      `unsorted at ${i}: ${r.sources[i - 1]!.bdsZ} vs ${r.sources[i]!.bdsZ}`,
    );
  }
});

test('buildDailyTokenBds: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), `s${s}`, 1000 + (i + s) * 50));
    }
  }
  const r = buildDailyTokenBds(queue, {
    top: 2,
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenBds: deterministic with fixed generatedAt', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    queue.push(ql(dayIso(i), 'sA', 1000 + ((i * 13) % 200)));
  }
  const a = buildDailyTokenBds(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
  });
  const b = buildDailyTokenBds(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.deepEqual(a, b);
});
