import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenPermutationEntropy,
  ordinalPatternCodeM3,
  permutationEntropyM3,
  PE_EMBEDDING_M,
  PE_PATTERN_COUNT,
} from '../src/dailytokenpermutationentropy.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-02T12:00:00.000Z';

// ---- ordinalPatternCodeM3 primitive ----------------------------------

test('ordinalPatternCodeM3: rejects non-finite values', () => {
  assert.throws(() => ordinalPatternCodeM3(NaN, 1, 2));
  assert.throws(() => ordinalPatternCodeM3(0, Infinity, 2));
  assert.throws(() => ordinalPatternCodeM3(0, 1, -Infinity));
});

test('ordinalPatternCodeM3: strictly-increasing -> code 0 (012)', () => {
  assert.equal(ordinalPatternCodeM3(1, 2, 3), 0);
  assert.equal(ordinalPatternCodeM3(-5, 0, 0.5), 0);
  assert.equal(ordinalPatternCodeM3(0, 1e-9, 1), 0);
});

test('ordinalPatternCodeM3: strictly-decreasing -> code 5 (210)', () => {
  assert.equal(ordinalPatternCodeM3(3, 2, 1), 5);
  assert.equal(ordinalPatternCodeM3(100, 50, -1), 5);
});

test('ordinalPatternCodeM3: peak at middle -> 021 or 120', () => {
  // 1, 5, 3 : ascending values are (1,3,5) at positions (0,2,1) -> pi=(0,2,1) = code 1 (021)
  assert.equal(ordinalPatternCodeM3(1, 5, 3), 1);
  // 3, 5, 1 : ascending (1,3,5) at positions (2,0,1) -> pi=(2,0,1) = code 4? No.
  // Let's check: smallest=1 at idx 2, then 3 at idx 0, then 5 at idx 1 -> pi=(2,0,1) = code 4 (201)
  // That's a valley-at-end, not a peak. Let's pick a clearer peak: 1, 9, 5
  // ascending (1,5,9) at positions (0,2,1) -> pi=(0,2,1) = code 1 (021), peak at middle.
  assert.equal(ordinalPatternCodeM3(1, 9, 5), 1);
  // 5, 9, 1: ascending (1,5,9) at positions (2,0,1) -> pi=(2,0,1) = code 4 (201)
  assert.equal(ordinalPatternCodeM3(5, 9, 1), 4);
});

test('ordinalPatternCodeM3: valley at middle -> 102 or 201', () => {
  // 5, 1, 9: ascending (1,5,9) at positions (1,0,2) -> pi=(1,0,2) = code 2 (102)
  assert.equal(ordinalPatternCodeM3(5, 1, 9), 2);
  // 9, 1, 5: ascending (1,5,9) at positions (1,2,0) -> pi=(1,2,0) = code 3 (120)
  assert.equal(ordinalPatternCodeM3(9, 1, 5), 3);
});

test('ordinalPatternCodeM3: covers all 6 patterns exhaustively on a permuted (1,2,3)', () => {
  // Each unique ordering of three distinct values must yield a unique code in 0..5.
  const seen = new Set<number>();
  const perms: [number, number, number][] = [
    [1, 2, 3],
    [1, 3, 2],
    [2, 1, 3],
    [3, 1, 2],
    [2, 3, 1],
    [3, 2, 1],
  ];
  for (const [a, b, c] of perms) {
    seen.add(ordinalPatternCodeM3(a, b, c));
  }
  assert.equal(seen.size, 6);
  for (let i = 0; i < 6; i += 1) assert.ok(seen.has(i));
});

test('ordinalPatternCodeM3: ties break earlier-index-wins -> all-equal triple is code 0', () => {
  // Cao 2004 deterministic tie-break: smaller index ranks lower.
  // Three equal values -> ascending order (idx 0, idx 1, idx 2) -> pi=(0,1,2) = 012 = code 0.
  assert.equal(ordinalPatternCodeM3(7, 7, 7), 0);
  assert.equal(ordinalPatternCodeM3(0, 0, 0), 0);
});

test('ordinalPatternCodeM3: pairwise tie -- earlier-wins disambiguation', () => {
  // (5, 5, 1): two 5s tied at idx 0 and 1. Smallest is 1 at idx 2.
  // Among the tied 5s, idx 0 < idx 1 so idx 0 ranks before idx 1.
  // ascending: (1@2, 5@0, 5@1) -> pi=(2,0,1) = code 4 (201).
  assert.equal(ordinalPatternCodeM3(5, 5, 1), 4);
  // (1, 5, 5): smallest 1@0, then 5@1, then 5@2.
  // pi=(0,1,2) = 012 = code 0.
  assert.equal(ordinalPatternCodeM3(1, 5, 5), 0);
  // (5, 1, 5): smallest 1@1, then 5@0 (earlier), then 5@2.
  // pi=(1,0,2) = code 2 (102).
  assert.equal(ordinalPatternCodeM3(5, 1, 5), 2);
});

