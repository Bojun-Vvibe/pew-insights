import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildFirstBucketOfDay } from '../src/firstbucketofday.js';
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

test('first-bucket-of-day: rejects bad since/until', () => {
  assert.throws(() => buildFirstBucketOfDay([], { since: 'not-a-date' }));
  assert.throws(() => buildFirstBucketOfDay([], { until: 'nope' }));
});

test('first-bucket-of-day: rejects bad top', () => {
  assert.throws(() => buildFirstBucketOfDay([], { top: -1 }));
  assert.throws(() => buildFirstBucketOfDay([], { top: 1.5 }));
});

// ---- empty / drops --------------------------------------------------------

test('first-bucket-of-day: empty queue -> zero days, null stats, zero counts', () => {
  const r = buildFirstBucketOfDay([], { generatedAt: GEN });
  assert.equal(r.distinctDays, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.firstHourMin, null);
  assert.equal(r.firstHourMax, null);
  assert.equal(r.firstHourMean, null);
  assert.equal(r.firstHourMedian, null);
  assert.equal(r.firstHourP25, null);
  assert.equal(r.firstHourP75, null);
  assert.equal(r.firstHourMode, null);
  assert.equal(r.firstHourModeCount, 0);
  assert.equal(r.firstHourModeShare, 0);
  assert.equal(r.days.length, 0);
});

test('first-bucket-of-day: counts dropped invalid hour_start, zero-tokens, source filter', () => {
  const r = buildFirstBucketOfDay(
    [
      ql('not-a-date', {}),
      ql('2026-04-20T08:00:00Z', { total_tokens: 0 }),
      ql('2026-04-20T08:00:00Z', { total_tokens: -5 }),
      ql('2026-04-20T08:00:00Z', { source: 'claude-code' }),
      ql('2026-04-20T09:00:00Z', { source: 'codex' }),
    ],
    { generatedAt: GEN, source: 'codex' },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.distinctDays, 1);
  assert.equal(r.days[0]!.firstHour, 9);
  assert.equal(r.source, 'codex');
});

// ---- core: firstBucket / firstHour ---------------------------------------

