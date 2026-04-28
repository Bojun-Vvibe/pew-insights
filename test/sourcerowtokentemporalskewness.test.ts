import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenTemporalSkewness } from '../src/sourcerowtokentemporalskewness.js';
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

// ---- Basic / shape ----

test('temporal-skewness: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenTemporalSkewness([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'ts3-desc');
  assert.equal(r.generatedAt, GEN);
});

test('temporal-skewness: uniform constant series -> ts3 = 0 (perfectly symmetric)', () => {
  const v = new Array(20).fill(100);
  const r = buildSourceRowTokenTemporalSkewness(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.ok(
    Math.abs(r.sources[0]!.ts3) < 1e-9,
    `expected ts3 ~= 0 for uniform, got ${r.sources[0]!.ts3}`,
  );
});

test('temporal-skewness: symmetric centered triangle -> ts3 = 0', () => {
  // Triangle peaking at center index — symmetric around tc = (N-1)/2
  const N = 11;
  const v: number[] = [];
  for (let i = 0; i < N; i++) {
    v.push(i <= 5 ? i + 1 : N - i);
  }
  const r = buildSourceRowTokenTemporalSkewness(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.ok(
    Math.abs(r.sources[0]!.ts3) < 1e-9,
    `expected ts3 ~= 0 for symmetric triangle, got ${r.sources[0]!.ts3}`,
  );
});

test('temporal-skewness: max-bimodal symmetric (mass at row 0 and row N-1) -> ts3 = 0', () => {
  const v = new Array(10).fill(0);
  v[0] = 100; v[9] = 100;
  const r = buildSourceRowTokenTemporalSkewness(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.ok(
    Math.abs(r.sources[0]!.ts3) < 1e-9,
    `expected ts3 ~= 0 for symmetric bimodal, got ${r.sources[0]!.ts3}`,
  );
});

// ---- Sign convention ----

test('temporal-skewness: front-loaded mass (early peak, long quiet tail) -> ts3 > 0', () => {
  // Most mass at row 0, small mass trailing through row N-1
  const v = [1000, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  const r = buildSourceRowTokenTemporalSkewness(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.ok(
    r.sources[0]!.ts3 > 0.5,
    `expected strongly positive ts3 for front-loaded mass, got ${r.sources[0]!.ts3}`,
  );
});

test('temporal-skewness: back-loaded mass (long quiet build-up, late peak) -> ts3 < 0', () => {
  // Mirror of the front-loaded case
  const v = [10, 10, 10, 10, 10, 10, 10, 10, 10, 1000];
  const r = buildSourceRowTokenTemporalSkewness(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.ok(
    r.sources[0]!.ts3 < -0.5,
    `expected strongly negative ts3 for back-loaded mass, got ${r.sources[0]!.ts3}`,
  );
});

test('temporal-skewness: mirroring rows flips sign of ts3 (with same magnitude)', () => {
  const front = [1000, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  const back = [...front].reverse();
  const r = buildSourceRowTokenTemporalSkewness(
    [...series(front, 'front'), ...series(back, 'back')],
    { generatedAt: GEN },
  );
  const f = r.sources.find((s) => s.source === 'front')!;
  const b = r.sources.find((s) => s.source === 'back')!;
  assert.ok(
    Math.abs(f.ts3 + b.ts3) < 1e-9,
    `expected mirrored series to have opposite-sign ts3 of equal magnitude, got front=${f.ts3} back=${b.ts3}`,
  );
});

// ---- Closed-form check vs amplitude-shape skewness orthogonality ----

test('temporal-skewness: order-sensitive — same multiset of amplitudes in different time order yields different ts3', () => {
  const v1 = [1000, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  const v2 = [10, 10, 10, 1000, 10, 10, 10, 10, 10, 10];
  const r = buildSourceRowTokenTemporalSkewness(
    [...series(v1, 'a'), ...series(v2, 'b')],
    { generatedAt: GEN },
  );
  const a = r.sources.find((s) => s.source === 'a')!;
  const b = r.sources.find((s) => s.source === 'b')!;
  assert.ok(
    Math.abs(a.ts3 - b.ts3) > 0.1,
    `expected different ts3 for same multiset in different order, got a=${a.ts3} b=${b.ts3}`,
  );
});

// ---- Edge cases / drops ----

test('temporal-skewness: single-row spike -> droppedZeroVariance', () => {
  const v = new Array(10).fill(0);
  v[3] = 500;
  const r = buildSourceRowTokenTemporalSkewness(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.droppedZeroSeries, 0);
});

test('temporal-skewness: all-zero series -> droppedZeroSeries (separate from zero-variance)', () => {
  const r = buildSourceRowTokenTemporalSkewness(series(new Array(10).fill(0)), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroSeries, 1);
  assert.equal(r.droppedZeroVariance, 0);
});

test('temporal-skewness: below min-rows -> droppedBelowMinRows', () => {
  const r = buildSourceRowTokenTemporalSkewness(
    series([10, 20, 30, 40, 50], 's'),
    { generatedAt: GEN, minRows: 8 },
  );
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('temporal-skewness: minRows=3 is the lowest allowed; <3 throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalSkewness([], { minRows: 2 }),
    /minRows must be an integer >= 3/,
  );
  // 3 works
  const r = buildSourceRowTokenTemporalSkewness(
    series([10, 100, 10], 's'),
    { generatedAt: GEN, minRows: 3 },
  );
  assert.equal(r.sources.length, 1);
});

test('temporal-skewness: invalid since/until throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalSkewness([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalSkewness([], { until: 'nope' }),
    /invalid until/,
  );
});

test('temporal-skewness: invalid total_tokens types are dropped', () => {
  const lines: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 100),
    ql('2026-04-01T01:00:00Z', 's', NaN),
    ql('2026-04-01T02:00:00Z', 's', -5),
  ];
  const r = buildSourceRowTokenTemporalSkewness(lines, {
    generatedAt: GEN,
    minRows: 3,
  });
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  // Only 1 row left -> below min-rows of 3
  assert.equal(r.droppedBelowMinRows, 1);
});

test('temporal-skewness: invalid hour_start surfaces in droppedInvalidHourStart', () => {
  const lines: QueueLine[] = [
    ql('not-a-date', 's', 10),
    ql('2026-04-01T00:00:00Z', 's', 10),
  ];
  const r = buildSourceRowTokenTemporalSkewness(lines, { generatedAt: GEN, minRows: 3 });
  assert.equal(r.droppedInvalidHourStart, 1);
});

// ---- Source filter / since-until ----

test('temporal-skewness: source filter restricts to single source', () => {
  const r = buildSourceRowTokenTemporalSkewness(
    [
      ...series([10, 100, 10, 10, 10, 10, 10, 10], 'a'),
      ...series([10, 10, 10, 10, 10, 10, 100, 10], 'b'),
    ],
    { generatedAt: GEN, source: 'a' },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('temporal-skewness: since/until window filter', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 16; i++) {
    lines.push(ql(`2026-04-01T${i.toString().padStart(2, '0')}:00:00Z`, 's', 10 + i));
  }
  const r = buildSourceRowTokenTemporalSkewness(lines, {
    generatedAt: GEN,
    since: '2026-04-01T04:00:00Z',
    until: '2026-04-01T12:00:00Z',
  });
  // 8 rows kept (hours 4..11)
  assert.equal(r.totalRowsKept, 8);
});

// ---- Sort ----

test('temporal-skewness: sort ts3-desc puts most front-loaded first', () => {
  const front = [1000, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  const back = [...front].reverse();
  const sym = new Array(10).fill(50);
  const r = buildSourceRowTokenTemporalSkewness(
    [...series(front, 'front'), ...series(back, 'back'), ...series(sym, 'sym')],
    { generatedAt: GEN, sort: 'ts3-desc' },
  );
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['front', 'sym', 'back'],
  );
});

test('temporal-skewness: sort ts3-asc puts most back-loaded first', () => {
  const front = [1000, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  const back = [...front].reverse();
  const sym = new Array(10).fill(50);
  const r = buildSourceRowTokenTemporalSkewness(
    [...series(front, 'front'), ...series(back, 'back'), ...series(sym, 'sym')],
    { generatedAt: GEN, sort: 'ts3-asc' },
  );
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['back', 'sym', 'front'],
  );
});

test('temporal-skewness: sort abs-ts3-desc puts most asymmetric (any sign) first', () => {
  const front = [1000, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  const back = [...front].reverse();
  const sym = new Array(10).fill(50);
  const r = buildSourceRowTokenTemporalSkewness(
    [...series(front, 'front'), ...series(back, 'back'), ...series(sym, 'sym')],
    { generatedAt: GEN, sort: 'abs-ts3-desc' },
  );
  // front and back have equal |ts3|; tiebreak source asc -> back, front; sym last
  assert.equal(r.sources[2]!.source, 'sym');
  assert.deepEqual(
    r.sources.slice(0, 2).map((s) => s.source).sort(),
    ['back', 'front'],
  );
});

test('temporal-skewness: sort abs-ts3-asc puts most symmetric first', () => {
  const front = [1000, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  const sym = new Array(10).fill(50);
  const r = buildSourceRowTokenTemporalSkewness(
    [...series(front, 'front'), ...series(sym, 'sym')],
    { generatedAt: GEN, sort: 'abs-ts3-asc' },
  );
  assert.equal(r.sources[0]!.source, 'sym');
});

test('temporal-skewness: sort rows orders by rowsKept desc', () => {
  const r = buildSourceRowTokenTemporalSkewness(
    [
      ...series(new Array(10).fill(50), 'a'),
      ...series(new Array(20).fill(50), 'b'),
      ...series(new Array(15).fill(50), 'c'),
    ],
    { generatedAt: GEN, sort: 'rows' },
  );
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'c', 'a'],
  );
});

test('temporal-skewness: sort source orders lex asc', () => {
  const r = buildSourceRowTokenTemporalSkewness(
    [
      ...series(new Array(10).fill(50), 'cherry'),
      ...series(new Array(10).fill(50), 'apple'),
      ...series(new Array(10).fill(50), 'banana'),
    ],
    { generatedAt: GEN, sort: 'source' },
  );
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['apple', 'banana', 'cherry'],
  );
});

test('temporal-skewness: invalid sort throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalSkewness([], { sort: 'bogus' as any }),
    /sort must be one of/,
  );
});

// ---- Top cap ----

test('temporal-skewness: top cap limits output and surfaces droppedBelowTopCap', () => {
  const sources: QueueLine[] = [];
  for (const name of ['a', 'b', 'c', 'd']) {
    sources.push(...series(new Array(10).fill(50), name));
  }
  const r = buildSourceRowTokenTemporalSkewness(sources, {
    generatedAt: GEN, top: 2, sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
});

test('temporal-skewness: top must be a positive integer', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalSkewness([], { top: 0 }),
    /top must be a positive integer/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalSkewness([], { top: 1.5 }),
    /top must be a positive integer/,
  );
});

// ---- Sort tiebreak determinism ----

test('temporal-skewness: sort tiebreak across all sort modes is source asc', () => {
  // Identical series -> identical ts3 -> tie everywhere.
  const a = series(new Array(10).fill(50), 'aaa');
  const b = series(new Array(10).fill(50), 'bbb');
  const c = series(new Array(10).fill(50), 'ccc');
  for (const sort of [
    'ts3-desc', 'ts3-asc', 'abs-ts3-desc', 'abs-ts3-asc', 'rows', 'source',
  ] as const) {
    const r = buildSourceRowTokenTemporalSkewness(
      [...c, ...a, ...b],
      { generatedAt: GEN, sort },
    );
    assert.deepEqual(
      r.sources.map((s) => s.source),
      ['aaa', 'bbb', 'ccc'],
      `sort ${sort} did not produce stable source-asc tiebreak`,
    );
  }
});

// ---- Invariant pin ----

test('temporal-skewness: invariant pin — for each emitted row, ts3 == m3/ts_index^3 recomputed from scratch', () => {
  let s = 313131;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const allLines: QueueLine[] = [];
  const truth: Map<string, number[]> = new Map();
  for (let k = 0; k < 12; k++) {
    const n = 8 + Math.floor(rand() * 30);
    const vals: number[] = [];
    for (let i = 0; i < n; i++) vals.push(Math.floor(rand() * 500));
    const name = `inv${k}`;
    truth.set(name, vals);
    allLines.push(...series(vals, name));
  }
  const r = buildSourceRowTokenTemporalSkewness(allLines, { generatedAt: GEN, minRows: 4 });
  for (const row of r.sources) {
    const vals = truth.get(row.source)!;
    let amp = 0, ws = 0;
    for (let i = 0; i < vals.length; i++) { amp += vals[i]!; ws += i * vals[i]!; }
    if (amp <= 0) continue;
    const tcRef = ws / amp;
    let m2 = 0, m3 = 0;
    for (let i = 0; i < vals.length; i++) {
      const d = i - tcRef;
      m2 += d * d * vals[i]!;
      m3 += d * d * d * vals[i]!;
    }
    const tsRef = Math.sqrt(Math.max(0, m2 / amp));
    if (tsRef <= 0) continue;
    const ts3Ref = (m3 / amp) / (tsRef * tsRef * tsRef);
    assert.ok(
      Math.abs(row.ts3 - ts3Ref) < 1e-7,
      `INVARIANT BROKEN: ts3 (${row.ts3}) != recomputed (${ts3Ref}) for ${row.source}`,
    );
    assert.ok(
      Math.abs(row.tsIndex - tsRef) < 1e-7,
      `tsIndex mismatch for ${row.source}`,
    );
  }
});

test('temporal-skewness: orthogonal to amplitude-shape skewness — same multiset, reversed order, produces equal-magnitude opposite-sign ts3', () => {
  const v: number[] = [];
  for (let i = 0; i < 12; i++) v.push(Math.floor(Math.sin(i) * 100 + 200));
  const reversed = [...v].reverse();
  const r = buildSourceRowTokenTemporalSkewness(
    [...series(v, 'fwd'), ...series(reversed, 'rev')],
    { generatedAt: GEN },
  );
  const f = r.sources.find((s) => s.source === 'fwd')!;
  const b = r.sources.find((s) => s.source === 'rev')!;
  assert.ok(
    Math.abs(f.ts3 + b.ts3) < 1e-9,
    `expected mirrored ts3 for reversed multiset, got fwd=${f.ts3} rev=${b.ts3}`,
  );
});

test('temporal-skewness: report fields echo input options', () => {
  const r = buildSourceRowTokenTemporalSkewness(
    series(new Array(10).fill(50), 's'),
    {
      generatedAt: GEN,
      minRows: 5,
      top: 3,
      sort: 'abs-ts3-desc',
      since: '2026-04-01T00:00:00Z',
      until: '2026-04-30T00:00:00Z',
      source: 's',
    },
  );
  assert.equal(r.minRows, 5);
  assert.equal(r.top, 3);
  assert.equal(r.sort, 'abs-ts3-desc');
  assert.equal(r.windowStart, '2026-04-01T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00Z');
  assert.equal(r.source, 's');
});

test('temporal-skewness: empty-source string defaults to "unknown"', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 10; i++) {
    lines.push(ql(`2026-04-01T${i.toString().padStart(2, '0')}:00:00Z`, '', 50));
  }
  const r = buildSourceRowTokenTemporalSkewness(lines, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('temporal-skewness: tcIndex within [0, N-1] for all emitted rows', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 20; i++) {
    lines.push(ql(`2026-04-01T${i.toString().padStart(2, '0')}:00:00Z`, 'a', i + 1));
  }
  const r = buildSourceRowTokenTemporalSkewness(lines, { generatedAt: GEN });
  for (const row of r.sources) {
    assert.ok(row.tcIndex >= 0 && row.tcIndex <= row.rowsKept - 1);
  }
});

// ---- --min-ts3 / --max-ts3 band filters (0.6.170) ----

test('temporal-skewness: --min-ts3 filter drops back-loaded sources, surfaces in droppedBelowMinTs3', () => {
  const front = [1000, 10, 10, 10, 10, 10, 10, 10, 10, 10]; // ts3 > 0
  const back = [...front].reverse();                          // ts3 < 0
  const sym = new Array(10).fill(50);                         // ts3 ~ 0
  const r = buildSourceRowTokenTemporalSkewness(
    [...series(front, 'front'), ...series(back, 'back'), ...series(sym, 'sym')],
    { generatedAt: GEN, minTs3: 0 },
  );
  // back drops; front and sym keep
  assert.equal(r.sources.length, 2);
  const keptSrcs = r.sources.map((s) => s.source).sort();
  assert.deepEqual(keptSrcs, ['front', 'sym']);
  assert.equal(r.droppedBelowMinTs3, 1);
  assert.equal(r.droppedAboveMaxTs3, 0);
  assert.equal(r.minTs3, 0);
});

test('temporal-skewness: --max-ts3 filter drops front-loaded sources, surfaces in droppedAboveMaxTs3', () => {
  const front = [1000, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  const back = [...front].reverse();
  const r = buildSourceRowTokenTemporalSkewness(
    [...series(front, 'front'), ...series(back, 'back')],
    { generatedAt: GEN, maxTs3: 0 },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'back');
  assert.equal(r.droppedAboveMaxTs3, 1);
  assert.equal(r.droppedBelowMinTs3, 0);
  assert.equal(r.maxTs3, 0);
});

test('temporal-skewness: --min-ts3 and --max-ts3 together carve a near-symmetric band', () => {
  const front = [1000, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  const back = [...front].reverse();
  const sym = new Array(10).fill(50);
  const r = buildSourceRowTokenTemporalSkewness(
    [...series(front, 'front'), ...series(back, 'back'), ...series(sym, 'sym')],
    { generatedAt: GEN, minTs3: -0.1, maxTs3: 0.1 },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'sym');
  assert.equal(r.droppedBelowMinTs3, 1);
  assert.equal(r.droppedAboveMaxTs3, 1);
});

test('temporal-skewness: invalid --min-ts3 / --max-ts3 throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalSkewness([], { generatedAt: GEN, minTs3: NaN }),
    /minTs3 must be a finite real/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalSkewness([], { generatedAt: GEN, maxTs3: Infinity }),
    /maxTs3 must be a finite real/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalSkewness([], { generatedAt: GEN, minTs3: 0.5, maxTs3: -0.5 }),
    /minTs3 .* must be <= maxTs3/,
  );
});

test('temporal-skewness: ts3-band filter applies BEFORE top cap (top counts post-band sources)', () => {
  const sources: QueueLine[] = [];
  // Three front-loaded (ts3 > 0)
  for (const name of ['f1', 'f2', 'f3']) {
    sources.push(...series([1000, 10, 10, 10, 10, 10, 10, 10, 10, 10], name));
  }
  // Three back-loaded (ts3 < 0)
  for (const name of ['b1', 'b2', 'b3']) {
    sources.push(...series([10, 10, 10, 10, 10, 10, 10, 10, 10, 1000], name));
  }
  const r = buildSourceRowTokenTemporalSkewness(sources, {
    generatedAt: GEN, minTs3: 0, top: 2, sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowMinTs3, 3);
  assert.equal(r.droppedBelowTopCap, 1);
  for (const s of r.sources) {
    assert.ok(s.source.startsWith('f'), `expected front-loaded only, got ${s.source}`);
  }
});

test('temporal-skewness: report fields echo minTs3/maxTs3 and they default to null', () => {
  const r1 = buildSourceRowTokenTemporalSkewness([], { generatedAt: GEN });
  assert.equal(r1.minTs3, null);
  assert.equal(r1.maxTs3, null);
  const r2 = buildSourceRowTokenTemporalSkewness(
    series(new Array(10).fill(50), 's'),
    { generatedAt: GEN, minTs3: -1, maxTs3: 1 },
  );
  assert.equal(r2.minTs3, -1);
  assert.equal(r2.maxTs3, 1);
});

test('temporal-skewness: --min-ts3 == --max-ts3 produces a single-point band (equal bound is permitted)', () => {
  const sym = new Array(10).fill(50); // ts3 ~ 0
  const r = buildSourceRowTokenTemporalSkewness(series(sym, 's'), {
    generatedAt: GEN, minTs3: 0, maxTs3: 0,
  });
  // With float jitter, ts3 may be a tiny epsilon away; allow the kept side.
  // What we pin: equal bounds is *not* an error and the validator accepts it.
  assert.ok(r.droppedBelowMinTs3 + r.droppedAboveMaxTs3 + r.sources.length >= 1);
});
