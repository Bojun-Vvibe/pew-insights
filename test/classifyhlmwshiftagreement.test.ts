import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyHlMwShiftAgreement,
  type HlRowForJoin,
  type MwRowForJoin,
} from '../src/classifyhlmwshiftagreement.js';

function hl(
  source: string,
  hlDelta: number,
  hlSign: -1 | 0 | 1,
  hlCiExcludesZero: boolean,
): HlRowForJoin {
  return { source, hlDelta, hlSign, hlCiExcludesZero };
}

function mw(source: string, mwZ: number): MwRowForJoin {
  return { source, mwZ };
}

test('hl-mw: classifyHlMwShiftAgreement empty inputs => empty rows, all zero counts', () => {
  const r = classifyHlMwShiftAgreement([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.signConflicts, 0);
  assert.deepEqual(r.sourcesOnlyInHl, []);
  assert.deepEqual(r.sourcesOnlyInMw, []);
});

test('hl-mw: classifyHlMwShiftAgreement throws on alpha out of range', () => {
  assert.throws(() => classifyHlMwShiftAgreement([], [], 0));
  assert.throws(() => classifyHlMwShiftAgreement([], [], -0.1));
  assert.throws(() => classifyHlMwShiftAgreement([], [], 0.6));
  assert.throws(() => classifyHlMwShiftAgreement([], [], Number.NaN));
});

test('hl-mw: classifyHlMwShiftAgreement throws on duplicate HL source', () => {
  assert.throws(() =>
    classifyHlMwShiftAgreement(
      [hl('a', 1, 1, true), hl('a', 2, 1, true)],
      [],
    ),
  );
});

test('hl-mw: classifyHlMwShiftAgreement throws on duplicate MW source', () => {
  assert.throws(() =>
    classifyHlMwShiftAgreement([], [mw('a', 2), mw('a', 3)]),
  );
});

test('hl-mw: classifyHlMwShiftAgreement throws on non-finite hlDelta', () => {
  assert.throws(() =>
    classifyHlMwShiftAgreement([hl('a', Number.NaN, 0, false)], [mw('a', 0)]),
  );
});

test('hl-mw: classifyHlMwShiftAgreement throws on invalid hlSign', () => {
  assert.throws(() =>
    classifyHlMwShiftAgreement(
      [{ source: 'a', hlDelta: 1, hlSign: 2 as -1 | 0 | 1, hlCiExcludesZero: true }],
      [mw('a', -3)],
    ),
  );
});

test('hl-mw: classifyHlMwShiftAgreement throws on non-finite mwZ', () => {
  assert.throws(() =>
    classifyHlMwShiftAgreement([hl('a', 1, 1, true)], [mw('a', Number.NaN)]),
  );
});

test('hl-mw: classifyHlMwShiftAgreement agree on second-larger when HL+ and MW-', () => {
  const r = classifyHlMwShiftAgreement(
    [hl('a', 100, 1, true)],
    [mw('a', -3.5)],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.bucket, 'shift-agree-second-larger');
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.atLeastOneDecisive, 1);
  assert.equal(r.signConflicts, 0);
});

test('hl-mw: classifyHlMwShiftAgreement agree on first-larger when HL- and MW+', () => {
  const r = classifyHlMwShiftAgreement(
    [hl('a', -100, -1, true)],
    [mw('a', 3.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'shift-agree-first-larger');
});

test('hl-mw: classifyHlMwShiftAgreement only HL decisive when MW |z| < z_crit', () => {
  const r = classifyHlMwShiftAgreement(
    [hl('a', 100, 1, true)],
    [mw('a', 0.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'shift-only-hl-decisive');
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 1);
});

test('hl-mw: classifyHlMwShiftAgreement only MW decisive when HL CI straddles 0', () => {
  const r = classifyHlMwShiftAgreement(
    [hl('a', 100, 1, false)],
    [mw('a', -3.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'shift-only-mw-decisive');
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 1);
});

test('hl-mw: classifyHlMwShiftAgreement sign-conflict when both decisive but signs strictly disagree', () => {
  const r = classifyHlMwShiftAgreement(
    [hl('a', 100, 1, true)],
    [mw('a', 3.5)], // HL says second larger, MW says first larger
  );
  assert.equal(r.rows[0]!.bucket, 'shift-sign-conflict');
  assert.equal(r.signConflicts, 1);
});

test('hl-mw: classifyHlMwShiftAgreement no-decisive-shift when neither rejects', () => {
  const r = classifyHlMwShiftAgreement(
    [hl('a', 5, 1, false)],
    [mw('a', 0.3)],
  );
  assert.equal(r.rows[0]!.bucket, 'no-decisive-shift');
  assert.equal(r.atLeastOneDecisive, 0);
});

test('hl-mw: classifyHlMwShiftAgreement source-set asymmetry surfaces', () => {
  const r = classifyHlMwShiftAgreement(
    [hl('a', 1, 1, true), hl('b', 1, 1, true)],
    [mw('b', -2.5), mw('c', 2.5)],
  );
  assert.deepEqual(r.sourcesOnlyInHl, ['a']);
  assert.deepEqual(r.sourcesOnlyInMw, ['c']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'b');
});

test('hl-mw: classifyHlMwShiftAgreement bucket-count integrity equals row count', () => {
  const hls = [
    hl('a', 100, 1, true),
    hl('b', -100, -1, true),
    hl('c', 100, 1, false),
    hl('d', -100, -1, false),
    hl('e', 100, 1, true),
    hl('f', 5, 1, false),
  ];
  const mws = [
    mw('a', -3),
    mw('b', 3),
    mw('c', -3),
    mw('d', -0.1),
    mw('e', 3),
    mw('f', 0.1),
  ];
  const r = classifyHlMwShiftAgreement(hls, mws);
  let sum = 0;
  for (const k of Object.keys(r.bucketCounts)) {
    sum += r.bucketCounts[k as keyof typeof r.bucketCounts];
  }
  assert.equal(sum, r.rows.length);
  assert.equal(r.rows.length, 6);
});

test('hl-mw: classifyHlMwShiftAgreement deterministic source-asc ordering', () => {
  const r = classifyHlMwShiftAgreement(
    [hl('z', 1, 1, false), hl('a', 1, 1, false), hl('m', 1, 1, false)],
    [mw('z', 0), mw('a', 0), mw('m', 0)],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['a', 'm', 'z'],
  );
});

test('hl-mw: classifyHlMwShiftAgreement at alpha=0.01 z_crit ~ 2.576', () => {
  const r = classifyHlMwShiftAgreement([], [], 0.01);
  assert.ok(Math.abs(r.zCritical - 2.575_829) < 1e-3);
});

test('hl-mw: classifyHlMwShiftAgreement at alpha=0.05 z_crit ~ 1.96', () => {
  const r = classifyHlMwShiftAgreement([], [], 0.05);
  assert.ok(Math.abs(r.zCritical - 1.959_964) < 1e-3);
});

test('hl-mw: classifyHlMwShiftAgreement hlSign === 0 with both decisive defers to MW sign', () => {
  // Edge case: hlCiExcludesZero true but hlSign 0 — defer
  // to MW sign for the agree-bucket choice.
  const rNeg = classifyHlMwShiftAgreement(
    [hl('a', 0, 0, true)],
    [mw('a', -3)],
  );
  assert.equal(rNeg.rows[0]!.bucket, 'shift-agree-second-larger');
  const rPos = classifyHlMwShiftAgreement(
    [hl('a', 0, 0, true)],
    [mw('a', 3)],
  );
  assert.equal(rPos.rows[0]!.bucket, 'shift-agree-first-larger');
});
