import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAxis218Axis216HirschSlackBuysBallotSeasonalRankTrendVsWeekdayMeanStructureCompound,
  summarizeAxis218Axis216HirschSlackBuysBallotReport,
  type HirschSlackSeasonalKendallRowForBuysBallotPeriod7AnovaCompound,
  type BuysBallotPeriod7AnovaRowForHirschSlackSeasonalKendallCompound,
} from '../src/classifyaxis218axis216hirschslackbuysballotseasonalranktrendvsweekdaymeanstructurecompound.js';

const cls =
  classifyAxis218Axis216HirschSlackBuysBallotSeasonalRankTrendVsWeekdayMeanStructureCompound;

function hsRow(
  source: string,
  hsZ: number,
  hsPValue: number,
  hsTau = 0,
): HirschSlackSeasonalKendallRowForBuysBallotPeriod7AnovaCompound {
  return { source, hsZ, hsPValue, hsTau };
}

function bbRow(
  source: string,
  bbF: number,
  bbPValue: number,
  bbEta2 = 0.5,
): BuysBallotPeriod7AnovaRowForHirschSlackSeasonalKendallCompound {
  return { source, bbF, bbEta2, bbPValue };
}

test('classifier: rejects alpha out of (0, 0.5]', () => {
  assert.throws(() => cls([], [], 0));
  assert.throws(() => cls([], [], 0.6));
  assert.throws(() => cls([], [], Number.NaN));
});

test('classifier: empty inputs return zero counts', () => {
  const r = cls([], [], 0.05);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.bucketCounts['no-evidence'], 0);
  assert.deepEqual(r.sourcesOnlyInHirschSlack, []);
  assert.deepEqual(r.sourcesOnlyInBuysBallot, []);
});

test('classifier: rejects malformed hirsch-slack rows', () => {
  assert.throws(() =>
    cls([hsRow('a', Number.NaN, 0.1)], [bbRow('a', 1.0, 0.1)]),
  );
  assert.throws(() =>
    cls([hsRow('a', 1, -0.1)], [bbRow('a', 1.0, 0.1)]),
  );
  assert.throws(() =>
    cls([hsRow('a', 1, 0.1, 1.5)], [bbRow('a', 1.0, 0.1)]),
  );
  assert.throws(() => cls([hsRow('', 1, 0.1)], [bbRow('a', 1.0, 0.1)]));
});

test('classifier: rejects malformed buys-ballot rows', () => {
  assert.throws(() =>
    cls([hsRow('a', 1, 0.1)], [bbRow('a', -1.0, 0.1)]),
  );
  assert.throws(() =>
    cls([hsRow('a', 1, 0.1)], [bbRow('a', 1.0, 1.5)]),
  );
  assert.throws(() =>
    cls([hsRow('a', 1, 0.1)], [{ source: 'a', bbF: 1, bbEta2: 1.5, bbPValue: 0.1 }]),
  );
});

test('classifier: rejects duplicate sources', () => {
  assert.throws(() =>
    cls(
      [hsRow('a', 1, 0.1), hsRow('a', 2, 0.2)],
      [bbRow('a', 1, 0.1)],
    ),
  );
  assert.throws(() =>
    cls(
      [hsRow('a', 1, 0.1)],
      [bbRow('a', 1, 0.1), bbRow('a', 2, 0.2)],
    ),
  );
});

test('classifier: only-in-* lists track non-overlap', () => {
  const r = cls(
    [hsRow('a', 1, 0.1), hsRow('b', 1, 0.1)],
    [bbRow('b', 1, 0.1), bbRow('c', 1, 0.1)],
  );
  assert.deepEqual(r.sourcesOnlyInHirschSlack, ['a']);
  assert.deepEqual(r.sourcesOnlyInBuysBallot, ['c']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'b');
});

test('classifier: weekday-and-up-cohort-trend bucket', () => {
  const r = cls(
    [hsRow('a', 5.0, 1e-7, 0.5)],
    [bbRow('a', 10.0, 1e-5, 0.7)],
  );
  assert.equal(r.rows[0]!.bucket, 'weekday-and-up-cohort-trend');
  assert.equal(r.rows[0]!.jointQuadrant, 'weekdayUpCohortTrend');
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.bucketCounts['weekday-and-up-cohort-trend'], 1);
  assert.equal(r.byJointQuadrant.weekdayUpCohortTrend, 1);
});

