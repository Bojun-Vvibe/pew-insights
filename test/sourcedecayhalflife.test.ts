import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceDecayHalfLife } from '../src/sourcedecayhalflife.js';
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
const HOUR = 3_600_000;

// ---- option validation ----------------------------------------------------

test('source-decay-half-life: rejects bad minBuckets', () => {
  assert.throws(() => buildSourceDecayHalfLife([], { minBuckets: -1 }));
  assert.throws(() => buildSourceDecayHalfLife([], { minBuckets: 1.5 }));
});

test('source-decay-half-life: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceDecayHalfLife([], { sort: 'bogus' as 'halflife' }),
  );
});

test('source-decay-half-life: rejects bad since/until', () => {
  assert.throws(() => buildSourceDecayHalfLife([], { since: 'not-a-date' }));
  assert.throws(() => buildSourceDecayHalfLife([], { until: 'not-a-date' }));
});

// ---- empty / single-bucket ------------------------------------------------

test('source-decay-half-life: empty queue -> empty report', () => {
  const r = buildSourceDecayHalfLife([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalActiveBuckets, 0);
  assert.equal(r.totalTokens, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.sort, 'halflife');
});

test('source-decay-half-life: single-bucket source has halfLifeFraction 0 and frontLoadIndex +0.5', () => {
  const q = [ql('2026-04-20T00:00:00.000Z', 'codex', 'm', 100)];
  const r = buildSourceDecayHalfLife(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'codex');
  assert.equal(s.activeBuckets, 1);
  assert.equal(s.spanHours, 0);
  assert.equal(s.tokens, 100);
  assert.equal(s.halfLifeIso, '2026-04-20T00:00:00.000Z');
  assert.equal(s.halfLifeHours, 0);
  assert.equal(s.halfLifeFraction, 0);
  assert.equal(s.frontLoadIndex, 0.5);
});

// ---- core math -----------------------------------------------------------

test('source-decay-half-life: front-loaded source has halfLifeFraction < 0.5', () => {
  // 4 buckets, 1h apart. Tokens: 80, 10, 5, 5. Half (50) hits at bucket 0.
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'm', 80),
    ql('2026-04-20T01:00:00.000Z', 'a', 'm', 10),
    ql('2026-04-20T02:00:00.000Z', 'a', 'm', 5),
    ql('2026-04-20T03:00:00.000Z', 'a', 'm', 5),
  ];
  const r = buildSourceDecayHalfLife(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.tokens, 100);
  assert.equal(s.spanHours, 3);
  assert.equal(s.halfLifeIso, '2026-04-20T00:00:00.000Z');
  assert.equal(s.halfLifeHours, 0);
  assert.equal(s.halfLifeFraction, 0);
  assert.equal(s.frontLoadIndex, 0.5);
});

test('source-decay-half-life: back-loaded source has halfLifeFraction > 0.5', () => {
  // Tokens: 5, 5, 10, 80. Half (50) hits at bucket 3 (idx 3, 3h in).
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'b', 'm', 5),
    ql('2026-04-20T01:00:00.000Z', 'b', 'm', 5),
    ql('2026-04-20T02:00:00.000Z', 'b', 'm', 10),
    ql('2026-04-20T03:00:00.000Z', 'b', 'm', 80),
  ];
  const r = buildSourceDecayHalfLife(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.tokens, 100);
  assert.equal(s.spanHours, 3);
  assert.equal(s.halfLifeIso, '2026-04-20T03:00:00.000Z');
  assert.equal(s.halfLifeHours, 3);
  assert.equal(s.halfLifeFraction, 1);
  assert.equal(s.frontLoadIndex, -0.5);
});

test('source-decay-half-life: uniform source halfLifeFraction near 0.5', () => {
  // 4 buckets, equal tokens 25 each. Cumulative: 25, 50, 75, 100.
  // Half (50) hits at bucket idx 1, 1h in. spanHours = 3 -> 1/3.
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'u', 'm', 25),
    ql('2026-04-20T01:00:00.000Z', 'u', 'm', 25),
    ql('2026-04-20T02:00:00.000Z', 'u', 'm', 25),
    ql('2026-04-20T03:00:00.000Z', 'u', 'm', 25),
  ];
  const r = buildSourceDecayHalfLife(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  // first idx where cumulative >= 50 is idx 1
  assert.equal(s.halfLifeIso, '2026-04-20T01:00:00.000Z');
  assert.equal(s.halfLifeHours, 1);
  assert.ok(Math.abs(s.halfLifeFraction - 1 / 3) < 1e-9);
});

// ---- multi-source sort ---------------------------------------------------

test('source-decay-half-life: default sort is halflife asc, ties on tokens desc, then source asc', () => {
  const q = [
    // 'aaa': front-loaded, 100 tokens, halfLifeFraction = 0
    ql('2026-04-20T00:00:00.000Z', 'aaa', 'm', 90),
    ql('2026-04-20T01:00:00.000Z', 'aaa', 'm', 10),
    // 'bbb': front-loaded, 50 tokens, halfLifeFraction = 0
    ql('2026-04-20T00:00:00.000Z', 'bbb', 'm', 45),
    ql('2026-04-20T01:00:00.000Z', 'bbb', 'm', 5),
    // 'ccc': back-loaded, halfLifeFraction = 1
    ql('2026-04-20T00:00:00.000Z', 'ccc', 'm', 5),
    ql('2026-04-20T01:00:00.000Z', 'ccc', 'm', 95),
  ];
  const r = buildSourceDecayHalfLife(q, { generatedAt: GEN });
  // halflife asc => aaa(0,100) before bbb(0,50) before ccc(1)
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['aaa', 'bbb', 'ccc'],
  );
});

