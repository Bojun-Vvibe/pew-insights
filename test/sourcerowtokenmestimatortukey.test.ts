/**
 * Unit + property tests for source-row-token-m-estimator-tukey.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenMEstimatorTukey,
  tukeyBiweightMEstimator,
} from '../src/sourcerowtokenmestimatortukey.js';
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

// LCG so property tests are deterministic.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ---------- raw kernel ----------

test('tukeyBiweightMEstimator: empty input -> NaN', () => {
  const r = tukeyBiweightMEstimator([]);
  assert.ok(Number.isNaN(r.mu));
  assert.equal(r.iterations, 0);
  assert.equal(r.rejectedRows, 0);
});

test('tukeyBiweightMEstimator: n=1 -> the single value', () => {
  const r = tukeyBiweightMEstimator([42]);
  assert.equal(r.mu, 42);
  assert.equal(r.iterations, 0);
  assert.equal(r.rejectedRows, 0);
});

test('tukeyBiweightMEstimator: all-equal values -> the common value', () => {
  const r = tukeyBiweightMEstimator([7, 7, 7, 7, 7]);
  assert.equal(r.mu, 7);
  assert.equal(r.rejectedRows, 0);
  assert.equal(r.mad, 0);
});

test('tukeyBiweightMEstimator: symmetric clean data -> close to mean/median', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const r = tukeyBiweightMEstimator(xs);
  // Symmetric -> mu sits at the center of mass, which equals the mean
  // (= median = 5 here).
  assert.ok(Math.abs(r.mu - 5) < 1e-9);
});

test('tukeyBiweightMEstimator: redescends to 0 outside [-c, c]', () => {
  // Bulk of 9 small values + 1 huge outlier. Outlier should be
  // rejected entirely (weight = 0), so mu lands inside the bulk.
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1_000_000];
  const r = tukeyBiweightMEstimator(xs);
  assert.ok(r.mu < 100, `expected mu near bulk, got ${r.mu}`);
  assert.equal(r.rejectedRows, 1);
});

test('tukeyBiweightMEstimator: rejects multiple far outliers', () => {
  const xs = [10, 11, 12, 13, 14, 15, 1e9, 2e9, 3e9];
  const r = tukeyBiweightMEstimator(xs);
  assert.ok(r.mu < 100);
  assert.equal(r.rejectedRows, 3);
});

test('tukeyBiweightMEstimator: translation equivariance', () => {
  const xs = [3, 5, 7, 11, 13, 17, 19];
  const r0 = tukeyBiweightMEstimator(xs);
  const r1 = tukeyBiweightMEstimator(xs.map((x) => x + 1000));
  assert.ok(Math.abs(r1.mu - (r0.mu + 1000)) < 1e-6);
});

test('tukeyBiweightMEstimator: positive scale equivariance', () => {
  const xs = [3, 5, 7, 11, 13, 17, 19, 23];
  const r0 = tukeyBiweightMEstimator(xs);
  const r1 = tukeyBiweightMEstimator(xs.map((x) => x * 7));
  assert.ok(Math.abs(r1.mu - r0.mu * 7) < 1e-6);
});

test('tukeyBiweightMEstimator: large c -> approaches the mean', () => {
  // c huge means psi is essentially identity inside [-c,c]; for any
  // real residuals all rows are inside. IRLS reduces to weighted-mean
  // with weights -> 1 -> arithmetic mean.
  const xs = [1, 2, 3, 100, 200];
  const r = tukeyBiweightMEstimator(xs, 1e9);
  const mu = mean(xs);
  assert.ok(Math.abs(r.mu - mu) < 1e-3, `tukey ${r.mu} vs mean ${mu}`);
  assert.equal(r.rejectedRows, 0);
});

test('tukeyBiweightMEstimator: small c -> very robust (rejects more)', () => {
  const xs = [1, 2, 3, 4, 5, 50, 100];
  const r = tukeyBiweightMEstimator(xs, 1.0);
  assert.ok(r.rejectedRows >= 1);
});

test('tukeyBiweightMEstimator: c invalid throws', () => {
  assert.throws(() => tukeyBiweightMEstimator([1, 2, 3], 0));
  assert.throws(() => tukeyBiweightMEstimator([1, 2, 3], -1));
  assert.throws(() => tukeyBiweightMEstimator([1, 2, 3], NaN));
  assert.throws(() => tukeyBiweightMEstimator([1, 2, 3], Infinity));
});

test('tukeyBiweightMEstimator: MAD = 0 fallback path (majority tied)', () => {
  // 5 ties at 10, two outliers; MAD = 0.
  const xs = [10, 10, 10, 10, 10, 1000, 2000];
  const r = tukeyBiweightMEstimator(xs);
  // With MAD=0 fallback s, the outliers should still be rejected.
  assert.ok(Math.abs(r.mu - 10) < 1.0, `mu ${r.mu} should sit near 10`);
});

test('tukeyBiweightMEstimator: converges in <= 200 iterations on real-shaped data', () => {
  const rng = lcg(42);
  const xs: number[] = [];
  for (let i = 0; i < 200; i += 1) {
    // log-normal-ish bulk with a few outliers.
    const u = rng();
    xs.push(u < 0.95 ? Math.exp(8 + 1.5 * (rng() - 0.5)) : 1e7 * (1 + rng()));
  }
  const r = tukeyBiweightMEstimator(xs);
  assert.ok(r.iterations < 200, `iter ${r.iterations}`);
  assert.ok(Number.isFinite(r.mu));
});

test('tukeyBiweightMEstimator: monotone in outlier injection (mu stays bounded)', () => {
  const base = [10, 12, 14, 16, 18, 20];
  const r0 = tukeyBiweightMEstimator(base);
  const r1 = tukeyBiweightMEstimator([...base, 1e6]);
  const r2 = tukeyBiweightMEstimator([...base, 1e6, 1e9]);
  // Adding far-away outliers should not move mu meaningfully.
  assert.ok(Math.abs(r1.mu - r0.mu) < 5);
  assert.ok(Math.abs(r2.mu - r0.mu) < 5);
});

test('tukeyBiweightMEstimator: distinct from Huber on extreme tails (full rejection)', () => {
  // With one extreme outlier the residual is >> c; Tukey weight
  // should be exactly zero and rejectedRows > 0.
  const xs = [1, 2, 3, 4, 5, 1e15];
  const r = tukeyBiweightMEstimator(xs);
  assert.equal(r.rejectedRows, 1);
  // mu should sit within the bulk [1, 5]
  assert.ok(r.mu >= 1 && r.mu <= 5, `mu ${r.mu} not in bulk`);
});

test('tukeyBiweightMEstimator: weights contiguous (no rejection of bulk row)', () => {
  // Clean tightly-clustered data: nothing should be rejected.
  const xs = [100, 101, 102, 103, 104, 105];
  const r = tukeyBiweightMEstimator(xs);
  assert.equal(r.rejectedRows, 0);
});

test('tukeyBiweightMEstimator: idempotent under repeated outliers (single direction)', () => {
  const a = tukeyBiweightMEstimator([10, 11, 12, 13, 14, 1e8]);
  const b = tukeyBiweightMEstimator([10, 11, 12, 13, 14, 1e8, 2e8, 3e8]);
  assert.ok(Math.abs(a.mu - b.mu) < 5);
});

test('tukeyBiweightMEstimator: signed residual symmetry (rejects both tails)', () => {
  const xs = [-1e9, -1e8, 10, 11, 12, 13, 14, 1e8, 1e9];
  const r = tukeyBiweightMEstimator(xs);
  assert.equal(r.rejectedRows, 4);
  // Bulk median is 12; mu should be very close.
  assert.ok(Math.abs(r.mu - 12) < 2);
});

// ---------- builder integration ----------

test('builder: empty queue -> empty report', () => {
  const r = buildSourceRowTokenMEstimatorTukey([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('builder: single source, clean data, n>=4', () => {
  const queue = mkSeries('s', [10, 11, 12, 13, 14, 15]);
  const r = buildSourceRowTokenMEstimatorTukey(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 's');
  assert.equal(row.rowsKept, 6);
  assert.ok(Math.abs(row.tukey - 12.5) < 0.5);
  assert.equal(row.rejectedRows, 0);
});

test('builder: source below min-rows is dropped', () => {
  const queue = mkSeries('s', [1, 2, 3]);
  const r = buildSourceRowTokenMEstimatorTukey(queue, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('builder: minRows < 4 throws', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorTukey([], { minRows: 3, generatedAt: GEN }),
  );
});

test('builder: minTukey negative throws', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorTukey([], { minTukey: -1, generatedAt: GEN }),
  );
});

test('builder: c invalid throws', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorTukey([], { c: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorTukey([], { c: -1, generatedAt: GEN }),
  );
});

test('builder: top must be a positive integer', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorTukey([], { top: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorTukey([], { top: 1.5, generatedAt: GEN }),
  );
});

test('builder: invalid sort throws', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorTukey([], {
      // @ts-expect-error invalid
      sort: 'bogus',
      generatedAt: GEN,
    }),
  );
});

test('builder: invalid since/until throws', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorTukey([], {
      since: 'not-a-date',
      generatedAt: GEN,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorTukey([], {
      until: 'not-a-date',
      generatedAt: GEN,
    }),
  );
});

test('builder: drops bad hour_start, bad tokens, negative tokens', () => {
  const queue: QueueLine[] = [
    { ...ql('bogus', 's', 5) },
    { ...ql('2026-04-27T00:00:00.000Z', 's', NaN) },
    { ...ql('2026-04-27T00:01:00.000Z', 's', -3) },
    ...mkSeries('s', [10, 11, 12, 13, 14, 15]),
  ];
  const r = buildSourceRowTokenMEstimatorTukey(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
});

test('builder: source filter restricts and counts dropped-by-filter', () => {
  const queue = [
    ...mkSeries('a', [10, 11, 12, 13, 14]),
    ...mkSeries('b', [100, 101, 102, 103, 104]),
  ];
  const r = buildSourceRowTokenMEstimatorTukey(queue, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 5);
});

test('builder: empty/missing source coerced to "unknown"', () => {
  const queue = [
    ...mkSeries('', [10, 11, 12, 13, 14]),
  ];
  const r = buildSourceRowTokenMEstimatorTukey(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('builder: minTukey gates by cohort selector', () => {
  const queue = [
    ...mkSeries('low', [1, 2, 3, 4, 5]),
    ...mkSeries('high', [100, 101, 102, 103, 104]),
  ];
  const r = buildSourceRowTokenMEstimatorTukey(queue, {
    minTukey: 50,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'high');
  assert.equal(r.droppedBelowMinTukey, 1);
});

test('builder: top cap applied after sort', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [10, 11, 12, 13, 14]),
    ...mkSeries('c', [100, 101, 102, 103, 104]),
  ];
  const r = buildSourceRowTokenMEstimatorTukey(queue, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[1]!.source, 'b');
  assert.equal(r.droppedBelowTopCap, 1);
});

test('builder: sort tukey-asc inverts order', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [100, 101, 102, 103, 104]),
  ];
  const r = buildSourceRowTokenMEstimatorTukey(queue, {
    sort: 'tukey-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
});

test('builder: sort source asc tiebreak', () => {
  const queue = [
    ...mkSeries('b', [10, 11, 12, 13, 14]),
    ...mkSeries('a', [10, 11, 12, 13, 14]),
  ];
  const r = buildSourceRowTokenMEstimatorTukey(queue, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('builder: sort by mean-gap-desc orders by |tukeyMeanGap|', () => {
  const queue = [
    ...mkSeries('clean', [10, 11, 12, 13, 14, 15, 16, 17]),
    ...mkSeries('dirty', [10, 11, 12, 13, 14, 15, 16, 1e9]),
  ];
  const r = buildSourceRowTokenMEstimatorTukey(queue, {
    sort: 'mean-gap-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'dirty');
});

test('builder: sort by median-gap-desc orders by |tukeyMedianGap|', () => {
  const queue = [
    ...mkSeries('clean', [10, 11, 12, 13, 14, 15, 16, 17]),
    ...mkSeries('skewed', [1, 1, 1, 1, 1, 1, 1, 100]),
  ];
  const r = buildSourceRowTokenMEstimatorTukey(queue, {
    sort: 'median-gap-desc',
    generatedAt: GEN,
  });
  // The Tukey estimate should differ less from the median when
  // outliers are rejected; clean data should have ~0 gap.
  assert.ok(Math.abs(r.sources[0]!.tukeyMedianGap) >=
    Math.abs(r.sources[1]!.tukeyMedianGap));
});

test('builder: signed gaps make sense (negative meanGap on right-skew)', () => {
  const queue = mkSeries('s', [10, 11, 12, 13, 14, 15, 16, 1e9]);
  const r = buildSourceRowTokenMEstimatorTukey(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(row.tukeyMeanGap < 0, `expected negative tukeyMeanGap, got ${row.tukeyMeanGap}`);
  assert.equal(row.rejectedRows, 1);
});

test('builder: window since/until filters rows', () => {
  const queue = mkSeries('s', [10, 11, 12, 13, 14, 15, 16, 17]);
  // Only keep rows from a narrow window covering 4 entries.
  const r = buildSourceRowTokenMEstimatorTukey(queue, {
    since: '2026-04-27T00:02:00.000Z',
    until: '2026-04-27T00:06:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('builder: report fields shape', () => {
  const queue = mkSeries('s', [10, 11, 12, 13, 14]);
  const r = buildSourceRowTokenMEstimatorTukey(queue, { generatedAt: GEN });
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minRows, 4);
  assert.equal(r.minTukey, 0);
  assert.equal(r.c, 4.685);
  assert.equal(r.sort, 'tukey-desc');
  assert.equal(r.top, null);
});

// ---------- property tests ----------

test('property: translation equivariance across builder', () => {
  const rng = lcg(7);
  for (let trial = 0; trial < 8; trial += 1) {
    const xs = Array.from({ length: 30 }, () => rng() * 1000);
    const shift = (rng() - 0.5) * 5000;
    const a = buildSourceRowTokenMEstimatorTukey(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const b = buildSourceRowTokenMEstimatorTukey(
      mkSeries('s', xs.map((x) => x + shift).filter((x) => x >= 0)),
      { generatedAt: GEN },
    );
    if (
      a.sources.length === 1 &&
      b.sources.length === 1 &&
      xs.every((x) => x + shift >= 0)
    ) {
      const diff = b.sources[0]!.tukey - (a.sources[0]!.tukey + shift);
      assert.ok(Math.abs(diff) < 1e-3, `trial ${trial} diff ${diff}`);
    }
  }
});

test('property: positive scale equivariance across builder', () => {
  const rng = lcg(11);
  for (let trial = 0; trial < 8; trial += 1) {
    const xs = Array.from({ length: 25 }, () => rng() * 1000 + 1);
    const k = 1 + rng() * 9;
    const a = buildSourceRowTokenMEstimatorTukey(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const b = buildSourceRowTokenMEstimatorTukey(
      mkSeries('s', xs.map((x) => x * k)),
      { generatedAt: GEN },
    );
    if (a.sources.length === 1 && b.sources.length === 1) {
      const expected = a.sources[0]!.tukey * k;
      const diff = b.sources[0]!.tukey - expected;
      assert.ok(
        Math.abs(diff) < 1e-3 * Math.max(1, Math.abs(expected)),
        `trial ${trial} diff ${diff} expected ${expected}`,
      );
    }
  }
});

test('property: clean uniform data -> tukey close to median', () => {
  const rng = lcg(23);
  for (let trial = 0; trial < 6; trial += 1) {
    const xs = Array.from({ length: 50 }, () => rng() * 100 + 50);
    const a = buildSourceRowTokenMEstimatorTukey(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const m = median(xs);
    const t = a.sources[0]!.tukey;
    // For uniform data, tukey should be within ~10 of the median.
    assert.ok(Math.abs(t - m) < 15, `trial ${trial} tukey ${t} med ${m}`);
  }
});

test('property: bounded influence from extreme outlier injection', () => {
  const rng = lcg(31);
  for (let trial = 0; trial < 6; trial += 1) {
    const bulk = Array.from({ length: 30 }, () => rng() * 100 + 100);
    const a = buildSourceRowTokenMEstimatorTukey(mkSeries('s', bulk), {
      generatedAt: GEN,
    });
    const polluted = [...bulk, 1e12, 2e12];
    const b = buildSourceRowTokenMEstimatorTukey(mkSeries('s', polluted), {
      generatedAt: GEN,
    });
    const drift = Math.abs(b.sources[0]!.tukey - a.sources[0]!.tukey);
    // With redescending psi, two huge outliers should move tukey
    // by a small amount (much less than ~MAD of the bulk).
    assert.ok(drift < 50, `trial ${trial} drift ${drift}`);
    assert.ok(b.sources[0]!.rejectedRows >= 2);
  }
});

test('property: rejected outliers produce zero net pull on mu', () => {
  // Adding more outliers WAY beyond c should not change mu at all
  // beyond the change incurred by the first one.
  const bulk = [10, 11, 12, 13, 14, 15, 16];
  const r1 = buildSourceRowTokenMEstimatorTukey(
    mkSeries('s', [...bulk, 1e10]),
    { generatedAt: GEN },
  );
  const r2 = buildSourceRowTokenMEstimatorTukey(
    mkSeries('s', [...bulk, 1e10, 1e11, 1e12, 1e13, 1e14]),
    { generatedAt: GEN },
  );
  const drift = Math.abs(r2.sources[0]!.tukey - r1.sources[0]!.tukey);
  assert.ok(drift < 1e-3, `expected ~0 drift, got ${drift}`);
});

test('property: rejectedRows monotonic in outlier count', () => {
  const bulk = [10, 11, 12, 13, 14, 15];
  let prev = 0;
  for (let k = 0; k <= 4; k += 1) {
    const tail = Array.from({ length: k }, (_, i) => 1e6 * (i + 1));
    const r = buildSourceRowTokenMEstimatorTukey(
      mkSeries('s', [...bulk, ...tail]),
      { generatedAt: GEN },
    );
    const rej = r.sources[0]!.rejectedRows;
    assert.ok(rej >= prev, `k=${k} rejected ${rej} < prev ${prev}`);
    prev = rej;
  }
});

test('property: large-c limit -> mean within tight tolerance', () => {
  const rng = lcg(101);
  for (let trial = 0; trial < 5; trial += 1) {
    const xs = Array.from({ length: 20 }, () => rng() * 100 + 10);
    const r = buildSourceRowTokenMEstimatorTukey(mkSeries('s', xs), {
      c: 1e9,
      generatedAt: GEN,
    });
    const mu = mean(xs);
    assert.ok(
      Math.abs(r.sources[0]!.tukey - mu) < 1e-3,
      `trial ${trial} tukey ${r.sources[0]!.tukey} mean ${mu}`,
    );
  }
});

test('property: convergence within 200 iterations on log-normal-ish data', () => {
  const rng = lcg(202);
  for (let trial = 0; trial < 5; trial += 1) {
    const xs = Array.from({ length: 100 }, () =>
      Math.exp(7 + 2 * (rng() - 0.5)),
    );
    const r = buildSourceRowTokenMEstimatorTukey(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    assert.ok(
      r.sources[0]!.iterations < 200,
      `trial ${trial} iter ${r.sources[0]!.iterations}`,
    );
  }
});

test('property: tukey is finite and non-negative for non-negative inputs', () => {
  const rng = lcg(303);
  for (let trial = 0; trial < 10; trial += 1) {
    const xs = Array.from({ length: 30 }, () => rng() * 1000);
    const r = buildSourceRowTokenMEstimatorTukey(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const t = r.sources[0]!.tukey;
    assert.ok(Number.isFinite(t));
    assert.ok(t >= -1e-9, `tukey ${t} negative`);
  }
});

test('property: tukey lies within [min, max] of bulk after rejection', () => {
  const rng = lcg(404);
  for (let trial = 0; trial < 5; trial += 1) {
    const bulk = Array.from({ length: 30 }, () => 100 + rng() * 50);
    const xs = [...bulk, 1e10, 2e10];
    const r = buildSourceRowTokenMEstimatorTukey(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const t = r.sources[0]!.tukey;
    const lo = Math.min(...bulk);
    const hi = Math.max(...bulk);
    assert.ok(t >= lo - 1 && t <= hi + 1, `trial ${trial} tukey ${t} out of bulk [${lo},${hi}]`);
  }
});

test('property: report aggregate fields invariant', () => {
  const rng = lcg(505);
  for (let trial = 0; trial < 4; trial += 1) {
    const series: QueueLine[] = [];
    const nSrc = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < nSrc; i += 1) {
      const k = 5 + Math.floor(rng() * 20);
      const xs = Array.from({ length: k }, () => rng() * 1000);
      series.push(...mkSeries(`s${i}`, xs));
    }
    const r = buildSourceRowTokenMEstimatorTukey(series, { generatedAt: GEN });
    assert.equal(r.totalSources, nSrc);
    const sumKept = r.sources.reduce((a, b) => a + b.rowsKept, 0);
    assert.ok(sumKept <= r.totalRowsKept);
  }
});
