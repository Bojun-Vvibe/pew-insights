import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  classifyAxis224Axis223KillickPeltInclanTiaoMultipleVsSingleVarianceChangepointCompound as classify,
  summarizeAxis224Axis223PeltIcssReport,
  type InclanTiaoIcssRowForPeltCompound,
  type KillickPeltRowForIcssCompound,
} from '../src/classifyaxis224axis223killickpeltinclantiaomultiplevssinglevariancechangepointcompound.js';

function ic(
  source: string,
  itStat: number,
  pApprox: number,
  kStar: number,
  directionSign: number = 0,
  logVarRatio: number = 0,
): InclanTiaoIcssRowForPeltCompound {
  return {
    source,
    icssItStat: itStat,
    icssPApprox: pApprox,
    icssKCritical05: 1.358,
    icssKStar: kStar,
    icssDirectionSign: directionSign,
    icssLogVarRatio: logVarRatio,
  };
}

function pe(
  source: string,
  m: number,
  taus: number[],
  varRangeRatio = 1,
  costReduction = 0,
  varHomogeneity = 1,
): KillickPeltRowForIcssCompound {
  return {
    source,
    peltMChangepoints: m,
    peltTauStar: taus,
    peltVarRangeRatio: varRangeRatio,
    peltCostReduction: costReduction,
    peltVarHomogeneity: varHomogeneity,
  };
}

// ---- input validation ----------------------------------------------------

test('axis224x223: rejects bad alpha', () => {
  assert.throws(() => classify([], [], 0));
  assert.throws(() => classify([], [], 1));
  assert.throws(() => classify([], [], -0.1));
  assert.throws(() => classify([], [], NaN));
});

test('axis224x223: rejects bad proximityGuard', () => {
  assert.throws(() => classify([], [], 0.05, -1));
  assert.throws(() => classify([], [], 0.05, 1.5));
});

test('axis224x223: rejects non-array inputs', () => {
  assert.throws(() => classify(null as unknown as [], []));
  assert.throws(() => classify([], null as unknown as []));
});

test('axis224x223: rejects bad icss row', () => {
  assert.throws(() =>
    classify([{ ...ic('a', 1, 0.5, 5), source: '' }], []),
  );
  assert.throws(() => classify([{ ...ic('a', -1, 0.5, 5) }], []));
  assert.throws(() => classify([{ ...ic('a', 1, 1.5, 5) }], []));
  assert.throws(() => classify([{ ...ic('a', 1, 0.5, 5), icssDirectionSign: 2 }], []));
});

test('axis224x223: rejects bad pelt row', () => {
  assert.throws(() => classify([], [pe('a', -1, [])]));
  assert.throws(() => classify([], [pe('a', 1, [])])); // length mismatch
  assert.throws(() => classify([], [pe('a', 2, [3, 2])])); // not ascending
  assert.throws(() => classify([], [pe('a', 1, [0])])); // tau < 1
  assert.throws(() => classify([], [pe('a', 0, [], -1)]));
  assert.throws(() => classify([], [pe('a', 0, [], 1, 0, 0)]));
  assert.throws(() => classify([], [pe('a', 0, [], 1, 0, 1.1)]));
});

test('axis224x223: rejects duplicate source', () => {
  assert.throws(() => classify([ic('a', 1, 0.5, 5), ic('a', 2, 0.4, 6)], []));
  assert.throws(() => classify([], [pe('a', 0, []), pe('a', 0, [])]));
});

// ---- bucket logic --------------------------------------------------------

test('axis224x223: no-evidence when neither decisive', () => {
  const r = classify([ic('a', 0.5, 0.9, 5)], [pe('a', 0, [])]);
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.byJointAlignment.anyMissingDecisive, 1);
});

test('axis224x223: pelt-only when only PELT decisive', () => {
  const r = classify([ic('a', 0.5, 0.9, 5)], [pe('a', 1, [10])]);
  assert.equal(r.rows[0]!.bucket, 'pelt-only');
});

test('axis224x223: icss-only when only ICSS decisive', () => {
  const r = classify([ic('a', 2, 0.001, 5)], [pe('a', 0, [])]);
  assert.equal(r.rows[0]!.bucket, 'icss-only');
});

test('axis224x223: agree-aligned when both decisive and within guard', () => {
  const r = classify([ic('a', 2, 0.001, 10)], [pe('a', 1, [12])]);
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
  assert.equal(r.rows[0]!.jointAlignment, 'aligned');
  assert.equal(r.rows[0]!.argmaxDistance, 2);
});

test('axis224x223: agree-misaligned when both decisive but outside guard', () => {
  const r = classify([ic('a', 2, 0.001, 10)], [pe('a', 1, [50])]);
  assert.equal(r.rows[0]!.bucket, 'agree-misaligned');
  assert.equal(r.rows[0]!.jointAlignment, 'misaligned');
});

