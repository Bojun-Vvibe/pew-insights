import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenGeHalfIndex,
  geHalfOfVector,
  GE_HALF_ATK_HALF_RATIO_LIMITS,
} from '../src/dailytokengehalfindex.js';
import { ge2OfVector } from '../src/dailytokenge2index.js';
import { varianceOfLogarithmsOfVector } from '../src/dailytokenvarianceoflogarithms.js';
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

// ---- geHalfOfVector primitive ---------------------------------------

test('geHalfOfVector: empty -> degenerate', () => {
  const r = geHalfOfVector([]);
  assert.equal(r.gehalf, 0);
  assert.equal(r.degenerate, true);
});

test('geHalfOfVector: n=1 -> degenerate, gehalf=0', () => {
  const r = geHalfOfVector([42]);
  assert.equal(r.gehalf, 0);
  assert.equal(r.degenerate, true);
  assert.equal(r.mean, 42);
  assert.equal(r.sqrtMean, 42);
});

test('geHalfOfVector: perfect equality -> 0', () => {
  const r = geHalfOfVector([7, 7, 7, 7, 7, 7]);
  assert.equal(r.gehalf, 0);
  assert.equal(r.degenerate, true);
  assert.ok(Math.abs(r.mean - 7) < 1e-12);
  assert.ok(Math.abs(r.sqrtMean - 7) < 1e-12);
});

test('geHalfOfVector: scale-invariant (multiply by k)', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = geHalfOfVector(v);
  const b = geHalfOfVector(v.map((x) => x * 1e6));
  assert.ok(Math.abs(a.gehalf - b.gehalf) < 1e-10, `${a.gehalf} vs ${b.gehalf}`);
});

test('geHalfOfVector: permutation-invariant', () => {
  const a = geHalfOfVector([1, 3, 7, 9, 4, 11]);
  const b = geHalfOfVector([11, 4, 9, 3, 7, 1]);
  assert.ok(Math.abs(a.gehalf - b.gehalf) < 1e-12);
});

test('geHalfOfVector: known closed form on [1, 4]', () => {
  // n=2, mean=2.5, meanSqrt=(1+2)/2=1.5
  // GE(1/2) = 4*(1 - meanSqrt/sqrt(mean)) = 4*(1 - 1.5/sqrt(2.5))
  //        = 4*(1 - 0.94868329805...) = 0.20526681...
  const r = geHalfOfVector([1, 4]);
  const expected = 4 * (1 - 1.5 / Math.sqrt(2.5));
  assert.ok(
    Math.abs(r.gehalf - expected) < 1e-12,
    `got ${r.gehalf}, expected ${expected}`,
  );
  assert.ok(Math.abs(r.mean - 2.5) < 1e-12);
  assert.ok(Math.abs(r.sqrtMean - 2.25) < 1e-12); // M_{1/2} = meanSqrt^2
});

test('geHalfOfVector: known closed form on [1, 2, 4, 8]', () => {
  // sqrt -> 1, sqrt2, 2, 2sqrt2; meanSqrt = (3 + 3sqrt2)/4
  const meanSqrt = (3 + 3 * Math.SQRT2) / 4;
  const mu = 15 / 4;
  const expected = 4 * (1 - meanSqrt / Math.sqrt(mu));
  const r = geHalfOfVector([1, 2, 4, 8]);
  assert.ok(
    Math.abs(r.gehalf - expected) < 1e-12,
    `got ${r.gehalf}, expected ${expected}`,
  );
});

test('geHalfOfVector: bridge identity GE(1/2) = 4*(1 - sqrt(1 - Atk(1/2)))', () => {
  const v = [1, 3, 5, 17, 23, 41, 100, 7];
  const r = geHalfOfVector(v);
  const atkHalf = 1 - r.sqrtMean / r.mean;
  const fromAtk = 4 * (1 - Math.sqrt(1 - atkHalf));
  assert.ok(
    Math.abs(r.gehalf - fromAtk) < 1e-12,
    `gehalf ${r.gehalf} vs 4(1-sqrt(1-atk)) ${fromAtk}`,
  );
  // Inverse: atk = 1 - (1 - gehalf/4)^2.
  const fromGe = 1 - (1 - r.gehalf / 4) ** 2;
  assert.ok(Math.abs(atkHalf - fromGe) < 1e-12);
  // Ratio in [2, 4).
  const ratio = r.gehalf / atkHalf;
  assert.ok(ratio >= 2 - 1e-9 && ratio < 4, `ratio out of bounds: ${ratio}`);
});

