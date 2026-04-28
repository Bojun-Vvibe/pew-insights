import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmerNegTwoMean } from '../src/sourcerowtokenlehmernegtwomean.js';
import { buildSourceRowTokenLehmerNegOneMean } from '../src/sourcerowtokenlehmernegonemean.js';
import { buildSourceRowTokenHarmonicMean } from '../src/sourcerowtokenharmonicmean.js';
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

const GEN = '2026-04-28T12:00:00.000Z';

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

function reference(xs: number[]): {
  mean: number;
  hm: number;
  lneg1: number;
  lneg2: number;
} {
  const n = xs.length;
  let sumInv = 0;
  let sumInvSq = 0;
  let sumInvCu = 0;
  let total = 0;
  for (const x of xs) {
    sumInv += 1 / x;
    sumInvSq += 1 / (x * x);
    sumInvCu += 1 / (x * x * x);
    total += x;
  }
  return {
    mean: total / n,
    hm: n / sumInv,
    lneg1: sumInv / sumInvSq,
    lneg2: sumInvSq / sumInvCu,
  };
}

test('lehmer-neg-2-mean: identity on a constant positive series', () => {
  const queue = mkSeries('s', [7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.rowsKept, 5);
  assert.ok(Math.abs(s.lehmerNegTwoMean - 7) < 1e-12);
  assert.ok(Math.abs(s.lehmerNegOneMean - 7) < 1e-12);
  assert.ok(Math.abs(s.harmonicMean - 7) < 1e-12);
  assert.ok(Math.abs(s.mean - 7) < 1e-12);
  assert.ok(Math.abs(s.negTwoNegOneGap) < 1e-12);
  assert.ok(Math.abs(s.negTwoHmGap) < 1e-12);
  assert.ok(Math.abs(s.negTwoAmGap) < 1e-12);
});

test('lehmer-neg-2-mean: single positive row -> L_-2 = L_-1 = HM = mean = v', () => {
  const queue = mkSeries('s', [42]);
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.rowsKept, 1);
  assert.ok(Math.abs(s.lehmerNegTwoMean - 42) < 1e-12);
  assert.ok(Math.abs(s.lehmerNegOneMean - 42) < 1e-12);
  assert.ok(Math.abs(s.harmonicMean - 42) < 1e-12);
  assert.ok(Math.abs(s.mean - 42) < 1e-12);
  assert.ok(Math.abs(s.negTwoNegOneGap) < 1e-12);
  assert.ok(Math.abs(s.negTwoHmGap) < 1e-12);
  assert.ok(Math.abs(s.negTwoAmGap) < 1e-12);
});

test('lehmer-neg-2-mean: matches closed-form reference on a hand-picked sample', () => {
  const xs = [1, 2, 4, 8, 16];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  const ref = reference(xs);
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.mean - ref.mean) < 1e-12);
  assert.ok(Math.abs(s.harmonicMean - ref.hm) < 1e-12);
  assert.ok(Math.abs(s.lehmerNegOneMean - ref.lneg1) < 1e-12);
  assert.ok(Math.abs(s.lehmerNegTwoMean - ref.lneg2) < 1e-12);
});

test('lehmer-neg-2-mean: a single tiny row dominates more than L_-1', () => {
  const xs = [1, 1000, 1000, 1000];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  // L_-2 sits within 0.0003% of the tiny value 1
  assert.ok(s.lehmerNegTwoMean < 1.001);
  assert.ok(s.lehmerNegTwoMean >= 1);
  // L_-2 is strictly below L_-1
  assert.ok(s.lehmerNegTwoMean < s.lehmerNegOneMean);
});

test('lehmer-neg-2-mean: ladder L_-2 <= L_-1 <= HM <= mean strict for non-constant positive series', () => {
  const xs = [10, 20, 30, 40, 50];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.ok(s.lehmerNegTwoMean < s.lehmerNegOneMean);
  assert.ok(s.lehmerNegOneMean < s.harmonicMean);
  assert.ok(s.harmonicMean < s.mean);
});

