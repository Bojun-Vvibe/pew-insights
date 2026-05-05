import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound,
  type WestenbergRowForFlignerKilleenJoin,
  type FlignerKilleenRowForWestenbergJoin,
} from '../src/classifywestenbergflignerkilleeniqrvsfullrankscalecompound.js';

function w(
  source: string,
  westZ: number,
  westPValue: number,
): WestenbergRowForFlignerKilleenJoin {
  return { source, westZ, westPValue };
}

function f(
  source: string,
  fkX2: number,
  fkZ: number,
  fkPValue: number,
): FlignerKilleenRowForWestenbergJoin {
  return { source, fkX2, fkZ, fkPValue };
}

test('compound: empty inputs -> empty rows', () => {
  const r = classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.iqrAndRankCoherent, 0);
  assert.equal(r.iqrOnlyNoRank, 0);
  assert.equal(r.rankOnlyNoIqr, 0);
  assert.equal(r.iqrAndRankConflict, 0);
});

test('compound: rejects duplicate westenberg source', () => {
  assert.throws(
    () =>
      classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
        [w('a', 1.0, 0.5), w('a', 2.0, 0.1)],
        [],
      ),
    /duplicate westenberg/,
  );
});

test('compound: rejects duplicate fligner-killeen source', () => {
  assert.throws(
    () =>
      classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
        [],
        [f('a', 1.0, 1.0, 0.3), f('a', 4.0, 2.0, 0.05)],
      ),
    /duplicate fligner-killeen/,
  );
});

test('compound: rejects non-finite westZ', () => {
  assert.throws(
    () =>
      classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
        [w('a', NaN, 0.5)],
        [f('a', 1.0, 1.0, 0.3)],
      ),
    /westZ must be finite/,
  );
});

test('compound: rejects out-of-range westPValue', () => {
  assert.throws(
    () =>
      classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
        [w('a', 1.0, 1.5)],
        [f('a', 1.0, 1.0, 0.3)],
      ),
    /westPValue must be finite in/,
  );
});

test('compound: rejects negative fkX2', () => {
  assert.throws(
    () =>
      classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
        [w('a', 1.0, 0.3)],
        [f('a', -0.5, 0.5, 0.3)],
      ),
    /fkX2 must be finite/,
  );
});

test('compound: rejects non-finite fkZ', () => {
  assert.throws(
    () =>
      classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
        [w('a', 1.0, 0.3)],
        [f('a', 1.0, Infinity, 0.3)],
      ),
    /fkZ must be finite/,
  );
});

test('compound: rejects out-of-range fkPValue', () => {
  assert.throws(
    () =>
      classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
        [w('a', 1.0, 0.3)],
        [f('a', 1.0, 1.0, -0.1)],
      ),
    /fkPValue must be finite in/,
  );
});

test('compound: iqr-and-rank-coherent (both reject, same direction)', () => {
  const r = classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
    [w('a', 3.0, 1e-3)],
    [f('a', 9.0, 3.0, 1e-3)],
  );
  assert.equal(r.iqrAndRankCoherent, 1);
  assert.equal(r.rows[0]!.bucket, 'iqr-and-rank-coherent');
  assert.equal(r.rows[0]!.direction, 'second-larger');
});

test('compound: iqr-and-rank-coherent first-larger', () => {
  const r = classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
    [w('a', -3.0, 1e-3)],
    [f('a', 9.0, -3.0, 1e-3)],
  );
  assert.equal(r.iqrAndRankCoherent, 1);
  assert.equal(r.rows[0]!.direction, 'first-larger');
});

test('compound: iqr-only-no-rank (Westenberg rejects, FK does not)', () => {
  const r = classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
    [w('a', 2.5, 0.012)],
    [f('a', 0.5, 0.7, 0.48)],
  );
  assert.equal(r.iqrOnlyNoRank, 1);
  assert.equal(r.rows[0]!.bucket, 'iqr-only-no-rank');
  assert.equal(r.rows[0]!.direction, 'second-larger');
});

test('compound: rank-only-no-iqr (FK rejects, Westenberg does not)', () => {
  const r = classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
    [w('a', 0.8, 0.42)],
    [f('a', 9.0, 3.0, 1e-3)],
  );
  assert.equal(r.rankOnlyNoIqr, 1);
  assert.equal(r.rows[0]!.bucket, 'rank-only-no-iqr');
  assert.equal(r.rows[0]!.direction, 'second-larger');
});

