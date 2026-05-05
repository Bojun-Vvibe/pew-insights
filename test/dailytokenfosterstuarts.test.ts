import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenFosterStuartS,
  buildDailyTokenFosterStuartS,
} from '../src/dailytokenfosterstuarts.js';
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

// ---------- core: dailyTokenFosterStuartS ----------

test('dailyTokenFosterStuartS: rejects too few samples', () => {
  assert.throws(
    () => dailyTokenFosterStuartS([1, 2]),
    /at least 3 samples/,
  );
});

test('dailyTokenFosterStuartS: rejects non-finite', () => {
  assert.throws(
    () => dailyTokenFosterStuartS([1, 2, NaN, 4, 5, 6]),
    /finite/,
  );
});

test('dailyTokenFosterStuartS: monotone increasing -> U=n-1, L=0', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = dailyTokenFosterStuartS(x);
  assert.equal(r.nUpperRecordsFs, 9);
  assert.equal(r.nLowerRecordsFs, 0);
  assert.equal(r.fsS, 9);
  assert.equal(r.fsD, 9);
});

test('dailyTokenFosterStuartS: monotone decreasing -> U=0, L=n-1', () => {
  const x = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const r = dailyTokenFosterStuartS(x);
  assert.equal(r.nUpperRecordsFs, 0);
  assert.equal(r.nLowerRecordsFs, 9);
  assert.equal(r.fsS, 9);
  assert.equal(r.fsD, -9);
});

test('dailyTokenFosterStuartS: constant series -> S=0, D=0', () => {
  // All equal -> no STRICT records possible.
  const x = [5, 5, 5, 5, 5, 5, 5, 5];
  // But variance is zero so the surrounding builder filters
  // it; the bare primitive should still compute.
  const r = dailyTokenFosterStuartS(x);
  assert.equal(r.fsS, 0);
  assert.equal(r.fsD, 0);
  assert.equal(r.nUpperRecordsFs, 0);
  assert.equal(r.nLowerRecordsFs, 0);
});

test('dailyTokenFosterStuartS: loose counts include ties', () => {
  // [5, 5, 5, ...] -> strict = 0 / 0; loose = n-1 / n-1.
  const x = [5, 5, 5, 5, 5, 5, 5, 5];
  const r = dailyTokenFosterStuartS(x);
  assert.equal(r.nUpperRecordsLooseFs, 7);
  assert.equal(r.nLowerRecordsLooseFs, 7);
});

test('dailyTokenFosterStuartS: alternating extremes -> large S', () => {
  // (1, 10, 2, 9, 3, 8, 4, 7) -> U at indices 1 (10), L at
  // indices 2 (2), 4 (3 not less than 1!) wait let me think
  // again. Lows after start: prefixMin starts at 1.
  // i=1: 10 > 1 -> U; min still 1.
  // i=2: 2 vs max=10 (no), vs min=1 (no, equal to greater) -> neither.
  // i=3: 9 < 10 (no U), 9 > 1 (no L).
  // i=4: 3, no.
  // i=5: 8, no.
  // i=6: 4, no.
  // i=7: 7, no.
  // So U=1, L=0, S=1. Not the alternating-extreme pattern.
  // Build a proper one: (10, 1, 11, 0, 12, -1, 13, -2)
  const x = [10, 1, 11, 0, 12, -1, 13, -2];
  const r = dailyTokenFosterStuartS(x);
  // i=1: 1 < 10 -> L. min=1.
  // i=2: 11 > 10 -> U. max=11.
  // i=3: 0 < 1 -> L. min=0.
  // i=4: 12 > 11 -> U. max=12.
  // i=5: -1 < 0 -> L. min=-1.
  // i=6: 13 > 12 -> U. max=13.
  // i=7: -2 < -1 -> L. min=-2.
  assert.equal(r.nUpperRecordsFs, 3);
  assert.equal(r.nLowerRecordsFs, 4);
  assert.equal(r.fsS, 7);
  assert.equal(r.fsD, -1);
});

