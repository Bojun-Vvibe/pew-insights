import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenBroadenedMedian,
  harrellDavisMedianWeights,
  regIncompleteBeta,
} from '../src/sourcerowtokenbroadenedmedian.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
  model = 'm1',
  device_id = 'd1',
): QueueLine {
  return {
    source,
    model,
    hour_start,
    device_id,
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

/**
 * Reference Harrell-Davis broadened median computed independently
 * via a separate naive incomplete-beta evaluation (Simpson's rule on
 * the Beta PDF). Slow but auditable.
 */
function hdReference(xs: number[]): number {
  const n = xs.length;
  const sorted = xs.slice().sort((a, b) => a - b);
  const a = (n + 1) / 2;
  const b = a;
  // Simpson's rule cumulative Beta CDF using PDF f(t) = t^(a-1)(1-t)^(b-1)/B(a,b).
  // We compute a high-resolution numerical CDF then look up at i/n.
  const STEPS = 8000;
  // ln B(a,b) via Stirling-ish approximation suffices since a = b = (n+1)/2.
  // Easier: compute unnormalized integrals and divide by total at t=1.
  const dx = 1 / STEPS;
  // simpson cumulative
  let prev = 0;
  const cum = new Float64Array(STEPS + 1);
  cum[0] = 0;
  // trapezoid for simplicity (very fine grid)
  function pdf(t: number): number {
    if (t <= 0 || t >= 1) return 0;
    return Math.pow(t, a - 1) * Math.pow(1 - t, b - 1);
  }
  for (let k = 1; k <= STEPS; k += 1) {
    const t1 = (k - 1) * dx;
    const t2 = k * dx;
    const inc = ((pdf(t1) + pdf(t2)) / 2) * dx;
    cum[k] = prev + inc;
    prev = cum[k]!;
  }
  const total = cum[STEPS]!;
  // Normalize.
  for (let k = 0; k <= STEPS; k += 1) cum[k]! / total;
  function cdfAt(x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const idx = x * STEPS;
    const lo = Math.floor(idx);
    const hi = Math.min(STEPS, lo + 1);
    const f = idx - lo;
    return ((1 - f) * cum[lo]! + f * cum[hi]!) / total;
  }
  let hd = 0;
  let prevC = 0;
  for (let i = 1; i <= n; i += 1) {
    const c = cdfAt(i / n);
    const w = c - prevC;
    hd += w * sorted[i - 1]!;
    prevC = c;
  }
  return hd;
}

// ---------- shape / option validation ----------

test('hd: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenBroadenedMedian([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 4);
  assert.equal(r.minBroadenedMedian, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'hd-desc');
  assert.equal(r.generatedAt, GEN);
});

test('hd: minRows below absolute floor 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenBroadenedMedian([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('hd: non-integer minRows throws', () => {
  assert.throws(
    () => buildSourceRowTokenBroadenedMedian([], { minRows: 4.5 }),
    /minRows must be an integer/,
  );
});

test('hd: negative minBroadenedMedian throws', () => {
  assert.throws(
    () => buildSourceRowTokenBroadenedMedian([], { minBroadenedMedian: -1 }),
    /minBroadenedMedian must be a finite, non-negative number/,
  );
});

test('hd: NaN minBroadenedMedian throws', () => {
  assert.throws(
    () => buildSourceRowTokenBroadenedMedian([], { minBroadenedMedian: NaN }),
    /minBroadenedMedian must be a finite, non-negative number/,
  );
});

test('hd: top below 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenBroadenedMedian([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('hd: non-integer top throws', () => {
  assert.throws(
    () => buildSourceRowTokenBroadenedMedian([], { top: 2.5 }),
    /top must be a positive integer/,
  );
});

test('hd: invalid sort key throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBroadenedMedian([], {
        // @ts-expect-error testing invalid sort
        sort: 'bogus',
      }),
    /sort must be one of/,
  );
});