test('lehmer-neg-2-mean: negTwoNegOneGap >= 0 always', () => {
  const xs = [3, 5, 8, 13, 21, 34];
  const r = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', xs), { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.ok(s.negTwoNegOneGap >= 0);
  assert.ok(Math.abs(s.negTwoNegOneGap - (s.lehmerNegOneMean - s.lehmerNegTwoMean)) < 1e-12);
});

test('lehmer-neg-2-mean: negTwoHmGap >= 0 always', () => {
  const xs = [3, 5, 8, 13, 21, 34];
  const r = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', xs), { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.ok(s.negTwoHmGap >= 0);
  assert.ok(Math.abs(s.negTwoHmGap - (s.harmonicMean - s.lehmerNegTwoMean)) < 1e-12);
});

test('lehmer-neg-2-mean: negTwoAmGap >= 0 always', () => {
  const xs = [3, 5, 8, 13, 21, 34];
  const r = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', xs), { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.ok(s.negTwoAmGap >= 0);
  assert.ok(Math.abs(s.negTwoAmGap - (s.mean - s.lehmerNegTwoMean)) < 1e-12);
});

test('lehmer-neg-2-mean: scale-equivariance L_-2(c*x) = c*L_-2(x)', () => {
  const xs = [3, 5, 7, 11];
  const c = 17;
  const a = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', xs), { generatedAt: GEN });
  const b = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', xs.map(x => c * x)), { generatedAt: GEN });
  assert.ok(Math.abs(b.sources[0]!.lehmerNegTwoMean - c * a.sources[0]!.lehmerNegTwoMean) < 1e-9);
});

test('lehmer-neg-2-mean: NOT translation-equivariant', () => {
  const xs = [10, 20, 30];
  const a = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', xs), { generatedAt: GEN });
  const b = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', xs.map(x => x + 100)), { generatedAt: GEN });
  // shifted L_-2 != original L_-2 + 100
  assert.ok(Math.abs(b.sources[0]!.lehmerNegTwoMean - (a.sources[0]!.lehmerNegTwoMean + 100)) > 1);
});

test('lehmer-neg-2-mean: order-invariant (multiset only)', () => {
  const a = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', [1, 2, 3, 4, 5]), { generatedAt: GEN });
  const b = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', [5, 1, 4, 2, 3]), { generatedAt: GEN });
  assert.ok(Math.abs(a.sources[0]!.lehmerNegTwoMean - b.sources[0]!.lehmerNegTwoMean) < 1e-12);
});

test('lehmer-neg-2-mean: zero row drops source as droppedZeroBearingSources', () => {
  const queue = [...mkSeries('s', [1, 2, 0, 4]), ...mkSeries('t', [1, 2, 3, 4])];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  assert.equal(r.droppedZeroBearingSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 't');
});

