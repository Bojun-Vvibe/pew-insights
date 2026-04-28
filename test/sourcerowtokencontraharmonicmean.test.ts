import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenContraharmonicMean } from '../src/sourcerowtokencontraharmonicmean.js';
import { buildSourceRowTokenQuadraticMean } from '../src/sourcerowtokenquadraticmean.js';
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

function chmReference(xs: number[]): {
  mean: number;
  qm: number;
  chm: number;
} {
  const n = xs.length;
  let sumSq = 0;
  let total = 0;
  for (const x of xs) {
    sumSq += x * x;
    total += x;
  }
  return {
    mean: total / n,
    qm: Math.sqrt(sumSq / n),
    chm: total === 0 ? 0 : sumSq / total,
  };
}

// ---------- shape / option validation (12) ----------

test('chm: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenContraharmonicMean([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 1);
  assert.equal(r.minContraharmonicMean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'contraharmonic-mean-desc');
  assert.equal(r.generatedAt, GEN);
});

test('chm: minRows < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenContraharmonicMean([], { minRows: 0 }),
    /minRows must be an integer >= 1/,
  );
});

test('chm: minRows non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenContraharmonicMean([], {
        minRows: 2.5 as unknown as number,
      }),
    /minRows must be an integer >= 1/,
  );
});

test('chm: minContraharmonicMean negative throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenContraharmonicMean([], {
        minContraharmonicMean: -1,
      }),
    /minContraharmonicMean must be a finite, non-negative number/,
  );
});

test('chm: minContraharmonicMean NaN throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenContraharmonicMean([], {
        minContraharmonicMean: Number.NaN,
      }),
    /minContraharmonicMean must be a finite, non-negative number/,
  );
});

test('chm: minContraharmonicMean Infinity throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenContraharmonicMean([], {
        minContraharmonicMean: Number.POSITIVE_INFINITY,
      }),
    /minContraharmonicMean must be a finite, non-negative number/,
  );
});

test('chm: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenContraharmonicMean([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('chm: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenContraharmonicMean([], { top: 2.5 }),
    /top must be a positive integer/,
  );
});

test('chm: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenContraharmonicMean([], {
        sort: 'banana' as unknown as 'contraharmonic-mean-desc',
      }),
    /sort must be one of/,
  );
});

