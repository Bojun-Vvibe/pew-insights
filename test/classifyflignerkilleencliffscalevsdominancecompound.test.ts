import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFlignerKilleenCliffScaleVsDominanceCompound,
  type FlignerKilleenRowForCliffJoin,
  type CliffRowForFlignerKilleenJoin,
} from '../src/classifyflignerkilleencliffscalevsdominancecompound.js';

function fk(
  source: string,
  fkX2: number,
  fkZ: number,
  fkPValue: number,
): FlignerKilleenRowForCliffJoin {
  return { source, fkX2, fkZ, fkPValue };
}

function cd(
  source: string,
  cdDelta: number,
  cdCiLow: number,
  cdCiHigh: number,
  cdCiExcludesZero: boolean,
): CliffRowForFlignerKilleenJoin {
  return { source, cdDelta, cdCiLow, cdCiHigh, cdCiExcludesZero };
}

test('classify fk-cliff: empty inputs -> empty report', () => {
  const r = classifyFlignerKilleenCliffScaleVsDominanceCompound([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.scaleAndDominanceCoherent, 0);
  assert.equal(r.scaleOnlyNoDominance, 0);
  assert.equal(r.dominanceOnlyNoScale, 0);
  assert.equal(r.scaleAndDominanceConflict, 0);
});

test('classify fk-cliff: scale-and-dominance-coherent (both up)', () => {
  const fkRows = [fk('a', 38.6, 6.21, 5e-10)];
  const cdRows = [cd('a', 0.55, 0.20, 0.80, true)];
  const r = classifyFlignerKilleenCliffScaleVsDominanceCompound(fkRows, cdRows);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.bucket, 'scale-and-dominance-coherent');
  assert.equal(r.rows[0]!.direction, 'second-larger');
  assert.equal(r.scaleAndDominanceCoherent, 1);
});

test('classify fk-cliff: scale-and-dominance-coherent (both down)', () => {
  const fkRows = [fk('a', 4.0, -2.00, 0.045)];
  const cdRows = [cd('a', -0.40, -0.65, -0.10, true)];
  const r = classifyFlignerKilleenCliffScaleVsDominanceCompound(fkRows, cdRows);
  assert.equal(r.rows[0]!.bucket, 'scale-and-dominance-coherent');
  assert.equal(r.rows[0]!.direction, 'first-larger');
});

test('classify fk-cliff: scale-only-no-dominance (FK rejects, CI straddles 0)', () => {
  const fkRows = [fk('a', 25.0, 5.00, 1e-7)];
  const cdRows = [cd('a', 0.05, -0.10, 0.20, false)];
  const r = classifyFlignerKilleenCliffScaleVsDominanceCompound(fkRows, cdRows);
  assert.equal(r.rows[0]!.bucket, 'scale-only-no-dominance');
  assert.equal(r.scaleOnlyNoDominance, 1);
});

test('classify fk-cliff: dominance-only-no-scale (FK does not reject, CI excludes 0)', () => {
  const fkRows = [fk('a', 1.0, 1.00, 0.32)];
  const cdRows = [cd('a', 0.50, 0.20, 0.75, true)];
  const r = classifyFlignerKilleenCliffScaleVsDominanceCompound(fkRows, cdRows);
  assert.equal(r.rows[0]!.bucket, 'dominance-only-no-scale');
  assert.equal(r.rows[0]!.direction, 'second-larger');
  assert.equal(r.dominanceOnlyNoScale, 1);
});

test('classify fk-cliff: scale-and-dominance-conflict (signs disagree)', () => {
  // FK says SECOND more dispersed (fkZ > 0), Cliff says FIRST larger (delta < 0).
  const fkRows = [fk('a', 9.0, 3.00, 2.7e-3)];
  const cdRows = [cd('a', -0.45, -0.70, -0.10, true)];
  const r = classifyFlignerKilleenCliffScaleVsDominanceCompound(fkRows, cdRows);
  assert.equal(r.rows[0]!.bucket, 'scale-and-dominance-conflict');
  // Defers to Cliff: first-larger.
  assert.equal(r.rows[0]!.direction, 'first-larger');
  assert.equal(r.scaleAndDominanceConflict, 1);
});

test('classify fk-cliff: both-ns', () => {
  const fkRows = [fk('a', 0.5, 0.7, 0.48)];
  const cdRows = [cd('a', 0.05, -0.20, 0.30, false)];
  const r = classifyFlignerKilleenCliffScaleVsDominanceCompound(fkRows, cdRows);
  assert.equal(r.rows[0]!.bucket, 'both-ns');
  assert.equal(r.bucketCounts['both-ns'], 1);
});

test('classify fk-cliff: cliff magnitude bins (negligible / small / medium / large)', () => {
  const fkRows = [
    fk('n', 0.5, 0.7, 0.48),
    fk('s', 0.5, 0.7, 0.48),
    fk('m', 0.5, 0.7, 0.48),
    fk('l', 0.5, 0.7, 0.48),
  ];
  const cdRows = [
    cd('n', 0.10, 0.05, 0.15, true),
    cd('s', 0.20, 0.10, 0.30, true),
    cd('m', 0.40, 0.30, 0.50, true),
    cd('l', 0.60, 0.50, 0.70, true),
  ];
  const r = classifyFlignerKilleenCliffScaleVsDominanceCompound(fkRows, cdRows);
  const byName = new Map(r.rows.map((row) => [row.source, row.cdMagnitude]));
  assert.equal(byName.get('n'), 'negligible');
  assert.equal(byName.get('s'), 'small');
  assert.equal(byName.get('m'), 'medium');
  assert.equal(byName.get('l'), 'large');
});

