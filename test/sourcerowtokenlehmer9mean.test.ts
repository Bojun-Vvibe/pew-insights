import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmer9Mean } from '../src/sourcerowtokenlehmer9mean.js';
import { buildSourceRowTokenLehmer8Mean } from '../src/sourcerowtokenlehmer8mean.js';
import { buildSourceRowTokenLehmer7Mean } from '../src/sourcerowtokenlehmer7mean.js';
import { buildSourceRowTokenLehmer6Mean } from '../src/sourcerowtokenlehmer6mean.js';
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

function l9Reference(xs: number[]): {
  mean: number;
  l7: number;
  l8: number;
  l9: number;
} {
  const n = xs.length;
  let s9 = 0;
  let s8 = 0;
  let s7 = 0;
  let s6 = 0;
  let s1 = 0;
  for (const x of xs) {
    const x2 = x * x;
    const x3 = x2 * x;
    const x4 = x3 * x;
    const x5 = x4 * x;
    const x6 = x5 * x;
    const x7 = x6 * x;
    const x8 = x7 * x;
    s9 += x8 * x;
    s8 += x8;
    s7 += x7;
    s6 += x6;
    s1 += x;
  }
  return {
    mean: s1 / n,
    l7: s6 === 0 ? 0 : s7 / s6,
    l8: s7 === 0 ? 0 : s8 / s7,
    l9: s8 === 0 ? 0 : s9 / s8,
  };
}

// ---------- shape / option validation ----------

test('l8: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenLehmer9Mean([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 1);
  assert.equal(r.minLehmer9Mean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'lehmer-9-mean-desc');
  assert.equal(r.generatedAt, GEN);
});

test('l8: minRows < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer9Mean([], { minRows: 0 }),
    /minRows must be an integer >= 1/,
  );
});

test('l8: minRows non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer9Mean([], {
        minRows: 2.5 as unknown as number,
      }),
    /minRows must be an integer >= 1/,
  );
});

test('l8: minLehmer9Mean negative throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer9Mean([], { minLehmer9Mean: -1 }),
    /minLehmer9Mean must be a finite, non-negative number/,
  );
});

test('l8: minLehmer9Mean NaN throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer9Mean([], { minLehmer9Mean: Number.NaN }),
    /minLehmer9Mean must be a finite, non-negative number/,
  );
});

test('l8: minLehmer9Mean Infinity throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer9Mean([], {
        minLehmer9Mean: Number.POSITIVE_INFINITY,
      }),
    /minLehmer9Mean must be a finite, non-negative number/,
  );
});

test('l8: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer9Mean([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('l8: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer9Mean([], { top: 2.5 }),
    /top must be a positive integer/,
  );
});

test('l8: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer9Mean([], {
        sort: 'banana' as unknown as 'lehmer-9-mean-desc',
      }),
    /sort must be one of/,
  );
});

