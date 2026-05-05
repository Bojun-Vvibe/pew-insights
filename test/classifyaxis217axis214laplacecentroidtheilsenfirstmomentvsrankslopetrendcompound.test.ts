import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound,
  summarizeAxis217Axis214LaplaceTheilSenReport,
  type LaplaceCentroidRowForTheilSenSlopeCompound,
  type TheilSenSlopeRowForLaplaceCentroidCompound,
} from '../src/classifyaxis217axis214laplacecentroidtheilsenfirstmomentvsrankslopetrendcompound.js';

function lap(
  source: string,
  lapZ: number,
  lapPValue: number,
  lapCBarNorm = 0,
): LaplaceCentroidRowForTheilSenSlopeCompound {
  return { source, lapZ, lapPValue, lapCBarNorm };
}

function ts(
  source: string,
  slope: number,
  ciLow: number,
  ciHigh: number,
): TheilSenSlopeRowForLaplaceCentroidCompound {
  return {
    source,
    theilSenSlope: slope,
    theilSenSlopeCiLow: ciLow,
    theilSenSlopeCiHigh: ciHigh,
  };
}

test('alpha must be in (0, 0.5]', () => {
  assert.throws(() =>
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      [],
      [],
      0,
    ),
  );
  assert.throws(() =>
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      [],
      [],
      0.6,
    ),
  );
  assert.throws(() =>
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      [],
      [],
      Number.NaN,
    ),
  );
});

test('alpha boundaries 0.001 and 0.5 accepted', () => {
  classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [],
    [],
    0.001,
  );
  classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [],
    [],
    0.5,
  );
});

test('default alpha = 0.05', () => {
  // a row with p=0.04 (decisive) + tight CI
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', 2.1, 0.04, 0.3)],
    [ts('a', 1.0, 0.5, 1.5)],
  );
  assert.equal(r.alpha, 0.05);
  assert.equal(r.rows[0]!.bucket, 'robust-up-trend');
});

test('rejects empty source string', () => {
  assert.throws(() =>
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      [lap('', 1, 0.5)],
      [],
    ),
  );
});

test('rejects non-finite lapZ', () => {
  assert.throws(() =>
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      [lap('a', Number.NaN, 0.5)],
      [],
    ),
  );
});

test('rejects lapPValue out of range', () => {
  assert.throws(() =>
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      [lap('a', 1, -0.1)],
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      [lap('a', 1, 1.5)],
      [],
    ),
  );
});

test('rejects lapCBarNorm out of [-1, 1]', () => {
  assert.throws(() =>
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      [lap('a', 1, 0.5, 1.5)],
      [],
    ),
  );
});

test('rejects duplicate sources', () => {
  assert.throws(() =>
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      [lap('a', 1, 0.5), lap('a', 1, 0.5)],
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      [],
      [ts('a', 1, 0.5, 1.5), ts('a', 1, 0.5, 1.5)],
    ),
  );
});

test('rejects ts row with CiLow > CiHigh', () => {
  assert.throws(() =>
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      [],
      [ts('a', 1, 1.5, 0.5)],
    ),
  );
});

test('rejects non-finite slope', () => {
  assert.throws(() =>
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      [],
      [ts('a', Number.NaN, 0, 1)],
    ),
  );
});

// ---- bucket coverage ----

test("bucket: robust-up-trend (both decisive, both up)", () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', 2.5, 0.012, 0.3)],
    [ts('a', 1.5, 0.5, 2.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'robust-up-trend');
  assert.equal(r.byJointDirectionQuadrant.robustUp, 1);
  assert.equal(r.bothDecisive, 1);
});

test("bucket: robust-down-trend (both decisive, both down)", () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', -2.5, 0.012, -0.3)],
    [ts('a', -1.5, -2.5, -0.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'robust-down-trend');
  assert.equal(r.byJointDirectionQuadrant.robustDown, 1);
});

test('bucket: direction-conflict (lap up, ts down)', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', 3.0, 0.001, 0.5)],
    [ts('a', -1.5, -2.5, -0.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'direction-conflict');
  assert.equal(r.byJointDirectionQuadrant.conflictLapUpTsDown, 1);
});

test('bucket: direction-conflict (lap down, ts up)', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', -3.0, 0.001, -0.5)],
    [ts('a', 1.5, 0.5, 2.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'direction-conflict');
  assert.equal(r.byJointDirectionQuadrant.conflictLapDownTsUp, 1);
});

test('bucket: mass-late-only (lap decisive up, ts not decisive)', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', 3.0, 0.001, 0.5)],
    [ts('a', 0.1, -0.5, 0.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'mass-late-only');
});

