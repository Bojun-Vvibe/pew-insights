import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenTemporalSpread } from '../src/sourcerowtokentemporalspread.js';
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

test('temporal-spread: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenTemporalSpread([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'ts-desc');
  assert.equal(r.generatedAt, GEN);
});

test('temporal-spread: impulse series (all mass at one row) -> ts = 0', () => {
  const v = new Array(16).fill(0);
  v[7] = 100;
  const r = buildSourceRowTokenTemporalSpread(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.ts < 1e-12, `expected ts ~= 0 for impulse, got ${row.ts}`);
  assert.ok(
    Math.abs(row.tcIndex - 7) < 1e-12,
    `expected tcIndex = 7 for spike at row 7, got ${row.tcIndex}`,
  );
});

test('temporal-spread: max-bimodal series (mass at row 0 and row N-1) -> ts ~= 0.5', () => {
  // mass split equally between row 0 and row N-1 -> tc=0.5, ts=0.5 normalized
  const v: number[] = new Array(10).fill(0);
  v[0] = 100;
  v[9] = 100;
  const r = buildSourceRowTokenTemporalSpread(series(v), { generatedAt: GEN });
  const row = r.sources[0]!;
  // tc = (0*100 + 9*100) / 200 = 4.5; ts_index = sqrt(((0-4.5)^2*100 + (9-4.5)^2*100)/200) = 4.5
  // ts = 4.5 / 9 = 0.5
  assert.ok(
    Math.abs(row.ts - 0.5) < 1e-12,
    `expected ts = 0.5 for max-bimodal split, got ${row.ts}`,
  );
  assert.ok(
    Math.abs(row.tcIndex - 4.5) < 1e-12,
    `expected tcIndex = 4.5, got ${row.tcIndex}`,
  );
  assert.ok(
    Math.abs(row.tsIndex - 4.5) < 1e-12,
    `expected tsIndex = 4.5, got ${row.tsIndex}`,
  );
});

test('temporal-spread: uniform constant series -> ts = std of discrete uniform / (N-1)', () => {
  // For uniform a[n]=c on n=0..N-1: tc=(N-1)/2, var = (N^2-1)/12,
  // ts_index = sqrt((N^2-1)/12), ts = sqrt((N+1)/(12*(N-1)))
  const N = 16;
  const v: number[] = new Array(N).fill(100);
  const r = buildSourceRowTokenTemporalSpread(series(v), { generatedAt: GEN });
  const row = r.sources[0]!;
  const expectedTsIndex = Math.sqrt((N * N - 1) / 12);
  const expectedTs = expectedTsIndex / (N - 1);
  assert.ok(
    Math.abs(row.tsIndex - expectedTsIndex) < 1e-9,
    `expected tsIndex = ${expectedTsIndex}, got ${row.tsIndex}`,
  );
  assert.ok(
    Math.abs(row.ts - expectedTs) < 1e-9,
    `expected ts = ${expectedTs}, got ${row.ts}`,
  );
  // For large N this approaches 1/sqrt(12) ~= 0.2887
  assert.ok(row.ts < 0.32 && row.ts > 0.28, `ts ~ 1/sqrt(12), got ${row.ts}`);
});

test('temporal-spread: tighter cluster has smaller ts than smeared mass at same tc', () => {
  // Both series centered at index 5, but one is tightly clustered, one is smeared.
  const tight: number[] = new Array(11).fill(0);
  tight[5] = 100;
  const smeared: number[] = new Array(11).fill(10); // uniform => tc=5
  const all = [...series(tight, 'tight'), ...series(smeared, 'smear')];
  const r = buildSourceRowTokenTemporalSpread(all, { generatedAt: GEN });
  const tightRow = r.sources.find((s) => s.source === 'tight')!;
  const smearRow = r.sources.find((s) => s.source === 'smear')!;
  assert.ok(
    Math.abs(tightRow.tcIndex - 5) < 1e-9 &&
      Math.abs(smearRow.tcIndex - 5) < 1e-9,
    `both should have tc=5; got tight=${tightRow.tcIndex}, smear=${smearRow.tcIndex}`,
  );
  assert.ok(
    tightRow.ts < smearRow.ts,
    `tight ts (${tightRow.ts}) should be < smear ts (${smearRow.ts})`,
  );
});