test('chm: invalid since throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenContraharmonicMean([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('chm: invalid until throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenContraharmonicMean([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('chm: generatedAt defaults to now ISO when omitted', () => {
  const r = buildSourceRowTokenContraharmonicMean([]);
  assert.match(r.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

// ---------- arithmetic correctness (10) ----------

test('chm: single positive row -> CHM = mean = QM = that row', () => {
  const queue = mkSeries('s', [42]);
  const r = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.contraharmonicMean, 42);
  assert.equal(row.mean, 42);
  assert.equal(row.quadraticMean, 42);
  assert.equal(row.chmAmGap, 0);
  assert.equal(row.chmQmGap, 0);
});

test('chm: constant positive series -> CHM = c, gaps = 0', () => {
  const queue = mkSeries('s', [7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.contraharmonicMean, 7);
  assert.equal(row.mean, 7);
  assert.equal(row.quadraticMean, 7);
  assert.equal(row.chmAmGap, 0);
  assert.equal(row.chmQmGap, 0);
});

test('chm: known sample [1,1,1,1,1000] arithmetic check', () => {
  const queue = mkSeries('s', [1, 1, 1, 1, 1000]);
  const r = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  const ref = chmReference([1, 1, 1, 1, 1000]);
  // sumSq = 4 + 1_000_000 = 1_000_004; sumX = 1004; CHM = 1_000_004 / 1004
  assert.ok(Math.abs(row.contraharmonicMean - ref.chm) < 1e-6);
  assert.ok(Math.abs(row.contraharmonicMean - 1_000_004 / 1004) < 1e-6);
  assert.ok(row.chmAmGap > 0);
  assert.ok(row.chmQmGap > 0);
});

test('chm: known sample [1,2,3,4,5] arithmetic check', () => {
  const queue = mkSeries('s', [1, 2, 3, 4, 5]);
  const r = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // sumSq = 1+4+9+16+25 = 55; sumX = 15; CHM = 55/15 ~ 3.6667
  assert.ok(Math.abs(row.contraharmonicMean - 55 / 15) < 1e-12);
  assert.ok(Math.abs(row.mean - 3) < 1e-12);
  assert.ok(Math.abs(row.quadraticMean - Math.sqrt(11)) < 1e-12);
});

test('chm: matches reference on 50 random samples', () => {
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 3 + Math.floor(Math.random() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(Math.random() * 1000));
    if (xs.every((x) => x === 0)) xs[0] = 1;
    const queue = mkSeries('s', xs);
    const r = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN });
    const row = r.sources[0]!;
    const ref = chmReference(xs);
    assert.ok(Math.abs(row.contraharmonicMean - ref.chm) < 1e-6);
    assert.ok(Math.abs(row.mean - ref.mean) < 1e-6);
    assert.ok(Math.abs(row.quadraticMean - ref.qm) < 1e-6);
  }
});

test('chm: zero rows are kept and contribute 0 to sums', () => {
  const queue = mkSeries('s', [0, 0, 5, 0, 0]);
  const r = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // sumSq = 25, sumX = 5, CHM = 25/5 = 5; mean = 1; qm = sqrt(5)
  assert.equal(row.rowsKept, 5);
  assert.ok(Math.abs(row.contraharmonicMean - 5) < 1e-12);
  assert.ok(Math.abs(row.mean - 1) < 1e-12);
});

test('chm: all-zero source -> droppedAllZeroSources, not in output', () => {
  const queue = mkSeries('s', [0, 0, 0, 0]);
  const r = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAllZeroSources, 1);
  assert.equal(r.totalSources, 1);
});

test('chm: degenerate two-row [0, v] -> CHM = v', () => {
  const queue = mkSeries('s', [0, 7]);
  const r = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // sumSq = 49, sumX = 7, CHM = 49/7 = 7
  assert.ok(Math.abs(row.contraharmonicMean - 7) < 1e-12);
});

test('chm: large-row dominance: CHM closer to max than mean', () => {
  const queue = mkSeries('s', [1, 1, 1, 1, 100000]);
  const r = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // CHM ~ 100000^2 / 100004 ~ 99996
  assert.ok(row.contraharmonicMean > 99990);
  assert.ok(row.contraharmonicMean < 100000);
  assert.ok(row.mean < 25000);
});

test('chm: order-invariant', () => {
  const a = mkSeries('s', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const b = mkSeries('s', [10, 5, 3, 8, 2, 9, 1, 7, 4, 6]);
  const ra = buildSourceRowTokenContraharmonicMean(a, { generatedAt: GEN });
  const rb = buildSourceRowTokenContraharmonicMean(b, { generatedAt: GEN });
  assert.ok(
    Math.abs(ra.sources[0]!.contraharmonicMean - rb.sources[0]!.contraharmonicMean) <
      1e-12,
  );
});

// ---------- equivariance (4) ----------

test('chm: scale-equivariant — rescaling by c rescales CHM by c', () => {
  const xs = [3, 5, 8, 12, 17, 21];
  for (const c of [0.5, 2, 5, 10, 0.1]) {
    const ra = buildSourceRowTokenContraharmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const rb = buildSourceRowTokenContraharmonicMean(
      mkSeries('s', xs.map((x) => x * c)),
      { generatedAt: GEN },
    );
    assert.ok(
      Math.abs(rb.sources[0]!.contraharmonicMean - c * ra.sources[0]!.contraharmonicMean) <
        1e-9,
    );
  }
});

test('chm: NOT translation-equivariant — shift by c does not shift CHM by c', () => {
  const xs = [1, 2, 3, 4, 5];
  const r0 = buildSourceRowTokenContraharmonicMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r1 = buildSourceRowTokenContraharmonicMean(
    mkSeries('s', xs.map((x) => x + 100)),
    { generatedAt: GEN },
  );
  // would be CHM_orig + 100 if translation-equivariant
  const naive = r0.sources[0]!.contraharmonicMean + 100;
  assert.notEqual(r1.sources[0]!.contraharmonicMean.toFixed(6), naive.toFixed(6));
});

test('chm: scaling preserves chm-am gap proportion', () => {
  const xs = [2, 4, 8, 16];
  const r0 = buildSourceRowTokenContraharmonicMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r1 = buildSourceRowTokenContraharmonicMean(
    mkSeries('s', xs.map((x) => x * 7)),
    { generatedAt: GEN },
  );
  const ratio0 = r0.sources[0]!.chmAmGap / r0.sources[0]!.mean;
  const ratio1 = r1.sources[0]!.chmAmGap / r1.sources[0]!.mean;
  assert.ok(Math.abs(ratio0 - ratio1) < 1e-9);
});

test('chm: zero-scale collapses to all-zero (dropped)', () => {
  const xs = [3, 5, 8];
  const r = buildSourceRowTokenContraharmonicMean(
    mkSeries('s', xs.map((x) => x * 0)),
    { generatedAt: GEN },
  );
  assert.equal(r.droppedAllZeroSources, 1);
  assert.equal(r.sources.length, 0);
});

// ---------- Pythagorean / Cauchy-Schwarz sandwich (5) ----------

test('chm: AM <= QM <= CHM on 50 randomized non-constant samples', () => {
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 5 + Math.floor(Math.random() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(1 + Math.floor(Math.random() * 1000));
    const r = buildSourceRowTokenContraharmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    assert.ok(row.mean <= row.quadraticMean + 1e-9);
    assert.ok(row.quadraticMean <= row.contraharmonicMean + 1e-9);
    assert.ok(row.chmAmGap >= -1e-9);
    assert.ok(row.chmQmGap >= -1e-9);
  }
});

test('chm: full extended sandwich HM <= GM <= AM <= QM <= CHM (cross-lens)', () => {
  const xs = [3, 5, 8, 12, 17, 21, 30, 41];
  const queue = mkSeries('s', xs);
  const chmR = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN });
  const qmR = buildSourceRowTokenQuadraticMean(queue, { generatedAt: GEN });
  const hmR = buildSourceRowTokenHarmonicMean(queue, { generatedAt: GEN });
  const chm = chmR.sources[0]!.contraharmonicMean;
  const qm = qmR.sources[0]!.quadraticMean;
  const am = qmR.sources[0]!.mean;
  const hm = hmR.sources[0]!.harmonicMean;
  const gm = hmR.sources[0]!.geometricMean;
  assert.ok(hm <= gm + 1e-9);
  assert.ok(gm <= am + 1e-9);
  assert.ok(am <= qm + 1e-9);
  assert.ok(qm <= chm + 1e-9);
});

test('chm: sandwich tight on constant series', () => {
  const queue = mkSeries('s', [11, 11, 11, 11, 11, 11]);
  const chmR = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN });
  const qmR = buildSourceRowTokenQuadraticMean(queue, { generatedAt: GEN });
  assert.equal(chmR.sources[0]!.contraharmonicMean, 11);
  assert.equal(qmR.sources[0]!.quadraticMean, 11);
  assert.equal(chmR.sources[0]!.chmAmGap, 0);
  assert.equal(chmR.sources[0]!.chmQmGap, 0);
});