test('dailyTokenFosterStuartS: harmonic null moments are H_n - 1 and H_n - H_n^(2)', () => {
  // For n=10: H_10 = 2.928968253968254, H_10^(2) = 1.5497677311665408.
  // mu1 = H_10 - 1 = 1.9289682539682538.
  // mu2 = H_10 - H_10^(2) = 1.379200522801713.
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = dailyTokenFosterStuartS(x);
  assert.ok(Math.abs(r.fsExpectedU - 1.92896825) < 1e-6);
  assert.ok(Math.abs(r.fsVarU - 1.37920052) < 1e-6);
  assert.ok(Math.abs(r.fsExpectedS - 2 * 1.92896825) < 1e-6);
  assert.ok(Math.abs(r.fsVarS - 2 * 1.37920052) < 1e-6);
});

test('dailyTokenFosterStuartS: fsSZ for monotone increasing is positive on the upper side', () => {
  const x = Array.from({ length: 30 }, (_, i) => i + 1);
  const r = dailyTokenFosterStuartS(x);
  // S = 29, E[S] ~ 2*(H_30 - 1) ~ 2*2.99 = 5.98; very large
  // positive deviation but D = +29 dominates as well.
  assert.ok(r.fsSZ > 5);
  assert.ok(r.fsDZ > 5);
});

test('dailyTokenFosterStuartS: fsDZ sign convention -- upward trend gives positive fsDZ', () => {
  const x = Array.from({ length: 30 }, (_, i) => i * 10);
  const r = dailyTokenFosterStuartS(x);
  assert.ok(r.fsDZ > 0);
});

test('dailyTokenFosterStuartS: fsDZ sign convention -- downward trend gives negative fsDZ', () => {
  const x = Array.from({ length: 30 }, (_, i) => 1000 - i * 10);
  const r = dailyTokenFosterStuartS(x);
  assert.ok(r.fsDZ < 0);
});

test('dailyTokenFosterStuartS: shift invariance of fsSZ', () => {
  const base = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7];
  const shifted = base.map((v) => v + 1000);
  const a = dailyTokenFosterStuartS(base);
  const b = dailyTokenFosterStuartS(shifted);
  assert.equal(a.fsSZ, b.fsSZ);
  assert.equal(a.fsDZ, b.fsDZ);
});

test('dailyTokenFosterStuartS: positive scale invariance of fsSZ', () => {
  const base = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7];
  const scaled = base.map((v) => v * 10.5);
  const a = dailyTokenFosterStuartS(base);
  const b = dailyTokenFosterStuartS(scaled);
  assert.equal(a.fsSZ, b.fsSZ);
  assert.equal(a.fsD, b.fsD);
});

test('dailyTokenFosterStuartS: short series (n<6) reports z=0', () => {
  const x = [1, 5, 2, 4, 3];
  const r = dailyTokenFosterStuartS(x);
  assert.equal(r.fsSZ, 0);
  assert.equal(r.fsDZ, 0);
});

test('dailyTokenFosterStuartS: returned counts match independent passes', () => {
  const x = [5, 8, 3, 9, 1, 10, 2, 11, 0, 12];
  const r = dailyTokenFosterStuartS(x);
  // Manual: max-pass starts 5; i=1 (8>5)->U; i=2 (3)->no; i=3 (9>8)->U;
  // i=4 (1)->no; i=5 (10>9)->U; i=6 (2)->no; i=7 (11>10)->U;
  // i=8 (0)->no; i=9 (12>11)->U. U=5.
  // min-pass starts 5; i=1 (8)->no; i=2 (3<5)->L; i=3 (9)->no; i=4 (1<3)->L;
  // i=5 (10)->no; i=6 (2)->no; i=7 (11)->no; i=8 (0<1)->L; i=9 (12)->no. L=3.
  assert.equal(r.nUpperRecordsFs, 5);
  assert.equal(r.nLowerRecordsFs, 3);
  assert.equal(r.fsS, 8);
  assert.equal(r.fsD, 2);
});

