/**
 * Unit + property tests for source-row-token-m-estimator-andrews.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenMEstimatorAndrews,
  andrewsMEstimator,
  andrewsWeight,
} from '../src/sourcerowtokenmestimatorandrews.js';
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
const A = 1.339;

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

test('andrewsWeight: z=0 -> exactly 1 (full weight, limit value)', () => {
  assert.equal(andrewsWeight(0, A), 1);
});

test('andrewsWeight: |z| > A*pi -> exactly 0 (rejected)', () => {
  const cutoff = A * Math.PI;
  assert.equal(andrewsWeight(cutoff + 1e-9, A), 0);
  assert.equal(andrewsWeight(-(cutoff + 1e-9), A), 0);
  assert.equal(andrewsWeight(100, A), 0);
  assert.equal(andrewsWeight(-100, A), 0);
});

test('andrewsWeight: |z| = A*pi -> approx 0 (sin(pi) = 0)', () => {
  const cutoff = A * Math.PI;
  assert.ok(Math.abs(andrewsWeight(cutoff, A)) < 1e-12);
  assert.ok(Math.abs(andrewsWeight(-cutoff, A)) < 1e-12);
});

test('andrewsWeight: closed-form A*sin(z/A)/z for inside support', () => {
  for (const z of [0.5, 1.0, 1.5, 2.0, 3.0, 4.0]) {
    if (Math.abs(z) > A * Math.PI) continue;
    const expected = (A * Math.sin(z / A)) / z;
    assert.ok(Math.abs(andrewsWeight(z, A) - expected) < 1e-12);
    assert.ok(Math.abs(andrewsWeight(-z, A) - expected) < 1e-12);
  }
});

test('andrewsWeight: monotone non-increasing in |z| on rising arch [0, A*pi/2]', () => {
  const halfCutoff = (A * Math.PI) / 2;
  let prev = andrewsWeight(0, A);
  for (let z = 0.05; z <= halfCutoff; z += 0.1) {
    const w = andrewsWeight(z, A);
    assert.ok(w <= prev + 1e-12, `weight at z=${z} (${w}) > prev (${prev})`);
    prev = w;
  }
});

test('andrewsWeight: even (symmetric) in z', () => {
  for (const z of [0.7, 1.4, 2.1, 3.5]) {
    assert.ok(Math.abs(andrewsWeight(z, A) - andrewsWeight(-z, A)) < 1e-12);
  }
});

// ---------- pure estimator (no rendering) ----------

test('andrewsMEstimator: n=0 -> NaN, n=1 -> x_1', () => {
  const a0 = andrewsMEstimator([]);
  assert.ok(Number.isNaN(a0.mu));
  const a1 = andrewsMEstimator([42]);
  assert.equal(a1.mu, 42);
  assert.equal(a1.coreRows, 1);
  assert.equal(a1.descendingRows, 0);
  assert.equal(a1.rejectedRows, 0);
});

test('andrewsMEstimator: all-tied -> mu = the tied value, MAD = 0', () => {
  const r = andrewsMEstimator([7, 7, 7, 7, 7]);
  assert.equal(r.mu, 7);
  assert.equal(r.mad, 0);
});

test('andrewsMEstimator: symmetric data -> mu equals center exactly', () => {
  const r = andrewsMEstimator([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.ok(Math.abs(r.mu - 15) < 1e-9);
});

test('andrewsMEstimator: tuning must be positive', () => {
  assert.throws(() => andrewsMEstimator([1, 2, 3, 4], 0));
  assert.throws(() => andrewsMEstimator([1, 2, 3, 4], -1));
  assert.throws(() => andrewsMEstimator([1, 2, 3, 4], NaN));
});

test('andrewsMEstimator: extreme outlier rejected, mu close to bulk median', () => {
  const bulk = [10, 11, 12, 13, 14, 15];
  const xs = [...bulk, 1e9];
  const r = andrewsMEstimator(xs);
  assert.ok(r.rejectedRows >= 1, `expected >= 1 rejected, got ${r.rejectedRows}`);
  assert.ok(
    Math.abs(r.mu - median(bulk)) < 1.5,
    `mu ${r.mu} drifted too far from bulk median ${median(bulk)}`,
  );
});

test('andrewsMEstimator: bucket partition sums to n', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100, 1000, 10000];
  const r = andrewsMEstimator(xs);
  assert.equal(r.coreRows + r.descendingRows + r.rejectedRows, xs.length);
});

test('andrewsMEstimator: translation equivariant (andrews(x+a) = andrews(x)+a)', () => {
  const xs = [1, 4, 7, 10, 13, 16, 19, 22];
  const a = 1000;
  const r1 = andrewsMEstimator(xs);
  const r2 = andrewsMEstimator(xs.map((x) => x + a));
  assert.ok(
    Math.abs(r2.mu - (r1.mu + a)) < 1e-6,
    `r2.mu ${r2.mu} != r1.mu+a ${r1.mu + a}`,
  );
});

test('andrewsMEstimator: scale equivariant (andrews(k*x) = k*andrews(x))', () => {
  const xs = [1, 4, 7, 10, 13, 16, 19, 22];
  const k = 7;
  const r1 = andrewsMEstimator(xs);
  const r2 = andrewsMEstimator(xs.map((x) => x * k));
  assert.ok(
    Math.abs(r2.mu - r1.mu * k) < 1e-6,
    `r2.mu ${r2.mu} != r1.mu*k ${r1.mu * k}`,
  );
});

// ---------- builder happy path ----------

test('builder: empty queue -> 0 sources, all-zero counters', () => {
  const r = buildSourceRowTokenMEstimatorAndrews([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
});

test('builder: minRows gate (default 4)', () => {
  const r = buildSourceRowTokenMEstimatorAndrews(
    mkSeries('s', [10, 20, 30]), // only 3 rows
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('builder: rejects bad minRows', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorAndrews([], { minRows: 3, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorAndrews([], {
      minRows: 4.5,
      generatedAt: GEN,
    }),
  );
});

test('builder: rejects bad tuning', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorAndrews([], { tuning: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorAndrews([], { tuning: -1, generatedAt: GEN }),
  );
});

test('builder: rejects bad minAndrews', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorAndrews([], {
      minAndrews: -1,
      generatedAt: GEN,
    }),
  );
});

test('builder: rejects bad top', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorAndrews([], { top: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorAndrews([], { top: 1.5, generatedAt: GEN }),
  );
});

test('builder: rejects bad sort key', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorAndrews([], {
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
  const r = buildSourceRowTokenMEstimatorAndrews(series, { generatedAt: GEN });
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
  const r = buildSourceRowTokenMEstimatorAndrews(all, {
    source: 'b',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedSourceFilter, 4);
});

test('builder: minAndrews gate', () => {
  const all: QueueLine[] = [
    ...mkSeries('low', [10, 11, 12, 13]),
    ...mkSeries('high', [1000, 1100, 1200, 1300]),
  ];
  const r = buildSourceRowTokenMEstimatorAndrews(all, {
    minAndrews: 500,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'high');
  assert.equal(r.droppedBelowMinAndrews, 1);
});

test('builder: top cap', () => {
  const all: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    all.push(...mkSeries(`s${i}`, Array.from({ length: 4 }, () => 100 * (i + 1))));
  }
  const r = buildSourceRowTokenMEstimatorAndrews(all, {
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
  const r = buildSourceRowTokenMEstimatorAndrews(all, {
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.rowsKept, 4);
});

test('builder: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceRowTokenMEstimatorAndrews([], {
      since: 'garbage',
      generatedAt: GEN,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenMEstimatorAndrews([], {
      until: 'garbage',
      generatedAt: GEN,
    }),
  );
});

// ---------- sort variants ----------

test('builder: sort=andrews-desc default ordering', () => {
  const all: QueueLine[] = [
    ...mkSeries('a', [10, 11, 12, 13]),
    ...mkSeries('b', [100, 110, 120, 130]),
    ...mkSeries('c', [50, 51, 52, 53]),
  ];
  const r = buildSourceRowTokenMEstimatorAndrews(all, { generatedAt: GEN });
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
  const r = buildSourceRowTokenMEstimatorAndrews(all, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'm', 'z'],
  );
});

test('builder: sort=rejected-desc orders by rejectedRows', () => {
  const all: QueueLine[] = [
    ...mkSeries('clean', [10, 11, 12, 13]),
    ...mkSeries('dirty', [10, 11, 12, 13, 1e9, 1e9, 1e9]),
  ];
  const r = buildSourceRowTokenMEstimatorAndrews(all, {
    sort: 'rejected-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'dirty');
});

// ---------- properties / mathematical contracts ----------

test('property: rejected outliers produce ~zero net pull on mu', () => {
  const bulk = [10, 11, 12, 13, 14, 15, 16];
  const r1 = buildSourceRowTokenMEstimatorAndrews(
    mkSeries('s', [...bulk, 1e10]),
    { generatedAt: GEN },
  );
  const r2 = buildSourceRowTokenMEstimatorAndrews(
    mkSeries('s', [...bulk, 1e10, 1e11, 1e12, 1e13, 1e14]),
    { generatedAt: GEN },
  );
  const drift = Math.abs(r2.sources[0]!.andrews - r1.sources[0]!.andrews);
  assert.ok(drift < 1e-3, `expected ~0 drift, got ${drift}`);
});

test('property: rejectedRows monotonic in outlier count', () => {
  const bulk = [10, 11, 12, 13, 14, 15];
  let prev = 0;
  for (let k = 0; k <= 4; k += 1) {
    const tail = Array.from({ length: k }, (_, i) => 1e6 * (i + 1));
    const r = buildSourceRowTokenMEstimatorAndrews(
      mkSeries('s', [...bulk, ...tail]),
      { generatedAt: GEN },
    );
    const rej = r.sources[0]!.rejectedRows;
    assert.ok(rej >= prev, `k=${k} rejected ${rej} < prev ${prev}`);
    prev = rej;
  }
});

test('property: large tuning -> andrews ~ mean (no rejection in play)', () => {
  const rng = lcg(101);
  for (let trial = 0; trial < 5; trial += 1) {
    const xs = Array.from({ length: 20 }, () => rng() * 100 + 10);
    const r = buildSourceRowTokenMEstimatorAndrews(mkSeries('s', xs), {
      tuning: 1e6,
      generatedAt: GEN,
    });
    const mu = mean(xs);
    assert.ok(
      Math.abs(r.sources[0]!.andrews - mu) < 1e-3,
      `trial ${trial} andrews ${r.sources[0]!.andrews} mean ${mu}`,
    );
  }
});

test('property: convergence within 200 iterations on log-normal-ish data', () => {
  const rng = lcg(202);
  for (let trial = 0; trial < 5; trial += 1) {
    const xs = Array.from({ length: 100 }, () =>
      Math.exp(7 + 2 * (rng() - 0.5)),
    );
    const r = buildSourceRowTokenMEstimatorAndrews(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    assert.ok(
      r.sources[0]!.iterations < 200,
      `trial ${trial} iter ${r.sources[0]!.iterations}`,
    );
  }
});

test('property: andrews finite and non-negative for non-negative inputs', () => {
  const rng = lcg(303);
  for (let trial = 0; trial < 10; trial += 1) {
    const xs = Array.from({ length: 30 }, () => rng() * 1000);
    const r = buildSourceRowTokenMEstimatorAndrews(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const t = r.sources[0]!.andrews;
    assert.ok(Number.isFinite(t));
    assert.ok(t >= -1e-9, `andrews ${t} negative`);
  }
});

test('property: andrews lies within [min, max] of bulk after rejection', () => {
  const rng = lcg(404);
  for (let trial = 0; trial < 5; trial += 1) {
    const bulk = Array.from({ length: 30 }, () => 100 + rng() * 50);
    const xs = [...bulk, 1e10, 2e10];
    const r = buildSourceRowTokenMEstimatorAndrews(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const t = r.sources[0]!.andrews;
    const lo = Math.min(...bulk);
    const hi = Math.max(...bulk);
    assert.ok(
      t >= lo - 1 && t <= hi + 1,
      `trial ${trial} andrews ${t} out of bulk [${lo},${hi}]`,
    );
  }
});

test('property: bucket partition sums to rowsKept (random)', () => {
  const rng = lcg(606);
  for (let trial = 0; trial < 8; trial += 1) {
    const xs = Array.from({ length: 40 }, () => rng() * 1000);
    const r = buildSourceRowTokenMEstimatorAndrews(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    assert.equal(
      row.coreRows + row.descendingRows + row.rejectedRows,
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
    const r = buildSourceRowTokenMEstimatorAndrews(series, { generatedAt: GEN });
    assert.equal(r.totalSources, nSrc);
    const sumKept = r.sources.reduce((a, b) => a + b.rowsKept, 0);
    assert.ok(sumKept <= r.totalRowsKept);
  }
});
