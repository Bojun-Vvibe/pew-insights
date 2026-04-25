import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildInterSourceHandoffLatency } from '../src/intersourcehandofflatency.js';
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

test('inter-source-handoff-latency: rejects bad topHandoffs', () => {
  assert.throws(() =>
    buildInterSourceHandoffLatency([], { topHandoffs: -1 }),
  );
  assert.throws(() =>
    buildInterSourceHandoffLatency([], { topHandoffs: 1.5 }),
  );
});

test('inter-source-handoff-latency: rejects bad minHandoffs', () => {
  assert.throws(() =>
    buildInterSourceHandoffLatency([], { minHandoffs: 0 }),
  );
  assert.throws(() =>
    buildInterSourceHandoffLatency([], { minHandoffs: -1 }),
  );
});

test('inter-source-handoff-latency: rejects bad since/until', () => {
  assert.throws(() =>
    buildInterSourceHandoffLatency([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildInterSourceHandoffLatency([], { until: 'not-a-date' }),
  );
});

// ---- empty / single bucket ------------------------------------------------

test('inter-source-handoff-latency: empty queue -> zero everything', () => {
  const r = buildInterSourceHandoffLatency([], { generatedAt: GEN });
  assert.equal(r.activeBuckets, 0);
  assert.equal(r.consideredPairs, 0);
  assert.equal(r.handoffPairs, 0);
  assert.equal(r.handoffShare, 0);
  assert.equal(r.medianLatencyHours, null);
  assert.equal(r.meanLatencyHours, null);
  assert.equal(r.minLatencyHours, null);
  assert.equal(r.maxLatencyHours, null);
  assert.equal(r.dominantSource, null);
  assert.equal(r.dominantSourceBuckets, 0);
  assert.deepEqual(r.pairs, []);
  assert.equal(r.topHandoffs, 10);
});

test('inter-source-handoff-latency: single bucket -> 0 pairs', () => {
  const q = [ql('2026-04-20T00:00:00.000Z', 'claude', 'opus', 100)];
  const r = buildInterSourceHandoffLatency(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 1);
  assert.equal(r.consideredPairs, 0);
  assert.equal(r.handoffPairs, 0);
  assert.equal(r.medianLatencyHours, null);
  assert.equal(r.dominantSource, 'claude');
  assert.equal(r.dominantSourceBuckets, 1);
});

// ---- core handoff math ----------------------------------------------------

test('inter-source-handoff-latency: 3 buckets same primary -> 0 handoffs', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'claude', 'opus', 100),
    ql('2026-04-20T01:00:00.000Z', 'claude', 'opus', 100),
    ql('2026-04-20T02:00:00.000Z', 'claude', 'opus', 100),
  ];
  const r = buildInterSourceHandoffLatency(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 3);
  assert.equal(r.consideredPairs, 2);
  assert.equal(r.handoffPairs, 0);
  assert.equal(r.handoffShare, 0);
  assert.equal(r.medianLatencyHours, null);
});

test('inter-source-handoff-latency: alternating sources -> all pairs are handoffs, 1h latency', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'claude', 'opus', 100),
    ql('2026-04-20T01:00:00.000Z', 'codex', 'gpt', 100),
    ql('2026-04-20T02:00:00.000Z', 'claude', 'opus', 100),
  ];
  const r = buildInterSourceHandoffLatency(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 3);
  assert.equal(r.consideredPairs, 2);
  assert.equal(r.handoffPairs, 2);
  assert.equal(r.handoffShare, 1);
  assert.equal(r.contiguousHandoffs, 2);
  assert.equal(r.gappedHandoffs, 0);
  assert.equal(r.medianLatencyHours, 1);
  assert.equal(r.meanLatencyHours, 1);
  assert.equal(r.minLatencyHours, 1);
  assert.equal(r.maxLatencyHours, 1);
  assert.equal(r.pairs.length, 2);
});

test('inter-source-handoff-latency: gapped handoff measures real wall-clock', () => {
  // 00:00 claude, 05:00 codex (5h gap), 06:00 claude (1h gap)
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'claude', 'opus', 100),
    ql('2026-04-20T05:00:00.000Z', 'codex', 'gpt', 100),
    ql('2026-04-20T06:00:00.000Z', 'claude', 'opus', 100),
  ];
  const r = buildInterSourceHandoffLatency(q, { generatedAt: GEN });
  assert.equal(r.handoffPairs, 2);
  assert.equal(r.contiguousHandoffs, 1);
  assert.equal(r.gappedHandoffs, 1);
  assert.equal(r.minLatencyHours, 1);
  assert.equal(r.maxLatencyHours, 5);
  assert.equal(r.medianLatencyHours, 3);
  assert.equal(r.meanLatencyHours, 3);
});