test('chm: chmQmGap matches CHM - QM exactly', () => {
  const queue = mkSeries('s', [2, 7, 13, 25, 41, 59]);
  const chmR = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN });
  const qmR = buildSourceRowTokenQuadraticMean(queue, { generatedAt: GEN });
  const expected =
    chmR.sources[0]!.contraharmonicMean - qmR.sources[0]!.quadraticMean;
  assert.ok(Math.abs(chmR.sources[0]!.chmQmGap - expected) < 1e-9);
});

test('chm: chmAmGap matches CHM - AM exactly', () => {
  const queue = mkSeries('s', [3, 9, 27, 81, 243]);
  const r = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(
    Math.abs(row.chmAmGap - (row.contraharmonicMean - row.mean)) < 1e-9,
  );
});

// ---------- filters / windows (10) ----------

test('chm: filters bad hour_start', () => {
  const q = [
    ql('not-a-date', 's', 5),
    ql('2026-04-27T00:00:00.000Z', 's', 7),
    ql('2026-04-27T01:00:00.000Z', 's', 9),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsKept, 2);
});

test('chm: filters bad total_tokens', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 's', Number.NaN),
    ql('2026-04-27T01:00:00.000Z', 's', 5),
    ql('2026-04-27T02:00:00.000Z', 's', 7),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('chm: filters Infinity total_tokens', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 's', Number.POSITIVE_INFINITY),
    ql('2026-04-27T01:00:00.000Z', 's', 5),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('chm: filters negative total_tokens', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 's', -3),
    ql('2026-04-27T01:00:00.000Z', 's', 5),
    ql('2026-04-27T02:00:00.000Z', 's', 7),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 2);
});

test('chm: since filter excludes earlier rows', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 's', 100),
    ql('2026-04-28T00:00:00.000Z', 's', 5),
    ql('2026-04-28T01:00:00.000Z', 's', 7),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, {
    since: '2026-04-28T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.rowsKept, 2);
});

test('chm: until filter excludes later rows', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 's', 5),
    ql('2026-04-27T23:59:00.000Z', 's', 7),
    ql('2026-04-28T00:00:00.000Z', 's', 100),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, {
    until: '2026-04-28T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.rowsKept, 2);
});

test('chm: source filter only keeps matching rows', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3]),
    ...mkSeries('b', [10, 20, 30]),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 3);
});

