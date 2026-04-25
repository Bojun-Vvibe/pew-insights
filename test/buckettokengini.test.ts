import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildBucketTokenGini } from '../src/buckettokengini.js';
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

test('bucket-token-gini: empty input → zero rows', () => {
  const r = buildBucketTokenGini([], { generatedAt: GEN });
  assert.equal(r.totalTokens, 0);
  assert.equal(r.observedSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.weightedMeanGini, 0);
  assert.equal(r.unweightedMeanGini, 0);
  assert.equal(r.singleBucketSourceCount, 0);
});

test('bucket-token-gini: rejects bad minBuckets', () => {
  assert.throws(() => buildBucketTokenGini([], { minBuckets: 0 }));
  assert.throws(() => buildBucketTokenGini([], { minBuckets: -1 }));
  assert.throws(() => buildBucketTokenGini([], { minBuckets: 1.5 }));
  assert.throws(() => buildBucketTokenGini([], { minBuckets: Number.NaN }));
});

test('bucket-token-gini: rejects bad since/until', () => {
  assert.throws(() => buildBucketTokenGini([], { since: 'not-iso' }));
  assert.throws(() => buildBucketTokenGini([], { until: 'not-iso' }));
});

test('bucket-token-gini: rejects bad filterSources', () => {
  assert.throws(() => buildBucketTokenGini([], { filterSources: [] }));
  assert.throws(() =>
    buildBucketTokenGini([], { filterSources: [''] as string[] }),
  );
});

test('bucket-token-gini: single bucket source has gini 0 and is counted in singleBucketSourceCount', () => {
  const r = buildBucketTokenGini(
    [ql('2026-04-20T09:00:00Z', 'a', 1000)],
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'a');
  assert.equal(s.bucketCount, 1);
  assert.equal(s.totalTokens, 1000);
  assert.equal(s.gini, 0);
  assert.equal(s.maxBucketTokens, 1000);
  assert.equal(s.topBucketShare, 1);
  assert.equal(r.singleBucketSourceCount, 1);
});

test('bucket-token-gini: perfectly even distribution → gini = 0', () => {
  // Five hour buckets, equal tokens each → perfectly even → G = 0.
  const queue: QueueLine[] = [];
  for (let h = 9; h < 14; h++) {
    queue.push(ql(`2026-04-20T${String(h).padStart(2, '0')}:00:00Z`, 'a', 100));
  }
  const r = buildBucketTokenGini(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.bucketCount, 5);
  assert.equal(s.totalTokens, 500);
  assert.ok(Math.abs(s.gini) < 1e-12);
  assert.equal(s.meanTokens, 100);
  assert.equal(s.maxBucketTokens, 100);
  assert.ok(Math.abs(s.topBucketShare - 0.2) < 1e-12);
});

test('bucket-token-gini: extreme concentration → gini approaches (n-1)/n', () => {
  // One bucket has all the mass, n-1 buckets have ε. With 4
  // buckets at (1000, 0+, 0+, 0+) the textbook upper bound on
  // gini is (n-1)/n = 0.75. We approximate with 1-token sentinels
  // (the builder rejects 0-token rows).
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 'a', 1_000_000),
    ql('2026-04-20T10:00:00Z', 'a', 1),
    ql('2026-04-20T11:00:00Z', 'a', 1),
    ql('2026-04-20T12:00:00Z', 'a', 1),
  ];
  const r = buildBucketTokenGini(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.bucketCount, 4);
  // Should be very close to 0.75 (the n=4 ceiling).
  assert.ok(s.gini > 0.749);
  assert.ok(s.gini <= 0.75);
  assert.ok(s.topBucketShare > 0.9999);
});

test('bucket-token-gini: known two-bucket case (200,800) gives gini = 0.3', () => {
  // For [200, 800], n=2, sum=1000, sorted asc = [200, 800].
  // weighted = (2*1 - 2 - 1)*200 + (2*2 - 2 - 1)*800
  //         = (-1)*200 + (1)*800 = 600.
  // gini = 600 / (2 * 1000) = 0.3.
  const r = buildBucketTokenGini(
    [
      ql('2026-04-20T09:00:00Z', 'a', 200),
      ql('2026-04-20T10:00:00Z', 'a', 800),
    ],
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.equal(s.bucketCount, 2);
  assert.ok(Math.abs(s.gini - 0.3) < 1e-12);
  assert.ok(Math.abs(s.topBucketShare - 0.8) < 1e-12);
});

test('bucket-token-gini: per-source aggregation does not cross sources', () => {
  // Source a is even across two buckets (gini = 0). Source b is
  // skewed across three buckets. They must not be merged.
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 'a', 50),
    ql('2026-04-20T10:00:00Z', 'a', 50),
    ql('2026-04-20T09:00:00Z', 'b', 1000),
    ql('2026-04-20T10:00:00Z', 'b', 10),
    ql('2026-04-20T11:00:00Z', 'b', 10),
  ];
  const r = buildBucketTokenGini(queue, { generatedAt: GEN });
  assert.equal(r.observedSources, 2);
  assert.equal(r.sources.length, 2);
  const a = r.sources.find((x) => x.source === 'a')!;
  const b = r.sources.find((x) => x.source === 'b')!;
  assert.ok(Math.abs(a.gini) < 1e-12);
  assert.ok(b.gini > 0.5);
  // Default sort: gini desc → b first.
  assert.equal(r.sources[0]!.source, 'b');
});

test('bucket-token-gini: same hour with different ISO precisions merges into one bucket', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 'a', 100),
    ql('2026-04-20T09:00:00.000Z', 'a', 100),
    ql('2026-04-20T10:00:00Z', 'a', 200),
  ];
  const r = buildBucketTokenGini(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.bucketCount, 2);
  assert.equal(s.totalTokens, 400);
  // [200, 200] → perfectly even → gini 0.
  assert.ok(Math.abs(s.gini) < 1e-12);
});

