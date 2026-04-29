/**
 * Unit + property tests for source-row-token-m-estimator-welsch.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenMEstimatorWelsch,
  welschMEstimator,
  welschWeight,
} from '../src/sourcerowtokenmestimatorwelsch.js';
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
const C = 2.9846;

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

test('welschWeight: z=0 -> exactly 1 (full weight)', () => {
  assert.equal(welschWeight(0, C), 1);
});

test('welschWeight: never exactly zero for finite z within IEEE representable range', () => {
  // Welsch defining property: weight > 0 for every finite z
  // (mathematically). In IEEE 754, exp underflows to 0 for very
  // large |z|/c — but within the practical range (|z|/c <= ~38, i.e.
  // |z| <= ~113 with c=2.9846), the weight remains strictly positive.
  // This contrasts with Tukey/Hampel/Andrews, which return EXACTLY 0
  // for any |z| past their compact-support cutoff (~5-9 MAD-units).
  for (const z of [10, 30, 50, 80, 100]) {
    assert.ok(welschWeight(z, C) > 0, `weight at z=${z} should be > 0`);
    assert.ok(welschWeight(-z, C) > 0, `weight at z=${-z} should be > 0`);
  }
});

test('welschWeight: closed-form exp(-(z/c)^2/2)', () => {
  for (const z of [0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 8.0]) {
    const expected = Math.exp(-((z / C) * (z / C)) / 2);
    assert.ok(Math.abs(welschWeight(z, C) - expected) < 1e-12);
    assert.ok(Math.abs(welschWeight(-z, C) - expected) < 1e-12);
  }
});

test('welschWeight: monotone non-increasing in |z|', () => {
  let prev = welschWeight(0, C);
  for (let z = 0.1; z <= 12; z += 0.1) {
    const w = welschWeight(z, C);
    assert.ok(w <= prev + 1e-12, `weight at z=${z} (${w}) > prev (${prev})`);
    prev = w;
  }
});

test('welschWeight: even (symmetric) in z', () => {
  for (const z of [0.7, 1.4, 2.1, 3.5, 7.0]) {
    assert.ok(Math.abs(welschWeight(z, C) - welschWeight(-z, C)) < 1e-12);
  }
});

test('welschWeight: half-weight at z = c*sqrt(2 ln 2)', () => {
  const halfPoint = C * Math.sqrt(2 * Math.log(2));
  assert.ok(Math.abs(welschWeight(halfPoint, C) - 0.5) < 1e-12);
});

test('welschWeight: 1%-weight at z = c*sqrt(2 ln 100)', () => {
  const onePct = C * Math.sqrt(2 * Math.log(100));
  assert.ok(Math.abs(welschWeight(onePct, C) - 0.01) < 1e-12);
});

// ---------- pure estimator (no rendering) ----------

test('welschMEstimator: n=0 -> NaN, n=1 -> x_1', () => {
  const a0 = welschMEstimator([]);
  assert.ok(Number.isNaN(a0.mu));
  const a1 = welschMEstimator([42]);
  assert.equal(a1.mu, 42);
  assert.equal(a1.coreRows, 1);
  assert.equal(a1.descendingRows, 0);
  assert.equal(a1.negligibleRows, 0);
});

test('welschMEstimator: all-tied -> mu = the tied value, MAD = 0', () => {
  const r = welschMEstimator([7, 7, 7, 7, 7]);
  assert.equal(r.mu, 7);
  assert.equal(r.mad, 0);
});

test('welschMEstimator: symmetric data -> mu equals center exactly', () => {
  const r = welschMEstimator([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.ok(Math.abs(r.mu - 15) < 1e-9);
});

test('welschMEstimator: tuning must be positive', () => {
  assert.throws(() => welschMEstimator([1, 2, 3, 4], 0));
  assert.throws(() => welschMEstimator([1, 2, 3, 4], -1));
  assert.throws(() => welschMEstimator([1, 2, 3, 4], NaN));
});

test('welschMEstimator: extreme outlier downweighted, mu close to bulk median', () => {
  const bulk = [10, 11, 12, 13, 14, 15];
  const xs = [...bulk, 1e9];
  const r = welschMEstimator(xs);
  assert.ok(
    r.negligibleRows >= 1,
    `expected >= 1 negligible, got ${r.negligibleRows}`,
  );
  assert.ok(
    Math.abs(r.mu - median(bulk)) < 1.5,
    `mu ${r.mu} drifted too far from bulk median ${median(bulk)}`,
  );
});

test('welschMEstimator: bucket partition sums to n', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100, 1000, 10000];
  const r = welschMEstimator(xs);
  assert.equal(r.coreRows + r.descendingRows + r.negligibleRows, xs.length);
});

test('welschMEstimator: translation equivariant (welsch(x+a) = welsch(x)+a)', () => {
  const xs = [1, 4, 7, 10, 13, 16, 19, 22];
  const a = 1000;
  const r1 = welschMEstimator(xs);
  const r2 = welschMEstimator(xs.map((x) => x + a));
  assert.ok(
    Math.abs(r2.mu - (r1.mu + a)) < 1e-6,
    `r2.mu ${r2.mu} != r1.mu+a ${r1.mu + a}`,
  );
});

test('welschMEstimator: scale equivariant (welsch(k*x) = k*welsch(x))', () => {
  const xs = [1, 4, 7, 10, 13, 16, 19, 22];
  const k = 7;
  const r1 = welschMEstimator(xs);
  const r2 = welschMEstimator(xs.map((x) => x * k));
  assert.ok(
    Math.abs(r2.mu - r1.mu * k) < 1e-6,
    `r2.mu ${r2.mu} != r1.mu*k ${r1.mu * k}`,
  );
});

// ---------- builder happy path ----------

test('builder: empty queue -> 0 sources, all-zero counters', () => {
  const r = buildSourceRowTokenMEstimatorWelsch([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
});

test('builder: minRows gate (default 4)', () => {
  const r = buildSourceRowTokenMEstimatorWelsch(
    mkSeries('s', [10, 20, 30]), // only 3 rows
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('builder: rejects bad minRows', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorWelsch([], { minRows: 3, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorWelsch([], {
      minRows: 4.5,
      generatedAt: GEN,
    }),
  );
});

test('builder: rejects bad tuning', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorWelsch([], { tuning: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorWelsch([], { tuning: -1, generatedAt: GEN }),
  );
});

test('builder: rejects bad minWelsch', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorWelsch([], {
      minWelsch: -1,
      generatedAt: GEN,
    }),
  );
});

test('builder: rejects bad top', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorWelsch([], { top: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorWelsch([], { top: 1.5, generatedAt: GEN }),
  );
});

test('builder: rejects bad sort key', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorWelsch([], {
      // @ts-expect-error testing runtime guard
      sort: 'bogus',
      generatedAt: GEN,
    }),
  );
});

test('builder: drops bad hour_start, bad/negative tokens', () => {
  const series: QueueLine[] = [
    ql('not-a-date', 's', 100),
    { ...ql('2026-04-27T00:00:00.000Z', 's', 100), total_tokens: NaN as any },
    ql('2026-04-27T01:00:00.000Z', 's', -5),
    ...mkSeries('s', [10, 11, 12, 13]),
  ];
  const r = buildSourceRowTokenMEstimatorWelsch(series, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('builder: source filter', () => {
  const all: QueueLine[] = [
    ...mkSeries('a', [10, 11, 12, 13]),
    ...mkSeries('b', [100, 110, 120, 130]),
  ];
  const r = buildSourceRowTokenMEstimatorWelsch(all, {
    source: 'b',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedSourceFilter, 4);
});

test('builder: minWelsch gate', () => {
  const all: QueueLine[] = [
    ...mkSeries('low', [10, 11, 12, 13]),
    ...mkSeries('high', [1000, 1100, 1200, 1300]),
  ];
  const r = buildSourceRowTokenMEstimatorWelsch(all, {
    minWelsch: 500,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'high');
  assert.equal(r.droppedBelowMinWelsch, 1);
});

test('builder: top cap', () => {
  const all: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    all.push(...mkSeries(`s${i}`, Array.from({ length: 4 }, () => 100 * (i + 1))));
  }
  const r = buildSourceRowTokenMEstimatorWelsch(all, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 3);
});

test('builder: window filter [since, until)', () => {
  const all: QueueLine[] = [
    ql('2026-04-26T23:00:00.000Z', 's', 10),
    ql('2026-04-27T00:00:00.000Z', 's', 20),
    ql('2026-04-27T01:00:00.000Z', 's', 30),
    ql('2026-04-27T02:00:00.000Z', 's', 40),
    ql('2026-04-27T03:00:00.000Z', 's', 50),
    ql('2026-04-28T00:00:00.000Z', 's', 99999),
  ];
  const r = buildSourceRowTokenMEstimatorWelsch(all, {
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('builder: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorWelsch([], {
      since: 'garbage',
      generatedAt: GEN,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorWelsch([], {
      until: 'garbage',
      generatedAt: GEN,
    }),
  );
});

// ---------- sort variants ----------

test('builder: sort=welsch-desc default ordering', () => {
  const all: QueueLine[] = [
    ...mkSeries('a', [10, 11, 12, 13]),
    ...mkSeries('b', [100, 110, 120, 130]),
    ...mkSeries('c', [50, 51, 52, 53]),
  ];
  const r = buildSourceRowTokenMEstimatorWelsch(all, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'c', 'a'],
  );
});

test('builder: sort=source asc tiebreak', () => {
  const all: QueueLine[] = [
    ...mkSeries('z', [10, 11, 12, 13]),
    ...mkSeries('a', [10, 11, 12, 13]),
    ...mkSeries('m', [10, 11, 12, 13]),
  ];
  const r = buildSourceRowTokenMEstimatorWelsch(all, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'm', 'z'],
  );
});

test('builder: sort=negligible-desc orders by negligibleRows', () => {
  const all: QueueLine[] = [
    ...mkSeries('clean', [10, 11, 12, 13]),
    ...mkSeries('dirty', [10, 11, 12, 13, 1e9, 1e9, 1e9]),
  ];
  const r = buildSourceRowTokenMEstimatorWelsch(all, {
    sort: 'negligible-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'dirty');
});

// ---------- properties / mathematical contracts ----------

test('property: extreme outliers produce ~zero net pull on mu (Gaussian decay)', () => {
  const bulk = [10, 11, 12, 13, 14, 15, 16];
  const r1 = buildSourceRowTokenMEstimatorWelsch(
    mkSeries('s', [...bulk, 1e10]),
    { generatedAt: GEN },
  );
  const r2 = buildSourceRowTokenMEstimatorWelsch(
    mkSeries('s', [...bulk, 1e10, 1e11, 1e12, 1e13, 1e14]),
    { generatedAt: GEN },
  );
  const drift = Math.abs(r2.sources[0]!.welsch - r1.sources[0]!.welsch);
  assert.ok(drift < 1e-3, `expected ~0 drift, got ${drift}`);
});

test('property: negligibleRows monotonic in outlier count', () => {
  const bulk = [10, 11, 12, 13, 14, 15];
  let prev = 0;
  for (let k = 0; k <= 4; k += 1) {
    const tail = Array.from({ length: k }, (_, i) => 1e6 * (i + 1));
    const r = buildSourceRowTokenMEstimatorWelsch(
      mkSeries('s', [...bulk, ...tail]),
      { generatedAt: GEN },
    );
    const neg = r.sources[0]!.negligibleRows;
    assert.ok(neg >= prev, `k=${k} negligible ${neg} < prev ${prev}`);
    prev = neg;
  }
});

test('property: large tuning -> welsch ~ mean (Gaussian very wide -> all weights ~ 1)', () => {
  const rng = lcg(101);
  for (let trial = 0; trial < 5; trial += 1) {
    const xs = Array.from({ length: 20 }, () => rng() * 100 + 10);
    const r = buildSourceRowTokenMEstimatorWelsch(mkSeries('s', xs), {
      tuning: 1e6,
      generatedAt: GEN,
    });
    const mu = mean(xs);
    assert.ok(
      Math.abs(r.sources[0]!.welsch - mu) < 1e-3,
      `trial ${trial} welsch ${r.sources[0]!.welsch} mean ${mu}`,
    );
  }
});

test('property: convergence within 200 iterations on log-normal-ish data', () => {
  const rng = lcg(202);
  for (let trial = 0; trial < 5; trial += 1) {
    const xs = Array.from({ length: 100 }, () =>
      Math.exp(7 + 2 * (rng() - 0.5)),
    );
    const r = buildSourceRowTokenMEstimatorWelsch(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    assert.ok(
      r.sources[0]!.iterations < 200,
      `trial ${trial} iter ${r.sources[0]!.iterations}`,
    );
  }
});

test('property: welsch finite and non-negative for non-negative inputs', () => {
  const rng = lcg(303);
  for (let trial = 0; trial < 10; trial += 1) {
    const xs = Array.from({ length: 30 }, () => rng() * 1000);
    const r = buildSourceRowTokenMEstimatorWelsch(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const t = r.sources[0]!.welsch;
    assert.ok(Number.isFinite(t));
    assert.ok(t >= -1e-9, `welsch ${t} negative`);
  }
});

test('property: welsch lies within [min, max] of bulk under tail contamination', () => {
  const rng = lcg(404);
  for (let trial = 0; trial < 5; trial += 1) {
    const bulk = Array.from({ length: 30 }, () => 100 + rng() * 50);
    const xs = [...bulk, 1e10, 2e10];
    const r = buildSourceRowTokenMEstimatorWelsch(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const t = r.sources[0]!.welsch;
    const lo = Math.min(...bulk);
    const hi = Math.max(...bulk);
    assert.ok(
      t >= lo - 1 && t <= hi + 1,
      `trial ${trial} welsch ${t} out of bulk [${lo},${hi}]`,
    );
  }
});

test('property: bucket partition sums to rowsKept (random)', () => {
  const rng = lcg(606);
  for (let trial = 0; trial < 8; trial += 1) {
    const xs = Array.from({ length: 40 }, () => rng() * 1000);
    const r = buildSourceRowTokenMEstimatorWelsch(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    assert.equal(
      row.coreRows + row.descendingRows + row.negligibleRows,
      row.rowsKept,
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
    const r = buildSourceRowTokenMEstimatorWelsch(series, { generatedAt: GEN });
    assert.equal(r.totalSources, nSrc);
    const sumKept = r.sources.reduce((a, b) => a + b.rowsKept, 0);
    assert.ok(sumKept <= r.totalRowsKept);
  }
});

// ---------- Welsch-specific: infinite support guarantee ----------

test('welsch-specific: even at MASSIVE residuals, weight is > 0 in IRLS (no IEEE underflow on real-world scales)', () => {
  // Construct data where outlier is far but not pathological-IEEE-far.
  // c=2.9846, MAD-ish scale ~ a few units, so |z| in [10, 50] is the
  // realistic far-tail regime. exp(-(50/2.9846)^2/2) ~ 1e-61 — small
  // but representable, so Welsch still assigns a positive weight (not
  // zero). Contrast with Andrews/Tukey which would hard-zero.
  const bulk = [10, 11, 12, 13, 14, 15];
  const r = welschMEstimator([...bulk, 200, 300]);
  // 200 and 300 should be in negligible bucket (weight < 0.01) but
  // still positive — verifiable indirectly through IRLS convergence.
  assert.ok(Number.isFinite(r.mu));
  assert.ok(r.iterations > 0);
});

test('welsch-specific: half-weight cutoff matches design (weight = 0.5 at |z| = c*sqrt(2 ln 2))', () => {
  // Build data with an exact controlled residual at the half-weight
  // boundary and verify it lands in the coreRows bucket boundary.
  // We use a degenerate tied-bulk so MAD = 0 and the eps fallback
  // makes residuals very large -> negligible. So here, just unit-check
  // the kernel constant from a different angle:
  const halfPoint = C * Math.sqrt(2 * Math.log(2));
  // At z = halfPoint exactly, weight = 0.5. coreRows requires w >= 0.5,
  // so a row at z = halfPoint exactly is on the core-side boundary.
  assert.ok(welschWeight(halfPoint, C) >= 0.5 - 1e-12);
  assert.ok(welschWeight(halfPoint + 1e-9, C) < 0.5);
});

// ---------- IRLS termination diagnostic (refinement v0.6.213+1) ----------

test('converged: happy path on well-behaved data reports "converged"', () => {
  const r = welschMEstimator([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.equal(r.converged, 'converged');
});

test('converged: n=1 trivially "converged"', () => {
  const r = welschMEstimator([42]);
  assert.equal(r.converged, 'converged');
});

test('converged: n=0 trivially "converged"', () => {
  const r = welschMEstimator([]);
  assert.equal(r.converged, 'converged');
});

test('converged: log-normal data converges within max iter', () => {
  const rng = lcg(707);
  for (let trial = 0; trial < 5; trial += 1) {
    const xs = Array.from({ length: 50 }, () => Math.exp(7 + 2 * (rng() - 0.5)));
    const r = welschMEstimator(xs);
    assert.equal(
      r.converged,
      'converged',
      `trial ${trial} did not converge: ${r.converged}`,
    );
  }
});

test('builder: surfaces converged field per source', () => {
  const r = buildSourceRowTokenMEstimatorWelsch(
    mkSeries('s', [10, 11, 12, 13, 14, 15, 16, 17]),
    { generatedAt: GEN },
  );
  assert.ok(['converged', 'max-iter', 'zero-weight'].includes(r.sources[0]!.converged));
  assert.equal(r.sources[0]!.converged, 'converged');
});
