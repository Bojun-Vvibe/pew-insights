import { test } from 'node:test';
import { strict as assert } from 'node:assert';
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

function harmonicReference(xs: number[]): {
  mean: number;
  harmonicMean: number;
} {
  const n = xs.length;
  let sumRecip = 0;
  let total = 0;
  for (const x of xs) {
    sumRecip += 1 / x;
    total += x;
  }
  return { mean: total / n, harmonicMean: n / sumRecip };
}

// ---------- shape / option validation ----------

test('harmonic-mean: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenHarmonicMean([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 1);
  assert.equal(r.minHarmonicMean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'harmonic-mean-desc');
  assert.equal(r.generatedAt, GEN);
});

test('harmonic-mean: minRows < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenHarmonicMean([], { minRows: 0 }),
    /minRows must be an integer >= 1/,
  );
});

test('harmonic-mean: minRows non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenHarmonicMean([], {
        minRows: 2.5 as unknown as number,
      }),
    /minRows must be an integer >= 1/,
  );
});

test('harmonic-mean: minHarmonicMean negative throws', () => {
  assert.throws(
    () => buildSourceRowTokenHarmonicMean([], { minHarmonicMean: -1 }),
    /minHarmonicMean must be a finite, non-negative number/,
  );
});

test('harmonic-mean: minHarmonicMean NaN throws', () => {
  assert.throws(
    () => buildSourceRowTokenHarmonicMean([], { minHarmonicMean: Number.NaN }),
    /minHarmonicMean must be a finite, non-negative number/,
  );
});

test('harmonic-mean: minHarmonicMean Infinity throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenHarmonicMean([], {
        minHarmonicMean: Number.POSITIVE_INFINITY,
      }),
    /minHarmonicMean must be a finite, non-negative number/,
  );
});

test('harmonic-mean: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenHarmonicMean([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('harmonic-mean: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenHarmonicMean([], { top: 2.5 }),
    /top must be a positive integer/,
  );
});

test('harmonic-mean: bad sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenHarmonicMean([], {
        sort: 'bogus' as unknown as never,
      }),
    /sort must be one of/,
  );
});

