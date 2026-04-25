import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourcePairCooccurrence } from '../src/sourcepaircooccurrence.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hourStart: string,
  source: string,
  totalTokens: number,
): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: totalTokens,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

// ---- option validation ----------------------------------------------------

test('source-pair-cooccurrence: rejects bad topPairs', () => {
  assert.throws(() => buildSourcePairCooccurrence([], { topPairs: -1 }));
  assert.throws(() => buildSourcePairCooccurrence([], { topPairs: 1.5 }));
});

test('source-pair-cooccurrence: rejects bad minCount', () => {
  assert.throws(() => buildSourcePairCooccurrence([], { minCount: 0 }));
  assert.throws(() => buildSourcePairCooccurrence([], { minCount: -1 }));
});

test('source-pair-cooccurrence: rejects bad minJaccard', () => {
  assert.throws(() => buildSourcePairCooccurrence([], { minJaccard: -0.1 }));
  assert.throws(() => buildSourcePairCooccurrence([], { minJaccard: 1.5 }));
  assert.throws(() => buildSourcePairCooccurrence([], { minJaccard: NaN }));
});

test('source-pair-cooccurrence: rejects bad since/until', () => {
  assert.throws(() => buildSourcePairCooccurrence([], { since: 'nope' }));
  assert.throws(() => buildSourcePairCooccurrence([], { until: 'nope' }));
});

// ---- empty / single source ------------------------------------------------

test('source-pair-cooccurrence: empty queue -> zero everything', () => {
  const r = buildSourcePairCooccurrence([], { generatedAt: GEN });
  assert.equal(r.activeBuckets, 0);
  assert.equal(r.multiSourceBuckets, 0);
  assert.equal(r.cooccurrenceShare, 0);
  assert.equal(r.totalPairs, 0);
  assert.equal(r.distinctPairs, 0);
  assert.equal(r.dominantPair, null);
  assert.deepEqual(r.pairs, []);
  assert.equal(r.topPairs, 10);
  assert.equal(r.minCount, 1);
});

test('source-pair-cooccurrence: single-source buckets only -> 0 pairs', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 100),
    ql('2026-04-20T01:00:00.000Z', 'a', 100),
    ql('2026-04-20T02:00:00.000Z', 'b', 100),
  ];
  const r = buildSourcePairCooccurrence(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 3);
  assert.equal(r.multiSourceBuckets, 0);
  assert.equal(r.totalPairs, 0);
  assert.equal(r.distinctPairs, 0);
  assert.equal(r.dominantPair, null);
});

// ---- core co-occurrence math ---------------------------------------------

test('source-pair-cooccurrence: 2 sources in 1 bucket -> 1 pair, jaccard 1', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 100),
    ql('2026-04-20T00:00:00.000Z', 'b', 200),
  ];
  const r = buildSourcePairCooccurrence(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 1);
  assert.equal(r.multiSourceBuckets, 1);
  assert.equal(r.cooccurrenceShare, 1);
  assert.equal(r.totalPairs, 1);
  assert.equal(r.distinctPairs, 1);
  assert.equal(r.pairs.length, 1);
  assert.deepEqual(
    { a: r.pairs[0]!.a, b: r.pairs[0]!.b, count: r.pairs[0]!.count },
    { a: 'a', b: 'b', count: 1 },
  );
  assert.equal(r.pairs[0]!.jaccard, 1);
  assert.equal(r.pairs[0]!.share, 1);
  assert.deepEqual(r.dominantPair, { a: 'a', b: 'b', count: 1 });
});

test('source-pair-cooccurrence: 3 sources in 1 bucket -> C(3,2)=3 pairs', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 1),
    ql('2026-04-20T00:00:00.000Z', 'b', 1),
    ql('2026-04-20T00:00:00.000Z', 'c', 1),
  ];
  const r = buildSourcePairCooccurrence(q, { generatedAt: GEN });
  assert.equal(r.totalPairs, 3);
  assert.equal(r.distinctPairs, 3);
  assert.equal(r.pairs.length, 3);
  // All three pairs are present, each count=1, jaccard=1.
  for (const p of r.pairs) {
    assert.equal(p.count, 1);
    assert.equal(p.jaccard, 1);
  }
});

