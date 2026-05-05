import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAxis208Axis205SpearmanFootruleCoxStuartGlobalVsHalfPairTrendCompound as classify,
  summarizeAxis208Axis205SpearmanFootruleCoxStuartReport as summarize,
} from '../src/classifyaxis208axis205spearmanfootrulecoxstuartglobalvshalfpairtrendcompound.js';

const sf = (source: string, sfZ: number, sfPValue: number) => ({
  source,
  sfZ,
  sfPValue,
});
const cs = (source: string, csZ: number, csPValue: number) => ({
  source,
  csZ,
  csPValue,
});

test('classify: empty inputs -> empty report', () => {
  const r = classify([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.deepEqual(r.byJointSignQuadrant, {
    bothUp: 0,
    bothDown: 0,
    sfUpCsDown: 0,
    sfDownCsUp: 0,
    anyMissingDecisive: 0,
  });
});

test('classify: rejects bad alpha', () => {
  assert.throws(() => classify([], [], 0));
  assert.throws(() => classify([], [], -0.05));
  assert.throws(() => classify([], [], 0.6));
  assert.throws(() => classify([], [], Number.NaN));
});

test('classify: rejects empty source string', () => {
  assert.throws(() => classify([sf('', -1, 0.1)], []));
  assert.throws(() => classify([], [cs('', 1, 0.1)]));
});

test('classify: rejects non-finite sfZ', () => {
  assert.throws(() => classify([sf('a', Number.NaN, 0.1)], []));
});

test('classify: rejects non-finite csPValue', () => {
  assert.throws(() => classify([], [cs('a', 1, Number.NaN)]));
});

test('classify: rejects sfPValue out of (0,1]', () => {
  assert.throws(() => classify([sf('a', -1, 0)], []));
  assert.throws(() => classify([sf('a', -1, 1.1)], []));
});

test('classify: rejects duplicate source in sf', () => {
  assert.throws(() =>
    classify([sf('a', -1, 0.1), sf('a', -2, 0.05)], [cs('a', 1, 0.1)]),
  );
});

test('classify: rejects duplicate source in cs', () => {
  assert.throws(() =>
    classify([sf('a', -1, 0.1)], [cs('a', 1, 0.1), cs('a', 2, 0.05)]),
  );
});

test('classify: coherent-up-trend (sfZ<0 decisive, csZ>0 decisive)', () => {
  const r = classify([sf('a', -3.0, 0.001)], [cs('a', 2.5, 0.01)]);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.bucket, 'coherent-up-trend');
  assert.equal(r.rows[0]!.jointSignQuadrant, 'bothUp');
  assert.equal(r.bucketCounts['coherent-up-trend'], 1);
  assert.equal(r.byJointSignQuadrant.bothUp, 1);
  assert.equal(r.bothDecisive, 1);
});

test('classify: coherent-down-trend (sfZ>0 decisive, csZ<0 decisive)', () => {
  const r = classify([sf('a', 3.0, 0.001)], [cs('a', -2.5, 0.01)]);
  assert.equal(r.rows[0]!.bucket, 'coherent-down-trend');
  assert.equal(r.rows[0]!.jointSignQuadrant, 'bothDown');
  assert.equal(r.byJointSignQuadrant.bothDown, 1);
});

test('classify: direction-conflict sfUpCsDown', () => {
  // sf says up (sfZ < 0), cs says down (csZ < 0)
  const r = classify([sf('a', -3.0, 0.001)], [cs('a', -2.5, 0.01)]);
  assert.equal(r.rows[0]!.bucket, 'direction-conflict');
  assert.equal(r.rows[0]!.jointSignQuadrant, 'sfUpCsDown');
  assert.equal(r.byJointSignQuadrant.sfUpCsDown, 1);
});

test('classify: direction-conflict sfDownCsUp', () => {
  const r = classify([sf('a', 3.0, 0.001)], [cs('a', 2.5, 0.01)]);
  assert.equal(r.rows[0]!.bucket, 'direction-conflict');
  assert.equal(r.rows[0]!.jointSignQuadrant, 'sfDownCsUp');
  assert.equal(r.byJointSignQuadrant.sfDownCsUp, 1);
});

test('classify: global-only-up (sf decisive up, cs not)', () => {
  const r = classify([sf('a', -3.0, 0.001)], [cs('a', 0.2, 0.8)]);
  assert.equal(r.rows[0]!.bucket, 'global-only-up');
  assert.equal(r.rows[0]!.jointSignQuadrant, null);
  assert.equal(r.byJointSignQuadrant.anyMissingDecisive, 1);
});

test('classify: global-only-down (sf decisive down, cs not)', () => {
  const r = classify([sf('a', 3.0, 0.001)], [cs('a', 0.2, 0.8)]);
  assert.equal(r.rows[0]!.bucket, 'global-only-down');
  assert.equal(r.rows[0]!.jointSignQuadrant, null);
});

test('classify: half-pair-only (cs decisive, sf not)', () => {
  const r = classify([sf('a', 0.1, 0.9)], [cs('a', 2.5, 0.01)]);
  assert.equal(r.rows[0]!.bucket, 'half-pair-only');
  assert.equal(r.rows[0]!.jointSignQuadrant, null);
});

test('classify: no-evidence (neither decisive)', () => {
  const r = classify([sf('a', 0.1, 0.9)], [cs('a', 0.2, 0.8)]);
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.rows[0]!.jointSignQuadrant, null);
  assert.equal(r.bucketCounts['no-evidence'], 1);
});

