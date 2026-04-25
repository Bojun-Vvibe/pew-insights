import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildActiveSpanPerDay } from '../src/activespanperday.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'codex',
    model: opts.model ?? 'gpt-5',
    hour_start: hourStart,
    device_id: opts.device_id ?? 'dev-a',
    input_tokens: opts.input_tokens ?? 100,
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? 100,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens: opts.total_tokens ?? 200,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation ----------------------------------------------------

test('active-span-per-day: rejects bad since/until', () => {
  assert.throws(() => buildActiveSpanPerDay([], { since: 'not-a-date' }));
  assert.throws(() => buildActiveSpanPerDay([], { until: 'nope' }));
});

test('active-span-per-day: rejects bad top', () => {
  assert.throws(() => buildActiveSpanPerDay([], { top: -1 }));
  assert.throws(() => buildActiveSpanPerDay([], { top: 1.5 }));
});

test('active-span-per-day: rejects bad sort key', () => {
  assert.throws(() =>
    buildActiveSpanPerDay([], { sort: 'bogus' as unknown as 'day' }),
  );
});

// ---- empty / drops --------------------------------------------------------

test('active-span-per-day: empty queue -> zero days, null stats, zero counts', () => {
  const r = buildActiveSpanPerDay([], { generatedAt: GEN });
  assert.equal(r.distinctDays, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.spanHoursMin, null);
  assert.equal(r.spanHoursMax, null);
  assert.equal(r.spanHoursMean, null);
  assert.equal(r.spanHoursMedian, null);
  assert.equal(r.spanHoursP25, null);
  assert.equal(r.spanHoursP75, null);
  assert.equal(r.dutyCycleMin, null);
  assert.equal(r.dutyCycleMax, null);
  assert.equal(r.dutyCycleMean, null);
  assert.equal(r.dutyCycleMedian, null);
  assert.equal(r.dutyCycleP25, null);
  assert.equal(r.dutyCycleP75, null);
  assert.equal(r.days.length, 0);
  assert.equal(r.sort, 'day');
  assert.equal(r.top, 0);
});

test('active-span-per-day: counts dropped invalid hour_start, zero-tokens, source filter', () => {
  const r = buildActiveSpanPerDay(
    [
      ql('not-a-date', {}),
      ql('2026-04-20T08:00:00Z', { total_tokens: 0 }),
      ql('2026-04-20T08:00:00Z', { total_tokens: -5 }),
      ql('2026-04-20T08:00:00Z', { source: 'claude-code' }),
      ql('2026-04-20T09:00:00Z', { source: 'codex' }),
      ql('2026-04-20T11:00:00Z', { source: 'codex' }),
    ],
    { generatedAt: GEN, source: 'codex' },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.distinctDays, 1);
  assert.equal(r.days[0]!.firstHour, 9);
  assert.equal(r.days[0]!.lastHour, 11);
  assert.equal(r.days[0]!.spanHours, 3);
  assert.equal(r.days[0]!.activeBuckets, 2);
  assert.ok(Math.abs(r.days[0]!.dutyCycle - 2 / 3) < 1e-9);
  assert.equal(r.source, 'codex');
});

// ---- core behaviour -------------------------------------------------------