// ---------- builder: buildDailyTokenFosterStuartS ----------

test('buildDailyTokenFosterStuartS: empty queue -> empty report', () => {
  const r = buildDailyTokenFosterStuartS([], { generatedAt: 'GEN' });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.generatedAt, 'GEN');
});

test('buildDailyTokenFosterStuartS: rejects bad min-tokens', () => {
  assert.throws(
    () =>
      buildDailyTokenFosterStuartS([], {
        generatedAt: 'GEN',
        minTokens: -1,
      }),
    /minTokens/,
  );
});

test('buildDailyTokenFosterStuartS: rejects min-tenure-days < 6', () => {
  assert.throws(
    () =>
      buildDailyTokenFosterStuartS([], {
        generatedAt: 'GEN',
        minTenureDays: 4,
      }),
    /minTenureDays/,
  );
});

test('buildDailyTokenFosterStuartS: rejects negative top', () => {
  assert.throws(
    () =>
      buildDailyTokenFosterStuartS([], { generatedAt: 'GEN', top: -1 }),
    /top/,
  );
});

test('buildDailyTokenFosterStuartS: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenFosterStuartS([], {
        generatedAt: 'GEN',
        sort: 'bogus' as never,
      }),
    /sort/,
  );
});

test('buildDailyTokenFosterStuartS: rejects bad since/until', () => {
  assert.throws(
    () =>
      buildDailyTokenFosterStuartS([], {
        generatedAt: 'GEN',
        since: 'not-a-date',
      }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenFosterStuartS([], {
        generatedAt: 'GEN',
        until: 'not-a-date',
      }),
    /invalid until/,
  );
});

test('buildDailyTokenFosterStuartS: filters below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'a', 50));
  }
  const r = buildDailyTokenFosterStuartS(queue, {
    generatedAt: 'GEN',
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenFosterStuartS: filters below min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'a', 5000));
  }
  const r = buildDailyTokenFosterStuartS(queue, {
    generatedAt: 'GEN',
    minTokens: 100,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenFosterStuartS: filters zero-variance', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'a', 200));
  }
  const r = buildDailyTokenFosterStuartS(queue, {
    generatedAt: 'GEN',
    minTokens: 100,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenFosterStuartS: invalid hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 1000),
    ql(dayIso(0), 'a', 1000),
  ];
  const r = buildDailyTokenFosterStuartS(queue, { generatedAt: 'GEN' });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenFosterStuartS: non-positive tokens dropped', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'a', 0),
    ql(dayIso(1), 'a', -100),
    ql(dayIso(2), 'a', 1000),
  ];
  const r = buildDailyTokenFosterStuartS(queue, { generatedAt: 'GEN' });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenFosterStuartS: source filter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'a', 1000 + i));
    queue.push(ql(dayIso(i), 'b', 500));
  }
  const r = buildDailyTokenFosterStuartS(queue, {
    generatedAt: 'GEN',
    source: 'a',
  });
  assert.equal(r.droppedSourceFilter, 20);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('buildDailyTokenFosterStuartS: top cap', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c', 'd']) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), src, 1000 + (src.charCodeAt(0) + i) * 7));
    }
  }
  const r = buildDailyTokenFosterStuartS(queue, {
    generatedAt: 'GEN',
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenFosterStuartS: source-asc tie break', () => {
  const queue: QueueLine[] = [];
  for (const src of ['z', 'a', 'm']) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), src, 1000 + i));
    }
  }
  const r = buildDailyTokenFosterStuartS(queue, {
    generatedAt: 'GEN',
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'm', 'z'],
  );
});