test('lehmer-neg-2-mean: negative row dropped as droppedNegativeTokens', () => {
  const queue = [...mkSeries('s', [1, 2, 3]), ql('2026-04-27T05:00:00.000Z', 's', -5)];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('lehmer-neg-2-mean: invalid hour_start dropped', () => {
  const queue = [...mkSeries('s', [1, 2, 3]), ql('not-a-date', 's', 99)];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('lehmer-neg-2-mean: NaN total_tokens dropped', () => {
  const queue = [...mkSeries('s', [1, 2, 3]), ql('2026-04-27T05:00:00.000Z', 's', NaN)];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('lehmer-neg-2-mean: empty source becomes "unknown"', () => {
  const queue = mkSeries('', [1, 2, 3]);
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('lehmer-neg-2-mean: source filter excludes others', () => {
  const queue = [...mkSeries('s', [1, 2, 3]), ...mkSeries('t', [4, 5, 6])];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN, source: 's' });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's');
  assert.equal(r.droppedSourceFilter, 3);
});

test('lehmer-neg-2-mean: minRows enforced', () => {
  const queue = [...mkSeries('s', [1, 2]), ...mkSeries('t', [1, 2, 3, 4, 5])];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN, minRows: 3 });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 't');
});

test('lehmer-neg-2-mean: minRows must be integer >= 1', () => {
  assert.throws(
    () => buildSourceRowTokenLehmerNegTwoMean([], { minRows: 0 }),
    /minRows must be an integer/,
  );
  assert.throws(
    () => buildSourceRowTokenLehmerNegTwoMean([], { minRows: 1.5 }),
    /minRows must be an integer/,
  );
});

test('lehmer-neg-2-mean: minLehmerNegTwoMean filter', () => {
  const queue = [...mkSeries('s', [1, 1, 1]), ...mkSeries('t', [100, 100, 100])];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, {
    generatedAt: GEN,
    minLehmerNegTwoMean: 50,
  });
  assert.equal(r.droppedBelowMinLehmerNegTwoMean, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 't');
});

test('lehmer-neg-2-mean: minLehmerNegTwoMean must be finite, non-negative', () => {
  assert.throws(
    () => buildSourceRowTokenLehmerNegTwoMean([], { minLehmerNegTwoMean: -1 }),
    /minLehmerNegTwoMean/,
  );
  assert.throws(
    () => buildSourceRowTokenLehmerNegTwoMean([], { minLehmerNegTwoMean: NaN }),
    /minLehmerNegTwoMean/,
  );
});

test('lehmer-neg-2-mean: top cap reports droppedBelowTopCap', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
    ...mkSeries('c', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('lehmer-neg-2-mean: top must be positive integer', () => {
  assert.throws(
    () => buildSourceRowTokenLehmerNegTwoMean([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('lehmer-neg-2-mean: sort lehmer-neg-2-mean-desc default', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [100, 100, 100]),
    ...mkSeries('c', [10, 10, 10]),
  ];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  assert.deepEqual(r.sources.map(s => s.source), ['b', 'c', 'a']);
});

test('lehmer-neg-2-mean: sort lehmer-neg-2-mean-asc', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [100, 100, 100]),
    ...mkSeries('c', [10, 10, 10]),
  ];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, {
    generatedAt: GEN,
    sort: 'lehmer-neg-2-mean-asc',
  });
  assert.deepEqual(r.sources.map(s => s.source), ['a', 'c', 'b']);
});

test('lehmer-neg-2-mean: sort mean-desc', () => {
  const queue = [
    ...mkSeries('a', [1, 100]),
    ...mkSeries('b', [50, 50]),
  ];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, {
    generatedAt: GEN,
    sort: 'mean-desc',
  });
  // both mean = 50.5 vs 50; a has higher mean
  assert.equal(r.sources[0]!.source, 'a');
});

test('lehmer-neg-2-mean: sort hm-gap-desc', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [1, 100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, {
    generatedAt: GEN,
    sort: 'hm-gap-desc',
  });
  // b has bigger negTwoHmGap
  assert.equal(r.sources[0]!.source, 'b');
});

