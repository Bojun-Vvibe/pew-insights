import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenHodgesLehmann } from '../src/sourcerowtokenhodgeslehmann.js';
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

const GEN = '2026-04-29T12:00:00.000Z';

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

/** Naive O(n^2) reference Hodges-Lehmann pseudo-median. */
function hlReference(xs: number[]): {
  hl: number;
  mean: number;
  median: number;
  walshCount: number;
} {
  const n = xs.length;
  const w: number[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      w.push((xs[i]! + xs[j]!) / 2);
    }
  }
  w.sort((a, b) => a - b);
  const m = w.length;
  const hl =
    m % 2 === 1
      ? w[(m - 1) / 2]!
      : (w[m / 2 - 1]! + w[m / 2]!) / 2;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sorted = xs.slice().sort((a, b) => a - b);
  const median =
    n % 2 === 1
      ? sorted[(n - 1) / 2]!
      : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  return { hl, mean, median, walshCount: m };
}

// ---------- shape / option validation ----------

test('hl: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenHodgesLehmann([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 4);
  assert.equal(r.minHodgesLehmann, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'hl-desc');
  assert.equal(r.generatedAt, GEN);
});

test('hl: minRows < 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenHodgesLehmann([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('hl: minRows non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenHodgesLehmann([], {
        minRows: 4.5 as unknown as number,
      }),
    /minRows must be an integer >= 4/,
  );
});

test('hl: minHodgesLehmann negative throws', () => {
  assert.throws(
    () => buildSourceRowTokenHodgesLehmann([], { minHodgesLehmann: -1 }),
    /minHodgesLehmann must be a finite, non-negative number/,
  );
});

test('hl: minHodgesLehmann NaN throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenHodgesLehmann([], { minHodgesLehmann: Number.NaN }),
    /minHodgesLehmann must be a finite, non-negative number/,
  );
});

test('hl: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenHodgesLehmann([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('hl: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenHodgesLehmann([], { top: 1.5 }),
    /top must be a positive integer/,
  );
});

test('hl: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenHodgesLehmann([], {
        sort: 'bogus' as unknown as 'hl-desc',
      }),
    /sort must be one of/,
  );
});

test('hl: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenHodgesLehmann([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('hl: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenHodgesLehmann([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

// ---------- numeric correctness ----------

test('hl: hard-coded n=4 [1,2,3,4] -> walsh=10, HL=2.5', () => {
  // Walsh averages for [1,2,3,4]:
  // (1,1)=1 (1,2)=1.5 (1,3)=2 (1,4)=2.5
  // (2,2)=2 (2,3)=2.5 (2,4)=3
  // (3,3)=3 (3,4)=3.5
  // (4,4)=4
  // Sorted: 1, 1.5, 2, 2, 2.5, 2.5, 3, 3, 3.5, 4
  // m=10 even -> median = (2.5 + 2.5)/2 = 2.5
  const series = mkSeries('a', [1, 2, 3, 4]);
  const r = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.rowsKept, 4);
  assert.equal(s.walshCount, 10);
  assert.equal(s.walshMin, 1);
  assert.equal(s.walshMax, 4);
  assert.equal(s.mean, 2.5);
  assert.equal(s.median, 2.5);
  assert.equal(s.hodgesLehmann, 2.5);
  assert.equal(s.hlMeanGap, 0);
  assert.equal(s.hlMedianGap, 0);
});

test('hl: hard-coded n=5 [1..5] -> walsh=15, HL=3', () => {
  const series = mkSeries('a', [1, 2, 3, 4, 5]);
  const r = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.walshCount, 15);
  assert.equal(s.mean, 3);
  assert.equal(s.median, 3);
  assert.equal(s.hodgesLehmann, 3);
});

test('hl: hard-coded n=10 [1..10] -> HL=5.5', () => {
  const series = mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.walshCount, 55);
  assert.equal(s.mean, 5.5);
  assert.equal(s.median, 5.5);
  assert.equal(s.hodgesLehmann, 5.5);
});

