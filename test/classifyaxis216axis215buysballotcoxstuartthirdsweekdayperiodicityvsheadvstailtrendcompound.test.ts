import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAxis216Axis215BuysBallotCoxStuartThirdsWeekdayPeriodicityVsHeadVsTailTrendCompound,
  summarizeAxis216Axis215BuysBallotCoxStuartThirdsReport,
} from '../src/classifyaxis216axis215buysballotcoxstuartthirdsweekdayperiodicityvsheadvstailtrendcompound.js';

const FN = classifyAxis216Axis215BuysBallotCoxStuartThirdsWeekdayPeriodicityVsHeadVsTailTrendCompound;

// ---------- input validation ----------

test('alpha out of range -> throw', () => {
  assert.throws(() => FN([], [], 0));
  assert.throws(() => FN([], [], -0.01));
  assert.throws(() => FN([], [], 0.51));
  assert.throws(() => FN([], [], Number.NaN));
  assert.throws(() => FN([], [], Number.POSITIVE_INFINITY));
});

test('default alpha = 0.05', () => {
  const r = FN([], []);
  assert.equal(r.alpha, 0.05);
});

test('valid alpha boundaries (0, 0.5]', () => {
  const r1 = FN([], [], 0.001);
  assert.equal(r1.alpha, 0.001);
  const r2 = FN([], [], 0.5);
  assert.equal(r2.alpha, 0.5);
});

test('empty inputs -> empty report', () => {
  const r = FN([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.sourcesOnlyInBuysBallot.length, 0);
  assert.equal(r.sourcesOnlyInCoxStuartThirds.length, 0);
});

test('bb row with empty source -> throw', () => {
  assert.throws(() =>
    FN(
      [{ source: '', bbF: 1, bbEta2: 0.1, bbPValue: 0.5 }],
      [],
    ),
  );
});

test('csT row with empty source -> throw', () => {
  assert.throws(() =>
    FN([], [{ source: '', csTZ: 0.5, csTPValue: 0.5 }]),
  );
});

test('bb row with negative bbF -> throw', () => {
  assert.throws(() =>
    FN(
      [{ source: 'a', bbF: -1, bbEta2: 0.1, bbPValue: 0.5 }],
      [],
    ),
  );
});

test('bb row with non-finite bbF -> throw', () => {
  assert.throws(() =>
    FN(
      [{ source: 'a', bbF: Number.NaN, bbEta2: 0.1, bbPValue: 0.5 }],
      [],
    ),
  );
});

test('bb row with bbEta2 > 1 -> throw', () => {
  assert.throws(() =>
    FN(
      [{ source: 'a', bbF: 1, bbEta2: 1.5, bbPValue: 0.5 }],
      [],
    ),
  );
});

test('bb row with bbEta2 < 0 -> throw', () => {
  assert.throws(() =>
    FN(
      [{ source: 'a', bbF: 1, bbEta2: -0.1, bbPValue: 0.5 }],
      [],
    ),
  );
});

test('bb row with bbPValue > 1 -> throw', () => {
  assert.throws(() =>
    FN(
      [{ source: 'a', bbF: 1, bbEta2: 0.1, bbPValue: 1.1 }],
      [],
    ),
  );
});

test('bb row with bbPValue < 0 -> throw', () => {
  assert.throws(() =>
    FN(
      [{ source: 'a', bbF: 1, bbEta2: 0.1, bbPValue: -0.1 }],
      [],
    ),
  );
});

test('bb row with bbPValue = 0 -> accepted (perfect period)', () => {
  const r = FN(
    [{ source: 'a', bbF: Number.POSITIVE_INFINITY, bbEta2: 1, bbPValue: 0 }],
    [{ source: 'a', csTZ: 0.5, csTPValue: 0.5 }],
  );
  assert.equal(r.rows.length, 1);
});

test('csT row with non-finite csTZ -> throw', () => {
  assert.throws(() =>
    FN([], [{ source: 'a', csTZ: Number.NaN, csTPValue: 0.5 }]),
  );
});

test('csT row with csTPValue <= 0 -> throw', () => {
  assert.throws(() =>
    FN([], [{ source: 'a', csTZ: 0.5, csTPValue: 0 }]),
  );
});

test('csT row with csTPValue > 1 -> throw', () => {
  assert.throws(() =>
    FN([], [{ source: 'a', csTZ: 0.5, csTPValue: 1.1 }]),
  );
});

test('duplicate bb source -> throw', () => {
  assert.throws(() =>
    FN(
      [
        { source: 'a', bbF: 1, bbEta2: 0.1, bbPValue: 0.5 },
        { source: 'a', bbF: 2, bbEta2: 0.2, bbPValue: 0.4 },
      ],
      [],
    ),
  );
});

test('duplicate csT source -> throw', () => {
  assert.throws(() =>
    FN(
      [],
      [
        { source: 'a', csTZ: 0.5, csTPValue: 0.5 },
        { source: 'a', csTZ: 0.6, csTPValue: 0.4 },
      ],
    ),
  );
});

// ---------- 6-bucket coverage (cross-product) ----------

const ALPHA = 0.05;

function bb(source: string, p: number, F = 5, eta2 = 0.3) {
  return { source, bbF: F, bbEta2: eta2, bbPValue: p };
}
function csT(source: string, z: number, p: number) {
  return { source, csTZ: z, csTPValue: p };
}

test('bucket: weekday-and-up-drift (both decisive, csTZ > 0)', () => {
  const r = FN([bb('a', 0.001)], [csT('a', 3.5, 0.0001)], ALPHA);
  assert.equal(r.rows[0]!.bucket, 'weekday-and-up-drift');
  assert.equal(r.rows[0]!.jointQuadrant, 'weekdayUp');
  assert.equal(r.bucketCounts['weekday-and-up-drift'], 1);
  assert.equal(r.byJointQuadrant.weekdayUp, 1);
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.atLeastOneDecisive, 1);
});

