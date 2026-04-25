import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildBucketHandoffFrequency } from '../src/buckethandofffrequency.js';
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

test('bucket-handoff-frequency: rejects bad topHandoffs', () => {
  assert.throws(() =>
    buildBucketHandoffFrequency([], { topHandoffs: -1 }),
  );
  assert.throws(() =>
    buildBucketHandoffFrequency([], { topHandoffs: 1.5 }),
  );
});

test('bucket-handoff-frequency: rejects bad since/until', () => {
  assert.throws(() =>
    buildBucketHandoffFrequency([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildBucketHandoffFrequency([], { until: 'not-a-date' }),
  );
});

// ---- empty / single bucket ------------------------------------------------

test('bucket-handoff-frequency: empty queue -> zero everything', () => {
  const r = buildBucketHandoffFrequency([], { generatedAt: GEN });
  assert.equal(r.activeBuckets, 0);
  assert.equal(r.consideredPairs, 0);
  assert.equal(r.handoffPairs, 0);
  assert.equal(r.handoffShare, 0);
  assert.equal(r.stickiestModel, null);
  assert.equal(r.stickiestModelBuckets, 0);
  assert.deepEqual(r.pairs, []);
  assert.equal(r.topHandoffs, 10);
});

test('bucket-handoff-frequency: single bucket -> 0 pairs, stickiest is that model', () => {
  const q = [ql('2026-04-20T00:00:00.000Z', 's', 'opus', 100)];
  const r = buildBucketHandoffFrequency(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 1);
  assert.equal(r.consideredPairs, 0);
  assert.equal(r.handoffPairs, 0);
  assert.equal(r.handoffShare, 0);
  assert.equal(r.stickiestModel, 'opus');
  assert.equal(r.stickiestModelBuckets, 1);
});

// ---- core handoff math ----------------------------------------------------

test('bucket-handoff-frequency: 3 buckets same primary -> 0 handoffs', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 's', 'opus', 100),
    ql('2026-04-20T01:00:00.000Z', 's', 'opus', 100),
    ql('2026-04-20T02:00:00.000Z', 's', 'opus', 100),
  ];
  const r = buildBucketHandoffFrequency(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 3);
  assert.equal(r.consideredPairs, 2);
  assert.equal(r.handoffPairs, 0);
  assert.equal(r.handoffShare, 0);
  assert.equal(r.contiguousPairs, 2);
  assert.equal(r.gappedPairs, 0);
});

test('bucket-handoff-frequency: alternating models -> all pairs are handoffs', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 's', 'opus', 100),
    ql('2026-04-20T01:00:00.000Z', 's', 'sonnet', 100),
    ql('2026-04-20T02:00:00.000Z', 's', 'opus', 100),
  ];
  const r = buildBucketHandoffFrequency(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 3);
  assert.equal(r.consideredPairs, 2);
  assert.equal(r.handoffPairs, 2);
  assert.equal(r.handoffShare, 1);
  assert.equal(r.contiguousPairs, 2);
  assert.equal(r.contiguousHandoffs, 2);
  assert.equal(r.pairs.length, 2);
  // Top pair tie -> from asc, then to asc
  assert.deepEqual(r.pairs[0], { from: 'opus', to: 'sonnet', count: 1 });
  assert.deepEqual(r.pairs[1], { from: 'sonnet', to: 'opus', count: 1 });
});

test('bucket-handoff-frequency: primary = max-tokens model, ties broken lex', () => {
  // Bucket 0: opus 60, sonnet 40 -> opus.
  // Bucket 1: opus 40, sonnet 40 (tie) -> opus (lex).
  // No handoff.
  const q = [
    ql('2026-04-20T00:00:00.000Z', 's', 'opus', 60),
    ql('2026-04-20T00:00:00.000Z', 's', 'sonnet', 40),
    ql('2026-04-20T01:00:00.000Z', 's', 'opus', 40),
    ql('2026-04-20T01:00:00.000Z', 's', 'sonnet', 40),
  ];
  const r = buildBucketHandoffFrequency(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 2);
  assert.equal(r.handoffPairs, 0);
});

