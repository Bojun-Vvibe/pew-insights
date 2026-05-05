import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWaldWolfowitzCliffOmnibusVsDirectionCompound,
  type WaldWolfowitzRowForCliffJoin,
  type CliffRowForWaldWolfowitzJoin,
} from '../src/classifywaldwolfowitzcliffomnibusvsdirectioncompound.js';

function ww(
  source: string,
  wwR: number,
  wwZ: number,
  wwTwoSidedP: number,
  wwSignedDirection: number,
): WaldWolfowitzRowForCliffJoin {
  return { source, wwR, wwZ, wwTwoSidedP, wwSignedDirection };
}

function cd(
  source: string,
  cdDelta: number,
  cdCiLow: number,
  cdCiHigh: number,
  cdCiExcludesZero: boolean,
): CliffRowForWaldWolfowitzJoin {
  return { source, cdDelta, cdCiLow, cdCiHigh, cdCiExcludesZero };
}

test('classify ww-cliff: empty inputs -> empty report', () => {
  const r = classifyWaldWolfowitzCliffOmnibusVsDirectionCompound([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.omnibusAndDirectionCoherent, 0);
  assert.equal(r.omnibusOnlyNoDirection, 0);
  assert.equal(r.directionOnlyNoOmnibus, 0);
  assert.equal(r.omnibusAndDirectionConflict, 0);
});

test('classify ww-cliff: omnibus-and-direction-coherent', () => {
  // ww rejects (|Z| > 1.96) AND cliff CI excludes zero, signs agree.
  const r = classifyWaldWolfowitzCliffOmnibusVsDirectionCompound(
    [ww('s', 4, -3.5, 0.001, +1)],
    [cd('s', 0.6, 0.3, 0.85, true)],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.bucket, 'omnibus-and-direction-coherent');
  assert.equal(r.rows[0]!.direction, 'second-larger');
  assert.equal(r.omnibusAndDirectionCoherent, 1);
});

test('classify ww-cliff: omnibus-only-no-direction (pure scale/shape)', () => {
  // ww rejects, cliff CI straddles zero.
  const r = classifyWaldWolfowitzCliffOmnibusVsDirectionCompound(
    [ww('s', 3, -2.5, 0.012, 0)],
    [cd('s', 0.05, -0.2, 0.3, false)],
  );
  assert.equal(r.rows[0]!.bucket, 'omnibus-only-no-direction');
  assert.equal(r.omnibusOnlyNoDirection, 1);
});

test('classify ww-cliff: direction-only-no-omnibus', () => {
  // ww does NOT reject (|Z| < 1.96), cliff CI excludes zero.
  const r = classifyWaldWolfowitzCliffOmnibusVsDirectionCompound(
    [ww('s', 5, -1.0, 0.32, +1)],
    [cd('s', 0.4, 0.05, 0.7, true)],
  );
  assert.equal(r.rows[0]!.bucket, 'direction-only-no-omnibus');
  assert.equal(r.directionOnlyNoOmnibus, 1);
  assert.equal(r.rows[0]!.direction, 'second-larger');
});

test('classify ww-cliff: omnibus-and-direction-conflict', () => {
  // Both reject, but ww median sign and cliff sign disagree.
  const r = classifyWaldWolfowitzCliffOmnibusVsDirectionCompound(
    [ww('s', 3, -3.0, 0.003, +1)],
    [cd('s', -0.5, -0.8, -0.1, true)],
  );
  assert.equal(r.rows[0]!.bucket, 'omnibus-and-direction-conflict');
  assert.equal(r.rows[0]!.direction, 'first-larger'); // defer to cliff
  assert.equal(r.omnibusAndDirectionConflict, 1);
});

test('classify ww-cliff: both-ns', () => {
  const r = classifyWaldWolfowitzCliffOmnibusVsDirectionCompound(
    [ww('s', 5, -0.5, 0.6, 0)],
    [cd('s', 0.05, -0.3, 0.4, false)],
  );
  assert.equal(r.rows[0]!.bucket, 'both-ns');
});

test('classify ww-cliff: rejects duplicate ww source', () => {
  assert.throws(
    () =>
      classifyWaldWolfowitzCliffOmnibusVsDirectionCompound(
        [ww('s', 3, -2.0, 0.05, 0), ww('s', 4, -1.0, 0.3, 0)],
        [],
      ),
    /duplicate ww source/,
  );
});

test('classify ww-cliff: rejects duplicate cliff source', () => {
  assert.throws(
    () =>
      classifyWaldWolfowitzCliffOmnibusVsDirectionCompound(
        [],
        [cd('s', 0.1, -0.2, 0.3, false), cd('s', 0.2, 0, 0.4, false)],
      ),
    /duplicate cliff source/,
  );
});

test('classify ww-cliff: rejects bad wwR', () => {
  assert.throws(
    () =>
      classifyWaldWolfowitzCliffOmnibusVsDirectionCompound(
        [ww('s', 0, -2.0, 0.05, 0)],
        [],
      ),
    /wwR must be finite >= 1/,
  );
});

test('classify ww-cliff: rejects bad wwSignedDirection', () => {
  assert.throws(
    () =>
      classifyWaldWolfowitzCliffOmnibusVsDirectionCompound(
        [ww('s', 3, -2.0, 0.05, 2)],
        [],
      ),
    /wwSignedDirection must be in/,
  );
});

test('classify ww-cliff: rejects bad cdDelta out of [-1, 1]', () => {
  assert.throws(
    () =>
      classifyWaldWolfowitzCliffOmnibusVsDirectionCompound(
        [],
        [cd('s', 1.5, 0, 1, false)],
      ),
    /cdDelta must be finite in/,
  );
});

test('classify ww-cliff: rejects cdCiLow > cdCiHigh', () => {
  assert.throws(
    () =>
      classifyWaldWolfowitzCliffOmnibusVsDirectionCompound(
        [],
        [cd('s', 0.1, 0.5, 0.2, false)],
      ),
    /cdCiLow .* > cdCiHigh/,
  );
});

test('classify ww-cliff: source-only flags + sort by source asc', () => {
  const r = classifyWaldWolfowitzCliffOmnibusVsDirectionCompound(
    [ww('b', 3, -2.5, 0.01, 1), ww('a', 5, -0.5, 0.6, 0), ww('only-ww', 4, -1, 0.3, 0)],
    [cd('b', 0.5, 0.1, 0.9, true), cd('a', 0.0, -0.3, 0.3, false), cd('only-cd', 0.2, 0, 0.4, false)],
  );
  assert.deepEqual(r.sourcesOnlyInWw, ['only-ww']);
  assert.deepEqual(r.sourcesOnlyInCd, ['only-cd']);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0]!.source, 'a');
  assert.equal(r.rows[1]!.source, 'b');
});

test('classify ww-cliff: cdMagnitude binning matches Romano-Coraggio-Skowronski', () => {
  const r = classifyWaldWolfowitzCliffOmnibusVsDirectionCompound(
    [
      ww('neg', 5, 0, 1, 0),
      ww('sm', 5, 0, 1, 0),
      ww('med', 5, 0, 1, 0),
      ww('lg', 5, 0, 1, 0),
    ],
    [
      cd('neg', 0.1, -0.05, 0.25, false),
      cd('sm', 0.2, 0.05, 0.35, true),
      cd('med', 0.4, 0.2, 0.6, true),
      cd('lg', 0.5, 0.3, 0.7, true),
    ],
  );
  const byName = new Map(r.rows.map((row) => [row.source, row]));
  assert.equal(byName.get('neg')!.cdMagnitude, 'negligible');
  assert.equal(byName.get('sm')!.cdMagnitude, 'small');
  assert.equal(byName.get('med')!.cdMagnitude, 'medium');
  assert.equal(byName.get('lg')!.cdMagnitude, 'large');
});