test('hd: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenBroadenedMedian([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('hd: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenBroadenedMedian([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

// ---------- weight properties ----------

test('hd weights: sum to exactly 1 for n = 4..40', () => {
  for (let n = 4; n <= 40; n += 1) {
    const w = harrellDavisMedianWeights(n);
    let s = 0;
    for (const wi of w) s += wi;
    assert.ok(Math.abs(s - 1) < 1e-12, `n=${n} sum=${s}`);
  }
});

test('hd weights: all strictly positive for n >= 4', () => {
  for (let n = 4; n <= 30; n += 1) {
    const w = harrellDavisMedianWeights(n);
    for (let i = 0; i < n; i += 1) {
      assert.ok(w[i]! > 0, `n=${n} i=${i} w=${w[i]}`);
    }
  }
});

test('hd weights: symmetric (w_i == w_{n+1-i}) for all n', () => {
  for (let n = 4; n <= 30; n += 1) {
    const w = harrellDavisMedianWeights(n);
    for (let i = 0; i < n; i += 1) {
      assert.ok(
        Math.abs(w[i]! - w[n - 1 - i]!) < 1e-8,
        `n=${n} i=${i} w[i]=${w[i]} w[n-1-i]=${w[n - 1 - i]}`,
      );
    }
  }
});

test('hd weights: maximum at the center for n = 5..30', () => {
  for (let n = 5; n <= 30; n += 1) {
    const w = harrellDavisMedianWeights(n);
    const centerIdx = Math.ceil((n + 1) / 2) - 1;
    const wMax = Math.max(...w);
    assert.equal(w[centerIdx], wMax, `n=${n} center=${centerIdx}`);
  }
});

test('hd weights: minimum at the extremes for n >= 5', () => {
  for (let n = 5; n <= 30; n += 1) {
    const w = harrellDavisMedianWeights(n);
    const wMin = Math.min(...w);
    // At least one extreme attains the min.
    assert.ok(
      Math.abs(w[0]! - wMin) < 1e-15 || Math.abs(w[n - 1]! - wMin) < 1e-15,
      `n=${n} extremes=${w[0]},${w[n - 1]} min=${wMin}`,
    );
  }
});

test('hd weights: monotone non-increasing from center towards each edge', () => {
  for (let n = 6; n <= 30; n += 1) {
    const w = harrellDavisMedianWeights(n);
    const centerIdx = Math.floor((n - 1) / 2);
    for (let i = 1; i <= centerIdx; i += 1) {
      assert.ok(
        w[i]! >= w[i - 1]! - 1e-15,
        `n=${n} i=${i} non-monotone left: w[i-1]=${w[i - 1]} w[i]=${w[i]}`,
      );
    }
    for (let i = n - 2; i >= n - 1 - centerIdx; i -= 1) {
      assert.ok(
        w[i]! >= w[i + 1]! - 1e-15,
        `n=${n} i=${i} non-monotone right: w[i]=${w[i]} w[i+1]=${w[i + 1]}`,
      );
    }
  }
});

test('hd weights: n=1 -> single weight of 1', () => {
  const w = harrellDavisMedianWeights(1);
  assert.equal(w.length, 1);
  assert.ok(Math.abs(w[0]! - 1) < 1e-12);
});

test('hd weights: throws on non-positive n', () => {
  assert.throws(
    () => harrellDavisMedianWeights(0),
    /positive integer/,
  );
  assert.throws(
    () => harrellDavisMedianWeights(-1),
    /positive integer/,
  );
  assert.throws(
    () => harrellDavisMedianWeights(2.5),
    /positive integer/,
  );
});

// ---------- regIncompleteBeta sanity ----------

test('regIncompleteBeta: I_0 = 0 and I_1 = 1', () => {
  for (const a of [1, 2.5, 5, 10, 50.5]) {
    for (const b of [1, 2.5, 5, 10, 50.5]) {
      assert.equal(regIncompleteBeta(a, b, 0), 0);
      assert.equal(regIncompleteBeta(a, b, 1), 1);
      assert.equal(regIncompleteBeta(a, b, -0.5), 0);
      assert.equal(regIncompleteBeta(a, b, 1.5), 1);
    }
  }
});

test('regIncompleteBeta: I_0.5(a, a) = 0.5 by symmetry', () => {
  for (const a of [1, 2.5, 5, 10.5, 50.5]) {
    const v = regIncompleteBeta(a, a, 0.5);
    assert.ok(Math.abs(v - 0.5) < 1e-10, `a=${a} v=${v}`);
  }
});

test('regIncompleteBeta: monotone increasing in x', () => {
  const a = 5.5;
  const b = 5.5;
  let prev = 0;
  for (let k = 1; k <= 99; k += 1) {
    const x = k / 100;
    const v = regIncompleteBeta(a, b, x);
    assert.ok(v >= prev - 1e-15, `non-monotone at x=${x}: prev=${prev} v=${v}`);
    prev = v;
  }
});

// ---------- HD numeric correctness ----------

test('hd: matches independent Simpson reference within 1e-3 (n=4..12)', () => {
  for (let n = 4; n <= 12; n += 1) {
    const xs = Array.from({ length: n }, (_, i) => (i + 1) * 7);
    const r = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    assert.equal(r.sources.length, 1);
    const got = r.sources[0]!.broadenedMedian;
    const ref = hdReference(xs);
    assert.ok(
      Math.abs(got - ref) < Math.max(1e-3, 1e-3 * Math.abs(ref)),
      `n=${n} got=${got} ref=${ref}`,
    );
  }
});

test('hd: constant series -> HD == constant (within FP eps)', () => {
  for (let n = 4; n <= 20; n += 1) {
    const xs = Array.from({ length: n }, () => 42);
    const r = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    assert.ok(Math.abs(row.broadenedMedian - 42) < 1e-9);
    assert.equal(row.median, 42);
    assert.equal(row.mean, 42);
    assert.ok(Math.abs(row.hdMeanGap) < 1e-9);
    assert.ok(Math.abs(row.hdMedianGap) < 1e-9);
  }
});

test('hd: all-zero series -> HD == 0 exactly', () => {
  const xs = [0, 0, 0, 0, 0, 0];
  const r = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.broadenedMedian, 0);
});

test('hd: symmetric distribution -> HD == median (within tol)', () => {
  // Symmetric: 1, 2, 3, 4, 5, 6, 7
  const xs = [1, 2, 3, 4, 5, 6, 7];
  const r = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.broadenedMedian - 4) < 1e-9, `hd=${row.broadenedMedian}`);
  assert.equal(row.median, 4);
});

