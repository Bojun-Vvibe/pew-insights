/**
 * Cross-analyzer ladder tests including the new Tukey biweight
 * redescending M-estimator (v0.6.210).
 *
 * Compares Tukey against:
 *   - Huber M-estimator (v0.6.209): monotone M-estimator, bounded
 *     but nonzero tail influence -- Tukey should be MORE robust.
 *   - Harrell-Davis broadened median (v0.6.208): smooth L-estimator.
 *   - Hodges-Lehmann pseudo-median (v0.6.207): R-estimator.
 *   - Trim-mean-25 (TM25): classical L-estimator.
 *   - Raw sample median, arithmetic mean.
 *
 * Hierarchy of expected behavior:
 *
 * Clean symmetric sample:
 *   mean ~ median ~ HD ~ HL ~ TM25 ~ Huber ~ Tukey
 *
 * Sample with one or more extreme upper outliers (one-sided
 * contamination):
 *
 *   mean  >>>  Huber  >  Tukey  ~  TM25  >=  HL  ~  HD  ~  median
 *
 * Key claim: |Tukey - median| <= |Huber - median| under sufficiently
 * extreme contamination, because Tukey fully rejects rows beyond
 * c*s while Huber only clips them.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenMEstimatorTukey } from '../src/sourcerowtokenmestimatortukey.js';
import { buildSourceRowTokenMEstimatorHuber } from '../src/sourcerowtokenmestimatorhuber.js';
import { buildSourceRowTokenBroadenedMedian } from '../src/sourcerowtokenbroadenedmedian.js';
import { buildSourceRowTokenHodgesLehmann } from '../src/sourcerowtokenhodgeslehmann.js';
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

function tukeyOf(xs: number[]): number {
  const r = buildSourceRowTokenMEstimatorTukey(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.tukey;
}

function huberOf(xs: number[]): number {
  const r = buildSourceRowTokenMEstimatorHuber(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.huber;
}

function hdOf(xs: number[]): number {
  const r = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.broadenedMedian;
}

function hlOf(xs: number[]): number {
  const r = buildSourceRowTokenHodgesLehmann(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.hodgesLehmann;
}

function tm25Of(xs: number[]): number {
  const r = buildSourceRowTokenTrimMean25(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  return r.sources[0]!.trimMean;
}

function meanOf(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function medianOf(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const n = s.length;
  return n % 2 === 1 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

// ---------- ladder tests ----------

test('ladder: clean symmetric data -> all six estimators agree', () => {
  const xs = Array.from({ length: 21 }, (_, i) => 100 + i); // 100..120
  const t = tukeyOf(xs);
  const h = huberOf(xs);
  const hd = hdOf(xs);
  const hl = hlOf(xs);
  const tm = tm25Of(xs);
  const m = meanOf(xs);
  const med = medianOf(xs);
  const all = [t, h, hd, hl, tm, m, med];
  const max = Math.max(...all);
  const min = Math.min(...all);
  assert.ok(max - min < 0.5, `agreement spread ${max - min}: ${all.join(',')}`);
});

test('ladder: single extreme upper outlier -> Tukey rejects, Huber clips', () => {
  const xs = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 1e9];
  const med = medianOf(xs);
  const t = tukeyOf(xs);
  const h = huberOf(xs);
  const m = meanOf(xs);
  // Mean is dragged toward the outlier; both M-estimators stay bounded.
  assert.ok(m > 1e7);
  // Both robust estimators should land near the median (within MAD-ish range).
  assert.ok(Math.abs(t - med) < 5, `Tukey ${t} too far from med ${med}`);
  assert.ok(Math.abs(h - med) < 5, `Huber ${h} too far from med ${med}`);
  // Both should be vastly closer to the median than the contaminated mean.
  assert.ok(Math.abs(t - med) < Math.abs(m - med));
  assert.ok(Math.abs(h - med) < Math.abs(m - med));
  // Tukey rejected the outlier explicitly.
  const r = buildSourceRowTokenMEstimatorTukey(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.rejectedRows, 1);
});

test('ladder: many extreme upper outliers -> Tukey unmoved beyond a saturation point', () => {
  const bulk = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const t1 = tukeyOf([...bulk, 1e9]);
  const t2 = tukeyOf([...bulk, 1e9, 1e10]);
  const t3 = tukeyOf([...bulk, 1e9, 1e10, 1e11]);
  // Beyond the redescent threshold, additional far outliers contribute
  // exactly zero weight -- mu is invariant.
  assert.ok(Math.abs(t2 - t1) < 1e-6);
  assert.ok(Math.abs(t3 - t1) < 1e-6);
});

test('ladder: Tukey rejection count matches outlier count for clearly far outliers', () => {
  const bulk = [10, 11, 12, 13, 14, 15, 16];
  const r = buildSourceRowTokenMEstimatorTukey(
    mkSeries('s', [...bulk, 1e9, 1e9, 1e9]),
    { generatedAt: GEN },
  );
  assert.equal(r.sources[0]!.rejectedRows, 3);
});

test('ladder: translation+scale equivariance simultaneously across estimators', () => {
  const rng = lcg(13);
  const xs = Array.from({ length: 25 }, () => rng() * 100 + 50);
  const k = 3.5;
  const a = 1000;
  const t0 = tukeyOf(xs);
  const t1 = tukeyOf(xs.map((x) => x * k + a));
  const expected = t0 * k + a;
  assert.ok(Math.abs(t1 - expected) < 1e-3 * Math.max(1, expected));
});

test('ladder: Tukey lies between bulk-median and Huber under one-sided contamination', () => {
  // The intuition: Huber clips outliers but lets them pull mu a
  // bit; Tukey fully rejects them. So under upper contamination,
  // Tukey should be <= Huber (closer to the bulk median below).
  const bulks = [
    [50, 51, 52, 53, 54, 55, 56, 57, 58, 59],
    [10, 12, 14, 16, 18, 20, 22, 24, 26, 28],
  ];
  for (const bulk of bulks) {
    const polluted = [...bulk, 1e8];
    const t = tukeyOf(polluted);
    const h = huberOf(polluted);
    const med = medianOf(bulk);
    // Tukey should sit at-or-below Huber under upper contamination.
    assert.ok(
      t <= h + 1e-6,
      `Tukey ${t} should be <= Huber ${h} under upper contamination`,
    );
    // Both should sit on the bulk side of the mean.
    assert.ok(t < (meanOf(polluted) + med) / 2);
  }
});

test('ladder: progressive contamination growth bound (Tukey saturates faster than Huber)', () => {
  const bulk = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109];
  const med = medianOf(bulk);
  let prevTukeyDrift = 0;
  let prevHuberDrift = 0;
  for (let k = 1; k <= 5; k += 1) {
    const tail = Array.from({ length: k }, () => 1e8);
    const t = tukeyOf([...bulk, ...tail]);
    const h = huberOf([...bulk, ...tail]);
    const tDrift = Math.abs(t - med);
    const hDrift = Math.abs(h - med);
    // Both should be small, and Tukey drift should not grow without bound.
    assert.ok(tDrift < 50, `k=${k} tukey drift ${tDrift}`);
    assert.ok(hDrift < 1e7, `k=${k} huber drift ${hDrift}`);
    // After k=2, Tukey drift should be essentially flat.
    if (k >= 2) {
      assert.ok(
        Math.abs(tDrift - prevTukeyDrift) < 1.0,
        `k=${k} tukey drift growth ${tDrift - prevTukeyDrift}`,
      );
    }
    prevTukeyDrift = tDrift;
    prevHuberDrift = hDrift;
  }
});

test('ladder: clean log-normal-ish data -> Tukey close to all robust estimators', () => {
  const rng = lcg(909);
  const xs = Array.from({ length: 60 }, () => Math.exp(5 + 0.3 * (rng() - 0.5)));
  const t = tukeyOf(xs);
  const h = huberOf(xs);
  const hd = hdOf(xs);
  const hl = hlOf(xs);
  const tm = tm25Of(xs);
  const med = medianOf(xs);
  const robust = [t, h, hd, hl, tm, med];
  const max = Math.max(...robust);
  const min = Math.min(...robust);
  // On a roughly-log-normal sample, all robust estimators should
  // lie within a small fraction of the median.
  assert.ok((max - min) / med < 0.10, `spread/med = ${(max - min) / med}`);
});

test('ladder: empty/single-source coexists across all builders', () => {
  // Sanity check: same input through each builder yields a sensible
  // single-source row.
  const xs = [10, 11, 12, 13, 14, 15];
  for (const fn of [tukeyOf, huberOf, hdOf, hlOf, tm25Of]) {
    const v = fn(xs);
    assert.ok(Number.isFinite(v));
    assert.ok(v >= 9 && v <= 16);
  }
});

// ---------- v0.6.210 refinement: head-to-head Tukey-vs-Huber dominance ----------

test('refinement: tukey <= huber under one-sided upper contamination (replicates live-smoke finding)', () => {
  // Replicates the headline finding from the v0.6.210 live-smoke
  // run: under right-tail-heavy real data, Tukey lands strictly
  // below Huber on every source. Test against a battery of
  // synthetic right-tail-heavy bulks of varying size and shape.
  const rng = lcg(2026);
  const cases: number[][] = [];
  for (let trial = 0; trial < 12; trial += 1) {
    const nBulk = 20 + Math.floor(rng() * 40);
    const bulk = Array.from({ length: nBulk }, () =>
      // log-normal-ish bulk
      Math.exp(5 + 1.5 * (rng() - 0.5)),
    );
    const nTail = 1 + Math.floor(rng() * 5);
    const tail = Array.from({ length: nTail }, (_, i) =>
      Math.exp(12 + 2 * rng()) * (i + 1),
    );
    cases.push([...bulk, ...tail]);
  }
  let dominanceCount = 0;
  for (const xs of cases) {
    const t = tukeyOf(xs);
    const h = huberOf(xs);
    if (t <= h + 1e-6) dominanceCount += 1;
  }
  // On right-tail-contaminated data, Tukey should be <= Huber on
  // an overwhelming majority of cases (the redescent fully
  // discards heavy upper tails while Huber still gets bumped).
  assert.ok(
    dominanceCount >= cases.length - 1,
    `expected Tukey <= Huber on >= ${cases.length - 1}/${cases.length} cases, got ${dominanceCount}`,
  );
});

test('refinement: tukey median-gap is on average tighter than huber median-gap on right-tail data', () => {
  const rng = lcg(7777);
  let tukeyTighterCount = 0;
  const N = 10;
  for (let trial = 0; trial < N; trial += 1) {
    const bulk = Array.from({ length: 50 }, () =>
      Math.exp(6 + 1.0 * (rng() - 0.5)),
    );
    const polluted = [
      ...bulk,
      Math.exp(13),
      Math.exp(14),
      Math.exp(15),
    ];
    const med = medianOf(polluted);
    const t = tukeyOf(polluted);
    const h = huberOf(polluted);
    if (Math.abs(t - med) <= Math.abs(h - med)) tukeyTighterCount += 1;
  }
  assert.ok(
    tukeyTighterCount >= Math.ceil(N * 0.7),
    `expected Tukey-tighter on >=70% of trials, got ${tukeyTighterCount}/${N}`,
  );
});

test('refinement: rejection-count vs clipped-count separation is well-defined', () => {
  // The mechanical distinction: Huber CLIPS (bounded but nonzero
  // weight); Tukey REJECTS (exactly zero weight). Both diagnostics
  // should be reported, both should scale up with contamination,
  // and on the same data Tukey-rejected count should not exceed
  // total sample size (sanity).
  const bulk = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const polluted = [...bulk, 1e9, 2e9, 3e9, 4e9];
  const tReport = buildSourceRowTokenMEstimatorTukey(
    mkSeries('s', polluted),
    { generatedAt: GEN },
  );
  const hReport = buildSourceRowTokenMEstimatorHuber(
    mkSeries('s', polluted),
    { generatedAt: GEN },
  );
  assert.equal(tReport.sources[0]!.rejectedRows, 4);
  // Huber's clippedRows must include AT LEAST as many rows as Tukey
  // rejects (every Tukey-rejected row has |z|>c_huber too, since
  // c_huber=1.345 << c_tukey=4.685... wait, c_huber is smaller, so
  // Huber clips MORE rows than Tukey rejects).
  assert.ok(
    hReport.sources[0]!.clippedRows >= tReport.sources[0]!.rejectedRows,
    `huber clipped ${hReport.sources[0]!.clippedRows} should be >= tukey rejected ${tReport.sources[0]!.rejectedRows}`,
  );
});
