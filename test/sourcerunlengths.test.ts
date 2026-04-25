import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRunLengths } from '../src/sourcerunlengths.js';
import type { SessionLine } from '../src/types.js';

function sl(
  startedAt: string,
  source: string,
  opts: Partial<SessionLine> = {},
): SessionLine {
  return {
    session_key: opts.session_key ?? `s-${startedAt}-${source}`,
    source,
    kind: opts.kind ?? 'human',
    started_at: startedAt,
    last_message_at: opts.last_message_at ?? startedAt,
    duration_seconds: opts.duration_seconds ?? 60,
    user_messages: opts.user_messages ?? 1,
    assistant_messages: opts.assistant_messages ?? 1,
    total_messages: opts.total_messages ?? 2,
    project_ref: opts.project_ref ?? '0000000000000000',
    model: opts.model ?? 'm1',
    snapshot_at: opts.snapshot_at ?? startedAt,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

test('source-run-lengths: empty input → zero rows, zero runs', () => {
  const r = buildSourceRunLengths([], { generatedAt: GEN });
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.totalRuns, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.globalMaxRunLength, 0);
  assert.equal(r.globalMeanRunLength, 0);
  assert.equal(r.globalSingleSessionRunShare, 0);
});

test('source-run-lengths: rejects bad minRuns', () => {
  assert.throws(() => buildSourceRunLengths([], { minRuns: 0 }));
  assert.throws(() => buildSourceRunLengths([], { minRuns: -1 }));
  assert.throws(() => buildSourceRunLengths([], { minRuns: Number.NaN }));
});

test('source-run-lengths: rejects bad top', () => {
  assert.throws(() => buildSourceRunLengths([], { top: 0 }));
  assert.throws(() => buildSourceRunLengths([], { top: -1 }));
  assert.throws(() => buildSourceRunLengths([], { top: 1.5 }));
});

test('source-run-lengths: rejects bad since/until', () => {
  assert.throws(() => buildSourceRunLengths([], { since: 'not-iso' }));
  assert.throws(() => buildSourceRunLengths([], { until: 'not-iso' }));
});

test('source-run-lengths: a single switch produces two runs of length 1', () => {
  const r = buildSourceRunLengths(
    [sl('2026-04-20T10:00:00Z', 'a'), sl('2026-04-20T10:01:00Z', 'b')],
    { generatedAt: GEN },
  );
  assert.equal(r.totalRuns, 2);
  assert.equal(r.globalMaxRunLength, 1);
  assert.equal(r.globalSingleSessionRunShare, 1);
});

test('source-run-lengths: contiguous same-source sessions form one run', () => {
  const r = buildSourceRunLengths(
    [
      sl('2026-04-20T10:00:00Z', 'a'),
      sl('2026-04-20T10:01:00Z', 'a'),
      sl('2026-04-20T10:02:00Z', 'a'),
      sl('2026-04-20T10:03:00Z', 'b'),
      sl('2026-04-20T10:04:00Z', 'a'),
    ],
    { generatedAt: GEN },
  );
  // Runs: [a, a, a] [b] [a] → 3 runs total
  assert.equal(r.totalRuns, 3);
  assert.equal(r.globalMaxRunLength, 3);
  // a has runs of length 3 and 1; b has 1
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.runCount, 2);
  assert.equal(a.maxRunLength, 3);
  assert.equal(a.sessionCount, 4);
  assert.equal(a.meanRunLength, 2);
  // 1 of 4 a-sessions sits in a length-1 run
  assert.equal(a.singleSessionRunShare, 0.25);
  const b = r.sources.find((s) => s.source === 'b')!;
  assert.equal(b.runCount, 1);
  assert.equal(b.maxRunLength, 1);
  assert.equal(b.singleSessionRunShare, 1);
});

