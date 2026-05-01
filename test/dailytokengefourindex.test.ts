import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenGeFourIndex,
  geFourOfVector,
  GE_FOUR_PREFACTOR,
} from '../src/dailytokengefourindex.js';
import { geThreeOfVector } from '../src/dailytokengethreeindex.js';
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

// ---- geFourOfVector primitive --------------------------------------

test('geFourOfVector: empty -> degenerate', () => {
  const r = geFourOfVector([]);
  assert.equal(r.gefour, 0);
  assert.equal(r.degenerate, true);
});

test('geFourOfVector: n=1 -> degenerate, gefour=0', () => {
  const r = geFourOfVector([42]);
  assert.equal(r.gefour, 0);
  assert.equal(r.degenerate, true);
  assert.equal(r.mean, 42);
});

test('geFourOfVector: perfect equality -> 0', () => {
  const r = geFourOfVector([7, 7, 7, 7, 7, 7]);
  assert.equal(r.gefour, 0);
  assert.equal(r.degenerate, true);
  assert.ok(Math.abs(r.mean - 7) < 1e-12);
  assert.ok(Math.abs(r.quarticShareMean - 1) < 1e-12);
});

test('geFourOfVector: scale-invariant (multiply by k)', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = geFourOfVector(v);
  const b = geFourOfVector(v.map((x) => x * 1e6));
  assert.ok(
    Math.abs(a.gefour - b.gefour) < 1e-9,
    `${a.gefour} vs ${b.gefour}`,
  );
});

test('geFourOfVector: permutation-invariant', () => {
  const a = geFourOfVector([1, 3, 7, 9, 4, 11]);
  const b = geFourOfVector([11, 4, 9, 3, 7, 1]);
  assert.ok(Math.abs(a.gefour - b.gefour) < 1e-12);
});

test('geFourOfVector: closed form on [1, 4]', () => {
  // mu = 2.5, shares = 0.4, 1.6; quartics = 0.0256, 6.5536; mean = 3.2896
  // GE(4) = (3.2896 - 1)/12 = 2.2896/12 = 0.1908
  const r = geFourOfVector([1, 4]);
  const expected = (3.2896 - 1) / 12;
  assert.ok(
    Math.abs(r.gefour - expected) < 1e-12,
    `got ${r.gefour}, expected ${expected}`,
  );
});

test('geFourOfVector: closed-form moment decomposition GE(4) = (1/2)*CV^2 + (1/3)*s*CV^3 + (1/12)*k*CV^4', () => {
  const v = [1, 3, 5, 17, 23, 41, 100, 7];
  const r = geFourOfVector(v);
  const ge2 = 0.5 * r.cv * r.cv;
  const skewTerm = (r.skewness * r.cv * r.cv * r.cv) / 3;
  const kurtTerm = (r.kurtosis * r.cv * r.cv * r.cv * r.cv) / 12;
  const reconstructed = ge2 + skewTerm + kurtTerm;
  assert.ok(
    Math.abs(r.gefour - reconstructed) < 1e-9,
    `gefour ${r.gefour} vs ge2+s*CV^3/3+k*CV^4/12 ${reconstructed}`,
  );
});

test('geFourOfVector: prefactor constant equals 1/12', () => {
  assert.ok(Math.abs(GE_FOUR_PREFACTOR - 1 / 12) < 1e-15);
});

test('geFourOfVector: throws on zero, negative, NaN', () => {
  assert.throws(() => geFourOfVector([1, 0, 4]));
  assert.throws(() => geFourOfVector([1, -3, 4]));
  assert.throws(() => geFourOfVector([1, Number.NaN, 4]));
});