test('source-pair-cooccurrence: jaccard reflects asymmetric overlap', () => {
  // a appears in 3 buckets, b in 2, overlap in 1.
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 1),
    ql('2026-04-20T00:00:00.000Z', 'b', 1),
    ql('2026-04-20T01:00:00.000Z', 'a', 1),
    ql('2026-04-20T02:00:00.000Z', 'a', 1),
    ql('2026-04-20T03:00:00.000Z', 'b', 1),
  ];
  const r = buildSourcePairCooccurrence(q, { generatedAt: GEN });
  assert.equal(r.activeBuckets, 4);
  assert.equal(r.multiSourceBuckets, 1);
  assert.equal(r.distinctPairs, 1);
  // |A ∩ B| = 1, |A ∪ B| = 3 + 2 - 1 = 4 -> jaccard 0.25
  assert.equal(r.pairs[0]!.count, 1);
  assert.equal(r.pairs[0]!.jaccard, 0.25);
});

// ---- sorting --------------------------------------------------------------

test('source-pair-cooccurrence: sorts by count desc, then jaccard desc', () => {
  // {a,b}: count 2; {a,c}: count 2 but lower jaccard; {b,c}: count 1
  const q = [
    // bucket 1: a,b,c -> {a,b}, {a,c}, {b,c}
    ql('2026-04-20T00:00:00.000Z', 'a', 1),
    ql('2026-04-20T00:00:00.000Z', 'b', 1),
    ql('2026-04-20T00:00:00.000Z', 'c', 1),
    // bucket 2: a,b -> {a,b}
    ql('2026-04-20T01:00:00.000Z', 'a', 1),
    ql('2026-04-20T01:00:00.000Z', 'b', 1),
    // bucket 3: a,c -> {a,c}
    ql('2026-04-20T02:00:00.000Z', 'a', 1),
    ql('2026-04-20T02:00:00.000Z', 'c', 1),
    // bucket 4: c only -> raises c's bucket count, lowering jaccard for {a,c}
    ql('2026-04-20T03:00:00.000Z', 'c', 1),
    ql('2026-04-20T04:00:00.000Z', 'c', 1),
  ];
  const r = buildSourcePairCooccurrence(q, { generatedAt: GEN });
  // {a,b} count 2, jaccard = 2/(3+2-2)=2/3
  // {a,c} count 2, jaccard = 2/(3+4-2)=2/5
  // {b,c} count 1
  assert.equal(r.pairs[0]!.a, 'a');
  assert.equal(r.pairs[0]!.b, 'b');
  assert.equal(r.pairs[1]!.a, 'a');
  assert.equal(r.pairs[1]!.b, 'c');
  assert.equal(r.pairs[2]!.a, 'b');
  assert.equal(r.pairs[2]!.b, 'c');
});

// ---- filters and caps -----------------------------------------------------

test('source-pair-cooccurrence: minCount filters display only', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 1),
    ql('2026-04-20T00:00:00.000Z', 'b', 1),
    ql('2026-04-20T01:00:00.000Z', 'a', 1),
    ql('2026-04-20T01:00:00.000Z', 'b', 1),
    ql('2026-04-20T02:00:00.000Z', 'a', 1),
    ql('2026-04-20T02:00:00.000Z', 'c', 1),
  ];
  const r = buildSourcePairCooccurrence(q, {
    generatedAt: GEN,
    minCount: 2,
  });
  // {a,b} count 2 survives, {a,c} count 1 dropped.
  assert.equal(r.distinctPairs, 2); // pre-filter
  assert.equal(r.pairs.length, 1);
  assert.equal(r.droppedBelowMinCount, 1);
  assert.equal(r.pairs[0]!.a, 'a');
  assert.equal(r.pairs[0]!.b, 'b');
});

test('source-pair-cooccurrence: topPairs caps after sort', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 1),
    ql('2026-04-20T00:00:00.000Z', 'b', 1),
    ql('2026-04-20T00:00:00.000Z', 'c', 1),
    ql('2026-04-20T00:00:00.000Z', 'd', 1),
  ];
  const r = buildSourcePairCooccurrence(q, {
    generatedAt: GEN,
    topPairs: 2,
  });
  // C(4,2)=6 distinct pairs all count=1; cap to 2.
  assert.equal(r.distinctPairs, 6);
  assert.equal(r.pairs.length, 2);
  assert.equal(r.droppedBelowTopCap, 4);
});

