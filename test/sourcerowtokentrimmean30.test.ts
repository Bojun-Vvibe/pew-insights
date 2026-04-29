import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenTrimMean30 } from '../src/sourcerowtokentrimmean30.js';
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

function tm30Reference(xs: number[]): {
  mean: number;
  trimMean: number;
  k: number;
  lo: number;
  hi: number;
} {
  const s = xs.slice().sort((a, b) => a - b);
  const n = s.length;
  const k = Math.floor(0.30 * n);
  let totalSum = 0;
  for (let i = 0; i < n; i += 1) totalSum += s[i]!;
  let centralSum = 0;
  for (let i = k; i < n - k; i += 1) centralSum += s[i]!;
  return {
    mean: totalSum / n,
    trimMean: centralSum / (n - 2 * k),
    k,
    lo: s[k]!,
    hi: s[n - k - 1]!,
  };
}

// ---------- shape / option validation ----------

test('tm-30: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenTrimMean30([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 4);
  assert.equal(r.minTrimMean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'trim-mean-desc');
  assert.equal(r.generatedAt, GEN);
});

test('tm-30: minRows < 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean30([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('tm-30: minRows non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenTrimMean30([], {
        minRows: 4.5 as unknown as number,
      }),
    /minRows must be an integer >= 4/,
  );
});

test('tm-30: minTrimMean negative throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean30([], { minTrimMean: -1 }),
    /minTrimMean must be a finite, non-negative number/,
  );
});

test('tm-30: minTrimMean NaN throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean30([], { minTrimMean: Number.NaN }),
    /minTrimMean must be a finite, non-negative number/,
  );
});

test('tm-30: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean30([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('tm-30: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean30([], { top: 1.5 }),
    /top must be a positive integer/,
  );
});

test('tm-30: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenTrimMean30([], {
        sort: 'bogus' as unknown as 'trim-mean-desc',
      }),
    /sort must be one of/,
  );
});

