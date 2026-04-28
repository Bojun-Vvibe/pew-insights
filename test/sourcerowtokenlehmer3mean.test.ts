import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmer3Mean } from '../src/sourcerowtokenlehmer3mean.js';
import { buildSourceRowTokenContraharmonicMean } from '../src/sourcerowtokencontraharmonicmean.js';
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

function l3Reference(xs: number[]): {
  mean: number;
  chm: number;
  l3: number;
} {
  const n = xs.length;
  let sumCube = 0;
  let sumSq = 0;
  let total = 0;
  for (const x of xs) {
    sumCube += x * x * x;
    sumSq += x * x;
    total += x;
  }
  return {
    mean: total / n,
    chm: total === 0 ? 0 : sumSq / total,
    l3: sumSq === 0 ? 0 : sumCube / sumSq,
  };
}

// ---------- shape / option validation ----------

test('l3: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenLehmer3Mean([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 1);
  assert.equal(r.minLehmer3Mean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'lehmer-3-mean-desc');
  assert.equal(r.generatedAt, GEN);
});

test('l3: minRows < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer3Mean([], { minRows: 0 }),
    /minRows must be an integer >= 1/,
  );
});

test('l3: minRows non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer3Mean([], {
        minRows: 2.5 as unknown as number,
      }),
    /minRows must be an integer >= 1/,
  );
});

test('l3: minLehmer3Mean negative throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer3Mean([], { minLehmer3Mean: -1 }),
    /minLehmer3Mean must be a finite, non-negative number/,
  );
});

test('l3: minLehmer3Mean NaN throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer3Mean([], { minLehmer3Mean: Number.NaN }),
    /minLehmer3Mean must be a finite, non-negative number/,
  );
});

test('l3: minLehmer3Mean Infinity throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer3Mean([], {
        minLehmer3Mean: Number.POSITIVE_INFINITY,
      }),
    /minLehmer3Mean must be a finite, non-negative number/,
  );
});

test('l3: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer3Mean([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('l3: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer3Mean([], { top: 2.5 }),
    /top must be a positive integer/,
  );
});

test('l3: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer3Mean([], {
        sort: 'banana' as unknown as 'lehmer-3-mean-desc',
      }),
    /sort must be one of/,
  );
});

test('l3: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer3Mean([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('l3: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer3Mean([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('l3: generatedAt defaults to now ISO when omitted', () => {
  const r = buildSourceRowTokenLehmer3Mean([]);
  assert.match(r.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

// ---------- arithmetic correctness ----------

test('l3: single positive row -> L_3 = CHM = mean = that row', () => {
  const queue = mkSeries('s', [42]);
  const r = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.lehmer3Mean, 42);
  assert.equal(row.contraharmonicMean, 42);
  assert.equal(row.mean, 42);
  assert.equal(row.l3ChmGap, 0);
  assert.equal(row.l3AmGap, 0);
});

test('l3: constant positive series -> L_3 = c, gaps = 0', () => {
  const queue = mkSeries('s', [7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.lehmer3Mean, 7);
  assert.equal(row.contraharmonicMean, 7);
  assert.equal(row.mean, 7);
  assert.equal(row.l3ChmGap, 0);
  assert.equal(row.l3AmGap, 0);
});

test('l3: matches reference on [1,1,1,1,1000]', () => {
  const xs = [1, 1, 1, 1, 1000];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN });
  const ref = l3Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer3Mean - ref.l3) < 1e-9);
  assert.ok(Math.abs(row.contraharmonicMean - ref.chm) < 1e-9);
  assert.ok(Math.abs(row.mean - ref.mean) < 1e-9);
  // L_3 should sit very close to the bottleneck row (~999.996)
  assert.ok(row.lehmer3Mean > 999.99);
  assert.ok(row.lehmer3Mean < 1000);
});

test('l3: matches reference on [1,2,3,4,5]', () => {
  const xs = [1, 2, 3, 4, 5];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN });
  const ref = l3Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer3Mean - ref.l3) < 1e-9);
  assert.ok(Math.abs(row.contraharmonicMean - ref.chm) < 1e-9);
  // sumCube=225, sumSq=55 -> L_3 = 225/55 = 4.0909...
  assert.ok(Math.abs(row.lehmer3Mean - 225 / 55) < 1e-9);
});

test('l3: zero rows are no-ops; mixed [0, 0, 4]', () => {
  const xs = [0, 0, 4];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // sumCube=64, sumSq=16, sumX=4 -> L_3=4, CHM=4, mean=4/3
  assert.equal(row.lehmer3Mean, 4);
  assert.equal(row.contraharmonicMean, 4);
  assert.ok(Math.abs(row.mean - 4 / 3) < 1e-9);
  assert.ok(Math.abs(row.l3ChmGap - 0) < 1e-9);
  assert.ok(Math.abs(row.l3AmGap - (4 - 4 / 3)) < 1e-9);
});

test('l3: all-zero source dropped', () => {
  const queue = mkSeries('s', [0, 0, 0, 0]);
  const r = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAllZeroSources, 1);
});