test('source-pair-cooccurrence: topPairs=0 suppresses table but keeps stats', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 1),
    ql('2026-04-20T00:00:00.000Z', 'b', 1),
  ];
  const r = buildSourcePairCooccurrence(q, {
    generatedAt: GEN,
    topPairs: 0,
  });
  assert.equal(r.distinctPairs, 1);
  assert.equal(r.totalPairs, 1);
  assert.equal(r.pairs.length, 0);
  assert.equal(r.droppedBelowTopCap, 1);
  // dominantPair is computed pre-cap.
  assert.deepEqual(r.dominantPair, { a: 'a', b: 'b', count: 1 });
});

// ---- drops ----------------------------------------------------------------

test('source-pair-cooccurrence: counts drops for invalid rows', () => {
  const q = [
    ql('not-a-date', 'a', 100),
    ql('2026-04-20T00:00:00.000Z', 'a', 0),
    ql('2026-04-20T00:00:00.000Z', '', 100),
    ql('2026-04-20T00:00:00.000Z', 'a', 100),
    ql('2026-04-20T00:00:00.000Z', 'b', 100),
  ];
  const r = buildSourcePairCooccurrence(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.droppedEmptySource, 1);
  assert.equal(r.activeBuckets, 1);
  assert.equal(r.distinctPairs, 1);
});

// ---- window ---------------------------------------------------------------

test('source-pair-cooccurrence: since/until trims buckets', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 1),
    ql('2026-04-20T00:00:00.000Z', 'b', 1),
    ql('2026-04-21T00:00:00.000Z', 'a', 1),
    ql('2026-04-21T00:00:00.000Z', 'c', 1),
  ];
  const r = buildSourcePairCooccurrence(q, {
    generatedAt: GEN,
    since: '2026-04-21T00:00:00.000Z',
  });
  assert.equal(r.activeBuckets, 1);
  assert.equal(r.distinctPairs, 1);
  assert.equal(r.pairs[0]!.a, 'a');
  assert.equal(r.pairs[0]!.b, 'c');
  assert.equal(r.windowStart, '2026-04-21T00:00:00.000Z');
});

// ---- minJaccard filter ----------------------------------------------------

test('source-pair-cooccurrence: minJaccard drops low-jaccard pairs only', () => {
  // a in 3 buckets, b in 2, overlap 1 -> jaccard 0.25
  // a + c overlap also 1 but c only appears once -> jaccard 1/(3+1-1)=0.333
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 1),
    ql('2026-04-20T00:00:00.000Z', 'b', 1),
    ql('2026-04-20T01:00:00.000Z', 'a', 1),
    ql('2026-04-20T02:00:00.000Z', 'a', 1),
    ql('2026-04-20T02:00:00.000Z', 'c', 1),
    ql('2026-04-20T03:00:00.000Z', 'b', 1),
  ];
  const r = buildSourcePairCooccurrence(q, {
    generatedAt: GEN,
    minJaccard: 0.3,
  });
  // {a,b} jaccard 0.25 dropped; {a,c} jaccard ~0.333 survives.
  assert.equal(r.distinctPairs, 2); // pre-filter
  assert.equal(r.pairs.length, 1);
  assert.equal(r.droppedBelowMinJaccard, 1);
  assert.equal(r.pairs[0]!.a, 'a');
  assert.equal(r.pairs[0]!.b, 'c');
  assert.equal(r.minJaccard, 0.3);
});