test('tm-30: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean30([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('tm-30: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean30([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

// ---------- numeric correctness ----------

test('tm-30: hard-coded n=10 [1..10] matches reference (k=3, lo=4, hi=7, TM=5.5, gap=0)', () => {
  const series = mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = buildSourceRowTokenTrimMean30(series, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.rowsKept, 10);
  assert.equal(s.trimmedPerTail, 3);
  assert.equal(s.loBoundary, 4);
  assert.equal(s.hiBoundary, 7);
  assert.equal(s.mean, 5.5);
  assert.equal(s.trimMean, 5.5);
  assert.equal(s.tmMeanGap, 0);
});

test('tm-30: hard-coded n=5 [1..5] -> k=1, lo=2, hi=4, TM=3, mean=3, gap=0', () => {
  const series = mkSeries('a', [1, 2, 3, 4, 5]);
  const r = buildSourceRowTokenTrimMean30(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.trimmedPerTail, 1);
  assert.equal(s.loBoundary, 2);
  assert.equal(s.hiBoundary, 4);
  assert.equal(s.trimMean, 3);
  assert.equal(s.mean, 3);
  assert.equal(s.tmMeanGap, 0);
});

test('tm-30: hard-coded n=4 [1,2,3,4] -> k=1, inner two (2,3), TM=2.5, mean=2.5', () => {
  const series = mkSeries('a', [1, 2, 3, 4]);
  const r = buildSourceRowTokenTrimMean30(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.trimmedPerTail, 1);
  assert.equal(s.loBoundary, 2);
  assert.equal(s.hiBoundary, 3);
  assert.equal(s.trimMean, 2.5);
  assert.equal(s.mean, 2.5);
});

test('tm-30: identity on constant series (all rows = 7)', () => {
  const series = mkSeries('a', new Array(20).fill(7));
  const r = buildSourceRowTokenTrimMean30(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.mean, 7);
  assert.equal(s.trimMean, 7);
  assert.equal(s.tmMeanGap, 0);
  assert.equal(s.loBoundary, 7);
  assert.equal(s.hiBoundary, 7);
});

test('tm-30: identity on all-zero series', () => {
  const series = mkSeries('a', new Array(15).fill(0));
  const r = buildSourceRowTokenTrimMean30(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.mean, 0);
  assert.equal(s.trimMean, 0);
  assert.equal(s.tmMeanGap, 0);
});

test('tm-30: heavy upper tail -> tmMeanGap < 0 (raw mean pulled up)', () => {
  // 19 rows of 100, then one row of 10_000_000 -> n=20, k=6
  const vals = [...new Array(19).fill(100), 10_000_000];
  const series = mkSeries('a', vals);
  const r = buildSourceRowTokenTrimMean30(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.trimmedPerTail, 6);
  assert.equal(s.trimMean, 100); // central 8 are all 100
  assert.ok(s.mean > 100);
  assert.ok(s.tmMeanGap < 0);
});

test('tm-30: heavy lower tail -> tmMeanGap > 0 (raw mean dragged down)', () => {
  const vals = [1, ...new Array(19).fill(1000)];
  const series = mkSeries('a', vals);
  const r = buildSourceRowTokenTrimMean30(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.trimmedPerTail, 6);
  assert.equal(s.trimMean, 1000);
  assert.ok(s.mean < 1000);
  assert.ok(s.tmMeanGap > 0);
});

test('tm-30: trims more aggressively than alpha=0.20 — k differs at n=20 (6 vs 4)', () => {
  // n=20, alpha=0.30 -> k=6 (vs alpha=0.20 -> k=4). Confirm k=6.
  const series = mkSeries('a', new Array(20).fill(0).map((_, i) => i + 1));
  const r = buildSourceRowTokenTrimMean30(series, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.trimmedPerTail, 6);
  assert.equal(s.loBoundary, 7);
  assert.equal(s.hiBoundary, 14);
});

// ---------- gates ----------

test('tm-30: source with n < minRows is dropped via droppedBelowMinRows', () => {
  const series = [
    ...mkSeries('a', new Array(2).fill(100)),
    ...mkSeries('b', new Array(15).fill(200)),
  ];
  const r = buildSourceRowTokenTrimMean30(series, { generatedAt: GEN });
  assert.equal(r.totalSources, 2);
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});

test('tm-30: minTrimMean filter removes low-magnitude sources', () => {
  const series = [
    ...mkSeries('low', new Array(20).fill(5)),
    ...mkSeries('high', new Array(20).fill(5000)),
  ];
  const r = buildSourceRowTokenTrimMean30(series, {
    generatedAt: GEN,
    minTrimMean: 100,
  });
  assert.equal(r.droppedBelowMinTrimMean, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'high');
});

test('tm-30: top cap surfaces rest as droppedBelowTopCap', () => {
  const series = [
    ...mkSeries('a', new Array(10).fill(100)),
    ...mkSeries('b', new Array(10).fill(200)),
    ...mkSeries('c', new Array(10).fill(300)),
  ];
  const r = buildSourceRowTokenTrimMean30(series, {
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

test('tm-30: source filter restricts and counts dropped', () => {
  const series = [
    ...mkSeries('a', new Array(10).fill(100)),
    ...mkSeries('b', new Array(10).fill(200)),
  ];
  const r = buildSourceRowTokenTrimMean30(series, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 10);
});

test('tm-30: bad hour_start / negative / non-finite tokens are dropped', () => {
  const bad: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql('2026-04-27T00:00:00.000Z', 'a', Number.NaN),
    ql('2026-04-27T00:01:00.000Z', 'a', -5),
  ];
  const good = mkSeries('a', new Array(10).fill(100));
  const r = buildSourceRowTokenTrimMean30([...bad, ...good], {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 10);
});

test('tm-30: window since/until filter rows', () => {
  const series = mkSeries('a', new Array(10).fill(100));
  const r = buildSourceRowTokenTrimMean30(series, {
    generatedAt: GEN,
    since: '2026-04-27T00:05:00.000Z',
    until: '2026-04-27T00:08:00.000Z',
  });
  // rows 5,6,7 -> 3 rows -> below minRows=4 -> dropped
  assert.equal(r.droppedBelowMinRows, 1);
});

test('tm-30: empty/missing source maps to "unknown"', () => {
  const series = [
    ql('2026-04-27T00:00:00.000Z', '', 100),
    ql('2026-04-27T00:01:00.000Z', '', 200),
    ql('2026-04-27T00:02:00.000Z', '', 300),
    ql('2026-04-27T00:03:00.000Z', '', 400),
  ];
  const r = buildSourceRowTokenTrimMean30(series, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

// ---------- sort variants ----------

test('tm-30: sort=mean-desc orders by raw mean', () => {
  const series = [
    ...mkSeries('low', new Array(10).fill(50)),
    ...mkSeries('mid', new Array(10).fill(500)),
    ...mkSeries('high', new Array(10).fill(5000)),
  ];
  const r = buildSourceRowTokenTrimMean30(series, {
    generatedAt: GEN,
    sort: 'mean-desc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['high', 'mid', 'low'],
  );
});

test('tm-30: sort=trim-mean-asc orders ascending', () => {
  const series = [
    ...mkSeries('low', new Array(10).fill(50)),
    ...mkSeries('mid', new Array(10).fill(500)),
    ...mkSeries('high', new Array(10).fill(5000)),
  ];
  const r = buildSourceRowTokenTrimMean30(series, {
    generatedAt: GEN,
    sort: 'trim-mean-asc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['low', 'mid', 'high'],
  );
});

test('tm-30: sort=source orders alphabetically', () => {
  const series = [
    ...mkSeries('zebra', new Array(10).fill(50)),
    ...mkSeries('alpha', new Array(10).fill(500)),
    ...mkSeries('mango', new Array(10).fill(5000)),
  ];
  const r = buildSourceRowTokenTrimMean30(series, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mango', 'zebra'],
  );
});

test('tm-30: sort=rows orders by rowsKept desc', () => {
  const series = [
    ...mkSeries('a', new Array(7).fill(100)),
    ...mkSeries('b', new Array(20).fill(100)),
    ...mkSeries('c', new Array(13).fill(100)),
  ];
  const r = buildSourceRowTokenTrimMean30(series, {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'c', 'a'],
  );
});

test('tm-30: sort=gap-desc orders by |tmMeanGap| desc', () => {
  const series = [
    ...mkSeries('flat', new Array(20).fill(100)),
    ...mkSeries('outlier', [...new Array(19).fill(100), 100_000_000]),
  ];
  const r = buildSourceRowTokenTrimMean30(series, {
    generatedAt: GEN,
    sort: 'gap-desc',
  });
  assert.equal(r.sources[0]!.source, 'outlier');
  assert.equal(r.sources[1]!.source, 'flat');
});

// ---------- property tests ----------

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('tm-30 property: scale-equivariant — TM(c*x) == c*TM(x) for c=2,5,17', () => {
  const r = rng(42);
  const base = Array.from({ length: 50 }, () => Math.floor(r() * 10000));
  const baseR = buildSourceRowTokenTrimMean30(mkSeries('a', base), {
    generatedAt: GEN,
  }).sources[0]!;
  for (const c of [2, 5, 17]) {
    const scaled = base.map((v) => v * c);
    const sR = buildSourceRowTokenTrimMean30(mkSeries('a', scaled), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.ok(
      Math.abs(sR.trimMean - c * baseR.trimMean) < 1e-6,
      `c=${c}: ${sR.trimMean} vs ${c * baseR.trimMean}`,
    );
    assert.ok(Math.abs(sR.mean - c * baseR.mean) < 1e-6);
  }
});

test('tm-30 property: translation-equivariant — TM(x+c) == TM(x)+c for c=10,100,1000', () => {
  const r = rng(7);
  const base = Array.from({ length: 60 }, () => Math.floor(r() * 5000));
  const baseR = buildSourceRowTokenTrimMean30(mkSeries('a', base), {
    generatedAt: GEN,
  }).sources[0]!;
  for (const c of [10, 100, 1000]) {
    const shifted = base.map((v) => v + c);
    const sR = buildSourceRowTokenTrimMean30(mkSeries('a', shifted), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.ok(
      Math.abs(sR.trimMean - (baseR.trimMean + c)) < 1e-6,
      `c=${c}: ${sR.trimMean} vs ${baseR.trimMean + c}`,
    );
  }
});

test('tm-30 property: order-invariant — shuffled input gives same TM', () => {
  const r = rng(99);
  const base = Array.from({ length: 80 }, () => Math.floor(r() * 50000));
  const tmA = buildSourceRowTokenTrimMean30(mkSeries('a', base), {
    generatedAt: GEN,
  }).sources[0]!.trimMean;
  const shuffled = base.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const tmB = buildSourceRowTokenTrimMean30(mkSeries('a', shuffled), {
    generatedAt: GEN,
  }).sources[0]!.trimMean;
  assert.ok(Math.abs(tmA - tmB) < 1e-9);
});

test('tm-30 property: TM bounded by [loBoundary, hiBoundary]', () => {
  const r = rng(1234);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 10 + Math.floor(r() * 200);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 1_000_000));
    const out = buildSourceRowTokenTrimMean30(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    assert.ok(
      out.trimMean >= out.loBoundary - 1e-6 &&
        out.trimMean <= out.hiBoundary + 1e-6,
      `n=${n}: TM=${out.trimMean} not in [${out.loBoundary}, ${out.hiBoundary}]`,
    );
  }
});

test('tm-30 property: agrees with naive reference on 137-point pseudo-random series', () => {
  const r = rng(20260429);
  const xs = Array.from({ length: 137 }, () => Math.floor(r() * 200_000));
  const out = buildSourceRowTokenTrimMean30(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const ref = tm30Reference(xs);
  assert.ok(Math.abs(out.trimMean - ref.trimMean) < 1e-6);
  assert.ok(Math.abs(out.mean - ref.mean) < 1e-6);
  assert.equal(out.trimmedPerTail, ref.k);
  assert.equal(out.loBoundary, ref.lo);
  assert.equal(out.hiBoundary, ref.hi);
});

test('tm-30 property: TM-30 differs from raw mean on heavy-tailed pseudo-random series', () => {
  // 80 small + 20 huge. n=100, k=floor(30)=30 -> trim 30 each side -> central 40
  // sorted: 80 of 100 (positions 1..80), then 20 of 1M (positions 81..100).
  // central window is x_(31)..x_(70), all = 100. TM=100.
  const xs = [
    ...new Array(80).fill(100),
    ...new Array(20).fill(1_000_000),
  ];
  const out = buildSourceRowTokenTrimMean30(mkSeries('a', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  assert.equal(out.trimmedPerTail, 30);
  assert.equal(out.trimMean, 100);
  assert.ok(out.mean > 100_000);
  assert.ok(out.tmMeanGap < -99_000);
});

test('tm-30 property: agrees with naive reference across 20 random sizes', () => {
  const r = rng(8675309);
  for (let trial = 0; trial < 20; trial += 1) {
    const n = 4 + Math.floor(r() * 300);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 999_999));
    const out = buildSourceRowTokenTrimMean30(mkSeries('a', xs), {
      generatedAt: GEN,
    }).sources[0]!;
    const ref = tm30Reference(xs);
    assert.ok(
      Math.abs(out.trimMean - ref.trimMean) < 1e-6,
      `trial=${trial}, n=${n}: ${out.trimMean} vs ${ref.trimMean}`,
    );
    assert.equal(out.trimmedPerTail, ref.k);
  }
});