test('compound: iqr-and-rank-conflict (both reject, opposite signs)', () => {
  const r = classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
    [w('a', 3.0, 1e-3)],
    [f('a', 9.0, -3.0, 1e-3)],
  );
  assert.equal(r.iqrAndRankConflict, 1);
  assert.equal(r.rows[0]!.bucket, 'iqr-and-rank-conflict');
  // Conflict defers to FK for direction.
  assert.equal(r.rows[0]!.direction, 'first-larger');
});

test('compound: both-ns (neither rejects)', () => {
  const r = classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
    [w('a', 0.4, 0.69)],
    [f('a', 0.16, 0.4, 0.69)],
  );
  assert.equal(r.bucketCounts['both-ns'], 1);
  assert.equal(r.rows[0]!.bucket, 'both-ns');
});

test('compound: bucket counts sum to joined rows', () => {
  const r = classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
    [
      w('a', 3.0, 1e-3),
      w('b', 2.5, 0.012),
      w('c', 0.8, 0.42),
      w('d', 3.0, 1e-3),
      w('e', 0.4, 0.69),
    ],
    [
      f('a', 9.0, 3.0, 1e-3),
      f('b', 0.5, 0.7, 0.48),
      f('c', 9.0, 3.0, 1e-3),
      f('d', 9.0, -3.0, 1e-3),
      f('e', 0.16, 0.4, 0.69),
    ],
  );
  assert.equal(r.rows.length, 5);
  const sum =
    r.iqrAndRankCoherent +
    r.iqrOnlyNoRank +
    r.rankOnlyNoIqr +
    r.iqrAndRankConflict +
    r.bucketCounts['both-ns'];
  assert.equal(sum, 5);
  assert.equal(r.iqrAndRankCoherent, 1);
  assert.equal(r.iqrOnlyNoRank, 1);
  assert.equal(r.rankOnlyNoIqr, 1);
  assert.equal(r.iqrAndRankConflict, 1);
  assert.equal(r.bucketCounts['both-ns'], 1);
});

test('compound: sources only in west or fk surface separately', () => {
  const r = classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
    [w('a', 1.0, 0.3), w('only-w', 1.0, 0.3)],
    [f('a', 1.0, 1.0, 0.3), f('only-f', 1.0, 1.0, 0.3)],
  );
  assert.deepEqual(r.sourcesOnlyInWest, ['only-w']);
  assert.deepEqual(r.sourcesOnlyInFk, ['only-f']);
  assert.equal(r.rows.length, 1);
});

test('compound: rows sorted alphabetically by source', () => {
  const r = classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
    [w('c', 1.0, 0.3), w('a', 1.0, 0.3), w('b', 1.0, 0.3)],
    [f('c', 1.0, 1.0, 0.3), f('a', 1.0, 1.0, 0.3), f('b', 1.0, 1.0, 0.3)],
  );
  assert.deepEqual(
    r.rows.map((row) => row.source),
    ['a', 'b', 'c'],
  );
});

test('compound: westZ at exactly +/- 1.96 boundary -> reject (>=)', () => {
  const r = classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
    [w('a', 1.959963984540054, 0.05)],
    [f('a', 0.0, 0.0, 1.0)],
  );
  // Westenberg rejects exactly at boundary; FK does not.
  assert.equal(r.iqrOnlyNoRank, 1);
});

test('compound: zero-sign tie-break (westZ rejects, fkZ exactly 0)', () => {
  const r = classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
    [w('a', 2.5, 0.012)],
    [f('a', 0.0, 0.0, 1.0)],
  );
  // FK does not reject (fkZ=0 < 1.96), so bucket is iqr-only-no-rank.
  assert.equal(r.iqrOnlyNoRank, 1);
  assert.equal(r.rows[0]!.direction, 'second-larger');
});

test('compound: westAbsZ and fkAbsZ are abs of signed values', () => {
  const r = classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
    [w('a', -3.0, 1e-3)],
    [f('a', 9.0, -3.0, 1e-3)],
  );
  assert.equal(r.rows[0]!.westAbsZ, 3.0);
  assert.equal(r.rows[0]!.fkAbsZ, 3.0);
});

test('compound: balanced direction when both signs zero in both-ns', () => {
  const r = classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
    [w('a', 0.0, 1.0)],
    [f('a', 0.0, 0.0, 1.0)],
  );
  assert.equal(r.bucketCounts['both-ns'], 1);
  assert.equal(r.rows[0]!.direction, 'balanced');
});
