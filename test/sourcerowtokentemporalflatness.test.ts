import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenTemporalFlatness } from '../src/sourcerowtokentemporalflatness.js';
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

test('temporal-flatness: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenTemporalFlatness([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'tf-desc');
  assert.equal(r.generatedAt, GEN);
});

test('temporal-flatness: constant positive series -> tf == 1 exactly', () => {
  const r = buildSourceRowTokenTemporalFlatness(
    series(new Array(20).fill(50)),
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  assert.ok(
    Math.abs(r.sources[0]!.tf - 1) < 1e-12,
    `expected tf == 1 for constant series, got ${r.sources[0]!.tf}`,
  );
});

test('temporal-flatness: tf in (0, 1] always (AM-GM upper bound invariant)', () => {
  const cases = [
    [1, 2, 3, 4, 5, 4, 3, 2, 1],
    [10, 10, 10, 10, 10, 10, 10, 10, 10],
    [1, 50, 1, 1, 1, 1, 50, 1],
    [1000, 0, 0, 0, 0, 0, 0, 0, 0, 1000],
    [5, 5, 5, 100, 5, 5, 5, 5],
  ];
  for (let k = 0; k < cases.length; k++) {
    const r = buildSourceRowTokenTemporalFlatness(series(cases[k]!, `s${k}`), {
      generatedAt: GEN,
    });
    if (r.sources.length === 1) {
      const tf = r.sources[0]!.tf;
      assert.ok(tf > 0, `case ${k}: tf <= 0 (got ${tf})`);
      assert.ok(tf <= 1 + 1e-9, `case ${k}: tf > 1 (got ${tf})`);
    }
  }
});

test('temporal-flatness: spike envelope -> tf much smaller than constant', () => {
  // Tiny background + a single tall spike -> very concentrated
  const v = new Array(15).fill(1);
  v[7] = 5000;
  const flat = new Array(15).fill(50);
  const r = buildSourceRowTokenTemporalFlatness(
    [...series(v, 'spike'), ...series(flat, 'flat')],
    { generatedAt: GEN },
  );
  const sp = r.sources.find((s) => s.source === 'spike')!;
  const fl = r.sources.find((s) => s.source === 'flat')!;
  assert.ok(
    sp.tf < fl.tf,
    `expected spike tf (${sp.tf}) < flat tf (${fl.tf})`,
  );
  assert.ok(Math.abs(fl.tf - 1) < 1e-12, `flat should have tf == 1`);
});

test('temporal-flatness: rows with zero amplitudes drive tf toward zero (G floors at EPS)', () => {
  // 9 zeros + 1 positive — geometric mean is dominated by EPS rows
  const v = new Array(10).fill(0);
  v[5] = 1000;
  const r = buildSourceRowTokenTemporalFlatness(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  // GM ~ exp((9*log(EPS) + log(1000))/10) which is ~ EPS^0.9 — vanishingly small;
  // tf = GM / 100 -> ~0
  assert.ok(
    r.sources[0]!.tf < 1e-100,
    `expected near-zero tf for 9-zero / 1-spike, got ${r.sources[0]!.tf}`,
  );
});

// ---- Order / scale invariance ----

test('temporal-flatness: order-invariant (permuting rows leaves tf unchanged)', () => {
  // Same multiset of amplitudes in two different time orderings — tf must match.
  const a = [1, 2, 3, 5, 8, 13, 8, 5, 3, 2];
  const b = [...a].reverse();
  const r = buildSourceRowTokenTemporalFlatness(
    [...series(a, 'fwd'), ...series(b, 'rev')],
    { generatedAt: GEN },
  );
  const fwd = r.sources.find((s) => s.source === 'fwd')!;
  const rev = r.sources.find((s) => s.source === 'rev')!;
  assert.ok(
    Math.abs(fwd.tf - rev.tf) < 1e-12,
    `expected order-invariance, got fwd=${fwd.tf} rev=${rev.tf}`,
  );
});

test('temporal-flatness: amplitude-scale invariant (a[n] -> c*a[n] for c > 0 leaves tf unchanged)', () => {
  const v = [1, 2, 3, 5, 8, 13, 8, 5, 3, 2];
  const scaled = v.map((x) => x * 47);
  const r = buildSourceRowTokenTemporalFlatness(
    [...series(v, 'a'), ...series(scaled, 'b')],
    { generatedAt: GEN },
  );
  const a = r.sources.find((s) => s.source === 'a')!;
  const b = r.sources.find((s) => s.source === 'b')!;
  assert.ok(
    Math.abs(a.tf - b.tf) < 1e-12,
    `tf should be amplitude-scale invariant, got a=${a.tf} b=${b.tf}`,
  );
});

// ---- Edge cases / drops ----

test('temporal-flatness: all-zero series -> droppedZeroSeries', () => {
  const r = buildSourceRowTokenTemporalFlatness(
    series(new Array(10).fill(0)),
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroSeries, 1);
});

test('temporal-flatness: below min-rows -> droppedBelowMinRows', () => {
  const r = buildSourceRowTokenTemporalFlatness(
    series([10, 20, 30, 40, 50], 's'),
    { generatedAt: GEN, minRows: 8 },
  );
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('temporal-flatness: minRows=4 is the lowest allowed; <4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalFlatness([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
  const r = buildSourceRowTokenTemporalFlatness(
    series([10, 100, 100, 10], 's'),
    { generatedAt: GEN, minRows: 4 },
  );
  assert.equal(r.sources.length, 1);
});

test('temporal-flatness: invalid since/until throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalFlatness([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalFlatness([], { until: 'nope' }),
    /invalid until/,
  );
});

test('temporal-flatness: invalid total_tokens types are dropped', () => {
  const lines: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 100),
    ql('2026-04-01T01:00:00Z', 's', NaN),
    ql('2026-04-01T02:00:00Z', 's', -5),
    ql('2026-04-01T03:00:00Z', 's', 50),
  ];
  const r = buildSourceRowTokenTemporalFlatness(lines, {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('temporal-flatness: invalid hour_start surfaces in droppedInvalidHourStart', () => {
  const lines: QueueLine[] = [
    ql('not-a-date', 's', 10),
    ql('2026-04-01T00:00:00Z', 's', 10),
  ];
  const r = buildSourceRowTokenTemporalFlatness(lines, {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

// ---- Source filter / since-until ----

test('temporal-flatness: source filter restricts to single source', () => {
  const r = buildSourceRowTokenTemporalFlatness(
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

test('temporal-flatness: since/until window filter', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 16; i++) {
    lines.push(ql(`2026-04-01T${i.toString().padStart(2, '0')}:00:00Z`, 's', 10 + i));
  }
  const r = buildSourceRowTokenTemporalFlatness(lines, {
    generatedAt: GEN,
    since: '2026-04-01T04:00:00Z',
    until: '2026-04-01T12:00:00Z',
  });
  assert.equal(r.totalRowsKept, 8);
});

// ---- Sort ----

test('temporal-flatness: sort tf-desc puts flattest first', () => {
  const flat = new Array(15).fill(50);
  const mild = new Array(15).fill(50);
  mild[7] = 200;
  const spike = new Array(15).fill(1);
  spike[7] = 5000;
  const r = buildSourceRowTokenTemporalFlatness(
    [...series(flat, 'flat'), ...series(mild, 'mild'), ...series(spike, 'spk')],
    { generatedAt: GEN, sort: 'tf-desc' },
  );
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['flat', 'mild', 'spk'],
  );
});

test('temporal-flatness: sort tf-asc puts spikiest first', () => {
  const flat = new Array(15).fill(50);
  const mild = new Array(15).fill(50);
  mild[7] = 200;
  const spike = new Array(15).fill(1);
  spike[7] = 5000;
  const r = buildSourceRowTokenTemporalFlatness(
    [...series(flat, 'flat'), ...series(mild, 'mild'), ...series(spike, 'spk')],
    { generatedAt: GEN, sort: 'tf-asc' },
  );
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['spk', 'mild', 'flat'],
  );
});

test('temporal-flatness: sort rows orders by rowsKept desc', () => {
  const r = buildSourceRowTokenTemporalFlatness(
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

test('temporal-flatness: sort source orders lex asc', () => {
  const r = buildSourceRowTokenTemporalFlatness(
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

test('temporal-flatness: invalid sort throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalFlatness([], { sort: 'bogus' as any }),
    /sort must be one of/,
  );
});

// ---- Top cap ----

test('temporal-flatness: top cap limits output and surfaces droppedBelowTopCap', () => {
  const sources: QueueLine[] = [];
  for (const name of ['a', 'b', 'c', 'd']) {
    sources.push(...series(new Array(10).fill(50), name));
  }
  const r = buildSourceRowTokenTemporalFlatness(sources, {
    generatedAt: GEN,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
});

test('temporal-flatness: top must be a positive integer', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalFlatness([], { top: 0 }),
    /top must be a positive integer/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalFlatness([], { top: 1.5 }),
    /top must be a positive integer/,
  );
});

// ---- Sort tiebreak determinism ----

test('temporal-flatness: sort tiebreak across all sort modes is source asc', () => {
  const a = series(new Array(10).fill(50), 'aaa');
  const b = series(new Array(10).fill(50), 'bbb');
  const c = series(new Array(10).fill(50), 'ccc');
  for (const sort of ['tf-desc', 'tf-asc', 'rows', 'source'] as const) {
    const r = buildSourceRowTokenTemporalFlatness([...c, ...a, ...b], {
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

// ---- Invariant pin ----

test('temporal-flatness: invariant pin — for each emitted row, tf == GM/AM recomputed from scratch', () => {
  let s = 313131;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const allLines: QueueLine[] = [];
  const truth: Map<string, number[]> = new Map();
  for (let k = 0; k < 12; k++) {
    const n = 8 + Math.floor(rand() * 30);
    const vals: number[] = [];
    for (let i = 0; i < n; i++) vals.push(Math.floor(rand() * 500) + 1); // strictly positive
    const name = `inv${k}`;
    truth.set(name, vals);
    allLines.push(...series(vals, name));
  }
  const r = buildSourceRowTokenTemporalFlatness(allLines, {
    generatedAt: GEN,
    minRows: 4,
  });
  for (const row of r.sources) {
    const vals = truth.get(row.source)!;
    let amp = 0, sumLog = 0;
    for (const v of vals) {
      amp += v;
      sumLog += Math.log(v);
    }
    const am = amp / vals.length;
    const gm = Math.exp(sumLog / vals.length);
    const tfRef = gm / am;
    assert.ok(
      Math.abs(row.tf - tfRef) < 1e-12,
      `INVARIANT BROKEN: tf (${row.tf}) != recomputed (${tfRef}) for ${row.source}`,
    );
    assert.ok(
      row.tf > 0 && row.tf <= 1 + 1e-9,
      `tf ${row.tf} violates (0, 1] invariant`,
    );
  }
});

test('temporal-flatness: report fields echo input options', () => {
  const r = buildSourceRowTokenTemporalFlatness(
    series(new Array(10).fill(50), 's'),
    {
      generatedAt: GEN,
      minRows: 5,
      top: 3,
      sort: 'tf-asc',
      since: '2026-04-01T00:00:00Z',
      until: '2026-04-30T00:00:00Z',
      source: 's',
    },
  );
  assert.equal(r.minRows, 5);
  assert.equal(r.top, 3);
  assert.equal(r.sort, 'tf-asc');
  assert.equal(r.windowStart, '2026-04-01T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00Z');
  assert.equal(r.source, 's');
});

test('temporal-flatness: empty-source string defaults to "unknown"', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 10; i++) {
    lines.push(ql(`2026-04-01T${i.toString().padStart(2, '0')}:00:00Z`, '', 50));
  }
  const r = buildSourceRowTokenTemporalFlatness(lines, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('temporal-flatness: GM <= AM always (AM-GM inequality core invariant)', () => {
  let s = 991337;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const allLines: QueueLine[] = [];
  for (let k = 0; k < 8; k++) {
    const n = 8 + Math.floor(rand() * 30);
    const vals: number[] = [];
    for (let i = 0; i < n; i++) vals.push(Math.floor(rand() * 1000) + 1);
    allLines.push(...series(vals, `am${k}`));
  }
  const r = buildSourceRowTokenTemporalFlatness(allLines, { generatedAt: GEN, minRows: 4 });
  for (const row of r.sources) {
    assert.ok(
      row.geometricMean <= row.arithmeticMean + 1e-9,
      `AM-GM violated: GM=${row.geometricMean} > AM=${row.arithmeticMean} for ${row.source}`,
    );
  }
});

// ---- --min-tf / --max-tf band filters (0.6.176) ----

test('temporal-flatness: --min-tf filter drops spiky sources, surfaces in droppedBelowMinTf', () => {
  const flat = new Array(15).fill(50);                       // tf == 1
  const mild = new Array(15).fill(1); mild[7] = 50;          // tf well below 0.9
  const spike = new Array(15).fill(1); spike[7] = 5000;      // tf << 1
  const r = buildSourceRowTokenTemporalFlatness(
    [...series(flat, 'flat'), ...series(mild, 'mild'), ...series(spike, 'spk')],
    { generatedAt: GEN, minTf: 0.9 },
  );
  // mild and spike drop; flat keeps
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'flat');
  assert.equal(r.droppedBelowMinTf, 2);
  assert.equal(r.droppedAboveMaxTf, 0);
  assert.equal(r.minTf, 0.9);
});

test('temporal-flatness: --max-tf filter drops flat sources, surfaces in droppedAboveMaxTf', () => {
  const flat = new Array(15).fill(50);
  const spike = new Array(15).fill(1); spike[7] = 5000;
  const r = buildSourceRowTokenTemporalFlatness(
    [...series(flat, 'flat'), ...series(spike, 'spk')],
    { generatedAt: GEN, maxTf: 0.5 },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'spk');
  assert.equal(r.droppedAboveMaxTf, 1);
  assert.equal(r.droppedBelowMinTf, 0);
  assert.equal(r.maxTf, 0.5);
});

test('temporal-flatness: --min-tf and --max-tf together carve a mid-band', () => {
  const flat = new Array(15).fill(50);                       // tf == 1
  const mild = new Array(15).fill(50); mild[7] = 200;        // tf ~ 0.85 ish
  const spike = new Array(15).fill(1); spike[7] = 5000;      // tf << 0.5
  const r = buildSourceRowTokenTemporalFlatness(
    [...series(flat, 'flat'), ...series(mild, 'mild'), ...series(spike, 'spk')],
    { generatedAt: GEN, minTf: 0.5, maxTf: 0.95 },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'mild');
  assert.equal(r.droppedAboveMaxTf, 1);
  assert.equal(r.droppedBelowMinTf, 1);
});

test('temporal-flatness: invalid --min-tf / --max-tf throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalFlatness([], { generatedAt: GEN, minTf: NaN }),
    /minTf must be a finite real/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalFlatness([], { generatedAt: GEN, maxTf: Infinity }),
    /maxTf must be a finite real/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalFlatness([], { generatedAt: GEN, minTf: 0 }),
    /minTf must be in \(0, 1\]/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalFlatness([], { generatedAt: GEN, maxTf: 1.5 }),
    /maxTf must be in \(0, 1\]/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalFlatness([], { generatedAt: GEN, minTf: 0.8, maxTf: 0.4 }),
    /minTf .* must be <= maxTf/,
  );
});

test('temporal-flatness: tf-band filter applies BEFORE top cap (top counts post-band sources)', () => {
  const sources: QueueLine[] = [];
  // Three flat sources
  for (const name of ['f1', 'f2', 'f3']) {
    sources.push(...series(new Array(15).fill(50), name));
  }
  // Three spiky sources
  for (const name of ['s1', 's2', 's3']) {
    const v = new Array(15).fill(1); v[7] = 5000;
    sources.push(...series(v, name));
  }
  const r = buildSourceRowTokenTemporalFlatness(sources, {
    generatedAt: GEN, maxTf: 0.5, top: 2, sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedAboveMaxTf, 3);
  assert.equal(r.droppedBelowTopCap, 1);
  for (const s of r.sources) {
    assert.ok(s.source.startsWith('s'), `expected spiky only, got ${s.source}`);
  }
});

test('temporal-flatness: report fields echo minTf/maxTf and they default to null', () => {
  const r1 = buildSourceRowTokenTemporalFlatness([], { generatedAt: GEN });
  assert.equal(r1.minTf, null);
  assert.equal(r1.maxTf, null);
  const r2 = buildSourceRowTokenTemporalFlatness(
    series(new Array(10).fill(50), 's'),
    { generatedAt: GEN, minTf: 0.1, maxTf: 1 },
  );
  assert.equal(r2.minTf, 0.1);
  assert.equal(r2.maxTf, 1);
});

test('temporal-flatness: --max-tf == 1 (upper bound) keeps all valid emitted sources', () => {
  const v1 = new Array(10).fill(50);                 // tf == 1
  const v2 = new Array(10).fill(1); v2[5] = 100;     // tf < 1
  const r = buildSourceRowTokenTemporalFlatness(
    [...series(v1, 'a'), ...series(v2, 'b')],
    { generatedAt: GEN, maxTf: 1 },
  );
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedAboveMaxTf, 0);
});

// ---- dist-flat sort modes (0.6.177) ----

test('temporal-flatness: sort dist-flat-asc puts closest-to-flat (tf=1) source first', () => {
  const flat = new Array(15).fill(50);                       // tf == 1
  const mild = new Array(15).fill(1); mild[7] = 50;          // tf < 1
  const spike = new Array(15).fill(1); spike[7] = 5000;      // tf << 1
  const r = buildSourceRowTokenTemporalFlatness(
    [...series(flat, 'flat'), ...series(mild, 'mild'), ...series(spike, 'spk')],
    { generatedAt: GEN, sort: 'dist-flat-asc' },
  );
  // 'flat' is closest to 1; should sort first.
  assert.equal(r.sources[0]!.source, 'flat');
});

test('temporal-flatness: sort dist-flat-desc puts farthest-from-flat (most concentrated) first', () => {
  const flat = new Array(15).fill(50);
  const mild = new Array(15).fill(1); mild[7] = 50;
  const spike = new Array(15).fill(1); spike[7] = 5000;
  const r = buildSourceRowTokenTemporalFlatness(
    [...series(flat, 'flat'), ...series(mild, 'mild'), ...series(spike, 'spk')],
    { generatedAt: GEN, sort: 'dist-flat-desc' },
  );
  // 'spk' is farthest from 1.
  assert.equal(r.sources[0]!.source, 'spk');
  assert.equal(r.sources[2]!.source, 'flat');
});

test('temporal-flatness: dist-flat sort modes — equidistant tie breaks by source asc', () => {
  // Three identical envelopes -> identical tf -> tie -> source-asc tiebreak.
  const v = new Array(15).fill(1); v[7] = 100;
  const r = buildSourceRowTokenTemporalFlatness(
    [...series(v, 'zz'), ...series(v, 'aa'), ...series(v, 'mm')],
    { generatedAt: GEN, sort: 'dist-flat-asc' },
  );
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['aa', 'mm', 'zz'],
  );
});

test('temporal-flatness: invalid sort still rejected; all six valid modes accepted', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalFlatness([], { sort: 'dist-flat-bogus' as any }),
    /sort must be one of/,
  );
  for (const s of [
    'tf-desc', 'tf-asc', 'dist-flat-asc', 'dist-flat-desc', 'rows', 'source',
  ] as const) {
    buildSourceRowTokenTemporalFlatness([], { sort: s });
  }
});

test('temporal-flatness: dist-flat-asc / dist-flat-desc are exact reverses on distinct tf values', () => {
  // Three sources with strictly distinct tf — the two dist-flat sort modes
  // should produce reversed orderings of one another.
  const a = new Array(15).fill(50);                          // tf == 1
  const b = new Array(15).fill(1); b[7] = 100;               // some tf
  const c = new Array(15).fill(1); c[7] = 10000;             // smaller tf
  const asc = buildSourceRowTokenTemporalFlatness(
    [...series(a, 'a'), ...series(b, 'b'), ...series(c, 'c')],
    { generatedAt: GEN, sort: 'dist-flat-asc' },
  );
  const desc = buildSourceRowTokenTemporalFlatness(
    [...series(a, 'a'), ...series(b, 'b'), ...series(c, 'c')],
    { generatedAt: GEN, sort: 'dist-flat-desc' },
  );
  assert.deepEqual(
    asc.sources.map((s) => s.source),
    desc.sources.map((s) => s.source).reverse(),
  );
});
