/**
 * Unit + integration tests for source-row-token-slope-ci-leave-one-lens-out.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiLeaveOneLensOut,
  renderSourceRowTokenSlopeCiLeaveOneLensOut,
  leaveOneLensOut,
  SLOPE_LOO_LENS_NAMES,
} from '../src/sourcerowtokenslopecileaveonelensout.js';
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

// --- leaveOneLensOut: pure helper ---

test('leaveOneLensOut: rejects wrong-length midpoint vector', () => {
  assert.throws(() => leaveOneLensOut([1, 2, 3], [1, 1, 1, 1, 1, 1]));
});

test('leaveOneLensOut: rejects wrong-length width vector', () => {
  assert.throws(() => leaveOneLensOut([1, 2, 3, 4, 5, 6], [1, 1, 1]));
});

test('leaveOneLensOut: all midpoints identical -> stability = 1', () => {
  const r = leaveOneLensOut([5, 5, 5, 5, 5, 5], [2, 2, 2, 2, 2, 2]);
  assert.equal(r.fullMid, 5);
  assert.equal(r.fullWidth, 2);
  assert.equal(r.fullMidStd, 0);
  for (const l of r.loo) {
    assert.equal(l.midShift, 0);
    assert.equal(l.signedMidShift, 0);
    assert.equal(l.widthRatio, 1);
    assert.equal(l.midShiftStd, 0);
  }
  assert.equal(r.maxMidShiftStd, 0);
  assert.equal(r.meanMidShiftStd, 0);
  assert.equal(r.widthRatioRange, 0);
  assert.equal(r.looStabilityScore, 1);
});

test('leaveOneLensOut: returns all 6 lens names in canonical order', () => {
  const r = leaveOneLensOut([1, 2, 3, 4, 5, 6], [1, 1, 1, 1, 1, 1]);
  assert.equal(r.loo.length, 6);
  for (let i = 0; i < 6; i++) {
    assert.equal(r.loo[i]!.lensRemoved, SLOPE_LOO_LENS_NAMES[i]);
  }
});

test('leaveOneLensOut: fullMid is mean of all six midpoints', () => {
  const r = leaveOneLensOut([1, 2, 3, 4, 5, 6], [1, 1, 1, 1, 1, 1]);
  assert.equal(r.fullMid, 21 / 6);
});

test('leaveOneLensOut: fullWidth is mean of all six widths', () => {
  const r = leaveOneLensOut([0, 0, 0, 0, 0, 0], [1, 2, 3, 4, 5, 6]);
  assert.equal(r.fullWidth, 21 / 6);
});

test('leaveOneLensOut: looMid for k=0 is mean of last five', () => {
  const r = leaveOneLensOut([10, 1, 2, 3, 4, 5], [1, 1, 1, 1, 1, 1]);
  // remove lens 0 (=10) -> mean(1,2,3,4,5) = 3
  assert.equal(r.loo[0]!.looMid, 3);
});

test('leaveOneLensOut: signedMidShift signs are correct', () => {
  // mids [10, 0, 0, 0, 0, 0], fullMid = 10/6
  // remove lens 0 (the high one) -> looMid = 0; shift = 0 - 10/6 < 0
  const r = leaveOneLensOut([10, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1]);
  assert.ok(r.loo[0]!.signedMidShift < 0);
  // remove lens 1 (=0) -> looMid = 10/5 = 2; shift = 2 - 10/6 > 0
  assert.ok(r.loo[1]!.signedMidShift > 0);
  for (const l of r.loo) {
    assert.equal(l.midShift, Math.abs(l.signedMidShift));
  }
});

test('leaveOneLensOut: midShiftStd is midShift / fullWidth', () => {
  const r = leaveOneLensOut([10, 0, 0, 0, 0, 0], [2, 2, 2, 2, 2, 2]);
  for (const l of r.loo) {
    assert.equal(l.midShiftStd, l.midShift / 2);
  }
});

test('leaveOneLensOut: degenerate fullWidth=0 -> midShiftStd=0, widthRatio=1', () => {
  const r = leaveOneLensOut([1, 2, 3, 4, 5, 6], [0, 0, 0, 0, 0, 0]);
  for (const l of r.loo) {
    assert.equal(l.midShiftStd, 0);
    assert.equal(l.widthRatio, 1);
  }
  assert.equal(r.looStabilityScore, 1);
});

test('leaveOneLensOut: most-influential lens is the outlier midpoint', () => {
  // lens 3 is far from the others
  const r = leaveOneLensOut([1, 1, 1, 100, 1, 1], [1, 1, 1, 1, 1, 1]);
  assert.equal(r.mostInfluentialLens, SLOPE_LOO_LENS_NAMES[3]);
});

test('leaveOneLensOut: tightest lens is the smallest-width lens', () => {
  // lens 2 has the tightest CI -> removing it inflates the mean width the most -> max widthRatio
  const r = leaveOneLensOut(
    [0, 0, 0, 0, 0, 0],
    [10, 10, 1, 10, 10, 10],
  );
  assert.equal(r.tightestLens, SLOPE_LOO_LENS_NAMES[2]);
});

test('leaveOneLensOut: widest lens is the largest-width lens', () => {
  // lens 4 has the widest CI -> removing it shrinks mean width -> min widthRatio
  const r = leaveOneLensOut(
    [0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 100, 1],
  );
  assert.equal(r.widestLens, SLOPE_LOO_LENS_NAMES[4]);
});

test('leaveOneLensOut: stability strictly between 0 and 1 when there is variance', () => {
  const r = leaveOneLensOut([1, 2, 3, 4, 5, 6], [1, 1, 1, 1, 1, 1]);
  assert.ok(r.looStabilityScore > 0);
  assert.ok(r.looStabilityScore < 1);
});

test('leaveOneLensOut: fullMidStd matches sample std', () => {
  // mids = [1,2,3,4,5,6]; mean=3.5; sum sq dev = 2.5^2*2 + 1.5^2*2 + 0.5^2*2 = 12.5 + 4.5 + 0.5 = 17.5
  // var = 17.5 / 5 = 3.5; std = sqrt(3.5)
  const r = leaveOneLensOut([1, 2, 3, 4, 5, 6], [1, 1, 1, 1, 1, 1]);
  assert.ok(Math.abs(r.fullMidStd - Math.sqrt(3.5)) < 1e-12);
});

test('leaveOneLensOut: meanMidShiftStd is mean of the six midShiftStd values', () => {
  const r = leaveOneLensOut([1, 2, 3, 4, 5, 6], [1, 1, 1, 1, 1, 1]);
  let s = 0;
  for (const l of r.loo) s += l.midShiftStd;
  assert.ok(Math.abs(r.meanMidShiftStd - s / 6) < 1e-12);
});

test('leaveOneLensOut: widthRatioRange is max - min of widthRatio', () => {
  const r = leaveOneLensOut(
    [0, 0, 0, 0, 0, 0],
    [1, 10, 1, 10, 1, 10],
  );
  let mx = -Infinity;
  let mn = Infinity;
  for (const l of r.loo) {
    if (l.widthRatio > mx) mx = l.widthRatio;
    if (l.widthRatio < mn) mn = l.widthRatio;
  }
  assert.equal(r.widthRatioRange, mx - mn);
});

test('leaveOneLensOut: ties in midShiftStd resolved in canonical lens order', () => {
  // symmetric mids around fullMid; multiple lenses tied
  const r = leaveOneLensOut([1, -1, 1, -1, 1, -1], [1, 1, 1, 1, 1, 1]);
  // mostInf and leastInf must be one of the canonical names (no error)
  assert.ok(SLOPE_LOO_LENS_NAMES.includes(r.mostInfluentialLens));
  assert.ok(SLOPE_LOO_LENS_NAMES.includes(r.leastInfluentialLens));
});

// --- builder: integration with the six lenses ---

test('builder: rejects minRows < 4', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLeaveOneLensOut([], { minRows: 3 }),
  );
});

test('builder: rejects bootstraps < 100', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLeaveOneLensOut([], { bootstraps: 50 }),
  );
});

test('builder: rejects confidence out of (0,1)', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLeaveOneLensOut([], { confidence: 1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLeaveOneLensOut([], { confidence: 0 }),
  );
});

test('builder: rejects lambda <= 0', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLeaveOneLensOut([], { lambda: 0 }),
  );
});

test('builder: rejects non-integer seed', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLeaveOneLensOut([], { seed: 1.5 }),
  );
});

test('builder: rejects alertUnstable out of (0,1]', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLeaveOneLensOut([], { alertUnstable: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLeaveOneLensOut([], { alertUnstable: 1.5 }),
  );
});

test('builder: rejects unknown sort key', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiLeaveOneLensOut([], {
      // @ts-expect-error testing runtime guard
      sort: 'bogus',
    }),
  );
});

test('builder: empty queue -> zero sources', () => {
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut([], {
    bootstraps: 100,
  });
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.rows.length, 0);
  assert.equal(r.meanLooStability, 0);
  assert.equal(r.medianLooStability, 0);
  assert.equal(r.globalMostInfluentialLens, null);
  assert.equal(r.globalLeastInfluentialLens, null);
});

test('builder: single source with sufficient rows -> exactly one row, 6 LOO entries', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
  });
  assert.equal(r.sourcesWithAllLenses, 1);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.loo.length, 6);
  assert.equal(r.rows[0]!.source, 's1');
  assert.ok(r.rows[0]!.looStabilityScore > 0);
  assert.ok(r.rows[0]!.looStabilityScore <= 1);
});

test('builder: each LOO row reports a canonical lens name', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
  });
  const names = r.rows[0]!.loo.map((l) => l.lensRemoved);
  assert.deepEqual(names, [...SLOPE_LOO_LENS_NAMES]);
});

test('builder: source dropped when too few rows', () => {
  const queue = ascending('tiny', 3);
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
  });
  // with 3 rows < default minRows 4, source is dropped at the lens level
  // and never reaches our intersection
  assert.equal(r.sourcesWithAllLenses, 0);
});

test('builder: looStabilityScore = 1 / (1 + maxMidShiftStd)', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
  });
  const row = r.rows[0]!;
  const expected = 1 / (1 + row.maxMidShiftStd);
  assert.ok(Math.abs(row.looStabilityScore - expected) < 1e-12);
});

test('builder: deterministic across two runs with same seed', () => {
  const queue = [
    ...ascending('s1', 30, 5),
    ...ascending('s2', 30, 12),
  ];
  const r1 = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const r2 = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 200,
    seed: 7,
  });
  assert.equal(r1.rows.length, r2.rows.length);
  for (let i = 0; i < r1.rows.length; i++) {
    assert.equal(r1.rows[i]!.source, r2.rows[i]!.source);
    assert.equal(r1.rows[i]!.looStabilityScore, r2.rows[i]!.looStabilityScore);
    assert.equal(r1.rows[i]!.maxMidShiftStd, r2.rows[i]!.maxMidShiftStd);
  }
});

test('builder: --top caps the row count', () => {
  const queue = [
    ...ascending('a', 30, 5),
    ...ascending('b', 30, 7),
    ...ascending('c', 30, 11),
    ...ascending('d', 30, 13),
  ];
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
    top: 2,
  });
  assert.equal(r.rows.length, 2);
});

test('builder: --alert-unstable filters to less-stable sources', () => {
  const queue = [
    ...ascending('a', 30, 5),
    ...ascending('b', 30, 11),
  ];
  const baseline = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
  });
  // pick a threshold strictly above the most-stable score so at least
  // one source survives
  const maxStability = Math.max(...baseline.rows.map((r) => r.looStabilityScore));
  const filt = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
    alertUnstable: maxStability,
  });
  // every survivor must have stability strictly less than threshold
  for (const r of filt.rows) {
    assert.ok(r.looStabilityScore < maxStability);
  }
  assert.equal(filt.droppedAboveAlert + filt.rows.length, baseline.rows.length);
});

test('builder: sort stability-desc orders rows in stability descending', () => {
  const queue = [
    ...ascending('a', 30, 5),
    ...ascending('b', 30, 7),
    ...ascending('c', 30, 11),
  ];
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
    sort: 'stability-desc',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.looStabilityScore >= r.rows[i]!.looStabilityScore);
  }
});

test('builder: sort stability-asc orders rows in stability ascending', () => {
  const queue = [
    ...ascending('a', 30, 5),
    ...ascending('b', 30, 7),
    ...ascending('c', 30, 11),
  ];
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
    sort: 'stability-asc',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.looStabilityScore <= r.rows[i]!.looStabilityScore);
  }
});

test('builder: sort source orders alphabetically', () => {
  const queue = [
    ...ascending('zeta', 30, 5),
    ...ascending('alpha', 30, 7),
    ...ascending('mu', 30, 11),
  ];
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
    sort: 'source',
  });
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['alpha', 'mu', 'zeta'],
  );
});

test('builder: sort rows orders by rowsKept descending', () => {
  const queue = [
    ...ascending('big', 60, 5),
    ...ascending('mid', 30, 7),
    ...ascending('small', 10, 11),
  ];
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
    sort: 'rows',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.rowsKept >= r.rows[i]!.rowsKept);
  }
});

test('builder: meanLooStability and medianLooStability are valid', () => {
  const queue = [
    ...ascending('a', 30, 5),
    ...ascending('b', 30, 7),
    ...ascending('c', 30, 11),
  ];
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
  });
  assert.ok(r.meanLooStability > 0 && r.meanLooStability <= 1);
  assert.ok(r.medianLooStability > 0 && r.medianLooStability <= 1);
});

test('builder: globalMostInfluentialLens is one of the canonical names', () => {
  const queue = [
    ...ascending('a', 30, 5),
    ...ascending('b', 30, 7),
    ...ascending('c', 30, 11),
  ];
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
  });
  assert.ok(
    r.globalMostInfluentialLens !== null &&
      SLOPE_LOO_LENS_NAMES.includes(r.globalMostInfluentialLens),
  );
  assert.ok(
    r.globalLeastInfluentialLens !== null &&
      SLOPE_LOO_LENS_NAMES.includes(r.globalLeastInfluentialLens),
  );
});

// --- renderer ---

test('renderer: header line names the subcommand', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
  });
  const out = renderSourceRowTokenSlopeCiLeaveOneLensOut(r);
  assert.ok(
    out.startsWith(
      'pew-insights source-row-token-slope-ci-leave-one-lens-out',
    ),
  );
});

test('renderer: empty rows -> "(no sources)"', () => {
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut([], {
    bootstraps: 100,
  });
  const out = renderSourceRowTokenSlopeCiLeaveOneLensOut(r);
  assert.ok(out.includes('(no sources)'));
});

test('renderer: showLoo expands per-source 6-row LOO sub-table', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
  });
  const compact = renderSourceRowTokenSlopeCiLeaveOneLensOut(r, {
    showLoo: false,
  });
  const verbose = renderSourceRowTokenSlopeCiLeaveOneLensOut(r, {
    showLoo: true,
  });
  assert.ok(verbose.length > compact.length);
  // every canonical lens name should appear in verbose mode
  for (const lens of SLOPE_LOO_LENS_NAMES) {
    assert.ok(verbose.includes(lens));
  }
});

test('renderer: includes mostInfluential and leastInfluential lens names', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
  });
  const out = renderSourceRowTokenSlopeCiLeaveOneLensOut(r);
  assert.ok(out.includes(r.rows[0]!.mostInfluentialLens));
  assert.ok(out.includes(r.rows[0]!.leastInfluentialLens));
});

test('renderer: header includes confidence, lambda, bootstraps, seed, sort', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiLeaveOneLensOut(queue, {
    bootstraps: 100,
  });
  const out = renderSourceRowTokenSlopeCiLeaveOneLensOut(r);
  assert.ok(out.includes('confidence: 0.95'));
  assert.ok(out.includes('lambda: 1'));
  assert.ok(out.includes('bootstraps: 100'));
  assert.ok(out.includes('seed: 42'));
  assert.ok(out.includes('sort: stability-desc'));
});
