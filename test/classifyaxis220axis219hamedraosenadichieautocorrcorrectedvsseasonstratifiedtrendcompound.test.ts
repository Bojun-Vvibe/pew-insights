import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound,
  summarizeAxis220Axis219HamedRaoSenAdichieReport,
} from '../src/classifyaxis220axis219hamedraosenadichieautocorrcorrectedvsseasonstratifiedtrendcompound.js';

const HR = (
  source: string,
  hrZ: number,
  hrPValue: number,
  hrTau: number,
  hrEta: number,
) => ({
  source,
  hrZ,
  hrPValue,
  hrTau,
  hrEta,
});
const SA = (source: string, saZ: number, saPValue: number, saRho: number) => ({
  source,
  saZ,
  saPValue,
  saRho,
});

test('axis-220xaxis-219: rejects bad alpha', () => {
  for (const a of [0, 1, -0.1, 1.5, Number.NaN]) {
    assert.throws(() =>
      classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
        [],
        [],
        a,
      ),
    );
  }
});

test('axis-220xaxis-219: rejects non-array inputs', () => {
  assert.throws(() =>
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      // @ts-expect-error
      null,
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [],
      // @ts-expect-error
      null,
    ),
  );
});

test('axis-220xaxis-219: rejects malformed hr row', () => {
  assert.throws(() =>
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('a', Number.NaN, 0.01, 0.5, 1.2)],
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('a', 1, 1.5, 0.5, 1.2)],
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('a', 1, 0.01, 0.5, 0.5)],
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('', 1, 0.01, 0.5, 1.2)],
      [],
    ),
  );
});

test('axis-220xaxis-219: rejects malformed sa row', () => {
  assert.throws(() =>
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [],
      [SA('a', Number.POSITIVE_INFINITY, 0.01, 0.5)],
    ),
  );
  assert.throws(() =>
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [],
      [SA('a', 1, 0.01, 1.5)],
    ),
  );
});

test('axis-220xaxis-219: rejects duplicate sources', () => {
  assert.throws(() =>
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('a', 1, 0.01, 0.5, 1.2), HR('a', 2, 0.001, 0.6, 1.5)],
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [],
      [SA('a', 1, 0.01, 0.5), SA('a', 2, 0.001, 0.6)],
    ),
  );
});

test('axis-220xaxis-219: agree-up bucket', () => {
  const r =
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('s', 4.0, 1e-5, 0.55, 1.1)],
      [SA('s', 3.2, 1e-3, 0.4)],
    );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.bucket, 'agree-up');
  assert.equal(r.rows[0]!.jointQuadrant, 'agreeUp');
  assert.equal(r.bucketCounts['agree-up'], 1);
  assert.equal(r.byJointQuadrant.agreeUp, 1);
  assert.equal(r.bothDecisive, 1);
});

test('axis-220xaxis-219: agree-down bucket', () => {
  const r =
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('s', -3.5, 1e-4, -0.45, 1.3)],
      [SA('s', -2.5, 0.012, -0.3)],
    );
  assert.equal(r.rows[0]!.bucket, 'agree-down');
  assert.equal(r.rows[0]!.jointQuadrant, 'agreeDown');
  assert.equal(r.byJointQuadrant.agreeDown, 1);
});

test('axis-220xaxis-219: conflict-hr-up', () => {
  const r =
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('s', 3.0, 1e-3, 0.4, 1.1)],
      [SA('s', -2.5, 0.012, -0.3)],
    );
  assert.equal(r.rows[0]!.bucket, 'conflict-hr-up');
  assert.equal(r.rows[0]!.jointQuadrant, 'conflictHrUp');
  assert.equal(r.byJointQuadrant.conflictHrUp, 1);
});

