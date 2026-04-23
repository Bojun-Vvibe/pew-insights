import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  DEFAULT_RATIO_EPS,
  clampProbability,
  ewmaLogit,
  ewmaLogitSeries,
  expit,
  logit,
  safeLogit,
} from '../src/ratios.ts';

// ---------------------------------------------------------------------------
// clampProbability
// ---------------------------------------------------------------------------

test('clampProbability: leaves interior values untouched', () => {
  assert.equal(clampProbability(0.5), 0.5);
  assert.equal(clampProbability(0.123), 0.123);
  assert.equal(clampProbability(0.987), 0.987);
});

test('clampProbability: maps 0 → eps and 1 → 1-eps (default eps)', () => {
  assert.equal(clampProbability(0), DEFAULT_RATIO_EPS);
  assert.equal(clampProbability(1), 1 - DEFAULT_RATIO_EPS);
});

test('clampProbability: respects custom eps', () => {
  assert.equal(clampProbability(0, 0.01), 0.01);
  assert.equal(clampProbability(1, 0.01), 0.99);
  // 0.005 < 0.01 → clamped up
  assert.equal(clampProbability(0.005, 0.01), 0.01);
  // 0.995 > 0.99 → clamped down
  assert.equal(clampProbability(0.995, 0.01), 0.99);
});

test('clampProbability: clamp is symmetric (round-trip antisymmetry)', () => {
  // The whole point of a symmetric clamp: clamp(0) and clamp(1)
  // should be equidistant from 0.5. If they aren't, logit loses
  // its antisymmetry and downstream EWMAs get biased.
  const lo = clampProbability(0);
  const hi = clampProbability(1);
  assert.ok(Math.abs(0.5 - lo - (hi - 0.5)) < 1e-15);
});

test('clampProbability: rejects out-of-range input', () => {
  assert.throws(() => clampProbability(-0.0001), /\[0, 1\]/);
  assert.throws(() => clampProbability(1.0001), /\[0, 1\]/);
});

test('clampProbability: rejects non-finite input', () => {
  assert.throws(() => clampProbability(Number.NaN), /finite/);
  assert.throws(() => clampProbability(Number.POSITIVE_INFINITY), /finite/);
});

test('clampProbability: rejects eps outside (0, 0.5)', () => {
  assert.throws(() => clampProbability(0.5, 0), /eps/);
  assert.throws(() => clampProbability(0.5, 0.5), /eps/);
  assert.throws(() => clampProbability(0.5, 0.6), /eps/);
});

// ---------------------------------------------------------------------------
// logit / expit
// ---------------------------------------------------------------------------

test('logit: 0.5 → 0', () => {
  assert.equal(logit(0.5), 0);
});

test('logit: monotonic increasing', () => {
  assert.ok(logit(0.1) < logit(0.3));
  assert.ok(logit(0.3) < logit(0.7));
  assert.ok(logit(0.7) < logit(0.9));
});

test('logit: antisymmetric around 0.5', () => {
  // logit(p) = -logit(1-p)
  for (const p of [0.1, 0.25, 0.4, 0.49, 0.6, 0.75, 0.95]) {
    assert.ok(Math.abs(logit(p) + logit(1 - p)) < 1e-12, `failed at p=${p}`);
  }
});

test('logit: refuses raw 0 / 1 (would be ±Infinity)', () => {
  assert.throws(() => logit(0), /not finite/);
  assert.throws(() => logit(1), /not finite/);
});

test('logit: refuses out-of-range / non-finite', () => {
  assert.throws(() => logit(-0.1), /\[0, 1\]/);
  assert.throws(() => logit(1.1), /\[0, 1\]/);
  assert.throws(() => logit(Number.NaN), /finite/);
});

test('expit: 0 → 0.5', () => {
  assert.equal(expit(0), 0.5);
});

test('expit: monotonic, in [0, 1]', () => {
  // Inside the representable range, expit stays in [0, 1]. For
  // moderate |z| (≤ ~36) it's strictly inside (0, 1); for very
  // large |z| fp64 rounds to exactly 0 or 1, which is the correct
  // limit and the only sane behavior.
  for (const z of [-100, -10, -1, 0, 1, 10, 100]) {
    const p = expit(z);
    assert.ok(p >= 0 && p <= 1, `expit(${z}) = ${p} not in [0, 1]`);
    assert.ok(Number.isFinite(p) && !Number.isNaN(p));
  }
  // For moderate inputs the strict bound holds.
  for (const z of [-10, -1, 0, 1, 10]) {
    const p = expit(z);
    assert.ok(p > 0 && p < 1, `expit(${z}) = ${p} not strictly in (0, 1)`);
  }
  assert.ok(expit(-1) < expit(0));
  assert.ok(expit(0) < expit(1));
});

