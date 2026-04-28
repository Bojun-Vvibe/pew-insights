import { test } from 'node:test';
import { strict as assert } from 'node:assert';
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

function quadraticReference(xs: number[]): {
  mean: number;
  quadraticMean: number;
} {
  const n = xs.length;
  let sumSq = 0;
  let total = 0;
  for (const x of xs) {
    sumSq += x * x;
    total += x;
  }
  return { mean: total / n, quadraticMean: Math.sqrt(sumSq / n) };
}

// ---------- shape / option validation ----------

test('quadratic-mean: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenQuadraticMean([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 1);
  assert.equal(r.minQuadraticMean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'quadratic-mean-desc');
  assert.equal(r.generatedAt, GEN);
});

test('quadratic-mean: minRows < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenQuadraticMean([], { minRows: 0 }),
    /minRows must be an integer >= 1/,
  );
});

test('quadratic-mean: minRows non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenQuadraticMean([], {
        minRows: 2.5 as unknown as number,
      }),
    /minRows must be an integer >= 1/,
  );
});

test('quadratic-mean: minQuadraticMean negative throws', () => {
  assert.throws(
    () => buildSourceRowTokenQuadraticMean([], { minQuadraticMean: -1 }),
    /minQuadraticMean must be a finite, non-negative number/,
  );
});

test('quadratic-mean: minQuadraticMean NaN throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenQuadraticMean([], { minQuadraticMean: Number.NaN }),
    /minQuadraticMean must be a finite, non-negative number/,
  );
});

test('quadratic-mean: minQuadraticMean Infinity throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenQuadraticMean([], {
        minQuadraticMean: Number.POSITIVE_INFINITY,
      }),
    /minQuadraticMean must be a finite, non-negative number/,
  );
});

test('quadratic-mean: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenQuadraticMean([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('quadratic-mean: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenQuadraticMean([], { top: 2.5 }),
    /top must be a positive integer/,
  );
});

test('quadratic-mean: bad sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenQuadraticMean([], {
        sort: 'bogus' as unknown as never,
      }),
    /sort must be one of/,
  );
});