test('classify fk-cliff: rejects duplicate fk source', () => {
  assert.throws(
    () =>
      classifyFlignerKilleenCliffScaleVsDominanceCompound(
        [fk('a', 1, 0.5, 0.5), fk('a', 2, 1.0, 0.3)],
        [],
      ),
    /duplicate fk source/,
  );
});

test('classify fk-cliff: rejects duplicate cliff source', () => {
  assert.throws(
    () =>
      classifyFlignerKilleenCliffScaleVsDominanceCompound(
        [],
        [cd('a', 0.1, 0, 0.2, true), cd('a', 0.2, 0.1, 0.3, true)],
      ),
    /duplicate cliff source/,
  );
});

test('classify fk-cliff: rejects bad fkX2', () => {
  assert.throws(
    () =>
      classifyFlignerKilleenCliffScaleVsDominanceCompound(
        [fk('a', -1, 0.5, 0.5)],
        [],
      ),
    /fkX2 must be finite >= 0/,
  );
});

test('classify fk-cliff: rejects bad fkPValue', () => {
  assert.throws(
    () =>
      classifyFlignerKilleenCliffScaleVsDominanceCompound(
        [fk('a', 1, 0.5, 1.7)],
        [],
      ),
    /fkPValue must be finite in/,
  );
});

test('classify fk-cliff: rejects out-of-range cdDelta', () => {
  assert.throws(
    () =>
      classifyFlignerKilleenCliffScaleVsDominanceCompound(
        [],
        [cd('a', 1.5, 0, 1, true)],
      ),
    /cdDelta must be finite/,
  );
});

test('classify fk-cliff: rejects cdCiLow > cdCiHigh', () => {
  assert.throws(
    () =>
      classifyFlignerKilleenCliffScaleVsDominanceCompound(
        [],
        [cd('a', 0.5, 0.7, 0.3, true)],
      ),
    /cdCiLow.*> cdCiHigh/,
  );
});

test('classify fk-cliff: outer-join surfaces sourcesOnlyInFk / sourcesOnlyInCd', () => {
  const r = classifyFlignerKilleenCliffScaleVsDominanceCompound(
    [fk('a', 1, 0.5, 0.5), fk('b', 1, 0.5, 0.5)],
    [cd('b', 0.1, 0, 0.2, false), cd('c', 0.1, 0, 0.2, false)],
  );
  assert.deepEqual(r.sourcesOnlyInFk, ['a']);
  assert.deepEqual(r.sourcesOnlyInCd, ['c']);
  // Only the joined source 'b' produces a row.
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'b');
});

test('classify fk-cliff: rows sorted by source asc', () => {
  const fkRows = [fk('z', 5, 2.5, 0.012), fk('a', 5, 2.5, 0.012)];
  const cdRows = [cd('z', 0.5, 0.3, 0.7, true), cd('a', 0.5, 0.3, 0.7, true)];
  const r = classifyFlignerKilleenCliffScaleVsDominanceCompound(fkRows, cdRows);
  assert.deepEqual(r.rows.map((x) => x.source), ['a', 'z']);
});

test('classify fk-cliff: bucketCounts reflect headline counts', () => {
  const fkRows = [
    fk('coh', 38, 6.2, 5e-10),
    fk('scl', 25, 5.0, 1e-7),
    fk('dom', 1, 1.0, 0.32),
    fk('cnf', 9, 3.0, 2.7e-3),
    fk('ns', 0.5, 0.7, 0.48),
  ];
  const cdRows = [
    cd('coh', 0.55, 0.20, 0.80, true),
    cd('scl', 0.05, -0.1, 0.2, false),
    cd('dom', 0.50, 0.20, 0.75, true),
    cd('cnf', -0.45, -0.7, -0.1, true),
    cd('ns', 0.05, -0.2, 0.3, false),
  ];
  const r = classifyFlignerKilleenCliffScaleVsDominanceCompound(fkRows, cdRows);
  assert.equal(r.scaleAndDominanceCoherent, 1);
  assert.equal(r.scaleOnlyNoDominance, 1);
  assert.equal(r.dominanceOnlyNoScale, 1);
  assert.equal(r.scaleAndDominanceConflict, 1);
  assert.equal(r.bucketCounts['both-ns'], 1);
});

test('classify fk-cliff: classified row carries through fkAbsZ and cdAbsDelta', () => {
  const fkRows = [fk('a', 9, -3.0, 2.7e-3)];
  const cdRows = [cd('a', -0.4, -0.7, -0.1, true)];
  const r = classifyFlignerKilleenCliffScaleVsDominanceCompound(fkRows, cdRows);
  assert.equal(r.rows[0]!.fkAbsZ, 3.0);
  assert.ok(Math.abs(r.rows[0]!.cdAbsDelta - 0.4) < 1e-12);
});

test('classify fk-cliff: deterministic across two calls', () => {
  const fkRows = [fk('a', 5, 2.5, 0.012), fk('b', 1, 0.5, 0.5)];
  const cdRows = [cd('a', 0.5, 0.3, 0.7, true), cd('b', 0.05, -0.2, 0.3, false)];
  const r1 = classifyFlignerKilleenCliffScaleVsDominanceCompound(fkRows, cdRows);
  const r2 = classifyFlignerKilleenCliffScaleVsDominanceCompound(fkRows, cdRows);
  assert.deepEqual(r1, r2);
});