test('lehmer-neg-2-mean: sort am-gap-desc', () => {
  const queue = [
    ...mkSeries('a', [50, 50, 50]),
    ...mkSeries('b', [1, 100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, {
    generatedAt: GEN,
    sort: 'am-gap-desc',
  });
  assert.equal(r.sources[0]!.source, 'b');
});

test('lehmer-neg-2-mean: sort neg-one-gap-desc', () => {
  const queue = [
    ...mkSeries('a', [50, 50, 50]),
    ...mkSeries('b', [1, 100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, {
    generatedAt: GEN,
    sort: 'neg-one-gap-desc',
  });
  // b has bigger spread => bigger negTwoNegOneGap
  assert.equal(r.sources[0]!.source, 'b');
});

test('lehmer-neg-2-mean: sort rows', () => {
  const queue = [
    ...mkSeries('a', [10, 10]),
    ...mkSeries('b', [10, 10, 10, 10, 10]),
    ...mkSeries('c', [10, 10, 10]),
  ];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.deepEqual(r.sources.map(s => s.source), ['b', 'c', 'a']);
});

test('lehmer-neg-2-mean: sort source asc', () => {
  const queue = [
    ...mkSeries('zzz', [1, 1]),
    ...mkSeries('aaa', [100, 100]),
    ...mkSeries('mmm', [10, 10]),
  ];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(r.sources.map(s => s.source), ['aaa', 'mmm', 'zzz']);
});

test('lehmer-neg-2-mean: invalid sort throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmerNegTwoMean([], { sort: 'bogus' as never }),
    /sort must be one of/,
  );
});

test('lehmer-neg-2-mean: tiebreak by source asc', () => {
  const queue = [
    ...mkSeries('zzz', [10, 10, 10]),
    ...mkSeries('aaa', [10, 10, 10]),
  ];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  // L_-2 equal, tiebreak source asc
  assert.deepEqual(r.sources.map(s => s.source), ['aaa', 'zzz']);
});

test('lehmer-neg-2-mean: since/until window filter', () => {
  const queue = [
    ql('2026-04-26T00:00:00.000Z', 's', 100),
    ql('2026-04-27T00:00:00.000Z', 's', 200),
    ql('2026-04-28T00:00:00.000Z', 's', 300),
  ];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, {
    generatedAt: GEN,
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.rowsKept, 1);
});

test('lehmer-neg-2-mean: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmerNegTwoMean([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('lehmer-neg-2-mean: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmerNegTwoMean([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('lehmer-neg-2-mean: generatedAt override honored', () => {
  const r = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', [1, 2, 3]), {
    generatedAt: '2030-01-01T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2030-01-01T00:00:00.000Z');
});

test('lehmer-neg-2-mean: report top-level fields populated', () => {
  const r = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', [1, 2, 3]), {
    generatedAt: GEN,
    since: '2026-04-26T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
    minRows: 1,
    minLehmerNegTwoMean: 0,
    sort: 'lehmer-neg-2-mean-desc',
  });
  assert.equal(r.windowStart, '2026-04-26T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-28T00:00:00.000Z');
  assert.equal(r.minRows, 1);
  assert.equal(r.minLehmerNegTwoMean, 0);
  assert.equal(r.sort, 'lehmer-neg-2-mean-desc');
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalRowsKept, 3);
});

test('lehmer-neg-2-mean: cross-check L_-1 against v0.6.190 builder for same input', () => {
  const xs = [2, 4, 8, 16, 32, 64];
  const queue = mkSeries('s', xs);
  const a = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  const b = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN });
  assert.ok(
    Math.abs(a.sources[0]!.lehmerNegOneMean - b.sources[0]!.lehmerNegOneMean) <
      1e-12,
  );
});

test('lehmer-neg-2-mean: cross-check HM against harmonic-mean builder', () => {
  const xs = [3, 6, 12, 24];
  const queue = mkSeries('s', xs);
  const a = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  const b = buildSourceRowTokenHarmonicMean(queue, { generatedAt: GEN });
  assert.ok(
    Math.abs(a.sources[0]!.harmonicMean - b.sources[0]!.harmonicMean) < 1e-12,
  );
});

test('lehmer-neg-2-mean: bottleneck pin [1, 1000, 1000, 1000]', () => {
  const xs = [1, 1000, 1000, 1000];
  const r = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  // mean = 750.25, hm ~ 3.988, l_-1 ~ 1.003, l_-2 ~ 1.000003
  assert.ok(Math.abs(s.mean - 750.25) < 1e-9);
  assert.ok(s.harmonicMean > 3.9 && s.harmonicMean < 4.0);
  assert.ok(s.lehmerNegOneMean > 1.002 && s.lehmerNegOneMean < 1.004);
  assert.ok(s.lehmerNegTwoMean > 1 && s.lehmerNegTwoMean < 1.0001);
});

test('lehmer-neg-2-mean: ladder strict on geometric series', () => {
  const xs = [1, 2, 4, 8, 16, 32, 64, 128];
  const r = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.lehmerNegTwoMean < s.lehmerNegOneMean);
  assert.ok(s.lehmerNegOneMean < s.harmonicMean);
  assert.ok(s.harmonicMean < s.mean);
});