test('geFourOfVector: heavy-tail spike super-emphasised vs GE(3) and GE(2)', () => {
  // Vector with heavy upper tail; alpha=4 should super-emphasise the
  // spike contribution even more than alpha=3 does.
  const A = [1, 1, 1, 1, 1, 1, 1, 1, 1, 100];
  const B = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const aFour = geFourOfVector(A).gefour;
  const bFour = geFourOfVector(B).gefour;
  const aThree = geThreeOfVector(A).gethree;
  const bThree = geThreeOfVector(B).gethree;
  const a2 = ge2OfVector(A).ge2;
  const b2 = ge2OfVector(B).ge2;
  assert.ok(aFour > bFour);
  assert.ok(aThree > bThree);
  assert.ok(a2 > b2);
  // GE(4) emphasises the spike even more than GE(3).
  assert.ok(
    aFour / bFour > aThree / bThree,
    `expected GE(4) tail-emphasis (${(aFour / bFour).toFixed(2)}) > GE(3) (${(aThree / bThree).toFixed(2)})`,
  );
  // ...and even more than GE(2).
  assert.ok(
    aFour / bFour > a2 / b2,
    `expected GE(4) tail-emphasis (${(aFour / bFour).toFixed(2)}) > GE(2) (${(a2 / b2).toFixed(2)})`,
  );
});

test('geFourOfVector: lognormal MC approaches (exp(6*sigma^2) - 1)/12', () => {
  let s = 91827;
  function rnd(): number {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    return (s + 1) / 0x80000000;
  }
  function rnorm(): number {
    return Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
  }
  const sigma = 0.4; // smaller sigma than axis-56 so 4th moment less volatile
  const N = 80000;
  const v: number[] = [];
  for (let i = 0; i < N; i++) v.push(Math.exp(3 + sigma * rnorm()));
  const r = geFourOfVector(v);
  const expected = (Math.exp(6 * sigma * sigma) - 1) / 12;
  // Heavier-tail fourth moment: 10% tolerance.
  assert.ok(
    Math.abs(r.gefour - expected) < 0.1 * expected + 0.05,
    `lognormal GE(4) ~ ${expected.toFixed(4)}, got ${r.gefour.toFixed(4)}`,
  );
});

test('geFourOfVector: GE(4) >= GE(3) on positively-skewed data', () => {
  // For right-skewed data, the (1/6)*s*CV^3 + (1/12)*k*CV^4 increment
  // is positive (k >= 1 always; s > 0 for right-skewed), so GE(4) >
  // GE(3).
  const v = [1, 1, 1, 1, 2, 3, 5, 8, 13, 21]; // Fibonacci-ish, right-skewed
  const r = geFourOfVector(v);
  const ge3 = geThreeOfVector(v).gethree;
  assert.ok(r.skewness > 0, `expected positive skewness, got ${r.skewness}`);
  assert.ok(r.kurtosis > 0, `expected positive kurtosis, got ${r.kurtosis}`);
  assert.ok(r.gefour > ge3, `expected GE(4)=${r.gefour} > GE(3)=${ge3}`);
});

// ---- builder behaviour ----------------------------------------------

test('buildDailyTokenGeFourIndex: empty queue -> zero rows, zero counters', () => {
  const r = buildDailyTokenGeFourIndex([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.droppedInvalidHourStart, 0);
  assert.equal(r.droppedNonPositiveTokens, 0);
  assert.equal(r.droppedSourceFilter, 0);
  assert.equal(r.droppedSparseSources, 0);
  assert.equal(r.droppedBelowMinDays, 0);
  assert.equal(r.droppedBelowMinGeFour, 0);
  assert.equal(r.droppedTopSources, 0);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.minDays, 4);
  assert.equal(r.sort, 'gefour');
});

test('buildDailyTokenGeFourIndex: one source mixed days computes positive GE(4)', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 100),
    ql('2026-04-26T00:00:00Z', 'a', 400),
    ql('2026-04-27T00:00:00Z', 'a', 900),
    ql('2026-04-28T00:00:00Z', 'a', 1600),
  ];
  const r = buildDailyTokenGeFourIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'a');
  assert.equal(row.nDays, 4);
  assert.ok(row.gefour > 0);
  assert.equal(row.degenerate, false);
  assert.equal(row.minDay, '2026-04-25');
  assert.equal(row.maxDay, '2026-04-28');
});

test('buildDailyTokenGeFourIndex: equal days -> degenerate', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 100),
    ql('2026-04-26T00:00:00Z', 'a', 100),
    ql('2026-04-27T00:00:00Z', 'a', 100),
    ql('2026-04-28T00:00:00Z', 'a', 100),
  ];
  const r = buildDailyTokenGeFourIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.degenerate, true);
  assert.equal(r.sources[0]!.gefour, 0);
});

