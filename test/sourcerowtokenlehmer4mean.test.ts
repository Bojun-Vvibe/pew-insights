import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmer4Mean } from '../src/sourcerowtokenlehmer4mean.js';
import { buildSourceRowTokenLehmer3Mean } from '../src/sourcerowtokenlehmer3mean.js';
import { buildSourceRowTokenContraharmonicMean } from '../src/sourcerowtokencontraharmonicmean.js';
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
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

function l4Reference(xs: number[]): {
  mean: number;
  chm: number;
  l3: number;
  l4: number;
} {
  const n = xs.length;
  let s4 = 0;
  let s3 = 0;
  let s2 = 0;
  let s1 = 0;
  for (const x of xs) {
    const x2 = x * x;
    const x3 = x2 * x;
    s4 += x3 * x;
    s3 += x3;
    s2 += x2;
    s1 += x;
  }
  return {
    mean: s1 / n,
    chm: s1 === 0 ? 0 : s2 / s1,
    l3: s2 === 0 ? 0 : s3 / s2,
    l4: s3 === 0 ? 0 : s4 / s3,
  };
}

// ---------- shape / option validation ----------

test('l4: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenLehmer4Mean([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 1);
  assert.equal(r.minLehmer4Mean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'lehmer-4-mean-desc');
  assert.equal(r.generatedAt, GEN);
});

test('l4: minRows < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer4Mean([], { minRows: 0 }),
    /minRows must be an integer >= 1/,
  );
});

test('l4: minRows non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer4Mean([], {
        minRows: 2.5 as unknown as number,
      }),
    /minRows must be an integer >= 1/,
  );
});

test('l4: minLehmer4Mean negative throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer4Mean([], { minLehmer4Mean: -1 }),
    /minLehmer4Mean must be a finite, non-negative number/,
  );
});

test('l4: minLehmer4Mean NaN throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer4Mean([], { minLehmer4Mean: Number.NaN }),
    /minLehmer4Mean must be a finite, non-negative number/,
  );
});

test('l4: minLehmer4Mean Infinity throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer4Mean([], {
        minLehmer4Mean: Number.POSITIVE_INFINITY,
      }),
    /minLehmer4Mean must be a finite, non-negative number/,
  );
});

test('l4: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer4Mean([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('l4: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer4Mean([], { top: 2.5 }),
    /top must be a positive integer/,
  );
});

test('l4: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer4Mean([], {
        sort: 'banana' as unknown as 'lehmer-4-mean-desc',
      }),
    /sort must be one of/,
  );
});

test('l4: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer4Mean([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('l4: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer4Mean([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('l4: generatedAt defaults to now ISO when omitted', () => {
  const r = buildSourceRowTokenLehmer4Mean([]);
  assert.match(r.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

// ---------- arithmetic correctness ----------

test('l4: single positive row -> L_4 = L_3 = CHM = mean = that row', () => {
  const queue = mkSeries('s', [42]);
  const r = buildSourceRowTokenLehmer4Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.lehmer4Mean, 42);
  assert.equal(row.lehmer3Mean, 42);
  assert.equal(row.contraharmonicMean, 42);
  assert.equal(row.mean, 42);
  assert.equal(row.l4L3Gap, 0);
  assert.equal(row.l4ChmGap, 0);
  assert.equal(row.l4AmGap, 0);
});

test('l4: constant positive series -> L_4 = c, all gaps = 0', () => {
  const queue = mkSeries('s', [7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenLehmer4Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.lehmer4Mean, 7);
  assert.equal(row.lehmer3Mean, 7);
  assert.equal(row.contraharmonicMean, 7);
  assert.equal(row.mean, 7);
  assert.equal(row.l4L3Gap, 0);
  assert.equal(row.l4ChmGap, 0);
  assert.equal(row.l4AmGap, 0);
});

test('l4: matches reference on [1,1,1,1,1000]', () => {
  const xs = [1, 1, 1, 1, 1000];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer4Mean(queue, { generatedAt: GEN });
  const ref = l4Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer4Mean - ref.l4) < 1e-6);
  assert.ok(Math.abs(row.lehmer3Mean - ref.l3) < 1e-6);
  assert.ok(Math.abs(row.contraharmonicMean - ref.chm) < 1e-9);
  // L_4 should sit closer to bottleneck than L_3
  assert.ok(row.lehmer4Mean > row.lehmer3Mean);
  assert.ok(row.lehmer4Mean < 1000);
  assert.ok(row.lehmer4Mean > 999.999);
});

test('l4: matches reference on [1,2,3,4,5]', () => {
  const xs = [1, 2, 3, 4, 5];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer4Mean(queue, { generatedAt: GEN });
  const ref = l4Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer4Mean - ref.l4) < 1e-9);
  // sum4 = 1+16+81+256+625 = 979, sum3 = 1+8+27+64+125 = 225
  // L_4 = 979/225
  assert.ok(Math.abs(row.lehmer4Mean - 979 / 225) < 1e-9);
});

test('l4: zero rows are no-ops; mixed [0, 0, 4]', () => {
  const xs = [0, 0, 4];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer4Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // sum4=256, sum3=64, sum2=16, sumX=4 -> L_4=4, L_3=4, CHM=4, mean=4/3
  assert.equal(row.lehmer4Mean, 4);
  assert.equal(row.lehmer3Mean, 4);
  assert.equal(row.contraharmonicMean, 4);
  assert.ok(Math.abs(row.mean - 4 / 3) < 1e-9);
  assert.equal(row.l4L3Gap, 0);
  assert.equal(row.l4ChmGap, 0);
  assert.ok(Math.abs(row.l4AmGap - (4 - 4 / 3)) < 1e-9);
});

test('l4: all-zero source dropped', () => {
  const queue = mkSeries('s', [0, 0, 0, 0]);
  const r = buildSourceRowTokenLehmer4Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAllZeroSources, 1);
});

test('l4: cross-check L_3 against lehmer3 builder', () => {
  const xs = [3, 5, 8, 13, 21, 34];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer4Mean(queue, { generatedAt: GEN });
  const l3Report = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN });
  const chmReport = buildSourceRowTokenContraharmonicMean(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  const l3Row = l3Report.sources[0]!;
  const chmRow = chmReport.sources[0]!;
  assert.ok(Math.abs(row.lehmer3Mean - l3Row.lehmer3Mean) < 1e-9);
  assert.ok(
    Math.abs(row.contraharmonicMean - chmRow.contraharmonicMean) < 1e-9,
  );
  assert.ok(Math.abs(row.mean - chmRow.mean) < 1e-9);
  // Lehmer monotonicity: L_4 >= L_3 >= CHM
  assert.ok(row.lehmer4Mean >= row.lehmer3Mean);
  assert.ok(row.lehmer3Mean >= row.contraharmonicMean);
  assert.ok(row.l4L3Gap >= 0);
  assert.ok(row.l4ChmGap >= row.l4L3Gap);
  assert.ok(row.l4AmGap >= row.l4ChmGap);
});

