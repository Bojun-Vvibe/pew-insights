import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenPermutationEntropy } from '../src/sourcerowtokenpermutationentropy.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
  model = 'm1',
  device_id = 'd1',
): QueueLine {
  return {
    source,
    model,
    hour_start,
    device_id,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

function series(values: number[], src = 's'): QueueLine[] {
  return values.map((v, i) => {
    const hh = Math.floor(i / 60) % 24;
    const mm = i % 60;
    const day = 25 + Math.floor(i / (24 * 60));
    return ql(
      `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
      src,
      v,
    );
  });
}

test('permutation-entropy: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenPermutationEntropy([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.order, 3);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'pe-asc');
  assert.equal(r.generatedAt, GEN);
});

test('permutation-entropy: strict monotone series -> PE = 0, dominant pattern = [0,1,2] (lex 0)', () => {
  const data = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = buildSourceRowTokenPermutationEntropy(data, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.rowsKept, 10);
  assert.equal(s.windowCount, 8);
  assert.equal(s.distinctPatterns, 1);
  assert.equal(s.entropyNats, 0);
  assert.equal(s.permutationEntropy, 0);
  assert.equal(s.dominantPattern, 0); // [0,1,2]
  assert.equal(s.dominantPatternFraction, 1);
  assert.equal(s.tieWindowFraction, 0);
});

test('permutation-entropy: strict anti-monotone -> PE = 0, dominant pattern = [2,1,0] (lex 5)', () => {
  const data = series([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  const r = buildSourceRowTokenPermutationEntropy(data, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.distinctPatterns, 1);
  assert.equal(s.permutationEntropy, 0);
  assert.equal(s.dominantPattern, 5); // [2,1,0]
  assert.equal(s.dominantPatternFraction, 1);
  assert.equal(s.tieWindowFraction, 0);
});

test('permutation-entropy: perfectly alternating series -> PE = ln(2)/ln(6) ~ 0.3869', () => {
  // 10 values: 1,10,1,10,1,10,1,10,1,10 -> 8 windows, alternating
  // [1,10,1] -> ranks [0,2,1] (low-high-low) -> lex 1
  // [10,1,10] -> ranks [1,0,2] (with j<k tiebreak: indices of 10 are 0 and 2; rank for k=0: count j!=0 with v<10 -> j=1 (v=1<10) yes -> 1; for v==10: j=2, j>k so no add -> rank 1.
  //   k=2: count j!=2 with v<10 -> j=1 (1<10) yes -> 1; v==10 j=0, j<k yes -> +1 -> rank 2. So [1,0,2] -> lex 2.
  // Each pattern occurs 4 times -> p=0.5 each -> H = ln 2.
  // Every window contains a repeated value (1 appears twice or 10 appears twice)
  // -> tieWindowFraction = 1.
  const data = series([1, 10, 1, 10, 1, 10, 1, 10, 1, 10]);
  const r = buildSourceRowTokenPermutationEntropy(data, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.windowCount, 8);
  assert.equal(s.distinctPatterns, 2);
  // Each pattern occurs 4 times -> p=0.5 each -> H = ln 2
  assert.ok(Math.abs(s.entropyNats - Math.log(2)) < 1e-12);
  const expectedPE = Math.log(2) / Math.log(6);
  assert.ok(
    Math.abs(s.permutationEntropy - expectedPE) < 1e-12,
    `PE ${s.permutationEntropy} != ${expectedPE}`,
  );
  assert.equal(s.dominantPattern, 1);
  assert.ok(Math.abs(s.dominantPatternFraction - 0.5) < 1e-12);
  assert.equal(s.tieWindowFraction, 1);
});

test('permutation-entropy: all-equal values -> PE = 0, identity pattern, tieWindowFraction = 1', () => {
  const data = series([5, 5, 5, 5, 5, 5, 5, 5]);
  const r = buildSourceRowTokenPermutationEntropy(data, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.windowCount, 6);
  assert.equal(s.distinctPatterns, 1);
  assert.equal(s.permutationEntropy, 0);
  assert.equal(s.dominantPattern, 0); // identity [0,1,2] under j<k tiebreak
  assert.equal(s.dominantPatternFraction, 1);
  assert.equal(s.tieWindowFraction, 1);
});

test('permutation-entropy: order=2 on alternating -> PE = 1 (both m=2 patterns equally likely)', () => {
  // For m=2, only 2 patterns: [0,1] (asc) lex 0, [1,0] (desc) lex 1.
  // Length-9 alternating series 1,10,1,10... -> 8 windows alternating asc/desc -> 4 each.
  // Each p=0.5 -> H=ln2 -> PE = ln2/ln2 = 1.
  const data = series([1, 10, 1, 10, 1, 10, 1, 10, 1]);
  const r = buildSourceRowTokenPermutationEntropy(data, {
    generatedAt: GEN,
    order: 2,
    minRows: 4,
  });
  const s = r.sources[0]!;
  assert.equal(s.windowCount, 8);
  assert.equal(s.distinctPatterns, 2);
  assert.ok(Math.abs(s.permutationEntropy - 1) < 1e-12);
});

test('permutation-entropy: order=2 strict monotone -> PE = 0', () => {
  const data = series([1, 2, 3, 4, 5, 6]);
  const r = buildSourceRowTokenPermutationEntropy(data, {
    generatedAt: GEN,
    order: 2,
    minRows: 4,
  });
  const s = r.sources[0]!;
  assert.equal(s.permutationEntropy, 0);
  assert.equal(s.dominantPattern, 0);
});

test('permutation-entropy: rejects fewer than minRows', () => {
  const data = series([1, 2, 3, 4, 5]); // n=5, default minRows=8
  const r = buildSourceRowTokenPermutationEntropy(data, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.totalRowsKept, 5);
});

test('permutation-entropy: validates order range', () => {
  assert.throws(
    () => buildSourceRowTokenPermutationEntropy([], { order: 1 }),
    /order must be an integer in \[2, 6\]/,
  );
  assert.throws(
    () => buildSourceRowTokenPermutationEntropy([], { order: 7 }),
    /order must be an integer in \[2, 6\]/,
  );
  assert.throws(
    () => buildSourceRowTokenPermutationEntropy([], { order: 2.5 }),
    /order must be an integer in \[2, 6\]/,
  );
});

test('permutation-entropy: validates minRows >= order+2', () => {
  assert.throws(
    () => buildSourceRowTokenPermutationEntropy([], { order: 3, minRows: 4 }),
    /minRows must be an integer >= order\+2/,
  );
  // boundary: order=3 minRows=5 OK
  const r = buildSourceRowTokenPermutationEntropy([], { order: 3, minRows: 5 });
  assert.equal(r.minRows, 5);
});

test('permutation-entropy: validates sort key', () => {
  assert.throws(
    () => buildSourceRowTokenPermutationEntropy([], { sort: 'bogus' as never }),
    /sort must be one of/,
  );
});

test('permutation-entropy: window/since-until filtering', () => {
  const data = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = buildSourceRowTokenPermutationEntropy(data, {
    generatedAt: GEN,
    since: '2026-04-25T00:03:00Z',
    until: '2026-04-25T00:08:00Z',
  });
  // keeps rows at minute 3,4,5,6,7 -> values 4,5,6,7,8 -> n=5 < default minRows=8
  assert.equal(r.totalRowsKept, 5);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('permutation-entropy: source filter drops other sources', () => {
  const a = series([1, 2, 3, 4, 5, 6, 7, 8], 'A');
  const b = series([10, 20, 30, 40, 50, 60, 70, 80], 'B');
  const r = buildSourceRowTokenPermutationEntropy([...a, ...b], {
    generatedAt: GEN,
    source: 'A',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
  assert.equal(r.droppedSourceFilter, 8);
});

test('permutation-entropy: drops bad hour_start, bad/negative tokens', () => {
  const good = series([1, 2, 3, 4, 5, 6, 7, 8]);
  const bad: QueueLine[] = [
    ql('not-a-date', 's', 5),
    ql('2026-04-25T00:00:00Z', 's', NaN),
    ql('2026-04-25T00:00:00Z', 's', -3),
  ];
  const r = buildSourceRowTokenPermutationEntropy([...good, ...bad], {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
});

test('permutation-entropy: sort pe-desc puts most-complex source first', () => {
  // "regular" source: monotone -> PE = 0
  // "complex" source: alternating -> PE = ln2/ln6 ~ 0.3869
  // Both sources need >= minRows = 8 rows.
  const reg = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'regular');
  const cpx = series(
    [1, 10, 1, 10, 1, 10, 1, 10, 1, 10],
    'complex',
  ).map((q, i) => ({
    ...q,
    // shift to a different day so the two sources sort independently
    hour_start: q.hour_start.replace('2026-04-25', '2026-04-26'),
  }));
  const all = [...reg, ...cpx];
  const rDesc = buildSourceRowTokenPermutationEntropy(all, {
    generatedAt: GEN,
    sort: 'pe-desc',
  });
  assert.equal(rDesc.sources.length, 2);
  assert.equal(rDesc.sources[0]!.source, 'complex');
  assert.equal(rDesc.sources[1]!.source, 'regular');
  const rAsc = buildSourceRowTokenPermutationEntropy(all, {
    generatedAt: GEN,
    sort: 'pe-asc',
  });
  assert.equal(rAsc.sources[0]!.source, 'regular');
  assert.equal(rAsc.sources[1]!.source, 'complex');
});

test('permutation-entropy: top cap surfaces droppedBelowTopCap', () => {
  const a = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'A');
  const b = series([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 'B').map((q) => ({
    ...q,
    hour_start: q.hour_start.replace('2026-04-25', '2026-04-26'),
  }));
  const c = series(
    [1, 10, 1, 10, 1, 10, 1, 10, 1, 10],
    'C',
  ).map((q) => ({
    ...q,
    hour_start: q.hour_start.replace('2026-04-25', '2026-04-27'),
  }));
  const r = buildSourceRowTokenPermutationEntropy([...a, ...b, ...c], {
    generatedAt: GEN,
    top: 2,
    sort: 'pe-asc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('permutation-entropy: out-of-order rows are sorted by hour_start before windowing', () => {
  // build the monotone series, then shuffle insertion order.
  const monotone = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const shuffled = [
    monotone[7]!,
    monotone[2]!,
    monotone[9]!,
    monotone[0]!,
    monotone[5]!,
    monotone[1]!,
    monotone[6]!,
    monotone[8]!,
    monotone[3]!,
    monotone[4]!,
  ];
  const r = buildSourceRowTokenPermutationEntropy(shuffled, {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  // After re-sort by hour_start the values are 1..10, identity pattern only.
  assert.equal(s.distinctPatterns, 1);
  assert.equal(s.permutationEntropy, 0);
  assert.equal(s.dominantPattern, 0);
});

test('permutation-entropy: known three-pattern fixture has correct H and PE', () => {
  // Construct a length-5 series by hand at order m=3 -> 3 windows.
  // values: [1, 3, 2, 5, 4]
  // window 0 [1,3,2]: rank of 1=0, rank of 3=2, rank of 2=1 -> [0,2,1] = lex 1
  // window 1 [3,2,5]: rank of 3=1, rank of 2=0, rank of 5=2 -> [1,0,2] = lex 2
  // window 2 [2,5,4]: rank of 2=0, rank of 5=2, rank of 4=1 -> [0,2,1] = lex 1
  // counts: lex1=2, lex2=1. p=2/3, 1/3. H = -(2/3)ln(2/3) - (1/3)ln(1/3)
  const data = series([1, 3, 2, 5, 4]);
  const r = buildSourceRowTokenPermutationEntropy(data, {
    generatedAt: GEN,
    order: 3,
    minRows: 5,
  });
  const s = r.sources[0]!;
  assert.equal(s.windowCount, 3);
  assert.equal(s.distinctPatterns, 2);
  const expectedH = -(2 / 3) * Math.log(2 / 3) - (1 / 3) * Math.log(1 / 3);
  assert.ok(Math.abs(s.entropyNats - expectedH) < 1e-12);
  assert.ok(
    Math.abs(s.permutationEntropy - expectedH / Math.log(6)) < 1e-12,
  );
  assert.equal(s.dominantPattern, 1);
  assert.ok(Math.abs(s.dominantPatternFraction - 2 / 3) < 1e-12);
  assert.equal(s.tieWindowFraction, 0);
});

test('permutation-entropy: invalid since/until throw', () => {
  assert.throws(
    () =>
      buildSourceRowTokenPermutationEntropy([], { since: 'not-a-date' as string }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenPermutationEntropy([], { until: 'not-a-date' as string }),
    /invalid until/,
  );
});

test('permutation-entropy: top must be a positive integer when provided', () => {
  assert.throws(
    () => buildSourceRowTokenPermutationEntropy([], { top: 0 }),
    /top must be a positive integer/,
  );
  assert.throws(
    () => buildSourceRowTokenPermutationEntropy([], { top: 1.5 }),
    /top must be a positive integer/,
  );
});
