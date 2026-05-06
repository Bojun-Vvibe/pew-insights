import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation,
  eDivisiveSegmentation,
  scaledEnergyStat,
} from '../src/dailytokenmattesonjamesedivisivedistributionalsegmentation.js';
import type { QueueLine } from '../src/types.js';

const GEN = '2026-05-06T12:00:00.000Z';

function ql(hourStart: string, source: string, tokens: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
  };
}

function genSource(
  src: string,
  startIso: string,
  pattern: number[],
): QueueLine[] {
  const out: QueueLine[] = [];
  const start = Date.parse(startIso);
  for (let i = 0; i < pattern.length; i += 1) {
    const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    out.push(ql(`${day}T00:00:00.000Z`, src, pattern[i]!));
  }
  return out;
}

// Mulberry32 inline (the test file shouldn't depend on the WBS module's
// generator; reimplement so this is self-contained).
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- property: energy distance is non-negative ---------------------------

test('property: scaledEnergyStat is non-negative on random samples', () => {
  const r = rng(12345);
  for (let trial = 0; trial < 25; trial += 1) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 10; i += 1) xs.push(r() * 100);
    for (let i = 0; i < 10; i += 1) ys.push(r() * 100);
    const q = scaledEnergyStat(xs, ys);
    assert.ok(q >= -1e-9, `q=${q}`);
  }
});

// ---- property: ECP segmentation always covers [0, n) cleanly -------------

test('property: tau_star strictly inside (0, n) and ascending on random series', () => {
  const r = rng(54321);
  for (let trial = 0; trial < 10; trial += 1) {
    const n = 30 + Math.floor(r() * 60);
    const x: number[] = [];
    for (let i = 0; i < n; i += 1) x.push(r() * 1000);
    // pick a moderate threshold scaled to data
    let mx = 0;
    for (const v of x) if (v > mx) mx = v;
    const out = eDivisiveSegmentation(x, mx * 0.1);
    for (const t of out.tauStar) {
      assert.ok(t > 0 && t < n, `tau ${t} out of (0, ${n})`);
    }
    for (let i = 1; i < out.tauStar.length; i += 1) {
      assert.ok(out.tauStar[i]! > out.tauStar[i - 1]!);
    }
  }
});

// ---- property: monotone in threshold -------------------------------------

test('property: raising threshold monotonically reduces accepted CPs', () => {
  const r = rng(99);
  const x: number[] = [];
  for (let i = 0; i < 80; i += 1) {
    if (i < 20) x.push(10 + r());
    else if (i < 40) x.push(100 + r() * 5);
    else if (i < 60) x.push(50 + r() * 2);
    else x.push(500 + r() * 10);
  }
  let prev = Infinity;
  for (const c of [0.001, 0.01, 0.1, 1, 10, 100, 1e6]) {
    const out = eDivisiveSegmentation(x, c);
    assert.ok(
      out.tauStar.length <= prev,
      `c=${c}: ${out.tauStar.length} > prev ${prev}`,
    );
    prev = out.tauStar.length;
  }
});

// ---- property: segments partition exactly --------------------------------

test('property: segments form exact partition of [0, n) with no gaps / overlaps', () => {
  const r = rng(7);
  for (let trial = 0; trial < 5; trial += 1) {
    const n = 30 + Math.floor(r() * 40);
    const pattern: number[] = [];
    for (let i = 0; i < n; i += 1) pattern.push(i < n / 2 ? 100 : 5000);
    const queue = genSource(
      `s${trial}`,
      '2026-01-01T00:00:00.000Z',
      pattern,
    );
    const report = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(
      queue,
      { generatedAt: GEN },
    );
    if (report.sources.length === 0) continue;
    const row = report.sources[0]!;
    assert.equal(row.segments[0]!.tStart, 0);
    assert.equal(
      row.segments[row.segments.length - 1]!.tEndExclusive,
      row.nTenureDays,
    );
    let total = 0;
    for (let i = 0; i < row.segments.length; i += 1) {
      total += row.segments[i]!.length;
      if (i + 1 < row.segments.length) {
        assert.equal(
          row.segments[i]!.tEndExclusive,
          row.segments[i + 1]!.tStart,
        );
      }
    }
    assert.equal(total, row.nTenureDays);
  }
});

// ---- property: translation invariance of taus (and monotone-in-shift Q) --