test('bucket: weekday-and-down-drift (both decisive, csTZ < 0)', () => {
  const r = FN([bb('a', 0.001)], [csT('a', -3.5, 0.0001)], ALPHA);
  assert.equal(r.rows[0]!.bucket, 'weekday-and-down-drift');
  assert.equal(r.rows[0]!.jointQuadrant, 'weekdayDown');
  assert.equal(r.bucketCounts['weekday-and-down-drift'], 1);
  assert.equal(r.byJointQuadrant.weekdayDown, 1);
  assert.equal(r.bothDecisive, 1);
});

test('bucket: weekday-only (bb decisive, csT not)', () => {
  const r = FN([bb('a', 0.001)], [csT('a', 0.5, 0.5)], ALPHA);
  assert.equal(r.rows[0]!.bucket, 'weekday-only');
  assert.equal(r.rows[0]!.jointQuadrant, null);
  assert.equal(r.bucketCounts['weekday-only'], 1);
  assert.equal(r.byJointQuadrant.anyMissingDecisive, 1);
  assert.equal(r.atLeastOneDecisive, 1);
  assert.equal(r.bothDecisive, 0);
});

test('bucket: up-drift-only (csT decisive up, bb not)', () => {
  const r = FN([bb('a', 0.5)], [csT('a', 3.0, 0.001)], ALPHA);
  assert.equal(r.rows[0]!.bucket, 'up-drift-only');
  assert.equal(r.bucketCounts['up-drift-only'], 1);
  assert.equal(r.byJointQuadrant.anyMissingDecisive, 1);
});

test('bucket: down-drift-only (csT decisive down, bb not)', () => {
  const r = FN([bb('a', 0.5)], [csT('a', -3.0, 0.001)], ALPHA);
  assert.equal(r.rows[0]!.bucket, 'down-drift-only');
  assert.equal(r.bucketCounts['down-drift-only'], 1);
});

test('bucket: no-evidence (neither decisive)', () => {
  const r = FN([bb('a', 0.5)], [csT('a', 0.3, 0.7)], ALPHA);
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bucketCounts['no-evidence'], 1);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
});

