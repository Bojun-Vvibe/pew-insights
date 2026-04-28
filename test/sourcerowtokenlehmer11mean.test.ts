import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmer11Mean } from '../src/sourcerowtokenlehmer11mean.js';
import { buildSourceRowTokenLehmer10Mean } from '../src/sourcerowtokenlehmer10mean.js';
import { buildSourceRowTokenLehmer9Mean } from '../src/sourcerowtokenlehmer9mean.js';
import { buildSourceRowTokenLehmer8Mean } from '../src/sourcerowtokenlehmer8mean.js';
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
  l9: number;
  l10: number;
  l11: number;
} {
  const n = xs.length;
  let s11 = 0;
  let s10 = 0;
  let s9 = 0;
  let s8 = 0;
  let s1 = 0;
  for (const x of xs) {
    const x2 = x * x;
    const x4 = x2 * x2;
    const x8 = x4 * x4;
    const x9 = x8 * x;
    const x10 = x9 * x;
    const x11 = x10 * x;
    s11 += x11;
    s10 += x10;
    s9 += x9;
    s8 += x8;
    s1 += x;
  }
  return {
    mean: s1 / n,
    l9: s8 === 0 ? 0 : s9 / s8,
    l10: s9 === 0 ? 0 : s10 / s9,
    l11: s10 === 0 ? 0 : s11 / s10,
  };
}

// ---------- shape / option validation ----------

test('l11: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenLehmer11Mean([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 1);
  assert.equal(r.minLehmer11Mean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'lehmer-11-mean-desc');
  assert.equal(r.generatedAt, GEN);
});

test('l11: minRows < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer11Mean([], { minRows: 0 }),
    /minRows must be an integer >= 1/,
  );
});

test('l11: minRows non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer11Mean([], {
        minRows: 2.5 as unknown as number,
      }),
    /minRows must be an integer >= 1/,
  );
});

test('l11: minLehmer11Mean negative throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer11Mean([], { minLehmer11Mean: -1 }),
    /minLehmer11Mean must be a finite, non-negative number/,
  );
});

test('l11: minLehmer11Mean NaN throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer11Mean([], { minLehmer11Mean: Number.NaN }),
    /minLehmer11Mean must be a finite, non-negative number/,
  );
});

test('l11: minLehmer11Mean Infinity throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer11Mean([], {
        minLehmer11Mean: Number.POSITIVE_INFINITY,
      }),
    /minLehmer11Mean must be a finite, non-negative number/,
  );
});

test('l11: top zero throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer11Mean([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('l11: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer11Mean([], { top: 2.5 }),
    /top must be a positive integer/,
  );
});

test('l11: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLehmer11Mean([], {
        sort: 'banana' as unknown as 'lehmer-11-mean-desc',
      }),
    /sort must be one of/,
  );
});

