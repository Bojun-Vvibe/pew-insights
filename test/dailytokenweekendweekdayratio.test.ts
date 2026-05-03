import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenWeekendWeekdayRatio,
  isWeekendUtcDay,
  classifyWeekendRegime,
} from '../src/dailytokenweekendweekdayratio.js';
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

const GEN = '2026-05-04T12:00:00.000Z';

// --- helpers --------------------------------------------------------------

test('isWeekendUtcDay: 2026-05-02 (Sat) is weekend', () => {
  assert.equal(isWeekendUtcDay('2026-05-02'), true);
});

test('isWeekendUtcDay: 2026-05-03 (Sun) is weekend', () => {
  assert.equal(isWeekendUtcDay('2026-05-03'), true);
});

test('isWeekendUtcDay: 2026-05-04 (Mon) is weekday', () => {
  assert.equal(isWeekendUtcDay('2026-05-04'), false);
});

test('isWeekendUtcDay: 2026-05-08 (Fri) is weekday', () => {
  assert.equal(isWeekendUtcDay('2026-05-08'), false);
});

test('isWeekendUtcDay: throws on garbage input', () => {
  assert.throws(() => isWeekendUtcDay('not-a-day'));
});

test('classifyWeekendRegime: balanced range covers 2/7..3/7', () => {
  assert.equal(classifyWeekendRegime(2 / 7, 100, 100), 'balanced');
  assert.equal(classifyWeekendRegime(0.4, 100, 100), 'balanced');
});

test('classifyWeekendRegime: pure poles', () => {
  assert.equal(classifyWeekendRegime(0, 0, 100), 'weekday-only');
  assert.equal(classifyWeekendRegime(1, 100, 0), 'weekend-only');
});

test('classifyWeekendRegime: extremes between poles', () => {
  assert.equal(classifyWeekendRegime(0.05, 5, 95), 'weekday-heavy');
  assert.equal(classifyWeekendRegime(0.2, 20, 80), 'weekday-leaning');
  assert.equal(classifyWeekendRegime(0.5, 50, 50), 'weekend-leaning');
  assert.equal(classifyWeekendRegime(0.8, 80, 20), 'weekend-heavy');
});

test('classifyWeekendRegime: degenerate when both zero', () => {
  assert.equal(classifyWeekendRegime(0, 0, 0), 'degenerate');
});

// --- builder: empty / degenerate paths ------------------------------------

