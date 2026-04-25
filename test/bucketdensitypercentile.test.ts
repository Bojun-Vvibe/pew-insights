import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildBucketDensityPercentile } from '../src/bucketdensitypercentile.js';
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

// ---- option validation ---------------------------------------------------

test('bucket-density-percentile: rejects bad since/until', () => {
  assert.throws(() => buildBucketDensityPercentile([], { since: 'not-a-date' }));
  assert.throws(() => buildBucketDensityPercentile([], { until: 'nope' }));
});

test('bucket-density-percentile: rejects bad minTokens', () => {
  assert.throws(() => buildBucketDensityPercentile([], { minTokens: -1 }));
  assert.throws(() => buildBucketDensityPercentile([], { minTokens: NaN }));
});

// ---- empty / dropped handling --------------------------------------------

test('bucket-density-percentile: empty queue -> empty report', () => {
  const r = buildBucketDensityPercentile([], { generatedAt: GEN });
  assert.equal(r.totalBuckets, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.min, null);
  assert.equal(r.p50, null);
  assert.equal(r.max, null);
  assert.equal(r.mean, null);
  assert.equal(r.deciles.length, 0);
});

test('bucket-density-percentile: drops bad hour_start, zero-tokens, source filter', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', { total_tokens: 100 }),
    ql('2026-04-20T00:00:00Z', { total_tokens: 0 }),
    ql('2026-04-20T01:00:00Z', { total_tokens: -5 }),
    ql('2026-04-20T02:00:00Z', { total_tokens: 100, source: 'codex' }),
    ql('2026-04-20T03:00:00Z', { total_tokens: 200, source: 'hermes' }),
  ];
  const r = buildBucketDensityPercentile(queue, {
    source: 'codex',
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.totalTokens, 100);
  assert.equal(r.source, 'codex');
});

// ---- percentile correctness ----------------------------------------------

test('bucket-density-percentile: percentile ladder on 100-bucket population', () => {
  // Build buckets with token counts 1..100, one per hour.
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 100; i += 1) {
    const hh = String(Math.floor((i - 1) / 24)).padStart(2, '0');
    const day = 20 + Math.floor((i - 1) / 24);
    const hour = ((i - 1) % 24).toString().padStart(2, '0');
    queue.push(
      ql(`2026-04-${String(day).padStart(2, '0')}T${hour}:00:00Z`, {
        total_tokens: i,
        // unique hour_start across the synthetic span — we shift days so
        // every observation is a distinct (source, hour_start) row.
      }),
    );
    void hh;
  }
  const r = buildBucketDensityPercentile(queue, { generatedAt: GEN });
  assert.equal(r.totalBuckets, 100);
  assert.equal(r.totalTokens, (100 * 101) / 2); // 5050
  assert.equal(r.min, 1);
  assert.equal(r.max, 100);
  // R-1 nearest-rank: ceil(p/100 * N) - 1 -> exact integer index.
  // p1 -> idx 0 -> value 1. p50 -> idx 49 -> value 50.
  assert.equal(r.p1, 1);
  assert.equal(r.p10, 10);
  assert.equal(r.p25, 25);
  assert.equal(r.p50, 50);
  assert.equal(r.p75, 75);
  assert.equal(r.p90, 90);
  assert.equal(r.p99, 99);
  assert.equal(r.p999, 100);
  assert.equal(r.mean, 50.5);
});

// ---- decile partitioning -------------------------------------------------

test('bucket-density-percentile: deciles partition 100 buckets into 10 slices of 10', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 100; i += 1) {
    const day = 20 + Math.floor((i - 1) / 24);
    const hour = ((i - 1) % 24).toString().padStart(2, '0');
    queue.push(
      ql(`2026-04-${String(day).padStart(2, '0')}T${hour}:00:00Z`, {
        total_tokens: i,
      }),
    );
  }
  const r = buildBucketDensityPercentile(queue, { generatedAt: GEN });
  assert.equal(r.deciles.length, 10);
  let sumCount = 0;
  let sumTokens = 0;
  let sumShare = 0;
  for (const d of r.deciles) {
    assert.equal(d.count, 10);
    sumCount += d.count;
    sumTokens += d.tokens;
    sumShare += d.tokenShare;
  }
  assert.equal(sumCount, 100);
  assert.equal(sumTokens, r.totalTokens);
  // share should sum to ~1.0 (within float tolerance)
  assert.ok(Math.abs(sumShare - 1.0) < 1e-9);
  // D1 holds [1..10], D10 holds [91..100]
  assert.equal(r.deciles[0].lowerEdge, 1);
  assert.equal(r.deciles[0].upperEdge, 10);
  assert.equal(r.deciles[0].tokens, 55);
  assert.equal(r.deciles[9].lowerEdge, 91);
  assert.equal(r.deciles[9].upperEdge, 100);
  assert.equal(r.deciles[9].tokens, 955);
});

