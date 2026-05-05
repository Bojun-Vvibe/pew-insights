import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPermTstatA12SignificanceMagnitudeCompound,
  type PermRowForA12Join,
  type A12RowForPermJoin,
} from '../src/classifypermtstata12significancemagnitudecompound.js';

function p(
  source: string,
  permTStat: number,
  permPTwoSided: number,
): PermRowForA12Join {
  const sign: -1 | 0 | 1 =
    permTStat > 0 ? 1 : permTStat < 0 ? -1 : 0;
  return { source, permTStat, permPTwoSided, permSign: sign };
}

function a(
  source: string,
  a12: number,
  vdMagnitude: 'negligible' | 'small' | 'medium' | 'large',
  vdCiExcludesHalf: boolean,
): A12RowForPermJoin {
  return { source, a12, vdMagnitude, vdCiExcludesHalf };
}

test('compound188+187: empty input gives all-zero report', () => {
  const r = classifyPermTstatA12SignificanceMagnitudeCompound([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.signConflicts, 0);
  assert.equal(r.permDecisiveAndLargeA12, 0);
  assert.equal(r.permDecisiveButNegligibleA12, 0);
  assert.deepEqual(r.sourcesOnlyInPerm, []);
  assert.deepEqual(r.sourcesOnlyInA12, []);
  for (const v of Object.values(r.bucketCounts)) assert.equal(v, 0);
});

test('compound188+187: agree-second-larger-meaningful both decisive large', () => {
  const r = classifyPermTstatA12SignificanceMagnitudeCompound(
    [p('s1', 2.5, 0.001)],
    [a('s1', 0.74, 'large', true)],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.bucket, 'agree-second-larger-meaningful');
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.permDecisiveAndLargeA12, 1);
});

test('compound188+187: agree-first-larger-meaningful both decisive large', () => {
  const r = classifyPermTstatA12SignificanceMagnitudeCompound(
    [p('s1', -3.5, 0.0019)],
    [a('s1', 0.10, 'large', true)],
  );
  assert.equal(r.rows[0]!.bucket, 'agree-first-larger-meaningful');
  assert.equal(r.permDecisiveAndLargeA12, 1);
});

test('compound188+187: agree-second-larger-trivial when A12 small', () => {
  const r = classifyPermTstatA12SignificanceMagnitudeCompound(
    [p('s1', 2.0, 0.04)],
    [a('s1', 0.58, 'small', true)],
  );
  assert.equal(r.rows[0]!.bucket, 'agree-second-larger-trivial');
  assert.equal(r.permDecisiveAndLargeA12, 0);
});

test('compound188+187: agree-first-larger-trivial when A12 negligible', () => {
  const r = classifyPermTstatA12SignificanceMagnitudeCompound(
    [p('s1', -2.0, 0.04)],
    [a('s1', 0.46, 'negligible', true)],
  );
  assert.equal(r.rows[0]!.bucket, 'agree-first-larger-trivial');
  assert.equal(r.permDecisiveButNegligibleA12, 1);
});

test('compound188+187: perm-only-decisive when A12 CI straddles', () => {
  const r = classifyPermTstatA12SignificanceMagnitudeCompound(
    [p('s1', 2.5, 0.01)],
    [a('s1', 0.55, 'negligible', false)],
  );
  assert.equal(r.rows[0]!.bucket, 'perm-only-decisive');
  assert.equal(r.atLeastOneDecisive, 1);
  assert.equal(r.bothDecisive, 0);
});

test('compound188+187: a12-only-decisive when perm-t ns', () => {
  const r = classifyPermTstatA12SignificanceMagnitudeCompound(
    [p('s1', -1.25, 0.246)],
    [a('s1', 0.234, 'large', true)],
  );
  assert.equal(r.rows[0]!.bucket, 'a12-only-decisive');
  assert.equal(r.atLeastOneDecisive, 1);
  assert.equal(r.bothDecisive, 0);
});

test('compound188+187: no-decisive-shift when both ns', () => {
  const r = classifyPermTstatA12SignificanceMagnitudeCompound(
    [p('s1', 0.7, 0.49)],
    [a('s1', 0.55, 'negligible', false)],
  );
  assert.equal(r.rows[0]!.bucket, 'no-decisive-shift');
  assert.equal(r.atLeastOneDecisive, 0);
});

test('compound188+187: sign-conflict when both decisive but signs disagree', () => {
  const r = classifyPermTstatA12SignificanceMagnitudeCompound(
    [p('s1', 2.5, 0.01)],
    [a('s1', 0.30, 'large', true)],
  );
  assert.equal(r.rows[0]!.bucket, 'sign-conflict');
  assert.equal(r.signConflicts, 1);
});

