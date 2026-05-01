import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenVarianceOfLogarithms,
  varianceOfLogarithmsOfVector,
} from '../src/dailytokenvarianceoflogarithms.js';
import { theilLOfVector } from '../src/dailytokentheillindex.js';
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

// ---- varianceOfLogarithmsOfVector primitive --------------------------

test('varianceOfLogarithmsOfVector: empty -> degenerate, vl=0', () => {
  const r = varianceOfLogarithmsOfVector([]);
  assert.equal(r.vl, 0);
  assert.equal(r.degenerate, true);
});

test('varianceOfLogarithmsOfVector: n=1 -> degenerate, vl=0', () => {
  const r = varianceOfLogarithmsOfVector([42]);
  assert.equal(r.vl, 0);
  assert.equal(r.degenerate, true);
  // n=1 still returns the singleton mean/log for downstream display
  assert.equal(r.mean, 42);
  assert.ok(Math.abs(r.meanLog - Math.log(42)) < 1e-12);
});

test('varianceOfLogarithmsOfVector: perfect equality -> vl=0', () => {
  const r = varianceOfLogarithmsOfVector([10, 10, 10, 10, 10, 10]);
  assert.equal(r.vl, 0);
  assert.equal(r.degenerate, true);
  assert.ok(Math.abs(r.geoMean - 10) < 1e-12);
  assert.ok(Math.abs(r.mean - 10) < 1e-12);
});

test('varianceOfLogarithmsOfVector: scale-invariance (multiplying by k leaves VL unchanged)', () => {
  const v = [1, 2, 3, 4, 5, 6];
  const a = varianceOfLogarithmsOfVector(v);
  const b = varianceOfLogarithmsOfVector(v.map((x) => x * 1000));
  assert.ok(
    Math.abs(a.vl - b.vl) < 1e-12,
    `expected vl scale-invariant, got ${a.vl} vs ${b.vl}`,
  );
  // meanLog shifts by log(1000)
  assert.ok(Math.abs(b.meanLog - a.meanLog - Math.log(1000)) < 1e-10);
});

test('varianceOfLogarithmsOfVector: permutation-invariant', () => {
  const v = [1, 3, 7, 9, 4, 11];
  const a = varianceOfLogarithmsOfVector(v);
  const b = varianceOfLogarithmsOfVector([11, 4, 9, 3, 7, 1]);
  assert.ok(Math.abs(a.vl - b.vl) < 1e-12);
});

test('varianceOfLogarithmsOfVector: known closed-form on [1, 2, 4, 8]', () => {
  // log values: 0, log2, 2log2, 3log2
  // mean of logs = (0 + 1 + 2 + 3)/4 * log2 = 1.5 * log2
  // deviations: -1.5, -0.5, 0.5, 1.5 (in units of log2)
  // sum sq = (2.25+0.25+0.25+2.25) = 5
  // VL = 5/4 * (log2)^2
  const r = varianceOfLogarithmsOfVector([1, 2, 4, 8]);
  const expected = (5 / 4) * Math.log(2) ** 2;
  assert.ok(Math.abs(r.vl - expected) < 1e-12, `got ${r.vl}, expected ${expected}`);
});

test('varianceOfLogarithmsOfVector: 2*GE(0) for lognormal-like vectors only', () => {
  // For an arbitrary 4-vector, VL != 2 * GE(0) in general.
  const v = [1, 2, 3, 100]; // very skewed -> not lognormal
  const r = varianceOfLogarithmsOfVector(v);
  const l = theilLOfVector(v).theilL;
  // The two are different functionals; ratio should NOT be ~1.
  const ratio = r.vl / (2 * l);
  assert.ok(
    Math.abs(ratio - 1) > 0.05,
    `expected non-lognormal vector to break VL = 2*GE(0); got ratio ${ratio}`,
  );
});