test('chm: minRows filters out small sources', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [10, 20]),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, {
    minRows: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('chm: minContraharmonicMean cohort filter', () => {
  const q = [
    ...mkSeries('a', [1, 1, 1, 1]),
    ...mkSeries('b', [100, 100, 100, 100]),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, {
    minContraharmonicMean: 50,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinContraharmonicMean, 1);
});

test('chm: empty source string maps to "unknown"', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', '', 5),
    ql('2026-04-27T01:00:00.000Z', '', 7),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

// ---------- sort orders (7) ----------

test('chm: default sort = contraharmonic-mean-desc', () => {
  const q = [
    ...mkSeries('a', [1, 1, 1, 1]),
    ...mkSeries('b', [10, 10, 10, 10]),
    ...mkSeries('c', [5, 5, 5, 5]),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'c', 'a'],
  );
});

test('chm: contraharmonic-mean-asc', () => {
  const q = [
    ...mkSeries('a', [1, 1, 1, 1]),
    ...mkSeries('b', [10, 10, 10, 10]),
    ...mkSeries('c', [5, 5, 5, 5]),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, {
    sort: 'contraharmonic-mean-asc',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'c', 'b'],
  );
});

test('chm: mean-desc', () => {
  const q = [
    ...mkSeries('a', [1, 1, 100]),
    ...mkSeries('b', [50, 50, 50]),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, {
    sort: 'mean-desc',
    generatedAt: GEN,
  });
  // a mean=34, b mean=50
  assert.equal(r.sources[0]!.source, 'b');
});

test('chm: gap-desc puts highest chmAmGap first', () => {
  const q = [
    ...mkSeries('a', [10, 10, 10, 10]), // gap = 0
    ...mkSeries('b', [1, 1, 1, 100]), // big gap
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, {
    sort: 'gap-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'b');
});

test('chm: qm-gap-desc puts highest chmQmGap first', () => {
  const q = [
    ...mkSeries('a', [10, 10, 10, 10]),
    ...mkSeries('b', [1, 1, 1, 1000]),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, {
    sort: 'qm-gap-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'b');
});

test('chm: rows sort puts most rows first', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3]),
    ...mkSeries('b', [4, 5, 6, 7, 8]),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'b');
});

test('chm: source sort is lex asc', () => {
  const q = [
    ...mkSeries('zeta', [1, 2, 3]),
    ...mkSeries('alpha', [4, 5, 6]),
    ...mkSeries('mu', [7, 8, 9]),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mu', 'zeta'],
  );
});

// ---------- top cap (3) ----------

test('chm: top cap limits output and surfaces droppedBelowTopCap', () => {
  const q = [
    ...mkSeries('a', [10, 10, 10]),
    ...mkSeries('b', [20, 20, 20]),
    ...mkSeries('c', [30, 30, 30]),
    ...mkSeries('d', [40, 40, 40]),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
  assert.deepEqual(r.sources.map((s) => s.source), ['d', 'c']);
});

test('chm: top cap >= total returns all', () => {
  const q = [
    ...mkSeries('a', [10, 10]),
    ...mkSeries('b', [20, 20]),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, {
    top: 10,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 0);
});

test('chm: top cap = 1 returns single best', () => {
  const q = [
    ...mkSeries('a', [10, 10]),
    ...mkSeries('b', [100, 100]),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, {
    top: 1,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});

// ---------- determinism / tiebreaks (3) ----------

test('chm: tiebreak on equal CHM is source asc', () => {
  const q = [
    ...mkSeries('charlie', [5, 5, 5]),
    ...mkSeries('alpha', [5, 5, 5]),
    ...mkSeries('bravo', [5, 5, 5]),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'bravo', 'charlie'],
  );
});

test('chm: pure builder — same input twice yields identical output', () => {
  const q = mkSeries('s', [3, 7, 11, 13, 17, 19]);
  const r1 = buildSourceRowTokenContraharmonicMean(q, { generatedAt: GEN });
  const r2 = buildSourceRowTokenContraharmonicMean(q, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});

test('chm: report fields windowStart/windowEnd echo since/until', () => {
  const q = mkSeries('s', [1, 2, 3]);
  const r = buildSourceRowTokenContraharmonicMean(q, {
    since: '2026-04-26T00:00:00.000Z',
    until: '2026-04-30T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.windowStart, '2026-04-26T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00.000Z');
});

// ---------- bound checks (3) ----------

test('chm: CHM in [mean, max] for non-negative samples', () => {
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 4 + Math.floor(Math.random() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(1 + Math.floor(Math.random() * 999));
    const r = buildSourceRowTokenContraharmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    const max = Math.max(...xs);
    assert.ok(row.contraharmonicMean >= row.mean - 1e-9);
    assert.ok(row.contraharmonicMean <= max + 1e-9);
  }
});

test('chm: bottleneck row [1,1,1,1,M] -> CHM > M/2 for large M', () => {
  const r = buildSourceRowTokenContraharmonicMean(
    mkSeries('s', [1, 1, 1, 1, 1_000_000]),
    { generatedAt: GEN },
  );
  assert.ok(r.sources[0]!.contraharmonicMean > 500_000);
});

test('chm: total counters match expectations', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3]),
    ...mkSeries('b', [4, 5]),
  ];
  const r = buildSourceRowTokenContraharmonicMean(q, { generatedAt: GEN });
  assert.equal(r.totalSources, 2);
  assert.equal(r.totalRowsKept, 5);
});
