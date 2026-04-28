import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenMidRange } from '../src/sourcerowtokenmidrange.js';
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

// Type-7 reference quantile (median only — used for cross-checks).
function median7(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const n = s.length;
  if (n === 1) return s[0]!;
  const h = (n - 1) * 0.5;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return s[lo]!;
  return s[lo]! + (h - lo) * (s[hi]! - s[lo]!);
}

// ---------- shape / option validation ----------

test('mid-range: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenMidRange([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 2);
  assert.equal(r.minMidRange, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'mid-range-desc');
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.windowStart, null);
  assert.equal(r.windowEnd, null);
  assert.equal(r.source, null);
});

test('mid-range: rejects bad minRows (< 2 or non-integer)', () => {
  assert.throws(() => buildSourceRowTokenMidRange([], { minRows: 1 }));
  assert.throws(() => buildSourceRowTokenMidRange([], { minRows: 0 }));
  assert.throws(() => buildSourceRowTokenMidRange([], { minRows: -1 }));
  assert.throws(() => buildSourceRowTokenMidRange([], { minRows: 2.5 }));
});

test('mid-range: rejects bad minMidRange', () => {
  assert.throws(() => buildSourceRowTokenMidRange([], { minMidRange: -1 }));
  assert.throws(() =>
    buildSourceRowTokenMidRange([], { minMidRange: Number.NaN }),
  );
  assert.throws(() =>
    buildSourceRowTokenMidRange([], { minMidRange: Number.POSITIVE_INFINITY }),
  );
  assert.throws(() =>
    buildSourceRowTokenMidRange([], { minMidRange: Number.NEGATIVE_INFINITY }),
  );
});

test('mid-range: rejects bad top', () => {
  assert.throws(() => buildSourceRowTokenMidRange([], { top: 0 }));
  assert.throws(() => buildSourceRowTokenMidRange([], { top: -1 }));
  assert.throws(() => buildSourceRowTokenMidRange([], { top: 1.5 }));
});

test('mid-range: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceRowTokenMidRange([], { sort: 'bogus' as never }),
  );
});

test('mid-range: rejects bad since/until ISO', () => {
  assert.throws(() => buildSourceRowTokenMidRange([], { since: 'not-a-date' }));
  assert.throws(() => buildSourceRowTokenMidRange([], { until: 'not-a-date' }));
});

// ---------- arithmetic correctness ----------

