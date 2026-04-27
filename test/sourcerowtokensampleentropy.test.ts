import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenSampleEntropy } from '../src/sourcerowtokensampleentropy.js';
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

test('sample-entropy: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenSampleEntropy([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.m, 2);
  assert.equal(r.r, 0.2);
  assert.equal(r.minRows, 12);
  assert.equal(r.sort, 'sampen-asc');
  assert.equal(r.generatedAt, GEN);
});

test('sample-entropy: constant series -> droppedZeroVariance', () => {
  const data = series(new Array(20).fill(5));
  const r = buildSourceRowTokenSampleEntropy(data, { generatedAt: GEN });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('sample-entropy: too few rows -> droppedBelowMinRows', () => {
  const data = series([1, 2, 3, 4, 5]);
  const r = buildSourceRowTokenSampleEntropy(data, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('sample-entropy: highly regular sinusoid -> low SampEn', () => {
  // perfectly periodic with period 6
  const period = [1, 2, 3, 4, 3, 2];
  const vals: number[] = [];
  for (let i = 0; i < 60; i++) vals.push(period[i % 6]!);
  const data = series(vals);
  const r = buildSourceRowTokenSampleEntropy(data, { generatedAt: GEN, m: 2, r: 0.2 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.degenerate, false);
  assert.ok(typeof s.sampEn === 'number' && Number.isFinite(s.sampEn));
  // periodic series should give small SampEn (template extensions reliable)
  assert.ok((s.sampEn as number) < 0.5, `expected SampEn<0.5, got ${s.sampEn}`);
});

test('sample-entropy: deterministic two-point series for reproducible SampEn', () => {
  // values: [1,2,1,2,...] length 20, sigma is 0.5, tol = 0.2*0.5=0.1
  // -> tolerance < 1, so 1!=2 windows never match cross-class
  // length-m=2 templates: [1,2] and [2,1] alternate
  // i and j with i<j both in [0, n-m-1]=[0,17]
  // [1,2] at even i, [2,1] at odd i. Pairs of same-class match (dist=0 <= 0.1).
  // 9 even indices (0,2,...,16) -> 36 pairs. Same for 9 odd indices -> 36 pairs.
  // B = 72.
  // Extensions: [1,2,1] at even i, [2,1,2] at odd i. Same-class extensions match exactly.
  // A = 72.
  // SampEn = -ln(72/72) = 0.
  const data = series(
    Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 1 : 2)),
  );
  const r = buildSourceRowTokenSampleEntropy(data, { generatedAt: GEN, m: 2, r: 0.2 });
  const s = r.sources[0]!;
  assert.equal(s.bMatches, 72);
  assert.equal(s.aMatches, 72);
  assert.ok(Object.is(s.sampEn, 0) || Object.is(s.sampEn, -0));
  assert.equal(s.degenerate, false);
});

test('sample-entropy: random-ish series -> SampEn > 0; non-degenerate', () => {
  // pseudo-random determinstic series (n=60)
  const vals: number[] = [];
  let x = 17;
  for (let i = 0; i < 60; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    vals.push((x % 1000) + 1);
  }
  const data = series(vals);
  // Use looser tolerance so that some matches survive at length-(m+1)
  const r = buildSourceRowTokenSampleEntropy(data, { generatedAt: GEN, m: 2, r: 0.5 });
  const s = r.sources[0]!;
  // Either non-degenerate with high SampEn, or degenerate-no-extensions:
  // both are valid honest signals of high randomness. Assert it is NOT
  // the low-SampEn (regular) regime.
  if (!s.degenerate) {
    assert.ok(typeof s.sampEn === 'number' && Number.isFinite(s.sampEn));
    assert.ok((s.sampEn as number) > 0.3, `expected SampEn>0.3, got ${s.sampEn}`);
  } else {
    // degenerate-no-extensions is the canonical "matches don't extend" signal
    assert.ok(s.bMatches > 0);
    assert.equal(s.aMatches, 0);
  }
});

test('sample-entropy: invalid m and r rejected', () => {
  assert.throws(() => buildSourceRowTokenSampleEntropy([], { m: 0 }));
  assert.throws(() => buildSourceRowTokenSampleEntropy([], { m: 7 }));
  assert.throws(() => buildSourceRowTokenSampleEntropy([], { r: 0 }));
  assert.throws(() => buildSourceRowTokenSampleEntropy([], { r: -0.1 }));
  assert.throws(() => buildSourceRowTokenSampleEntropy([], { minRows: 3, m: 2 }));
});

test('sample-entropy: source filter and dropped counters', () => {
  const a = series(new Array(20).fill(0).map((_, i) => i + 1), 'aaa');
  const b = series(new Array(20).fill(0).map((_, i) => 100 - i), 'bbb');
  const r = buildSourceRowTokenSampleEntropy([...a, ...b], {
    generatedAt: GEN,
    source: 'aaa',
  });
  assert.equal(r.droppedSourceFilter, 20);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'aaa');
});

test('sample-entropy: top cap and droppedBelowTopCap', () => {
  const a = series(
    Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 1 : 2)),
    'aaa',
  );
  const b = series(
    Array.from({ length: 30 }, (_, i) => i + 1),
    'bbb',
  );
  const r = buildSourceRowTokenSampleEntropy([...a, ...b], {
    generatedAt: GEN,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('sample-entropy: report carries options and source asc tiebreak', () => {
  const a = series(
    Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 1 : 2)),
    'zzz',
  );
  const b = series(
    Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 1 : 2)),
    'aaa',
  );
  const r = buildSourceRowTokenSampleEntropy([...a, ...b], {
    generatedAt: GEN,
    sort: 'sampen-asc',
  });
  // both have SampEn=0; tiebreak source asc -> 'aaa' first
  assert.equal(r.sources[0]!.source, 'aaa');
  assert.equal(r.sources[1]!.source, 'zzz');
});

test('sample-entropy --min-template-matches: rejects negative / non-integer', () => {
  assert.throws(() =>
    buildSourceRowTokenSampleEntropy([], { minTemplateMatches: -1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSampleEntropy([], { minTemplateMatches: 1.5 }),
  );
});

test('sample-entropy --min-template-matches: 0 default = no floor', () => {
  // alternating series gives B=72; ensure default keeps the row
  const data = series(
    Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 1 : 2)),
  );
  const r = buildSourceRowTokenSampleEntropy(data, { generatedAt: GEN });
  assert.equal(r.minTemplateMatches, 0);
  assert.equal(r.droppedBelowMinTemplateMatches, 0);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.bMatches, 72);
});

