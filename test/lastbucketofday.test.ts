import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildLastBucketOfDay } from '../src/lastbucketofday.js';
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

test('last-bucket-of-day: rejects bad since/until', () => {
  assert.throws(() => buildLastBucketOfDay([], { since: 'not-a-date' }));
  assert.throws(() => buildLastBucketOfDay([], { until: 'nope' }));
});

test('last-bucket-of-day: rejects bad top', () => {
  assert.throws(() => buildLastBucketOfDay([], { top: -1 }));
  assert.throws(() => buildLastBucketOfDay([], { top: 1.5 }));
});

test('last-bucket-of-day: rejects bad sort', () => {
  assert.throws(() =>
    buildLastBucketOfDay([], { sort: 'nope' as unknown as 'day' }),
  );
});

// ---- empty / drops --------------------------------------------------------

test('last-bucket-of-day: empty queue -> zero days, null stats, zero counts', () => {
  const r = buildLastBucketOfDay([], { generatedAt: GEN });
  assert.equal(r.distinctDays, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.lastHourMin, null);
  assert.equal(r.lastHourMax, null);
  assert.equal(r.lastHourMean, null);
  assert.equal(r.lastHourMedian, null);
  assert.equal(r.lastHourP25, null);
  assert.equal(r.lastHourP75, null);
  assert.equal(r.lastHourMode, null);
  assert.equal(r.lastHourModeCount, 0);
  assert.equal(r.lastHourModeShare, 0);
  assert.equal(r.days.length, 0);
  assert.equal(r.sort, 'day');
  assert.equal(r.top, 0);
});