test('expit: numerically stable for large negative z', () => {
  // Naive `1 / (1 + Math.exp(-z))` overflows for z = -800 → Infinity
  // → 1/Infinity = 0. The rewritten branch returns a positive
  // subnormal (or true 0 for very extreme values), and crucially
  // never produces NaN.
  const p = expit(-800);
  assert.ok(p >= 0 && p < 1e-300, `expit(-800) = ${p}`);
  assert.ok(Number.isFinite(p));
  assert.ok(!Number.isNaN(p));
});

test('expit: numerically stable for large positive z', () => {
  // Large positive z: e^-z underflows; result rounds to exactly 1
  // in fp64 (the correct limit). The key property is that we
  // produce a finite number, not NaN.
  const p = expit(800);
  assert.ok(p === 1 || (p > 1 - 1e-300 && p < 1), `expit(800) = ${p}`);
  assert.ok(Number.isFinite(p));
});

test('expit: rejects non-finite input', () => {
  assert.throws(() => expit(Number.POSITIVE_INFINITY), /finite/);
  assert.throws(() => expit(Number.NEGATIVE_INFINITY), /finite/);
  assert.throws(() => expit(Number.NaN), /finite/);
});

test('logit ∘ expit = id (within fp tolerance)', () => {
  for (const z of [-5, -1.3, -0.1, 0, 0.1, 1.3, 5]) {
    assert.ok(Math.abs(logit(expit(z)) - z) < 1e-12, `failed at z=${z}`);
  }
});

test('expit ∘ logit = id (within fp tolerance)', () => {
  for (const p of [0.01, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99]) {
    assert.ok(Math.abs(expit(logit(p)) - p) < 1e-12, `failed at p=${p}`);
  }
});

// ---------------------------------------------------------------------------
// safeLogit
// ---------------------------------------------------------------------------

test('safeLogit: handles raw 0 and 1 via clamp', () => {
  // logit(eps) ≈ -13.8 for eps = 1e-6
  const z0 = safeLogit(0);
  const z1 = safeLogit(1);
  assert.ok(Number.isFinite(z0));
  assert.ok(Number.isFinite(z1));
  // Antisymmetry holds up to fp roundoff in (1 - eps).
  assert.ok(Math.abs(z0 + z1) < 1e-9, `clamp should keep antisymmetry; got ${z0 + z1}`);
});

test('safeLogit: agrees with logit for interior values', () => {
  for (const p of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    assert.equal(safeLogit(p), logit(p));
  }
});

test('safeLogit: respects custom eps', () => {
  // With eps = 0.01, logit(0) = logit(0.01) = ln(0.01/0.99)
  const expected = Math.log(0.01 / 0.99);
  assert.ok(Math.abs(safeLogit(0, 0.01) - expected) < 1e-12);
});

// ---------------------------------------------------------------------------
// ewmaLogit
// ---------------------------------------------------------------------------

test('ewmaLogit: throws on empty series', () => {
  assert.throws(() => ewmaLogit([], 0.3), /non-empty/);
});

test('ewmaLogit: throws on bad alpha', () => {
  assert.throws(() => ewmaLogit([0.5], 0), /alpha/);
  assert.throws(() => ewmaLogit([0.5], 1.1), /alpha/);
  assert.throws(() => ewmaLogit([0.5], -0.1), /alpha/);
  assert.throws(() => ewmaLogit([0.5], Number.NaN), /alpha/);
});

test('ewmaLogit: single-sample series returns that sample regardless of alpha', () => {
  for (const alpha of [0.01, 0.3, 0.7, 1.0]) {
    assert.ok(Math.abs(ewmaLogit([0.42], alpha) - 0.42) < 1e-12);
  }
});

test('ewmaLogit: alpha=1 collapses to last sample', () => {
  const result = ewmaLogit([0.1, 0.2, 0.3, 0.9], 1.0);
  assert.ok(Math.abs(result - 0.9) < 1e-12);
});

