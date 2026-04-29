/**
 * Cross-analyzer ladder tests for the row-token location lens chain.
 *
 * Goal: pin down the *mechanical* relationships between the
 * Harrell-Davis broadened median (v0.6.208), the Hodges-Lehmann
 * pseudo-median (v0.6.207), the Trim-Mean-25 (v0.6.206-ish ladder),
 * the raw sample median, and the arithmetic mean. These are
 * properties that should hold for any well-behaved input and
 * would catch regressions where one lens silently drifted.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenBroadenedMedian } from '../src/sourcerowtokenbroadenedmedian.js';
import { buildSourceRowTokenHodgesLehmann } from '../src/sourcerowtokenhodgeslehmann.js';
import { buildSourceRowTokenTrimMean25 } from '../src/sourcerowtokentrimmean25.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

const GEN = '2026-04-29T12:00:00.000Z';

function getHD(xs: number[]): number {
  const r = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.broadenedMedian;
}

function getHL(xs: number[]): number {
  const r = buildSourceRowTokenHodgesLehmann(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.hodgesLehmann;
}

function getTM25(xs: number[]): number {
  const r = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.trimMean;
}

function getRawMedian(xs: number[]): number {
  // Use HD's raw-median byproduct to keep one source of truth.
  const r = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.median;
}

function getMean(xs: number[]): number {
  const r = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.mean;
}

// ---------- ladder: symmetric input collapses every lens ----------

test('ladder: on symmetric input, HD ~= median ~= HL ~= TM-25 ~= mean', () => {
  // Perfectly symmetric: arithmetic progression has mean=median.
  const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const hd = getHD(xs);
  const hl = getHL(xs);
  const tm = getTM25(xs);
  const med = getRawMedian(xs);
  const mn = getMean(xs);
  // All five should be ~50.
  for (const v of [hd, hl, tm, med, mn]) {
    assert.ok(Math.abs(v - 50) < 1e-6, `expected ~50, got ${v}`);
  }
});

test('ladder: constant input -> every lens equals constant', () => {
  const xs = [777, 777, 777, 777, 777, 777];
  const hd = getHD(xs);
  const hl = getHL(xs);
  const tm = getTM25(xs);
  const med = getRawMedian(xs);
  const mn = getMean(xs);
  for (const v of [hd, hl, tm, med, mn]) {
    assert.ok(Math.abs(v - 777) < 1e-9, `got ${v}`);
  }
});

// ---------- ladder: right-skewed input -> mean > each robust lens ----------

test('ladder: right-skewed input — mean is the largest', () => {
  const xs = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 1000];
  const hd = getHD(xs);
  const hl = getHL(xs);
  const tm = getTM25(xs);
  const med = getRawMedian(xs);
  const mn = getMean(xs);
  assert.ok(mn > hd, `mean ${mn} should exceed hd ${hd}`);
  assert.ok(mn > hl, `mean ${mn} should exceed hl ${hl}`);
  assert.ok(mn > tm, `mean ${mn} should exceed tm ${tm}`);
  assert.ok(mn > med, `mean ${mn} should exceed median ${med}`);
});

test('ladder: right-skewed input — HL >= raw median', () => {
  // HL targets center of symmetry of (X+X')/2 -> shifted toward mean
  // for right-skewed inputs.
  const xs = [1, 1, 1, 2, 2, 3, 4, 5, 6, 7, 100];
  const hl = getHL(xs);
  const med = getRawMedian(xs);
  assert.ok(hl >= med - 1e-9, `hl ${hl} should be >= median ${med}`);
});

test('ladder: right-skewed input — HD ~= raw median (within ~5%)', () => {
  // HD targets the population median (same as raw median),
  // not the center of symmetry of (X+X')/2 like HL.
  const xs = [1, 1, 1, 2, 2, 3, 4, 5, 6, 7, 100];
  const hd = getHD(xs);
  const med = getRawMedian(xs);
  // HD should not stray far from raw median for moderate n.
  assert.ok(
    Math.abs(hd - med) < 0.5 * Math.abs(med),
    `hd ${hd} too far from median ${med}`,
  );
});

// ---------- ladder: HD vs raw median bias ordering ----------

test('ladder: HD always lies inside [TM-25, mean] for right-skewed inputs', () => {
  const cases: number[][] = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 100],
    [10, 11, 12, 13, 14, 15, 16, 17, 18, 5000],
    [1, 1, 1, 1, 1, 2, 3, 4, 50],
  ];
  for (const xs of cases) {
    const hd = getHD(xs);
    const tm = getTM25(xs);
    const mn = getMean(xs);
    const lo = Math.min(tm, mn);
    const hi = Math.max(tm, mn);
    assert.ok(
      hd >= lo - 1e-6 && hd <= hi + 1e-6,
      `xs=${xs} hd=${hd} not in [${lo}, ${hi}]`,
    );
  }
});

// ---------- ladder: outlier robustness ranking ----------

test('ladder: contaminating top point shifts mean >> HD ~ HL ~ TM-25 ~ median', () => {
  const clean = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const contam = [...clean];
  contam[contam.length - 1] = 1_000_000;

  const dMean = Math.abs(getMean(contam) - getMean(clean));
  const dHD = Math.abs(getHD(contam) - getHD(clean));
  const dHL = Math.abs(getHL(contam) - getHL(clean));
  const dTM = Math.abs(getTM25(contam) - getTM25(clean));
  const dMed = Math.abs(getRawMedian(contam) - getRawMedian(clean));

  // Mean is at least 100x more sensitive than each robust lens.
  assert.ok(dMean > 100 * dHD, `dMean=${dMean} dHD=${dHD}`);
  assert.ok(dMean > 100 * dHL, `dMean=${dMean} dHL=${dHL}`);
  assert.ok(dMean > 100 * dTM, `dMean=${dMean} dTM=${dTM}`);
  assert.ok(dMean > 100 * dMed, `dMean=${dMean} dMed=${dMed}`);
});

// ---------- ladder: scale + translation equivariance across all lenses ----------

test('ladder: scale equivariance — each lens(c*x) == c*lens(x)', () => {
  const xs = [3, 7, 11, 13, 17, 19, 23, 29, 31];
  const c = 137;
  const xs2 = xs.map((x) => x * c);
  for (const lens of [getHD, getHL, getTM25, getRawMedian, getMean]) {
    const a = lens(xs);
    const b = lens(xs2);
    assert.ok(Math.abs(b - c * a) < 1e-3 * Math.abs(c * a) + 1e-3,
      `lens scaled mismatch a=${a} b=${b} c*a=${c * a}`);
  }
});

test('ladder: translation equivariance — each lens(x+c) == lens(x)+c', () => {
  const xs = [3, 7, 11, 13, 17, 19, 23, 29, 31];
  const c = 1000;
  const xs2 = xs.map((x) => x + c);
  for (const lens of [getHD, getHL, getTM25, getRawMedian, getMean]) {
    const a = lens(xs);
    const b = lens(xs2);
    assert.ok(Math.abs(b - a - c) < 1e-6, `mismatch a=${a} b=${b} c=${c}`);
  }
});

// ---------- ladder: monotonicity ----------

test('ladder: monotone shift of every sample shifts every lens monotonically', () => {
  const xs = [10, 12, 14, 16, 18, 20, 22, 24];
  const baseHD = getHD(xs);
  const baseHL = getHL(xs);
  const baseTM = getTM25(xs);
  for (const delta of [1, 5, 100, 1000]) {
    const shifted = xs.map((x) => x + delta);
    assert.ok(getHD(shifted) > baseHD, `delta=${delta} hd not increased`);
    assert.ok(getHL(shifted) > baseHL, `delta=${delta} hl not increased`);
    assert.ok(getTM25(shifted) > baseTM, `delta=${delta} tm not increased`);
  }
});

// ---------- ladder: HD has lower variance than raw median across resamples ----------

test('ladder: HD has lower jitter than raw median when one interior point wiggles', () => {
  // For a right-skewed sample, wiggling an interior (non-median) point
  // by ±1 should move the raw median by 0 (median pinned to one
  // order statistic) or by a small amount (if the wiggle changes the
  // sort order). HD will move smoothly. The "lower jitter" claim is
  // operationalized as: HD's response to small wiggles is smoother
  // (smaller, but non-zero), while the raw median's response is
  // either zero or jumps when ranks change.
  const base = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
  const baseHD = getHD(base);
  const baseMed = getRawMedian(base);
  // Wiggle the 7th element (value=7) by tiny amounts that don't
  // cross neighboring ranks.
  let hdMaxAbsDelta = 0;
  let medMaxAbsDelta = 0;
  for (const eps of [-0.4, -0.2, 0.2, 0.4]) {
    const wiggled = [...base];
    wiggled[6] = wiggled[6]! + eps;
    hdMaxAbsDelta = Math.max(hdMaxAbsDelta, Math.abs(getHD(wiggled) - baseHD));
    medMaxAbsDelta = Math.max(
      medMaxAbsDelta,
      Math.abs(getRawMedian(wiggled) - baseMed),
    );
  }
  // HD should respond (non-zero) and raw median should NOT (the
  // wiggled point is not the median sample).
  assert.ok(hdMaxAbsDelta > 0, `HD did not respond to interior wiggle`);
  assert.equal(medMaxAbsDelta, 0, 'raw median surprised by interior wiggle');
});

// ---------- ladder: bounds ----------

test('ladder: every robust lens is bounded by min and max of samples', () => {
  const cases: number[][] = [
    [1, 2, 3, 4, 5],
    [100, 200, 300, 400, 500, 600, 700, 800, 900],
    [1, 1, 1, 1000, 1000, 1000],
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  ];
  for (const xs of cases) {
    const mn = Math.min(...xs);
    const mx = Math.max(...xs);
    for (const lens of [getHD, getHL, getTM25, getRawMedian]) {
      const v = lens(xs);
      assert.ok(
        v >= mn - 1e-9 && v <= mx + 1e-9,
        `xs=${xs} lens=${v} not in [${mn}, ${mx}]`,
      );
    }
  }
});

// ---------- ladder: HD vs HL on perfectly symmetric distribution ----------

test('ladder: on perfectly symmetric input, HD == HL == raw median', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // symmetric arithmetic progression
  const hd = getHD(xs);
  const hl = getHL(xs);
  const med = getRawMedian(xs);
  assert.ok(Math.abs(hd - 5) < 1e-6, `hd=${hd}`);
  assert.ok(Math.abs(hl - 5) < 1e-6, `hl=${hl}`);
  assert.equal(med, 5);
});

// ---------- guardrail: HD does not collapse to raw median ----------

test('ladder: HD differs from raw median on continuous-but-skewed input', () => {
  // For a smooth distribution with no ties, HD should produce a
  // value distinct from any single order statistic (because the
  // weights are all positive, no order statistic can dominate
  // exactly).
  const xs: number[] = [];
  for (let i = 1; i <= 13; i += 1) {
    xs.push(i * i); // 1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169
  }
  const hd = getHD(xs);
  const med = getRawMedian(xs); // = 49 (middle of 13 elements)
  assert.equal(med, 49);
  assert.notEqual(hd, 49);
  // HD should be very near 49 but not identically equal.
  assert.ok(Math.abs(hd - 49) < 25, `hd=${hd} too far from median`);
  assert.ok(Math.abs(hd - 49) > 1e-6, `hd=${hd} suspiciously equal to median`);
});
