import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenGeThreeIndex,
  geThreeOfVector,
  GE_THREE_PREFACTOR,
} from '../src/dailytokengethreeindex.js';
import { ge2OfVector } from '../src/dailytokenge2index.js';
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

// ---- geThreeOfVector primitive --------------------------------------

test('geThreeOfVector: empty -> degenerate', () => {
  const r = geThreeOfVector([]);
  assert.equal(r.gethree, 0);
  assert.equal(r.degenerate, true);
});

test('geThreeOfVector: n=1 -> degenerate, gethree=0', () => {
  const r = geThreeOfVector([42]);
  assert.equal(r.gethree, 0);
  assert.equal(r.degenerate, true);
  assert.equal(r.mean, 42);
});

test('geThreeOfVector: perfect equality -> 0', () => {
  const r = geThreeOfVector([7, 7, 7, 7, 7, 7]);
  assert.equal(r.gethree, 0);
  assert.equal(r.degenerate, true);
  assert.ok(Math.abs(r.mean - 7) < 1e-12);
  assert.ok(Math.abs(r.cubicShareMean - 1) < 1e-12);
});

test('geThreeOfVector: scale-invariant (multiply by k)', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = geThreeOfVector(v);
  const b = geThreeOfVector(v.map((x) => x * 1e6));
  assert.ok(
    Math.abs(a.gethree - b.gethree) < 1e-9,
    `${a.gethree} vs ${b.gethree}`,
  );
});

test('geThreeOfVector: permutation-invariant', () => {
  const a = geThreeOfVector([1, 3, 7, 9, 4, 11]);
  const b = geThreeOfVector([11, 4, 9, 3, 7, 1]);
  assert.ok(Math.abs(a.gethree - b.gethree) < 1e-12);
});

test('geThreeOfVector: closed form on [1, 4]', () => {
  // mu = 2.5, shares = 0.4, 1.6; cubes = 0.064, 4.096; mean = 2.08
  // GE(3) = (2.08 - 1)/6 = 0.18
  const r = geThreeOfVector([1, 4]);
  const expected = (2.08 - 1) / 6;
  assert.ok(
    Math.abs(r.gethree - expected) < 1e-12,
    `got ${r.gethree}, expected ${expected}`,
  );
});

test('geThreeOfVector: closed-form moment decomposition GE(3) = GE(2) + (1/6)*s*CV^3', () => {
  const v = [1, 3, 5, 17, 23, 41, 100, 7];
  const r = geThreeOfVector(v);
  const ge2 = 0.5 * r.cv * r.cv;
  const skewTerm = (r.skewness * r.cv * r.cv * r.cv) / 6;
  const reconstructed = ge2 + skewTerm;
  assert.ok(
    Math.abs(r.gethree - reconstructed) < 1e-9,
    `gethree ${r.gethree} vs ge2+skewterm ${reconstructed} (ge2=${ge2}, skew=${skewTerm})`,
  );
});

test('geThreeOfVector: prefactor constant equals 1/6', () => {
  assert.ok(Math.abs(GE_THREE_PREFACTOR - 1 / 6) < 1e-15);
});

test('geThreeOfVector: throws on zero, negative, NaN', () => {
  assert.throws(() => geThreeOfVector([1, 0, 4]));
  assert.throws(() => geThreeOfVector([1, -3, 4]));
  assert.throws(() => geThreeOfVector([1, Number.NaN, 4]));
});

test('geThreeOfVector: heavy-tail spike dominates GE(2) by skewness term', () => {
  // Vector with heavy upper tail; skewness positive and large.
  const A = [1, 1, 1, 1, 1, 1, 1, 1, 1, 100];
  const B = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const aThree = geThreeOfVector(A).gethree;
  const bThree = geThreeOfVector(B).gethree;
  const a2 = ge2OfVector(A).ge2;
  const b2 = ge2OfVector(B).ge2;
  // Both axes higher on A; but ratio aThree/bThree should EXCEED
  // a2/b2 because GE(3) cubes the spike's share (super-emphasis).
  assert.ok(aThree > bThree);
  assert.ok(a2 > b2);
  assert.ok(
    aThree / bThree > a2 / b2,
    `expected GE(3) tail-emphasis (${(aThree / bThree).toFixed(2)}) > GE(2) (${(a2 / b2).toFixed(2)})`,
  );
});