test('temporal-spread: drops series below minRows', () => {
  const v = [1, 2, 3, 4, 5];
  const r = buildSourceRowTokenTemporalSpread(series(v), {
    generatedAt: GEN,
    minRows: 8,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalRowsKept, 5);
});

test('temporal-spread: all-zero series -> droppedZeroSeries', () => {
  const v: number[] = new Array(10).fill(0);
  const r = buildSourceRowTokenTemporalSpread(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroSeries, 1);
});

test('temporal-spread: drops invalid hour_start, invalid total_tokens, negative total_tokens', () => {
  const q: QueueLine[] = [
    ql('not-an-iso', 'a', 100),
    ql('2026-04-01T00:00:00Z', 'a', Number.NaN),
    ql('2026-04-01T01:00:00Z', 'a', -5),
    ql('2026-04-01T02:00:00Z', 'a', 100),
    ql('2026-04-01T03:00:00Z', 'a', 200),
  ];
  const r = buildSourceRowTokenTemporalSpread(q, {
    generatedAt: GEN,
    minRows: 2,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.totalRowsKept, 2);
  assert.equal(r.sources.length, 1);
});

test('temporal-spread: source filter routes non-matching rows to droppedSourceFilter', () => {
  const q: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'keep'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'skip'),
  ];
  const r = buildSourceRowTokenTemporalSpread(q, {
    generatedAt: GEN,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 8);
  assert.equal(r.source, 'keep');
});

test('temporal-spread: sort ts-desc puts widest first; ts-asc reverses', () => {
  const tight: number[] = new Array(10).fill(0);
  tight[5] = 100;
  const smeared: number[] = new Array(10).fill(10);
  const bimodal: number[] = new Array(10).fill(0);
  bimodal[0] = 100;
  bimodal[9] = 100;
  const all = [
    ...series(tight, 'tight'),
    ...series(smeared, 'smear'),
    ...series(bimodal, 'bimodal'),
  ];

  const desc = buildSourceRowTokenTemporalSpread(all, {
    generatedAt: GEN,
    sort: 'ts-desc',
  });
  assert.equal(desc.sources[0]!.source, 'bimodal');
  assert.equal(desc.sources[2]!.source, 'tight');

  const asc = buildSourceRowTokenTemporalSpread(all, {
    generatedAt: GEN,
    sort: 'ts-asc',
  });
  assert.equal(asc.sources[0]!.source, 'tight');
  assert.equal(asc.sources[2]!.source, 'bimodal');
});

test('temporal-spread: top cap clamps and reports droppedBelowTopCap', () => {
  const a = series(new Array(8).fill(1), 'a');
  const b = series(new Array(8).fill(1), 'b');
  const c = series(new Array(8).fill(1), 'c');
  const r = buildSourceRowTokenTemporalSpread([...a, ...b, ...c], {
    generatedAt: GEN,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.top, 2);
});

test('temporal-spread: invalid minRows throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenTemporalSpread([], {
        generatedAt: GEN,
        minRows: 1,
      }),
    /minRows must be an integer >= 2/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenTemporalSpread([], {
        generatedAt: GEN,
        minRows: 2.5,
      }),
    /minRows must be an integer/,
  );
});

test('temporal-spread: invalid top and sort throw', () => {
  assert.throws(
    () =>
      buildSourceRowTokenTemporalSpread([], {
        generatedAt: GEN,
        top: 0,
      }),
    /top must be a positive integer/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenTemporalSpread([], {
        generatedAt: GEN,
        // @ts-expect-error
        sort: 'bogus',
      }),
    /sort must be one of/,
  );
});

