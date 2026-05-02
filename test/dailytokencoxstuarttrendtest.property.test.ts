import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyTokenCoxStuartTrendTest } from '../src/dailytokencoxstuarttrendtest.js';

// Property-style anchors for the Cox-Stuart primitive
// (Cox & Stuart 1955, Biometrika 42:80-95). These are
// algebraic identities, not statistical claims, so they hold
// for ANY input series satisfying the precondition n >= 4.

function* lcgFloats(seed: number, n: number): Generator<number> {
  let s = seed >>> 0;
  for (let i = 0; i < n; i += 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    yield s / 0xffffffff;
  }
}

function makeSeries(seed: number, n: number, scale = 1000): number[] {
  return Array.from(lcgFloats(seed, n), (u) => u * scale);
}

test('property: csTau in [-1, +1] for diverse seeded series', () => {
  for (let seed = 1; seed < 25; seed += 1) {
    for (const n of [4, 5, 8, 13, 17, 32, 65, 128]) {
      const x = makeSeries(seed, n);
      const r = dailyTokenCoxStuartTrendTest(x);
      assert.ok(r.coxStuartTau >= -1 && r.coxStuartTau <= 1);
      assert.ok(r.coxStuartZ >= -1e6 && r.coxStuartZ <= 1e6);
    }
  }
});

test('property: nPositive + nNegative + nTied == nPairs', () => {
  for (let seed = 1; seed < 30; seed += 1) {
    for (const n of [4, 7, 16, 31, 64]) {
      const x = makeSeries(seed, n);
      const r = dailyTokenCoxStuartTrendTest(x);
      assert.equal(r.nPositive + r.nNegative + r.nTied, r.nPairs);
      assert.equal(r.nEffective, r.nPositive + r.nNegative);
      assert.equal(r.coxStuartS, r.nPositive - r.nNegative);
    }
  }
});

test('property: csTau == S / k whenever k > 0', () => {
  for (let seed = 1; seed < 20; seed += 1) {
    const x = makeSeries(seed, 32);
    const r = dailyTokenCoxStuartTrendTest(x);
    if (r.nEffective > 0) {
      assert.ok(
        Math.abs(r.coxStuartTau - r.coxStuartS / r.nEffective) < 1e-12,
      );
    } else {
      assert.equal(r.coxStuartTau, 0);
    }
  }
});

test('property: scale invariance of csTau / csZ / counts', () => {
  for (let seed = 1; seed < 15; seed += 1) {
    const x = makeSeries(seed, 24);
    const rA = dailyTokenCoxStuartTrendTest(x);
    const rB = dailyTokenCoxStuartTrendTest(x.map((v) => v * 1e6));
    assert.equal(rA.coxStuartTau, rB.coxStuartTau);
    assert.equal(rA.coxStuartZ, rB.coxStuartZ);
    assert.equal(rA.nPositive, rB.nPositive);
    assert.equal(rA.nNegative, rB.nNegative);
    assert.equal(rA.nTied, rB.nTied);
  }
});

test('property: shift invariance of csTau / csZ / counts', () => {
  for (let seed = 1; seed < 15; seed += 1) {
    const x = makeSeries(seed, 24);
    const rA = dailyTokenCoxStuartTrendTest(x);
    const rB = dailyTokenCoxStuartTrendTest(x.map((v) => v + 12345));
    assert.equal(rA.coxStuartTau, rB.coxStuartTau);
    assert.equal(rA.coxStuartZ, rB.coxStuartZ);
    assert.equal(rA.nPositive, rB.nPositive);
    assert.equal(rA.nNegative, rB.nNegative);
    assert.equal(rA.nTied, rB.nTied);
  }
});

test('property: lag c == nPairs m == floor(n/2)', () => {
  for (const n of [4, 5, 7, 8, 13, 16, 17, 100, 265]) {
    const x = makeSeries(7, n);
    const r = dailyTokenCoxStuartTrendTest(x);
    assert.equal(r.coxStuartLag, Math.floor(n / 2));
    assert.equal(r.nPairs, Math.floor(n / 2));
  }
});

test('property: time-reversal sign-flip of S_CS for non-zero series', () => {
  // Hand-pick monotone series so S != 0.
  for (const n of [4, 7, 8, 16, 31]) {
    const x = Array.from({ length: n }, (_, i) => i + 1);
    const r = dailyTokenCoxStuartTrendTest(x);
    const rRev = dailyTokenCoxStuartTrendTest([...x].reverse());
    assert.equal(rRev.coxStuartS, -r.coxStuartS);
    assert.equal(rRev.nPositive, r.nNegative);
    assert.equal(rRev.nNegative, r.nPositive);
    assert.equal(rRev.nTied, r.nTied);
  }
});

test('property: csZ has same sign as S_CS when S_CS != 0', () => {
  for (let seed = 1; seed < 30; seed += 1) {
    const x = makeSeries(seed, 64);
    const r = dailyTokenCoxStuartTrendTest(x);
    if (r.coxStuartS > 0) assert.ok(r.coxStuartZ > 0);
    if (r.coxStuartS < 0) assert.ok(r.coxStuartZ < 0);
    if (r.coxStuartS === 0) assert.equal(r.coxStuartZ, 0);
  }
});