test('l4: scale-equivariance: rescale by 10 -> L_4 rescales by 10', () => {
  const xs = [1, 4, 9, 16, 25];
  const xs10 = xs.map((x) => x * 10);
  const r1 = buildSourceRowTokenLehmer4Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r10 = buildSourceRowTokenLehmer4Mean(mkSeries('s', xs10), {
    generatedAt: GEN,
  });
  const v1 = r1.sources[0]!.lehmer4Mean;
  const v10 = r10.sources[0]!.lehmer4Mean;
  assert.ok(Math.abs(v10 - v1 * 10) < 1e-6);
});

test('l4: order-invariance: shuffle does not change L_4', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const xsShuf = [9, 5, 5, 6, 3, 4, 2, 3, 1, 1];
  const a = buildSourceRowTokenLehmer4Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const b = buildSourceRowTokenLehmer4Mean(mkSeries('s', xsShuf), {
    generatedAt: GEN,
  }).sources[0]!;
  assert.ok(Math.abs(a.lehmer4Mean - b.lehmer4Mean) < 1e-9);
});

// ---------- filtering / sort / top ----------

test('l4: drops negative total_tokens', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('2026-04-27T05:00:00.000Z', 's', -5),
  ];
  const r = buildSourceRowTokenLehmer4Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l4: drops invalid hour_start', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('not-a-date', 's', 9),
  ];
  const r = buildSourceRowTokenLehmer4Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l4: drops invalid total_tokens (NaN)', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('2026-04-27T05:00:00.000Z', 's', Number.NaN),
  ];
  const r = buildSourceRowTokenLehmer4Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('l4: source filter keeps only matches', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3]),
    ...mkSeries('b', [10, 20, 30]),
  ];
  const r = buildSourceRowTokenLehmer4Mean(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 3);
});

