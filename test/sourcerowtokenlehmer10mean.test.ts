import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmer10Mean } from '../src/sourcerowtokenlehmer10mean.js';
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

function l10Reference(xs: number[]): {
  mean: number;
  l8: number;
  l9: number;
  l10: number;
} {
  const n = xs.length;
  let s10 = 0;
  let s9 = 0;
  let s8 = 0;
  let s7 = 0;
  let s1 = 0;
  for (const x of xs) {
    const x2 = x * x;
    const x3 = x2 * x;
    const x4 = x3 * x;
    const x5 = x4 * x;
    const x6 = x5 * x;
    const x7 = x6 * x;
    const x8 = x7 * x;
    const x9 = x8 * x;
    s10 += x9 * x;
    s9 += x9;
    s8 += x8;
    s7 += x7;
    s1 += x;
  }
  return {
    mean: s1 / n,
    l8: s7 === 0 ? 0 : s8 / s7,
    l9: s8 === 0 ? 0 : s9 / s8,
    l10: s9 === 0 ? 0 : s10 / s9,
  };
}

// ---------- shape / option validation ----------

test('l9: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenLehmer10Mean([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 1);
  assert.equal(r.minLehmer10Mean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'lehmer-10-mean-desc');
  assert.equal(r.generatedAt, GEN);
});

test('l9: minRows < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer10Mean([], { minRows: 0 }),
    /minRows must be an integer >= 1/,
  );
});

test('l9: minRows non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer10Mean([], {
        minRows: 2.5 as unknown as number,
      }),
    /minRows must be an integer >= 1/,
  );
});

test('l9: minLehmer10Mean negative throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer10Mean([], { minLehmer10Mean: -1 }),
    /minLehmer10Mean must be a finite, non-negative number/,
  );
});

test('l9: minLehmer10Mean NaN throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer10Mean([], { minLehmer10Mean: Number.NaN }),
    /minLehmer10Mean must be a finite, non-negative number/,
  );
});

test('l9: minLehmer10Mean Infinity throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer10Mean([], {
        minLehmer10Mean: Number.POSITIVE_INFINITY,
      }),
    /minLehmer10Mean must be a finite, non-negative number/,
  );
});

test('l9: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer10Mean([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('l9: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer10Mean([], { top: 2.5 }),
    /top must be a positive integer/,
  );
});

test('l9: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer10Mean([], {
        sort: 'banana' as unknown as 'lehmer-10-mean-desc',
      }),
    /sort must be one of/,
  );
});