test('buildDailyTokenGeFourIndex: --include-moment-decomposition surfaces cv/skewness/kurtosis/ge2/ge3/diff', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 1),
    ql('2026-04-26T00:00:00Z', 'a', 4),
    ql('2026-04-27T00:00:00Z', 'a', 9),
    ql('2026-04-28T00:00:00Z', 'a', 16),
  ];
  const r = buildDailyTokenGeFourIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    includeMomentDecomposition: true,
  });
  const row = r.sources[0]!;
  assert.ok(row.cv !== undefined);
  assert.ok(row.skewness !== undefined);
  assert.ok(row.kurtosis !== undefined);
  assert.ok(row.ge2 !== undefined);
  assert.ok(row.ge3 !== undefined);
  assert.ok(row.geFourMinusGeThree !== undefined);
  // Closed-form check: GE(4) = GE(3) + (1/6)*skew*CV^3 + (1/12)*kurt*CV^4 = ge3 + diff.
  const reconstructed =
    (row.ge3 as number) + (row.geFourMinusGeThree as number);
  assert.ok(
    Math.abs(row.gefour - reconstructed) < 1e-9,
    `gefour ${row.gefour} vs ge3+diff ${reconstructed}`,
  );
  // geFourMinusGeThree must equal gefour - ge3.
  assert.ok(
    Math.abs(
      (row.geFourMinusGeThree as number) -
        (row.gefour - (row.ge3 as number)),
    ) < 1e-9,
  );
});

test('buildDailyTokenGeFourIndex: filters minTokens / minDays / minGeFour', () => {
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
  const r = buildDailyTokenGeFourIndex(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'ok');
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowMinDays, 1);
  const r2 = buildDailyTokenGeFourIndex(queue, {
    generatedAt: GEN,
    minGeFour: 100.0,
  });
  assert.equal(r2.sources.length, 0);
  assert.equal(r2.droppedBelowMinGeFour, 1);
});