test('active-span-per-day: span and duty cycle math is correct', () => {
  const r = buildActiveSpanPerDay(
    [
      // contiguous: 09, 10, 11 -> first=9 last=11 span=3 active=3 duty=1.0
      ql('2026-04-20T09:00:00Z'),
      ql('2026-04-20T10:00:00Z'),
      ql('2026-04-20T11:00:00Z'),
      // fragmented: 09, 14, 21 -> first=9 last=21 span=13 active=3 duty=3/13
      ql('2026-04-21T09:00:00Z'),
      ql('2026-04-21T14:00:00Z'),
      ql('2026-04-21T21:00:00Z'),
      // single bucket: 15 -> first=15 last=15 span=1 active=1 duty=1.0
      ql('2026-04-22T15:00:00Z'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.distinctDays, 3);
  // default sort is day desc
  const byDay = new Map(r.days.map((d) => [d.day, d]));
  assert.equal(byDay.get('2026-04-20')!.spanHours, 3);
  assert.equal(byDay.get('2026-04-20')!.activeBuckets, 3);
  assert.equal(byDay.get('2026-04-20')!.dutyCycle, 1);
  assert.equal(byDay.get('2026-04-21')!.spanHours, 13);
  assert.equal(byDay.get('2026-04-21')!.activeBuckets, 3);
  assert.ok(Math.abs(byDay.get('2026-04-21')!.dutyCycle - 3 / 13) < 1e-9);
  assert.equal(byDay.get('2026-04-22')!.spanHours, 1);
  assert.equal(byDay.get('2026-04-22')!.activeBuckets, 1);
  assert.equal(byDay.get('2026-04-22')!.dutyCycle, 1);
  // default sort: day desc
  assert.deepEqual(
    r.days.map((d) => d.day),
    ['2026-04-22', '2026-04-21', '2026-04-20'],
  );
});

test('active-span-per-day: dedupe — multiple rows in same hour count as one bucket', () => {
  const r = buildActiveSpanPerDay(
    [
      ql('2026-04-20T09:00:00Z', { total_tokens: 100 }),
      ql('2026-04-20T09:00:00Z', { total_tokens: 50 }),
      ql('2026-04-20T09:00:00Z', { total_tokens: 25 }),
      ql('2026-04-20T10:00:00Z', { total_tokens: 200 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.distinctDays, 1);
  assert.equal(r.days[0]!.activeBuckets, 2);
  assert.equal(r.days[0]!.spanHours, 2);
  assert.equal(r.days[0]!.dutyCycle, 1);
  assert.equal(r.days[0]!.tokensOnDay, 375);
});

test('active-span-per-day: summary stats over distribution', () => {
  // 4 days with spanHours = 1, 3, 5, 13 and dutyCycle = 1, 1, 1, 3/13
  const r = buildActiveSpanPerDay(
    [
      ql('2026-04-20T15:00:00Z'), // span 1, duty 1
      ql('2026-04-21T09:00:00Z'),
      ql('2026-04-21T10:00:00Z'),
      ql('2026-04-21T11:00:00Z'), // span 3, duty 1
      ql('2026-04-22T08:00:00Z'),
      ql('2026-04-22T09:00:00Z'),
      ql('2026-04-22T10:00:00Z'),
      ql('2026-04-22T11:00:00Z'),
      ql('2026-04-22T12:00:00Z'), // span 5, duty 1
      ql('2026-04-23T09:00:00Z'),
      ql('2026-04-23T14:00:00Z'),
      ql('2026-04-23T21:00:00Z'), // span 13, duty 3/13
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.distinctDays, 4);
  assert.equal(r.spanHoursMin, 1);
  assert.equal(r.spanHoursMax, 13);
  assert.ok(Math.abs(r.spanHoursMean! - (1 + 3 + 5 + 13) / 4) < 1e-9);
  // sorted spans = [1, 3, 5, 13]; median (idx 1.5) -> 4
  assert.equal(r.spanHoursMedian, 4);
  assert.equal(r.dutyCycleMin, 3 / 13);
  assert.equal(r.dutyCycleMax, 1);
});

// ---- sort + top -----------------------------------------------------------

test('active-span-per-day: sort=span orders longest first with day-desc tiebreak', () => {
  const r = buildActiveSpanPerDay(
    [
      // day A: span 5
      ql('2026-04-20T09:00:00Z'),
      ql('2026-04-20T13:00:00Z'),
      // day B: span 5 (tie)
      ql('2026-04-21T08:00:00Z'),
      ql('2026-04-21T12:00:00Z'),
      // day C: span 13
      ql('2026-04-22T09:00:00Z'),
      ql('2026-04-22T21:00:00Z'),
    ],
    { generatedAt: GEN, sort: 'span' },
  );
  assert.equal(r.sort, 'span');
  // C(13), then ties on 5 broken by day desc -> B then A
  assert.deepEqual(
    r.days.map((d) => d.day),
    ['2026-04-22', '2026-04-21', '2026-04-20'],
  );
});

test('active-span-per-day: sort=duty orders most-saturated first', () => {
  const r = buildActiveSpanPerDay(
    [
      // day A: duty 1.0 (span 1)
      ql('2026-04-20T15:00:00Z'),
      // day B: duty 3/13 (span 13)
      ql('2026-04-21T09:00:00Z'),
      ql('2026-04-21T14:00:00Z'),
      ql('2026-04-21T21:00:00Z'),
    ],
    { generatedAt: GEN, sort: 'duty' },
  );
  assert.equal(r.days[0]!.day, '2026-04-20');
  assert.equal(r.days[1]!.day, '2026-04-21');
});

test('active-span-per-day: sort=tokens and sort=active order correctly', () => {
  const queue = [
    ql('2026-04-20T09:00:00Z', { total_tokens: 100 }),
    ql('2026-04-21T09:00:00Z', { total_tokens: 999 }),
    ql('2026-04-21T11:00:00Z', { total_tokens: 1 }),
    ql('2026-04-22T09:00:00Z', { total_tokens: 50 }),
    ql('2026-04-22T10:00:00Z', { total_tokens: 50 }),
    ql('2026-04-22T11:00:00Z', { total_tokens: 50 }),
  ];
  const tokens = buildActiveSpanPerDay(queue, { generatedAt: GEN, sort: 'tokens' });
  assert.equal(tokens.days[0]!.day, '2026-04-21'); // 1000
  const active = buildActiveSpanPerDay(queue, { generatedAt: GEN, sort: 'active' });
  assert.equal(active.days[0]!.day, '2026-04-22'); // 3 buckets
});

test('active-span-per-day: top cap reflects in droppedTopDays; summary stats use full population', () => {
  const queue = [
    ql('2026-04-20T09:00:00Z'),
    ql('2026-04-20T10:00:00Z'), // span 2
    ql('2026-04-21T09:00:00Z'),
    ql('2026-04-21T20:00:00Z'), // span 12
    ql('2026-04-22T15:00:00Z'), // span 1
  ];
  const r = buildActiveSpanPerDay(queue, { generatedAt: GEN, top: 2 });
  assert.equal(r.distinctDays, 3);
  assert.equal(r.days.length, 2);
  assert.equal(r.droppedTopDays, 1);
  // summary stats reflect all 3 days
  assert.equal(r.spanHoursMin, 1);
  assert.equal(r.spanHoursMax, 12);
});

// ---- window filtering -----------------------------------------------------

test('active-span-per-day: since/until window filtering', () => {
  const r = buildActiveSpanPerDay(
    [
      ql('2026-04-19T09:00:00Z'), // before
      ql('2026-04-20T09:00:00Z'),
      ql('2026-04-20T11:00:00Z'),
      ql('2026-04-21T09:00:00Z'), // after
    ],
    {
      generatedAt: GEN,
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
    },
  );
  assert.equal(r.distinctDays, 1);
  assert.equal(r.days[0]!.day, '2026-04-20');
  assert.equal(r.days[0]!.activeBuckets, 2);
  assert.equal(r.windowStart, '2026-04-20T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-21T00:00:00Z');
});

test('active-span-per-day: generatedAt is honoured', () => {
  const r = buildActiveSpanPerDay([], { generatedAt: GEN });
  assert.equal(r.generatedAt, GEN);
});

// ---- minSpan filter -------------------------------------------------------

test('active-span-per-day: rejects bad minSpan', () => {
  assert.throws(() => buildActiveSpanPerDay([], { minSpan: -1 }));
  assert.throws(() => buildActiveSpanPerDay([], { minSpan: 1.5 }));
});

test('active-span-per-day: minSpan filters short days from stats AND days[]', () => {
  const queue = [
    // span 1
    ql('2026-04-20T15:00:00Z'),
    // span 3
    ql('2026-04-21T09:00:00Z'),
    ql('2026-04-21T11:00:00Z'),
    // span 13
    ql('2026-04-22T09:00:00Z'),
    ql('2026-04-22T21:00:00Z'),
  ];
  // No floor: 3 days, min span 1
  const baseline = buildActiveSpanPerDay(queue, { generatedAt: GEN });
  assert.equal(baseline.distinctDays, 3);
  assert.equal(baseline.spanHoursMin, 1);
  assert.equal(baseline.droppedShortSpanDays, 0);
  assert.equal(baseline.minSpan, 0);

  // Floor 3: drops the span-1 day
  const floored = buildActiveSpanPerDay(queue, {
    generatedAt: GEN,
    minSpan: 3,
  });
  assert.equal(floored.distinctDays, 2);
  assert.equal(floored.droppedShortSpanDays, 1);
  assert.equal(floored.spanHoursMin, 3);
  assert.equal(floored.spanHoursMax, 13);
  assert.equal(floored.minSpan, 3);
  assert.deepEqual(
    floored.days.map((d) => d.day).sort(),
    ['2026-04-21', '2026-04-22'],
  );
});

test('active-span-per-day: minSpan combines with top cap', () => {
  const queue = [
    ql('2026-04-19T15:00:00Z'), // span 1, dropped by floor
    ql('2026-04-20T09:00:00Z'),
    ql('2026-04-20T11:00:00Z'), // span 3, kept
    ql('2026-04-21T08:00:00Z'),
    ql('2026-04-21T12:00:00Z'), // span 5, kept
    ql('2026-04-22T09:00:00Z'),
    ql('2026-04-22T21:00:00Z'), // span 13, kept
  ];
  const r = buildActiveSpanPerDay(queue, {
    generatedAt: GEN,
    minSpan: 2,
    top: 2,
  });
  assert.equal(r.droppedShortSpanDays, 1);
  assert.equal(r.distinctDays, 3); // post-floor population
  assert.equal(r.days.length, 2); // top cap applied
  assert.equal(r.droppedTopDays, 1);
  // sort default (day desc) -> top 2 = 22, 21
  assert.deepEqual(
    r.days.map((d) => d.day),
    ['2026-04-22', '2026-04-21'],
  );
});

// ---- schema sanity --------------------------------------------------------

test('active-span-per-day: report shape includes all documented fields', () => {
  const r = buildActiveSpanPerDay(
    [
      ql('2026-04-20T09:00:00Z'),
      ql('2026-04-20T11:00:00Z'),
    ],
    { generatedAt: GEN, minSpan: 0 },
  );
  // Top-level fields
  const expectedKeys = new Set([
    'generatedAt',
    'windowStart',
    'windowEnd',
    'source',
    'top',
    'sort',
    'minSpan',
    'distinctDays',
    'totalTokens',
    'spanHoursMin',
    'spanHoursMax',
    'spanHoursMean',
    'spanHoursMedian',
    'spanHoursP25',
    'spanHoursP75',
    'dutyCycleMin',
    'dutyCycleMax',
    'dutyCycleMean',
    'dutyCycleMedian',
    'dutyCycleP25',
    'dutyCycleP75',
    'droppedInvalidHourStart',
    'droppedZeroTokens',
    'droppedSourceFilter',
    'droppedShortSpanDays',
    'droppedTopDays',
    'days',
  ]);
  for (const k of expectedKeys) {
    assert.ok(k in r, `missing top-level key: ${k}`);
  }
  // Per-day row shape
  const rowKeys = new Set([
    'day',
    'firstHour',
    'lastHour',
    'spanHours',
    'activeBuckets',
    'dutyCycle',
    'tokensOnDay',
  ]);
  for (const k of rowKeys) {
    assert.ok(k in r.days[0]!, `missing day row key: ${k}`);
  }
});