// ---- permutationEntropyM3 primitive ----------------------------------

test('permutationEntropyM3: empty / too-short series -> flat', () => {
  for (const n of [0, 1, 2]) {
    const out = permutationEntropyM3(new Array(n).fill(0));
    assert.equal(out.flat, true);
    assert.equal(out.entropyNorm, 0);
    assert.equal(out.peakPattern, -1);
    assert.equal(out.peakShare, 0);
    assert.equal(out.patternShares.length, PE_PATTERN_COUNT);
    for (const s of out.patternShares) assert.equal(s, 0);
  }
});

test('permutationEntropyM3: strictly-increasing ramp -> H_PE = 0, only pattern 012', () => {
  // x = [0, 1, 2, ..., 9]: every length-3 window is strictly increasing.
  const xs = Array.from({ length: 10 }, (_, i) => i);
  const out = permutationEntropyM3(xs);
  assert.equal(out.flat, false);
  assert.equal(out.entropyNorm, 0);
  assert.equal(out.peakPattern, 0);
  assert.equal(out.peakShare, 1);
  assert.equal(out.patternShares[0], 1);
  for (let i = 1; i < PE_PATTERN_COUNT; i += 1) {
    assert.equal(out.patternShares[i], 0);
  }
});

test('permutationEntropyM3: strictly-decreasing ramp -> H_PE = 0, only pattern 210', () => {
  const xs = Array.from({ length: 10 }, (_, i) => 9 - i);
  const out = permutationEntropyM3(xs);
  assert.equal(out.entropyNorm, 0);
  assert.equal(out.peakPattern, 5);
  assert.equal(out.peakShare, 1);
});

test('permutationEntropyM3: constant series -> H_PE = 0 (every window is all-tied -> code 0)', () => {
  const xs = new Array(20).fill(7);
  const out = permutationEntropyM3(xs);
  assert.equal(out.flat, false);
  assert.equal(out.entropyNorm, 0);
  // All windows reduce to code 0 under earlier-index-wins tie-break.
  assert.equal(out.peakPattern, 0);
  assert.equal(out.peakShare, 1);
});

test('permutationEntropyM3: H_PE in [0, 1] for any non-empty series', () => {
  // Stress test 50 random length-30 series.
  let seed = 12345;
  function rng(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }
  for (let trial = 0; trial < 50; trial += 1) {
    const xs = Array.from({ length: 30 }, () => rng());
    const out = permutationEntropyM3(xs);
    assert.ok(out.entropyNorm >= 0, `trial ${trial} H_PE >= 0`);
    assert.ok(out.entropyNorm <= 1, `trial ${trial} H_PE <= 1`);
    assert.ok(out.peakShare >= 0 && out.peakShare <= 1);
    let psum = 0;
    for (const p of out.patternShares) psum += p;
    assert.ok(Math.abs(psum - 1) < 1e-12);
  }
});

test('permutationEntropyM3: monotone-affine-invariant on x -> a*x + b with a > 0', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7];
  const ys = xs.map((v) => 17 * v + 42);
  const a = permutationEntropyM3(xs);
  const b = permutationEntropyM3(ys);
  assert.equal(a.entropyNorm, b.entropyNorm);
  assert.equal(a.peakPattern, b.peakPattern);
  assert.equal(a.peakShare, b.peakShare);
  for (let i = 0; i < PE_PATTERN_COUNT; i += 1) {
    assert.equal(a.patternShares[i], b.patternShares[i]);
  }
});

test('permutationEntropyM3: monotone-decreasing affine x -> -x reverses the patterns', () => {
  // Negation reverses every comparison, so pattern code k maps to its
  // canonical reverse partner. E.g. 012 (strictly inc) -> 210, 021 -> 120,
  // 102 -> 201. Total entropy should be unchanged though, since |S_3|
  // counts are just reordered.
  const xs = [1, 2, 3, 5, 4, 7, 6, 8, 0, -1];
  const a = permutationEntropyM3(xs);
  const b = permutationEntropyM3(xs.map((v) => -v));
  assert.ok(Math.abs(a.entropyNorm - b.entropyNorm) < 1e-12);
});

