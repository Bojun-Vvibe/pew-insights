import { test } from 'node:test';
import { strict as assert } from 'node:assert';
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

function l5Reference(xs: number[]): {
  mean: number;
  l3: number;
  l4: number;
  l5: number;
} {
  const n = xs.length;
  let s5 = 0;
  let s4 = 0;
  let s3 = 0;
  let s2 = 0;
  let s1 = 0;
  for (const x of xs) {
    const x2 = x * x;
    const x3 = x2 * x;
    const x4 = x3 * x;
    s5 += x4 * x;
    s4 += x4;
    s3 += x3;
    s2 += x2;
    s1 += x;
  }
  return {
    mean: s1 / n,
    l3: s2 === 0 ? 0 : s3 / s2,
    l4: s3 === 0 ? 0 : s4 / s3,
    l5: s4 === 0 ? 0 : s5 / s4,
  };
}

// ---------- shape / option validation ----------

test('l5: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenLehmer5Mean([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 1);
  assert.equal(r.minLehmer5Mean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'lehmer-5-mean-desc');
  assert.equal(r.generatedAt, GEN);
});

test('l5: minRows < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer5Mean([], { minRows: 0 }),
    /minRows must be an integer >= 1/,
  );
});

test('l5: minRows non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer5Mean([], {
        minRows: 2.5 as unknown as number,
      }),
    /minRows must be an integer >= 1/,
  );
});

test('l5: minLehmer5Mean negative throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer5Mean([], { minLehmer5Mean: -1 }),
    /minLehmer5Mean must be a finite, non-negative number/,
  );
});

test('l5: minLehmer5Mean NaN throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer5Mean([], { minLehmer5Mean: Number.NaN }),
    /minLehmer5Mean must be a finite, non-negative number/,
  );
});

test('l5: minLehmer5Mean Infinity throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer5Mean([], {
        minLehmer5Mean: Number.POSITIVE_INFINITY,
      }),
    /minLehmer5Mean must be a finite, non-negative number/,
  );
});

test('l5: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer5Mean([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('l5: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer5Mean([], { top: 2.5 }),
    /top must be a positive integer/,
  );
});

test('l5: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer5Mean([], {
        sort: 'banana' as unknown as 'lehmer-5-mean-desc',
      }),
    /sort must be one of/,
  );
});

