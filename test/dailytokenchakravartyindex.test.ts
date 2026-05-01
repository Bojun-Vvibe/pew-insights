import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenChakravartyIndex,
  chakravartyOfVector,
} from '../src/dailytokenchakravartyindex.js';
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

// ---- chakravartyOfVector primitive ----------------------------------

test('chakravartyOfVector: empty -> degenerate, C=0', () => {
  const r = chakravartyOfVector([], 0.5);
  assert.equal(r.chakravarty, 0);
  assert.equal(r.degenerate, true);
});

test('chakravartyOfVector: n=1 -> degenerate, C=0', () => {
  const r = chakravartyOfVector([42], 0.5);
  assert.equal(r.chakravarty, 0);
  assert.equal(r.degenerate, true);
});

test('chakravartyOfVector: all-zero -> degenerate, C=0', () => {
  const r = chakravartyOfVector([0, 0, 0, 0], 0.5);
  assert.equal(r.chakravarty, 0);
  assert.equal(r.degenerate, true);
});

test('chakravartyOfVector: perfect equality -> C=0 for any alpha in (0,1)', () => {
  for (const a of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    const r = chakravartyOfVector([10, 10, 10, 10, 10], a);
    assert.ok(
      Math.abs(r.chakravarty) < 1e-12,
      `expected C=0 at alpha=${a}, got ${r.chakravarty}`,
    );
    assert.equal(r.degenerate, false);
  }
});

test('chakravartyOfVector: scale-invariant', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = chakravartyOfVector(v, 0.5).chakravarty;
  const b = chakravartyOfVector(
    v.map((x) => x * 1000),
    0.5,
  ).chakravarty;
  assert.ok(Math.abs(a - b) < 1e-12, `scale-invariance broken: ${a} vs ${b}`);
});

test('chakravartyOfVector: permutation-invariant', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = chakravartyOfVector(v, 0.5).chakravarty;
  const b = chakravartyOfVector([11, 4, 9, 3, 7, 1], 0.5).chakravarty;
  assert.ok(Math.abs(a - b) < 1e-15);
});

test('chakravartyOfVector: known closed-form on [1,4] at alpha=0.5', () => {
  // mu = 2.5; shares = 0.4, 1.6; sqrt(0.4) ~ 0.632455532, sqrt(1.6) ~ 1.264911064
  // mean of sqrt(share) ~ 0.948683298; C = 1 - 0.948683298 ~ 0.051316702
  const r = chakravartyOfVector([1, 4], 0.5);
  assert.ok(
    Math.abs(r.chakravarty - 0.05131670194949336) < 1e-12,
    `closed-form mismatch: ${r.chakravarty}`,
  );
});

test('chakravartyOfVector: bounded in [0, 1]', () => {
  const v = [1, 1, 1, 1, 1000];
  for (const a of [0.1, 0.5, 0.9]) {
    const r = chakravartyOfVector(v, a).chakravarty;
    assert.ok(r >= 0 && r <= 1, `out of bounds at alpha=${a}: ${r}`);
  }
});

test('chakravartyOfVector: alpha->1 limit drives C->0 for any vector', () => {
  // As alpha -> 1, (x/mu)^alpha -> x/mu and the mean of x/mu is exactly 1,
  // so C = 1 - 1 = 0. We test that C(alpha) gets arbitrarily small as
  // alpha approaches 1 from below.
  const v = [1, 2, 3, 4, 5, 100];
  const c099 = chakravartyOfVector(v, 0.99).chakravarty;
  const c0999 = chakravartyOfVector(v, 0.999).chakravarty;
  assert.ok(c099 > 0, `expected C(0.99) > 0 for unequal vector: ${c099}`);
  assert.ok(
    c0999 < c099,
    `expected C(0.999) < C(0.99) approaching the alpha->1 zero limit: ${c0999} vs ${c099}`,
  );
  assert.ok(c0999 < 0.01, `expected C(0.999) < 0.01: ${c0999}`);
});

test('chakravartyOfVector: throws on negative', () => {
  assert.throws(() => chakravartyOfVector([1, -2, 3], 0.5));
});