test('bucket-density-percentile: small population (5 buckets) puts every observation in exactly one decile', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', { total_tokens: 10 }),
    ql('2026-04-20T01:00:00Z', { total_tokens: 20 }),
    ql('2026-04-20T02:00:00Z', { total_tokens: 30 }),
    ql('2026-04-20T03:00:00Z', { total_tokens: 40 }),
    ql('2026-04-20T04:00:00Z', { total_tokens: 50 }),
  ];
  const r = buildBucketDensityPercentile(queue, { generatedAt: GEN });
  assert.equal(r.totalBuckets, 5);
  let sumCount = 0;
  let sumTokens = 0;
  for (const d of r.deciles) {
    sumCount += d.count;
    sumTokens += d.tokens;
  }
  assert.equal(sumCount, 5);
  assert.equal(sumTokens, 150);
  // D10 always contains the max
  assert.equal(r.deciles[9].upperEdge, 50);
});

// ---- window filtering ----------------------------------------------------

test('bucket-density-percentile: --since/--until window narrows population', () => {
  const queue: QueueLine[] = [
    ql('2026-04-19T12:00:00Z', { total_tokens: 1000 }),
    ql('2026-04-20T12:00:00Z', { total_tokens: 100 }),
    ql('2026-04-20T13:00:00Z', { total_tokens: 200 }),
    ql('2026-04-21T12:00:00Z', { total_tokens: 9999 }),
  ];
  const r = buildBucketDensityPercentile(queue, {
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-21T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.totalBuckets, 2);
  assert.equal(r.totalTokens, 300);
  assert.equal(r.min, 100);
  assert.equal(r.max, 200);
});

// ---- --trim-top outlier trim --------------------------------------------

test('bucket-density-percentile: rejects bad trimTopPct', () => {
  assert.throws(() => buildBucketDensityPercentile([], { trimTopPct: -1 }));
  assert.throws(() => buildBucketDensityPercentile([], { trimTopPct: 100 }));
  assert.throws(() => buildBucketDensityPercentile([], { trimTopPct: 150 }));
  assert.throws(() => buildBucketDensityPercentile([], { trimTopPct: NaN }));
});

test('bucket-density-percentile: trimTopPct=0 is a true no-op', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 50; i += 1) {
    const day = 20 + Math.floor((i - 1) / 24);
    const hour = ((i - 1) % 24).toString().padStart(2, '0');
    queue.push(
      ql(`2026-04-${String(day).padStart(2, '0')}T${hour}:00:00Z`, {
        total_tokens: i,
      }),
    );
  }
  const a = buildBucketDensityPercentile(queue, { generatedAt: GEN });
  const b = buildBucketDensityPercentile(queue, { trimTopPct: 0, generatedAt: GEN });
  assert.equal(b.droppedTrimTop, 0);
  assert.equal(b.totalBuckets, a.totalBuckets);
  assert.equal(b.totalTokens, a.totalTokens);
  assert.equal(b.max, a.max);
  assert.equal(b.p50, a.p50);
});

test('bucket-density-percentile: trimTopPct=10 drops the 10 largest of 100 buckets', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 100; i += 1) {
    const day = 20 + Math.floor((i - 1) / 24);
    const hour = ((i - 1) % 24).toString().padStart(2, '0');
    queue.push(
      ql(`2026-04-${String(day).padStart(2, '0')}T${hour}:00:00Z`, {
        total_tokens: i,
      }),
    );
  }
  const r = buildBucketDensityPercentile(queue, { trimTopPct: 10, generatedAt: GEN });
  assert.equal(r.droppedTrimTop, 10);
  assert.equal(r.totalBuckets, 90);
  // After trim, surviving population is 1..90; max should be 90 not 100.
  assert.equal(r.max, 90);
  assert.equal(r.min, 1);
  assert.equal(r.totalTokens, (90 * 91) / 2); // 4095
  // Deciles still partition the post-trim 90 into 10 slices of 9 each.
  let sumCount = 0;
  for (const d of r.deciles) sumCount += d.count;
  assert.equal(sumCount, 90);
  assert.equal(r.deciles[9]!.upperEdge, 90);
});

test('bucket-density-percentile: trim is robust to one giant outlier (mean / p99 stabilise)', () => {
  // 99 small buckets + 1 enormous outlier.
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 99; i += 1) {
    const day = 20 + Math.floor((i - 1) / 24);
    const hour = ((i - 1) % 24).toString().padStart(2, '0');
    queue.push(
      ql(`2026-04-${String(day).padStart(2, '0')}T${hour}:00:00Z`, {
        total_tokens: 100,
      }),
    );
  }
  // Outlier on a fresh hour
  queue.push(ql('2026-04-30T00:00:00Z', { total_tokens: 1_000_000 }));
  const noTrim = buildBucketDensityPercentile(queue, { generatedAt: GEN });
  const trimmed = buildBucketDensityPercentile(queue, { trimTopPct: 1, generatedAt: GEN });
  // Without trim: max is 1M, mean is dragged way up by the outlier.
  assert.equal(noTrim.max, 1_000_000);
  // With 1% trim on N=100, drop 1 bucket (the outlier). Surviving pop is 99x100.
  assert.equal(trimmed.droppedTrimTop, 1);
  assert.equal(trimmed.totalBuckets, 99);
  assert.equal(trimmed.max, 100);
  assert.equal(trimmed.totalTokens, 9_900);
  assert.equal(trimmed.mean, 100);
});
