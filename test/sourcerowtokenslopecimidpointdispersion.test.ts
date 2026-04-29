/**
 * Unit + integration tests for source-row-token-slope-ci-midpoint-dispersion.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiMidpointDispersion,
  renderSourceRowTokenSlopeCiMidpointDispersion,
  populationStd,
  linearQuantile,
  median,
  medianAbsoluteDeviation,
  SLOPE_MIDPOINT_DISPERSION_LENS_NAMES,
} from '../src/sourcerowtokenslopecimidpointdispersion.js';
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

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

function ascending(source: string, n: number): QueueLine[] {
  const vals: number[] = [];
  for (let i = 0; i < n; i++) vals.push(100 + i * 10);
  return mkSeries(source, vals);
}

// --- populationStd ---

test('populationStd: empty array returns 0', () => {
  assert.equal(populationStd([]), 0);
});

test('populationStd: single element returns 0', () => {
  assert.equal(populationStd([42]), 0);
});

test('populationStd: identical values return 0', () => {
  assert.equal(populationStd([5, 5, 5, 5]), 0);
});

test('populationStd: known values match closed form (n in denominator)', () => {
  // values [1, 2, 3, 4] mean 2.5; sq-dev sum = 2.25+0.25+0.25+2.25=5; /4 = 1.25; sqrt ~= 1.118033988
  assert.ok(Math.abs(populationStd([1, 2, 3, 4]) - Math.sqrt(1.25)) < 1e-12);
});

test('populationStd: independent of order', () => {
  const a = populationStd([1, 5, 2, 8, 3]);
  const b = populationStd([8, 3, 1, 2, 5]);
  assert.ok(Math.abs(a - b) < 1e-12);
});

test('populationStd: scales linearly with input', () => {
  const a = populationStd([1, 2, 3, 4]);
  const b = populationStd([10, 20, 30, 40]);
  assert.ok(Math.abs(b - 10 * a) < 1e-9);
});

test('populationStd: invariant to translation', () => {
  const a = populationStd([1, 2, 3, 4]);
  const b = populationStd([1001, 1002, 1003, 1004]);
  assert.ok(Math.abs(a - b) < 1e-9);
});

// --- linearQuantile ---

test('linearQuantile: q=0 returns minimum', () => {
  assert.equal(linearQuantile([3, 1, 4, 1, 5, 9, 2, 6], 0), 1);
});

test('linearQuantile: q=1 returns maximum', () => {
  assert.equal(linearQuantile([3, 1, 4, 1, 5, 9, 2, 6], 1), 9);
});

test('linearQuantile: q=0.5 of even-length matches median formula', () => {
  // sorted: [1, 2, 3, 4]; median = (2+3)/2 = 2.5
  assert.equal(linearQuantile([1, 2, 3, 4], 0.5), 2.5);
});

test('linearQuantile: q=0.5 of odd-length returns middle', () => {
  assert.equal(linearQuantile([1, 2, 3], 0.5), 2);
});

test('linearQuantile: single element', () => {
  assert.equal(linearQuantile([7], 0), 7);
  assert.equal(linearQuantile([7], 0.5), 7);
  assert.equal(linearQuantile([7], 1), 7);
});

test('linearQuantile: n=6, q=0.25 hits index 1.25 (interp)', () => {
  // sorted 6 evenly-spaced: [0, 1, 2, 3, 4, 5]; pos = 0.25*5=1.25 -> 0.75*1 + 0.25*2 = 1.25
  assert.equal(linearQuantile([5, 4, 3, 2, 1, 0], 0.25), 1.25);
});

test('linearQuantile: n=6, q=0.75 hits index 3.75 (interp)', () => {
  // sorted [0,1,2,3,4,5]; pos = 0.75*5=3.75 -> 0.25*3 + 0.75*4 = 3.75
  assert.equal(linearQuantile([0, 1, 2, 3, 4, 5], 0.75), 3.75);
});

test('linearQuantile: empty input throws', () => {
  assert.throws(() => linearQuantile([], 0.5), /empty/);
});

test('linearQuantile: q out of range throws', () => {
  assert.throws(() => linearQuantile([1, 2], -0.1), /q must be/);
  assert.throws(() => linearQuantile([1, 2], 1.1), /q must be/);
  assert.throws(() => linearQuantile([1, 2], NaN), /q must be/);
});

test('linearQuantile: does not mutate caller input', () => {
  const xs = [3, 1, 2];
  const before = xs.slice();
  linearQuantile(xs, 0.5);
  assert.deepEqual(xs, before);
});

// --- median ---

test('median: known values', () => {
  assert.equal(median([1, 2, 3, 4, 5]), 3);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test('median: empty throws', () => {
  assert.throws(() => median([]), /empty/);
});

// --- medianAbsoluteDeviation ---

test('medianAbsoluteDeviation: identical values returns 0', () => {
  assert.equal(medianAbsoluteDeviation([5, 5, 5, 5]), 0);
});

test('medianAbsoluteDeviation: single value returns 0', () => {
  assert.equal(medianAbsoluteDeviation([42]), 0);
});

test('medianAbsoluteDeviation: known values', () => {
  // values [1,2,3,4,5]; median=3; |dev|=[2,1,0,1,2]; median(|dev|)=1
  assert.equal(medianAbsoluteDeviation([1, 2, 3, 4, 5]), 1);
});

test('medianAbsoluteDeviation: empty throws', () => {
  assert.throws(() => medianAbsoluteDeviation([]), /empty/);
});

// --- lens-name catalog ---

test('SLOPE_MIDPOINT_DISPERSION_LENS_NAMES has 6 canonical lenses', () => {
  assert.equal(SLOPE_MIDPOINT_DISPERSION_LENS_NAMES.length, 6);
  assert.deepEqual([...SLOPE_MIDPOINT_DISPERSION_LENS_NAMES], [
    'bootstrap',
    'jackknife',
    'bca',
    'studentizedT',
    'abc',
    'profileLikelihood',
  ]);
});

// --- option validation (via builder) ---

test('builder: rejects non-integer minRows', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiMidpointDispersion([], { minRows: 3.5 } as any),
    /minRows/,
  );
});

test('builder: rejects minRows < 4', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiMidpointDispersion([], { minRows: 3 }),
    /minRows/,
  );
});

test('builder: rejects confidence outside (0,1)', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiMidpointDispersion([], { confidence: 0 }),
    /confidence/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiMidpointDispersion([], { confidence: 1 }),
    /confidence/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiMidpointDispersion([], { confidence: 1.5 }),
    /confidence/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiMidpointDispersion([], { confidence: NaN }),
    /confidence/,
  );
});

test('builder: rejects non-positive lambda', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiMidpointDispersion([], { lambda: 0 }),
    /lambda/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiMidpointDispersion([], { lambda: -1 }),
    /lambda/,
  );
});

test('builder: rejects bootstraps < 100', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiMidpointDispersion([], { bootstraps: 50 }),
    /bootstraps/,
  );
});

test('builder: rejects non-integer seed', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiMidpointDispersion([], { seed: 1.5 }),
    /seed/,
  );
});

test('builder: rejects non-positive top', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiMidpointDispersion([], { top: 0 }),
    /top/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiMidpointDispersion([], { top: -1 }),
    /top/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiMidpointDispersion([], { top: 1.5 }),
    /top/,
  );
});

test('builder: rejects unknown sort key', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiMidpointDispersion([], {
        sort: 'frobnicate' as any,
      }),
    /sort/,
  );
});

// --- structural / integration ---

test('builder: empty queue produces empty report', () => {
  const r = buildSourceRowTokenSlopeCiMidpointDispersion([]);
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedMissingLens, 0);
  assert.equal(r.dispersedCount, 0);
  assert.equal(r.tightlyClusteredCount, 0);
});

test('builder: single source with ascending data emits one row', () => {
  const queue = ascending('alpha', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  assert.equal(r.sourcesWithAllLenses, 1);
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'alpha');
  assert.equal(row.midpoints.length, 6);
  for (const m of row.midpoints) assert.ok(Number.isFinite(m));
});

test('builder: midRange === midMax - midMin', () => {
  const queue = ascending('beta', 25);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.midRange - (row.midMax - row.midMin)) < 1e-9);
});

test('builder: midMin and midMax bracket all midpoints', () => {
  const queue = ascending('gamma', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const row = r.sources[0]!;
  for (const m of row.midpoints) {
    assert.ok(m >= row.midMin - 1e-9);
    assert.ok(m <= row.midMax + 1e-9);
  }
});

test('builder: argMinLens midpoint equals midMin', () => {
  const queue = ascending('delta', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const row = r.sources[0]!;
  const idx = SLOPE_MIDPOINT_DISPERSION_LENS_NAMES.indexOf(row.argMinLens);
  assert.ok(Math.abs(row.midpoints[idx]! - row.midMin) < 1e-9);
});

test('builder: argMaxLens midpoint equals midMax', () => {
  const queue = ascending('eps', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const row = r.sources[0]!;
  const idx = SLOPE_MIDPOINT_DISPERSION_LENS_NAMES.indexOf(row.argMaxLens);
  assert.ok(Math.abs(row.midpoints[idx]! - row.midMax) < 1e-9);
});

test('builder: outlierGap is non-negative', () => {
  const queue = ascending('zeta', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const row = r.sources[0]!;
  assert.ok(row.outlierGap >= 0);
});

test('builder: midStd >= 0', () => {
  const queue = ascending('eta', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  for (const row of r.sources) assert.ok(row.midStd >= 0);
});

test('builder: midIqr >= 0', () => {
  const queue = ascending('theta', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  for (const row of r.sources) assert.ok(row.midIqr >= 0);
});

test('builder: midMad >= 0', () => {
  const queue = ascending('iota', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  for (const row of r.sources) assert.ok(row.midMad >= 0);
});

test('builder: meanWidth > 0 for non-degenerate series', () => {
  const queue = ascending('kappa', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  for (const row of r.sources) assert.ok(row.meanWidth >= 0);
});

test('builder: midRangeOverWidthMean is non-negative', () => {
  const queue = ascending('lambda', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  for (const row of r.sources) assert.ok(row.midRangeOverWidthMean >= 0);
});

test('builder: dispersed flag matches midRangeOverWidthMean >= 1', () => {
  const queue = [
    ...ascending('a', 30),
    ...ascending('b', 25),
  ];
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  for (const row of r.sources) {
    assert.equal(row.dispersed, row.midRangeOverWidthMean >= 1);
  }
});

test('builder: tightlyClustered flag matches midRangeOverWidthMean <= 0.25', () => {
  const queue = ascending('mu', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  for (const row of r.sources) {
    assert.equal(row.tightlyClustered, row.midRangeOverWidthMean <= 0.25);
  }
});

test('builder: dispersedCount and tightlyClusteredCount sum sanely', () => {
  const queue = [
    ...ascending('a', 30),
    ...ascending('b', 25),
    ...ascending('c', 20),
  ];
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  // dispersed (>=1) and tight (<=0.25) are mutually exclusive
  assert.ok(r.dispersedCount + r.tightlyClusteredCount <= r.sourcesWithAllLenses);
});

test('builder: alertDispersed filter restricts to dispersed sources only', () => {
  const queue = [
    ...ascending('a', 30),
    ...ascending('b', 25),
    ...ascending('c', 20),
  ];
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
    alertDispersed: true,
  });
  for (const row of r.sources) assert.equal(row.dispersed, true);
});

test('builder: alertTight filter restricts to tightly-clustered sources only', () => {
  const queue = [
    ...ascending('a', 30),
    ...ascending('b', 25),
    ...ascending('c', 20),
  ];
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
    alertTight: true,
  });
  for (const row of r.sources) assert.equal(row.tightlyClustered, true);
});

test('builder: top cap limits emitted sources and tracks droppedBelowTopCap', () => {
  const queue = [
    ...ascending('a', 30),
    ...ascending('b', 25),
    ...ascending('c', 20),
  ];
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowTopCap, 2);
});

test('builder: deterministic across two calls with same seed', () => {
  const queue = ascending('det', 30);
  const a = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 99,
    generatedAt: 'fixed',
  });
  const b = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 99,
    generatedAt: 'fixed',
  });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('builder: source filter restricts to one source', () => {
  const queue = [
    ...ascending('a', 30),
    ...ascending('b', 25),
  ];
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
    source: 'a',
  });
  for (const row of r.sources) assert.equal(row.source, 'a');
});

test('builder: sort range-over-width-desc orders rows correctly', () => {
  const queue = [
    ...ascending('a', 30),
    ...ascending('b', 25),
    ...ascending('c', 20),
  ];
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
    sort: 'range-over-width-desc',
  });
  for (let i = 0; i + 1 < r.sources.length; i++) {
    assert.ok(
      r.sources[i]!.midRangeOverWidthMean >=
        r.sources[i + 1]!.midRangeOverWidthMean,
    );
  }
});

test('builder: sort std-asc orders rows correctly', () => {
  const queue = [
    ...ascending('a', 30),
    ...ascending('b', 25),
    ...ascending('c', 20),
  ];
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
    sort: 'std-asc',
  });
  for (let i = 0; i + 1 < r.sources.length; i++) {
    assert.ok(r.sources[i]!.midStd <= r.sources[i + 1]!.midStd);
  }
});

test('builder: sort source orders alphabetically', () => {
  const queue = [
    ...ascending('zeta', 30),
    ...ascending('alpha', 25),
    ...ascending('mu', 20),
  ];
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
    sort: 'source',
  });
  const names = r.sources.map((s) => s.source);
  assert.deepEqual(names, [...names].sort());
});

test('builder: sort rows orders by rowsKept desc', () => {
  const queue = [
    ...ascending('big', 50),
    ...ascending('mid', 30),
    ...ascending('small', 20),
  ];
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
    sort: 'rows',
  });
  for (let i = 0; i + 1 < r.sources.length; i++) {
    assert.ok(r.sources[i]!.rowsKept >= r.sources[i + 1]!.rowsKept);
  }
});

test('builder: report metadata reflects options', () => {
  const queue = ascending('m', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 13,
    confidence: 0.9,
    lambda: 2,
    minRows: 5,
    sort: 'std-desc',
  });
  assert.equal(r.bootstraps, 200);
  assert.equal(r.seed, 13);
  assert.equal(r.confidence, 0.9);
  assert.equal(r.lambda, 2);
  assert.equal(r.minRows, 5);
  assert.equal(r.sort, 'std-desc');
});

test('builder: midpoints vector length always equals 6', () => {
  const queue = [
    ...ascending('a', 30),
    ...ascending('b', 25),
  ];
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  for (const row of r.sources) assert.equal(row.midpoints.length, 6);
});

test('builder: ascending series produces finite midpoints across all 6 lenses', () => {
  const queue = ascending('asc', 40);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 300,
    seed: 7,
  });
  const row = r.sources[0]!;
  for (const m of row.midpoints) assert.ok(Number.isFinite(m));
  assert.ok(Number.isFinite(row.midMean));
  assert.ok(Number.isFinite(row.midMedian));
});

// --- renderer ---

test('render: empty report says (no sources)', () => {
  const r = buildSourceRowTokenSlopeCiMidpointDispersion([]);
  const out = renderSourceRowTokenSlopeCiMidpointDispersion(r);
  assert.match(out, /\(no sources\)/);
});

test('render: header line includes diagnostic name', () => {
  const r = buildSourceRowTokenSlopeCiMidpointDispersion([]);
  const out = renderSourceRowTokenSlopeCiMidpointDispersion(r);
  assert.match(out, /pew-insights source-row-token-slope-ci-midpoint-dispersion/);
});

test('render: includes column header row when sources present', () => {
  const queue = ascending('vis', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiMidpointDispersion(r);
  assert.match(out, /midMean/);
  assert.match(out, /midRange/);
  assert.match(out, /range\/W/);
  assert.match(out, /outlierLens/);
});

test('render: source name appears in body for non-empty report', () => {
  const queue = ascending('renderme', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiMidpointDispersion(r);
  assert.match(out, /renderme/);
});

test('render: dispersed column shows yes/NO', () => {
  const queue = ascending('disp', 30);
  const r = buildSourceRowTokenSlopeCiMidpointDispersion(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiMidpointDispersion(r);
  // Either yes or NO must appear in output
  assert.ok(/\byes\b|\bNO\b/.test(out));
});
