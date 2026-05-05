import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound,
  type DavidBartonRowForNoetherCompound,
  type NoetherRowForDavidBartonCompound,
} from '../src/classifydavidbartonnoethersignrunvsspacedtripletstructurecompound.js';

function db(
  source: string,
  dbZ: number,
  dbPValue: number,
): DavidBartonRowForNoetherCompound {
  return { source, dbZ, dbPValue };
}

function no(
  source: string,
  noetherZ: number,
  noetherPValue: number,
): NoetherRowForDavidBartonCompound {
  return { source, noetherZ, noetherPValue };
}

test('compound: empty inputs yield empty report', () => {
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.coherentRows, 0);
  assert.equal(r.crossScaleFlipRows, 0);
  assert.equal(r.scaleSpecificRows, 0);
  assert.equal(r.sourcesOnlyInDavidBarton.length, 0);
  assert.equal(r.sourcesOnlyInNoether.length, 0);
  assert.equal(r.alpha, 0.05);
});

test('compound: alpha must be in (0, 0.5]', () => {
  assert.throws(() =>
    classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound([], [], 0),
  );
  assert.throws(() =>
    classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound([], [], 0.6),
  );
  assert.throws(() =>
    classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
      [],
      [],
      Number.NaN,
    ),
  );
});

test('compound: invalid sources rejected', () => {
  assert.throws(() =>
    classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
      [{ source: '', dbZ: 1, dbPValue: 0.1 }],
      [],
    ),
  );
  assert.throws(() =>
    classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
      [],
      [{ source: '', noetherZ: 1, noetherPValue: 0.1 }],
    ),
  );
});

test('compound: invalid dbZ/p rejected', () => {
  assert.throws(() =>
    classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
      [db('a', Number.NaN, 0.1)],
      [no('a', 1, 0.1)],
    ),
  );
  assert.throws(() =>
    classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
      [db('a', 1, 0)],
      [no('a', 1, 0.1)],
    ),
  );
  assert.throws(() =>
    classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
      [db('a', 1, 1.5)],
      [no('a', 1, 0.1)],
    ),
  );
});

test('compound: invalid noether row rejected', () => {
  assert.throws(() =>
    classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
      [db('a', 1, 0.1)],
      [no('a', Number.NaN, 0.1)],
    ),
  );
  assert.throws(() =>
    classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
      [db('a', 1, 0.1)],
      [no('a', 1, 1.1)],
    ),
  );
});

test('compound: duplicate sources rejected', () => {
  assert.throws(() =>
    classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
      [db('a', 1, 0.1), db('a', 2, 0.2)],
      [],
    ),
  );
  assert.throws(() =>
    classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
      [],
      [no('a', 1, 0.1), no('a', 2, 0.2)],
    ),
  );
});

test('compound: asymmetric source membership tracked', () => {
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
    [db('a', 1, 0.5), db('b', 2, 0.3)],
    [no('b', 1, 0.4), no('c', -1, 0.6)],
  );
  assert.deepEqual(r.sourcesOnlyInDavidBarton, ['a']);
  assert.deepEqual(r.sourcesOnlyInNoether, ['c']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'b');
});

test('compound: rows sorted by source ascending', () => {
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
    [db('zeta', 0.5, 0.6), db('alpha', -0.5, 0.6), db('mu', 0.5, 0.6)],
    [no('zeta', 0.5, 0.6), no('alpha', -0.5, 0.6), no('mu', 0.5, 0.6)],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['alpha', 'mu', 'zeta'],
  );
});

test('compound: no-evidence bucket when both p > alpha', () => {
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
    [db('a', 0.3, 0.7)],
    [no('a', 0.4, 0.6)],
  );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.bucketCounts['no-evidence'], 1);
});

test('compound: coherent-trend when dbZ << 0 and noetherZ >> 0 both decisive', () => {
  // dbZ << 0 (long monotone runs = trend) AND noetherZ >> 0 (lag-2 trend) -> coherent-trend
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
    [db('mono', -5.0, 1e-7)],
    [no('mono', 4.0, 1e-5)],
  );
  assert.equal(r.rows[0]!.bucket, 'coherent-trend');
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.coherentRows, 1);
  assert.equal(r.bucketCounts['coherent-trend'], 1);
});

test('compound: coherent-cyclic when dbZ >> 0 and noetherZ << 0 both decisive', () => {
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
    [db('osc', 4.5, 1e-6)],
    [no('osc', -3.5, 1e-4)],
  );
  assert.equal(r.rows[0]!.bucket, 'coherent-cyclic');
  assert.equal(r.coherentRows, 1);
  assert.equal(r.bucketCounts['coherent-cyclic'], 1);
});

test('compound: cross-scale-flip-spaced-triplet-only when daily oscillation hides lag-2 trend', () => {
  // dbZ > 0 (osc daily) AND noetherZ > 0 (lag-2 trend) both decisive
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
    [db('zigzag-up', 3.5, 1e-4)],
    [no('zigzag-up', 4.0, 1e-5)],
  );
  assert.equal(r.rows[0]!.bucket, 'cross-scale-flip-spaced-triplet-only');
  assert.equal(r.crossScaleFlipRows, 1);
});

test('compound: cross-scale-flip-sign-run-only', () => {
  // dbZ < 0 (long monotone) AND noetherZ < 0 (lag-2 cyclic) both decisive
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
    [db('s', -3.0, 1e-3)],
    [no('s', -2.5, 1e-2)],
  );
  // dbTrendSignal > 0 AND noetherTrendSignal < 0 => sign-run-only flip
  assert.equal(r.rows[0]!.bucket, 'cross-scale-flip-sign-run-only');
  assert.equal(r.crossScaleFlipRows, 1);
});

