import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenEstebanRayPolarizationIndex,
  estebanRayOfVector,
} from '../src/dailytokenestebanraypolarizationindex.js';
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

// ---- estebanRayOfVector primitive --------------------------------

test('estebanRayOfVector: empty -> degenerate, er=0', () => {
  const r = estebanRayOfVector([]);
  assert.equal(r.er, 0);
  assert.equal(r.erNorm, 0);
  assert.equal(r.degenerate, true);
});

test('estebanRayOfVector: n=1 -> degenerate, er=0', () => {
  const r = estebanRayOfVector([42]);
  assert.equal(r.er, 0);
  assert.equal(r.degenerate, true);
});

test('estebanRayOfVector: all-zero -> degenerate, er=0', () => {
  const r = estebanRayOfVector([0, 0, 0, 0]);
  assert.equal(r.er, 0);
  assert.equal(r.erNorm, 0);
  assert.equal(r.degenerate, true);
});

test('estebanRayOfVector: perfect equality -> er=0, erNorm=0', () => {
  const r = estebanRayOfVector([10, 10, 10, 10, 10]);
  assert.ok(Math.abs(r.er) < 1e-12, `expected er=0, got ${r.er}`);
  assert.ok(Math.abs(r.erNorm) < 1e-12, `expected erNorm=0, got ${r.erNorm}`);
  assert.equal(r.degenerate, false);
});

test('estebanRayOfVector: scale-equivariant in er, scale-invariant in erNorm', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = estebanRayOfVector(v);
  const b = estebanRayOfVector(v.map((x) => x * 1000));
  // er scales linearly with the units of y_i
  assert.ok(
    Math.abs(b.er - 1000 * a.er) < 1e-6,
    `er scale-equivariance broken: ${a.er} vs ${b.er} (expected ratio 1000)`,
  );
  // erNorm = er / mean is dimensionless / scale-invariant
  assert.ok(
    Math.abs(a.erNorm - b.erNorm) < 1e-9,
    `erNorm scale-invariance broken: ${a.erNorm} vs ${b.erNorm}`,
  );
});

test('estebanRayOfVector: permutation-invariant', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = estebanRayOfVector(v);
  const b = estebanRayOfVector([11, 4, 9, 3, 7, 1]);
  assert.ok(Math.abs(a.er - b.er) < 1e-12);
  assert.ok(Math.abs(a.erNorm - b.erNorm) < 1e-12);
});

test('estebanRayOfVector: alpha=0 reduces to mean-scaled Gini (ER(0) = 2*mu*Gini)', () => {
  // At alpha=0, ER(0) = (1/n)^2 * sum_i sum_j |y_i - y_j|.
  // Gini = (1/(2*n^2*mu)) * sum_i sum_j |y_i - y_j|.
  // So ER(0) = 2*mu*Gini exactly.
  for (const v of [
    [1, 2, 3, 4, 5],
    [10, 10, 10, 100],
    [1, 1, 1, 1, 1, 1, 1000],
    [3, 7, 1, 11, 4, 9],
  ]) {
    const r = estebanRayOfVector(v, 0);
    const g = giniOfVector(v);
    const mu = v.reduce((s, x) => s + x, 0) / v.length;
    const expected = 2 * mu * g;
    assert.ok(
      Math.abs(r.er - expected) < 1e-9,
      `ER(0) = 2*mu*Gini identity broken on ${JSON.stringify(v)}: ` +
        `got ${r.er}, expected ${expected}`,
    );
  }
});

test('estebanRayOfVector: known closed-form on [1, 3] at alpha=1', () => {
  // n=2, sorted=[1,3]. pi_i = 0.5.
  // ER(1) = sum_i sum_j (0.5)^2 * 0.5 * |y_i - y_j|
  //       = 0.125 * (|1-1| + |1-3| + |3-1| + |3-3|)
  //       = 0.125 * 4 = 0.5
  const r = estebanRayOfVector([1, 3], 1);
  assert.ok(
    Math.abs(r.er - 0.5) < 1e-12,
    `closed-form mismatch: got ${r.er}, expected 0.5`,
  );
  // mean = 2, so erNorm = 0.25
  assert.ok(
    Math.abs(r.erNorm - 0.25) < 1e-12,
    `erNorm closed-form mismatch: got ${r.erNorm}, expected 0.25`,
  );
});