test('l4: minRows gate drops sub-threshold sources', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [10, 20]),
  ];
  const r = buildSourceRowTokenLehmer4Mean(queue, {
    generatedAt: GEN,
    minRows: 5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('l4: minLehmer4Mean cohort filter drops below threshold', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmer4Mean(queue, {
    generatedAt: GEN,
    minLehmer4Mean: 50,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinLehmer4Mean, 1);
});

test('l4: top cap suppresses tail and reports droppedBelowTopCap', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
    ...mkSeries('c', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmer4Mean(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  // Default sort: lehmer-4-mean-desc
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l4: sort=lehmer-4-mean-asc reverses order', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
  ];
  const r = buildSourceRowTokenLehmer4Mean(queue, {
    generatedAt: GEN,
    sort: 'lehmer-4-mean-asc',
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l4: sort=source orders alphabetically', () => {
  const queue = [
    ...mkSeries('zeta', [1, 2, 3]),
    ...mkSeries('alpha', [4, 5, 6]),
  ];
  const r = buildSourceRowTokenLehmer4Mean(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('l4: since/until window filters rows', () => {
  const queue = [
    ql('2026-04-26T10:00:00.000Z', 's', 1),
    ql('2026-04-27T10:00:00.000Z', 's', 2),
    ql('2026-04-28T10:00:00.000Z', 's', 4),
  ];
  const r = buildSourceRowTokenLehmer4Mean(queue, {
    generatedAt: GEN,
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.rowsKept, 1);
  assert.equal(r.sources[0]!.lehmer4Mean, 2);
});

// ---------- property tests (Lehmer monotonicity) ----------

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('property: L_4 >= L_3 >= CHM >= AM for any non-negative sample', () => {
  const r = rng(20260428);
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 2 + Math.floor(r() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) {
      xs.push(Math.floor(r() * 1000));
    }
    if (xs.every((x) => x === 0)) continue;
    const queue = mkSeries(`t${trial}`, xs);
    const rep = buildSourceRowTokenLehmer4Mean(queue, { generatedAt: GEN });
    if (rep.sources.length === 0) continue;
    const row = rep.sources[0]!;
    // Lehmer ladder: L_4 >= L_3 >= CHM >= AM (Pythagorean QM>=AM also; CHM>=AM)
    assert.ok(
      row.lehmer4Mean + 1e-9 >= row.lehmer3Mean,
      `L_4(${row.lehmer4Mean}) should be >= L_3(${row.lehmer3Mean}) on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      row.lehmer3Mean + 1e-9 >= row.contraharmonicMean,
      `L_3 should be >= CHM on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      row.contraharmonicMean + 1e-9 >= row.mean,
      `CHM should be >= AM on xs=${JSON.stringify(xs)}`,
    );
    assert.ok(row.l4L3Gap >= -1e-9);
    assert.ok(row.l4ChmGap >= -1e-9);
    assert.ok(row.l4AmGap >= -1e-9);
  }
});

test('property: L_4 = c on a constant positive series for arbitrary c', () => {
  const r = rng(424242);
  for (let trial = 0; trial < 30; trial += 1) {
    const c = 1 + Math.floor(r() * 5000);
    const n = 2 + Math.floor(r() * 20);
    const xs = new Array(n).fill(c);
    const rep = buildSourceRowTokenLehmer4Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    assert.ok(
      Math.abs(row.lehmer4Mean - c) < 1e-7 * c,
      `L_4 should equal c=${c} on constant series, got ${row.lehmer4Mean}`,
    );
    assert.ok(Math.abs(row.l4L3Gap) < 1e-7 * c);
    assert.ok(Math.abs(row.l4ChmGap) < 1e-7 * c);
    assert.ok(Math.abs(row.l4AmGap) < 1e-7 * c);
  }
});

test('property: scale-equivariance L_4(c*x) = c * L_4(x)', () => {
  const r = rng(99999);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 3 + Math.floor(r() * 15);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(1 + Math.floor(r() * 500));
    const c = 1 + Math.floor(r() * 50);
    const xsScaled = xs.map((x) => x * c);
    const a = buildSourceRowTokenLehmer4Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    }).sources[0]!.lehmer4Mean;
    const b = buildSourceRowTokenLehmer4Mean(mkSeries('s', xsScaled), {
      generatedAt: GEN,
    }).sources[0]!.lehmer4Mean;
    assert.ok(
      Math.abs(b - a * c) < 1e-6 * Math.max(1, a * c),
      `L_4 scale-equivariance failed: c=${c}, L_4(x)=${a}, L_4(c*x)=${b}`,
    );
  }
});

// ---------- self-cube-weighted-mean closed-form property ----------
//
// L_4 is, by construction, the arithmetic mean of x_i weighted
// by w_i = x_i^3 / sum(x_j^3). This identity is the conceptual
// heart of the lens — it says "each row's contribution to the
// reported center is proportional to its own cube". Pin it
// explicitly so a future refactor that, e.g., divides by
// sum(x^2) instead of sum(x^3) (collapsing L_4 to L_3) trips
// this test, not just the numeric reference tests above.
test('property: L_4 equals the x^3-self-weighted arithmetic mean (closed form)', () => {
  const r = rng(31415);
  for (let trial = 0; trial < 40; trial += 1) {
    const n = 2 + Math.floor(r() * 25);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 1000));
    if (xs.every((x) => x === 0)) continue;
    // Closed-form weighted mean with weights w_i = x_i^3.
    let wsum = 0;
    let wxsum = 0;
    for (const x of xs) {
      const w = x * x * x;
      wsum += w;
      wxsum += w * x;
    }
    if (wsum === 0) continue;
    const closedForm = wxsum / wsum;
    const rep = buildSourceRowTokenLehmer4Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer4Mean;
    assert.ok(
      Math.abs(got - closedForm) < 1e-9 * Math.max(1, closedForm),
      `L_4 should equal sum(x^4)/sum(x^3) = sum(x*x^3)/sum(x^3) — got ${got} vs closed-form ${closedForm} on xs=${JSON.stringify(xs)}`,
    );
  }
});
