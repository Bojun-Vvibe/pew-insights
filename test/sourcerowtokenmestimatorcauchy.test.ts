/**
 * Unit + property tests for source-row-token-m-estimator-cauchy.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenMEstimatorCauchy,
  cauchyMEstimator,
  cauchyWeight,
} from '../src/sourcerowtokenmestimatorcauchy.js';
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
const C = 2.3849;

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

// LCG so property tests are deterministic.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ---------- raw weight kernel (closed-form) ----------

test('cauchyWeight: z=0 -> exactly 1 (full weight)', () => {
  assert.equal(cauchyWeight(0, C), 1);
});

test('cauchyWeight: w(c) = 1/2 (half-power knee at |z| = c)', () => {
  assert.ok(Math.abs(cauchyWeight(C, C) - 0.5) < 1e-15);
  assert.ok(Math.abs(cauchyWeight(-C, C) - 0.5) < 1e-15);
});

test('cauchyWeight: never exactly zero for any finite z', () => {
  // Cauchy defining property: w(z) = 1/(1+(z/c)^2) > 0 for every
  // finite z. Denominator >= 1 always; never underflows.
  for (const z of [10, 100, 1000, 1e6, 1e10]) {
    assert.ok(cauchyWeight(z, C) > 0, `weight at z=${z} should be > 0`);
    assert.ok(cauchyWeight(-z, C) > 0, `weight at z=${-z} should be > 0`);
  }
});

test('cauchyWeight: even / symmetric in z', () => {
  for (const z of [0.1, 1, 2, 5, 17.3]) {
    assert.ok(Math.abs(cauchyWeight(z, C) - cauchyWeight(-z, C)) < 1e-15);
  }
});

test('cauchyWeight: monotonically non-increasing in |z|', () => {
  let prev = cauchyWeight(0, C);
  for (let z = 0.1; z < 50; z += 0.1) {
    const w = cauchyWeight(z, C);
    assert.ok(w <= prev + 1e-15, `monotone failed at z=${z}`);
    prev = w;
  }
});

test('cauchyWeight: tail decay ~ c^2 / z^2', () => {
  // For |z| >> c: w(z) = 1 / (1 + (z/c)^2) ~ c^2 / z^2.
  const z = 100;
  const expected = (C * C) / (z * z);
  const actual = cauchyWeight(z, C);
  assert.ok(Math.abs(actual - expected) / expected < 1e-3);
});

test('cauchyWeight: throws nothing for finite tuning > 0', () => {
  // builder validates; raw helper just computes
  assert.equal(typeof cauchyWeight(1, 1), 'number');
  assert.equal(typeof cauchyWeight(1, 100), 'number');
});

// ---------- pure cauchyMEstimator ----------

test('cauchyMEstimator: n=0 -> mu = NaN', () => {
  const r = cauchyMEstimator([]);
  assert.ok(Number.isNaN(r.mu));
  assert.equal(r.iterations, 0);
});

test('cauchyMEstimator: n=1 -> mu = x_1, iterations=0', () => {
  const r = cauchyMEstimator([42]);
  assert.equal(r.mu, 42);
  assert.equal(r.iterations, 0);
  assert.equal(r.coreRows, 1);
});

test('cauchyMEstimator: all tied -> mu = the tied value at iter 1', () => {
  const r = cauchyMEstimator([7, 7, 7, 7, 7]);
  assert.equal(r.mu, 7);
  // MAD = 0 -> eps fallback; converges immediately
  assert.equal(r.coreRows, 5);
});

test('cauchyMEstimator: symmetric data -> mu near mean = median', () => {
  const r = cauchyMEstimator([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(Math.abs(r.mu - 5) < 0.01);
  assert.equal(r.converged, 'converged');
});

test('cauchyMEstimator: single huge outlier -> mu near median, far from mean', () => {
  const xs = [10, 11, 12, 13, 14, 15, 1000];
  const r = cauchyMEstimator(xs);
  const med = median(xs);
  const mn = mean(xs);
  // Cauchy down-weights but does NOT zero out the outlier.
  // mu should be much closer to median (12) than to mean (~153).
  assert.ok(Math.abs(r.mu - med) < Math.abs(r.mu - mn));
  assert.ok(r.farTailRows >= 1, 'outlier should land in far tail');
});

test('cauchyMEstimator: translation equivariance', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const k = 17.5;
  const a = cauchyMEstimator(xs).mu;
  const b = cauchyMEstimator(xs.map((x) => x + k)).mu;
  assert.ok(Math.abs(b - (a + k)) < 1e-9);
});

test('cauchyMEstimator: scale equivariance', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const k = 4.0;
  const a = cauchyMEstimator(xs).mu;
  const b = cauchyMEstimator(xs.map((x) => x * k)).mu;
  assert.ok(Math.abs(b - a * k) < 1e-9);
});

test('cauchyMEstimator: bucket counts sum to n', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1000, 2000];
  const r = cauchyMEstimator(xs);
  assert.equal(r.coreRows + r.tailRows + r.farTailRows, xs.length);
});

test('cauchyMEstimator: invalid tuning rejected', () => {
  assert.throws(() => cauchyMEstimator([1, 2, 3], 0));
  assert.throws(() => cauchyMEstimator([1, 2, 3], -1));
  assert.throws(() => cauchyMEstimator([1, 2, 3], NaN));
  assert.throws(() => cauchyMEstimator([1, 2, 3], Infinity));
});

test('cauchyMEstimator: converged on simple symmetric input', () => {
  const r = cauchyMEstimator([10, 11, 12, 13, 14]);
  assert.equal(r.converged, 'converged');
  assert.ok(r.iterations >= 1);
  assert.ok(r.iterations < 200);
});

test('cauchyMEstimator: never returns "zero-weight" termination on any finite reasonable input', () => {
  // Cauchy weights are mathematically never zero at finite z.
  // This is the fundamental difference from compact-support
  // M-estimators (Tukey, Hampel, Andrews).
  const r = cauchyMEstimator([1, 2, 3, 4, 5, 1e15]);
  assert.notEqual(r.converged, 'zero-weight');
});

// Property test: random standard-normal samples (via Box-Muller from LCG)
test('cauchyMEstimator: property -- on random normal-ish data, mu close to mean', () => {
  const rng = lcg(424242);
  const xs: number[] = [];
  for (let i = 0; i < 100; i += 1) {
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    xs.push(50 + 10 * z);
  }
  const r = cauchyMEstimator(xs);
  const m = mean(xs);
  // ~95% efficient at the normal: mu within a few units of mean
  assert.ok(Math.abs(r.mu - m) < 3, `mu=${r.mu} vs mean=${m}`);
});

// ---------- builder end-to-end ----------

test('builder: empty queue -> empty report', () => {
  const r = buildSourceRowTokenMEstimatorCauchy([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.tuning, C);
});

test('builder: single source above min-rows produces one row', () => {
  const q = mkSeries('s1', [10, 12, 14, 16, 18, 20, 22, 24]);
  const r = buildSourceRowTokenMEstimatorCauchy(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 's1');
  assert.equal(row.rowsKept, 8);
  assert.ok(row.cauchy > 10 && row.cauchy < 25);
});

test('builder: source with empty/missing source string -> "unknown"', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', '', 10),
    ql('2026-04-27T00:01:00.000Z', '', 12),
    ql('2026-04-27T00:02:00.000Z', '', 14),
    ql('2026-04-27T00:03:00.000Z', '', 16),
  ];
  const r = buildSourceRowTokenMEstimatorCauchy(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('builder: drops invalid hour_start', () => {
  const q = [
    ql('NOT-A-DATE', 's1', 10),
    ...mkSeries('s1', [10, 12, 14, 16]),
  ];
  const r = buildSourceRowTokenMEstimatorCauchy(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('builder: drops negative total_tokens', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 's1', -5),
    ...mkSeries('s1', [10, 12, 14, 16]),
  ];
  const r = buildSourceRowTokenMEstimatorCauchy(q, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('builder: drops non-finite total_tokens', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 's1', NaN),
    ql('2026-04-27T00:01:00.000Z', 's1', Infinity),
    ...mkSeries('s1', [10, 12, 14, 16]),
  ];
  const r = buildSourceRowTokenMEstimatorCauchy(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 2);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('builder: source filter restricts to single source', () => {
  const q = [
    ...mkSeries('s1', [10, 12, 14, 16]),
    ...mkSeries('s2', [100, 101, 102, 103]),
  ];
  const r = buildSourceRowTokenMEstimatorCauchy(q, {
    generatedAt: GEN,
    source: 's1',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedSourceFilter, 4);
});

test('builder: min-rows below 4 is rejected', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorCauchy([], { minRows: 3, generatedAt: GEN }),
  );
});

test('builder: min-cauchy filters out below-threshold sources', () => {
  const q = [
    ...mkSeries('s1', [10, 11, 12, 13]),
    ...mkSeries('s2', [1000, 1001, 1002, 1003]),
  ];
  const r = buildSourceRowTokenMEstimatorCauchy(q, {
    generatedAt: GEN,
    minCauchy: 500,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's2');
  assert.equal(r.droppedBelowMinCauchy, 1);
});

test('builder: top cap surfaces dropped count', () => {
  const q = [
    ...mkSeries('s1', [10, 11, 12, 13]),
    ...mkSeries('s2', [20, 21, 22, 23]),
    ...mkSeries('s3', [30, 31, 32, 33]),
  ];
  const r = buildSourceRowTokenMEstimatorCauchy(q, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('builder: invalid tuning rejected', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorCauchy([], {
      tuning: 0,
      generatedAt: GEN,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorCauchy([], {
      tuning: -1,
      generatedAt: GEN,
    }),
  );
});

test('builder: invalid sort key rejected', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorCauchy([], {
      // @ts-expect-error testing runtime validation
      sort: 'bogus',
      generatedAt: GEN,
    }),
  );
});

test('builder: cauchyMeanGap and cauchyMedianGap signs are consistent', () => {
  const q = mkSeries('s1', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1000]);
  const r = buildSourceRowTokenMEstimatorCauchy(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  // mean is dragged up by the outlier; cauchy should be near median ~6
  assert.ok(row.cauchyMeanGap < 0, `expected cauchy < mean, got ${row.cauchyMeanGap}`);
  // |cauchy - median| should be small
  assert.ok(Math.abs(row.cauchyMedianGap) < Math.abs(row.cauchyMeanGap));
});

test('builder: bucket counts on real source row sum to rowsKept', () => {
  const q = mkSeries('s1', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100, 200, 1000]);
  const r = buildSourceRowTokenMEstimatorCauchy(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.coreRows + row.tailRows + row.farTailRows, row.rowsKept);
});

test('builder: echoed options round-trip', () => {
  const r = buildSourceRowTokenMEstimatorCauchy([], {
    generatedAt: GEN,
    minRows: 5,
    minCauchy: 100,
    tuning: 2.5,
    top: 7,
    sort: 'mean-desc',
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-05-01T00:00:00.000Z',
  });
  assert.equal(r.minRows, 5);
  assert.equal(r.minCauchy, 100);
  assert.equal(r.tuning, 2.5);
  assert.equal(r.top, 7);
  assert.equal(r.sort, 'mean-desc');
  assert.equal(r.windowStart, '2026-04-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-05-01T00:00:00.000Z');
  assert.equal(r.generatedAt, GEN);
});

test('builder: cauchyMedianRatio = cauchy / median when median > 0', () => {
  const q = mkSeries('s1', [10, 12, 14, 16, 18, 20]);
  const r = buildSourceRowTokenMEstimatorCauchy(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(row.median > 0);
  assert.ok(
    Math.abs(row.cauchyMedianRatio - row.cauchy / row.median) < 1e-12,
  );
  // For symmetric data the ratio should sit very close to 1.
  assert.ok(Math.abs(row.cauchyMedianRatio - 1) < 0.05);
});

test('builder: cauchyMedianRatio = 1 when median = 0 and cauchy = 0 (all-zero edge case)', () => {
  const q = mkSeries('s1', [0, 0, 0, 0, 0]);
  const r = buildSourceRowTokenMEstimatorCauchy(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.median, 0);
  assert.equal(row.cauchy, 0);
  assert.equal(row.cauchyMedianRatio, 1);
});