// ---------- decisiveness boundaries ----------

test('bb at exactly alpha = NOT decisive (strict <)', () => {
  const r = FN([bb('a', 0.05)], [csT('a', 0.5, 0.5)], 0.05);
  assert.equal(r.rows[0]!.bbDecisive, false);
});

test('bb just below alpha = decisive', () => {
  const r = FN([bb('a', 0.0499)], [csT('a', 0.5, 0.5)], 0.05);
  assert.equal(r.rows[0]!.bbDecisive, true);
});

test('csT at exactly alpha = NOT decisive (strict <)', () => {
  const r = FN([bb('a', 0.5)], [csT('a', 1.96, 0.05)], 0.05);
  assert.equal(r.rows[0]!.csTDecisive, false);
});

test('csT just below alpha = decisive', () => {
  const r = FN([bb('a', 0.5)], [csT('a', 1.96, 0.0499)], 0.05);
  assert.equal(r.rows[0]!.csTDecisive, true);
});

test('alpha = 0.01 narrows decisive set vs alpha = 0.10', () => {
  const r10 = FN([bb('a', 0.05)], [csT('a', 1.5, 0.05)], 0.10);
  const r01 = FN([bb('a', 0.05)], [csT('a', 1.5, 0.05)], 0.01);
  assert.equal(r10.rows[0]!.bbDecisive, true);
  assert.equal(r01.rows[0]!.bbDecisive, false);
});

// ---------- csTZ exactly 0 convention ----------

test('csTZ = 0 with csTDecisive = true => up-drift bucket (csTZ >= 0 convention)', () => {
  // (Pathological since csTZ=0 implies p=1 normally; but tested for completeness.)
  const r = FN([bb('a', 0.5)], [csT('a', 0, 0.001)], ALPHA);
  assert.equal(r.rows[0]!.bucket, 'up-drift-only');
});

test('csTZ slightly positive => up', () => {
  const r = FN([bb('a', 0.5)], [csT('a', 1e-6, 0.001)], ALPHA);
  assert.equal(r.rows[0]!.bucket, 'up-drift-only');
});

test('csTZ slightly negative => down', () => {
  const r = FN([bb('a', 0.5)], [csT('a', -1e-6, 0.001)], ALPHA);
  assert.equal(r.rows[0]!.bucket, 'down-drift-only');
});

// ---------- joining and missing sources ----------

test('source only in bb -> sourcesOnlyInBuysBallot', () => {
  const r = FN([bb('a', 0.001), bb('b', 0.5)], [csT('a', 1.0, 0.3)], ALPHA);
  assert.deepEqual(r.sourcesOnlyInBuysBallot, ['b']);
  assert.equal(r.sourcesOnlyInCoxStuartThirds.length, 0);
  assert.equal(r.rows.length, 1);
});

test('source only in csT -> sourcesOnlyInCoxStuartThirds', () => {
  const r = FN([bb('a', 0.001)], [csT('a', 1.0, 0.3), csT('c', 2.0, 0.04)], ALPHA);
  assert.deepEqual(r.sourcesOnlyInCoxStuartThirds, ['c']);
});

test('multiple sources only on each side, lexicographically sorted', () => {
  const r = FN(
    [bb('a', 0.5), bb('z', 0.5), bb('m', 0.5)],
    [csT('b', 0.5, 0.5), csT('a', 0.5, 0.5)],
    ALPHA,
  );
  assert.deepEqual(r.sourcesOnlyInBuysBallot, ['m', 'z']);
  assert.deepEqual(r.sourcesOnlyInCoxStuartThirds, ['b']);
});

test('joined rows are returned in lexicographic source order', () => {
  const r = FN(
    [bb('z', 0.001), bb('a', 0.001), bb('m', 0.001)],
    [csT('a', 1, 0.3), csT('z', -1, 0.3), csT('m', 0, 0.3)],
    ALPHA,
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['a', 'm', 'z'],
  );
});

