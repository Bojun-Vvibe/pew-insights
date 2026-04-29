/**
 * Unit + integration tests for source-row-token-slope-ci-width-concordance.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiWidthConcordance,
  renderSourceRowTokenSlopeCiWidthConcordance,
  widthGini,
  widthCoeffOfVariation,
  median,
  SLOPE_WIDTH_LENS_NAMES,
} from '../src/sourcerowtokenslopeciwidthconcordance.js';
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

// --- Pure helpers: widthGini ---

test('widthGini: empty input returns 0', () => {
  assert.equal(widthGini([]), 0);
});

test('widthGini: constant vector returns 0', () => {
  assert.equal(widthGini([5, 5, 5, 5, 5, 5]), 0);
  assert.equal(widthGini([0.1, 0.1, 0.1]), 0);
});

test('widthGini: all-zero returns 0', () => {
  assert.equal(widthGini([0, 0, 0, 0, 0, 0]), 0);
});

test('widthGini: one element carries all mass approaches (n-1)/n', () => {
  const g = widthGini([0, 0, 0, 0, 0, 1]);
  assert.ok(Math.abs(g - 5 / 6) < 1e-12, `expected 5/6, got ${g}`);
});

test('widthGini: known 2-element case', () => {
  // [0, 1]: Gini = 0.5
  const g = widthGini([0, 1]);
  assert.ok(Math.abs(g - 0.5) < 1e-12, `expected 0.5, got ${g}`);
});

test('widthGini: scale-invariant', () => {
  const a = widthGini([1, 2, 3, 4, 5, 6]);
  const b = widthGini([10, 20, 30, 40, 50, 60]);
  assert.ok(Math.abs(a - b) < 1e-12);
});

test('widthGini: rejects negative values', () => {
  assert.throws(() => widthGini([1, -1, 2]), /non-negative/);
});

// --- Pure helpers: widthCoeffOfVariation ---

test('widthCoeffOfVariation: constant vector returns 0', () => {
  assert.equal(widthCoeffOfVariation([3, 3, 3, 3]), 0);
});

test('widthCoeffOfVariation: empty returns 0', () => {
  assert.equal(widthCoeffOfVariation([]), 0);
});

test('widthCoeffOfVariation: zero-mean returns 0', () => {
  assert.equal(widthCoeffOfVariation([0, 0, 0]), 0);
});

test('widthCoeffOfVariation: known case', () => {
  // [1, 2, 3] mean=2 popVar=2/3 stdev=sqrt(2/3) cv=sqrt(2/3)/2
  const cv = widthCoeffOfVariation([1, 2, 3]);
  const expected = Math.sqrt(2 / 3) / 2;
  assert.ok(Math.abs(cv - expected) < 1e-12);
});

test('widthCoeffOfVariation: scale-invariant', () => {
  const a = widthCoeffOfVariation([1, 2, 3, 4, 5]);
  const b = widthCoeffOfVariation([10, 20, 30, 40, 50]);
  assert.ok(Math.abs(a - b) < 1e-12);
});

// --- Pure helpers: median ---

test('median: odd length', () => {
  assert.equal(median([3, 1, 2]), 2);
});

test('median: even length averages middle two', () => {
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test('median: throws on empty', () => {
  assert.throws(() => median([]), /empty/);
});

test('median: does not mutate input', () => {
  const arr = [3, 1, 2];
  median(arr);
  assert.deepEqual(arr, [3, 1, 2]);
});

// --- Validation ---

test('build: rejects fractional minRows', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiWidthConcordance([], { minRows: 4.5 }),
    /minRows/,
  );
});

test('build: rejects minRows < 4', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiWidthConcordance([], { minRows: 3 }),
    /minRows/,
  );
});

test('build: rejects out-of-range confidence', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiWidthConcordance([], { confidence: 0 }),
    /confidence/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiWidthConcordance([], { confidence: 1 }),
    /confidence/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiWidthConcordance([], { confidence: NaN }),
    /confidence/,
  );
});

test('build: rejects non-positive lambda', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiWidthConcordance([], { lambda: 0 }),
    /lambda/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiWidthConcordance([], { lambda: -1 }),
    /lambda/,
  );
});

test('build: rejects bootstraps < 100', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiWidthConcordance([], { bootstraps: 99 }),
    /bootstraps/,
  );
});

test('build: rejects non-integer seed', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiWidthConcordance([], { seed: 1.5 }),
    /seed/,
  );
});

test('build: rejects top < 1', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiWidthConcordance([], { top: 0 }),
    /top/,
  );
});

test('build: rejects unknown sort key', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiWidthConcordance([], {
        sort: 'made-up' as never,
      }),
    /sort/,
  );
});

test('build: empty queue returns empty report with all six lens flags clean', () => {
  const r = buildSourceRowTokenSlopeCiWidthConcordance([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.droppedMissingLens, 0);
  assert.equal(r.disagreementCount, 0);
  assert.equal(r.superwideCount, 0);
  assert.equal(r.tightConsensusCount, 0);
});

test('SLOPE_WIDTH_LENS_NAMES is the six expected lens names in canonical order', () => {
  assert.deepEqual([...SLOPE_WIDTH_LENS_NAMES], [
    'bootstrap',
    'jackknife',
    'bca',
    'studentizedT',
    'abc',
    'profileLikelihood',
  ]);
});

// --- Integration: real-shape behaviour ---

test('integration: monotone-up source produces all 6 lenses with widthRank covering 1..6', () => {
  const queue = mkSeries('alpha', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const r = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 100,
    seed: 7,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.perLens.length, 6);
  const ranks = row.perLens.map((p) => p.widthRank).sort();
  assert.deepEqual(ranks, [1, 2, 3, 4, 5, 6]);
  assert.ok(row.widthMin <= row.widthMax);
  assert.ok(row.widthMin <= row.widthMedian && row.widthMedian <= row.widthMax);
  assert.ok(row.widthMin <= row.widthMean && row.widthMean <= row.widthMax);
  // widthRatio is Infinity if any lens has 0 width (e.g. perfectly
  // linear input collapses some kernels to a point-mass interval);
  // otherwise finite >= 1.
  if (Number.isFinite(row.widthRatio)) {
    assert.ok(row.widthRatio >= 1);
  } else {
    assert.equal(row.widthRatio, Infinity);
  }
  assert.ok(row.widthCv >= 0);
  assert.ok(row.widthGini >= 0 && row.widthGini < 1);
  assert.ok(SLOPE_WIDTH_LENS_NAMES.includes(row.narrowestLens));
  assert.ok(SLOPE_WIDTH_LENS_NAMES.includes(row.widestLens));
  if (Number.isFinite(row.widthVsBootstrapMaxRatio)) {
    assert.ok(row.widthVsBootstrapMaxRatio >= 1);
  }
});

test('integration: per-lens rank consistent with widths', () => {
  const queue = mkSeries('beta', [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  const r = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 100,
    seed: 11,
  });
  const row = r.sources[0]!;
  // Sort perLens by rank and check widths are non-decreasing.
  const sortedByRank = [...row.perLens].sort((a, b) => a.widthRank - b.widthRank);
  for (let i = 1; i < sortedByRank.length; i++) {
    assert.ok(
      sortedByRank[i]!.width >= sortedByRank[i - 1]!.width,
      `width-rank order violated at ${i}`,
    );
  }
});

test('integration: narrowestLens has rank 1, widestLens has rank 6', () => {
  const queue = mkSeries('gamma', [1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41]);
  const r = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 100,
    seed: 17,
  });
  const row = r.sources[0]!;
  const narrow = row.perLens.find((p) => p.lens === row.narrowestLens)!;
  const wide = row.perLens.find((p) => p.lens === row.widestLens)!;
  assert.equal(narrow.widthRank, 1);
  assert.equal(wide.widthRank, 6);
});

test('integration: widthRatio = widthMax / widthMin within float tolerance', () => {
  const queue = mkSeries('delta', [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]);
  const r = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 100,
    seed: 21,
  });
  const row = r.sources[0]!;
  if (row.widthMin > 0) {
    const expected = row.widthMax / row.widthMin;
    assert.ok(Math.abs(row.widthRatio - expected) < 1e-12);
  }
});

test('integration: widthVsBootstrapMaxRatio matches widthMax / bootstrapWidth', () => {
  const queue = mkSeries('eps', [10, 12, 15, 19, 24, 30, 37, 45, 54, 64]);
  const r = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 100,
    seed: 29,
  });
  const row = r.sources[0]!;
  const bootstrapLens = row.perLens.find((p) => p.lens === 'bootstrap')!;
  if (bootstrapLens.width > 0) {
    const expected = row.widthMax / bootstrapLens.width;
    assert.ok(Math.abs(row.widthVsBootstrapMaxRatio - expected) < 1e-9);
    assert.ok(row.widthVsBootstrapMaxRatio >= 1);
  }
});

test('integration: tightConsensus implies widthRatio <= 2', () => {
  const queue = mkSeries('zeta', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const r = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 100,
    seed: 31,
  });
  for (const row of r.sources) {
    if (row.tightConsensus) {
      assert.ok(Number.isFinite(row.widthRatio) && row.widthRatio <= 2);
    }
  }
});

test('integration: alertDisagreement only emits widthRatio > 3', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
    ...mkSeries('b', [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2]),
  ];
  const r = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 100,
    seed: 13,
    alertDisagreement: true,
  });
  for (const row of r.sources) {
    assert.ok(Number.isFinite(row.widthRatio) && row.widthRatio > 3);
  }
});

test('integration: alertSuperwide only emits widthVsBootstrapMaxRatio > 10', () => {
  const queue = [
    ...mkSeries('p', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
    ...mkSeries('q', [5, 5, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5]),
  ];
  const r = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 100,
    seed: 19,
    alertSuperwide: true,
  });
  for (const row of r.sources) {
    assert.ok(
      Number.isFinite(row.widthVsBootstrapMaxRatio) &&
        row.widthVsBootstrapMaxRatio > 10,
    );
  }
});

test('integration: top cap accounts via droppedBelowTopCap', () => {
  const queue = [
    ...mkSeries('s1', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
    ...mkSeries('s2', [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]),
    ...mkSeries('s3', [3, 6, 9, 12, 15, 18, 21, 24, 27, 30]),
  ];
  const r = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 100,
    seed: 23,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('integration: width-cv-desc sort orders by widthCv descending', () => {
  const queue = [
    ...mkSeries('sA', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
    ...mkSeries('sB', [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]),
    ...mkSeries('sC', [3, 6, 9, 12, 15, 18, 21, 24, 27, 30]),
  ];
  const r = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 100,
    seed: 37,
    sort: 'width-cv-desc',
  });
  for (let i = 1; i < r.sources.length; i++) {
    assert.ok(r.sources[i - 1]!.widthCv >= r.sources[i]!.widthCv);
  }
});

test('integration: width-gini-desc sort orders by widthGini descending', () => {
  const queue = [
    ...mkSeries('gA', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
    ...mkSeries('gB', [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]),
    ...mkSeries('gC', [3, 6, 9, 12, 15, 18, 21, 24, 27, 30]),
  ];
  const r = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 100,
    seed: 41,
    sort: 'width-gini-desc',
  });
  for (let i = 1; i < r.sources.length; i++) {
    assert.ok(r.sources[i - 1]!.widthGini >= r.sources[i]!.widthGini);
  }
});

test('integration: source sort is alphabetical', () => {
  const queue = [
    ...mkSeries('zzz', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
    ...mkSeries('aaa', [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]),
    ...mkSeries('mmm', [3, 6, 9, 12, 15, 18, 21, 24, 27, 30]),
  ];
  const r = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 100,
    seed: 43,
    sort: 'source',
  });
  const names = r.sources.map((s) => s.source);
  assert.deepEqual(names, [...names].sort());
});

test('integration: deterministic across re-runs with the same seed', () => {
  const queue = mkSeries('det', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const r1 = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 200,
    seed: 99,
  });
  const r2 = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 200,
    seed: 99,
  });
  assert.deepEqual(
    r1.sources[0]!.perLens.map((p) => [p.lens, p.width, p.widthRank]),
    r2.sources[0]!.perLens.map((p) => [p.lens, p.width, p.widthRank]),
  );
});

// --- Renderer ---

test('render: emits header line and command name', () => {
  const r = buildSourceRowTokenSlopeCiWidthConcordance([], {
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiWidthConcordance(r);
  assert.match(out, /pew-insights source-row-token-slope-ci-width-concordance/);
  assert.match(out, /2026-04-30T00:00:00\.000Z/);
  assert.match(out, /\(no sources\)/);
});

test('render: includes column headers when sources are present', () => {
  const queue = mkSeries('rsrc', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const r = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 100,
    seed: 1,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiWidthConcordance(r);
  assert.match(out, /widthMin/);
  assert.match(out, /widthMax/);
  assert.match(out, /widthRatio/);
  assert.match(out, /widthGini/);
  assert.match(out, /vsBoot/);
  assert.match(out, /tight/);
  assert.match(out, /rsrc/);
});

test('render: surfaces tight-consensus / disagreement / superwide counts in dropped-line', () => {
  const queue = mkSeries('hdr', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const r = buildSourceRowTokenSlopeCiWidthConcordance(queue, {
    bootstraps: 100,
    seed: 3,
  });
  const out = renderSourceRowTokenSlopeCiWidthConcordance(r);
  assert.match(out, /disagreement: \d+/);
  assert.match(out, /superwide: \d+/);
  assert.match(out, /tight-consensus: \d+/);
});
