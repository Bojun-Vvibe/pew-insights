import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  classifyAxis221Axis154AlexanderssonPettittParametricVsRankSingleChangepointCompound as classify,
  summarizeAxis221Axis154AlexanderssonPettittReport as summarize,
  type AlexanderssonSnhtRowForPettittCompound,
  type PettittChangepointRowForSnhtCompound,
} from '../src/classifyaxis221axis154alexanderssonpettittparametricvsranksinglechangepointcompound.js';

function snht(
  source: string,
  t0: number,
  pApprox: number,
  tCrit05: number,
  aStar: number,
  zShift: number,
): AlexanderssonSnhtRowForPettittCompound {
  return { source, snhtT0: t0, snhtPApprox: pApprox, snhtTCrit05: tCrit05, snhtAStar: aStar, snhtZShift: zShift };
}

function pettitt(
  source: string,
  kt: number,
  pApprox: number,
  tStarIndex: number,
  meanShift: number,
): PettittChangepointRowForSnhtCompound {
  return { source, pettittKt: kt, pettittPApprox: pApprox, pettittTStarIndex: tStarIndex, pettittMeanShift: meanShift };
}

// ---- input validation ---------------------------------------------------

test('classify: rejects bad alpha', () => {
  assert.throws(() => classify([], [], 0));
  assert.throws(() => classify([], [], 1));
  assert.throws(() => classify([], [], -0.1));
  assert.throws(() => classify([], [], NaN));
});

test('classify: rejects bad proximityGuard', () => {
  assert.throws(() => classify([], [], 0.05, -1));
  assert.throws(() => classify([], [], 0.05, 1.5));
});

test('classify: rejects non-array inputs', () => {
  // @ts-expect-error
  assert.throws(() => classify('foo', []));
  // @ts-expect-error
  assert.throws(() => classify([], 'bar'));
});

test('classify: rejects bad snht row', () => {
  assert.throws(() => classify([snht('', 1, 0.1, 5, 5, 0.5)], [pettitt('s', 1, 0.1, 4, 1)]));
  assert.throws(() => classify([snht('s', NaN, 0.1, 5, 5, 0.5)], []));
  assert.throws(() => classify([snht('s', -1, 0.1, 5, 5, 0.5)], []));
  assert.throws(() => classify([snht('s', 1, -0.1, 5, 5, 0.5)], []));
  assert.throws(() => classify([snht('s', 1, 1.1, 5, 5, 0.5)], []));
  assert.throws(() => classify([snht('s', 1, 0.1, -1, 5, 0.5)], []));
  assert.throws(() => classify([snht('s', 1, 0.1, 5, 0, 0.5)], []));
  assert.throws(() => classify([snht('s', 1, 0.1, 5, 5.5, 0.5)], []));
  assert.throws(() => classify([snht('s', 1, 0.1, 5, 5, NaN)], []));
});

test('classify: rejects bad pettitt row', () => {
  assert.throws(() => classify([], [pettitt('', 1, 0.1, 4, 1)]));
  assert.throws(() => classify([], [pettitt('s', NaN, 0.1, 4, 1)]));
  assert.throws(() => classify([], [pettitt('s', -1, 0.1, 4, 1)]));
  assert.throws(() => classify([], [pettitt('s', 1, -0.1, 4, 1)]));
  assert.throws(() => classify([], [pettitt('s', 1, 1.1, 4, 1)]));
  assert.throws(() => classify([], [pettitt('s', 1, 0.1, -2, 1)]));
  assert.throws(() => classify([], [pettitt('s', 1, 0.1, 4.5, 1)]));
});

test('classify: rejects duplicate snht source', () => {
  assert.throws(() =>
    classify(
      [snht('s', 1, 0.1, 5, 5, 0.5), snht('s', 2, 0.1, 5, 5, 0.5)],
      [],
    ),
  );
});

test('classify: rejects duplicate pettitt source', () => {
  assert.throws(() =>
    classify(
      [],
      [pettitt('s', 1, 0.1, 4, 1), pettitt('s', 2, 0.1, 4, 1)],
    ),
  );
});

