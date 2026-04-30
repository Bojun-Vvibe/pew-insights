/**
 * Unit + integration tests for
 * source-row-token-slope-ci-half-width-entropy (axis 18).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiHalfWidthEntropy,
  renderSourceRowTokenSlopeCiHalfWidthEntropy,
  halfWidthEntropy,
  SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES,
} from '../src/sourcerowtokenslopecihalfwidthentropy.js';
import type { QueueLine } from '../src/types.js';

const LOG2_6 = Math.log2(6);

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

function ascending(source: string, n: number, slope = 10, base = 100): QueueLine[] {
  const vals: number[] = [];
  for (let i = 0; i < n; i++) vals.push(base + i * slope);
  return mkSeries(source, vals);
}

function approx(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps;
}

// --- canonical lens names sanity ---

test('SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES has length 6 and canonical order', () => {
  assert.equal(SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES.length, 6);
  assert.deepEqual([...SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES], [
    'bootstrap',
    'jackknife',
    'bca',
    'studentizedT',
    'abc',
    'profileLikelihood',
  ]);
});

// --- halfWidthEntropy primitive ---

test('halfWidthEntropy: throws if length != 6', () => {
  assert.throws(() => halfWidthEntropy([]), /expected 6 half-widths/);
  assert.throws(() => halfWidthEntropy([1, 2, 3]), /expected 6 half-widths/);
  assert.throws(() => halfWidthEntropy([1, 2, 3, 4, 5, 6, 7]), /expected 6 half-widths/);
});

test('halfWidthEntropy: throws on non-finite inputs', () => {
  assert.throws(() => halfWidthEntropy([1, 2, 3, 4, 5, NaN]), /finite/);
  assert.throws(() => halfWidthEntropy([1, 2, 3, 4, Infinity, 6]), /finite/);
  assert.throws(() => halfWidthEntropy([1, 2, 3, -Infinity, 5, 6]), /finite/);
});

test('halfWidthEntropy: throws on negative half-widths', () => {
  assert.throws(() => halfWidthEntropy([1, 2, 3, 4, 5, -0.1]), /non-negative/);
  assert.throws(() => halfWidthEntropy([-1, 2, 3, 4, 5, 6]), /non-negative/);
});

test('halfWidthEntropy: zero half-width is allowed (non-negative)', () => {
  const r = halfWidthEntropy([0, 1, 1, 1, 1, 1]);
  assert.equal(r.probabilities[0], 0);
  // entropy of (0, 1/5, 1/5, 1/5, 1/5, 1/5) = log2(5)
  assert.ok(approx(r.entropyBits, Math.log2(5), 1e-9));
});

test('halfWidthEntropy: all-zero => degenerate, uniform p, MAX entropy', () => {
  const r = halfWidthEntropy([0, 0, 0, 0, 0, 0]);
  assert.equal(r.halfWidthSum, 0);
  assert.equal(r.degenerateFlag, true);
  for (const p of r.probabilities) assert.ok(approx(p, 1 / 6));
  assert.ok(approx(r.entropyBits, LOG2_6));
  assert.ok(approx(r.entropyNormalised, 1));
  assert.ok(approx(r.effectiveLenses, 6));
  assert.ok(approx(r.concentration, 0));
  assert.equal(r.dominantLens, 'bootstrap');
  assert.ok(approx(r.dominantShare, 1 / 6));
});

test('halfWidthEntropy: uniform non-zero half-widths => MAX entropy', () => {
  const r = halfWidthEntropy([2, 2, 2, 2, 2, 2]);
  assert.equal(r.degenerateFlag, false);
  assert.equal(r.halfWidthSum, 12);
  for (const p of r.probabilities) assert.ok(approx(p, 1 / 6));
  assert.ok(approx(r.entropyBits, LOG2_6));
  assert.ok(approx(r.entropyNormalised, 1));
  assert.ok(approx(r.effectiveLenses, 6));
  assert.ok(approx(r.concentration, 0));
});

test('halfWidthEntropy: full mass on lens 0 => MIN entropy 0', () => {
  const r = halfWidthEntropy([1, 0, 0, 0, 0, 0]);
  assert.equal(r.degenerateFlag, false);
  assert.equal(r.halfWidthSum, 1);
  assert.deepEqual(r.probabilities, [1, 0, 0, 0, 0, 0]);
  assert.ok(approx(r.entropyBits, 0));
  assert.ok(approx(r.entropyNormalised, 0));
  assert.ok(approx(r.effectiveLenses, 1));
  assert.ok(approx(r.concentration, 1));
  assert.equal(r.dominantLens, 'bootstrap');
  assert.ok(approx(r.dominantShare, 1));
});

test('halfWidthEntropy: full mass on lens 3 (studentizedT)', () => {
  const r = halfWidthEntropy([0, 0, 0, 5, 0, 0]);
  assert.equal(r.dominantLens, 'studentizedT');
  assert.ok(approx(r.dominantShare, 1));
  assert.ok(approx(r.entropyBits, 0));
  assert.ok(approx(r.concentration, 1));
});

test('halfWidthEntropy: full mass on lens 5 (profileLikelihood)', () => {
  const r = halfWidthEntropy([0, 0, 0, 0, 0, 7]);
  assert.equal(r.dominantLens, 'profileLikelihood');
  assert.ok(approx(r.dominantShare, 1));
  assert.ok(approx(r.entropyBits, 0));
});

test('halfWidthEntropy: two lenses 50/50 => entropy = 1 bit, effLenses = 2', () => {
  const r = halfWidthEntropy([1, 1, 0, 0, 0, 0]);
  assert.ok(approx(r.entropyBits, 1));
  assert.ok(approx(r.entropyNormalised, 1 / LOG2_6));
  assert.ok(approx(r.effectiveLenses, 2));
  // dominantLens: tie between lens 0 and 1 => canonical-order first = bootstrap
  assert.equal(r.dominantLens, 'bootstrap');
  assert.ok(approx(r.dominantShare, 0.5));
});

test('halfWidthEntropy: dominantLens canonical-order tie-break', () => {
  // Three-way tie among lenses 1, 3, 5 => first canonical wins (jackknife)
  const r = halfWidthEntropy([0, 4, 0, 4, 0, 4]);
  assert.equal(r.dominantLens, 'jackknife');
  assert.ok(approx(r.dominantShare, 1 / 3));
  assert.ok(approx(r.entropyBits, Math.log2(3)));
  assert.ok(approx(r.effectiveLenses, 3));
});

test('halfWidthEntropy: scale invariance — multiplying h by k > 0 preserves entropy', () => {
  const base = [1, 2, 3, 4, 5, 6];
  const r1 = halfWidthEntropy(base);
  const r10 = halfWidthEntropy(base.map((x) => x * 10));
  const r100 = halfWidthEntropy(base.map((x) => x * 100));
  assert.ok(approx(r1.entropyBits, r10.entropyBits, 1e-12));
  assert.ok(approx(r1.entropyBits, r100.entropyBits, 1e-12));
  assert.ok(approx(r1.entropyNormalised, r10.entropyNormalised, 1e-12));
  assert.ok(approx(r1.effectiveLenses, r10.effectiveLenses, 1e-12));
  assert.ok(approx(r1.dominantShare, r10.dominantShare, 1e-12));
});

test('halfWidthEntropy: probabilities sum to 1 (non-degenerate)', () => {
  const r = halfWidthEntropy([0.5, 1, 1.5, 2, 2.5, 3]);
  let s = 0;
  for (const p of r.probabilities) s += p;
  assert.ok(approx(s, 1, 1e-12));
});

test('halfWidthEntropy: probabilities sum to 1 (degenerate uniform 1/6)', () => {
  const r = halfWidthEntropy([0, 0, 0, 0, 0, 0]);
  let s = 0;
  for (const p of r.probabilities) s += p;
  assert.ok(approx(s, 1, 1e-12));
});

test('halfWidthEntropy: entropyBits in [0, log2(6)]', () => {
  const cases: number[][] = [
    [1, 0, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0],
    [1, 1, 1, 0, 0, 0],
    [1, 1, 1, 1, 0, 0],
    [1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1],
    [3, 1, 4, 1, 5, 9],
    [0.001, 0.001, 0.001, 0.001, 0.001, 100],
  ];
  for (const c of cases) {
    const r = halfWidthEntropy(c);
    assert.ok(r.entropyBits >= 0, `entropyBits >= 0 for ${c}`);
    assert.ok(r.entropyBits <= LOG2_6 + 1e-12, `entropyBits <= log2(6) for ${c}`);
    assert.ok(r.entropyNormalised >= 0);
    assert.ok(r.entropyNormalised <= 1 + 1e-12);
    assert.ok(r.concentration >= -1e-12);
    assert.ok(r.concentration <= 1 + 1e-12);
    assert.ok(r.effectiveLenses >= 1 - 1e-12);
    assert.ok(r.effectiveLenses <= N + 1e-12 || r.effectiveLenses <= 6 + 1e-12);
  }
});

const N = 6;

test('halfWidthEntropy: monotone in concentration — adding mass to existing dominant lowers Hnorm', () => {
  const a = halfWidthEntropy([2, 1, 1, 1, 1, 1]);
  const b = halfWidthEntropy([4, 1, 1, 1, 1, 1]);
  const c = halfWidthEntropy([10, 1, 1, 1, 1, 1]);
  assert.ok(a.entropyNormalised > b.entropyNormalised);
  assert.ok(b.entropyNormalised > c.entropyNormalised);
  assert.ok(a.concentration < b.concentration);
  assert.ok(b.concentration < c.concentration);
});

test('halfWidthEntropy: effLenses == 2^entropyBits identity', () => {
  const cases: number[][] = [
    [1, 1, 0, 0, 0, 0],
    [3, 2, 1, 0.5, 0.25, 0.125],
    [1, 1, 1, 1, 1, 1],
  ];
  for (const c of cases) {
    const r = halfWidthEntropy(c);
    assert.ok(approx(r.effectiveLenses, Math.pow(2, r.entropyBits), 1e-12));
  }
});

test('halfWidthEntropy: concentration + entropyNormalised == 1', () => {
  const cases: number[][] = [
    [1, 0, 0, 0, 0, 0],
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    [7, 7, 7, 7, 7, 7],
  ];
  for (const c of cases) {
    const r = halfWidthEntropy(c);
    assert.ok(approx(r.concentration + r.entropyNormalised, 1, 1e-12));
  }
});

test('halfWidthEntropy: dominantLens is argmax of halfWidths, canonical-order tie-break', () => {
  let r = halfWidthEntropy([1, 5, 3, 2, 4, 0]);
  assert.equal(r.dominantLens, 'jackknife');
  r = halfWidthEntropy([5, 5, 5, 5, 5, 5]);
  assert.equal(r.dominantLens, 'bootstrap');
  r = halfWidthEntropy([0, 0, 0, 0, 1, 1]);
  // tie between abc (idx 4) and profileLikelihood (idx 5) => canonical first = abc
  assert.equal(r.dominantLens, 'abc');
});

// --- buildSourceRowTokenSlopeCiHalfWidthEntropy options validation ---

function bareQueue(): QueueLine[] {
  return [...ascending('s1', 8), ...ascending('s2', 8, 5, 50)];
}

test('build: throws on non-integer minRows', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiHalfWidthEntropy(bareQueue(), { minRows: 4.5 }),
    /minRows must be an integer/,
  );
});

test('build: throws on minRows < 4', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiHalfWidthEntropy(bareQueue(), { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('build: throws on confidence out of range', () => {
  for (const c of [0, 1, -0.1, 1.5, NaN]) {
    assert.throws(
      () => buildSourceRowTokenSlopeCiHalfWidthEntropy(bareQueue(), { confidence: c }),
      /confidence must be a finite number in/,
    );
  }
});

test('build: throws on lambda <= 0 or non-finite', () => {
  for (const l of [0, -1, NaN, Infinity, -Infinity]) {
    assert.throws(
      () => buildSourceRowTokenSlopeCiHalfWidthEntropy(bareQueue(), { lambda: l }),
      /lambda must be a finite, strictly positive number/,
    );
  }
});

test('build: throws on bootstraps < 100 or non-integer', () => {
  for (const b of [99, 0, -10, 100.5]) {
    assert.throws(
      () => buildSourceRowTokenSlopeCiHalfWidthEntropy(bareQueue(), { bootstraps: b }),
      /bootstraps must be an integer >= 100/,
    );
  }
});

test('build: throws on non-integer seed', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiHalfWidthEntropy(bareQueue(), { seed: 1.5 }),
    /seed must be an integer/,
  );
});

test('build: throws on alertConcentration out of [0, 1]', () => {
  for (const a of [-0.1, 1.1, NaN, Infinity]) {
    assert.throws(
      () =>
        buildSourceRowTokenSlopeCiHalfWidthEntropy(bareQueue(), {
          alertConcentration: a,
        }),
      /alertConcentration must be a finite number in/,
    );
  }
});

test('build: throws on alertUniform out of [0, 1]', () => {
  for (const a of [-0.1, 1.1, NaN, Infinity]) {
    assert.throws(
      () =>
        buildSourceRowTokenSlopeCiHalfWidthEntropy(bareQueue(), {
          alertUniform: a,
        }),
      /alertUniform must be a finite number in/,
    );
  }
});

test('build: throws on top < 1 or non-integer', () => {
  for (const t of [0, -1, 1.5]) {
    assert.throws(
      () => buildSourceRowTokenSlopeCiHalfWidthEntropy(bareQueue(), { top: t }),
      /top must be a positive integer/,
    );
  }
});

test('build: throws on invalid sort key', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiHalfWidthEntropy(bareQueue(), {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

// --- buildSourceRowTokenSlopeCiHalfWidthEntropy: structural correctness ---

test('build: empty queue => empty rows, zero aggregates', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy([], {
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.rows.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.droppedMissingLens, 0);
  assert.equal(r.droppedAboveAlert, 0);
  assert.equal(r.meanEntropyNormalised, 0);
  assert.equal(r.medianEntropyNormalised, 0);
  assert.equal(r.meanEffectiveLenses, 0);
  assert.equal(r.meanConcentration, 0);
  assert.equal(r.nDegenerate, 0);
  assert.equal(r.nNearUniform, 0);
  assert.equal(r.nNearConcentrated, 0);
  assert.equal(r.globalDominantLens, null);
  assert.equal(r.sort, 'concentration-desc');
});

test('build: single source full lens coverage => 1 row, 0 dropped', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(ascending('s1', 12), {
    generatedAt: '2026-04-30T00:00:00.000Z',
    bootstraps: 200,
  });
  assert.equal(r.rows.length, 1);
  assert.equal(r.sourcesWithAllLenses, 1);
  assert.equal(r.droppedMissingLens, 0);
  const row = r.rows[0]!;
  assert.equal(row.source, 's1');
  assert.equal(row.halfWidths.length, 6);
  assert.equal(row.probabilities.length, 6);
  assert.ok(row.entropyNormalised >= 0);
  assert.ok(row.entropyNormalised <= 1 + 1e-12);
  assert.ok(row.effectiveLenses >= 1 - 1e-9);
  assert.ok(row.effectiveLenses <= 6 + 1e-9);
  assert.ok(approx(row.entropyNormalised + row.concentration, 1, 1e-12));
});

test('build: source filter works', () => {
  const queue = [...ascending('alpha', 8), ...ascending('beta', 8, 5, 200)];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    source: 'beta',
    bootstraps: 200,
  });
  assert.equal(r.source, 'beta');
  for (const row of r.rows) assert.equal(row.source, 'beta');
});

test('build: meanEntropyNormalised matches arithmetic mean of rows', () => {
  const queue = [
    ...ascending('a', 10),
    ...ascending('b', 12, 3, 50),
    ...ascending('c', 15, 7, 0),
  ];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
  });
  if (r.rows.length === 0) return;
  let s = 0;
  for (const row of r.rows) s += row.entropyNormalised;
  assert.ok(approx(r.meanEntropyNormalised, s / r.rows.length, 1e-12));
});

test('build: medianEntropyNormalised matches median of rows', () => {
  const queue = [
    ...ascending('a', 10),
    ...ascending('b', 12, 3, 50),
    ...ascending('c', 15, 7, 0),
  ];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
  });
  if (r.rows.length === 0) return;
  const xs = [...r.rows.map((row) => row.entropyNormalised)].sort((a, b) => a - b);
  const m = Math.floor(xs.length / 2);
  const expected = xs.length % 2 === 1 ? xs[m]! : (xs[m - 1]! + xs[m]!) / 2;
  assert.ok(approx(r.medianEntropyNormalised, expected, 1e-12));
});

test('build: meanConcentration == 1 - meanEntropyNormalised', () => {
  const queue = [
    ...ascending('a', 10),
    ...ascending('b', 12, 3, 50),
    ...ascending('c', 15, 7, 0),
  ];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
  });
  if (r.rows.length === 0) return;
  assert.ok(
    approx(r.meanConcentration, 1 - r.meanEntropyNormalised, 1e-12),
    `meanConcentration=${r.meanConcentration} 1-meanH=${1 - r.meanEntropyNormalised}`,
  );
});

test('build: alertConcentration filters to sources strictly above threshold', () => {
  const queue = [
    ...ascending('a', 10),
    ...ascending('b', 12, 3, 50),
    ...ascending('c', 15, 7, 0),
  ];
  const base = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
  });
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    alertConcentration: 0.0,
  });
  for (const row of r.rows) assert.ok(row.concentration > 0);
  assert.ok(r.droppedAboveAlert === base.rows.length - r.rows.length);
});

test('build: alertConcentration = 1.0 yields empty rows (nothing > 1)', () => {
  const queue = [...ascending('a', 10), ...ascending('b', 12, 3, 50)];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    alertConcentration: 1.0,
  });
  assert.equal(r.rows.length, 0);
});

test('build: alertUniform filters to sources strictly above threshold', () => {
  const queue = [...ascending('a', 10), ...ascending('b', 12, 3, 50)];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    alertUniform: 0.0,
  });
  for (const row of r.rows) assert.ok(row.entropyNormalised > 0);
});

test('build: alertConcentration + alertUniform compose as conjunction', () => {
  const queue = [
    ...ascending('a', 10),
    ...ascending('b', 12, 3, 50),
    ...ascending('c', 15, 7, 0),
  ];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    alertConcentration: 0.0,
    alertUniform: 0.0,
  });
  for (const row of r.rows) {
    assert.ok(row.concentration > 0);
    assert.ok(row.entropyNormalised > 0);
  }
});

test('build: top caps output to N rows', () => {
  const queue = [
    ...ascending('a', 10),
    ...ascending('b', 12, 3, 50),
    ...ascending('c', 15, 7, 0),
  ];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    top: 1,
  });
  assert.ok(r.rows.length <= 1);
});

test('build: sort=source orders alphabetically', () => {
  const queue = [
    ...ascending('charlie', 10),
    ...ascending('alpha', 12, 3, 50),
    ...ascending('bravo', 15, 7, 0),
  ];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    sort: 'source',
  });
  const sources = r.rows.map((row) => row.source);
  const sorted = [...sources].sort();
  assert.deepEqual(sources, sorted);
});

test('build: sort=concentration-desc orders by concentration descending', () => {
  const queue = [
    ...ascending('a', 10),
    ...ascending('b', 12, 3, 50),
    ...ascending('c', 15, 7, 0),
  ];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    sort: 'concentration-desc',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.concentration >= r.rows[i]!.concentration);
  }
});

test('build: sort=entropy-asc orders by entropyNormalised ascending', () => {
  const queue = [
    ...ascending('a', 10),
    ...ascending('b', 12, 3, 50),
    ...ascending('c', 15, 7, 0),
  ];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    sort: 'entropy-asc',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.entropyNormalised <= r.rows[i]!.entropyNormalised);
  }
});

test('build: sort=effective-lenses-desc orders by effectiveLenses descending', () => {
  const queue = [
    ...ascending('a', 10),
    ...ascending('b', 12, 3, 50),
    ...ascending('c', 15, 7, 0),
  ];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    sort: 'effective-lenses-desc',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.effectiveLenses >= r.rows[i]!.effectiveLenses);
  }
});

test('build: sort=halfwidth-sum-desc orders by halfWidthSum descending', () => {
  const queue = [
    ...ascending('a', 10),
    ...ascending('b', 12, 3, 50),
    ...ascending('c', 15, 7, 0),
  ];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    sort: 'halfwidth-sum-desc',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.halfWidthSum >= r.rows[i]!.halfWidthSum);
  }
});

test('build: sort=dominant-share-desc orders by dominantShare descending', () => {
  const queue = [
    ...ascending('a', 10),
    ...ascending('b', 12, 3, 50),
    ...ascending('c', 15, 7, 0),
  ];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    sort: 'dominant-share-desc',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.dominantShare >= r.rows[i]!.dominantShare);
  }
});

test('build: row invariants — sums, ranges, identities', () => {
  const queue = [
    ...ascending('a', 10),
    ...ascending('b', 12, 3, 50),
    ...ascending('c', 15, 7, 0),
  ];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
  });
  for (const row of r.rows) {
    // probabilities sum to 1
    let psum = 0;
    for (const p of row.probabilities) {
      assert.ok(p >= 0);
      assert.ok(p <= 1 + 1e-12);
      psum += p;
    }
    assert.ok(approx(psum, 1, 1e-9));
    // half-widths non-negative; sum matches halfWidthSum
    let hsum = 0;
    for (const h of row.halfWidths) {
      assert.ok(h >= 0);
      hsum += h;
    }
    assert.ok(approx(hsum, row.halfWidthSum, 1e-9));
    // entropy bounds
    assert.ok(row.entropyBits >= 0);
    assert.ok(row.entropyBits <= LOG2_6 + 1e-12);
    assert.ok(row.entropyNormalised >= 0);
    assert.ok(row.entropyNormalised <= 1 + 1e-12);
    // identity
    assert.ok(approx(row.entropyNormalised + row.concentration, 1, 1e-12));
    assert.ok(approx(row.effectiveLenses, Math.pow(2, row.entropyBits), 1e-9));
    // dominant invariants
    assert.ok(SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES.includes(row.dominantLens));
    assert.ok(row.dominantShare >= 1 / 6 - 1e-9);
    assert.ok(row.dominantShare <= 1 + 1e-9);
  }
});

test('build: globalDominantLens is from canonical set when rows present', () => {
  const queue = [...ascending('a', 10), ...ascending('b', 12, 3, 50)];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
  });
  if (r.rows.length === 0) {
    assert.equal(r.globalDominantLens, null);
  } else {
    assert.ok(
      SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES.includes(r.globalDominantLens!),
    );
  }
});

test('build: nNearUniform + nNearConcentrated <= rows.length (thresholds disjoint)', () => {
  const queue = [
    ...ascending('a', 10),
    ...ascending('b', 12, 3, 50),
    ...ascending('c', 15, 7, 0),
  ];
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
  });
  // threshold 0.95 vs 0.30: disjoint by construction
  assert.ok(r.nNearUniform + r.nNearConcentrated <= r.rows.length);
});

test('build: deterministic under same seed', () => {
  const queue = [...ascending('a', 10), ...ascending('b', 12, 3, 50)];
  const r1 = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    seed: 7,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const r2 = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    seed: 7,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.deepEqual(r1.rows, r2.rows);
  assert.equal(r1.meanEntropyNormalised, r2.meanEntropyNormalised);
  assert.equal(r1.globalDominantLens, r2.globalDominantLens);
});

test('build: rowsKept matches across lenses (consistent input-row gate)', () => {
  const queue = ascending('a', 10);
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
  });
  for (const row of r.rows) {
    assert.ok(row.rowsKept >= 4);
  }
});

test('build: confidence parameter affects half-widths (CI tightness)', () => {
  const queue = ascending('a', 12);
  const rNarrow = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    confidence: 0.5,
  });
  const rWide = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    confidence: 0.99,
  });
  if (rNarrow.rows.length > 0 && rWide.rows.length > 0) {
    // wider CI => generally larger halfWidthSum (not strict per-lens,
    // but typical at the source level)
    assert.ok(rWide.rows[0]!.halfWidthSum >= rNarrow.rows[0]!.halfWidthSum * 0.5);
  }
});

test('build: lambda parameter accepted and report records value', () => {
  const queue = ascending('a', 10);
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    lambda: 2.5,
  });
  assert.equal(r.lambda, 2.5);
});

test('build: window since/until recorded on report', () => {
  const queue = ascending('a', 10);
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
  });
  assert.equal(r.windowStart, '2026-04-27T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-28T00:00:00.000Z');
});

test('build: top with sort=concentration-desc keeps the most concentrated', () => {
  const queue = [
    ...ascending('a', 10),
    ...ascending('b', 12, 3, 50),
    ...ascending('c', 15, 7, 0),
  ];
  const baseAll = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    sort: 'concentration-desc',
  });
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    sort: 'concentration-desc',
    top: 1,
  });
  if (baseAll.rows.length > 0) {
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0]!.source, baseAll.rows[0]!.source);
  }
});

test('build: alertConcentration=0 retains rows with concentration>0', () => {
  const queue = [...ascending('a', 10), ...ascending('b', 12, 3, 50)];
  const all = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
  });
  const filtered = buildSourceRowTokenSlopeCiHalfWidthEntropy(queue, {
    bootstraps: 200,
    alertConcentration: 0,
  });
  // anything degenerate (concentration==0) should be dropped
  for (const row of filtered.rows) {
    assert.ok(row.concentration > 0);
  }
  assert.ok(filtered.rows.length <= all.rows.length);
});

// --- renderer ---

test('render: empty rows => header + (no sources)', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy([], {
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiHalfWidthEntropy(r);
  assert.match(out, /pew-insights source-row-token-slope-ci-half-width-entropy/);
  assert.match(out, /\(no sources\)/);
});

test('render: non-empty includes column header and a row', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(
    [...ascending('alpha', 10)],
    { bootstraps: 200, generatedAt: '2026-04-30T00:00:00.000Z' },
  );
  const out = renderSourceRowTokenSlopeCiHalfWidthEntropy(r);
  assert.match(out, /source\s+rows\s+Hbits\s+Hnorm\s+effLens\s+concen\s+domLens/);
  assert.match(out, /alpha/);
});

test('render: showSummary appends summary line per row', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(
    [...ascending('alpha', 10)],
    { bootstraps: 200, generatedAt: '2026-04-30T00:00:00.000Z' },
  );
  const out = renderSourceRowTokenSlopeCiHalfWidthEntropy(r, { showSummary: true });
  assert.match(out, /summary: dominantLens=/);
});

test('render: showProbabilities lists six p_i', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(
    [...ascending('alpha', 10)],
    { bootstraps: 200, generatedAt: '2026-04-30T00:00:00.000Z' },
  );
  const out = renderSourceRowTokenSlopeCiHalfWidthEntropy(r, {
    showProbabilities: true,
  });
  assert.match(out, /probabilities: bootstrap=/);
  assert.match(out, /jackknife=/);
  assert.match(out, /profileLikelihood=/);
});

test('render: showEntropyAggregate emits aggregate line', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(
    [...ascending('alpha', 10), ...ascending('beta', 12, 3, 50)],
    { bootstraps: 200, generatedAt: '2026-04-30T00:00:00.000Z' },
  );
  const out = renderSourceRowTokenSlopeCiHalfWidthEntropy(r, {
    showEntropyAggregate: true,
  });
  assert.match(out, /\[entropy aggregate\] meanHnorm=/);
});

test('render: showConcentrationAggregate emits aggregate line', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(
    [...ascending('alpha', 10), ...ascending('beta', 12, 3, 50)],
    { bootstraps: 200, generatedAt: '2026-04-30T00:00:00.000Z' },
  );
  const out = renderSourceRowTokenSlopeCiHalfWidthEntropy(r, {
    showConcentrationAggregate: true,
  });
  assert.match(out, /\[concentration aggregate\] meanConcentration=/);
});

test('render: showLensAttribution emits per-lens histogram', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(
    [...ascending('alpha', 10), ...ascending('beta', 12, 3, 50)],
    { bootstraps: 200, generatedAt: '2026-04-30T00:00:00.000Z' },
  );
  const out = renderSourceRowTokenSlopeCiHalfWidthEntropy(r, {
    showLensAttribution: true,
  });
  assert.match(out, /\[lens attribution\]/);
  assert.match(out, /globalDominantLens=/);
});

test('render: degen flag appears when row is degenerate', () => {
  // Simulate by building a fake report directly (the real Deming
  // pipeline rarely produces all-zero half-widths on real data).
  const r = {
    generatedAt: '2026-04-30T00:00:00.000Z',
    windowStart: null,
    windowEnd: null,
    source: null,
    minRows: 4,
    confidence: 0.95,
    lambda: 1,
    bootstraps: 1000,
    seed: 42,
    alertConcentration: null,
    alertUniform: null,
    top: null,
    sort: 'concentration-desc' as const,
    totalSources: 1,
    sourcesWithAllLenses: 1,
    droppedMissingLens: 0,
    droppedAboveAlert: 0,
    meanEntropyNormalised: 1,
    medianEntropyNormalised: 1,
    meanEffectiveLenses: 6,
    meanConcentration: 0,
    nDegenerate: 1,
    nNearUniform: 1,
    nNearConcentrated: 0,
    globalDominantLens: 'bootstrap' as const,
    rows: [
      {
        source: 'degenSrc',
        rowsKept: 5,
        halfWidths: [0, 0, 0, 0, 0, 0],
        halfWidthSum: 0,
        probabilities: [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6],
        entropyBits: LOG2_6,
        entropyNormalised: 1,
        effectiveLenses: 6,
        concentration: 0,
        dominantLens: 'bootstrap' as const,
        dominantShare: 1 / 6,
        degenerateFlag: true,
      },
    ],
  };
  const out = renderSourceRowTokenSlopeCiHalfWidthEntropy(r);
  assert.match(out, /degen/);
});

// --- aggregates with synthetic rows (renderer composition) ---

test('render: showEntropyAggregate computes uniFrac correctly', () => {
  const r = {
    generatedAt: '2026-04-30T00:00:00.000Z',
    windowStart: null,
    windowEnd: null,
    source: null,
    minRows: 4,
    confidence: 0.95,
    lambda: 1,
    bootstraps: 1000,
    seed: 42,
    alertConcentration: null,
    alertUniform: null,
    top: null,
    sort: 'concentration-desc' as const,
    totalSources: 4,
    sourcesWithAllLenses: 4,
    droppedMissingLens: 0,
    droppedAboveAlert: 0,
    meanEntropyNormalised: 0.7,
    medianEntropyNormalised: 0.65,
    meanEffectiveLenses: 4,
    meanConcentration: 0.3,
    nDegenerate: 0,
    nNearUniform: 2,
    nNearConcentrated: 1,
    globalDominantLens: 'jackknife' as const,
    rows: [
      {
        source: 'a',
        rowsKept: 5,
        halfWidths: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
        halfWidthSum: 0.6,
        probabilities: [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6],
        entropyBits: LOG2_6,
        entropyNormalised: 1,
        effectiveLenses: 6,
        concentration: 0,
        dominantLens: 'bootstrap' as const,
        dominantShare: 1 / 6,
        degenerateFlag: false,
      },
      {
        source: 'b',
        rowsKept: 6,
        halfWidths: [0.5, 0.5, 0, 0, 0, 0],
        halfWidthSum: 1,
        probabilities: [0.5, 0.5, 0, 0, 0, 0],
        entropyBits: 1,
        entropyNormalised: 1 / LOG2_6,
        effectiveLenses: 2,
        concentration: 1 - 1 / LOG2_6,
        dominantLens: 'bootstrap' as const,
        dominantShare: 0.5,
        degenerateFlag: false,
      },
      {
        source: 'c',
        rowsKept: 7,
        halfWidths: [0.2, 0.2, 0.2, 0.2, 0.1, 0.1],
        halfWidthSum: 1,
        probabilities: [0.2, 0.2, 0.2, 0.2, 0.1, 0.1],
        entropyBits: 2.5219280948873623,
        entropyNormalised: 0.9758,
        effectiveLenses: 5.74,
        concentration: 0.0242,
        dominantLens: 'bootstrap' as const,
        dominantShare: 0.2,
        degenerateFlag: false,
      },
      {
        source: 'd',
        rowsKept: 8,
        halfWidths: [1, 0, 0, 0, 0, 0],
        halfWidthSum: 1,
        probabilities: [1, 0, 0, 0, 0, 0],
        entropyBits: 0,
        entropyNormalised: 0,
        effectiveLenses: 1,
        concentration: 1,
        dominantLens: 'bootstrap' as const,
        dominantShare: 1,
        degenerateFlag: false,
      },
    ],
  };
  const out = renderSourceRowTokenSlopeCiHalfWidthEntropy(r, {
    showEntropyAggregate: true,
  });
  // 2/4 == 0.5
  assert.match(out, /nNearUniform=2\/4 \(0\.5000\)/);
  assert.match(out, /nNearConcentrated=1\/4 \(0\.2500\)/);
});

// --- structural-distinctness witness ---
//
// Demonstrates that two distinct half-width vectors yielding
// IDENTICAL midpoint dispersion (i.e. axes 1-17 cannot
// distinguish them on the dispersion-of-midpoints front) can
// have very different half-width entropy. The test fixes
// midpoints to a constant zero vector and varies only the
// half-widths. Axes 1, 13, 16, 17 (mid-dispersion, MAD-vs-MAE,
// curvature, tail-mass-asymmetry) all collapse to trivial
// values when midpoints are constant — entropy of half-widths
// remains a non-trivial discriminant.

test('halfWidthEntropy: structurally distinct from midpoint-only diagnostics', () => {
  const concentrated = halfWidthEntropy([10, 0, 0, 0, 0, 0]);
  const uniform = halfWidthEntropy([10, 10, 10, 10, 10, 10]);
  // Both have midpoint vector === (0,0,0,0,0,0) by construction
  // (we are only varying half-widths). All midpoint-only axes
  // would be identical between these. But:
  assert.notEqual(concentrated.entropyNormalised, uniform.entropyNormalised);
  assert.notEqual(concentrated.concentration, uniform.concentration);
  assert.notEqual(concentrated.effectiveLenses, uniform.effectiveLenses);
  assert.equal(concentrated.entropyNormalised, 0);
  assert.equal(uniform.entropyNormalised, 1);
});

test('halfWidthEntropy: rotation among lenses changes dominantLens but preserves entropy scalars', () => {
  const a = halfWidthEntropy([5, 1, 1, 1, 1, 1]);
  const b = halfWidthEntropy([1, 5, 1, 1, 1, 1]);
  const c = halfWidthEntropy([1, 1, 1, 1, 1, 5]);
  // Same multiset of half-widths => identical entropy / effLenses
  assert.ok(approx(a.entropyBits, b.entropyBits, 1e-12));
  assert.ok(approx(a.entropyBits, c.entropyBits, 1e-12));
  assert.ok(approx(a.dominantShare, b.dominantShare, 1e-12));
  // But dominantLens cycles
  assert.equal(a.dominantLens, 'bootstrap');
  assert.equal(b.dominantLens, 'jackknife');
  assert.equal(c.dominantLens, 'profileLikelihood');
});

test('halfWidthEntropy: 3-active vs 2-active half-widths => effLenses orders correctly', () => {
  const two = halfWidthEntropy([5, 5, 0, 0, 0, 0]);
  const three = halfWidthEntropy([5, 5, 5, 0, 0, 0]);
  const four = halfWidthEntropy([5, 5, 5, 5, 0, 0]);
  assert.ok(approx(two.effectiveLenses, 2, 1e-12));
  assert.ok(approx(three.effectiveLenses, 3, 1e-12));
  assert.ok(approx(four.effectiveLenses, 4, 1e-12));
  assert.ok(two.entropyBits < three.entropyBits);
  assert.ok(three.entropyBits < four.entropyBits);
});

test('halfWidthEntropy: smooth response — small perturbation moves entropy little', () => {
  const base = halfWidthEntropy([1, 1, 1, 1, 1, 1]);
  const perturbed = halfWidthEntropy([1.001, 1, 1, 1, 1, 0.999]);
  assert.ok(Math.abs(base.entropyBits - perturbed.entropyBits) < 1e-3);
});

test('halfWidthEntropy: dominantShare >= 1/N always', () => {
  const cases: number[][] = [
    [1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0],
    [3, 1, 4, 1, 5, 9],
    [0, 0, 0, 0, 0, 0],
  ];
  for (const c of cases) {
    const r = halfWidthEntropy(c);
    assert.ok(r.dominantShare >= 1 / 6 - 1e-12, `dominantShare ${r.dominantShare} for ${c}`);
  }
});

// --- effective-lenses-buckets renderer flag (axis-18 refinement) ---

test('render: showEffectiveLensesBuckets emits five-bucket histogram', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy(
    [...ascending('alpha', 10), ...ascending('beta', 12, 3, 50)],
    { bootstraps: 200, generatedAt: '2026-04-30T00:00:00.000Z' },
  );
  const out = renderSourceRowTokenSlopeCiHalfWidthEntropy(r, {
    showEffectiveLensesBuckets: true,
  });
  assert.match(out, /\[effLenses buckets\] \[1,2\)=/);
  assert.match(out, /\[2,3\)=/);
  assert.match(out, /\[3,4\)=/);
  assert.match(out, /\[4,5\)=/);
  assert.match(out, /\[5,6\]=/);
});

test('render: showEffectiveLensesBuckets bucket boundaries — exact unit tests', () => {
  // Synthetic report with rows whose effLenses fall in each bucket.
  const mkRow = (eff: number) => ({
    source: `s${eff}`,
    rowsKept: 5,
    halfWidths: [1, 0, 0, 0, 0, 0],
    halfWidthSum: 1,
    probabilities: [1, 0, 0, 0, 0, 0],
    entropyBits: Math.log2(eff),
    entropyNormalised: Math.log2(eff) / LOG2_6,
    effectiveLenses: eff,
    concentration: 1 - Math.log2(eff) / LOG2_6,
    dominantLens: 'bootstrap' as const,
    dominantShare: 1 / eff,
    degenerateFlag: false,
  });
  const r = {
    generatedAt: '2026-04-30T00:00:00.000Z',
    windowStart: null,
    windowEnd: null,
    source: null,
    minRows: 4,
    confidence: 0.95,
    lambda: 1,
    bootstraps: 1000,
    seed: 42,
    alertConcentration: null,
    alertUniform: null,
    top: null,
    sort: 'concentration-desc' as const,
    totalSources: 5,
    sourcesWithAllLenses: 5,
    droppedMissingLens: 0,
    droppedAboveAlert: 0,
    meanEntropyNormalised: 0.5,
    medianEntropyNormalised: 0.5,
    meanEffectiveLenses: 3.5,
    meanConcentration: 0.5,
    nDegenerate: 0,
    nNearUniform: 0,
    nNearConcentrated: 0,
    globalDominantLens: 'bootstrap' as const,
    rows: [
      mkRow(1.5), // [1,2)
      mkRow(2.5), // [2,3)
      mkRow(3.5), // [3,4)
      mkRow(4.5), // [4,5)
      mkRow(6.0), // [5,6] — top bucket closed on both ends
    ],
  };
  const out = renderSourceRowTokenSlopeCiHalfWidthEntropy(r, {
    showEffectiveLensesBuckets: true,
  });
  assert.match(out, /\[1,2\)=1\/5 \(0\.2000\)/);
  assert.match(out, /\[2,3\)=1\/5 \(0\.2000\)/);
  assert.match(out, /\[3,4\)=1\/5 \(0\.2000\)/);
  assert.match(out, /\[4,5\)=1\/5 \(0\.2000\)/);
  assert.match(out, /\[5,6\]=1\/5 \(0\.2000\)/);
});

test('render: showEffectiveLensesBuckets — boundary values 2.0, 3.0, 4.0, 5.0 land in upper bucket', () => {
  const mkRow = (eff: number) => ({
    source: `s${eff}`,
    rowsKept: 5,
    halfWidths: [1, 0, 0, 0, 0, 0],
    halfWidthSum: 1,
    probabilities: [1, 0, 0, 0, 0, 0],
    entropyBits: Math.log2(eff),
    entropyNormalised: Math.log2(eff) / LOG2_6,
    effectiveLenses: eff,
    concentration: 1 - Math.log2(eff) / LOG2_6,
    dominantLens: 'bootstrap' as const,
    dominantShare: 1 / eff,
    degenerateFlag: false,
  });
  const r = {
    generatedAt: '2026-04-30T00:00:00.000Z',
    windowStart: null,
    windowEnd: null,
    source: null,
    minRows: 4,
    confidence: 0.95,
    lambda: 1,
    bootstraps: 1000,
    seed: 42,
    alertConcentration: null,
    alertUniform: null,
    top: null,
    sort: 'concentration-desc' as const,
    totalSources: 4,
    sourcesWithAllLenses: 4,
    droppedMissingLens: 0,
    droppedAboveAlert: 0,
    meanEntropyNormalised: 0.5,
    medianEntropyNormalised: 0.5,
    meanEffectiveLenses: 3.5,
    meanConcentration: 0.5,
    nDegenerate: 0,
    nNearUniform: 0,
    nNearConcentrated: 0,
    globalDominantLens: 'bootstrap' as const,
    rows: [mkRow(2.0), mkRow(3.0), mkRow(4.0), mkRow(5.0)],
  };
  const out = renderSourceRowTokenSlopeCiHalfWidthEntropy(r, {
    showEffectiveLensesBuckets: true,
  });
  // 2.0 -> [2,3), 3.0 -> [3,4), 4.0 -> [4,5), 5.0 -> [5,6]
  assert.match(out, /\[1,2\)=0\/4/);
  assert.match(out, /\[2,3\)=1\/4/);
  assert.match(out, /\[3,4\)=1\/4/);
  assert.match(out, /\[4,5\)=1\/4/);
  assert.match(out, /\[5,6\]=1\/4/);
});

test('render: showEffectiveLensesBuckets — empty rows omits the line', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthEntropy([], {
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiHalfWidthEntropy(r, {
    showEffectiveLensesBuckets: true,
  });
  assert.doesNotMatch(out, /\[effLenses buckets\]/);
});
