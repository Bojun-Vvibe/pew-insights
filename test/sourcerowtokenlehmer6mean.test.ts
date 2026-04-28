import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmer6Mean } from '../src/sourcerowtokenlehmer6mean.js';
import { buildSourceRowTokenLehmer5Mean } from '../src/sourcerowtokenlehmer5mean.js';
import { buildSourceRowTokenLehmer4Mean } from '../src/sourcerowtokenlehmer4mean.js';
import { buildSourceRowTokenLehmer3Mean } from '../src/sourcerowtokenlehmer3mean.js';
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
      `2026-04-28T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

function l6Reference(xs: number[]): {
  mean: number;
  l4: number;
  l5: number;
  l6: number;
} {
  const n = xs.length;
  let s6 = 0;
  let s5 = 0;
  let s4 = 0;
  let s3 = 0;
  let s1 = 0;
  for (const x of xs) {
    const x2 = x * x;
    const x3 = x2 * x;
    const x4 = x3 * x;
    const x5 = x4 * x;
    s6 += x5 * x;
    s5 += x5;
    s4 += x4;
    s3 += x3;
    s1 += x;
  }
  return {
    mean: s1 / n,
    l4: s3 === 0 ? 0 : s4 / s3,
    l5: s4 === 0 ? 0 : s5 / s4,
    l6: s5 === 0 ? 0 : s6 / s5,
  };
}

// ---------- shape / option validation ----------

test('l6: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenLehmer6Mean([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 1);
  assert.equal(r.minLehmer6Mean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'lehmer-6-mean-desc');
  assert.equal(r.generatedAt, GEN);
});

test('l6: minRows < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer6Mean([], { minRows: 0 }),
    /minRows must be an integer >= 1/,
  );
});

test('l6: minRows non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer6Mean([], {
        minRows: 2.5 as unknown as number,
      }),
    /minRows must be an integer >= 1/,
  );
});

test('l6: minLehmer6Mean negative throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer6Mean([], { minLehmer6Mean: -1 }),
    /minLehmer6Mean must be a finite, non-negative number/,
  );
});

test('l6: minLehmer6Mean NaN throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer6Mean([], { minLehmer6Mean: Number.NaN }),
    /minLehmer6Mean must be a finite, non-negative number/,
  );
});

test('l6: minLehmer6Mean Infinity throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer6Mean([], {
        minLehmer6Mean: Number.POSITIVE_INFINITY,
      }),
    /minLehmer6Mean must be a finite, non-negative number/,
  );
});

test('l6: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer6Mean([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('l6: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer6Mean([], { top: 2.5 }),
    /top must be a positive integer/,
  );
});

test('l6: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer6Mean([], {
        sort: 'banana' as unknown as 'lehmer-6-mean-desc',
      }),
    /sort must be one of/,
  );
});

test('l6: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer6Mean([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('l6: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer6Mean([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('l6: generatedAt defaults to now ISO when omitted', () => {
  const r = buildSourceRowTokenLehmer6Mean([]);
  assert.match(r.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

// ---------- arithmetic correctness ----------

test('l6: single positive row -> L_6 = L_5 = L_4 = mean = that row', () => {
  const queue = mkSeries('s', [42]);
  const r = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.lehmer6Mean, 42);
  assert.equal(row.lehmer5Mean, 42);
  assert.equal(row.lehmer4Mean, 42);
  assert.equal(row.mean, 42);
  assert.equal(row.l6L5Gap, 0);
  assert.equal(row.l6L4Gap, 0);
  assert.equal(row.l6AmGap, 0);
});

test('l6: constant positive series -> L_6 = c, all gaps = 0', () => {
  const queue = mkSeries('s', [7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.lehmer6Mean, 7);
  assert.equal(row.lehmer5Mean, 7);
  assert.equal(row.lehmer4Mean, 7);
  assert.equal(row.mean, 7);
  assert.equal(row.l6L5Gap, 0);
  assert.equal(row.l6L4Gap, 0);
  assert.equal(row.l6AmGap, 0);
});

test('l6: matches reference on [1,1,1,1,1000] (bottleneck domination > L_5)', () => {
  const xs = [1, 1, 1, 1, 1000];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
  const ref = l6Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer6Mean - ref.l6) < 1e-3);
  assert.ok(Math.abs(row.lehmer5Mean - ref.l5) < 1e-6);
  assert.ok(Math.abs(row.lehmer4Mean - ref.l4) < 1e-6);
  // L_6 should sit even closer to bottleneck than L_5
  assert.ok(row.lehmer6Mean > row.lehmer5Mean);
  assert.ok(row.lehmer6Mean < 1000);
  assert.ok(row.lehmer6Mean > 999.9999999);
});

test('l6: matches reference on [1,2,3,4,5]', () => {
  const xs = [1, 2, 3, 4, 5];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
  const ref = l6Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer6Mean - ref.l6) < 1e-9);
  // sum6 = 1+64+729+4096+15625 = 20515, sum5 = 1+32+243+1024+3125 = 4425
  // L_6 = 20515/4425
  assert.ok(Math.abs(row.lehmer6Mean - 20515 / 4425) < 1e-9);
});

test('l6: zero rows are no-ops; mixed [0, 0, 4]', () => {
  const xs = [0, 0, 4];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // sum6=4096, sum5=1024, sum4=256 -> L_6=4, L_5=4, L_4=4
  assert.equal(row.lehmer6Mean, 4);
  assert.equal(row.lehmer5Mean, 4);
  assert.equal(row.lehmer4Mean, 4);
  assert.ok(Math.abs(row.mean - 4 / 3) < 1e-9);
  assert.equal(row.l6L5Gap, 0);
  assert.equal(row.l6L4Gap, 0);
  assert.ok(Math.abs(row.l6AmGap - (4 - 4 / 3)) < 1e-9);
});

test('l6: all-zero source dropped', () => {
  const queue = mkSeries('s', [0, 0, 0, 0]);
  const r = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAllZeroSources, 1);
});

test('l6: cross-check L_4, L_5 against prior builders', () => {
  const xs = [3, 5, 8, 13, 21, 34];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
  const l5Report = buildSourceRowTokenLehmer5Mean(queue, { generatedAt: GEN });
  const l4Report = buildSourceRowTokenLehmer4Mean(queue, { generatedAt: GEN });
  const l3Report = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  const l5Row = l5Report.sources[0]!;
  const l4Row = l4Report.sources[0]!;
  const l3Row = l3Report.sources[0]!;
  assert.ok(Math.abs(row.lehmer5Mean - l5Row.lehmer5Mean) < 1e-9);
  assert.ok(Math.abs(row.lehmer4Mean - l4Row.lehmer4Mean) < 1e-9);
  assert.ok(Math.abs(row.mean - l5Row.mean) < 1e-9);
  // Lehmer monotonicity: L_6 >= L_5 >= L_4 >= L_3
  assert.ok(row.lehmer6Mean >= row.lehmer5Mean);
  assert.ok(row.lehmer5Mean >= row.lehmer4Mean);
  assert.ok(row.lehmer4Mean >= l3Row.lehmer3Mean);
  assert.ok(row.l6L5Gap >= 0);
  assert.ok(row.l6L4Gap >= row.l6L5Gap);
  assert.ok(row.l6AmGap >= row.l6L4Gap);
});

test('l6: scale-equivariance: rescale by 10 -> L_6 rescales by 10', () => {
  const xs = [1, 4, 9, 16, 25];
  const xs10 = xs.map((x) => x * 10);
  const r1 = buildSourceRowTokenLehmer6Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r10 = buildSourceRowTokenLehmer6Mean(mkSeries('s', xs10), {
    generatedAt: GEN,
  });
  const v1 = r1.sources[0]!.lehmer6Mean;
  const v10 = r10.sources[0]!.lehmer6Mean;
  assert.ok(Math.abs(v10 - v1 * 10) < 1e-5 * Math.max(1, v1 * 10));
});

test('l6: order-invariance: shuffle does not change L_6', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const xsShuf = [9, 5, 5, 6, 3, 4, 2, 3, 1, 1];
  const a = buildSourceRowTokenLehmer6Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const b = buildSourceRowTokenLehmer6Mean(mkSeries('s', xsShuf), {
    generatedAt: GEN,
  }).sources[0]!;
  assert.ok(Math.abs(a.lehmer6Mean - b.lehmer6Mean) < 1e-9);
});

// ---------- filtering / sort / top ----------

test('l6: drops negative total_tokens', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('2026-04-28T05:00:00.000Z', 's', -5),
  ];
  const r = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l6: drops invalid hour_start', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('not-a-date', 's', 9),
  ];
  const r = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l6: drops invalid total_tokens (NaN)', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('2026-04-28T05:00:00.000Z', 's', Number.NaN),
  ];
  const r = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('l6: source filter keeps only matches', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3]),
    ...mkSeries('b', [10, 20, 30]),
  ];
  const r = buildSourceRowTokenLehmer6Mean(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 3);
});

test('l6: minRows gate drops sub-threshold sources', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [10, 20]),
  ];
  const r = buildSourceRowTokenLehmer6Mean(queue, {
    generatedAt: GEN,
    minRows: 5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('l6: minLehmer6Mean cohort filter drops below threshold', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmer6Mean(queue, {
    generatedAt: GEN,
    minLehmer6Mean: 50,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinLehmer6Mean, 1);
});

test('l6: top cap suppresses tail and reports droppedBelowTopCap', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
    ...mkSeries('c', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmer6Mean(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  // Default sort: lehmer-6-mean-desc
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l6: sort=lehmer-6-mean-asc reverses order', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
  ];
  const r = buildSourceRowTokenLehmer6Mean(queue, {
    generatedAt: GEN,
    sort: 'lehmer-6-mean-asc',
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l6: sort=source orders alphabetically', () => {
  const queue = [
    ...mkSeries('zeta', [1, 2, 3]),
    ...mkSeries('alpha', [4, 5, 6]),
  ];
  const r = buildSourceRowTokenLehmer6Mean(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('l6: since/until window filters rows', () => {
  const queue = [
    ql('2026-04-27T10:00:00.000Z', 's', 1),
    ql('2026-04-28T10:00:00.000Z', 's', 2),
    ql('2026-04-29T10:00:00.000Z', 's', 4),
  ];
  const r = buildSourceRowTokenLehmer6Mean(queue, {
    generatedAt: GEN,
    since: '2026-04-28T00:00:00.000Z',
    until: '2026-04-29T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.rowsKept, 1);
  assert.equal(r.sources[0]!.lehmer6Mean, 2);
});

// ---------- property tests (Lehmer monotonicity) ----------

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('property: full ladder L_-3 <= L_-2 <= HM <= GM <= AM <= QM <= CHM <= L_3 <= L_4 <= L_5 <= L_6 (via gaps)', () => {
  // Use the in-builder fact L_6 >= L_5 >= L_4 >= AM and chain
  // through the L_6 builder's reported numbers. The lower-end
  // chain is pinned by the prior negative-Lehmer builders'
  // own property tests; here we pin the right-hand chain
  // L_4 <= L_5 <= L_6 across many random series.
  const r = rng(20260429);
  for (let trial = 0; trial < 60; trial += 1) {
    const n = 2 + Math.floor(r() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) {
      xs.push(Math.floor(r() * 1000));
    }
    if (xs.every((x) => x === 0)) continue;
    const queue = mkSeries(`t${trial}`, xs);
    const rep = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
    if (rep.sources.length === 0) continue;
    const row = rep.sources[0]!;
    assert.ok(
      row.lehmer6Mean + 1e-9 >= row.lehmer5Mean,
      `L_6(${row.lehmer6Mean}) should be >= L_5(${row.lehmer5Mean}) on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      row.lehmer5Mean + 1e-9 >= row.lehmer4Mean,
      `L_5 should be >= L_4 on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      row.lehmer4Mean + 1e-9 >= row.mean,
      `L_4 should be >= AM on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(row.l6L5Gap >= -1e-9);
    assert.ok(row.l6L4Gap >= -1e-9);
    assert.ok(row.l6AmGap >= -1e-9);
    // gaps are monotone in scope: |L_6 - AM| >= |L_6 - L_4| >= |L_6 - L_5|
    assert.ok(row.l6AmGap + 1e-9 >= row.l6L4Gap);
    assert.ok(row.l6L4Gap + 1e-9 >= row.l6L5Gap);
  }
});

