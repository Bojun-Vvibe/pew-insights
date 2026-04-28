import { test } from 'node:test';
import { strict as assert } from 'node:assert';
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
} {
  const n = xs.length;
  let sumInv = 0;
  let sumInvSq = 0;
  let total = 0;
  for (const x of xs) {
    sumInv += 1 / x;
    sumInvSq += 1 / (x * x);
    total += x;
  }
  return {
    mean: total / n,
    hm: n / sumInv,
    lneg1: sumInv / sumInvSq,
  };
}

test('lehmer-neg-1-mean: identity on a constant positive series', () => {
  const queue = mkSeries('s', [7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.rowsKept, 5);
  assert.ok(Math.abs(s.lehmerNegOneMean - 7) < 1e-12);
  assert.ok(Math.abs(s.harmonicMean - 7) < 1e-12);
  assert.ok(Math.abs(s.mean - 7) < 1e-12);
  assert.ok(Math.abs(s.negOneHmGap) < 1e-12);
  assert.ok(Math.abs(s.negOneAmGap) < 1e-12);
});

test('lehmer-neg-1-mean: single positive row -> L_-1 = HM = mean = v', () => {
  const queue = mkSeries('s', [42]);
  const r = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.rowsKept, 1);
  assert.ok(Math.abs(s.lehmerNegOneMean - 42) < 1e-12);
  assert.ok(Math.abs(s.harmonicMean - 42) < 1e-12);
  assert.ok(Math.abs(s.mean - 42) < 1e-12);
  assert.ok(Math.abs(s.negOneHmGap) < 1e-12);
  assert.ok(Math.abs(s.negOneAmGap) < 1e-12);
});

test('lehmer-neg-1-mean: matches closed-form reference on a hand-picked sample', () => {
  const xs = [1, 2, 4, 8, 16];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN });
  const ref = reference(xs);
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.mean - ref.mean) < 1e-12);
  assert.ok(Math.abs(s.harmonicMean - ref.hm) < 1e-12);
  assert.ok(Math.abs(s.lehmerNegOneMean - ref.lneg1) < 1e-12);
});

test('lehmer-neg-1-mean: a single tiny row dominates more than HM', () => {
  // [1, 1000, 1000, 1000]
  const xs = [1, 1000, 1000, 1000];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  const ref = reference(xs);
  // L_-1 within ~0.3% of 1 (the bottleneck) ; HM at ~3.988
  assert.ok(Math.abs(s.lehmerNegOneMean - ref.lneg1) < 1e-9);
  assert.ok(s.lehmerNegOneMean > 1 && s.lehmerNegOneMean < 1.01);
  assert.ok(s.harmonicMean > 3.9 && s.harmonicMean < 4.0);
  assert.ok(s.mean > 750 && s.mean < 751);
});

test('lehmer-neg-1-mean: Lehmer monotonicity L_-1 <= HM (always >=0 gap)', () => {
  // ten different non-constant positive samples
  const samples: number[][] = [
    [1, 2, 3, 4, 5],
    [1, 1, 1, 100],
    [10, 20, 30, 40, 50, 60],
    [1, 9, 1, 9, 1, 9],
    [5, 5, 5, 5, 6],
    [100, 1, 1, 1, 1],
    [3, 7, 11, 13, 17, 19],
    [2, 4, 6, 8],
    [50, 50, 50, 100],
    [1, 2, 1, 2, 1, 2, 1000],
  ];
  for (const xs of samples) {
    const queue = mkSeries('s', xs);
    const r = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN });
    const s = r.sources[0]!;
    assert.ok(s.negOneHmGap >= -1e-12, `negOneHmGap < 0 for ${xs}`);
    assert.ok(s.lehmerNegOneMean <= s.harmonicMean + 1e-9);
  }
});

test('lehmer-neg-1-mean: AM gap mean - L_-1 always >= 0', () => {
  const samples: number[][] = [
    [1, 2, 3],
    [10, 20, 30, 40],
    [5, 5, 5, 5, 50],
    [1, 1, 1, 1000],
    [7, 14, 21, 28, 35],
  ];
  for (const xs of samples) {
    const r = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const s = r.sources[0]!;
    assert.ok(s.negOneAmGap >= -1e-12, `negOneAmGap < 0 for ${xs}`);
    assert.ok(s.lehmerNegOneMean <= s.mean + 1e-9);
  }
});

test('lehmer-neg-1-mean: scale-equivariance — multiplying every row by c rescales L_-1 by c', () => {
  const xs = [3, 5, 8, 13, 21];
  const r1 = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  for (const c of [0.5, 2, 7, 100]) {
    const scaled = xs.map((x) => x * c);
    const r2 = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', scaled), {
      generatedAt: GEN,
    });
    const expected = r1.sources[0]!.lehmerNegOneMean * c;
    const got = r2.sources[0]!.lehmerNegOneMean;
    assert.ok(Math.abs(got - expected) < 1e-9, `c=${c} expected ${expected} got ${got}`);
  }
});