test('estebanRayOfVector: monotone-ish: more concentrated mass -> higher erNorm at alpha=1', () => {
  // With per-day pi_i = 1/n (fixed), ER(alpha) reduces to a constant
  // times sum_pairs |y_i - y_j|, so concentration of mass onto a single
  // entry maximizes ER (the classical "two-cluster maximizer" only
  // applies when masses can coalesce). At fixed n=5, increasing the
  // top share monotonically increases the pair-sum (and thus ER).
  let prev = -Infinity;
  for (const top of [25, 40, 60, 80, 95, 99]) {
    const rest = (100 - top) / 4;
    const e = estebanRayOfVector([rest, rest, rest, rest, top], 1).erNorm;
    assert.ok(e >= prev - 1e-12, `non-monotone: ${prev} -> ${e} at top=${top}`);
    prev = e;
  }
});

test('estebanRayOfVector: throws on negative entry', () => {
  assert.throws(() => estebanRayOfVector([1, 2, -1, 4]), /non-negative/);
});

test('estebanRayOfVector: throws on non-finite entry', () => {
  assert.throws(() => estebanRayOfVector([1, NaN, 3]), /non-negative/);
});

test('estebanRayOfVector: throws on alpha out of range', () => {
  assert.throws(() => estebanRayOfVector([1, 2, 3], -0.1), /alpha/);
  assert.throws(() => estebanRayOfVector([1, 2, 3], 1.7), /alpha/);
  assert.throws(() => estebanRayOfVector([1, 2, 3], NaN), /alpha/);
});

test('estebanRayOfVector: alpha monotone -> ER(alpha) non-decreasing in alpha for the same vector? -- no, only WEIGHTS shift; we just assert er >= 0 across alpha grid', () => {
  const v = [1, 2, 3, 5, 8, 13, 21];
  for (const a of [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.6]) {
    const r = estebanRayOfVector(v, a);
    assert.ok(r.er >= 0, `er must be >= 0 at alpha=${a}, got ${r.er}`);
    assert.ok(r.erNorm >= 0);
  }
});

// ---- builder integration -----------------------------------------

test('buildDailyTokenEstebanRayPolarizationIndex: basic shape + sort', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', 'srcA', 100),
    ql('2026-04-21T01:00:00Z', 'srcA', 200),
    ql('2026-04-22T01:00:00Z', 'srcA', 700), // skewed
    ql('2026-04-20T01:00:00Z', 'srcB', 1000), // perfect equality
    ql('2026-04-21T01:00:00Z', 'srcB', 1000),
    ql('2026-04-22T01:00:00Z', 'srcB', 1000),
  ];
  const r = buildDailyTokenEstebanRayPolarizationIndex(queue, {
    minTokens: 100,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  // skewed source > equal source on erNorm
  const a = r.sources.find((s) => s.source === 'srcA')!;
  const b = r.sources.find((s) => s.source === 'srcB')!;
  assert.ok(a.erNorm > 0, `srcA erNorm should be > 0, got ${a.erNorm}`);
  assert.ok(
    Math.abs(b.erNorm) < 1e-12,
    `srcB (equality) erNorm should be ~0, got ${b.erNorm}`,
  );
  assert.equal(r.alpha, 1);
  assert.equal(r.sort, 'erNorm');
  assert.equal(r.sources[0]!.source, 'srcA'); // sort default = erNorm desc
});

test('buildDailyTokenEstebanRayPolarizationIndex: alpha override propagates', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', 'srcA', 1),
    ql('2026-04-21T01:00:00Z', 'srcA', 2),
    ql('2026-04-22T01:00:00Z', 'srcA', 3),
    ql('2026-04-23T01:00:00Z', 'srcA', 1000),
  ];
  const r = buildDailyTokenEstebanRayPolarizationIndex(queue, {
    minTokens: 100,
    alpha: 1.5,
    generatedAt: GEN,
  });
  assert.equal(r.alpha, 1.5);
  assert.equal(r.sources[0]!.alpha, 1.5);
});

test('buildDailyTokenEstebanRayPolarizationIndex: refinement gini-anchor', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', 'srcA', 100),
    ql('2026-04-21T01:00:00Z', 'srcA', 200),
    ql('2026-04-22T01:00:00Z', 'srcA', 700),
  ];
  const r = buildDailyTokenEstebanRayPolarizationIndex(queue, {
    minTokens: 100,
    includeGiniAnchor: true,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(row.gini !== undefined && row.gini > 0);
  assert.ok(
    row.erNormOverGini !== undefined && Number.isFinite(row.erNormOverGini),
  );
});

