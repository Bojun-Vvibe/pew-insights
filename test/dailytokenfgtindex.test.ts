import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenFgtIndex,
  fgtOfVector,
} from '../src/dailytokenfgtindex.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-01T00:00:00.000Z';

// ---- fgtOfVector primitive ---------------------------------------------

test('fgtOfVector: empty -> all zero', () => {
  const r = fgtOfVector([], 10);
  assert.equal(r.fgt, 0);
  assert.equal(r.headcount, 0);
  assert.equal(r.povertyGap, 0);
  assert.equal(r.severity, 0);
  assert.equal(r.nPoor, 0);
  assert.equal(r.meanShortfall, 0);
});

test('fgtOfVector: z = 0 -> all zero', () => {
  const r = fgtOfVector([1, 2, 3], 0);
  assert.equal(r.fgt, 0);
  assert.equal(r.nPoor, 0);
});

test('fgtOfVector: all above line -> 0', () => {
  const r = fgtOfVector([10, 20, 30, 40], 5);
  assert.equal(r.fgt, 0);
  assert.equal(r.headcount, 0);
  assert.equal(r.nPoor, 0);
});

test('fgtOfVector: all below line at alpha=0 -> 1.0 headcount', () => {
  const r = fgtOfVector([1, 2, 3], 100, 0);
  assert.equal(r.fgt, 1);
  assert.equal(r.headcount, 1);
  assert.equal(r.nPoor, 3);
});

test('fgtOfVector: at-line is NOT poor (strict <)', () => {
  // 4 days, line = 10. days at 10 are not poor.
  const r = fgtOfVector([10, 10, 10, 10], 10, 0);
  assert.equal(r.headcount, 0);
  assert.equal(r.nPoor, 0);
});

test('fgtOfVector: alpha=0 = headcount', () => {
  // 5 days, line=10. 2 below.
  const r = fgtOfVector([1, 5, 11, 20, 30], 10, 0);
  assert.equal(r.headcount, 2 / 5);
  assert.equal(r.fgt, 2 / 5);
});

test('fgtOfVector: alpha=1 = poverty gap', () => {
  // line=10. day1=1 -> gap=0.9; day2=5 -> gap=0.5. Sum=1.4. /5 = 0.28
  const r = fgtOfVector([1, 5, 11, 20, 30], 10, 1);
  assert.ok(Math.abs(r.fgt - 0.28) < 1e-12);
  assert.ok(Math.abs(r.povertyGap - 0.28) < 1e-12);
});

test('fgtOfVector: alpha=2 = severity', () => {
  // gaps 0.9 and 0.5. squared 0.81 + 0.25 = 1.06. / 5 = 0.212
  const r = fgtOfVector([1, 5, 11, 20, 30], 10, 2);
  assert.ok(Math.abs(r.fgt - 0.212) < 1e-12);
  assert.ok(Math.abs(r.severity - 0.212) < 1e-12);
});

test('fgtOfVector: monotonic in alpha for 0 < gap < 1', () => {
  const v = [1, 2, 3, 11, 12, 13];
  const r0 = fgtOfVector(v, 10, 0).fgt;
  const r1 = fgtOfVector(v, 10, 1).fgt;
  const r2 = fgtOfVector(v, 10, 2).fgt;
  // For gaps in (0,1), higher alpha -> lower (gap)^alpha -> lower fgt.
  assert.ok(r0 >= r1);
  assert.ok(r1 >= r2);
});

test('fgtOfVector: severity transfer-sensitive (Pigou-Dalton)', () => {
  // Two poor days; same total shortfall but redistributed to be more
  // unequal -> higher severity.
  // Case A: two days at 4,4 with line=10 -> gaps 0.6, 0.6 ->
  // severity = (0.36+0.36)/2 = 0.36
  // Case B: two days at 2,6 with line=10 -> gaps 0.8, 0.4 ->
  // severity = (0.64+0.16)/2 = 0.40
  const a = fgtOfVector([4, 4], 10, 2).fgt;
  const b = fgtOfVector([2, 6], 10, 2).fgt;
  assert.ok(b > a);
  // Both should have identical poverty-gap (alpha=1) and headcount.
  const aPg = fgtOfVector([4, 4], 10, 1).fgt;
  const bPg = fgtOfVector([2, 6], 10, 1).fgt;
  assert.ok(Math.abs(aPg - bPg) < 1e-12);
});

test('fgtOfVector: meanShortfall in tokens', () => {
  // line=100, days [40, 60, 200]. Shortfalls 60 and 40. Mean=50.
  const r = fgtOfVector([40, 60, 200], 100);
  assert.equal(r.nPoor, 2);
  assert.equal(r.meanShortfall, 50);
});

test('fgtOfVector: throws on negative value', () => {
  assert.throws(() => fgtOfVector([1, -2, 3], 10));
});

