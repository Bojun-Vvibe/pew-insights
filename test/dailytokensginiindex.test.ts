import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenSginiIndex,
  sginiOfVector,
} from '../src/dailytokensginiindex.js';
import { giniOfVector } from '../src/dailytokenginicoefficient.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-01T00:00:00.000Z';

// ---- sginiOfVector primitive -----------------------------------------

test('sginiOfVector: empty -> degenerate, S=0', () => {
  const r = sginiOfVector([], 3);
  assert.equal(r.sgini, 0);
  assert.equal(r.degenerate, true);
});

test('sginiOfVector: n=1 -> degenerate, S=0', () => {
  const r = sginiOfVector([42], 3);
  assert.equal(r.sgini, 0);
  assert.equal(r.degenerate, true);
});

test('sginiOfVector: all-zero -> degenerate, S=0', () => {
  const r = sginiOfVector([0, 0, 0, 0], 3);
  assert.equal(r.sgini, 0);
  assert.equal(r.degenerate, true);
});

test('sginiOfVector: perfect equality -> S=0 for any delta', () => {
  for (const d of [2, 3, 4, 7]) {
    const r = sginiOfVector([10, 10, 10, 10, 10], d);
    assert.ok(
      Math.abs(r.sgini) < 1e-12,
      `expected S=0 at delta=${d}, got ${r.sgini}`,
    );
    assert.equal(r.degenerate, false);
  }
});

test('sginiOfVector: scale-invariant', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = sginiOfVector(v, 3).sgini;
  const b = sginiOfVector(
    v.map((x) => x * 100),
    3,
  ).sgini;
  assert.ok(Math.abs(a - b) < 1e-12);
});

test('sginiOfVector: permutation-invariant', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = sginiOfVector(v, 3).sgini;
  const b = sginiOfVector([11, 4, 9, 3, 7, 1], 3).sgini;
  assert.ok(Math.abs(a - b) < 1e-15);
});

test('sginiOfVector: throws on negative', () => {
  assert.throws(() => sginiOfVector([1, -2, 3], 3));
});

test('sginiOfVector: throws on non-finite', () => {
  assert.throws(() => sginiOfVector([1, Number.POSITIVE_INFINITY, 3], 3));
  assert.throws(() => sginiOfVector([1, Number.NaN, 3], 3));
});

test('sginiOfVector: throws on delta <= 0', () => {
  assert.throws(() => sginiOfVector([1, 2, 3], 0));
  assert.throws(() => sginiOfVector([1, 2, 3], -1));
});

test('sginiOfVector: throws on delta = 1 (degenerate identity)', () => {
  assert.throws(() => sginiOfVector([1, 2, 3], 1));
});

test('sginiOfVector: delta=2 reproduces standard Gini exactly', () => {
  // Donaldson-Weymark identity: S(2) = standard Gini.
  for (const v of [
    [1, 1, 9, 9],
    [1, 5, 5, 9],
    [3, 7, 1, 11, 4, 9],
    [1, 2, 4, 8, 16, 32],
    [100, 100, 100, 1],
  ]) {
    const s = sginiOfVector(v, 2).sgini;
    const g = giniOfVector(v);
    assert.ok(
      Math.abs(s - g) < 1e-12,
      `S(2)=${s} vs G=${g} for ${JSON.stringify(v)}`,
    );
  }
});

test('sginiOfVector: weights sum to 1 for any delta > 0', () => {
  // Implicit identity: a constant vector c yields S = 0 because
  // S = 1 - (sum_i c * w_i)/c = 1 - sum_i w_i = 0 iff sum w_i = 1.
  for (const d of [0.5, 2, 3, 5, 10]) {
    const r = sginiOfVector([7, 7, 7, 7, 7, 7], d);
    assert.ok(
      Math.abs(r.sgini) < 1e-12,
      `weights do not sum to 1 at delta=${d}: S=${r.sgini}`,
    );
  }
});

test('sginiOfVector: monotone in delta (delta>=2) -> S(d) >= G for non-trivial input', () => {
  // Donaldson-Weymark: the larger delta, the more bottom-rank weighting,
  // the larger S for any vector that is NOT degenerate / two-point with
  // matching kernel symmetry.
  const v = [1, 2, 3, 4, 5, 10, 20, 50, 100];
  const g = giniOfVector(v);
  let prev = g;
  for (const d of [2, 2.5, 3, 4, 6, 10]) {
    const s = sginiOfVector(v, d).sgini;
    assert.ok(
      s >= prev - 1e-12,
      `non-monotone: S(${d})=${s} < prev=${prev}`,
    );
    prev = s;
  }
});

