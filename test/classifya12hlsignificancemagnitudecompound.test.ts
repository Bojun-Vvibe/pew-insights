import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  classifyA12HlSignificanceMagnitudeCompound,
  type A12RowForJoin,
  type HlRowForA12Join,
} from '../src/classifya12hlsignificancemagnitudecompound.js';

const a = (
  source: string,
  a12: number,
  vdMagnitude: A12RowForJoin['vdMagnitude'],
  vdCiExcludesHalf: boolean,
): A12RowForJoin => ({ source, a12, vdMagnitude, vdCiExcludesHalf });
const h = (
  source: string,
  hlDelta: number,
  hlSign: -1 | 0 | 1,
  hlCiExcludesZero: boolean,
): HlRowForA12Join => ({ source, hlDelta, hlSign, hlCiExcludesZero });

test('classifyA12HlCompound: empty inputs return empty rows and zero counts', () => {
  const r = classifyA12HlSignificanceMagnitudeCompound([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.signConflicts, 0);
  assert.equal(r.largeAndSignificant, 0);
  assert.equal(r.significantButNegligible, 0);
  assert.deepEqual(r.sourcesOnlyInA12, []);
  assert.deepEqual(r.sourcesOnlyInHl, []);
  for (const v of Object.values(r.bucketCounts)) assert.equal(v, 0);
});

test('classifyA12HlCompound: agree-second-larger-meaningful with large A12', () => {
  const r = classifyA12HlSignificanceMagnitudeCompound(
    [a('s', 0.78, 'large', true)],
    [h('s', 1234567, 1, true)],
  );
  assert.equal(r.rows[0].bucket, 'agree-second-larger-meaningful');
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.largeAndSignificant, 1);
  assert.equal(r.bucketCounts['agree-second-larger-meaningful'], 1);
});

test('classifyA12HlCompound: agree-first-larger-meaningful with medium A12', () => {
  const r = classifyA12HlSignificanceMagnitudeCompound(
    [a('s', 0.32, 'medium', true)],
    [h('s', -555, -1, true)],
  );
  assert.equal(r.rows[0].bucket, 'agree-first-larger-meaningful');
  assert.equal(r.largeAndSignificant, 0); // medium not large
  assert.equal(r.bothDecisive, 1);
});

test('classifyA12HlCompound: agree-second-larger-trivial when both decisive but A12 negligible', () => {
  const r = classifyA12HlSignificanceMagnitudeCompound(
    [a('s', 0.545, 'negligible', true)],
    [h('s', 100, 1, true)],
  );
  assert.equal(r.rows[0].bucket, 'agree-second-larger-trivial');
  assert.equal(r.significantButNegligible, 1);
});

test('classifyA12HlCompound: agree-first-larger-trivial mirrors negligible negative', () => {
  const r = classifyA12HlSignificanceMagnitudeCompound(
    [a('s', 0.46, 'negligible', true)],
    [h('s', -10, -1, true)],
  );
  assert.equal(r.rows[0].bucket, 'agree-first-larger-trivial');
  assert.equal(r.significantButNegligible, 1);
});

test('classifyA12HlCompound: a12-only-decisive when HL CI straddles 0', () => {
  const r = classifyA12HlSignificanceMagnitudeCompound(
    [a('s', 0.7, 'medium', true)],
    [h('s', 50, 1, false)],
  );
  assert.equal(r.rows[0].bucket, 'a12-only-decisive');
  assert.equal(r.atLeastOneDecisive, 1);
  assert.equal(r.bothDecisive, 0);
});

test('classifyA12HlCompound: hl-only-decisive when A12 CI straddles 0.5', () => {
  const r = classifyA12HlSignificanceMagnitudeCompound(
    [a('s', 0.65, 'medium', false)],
    [h('s', 9999, 1, true)],
  );
  assert.equal(r.rows[0].bucket, 'hl-only-decisive');
  assert.equal(r.atLeastOneDecisive, 1);
});

test('classifyA12HlCompound: no-decisive-shift when neither CI excludes its null', () => {
  const r = classifyA12HlSignificanceMagnitudeCompound(
    [a('s', 0.55, 'small', false)],
    [h('s', 100, 1, false)],
  );
  assert.equal(r.rows[0].bucket, 'no-decisive-shift');
  assert.equal(r.atLeastOneDecisive, 0);
});

test('classifyA12HlCompound: sign-conflict when both decisive and signs strictly disagree', () => {
  const r = classifyA12HlSignificanceMagnitudeCompound(
    [a('s', 0.78, 'large', true)],
    [h('s', -1234, -1, true)],
  );
  assert.equal(r.rows[0].bucket, 'sign-conflict');
  assert.equal(r.signConflicts, 1);
});

test('classifyA12HlCompound: source asymmetry surfaces in only-in-X arrays', () => {
  const r = classifyA12HlSignificanceMagnitudeCompound(
    [a('s1', 0.6, 'small', false), a('only-a12', 0.7, 'medium', true)],
    [h('s1', 10, 1, false), h('only-hl', 999, 1, true)],
  );
  assert.deepEqual(r.sourcesOnlyInA12, ['only-a12']);
  assert.deepEqual(r.sourcesOnlyInHl, ['only-hl']);
  // joined row count = 1 (s1)
  assert.equal(r.rows.length, 1);
});