test('fgtOfVector: throws on NaN value', () => {
  assert.throws(() => fgtOfVector([1, Number.NaN], 10));
});

test('fgtOfVector: throws on negative alpha', () => {
  assert.throws(() => fgtOfVector([1, 2], 10, -1));
});

test('fgtOfVector: throws on negative z', () => {
  assert.throws(() => fgtOfVector([1, 2], -1));
});

test('fgtOfVector: non-integer alpha works', () => {
  // gap 0.5; 0.5^1.5 ~= 0.35355
  const r = fgtOfVector([5], 10, 1.5);
  assert.ok(Math.abs(r.fgt - Math.pow(0.5, 1.5)) < 1e-12);
});

// ---- builder ------------------------------------------------------------

test('buildDailyTokenFgtIndex: empty queue', () => {
  const r = buildDailyTokenFgtIndex([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.alpha, 2);
  assert.equal(r.lineFraction, 0.5);
});

test('buildDailyTokenFgtIndex: drops invalid hour_start', () => {
  const q: QueueLine[] = [
    { ...ql('2026-04-01T00:00:00Z', 'a', 100) },
    { ...ql('not-a-date', 'a', 100) },
  ];
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 2,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenFgtIndex: drops non-positive total_tokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 100),
    ql('2026-04-02T00:00:00Z', 'a', 0),
  ];
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 2,
  });
  assert.equal(r.droppedNonPositiveTokens, 1);
});

test('buildDailyTokenFgtIndex: drops below-min-days', () => {
  const q: QueueLine[] = [ql('2026-04-01T00:00:00Z', 'a', 1000)];
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.droppedBelowMinDays, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenFgtIndex: relative line uses per-source mean', () => {
  // 4 days: 100, 200, 300, 400. mean = 250. line @ 0.5 => 125.
  // Days below 125: only day at 100 -> headcount = 1/4.
  // gap = (125-100)/125 = 0.2; severity = 0.04 / 4 = 0.01
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 100),
    ql('2026-04-02T00:00:00Z', 'a', 200),
    ql('2026-04-03T00:00:00Z', 'a', 300),
    ql('2026-04-04T00:00:00Z', 'a', 400),
  ];
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    alpha: 2,
    lineFraction: 0.5,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.povertyLine, 125);
  assert.equal(s.headcount, 0.25);
  assert.ok(Math.abs(s.povertyGap - 0.05) < 1e-12); // 0.2 / 4
  assert.ok(Math.abs(s.fgt - 0.01) < 1e-12);
  assert.ok(Math.abs(s.severity - 0.01) < 1e-12);
  assert.equal(s.nPoor, 1);
  assert.equal(s.meanShortfallTokens, 25);
});

test('buildDailyTokenFgtIndex: absolute line overrides relative', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 100),
    ql('2026-04-02T00:00:00Z', 'a', 200),
    ql('2026-04-03T00:00:00Z', 'a', 300),
  ];
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    alpha: 0,
    absoluteLine: 250,
  });
  const s = r.sources[0]!;
  assert.equal(s.povertyLine, 250);
  // 100 and 200 are below 250.
  assert.equal(s.headcount, 2 / 3);
  assert.equal(s.fgt, 2 / 3);
});

test('buildDailyTokenFgtIndex: window filter via since/until', () => {
  const q: QueueLine[] = [
    ql('2026-03-31T00:00:00Z', 'a', 100), // excluded
    ql('2026-04-01T00:00:00Z', 'a', 100),
    ql('2026-04-02T00:00:00Z', 'a', 200),
    ql('2026-04-03T00:00:00Z', 'a', 300),
    ql('2026-04-04T00:00:00Z', 'a', 400), // excluded
  ];
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    since: '2026-04-01T00:00:00Z',
    until: '2026-04-04T00:00:00Z',
  });
  const s = r.sources[0]!;
  assert.equal(s.nDays, 3);
  assert.equal(s.totalTokens, 600);
});

test('buildDailyTokenFgtIndex: source filter', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 2000),
    ql('2026-04-01T00:00:00Z', 'b', 1000),
    ql('2026-04-02T00:00:00Z', 'b', 2000),
  ];
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 2);
});