test('source-pair-cooccurrence: minJaccard composes with minCount (count first, then jaccard, then top)', () => {
  // Build:
  //   {a,b}: count 2, jaccard high (a,b appear together in 2 of 2 buckets) -> 1.0
  //   {a,c}: count 1, jaccard 1.0 (only buckets together)
  //   {a,d}: count 1, jaccard low because d is everywhere else
  const q = [
    // bucket 0: a,b
    ql('2026-04-20T00:00:00.000Z', 'a', 1),
    ql('2026-04-20T00:00:00.000Z', 'b', 1),
    // bucket 1: a,b
    ql('2026-04-20T01:00:00.000Z', 'a', 1),
    ql('2026-04-20T01:00:00.000Z', 'b', 1),
    // bucket 2: a,c
    ql('2026-04-20T02:00:00.000Z', 'a', 1),
    ql('2026-04-20T02:00:00.000Z', 'c', 1),
    // bucket 3: a,d
    ql('2026-04-20T03:00:00.000Z', 'a', 1),
    ql('2026-04-20T03:00:00.000Z', 'd', 1),
    // d-everywhere noise
    ql('2026-04-20T04:00:00.000Z', 'd', 1),
    ql('2026-04-20T05:00:00.000Z', 'd', 1),
    ql('2026-04-20T06:00:00.000Z', 'd', 1),
  ];
  const r = buildSourcePairCooccurrence(q, {
    generatedAt: GEN,
    minCount: 2,
    minJaccard: 0.5,
  });
  // Pre-filter: 3 distinct pairs.
  // After minCount=2: only {a,b} (count 2) survives -> droppedBelowMinCount=2.
  // After minJaccard=0.5: {a,b} jaccard = 2/(4+2-2)=0.5 survives.
  assert.equal(r.distinctPairs, 3);
  assert.equal(r.droppedBelowMinCount, 2);
  assert.equal(r.droppedBelowMinJaccard, 0);
  assert.equal(r.pairs.length, 1);
  assert.equal(r.pairs[0]!.a, 'a');
  assert.equal(r.pairs[0]!.b, 'b');
});

test('source-pair-cooccurrence: minJaccard=0 is the no-op default', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 1),
    ql('2026-04-20T00:00:00.000Z', 'b', 1),
  ];
  const r = buildSourcePairCooccurrence(q, { generatedAt: GEN });
  assert.equal(r.minJaccard, 0);
  assert.equal(r.droppedBelowMinJaccard, 0);
  assert.equal(r.pairs.length, 1);
});

test('source-pair-cooccurrence: minJaccard boundary is inclusive (>=)', () => {
  // {a,b}: count 1, jaccard exactly 0.5 (a:1 bucket, b:1 bucket... actually
  // both in 1 of 1 bucket = jaccard 1). Force jaccard 0.5: a in 2 buckets,
  // b in 1, overlap 1 -> 1/(2+1-1)=0.5
  const q = [
    ql('2026-04-20T00:00:00.000Z', 'a', 1),
    ql('2026-04-20T00:00:00.000Z', 'b', 1),
    ql('2026-04-20T01:00:00.000Z', 'a', 1),
  ];
  const r = buildSourcePairCooccurrence(q, {
    generatedAt: GEN,
    minJaccard: 0.5,
  });
  assert.equal(r.pairs.length, 1);
  assert.equal(r.pairs[0]!.jaccard, 0.5);
  assert.equal(r.droppedBelowMinJaccard, 0);
});

// ---- determinism / JSON-shape regression ---------------------------------

test('source-pair-cooccurrence: report shape is JSON-stable across runs', () => {
  // Build a fixed corpus and verify two builds with the same opts emit
  // byte-identical JSON. Guards against accidental Map iteration order
  // leaks into output (Map iteration is insertion-ordered, but if we ever
  // start sourcing from a Set inside a hot loop without an explicit
  // .sort() the output becomes platform-dependent).
  const q = [
    ql('2026-04-20T05:00:00.000Z', 'zeta', 7),
    ql('2026-04-20T05:00:00.000Z', 'alpha', 3),
    ql('2026-04-20T03:00:00.000Z', 'mu', 1),
    ql('2026-04-20T03:00:00.000Z', 'alpha', 5),
    ql('2026-04-20T01:00:00.000Z', 'zeta', 2),
    ql('2026-04-20T01:00:00.000Z', 'mu', 4),
  ];
  const a = buildSourcePairCooccurrence(q, { generatedAt: GEN });
  const b = buildSourcePairCooccurrence(q, { generatedAt: GEN });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  // Spot-check the actual ordering: count is uniform (1) across all 3 pairs,
  // so jaccard desc then a asc breaks ties. All pairs have jaccard 1
  // (each source appears in exactly 1 bucket), so a-asc, b-asc wins.
  assert.deepEqual(
    a.pairs.map((p) => `${p.a}|${p.b}`),
    ['alpha|mu', 'alpha|zeta', 'mu|zeta'],
  );
});
