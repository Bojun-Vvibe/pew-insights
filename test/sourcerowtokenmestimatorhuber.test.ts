/**
 * Unit + property tests for source-row-token-m-estimator-huber.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenMEstimatorHuber,
  huberMEstimator,
} from '../src/sourcerowtokenmestimatorhuber.js';
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

const GEN = '2026-04-29T12:00:00.000Z';

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
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

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- shape / option validation ----------

test('huber: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenMEstimatorHuber([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 4);
  assert.equal(r.minHuber, 0);
  assert.equal(r.c, 1.345);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'huber-desc');
  assert.equal(r.generatedAt, GEN);
});

test('huber: minRows below absolute floor 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenMEstimatorHuber([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('huber: non-integer minRows throws', () => {
  assert.throws(
    () => buildSourceRowTokenMEstimatorHuber([], { minRows: 4.5 }),
    /minRows must be an integer/,
  );
});

test('huber: negative minHuber throws', () => {
  assert.throws(
    () => buildSourceRowTokenMEstimatorHuber([], { minHuber: -1 }),
    /minHuber must be a finite, non-negative number/,
  );
});

test('huber: NaN minHuber throws', () => {
  assert.throws(
    () => buildSourceRowTokenMEstimatorHuber([], { minHuber: Number.NaN }),
    /minHuber must be a finite/,
  );
});

test('huber: non-positive c throws', () => {
  assert.throws(
    () => buildSourceRowTokenMEstimatorHuber([], { c: 0 }),
    /c must be a finite positive number/,
  );
  assert.throws(
    () => buildSourceRowTokenMEstimatorHuber([], { c: -1 }),
    /c must be a finite positive number/,
  );
  assert.throws(
    () => buildSourceRowTokenMEstimatorHuber([], { c: Number.NaN }),
    /c must be a finite positive number/,
  );
});

test('huber: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenMEstimatorHuber([], {
        sort: 'oops' as never,
      }),
    /sort must be one of/,
  );
});

test('huber: invalid top throws', () => {
  assert.throws(
    () => buildSourceRowTokenMEstimatorHuber([], { top: 0 }),
    /top must be a positive integer/,
  );
  assert.throws(
    () => buildSourceRowTokenMEstimatorHuber([], { top: 1.5 }),
    /top must be a positive integer/,
  );
});

test('huber: invalid since/until throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenMEstimatorHuber([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenMEstimatorHuber([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

// ---------- raw kernel: huberMEstimator ----------

test('huberMEstimator: empty -> NaN', () => {
  const { mu, iterations } = huberMEstimator([]);
  assert.ok(Number.isNaN(mu));
  assert.equal(iterations, 0);
});

test('huberMEstimator: singleton -> the value, no iterations', () => {
  const { mu, iterations, clippedRows, mad, scale } = huberMEstimator([42]);
  assert.equal(mu, 42);
  assert.equal(iterations, 0);
  assert.equal(clippedRows, 0);
  assert.equal(mad, 0);
  assert.equal(scale, 0);
});

test('huberMEstimator: all rows equal -> the common value', () => {
  const { mu, clippedRows } = huberMEstimator([7, 7, 7, 7, 7]);
  assert.equal(mu, 7);
  assert.equal(clippedRows, 0);
});

test('huberMEstimator: no outliers, symmetric -> matches mean', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const { mu } = huberMEstimator(xs);
  // Symmetric: median = mean = 5; Huber should equal both.
  assert.ok(Math.abs(mu - 5) < 1e-9, `expected ~5, got ${mu}`);
});

test('huberMEstimator: extreme outlier -> moves toward median', () => {
  // Clean data: 1..9 (mean 5, median 5). Add a giant outlier.
  const clean = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const dirty = [...clean, 1_000_000];
  const m = mean(dirty);
  const med = median(dirty);
  const { mu, clippedRows } = huberMEstimator(dirty);
  // mean is dragged way up by the outlier; median barely moves.
  assert.ok(m > 100_000);
  assert.ok(Math.abs(med - 5.5) < 1e-9);
  // Huber should sit much closer to the median than to the mean.
  assert.ok(
    Math.abs(mu - med) < Math.abs(mu - m),
    `huber ${mu} should be closer to median ${med} than to mean ${m}`,
  );
  // The outlier should be clipped.
  assert.ok(clippedRows >= 1, `expected outlier to be clipped, got ${clippedRows}`);
});

test('huberMEstimator: contaminated sample sits between mean and median', () => {
  // Asymmetric contamination: 9 normals + 1 large.
  const xs = [10, 11, 12, 13, 14, 15, 16, 17, 18, 1000];
  const m = mean(xs);
  const med = median(xs);
  const { mu } = huberMEstimator(xs);
  // The mean is dragged way above the bulk; median sits in the bulk.
  assert.ok(m > med + 50);
  // Huber should be between or at most a hair past median (toward mean).
  // We only require that huber is below the mean and not catastrophically
  // far below the median (it can't be more pessimistic than the median by
  // a wide margin since the contamination is one-sided positive).
  assert.ok(mu < m - 50, `huber ${mu} should be well below mean ${m}`);
  // Bound: huber cannot be below median - small slack (it can dip slightly
  // below if MAD spans the upper half, but for this construction MAD = 3
  // and Huber pulls upward toward the bulk).
  assert.ok(mu >= med - 1, `huber ${mu} should not fall well below median ${med}`);
});

// ---------- equivariance properties ----------

test('huber property: translation equivariance', () => {
  const xs = [1, 4, 9, 16, 25, 36, 49];
  const { mu: mu0 } = huberMEstimator(xs);
  for (const a of [-100, -1, 0.5, 7, 1000]) {
    const { mu } = huberMEstimator(xs.map((x) => x + a));
    // huber(x + a) = huber(x) + a (within a tiny IRLS slack).
    assert.ok(
      Math.abs(mu - (mu0 + a)) < 1e-7,
      `translation by ${a}: expected ${mu0 + a}, got ${mu}`,
    );
  }
});

test('huber property: scale equivariance for k > 0', () => {
  const xs = [3, 7, 11, 19, 23, 29, 31, 37];
  const { mu: mu0 } = huberMEstimator(xs);
  for (const k of [0.25, 1, 2.5, 100]) {
    const { mu } = huberMEstimator(xs.map((x) => k * x));
    // huber(k * x) = k * huber(x).
    assert.ok(
      Math.abs(mu - k * mu0) < 1e-6 * Math.max(1, Math.abs(k * mu0)),
      `scale by ${k}: expected ${k * mu0}, got ${mu}`,
    );
  }
});

test('huber property: sign reversal -> sign reversal', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 100];
  const { mu: mu0 } = huberMEstimator(xs);
  const { mu: mu1 } = huberMEstimator(xs.map((x) => -x));
  // huber(-x) = -huber(x) (combination of scale by -1 — but our impl
  // requires k > 0; negation is equivalent to translation+reflection;
  // verify directly).
  assert.ok(
    Math.abs(mu1 - -mu0) < 1e-7,
    `sign reversal: expected ${-mu0}, got ${mu1}`,
  );
});

test('huber property: bounded influence — single replacement moves mu by at most O(scale)', () => {
  // Replace ONE row with an arbitrary value; huber should not move
  // by more than roughly c*scale + small. The mean would move by
  // (delta - x_replaced)/n which is unbounded; the median would
  // move by at most one order-statistic gap. Huber's bound is
  // tighter than the mean.
  const rng = mulberry32(20260429);
  const baseline = Array.from({ length: 50 }, () => 100 + rng() * 10);
  const { mu: mu0, scale: s0 } = huberMEstimator(baseline);
  // Replace baseline[0] with a huge value.
  const perturbed = baseline.slice();
  perturbed[0] = 1e9;
  const { mu: mu1 } = huberMEstimator(perturbed);
  // Mean would jump by ~2e7 (1e9 / 50). Huber should jump by far less:
  // the influence is capped at c*s ~ 1.345 * (mad/0.6745). With
  // baseline range ~10, mad is small; the cap is on the order of single
  // digits to tens. Allow generous slack: 100x scale.
  const meanShift = Math.abs(mean(perturbed) - mean(baseline));
  const huberShift = Math.abs(mu1 - mu0);
  assert.ok(
    huberShift < meanShift / 1000,
    `huber shift ${huberShift} should be vastly smaller than mean shift ${meanShift}`,
  );
  // And huberShift should be bounded by roughly the perturbation
  // window — definitely less than the order of c * s0 * (some
  // small factor) when one out of 50 rows is replaced. Just sanity:
  assert.ok(huberShift < 10 * s0 + 100, `huber shift ${huberShift} unexpectedly large`);
});

test('huber property: c -> infinity converges to mean (within slack)', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 100];
  const { mu } = huberMEstimator(xs, 1e9);
  // psi_c is identity for all rows when c is huge; IRLS step is the
  // arithmetic mean.
  assert.ok(
    Math.abs(mu - mean(xs)) < 1e-6,
    `c=1e9 huber ${mu} should equal mean ${mean(xs)}`,
  );
});

test('huber property: c -> 0 converges toward median', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 100];
  const med = median(xs);
  // Very small c: every non-zero residual is clipped to ±c*sign(z),
  // weight w_i = c/|z_i|. This pushes mu toward the median of the
  // x_i (weighted by 1/|x_i - mu|), which converges to the median.
  const { mu } = huberMEstimator(xs, 0.01);
  assert.ok(
    Math.abs(mu - med) < 1.0,
    `tiny c huber ${mu} should be close to median ${med}`,
  );
});

// ---------- builder integration ----------

test('huber builder: groups by source, drops below min-rows', () => {
  const queue: QueueLine[] = [
    ...mkSeries('s1', [10, 20, 30, 40, 50]),
    ...mkSeries('s2', [1, 2]), // n=2, below min 4
  ];
  const r = buildSourceRowTokenMEstimatorHuber(queue, { generatedAt: GEN });
  assert.equal(r.totalSources, 2);
  assert.equal(r.totalRowsKept, 7);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('huber builder: drops invalid hour_start, total_tokens, negative tokens', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's1', 100),
    ql('2026-04-27T00:00:00.000Z', 's1', Number.NaN),
    ql('2026-04-27T00:01:00.000Z', 's1', -5),
    ...mkSeries('s1', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenMEstimatorHuber(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 5);
});

test('huber builder: source filter', () => {
  const queue: QueueLine[] = [
    ...mkSeries('keep', [10, 20, 30, 40]),
    ...mkSeries('drop', [1, 2, 3, 4]),
  ];
  const r = buildSourceRowTokenMEstimatorHuber(queue, {
    source: 'keep',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 4);
});

test('huber builder: empty source defaults to "unknown"', () => {
  const queue: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', '', 10),
    ql('2026-04-27T00:01:00.000Z', '', 20),
    ql('2026-04-27T00:02:00.000Z', '', 30),
    ql('2026-04-27T00:03:00.000Z', '', 40),
  ];
  const r = buildSourceRowTokenMEstimatorHuber(queue, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('huber builder: clean data — huber matches mean and median', () => {
  // Symmetric, no outliers: mean = median, huber should coincide.
  const queue = mkSeries('s', [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const r = buildSourceRowTokenMEstimatorHuber(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.median, 5);
  assert.equal(row.mean, 5);
  assert.ok(Math.abs(row.huber - 5) < 1e-9);
  assert.ok(Math.abs(row.huberMeanGap) < 1e-9);
  assert.ok(Math.abs(row.huberMedianGap) < 1e-9);
});

test('huber builder: contaminated -> huber between median and mean (closer to median)', () => {
  const xs = [10, 11, 12, 13, 14, 15, 16, 17, 18, 1000];
  const queue = mkSeries('s', xs);
  const r = buildSourceRowTokenMEstimatorHuber(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // Sanity: mean is far above median.
  assert.ok(row.mean > row.median + 50);
  // Huber should be much closer to median than to mean.
  assert.ok(
    Math.abs(row.huber - row.median) < Math.abs(row.huber - row.mean),
    `huber ${row.huber} closer to median ${row.median} than mean ${row.mean}`,
  );
  // Sign of huberMeanGap should be negative (huber < mean).
  assert.ok(row.huberMeanGap < 0);
  // The outlier should be clipped.
  assert.ok(row.clippedRows >= 1);
});

test('huber builder: sort by huber-desc', () => {
  const queue: QueueLine[] = [
    ...mkSeries('low', [1, 2, 3, 4, 5]),
    ...mkSeries('high', [100, 200, 300, 400, 500]),
    ...mkSeries('mid', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenMEstimatorHuber(queue, {
    sort: 'huber-desc',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['high', 'mid', 'low'],
  );
});

test('huber builder: sort by huber-asc', () => {
  const queue: QueueLine[] = [
    ...mkSeries('low', [1, 2, 3, 4, 5]),
    ...mkSeries('high', [100, 200, 300, 400, 500]),
    ...mkSeries('mid', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenMEstimatorHuber(queue, {
    sort: 'huber-asc',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['low', 'mid', 'high'],
  );
});

test('huber builder: sort by source asc (alphabetical tiebreak applies)', () => {
  const queue: QueueLine[] = [
    ...mkSeries('b', [10, 20, 30, 40]),
    ...mkSeries('a', [10, 20, 30, 40]),
    ...mkSeries('c', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenMEstimatorHuber(queue, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b', 'c'],
  );
});

test('huber builder: top cap', () => {
  const queue: QueueLine[] = [
    ...mkSeries('s1', [1, 2, 3, 4]),
    ...mkSeries('s2', [10, 20, 30, 40]),
    ...mkSeries('s3', [100, 200, 300, 400]),
    ...mkSeries('s4', [1000, 2000, 3000, 4000]),
  ];
  const r = buildSourceRowTokenMEstimatorHuber(queue, {
    top: 2,
    sort: 'huber-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['s4', 's3'],
  );
  assert.equal(r.droppedBelowTopCap, 2);
});

test('huber builder: min-huber filter', () => {
  const queue: QueueLine[] = [
    ...mkSeries('low', [1, 2, 3, 4, 5]),
    ...mkSeries('high', [100, 200, 300, 400, 500]),
  ];
  const r = buildSourceRowTokenMEstimatorHuber(queue, {
    minHuber: 50,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'high');
  assert.equal(r.droppedBelowMinHuber, 1);
});

test('huber builder: c parameter is propagated and changes the estimate', () => {
  const xs = [10, 11, 12, 13, 14, 15, 16, 17, 18, 1000];
  const r1 = buildSourceRowTokenMEstimatorHuber(mkSeries('s', xs), {
    c: 1.345,
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenMEstimatorHuber(mkSeries('s', xs), {
    c: 100,
    generatedAt: GEN,
  });
  assert.equal(r1.c, 1.345);
  assert.equal(r2.c, 100);
  // c=100 is huge -> Huber should be much closer to the mean.
  const row1 = r1.sources[0]!;
  const row2 = r2.sources[0]!;
  assert.ok(Math.abs(row2.huber - row2.mean) < Math.abs(row1.huber - row1.mean));
});

test('huber builder: window since/until filters rows', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00.000Z', 's', 1),
    ql('2026-04-26T00:00:00.000Z', 's', 2),
    ql('2026-04-26T01:00:00.000Z', 's', 3),
    ql('2026-04-27T00:00:00.000Z', 's', 4),
    ql('2026-04-28T00:00:00.000Z', 's', 5),
    ql('2026-04-28T01:00:00.000Z', 's', 6),
    ql('2026-04-29T00:00:00.000Z', 's', 7),
  ];
  const r = buildSourceRowTokenMEstimatorHuber(queue, {
    since: '2026-04-26T00:00:00.000Z',
    until: '2026-04-29T00:00:00.000Z',
    generatedAt: GEN,
  });
  // Kept: rows at 04-26 (x2), 04-27, 04-28 (x2) = 5 rows.
  assert.equal(r.sources[0]!.rowsKept, 5);
});

test('huber builder: iterations field is sane (1..50 for typical inputs)', () => {
  const xs = Array.from({ length: 30 }, (_, i) => 100 + i);
  const r = buildSourceRowTokenMEstimatorHuber(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const it = r.sources[0]!.iterations;
  assert.ok(it >= 1 && it <= 50, `iterations ${it} out of expected range`);
});

test('huber builder: MAD = 0 fallback (>50% rows tied) does not crash', () => {
  // 6 zeros + 4 nonzeros: MAD on absolute deviations = 0.
  const xs = [0, 0, 0, 0, 0, 0, 5, 10, 100, 1000];
  const r = buildSourceRowTokenMEstimatorHuber(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(Number.isFinite(row.huber));
  assert.equal(row.mad, 0);
  assert.ok(row.scale > 0); // eps fallback kicked in
});

test('huber builder: random-fuzz translation equivariance through builder', () => {
  const rng = mulberry32(424242);
  const xs = Array.from({ length: 25 }, () => Math.floor(rng() * 1000));
  const a = 777;
  const r0 = buildSourceRowTokenMEstimatorHuber(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r1 = buildSourceRowTokenMEstimatorHuber(
    mkSeries(
      's',
      xs.map((x) => x + a),
    ),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r1.sources[0]!.huber - (r0.sources[0]!.huber + a)) < 1e-6,
  );
});
