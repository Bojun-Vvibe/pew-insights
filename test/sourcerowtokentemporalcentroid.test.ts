import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenTemporalCentroid } from '../src/sourcerowtokentemporalcentroid.js';
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

function series(values: number[], src = 's'): QueueLine[] {
  return values.map((v, i) => {
    const hh = Math.floor(i / 60) % 24;
    const mm = i % 60;
    const day = 1 + Math.floor(i / (24 * 60));
    return ql(
      `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
      src,
      v,
    );
  });
}

test('temporal-centroid: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenTemporalCentroid([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'tc-desc');
  assert.equal(r.generatedAt, GEN);
});

test('temporal-centroid: uniform constant series -> tc = 0.5 (balanced)', () => {
  // a[n] = c for all n => tc_index = (N-1)/2 => tc = 0.5
  const v: number[] = new Array(16).fill(100);
  const r = buildSourceRowTokenTemporalCentroid(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.rowsKept, 16);
  assert.ok(
    Math.abs(row.tc - 0.5) < 1e-12,
    `expected tc = 0.5 for uniform series, got ${row.tc}`,
  );
  assert.ok(
    Math.abs(row.tcIndex - 7.5) < 1e-12,
    `expected tcIndex = 7.5 for N=16 uniform, got ${row.tcIndex}`,
  );
});

test('temporal-centroid: front-loaded series -> tc < 0.5', () => {
  // big spike at n=0, then tiny tails
  const v = [10000, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const r = buildSourceRowTokenTemporalCentroid(series(v), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(
    row.tc < 0.05,
    `expected tc << 0.5 for front-loaded series, got ${row.tc}`,
  );
});

test('temporal-centroid: back-loaded series -> tc > 0.5', () => {
  // tiny head, big spike at n=N-1
  const v = [1, 1, 1, 1, 1, 1, 1, 1, 1, 10000];
  const r = buildSourceRowTokenTemporalCentroid(series(v), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(
    row.tc > 0.95,
    `expected tc >> 0.5 for back-loaded series, got ${row.tc}`,
  );
});

test('temporal-centroid: linearly-increasing ramp -> tc = 2/3 of (N-1)/(N-1) for n*1 weighting (i.e. tc = (2N-1)/(3(N-1)) approx 2/3 for large N)', () => {
  // a[n] = n+1; sum n*(n+1) / sum (n+1).
  // For N=10: numer = sum n=0..9 of n*(n+1) = 0+2+6+12+20+30+42+56+72+90 = 330
  //          denom = sum n=0..9 of (n+1)   = 55
  // tc_index = 330/55 = 6; tc = 6/9 = 0.6666...
  const v: number[] = [];
  for (let i = 0; i < 10; i++) v.push(i + 1);
  const r = buildSourceRowTokenTemporalCentroid(series(v), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(
    Math.abs(row.tcIndex - 6) < 1e-9,
    `expected tcIndex=6 for ramp, got ${row.tcIndex}`,
  );
  assert.ok(
    Math.abs(row.tc - 6 / 9) < 1e-9,
    `expected tc = 2/3 for N=10 ramp, got ${row.tc}`,
  );
});

test('temporal-centroid: drops series below minRows', () => {
  const v = [1, 2, 3, 4, 5];
  const r = buildSourceRowTokenTemporalCentroid(series(v), {
    generatedAt: GEN,
    minRows: 8,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalRowsKept, 5);
});

test('temporal-centroid: all-zero series -> droppedZeroSeries', () => {
  const v: number[] = new Array(10).fill(0);
  const r = buildSourceRowTokenTemporalCentroid(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroSeries, 1);
});

test('temporal-centroid: drops invalid hour_start, invalid total_tokens, negative total_tokens', () => {
  const q: QueueLine[] = [
    ql('not-an-iso', 'a', 100),
    ql('2026-04-01T00:00:00Z', 'a', Number.NaN),
    ql('2026-04-01T01:00:00Z', 'a', -5),
    ql('2026-04-01T02:00:00Z', 'a', 100),
  ];
  const r = buildSourceRowTokenTemporalCentroid(q, {
    generatedAt: GEN,
    minRows: 2,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  // only one valid row remains -> below minRows of 2
  assert.equal(r.totalRowsKept, 1);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('temporal-centroid: source filter routes non-matching rows to droppedSourceFilter', () => {
  const q: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'keep'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'skip'),
  ];
  const r = buildSourceRowTokenTemporalCentroid(q, {
    generatedAt: GEN,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 8);
  assert.equal(r.source, 'keep');
});

test('temporal-centroid: sort tc-desc puts most back-loaded first; tc-asc reverses', () => {
  const front = series([10000, 1, 1, 1, 1, 1, 1, 1, 1, 1], 'front');
  const back = series([1, 1, 1, 1, 1, 1, 1, 1, 1, 10000], 'back');
  const balanced = series(new Array(10).fill(50), 'balanced');
  const all = [...front, ...back, ...balanced];

  const desc = buildSourceRowTokenTemporalCentroid(all, {
    generatedAt: GEN,
    sort: 'tc-desc',
  });
  assert.equal(desc.sources[0]!.source, 'back');
  assert.equal(desc.sources[2]!.source, 'front');

  const asc = buildSourceRowTokenTemporalCentroid(all, {
    generatedAt: GEN,
    sort: 'tc-asc',
  });
  assert.equal(asc.sources[0]!.source, 'front');
  assert.equal(asc.sources[2]!.source, 'back');
});

test('temporal-centroid: top cap clamps and reports droppedBelowTopCap', () => {
  const a = series(new Array(8).fill(1), 'a');
  const b = series(new Array(8).fill(1), 'b');
  const c = series(new Array(8).fill(1), 'c');
  const r = buildSourceRowTokenTemporalCentroid([...a, ...b, ...c], {
    generatedAt: GEN,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.top, 2);
});

test('temporal-centroid: invalid minRows throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenTemporalCentroid([], {
        generatedAt: GEN,
        minRows: 1,
      }),
    /minRows must be an integer >= 2/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenTemporalCentroid([], {
        generatedAt: GEN,
        minRows: 2.5,
      }),
    /minRows must be an integer/,
  );
});

test('temporal-centroid: invalid top and sort throw', () => {
  assert.throws(
    () =>
      buildSourceRowTokenTemporalCentroid([], {
        generatedAt: GEN,
        top: 0,
      }),
    /top must be a positive integer/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenTemporalCentroid([], {
        generatedAt: GEN,
        // @ts-expect-error
        sort: 'bogus',
      }),
    /sort must be one of/,
  );
});

test('temporal-centroid: invalid since/until throw', () => {
  assert.throws(
    () =>
      buildSourceRowTokenTemporalCentroid([], {
        generatedAt: GEN,
        since: 'not-a-date',
      }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenTemporalCentroid([], {
        generatedAt: GEN,
        until: 'also-not',
      }),
    /invalid until/,
  );
});

test('temporal-centroid: tc is in [0,1] and tcIndex is in [0,N-1] for varied series', () => {
  const cases: number[][] = [
    new Array(20).fill(1),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    [5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1],
  ];
  for (const v of cases) {
    const r = buildSourceRowTokenTemporalCentroid(series(v), {
      generatedAt: GEN,
    });
    assert.equal(r.sources.length, 1);
    const row = r.sources[0]!;
    assert.ok(row.tc >= 0 && row.tc <= 1, `tc out of [0,1]: ${row.tc}`);
    assert.ok(
      row.tcIndex >= 0 && row.tcIndex <= row.rowsKept - 1,
      `tcIndex out of [0,N-1]: ${row.tcIndex} for N=${row.rowsKept}`,
    );
  }
});

test('temporal-centroid: time-shift is NOT invariant — prepending zero rows shifts tc down (more front-loaded)', () => {
  const base = [1, 1, 1, 1, 10, 10, 10, 10];
  const shifted = [0, 0, 0, 0, 0, 0, 0, 0, ...base];
  const rBase = buildSourceRowTokenTemporalCentroid(series(base, 'a'), {
    generatedAt: GEN,
    minRows: 2,
  });
  const rShifted = buildSourceRowTokenTemporalCentroid(series(shifted, 'b'), {
    generatedAt: GEN,
    minRows: 2,
  });
  // Same energy mass but pushed later in row index in the shifted version
  // (zeros prepended). So shifted tc should be > base tc.
  assert.ok(
    rShifted.sources[0]!.tc > rBase.sources[0]!.tc,
    `shifted tc (${rShifted.sources[0]!.tc}) should exceed base tc (${rBase.sources[0]!.tc})`,
  );
});