test('l5: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer5Mean([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('l5: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer5Mean([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('l5: generatedAt defaults to now ISO when omitted', () => {
  const r = buildSourceRowTokenLehmer5Mean([]);
  assert.match(r.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

// ---------- arithmetic correctness ----------

test('l5: single positive row -> L_5 = L_4 = L_3 = mean = that row', () => {
  const queue = mkSeries('s', [42]);
  const r = buildSourceRowTokenLehmer5Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.lehmer5Mean, 42);
  assert.equal(row.lehmer4Mean, 42);
  assert.equal(row.lehmer3Mean, 42);
  assert.equal(row.mean, 42);
  assert.equal(row.l5L4Gap, 0);
  assert.equal(row.l5L3Gap, 0);
  assert.equal(row.l5AmGap, 0);
});

test('l5: constant positive series -> L_5 = c, all gaps = 0', () => {
  const queue = mkSeries('s', [7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenLehmer5Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.lehmer5Mean, 7);
  assert.equal(row.lehmer4Mean, 7);
  assert.equal(row.lehmer3Mean, 7);
  assert.equal(row.mean, 7);
  assert.equal(row.l5L4Gap, 0);
  assert.equal(row.l5L3Gap, 0);
  assert.equal(row.l5AmGap, 0);
});

test('l5: matches reference on [1,1,1,1,1000]', () => {
  const xs = [1, 1, 1, 1, 1000];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer5Mean(queue, { generatedAt: GEN });
  const ref = l5Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer5Mean - ref.l5) < 1e-3);
  assert.ok(Math.abs(row.lehmer4Mean - ref.l4) < 1e-6);
  assert.ok(Math.abs(row.lehmer3Mean - ref.l3) < 1e-6);
  // L_5 should sit even closer to bottleneck than L_4
  assert.ok(row.lehmer5Mean > row.lehmer4Mean);
  assert.ok(row.lehmer5Mean < 1000);
  assert.ok(row.lehmer5Mean > 999.99999);
});

test('l5: matches reference on [1,2,3,4,5]', () => {
  const xs = [1, 2, 3, 4, 5];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer5Mean(queue, { generatedAt: GEN });
  const ref = l5Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer5Mean - ref.l5) < 1e-9);
  // sum5 = 1+32+243+1024+3125 = 4425, sum4 = 1+16+81+256+625 = 979
  // L_5 = 4425/979
  assert.ok(Math.abs(row.lehmer5Mean - 4425 / 979) < 1e-9);
});

test('l5: zero rows are no-ops; mixed [0, 0, 4]', () => {
  const xs = [0, 0, 4];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer5Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // sum5=1024, sum4=256, sum3=64 -> L_5=4, L_4=4, L_3=4
  assert.equal(row.lehmer5Mean, 4);
  assert.equal(row.lehmer4Mean, 4);
  assert.equal(row.lehmer3Mean, 4);
  assert.ok(Math.abs(row.mean - 4 / 3) < 1e-9);
  assert.equal(row.l5L4Gap, 0);
  assert.equal(row.l5L3Gap, 0);
  assert.ok(Math.abs(row.l5AmGap - (4 - 4 / 3)) < 1e-9);
});

test('l5: all-zero source dropped', () => {
  const queue = mkSeries('s', [0, 0, 0, 0]);
  const r = buildSourceRowTokenLehmer5Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAllZeroSources, 1);
});

test('l5: cross-check L_3, L_4 against prior builders', () => {
  const xs = [3, 5, 8, 13, 21, 34];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer5Mean(queue, { generatedAt: GEN });
  const l4Report = buildSourceRowTokenLehmer4Mean(queue, { generatedAt: GEN });
  const l3Report = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  const l4Row = l4Report.sources[0]!;
  const l3Row = l3Report.sources[0]!;
  assert.ok(Math.abs(row.lehmer4Mean - l4Row.lehmer4Mean) < 1e-9);
  assert.ok(Math.abs(row.lehmer3Mean - l3Row.lehmer3Mean) < 1e-9);
  assert.ok(Math.abs(row.mean - l4Row.mean) < 1e-9);
  // Lehmer monotonicity: L_5 >= L_4 >= L_3
  assert.ok(row.lehmer5Mean >= row.lehmer4Mean);
  assert.ok(row.lehmer4Mean >= row.lehmer3Mean);
  assert.ok(row.l5L4Gap >= 0);
  assert.ok(row.l5L3Gap >= row.l5L4Gap);
  assert.ok(row.l5AmGap >= row.l5L3Gap);
});

test('l5: scale-equivariance: rescale by 10 -> L_5 rescales by 10', () => {
  const xs = [1, 4, 9, 16, 25];
  const xs10 = xs.map((x) => x * 10);
  const r1 = buildSourceRowTokenLehmer5Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r10 = buildSourceRowTokenLehmer5Mean(mkSeries('s', xs10), {
    generatedAt: GEN,
  });
  const v1 = r1.sources[0]!.lehmer5Mean;
  const v10 = r10.sources[0]!.lehmer5Mean;
  assert.ok(Math.abs(v10 - v1 * 10) < 1e-6);
});

test('l5: order-invariance: shuffle does not change L_5', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const xsShuf = [9, 5, 5, 6, 3, 4, 2, 3, 1, 1];
  const a = buildSourceRowTokenLehmer5Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const b = buildSourceRowTokenLehmer5Mean(mkSeries('s', xsShuf), {
    generatedAt: GEN,
  }).sources[0]!;
  assert.ok(Math.abs(a.lehmer5Mean - b.lehmer5Mean) < 1e-9);
});

// ---------- filtering / sort / top ----------

test('l5: drops negative total_tokens', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('2026-04-28T05:00:00.000Z', 's', -5),
  ];
  const r = buildSourceRowTokenLehmer5Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l5: drops invalid hour_start', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('not-a-date', 's', 9),
  ];
  const r = buildSourceRowTokenLehmer5Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l5: drops invalid total_tokens (NaN)', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('2026-04-28T05:00:00.000Z', 's', Number.NaN),
  ];
  const r = buildSourceRowTokenLehmer5Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('l5: source filter keeps only matches', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3]),
    ...mkSeries('b', [10, 20, 30]),
  ];
  const r = buildSourceRowTokenLehmer5Mean(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 3);
});

