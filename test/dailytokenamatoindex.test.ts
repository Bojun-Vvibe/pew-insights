import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenAmatoIndex,
  amatoOfVector,
  kakwaniArcLengthIndex,
  SQRT2,
} from '../src/dailytokenamatoindex.js';
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

// ---- amatoOfVector primitive --------------------------------------

test('amatoOfVector: empty -> degenerate, A=sqrt(2)', () => {
  const r = amatoOfVector([]);
  assert.equal(r.amato, SQRT2);
  assert.equal(r.degenerate, true);
});

test('amatoOfVector: n=1 -> degenerate, A=sqrt(2)', () => {
  const r = amatoOfVector([42]);
  assert.equal(r.amato, SQRT2);
  assert.equal(r.degenerate, true);
});

test('amatoOfVector: all-zero -> degenerate, A=sqrt(2)', () => {
  const r = amatoOfVector([0, 0, 0, 0]);
  assert.equal(r.amato, SQRT2);
  assert.equal(r.degenerate, true);
});

test('amatoOfVector: perfect equality -> A=sqrt(2)', () => {
  const r = amatoOfVector([10, 10, 10, 10, 10]);
  assert.ok(
    Math.abs(r.amato - SQRT2) < 1e-12,
    `expected A=sqrt(2), got ${r.amato}`,
  );
  assert.equal(r.degenerate, false);
});

test('amatoOfVector: scale-invariant', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = amatoOfVector(v).amato;
  const b = amatoOfVector(v.map((x) => x * 1000)).amato;
  assert.ok(Math.abs(a - b) < 1e-12, `scale-invariance broken: ${a} vs ${b}`);
});

test('amatoOfVector: permutation-invariant', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = amatoOfVector(v).amato;
  const b = amatoOfVector([11, 4, 9, 3, 7, 1]).amato;
  assert.ok(Math.abs(a - b) < 1e-15);
});

test('amatoOfVector: known closed-form on [1,3]', () => {
  // n=2, S=4, sorted=[1,3], shares=[0.25, 0.75]; dx=0.5
  // A = sqrt(0.25 + 0.0625) + sqrt(0.25 + 0.5625)
  //   = sqrt(0.3125) + sqrt(0.8125)
  const expected = Math.sqrt(0.3125) + Math.sqrt(0.8125);
  const r = amatoOfVector([1, 3]);
  assert.ok(
    Math.abs(r.amato - expected) < 1e-12,
    `closed-form mismatch: ${r.amato} vs ${expected}`,
  );
});

test('amatoOfVector: bounded in [sqrt(2), 2]', () => {
  for (const v of [
    [1, 1, 1, 1, 1],
    [1, 2, 3, 4, 5],
    [1, 1, 1, 100],
    [0.001, 1, 1, 1, 1, 1, 1, 1, 1, 1000],
  ]) {
    const a = amatoOfVector(v).amato;
    assert.ok(a >= SQRT2 - 1e-12 && a < 2 + 1e-12, `out of range: ${a}`);
  }
});

test('amatoOfVector: Pigou-Dalton spread strictly increases Amato', () => {
  const base = [10, 10, 10, 10];
  const spread = [1, 13, 13, 13]; // same total 40
  const a = amatoOfVector(base).amato;
  const b = amatoOfVector(spread).amato;
  assert.ok(b > a, `expected Amato to rise on spread: ${a} -> ${b}`);
});

test('amatoOfVector: monotone in concentrating mass on a single entry', () => {
  // Move share toward a single entry, holding total fixed.
  let prev = -Infinity;
  for (const top of [25, 40, 60, 80, 95, 99]) {
    const rest = (100 - top) / 4;
    const a = amatoOfVector([rest, rest, rest, rest, top]).amato;
    assert.ok(a >= prev, `non-monotone: ${prev} -> ${a} at top=${top}`);
    prev = a;
  }
});

test('amatoOfVector: throws on negative entry', () => {
  assert.throws(
    () => amatoOfVector([1, 2, -1, 4]),
    /non-negative/,
  );
});

