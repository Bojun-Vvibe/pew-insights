import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmer12Mean } from '../src/sourcerowtokenlehmer12mean.js';
import { buildSourceRowTokenLehmer11Mean } from '../src/sourcerowtokenlehmer11mean.js';
import { buildSourceRowTokenLehmer10Mean } from '../src/sourcerowtokenlehmer10mean.js';
import { buildSourceRowTokenLehmer9Mean } from '../src/sourcerowtokenlehmer9mean.js';
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

const GEN = '2026-04-29T14:00:00.000Z';

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-28T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

function l11Reference(xs: number[]): {
  mean: number;
  l10: number;
  l11: number;
  l12: number;
} {
  const n = xs.length;
  let s12 = 0;
  let s11 = 0;
  let s10 = 0;
  let s9 = 0;
  let s1 = 0;
  for (const x of xs) {
    const x2 = x * x;
    const x4 = x2 * x2;
    const x8 = x4 * x4;
    const x9 = x8 * x;
    const x10 = x9 * x;
    const x11 = x10 * x;
    const x12 = x11 * x;
    s12 += x12;
    s11 += x11;
    s10 += x10;
    s9 += x9;
    s1 += x;
  }
  return {
    mean: s1 / n,
    l10: s9 === 0 ? 0 : s10 / s9,
    l11: s10 === 0 ? 0 : s11 / s10,
    l12: s11 === 0 ? 0 : s12 / s11,
  };
}

// ---------- shape / option validation ----------

test('l11: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenLehmer12Mean([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 1);
  assert.equal(r.minLehmer12Mean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'lehmer-12-mean-desc');
  assert.equal(r.generatedAt, GEN);
});

test('l11: minRows < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer12Mean([], { minRows: 0 }),
    /minRows must be an integer >= 1/,
  );
});

test('l11: minRows non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer12Mean([], {
        minRows: 2.5 as unknown as number,
      }),
    /minRows must be an integer >= 1/,
  );
});

test('l11: minLehmer12Mean negative throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer12Mean([], { minLehmer12Mean: -1 }),
    /minLehmer12Mean must be a finite, non-negative number/,
  );
});

test('l11: minLehmer12Mean NaN throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer12Mean([], { minLehmer12Mean: Number.NaN }),
    /minLehmer12Mean must be a finite, non-negative number/,
  );
});

test('l11: minLehmer12Mean Infinity throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer12Mean([], {
        minLehmer12Mean: Number.POSITIVE_INFINITY,
      }),
    /minLehmer12Mean must be a finite, non-negative number/,
  );
});

test('l11: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer12Mean([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('l11: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer12Mean([], { top: 2.5 }),
    /top must be a positive integer/,
  );
});

test('l11: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer12Mean([], {
        sort: 'banana' as unknown as 'lehmer-12-mean-desc',
      }),
    /sort must be one of/,
  );
});

