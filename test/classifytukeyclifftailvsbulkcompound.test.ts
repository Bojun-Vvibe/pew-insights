import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTukeyCliffTailVsBulkCompound,
  type TukeyRowForCliffJoin,
  type CliffRowForTukeyJoin,
} from '../src/classifytukeyclifftailvsbulkcompound.js';

function tq(
  source: string,
  tqW: number,
  tqSignedW: number,
  opts: { indeterminate?: boolean; p?: number } = {},
): TukeyRowForCliffJoin {
  return {
    source,
    tqW,
    tqSignedW,
    tqIndeterminate: opts.indeterminate ?? false,
    tqTwoSidedP: opts.p ?? (tqW === 0 ? 1 : Math.pow(0.5, tqW) * 2),
  };
}

function cd(
  source: string,
  delta: number,
  ciLow: number,
  ciHigh: number,
): CliffRowForTukeyJoin {
  return {
    source,
    cdDelta: delta,
    cdCiLow: ciLow,
    cdCiHigh: ciHigh,
    cdCiExcludesZero: ciLow > 0 || ciHigh < 0,
  };
}

// ---------- bucket logic ----------

test('classifyTukeyCliffTailVsBulkCompound: tail-and-bulk-coherent (both reject, agree)', () => {
  const r = classifyTukeyCliffTailVsBulkCompound(
    [tq('s', 8, +8)],
    [cd('s', +0.6, +0.3, +0.85)],
  );
  assert.equal(r.rows[0]!.bucket, 'tail-and-bulk-coherent');
  assert.equal(r.rows[0]!.direction, 'second-larger');
  assert.equal(r.tailAndBulkCoherent, 1);
});

