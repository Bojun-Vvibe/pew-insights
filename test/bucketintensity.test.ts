import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildBucketIntensity } from '../src/bucketintensity.js';
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

test('bucket-intensity: rejects bad minBuckets', () => {
  assert.throws(() => buildBucketIntensity([], { minBuckets: -1 }));
  assert.throws(() => buildBucketIntensity([], { minBuckets: 1.5 }));
});

test('bucket-intensity: rejects bad top', () => {
  assert.throws(() => buildBucketIntensity([], { top: -1 }));
  assert.throws(() => buildBucketIntensity([], { top: 2.5 }));
});

test('bucket-intensity: rejects bad sort', () => {
  assert.throws(() =>
    buildBucketIntensity([], { sort: 'bogus' as unknown as 'tokens' }),
  );
});

test('bucket-intensity: rejects bad since/until', () => {
  assert.throws(() => buildBucketIntensity([], { since: 'not-a-date' }));
  assert.throws(() => buildBucketIntensity([], { until: 'nope' }));
});

// ---- empty / edge ---------------------------------------------------------

test('bucket-intensity: empty queue returns zeros', () => {
  const r = buildBucketIntensity([], { generatedAt: GEN });
  assert.equal(r.totalModels, 0);
  assert.equal(r.totalBuckets, 0);
  assert.equal(r.totalTokens, 0);
  assert.deepEqual(r.models, []);
});