test('l5: minRows gate drops sub-threshold sources', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [10, 20]),
  ];
  const r = buildSourceRowTokenLehmer5Mean(queue, {
    generatedAt: GEN,
    minRows: 5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('l5: minLehmer5Mean cohort filter drops below threshold', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmer5Mean(queue, {
    generatedAt: GEN,
    minLehmer5Mean: 50,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinLehmer5Mean, 1);
});

test('l5: top cap suppresses tail and reports droppedBelowTopCap', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
    ...mkSeries('c', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmer5Mean(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  // Default sort: lehmer-5-mean-desc
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l5: sort=lehmer-5-mean-asc reverses order', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
  ];
  const r = buildSourceRowTokenLehmer5Mean(queue, {
    generatedAt: GEN,
    sort: 'lehmer-5-mean-asc',
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l5: sort=source orders alphabetically', () => {
  const queue = [
    ...mkSeries('zeta', [1, 2, 3]),
    ...mkSeries('alpha', [4, 5, 6]),
  ];
  const r = buildSourceRowTokenLehmer5Mean(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('l5: since/until window filters rows', () => {
  const queue = [
    ql('2026-04-27T10:00:00.000Z', 's', 1),
    ql('2026-04-28T10:00:00.000Z', 's', 2),
    ql('2026-04-29T10:00:00.000Z', 's', 4),
  ];
  const r = buildSourceRowTokenLehmer5Mean(queue, {
    generatedAt: GEN,
    since: '2026-04-28T00:00:00.000Z',
    until: '2026-04-29T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.rowsKept, 1);
  assert.equal(r.sources[0]!.lehmer5Mean, 2);
});

// ---------- property tests (Lehmer monotonicity) ----------

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('property: L_5 >= L_4 >= L_3 >= AM for any non-negative sample', () => {
  const r = rng(20260429);
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 2 + Math.floor(r() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) {
      xs.push(Math.floor(r() * 1000));
    }
    if (xs.every((x) => x === 0)) continue;
    const queue = mkSeries(`t${trial}`, xs);
    const rep = buildSourceRowTokenLehmer5Mean(queue, { generatedAt: GEN });
    if (rep.sources.length === 0) continue;
    const row = rep.sources[0]!;
    assert.ok(
      row.lehmer5Mean + 1e-9 >= row.lehmer4Mean,
      `L_5(${row.lehmer5Mean}) should be >= L_4(${row.lehmer4Mean}) on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      row.lehmer4Mean + 1e-9 >= row.lehmer3Mean,
      `L_4 should be >= L_3 on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      row.lehmer3Mean + 1e-9 >= row.mean,
      `L_3 should be >= AM on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(row.l5L4Gap >= -1e-9);
    assert.ok(row.l5L3Gap >= -1e-9);
    assert.ok(row.l5AmGap >= -1e-9);
  }
});

test('property: L_5 = c on a constant positive series for arbitrary c', () => {
  const r = rng(424242);
  for (let trial = 0; trial < 30; trial += 1) {
    const c = 1 + Math.floor(r() * 5000);
    const n = 2 + Math.floor(r() * 20);
    const xs = new Array(n).fill(c);
    const rep = buildSourceRowTokenLehmer5Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    assert.ok(
      Math.abs(row.lehmer5Mean - c) < 1e-7 * c,
      `L_5 should equal c=${c} on constant series, got ${row.lehmer5Mean}`,
    );
    assert.ok(Math.abs(row.l5L4Gap) < 1e-7 * c);
    assert.ok(Math.abs(row.l5L3Gap) < 1e-7 * c);
    assert.ok(Math.abs(row.l5AmGap) < 1e-7 * c);
  }
});

test('property: scale-equivariance L_5(c*x) = c * L_5(x)', () => {
  const r = rng(99999);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 3 + Math.floor(r() * 15);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(1 + Math.floor(r() * 500));
    const c = 1 + Math.floor(r() * 50);
    const xsScaled = xs.map((x) => x * c);
    const a = buildSourceRowTokenLehmer5Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    }).sources[0]!.lehmer5Mean;
    const b = buildSourceRowTokenLehmer5Mean(mkSeries('s', xsScaled), {
      generatedAt: GEN,
    }).sources[0]!.lehmer5Mean;
    assert.ok(
      Math.abs(b - a * c) < 1e-6 * Math.max(1, a * c),
      `L_5 scale-equivariance failed: c=${c}, L_5(x)=${a}, L_5(c*x)=${b}`,
    );
  }
});

// ---------- self-fourth-power-weighted-mean closed-form property ----------
//
// L_5 is, by construction, the arithmetic mean of x_i weighted
// by w_i = x_i^4 / sum(x_j^4). This identity is the conceptual
// heart of the lens — it says "each row's contribution to the
// reported center is proportional to its own fourth power".
// Pin it explicitly so a future refactor that, e.g., divides by
// sum(x^3) instead of sum(x^4) (collapsing L_5 to L_4) trips
// this test, not just the numeric reference tests above.
test('property: L_5 equals the x^4-self-weighted arithmetic mean (closed form)', () => {
  const r = rng(27182);
  for (let trial = 0; trial < 40; trial += 1) {
    const n = 2 + Math.floor(r() * 25);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 1000));
    if (xs.every((x) => x === 0)) continue;
    // Closed-form weighted mean with weights w_i = x_i^4.
    let wsum = 0;
    let wxsum = 0;
    for (const x of xs) {
      const w = x * x * x * x;
      wsum += w;
      wxsum += w * x;
    }
    if (wsum === 0) continue;
    const closedForm = wxsum / wsum;
    const rep = buildSourceRowTokenLehmer5Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer5Mean;
    assert.ok(
      Math.abs(got - closedForm) < 1e-9 * Math.max(1, closedForm),
      `L_5 should equal sum(x^5)/sum(x^4) = sum(x*x^4)/sum(x^4) — got ${got} vs closed-form ${closedForm} on xs=${JSON.stringify(xs)}`,
    );
  }
});