test('first-bucket-of-day: per-day firstBucket is the earliest active hour_start, firstHour is its UTC hour', () => {
  const r = buildFirstBucketOfDay(
    [
      // day 1: buckets at 14:00 and 09:00 -> first = 09:00
      ql('2026-04-20T14:00:00Z', { total_tokens: 100 }),
      ql('2026-04-20T09:00:00Z', { total_tokens: 100 }),
      ql('2026-04-20T18:00:00Z', { total_tokens: 100 }),
      // day 2: only 23:00
      ql('2026-04-21T23:00:00Z', { total_tokens: 50 }),
      // day 3: 00:00 and 05:00 -> first = 00:00
      ql('2026-04-22T05:00:00Z', { total_tokens: 200 }),
      ql('2026-04-22T00:00:00Z', { total_tokens: 100 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.distinctDays, 3);
  assert.equal(r.totalTokens, 100 + 100 + 100 + 50 + 200 + 100);
  // sorted day desc: 22, 21, 20
  assert.equal(r.days[0]!.day, '2026-04-22');
  assert.equal(r.days[0]!.firstBucket, '2026-04-22T00:00:00.000Z');
  assert.equal(r.days[0]!.firstHour, 0);
  assert.equal(r.days[0]!.bucketsOnDay, 2);
  assert.equal(r.days[0]!.tokensOnDay, 300);
  assert.equal(r.days[1]!.day, '2026-04-21');
  assert.equal(r.days[1]!.firstHour, 23);
  assert.equal(r.days[1]!.bucketsOnDay, 1);
  assert.equal(r.days[2]!.day, '2026-04-20');
  assert.equal(r.days[2]!.firstHour, 9);
  assert.equal(r.days[2]!.bucketsOnDay, 3);
});

// ---- summary stats --------------------------------------------------------

test('first-bucket-of-day: firstHour summary stats — min/max/mean/median/p25/p75/mode (lowest-hour tiebreak)', () => {
  const r = buildFirstBucketOfDay(
    [
      // 5 days, firstHours: 9, 9, 10, 14, 23
      ql('2026-04-20T09:00:00Z'),
      ql('2026-04-21T09:00:00Z'),
      ql('2026-04-22T10:00:00Z'),
      ql('2026-04-23T14:00:00Z'),
      ql('2026-04-24T23:00:00Z'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.distinctDays, 5);
  assert.equal(r.firstHourMin, 9);
  assert.equal(r.firstHourMax, 23);
  assert.equal(r.firstHourMean, (9 + 9 + 10 + 14 + 23) / 5);
  assert.equal(r.firstHourMedian, 10);
  // sorted: [9,9,10,14,23]; p25 idx = 0.25*4 = 1.0 -> 9; p75 idx = 3.0 -> 14
  assert.equal(r.firstHourP25, 9);
  assert.equal(r.firstHourP75, 14);
  // mode: 9 appears twice
  assert.equal(r.firstHourMode, 9);
  assert.equal(r.firstHourModeCount, 2);
  assert.equal(r.firstHourModeShare, 2 / 5);
});

test('first-bucket-of-day: mode tiebreak — lowest hour wins when counts tie', () => {
  const r = buildFirstBucketOfDay(
    [
      ql('2026-04-20T15:00:00Z'),
      ql('2026-04-21T15:00:00Z'),
      ql('2026-04-22T08:00:00Z'),
      ql('2026-04-23T08:00:00Z'),
    ],
    { generatedAt: GEN },
  );
  // both 8 and 15 appear twice; 8 wins
  assert.equal(r.firstHourMode, 8);
  assert.equal(r.firstHourModeCount, 2);
  assert.equal(r.firstHourModeShare, 0.5);
});

test('first-bucket-of-day: single day -> min=max=mean=median=mode and share=1', () => {
  const r = buildFirstBucketOfDay(
    [ql('2026-04-20T07:00:00Z'), ql('2026-04-20T15:00:00Z')],
    { generatedAt: GEN },
  );
  assert.equal(r.distinctDays, 1);
  assert.equal(r.firstHourMin, 7);
  assert.equal(r.firstHourMax, 7);
  assert.equal(r.firstHourMean, 7);
  assert.equal(r.firstHourMedian, 7);
  assert.equal(r.firstHourP25, 7);
  assert.equal(r.firstHourP75, 7);
  assert.equal(r.firstHourMode, 7);
  assert.equal(r.firstHourModeCount, 1);
  assert.equal(r.firstHourModeShare, 1);
});

// ---- top cap --------------------------------------------------------------

test('first-bucket-of-day: top cap is display-only — summary stats reflect full population, droppedTopDays surfaces the rest', () => {
  const r = buildFirstBucketOfDay(
    [
      ql('2026-04-20T09:00:00Z'),
      ql('2026-04-21T10:00:00Z'),
      ql('2026-04-22T11:00:00Z'),
      ql('2026-04-23T12:00:00Z'),
      ql('2026-04-24T13:00:00Z'),
    ],
    { generatedAt: GEN, top: 2 },
  );
  assert.equal(r.distinctDays, 5);
  assert.equal(r.top, 2);
  assert.equal(r.days.length, 2);
  assert.equal(r.droppedTopDays, 3);
  // newest two days kept
  assert.equal(r.days[0]!.day, '2026-04-24');
  assert.equal(r.days[1]!.day, '2026-04-23');
  // summary stats use all 5 days
  assert.equal(r.firstHourMin, 9);
  assert.equal(r.firstHourMax, 13);
});

test('first-bucket-of-day: top default 0 = no cap and droppedTopDays is 0', () => {
  const r = buildFirstBucketOfDay(
    [ql('2026-04-20T09:00:00Z'), ql('2026-04-21T10:00:00Z')],
    { generatedAt: GEN },
  );
  assert.equal(r.top, 0);
  assert.equal(r.droppedTopDays, 0);
  assert.equal(r.days.length, 2);
});

// ---- since/until window ---------------------------------------------------

test('first-bucket-of-day: since/until window is inclusive lower / exclusive upper', () => {
  const r = buildFirstBucketOfDay(
    [
      ql('2026-04-19T09:00:00Z'),
      ql('2026-04-20T09:00:00Z'),
      ql('2026-04-21T09:00:00Z'),
      ql('2026-04-22T09:00:00Z'),
    ],
    {
      generatedAt: GEN,
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-22T00:00:00Z',
    },
  );
  // keeps 2026-04-20 and 2026-04-21
  assert.equal(r.distinctDays, 2);
  assert.equal(r.days.map((d) => d.day).sort().join(','), '2026-04-20,2026-04-21');
  assert.equal(r.windowStart, '2026-04-20T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-22T00:00:00Z');
});

// ---- determinism ----------------------------------------------------------

test('first-bucket-of-day: same input -> same output (pure builder)', () => {
  const data = [
    ql('2026-04-20T09:00:00Z'),
    ql('2026-04-20T14:00:00Z'),
    ql('2026-04-21T07:00:00Z'),
  ];
  const a = buildFirstBucketOfDay(data, { generatedAt: GEN });
  const b = buildFirstBucketOfDay(data, { generatedAt: GEN });
  assert.deepEqual(a, b);
});