test('hl: identity on constant series (all rows = 7)', () => {
  const series = mkSeries('a', new Array(20).fill(7));
  const r = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.mean, 7);
  assert.equal(s.median, 7);
  assert.equal(s.hodgesLehmann, 7);
  assert.equal(s.hlMeanGap, 0);
  assert.equal(s.hlMedianGap, 0);
  assert.equal(s.walshMin, 7);
  assert.equal(s.walshMax, 7);
});

test('hl: identity on all-zero series', () => {
  const series = mkSeries('a', new Array(15).fill(0));
  const r = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.mean, 0);
  assert.equal(s.median, 0);
  assert.equal(s.hodgesLehmann, 0);
});

test('hl: heavy upper tail -> HL between median and mean (closer to median)', () => {
  // 19 rows of 100, then one row of 10_000_000
  const vals = [...new Array(19).fill(100), 10_000_000];
  const series = mkSeries('a', vals);
  const r = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  // median = 100; mean = (19*100 + 10_000_000)/20 = 500095
  assert.equal(s.median, 100);
  assert.ok(s.mean > 500000);
  // HL is much closer to 100 than to mean
  assert.ok(s.hodgesLehmann < 1000);
  assert.ok(s.hlMeanGap < 0);
});

test('hl: heavy lower tail -> HL gap to mean is positive', () => {
  const vals = [1, ...new Array(19).fill(1000)];
  const series = mkSeries('a', vals);
  const r = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  // mean = (1 + 19*1000)/20 = 950.05; median = 1000
  assert.ok(s.mean < 1000);
  assert.equal(s.median, 1000);
  assert.ok(s.hodgesLehmann > s.mean);
  assert.ok(s.hlMeanGap > 0);
});

test('hl: symmetric series -> HL == median == mean', () => {
  // 10 values symmetric about 100: 80,85,90,95,100,100,105,110,115,120
  const vals = [80, 85, 90, 95, 100, 100, 105, 110, 115, 120];
  const series = mkSeries('a', vals);
  const r = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.mean, 100);
  assert.equal(s.median, 100);
  assert.equal(s.hodgesLehmann, 100);
});

test('hl: walshCount equals n*(n+1)/2 across sizes', () => {
  for (const n of [4, 5, 7, 10, 50, 100]) {
    const series = mkSeries('a', new Array(n).fill(0).map((_, i) => i + 1));
    const r = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN });
    assert.equal(r.sources[0]!.walshCount, (n * (n + 1)) / 2, `n=${n}`);
  }
});

test('hl: walshMin and walshMax equal min and max of x', () => {
  const series = mkSeries('a', [3, 100, 17, 999, 42, 7, 200]);
  const r = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.walshMin, 3);
  assert.equal(s.walshMax, 999);
});

// ---------- gates ----------

test('hl: source with n < minRows is dropped via droppedBelowMinRows', () => {
  const series = [
    ...mkSeries('a', new Array(2).fill(100)),
    ...mkSeries('b', new Array(15).fill(200)),
  ];
  const r = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN });
  assert.equal(r.totalSources, 2);
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});

test('hl: minHodgesLehmann filter removes low-magnitude sources', () => {
  const series = [
    ...mkSeries('low', new Array(20).fill(5)),
    ...mkSeries('high', new Array(20).fill(5000)),
  ];
  const r = buildSourceRowTokenHodgesLehmann(series, {
    generatedAt: GEN,
    minHodgesLehmann: 100,
  });
  assert.equal(r.droppedBelowMinHodgesLehmann, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'high');
});

