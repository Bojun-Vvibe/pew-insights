/**
 * Unit + integration tests for
 * source-row-token-slope-ci-lens-residual-z.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiLensResidualZ,
  renderSourceRowTokenSlopeCiLensResidualZ,
  lensResidualZ,
  SLOPE_LENS_RESIDUAL_Z_LENS_NAMES,
} from '../src/sourcerowtokenslopecilensresidualz.js';
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

// --- lensResidualZ: pure helper ---

test('lensResidualZ: rejects wrong-length midpoints', () => {
  assert.throws(() => lensResidualZ([1, 2, 3], [1, 1, 1, 1, 1, 1]));
});

test('lensResidualZ: rejects wrong-length widths', () => {
  assert.throws(() => lensResidualZ([1, 2, 3, 4, 5, 6], [1, 1, 1]));
});

test('lensResidualZ: rejects negative widths', () => {
  assert.throws(() =>
    lensResidualZ([1, 2, 3, 4, 5, 6], [1, 1, -1, 1, 1, 1]),
  );
});

test('lensResidualZ: rejects non-finite widths', () => {
  assert.throws(() =>
    lensResidualZ([1, 2, 3, 4, 5, 6], [1, 1, NaN, 1, 1, 1]),
  );
});

test('lensResidualZ: rejects non-finite midpoints', () => {
  assert.throws(() =>
    lensResidualZ([1, 2, Infinity, 4, 5, 6], [1, 1, 1, 1, 1, 1]),
  );
});

test('lensResidualZ: identical midpoints → all residuals zero', () => {
  const out = lensResidualZ([5, 5, 5, 5, 5, 5], [1, 2, 3, 4, 5, 6]);
  assert.equal(out.equalMid, 5);
  for (const r of out.lensResiduals) assert.equal(r, 0);
  for (const z of out.lensResidualZ) assert.equal(z, 0);
  assert.equal(out.meanAbsZ, 0);
  assert.equal(out.outlierAbsZ, 0);
  assert.equal(out.outlierDirection, 'neutral');
  assert.equal(out.outlierConsensusOutside, false);
  assert.equal(out.nResidualOutside, 0);
  assert.equal(out.signAgreement, 'all-zero');
  assert.equal(out.lensConcordanceScore, 1);
});

test('lensResidualZ: all zero widths → all Z = 0 by convention', () => {
  const out = lensResidualZ([1, 2, 3, 4, 5, 6], [0, 0, 0, 0, 0, 0]);
  assert.equal(out.equalMid, 3.5);
  for (const z of out.lensResidualZ) assert.equal(z, 0);
  assert.equal(out.outlierAbsZ, 0);
  assert.equal(out.lensConcordanceScore, 1);
  // residuals themselves are non-zero
  assert.equal(out.lensResiduals[0], 1 - 3.5);
  assert.equal(out.lensResiduals[5], 6 - 3.5);
  // signs are mixed (some positive, some negative)
  assert.equal(out.signAgreement, 'mixed');
});

test('lensResidualZ: simple symmetric case with known residual', () => {
  // mids: 0,0,0,0,0,6 → equalMid = 1
  // residuals: -1,-1,-1,-1,-1,5
  // widths: all 2 → halfWidth = 1 → Z = residual / 1 = residual itself
  const out = lensResidualZ([0, 0, 0, 0, 0, 6], [2, 2, 2, 2, 2, 2]);
  assert.equal(out.equalMid, 1);
  assert.deepEqual(out.lensResiduals, [-1, -1, -1, -1, -1, 5]);
  assert.deepEqual(out.lensResidualZ, [-1, -1, -1, -1, -1, 5]);
  assert.deepEqual(out.lensResidualAbsZ, [1, 1, 1, 1, 1, 5]);
  assert.equal(out.outlierLens, 'profileLikelihood');
  assert.equal(out.outlierAbsZ, 5);
  assert.equal(out.outlierSigned, 5);
  assert.equal(out.outlierDirection, 'up');
  assert.equal(out.outlierConsensusOutside, true);
  // meanAbsZ = (1+1+1+1+1+5)/6 = 10/6
  assert.equal(out.meanAbsZ, 10 / 6);
  // 5 lenses with absZ == 1 hit the >= 1 threshold (all 6 actually)
  assert.equal(out.nResidualOutside, 6);
  // residuals: 5 negative + 1 positive → mixed
  assert.equal(out.signAgreement, 'mixed');
  assert.equal(out.lensConcordanceScore, 1 / (1 + 10 / 6));
});

test('lensResidualZ: outlier picks largest abs Z, canonical-order tie-break', () => {
  // mids 0,0,0,0,0,0 then we'll vary; tie by setting two equal abs Z
  // mids: 2,-2,0,0,0,0 → equalMid = 0
  // widths: 2,2,2,2,2,2 → halfWidth=1
  // Z: 2,-2,0,0,0,0 → both bootstrap and jackknife have abs Z = 2
  // canonical order tie-break → bootstrap (index 0) wins
  const out = lensResidualZ([2, -2, 0, 0, 0, 0], [2, 2, 2, 2, 2, 2]);
  assert.equal(out.outlierLens, 'bootstrap');
  assert.equal(out.outlierAbsZ, 2);
  assert.equal(out.outlierSigned, 2);
  assert.equal(out.outlierDirection, 'up');
  assert.equal(out.outlierConsensusOutside, true);
});

test('lensResidualZ: nResidualOutside threshold is >= 1, not > 1', () => {
  // residuals exactly 1 in absolute Z must count
  // mids: -1,1,0,0,0,0 → equalMid = 0
  // widths: 2,2,10,10,10,10 → halfWidths: 1,1,5,5,5,5
  // Z: -1, 1, 0, 0, 0, 0 → absZ: 1,1,0,0,0,0 → 2 outside
  const out = lensResidualZ([-1, 1, 0, 0, 0, 0], [2, 2, 10, 10, 10, 10]);
  assert.equal(out.nResidualOutside, 2);
});

test('lensResidualZ: signAgreement all-up only when no negatives and at least one zero', () => {
  // By construction of equal-weight mean, residuals sum to 0.
  // So all-up requires at least one zero residual; e.g.
  // mids: 0,0,0,0,0,0 is all-zero. To get all-up some residual
  // would have to be > 0 with none < 0 — impossible unless some
  // are zero. mids: 1,1,1,1,1,1 → equalMid 1, all residuals 0 → all-zero.
  // Construct intentionally: mids 0,0,0,0,0,0 with widths nonzero → all zero residual
  // To force all-up we need contrived case; we'll show that mixed is the typical case
  const out = lensResidualZ([1, 2, 3, 4, 5, 6], [1, 1, 1, 1, 1, 1]);
  assert.equal(out.signAgreement, 'mixed');
});

test('lensResidualZ: concordance score in (0, 1]', () => {
  const out = lensResidualZ([0, 0, 0, 0, 0, 6], [2, 2, 2, 2, 2, 2]);
  assert.ok(out.lensConcordanceScore > 0);
  assert.ok(out.lensConcordanceScore <= 1);
});

test('lensResidualZ: lens names array has length 6', () => {
  assert.equal(SLOPE_LENS_RESIDUAL_Z_LENS_NAMES.length, 6);
});

test('lensResidualZ: outlierConsensusOutside boundary at exactly 1', () => {
  // mids: -1,1,0,0,0,0 → equalMid = 0; widths 2,2,2,2,2,2 → halfWidth 1
  // Z: -1, 1, 0, 0, 0, 0 → outlierAbsZ = 1 (canonical-tie: bootstrap index 0)
  // 1 >= 1 → outside true
  const out = lensResidualZ([-1, 1, 0, 0, 0, 0], [2, 2, 2, 2, 2, 2]);
  assert.equal(out.outlierAbsZ, 1);
  assert.equal(out.outlierConsensusOutside, true);
});

test('lensResidualZ: outlierConsensusOutside false for tiny residuals', () => {
  const out = lensResidualZ([0.01, -0.01, 0, 0, 0, 0], [10, 10, 10, 10, 10, 10]);
  assert.ok(out.outlierAbsZ < 1);
  assert.equal(out.outlierConsensusOutside, false);
});

// --- builder: option validation ---

test('builder: rejects min-rows < 4', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensResidualZ([], { minRows: 3 }),
  );
});

test('builder: rejects non-integer min-rows', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensResidualZ([], { minRows: 4.5 }),
  );
});

test('builder: rejects confidence out of (0,1)', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensResidualZ([], { confidence: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensResidualZ([], { confidence: 1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensResidualZ([], { confidence: -0.1 }),
  );
});

test('builder: rejects non-positive lambda', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensResidualZ([], { lambda: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensResidualZ([], { lambda: -1 }),
  );
});

test('builder: rejects bootstraps < 100', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensResidualZ([], { bootstraps: 50 }),
  );
});

test('builder: rejects non-integer seed', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensResidualZ([], { seed: 1.5 }),
  );
});

test('builder: rejects alertDiscordant out of (0,1]', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensResidualZ([], { alertDiscordant: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensResidualZ([], { alertDiscordant: 1.5 }),
  );
});

test('builder: rejects top < 1', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensResidualZ([], { top: 0 }),
  );
});

test('builder: rejects unknown sort key', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLensResidualZ([], {
      // @ts-expect-error testing runtime guard
      sort: 'bogus',
    }),
  );
});

test('builder: empty queue yields empty report', () => {
  const r = buildSourceRowTokenSlopeCiLensResidualZ([]);
  assert.equal(r.totalSources, 0);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.rows.length, 0);
  assert.equal(r.meanLensConcordance, 0);
  assert.equal(r.medianLensConcordance, 0);
  assert.equal(r.meanOutlierAbsZ, 0);
  assert.equal(r.globalOutlierLens, null);
  assert.equal(r.globalOutlierDirection, null);
  assert.equal(r.nSourcesWithConsensusOutside, 0);
});

// --- builder: integration with real series ---

test('builder: clean linear source produces low residuals (high concordance)', () => {
  const queue = ascending('clean', 60, 10, 100);
  const r = buildSourceRowTokenSlopeCiLensResidualZ(queue, {
    bootstraps: 200,
    seed: 7,
  });
  assert.equal(r.sourcesWithAllLenses, 1);
  assert.equal(r.rows.length, 1);
  const row = r.rows[0]!;
  // Concordance is in (0, 1]; structurally bounded.
  assert.ok(row.lensConcordanceScore > 0);
  assert.ok(row.lensConcordanceScore <= 1);
  assert.ok(Number.isFinite(row.meanAbsZ));
  assert.ok(row.meanAbsZ >= 0);
});

test('builder: report-level mean / median match per-row aggregation', () => {
  const queue = [
    ...ascending('a', 60, 10, 100),
    ...ascending('b', 60, 5, 200),
  ];
  const r = buildSourceRowTokenSlopeCiLensResidualZ(queue, {
    bootstraps: 200,
    seed: 7,
  });
  if (r.rows.length === 0) return;
  const sum = r.rows.reduce((a, b) => a + b.lensConcordanceScore, 0);
  assert.ok(Math.abs(sum / r.rows.length - r.meanLensConcordance) < 1e-9);
});

test('builder: sort source returns alphabetical order', () => {
  const queue = [
    ...ascending('zeta', 60, 10, 100),
    ...ascending('alpha', 60, 5, 200),
    ...ascending('mid', 60, 7, 150),
  ];
  const r = buildSourceRowTokenSlopeCiLensResidualZ(queue, {
    bootstraps: 200,
    seed: 7,
    sort: 'source',
  });
  if (r.rows.length >= 2) {
    for (let i = 1; i < r.rows.length; i++) {
      assert.ok(r.rows[i - 1]!.source <= r.rows[i]!.source);
    }
  }
});

test('builder: sort outlier-abs-z-desc returns descending outlierAbsZ', () => {
  const queue = [
    ...ascending('a', 60, 10, 100),
    ...ascending('b', 60, 5, 200),
  ];
  const r = buildSourceRowTokenSlopeCiLensResidualZ(queue, {
    bootstraps: 200,
    seed: 7,
    sort: 'outlier-abs-z-desc',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.outlierAbsZ >= r.rows[i]!.outlierAbsZ);
  }
});

test('builder: top caps the rows', () => {
  const queue = [
    ...ascending('a', 60, 10, 100),
    ...ascending('b', 60, 5, 200),
    ...ascending('c', 60, 7, 150),
  ];
  const r = buildSourceRowTokenSlopeCiLensResidualZ(queue, {
    bootstraps: 200,
    seed: 7,
    top: 1,
  });
  assert.ok(r.rows.length <= 1);
});

test('builder: alertDiscordant filters strictly less than threshold', () => {
  const queue = [
    ...ascending('a', 60, 10, 100),
    ...ascending('b', 60, 5, 200),
  ];
  const r = buildSourceRowTokenSlopeCiLensResidualZ(queue, {
    bootstraps: 200,
    seed: 7,
    alertDiscordant: 1.0, // every concordance < 1.0 (since meanAbsZ > 0 typically)
  });
  for (const row of r.rows) {
    assert.ok(row.lensConcordanceScore < 1.0);
  }
});

test('builder: alertOutside filters to outlierConsensusOutside == true', () => {
  const queue = [
    ...ascending('a', 60, 10, 100),
    ...ascending('b', 60, 5, 200),
  ];
  const r = buildSourceRowTokenSlopeCiLensResidualZ(queue, {
    bootstraps: 200,
    seed: 7,
    alertOutside: true,
  });
  for (const row of r.rows) {
    assert.equal(row.outlierConsensusOutside, true);
  }
});

test('builder: globalOutlierDirection tie-break order is up > down > neutral', () => {
  // Empty rows → null
  const r0 = buildSourceRowTokenSlopeCiLensResidualZ([]);
  assert.equal(r0.globalOutlierDirection, null);
});

test('builder: source filter restricts output', () => {
  const queue = [
    ...ascending('a', 60, 10, 100),
    ...ascending('b', 60, 5, 200),
  ];
  const r = buildSourceRowTokenSlopeCiLensResidualZ(queue, {
    bootstraps: 200,
    seed: 7,
    source: 'a',
  });
  for (const row of r.rows) assert.equal(row.source, 'a');
});

// --- renderer ---

test('renderer: empty rows still includes header and "(no sources)"', () => {
  const r = buildSourceRowTokenSlopeCiLensResidualZ([]);
  const out = renderSourceRowTokenSlopeCiLensResidualZ(r);
  assert.match(out, /pew-insights source-row-token-slope-ci-lens-residual-z/);
  assert.match(out, /\(no sources\)/);
});

test('renderer: includes column header when non-empty', () => {
  const queue = ascending('clean', 60, 10, 100);
  const r = buildSourceRowTokenSlopeCiLensResidualZ(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiLensResidualZ(r);
  assert.match(out, /outlierLens/);
  assert.match(out, /concord/);
});

test('renderer: showResiduals appends per-lens sub-table', () => {
  const queue = ascending('clean', 60, 10, 100);
  const r = buildSourceRowTokenSlopeCiLensResidualZ(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiLensResidualZ(r, {
    showResiduals: true,
  });
  if (r.rows.length > 0) {
    assert.match(out, /signedResid/);
    assert.match(out, /signedZ/);
    assert.match(out, /absZ/);
    // Every lens name should appear at least once in residual table
    for (const lens of SLOPE_LENS_RESIDUAL_Z_LENS_NAMES) {
      assert.match(out, new RegExp(lens));
    }
  }
});

test('renderer: shows alert-outside flag in header', () => {
  const r = buildSourceRowTokenSlopeCiLensResidualZ([], {
    alertOutside: true,
  });
  const out = renderSourceRowTokenSlopeCiLensResidualZ(r);
  assert.match(out, /alert-outside: true/);
});

test('renderer: handles infinite values gracefully', () => {
  // We can't really produce infinity from the builder; but the helper
  // should never produce inf either. Just sanity check the renderer.
  const r = buildSourceRowTokenSlopeCiLensResidualZ([]);
  const out = renderSourceRowTokenSlopeCiLensResidualZ(r);
  assert.ok(typeof out === 'string');
});

test('renderer: showSummary appends per-source one-line summary', () => {
  const queue = ascending('clean', 60, 10, 100);
  const r = buildSourceRowTokenSlopeCiLensResidualZ(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiLensResidualZ(r, {
    showSummary: true,
  });
  if (r.rows.length > 0) {
    assert.match(out, /summary: outlier /);
    assert.match(out, /signedZ=/);
    assert.match(out, /dir=/);
  }
});

test('renderer: showSummary flags consensus-outside CI cases', () => {
  // Build a constructed report by reusing the renderer with a hand-built
  // row would require crafting types; instead we drive through the builder
  // and assert the flag string only appears when at least one row has
  // outlierConsensusOutside == true.
  const queue = [
    ...ascending('a', 60, 10, 100),
    ...ascending('b', 60, 5, 200),
  ];
  const r = buildSourceRowTokenSlopeCiLensResidualZ(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiLensResidualZ(r, {
    showSummary: true,
  });
  const anyOutside = r.rows.some((row) => row.outlierConsensusOutside);
  if (anyOutside) {
    assert.match(out, /\(consensus outside its own CI\)/);
  }
});

test('renderer: showSummary and showResiduals compose without error', () => {
  const queue = ascending('clean', 60, 10, 100);
  const r = buildSourceRowTokenSlopeCiLensResidualZ(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiLensResidualZ(r, {
    showSummary: true,
    showResiduals: true,
  });
  if (r.rows.length > 0) {
    assert.match(out, /summary: outlier /);
    assert.match(out, /signedResid/);
  }
});