test('compound188+187: source-set asymmetry surfaces both directions', () => {
  const r = classifyPermTstatA12SignificanceMagnitudeCompound(
    [p('s1', 2.0, 0.01), p('only-perm', 1.0, 0.5)],
    [a('s1', 0.7, 'large', true), a('only-a12', 0.6, 'small', true)],
  );
  assert.deepEqual(r.sourcesOnlyInPerm, ['only-perm']);
  assert.deepEqual(r.sourcesOnlyInA12, ['only-a12']);
  assert.equal(r.rows.length, 1);
});

test('compound188+187: rows sorted by source asc', () => {
  const r = classifyPermTstatA12SignificanceMagnitudeCompound(
    [p('z', 2.0, 0.01), p('a', 2.0, 0.01), p('m', 2.0, 0.01)],
    [
      a('z', 0.7, 'large', true),
      a('a', 0.7, 'large', true),
      a('m', 0.7, 'large', true),
    ],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['a', 'm', 'z'],
  );
});

test('compound188+187: bucket counts sum to row count', () => {
  const r = classifyPermTstatA12SignificanceMagnitudeCompound(
    [
      p('s1', 2.5, 0.001),
      p('s2', -3.5, 0.002),
      p('s3', 0.7, 0.5),
      p('s4', 2.0, 0.01),
    ],
    [
      a('s1', 0.74, 'large', true),
      a('s2', 0.10, 'large', true),
      a('s3', 0.55, 'negligible', false),
      a('s4', 0.30, 'large', true),
    ],
  );
  let sum = 0;
  for (const v of Object.values(r.bucketCounts)) sum += v;
  assert.equal(sum, r.rows.length);
  assert.equal(sum, 4);
});

test('compound188+187: rejects out-of-range a12', () => {
  assert.throws(
    () =>
      classifyPermTstatA12SignificanceMagnitudeCompound(
        [p('s1', 1, 0.5)],
        [a('s1', 1.5, 'large', true)],
      ),
    /a12 must be finite in \[0, 1\]/,
  );
});

test('compound188+187: rejects out-of-range pTwoSided', () => {
  assert.throws(
    () =>
      classifyPermTstatA12SignificanceMagnitudeCompound(
        [{ source: 's1', permTStat: 1, permPTwoSided: 1.5, permSign: 1 }],
        [a('s1', 0.7, 'large', true)],
      ),
    /permPTwoSided must be finite in \[0, 1\]/,
  );
});

test('compound188+187: rejects non-finite permTStat', () => {
  assert.throws(
    () =>
      classifyPermTstatA12SignificanceMagnitudeCompound(
        [{ source: 's1', permTStat: NaN, permPTwoSided: 0.5, permSign: 0 }],
        [a('s1', 0.7, 'large', true)],
      ),
    /permTStat must be finite/,
  );
});

test('compound188+187: rejects invalid permSign', () => {
  assert.throws(
    () =>
      classifyPermTstatA12SignificanceMagnitudeCompound(
        [{ source: 's1', permTStat: 1, permPTwoSided: 0.5, permSign: 2 as any }],
        [a('s1', 0.7, 'large', true)],
      ),
    /permSign must be -1, 0, or 1/,
  );
});

test('compound188+187: rejects duplicate sources both sides', () => {
  assert.throws(
    () =>
      classifyPermTstatA12SignificanceMagnitudeCompound(
        [p('s1', 1, 0.5), p('s1', 2, 0.1)],
        [a('s1', 0.7, 'large', true)],
      ),
    /duplicate perm source/,
  );
  assert.throws(
    () =>
      classifyPermTstatA12SignificanceMagnitudeCompound(
        [p('s1', 1, 0.5)],
        [a('s1', 0.7, 'large', true), a('s1', 0.6, 'small', true)],
      ),
    /duplicate A12 source/,
  );
});

test('compound188+187: live-shape regression on v0.6.474 corpus', () => {
  // Mirrors the v0.6.474 axis-188 + v0.6.473 axis-187 reads.
  const r = classifyPermTstatA12SignificanceMagnitudeCompound(
    [
      p('claude-code', 2.5199, 0.0001),
      p('hermes', 0.6914, 0.4886),
      p('opencode', -1.2505, 0.2461),
      p('openclaw', -3.4520, 0.0019),
    ],
    [
      a('claude-code', 0.7369, 'large', true),
      a('hermes', 0.6420, 'medium', false),
      a('opencode', 0.234, 'large', true),
      a('openclaw', 0.0989, 'large', true),
    ],
  );
  const byName = new Map(r.rows.map((x) => [x.source, x.bucket]));
  assert.equal(byName.get('claude-code'), 'agree-second-larger-meaningful');
  assert.equal(byName.get('openclaw'), 'agree-first-larger-meaningful');
  assert.equal(byName.get('opencode'), 'a12-only-decisive');
  assert.equal(byName.get('hermes'), 'no-decisive-shift');
  assert.equal(r.permDecisiveAndLargeA12, 2);
  assert.equal(r.bothDecisive, 2);
});