test('inter-source-handoff-latency: primary = max-tokens source, ties broken lex', () => {
  // Bucket 0: claude 60, codex 40 -> claude.
  // Bucket 1: claude 40, codex 40 (tie) -> claude (lex).
  // No handoff.
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'claude', 'opus', 60),
    ql('2026-04-20T00:00:00.000Z', 'codex', 'gpt', 40),
    ql('2026-04-20T01:00:00.000Z', 'claude', 'opus', 40),
    ql('2026-04-20T01:00:00.000Z', 'codex', 'gpt', 40),
  ];
  const r = buildInterSourceHandoffLatency(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 2);
  assert.equal(r.handoffPairs, 0);
  assert.equal(r.dominantSource, 'claude');
});

test('inter-source-handoff-latency: empty source string -> bucket dropped', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', '', 'opus', 100),
    ql('2026-04-20T01:00:00.000Z', 'claude', 'opus', 100),
  ];
  const r = buildInterSourceHandoffLatency(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 1);
  assert.equal(r.droppedEmptySourceBuckets, 1);
  assert.equal(r.handoffPairs, 0);
});

test('inter-source-handoff-latency: zero/negative tokens dropped', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'claude', 'opus', 0),
    ql('2026-04-20T01:00:00.000Z', 'codex', 'gpt', -5),
    ql('2026-04-20T02:00:00.000Z', 'claude', 'opus', 100),
  ];
  const r = buildInterSourceHandoffLatency(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 1);
  assert.equal(r.droppedZeroTokens, 2);
});

test('inter-source-handoff-latency: bad hour_start dropped', () => {
  const q = [
    ql('not-a-date', 'claude', 'opus', 100),
    ql('2026-04-20T00:00:00.000Z', 'codex', 'gpt', 100),
  ];
  const r = buildInterSourceHandoffLatency(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.activeBuckets, 1);
});

// ---- pair table sort + per-pair stats -------------------------------------

test('inter-source-handoff-latency: top pair sorted by count desc, ties by median asc', () => {
  // claude->codex: 1h then 3h (median 2)
  // codex->claude: 1h then 1h (median 1)
  // count is 2 for both; tie broken by median asc -> codex->claude first.
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'claude', 'opus', 100),
    ql('2026-04-20T01:00:00.000Z', 'codex', 'gpt', 100),
    ql('2026-04-20T02:00:00.000Z', 'claude', 'opus', 100),
    ql('2026-04-20T05:00:00.000Z', 'codex', 'gpt', 100), // claude->codex gap=3h
    ql('2026-04-20T06:00:00.000Z', 'claude', 'opus', 100), // codex->claude gap=1h
  ];
  const r = buildInterSourceHandoffLatency(q, { generatedAt: GEN });
  assert.equal(r.handoffPairs, 4);
  assert.equal(r.pairs.length, 2);
  assert.equal(r.pairs[0]!.from, 'codex');
  assert.equal(r.pairs[0]!.to, 'claude');
  assert.equal(r.pairs[0]!.count, 2);
  assert.equal(r.pairs[0]!.medianLatencyHours, 1);
  assert.equal(r.pairs[1]!.from, 'claude');
  assert.equal(r.pairs[1]!.to, 'codex');
  assert.equal(r.pairs[1]!.count, 2);
  assert.equal(r.pairs[1]!.medianLatencyHours, 2);
});