test('amatoOfVector: throws on non-finite entry', () => {
  assert.throws(
    () => amatoOfVector([1, 2, Number.NaN, 4]),
    /non-negative/,
  );
});

test('amatoOfVector: handles zero entries (Lorenz starts flat)', () => {
  // zeros are valid in the Lorenz construction; A stays in [sqrt(2), 2]
  const r = amatoOfVector([0, 0, 0, 100]);
  assert.equal(r.degenerate, false);
  assert.ok(r.amato > SQRT2 && r.amato < 2);
});

// ---- kakwani -----------------------------------------------------

test('kakwaniArcLengthIndex: K(sqrt(2)) = 0', () => {
  assert.ok(Math.abs(kakwaniArcLengthIndex(SQRT2)) < 1e-15);
});

test('kakwaniArcLengthIndex: K(2) = 1', () => {
  assert.ok(Math.abs(kakwaniArcLengthIndex(2) - 1) < 1e-15);
});

test('kakwaniArcLengthIndex: monotone increasing', () => {
  const k1 = kakwaniArcLengthIndex(1.5);
  const k2 = kakwaniArcLengthIndex(1.7);
  assert.ok(k2 > k1);
});

// ---- builder integration -------------------------------------------

test('builder: empty queue -> empty report', () => {
  const r = buildDailyTokenAmatoIndex([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('builder: single source perfect equality -> A=sqrt(2)', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'a', 100),
    ql('2026-04-26T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
  ];
  const r = buildDailyTokenAmatoIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.ok(Math.abs(r.sources[0]!.amato - SQRT2) < 1e-12);
  assert.equal(r.sources[0]!.degenerate, false);
});

test('builder: minDays filter drops sparse sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'a', 100000),
    ql('2026-04-26T00:00:00.000Z', 'a', 100000),
  ];
  const r = buildDailyTokenAmatoIndex(queue, {
    generatedAt: GEN,
    minDays: 3,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinDays, 1);
});

test('builder: include-kakwani surfaces normalized index', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'a', 1000),
    ql('2026-04-26T00:00:00.000Z', 'a', 4000),
    ql('2026-04-27T00:00:00.000Z', 'a', 9000),
  ];
  const r = buildDailyTokenAmatoIndex(queue, {
    generatedAt: GEN,
    includeKakwani: true,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.ok(s.kakwani !== undefined);
  assert.ok(s.amatoExcessOverEquality !== undefined);
  // K = (A - sqrt(2)) / (2 - sqrt(2))
  const predicted = (s.amato - SQRT2) / (2 - SQRT2);
  assert.ok(Math.abs((s.kakwani as number) - predicted) < 1e-12);
  assert.ok(
    Math.abs(
      (s.amatoExcessOverEquality as number) - (s.amato - SQRT2),
    ) < 1e-12,
  );
});

test('builder: include-gini-anchor surfaces gini + ratio', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'a', 1000),
    ql('2026-04-26T00:00:00.000Z', 'a', 4000),
    ql('2026-04-27T00:00:00.000Z', 'a', 9000),
    ql('2026-04-28T00:00:00.000Z', 'a', 16000),
  ];
  const r = buildDailyTokenAmatoIndex(queue, {
    generatedAt: GEN,
    includeGiniAnchor: true,
  });
  const s = r.sources[0]!;
  assert.ok(s.gini !== undefined);
  assert.ok(s.amatoOverGini !== undefined);
  assert.ok(Number.isFinite(s.amatoOverGini as number));
  assert.ok(
    Math.abs((s.amatoOverGini as number) - s.amato / (s.gini as number)) < 1e-12,
  );
});