test('hd: scale-equivariant: HD(c*x) == c * HD(x)', () => {
  const xs = [3, 7, 11, 13, 17, 19, 23];
  const r1 = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenBroadenedMedian(
    mkSeries(
      's',
      xs.map((x) => x * 100),
    ),
    { generatedAt: GEN },
  );
  const got1 = r1.sources[0]!.broadenedMedian;
  const got2 = r2.sources[0]!.broadenedMedian;
  assert.ok(Math.abs(got2 - 100 * got1) < 1e-6, `got1=${got1} got2=${got2}`);
});

test('hd: translation-equivariant: HD(x + c) == HD(x) + c', () => {
  const xs = [3, 7, 11, 13, 17];
  const r1 = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenBroadenedMedian(
    mkSeries(
      's',
      xs.map((x) => x + 1000),
    ),
    { generatedAt: GEN },
  );
  const got1 = r1.sources[0]!.broadenedMedian;
  const got2 = r2.sources[0]!.broadenedMedian;
  assert.ok(Math.abs(got2 - got1 - 1000) < 1e-6, `got1=${got1} got2=${got2}`);
});

test('hd: HD is bounded by min and max of samples', () => {
  for (let trial = 0; trial < 20; trial += 1) {
    const n = 4 + (trial % 12);
    const xs = Array.from({ length: n }, (_, i) => (i * 13 + trial * 7) % 1000);
    const r = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    const mn = Math.min(...xs);
    const mx = Math.max(...xs);
    assert.ok(
      row.broadenedMedian >= mn - 1e-9 && row.broadenedMedian <= mx + 1e-9,
      `hd=${row.broadenedMedian} min=${mn} max=${mx}`,
    );
  }
});