test('varianceOfLogarithmsOfVector: lognormal sample tracks 2*GE(0) closely', () => {
  // Generate a deterministic large-ish lognormal sample via Box-Muller
  // with a fixed seed (deterministic LCG).
  let seed = 1234567;
  function lcg(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }
  function randn(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = lcg();
    while (v === 0) v = lcg();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const sigma = 0.7;
  const mu = 5;
  const xs: number[] = [];
  for (let i = 0; i < 5000; i++) xs.push(Math.exp(mu + sigma * randn()));
  const r = varianceOfLogarithmsOfVector(xs);
  const l = theilLOfVector(xs).theilL;
  const ratio = r.vl / (2 * l);
  // Lognormal: ratio should be close to 1 (sampling noise).
  assert.ok(
    Math.abs(ratio - 1) < 0.05,
    `expected lognormal sample VL/(2*GE(0)) ~ 1; got ratio ${ratio}`,
  );
});

test('varianceOfLogarithmsOfVector: Welford agrees with naive two-pass', () => {
  const v = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  const r = varianceOfLogarithmsOfVector(v);
  const logs = v.map((x) => Math.log(x));
  const m = logs.reduce((a, b) => a + b, 0) / logs.length;
  const naive = logs.reduce((a, x) => a + (x - m) ** 2, 0) / logs.length;
  assert.ok(Math.abs(r.vl - naive) < 1e-12);
});

test('varianceOfLogarithmsOfVector: throws on zero entry', () => {
  assert.throws(() => varianceOfLogarithmsOfVector([1, 2, 0, 4]), /strictly-positive/);
});

test('varianceOfLogarithmsOfVector: throws on negative entry', () => {
  assert.throws(() => varianceOfLogarithmsOfVector([1, 2, -1, 4]), /strictly-positive/);
});

test('varianceOfLogarithmsOfVector: throws on non-finite entry', () => {
  assert.throws(() => varianceOfLogarithmsOfVector([1, NaN, 3]), /strictly-positive/);
  assert.throws(
    () => varianceOfLogarithmsOfVector([1, Number.POSITIVE_INFINITY, 3]),
    /strictly-positive/,
  );
});

// ---- buildDailyTokenVarianceOfLogarithms -----------------------------

test('buildDailyTokenVarianceOfLogarithms: basic shape + sort', () => {
  const queue: QueueLine[] = [];
  // source A: highly spread on log scale
  for (const [d, t] of [
    ['01', 1000],
    ['02', 8000],
    ['03', 64000],
    ['04', 1000],
  ] as const) {
    queue.push(ql(`2026-04-${d}T00:00:00.000Z`, 'A', t));
  }
  // source B: nearly uniform
  for (const [d, t] of [
    ['01', 5000],
    ['02', 5100],
    ['03', 4900],
    ['04', 5050],
  ] as const) {
    queue.push(ql(`2026-04-${d}T00:00:00.000Z`, 'B', t));
  }
  const r = buildDailyTokenVarianceOfLogarithms(queue, {
    minTokens: 1000,
    minDays: 4,
    sort: 'vl',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  // A has bigger vl than B
  assert.equal(r.sources[0].source, 'A');
  assert.ok(r.sources[0].vl > r.sources[1].vl);
  assert.equal(r.sources[1].source, 'B');
});

test('buildDailyTokenVarianceOfLogarithms: refinement ge0-anchor surfaces theilL + lognormality ratio', () => {
  const queue: QueueLine[] = [];
  for (const [d, t] of [
    ['01', 1000],
    ['02', 2000],
    ['03', 4000],
    ['04', 8000],
    ['05', 16000],
  ] as const) {
    queue.push(ql(`2026-04-${d}T00:00:00.000Z`, 'A', t));
  }
  const r = buildDailyTokenVarianceOfLogarithms(queue, {
    minTokens: 1000,
    minDays: 4,
    includeGe0Anchor: true,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0];
  assert.ok(row.theilL !== undefined && row.theilL > 0);
  assert.ok(row.vlOverTwoGe0 !== undefined);
  // For this powers-of-2 vector the ratio differs from 1 (not lognormal).
  // Sanity-check the identity by recomputing manually.
  const v = [1000, 2000, 4000, 8000, 16000];
  const expectedVL = varianceOfLogarithmsOfVector(v).vl;
  const expectedL = theilLOfVector(v).theilL;
  assert.ok(Math.abs(row.vl - expectedVL) < 1e-10);
  assert.ok(Math.abs((row.theilL as number) - expectedL) < 1e-10);
  assert.ok(
    Math.abs((row.vlOverTwoGe0 as number) - expectedVL / (2 * expectedL)) < 1e-10,
  );
});

test('buildDailyTokenVarianceOfLogarithms: minTokens floor drops sparse sources', () => {
  const queue: QueueLine[] = [];
  queue.push(ql('2026-04-01T00:00:00.000Z', 'sparse', 100));
  queue.push(ql('2026-04-02T00:00:00.000Z', 'sparse', 100));
  queue.push(ql('2026-04-03T00:00:00.000Z', 'sparse', 100));
  queue.push(ql('2026-04-04T00:00:00.000Z', 'sparse', 100));
  queue.push(ql('2026-04-01T00:00:00.000Z', 'big', 5000));
  queue.push(ql('2026-04-02T00:00:00.000Z', 'big', 5000));
  queue.push(ql('2026-04-03T00:00:00.000Z', 'big', 5000));
  queue.push(ql('2026-04-04T00:00:00.000Z', 'big', 5000));
  const r = buildDailyTokenVarianceOfLogarithms(queue, {
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenVarianceOfLogarithms: minDays floor drops short series', () => {
  const queue: QueueLine[] = [];
  queue.push(ql('2026-04-01T00:00:00.000Z', 'short', 5000));
  queue.push(ql('2026-04-02T00:00:00.000Z', 'short', 5000));
  const r = buildDailyTokenVarianceOfLogarithms(queue, {
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinDays, 1);
});

test('buildDailyTokenVarianceOfLogarithms: drops non-positive token rows at intake', () => {
  const queue: QueueLine[] = [];
  queue.push(ql('2026-04-01T00:00:00.000Z', 'A', 5000));
  queue.push(ql('2026-04-02T00:00:00.000Z', 'A', 0)); // dropped
  queue.push(ql('2026-04-03T00:00:00.000Z', 'A', 5000));
  queue.push(ql('2026-04-04T00:00:00.000Z', 'A', 5000));
  queue.push(ql('2026-04-05T00:00:00.000Z', 'A', 5000));
  const r = buildDailyTokenVarianceOfLogarithms(queue, {
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.droppedNonPositiveTokens, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].nDays, 4);
});

test('buildDailyTokenVarianceOfLogarithms: window filter via since/until', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 8; d++) {
    queue.push(
      ql(`2026-04-0${d}T00:00:00.000Z`, 'A', 1000 * Math.pow(2, d % 4)),
    );
  }
  const r = buildDailyTokenVarianceOfLogarithms(queue, {
    minTokens: 1000,
    minDays: 4,
    since: '2026-04-02T00:00:00.000Z',
    until: '2026-04-07T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.windowStart, '2026-04-02T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-07T00:00:00.000Z');
  assert.equal(r.sources[0].nDays, 5);
});

test('buildDailyTokenVarianceOfLogarithms: invalid sort throws', () => {
  assert.throws(
    () => buildDailyTokenVarianceOfLogarithms([], { sort: 'bogus' as never }),
    /sort must be/,
  );
});

test('buildDailyTokenVarianceOfLogarithms: minDays < 2 throws', () => {
  assert.throws(
    () => buildDailyTokenVarianceOfLogarithms([], { minDays: 1 }),
    /minDays must be an integer >= 2/,
  );
});

test('buildDailyTokenVarianceOfLogarithms: minVl negative throws', () => {
  assert.throws(
    () => buildDailyTokenVarianceOfLogarithms([], { minVl: -0.5 }),
    /minVl must be a non-negative finite number/,
  );
});

test('buildDailyTokenVarianceOfLogarithms: minVl filter drops low-vl rows', () => {
  const queue: QueueLine[] = [];
  for (const [d, t] of [
    ['01', 1000],
    ['02', 16000],
    ['03', 1000],
    ['04', 16000],
  ] as const) {
    queue.push(ql(`2026-04-${d}T00:00:00.000Z`, 'high', t));
  }
  for (const [d, t] of [
    ['01', 5000],
    ['02', 5010],
    ['03', 4990],
    ['04', 5005],
  ] as const) {
    queue.push(ql(`2026-04-${d}T00:00:00.000Z`, 'low', t));
  }
  const r = buildDailyTokenVarianceOfLogarithms(queue, {
    minTokens: 1000,
    minDays: 4,
    minVl: 0.5,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'high');
  assert.equal(r.droppedBelowMinVl, 1);
});

test('buildDailyTokenVarianceOfLogarithms: top cap retains highest vl rows', () => {
  const queue: QueueLine[] = [];
  for (const src of ['A', 'B', 'C']) {
    const factor = src === 'A' ? 16 : src === 'B' ? 4 : 1;
    for (const [d, t] of [
      ['01', 1000 * factor],
      ['02', 8000 * factor],
      ['03', 1000 * factor],
      ['04', 8000 * factor],
    ] as const) {
      queue.push(ql(`2026-04-${d}T00:00:00.000Z`, src, t));
    }
  }
  const r = buildDailyTokenVarianceOfLogarithms(queue, {
    minTokens: 1000,
    minDays: 4,
    top: 2,
    sort: 'tokens',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  // sorted by tokens desc (vl is identical across A/B/C since scale-invariant)
  assert.equal(r.sources[0].source, 'A');
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenVarianceOfLogarithms: source filter restricts to one source', () => {
  const queue: QueueLine[] = [];
  for (const src of ['A', 'B']) {
    for (const [d, t] of [
      ['01', 1000],
      ['02', 2000],
      ['03', 4000],
      ['04', 8000],
    ] as const) {
      queue.push(ql(`2026-04-${d}T00:00:00.000Z`, src, t));
    }
  }
  const r = buildDailyTokenVarianceOfLogarithms(queue, {
    minTokens: 1000,
    minDays: 4,
    source: 'A',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'A');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenVarianceOfLogarithms: bad hour_start counted as droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [];
  queue.push(ql('not-a-date', 'A', 5000));
  for (const d of ['01', '02', '03', '04']) {
    queue.push(ql(`2026-04-${d}T00:00:00.000Z`, 'A', 5000));
  }
  const r = buildDailyTokenVarianceOfLogarithms(queue, {
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});