test('builder: rebalancing toward equality strictly reduces Amato', () => {
  // Move 100 tokens from the largest day to the smallest day, holding
  // the total fixed. Amato must strictly decrease (Pigou-Dalton).
  const sparseQ: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'a', 200),
    ql('2026-04-26T00:00:00.000Z', 'a', 1000),
    ql('2026-04-27T00:00:00.000Z', 'a', 1000),
    ql('2026-04-28T00:00:00.000Z', 'a', 1800),
  ];
  const balancedQ: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'a', 300),
    ql('2026-04-26T00:00:00.000Z', 'a', 1000),
    ql('2026-04-27T00:00:00.000Z', 'a', 1000),
    ql('2026-04-28T00:00:00.000Z', 'a', 1700),
  ];
  const a = buildDailyTokenAmatoIndex(sparseQ, {
    generatedAt: GEN,
    minTokens: 0,
  }).sources[0]!.amato;
  const b = buildDailyTokenAmatoIndex(balancedQ, {
    generatedAt: GEN,
    minTokens: 0,
  }).sources[0]!.amato;
  assert.ok(
    b < a,
    `Pigou-Dalton equalising transfer must reduce Amato: ${a} -> ${b}`,
  );
});

test('builder: window filter is honoured', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'a', 1000),
    ql('2026-04-26T00:00:00.000Z', 'a', 2000),
    ql('2026-04-27T00:00:00.000Z', 'a', 3000),
    ql('2026-04-28T00:00:00.000Z', 'a', 4000),
  ];
  const r = buildDailyTokenAmatoIndex(queue, {
    generatedAt: GEN,
    since: '2026-04-26T00:00:00.000Z',
    until: '2026-04-29T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.nDays, 3);
});

test('builder: scale-invariance at the report level', () => {
  const mk = (mult: number): QueueLine[] => [
    ql('2026-04-25T00:00:00.000Z', 'a', 1000 * mult),
    ql('2026-04-26T00:00:00.000Z', 'a', 4000 * mult),
    ql('2026-04-27T00:00:00.000Z', 'a', 9000 * mult),
    ql('2026-04-28T00:00:00.000Z', 'a', 16000 * mult),
  ];
  const a = buildDailyTokenAmatoIndex(mk(1), { generatedAt: GEN }).sources[0]!
    .amato;
  const b = buildDailyTokenAmatoIndex(mk(1000), { generatedAt: GEN })
    .sources[0]!.amato;
  assert.ok(Math.abs(a - b) < 1e-9, `scale-invariance: ${a} vs ${b}`);
});

test('builder: rejects invalid sort', () => {
  assert.throws(
    () =>
      buildDailyTokenAmatoIndex([], {
        generatedAt: GEN,
        // @ts-expect-error - intentional bad input
        sort: 'bogus',
      }),
    /sort must be one of/,
  );
});

test('builder: rejects minDays < 2', () => {
  assert.throws(
    () =>
      buildDailyTokenAmatoIndex([], {
        generatedAt: GEN,
        minDays: 1,
      }),
    /minDays/,
  );
});

test('builder: minAmato display filter drops below-floor rows', () => {
  // Equality source has amato = sqrt(2) ~= 1.4142.
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'eq', 100),
    ql('2026-04-26T00:00:00.000Z', 'eq', 100),
    ql('2026-04-27T00:00:00.000Z', 'eq', 100),
    ql('2026-04-25T00:00:00.000Z', 'sk', 1),
    ql('2026-04-26T00:00:00.000Z', 'sk', 1),
    ql('2026-04-27T00:00:00.000Z', 'sk', 1000),
  ];
  const r = buildDailyTokenAmatoIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minAmato: 1.6, // above sqrt(2) so equality source filtered
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'sk');
  assert.equal(r.droppedBelowMinAmato, 1);
});

// ---- property-based / randomized invariants -------------------------

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('property: A in [sqrt(2), 2] on random non-negative vectors', () => {
  const r = rng(42);
  for (let trial = 0; trial < 50; trial++) {
    const n = 3 + Math.floor(r() * 20);
    const v: number[] = [];
    for (let i = 0; i < n; i++) v.push(r() * 1000);
    const a = amatoOfVector(v).amato;
    assert.ok(
      a >= SQRT2 - 1e-12 && a < 2 + 1e-12,
      `out of bounds: A=${a} on ${JSON.stringify(v)}`,
    );
  }
});