test('last-bucket-of-day: counts dropped invalid hour_start, zero-tokens, source filter', () => {
  const r = buildLastBucketOfDay(
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
  assert.equal(r.days[0]!.lastHour, 9);
  assert.equal(r.source, 'codex');
});

// ---- core: lastBucket / lastHour -----------------------------------------

test('last-bucket-of-day: per-day lastBucket is the latest active hour_start, lastHour is its UTC hour', () => {
  const r = buildLastBucketOfDay(
    [
      // day 1: buckets at 09, 14, 18 -> last = 18
      ql('2026-04-20T09:00:00Z', { total_tokens: 100 }),
      ql('2026-04-20T14:00:00Z', { total_tokens: 100 }),
      ql('2026-04-20T18:00:00Z', { total_tokens: 100 }),
      // day 2: only 23
      ql('2026-04-21T23:00:00Z', { total_tokens: 50 }),
    ],
    { generatedAt: GEN, sort: 'day' },
  );
  assert.equal(r.distinctDays, 2);
  assert.equal(r.totalTokens, 350);
  // sort day desc -> day 2 first
  assert.equal(r.days[0]!.day, '2026-04-21');
  assert.equal(r.days[0]!.lastHour, 23);
  assert.equal(r.days[0]!.lastBucket, '2026-04-21T23:00:00.000Z');
  assert.equal(r.days[1]!.day, '2026-04-20');
  assert.equal(r.days[1]!.lastHour, 18);
  assert.equal(r.days[1]!.lastBucket, '2026-04-20T18:00:00.000Z');
  assert.equal(r.days[1]!.bucketsOnDay, 3);
  assert.equal(r.days[1]!.tokensOnDay, 300);
});

test('last-bucket-of-day: a zero-token row at a later hour does not extend lastBucket', () => {
  const r = buildLastBucketOfDay(
    [
      ql('2026-04-20T09:00:00Z', { total_tokens: 100 }),
      ql('2026-04-20T18:00:00Z', { total_tokens: 100 }),
      ql('2026-04-20T22:00:00Z', { total_tokens: 0 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.distinctDays, 1);
  assert.equal(r.days[0]!.lastHour, 18);
});

// ---- summary stats --------------------------------------------------------

test('last-bucket-of-day: lastHour summary stats use full population', () => {
  // last hours across days: 17, 18, 19, 20, 21
  const r = buildLastBucketOfDay(
    [
      ql('2026-04-20T17:00:00Z'),
      ql('2026-04-21T18:00:00Z'),
      ql('2026-04-22T19:00:00Z'),
      ql('2026-04-23T20:00:00Z'),
      ql('2026-04-24T21:00:00Z'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.distinctDays, 5);
  assert.equal(r.lastHourMin, 17);
  assert.equal(r.lastHourMax, 21);
  assert.equal(r.lastHourMean, 19);
  assert.equal(r.lastHourMedian, 19);
  assert.equal(r.lastHourP25, 18);
  assert.equal(r.lastHourP75, 20);
});

test('last-bucket-of-day: mode tiebreak is HIGHEST hour (symmetric to first-bucket)', () => {
  // 18, 18, 22, 22 — both have count 2; mode should be 22
  const r = buildLastBucketOfDay(
    [
      ql('2026-04-20T18:00:00Z'),
      ql('2026-04-21T18:00:00Z'),
      ql('2026-04-22T22:00:00Z'),
      ql('2026-04-23T22:00:00Z'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.lastHourMode, 22);
  assert.equal(r.lastHourModeCount, 2);
  assert.equal(r.lastHourModeShare, 0.5);
});

// ---- top cap & sort -------------------------------------------------------

test('last-bucket-of-day: --top cap surfaces droppedTopDays; summary stats unchanged', () => {
  const r = buildLastBucketOfDay(
    [
      ql('2026-04-20T17:00:00Z'),
      ql('2026-04-21T18:00:00Z'),
      ql('2026-04-22T19:00:00Z'),
      ql('2026-04-23T20:00:00Z'),
      ql('2026-04-24T21:00:00Z'),
    ],
    { generatedAt: GEN, top: 2 },
  );
  assert.equal(r.distinctDays, 5);
  assert.equal(r.days.length, 2);
  assert.equal(r.droppedTopDays, 3);
  // summary still over full 5
  assert.equal(r.lastHourMin, 17);
  assert.equal(r.lastHourMax, 21);
  // sort 'day' desc -> latest two days kept
  assert.equal(r.days[0]!.day, '2026-04-24');
  assert.equal(r.days[1]!.day, '2026-04-23');
});

test('last-bucket-of-day: --sort last-hour orders by lastHour desc with day desc tiebreak', () => {
  const r = buildLastBucketOfDay(
    [
      ql('2026-04-20T22:00:00Z'),
      ql('2026-04-21T09:00:00Z'),
      ql('2026-04-22T22:00:00Z'),
      ql('2026-04-23T15:00:00Z'),
    ],
    { generatedAt: GEN, sort: 'last-hour' },
  );
  // last-hour desc -> 22, 22, 15, 09; tiebreak day desc -> 22 on 2026-04-22 first
  assert.equal(r.days[0]!.lastHour, 22);
  assert.equal(r.days[0]!.day, '2026-04-22');
  assert.equal(r.days[1]!.lastHour, 22);
  assert.equal(r.days[1]!.day, '2026-04-20');
  assert.equal(r.days[2]!.lastHour, 15);
  assert.equal(r.days[3]!.lastHour, 9);
});

test('last-bucket-of-day: --sort tokens orders by tokensOnDay desc', () => {
  const r = buildLastBucketOfDay(
    [
      ql('2026-04-20T17:00:00Z', { total_tokens: 50 }),
      ql('2026-04-21T18:00:00Z', { total_tokens: 500 }),
      ql('2026-04-22T19:00:00Z', { total_tokens: 200 }),
    ],
    { generatedAt: GEN, sort: 'tokens' },
  );
  assert.equal(r.days[0]!.day, '2026-04-21');
  assert.equal(r.days[1]!.day, '2026-04-22');
  assert.equal(r.days[2]!.day, '2026-04-20');
});

// ---- window ---------------------------------------------------------------

test('last-bucket-of-day: --since/--until window is inclusive/exclusive', () => {
  const r = buildLastBucketOfDay(
    [
      ql('2026-04-19T12:00:00Z'),
      ql('2026-04-20T12:00:00Z'),
      ql('2026-04-21T12:00:00Z'),
    ],
    {
      generatedAt: GEN,
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
    },
  );
  assert.equal(r.distinctDays, 1);
  assert.equal(r.days[0]!.day, '2026-04-20');
  assert.equal(r.windowStart, '2026-04-20T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-21T00:00:00Z');
});