test('l3: cross-check against contraharmonic builder', () => {
  const xs = [3, 5, 8, 13, 21, 34];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN });
  const chmReport = buildSourceRowTokenContraharmonicMean(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  const chmRow = chmReport.sources[0]!;
  assert.ok(Math.abs(row.contraharmonicMean - chmRow.contraharmonicMean) < 1e-9);
  assert.ok(Math.abs(row.mean - chmRow.mean) < 1e-9);
  // Lehmer monotonicity: L_3 >= CHM
  assert.ok(row.lehmer3Mean >= row.contraharmonicMean);
  assert.ok(row.l3ChmGap >= 0);
  assert.ok(row.l3AmGap >= row.l3ChmGap); // since CHM >= mean too
});

test('l3: scale-equivariance: rescale by 10 -> L_3 rescales by 10', () => {
  const xs = [1, 4, 9, 16, 25];
  const xs10 = xs.map((x) => x * 10);
  const r1 = buildSourceRowTokenLehmer3Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r10 = buildSourceRowTokenLehmer3Mean(mkSeries('s', xs10), {
    generatedAt: GEN,
  });
  const v1 = r1.sources[0]!.lehmer3Mean;
  const v10 = r10.sources[0]!.lehmer3Mean;
  assert.ok(Math.abs(v10 - v1 * 10) < 1e-7);
});

test('l3: order-invariance: shuffle does not change L_3', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const xsShuf = [9, 5, 5, 6, 3, 4, 2, 3, 1, 1];
  const a = buildSourceRowTokenLehmer3Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const b = buildSourceRowTokenLehmer3Mean(mkSeries('s', xsShuf), {
    generatedAt: GEN,
  }).sources[0]!;
  assert.ok(Math.abs(a.lehmer3Mean - b.lehmer3Mean) < 1e-9);
});

// ---------- filtering / sort / top ----------

test('l3: drops negative total_tokens', () => {
  const queue = [...mkSeries('s', [1, 2, 3]), ql('2026-04-27T05:00:00.000Z', 's', -5)];
  const r = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l3: minRows filter', () => {
  const queue = [...mkSeries('a', [10, 20, 30]), ...mkSeries('b', [5, 5])];
  const r = buildSourceRowTokenLehmer3Mean(queue, {
    generatedAt: GEN,
    minRows: 3,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('l3: minLehmer3Mean filter', () => {
  const queue = [...mkSeries('big', [100, 200, 300]), ...mkSeries('small', [1, 1, 1])];
  const r = buildSourceRowTokenLehmer3Mean(queue, {
    generatedAt: GEN,
    minLehmer3Mean: 50,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinLehmer3Mean, 1);
});

test('l3: top cap', () => {
  const queue = [
    ...mkSeries('a', [100]),
    ...mkSeries('b', [50]),
    ...mkSeries('c', [10]),
  ];
  const r = buildSourceRowTokenLehmer3Mean(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l3: sort source asc', () => {
  const queue = [...mkSeries('z', [5]), ...mkSeries('a', [5]), ...mkSeries('m', [5])];
  const r = buildSourceRowTokenLehmer3Mean(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'm', 'z'],
  );
});

test('l3: sort chm-gap-desc', () => {
  // Constant series have l3ChmGap = 0; spread series have l3ChmGap > 0.
  const queue = [
    ...mkSeries('flat', [10, 10, 10]),
    ...mkSeries('spread', [1, 1, 100]),
  ];
  const r = buildSourceRowTokenLehmer3Mean(queue, {
    generatedAt: GEN,
    sort: 'chm-gap-desc',
  });
  assert.equal(r.sources[0]!.source, 'spread');
});

test('l3: source filter restricts to single source', () => {
  const queue = [...mkSeries('a', [1, 2, 3]), ...mkSeries('b', [10, 20])];
  const r = buildSourceRowTokenLehmer3Mean(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 2);
});

test('l3: window filter via since/until', () => {
  const queue = [
    ql('2026-04-25T01:00:00.000Z', 's', 10),
    ql('2026-04-26T01:00:00.000Z', 's', 20),
    ql('2026-04-27T01:00:00.000Z', 's', 30),
  ];
  const r = buildSourceRowTokenLehmer3Mean(queue, {
    generatedAt: GEN,
    since: '2026-04-26T00:00:00.000Z',
    until: '2026-04-27T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.rowsKept, 1);
  assert.equal(r.sources[0]!.lehmer3Mean, 20);
});

// ---------- property: Lehmer monotonicity L_3 >= L_2 = CHM >= AM ----------

test('l3: property: L_3 >= CHM >= AM on random non-negative series', () => {
  const seeds = [1, 7, 13, 42, 99, 256, 1024];
  for (const seed of seeds) {
    let s = seed;
    const xs: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      // simple LCG
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      xs.push(s % 1000);
    }
    if (xs.every((x) => x === 0)) continue;
    const queue = mkSeries('s', xs);
    const r = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN });
    const row = r.sources[0]!;
    assert.ok(
      row.lehmer3Mean >= row.contraharmonicMean - 1e-9,
      `L_3 < CHM for seed ${seed}`,
    );
    assert.ok(
      row.contraharmonicMean >= row.mean - 1e-9,
      `CHM < AM for seed ${seed}`,
    );
  }
});
