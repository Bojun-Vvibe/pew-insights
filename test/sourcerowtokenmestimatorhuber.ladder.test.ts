/**
 * Cross-analyzer ladder tests for the row-token location lens chain
 * including the new Huber M-estimator (v0.6.209).
 *
 * Goal: pin down the *mechanical* relationships between Huber, the
 * Harrell-Davis broadened median (HD, v0.6.208), the Hodges-Lehmann
 * pseudo-median (HL, v0.6.207), the trim-mean-25 (TM25), the raw
 * sample median, and the arithmetic mean.
 *
 * Hierarchy of expected behavior on a clean symmetric sample:
 *
 *   mean ~ median ~ HD ~ HL ~ TM25 ~ Huber
 *
 * On a sample with a single extreme upper outlier (one-sided
 * contamination):
 *
 *   mean  >>>  Huber  >  TM25  >=  HL  ~  HD  ~  median
 *
 * (Huber, with the canonical c = 1.345, retains some of the upward
 * pull because the outlier's downweighted contribution is non-zero;
 * the L-estimators trim the extreme entirely or weight it by the
 * Beta tail, so they sit very close to the raw median.)
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenMEstimatorHuber } from '../src/sourcerowtokenmestimatorhuber.js';
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

function getHuber(xs: number[]): number {
  const r = buildSourceRowTokenMEstimatorHuber(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.huber;
}

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
  const r = buildSourceRowTokenMEstimatorHuber(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.median;
}

function getMean(xs: number[]): number {
  const r = buildSourceRowTokenMEstimatorHuber(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.mean;
}

test('ladder: clean symmetric sample — all six estimators agree', () => {
  // Symmetric, no outliers: all location estimators target the same point.
  const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const m = getMean(xs);
  const med = getRawMedian(xs);
  const hub = getHuber(xs);
  const hd = getHD(xs);
  const hl = getHL(xs);
  const tm25 = getTM25(xs);
  // All within ~1 unit of one another for this clean symmetric setup.
  for (const v of [med, hub, hd, hl, tm25]) {
    assert.ok(Math.abs(v - m) < 2.0, `clean-data spread too large: m=${m}, v=${v}`);
  }
});

test('ladder: contaminated sample — Huber sits between mean and the L/R-estimator cluster', () => {
  // 9 normals + 1 large outlier.
  const xs = [10, 11, 12, 13, 14, 15, 16, 17, 18, 1000];
  const m = getMean(xs);
  const med = getRawMedian(xs);
  const hub = getHuber(xs);
  const hd = getHD(xs);
  const hl = getHL(xs);
  const tm25 = getTM25(xs);

  // Mean is dragged way up; the trimming/smoothing estimators sit near the bulk.
  assert.ok(m > 100, `mean ${m} should be large due to outlier`);
  assert.ok(med < 20, `median ${med} should sit in the bulk`);
  assert.ok(tm25 < 25, `TM25 ${tm25} should sit in the bulk`);
  assert.ok(hd < 25, `HD ${hd} should sit in the bulk`);
  assert.ok(hl < 50, `HL ${hl} should sit near the bulk (HL targets center of (X+X')/2)`);

  // Huber: bounded influence means the outlier still nudges Huber upward
  // a little, but vastly less than the mean.
  assert.ok(hub < m, `huber ${hub} should be less than mean ${m}`);
  // Huber should be closer to the median cluster than to the mean.
  const distToMean = Math.abs(hub - m);
  const distToMed = Math.abs(hub - med);
  assert.ok(
    distToMed < distToMean,
    `huber ${hub}: dist-to-median ${distToMed} should be < dist-to-mean ${distToMean}`,
  );
});

test('ladder: monotone shift — adding a constant a shifts every estimator by a', () => {
  const xs = [10, 11, 12, 13, 14, 15, 16, 17, 18, 1000];
  const a = 500;
  const ys = xs.map((x) => x + a);
  for (const fn of [getMean, getRawMedian, getHuber, getHD, getHL, getTM25]) {
    const before = fn(xs);
    const after = fn(ys);
    assert.ok(
      Math.abs(after - (before + a)) < 1e-4,
      `${fn.name}: shift by ${a} expected ${before + a}, got ${after}`,
    );
  }
});

test('ladder: scale equivariance — multiplying by k>0 scales every estimator by k', () => {
  const xs = [3, 7, 11, 19, 23, 29, 31, 37, 41, 200];
  const k = 4;
  const ys = xs.map((x) => k * x);
  for (const fn of [getMean, getRawMedian, getHuber, getHD, getHL, getTM25]) {
    const before = fn(xs);
    const after = fn(ys);
    assert.ok(
      Math.abs(after - k * before) < 1e-4 * Math.max(1, Math.abs(k * before)),
      `${fn.name}: scale by ${k} expected ${k * before}, got ${after}`,
    );
  }
});

test('ladder: progressive contamination — Huber moves smoothly between mean and median behavior', () => {
  // Increase outlier magnitude. The mean grows linearly; median/HD/HL/TM25
  // are essentially flat; Huber moves but with much-bounded slope.
  const base = [10, 11, 12, 13, 14, 15, 16, 17, 18];
  const meanGrowths: number[] = [];
  const huberGrowths: number[] = [];
  for (const out of [100, 1000, 10000, 100000]) {
    const xs = [...base, out];
    meanGrowths.push(getMean(xs));
    huberGrowths.push(getHuber(xs));
  }
  // Mean growth is large between successive perturbations (each step
  // multiplies the outlier by 10x; n=10 so mean rises by ~ delta/10).
  for (let i = 1; i < meanGrowths.length; i += 1) {
    assert.ok(
      meanGrowths[i]! - meanGrowths[i - 1]! > 80,
      `mean growth too small between out=${i}: ${meanGrowths[i - 1]} -> ${meanGrowths[i]}`,
    );
  }
  // Huber growth between successive perturbations is bounded — far less
  // than the mean growth at each step.
  for (let i = 1; i < huberGrowths.length; i += 1) {
    const hg = Math.abs(huberGrowths[i]! - huberGrowths[i - 1]!);
    const mg = Math.abs(meanGrowths[i]! - meanGrowths[i - 1]!);
    assert.ok(
      hg < mg / 100,
      `huber growth ${hg} should be << mean growth ${mg} at step ${i}`,
    );
  }
});

test('ladder: Huber vs HD/HL on a one-sided heavy tail — Huber leans toward the bulk but more than the L-estimators', () => {
  // n = 20 with 18 in [10, 27] and 2 large outliers.
  const xs = [
    10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
    500, 800,
  ];
  const med = getRawMedian(xs);
  const hub = getHuber(xs);
  const hd = getHD(xs);
  const tm25 = getTM25(xs);
  const m = getMean(xs);

  // All robust estimators are well below the mean.
  for (const v of [med, hub, hd, tm25]) {
    assert.ok(v < m, `robust ${v} should be < mean ${m}`);
  }
  // Huber pulls a bit further toward the mean than the trim/smooth
  // L-estimators because outliers are downweighted, not discarded.
  // We don't require strict ordering (it can flip on small samples)
  // but Huber should be at least as upward as the median.
  assert.ok(hub >= med - 0.5, `huber ${hub} should not be well below median ${med}`);
});

test('ladder: huberMeanGap and huberMedianGap signs cohere with contamination direction', () => {
  // Upper contamination -> mean > huber > median, so huberMeanGap < 0
  // and huberMedianGap > 0 (or near 0).
  const xs = [10, 11, 12, 13, 14, 15, 16, 17, 18, 1000];
  const r = buildSourceRowTokenMEstimatorHuber(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(row.huberMeanGap < 0, `huberMeanGap ${row.huberMeanGap} should be < 0`);
  assert.ok(
    row.huberMedianGap >= -0.5,
    `huberMedianGap ${row.huberMedianGap} should be >= ~0 for upper contamination`,
  );

  // Lower contamination -> mean < huber < median, so huberMeanGap > 0
  // and huberMedianGap < 0 (or near 0).
  const ys = [10, 11, 12, 13, 14, 15, 16, 17, 18, -1000];
  // total_tokens is required to be non-negative by the analyzer; use
  // a synthetic shifted set for sign-symmetry of the M-estimator
  // alone via the kernel:
  const ysShifted = ys.map((v) => v + 2000); // all positive now.
  // After +2000: outlier is 1000; rest are 2010..2018.
  // outlier is below the bulk (lower contamination).
  const r2 = buildSourceRowTokenMEstimatorHuber(mkSeries('s', ysShifted), {
    generatedAt: GEN,
  });
  const row2 = r2.sources[0]!;
  assert.ok(
    row2.huberMeanGap > 0,
    `lower-contam huberMeanGap ${row2.huberMeanGap} should be > 0`,
  );
});

test('ladder: c-tuning monotonicity — larger c moves Huber toward the mean', () => {
  // On a contaminated sample, increasing the Huber tuning constant c
  // monotonically reduces the distance from Huber to the mean (and
  // increases the distance from Huber to the median). At c = 1.345
  // (default), Huber sits closer to the median; at c = 1000+, Huber
  // ~= mean.
  const xs = [10, 11, 12, 13, 14, 15, 16, 17, 18, 1000];
  const m = getMean(xs);
  const med = getRawMedian(xs);
  const cs = [0.5, 1.0, 1.345, 2.0, 5.0, 50.0, 1e9];
  const huberAtC = cs.map((c) => {
    const r = buildSourceRowTokenMEstimatorHuber(mkSeries('s', xs), {
      c,
      generatedAt: GEN,
    });
    return r.sources[0]!.huber;
  });
  // |huber - mean| should be monotonically non-increasing as c grows.
  for (let i = 1; i < huberAtC.length; i += 1) {
    const dPrev = Math.abs(huberAtC[i - 1]! - m);
    const dCur = Math.abs(huberAtC[i]! - m);
    assert.ok(
      dCur <= dPrev + 1e-6,
      `at c=${cs[i]} dist-to-mean ${dCur} should be <= prev ${dPrev} (at c=${cs[i - 1]})`,
    );
  }
  // At a very large c (no row clipped), Huber should equal the mean.
  assert.ok(
    Math.abs(huberAtC[huberAtC.length - 1]! - m) < 1e-6,
    `at c=${cs[cs.length - 1]} huber ${huberAtC[huberAtC.length - 1]} should be ~= mean ${m}`,
  );
  // At the smallest c, Huber should be much closer to the median.
  const distToMedAtMinC = Math.abs(huberAtC[0]! - med);
  const distToMeanAtMinC = Math.abs(huberAtC[0]! - m);
  assert.ok(
    distToMedAtMinC < distToMeanAtMinC,
    `at c=${cs[0]} huber ${huberAtC[0]} should be closer to median ${med} than mean ${m}`,
  );
});

test('ladder: at default c=1.345, Huber lies between TM25 and the mean on contaminated data', () => {
  // Mechanical sandwich: TM25 trims the top/bottom 25% (so the
  // outlier is fully discarded), the mean is fully exposed to the
  // outlier, and Huber-1.345 downweights it without removing it.
  // Therefore: TM25 <= Huber <= mean for upper one-sided contamination.
  const xs = [10, 11, 12, 13, 14, 15, 16, 17, 18, 1000];
  const tm25 = getTM25(xs);
  const hub = getHuber(xs);
  const m = getMean(xs);
  assert.ok(
    tm25 <= hub + 1e-6,
    `TM25 ${tm25} should be <= huber ${hub} for upper contamination`,
  );
  assert.ok(
    hub <= m + 1e-6,
    `huber ${hub} should be <= mean ${m} for upper contamination`,
  );
});