test('bucket: mass-early-only (lap decisive down, ts not decisive)', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', -3.0, 0.001, -0.5)],
    [ts('a', 0.1, -0.5, 0.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'mass-early-only');
});

test('bucket: rank-up-only (ts decisive up, lap not decisive)', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', 0.5, 0.6, 0.05)],
    [ts('a', 1.0, 0.5, 1.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'rank-up-only');
});

test('bucket: rank-down-only (ts decisive down, lap not decisive)', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', -0.5, 0.6, -0.05)],
    [ts('a', -1.0, -1.5, -0.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'rank-down-only');
});

test('bucket: no-evidence (neither decisive)', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', 0.5, 0.6, 0.05)],
    [ts('a', 0.1, -0.5, 0.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
});

// ---- decisiveness boundary ----

test('lap decisiveness: pValue exactly = alpha is NOT decisive (strict <)', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', 2.0, 0.05, 0.2)],
    [ts('a', 0.1, -0.5, 0.5)],
    0.05,
  );
  assert.equal(r.rows[0]!.lapDecisive, false);
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
});

test('ts CI containing 0 is NOT decisive', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', 0.5, 0.6, 0.05)],
    [ts('a', 0.5, -0.1, 1.1)],
  );
  assert.equal(r.rows[0]!.tsDecisive, false);
});

test('ts CI [0, +X] (CiLow exactly = 0) NOT decisive (strict >)', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', 0.5, 0.6, 0.05)],
    [ts('a', 0.5, 0, 1.0)],
  );
  assert.equal(r.rows[0]!.tsDecisive, false);
});

// ---- sets / sorting / aggregation invariants ----

test('sources-only-in-* sets', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', 1, 0.5), lap('b', 1, 0.5), lap('c', 1, 0.5)],
    [ts('b', 1, 0.5, 1.5), ts('c', 1, 0.5, 1.5), ts('d', 1, 0.5, 1.5)],
  );
  assert.deepEqual(r.sourcesOnlyInLaplace, ['a']);
  assert.deepEqual(r.sourcesOnlyInTheilSen, ['d']);
  assert.equal(r.rows.length, 2);
});

test('joined rows in lex source order', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('zebra', 1, 0.5), lap('alpha', 1, 0.5), lap('mu', 1, 0.5)],
    [ts('mu', 1, 0.5, 1.5), ts('alpha', 1, 0.5, 1.5), ts('zebra', 1, 0.5, 1.5)],
  );
  const sources = r.rows.map((row) => row.source);
  assert.deepEqual(sources, ['alpha', 'mu', 'zebra']);
});

test('row preserves all axis-217 and axis-214 fields', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', 2.5, 0.012, 0.3)],
    [ts('a', 1.5, 0.5, 2.5)],
  );
  const row = r.rows[0]!;
  assert.equal(row.lapZ, 2.5);
  assert.equal(row.lapPValue, 0.012);
  assert.equal(row.lapCBarNorm, 0.3);
  assert.equal(row.theilSenSlope, 1.5);
  assert.equal(row.theilSenSlopeCiLow, 0.5);
  assert.equal(row.theilSenSlopeCiHigh, 2.5);
  assert.equal(row.lapTrendUpSignal, 2.5);
  assert.equal(row.tsTrendUpSignal, 1.5);
});

test('bucketCounts sum equals rows.length', () => {
  const lapRows = [
    lap('a', 2.5, 0.001, 0.3),
    lap('b', -2.5, 0.001, -0.3),
    lap('c', 2.5, 0.001, 0.3),
    lap('d', 0.5, 0.6, 0.05),
    lap('e', 3.0, 0.001, 0.5),
    lap('f', -3.0, 0.001, -0.5),
  ];
  const tsRows = [
    ts('a', 1.5, 0.5, 2.5),
    ts('b', -1.5, -2.5, -0.5),
    ts('c', -1.5, -2.5, -0.5),
    ts('d', 0.1, -0.5, 0.5),
    ts('e', 0.1, -0.5, 0.5),
    ts('f', 0.1, -0.5, 0.5),
  ];
  const r =
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      lapRows,
      tsRows,
    );
  let sum = 0;
  for (const k of Object.keys(r.bucketCounts) as Array<
    keyof typeof r.bucketCounts
  >) {
    sum += r.bucketCounts[k];
  }
  assert.equal(sum, r.rows.length);
});