test('chakravartyOfVector: throws on non-finite', () => {
  assert.throws(() =>
    chakravartyOfVector([1, Number.POSITIVE_INFINITY, 3], 0.5),
  );
  assert.throws(() => chakravartyOfVector([1, Number.NaN, 3], 0.5));
});

test('chakravartyOfVector: throws on alpha at boundary 0 or 1', () => {
  assert.throws(() => chakravartyOfVector([1, 2, 3], 0));
  assert.throws(() => chakravartyOfVector([1, 2, 3], 1));
  assert.throws(() => chakravartyOfVector([1, 2, 3], -0.5));
  assert.throws(() => chakravartyOfVector([1, 2, 3], 1.5));
});

test('chakravartyOfVector: ordering with known transfer (Pigou-Dalton)', () => {
  // [10, 10, 10, 10, 10] -> C = 0
  // [9, 10, 10, 10, 11]  -> small C > 0 (mild spread)
  // [5, 10, 10, 10, 15]  -> larger C (bigger spread, same mean)
  const c0 = chakravartyOfVector([10, 10, 10, 10, 10], 0.5).chakravarty;
  const c1 = chakravartyOfVector([9, 10, 10, 10, 11], 0.5).chakravarty;
  const c2 = chakravartyOfVector([5, 10, 10, 10, 15], 0.5).chakravarty;
  assert.ok(Math.abs(c0) < 1e-12, `equal vector should give C=0: ${c0}`);
  assert.ok(c1 > 0, `small spread should give C>0: ${c1}`);
  assert.ok(c2 > c1, `larger spread should give larger C: ${c2} vs ${c1}`);
});

// ---- buildDailyTokenChakravartyIndex builder -----------------------

test('builder: empty queue -> totalSources=0, no rows', () => {
  const r = buildDailyTokenChakravartyIndex([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.alpha, 0.5);
  assert.equal(r.minDays, 3);
});

test('builder: single source over 4 days; equal mass -> C=0', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'srcA', 1000),
    ql('2026-04-02T00:00:00.000Z', 'srcA', 1000),
    ql('2026-04-03T00:00:00.000Z', 'srcA', 1000),
    ql('2026-04-04T00:00:00.000Z', 'srcA', 1000),
  ];
  const r = buildDailyTokenChakravartyIndex(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'srcA');
  assert.equal(row.nDays, 4);
  assert.ok(Math.abs(row.chakravarty) < 1e-12);
  assert.equal(row.degenerate, false);
});

test('builder: ordering by chakravarty matches spread direction', () => {
  // srcLow: equal mass over 4 days -> C ~ 0
  // srcHigh: heavy spike -> C > 0
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'srcLow', 1000),
    ql('2026-04-02T00:00:00.000Z', 'srcLow', 1000),
    ql('2026-04-03T00:00:00.000Z', 'srcLow', 1000),
    ql('2026-04-04T00:00:00.000Z', 'srcLow', 1000),
    ql('2026-04-01T00:00:00.000Z', 'srcHigh', 1),
    ql('2026-04-02T00:00:00.000Z', 'srcHigh', 1),
    ql('2026-04-03T00:00:00.000Z', 'srcHigh', 1),
    ql('2026-04-04T00:00:00.000Z', 'srcHigh', 10000),
  ];
  const r = buildDailyTokenChakravartyIndex(queue, {
    generatedAt: GEN,
    minTokens: 1, // srcHigh totals 10003 -> ok
  });
  assert.equal(r.sources.length, 2);
  // sort default = chakravarty desc
  assert.equal(r.sources[0]!.source, 'srcHigh');
  assert.equal(r.sources[1]!.source, 'srcLow');
  assert.ok(r.sources[0]!.chakravarty > r.sources[1]!.chakravarty);
});