test('permutationEntropyM3: zigzag (..., 0, 1, 0, 1, ...) populates only patterns 102 and 021', () => {
  // x = [0,1,0,1,0,1,0,1,0,1] (length 10). Each length-3 window is
  // either (0,1,0) -> code 2 (102) or (1,0,1) -> code 1 (021).
  const xs = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
  const out = permutationEntropyM3(xs);
  // 8 windows, alternating between the two patterns, so 4 each.
  assert.equal(out.patternShares[0], 0);
  assert.equal(out.patternShares[3], 0);
  assert.equal(out.patternShares[4], 0);
  assert.equal(out.patternShares[5], 0);
  assert.ok(out.patternShares[1]! > 0);
  assert.ok(out.patternShares[2]! > 0);
  // H_PE = ln(2) / ln(6) = 0.3868...
  assert.ok(Math.abs(out.entropyNorm - Math.log(2) / Math.log(6)) < 1e-12);
});

// ---- builder validation ----------------------------------------------

test('builder: rejects negative minTokens', () => {
  assert.throws(() =>
    buildDailyTokenPermutationEntropy([], { minTokens: -1, generatedAt: GEN }),
  );
});

test('builder: rejects minTenureDays < 4 (m+1 floor)', () => {
  assert.throws(() =>
    buildDailyTokenPermutationEntropy([], { minTenureDays: 3, generatedAt: GEN }),
  );
});

test('builder: rejects non-integer top', () => {
  assert.throws(() =>
    buildDailyTokenPermutationEntropy([], { top: 1.5, generatedAt: GEN }),
  );
});