test('l11: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer11Mean([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('l11: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenLehmer11Mean([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('l11: generatedAt defaults to now ISO when omitted', () => {
  const r = buildSourceRowTokenLehmer11Mean([]);
  assert.match(r.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

// ---------- arithmetic correctness ----------

test('l11: single positive row -> L_11 = L_10 = L_9 = mean = that row', () => {
  const queue = mkSeries('s', [42]);
  const r = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.lehmer11Mean, 42);
  assert.equal(row.lehmer10Mean, 42);
  assert.equal(row.lehmer9Mean, 42);
  assert.equal(row.mean, 42);
  assert.equal(row.l11L10Gap, 0);
  assert.equal(row.l11L9Gap, 0);
  assert.equal(row.l11AmGap, 0);
});

test('l11: constant positive series -> L_11 = c, all gaps = 0', () => {
  const queue = mkSeries('s', [7, 7, 7, 7, 7]);
  const r = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.lehmer11Mean, 7);
  assert.equal(row.lehmer10Mean, 7);
  assert.equal(row.lehmer9Mean, 7);
  assert.equal(row.mean, 7);
  assert.equal(row.l11L10Gap, 0);
  assert.equal(row.l11L9Gap, 0);
  assert.equal(row.l11AmGap, 0);
});

test('l11: matches reference on [1,1,1,1,1000] (bottleneck domination > L_10)', () => {
  const xs = [1, 1, 1, 1, 1000];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
  const ref = l11Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer11Mean - ref.l11) < 1e-3);
  assert.ok(Math.abs(row.lehmer10Mean - ref.l10) < 1e-6);
  assert.ok(Math.abs(row.lehmer9Mean - ref.l9) < 1e-6);
  assert.ok(row.lehmer11Mean >= row.lehmer10Mean - 1e-9);
  assert.ok(row.lehmer11Mean <= 1000 * (1 + 1e-9));
  assert.ok(row.lehmer11Mean > 999.99999999);
});

test('l11: matches reference on [1,2,3,4,5]', () => {
  const xs = [1, 2, 3, 4, 5];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
  const ref = l11Reference(xs);
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.lehmer11Mean - ref.l11) < 1e-9);
  // sum11 = 1 + 2^11 + 3^11 + 4^11 + 5^11
  //       = 1 + 2048 + 177147 + 4194304 + 48828125 = 53201625
  // sum10 = 1 + 1024 + 59049 + 1048576 + 9765625 = 10874275
  // L_11  = 53201625/10874275
  assert.ok(Math.abs(row.lehmer11Mean - 53201625 / 10874275) < 1e-9);
});

test('l11: zero rows are no-ops; mixed [0, 0, 4]', () => {
  const xs = [0, 0, 4];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.lehmer11Mean, 4);
  assert.equal(row.lehmer10Mean, 4);
  assert.equal(row.lehmer9Mean, 4);
  assert.ok(Math.abs(row.mean - 4 / 3) < 1e-9);
  assert.equal(row.l11L10Gap, 0);
  assert.equal(row.l11L9Gap, 0);
  assert.ok(Math.abs(row.l11AmGap - (4 - 4 / 3)) < 1e-9);
});

test('l11: all-zero source dropped', () => {
  const queue = mkSeries('s', [0, 0, 0, 0]);
  const r = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAllZeroSources, 1);
});

test('l11: cross-check L_9, L_10 against prior builders', () => {
  const xs = [3, 5, 8, 13, 21, 34];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
  const l10Report = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
  const l9Report = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  const l10Row = l10Report.sources[0]!;
  const l9Row = l9Report.sources[0]!;
  assert.ok(Math.abs(row.lehmer10Mean - l10Row.lehmer10Mean) < 1e-9);
  assert.ok(Math.abs(row.lehmer9Mean - l9Row.lehmer9Mean) < 1e-9);
  // Lehmer monotonicity: L_11 >= L_10 >= L_9 >= mean
  assert.ok(row.lehmer11Mean >= row.lehmer10Mean);
  assert.ok(row.lehmer10Mean >= row.lehmer9Mean);
  assert.ok(row.lehmer9Mean >= row.mean);
  assert.ok(row.l11L10Gap >= 0);
  assert.ok(row.l11L9Gap >= row.l11L10Gap);
  assert.ok(row.l11AmGap >= row.l11L9Gap);
});

test('l11: scale-equivariance: rescale by 10 -> L_11 rescales by 10', () => {
  const xs = [1, 4, 9, 16, 25];
  const xs10 = xs.map((x) => x * 10);
  const r1 = buildSourceRowTokenLehmer11Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r10 = buildSourceRowTokenLehmer11Mean(mkSeries('s', xs10), {
    generatedAt: GEN,
  });
  const v1 = r1.sources[0]!.lehmer11Mean;
  const v10 = r10.sources[0]!.lehmer11Mean;
  assert.ok(Math.abs(v10 - v1 * 10) < 1e-5 * Math.max(1, v1 * 10));
});

