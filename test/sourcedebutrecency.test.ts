import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceDebutRecency } from '../src/sourcedebutrecency.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
  opts: Partial<QueueLine> = {},
): QueueLine {
  return {
    source,
    model: opts.model ?? 'm1',
    hour_start,
    device_id: opts.device_id ?? 'd1',
    input_tokens: opts.input_tokens ?? Math.floor(total_tokens / 2),
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? Math.floor(total_tokens / 2),
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

test('source-debut-recency: empty input → zero rows, empty rollup', () => {
  const r = buildSourceDebutRecency([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.asOf, null);
  assert.equal(r.newcomerRollup.newcomerSources, 0);
  assert.equal(r.newcomerRollup.newcomerTokens, 0);
  assert.equal(r.newcomerRollup.newcomerTokenShare, 0);
  assert.equal(r.newcomerRollup.newcomerCutoffIso, null);
  assert.equal(r.debutWindowFraction, 0.25);
  assert.equal(r.newcomerRollup.newcomerWindowDays, 7);
});

test('source-debut-recency: rejects bad minBuckets', () => {
  assert.throws(() => buildSourceDebutRecency([], { minBuckets: -1 }));
  assert.throws(() => buildSourceDebutRecency([], { minBuckets: 1.5 }));
  assert.throws(() =>
    buildSourceDebutRecency([], { minBuckets: Number.NaN }),
  );
});

test('source-debut-recency: rejects bad top', () => {
  assert.throws(() => buildSourceDebutRecency([], { top: 0 }));
  assert.throws(() => buildSourceDebutRecency([], { top: -2 }));
  assert.throws(() => buildSourceDebutRecency([], { top: 1.5 }));
});

test('source-debut-recency: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceDebutRecency([], {
      // @ts-expect-error invalid sort
      sort: 'bogus',
    }),
  );
});

test('source-debut-recency: rejects bad debutWindowFraction', () => {
  assert.throws(() =>
    buildSourceDebutRecency([], { debutWindowFraction: 0 }),
  );
  assert.throws(() =>
    buildSourceDebutRecency([], { debutWindowFraction: -0.1 }),
  );
  assert.throws(() =>
    buildSourceDebutRecency([], { debutWindowFraction: 1.5 }),
  );
  assert.throws(() =>
    buildSourceDebutRecency([], { debutWindowFraction: Number.NaN }),
  );
});

test('source-debut-recency: rejects bad newcomerWindowDays', () => {
  assert.throws(() =>
    buildSourceDebutRecency([], { newcomerWindowDays: 0 }),
  );
  assert.throws(() =>
    buildSourceDebutRecency([], { newcomerWindowDays: -1 }),
  );
  assert.throws(() =>
    buildSourceDebutRecency([], { newcomerWindowDays: Number.NaN }),
  );
});

test('source-debut-recency: rejects bad since/until/asOf', () => {
  assert.throws(() => buildSourceDebutRecency([], { since: 'not-iso' }));
  assert.throws(() => buildSourceDebutRecency([], { until: 'not-iso' }));
  assert.throws(() => buildSourceDebutRecency([], { asOf: 'not-iso' }));
});

test('source-debut-recency: drops invalid hour_start and zero tokens', () => {
  const queue: QueueLine[] = [
    ql('not-an-iso', 's1', 100),
    ql('2026-04-20T09:00:00Z', 's1', 0),
    ql('2026-04-20T09:00:00Z', 's1', -7),
    ql('2026-04-20T09:00:00Z', 's1', 100),
    ql('2026-04-21T09:00:00Z', 's1', 200),
  ];
  const r = buildSourceDebutRecency(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalTokens, 300);
});

