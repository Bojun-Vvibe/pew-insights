import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceTenure } from '../src/sourcetenure.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hourStart: string,
  source: string,
  model: string,
  totalTokens: number,
): QueueLine {
  return {
    source,
    model,
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: totalTokens,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation ----------------------------------------------------

test('source-tenure: rejects bad minBuckets', () => {
  assert.throws(() => buildSourceTenure([], { minBuckets: -1 }));
  assert.throws(() => buildSourceTenure([], { minBuckets: 1.5 }));
});

test('source-tenure: rejects bad top', () => {
  assert.throws(() => buildSourceTenure([], { top: -1 }));
  assert.throws(() => buildSourceTenure([], { top: 2.5 }));
});

test('source-tenure: rejects bad sort', () => {
  // @ts-expect-error testing runtime guard
  assert.throws(() => buildSourceTenure([], { sort: 'nope' }));
});

test('source-tenure: rejects bad since/until', () => {
  assert.throws(() => buildSourceTenure([], { since: 'no' }));
  assert.throws(() => buildSourceTenure([], { until: 'nope' }));
});

// ---- empty / shape --------------------------------------------------------

test('source-tenure: empty input yields zero population', () => {
  const r = buildSourceTenure([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalActiveBuckets, 0);
  assert.equal(r.totalTokens, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.sort, 'span');
  assert.equal(r.minBuckets, 0);
});

// ---- core span computation ------------------------------------------------

test('source-tenure: span and counts are correct for a multi-bucket source', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'codex', 'gpt-5', 100),
    ql('2026-04-20T01:00:00.000Z', 'codex', 'gpt-5', 200),
    ql('2026-04-20T05:00:00.000Z', 'codex', 'gpt-5', 700),
  ];
  const r = buildSourceTenure(rows, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'codex');
  assert.equal(s.activeBuckets, 3);
  assert.equal(s.tokens, 1000);
  assert.equal(s.spanHours, 5);
  assert.equal(s.firstSeen, '2026-04-20T00:00:00.000Z');
  assert.equal(s.lastSeen, '2026-04-20T05:00:00.000Z');
  assert.equal(s.tokensPerActiveBucket, 1000 / 3);
  assert.equal(s.tokensPerSpanHour, 200);
  assert.equal(s.distinctModels, 1);
});

test('source-tenure: single-bucket source yields spanHours=0 with finite density', () => {
  const rows = [ql('2026-04-20T00:00:00.000Z', 'codex', 'gpt-5', 500)];
  const r = buildSourceTenure(rows, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.spanHours, 0);
  // floor of 1 hour kicks in -> density = tokens / 1
  assert.equal(s.tokensPerSpanHour, 500);
  assert.equal(s.distinctModels, 1);
});

test('source-tenure: distinctModels counts unique normalised models per source', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'claude-code', 'claude-opus-4.7', 100),
    ql('2026-04-20T01:00:00.000Z', 'claude-code', 'claude-sonnet-4.5', 100),
    ql('2026-04-20T02:00:00.000Z', 'claude-code', 'claude-opus-4.7', 100),
    ql('2026-04-20T00:00:00.000Z', 'codex', 'gpt-5', 100),
  ];
  const r = buildSourceTenure(rows, { generatedAt: GEN });
  const byKey = Object.fromEntries(r.sources.map((s) => [s.source, s]));
  assert.equal(byKey['claude-code']!.distinctModels, 2);
  assert.equal(byKey['codex']!.distinctModels, 1);
});

test('source-tenure: empty source string is bucketed as "unknown"', () => {
  const rows = [ql('2026-04-20T00:00:00.000Z', '', 'gpt-5', 100)];
  const r = buildSourceTenure(rows, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

// ---- drops ----------------------------------------------------------------

test('source-tenure: invalid hour_start increments droppedInvalidHourStart', () => {
  const rows = [
    ql('not-a-date', 'codex', 'gpt-5', 100),
    ql('2026-04-20T00:00:00.000Z', 'codex', 'gpt-5', 100),
  ];
  const r = buildSourceTenure(rows, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.activeBuckets, 1);
});

test('source-tenure: zero or negative tokens drop into droppedZeroTokens', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'codex', 'gpt-5', 0),
    ql('2026-04-20T01:00:00.000Z', 'codex', 'gpt-5', -5),
    ql('2026-04-20T02:00:00.000Z', 'codex', 'gpt-5', 50),
  ];
  const r = buildSourceTenure(rows, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.sources[0]!.tokens, 50);
  assert.equal(r.sources[0]!.activeBuckets, 1);
});