test('classify: only-in-sf and only-in-cs lists', () => {
  const r = classify(
    [sf('a', -1, 0.1), sf('b', -1, 0.1)],
    [cs('a', 1, 0.1), cs('c', 1, 0.1)],
  );
  assert.deepEqual(r.sourcesOnlyInSpearmanFootrule, ['b']);
  assert.deepEqual(r.sourcesOnlyInCoxStuart, ['c']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'a');
});

test('classify: rows sorted by source asc', () => {
  const r = classify(
    [sf('zeta', -1, 0.1), sf('alpha', -1, 0.1)],
    [cs('zeta', 1, 0.1), cs('alpha', 1, 0.1)],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['alpha', 'zeta'],
  );
});

test('classify: signal helpers carry trend-up-positive sign', () => {
  const r = classify([sf('a', -3.0, 0.001)], [cs('a', 2.5, 0.01)]);
  assert.equal(r.rows[0]!.sfTrendUpSignal, 3.0);
  assert.equal(r.rows[0]!.csTrendUpSignal, 2.5);
});

test('classify: alpha=0.01 is more conservative', () => {
  // sfP = 0.03, csP = 0.04: both decisive at alpha=0.05
  // but neither at alpha=0.01.
  const ra = classify([sf('a', -2.5, 0.03)], [cs('a', 2.0, 0.04)], 0.05);
  assert.equal(ra.rows[0]!.bucket, 'coherent-up-trend');
  const rb = classify([sf('a', -2.5, 0.03)], [cs('a', 2.0, 0.04)], 0.01);
  assert.equal(rb.rows[0]!.bucket, 'no-evidence');
});

test('classify: bucketCounts sum to rows.length', () => {
  const r = classify(
    [
      sf('a', -3.0, 0.001),
      sf('b', 3.0, 0.001),
      sf('c', 0.1, 0.9),
      sf('d', -3.0, 0.001),
    ],
    [
      cs('a', 2.5, 0.01),
      cs('b', -2.5, 0.01),
      cs('c', 0.2, 0.8),
      cs('d', -2.5, 0.01),
    ],
  );
  const total = (Object.values(r.bucketCounts) as number[]).reduce(
    (a, b) => a + b,
    0,
  );
  assert.equal(total, r.rows.length);
  assert.equal(total, 4);
});

test('classify: byJointSignQuadrant cells sum to rows.length', () => {
  const r = classify(
    [
      sf('a', -3.0, 0.001),
      sf('b', 3.0, 0.001),
      sf('c', 0.1, 0.9),
    ],
    [
      cs('a', 2.5, 0.01),
      cs('b', -2.5, 0.01),
      cs('c', 0.2, 0.8),
    ],
  );
  const q = r.byJointSignQuadrant;
  const total =
    q.bothUp + q.bothDown + q.sfUpCsDown + q.sfDownCsUp + q.anyMissingDecisive;
  assert.equal(total, r.rows.length);
});

test('classify: deterministic with same inputs', () => {
  const inSf = [sf('a', -3.0, 0.001), sf('b', 3.0, 0.001)];
  const inCs = [cs('a', 2.5, 0.01), cs('b', -2.5, 0.01)];
  const r1 = classify(inSf, inCs);
  const r2 = classify(inSf, inCs);
  assert.deepEqual(r1, r2);
});

test('summarize: includes alpha and counts', () => {
  const r = classify([sf('a', -3.0, 0.001)], [cs('a', 2.5, 0.01)]);
  const s = summarize(r);
  assert.match(s, /^axis-208xaxis-205 alpha=0\.05 n=1 both=1\/1/);
  assert.match(s, /qd\[bU\/bD\/sUcD\/sDcU\]=1\/0\/0\/0/);
  assert.match(s, /buckets\[cuT\/cdT\/dc\/goU\/goD\/hpo\/ne\]=1\/0\/0\/0\/0\/0\/0/);
});

test('summarize: empty report renders zero counts', () => {
  const r = classify([], []);
  const s = summarize(r);
  assert.match(s, /n=0 both=0\/0/);
  assert.match(s, /qd\[bU\/bD\/sUcD\/sDcU\]=0\/0\/0\/0/);
});

test('summarize: one line, no embedded newline', () => {
  const r = classify([sf('a', -3.0, 0.001)], [cs('a', 2.5, 0.01)]);
  const s = summarize(r);
  assert.equal(s.includes('\n'), false);
});

test('summarize: alpha 0.01 reflected in stamp', () => {
  const r = classify([sf('a', -3.0, 0.001)], [cs('a', 2.5, 0.01)], 0.01);
  const s = summarize(r);
  assert.match(s, /alpha=0\.01/);
});

test('summarize: deterministic across repeated calls', () => {
  const r = classify([sf('a', -3.0, 0.001)], [cs('a', 2.5, 0.01)]);
  assert.equal(summarize(r), summarize(r));
});