test('row preserves all axis-216 fields', () => {
  const r = FN(
    [{ source: 'a', bbF: 7.5, bbEta2: 0.42, bbPValue: 0.001 }],
    [csT('a', 2.1, 0.04)],
    ALPHA,
  );
  assert.equal(r.rows[0]!.bbF, 7.5);
  assert.equal(r.rows[0]!.bbEta2, 0.42);
  assert.equal(r.rows[0]!.bbPValue, 0.001);
});

test('row preserves all axis-215 fields and csTUpDriftSignal = csTZ', () => {
  const r = FN([bb('a', 0.5)], [csT('a', -1.7, 0.04)], ALPHA);
  assert.equal(r.rows[0]!.csTZ, -1.7);
  assert.equal(r.rows[0]!.csTPValue, 0.04);
  assert.equal(r.rows[0]!.csTUpDriftSignal, -1.7);
});

// ---------- bucket-count totals invariant ----------

test('sum of bucketCounts == rows.length always', () => {
  const r = FN(
    [bb('a', 0.001), bb('b', 0.5), bb('c', 0.001), bb('d', 0.5)],
    [csT('a', 3, 0.001), csT('b', 3, 0.001), csT('c', 0.5, 0.5), csT('d', 0.5, 0.5)],
    ALPHA,
  );
  let s = 0;
  for (const k of Object.keys(r.bucketCounts) as Array<keyof typeof r.bucketCounts>) {
    s += r.bucketCounts[k];
  }
  assert.equal(s, r.rows.length);
});

test('byJointQuadrant.{weekdayUp+weekdayDown+anyMissingDecisive} == rows.length', () => {
  const r = FN(
    [bb('a', 0.001), bb('b', 0.5), bb('c', 0.001), bb('d', 0.5)],
    [csT('a', 3, 0.001), csT('b', 3, 0.001), csT('c', 0.5, 0.5), csT('d', 0.5, 0.5)],
    ALPHA,
  );
  const total =
    r.byJointQuadrant.weekdayUp +
    r.byJointQuadrant.weekdayDown +
    r.byJointQuadrant.anyMissingDecisive;
  assert.equal(total, r.rows.length);
});

test('bothDecisive == sum(weekday-and-* buckets)', () => {
  const r = FN(
    [bb('a', 0.001), bb('b', 0.001), bb('c', 0.5)],
    [csT('a', 3, 0.001), csT('b', -3, 0.001), csT('c', 3, 0.001)],
    ALPHA,
  );
  assert.equal(
    r.bothDecisive,
    r.bucketCounts['weekday-and-up-drift'] + r.bucketCounts['weekday-and-down-drift'],
  );
});

test('atLeastOneDecisive == rows.length - no-evidence', () => {
  const r = FN(
    [bb('a', 0.001), bb('b', 0.5), bb('c', 0.5), bb('d', 0.5)],
    [csT('a', 3, 0.001), csT('b', 3, 0.001), csT('c', 0.5, 0.5), csT('d', -3, 0.001)],
    ALPHA,
  );
  assert.equal(r.atLeastOneDecisive, r.rows.length - r.bucketCounts['no-evidence']);
});

// ---------- larger cross-product (5x5 or so) ----------

test('5-source cross-product hits multiple buckets', () => {
  const r = FN(
    [
      bb('s1', 0.001), // bb decisive
      bb('s2', 0.001),
      bb('s3', 0.5),
      bb('s4', 0.5),
      bb('s5', 0.5),
    ],
    [
      csT('s1', 3, 0.001),
      csT('s2', -3, 0.001),
      csT('s3', 3, 0.001),
      csT('s4', -3, 0.001),
      csT('s5', 0.5, 0.5),
    ],
    ALPHA,
  );
  assert.equal(r.rows.length, 5);
  assert.equal(r.bucketCounts['weekday-and-up-drift'], 1);
  assert.equal(r.bucketCounts['weekday-and-down-drift'], 1);
  assert.equal(r.bucketCounts['up-drift-only'], 1);
  assert.equal(r.bucketCounts['down-drift-only'], 1);
  assert.equal(r.bucketCounts['no-evidence'], 1);
  assert.equal(r.bucketCounts['weekday-only'], 0);
});

