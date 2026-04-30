/**
 * Unit + integration tests for
 * source-row-token-slope-ci-precision-monotonicity-isotonic.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic,
  renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic,
  precisionMonotonicityIsotonic,
  pavIncreasing,
  pavDecreasing,
  countPlateaus,
  firstCrossoverIndex,
  SLOPE_PRECISION_MONOTONICITY_LENS_NAMES,
} from '../src/sourcerowtokenslopeciprecisionmonotonicityisotonic.js';
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

// --- pavIncreasing primitive ---

test('pavIncreasing: empty input → empty output', () => {
  assert.deepEqual(pavIncreasing([]), []);
});

test('pavIncreasing: already-monotone input is preserved', () => {
  assert.deepEqual(pavIncreasing([1, 2, 3, 4, 5]), [1, 2, 3, 4, 5]);
});

test('pavIncreasing: single point unchanged', () => {
  assert.deepEqual(pavIncreasing([7]), [7]);
});

test('pavIncreasing: constant input unchanged', () => {
  assert.deepEqual(pavIncreasing([3, 3, 3, 3]), [3, 3, 3, 3]);
});

test('pavIncreasing: strictly decreasing input collapses to single mean', () => {
  const out = pavIncreasing([5, 4, 3, 2, 1]);
  // All five pool into one block at mean 3.
  assert.deepEqual(out, [3, 3, 3, 3, 3]);
});

test('pavIncreasing: single violation pools two adjacent points', () => {
  // 1, 3, 2, 4 — the (3, 2) violates; pooled to mean 2.5.
  const out = pavIncreasing([1, 3, 2, 4]);
  assert.deepEqual(out, [1, 2.5, 2.5, 4]);
});

test('pavIncreasing: two violations cascade-merge', () => {
  // 1, 4, 2, 3, 5 — pooling (4,2)=3, then (3,3)=3, then (3,3)=3 not violated by 5.
  const out = pavIncreasing([1, 4, 2, 3, 5]);
  // Walk: [1] -> [1,4] -> push 2: violates 4>2, pool {4,2}=3, then 1<3 ok ->
  // [1, {3,3}], push 3: violates? mean of [3,3]=3, new=3, 3>3 false (uses
  // strict >); pop & merge → [1, {3,3,3,3}=3]; push 5 ok → [1, {3 x4}, 5].
  assert.equal(out.length, 5);
  assert.equal(out[0], 1);
  assert.equal(out[1], 3);
  assert.equal(out[2], 3);
  assert.equal(out[3], 3);
  assert.equal(out[4], 5);
});

test('pavIncreasing: output is non-decreasing', () => {
  const inputs = [
    [3, 1, 4, 1, 5, 9, 2, 6, 5, 3],
    [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    [-5, -10, 0, 5, -3, 7, -1],
  ];
  for (const ys of inputs) {
    const fit = pavIncreasing(ys);
    for (let i = 1; i < fit.length; i++) {
      assert.ok(
        fit[i]! >= fit[i - 1]!,
        `non-decreasing violated: fit[${i}]=${fit[i]} < fit[${i - 1}]=${fit[i - 1]}`,
      );
    }
  }
});

test('pavIncreasing: preserves total sum (mean is invariant)', () => {
  const inputs = [
    [3, 1, 4, 1, 5, 9, 2, 6],
    [10, 9, 8, 7, 6],
  ];
  for (const ys of inputs) {
    const fit = pavIncreasing(ys);
    const sumIn = ys.reduce((a, b) => a + b, 0);
    const sumOut = fit.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sumIn - sumOut) < 1e-9);
  }
});

// --- pavDecreasing primitive ---

test('pavDecreasing: strictly decreasing input is preserved', () => {
  assert.deepEqual(pavDecreasing([5, 4, 3, 2, 1]), [5, 4, 3, 2, 1]);
});

test('pavDecreasing: strictly increasing collapses to single mean', () => {
  const out = pavDecreasing([1, 2, 3, 4, 5]);
  assert.deepEqual(out, [3, 3, 3, 3, 3]);
});

test('pavDecreasing: output is non-increasing', () => {
  const fit = pavDecreasing([1, 5, 2, 4, 3]);
  for (let i = 1; i < fit.length; i++) {
    assert.ok(fit[i]! <= fit[i - 1]!);
  }
});

// --- countPlateaus / firstCrossoverIndex primitives ---

test('countPlateaus: empty → 0', () => {
  assert.equal(countPlateaus([]), 0);
});

test('countPlateaus: single → 1', () => {
  assert.equal(countPlateaus([5]), 1);
});

test('countPlateaus: all-equal → 1', () => {
  assert.equal(countPlateaus([3, 3, 3, 3]), 1);
});

test('countPlateaus: strictly distinct → length', () => {
  assert.equal(countPlateaus([1, 2, 3, 4, 5]), 5);
});

test('countPlateaus: typical PAV output', () => {
  assert.equal(countPlateaus([1, 3, 3, 3, 5]), 3);
});

test('firstCrossoverIndex: single plateau → -1', () => {
  assert.equal(firstCrossoverIndex([3, 3, 3]), -1);
});

test('firstCrossoverIndex: empty → -1', () => {
  assert.equal(firstCrossoverIndex([]), -1);
});

test('firstCrossoverIndex: first boundary at position 1', () => {
  assert.equal(firstCrossoverIndex([1, 2, 2, 2]), 1);
});

test('firstCrossoverIndex: boundary mid-sequence', () => {
  assert.equal(firstCrossoverIndex([3, 3, 3, 5]), 3);
});

// --- precisionMonotonicityIsotonic helper ---

test('precisionMonotonicityIsotonic: rejects wrong-length widths', () => {
  assert.throws(() =>
    precisionMonotonicityIsotonic([1, 2, 3], [1, 2, 3, 4, 5, 6]),
  );
});

test('precisionMonotonicityIsotonic: rejects wrong-length mids', () => {
  assert.throws(() =>
    precisionMonotonicityIsotonic([1, 2, 3, 4, 5, 6], [1, 2, 3]),
  );
});

test('precisionMonotonicityIsotonic: rejects negative widths', () => {
  assert.throws(() =>
    precisionMonotonicityIsotonic([1, -1, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]),
  );
});

test('precisionMonotonicityIsotonic: rejects non-finite widths', () => {
  assert.throws(() =>
    precisionMonotonicityIsotonic([1, Infinity, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]),
  );
});

test('precisionMonotonicityIsotonic: rejects non-finite mids', () => {
  assert.throws(() =>
    precisionMonotonicityIsotonic([1, 2, 3, 4, 5, 6], [1, NaN, 3, 4, 5, 6]),
  );
});

test('precisionMonotonicityIsotonic: identical mids → score=1, direction=increasing', () => {
  const out = precisionMonotonicityIsotonic([1, 2, 3, 4, 5, 6], [7, 7, 7, 7, 7, 7]);
  assert.equal(out.tssMid, 0);
  assert.equal(out.sseInc, 0);
  assert.equal(out.sseDec, 0);
  assert.equal(out.monotonicityScore, 1);
  assert.equal(out.direction, 'increasing');
  assert.equal(out.flatRunCount, 1);
  assert.equal(out.crossoverIndex, -1);
});

test('precisionMonotonicityIsotonic: identical widths → canonical-order width sort', () => {
  const out = precisionMonotonicityIsotonic(
    [5, 5, 5, 5, 5, 5],
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(out.widthOrder, [...SLOPE_PRECISION_MONOTONICITY_LENS_NAMES]);
  assert.equal(out.widthSpan, 0);
});

test('precisionMonotonicityIsotonic: increasing mids in width order → score=1, increasing', () => {
  // widths sorted ascending = [1,2,3,4,5,6]; mids parallel = [10,20,30,40,50,60].
  const out = precisionMonotonicityIsotonic(
    [1, 2, 3, 4, 5, 6],
    [10, 20, 30, 40, 50, 60],
  );
  assert.equal(out.direction, 'increasing');
  assert.equal(out.sseInc, 0);
  assert.ok(out.sseDec > 0);
  assert.equal(out.monotonicityScore, 1);
  assert.equal(out.flatRunCount, 6);
  assert.equal(out.crossoverIndex, 1);
});

test('precisionMonotonicityIsotonic: decreasing mids in width order → score=1, decreasing', () => {
  const out = precisionMonotonicityIsotonic(
    [1, 2, 3, 4, 5, 6],
    [60, 50, 40, 30, 20, 10],
  );
  assert.equal(out.direction, 'decreasing');
  assert.equal(out.sseDec, 0);
  assert.ok(out.sseInc > 0);
  assert.equal(out.monotonicityScore, 1);
});

test('precisionMonotonicityIsotonic: tie-break favours increasing when sseInc==sseDec', () => {
  const out = precisionMonotonicityIsotonic(
    [1, 2, 3, 4, 5, 6],
    [3, 3, 3, 3, 3, 3],
  );
  assert.equal(out.direction, 'increasing');
});

test('precisionMonotonicityIsotonic: width-sort permutes mids correctly', () => {
  // Canonical lens order has bootstrap at idx 0; assign it the LARGEST width.
  // After width-sort, bootstrap should land at position 5.
  const widths = [100, 1, 2, 3, 4, 5];
  const mids = [99, 1, 2, 3, 4, 5];
  const out = precisionMonotonicityIsotonic(widths, mids);
  assert.equal(out.narrowestLens, 'jackknife'); // idx 1 had width 1
  assert.equal(out.widestLens, 'bootstrap'); // idx 0 had width 100
  assert.equal(out.widthSpan, 99);
  assert.equal(out.narrowestMid, 1);
  assert.equal(out.widestMid, 99);
});

test('precisionMonotonicityIsotonic: monotonicityScore in [0,1]', () => {
  const cases: Array<[number[], number[]]> = [
    [[1, 2, 3, 4, 5, 6], [10, 5, 8, 2, 9, 1]],
    [[1, 1, 1, 1, 1, 1], [-3, 7, -1, 0, 5, -2]],
    [[5, 4, 3, 2, 1, 0.5], [100, 200, 300, 400, 500, 600]],
  ];
  for (const [w, m] of cases) {
    const out = precisionMonotonicityIsotonic(w, m);
    assert.ok(out.monotonicityScore >= 0);
    assert.ok(out.monotonicityScore <= 1);
  }
});

test('precisionMonotonicityIsotonic: random anti-monotone selects decreasing', () => {
  // mids strictly decreasing in width-sorted order
  const out = precisionMonotonicityIsotonic(
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    [600, 500, 400, 300, 200, 100],
  );
  assert.equal(out.direction, 'decreasing');
  assert.equal(out.monotonicityScore, 1);
  assert.equal(out.monotoneFlag, true);
});

test('precisionMonotonicityIsotonic: SLOPE_PRECISION_MONOTONICITY_LENS_NAMES has 6 names', () => {
  assert.equal(SLOPE_PRECISION_MONOTONICITY_LENS_NAMES.length, 6);
  assert.equal(SLOPE_PRECISION_MONOTONICITY_LENS_NAMES[0], 'bootstrap');
  assert.equal(
    SLOPE_PRECISION_MONOTONICITY_LENS_NAMES[5],
    'profileLikelihood',
  );
});

// --- builder guards ---

test('builder: rejects minRows below 4', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], { minRows: 3 }),
    /minRows/,
  );
});

test('builder: rejects non-integer minRows', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], {
        minRows: 4.5,
      }),
    /minRows/,
  );
});

test('builder: rejects confidence outside (0,1)', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], {
        confidence: 0,
      }),
    /confidence/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], {
        confidence: 1,
      }),
    /confidence/,
  );
});

test('builder: rejects non-positive lambda', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], { lambda: 0 }),
    /lambda/,
  );
});

test('builder: rejects bootstraps below 100', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], {
        bootstraps: 50,
      }),
    /bootstraps/,
  );
});

test('builder: rejects non-integer seed', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], { seed: 1.5 }),
    /seed/,
  );
});

test('builder: rejects alertMonotone <= 0', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], {
        alertMonotone: 0,
      }),
    /alertMonotone/,
  );
});

test('builder: rejects alertMonotone >= 1', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], {
        alertMonotone: 1,
      }),
    /alertMonotone/,
  );
});

test('builder: rejects top < 1', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], { top: 0 }),
    /top/,
  );
});

test('builder: rejects unknown sort', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], {
        sort: 'bogus' as any,
      }),
    /sort/,
  );
});

test('builder: empty queue → empty rows, zero aggregates', () => {
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], {
    bootstraps: 100,
    seed: 1,
    generatedAt: 'gen',
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.rows.length, 0);
  assert.equal(r.meanMonotonicityScore, 0);
  assert.equal(r.medianMonotonicityScore, 0);
  assert.equal(r.nMonotone, 0);
  assert.equal(r.nIncreasing, 0);
  assert.equal(r.nDecreasing, 0);
  assert.equal(r.globalDirection, null);
  assert.equal(r.globalNarrowestLens, null);
  assert.equal(r.globalWidestLens, null);
});

test('builder: ascending series produces a valid report row', () => {
  const queue = ascending('s1', 60);
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: 'gen',
  });
  assert.equal(r.sourcesWithAllLenses, 1);
  assert.equal(r.rows.length, 1);
  const row = r.rows[0]!;
  assert.equal(row.source, 's1');
  assert.equal(row.rowsKept, 60);
  assert.equal(row.widthOrder.length, 6);
  assert.equal(row.widths.length, 6);
  assert.equal(row.mids.length, 6);
  assert.ok(row.tssMid >= 0);
  assert.ok(row.sseChosen >= 0);
  assert.ok(row.monotonicityScore >= 0 && row.monotonicityScore <= 1);
  assert.ok(['increasing', 'decreasing'].includes(row.direction));
});

test('builder: passes generatedAt through verbatim', () => {
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], {
    bootstraps: 100,
    seed: 1,
    generatedAt: 'fixed-stamp',
  });
  assert.equal(r.generatedAt, 'fixed-stamp');
});

test('builder: alertMonotone=0.5 only retains high-monotonicity sources', () => {
  const queue = ascending('s1', 80);
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    alertMonotone: 0.5,
    generatedAt: 'gen',
  });
  for (const row of r.rows) {
    assert.ok(row.monotonicityScore > 0.5);
  }
});

test('builder: alertFlat only retains single-plateau sources', () => {
  const queue = ascending('s1', 80);
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    alertFlat: true,
    generatedAt: 'gen',
  });
  for (const row of r.rows) {
    assert.equal(row.flatRunCount, 1);
  }
});

test('builder: top=1 caps output to a single row', () => {
  const queue = [
    ...ascending('s1', 60),
    ...ascending('s2', 60, 5),
    ...ascending('s3', 60, 20),
  ];
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    top: 1,
    generatedAt: 'gen',
  });
  assert.ok(r.rows.length <= 1);
});

test('builder: sort=source orders alphabetically', () => {
  const queue = [
    ...ascending('charlie', 60),
    ...ascending('alpha', 60, 5),
    ...ascending('bravo', 60, 20),
  ];
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    sort: 'source',
    generatedAt: 'gen',
  });
  const names = r.rows.map((row) => row.source);
  const sorted = [...names].sort();
  assert.deepEqual(names, sorted);
});

test('builder: sort=monotonicity-asc orders ascending', () => {
  const queue = [
    ...ascending('s1', 60),
    ...ascending('s2', 80, 5),
    ...ascending('s3', 100, 20),
  ];
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    sort: 'monotonicity-asc',
    generatedAt: 'gen',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(
      r.rows[i - 1]!.monotonicityScore <= r.rows[i]!.monotonicityScore,
    );
  }
});

test('builder: sort=flat-run-asc orders by flatRunCount ascending', () => {
  const queue = [
    ...ascending('s1', 60),
    ...ascending('s2', 80, 5),
  ];
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    sort: 'flat-run-asc',
    generatedAt: 'gen',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.flatRunCount <= r.rows[i]!.flatRunCount);
  }
});

test('builder: sort=width-span-desc orders by widthSpan descending', () => {
  const queue = [
    ...ascending('s1', 60),
    ...ascending('s2', 80, 5),
  ];
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    sort: 'width-span-desc',
    generatedAt: 'gen',
  });
  for (let i = 1; i < r.rows.length; i++) {
    assert.ok(r.rows[i - 1]!.widthSpan >= r.rows[i]!.widthSpan);
  }
});

test('builder: nMonotone, nIncreasing, nDecreasing are non-negative integers', () => {
  const queue = ascending('s1', 60);
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: 'gen',
  });
  assert.ok(Number.isInteger(r.nMonotone));
  assert.ok(Number.isInteger(r.nIncreasing));
  assert.ok(Number.isInteger(r.nDecreasing));
  assert.ok(r.nMonotone >= 0);
  assert.ok(r.nIncreasing >= 0);
  assert.ok(r.nDecreasing >= 0);
  assert.equal(r.nIncreasing + r.nDecreasing, r.rows.length);
});

test('builder: meanMonotonicityScore is in [0, 1] when rows exist', () => {
  const queue = ascending('s1', 60);
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: 'gen',
  });
  if (r.rows.length > 0) {
    assert.ok(r.meanMonotonicityScore >= 0);
    assert.ok(r.meanMonotonicityScore <= 1);
  }
});

test('builder: source filter restricts to single source', () => {
  const queue = [...ascending('s1', 60), ...ascending('s2', 60)];
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    source: 's1',
    generatedAt: 'gen',
  });
  for (const row of r.rows) assert.equal(row.source, 's1');
});

test('builder: globalDirection is one of the canonical directions', () => {
  const queue = ascending('s1', 60);
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: 'gen',
  });
  if (r.globalDirection !== null) {
    assert.ok(['increasing', 'decreasing'].includes(r.globalDirection));
  }
});

// --- renderer ---

test('render: empty report shows "(no sources)"', () => {
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], {
    bootstraps: 100,
    seed: 1,
    generatedAt: 'gen',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(r);
  assert.match(out, /no sources/);
});

test('render: includes header line with command name', () => {
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], {
    bootstraps: 100,
    seed: 1,
    generatedAt: 'gen',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(r);
  assert.match(
    out,
    /pew-insights source-row-token-slope-ci-precision-monotonicity-isotonic/,
  );
});

test('render: includes meta line with all knobs', () => {
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], {
    bootstraps: 100,
    seed: 7,
    generatedAt: 'fixed',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(r);
  assert.match(out, /as of: fixed/);
  assert.match(out, /min-rows: 4/);
  assert.match(out, /confidence: 0\.95/);
  assert.match(out, /seed: 7/);
});

test('render: with rows includes table headers', () => {
  const queue = ascending('s1', 60);
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: 'gen',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(r);
  assert.match(out, /source\s+rows\s+narrowLens/);
  assert.match(out, /widestLens/);
  assert.match(out, /direction/);
});

test('render: showSummary=true appends per-source summary lines', () => {
  const queue = ascending('s1', 60);
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: 'gen',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(r, {
    showSummary: true,
  });
  assert.match(out, /summary:/);
});

test('render: showSummary=false omits summary lines', () => {
  const queue = ascending('s1', 60);
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: 'gen',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(r);
  assert.equal(/summary:/.test(out), false);
});

test('render: showMonotoneAggregate=true appends aggregate line when rows present', () => {
  const queue = ascending('s1', 60);
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: 'gen',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(r, {
    showMonotoneAggregate: true,
  });
  if (r.rows.length > 0) {
    assert.match(out, /\[monotone aggregate\]/);
    assert.match(out, /sources crossed monotonicityScore>=0\.95/);
  }
});

test('render: showMonotoneAggregate omitted on empty report', () => {
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], {
    bootstraps: 100,
    seed: 1,
    generatedAt: 'gen',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(r, {
    showMonotoneAggregate: true,
  });
  assert.equal(/\[monotone aggregate\]/.test(out), false);
});

test('render: showMonotoneAggregate composes with showSummary', () => {
  const queue = ascending('s1', 60);
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: 'gen',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(r, {
    showSummary: true,
    showMonotoneAggregate: true,
  });
  if (r.rows.length > 0) {
    assert.match(out, /summary:/);
    assert.match(out, /\[monotone aggregate\]/);
  }
});

test('render: showDirectionAggregate=true appends direction-split aggregate when rows present', () => {
  const queue = ascending('s1', 60);
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: 'gen',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(r, {
    showDirectionAggregate: true,
  });
  if (r.rows.length > 0) {
    assert.match(out, /\[direction aggregate\]/);
    assert.match(out, /increasing=/);
    assert.match(out, /decreasing=/);
    assert.match(out, /meanScore=/);
  }
});

test('render: showDirectionAggregate omitted on empty report', () => {
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic([], {
    bootstraps: 100,
    seed: 1,
    generatedAt: 'gen',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(r, {
    showDirectionAggregate: true,
  });
  assert.equal(/\[direction aggregate\]/.test(out), false);
});

test('render: showDirectionAggregate composes with showMonotoneAggregate', () => {
  const queue = ascending('s1', 60);
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: 'gen',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(r, {
    showMonotoneAggregate: true,
    showDirectionAggregate: true,
  });
  if (r.rows.length > 0) {
    assert.match(out, /\[monotone aggregate\]/);
    assert.match(out, /\[direction aggregate\]/);
  }
});

test('render: showDirectionAggregate composes with showSummary', () => {
  const queue = ascending('s1', 60);
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: 'gen',
  });
  const out = renderSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(r, {
    showSummary: true,
    showDirectionAggregate: true,
  });
  if (r.rows.length > 0) {
    assert.match(out, /summary:/);
    assert.match(out, /\[direction aggregate\]/);
  }
});

test('render: showDirectionAggregate fractions sum to 1.0 across direction split', () => {
  const queue = [
    ...ascending('s1', 60),
    ...ascending('s2', 80, 5),
    ...ascending('s3', 100, 20),
  ];
  const r = buildSourceRowTokenSlopeCiPrecisionMonotonicityIsotonic(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: 'gen',
  });
  if (r.rows.length > 0) {
    assert.equal(r.nIncreasing + r.nDecreasing, r.rows.length);
  }
});
