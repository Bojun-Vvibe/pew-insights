import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmerNegThreeMean } from '../src/sourcerowtokenlehmernegthreemean.js';
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
  lneg2: number;
  lneg3: number;
} {
  const n = xs.length;
  let sumInv = 0;
  let sumInvSq = 0;
  let sumInvCu = 0;
  let sumInvQu = 0;
  let total = 0;
  for (const x of xs) {
    sumInv += 1 / x;
    sumInvSq += 1 / (x * x);
    sumInvCu += 1 / (x * x * x);
    sumInvQu += 1 / (x * x * x * x);
    total += x;
  }
  return {
    mean: total / n,
    hm: n / sumInv,
    lneg2: sumInvSq / sumInvCu,
    lneg3: sumInvCu / sumInvQu,
  };
}

test('lehmer-neg-3-mean: identity on a constant positive series', () => {
  const queue = mkSeries('s', [7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenLehmerNegThreeMean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.rowsKept, 5);
  assert.ok(Math.abs(s.lehmerNegThreeMean - 7) < 1e-12);
  assert.ok(Math.abs(s.lehmerNegTwoMean - 7) < 1e-12);
  assert.ok(Math.abs(s.harmonicMean - 7) < 1e-12);
  assert.ok(Math.abs(s.mean - 7) < 1e-12);
  assert.ok(Math.abs(s.negThreeNegTwoGap) < 1e-12);
  assert.ok(Math.abs(s.negThreeHmGap) < 1e-12);
  assert.ok(Math.abs(s.negThreeAmGap) < 1e-12);
});

test('lehmer-neg-3-mean: single positive row -> L_-3 = L_-2 = HM = mean = v', () => {
  const queue = mkSeries('s', [42]);
  const r = buildSourceRowTokenLehmerNegThreeMean(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.rowsKept, 1);
  assert.ok(Math.abs(s.lehmerNegThreeMean - 42) < 1e-12);
  assert.ok(Math.abs(s.lehmerNegTwoMean - 42) < 1e-12);
  assert.ok(Math.abs(s.harmonicMean - 42) < 1e-12);
  assert.ok(Math.abs(s.mean - 42) < 1e-12);
  assert.ok(Math.abs(s.negThreeNegTwoGap) < 1e-12);
  assert.ok(Math.abs(s.negThreeHmGap) < 1e-12);
  assert.ok(Math.abs(s.negThreeAmGap) < 1e-12);
});

test('lehmer-neg-3-mean: matches closed-form reference on a hand-picked sample', () => {
  const xs = [1, 2, 4, 8, 16];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmerNegThreeMean(queue, { generatedAt: GEN });
  const ref = reference(xs);
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.mean - ref.mean) < 1e-12);
  assert.ok(Math.abs(s.harmonicMean - ref.hm) < 1e-12);
  assert.ok(Math.abs(s.lehmerNegTwoMean - ref.lneg2) < 1e-12);
  assert.ok(Math.abs(s.lehmerNegThreeMean - ref.lneg3) < 1e-12);
});