test('source-tenure: model filter restricts rows and counts droppedModelFilter', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'codex', 'gpt-5', 100),
    ql('2026-04-20T01:00:00.000Z', 'codex', 'claude-opus-4.7', 200),
    ql('2026-04-20T02:00:00.000Z', 'opencode', 'gpt-5', 50),
  ];
  const r = buildSourceTenure(rows, { generatedAt: GEN, model: 'gpt-5' });
  assert.equal(r.droppedModelFilter, 1);
  // both surviving sources have only gpt-5
  for (const s of r.sources) {
    assert.equal(s.distinctModels, 1);
  }
});

test('source-tenure: minBuckets floor hides sparse sources but counts them', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'codex', 'gpt-5', 100),
    ql('2026-04-20T01:00:00.000Z', 'codex', 'gpt-5', 100),
    ql('2026-04-20T02:00:00.000Z', 'codex', 'gpt-5', 100),
    ql('2026-04-20T00:00:00.000Z', 'opencode', 'gpt-5', 50),
  ];
  const r = buildSourceTenure(rows, { generatedAt: GEN, minBuckets: 2 });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'codex');
  // global denominators include the dropped rows
  assert.equal(r.totalActiveBuckets, 4);
  assert.equal(r.totalTokens, 350);
});

// ---- sort -----------------------------------------------------------------

test('source-tenure: sort=tokens orders by tokens desc', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 100),
    ql('2026-04-20T05:00:00.000Z', 'a', 'gpt-5', 100), // a: tokens=200, span=5
    ql('2026-04-20T00:00:00.000Z', 'b', 'gpt-5', 1000),
    ql('2026-04-20T01:00:00.000Z', 'b', 'gpt-5', 1000), // b: tokens=2000, span=1
  ];
  const r = buildSourceTenure(rows, { generatedAt: GEN, sort: 'tokens' });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'a'],
  );
});

test('source-tenure: sort=span orders by spanHours desc with lex tiebreak', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'b', 'gpt-5', 100),
    ql('2026-04-20T05:00:00.000Z', 'b', 'gpt-5', 100),
    ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 100),
    ql('2026-04-20T05:00:00.000Z', 'a', 'gpt-5', 100),
  ];
  const r = buildSourceTenure(rows, { generatedAt: GEN, sort: 'span' });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b'],
  );
});

test('source-tenure: sort=models orders by distinctModels desc', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'wide', 'gpt-5', 100),
    ql('2026-04-20T01:00:00.000Z', 'wide', 'claude-opus-4.7', 100),
    ql('2026-04-20T02:00:00.000Z', 'wide', 'claude-sonnet-4.5', 100),
    ql('2026-04-20T00:00:00.000Z', 'narrow', 'gpt-5', 1000),
  ];
  const r = buildSourceTenure(rows, { generatedAt: GEN, sort: 'models' });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['wide', 'narrow'],
  );
});

// ---- top ------------------------------------------------------------------

test('source-tenure: top cap truncates and surfaces droppedTopSources', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 100),
    ql('2026-04-20T05:00:00.000Z', 'a', 'gpt-5', 100),
    ql('2026-04-20T00:00:00.000Z', 'b', 'gpt-5', 100),
    ql('2026-04-20T03:00:00.000Z', 'b', 'gpt-5', 100),
    ql('2026-04-20T00:00:00.000Z', 'c', 'gpt-5', 100),
  ];
  const r = buildSourceTenure(rows, { generatedAt: GEN, sort: 'span', top: 1 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedTopSources, 2);
  // totals reflect the full population
  assert.equal(r.totalSources, 3);
});

