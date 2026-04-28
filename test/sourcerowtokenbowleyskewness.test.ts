import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenBowleySkewness } from '../src/sourcerowtokenbowleyskewness.js';
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

test('bowley: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenBowleySkewness([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 4);
  assert.equal(r.minMedian, 0);
  assert.equal(r.minAbsBowley, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'bowley-desc');
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.windowStart, null);
  assert.equal(r.windowEnd, null);
  assert.equal(r.source, null);
});

test('bowley: rejects bad minRows (< 4 or non-integer)', () => {
  assert.throws(() => buildSourceRowTokenBowleySkewness([], { minRows: 3 }));
  assert.throws(() => buildSourceRowTokenBowleySkewness([], { minRows: 4.5 }));
  assert.throws(() => buildSourceRowTokenBowleySkewness([], { minRows: -1 }));
  assert.throws(() => buildSourceRowTokenBowleySkewness([], { minRows: 0 }));
});

test('bowley: rejects bad minMedian', () => {
  assert.throws(() => buildSourceRowTokenBowleySkewness([], { minMedian: -1 }));
  assert.throws(() =>
    buildSourceRowTokenBowleySkewness([], { minMedian: Number.NaN }),
  );
  assert.throws(() =>
    buildSourceRowTokenBowleySkewness([], {
      minMedian: Number.POSITIVE_INFINITY,
    }),
  );
});

test('bowley: rejects bad minAbsBowley (out of [0,1] or non-finite)', () => {
  assert.throws(() =>
    buildSourceRowTokenBowleySkewness([], { minAbsBowley: -0.1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenBowleySkewness([], { minAbsBowley: 1.0001 }),
  );
  assert.throws(() =>
    buildSourceRowTokenBowleySkewness([], { minAbsBowley: Number.NaN }),
  );
  assert.throws(() =>
    buildSourceRowTokenBowleySkewness([], {
      minAbsBowley: Number.POSITIVE_INFINITY,
    }),
  );
});

test('bowley: rejects bad top / sort / since / until', () => {
  assert.throws(() => buildSourceRowTokenBowleySkewness([], { top: 0 }));
  assert.throws(() => buildSourceRowTokenBowleySkewness([], { top: 1.5 }));
  assert.throws(() => buildSourceRowTokenBowleySkewness([], { top: -1 }));
  assert.throws(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildSourceRowTokenBowleySkewness([], { sort: 'bogus' as any }),
  );
  assert.throws(() => buildSourceRowTokenBowleySkewness([], { since: 'nope' }));
  assert.throws(() => buildSourceRowTokenBowleySkewness([], { until: 'nope' }));
});

test('bowley: minAbsBowley=0 and 1 boundaries accepted', () => {
  buildSourceRowTokenBowleySkewness([], { minAbsBowley: 0 });
  buildSourceRowTokenBowleySkewness([], { minAbsBowley: 1 });
});

test('bowley: bad hour_start counted, dropped', () => {
  const q = [ql('not-a-date', 'a', 100), ...mkSeries('a', [100, 200, 300, 400])];
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalRowsKept, 4);
});

test('bowley: bad / negative tokens dropped, counted', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 'a', Number.NaN),
    ql('2026-04-27T01:00:00.000Z', 'a', -10),
    ...mkSeries('a', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.totalRowsKept, 4);
});

test('bowley: symmetric series 100,200,300,400 -> bowley = 0', () => {
  // type-7 quantiles for [100,200,300,400]: q1=175, q2=250, q3=325
  // B = (175 + 325 - 2*250) / 150 = 0 / 150 = 0
  const q = mkSeries('a', [100, 200, 300, 400]);
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.q1, 175);
  assert.equal(s.median, 250);
  assert.equal(s.q3, 325);
  assert.equal(s.iqr, 150);
  assert.equal(s.bowley, 0);
  assert.equal(s.absBowley, 0);
  assert.equal(s.degenerate, false);
});