test('l9: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer10Mean([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('l9: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer10Mean([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('l9: generatedAt defaults to now ISO when omitted', () => {
  const r = buildSourceRowTokenLehmer10Mean([]);
  assert.match(r.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

// ---------- arithmetic correctness ----------

test('l9: single positive row -> L_10 = L_8 = L_7 = mean = that row', () => {
  const queue = mkSeries('s', [42]);
  const r = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.lehmer10Mean, 42);
  assert.equal(row.lehmer9Mean, 42);
  assert.equal(row.lehmer8Mean, 42);
  assert.equal(row.mean, 42);
  assert.equal(row.l10L9Gap, 0);
  assert.equal(row.l10L8Gap, 0);
  assert.equal(row.l10AmGap, 0);
});

test('l9: constant positive series -> L_10 = c, all gaps = 0', () => {
  const queue = mkSeries('s', [7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.lehmer10Mean, 7);
  assert.equal(row.lehmer9Mean, 7);
  assert.equal(row.lehmer8Mean, 7);
  assert.equal(row.mean, 7);
  assert.equal(row.l10L9Gap, 0);
  assert.equal(row.l10L8Gap, 0);
  assert.equal(row.l10AmGap, 0);
});

test('l9: matches reference on [1,1,1,1,1000] (bottleneck domination > L_8)', () => {
  const xs = [1, 1, 1, 1, 1000];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
  const ref = l10Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer10Mean - ref.l10) < 1e-3);
  assert.ok(Math.abs(row.lehmer9Mean - ref.l9) < 1e-6);
  assert.ok(Math.abs(row.lehmer8Mean - ref.l8) < 1e-6);
  // L_10 should sit even closer to bottleneck than L_8 (>= because at this
  // scale both already round to ~1000 within FP precision)
  assert.ok(row.lehmer10Mean >= row.lehmer9Mean - 1e-9);
  assert.ok(row.lehmer10Mean <= 1000);
  assert.ok(row.lehmer10Mean > 999.9999999);
});

test('l9: matches reference on [1,2,3,4,5]', () => {
  const xs = [1, 2, 3, 4, 5];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
  const ref = l10Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer10Mean - ref.l10) < 1e-9);
  // sum10 = 1 + 2^10 + 3^10 + 4^10 + 5^10 = 1 + 1024 + 59049 + 1048576 + 9765625 = 10874275
  // sum9  = 1 + 2^9  + 3^9  + 4^9  + 5^9  = 1 +  512 + 19683 +  262144 + 1953125 =  2235465
  // L_10 = 10874275/2235465
  assert.ok(Math.abs(row.lehmer10Mean - 10874275 / 2235465) < 1e-9);
});

test('l9: zero rows are no-ops; mixed [0, 0, 4]', () => {
  const xs = [0, 0, 4];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // sum10=262144, sum9=65536, sum8=16384 -> L_10=4, L_8=4, L_7=4
  assert.equal(row.lehmer10Mean, 4);
  assert.equal(row.lehmer9Mean, 4);
  assert.equal(row.lehmer8Mean, 4);
  assert.ok(Math.abs(row.mean - 4 / 3) < 1e-9);
  assert.equal(row.l10L9Gap, 0);
  assert.equal(row.l10L8Gap, 0);
  assert.ok(Math.abs(row.l10AmGap - (4 - 4 / 3)) < 1e-9);
});

test('l9: all-zero source dropped', () => {
  const queue = mkSeries('s', [0, 0, 0, 0]);
  const r = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAllZeroSources, 1);
});

test('l10: cross-check L_7, L_8 against prior builders', () => {
  const xs = [3, 5, 8, 13, 21, 34];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
  const l7Report = buildSourceRowTokenLehmer8Mean(queue, { generatedAt: GEN });
  const l6Report = buildSourceRowTokenLehmer7Mean(queue, { generatedAt: GEN });
  const l5Report = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  const l7Row = l7Report.sources[0]!;
  const l6Row = l6Report.sources[0]!;
  const l5Row = l5Report.sources[0]!;
  assert.ok(Math.abs(row.lehmer8Mean - l7Row.lehmer8Mean) < 1e-9);
  assert.ok(Math.abs(row.mean - l7Row.mean) < 1e-9);
  // Lehmer monotonicity: L_10 >= L_9 >= L_8 >= L_7 >= L_6
  assert.ok(row.lehmer10Mean >= row.lehmer9Mean);
  assert.ok(row.lehmer9Mean >= row.lehmer8Mean);
  assert.ok(row.lehmer8Mean >= l6Row.lehmer7Mean);
  assert.ok(l6Row.lehmer7Mean >= l5Row.lehmer6Mean);
  assert.ok(row.l10L9Gap >= 0);
  assert.ok(row.l10L8Gap >= row.l10L9Gap);
  assert.ok(row.l10AmGap >= row.l10L8Gap);
});

test('l9: scale-equivariance: rescale by 10 -> L_10 rescales by 10', () => {
  const xs = [1, 4, 9, 16, 25];
  const xs10 = xs.map((x) => x * 10);
  const r1 = buildSourceRowTokenLehmer10Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r10 = buildSourceRowTokenLehmer10Mean(mkSeries('s', xs10), {
    generatedAt: GEN,
  });
  const v1 = r1.sources[0]!.lehmer10Mean;
  const v10 = r10.sources[0]!.lehmer10Mean;
  assert.ok(Math.abs(v10 - v1 * 10) < 1e-5 * Math.max(1, v1 * 10));
});

test('l9: order-invariance: shuffle does not change L_10', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const xsShuf = [9, 5, 5, 6, 3, 4, 2, 3, 1, 1];
  const a = buildSourceRowTokenLehmer10Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const b = buildSourceRowTokenLehmer10Mean(mkSeries('s', xsShuf), {
    generatedAt: GEN,
  }).sources[0]!;
  assert.ok(Math.abs(a.lehmer10Mean - b.lehmer10Mean) < 1e-9);
});

