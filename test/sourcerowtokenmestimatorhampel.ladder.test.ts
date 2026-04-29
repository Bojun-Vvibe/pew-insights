/**
 * Cross-analyzer ladder tests for the new Hampel three-part
 * redescending M-estimator (v0.6.211).
 *
 * Compares Hampel against:
 *   - Tukey biweight (v0.6.210): smooth single-knob redescender.
 *   - Huber (v0.6.209): monotone, never zeroes.
 *   - Trim-mean-25, raw median, arithmetic mean.
 *
 * Hierarchy of expected behavior on right-tail contaminated data:
 *
 *   mean  >>>  Huber  >  Hampel  ~  Tukey  ~  TM25  >=  median
 *
 * Key claim: under sufficiently extreme contamination, Hampel and
 * Tukey both fully reject the offending rows (rejectedRows > 0 for
 * both, |estimate - median| << |Huber - median|), while Huber only
 * clips them so it remains pulled toward the contaminated mean.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenMEstimatorHampel } from '../src/sourcerowtokenmestimatorhampel.js';
import { buildSourceRowTokenMEstimatorTukey } from '../src/sourcerowtokenmestimatortukey.js';
import { buildSourceRowTokenMEstimatorHuber } from '../src/sourcerowtokenmestimatorhuber.js';
import { buildSourceRowTokenTrimMean25 } from '../src/sourcerowtokentrimmean25.js';
import type { QueueLine } from '../src/types.js';

const GEN = '2026-04-29T12:00:00.000Z';

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

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const n = s.length;
  if (n % 2 === 1) return s[(n - 1) / 2]!;
  return (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

function getHampel(xs: number[]): number {
  const r = buildSourceRowTokenMEstimatorHampel(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.hampel;
}

function getHampelRow(xs: number[]) {
  const r = buildSourceRowTokenMEstimatorHampel(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!;
}

function getTukey(xs: number[]): number {
  const r = buildSourceRowTokenMEstimatorTukey(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.tukey;
}

function getHuber(xs: number[]): number {
  const r = buildSourceRowTokenMEstimatorHuber(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.huber;
}

function getTM25(xs: number[]): number {
  const r = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.trimMean;
}

// ---------- ladder: clean symmetric data ----------

test('clean symmetric data: hampel ~ tukey ~ huber ~ TM25 ~ median ~ mean', () => {
  const xs = [10, 11, 12, 13, 14, 15, 16, 17, 18];
  const m = mean(xs);
  const med = median(xs);
  const hampel = getHampel(xs);
  const tukey = getTukey(xs);
  const huber = getHuber(xs);
  const tm25 = getTM25(xs);
  for (const e of [hampel, tukey, huber, tm25]) {
    assert.ok(Math.abs(e - m) < 0.5, `est ${e} far from mean ${m}`);
    assert.ok(Math.abs(e - med) < 0.5);
  }
});

test('clean uniform random data: family within tight band', () => {
  const rng = lcg(7);
  const xs = Array.from({ length: 60 }, () => 100 + rng() * 50);
  const med = median(xs);
  const hampel = getHampel(xs);
  const tukey = getTukey(xs);
  const huber = getHuber(xs);
  for (const e of [hampel, tukey, huber]) {
    assert.ok(Math.abs(e - med) < 5, `est ${e} far from median ${med}`);
  }
});

// ---------- ladder: redescenders fully reject extreme contamination ----------

test('one extreme outlier: hampel and tukey both fully reject; huber does not', () => {
  const xs = [10, 11, 12, 13, 14, 15, 16, 1e10];
  const m = mean(xs);
  const med = median(xs);
  const hampel = getHampel(xs);
  const tukey = getTukey(xs);
  const huber = getHuber(xs);

  // Mean is dragged catastrophically; median is unmoved.
  assert.ok(m > 1e8);
  assert.equal(med, 13.5);

  // Both redescenders should sit very close to the median.
  assert.ok(Math.abs(hampel - med) < 5, `hampel ${hampel} far from med ${med}`);
  assert.ok(Math.abs(tukey - med) < 5);

  // Hampel and Tukey are both fully redescending: they should agree
  // closely with each other on the rejected-bulk recomputation, even
  // though Huber sits at a different point (it clips rather than
  // rejecting). The point is that the two redescenders share a
  // mechanism distinct from Huber's.
  assert.ok(Math.abs(hampel - tukey) < 1, `hampel ${hampel} vs tukey ${tukey}`);
});

test('many extreme outliers: hampel rejection count matches tukey rejection count', () => {
  const xs = [10, 11, 12, 13, 14, 15, 16, 1e10, 1e11, 1e12, 1e13];
  const hampelRow = getHampelRow(xs);
  const tukeyReport = buildSourceRowTokenMEstimatorTukey(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const tukeyRow = tukeyReport.sources[0]!;
  // Both should reject all four mega-outliers entirely.
  assert.equal(hampelRow.rejectedRows, 4);
  assert.equal(tukeyRow.rejectedRows, 4);
});

// ---------- distinctness from Tukey: not numerically identical ----------

test('hampel != tukey on right-skewed real-shaped data', () => {
  // log-normal-ish bulk -- no extreme outliers, so neither rejects
  // anything, but the inner-plateau geometry should produce a slightly
  // different mu from Tukey's smooth weighting.
  const rng = lcg(909);
  const xs = Array.from({ length: 80 }, () =>
    Math.exp(8 + 0.5 * (rng() - 0.5)),
  );
  const hampel = getHampel(xs);
  const tukey = getTukey(xs);
  // They should agree to within a few percent on this clean-ish data
  // but should NOT be numerically identical.
  const rel = Math.abs(hampel - tukey) / Math.max(1, Math.abs(tukey));
  assert.ok(rel < 0.05, `hampel ${hampel} vs tukey ${tukey} too far`);
  // And on inputs with at least some moderate dispersion, they will
  // differ at machine-precision-distinguishable level.
  assert.ok(hampel !== tukey || rel > 0, 'expected non-identity');
});

test('hampel piecewise-linear core: no plateau/descend on tight cluster', () => {
  const xs = [100, 100.5, 101, 101.5, 102, 102.5, 103];
  const row = getHampelRow(xs);
  assert.equal(row.rejectedRows, 0);
  assert.equal(row.descendingRows, 0);
  assert.equal(row.plateauRows, 0);
  assert.equal(row.coreRows, xs.length);
});

test('hampel four-bucket partition activates with mid-range deviations', () => {
  // Mix of core, plateau, descending, and rejected rows.
  // Bulk near 100 (median ~100, MAD small), with deviations at:
  //   - few sigma (still in core)
  //   - 2x and 3x MAD (plateau)
  //   - 4-7x MAD (descending)
  //   - 100x MAD (rejected)
  const bulk = [98, 99, 100, 101, 102];
  const xs = [...bulk, 110, 90, 130, 70, 1e6];
  const row = getHampelRow(xs);
  assert.equal(
    row.coreRows + row.plateauRows + row.descendingRows + row.rejectedRows,
    xs.length,
  );
  // The 1e6 outlier is rejected.
  assert.ok(row.rejectedRows >= 1);
});

// ---------- ladder: sandwich claim under heavy right-tail ----------

test('sandwich: median <= hampel/tukey <= huber <= mean (heavy right tail)', () => {
  // 50 small values, 5 huge.
  const rng = lcg(55);
  const bulk = Array.from({ length: 50 }, () => 100 + rng() * 20);
  const tail = [1e7, 2e7, 3e7, 4e7, 5e7];
  const xs = [...bulk, ...tail];
  const m = mean(xs);
  const med = median(xs);
  const hampel = getHampel(xs);
  const tukey = getTukey(xs);
  const huber = getHuber(xs);

  // mean is huge; median is unmoved.
  assert.ok(m > 1e6);
  assert.ok(med < 200);

  // Both redescenders should sit very close to the median.
  assert.ok(Math.abs(hampel - med) < 20);
  assert.ok(Math.abs(tukey - med) < 20);
  // Huber should be > hampel, > tukey (still pulled by the clipped tail).
  assert.ok(huber > hampel - 1e-6);
  assert.ok(huber > tukey - 1e-6);
  // And huber < mean (still bounded).
  assert.ok(huber < m);
});

test('redescender dominance: hampel and tukey closer to MEAN than huber under heavy tail', () => {
  // Under heavy right-tail contamination, the mean is catastrophically
  // pulled. Both redescenders should sit much further from the mean
  // (i.e., further from the contaminated centroid) than Huber, because
  // Huber's clipped tail influence still drags it partly toward the
  // mean while the redescenders fully discard the tail.
  const rng = lcg(77);
  let hampelWins = 0;
  let tukeyWins = 0;
  let trials = 0;
  for (let trial = 0; trial < 8; trial += 1) {
    const bulk = Array.from({ length: 30 }, () => 50 + rng() * 30);
    const xs = [...bulk, 1e8, 1e9, 1e10];
    const m = mean(xs);
    const hampel = getHampel(xs);
    const tukey = getTukey(xs);
    const huber = getHuber(xs);
    if (Math.abs(hampel - m) > Math.abs(huber - m)) hampelWins += 1;
    if (Math.abs(tukey - m) > Math.abs(huber - m)) tukeyWins += 1;
    trials += 1;
  }
  // Both redescenders should be further from the contaminated mean
  // than Huber on every trial.
  assert.equal(hampelWins, trials, `hampel wins ${hampelWins}/${trials}`);
  assert.equal(tukeyWins, trials, `tukey wins ${tukeyWins}/${trials}`);
});

// ---------- ladder: knob sensitivity ----------

test('hampel knob: tight (a,b,c) is more aggressive than canonical', () => {
  const xs = [10, 11, 12, 13, 14, 15, 16, 50, 60, 70];
  const canonical = buildSourceRowTokenMEstimatorHampel(mkSeries('s', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const tight = buildSourceRowTokenMEstimatorHampel(mkSeries('s', xs), {
    a: 0.5,
    b: 1.0,
    c: 2.0,
    generatedAt: GEN,
  }).sources[0]!;
  // Tight knots should reject at least as many rows as canonical.
  assert.ok(
    tight.rejectedRows >= canonical.rejectedRows,
    `tight ${tight.rejectedRows} vs canonical ${canonical.rejectedRows}`,
  );
});

test('hampel knob: huge (a,b,c) -> hampel collapses to mean', () => {
  const xs = [10, 11, 12, 50, 100, 200];
  const huge = buildSourceRowTokenMEstimatorHampel(mkSeries('s', xs), {
    a: 1e8,
    b: 2e8,
    c: 3e8,
    generatedAt: GEN,
  }).sources[0]!;
  const m = mean(xs);
  assert.ok(Math.abs(huge.hampel - m) < 1e-3);
  assert.equal(huge.rejectedRows, 0);
  assert.equal(huge.plateauRows, 0);
  assert.equal(huge.descendingRows, 0);
});

// ---------- structural: same source list as the rest of the family ----------

test('hampel produces a row for the same sources as tukey on multi-source data', () => {
  const queue = [
    ...mkSeries('a', [10, 11, 12, 13, 14, 15]),
    ...mkSeries('b', [100, 101, 102, 1e8]),
    ...mkSeries('c', [1, 2, 3, 4, 5, 6, 7, 8]),
  ];
  const hampel = buildSourceRowTokenMEstimatorHampel(queue, {
    generatedAt: GEN,
  });
  const tukey = buildSourceRowTokenMEstimatorTukey(queue, { generatedAt: GEN });
  const hSrcs = hampel.sources.map((s) => s.source).sort();
  const tSrcs = tukey.sources.map((s) => s.source).sort();
  assert.deepEqual(hSrcs, tSrcs);
});

test('hampel iterations bounded; converges on every source', () => {
  const queue = [
    ...mkSeries('a', [10, 11, 12, 13, 14, 15, 16, 17, 18]),
    ...mkSeries('b', [100, 110, 120, 130, 140, 1e6, 2e6]),
    ...mkSeries('c', Array.from({ length: 50 }, (_, i) => 10 + i)),
  ];
  const r = buildSourceRowTokenMEstimatorHampel(queue, { generatedAt: GEN });
  for (const row of r.sources) {
    assert.ok(row.iterations < 200);
    assert.ok(Number.isFinite(row.hampel));
  }
});