test('geHalfOfVector: throws on zero, negative, NaN', () => {
  assert.throws(() => geHalfOfVector([1, 0, 4]));
  assert.throws(() => geHalfOfVector([1, -3, 4]));
  assert.throws(() => geHalfOfVector([1, Number.NaN, 4]));
});

test('geHalfOfVector: lognormal approaches 4*(1-exp(-sigma^2/8)) MC', () => {
  let s = 12345;
  function rnd(): number {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    return (s + 1) / 0x80000000;
  }
  function rnorm(): number {
    const u1 = rnd();
    const u2 = rnd();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  const sigma = 0.7;
  const N = 50000;
  const v: number[] = [];
  for (let i = 0; i < N; i++) v.push(Math.exp(5 + sigma * rnorm()));
  const r = geHalfOfVector(v);
  const expected = 4 * (1 - Math.exp(-(sigma * sigma) / 8));
  assert.ok(
    Math.abs(r.gehalf - expected) < 0.01,
    `lognormal GE(1/2) ~ ${expected.toFixed(4)}, got ${r.gehalf.toFixed(4)}`,
  );
});

test('geHalfOfVector vs GE(2): rank flip on differently-tailed vectors', () => {
  // Vector A: heavy upper tail (one big spike)
  // Vector B: moderate spread, no spike
  // GE(2) emphasises squared deviations -> A scores higher.
  // GE(1/2) compresses big values via sqrt -> B can score relatively
  // higher than under GE(2). Both are non-zero on both, ranks may
  // flip.
  const A = [1, 1, 1, 1, 1, 1, 1, 1, 1, 100];
  const B = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const aHalf = geHalfOfVector(A).gehalf;
  const bHalf = geHalfOfVector(B).gehalf;
  const a2 = ge2OfVector(A).ge2;
  const b2 = ge2OfVector(B).ge2;
  // A is more inequality on GE(2):
  assert.ok(a2 > b2, `expected GE(2)(A=${a2}) > GE(2)(B=${b2})`);
  // GE(1/2) compresses tail: numerically A still > B but ratio
  // shrinks; we use this to confirm sqrt-share kernel really weights
  // the tail less than squared kernel.
  assert.ok(
    a2 / b2 > aHalf / bHalf,
    `GE(2) tail-emphasis ratio (${(a2 / b2).toFixed(3)}) should exceed GE(1/2) ratio (${(aHalf / bHalf).toFixed(3)}) on heavy-tail A vs uniform B`,
  );
});

test('geHalfOfVector: orthogonal to VL on at least one vector (different ranks possible)', () => {
  // Two vectors with same VL but different GE(1/2), and vice versa,
  // are hard to construct exactly; we settle for a divergence witness:
  // VL is log-deviation (zero on geometric-mean-balanced data),
  // GE(1/2) is sqrt-share deviation (zero only on equal data). So a
  // vector with high VL but rescaled to lower GE(1/2) demonstrates
  // they aren't co-monotone.
  const v1 = [1, 1, 1, 100, 100, 100]; // bimodal heavy
  const v2 = [1, 4, 9, 16, 25, 36]; // square sequence
  const g1 = geHalfOfVector(v1).gehalf;
  const g2 = geHalfOfVector(v2).gehalf;
  const vl1 = varianceOfLogarithmsOfVector(v1).vl;
  const vl2 = varianceOfLogarithmsOfVector(v2).vl;
  // Confirm both GE(1/2) and VL produce different orderings on at
  // least one of the cross-pair comparisons OR the magnitudes diverge
  // by more than 5x ratio between vectors -- proving non-degeneracy.
  const rGE = g1 / g2;
  const rVL = vl1 / vl2;
  assert.ok(
    Math.abs(rGE - rVL) > 0.05,
    `expected GE-half/VL ratios to diverge: rGE=${rGE.toFixed(3)} rVL=${rVL.toFixed(3)}`,
  );
});

// ---- builder behaviour ----------------------------------------------

test('buildDailyTokenGeHalfIndex: empty queue -> zero rows, zero counters', () => {
  const r = buildDailyTokenGeHalfIndex([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.droppedInvalidHourStart, 0);
  assert.equal(r.droppedNonPositiveTokens, 0);
  assert.equal(r.droppedSourceFilter, 0);
  assert.equal(r.droppedSparseSources, 0);
  assert.equal(r.droppedBelowMinDays, 0);
  assert.equal(r.droppedBelowMinGeHalf, 0);
  assert.equal(r.droppedTopSources, 0);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.minDays, 4);
  assert.equal(r.sort, 'gehalf');
});

test('buildDailyTokenGeHalfIndex: one source with mixed days computes positive GE(1/2)', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 100),
    ql('2026-04-26T00:00:00Z', 'a', 400),
    ql('2026-04-27T00:00:00Z', 'a', 900),
    ql('2026-04-28T00:00:00Z', 'a', 1600),
  ];
  const r = buildDailyTokenGeHalfIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'a');
  assert.equal(row.nDays, 4);
  assert.ok(row.gehalf > 0);
  assert.equal(row.degenerate, false);
  assert.equal(row.minDay, '2026-04-25');
  assert.equal(row.maxDay, '2026-04-28');
});