test('hl: top cap surfaces rest as droppedBelowTopCap', () => {
  const series = [
    ...mkSeries('a', new Array(10).fill(100)),
    ...mkSeries('b', new Array(10).fill(200)),
    ...mkSeries('c', new Array(10).fill(300)),
  ];
  const r = buildSourceRowTokenHodgesLehmann(series, {
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

test('hl: source filter restricts and counts dropped', () => {
  const series = [
    ...mkSeries('a', new Array(10).fill(100)),
    ...mkSeries('b', new Array(10).fill(200)),
  ];
  const r = buildSourceRowTokenHodgesLehmann(series, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 10);
});

test('hl: bad hour_start / negative / non-finite tokens are dropped', () => {
  const bad: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql('2026-04-27T00:00:00.000Z', 'a', Number.NaN),
    ql('2026-04-27T00:01:00.000Z', 'a', -5),
  ];
  const good = mkSeries('a', new Array(10).fill(100));
  const r = buildSourceRowTokenHodgesLehmann([...bad, ...good], {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 10);
});

test('hl: window since/until filter rows', () => {
  const series = mkSeries('a', new Array(10).fill(100));
  const r = buildSourceRowTokenHodgesLehmann(series, {
    generatedAt: GEN,
    since: '2026-04-27T00:05:00.000Z',
    until: '2026-04-27T00:08:00.000Z',
  });
  // 3 rows -> below minRows=4 -> dropped
  assert.equal(r.droppedBelowMinRows, 1);
});

test('hl: empty/missing source maps to "unknown"', () => {
  const series = [
    ql('2026-04-27T00:00:00.000Z', '', 100),
    ql('2026-04-27T00:01:00.000Z', '', 200),
    ql('2026-04-27T00:02:00.000Z', '', 300),
    ql('2026-04-27T00:03:00.000Z', '', 400),
  ];
  const r = buildSourceRowTokenHodgesLehmann(series, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

// ---------- sort variants ----------

test('hl: sort=mean-desc orders by raw mean', () => {
  const series = [
    ...mkSeries('low', new Array(10).fill(50)),
    ...mkSeries('mid', new Array(10).fill(500)),
    ...mkSeries('high', new Array(10).fill(5000)),
  ];
  const r = buildSourceRowTokenHodgesLehmann(series, {
    generatedAt: GEN,
    sort: 'mean-desc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['high', 'mid', 'low'],
  );
});

test('hl: sort=median-desc orders by median', () => {
  const series = [
    ...mkSeries('low', new Array(10).fill(50)),
    ...mkSeries('mid', new Array(10).fill(500)),
    ...mkSeries('high', new Array(10).fill(5000)),
  ];
  const r = buildSourceRowTokenHodgesLehmann(series, {
    generatedAt: GEN,
    sort: 'median-desc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['high', 'mid', 'low'],
  );
});

test('hl: sort=hl-asc orders ascending', () => {
  const series = [
    ...mkSeries('low', new Array(10).fill(50)),
    ...mkSeries('mid', new Array(10).fill(500)),
    ...mkSeries('high', new Array(10).fill(5000)),
  ];
  const r = buildSourceRowTokenHodgesLehmann(series, {
    generatedAt: GEN,
    sort: 'hl-asc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['low', 'mid', 'high'],
  );
});

test('hl: sort=source orders alphabetically', () => {
  const series = [
    ...mkSeries('zebra', new Array(10).fill(50)),
    ...mkSeries('alpha', new Array(10).fill(500)),
    ...mkSeries('mango', new Array(10).fill(5000)),
  ];
  const r = buildSourceRowTokenHodgesLehmann(series, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mango', 'zebra'],
  );
});

test('hl: sort=rows orders by rowsKept desc', () => {
  const series = [
    ...mkSeries('a', new Array(7).fill(100)),
    ...mkSeries('b', new Array(20).fill(100)),
    ...mkSeries('c', new Array(13).fill(100)),
  ];
  const r = buildSourceRowTokenHodgesLehmann(series, {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'c', 'a'],
  );
});

test('hl: sort=mean-gap-desc orders by |hlMeanGap| desc', () => {
  const series = [
    ...mkSeries('flat', new Array(20).fill(100)),
    ...mkSeries('outlier', [...new Array(19).fill(100), 100_000_000]),
  ];
  const r = buildSourceRowTokenHodgesLehmann(series, {
    generatedAt: GEN,
    sort: 'mean-gap-desc',
  });
  assert.equal(r.sources[0]!.source, 'outlier');
  assert.equal(r.sources[1]!.source, 'flat');
});

test('hl: sort=median-gap-desc orders by |hlMedianGap| desc', () => {
  const series = [
    ...mkSeries('flat', new Array(20).fill(100)),
    ...mkSeries('asym', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100, 200, 300, 400, 500]),
  ];
  const r = buildSourceRowTokenHodgesLehmann(series, {
    generatedAt: GEN,
    sort: 'median-gap-desc',
  });
  assert.equal(r.sources[0]!.source, 'asym');
});

// ---------- property tests ----------

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('hl property: scale-equivariant — HL(c*x) == c*HL(x) for c=2,5,17', () => {
  const r = rng(42);
  const base = Array.from({ length: 50 }, () => Math.floor(r() * 10000));
  const baseR = buildSourceRowTokenHodgesLehmann(mkSeries('a', base), {
    generatedAt: GEN,
  }).sources[0]!;
  for (const c of [2, 5, 17]) {
    const scaled = base.map((v) => v * c);
    const sR = buildSourceRowTokenHodgesLehmann(mkSeries('a', scaled), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.ok(
      Math.abs(sR.hodgesLehmann - c * baseR.hodgesLehmann) < 1e-6,
      `c=${c}: ${sR.hodgesLehmann} vs ${c * baseR.hodgesLehmann}`,
    );
    assert.ok(Math.abs(sR.mean - c * baseR.mean) < 1e-6);
  }
});

test('hl property: translation-equivariant — HL(x+c) == HL(x)+c for c=10,100,1000', () => {
  const r = rng(7);
  const base = Array.from({ length: 60 }, () => Math.floor(r() * 5000));
  const baseR = buildSourceRowTokenHodgesLehmann(mkSeries('a', base), {
    generatedAt: GEN,
  }).sources[0]!;
  for (const c of [10, 100, 1000]) {
    const shifted = base.map((v) => v + c);
    const sR = buildSourceRowTokenHodgesLehmann(mkSeries('a', shifted), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.ok(
      Math.abs(sR.hodgesLehmann - (baseR.hodgesLehmann + c)) < 1e-6,
      `c=${c}: ${sR.hodgesLehmann} vs ${baseR.hodgesLehmann + c}`,
    );
  }
});

test('hl property: order-invariant — shuffled input gives same HL', () => {
  const r = rng(99);
  const base = Array.from({ length: 80 }, () => Math.floor(r() * 50000));
  const hlA = buildSourceRowTokenHodgesLehmann(mkSeries('a', base), {
    generatedAt: GEN,
  }).sources[0]!.hodgesLehmann;
  const shuffled = base.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const hlB = buildSourceRowTokenHodgesLehmann(mkSeries('a', shuffled), {
    generatedAt: GEN,
  }).sources[0]!.hodgesLehmann;
  assert.ok(Math.abs(hlA - hlB) < 1e-9);
});

test('hl property: HL bounded by [min, max] of x', () => {
  const r = rng(1234);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 10 + Math.floor(r() * 200);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 1_000_000));
    const out = buildSourceRowTokenHodgesLehmann(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.ok(
      out.hodgesLehmann >= out.walshMin - 1e-6 &&
        out.hodgesLehmann <= out.walshMax + 1e-6,
      `n=${n}: HL=${out.hodgesLehmann} not in [${out.walshMin}, ${out.walshMax}]`,
    );
  }
});

test('hl property: agrees with naive reference on 137-point pseudo-random series', () => {
  const r = rng(20260429);
  const xs = Array.from({ length: 137 }, () => Math.floor(r() * 200_000));
  const out = buildSourceRowTokenHodgesLehmann(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const ref = hlReference(xs);
  assert.ok(Math.abs(out.hodgesLehmann - ref.hl) < 1e-6);
  assert.ok(Math.abs(out.mean - ref.mean) < 1e-6);
  assert.ok(Math.abs(out.median - ref.median) < 1e-6);
  assert.equal(out.walshCount, ref.walshCount);
});

test('hl property: agrees with naive reference across 20 random sizes', () => {
  const r = rng(8675309);
  for (let trial = 0; trial < 20; trial += 1) {
    const n = 4 + Math.floor(r() * 100);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 999_999));
    const out = buildSourceRowTokenHodgesLehmann(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const ref = hlReference(xs);
    assert.ok(
      Math.abs(out.hodgesLehmann - ref.hl) < 1e-6,
      `trial=${trial}, n=${n}: ${out.hodgesLehmann} vs ${ref.hl}`,
    );
    assert.equal(out.walshCount, (n * (n + 1)) / 2);
  }
});

test('hl property: HL of symmetric distribution equals center of symmetry', () => {
  const r = rng(31415);
  for (let trial = 0; trial < 10; trial += 1) {
    const center = 1000 + Math.floor(r() * 10000);
    // Build symmetric set around `center`
    const half = Array.from({ length: 25 }, () => Math.floor(r() * 500));
    const xs = [...half.map((d) => center - d), ...half.map((d) => center + d)];
    const out = buildSourceRowTokenHodgesLehmann(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.ok(
      Math.abs(out.hodgesLehmann - center) < 1e-6,
      `center=${center}, HL=${out.hodgesLehmann}`,
    );
    assert.ok(Math.abs(out.mean - center) < 1e-6);
  }
});

test('hl property: HL is NOT the same as median on heavy-tailed asymmetric data', () => {
  // mostly small values with a few moderate outliers — HL should
  // lift above the median (it is not pinned to the central order
  // statistic; it sees pairwise sums).
  const xs = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    1000, 2000, 3000,
  ];
  const out = buildSourceRowTokenHodgesLehmann(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  // median of 23 sorted values is the 12th = 12
  assert.equal(out.median, 12);
  // HL should differ from median (Walsh averages include cross-pairs
  // with the large values).
  assert.notEqual(out.hodgesLehmann, out.median);
  assert.ok(out.hodgesLehmann > out.median);
  assert.ok(out.hlMedianGap > 0);
});

test('hl property: HL equals (walshMin+walshMax)/2 = mean only for arithmetic progressions of certain sizes — generic check that HL <= mean OR HL >= mean is well-defined', () => {
  // Sanity check that HL is always finite and reproducible.
  const r = rng(54321);
  for (let trial = 0; trial < 15; trial += 1) {
    const n = 4 + Math.floor(r() * 60);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 100_000));
    const a = buildSourceRowTokenHodgesLehmann(mkSeries('s', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const b = buildSourceRowTokenHodgesLehmann(mkSeries('s', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.equal(a.hodgesLehmann, b.hodgesLehmann);
    assert.ok(Number.isFinite(a.hodgesLehmann));
  }
});

test('hl property: hlMeanGap = HL - mean and hlMedianGap = HL - median exactly', () => {
  const r = rng(111213);
  for (let trial = 0; trial < 10; trial += 1) {
    const n = 4 + Math.floor(r() * 50);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 50_000));
    const out = buildSourceRowTokenHodgesLehmann(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.ok(Math.abs(out.hlMeanGap - (out.hodgesLehmann - out.mean)) < 1e-9);
    assert.ok(
      Math.abs(out.hlMedianGap - (out.hodgesLehmann - out.median)) < 1e-9,
    );
  }
});