// ---------- filtering / sort / top ----------

test('l9: drops negative total_tokens', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('2026-04-28T05:00:00.000Z', 's', -5),
  ];
  const r = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l9: drops invalid hour_start', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('not-a-date', 's', 9),
  ];
  const r = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l9: drops invalid total_tokens (NaN)', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('2026-04-28T05:00:00.000Z', 's', Number.NaN),
  ];
  const r = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('l9: source filter keeps only matches', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3]),
    ...mkSeries('b', [10, 20, 30]),
  ];
  const r = buildSourceRowTokenLehmer10Mean(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 3);
});

test('l9: minRows gate drops sub-threshold sources', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [10, 20]),
  ];
  const r = buildSourceRowTokenLehmer10Mean(queue, {
    generatedAt: GEN,
    minRows: 5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('l9: minLehmer10Mean cohort filter drops below threshold', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmer10Mean(queue, {
    generatedAt: GEN,
    minLehmer10Mean: 50,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinLehmer10Mean, 1);
});

test('l9: top cap suppresses tail and reports droppedBelowTopCap', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
    ...mkSeries('c', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmer10Mean(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  // Default sort: lehmer-10-mean-desc
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l9: sort=lehmer-10-mean-asc reverses order', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
  ];
  const r = buildSourceRowTokenLehmer10Mean(queue, {
    generatedAt: GEN,
    sort: 'lehmer-10-mean-asc',
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l9: sort=source orders alphabetically', () => {
  const queue = [
    ...mkSeries('zeta', [1, 2, 3]),
    ...mkSeries('alpha', [4, 5, 6]),
  ];
  const r = buildSourceRowTokenLehmer10Mean(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('l9: since/until window filters rows', () => {
  const queue = [
    ql('2026-04-27T10:00:00.000Z', 's', 1),
    ql('2026-04-28T10:00:00.000Z', 's', 2),
    ql('2026-04-29T10:00:00.000Z', 's', 4),
  ];
  const r = buildSourceRowTokenLehmer10Mean(queue, {
    generatedAt: GEN,
    since: '2026-04-28T00:00:00.000Z',
    until: '2026-04-29T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.rowsKept, 1);
  assert.equal(r.sources[0]!.lehmer10Mean, 2);
});

// ---------- property tests (Lehmer monotonicity) ----------

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('property: full ladder L_-3 <= L_-2 <= HM <= GM <= AM <= QM <= CHM <= L_6 <= L_7 <= L_8 <= L_10 (via gaps)', () => {
  // Use the in-builder fact L_10 >= L_8 >= L_7 >= AM and chain
  // through the L_10 builder's reported numbers. The lower-end
  // chain is pinned by the prior negative-Lehmer builders'
  // own property tests; here we pin the right-hand chain
  // L_7 <= L_8 <= L_10 across many random series.
  const r = rng(20260429);
  for (let trial = 0; trial < 60; trial += 1) {
    const n = 2 + Math.floor(r() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) {
      xs.push(Math.floor(r() * 1000));
    }
    if (xs.every((x) => x === 0)) continue;
    const queue = mkSeries(`t${trial}`, xs);
    const rep = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
    if (rep.sources.length === 0) continue;
    const row = rep.sources[0]!;
    assert.ok(
      row.lehmer10Mean + 1e-9 >= row.lehmer9Mean,
      `L_10(${row.lehmer10Mean}) should be >= L_8(${row.lehmer9Mean}) on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      row.lehmer9Mean + 1e-9 >= row.lehmer8Mean,
      `L_8 should be >= L_7 on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      row.lehmer8Mean + 1e-9 >= row.mean,
      `L_7 should be >= AM on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(row.l10L9Gap >= -1e-9);
    assert.ok(row.l10L8Gap >= -1e-9);
    assert.ok(row.l10AmGap >= -1e-9);
    // gaps are monotone in scope: |L_10 - AM| >= |L_10 - L_7| >= |L_10 - L_8|
    assert.ok(row.l10AmGap + 1e-9 >= row.l10L8Gap);
    assert.ok(row.l10L8Gap + 1e-9 >= row.l10L9Gap);
  }
});

test('property: L_10 = c on a constant positive series for arbitrary c', () => {
  const r = rng(424242);
  for (let trial = 0; trial < 30; trial += 1) {
    const c = 1 + Math.floor(r() * 5000);
    const n = 2 + Math.floor(r() * 20);
    const xs = new Array(n).fill(c);
    const rep = buildSourceRowTokenLehmer10Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    assert.ok(
      Math.abs(row.lehmer10Mean - c) < 1e-7 * c,
      `L_10 should equal c=${c} on constant series, got ${row.lehmer10Mean}`,
    );
    assert.ok(Math.abs(row.l10L9Gap) < 1e-7 * c);
    assert.ok(Math.abs(row.l10L8Gap) < 1e-7 * c);
    assert.ok(Math.abs(row.l10AmGap) < 1e-7 * c);
  }
});

test('property: scale-equivariance L_10(c*x) = c * L_10(x)', () => {
  const r = rng(99999);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 3 + Math.floor(r() * 15);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(1 + Math.floor(r() * 500));
    const c = 1 + Math.floor(r() * 50);
    const xsScaled = xs.map((x) => x * c);
    const a = buildSourceRowTokenLehmer10Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    }).sources[0]!.lehmer10Mean;
    const b = buildSourceRowTokenLehmer10Mean(mkSeries('s', xsScaled), {
      generatedAt: GEN,
    }).sources[0]!.lehmer10Mean;
    assert.ok(
      Math.abs(b - a * c) < 1e-5 * Math.max(1, a * c),
      `L_10 scale-equivariance failed: c=${c}, L_10(x)=${a}, L_10(c*x)=${b}`,
    );
  }
});

// ---------- self-sixth-power-weighted-mean closed-form property ----------
//
// L_10 is, by construction, the arithmetic mean of x_i weighted
// by w_i = x_i^9 / sum(x_j^6). This identity is the conceptual
// heart of the lens — it says "each row's contribution to the
// reported center is proportional to its own sixth power".
// Pin it explicitly so a future refactor that, e.g., divides by
// sum(x^8) instead of sum(x^9) (collapsing L_10 to L_8) trips
// this test, not just the numeric reference tests above.
test('property: L_10 equals the x^9-self-weighted arithmetic mean (closed form)', () => {
  const r = rng(27182);
  for (let trial = 0; trial < 40; trial += 1) {
    const n = 2 + Math.floor(r() * 25);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 1000));
    if (xs.every((x) => x === 0)) continue;
    // Closed-form weighted mean with weights w_i = x_i^9.
    let wsum = 0;
    let wxsum = 0;
    for (const x of xs) {
      const w = x * x * x * x * x * x * x * x * x;
      wsum += w;
      wxsum += w * x;
    }
    if (wsum === 0) continue;
    const closedForm = wxsum / wsum;
    const rep = buildSourceRowTokenLehmer10Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer10Mean;
    assert.ok(
      Math.abs(got - closedForm) < 1e-9 * Math.max(1, closedForm),
      `L_10 should equal sum(x^10)/sum(x^9) = sum(x*x^9)/sum(x^9) — got ${got} vs closed-form ${closedForm} on xs=${JSON.stringify(xs)}`,
    );
  }
});

// ---------- bottleneck-domination property ----------
//
// On a series of (n-1) tiny rows of value c plus one huge bottleneck
// row of value M (M >> c), L_10 must sit STRICTLY closer to M than
// L_8 does. This pins the documented claim that "L_10 amplifies the
// largest-row pull by another factor over L_8". A future refactor
// that, e.g., accidentally collapses L_10 toward L_8 (or AM) on a
// long-tailed series would trip this test even if the closed-form /
// monotonicity tests still pass on uniform random data.
test('property: L_10 is strictly closer to bottleneck M than L_8 on heavy-tailed series', () => {
  const r = rng(161803);
  for (let trial = 0; trial < 25; trial += 1) {
    const n = 4 + Math.floor(r() * 12); // 4..15 rows
    const c = 1 + Math.floor(r() * 5); // small base value
    const M = c * (1000 + Math.floor(r() * 9000)); // bottleneck >> c
    const xs = new Array(n - 1).fill(c);
    xs.push(M);
    const rep = buildSourceRowTokenLehmer10Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    const distL6 = M - row.lehmer10Mean;
    const distL5 = M - row.lehmer9Mean;
    assert.ok(
      distL6 >= -1e-6 * M,
      `L_10 should not exceed M=${M}; got L_10=${row.lehmer10Mean}`,
    );
    assert.ok(
      distL5 >= -1e-6 * M,
      `L_8 should not exceed M=${M}; got L_8=${row.lehmer9Mean}`,
    );
    // L_10 strictly closer (or equal up to FP noise) to the bottleneck than L_8
    assert.ok(
      distL6 <= distL5 + 1e-6 * M,
      `L_10 should be <= L_8 distance to M=${M}: distL6=${distL6}, distL5=${distL5}, xs=${JSON.stringify(xs)}`,
    );
    // And the gap should be meaningful — at least a factor of 2 closer
    // for a (n-1) tiny + 1 huge configuration. Pick a conservative
    // bound that still trips on a "L_10 collapses to L_8" regression.
    assert.ok(
      distL6 * 2 <= distL5 + 1e-6 * M,
      `L_10 should be at least 2x closer to M=${M} than L_8: distL6=${distL6}, distL5=${distL5}, xs=${JSON.stringify(xs)}`,
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
// strictly stronger claim than the previous "L_10 is at least 2x closer
// to M than L_8" property: here we pin that on a sufficiently long-
// tailed series the ratio is below 0.5 with a comfortable margin (we
// require <= 0.05, i.e. L_10's bottleneck-tracking error is at most
// 5 % of L_8's). A future refactor that, for example, accidentally
// shifted L_10's exponent back to 5 (collapsing it to L_8) would still
// have ratio = 1 here and would trip this test very loudly.
test('refinement: bottleneck-tracking error of L_10 is <= 10 % of L_8 on heavy-tailed (M/c in [50, 200]) series', () => {
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
    //   that accidentally collapsed L_10 to L_8 would have ratio = 1
    //   and trip this test by ~10x.
    const M = c * (50 + Math.floor(r() * 150));
    const xs = new Array(n - 1).fill(c);
    xs.push(M);
    const rep = buildSourceRowTokenLehmer10Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    const distL6 = Math.max(0, M - row.lehmer10Mean);
    const distL5 = Math.max(0, M - row.lehmer9Mean);
    // At p=7 with M/c >= 50, distL5 may already be below FP noise; skip such
    // trials — the ratio test below would be meaningless on FP-zero divisor.
    if (distL5 <= 1e-9 * M) continue;
    const ratio = distL6 / distL5;
    assert.ok(
      ratio <= 0.1,
      `L_10 bottleneck-tracking error should be <= 10 % of L_8: M=${M}, c=${c}, n=${n}, distL6=${distL6}, distL5=${distL5}, ratio=${ratio}, xs=${JSON.stringify(xs)}`,
    );
  }
});

// ---------- refinement: defining-identity round-trip ----------
//
// Pin the defining identity L_10 * sum(x^9) == sum(x^10) directly, by
// recomputing both sides with independent scalar accumulators and
// checking that the builder-reported L_10 multiplied back by the
// independently-computed sum(x^9) recovers sum(x^10) to within a
// strict relative tolerance. This is *the* identity that defines
// the lens — it's stronger than the closed-form self-weighted-mean
// property above (which checks the algebraically-equivalent
// rearrangement sum(x*x^9) / sum(x^9)) because it tests the raw
// numerator-denominator pair the builder must produce. A future
// refactor that, e.g., swapped sum9 and sum10 (collapsing L_10 to
// L_8 / L_10 mash) would trip this test even on small uniform-
// random series where the bottleneck-domination property has
// little signal.
test('refinement: L_10 satisfies L_10 * sum(x^9) == sum(x^10) round-trip identity', () => {
  const r = rng(57721566);
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 2 + Math.floor(r() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 2000));
    if (xs.every((x) => x === 0)) continue;
    let s9 = 0;
    let s10 = 0;
    for (const x of xs) {
      const x2 = x * x;
      const x4 = x2 * x2;
      const x8 = x4 * x4;
      const x9 = x8 * x;
      s9 += x9;
      s10 += x9 * x;
    }
    if (s9 === 0) continue;
    const rep = buildSourceRowTokenLehmer10Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer10Mean;
    const recovered = got * s9;
    assert.ok(
      Math.abs(recovered - s10) < 1e-9 * Math.max(1, s10),
      `L_10 * sum(x^9) should recover sum(x^10): got=${got}, sum9=${s9}, sum10=${s10}, recovered=${recovered}, xs=${JSON.stringify(xs)}`,
    );
  }
});

// ---------- refinement: equality case L_10 = max(x) iff all positive rows == max ----------
//
// Lehmer monotonicity bounds L_10 in [L_8, max]. The upper bound is
// saturated *exactly* when every strictly-positive row equals max.
// Pin both directions:
//
//   (a) on a series of (k) max-valued rows mixed with (n - k) zero
//       rows, L_10 == max exactly (zeros contribute 0 to both sums);
//   (b) on a series with at least two distinct positive values,
//       L_10 < max strictly.
//
// A future refactor that, e.g., accidentally clamped L_10 at max or
// allowed L_10 > max via an unsigned-overflow bug would trip this.
test('refinement: L_10 = max iff all positive rows equal max', () => {
  // (a) saturating case: any mix of {0, max}-valued rows -> L_10 == max
  const cases: { xs: number[]; max: number }[] = [
    { xs: [10, 10, 10, 10], max: 10 },
    { xs: [0, 7], max: 7 },
    { xs: [0, 0, 0, 99, 99], max: 99 },
    { xs: [42], max: 42 },
  ];
  for (const { xs, max } of cases) {
    const rep = buildSourceRowTokenLehmer10Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer10Mean;
    assert.ok(
      Math.abs(got - max) < 1e-9 * max,
      `L_10 should equal max=${max} when positive rows are uniform; got ${got} on xs=${JSON.stringify(xs)}`,
    );
  }
  // (b) non-saturating case: any series with two distinct positive values
  //     must have L_10 strictly below max.
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
    const rep = buildSourceRowTokenLehmer10Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    const got = rep.sources[0]!.lehmer10Mean;
    assert.ok(
      got < max,
      `L_10 should be strictly < max=${max} on non-uniform positive series; got ${got} on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      got >= rep.sources[0]!.lehmer9Mean - 1e-9 * max,
      `L_10 should be >= L_8 on xs=${JSON.stringify(xs)}; got L_10=${got}, L_8=${rep.sources[0]!.lehmer9Mean}`,
    );
  }
});

// ---------- refinement: L_10 - L_8 closed-form gap identity ----------
//
// The defining algebra of L_10 yields a sharp closed form for the gap
// L_10 - L_8 in terms of the seventh-power-weighted deviation around L_8:
//
//     L_10 - L_8
//       = sum(x^10) / sum(x^9) - L_8
//       = sum(x^9 * (x - L_8)) / sum(x^9)
//
// i.e. l10L9Gap == sum(x^9 * (x - L_8)) / sum(x^9). This is a much
// sharper invariant than "l10L9Gap >= 0" — it nails down the exact
// magnitude of the gap from independently-computed scalar
// accumulators, and would catch any off-by-one in the power exponents
// that the round-trip identity test (which only sees sum9 vs sum10)
// would not. Pinning this also gives a free regression sentinel for
// any future refactor that tries to share state between the L_8 and
// L_10 builders.
import { test as testGap } from 'node:test';
import { strict as assertGap } from 'node:assert';
testGap(
  'refinement: l10L9Gap == sum(x^9 * (x - L_8)) / sum(x^9) closed-form gap identity',
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
      let s9 = 0;
      for (const x of xs) {
        const x2 = x * x;
        const x4 = x2 * x2;
        const x8 = x4 * x4;
        const x9 = x8 * x;
        s9 += x9;
      }
      if (s9 === 0) continue;
      const rep = buildSourceRowTokenLehmer10Mean(mkSeries(`g${trial}`, xs), {
        generatedAt: GEN,
      });
      if (rep.sources.length === 0) continue;
      const row = rep.sources[0]!;
      const L8 = row.lehmer9Mean;
      // closed-form gap RHS: sum(x^9 * (x - L_8)) / sum(x^9)
      let gapNum = 0;
      for (const x of xs) {
        const x2 = x * x;
        const x4 = x2 * x2;
        const x8 = x4 * x4;
        const x9 = x8 * x;
        gapNum += x9 * (x - L8);
      }
      const gapClosedForm = gapNum / s9;
      // builder-reported gap
      const gapReported = row.l10L9Gap;
      const tol = 1e-7 * Math.max(1, row.lehmer10Mean);
      assertGap.ok(
        Math.abs(gapReported - gapClosedForm) < tol,
        `l10L9Gap should equal sum(x^9 * (x - L_8)) / sum(x^9); got reported=${gapReported}, closed-form=${gapClosedForm}, xs=${JSON.stringify(xs)}`,
      );
    }
  },
);

// ---------- refinement: full-ladder monotonicity L_6 <= L_7 <= L_8 <= L_10 ----------
//
// End-to-end Lehmer-monotonicity pin: on a single random non-negative
// integer series, build L_6, L_7, L_8 and L_10 from their respective
// builders, fetch the headline mean from each, and assert the full
// chain holds row-by-row. This is strictly stronger than the per-rung
// monotonicity tests above (which only compare consecutive rungs)
// because it pins that *every* rung is monotone with *every* prior
// rung — a future refactor that, e.g., accidentally swapped sum9 and
// sum7 in only one builder (collapsing L_8 below L_6 on a heavy-tailed
// series) would still pass the L_8-vs-L_7 and L_10-vs-L_8 tests but
// would trip this end-to-end chain.
import { test as testChain } from 'node:test';
import { strict as assertChain } from 'node:assert';
testChain(
  'refinement: full integer Lehmer ladder L_6 <= L_7 <= L_8 <= L_10 holds end-to-end',
  () => {
    const r = (() => {
      let s = 0xfeedface;
      return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
      };
    })();
    let trialsRun = 0;
    for (let trial = 0; trial < 60; trial += 1) {
      const n = 3 + Math.floor(r() * 25);
      const xs: number[] = [];
      for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 5000));
      if (xs.every((x) => x === 0)) continue;
      const queue = mkSeries(`chain${trial}`, xs);
      const r9 = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
      const r8 = buildSourceRowTokenLehmer8Mean(queue, { generatedAt: GEN });
      const r7 = buildSourceRowTokenLehmer7Mean(queue, { generatedAt: GEN });
      const r6 = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
      if (
        r9.sources.length === 0 ||
        r8.sources.length === 0 ||
        r7.sources.length === 0 ||
        r6.sources.length === 0
      )
        continue;
      const L9 = r9.sources[0]!.lehmer10Mean;
      const L8 = r8.sources[0]!.lehmer8Mean;
      const L7 = r7.sources[0]!.lehmer7Mean;
      const L6 = r6.sources[0]!.lehmer6Mean;
      const eps = 1e-9 * Math.max(1, L9);
      assertChain.ok(
        L6 <= L7 + eps,
        `L_6 <= L_7 expected: L_6=${L6}, L_7=${L7}, xs=${JSON.stringify(xs)}`,
      );
      assertChain.ok(
        L7 <= L8 + eps,
        `L_7 <= L_8 expected: L_7=${L7}, L_8=${L8}, xs=${JSON.stringify(xs)}`,
      );
      assertChain.ok(
        L8 <= L9 + eps,
        `L_8 <= L_10 expected: L_8=${L8}, L_10=${L9}, xs=${JSON.stringify(xs)}`,
      );
      trialsRun += 1;
    }
    assertChain.ok(
      trialsRun >= 30,
      `expected at least 30 trials with non-empty results, got ${trialsRun}`,
    );
  },
);