test('geThreeOfVector: lognormal MC approaches (exp(3*sigma^2) - 1)/6', () => {
  let s = 91827;
  function rnd(): number {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    return (s + 1) / 0x80000000;
  }
  function rnorm(): number {
    return Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
  }
  const sigma = 0.5;
  const N = 80000;
  const v: number[] = [];
  for (let i = 0; i < N; i++) v.push(Math.exp(3 + sigma * rnorm()));
  const r = geThreeOfVector(v);
  const expected = (Math.exp(3 * sigma * sigma) - 1) / 6;
  // Heavier-tail third moment: 5% tolerance.
  assert.ok(
    Math.abs(r.gethree - expected) < 0.05 * expected + 0.02,
    `lognormal GE(3) ~ ${expected.toFixed(4)}, got ${r.gethree.toFixed(4)}`,
  );
});

test('geThreeOfVector: GE(3) >= GE(2) on positively-skewed data', () => {
  // For right-skewed (s>0) data, the (1/6)*s*CV^3 term is positive,
  // so GE(3) > GE(2).
  const v = [1, 1, 1, 1, 2, 3, 5, 8, 13, 21]; // Fibonacci-ish, right-skewed
  const r = geThreeOfVector(v);
  const ge2 = ge2OfVector(v).ge2;
  assert.ok(r.skewness > 0, `expected positive skewness, got ${r.skewness}`);
  assert.ok(r.gethree > ge2, `expected GE(3)=${r.gethree} > GE(2)=${ge2}`);
});

// ---- builder behaviour ----------------------------------------------

test('buildDailyTokenGeThreeIndex: empty queue -> zero rows, zero counters', () => {
  const r = buildDailyTokenGeThreeIndex([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.droppedInvalidHourStart, 0);
  assert.equal(r.droppedNonPositiveTokens, 0);
  assert.equal(r.droppedSourceFilter, 0);
  assert.equal(r.droppedSparseSources, 0);
  assert.equal(r.droppedBelowMinDays, 0);
  assert.equal(r.droppedBelowMinGeThree, 0);
  assert.equal(r.droppedTopSources, 0);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.minDays, 4);
  assert.equal(r.sort, 'gethree');
});

test('buildDailyTokenGeThreeIndex: one source mixed days computes positive GE(3)', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 100),
    ql('2026-04-26T00:00:00Z', 'a', 400),
    ql('2026-04-27T00:00:00Z', 'a', 900),
    ql('2026-04-28T00:00:00Z', 'a', 1600),
  ];
  const r = buildDailyTokenGeThreeIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'a');
  assert.equal(row.nDays, 4);
  assert.ok(row.gethree > 0);
  assert.equal(row.degenerate, false);
  assert.equal(row.minDay, '2026-04-25');
  assert.equal(row.maxDay, '2026-04-28');
});

test('buildDailyTokenGeThreeIndex: equal days -> degenerate', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 100),
    ql('2026-04-26T00:00:00Z', 'a', 100),
    ql('2026-04-27T00:00:00Z', 'a', 100),
    ql('2026-04-28T00:00:00Z', 'a', 100),
  ];
  const r = buildDailyTokenGeThreeIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.degenerate, true);
  assert.equal(r.sources[0]!.gethree, 0);
});

test('buildDailyTokenGeThreeIndex: --include-moment-decomposition surfaces cv/skewness/ge2/diff', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 1),
    ql('2026-04-26T00:00:00Z', 'a', 4),
    ql('2026-04-27T00:00:00Z', 'a', 9),
    ql('2026-04-28T00:00:00Z', 'a', 16),
  ];
  const r = buildDailyTokenGeThreeIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    includeMomentDecomposition: true,
  });
  const row = r.sources[0]!;
  assert.ok(row.cv !== undefined);
  assert.ok(row.skewness !== undefined);
  assert.ok(row.ge2 !== undefined);
  assert.ok(row.geThreeMinusGeTwo !== undefined);
  // Closed-form check: GE(3) = GE(2) + (1/6)*skewness*CV^3.
  const reconstructed = (row.ge2 as number) + (row.geThreeMinusGeTwo as number);
  assert.ok(
    Math.abs(row.gethree - reconstructed) < 1e-9,
    `gethree ${row.gethree} vs ge2+diff ${reconstructed}`,
  );
  // geThreeMinusGeTwo must equal gethree - ge2.
  assert.ok(
    Math.abs(
      (row.geThreeMinusGeTwo as number) -
        (row.gethree - (row.ge2 as number)),
    ) < 1e-9,
  );
});

