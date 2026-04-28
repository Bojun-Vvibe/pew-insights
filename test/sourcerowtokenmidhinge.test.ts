import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenMidhinge } from '../src/sourcerowtokenmidhinge.js';
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
    ql(`2026-04-27T${String(i % 24).padStart(2, '0')}:00:00.000Z`, source, v),
  );
}

// Type-7 reference quantile
function q7(xs: number[], p: number): number {
  const s = xs.slice().sort((a, b) => a - b);
  const n = s.length;
  if (n === 1) return s[0]!;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return s[lo]!;
  return s[lo]! + (h - lo) * (s[hi]! - s[lo]!);
}

// ---------- shape / option validation ----------

test('midhinge: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenMidhinge([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 4);
  assert.equal(r.minMidhinge, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'midhinge-desc');
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.windowStart, null);
  assert.equal(r.windowEnd, null);
  assert.equal(r.source, null);
});

test('midhinge: rejects bad minRows (< 4 or non-integer)', () => {
  assert.throws(() => buildSourceRowTokenMidhinge([], { minRows: 3 }));
  assert.throws(() => buildSourceRowTokenMidhinge([], { minRows: 4.5 }));
  assert.throws(() => buildSourceRowTokenMidhinge([], { minRows: -1 }));
  assert.throws(() => buildSourceRowTokenMidhinge([], { minRows: 0 }));
});

test('midhinge: rejects bad minMidhinge', () => {
  assert.throws(() => buildSourceRowTokenMidhinge([], { minMidhinge: -1 }));
  assert.throws(() =>
    buildSourceRowTokenMidhinge([], { minMidhinge: Number.NaN }),
  );
  assert.throws(() =>
    buildSourceRowTokenMidhinge([], { minMidhinge: Number.POSITIVE_INFINITY }),
  );
  assert.throws(() =>
    buildSourceRowTokenMidhinge([], { minMidhinge: Number.NEGATIVE_INFINITY }),
  );
});

test('midhinge: rejects bad top', () => {
  assert.throws(() => buildSourceRowTokenMidhinge([], { top: 0 }));
  assert.throws(() => buildSourceRowTokenMidhinge([], { top: -3 }));
  assert.throws(() => buildSourceRowTokenMidhinge([], { top: 1.5 }));
});

test('midhinge: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceRowTokenMidhinge([], { sort: 'nope' as never }),
  );
  assert.throws(() =>
    buildSourceRowTokenMidhinge([], { sort: 'trimean-desc' as never }),
  );
});

test('midhinge: rejects invalid since/until', () => {
  assert.throws(() => buildSourceRowTokenMidhinge([], { since: 'not-a-date' }));
  assert.throws(() => buildSourceRowTokenMidhinge([], { until: 'not-a-date' }));
});

test('midhinge: accepts all valid sorts', () => {
  for (const s of [
    'midhinge-desc',
    'midhinge-asc',
    'median-desc',
    'gap-desc',
    'rows',
    'source',
  ] as const) {
    const r = buildSourceRowTokenMidhinge([], { sort: s, generatedAt: GEN });
    assert.equal(r.sort, s);
  }
});

test('midhinge: generatedAt defaults to wall clock when omitted', () => {
  const r = buildSourceRowTokenMidhinge([]);
  assert.ok(r.generatedAt);
  assert.ok(!Number.isNaN(Date.parse(r.generatedAt)));
});

// ---------- arithmetic correctness ----------

test('midhinge: constant series -> midhinge == c, gap == 0', () => {
  const q = mkSeries('s1', [7, 7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 's1');
  assert.equal(s.q1, 7);
  assert.equal(s.median, 7);
  assert.equal(s.q3, 7);
  assert.equal(s.midhinge, 7);
  assert.equal(s.mhMedianGap, 0);
  assert.equal(s.rowsKept, 6);
});

test('midhinge: all-zero series -> midhinge 0, gap 0 (no degeneracy)', () => {
  const q = mkSeries('z', [0, 0, 0, 0, 0]);
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.midhinge, 0);
  assert.equal(s.mhMedianGap, 0);
  assert.equal(s.q1, 0);
  assert.equal(s.q3, 0);
});