test('source-run-lengths: input order does not matter — sort by started_at', () => {
  const r = buildSourceRunLengths(
    [
      sl('2026-04-20T10:03:00Z', 'b'),
      sl('2026-04-20T10:00:00Z', 'a'),
      sl('2026-04-20T10:02:00Z', 'a'),
      sl('2026-04-20T10:01:00Z', 'a'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.totalRuns, 2); // [a,a,a] [b]
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.maxRunLength, 3);
});

test('source-run-lengths: stable tie-break on session_key when started_at ties', () => {
  // Same started_at; lexically smaller session_key comes first.
  const r = buildSourceRunLengths(
    [
      sl('2026-04-20T10:00:00Z', 'b', { session_key: 'k-2' }),
      sl('2026-04-20T10:00:00Z', 'a', { session_key: 'k-1' }),
    ],
    { generatedAt: GEN },
  );
  // a first, then b → 2 runs of length 1
  assert.equal(r.totalRuns, 2);
});

test('source-run-lengths: window filters by started_at (inclusive since, exclusive until)', () => {
  const r = buildSourceRunLengths(
    [
      sl('2026-04-19T23:59:59Z', 'a'),
      sl('2026-04-20T00:00:00Z', 'a'),
      sl('2026-04-20T12:00:00Z', 'b'),
      sl('2026-04-21T00:00:00Z', 'a'),
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
      generatedAt: GEN,
    },
  );
  // window keeps the 2nd and 3rd → [a] [b] → 2 runs
  assert.equal(r.consideredSessions, 2);
  assert.equal(r.totalRuns, 2);
});

test('source-run-lengths: invalid started_at counted in droppedInvalidStart', () => {
  const r = buildSourceRunLengths(
    [
      sl('not-iso', 'a'),
      sl('2026-04-20T10:00:00Z', 'a'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedInvalidStart, 1);
  assert.equal(r.consideredSessions, 1);
});

test('source-run-lengths: empty source counted in droppedEmptySource', () => {
  const r = buildSourceRunLengths(
    [
      sl('2026-04-20T10:00:00Z', ''),
      sl('2026-04-20T10:01:00Z', 'a'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedEmptySource, 1);
  assert.equal(r.consideredSessions, 1);
});

test('source-run-lengths: minRuns floor drops sparse sources', () => {
  const r = buildSourceRunLengths(
    [
      sl('2026-04-20T10:00:00Z', 'a'),
      sl('2026-04-20T10:01:00Z', 'b'),
      sl('2026-04-20T10:02:00Z', 'a'),
      sl('2026-04-20T10:03:00Z', 'b'),
      sl('2026-04-20T10:04:00Z', 'c'), // c has only 1 run
    ],
    { minRuns: 2, generatedAt: GEN },
  );
  assert.equal(r.droppedSparseSources, 1);
  assert.ok(r.sources.every((s) => s.source !== 'c'));
});

test('source-run-lengths: longestRunStartedAt points at first session of longest run', () => {
  const r = buildSourceRunLengths(
    [
      sl('2026-04-20T10:00:00Z', 'a'),
      sl('2026-04-20T10:01:00Z', 'b'),
      sl('2026-04-20T10:02:00Z', 'a'),
      sl('2026-04-20T10:03:00Z', 'a'),
      sl('2026-04-20T10:04:00Z', 'a'),
    ],
    { generatedAt: GEN },
  );
  const a = r.sources.find((s) => s.source === 'a')!;
  assert.equal(a.maxRunLength, 3);
  assert.equal(a.longestRunStartedAt, '2026-04-20T10:02:00Z');
});

test('source-run-lengths: rows sorted by maxRunLength desc, source asc tiebreak', () => {
  const r = buildSourceRunLengths(
    [
      // a: max run 1
      sl('2026-04-20T10:00:00Z', 'a'),
      sl('2026-04-20T10:01:00Z', 'b'),
      sl('2026-04-20T10:02:00Z', 'a'),
      // b ends up with max 1; c with max 2
      sl('2026-04-20T10:03:00Z', 'c'),
      sl('2026-04-20T10:04:00Z', 'c'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[0]!.maxRunLength, 2);
});

test('source-run-lengths: top cap hides extras and increments droppedBelowTopCap', () => {
  const r = buildSourceRunLengths(
    [
      sl('2026-04-20T10:00:00Z', 'a'),
      sl('2026-04-20T10:01:00Z', 'b'),
      sl('2026-04-20T10:02:00Z', 'c'),
    ],
    { top: 2, generatedAt: GEN },
  );
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('source-run-lengths: filterSources allowlist drops other sources', () => {
  const r = buildSourceRunLengths(
    [
      sl('2026-04-20T10:00:00Z', 'a'),
      sl('2026-04-20T10:01:00Z', 'b'),
      sl('2026-04-20T10:02:00Z', 'a'),
      sl('2026-04-20T10:03:00Z', 'c'),
    ],
    { filterSources: ['a'], generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 2);
  assert.equal(r.droppedByFilterSource, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  // After filter, only 'a' sessions remain → contiguous → 1 run of length 2.
  assert.equal(r.totalRuns, 1);
  assert.equal(r.sources[0]!.maxRunLength, 2);
  assert.deepEqual(r.filterSources, ['a']);
});

test('source-run-lengths: filterSources rejects empty / bad input', () => {
  assert.throws(() => buildSourceRunLengths([], { filterSources: [] }));
  // @ts-expect-error testing runtime
  assert.throws(() => buildSourceRunLengths([], { filterSources: [''] }));
  // @ts-expect-error testing runtime
  assert.throws(() => buildSourceRunLengths([], { filterSources: [42] }));
});

test('source-run-lengths: global percentiles via nearest-rank', () => {
  // 5 runs of lengths 1,1,2,3,5 (5 = max)
  // p50 = nearest-rank k=ceil(0.5*5)=3 → sorted[2] = 2
  // p90 = k=ceil(0.9*5)=5 → sorted[4] = 5
  const r = buildSourceRunLengths(
    [
      sl('2026-04-20T10:00:00Z', 'a'),
      sl('2026-04-20T10:01:00Z', 'b'),
      sl('2026-04-20T10:02:00Z', 'a'),
      sl('2026-04-20T10:03:00Z', 'b'),
      sl('2026-04-20T10:04:00Z', 'b'), // b: run of 2
      sl('2026-04-20T10:05:00Z', 'c'),
      sl('2026-04-20T10:06:00Z', 'c'),
      sl('2026-04-20T10:07:00Z', 'c'), // c: run of 3
      sl('2026-04-20T10:08:00Z', 'd'),
      sl('2026-04-20T10:09:00Z', 'd'),
      sl('2026-04-20T10:10:00Z', 'd'),
      sl('2026-04-20T10:11:00Z', 'd'),
      sl('2026-04-20T10:12:00Z', 'd'), // d: run of 5
    ],
    { generatedAt: GEN },
  );
  // Runs in order of building: a(1), b(1), a(1), b(2), c(3), d(5) = 6 runs
  // lengths sorted: 1,1,1,2,3,5
  // p50: k=ceil(0.5*6)=3 → sorted[2]=1
  // p90: k=ceil(0.9*6)=6 → sorted[5]=5
  // max=5, mean=13/6
  assert.equal(r.totalRuns, 6);
  assert.equal(r.globalMaxRunLength, 5);
  assert.equal(r.globalP50RunLength, 1);
  assert.equal(r.globalP90RunLength, 5);
  assert.ok(Math.abs(r.globalMeanRunLength - 13 / 6) < 1e-9);
  // 3 of 13 sessions are in length-1 runs → 3/13
  assert.ok(Math.abs(r.globalSingleSessionRunShare - 3 / 13) < 1e-9);
});

test('source-run-lengths: report echoes window + minRuns + top + filter', () => {
  const r = buildSourceRunLengths([], {
    since: '2026-04-01T00:00:00Z',
    until: '2026-05-01T00:00:00Z',
    minRuns: 3,
    top: 5,
    filterSources: ['a', 'b'],
    generatedAt: GEN,
  });
  assert.equal(r.windowStart, '2026-04-01T00:00:00Z');
  assert.equal(r.windowEnd, '2026-05-01T00:00:00Z');
  assert.equal(r.minRuns, 3);
  assert.equal(r.top, 5);
  assert.deepEqual(r.filterSources, ['a', 'b']);
  assert.equal(r.generatedAt, GEN);
});

test('source-run-lengths: top + minRuns compose — minRuns runs first, then top caps the survivors', () => {
  // 4 sources: a (3 runs), b (2 runs), c (2 runs), d (1 run, sparse)
  const sessions: SessionLine[] = [
    sl('2026-04-20T10:00:00Z', 'a'),
    sl('2026-04-20T10:01:00Z', 'b'),
    sl('2026-04-20T10:02:00Z', 'a'),
    sl('2026-04-20T10:03:00Z', 'b'),
    sl('2026-04-20T10:04:00Z', 'a'),
    sl('2026-04-20T10:05:00Z', 'c'),
    sl('2026-04-20T10:06:00Z', 'b'), // not used to stay simple — extra c
    sl('2026-04-20T10:07:00Z', 'c'),
    sl('2026-04-20T10:08:00Z', 'd'), // d only ever appears once → 1 run
  ];
  const r = buildSourceRunLengths(sessions, { minRuns: 2, top: 2, generatedAt: GEN });
  // d (1 run) dropped by minRuns → droppedSparseSources = 1.
  // Then top=2 keeps the 2 sources with largest maxRunLength;
  // a,b,c all have max 1 here so sort tiebreak (source asc) keeps a,b → c dropped by top.
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.sources.length, 2);
});

test('source-run-lengths: filterSources + top compose — filter runs before run computation', () => {
  // Only b and c remain after filter; their sessions get re-coalesced into runs
  // *as if the dropped sessions never existed*.
  const r = buildSourceRunLengths(
    [
      sl('2026-04-20T10:00:00Z', 'a'),
      sl('2026-04-20T10:01:00Z', 'b'),
      sl('2026-04-20T10:02:00Z', 'a'),
      sl('2026-04-20T10:03:00Z', 'b'), // after filter, b's two sessions are now contiguous!
      sl('2026-04-20T10:04:00Z', 'c'),
    ],
    { filterSources: ['b', 'c'], top: 1, generatedAt: GEN },
  );
  assert.equal(r.droppedByFilterSource, 2); // 2 a's dropped
  assert.equal(r.consideredSessions, 3);
  // After filter, ordered: b, b, c → runs: [b,b] (length 2), [c] (length 1) = 2 runs total
  assert.equal(r.totalRuns, 2);
  // top=1 → only the source with largest max stays (b, max=2)
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[0]!.maxRunLength, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('source-run-lengths: top larger than source count — no drops, no error', () => {
  const r = buildSourceRunLengths(
    [sl('2026-04-20T10:00:00Z', 'a'), sl('2026-04-20T10:01:00Z', 'b')],
    { top: 10, generatedAt: GEN },
  );
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 0);
  assert.equal(r.top, 10);
});