test('l11: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer12Mean([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('l11: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer12Mean([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('l11: generatedAt defaults to now ISO when omitted', () => {
  const r = buildSourceRowTokenLehmer12Mean([]);
  assert.match(r.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

// ---------- arithmetic correctness ----------

test('l11: single positive row -> L_12 = L_11 = L_10 = mean = that row', () => {
  const queue = mkSeries('s', [42]);
  const r = buildSourceRowTokenLehmer12Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.lehmer12Mean, 42);
  assert.equal(row.lehmer11Mean, 42);
  assert.equal(row.lehmer10Mean, 42);
  assert.equal(row.mean, 42);
  assert.equal(row.l12L11Gap, 0);
  assert.equal(row.l12L10Gap, 0);
  assert.equal(row.l12AmGap, 0);
});

test('l11: constant positive series -> L_12 = c, all gaps = 0', () => {
  const queue = mkSeries('s', [7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenLehmer12Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.lehmer12Mean, 7);
  assert.equal(row.lehmer11Mean, 7);
  assert.equal(row.lehmer10Mean, 7);
  assert.equal(row.mean, 7);
  assert.equal(row.l12L11Gap, 0);
  assert.equal(row.l12L10Gap, 0);
  assert.equal(row.l12AmGap, 0);
});

test('l11: matches reference on [1,1,1,1,1000] (bottleneck domination > L_11)', () => {
  const xs = [1, 1, 1, 1, 1000];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer12Mean(queue, { generatedAt: GEN });
  const ref = l11Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer12Mean - ref.l12) < 1e-3);
  assert.ok(Math.abs(row.lehmer11Mean - ref.l11) < 1e-6);
  assert.ok(Math.abs(row.lehmer10Mean - ref.l10) < 1e-6);
  assert.ok(row.lehmer12Mean >= row.lehmer11Mean - 1e-9);
  assert.ok(row.lehmer12Mean <= 1000 * (1 + 1e-9));
  assert.ok(row.lehmer12Mean > 999.99999999);
});

test('l11: matches reference on [1,2,3,4,5]', () => {
  const xs = [1, 2, 3, 4, 5];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer12Mean(queue, { generatedAt: GEN });
  const ref = l11Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer12Mean - ref.l12) < 1e-9);
  // sum12 = 1 + 2^12 + 3^12 + 4^12 + 5^12
  //       = 1 + 4096 + 531441 + 16777216 + 244140625 = 261453379
  // sum11 = 1 + 2048 + 177147 + 4194304 + 48828125 = 53201625
  // L_12  = 261453379/53201625
  assert.ok(Math.abs(row.lehmer12Mean - 261453379 / 53201625) < 1e-9);
});

test('l11: zero rows are no-ops; mixed [0, 0, 4]', () => {
  const xs = [0, 0, 4];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer12Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.lehmer12Mean, 4);
  assert.equal(row.lehmer11Mean, 4);
  assert.equal(row.lehmer10Mean, 4);
  assert.ok(Math.abs(row.mean - 4 / 3) < 1e-9);
  assert.equal(row.l12L11Gap, 0);
  assert.equal(row.l12L10Gap, 0);
  assert.ok(Math.abs(row.l12AmGap - (4 - 4 / 3)) < 1e-9);
});

test('l11: all-zero source dropped', () => {
  const queue = mkSeries('s', [0, 0, 0, 0]);
  const r = buildSourceRowTokenLehmer12Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAllZeroSources, 1);
});

test('l11: cross-check L_10, L_11 against prior builders', () => {
  const xs = [3, 5, 8, 13, 21, 34];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer12Mean(queue, { generatedAt: GEN });
  const l11Report = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
  const l10Report = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  const l11Row = l11Report.sources[0]!;
  const l10Row = l10Report.sources[0]!;
  assert.ok(Math.abs(row.lehmer11Mean - l11Row.lehmer11Mean) < 1e-9);
  assert.ok(Math.abs(row.lehmer10Mean - l10Row.lehmer10Mean) < 1e-9);
  // Lehmer monotonicity: L_12 >= L_11 >= L_10 >= mean
  assert.ok(row.lehmer12Mean >= row.lehmer11Mean);
  assert.ok(row.lehmer11Mean >= row.lehmer10Mean);
  assert.ok(row.lehmer10Mean >= row.mean);
  assert.ok(row.l12L11Gap >= 0);
  assert.ok(row.l12L10Gap >= row.l12L11Gap);
  assert.ok(row.l12AmGap >= row.l12L10Gap);
});

test('l11: scale-equivariance: rescale by 10 -> L_12 rescales by 10', () => {
  const xs = [1, 4, 9, 16, 25];
  const xs10 = xs.map((x) => x * 10);
  const r1 = buildSourceRowTokenLehmer12Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r10 = buildSourceRowTokenLehmer12Mean(mkSeries('s', xs10), {
    generatedAt: GEN,
  });
  const v1 = r1.sources[0]!.lehmer12Mean;
  const v10 = r10.sources[0]!.lehmer12Mean;
  assert.ok(Math.abs(v10 - v1 * 10) < 1e-5 * Math.max(1, v1 * 10));
});

test('l11: order-invariance: shuffle does not change L_12', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const xsShuf = [9, 5, 5, 6, 3, 4, 2, 3, 1, 1];
  const a = buildSourceRowTokenLehmer12Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const b = buildSourceRowTokenLehmer12Mean(mkSeries('s', xsShuf), {
    generatedAt: GEN,
  }).sources[0]!;
  assert.ok(Math.abs(a.lehmer12Mean - b.lehmer12Mean) < 1e-9);
});

