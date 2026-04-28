import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenTemporalKurtosis } from '../src/sourcerowtokentemporalkurtosis.js';
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

test('temporal-kurtosis: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenTemporalKurtosis([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'ts4-desc');
  assert.equal(r.generatedAt, GEN);
});

test('temporal-kurtosis: ts4 has lower bound of 1 (Cauchy-Schwarz; symmetric two-point bimodal)', () => {
  // Two-point symmetric mass at the extremes — kurtosis = 1 exactly.
  const v = new Array(10).fill(0);
  v[0] = 100; v[9] = 100;
  const r = buildSourceRowTokenTemporalKurtosis(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.ok(
    Math.abs(r.sources[0]!.ts4 - 1) < 1e-9,
    `expected ts4 ~= 1 for symmetric two-point bimodal, got ${r.sources[0]!.ts4}`,
  );
});

test('temporal-kurtosis: uniform constant series -> ts4 ~ 1.8 (uniform reference)', () => {
  const v = new Array(40).fill(100);
  const r = buildSourceRowTokenTemporalKurtosis(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  // discrete uniform on [0, N-1] has kurtosis (3/5)*(3 + ...)/... ; converges to 9/5 = 1.8 for large N.
  // For N = 40: expected very close to 1.8.
  assert.ok(
    Math.abs(r.sources[0]!.ts4 - 1.8) < 0.05,
    `expected ts4 ~= 1.8 for uniform N=40, got ${r.sources[0]!.ts4}`,
  );
});

test('temporal-kurtosis: ts4 >= 1 always (lower bound invariant)', () => {
  // A handful of arbitrary non-negative envelopes; ts4 should be >= 1 in all cases.
  const cases = [
    [1, 2, 3, 4, 5, 4, 3, 2, 1],
    [10, 10, 10, 10, 10, 10, 10, 10, 10],
    [1, 50, 1, 1, 1, 1, 50, 1],
    [1000, 0, 0, 0, 0, 0, 0, 0, 0, 1000],
    [5, 5, 5, 100, 5, 5, 5, 5],
  ];
  for (let k = 0; k < cases.length; k++) {
    const r = buildSourceRowTokenTemporalKurtosis(series(cases[k]!, `s${k}`), {
      generatedAt: GEN,
    });
    if (r.sources.length === 1) {
      assert.ok(
        r.sources[0]!.ts4 >= 1 - 1e-9,
        `case ${k}: ts4 < 1 (got ${r.sources[0]!.ts4}); violates Cauchy-Schwarz lower bound`,
      );
    }
  }
});

test('temporal-kurtosis: sharp central spike -> ts4 large (>> 3)', () => {
  // Tiny background + a tall spike near the centroid -> very peaked envelope
  const v = new Array(21).fill(1);
  v[10] = 10000;
  const r = buildSourceRowTokenTemporalKurtosis(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.ok(
    r.sources[0]!.ts4 > 10,
    `expected ts4 >> 3 for sharp central spike, got ${r.sources[0]!.ts4}`,
  );
});

test('temporal-kurtosis: bimodal at extremes < uniform < central spike (ordering)', () => {
  const bimodal = new Array(15).fill(0);
  bimodal[0] = 100; bimodal[14] = 100;
  const uniform = new Array(15).fill(50);
  const spike = new Array(15).fill(1);
  spike[7] = 5000;
  const r = buildSourceRowTokenTemporalKurtosis(
    [
      ...series(bimodal, 'bi'),
      ...series(uniform, 'uni'),
      ...series(spike, 'spk'),
    ],
    { generatedAt: GEN },
  );
  const bi = r.sources.find((s) => s.source === 'bi')!;
  const uni = r.sources.find((s) => s.source === 'uni')!;
  const spk = r.sources.find((s) => s.source === 'spk')!;
  assert.ok(
    bi.ts4 < uni.ts4 && uni.ts4 < spk.ts4,
    `expected bi (${bi.ts4}) < uni (${uni.ts4}) < spk (${spk.ts4})`,
  );
});

// ---- Order sensitivity / mirror invariance ----

test('temporal-kurtosis: mirroring rows leaves ts4 unchanged (sign-blind even moment)', () => {
  const front = [1000, 50, 10, 10, 10, 10, 10, 10, 10, 10];
  const back = [...front].reverse();
  const r = buildSourceRowTokenTemporalKurtosis(
    [...series(front, 'front'), ...series(back, 'back')],
    { generatedAt: GEN },
  );
  const f = r.sources.find((s) => s.source === 'front')!;
  const b = r.sources.find((s) => s.source === 'back')!;
  assert.ok(
    Math.abs(f.ts4 - b.ts4) < 1e-9,
    `expected mirrored series to have identical ts4, got front=${f.ts4} back=${b.ts4}`,
  );
});

test('temporal-kurtosis: order-sensitive — same multiset of amplitudes in different time order yields different ts4', () => {
  // Same amplitudes; one centered (high ts4 candidate vs flat-ish), one bimodal
  const centered = [1, 1, 1, 1, 1, 100, 1, 1, 1, 1, 1];
  const split = [50, 1, 1, 1, 1, 1, 1, 1, 1, 1, 50];
  const r = buildSourceRowTokenTemporalKurtosis(
    [...series(centered, 'c'), ...series(split, 's')],
    { generatedAt: GEN },
  );
  const c = r.sources.find((s) => s.source === 'c')!;
  const s = r.sources.find((s) => s.source === 's')!;
  assert.ok(
    Math.abs(c.ts4 - s.ts4) > 1.0,
    `expected very different ts4 for same multiset in different order, got c=${c.ts4} s=${s.ts4}`,
  );
  assert.ok(c.ts4 > s.ts4, `centered should be more peaked than split`);
});

test('temporal-kurtosis: ts4 is invariant to uniform amplitude rescaling', () => {
  const v = [1, 2, 3, 5, 8, 13, 8, 5, 3, 2];
  const scaled = v.map((x) => x * 47);
  const r = buildSourceRowTokenTemporalKurtosis(
    [...series(v, 'a'), ...series(scaled, 'b')],
    { generatedAt: GEN },
  );
  const a = r.sources.find((s) => s.source === 'a')!;
  const b = r.sources.find((s) => s.source === 'b')!;
  assert.ok(
    Math.abs(a.ts4 - b.ts4) < 1e-9,
    `ts4 should be amplitude-scale invariant, got a=${a.ts4} b=${b.ts4}`,
  );
});

// ---- Edge cases / drops ----

test('temporal-kurtosis: single-row spike -> droppedZeroVariance', () => {
  const v = new Array(10).fill(0);
  v[3] = 500;
  const r = buildSourceRowTokenTemporalKurtosis(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.droppedZeroSeries, 0);
});

test('temporal-kurtosis: all-zero series -> droppedZeroSeries (separate from zero-variance)', () => {
  const r = buildSourceRowTokenTemporalKurtosis(
    series(new Array(10).fill(0)),
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroSeries, 1);
  assert.equal(r.droppedZeroVariance, 0);
});

test('temporal-kurtosis: below min-rows -> droppedBelowMinRows', () => {
  const r = buildSourceRowTokenTemporalKurtosis(
    series([10, 20, 30, 40, 50], 's'),
    { generatedAt: GEN, minRows: 8 },
  );
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('temporal-kurtosis: minRows=4 is the lowest allowed; <4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalKurtosis([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
  // 4 works
  const r = buildSourceRowTokenTemporalKurtosis(
    series([10, 100, 100, 10], 's'),
    { generatedAt: GEN, minRows: 4 },
  );
  assert.equal(r.sources.length, 1);
});

test('temporal-kurtosis: invalid since/until throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalKurtosis([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalKurtosis([], { until: 'nope' }),
    /invalid until/,
  );
});

test('temporal-kurtosis: invalid total_tokens types are dropped', () => {
  const lines: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 100),
    ql('2026-04-01T01:00:00Z', 's', NaN),
    ql('2026-04-01T02:00:00Z', 's', -5),
    ql('2026-04-01T03:00:00Z', 's', 50),
  ];
  const r = buildSourceRowTokenTemporalKurtosis(lines, {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  // Only 2 rows left -> below min-rows of 4
  assert.equal(r.droppedBelowMinRows, 1);
});

test('temporal-kurtosis: invalid hour_start surfaces in droppedInvalidHourStart', () => {
  const lines: QueueLine[] = [
    ql('not-a-date', 's', 10),
    ql('2026-04-01T00:00:00Z', 's', 10),
  ];
  const r = buildSourceRowTokenTemporalKurtosis(lines, {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

// ---- Source filter / since-until ----

test('temporal-kurtosis: source filter restricts to single source', () => {
  const r = buildSourceRowTokenTemporalKurtosis(
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

test('temporal-kurtosis: since/until window filter', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 16; i++) {
    lines.push(ql(`2026-04-01T${i.toString().padStart(2, '0')}:00:00Z`, 's', 10 + i));
  }
  const r = buildSourceRowTokenTemporalKurtosis(lines, {
    generatedAt: GEN,
    since: '2026-04-01T04:00:00Z',
    until: '2026-04-01T12:00:00Z',
  });
  assert.equal(r.totalRowsKept, 8);
});

// ---- Sort ----

test('temporal-kurtosis: sort ts4-desc puts most peaked first', () => {
  const bimodal = new Array(15).fill(0);
  bimodal[0] = 100; bimodal[14] = 100;
  const uniform = new Array(15).fill(50);
  const spike = new Array(15).fill(1);
  spike[7] = 5000;
  const r = buildSourceRowTokenTemporalKurtosis(
    [...series(bimodal, 'bi'), ...series(uniform, 'uni'), ...series(spike, 'spk')],
    { generatedAt: GEN, sort: 'ts4-desc' },
  );
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['spk', 'uni', 'bi'],
  );
});

test('temporal-kurtosis: sort ts4-asc puts most flat / bimodal first', () => {
  const bimodal = new Array(15).fill(0);
  bimodal[0] = 100; bimodal[14] = 100;
  const uniform = new Array(15).fill(50);
  const spike = new Array(15).fill(1);
  spike[7] = 5000;
  const r = buildSourceRowTokenTemporalKurtosis(
    [...series(bimodal, 'bi'), ...series(uniform, 'uni'), ...series(spike, 'spk')],
    { generatedAt: GEN, sort: 'ts4-asc' },
  );
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['bi', 'uni', 'spk'],
  );
});

test('temporal-kurtosis: sort rows orders by rowsKept desc', () => {
  const r = buildSourceRowTokenTemporalKurtosis(
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

test('temporal-kurtosis: sort source orders lex asc', () => {
  const r = buildSourceRowTokenTemporalKurtosis(
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

test('temporal-kurtosis: invalid sort throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalKurtosis([], { sort: 'bogus' as any }),
    /sort must be one of/,
  );
});

// ---- Top cap ----

test('temporal-kurtosis: top cap limits output and surfaces droppedBelowTopCap', () => {
  const sources: QueueLine[] = [];
  for (const name of ['a', 'b', 'c', 'd']) {
    sources.push(...series(new Array(10).fill(50), name));
  }
  const r = buildSourceRowTokenTemporalKurtosis(sources, {
    generatedAt: GEN, top: 2, sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
});

test('temporal-kurtosis: top must be a positive integer', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalKurtosis([], { top: 0 }),
    /top must be a positive integer/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalKurtosis([], { top: 1.5 }),
    /top must be a positive integer/,
  );
});

// ---- Sort tiebreak determinism ----

test('temporal-kurtosis: sort tiebreak across all sort modes is source asc', () => {
  // Identical series -> identical ts4 -> tie everywhere.
  const a = series(new Array(10).fill(50), 'aaa');
  const b = series(new Array(10).fill(50), 'bbb');
  const c = series(new Array(10).fill(50), 'ccc');
  for (const sort of ['ts4-desc', 'ts4-asc', 'rows', 'source'] as const) {
    const r = buildSourceRowTokenTemporalKurtosis(
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

test('temporal-kurtosis: invariant pin — for each emitted row, ts4 == m4/ts_index^4 recomputed from scratch', () => {
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
  const r = buildSourceRowTokenTemporalKurtosis(allLines, { generatedAt: GEN, minRows: 4 });
  for (const row of r.sources) {
    const vals = truth.get(row.source)!;
    let amp = 0, ws = 0;
    for (let i = 0; i < vals.length; i++) { amp += vals[i]!; ws += i * vals[i]!; }
    if (amp <= 0) continue;
    const tcRef = ws / amp;
    let m2 = 0, m4 = 0;
    for (let i = 0; i < vals.length; i++) {
      const d = i - tcRef;
      const d2 = d * d;
      m2 += d2 * vals[i]!;
      m4 += d2 * d2 * vals[i]!;
    }
    const tsRef = Math.sqrt(Math.max(0, m2 / amp));
    if (tsRef <= 0) continue;
    const ts4Ref = (m4 / amp) / (tsRef * tsRef * tsRef * tsRef);
    assert.ok(
      Math.abs(row.ts4 - ts4Ref) < 1e-7,
      `INVARIANT BROKEN: ts4 (${row.ts4}) != recomputed (${ts4Ref}) for ${row.source}`,
    );
    assert.ok(
      row.ts4 >= 1 - 1e-7,
      `ts4 ${row.ts4} violates lower-bound invariant >= 1`,
    );
  }
});

test('temporal-kurtosis: orthogonal to amplitude-shape kurtosis — same multiset, reversed order, produces identical ts4', () => {
  // Mirror-invariance is the key orthogonality predicate against amplitude-shape kurtosis:
  // amplitude-kurtosis is order-invariant under any permutation; ts4 is order-invariant
  // only under the reflection n -> N-1-n. Two non-reflection permutations of the same
  // multiset will give different ts4 (covered by the centered-vs-split test above).
  const v: number[] = [];
  for (let i = 0; i < 12; i++) v.push(Math.floor(Math.sin(i) * 100 + 200));
  const reversed = [...v].reverse();
  const r = buildSourceRowTokenTemporalKurtosis(
    [...series(v, 'fwd'), ...series(reversed, 'rev')],
    { generatedAt: GEN },
  );
  const f = r.sources.find((s) => s.source === 'fwd')!;
  const b = r.sources.find((s) => s.source === 'rev')!;
  assert.ok(
    Math.abs(f.ts4 - b.ts4) < 1e-9,
    `expected identical ts4 for reversed multiset, got fwd=${f.ts4} rev=${b.ts4}`,
  );
});

test('temporal-kurtosis: report fields echo input options', () => {
  const r = buildSourceRowTokenTemporalKurtosis(
    series(new Array(10).fill(50), 's'),
    {
      generatedAt: GEN,
      minRows: 5,
      top: 3,
      sort: 'ts4-asc',
      since: '2026-04-01T00:00:00Z',
      until: '2026-04-30T00:00:00Z',
      source: 's',
    },
  );
  assert.equal(r.minRows, 5);
  assert.equal(r.top, 3);
  assert.equal(r.sort, 'ts4-asc');
  assert.equal(r.windowStart, '2026-04-01T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00Z');
  assert.equal(r.source, 's');
});

test('temporal-kurtosis: empty-source string defaults to "unknown"', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 10; i++) {
    lines.push(ql(`2026-04-01T${i.toString().padStart(2, '0')}:00:00Z`, '', 50));
  }
  const r = buildSourceRowTokenTemporalKurtosis(lines, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('temporal-kurtosis: tcIndex within [0, N-1] for all emitted rows', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 20; i++) {
    lines.push(ql(`2026-04-01T${i.toString().padStart(2, '0')}:00:00Z`, 'a', i + 1));
  }
  const r = buildSourceRowTokenTemporalKurtosis(lines, { generatedAt: GEN });
  for (const row of r.sources) {
    assert.ok(row.tcIndex >= 0 && row.tcIndex <= row.rowsKept - 1);
  }
});