test('hd: permutation invariance', () => {
  const xs = [11, 3, 17, 5, 23, 7, 13];
  const r1 = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const xs2 = [...xs].reverse();
  const r2 = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs2), {
    generatedAt: GEN,
  });
  assert.ok(
    Math.abs(r1.sources[0]!.broadenedMedian - r2.sources[0]!.broadenedMedian) <
      1e-9,
  );
});

test('hd: increasing series -> HD lies between mean and median (or equal)', () => {
  // For monotone-increasing sequences, HD should be near median
  // (smooth median). Always inside [median - mean, median + mean] band.
  const xs = [1, 2, 4, 8, 16, 32, 64, 128];
  const r = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  // sample median = (8+16)/2 = 12; mean = 255/8 = 31.875.
  // HD should be relatively close to median 12 (not all the way up to mean).
  assert.ok(row.broadenedMedian < row.mean, `hd=${row.broadenedMedian} mean=${row.mean}`);
  assert.ok(
    Math.abs(row.broadenedMedian - row.median) < (row.mean - row.median),
    `hd farther from median than mean is: hd=${row.broadenedMedian} median=${row.median} mean=${row.mean}`,
  );
});

test('hd: outlier robustness — single contaminated point shifts mean far more than HD', () => {
  const xs = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const r1 = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const xs2 = [...xs];
  xs2[xs2.length - 1] = 1_000_000;
  const r2 = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs2), {
    generatedAt: GEN,
  });
  const meanShift = Math.abs(
    r2.sources[0]!.mean - r1.sources[0]!.mean,
  );
  const hdShift = Math.abs(
    r2.sources[0]!.broadenedMedian - r1.sources[0]!.broadenedMedian,
  );
  assert.ok(
    hdShift * 100 < meanShift,
    `hdShift=${hdShift} should be << meanShift=${meanShift}`,
  );
});

// ---------- per-source aggregation / dropping ----------