test('all 6 buckets reachable in single classification', () => {
  const r = FN(
    [
      bb('a', 0.001),
      bb('b', 0.001),
      bb('c', 0.001),
      bb('d', 0.5),
      bb('e', 0.5),
      bb('f', 0.5),
    ],
    [
      csT('a', 3, 0.001),
      csT('b', -3, 0.001),
      csT('c', 0.5, 0.5),
      csT('d', 3, 0.001),
      csT('e', -3, 0.001),
      csT('f', 0.5, 0.5),
    ],
    ALPHA,
  );
  for (const k of [
    'weekday-and-up-drift',
    'weekday-and-down-drift',
    'weekday-only',
    'up-drift-only',
    'down-drift-only',
    'no-evidence',
  ] as const) {
    assert.equal(r.bucketCounts[k], 1, `bucket ${k} not reached`);
  }
});

// ---------- jointQuadrant null when not bothDecisive ----------

test('jointQuadrant is null for weekday-only', () => {
  const r = FN([bb('a', 0.001)], [csT('a', 0.5, 0.5)], ALPHA);
  assert.equal(r.rows[0]!.jointQuadrant, null);
});

test('jointQuadrant is null for up-drift-only', () => {
  const r = FN([bb('a', 0.5)], [csT('a', 3, 0.001)], ALPHA);
  assert.equal(r.rows[0]!.jointQuadrant, null);
});

test('jointQuadrant is null for down-drift-only', () => {
  const r = FN([bb('a', 0.5)], [csT('a', -3, 0.001)], ALPHA);
  assert.equal(r.rows[0]!.jointQuadrant, null);
});

test('jointQuadrant is null for no-evidence', () => {
  const r = FN([bb('a', 0.5)], [csT('a', 0.5, 0.5)], ALPHA);
  assert.equal(r.rows[0]!.jointQuadrant, null);
});

test('jointQuadrant is weekdayUp for weekday-and-up-drift', () => {
  const r = FN([bb('a', 0.001)], [csT('a', 3, 0.001)], ALPHA);
  assert.equal(r.rows[0]!.jointQuadrant, 'weekdayUp');
});

test('jointQuadrant is weekdayDown for weekday-and-down-drift', () => {
  const r = FN([bb('a', 0.001)], [csT('a', -3, 0.001)], ALPHA);
  assert.equal(r.rows[0]!.jointQuadrant, 'weekdayDown');
});

// ---------- full cross-product alpha sensitivity (5 alphas x sample data) ----------

test('alpha sensitivity: tightening alpha demotes weekday-and-up to up-drift-only', () => {
  // bbPValue = 0.04 is decisive at alpha=0.05 but NOT at alpha=0.01.
  const rLoose = FN([bb('a', 0.04)], [csT('a', 3, 0.001)], 0.05);
  const rTight = FN([bb('a', 0.04)], [csT('a', 3, 0.001)], 0.01);
  assert.equal(rLoose.rows[0]!.bucket, 'weekday-and-up-drift');
  assert.equal(rTight.rows[0]!.bucket, 'up-drift-only');
});

test('alpha sensitivity: tightening alpha demotes both-decisive to no-evidence', () => {
  const rLoose = FN([bb('a', 0.04)], [csT('a', 1.5, 0.04)], 0.05);
  const rTight = FN([bb('a', 0.04)], [csT('a', 1.5, 0.04)], 0.001);
  assert.equal(rLoose.rows[0]!.bucket, 'weekday-and-up-drift');
  assert.equal(rTight.rows[0]!.bucket, 'no-evidence');
});

// ---------- summarize ----------

test('summarize: empty report', () => {
  const s = summarizeAxis216Axis215BuysBallotCoxStuartThirdsReport(FN([], []));
  assert.match(s, /^axis-216xaxis-215 alpha=0\.05 n=0 both=0\/0 /);
  assert.match(s, /jq\[wUp\/wDn\]=0\/0/);
  assert.match(s, /buckets\[wUp\/wDn\/wo\/upo\/dno\/ne\]=0\/0\/0\/0\/0\/0$/);
});