test('buildDailyTokenGeHalfIndex: equal days -> degenerate', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 100),
    ql('2026-04-26T00:00:00Z', 'a', 100),
    ql('2026-04-27T00:00:00Z', 'a', 100),
    ql('2026-04-28T00:00:00Z', 'a', 100),
  ];
  const r = buildDailyTokenGeHalfIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.degenerate, true);
  assert.equal(r.sources[0]!.gehalf, 0);
});

test('buildDailyTokenGeHalfIndex: --include-atk-anchor surfaces atkHalf and bridge residual', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 1),
    ql('2026-04-26T00:00:00Z', 'a', 4),
    ql('2026-04-27T00:00:00Z', 'a', 9),
    ql('2026-04-28T00:00:00Z', 'a', 16),
  ];
  const r = buildDailyTokenGeHalfIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    includeAtkAnchor: true,
  });
  const row = r.sources[0]!;
  assert.ok(row.atkHalf !== undefined);
  assert.ok(row.geHalfOverAtkHalf !== undefined);
  // Bridge residual must be ~0 by construction.
  assert.ok(
    Math.abs(row.geHalfBridgeResidual ?? 0) < 1e-12,
    `bridge residual non-zero: ${row.geHalfBridgeResidual}`,
  );
  // Ratio in [2, 4).
  const ratio = row.geHalfOverAtkHalf as number;
  assert.ok(ratio >= 2 - 1e-9 && ratio < 4, `ratio out of bounds: ${ratio}`);
  // Inverse identity Atk = 1 - (1 - GE/4)^2.
  const fromGe = 1 - (1 - row.gehalf / 4) ** 2;
  assert.ok(Math.abs((row.atkHalf as number) - fromGe) < 1e-12);
});

test('buildDailyTokenGeHalfIndex: filters minTokens / minDays / minGeHalf', () => {
  const queue: QueueLine[] = [
    // sparse source: only 100 tokens (below minTokens=1000)
    ql('2026-04-25T00:00:00Z', 'sparse', 100),
    ql('2026-04-26T00:00:00Z', 'sparse', 100),
    ql('2026-04-27T00:00:00Z', 'sparse', 100),
    ql('2026-04-28T00:00:00Z', 'sparse', 100),
    // few-day source: 4000 tokens but only 2 days (below minDays=4)
    ql('2026-04-25T00:00:00Z', 'fewdays', 2000),
    ql('2026-04-26T00:00:00Z', 'fewdays', 2000),
    // healthy source
    ql('2026-04-25T00:00:00Z', 'ok', 1000),
    ql('2026-04-26T00:00:00Z', 'ok', 2000),
    ql('2026-04-27T00:00:00Z', 'ok', 3000),
    ql('2026-04-28T00:00:00Z', 'ok', 4000),
  ];
  const r = buildDailyTokenGeHalfIndex(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'ok');
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowMinDays, 1);
  // Now apply minGeHalf above the actual value to drop it.
  const r2 = buildDailyTokenGeHalfIndex(queue, {
    generatedAt: GEN,
    minGeHalf: 1.0,
  });
  assert.equal(r2.sources.length, 0);
  assert.equal(r2.droppedBelowMinGeHalf, 1);
});