test('property: L_6 = c on a constant positive series for arbitrary c', () => {
  const r = rng(424242);
  for (let trial = 0; trial < 30; trial += 1) {
    const c = 1 + Math.floor(r() * 5000);
    const n = 2 + Math.floor(r() * 20);
    const xs = new Array(n).fill(c);
    const rep = buildSourceRowTokenLehmer6Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    assert.ok(
      Math.abs(row.lehmer6Mean - c) < 1e-7 * c,
      `L_6 should equal c=${c} on constant series, got ${row.lehmer6Mean}`,
    );
    assert.ok(Math.abs(row.l6L5Gap) < 1e-7 * c);
    assert.ok(Math.abs(row.l6L4Gap) < 1e-7 * c);
    assert.ok(Math.abs(row.l6AmGap) < 1e-7 * c);
  }
});

test('property: scale-equivariance L_6(c*x) = c * L_6(x)', () => {
  const r = rng(99999);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 3 + Math.floor(r() * 15);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(1 + Math.floor(r() * 500));
    const c = 1 + Math.floor(r() * 50);
    const xsScaled = xs.map((x) => x * c);
    const a = buildSourceRowTokenLehmer6Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    }).sources[0]!.lehmer6Mean;
    const b = buildSourceRowTokenLehmer6Mean(mkSeries('s', xsScaled), {
      generatedAt: GEN,
    }).sources[0]!.lehmer6Mean;
    assert.ok(
      Math.abs(b - a * c) < 1e-5 * Math.max(1, a * c),
      `L_6 scale-equivariance failed: c=${c}, L_6(x)=${a}, L_6(c*x)=${b}`,
    );
  }
});

