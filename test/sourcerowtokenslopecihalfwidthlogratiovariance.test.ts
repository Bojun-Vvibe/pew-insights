/**
 * Unit + integration tests for
 * source-row-token-slope-ci-half-width-logratio-variance (axis 19).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance,
  renderSourceRowTokenSlopeCiHalfWidthLogRatioVariance,
  halfWidthLogRatioVariance,
  SLOPE_HALFWIDTH_LRV_LENS_NAMES,
} from '../src/sourcerowtokenslopecihalfwidthlogratiovariance.js';
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

function approx(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps;
}

// --- canonical lens names ---

test('SLOPE_HALFWIDTH_LRV_LENS_NAMES: length 6 and canonical order', () => {
  assert.equal(SLOPE_HALFWIDTH_LRV_LENS_NAMES.length, 6);
  assert.deepEqual([...SLOPE_HALFWIDTH_LRV_LENS_NAMES], [
    'bootstrap',
    'jackknife',
    'bca',
    'studentizedT',
    'abc',
    'profileLikelihood',
  ]);
});

// --- halfWidthLogRatioVariance primitive: validation ---

test('halfWidthLogRatioVariance: throws if length != 6', () => {
  assert.throws(() => halfWidthLogRatioVariance([]), /expected 6 half-widths/);
  assert.throws(() => halfWidthLogRatioVariance([1, 2, 3]), /expected 6 half-widths/);
  assert.throws(() => halfWidthLogRatioVariance([1, 2, 3, 4, 5, 6, 7]), /expected 6 half-widths/);
});

test('halfWidthLogRatioVariance: throws on non-finite inputs', () => {
  assert.throws(() => halfWidthLogRatioVariance([1, 2, 3, 4, 5, NaN]), /finite/);
  assert.throws(() => halfWidthLogRatioVariance([1, 2, 3, 4, Infinity, 6]), /finite/);
  assert.throws(() => halfWidthLogRatioVariance([1, 2, 3, -Infinity, 5, 6]), /finite/);
});

test('halfWidthLogRatioVariance: throws on negative inputs', () => {
  assert.throws(() => halfWidthLogRatioVariance([1, 2, 3, 4, 5, -0.1]), /non-negative/);
  assert.throws(() => halfWidthLogRatioVariance([-1, 2, 3, 4, 5, 6]), /non-negative/);
});

test('halfWidthLogRatioVariance: zero halfWidths allowed (excluded as ineligible)', () => {
  // Two positive, four zero -> K=2, pairs=1, LRV=0 (single pair, mean = it)
  const r = halfWidthLogRatioVariance([1, 1, 0, 0, 0, 0]);
  assert.equal(r.positiveCount, 2);
  assert.equal(r.pairsCount, 1);
  assert.equal(r.degenerateFlag, false);
  assert(approx(r.logRatioVariance, 0));
});

// --- degenerate behaviour ---

test('halfWidthLogRatioVariance: all-zero -> degenerate, all metrics 0, lenses null', () => {
  const r = halfWidthLogRatioVariance([0, 0, 0, 0, 0, 0]);
  assert.equal(r.degenerateFlag, true);
  assert.equal(r.positiveCount, 0);
  assert.equal(r.pairsCount, 0);
  assert.equal(r.logRatioVariance, 0);
  assert.equal(r.logRatioStdDev, 0);
  assert.equal(r.maxAbsLogRatio, 0);
  assert.equal(r.clrVariance, 0);
  assert.equal(r.widestLens, null);
  assert.equal(r.narrowestLens, null);
});

test('halfWidthLogRatioVariance: exactly one positive -> degenerate; lens identified', () => {
  const r = halfWidthLogRatioVariance([0, 0, 5, 0, 0, 0]);
  assert.equal(r.degenerateFlag, true);
  assert.equal(r.positiveCount, 1);
  assert.equal(r.pairsCount, 0);
  assert.equal(r.widestLens, 'bca');
  assert.equal(r.narrowestLens, 'bca');
});

// --- uniform / scale invariance ---

test('halfWidthLogRatioVariance: uniform halfWidths -> LRV = 0', () => {
  const r = halfWidthLogRatioVariance([1, 1, 1, 1, 1, 1]);
  assert.equal(r.degenerateFlag, false);
  assert.equal(r.positiveCount, 6);
  assert.equal(r.pairsCount, 15);
  assert(approx(r.logRatioMean, 0));
  assert(approx(r.logRatioVariance, 0));
  assert(approx(r.logRatioStdDev, 0));
  assert(approx(r.maxAbsLogRatio, 0));
  assert(approx(r.clrVariance, 0));
});

test('halfWidthLogRatioVariance: scale invariance (LRV unchanged under x10)', () => {
  const a = halfWidthLogRatioVariance([1, 2, 3, 4, 5, 6]);
  const b = halfWidthLogRatioVariance([10, 20, 30, 40, 50, 60]);
  assert(approx(a.logRatioVariance, b.logRatioVariance, 1e-12));
  assert(approx(a.maxAbsLogRatio, b.maxAbsLogRatio, 1e-12));
  assert(approx(a.clrVariance, b.clrVariance, 1e-12));
});

test('halfWidthLogRatioVariance: scale invariance under x1e-6', () => {
  const a = halfWidthLogRatioVariance([1, 2, 3, 4, 5, 6]);
  const b = halfWidthLogRatioVariance([1e-6, 2e-6, 3e-6, 4e-6, 5e-6, 6e-6]);
  assert(approx(a.logRatioVariance, b.logRatioVariance, 1e-12));
});

// --- closed-form numerical checks ---

test('halfWidthLogRatioVariance: two-positive case has LRV = 0 (single pair)', () => {
  // K=2, single pair r = log 1 - log e = -1; mean = -1; var = 0.
  const r = halfWidthLogRatioVariance([1, Math.E, 0, 0, 0, 0]);
  assert.equal(r.positiveCount, 2);
  assert.equal(r.pairsCount, 1);
  assert(approx(r.logRatioMean, -1));
  assert(approx(r.logRatioVariance, 0));
  assert(approx(r.maxAbsLogRatio, 1));
});

test('halfWidthLogRatioVariance: three equal-spaced log values', () => {
  // K=3, h = [1, e, e^2, 0, 0, 0]; logH = [0, 1, 2]; pairs r = -1, -2, -1.
  // mean = -4/3; var = ((-1+4/3)^2 + (-2+4/3)^2 + (-1+4/3)^2)/3
  //              = ((1/3)^2 + (-2/3)^2 + (1/3)^2)/3 = (1/9+4/9+1/9)/3 = 6/27 = 2/9
  const r = halfWidthLogRatioVariance([1, Math.E, Math.E * Math.E, 0, 0, 0]);
  assert.equal(r.positiveCount, 3);
  assert.equal(r.pairsCount, 3);
  assert(approx(r.logRatioMean, -4 / 3, 1e-12));
  assert(approx(r.logRatioVariance, 2 / 9, 1e-12));
  assert(approx(r.maxAbsLogRatio, 2, 1e-12));
});

test('halfWidthLogRatioVariance: clrVariance matches direct computation', () => {
  // Same K=3 case: logH = [0, 1, 2]; mean = 1; clr = [-1, 0, 1];
  // clrVar = (1+0+1)/3 = 2/3
  const r = halfWidthLogRatioVariance([1, Math.E, Math.E * Math.E, 0, 0, 0]);
  assert(approx(r.clrVariance, 2 / 3, 1e-12));
});

test('halfWidthLogRatioVariance: widest/narrowest identified (canonical tie-break)', () => {
  // h = [3, 1, 5, 0.1, 0.5, 2]; widest=bca (5), narrowest=studentizedT (0.1)
  const r = halfWidthLogRatioVariance([3, 1, 5, 0.1, 0.5, 2]);
  assert.equal(r.widestLens, 'bca');
  assert.equal(r.narrowestLens, 'studentizedT');
});

test('halfWidthLogRatioVariance: tie breaks canonically (first-index)', () => {
  // Two equal max -> earliest in canonical order wins.
  const r = halfWidthLogRatioVariance([5, 1, 5, 1, 1, 1]);
  assert.equal(r.widestLens, 'bootstrap');
  // Min ties -> earliest of the four 1.0 values -> jackknife
  assert.equal(r.narrowestLens, 'jackknife');
});

test('halfWidthLogRatioVariance: maxAbsLogRatio equals log(max/min)', () => {
  const r = halfWidthLogRatioVariance([1, 100, 10, 0.1, 1, 1]);
  // positives: [1, 100, 10, 0.1, 1, 1]; max=100, min=0.1; ratio=1000; log(1000)
  assert(approx(r.maxAbsLogRatio, Math.log(1000), 1e-12));
});

test('halfWidthLogRatioVariance: highly dispersed >= 1', () => {
  // h = [1, 10, 1, 10, 1, 10]; logH = [0, ln10, 0, ln10, 0, ln10].
  // 15 unordered pairs: 6 give r = -ln10, 3 give r = +ln10, 6 give 0.
  // mean = -3 ln10 / 15 = -ln10/5.
  // sumR^2 = 9*(ln10)^2; var = 9/15 (ln10)^2 - (ln10/5)^2
  //        = 0.6 (ln10)^2 - 0.04 (ln10)^2 = 0.56 (ln10)^2.
  const r = halfWidthLogRatioVariance([1, 10, 1, 10, 1, 10]);
  const ln10sq = Math.log(10) * Math.log(10);
  const expected = 0.56 * ln10sq;
  assert(approx(r.logRatioVariance, expected, 1e-12));
  assert.ok(r.logRatioVariance >= 1);
});

test('halfWidthLogRatioVariance: stdDev = sqrt(variance)', () => {
  const r = halfWidthLogRatioVariance([1, 2, 3, 4, 5, 6]);
  assert(approx(r.logRatioStdDev, Math.sqrt(r.logRatioVariance), 1e-12));
});

test('halfWidthLogRatioVariance: probabilities sum semantics — halfWidths preserved', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const r = halfWidthLogRatioVariance(input);
  assert.deepEqual(r.halfWidths, input);
});

test('halfWidthLogRatioVariance: pairsCount matches K(K-1)/2 across K', () => {
  for (const K of [2, 3, 4, 5, 6]) {
    const h: number[] = [];
    for (let i = 0; i < 6; i++) h.push(i < K ? i + 1 : 0);
    const r = halfWidthLogRatioVariance(h);
    assert.equal(r.positiveCount, K);
    assert.equal(r.pairsCount, (K * (K - 1)) / 2);
  }
});

test('halfWidthLogRatioVariance: variance always >= 0', () => {
  for (let trial = 0; trial < 50; trial++) {
    const h: number[] = [];
    for (let i = 0; i < 6; i++) h.push(Math.random() * 10 + 1e-3);
    const r = halfWidthLogRatioVariance(h);
    assert.ok(r.logRatioVariance >= 0, `negative LRV: ${r.logRatioVariance}`);
    assert.ok(r.clrVariance >= 0);
    assert.ok(r.maxAbsLogRatio >= 0);
    assert.ok(r.logRatioStdDev >= 0);
  }
});

test('halfWidthLogRatioVariance: full-positive case identifies widest/narrowest', () => {
  const r = halfWidthLogRatioVariance([0.5, 1, 2, 4, 8, 16]);
  assert.equal(r.widestLens, 'profileLikelihood');
  assert.equal(r.narrowestLens, 'bootstrap');
  assert(approx(r.maxAbsLogRatio, Math.log(32), 1e-12));
});

// --- builder validation ---

test('build: minRows < 4 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([], { minRows: 3 }),
    /minRows/,
  );
});

test('build: confidence out of (0,1) throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([], {
        confidence: 0,
      }),
    /confidence/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([], {
        confidence: 1,
      }),
    /confidence/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([], {
        confidence: -0.1,
      }),
    /confidence/,
  );
});

test('build: lambda <= 0 throws', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([], { lambda: 0 }),
    /lambda/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([], { lambda: -1 }),
    /lambda/,
  );
});

test('build: bootstraps < 100 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([], { bootstraps: 99 }),
    /bootstraps/,
  );
});

test('build: alertVariance < 0 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([], {
        alertVariance: -1,
      }),
    /alertVariance/,
  );
});

test('build: alertMaxRatio < 0 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([], {
        alertMaxRatio: -0.5,
      }),
    /alertMaxRatio/,
  );
});

test('build: top < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([], { top: 0 }),
    /top/,
  );
});

test('build: bad sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([], {
        sort: 'bogus' as any,
      }),
    /sort/,
  );
});

// --- builder integration on real-ish queue ---

test('build: empty queue produces empty rows', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([]);
  assert.equal(r.totalSources, 0);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.rows.length, 0);
  assert.equal(r.meanLogRatioVariance, 0);
  assert.equal(r.medianLogRatioVariance, 0);
  assert.equal(r.globalWidestLens, null);
  assert.equal(r.globalNarrowestLens, null);
});

test('build: single source ascending series produces one row', () => {
  const queue = ascending('alpha', 60);
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
  });
  assert.equal(r.sourcesWithAllLenses, 1);
  assert.equal(r.rows.length, 1);
  const row = r.rows[0]!;
  assert.equal(row.source, 'alpha');
  assert.equal(row.halfWidths.length, 6);
  for (const h of row.halfWidths) {
    assert.ok(Number.isFinite(h) && h >= 0);
  }
});

test('build: two sources both produced', () => {
  const queue = [...ascending('a', 60), ...ascending('b', 60, 5, 200)];
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
  });
  assert.equal(r.rows.length, 2);
  assert.deepEqual(r.rows.map((x) => x.source).sort(), ['a', 'b']);
});

test('build: --top truncates', () => {
  const queue = [
    ...ascending('a', 60),
    ...ascending('b', 60, 5, 200),
    ...ascending('c', 60, 7, 50),
  ];
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
    top: 2,
  });
  assert.equal(r.rows.length, 2);
});

test('build: --source filters to one', () => {
  const queue = [...ascending('a', 60), ...ascending('b', 60, 5, 200)];
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
    source: 'b',
  });
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'b');
});

test('build: alert-variance filters', () => {
  const queue = [...ascending('a', 60), ...ascending('b', 60, 5, 200)];
  const huge = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
    alertVariance: 1e9,
  });
  assert.equal(huge.rows.length, 0);
  assert.ok(huge.droppedAboveAlert >= 1);
});

test('build: alert-max-ratio filters', () => {
  const queue = [...ascending('a', 60), ...ascending('b', 60, 5, 200)];
  const huge = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
    alertMaxRatio: 1e9,
  });
  assert.equal(huge.rows.length, 0);
});

test('build: sort stable on source-name secondary key', () => {
  const queue = [...ascending('z', 60), ...ascending('a', 60), ...ascending('m', 60)];
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
    sort: 'source',
  });
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['a', 'm', 'z'],
  );
});

test('build: sort by variance-asc and variance-desc are reverses', () => {
  const queue = [
    ...ascending('a', 60),
    ...ascending('b', 60, 5, 200),
    ...ascending('c', 60, 7, 50),
  ];
  const asc = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
    sort: 'variance-asc',
  });
  const desc = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
    sort: 'variance-desc',
  });
  // The set of LRVs is the same.
  const ascLrv = asc.rows.map((r) => r.logRatioVariance);
  const descLrv = desc.rows.map((r) => r.logRatioVariance);
  assert.deepEqual([...ascLrv].sort(), [...descLrv].sort());
  // First in asc <= first in desc (when distinct).
  if (ascLrv.length > 1) {
    assert.ok(ascLrv[0]! <= ascLrv[ascLrv.length - 1]!);
    assert.ok(descLrv[0]! >= descLrv[descLrv.length - 1]!);
  }
});

test('build: report aggregates are consistent with rows', () => {
  const queue = [...ascending('a', 60), ...ascending('b', 60, 5, 200)];
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
  });
  if (r.rows.length > 0) {
    const meanLrv =
      r.rows.reduce((acc, x) => acc + x.logRatioVariance, 0) / r.rows.length;
    assert(approx(r.meanLogRatioVariance, meanLrv, 1e-9));
    const meanStd =
      r.rows.reduce((acc, x) => acc + x.logRatioStdDev, 0) / r.rows.length;
    assert(approx(r.meanLogRatioStdDev, meanStd, 1e-9));
  }
});

test('build: nDegenerate counts row-level degenerateFlag', () => {
  const queue = [...ascending('a', 60), ...ascending('b', 60, 5, 200)];
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
  });
  const expected = r.rows.filter((x) => x.degenerateFlag).length;
  assert.equal(r.nDegenerate, expected);
});

test('build: nNearIsotropic counts non-degenerate rows with LRV <= 0.01', () => {
  const queue = [...ascending('a', 60), ...ascending('b', 60, 5, 200)];
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
  });
  const expected = r.rows.filter(
    (x) => !x.degenerateFlag && x.logRatioVariance <= 0.01,
  ).length;
  assert.equal(r.nNearIsotropic, expected);
});

test('build: deterministic across runs with same seed', () => {
  const queue = [...ascending('a', 60), ...ascending('b', 60, 5, 200)];
  const r1 = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const r2 = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
    seed: 7,
  });
  assert.deepEqual(
    r1.rows.map((x) => x.logRatioVariance),
    r2.rows.map((x) => x.logRatioVariance),
  );
});

test('build: different seed may differ', () => {
  // Not strict — but typically resample-based lenses move.
  const queue = [...ascending('a', 60), ...ascending('b', 60, 5, 200)];
  const r1 = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
    seed: 1,
  });
  const r2 = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
    seed: 99,
  });
  // Allow equality but type/shape preserved.
  assert.equal(r1.rows.length, r2.rows.length);
});

test('build: respects --since/--until', () => {
  const queue = ascending('a', 120);
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-27T00:30:00.000Z',
  });
  assert.equal(r.windowStart, '2026-04-27T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-27T00:30:00.000Z');
});

test('build: source not present yields empty rows', () => {
  const queue = ascending('a', 60);
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
    source: 'no-such-source',
  });
  assert.equal(r.rows.length, 0);
});

// --- renderer ---

test('render: header includes axis name', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([]);
  const txt = renderSourceRowTokenSlopeCiHalfWidthLogRatioVariance(r);
  assert.match(
    txt,
    /pew-insights source-row-token-slope-ci-half-width-logratio-variance/,
  );
});

test('render: shows (no sources) on empty', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([]);
  const txt = renderSourceRowTokenSlopeCiHalfWidthLogRatioVariance(r);
  assert.match(txt, /\(no sources\)/);
});

test('render: per-source row contains source id and LRV column', () => {
  const queue = ascending('alpha', 60);
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
  });
  const txt = renderSourceRowTokenSlopeCiHalfWidthLogRatioVariance(r);
  assert.match(txt, /alpha/);
  assert.match(txt, /LRV/);
});

test('render: --show-summary appends summary line', () => {
  const queue = ascending('alpha', 60);
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
  });
  const txt = renderSourceRowTokenSlopeCiHalfWidthLogRatioVariance(r, {
    showSummary: true,
  });
  assert.match(txt, /summary: widestLens=/);
});

test('render: --show-variance-aggregate appends aggregate line', () => {
  const queue = ascending('alpha', 60);
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
  });
  const txt = renderSourceRowTokenSlopeCiHalfWidthLogRatioVariance(r, {
    showVarianceAggregate: true,
  });
  assert.match(txt, /\[variance aggregate\]/);
});

test('render: --show-lens-attribution appends two attribution lines', () => {
  const queue = [...ascending('a', 60), ...ascending('b', 60, 5, 200)];
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
  });
  const txt = renderSourceRowTokenSlopeCiHalfWidthLogRatioVariance(r, {
    showLensAttribution: true,
  });
  assert.match(txt, /\[lens attribution: widest\]/);
  assert.match(txt, /\[lens attribution: narrowest\]/);
});

test('render: --show-half-widths appends per-source halfWidths line', () => {
  const queue = ascending('alpha', 60);
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
  });
  const txt = renderSourceRowTokenSlopeCiHalfWidthLogRatioVariance(r, {
    showHalfWidths: true,
  });
  assert.match(txt, /halfWidths: bootstrap=/);
});

test('render: --show-clr-coords appends per-source clrCoords line', () => {
  const queue = ascending('alpha', 60);
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
  });
  const txt = renderSourceRowTokenSlopeCiHalfWidthLogRatioVariance(r, {
    showClrCoords: true,
  });
  assert.match(txt, /clrCoords: bootstrap=/);
});

test('render: --show-clr-coords reports "-" for degenerate row', () => {
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
    alertVariance: null,
    alertMaxRatio: null,
    top: null,
    sort: 'variance-desc' as const,
    totalSources: 1,
    sourcesWithAllLenses: 1,
    droppedMissingLens: 0,
    droppedAboveAlert: 0,
    meanLogRatioVariance: 0,
    medianLogRatioVariance: 0,
    meanLogRatioStdDev: 0,
    meanMaxAbsLogRatio: 0,
    nDegenerate: 1,
    nNearIsotropic: 0,
    nHighlyDispersed: 0,
    globalWidestLens: null,
    globalNarrowestLens: null,
    rows: [
      {
        source: 'zzz',
        rowsKept: 10,
        halfWidths: [0, 0, 0, 0, 0, 0],
        positiveCount: 0,
        pairsCount: 0,
        logRatioMean: 0,
        logRatioVariance: 0,
        logRatioStdDev: 0,
        maxAbsLogRatio: 0,
        clrVariance: 0,
        widestLens: null,
        narrowestLens: null,
        degenerateFlag: true,
      },
    ],
  };
  const txt = renderSourceRowTokenSlopeCiHalfWidthLogRatioVariance(r, {
    showClrCoords: true,
  });
  assert.match(txt, /clrCoords: bootstrap=- jackknife=- bca=- studentizedT=- abc=- profileLikelihood=-/);
});

test('render: degenerate flag rendered as "degen"', () => {
  // Force degenerate by handcrafted report.
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
    alertVariance: null,
    alertMaxRatio: null,
    top: null,
    sort: 'variance-desc' as const,
    totalSources: 1,
    sourcesWithAllLenses: 1,
    droppedMissingLens: 0,
    droppedAboveAlert: 0,
    meanLogRatioVariance: 0,
    medianLogRatioVariance: 0,
    meanLogRatioStdDev: 0,
    meanMaxAbsLogRatio: 0,
    nDegenerate: 1,
    nNearIsotropic: 0,
    nHighlyDispersed: 0,
    globalWidestLens: null,
    globalNarrowestLens: null,
    rows: [
      {
        source: 'zzz',
        rowsKept: 10,
        halfWidths: [0, 0, 0, 0, 0, 0],
        positiveCount: 0,
        pairsCount: 0,
        logRatioMean: 0,
        logRatioVariance: 0,
        logRatioStdDev: 0,
        maxAbsLogRatio: 0,
        clrVariance: 0,
        widestLens: null,
        narrowestLens: null,
        degenerateFlag: true,
      },
    ],
  };
  const txt = renderSourceRowTokenSlopeCiHalfWidthLogRatioVariance(r);
  assert.match(txt, /degen/);
});

// --- structural symmetry of LRV vs CLR ---

test('LRV and clrVariance: both zero iff all eligible logH equal', () => {
  // Equal eligible logs -> both 0.
  const r1 = halfWidthLogRatioVariance([2, 2, 2, 2, 2, 2]);
  assert(approx(r1.logRatioVariance, 0));
  assert(approx(r1.clrVariance, 0));
  // Unequal -> both > 0.
  const r2 = halfWidthLogRatioVariance([1, 2, 1, 1, 1, 1]);
  assert.ok(r2.logRatioVariance > 0);
  assert.ok(r2.clrVariance > 0);
});

test('halfWidthLogRatioVariance: monotone increase under spread (LRV grows with disparity)', () => {
  const small = halfWidthLogRatioVariance([1, 1.1, 1.2, 1.3, 1.4, 1.5]);
  const big = halfWidthLogRatioVariance([1, 10, 100, 1000, 10000, 100000]);
  assert.ok(big.logRatioVariance > small.logRatioVariance);
  assert.ok(big.maxAbsLogRatio > small.maxAbsLogRatio);
});

// --- types passthrough ---

test('build: report fields preserved (sort, alerts, seeds)', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([], {
    sort: 'stddev-asc',
    alertVariance: 0.5,
    alertMaxRatio: 2,
    seed: 13,
    bootstraps: 250,
    confidence: 0.9,
    lambda: 1.5,
    top: 7,
    since: '2026-01-01T00:00:00Z',
    until: '2026-02-01T00:00:00Z',
    source: 's1',
  });
  assert.equal(r.sort, 'stddev-asc');
  assert.equal(r.alertVariance, 0.5);
  assert.equal(r.alertMaxRatio, 2);
  assert.equal(r.seed, 13);
  assert.equal(r.bootstraps, 250);
  assert.equal(r.confidence, 0.9);
  assert.equal(r.lambda, 1.5);
  assert.equal(r.top, 7);
  assert.equal(r.windowStart, '2026-01-01T00:00:00Z');
  assert.equal(r.windowEnd, '2026-02-01T00:00:00Z');
  assert.equal(r.source, 's1');
});

test('build: generatedAt overridable for determinism', () => {
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([], {
    generatedAt: '2026-04-30T12:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2026-04-30T12:00:00.000Z');
});

// --- additional algebraic checks ---

test('halfWidthLogRatioVariance: K=4 closed form (geometric)', () => {
  // h = [1, 2, 4, 8, 0, 0]; logH = [0, ln2, 2ln2, 3ln2]
  // pairwise diffs = -ln2, -2ln2, -3ln2, -ln2, -2ln2, -ln2 (6 pairs)
  // Mean = -(ln2)(1+2+3+1+2+1)/6 = -10 ln2 / 6 = -5 ln2 / 3
  // Sum of squares = (ln2)^2 * (1+4+9+1+4+1) = 20 (ln2)^2
  // var = 20(ln2)^2/6 - (5 ln2/3)^2 = 10(ln2)^2/3 - 25(ln2)^2/9
  //     = 30(ln2)^2/9 - 25(ln2)^2/9 = 5(ln2)^2/9
  const r = halfWidthLogRatioVariance([1, 2, 4, 8, 0, 0]);
  const ln2 = Math.log(2);
  const expectedMean = (-5 * ln2) / 3;
  const expectedVar = (5 * ln2 * ln2) / 9;
  assert(approx(r.logRatioMean, expectedMean, 1e-12));
  assert(approx(r.logRatioVariance, expectedVar, 1e-12));
  assert(approx(r.maxAbsLogRatio, 3 * ln2, 1e-12));
});

test('halfWidthLogRatioVariance: clrVariance for K=4 geometric', () => {
  // logH = [0, ln2, 2ln2, 3ln2]; mean = 1.5 ln2;
  // clr = [-1.5, -0.5, 0.5, 1.5] * ln2
  // var = (2.25 + 0.25 + 0.25 + 2.25)/4 * (ln2)^2 = 5/4 * (ln2)^2 = 1.25 (ln2)^2
  const r = halfWidthLogRatioVariance([1, 2, 4, 8, 0, 0]);
  const ln2 = Math.log(2);
  const expectedClr = 1.25 * ln2 * ln2;
  assert(approx(r.clrVariance, expectedClr, 1e-12));
});

test('build: globalWidestLens null when no non-degenerate rows', () => {
  // Empty queue -> no rows.
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance([]);
  assert.equal(r.globalWidestLens, null);
  assert.equal(r.globalNarrowestLens, null);
});

test('halfWidthLogRatioVariance: zeros do not contaminate eligible-pair stats', () => {
  // h = [1, 2, 0, 0, 0, 0] -> K=2; pair = (log1-log2) = -ln2; var=0; max=ln2
  const r = halfWidthLogRatioVariance([1, 2, 0, 0, 0, 0]);
  assert.equal(r.positiveCount, 2);
  assert.equal(r.pairsCount, 1);
  assert(approx(r.logRatioMean, -Math.log(2), 1e-12));
  assert(approx(r.logRatioVariance, 0, 1e-12));
  assert(approx(r.maxAbsLogRatio, Math.log(2), 1e-12));
});

test('build: report.totalSources accounts for missing-lens drops', () => {
  // Synthetic queue with one source so all 6 lenses produce.
  const queue = ascending('alpha', 60);
  const r = buildSourceRowTokenSlopeCiHalfWidthLogRatioVariance(queue, {
    bootstraps: 200,
  });
  assert.equal(r.totalSources, r.sourcesWithAllLenses + r.droppedMissingLens);
});