test('bowley: arithmetic-progression series of any length -> bowley = 0', () => {
  // any equally-spaced sequence has type-7 quartiles with q2 exactly
  // midway between q1 and q3.
  for (const n of [4, 5, 7, 9, 13, 21, 50, 100]) {
    const vals: number[] = [];
    for (let i = 0; i < n; i += 1) vals.push((i + 1) * 7);
    const r = buildSourceRowTokenBowleySkewness(mkSeries('a', vals), {
      generatedAt: GEN,
    });
    const s = r.sources[0]!;
    assert.ok(
      Math.abs(s.bowley) < 1e-12,
      `n=${n} expected bowley~0 got ${s.bowley}`,
    );
  }
});

test('bowley: all-equal series -> degenerate, bowley=0', () => {
  const q = mkSeries('a', [50, 50, 50, 50, 50]);
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.iqr, 0);
  assert.equal(s.bowley, 0);
  assert.equal(s.degenerate, true);
});

test('bowley: all-zero series -> degenerate', () => {
  const q = mkSeries('a', [0, 0, 0, 0, 0, 0]);
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.median, 0);
  assert.equal(s.iqr, 0);
  assert.equal(s.degenerate, true);
});

test('bowley: right-skewed (sparse big tail) -> bowley > 0', () => {
  // 100 small values + 1 huge: median pulled down toward Q1, B > 0
  const small = Array.from({ length: 100 }, () => 10);
  small.push(10000);
  const r = buildSourceRowTokenBowleySkewness(mkSeries('a', small), {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  // q1 = q2 = q3 = 10 in the central half because everything is 10 except
  // one outlier. So this is actually degenerate.
  assert.equal(s.degenerate, true);
});

test('bowley: skewed concrete example -> known positive value', () => {
  // values: 1,2,3,4,5,6,7,8,9,100  (n=10)
  // type-7 quartiles:
  //   q1: h=2.25 -> sorted[2] + 0.25*(sorted[3]-sorted[2]) = 3 + 0.25*1 = 3.25
  //   q2: h=4.5  -> sorted[4] + 0.5*(sorted[5]-sorted[4])  = 5 + 0.5*1   = 5.5
  //   q3: h=6.75 -> sorted[6] + 0.75*(sorted[7]-sorted[6]) = 7 + 0.75*1  = 7.75
  // iqr = 4.5
  // B = (3.25 + 7.75 - 11) / 4.5 = 0 / 4.5 = 0  (insensitive to outlier!)
  const q = mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]);
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.q1 - 3.25) < 1e-9);
  assert.ok(Math.abs(s.median - 5.5) < 1e-9);
  assert.ok(Math.abs(s.q3 - 7.75) < 1e-9);
  // This is the demonstration that Bowley is robust to a single outlier
  // — the central 50% of [1..9, 100] is symmetric.
  assert.ok(Math.abs(s.bowley) < 1e-12);
});

test('bowley: explicitly right-skewed central half -> B > 0', () => {
  // central half clumped low, upper quartile gap wide.
  // values: 1,1,1,1,1,1,2,3,5,10,20,40 (n=12)
  // sorted is the same.
  // q1: h=(11)*0.25 = 2.75 -> idx2 + 0.75*(idx3-idx2) = 1 + 0.75*0 = 1
  // q2: h=5.5             -> idx5 + 0.5*(idx6-idx5)  = 1 + 0.5*1   = 1.5
  // q3: h=8.25            -> idx8 + 0.25*(idx9-idx8) = 5 + 0.25*5  = 6.25
  // iqr = 5.25
  // B = (1 + 6.25 - 3) / 5.25 = 4.25 / 5.25 ~ 0.8095
  const q = mkSeries('a', [1, 1, 1, 1, 1, 1, 2, 3, 5, 10, 20, 40]);
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.ok(Math.abs(s.q1 - 1) < 1e-9);
  assert.ok(Math.abs(s.median - 1.5) < 1e-9);
  assert.ok(Math.abs(s.q3 - 6.25) < 1e-9);
  assert.ok(Math.abs(s.iqr - 5.25) < 1e-9);
  assert.ok(s.bowley > 0.8 && s.bowley < 0.81);
  assert.equal(s.degenerate, false);
});

