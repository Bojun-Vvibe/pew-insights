import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildInterarrivalTime,
  DEFAULT_INTERARRIVAL_EDGES_HOURS,
} from '../src/interarrivaltime.js';
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

// ---- option validation -----------------------------------------------------

test('interarrival-time: rejects bad top', () => {
  assert.throws(() => buildInterarrivalTime([], { top: -1 }));
  assert.throws(() => buildInterarrivalTime([], { top: 2.5 }));
});

test('interarrival-time: rejects bad sort key', () => {
  assert.throws(() =>
    buildInterarrivalTime([], { sort: 'bogus' as unknown as 'buckets' }),
  );
});

test('interarrival-time: rejects bad since/until', () => {
  assert.throws(() => buildInterarrivalTime([], { since: 'not-a-date' }));
  assert.throws(() => buildInterarrivalTime([], { until: 'nope' }));
});

// ---- empty / edge ----------------------------------------------------------

test('interarrival-time: empty queue returns zeros', () => {
  const r = buildInterarrivalTime([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalActiveBuckets, 0);
  assert.equal(r.totalGaps, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.sort, 'buckets');
});

test('interarrival-time: single bucket per source -> zero gaps', () => {
  const r = buildInterarrivalTime(
    [ql('2026-04-20T01:00:00Z', { source: 'codex' })],
    { generatedAt: GEN },
  );
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalActiveBuckets, 1);
  assert.equal(r.totalGaps, 0);
  assert.equal(r.sources[0].activeBuckets, 1);
  assert.equal(r.sources[0].gapCount, 0);
  assert.equal(r.sources[0].minHours, 0);
  assert.equal(r.sources[0].p50Hours, 0);
  assert.equal(r.sources[0].p90Hours, 0);
});