test('lehmer-neg-1-mean: order-invariance — permuting rows leaves L_-1 unchanged', () => {
  const a = [1, 2, 4, 8, 16, 32];
  const b = [32, 16, 8, 4, 2, 1];
  const ra = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', a), {
    generatedAt: GEN,
  });
  const rb = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', b), {
    generatedAt: GEN,
  });
  assert.ok(
    Math.abs(ra.sources[0]!.lehmerNegOneMean - rb.sources[0]!.lehmerNegOneMean) <
      1e-12,
  );
});

test('lehmer-neg-1-mean: NOT translation-equivariant', () => {
  // shifting [1, 2, 4] by +10 -> [11, 12, 14]; L_-1 should NOT shift by +10
  const ra = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', [1, 2, 4]), {
    generatedAt: GEN,
  });
  const rb = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', [11, 12, 14]), {
    generatedAt: GEN,
  });
  const shifted = ra.sources[0]!.lehmerNegOneMean + 10;
  const got = rb.sources[0]!.lehmerNegOneMean;
  assert.ok(Math.abs(shifted - got) > 0.01, 'L_-1 unexpectedly translation-equivariant');
});

test('lehmer-neg-1-mean: bounded by [min, HM] on positive sample', () => {
  for (const xs of [
    [1, 2, 4],
    [10, 20, 30, 40],
    [3, 3, 3, 100],
    [1, 1000],
  ]) {
    const r = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const s = r.sources[0]!;
    const minX = Math.min(...xs);
    assert.ok(s.lehmerNegOneMean >= minX - 1e-9);
    assert.ok(s.lehmerNegOneMean <= s.harmonicMean + 1e-9);
  }
});

test('lehmer-neg-1-mean: HM = mean = L_-1 = c on constant positive series', () => {
  const r = buildSourceRowTokenLehmerNegOneMean(
    mkSeries('s', [13, 13, 13, 13]),
    {
      generatedAt: GEN,
    },
  );
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.harmonicMean - 13) < 1e-12);
  assert.ok(Math.abs(s.mean - 13) < 1e-12);
  assert.ok(Math.abs(s.lehmerNegOneMean - 13) < 1e-12);
});

test('lehmer-neg-1-mean: all-zero series -> droppedZeroBearingSources', () => {
  const queue = mkSeries('s', [0, 0, 0]);
  const r = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroBearingSources, 1);
});

test('lehmer-neg-1-mean: any zero row -> droppedZeroBearingSources', () => {
  // mixed positive/zero -> still dropped (1/0 diverges)
  const queue = mkSeries('s', [10, 20, 0, 30]);
  const r = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroBearingSources, 1);
});

test('lehmer-neg-1-mean: negative total_tokens dropped', () => {
  const queue = [
    ql('2026-04-27T01:00:00.000Z', 's', 10),
    ql('2026-04-27T02:00:00.000Z', 's', -5),
    ql('2026-04-27T03:00:00.000Z', 's', 20),
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 2);
});

test('lehmer-neg-1-mean: NaN/Infinity total_tokens dropped', () => {
  const queue = [
    ql('2026-04-27T01:00:00.000Z', 's', 10),
    ql('2026-04-27T02:00:00.000Z', 's', NaN),
    ql('2026-04-27T03:00:00.000Z', 's', Infinity),
    ql('2026-04-27T04:00:00.000Z', 's', 20),
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 2);
  assert.equal(r.sources[0]!.rowsKept, 2);
});

test('lehmer-neg-1-mean: invalid hour_start dropped', () => {
  const queue = [
    ql('2026-04-27T01:00:00.000Z', 's', 10),
    ql('not-a-date', 's', 20),
    ql('2026-04-27T03:00:00.000Z', 's', 30),
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsKept, 2);
});

test('lehmer-neg-1-mean: since/until window filtering', () => {
  const queue = [
    ql('2026-04-27T01:00:00.000Z', 's', 10),
    ql('2026-04-27T05:00:00.000Z', 's', 20),
    ql('2026-04-27T09:00:00.000Z', 's', 30),
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, {
    since: '2026-04-27T02:00:00.000Z',
    until: '2026-04-27T08:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.rowsKept, 1);
});

test('lehmer-neg-1-mean: --source filter', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3]),
    ...mkSeries('b', [10, 20, 30]),
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, {
    source: 'b',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.ok(r.droppedSourceFilter > 0);
});