test('compound: sign-run-only when only dbZ decisive', () => {
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
    [db('a', -3.0, 1e-3)],
    [no('a', 0.4, 0.7)],
  );
  assert.equal(r.rows[0]!.bucket, 'sign-run-only');
  assert.equal(r.scaleSpecificRows, 1);
  assert.equal(r.bothDecisive, 0);
});

test('compound: spaced-triplet-only when only noetherZ decisive', () => {
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
    [db('a', 0.3, 0.7)],
    [no('a', 3.0, 1e-3)],
  );
  assert.equal(r.rows[0]!.bucket, 'spaced-triplet-only');
  assert.equal(r.scaleSpecificRows, 1);
});

test('compound: alpha sensitivity changes bucket assignment', () => {
  // p = 0.04 decisive at alpha=0.05 but not at alpha=0.01
  const dbR = [db('a', -3.0, 0.04)];
  const noR = [no('a', 0.5, 0.6)];
  const r1 = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(dbR, noR, 0.05);
  const r2 = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(dbR, noR, 0.01);
  assert.equal(r1.rows[0]!.bucket, 'sign-run-only');
  assert.equal(r2.rows[0]!.bucket, 'no-evidence');
});

test('compound: trend signals computed correctly', () => {
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
    [db('a', -2.5, 0.012)],
    [no('a', 1.8, 0.07)],
  );
  assert.equal(r.rows[0]!.dbTrendSignal, 2.5);
  assert.equal(r.rows[0]!.noetherTrendSignal, 1.8);
});

test('compound: dbDecisive / noetherDecisive flags set correctly', () => {
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
    [db('a', -3.0, 0.01), db('b', 0.1, 0.9)],
    [no('a', 0.5, 0.6), no('b', 4.0, 1e-5)],
  );
  const a = r.rows.find((x) => x.source === 'a')!;
  const b = r.rows.find((x) => x.source === 'b')!;
  assert.equal(a.dbDecisive, true);
  assert.equal(a.noetherDecisive, false);
  assert.equal(b.dbDecisive, false);
  assert.equal(b.noetherDecisive, true);
});

test('compound: bucketCounts sum equals row count', () => {
  const dbRows = [
    db('a', -3.0, 0.01),
    db('b', 3.0, 0.01),
    db('c', 0.1, 0.9),
    db('d', 4.0, 1e-5),
    db('e', -2.0, 0.04),
    db('f', 1.5, 0.13),
  ];
  const noRows = [
    no('a', 4.0, 1e-5),
    no('b', -3.0, 1e-3),
    no('c', 0.1, 0.9),
    no('d', 0.1, 0.9),
    no('e', 4.0, 1e-5),
    no('f', 4.0, 1e-5),
  ];
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(dbRows, noRows);
  const total = Object.values(r.bucketCounts).reduce((a, b) => a + b, 0);
  assert.equal(total, r.rows.length);
  assert.equal(total, 6);
});

test('compound: coherentRows + crossScaleFlipRows + scaleSpecificRows account for all decisive rows', () => {
  const dbRows = [
    db('a', -3.0, 0.01),
    db('b', 3.0, 0.01),
    db('c', 0.1, 0.9),
    db('d', 4.0, 1e-5),
  ];
  const noRows = [
    no('a', 4.0, 1e-5),
    no('b', -3.0, 1e-3),
    no('c', 0.1, 0.9),
    no('d', 0.1, 0.9),
  ];
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(dbRows, noRows);
  // a -> coherent-trend, b -> coherent-cyclic, c -> no-evidence, d -> sign-run-only
  assert.equal(r.coherentRows, 2);
  assert.equal(r.crossScaleFlipRows, 0);
  assert.equal(r.scaleSpecificRows, 1);
  assert.equal(r.bothDecisive, 2);
  assert.equal(r.atLeastOneDecisive, 3);
});

test('compound: deterministic on same input', () => {
  const dbRows = [db('a', -3.0, 0.01), db('b', 3.0, 0.01)];
  const noRows = [no('a', 4.0, 1e-5), no('b', -3.0, 1e-3)];
  const r1 = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(dbRows, noRows);
  const r2 = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(dbRows, noRows);
  assert.deepEqual(r1, r2);
});

test('compound: empty intersection yields no rows but tracks asymmetric', () => {
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
    [db('a', 1, 0.1), db('b', 2, 0.2)],
    [no('c', 1, 0.1), no('d', -1, 0.2)],
  );
  assert.equal(r.rows.length, 0);
  assert.deepEqual(r.sourcesOnlyInDavidBarton, ['a', 'b']);
  assert.deepEqual(r.sourcesOnlyInNoether, ['c', 'd']);
});

test('compound: bothDecisive AND coherent-cyclic on distinct sources', () => {
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
    [db('a', 4.5, 1e-6), db('b', 4.5, 1e-6)],
    [no('a', -3.5, 1e-4), no('b', -3.5, 1e-4)],
  );
  assert.equal(r.bucketCounts['coherent-cyclic'], 2);
  assert.equal(r.bothDecisive, 2);
});

test('compound: rows preserve dbZ / noetherZ / pValues exactly', () => {
  const r = classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
    [db('a', -1.234567, 0.0123)],
    [no('a', 2.345678, 0.0234)],
  );
  assert.equal(r.rows[0]!.dbZ, -1.234567);
  assert.equal(r.rows[0]!.dbPValue, 0.0123);
  assert.equal(r.rows[0]!.noetherZ, 2.345678);
  assert.equal(r.rows[0]!.noetherPValue, 0.0234);
});