test('mid-range: simple symmetric series — MR == median == mean', () => {
  // values 1..9 (n=9): min=1, max=9 -> MR=5; median=5; gap=0
  const queue = mkSeries('s', [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const r = buildSourceRowTokenMidRange(queue, { generatedAt: GEN });
  const row = r.sources.find((s) => s.source === 's')!;
  assert.equal(row.min, 1);
  assert.equal(row.max, 9);
  assert.equal(row.midRange, 5);
  assert.equal(row.median, 5);
  assert.equal(row.range, 8);
  assert.equal(row.mrMedianGap, 0);
});

test('mid-range: asymmetric series with outlier — MR shifts towards extreme', () => {
  // 1,2,3,4,100: min=1, max=100 -> MR=50.5; median=3; gap=+47.5
  const queue = mkSeries('s', [1, 2, 3, 4, 100]);
  const r = buildSourceRowTokenMidRange(queue, { generatedAt: GEN });
  const row = r.sources.find((s) => s.source === 's')!;
  assert.equal(row.min, 1);
  assert.equal(row.max, 100);
  assert.equal(row.midRange, 50.5);
  assert.equal(row.median, 3);
  assert.equal(row.mrMedianGap, 47.5);
  assert.equal(row.range, 99);
});

test('mid-range: order-invariant (input permutation does not matter)', () => {
  const a = buildSourceRowTokenMidRange(mkSeries('s', [5, 1, 9, 3, 7]), {
    generatedAt: GEN,
  });
  const b = buildSourceRowTokenMidRange(mkSeries('s', [1, 3, 5, 7, 9]), {
    generatedAt: GEN,
  });
  const ra = a.sources[0]!;
  const rb = b.sources[0]!;
  assert.equal(ra.midRange, rb.midRange);
  assert.equal(ra.median, rb.median);
  assert.equal(ra.range, rb.range);
});

test('mid-range: identity on constant series — MR == c, range == 0, gap == 0', () => {
  const queue = mkSeries('s', [42, 42, 42, 42, 42]);
  const r = buildSourceRowTokenMidRange(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.midRange, 42);
  assert.equal(row.median, 42);
  assert.equal(row.range, 0);
  assert.equal(row.mrMedianGap, 0);
  assert.equal(row.min, 42);
  assert.equal(row.max, 42);
});

test('mid-range: all-zero series — MR == 0, range == 0, gap == 0', () => {
  const queue = mkSeries('s', [0, 0, 0, 0, 0, 0]);
  const r = buildSourceRowTokenMidRange(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.midRange, 0);
  assert.equal(row.median, 0);
  assert.equal(row.range, 0);
  assert.equal(row.mrMedianGap, 0);
});

test('mid-range: n=2 boundary — MR == median, gap == 0 by construction', () => {
  const queue = mkSeries('s', [10, 30]);
  const r = buildSourceRowTokenMidRange(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.min, 10);
  assert.equal(row.max, 30);
  assert.equal(row.midRange, 20);
  assert.equal(row.median, 20); // type-7 with n=2 at p=0.5 -> midpoint
  assert.equal(row.mrMedianGap, 0);
  assert.equal(row.range, 20);
});

test('mid-range: translation-equivariant (shift by c shifts MR by c)', () => {
  const base = [1, 2, 3, 4, 100];
  const shift = 1000;
  const a = buildSourceRowTokenMidRange(mkSeries('s', base), { generatedAt: GEN });
  const b = buildSourceRowTokenMidRange(
    mkSeries('s', base.map((v) => v + shift)),
    { generatedAt: GEN },
  );
  assert.equal(b.sources[0]!.midRange, a.sources[0]!.midRange + shift);
  assert.equal(b.sources[0]!.median, a.sources[0]!.median + shift);
  // gap is shift-invariant
  assert.equal(b.sources[0]!.mrMedianGap, a.sources[0]!.mrMedianGap);
  assert.equal(b.sources[0]!.range, a.sources[0]!.range);
});

test('mid-range: scale-equivariant (rescale by c>0 rescales MR by c)', () => {
  const base = [1, 2, 3, 4, 100];
  const k = 7;
  const a = buildSourceRowTokenMidRange(mkSeries('s', base), { generatedAt: GEN });
  const b = buildSourceRowTokenMidRange(
    mkSeries('s', base.map((v) => v * k)),
    { generatedAt: GEN },
  );
  assert.ok(Math.abs(b.sources[0]!.midRange - a.sources[0]!.midRange * k) < 1e-9);
  assert.ok(Math.abs(b.sources[0]!.median - a.sources[0]!.median * k) < 1e-9);
  assert.ok(Math.abs(b.sources[0]!.range - a.sources[0]!.range * k) < 1e-9);
  assert.ok(
    Math.abs(b.sources[0]!.mrMedianGap - a.sources[0]!.mrMedianGap * k) < 1e-9,
  );
});

test('mid-range: MR lies in [min, max] always', () => {
  const queue = mkSeries('s', [3, 7, 11, 13, 17, 23, 29, 31, 37, 41]);
  const r = buildSourceRowTokenMidRange(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(row.midRange >= row.min);
  assert.ok(row.midRange <= row.max);
});

test('mid-range: gap bounded by ±range/2', () => {
  const queue = mkSeries('s', [0, 1, 2, 3, 4, 1000000]);
  const r = buildSourceRowTokenMidRange(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.mrMedianGap) <= row.range / 2 + 1e-9);
});

test('mid-range: sample range == max - min and is non-negative', () => {
  for (const vals of [[1, 9], [5, 5], [0, 100, 50], [1, 2, 3, 4, 5]] as number[][]) {
    const r = buildSourceRowTokenMidRange(mkSeries('s', vals), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    assert.equal(row.range, row.max - row.min);
    assert.ok(row.range >= 0);
  }
});

test('mid-range: median agrees with type-7 reference', () => {
  const vals = [3, 7, 11, 13, 17, 23, 29, 31, 37, 41];
  const r = buildSourceRowTokenMidRange(mkSeries('s', vals), { generatedAt: GEN });
  assert.ok(Math.abs(r.sources[0]!.median - median7(vals)) < 1e-9);
});

// ---------- filtering: rows ----------

test('mid-range: drops invalid hour_start', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 's', 10),
    ...mkSeries('s', [1, 2, 3, 4]),
  ];
  const r = buildSourceRowTokenMidRange(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalRowsKept, 4);
});