test('source-decay-half-life: sort=tokens orders by tokens desc with lex tiebreak', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'aaa', 'm', 50),
    ql('2026-04-20T00:00:00.000Z', 'bbb', 'm', 200),
    ql('2026-04-20T00:00:00.000Z', 'ccc', 'm', 200),
  ];
  const r = buildSourceDecayHalfLife(q, { generatedAt: GEN, sort: 'tokens' });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['bbb', 'ccc', 'aaa'],
  );
});

test('source-decay-half-life: sort=frontload puts most front-loaded first', () => {
  const q = [
    // back: hits at last bucket
    ql('2026-04-20T00:00:00.000Z', 'back', 'm', 1),
    ql('2026-04-20T01:00:00.000Z', 'back', 'm', 99),
    // front: hits at first bucket
    ql('2026-04-20T00:00:00.000Z', 'front', 'm', 99),
    ql('2026-04-20T01:00:00.000Z', 'front', 'm', 1),
  ];
  const r = buildSourceDecayHalfLife(q, {
    generatedAt: GEN,
    sort: 'frontload',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['front', 'back'],
  );
  assert.equal(r.sources[0]!.frontLoadIndex, 0.5);
  assert.equal(r.sources[1]!.frontLoadIndex, -0.5);
});

// ---- filters / floors ---------------------------------------------------

test('source-decay-half-life: minBuckets floor hides sparse sources but preserves global totals', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'sparse', 'm', 1000), // 1 bucket
    ql('2026-04-20T00:00:00.000Z', 'dense', 'm', 10),
    ql('2026-04-20T01:00:00.000Z', 'dense', 'm', 10),
    ql('2026-04-20T02:00:00.000Z', 'dense', 'm', 10),
  ];
  const r = buildSourceDecayHalfLife(q, {
    generatedAt: GEN,
    minBuckets: 2,
  });
  assert.equal(r.totalActiveBuckets, 4); // 1 + 3, full population
  assert.equal(r.totalTokens, 1030);
  assert.equal(r.droppedSparseSources, 1);
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['dense'],
  );
});

test('source-decay-half-life: model filter restricts rows', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'gpt-5', 100),
    ql('2026-04-20T01:00:00.000Z', 'a', 'claude-opus-4.7', 50),
    ql('2026-04-20T00:00:00.000Z', 'b', 'gpt-5', 25),
  ];
  const r = buildSourceDecayHalfLife(q, {
    generatedAt: GEN,
    model: 'gpt-5',
  });
  assert.equal(r.droppedModelFilter, 1);
  assert.equal(r.totalSources, 2);
  const sa = r.sources.find((s) => s.source === 'a')!;
  assert.equal(sa.tokens, 100);
});

test('source-decay-half-life: window clip via since/until', () => {
  const q = [
    ql('2026-04-19T00:00:00.000Z', 'a', 'm', 1000), // before window
    ql('2026-04-20T00:00:00.000Z', 'a', 'm', 50),
    ql('2026-04-20T01:00:00.000Z', 'a', 'm', 50),
    ql('2026-04-21T00:00:00.000Z', 'a', 'm', 1000), // outside upper
  ];
  const r = buildSourceDecayHalfLife(q, {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-21T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.tokens, 100);
  assert.equal(r.sources[0]!.activeBuckets, 2);
});

test('source-decay-half-life: bad hour_start and zero tokens are counted and dropped', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'm', 100),
    ql('not-a-date', 'a', 'm', 100),
    ql('2026-04-20T01:00:00.000Z', 'a', 'm', 0),
    ql('2026-04-20T02:00:00.000Z', 'a', 'm', -50),
  ];
  const r = buildSourceDecayHalfLife(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.sources[0]!.tokens, 100);
});

test('source-decay-half-life: duplicate-bucket tokens accumulate within a source', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'm1', 30),
    ql('2026-04-20T00:00:00.000Z', 'a', 'm2', 70), // same source/bucket, different model
    ql('2026-04-20T01:00:00.000Z', 'a', 'm1', 100),
  ];
  const r = buildSourceDecayHalfLife(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.tokens, 200);
  assert.equal(r.sources[0]!.activeBuckets, 2);
  // Bucket 0 = 100, bucket 1 = 100. Half (100) hits at bucket 0 (>=).
  assert.equal(r.sources[0]!.halfLifeIso, '2026-04-20T00:00:00.000Z');
  assert.equal(r.sources[0]!.halfLifeFraction, 0);
});

test('source-decay-half-life: empty source name normalised to "unknown"', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', '', 'm', 50),
    ql('2026-04-20T01:00:00.000Z', '', 'm', 50),
  ];
  const r = buildSourceDecayHalfLife(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('source-decay-half-life: report echoes resolved options', () => {
  const r = buildSourceDecayHalfLife([], {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-05-01T00:00:00.000Z',
    model: 'gpt-5',
    minBuckets: 3,
    sort: 'span',
  });
  assert.equal(r.windowStart, '2026-04-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-05-01T00:00:00.000Z');
  assert.equal(r.model, 'gpt-5');
  assert.equal(r.minBuckets, 3);
  assert.equal(r.sort, 'span');
});