test('sginiOfVector: bottom-weight identity S(3) >= S(2) = G', () => {
  // Cross-anchor identity used by --include-bottom-weight-excess refinement.
  for (const v of [
    [1, 2, 3, 4, 5],
    [10, 1, 1, 1, 1],
    [3, 7, 1, 11, 4, 9],
    [1, 2, 4, 8, 16],
  ]) {
    const s3 = sginiOfVector(v, 3).sgini;
    const g = giniOfVector(v);
    assert.ok(s3 >= g - 1e-12, `S(3)=${s3} < G=${g} for ${JSON.stringify(v)}`);
  }
});

test('sginiOfVector: range bounded in [0, 1)', () => {
  for (const v of [
    [1, 1, 1, 100],
    [0, 0, 0, 0, 1000],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [1e9, 1, 1, 1],
  ]) {
    const s = sginiOfVector(v, 3).sgini;
    assert.ok(s >= 0 - 1e-12 && s < 1, `out-of-range S(3)=${s} for ${JSON.stringify(v)}`);
  }
});

test('sginiOfVector: known value for [1,1,9,9] at delta=3', () => {
  // n=4, mu=5, sorted [1,1,9,9].
  // weights w_i = ((n-i+1)/n)^3 - ((n-i)/n)^3 for i=1..4
  //   i=1: 1^3 - (3/4)^3 = 1 - 0.421875 = 0.578125
  //   i=2: (3/4)^3 - (2/4)^3 = 0.421875 - 0.125 = 0.296875
  //   i=3: (2/4)^3 - (1/4)^3 = 0.125 - 0.015625 = 0.109375
  //   i=4: (1/4)^3 - 0 = 0.015625
  //   sum = 1.0   (weight identity check)
  // weighted = 1*0.578125 + 1*0.296875 + 9*0.109375 + 9*0.015625
  //          = 0.875 + 9*0.125 = 0.875 + 1.125 = 2.0
  // S(3) = 1 - 2.0/5 = 1 - 0.4 = 0.6
  const r = sginiOfVector([1, 1, 9, 9], 3);
  assert.ok(
    Math.abs(r.sgini - 0.6) < 1e-12,
    `expected 0.6, got ${r.sgini}`,
  );
});

// ---- buildDailyTokenSginiIndex --------------------------------------

test('build: empty queue -> no rows', () => {
  const r = buildDailyTokenSginiIndex([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.delta, 3);
});

test('build: single source bottom-weighted gini computed', () => {
  // 4 days, mass [1000, 2000, 3000, 4000]
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'src-a', 1000),
    ql('2026-04-02T00:00:00Z', 'src-a', 2000),
    ql('2026-04-03T00:00:00Z', 'src-a', 3000),
    ql('2026-04-04T00:00:00Z', 'src-a', 4000),
  ];
  const r = buildDailyTokenSginiIndex(queue, {
    generatedAt: GEN,
    minTokens: 100,
    minDays: 3,
    delta: 3,
    includeBottomWeightExcess: true,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src-a');
  assert.equal(row.nDays, 4);
  assert.ok(row.sgini > 0);
  assert.ok(row.sgini < 1);
  assert.ok(row.sgini >= row.gini - 1e-12);
  assert.ok(row.bottomWeightExcess !== undefined);
  assert.ok((row.bottomWeightExcess as number) >= 0 - 1e-12);
});

test('build: refinement bottomWeightExcess = sgini - gini exactly', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'src-a', 1000),
    ql('2026-04-02T00:00:00Z', 'src-a', 1000),
    ql('2026-04-03T00:00:00Z', 'src-a', 9000),
    ql('2026-04-04T00:00:00Z', 'src-a', 9000),
  ];
  const r = buildDailyTokenSginiIndex(queue, {
    generatedAt: GEN,
    minTokens: 100,
    minDays: 3,
    delta: 3,
    includeBottomWeightExcess: true,
  });
  const row = r.sources[0]!;
  // Direct calc: vector [1000,1000,9000,9000] = scale * [1,1,9,9]; S(3)=0.6, G=0.4 (axis-46 test).
  assert.ok(Math.abs(row.sgini - 0.6) < 1e-12);
  assert.ok(Math.abs(row.gini - 0.4) < 1e-12);
  assert.ok(Math.abs((row.bottomWeightExcess as number) - 0.2) < 1e-12);
  assert.ok(Math.abs((row.sginiOverGini as number) - 1.5) < 1e-12);
});