test('interarrival-time: drops zero-token rows and bad hour_start', () => {
  const r = buildInterarrivalTime(
    [
      ql('2026-04-20T01:00:00Z', { total_tokens: 0 }),
      ql('not-a-date', { total_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', { total_tokens: 100 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalActiveBuckets, 1);
});

// ---- gap semantics ---------------------------------------------------------

test('interarrival-time: consecutive hours yield 1h gaps; duplicates are deduped', () => {
  const r = buildInterarrivalTime(
    [
      ql('2026-04-20T01:00:00Z'),
      ql('2026-04-20T01:00:00Z'), // duplicate hour bucket
      ql('2026-04-20T02:00:00Z'),
      ql('2026-04-20T03:00:00Z'),
    ],
    { generatedAt: GEN },
  );
  const s = r.sources[0];
  assert.equal(s.activeBuckets, 3);
  assert.equal(s.gapCount, 2);
  assert.equal(s.minHours, 1);
  assert.equal(s.maxHours, 1);
  assert.equal(s.sumHours, 2);
  assert.equal(s.meanHours, 1);
  assert.equal(s.p50Hours, 1);
  assert.equal(s.p90Hours, 1);
});

test('interarrival-time: large gap between hours bucketed correctly', () => {
  const r = buildInterarrivalTime(
    [
      ql('2026-04-20T01:00:00Z'),
      ql('2026-04-21T01:00:00Z'), // 24h later
    ],
    { generatedAt: GEN },
  );
  const s = r.sources[0];
  assert.equal(s.gapCount, 1);
  assert.equal(s.minHours, 24);
  assert.equal(s.maxHours, 24);
  // 24h falls into [24, 48) bucket
  const b = s.histogram.find((b) => b.loHours === 24 && b.hiHours === 48);
  assert.ok(b);
  assert.equal(b.count, 1);
});

test('interarrival-time: percentiles via nearest-rank', () => {
  // Gaps: 1, 1, 2, 2, 5, 10, 10, 10, 100, 200
  // 10 distinct hours separated by those increments. Build accordingly.
  const starts = [0, 1, 2, 4, 6, 11, 21, 31, 41, 141, 341];
  const queue = starts.map((h) =>
    ql(new Date(Date.UTC(2026, 0, 1, h, 0, 0)).toISOString()),
  );
  const r = buildInterarrivalTime(queue, { generatedAt: GEN });
  const s = r.sources[0];
  assert.equal(s.gapCount, 10);
  // sorted gaps: 1,1,2,2,5,10,10,10,100,200
  // p50 nearest-rank: ceil(0.5*10)=5 -> idx4 -> 5
  assert.equal(s.p50Hours, 5);
  // p90: ceil(0.9*10)=9 -> idx8 -> 100
  assert.equal(s.p90Hours, 100);
  assert.equal(s.minHours, 1);
  assert.equal(s.maxHours, 200);
});

// ---- multi-source ----------------------------------------------------------

test('interarrival-time: per-source isolation', () => {
  const r = buildInterarrivalTime(
    [
      ql('2026-04-20T01:00:00Z', { source: 'codex' }),
      ql('2026-04-20T05:00:00Z', { source: 'codex' }),
      ql('2026-04-20T01:00:00Z', { source: 'claude' }),
      ql('2026-04-20T02:00:00Z', { source: 'claude' }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.totalSources, 2);
  const codex = r.sources.find((s) => s.source === 'codex');
  const claude = r.sources.find((s) => s.source === 'claude');
  assert.ok(codex && claude);
  assert.equal(codex.gapCount, 1);
  assert.equal(codex.minHours, 4);
  assert.equal(claude.gapCount, 1);
  assert.equal(claude.minHours, 1);
});

test('interarrival-time: source filter restricts and surfaces drops', () => {
  const r = buildInterarrivalTime(
    [
      ql('2026-04-20T01:00:00Z', { source: 'codex' }),
      ql('2026-04-20T02:00:00Z', { source: 'codex' }),
      ql('2026-04-20T01:00:00Z', { source: 'claude' }),
    ],
    { generatedAt: GEN, source: 'codex' },
  );
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.sources[0].source, 'codex');
});

// ---- sorting + top ---------------------------------------------------------

test('interarrival-time: sort=buckets is default and ties break on source asc', () => {
  const queue: QueueLine[] = [];
  // codex: 3 buckets, claude: 5 buckets, gpt: 5 buckets (tie)
  for (const h of [0, 1, 2]) {
    queue.push(ql(new Date(Date.UTC(2026, 0, 1, h)).toISOString(), { source: 'codex' }));
  }
  for (const h of [0, 1, 2, 3, 4]) {
    queue.push(ql(new Date(Date.UTC(2026, 0, 1, h)).toISOString(), { source: 'claude' }));
    queue.push(ql(new Date(Date.UTC(2026, 0, 1, h)).toISOString(), { source: 'gpt' }));
  }
  const r = buildInterarrivalTime(queue, { generatedAt: GEN });
  assert.equal(r.sources[0].source, 'claude'); // tied with gpt, lex first
  assert.equal(r.sources[1].source, 'gpt');
  assert.equal(r.sources[2].source, 'codex');
});

test('interarrival-time: --top truncates and surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', { source: 'a' }),
    ql('2026-04-20T02:00:00Z', { source: 'a' }),
    ql('2026-04-20T01:00:00Z', { source: 'b' }),
    ql('2026-04-20T01:00:00Z', { source: 'c' }),
  ];
  const r = buildInterarrivalTime(queue, { generatedAt: GEN, top: 1 });
  assert.equal(r.totalSources, 3);
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
  assert.equal(r.sources[0].source, 'a');
});

test('interarrival-time: histogram edges constant and complete', () => {
  const r = buildInterarrivalTime([], { generatedAt: GEN });
  assert.deepEqual(r.histogramEdgesHours, DEFAULT_INTERARRIVAL_EDGES_HOURS);
  assert.equal(
    r.histogramEdgesHours[r.histogramEdgesHours.length - 1],
    Number.POSITIVE_INFINITY,
  );
});

test('interarrival-time: window filter applied before bucket dedup', () => {
  const queue: QueueLine[] = [
    ql('2026-04-19T23:00:00Z'), // before window
    ql('2026-04-20T01:00:00Z'),
    ql('2026-04-20T03:00:00Z'),
    ql('2026-04-21T00:00:00Z'), // at-or-after until -> excluded
  ];
  const r = buildInterarrivalTime(queue, {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-21T00:00:00Z',
  });
  const s = r.sources[0];
  assert.equal(s.activeBuckets, 2);
  assert.equal(s.gapCount, 1);
  assert.equal(s.minHours, 2);
});