test('midhinge: known small series matches type-7 formula', () => {
  // [1, 2, 3, 4, 5, 6, 7, 8] -> q1 = 2.75, median = 4.5, q3 = 6.25
  // midhinge = (2.75 + 6.25) / 2 = 4.5; gap = 0 (symmetric)
  const vals = [1, 2, 3, 4, 5, 6, 7, 8];
  const q = mkSeries('a', vals);
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.q1, q7(vals, 0.25));
  assert.equal(s.median, q7(vals, 0.5));
  assert.equal(s.q3, q7(vals, 0.75));
  assert.equal(s.midhinge, (q7(vals, 0.25) + q7(vals, 0.75)) / 2);
  // Symmetric arithmetic series -> gap == 0
  assert.ok(Math.abs(s.mhMedianGap) < 1e-12);
});

test('midhinge: asymmetric (right-skewed) -> midhinge > median, gap > 0', () => {
  // Many small low-tail values, fat upper tail -> q3 in upper tail, median small
  const vals = [1, 1, 1, 1, 1, 1, 1, 1, 50, 60, 70, 80, 90, 100];
  const q = mkSeries('skew', vals);
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.ok(s.midhinge > s.median, `MH ${s.midhinge} > median ${s.median}`);
  assert.ok(s.mhMedianGap > 0);
  assert.ok(Math.abs(s.mhMedianGap - (s.midhinge - s.median)) < 1e-12);
});

test('midhinge: left-skewed -> midhinge < median, gap < 0', () => {
  const vals = [-100, -100, 50, 60, 65, 68, 70, 72, 74, 75].map((v) =>
    Math.max(0, v),
  );
  // Convert to a left-skewed shape on non-negative data:
  // Use a long lower-half: many small values, fat upper cluster.
  const left = [0, 0, 0, 0, 0, 80, 82, 85, 87, 88, 90];
  const q = mkSeries('left', left);
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  // median ~ 80, q1 ~ 0, q3 ~ 87 -> midhinge ~ 43.5 < median
  assert.ok(s.midhinge < s.median);
  assert.ok(s.mhMedianGap < 0);
  // dummy use to silence unused-var linters for `vals`
  assert.ok(vals.length > 0);
});

test('midhinge: lies in [q1, q3]', () => {
  const cases: number[][] = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [0, 0, 0, 1, 100, 100],
    [10, 10, 10, 10],
    [1, 5, 100, 1000, 5000],
  ];
  for (const vals of cases) {
    const q = mkSeries('s', vals);
    const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
    const s = r.sources[0]!;
    assert.ok(s.midhinge >= s.q1, `MH ${s.midhinge} >= q1 ${s.q1}`);
    assert.ok(s.midhinge <= s.q3, `MH ${s.midhinge} <= q3 ${s.q3}`);
  }
});

test('midhinge: midhinge always equals (q1 + q3) / 2 exactly', () => {
  const vals = [3, 7, 19, 23, 41, 53, 67, 89];
  const q = mkSeries('exact', vals);
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.midhinge, (s.q1 + s.q3) / 2);
});

test('midhinge: gap is bounded by +/- (q3 - q1) / 2', () => {
  const cases: number[][] = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [0, 0, 0, 1, 100, 100, 100, 100],
    [1, 1, 1, 1, 1000, 1000, 1000, 1000],
    [10, 20, 30, 40, 50, 60],
  ];
  for (const vals of cases) {
    const q = mkSeries('s', vals);
    const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
    const s = r.sources[0]!;
    const halfIqr = (s.q3 - s.q1) / 2;
    assert.ok(
      Math.abs(s.mhMedianGap) <= halfIqr + 1e-12,
      `|gap|=${Math.abs(s.mhMedianGap)} <= halfIQR=${halfIqr}`,
    );
  }
});

// ---------- minRows gate ----------

