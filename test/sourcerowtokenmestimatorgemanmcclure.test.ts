/**
 * Unit + property tests for source-row-token-m-estimator-geman-mcclure.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenMEstimatorGemanMcClure,
  gemanMcClureMEstimator,
  gemanMcClureWeight,
} from '../src/sourcerowtokenmestimatorgemanmcclure.js';
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

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ---------- raw weight kernel ----------

test('gemanMcClureWeight: w(0) = 2 exactly (peak)', () => {
  assert.equal(gemanMcClureWeight(0), 2);
});

test('gemanMcClureWeight: half-peak knee at |z| = sqrt(sqrt(2)-1) ~ 0.6436', () => {
  const z = Math.sqrt(Math.sqrt(2) - 1);
  assert.ok(Math.abs(gemanMcClureWeight(z) - 1) < 1e-12);
  assert.ok(Math.abs(gemanMcClureWeight(-z) - 1) < 1e-12);
});

test('gemanMcClureWeight: never exactly zero for any finite z', () => {
  for (const z of [10, 100, 1000, 1e6]) {
    assert.ok(gemanMcClureWeight(z) > 0, `w(${z}) > 0`);
    assert.ok(gemanMcClureWeight(-z) > 0, `w(${-z}) > 0`);
  }
});

test('gemanMcClureWeight: symmetric in z', () => {
  for (const z of [0.1, 0.5, 1, 2, 5, 10]) {
    assert.equal(gemanMcClureWeight(z), gemanMcClureWeight(-z));
  }
});

test('gemanMcClureWeight: monotonically decreasing in |z|', () => {
  let prev = gemanMcClureWeight(0);
  for (let z = 0.1; z <= 10; z += 0.1) {
    const cur = gemanMcClureWeight(z);
    assert.ok(cur < prev, `w(${z}) < w(${z - 0.1})`);
    prev = cur;
  }
});

test('gemanMcClureWeight: tail decays like 2/z^4', () => {
  for (const z of [10, 50, 100]) {
    const expected = 2 / (z * z * z * z);
    const actual = gemanMcClureWeight(z);
    // Relative error vs leading-order asymptote should be O(1/z^2).
    const rel = Math.abs(actual - expected) / expected;
    assert.ok(rel < 0.05, `at z=${z}: rel error ${rel}`);
  }
});

// ---------- IRLS estimator ----------

test('gemanMcClureMEstimator: n=0 returns NaN', () => {
  const r = gemanMcClureMEstimator([]);
  assert.ok(Number.isNaN(r.mu));
  assert.equal(r.iterations, 0);
});

test('gemanMcClureMEstimator: n=1 returns the singleton', () => {
  const r = gemanMcClureMEstimator([42]);
  assert.equal(r.mu, 42);
  assert.equal(r.coreRows, 1);
});

test('gemanMcClureMEstimator: all-equal -> exact value', () => {
  const r = gemanMcClureMEstimator([7, 7, 7, 7, 7]);
  assert.equal(r.mu, 7);
  assert.equal(r.coreRows, 5);
});

test('gemanMcClureMEstimator: symmetric data -> close to mean=median', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const r = gemanMcClureMEstimator(xs);
  assert.ok(Math.abs(r.mu - 5) < 1e-6, `mu=${r.mu}`);
  assert.equal(r.converged, 'converged');
});

test('gemanMcClureMEstimator: heavy outlier pulled less than mean', () => {
  // Bulk centered near 10; one extreme outlier at 10000.
  const xs = [9, 10, 10, 10, 11, 10000];
  const r = gemanMcClureMEstimator(xs);
  const m = mean(xs);
  const med = median(xs);
  // GM should sit between the median (10) and mean — much closer to median.
  assert.ok(r.mu < m / 2, `geman ${r.mu} should be much less than mean ${m}`);
  assert.ok(Math.abs(r.mu - med) < Math.abs(m - med));
  // Outlier should be in the far tail.
  assert.ok(r.farTailRows >= 1);
});

test('gemanMcClureMEstimator: translation equivariance', () => {
  const xs = [3, 5, 7, 9, 11, 100];
  const a = gemanMcClureMEstimator(xs);
  const b = gemanMcClureMEstimator(xs.map((x) => x + 1000));
  assert.ok(Math.abs(b.mu - a.mu - 1000) < 1e-6);
});

test('gemanMcClureMEstimator: scale equivariance', () => {
  const xs = [3, 5, 7, 9, 11, 100];
  const a = gemanMcClureMEstimator(xs);
  const b = gemanMcClureMEstimator(xs.map((x) => x * 7));
  assert.ok(Math.abs(b.mu - 7 * a.mu) < 1e-6);
});

test('gemanMcClureMEstimator: bucket counts sum to n', () => {
  const rng = lcg(12345);
  const xs: number[] = [];
  for (let i = 0; i < 50; i += 1) xs.push(100 + rng() * 50);
  xs.push(10000); // outlier
  const r = gemanMcClureMEstimator(xs);
  assert.equal(r.coreRows + r.tailRows + r.farTailRows, xs.length);
});

test('gemanMcClureMEstimator: all-tied bulk + non-tied row collapses to bulk', () => {
  // MAD = 0 case: 7 rows tied at 100, one stray at 999.
  const r = gemanMcClureMEstimator([100, 100, 100, 100, 100, 100, 100, 999]);
  assert.ok(Math.abs(r.mu - 100) < 1, `geman ${r.mu} should collapse to bulk`);
});

// ---------- builder integration ----------

test('builder: empty queue -> empty report', () => {
  const r = buildSourceRowTokenMEstimatorGemanMcClure([], {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('builder: drops rows with non-finite hour_start', () => {
  const q = mkSeries('s1', [10, 20, 30, 40]);
  q.push(ql('not-a-date', 's1', 50));
  const r = buildSourceRowTokenMEstimatorGemanMcClure(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('builder: drops negative total_tokens', () => {
  const q = mkSeries('s1', [10, 20, 30, 40]);
  q.push(ql('2026-04-27T05:00:00.000Z', 's1', -1));
  const r = buildSourceRowTokenMEstimatorGemanMcClure(q, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('builder: drops sources below min-rows', () => {
  const q = [...mkSeries('a', [1, 2]), ...mkSeries('b', [10, 20, 30, 40])];
  const r = buildSourceRowTokenMEstimatorGemanMcClure(q, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});

test('builder: rejects invalid sort', () => {
  assert.throws(
    () =>
      buildSourceRowTokenMEstimatorGemanMcClure([], {
        generatedAt: GEN,
        sort: 'nope' as never,
      }),
    /sort must be one of/,
  );
});

test('builder: rejects min-rows < 4', () => {
  assert.throws(
    () =>
      buildSourceRowTokenMEstimatorGemanMcClure([], {
        generatedAt: GEN,
        minRows: 3,
      }),
    /minRows/,
  );
});

test('builder: rejects negative min-geman', () => {
  assert.throws(
    () =>
      buildSourceRowTokenMEstimatorGemanMcClure([], {
        generatedAt: GEN,
        minGeman: -0.5,
      }),
    /minGeman/,
  );
});

test('builder: top cap surfaces droppedBelowTopCap', () => {
  const q = [
    ...mkSeries('a', [1, 1, 1, 1, 100]),
    ...mkSeries('b', [10, 10, 10, 10, 10]),
    ...mkSeries('c', [50, 50, 50, 50, 50]),
  ];
  const r = buildSourceRowTokenMEstimatorGemanMcClure(q, {
    generatedAt: GEN,
    top: 2,
    sort: 'geman-desc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('builder: source filter restricts and counts dropped', () => {
  const q = [...mkSeries('a', [1, 2, 3, 4]), ...mkSeries('b', [5, 6, 7, 8])];
  const r = buildSourceRowTokenMEstimatorGemanMcClure(q, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 4);
});

test('builder: gemanMedianRatio is 1 when geman == median == 0', () => {
  const q = mkSeries('z', [0, 0, 0, 0, 0]);
  const r = buildSourceRowTokenMEstimatorGemanMcClure(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.gemanMedianRatio, 1);
});

test('builder: outlier detection — heavy outlier yields farTailRows >= 1', () => {
  const q = mkSeries('s', [100, 100, 100, 100, 100, 100, 100, 99999]);
  const r = buildSourceRowTokenMEstimatorGemanMcClure(q, { generatedAt: GEN });
  assert.ok(r.sources[0]!.farTailRows >= 1);
  // Geman estimate should be very close to 100, not pulled by 99999.
  assert.ok(Math.abs(r.sources[0]!.geman - 100) < 5);
});