test('builder: empty queue -> empty rows + zero counters', () => {
  const r = buildDailyTokenWeekendWeekdayRatio([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.droppedInvalidHourStart, 0);
  assert.equal(r.droppedNonPositiveTokens, 0);
});

test('builder: single-day source dropped under default minDays=2', () => {
  const r = buildDailyTokenWeekendWeekdayRatio(
    [ql('2026-05-04T00:00:00Z', 'a', 5000)],
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinDays, 1);
});

test('builder: single-day source kept under minDays=1', () => {
  const r = buildDailyTokenWeekendWeekdayRatio(
    [ql('2026-05-04T00:00:00Z', 'a', 5000)],
    { generatedAt: GEN, minDays: 1 },
  );
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  // 2026-05-04 = Mon. Single-day span -> no weekend day in calendar span,
  // so regime is calendar-blind 'weekend-blind' (overrides token-pole label).
  assert.equal(s.weekendTokens, 0);
  assert.equal(s.weekdayTokens, 5000);
  assert.equal(s.ratio, 0);
  assert.equal(s.weekendShare, 0);
  assert.equal(s.weekendRegime, 'weekend-blind');
});

test('builder: tokens below minTokens -> droppedSparseSources', () => {
  const r = buildDailyTokenWeekendWeekdayRatio(
    [
      ql('2026-05-04T00:00:00Z', 'a', 100),
      ql('2026-05-05T00:00:00Z', 'a', 100),
    ],
    { generatedAt: GEN, minTokens: 1000 },
  );
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('builder: invalid hour_start counted', () => {
  const r = buildDailyTokenWeekendWeekdayRatio(
    [ql('not-iso', 'a', 5000)],
    { generatedAt: GEN, minDays: 1 },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('builder: non-positive tokens counted', () => {
  const r = buildDailyTokenWeekendWeekdayRatio(
    [ql('2026-05-04T00:00:00Z', 'a', 0)],
    { generatedAt: GEN, minDays: 1 },
  );
  assert.equal(r.droppedNonPositiveTokens, 1);
});

// --- builder: pole semantics ----------------------------------------------

test('builder: pure-weekday source -> ratio=0, share=0, regime=weekday-only', () => {
  // Mon..Fri 2026-05-04 .. 2026-05-08
  const r = buildDailyTokenWeekendWeekdayRatio(
    [
      ql('2026-05-04T00:00:00Z', 'wkdy', 1000),
      ql('2026-05-05T00:00:00Z', 'wkdy', 1000),
      ql('2026-05-06T00:00:00Z', 'wkdy', 1000),
      ql('2026-05-07T00:00:00Z', 'wkdy', 1000),
      ql('2026-05-08T00:00:00Z', 'wkdy', 1000),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.weekendTokens, 0);
  assert.equal(s.weekdayTokens, 5000);
  assert.equal(s.weekendShare, 0);
  assert.equal(s.ratio, 0);
  // span = Mon..Fri, no weekend in span -> weekend-blind
  assert.equal(s.weekendCalendarDayCount, 0);
  assert.equal(s.weekendRegime, 'weekend-blind');
  assert.equal(s.densityRatio, null);
});

test('builder: pure-weekend source -> share=1, ratio=null, regime=weekday-blind on tight span', () => {
  // Sat 2026-05-02 + Sun 2026-05-03 only.
  const r = buildDailyTokenWeekendWeekdayRatio(
    [
      ql('2026-05-02T00:00:00Z', 'wknd', 1000),
      ql('2026-05-03T00:00:00Z', 'wknd', 1000),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.weekendTokens, 2000);
  assert.equal(s.weekdayTokens, 0);
  assert.equal(s.weekendShare, 1);
  assert.equal(s.ratio, null);
  assert.equal(s.weekdayCalendarDayCount, 0);
  assert.equal(s.weekendRegime, 'weekday-blind');
});

test('builder: balanced source 5 weekdays + 2 weekend equal-mass -> ratio = 2/5', () => {
  // Mon..Sun 2026-05-04 .. 2026-05-10. Each day 1000 tokens.
  const days = [
    '2026-05-04', // Mon
    '2026-05-05', // Tue
    '2026-05-06', // Wed
    '2026-05-07', // Thu
    '2026-05-08', // Fri
    '2026-05-09', // Sat
    '2026-05-10', // Sun
  ];
  const r = buildDailyTokenWeekendWeekdayRatio(
    days.map((d) => ql(d + 'T00:00:00Z', 'bal', 1000)),
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.weekendTokens, 2000);
  assert.equal(s.weekdayTokens, 5000);
  assert.ok(Math.abs((s.ratio as number) - 2 / 5) < 1e-12);
  assert.ok(Math.abs(s.weekendShare - 2 / 7) < 1e-12);
  // densityRatio should be 1.0 (uniform per-day intensity)
  assert.ok(Math.abs((s.densityRatio as number) - 1) < 1e-12);
  assert.equal(s.weekendRegime, 'balanced');
});

test('builder: weekend-heavy source -> regime=weekend-heavy and ratio>1', () => {
  // 2 weekdays low, 2 weekend high.
  const r = buildDailyTokenWeekendWeekdayRatio(
    [
      ql('2026-05-04T00:00:00Z', 'wh', 100), // Mon
      ql('2026-05-05T00:00:00Z', 'wh', 100), // Tue
      ql('2026-05-09T00:00:00Z', 'wh', 5000), // Sat
      ql('2026-05-10T00:00:00Z', 'wh', 5000), // Sun
    ],
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.equal(s.weekendTokens, 10000);
  assert.equal(s.weekdayTokens, 200);
  assert.ok((s.ratio as number) > 1);
  assert.ok(s.weekendShare > 0.6);
  assert.equal(s.weekendRegime, 'weekend-heavy');
});

// --- orthogonality witness ------------------------------------------------

test('orthogonality witness vs permutation invariance: same multiset, opposite ratios', () => {
  // Source A: D=[1000,1000] on (Sat 2026-05-02, Sun 2026-05-03)
  // Source B: D=[1000,1000] on (Mon 2026-05-04, Tue 2026-05-05)
  // Same active-day token multiset; identical Gini=0/HHI=0.5/Pielou J=1.
  const r = buildDailyTokenWeekendWeekdayRatio(
    [
      ql('2026-05-02T00:00:00Z', 'A', 1000),
      ql('2026-05-03T00:00:00Z', 'A', 1000),
      ql('2026-05-04T00:00:00Z', 'B', 1000),
      ql('2026-05-05T00:00:00Z', 'B', 1000),
    ],
    { generatedAt: GEN, sort: 'source' },
  );
  assert.equal(r.sources.length, 2);
  const byName = new Map(r.sources.map((s) => [s.source, s]));
  const a = byName.get('A')!;
  const b = byName.get('B')!;
  assert.equal(a.weekendShare, 1);
  assert.equal(b.weekendShare, 0);
  assert.equal(a.ratio, null); // pure weekend
  assert.equal(b.ratio, 0); // pure weekday
});

// --- multi-source / sorting / filters -------------------------------------

test('builder: sort=weekendShare descending', () => {
  // A: 80% weekend; B: 20% weekend
  const r = buildDailyTokenWeekendWeekdayRatio(
    [
      ql('2026-05-04T00:00:00Z', 'A', 1000), // weekday
      ql('2026-05-09T00:00:00Z', 'A', 4000), // weekend Sat
      ql('2026-05-04T00:00:00Z', 'B', 4000),
      ql('2026-05-09T00:00:00Z', 'B', 1000),
    ],
    { generatedAt: GEN, sort: 'weekendShare' },
  );
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'A');
  assert.equal(r.sources[1]!.source, 'B');
  assert.ok(r.sources[0]!.weekendShare > r.sources[1]!.weekendShare);
});

test('builder: sort=ratio puts null (pure-weekend) first as +inf', () => {
  const r = buildDailyTokenWeekendWeekdayRatio(
    [
      ql('2026-05-09T00:00:00Z', 'pureW', 1000),
      ql('2026-05-10T00:00:00Z', 'pureW', 1000),
      ql('2026-05-04T00:00:00Z', 'mid', 1000),
      ql('2026-05-09T00:00:00Z', 'mid', 1000),
    ],
    { generatedAt: GEN, sort: 'ratio' },
  );
  assert.equal(r.sources[0]!.source, 'pureW');
  assert.equal(r.sources[0]!.ratio, null);
});

test('builder: --min-weekend-share filter drops below threshold', () => {
  const r = buildDailyTokenWeekendWeekdayRatio(
    [
      ql('2026-05-04T00:00:00Z', 'low', 4000),
      ql('2026-05-09T00:00:00Z', 'low', 1000),
      ql('2026-05-04T00:00:00Z', 'high', 1000),
      ql('2026-05-09T00:00:00Z', 'high', 4000),
    ],
    { generatedAt: GEN, minWeekendShare: 0.5 },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'high');
  assert.equal(r.droppedBelowMinWeekendShare, 1);
});

test('builder: --top caps results and counts the rest', () => {
  const lines: QueueLine[] = [];
  for (const s of ['a', 'b', 'c', 'd']) {
    lines.push(ql('2026-05-04T00:00:00Z', s, 1000));
    lines.push(ql('2026-05-09T00:00:00Z', s, 1000));
  }
  const r = buildDailyTokenWeekendWeekdayRatio(lines, {
    generatedAt: GEN,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

// --- input validation -----------------------------------------------------

test('builder: invalid sort throws', () => {
  assert.throws(() =>
    buildDailyTokenWeekendWeekdayRatio([], {
      generatedAt: GEN,
      sort: 'banana' as 'weekendShare',
    }),
  );
});

test('builder: minWeekendShare out of [0,1] throws', () => {
  assert.throws(() =>
    buildDailyTokenWeekendWeekdayRatio([], {
      generatedAt: GEN,
      minWeekendShare: 1.5,
    }),
  );
  assert.throws(() =>
    buildDailyTokenWeekendWeekdayRatio([], {
      generatedAt: GEN,
      minWeekendShare: -0.1,
    }),
  );
});

test('builder: minDays must be >= 1', () => {
  assert.throws(() =>
    buildDailyTokenWeekendWeekdayRatio([], {
      generatedAt: GEN,
      minDays: 0,
    }),
  );
});

// --- v0.6.396 refinement: weekendShareDelta + weekendDensityLogLift -------

test('refinement: weekendShareDelta = 0 for perfectly baseline source', () => {
  const days = [
    '2026-05-04', // Mon
    '2026-05-05', // Tue
    '2026-05-06', // Wed
    '2026-05-07', // Thu
    '2026-05-08', // Fri
    '2026-05-09', // Sat
    '2026-05-10', // Sun
  ];
  const r = buildDailyTokenWeekendWeekdayRatio(
    days.map((d) => ql(d + 'T00:00:00Z', 'bal', 1000)),
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.weekendShareDelta) < 1e-12);
});

test('refinement: weekendShareDelta sign matches weekend tilt', () => {
  // Pure weekday (regime weekend-blind) -> share=0 -> delta = -2/7
  const r = buildDailyTokenWeekendWeekdayRatio(
    [
      ql('2026-05-04T00:00:00Z', 'wkdy', 1000),
      ql('2026-05-05T00:00:00Z', 'wkdy', 1000),
    ],
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.weekendShareDelta - -2 / 7) < 1e-12);
  assert.ok(s.weekendShareDelta < 0);
});

test('refinement: weekendDensityLogLift = 0 at uniform per-day intensity', () => {
  // Mon..Sun all 1000 -> densityRatio = 1 -> logLift = 0
  const days = [
    '2026-05-04',
    '2026-05-05',
    '2026-05-06',
    '2026-05-07',
    '2026-05-08',
    '2026-05-09',
    '2026-05-10',
  ];
  const r = buildDailyTokenWeekendWeekdayRatio(
    days.map((d) => ql(d + 'T00:00:00Z', 'u', 1000)),
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.weekendDensityLogLift as number) < 1e-12);
});

test('refinement: weekendDensityLogLift = +ln(2) when weekend intensity is 2x weekday', () => {
  // 5 weekdays at 1000 each (intensity 1000), 2 weekend days at 2000 each (intensity 2000).
  const r = buildDailyTokenWeekendWeekdayRatio(
    [
      ql('2026-05-04T00:00:00Z', 's', 1000),
      ql('2026-05-05T00:00:00Z', 's', 1000),
      ql('2026-05-06T00:00:00Z', 's', 1000),
      ql('2026-05-07T00:00:00Z', 's', 1000),
      ql('2026-05-08T00:00:00Z', 's', 1000),
      ql('2026-05-09T00:00:00Z', 's', 2000),
      ql('2026-05-10T00:00:00Z', 's', 2000),
    ],
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.ok(Math.abs((s.densityRatio as number) - 2) < 1e-12);
  assert.ok(
    Math.abs((s.weekendDensityLogLift as number) - Math.log(2)) < 1e-12,
  );
});

test('refinement: weekendDensityLogLift = null when densityRatio is null', () => {
  // Pure-weekend tight span -> densityRatio = null -> logLift = null
  const r = buildDailyTokenWeekendWeekdayRatio(
    [
      ql('2026-05-02T00:00:00Z', 'wknd', 1000),
      ql('2026-05-03T00:00:00Z', 'wknd', 1000),
    ],
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.equal(s.densityRatio, null);
  assert.equal(s.weekendDensityLogLift, null);
});

// --- v0.6.396 follow-up: deterministic tie-break + sort-by-shareDelta ----

test('refinement: sort=weekendShare ties broken by source ascending', () => {
  // Two sources with identical share -> expect alpha-asc by source.
  const r = buildDailyTokenWeekendWeekdayRatio(
    [
      ql('2026-05-04T00:00:00Z', 'zeta', 1000),
      ql('2026-05-09T00:00:00Z', 'zeta', 1000),
      ql('2026-05-04T00:00:00Z', 'alpha', 1000),
      ql('2026-05-09T00:00:00Z', 'alpha', 1000),
    ],
    { generatedAt: GEN, sort: 'weekendShare' },
  );
  assert.equal(r.sources.length, 2);
  // Both have weekendShare = 0.5 (one weekday + one weekend, equal mass).
  assert.ok(
    Math.abs(r.sources[0]!.weekendShare - r.sources[1]!.weekendShare) < 1e-12,
  );
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('refinement: weekendShareDelta is in [-2/7, +5/7] for every produced row', () => {
  // Stress: many sources with random-ish DOW patterns; check bounds hold.
  const lines: QueueLine[] = [];
  const sourceNames = ['s1', 's2', 's3', 's4'];
  // Days span Mon..Sun across two weeks.
  const days = [
    '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08',
    '2026-05-09', '2026-05-10', '2026-05-11', '2026-05-12', '2026-05-13',
    '2026-05-14', '2026-05-15', '2026-05-16', '2026-05-17',
  ];
  let i = 0;
  for (const s of sourceNames) {
    for (const d of days) {
      // Vary token mass per source / day deterministically but unevenly.
      const v = ((i * 7919 + 13) % 5000) + 100;
      lines.push(ql(d + 'T00:00:00Z', s, v));
      i += 1;
    }
  }
  const r = buildDailyTokenWeekendWeekdayRatio(lines, { generatedAt: GEN });
  assert.equal(r.sources.length, 4);
  for (const s of r.sources) {
    assert.ok(s.weekendShareDelta >= -2 / 7 - 1e-12);
    assert.ok(s.weekendShareDelta <= 5 / 7 + 1e-12);
  }
});
