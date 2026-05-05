import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyKuiperCliffShapeVsDominanceCompound,
  type KuiperRowForCliffJoin,
  type CliffRowForKuiperJoin,
} from '../src/classifykuipercliffshapevsdominancecompound.js';

function mkKp(
  source: string,
  kpV: number,
  kpP: number,
): KuiperRowForCliffJoin {
  return { source, kpV, kpP };
}

function mkCd(
  source: string,
  cdDelta: number,
  ciLow: number,
  ciHigh: number,
  ciExcl: boolean,
): CliffRowForKuiperJoin {
  return {
    source,
    cdDelta,
    cdCiLow: ciLow,
    cdCiHigh: ciHigh,
    cdCiExcludesZero: ciExcl,
  };
}

describe('classifyKuiperCliffShapeVsDominanceCompound', () => {
  it('shape-and-dominance: Kuiper rejects + CI excludes zero (positive direction)', () => {
    const out = classifyKuiperCliffShapeVsDominanceCompound(
      [mkKp('s', 1.2, 0.001)],
      [mkCd('s', 0.6, 0.2, 0.9, true)],
    );
    assert.equal(out.rows.length, 1);
    assert.equal(out.rows[0]!.bucket, 'shape-and-dominance');
    assert.equal(out.rows[0]!.direction, 'second-larger');
    assert.equal(out.shapeAndDominance, 1);
    assert.equal(out.shapeOnlyNoDominance, 0);
  });

  it('shape-and-dominance: Kuiper rejects + CI excludes zero (negative direction)', () => {
    const out = classifyKuiperCliffShapeVsDominanceCompound(
      [mkKp('s', 1.2, 0.001)],
      [mkCd('s', -0.6, -0.9, -0.2, true)],
    );
    assert.equal(out.rows[0]!.bucket, 'shape-and-dominance');
    assert.equal(out.rows[0]!.direction, 'first-larger');
  });

  it('shape-only-no-dominance: Kuiper rejects, CI includes zero, |delta| < large', () => {
    const out = classifyKuiperCliffShapeVsDominanceCompound(
      [mkKp('s', 1.0, 0.01)],
      [mkCd('s', 0.05, -0.3, 0.4, false)],
    );
    assert.equal(out.rows[0]!.bucket, 'shape-only-no-dominance');
    assert.equal(out.shapeOnlyNoDominance, 1);
    assert.equal(out.rows[0]!.cdMagnitude, 'negligible');
  });

  it('shape-with-large-effect-ns-ci: Kuiper rejects, |delta| large, CI includes zero', () => {
    const out = classifyKuiperCliffShapeVsDominanceCompound(
      [mkKp('s', 1.5, 0.02)],
      [mkCd('s', 0.6, -0.1, 0.95, false)],
    );
    assert.equal(out.rows[0]!.bucket, 'shape-with-large-effect-ns-ci');
    assert.equal(out.rows[0]!.cdMagnitude, 'large');
    // shape-only-no-dominance must NOT be incremented for the large-effect carve-out
    assert.equal(out.shapeOnlyNoDominance, 0);
  });

  it('dominance-only-shape-ns: Kuiper ns, CI excludes zero', () => {
    const out = classifyKuiperCliffShapeVsDominanceCompound(
      [mkKp('s', 0.3, 0.4)],
      [mkCd('s', 0.4, 0.05, 0.7, true)],
    );
    assert.equal(out.rows[0]!.bucket, 'dominance-only-shape-ns');
    assert.equal(out.dominanceOnlyShapeNs, 1);
  });

  it('both-ns-large-shape-ratio: both ns but |delta| at least small', () => {
    const out = classifyKuiperCliffShapeVsDominanceCompound(
      [mkKp('s', 0.4, 0.3)],
      [mkCd('s', 0.2, -0.1, 0.5, false)],
    );
    assert.equal(out.rows[0]!.bucket, 'both-ns-large-shape-ratio');
    assert.equal(out.rows[0]!.cdMagnitude, 'small');
  });

  it('both-ns-negligible: everything quiet', () => {
    const out = classifyKuiperCliffShapeVsDominanceCompound(
      [mkKp('s', 0.1, 0.9)],
      [mkCd('s', 0.05, -0.2, 0.3, false)],
    );
    assert.equal(out.rows[0]!.bucket, 'both-ns-negligible');
    assert.equal(out.rows[0]!.cdMagnitude, 'negligible');
  });

  it('alpha boundary: kpP exactly 0.05 counts as reject', () => {
    const out = classifyKuiperCliffShapeVsDominanceCompound(
      [mkKp('s', 0.7, 0.05)],
      [mkCd('s', 0.4, 0.1, 0.7, true)],
    );
    assert.equal(out.rows[0]!.bucket, 'shape-and-dominance');
  });

  it('balanced direction when cdDelta is exactly 0', () => {
    const out = classifyKuiperCliffShapeVsDominanceCompound(
      [mkKp('s', 0.05, 1.0)],
      [mkCd('s', 0, -0.1, 0.1, false)],
    );
    assert.equal(out.rows[0]!.direction, 'balanced');
    assert.equal(out.rows[0]!.bucket, 'both-ns-negligible');
  });

  it('magnitude bins at Romano-Coraggio-Skowronski 2006 thresholds', () => {
    // boundaries: 0.147 (small), 0.33 (medium), 0.474 (large)
    const out = classifyKuiperCliffShapeVsDominanceCompound(
      [
        mkKp('a', 0.1, 0.9),
        mkKp('b', 0.1, 0.9),
        mkKp('c', 0.1, 0.9),
        mkKp('d', 0.1, 0.9),
      ],
      [
        mkCd('a', 0.146, -0.5, 0.5, false),
        mkCd('b', 0.147, -0.5, 0.5, false),
        mkCd('c', 0.33, -0.5, 0.5, false),
        mkCd('d', 0.474, -0.5, 0.5, false),
      ],
    );
    const byName = Object.fromEntries(
      out.rows.map((r) => [r.source, r.cdMagnitude]),
    );
    assert.equal(byName['a'], 'negligible');
    assert.equal(byName['b'], 'small');
    assert.equal(byName['c'], 'medium');
    assert.equal(byName['d'], 'large');
  });

  it('rows sorted by source ascending, deterministically', () => {
    const out = classifyKuiperCliffShapeVsDominanceCompound(
      [mkKp('zeta', 0.1, 0.9), mkKp('alpha', 0.1, 0.9)],
      [mkCd('zeta', 0.0, -0.1, 0.1, false), mkCd('alpha', 0.0, -0.1, 0.1, false)],
    );
    assert.deepEqual(
      out.rows.map((r) => r.source),
      ['alpha', 'zeta'],
    );
  });

  it('bucketCounts sums to number of joined rows', () => {
    const out = classifyKuiperCliffShapeVsDominanceCompound(
      [
        mkKp('a', 1.2, 0.001),
        mkKp('b', 1.0, 0.01),
        mkKp('c', 0.3, 0.4),
      ],
      [
        mkCd('a', 0.6, 0.2, 0.9, true),
        mkCd('b', 0.05, -0.3, 0.4, false),
        mkCd('c', 0.4, 0.05, 0.7, true),
      ],
    );
    const total = Object.values(out.bucketCounts).reduce((s, v) => s + v, 0);
    assert.equal(total, out.rows.length);
    assert.equal(total, 3);
  });

  it('asymmetric source presence is surfaced', () => {
    const out = classifyKuiperCliffShapeVsDominanceCompound(
      [mkKp('a', 0.1, 0.9), mkKp('only-kp', 0.1, 0.9)],
      [mkCd('a', 0.0, -0.1, 0.1, false), mkCd('only-cd', 0.0, -0.1, 0.1, false)],
    );
    assert.deepEqual(out.sourcesOnlyInKp, ['only-kp']);
    assert.deepEqual(out.sourcesOnlyInCd, ['only-cd']);
    assert.equal(out.rows.length, 1);
    assert.equal(out.rows[0]!.source, 'a');
  });

  it('rejects duplicate source in either input', () => {
    assert.throws(
      () =>
        classifyKuiperCliffShapeVsDominanceCompound(
          [mkKp('s', 0.1, 0.9), mkKp('s', 0.2, 0.8)],
          [mkCd('s', 0.0, -0.1, 0.1, false)],
        ),
      /duplicate kuiper source/,
    );
    assert.throws(
      () =>
        classifyKuiperCliffShapeVsDominanceCompound(
          [mkKp('s', 0.1, 0.9)],
          [
            mkCd('s', 0.0, -0.1, 0.1, false),
            mkCd('s', 0.0, -0.1, 0.1, false),
          ],
        ),
      /duplicate cliff source/,
    );
  });

  it('rejects out-of-range kpV / kpP / cdDelta / cdCi*', () => {
    assert.throws(
      () =>
        classifyKuiperCliffShapeVsDominanceCompound(
          [mkKp('s', -0.1, 0.5)],
          [mkCd('s', 0, -0.1, 0.1, false)],
        ),
      /kpV must be finite/,
    );
    assert.throws(
      () =>
        classifyKuiperCliffShapeVsDominanceCompound(
          [mkKp('s', 0.5, 1.1)],
          [mkCd('s', 0, -0.1, 0.1, false)],
        ),
      /kpP must be finite/,
    );
    assert.throws(
      () =>
        classifyKuiperCliffShapeVsDominanceCompound(
          [mkKp('s', 0.5, 0.5)],
          [mkCd('s', 1.5, -0.1, 0.1, false)],
        ),
      /cdDelta must be finite/,
    );
    assert.throws(
      () =>
        classifyKuiperCliffShapeVsDominanceCompound(
          [mkKp('s', 0.5, 0.5)],
          [mkCd('s', 0, 0.5, 0.2, false)],
        ),
      /cdCiLow .* > cdCiHigh/,
    );
  });

  it('headline tallies match individual bucket counts', () => {
    const out = classifyKuiperCliffShapeVsDominanceCompound(
      [
        mkKp('shape-only', 1.0, 0.01),
        mkKp('shape-and', 1.2, 0.001),
        mkKp('dom-only', 0.3, 0.4),
        mkKp('quiet', 0.1, 0.9),
      ],
      [
        mkCd('shape-only', 0.05, -0.3, 0.4, false),
        mkCd('shape-and', 0.6, 0.2, 0.9, true),
        mkCd('dom-only', 0.4, 0.05, 0.7, true),
        mkCd('quiet', 0.0, -0.05, 0.05, false),
      ],
    );
    assert.equal(out.shapeOnlyNoDominance, 1);
    assert.equal(out.shapeAndDominance, 1);
    assert.equal(out.dominanceOnlyShapeNs, 1);
    assert.equal(out.bucketCounts['shape-only-no-dominance'], 1);
    assert.equal(out.bucketCounts['shape-and-dominance'], 1);
    assert.equal(out.bucketCounts['dominance-only-shape-ns'], 1);
    assert.equal(out.bucketCounts['both-ns-negligible'], 1);
  });

  it('empty inputs produce empty report with zeroed bucketCounts', () => {
    const out = classifyKuiperCliffShapeVsDominanceCompound([], []);
    assert.equal(out.rows.length, 0);
    assert.equal(out.shapeOnlyNoDominance, 0);
    assert.equal(out.shapeAndDominance, 0);
    assert.equal(out.dominanceOnlyShapeNs, 0);
    for (const v of Object.values(out.bucketCounts)) assert.equal(v, 0);
  });

  it('|delta| sign does not affect bucket call (only magnitude + significance)', () => {
    const pos = classifyKuiperCliffShapeVsDominanceCompound(
      [mkKp('s', 1.5, 0.02)],
      [mkCd('s', 0.6, -0.1, 0.95, false)],
    );
    const neg = classifyKuiperCliffShapeVsDominanceCompound(
      [mkKp('s', 1.5, 0.02)],
      [mkCd('s', -0.6, -0.95, 0.1, false)],
    );
    assert.equal(pos.rows[0]!.bucket, neg.rows[0]!.bucket);
    assert.notEqual(pos.rows[0]!.direction, neg.rows[0]!.direction);
  });
});