test('builder: scale-invariance at the report level', () => {
  const base: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'srcA', 1),
    ql('2026-04-02T00:00:00.000Z', 'srcA', 7),
    ql('2026-04-03T00:00:00.000Z', 'srcA', 3),
    ql('2026-04-04T00:00:00.000Z', 'srcA', 19),
    ql('2026-04-05T00:00:00.000Z', 'srcA', 4),
  ];
  const scaled: QueueLine[] = base.map((q) => ({
    ...q,
    total_tokens: q.total_tokens * 1000,
    output_tokens: q.output_tokens * 1000,
  }));
  const a = buildDailyTokenChakravartyIndex(base, {
    generatedAt: GEN,
    minTokens: 1,
  });
  const b = buildDailyTokenChakravartyIndex(scaled, {
    generatedAt: GEN,
    minTokens: 1,
  });
  assert.equal(a.sources.length, 1);
  assert.equal(b.sources.length, 1);
  assert.ok(
    Math.abs(a.sources[0]!.chakravarty - b.sources[0]!.chakravarty) < 1e-12,
    `report-level scale-invariance broken: ${a.sources[0]!.chakravarty} vs ${b.sources[0]!.chakravarty}`,
  );
});

test('builder: includeAtkinsonAnchor surfaces atkinson + atkinsonGap and ratio', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'srcA', 1),
    ql('2026-04-02T00:00:00.000Z', 'srcA', 7),
    ql('2026-04-03T00:00:00.000Z', 'srcA', 3),
    ql('2026-04-04T00:00:00.000Z', 'srcA', 19),
    ql('2026-04-05T00:00:00.000Z', 'srcA', 4),
  ];
  const r = buildDailyTokenChakravartyIndex(queue, {
    generatedAt: GEN,
    minTokens: 1,
    includeAtkinsonAnchor: true,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.atkinson !== undefined);
  assert.ok(row.atkinsonGap !== undefined);
  assert.ok(row.chakravartyOverAtkinson !== undefined);
  // Both should be > 0 on this unequal vector
  assert.ok(row.chakravarty > 0);
  assert.ok((row.atkinson as number) > 0);
  // Sanity: atkinsonGap == chakravarty - atkinson
  assert.ok(
    Math.abs(
      (row.atkinsonGap as number) -
        (row.chakravarty - (row.atkinson as number)),
    ) < 1e-15,
  );
  // Sanity: ratio == chakravarty / atkinson
  assert.ok(
    Math.abs(
      (row.chakravartyOverAtkinson as number) -
        row.chakravarty / (row.atkinson as number),
    ) < 1e-12,
  );
});

test('builder: alpha = 1 rejected at parse time', () => {
  assert.throws(() =>
    buildDailyTokenChakravartyIndex([], { alpha: 1, generatedAt: GEN }),
  );
});

test('builder: alpha = 0 rejected at parse time', () => {
  assert.throws(() =>
    buildDailyTokenChakravartyIndex([], { alpha: 0, generatedAt: GEN }),
  );
});

test('builder: minDays = 1 rejected (Chakravarty needs n>=2)', () => {
  assert.throws(() =>
    buildDailyTokenChakravartyIndex([], { minDays: 1, generatedAt: GEN }),
  );
});

test('builder: invalid sort rejected', () => {
  assert.throws(() =>
    buildDailyTokenChakravartyIndex([], {
      sort: 'nonsense' as never,
      generatedAt: GEN,
    }),
  );
});

// ---- Refinement: property-based + numerical-stability witnesses -----

/**
 * Tiny seeded LCG so the property-based tests are DETERMINISTIC.
 * Every CI run hits the exact same random vectors -> reproducible.
 */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('property: scale-invariance holds across 200 random vectors at alpha=0.5', () => {
  const rng = lcg(0xc0ffee);
  for (let trial = 0; trial < 200; trial += 1) {
    const n = 3 + Math.floor(rng() * 30); // n in [3, 32]
    const v: number[] = [];
    for (let i = 0; i < n; i += 1) v.push(rng() * 1e6);
    const scale = 1e-3 + rng() * 1e6;
    const a = chakravartyOfVector(v, 0.5).chakravarty;
    const b = chakravartyOfVector(
      v.map((x) => x * scale),
      0.5,
    ).chakravarty;
    assert.ok(
      Math.abs(a - b) < 1e-10,
      `scale-invariance broken at trial ${trial} (scale=${scale}): ${a} vs ${b}`,
    );
  }
});

