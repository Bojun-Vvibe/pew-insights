/**
 * Property tests for source-row-token-siegel-slope.
 *
 * These complement the unit tests in `sourcerowtokensiegelslope.test.ts`
 * by hammering equivariance and breakdown invariants over many random
 * series. Determinism: a fixed seeded LCG so the suite is reproducible.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { siegelSlope } from '../src/sourcerowtokensiegelslope.js';

/** Small deterministic LCG (Numerical Recipes). */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function randomSeries(rng: () => number, n: number, scale = 100): number[] {
  const xs: number[] = [];
  for (let i = 0; i < n; i += 1) xs.push(rng() * scale);
  return xs;
}

test('property: translation in x leaves slope unchanged', () => {
  const rng = makeRng(0xc0ffee);
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 4 + Math.floor(rng() * 20);
    const xs = randomSeries(rng, n);
    const shift = (rng() - 0.5) * 1e6;
    const r1 = siegelSlope(xs);
    const r2 = siegelSlope(xs.map((v) => v + shift));
    assert.ok(
      Math.abs(r2.slope - r1.slope) < 1e-9,
      `trial ${trial} n=${n}: slope drifted ${r2.slope - r1.slope}`,
    );
    assert.ok(Math.abs(r2.intercept - (r1.intercept + shift)) < 1e-6);
  }
});

test('property: scaling x by k > 0 scales slope and intercept by k', () => {
  const rng = makeRng(0xdeadbeef);
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 4 + Math.floor(rng() * 20);
    const xs = randomSeries(rng, n);
    const k = 0.01 + rng() * 100;
    const r1 = siegelSlope(xs);
    const r2 = siegelSlope(xs.map((v) => v * k));
    assert.ok(
      Math.abs(r2.slope - k * r1.slope) < 1e-6 * Math.max(1, Math.abs(k * r1.slope)),
    );
    assert.ok(
      Math.abs(r2.intercept - k * r1.intercept) <
        1e-6 * Math.max(1, Math.abs(k * r1.intercept)),
    );
  }
});

test('property: anchor count partition always sums to n', () => {
  const rng = makeRng(0x12345);
  for (let trial = 0; trial < 100; trial += 1) {
    const n = 4 + Math.floor(rng() * 20);
    const xs = randomSeries(rng, n);
    const r = siegelSlope(xs);
    assert.equal(
      r.anchorsPositive + r.anchorsNegative + r.anchorsZero,
      n,
    );
    assert.equal(r.perAnchorMedians.length, n);
    assert.equal(r.pairsTotal, n * (n - 1));
  }
});

test('property: perAnchorMedianMin <= slope <= perAnchorMedianMax', () => {
  // The outer median over the inner medians must lie within their range.
  const rng = makeRng(0x77777);
  for (let trial = 0; trial < 100; trial += 1) {
    const n = 4 + Math.floor(rng() * 20);
    const xs = randomSeries(rng, n);
    const r = siegelSlope(xs);
    assert.ok(r.slope >= r.perAnchorMedianMin - 1e-12);
    assert.ok(r.slope <= r.perAnchorMedianMax + 1e-12);
    assert.ok(r.perAnchorMedianRange >= 0);
  }
});

test('property: high breakdown — Siegel survives more outliers than naive endpoint slope', () => {
  // Pristine line y = i over n points; corrupt floor((n-1)/2) - 1 points to
  // wild values. Strictly fewer than half the points are bad, so Siegel's
  // outer median over inner medians must still recover slope ~= 1.
  const rng = makeRng(0xabc123);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 11 + Math.floor(rng() * 10);
    const xs = Array.from({ length: n }, (_, i) => i);
    const corruptCount = Math.floor((n - 1) / 2) - 1;
    const corruptIdx = new Set<number>();
    while (corruptIdx.size < corruptCount) {
      corruptIdx.add(Math.floor(rng() * n));
    }
    for (const i of corruptIdx) {
      xs[i] = (rng() < 0.5 ? -1 : 1) * 1e9;
    }
    const r = siegelSlope(xs);
    assert.ok(
      Math.abs(r.slope - 1) < 1e-6,
      `trial ${trial} n=${n} corrupted=${corruptCount}: slope=${r.slope}`,
    );
  }
});
