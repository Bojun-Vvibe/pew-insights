import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenTrimMean25 } from '../src/sourcerowtokentrimmean25.js';
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

function trimMean25Reference(xs: number[]): {
  mean: number;
  trimMean: number;
  k: number;
} {
  const s = xs.slice().sort((a, b) => a - b);
  const n = s.length;
  const k = Math.floor(0.25 * n);
  let totalSum = 0;
  for (let i = 0; i < n; i += 1) totalSum += s[i]!;
  let centralSum = 0;
  for (let i = k; i < n - k; i += 1) centralSum += s[i]!;
  return {
    mean: totalSum / n,
    trimMean: centralSum / (n - 2 * k),
    k,
  };
}

// ---------- shape / option validation ----------

test('trim-mean-25: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenTrimMean25([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 4);
  assert.equal(r.minTrimMean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'trim-mean-desc');
  assert.equal(r.generatedAt, GEN);
});

test('trim-mean-25: minRows < 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean25([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('trim-mean-25: minRows non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean25([], { minRows: 4.5 as unknown as number }),
    /minRows must be an integer >= 4/,
  );
});

test('trim-mean-25: minTrimMean negative throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean25([], { minTrimMean: -1 }),
    /minTrimMean must be a finite, non-negative number/,
  );
});

test('trim-mean-25: minTrimMean NaN throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean25([], { minTrimMean: Number.NaN }),
    /minTrimMean must be a finite, non-negative number/,
  );
});

test('trim-mean-25: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean25([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('trim-mean-25: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean25([], { top: 2.5 }),
    /top must be a positive integer/,
  );
});

test('trim-mean-25: bad sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenTrimMean25([], { sort: 'bogus' as unknown as never }),
    /sort must be one of/,
  );
});

