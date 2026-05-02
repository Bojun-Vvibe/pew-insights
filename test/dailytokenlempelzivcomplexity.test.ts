import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyTokenLempelZivComplexity,
  dailyTokenLempelZivComplexity,
  lempelZivPhraseCount,
  median,
  medianBinarise,
} from '../src/dailytokenlempelzivcomplexity.js';
import type { QueueLine } from '../src/types.js';

const GEN = '2025-01-01T00:00:00.000Z';

function row(day: string, source: string, total_tokens: number): QueueLine {
  return {
    hour_start: `${day}T00:00:00.000Z`,
    source,
    total_tokens,
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    requests: 1,
    bucket: 'b',
    project_ref: null,
    file_offset: 0,
    file_size: 0,
  } as unknown as QueueLine;
}

function buildSeries(values: number[], source = 'src-a'): QueueLine[] {
  const out: QueueLine[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const ms = Date.parse('2024-01-01T00:00:00.000Z') + i * 86_400_000;
    const day = new Date(ms).toISOString().slice(0, 10);
    if (values[i]! > 0) out.push(row(day, source, values[i]!));
  }
  return out;
}

// ---- median primitive --------------------------------------------------

test('median: empty -> throws', () => {
  assert.throws(() => median([]));
});

test('median: rejects non-finite', () => {
  assert.throws(() => median([1, NaN, 3]));
  assert.throws(() => median([1, Infinity, 3]));
});

test('median: odd-length picks central order statistic', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([5, 5, 5, 5, 5]), 5);
});