test('buildDailyTokenGeThreeIndex: filters minTokens / minDays / minGeThree', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'sparse', 100),
    ql('2026-04-26T00:00:00Z', 'sparse', 100),
    ql('2026-04-27T00:00:00Z', 'sparse', 100),
    ql('2026-04-28T00:00:00Z', 'sparse', 100),
    ql('2026-04-25T00:00:00Z', 'fewdays', 2000),
    ql('2026-04-26T00:00:00Z', 'fewdays', 2000),
    ql('2026-04-25T00:00:00Z', 'ok', 1000),
    ql('2026-04-26T00:00:00Z', 'ok', 2000),
    ql('2026-04-27T00:00:00Z', 'ok', 3000),
    ql('2026-04-28T00:00:00Z', 'ok', 4000),
  ];
  const r = buildDailyTokenGeThreeIndex(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'ok');
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowMinDays, 1);
  const r2 = buildDailyTokenGeThreeIndex(queue, {
    generatedAt: GEN,
    minGeThree: 100.0,
  });
  assert.equal(r2.sources.length, 0);
  assert.equal(r2.droppedBelowMinGeThree, 1);
});

test('buildDailyTokenGeThreeIndex: top cap and sort respected', () => {
  const queue: QueueLine[] = [];
  for (let d = 25; d <= 28; d++) {
    queue.push(ql(`2026-04-${d}T00:00:00Z`, 'low', 1000 + d));
    queue.push(ql(`2026-04-${d}T00:00:00Z`, 'mid', d * d * 100));
    queue.push(ql(`2026-04-${d}T00:00:00Z`, 'high', d * d * d * 10));
  }
  const r = buildDailyTokenGeThreeIndex(queue, {
    generatedAt: GEN,
    sort: 'gethree',
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.gethree >= r.sources[1]!.gethree);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenGeThreeIndex: source filter restricts rows', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 1000),
    ql('2026-04-26T00:00:00Z', 'a', 2000),
    ql('2026-04-27T00:00:00Z', 'a', 3000),
    ql('2026-04-28T00:00:00Z', 'a', 4000),
    ql('2026-04-25T00:00:00Z', 'b', 5000),
    ql('2026-04-26T00:00:00Z', 'b', 6000),
    ql('2026-04-27T00:00:00Z', 'b', 7000),
    ql('2026-04-28T00:00:00Z', 'b', 8000),
  ];
  const r = buildDailyTokenGeThreeIndex(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 4);
});

test('buildDailyTokenGeThreeIndex: invalid hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 1000),
    ql('2026-04-25T00:00:00Z', 'a', 1000),
    ql('2026-04-26T00:00:00Z', 'a', 2000),
    ql('2026-04-27T00:00:00Z', 'a', 3000),
    ql('2026-04-28T00:00:00Z', 'a', 4000),
  ];
  const r = buildDailyTokenGeThreeIndex(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenGeThreeIndex: rejects bad knobs', () => {
  assert.throws(() =>
    buildDailyTokenGeThreeIndex([], { generatedAt: GEN, minDays: 1 }),
  );
  assert.throws(() =>
    buildDailyTokenGeThreeIndex([], { generatedAt: GEN, minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenGeThreeIndex([], { generatedAt: GEN, top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenGeThreeIndex([], {
      generatedAt: GEN,
      minGeThree: -0.1,
    }),
  );
  assert.throws(() =>
    buildDailyTokenGeThreeIndex([], {
      generatedAt: GEN,
      sort: 'bogus' as never,
    }),
  );
  assert.throws(() =>
    buildDailyTokenGeThreeIndex([], {
      generatedAt: GEN,
      since: 'not-iso',
    }),
  );
});