test('lehmer-neg-1-mean: empty source name -> "unknown"', () => {
  const queue = mkSeries('', [10, 20, 30]);
  const r = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('lehmer-neg-1-mean: minRows display gate', () => {
  const queue = [
    ...mkSeries('a', [1, 2]),
    ...mkSeries('b', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, {
    minRows: 3,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('lehmer-neg-1-mean: minRows must be integer >= 1', () => {
  const queue = mkSeries('s', [10, 20]);
  assert.throws(
    () =>
      buildSourceRowTokenLehmerNegOneMean(queue, {
        minRows: 0,
        generatedAt: GEN,
      }),
    /minRows must be an integer >= 1/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenLehmerNegOneMean(queue, {
        minRows: 1.5,
        generatedAt: GEN,
      }),
    /minRows must be an integer/,
  );
});

test('lehmer-neg-1-mean: minLehmerNegOneMean cohort filter', () => {
  const queue = [
    ...mkSeries('low', [1, 1, 1]),
    ...mkSeries('hi', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, {
    minLehmerNegOneMean: 50,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'hi');
  assert.equal(r.droppedBelowMinLehmerNegOneMean, 1);
});

test('lehmer-neg-1-mean: minLehmerNegOneMean must be finite non-negative', () => {
  const queue = mkSeries('s', [10, 20]);
  assert.throws(
    () =>
      buildSourceRowTokenLehmerNegOneMean(queue, {
        minLehmerNegOneMean: -1,
        generatedAt: GEN,
      }),
    /finite, non-negative/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenLehmerNegOneMean(queue, {
        minLehmerNegOneMean: NaN,
        generatedAt: GEN,
      }),
    /finite, non-negative/,
  );
});

test('lehmer-neg-1-mean: top cap', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
    ...mkSeries('c', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('lehmer-neg-1-mean: top must be positive integer', () => {
  const queue = mkSeries('s', [10, 20]);
  assert.throws(
    () =>
      buildSourceRowTokenLehmerNegOneMean(queue, {
        top: 0,
        generatedAt: GEN,
      }),
    /top must be a positive integer/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenLehmerNegOneMean(queue, {
        top: 1.5,
        generatedAt: GEN,
      }),
    /top must be a positive integer/,
  );
});

test('lehmer-neg-1-mean: invalid sort throws', () => {
  const queue = mkSeries('s', [10, 20]);
  assert.throws(
    () =>
      buildSourceRowTokenLehmerNegOneMean(queue, {
        sort: 'bogus' as never,
        generatedAt: GEN,
      }),
    /sort must be one of/,
  );
});

test('lehmer-neg-1-mean: sort lehmer-neg-1-mean-desc default', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [100, 100, 100]),
    ...mkSeries('c', [10, 10, 10]),
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'c', 'a'],
  );
});

test('lehmer-neg-1-mean: sort lehmer-neg-1-mean-asc', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [100, 100, 100]),
    ...mkSeries('c', [10, 10, 10]),
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, {
    sort: 'lehmer-neg-1-mean-asc',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'c', 'b'],
  );
});

test('lehmer-neg-1-mean: sort hm-gap-desc', () => {
  // larger spread -> larger HM - L_-1 gap
  const queue = [
    ...mkSeries('flat', [10, 10, 10, 10]),
    ...mkSeries('spread', [1, 10, 100, 1000]),
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, {
    sort: 'hm-gap-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'spread');
  assert.ok(r.sources[0]!.negOneHmGap > r.sources[1]!.negOneHmGap);
});

test('lehmer-neg-1-mean: sort am-gap-desc', () => {
  const queue = [
    ...mkSeries('flat', [10, 10, 10, 10]),
    ...mkSeries('spread', [1, 10, 100, 1000]),
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, {
    sort: 'am-gap-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'spread');
  assert.ok(r.sources[0]!.negOneAmGap > r.sources[1]!.negOneAmGap);
});

test('lehmer-neg-1-mean: sort source asc', () => {
  const queue = [
    ...mkSeries('zeta', [10]),
    ...mkSeries('alpha', [10]),
    ...mkSeries('mu', [10]),
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mu', 'zeta'],
  );
});

test('lehmer-neg-1-mean: sort rows desc', () => {
  const queue = [
    ...mkSeries('a', [10, 10]),
    ...mkSeries('b', [10, 10, 10, 10, 10]),
    ...mkSeries('c', [10, 10, 10]),
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'c', 'a'],
  );
});

test('lehmer-neg-1-mean: harmonicMean byproduct matches sibling builder', () => {
  const xs = [3, 5, 8, 13, 21, 34];
  const r = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const rh = buildSourceRowTokenHarmonicMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  assert.ok(
    Math.abs(r.sources[0]!.harmonicMean - rh.sources[0]!.harmonicMean) < 1e-9,
  );
});

test('lehmer-neg-1-mean: invalid since throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmerNegOneMean([], {
        since: 'not-a-date',
        generatedAt: GEN,
      }),
    /invalid since/,
  );
});

test('lehmer-neg-1-mean: invalid until throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmerNegOneMean([], {
        until: 'not-a-date',
        generatedAt: GEN,
      }),
    /invalid until/,
  );
});

test('lehmer-neg-1-mean: window boundaries [since, until)', () => {
  const queue = [
    ql('2026-04-27T02:00:00.000Z', 's', 10), // exactly since: kept
    ql('2026-04-27T05:00:00.000Z', 's', 20),
    ql('2026-04-27T08:00:00.000Z', 's', 30), // exactly until: dropped
  ];
  const r = buildSourceRowTokenLehmerNegOneMean(queue, {
    since: '2026-04-27T02:00:00.000Z',
    until: '2026-04-27T08:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.rowsKept, 2);
});