test('build: filters minTokens and minDays', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'tiny', 50),
    ql('2026-04-02T00:00:00Z', 'tiny', 50),
    ql('2026-04-03T00:00:00Z', 'tiny', 50),
    ql('2026-04-04T00:00:00Z', 'tiny', 50),
    ql('2026-04-01T00:00:00Z', 'short', 5000),
    ql('2026-04-02T00:00:00Z', 'short', 5000),
    ql('2026-04-01T00:00:00Z', 'good', 5000),
    ql('2026-04-02T00:00:00Z', 'good', 5000),
    ql('2026-04-03T00:00:00Z', 'good', 5000),
  ];
  const r = buildDailyTokenSginiIndex(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minDays: 3,
    delta: 3,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'good');
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowMinDays, 1);
});

test('build: throws on delta = 1', () => {
  assert.throws(() =>
    buildDailyTokenSginiIndex([], { generatedAt: GEN, delta: 1 }),
  );
});

test('build: throws on delta <= 0', () => {
  assert.throws(() =>
    buildDailyTokenSginiIndex([], { generatedAt: GEN, delta: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenSginiIndex([], { generatedAt: GEN, delta: -1 }),
  );
});

test('build: delta=2 reproduces gini for every row', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'src-a', 1000),
    ql('2026-04-02T00:00:00Z', 'src-a', 2000),
    ql('2026-04-03T00:00:00Z', 'src-a', 3000),
    ql('2026-04-04T00:00:00Z', 'src-a', 4000),
    ql('2026-04-01T00:00:00Z', 'src-b', 1000),
    ql('2026-04-02T00:00:00Z', 'src-b', 1000),
    ql('2026-04-03T00:00:00Z', 'src-b', 9000),
    ql('2026-04-04T00:00:00Z', 'src-b', 9000),
  ];
  const r = buildDailyTokenSginiIndex(queue, {
    generatedAt: GEN,
    minTokens: 100,
    minDays: 3,
    delta: 2,
  });
  assert.equal(r.sources.length, 2);
  for (const row of r.sources) {
    assert.ok(
      Math.abs(row.sgini - row.gini) < 1e-12,
      `S(2)=${row.sgini} vs G=${row.gini} for ${row.source}`,
    );
  }
});

test('build: time-window since/until honored', () => {
  const queue: QueueLine[] = [
    ql('2026-03-31T00:00:00Z', 'src-a', 1000),
    ql('2026-04-01T00:00:00Z', 'src-a', 1000),
    ql('2026-04-02T00:00:00Z', 'src-a', 2000),
    ql('2026-04-03T00:00:00Z', 'src-a', 3000),
    ql('2026-04-04T00:00:00Z', 'src-a', 4000),
    ql('2026-04-05T00:00:00Z', 'src-a', 9999),
  ];
  const r = buildDailyTokenSginiIndex(queue, {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00Z',
    until: '2026-04-05T00:00:00Z',
    minTokens: 100,
    minDays: 3,
    delta: 3,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nDays, 4);
});

test('build: sort by bottomWeightExcess works (refinement field)', () => {
  const queue: QueueLine[] = [
    // src-a near-uniform -> small excess
    ql('2026-04-01T00:00:00Z', 'src-a', 1000),
    ql('2026-04-02T00:00:00Z', 'src-a', 1100),
    ql('2026-04-03T00:00:00Z', 'src-a', 900),
    ql('2026-04-04T00:00:00Z', 'src-a', 1000),
    // src-b heavy bottom-tail -> big excess at delta=3
    ql('2026-04-01T00:00:00Z', 'src-b', 10),
    ql('2026-04-02T00:00:00Z', 'src-b', 10),
    ql('2026-04-03T00:00:00Z', 'src-b', 10),
    ql('2026-04-04T00:00:00Z', 'src-b', 10000),
  ];
  const r = buildDailyTokenSginiIndex(queue, {
    generatedAt: GEN,
    minTokens: 100,
    minDays: 3,
    delta: 3,
    includeBottomWeightExcess: true,
    sort: 'bottomWeightExcess',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'src-b');
  assert.ok(
    (r.sources[0]!.bottomWeightExcess as number) >
      (r.sources[1]!.bottomWeightExcess as number),
  );
});