test('byJointDirectionQuadrant sum equals rows.length', () => {
  const lapRows = [
    lap('a', 2.5, 0.001, 0.3),
    lap('b', -2.5, 0.001, -0.3),
    lap('c', 2.5, 0.001, 0.3),
    lap('d', 0.5, 0.6, 0.05),
  ];
  const tsRows = [
    ts('a', 1.5, 0.5, 2.5),
    ts('b', -1.5, -2.5, -0.5),
    ts('c', -1.5, -2.5, -0.5),
    ts('d', 0.1, -0.5, 0.5),
  ];
  const r =
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      lapRows,
      tsRows,
    );
  const q = r.byJointDirectionQuadrant;
  const sum =
    q.robustUp +
    q.robustDown +
    q.conflictLapUpTsDown +
    q.conflictLapDownTsUp +
    q.anyMissingDecisive;
  assert.equal(sum, r.rows.length);
});

test('bothDecisive equals sum of (robust-up + robust-down + direction-conflict)', () => {
  const lapRows = [
    lap('a', 2.5, 0.001, 0.3),
    lap('b', -2.5, 0.001, -0.3),
    lap('c', 2.5, 0.001, 0.3),
    lap('d', 0.5, 0.6, 0.05),
    lap('e', -3.0, 0.001, -0.5),
  ];
  const tsRows = [
    ts('a', 1.5, 0.5, 2.5),
    ts('b', -1.5, -2.5, -0.5),
    ts('c', -1.5, -2.5, -0.5),
    ts('d', 0.1, -0.5, 0.5),
    ts('e', 1.5, 0.5, 2.5),
  ];
  const r =
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      lapRows,
      tsRows,
    );
  const sumDecisive =
    r.bucketCounts['robust-up-trend'] +
    r.bucketCounts['robust-down-trend'] +
    r.bucketCounts['direction-conflict'];
  assert.equal(sumDecisive, r.bothDecisive);
});

test('atLeastOneDecisive equals rows.length - no-evidence', () => {
  const lapRows = [
    lap('a', 2.5, 0.001, 0.3),
    lap('b', 0.5, 0.6, 0.05),
    lap('c', 0.5, 0.6, 0.05),
  ];
  const tsRows = [
    ts('a', 0.1, -0.5, 0.5),
    ts('b', 1.5, 0.5, 2.5),
    ts('c', 0.1, -0.5, 0.5),
  ];
  const r =
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      lapRows,
      tsRows,
    );
  assert.equal(r.atLeastOneDecisive, 3 - r.bucketCounts['no-evidence']);
});

test('all 8 buckets reachable in a single 8-source classification', () => {
  const lapRows = [
    lap('a', 2.5, 0.001, 0.3), // robust-up
    lap('b', -2.5, 0.001, -0.3), // robust-down
    lap('c', 2.5, 0.001, 0.3), // dir-conflict (lap up, ts down)
    lap('d', -2.5, 0.001, -0.3), // dir-conflict (lap down, ts up)
    lap('e', 2.5, 0.001, 0.3), // mass-late-only
    lap('f', -2.5, 0.001, -0.3), // mass-early-only
    lap('g', 0.5, 0.6, 0.05), // rank-up-only
    lap('h', 0.5, 0.6, 0.05), // no-evidence
  ];
  const tsRows = [
    ts('a', 1.5, 0.5, 2.5),
    ts('b', -1.5, -2.5, -0.5),
    ts('c', -1.5, -2.5, -0.5),
    ts('d', 1.5, 0.5, 2.5),
    ts('e', 0.1, -0.5, 0.5),
    ts('f', 0.1, -0.5, 0.5),
    ts('g', 1.5, 0.5, 2.5),
    ts('h', 0.1, -0.5, 0.5),
  ];
  const r =
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      lapRows,
      tsRows,
    );
  // Add a rank-down-only by extending
  const lapRows2 = [...lapRows, lap('i', 0.5, 0.6, 0.05)];
  const tsRows2 = [...tsRows, ts('i', -1.5, -2.5, -0.5)];
  const r2 =
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      lapRows2,
      tsRows2,
    );
  assert.ok(r.bucketCounts['robust-up-trend'] >= 1);
  assert.ok(r.bucketCounts['robust-down-trend'] >= 1);
  assert.ok(r.bucketCounts['direction-conflict'] >= 2);
  assert.ok(r.bucketCounts['mass-late-only'] >= 1);
  assert.ok(r.bucketCounts['mass-early-only'] >= 1);
  assert.ok(r.bucketCounts['rank-up-only'] >= 1);
  assert.ok(r.bucketCounts['no-evidence'] >= 1);
  assert.ok(r2.bucketCounts['rank-down-only'] >= 1);
});