// ---------- filtering / sort / top ----------

test('l11: drops negative total_tokens', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('2026-04-28T05:00:00.000Z', 's', -5),
  ];
  const r = buildSourceRowTokenLehmer12Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l11: drops invalid hour_start', () => {
  const queue = [...mkSeries('s', [1, 2, 3]), ql('not-a-date', 's', 9)];
  const r = buildSourceRowTokenLehmer12Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l11: drops invalid total_tokens (NaN)', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('2026-04-28T05:00:00.000Z', 's', Number.NaN),
  ];
  const r = buildSourceRowTokenLehmer12Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('l11: source filter keeps only matches', () => {
  const queue = [...mkSeries('a', [1, 2, 3]), ...mkSeries('b', [10, 20, 30])];
  const r = buildSourceRowTokenLehmer12Mean(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 3);
});

test('l11: minRows gate drops sub-threshold sources', () => {
  const queue = [...mkSeries('a', [1, 2, 3, 4, 5]), ...mkSeries('b', [10, 20])];
  const r = buildSourceRowTokenLehmer12Mean(queue, {
    generatedAt: GEN,
    minRows: 5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('l11: minLehmer12Mean cohort filter drops below threshold', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmer12Mean(queue, {
    generatedAt: GEN,
    minLehmer12Mean: 50,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinLehmer12Mean, 1);
});

test('l11: top cap suppresses tail and reports droppedBelowTopCap', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
    ...mkSeries('c', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmer12Mean(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l11: sort=lehmer-12-mean-asc reverses order', () => {
  const queue = [...mkSeries('a', [1, 1, 1]), ...mkSeries('b', [10, 10, 10])];
  const r = buildSourceRowTokenLehmer12Mean(queue, {
    generatedAt: GEN,
    sort: 'lehmer-12-mean-asc',
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l11: sort=source orders alphabetically', () => {
  const queue = [...mkSeries('zeta', [1, 2, 3]), ...mkSeries('alpha', [4, 5, 6])];
  const r = buildSourceRowTokenLehmer12Mean(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('l11: since/until window filters rows', () => {
  const queue = [
    ql('2026-04-27T10:00:00.000Z', 's', 1),
    ql('2026-04-28T10:00:00.000Z', 's', 2),
    ql('2026-04-29T10:00:00.000Z', 's', 4),
  ];
  const r = buildSourceRowTokenLehmer12Mean(queue, {
    generatedAt: GEN,
    since: '2026-04-28T00:00:00.000Z',
    until: '2026-04-29T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.rowsKept, 1);
  assert.equal(r.sources[0]!.lehmer12Mean, 2);
});

// ---------- property tests ----------

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('property: L_12 >= L_11 >= L_10 >= AM (Lehmer monotonicity, builder-internal)', () => {
  const r = rng(20260429);
  for (let trial = 0; trial < 60; trial += 1) {
    const n = 2 + Math.floor(r() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 1000));
    if (xs.every((x) => x === 0)) continue;
    const queue = mkSeries(`t${trial}`, xs);
    const rep = buildSourceRowTokenLehmer12Mean(queue, { generatedAt: GEN });
    if (rep.sources.length === 0) continue;
    const row = rep.sources[0]!;
    assert.ok(row.lehmer12Mean + 1e-9 >= row.lehmer11Mean);
    assert.ok(row.lehmer11Mean + 1e-9 >= row.lehmer10Mean);
    assert.ok(row.lehmer10Mean + 1e-9 >= row.mean);
    assert.ok(row.l12L11Gap >= -1e-9);
    assert.ok(row.l12L10Gap >= -1e-9);
    assert.ok(row.l12AmGap >= -1e-9);
    assert.ok(row.l12AmGap + 1e-9 >= row.l12L10Gap);
    assert.ok(row.l12L10Gap + 1e-9 >= row.l12L11Gap);
  }
});

test('property: L_12 = c on a constant positive series for arbitrary c', () => {
  const r = rng(424242);
  for (let trial = 0; trial < 30; trial += 1) {
    const c = 1 + Math.floor(r() * 5000);
    const n = 2 + Math.floor(r() * 20);
    const xs = new Array(n).fill(c);
    const rep = buildSourceRowTokenLehmer12Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    assert.ok(Math.abs(row.lehmer12Mean - c) < 1e-7 * c);
    assert.ok(Math.abs(row.l12L11Gap) < 1e-7 * c);
    assert.ok(Math.abs(row.l12L10Gap) < 1e-7 * c);
    assert.ok(Math.abs(row.l12AmGap) < 1e-7 * c);
  }
});

test('property: scale-equivariance L_12(c*x) = c * L_12(x)', () => {
  const r = rng(99999);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 3 + Math.floor(r() * 15);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(1 + Math.floor(r() * 500));
    const c = 1 + Math.floor(r() * 50);
    const xsScaled = xs.map((x) => x * c);
    const a = buildSourceRowTokenLehmer12Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    }).sources[0]!.lehmer12Mean;
    const b = buildSourceRowTokenLehmer12Mean(mkSeries('s', xsScaled), {
      generatedAt: GEN,
    }).sources[0]!.lehmer12Mean;
    assert.ok(Math.abs(b - a * c) < 1e-5 * Math.max(1, a * c));
  }
});

// ---------- self-eleventh-power-weighted-mean closed-form property ----------
test('property: L_12 equals the x^11-self-weighted arithmetic mean (closed form)', () => {
  const r = rng(27182);
  for (let trial = 0; trial < 40; trial += 1) {
    const n = 2 + Math.floor(r() * 25);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 1000));
    if (xs.every((x) => x === 0)) continue;
    let wsum = 0;
    let wxsum = 0;
    for (const x of xs) {
      const x2 = x * x;
      const x4 = x2 * x2;
      const x8 = x4 * x4;
      const x11 = x8 * x2 * x;
      wsum += x11;
      wxsum += x11 * x;
    }
    if (wsum === 0) continue;
    const closedForm = wxsum / wsum;
    const rep = buildSourceRowTokenLehmer12Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer12Mean;
    assert.ok(
      Math.abs(got - closedForm) < 1e-9 * Math.max(1, closedForm),
      `L_12 should equal sum(x^12)/sum(x^11): got=${got} vs ${closedForm} on xs=${JSON.stringify(xs)}`,
    );
  }
});

// ---------- bottleneck-domination property ----------
test('property: L_12 is at least as close to bottleneck M as L_11 on heavy-tailed series', () => {
  const r = rng(161803);
  for (let trial = 0; trial < 25; trial += 1) {
    const n = 4 + Math.floor(r() * 12);
    const c = 1 + Math.floor(r() * 5);
    const M = c * (1000 + Math.floor(r() * 9000));
    const xs = new Array(n - 1).fill(c);
    xs.push(M);
    const rep = buildSourceRowTokenLehmer12Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    const distL11 = M - row.lehmer12Mean;
    const distL10 = M - row.lehmer11Mean;
    assert.ok(distL11 >= -1e-6 * M);
    assert.ok(distL10 >= -1e-6 * M);
    assert.ok(distL11 <= distL10 + 1e-6 * M);
    // L_12 should be at least 2x closer to bottleneck than L_11
    assert.ok(distL11 * 2 <= distL10 + 1e-6 * M);
  }
});

// ---------- defining-identity round-trip ----------
test('refinement: L_12 satisfies L_12 * sum(x^11) == sum(x^12) round-trip identity', () => {
  const r = rng(57721566);
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 2 + Math.floor(r() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 2000));
    if (xs.every((x) => x === 0)) continue;
    let s11 = 0;
    let s12 = 0;
    for (const x of xs) {
      const x2 = x * x;
      const x4 = x2 * x2;
      const x8 = x4 * x4;
      const x11 = x8 * x2 * x;
      s11 += x11;
      s12 += x11 * x;
    }
    if (s11 === 0) continue;
    const rep = buildSourceRowTokenLehmer12Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer12Mean;
    const recovered = got * s11;
    assert.ok(
      Math.abs(recovered - s12) < 1e-9 * Math.max(1, s12),
      `L_12 * sum(x^11) should recover sum(x^12): got=${got}, sum11=${s11}, sum12=${s12}, recovered=${recovered}`,
    );
  }
});

// ---------- equality case L_12 = max(x) iff all positive rows == max ----------
test('refinement: L_12 = max iff all positive rows equal max', () => {
  const cases: { xs: number[]; max: number }[] = [
    { xs: [10, 10, 10, 10], max: 10 },
    { xs: [0, 7], max: 7 },
    { xs: [0, 0, 0, 99, 99], max: 99 },
    { xs: [42], max: 42 },
  ];
  for (const { xs, max } of cases) {
    const rep = buildSourceRowTokenLehmer12Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer12Mean;
    assert.ok(Math.abs(got - max) < 1e-9 * max);
  }
  const r = rng(12345);
  for (let trial = 0; trial < 25; trial += 1) {
    const n = 2 + Math.floor(r() * 10);
    const max = 100 + Math.floor(r() * 1000);
    const xs: number[] = [max];
    const small = 1 + Math.floor(r() * (max - 1));
    xs.push(small);
    for (let i = 2; i < n; i += 1) {
      xs.push(1 + Math.floor(r() * (max - 1)));
    }
    const rep = buildSourceRowTokenLehmer12Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    const got = rep.sources[0]!.lehmer12Mean;
    assert.ok(got < max);
    assert.ok(got >= rep.sources[0]!.lehmer11Mean - 1e-9 * max);
  }
});

// ---------- L_12 - L_11 closed-form gap identity ----------
test('refinement: l12L11Gap == sum(x^11 * (x - L_11)) / sum(x^11) closed-form gap identity', () => {
  const r = rng(0xc0de1234);
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 2 + Math.floor(r() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 1500));
    if (xs.every((x) => x === 0)) continue;
    let s11 = 0;
    for (const x of xs) {
      const x2 = x * x;
      const x4 = x2 * x2;
      const x8 = x4 * x4;
      const x11 = x8 * x2 * x;
      s11 += x11;
    }
    if (s11 === 0) continue;
    const rep = buildSourceRowTokenLehmer12Mean(mkSeries(`g${trial}`, xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const row = rep.sources[0]!;
    const L11 = row.lehmer11Mean;
    let gapNum = 0;
    for (const x of xs) {
      const x2 = x * x;
      const x4 = x2 * x2;
      const x8 = x4 * x4;
      const x11 = x8 * x2 * x;
      gapNum += x11 * (x - L11);
    }
    const gapClosedForm = gapNum / s11;
    const gapReported = row.l12L11Gap;
    const tol = 1e-7 * Math.max(1, row.lehmer12Mean);
    assert.ok(
      Math.abs(gapReported - gapClosedForm) < tol,
      `l12L11Gap should equal sum(x^11*(x-L_11))/sum(x^11); got reported=${gapReported}, closed-form=${gapClosedForm}`,
    );
  }
});

// ---------- end-to-end ladder L_9 <= L_10 <= L_11 <= L_12 ----------
test('refinement: full integer Lehmer ladder L_9 <= L_10 <= L_11 <= L_12 holds end-to-end', () => {
  const r = rng(0xfeedface);
  let trialsRun = 0;
  for (let trial = 0; trial < 60; trial += 1) {
    const n = 3 + Math.floor(r() * 25);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 5000));
    if (xs.every((x) => x === 0)) continue;
    const queue = mkSeries(`chain${trial}`, xs);
    const r12 = buildSourceRowTokenLehmer12Mean(queue, { generatedAt: GEN });
    const r11 = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
    const r10 = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
    const r9 = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
    if (
      r12.sources.length === 0 ||
      r11.sources.length === 0 ||
      r10.sources.length === 0 ||
      r9.sources.length === 0
    )
      continue;
    const L12 = r12.sources[0]!.lehmer12Mean;
    const L11 = r11.sources[0]!.lehmer11Mean;
    const L10 = r10.sources[0]!.lehmer10Mean;
    const L9 = r9.sources[0]!.lehmer9Mean;
    const eps = 1e-9 * Math.max(1, L12);
    assert.ok(L9 <= L10 + eps);
    assert.ok(L10 <= L11 + eps);
    assert.ok(L11 <= L12 + eps);
    trialsRun += 1;
  }
  assert.ok(trialsRun >= 30);
});