test('lehmer-neg-2-mean: empty queue produces empty report', () => {
  const r = buildSourceRowTokenLehmerNegTwoMean([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
});

test('lehmer-neg-2-mean: 50 random samples — ladder L_-2 <= L_-1 <= HM <= mean holds', () => {
  let rng = 12345;
  const next = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 0xffffffff;
  };
  for (let trial = 0; trial < 50; trial++) {
    const n = 3 + Math.floor(next() * 20);
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      xs.push(1 + next() * 10000);
    }
    const r = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const s = r.sources[0]!;
    assert.ok(s.lehmerNegTwoMean <= s.lehmerNegOneMean + 1e-9);
    assert.ok(s.lehmerNegOneMean <= s.harmonicMean + 1e-9);
    assert.ok(s.harmonicMean <= s.mean + 1e-9);
    assert.ok(s.negTwoNegOneGap >= -1e-9);
    assert.ok(s.negTwoHmGap >= -1e-9);
    assert.ok(s.negTwoAmGap >= -1e-9);
  }
});

test('lehmer-neg-2-mean: returns valid empty arrays for empty source group via filter', () => {
  const queue = mkSeries('s', [1, 2, 3]);
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, {
    generatedAt: GEN,
    source: 'nonexistent',
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('lehmer-neg-2-mean: multiple sources, all dropped due to zero rows', () => {
  const queue = [...mkSeries('a', [0, 1, 2]), ...mkSeries('b', [3, 0, 4])];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN });
  assert.equal(r.droppedZeroBearingSources, 2);
  assert.equal(r.sources.length, 0);
});

test('lehmer-neg-2-mean: L_-2 = c on constant series of various c', () => {
  for (const c of [1, 2.5, 100, 0.001, 1e6]) {
    const r = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', [c, c, c, c]), {
      generatedAt: GEN,
    });
    assert.ok(Math.abs(r.sources[0]!.lehmerNegTwoMean - c) < 1e-9 * Math.max(1, c));
  }
});

test('lehmer-neg-2-mean: closed-form L_-2 for [1, 2]', () => {
  // sumInvSq = 1 + 1/4 = 5/4
  // sumInvCu = 1 + 1/8 = 9/8
  // L_-2 = (5/4) / (9/8) = 10/9
  const r = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', [1, 2]), {
    generatedAt: GEN,
  });
  assert.ok(Math.abs(r.sources[0]!.lehmerNegTwoMean - 10 / 9) < 1e-12);
});

test('lehmer-neg-2-mean: closed-form L_-2 for [1, 1, 4]', () => {
  // sumInvSq = 1 + 1 + 1/16 = 33/16
  // sumInvCu = 1 + 1 + 1/64 = 129/64
  // L_-2 = (33/16) / (129/64) = (33*64)/(16*129) = 132/129
  const r = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', [1, 1, 4]), {
    generatedAt: GEN,
  });
  assert.ok(Math.abs(r.sources[0]!.lehmerNegTwoMean - 132 / 129) < 1e-12);
});

test('lehmer-neg-2-mean: rowsKept matches input length', () => {
  const r = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', [1, 2, 3, 4, 5, 6, 7, 8, 9]), {
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.rowsKept, 9);
});

test('lehmer-neg-2-mean: totalRowsKept ignores droppedBelowMinRows source rows still counted', () => {
  // totalRowsKept counts rows kept after rowwise filters, before per-source minRows
  const queue = [...mkSeries('s', [1, 2]), ...mkSeries('t', [3, 4, 5])];
  const r = buildSourceRowTokenLehmerNegTwoMean(queue, {
    generatedAt: GEN,
    minRows: 3,
  });
  assert.equal(r.totalRowsKept, 5);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('lehmer-neg-2-mean: sumInvCu accumulator stable for large inputs', () => {
  // deliberately mix large + small to stress the inv-cube term
  const xs = [1, 1_000_000, 1, 1_000_000];
  const r = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  // sumInv = 2 + 2e-6, sumInvSq = 2 + 2e-12, sumInvCu = 2 + 2e-18
  // L_-2 ~ 2 / 2 = 1
  assert.ok(s.lehmerNegTwoMean > 0.999);
  assert.ok(s.lehmerNegTwoMean < 1.001);
});
