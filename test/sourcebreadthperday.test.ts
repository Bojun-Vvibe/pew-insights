import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceBreadthPerDay } from '../src/sourcebreadthperday.js';
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

test('source-breadth-per-day: rejects bad since/until', () => {
  assert.throws(() => buildSourceBreadthPerDay([], { since: 'not-a-date' }));
  assert.throws(() => buildSourceBreadthPerDay([], { until: 'nope' }));
});

test('source-breadth-per-day: rejects bad top', () => {
  assert.throws(() => buildSourceBreadthPerDay([], { top: -1 }));
  assert.throws(() => buildSourceBreadthPerDay([], { top: 1.5 }));
});

test('source-breadth-per-day: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceBreadthPerDay([], { sort: 'bogus' as 'day' }),
  );
});

// ---- empty / drops --------------------------------------------------------

test('source-breadth-per-day: empty queue -> zero days, null stats', () => {
  const r = buildSourceBreadthPerDay([], { generatedAt: GEN });
  assert.equal(r.distinctDays, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sourceCountMin, null);
  assert.equal(r.sourceCountMax, null);
  assert.equal(r.sourceCountMean, null);
  assert.equal(r.sourceCountMedian, null);
  assert.equal(r.sourceCountP25, null);
  assert.equal(r.sourceCountP75, null);
  assert.equal(r.singleSourceDays, 0);
  assert.equal(r.multiSourceDays, 0);
  assert.equal(r.multiSourceShare, 0);
  assert.equal(r.days.length, 0);
  assert.equal(r.generatedAt, GEN);
});

test('source-breadth-per-day: counts dropped invalid hour_start, zero-tokens, source filter, empty source', () => {
  const r = buildSourceBreadthPerDay(
    [
      ql('not-a-date'),
      ql('2026-04-20T08:00:00Z', { total_tokens: 0 }),
      ql('2026-04-20T08:00:00Z', { total_tokens: -5 }),
      ql('2026-04-20T08:00:00Z', { source: 'claude-code' }),
      ql('2026-04-20T09:00:00Z', { source: 'codex' }),
      ql('2026-04-20T10:00:00Z', { source: '' }),
    ],
    { source: 'codex', generatedAt: GEN },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.droppedSourceFilter, 2); // claude-code and empty (filter applied first)
  // src is empty string. Filter rejects it (since src !== 'codex'),
  // so it lands in droppedSourceFilter, NOT droppedEmptySource.
  assert.equal(r.droppedEmptySource, 0);
  assert.equal(r.distinctDays, 1);
  assert.equal(r.days[0]!.sourceCount, 1);
  assert.equal(r.days[0]!.sources, 'codex');
});