test('median: even-length averages two centrals', () => {
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

// ---- medianBinarise ----------------------------------------------------

test('medianBinarise: strictly-above produces 1', () => {
  // median = 3; values > 3 -> 1
  assert.equal(medianBinarise([1, 2, 3, 4, 5]), '00011');
});

test('medianBinarise: ties at median map to 0', () => {
  assert.equal(medianBinarise([1, 1, 1, 5, 5, 5]), '000111');
});

// ---- lempelZivPhraseCount ---------------------------------------------

test('lempelZivPhraseCount: empty -> throws', () => {
  assert.throws(() => lempelZivPhraseCount(''));
});

test('lempelZivPhraseCount: non-binary char -> throws', () => {
  assert.throws(() => lempelZivPhraseCount('012'));
  assert.throws(() => lempelZivPhraseCount('1a0'));
});

test('lempelZivPhraseCount: single bit -> count 1', () => {
  assert.equal(lempelZivPhraseCount('0'), 1);
  assert.equal(lempelZivPhraseCount('1'), 1);
});

test('lempelZivPhraseCount: all zeros parses to {0, 00...} -> 2 phrases', () => {
  // Phrases: "0" | "00000000" -> count 2 (first phrase + remainder).
  assert.equal(lempelZivPhraseCount('000000000'), 2);
  assert.equal(lempelZivPhraseCount('00'), 2);
  assert.equal(lempelZivPhraseCount('0000'), 2);
});

test('lempelZivPhraseCount: all ones similarly -> 2 phrases', () => {
  assert.equal(lempelZivPhraseCount('111111111'), 2);
});

test('lempelZivPhraseCount: alternating 0101... canonical example', () => {
  // Standard textbook parse: 0 | 1 | 01 | 010101... -> count 4.
  // We pin the value our impl produces.
  const c = lempelZivPhraseCount('01010101');
  assert.ok(c >= 3 && c <= 5, `c=${c}`);
});

test('lempelZivPhraseCount: monotonically increasing for richer prefixes', () => {
  // A more complex bit pattern should yield a strictly larger count
  // than a fully periodic one of the same length.
  const periodic = lempelZivPhraseCount('010101010101010101010101');
  const aperiodic = lempelZivPhraseCount('011010001110110010011010');
  assert.ok(
    aperiodic > periodic,
    `aperiodic ${aperiodic} should exceed periodic ${periodic}`,
  );
});

test('lempelZivPhraseCount: complement-invariance (LZ symmetric in 0/1)', () => {
  const s = '011010001110110010011010';
  const complement = s.replace(/[01]/g, (c) => (c === '0' ? '1' : '0'));
  assert.equal(lempelZivPhraseCount(s), lempelZivPhraseCount(complement));
});

// ---- dailyTokenLempelZivComplexity primitive --------------------------

test('dailyTokenLempelZivComplexity: rejects non-finite', () => {
  assert.throws(() =>
    dailyTokenLempelZivComplexity([1, 2, 3, 4, 5, 6, NaN, 8]),
  );
});

test('dailyTokenLempelZivComplexity: rejects too-short series (n < 8)', () => {
  assert.throws(() => dailyTokenLempelZivComplexity([1, 2, 3, 4, 5, 6, 7]));
});

test('dailyTokenLempelZivComplexity: rejects constant series', () => {
  assert.throws(() =>
    dailyTokenLempelZivComplexity([5, 5, 5, 5, 5, 5, 5, 5, 5]),
  );
});

test('dailyTokenLempelZivComplexity: rejects degenerate binarisation', () => {
  // Two distinct values but equal counts -> median between them ->
  // half above, half at-or-below. The "at-or-below" half is 0 and
  // the strictly-above half is 1 -> NOT degenerate. Use an
  // asymmetric distribution where median equals the maximum so all
  // bits collapse to 0.
  // values: seven 1s and one 5 -> sorted [1,1,1,1,1,1,1,5];
  // median = (1 + 1) / 2 = 1; bits = 0000000_1 -> NOT degenerate.
  // values: seven 1s and one 1 with a single 5 in front -> median 1
  // again. Use majority-at-max instead: values: [1, 5, 5, 5, 5, 5,
  // 5, 5] -> median = (5 + 5) / 2 = 5; bits = 00000000 (no value
  // strictly above 5). DEGENERATE.
  assert.throws(() =>
    dailyTokenLempelZivComplexity([1, 5, 5, 5, 5, 5, 5, 5]),
  );
});

test('dailyTokenLempelZivComplexity: returns sane fields for a non-trivial input', () => {
  const v = [1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5];
  const r = dailyTokenLempelZivComplexity(v);
  assert.equal(r.median, 3);
  assert.equal(r.onesCount, 6);
  assert.ok(r.lzCount >= 1);
  assert.ok(r.lzRate > 0 && r.lzRate <= 1);
  assert.ok(Number.isFinite(r.lzNormalized));
});

test('dailyTokenLempelZivComplexity: shift-invariant', () => {
  const v = [1, 5, 2, 8, 3, 7, 4, 6, 9, 0, 11, 2, 5, 8, 3];
  const a = dailyTokenLempelZivComplexity(v);
  const b = dailyTokenLempelZivComplexity(v.map((x) => x + 1000));
  assert.equal(a.lzCount, b.lzCount);
  assert.equal(a.lzRate, b.lzRate);
  assert.equal(a.lzNormalized, b.lzNormalized);
});

test('dailyTokenLempelZivComplexity: scale-invariant for k > 0', () => {
  const v = [1, 5, 2, 8, 3, 7, 4, 6, 9, 1, 11, 2, 5, 8, 3];
  const a = dailyTokenLempelZivComplexity(v).lzCount;
  const b = dailyTokenLempelZivComplexity(v.map((x) => 17 * x)).lzCount;
  assert.equal(a, b);
});

test('dailyTokenLempelZivComplexity: monotone-rescale invariant (median split preserved)', () => {
  const v = [1, 5, 2, 8, 3, 7, 4, 6, 9, 1, 11, 2, 5, 8, 3];
  const a = dailyTokenLempelZivComplexity(v).lzCount;
  // Apply x -> x^2 + 7 (strictly increasing for x >= 0).
  const b = dailyTokenLempelZivComplexity(v.map((x) => x * x + 7)).lzCount;
  assert.equal(a, b);
});

test('dailyTokenLempelZivComplexity: alternating high-low gives modest LZ (periodic)', () => {
  // Strictly periodic alternation -> short dictionary.
  const v = [1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9];
  const r = dailyTokenLempelZivComplexity(v);
  // Should be much smaller than the asymptotic bound n / log2(n).
  assert.ok(r.lzNormalized < 1, `lzNormalized=${r.lzNormalized}`);
});

test('dailyTokenLempelZivComplexity: lzNormalized = lzCount * log2(n) / n', () => {
  const v = [1, 5, 2, 8, 3, 7, 4, 6, 9, 1, 11, 2, 5, 8, 3, 6];
  const r = dailyTokenLempelZivComplexity(v);
  const expected = (r.lzCount * Math.log2(v.length)) / v.length;
  assert.ok(Math.abs(r.lzNormalized - expected) < 1e-12);
});

// ---- buildDailyTokenLempelZivComplexity --------------------------------

test('build: rejects bad option types', () => {
  assert.throws(() =>
    buildDailyTokenLempelZivComplexity([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenLempelZivComplexity([], { minTenureDays: 7 }),
  );
  assert.throws(() => buildDailyTokenLempelZivComplexity([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenLempelZivComplexity([], {
      sort: 'bogus' as unknown as 'lzRate',
    }),
  );
});

test('build: empty queue -> empty report', () => {
  const r = buildDailyTokenLempelZivComplexity([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('build: single source with non-trivial pattern produces one row', () => {
  const v = [1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000];
  const q = buildSeries(v, 'src-a');
  const r = buildDailyTokenLempelZivComplexity(q, {
    generatedAt: GEN,
    minTenureDays: 8,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'src-a');
  assert.equal(s.nTenureDays, 12);
  assert.ok(s.lzCount >= 1);
  assert.ok(s.lzNormalized > 0);
});

test('build: respects min-tenure-days filter', () => {
  const q = buildSeries([100, 200, 300, 400, 500, 600, 700], 'src-short');
  const r = buildDailyTokenLempelZivComplexity(q, {
    generatedAt: GEN,
    minTenureDays: 32,
    minTokens: 0,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('build: respects min-tokens filter', () => {
  const v: number[] = new Array(40).fill(0).map((_, i) => (i % 2 === 0 ? 5 : 10));
  const q = buildSeries(v, 'tiny');
  const r = buildDailyTokenLempelZivComplexity(q, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
});

test('build: source filter', () => {
  const a = buildSeries(
    [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
    'src-a',
  );
  const b = buildSeries(
    [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
    'src-b',
  );
  const r = buildDailyTokenLempelZivComplexity([...a, ...b], {
    generatedAt: GEN,
    source: 'src-a',
    minTenureDays: 8,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('build: gap-fill produces zeros for missing days', () => {
  const q = [
    row('2024-01-01', 'gappy', 5000),
    row('2024-01-12', 'gappy', 5000),
  ];
  const r = buildDailyTokenLempelZivComplexity(q, {
    generatedAt: GEN,
    minTenureDays: 8,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 12);
  assert.equal(r.sources[0]!.nActiveDays, 2);
});

test('build: drops constant gap-filled series', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    const ms = Date.parse('2024-01-01T00:00:00.000Z') + i * 86_400_000;
    const day = new Date(ms).toISOString().slice(0, 10);
    q.push(row(day, 'flat', 1000));
  }
  const r = buildDailyTokenLempelZivComplexity(q, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: top cap surfaces droppedTopSources', () => {
  const queues: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    const v: number[] = new Array(40)
      .fill(0)
      .map((_, i) => 1000 + ((i + s) % 7) * 500);
    queues.push(...buildSeries(v, `src-${s}`));
  }
  const r = buildDailyTokenLempelZivComplexity(queues, {
    generatedAt: GEN,
    top: 2,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('build: sort by source produces alphabetic order', () => {
  const v = [1000, 2000, 1500, 3000, 2500, 4000, 3500, 5000, 1200, 2700];
  const queues = [
    ...buildSeries(v, 'zeta'),
    ...buildSeries(v, 'alpha'),
    ...buildSeries(v, 'mid'),
  ];
  const r = buildDailyTokenLempelZivComplexity(queues, {
    generatedAt: GEN,
    sort: 'source',
    minTenureDays: 8,
    minTokens: 0,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mid', 'zeta'],
  );
});

test('build: sort by lzNormalizedDesc puts most-complex first', () => {
  const periodic = [1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000];
  const aperiodic = [1000, 5000, 5000, 1000, 5000, 1000, 1000, 5000, 1000, 5000];
  const queues = [
    ...buildSeries(periodic, 'periodic-src'),
    ...buildSeries(aperiodic, 'aperiodic-src'),
  ];
  const r = buildDailyTokenLempelZivComplexity(queues, {
    generatedAt: GEN,
    sort: 'lzNormalizedDesc',
    minTenureDays: 8,
    minTokens: 0,
  });
  assert.ok(r.sources[0]!.lzNormalized >= r.sources[1]!.lzNormalized);
});

test('build: invalid since/until rejected', () => {
  assert.throws(() =>
    buildDailyTokenLempelZivComplexity([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildDailyTokenLempelZivComplexity([], { until: 'not-a-date' }),
  );
});

test('build: invalid hour_start increments dropped counter', () => {
  const q: QueueLine[] = [
    { ...row('2024-01-01', 'src', 1000), hour_start: 'totally-broken' } as QueueLine,
    ...buildSeries(
      [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
      'src',
    ),
  ];
  const r = buildDailyTokenLempelZivComplexity(q, {
    generatedAt: GEN,
    minTenureDays: 8,
    minTokens: 0,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

// ---- refinement: defence-in-depth ------------------------------------

test('lempelZivPhraseCount: parametric sweep -- count is monotone non-decreasing in n for the iid-like prefix', () => {
  // Take a fixed pseudo-random binary string and measure c(n) on
  // its prefixes of growing length. c(n) is monotone non-decreasing
  // in n by construction (each new bit either fits the current
  // candidate, in which case c stays put, or closes a phrase and
  // increments c by 1).
  const seed = '0110100011101100100110100011101001011010001110110010011010';
  let prev = 0;
  for (let n = 4; n <= seed.length; n += 1) {
    const c = lempelZivPhraseCount(seed.slice(0, n));
    assert.ok(c >= prev, `c(${n})=${c} < c(${n - 1})=${prev}`);
    prev = c;
  }
});

test('lempelZivPhraseCount: power-of-two structured prefixes (Aboy 2006 style benchmark)', () => {
  // Highly self-similar binary -> low LZ count vs an iid-like
  // string of the same length.
  const repetitive = '0101'.repeat(8); // 32 chars, periodic
  const irregular = '0110100011101100100110100011101100'.slice(0, 32);
  const cRep = lempelZivPhraseCount(repetitive);
  const cIrr = lempelZivPhraseCount(irregular);
  assert.ok(cIrr > cRep, `irregular ${cIrr} should exceed periodic ${cRep}`);
});

test('dailyTokenLempelZivComplexity: edge-case -- exactly n=8 (boundary)', () => {
  // Smallest accepted length: 8 elements. Must accept and produce
  // a sane lzNormalized.
  const v = [1, 9, 1, 9, 2, 8, 3, 7];
  const r = dailyTokenLempelZivComplexity(v);
  assert.ok(r.lzCount >= 1 && r.lzCount <= 8);
  assert.ok(Number.isFinite(r.lzNormalized) && r.lzNormalized > 0);
});

test('dailyTokenLempelZivComplexity: monotone-trend series produces low LZ', () => {
  // Strictly monotone increasing -> binarisation is exactly
  // n/2 zeros followed by n/2 ones (or off-by-one for odd n).
  // The string "00..011..1" parses to a small number of phrases
  // -> low LZ count vs the asymptotic upper bound.
  const v = Array.from({ length: 32 }, (_, i) => i + 1);
  const r = dailyTokenLempelZivComplexity(v);
  assert.ok(r.lzNormalized < 0.9, `lzNormalized=${r.lzNormalized}`);
});

test('dailyTokenLempelZivComplexity: parametric sweep over series length n in [8, 64]', () => {
  // Sanity-sweep: for every accepted length, the primitive
  // returns finite values, lzCount is in [1, n], and the
  // normaliser n/log2(n) is positive.
  for (let n = 8; n <= 64; n += 1) {
    const v: number[] = new Array(n);
    for (let i = 0; i < n; i += 1) {
      // Two-frequency sinusoid avoids periodicity-collapse.
      v[i] = Math.sin(i * 0.37) + 0.5 * Math.sin(i * 1.91);
    }
    const r = dailyTokenLempelZivComplexity(v);
    assert.ok(
      r.lzCount >= 1 && r.lzCount <= n,
      `n=${n}: lzCount=${r.lzCount}`,
    );
    assert.ok(
      Number.isFinite(r.lzNormalized) && r.lzNormalized > 0,
      `n=${n}: lzNormalized=${r.lzNormalized}`,
    );
  }
});

test('dailyTokenLempelZivComplexity: numerical stability at amplitude 1e12', () => {
  const v = [1e12, 9e12, 1e12, 9e12, 1e12, 9e12, 1e12, 9e12, 1e12, 9e12];
  const r = dailyTokenLempelZivComplexity(v);
  assert.ok(Number.isFinite(r.lzNormalized));
  assert.ok(r.lzCount >= 1);
});

test('dailyTokenLempelZivComplexity: numerical stability at amplitude 1e-12', () => {
  const v = [1e-12, 9e-12, 1e-12, 9e-12, 1e-12, 9e-12, 1e-12, 9e-12, 1e-12, 9e-12];
  const r = dailyTokenLempelZivComplexity(v);
  assert.ok(Number.isFinite(r.lzNormalized));
  assert.ok(r.lzCount >= 1);
});

test('build: tokens-sort produces tokens-descending order', () => {
  const queues = [
    ...buildSeries(
      [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
      'light',
    ),
    ...buildSeries(
      [100000, 200000, 150000, 300000, 250000, 400000, 350000, 500000, 600000, 700000],
      'heavy',
    ),
  ];
  const r = buildDailyTokenLempelZivComplexity(queues, {
    generatedAt: GEN,
    sort: 'tokens',
    minTenureDays: 8,
    minTokens: 0,
  });
  assert.equal(r.sources[0]!.source, 'heavy');
  assert.ok(r.sources[0]!.totalTokens >= r.sources[1]!.totalTokens);
});

test('build: tenure-sort tiebreak alphabetic', () => {
  const v = [1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000];
  const queues = [
    ...buildSeries(v, 'b-src'),
    ...buildSeries(v, 'a-src'),
  ];
  const r = buildDailyTokenLempelZivComplexity(queues, {
    generatedAt: GEN,
    sort: 'tenure',
    minTenureDays: 8,
    minTokens: 0,
  });
  assert.equal(r.sources[0]!.source, 'a-src');
  assert.equal(r.sources[1]!.source, 'b-src');
});

test('build: lzCountDesc sort puts highest LZ first', () => {
  const periodic = [1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000];
  const aperiodic = [
    1000, 5000, 5000, 1000, 5000, 1000, 1000, 5000, 1000, 5000, 5000, 1000,
  ];
  const queues = [
    ...buildSeries(periodic, 'periodic-src'),
    ...buildSeries(aperiodic, 'aperiodic-src'),
  ];
  const r = buildDailyTokenLempelZivComplexity(queues, {
    generatedAt: GEN,
    sort: 'lzCountDesc',
    minTenureDays: 8,
    minTokens: 0,
  });
  assert.ok(r.sources[0]!.lzCount >= r.sources[1]!.lzCount);
});

// ---- additional refinement: orthogonality witnesses ------------------

test('orthogonality: periodic alternation has near-maximal first-difference sign-change rate but LOW LZ', () => {
  // y = [1,9,1,9,1,9,...] alternates -> first-diff sign-change
  // rate = 1 (max); but LZ over the binarised median split should
  // be modest because the same 2-bit pattern repeats forever.
  // This pins the structural orthogonality we documented in the
  // axis header against accidental regressions.
  const v = [1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9];
  const r = dailyTokenLempelZivComplexity(v);
  // Bits = "0101010101010101" -> the LZ count should be small.
  // Compute the rate explicitly.
  assert.ok(
    r.lzNormalized < 0.85,
    `periodic lzNormalized=${r.lzNormalized} should be < 0.85 to demonstrate orthogonality vs PFD`,
  );
});

test('orthogonality: noisy-but-bounded series produces higher LZ than periodic of same length', () => {
  const periodic = [1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9];
  const noisy = [1, 9, 5, 2, 8, 3, 7, 4, 6, 9, 1, 11, 2, 5, 8, 3];
  const rPeriodic = dailyTokenLempelZivComplexity(periodic);
  const rNoisy = dailyTokenLempelZivComplexity(noisy);
  assert.ok(
    rNoisy.lzCount >= rPeriodic.lzCount,
    `noisy ${rNoisy.lzCount} should match-or-exceed periodic ${rPeriodic.lzCount}`,
  );
});

test('build: JSON shape is stable (smoke contract for downstream consumers)', () => {
  const v = [1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000, 1000, 5000];
  const q = buildSeries(v, 'src');
  const r = buildDailyTokenLempelZivComplexity(q, {
    generatedAt: GEN,
    minTenureDays: 8,
    minTokens: 0,
  });
  // Top-level fields
  for (const k of [
    'generatedAt',
    'minTokens',
    'minTenureDays',
    'top',
    'sort',
    'totalTokens',
    'totalSources',
    'droppedDegenerateBinarisation',
    'droppedNonFiniteLz',
    'sources',
  ]) {
    assert.ok(k in r, `missing top-level field: ${k}`);
  }
  // Per-source fields
  const s = r.sources[0]!;
  for (const k of [
    'source',
    'totalTokens',
    'nActiveDays',
    'nTenureDays',
    'firstActiveDay',
    'lastActiveDay',
    'median',
    'onesCount',
    'lzCount',
    'lzRate',
    'lzNormalized',
  ]) {
    assert.ok(k in s, `missing per-source field: ${k}`);
  }
});

test('build: lzNormalized field equals lzCount * log2(n) / n at the per-source level', () => {
  const v = [1000, 5000, 2000, 4000, 3000, 5000, 1000, 5000, 2500, 4500, 1500, 5500];
  const q = buildSeries(v, 'src');
  const r = buildDailyTokenLempelZivComplexity(q, {
    generatedAt: GEN,
    minTenureDays: 8,
    minTokens: 0,
  });
  const s = r.sources[0]!;
  const expected = (s.lzCount * Math.log2(s.nTenureDays)) / s.nTenureDays;
  assert.ok(
    Math.abs(s.lzNormalized - expected) < 1e-12,
    `lzNormalized=${s.lzNormalized} expected=${expected}`,
  );
});