test('ewmaLogit: constant series collapses to that constant', () => {
  // EWMA of a flat series is the flat value (in any space).
  const result = ewmaLogit([0.7, 0.7, 0.7, 0.7, 0.7], 0.3);
  assert.ok(Math.abs(result - 0.7) < 1e-12);
});

test('ewmaLogit: stays inside (0, 1) for boundary input', () => {
  // The whole motivation: a series of all 1s should yield something
  // very close to 1 but never exactly 1 or > 1. Linear-space EWMA
  // would give exactly 1 here; logit-space gives 1 - eps' for some
  // small eps' related to the clamp.
  const result = ewmaLogit([1, 1, 1, 1, 1], 0.3);
  assert.ok(result > 0 && result < 1, `result ${result} not in (0, 1)`);
  assert.ok(result > 0.999, `result ${result} unexpectedly low`);
});

test('ewmaLogit: stays inside (0, 1) for all-zero input', () => {
  const result = ewmaLogit([0, 0, 0, 0, 0], 0.3);
  assert.ok(result > 0 && result < 1);
  assert.ok(result < 0.001);
});

test('ewmaLogit: tracks a step change at expected speed', () => {
  // A long flat run at 0.2 then a step to 0.8. After one new
  // sample with alpha=0.5 the smoothed value should sit roughly
  // halfway between the two in logit space.
  const flat = Array.from({ length: 10 }, () => 0.2);
  const series = [...flat, 0.8];
  const result = ewmaLogit(series, 0.5);
  // logit-space midpoint of (0.2, 0.8) is 0 → expit(0) = 0.5
  assert.ok(Math.abs(result - 0.5) < 1e-9, `got ${result}`);
});

test('ewmaLogit: smaller alpha is slower to react (further from new sample)', () => {
  const flat = Array.from({ length: 10 }, () => 0.2);
  const series = [...flat, 0.8];
  const fast = ewmaLogit(series, 0.7);
  const slow = ewmaLogit(series, 0.1);
  // The new sample is 0.8, the prior baseline is 0.2; faster alpha
  // pulls the EWMA closer to the new sample.
  assert.ok(fast > slow, `fast=${fast} slow=${slow}`);
  assert.ok(slow < 0.5);
  assert.ok(fast > 0.5);
});

test('ewmaLogit: deterministic (same inputs, same outputs)', () => {
  const series = [0.1, 0.4, 0.55, 0.6, 0.5, 0.7, 0.8, 0.85];
  const a = ewmaLogit(series, 0.3);
  const b = ewmaLogit(series, 0.3);
  assert.equal(a, b);
});

// ---------------------------------------------------------------------------
// ewmaLogitSeries
// ---------------------------------------------------------------------------

test('ewmaLogitSeries: length matches input', () => {
  const series = [0.1, 0.2, 0.3, 0.4, 0.5];
  assert.equal(ewmaLogitSeries(series, 0.3).length, series.length);
});

test('ewmaLogitSeries: first element equals first sample (after clamp)', () => {
  const out = ewmaLogitSeries([0.42, 0.5, 0.6], 0.3);
  assert.ok(Math.abs(out[0]! - 0.42) < 1e-12);
});

test('ewmaLogitSeries: last element equals ewmaLogit of full series', () => {
  const series = [0.2, 0.3, 0.5, 0.7, 0.4, 0.6];
  const out = ewmaLogitSeries(series, 0.4);
  const final = ewmaLogit(series, 0.4);
  assert.ok(Math.abs(out[out.length - 1]! - final) < 1e-12);
});

test('ewmaLogitSeries: every element is in (0, 1)', () => {
  const series = [0, 0, 1, 1, 0, 1, 0.5, 0.5];
  const out = ewmaLogitSeries(series, 0.3);
  for (const p of out) {
    assert.ok(p > 0 && p < 1, `${p} not in (0, 1)`);
  }
});

test('ewmaLogitSeries: throws on empty series', () => {
  assert.throws(() => ewmaLogitSeries([], 0.3), /non-empty/);
});

test('ewmaLogitSeries: throws on bad alpha', () => {
  assert.throws(() => ewmaLogitSeries([0.5], 0), /alpha/);
  assert.throws(() => ewmaLogitSeries([0.5], 1.5), /alpha/);
});