test('midhinge: source with n < minRows is dropped', () => {
  const q = [...mkSeries('small', [1, 2, 3]), ...mkSeries('big', [1, 2, 3, 4, 5])];
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN, minRows: 4 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.totalSources, 2);
  assert.equal(r.totalRowsKept, 8);
});

test('midhinge: minRows = 4 keeps a source with exactly 4 rows', () => {
  const q = mkSeries('s', [1, 2, 3, 4]);
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN, minRows: 4 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowMinRows, 0);
});

test('midhinge: minRows = 10 keeps only sources with >= 10 rows', () => {
  const q = [
    ...mkSeries('a', Array.from({ length: 10 }, (_, i) => i + 1)),
    ...mkSeries('b', Array.from({ length: 9 }, (_, i) => i + 1)),
  ];
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN, minRows: 10 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

// ---------- minMidhinge gate ----------

test('midhinge: minMidhinge filters out below-threshold sources', () => {
  const q = [
    ...mkSeries('lo', [1, 2, 3, 4]),
    ...mkSeries('hi', [100, 200, 300, 400]),
  ];
  const r = buildSourceRowTokenMidhinge(q, {
    generatedAt: GEN,
    minMidhinge: 50,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'hi');
  assert.equal(r.droppedBelowMinMidhinge, 1);
});

test('midhinge: minMidhinge = 0 keeps everything (default)', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4]),
    ...mkSeries('b', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowMinMidhinge, 0);
});

// ---------- top cap ----------

test('midhinge: --top caps results and counts dropped', () => {
  const q = [
    ...mkSeries('a', [100, 100, 100, 100]),
    ...mkSeries('b', [50, 50, 50, 50]),
    ...mkSeries('c', [10, 10, 10, 10]),
  ];
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('midhinge: --top larger than population is a no-op', () => {
  const q = mkSeries('a', [1, 2, 3, 4]);
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN, top: 100 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowTopCap, 0);
});

// ---------- input filtering ----------

test('midhinge: bad hour_start dropped and counted', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 's', 5),
    ...mkSeries('s', [1, 2, 3, 4]),
  ];
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('midhinge: non-finite total_tokens dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 's', Number.NaN),
    ql('2026-04-27T01:00:00.000Z', 's', Number.POSITIVE_INFINITY),
    ...mkSeries('s', [1, 2, 3, 4]),
  ];
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 2);
});

