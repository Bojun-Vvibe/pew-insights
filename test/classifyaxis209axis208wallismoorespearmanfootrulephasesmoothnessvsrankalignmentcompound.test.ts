import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAxis209Axis208WallisMooreSpearmanFootrulePhaseSmoothnessVsRankAlignmentCompound,
  summarizeAxis209Axis208WallisMooreSpearmanFootruleReport,
  smoothCoherentTrendDirectionVerdict,
  summarizeSmoothCoherentTrendDirectionVerdict,
} from '../src/classifyaxis209axis208wallismoorespearmanfootrulephasesmoothnessvsrankalignmentcompound.ts';

const classify =
  classifyAxis209Axis208WallisMooreSpearmanFootrulePhaseSmoothnessVsRankAlignmentCompound;

test('axis-209xaxis-208: empty inputs', () => {
  const r = classify([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.deepEqual(r.sourcesOnlyInWallisMoore, []);
  assert.deepEqual(r.sourcesOnlyInSpearmanFootrule, []);
});

test('axis-209xaxis-208: smooth-up-trend bucket', () => {
  const r = classify(
    [{ source: 'a', wmZ: -3, wmPValue: 0.001 }],
    [{ source: 'a', sfZ: -3, sfPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'smooth-up-trend');
  assert.equal(r.rows[0]!.jointSignQuadrant, 'smoothUp');
  assert.equal(r.bucketCounts['smooth-up-trend'], 1);
  assert.equal(r.byJointSignQuadrant.smoothUp, 1);
  assert.equal(r.bothDecisive, 1);
});

test('axis-209xaxis-208: smooth-down-trend bucket', () => {
  const r = classify(
    [{ source: 'a', wmZ: -3, wmPValue: 0.001 }],
    [{ source: 'a', sfZ: 3, sfPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'smooth-down-trend');
  assert.equal(r.rows[0]!.jointSignQuadrant, 'smoothDown');
  assert.equal(r.byJointSignQuadrant.smoothDown, 1);
});

test('axis-209xaxis-208: zigzag-with-trend (zigzagUp)', () => {
  const r = classify(
    [{ source: 'a', wmZ: 3, wmPValue: 0.001 }],
    [{ source: 'a', sfZ: -3, sfPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'zigzag-with-trend');
  assert.equal(r.rows[0]!.jointSignQuadrant, 'zigzagUp');
  assert.equal(r.byJointSignQuadrant.zigzagUp, 1);
});

test('axis-209xaxis-208: zigzag-with-trend (zigzagDown)', () => {
  const r = classify(
    [{ source: 'a', wmZ: 3, wmPValue: 0.001 }],
    [{ source: 'a', sfZ: 3, sfPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'zigzag-with-trend');
  assert.equal(r.rows[0]!.jointSignQuadrant, 'zigzagDown');
  assert.equal(r.byJointSignQuadrant.zigzagDown, 1);
});

test('axis-209xaxis-208: smoothness-only-smooth', () => {
  const r = classify(
    [{ source: 'a', wmZ: -3, wmPValue: 0.001 }],
    [{ source: 'a', sfZ: -0.2, sfPValue: 0.7 }],
  );
  assert.equal(r.rows[0]!.bucket, 'smoothness-only-smooth');
  assert.equal(r.rows[0]!.jointSignQuadrant, null);
  assert.equal(r.byJointSignQuadrant.anyMissingDecisive, 1);
});

test('axis-209xaxis-208: smoothness-only-zigzag', () => {
  const r = classify(
    [{ source: 'a', wmZ: 3, wmPValue: 0.001 }],
    [{ source: 'a', sfZ: 0.1, sfPValue: 0.9 }],
  );
  assert.equal(r.rows[0]!.bucket, 'smoothness-only-zigzag');
});

test('axis-209xaxis-208: footrule-only', () => {
  const r = classify(
    [{ source: 'a', wmZ: 0.1, wmPValue: 0.9 }],
    [{ source: 'a', sfZ: -3, sfPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'footrule-only');
});

test('axis-209xaxis-208: no-evidence', () => {
  const r = classify(
    [{ source: 'a', wmZ: 0.2, wmPValue: 0.8 }],
    [{ source: 'a', sfZ: 0.3, sfPValue: 0.7 }],
  );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.atLeastOneDecisive, 0);
});

test('axis-209xaxis-208: signals are computed', () => {
  const r = classify(
    [{ source: 'a', wmZ: -2.5, wmPValue: 0.01 }],
    [{ source: 'a', sfZ: -1.8, sfPValue: 0.07 }],
  );
  assert.equal(r.rows[0]!.wmSmoothSignal, 2.5);
  assert.equal(r.rows[0]!.sfTrendUpSignal, 1.8);
});

test('axis-209xaxis-208: source-only buckets', () => {
  const r = classify(
    [
      { source: 'a', wmZ: -1, wmPValue: 0.3 },
      { source: 'b', wmZ: -1, wmPValue: 0.3 },
    ],
    [
      { source: 'a', sfZ: -1, sfPValue: 0.3 },
      { source: 'c', sfZ: -1, sfPValue: 0.3 },
    ],
  );
  assert.deepEqual(r.sourcesOnlyInWallisMoore, ['b']);
  assert.deepEqual(r.sourcesOnlyInSpearmanFootrule, ['c']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'a');
});

test('axis-209xaxis-208: rows ordered by source asc', () => {
  const r = classify(
    [
      { source: 'z', wmZ: -1, wmPValue: 0.3 },
      { source: 'a', wmZ: -1, wmPValue: 0.3 },
      { source: 'm', wmZ: -1, wmPValue: 0.3 },
    ],
    [
      { source: 'z', sfZ: -1, sfPValue: 0.3 },
      { source: 'a', sfZ: -1, sfPValue: 0.3 },
      { source: 'm', sfZ: -1, sfPValue: 0.3 },
    ],
  );
  assert.deepEqual(r.rows.map((row) => row.source), ['a', 'm', 'z']);
});

test('axis-209xaxis-208: throws on bad alpha', () => {
  assert.throws(() => classify([], [], 0));
  assert.throws(() => classify([], [], -0.1));
  assert.throws(() => classify([], [], 0.6));
  assert.throws(() => classify([], [], Number.NaN));
});

test('axis-209xaxis-208: throws on duplicate wallis-moore source', () => {
  assert.throws(() =>
    classify(
      [
        { source: 'a', wmZ: -1, wmPValue: 0.3 },
        { source: 'a', wmZ: -2, wmPValue: 0.2 },
      ],
      [],
    ),
  );
});

test('axis-209xaxis-208: throws on duplicate spearman-footrule source', () => {
  assert.throws(() =>
    classify(
      [],
      [
        { source: 'a', sfZ: -1, sfPValue: 0.3 },
        { source: 'a', sfZ: -2, sfPValue: 0.2 },
      ],
    ),
  );
});

test('axis-209xaxis-208: throws on invalid wmZ', () => {
  assert.throws(() =>
    classify([{ source: 'a', wmZ: Number.NaN, wmPValue: 0.3 }], []),
  );
});

test('axis-209xaxis-208: throws on invalid wmPValue', () => {
  assert.throws(() =>
    classify([{ source: 'a', wmZ: -1, wmPValue: 0 }], []),
  );
  assert.throws(() =>
    classify([{ source: 'a', wmZ: -1, wmPValue: 1.5 }], []),
  );
});

test('axis-209xaxis-208: throws on invalid sfZ', () => {
  assert.throws(() =>
    classify([], [{ source: 'a', sfZ: Number.NaN, sfPValue: 0.3 }]),
  );
});

test('axis-209xaxis-208: throws on empty source', () => {
  assert.throws(() =>
    classify([{ source: '', wmZ: -1, wmPValue: 0.3 }], []),
  );
});

test('axis-209xaxis-208: bucket totals match row count', () => {
  const wmRows = [
    { source: 'a', wmZ: -3, wmPValue: 0.001 },
    { source: 'b', wmZ: 3, wmPValue: 0.001 },
    { source: 'c', wmZ: 0.1, wmPValue: 0.9 },
    { source: 'd', wmZ: -2.5, wmPValue: 0.01 },
  ];
  const sfRows = [
    { source: 'a', sfZ: -3, sfPValue: 0.001 },
    { source: 'b', sfZ: 0.1, sfPValue: 0.9 },
    { source: 'c', sfZ: -3, sfPValue: 0.001 },
    { source: 'd', sfZ: 0.2, sfPValue: 0.8 },
  ];
  const r = classify(wmRows, sfRows);
  const sum = Object.values(r.bucketCounts).reduce((a, b) => a + b, 0);
  assert.equal(sum, r.rows.length);
});

test('axis-209xaxis-208: alpha overrides default', () => {
  // p=0.04 is decisive at alpha=0.05 but not at alpha=0.01.
  const r05 = classify(
    [{ source: 'a', wmZ: -2.0, wmPValue: 0.04 }],
    [{ source: 'a', sfZ: -2.0, sfPValue: 0.04 }],
  );
  assert.equal(r05.rows[0]!.bucket, 'smooth-up-trend');
  const r01 = classify(
    [{ source: 'a', wmZ: -2.0, wmPValue: 0.04 }],
    [{ source: 'a', sfZ: -2.0, sfPValue: 0.04 }],
    0.01,
  );
  assert.equal(r01.rows[0]!.bucket, 'no-evidence');
});

test('axis-209xaxis-208: deterministic on repeated calls', () => {
  const wm = [{ source: 'a', wmZ: -3, wmPValue: 0.001 }];
  const sf = [{ source: 'a', sfZ: -3, sfPValue: 0.001 }];
  const r1 = classify(wm, sf);
  const r2 = classify(wm, sf);
  assert.deepEqual(r1, r2);
});

test('axis-209xaxis-208: summary one-liner format', () => {
  const r = classify(
    [
      { source: 'a', wmZ: -3, wmPValue: 0.001 },
      { source: 'b', wmZ: 3, wmPValue: 0.001 },
    ],
    [
      { source: 'a', sfZ: -3, sfPValue: 0.001 },
      { source: 'b', sfZ: -3, sfPValue: 0.001 },
    ],
  );
  const s = summarizeAxis209Axis208WallisMooreSpearmanFootruleReport(r);
  assert.match(s, /^axis-209xaxis-208 alpha=0\.05 n=2 both=2\/2/);
  assert.match(s, /qd\[smU\/smD\/zgU\/zgD\]=1\/0\/1\/0/);
  assert.match(s, /buckets\[smU\/smD\/zwT\/sos\/soz\/fo\/ne\]=1\/0\/1\/0\/0\/0\/0/);
});

test('axis-209xaxis-208: summary on empty report', () => {
  const r = classify([], []);
  const s = summarizeAxis209Axis208WallisMooreSpearmanFootruleReport(r);
  assert.match(s, /^axis-209xaxis-208 alpha=0\.05 n=0 both=0\/0/);
});

// ----- smoothCoherentTrendDirectionVerdict -----

test('smoothCoherentTrendDirectionVerdict: empty -> no-smooth-coherent-evidence', () => {
  const r = classify([], []);
  const v = smoothCoherentTrendDirectionVerdict(r);
  assert.equal(v.direction, 'no-smooth-coherent-evidence');
  assert.equal(v.contributingRows, 0);
});

test('smoothCoherentTrendDirectionVerdict: pure up', () => {
  const r = classify(
    [
      { source: 'a', wmZ: -3, wmPValue: 0.001 },
      { source: 'b', wmZ: -2.5, wmPValue: 0.01 },
    ],
    [
      { source: 'a', sfZ: -3, sfPValue: 0.001 },
      { source: 'b', sfZ: -2.5, sfPValue: 0.01 },
    ],
  );
  const v = smoothCoherentTrendDirectionVerdict(r);
  assert.equal(v.direction, 'up');
  assert.equal(v.upCount, 2);
  assert.equal(v.downCount, 0);
  assert.equal(v.contributingRows, 2);
});

test('smoothCoherentTrendDirectionVerdict: pure down', () => {
  const r = classify(
    [{ source: 'a', wmZ: -3, wmPValue: 0.001 }],
    [{ source: 'a', sfZ: 3, sfPValue: 0.001 }],
  );
  const v = smoothCoherentTrendDirectionVerdict(r);
  assert.equal(v.direction, 'down');
});

test('smoothCoherentTrendDirectionVerdict: tied', () => {
  const r = classify(
    [
      { source: 'a', wmZ: -3, wmPValue: 0.001 },
      { source: 'b', wmZ: -3, wmPValue: 0.001 },
    ],
    [
      { source: 'a', sfZ: -3, sfPValue: 0.001 },
      { source: 'b', sfZ: 3, sfPValue: 0.001 },
    ],
  );
  const v = smoothCoherentTrendDirectionVerdict(r);
  assert.equal(v.direction, 'tied');
  assert.equal(v.upCount, 1);
  assert.equal(v.downCount, 1);
});

test('smoothCoherentTrendDirectionVerdict: zigzag rows excluded', () => {
  const r = classify(
    [
      { source: 'a', wmZ: 3, wmPValue: 0.001 },
      { source: 'b', wmZ: 3, wmPValue: 0.001 },
    ],
    [
      { source: 'a', sfZ: -3, sfPValue: 0.001 },
      { source: 'b', sfZ: 3, sfPValue: 0.001 },
    ],
  );
  // Both rows are zigzag-with-trend, not smooth-* -- excluded.
  const v = smoothCoherentTrendDirectionVerdict(r);
  assert.equal(v.direction, 'no-smooth-coherent-evidence');
  assert.equal(v.contributingRows, 0);
});

test('summarizeSmoothCoherentTrendDirectionVerdict: format', () => {
  const r = classify(
    [{ source: 'a', wmZ: -3, wmPValue: 0.001 }],
    [{ source: 'a', sfZ: -3, sfPValue: 0.001 }],
  );
  const v = smoothCoherentTrendDirectionVerdict(r);
  const s = summarizeSmoothCoherentTrendDirectionVerdict(v);
  assert.equal(
    s,
    'axis-209xaxis-208-verdict dir=up up=1 down=0 contributing=1',
  );
});

test('summarizeSmoothCoherentTrendDirectionVerdict: no-evidence format', () => {
  const r = classify([], []);
  const v = smoothCoherentTrendDirectionVerdict(r);
  const s = summarizeSmoothCoherentTrendDirectionVerdict(v);
  assert.equal(
    s,
    'axis-209xaxis-208-verdict dir=no-smooth-coherent-evidence up=0 down=0 contributing=0',
  );
});