test('buildDailyTokenFgtIndex: sort by headcount', () => {
  // a: 4 days [10,10,10,1000] mean=257.5 line=128.75; 3 below -> hc=3/4
  // b: 4 days [10,500,500,500] mean=377.5 line=188.75; 1 below -> hc=1/4
  const q: QueueLine[] = [];
  for (let i = 0; i < 3; i += 1)
    q.push(ql(`2026-04-0${i + 1}T00:00:00Z`, 'a', 10));
  q.push(ql('2026-04-04T00:00:00Z', 'a', 1000));
  q.push(ql('2026-04-01T00:00:00Z', 'b', 10));
  for (let i = 1; i < 4; i += 1)
    q.push(ql(`2026-04-0${i + 1}T00:00:00Z`, 'b', 500));
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    sort: 'headcount',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('buildDailyTokenFgtIndex: top cap', () => {
  const q: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    q.push(ql('2026-04-01T00:00:00Z', `s${s}`, 100));
    q.push(ql('2026-04-02T00:00:00Z', `s${s}`, 200));
  }
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('buildDailyTokenFgtIndex: minHeadcount filter', () => {
  // a: 2 days [1, 1000] mean=500.5 line=250.25; 1 below -> hc=0.5
  // b: 2 days [400, 600] mean=500 line=250; 0 below -> hc=0
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1),
    ql('2026-04-02T00:00:00Z', 'a', 1000),
    ql('2026-04-01T00:00:00Z', 'b', 400),
    ql('2026-04-02T00:00:00Z', 'b', 600),
  ];
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    minHeadcount: 0.25,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinHeadcount, 1);
});

test('buildDailyTokenFgtIndex: invalid alpha throws', () => {
  assert.throws(() => buildDailyTokenFgtIndex([], { alpha: -1 }));
});

test('buildDailyTokenFgtIndex: invalid lineFraction throws', () => {
  assert.throws(() => buildDailyTokenFgtIndex([], { lineFraction: 0 }));
  assert.throws(() => buildDailyTokenFgtIndex([], { lineFraction: -0.5 }));
});

test('buildDailyTokenFgtIndex: invalid absoluteLine throws', () => {
  assert.throws(() => buildDailyTokenFgtIndex([], { absoluteLine: -1 }));
});

test('buildDailyTokenFgtIndex: invalid sort throws', () => {
  assert.throws(() =>
    buildDailyTokenFgtIndex([], { sort: 'bogus' as never }),
  );
});

test('buildDailyTokenFgtIndex: invalid minHeadcount throws', () => {
  assert.throws(() => buildDailyTokenFgtIndex([], { minHeadcount: 1.5 }));
});

test('buildDailyTokenFgtIndex: invalid since throws', () => {
  assert.throws(() => buildDailyTokenFgtIndex([], { since: 'bad' }));
});

test('buildDailyTokenFgtIndex: includeSubgroupDecomposition is exact', () => {
  // Pick 4 weekdays + 4 weekend days with one poor day each.
  // 2026-04-06 Mon, 07 Tue, 08 Wed, 09 Thu (weekday)
  // 2026-04-04 Sat, 05 Sun, 11 Sat, 12 Sun (weekend)
  const q: QueueLine[] = [
    ql('2026-04-06T00:00:00Z', 'a', 10),
    ql('2026-04-07T00:00:00Z', 'a', 1000),
    ql('2026-04-08T00:00:00Z', 'a', 1000),
    ql('2026-04-09T00:00:00Z', 'a', 1000),
    ql('2026-04-04T00:00:00Z', 'a', 5),
    ql('2026-04-05T00:00:00Z', 'a', 1000),
    ql('2026-04-11T00:00:00Z', 'a', 1000),
    ql('2026-04-12T00:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    alpha: 2,
    lineFraction: 0.5,
    includeSubgroupDecomposition: true,
  });
  const s = r.sources[0]!;
  const d = s.subgroupDecomposition!;
  assert.ok(d, 'subgroup decomposition should be present');
  assert.equal(d.nWeekday, 4);
  assert.equal(d.nWeekend, 4);
  assert.equal(d.weekdayShare, 0.5);
  assert.equal(d.weekendShare, 0.5);
  assert.ok(d.decompositionExact);
  assert.ok(Math.abs(d.recombinedFgt - s.fgt) < 1e-12);
});

test('buildDailyTokenFgtIndex: subgroup decomposition omitted by default', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 100),
    ql('2026-04-02T00:00:00Z', 'a', 200),
  ];
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources[0]!.subgroupDecomposition, undefined);
});

test('buildDailyTokenFgtIndex: alpha=1 and alpha=2 produce headcount-consistent rows', () => {
  // The headcount is independent of alpha; only fgt changes.
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 50),
    ql('2026-04-02T00:00:00Z', 'a', 100),
    ql('2026-04-03T00:00:00Z', 'a', 200),
    ql('2026-04-04T00:00:00Z', 'a', 400),
  ];
  const r1 = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    alpha: 1,
  });
  const r2 = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    alpha: 2,
  });
  assert.equal(r1.sources[0]!.headcount, r2.sources[0]!.headcount);
  assert.equal(r1.sources[0]!.povertyGap, r2.sources[0]!.povertyGap);
  assert.equal(r1.sources[0]!.severity, r2.sources[0]!.severity);
  // alpha=1 fgt equals povertyGap; alpha=2 fgt equals severity.
  assert.equal(r1.sources[0]!.fgt, r1.sources[0]!.povertyGap);
  assert.equal(r2.sources[0]!.fgt, r2.sources[0]!.severity);
});