test('midhinge: negative total_tokens dropped and counted', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 's', -10),
    ...mkSeries('s', [1, 2, 3, 4]),
  ];
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('midhinge: missing/empty source -> "unknown"', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', '', 1),
    ql('2026-04-27T01:00:00.000Z', '', 2),
    ql('2026-04-27T02:00:00.000Z', '', 3),
    ql('2026-04-27T03:00:00.000Z', '', 4),
  ];
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('midhinge: --source filter drops non-matching rows', () => {
  const q = [
    ...mkSeries('keep', [1, 2, 3, 4]),
    ...mkSeries('drop', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenMidhinge(q, {
    generatedAt: GEN,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 4);
  assert.equal(r.source, 'keep');
});

test('midhinge: window since/until is half-open [since, until)', () => {
  const q: QueueLine[] = [
    ql('2026-04-26T23:59:59.999Z', 's', 1), // before since
    ql('2026-04-27T00:00:00.000Z', 's', 2), // == since
    ql('2026-04-27T06:00:00.000Z', 's', 3),
    ql('2026-04-27T12:00:00.000Z', 's', 4),
    ql('2026-04-27T18:00:00.000Z', 's', 5),
    ql('2026-04-27T23:59:59.999Z', 's', 6),
    ql('2026-04-28T00:00:00.000Z', 's', 7), // == until -> excluded
  ];
  const r = buildSourceRowTokenMidhinge(q, {
    generatedAt: GEN,
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.rowsKept, 5);
  assert.equal(r.windowStart, '2026-04-27T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-28T00:00:00.000Z');
});

// ---------- sort orders ----------

test('midhinge: sort midhinge-desc orders by midhinge desc, ties by source asc', () => {
  const q = [
    ...mkSeries('alpha', [50, 50, 50, 50]),
    ...mkSeries('beta', [50, 50, 50, 50]),
    ...mkSeries('big', [100, 100, 100, 100]),
  ];
  const r = buildSourceRowTokenMidhinge(q, {
    generatedAt: GEN,
    sort: 'midhinge-desc',
  });
  assert.equal(r.sources[0]!.source, 'big');
  // alpha and beta tied at 50; alpha < beta lex
  assert.equal(r.sources[1]!.source, 'alpha');
  assert.equal(r.sources[2]!.source, 'beta');
});

test('midhinge: sort midhinge-asc orders ascending', () => {
  const q = [
    ...mkSeries('hi', [100, 100, 100, 100]),
    ...mkSeries('lo', [10, 10, 10, 10]),
  ];
  const r = buildSourceRowTokenMidhinge(q, {
    generatedAt: GEN,
    sort: 'midhinge-asc',
  });
  assert.equal(r.sources[0]!.source, 'lo');
  assert.equal(r.sources[1]!.source, 'hi');
});

test('midhinge: sort median-desc', () => {
  // Construct two sources with different medians but constructed so
  // the median ranking differs from midhinge ranking.
  const a = mkSeries('a', [1, 1, 1, 100, 100, 100]);
  // a: q1=1, median=50.5, q3=100 -> mh=50.5
  const b = mkSeries('b', [40, 40, 60, 60, 60, 60]);
  // b: q1=40, median=60, q3=60 -> mh=50
  const r = buildSourceRowTokenMidhinge([...a, ...b], {
    generatedAt: GEN,
    sort: 'median-desc',
  });
  assert.equal(r.sources[0]!.source, 'b'); // higher median
});

test('midhinge: sort gap-desc orders by |gap| desc', () => {
  const sym = mkSeries('sym', [1, 2, 3, 4, 5, 6, 7, 8]); // gap ~ 0
  const skew = mkSeries('skew', [1, 1, 1, 1, 1, 100, 100, 100]); // big gap
  const r = buildSourceRowTokenMidhinge([...sym, ...skew], {
    generatedAt: GEN,
    sort: 'gap-desc',
  });
  assert.equal(r.sources[0]!.source, 'skew');
  assert.equal(r.sources[1]!.source, 'sym');
});

test('midhinge: sort rows orders by rowsKept desc', () => {
  const q = [
    ...mkSeries('few', [1, 2, 3, 4]),
    ...mkSeries('many', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  ];
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN, sort: 'rows' });
  assert.equal(r.sources[0]!.source, 'many');
  assert.equal(r.sources[1]!.source, 'few');
});

test('midhinge: sort source orders alphabetically', () => {
  const q = [
    ...mkSeries('charlie', [1, 2, 3, 4]),
    ...mkSeries('alpha', [10, 20, 30, 40]),
    ...mkSeries('bravo', [5, 5, 5, 5]),
  ];
  const r = buildSourceRowTokenMidhinge(q, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'bravo', 'charlie'],
  );
});

// ---------- equivariance / invariance ----------

test('midhinge: translation-equivariance (shift by c shifts midhinge by c)', () => {
  const base = [10, 20, 30, 40, 50, 60, 70, 80];
  const shift = 1234;
  const r1 = buildSourceRowTokenMidhinge(mkSeries('a', base), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenMidhinge(
    mkSeries(
      'a',
      base.map((v) => v + shift),
    ),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r1.sources[0]!.midhinge + shift - r2.sources[0]!.midhinge) < 1e-9,
  );
  // gap is invariant under translation
  assert.ok(
    Math.abs(r1.sources[0]!.mhMedianGap - r2.sources[0]!.mhMedianGap) < 1e-9,
  );
});

test('midhinge: scale-equivariance (scale by c rescales midhinge by c)', () => {
  const base = [10, 20, 30, 40, 50, 60, 70, 80];
  const scale = 7.5;
  const r1 = buildSourceRowTokenMidhinge(mkSeries('a', base), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenMidhinge(
    mkSeries(
      'a',
      base.map((v) => v * scale),
    ),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r1.sources[0]!.midhinge * scale - r2.sources[0]!.midhinge) < 1e-9,
  );
  assert.ok(
    Math.abs(r1.sources[0]!.mhMedianGap * scale - r2.sources[0]!.mhMedianGap) <
      1e-9,
  );
});

test('midhinge: order-invariance (shuffled input -> identical output)', () => {
  const base = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const reversed = base.slice().reverse();
  const r1 = buildSourceRowTokenMidhinge(mkSeries('a', base), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenMidhinge(mkSeries('a', reversed), {
    generatedAt: GEN,
  });
  assert.equal(r1.sources[0]!.midhinge, r2.sources[0]!.midhinge);
  assert.equal(r1.sources[0]!.median, r2.sources[0]!.median);
  assert.equal(r1.sources[0]!.q1, r2.sources[0]!.q1);
  assert.equal(r1.sources[0]!.q3, r2.sources[0]!.q3);
  assert.equal(r1.sources[0]!.mhMedianGap, r2.sources[0]!.mhMedianGap);
});

test('midhinge: outlier robustness (single huge row does not move MH past q3)', () => {
  // 8 small rows + 1 huge row: q3 still inside the small cluster
  const small = [1, 2, 3, 4, 5, 6, 7, 8];
  const r1 = buildSourceRowTokenMidhinge(mkSeries('a', small), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenMidhinge(
    mkSeries('a', [...small, 1_000_000]),
    {
      generatedAt: GEN,
    },
  );
  // MH must not become absurdly large; and stays inside [q1, q3] of new dist
  assert.ok(r2.sources[0]!.midhinge < 100, 'MH not dragged by outlier');
  assert.ok(r2.sources[0]!.midhinge >= r2.sources[0]!.q1);
  assert.ok(r2.sources[0]!.midhinge <= r2.sources[0]!.q3);
  // sanity: the original symmetric series gap == 0
  assert.ok(Math.abs(r1.sources[0]!.mhMedianGap) < 1e-12);
});

// ---------- multi-source totals ----------

test('midhinge: totalSources / totalRowsKept counts include filtered sources', () => {
  const q = [
    ...mkSeries('keep', [1, 2, 3, 4, 5]),
    ...mkSeries('small', [1, 2]),
  ];
  const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
  assert.equal(r.totalSources, 2);
  assert.equal(r.totalRowsKept, 7);
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('midhinge: report echoes opts (minRows, minMidhinge, top, sort)', () => {
  const r = buildSourceRowTokenMidhinge([], {
    generatedAt: GEN,
    minRows: 7,
    minMidhinge: 12.5,
    top: 3,
    sort: 'gap-desc',
  });
  assert.equal(r.minRows, 7);
  assert.equal(r.minMidhinge, 12.5);
  assert.equal(r.top, 3);
  assert.equal(r.sort, 'gap-desc');
});

test('midhinge: large symmetric integer series gap == 0 within fp tolerance', () => {
  const vals: number[] = [];
  for (let i = 1; i <= 1000; i++) vals.push(i);
  const r = buildSourceRowTokenMidhinge(mkSeries('big', vals), {
    generatedAt: GEN,
  });
  assert.ok(Math.abs(r.sources[0]!.mhMedianGap) < 1e-9);
});

test('midhinge: high-zero distribution -> q1 = 0, MH = q3/2 exactly', () => {
  // Half zeros, half 100s -> q1 = 0, q3 = 100, MH = 50.
  const vals = [0, 0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 100, 100, 100];
  const r = buildSourceRowTokenMidhinge(mkSeries('q', vals), {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.q1, 0);
  assert.equal(s.q3, 100);
  assert.equal(s.midhinge, 50);
  assert.ok(Math.abs(s.midhinge - (s.q1 + s.q3) / 2) < 1e-12);
});
