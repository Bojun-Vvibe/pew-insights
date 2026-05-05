import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound,
  summarizeAxis219Axis218SenAdichieHirschSlackReport,
} from '../src/classifyaxis219axis218senadichiehirschslackl2vsl1seasonalranktrendcompound.js';

const SA = (source: string, saZ: number, saPValue: number, saRho: number) => ({
  source,
  saZ,
  saPValue,
  saRho,
});
const HS = (source: string, hsZ: number, hsPValue: number, hsTau: number) => ({
  source,
  hsZ,
  hsPValue,
  hsTau,
});

test('axis-219xaxis-218: rejects bad alpha', () => {
  for (const a of [0, 1, -0.1, 1.5, Number.NaN]) {
    assert.throws(() =>
      classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
        [],
        [],
        a,
      ),
    );
  }
});

test('axis-219xaxis-218: rejects non-array inputs', () => {
  // @ts-expect-error
  assert.throws(() =>
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      null,
      [],
    ),
  );
  // @ts-expect-error
  assert.throws(() =>
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [],
      null,
    ),
  );
});

test('axis-219xaxis-218: rejects malformed sa row', () => {
  assert.throws(() =>
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [SA('a', Number.NaN, 0.01, 0.5)],
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [SA('a', 1, 1.5, 0.5)],
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [SA('a', 1, 0.01, 1.5)],
      [],
    ),
  );
});

test('axis-219xaxis-218: rejects malformed hs row', () => {
  assert.throws(() =>
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [],
      [HS('a', Number.POSITIVE_INFINITY, 0.01, 0.5)],
    ),
  );
  assert.throws(() =>
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [],
      [HS('', 1, 0.01, 0.5)],
    ),
  );
});

test('axis-219xaxis-218: rejects duplicate sources', () => {
  assert.throws(() =>
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [SA('a', 1, 0.01, 0.5), SA('a', 2, 0.001, 0.6)],
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [],
      [HS('a', 1, 0.01, 0.5), HS('a', 2, 0.001, 0.6)],
    ),
  );
});

test('axis-219xaxis-218: agree-up bucket', () => {
  const r =
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [SA('s', 4.4, 1e-5, 0.55)],
      [HS('s', 3.2, 1e-3, 0.4)],
    );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.bucket, 'agree-up');
  assert.equal(r.rows[0]!.jointQuadrant, 'agreeUp');
  assert.equal(r.bucketCounts['agree-up'], 1);
  assert.equal(r.byJointQuadrant.agreeUp, 1);
  assert.equal(r.bothDecisive, 1);
});

test('axis-219xaxis-218: agree-down bucket', () => {
  const r =
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [SA('s', -3.0, 1e-3, -0.4)],
      [HS('s', -2.5, 0.012, -0.3)],
    );
  assert.equal(r.rows[0]!.bucket, 'agree-down');
  assert.equal(r.rows[0]!.jointQuadrant, 'agreeDown');
  assert.equal(r.byJointQuadrant.agreeDown, 1);
});

test('axis-219xaxis-218: conflict-sa-up', () => {
  const r =
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [SA('s', 3.0, 1e-3, 0.4)],
      [HS('s', -2.5, 0.012, -0.3)],
    );
  assert.equal(r.rows[0]!.bucket, 'conflict-sa-up');
  assert.equal(r.rows[0]!.jointQuadrant, 'conflictSaUp');
  assert.equal(r.byJointQuadrant.conflictSaUp, 1);
});

test('axis-219xaxis-218: conflict-sa-down', () => {
  const r =
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [SA('s', -3.0, 1e-3, -0.4)],
      [HS('s', 2.5, 0.012, 0.3)],
    );
  assert.equal(r.rows[0]!.bucket, 'conflict-sa-down');
  assert.equal(r.rows[0]!.jointQuadrant, 'conflictSaDown');
  assert.equal(r.byJointQuadrant.conflictSaDown, 1);
});

test('axis-219xaxis-218: sa-only-up', () => {
  const r =
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [SA('s', 3.0, 1e-3, 0.4)],
      [HS('s', 0.5, 0.6, 0.05)],
    );
  assert.equal(r.rows[0]!.bucket, 'sa-only-up');
  assert.equal(r.rows[0]!.jointQuadrant, null);
});

test('axis-219xaxis-218: hs-only-down', () => {
  const r =
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [SA('s', -0.5, 0.6, -0.05)],
      [HS('s', -3.0, 1e-3, -0.4)],
    );
  assert.equal(r.rows[0]!.bucket, 'hs-only-down');
});

test('axis-219xaxis-218: no-evidence', () => {
  const r =
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [SA('s', 0.3, 0.7, 0.04)],
      [HS('s', 0.2, 0.8, 0.03)],
    );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
});

test('axis-219xaxis-218: alpha threshold respect', () => {
  const sa = [SA('s', 2.0, 0.0455, 0.3)];
  const hs = [HS('s', 2.0, 0.0455, 0.3)];
  const r1 =
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      sa,
      hs,
      0.05,
    );
  assert.equal(r1.rows[0]!.bucket, 'agree-up');
  const r2 =
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      sa,
      hs,
      0.01,
    );
  assert.equal(r2.rows[0]!.bucket, 'no-evidence');
});

test('axis-219xaxis-218: tracks sources only in one side', () => {
  const r =
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [SA('a', 1, 0.5, 0.1), SA('b', 1, 0.5, 0.1)],
      [HS('b', 1, 0.5, 0.1), HS('c', 1, 0.5, 0.1)],
    );
  assert.deepEqual(r.sourcesOnlyInSenAdichie, ['a']);
  assert.deepEqual(r.sourcesOnlyInHirschSlack, ['c']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'b');
});

test('axis-219xaxis-218: rows sorted lexicographically', () => {
  const r =
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [SA('zzz', 1, 0.5, 0.1), SA('aaa', 1, 0.5, 0.1), SA('mmm', 1, 0.5, 0.1)],
      [HS('zzz', 1, 0.5, 0.1), HS('aaa', 1, 0.5, 0.1), HS('mmm', 1, 0.5, 0.1)],
    );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['aaa', 'mmm', 'zzz'],
  );
});

test('axis-219xaxis-218: summarize one-liner well-formed', () => {
  const r =
    classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
      [SA('s', 4.4, 1e-5, 0.55), SA('t', -3.0, 1e-3, -0.4)],
      [HS('s', 3.2, 1e-3, 0.4), HS('t', -2.5, 0.012, -0.3)],
    );
  const s = summarizeAxis219Axis218SenAdichieHirschSlackReport(r);
  assert.match(s, /^axis-219xaxis-218 alpha=0\.05 n=2 both=2\/2/);
  assert.match(s, /qd\[au\/ad\/cu\/cd\]=1\/1\/0\/0/);
});