test('buildDailyTokenGeHalfIndex: top cap and sort respected', () => {
  const queue: QueueLine[] = [];
  // three sources with different inequality
  for (let d = 25; d <= 28; d++) {
    queue.push(ql(`2026-04-${d}T00:00:00Z`, 'low', 1000 + d));
    queue.push(ql(`2026-04-${d}T00:00:00Z`, 'mid', d * d * 100));
    queue.push(ql(`2026-04-${d}T00:00:00Z`, 'high', d * d * d * 10));
  }
  const r = buildDailyTokenGeHalfIndex(queue, {
    generatedAt: GEN,
    sort: 'gehalf',
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.gehalf >= r.sources[1]!.gehalf);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenGeHalfIndex: source filter restricts rows', () => {
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
  const r = buildDailyTokenGeHalfIndex(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 4);
});

test('buildDailyTokenGeHalfIndex: invalid hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 1000),
    ql('2026-04-25T00:00:00Z', 'a', 1000),
    ql('2026-04-26T00:00:00Z', 'a', 2000),
    ql('2026-04-27T00:00:00Z', 'a', 3000),
    ql('2026-04-28T00:00:00Z', 'a', 4000),
  ];
  const r = buildDailyTokenGeHalfIndex(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenGeHalfIndex: rejects bad knobs', () => {
  assert.throws(() =>
    buildDailyTokenGeHalfIndex([], { generatedAt: GEN, minDays: 1 }),
  );
  assert.throws(() =>
    buildDailyTokenGeHalfIndex([], { generatedAt: GEN, minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenGeHalfIndex([], { generatedAt: GEN, top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenGeHalfIndex([], {
      generatedAt: GEN,
      minGeHalf: -0.1,
    }),
  );
  assert.throws(() =>
    buildDailyTokenGeHalfIndex([], {
      generatedAt: GEN,
      sort: 'bogus' as never,
    }),
  );
  assert.throws(() =>
    buildDailyTokenGeHalfIndex([], {
      generatedAt: GEN,
      since: 'not-iso',
    }),
  );
});

test('GE_HALF_ATK_HALF_RATIO_LIMITS constant', () => {
  assert.equal(GE_HALF_ATK_HALF_RATIO_LIMITS.atEquality, 2);
  assert.equal(GE_HALF_ATK_HALF_RATIO_LIMITS.atSpike, 4);
});

// ---- refinement: pareto closed form + lognormal-implied sigma^2 + clamp ----

test('geHalfOfVector: Pareto(alpha=2) closed form 4*(1 - sqrt(2)/1.5)', () => {
  // Sample inverse-CDF Pareto(alpha=2, x_min=1): D = (1-U)^(-1/2),
  // deterministic LCG so the test is reproducible.
  let s = 67890;
  function rnd(): number {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    return (s + 1) / 0x80000000;
  }
  const N = 100000;
  const v: number[] = [];
  for (let i = 0; i < N; i++) {
    const u = rnd();
    v.push(Math.pow(1 - u, -1 / 2));
  }
  const r = geHalfOfVector(v);
  const expected = 4 * (1 - Math.sqrt(1 * 2) / 1.5); // ~ 0.2287
  // Tolerance loose (Pareto MC convergence is slow due to heavy tail).
  assert.ok(
    Math.abs(r.gehalf - expected) < 0.04,
    `Pareto(2) GE(1/2) ~ ${expected.toFixed(4)}, got ${r.gehalf.toFixed(4)}`,
  );
});

test('buildDailyTokenGeHalfIndex: lognormal-implied sigma^2 round-trips on lognormal data', () => {
  // For lognormal data: GE(1/2) = 4*(1 - exp(-sigma^2/8)),
  // inverted: sigma^2 = -8*log(1 - gehalf/4). The audit field
  // lognormalImpliedSigmaSq should match the empirical VL within MC
  // tolerance.
  let s = 24681;
  function rnd(): number {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    return (s + 1) / 0x80000000;
  }
  function rnorm(): number {
    return (
      Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd())
    );
  }
  const sigma = 0.8;
  const N = 30000;
  const queue: QueueLine[] = [];
  for (let i = 0; i < N; i++) {
    const v = Math.exp(5 + sigma * rnorm());
    const day = new Date(Date.UTC(2026, 0, 1) + i * 86400_000)
      .toISOString()
      .slice(0, 10);
    queue.push(ql(day + 'T00:00:00Z', 'logn', v));
  }
  const r = buildDailyTokenGeHalfIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
    includeAtkAnchor: true,
  });
  const row = r.sources[0]!;
  const sigmaSq = sigma * sigma;
  assert.ok(
    row.lognormalImpliedSigmaSq !== undefined,
    'lognormalImpliedSigmaSq missing',
  );
  // Within 5% of true sigma^2.
  assert.ok(
    Math.abs((row.lognormalImpliedSigmaSq as number) - sigmaSq) < 0.05 * sigmaSq + 0.02,
    `lognormalImpliedSigmaSq ${(row.lognormalImpliedSigmaSq as number).toFixed(4)} vs true ${sigmaSq.toFixed(4)}`,
  );
});

test('geHalfOfVector: gehalf strictly bounded above by 4 even on extreme spike', () => {
  // 999 ones + one huge spike. M_{1/2} approaches 1, sqrt(mu) blows
  // up, ratio -> 0, gehalf -> 4 but never reaches it.
  const v = new Array(999).fill(1);
  v.push(1e18);
  const r = geHalfOfVector(v);
  assert.ok(r.gehalf < 4, `gehalf must be < 4, got ${r.gehalf}`);
  assert.ok(r.gehalf > 3, `extreme spike should drive gehalf > 3, got ${r.gehalf}`);
});