test('buildDailyTokenFosterStuartS: deterministic generatedAt passthrough', () => {
  const r = buildDailyTokenFosterStuartS([], {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2026-05-05T00:00:00.000Z');
});

test('buildDailyTokenFosterStuartS: gap-filled tenure includes empty days', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'a', 5000),
    ql(dayIso(15), 'a', 5000),
  ];
  // Tenure = 16 days, 14 of which are gap-filled zeros.
  const r = buildDailyTokenFosterStuartS(queue, {
    generatedAt: 'GEN',
    minTokens: 100,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 16);
  assert.equal(r.sources[0]!.nActiveDays, 2);
});

test('buildDailyTokenFosterStuartS: window since/until restriction', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'a', 1000 + i * 7));
  }
  const r = buildDailyTokenFosterStuartS(queue, {
    generatedAt: 'GEN',
    since: dayIso(5),
    until: dayIso(20),
    minTokens: 100,
  });
  assert.equal(r.windowStart, dayIso(5));
  assert.equal(r.windowEnd, dayIso(20));
  assert.equal(r.sources.length, 1);
  // Days 5..19 = 15 days of tenure (since/until is half-open)
  assert.equal(r.sources[0]!.nTenureDays, 15);
});

test('buildDailyTokenFosterStuartS: sort by fsSZAbsDesc puts large |z| first', () => {
  const queue: QueueLine[] = [];
  // src "trend" -- monotone trend, big |fsSZ|.
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'trend', 1000 + i * 100));
  }
  // src "noise" -- noisier random pattern, smaller |fsSZ|.
  const noise = [
    7, 4, 9, 2, 5, 8, 3, 6, 7, 4, 5, 8, 6, 9, 3, 5, 7, 4, 6, 8, 3, 9, 5, 7,
    4, 6, 8, 5, 7, 9,
  ];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'noise', 1000 + noise[i]! * 50));
  }
  const r = buildDailyTokenFosterStuartS(queue, {
    generatedAt: 'GEN',
    sort: 'fsSZAbsDesc',
    minTokens: 100,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(
    Math.abs(r.sources[0]!.fsSZ) >= Math.abs(r.sources[1]!.fsSZ),
    `expected |fsSZ| descending, got ${r.sources.map((s) => `${s.source}:${s.fsSZ.toFixed(3)}`).join(', ')}`,
  );
});

test('buildDailyTokenFosterStuartS: row carries through all fields', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    queue.push(ql(dayIso(i), 'src', 1000 + i * 50));
  }
  const r = buildDailyTokenFosterStuartS(queue, {
    generatedAt: 'GEN',
    minTokens: 100,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(typeof row.fsS, 'number');
  assert.equal(typeof row.fsD, 'number');
  assert.equal(typeof row.fsSZ, 'number');
  assert.equal(typeof row.fsDZ, 'number');
  assert.equal(typeof row.fsExpectedU, 'number');
  assert.equal(typeof row.fsVarU, 'number');
  assert.equal(typeof row.fsExpectedS, 'number');
  assert.equal(typeof row.fsVarS, 'number');
  assert.equal(typeof row.nUpperRecordsFs, 'number');
  assert.equal(typeof row.nLowerRecordsFs, 'number');
  assert.equal(typeof row.nUpperRecordsLooseFs, 'number');
  assert.equal(typeof row.nLowerRecordsLooseFs, 'number');
});

test('buildDailyTokenFosterStuartS: monotone series gives U=tenure-1, L=0', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    queue.push(ql(dayIso(i), 'mono', 1000 + i * 50));
  }
  const r = buildDailyTokenFosterStuartS(queue, {
    generatedAt: 'GEN',
    minTokens: 100,
  });
  const row = r.sources[0]!;
  assert.equal(row.nUpperRecordsFs, 13);
  assert.equal(row.nLowerRecordsFs, 0);
  assert.equal(row.fsS, 13);
  assert.equal(row.fsD, 13);
});