// ---------- self-fifth-power-weighted-mean closed-form property ----------
//
// L_6 is, by construction, the arithmetic mean of x_i weighted
// by w_i = x_i^5 / sum(x_j^5). This identity is the conceptual
// heart of the lens — it says "each row's contribution to the
// reported center is proportional to its own fifth power".
// Pin it explicitly so a future refactor that, e.g., divides by
// sum(x^4) instead of sum(x^5) (collapsing L_6 to L_5) trips
// this test, not just the numeric reference tests above.
test('property: L_6 equals the x^5-self-weighted arithmetic mean (closed form)', () => {
  const r = rng(27182);
  for (let trial = 0; trial < 40; trial += 1) {
    const n = 2 + Math.floor(r() * 25);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 1000));
    if (xs.every((x) => x === 0)) continue;
    // Closed-form weighted mean with weights w_i = x_i^5.
    let wsum = 0;
    let wxsum = 0;
    for (const x of xs) {
      const w = x * x * x * x * x;
      wsum += w;
      wxsum += w * x;
    }
    if (wsum === 0) continue;
    const closedForm = wxsum / wsum;
    const rep = buildSourceRowTokenLehmer6Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer6Mean;
    assert.ok(
      Math.abs(got - closedForm) < 1e-9 * Math.max(1, closedForm),
      `L_6 should equal sum(x^6)/sum(x^5) = sum(x*x^5)/sum(x^5) — got ${got} vs closed-form ${closedForm} on xs=${JSON.stringify(xs)}`,
    );
  }
});