test('inter-source-handoff-latency: topHandoffs cap and droppedBelowTopCap', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'm', 100),
    ql('2026-04-20T01:00:00.000Z', 'b', 'm', 100),
    ql('2026-04-20T02:00:00.000Z', 'c', 'm', 100),
    ql('2026-04-20T03:00:00.000Z', 'd', 'm', 100),
  ];
  // 3 distinct directed pairs, each count=1.
  const r = buildInterSourceHandoffLatency(q, {
    generatedAt: GEN,
    topHandoffs: 2,
  });
  assert.equal(r.handoffPairs, 3);
  assert.equal(r.pairs.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('inter-source-handoff-latency: minHandoffs floor hides rare pairs but keeps stats', () => {
  // a->b appears 2x, b->c appears 1x. minHandoffs=2 -> hide b->c.
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'm', 100),
    ql('2026-04-20T01:00:00.000Z', 'b', 'm', 100),
    ql('2026-04-20T02:00:00.000Z', 'c', 'm', 100),
    ql('2026-04-20T03:00:00.000Z', 'a', 'm', 100),
    ql('2026-04-20T04:00:00.000Z', 'b', 'm', 100),
  ];
  // Pairs: a->b, b->c, c->a, a->b. So a->b=2, others=1 each.
  const r = buildInterSourceHandoffLatency(q, {
    generatedAt: GEN,
    minHandoffs: 2,
  });
  assert.equal(r.handoffPairs, 4);
  assert.equal(r.pairs.length, 1);
  assert.equal(r.pairs[0]!.from, 'a');
  assert.equal(r.pairs[0]!.to, 'b');
  assert.equal(r.pairs[0]!.count, 2);
  assert.equal(r.droppedBelowMinHandoffs, 2);
});

test('inter-source-handoff-latency: window filter trims input', () => {
  const q = [
    ql('2026-04-19T00:00:00.000Z', 'claude', 'm', 100), // before
    ql('2026-04-20T00:00:00.000Z', 'codex', 'm', 100),
    ql('2026-04-20T01:00:00.000Z', 'claude', 'm', 100),
    ql('2026-04-21T00:00:00.000Z', 'codex', 'm', 100), // outside until
  ];
  const r = buildInterSourceHandoffLatency(q, {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-21T00:00:00.000Z',
  });
  assert.equal(r.activeBuckets, 2);
  assert.equal(r.handoffPairs, 1);
});

// ---- determinism ----------------------------------------------------------

test('inter-source-handoff-latency: deterministic across input order', () => {
  const a = [
    ql('2026-04-20T02:00:00.000Z', 'codex', 'm', 100),
    ql('2026-04-20T00:00:00.000Z', 'claude', 'm', 100),
    ql('2026-04-20T01:00:00.000Z', 'codex', 'm', 100),
  ];
  const b = [...a].reverse();
  const ra = buildInterSourceHandoffLatency(a, { generatedAt: GEN });
  const rb = buildInterSourceHandoffLatency(b, { generatedAt: GEN });
  assert.deepEqual(ra, rb);
});

// ---- maxLatencyHours flag -------------------------------------------------

test('inter-source-handoff-latency: rejects bad maxLatencyHours', () => {
  assert.throws(() =>
    buildInterSourceHandoffLatency([], { maxLatencyHours: 0 }),
  );
  assert.throws(() =>
    buildInterSourceHandoffLatency([], { maxLatencyHours: -1 }),
  );
  assert.throws(() =>
    buildInterSourceHandoffLatency([], { maxLatencyHours: NaN }),
  );
  assert.throws(() =>
    buildInterSourceHandoffLatency([], { maxLatencyHours: Infinity }),
  );
});

test('inter-source-handoff-latency: maxLatencyHours null = no cap (default)', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'm', 100),
    ql('2026-04-20T05:00:00.000Z', 'b', 'm', 100), // 5h
    ql('2026-04-20T06:00:00.000Z', 'a', 'm', 100), // 1h
  ];
  const r = buildInterSourceHandoffLatency(q, { generatedAt: GEN });
  assert.equal(r.maxLatencyCap, null);
  assert.equal(r.handoffPairs, 2);
  assert.equal(r.droppedAboveMaxLatency, 0);
});