test('axis224x223: nearest-neighbour distance over multiple PELT taus', () => {
  // ICSS kStar=10; PELT taus=[2, 25, 60]; nearest is 2 (distance 8)
  const r = classify([ic('a', 2, 0.001, 10)], [pe('a', 3, [2, 25, 60])]);
  assert.equal(r.rows[0]!.argmaxDistance, 8);
  // distance 8 > 5 default guard => misaligned
  assert.equal(r.rows[0]!.bucket, 'agree-misaligned');
});

test('axis224x223: multiRegimeOverIcss flag set when both decisive and m>=2', () => {
  const r = classify([ic('a', 2, 0.001, 10)], [pe('a', 3, [2, 12, 60])]);
  assert.equal(r.rows[0]!.multiRegimeOverIcss, true);
  assert.equal(r.bothDecisiveMultiRegime, 1);
  assert.equal(r.bothDecisiveSingleRegime, 0);
});

test('axis224x223: multiRegimeOverIcss false when m=1', () => {
  const r = classify([ic('a', 2, 0.001, 10)], [pe('a', 1, [12])]);
  assert.equal(r.rows[0]!.multiRegimeOverIcss, false);
  assert.equal(r.bothDecisiveSingleRegime, 1);
});

test('axis224x223: argmaxDistance is MAX_SAFE_INTEGER when peltTauStar empty', () => {
  const r = classify([ic('a', 2, 0.001, 10)], [pe('a', 0, [])]);
  assert.equal(r.rows[0]!.argmaxDistance, Number.MAX_SAFE_INTEGER);
});

// ---- ICSS decisiveness via critical-value OR ---------------------------

test('axis224x223: ICSS decisive via itStat>=kCritical05 even if pApprox>=alpha', () => {
  // pApprox = 0.06 (not < 0.05), but itStat = 1.5 >= 1.358
  const r = classify([ic('a', 1.5, 0.06, 10)], [pe('a', 1, [12])]);
  assert.equal(r.rows[0]!.icssDecisive, true);
});

// ---- joining and missing sources ---------------------------------------

test('axis224x223: surfaces sources only in one input', () => {
  const r = classify(
    [ic('a', 1, 0.5, 5), ic('b', 2, 0.001, 10)],
    [pe('a', 0, []), pe('c', 1, [3])],
  );
  assert.deepEqual(r.sourcesOnlyInIcss, ['b']);
  assert.deepEqual(r.sourcesOnlyInPelt, ['c']);
  // only 'a' is joined
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'a');
});

test('axis224x223: rows sorted by source ascending', () => {
  const r = classify(
    [ic('z', 1, 0.5, 5), ic('a', 1, 0.5, 5), ic('m', 1, 0.5, 5)],
    [pe('z', 0, []), pe('a', 0, []), pe('m', 0, [])],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['a', 'm', 'z'],
  );
});

// ---- aggregate counts --------------------------------------------------

test('axis224x223: bucketCounts sum to rows.length', () => {
  const icss = [
    ic('a', 0.5, 0.9, 5), // no evidence
    ic('b', 2, 0.001, 10), // both
    ic('c', 0.5, 0.9, 5), // pelt-only
    ic('d', 2, 0.001, 10), // icss-only
  ];
  const pelt = [
    pe('a', 0, []),
    pe('b', 1, [12]),
    pe('c', 1, [10]),
    pe('d', 0, []),
  ];
  const r = classify(icss, pelt);
  const sum = Object.values(r.bucketCounts).reduce((s, x) => s + x, 0);
  assert.equal(sum, r.rows.length);
  assert.equal(r.rows.length, 4);
});

test('axis224x223: bothDecisive <= atLeastOneDecisive <= rows.length', () => {
  const icss = [
    ic('a', 2, 0.001, 5),
    ic('b', 0.5, 0.5, 5),
    ic('c', 2, 0.001, 5),
  ];
  const pelt = [pe('a', 1, [5]), pe('b', 1, [5]), pe('c', 0, [])];
  const r = classify(icss, pelt);
  assert.ok(r.bothDecisive <= r.atLeastOneDecisive);
  assert.ok(r.atLeastOneDecisive <= r.rows.length);
});

test('axis224x223: deterministic across repeated runs', () => {
  const icss = [ic('a', 2, 0.001, 10), ic('b', 0.5, 0.9, 5)];
  const pelt = [pe('a', 2, [12, 30]), pe('b', 1, [10])];
  const a = classify(icss, pelt);
  const b = classify(icss, pelt);
  assert.deepEqual(a, b);
});

test('axis224x223: tauStar is defensively cloned in output', () => {
  const taus = [10, 20];
  const r = classify([ic('a', 2, 0.001, 5)], [pe('a', 2, taus)]);
  r.rows[0]!.peltTauStar.push(99);
  assert.equal(taus.length, 2);
});

// ---- summary -------------------------------------------------------------

test('axis224x223: summarize produces deterministic non-empty string', () => {
  const r = classify([ic('a', 2, 0.001, 10)], [pe('a', 1, [12])]);
  const s = summarizeAxis224Axis223PeltIcssReport(r);
  assert.ok(s.length > 0);
  assert.ok(s.includes('axis-224xaxis-223'));
  assert.ok(s.includes('buckets'));
});
