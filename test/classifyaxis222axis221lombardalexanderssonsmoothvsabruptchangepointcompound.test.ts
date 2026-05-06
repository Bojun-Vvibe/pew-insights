import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  classifyAxis222Axis221LombardAlexanderssonSmoothVsAbruptChangepointCompound,
  summarizeAxis222Axis221LombardSnhtReport,
  type LombardSmoothChangepointRowForSnhtCompound,
  type AlexanderssonSnhtRowForLombardCompound,
} from '../src/classifyaxis222axis221lombardalexanderssonsmoothvsabruptchangepointcompound.js';

function lombard(
  source: string,
  ln: number,
  pApprox: number,
  kStar: number,
  directionSign: number,
  meanShift: number,
): LombardSmoothChangepointRowForSnhtCompound {
  return {
    source,
    lombardLn: ln,
    lombardPApprox: pApprox,
    lombardKStar: kStar,
    lombardDirectionSign: directionSign,
    lombardMeanShift: meanShift,
  };
}

function snht(
  source: string,
  t0: number,
  pApprox: number,
  tCrit05: number,
  aStar: number,
  meanShift: number,
): AlexanderssonSnhtRowForLombardCompound {
  return {
    source,
    snhtT0: t0,
    snhtPApprox: pApprox,
    snhtTCrit05: tCrit05,
    snhtAStar: aStar,
    snhtMeanShift: meanShift,
  };
}

const C =
  classifyAxis222Axis221LombardAlexanderssonSmoothVsAbruptChangepointCompound;

// ---- option validation ---------------------------------------------------

test('compound 222x221: rejects bad alpha', () => {
  assert.throws(() => C([], [], 0));
  assert.throws(() => C([], [], 1));
  assert.throws(() => C([], [], -0.01));
  assert.throws(() => C([], [], NaN));
});

test('compound 222x221: rejects bad proximityGuard', () => {
  assert.throws(() => C([], [], 0.05, -1));
  assert.throws(() => C([], [], 0.05, 1.5));
});

test('compound 222x221: rejects non-array inputs', () => {
  assert.throws(() =>
    // @ts-expect-error
    C(null, []),
  );
  assert.throws(() =>
    // @ts-expect-error
    C([], null),
  );
});

test('compound 222x221: rejects bad lombard row source', () => {
  assert.throws(() =>
    C(
      [{ ...lombard('A', 1, 0.1, 5, 1, 100), source: '' }],
      [],
    ),
  );
});

test('compound 222x221: rejects bad lombard row fields', () => {
  assert.throws(() => C([lombard('A', -1, 0.5, 5, 1, 0)], []));
  assert.throws(() => C([lombard('A', 1, 1.1, 5, 1, 0)], []));
  assert.throws(() => C([lombard('A', 1, 0.5, 1.5, 1, 0)], []));
  assert.throws(() => C([lombard('A', 1, 0.5, 5, 2, 0)], [])); // bad sign
  assert.throws(() => C([lombard('A', 1, 0.5, 5, 1, NaN)], []));
});

test('compound 222x221: rejects bad snht row fields', () => {
  assert.throws(() => C([], [snht('A', -1, 0.5, 1, 5, 0)]));
  assert.throws(() => C([], [snht('A', 1, 1.1, 1, 5, 0)]));
  assert.throws(() => C([], [snht('A', 1, 0.5, 1, 0, 0)])); // aStar < 1
  assert.throws(() => C([], [snht('A', 1, 0.5, 1, 1.5, 0)]));
});

test('compound 222x221: rejects duplicate sources', () => {
  assert.throws(() =>
    C(
      [lombard('A', 1, 0.5, 5, 1, 0), lombard('A', 2, 0.5, 5, 1, 0)],
      [],
    ),
  );
  assert.throws(() =>
    C(
      [],
      [snht('A', 1, 0.5, 1, 5, 0), snht('A', 2, 0.5, 1, 5, 0)],
    ),
  );
});