test('bucket-intensity: drops zero-token rows and bad hour_start', () => {
  const r = buildBucketIntensity(
    [
      ql('2026-04-20T01:00:00Z', { total_tokens: 0 }),
      ql('not-a-date', { total_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', { total_tokens: 500 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.totalTokens, 500);
});

// ---- per-bucket aggregation ----------------------------------------------

test('bucket-intensity: same model+hour from multiple devices sums into one observation', () => {
  const r = buildBucketIntensity(
    [
      ql('2026-04-20T01:00:00Z', { device_id: 'dev-a', total_tokens: 300 }),
      ql('2026-04-20T01:00:00Z', { device_id: 'dev-b', total_tokens: 200 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.totalModels, 1);
  assert.equal(r.totalBuckets, 1, 'two device rows in same hour collapse to one bucket');
  assert.equal(r.models[0]!.tokens, 500);
  assert.equal(r.models[0]!.min, 500);
  assert.equal(r.models[0]!.max, 500);
});

// ---- percentile semantics -------------------------------------------------

test('bucket-intensity: percentiles use nearest-rank (R-1) on sorted observations', () => {
  // 10 buckets per model, values 100, 200, ..., 1000.
  const lines: QueueLine[] = [];
  for (let i = 1; i <= 10; i++) {
    lines.push(
      ql(`2026-04-${String(10 + i).padStart(2, '0')}T01:00:00Z`, {
        model: 'gpt-5',
        total_tokens: i * 100,
      }),
    );
  }
  const r = buildBucketIntensity(lines, { generatedAt: GEN });
  const m = r.models[0]!;
  assert.equal(m.buckets, 10);
  assert.equal(m.min, 100);
  assert.equal(m.max, 1000);
  // p50 = ceil(0.5 * 10) = rank 5 -> index 4 -> 500
  assert.equal(m.p50, 500);
  // p90 = ceil(0.9 * 10) = rank 9 -> index 8 -> 900
  assert.equal(m.p90, 900);
  // p99 = ceil(0.99 * 10) = rank 10 -> index 9 -> 1000
  assert.equal(m.p99, 1000);
  assert.equal(m.spread, 1000 / 500);
});

// ---- histogram bucketing --------------------------------------------------

test('bucket-intensity: histogram bands count observations correctly', () => {
  // observations: 500 (-> [1,1k)), 5_000 (-> [1k,10k)), 50_000 (-> [10k,100k)),
  // 500_000 (-> [100k,1M)), 5_000_000 (-> [1M,10M)), 50_000_000 (-> [10M,inf))
  const sizes = [500, 5_000, 50_000, 500_000, 5_000_000, 50_000_000];
  const lines: QueueLine[] = sizes.map((s, i) =>
    ql(`2026-04-${String(10 + i).padStart(2, '0')}T01:00:00Z`, {
      model: 'gpt-5',
      total_tokens: s,
    }),
  );
  const r = buildBucketIntensity(lines, { generatedAt: GEN });
  const m = r.models[0]!;
  assert.equal(m.buckets, 6);
  // each band gets exactly 1 observation
  for (const band of m.histogram) {
    assert.equal(band.count, 1, `band edge=${band.edge} should have count 1`);
    assert.ok(Math.abs(band.share - 1 / 6) < 1e-9);
  }
});

// ---- per-model isolation --------------------------------------------------

test('bucket-intensity: models are isolated; same hour for different models is two observations', () => {
  const r = buildBucketIntensity(
    [
      ql('2026-04-20T01:00:00Z', { model: 'gpt-5', total_tokens: 200 }),
      ql('2026-04-20T01:00:00Z', { model: 'claude-opus-4.7', total_tokens: 300 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.totalModels, 2);
  assert.equal(r.totalBuckets, 2);
  assert.equal(r.totalTokens, 500);
});

// ---- source filter --------------------------------------------------------

test('bucket-intensity: source filter excludes non-matching rows and surfaces drops', () => {
  const r = buildBucketIntensity(
    [
      ql('2026-04-20T01:00:00Z', { source: 'codex', total_tokens: 200 }),
      ql('2026-04-20T01:00:00Z', { source: 'opencode', total_tokens: 999 }),
    ],
    { source: 'codex', generatedAt: GEN },
  );
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.models[0]!.tokens, 200);
  assert.equal(r.source, 'codex');
});

// ---- sort modes -----------------------------------------------------------

test('bucket-intensity: sort=spread orders by p99/p50 desc with lex tiebreak', () => {
  // model A: flat (p50 = p99) -> spread 1
  // model B: tail-heavy (one big bucket among many small) -> high spread
  const lines: QueueLine[] = [];
  for (let i = 0; i < 5; i++) {
    lines.push(
      ql(`2026-04-${String(10 + i).padStart(2, '0')}T01:00:00Z`, {
        model: 'flat',
        total_tokens: 100,
      }),
    );
  }
  for (let i = 0; i < 9; i++) {
    lines.push(
      ql(`2026-04-${String(10 + i).padStart(2, '0')}T02:00:00Z`, {
        model: 'spiky',
        total_tokens: 100,
      }),
    );
  }
  // one giant bucket in spiky -> p99 will land on it
  lines.push(
    ql('2026-04-25T02:00:00Z', { model: 'spiky', total_tokens: 1_000_000 }),
  );
  const r = buildBucketIntensity(lines, { sort: 'spread', generatedAt: GEN });
  assert.equal(r.models[0]!.model, 'spiky');
  assert.ok(r.models[0]!.spread > 1);
  assert.equal(r.models[1]!.model, 'flat');
  assert.equal(r.models[1]!.spread, 1);
});

// ---- minBuckets + top composition ----------------------------------------

test('bucket-intensity: minBuckets and top compose; totals reflect full population', () => {
  // 3 models: a (1 bucket), b (2 buckets), c (3 buckets).
  const lines: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', { model: 'a', total_tokens: 100 }),
    ql('2026-04-20T02:00:00Z', { model: 'b', total_tokens: 100 }),
    ql('2026-04-20T03:00:00Z', { model: 'b', total_tokens: 100 }),
    ql('2026-04-20T04:00:00Z', { model: 'c', total_tokens: 100 }),
    ql('2026-04-20T05:00:00Z', { model: 'c', total_tokens: 100 }),
    ql('2026-04-20T06:00:00Z', { model: 'c', total_tokens: 100 }),
  ];
  const r = buildBucketIntensity(lines, {
    minBuckets: 2,
    top: 1,
    sort: 'buckets',
    generatedAt: GEN,
  });
  // population totals are over all 3 models
  assert.equal(r.totalModels, 3);
  assert.equal(r.totalBuckets, 6);
  assert.equal(r.totalTokens, 600);
  // min-buckets drops a; top=1 then keeps only c (3 buckets)
  assert.equal(r.droppedMinBuckets, 1);
  assert.equal(r.droppedTopModels, 1);
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.model, 'c');
});

// ---- window filter -------------------------------------------------------

test('bucket-intensity: since/until window applied before bucketing', () => {
  const r = buildBucketIntensity(
    [
      ql('2026-04-19T23:00:00Z', { total_tokens: 999 }), // before window
      ql('2026-04-20T01:00:00Z', { total_tokens: 100 }), // in
      ql('2026-04-20T02:00:00Z', { total_tokens: 200 }), // in
      ql('2026-04-21T00:00:00Z', { total_tokens: 999 }), // at upper edge (exclusive)
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
      generatedAt: GEN,
    },
  );
  assert.equal(r.totalBuckets, 2);
  assert.equal(r.totalTokens, 300);
});
