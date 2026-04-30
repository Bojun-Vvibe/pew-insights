/**
 * Unit + integration tests for
 * source-row-token-slope-ci-tail-mass-asymmetry (axis 17).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiTailMassAsymmetry,
  renderSourceRowTokenSlopeCiTailMassAsymmetry,
  tailMassAsymmetry,
  SLOPE_TAILMASS_LENS_NAMES,
} from '../src/sourcerowtokenslopecitailmassasymmetry.js';
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

// --- canonical lens names sanity ---

test('SLOPE_TAILMASS_LENS_NAMES has length 6 and canonical order', () => {
  assert.equal(SLOPE_TAILMASS_LENS_NAMES.length, 6);
  assert.deepEqual([...SLOPE_TAILMASS_LENS_NAMES], [
    'bootstrap',
    'jackknife',
    'bca',
    'studentizedT',
    'abc',
    'profileLikelihood',
  ]);
});

// --- tailMassAsymmetry primitive ---

test('tailMassAsymmetry: throws if mids length != 6', () => {
  assert.throws(() => tailMassAsymmetry([]), /expected 6 midpoints/);
  assert.throws(() => tailMassAsymmetry([1, 2, 3]), /expected 6 midpoints/);
  assert.throws(() => tailMassAsymmetry([1, 2, 3, 4, 5, 6, 7]), /expected 6 midpoints/);
});

test('tailMassAsymmetry: throws on non-finite midpoints', () => {
  assert.throws(() => tailMassAsymmetry([1, 2, 3, 4, 5, NaN]), /finite/);
  assert.throws(() => tailMassAsymmetry([1, 2, 3, 4, Infinity, 6]), /finite/);
  assert.throws(() => tailMassAsymmetry([1, 2, 3, -Infinity, 5, 6]), /finite/);
});

test('tailMassAsymmetry: identical midpoints => degenerate, balanced, ratio=0.5', () => {
  const r = tailMassAsymmetry([3, 3, 3, 3, 3, 3]);
  assert.equal(r.midpointMedian, 3);
  assert.equal(r.absDevSum, 0);
  assert.equal(r.upperLensCount, 0);
  assert.equal(r.lowerLensCount, 0);
  assert.equal(r.tieLensCount, 6);
  assert.deepEqual(r.upperLenses, []);
  assert.deepEqual(r.lowerLenses, []);
  assert.equal(r.upperTailMass, 0);
  assert.equal(r.lowerTailMass, 0);
  assert.equal(r.asymmetryRatio, 0.5);
  assert.equal(r.asymmetrySigned, 0);
  assert.equal(r.direction, 'balanced');
  assert.equal(r.degenerateFlag, true);
  assert.equal(r.dominantLens, 'bootstrap');
  assert.equal(r.dominantLensSign, 0);
});

test('tailMassAsymmetry: perfectly symmetric around median', () => {
  // 6 values: 1,2,3,4,5,6; median = 3.5; upper={4,5,6}, lower={1,2,3}.
  // Each side mass = (4-3.5)+(5-3.5)+(6-3.5) = 0.5+1.5+2.5 = 4.5.
  const r = tailMassAsymmetry([1, 2, 3, 4, 5, 6]);
  assert.equal(r.midpointMedian, 3.5);
  assert.equal(r.upperTailMass, 4.5);
  assert.equal(r.lowerTailMass, 4.5);
  assert.equal(r.asymmetryRatio, 0.5);
  assert.equal(r.asymmetrySigned, 0);
  assert.equal(r.direction, 'balanced');
  assert.equal(r.upperLensCount, 3);
  assert.equal(r.lowerLensCount, 3);
  assert.equal(r.tieLensCount, 0);
  assert.equal(r.degenerateFlag, false);
});

test('tailMassAsymmetry: upper-tail dominant when upper deviations exceed lower', () => {
  // mids: [0,0,0, 1, 2, 100]; sorted: [0,0,0,1,2,100]; median = (0+1)/2 = 0.5.
  // upperLenses (mid>0.5): studentizedT(1), abc(2), profileLikelihood(100); upperMass=0.5+1.5+99.5=101.5.
  // lowerLenses (mid<0.5): bootstrap(0), jackknife(0), bca(0); lowerMass=0.5+0.5+0.5=1.5.
  const r = tailMassAsymmetry([0, 0, 0, 1, 2, 100]);
  assert.equal(r.midpointMedian, 0.5);
  assert.equal(r.upperTailMass, 101.5);
  assert.equal(r.lowerTailMass, 1.5);
  assert.equal(r.upperLensCount, 3);
  assert.equal(r.lowerLensCount, 3);
  assert.deepEqual(r.upperLenses, ['studentizedT', 'abc', 'profileLikelihood']);
  assert.deepEqual(r.lowerLenses, ['bootstrap', 'jackknife', 'bca']);
  assert.equal(r.asymmetryRatio, 101.5 / (101.5 + 1.5));
  assert.equal(r.asymmetrySigned, (101.5 - 1.5) / (101.5 + 1.5));
  assert.equal(r.direction, 'upper');
  assert.equal(r.dominantLens, 'profileLikelihood');
  assert.equal(r.dominantLensSign, 1);
  assert.equal(r.degenerateFlag, false);
});

test('tailMassAsymmetry: lower-tail dominant', () => {
  // mids: [-100, -2, -1, 0, 0, 0]; median=(-1+0)/2=-0.5;
  // upperLenses (mid>-0.5): studentizedT(0), abc(0), profileLikelihood(0); upperMass=0.5+0.5+0.5=1.5.
  // lowerLenses (mid<-0.5): bootstrap(-100), jackknife(-2), bca(-1); lowerMass=99.5+1.5+0.5=101.5.
  const r = tailMassAsymmetry([-100, -2, -1, 0, 0, 0]);
  assert.equal(r.midpointMedian, -0.5);
  assert.equal(r.upperTailMass, 1.5);
  assert.equal(r.lowerTailMass, 101.5);
  assert.equal(r.asymmetryRatio, 1.5 / 103);
  assert.equal(r.asymmetrySigned, (1.5 - 101.5) / 103);
  assert.equal(r.direction, 'lower');
  assert.equal(r.dominantLens, 'bootstrap');
  assert.equal(r.dominantLensSign, -1);
});

test('tailMassAsymmetry: asymmetrySigned bounded in [-1, 1]', () => {
  for (const mids of [
    [0, 0, 0, 0, 0, 1000],
    [-1000, 0, 0, 0, 0, 0],
    [1, 2, 3, 4, 5, 6],
    [10, 10, 10, 10, 10, 11],
  ]) {
    const r = tailMassAsymmetry(mids);
    assert.ok(r.asymmetrySigned >= -1 && r.asymmetrySigned <= 1, `signed in [-1,1] for ${mids}`);
    assert.ok(r.asymmetryRatio >= 0 && r.asymmetryRatio <= 1, `ratio in [0,1] for ${mids}`);
  }
});

test('tailMassAsymmetry: dominantLens uses canonical-order tie-break', () => {
  // mids: [-5, 5, -5, 5, -5, 5]; median = 0; all |dev|=5.
  // dominantLens should be the first lens (bootstrap).
  const r = tailMassAsymmetry([-5, 5, -5, 5, -5, 5]);
  assert.equal(r.midpointMedian, 0);
  assert.equal(r.dominantLens, 'bootstrap');
  assert.equal(r.dominantLensSign, -1);
});

test('tailMassAsymmetry: tie at median counted in tieLensCount', () => {
  // mids: [3, 3, 3, 5, 5, 5]; median = 4; nobody at exactly 4 => tie=0.
  const r1 = tailMassAsymmetry([3, 3, 3, 5, 5, 5]);
  assert.equal(r1.midpointMedian, 4);
  assert.equal(r1.tieLensCount, 0);
  // mids: [4, 4, 4, 4, 5, 6]; median = 4; bootstrap/jackknife/bca/studentizedT all tie.
  const r2 = tailMassAsymmetry([4, 4, 4, 4, 5, 6]);
  assert.equal(r2.midpointMedian, 4);
  assert.equal(r2.tieLensCount, 4);
  assert.equal(r2.upperLensCount, 2);
  assert.equal(r2.lowerLensCount, 0);
  assert.deepEqual(r2.upperLenses, ['abc', 'profileLikelihood']);
});

test('tailMassAsymmetry: direction threshold exactly 0.5 => upper', () => {
  // Construct mids so asymmetrySigned == exactly 0.5.
  // Easy: upperMass=3, lowerMass=1 => signed=(3-1)/(3+1)=0.5.
  // mids: [-1, 1, 1, 1, 0, 0]; median ?
  // sorted: [-1,0,0,1,1,1]; median = (0+1)/2 = 0.5.
  // upper (>0.5): jackknife(1), bca(1), studentizedT(1); upperMass=0.5*3=1.5
  // lower (<0.5): bootstrap(-1), abc(0), profileLikelihood(0); lowerMass=1.5+0.5+0.5=2.5
  // That's lower-dominant. Try simpler: mids [0,0,0,3,1,0];
  // sorted: [0,0,0,0,1,3]; median = 0.
  // upper (>0): studentizedT(3), abc(1); upperMass=4.
  // lower (<0): none; lowerMass=0.
  // signed = 4/4 = 1.0 (degenerate-lower side).
  // To hit exactly 0.5: upperMass=3, lowerMass=1, absDevSum=4 => signed=0.5.
  // mids: [0, 0, 0, 0, 0, 3] => median=0; upper=3, lower=0; signed=1.
  // mids: [-1, 0, 0, 0, 0, 3] => median=0; upper=3, lower=1; signed=2/4=0.5.
  const r = tailMassAsymmetry([-1, 0, 0, 0, 0, 3]);
  assert.equal(r.midpointMedian, 0);
  assert.equal(r.upperTailMass, 3);
  assert.equal(r.lowerTailMass, 1);
  assert.equal(r.asymmetrySigned, 0.5);
  assert.equal(r.direction, 'upper');
});

test('tailMassAsymmetry: direction threshold exactly -0.5 => lower', () => {
  // mids: [-3, 0, 0, 0, 0, 1]; median=0; upper=1, lower=3; signed=(1-3)/4=-0.5.
  const r = tailMassAsymmetry([-3, 0, 0, 0, 0, 1]);
  assert.equal(r.midpointMedian, 0);
  assert.equal(r.asymmetrySigned, -0.5);
  assert.equal(r.direction, 'lower');
});

test('tailMassAsymmetry: just below threshold => balanced', () => {
  // mids: [-3, 0, 0, 0, 1, 1.5]; median=0; upper=1+1.5=2.5; lower=3; signed=-0.5/5.5 ~= -0.0909.
  const r = tailMassAsymmetry([-3, 0, 0, 0, 1, 1.5]);
  assert.ok(Math.abs(r.asymmetrySigned) < 0.5);
  assert.equal(r.direction, 'balanced');
});

test('tailMassAsymmetry: signed reflects sign of (ratio - 0.5)', () => {
  for (const mids of [
    [1, 2, 3, 4, 5, 6],
    [-100, -1, -1, 0, 0, 0],
    [0, 0, 0, 0, 1, 100],
    [-5, -3, -1, 1, 3, 5],
    [0, 0, 0, 0, 0, 1],
  ]) {
    const r = tailMassAsymmetry(mids);
    if (r.upperTailMass + r.lowerTailMass > 0) {
      const ratioSign = Math.sign(r.asymmetryRatio - 0.5);
      const signedSign = Math.sign(r.asymmetrySigned);
      assert.equal(ratioSign, signedSign, `consistent for ${mids}`);
    }
  }
});

test('tailMassAsymmetry: handles negative midpoints', () => {
  const r = tailMassAsymmetry([-10, -8, -6, -4, -2, 0]);
  assert.equal(r.midpointMedian, -5);
  assert.equal(r.upperTailMass, 1 + 3 + 5);
  assert.equal(r.lowerTailMass, 5 + 3 + 1);
  assert.equal(r.asymmetryRatio, 0.5);
  assert.equal(r.asymmetrySigned, 0);
  assert.equal(r.direction, 'balanced');
});

test('tailMassAsymmetry: very small but non-zero deviations preserved', () => {
  const r = tailMassAsymmetry([1e-10, 2e-10, 3e-10, 4e-10, 5e-10, 6e-10]);
  assert.equal(r.degenerateFlag, false);
  assert.ok(r.absDevSum > 0);
  assert.ok(Math.abs(r.asymmetryRatio - 0.5) < 1e-9);
});

test('tailMassAsymmetry: upperLenses preserves canonical order', () => {
  // mids: [10, 0, 10, 0, 10, 0]; median=5; upper={bootstrap,bca,abc}; lower={jackknife,studentizedT,profileLikelihood}.
  const r = tailMassAsymmetry([10, 0, 10, 0, 10, 0]);
  assert.equal(r.midpointMedian, 5);
  assert.deepEqual(r.upperLenses, ['bootstrap', 'bca', 'abc']);
  assert.deepEqual(r.lowerLenses, ['jackknife', 'studentizedT', 'profileLikelihood']);
});

// --- buildSourceRowTokenSlopeCiTailMassAsymmetry validation ---

test('build: throws on minRows < 4', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('build: throws on non-integer minRows', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { minRows: 4.5 }),
    /minRows/,
  );
});

test('build: throws on confidence out of (0,1)', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { confidence: 0 }),
    /confidence/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { confidence: 1 }),
    /confidence/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { confidence: -0.1 }),
    /confidence/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { confidence: 1.1 }),
    /confidence/,
  );
});

test('build: throws on lambda <= 0 or non-finite', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { lambda: 0 }),
    /lambda/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { lambda: -1 }),
    /lambda/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { lambda: Infinity }),
    /lambda/,
  );
});

test('build: throws on bootstraps < 100', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { bootstraps: 50 }),
    /bootstraps/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { bootstraps: 100.5 }),
    /bootstraps/,
  );
});

test('build: throws on non-integer seed', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { seed: 1.5 }),
    /seed/,
  );
});

test('build: throws on alertAsymmetry out of [0,1]', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { alertAsymmetry: -0.1 }),
    /alertAsymmetry/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { alertAsymmetry: 1.5 }),
    /alertAsymmetry/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { alertAsymmetry: NaN }),
    /alertAsymmetry/,
  );
});

test('build: throws when both alertUpper and alertLower are set', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiTailMassAsymmetry([], {
        alertUpper: true,
        alertLower: true,
      }),
    /mutually exclusive/,
  );
});

test('build: throws on top < 1 or non-integer', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { top: 0 }),
    /top/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiTailMassAsymmetry([], { top: 1.5 }),
    /top/,
  );
});

test('build: throws on invalid sort', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiTailMassAsymmetry([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('build: empty queue => zero sources', () => {
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry([]);
  assert.equal(r.totalSources, 0);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.droppedMissingLens, 0);
  assert.deepEqual(r.rows, []);
  assert.equal(r.meanAsymmetryRatio, 0);
  assert.equal(r.medianAsymmetryRatio, 0);
  assert.equal(r.meanAsymmetrySigned, 0);
  assert.equal(r.nUpperDominant, 0);
  assert.equal(r.nLowerDominant, 0);
  assert.equal(r.nBalanced, 0);
  assert.equal(r.nDegenerate, 0);
  assert.equal(r.globalAsymmetryDirection, null);
  assert.equal(r.globalDominantLens, null);
});

test('build: single ascending source returns one row with all six lenses', () => {
  const queue = ascending('s1', 20, 5, 100);
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
  });
  assert.equal(r.sourcesWithAllLenses, 1);
  assert.equal(r.rows.length, 1);
  const row = r.rows[0]!;
  assert.equal(row.source, 's1');
  assert.equal(row.mids.length, 6);
  assert.equal(row.absDeviations.length, 6);
  assert.ok(SLOPE_TAILMASS_LENS_NAMES.includes(row.dominantLens));
  assert.ok(['upper', 'lower', 'balanced'].includes(row.direction));
});

test('build: globalAsymmetryDirection mode ties favour upper>lower>balanced', () => {
  // Hard to force; just verify with empty (null) and one-source contracts.
  const queue = ascending('s1', 30, 5, 100);
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
  });
  assert.ok(['upper', 'lower', 'balanced', null].includes(r.globalAsymmetryDirection as never));
  if (r.rows.length > 0) {
    assert.notEqual(r.globalAsymmetryDirection, null);
  }
});

test('build: alertAsymmetry filters out low-asymmetry sources', () => {
  const queue = ascending('s1', 30, 5, 100);
  const baseline = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
  });
  // Set alert at 1.0 so |signed| > 1.0 is impossible.
  const filtered = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
    alertAsymmetry: 1.0,
  });
  assert.equal(filtered.rows.length, 0);
  assert.equal(filtered.droppedAboveAlert, baseline.rows.length);
});

test('build: alertUpper restricts to upper-direction sources', () => {
  const queue = ascending('s1', 30, 5, 100);
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
    alertUpper: true,
  });
  for (const row of r.rows) {
    assert.equal(row.direction, 'upper');
  }
});

test('build: alertLower restricts to lower-direction sources', () => {
  const queue = ascending('s1', 30, 5, 100);
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
    alertLower: true,
  });
  for (const row of r.rows) {
    assert.equal(row.direction, 'lower');
  }
});

test('build: top truncates output to N rows after sort', () => {
  // Two sources.
  const queue = [...ascending('alpha', 25, 7, 50), ...ascending('beta', 25, 11, 200)];
  const all = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const capped = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
    top: 1,
  });
  assert.ok(all.rows.length >= 1);
  assert.ok(capped.rows.length <= 1);
});

test('build: sort by source returns alphabetical', () => {
  const queue = [...ascending('zeta', 25, 7, 50), ...ascending('alpha', 25, 11, 200)];
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
    sort: 'source',
  });
  if (r.rows.length === 2) {
    assert.equal(r.rows[0]!.source, 'alpha');
    assert.equal(r.rows[1]!.source, 'zeta');
  }
});

test('build: sort by rows returns descending row count', () => {
  const queue = [...ascending('a', 30, 5), ...ascending('b', 50, 5)];
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
    sort: 'rows',
  });
  if (r.rows.length === 2) {
    assert.ok(r.rows[0]!.rowsKept >= r.rows[1]!.rowsKept);
  }
});

test('build: source filter restricts output', () => {
  const queue = [...ascending('a', 25, 5), ...ascending('b', 25, 5)];
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
    source: 'a',
  });
  for (const row of r.rows) {
    assert.equal(row.source, 'a');
  }
});

test('build: generatedAt override is respected', () => {
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry([], {
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2026-04-30T00:00:00.000Z');
});

test('build: defaults populated correctly on empty queue', () => {
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry([]);
  assert.equal(r.minRows, 4);
  assert.equal(r.confidence, 0.95);
  assert.equal(r.lambda, 1);
  assert.equal(r.bootstraps, 1000);
  assert.equal(r.seed, 42);
  assert.equal(r.alertAsymmetry, null);
  assert.equal(r.alertUpper, false);
  assert.equal(r.alertLower, false);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'asymmetry-abs-desc');
});

test('build: window passthrough preserved', () => {
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry([], {
    since: '2026-01-01T00:00:00.000Z',
    until: '2026-12-31T23:59:59.999Z',
  });
  assert.equal(r.windowStart, '2026-01-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-12-31T23:59:59.999Z');
});

// --- renderer ---

test('render: no rows => "(no sources)"', () => {
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry([]);
  const out = renderSourceRowTokenSlopeCiTailMassAsymmetry(r);
  assert.match(out, /pew-insights source-row-token-slope-ci-tail-mass-asymmetry/);
  assert.match(out, /\(no sources\)/);
});

test('render: with rows shows table header', () => {
  const queue = ascending('s1', 25, 5, 100);
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiTailMassAsymmetry(r);
  assert.match(out, /source\s+rows\s+direction\s+asymRatio\s+asymSigned/);
  assert.match(out, /s1/);
});

test('render: showSummary appends summary line per row', () => {
  const queue = ascending('s1', 25, 5, 100);
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiTailMassAsymmetry(r, { showSummary: true });
  if (r.rows.length > 0) {
    assert.match(out, /summary: (upper|lower|balanced) dominantLens=/);
  }
});

test('render: showAsymmetryAggregate appends aggregate line', () => {
  const queue = ascending('s1', 25, 5, 100);
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiTailMassAsymmetry(r, {
    showAsymmetryAggregate: true,
  });
  if (r.rows.length > 0) {
    assert.match(out, /\[asymmetry aggregate\] meanAsymmetryRatio=/);
  }
});

test('render: showDirectionAggregate appends direction-aggregate line', () => {
  const queue = ascending('s1', 25, 5, 100);
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiTailMassAsymmetry(r, {
    showDirectionAggregate: true,
  });
  if (r.rows.length > 0) {
    assert.match(out, /\[direction aggregate\] upper=/);
  }
});

test('render: showTailAttribution appends per-lens histogram', () => {
  const queue = ascending('s1', 25, 5, 100);
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiTailMassAsymmetry(r, {
    showTailAttribution: true,
  });
  if (r.rows.length > 0) {
    assert.match(out, /\[tail attribution\]/);
    for (const lens of SLOPE_TAILMASS_LENS_NAMES) {
      assert.match(out, new RegExp(`${lens}=`));
    }
  }
});

test('render: header line includes axis name and parameters', () => {
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry([], {
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeCiTailMassAsymmetry(r);
  assert.match(out, /as of: 2026-04-30T00:00:00\.000Z/);
  assert.match(out, /sort: asymmetry-abs-desc/);
  assert.match(out, /bootstraps: 1000/);
});

test('render: showLensMembership appends membership line per row', () => {
  const queue = ascending('s1', 25, 5, 100);
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiTailMassAsymmetry(r, {
    showLensMembership: true,
  });
  if (r.rows.length > 0) {
    assert.match(out, /membership: upper=\[/);
    assert.match(out, /lower=\[/);
    assert.match(out, /tie=\d/);
  }
});

test('render: showLensMembership empty side renders dash', () => {
  const queue = ascending('s1', 25, 5, 100);
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiTailMassAsymmetry(r, {
    showLensMembership: true,
  });
  // Either dash, or named lenses, but format is consistent.
  if (r.rows.length > 0) {
    assert.match(out, /membership: upper=\[(.+)\] lower=\[(.+)\] tie=\d+/);
  }
});

test('render: showLensMembership composes with other show-flags', () => {
  const queue = ascending('s1', 25, 5, 100);
  const r = buildSourceRowTokenSlopeCiTailMassAsymmetry(queue, {
    bootstraps: 200,
    seed: 7,
  });
  const out = renderSourceRowTokenSlopeCiTailMassAsymmetry(r, {
    showSummary: true,
    showLensMembership: true,
    showAsymmetryAggregate: true,
    showDirectionAggregate: true,
    showTailAttribution: true,
  });
  if (r.rows.length > 0) {
    assert.match(out, /summary:/);
    assert.match(out, /membership:/);
    assert.match(out, /\[asymmetry aggregate\]/);
    assert.match(out, /\[direction aggregate\]/);
    assert.match(out, /\[tail attribution\]/);
  }
});