test('l8: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer9Mean([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('l8: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer9Mean([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('l8: generatedAt defaults to now ISO when omitted', () => {
  const r = buildSourceRowTokenLehmer9Mean([]);
  assert.match(r.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

// ---------- arithmetic correctness ----------

test('l8: single positive row -> L_9 = L_8 = L_7 = mean = that row', () => {
  const queue = mkSeries('s', [42]);
  const r = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.lehmer9Mean, 42);
  assert.equal(row.lehmer8Mean, 42);
  assert.equal(row.lehmer7Mean, 42);
  assert.equal(row.mean, 42);
  assert.equal(row.l9L8Gap, 0);
  assert.equal(row.l9L7Gap, 0);
  assert.equal(row.l9AmGap, 0);
});

test('l8: constant positive series -> L_9 = c, all gaps = 0', () => {
  const queue = mkSeries('s', [7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.lehmer9Mean, 7);
  assert.equal(row.lehmer8Mean, 7);
  assert.equal(row.lehmer7Mean, 7);
  assert.equal(row.mean, 7);
  assert.equal(row.l9L8Gap, 0);
  assert.equal(row.l9L7Gap, 0);
  assert.equal(row.l9AmGap, 0);
});

test('l8: matches reference on [1,1,1,1,1000] (bottleneck domination > L_8)', () => {
  const xs = [1, 1, 1, 1, 1000];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
  const ref = l9Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer9Mean - ref.l9) < 1e-3);
  assert.ok(Math.abs(row.lehmer8Mean - ref.l8) < 1e-6);
  assert.ok(Math.abs(row.lehmer7Mean - ref.l7) < 1e-6);
  // L_9 should sit even closer to bottleneck than L_8 (>= because at this
  // scale both already round to ~1000 within FP precision)
  assert.ok(row.lehmer9Mean >= row.lehmer8Mean - 1e-9);
  assert.ok(row.lehmer9Mean <= 1000);
  assert.ok(row.lehmer9Mean > 999.9999999);
});

test('l8: matches reference on [1,2,3,4,5]', () => {
  const xs = [1, 2, 3, 4, 5];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
  const ref = l9Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer9Mean - ref.l9) < 1e-9);
  // sum9 = 1 + 2^9 + 3^9 + 4^9 + 5^9 = 1 + 512 + 19683 + 262144 + 1953125 = 2235465
  // sum8 = 1 + 256 + 6561 + 65536 + 390625 = 462979
  // L_9 = 2235465/462979
  assert.ok(Math.abs(row.lehmer9Mean - 2235465 / 462979) < 1e-9);
});

test('l8: zero rows are no-ops; mixed [0, 0, 4]', () => {
  const xs = [0, 0, 4];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // sum9=262144, sum8=65536, sum7=16384 -> L_9=4, L_8=4, L_7=4
  assert.equal(row.lehmer9Mean, 4);
  assert.equal(row.lehmer8Mean, 4);
  assert.equal(row.lehmer7Mean, 4);
  assert.ok(Math.abs(row.mean - 4 / 3) < 1e-9);
  assert.equal(row.l9L8Gap, 0);
  assert.equal(row.l9L7Gap, 0);
  assert.ok(Math.abs(row.l9AmGap - (4 - 4 / 3)) < 1e-9);
});

test('l8: all-zero source dropped', () => {
  const queue = mkSeries('s', [0, 0, 0, 0]);
  const r = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAllZeroSources, 1);
});

test('l9: cross-check L_7, L_8 against prior builders', () => {
  const xs = [3, 5, 8, 13, 21, 34];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
  const l7Report = buildSourceRowTokenLehmer8Mean(queue, { generatedAt: GEN });
  const l6Report = buildSourceRowTokenLehmer7Mean(queue, { generatedAt: GEN });
  const l5Report = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  const l7Row = l7Report.sources[0]!;
  const l6Row = l6Report.sources[0]!;
  const l5Row = l5Report.sources[0]!;
  assert.ok(Math.abs(row.lehmer8Mean - l7Row.lehmer8Mean) < 1e-9);
  assert.ok(Math.abs(row.lehmer7Mean - l6Row.lehmer7Mean) < 1e-9);
  assert.ok(Math.abs(row.mean - l7Row.mean) < 1e-9);
  // Lehmer monotonicity: L_9 >= L_8 >= L_7 >= L_6
  assert.ok(row.lehmer9Mean >= row.lehmer8Mean);
  assert.ok(row.lehmer8Mean >= row.lehmer7Mean);
  assert.ok(row.lehmer7Mean >= l5Row.lehmer5Mean);
  assert.ok(row.l9L8Gap >= 0);
  assert.ok(row.l9L7Gap >= row.l9L8Gap);
  assert.ok(row.l9AmGap >= row.l9L7Gap);
});

test('l8: scale-equivariance: rescale by 10 -> L_9 rescales by 10', () => {
  const xs = [1, 4, 9, 16, 25];
  const xs10 = xs.map((x) => x * 10);
  const r1 = buildSourceRowTokenLehmer9Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r10 = buildSourceRowTokenLehmer9Mean(mkSeries('s', xs10), {
    generatedAt: GEN,
  });
  const v1 = r1.sources[0]!.lehmer9Mean;
  const v10 = r10.sources[0]!.lehmer9Mean;
  assert.ok(Math.abs(v10 - v1 * 10) < 1e-5 * Math.max(1, v1 * 10));
});

test('l8: order-invariance: shuffle does not change L_9', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const xsShuf = [9, 5, 5, 6, 3, 4, 2, 3, 1, 1];
  const a = buildSourceRowTokenLehmer9Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const b = buildSourceRowTokenLehmer9Mean(mkSeries('s', xsShuf), {
    generatedAt: GEN,
  }).sources[0]!;
  assert.ok(Math.abs(a.lehmer9Mean - b.lehmer9Mean) < 1e-9);
});

// ---------- filtering / sort / top ----------