test('buildDailyTokenFgtIndex: zero days are flagged in nZeroDays', () => {
  // Only positive token rows survive the parser, but a day's mass
  // could in principle be zero. Construct via two negative-cancel
  // rows? No -- non-positive are dropped. So nZeroDays should be 0
  // for any synthetic input.
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 100),
    ql('2026-04-02T00:00:00Z', 'a', 200),
  ];
  const r = buildDailyTokenFgtIndex(q, { generatedAt: GEN, minTokens: 0 });
  assert.equal(r.sources[0]!.nZeroDays, 0);
});

// ---- refinement v0.6.281: orthogonality witness -------------------------

test('orthogonality witness: omitted by default', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 100),
    ql('2026-04-02T00:00:00Z', 'a', 200),
  ];
  const r = buildDailyTokenFgtIndex(q, { generatedAt: GEN, minTokens: 0 });
  assert.equal(r.sources[0]!.transferSensitivityLift, undefined);
  assert.equal(r.sources[0]!.uniformPoorShortfalls, undefined);
});

test('orthogonality witness: lift = 1 when all poor shortfalls identical', () => {
  // 4 days [10, 10, 1000, 1000]. mean = 505. line = 252.5.
  // poor days: both 10s. shortfalls equal -> lift should be 1.
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 10),
    ql('2026-04-02T00:00:00Z', 'a', 10),
    ql('2026-04-03T00:00:00Z', 'a', 1000),
    ql('2026-04-04T00:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    alpha: 2,
    includeOrthogonalityWitness: true,
  });
  const s = r.sources[0]!;
  assert.equal(s.nPoor, 2);
  assert.ok(Math.abs(s.transferSensitivityLift! - 1) < 1e-12);
  assert.equal(s.uniformPoorShortfalls, true);
});

test('orthogonality witness: lift > 1 with heterogeneous poor shortfalls', () => {
  // 4 days [1, 100, 1000, 1000]. mean = 525.25. line = 262.625.
  // poor days: 1 and 100 -- highly heterogeneous shortfalls.
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1),
    ql('2026-04-02T00:00:00Z', 'a', 100),
    ql('2026-04-03T00:00:00Z', 'a', 1000),
    ql('2026-04-04T00:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    alpha: 2,
    includeOrthogonalityWitness: true,
  });
  const s = r.sources[0]!;
  assert.ok(s.transferSensitivityLift! > 1);
  assert.equal(s.uniformPoorShortfalls, false);
});

test('orthogonality witness: NaN lift when no poor days', () => {
  // line = 0.5 * mean. If we make all days identical they all sit at
  // the mean and none are strictly below.
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 100),
    ql('2026-04-02T00:00:00Z', 'a', 100),
    ql('2026-04-03T00:00:00Z', 'a', 100),
  ];
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    includeOrthogonalityWitness: true,
  });
  const s = r.sources[0]!;
  assert.equal(s.nPoor, 0);
  assert.ok(Number.isNaN(s.transferSensitivityLift!));
  assert.equal(s.uniformPoorShortfalls, false);
});

test('orthogonality witness: lift independent of headline alpha', () => {
  // Witness uses povertyGap (alpha=1) and severity (alpha=2)
  // exclusively, so changing the headline alpha must not change it.
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1),
    ql('2026-04-02T00:00:00Z', 'a', 100),
    ql('2026-04-03T00:00:00Z', 'a', 1000),
    ql('2026-04-04T00:00:00Z', 'a', 1000),
  ];
  const r1 = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    alpha: 0,
    includeOrthogonalityWitness: true,
  });
  const r2 = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    alpha: 3.5,
    includeOrthogonalityWitness: true,
  });
  assert.equal(
    r1.sources[0]!.transferSensitivityLift,
    r2.sources[0]!.transferSensitivityLift,
  );
});

test('orthogonality witness + subgroup decomposition coexist', () => {
  const q: QueueLine[] = [
    ql('2026-04-06T00:00:00Z', 'a', 10),
    ql('2026-04-07T00:00:00Z', 'a', 1000),
    ql('2026-04-04T00:00:00Z', 'a', 5),
    ql('2026-04-05T00:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenFgtIndex(q, {
    generatedAt: GEN,
    minTokens: 0,
    alpha: 2,
    includeSubgroupDecomposition: true,
    includeOrthogonalityWitness: true,
  });
  const s = r.sources[0]!;
  assert.ok(s.subgroupDecomposition);
  assert.notEqual(s.transferSensitivityLift, undefined);
  assert.ok(s.subgroupDecomposition!.decompositionExact);
});