test('axis-220xaxis-219: conflict-hr-down', () => {
  const r =
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('s', -3.0, 1e-3, -0.4, 1.1)],
      [SA('s', 2.5, 0.012, 0.3)],
    );
  assert.equal(r.rows[0]!.bucket, 'conflict-hr-down');
  assert.equal(r.rows[0]!.jointQuadrant, 'conflictHrDown');
  assert.equal(r.byJointQuadrant.conflictHrDown, 1);
});

test('axis-220xaxis-219: hr-only-up', () => {
  const r =
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('s', 3.0, 1e-3, 0.4, 1.1)],
      [SA('s', 0.5, 0.6, 0.05)],
    );
  assert.equal(r.rows[0]!.bucket, 'hr-only-up');
  assert.equal(r.rows[0]!.jointQuadrant, null);
});

test('axis-220xaxis-219: hr-only-down', () => {
  const r =
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('s', -3.0, 1e-3, -0.4, 1.1)],
      [SA('s', -0.5, 0.6, -0.05)],
    );
  assert.equal(r.rows[0]!.bucket, 'hr-only-down');
});

test('axis-220xaxis-219: sa-only-up', () => {
  const r =
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('s', 0.5, 0.6, 0.05, 1.1)],
      [SA('s', 3.0, 1e-3, 0.4)],
    );
  assert.equal(r.rows[0]!.bucket, 'sa-only-up');
});

test('axis-220xaxis-219: sa-only-down', () => {
  const r =
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('s', -0.5, 0.6, -0.05, 1.1)],
      [SA('s', -3.0, 1e-3, -0.4)],
    );
  assert.equal(r.rows[0]!.bucket, 'sa-only-down');
});

test('axis-220xaxis-219: no-evidence', () => {
  const r =
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('s', 0.3, 0.7, 0.04, 1.1)],
      [SA('s', 0.2, 0.8, 0.03)],
    );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
});

test('axis-220xaxis-219: alpha threshold respect', () => {
  const hr = [HR('s', 2.0, 0.0455, 0.3, 1.1)];
  const sa = [SA('s', 2.0, 0.0455, 0.3)];
  const r1 =
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      hr,
      sa,
      0.05,
    );
  assert.equal(r1.rows[0]!.bucket, 'agree-up');
  const r2 =
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      hr,
      sa,
      0.01,
    );
  assert.equal(r2.rows[0]!.bucket, 'no-evidence');
});

test('axis-220xaxis-219: tracks sources only in one side', () => {
  const r =
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('a', 1, 0.5, 0.1, 1.1), HR('b', 1, 0.5, 0.1, 1.1)],
      [SA('b', 1, 0.5, 0.1), SA('c', 1, 0.5, 0.1)],
    );
  assert.deepEqual(r.sourcesOnlyInHamedRao, ['a']);
  assert.deepEqual(r.sourcesOnlyInSenAdichie, ['c']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'b');
});

test('axis-220xaxis-219: rows sorted lexicographically', () => {
  const r =
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [
        HR('zzz', 1, 0.5, 0.1, 1.1),
        HR('aaa', 1, 0.5, 0.1, 1.1),
        HR('mmm', 1, 0.5, 0.1, 1.1),
      ],
      [SA('zzz', 1, 0.5, 0.1), SA('aaa', 1, 0.5, 0.1), SA('mmm', 1, 0.5, 0.1)],
    );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['aaa', 'mmm', 'zzz'],
  );
});

test('axis-220xaxis-219: summarize one-liner well-formed', () => {
  const r =
    classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
      [HR('s', 4.0, 1e-5, 0.55, 1.1), HR('t', -3.5, 1e-4, -0.45, 1.3)],
      [SA('s', 3.2, 1e-3, 0.4), SA('t', -2.5, 0.012, -0.3)],
    );
  const s = summarizeAxis220Axis219HamedRaoSenAdichieReport(r);
  assert.match(s, /^axis-220xaxis-219 alpha=0\.05 n=2 both=2\/2/);
  assert.match(s, /qd\[au\/ad\/cu\/cd\]=1\/1\/0\/0/);
});