test('mid-range: drops non-finite total_tokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 's', Number.NaN),
    ql('2026-04-27T01:00:00.000Z', 's', Number.POSITIVE_INFINITY),
    ...mkSeries('s', [1, 2, 3, 4]),
  ];
  const r = buildSourceRowTokenMidRange(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 2);
  assert.equal(r.totalRowsKept, 4);
});

test('mid-range: drops negative total_tokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 's', -1),
    ...mkSeries('s', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenMidRange(q, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.totalRowsKept, 4);
});

test('mid-range: empty/missing source -> "unknown"', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', '', 10),
    ql('2026-04-27T01:00:00.000Z', '', 30),
  ];
  const r = buildSourceRowTokenMidRange(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
  assert.equal(r.sources[0]!.midRange, 20);
});

test('mid-range: --source filter restricts to one source and counts the rest', () => {
  const q: QueueLine[] = [
    ...mkSeries('a', [1, 2, 3, 4]),
    ...mkSeries('b', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenMidRange(q, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.source, 'a');
  assert.equal(r.droppedSourceFilter, 4);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('mid-range: since/until window filters out rows outside [since, until)', () => {
  const q: QueueLine[] = [
    ql('2026-04-26T00:00:00.000Z', 's', 1),
    ql('2026-04-27T00:00:00.000Z', 's', 2),
    ql('2026-04-27T01:00:00.000Z', 's', 3),
    ql('2026-04-28T00:00:00.000Z', 's', 4),
  ];
  const r = buildSourceRowTokenMidRange(q, {
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.windowStart, '2026-04-27T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-28T00:00:00.000Z');
  assert.equal(r.totalRowsKept, 2);
  assert.equal(r.sources[0]!.midRange, 2.5); // (2+3)/2
});

// ---------- filtering: cohorts ----------

test('mid-range: drops sources below min-rows', () => {
  const q: QueueLine[] = [
    ...mkSeries('thin', [10]), // n=1, below min-rows 2
    ...mkSeries('fat', [1, 9]),
  ];
  const r = buildSourceRowTokenMidRange(q, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'fat');
});

test('mid-range: drops sources below min-mid-range', () => {
  const q: QueueLine[] = [
    ...mkSeries('small', [1, 3]), // MR=2
    ...mkSeries('big', [100, 200]), // MR=150
  ];
  const r = buildSourceRowTokenMidRange(q, {
    minMidRange: 100,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinMidRange, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

// ---------- sorting ----------

test('mid-range: default sort = mid-range-desc, source asc tiebreak', () => {
  const q: QueueLine[] = [
    ...mkSeries('a', [1, 9]), // MR=5
    ...mkSeries('b', [10, 30]), // MR=20
    ...mkSeries('c', [10, 30]), // MR=20 — same as b, lex tiebreak: b before c
  ];
  const r = buildSourceRowTokenMidRange(q, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'c', 'a'],
  );
});

test('mid-range: sort=mid-range-asc', () => {
  const q: QueueLine[] = [
    ...mkSeries('a', [10, 30]), // MR=20
    ...mkSeries('b', [1, 9]), // MR=5
  ];
  const r = buildSourceRowTokenMidRange(q, {
    sort: 'mid-range-asc',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'a'],
  );
});

test('mid-range: sort=median-desc disagrees with mid-range-desc on skewed data', () => {
  const q: QueueLine[] = [
    ...mkSeries('skewed', [1, 1, 1, 1, 1, 1000]), // MR=500.5, median=1
    ...mkSeries('flat', [50, 50, 50, 50, 50, 50]), // MR=50, median=50
  ];
  const byMr = buildSourceRowTokenMidRange(q, { generatedAt: GEN });
  const byMed = buildSourceRowTokenMidRange(q, {
    sort: 'median-desc',
    generatedAt: GEN,
  });
  assert.deepEqual(byMr.sources.map((s) => s.source), ['skewed', 'flat']);
  assert.deepEqual(byMed.sources.map((s) => s.source), ['flat', 'skewed']);
});

test('mid-range: sort=gap-desc surfaces |gap| descending', () => {
  const q: QueueLine[] = [
    ...mkSeries('symmetric', [1, 5, 9]), // gap == 0
    ...mkSeries('asymmetric', [1, 1, 1000]), // huge gap
  ];
  const r = buildSourceRowTokenMidRange(q, {
    sort: 'gap-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'asymmetric');
});

test('mid-range: sort=range-desc surfaces widest support first', () => {
  const q: QueueLine[] = [
    ...mkSeries('narrow', [10, 11, 12]), // range=2
    ...mkSeries('wide', [0, 1000]), // range=1000
  ];
  const r = buildSourceRowTokenMidRange(q, {
    sort: 'range-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'wide');
  assert.equal(r.sources[1]!.source, 'narrow');
});

test('mid-range: sort=rows surfaces busiest source first', () => {
  const q: QueueLine[] = [
    ...mkSeries('few', [1, 2]),
    ...mkSeries('many', [1, 2, 3, 4, 5, 6, 7, 8]),
  ];
  const r = buildSourceRowTokenMidRange(q, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'many');
});

test('mid-range: sort=source is alphabetic', () => {
  const q: QueueLine[] = [
    ...mkSeries('zebra', [1, 9]),
    ...mkSeries('apple', [1, 9]),
    ...mkSeries('mango', [1, 9]),
  ];
  const r = buildSourceRowTokenMidRange(q, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['apple', 'mango', 'zebra'],
  );
});

test('mid-range: --top caps results and accounts the suppressed rows', () => {
  const q: QueueLine[] = [
    ...mkSeries('a', [1, 2]),
    ...mkSeries('b', [10, 20]),
    ...mkSeries('c', [100, 200]),
    ...mkSeries('d', [1000, 2000]),
  ];
  const r = buildSourceRowTokenMidRange(q, { top: 2, generatedAt: GEN });
  assert.equal(r.top, 2);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['d', 'c'],
  );
});

// ---------- counters and report shape ----------

test('mid-range: totalSources counts all groups (even those below min-rows)', () => {
  const q: QueueLine[] = [
    ...mkSeries('thin', [10]),
    ...mkSeries('fat', [1, 9]),
  ];
  const r = buildSourceRowTokenMidRange(q, { generatedAt: GEN });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1); // 'thin' is dropped from display
});

test('mid-range: totalRowsKept counts everything that passed the queue-row filters', () => {
  const q: QueueLine[] = [
    ...mkSeries('a', [1, 2, 3]),
    ...mkSeries('b', [10, 20]),
    ql('2026-04-27T00:00:00.000Z', 'c', -5), // dropped negative
    ql('not-a-date', 'd', 99), // dropped invalid hour_start
  ];
  const r = buildSourceRowTokenMidRange(q, { generatedAt: GEN });
  assert.equal(r.totalRowsKept, 5);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('mid-range: report carries through window/source/min-mid-range/top/sort', () => {
  const q: QueueLine[] = [
    ...mkSeries('a', [1, 9]),
    ...mkSeries('b', [10, 90]),
  ];
  const r = buildSourceRowTokenMidRange(q, {
    since: '2026-04-26T00:00:00.000Z',
    until: '2026-05-01T00:00:00.000Z',
    minMidRange: 1,
    top: 5,
    sort: 'gap-desc',
    generatedAt: GEN,
  });
  assert.equal(r.windowStart, '2026-04-26T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-05-01T00:00:00.000Z');
  assert.equal(r.minMidRange, 1);
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'gap-desc');
});

test('mid-range: pure builder — no clock leakage when generatedAt provided', () => {
  const r = buildSourceRowTokenMidRange(mkSeries('s', [1, 2, 3, 4]), {
    generatedAt: GEN,
  });
  assert.equal(r.generatedAt, GEN);
});

test('mid-range: multiple sources, full readout sane', () => {
  const q: QueueLine[] = [
    ...mkSeries('codex', [1000, 2000, 3000, 10000000]), // huge tail
    ...mkSeries('hermes', [10, 20, 30, 40, 50]), // tight
    ...mkSeries('vsx', [5, 5, 5, 5]), // constant
  ];
  const r = buildSourceRowTokenMidRange(q, { generatedAt: GEN });
  const codex = r.sources.find((s) => s.source === 'codex')!;
  const hermes = r.sources.find((s) => s.source === 'hermes')!;
  const vsx = r.sources.find((s) => s.source === 'vsx')!;
  assert.equal(codex.midRange, (1000 + 10000000) / 2);
  assert.equal(hermes.midRange, (10 + 50) / 2);
  assert.equal(vsx.midRange, 5);
  assert.equal(vsx.range, 0);
  assert.equal(vsx.mrMedianGap, 0);
});

// ---------- randomized property invariant pins ----------

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('mid-range property: MR is exactly (min + max) / 2 on randomized series', () => {
  const rand = lcg(0xC0FFEE);
  for (let trial = 0; trial < 200; trial++) {
    const n = 2 + Math.floor(rand() * 50);
    const vals: number[] = [];
    for (let i = 0; i < n; i++) vals.push(Math.floor(rand() * 1_000_000));
    const r = buildSourceRowTokenMidRange(mkSeries('p', vals), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    const expectedMin = Math.min(...vals);
    const expectedMax = Math.max(...vals);
    assert.equal(row.min, expectedMin);
    assert.equal(row.max, expectedMax);
    assert.equal(row.midRange, (expectedMin + expectedMax) / 2);
    assert.equal(row.range, expectedMax - expectedMin);
  }
});

test('mid-range property: MR is permutation-invariant on randomized series', () => {
  const rand = lcg(0xBEEF42);
  for (let trial = 0; trial < 100; trial++) {
    const n = 2 + Math.floor(rand() * 30);
    const vals: number[] = [];
    for (let i = 0; i < n; i++) vals.push(Math.floor(rand() * 1_000));
    // Fisher–Yates shuffle copy
    const shuffled = vals.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    const a = buildSourceRowTokenMidRange(mkSeries('p', vals), {
      generatedAt: GEN,
    });
    const b = buildSourceRowTokenMidRange(mkSeries('p', shuffled), {
      generatedAt: GEN,
    });
    assert.equal(a.sources[0]!.midRange, b.sources[0]!.midRange);
    assert.equal(a.sources[0]!.median, b.sources[0]!.median);
    assert.equal(a.sources[0]!.range, b.sources[0]!.range);
    assert.equal(a.sources[0]!.mrMedianGap, b.sources[0]!.mrMedianGap);
  }
});

test('mid-range property: |mrMedianGap| <= range/2 on randomized series', () => {
  const rand = lcg(0xDEADBE);
  for (let trial = 0; trial < 200; trial++) {
    const n = 2 + Math.floor(rand() * 80);
    const vals: number[] = [];
    for (let i = 0; i < n; i++) vals.push(Math.floor(rand() * 10_000_000));
    const r = buildSourceRowTokenMidRange(mkSeries('p', vals), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    assert.ok(Math.abs(row.mrMedianGap) <= row.range / 2 + 1e-9);
  }
});

test('mid-range property: MR in [min, max] on randomized series', () => {
  const rand = lcg(0xABCDEF);
  for (let trial = 0; trial < 200; trial++) {
    const n = 2 + Math.floor(rand() * 40);
    const vals: number[] = [];
    for (let i = 0; i < n; i++) vals.push(Math.floor(rand() * 5_000_000));
    const r = buildSourceRowTokenMidRange(mkSeries('p', vals), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    assert.ok(row.midRange >= row.min);
    assert.ok(row.midRange <= row.max);
  }
});

test('mid-range property: translation-equivariance holds for random shifts', () => {
  const rand = lcg(0x123456);
  for (let trial = 0; trial < 100; trial++) {
    const n = 2 + Math.floor(rand() * 30);
    const vals: number[] = [];
    for (let i = 0; i < n; i++) vals.push(Math.floor(rand() * 1_000_000));
    const c = Math.floor(rand() * 1_000_000);
    const a = buildSourceRowTokenMidRange(mkSeries('p', vals), {
      generatedAt: GEN,
    });
    const b = buildSourceRowTokenMidRange(
      mkSeries('p', vals.map((v) => v + c)),
      { generatedAt: GEN },
    );
    assert.equal(b.sources[0]!.midRange, a.sources[0]!.midRange + c);
    assert.equal(b.sources[0]!.median, a.sources[0]!.median + c);
    assert.equal(b.sources[0]!.range, a.sources[0]!.range);
    assert.equal(b.sources[0]!.mrMedianGap, a.sources[0]!.mrMedianGap);
  }
});

test('mid-range property: scale-equivariance holds for random positive rescales', () => {
  const rand = lcg(0x654321);
  for (let trial = 0; trial < 100; trial++) {
    const n = 2 + Math.floor(rand() * 30);
    const vals: number[] = [];
    for (let i = 0; i < n; i++) vals.push(Math.floor(rand() * 1_000));
    const k = 1 + Math.floor(rand() * 20);
    const a = buildSourceRowTokenMidRange(mkSeries('p', vals), {
      generatedAt: GEN,
    });
    const b = buildSourceRowTokenMidRange(
      mkSeries('p', vals.map((v) => v * k)),
      { generatedAt: GEN },
    );
    assert.ok(
      Math.abs(b.sources[0]!.midRange - a.sources[0]!.midRange * k) < 1e-6,
    );
    assert.ok(Math.abs(b.sources[0]!.range - a.sources[0]!.range * k) < 1e-6);
    assert.ok(
      Math.abs(b.sources[0]!.mrMedianGap - a.sources[0]!.mrMedianGap * k) <
        1e-6,
    );
  }
});

test('mid-range property: monotone series 1..n -> MR == (n+1)/2 == median exactly', () => {
  for (const n of [2, 3, 5, 7, 10, 100, 999]) {
    const vals: number[] = [];
    for (let i = 1; i <= n; i++) vals.push(i);
    const r = buildSourceRowTokenMidRange(mkSeries('mono', vals), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    assert.equal(row.min, 1);
    assert.equal(row.max, n);
    assert.equal(row.midRange, (1 + n) / 2);
    // arithmetic-progression median == arithmetic mean == (1+n)/2
    assert.ok(Math.abs(row.median - (1 + n) / 2) < 1e-9);
    assert.ok(Math.abs(row.mrMedianGap) < 1e-9);
  }
});

test('mid-range property: range == 0 iff all rows equal', () => {
  // all-equal case
  for (const c of [0, 1, 42, 1_000_000]) {
    const r1 = buildSourceRowTokenMidRange(
      mkSeries('eq', [c, c, c, c, c]),
      { generatedAt: GEN },
    );
    assert.equal(r1.sources[0]!.range, 0);
  }
  // any-different case must have range > 0
  const r2 = buildSourceRowTokenMidRange(mkSeries('neq', [1, 2]), {
    generatedAt: GEN,
  });
  assert.ok(r2.sources[0]!.range > 0);
});

test('mid-range property: extreme outlier dominates MR (0%-breakdown)', () => {
  // Baseline: 100 rows of 1.
  const baseline: number[] = [];
  for (let i = 0; i < 100; i++) baseline.push(1);
  const r1 = buildSourceRowTokenMidRange(mkSeries('b', baseline), {
    generatedAt: GEN,
  });
  // Same series + ONE huge outlier: MR jumps to (1 + 10^9)/2.
  const withTail = baseline.concat([1_000_000_000]);
  const r2 = buildSourceRowTokenMidRange(mkSeries('b', withTail), {
    generatedAt: GEN,
  });
  assert.equal(r1.sources[0]!.midRange, 1);
  assert.equal(r2.sources[0]!.midRange, (1 + 1_000_000_000) / 2);
  // gap is enormous — confirms 0%-breakdown (single point dominates)
  assert.ok(r2.sources[0]!.mrMedianGap > 4.99e8);
});