test('inter-source-handoff-latency: maxLatencyHours excludes long handoffs from all stats', () => {
  // a->b (5h), b->a (1h), a->b (10h). With maxLatencyHours=4, drop the
  // 5h and 10h handoffs; only the 1h survives.
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'm', 100),
    ql('2026-04-20T05:00:00.000Z', 'b', 'm', 100),
    ql('2026-04-20T06:00:00.000Z', 'a', 'm', 100),
    ql('2026-04-20T16:00:00.000Z', 'b', 'm', 100),
  ];
  const rUnfiltered = buildInterSourceHandoffLatency(q, { generatedAt: GEN });
  assert.equal(rUnfiltered.handoffPairs, 3);
  assert.equal(rUnfiltered.droppedAboveMaxLatency, 0);

  const r = buildInterSourceHandoffLatency(q, {
    generatedAt: GEN,
    maxLatencyHours: 4,
  });
  assert.equal(r.maxLatencyCap, 4);
  assert.equal(r.handoffPairs, 1);
  assert.equal(r.droppedAboveMaxLatency, 2);
  assert.equal(r.medianLatencyHours, 1);
  assert.equal(r.meanLatencyHours, 1);
  assert.equal(r.minLatencyHours, 1);
  assert.equal(r.maxLatencyHours, 1); // stat: max of surviving latencies (just the 1h one)
  // The 1h survivor is contiguous; the 5h and 10h would have been gapped
  assert.equal(r.contiguousHandoffs, 1);
  assert.equal(r.gappedHandoffs, 0);
  // pairs[] only has the surviving b->a row
  assert.equal(r.pairs.length, 1);
  assert.equal(r.pairs[0]!.from, 'b');
  assert.equal(r.pairs[0]!.to, 'a');
  assert.equal(r.pairs[0]!.count, 1);
});

test('inter-source-handoff-latency: maxLatencyHours boundary is inclusive (== survives, > drops)', () => {
  // Exactly 4h handoff with maxLatencyHours=4 should survive.
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'm', 100),
    ql('2026-04-20T04:00:00.000Z', 'b', 'm', 100),
    // 4.5h handoff -> drops at maxLatencyHours=4
    ql('2026-04-20T08:30:00.000Z', 'a', 'm', 100),
  ];
  const r = buildInterSourceHandoffLatency(q, {
    generatedAt: GEN,
    maxLatencyHours: 4,
  });
  assert.equal(r.handoffPairs, 1);
  assert.equal(r.droppedAboveMaxLatency, 1);
  assert.equal(r.pairs[0]!.from, 'a');
  assert.equal(r.pairs[0]!.to, 'b');
  assert.equal(r.pairs[0]!.medianLatencyHours, 4);
});

test('inter-source-handoff-latency: maxLatencyHours preserves consideredPairs and activeBuckets', () => {
  // Even when handoffs are dropped, the underlying buckets remain
  // active and the considered-pair count is unchanged.
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'm', 100),
    ql('2026-04-20T10:00:00.000Z', 'b', 'm', 100), // 10h handoff
    ql('2026-04-20T11:00:00.000Z', 'a', 'm', 100), // 1h handoff
  ];
  const r = buildInterSourceHandoffLatency(q, {
    generatedAt: GEN,
    maxLatencyHours: 2,
  });
  assert.equal(r.activeBuckets, 3);
  assert.equal(r.consideredPairs, 2);
  assert.equal(r.handoffPairs, 1);
  assert.equal(r.droppedAboveMaxLatency, 1);
  // handoffShare uses the post-cap handoffPairs over consideredPairs
  assert.equal(r.handoffShare, 0.5);
});

test('inter-source-handoff-latency: maxLatencyHours composes with minHandoffs and topHandoffs', () => {
  // Build: a->b 3x at 1h each, b->a 1x at 1h, a->c 1x at 10h.
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'm', 100),
    ql('2026-04-20T01:00:00.000Z', 'b', 'm', 100), // a->b 1h
    ql('2026-04-20T02:00:00.000Z', 'a', 'm', 100), // b->a 1h
    ql('2026-04-20T03:00:00.000Z', 'b', 'm', 100), // a->b 1h
    ql('2026-04-20T04:00:00.000Z', 'a', 'm', 100), // b->a 1h
    ql('2026-04-20T05:00:00.000Z', 'b', 'm', 100), // a->b 1h
    ql('2026-04-20T15:00:00.000Z', 'c', 'm', 100), // b->c 10h - dropped
  ];
  // a->b: 3, b->a: 2, b->c: 1 (dropped by max=4) -> a->b: 3, b->a: 2
  const r = buildInterSourceHandoffLatency(q, {
    generatedAt: GEN,
    maxLatencyHours: 4,
    minHandoffs: 2,
  });
  assert.equal(r.droppedAboveMaxLatency, 1);
  assert.equal(r.handoffPairs, 5);
  assert.equal(r.pairs.length, 2);
  assert.equal(r.pairs[0]!.from, 'a');
  assert.equal(r.pairs[0]!.to, 'b');
  assert.equal(r.pairs[0]!.count, 3);
  assert.equal(r.pairs[1]!.from, 'b');
  assert.equal(r.pairs[1]!.to, 'a');
  assert.equal(r.pairs[1]!.count, 2);
});