test('bucket-token-gini: minBuckets floor hides sparse sources and counts them', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 'a', 100),
    ql('2026-04-20T10:00:00Z', 'a', 100),
    ql('2026-04-20T11:00:00Z', 'a', 100),
    ql('2026-04-20T09:00:00Z', 'b', 50),
  ];
  const r = buildBucketTokenGini(queue, { minBuckets: 2, generatedAt: GEN });
  assert.equal(r.observedSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinBuckets, 1);
});

test('bucket-token-gini: drops invalid hour_start and non-positive tokens', () => {
  const r = buildBucketTokenGini(
    [
      ql('not-iso', 'a', 100),
      ql('2026-04-20T10:00:00Z', 'a', 0),
      ql('2026-04-20T10:00:00Z', 'a', -5),
      ql('2026-04-20T11:00:00Z', 'a', 50),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.bucketCount, 1);
});

test('bucket-token-gini: window since/until applies before bucket aggregation', () => {
  const r = buildBucketTokenGini(
    [
      ql('2026-04-19T08:00:00Z', 'a', 100),
      ql('2026-04-20T08:00:00Z', 'a', 100),
      ql('2026-04-20T09:00:00Z', 'a', 100),
      ql('2026-04-21T08:00:00Z', 'a', 999),
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
      generatedAt: GEN,
    },
  );
  assert.equal(r.totalTokens, 200);
  const s = r.sources[0]!;
  assert.equal(s.bucketCount, 2);
  assert.ok(Math.abs(s.gini) < 1e-12);
  assert.equal(s.activeWindowStart, '2026-04-20T08:00:00.000Z');
  assert.equal(s.activeWindowEnd, '2026-04-20T09:00:00.000Z');
});

test('bucket-token-gini: filterSources allowlist drops other sources', () => {
  const r = buildBucketTokenGini(
    [
      ql('2026-04-20T09:00:00Z', 'a', 100),
      ql('2026-04-20T10:00:00Z', 'a', 100),
      ql('2026-04-20T09:00:00Z', 'b', 100),
      ql('2026-04-20T09:00:00Z', 'c', 100),
    ],
    { filterSources: ['a', 'b'], generatedAt: GEN },
  );
  assert.deepEqual(r.filterSources, ['a', 'b']);
  assert.equal(r.droppedByFilterSource, 1);
  assert.equal(r.observedSources, 2);
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources.every((s) => s.source === 'a' || s.source === 'b'));
});

test('bucket-token-gini: empty source string folds to "unknown"', () => {
  const r = buildBucketTokenGini(
    [
      ql('2026-04-20T07:00:00Z', '', 100),
      ql('2026-04-20T08:00:00Z', '', 100),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('bucket-token-gini: token-weighted mean gini favours high-mass sources', () => {
  // Source a: huge total mass, perfectly even → gini 0.
  // Source b: small total mass, very skewed → high gini.
  // Token-weighted mean should be pulled toward 0 (a dominates),
  // while unweighted mean averages a and b equally → ~b/2.
  const queue: QueueLine[] = [];
  for (let h = 0; h < 10; h++) {
    queue.push(
      ql(`2026-04-20T${String(h).padStart(2, '0')}:00:00Z`, 'a', 10_000),
    );
  }
  queue.push(ql('2026-04-20T20:00:00Z', 'b', 100));
  queue.push(ql('2026-04-20T21:00:00Z', 'b', 1));
  queue.push(ql('2026-04-20T22:00:00Z', 'b', 1));
  const r = buildBucketTokenGini(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  // Token-weighted mean ≈ 0 because a holds 100k of ~100.1k tokens.
  assert.ok(r.weightedMeanGini < 0.01);
  // Unweighted mean ≈ b.gini / 2 since a.gini = 0.
  const b = r.sources.find((s) => s.source === 'b')!;
  assert.ok(Math.abs(r.unweightedMeanGini - b.gini / 2) < 1e-12);
});

// integration: realistic dataset
test('bucket-token-gini integration: sorted by gini desc with totalTokens tiebreak', () => {
  // Three sources with carefully crafted distributions.
  const queue: QueueLine[] = [
    // 'opencode': spread across 4 buckets evenly → gini 0.
    ql('2026-04-20T09:00:00Z', 'opencode', 1000),
    ql('2026-04-20T10:00:00Z', 'opencode', 1000),
    ql('2026-04-20T11:00:00Z', 'opencode', 1000),
    ql('2026-04-20T12:00:00Z', 'opencode', 1000),
    // 'codex': 2 buckets, (200, 800) → gini 0.3.
    ql('2026-04-20T09:00:00Z', 'codex', 200),
    ql('2026-04-20T10:00:00Z', 'codex', 800),
    // 'claude-code': 3 buckets, very skewed (1000, 1, 1) → high gini.
    ql('2026-04-20T09:00:00Z', 'claude-code', 1000),
    ql('2026-04-20T10:00:00Z', 'claude-code', 1),
    ql('2026-04-20T11:00:00Z', 'claude-code', 1),
  ];
  const r = buildBucketTokenGini(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 3);
  // claude-code highest gini, then codex, then opencode.
  assert.equal(r.sources[0]!.source, 'claude-code');
  assert.equal(r.sources[1]!.source, 'codex');
  assert.equal(r.sources[2]!.source, 'opencode');
  assert.ok(r.sources[0]!.gini > 0.5);
  assert.ok(Math.abs(r.sources[1]!.gini - 0.3) < 1e-12);
  assert.ok(Math.abs(r.sources[2]!.gini) < 1e-12);
  assert.equal(r.singleBucketSourceCount, 0);
});