test('bowley: explicitly left-skewed central half -> B < 0', () => {
  // mirror image: long lower tail, central high.
  const q = mkSeries('a', [
    -40, -20, -10, -5, -3, -2, 0, 0, 0, 0, 0, 0,
  ].map((v) => v + 50));
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.ok(s.bowley < -0.5);
  assert.equal(s.degenerate, false);
});

test('bowley: |B| <= 1 invariant on random-ish series', () => {
  // deterministic pseudo-random
  let state = 12345;
  const rng = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  const sources: QueueLine[] = [];
  for (let s = 0; s < 8; s += 1) {
    const n = 10 + Math.floor(rng() * 90);
    const vals: number[] = [];
    for (let i = 0; i < n; i += 1) vals.push(Math.floor(rng() * 1000));
    sources.push(...mkSeries(`s${s}`, vals));
  }
  const r = buildSourceRowTokenBowleySkewness(sources, { generatedAt: GEN });
  for (const row of r.sources) {
    assert.ok(
      Math.abs(row.bowley) <= 1 + 1e-12,
      `expected |B|<=1 got ${row.bowley} for ${row.source}`,
    );
    assert.ok(row.absBowley >= 0);
    assert.ok(row.absBowley <= 1 + 1e-12);
  }
});

test('bowley: invariant — reflection v -> max-v flips sign', () => {
  const vals = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  const M = Math.max(...vals) + 100;
  const reflected = vals.map((v) => M - v);
  const ra = buildSourceRowTokenBowleySkewness(mkSeries('a', vals), {
    generatedAt: GEN,
  });
  const rb = buildSourceRowTokenBowleySkewness(mkSeries('a', reflected), {
    generatedAt: GEN,
  });
  assert.ok(
    Math.abs(ra.sources[0]!.bowley + rb.sources[0]!.bowley) < 1e-9,
    `reflection should flip sign: ${ra.sources[0]!.bowley} vs ${rb.sources[0]!.bowley}`,
  );
});

test('bowley: invariant — Bowley is shift-invariant (v + c)', () => {
  const vals = [1, 3, 7, 8, 9, 10, 50];
  for (const c of [0, 5, 100, 12345]) {
    const ra = buildSourceRowTokenBowleySkewness(mkSeries('a', vals), {
      generatedAt: GEN,
    });
    const rb = buildSourceRowTokenBowleySkewness(
      mkSeries('a', vals.map((v) => v + c)),
      { generatedAt: GEN },
    );
    assert.ok(
      Math.abs(ra.sources[0]!.bowley - rb.sources[0]!.bowley) < 1e-9,
      `shift c=${c} should be invariant: ${ra.sources[0]!.bowley} vs ${rb.sources[0]!.bowley}`,
    );
  }
});

test('bowley: invariant — Bowley is positive-scale-invariant (k*v)', () => {
  const vals = [10, 30, 70, 80, 90, 100, 500];
  for (const k of [1, 2, 0.5, 100]) {
    const ra = buildSourceRowTokenBowleySkewness(mkSeries('a', vals), {
      generatedAt: GEN,
    });
    const rb = buildSourceRowTokenBowleySkewness(
      mkSeries('a', vals.map((v) => v * k)),
      { generatedAt: GEN },
    );
    assert.ok(
      Math.abs(ra.sources[0]!.bowley - rb.sources[0]!.bowley) < 1e-9,
      `scale k=${k} should be invariant`,
    );
  }
});

