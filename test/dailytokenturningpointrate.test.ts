import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenTurningPointRate,
  buildDailyTokenTurningPointRate,
} from '../src/dailytokenturningpointrate.js';
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

// ---------- dailyTokenTurningPointRate primitive ----------

test('dailyTokenTurningPointRate: rejects fewer than 3 samples', () => {
  assert.throws(
    () => dailyTokenTurningPointRate([5, 6]),
    /at least 3 samples/,
  );
});

test('dailyTokenTurningPointRate: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenTurningPointRate([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenTurningPointRate([1, Infinity, 3]),
    /finite values/,
  );
});

test('dailyTokenTurningPointRate: monotone increasing has T=0, tpr=0', () => {
  const r = dailyTokenTurningPointRate([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.nTurningPoints, 0);
  assert.equal(r.tpr, 0);
  assert.equal(r.nPlateauTriples, 0);
  assert.equal(r.nInteriorTriples, 6);
});

test('dailyTokenTurningPointRate: monotone decreasing has T=0, tpr=0', () => {
  const r = dailyTokenTurningPointRate([10, 9, 8, 7, 6, 5]);
  assert.equal(r.nTurningPoints, 0);
  assert.equal(r.tpr, 0);
  assert.equal(r.nPlateauTriples, 0);
});

test('dailyTokenTurningPointRate: strict alternation (1,2,1,2,...) saturates tpr=1', () => {
  // n=10: x = 1,2,1,2,1,2,1,2,1,2 -> every interior i in [1..8]
  // is a strict extremum (peak or trough). T = 8 = n-2. tpr = 1.
  const x = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  const r = dailyTokenTurningPointRate(x);
  assert.equal(r.nInteriorTriples, 8);
  assert.equal(r.nTurningPoints, 8);
  assert.equal(r.tpr, 1);
  assert.equal(r.nPlateauTriples, 0);
});

test('dailyTokenTurningPointRate: alternation (a,b,a,b,...) for various scales', () => {
  for (const [a, b] of [
    [0, 1],
    [3, 7],
    [-2, 5],
    [100, 101],
  ] as Array<[number, number]>) {
    const x = [a, b, a, b, a, b, a, b];
    const r = dailyTokenTurningPointRate(x);
    assert.equal(r.tpr, 1, `a=${a} b=${b}`);
    assert.equal(r.nTurningPoints, 6);
  }
});

test('dailyTokenTurningPointRate: single peak in middle', () => {
  // 1,2,3,4,3,2,1 -> T=1 at index 3 (value 4). n=7, n-2=5.
  const r = dailyTokenTurningPointRate([1, 2, 3, 4, 3, 2, 1]);
  assert.equal(r.nTurningPoints, 1);
  assert.equal(r.nInteriorTriples, 5);
  assert.equal(r.tpr, 1 / 5);
});

test('dailyTokenTurningPointRate: single trough in middle', () => {
  const r = dailyTokenTurningPointRate([5, 4, 3, 2, 3, 4, 5]);
  assert.equal(r.nTurningPoints, 1);
  assert.equal(r.tpr, 1 / 5);
});

test('dailyTokenTurningPointRate: constant series -> all plateaux, T=0', () => {
  const r = dailyTokenTurningPointRate([7, 7, 7, 7, 7, 7]);
  assert.equal(r.nTurningPoints, 0);
  assert.equal(r.tpr, 0);
  assert.equal(r.nPlateauTriples, 4);
});

test('dailyTokenTurningPointRate: plateau triples are excluded from extremum count', () => {
  // 1, 2, 2, 1 -> interior triples (1,2,2) and (2,2,1). Both
  // have an internal equality, so both are plateaux -> T=0.
  const r = dailyTokenTurningPointRate([1, 2, 2, 1]);
  assert.equal(r.nTurningPoints, 0);
  assert.equal(r.nPlateauTriples, 2);
  assert.equal(r.nInteriorTriples, 2);
});

test('dailyTokenTurningPointRate: mean and stddev are correct', () => {
  const x = [1, 2, 3, 4, 5];
  const r = dailyTokenTurningPointRate(x);
  assert.equal(r.mean, 3);
  // Population stddev: sqrt(((4+1+0+1+4)/5)) = sqrt(2)
  assert.ok(Math.abs(r.stddev - Math.sqrt(2)) < 1e-12);
});

test('dailyTokenTurningPointRate: tprExpectedIid is 2/3', () => {
  const r = dailyTokenTurningPointRate([1, 3, 2, 4, 3, 5]);
  assert.ok(Math.abs(r.tprExpectedIid - 2 / 3) < 1e-12);
});

test('dailyTokenTurningPointRate: tprZ matches Kendall closed form', () => {
  // n = 8, alternating x = (1,2,1,2,1,2,1,2): T = 6,
  // E[T] = 2*(8-2)/3 = 4, Var[T] = (16*8 - 29)/90 = 99/90 = 1.1
  // tprZ = (6 - 4) / sqrt(1.1)
  const r = dailyTokenTurningPointRate([1, 2, 1, 2, 1, 2, 1, 2]);
  const expected = (6 - 4) / Math.sqrt(99 / 90);
  assert.ok(
    Math.abs(r.tprZ - expected) < 1e-12,
    `tprZ ${r.tprZ} vs ${expected}`,
  );
});

test('dailyTokenTurningPointRate: tprZ for monotone is strongly negative', () => {
  // n = 10 monotone: T=0, E[T] = 16/3, var = 131/90
  const r = dailyTokenTurningPointRate([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const expected = (0 - 16 / 3) / Math.sqrt(131 / 90);
  assert.ok(Math.abs(r.tprZ - expected) < 1e-12);
  assert.ok(r.tprZ < -3, `expected strongly negative, got ${r.tprZ}`);
});

test('dailyTokenTurningPointRate: scale invariance of T', () => {
  // T depends only on the sign pattern of diff(x), so
  // multiplying by a positive scalar leaves T unchanged.
  const x = [1, 4, 2, 9, 5, 7, 3, 8];
  const a = dailyTokenTurningPointRate(x);
  const b = dailyTokenTurningPointRate(x.map((v) => v * 13));
  assert.equal(a.nTurningPoints, b.nTurningPoints);
  assert.equal(a.tpr, b.tpr);
});

test('dailyTokenTurningPointRate: shift invariance of T', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 8];
  const a = dailyTokenTurningPointRate(x);
  const b = dailyTokenTurningPointRate(x.map((v) => v + 1000));
  assert.equal(a.nTurningPoints, b.nTurningPoints);
  assert.equal(a.tpr, b.tpr);
});

test('dailyTokenTurningPointRate: ZCR-orthogonality counter-example', () => {
  // Monotone increasing series with mean ~ centre: ZCR
  // should be ~ 1/(n-1) (one mean crossing) but TPR = 0.
  // Confirm TPR = 0 here.
  const r = dailyTokenTurningPointRate([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.tpr, 0);
});

// ---------- buildDailyTokenTurningPointRate end-to-end ----------

test('buildDailyTokenTurningPointRate: rejects bad minTokens', () => {
  assert.throws(
    () =>
      buildDailyTokenTurningPointRate([], { minTokens: -1 }),
    /minTokens/,
  );
});

test('buildDailyTokenTurningPointRate: rejects bad minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenTurningPointRate([], { minTenureDays: 3 }),
    /minTenureDays/,
  );
});