// ---- empty inputs -------------------------------------------------------

test('classify: empty inputs -> empty report with zeroed counts', () => {
  const r = classify([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.deepEqual(r.bucketCounts, {
    'agree-aligned': 0,
    'agree-misaligned': 0,
    'snht-only': 0,
    'pettitt-only': 0,
    'no-evidence': 0,
  });
  assert.deepEqual(r.sourcesOnlyInSnht, []);
  assert.deepEqual(r.sourcesOnlyInPettitt, []);
});

// ---- bucket logic -------------------------------------------------------

test('classify: agree-aligned (both decisive, near argmax)', () => {
  // SNHT aStar=10 (zero-based 9), Pettitt tStar=10. distance=1 <= guard=5
  const r = classify(
    [snht('s', 30, 1e-5, 7.8, 10, 2.3)],
    [pettitt('s', 200, 1e-3, 10, 100)],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
  assert.equal(r.rows[0]!.jointAlignment, 'aligned');
  assert.equal(r.rows[0]!.argmaxDistance, 1);
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.byJointAlignment.aligned, 1);
});

test('classify: agree-misaligned (both decisive, distant argmax)', () => {
  // SNHT aStar=10 (zero-based 9), Pettitt tStar=30. distance=21 > guard=5
  const r = classify(
    [snht('s', 30, 1e-5, 7.8, 10, 2.3)],
    [pettitt('s', 200, 1e-3, 30, 100)],
  );
  assert.equal(r.rows[0]!.bucket, 'agree-misaligned');
  assert.equal(r.rows[0]!.jointAlignment, 'misaligned');
  assert.equal(r.rows[0]!.argmaxDistance, 21);
  assert.equal(r.byJointAlignment.misaligned, 1);
});

test('classify: snht-only (decisive SNHT via pApprox, non-decisive Pettitt)', () => {
  const r = classify(
    [snht('s', 30, 1e-5, 7.8, 10, 2.3)],
    [pettitt('s', 50, 0.5, 10, 50)],
  );
  assert.equal(r.rows[0]!.bucket, 'snht-only');
  assert.equal(r.rows[0]!.jointAlignment, null);
  assert.equal(r.rows[0]!.snhtDecisive, true);
  assert.equal(r.rows[0]!.pettittDecisive, false);
});

test('classify: snht-only via tCrit05 OR (pApprox conservative > alpha but T0 >= tCrit05)', () => {
  // pApprox 0.08 > alpha 0.05 but T0=10 >= tCrit05=8 -> still decisive
  const r = classify(
    [snht('s', 10, 0.08, 8, 10, 1.2)],
    [pettitt('s', 50, 0.5, 10, 50)],
  );
  assert.equal(r.rows[0]!.snhtDecisive, true);
  assert.equal(r.rows[0]!.bucket, 'snht-only');
});

test('classify: pettitt-only (non-decisive SNHT, decisive Pettitt)', () => {
  // SNHT pApprox=0.5 AND T0 < tCrit05 -> not decisive
  const r = classify(
    [snht('s', 5, 0.5, 8, 10, 0.5)],
    [pettitt('s', 200, 1e-3, 10, 100)],
  );
  assert.equal(r.rows[0]!.bucket, 'pettitt-only');
  assert.equal(r.rows[0]!.snhtDecisive, false);
  assert.equal(r.rows[0]!.pettittDecisive, true);
});

test('classify: no-evidence (neither decisive)', () => {
  const r = classify(
    [snht('s', 5, 0.5, 8, 10, 0.5)],
    [pettitt('s', 50, 0.5, 10, 50)],
  );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
});

test('classify: argmax index normalisation (snht 1-based -> 0-based)', () => {
  // SNHT aStar=1 -> zero-based 0; Pettitt tStar=0 -> distance=0
  const r = classify(
    [snht('s', 30, 1e-5, 7.8, 1, 2.3)],
    [pettitt('s', 200, 1e-3, 0, 100)],
  );
  assert.equal(r.rows[0]!.snhtAStarZeroBased, 0);
  assert.equal(r.rows[0]!.argmaxDistance, 0);
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
});

// ---- alignment guard customisation --------------------------------------

test('classify: custom proximityGuard widens alignment', () => {
  const r = classify(
    [snht('s', 30, 1e-5, 7.8, 10, 2.3)],
    [pettitt('s', 200, 1e-3, 30, 100)],
    0.05,
    25, // wider guard
  );
  // distance=21 <= guard=25 -> aligned
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
  assert.equal(r.rows[0]!.jointAlignment, 'aligned');
});

test('classify: proximityGuard 0 requires exact argmax match', () => {
  const r = classify(
    [snht('s', 30, 1e-5, 7.8, 10, 2.3)],
    [pettitt('s', 200, 1e-3, 9, 100)],
    0.05,
    0,
  );
  // distance=0 (snht aStarZero=9, pettitt tStar=9) -> aligned
  assert.equal(r.rows[0]!.argmaxDistance, 0);
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
});

// ---- source-set asymmetry ----------------------------------------------

test('classify: sourcesOnlyInSnht / sourcesOnlyInPettitt populated and sorted', () => {
  const r = classify(
    [
      snht('common', 30, 1e-5, 7.8, 10, 2.3),
      snht('snht-extra-z', 30, 1e-5, 7.8, 10, 2.3),
      snht('snht-extra-a', 30, 1e-5, 7.8, 10, 2.3),
    ],
    [
      pettitt('common', 200, 1e-3, 10, 100),
      pettitt('pettitt-extra-z', 200, 1e-3, 10, 100),
      pettitt('pettitt-extra-a', 200, 1e-3, 10, 100),
    ],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'common');
  assert.deepEqual(r.sourcesOnlyInSnht, ['snht-extra-a', 'snht-extra-z']);
  assert.deepEqual(r.sourcesOnlyInPettitt, ['pettitt-extra-a', 'pettitt-extra-z']);
});

// ---- alpha threshold respected -----------------------------------------

test('classify: alpha=0.01 makes a borderline-0.05 result non-decisive', () => {
  const r = classify(
    [snht('s', 4, 0.04, 100, 10, 1.0)], // pApprox=0.04 -> sig at 0.05 NOT 0.01; T0=4 < tCrit05=100
    [pettitt('s', 100, 0.04, 10, 50)],
    0.01,
  );
  assert.equal(r.rows[0]!.snhtDecisive, false);
  assert.equal(r.rows[0]!.pettittDecisive, false);
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
});

test('classify: alpha=0.10 makes borderline-0.08 results decisive', () => {
  const r = classify(
    [snht('s', 4, 0.08, 100, 10, 1.0)], // T0=4 < tCrit05=100, pApprox=0.08 < alpha=0.10
    [pettitt('s', 100, 0.5, 10, 50)],
    0.10,
  );
  assert.equal(r.rows[0]!.snhtDecisive, true);
  assert.equal(r.rows[0]!.bucket, 'snht-only');
});

// ---- lex source ordering ------------------------------------------------

test('classify: rows in lex source order', () => {
  const r = classify(
    [
      snht('z-src', 30, 1e-5, 7.8, 10, 2.3),
      snht('a-src', 30, 1e-5, 7.8, 10, 2.3),
      snht('m-src', 30, 1e-5, 7.8, 10, 2.3),
    ],
    [
      pettitt('z-src', 200, 1e-3, 10, 100),
      pettitt('a-src', 200, 1e-3, 10, 100),
      pettitt('m-src', 200, 1e-3, 10, 100),
    ],
  );
  assert.equal(r.rows[0]!.source, 'a-src');
  assert.equal(r.rows[1]!.source, 'm-src');
  assert.equal(r.rows[2]!.source, 'z-src');
});

// ---- bucketCounts sum invariant ----------------------------------------

test('classify: bucketCounts sum to rows.length', () => {
  const r = classify(
    [
      snht('a', 30, 1e-5, 7.8, 10, 2.3), // agree-aligned
      snht('b', 30, 1e-5, 7.8, 10, 2.3), // agree-misaligned
      snht('c', 30, 1e-5, 7.8, 10, 2.3), // snht-only
      snht('d', 5, 0.5, 8, 10, 0.5), // pettitt-only
      snht('e', 5, 0.5, 8, 10, 0.5), // no-evidence
    ],
    [
      pettitt('a', 200, 1e-3, 10, 100),
      pettitt('b', 200, 1e-3, 30, 100),
      pettitt('c', 50, 0.5, 10, 50),
      pettitt('d', 200, 1e-3, 10, 100),
      pettitt('e', 50, 0.5, 10, 50),
    ],
  );
  const sum = Object.values(r.bucketCounts).reduce((a, b) => a + b, 0);
  assert.equal(sum, r.rows.length);
  assert.equal(r.bucketCounts['agree-aligned'], 1);
  assert.equal(r.bucketCounts['agree-misaligned'], 1);
  assert.equal(r.bucketCounts['snht-only'], 1);
  assert.equal(r.bucketCounts['pettitt-only'], 1);
  assert.equal(r.bucketCounts['no-evidence'], 1);
});

// ---- byJointAlignment sums in joint quadrants ---------------------------

test('classify: byJointAlignment.aligned + misaligned == bothDecisive', () => {
  const r = classify(
    [
      snht('a', 30, 1e-5, 7.8, 10, 2.3),
      snht('b', 30, 1e-5, 7.8, 10, 2.3),
      snht('c', 30, 1e-5, 7.8, 10, 2.3),
    ],
    [
      pettitt('a', 200, 1e-3, 10, 100),
      pettitt('b', 200, 1e-3, 10, 100),
      pettitt('c', 200, 1e-3, 30, 100),
    ],
  );
  assert.equal(r.byJointAlignment.aligned + r.byJointAlignment.misaligned, r.bothDecisive);
});

test('classify: byJointAlignment.anyMissingDecisive sums to non-bothDecisive rows', () => {
  const r = classify(
    [
      snht('a', 30, 1e-5, 7.8, 10, 2.3), // both decisive
      snht('b', 30, 1e-5, 7.8, 10, 2.3), // snht only
      snht('c', 5, 0.5, 8, 10, 0.5), // pettitt only
      snht('d', 5, 0.5, 8, 10, 0.5), // none
    ],
    [
      pettitt('a', 200, 1e-3, 10, 100),
      pettitt('b', 50, 0.5, 10, 50),
      pettitt('c', 200, 1e-3, 10, 100),
      pettitt('d', 50, 0.5, 10, 50),
    ],
  );
  assert.equal(r.byJointAlignment.anyMissingDecisive, 3);
  assert.equal(r.bothDecisive, 1);
});

// ---- summarize formatting ----------------------------------------------

test('summarize: includes alpha, guard, n, bothDecisive, alignment, buckets', () => {
  const r = classify(
    [snht('s', 30, 1e-5, 7.8, 10, 2.3)],
    [pettitt('s', 200, 1e-3, 10, 100)],
  );
  const s = summarize(r);
  assert.match(s, /axis-221xaxis-154/);
  assert.match(s, /alpha=0\.05/);
  assert.match(s, /guard=5/);
  assert.match(s, /n=1/);
  assert.match(s, /both=1\/1/);
  assert.match(s, /align\[a\/m\]=1\/0/);
  assert.match(s, /buckets\[/);
});

// ---- empty returns formatted summary -----------------------------------

test('summarize: empty report formats cleanly', () => {
  const r = classify([], []);
  const s = summarize(r);
  assert.match(s, /n=0/);
  assert.match(s, /both=0\/0/);
});

// ---- joined sources only -----------------------------------------------

test('classify: rows only contain joined sources', () => {
  const r = classify(
    [snht('a', 30, 1e-5, 7.8, 10, 2.3), snht('b', 30, 1e-5, 7.8, 10, 2.3)],
    [pettitt('a', 200, 1e-3, 10, 100), pettitt('c', 200, 1e-3, 10, 100)],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'a');
});