test('property: A monotone under rank-preserving Pigou-Dalton spread', () => {
  const r = rng(7);
  for (let trial = 0; trial < 30; trial++) {
    const n = 4 + Math.floor(r() * 8);
    const base: number[] = [];
    for (let i = 0; i < n; i++) base.push(50 + r() * 50);
    base.sort((a, b) => a - b);
    if (base[0]! < 6) continue;
    const spread = base.slice();
    spread[0] = spread[0]! - 5;
    spread[n - 1] = spread[n - 1]! + 5;
    const a = amatoOfVector(base).amato;
    const b = amatoOfVector(spread).amato;
    assert.ok(b >= a - 1e-12, `Pigou-Dalton violation: ${a} -> ${b}`);
  }
});

test('property: Amato is NOT a monotone function of Gini (orthogonality witness)', () => {
  // Construct two distributions where the ordering by Gini is opposite
  // to the ordering by Amato. The arc-length is more sensitive to a
  // single steep top-end segment than to many small middle dispersions,
  // while Gini integrates the area uniformly. Many concentration
  // patterns exhibit this decoupling; here is one explicit pair.
  // We just need Gini(A) > Gini(B) but Amato(A) < Amato(B), or vice
  // versa, to refute monotone equivalence.
  // Use vectors of equal length n=6 and equal total to control for
  // scale. After 50 random search trials we accept any witness pair.
  function gini(v: number[]): number {
    const n = v.length;
    const s = v.slice().sort((a, b) => a - b);
    const total = s.reduce((acc, x) => acc + x, 0);
    if (total <= 0) return 0;
    let w = 0;
    for (let i = 0; i < n; i++) w += (i + 1) * (s[i] as number);
    return (2 * w - (n + 1) * total) / (n * total);
  }
  const r = rng(2026);
  let found = false;
  for (let trial = 0; trial < 500 && !found; trial++) {
    const a: number[] = [];
    const b: number[] = [];
    for (let i = 0; i < 6; i++) a.push(1 + r() * 100);
    for (let i = 0; i < 6; i++) b.push(1 + r() * 100);
    const ga = gini(a);
    const gb = gini(b);
    const aa = amatoOfVector(a).amato;
    const ab = amatoOfVector(b).amato;
    if ((ga > gb && aa < ab) || (ga < gb && aa > ab)) {
      found = true;
    }
  }
  assert.ok(
    found,
    'expected a witness pair where Gini and Amato disagree on ordering',
  );
});

// ---- additional invariants and defensive guards --------------------

test('invariant: A(L) >= sqrt(2) by the chord lower bound (triangle inequality)', () => {
  // The Lorenz curve goes from (0,0) to (1,1); the straight-line chord
  // between those points has length sqrt(2). Any path connecting the
  // two endpoints has length >= sqrt(2) by the triangle inequality.
  // Verify on a wide range of randomly generated non-negative vectors.
  const r = rng(311);
  for (let trial = 0; trial < 100; trial++) {
    const n = 2 + Math.floor(r() * 30);
    const v: number[] = [];
    for (let i = 0; i < n; i++) v.push(r() < 0.1 ? 0 : r() * 1000);
    const a = amatoOfVector(v).amato;
    assert.ok(
      a >= SQRT2 - 1e-12,
      `chord lower bound violated: A=${a} < sqrt(2) on ${JSON.stringify(v)}`,
    );
  }
});

test('invariant: A(L) <= 2 by the L-shape upper envelope', () => {
  // The Lorenz curve sits inside the unit square below the diagonal.
  // Its arc length is bounded above by the perimeter of the right-
  // angled L-path through (1, 0) -- length 2 -- attained only in the
  // limit of a single entry holding all mass. Verify on random
  // vectors plus an explicit near-degenerate case.
  const r = rng(7331);
  for (let trial = 0; trial < 100; trial++) {
    const n = 2 + Math.floor(r() * 30);
    const v: number[] = [];
    for (let i = 0; i < n; i++) v.push(r() * 1000);
    const a = amatoOfVector(v).amato;
    assert.ok(
      a <= 2 + 1e-12,
      `L-shape upper bound violated: A=${a} > 2 on ${JSON.stringify(v)}`,
    );
  }
  // explicit near-degenerate test
  const huge: number[] = new Array(100).fill(1);
  huge[99] = 1e9;
  const aHuge = amatoOfVector(huge).amato;
  assert.ok(aHuge < 2, `near-degenerate A=${aHuge} >= 2`);
  assert.ok(aHuge > 1.99, `near-degenerate A=${aHuge} should approach 2`);
});