// ---------- bottleneck-domination property ----------
//
// On a series of (n-1) tiny rows of value c plus one huge bottleneck
// row of value M (M >> c), L_6 must sit STRICTLY closer to M than
// L_5 does. This pins the documented claim that "L_6 amplifies the
// largest-row pull by another factor over L_5". A future refactor
// that, e.g., accidentally collapses L_6 toward L_5 (or AM) on a
// long-tailed series would trip this test even if the closed-form /
// monotonicity tests still pass on uniform random data.
test('property: L_6 is strictly closer to bottleneck M than L_5 on heavy-tailed series', () => {
  const r = rng(161803);
  for (let trial = 0; trial < 25; trial += 1) {
    const n = 4 + Math.floor(r() * 12); // 4..15 rows
    const c = 1 + Math.floor(r() * 5); // small base value
    const M = c * (1000 + Math.floor(r() * 9000)); // bottleneck >> c
    const xs = new Array(n - 1).fill(c);
    xs.push(M);
    const rep = buildSourceRowTokenLehmer6Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    const distL6 = M - row.lehmer6Mean;
    const distL5 = M - row.lehmer5Mean;
    assert.ok(
      distL6 >= -1e-6 * M,
      `L_6 should not exceed M=${M}; got L_6=${row.lehmer6Mean}`,
    );
    assert.ok(
      distL5 >= -1e-6 * M,
      `L_5 should not exceed M=${M}; got L_5=${row.lehmer5Mean}`,
    );
    // L_6 strictly closer (or equal up to FP noise) to the bottleneck than L_5
    assert.ok(
      distL6 <= distL5 + 1e-6 * M,
      `L_6 should be <= L_5 distance to M=${M}: distL6=${distL6}, distL5=${distL5}, xs=${JSON.stringify(xs)}`,
    );
    // And the gap should be meaningful — at least a factor of 2 closer
    // for a (n-1) tiny + 1 huge configuration. Pick a conservative
    // bound that still trips on a "L_6 collapses to L_5" regression.
    assert.ok(
      distL6 * 2 <= distL5 + 1e-6 * M,
      `L_6 should be at least 2x closer to M=${M} than L_5: distL6=${distL6}, distL5=${distL5}, xs=${JSON.stringify(xs)}`,
    );
  }
});