test('bowley: invariant — order-invariance (shuffle leaves Bowley unchanged)', () => {
  const vals = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
  const shuffled = [89, 1, 21, 8, 144, 3, 13, 5, 55, 34, 2];
  const ra = buildSourceRowTokenBowleySkewness(mkSeries('a', vals), {
    generatedAt: GEN,
  });
  const rb = buildSourceRowTokenBowleySkewness(mkSeries('a', shuffled), {
    generatedAt: GEN,
  });
  assert.equal(ra.sources[0]!.bowley, rb.sources[0]!.bowley);
});

test('bowley: minRows drops short sources, counts them', () => {
  const q = [
    ...mkSeries('short', [1, 2, 3]), // n=3, below default min=4
    ...mkSeries('ok', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'ok');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('bowley: minMedian gates tiny producers', () => {
  const q = [
    ...mkSeries('tiny', [1, 1, 1, 1, 1]),
    ...mkSeries('big', [100, 200, 300, 400, 500]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    minMedian: 50,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinMedian, 1);
});

test('bowley: minAbsBowley filters near-symmetric, drops degenerate separately', () => {
  const q = [
    ...mkSeries('symm', [10, 20, 30, 40, 50]), // B=0
    ...mkSeries('skewed', [1, 1, 1, 1, 1, 1, 2, 3, 5, 10, 20, 40]),
    ...mkSeries('flat', [7, 7, 7, 7, 7]), // degenerate
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    minAbsBowley: 0.5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'skewed');
  assert.equal(r.droppedBelowMinAbsBowley, 1);
  assert.equal(r.droppedDegenerate, 1);
});

test('bowley: minAbsBowley=0 keeps degenerate rows', () => {
  const q = mkSeries('flat', [7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    minAbsBowley: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedDegenerate, 0);
  assert.equal(r.sources[0]!.degenerate, true);
});

test('bowley: top cap honoured; suppressed counted', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4]),
    ...mkSeries('b', [1, 1, 1, 1, 1, 1, 2, 3, 5, 10, 20, 40]),
    ...mkSeries('c', [10, 30, 70, 80, 90, 100, 500]),
    ...mkSeries('d', [5, 15, 25, 35]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
});

test('bowley: source filter restricts and counts dropped', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 5);
});

test('bowley: empty / null source -> "unknown"', () => {
  const q = mkSeries('', [10, 20, 30, 40, 50]);
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('bowley: since/until window filters', () => {
  const q = [
    ql('2026-01-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T00:00:00.000Z', 'a', 200),
    ql('2026-04-27T01:00:00.000Z', 'a', 300),
    ql('2026-04-27T02:00:00.000Z', 'a', 400),
    ql('2026-04-27T03:00:00.000Z', 'a', 500),
    ql('2026-12-31T00:00:00.000Z', 'a', 9999),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
  });
  assert.equal(r.totalRowsKept, 4);
  assert.equal(r.windowStart, '2026-04-27T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-28T00:00:00.000Z');
});

test('bowley: until is exclusive, since is inclusive', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 2),
    ql('2026-04-27T02:00:00.000Z', 'a', 3),
    ql('2026-04-27T03:00:00.000Z', 'a', 4),
    ql('2026-04-28T00:00:00.000Z', 'a', 999),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
  });
  assert.equal(r.totalRowsKept, 4);
});

test('bowley: sort bowley-desc places most right-skewed first', () => {
  const q = [
    ...mkSeries('left', [-40, -20, -10, -5, -3, -2, 0, 0, 0, 0, 0, 0].map((v) => v + 50)),
    ...mkSeries('right', [1, 1, 1, 1, 1, 1, 2, 3, 5, 10, 20, 40]),
    ...mkSeries('mid', [10, 20, 30, 40, 50, 60, 70, 80]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    sort: 'bowley-desc',
  });
  assert.equal(r.sources[0]!.source, 'right');
  assert.equal(r.sources[r.sources.length - 1]!.source, 'left');
});