test('sample-entropy --min-template-matches: high threshold drops low-B rows', () => {
  // alternating series: B=72. Set min-template-matches to 100 -> drop
  const data = series(
    Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 1 : 2)),
  );
  const r = buildSourceRowTokenSampleEntropy(data, {
    generatedAt: GEN,
    minTemplateMatches: 100,
  });
  assert.equal(r.droppedBelowMinTemplateMatches, 1);
  assert.equal(r.sources.length, 0);
});

test('sample-entropy --min-template-matches: degenerate rows are exempt', () => {
  // Construct a series where length-m matches don't exist anywhere
  // (B=0 -> degenerate). All-distinct values with small tolerance:
  // ascending integers 1..20, sigma~5.77, r=0.001 -> tol~0.006 < 1
  // -> no two windows match. degenerate=true.
  const data = series(Array.from({ length: 20 }, (_, i) => i + 1));
  const r = buildSourceRowTokenSampleEntropy(data, {
    generatedAt: GEN,
    r: 0.001,
    minTemplateMatches: 1000, // very high
  });
  // The row is degenerate (B=0). Despite the high threshold, exempt.
  assert.equal(r.degenerateNoMatches + r.degenerateNoExtensions, 1);
  assert.equal(r.droppedBelowMinTemplateMatches, 0);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.degenerate, true);
});

test('sample-entropy --min-template-matches: report carries the field', () => {
  const r = buildSourceRowTokenSampleEntropy([], {
    generatedAt: GEN,
    minTemplateMatches: 50,
  });
  assert.equal(r.minTemplateMatches, 50);
  assert.equal(r.droppedBelowMinTemplateMatches, 0);
});