test('lehmer-neg-3-mean: a single tiny row dominates more than L_-2', () => {
  const xs = [1, 1000, 1000, 1000];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmerNegThreeMean(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  // L_-3 sits within 0.0001% of the tiny value 1
  assert.ok(s.lehmerNegThreeMean < 1.0001);
  assert.ok(s.lehmerNegThreeMean >= 1);
  // L_-3 strictly below L_-2
  assert.ok(s.lehmerNegThreeMean < s.lehmerNegTwoMean);
});

test('lehmer-neg-3-mean: ladder L_-3 <= L_-2 <= HM <= mean strict for non-constant positive series', () => {
  const xs = [10, 20, 30, 40, 50];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmerNegThreeMean(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.ok(s.lehmerNegThreeMean < s.lehmerNegTwoMean);
  assert.ok(s.lehmerNegTwoMean < s.harmonicMean);
  assert.ok(s.harmonicMean < s.mean);
  assert.ok(s.negThreeNegTwoGap > 0);
  assert.ok(s.negThreeHmGap > 0);
  assert.ok(s.negThreeAmGap > 0);
});

test('lehmer-neg-3-mean: drops zero-bearing source', () => {
  const queue = mkSeries('s', [1, 2, 0, 3]);
  const r = buildSourceRowTokenLehmerNegThreeMean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroBearingSources, 1);
});

test('lehmer-neg-3-mean: drops negative total_tokens row but keeps source', () => {
  const queue = mkSeries('s', [1, 2, -1, 3]);
  const r = buildSourceRowTokenLehmerNegThreeMean(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('lehmer-neg-3-mean: scale equivariance c=10', () => {
  const xs = [3, 7, 11, 13, 19];
  const a = buildSourceRowTokenLehmerNegThreeMean(mkSeries('s', xs), {
    generatedAt: GEN,
  }).sources[0]!.lehmerNegThreeMean;
  const b = buildSourceRowTokenLehmerNegThreeMean(
    mkSeries('s', xs.map((x) => 10 * x)),
    { generatedAt: GEN },
  ).sources[0]!.lehmerNegThreeMean;
  assert.ok(Math.abs(b - 10 * a) < 1e-9 * Math.max(1, b));
});

test('lehmer-neg-3-mean: order invariance', () => {
  const xs = [5, 17, 3, 41, 23, 11];
  const a = buildSourceRowTokenLehmerNegThreeMean(mkSeries('s', xs), {
    generatedAt: GEN,
  }).sources[0]!.lehmerNegThreeMean;
  const reversed = [...xs].reverse();
  const b = buildSourceRowTokenLehmerNegThreeMean(mkSeries('s', reversed), {
    generatedAt: GEN,
  }).sources[0]!.lehmerNegThreeMean;
  assert.ok(Math.abs(a - b) < 1e-12);
});

test('lehmer-neg-3-mean: sort key lehmer-neg-3-mean-asc orders ascending', () => {
  const a = mkSeries('a', [1, 1, 1, 100]); // small L_-3 (~1)
  const b = mkSeries('b', [50, 50, 50, 50]); // L_-3 = 50
  const queue = [...a, ...b];
  const r = buildSourceRowTokenLehmerNegThreeMean(queue, {
    generatedAt: GEN,
    sort: 'lehmer-neg-3-mean-asc',
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('lehmer-neg-3-mean: --top caps and surfaces droppedBelowTopCap', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30]),
    ...mkSeries('b', [5, 15, 25]),
    ...mkSeries('c', [1, 2, 3]),
  ];
  const r = buildSourceRowTokenLehmerNegThreeMean(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('lehmer-neg-3-mean: cross-validates L_-2 against neg-2 builder', () => {
  const xs = [3, 7, 11, 13, 19, 23, 29];
  const queue = mkSeries('s', xs);
  const a = buildSourceRowTokenLehmerNegThreeMean(queue, { generatedAt: GEN })
    .sources[0]!.lehmerNegTwoMean;
  const b = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN })
    .sources[0]!.lehmerNegTwoMean;
  assert.ok(Math.abs(a - b) < 1e-9 * Math.max(1, b));
});

test('lehmer-neg-3-mean: cross-validates HM against harmonic-mean builder', () => {
  const xs = [3, 7, 11, 13, 19];
  const queue = mkSeries('s', xs);
  const a = buildSourceRowTokenLehmerNegThreeMean(queue, { generatedAt: GEN })
    .sources[0]!.harmonicMean;
  const b = buildSourceRowTokenHarmonicMean(queue, { generatedAt: GEN })
    .sources[0]!.harmonicMean;
  assert.ok(Math.abs(a - b) < 1e-9 * Math.max(1, b));
});

test('lehmer-neg-3-mean: min-rows gates source out', () => {
  const queue = mkSeries('s', [10, 20]);
  const r = buildSourceRowTokenLehmerNegThreeMean(queue, {
    generatedAt: GEN,
    minRows: 5,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('lehmer-neg-3-mean: min-lehmer-neg-3-mean gates cohort', () => {
  const queue = mkSeries('s', [1, 1, 1, 100]);
  const r = buildSourceRowTokenLehmerNegThreeMean(queue, {
    generatedAt: GEN,
    minLehmerNegThreeMean: 50,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinLehmerNegThreeMean, 1);
});

test('lehmer-neg-3-mean: invalid sort throws', () => {
  assert.throws(() =>
    buildSourceRowTokenLehmerNegThreeMean(mkSeries('s', [1, 2]), {
      generatedAt: GEN,
      sort: 'bogus' as any,
    }),
  );
});

test('lehmer-neg-3-mean: invalid minRows throws', () => {
  assert.throws(() =>
    buildSourceRowTokenLehmerNegThreeMean(mkSeries('s', [1, 2]), {
      generatedAt: GEN,
      minRows: 0,
    }),
  );
});

test('lehmer-neg-3-mean: invalid since throws', () => {
  assert.throws(() =>
    buildSourceRowTokenLehmerNegThreeMean(mkSeries('s', [1, 2]), {
      generatedAt: GEN,
      since: 'not-a-date',
    }),
  );
});

test('lehmer-neg-3-mean: source filter restricts and counts dropped', () => {
  const queue = [...mkSeries('a', [1, 2]), ...mkSeries('b', [3, 4])];
  const r = buildSourceRowTokenLehmerNegThreeMean(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 2);
});

test('lehmer-neg-3-mean: cross-check against L_-1 ladder upper bound', () => {
  const xs = [2, 5, 11, 23, 47];
  const queue = mkSeries('s', xs);
  const l3row = buildSourceRowTokenLehmerNegThreeMean(queue, {
    generatedAt: GEN,
  }).sources[0]!;
  const l1 = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN })
    .sources[0]!.lehmerNegOneMean;
  // L_-3 <= L_-2 <= L_-1
  assert.ok(l3row.lehmerNegThreeMean <= l3row.lehmerNegTwoMean + 1e-9);
  assert.ok(l3row.lehmerNegTwoMean <= l1 + 1e-9);
});