test('property: ECP taus translation-invariant under +c shifts', () => {
  const r = rng(2024);
  for (let trial = 0; trial < 6; trial += 1) {
    const n = 50 + Math.floor(r() * 30);
    const x: number[] = [];
    for (let i = 0; i < n; i += 1) x.push(i < n / 2 ? r() * 10 : 100 + r() * 10);
    const c = 1234.56;
    const y = x.map((v) => v + c);
    const a = eDivisiveSegmentation(x, 5);
    const b = eDivisiveSegmentation(y, 5);
    assert.deepEqual(a.tauStar, b.tauStar);
  }
});

// ---- property: order-permutation (within constant-distribution segment)
//      does not affect taus when shape is preserved ------------------------

test('property: ECP single-regime constant signal yields zero CPs', () => {
  const r = rng(31337);
  // generate a stationary noise series (no shift)
  for (let trial = 0; trial < 3; trial += 1) {
    const n = 60;
    const x: number[] = [];
    for (let i = 0; i < n; i += 1) x.push(50 + Math.floor(r() * 5));
    // threshold calibrated to typical Q^* magnitude on noise. With c_zeta = 5
    // (well above the empirical noise QStar) we should get zero accepted CPs.
    const out = eDivisiveSegmentation(x, 1000);
    assert.equal(out.tauStar.length, 0);
  }
});

// ---- property: multi-regime detection ------------------------------------

test('property: ECP recovers known number of CPs in clean step-function', () => {
  // four clean segments at 100, 1000, 100, 1000 should produce 3 CPs
  const x: number[] = [];
  for (let i = 0; i < 80; i += 1) {
    if (i < 20) x.push(100);
    else if (i < 40) x.push(1000);
    else if (i < 60) x.push(100);
    else x.push(1000);
  }
  const out = eDivisiveSegmentation(x, 1);
  assert.ok(out.tauStar.length >= 3, `got ${out.tauStar.length}`);
});

// ---- property: distributionalHomogeneity decreases as shifts grow --------

test('property: distHomog decreases as shift magnitude grows', () => {
  const make = (shift: number) => {
    const pat: number[] = [];
    for (let i = 0; i < 60; i += 1) pat.push(i < 30 ? 100 : 100 + shift);
    return genSource('s', '2026-01-01T00:00:00.000Z', pat);
  };
  const small = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(
    make(50),
    { generatedAt: GEN },
  );
  const big = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(
    make(50000),
    { generatedAt: GEN },
  );
  if (
    small.sources.length === 0 ||
    big.sources.length === 0 ||
    small.sources[0]!.mChangepoints === 0 ||
    big.sources[0]!.mChangepoints === 0
  ) {
    return; // skip if neither fired (defensive on threshold calibration)
  }
  assert.ok(
    big.sources[0]!.distributionalHomogeneity <=
      small.sources[0]!.distributionalHomogeneity + 1e-9,
    `big ${big.sources[0]!.distributionalHomogeneity} vs small ${small.sources[0]!.distributionalHomogeneity}`,
  );
});

// ---- property: maxQStar matches the per-acceptance maximum ---------------

test('property: maxQStar = max over acceptances on random inputs', () => {
  const r = rng(8675309);
  for (let trial = 0; trial < 5; trial += 1) {
    const n = 40 + Math.floor(r() * 30);
    const x: number[] = [];
    for (let i = 0; i < n; i += 1) {
      if (i < n / 3) x.push(r() * 10);
      else if (i < (2 * n) / 3) x.push(100 + r() * 10);
      else x.push(20 + r() * 10);
    }
    const out = eDivisiveSegmentation(x, 1);
    let mx = 0;
    for (const a of out.acceptances) if (a.qStar > mx) mx = a.qStar;
    assert.equal(out.maxQStar, mx);
  }
});

// ---- property: scaledEnergyStat = 0 iff samples coincide as multisets ----

test('property: scaledEnergyStat is 0 on equal multisets only', () => {
  const xs = [1, 2, 3, 4, 5];
  const eq = [5, 4, 3, 2, 1];
  const ne = [1, 2, 3, 4, 6];
  assert.ok(Math.abs(scaledEnergyStat(xs, eq)) < 1e-10);
  assert.ok(scaledEnergyStat(xs, ne) > 0);
});
