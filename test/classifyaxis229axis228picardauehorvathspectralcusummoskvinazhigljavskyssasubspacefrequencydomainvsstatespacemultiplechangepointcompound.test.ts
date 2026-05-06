import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  classifyAxis229Axis228PicardAueHorvathSpectralCusumMoskvinaZhigljavskySsaSubspaceFrequencyDomainVsStateSpaceMultipleChangepointCompound,
  type PicardAueHorvathSpectralRowForSsaCompound,
  type MoskvinaZhigljavskySsaRowForSpectralCompound,
} from '../src/classifyaxis229axis228picardauehorvathspectralcusummoskvinazhigljavskyssasubspacefrequencydomainvsstatespacemultiplechangepointcompound.js';

const sp = (
  source: string,
  spectralM: number,
  spectralTauStar: number[],
  spectralCMax = 1.0,
  spectralSigmaE = 0.5,
  spectralCThreshold = 2.5,
): PicardAueHorvathSpectralRowForSsaCompound => ({
  source,
  spectralM,
  spectralTauStar,
  spectralCMax,
  spectralSigmaE,
  spectralCThreshold,
});

const ss = (
  source: string,
  ssaM: number,
  ssaTauStar: number[],
  ssaDMax = 0.5,
  ssaDThreshold = 0.2,
  ssaSubspaceRank = 2,
): MoskvinaZhigljavskySsaRowForSpectralCompound => ({
  source,
  ssaM,
  ssaTauStar,
  ssaDMax,
  ssaDThreshold,
  ssaSubspaceRank,
});

const fn =
  classifyAxis229Axis228PicardAueHorvathSpectralCusumMoskvinaZhigljavskySsaSubspaceFrequencyDomainVsStateSpaceMultipleChangepointCompound;

// ---- option / shape validation -----------------------------------------

test('axis-229x228: rejects bad proximityGuard', () => {
  assert.throws(() => fn([], [], -1));
  assert.throws(() => fn([], [], 1.5));
});

test('axis-229x228: rejects non-array spectralRows', () => {
  assert.throws(() => fn('nope' as unknown as PicardAueHorvathSpectralRowForSsaCompound[], []));
});

test('axis-229x228: rejects non-array ssaRows', () => {
  assert.throws(() => fn([], 'nope' as unknown as MoskvinaZhigljavskySsaRowForSpectralCompound[]));
});

test('axis-229x228: rejects spectral row with bad source', () => {
  assert.throws(() => fn([{ ...sp('a', 0, []), source: '' }], []));
});

test('axis-229x228: rejects spectral row with mismatched M and tauStar', () => {
  assert.throws(() => fn([sp('a', 2, [3])], []));
});

test('axis-229x228: rejects spectral row with non-ascending tauStar', () => {
  assert.throws(() => fn([sp('a', 2, [10, 5])], []));
});

test('axis-229x228: rejects spectral row with negative cMax', () => {
  assert.throws(() => fn([{ ...sp('a', 0, []), spectralCMax: -1 }], []));
});

test('axis-229x228: rejects ssa row with bad dMax (out of [0,1])', () => {
  assert.throws(() => fn([], [{ ...ss('a', 0, []), ssaDMax: 2 }]));
});

test('axis-229x228: rejects ssa row with bad subspaceRank', () => {
  assert.throws(() => fn([], [{ ...ss('a', 0, []), ssaSubspaceRank: 0 }]));
});

test('axis-229x228: rejects duplicate spectral source', () => {
  assert.throws(() => fn([sp('a', 0, []), sp('a', 0, [])], []));
});

test('axis-229x228: rejects duplicate ssa source', () => {
  assert.throws(() => fn([], [ss('a', 0, []), ss('a', 0, [])]));
});

// ---- bucket logic -------------------------------------------------------

test('axis-229x228: empty inputs return empty report', () => {
  const r = fn([], []);
  assert.deepEqual(r.rows, []);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.deepEqual(r.bucketCounts, {
    'agree-aligned': 0,
    'agree-misaligned': 0,
    'spectral-only': 0,
    'ssa-only': 0,
    'no-evidence': 0,
  });
});

test('axis-229x228: classifies agree-aligned when CPs are within proximityGuard', () => {
  const r = fn([sp('a', 1, [50])], [ss('a', 1, [52])], 5);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
  assert.equal(r.rows[0]!.jointAlignment, 'aligned');
  assert.equal(r.rows[0]!.nearestPairDistance, 2);
  assert.equal(r.bucketCounts['agree-aligned'], 1);
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.byJointAlignment.aligned, 1);
});