test('source-debut-recency: single-bucket source → tenure 0, debutShare 1', () => {
  const queue: QueueLine[] = [ql('2026-04-20T09:00:00Z', 's1', 500)];
  const r = buildSourceDebutRecency(queue, {
    generatedAt: GEN,
    asOf: '2026-04-21T09:00:00Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 's1');
  assert.equal(row.tenureHours, 0);
  assert.equal(row.activeBuckets, 1);
  assert.equal(row.tokens, 500);
  assert.equal(row.debutWindowTokens, 500);
  assert.equal(row.debutShare, 1);
  assert.equal(row.daysSinceDebut, 1);
  assert.equal(row.daysSinceLastSeen, 1);
});

test('source-debut-recency: front-loaded source → high debutShare', () => {
  // tenure: 0h..100h. window = first 25h. Mass: 800 in [0..20h], 200 in [80h..100h].
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 's1', 500),
    ql('2026-04-20T10:00:00Z', 's1', 300), // both within first 25h
    ql('2026-04-23T08:00:00Z', 's1', 100), // hour 80
    ql('2026-04-24T04:00:00Z', 's1', 100), // hour 100
  ];
  const r = buildSourceDebutRecency(queue, {
    generatedAt: GEN,
    asOf: '2026-04-25T00:00:00Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.tokens, 1000);
  assert.equal(row.debutWindowTokens, 800);
  assert.equal(row.debutShare, 0.8);
});

test('source-debut-recency: flat source → debutShare ≈ debutWindowFraction', () => {
  // Five evenly spaced buckets across 100h, 200 tokens each.
  // Window = 25h (first 25%); buckets at 0, 25, 50, 75, 100h.
  // Buckets <= 25h: indices 0 and 1 → 400 tokens of 1000.
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 's1', 200),
    ql('2026-04-21T01:00:00Z', 's1', 200), // 25h
    ql('2026-04-22T02:00:00Z', 's1', 200), // 50h
    ql('2026-04-23T03:00:00Z', 's1', 200), // 75h
    ql('2026-04-24T04:00:00Z', 's1', 200), // 100h
  ];
  const r = buildSourceDebutRecency(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.tokens, 1000);
  assert.equal(row.debutWindowTokens, 400);
  assert.equal(row.debutShare, 0.4);
});

test('source-debut-recency: custom debutWindowFraction = 0.5 → half window', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 's1', 200),
    ql('2026-04-21T01:00:00Z', 's1', 200),
    ql('2026-04-22T02:00:00Z', 's1', 200),
    ql('2026-04-23T03:00:00Z', 's1', 200),
    ql('2026-04-24T04:00:00Z', 's1', 200),
  ];
  const r = buildSourceDebutRecency(queue, {
    generatedAt: GEN,
    debutWindowFraction: 0.5,
  });
  const row = r.sources[0]!;
  // window = 50h → indices 0,1,2 (at 0h, 25h, 50h) → 600
  assert.equal(row.debutWindowTokens, 600);
  assert.equal(row.debutShare, 0.6);
});

test('source-debut-recency: asOf defaults to latest hour_start', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 's1', 100),
    ql('2026-04-22T00:00:00Z', 's1', 100),
  ];
  const r = buildSourceDebutRecency(queue, { generatedAt: GEN });
  assert.equal(r.asOf, '2026-04-22T00:00:00Z');
  const row = r.sources[0]!;
  assert.equal(row.daysSinceDebut, 2);
  assert.equal(row.daysSinceLastSeen, 0);
});

test('source-debut-recency: newcomer rollup picks recent debuts only', () => {
  // s_old debuted 30 days before asOf; s_new debuted 2 days before asOf.
  const queue: QueueLine[] = [
    ql('2026-03-26T00:00:00Z', 's_old', 1000),
    ql('2026-04-25T00:00:00Z', 's_old', 500),
    ql('2026-04-24T00:00:00Z', 's_new', 200),
    ql('2026-04-26T00:00:00Z', 's_new', 100),
  ];
  const r = buildSourceDebutRecency(queue, {
    generatedAt: GEN,
    newcomerWindowDays: 7,
  });
  assert.equal(r.asOf, '2026-04-26T00:00:00Z');
  assert.equal(r.totalTokens, 1800);
  assert.equal(r.newcomerRollup.newcomerSources, 1);
  assert.equal(r.newcomerRollup.newcomerTokens, 300);
  assert.ok(Math.abs(r.newcomerRollup.newcomerTokenShare - 300 / 1800) < 1e-9);
  // cutoff = 2026-04-26 minus 7 days = 2026-04-19
  assert.equal(r.newcomerRollup.newcomerCutoffIso, '2026-04-19T00:00:00.000Z');
});

test('source-debut-recency: explicit asOf overrides corpus end', () => {
  const queue: QueueLine[] = [ql('2026-04-20T00:00:00Z', 's1', 100)];
  const r = buildSourceDebutRecency(queue, {
    generatedAt: GEN,
    asOf: '2026-04-30T00:00:00Z',
  });
  assert.equal(r.asOf, '2026-04-30T00:00:00Z');
  assert.equal(r.sources[0]!.daysSinceDebut, 10);
  assert.equal(r.sources[0]!.daysSinceLastSeen, 10);
});