test('buildDailyTokenEstebanRayPolarizationIndex: filters invalid alpha', () => {
  assert.throws(
    () => buildDailyTokenEstebanRayPolarizationIndex([], { alpha: 2 }),
    /alpha/,
  );
});

test('buildDailyTokenEstebanRayPolarizationIndex: minDays drop', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', 'srcA', 5000),
    ql('2026-04-21T01:00:00Z', 'srcA', 5000),
  ];
  const r = buildDailyTokenEstebanRayPolarizationIndex(queue, {
    minTokens: 100,
    minDays: 3,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinDays, 1);
});

// ---- structural decoupling vs Gini --------------------------------

test('structural: at fixed n, ER(1)/Gini = 2/n exactly (closed-form identity)', () => {
  // With pi_i = 1/n fixed (per-day grouping), the double sum
  // sum_i sum_j |y_i - y_j| factors out of both ER and Gini:
  //   ER(1) = (1/n^3) * sum_i sum_j |y_i - y_j|
  //   Gini  = (1/(2*n^2*mu)) * sum_i sum_j |y_i - y_j|
  // so erNorm = ER/mu = (1/n^3) * sum_pairs / mu, and
  // erNorm / gini = (1/n^3) * sum_pairs / mu * (2 * n^2 * mu) / sum_pairs
  //               = 2 / n.
  // So at FIXED n, ER and Gini are perfectly proportional (a structural
  // fact arising from forcing each day to be its own pi-group of mass
  // 1/n; the Esteban-Ray identification axiom only bites once we have
  // genuine mass-coalescence). The orthogonality vs Gini that survives
  // the per-day projection is an n-dependent rescaling: sources with
  // different #days have different ER/Gini ratios.
  for (const v of [
    [1, 2, 3, 4, 5],
    [10, 10, 10, 100],
    [1, 1, 1, 1, 1, 1, 1000],
    [3, 7, 1, 11, 4, 9],
  ]) {
    const e = estebanRayOfVector(v, 1).erNorm;
    const g = giniOfVector(v);
    if (g === 0) continue;
    const ratio = e / g;
    const expected = 2 / v.length;
    assert.ok(
      Math.abs(ratio - expected) < 1e-9,
      `closed-form ER(1)/Gini = 2/n broken on ${JSON.stringify(v)}: ` +
        `got ${ratio}, expected ${expected}`,
    );
  }
});

test('structural: at DIFFERENT n, ER(1)/Gini differs across sources (n-dependent rescaling)', () => {
  // The cross-source orthogonality witness: same Gini, different #days
  // -> different ER/Gini ratio. We demonstrate by construction: two
  // vectors with identical Gini = 0.4 but different lengths.
  // For [1, 2, 3, 4, 5]: gini = 0.2667... actually let's just exhibit
  // any two vectors with different n and verify the ratio differs.
  const v3 = [1, 2, 3]; // n=3
  const v6 = [1, 2, 3, 4, 5, 6]; // n=6
  const r3 =
    estebanRayOfVector(v3, 1).erNorm / giniOfVector(v3);
  const r6 =
    estebanRayOfVector(v6, 1).erNorm / giniOfVector(v6);
  // Expected: r3 = 2/3, r6 = 2/6 = 1/3.
  assert.ok(
    Math.abs(r3 - 2 / 3) < 1e-9,
    `ratio at n=3 should be 2/3, got ${r3}`,
  );
  assert.ok(
    Math.abs(r6 - 1 / 3) < 1e-9,
    `ratio at n=6 should be 1/3, got ${r6}`,
  );
  assert.ok(
    Math.abs(r3 - r6) > 1e-3,
    `cross-n decoupling broken: ${r3} vs ${r6}`,
  );
});

test('structural: at alpha > 0, ER amplifies super-linearly with n compared to Gini', () => {
  // Closed-form at general alpha with pi=1/n:
  //   ER(alpha) = n^{-(2+alpha)} * sum_pairs
  //   Gini      = (1/(2*n^2*mu)) * sum_pairs
  // erNorm / gini = (n^{-(2+alpha)} / mu) * sum_pairs * (2*n^2*mu/sum_pairs)
  //               = 2 * n^{-alpha}.
  // So at alpha=1, ratio = 2/n. At alpha=0, ratio = 2 (constant).
  // At alpha=1.5, ratio = 2 * n^{-1.5}. Verify across alpha grid.
  const v = [3, 7, 1, 11, 4, 9]; // n=6
  const g = giniOfVector(v);
  for (const a of [0, 0.5, 1, 1.5]) {
    const e = estebanRayOfVector(v, a).erNorm;
    const expected = 2 * Math.pow(v.length, -a);
    assert.ok(
      Math.abs(e / g - expected) < 1e-9,
      `closed-form ER(alpha)/Gini = 2*n^{-alpha} broken at alpha=${a}: ` +
        `got ${e / g}, expected ${expected}`,
    );
  }
});