test('cross-anchor invariant: Kakwani K(A) of equality-vector is exactly 0', () => {
  // Cross-anchor identity: building the report with --include-kakwani
  // on a perfectly equal source must produce kakwani = 0 to machine
  // precision (the identity K(sqrt(2)) = 0 exposed at the report level).
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'eq', 100),
    ql('2026-04-26T00:00:00.000Z', 'eq', 100),
    ql('2026-04-27T00:00:00.000Z', 'eq', 100),
    ql('2026-04-28T00:00:00.000Z', 'eq', 100),
  ];
  const r = buildDailyTokenAmatoIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    includeKakwani: true,
  });
  const s = r.sources[0]!;
  assert.ok(
    Math.abs(s.kakwani as number) < 1e-12,
    `cross-anchor identity K(equality)=0 violated: ${s.kakwani}`,
  );
  assert.ok(
    Math.abs(s.amatoExcessOverEquality as number) < 1e-12,
    `cross-anchor identity (A-sqrt(2))=0 violated: ${s.amatoExcessOverEquality}`,
  );
});

test('cross-anchor invariant: amato/gini ratio diverges as we approach equality (Pigou-Dalton sequence)', () => {
  // Construct a CONTROLLED Pigou-Dalton sequence: start from a skewed
  // vector and repeatedly transfer mass from the largest entry to the
  // smallest holding total fixed. Both Amato and Gini must strictly
  // decrease (Pigou-Dalton); but Amato is bounded below by sqrt(2)
  // while Gini is bounded below by 0, so the ratio Amato/Gini must
  // diverge to +inf along the sequence. Verify monotone increase.
  function step(v: number[]): number[] {
    // pure equalising transfer from the max to the min
    const w = v.slice();
    let iMin = 0, iMax = 0;
    for (let i = 1; i < w.length; i++) {
      if ((w[i] as number) < (w[iMin] as number)) iMin = i;
      if ((w[i] as number) > (w[iMax] as number)) iMax = i;
    }
    if (iMin === iMax) return w;
    const delta = ((w[iMax] as number) - (w[iMin] as number)) / 4;
    w[iMin] = (w[iMin] as number) + delta;
    w[iMax] = (w[iMax] as number) - delta;
    return w;
  }
  let v = [1, 5, 25, 125, 625];
  let prev = -Infinity;
  for (let k = 0; k < 8; k++) {
    const r = buildDailyTokenAmatoIndex(
      v.map((tt, i) => ql(`2026-04-${20 + i}T00:00:00.000Z`, 'a', tt)),
      { generatedAt: GEN, minTokens: 0, includeGiniAnchor: true },
    );
    const s = r.sources[0]!;
    const ratio = s.amatoOverGini as number;
    assert.ok(
      ratio > prev,
      `amato/gini not strictly increasing along Pigou-Dalton sequence: ${prev} -> ${ratio} on ${JSON.stringify(v)}`,
    );
    prev = ratio;
    v = step(v);
  }
});

test('defensive guard: amatoOverGini is NaN when gini = 0 (perfect equality)', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 'eq', 100),
    ql('2026-04-26T00:00:00.000Z', 'eq', 100),
    ql('2026-04-27T00:00:00.000Z', 'eq', 100),
  ];
  const r = buildDailyTokenAmatoIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    includeGiniAnchor: true,
  });
  const s = r.sources[0]!;
  assert.equal(s.gini, 0);
  assert.ok(
    Number.isNaN(s.amatoOverGini as number),
    `expected NaN ratio when gini=0, got ${s.amatoOverGini}`,
  );
});