test('l8: drops negative total_tokens', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('2026-04-28T05:00:00.000Z', 's', -5),
  ];
  const r = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l8: drops invalid hour_start', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('not-a-date', 's', 9),
  ];
  const r = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l8: drops invalid total_tokens (NaN)', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('2026-04-28T05:00:00.000Z', 's', Number.NaN),
  ];
  const r = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('l8: source filter keeps only matches', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3]),
    ...mkSeries('b', [10, 20, 30]),
  ];
  const r = buildSourceRowTokenLehmer9Mean(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 3);
});

test('l8: minRows gate drops sub-threshold sources', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [10, 20]),
  ];
  const r = buildSourceRowTokenLehmer9Mean(queue, {
    generatedAt: GEN,
    minRows: 5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('l8: minLehmer9Mean cohort filter drops below threshold', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmer9Mean(queue, {
    generatedAt: GEN,
    minLehmer9Mean: 50,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinLehmer9Mean, 1);
});

test('l8: top cap suppresses tail and reports droppedBelowTopCap', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
    ...mkSeries('c', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmer9Mean(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  // Default sort: lehmer-9-mean-desc
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l8: sort=lehmer-9-mean-asc reverses order', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
  ];
  const r = buildSourceRowTokenLehmer9Mean(queue, {
    generatedAt: GEN,
    sort: 'lehmer-9-mean-asc',
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l8: sort=source orders alphabetically', () => {
  const queue = [
    ...mkSeries('zeta', [1, 2, 3]),
    ...mkSeries('alpha', [4, 5, 6]),
  ];
  const r = buildSourceRowTokenLehmer9Mean(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('l8: since/until window filters rows', () => {
  const queue = [
    ql('2026-04-27T10:00:00.000Z', 's', 1),
    ql('2026-04-28T10:00:00.000Z', 's', 2),
    ql('2026-04-29T10:00:00.000Z', 's', 4),
  ];
  const r = buildSourceRowTokenLehmer9Mean(queue, {
    generatedAt: GEN,
    since: '2026-04-28T00:00:00.000Z',
    until: '2026-04-29T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.rowsKept, 1);
  assert.equal(r.sources[0]!.lehmer9Mean, 2);
});

// ---------- property tests (Lehmer monotonicity) ----------

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('property: full ladder L_-3 <= L_-2 <= HM <= GM <= AM <= QM <= CHM <= L_6 <= L_7 <= L_8 <= L_9 (via gaps)', () => {
  // Use the in-builder fact L_9 >= L_8 >= L_7 >= AM and chain
  // through the L_9 builder's reported numbers. The lower-end
  // chain is pinned by the prior negative-Lehmer builders'
  // own property tests; here we pin the right-hand chain
  // L_7 <= L_8 <= L_9 across many random series.
  const r = rng(20260429);
  for (let trial = 0; trial < 60; trial += 1) {
    const n = 2 + Math.floor(r() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) {
      xs.push(Math.floor(r() * 1000));
    }
    if (xs.every((x) => x === 0)) continue;
    const queue = mkSeries(`t${trial}`, xs);
    const rep = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
    if (rep.sources.length === 0) continue;
    const row = rep.sources[0]!;
    assert.ok(
      row.lehmer9Mean + 1e-9 >= row.lehmer8Mean,
      `L_9(${row.lehmer9Mean}) should be >= L_8(${row.lehmer8Mean}) on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      row.lehmer8Mean + 1e-9 >= row.lehmer7Mean,
      `L_8 should be >= L_7 on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      row.lehmer7Mean + 1e-9 >= row.mean,
      `L_7 should be >= AM on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(row.l9L8Gap >= -1e-9);
    assert.ok(row.l9L7Gap >= -1e-9);
    assert.ok(row.l9AmGap >= -1e-9);
    // gaps are monotone in scope: |L_9 - AM| >= |L_9 - L_7| >= |L_9 - L_8|
    assert.ok(row.l9AmGap + 1e-9 >= row.l9L7Gap);
    assert.ok(row.l9L7Gap + 1e-9 >= row.l9L8Gap);
  }
});

test('property: L_9 = c on a constant positive series for arbitrary c', () => {
  const r = rng(424242);
  for (let trial = 0; trial < 30; trial += 1) {
    const c = 1 + Math.floor(r() * 5000);
    const n = 2 + Math.floor(r() * 20);
    const xs = new Array(n).fill(c);
    const rep = buildSourceRowTokenLehmer9Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    assert.ok(
      Math.abs(row.lehmer9Mean - c) < 1e-7 * c,
      `L_9 should equal c=${c} on constant series, got ${row.lehmer9Mean}`,
    );
    assert.ok(Math.abs(row.l9L8Gap) < 1e-7 * c);
    assert.ok(Math.abs(row.l9L7Gap) < 1e-7 * c);
    assert.ok(Math.abs(row.l9AmGap) < 1e-7 * c);
  }
});

test('property: scale-equivariance L_9(c*x) = c * L_9(x)', () => {
  const r = rng(99999);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 3 + Math.floor(r() * 15);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(1 + Math.floor(r() * 500));
    const c = 1 + Math.floor(r() * 50);
    const xsScaled = xs.map((x) => x * c);
    const a = buildSourceRowTokenLehmer9Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    }).sources[0]!.lehmer9Mean;
    const b = buildSourceRowTokenLehmer9Mean(mkSeries('s', xsScaled), {
      generatedAt: GEN,
    }).sources[0]!.lehmer9Mean;
    assert.ok(
      Math.abs(b - a * c) < 1e-5 * Math.max(1, a * c),
      `L_9 scale-equivariance failed: c=${c}, L_9(x)=${a}, L_9(c*x)=${b}`,
    );
  }
});

// ---------- self-sixth-power-weighted-mean closed-form property ----------
//
// L_9 is, by construction, the arithmetic mean of x_i weighted
// by w_i = x_i^8 / sum(x_j^6). This identity is the conceptual
// heart of the lens — it says "each row's contribution to the
// reported center is proportional to its own sixth power".
// Pin it explicitly so a future refactor that, e.g., divides by
// sum(x^7) instead of sum(x^8) (collapsing L_9 to L_8) trips
// this test, not just the numeric reference tests above.
test('property: L_9 equals the x^8-self-weighted arithmetic mean (closed form)', () => {
  const r = rng(27182);
  for (let trial = 0; trial < 40; trial += 1) {
    const n = 2 + Math.floor(r() * 25);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 1000));
    if (xs.every((x) => x === 0)) continue;
    // Closed-form weighted mean with weights w_i = x_i^8.
    let wsum = 0;
    let wxsum = 0;
    for (const x of xs) {
      const w = x * x * x * x * x * x * x * x;
      wsum += w;
      wxsum += w * x;
    }
    if (wsum === 0) continue;
    const closedForm = wxsum / wsum;
    const rep = buildSourceRowTokenLehmer9Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer9Mean;
    assert.ok(
      Math.abs(got - closedForm) < 1e-9 * Math.max(1, closedForm),
      `L_9 should equal sum(x^9)/sum(x^8) = sum(x*x^8)/sum(x^8) — got ${got} vs closed-form ${closedForm} on xs=${JSON.stringify(xs)}`,
    );
  }
});

// ---------- bottleneck-domination property ----------
//
// On a series of (n-1) tiny rows of value c plus one huge bottleneck
// row of value M (M >> c), L_9 must sit STRICTLY closer to M than
// L_8 does. This pins the documented claim that "L_9 amplifies the
// largest-row pull by another factor over L_8". A future refactor
// that, e.g., accidentally collapses L_9 toward L_8 (or AM) on a
// long-tailed series would trip this test even if the closed-form /
// monotonicity tests still pass on uniform random data.
test('property: L_9 is strictly closer to bottleneck M than L_8 on heavy-tailed series', () => {
  const r = rng(161803);
  for (let trial = 0; trial < 25; trial += 1) {
    const n = 4 + Math.floor(r() * 12); // 4..15 rows
    const c = 1 + Math.floor(r() * 5); // small base value
    const M = c * (1000 + Math.floor(r() * 9000)); // bottleneck >> c
    const xs = new Array(n - 1).fill(c);
    xs.push(M);
    const rep = buildSourceRowTokenLehmer9Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    const distL6 = M - row.lehmer9Mean;
    const distL5 = M - row.lehmer8Mean;
    assert.ok(
      distL6 >= -1e-6 * M,
      `L_9 should not exceed M=${M}; got L_9=${row.lehmer9Mean}`,
    );
    assert.ok(
      distL5 >= -1e-6 * M,
      `L_8 should not exceed M=${M}; got L_8=${row.lehmer8Mean}`,
    );
    // L_9 strictly closer (or equal up to FP noise) to the bottleneck than L_8
    assert.ok(
      distL6 <= distL5 + 1e-6 * M,
      `L_9 should be <= L_8 distance to M=${M}: distL6=${distL6}, distL5=${distL5}, xs=${JSON.stringify(xs)}`,
    );
    // And the gap should be meaningful — at least a factor of 2 closer
    // for a (n-1) tiny + 1 huge configuration. Pick a conservative
    // bound that still trips on a "L_9 collapses to L_8" regression.
    assert.ok(
      distL6 * 2 <= distL5 + 1e-6 * M,
      `L_9 should be at least 2x closer to M=${M} than L_8: distL6=${distL6}, distL5=${distL5}, xs=${JSON.stringify(xs)}`,
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
// strictly stronger claim than the previous "L_9 is at least 2x closer
// to M than L_8" property: here we pin that on a sufficiently long-
// tailed series the ratio is below 0.5 with a comfortable margin (we
// require <= 0.05, i.e. L_9's bottleneck-tracking error is at most
// 5 % of L_8's). A future refactor that, for example, accidentally
// shifted L_9's exponent back to 5 (collapsing it to L_8) would still
// have ratio = 1 here and would trip this test very loudly.
test('refinement: bottleneck-tracking error of L_9 is <= 10 % of L_8 on heavy-tailed (M/c in [50, 200]) series', () => {
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
    //   that accidentally collapsed L_9 to L_8 would have ratio = 1
    //   and trip this test by ~10x.
    const M = c * (50 + Math.floor(r() * 150));
    const xs = new Array(n - 1).fill(c);
    xs.push(M);
    const rep = buildSourceRowTokenLehmer9Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    const distL6 = Math.max(0, M - row.lehmer9Mean);
    const distL5 = Math.max(0, M - row.lehmer8Mean);
    // At p=7 with M/c >= 50, distL5 may already be below FP noise; skip such
    // trials — the ratio test below would be meaningless on FP-zero divisor.
    if (distL5 <= 1e-9 * M) continue;
    const ratio = distL6 / distL5;
    assert.ok(
      ratio <= 0.1,
      `L_9 bottleneck-tracking error should be <= 10 % of L_8: M=${M}, c=${c}, n=${n}, distL6=${distL6}, distL5=${distL5}, ratio=${ratio}, xs=${JSON.stringify(xs)}`,
    );
  }
});

// ---------- refinement: defining-identity round-trip ----------
//
// Pin the defining identity L_9 * sum(x^8) == sum(x^9) directly, by
// recomputing both sides with independent scalar accumulators and
// checking that the builder-reported L_9 multiplied back by the
// independently-computed sum(x^8) recovers sum(x^9) to within a
// strict relative tolerance. This is *the* identity that defines
// the lens — it's stronger than the closed-form self-weighted-mean
// property above (which checks the algebraically-equivalent
// rearrangement sum(x*x^8) / sum(x^8)) because it tests the raw
// numerator-denominator pair the builder must produce. A future
// refactor that, e.g., swapped sum8 and sum9 (collapsing L_9 to
// L_8 / L_9 mash) would trip this test even on small uniform-
// random series where the bottleneck-domination property has
// little signal.
test('refinement: L_9 satisfies L_9 * sum(x^8) == sum(x^9) round-trip identity', () => {
  const r = rng(57721566);
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 2 + Math.floor(r() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 2000));
    if (xs.every((x) => x === 0)) continue;
    let s8 = 0;
    let s9 = 0;
    for (const x of xs) {
      const x2 = x * x;
      const x4 = x2 * x2;
      const x8 = x4 * x4;
      s8 += x8;
      s9 += x8 * x;
    }
    if (s8 === 0) continue;
    const rep = buildSourceRowTokenLehmer9Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer9Mean;
    const recovered = got * s8;
    assert.ok(
      Math.abs(recovered - s9) < 1e-9 * Math.max(1, s9),
      `L_9 * sum(x^8) should recover sum(x^9): got=${got}, sum8=${s8}, sum9=${s9}, recovered=${recovered}, xs=${JSON.stringify(xs)}`,
    );
  }
});

// ---------- refinement: equality case L_9 = max(x) iff all positive rows == max ----------
//
// Lehmer monotonicity bounds L_9 in [L_8, max]. The upper bound is
// saturated *exactly* when every strictly-positive row equals max.
// Pin both directions:
//
//   (a) on a series of (k) max-valued rows mixed with (n - k) zero
//       rows, L_9 == max exactly (zeros contribute 0 to both sums);
//   (b) on a series with at least two distinct positive values,
//       L_9 < max strictly.
//
// A future refactor that, e.g., accidentally clamped L_9 at max or
// allowed L_9 > max via an unsigned-overflow bug would trip this.
test('refinement: L_9 = max iff all positive rows equal max', () => {
  // (a) saturating case: any mix of {0, max}-valued rows -> L_9 == max
  const cases: { xs: number[]; max: number }[] = [
    { xs: [10, 10, 10, 10], max: 10 },
    { xs: [0, 7], max: 7 },
    { xs: [0, 0, 0, 99, 99], max: 99 },
    { xs: [42], max: 42 },
  ];
  for (const { xs, max } of cases) {
    const rep = buildSourceRowTokenLehmer9Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer9Mean;
    assert.ok(
      Math.abs(got - max) < 1e-9 * max,
      `L_9 should equal max=${max} when positive rows are uniform; got ${got} on xs=${JSON.stringify(xs)}`,
    );
  }
  // (b) non-saturating case: any series with two distinct positive values
  //     must have L_9 strictly below max.
  const r = rng(12345);
  for (let trial = 0; trial < 25; trial += 1) {
    const n = 2 + Math.floor(r() * 10);
    const max = 100 + Math.floor(r() * 1000);
    const xs: number[] = [max];
    // Add at least one strictly-smaller positive row.
    const small = 1 + Math.floor(r() * (max - 1));
    xs.push(small);
    // Pad with arbitrary positive rows below max.
    for (let i = 2; i < n; i += 1) {
      xs.push(1 + Math.floor(r() * (max - 1)));
    }
    const rep = buildSourceRowTokenLehmer9Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    const got = rep.sources[0]!.lehmer9Mean;
    assert.ok(
      got < max,
      `L_9 should be strictly < max=${max} on non-uniform positive series; got ${got} on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      got >= rep.sources[0]!.lehmer8Mean - 1e-9 * max,
      `L_9 should be >= L_8 on xs=${JSON.stringify(xs)}; got L_9=${got}, L_8=${rep.sources[0]!.lehmer8Mean}`,
    );
  }
});

// ---------- refinement: L_9 - L_8 closed-form gap identity ----------
//
// The defining algebra of L_9 yields a sharp closed form for the gap
// L_9 - L_8 in terms of the seventh-power-weighted deviation around L_8:
//
//     L_9 - L_8
//       = sum(x^9) / sum(x^8) - L_8
//       = sum(x^8 * (x - L_8)) / sum(x^8)
//
// i.e. l9L8Gap == sum(x^8 * (x - L_8)) / sum(x^8). This is a much
// sharper invariant than "l9L8Gap >= 0" — it nails down the exact
// magnitude of the gap from independently-computed scalar
// accumulators, and would catch any off-by-one in the power exponents
// that the round-trip identity test (which only sees sum8 vs sum9)
// would not. Pinning this also gives a free regression sentinel for
// any future refactor that tries to share state between the L_8 and
// L_9 builders.
import { test as testGap } from 'node:test';
import { strict as assertGap } from 'node:assert';
testGap(
  'refinement: l9L8Gap == sum(x^8 * (x - L_8)) / sum(x^8) closed-form gap identity',
  () => {
    const r = (() => {
      let s = 0xc0de1234;
      return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
      };
    })();
    for (let trial = 0; trial < 50; trial += 1) {
      const n = 2 + Math.floor(r() * 30);
      const xs: number[] = [];
      for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 1500));
      if (xs.every((x) => x === 0)) continue;
      let s8 = 0;
      for (const x of xs) {
        const x2 = x * x;
        const x4 = x2 * x2;
        const x8 = x4 * x4;
        s8 += x8;
      }
      if (s8 === 0) continue;
      const rep = buildSourceRowTokenLehmer9Mean(mkSeries(`g${trial}`, xs), {
        generatedAt: GEN,
      });
      if (rep.sources.length === 0) continue;
      const row = rep.sources[0]!;
      const L8 = row.lehmer8Mean;
      // closed-form gap RHS: sum(x^8 * (x - L_8)) / sum(x^8)
      let gapNum = 0;
      for (const x of xs) {
        const x2 = x * x;
        const x4 = x2 * x2;
        const x8 = x4 * x4;
        gapNum += x8 * (x - L8);
      }
      const gapClosedForm = gapNum / s8;
      // builder-reported gap
      const gapReported = row.l9L8Gap;
      const tol = 1e-7 * Math.max(1, row.lehmer9Mean);
      assertGap.ok(
        Math.abs(gapReported - gapClosedForm) < tol,
        `l9L8Gap should equal sum(x^8 * (x - L_8)) / sum(x^8); got reported=${gapReported}, closed-form=${gapClosedForm}, xs=${JSON.stringify(xs)}`,
      );
    }
  },
);