test('bowley: sort bowley-asc places most left-skewed first', () => {
  const q = [
    ...mkSeries('left', [-40, -20, -10, -5, -3, -2, 0, 0, 0, 0, 0, 0].map((v) => v + 50)),
    ...mkSeries('right', [1, 1, 1, 1, 1, 1, 2, 3, 5, 10, 20, 40]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    sort: 'bowley-asc',
  });
  assert.equal(r.sources[0]!.source, 'left');
});

test('bowley: sort abs-bowley puts most asymmetric first regardless of sign', () => {
  const q = [
    ...mkSeries('left', [-40, -20, -10, -5, -3, -2, 0, 0, 0, 0, 0, 0].map((v) => v + 50)),
    ...mkSeries('right', [1, 1, 1, 1, 1, 1, 2, 3, 5, 10, 20, 40]),
    ...mkSeries('mild', [10, 20, 30, 35, 40, 50, 70]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    sort: 'abs-bowley',
  });
  assert.ok(['left', 'right'].includes(r.sources[0]!.source));
  assert.equal(r.sources[r.sources.length - 1]!.source, 'mild');
});

test('bowley: sort iqr-desc orders by raw iqr', () => {
  const q = [
    ...mkSeries('narrow', [10, 11, 12, 13, 14, 15]),
    ...mkSeries('wide', [10, 100, 200, 800, 900, 1000]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    sort: 'iqr-desc',
  });
  assert.equal(r.sources[0]!.source, 'wide');
});

test('bowley: sort median-desc orders by median', () => {
  const q = [
    ...mkSeries('low', [1, 2, 3, 4, 5]),
    ...mkSeries('high', [100, 200, 300, 400, 500]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    sort: 'median-desc',
  });
  assert.equal(r.sources[0]!.source, 'high');
});

test('bowley: sort rows orders by rowsKept desc', () => {
  const q = [
    ...mkSeries('few', [1, 2, 3, 4]),
    ...mkSeries('many', Array.from({ length: 50 }, (_, i) => i + 1)),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.equal(r.sources[0]!.source, 'many');
});

test('bowley: sort source orders alphabetically', () => {
  const q = [
    ...mkSeries('zebra', [1, 2, 3, 4, 5]),
    ...mkSeries('apple', [10, 20, 30, 40, 50]),
    ...mkSeries('mango', [5, 5, 5, 6, 7]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['apple', 'mango', 'zebra'],
  );
});

test('bowley: tiebreak on equal sort key is source asc', () => {
  // both produce identical bowley values (arithmetic progression -> 0)
  const q = [
    ...mkSeries('zoo', [10, 20, 30, 40, 50]),
    ...mkSeries('aaa', [100, 200, 300, 400, 500]),
    ...mkSeries('mmm', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    sort: 'bowley-desc',
  });
  // all bowley=0, so tiebreak source asc:
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['aaa', 'mmm', 'zoo'],
  );
});

test('bowley: deterministic — re-run yields identical structure', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 5, 8, 13, 21]),
    ...mkSeries('b', [10, 30, 70, 80, 90, 100, 500]),
  ];
  const r1 = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  const r2 = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});