test('buildDailyTokenTurningPointRate: rejects bad top', () => {
  assert.throws(
    () =>
      buildDailyTokenTurningPointRate([], { top: -1 }),
    /top/,
  );
});

test('buildDailyTokenTurningPointRate: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenTurningPointRate([], {
        sort: 'bogus' as 'tpr',
      }),
    /sort/,
  );
});

test('buildDailyTokenTurningPointRate: drops zero-variance source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 1000));
  }
  const r = buildDailyTokenTurningPointRate(queue, {
    minTokens: 0,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenTurningPointRate: drops below-min-tenure source', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 's1', 5000),
    ql(dayIso(1), 's1', 5000),
    ql(dayIso(2), 's1', 5000),
  ];
  const r = buildDailyTokenTurningPointRate(queue, {
    minTokens: 0,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenTurningPointRate: alternating source has tpr ~ 1', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'alt', i % 2 === 0 ? 1000 : 5000));
  }
  const r = buildDailyTokenTurningPointRate(queue, {
    minTokens: 0,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.tpr, 1);
  assert.equal(row.nTurningPoints, row.nInteriorTriples);
  assert.ok(row.tprZ > 0);
});

test('buildDailyTokenTurningPointRate: monotone source has tpr=0 and tprZ<<0', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'mono', 1000 + i * 100));
  }
  const r = buildDailyTokenTurningPointRate(queue, {
    minTokens: 0,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.tpr, 0);
  assert.ok(row.tprZ < -3);
});