test('classifyTukeyCliffTailVsBulkCompound: tail-only-no-bulk-dominance', () => {
  const r = classifyTukeyCliffTailVsBulkCompound(
    [tq('s', 7, +7)],
    [cd('s', +0.2, -0.1, +0.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'tail-only-no-bulk-dominance');
  assert.equal(r.tailOnlyNoBulkDominance, 1);
});

test('classifyTukeyCliffTailVsBulkCompound: bulk-dominance-only-no-tail-shift', () => {
  const r = classifyTukeyCliffTailVsBulkCompound(
    [tq('s', 4, +4)],
    [cd('s', +0.5, +0.2, +0.8)],
  );
  assert.equal(r.rows[0]!.bucket, 'bulk-dominance-only-no-tail-shift');
  assert.equal(r.bulkDominanceOnlyNoTailShift, 1);
});

test('classifyTukeyCliffTailVsBulkCompound: tail-and-bulk-direction-conflict', () => {
  const r = classifyTukeyCliffTailVsBulkCompound(
    [tq('s', 8, +8)], // Tukey says SECOND larger
    [cd('s', -0.5, -0.8, -0.2)], // Cliff says FIRST larger
  );
  assert.equal(r.rows[0]!.bucket, 'tail-and-bulk-direction-conflict');
  assert.equal(r.directionConflict, 1);
});

test('classifyTukeyCliffTailVsBulkCompound: indeterminate-bulk-direction-ok', () => {
  const r = classifyTukeyCliffTailVsBulkCompound(
    [tq('s', 0, 0, { indeterminate: true })],
    [cd('s', +0.4, +0.1, +0.7)],
  );
  assert.equal(r.rows[0]!.bucket, 'indeterminate-bulk-direction-ok');
  assert.equal(r.rows[0]!.direction, 'second-larger');
});

test('classifyTukeyCliffTailVsBulkCompound: indeterminate-bulk-ns', () => {
  const r = classifyTukeyCliffTailVsBulkCompound(
    [tq('s', 0, 0, { indeterminate: true })],
    [cd('s', +0.1, -0.2, +0.4)],
  );
  assert.equal(r.rows[0]!.bucket, 'indeterminate-bulk-ns');
});

test('classifyTukeyCliffTailVsBulkCompound: both-ns', () => {
  const r = classifyTukeyCliffTailVsBulkCompound(
    [tq('s', 2, +2)],
    [cd('s', +0.1, -0.2, +0.4)],
  );
  assert.equal(r.rows[0]!.bucket, 'both-ns');
});

// ---------- magnitude bins ----------

test('classifyTukeyCliffTailVsBulkCompound: magnitude bins', () => {
  const r = classifyTukeyCliffTailVsBulkCompound(
    [
      tq('a', 0, 0, { indeterminate: true }),
      tq('b', 0, 0, { indeterminate: true }),
      tq('c', 0, 0, { indeterminate: true }),
      tq('d', 0, 0, { indeterminate: true }),
    ],
    [
      cd('a', 0.1, 0.05, 0.15), // negligible
      cd('b', 0.2, 0.15, 0.25), // small
      cd('c', 0.4, 0.3, 0.5), // medium
      cd('d', 0.6, 0.5, 0.7), // large
    ],
  );
  const byName = new Map(r.rows.map((x) => [x.source, x]));
  assert.equal(byName.get('a')!.cdMagnitude, 'negligible');
  assert.equal(byName.get('b')!.cdMagnitude, 'small');
  assert.equal(byName.get('c')!.cdMagnitude, 'medium');
  assert.equal(byName.get('d')!.cdMagnitude, 'large');
});

// ---------- join logic ----------

test('classifyTukeyCliffTailVsBulkCompound: missing partner sources surface', () => {
  const r = classifyTukeyCliffTailVsBulkCompound(
    [tq('only-tq', 5, +5), tq('both', 8, +8)],
    [cd('both', +0.5, +0.2, +0.8), cd('only-cd', +0.3, +0.1, +0.5)],
  );
  assert.deepEqual(r.sourcesOnlyInTq, ['only-tq']);
  assert.deepEqual(r.sourcesOnlyInCd, ['only-cd']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'both');
});

// ---------- validation ----------

test('classifyTukeyCliffTailVsBulkCompound: rejects duplicate tukey source', () => {
  assert.throws(
    () =>
      classifyTukeyCliffTailVsBulkCompound(
        [tq('s', 5, +5), tq('s', 6, +6)],
        [cd('s', 0.3, 0.1, 0.5)],
      ),
    /duplicate tukey source/,
  );
});

test('classifyTukeyCliffTailVsBulkCompound: rejects bad tqW', () => {
  assert.throws(
    () =>
      classifyTukeyCliffTailVsBulkCompound(
        [tq('s', -1, 0)],
        [cd('s', 0.3, 0.1, 0.5)],
      ),
    /tqW must be finite >= 0/,
  );
});

test('classifyTukeyCliffTailVsBulkCompound: rejects bad cliff CI ordering', () => {
  assert.throws(
    () =>
      classifyTukeyCliffTailVsBulkCompound(
        [tq('s', 5, +5)],
        [{ source: 's', cdDelta: 0, cdCiLow: 0.5, cdCiHigh: 0.1, cdCiExcludesZero: false }],
      ),
    /cdCiLow .* > cdCiHigh/,
  );
});

test('classifyTukeyCliffTailVsBulkCompound: rejects indeterminate with non-zero tqW', () => {
  assert.throws(
    () =>
      classifyTukeyCliffTailVsBulkCompound(
        [tq('s', 5, 0, { indeterminate: true })],
        [cd('s', 0.3, 0.1, 0.5)],
      ),
    /tqIndeterminate=true requires tqW=0/,
  );
});

// ---------- bucket counts headline ----------

test('classifyTukeyCliffTailVsBulkCompound: full headline counts', () => {
  const r = classifyTukeyCliffTailVsBulkCompound(
    [
      tq('coherent', 8, +8),
      tq('tail-only', 7, +7),
      tq('bulk-only', 4, +4),
      tq('conflict', 8, +8),
      tq('indet-ok', 0, 0, { indeterminate: true }),
      tq('indet-ns', 0, 0, { indeterminate: true }),
      tq('both-ns', 2, +2),
    ],
    [
      cd('coherent', +0.6, +0.3, +0.85),
      cd('tail-only', +0.2, -0.1, +0.5),
      cd('bulk-only', +0.5, +0.2, +0.8),
      cd('conflict', -0.5, -0.8, -0.2),
      cd('indet-ok', +0.4, +0.1, +0.7),
      cd('indet-ns', +0.1, -0.2, +0.4),
      cd('both-ns', +0.1, -0.2, +0.4),
    ],
  );
  assert.equal(r.tailAndBulkCoherent, 1);
  assert.equal(r.tailOnlyNoBulkDominance, 1);
  assert.equal(r.bulkDominanceOnlyNoTailShift, 1);
  assert.equal(r.directionConflict, 1);
  assert.equal(r.bucketCounts['indeterminate-bulk-direction-ok'], 1);
  assert.equal(r.bucketCounts['indeterminate-bulk-ns'], 1);
  assert.equal(r.bucketCounts['both-ns'], 1);
});