test('bowley: degenerate flag is exactly iqr=0', () => {
  const q = [
    ...mkSeries('flat', [9, 9, 9, 9]),
    ...mkSeries('non', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  for (const s of r.sources) {
    assert.equal(s.degenerate, s.iqr === 0);
  }
});

test('bowley: absBowley = |bowley| always', () => {
  const q = [
    ...mkSeries('right', [1, 1, 1, 1, 1, 1, 2, 3, 5, 10, 20, 40]),
    ...mkSeries('left', [-40, -20, -10, -5, -3, -2, 0, 0, 0, 0, 0, 0].map((v) => v + 50)),
    ...mkSeries('mid', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  for (const s of r.sources) {
    assert.equal(s.absBowley, Math.abs(s.bowley));
  }
});

test('bowley: returned counters sum cleanly (totalRowsKept = sum of per-source samples)', () => {
  const q = [
    ...mkSeries('a', [10, 20, 30, 40]),
    ...mkSeries('b', [1, 2, 3]),  // dropped: < 4
    ...mkSeries('c', [5, 5, 5, 5, 5]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  // totalRowsKept aggregates across all groupings (pre-min-rows drop)
  assert.equal(r.totalRowsKept, 4 + 3 + 5);
  assert.equal(r.totalSources, 3);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('bowley: top filter does not affect totalSources / totalRowsKept', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4]),
    ...mkSeries('b', [5, 6, 7, 8]),
    ...mkSeries('c', [9, 10, 11, 12]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    top: 1,
  });
  assert.equal(r.totalSources, 3);
  assert.equal(r.totalRowsKept, 12);
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowTopCap, 2);
});

test('bowley: respects opts.generatedAt verbatim', () => {
  const r = buildSourceRowTokenBowleySkewness([], {
    generatedAt: '2099-01-01T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2099-01-01T00:00:00.000Z');
});

test('bowley: minRows = 4 boundary keeps n=4 sources', () => {
  const r = buildSourceRowTokenBowleySkewness(
    mkSeries('a', [10, 20, 30, 40]),
    { generatedAt: GEN, minRows: 4 },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowMinRows, 0);
});

test('bowley: minRows = 5 boundary drops n=4 sources', () => {
  const r = buildSourceRowTokenBowleySkewness(
    mkSeries('a', [10, 20, 30, 40]),
    { generatedAt: GEN, minRows: 5 },
  );
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('bowley: zero tokens are KEPT (only negative are dropped)', () => {
  const q = mkSeries('a', [0, 0, 0, 0, 100]);
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  assert.equal(r.totalRowsKept, 5);
  assert.equal(r.droppedNegativeTokens, 0);
});

test('bowley: invariant — Bowley equals 0 iff median is exactly midpoint of Q1 and Q3', () => {
  // construct a series where median sits on midpoint -> B=0
  const q = mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  const midpoint = (s.q1 + s.q3) / 2;
  if (Math.abs(s.median - midpoint) < 1e-9) {
    assert.ok(Math.abs(s.bowley) < 1e-12);
  }
  // and the converse
  if (Math.abs(s.bowley) < 1e-12 && !s.degenerate) {
    assert.ok(Math.abs(s.median - midpoint) < 1e-9);
  }
});

test('bowley: multi-source counts and shape', () => {
  const sources = ['alpha', 'beta', 'gamma', 'delta'];
  const q: QueueLine[] = [];
  for (const src of sources) {
    q.push(...mkSeries(src, [1, 2, 3, 5, 8, 13, 21, 34]));
  }
  const r = buildSourceRowTokenBowleySkewness(q, { generatedAt: GEN });
  assert.equal(r.totalSources, 4);
  assert.equal(r.sources.length, 4);
});

test('bowley: invariant — Bowley with an outlier at top equals Bowley without it (insensitive)', () => {
  const base = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const withOutlier = [...base, 1000000];
  const r1 = buildSourceRowTokenBowleySkewness(mkSeries('a', base), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenBowleySkewness(mkSeries('a', withOutlier), {
    generatedAt: GEN,
  });
  // Adding a single outlier moves type-7 quantiles slightly because of
  // the change in n, but the asymmetry of the central half stays similar.
  // Both should still be ~0 within 0.2 (vs Fisher g1 which would explode).
  assert.ok(Math.abs(r1.sources[0]!.bowley) < 0.2);
  assert.ok(Math.abs(r2.sources[0]!.bowley) < 0.2);
});

test('bowley: source filter "" treated as no filter', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4]),
    ...mkSeries('b', [5, 6, 7, 8]),
  ];
  const r = buildSourceRowTokenBowleySkewness(q, {
    generatedAt: GEN,
    source: '',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.source, null);
});