test('buildDailyTokenTurningPointRate: gap-filled tenure inflates plateau count', () => {
  // Two-day-active source with gap should be gap-filled to
  // a longer tenure with zeros bridging -> the bridging
  // zeros sit between non-zero values and create plateau
  // triples where adjacent zeros are equal.
  const queue: QueueLine[] = [];
  // Active days 0, 5, 10, 15 with positive tokens; gap-fill
  // intervening days with 0.
  for (const i of [0, 5, 10, 15]) {
    queue.push(ql(dayIso(i), 'sparse', 5000));
  }
  const r = buildDailyTokenTurningPointRate(queue, {
    minTokens: 0,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  // tenure = 16, interior triples = 14. The active spikes
  // at indices 0,5,10,15 each create a peak at exactly one
  // interior index (5 and 10). Index 0 and 15 are not
  // interior so contribute nothing. -> T = 2.
  assert.equal(row.nTenureDays, 16);
  assert.equal(row.nInteriorTriples, 14);
  assert.equal(row.nTurningPoints, 2);
  assert.ok(row.nPlateauTriples > 0);
});

test('buildDailyTokenTurningPointRate: source filter restricts and counts dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'a', 1000 + i));
    queue.push(ql(dayIso(i), 'b', 2000 + i));
  }
  const r = buildDailyTokenTurningPointRate(queue, {
    minTokens: 0,
    minTenureDays: 14,
    source: 'a',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 16);
});

test('buildDailyTokenTurningPointRate: sort tprDesc orders correctly', () => {
  const queue: QueueLine[] = [];
  // Source "alt" -> tpr=1, source "mono" -> tpr=0
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'alt', i % 2 === 0 ? 1000 : 5000));
    queue.push(ql(dayIso(i), 'mono', 1000 + i * 100));
  }
  const r = buildDailyTokenTurningPointRate(queue, {
    minTokens: 0,
    minTenureDays: 14,
    sort: 'tprDesc',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'alt');
  assert.equal(r.sources[1]!.source, 'mono');
});

test('buildDailyTokenTurningPointRate: top cap reports droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 16; i += 1) {
      queue.push(ql(dayIso(i), src, 1000 + i + (src.charCodeAt(0) - 97) * 100));
    }
  }
  const r = buildDailyTokenTurningPointRate(queue, {
    minTokens: 0,
    minTenureDays: 14,
    top: 2,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenTurningPointRate: invalid hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's1', 1000),
    ql(dayIso(0), 's1', 1000),
  ];
  for (let i = 1; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 's1', 1000 + i * 7));
  }
  const r = buildDailyTokenTurningPointRate(queue, {
    minTokens: 0,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenTurningPointRate: non-positive tokens dropped', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 's1', -5),
    ql(dayIso(1), 's1', 0),
  ];
  for (let i = 2; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 's1', 1000));
  }
  const r = buildDailyTokenTurningPointRate(queue, {
    minTokens: 0,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenTurningPointRate: deterministic across runs (same input)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 's1', 1000 + ((i * 17) % 13) * 100));
  }
  const a = buildDailyTokenTurningPointRate(queue, {
    minTokens: 0,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  const b = buildDailyTokenTurningPointRate(queue, {
    minTokens: 0,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.deepEqual(a, b);
});