test('buildDailyTokenGeFourIndex: top cap and sort respected', () => {
  const queue: QueueLine[] = [];
  for (let d = 25; d <= 28; d++) {
    queue.push(ql(`2026-04-${d}T00:00:00Z`, 'low', 1000 + d));
    queue.push(ql(`2026-04-${d}T00:00:00Z`, 'mid', d * d * 100));
    queue.push(ql(`2026-04-${d}T00:00:00Z`, 'high', d * d * d * 10));
  }
  const r = buildDailyTokenGeFourIndex(queue, {
    generatedAt: GEN,
    sort: 'gefour',
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.gefour >= r.sources[1]!.gefour);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenGeFourIndex: source filter restricts rows', () => {
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
  const r = buildDailyTokenGeFourIndex(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 4);
});

test('buildDailyTokenGeFourIndex: invalid hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 1000),
    ql('2026-04-25T00:00:00Z', 'a', 1000),
    ql('2026-04-26T00:00:00Z', 'a', 2000),
    ql('2026-04-27T00:00:00Z', 'a', 3000),
    ql('2026-04-28T00:00:00Z', 'a', 4000),
  ];
  const r = buildDailyTokenGeFourIndex(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenGeFourIndex: rejects bad knobs', () => {
  assert.throws(() =>
    buildDailyTokenGeFourIndex([], { generatedAt: GEN, minDays: 1 }),
  );
  assert.throws(() =>
    buildDailyTokenGeFourIndex([], { generatedAt: GEN, minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenGeFourIndex([], { generatedAt: GEN, top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenGeFourIndex([], {
      generatedAt: GEN,
      minGeFour: -0.1,
    }),
  );
  assert.throws(() =>
    buildDailyTokenGeFourIndex([], {
      generatedAt: GEN,
      sort: 'bogus' as never,
    }),
  );
  assert.throws(() =>
    buildDailyTokenGeFourIndex([], {
      generatedAt: GEN,
      since: 'not-iso',
    }),
  );
});

// ---- closed-form Pareto anchor + production-scale fp stability ----

test('geFourOfVector: Pareto(alpha=5) closed-form anchor (GE(4) = 131/1500)', () => {
  // For Pareto(alpha=5, x_min=1):
  //   E[D]   = 5/4,    E[D^4] = 5/(5-4) = 5
  //   c_4 = (5-1)^4 / (5^3 * (5-4)) = 256/125 = 2.048
  //   GE(4) = (256/125 - 1) / 12 = 131/1500 = 0.08733...
  let s = 13579;
  function rnd(): number {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    return (s + 1) / 0x80000000;
  }
  const N = 200000;
  const v: number[] = [];
  for (let i = 0; i < N; i++) {
    const u = rnd();
    v.push(Math.pow(1 - u, -1 / 5));
  }
  const r = geFourOfVector(v);
  const expected = 131 / 1500;
  // Heavy fourth-moment tail -> wide tolerance, but the anchor must
  // be in the right neighbourhood for any MC of this size.
  assert.ok(
    r.gefour > expected / 3 && r.gefour < expected * 4,
    `Pareto(alpha=5) GE(4) ~ ${expected.toFixed(4)} (=131/1500), got ${r.gefour.toFixed(4)}`,
  );
});

test('geFourOfVector: production-scale day totals do not overflow fp', () => {
  // Real production day totals are O(1e9). Raising raw counts to the
  // 4th power gives O(1e36), still in fp53 range but precision-degrading.
  // Share form (D/mu)^4 keeps values bounded. This test asserts no
  // Infinity or NaN on a 1e9-scale vector with a 10x spike day.
  const v: number[] = [];
  for (let i = 0; i < 30; i++) v.push(1e9 + i * 1e7);
  v.push(1e10);
  const r = geFourOfVector(v);
  assert.ok(Number.isFinite(r.gefour), `gefour non-finite: ${r.gefour}`);
  assert.ok(Number.isFinite(r.quarticShareMean));
  assert.ok(r.gefour > 0);
  assert.ok(
    r.quarticShareMean > 1 && r.quarticShareMean < 1000,
    `quarticShareMean out of range: ${r.quarticShareMean}`,
  );
});

test('geFourOfVector: error message names the function and the bad value', () => {
  try {
    geFourOfVector([1, 2, -5, 3]);
    assert.fail('should have thrown');
  } catch (e) {
    const msg = (e as Error).message;
    assert.ok(
      msg.includes('geFourOfVector') && msg.includes('-5'),
      `error message must name function and bad value, got: ${msg}`,
    );
  }
});

test('geFourOfVector: GE(4) >= GE(3) by closed form (Jensen on x^4 vs x^3 in shares)', () => {
  // For ALL positive vectors (not just right-skewed), the closed-form
  // residual GE(4) - GE(3) = (1/6)*s*CV^3 + (1/12)*k*CV^4 has a
  // kurtosis term that is always non-negative (k >= 1 by Jensen on
  // x^2), and a skewness term whose sign depends on s. So GE(4) is
  // not strictly >= GE(3) for all data, but on a large sample of
  // simulated mixtures the relationship usually holds. Test the
  // identity decomposition exactly instead.
  const cases = [
    [1, 2, 3, 4, 5],
    [10, 10, 10, 50],
    [1, 1, 1, 1, 1, 100],
    [5, 8, 13, 21, 34, 55, 89],
    [100, 200, 50, 75, 125, 175],
  ];
  for (const v of cases) {
    const r4 = geFourOfVector(v);
    const r3 = geThreeOfVector(v);
    const ge2 = ge2OfVector(v).ge2;
    const skewTerm3 = (r3.skewness * r3.cv * r3.cv * r3.cv) / 6;
    const skewTerm4 = (r4.skewness * r4.cv * r4.cv * r4.cv) / 3;
    const kurtTerm4 = (r4.kurtosis * r4.cv * r4.cv * r4.cv * r4.cv) / 12;
    // GE(3) closed form
    assert.ok(
      Math.abs(r3.gethree - (ge2 + skewTerm3)) < 1e-9,
      `GE(3) closed form on ${JSON.stringify(v)}`,
    );
    // GE(4) closed form
    assert.ok(
      Math.abs(r4.gefour - (ge2 + skewTerm4 + kurtTerm4)) < 1e-9,
      `GE(4) closed form on ${JSON.stringify(v)}`,
    );
  }
});
