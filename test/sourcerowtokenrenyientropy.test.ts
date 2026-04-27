import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenRenyiEntropy } from '../src/sourcerowtokenrenyientropy.js';
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

const GEN = '2026-04-27T12:00:00.000Z';

function series(values: number[], src = 's'): QueueLine[] {
  return values.map((v, i) => {
    const hh = Math.floor(i / 60) % 24;
    const mm = i % 60;
    const day = 25 + Math.floor(i / (24 * 60));
    return ql(
      `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
      src,
      v,
    );
  });
}

test('renyi-entropy: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenRenyiEntropy([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.bins, 16);
  assert.equal(r.alpha, 2);
  assert.equal(r.sort, 'h2norm-asc');
  assert.equal(r.generatedAt, GEN);
});

test('renyi-entropy: constant series -> droppedConstantSeries', () => {
  const data = series(new Array(20).fill(7));
  const r = buildSourceRowTokenRenyiEntropy(data, { generatedAt: GEN });
  assert.equal(r.droppedConstantSeries, 1);
  assert.equal(r.sources.length, 0);
});

test('renyi-entropy: too few rows -> droppedBelowMinRows', () => {
  const data = series([1, 2, 3, 4]);
  const r = buildSourceRowTokenRenyiEntropy(data, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('renyi-entropy: uniform-on-bins distribution -> h2Norm ~ 1', () => {
  // With bins=10 and values 0..9 each repeated 10 times -> 10 non-empty
  // bins each with prob 0.1; sum p^2 = 10 * 0.01 = 0.1; h2 = log2(10) ~= 3.3219.
  // h2Norm = h2 / log2(10) = 1 exactly.
  const vals: number[] = [];
  for (let v = 0; v < 10; v++) {
    for (let k = 0; k < 10; k++) vals.push(v);
  }
  const r = buildSourceRowTokenRenyiEntropy(series(vals), {
    generatedAt: GEN,
    bins: 10,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.support, 10);
  assert.ok(Math.abs(row.collisionProb - 0.1) < 1e-12);
  assert.ok(Math.abs(row.h2 - Math.log2(10)) < 1e-12);
  assert.ok(Math.abs(row.h2Norm - 1) < 1e-12);
});

test('renyi-entropy: highly concentrated distribution -> low h2Norm', () => {
  // 95 rows at value 0, 5 rows at value 100. bins=10.
  // Bin 0: count 95, p=0.95. Bin 9 (rightmost, inclusive): count 5, p=0.05.
  // sum p^2 = 0.95^2 + 0.05^2 = 0.9025 + 0.0025 = 0.905
  // h2 = -log2(0.905) ~= 0.14406
  // support = 2; log2(2) = 1; h2Norm ~= 0.14406
  const vals: number[] = [];
  for (let i = 0; i < 95; i++) vals.push(0);
  for (let i = 0; i < 5; i++) vals.push(100);
  const r = buildSourceRowTokenRenyiEntropy(series(vals), {
    generatedAt: GEN,
    bins: 10,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.support, 2);
  assert.ok(Math.abs(row.collisionProb - 0.905) < 1e-9);
  assert.ok(Math.abs(row.h2 - -Math.log2(0.905)) < 1e-9);
  assert.ok(Math.abs(row.h2Norm - -Math.log2(0.905)) < 1e-9);
  assert.ok(row.h2Norm < 0.2);
});

test('renyi-entropy: shuffle invariance (multiset statistic)', () => {
  // Build a deterministic sequence and a shuffled copy; same multiset
  // => identical h2 / h2Norm / support / collisionProb.
  const N = 50;
  const vals: number[] = [];
  let seed = 42;
  for (let i = 0; i < N; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    vals.push(seed % 1000);
  }
  // Shuffle deterministically (Fisher-Yates with the same LCG)
  const shuffled = [...vals];
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  const r1 = buildSourceRowTokenRenyiEntropy(series(vals, 'a'), {
    generatedAt: GEN,
    bins: 8,
  });
  const r2 = buildSourceRowTokenRenyiEntropy(series(shuffled, 'a'), {
    generatedAt: GEN,
    bins: 8,
  });
  assert.equal(r1.sources.length, 1);
  assert.equal(r2.sources.length, 1);
  const a = r1.sources[0]!;
  const b = r2.sources[0]!;
  assert.equal(a.support, b.support);
  assert.ok(Math.abs(a.collisionProb - b.collisionProb) < 1e-12);
  assert.ok(Math.abs(a.h2 - b.h2) < 1e-12);
  assert.ok(Math.abs(a.h2Norm - b.h2Norm) < 1e-12);
});

test('renyi-entropy: bins option respected', () => {
  const vals: number[] = [];
  for (let i = 0; i < 32; i++) vals.push(i);
  const r4 = buildSourceRowTokenRenyiEntropy(series(vals), {
    generatedAt: GEN,
    bins: 4,
  });
  const r32 = buildSourceRowTokenRenyiEntropy(series(vals), {
    generatedAt: GEN,
    bins: 32,
  });
  assert.equal(r4.bins, 4);
  assert.equal(r32.bins, 32);
  // With bins=4 on uniformly-spaced 0..31, support = 4.
  // With bins=32, support = 32 (each value its own bin).
  assert.equal(r4.sources[0]!.support, 4);
  assert.equal(r32.sources[0]!.support, 32);
});

test('renyi-entropy: --since / --until trim rows', () => {
  const data = series(new Array(40).fill(0).map((_, i) => i));
  const r = buildSourceRowTokenRenyiEntropy(data, {
    generatedAt: GEN,
    since: '2026-04-25T00:30:00Z',
    until: '2026-04-25T01:00:00Z',
  });
  assert.ok(r.totalRowsKept > 0 && r.totalRowsKept < 40);
});

test('renyi-entropy: source filter restricts groups', () => {
  const a = series(new Array(20).fill(0).map((_, i) => i), 'a');
  const b = series(new Array(20).fill(0).map((_, i) => i * 2), 'b');
  const r = buildSourceRowTokenRenyiEntropy([...a, ...b], {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('renyi-entropy: top cap surfaces droppedBelowTopCap', () => {
  const all: QueueLine[] = [];
  for (let s = 0; s < 5; s++) {
    const vals = new Array(20).fill(0).map((_, i) => (i + s) % 7);
    all.push(...series(vals, `src${s}`));
  }
  const r = buildSourceRowTokenRenyiEntropy(all, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 3);
});

test('renyi-entropy: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenRenyiEntropy([], {
        // @ts-expect-error testing invalid input
        sort: 'nope',
      }),
    /sort must be one of/,
  );
});

test('renyi-entropy: invalid bins throws', () => {
  assert.throws(
    () => buildSourceRowTokenRenyiEntropy([], { bins: 1 }),
    /bins must be an integer >= 2/,
  );
  assert.throws(
    () => buildSourceRowTokenRenyiEntropy([], { bins: 2.5 }),
    /bins must be an integer >= 2/,
  );
});

test('renyi-entropy: invalid minRows throws', () => {
  assert.throws(
    () => buildSourceRowTokenRenyiEntropy([], { minRows: 1 }),
    /minRows must be an integer >= 2/,
  );
});

test('renyi-entropy: invalid top throws', () => {
  assert.throws(
    () => buildSourceRowTokenRenyiEntropy([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('renyi-entropy: bad total_tokens surfaces in counters', () => {
  const data: QueueLine[] = [];
  data.push(ql('2026-04-25T00:00:00Z', 'a', NaN));
  data.push(ql('2026-04-25T00:01:00Z', 'a', -5));
  data.push(...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'a'));
  const r = buildSourceRowTokenRenyiEntropy(data, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
});

test('renyi-entropy: bad hour_start surfaces in droppedInvalidHourStart', () => {
  const data: QueueLine[] = [];
  data.push(ql('not-a-date', 'a', 1));
  const r = buildSourceRowTokenRenyiEntropy(data, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('renyi-entropy: invalid since/until throws', () => {
  assert.throws(
    () => buildSourceRowTokenRenyiEntropy([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () => buildSourceRowTokenRenyiEntropy([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('renyi-entropy: sort orderings work', () => {
  const all: QueueLine[] = [];
  // src0: highly concentrated
  const conc = new Array(40).fill(0);
  conc[0] = 1000;
  all.push(...series(conc, 'src0'));
  // src1: uniform
  const uniform: number[] = [];
  for (let i = 0; i < 40; i++) uniform.push(i);
  all.push(...series(uniform, 'src1'));

  const ascN = buildSourceRowTokenRenyiEntropy(all, {
    generatedAt: GEN,
    sort: 'h2norm-asc',
  });
  const descN = buildSourceRowTokenRenyiEntropy(all, {
    generatedAt: GEN,
    sort: 'h2norm-desc',
  });
  assert.equal(ascN.sources[0]!.source, 'src0'); // most concentrated first
  assert.equal(descN.sources[0]!.source, 'src1'); // most uniform first

  const bySource = buildSourceRowTokenRenyiEntropy(all, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(bySource.sources[0]!.source, 'src0');
  assert.equal(bySource.sources[1]!.source, 'src1');
});

test('renyi-entropy: JSON shape — all documented fields present, finite numerics', () => {
  const vals: number[] = [];
  for (let i = 0; i < 30; i++) vals.push(i);
  const r = buildSourceRowTokenRenyiEntropy(series(vals), { generatedAt: GEN });
  const round = JSON.parse(JSON.stringify(r));
  for (const k of [
    'generatedAt',
    'windowStart',
    'windowEnd',
    'source',
    'minRows',
    'bins',
    'alpha',
    'top',
    'sort',
    'totalSources',
    'totalRowsKept',
    'droppedInvalidHourStart',
    'droppedInvalidTokens',
    'droppedNegativeTokens',
    'droppedSourceFilter',
    'droppedBelowMinRows',
    'droppedConstantSeries',
    'droppedBelowTopCap',
    'sources',
  ]) {
    assert.ok(k in round, `missing top-level field: ${k}`);
  }
  assert.equal(round.sources.length, 1);
  for (const k of [
    'source',
    'rowsKept',
    'minValue',
    'maxValue',
    'support',
    'collisionProb',
    'h2',
    'h2Norm',
  ]) {
    assert.ok(k in round.sources[0], `missing per-row field: ${k}`);
  }
  for (const k of ['minValue', 'maxValue', 'collisionProb', 'h2', 'h2Norm']) {
    assert.ok(
      Number.isFinite(round.sources[0][k]),
      `${k} must serialise as a finite number, got ${round.sources[0][k]}`,
    );
  }
});

test('renyi-entropy: alpha != 2 changes h2 numerically', () => {
  // Same data, alpha=2 vs alpha=8. With a concentrated distribution,
  // alpha=8 (closer to min-entropy) is strictly less than alpha=2.
  const vals: number[] = [];
  for (let i = 0; i < 90; i++) vals.push(0);
  for (let i = 0; i < 10; i++) vals.push(50);
  const r2 = buildSourceRowTokenRenyiEntropy(series(vals), {
    generatedAt: GEN,
    bins: 10,
    alpha: 2,
  });
  const r8 = buildSourceRowTokenRenyiEntropy(series(vals), {
    generatedAt: GEN,
    bins: 10,
    alpha: 8,
  });
  assert.equal(r2.alpha, 2);
  assert.equal(r8.alpha, 8);
  assert.equal(r2.sources.length, 1);
  assert.equal(r8.sources.length, 1);
  // Renyi is monotonically non-increasing in alpha. Strict here.
  assert.ok(
    r8.sources[0]!.h2 < r2.sources[0]!.h2,
    `H_8 (${r8.sources[0]!.h2}) should be < H_2 (${r2.sources[0]!.h2})`,
  );
});

test('renyi-entropy: alpha=2 hand-computed value (90/10 split)', () => {
  // bins=10, 90 zeros -> bin 0 (p=0.9), 10 fifties -> bin 9 (p=0.1).
  // Sum p^2 = 0.81 + 0.01 = 0.82. H_2 = -log2(0.82) ~= 0.2863.
  const vals: number[] = [];
  for (let i = 0; i < 90; i++) vals.push(0);
  for (let i = 0; i < 10; i++) vals.push(50);
  const r = buildSourceRowTokenRenyiEntropy(series(vals), {
    generatedAt: GEN,
    bins: 10,
    alpha: 2,
  });
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.collisionProb - 0.82) < 1e-9);
  assert.ok(Math.abs(row.h2 - -Math.log2(0.82)) < 1e-9);
});

test('renyi-entropy: alpha=0.5 hand-computed (90/10 split)', () => {
  // bins=10, p=(0.9, 0.1). sum p^0.5 = sqrt(0.9) + sqrt(0.1) ~= 0.9487+0.3162 = 1.2649.
  // H_0.5 = (1/(1-0.5)) * log2(1.2649) = 2 * log2(1.2649) ~= 0.6781.
  const vals: number[] = [];
  for (let i = 0; i < 90; i++) vals.push(0);
  for (let i = 0; i < 10; i++) vals.push(50);
  const r = buildSourceRowTokenRenyiEntropy(series(vals), {
    generatedAt: GEN,
    bins: 10,
    alpha: 0.5,
  });
  const row = r.sources[0]!;
  const expected = 2 * Math.log2(Math.sqrt(0.9) + Math.sqrt(0.1));
  assert.ok(
    Math.abs(row.h2 - expected) < 1e-9,
    `expected ${expected}, got ${row.h2}`,
  );
});

test('renyi-entropy: alpha monotonicity — H is non-increasing in alpha', () => {
  // Build a non-uniform histogram and check H_0.5 >= H_2 >= H_4 >= H_8.
  const vals: number[] = [];
  for (let i = 0; i < 60; i++) vals.push(0);
  for (let i = 0; i < 30; i++) vals.push(20);
  for (let i = 0; i < 10; i++) vals.push(50);
  const get = (a: number) =>
    buildSourceRowTokenRenyiEntropy(series(vals), {
      generatedAt: GEN,
      bins: 10,
      alpha: a,
    }).sources[0]!.h2;
  const h05 = get(0.5);
  const h2 = get(2);
  const h4 = get(4);
  const h8 = get(8);
  assert.ok(h05 >= h2 - 1e-12, `H_0.5 (${h05}) should be >= H_2 (${h2})`);
  assert.ok(h2 >= h4 - 1e-12, `H_2 (${h2}) should be >= H_4 (${h4})`);
  assert.ok(h4 >= h8 - 1e-12, `H_4 (${h4}) should be >= H_8 (${h8})`);
});

test('renyi-entropy: alpha = 1 throws (Shannon limit not handled)', () => {
  assert.throws(
    () => buildSourceRowTokenRenyiEntropy([], { alpha: 1 }),
    /alpha must be a finite number > 0 and != 1/,
  );
});

test('renyi-entropy: alpha <= 0 or non-finite throws', () => {
  assert.throws(
    () => buildSourceRowTokenRenyiEntropy([], { alpha: 0 }),
    /alpha must be/,
  );
  assert.throws(
    () => buildSourceRowTokenRenyiEntropy([], { alpha: -1 }),
    /alpha must be/,
  );
  assert.throws(
    () => buildSourceRowTokenRenyiEntropy([], { alpha: NaN }),
    /alpha must be/,
  );
});

test('renyi-entropy: alpha=2 on uniform distribution still yields h2Norm=1', () => {
  // Uniform bins => every Renyi-alpha equals log2(K). h2Norm == 1.
  const vals: number[] = [];
  for (let v = 0; v < 8; v++) {
    for (let k = 0; k < 10; k++) vals.push(v);
  }
  const r2 = buildSourceRowTokenRenyiEntropy(series(vals), {
    generatedAt: GEN,
    bins: 8,
    alpha: 2,
  });
  const r05 = buildSourceRowTokenRenyiEntropy(series(vals), {
    generatedAt: GEN,
    bins: 8,
    alpha: 0.5,
  });
  assert.ok(Math.abs(r2.sources[0]!.h2Norm - 1) < 1e-12);
  assert.ok(Math.abs(r05.sources[0]!.h2Norm - 1) < 1e-12);
});