test('source-debut-recency: minBuckets floor drops sparse sources from list but not totals', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 's_sparse', 100), // 1 bucket
    ql('2026-04-20T00:00:00Z', 's_dense', 50),
    ql('2026-04-20T01:00:00Z', 's_dense', 50),
    ql('2026-04-20T02:00:00Z', 's_dense', 50),
  ];
  const r = buildSourceDebutRecency(queue, {
    generatedAt: GEN,
    minBuckets: 2,
  });
  assert.equal(r.totalSources, 2); // pre-filter
  assert.equal(r.totalTokens, 250); // pre-filter
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's_dense');
});

test('source-debut-recency: top cap trims after sort', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 100),
    ql('2026-04-21T00:00:00Z', 'b', 100),
    ql('2026-04-22T00:00:00Z', 'c', 100),
    ql('2026-04-23T00:00:00Z', 'd', 100),
  ];
  const r = buildSourceDebutRecency(queue, {
    generatedAt: GEN,
    top: 2,
    sort: 'recency',
  });
  // Sorted by daysSinceDebut asc → newest debut first → 'd', 'c'
  assert.equal(r.droppedBelowTopCap, 2);
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'd');
  assert.equal(r.sources[1]!.source, 'c');
});

test('source-debut-recency: sort=tokens ranks by mass desc', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'small', 10),
    ql('2026-04-21T00:00:00Z', 'big', 1000),
    ql('2026-04-22T00:00:00Z', 'mid', 100),
  ];
  const r = buildSourceDebutRecency(queue, {
    generatedAt: GEN,
    sort: 'tokens',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['big', 'mid', 'small'],
  );
});

test('source-debut-recency: sort=idle ranks by daysSinceLastSeen desc', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'quiet', 100), // last 6 days before asOf
    ql('2026-04-25T00:00:00Z', 'fresh', 100), // last 1 day before asOf
    ql('2026-04-26T00:00:00Z', 'live', 100), // last 0 days
  ];
  const r = buildSourceDebutRecency(queue, {
    generatedAt: GEN,
    sort: 'idle',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['quiet', 'fresh', 'live'],
  );
});

test('source-debut-recency: model filter restricts and counts drops', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 's1', 100, { model: 'mA' }),
    ql('2026-04-20T00:00:00Z', 's2', 100, { model: 'mB' }),
    ql('2026-04-21T00:00:00Z', 's2', 100, { model: 'mB' }),
  ];
  const r = buildSourceDebutRecency(queue, {
    generatedAt: GEN,
    model: 'mB',
  });
  assert.equal(r.droppedModelFilter, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's2');
  assert.equal(r.sources[0]!.tokens, 200);
});

test('source-debut-recency: since/until window respected', () => {
  const queue: QueueLine[] = [
    ql('2026-04-18T00:00:00Z', 's1', 100), // before since
    ql('2026-04-20T00:00:00Z', 's1', 200),
    ql('2026-04-25T00:00:00Z', 's1', 300), // at/after until
  ];
  const r = buildSourceDebutRecency(queue, {
    generatedAt: GEN,
    since: '2026-04-19T00:00:00Z',
    until: '2026-04-25T00:00:00Z',
  });
  assert.equal(r.totalTokens, 200);
  assert.equal(r.sources[0]!.tokens, 200);
});

test('source-debut-recency: deterministic given fixed asOf and generatedAt', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 100),
    ql('2026-04-21T00:00:00Z', 'b', 200),
    ql('2026-04-22T00:00:00Z', 'a', 50),
  ];
  const r1 = buildSourceDebutRecency(queue, {
    generatedAt: GEN,
    asOf: '2026-04-23T00:00:00Z',
  });
  const r2 = buildSourceDebutRecency(queue, {
    generatedAt: GEN,
    asOf: '2026-04-23T00:00:00Z',
  });
  assert.deepEqual(r1, r2);
});

test('source-debut-recency: ties broken deterministically by source asc', () => {
  // All sources are single-bucket on the same day → identical
  // daysSinceDebut and tokens ⇒ tiebreak by source asc.
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'banana', 100),
    ql('2026-04-20T00:00:00Z', 'apple', 100),
    ql('2026-04-20T00:00:00Z', 'cherry', 100),
  ];
  const r = buildSourceDebutRecency(queue, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['apple', 'banana', 'cherry'],
  );
});

test('source-debut-recency: empty source string normalised to "unknown"', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', '', 100),
    ql('2026-04-21T00:00:00Z', '', 100),
  ];
  const r = buildSourceDebutRecency(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
  assert.equal(r.sources[0]!.tokens, 200);
});