test('classifyA12HlCompound: rows sorted source-asc deterministically', () => {
  const r = classifyA12HlSignificanceMagnitudeCompound(
    [
      a('zeta', 0.6, 'small', false),
      a('alpha', 0.7, 'medium', true),
      a('mu', 0.55, 'small', false),
    ],
    [
      h('zeta', 10, 1, false),
      h('alpha', 999, 1, true),
      h('mu', 5, 1, false),
    ],
  );
  assert.deepEqual(
    r.rows.map((row) => row.source),
    ['alpha', 'mu', 'zeta'],
  );
});

test('classifyA12HlCompound: bucket counts sum equals joined-row count', () => {
  const r = classifyA12HlSignificanceMagnitudeCompound(
    [
      a('s1', 0.78, 'large', true),
      a('s2', 0.32, 'medium', true),
      a('s3', 0.55, 'negligible', true),
      a('s4', 0.65, 'medium', false),
      a('s5', 0.55, 'small', false),
    ],
    [
      h('s1', 1000, 1, true),
      h('s2', -500, -1, true),
      h('s3', 100, 1, true),
      h('s4', 9999, 1, true),
      h('s5', 100, 1, false),
    ],
  );
  const sum = Object.values(r.bucketCounts).reduce((a, b) => a + b, 0);
  assert.equal(sum, r.rows.length);
  assert.equal(sum, 5);
});

test('classifyA12HlCompound: rejects out-of-range a12', () => {
  assert.throws(
    () =>
      classifyA12HlSignificanceMagnitudeCompound(
        [a('s', 1.5, 'large', true)],
        [h('s', 1, 1, true)],
      ),
    /a12 must be finite in \[0, 1\]/,
  );
  assert.throws(
    () =>
      classifyA12HlSignificanceMagnitudeCompound(
        [a('s', -0.1, 'large', true)],
        [h('s', 1, 1, true)],
      ),
    /a12 must be finite in \[0, 1\]/,
  );
});

test('classifyA12HlCompound: rejects non-finite a12 / hlDelta', () => {
  assert.throws(
    () =>
      classifyA12HlSignificanceMagnitudeCompound(
        [a('s', Number.NaN, 'large', true)],
        [h('s', 1, 1, true)],
      ),
    /a12 must be finite/,
  );
  assert.throws(
    () =>
      classifyA12HlSignificanceMagnitudeCompound(
        [a('s', 0.7, 'large', true)],
        [h('s', Number.POSITIVE_INFINITY, 1, true)],
      ),
    /hlDelta must be finite/,
  );
});

test('classifyA12HlCompound: rejects invalid magnitude / hlSign / duplicates', () => {
  assert.throws(
    () =>
      classifyA12HlSignificanceMagnitudeCompound(
        // @ts-expect-error invalid magnitude on purpose
        [a('s', 0.7, 'huge', true)],
        [h('s', 1, 1, true)],
      ),
    /vdMagnitude must be one of/,
  );
  assert.throws(
    () =>
      classifyA12HlSignificanceMagnitudeCompound(
        [a('s', 0.7, 'large', true)],
        // @ts-expect-error invalid sign on purpose
        [h('s', 1, 2, true)],
      ),
    /hlSign must be -1, 0, or 1/,
  );
  assert.throws(
    () =>
      classifyA12HlSignificanceMagnitudeCompound(
        [a('s', 0.7, 'large', true), a('s', 0.6, 'medium', true)],
        [h('s', 1, 1, true)],
      ),
    /duplicate A12 source/,
  );
  assert.throws(
    () =>
      classifyA12HlSignificanceMagnitudeCompound(
        [a('s', 0.7, 'large', true)],
        [h('s', 1, 1, true), h('s', 2, 1, true)],
      ),
    /duplicate HL source/,
  );
});

test('classifyA12HlCompound: live four-source axis-187+186 cross-read shape', () => {
  // Mirrors v0.6.470 axis-186 HL + v0.6.472 axis-187 A12 live-smoke
  // numbers (qualitative — bucket assignments only).
  const a12 = [
    a('claude-code', 0.7369, 'large', true),
    a('hermes', 0.642, 'medium', false),
    a('openclaw', 0.0988, 'large', true),
    a('vscode-cp', 0.4417, 'negligible', true),
  ];
  const hl = [
    h('claude-code', 18998644, 1, false), // hl CI straddles 0 per axis-186 v0.6.470
    h('hermes', 8905175, 1, false),
    h('openclaw', -119325554, -1, true),
    h('vscode-cp', 0, 0, false),
  ];
  const r = classifyA12HlSignificanceMagnitudeCompound(a12, hl);
  const byName = new Map(r.rows.map((row) => [row.source, row]));
  // claude-code: A12 decisive + large; HL not decisive => a12-only-decisive
  assert.equal(byName.get('claude-code')?.bucket, 'a12-only-decisive');
  // hermes: neither decisive
  assert.equal(byName.get('hermes')?.bucket, 'no-decisive-shift');
  // openclaw: both decisive, signs agree first-larger, large => meaningful
  assert.equal(
    byName.get('openclaw')?.bucket,
    'agree-first-larger-meaningful',
  );
  assert.equal(r.largeAndSignificant, 1);
  // vscode-cp: A12 decisive + negligible; HL not decisive
  //  => a12-only-decisive (the "significant but negligible" archetype
  //     surfaces here without sign info because HL is silent)
  assert.equal(byName.get('vscode-cp')?.bucket, 'a12-only-decisive');
});