test('source-breadth-per-day: empty source dropped when no source filter', () => {
  const r = buildSourceBreadthPerDay(
    [
      ql('2026-04-20T08:00:00Z', { source: 'codex' }),
      ql('2026-04-20T09:00:00Z', { source: '' }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedEmptySource, 1);
  assert.equal(r.droppedSourceFilter, 0);
  assert.equal(r.distinctDays, 1);
  assert.equal(r.days[0]!.sourceCount, 1);
});

// ---- core math ------------------------------------------------------------

test('source-breadth-per-day: distinct sources per day, sources sorted lex', () => {
  const r = buildSourceBreadthPerDay(
    [
      ql('2026-04-20T08:00:00Z', { source: 'codex' }),
      ql('2026-04-20T09:00:00Z', { source: 'claude-code' }),
      ql('2026-04-20T10:00:00Z', { source: 'codex' }), // dup
      ql('2026-04-20T14:00:00Z', { source: 'pew' }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.distinctDays, 1);
  const d = r.days[0]!;
  assert.equal(d.sourceCount, 3);
  // Lex asc: 'claude-code' < 'codex' < 'pew'
  assert.equal(d.sources, 'claude-code,codex,pew');
  assert.equal(d.bucketsOnDay, 4);
  assert.equal(d.tokensOnDay, 800);
});

test('source-breadth-per-day: per-day independence, single vs multi counters', () => {
  const r = buildSourceBreadthPerDay(
    [
      // day 1: single-source
      ql('2026-04-18T08:00:00Z', { source: 'codex' }),
      ql('2026-04-18T09:00:00Z', { source: 'codex' }),
      // day 2: multi-source (2)
      ql('2026-04-19T08:00:00Z', { source: 'codex' }),
      ql('2026-04-19T09:00:00Z', { source: 'claude-code' }),
      // day 3: multi-source (3)
      ql('2026-04-20T08:00:00Z', { source: 'codex' }),
      ql('2026-04-20T09:00:00Z', { source: 'claude-code' }),
      ql('2026-04-20T10:00:00Z', { source: 'pew' }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.distinctDays, 3);
  assert.equal(r.singleSourceDays, 1);
  assert.equal(r.multiSourceDays, 2);
  assert.ok(Math.abs(r.multiSourceShare - 2 / 3) < 1e-9);
  assert.equal(r.sourceCountMin, 1);
  assert.equal(r.sourceCountMax, 3);
  assert.ok(Math.abs(r.sourceCountMean! - 2) < 1e-9);
  assert.equal(r.sourceCountMedian, 2);
});

test('source-breadth-per-day: distribution stats over odd-N population', () => {
  // 5 days with sourceCounts [1, 2, 2, 3, 4]
  const lines: QueueLine[] = [];
  // day 1 -> 1 source
  lines.push(ql('2026-04-15T08:00:00Z', { source: 's1' }));
  // day 2 -> 2 sources
  lines.push(ql('2026-04-16T08:00:00Z', { source: 's1' }));
  lines.push(ql('2026-04-16T09:00:00Z', { source: 's2' }));
  // day 3 -> 2 sources
  lines.push(ql('2026-04-17T08:00:00Z', { source: 's1' }));
  lines.push(ql('2026-04-17T09:00:00Z', { source: 's3' }));
  // day 4 -> 3 sources
  lines.push(ql('2026-04-18T08:00:00Z', { source: 's1' }));
  lines.push(ql('2026-04-18T09:00:00Z', { source: 's2' }));
  lines.push(ql('2026-04-18T10:00:00Z', { source: 's3' }));
  // day 5 -> 4 sources
  lines.push(ql('2026-04-19T08:00:00Z', { source: 's1' }));
  lines.push(ql('2026-04-19T09:00:00Z', { source: 's2' }));
  lines.push(ql('2026-04-19T10:00:00Z', { source: 's3' }));
  lines.push(ql('2026-04-19T11:00:00Z', { source: 's4' }));
  const r = buildSourceBreadthPerDay(lines, { generatedAt: GEN });
  assert.equal(r.distinctDays, 5);
  assert.equal(r.sourceCountMin, 1);
  assert.equal(r.sourceCountMax, 4);
  assert.ok(Math.abs(r.sourceCountMean! - 12 / 5) < 1e-9);
  assert.equal(r.sourceCountMedian, 2);
  // p25 of [1,2,2,3,4] linear-interp -> idx=1 -> 2
  assert.equal(r.sourceCountP25, 2);
  // p75 -> idx=3 -> 3
  assert.equal(r.sourceCountP75, 3);
});

// ---- sort -----------------------------------------------------------------

test('source-breadth-per-day: default sort = day desc', () => {
  const r = buildSourceBreadthPerDay(
    [
      ql('2026-04-15T08:00:00Z', { source: 's1' }),
      ql('2026-04-20T08:00:00Z', { source: 's1' }),
      ql('2026-04-17T08:00:00Z', { source: 's1' }),
    ],
    { generatedAt: GEN },
  );
  assert.deepEqual(
    r.days.map((d) => d.day),
    ['2026-04-20', '2026-04-17', '2026-04-15'],
  );
});

test('source-breadth-per-day: sort=sources desc with day-desc tiebreak', () => {
  const r = buildSourceBreadthPerDay(
    [
      // day 1: 1 source
      ql('2026-04-15T08:00:00Z', { source: 's1' }),
      // day 2: 2 sources
      ql('2026-04-16T08:00:00Z', { source: 's1' }),
      ql('2026-04-16T09:00:00Z', { source: 's2' }),
      // day 3: 2 sources (ties day 2 on count, newer day wins)
      ql('2026-04-17T08:00:00Z', { source: 's1' }),
      ql('2026-04-17T09:00:00Z', { source: 's2' }),
    ],
    { sort: 'sources', generatedAt: GEN },
  );
  assert.deepEqual(
    r.days.map((d) => d.day),
    ['2026-04-17', '2026-04-16', '2026-04-15'],
  );
});

test('source-breadth-per-day: sort=tokens desc, sort=buckets desc', () => {
  const lines: QueueLine[] = [
    // day 1: 1 bucket, 1000 tokens
    ql('2026-04-15T08:00:00Z', { source: 's1', total_tokens: 1000 }),
    // day 2: 2 buckets, 200 tokens
    ql('2026-04-16T08:00:00Z', { source: 's1', total_tokens: 100 }),
    ql('2026-04-16T09:00:00Z', { source: 's1', total_tokens: 100 }),
    // day 3: 3 buckets, 300 tokens
    ql('2026-04-17T08:00:00Z', { source: 's1', total_tokens: 100 }),
    ql('2026-04-17T09:00:00Z', { source: 's1', total_tokens: 100 }),
    ql('2026-04-17T10:00:00Z', { source: 's1', total_tokens: 100 }),
  ];
  const byTokens = buildSourceBreadthPerDay(lines, { sort: 'tokens', generatedAt: GEN });
  assert.deepEqual(byTokens.days.map((d) => d.day), ['2026-04-15', '2026-04-17', '2026-04-16']);
  const byBuckets = buildSourceBreadthPerDay(lines, { sort: 'buckets', generatedAt: GEN });
  assert.deepEqual(byBuckets.days.map((d) => d.day), ['2026-04-17', '2026-04-16', '2026-04-15']);
});

// ---- top cap --------------------------------------------------------------

test('source-breadth-per-day: --top caps days[] but summary stats reflect full population', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 5; d++) {
    const day = `2026-04-${String(10 + d).padStart(2, '0')}`;
    lines.push(ql(`${day}T08:00:00Z`, { source: 's1' }));
    if (d >= 3) lines.push(ql(`${day}T09:00:00Z`, { source: 's2' }));
  }
  const r = buildSourceBreadthPerDay(lines, { top: 2, generatedAt: GEN });
  assert.equal(r.distinctDays, 5);
  assert.equal(r.days.length, 2);
  assert.equal(r.droppedTopDays, 3);
  // summary aggregated across all 5 days: counts [1,1,2,2,2]
  assert.equal(r.sourceCountMin, 1);
  assert.equal(r.sourceCountMax, 2);
  assert.equal(r.singleSourceDays, 2);
  assert.equal(r.multiSourceDays, 3);
});

// ---- window filter --------------------------------------------------------

test('source-breadth-per-day: since/until window filtering', () => {
  const r = buildSourceBreadthPerDay(
    [
      ql('2026-04-10T08:00:00Z', { source: 's1' }),
      ql('2026-04-15T08:00:00Z', { source: 's1' }),
      ql('2026-04-20T08:00:00Z', { source: 's1' }),
    ],
    { since: '2026-04-12T00:00:00Z', until: '2026-04-18T00:00:00Z', generatedAt: GEN },
  );
  assert.equal(r.distinctDays, 1);
  assert.equal(r.days[0]!.day, '2026-04-15');
  assert.equal(r.windowStart, '2026-04-12T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-18T00:00:00Z');
});

test('source-breadth-per-day: source filter degenerates sourceCount to 1', () => {
  const r = buildSourceBreadthPerDay(
    [
      ql('2026-04-15T08:00:00Z', { source: 'codex' }),
      ql('2026-04-15T09:00:00Z', { source: 'claude-code' }),
      ql('2026-04-16T08:00:00Z', { source: 'codex' }),
    ],
    { source: 'codex', generatedAt: GEN },
  );
  assert.equal(r.distinctDays, 2);
  for (const d of r.days) {
    assert.equal(d.sourceCount, 1);
    assert.equal(d.sources, 'codex');
  }
  assert.equal(r.singleSourceDays, 2);
  assert.equal(r.multiSourceDays, 0);
  assert.equal(r.source, 'codex');
});

// ---- --min-sources floor (refinement) -------------------------------------

test('source-breadth-per-day: rejects bad minSources', () => {
  assert.throws(() => buildSourceBreadthPerDay([], { minSources: -1 }));
  assert.throws(() => buildSourceBreadthPerDay([], { minSources: 1.5 }));
});

test('source-breadth-per-day: --min-sources filters sub-floor days from stats AND days[], totalTokens reflects post-floor', () => {
  const lines: QueueLine[] = [
    // day 1: 1 source, 100 tokens
    ql('2026-04-15T08:00:00Z', { source: 's1', total_tokens: 100 }),
    // day 2: 1 source, 50 tokens
    ql('2026-04-16T08:00:00Z', { source: 's1', total_tokens: 50 }),
    // day 3: 2 sources, 200 + 200 = 400 tokens
    ql('2026-04-17T08:00:00Z', { source: 's1', total_tokens: 200 }),
    ql('2026-04-17T09:00:00Z', { source: 's2', total_tokens: 200 }),
    // day 4: 3 sources, 300 + 300 + 300 = 900 tokens
    ql('2026-04-18T08:00:00Z', { source: 's1', total_tokens: 300 }),
    ql('2026-04-18T09:00:00Z', { source: 's2', total_tokens: 300 }),
    ql('2026-04-18T10:00:00Z', { source: 's3', total_tokens: 300 }),
  ];
  const r = buildSourceBreadthPerDay(lines, { minSources: 2, generatedAt: GEN });
  assert.equal(r.minSources, 2);
  assert.equal(r.droppedBelowMinSources, 2); // day 1 + day 2
  assert.equal(r.distinctDays, 2); // post-floor population
  assert.equal(r.totalTokens, 1300); // 400 + 900, post-floor
  assert.equal(r.sourceCountMin, 2);
  assert.equal(r.sourceCountMax, 3);
  // singleSourceDays counts inside post-floor population only
  assert.equal(r.singleSourceDays, 0);
  assert.equal(r.multiSourceDays, 2);
  assert.equal(r.multiSourceShare, 1);
  // days[] also post-floor
  assert.equal(r.days.length, 2);
  for (const d of r.days) {
    assert.ok(d.sourceCount >= 2);
  }
});

test('source-breadth-per-day: --min-sources=0 is no-op (default)', () => {
  const lines: QueueLine[] = [
    ql('2026-04-15T08:00:00Z', { source: 's1' }),
    ql('2026-04-16T08:00:00Z', { source: 's1' }),
    ql('2026-04-16T09:00:00Z', { source: 's2' }),
  ];
  const r0 = buildSourceBreadthPerDay(lines, { generatedAt: GEN });
  const rExplicit = buildSourceBreadthPerDay(lines, { minSources: 0, generatedAt: GEN });
  assert.equal(r0.distinctDays, rExplicit.distinctDays);
  assert.equal(r0.droppedBelowMinSources, 0);
  assert.equal(rExplicit.droppedBelowMinSources, 0);
  assert.equal(r0.totalTokens, rExplicit.totalTokens);
});

test('source-breadth-per-day: --min-sources combines correctly with --top (top caps post-floor population)', () => {
  // 5 days: counts [1, 1, 2, 3, 4] (newest -> oldest day1 is oldest)
  const lines: QueueLine[] = [];
  // day 1: 1 source
  lines.push(ql('2026-04-11T08:00:00Z', { source: 's1' }));
  // day 2: 1 source
  lines.push(ql('2026-04-12T08:00:00Z', { source: 's1' }));
  // day 3: 2 sources
  lines.push(ql('2026-04-13T08:00:00Z', { source: 's1' }));
  lines.push(ql('2026-04-13T09:00:00Z', { source: 's2' }));
  // day 4: 3 sources
  lines.push(ql('2026-04-14T08:00:00Z', { source: 's1' }));
  lines.push(ql('2026-04-14T09:00:00Z', { source: 's2' }));
  lines.push(ql('2026-04-14T10:00:00Z', { source: 's3' }));
  // day 5: 4 sources
  lines.push(ql('2026-04-15T08:00:00Z', { source: 's1' }));
  lines.push(ql('2026-04-15T09:00:00Z', { source: 's2' }));
  lines.push(ql('2026-04-15T10:00:00Z', { source: 's3' }));
  lines.push(ql('2026-04-15T11:00:00Z', { source: 's4' }));
  const r = buildSourceBreadthPerDay(lines, { minSources: 2, top: 2, generatedAt: GEN });
  assert.equal(r.droppedBelowMinSources, 2); // day 1 + day 2
  assert.equal(r.distinctDays, 3); // post-floor: days 3, 4, 5
  assert.equal(r.days.length, 2); // top cap
  assert.equal(r.droppedTopDays, 1);
  // default sort = day desc => newest first => 2026-04-15, 2026-04-14
  assert.deepEqual(r.days.map((d) => d.day), ['2026-04-15', '2026-04-14']);
});