// ---------- refinement: bottleneck-tracking error ratio ----------
//
// Sharper version of the bottleneck-domination property: on a series
// with a single dominant element of value M and (n-1) tiny rows of
// value c, the closed-form bottleneck-tracking error of each Lehmer
// rung is dominated by the (k-1) tiny rows. For L_p:
//
//     dist_p(M) = M - L_p = M * (n-1) c^p / ( (n-1) c^p + M^p )
//                          ~ (n-1) * c^p / M^{p-1}     when M >> c
//
// So the asymptotic ratio
//
//     dist_{p+1}(M) / dist_p(M) ~ c / M
//
// which is *much* smaller than 0.5 once `M / c` is large. This is a
// strictly stronger claim than the previous "L_6 is at least 2x closer
// to M than L_5" property: here we pin that on a sufficiently long-
// tailed series the ratio is below 0.5 with a comfortable margin (we
// require <= 0.05, i.e. L_6's bottleneck-tracking error is at most
// 5 % of L_5's). A future refactor that, for example, accidentally
// shifted L_6's exponent back to 5 (collapsing it to L_5) would still
// have ratio = 1 here and would trip this test very loudly.
test('refinement: bottleneck-tracking error of L_6 is <= 10 % of L_5 on heavy-tailed (M/c in [50, 200]) series', () => {
  const r = rng(31415927);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 4 + Math.floor(r() * 12); // 4..15 rows
    const c = 1 + Math.floor(r() * 5); // small base value
    // Pick M/c in [50, 200]. Reasoning:
    //
    //   dist_p(M) / M  ~  (n-1) * (c/M)^p     (M >> c, p >= 1)
    //   ratio = dist_6 / dist_5  ~  c / M  in  [1/200, 1/50]
    //                            =  [0.5%, 2%]
    //   dist_5 / M  ~  (n-1) * (c/M)^5
    //
    //   At M/c = 50, n = 4: dist_5/M ~ 3 * 50^-5 ~ 1e-8
    //   -> distL5 absolute ~ 1e-8 * M ~ 1e-6 for M ~ 100. Plenty
    //      above the 64-bit FP noise floor of M*~1e-15.
    //
    //   The 10 % bound is a conservative ceiling on the asymptotic
    //   2 % — pads for finite-n and FP noise. A future refactor
    //   that accidentally collapsed L_6 to L_5 would have ratio = 1
    //   and trip this test by ~10x.
    const M = c * (50 + Math.floor(r() * 150));
    const xs = new Array(n - 1).fill(c);
    xs.push(M);
    const rep = buildSourceRowTokenLehmer6Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    const distL6 = Math.max(0, M - row.lehmer6Mean);
    const distL5 = Math.max(0, M - row.lehmer5Mean);
    assert.ok(
      distL5 > 1e-12 * M,
      `expected L_5 measurably below M=${M} on xs=${JSON.stringify(xs)}; got distL5=${distL5}`,
    );
    const ratio = distL6 / distL5;
    assert.ok(
      ratio <= 0.1,
      `L_6 bottleneck-tracking error should be <= 10 % of L_5: M=${M}, c=${c}, n=${n}, distL6=${distL6}, distL5=${distL5}, ratio=${ratio}, xs=${JSON.stringify(xs)}`,
    );
  }
});