// ---- window --------------------------------------------------------------

test('source-tenure: since/until window the active buckets', () => {
  const rows = [
    ql('2026-04-19T00:00:00.000Z', 'codex', 'gpt-5', 100), // before
    ql('2026-04-20T00:00:00.000Z', 'codex', 'gpt-5', 100),
    ql('2026-04-20T05:00:00.000Z', 'codex', 'gpt-5', 100),
    ql('2026-04-21T00:00:00.000Z', 'codex', 'gpt-5', 100), // at/after `until`
  ];
  const r = buildSourceTenure(rows, {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-21T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.activeBuckets, 2);
  assert.equal(r.sources[0]!.tokens, 200);
  assert.equal(r.sources[0]!.spanHours, 5);
  assert.equal(r.windowStart, '2026-04-20T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-21T00:00:00.000Z');
});

// ---- determinism --------------------------------------------------------

test('source-tenure: tiebreak on source key is lex asc', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'zeta', 'gpt-5', 100),
    ql('2026-04-20T00:00:00.000Z', 'alpha', 'gpt-5', 100),
  ];
  const r = buildSourceTenure(rows, { generatedAt: GEN, sort: 'tokens' });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'zeta'],
  );
});

// ---- minModels (refinement) ----------------------------------------------

test('source-tenure: rejects bad minModels', () => {
  assert.throws(() => buildSourceTenure([], { minModels: -1 }));
  assert.throws(() => buildSourceTenure([], { minModels: 1.5 }));
});

test('source-tenure: minModels floor hides single-model sources but keeps totals', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'wide', 'gpt-5', 100),
    ql('2026-04-20T01:00:00.000Z', 'wide', 'claude-opus-4.7', 100),
    ql('2026-04-20T02:00:00.000Z', 'wide', 'claude-sonnet-4.5', 100),
    ql('2026-04-20T00:00:00.000Z', 'narrow1', 'gpt-5', 1000),
    ql('2026-04-20T00:00:00.000Z', 'narrow2', 'gpt-5', 500),
  ];
  const r = buildSourceTenure(rows, { generatedAt: GEN, minModels: 2 });
  assert.equal(r.minModels, 2);
  assert.equal(r.droppedNarrowSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'wide');
  assert.equal(r.sources[0]!.distinctModels, 3);
  // global denominators include the dropped rows
  assert.equal(r.totalActiveBuckets, 5);
  assert.equal(r.totalTokens, 1800);
});

test('source-tenure: minBuckets and minModels compose; minBuckets evaluated first', () => {
  const rows = [
    // sparse + narrow: dropped by minBuckets
    ql('2026-04-20T00:00:00.000Z', 'sparse-narrow', 'gpt-5', 50),
    // dense + narrow: dropped by minModels
    ql('2026-04-20T00:00:00.000Z', 'dense-narrow', 'gpt-5', 100),
    ql('2026-04-20T01:00:00.000Z', 'dense-narrow', 'gpt-5', 100),
    ql('2026-04-20T02:00:00.000Z', 'dense-narrow', 'gpt-5', 100),
    // dense + wide: kept
    ql('2026-04-20T00:00:00.000Z', 'dense-wide', 'gpt-5', 100),
    ql('2026-04-20T01:00:00.000Z', 'dense-wide', 'claude-opus-4.7', 100),
    ql('2026-04-20T02:00:00.000Z', 'dense-wide', 'claude-sonnet-4.5', 100),
  ];
  const r = buildSourceTenure(rows, {
    generatedAt: GEN,
    minBuckets: 2,
    minModels: 2,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedNarrowSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'dense-wide');
});

test('source-tenure: minModels=0 (default) is a no-op', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 100),
    ql('2026-04-20T00:00:00.000Z', 'b', 'gpt-5', 100),
  ];
  const r = buildSourceTenure(rows, { generatedAt: GEN });
  assert.equal(r.minModels, 0);
  assert.equal(r.droppedNarrowSources, 0);
  assert.equal(r.sources.length, 2);
});