test('axis-229x228: classifies agree-misaligned when CPs exceed proximityGuard', () => {
  const r = fn([sp('a', 1, [10])], [ss('a', 1, [80])], 5);
  assert.equal(r.rows[0]!.bucket, 'agree-misaligned');
  assert.equal(r.rows[0]!.jointAlignment, 'misaligned');
  assert.equal(r.rows[0]!.nearestPairDistance, 70);
  assert.equal(r.bucketCounts['agree-misaligned'], 1);
  assert.equal(r.byJointAlignment.misaligned, 1);
});

test('axis-229x228: classifies spectral-only when ssa is silent', () => {
  const r = fn([sp('a', 1, [25])], [ss('a', 0, [])]);
  assert.equal(r.rows[0]!.bucket, 'spectral-only');
  assert.equal(r.rows[0]!.jointAlignment, null);
  assert.equal(r.rows[0]!.nearestPairDistance, Number.MAX_SAFE_INTEGER);
  assert.equal(r.bucketCounts['spectral-only'], 1);
  assert.equal(r.byJointAlignment.anyMissingDecisive, 1);
});

test('axis-229x228: classifies ssa-only when spectral is silent', () => {
  const r = fn([sp('a', 0, [])], [ss('a', 1, [33])]);
  assert.equal(r.rows[0]!.bucket, 'ssa-only');
  assert.equal(r.rows[0]!.jointAlignment, null);
  assert.equal(r.bucketCounts['ssa-only'], 1);
});

test('axis-229x228: classifies no-evidence when both silent', () => {
  const r = fn([sp('a', 0, [])], [ss('a', 0, [])]);
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.rows[0]!.jointAlignment, null);
  assert.equal(r.bucketCounts['no-evidence'], 1);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
});

test('axis-229x228: tracks multi-regime when either side has m>=2', () => {
  const r = fn([sp('a', 2, [10, 50])], [ss('a', 1, [12])], 5);
  assert.equal(r.rows[0]!.multiRegimeEither, true);
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
  assert.equal(r.bothDecisiveMultiRegime, 1);
  assert.equal(r.bothDecisiveSingleRegime, 0);
});

test('axis-229x228: tracks single-regime when both m=1', () => {
  const r = fn([sp('a', 1, [10])], [ss('a', 1, [12])], 5);
  assert.equal(r.rows[0]!.multiRegimeEither, false);
  assert.equal(r.bothDecisiveSingleRegime, 1);
  assert.equal(r.bothDecisiveMultiRegime, 0);
});

test('axis-229x228: surfaces sources-only-in-X listings, sorted', () => {
  const r = fn([sp('a', 0, []), sp('z', 0, [])], [ss('m', 0, []), ss('a', 0, [])]);
  assert.deepEqual(r.sourcesOnlyInSpectral, ['z']);
  assert.deepEqual(r.sourcesOnlyInSsa, ['m']);
  assert.equal(r.rows.length, 1); // only 'a' is in both
  assert.equal(r.rows[0]!.source, 'a');
});

test('axis-229x228: nearestPairDistance picks the minimum across all (i,j)', () => {
  // spectral CPs at 10, 100; ssa CPs at 15, 200 -> min |10-15| = 5
  const r = fn([sp('a', 2, [10, 100])], [ss('a', 2, [15, 200])], 6);
  assert.equal(r.rows[0]!.nearestPairDistance, 5);
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
});

test('axis-229x228: deterministic across two runs on the same input', () => {
  const a = fn(
    [sp('s1', 1, [40]), sp('s2', 0, [])],
    [ss('s1', 1, [42]), ss('s2', 1, [10])],
    5,
  );
  const b = fn(
    [sp('s1', 1, [40]), sp('s2', 0, [])],
    [ss('s1', 1, [42]), ss('s2', 1, [10])],
    5,
  );
  assert.deepEqual(a, b);
});

test('axis-229x228: rows are sorted by source name', () => {
  const r = fn(
    [sp('z', 0, []), sp('a', 0, []), sp('m', 0, [])],
    [ss('z', 0, []), ss('a', 0, []), ss('m', 0, [])],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['a', 'm', 'z'],
  );
});

test('axis-229x228: proximityGuard=0 forces strict equality for alignment', () => {
  const aligned = fn([sp('a', 1, [50])], [ss('a', 1, [50])], 0);
  assert.equal(aligned.rows[0]!.bucket, 'agree-aligned');
  const misal = fn([sp('a', 1, [50])], [ss('a', 1, [51])], 0);
  assert.equal(misal.rows[0]!.bucket, 'agree-misaligned');
});