test('summarize: includes alpha non-default', () => {
  const r = FN([], [], 0.01);
  const s = summarizeAxis216Axis215BuysBallotCoxStuartThirdsReport(r);
  assert.match(s, /alpha=0\.01/);
});

test('summarize: counts 6-bucket fully-populated cross-product', () => {
  const r = FN(
    [
      bb('a', 0.001),
      bb('b', 0.001),
      bb('c', 0.001),
      bb('d', 0.5),
      bb('e', 0.5),
      bb('f', 0.5),
    ],
    [
      csT('a', 3, 0.001),
      csT('b', -3, 0.001),
      csT('c', 0.5, 0.5),
      csT('d', 3, 0.001),
      csT('e', -3, 0.001),
      csT('f', 0.5, 0.5),
    ],
    0.05,
  );
  const s = summarizeAxis216Axis215BuysBallotCoxStuartThirdsReport(r);
  assert.match(s, /n=6 both=2\/6/);
  assert.match(s, /jq\[wUp\/wDn\]=1\/1/);
  assert.match(s, /buckets\[wUp\/wDn\/wo\/upo\/dno\/ne\]=1\/1\/1\/1\/1\/1$/);
});

test('summarize is deterministic / pure (no I/O)', () => {
  const r = FN([bb('a', 0.001)], [csT('a', 3, 0.001)]);
  const s1 = summarizeAxis216Axis215BuysBallotCoxStuartThirdsReport(r);
  const s2 = summarizeAxis216Axis215BuysBallotCoxStuartThirdsReport(r);
  assert.equal(s1, s2);
});

// ---------- comprehensive bucket-permutation coverage (32 cases) ----------

const bbStates: Array<[string, number]> = [
  ['decisive', 0.001],
  ['nondecisive', 0.5],
];
const csTStates: Array<[string, number, number]> = [
  ['decisive-up', 2.5, 0.0124],
  ['decisive-down', -2.5, 0.0124],
  ['nondecisive-up', 0.5, 0.6],
  ['nondecisive-down', -0.5, 0.6],
];

function expectedBucket(
  bbDec: string,
  csTState: string,
): string {
  const dec = bbDec === 'decisive';
  const csTDec = csTState.startsWith('decisive');
  const csTUp = csTState.endsWith('up');
  if (!dec && !csTDec) return 'no-evidence';
  if (dec && !csTDec) return 'weekday-only';
  if (!dec && csTDec) return csTUp ? 'up-drift-only' : 'down-drift-only';
  return csTUp ? 'weekday-and-up-drift' : 'weekday-and-down-drift';
}

for (const [bbName, bbP] of bbStates) {
  for (const [csName, z, p] of csTStates) {
    test(`cross-product: bb=${bbName} csT=${csName} -> bucket=${expectedBucket(bbName, csName)}`, () => {
      const r = FN([bb('a', bbP)], [csT('a', z, p)], ALPHA);
      assert.equal(r.rows[0]!.bucket, expectedBucket(bbName, csName));
    });
  }
}

// ---------- multi-source bucket-count sanity ----------

test('100-source synthetic: bucket counts add up', () => {
  const bbs = [];
  const csts = [];
  for (let i = 0; i < 100; i += 1) {
    bbs.push(bb(`s${String(i).padStart(3, '0')}`, i % 2 === 0 ? 0.001 : 0.5));
    csts.push(
      csT(
        `s${String(i).padStart(3, '0')}`,
        i % 4 < 2 ? 1.5 + (i % 4) : -1.5 - (i % 4),
        i % 3 === 0 ? 0.001 : 0.5,
      ),
    );
  }
  const r = FN(bbs, csts, ALPHA);
  assert.equal(r.rows.length, 100);
  let sum = 0;
  for (const k of Object.keys(r.bucketCounts) as Array<keyof typeof r.bucketCounts>) {
    sum += r.bucketCounts[k];
  }
  assert.equal(sum, 100);
});