test('jointDirectionQuadrant null for any-missing-decisive buckets', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [
      lap('a', 2.5, 0.001, 0.3), // mass-late-only
      lap('b', 0.5, 0.6, 0.05), // rank-up-only
      lap('c', 0.5, 0.6, 0.05), // no-evidence
    ],
    [
      ts('a', 0.1, -0.5, 0.5),
      ts('b', 1.5, 0.5, 2.5),
      ts('c', 0.1, -0.5, 0.5),
    ],
  );
  for (const row of r.rows) {
    assert.equal(row.jointDirectionQuadrant, null);
  }
});

test('jointDirectionQuadrant non-null for both-decisive buckets', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', 2.5, 0.001, 0.3), lap('b', -2.5, 0.001, -0.3)],
    [ts('a', 1.5, 0.5, 2.5), ts('b', -1.5, -2.5, -0.5)],
  );
  for (const row of r.rows) {
    assert.notEqual(row.jointDirectionQuadrant, null);
  }
});

test('determinism: identical inputs -> identical reports', () => {
  const lapRows = [lap('a', 2.5, 0.012, 0.3), lap('b', -1.5, 0.13, -0.2)];
  const tsRows = [ts('a', 1.5, 0.5, 2.5), ts('b', -0.5, -1.5, 0.5)];
  const r1 =
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      lapRows,
      tsRows,
    );
  const r2 =
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      lapRows,
      tsRows,
    );
  assert.deepEqual(r1, r2);
});

test('summarize report emits one-line log-friendly format', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', 2.5, 0.012, 0.3), lap('b', -2.5, 0.012, -0.3)],
    [ts('a', 1.5, 0.5, 2.5), ts('b', -1.5, -2.5, -0.5)],
  );
  const s = summarizeAxis217Axis214LaplaceTheilSenReport(r);
  assert.match(s, /^axis-217xaxis-214 alpha=0.05 n=2 both=2\/2 /);
  assert.match(s, /qd\[rUp\/rDn\/cLuTd\/cLdTu\]=1\/1\/0\/0/);
  assert.match(
    s,
    /buckets\[ru\/rd\/dc\/mlo\/meo\/ruo\/rdo\/ne\]=1\/1\/0\/0\/0\/0\/0\/0/,
  );
});

test('alpha sensitivity: tighter alpha reduces decisives', () => {
  const lapRows = [lap('a', 2.0, 0.045, 0.2)];
  const tsRows = [ts('a', 1.5, 0.5, 2.5)];
  const loose =
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      lapRows,
      tsRows,
      0.05,
    );
  const tight =
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      lapRows,
      tsRows,
      0.01,
    );
  assert.equal(loose.rows[0]!.lapDecisive, true);
  assert.equal(tight.rows[0]!.lapDecisive, false);
  assert.equal(loose.rows[0]!.bucket, 'robust-up-trend');
  assert.equal(tight.rows[0]!.bucket, 'rank-up-only');
});

test('lapZ = 0 boundary convention: lapZ >= 0 -> up direction', () => {
  const r = classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
    [lap('a', 0, 0.001, 0)],
    [ts('a', 1.5, 0.5, 2.5)],
  );
  // both decisive (lap p<alpha by extreme test choice), lapZ=0 -> up
  assert.equal(r.rows[0]!.bucket, 'robust-up-trend');
});

test('large 50-source synthetic invariant', () => {
  const lapRows: LaplaceCentroidRowForTheilSenSlopeCompound[] = [];
  const tsRows: TheilSenSlopeRowForLaplaceCentroidCompound[] = [];
  for (let i = 0; i < 50; i += 1) {
    const src = `s${String(i).padStart(2, '0')}`;
    const z = i % 5 === 0 ? 2.5 : i % 5 === 1 ? -2.5 : 0.3;
    const p = i % 5 === 0 || i % 5 === 1 ? 0.01 : 0.6;
    lapRows.push(lap(src, z, p, z / 10));
    const slope = i % 3 === 0 ? 1.5 : i % 3 === 1 ? -1.5 : 0.1;
    const ciLow = slope > 0 ? 0.5 : slope < 0 ? -2.5 : -0.5;
    const ciHigh = slope > 0 ? 2.5 : slope < 0 ? -0.5 : 0.5;
    tsRows.push(ts(src, slope, ciLow, ciHigh));
  }
  const r =
    classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
      lapRows,
      tsRows,
    );
  assert.equal(r.rows.length, 50);
  let sum = 0;
  for (const k of Object.keys(r.bucketCounts) as Array<
    keyof typeof r.bucketCounts
  >) {
    sum += r.bucketCounts[k];
  }
  assert.equal(sum, 50);
});