test('l11: order-invariance: shuffle does not change L_11', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const xsShuf = [9, 5, 5, 6, 3, 4, 2, 3, 1, 1];
  const a = buildSourceRowTokenLehmer11Mean(mkSeries('s', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const b = buildSourceRowTokenLehmer11Mean(mkSeries('s', xsShuf), {
    generatedAt: GEN,
  }).sources[0]!;
  assert.ok(Math.abs(a.lehmer11Mean - b.lehmer11Mean) < 1e-9);
});

// ---------- filtering / sort / top ----------

test('l11: drops negative total_tokens', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('2026-04-28T05:00:00.000Z', 's', -5),
  ];
  const r = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l11: drops invalid hour_start', () => {
  const queue = [...mkSeries('s', [1, 2, 3]), ql('not-a-date', 's', 9)];
  const r = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('l11: drops invalid total_tokens (NaN)', () => {
  const queue = [
    ...mkSeries('s', [1, 2, 3]),
    ql('2026-04-28T05:00:00.000Z', 's', Number.NaN),
  ];
  const r = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('l11: source filter keeps only matches', () => {
  const queue = [...mkSeries('a', [1, 2, 3]), ...mkSeries('b', [10, 20, 30])];
  const r = buildSourceRowTokenLehmer11Mean(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 3);
});

test('l11: minRows gate drops sub-threshold sources', () => {
  const queue = [...mkSeries('a', [1, 2, 3, 4, 5]), ...mkSeries('b', [10, 20])];
  const r = buildSourceRowTokenLehmer11Mean(queue, {
    generatedAt: GEN,
    minRows: 5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('l11: minLehmer11Mean cohort filter drops below threshold', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmer11Mean(queue, {
    generatedAt: GEN,
    minLehmer11Mean: 50,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinLehmer11Mean, 1);
});

test('l11: top cap suppresses tail and reports droppedBelowTopCap', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1]),
    ...mkSeries('b', [10, 10, 10]),
    ...mkSeries('c', [100, 100, 100]),
  ];
  const r = buildSourceRowTokenLehmer11Mean(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l11: sort=lehmer-11-mean-asc reverses order', () => {
  const queue = [...mkSeries('a', [1, 1, 1]), ...mkSeries('b', [10, 10, 10])];
  const r = buildSourceRowTokenLehmer11Mean(queue, {
    generatedAt: GEN,
    sort: 'lehmer-11-mean-asc',
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('l11: sort=source orders alphabetically', () => {
  const queue = [...mkSeries('zeta', [1, 2, 3]), ...mkSeries('alpha', [4, 5, 6])];
  const r = buildSourceRowTokenLehmer11Mean(queue, {
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
  const r = buildSourceRowTokenLehmer11Mean(queue, {
    generatedAt: GEN,
    since: '2026-04-28T00:00:00.000Z',
    until: '2026-04-29T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.rowsKept, 1);
  assert.equal(r.sources[0]!.lehmer11Mean, 2);
});

// ---------- property tests ----------

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('property: L_11 >= L_10 >= L_9 >= AM (Lehmer monotonicity, builder-internal)', () => {
  const r = rng(20260429);
  for (let trial = 0; trial < 60; trial += 1) {
    const n = 2 + Math.floor(r() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 1000));
    if (xs.every((x) => x === 0)) continue;
    const queue = mkSeries(`t${trial}`, xs);
    const rep = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
    if (rep.sources.length === 0) continue;
    const row = rep.sources[0]!;
    assert.ok(row.lehmer11Mean + 1e-9 >= row.lehmer10Mean);
    assert.ok(row.lehmer10Mean + 1e-9 >= row.lehmer9Mean);
    assert.ok(row.lehmer9Mean + 1e-9 >= row.mean);
    assert.ok(row.l11L10Gap >= -1e-9);
    assert.ok(row.l11L9Gap >= -1e-9);
    assert.ok(row.l11AmGap >= -1e-9);
    assert.ok(row.l11AmGap + 1e-9 >= row.l11L9Gap);
    assert.ok(row.l11L9Gap + 1e-9 >= row.l11L10Gap);
  }
});

test('property: L_11 = c on a constant positive series for arbitrary c', () => {
  const r = rng(424242);
  for (let trial = 0; trial < 30; trial += 1) {
    const c = 1 + Math.floor(r() * 5000);
    const n = 2 + Math.floor(r() * 20);
    const xs = new Array(n).fill(c);
    const rep = buildSourceRowTokenLehmer11Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    assert.ok(Math.abs(row.lehmer11Mean - c) < 1e-7 * c);
    assert.ok(Math.abs(row.l11L10Gap) < 1e-7 * c);
    assert.ok(Math.abs(row.l11L9Gap) < 1e-7 * c);
    assert.ok(Math.abs(row.l11AmGap) < 1e-7 * c);
  }
});

test('property: scale-equivariance L_11(c*x) = c * L_11(x)', () => {
  const r = rng(99999);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 3 + Math.floor(r() * 15);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(1 + Math.floor(r() * 500));
    const c = 1 + Math.floor(r() * 50);
    const xsScaled = xs.map((x) => x * c);
    const a = buildSourceRowTokenLehmer11Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    }).sources[0]!.lehmer11Mean;
    const b = buildSourceRowTokenLehmer11Mean(mkSeries('s', xsScaled), {
      generatedAt: GEN,
    }).sources[0]!.lehmer11Mean;
    assert.ok(Math.abs(b - a * c) < 1e-5 * Math.max(1, a * c));
  }
});

// ---------- self-tenth-power-weighted-mean closed-form property ----------
test('property: L_11 equals the x^10-self-weighted arithmetic mean (closed form)', () => {
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
      const x10 = x8 * x2;
      wsum += x10;
      wxsum += x10 * x;
    }
    if (wsum === 0) continue;
    const closedForm = wxsum / wsum;
    const rep = buildSourceRowTokenLehmer11Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer11Mean;
    assert.ok(
      Math.abs(got - closedForm) < 1e-9 * Math.max(1, closedForm),
      `L_11 should equal sum(x^11)/sum(x^10): got=${got} vs ${closedForm} on xs=${JSON.stringify(xs)}`,
    );
  }
});

// ---------- bottleneck-domination property ----------
test('property: L_11 is at least as close to bottleneck M as L_10 on heavy-tailed series', () => {
  const r = rng(161803);
  for (let trial = 0; trial < 25; trial += 1) {
    const n = 4 + Math.floor(r() * 12);
    const c = 1 + Math.floor(r() * 5);
    const M = c * (1000 + Math.floor(r() * 9000));
    const xs = new Array(n - 1).fill(c);
    xs.push(M);
    const rep = buildSourceRowTokenLehmer11Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    const row = rep.sources[0]!;
    const distL11 = M - row.lehmer11Mean;
    const distL10 = M - row.lehmer10Mean;
    assert.ok(distL11 >= -1e-6 * M);
    assert.ok(distL10 >= -1e-6 * M);
    assert.ok(distL11 <= distL10 + 1e-6 * M);
    // L_11 should be at least 2x closer to bottleneck than L_10
    assert.ok(distL11 * 2 <= distL10 + 1e-6 * M);
  }
});

// ---------- defining-identity round-trip ----------
test('refinement: L_11 satisfies L_11 * sum(x^10) == sum(x^11) round-trip identity', () => {
  const r = rng(57721566);
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 2 + Math.floor(r() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 2000));
    if (xs.every((x) => x === 0)) continue;
    let s10 = 0;
    let s11 = 0;
    for (const x of xs) {
      const x2 = x * x;
      const x4 = x2 * x2;
      const x8 = x4 * x4;
      const x10 = x8 * x2;
      s10 += x10;
      s11 += x10 * x;
    }
    if (s10 === 0) continue;
    const rep = buildSourceRowTokenLehmer11Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer11Mean;
    const recovered = got * s10;
    assert.ok(
      Math.abs(recovered - s11) < 1e-9 * Math.max(1, s11),
      `L_11 * sum(x^10) should recover sum(x^11): got=${got}, sum10=${s10}, sum11=${s11}, recovered=${recovered}`,
    );
  }
});

// ---------- equality case L_11 = max(x) iff all positive rows == max ----------
test('refinement: L_11 = max iff all positive rows equal max', () => {
  const cases: { xs: number[]; max: number }[] = [
    { xs: [10, 10, 10, 10], max: 10 },
    { xs: [0, 7], max: 7 },
    { xs: [0, 0, 0, 99, 99], max: 99 },
    { xs: [42], max: 42 },
  ];
  for (const { xs, max } of cases) {
    const rep = buildSourceRowTokenLehmer11Mean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const got = rep.sources[0]!.lehmer11Mean;
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
    const rep = buildSourceRowTokenLehmer11Mean(mkSeries(`t${trial}`, xs), {
      generatedAt: GEN,
    });
    const got = rep.sources[0]!.lehmer11Mean;
    assert.ok(got < max);
    assert.ok(got >= rep.sources[0]!.lehmer10Mean - 1e-9 * max);
  }
});

// ---------- L_11 - L_10 closed-form gap identity ----------
test('refinement: l11L10Gap == sum(x^10 * (x - L_10)) / sum(x^10) closed-form gap identity', () => {
  const r = rng(0xc0de1234);
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 2 + Math.floor(r() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 1500));
    if (xs.every((x) => x === 0)) continue;
    let s10 = 0;
    for (const x of xs) {
      const x2 = x * x;
      const x4 = x2 * x2;
      const x8 = x4 * x4;
      const x10 = x8 * x2;
      s10 += x10;
    }
    if (s10 === 0) continue;
    const rep = buildSourceRowTokenLehmer11Mean(mkSeries(`g${trial}`, xs), {
      generatedAt: GEN,
    });
    if (rep.sources.length === 0) continue;
    const row = rep.sources[0]!;
    const L10 = row.lehmer10Mean;
    let gapNum = 0;
    for (const x of xs) {
      const x2 = x * x;
      const x4 = x2 * x2;
      const x8 = x4 * x4;
      const x10 = x8 * x2;
      gapNum += x10 * (x - L10);
    }
    const gapClosedForm = gapNum / s10;
    const gapReported = row.l11L10Gap;
    const tol = 1e-7 * Math.max(1, row.lehmer11Mean);
    assert.ok(
      Math.abs(gapReported - gapClosedForm) < tol,
      `l11L10Gap should equal sum(x^10*(x-L_10))/sum(x^10); got reported=${gapReported}, closed-form=${gapClosedForm}`,
    );
  }
});

// ---------- end-to-end ladder L_8 <= L_9 <= L_10 <= L_11 ----------
test('refinement: full integer Lehmer ladder L_8 <= L_9 <= L_10 <= L_11 holds end-to-end', () => {
  const r = rng(0xfeedface);
  let trialsRun = 0;
  for (let trial = 0; trial < 60; trial += 1) {
    const n = 3 + Math.floor(r() * 25);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 5000));
    if (xs.every((x) => x === 0)) continue;
    const queue = mkSeries(`chain${trial}`, xs);
    const r11 = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
    const r10 = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
    const r9 = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
    const r8 = buildSourceRowTokenLehmer8Mean(queue, { generatedAt: GEN });
    if (
      r11.sources.length === 0 ||
      r10.sources.length === 0 ||
      r9.sources.length === 0 ||
      r8.sources.length === 0
    )
      continue;
    const L11 = r11.sources[0]!.lehmer11Mean;
    const L10 = r10.sources[0]!.lehmer10Mean;
    const L9 = r9.sources[0]!.lehmer9Mean;
    const L8 = r8.sources[0]!.lehmer8Mean;
    const eps = 1e-9 * Math.max(1, L11);
    assert.ok(L8 <= L9 + eps);
    assert.ok(L9 <= L10 + eps);
    assert.ok(L10 <= L11 + eps);
    trialsRun += 1;
  }
  assert.ok(trialsRun >= 30);
});