test('classifier: weekday-and-down-cohort-trend bucket', () => {
  const r = cls(
    [hsRow('a', -3.0, 1e-3, -0.4)],
    [bbRow('a', 10.0, 1e-5, 0.7)],
  );
  assert.equal(r.rows[0]!.bucket, 'weekday-and-down-cohort-trend');
  assert.equal(r.rows[0]!.jointQuadrant, 'weekdayDownCohortTrend');
});

test('classifier: weekday-only bucket', () => {
  const r = cls(
    [hsRow('a', 0.5, 0.5, 0.05)],
    [bbRow('a', 10.0, 1e-5, 0.7)],
  );
  assert.equal(r.rows[0]!.bucket, 'weekday-only');
  assert.equal(r.rows[0]!.jointQuadrant, null);
  assert.equal(r.byJointQuadrant.anyMissingDecisive, 1);
});

test('classifier: up-cohort-trend-only bucket', () => {
  const r = cls(
    [hsRow('a', 4.0, 1e-4, 0.3)],
    [bbRow('a', 1.0, 0.5, 0.05)],
  );
  assert.equal(r.rows[0]!.bucket, 'up-cohort-trend-only');
});

test('classifier: down-cohort-trend-only bucket', () => {
  const r = cls(
    [hsRow('a', -4.0, 1e-4, -0.3)],
    [bbRow('a', 1.0, 0.5, 0.05)],
  );
  assert.equal(r.rows[0]!.bucket, 'down-cohort-trend-only');
});

test('classifier: no-evidence bucket', () => {
  const r = cls(
    [hsRow('a', 0.1, 0.9)],
    [bbRow('a', 0.5, 0.8)],
  );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
});

test('classifier: alpha threshold respected (alpha=0.01 vs 0.05)', () => {
  const hs = [hsRow('a', 2.0, 0.045)];
  const bb = [bbRow('a', 5.0, 0.045)];
  const r05 = cls(hs, bb, 0.05);
  const r01 = cls(hs, bb, 0.01);
  assert.equal(r05.rows[0]!.bucket, 'weekday-and-up-cohort-trend');
  assert.equal(r01.rows[0]!.bucket, 'no-evidence');
});

test('classifier: bucket counts sum to row count', () => {
  const hs = [
    hsRow('a', 3.0, 1e-3, 0.3),
    hsRow('b', -3.0, 1e-3, -0.3),
    hsRow('c', 0.1, 0.9),
    hsRow('d', 4.0, 1e-4, 0.4),
  ];
  const bb = [
    bbRow('a', 5.0, 1e-3),
    bbRow('b', 0.5, 0.8),
    bbRow('c', 5.0, 1e-3),
    bbRow('d', 0.5, 0.8),
  ];
  const r = cls(hs, bb);
  const sum = Object.values(r.bucketCounts).reduce((a, b) => a + b, 0);
  assert.equal(sum, r.rows.length);
  assert.equal(sum, 4);
});

test('classifier: deterministic source ordering (lexicographic)', () => {
  const r = cls(
    [hsRow('zeta', 1, 0.5), hsRow('alpha', 1, 0.5), hsRow('mid', 1, 0.5)],
    [bbRow('mid', 1, 0.5), bbRow('zeta', 1, 0.5), bbRow('alpha', 1, 0.5)],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['alpha', 'mid', 'zeta'],
  );
});

test('summarize: produces stable one-line summary', () => {
  const r = cls(
    [hsRow('a', 3.0, 1e-3, 0.3), hsRow('b', -3.0, 1e-3, -0.3)],
    [bbRow('a', 5.0, 1e-3), bbRow('b', 0.5, 0.8)],
  );
  const s = summarizeAxis218Axis216HirschSlackBuysBallotReport(r);
  assert.match(s, /^axis-218xaxis-216 alpha=0\.05 n=2 both=1\/2/);
  assert.match(s, /qd\[wuc\/wdc\]=1\/0/);
});