test('hd: drops sources below minRows', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3]), // n=3, dropped
    ...mkSeries('b', [10, 20, 30, 40]), // n=4, kept
  ];
  const r = buildSourceRowTokenBroadenedMedian(queue, { generatedAt: GEN });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('hd: drops invalid hour_start rows', () => {
  const queue = [
    ql('not-a-date', 'a', 5),
    ...mkSeries('a', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenBroadenedMedian(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('hd: drops invalid total_tokens', () => {
  const queue = [
    ql('2026-04-27T00:00:00.000Z', 'a', NaN),
    ql('2026-04-27T01:00:00.000Z', 'a', Infinity),
    ...mkSeries('a', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenBroadenedMedian(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 2);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('hd: drops negative total_tokens', () => {
  const queue = [
    ql('2026-04-27T00:00:00.000Z', 'a', -1),
    ...mkSeries('a', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenBroadenedMedian(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('hd: empty source -> source = "unknown"', () => {
  const queue = mkSeries('', [1, 2, 3, 4]);
  const r = buildSourceRowTokenBroadenedMedian(queue, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('hd: --source filter restricts to one source', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4]),
    ...mkSeries('b', [100, 200, 300, 400]),
  ];
  const r = buildSourceRowTokenBroadenedMedian(queue, {
    source: 'b',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedSourceFilter, 4);
});

test('hd: since/until clip', () => {
  const queue = mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8]);
  const r = buildSourceRowTokenBroadenedMedian(queue, {
    since: '2026-04-27T00:03:00.000Z',
    until: '2026-04-27T00:07:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.rowsKept, 4); // indices 3,4,5,6 -> 4,5,6,7
});

test('hd: minBroadenedMedian filter drops sources', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4]), // hd ~ 2.5
    ...mkSeries('b', [100, 200, 300, 400]), // hd ~ 250
  ];
  const r = buildSourceRowTokenBroadenedMedian(queue, {
    minBroadenedMedian: 50,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinBroadenedMedian, 1);
});

test('hd: top cap surfaces droppedBelowTopCap', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4]),
    ...mkSeries('b', [10, 20, 30, 40]),
    ...mkSeries('c', [100, 200, 300, 400]),
  ];
  const r = buildSourceRowTokenBroadenedMedian(queue, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

// ---------- sort keys ----------

test('hd: sort hd-desc', () => {
  const queue = [
    ...mkSeries('low', [1, 2, 3, 4]),
    ...mkSeries('mid', [10, 20, 30, 40]),
    ...mkSeries('high', [100, 200, 300, 400]),
  ];
  const r = buildSourceRowTokenBroadenedMedian(queue, {
    sort: 'hd-desc',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['high', 'mid', 'low'],
  );
});

test('hd: sort hd-asc', () => {
  const queue = [
    ...mkSeries('low', [1, 2, 3, 4]),
    ...mkSeries('mid', [10, 20, 30, 40]),
    ...mkSeries('high', [100, 200, 300, 400]),
  ];
  const r = buildSourceRowTokenBroadenedMedian(queue, {
    sort: 'hd-asc',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['low', 'mid', 'high'],
  );
});

test('hd: sort source asc tiebreak', () => {
  const queue = [
    ...mkSeries('z', [10, 20, 30, 40]),
    ...mkSeries('a', [10, 20, 30, 40]),
    ...mkSeries('m', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenBroadenedMedian(queue, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'm', 'z'],
  );
});

test('hd: sort rows desc', () => {
  const queue = [
    ...mkSeries('big', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    ...mkSeries('small', [1, 2, 3, 4]),
    ...mkSeries('mid', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenBroadenedMedian(queue, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['big', 'mid', 'small'],
  );
});

test('hd: sort mean-gap-desc orders by |hdMeanGap| desc', () => {
  const queue = [
    ...mkSeries('symm', [10, 11, 12, 13, 14, 15, 16, 17]), // small gap
    ...mkSeries('skewed', [1, 2, 3, 4, 5, 6, 7, 1000]), // large gap
  ];
  const r = buildSourceRowTokenBroadenedMedian(queue, {
    sort: 'mean-gap-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'skewed');
});

// ---------- byproducts ----------

test('hd: walsh-style byproducts: weights consistent', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7];
  const r = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(row.centerWeight > 0, `centerW=${row.centerWeight}`);
  assert.ok(row.weightSpread > 0, `wSpread=${row.weightSpread}`);
  // For n = 7: center weight should be > 1/n = 0.143 (smoothing concentrates weight).
  assert.ok(
    row.centerWeight > 1 / xs.length,
    `centerWeight ${row.centerWeight} should exceed uniform 1/n = ${1 / xs.length}`,
  );
});

test('hd: hdMeanGap and hdMedianGap signed correctly', () => {
  // Right-skewed: mean > median, HD ~ median (slightly above)
  const xs = [1, 1, 1, 1, 100];
  const r = buildSourceRowTokenBroadenedMedian(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  // mean = 20.8, median = 1.
  assert.ok(row.hdMeanGap < 0, `hd-mean should be negative: ${row.hdMeanGap}`);
});

test('hd: rowsKept counted before drop gates', () => {
  const queue = [
    ql('2026-04-27T00:00:00.000Z', 'a', NaN),
    ql('2026-04-27T01:00:00.000Z', 'a', -1),
    ...mkSeries('a', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenBroadenedMedian(queue, { generatedAt: GEN });
  assert.equal(r.totalRowsKept, 5);
  assert.equal(r.sources[0]!.rowsKept, 5);
});

// ---------- determinism ----------

test('hd: same input -> same output (deterministic)', () => {
  const queue = [
    ...mkSeries('a', [3, 7, 11, 13, 17, 19]),
    ...mkSeries('b', [100, 200, 300, 400]),
  ];
  const r1 = buildSourceRowTokenBroadenedMedian(queue, { generatedAt: GEN });
  const r2 = buildSourceRowTokenBroadenedMedian(queue, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});