test('property: C in [0, 1) across 200 random vectors at alpha in {0.1, 0.5, 0.9}', () => {
  const rng = lcg(0xdeadbeef);
  for (let trial = 0; trial < 200; trial += 1) {
    const n = 2 + Math.floor(rng() * 40); // n in [2, 41]
    const v: number[] = [];
    for (let i = 0; i < n; i += 1) v.push(rng() * 1e9);
    for (const alpha of [0.1, 0.5, 0.9]) {
      const c = chakravartyOfVector(v, alpha).chakravarty;
      assert.ok(
        c >= 0 && c < 1,
        `C out of [0, 1) at trial ${trial} alpha=${alpha}: ${c}`,
      );
    }
  }
});

test('property: monotone Pigou-Dalton spread (200 random anchors, alpha=0.5)', () => {
  // For each random base vector, build a "spread" version by pushing one
  // randomly-chosen pair (i, j) further apart by a transfer of size t while
  // keeping the sum constant. Spread must NEVER decrease C.
  const rng = lcg(0xfeedface);
  for (let trial = 0; trial < 200; trial += 1) {
    const n = 4 + Math.floor(rng() * 20);
    const v: number[] = [];
    for (let i = 0; i < n; i += 1) v.push(100 + rng() * 1000);
    // Pick i (low) and j (high) by sorting
    const sorted = [...v].sort((a, b) => a - b);
    const lo = 0;
    const hi = n - 1;
    const t = Math.min(sorted[lo] as number, 50) * rng();
    if (t <= 0) continue;
    const spread = [...sorted];
    spread[lo] = (spread[lo] as number) - t;
    spread[hi] = (spread[hi] as number) + t;
    const cBase = chakravartyOfVector(sorted, 0.5).chakravarty;
    const cSpread = chakravartyOfVector(spread, 0.5).chakravarty;
    assert.ok(
      cSpread >= cBase - 1e-12,
      `Pigou-Dalton spread decreased C at trial ${trial}: ${cBase} -> ${cSpread}`,
    );
  }
});

test('numerical stability: tiny share values (1e-12 relative) do not produce NaN or negative C', () => {
  // Mostly-zero vector with one heavy tail. Shares of zero contribute 0
  // by the 0^alpha = 0 convention; tiny shares stress Math.pow precision.
  const v = [1e-12, 1e-12, 1e-12, 1e-12, 1e12];
  for (const alpha of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const c = chakravartyOfVector(v, alpha).chakravarty;
    assert.ok(
      Number.isFinite(c),
      `non-finite C at alpha=${alpha} on heavy-tail vector: ${c}`,
    );
    assert.ok(c >= 0, `negative C at alpha=${alpha}: ${c}`);
    assert.ok(c <= 1, `C > 1 at alpha=${alpha}: ${c}`);
  }
});

test('numerical stability: huge values (1e15) do not overflow Math.pow path', () => {
  const v = [1e15, 2e15, 3e15, 4e15, 5e15];
  for (const alpha of [0.1, 0.5, 0.9]) {
    const c = chakravartyOfVector(v, alpha).chakravarty;
    assert.ok(Number.isFinite(c), `non-finite C at alpha=${alpha}: ${c}`);
    assert.ok(c >= 0 && c < 1, `C out of [0, 1) at alpha=${alpha}: ${c}`);
  }
  // And the SAME shape at unit scale must give the same C (scale-invariance
  // once more, as a stability witness across 15 orders of magnitude).
  const cBig = chakravartyOfVector(v, 0.5).chakravarty;
  const cUnit = chakravartyOfVector([1, 2, 3, 4, 5], 0.5).chakravarty;
  assert.ok(
    Math.abs(cBig - cUnit) < 1e-12,
    `scale-invariance broken across 15 orders of magnitude: ${cBig} vs ${cUnit}`,
  );
});