test('temporal-spread: invalid since/until throw', () => {
  assert.throws(
    () =>
      buildSourceRowTokenTemporalSpread([], {
        generatedAt: GEN,
        since: 'not-a-date',
      }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenTemporalSpread([], {
        generatedAt: GEN,
        until: 'also-not',
      }),
    /invalid until/,
  );
});

test('temporal-spread: ts is in [0, 0.5] for varied series', () => {
  const cases: number[][] = [
    new Array(20).fill(1),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    [5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1],
    [100, 0, 0, 0, 0, 0, 0, 0, 0, 100],
  ];
  for (const v of cases) {
    const r = buildSourceRowTokenTemporalSpread(series(v), { generatedAt: GEN });
    assert.equal(r.sources.length, 1);
    const row = r.sources[0]!;
    assert.ok(
      row.ts >= 0 && row.ts <= 0.5 + 1e-9,
      `ts out of [0, 0.5]: ${row.ts}`,
    );
    assert.ok(
      row.tsIndex >= 0 && row.tsIndex <= (row.rowsKept - 1) / 2 + 1e-9,
      `tsIndex out of [0, (N-1)/2]: ${row.tsIndex} for N=${row.rowsKept}`,
    );
  }
});

test('temporal-spread: time-shift is NOT invariant — prepending zero rows changes ts', () => {
  const base = [1, 1, 1, 1, 10, 10, 10, 10];
  const shifted = [0, 0, 0, 0, 0, 0, 0, 0, ...base];
  const rBase = buildSourceRowTokenTemporalSpread(series(base, 'a'), {
    generatedAt: GEN,
    minRows: 2,
  });
  const rShifted = buildSourceRowTokenTemporalSpread(series(shifted, 'b'), {
    generatedAt: GEN,
    minRows: 2,
  });
  assert.notEqual(
    rBase.sources[0]!.ts,
    rShifted.sources[0]!.ts,
    `ts should differ between base and shifted; both got ${rBase.sources[0]!.ts}`,
  );
});

test('temporal-spread: known closed-form — ramp a[n]=n+1 for N=4', () => {
  // a = [1,2,3,4]; sum_a = 10; weighted_sum = 0+2+6+12 = 20; tc=2.0
  // m2 = 1*(0-2)^2 + 2*(1-2)^2 + 3*(2-2)^2 + 4*(3-2)^2 = 4+2+0+4 = 10
  // var = 10/10 = 1; tsIndex = 1; ts = 1/3
  const r = buildSourceRowTokenTemporalSpread(series([1, 2, 3, 4]), {
    generatedAt: GEN,
    minRows: 2,
  });
  const row = r.sources[0]!;
  assert.ok(
    Math.abs(row.tcIndex - 2) < 1e-12,
    `expected tcIndex=2, got ${row.tcIndex}`,
  );
  assert.ok(
    Math.abs(row.tsIndex - 1) < 1e-12,
    `expected tsIndex=1, got ${row.tsIndex}`,
  );
  assert.ok(
    Math.abs(row.ts - 1 / 3) < 1e-12,
    `expected ts=1/3, got ${row.ts}`,
  );
});

test('temporal-spread: sort tiebreak is source asc across all sort modes (deterministic order)', () => {
  // Three identical-shape sources -> identical ts -> tie. Tiebreak: source asc.
  const a = series(new Array(10).fill(50), 'aaa');
  const b = series(new Array(10).fill(50), 'bbb');
  const c = series(new Array(10).fill(50), 'ccc');
  for (const sort of ['ts-desc', 'ts-asc', 'ts-index-desc', 'ts-index-asc', 'rows', 'source'] as const) {
    const r = buildSourceRowTokenTemporalSpread([...c, ...a, ...b], {
      generatedAt: GEN,
      sort,
    });
    assert.deepEqual(
      r.sources.map((s) => s.source),
      ['aaa', 'bbb', 'ccc'],
      `sort ${sort} did not produce stable source-asc tiebreak`,
    );
  }
});

test('temporal-spread: ts-index-desc orders by raw row-index magnitude (size-aware)', () => {
  // Two uniform series with different N -> same ts (shape) but different tsIndex.
  const small = series(new Array(8).fill(10), 'small');
  const big = series(new Array(40).fill(10), 'big');
  const r = buildSourceRowTokenTemporalSpread([...small, ...big], {
    generatedAt: GEN,
    sort: 'ts-index-desc',
  });
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.sources[1]!.source, 'small');

  const r2 = buildSourceRowTokenTemporalSpread([...small, ...big], {
    generatedAt: GEN,
    sort: 'ts-index-asc',
  });
  assert.equal(r2.sources[0]!.source, 'small');
  assert.equal(r2.sources[1]!.source, 'big');
});

test('temporal-spread: invariant — every emitted row has ts in [0, 0.5] and tsIndex in [0, (N-1)/2] (random sweep)', () => {
  let s = 9876543;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const sources: QueueLine[] = [];
  for (let k = 0; k < 12; k++) {
    const n = 8 + Math.floor(rand() * 40);
    const v: number[] = [];
    for (let i = 0; i < n; i++) v.push(Math.floor(rand() * 1000));
    sources.push(...series(v, `src${k}`));
  }
  const r = buildSourceRowTokenTemporalSpread(sources, {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.ok(r.sources.length >= 10);
  for (const row of r.sources) {
    assert.ok(
      row.ts >= 0 && row.ts <= 0.5 + 1e-9,
      `INVARIANT BROKEN: ts=${row.ts} out of [0, 0.5] for ${row.source}`,
    );
    assert.ok(
      row.tsIndex >= 0 && row.tsIndex <= (row.rowsKept - 1) / 2 + 1e-9,
      `INVARIANT BROKEN: tsIndex=${row.tsIndex} out of [0, (N-1)/2] for ${row.source}`,
    );
    assert.ok(
      Math.abs(row.tsIndex - row.ts * (row.rowsKept - 1)) < 1e-9,
      `INVARIANT BROKEN: tsIndex (${row.tsIndex}) != ts*(N-1) (${row.ts * (row.rowsKept - 1)})`,
    );
  }
});

test('temporal-spread: windowing with --since changes ts (re-anchored row index)', () => {
  // 20 rows: front half low, back half high. Full window: tc back-loaded, ts moderate.
  // Windowed to back half only: uniform (all 1000s) -> ts = sqrt((N+1)/(12(N-1)))
  const lows = new Array(10).fill(1);
  const highs = new Array(10).fill(1000);
  const all = [...lows, ...highs];
  const series20 = series(all, 'src');

  const rFull = buildSourceRowTokenTemporalSpread(series20, {
    generatedAt: GEN,
  });
  const tsFull = rFull.sources[0]!.ts;

  const rWindow = buildSourceRowTokenTemporalSpread(series20, {
    generatedAt: GEN,
    since: '2026-04-01T00:10:00Z',
    minRows: 2,
  });
  const N = 10;
  const expectedTs = Math.sqrt((N + 1) / (12 * (N - 1)));
  assert.equal(rWindow.sources[0]!.rowsKept, N);
  assert.ok(
    Math.abs(rWindow.sources[0]!.ts - expectedTs) < 1e-9,
    `windowed-to-uniform ts should be ${expectedTs}; got ${rWindow.sources[0]!.ts}`,
  );
  assert.notEqual(tsFull, rWindow.sources[0]!.ts);
});
