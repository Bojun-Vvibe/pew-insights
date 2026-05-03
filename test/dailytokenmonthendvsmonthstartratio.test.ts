import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenMonthEndVsMonthStartRatio,
  classifyMonthEdgeBucket,
  classifyMonthEdgeRegime,
  utcMonthLength,
} from '../src/dailytokenmonthendvsmonthstartratio.js';
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

test('utcMonthLength: 2026-01 = 31', () => {
  assert.equal(utcMonthLength('2026-01-15'), 31);
});

test('utcMonthLength: 2026-02 = 28 (non-leap)', () => {
  assert.equal(utcMonthLength('2026-02-10'), 28);
});

test('utcMonthLength: 2024-02 = 29 (leap)', () => {
  assert.equal(utcMonthLength('2024-02-10'), 29);
});

test('utcMonthLength: 2026-04 = 30', () => {
  assert.equal(utcMonthLength('2026-04-15'), 30);
});

test('utcMonthLength: throws on garbage input', () => {
  assert.throws(() => utcMonthLength('not-a-day'));
});

test('classifyMonthEdgeBucket: ws=7, day 1 of 31-day month -> start', () => {
  assert.equal(classifyMonthEdgeBucket('2026-01-01', 7), 'start');
});

test('classifyMonthEdgeBucket: ws=7, day 7 of 31-day month -> start', () => {
  assert.equal(classifyMonthEdgeBucket('2026-01-07', 7), 'start');
});

test('classifyMonthEdgeBucket: ws=7, day 8 of 31-day month -> mid', () => {
  assert.equal(classifyMonthEdgeBucket('2026-01-08', 7), 'mid');
});

test('classifyMonthEdgeBucket: ws=7, day 24 of 31-day month -> mid', () => {
  // 31 - 7 = 24; bucket = end iff dom > 24, so 24 = mid.
  assert.equal(classifyMonthEdgeBucket('2026-01-24', 7), 'mid');
});

test('classifyMonthEdgeBucket: ws=7, day 25 of 31-day month -> end', () => {
  assert.equal(classifyMonthEdgeBucket('2026-01-25', 7), 'end');
});

test('classifyMonthEdgeBucket: ws=7, day 31 of 31-day month -> end', () => {
  assert.equal(classifyMonthEdgeBucket('2026-01-31', 7), 'end');
});

test('classifyMonthEdgeBucket: ws=7, day 28 of 28-day Feb -> end (last day)', () => {
  assert.equal(classifyMonthEdgeBucket('2026-02-28', 7), 'end');
});

test('classifyMonthEdgeBucket: ws=7, day 22 of 28-day Feb -> end (28-7+1=22)', () => {
  assert.equal(classifyMonthEdgeBucket('2026-02-22', 7), 'end');
});

test('classifyMonthEdgeBucket: ws=7, day 21 of 28-day Feb -> mid', () => {
  assert.equal(classifyMonthEdgeBucket('2026-02-21', 7), 'mid');
});

test('classifyMonthEdgeBucket: ws=14, day 14 of 28-day Feb -> start (boundary disjoint)', () => {
  assert.equal(classifyMonthEdgeBucket('2026-02-14', 14), 'start');
});

test('classifyMonthEdgeBucket: ws=14, day 15 of 28-day Feb -> end', () => {
  assert.equal(classifyMonthEdgeBucket('2026-02-15', 14), 'end');
});

test('classifyMonthEdgeBucket: ws=1, day 15 of 30-day Apr -> mid', () => {
  assert.equal(classifyMonthEdgeBucket('2026-04-15', 1), 'mid');
});

test('classifyMonthEdgeBucket: ws=1, day 30 of 30-day Apr -> end', () => {
  assert.equal(classifyMonthEdgeBucket('2026-04-30', 1), 'end');
});

test('classifyMonthEdgeBucket: throws on garbage input', () => {
  assert.throws(() => classifyMonthEdgeBucket('not-a-day', 7));
});

test('classifyMonthEdgeRegime: balanced range covers 0.45..0.55', () => {
  assert.equal(classifyMonthEdgeRegime(0.5, 100, 100, 0), 'balanced');
  assert.equal(classifyMonthEdgeRegime(0.45, 110, 90, 0), 'balanced');
});

test('classifyMonthEdgeRegime: pure start/end poles', () => {
  assert.equal(classifyMonthEdgeRegime(0, 100, 0, 0), 'start-only');
  assert.equal(classifyMonthEdgeRegime(1, 0, 100, 0), 'end-only');
});

test('classifyMonthEdgeRegime: start-heavy / start-leaning', () => {
  assert.equal(classifyMonthEdgeRegime(0.05, 95, 5, 0), 'start-heavy');
  assert.equal(classifyMonthEdgeRegime(0.4, 60, 40, 0), 'start-leaning');
});