test('trim-mean-25: bad since throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean25([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('trim-mean-25: bad until throws', () => {
  assert.throws(
    () => buildSourceRowTokenTrimMean25([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

// ---------- arithmetic correctness ----------

test('trim-mean-25: n=4 drops one each side, averages inner two', () => {
  const q = mkSeries('s', [1, 2, 3, 100]);
  const r = buildSourceRowTokenTrimMean25(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.rowsKept, 4);
  assert.equal(row.trimmedPerTail, 1);
  // central two are 2 and 3
  assert.equal(row.trimMean, 2.5);
  // mean of all four
  assert.equal(row.mean, (1 + 2 + 3 + 100) / 4);
  assert.equal(row.tmMeanGap, row.trimMean - row.mean);
});

test('trim-mean-25: n=8 drops two each side, averages central four', () => {
  const q = mkSeries('s', [1, 2, 3, 4, 5, 6, 7, 1000]);
  const r = buildSourceRowTokenTrimMean25(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.trimmedPerTail, 2);
  // central four: 3,4,5,6
  assert.equal(row.trimMean, (3 + 4 + 5 + 6) / 4);
  assert.equal(row.mean, (1 + 2 + 3 + 4 + 5 + 6 + 7 + 1000) / 8);
});

test('trim-mean-25: all-equal series -> trim_mean == mean == c, gap == 0', () => {
  const q = mkSeries('s', [42, 42, 42, 42, 42, 42]);
  const r = buildSourceRowTokenTrimMean25(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.trimMean, 42);
  assert.equal(row.mean, 42);
  assert.equal(row.tmMeanGap, 0);
});

test('trim-mean-25: all-zero series -> trim_mean == 0, mean == 0, gap == 0', () => {
  const q = mkSeries('s', [0, 0, 0, 0, 0]);
  const r = buildSourceRowTokenTrimMean25(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.trimMean, 0);
  assert.equal(row.mean, 0);
  assert.equal(row.tmMeanGap, 0);
});

test('trim-mean-25: order-invariant on arbitrary permutation', () => {
  const base = [5, 12, 3, 8, 19, 1, 7, 22, 4, 11];
  const sorted = base.slice().sort((a, b) => a - b);
  const r1 = buildSourceRowTokenTrimMean25(mkSeries('s', base), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenTrimMean25(mkSeries('s', sorted), {
    generatedAt: GEN,
  });
  assert.equal(r1.sources[0]!.trimMean, r2.sources[0]!.trimMean);
  assert.equal(r1.sources[0]!.mean, r2.sources[0]!.mean);
});

test('trim-mean-25: matches reference implementation on n=10 random data', () => {
  const xs = [9, 4, 11, 27, 3, 18, 7, 1, 14, 6];
  const q = mkSeries('s', xs);
  const r = buildSourceRowTokenTrimMean25(q, { generatedAt: GEN });
  const ref = trimMean25Reference(xs);
  assert.equal(r.sources[0]!.trimMean, ref.trimMean);
  assert.equal(r.sources[0]!.mean, ref.mean);
  assert.equal(r.sources[0]!.trimmedPerTail, ref.k);
});

test('trim-mean-25: matches reference on n=12, 20, 33, 100', () => {
  for (const n of [12, 20, 33, 100]) {
    const xs = Array.from({ length: n }, (_, i) => (i * 37 + 11) % 997);
    const q = mkSeries('s', xs);
    const r = buildSourceRowTokenTrimMean25(q, { generatedAt: GEN });
    const ref = trimMean25Reference(xs);
    assert.equal(r.sources[0]!.trimMean, ref.trimMean, `n=${n} trimMean`);
    assert.equal(r.sources[0]!.mean, ref.mean, `n=${n} mean`);
    assert.equal(r.sources[0]!.trimmedPerTail, ref.k, `n=${n} k`);
  }
});

test('trim-mean-25: trim_mean lies in [min, max]', () => {
  const xs = [3, 8, 1, 22, 14, 7, 19, 5];
  const r = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  assert.ok(r.sources[0]!.trimMean >= minX);
  assert.ok(r.sources[0]!.trimMean <= maxX);
});

test('trim-mean-25: tmMeanGap large negative when single huge upper outlier', () => {
  const xs = [10, 11, 12, 13, 14, 15, 16, 1_000_000];
  const r = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(row.tmMeanGap < 0, 'gap should be negative');
  // mean is dominated by 1_000_000; trim mean ignores it
  assert.ok(row.mean > 100_000);
  assert.ok(row.trimMean < 100);
});

test('trim-mean-25: tmMeanGap positive when single huge lower outlier (negative side suppressed -> use shifted)', () => {
  // To create a "huge lower tail" with non-negative tokens, shift.
  const xs = [0, 100, 101, 102, 103, 104, 105, 106];
  const r = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  // 0 is in trimmed lower tail (k=2, drop 0 and 100); upper trim drops 105,106
  // central four: 101,102,103,104 -> trim_mean = 102.5; mean = sum/8 = 621/8 = 77.625
  // trim_mean > mean, so gap > 0.
  assert.ok(row.tmMeanGap > 0);
});

// ---------- equivariance ----------

test('trim-mean-25: translation-equivariant (shift by c)', () => {
  const xs = [3, 8, 1, 22, 14, 7, 19, 5, 11, 4];
  const c = 1000;
  const r1 = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenTrimMean25(
    mkSeries(
      's',
      xs.map((x) => x + c),
    ),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r2.sources[0]!.trimMean - (r1.sources[0]!.trimMean + c)) < 1e-9,
  );
  assert.ok(Math.abs(r2.sources[0]!.mean - (r1.sources[0]!.mean + c)) < 1e-9);
});

test('trim-mean-25: scale-equivariant (multiply by c > 0)', () => {
  const xs = [3, 8, 1, 22, 14, 7, 19, 5, 11, 4];
  const c = 7;
  const r1 = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenTrimMean25(
    mkSeries(
      's',
      xs.map((x) => x * c),
    ),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r2.sources[0]!.trimMean - r1.sources[0]!.trimMean * c) < 1e-9,
  );
});

// ---------- breakdown property ----------

test('trim-mean-25: 25 % breakdown — perturbing one tail row by enormous amount leaves trim-mean unchanged when k >= 1', () => {
  const xs = [10, 11, 12, 13, 14, 15, 16, 17];
  const r1 = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  // perturb the largest by huge amount; it sits in trimmed top tail (k=2, drops 16,17)
  const xs2 = [10, 11, 12, 13, 14, 15, 16, 999_999];
  const r2 = buildSourceRowTokenTrimMean25(mkSeries('s', xs2), {
    generatedAt: GEN,
  });
  assert.equal(r1.sources[0]!.trimMean, r2.sources[0]!.trimMean);
});

test('trim-mean-25: perturbing inner row DOES change trim-mean', () => {
  const xs = [10, 11, 12, 13, 14, 15, 16, 17];
  const r1 = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  // change 13 -> 13.5; central window is x_(3..6) = 12,13,14,15
  const xs2 = [10, 11, 12, 13.5, 14, 15, 16, 17];
  const r2 = buildSourceRowTokenTrimMean25(mkSeries('s', xs2), {
    generatedAt: GEN,
  });
  assert.notEqual(r1.sources[0]!.trimMean, r2.sources[0]!.trimMean);
});

// ---------- filtering ----------

test('trim-mean-25: window since/until filters by hour_start', () => {
  const q: QueueLine[] = [
    ql('2026-04-26T10:00:00.000Z', 's', 1),
    ql('2026-04-27T10:00:00.000Z', 's', 100),
    ql('2026-04-27T11:00:00.000Z', 's', 200),
    ql('2026-04-27T12:00:00.000Z', 's', 300),
    ql('2026-04-27T13:00:00.000Z', 's', 400),
    ql('2026-04-28T10:00:00.000Z', 's', 99999),
  ];
  const r = buildSourceRowTokenTrimMean25(q, {
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('trim-mean-25: source filter excludes non-matching', () => {
  const q: QueueLine[] = [
    ...mkSeries('s1', [1, 2, 3, 4, 5]),
    ...mkSeries('s2', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, {
    source: 's1',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedSourceFilter, 5);
});

test('trim-mean-25: drops bad hour_start', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 's', 1),
    ...mkSeries('s', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('trim-mean-25: drops non-finite total_tokens', () => {
  const q: QueueLine[] = [
    { ...ql('2026-04-27T10:00:00.000Z', 's', 0), total_tokens: Number.NaN },
    ...mkSeries('s', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('trim-mean-25: drops negative total_tokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T09:00:00.000Z', 's', -5),
    ...mkSeries('s', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('trim-mean-25: empty/missing source -> "unknown"', () => {
  const q: QueueLine[] = mkSeries('', [10, 20, 30, 40]);
  const r = buildSourceRowTokenTrimMean25(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('trim-mean-25: source below minRows -> droppedBelowMinRows', () => {
  const q: QueueLine[] = [
    ...mkSeries('big', [1, 2, 3, 4, 5, 6]),
    ...mkSeries('small', [10, 20, 30]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('trim-mean-25: minRows custom = 8 hides n=6', () => {
  const q: QueueLine[] = [
    ...mkSeries('big', [1, 2, 3, 4, 5, 6, 7, 8, 9]),
    ...mkSeries('mid', [1, 2, 3, 4, 5, 6]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, {
    minRows: 8,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('trim-mean-25: minTrimMean filter drops low-magnitude sources', () => {
  const q: QueueLine[] = [
    ...mkSeries('big', [100, 200, 300, 400, 500]),
    ...mkSeries('tiny', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, {
    minTrimMean: 100,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinTrimMean, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

// ---------- sort orders ----------

test('trim-mean-25: sort=trim-mean-desc', () => {
  const q: QueueLine[] = [
    ...mkSeries('a', [10, 20, 30, 40, 50]),
    ...mkSeries('b', [1, 2, 3, 4, 5]),
    ...mkSeries('c', [100, 200, 300, 400, 500]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['c', 'a', 'b'],
  );
});

test('trim-mean-25: sort=trim-mean-asc', () => {
  const q: QueueLine[] = [
    ...mkSeries('a', [10, 20, 30, 40, 50]),
    ...mkSeries('b', [1, 2, 3, 4, 5]),
    ...mkSeries('c', [100, 200, 300, 400, 500]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, {
    sort: 'trim-mean-asc',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'a', 'c'],
  );
});

test('trim-mean-25: sort=mean-desc', () => {
  const q: QueueLine[] = [
    ...mkSeries('a', [10, 20, 30, 40, 50]),
    ...mkSeries('b', [1, 2, 3, 4, 5]),
    ...mkSeries('c', [1, 1, 1, 1, 100000]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, {
    sort: 'mean-desc',
    generatedAt: GEN,
  });
  // mean: c huge, a=30, b=3
  assert.equal(r.sources[0]!.source, 'c');
});

test('trim-mean-25: sort=gap-desc puts source with largest |gap| first', () => {
  const q: QueueLine[] = [
    ...mkSeries('flat', [10, 11, 12, 13, 14, 15, 16, 17]),
    ...mkSeries('skewed', [10, 11, 12, 13, 14, 15, 16, 1_000_000]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, {
    sort: 'gap-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'skewed');
});

test('trim-mean-25: sort=rows', () => {
  const q: QueueLine[] = [
    ...mkSeries('a', [10, 20, 30, 40]),
    ...mkSeries('b', [1, 2, 3, 4, 5, 6, 7, 8, 9]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'b');
});

test('trim-mean-25: sort=source lex asc', () => {
  const q: QueueLine[] = [
    ...mkSeries('zeta', [10, 20, 30, 40]),
    ...mkSeries('alpha', [1, 2, 3, 4]),
    ...mkSeries('mu', [100, 200, 300, 400]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mu', 'zeta'],
  );
});

test('trim-mean-25: tiebreak source asc on equal trim_mean', () => {
  const q: QueueLine[] = [
    ...mkSeries('z', [10, 20, 30, 40]),
    ...mkSeries('a', [10, 20, 30, 40]),
    ...mkSeries('m', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'm', 'z'],
  );
});

test('trim-mean-25: --top caps and counts dropped', () => {
  const q: QueueLine[] = [
    ...mkSeries('a', [10, 20, 30, 40]),
    ...mkSeries('b', [1, 2, 3, 4]),
    ...mkSeries('c', [100, 200, 300, 400]),
    ...mkSeries('d', [50, 60, 70, 80]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, { top: 2, generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
});

// ---------- meta fields ----------

test('trim-mean-25: report echoes options', () => {
  const r = buildSourceRowTokenTrimMean25(mkSeries('s', [10, 20, 30, 40]), {
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-05-01T00:00:00.000Z',
    source: 's',
    minRows: 4,
    minTrimMean: 0,
    top: 5,
    sort: 'mean-desc',
    generatedAt: GEN,
  });
  assert.equal(r.windowStart, '2026-04-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-05-01T00:00:00.000Z');
  assert.equal(r.source, 's');
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'mean-desc');
});

test('trim-mean-25: generatedAt defaults to now if omitted', () => {
  const r = buildSourceRowTokenTrimMean25(mkSeries('s', [10, 20, 30, 40]));
  assert.ok(r.generatedAt.length > 0);
  assert.ok(!Number.isNaN(Date.parse(r.generatedAt)));
});

// ---------- property / randomized invariants ----------

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('trim-mean-25: property — trim_mean in [min, max] over 50 random series', () => {
  const r = rng(20260428);
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 4 + Math.floor(r() * 40);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 1_000_000));
    const rep = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    assert.ok(rep.sources[0]!.trimMean >= minX);
    assert.ok(rep.sources[0]!.trimMean <= maxX);
  }
});

test('trim-mean-25: property — translation-equivariant over 30 random series', () => {
  const r = rng(7);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 4 + Math.floor(r() * 30);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 100_000));
    const c = Math.floor(r() * 50_000);
    const r1 = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const r2 = buildSourceRowTokenTrimMean25(
      mkSeries(
        's',
        xs.map((x) => x + c),
      ),
      { generatedAt: GEN },
    );
    const expected = r1.sources[0]!.trimMean + c;
    const actual = r2.sources[0]!.trimMean;
    assert.ok(
      Math.abs(actual - expected) < 1e-6,
      `trial ${trial}: expected ${expected} got ${actual}`,
    );
  }
});

test('trim-mean-25: property — scale-equivariant over 30 random series', () => {
  const r = rng(11);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 4 + Math.floor(r() * 30);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 100_000));
    const c = 1 + Math.floor(r() * 13);
    const r1 = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const r2 = buildSourceRowTokenTrimMean25(
      mkSeries(
        's',
        xs.map((x) => x * c),
      ),
      { generatedAt: GEN },
    );
    const expected = r1.sources[0]!.trimMean * c;
    const actual = r2.sources[0]!.trimMean;
    assert.ok(
      Math.abs(actual - expected) < 1e-3,
      `trial ${trial}: expected ${expected} got ${actual}`,
    );
  }
});

test('trim-mean-25: property — order-invariant over 30 random permutations', () => {
  const r = rng(99);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 4 + Math.floor(r() * 30);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 1_000_000));
    const shuffled = xs.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(r() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    const r1 = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const r2 = buildSourceRowTokenTrimMean25(mkSeries('s', shuffled), {
      generatedAt: GEN,
    });
    assert.equal(r1.sources[0]!.trimMean, r2.sources[0]!.trimMean);
    assert.equal(r1.sources[0]!.mean, r2.sources[0]!.mean);
  }
});

test('trim-mean-25: property — matches reference implementation over 40 random series', () => {
  const r = rng(2026);
  for (let trial = 0; trial < 40; trial += 1) {
    const n = 4 + Math.floor(r() * 50);
    const xs = Array.from({ length: n }, () => Math.floor(r() * 1_000_000));
    const ref = trimMean25Reference(xs);
    const rep = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    assert.equal(rep.sources[0]!.trimMean, ref.trimMean, `trial ${trial}`);
    assert.equal(rep.sources[0]!.mean, ref.mean, `trial ${trial}`);
    assert.equal(rep.sources[0]!.trimmedPerTail, ref.k, `trial ${trial}`);
  }
});

test('trim-mean-25: property — tmMeanGap negative when single huge upper outlier injected', () => {
  const r = rng(43);
  for (let trial = 0; trial < 20; trial += 1) {
    const n = 6 + Math.floor(r() * 20);
    const xs = Array.from({ length: n - 1 }, () => 100 + Math.floor(r() * 100));
    xs.push(10_000_000);
    const rep = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    assert.ok(
      rep.sources[0]!.tmMeanGap < 0,
      `trial ${trial}: gap=${rep.sources[0]!.tmMeanGap}`,
    );
  }
});

test('trim-mean-25: property — k = floor(0.25 * n) for various n', () => {
  for (const n of [4, 5, 6, 7, 8, 11, 12, 19, 20, 99, 100]) {
    const xs = Array.from({ length: n }, (_, i) => i + 1);
    const rep = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    assert.equal(rep.sources[0]!.trimmedPerTail, Math.floor(0.25 * n), `n=${n}`);
  }
});

test('trim-mean-25: property — n - 2k >= 2 always for n >= 4', () => {
  for (const n of [4, 5, 6, 7, 8, 11, 12, 19, 20, 99, 100]) {
    const k = Math.floor(0.25 * n);
    assert.ok(n - 2 * k >= 2, `n=${n} central window ${n - 2 * k}`);
  }
});

test('trim-mean-25: property — equal-shifted halves cancel: trim_mean equals mean of central pairs', () => {
  // Construct symmetric data around 100.
  const xs = [50, 75, 90, 100, 110, 125, 150, 200];
  // sorted: same; n=8 k=2; central x_(3..6) = 90,100,110,125
  const rep = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  assert.equal(rep.sources[0]!.trimMean, (90 + 100 + 110 + 125) / 4);
});

test('trim-mean-25: property — adding pure constant to all rows shifts both mean and trim_mean by exactly that constant (gap unchanged)', () => {
  const xs = [3, 8, 1, 22, 14, 7, 19, 5];
  const r1 = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const c = 12345;
  const r2 = buildSourceRowTokenTrimMean25(
    mkSeries(
      's',
      xs.map((x) => x + c),
    ),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r2.sources[0]!.tmMeanGap - r1.sources[0]!.tmMeanGap) < 1e-9,
  );
});

test('trim-mean-25: empty result when source filter matches nothing', () => {
  const q = mkSeries('s', [10, 20, 30, 40]);
  const r = buildSourceRowTokenTrimMean25(q, {
    source: 'nope',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
});

test('trim-mean-25: window with no rows -> empty', () => {
  const q = mkSeries('s', [10, 20, 30, 40]);
  const r = buildSourceRowTokenTrimMean25(q, {
    since: '2099-01-01T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
});

test('trim-mean-25: top larger than survived returns all without dropping', () => {
  const q = [
    ...mkSeries('a', [10, 20, 30, 40]),
    ...mkSeries('b', [1, 2, 3, 4]),
  ];
  const r = buildSourceRowTokenTrimMean25(q, { top: 100, generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 0);
});

test('trim-mean-25: zero rows kept across all sources -> empty sources, totalRowsKept=0', () => {
  const q: QueueLine[] = [ql('not-a-date', 's', 1)];
  const r = buildSourceRowTokenTrimMean25(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.droppedInvalidHourStart, 1);
});

// ---------- refinement: extra property pins + orthogonality ----------

test('trim-mean-25: refinement — full-tail replacement with arbitrary extreme values leaves trim-mean exactly unchanged (the 25%-breakdown signature) over 25 random trials', () => {
  const r = rng(31415);
  for (let trial = 0; trial < 25; trial += 1) {
    const n = 8 + Math.floor(r() * 30); // n >= 8 so k >= 2
    const central = Array.from({ length: n - 4 }, () =>
      100 + Math.floor(r() * 100),
    );
    // Two-row tails on each side, sandwiching the central body.
    const baseLow = [1, 2];
    const baseHigh = [10_000, 20_000];
    const xs1 = [...baseLow, ...central, ...baseHigh];
    // Replace the SAME tail rows with arbitrarily extreme values.
    const newLow = [-0 + Math.floor(r() * 50), Math.floor(r() * 50)];
    const newHigh = [
      1_000_000 + Math.floor(r() * 1_000_000),
      10_000_000 + Math.floor(r() * 1_000_000),
    ];
    const xs2 = [...newLow, ...central, ...newHigh];
    const rep1 = buildSourceRowTokenTrimMean25(mkSeries('s', xs1), {
      generatedAt: GEN,
    });
    const rep2 = buildSourceRowTokenTrimMean25(mkSeries('s', xs2), {
      generatedAt: GEN,
    });
    // For the breakdown property to apply cleanly, both extreme low values
    // and both extreme high values must remain the bottom-2 and top-2
    // after sort. Verify and only then assert equality.
    const sorted1 = xs1.slice().sort((a, b) => a - b);
    const sorted2 = xs2.slice().sort((a, b) => a - b);
    const k = Math.floor(0.25 * xs1.length);
    if (k < 2) continue;
    // Skip trials where the perturbation broke the assumption that the
    // injected extremes still bracket the central body.
    if (
      sorted1.slice(k, xs1.length - k).join(',') !==
      sorted2.slice(k, xs2.length - k).join(',')
    ) {
      continue;
    }
    assert.equal(
      rep1.sources[0]!.trimMean,
      rep2.sources[0]!.trimMean,
      `trial ${trial}: trim-mean must be unchanged when only tails differ`,
    );
  }
});

test('trim-mean-25: refinement — orthogonality: two distributions with identical mid-range but different trim-mean exist (proves trim-mean is not a function of (min, max) alone)', () => {
  // Both: min=0, max=100, n=8 -> mid-range = 50 in both cases.
  // But the central 4 differ.
  const a = [0, 10, 20, 30, 40, 50, 60, 100];
  const b = [0, 10, 80, 85, 90, 95, 99, 100];
  const ra = buildSourceRowTokenTrimMean25(mkSeries('a', a), {
    generatedAt: GEN,
  });
  const rb = buildSourceRowTokenTrimMean25(mkSeries('b', b), {
    generatedAt: GEN,
  });
  // central 4 of a (drop 0,10 and 60,100): 20,30,40,50 -> 35
  assert.equal(ra.sources[0]!.trimMean, 35);
  // central 4 of b (drop 0,10 and 99,100): 80,85,90,95 -> 87.5
  assert.equal(rb.sources[0]!.trimMean, 87.5);
  // sanity: same mid-range
  assert.equal((Math.min(...a) + Math.max(...a)) / 2, 50);
  assert.equal((Math.min(...b) + Math.max(...b)) / 2, 50);
  assert.notEqual(ra.sources[0]!.trimMean, rb.sources[0]!.trimMean);
});

test('trim-mean-25: refinement — orthogonality: two distributions with identical midhinge but different trim-mean exist (proves trim-mean is not a function of (q1, q3) alone)', () => {
  // Construct two n=8 series sharing q1 and q3 (type-7 quantile) but with
  // different central body shapes. q1 at p=0.25 with n=8 sits between
  // x_(2) and x_(3) (h = 1.75). q3 at p=0.75 sits between x_(6) and
  // x_(7) (h = 5.25). Pin x_(2),x_(3),x_(6),x_(7) the same; vary x_(4),x_(5).
  const a = [1, 10, 20, 30, 40, 80, 90, 200];
  const b = [1, 10, 20, 75, 75, 80, 90, 200];
  // q1(a) = 10 + 0.75*(20-10) = 17.5; q3(a) = 80 + 0.25*(90-80) = 82.5
  // q1(b) = 10 + 0.75*(20-10) = 17.5; q3(b) = 80 + 0.25*(90-80) = 82.5
  // central 4 of a (drop 1,10 and 90,200): 20,30,40,80 -> 42.5
  // central 4 of b (drop 1,10 and 90,200): 20,75,75,80 -> 62.5
  const ra = buildSourceRowTokenTrimMean25(mkSeries('a', a), {
    generatedAt: GEN,
  });
  const rb = buildSourceRowTokenTrimMean25(mkSeries('b', b), {
    generatedAt: GEN,
  });
  assert.equal(ra.sources[0]!.trimMean, 42.5);
  assert.equal(rb.sources[0]!.trimMean, 62.5);
  assert.notEqual(ra.sources[0]!.trimMean, rb.sources[0]!.trimMean);
});

test('trim-mean-25: refinement — n - 2k window count appears as trimmedPerTail*2 dropped from rowsKept', () => {
  for (const n of [4, 5, 7, 8, 11, 16, 23, 100]) {
    const xs = Array.from({ length: n }, (_, i) => i + 1);
    const rep = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const k = rep.sources[0]!.trimmedPerTail;
    assert.equal(k, Math.floor(0.25 * n));
    // Reconstruct trim-mean by hand from the central window and confirm.
    const central = xs.slice(k, n - k);
    const expected = central.reduce((a, b) => a + b, 0) / central.length;
    assert.equal(rep.sources[0]!.trimMean, expected, `n=${n}`);
  }
});