test('quadratic-mean: bad since throws', () => {
  assert.throws(
    () => buildSourceRowTokenQuadraticMean([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('quadratic-mean: bad until throws', () => {
  assert.throws(
    () => buildSourceRowTokenQuadraticMean([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

// ---------- core math ----------

test('quadratic-mean: single positive row -> QM equals that row, mean equals that row, gap=0', () => {
  const r = buildSourceRowTokenQuadraticMean(mkSeries('s', [42]), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 's');
  assert.equal(s.rowsKept, 1);
  assert.equal(s.mean, 42);
  assert.equal(s.quadraticMean, 42);
  assert.equal(s.qmAmGap, 0);
});

test('quadratic-mean: single zero row -> QM = 0, mean = 0, gap = 0', () => {
  const r = buildSourceRowTokenQuadraticMean(mkSeries('s', [0]), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.rowsKept, 1);
  assert.equal(s.mean, 0);
  assert.equal(s.quadraticMean, 0);
  assert.equal(s.qmAmGap, 0);
});

test('quadratic-mean: constant series -> QM = mean = c, gap = 0', () => {
  const c = 7;
  const r = buildSourceRowTokenQuadraticMean(mkSeries('s', [c, c, c, c, c]), {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.rowsKept, 5);
  assert.equal(s.mean, c);
  assert.equal(s.quadraticMean, c);
  assert.equal(s.qmAmGap, 0);
});

test('quadratic-mean: [3,4] -> QM = sqrt(12.5) = 3.5355..., mean = 3.5, gap > 0', () => {
  const r = buildSourceRowTokenQuadraticMean(mkSeries('s', [3, 4]), {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  const expectQM = Math.sqrt((9 + 16) / 2);
  assert.ok(Math.abs(s.quadraticMean - expectQM) < 1e-12);
  assert.equal(s.mean, 3.5);
  assert.ok(s.qmAmGap > 0);
});

test('quadratic-mean: [1,1,1,1,1000] -> QM ~ 447.4, mean ~ 200.8, gap ~ 246.6', () => {
  const r = buildSourceRowTokenQuadraticMean(
    mkSeries('s', [1, 1, 1, 1, 1000]),
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  const ref = quadraticReference([1, 1, 1, 1, 1000]);
  assert.ok(Math.abs(s.quadraticMean - ref.quadraticMean) < 1e-9);
  assert.ok(Math.abs(s.mean - ref.mean) < 1e-9);
  assert.ok(s.qmAmGap > 246 && s.qmAmGap < 247);
  assert.ok(s.quadraticMean > 447 && s.quadraticMean < 448);
});

test('quadratic-mean: matches reference impl for randomized non-negative series', () => {
  // deterministic LCG
  let seed = 13371337;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let trial = 0; trial < 20; trial += 1) {
    const n = 5 + Math.floor(rand() * 50);
    const xs = Array.from({ length: n }, () => Math.floor(rand() * 10000));
    // ensure not all-zero so QM > 0
    if (xs.every((v) => v === 0)) xs[0] = 1;
    const ref = quadraticReference(xs);
    const r = buildSourceRowTokenQuadraticMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const s = r.sources[0]!;
    assert.equal(s.rowsKept, n);
    assert.ok(Math.abs(s.mean - ref.mean) < 1e-6 * Math.max(1, ref.mean));
    assert.ok(
      Math.abs(s.quadraticMean - ref.quadraticMean) <
        1e-6 * Math.max(1, ref.quadraticMean),
    );
    assert.ok(s.qmAmGap >= -1e-9);
  }
});

// ---------- QM-AM inequality ----------

test('quadratic-mean: QM >= AM always (qmAmGap >= 0)', () => {
  const samples = [
    [1, 2, 3, 4, 5],
    [10, 10, 10, 10, 10],
    [1, 1, 1, 1, 1, 1, 1, 100],
    [0, 1, 2, 3],
    [42],
  ];
  for (const xs of samples) {
    const r = buildSourceRowTokenQuadraticMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const s = r.sources[0]!;
    assert.ok(
      s.quadraticMean >= s.mean - 1e-12,
      `QM (${s.quadraticMean}) >= AM (${s.mean}) failed for ${JSON.stringify(xs)}`,
    );
    assert.ok(s.qmAmGap >= -1e-12);
  }
});

test('quadratic-mean: QM >= AM with strict inequality unless constant', () => {
  const r1 = buildSourceRowTokenQuadraticMean(mkSeries('s', [5, 5, 5, 5]), {
    generatedAt: GEN,
  });
  assert.equal(r1.sources[0]!.qmAmGap, 0);

  const r2 = buildSourceRowTokenQuadraticMean(mkSeries('s', [1, 9]), {
    generatedAt: GEN,
  });
  assert.ok(r2.sources[0]!.qmAmGap > 0);
});

// ---------- scale equivariance ----------

test('quadratic-mean: scale-equivariance — multiplying all rows by c scales QM by c', () => {
  const xs = [3, 7, 11, 13, 17];
  const c = 4.5;
  const r1 = buildSourceRowTokenQuadraticMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenQuadraticMean(
    mkSeries(
      's',
      xs.map((v) => v * c),
    ),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r2.sources[0]!.quadraticMean - c * r1.sources[0]!.quadraticMean) <
      1e-9,
  );
  assert.ok(Math.abs(r2.sources[0]!.mean - c * r1.sources[0]!.mean) < 1e-9);
});

// ---------- NOT translation-equivariant ----------

test('quadratic-mean: NOT translation-equivariant — shifting by c does NOT shift QM by exactly c', () => {
  const xs = [1, 5, 10];
  const c = 100;
  const r1 = buildSourceRowTokenQuadraticMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenQuadraticMean(
    mkSeries(
      's',
      xs.map((v) => v + c),
    ),
    { generatedAt: GEN },
  );
  // mean shifts by exactly c
  assert.ok(Math.abs(r2.sources[0]!.mean - (r1.sources[0]!.mean + c)) < 1e-9);
  // QM shift is NOT exactly c on a non-constant series — that's the
  // qualitative break from L-estimators. (Concretely on this series
  // QM shifts by ~98.9, less than c=100, because the relative spread
  // shrinks after the upward shift; on series with tighter starting
  // spread or a different geometry, QM can shift by slightly more
  // than c. Either way: NOT equal to c.)
  const qmShift = r2.sources[0]!.quadraticMean - r1.sources[0]!.quadraticMean;
  assert.ok(
    Math.abs(qmShift - c) > 0.1,
    `QM shift (${qmShift}) should differ from c (${c}) on a non-constant series`,
  );
});

test('quadratic-mean: post-shift qmAmGap shrinks vs pre-shift (relative spread compression)', () => {
  // For non-negative series, shifting up by c >> mean compresses the
  // relative multiplicative spread, so the QM-AM gap shrinks toward 0.
  const xs = [1, 5, 10, 100];
  const c = 10000;
  const r1 = buildSourceRowTokenQuadraticMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenQuadraticMean(
    mkSeries(
      's',
      xs.map((v) => v + c),
    ),
    { generatedAt: GEN },
  );
  assert.ok(r2.sources[0]!.qmAmGap < r1.sources[0]!.qmAmGap);
  // both still >= 0
  assert.ok(r1.sources[0]!.qmAmGap >= 0);
  assert.ok(r2.sources[0]!.qmAmGap >= 0);
});

// ---------- filters: invalid / negative / source filter ----------

test('quadratic-mean: bad hour_start dropped', () => {
  const rows: QueueLine[] = [
    ql('not-a-date', 's', 5),
    ...mkSeries('s', [1, 2, 3]),
  ];
  const r = buildSourceRowTokenQuadraticMean(rows, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('quadratic-mean: NaN total_tokens dropped', () => {
  const rows: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 's', Number.NaN),
    ...mkSeries('s', [1, 2]),
  ];
  const r = buildSourceRowTokenQuadraticMean(rows, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 2);
});

test('quadratic-mean: negative total_tokens dropped', () => {
  const rows: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 's', -5),
    ...mkSeries('s', [1, 2]),
  ];
  const r = buildSourceRowTokenQuadraticMean(rows, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 2);
});

test('quadratic-mean: zero total_tokens KEPT (divergence from harmonic-mean)', () => {
  // QM allows zero (0^2 = 0); HM forbids it (1/0 undefined).
  const r = buildSourceRowTokenQuadraticMean(
    mkSeries('s', [0, 0, 4, 0, 3]),
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.equal(s.rowsKept, 5);
  // sumSq = 0+0+16+0+9 = 25; QM = sqrt(25/5) = sqrt(5)
  assert.ok(Math.abs(s.quadraticMean - Math.sqrt(5)) < 1e-12);
  // mean = 7/5 = 1.4
  assert.ok(Math.abs(s.mean - 1.4) < 1e-12);
});

test('quadratic-mean: all-zero series -> QM = 0, mean = 0, kept', () => {
  const r = buildSourceRowTokenQuadraticMean(mkSeries('s', [0, 0, 0, 0]), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.rowsKept, 4);
  assert.equal(s.mean, 0);
  assert.equal(s.quadraticMean, 0);
  assert.equal(s.qmAmGap, 0);
});

test('quadratic-mean: source filter drops non-matching', () => {
  const rows = [...mkSeries('a', [1, 2, 3]), ...mkSeries('b', [4, 5, 6])];
  const r = buildSourceRowTokenQuadraticMean(rows, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 3);
});

test('quadratic-mean: empty source string -> "unknown"', () => {
  const r = buildSourceRowTokenQuadraticMean(mkSeries('', [1, 2, 3]), {
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'unknown');
});

// ---------- since/until window ----------

test('quadratic-mean: since/until window filters', () => {
  const rows = [
    ql('2026-04-26T00:00:00.000Z', 's', 100),
    ql('2026-04-27T00:00:00.000Z', 's', 1),
    ql('2026-04-27T01:00:00.000Z', 's', 2),
    ql('2026-04-28T00:00:00.000Z', 's', 999),
  ];
  const r = buildSourceRowTokenQuadraticMean(rows, {
    generatedAt: GEN,
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.rowsKept, 2);
  // QM of [1,2] = sqrt(2.5)
  assert.ok(Math.abs(r.sources[0]!.quadraticMean - Math.sqrt(2.5)) < 1e-12);
});

// ---------- min-rows filter ----------

test('quadratic-mean: minRows drops sources below threshold', () => {
  const rows = [...mkSeries('a', [1, 2, 3]), ...mkSeries('b', [4])];
  const r = buildSourceRowTokenQuadraticMean(rows, {
    generatedAt: GEN,
    minRows: 2,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.totalRowsKept, 4);
});

// ---------- min-quadratic-mean filter ----------

test('quadratic-mean: minQuadraticMean drops below cohort threshold', () => {
  const rows = [...mkSeries('a', [1, 1, 1]), ...mkSeries('b', [100, 100, 100])];
  const r = buildSourceRowTokenQuadraticMean(rows, {
    generatedAt: GEN,
    minQuadraticMean: 50,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinQuadraticMean, 1);
});

// ---------- sort variants ----------

test('quadratic-mean: sort by quadratic-mean-desc (default)', () => {
  const rows = [
    ...mkSeries('a', [10, 10, 10]),
    ...mkSeries('b', [100, 100, 100]),
    ...mkSeries('c', [1, 1, 1]),
  ];
  const r = buildSourceRowTokenQuadraticMean(rows, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'a', 'c'],
  );
});

test('quadratic-mean: sort by quadratic-mean-asc', () => {
  const rows = [
    ...mkSeries('a', [10, 10, 10]),
    ...mkSeries('b', [100, 100, 100]),
    ...mkSeries('c', [1, 1, 1]),
  ];
  const r = buildSourceRowTokenQuadraticMean(rows, {
    generatedAt: GEN,
    sort: 'quadratic-mean-asc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['c', 'a', 'b'],
  );
});

test('quadratic-mean: sort by mean-desc', () => {
  const rows = [
    ...mkSeries('a', [10, 10, 10]),
    ...mkSeries('b', [100, 100, 100]),
    ...mkSeries('c', [1, 1, 1]),
  ];
  const r = buildSourceRowTokenQuadraticMean(rows, {
    generatedAt: GEN,
    sort: 'mean-desc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'a', 'c'],
  );
});

test('quadratic-mean: sort by gap-desc puts widest spread first', () => {
  const rows = [
    ...mkSeries('flat', [10, 10, 10, 10]),
    ...mkSeries('spread', [1, 1, 1, 100]),
  ];
  const r = buildSourceRowTokenQuadraticMean(rows, {
    generatedAt: GEN,
    sort: 'gap-desc',
  });
  assert.equal(r.sources[0]!.source, 'spread');
  assert.equal(r.sources[1]!.source, 'flat');
  assert.equal(r.sources[1]!.qmAmGap, 0);
});

test('quadratic-mean: sort by rows', () => {
  const rows = [...mkSeries('a', [1, 2]), ...mkSeries('b', [1, 2, 3, 4])];
  const r = buildSourceRowTokenQuadraticMean(rows, {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[1]!.source, 'a');
});

test('quadratic-mean: sort by source asc lex', () => {
  const rows = [
    ...mkSeries('zeta', [1, 2]),
    ...mkSeries('alpha', [3, 4]),
    ...mkSeries('mu', [5, 6]),
  ];
  const r = buildSourceRowTokenQuadraticMean(rows, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mu', 'zeta'],
  );
});

test('quadratic-mean: sort tiebreak is source asc', () => {
  // identical QMs across sources -> tiebreak source asc
  const rows = [...mkSeries('z', [3, 4]), ...mkSeries('a', [3, 4])];
  const r = buildSourceRowTokenQuadraticMean(rows, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'z'],
  );
});

// ---------- top cap ----------

test('quadratic-mean: top cap suppresses overflow', () => {
  const rows = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
    ...mkSeries('c', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenQuadraticMean(rows, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['c', 'b'],
  );
});

// ---------- Pythagorean sandwich vs harmonic-mean ----------

test('quadratic-mean: Pythagorean sandwich HM <= GM <= AM <= QM holds across sources', () => {
  const rows = [
    ...mkSeries('a', [1, 5, 10, 50, 100]),
    ...mkSeries('b', [3, 3, 3, 3, 3]),
    ...mkSeries('c', [1, 2, 4, 8, 16, 32]),
  ];
  const qm = buildSourceRowTokenQuadraticMean(rows, { generatedAt: GEN });
  const hm = buildSourceRowTokenHarmonicMean(rows, { generatedAt: GEN });
  // index by source
  const qmBy = new Map(qm.sources.map((s) => [s.source, s]));
  const hmBy = new Map(hm.sources.map((s) => [s.source, s]));
  for (const src of ['a', 'b', 'c']) {
    const q = qmBy.get(src)!;
    const h = hmBy.get(src)!;
    assert.ok(h.harmonicMean <= h.geometricMean + 1e-9, `HM<=GM ${src}`);
    assert.ok(h.geometricMean <= h.mean + 1e-9, `GM<=AM ${src}`);
    assert.ok(q.mean <= q.quadraticMean + 1e-9, `AM<=QM ${src}`);
    // mean from QM and HM lenses must agree on same data
    assert.ok(Math.abs(q.mean - h.mean) < 1e-9, `mean agrees ${src}`);
  }
});

// ---------- determinism ----------

test('quadratic-mean: same input -> identical report', () => {
  const rows = [...mkSeries('a', [1, 2, 3, 4, 5])];
  const r1 = buildSourceRowTokenQuadraticMean(rows, { generatedAt: GEN });
  const r2 = buildSourceRowTokenQuadraticMean(rows, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});

test('quadratic-mean: row order does not affect QM (multiset invariant)', () => {
  const xs = [1, 7, 13, 25, 99];
  const r1 = buildSourceRowTokenQuadraticMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const reversed = [...xs].reverse();
  const r2 = buildSourceRowTokenQuadraticMean(mkSeries('s', reversed), {
    generatedAt: GEN,
  });
  assert.ok(
    Math.abs(r1.sources[0]!.quadraticMean - r2.sources[0]!.quadraticMean) <
      1e-12,
  );
});

// ---------- bounds ----------

test('quadratic-mean: QM lies in [mean, max] for non-negative series', () => {
  const xs = [1, 5, 10, 50, 100];
  const r = buildSourceRowTokenQuadraticMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  const mx = Math.max(...xs);
  assert.ok(s.quadraticMean >= s.mean - 1e-12);
  assert.ok(s.quadraticMean <= mx + 1e-12);
});

test('quadratic-mean: floating tokens (non-integer) handled', () => {
  const xs = [1.5, 2.5, 3.5];
  const r = buildSourceRowTokenQuadraticMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const ref = quadraticReference(xs);
  assert.ok(Math.abs(r.sources[0]!.quadraticMean - ref.quadraticMean) < 1e-12);
});