test('builder: rejects maxEntropy outside [0, 1]', () => {
  assert.throws(() =>
    buildDailyTokenPermutationEntropy([], { maxEntropy: 1.5, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenPermutationEntropy([], { maxEntropy: -0.1, generatedAt: GEN }),
  );
});

test('builder: rejects unknown sort key', () => {
  assert.throws(() =>
    buildDailyTokenPermutationEntropy([], {
      sort: 'bogus' as never,
      generatedAt: GEN,
    }),
  );
});

test('builder: invalid hour_start surfaces as droppedInvalidHourStart', () => {
  const r = buildDailyTokenPermutationEntropy(
    [{ ...ql('not-a-date', 's', 100), hour_start: 'not-a-date' }],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 0);
});

test('builder: non-positive total_tokens surface as droppedNonPositiveTokens', () => {
  const r = buildDailyTokenPermutationEntropy(
    [
      ql('2026-04-01T00:00:00.000Z', 's', 0),
      ql('2026-04-01T01:00:00.000Z', 's', -5),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('builder: source filter restricts and drops the rest', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    const day = `2026-04-${String(1 + d).padStart(2, '0')}T00:00:00.000Z`;
    queue.push(ql(day, 'A', 1000 + d * 50));
    queue.push(ql(day, 'B', 500));
  }
  const r = buildDailyTokenPermutationEntropy(queue, {
    source: 'A',
    minTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.source, 'A');
  assert.equal(r.droppedSourceFilter, 20);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
});

test('builder: minTokens drops below-floor sources', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 14; d += 1) {
    const day = `2026-04-${String(1 + d).padStart(2, '0')}T00:00:00.000Z`;
    queue.push(ql(day, 'tiny', 10));
  }
  const r = buildDailyTokenPermutationEntropy(queue, {
    minTokens: 1000,
    generatedAt: GEN,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('builder: minTenureDays drops short-tenure sources', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 5; d += 1) {
    const day = `2026-04-${String(1 + d).padStart(2, '0')}T00:00:00.000Z`;
    queue.push(ql(day, 's', 1000));
  }
  const r = buildDailyTokenPermutationEntropy(queue, {
    minTokens: 0,
    minTenureDays: 14,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('builder: gap-fill produces dense [first, last] series with zeros for missing days', () => {
  // 14-day tenure with only days 0, 7, 13 active.
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's', 5000),
    ql('2026-04-08T00:00:00.000Z', 's', 4000),
    ql('2026-04-14T00:00:00.000Z', 's', 3000),
  ];
  const r = buildDailyTokenPermutationEntropy(queue, {
    minTokens: 0,
    minTenureDays: 14,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.nTenureDays, 14);
  assert.equal(s.nActiveDays, 3);
  assert.equal(s.nWindows, 12);
});

test('builder: monotone-increasing daily series -> H_PE = 0', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    const day = `2026-04-${String(1 + d).padStart(2, '0')}T00:00:00.000Z`;
    queue.push(ql(day, 's', 1000 + d * 100));
  }
  const r = buildDailyTokenPermutationEntropy(queue, {
    minTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.flat, false);
  assert.equal(s.entropyNorm, 0);
  assert.equal(s.peakPattern, 0); // 012
  assert.equal(s.peakShare, 1);
});

test('builder: sort entropy ascending puts lowest-H_PE first; entropyDesc reverses', () => {
  const queue: QueueLine[] = [];
  // Source A: monotone increasing -> H_PE = 0
  // Source B: zigzag 0/1 -> H_PE = ln(2)/ln(6) ~ 0.387
  for (let d = 0; d < 20; d += 1) {
    const day = `2026-04-${String(1 + d).padStart(2, '0')}T00:00:00.000Z`;
    queue.push(ql(day, 'A', 1000 + d * 100));
    queue.push(ql(day, 'B', d % 2 === 0 ? 1000 : 2000));
  }
  const asc = buildDailyTokenPermutationEntropy(queue, {
    minTokens: 0,
    sort: 'entropy',
    generatedAt: GEN,
  });
  assert.equal(asc.sources[0]!.source, 'A');
  assert.equal(asc.sources[1]!.source, 'B');
  const desc = buildDailyTokenPermutationEntropy(queue, {
    minTokens: 0,
    sort: 'entropyDesc',
    generatedAt: GEN,
  });
  assert.equal(desc.sources[0]!.source, 'B');
  assert.equal(desc.sources[1]!.source, 'A');
});

test('builder: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c', 'd']) {
    for (let d = 0; d < 16; d += 1) {
      const day = `2026-04-${String(1 + d).padStart(2, '0')}T00:00:00.000Z`;
      queue.push(ql(day, src, 1000 + d * 10));
    }
  }
  const r = buildDailyTokenPermutationEntropy(queue, {
    minTokens: 0,
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('builder: maxEntropy filter surfaces droppedAboveMaxEntropy', () => {
  const queue: QueueLine[] = [];
  // A monotone (H_PE=0) + B zigzag (H_PE ~0.387) + C noisy (high H_PE)
  for (let d = 0; d < 20; d += 1) {
    const day = `2026-04-${String(1 + d).padStart(2, '0')}T00:00:00.000Z`;
    queue.push(ql(day, 'A', 1000 + d));
    queue.push(ql(day, 'B', d % 2 === 0 ? 1000 : 2000));
  }
  const r = buildDailyTokenPermutationEntropy(queue, {
    minTokens: 0,
    maxEntropy: 0.1, // only H_PE near 0
    generatedAt: GEN,
  });
  // A (H_PE=0) survives, B (H_PE~0.387) dropped.
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
  assert.equal(r.droppedAboveMaxEntropy, 1);
});

test('builder: since/until window filter on hour_start', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 30; d += 1) {
    const day = `2026-04-${String(1 + d).padStart(2, '0')}T00:00:00.000Z`;
    queue.push(ql(day, 's', 1000));
  }
  const r = buildDailyTokenPermutationEntropy(queue, {
    minTokens: 0,
    since: '2026-04-10T00:00:00.000Z',
    until: '2026-04-25T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.windowStart, '2026-04-10T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-25T00:00:00.000Z');
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.firstActiveDay, '2026-04-10');
  assert.equal(r.sources[0]!.lastActiveDay, '2026-04-24');
});

// ---- structural-orthogonality witnesses ------------------------------

test('orthogonality: sorted vs shuffled multiset -- H_PE differs sharply, multiset stats identical', () => {
  // Sorted [0..19] has H_PE = 0 (only pattern 012).
  // A specific deterministic shuffle should produce H_PE > 0.5.
  const sorted = Array.from({ length: 20 }, (_, i) => i);
  const shuffled = [3, 17, 1, 12, 8, 19, 4, 0, 14, 11, 7, 5, 16, 2, 18, 9, 10, 6, 15, 13];
  const a = permutationEntropyM3(sorted);
  const b = permutationEntropyM3(shuffled);
  assert.equal(a.entropyNorm, 0);
  assert.ok(b.entropyNorm > 0.7, `shuffled H_PE should be > 0.7, got ${b.entropyNorm}`);
  // Multiset is identical -> any permutation-invariant statistic
  // (mean, variance, gini, sorted ordering) is the same.
  const meanA = sorted.reduce((s, v) => s + v, 0) / 20;
  const meanB = shuffled.reduce((s, v) => s + v, 0) / 20;
  assert.equal(meanA, meanB);
});

test('orthogonality vs spectral entropy: a non-linear monotone curve has H_PE = 0 but a non-trivial spectrum', () => {
  // Exponential growth: x = 1.1 ** d, strictly monotone.
  const xs = Array.from({ length: 30 }, (_, d) => 1.1 ** d);
  const out = permutationEntropyM3(xs);
  // H_PE = 0 because every window is strictly increasing (only code 0).
  assert.equal(out.entropyNorm, 0);
  assert.equal(out.peakPattern, 0);
  // But the underlying series has non-trivial spectral content (exponential
  // growth concentrates power at low frequency bins, not at one bin), so
  // axis-69 and axis-70 capture different things.
});
