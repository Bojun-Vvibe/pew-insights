/**
 * Randomized property / invariant pins for
 * source-row-token-midhinge.
 *
 * These are not example-based unit tests (those live in
 * `sourcerowtokenmidhinge.test.ts`); they exercise mathematical
 * invariants over many seeded random inputs:
 *
 *   1. **Identity formula**: midhinge == (q1 + q3) / 2 exactly.
 *   2. **Bound**: midhinge in [q1, q3] for every random series.
 *   3. **Translation-equivariance**: shifting all rows by `c`
 *      shifts midhinge by exactly `c` and leaves mhMedianGap
 *      invariant.
 *   4. **Scale-equivariance**: rescaling all rows by `c > 0`
 *      rescales midhinge and mhMedianGap by `c`.
 *   5. **Order-invariance**: shuffling rows leaves every output
 *      field (q1, median, q3, midhinge, mhMedianGap, rowsKept)
 *      bit-identical.
 *   6. **Gap bound**: |mhMedianGap| <= (q3 - q1) / 2 for every
 *      random series (follows from q1 <= median <= q3).
 *   7. **Sign correlation with Bowley direction**: the sign of
 *      mhMedianGap matches the sign of the Bowley skewness
 *      numerator (q3 - 2*median + q1) on every random series
 *      (both are 2 * (midhinge - median)).
 *
 * Determinism: a small mulberry32 PRNG seeded per test makes
 * each run reproducible without adding a runtime dependency.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenMidhinge } from '../src/sourcerowtokenmidhinge.js';
import type { QueueLine } from '../src/types.js';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function mkRandomSeries(
  rng: () => number,
  source: string,
  n: number,
  maxVal = 1_000_000,
): QueueLine[] {
  const out: QueueLine[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      source,
      model: 'm',
      hour_start: `2026-04-27T${String(i % 24).padStart(2, '0')}:00:00.000Z`,
      device_id: 'd',
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: Math.floor(rng() * maxVal),
    });
  }
  return out;
}

const GEN = '2026-04-28T12:00:00.000Z';
const TRIALS = 80;

test('midhinge property: MH == (q1 + q3)/2 exactly across random series', () => {
  const rng = mulberry32(0xa11ce);
  for (let t = 0; t < TRIALS; t++) {
    const n = 4 + Math.floor(rng() * 200);
    const q = mkRandomSeries(rng, 's', n);
    const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
    const s = r.sources[0]!;
    assert.equal(
      s.midhinge,
      (s.q1 + s.q3) / 2,
      `trial ${t}: MH != (q1+q3)/2 for n=${n}`,
    );
  }
});

test('midhinge property: q1 <= MH <= q3 across random series', () => {
  const rng = mulberry32(0xb0b);
  for (let t = 0; t < TRIALS; t++) {
    const n = 4 + Math.floor(rng() * 200);
    const q = mkRandomSeries(rng, 's', n);
    const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
    const s = r.sources[0]!;
    assert.ok(
      s.midhinge >= s.q1 - 1e-9,
      `trial ${t}: MH ${s.midhinge} < q1 ${s.q1}`,
    );
    assert.ok(
      s.midhinge <= s.q3 + 1e-9,
      `trial ${t}: MH ${s.midhinge} > q3 ${s.q3}`,
    );
  }
});

test('midhinge property: translation-equivariance MH(x + c) == MH(x) + c', () => {
  const rng = mulberry32(0xc4f3);
  for (let t = 0; t < TRIALS; t++) {
    const n = 4 + Math.floor(rng() * 200);
    const base = mkRandomSeries(rng, 's', n, 100_000);
    const c = Math.floor(rng() * 1_000_000);
    const shifted: QueueLine[] = base.map((q) => ({
      ...q,
      total_tokens: q.total_tokens + c,
    }));
    const r1 = buildSourceRowTokenMidhinge(base, { generatedAt: GEN });
    const r2 = buildSourceRowTokenMidhinge(shifted, { generatedAt: GEN });
    assert.ok(
      Math.abs(r1.sources[0]!.midhinge + c - r2.sources[0]!.midhinge) < 1e-6,
      `trial ${t}: translation broke`,
    );
    // gap unchanged under translation
    assert.ok(
      Math.abs(r1.sources[0]!.mhMedianGap - r2.sources[0]!.mhMedianGap) < 1e-6,
      `trial ${t}: gap not translation-invariant`,
    );
  }
});

test('midhinge property: scale-equivariance MH(c*x) == c*MH(x) for c > 0', () => {
  const rng = mulberry32(0xd00d);
  for (let t = 0; t < TRIALS; t++) {
    const n = 4 + Math.floor(rng() * 200);
    const base = mkRandomSeries(rng, 's', n, 100_000);
    const c = 1 + Math.floor(rng() * 99); // positive integer scale
    const scaled: QueueLine[] = base.map((q) => ({
      ...q,
      total_tokens: q.total_tokens * c,
    }));
    const r1 = buildSourceRowTokenMidhinge(base, { generatedAt: GEN });
    const r2 = buildSourceRowTokenMidhinge(scaled, { generatedAt: GEN });
    const expected = r1.sources[0]!.midhinge * c;
    assert.ok(
      Math.abs(expected - r2.sources[0]!.midhinge) <= 1e-6 * Math.max(1, expected),
      `trial ${t}: scale broke (got ${r2.sources[0]!.midhinge}, expected ${expected})`,
    );
    const expectedGap = r1.sources[0]!.mhMedianGap * c;
    assert.ok(
      Math.abs(expectedGap - r2.sources[0]!.mhMedianGap) <=
        1e-6 * Math.max(1, Math.abs(expectedGap)),
      `trial ${t}: gap not scale-equivariant`,
    );
  }
});

test('midhinge property: order-invariance (shuffle preserves all numeric outputs)', () => {
  const rng = mulberry32(0xfade);
  for (let t = 0; t < TRIALS; t++) {
    const n = 4 + Math.floor(rng() * 200);
    const base = mkRandomSeries(rng, 's', n);
    // Fisher-Yates with seeded rng
    const shuffled = base.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    const r1 = buildSourceRowTokenMidhinge(base, { generatedAt: GEN });
    const r2 = buildSourceRowTokenMidhinge(shuffled, { generatedAt: GEN });
    const a = r1.sources[0]!;
    const b = r2.sources[0]!;
    assert.equal(a.q1, b.q1, `trial ${t}: q1 drift`);
    assert.equal(a.median, b.median, `trial ${t}: median drift`);
    assert.equal(a.q3, b.q3, `trial ${t}: q3 drift`);
    assert.equal(a.midhinge, b.midhinge, `trial ${t}: midhinge drift`);
    assert.equal(a.mhMedianGap, b.mhMedianGap, `trial ${t}: gap drift`);
    assert.equal(a.rowsKept, b.rowsKept, `trial ${t}: rowsKept drift`);
  }
});

test('midhinge property: |mhMedianGap| <= (q3 - q1) / 2', () => {
  const rng = mulberry32(0x1337);
  for (let t = 0; t < TRIALS; t++) {
    const n = 4 + Math.floor(rng() * 200);
    const q = mkRandomSeries(rng, 's', n);
    const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
    const s = r.sources[0]!;
    const halfIqr = (s.q3 - s.q1) / 2;
    assert.ok(
      Math.abs(s.mhMedianGap) <= halfIqr + 1e-9,
      `trial ${t}: |gap|=${Math.abs(s.mhMedianGap)} > halfIQR=${halfIqr}`,
    );
  }
});

test('midhinge property: sign(mhMedianGap) == sign(q3 - 2*median + q1) (Bowley direction)', () => {
  const rng = mulberry32(0x42);
  for (let t = 0; t < TRIALS; t++) {
    const n = 4 + Math.floor(rng() * 200);
    const q = mkRandomSeries(rng, 's', n);
    const r = buildSourceRowTokenMidhinge(q, { generatedAt: GEN });
    const s = r.sources[0]!;
    // mhMedianGap = (q1+q3)/2 - median = (q3 - 2*median + q1) / 2
    // so signs must be identical, magnitudes related by exactly 2x
    const bowleyNum = s.q3 - 2 * s.median + s.q1;
    assert.equal(
      Math.sign(s.mhMedianGap),
      Math.sign(bowleyNum),
      `trial ${t}: gap sign != Bowley num sign`,
    );
    assert.ok(
      Math.abs(2 * s.mhMedianGap - bowleyNum) < 1e-6,
      `trial ${t}: 2*gap != Bowley num`,
    );
  }
});