test('classifyMonthEdgeRegime: end-heavy / end-leaning', () => {
  assert.equal(classifyMonthEdgeRegime(0.6, 40, 60, 0), 'end-leaning');
  assert.equal(classifyMonthEdgeRegime(0.85, 15, 85, 0), 'end-heavy');
});

test('classifyMonthEdgeRegime: mid-only when both poles zero but mid > 0', () => {
  assert.equal(classifyMonthEdgeRegime(0, 0, 0, 500), 'mid-only');
});

test('classifyMonthEdgeRegime: degenerate when all three are zero', () => {
  assert.equal(classifyMonthEdgeRegime(0, 0, 0, 0), 'degenerate');
});

// --- builder: empty / degenerate paths ------------------------------------

test('builder: empty queue -> empty rows + zero counters', () => {
  const r = buildDailyTokenMonthEndVsMonthStartRatio([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.droppedInvalidHourStart, 0);
  assert.equal(r.droppedNonPositiveTokens, 0);
  assert.equal(r.windowSize, 7);
});

test('builder: single-day source dropped under default minDays=2', () => {
  const r = buildDailyTokenMonthEndVsMonthStartRatio(
    [ql('2026-01-15T00:00:00Z', 'a', 5000)],
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinDays, 1);
});

test('builder: single-day source kept under minDays=1, mid-bucket only', () => {
  const r = buildDailyTokenMonthEndVsMonthStartRatio(
    [ql('2026-01-15T00:00:00Z', 'a', 5000)],
    { generatedAt: GEN, minDays: 1 },
  );
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  // 2026-01-15 with ws=7 is mid. Span is 1 day -> calendar buckets:
  // start=0, end=0, mid=1. -> 'start-blind' overrides since startCal=0.
  assert.equal(s.startTokens, 0);
  assert.equal(s.endTokens, 0);
  assert.equal(s.midTokens, 5000);
  assert.equal(s.endStartRatio, null);
  assert.equal(s.endShare, 0);
  assert.equal(s.monthEdgeRegime, 'start-blind');
});

test('builder: tokens below minTokens -> droppedSparseSources', () => {
  const r = buildDailyTokenMonthEndVsMonthStartRatio(
    [
      ql('2026-01-01T00:00:00Z', 'a', 100),
      ql('2026-01-31T00:00:00Z', 'a', 100),
    ],
    { generatedAt: GEN, minTokens: 1000 },
  );
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('builder: invalid hour_start counted', () => {
  const r = buildDailyTokenMonthEndVsMonthStartRatio(
    [ql('not-iso', 'a', 5000)],
    { generatedAt: GEN, minDays: 1 },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('builder: non-positive tokens counted', () => {
  const r = buildDailyTokenMonthEndVsMonthStartRatio(
    [ql('2026-01-01T00:00:00Z', 'a', 0)],
    { generatedAt: GEN, minDays: 1 },
  );
  assert.equal(r.droppedNonPositiveTokens, 1);
});

// --- builder: numerical correctness ---------------------------------------

test('builder: pure month-start source -> endShare=0, ratio=0, regime=start-only', () => {
  // Span Jan-01 .. Jan-07 (all start days). Calendar contains no end-bucket
  // days, so regime is 'end-blind'.
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 7; d += 1) {
    lines.push(
      ql(
        `2026-01-0${d}T12:00:00Z`.replace('-012', '-12'),
        'a',
        1000,
      ),
    );
  }
  const r = buildDailyTokenMonthEndVsMonthStartRatio(lines, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.startTokens, 7000);
  assert.equal(s.endTokens, 0);
  assert.equal(s.midTokens, 0);
  assert.equal(s.endShare, 0);
  assert.equal(s.endStartRatio, 0);
  assert.equal(s.monthEdgeRegime, 'end-blind');
});

test('builder: pure month-end source -> endShare=1, ratio=null, regime=end-only or end-blind', () => {
  // Span Jan-25 .. Jan-31 (all end days for ws=7 in 31-day month).
  // Calendar has no start-bucket days -> 'start-blind' override.
  const lines: QueueLine[] = [];
  for (let d = 25; d <= 31; d += 1) {
    lines.push(ql(`2026-01-${d}T12:00:00Z`, 'a', 1000));
  }
  const r = buildDailyTokenMonthEndVsMonthStartRatio(lines, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.startTokens, 0);
  assert.equal(s.endTokens, 7000);
  assert.equal(s.endShare, 1);
  assert.equal(s.endStartRatio, null);
  assert.equal(s.monthEdgeRegime, 'start-blind');
});

test('builder: balanced source -> endShare=0.5, ratio=1, regime=balanced', () => {
  // Span Jan-01 .. Jan-31. Equal tokens on a start-bucket day and an
  // end-bucket day. Mid days have no activity.
  const lines: QueueLine[] = [
    ql('2026-01-01T12:00:00Z', 'a', 5000),
    ql('2026-01-31T12:00:00Z', 'a', 5000),
  ];
  const r = buildDailyTokenMonthEndVsMonthStartRatio(lines, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.startTokens, 5000);
  assert.equal(s.endTokens, 5000);
  assert.equal(s.midTokens, 0);
  assert.equal(s.endShare, 0.5);
  assert.equal(s.endStartRatio, 1);
  assert.equal(s.monthEdgeRegime, 'balanced');
  // Span Jan-01..Jan-31 has 7 start days, 7 end days, 17 mid days.
  assert.equal(s.startCalendarDayCount, 7);
  assert.equal(s.endCalendarDayCount, 7);
  assert.equal(s.midCalendarDayCount, 17);
  assert.equal(s.densityRatio, 1);
});

test('builder: density-corrected ratio rebases asymmetric calendar spans', () => {
  // Span Jan-01..Jan-08 = 8 calendar days = 7 start + 0 end + 1 mid.
  // Equal raw tokens on 1 start day and... we cannot put an end day here.
  // Use Jan-01..Feb-01 = 32 cal days = 7 start (Jan-01..07) + 7 end
  // (Jan-25..31) + 17 mid (Jan-08..24) + 1 start (Feb-01) = 8 start
  // + 7 end + 17 mid. Put 1000 tokens each on Jan-01 (start) and
  // Jan-31 (end). Raw ratio = 1.0; densityRatio = (1000/7) / (1000/8) = 8/7.
  const lines: QueueLine[] = [
    ql('2026-01-01T12:00:00Z', 'a', 1000),
    ql('2026-01-31T12:00:00Z', 'a', 1000),
    ql('2026-02-01T12:00:00Z', 'a', 1), // boundary: makes lastDay = Feb-01, span includes Feb-01 as start.
  ];
  const r = buildDailyTokenMonthEndVsMonthStartRatio(lines, {
    generatedAt: GEN,
    minTokens: 1,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.startCalendarDayCount, 8); // Jan-01..07 + Feb-01
  assert.equal(s.endCalendarDayCount, 7); // Jan-25..31
  assert.equal(s.startTokens, 1001);
  assert.equal(s.endTokens, 1000);
  // densityRatio = (1000/7) / (1001/8) = (8000) / (7007) ~ 1.1417
  const expected = 1000 / 7 / (1001 / 8);
  assert.ok(Math.abs(s.densityRatio! - expected) < 1e-9);
});

test('builder: orthogonality witness vs weekend/weekday ratio', () => {
  // Two sources with identical permutation-invariant fingerprints
  // (same multiset {1000, 1000}) but different day-of-month placement.
  // 'a' lands on (Jan-01, Jan-02) -> both START-bucket; endStartRatio=0.
  // 'b' lands on (Jan-30, Jan-31) -> both END-bucket; endStartRatio=null.
  const lines: QueueLine[] = [
    ql('2026-01-01T12:00:00Z', 'a', 1000),
    ql('2026-01-02T12:00:00Z', 'a', 1000),
    ql('2026-01-30T12:00:00Z', 'b', 1000),
    ql('2026-01-31T12:00:00Z', 'b', 1000),
  ];
  const r = buildDailyTokenMonthEndVsMonthStartRatio(lines, {
    generatedAt: GEN,
  });
  const a = r.sources.find((s) => s.source === 'a')!;
  const b = r.sources.find((s) => s.source === 'b')!;
  assert.equal(a.startTokens, 2000);
  assert.equal(a.endTokens, 0);
  assert.equal(a.endStartRatio, 0);
  assert.equal(b.startTokens, 0);
  assert.equal(b.endTokens, 2000);
  assert.equal(b.endStartRatio, null);
});

test('builder: respects since/until window', () => {
  const r = buildDailyTokenMonthEndVsMonthStartRatio(
    [
      ql('2026-01-01T12:00:00Z', 'a', 5000),
      ql('2026-01-31T12:00:00Z', 'a', 5000),
      ql('2026-02-15T12:00:00Z', 'a', 5000),
    ],
    {
      generatedAt: GEN,
      since: '2026-01-15T00:00:00Z',
      until: '2026-02-10T00:00:00Z',
      minDays: 1,
    },
  );
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  // Only Jan-31 survives the window.
  assert.equal(s.totalTokens, 5000);
  assert.equal(s.endTokens, 5000);
});

test('builder: sort=endShare puts highest endShare first', () => {
  const lines: QueueLine[] = [
    // 'a' all start
    ql('2026-01-01T12:00:00Z', 'a', 1000),
    ql('2026-01-02T12:00:00Z', 'a', 1000),
    ql('2026-01-31T12:00:00Z', 'a', 1), // tiny end signal
    // 'b' all end
    ql('2026-01-25T12:00:00Z', 'b', 1000),
    ql('2026-01-26T12:00:00Z', 'b', 1000),
    ql('2026-01-01T12:00:00Z', 'b', 1), // tiny start signal
  ];
  const r = buildDailyTokenMonthEndVsMonthStartRatio(lines, {
    generatedAt: GEN,
    minTokens: 1,
    sort: 'endShare',
  });
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[1]!.source, 'a');
});

test('builder: sort=startShare puts highest startShare first', () => {
  const lines: QueueLine[] = [
    ql('2026-01-01T12:00:00Z', 'a', 1000),
    ql('2026-01-31T12:00:00Z', 'a', 1),
    ql('2026-01-25T12:00:00Z', 'b', 1000),
    ql('2026-01-01T12:00:00Z', 'b', 1),
  ];
  const r = buildDailyTokenMonthEndVsMonthStartRatio(lines, {
    generatedAt: GEN,
    minTokens: 1,
    sort: 'startShare',
  });
  assert.equal(r.sources[0]!.source, 'a');
});

test('builder: top cap drops excess sources', () => {
  const lines: QueueLine[] = [
    ql('2026-01-01T12:00:00Z', 'a', 5000),
    ql('2026-01-31T12:00:00Z', 'a', 1),
    ql('2026-01-25T12:00:00Z', 'b', 5000),
    ql('2026-01-01T12:00:00Z', 'b', 1),
    ql('2026-01-15T12:00:00Z', 'c', 3000),
    ql('2026-01-16T12:00:00Z', 'c', 3000),
  ];
  const r = buildDailyTokenMonthEndVsMonthStartRatio(lines, {
    generatedAt: GEN,
    minTokens: 1,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('builder: minEndShare filters low-end-share sources', () => {
  const lines: QueueLine[] = [
    ql('2026-01-01T12:00:00Z', 'low', 1000),
    ql('2026-01-31T12:00:00Z', 'low', 1),
    ql('2026-01-25T12:00:00Z', 'high', 1000),
    ql('2026-01-01T12:00:00Z', 'high', 1),
  ];
  const r = buildDailyTokenMonthEndVsMonthStartRatio(lines, {
    generatedAt: GEN,
    minTokens: 1,
    minEndShare: 0.5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'high');
  assert.equal(r.droppedBelowMinEndShare, 1);
});

test('builder: throws on invalid windowSize=0', () => {
  assert.throws(() =>
    buildDailyTokenMonthEndVsMonthStartRatio([], { windowSize: 0 }),
  );
});

test('builder: throws on invalid windowSize=15', () => {
  assert.throws(() =>
    buildDailyTokenMonthEndVsMonthStartRatio([], { windowSize: 15 }),
  );
});

test('builder: throws on invalid sort key', () => {
  assert.throws(() =>
    buildDailyTokenMonthEndVsMonthStartRatio([], {
      // @ts-expect-error - intentional bad sort key
      sort: 'nope',
    }),
  );
});

test('builder: source filter restricts to one source', () => {
  const lines: QueueLine[] = [
    ql('2026-01-01T12:00:00Z', 'a', 5000),
    ql('2026-01-02T12:00:00Z', 'a', 5000),
    ql('2026-01-01T12:00:00Z', 'b', 5000),
    ql('2026-01-02T12:00:00Z', 'b', 5000),
  ];
  const r = buildDailyTokenMonthEndVsMonthStartRatio(lines, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 2);
});

test('builder: deterministic generatedAt is preserved', () => {
  const r = buildDailyTokenMonthEndVsMonthStartRatio([], { generatedAt: GEN });
  assert.equal(r.generatedAt, GEN);
});

test('builder: ws=14 splits 28-day Feb cleanly into start+end with no mid', () => {
  // Feb-2026 (28 days) with ws=14: start={1..14}, end={15..28}, mid={}.
  const lines: QueueLine[] = [
    ql('2026-02-01T12:00:00Z', 'a', 1000),
    ql('2026-02-14T12:00:00Z', 'a', 1000),
    ql('2026-02-15T12:00:00Z', 'a', 1000),
    ql('2026-02-28T12:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenMonthEndVsMonthStartRatio(lines, {
    generatedAt: GEN,
    windowSize: 14,
  });
  const s = r.sources[0]!;
  assert.equal(s.startTokens, 2000);
  assert.equal(s.endTokens, 2000);
  assert.equal(s.midTokens, 0);
  assert.equal(s.midActiveDayCount, 0);
});