test('harmonic-mean: bad since throws', () => {
  assert.throws(
    () => buildSourceRowTokenHarmonicMean([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('harmonic-mean: bad until throws', () => {
  assert.throws(
    () => buildSourceRowTokenHarmonicMean([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

// ---------- core math ----------

test('harmonic-mean: single positive row -> HM equals that row, mean equals that row, gap=0', () => {
  const r = buildSourceRowTokenHarmonicMean(mkSeries('s', [42]), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.harmonicMean, 42);
  assert.equal(row.mean, 42);
  assert.equal(row.hmAmGap, 0);
  assert.equal(row.rowsKept, 1);
});

test('harmonic-mean: identical positive rows -> HM = mean = c, gap=0', () => {
  const r = buildSourceRowTokenHarmonicMean(
    mkSeries('s', [7, 7, 7, 7, 7]),
    { generatedAt: GEN },
  );
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.harmonicMean - 7) < 1e-12);
  assert.equal(row.mean, 7);
  assert.ok(Math.abs(row.hmAmGap) < 1e-12);
});

test('harmonic-mean: two values [4, 8] -> HM = 2 / (1/4 + 1/8) = 2 / (3/8) = 16/3', () => {
  const r = buildSourceRowTokenHarmonicMean(mkSeries('s', [4, 8]), {
    generatedAt: GEN,
  });
  assert.ok(Math.abs(r.sources[0]!.harmonicMean - 16 / 3) < 1e-12);
  assert.equal(r.sources[0]!.mean, 6);
  assert.ok(r.sources[0]!.hmAmGap < 0);
});

test('harmonic-mean: classic [1, 2, 4] -> HM = 3 / (1 + 1/2 + 1/4) = 3 / 1.75 = 12/7', () => {
  const r = buildSourceRowTokenHarmonicMean(mkSeries('s', [1, 2, 4]), {
    generatedAt: GEN,
  });
  assert.ok(Math.abs(r.sources[0]!.harmonicMean - 12 / 7) < 1e-12);
  assert.ok(Math.abs(r.sources[0]!.mean - 7 / 3) < 1e-12);
});

test('harmonic-mean: AM-GM-HM inequality holds for varied positive series', () => {
  for (const xs of [
    [1, 2, 3, 4, 5],
    [10, 20, 50, 100],
    [3, 7, 11, 13, 17, 19],
    [1, 1000],
    [1, 1, 1, 1, 1000],
  ]) {
    const r = buildSourceRowTokenHarmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    assert.ok(row.harmonicMean <= row.mean + 1e-9, `HM <= AM for ${xs}`);
  }
});

test('harmonic-mean: HM lies in [min, max]', () => {
  for (const xs of [
    [3, 7, 11, 13, 17, 19],
    [10, 20, 50, 100],
    [1, 100, 1000],
    [5, 5, 5, 5, 100],
  ]) {
    const r = buildSourceRowTokenHarmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const hm = r.sources[0]!.harmonicMean;
    assert.ok(hm >= Math.min(...xs) - 1e-9, `HM >= min for ${xs}`);
    assert.ok(hm <= Math.max(...xs) + 1e-9, `HM <= max for ${xs}`);
  }
});

test('harmonic-mean: hmAmGap is always <= 0', () => {
  for (const xs of [
    [1, 2, 3],
    [10, 100, 1000],
    [5, 5, 5, 100],
    [1, 1],
    [1],
  ]) {
    const r = buildSourceRowTokenHarmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    assert.ok(r.sources[0]!.hmAmGap <= 1e-12, `gap<=0 for ${xs}`);
  }
});

test('harmonic-mean: matches reference impl on multiple series', () => {
  for (const xs of [
    [1, 2, 3, 4],
    [5, 10, 15],
    [100, 200, 50, 25],
    [7],
    [1, 2, 4, 8, 16, 32],
    [99, 99, 99, 99],
  ]) {
    const r = buildSourceRowTokenHarmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const ref = harmonicReference(xs);
    assert.ok(
      Math.abs(r.sources[0]!.harmonicMean - ref.harmonicMean) < 1e-9,
      `HM mismatch for ${xs}`,
    );
    assert.ok(
      Math.abs(r.sources[0]!.mean - ref.mean) < 1e-9,
      `mean mismatch for ${xs}`,
    );
  }
});

test('harmonic-mean: order-invariant (multiset only)', () => {
  const a = mkSeries('s', [1, 2, 3, 4, 5, 6, 7, 8]);
  const b = mkSeries('s', [8, 1, 5, 3, 7, 2, 6, 4]);
  const ra = buildSourceRowTokenHarmonicMean(a, { generatedAt: GEN });
  const rb = buildSourceRowTokenHarmonicMean(b, { generatedAt: GEN });
  assert.ok(
    Math.abs(ra.sources[0]!.harmonicMean - rb.sources[0]!.harmonicMean) < 1e-12,
  );
});

test('harmonic-mean: scale-equivariance — rescaling all rows by c rescales HM by c', () => {
  const xs = [3, 7, 11, 13, 17];
  const c = 100;
  const r1 = buildSourceRowTokenHarmonicMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenHarmonicMean(
    mkSeries(
      's',
      xs.map((x) => x * c),
    ),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r2.sources[0]!.harmonicMean - c * r1.sources[0]!.harmonicMean) <
      1e-9,
  );
});

test('harmonic-mean: NOT translation-equivariant — shifting by c does not shift HM by exactly c', () => {
  const xs = [1, 2, 3, 4, 5];
  const c = 100;
  const r1 = buildSourceRowTokenHarmonicMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenHarmonicMean(
    mkSeries(
      's',
      xs.map((x) => x + c),
    ),
    { generatedAt: GEN },
  );
  // HM(xs+c) - HM(xs) is NOT exactly c on a non-constant series — that's
  // the qualitative break from the translation-equivariant L-estimators.
  // (HM is concave; HM(shifted) approaches mean(shifted) as c grows, so
  // the HM-shift overshoots c when HM starts below the mean.)
  const hmShift = r2.sources[0]!.harmonicMean - r1.sources[0]!.harmonicMean;
  assert.notEqual(hmShift, c);
  assert.ok(Math.abs(hmShift - c) > 0.1, `HM-shift differs meaningfully from c (got ${hmShift})`);
  // Meanwhile AM shift is exactly c, so HM and AM disagree under translation.
  assert.equal(r2.sources[0]!.mean - r1.sources[0]!.mean, c);
});

test('harmonic-mean: small-row dominance — single tiny row pulls HM toward zero', () => {
  // xs = [0.01, 100, 100, 100, 100]: AM ~80, HM dominated by the 0.01.
  // sumRecip = 100 + 4*0.01 = 100.04; HM = 5/100.04 ~ 0.04998.
  const r = buildSourceRowTokenHarmonicMean(
    mkSeries('s', [0.01, 100, 100, 100, 100]),
    { generatedAt: GEN },
  );
  assert.ok(r.sources[0]!.harmonicMean < 1, 'HM well below 1');
  assert.ok(r.sources[0]!.mean > 70, 'AM well above 70');
});

test('harmonic-mean: large-row inert — single huge row barely moves HM', () => {
  const baseline = buildSourceRowTokenHarmonicMean(mkSeries('s', [1, 1, 1, 1]), {
    generatedAt: GEN,
  });
  const withHuge = buildSourceRowTokenHarmonicMean(
    mkSeries('s', [1, 1, 1, 1, 1_000_000]),
    { generatedAt: GEN },
  );
  // Baseline HM = 1; with huge row HM = 5 / (4 + 1e-6) ~ 1.25; well below 2.
  assert.equal(baseline.sources[0]!.harmonicMean, 1);
  assert.ok(withHuge.sources[0]!.harmonicMean < 2);
  // Meanwhile AM jumps to ~200,000.
  assert.ok(withHuge.sources[0]!.mean > 100_000);
});

// ---------- filtering / dropped counters ----------

test('harmonic-mean: bad hour_start dropped', () => {
  const q: QueueLine[] = [ql('not-a-date', 's', 5), ql('2026-04-27T00:00:00.000Z', 's', 10)];
  const r = buildSourceRowTokenHarmonicMean(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalRowsKept, 1);
});

test('harmonic-mean: NaN total_tokens dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 's', Number.NaN),
    ql('2026-04-27T01:00:00.000Z', 's', 10),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('harmonic-mean: negative total_tokens dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 's', -5),
    ql('2026-04-27T01:00:00.000Z', 's', 10),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('harmonic-mean: zero total_tokens dropped (separately tracked)', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 's', 0),
    ql('2026-04-27T01:00:00.000Z', 's', 0),
    ql('2026-04-27T02:00:00.000Z', 's', 10),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.totalRowsKept, 1);
});

test('harmonic-mean: all-zero series -> source dropped (no Infinity / NaN)', () => {
  const q = mkSeries('s', [0, 0, 0, 0]);
  const r = buildSourceRowTokenHarmonicMean(q, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 4);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0); // perSource map never gained 's'
});

test('harmonic-mean: source filter excludes others', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3]),
    ...mkSeries('b', [10, 20, 30]),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.droppedSourceFilter, 3);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('harmonic-mean: empty/missing source -> "unknown" bucket', () => {
  const q: QueueLine[] = [
    { ...ql('2026-04-27T00:00:00.000Z', '', 10), source: '' },
    ql('2026-04-27T01:00:00.000Z', '', 20),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('harmonic-mean: window since/until honored', () => {
  const q = [
    ql('2026-04-25T00:00:00.000Z', 's', 1),
    ql('2026-04-27T00:00:00.000Z', 's', 100),
    ql('2026-04-29T00:00:00.000Z', 's', 999),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, {
    since: '2026-04-26T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.rowsKept, 1);
  assert.equal(r.sources[0]!.harmonicMean, 100);
});

test('harmonic-mean: minRows display gate drops sparse sources', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    ...mkSeries('b', [50]),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, {
    minRows: 5,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('harmonic-mean: min-harmonic-mean gate drops below-threshold sources', () => {
  const q = [
    ...mkSeries('big', [100, 100, 100, 100]),
    ...mkSeries('small', [1, 1, 1, 1]),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, {
    minHarmonicMean: 50,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinHarmonicMean, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

// ---------- sort / cap ----------

test('harmonic-mean: default sort is harmonic-mean-desc', () => {
  const q = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [100, 100, 100]),
    ...mkSeries('c', [10, 10, 10]),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'c', 'a'],
  );
});

test('harmonic-mean: harmonic-mean-asc sort', () => {
  const q = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [100, 100, 100]),
    ...mkSeries('c', [10, 10, 10]),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, {
    sort: 'harmonic-mean-asc',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'c', 'b'],
  );
});

test('harmonic-mean: mean-desc sort', () => {
  const q = [
    ...mkSeries('a', [1, 100]), // mean=50.5, HM~1.98
    ...mkSeries('b', [10, 10]), // mean=10, HM=10
    ...mkSeries('c', [50, 50]), // mean=50, HM=50
  ];
  const r = buildSourceRowTokenHarmonicMean(q, {
    sort: 'mean-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a'); // highest mean
});

test('harmonic-mean: gap-desc sort surfaces multiplicative spread first', () => {
  const q = [
    ...mkSeries('flat', [10, 10, 10, 10]), // gap = 0
    ...mkSeries('spread', [1, 1000, 1000, 1000]), // big |gap|
  ];
  const r = buildSourceRowTokenHarmonicMean(q, {
    sort: 'gap-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'spread');
  assert.equal(r.sources[1]!.source, 'flat');
});

test('harmonic-mean: rows sort by rowsKept desc', () => {
  const q = [
    ...mkSeries('few', [1, 2]),
    ...mkSeries('many', Array.from({ length: 10 }, (_, i) => i + 1)),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'many');
});

test('harmonic-mean: source sort is lex asc', () => {
  const q = [
    ...mkSeries('zebra', [10, 10]),
    ...mkSeries('apple', [10, 10]),
    ...mkSeries('mango', [10, 10]),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['apple', 'mango', 'zebra'],
  );
});

test('harmonic-mean: tiebreak source asc on equal harmonic mean', () => {
  const q = [
    ...mkSeries('zebra', [5, 5, 5]),
    ...mkSeries('apple', [5, 5, 5]),
    ...mkSeries('mango', [5, 5, 5]),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['apple', 'mango', 'zebra'],
  );
});

test('harmonic-mean: top cap surfaces droppedBelowTopCap', () => {
  const q = [
    ...mkSeries('a', [100, 100]),
    ...mkSeries('b', [10, 10]),
    ...mkSeries('c', [1, 1]),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('harmonic-mean: top larger than survived returns all without dropping', () => {
  const q = [
    ...mkSeries('a', [10, 20]),
    ...mkSeries('b', [1, 2]),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, { top: 100, generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 0);
});

test('harmonic-mean: empty result when source filter matches nothing', () => {
  const q = mkSeries('s', [10, 20, 30, 40]);
  const r = buildSourceRowTokenHarmonicMean(q, {
    source: 'nope',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
});

test('harmonic-mean: window with no rows -> empty', () => {
  const q = mkSeries('s', [10, 20, 30, 40]);
  const r = buildSourceRowTokenHarmonicMean(q, {
    since: '2099-01-01T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
});

// ---------- multi-source / aggregation ----------

test('harmonic-mean: multi-source totals reconcile', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4]),
    ...mkSeries('b', [10, 20]),
    ...mkSeries('c', [100]),
  ];
  const r = buildSourceRowTokenHarmonicMean(q, { generatedAt: GEN });
  assert.equal(r.totalSources, 3);
  assert.equal(r.totalRowsKept, 7);
  assert.equal(r.sources.length, 3);
});

test('harmonic-mean: per-source isolation — one source\'s rows do not affect another\'s HM', () => {
  const q1 = mkSeries('a', [2, 4, 8]);
  const q2 = [
    ...mkSeries('a', [2, 4, 8]),
    ...mkSeries('b', [1000, 1000, 1000]),
  ];
  const r1 = buildSourceRowTokenHarmonicMean(q1, { generatedAt: GEN });
  const r2 = buildSourceRowTokenHarmonicMean(q2, { generatedAt: GEN });
  const a1 = r1.sources.find((s) => s.source === 'a')!;
  const a2 = r2.sources.find((s) => s.source === 'a')!;
  assert.equal(a1.harmonicMean, a2.harmonicMean);
  assert.equal(a1.mean, a2.mean);
});

// ---------- generatedAt + report metadata ----------

test('harmonic-mean: generatedAt defaults to "now" when not provided', () => {
  const before = Date.now();
  const r = buildSourceRowTokenHarmonicMean([]);
  const after = Date.now();
  const t = Date.parse(r.generatedAt);
  assert.ok(t >= before - 5 && t <= after + 5);
});

test('harmonic-mean: report metadata reflects options', () => {
  const r = buildSourceRowTokenHarmonicMean([], {
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-04-30T00:00:00.000Z',
    source: 'pew-cli',
    minRows: 3,
    minHarmonicMean: 1.5,
    top: 5,
    sort: 'gap-desc',
    generatedAt: GEN,
  });
  assert.equal(r.windowStart, '2026-04-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00.000Z');
  assert.equal(r.source, 'pew-cli');
  assert.equal(r.minRows, 3);
  assert.equal(r.minHarmonicMean, 1.5);
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'gap-desc');
});

// ---------- additional pinned values ----------

test('harmonic-mean: pinned [60, 40] -> HM = 48', () => {
  // 2 / (1/60 + 1/40) = 2 / (5/120) = 240/5 = 48
  const r = buildSourceRowTokenHarmonicMean(mkSeries('s', [60, 40]), {
    generatedAt: GEN,
  });
  assert.ok(Math.abs(r.sources[0]!.harmonicMean - 48) < 1e-9);
  assert.equal(r.sources[0]!.mean, 50);
});

test('harmonic-mean: pinned [1, 1, 1000000] -> HM ~ 3 / 2.000001 ~ 1.4999...', () => {
  const r = buildSourceRowTokenHarmonicMean(
    mkSeries('s', [1, 1, 1_000_000]),
    { generatedAt: GEN },
  );
  const hm = r.sources[0]!.harmonicMean;
  assert.ok(hm > 1.499 && hm < 1.501, `HM=${hm}`);
  assert.ok(r.sources[0]!.mean > 333_333);
});

test('harmonic-mean: pinned [10, 10, 10, 10, 10] -> HM = 10 = mean, gap=0', () => {
  const r = buildSourceRowTokenHarmonicMean(
    mkSeries('s', [10, 10, 10, 10, 10]),
    { generatedAt: GEN },
  );
  assert.equal(r.sources[0]!.harmonicMean, 10);
  assert.equal(r.sources[0]!.mean, 10);
  assert.equal(r.sources[0]!.hmAmGap, 0);
});

test('harmonic-mean: ascending vs descending input agree (order-invariant under reverse)', () => {
  const asc = mkSeries('s', [1, 2, 3, 4, 5, 6, 7]);
  const desc = mkSeries('s', [7, 6, 5, 4, 3, 2, 1]);
  const ra = buildSourceRowTokenHarmonicMean(asc, { generatedAt: GEN });
  const rd = buildSourceRowTokenHarmonicMean(desc, { generatedAt: GEN });
  assert.ok(
    Math.abs(ra.sources[0]!.harmonicMean - rd.sources[0]!.harmonicMean) < 1e-12,
  );
});

// ---------- refinement: geometric-mean byproduct + AM-GM-HM sandwich ----------

test('harmonic-mean: refinement — geometricMean reported on every row', () => {
  const r = buildSourceRowTokenHarmonicMean(
    mkSeries('s', [2, 4, 8]),
    { generatedAt: GEN },
  );
  // GM = (2*4*8)^(1/3) = 64^(1/3) = 4.
  assert.ok(Math.abs(r.sources[0]!.geometricMean - 4) < 1e-9);
});

test('harmonic-mean: refinement — geometricMean equals c on a constant series', () => {
  const r = buildSourceRowTokenHarmonicMean(
    mkSeries('s', [13, 13, 13, 13]),
    { generatedAt: GEN },
  );
  assert.ok(Math.abs(r.sources[0]!.geometricMean - 13) < 1e-9);
  assert.ok(Math.abs(r.sources[0]!.hmGmGap) < 1e-9);
});

test('harmonic-mean: refinement — AM-GM-HM sandwich holds: HM <= GM <= AM on every row', () => {
  for (const xs of [
    [1, 2, 3, 4, 5],
    [10, 20, 50, 100],
    [3, 7, 11, 13, 17, 19],
    [1, 1000],
    [1, 1, 1, 1, 1000],
    [99, 99, 99, 99, 99, 100],
    [42],
  ]) {
    const r = buildSourceRowTokenHarmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    assert.ok(
      row.harmonicMean <= row.geometricMean + 1e-9,
      `HM <= GM for ${xs}`,
    );
    assert.ok(
      row.geometricMean <= row.mean + 1e-9,
      `GM <= AM for ${xs}`,
    );
  }
});

test('harmonic-mean: refinement — hmGmGap is always <= 0', () => {
  for (const xs of [
    [1, 2, 3],
    [10, 100, 1000],
    [5, 5, 5, 100],
    [42],
    [7, 7, 7],
  ]) {
    const r = buildSourceRowTokenHarmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    assert.ok(r.sources[0]!.hmGmGap <= 1e-12, `hmGmGap<=0 for ${xs}`);
  }
});

test('harmonic-mean: refinement — geometricMean is scale-equivariant (rescale by c rescales GM by c)', () => {
  const xs = [3, 7, 11, 13, 17];
  const c = 100;
  const r1 = buildSourceRowTokenHarmonicMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenHarmonicMean(
    mkSeries(
      's',
      xs.map((x) => x * c),
    ),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r2.sources[0]!.geometricMean - c * r1.sources[0]!.geometricMean) <
      1e-7,
  );
});

test('harmonic-mean: refinement — geometricMean computed in log-space does not overflow on large products', () => {
  // 30 rows of 1e9 each: naive product is 1e270 (still finite double),
  // but 50 rows of 1e9 = 1e450 overflows. Use 100 rows.
  const xs = Array.from({ length: 100 }, () => 1e9);
  const r = buildSourceRowTokenHarmonicMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  // GM of constant series == constant.
  assert.ok(Math.abs(r.sources[0]!.geometricMean - 1e9) < 1);
  assert.ok(Number.isFinite(r.sources[0]!.geometricMean));
});

test('harmonic-mean: refinement — pinned sandwich [1, 4, 16] -> HM=48/21, GM=4, AM=7', () => {
  const r = buildSourceRowTokenHarmonicMean(
    mkSeries('s', [1, 4, 16]),
    { generatedAt: GEN },
  );
  // HM = 3 / (1 + 1/4 + 1/16) = 3 / 1.3125 = 48/21 ~ 2.2857
  assert.ok(Math.abs(r.sources[0]!.harmonicMean - 48 / 21) < 1e-9);
  // GM = (1*4*16)^(1/3) = 64^(1/3) = 4
  assert.ok(Math.abs(r.sources[0]!.geometricMean - 4) < 1e-9);
  // AM = 21/3 = 7
  assert.equal(r.sources[0]!.mean, 7);
  // gaps both negative
  assert.ok(r.sources[0]!.hmAmGap < 0);
  assert.ok(r.sources[0]!.hmGmGap < 0);
});
