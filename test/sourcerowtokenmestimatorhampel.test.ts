/**
 * Unit + property tests for source-row-token-m-estimator-hampel.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenMEstimatorHampel,
  hampelMEstimator,
  hampelWeight,
} from '../src/sourcerowtokenmestimatorhampel.js';
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

// ---------- raw weight kernel (closed-form) ----------

test('hampelWeight: |z|<=a -> exactly 1 (full weight)', () => {
  assert.equal(hampelWeight(0, 1.7, 3.4, 8.5), 1);
  assert.equal(hampelWeight(0.5, 1.7, 3.4, 8.5), 1);
  assert.equal(hampelWeight(1.7, 1.7, 3.4, 8.5), 1);
  assert.equal(hampelWeight(-1.7, 1.7, 3.4, 8.5), 1);
});

test('hampelWeight: a<|z|<=b -> a/|z| (plateau psi=a)', () => {
  // psi(z) = a*sign(z); w = psi/z = a/|z|
  assert.ok(Math.abs(hampelWeight(2.0, 1.7, 3.4, 8.5) - 1.7 / 2.0) < 1e-12);
  assert.ok(Math.abs(hampelWeight(-3.0, 1.7, 3.4, 8.5) - 1.7 / 3.0) < 1e-12);
  assert.ok(Math.abs(hampelWeight(3.4, 1.7, 3.4, 8.5) - 1.7 / 3.4) < 1e-12);
});

test('hampelWeight: b<|z|<=c -> linear descent factor', () => {
  // w(z) = (a/|z|) * (c - |z|) / (c - b)
  const a = 1.7, b = 3.4, c = 8.5;
  for (const z of [4.0, 5.5, 7.0, 8.0]) {
    const expected = (a / z) * ((c - z) / (c - b));
    assert.ok(Math.abs(hampelWeight(z, a, b, c) - expected) < 1e-12);
  }
});

test('hampelWeight: |z|>c -> exactly 0 (full rejection)', () => {
  assert.equal(hampelWeight(8.6, 1.7, 3.4, 8.5), 0);
  assert.equal(hampelWeight(-1000, 1.7, 3.4, 8.5), 0);
  assert.equal(hampelWeight(1e15, 1.7, 3.4, 8.5), 0);
});

test('hampelWeight: continuous at z = c (descend tail -> 0)', () => {
  // At |z| = c, descent factor is (c - c)/(c - b) = 0, so w(c) = 0.
  assert.equal(hampelWeight(8.5, 1.7, 3.4, 8.5), 0);
  assert.equal(hampelWeight(-8.5, 1.7, 3.4, 8.5), 0);
});

test('hampelWeight: monotone non-increasing in |z|', () => {
  const a = 1.7, b = 3.4, c = 8.5;
  let prev = hampelWeight(0, a, b, c);
  for (let z = 0.1; z <= 10; z += 0.1) {
    const w = hampelWeight(z, a, b, c);
    assert.ok(w <= prev + 1e-12, `non-monotone at z=${z}: w=${w} prev=${prev}`);
    prev = w;
  }
});

test('hampelWeight: even (symmetric in z)', () => {
  for (const z of [0.5, 2.0, 5.0, 9.0]) {
    assert.equal(
      hampelWeight(z, 1.7, 3.4, 8.5),
      hampelWeight(-z, 1.7, 3.4, 8.5),
    );
  }
});

// ---------- raw IRLS kernel ----------

test('hampelMEstimator: empty input -> NaN', () => {
  const r = hampelMEstimator([]);
  assert.ok(Number.isNaN(r.mu));
  assert.equal(r.iterations, 0);
  assert.equal(r.rejectedRows, 0);
  assert.equal(r.coreRows, 0);
  assert.equal(r.plateauRows, 0);
  assert.equal(r.descendingRows, 0);
});

test('hampelMEstimator: n=1 -> the single value, classified as core', () => {
  const r = hampelMEstimator([42]);
  assert.equal(r.mu, 42);
  assert.equal(r.iterations, 0);
  assert.equal(r.coreRows, 1);
  assert.equal(r.rejectedRows, 0);
});

test('hampelMEstimator: all-equal values -> the common value', () => {
  const r = hampelMEstimator([7, 7, 7, 7, 7]);
  assert.equal(r.mu, 7);
  assert.equal(r.rejectedRows, 0);
  assert.equal(r.mad, 0);
});

test('hampelMEstimator: symmetric clean data -> close to mean/median', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const r = hampelMEstimator(xs);
  assert.ok(Math.abs(r.mu - 5) < 1e-9);
});

test('hampelMEstimator: redescends to 0 outside [-c, c]', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1_000_000];
  const r = hampelMEstimator(xs);
  assert.ok(r.mu < 100, `expected mu near bulk, got ${r.mu}`);
  assert.equal(r.rejectedRows, 1);
});

test('hampelMEstimator: rejects multiple far outliers', () => {
  const xs = [10, 11, 12, 13, 14, 15, 1e9, 2e9, 3e9];
  const r = hampelMEstimator(xs);
  assert.ok(r.mu < 100);
  assert.equal(r.rejectedRows, 3);
});

test('hampelMEstimator: translation equivariance', () => {
  const xs = [3, 5, 7, 11, 13, 17, 19];
  const r0 = hampelMEstimator(xs);
  const r1 = hampelMEstimator(xs.map((x) => x + 1000));
  assert.ok(Math.abs(r1.mu - (r0.mu + 1000)) < 1e-6);
});

test('hampelMEstimator: positive scale equivariance', () => {
  const xs = [3, 5, 7, 11, 13, 17, 19, 23];
  const r0 = hampelMEstimator(xs);
  const r1 = hampelMEstimator(xs.map((x) => x * 7));
  assert.ok(Math.abs(r1.mu - r0.mu * 7) < 1e-6);
});

test('hampelMEstimator: knots invalid throws (non-monotone)', () => {
  assert.throws(() => hampelMEstimator([1, 2, 3], 0, 1, 2));
  assert.throws(() => hampelMEstimator([1, 2, 3], 1, 1, 2));
  assert.throws(() => hampelMEstimator([1, 2, 3], 1, 2, 2));
  assert.throws(() => hampelMEstimator([1, 2, 3], NaN, 2, 3));
  assert.throws(() => hampelMEstimator([1, 2, 3], 1, Infinity, 3));
});

test('hampelMEstimator: bucket counts sum to n', () => {
  const xs = [1, 2, 3, 4, 5, 50, 1e6, 1e9];
  const r = hampelMEstimator(xs);
  const total = r.coreRows + r.plateauRows + r.descendingRows + r.rejectedRows;
  assert.equal(total, xs.length);
});

test('hampelMEstimator: MAD = 0 fallback path (majority tied)', () => {
  const xs = [10, 10, 10, 10, 10, 1000, 2000];
  const r = hampelMEstimator(xs);
  assert.ok(Math.abs(r.mu - 10) < 1.0, `mu ${r.mu} should sit near 10`);
});

test('hampelMEstimator: converges in <= 200 iterations on real-shaped data', () => {
  const rng = lcg(42);
  const xs: number[] = [];
  for (let i = 0; i < 200; i += 1) {
    const u = rng();
    xs.push(u < 0.95 ? Math.exp(8 + 1.5 * (rng() - 0.5)) : 1e7 * (1 + rng()));
  }
  const r = hampelMEstimator(xs);
  assert.ok(r.iterations < 200, `iter ${r.iterations}`);
  assert.ok(Number.isFinite(r.mu));
});

test('hampelMEstimator: bounded influence under outlier cascade', () => {
  const base = [10, 12, 14, 16, 18, 20];
  const r0 = hampelMEstimator(base);
  const r1 = hampelMEstimator([...base, 1e6]);
  const r2 = hampelMEstimator([...base, 1e6, 1e9]);
  assert.ok(Math.abs(r1.mu - r0.mu) < 5);
  assert.ok(Math.abs(r2.mu - r0.mu) < 5);
});

test('hampelMEstimator: rejects both tails symmetrically', () => {
  const xs = [-1e9, -1e8, 10, 11, 12, 13, 14, 1e8, 1e9];
  const r = hampelMEstimator(xs);
  assert.equal(r.rejectedRows, 4);
  assert.ok(Math.abs(r.mu - 12) < 2);
});

test('hampelMEstimator: clean tight cluster -> all core, none rejected', () => {
  const xs = [100, 101, 102, 103, 104, 105];
  const r = hampelMEstimator(xs);
  assert.equal(r.rejectedRows, 0);
  assert.equal(r.plateauRows, 0);
  assert.equal(r.descendingRows, 0);
  assert.equal(r.coreRows, xs.length);
});

test('hampelMEstimator: large c -> approaches mean (degenerates to it)', () => {
  // With huge a, b, c the entire psi is identity inside [-a, a].
  const xs = [1, 2, 3, 100, 200];
  const r = hampelMEstimator(xs, 1e8, 2e8, 3e8);
  const mu = mean(xs);
  assert.ok(Math.abs(r.mu - mu) < 1e-3, `hampel ${r.mu} vs mean ${mu}`);
  assert.equal(r.rejectedRows, 0);
  assert.equal(r.coreRows, xs.length);
});

test('hampelMEstimator: tight knots make even modest deviations rejected', () => {
  // With a tiny outer knot c, a single moderate outlier is fully rejected.
  const xs = [10, 11, 12, 13, 14, 50];
  const r = hampelMEstimator(xs, 0.5, 1.0, 2.0);
  assert.ok(r.rejectedRows >= 1);
});

// ---------- builder integration ----------

test('builder: empty queue -> empty report', () => {
  const r = buildSourceRowTokenMEstimatorHampel([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('builder: single source, clean data, n>=4', () => {
  const queue = mkSeries('s', [10, 11, 12, 13, 14, 15]);
  const r = buildSourceRowTokenMEstimatorHampel(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 's');
  assert.equal(row.rowsKept, 6);
  assert.ok(Math.abs(row.hampel - 12.5) < 0.5);
  assert.equal(row.rejectedRows, 0);
});

test('builder: source below min-rows is dropped', () => {
  const queue = mkSeries('s', [1, 2, 3]);
  const r = buildSourceRowTokenMEstimatorHampel(queue, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('builder: minRows < 4 throws', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorHampel([], { minRows: 3, generatedAt: GEN }),
  );
});

test('builder: minHampel negative throws', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorHampel([], { minHampel: -1, generatedAt: GEN }),
  );
});

test('builder: knots invalid throws', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorHampel([], { a: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorHampel([], { a: 2, b: 1, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorHampel([], { b: 2, c: 2, generatedAt: GEN }),
  );
});

test('builder: top must be a positive integer', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorHampel([], { top: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorHampel([], { top: 1.5, generatedAt: GEN }),
  );
});

test('builder: invalid sort throws', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorHampel([], {
      // @ts-expect-error invalid
      sort: 'bogus',
      generatedAt: GEN,
    }),
  );
});

test('builder: invalid since/until throws', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorHampel([], {
      since: 'not-a-date',
      generatedAt: GEN,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorHampel([], {
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
  const r = buildSourceRowTokenMEstimatorHampel(queue, { generatedAt: GEN });
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
  const r = buildSourceRowTokenMEstimatorHampel(queue, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 5);
});

test('builder: empty/missing source coerced to "unknown"', () => {
  const queue = [...mkSeries('', [10, 11, 12, 13, 14])];
  const r = buildSourceRowTokenMEstimatorHampel(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('builder: minHampel gates by cohort selector', () => {
  const queue = [
    ...mkSeries('low', [1, 2, 3, 4, 5]),
    ...mkSeries('high', [100, 101, 102, 103, 104]),
  ];
  const r = buildSourceRowTokenMEstimatorHampel(queue, {
    minHampel: 50,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'high');
  assert.equal(r.droppedBelowMinHampel, 1);
});

test('builder: top cap applied after sort', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [10, 11, 12, 13, 14]),
    ...mkSeries('c', [100, 101, 102, 103, 104]),
  ];
  const r = buildSourceRowTokenMEstimatorHampel(queue, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[1]!.source, 'b');
  assert.equal(r.droppedBelowTopCap, 1);
});

test('builder: sort hampel-asc inverts order', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [100, 101, 102, 103, 104]),
  ];
  const r = buildSourceRowTokenMEstimatorHampel(queue, {
    sort: 'hampel-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
});

test('builder: sort source asc tiebreak', () => {
  const queue = [
    ...mkSeries('b', [10, 11, 12, 13, 14]),
    ...mkSeries('a', [10, 11, 12, 13, 14]),
  ];
  const r = buildSourceRowTokenMEstimatorHampel(queue, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('builder: sort by mean-gap-desc orders by |hampelMeanGap|', () => {
  const queue = [
    ...mkSeries('clean', [10, 11, 12, 13, 14, 15, 16, 17]),
    ...mkSeries('dirty', [10, 11, 12, 13, 14, 15, 16, 1e9]),
  ];
  const r = buildSourceRowTokenMEstimatorHampel(queue, {
    sort: 'mean-gap-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'dirty');
});

test('builder: sort by median-gap-desc orders by |hampelMedianGap|', () => {
  const queue = [
    ...mkSeries('clean', [10, 11, 12, 13, 14, 15, 16, 17]),
    ...mkSeries('skewed', [1, 1, 1, 1, 1, 1, 1, 100]),
  ];
  const r = buildSourceRowTokenMEstimatorHampel(queue, {
    sort: 'median-gap-desc',
    generatedAt: GEN,
  });
  assert.ok(
    Math.abs(r.sources[0]!.hampelMedianGap) >=
      Math.abs(r.sources[1]!.hampelMedianGap),
  );
});

test('builder: sort by rejected-desc orders by rejectedRows', () => {
  const queue = [
    ...mkSeries('clean', [10, 11, 12, 13, 14, 15, 16, 17]),
    ...mkSeries('dirty', [10, 11, 12, 13, 14, 1e8, 1e9, 1e10]),
  ];
  const r = buildSourceRowTokenMEstimatorHampel(queue, {
    sort: 'rejected-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'dirty');
  assert.ok(r.sources[0]!.rejectedRows >= r.sources[1]!.rejectedRows);
});

test('builder: signed gaps make sense (negative meanGap on right-skew)', () => {
  const queue = mkSeries('s', [10, 11, 12, 13, 14, 15, 16, 1e9]);
  const r = buildSourceRowTokenMEstimatorHampel(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(
    row.hampelMeanGap < 0,
    `expected negative hampelMeanGap, got ${row.hampelMeanGap}`,
  );
  assert.equal(row.rejectedRows, 1);
});

test('builder: window since/until filters rows', () => {
  const queue = mkSeries('s', [10, 11, 12, 13, 14, 15, 16, 17]);
  const r = buildSourceRowTokenMEstimatorHampel(queue, {
    since: '2026-04-27T00:02:00.000Z',
    until: '2026-04-27T00:06:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('builder: report fields shape', () => {
  const queue = mkSeries('s', [10, 11, 12, 13, 14]);
  const r = buildSourceRowTokenMEstimatorHampel(queue, { generatedAt: GEN });
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minRows, 4);
  assert.equal(r.minHampel, 0);
  assert.equal(r.a, 1.7);
  assert.equal(r.b, 3.4);
  assert.equal(r.c, 8.5);
  assert.equal(r.sort, 'hampel-desc');
  assert.equal(r.top, null);
});

test('builder: per-row bucket counts sum to rowsKept for every source', () => {
  const queue = [
    ...mkSeries('a', [10, 11, 12, 13, 14, 15, 16]),
    ...mkSeries('b', [100, 110, 120, 130, 1e6, 2e6, 3e6]),
  ];
  const r = buildSourceRowTokenMEstimatorHampel(queue, { generatedAt: GEN });
  for (const row of r.sources) {
    const sum =
      row.coreRows + row.plateauRows + row.descendingRows + row.rejectedRows;
    assert.equal(sum, row.rowsKept, `bucket sum mismatch for ${row.source}`);
  }
});

// ---------- property tests ----------

test('property: translation equivariance across builder', () => {
  const rng = lcg(7);
  for (let trial = 0; trial < 8; trial += 1) {
    const xs = Array.from({ length: 30 }, () => rng() * 1000);
    const shift = (rng() - 0.5) * 5000;
    const a = buildSourceRowTokenMEstimatorHampel(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const b = buildSourceRowTokenMEstimatorHampel(
      mkSeries(
        's',
        xs.map((x) => x + shift).filter((x) => x >= 0),
      ),
      { generatedAt: GEN },
    );
    if (
      a.sources.length === 1 &&
      b.sources.length === 1 &&
      xs.every((x) => x + shift >= 0)
    ) {
      const diff = b.sources[0]!.hampel - (a.sources[0]!.hampel + shift);
      assert.ok(Math.abs(diff) < 1e-3, `trial ${trial} diff ${diff}`);
    }
  }
});

test('property: positive scale equivariance across builder', () => {
  const rng = lcg(11);
  for (let trial = 0; trial < 8; trial += 1) {
    const xs = Array.from({ length: 25 }, () => rng() * 1000 + 1);
    const k = 1 + rng() * 9;
    const a = buildSourceRowTokenMEstimatorHampel(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const b = buildSourceRowTokenMEstimatorHampel(
      mkSeries(
        's',
        xs.map((x) => x * k),
      ),
      { generatedAt: GEN },
    );
    if (a.sources.length === 1 && b.sources.length === 1) {
      const expected = a.sources[0]!.hampel * k;
      const diff = b.sources[0]!.hampel - expected;
      assert.ok(
        Math.abs(diff) < 1e-3 * Math.max(1, Math.abs(expected)),
        `trial ${trial} diff ${diff} expected ${expected}`,
      );
    }
  }
});

test('property: clean uniform data -> hampel close to median', () => {
  const rng = lcg(23);
  for (let trial = 0; trial < 6; trial += 1) {
    const xs = Array.from({ length: 50 }, () => rng() * 100 + 50);
    const a = buildSourceRowTokenMEstimatorHampel(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const m = median(xs);
    const t = a.sources[0]!.hampel;
    assert.ok(Math.abs(t - m) < 15, `trial ${trial} hampel ${t} med ${m}`);
  }
});

test('property: bounded influence from extreme outlier injection', () => {
  const rng = lcg(31);
  for (let trial = 0; trial < 6; trial += 1) {
    const bulk = Array.from({ length: 30 }, () => rng() * 100 + 100);
    const a = buildSourceRowTokenMEstimatorHampel(mkSeries('s', bulk), {
      generatedAt: GEN,
    });
    const polluted = [...bulk, 1e12, 2e12];
    const b = buildSourceRowTokenMEstimatorHampel(mkSeries('s', polluted), {
      generatedAt: GEN,
    });
    const drift = Math.abs(b.sources[0]!.hampel - a.sources[0]!.hampel);
    assert.ok(drift < 50, `trial ${trial} drift ${drift}`);
    assert.ok(b.sources[0]!.rejectedRows >= 2);
  }
});

test('property: rejected outliers produce zero net pull on mu', () => {
  const bulk = [10, 11, 12, 13, 14, 15, 16];
  const r1 = buildSourceRowTokenMEstimatorHampel(
    mkSeries('s', [...bulk, 1e10]),
    { generatedAt: GEN },
  );
  const r2 = buildSourceRowTokenMEstimatorHampel(
    mkSeries('s', [...bulk, 1e10, 1e11, 1e12, 1e13, 1e14]),
    { generatedAt: GEN },
  );
  const drift = Math.abs(r2.sources[0]!.hampel - r1.sources[0]!.hampel);
  assert.ok(drift < 1e-3, `expected ~0 drift, got ${drift}`);
});

test('property: rejectedRows monotonic in outlier count', () => {
  const bulk = [10, 11, 12, 13, 14, 15];
  let prev = 0;
  for (let k = 0; k <= 4; k += 1) {
    const tail = Array.from({ length: k }, (_, i) => 1e6 * (i + 1));
    const r = buildSourceRowTokenMEstimatorHampel(
      mkSeries('s', [...bulk, ...tail]),
      { generatedAt: GEN },
    );
    const rej = r.sources[0]!.rejectedRows;
    assert.ok(rej >= prev, `k=${k} rejected ${rej} < prev ${prev}`);
    prev = rej;
  }
});

test('property: large knots -> hampel ~ mean', () => {
  const rng = lcg(101);
  for (let trial = 0; trial < 5; trial += 1) {
    const xs = Array.from({ length: 20 }, () => rng() * 100 + 10);
    const r = buildSourceRowTokenMEstimatorHampel(mkSeries('s', xs), {
      a: 1e7,
      b: 2e7,
      c: 3e7,
      generatedAt: GEN,
    });
    const mu = mean(xs);
    assert.ok(
      Math.abs(r.sources[0]!.hampel - mu) < 1e-3,
      `trial ${trial} hampel ${r.sources[0]!.hampel} mean ${mu}`,
    );
  }
});

test('property: convergence within 200 iterations on log-normal-ish data', () => {
  const rng = lcg(202);
  for (let trial = 0; trial < 5; trial += 1) {
    const xs = Array.from({ length: 100 }, () =>
      Math.exp(7 + 2 * (rng() - 0.5)),
    );
    const r = buildSourceRowTokenMEstimatorHampel(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    assert.ok(
      r.sources[0]!.iterations < 200,
      `trial ${trial} iter ${r.sources[0]!.iterations}`,
    );
  }
});

test('property: hampel finite and non-negative for non-negative inputs', () => {
  const rng = lcg(303);
  for (let trial = 0; trial < 10; trial += 1) {
    const xs = Array.from({ length: 30 }, () => rng() * 1000);
    const r = buildSourceRowTokenMEstimatorHampel(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const t = r.sources[0]!.hampel;
    assert.ok(Number.isFinite(t));
    assert.ok(t >= -1e-9, `hampel ${t} negative`);
  }
});

test('property: hampel lies within [min, max] of bulk after rejection', () => {
  const rng = lcg(404);
  for (let trial = 0; trial < 5; trial += 1) {
    const bulk = Array.from({ length: 30 }, () => 100 + rng() * 50);
    const xs = [...bulk, 1e10, 2e10];
    const r = buildSourceRowTokenMEstimatorHampel(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const t = r.sources[0]!.hampel;
    const lo = Math.min(...bulk);
    const hi = Math.max(...bulk);
    assert.ok(
      t >= lo - 1 && t <= hi + 1,
      `trial ${trial} hampel ${t} out of bulk [${lo},${hi}]`,
    );
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
    const r = buildSourceRowTokenMEstimatorHampel(series, { generatedAt: GEN });
    assert.equal(r.totalSources, nSrc);
    const sumKept = r.sources.reduce((a, b) => a + b.rowsKept, 0);
    assert.ok(sumKept <= r.totalRowsKept);
  }
});

test('property: bucket partition sums to rowsKept (random)', () => {
  const rng = lcg(606);
  for (let trial = 0; trial < 8; trial += 1) {
    const xs = Array.from({ length: 40 }, () => rng() * 1000);
    const r = buildSourceRowTokenMEstimatorHampel(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    assert.equal(
      row.coreRows + row.plateauRows + row.descendingRows + row.rejectedRows,
      row.rowsKept,
    );
  }
});