test('bucket-handoff-frequency: contiguous vs gapped split', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 's', 'opus', 100),
    ql('2026-04-20T01:00:00.000Z', 's', 'sonnet', 100), // contiguous handoff
    ql('2026-04-20T05:00:00.000Z', 's', 'opus', 100),    // gapped handoff
    ql('2026-04-20T06:00:00.000Z', 's', 'opus', 100),    // contiguous, no handoff
  ];
  const r = buildBucketHandoffFrequency(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 4);
  assert.equal(r.consideredPairs, 3);
  assert.equal(r.handoffPairs, 2);
  assert.equal(r.contiguousPairs, 2);
  assert.equal(r.gappedPairs, 1);
  assert.equal(r.contiguousHandoffs, 1);
  assert.equal(r.gappedHandoffs, 1);
});

// ---- top cap --------------------------------------------------------------

test('bucket-handoff-frequency: topHandoffs caps pairs and surfaces droppedBelowTopCap', () => {
  // Build many distinct from->to pairs.
  const q: QueueLine[] = [];
  const models = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];
  for (let i = 0; i < models.length; i += 1) {
    q.push(ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00.000Z`, 's', models[i]!, 100));
  }
  // 5 pairs, 5 distinct handoffs.
  const r = buildBucketHandoffFrequency(q, { topHandoffs: 2, generatedAt: GEN });
  assert.equal(r.handoffPairs, 5);
  assert.equal(r.pairs.length, 2);
  assert.equal(r.droppedBelowTopCap, 3);
  // topHandoffs=0 suppresses the table entirely.
  const r0 = buildBucketHandoffFrequency(q, { topHandoffs: 0, generatedAt: GEN });
  assert.equal(r0.pairs.length, 0);
  assert.equal(r0.droppedBelowTopCap, 5);
});

// ---- filters --------------------------------------------------------------

test('bucket-handoff-frequency: source filter restricts inputs', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'opencode', 'opus', 100),
    ql('2026-04-20T01:00:00.000Z', 'codex', 'sonnet', 100),
    ql('2026-04-20T02:00:00.000Z', 'opencode', 'opus', 100),
  ];
  const r = buildBucketHandoffFrequency(q, {
    source: 'opencode',
    generatedAt: GEN,
  });
  assert.equal(r.activeBuckets, 2);
  assert.equal(r.handoffPairs, 0); // both opencode buckets are 'opus'
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.source, 'opencode');
});

test('bucket-handoff-frequency: since/until window applies', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 's', 'opus', 100),
    ql('2026-04-20T01:00:00.000Z', 's', 'sonnet', 100),
    ql('2026-04-20T02:00:00.000Z', 's', 'opus', 100),
  ];
  const r = buildBucketHandoffFrequency(q, {
    since: '2026-04-20T01:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.activeBuckets, 2);
  assert.equal(r.handoffPairs, 1);
});

test('bucket-handoff-frequency: drops zero-token rows and bad hour_start', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 's', 'opus', 0),
    ql('not-a-date', 's', 'opus', 100),
    ql('2026-04-20T01:00:00.000Z', 's', 'sonnet', 100),
  ];
  const r = buildBucketHandoffFrequency(q, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.activeBuckets, 1);
});

test('bucket-handoff-frequency: empty model name surfaces droppedEmptyModelBuckets', () => {
  const q = [ql('2026-04-20T00:00:00.000Z', 's', '', 100)];
  const r = buildBucketHandoffFrequency(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 0);
  assert.equal(r.droppedEmptyModelBuckets, 1);
});

// ---- stickiest -----------------------------------------------------------

test('bucket-handoff-frequency: stickiest model = most-bucket primary, tiebreak tokens', () => {
  // opus primary in 2 buckets, sonnet primary in 1; opus wins.
  const q = [
    ql('2026-04-20T00:00:00.000Z', 's', 'opus', 100),
    ql('2026-04-20T01:00:00.000Z', 's', 'sonnet', 100),
    ql('2026-04-20T02:00:00.000Z', 's', 'opus', 100),
  ];
  const r = buildBucketHandoffFrequency(q, { generatedAt: GEN });
  assert.equal(r.stickiestModel, 'opus');
  assert.equal(r.stickiestModelBuckets, 2);
});
