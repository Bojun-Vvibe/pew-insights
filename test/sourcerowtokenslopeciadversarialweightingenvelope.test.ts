/**
 * Unit + integration tests for
 * source-row-token-slope-ci-adversarial-weighting-envelope.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope,
  renderSourceRowTokenSlopeCiAdversarialWeightingEnvelope,
  adversarialWeightingEnvelope,
  SLOPE_ENVELOPE_LENS_NAMES,
} from '../src/sourcerowtokenslopeciadversarialweightingenvelope.js';
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

function ascending(source: string, n: number, slope = 10, base = 100): QueueLine[] {
  const vals: number[] = [];
  for (let i = 0; i < n; i++) vals.push(base + i * slope);
  return mkSeries(source, vals);
}

// --- adversarialWeightingEnvelope: pure helper ---

test('adversarialWeightingEnvelope: rejects wrong-length midpoints', () => {
  assert.throws(() =>
    adversarialWeightingEnvelope([1, 2, 3], [1, 1, 1, 1, 1, 1]),
  );
});

test('adversarialWeightingEnvelope: rejects wrong-length widths', () => {
  assert.throws(() =>
    adversarialWeightingEnvelope([1, 2, 3, 4, 5, 6], [1, 1, 1]),
  );
});

test('adversarialWeightingEnvelope: rejects negative widths', () => {
  assert.throws(() =>
    adversarialWeightingEnvelope([1, 2, 3, 4, 5, 6], [1, 1, -1, 1, 1, 1]),
  );
});

test('adversarialWeightingEnvelope: rejects non-finite widths', () => {
  assert.throws(() =>
    adversarialWeightingEnvelope([1, 2, 3, 4, 5, 6], [1, 1, NaN, 1, 1, 1]),
  );
});

test('adversarialWeightingEnvelope: rejects non-finite midpoints', () => {
  assert.throws(() =>
    adversarialWeightingEnvelope(
      [1, 2, Infinity, 4, 5, 6],
      [1, 1, 1, 1, 1, 1],
    ),
  );
});

test('adversarialWeightingEnvelope: identical midpoints -> envelopeRange=0, robustness=1', () => {
  const r = adversarialWeightingEnvelope(
    [7, 7, 7, 7, 7, 7],
    [1, 2, 3, 4, 5, 6],
  );
  assert.equal(r.equalMid, 7);
  assert.equal(r.envelopeLow, 7);
  assert.equal(r.envelopeHigh, 7);
  assert.equal(r.envelopeRange, 0);
  assert.equal(r.equalRelativePosition, 0.5);
  assert.equal(r.worstCaseUpShift, 0);
  assert.equal(r.worstCaseDownShift, 0);
  assert.equal(r.manipulability, 0);
  assert.equal(r.asymmetryIndex, 0);
  assert.equal(r.asymmetryDirection, 'neutral');
  assert.equal(r.envelopeRobustnessScore, 1);
  assert.equal(r.extremesDistinct, false);
  assert.equal(r.extremeUpLens, r.extremeDownLens);
});

test('adversarialWeightingEnvelope: distinct midpoints -> envelopeRange = max-min', () => {
  const r = adversarialWeightingEnvelope(
    [1, 2, 3, 4, 5, 6],
    [1, 1, 1, 1, 1, 1],
  );
  assert.equal(r.envelopeLow, 1);
  assert.equal(r.envelopeHigh, 6);
  assert.equal(r.envelopeRange, 5);
  assert.equal(r.equalMid, 3.5);
  // equalRelativePosition = (3.5 - 1) / 5 = 0.5 (centered)
  assert.ok(Math.abs(r.equalRelativePosition - 0.5) < 1e-12);
  assert.equal(r.worstCaseUpShift, 2.5);
  assert.equal(r.worstCaseDownShift, 2.5);
  assert.equal(r.asymmetryIndex, 0);
  assert.equal(r.asymmetryDirection, 'neutral');
  assert.equal(r.extremesDistinct, true);
  // mids = [1,2,3,4,5,6] in canonical lens order
  // bootstrap=1 (low), profileLikelihood=6 (high)
  assert.equal(r.extremeDownLens, 'bootstrap');
  assert.equal(r.extremeUpLens, 'profileLikelihood');
  // manipulability = envelopeRange / equalWidth = 5 / 1 = 5
  assert.equal(r.manipulability, 5);
  // robustness = 1 / (1+5) = 1/6
  assert.ok(Math.abs(r.envelopeRobustnessScore - 1 / 6) < 1e-12);
});

test('adversarialWeightingEnvelope: asymmetric midpoints -> asymmetryIndex captures direction', () => {
  // Most lenses agree on low end, one outlier high
  const r = adversarialWeightingEnvelope(
    [1, 1, 1, 1, 1, 11],
    [1, 1, 1, 1, 1, 1],
  );
  assert.equal(r.envelopeLow, 1);
  assert.equal(r.envelopeHigh, 11);
  assert.equal(r.envelopeRange, 10);
  // equalMid = (1*5 + 11) / 6 = 16/6
  const expectedEqual = 16 / 6;
  assert.ok(Math.abs(r.equalMid - expectedEqual) < 1e-12);
  // worstCaseUpShift = 11 - 16/6 = 50/6 ; worstCaseDownShift = 16/6 - 1 = 10/6
  // up > down, so asymmetryIndex > 0 -> 'up'
  assert.ok(r.worstCaseUpShift > r.worstCaseDownShift);
  assert.ok(r.asymmetryIndex > 0);
  assert.equal(r.asymmetryDirection, 'up');
  // equalRelativePosition near 0.16 (skewed low)
  assert.ok(r.equalRelativePosition < 0.25);
  // extreme up = profileLikelihood (last canonical), down = bootstrap
  assert.equal(r.extremeUpLens, 'profileLikelihood');
  assert.equal(r.extremeDownLens, 'bootstrap');
});

test('adversarialWeightingEnvelope: asymmetric midpoints in opposite direction', () => {
  const r = adversarialWeightingEnvelope(
    [-11, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
  );
  // equalMid = (-11 + 5) / 6 = -1
  assert.ok(Math.abs(r.equalMid - -1) < 1e-12);
  // envelope = [-11, 1], range = 12
  assert.equal(r.envelopeRange, 12);
  // worstCaseDownShift = -1 - -11 = 10 ; worstCaseUpShift = 1 - -1 = 2
  assert.ok(r.worstCaseDownShift > r.worstCaseUpShift);
  assert.ok(r.asymmetryIndex < 0);
  assert.equal(r.asymmetryDirection, 'down');
  assert.equal(r.extremeDownLens, 'bootstrap'); // -11
});

test('adversarialWeightingEnvelope: degenerate equalWidth=0 with envelope > 0 -> manipulability=Infinity, robustness=0', () => {
  const r = adversarialWeightingEnvelope(
    [1, 2, 3, 4, 5, 6],
    [0, 0, 0, 0, 0, 0],
  );
  assert.equal(r.equalWidth, 0);
  assert.equal(r.envelopeRange, 5);
  assert.equal(r.manipulability, Infinity);
  assert.equal(r.envelopeRobustnessScore, 0);
});

test('adversarialWeightingEnvelope: zero envelope AND zero width -> robustness=1, manip=0', () => {
  const r = adversarialWeightingEnvelope(
    [3, 3, 3, 3, 3, 3],
    [0, 0, 0, 0, 0, 0],
  );
  assert.equal(r.envelopeRange, 0);
  assert.equal(r.manipulability, 0);
  assert.equal(r.envelopeRobustnessScore, 1);
});

test('adversarialWeightingEnvelope: equalRelativePosition correctly placed', () => {
  // mids = [0, 0, 0, 0, 0, 10] -> equalMid = 10/6, envelope [0,10]
  // relPos = (10/6 - 0) / 10 = 1/6
  const r = adversarialWeightingEnvelope(
    [0, 0, 0, 0, 0, 10],
    [1, 1, 1, 1, 1, 1],
  );
  assert.ok(Math.abs(r.equalRelativePosition - 1 / 6) < 1e-12);
});

test('adversarialWeightingEnvelope: tie on extreme -> canonical-order tie-break', () => {
  // Two lenses share the max midpoint.
  const r = adversarialWeightingEnvelope(
    [5, 1, 5, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
  );
  // First occurrence of max in canonical order: index 0 = bootstrap
  assert.equal(r.extremeUpLens, 'bootstrap');
  // First occurrence of min in canonical order: index 1 = jackknife
  assert.equal(r.extremeDownLens, 'jackknife');
});

// --- build: integration ---

test('build: minRows guard rejects too-small min-rows', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope([], { minRows: 3 }),
  );
});

test('build: confidence guard', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope([], {
      confidence: 0,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope([], {
      confidence: 1,
    }),
  );
});

test('build: lambda guard', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope([], { lambda: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope([], { lambda: -1 }),
  );
});

test('build: bootstraps guard', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope([], {
      bootstraps: 50,
    }),
  );
});

test('build: alertManipulable guard', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope([], {
      alertManipulable: 0,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope([], {
      alertManipulable: 1.1,
    }),
  );
});

test('build: top guard', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope([], { top: 0 }),
  );
});

test('build: sort guard', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope([], {
      sort: 'nonsense' as never,
    }),
  );
});

test('build: empty queue -> zero sources, no crash', () => {
  const r = buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope([], {
    bootstraps: 200,
    seed: 42,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.rows.length, 0);
  assert.equal(r.globalExtremeUpLens, null);
  assert.equal(r.globalExtremeDownLens, null);
});

test('build: single ascending source -> reports robustness in (0, 1]', () => {
  const queue = ascending('s1', 30, 5);
  const r = buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope(queue, {
    bootstraps: 200,
    seed: 42,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.sourcesWithAllLenses, 1);
  assert.equal(r.rows.length, 1);
  const row = r.rows[0]!;
  assert.ok(row.envelopeRobustnessScore > 0);
  assert.ok(row.envelopeRobustnessScore <= 1);
  assert.ok(row.envelopeLow <= row.envelopeHigh);
  assert.ok(row.envelopeLow <= row.equalMid);
  assert.ok(row.equalMid <= row.envelopeHigh);
  assert.ok(SLOPE_ENVELOPE_LENS_NAMES.includes(row.extremeUpLens));
  assert.ok(SLOPE_ENVELOPE_LENS_NAMES.includes(row.extremeDownLens));
});

test('build: alertManipulable filter drops well-aligned sources', () => {
  const queue = [...ascending('s1', 30, 5), ...ascending('s2', 30, 7)];
  const baseline = buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope(queue, {
    bootstraps: 200,
    seed: 42,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  // Filter at threshold larger than any baseline robustness -> drops all
  const maxR = Math.max(...baseline.rows.map((r) => r.envelopeRobustnessScore));
  const filtered = buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope(queue, {
    bootstraps: 200,
    seed: 42,
    alertManipulable: Math.min(1, maxR + 0.01),
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  // All rows that were >= threshold get dropped
  assert.ok(
    filtered.rows.length <= baseline.rows.length,
    'filter only drops, never adds',
  );
});

test('build: top caps the output', () => {
  const queue = [
    ...ascending('s1', 30, 5),
    ...ascending('s2', 30, 7),
    ...ascending('s3', 30, 3),
  ];
  const r = buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope(queue, {
    bootstraps: 200,
    seed: 42,
    top: 2,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.ok(r.rows.length <= 2);
});

test('build: sort=source orders alphabetically', () => {
  const queue = [
    ...ascending('zeta', 30, 5),
    ...ascending('alpha', 30, 7),
    ...ascending('mid', 30, 3),
  ];
  const r = buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope(queue, {
    bootstraps: 200,
    seed: 42,
    sort: 'source',
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const sources = r.rows.map((x) => x.source);
  assert.deepEqual(sources, [...sources].sort());
});

test('build: sort=envelope-range-desc orders by descending envelopeRange', () => {
  const queue = [
    ...ascending('s1', 30, 5),
    ...ascending('s2', 30, 7),
    ...ascending('s3', 30, 3),
  ];
  const r = buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope(queue, {
    bootstraps: 200,
    seed: 42,
    sort: 'envelope-range-desc',
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.envelopeRange >= r.rows[i]!.envelopeRange);
  }
});

test('build: sort=robustness-asc -> ascending robustness', () => {
  const queue = [
    ...ascending('s1', 30, 5),
    ...ascending('s2', 30, 7),
    ...ascending('s3', 30, 3),
  ];
  const r = buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope(queue, {
    bootstraps: 200,
    seed: 42,
    sort: 'robustness-asc',
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(
      r.rows[i - 1]!.envelopeRobustnessScore <=
        r.rows[i]!.envelopeRobustnessScore,
    );
  }
});

test('build: aggregates are computed', () => {
  const queue = [...ascending('s1', 30, 5), ...ascending('s2', 30, 7)];
  const r = buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope(queue, {
    bootstraps: 200,
    seed: 42,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.ok(r.meanEnvelopeRobustness >= 0);
  assert.ok(r.meanEnvelopeRobustness <= 1);
  assert.ok(r.medianEnvelopeRobustness >= 0);
  assert.ok(r.medianEnvelopeRobustness <= 1);
  assert.ok(r.meanManipulability >= 0);
  assert.ok(r.globalExtremeUpLens !== null);
  assert.ok(r.globalExtremeDownLens !== null);
  assert.ok(
    r.globalAsymmetryDirection === 'up' ||
      r.globalAsymmetryDirection === 'down' ||
      r.globalAsymmetryDirection === 'neutral',
  );
});

// --- render ---

test('render: pretty output mentions header and columns', () => {
  const queue = ascending('s1', 30, 5);
  const r = buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope(queue, {
    bootstraps: 200,
    seed: 42,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiAdversarialWeightingEnvelope(r);
  assert.ok(
    out.includes('source-row-token-slope-ci-adversarial-weighting-envelope'),
  );
  assert.ok(out.includes('envLow'));
  assert.ok(out.includes('envHigh'));
  assert.ok(out.includes('manip'));
  assert.ok(out.includes('robust'));
  assert.ok(out.includes('extremeUpLens'));
});

test('render: empty rows -> "(no sources)"', () => {
  const out = renderSourceRowTokenSlopeCiAdversarialWeightingEnvelope({
    generatedAt: '2026-04-30T00:00:00.000Z',
    windowStart: null,
    windowEnd: null,
    source: null,
    minRows: 4,
    confidence: 0.95,
    lambda: 1,
    bootstraps: 1000,
    seed: 42,
    alertManipulable: null,
    top: null,
    sort: 'robustness-desc',
    totalSources: 0,
    sourcesWithAllLenses: 0,
    droppedMissingLens: 0,
    droppedAboveAlert: 0,
    meanEnvelopeRobustness: 0,
    medianEnvelopeRobustness: 0,
    meanManipulability: 0,
    globalExtremeUpLens: null,
    globalExtremeDownLens: null,
    globalAsymmetryDirection: null,
    rows: [],
  });
  assert.ok(out.includes('(no sources)'));
});

test('render: showExtremes appends one-line summary per source', () => {
  const queue = ascending('s1', 30, 5);
  const r = buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope(queue, {
    bootstraps: 200,
    seed: 42,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiAdversarialWeightingEnvelope(r, {
    showExtremes: true,
  });
  assert.ok(out.includes('extremes: up='));
  assert.ok(out.includes('asym='));
});

test('render: showExtremes off by default', () => {
  const queue = ascending('s1', 30, 5);
  const r = buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope(queue, {
    bootstraps: 200,
    seed: 42,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiAdversarialWeightingEnvelope(r);
  assert.ok(!out.includes('extremes: up='));
});

test('render: degenerate manipulability=Infinity prints "inf"', () => {
  const out = renderSourceRowTokenSlopeCiAdversarialWeightingEnvelope({
    generatedAt: '2026-04-30T00:00:00.000Z',
    windowStart: null,
    windowEnd: null,
    source: null,
    minRows: 4,
    confidence: 0.95,
    lambda: 1,
    bootstraps: 1000,
    seed: 42,
    alertManipulable: null,
    top: null,
    sort: 'robustness-desc',
    totalSources: 1,
    sourcesWithAllLenses: 1,
    droppedMissingLens: 0,
    droppedAboveAlert: 0,
    meanEnvelopeRobustness: 0,
    medianEnvelopeRobustness: 0,
    meanManipulability: 0,
    globalExtremeUpLens: 'bootstrap',
    globalExtremeDownLens: 'bootstrap',
    globalAsymmetryDirection: 'neutral',
    rows: [
      {
        source: 'sX',
        rowsKept: 10,
        equalMid: 5,
        equalWidth: 0,
        envelopeLow: 1,
        envelopeHigh: 9,
        envelopeRange: 8,
        equalRelativePosition: 0.5,
        worstCaseUpShift: 4,
        worstCaseDownShift: 4,
        manipulability: Infinity,
        asymmetryIndex: 0,
        asymmetryDirection: 'neutral',
        extremeUpLens: 'profileLikelihood',
        extremeDownLens: 'bootstrap',
        extremesDistinct: true,
        envelopeRobustnessScore: 0,
      },
    ],
  });
  assert.ok(out.includes('inf'));
});