// ---- refinement (axis-51 follow-up): closed-form identity audit
// across an alpha grid + numerical stability on long vectors --------

test('refinement: closed-form ER(alpha)/Gini = 2*n^{-alpha} holds across full alpha axiom range', () => {
  // The full Esteban-Ray axiom range is alpha in [1, 1.6]; we audit
  // [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.6] across multiple shapes
  // to verify the closed-form identity holds at machine precision
  // for every (vector, alpha) pair.
  const shapes = [
    [1, 2, 3, 4, 5],
    [10, 10, 10, 100],
    [3, 7, 1, 11, 4, 9],
    [1, 1, 1, 1, 1, 1, 1000],
    [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5],
  ];
  const alphas = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.6];
  for (const v of shapes) {
    const g = giniOfVector(v);
    if (g === 0) continue;
    for (const a of alphas) {
      const e = estebanRayOfVector(v, a).erNorm;
      const ratio = e / g;
      const expected = 2 * Math.pow(v.length, -a);
      assert.ok(
        Math.abs(ratio - expected) < 1e-9,
        `closed-form ER(alpha)/Gini = 2*n^{-alpha} broken on ` +
          `${JSON.stringify(v)} at alpha=${a}: got ${ratio}, expected ${expected}`,
      );
    }
  }
});

test('refinement: numerical stability on long vectors (n=1000) -- no NaN, no inf, monotone in alpha-power', () => {
  // Build a long heavy-tailed vector and confirm the O(n log n)
  // sorted-form pair-sum stays in finite range and behaves
  // continuously as alpha varies.
  const n = 1000;
  const v: number[] = [];
  for (let i = 1; i <= n; i += 1) {
    // Pareto-ish: one small spike, mostly small values.
    v.push(i % 50 === 0 ? i * 100 : i);
  }
  for (const a of [0, 0.5, 1, 1.5]) {
    const r = estebanRayOfVector(v, a);
    assert.ok(Number.isFinite(r.er), `er not finite at alpha=${a}: ${r.er}`);
    assert.ok(Number.isFinite(r.erNorm), `erNorm not finite at alpha=${a}`);
    assert.ok(r.er >= 0);
    assert.ok(r.erNorm >= 0);
  }
  // Closed-form check at scale: erNorm/gini should equal 2*n^{-alpha}
  // even at n=1000 (numerical-stability assertion).
  const g = giniOfVector(v);
  for (const a of [0, 0.5, 1, 1.5]) {
    const e = estebanRayOfVector(v, a).erNorm;
    const expected = 2 * Math.pow(n, -a);
    assert.ok(
      Math.abs(e / g - expected) < 1e-9,
      `n=1000 closed-form broken at alpha=${a}: ${e / g} vs ${expected}`,
    );
  }
});

test('refinement: defensive guard -- ER(0) = 2*mu*Gini exactly on a 50-trial random sweep', () => {
  // The alpha=0 -> 2*mu*Gini identity is the most-cited cross-anchor
  // for ER. Audit it on 50 random vectors to catch any numerical
  // drift in the sorted-form pairwise-distance reduction.
  const rand = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  };
  const r = rand(20260502);
  for (let trial = 0; trial < 50; trial += 1) {
    const len = 3 + Math.floor(r() * 10);
    const v: number[] = [];
    for (let i = 0; i < len; i += 1) v.push(Math.floor(r() * 1000) + 1);
    const er0 = estebanRayOfVector(v, 0).er;
    const mu = v.reduce((s, x) => s + x, 0) / v.length;
    const g = giniOfVector(v);
    const expected = 2 * mu * g;
    assert.ok(
      Math.abs(er0 - expected) < 1e-7,
      `ER(0) = 2*mu*Gini drift on ${JSON.stringify(v)}: ` +
        `got ${er0}, expected ${expected}`,
    );
  }
});