// ---- empty / asymmetric inputs ------------------------------------------

test('compound 222x221: empty inputs -> empty report', () => {
  const r = C([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.deepEqual(r.bucketCounts, {
    'agree-aligned': 0,
    'agree-misaligned': 0,
    'lombard-only': 0,
    'snht-only': 0,
    'no-evidence': 0,
  });
  assert.deepEqual(r.sourcesOnlyInLombard, []);
  assert.deepEqual(r.sourcesOnlyInSnht, []);
});

test('compound 222x221: asymmetric sources surface in only-lists', () => {
  const r = C(
    [lombard('A', 1, 0.5, 5, 1, 0), lombard('B', 1, 0.5, 5, 1, 0)],
    [snht('B', 1, 0.5, 1, 5, 0), snht('C', 1, 0.5, 1, 5, 0)],
  );
  assert.deepEqual(r.sourcesOnlyInLombard, ['A']);
  assert.deepEqual(r.sourcesOnlyInSnht, ['C']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'B');
});

test('compound 222x221: only-lists are sorted', () => {
  const r = C(
    [
      lombard('Z', 1, 0.5, 5, 1, 0),
      lombard('A', 1, 0.5, 5, 1, 0),
      lombard('M', 1, 0.5, 5, 1, 0),
    ],
    [],
  );
  assert.deepEqual(r.sourcesOnlyInLombard, ['A', 'M', 'Z']);
});

// ---- bucket logic --------------------------------------------------------

test('compound 222x221: agree-aligned bucket', () => {
  const r = C(
    [lombard('A', 5, 0.001, 10, 1, 1000)],
    [snht('A', 30, 0.001, 10, 11, 1000)], // aStar=11 -> zero=10
  );
  assert.equal(r.rows.length, 1);
  const row = r.rows[0]!;
  assert.equal(row.bucket, 'agree-aligned');
  assert.equal(row.jointAlignment, 'aligned');
  assert.equal(row.argmaxDistance, 0);
  assert.equal(row.lombardDecisive, true);
  assert.equal(row.snhtDecisive, true);
  assert.equal(row.signAgreement, true);
  assert.equal(r.bucketCounts['agree-aligned'], 1);
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.bothDecisiveSignAgree, 1);
});

test('compound 222x221: agree-misaligned bucket (large argmax distance)', () => {
  const r = C(
    [lombard('A', 5, 0.001, 5, 1, 1000)],
    [snht('A', 30, 0.001, 10, 60, 1000)], // aStar zero = 59, distance 54
  );
  const row = r.rows[0]!;
  assert.equal(row.bucket, 'agree-misaligned');
  assert.equal(row.jointAlignment, 'misaligned');
  assert.ok(row.argmaxDistance > 5);
});

test('compound 222x221: lombard-only', () => {
  const r = C(
    [lombard('A', 5, 0.001, 10, 1, 1000)],
    [snht('A', 1, 0.5, 10, 11, 0)], // not decisive
  );
  const row = r.rows[0]!;
  assert.equal(row.bucket, 'lombard-only');
  assert.equal(row.jointAlignment, null);
  assert.equal(row.lombardDecisive, true);
  assert.equal(row.snhtDecisive, false);
});

test('compound 222x221: snht-only', () => {
  const r = C(
    [lombard('A', 0.1, 0.5, 10, 1, 0)],
    [snht('A', 30, 0.001, 10, 11, 1000)],
  );
  const row = r.rows[0]!;
  assert.equal(row.bucket, 'snht-only');
  assert.equal(row.lombardDecisive, false);
  assert.equal(row.snhtDecisive, true);
});

test('compound 222x221: snht-only via tCrit05 OR (pApprox >= alpha)', () => {
  // SNHT pApprox = 0.5 (not decisive on p), but T0 >= tCrit05 -> still decisive
  const r = C(
    [lombard('A', 0.1, 0.5, 10, 1, 0)],
    [snht('A', 30, 0.5, 10, 11, 1000)],
  );
  assert.equal(r.rows[0]!.snhtDecisive, true);
  assert.equal(r.rows[0]!.bucket, 'snht-only');
});

test('compound 222x221: no-evidence', () => {
  const r = C(
    [lombard('A', 0.1, 0.5, 10, 0, 0)],
    [snht('A', 1, 0.5, 10, 11, 0)],
  );
  const row = r.rows[0]!;
  assert.equal(row.bucket, 'no-evidence');
  assert.equal(row.jointAlignment, null);
  assert.equal(row.lombardDecisive, false);
  assert.equal(row.snhtDecisive, false);
});

// ---- argmax normalisation ------------------------------------------------

test('compound 222x221: snht 1-based aStar normalised to 0-based', () => {
  // snht aStar=20 -> zero=19; lombard kStar=18; distance=1
  const r = C(
    [lombard('A', 5, 0.001, 18, 1, 1000)],
    [snht('A', 30, 0.001, 10, 20, 1000)],
  );
  const row = r.rows[0]!;
  assert.equal(row.snhtAStarZeroBased, 19);
  assert.equal(row.argmaxDistance, 1);
});

// ---- proximity guard -----------------------------------------------------

test('compound 222x221: proximityGuard 0 -> only exact matches aligned', () => {
  const r = C(
    [
      lombard('A', 5, 0.001, 10, 1, 1000),
      lombard('B', 5, 0.001, 10, 1, 1000),
    ],
    [
      snht('A', 30, 0.001, 10, 11, 1000), // zero=10, dist=0
      snht('B', 30, 0.001, 10, 12, 1000), // zero=11, dist=1
    ],
    0.05,
    0,
  );
  const a = r.rows.find((x) => x.source === 'A')!;
  const b = r.rows.find((x) => x.source === 'B')!;
  assert.equal(a.bucket, 'agree-aligned');
  assert.equal(b.bucket, 'agree-misaligned');
});

test('compound 222x221: large proximityGuard makes everything aligned', () => {
  const r = C(
    [lombard('A', 5, 0.001, 0, 1, 1000)],
    [snht('A', 30, 0.001, 10, 100, 1000)], // zero=99, dist=99
    0.05,
    1000,
  );
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
});

// ---- alpha sensitivity ---------------------------------------------------

test('compound 222x221: alpha=0.01 makes p=0.04 not decisive', () => {
  const r = C(
    [lombard('A', 1, 0.04, 5, 1, 100)],
    [snht('A', 1, 0.04, 10, 6, 100)],
    0.01,
  );
  const row = r.rows[0]!;
  assert.equal(row.lombardDecisive, false);
  // SNHT also not decisive on pApprox; T0=1 < tCrit05=10 so NOT decisive
  assert.equal(row.snhtDecisive, false);
  assert.equal(row.bucket, 'no-evidence');
});

// ---- sign agreement ------------------------------------------------------

test('compound 222x221: signAgreement true when both shifts positive', () => {
  const r = C(
    [lombard('A', 5, 0.001, 10, -1, 5000)], // direction -1 but raw shift +
    [snht('A', 30, 0.001, 10, 11, 5000)],
  );
  const row = r.rows[0]!;
  assert.equal(row.signAgreement, true);
  assert.equal(r.bothDecisiveSignAgree, 1);
  assert.equal(r.bothDecisiveSignDisagree, 0);
});

test('compound 222x221: signAgreement false when shifts disagree', () => {
  const r = C(
    [lombard('A', 5, 0.001, 10, 1, -5000)],
    [snht('A', 30, 0.001, 10, 11, 5000)],
  );
  const row = r.rows[0]!;
  assert.equal(row.signAgreement, false);
  assert.equal(r.bothDecisiveSignDisagree, 1);
});

test('compound 222x221: signAgreement false when one shift is zero', () => {
  const r = C(
    [lombard('A', 5, 0.001, 10, 0, 0)],
    [snht('A', 30, 0.001, 10, 11, 5000)],
  );
  const row = r.rows[0]!;
  assert.equal(row.signAgreement, false);
});

// ---- aggregate counters --------------------------------------------------

test('compound 222x221: aggregate counters sum correctly', () => {
  const r = C(
    [
      lombard('aa', 5, 0.001, 10, 1, 1000), // both decisive aligned
      lombard('am', 5, 0.001, 5, 1, 1000), // both decisive misaligned
      lombard('lo', 5, 0.001, 10, 1, 1000), // lombard-only
      lombard('so', 0.1, 0.5, 10, 1, 0), // snht-only
      lombard('ne', 0.1, 0.5, 10, 0, 0), // no-evidence
    ],
    [
      snht('aa', 30, 0.001, 10, 11, 1000),
      snht('am', 30, 0.001, 10, 60, 1000),
      snht('lo', 1, 0.5, 10, 11, 0),
      snht('so', 30, 0.001, 10, 11, 1000),
      snht('ne', 1, 0.5, 10, 11, 0),
    ],
  );
  assert.equal(r.rows.length, 5);
  assert.equal(r.bothDecisive, 2);
  assert.equal(r.atLeastOneDecisive, 4);
  assert.equal(r.bucketCounts['agree-aligned'], 1);
  assert.equal(r.bucketCounts['agree-misaligned'], 1);
  assert.equal(r.bucketCounts['lombard-only'], 1);
  assert.equal(r.bucketCounts['snht-only'], 1);
  assert.equal(r.bucketCounts['no-evidence'], 1);
  assert.equal(r.byJointAlignment.aligned, 1);
  assert.equal(r.byJointAlignment.misaligned, 1);
  assert.equal(r.byJointAlignment.anyMissingDecisive, 3);
});

test('compound 222x221: rows are sorted by source', () => {
  const r = C(
    [
      lombard('z', 1, 0.5, 5, 0, 0),
      lombard('a', 1, 0.5, 5, 0, 0),
      lombard('m', 1, 0.5, 5, 0, 0),
    ],
    [
      snht('z', 1, 0.5, 10, 6, 0),
      snht('a', 1, 0.5, 10, 6, 0),
      snht('m', 1, 0.5, 10, 6, 0),
    ],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['a', 'm', 'z'],
  );
});

// ---- summarizer ---------------------------------------------------------

test('summarizeAxis222Axis221LombardSnhtReport: shape', () => {
  const r = C(
    [lombard('A', 5, 0.001, 10, 1, 1000)],
    [snht('A', 30, 0.001, 10, 11, 1000)],
  );
  const s = summarizeAxis222Axis221LombardSnhtReport(r);
  assert.match(s, /^axis-222xaxis-221 alpha=0\.05 guard=5 n=1 both=1\/1/);
  assert.match(s, /signAgree=1\/1/);
  assert.match(s, /align\[a\/m\]=1\/0/);
  assert.match(s, /buckets\[aa\/am\/lo\/so\/ne\]=1\/0\/0\/0\/0/);
});

test('summarizeAxis222Axis221LombardSnhtReport: empty', () => {
  const r = C([], []);
  const s = summarizeAxis222Axis221LombardSnhtReport(r);
  assert.match(s, /n=0 both=0\/0/);
  assert.match(s, /buckets\[aa\/am\/lo\/so\/ne\]=0\/0\/0\/0\/0/);
});

// ---- determinism ---------------------------------------------------------

test('compound 222x221: same input -> same output (purity)', () => {
  const lo = [lombard('A', 5, 0.001, 10, 1, 1000), lombard('B', 0.1, 0.5, 5, 0, 0)];
  const sn = [snht('A', 30, 0.001, 10, 11, 1000), snht('B', 1, 0.5, 10, 6, 0)];
  const r1 = C(lo, sn);
  const r2 = C(lo, sn);
  assert.deepEqual(r1, r2);
});
