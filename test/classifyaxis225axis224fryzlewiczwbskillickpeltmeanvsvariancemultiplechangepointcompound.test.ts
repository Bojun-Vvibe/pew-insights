import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  classifyAxis225Axis224FryzlewiczWbsKillickPeltMeanVsVarianceMultipleChangepointCompound,
  type FryzlewiczWbsRowForPeltCompound,
  type KillickPeltRowForWbsCompound,
} from '../src/classifyaxis225axis224fryzlewiczwbskillickpeltmeanvsvariancemultiplechangepointcompound.js';

function w(
  source: string,
  wbsM: number,
  wbsTauStar: number[],
  opts: Partial<FryzlewiczWbsRowForPeltCompound> = {},
): FryzlewiczWbsRowForPeltCompound {
  return {
    source,
    wbsM,
    wbsTauStar,
    wbsMaxAbsCusum: opts.wbsMaxAbsCusum ?? 100,
    wbsThreshold: opts.wbsThreshold ?? 50,
    wbsMeanRangeRatio: opts.wbsMeanRangeRatio ?? 1.5,
    wbsMeanHomogeneity: opts.wbsMeanHomogeneity ?? 0.5,
  };
}

function p(
  source: string,
  peltM: number,
  peltTauStar: number[],
  opts: Partial<KillickPeltRowForWbsCompound> = {},
): KillickPeltRowForWbsCompound {
  return {
    source,
    peltM,
    peltTauStar,
    peltVarRangeRatio: opts.peltVarRangeRatio ?? 1.2,
    peltCostReduction: opts.peltCostReduction ?? 5,
    peltVarHomogeneity: opts.peltVarHomogeneity ?? 0.6,
  };
}

const fn =
  classifyAxis225Axis224FryzlewiczWbsKillickPeltMeanVsVarianceMultipleChangepointCompound;

// ---- argument validation -------------------------------------------------

test('axis-225 x axis-224: rejects bad proximityGuard', () => {
  assert.throws(() => fn([], [], -1));
  assert.throws(() => fn([], [], 1.5));
  assert.throws(() => fn([], [], NaN));
});

test('axis-225 x axis-224: rejects non-array inputs', () => {
  assert.throws(() => fn(null as unknown as [], []));
  assert.throws(() => fn([], null as unknown as []));
});

test('axis-225 x axis-224: rejects invalid wbs row', () => {
  assert.throws(() =>
    fn(
      [{ ...w('a', 0, []), wbsM: -1 } as FryzlewiczWbsRowForPeltCompound],
      [],
    ),
  );
  assert.throws(() =>
    fn(
      [{ ...w('a', 1, [10]), wbsTauStar: [] } as FryzlewiczWbsRowForPeltCompound],
      [],
    ),
  );
  assert.throws(() =>
    fn([{ ...w('a', 1, [0]) } as FryzlewiczWbsRowForPeltCompound], []),
  );
  assert.throws(() => fn([w('a', 2, [10, 5])], []));
  assert.throws(() => fn([w('', 0, [])], []));
  assert.throws(() =>
    fn(
      [
        { ...w('a', 0, []), wbsMeanHomogeneity: 1.5 } as
          FryzlewiczWbsRowForPeltCompound,
      ],
      [],
    ),
  );
});

test('axis-225 x axis-224: rejects duplicate sources', () => {
  assert.throws(() => fn([w('a', 0, []), w('a', 0, [])], []));
  assert.throws(() => fn([], [p('a', 0, []), p('a', 0, [])]));
});

test('axis-225 x axis-224: rejects invalid pelt row', () => {
  assert.throws(() =>
    fn([], [{ ...p('a', 0, []), peltM: -1 } as KillickPeltRowForWbsCompound]),
  );
  assert.throws(() => fn([], [p('a', 1, [0])]));
  assert.throws(() => fn([], [p('a', 2, [10, 5])]));
});

// ---- semantics -----------------------------------------------------------

test('axis-225 x axis-224: empty inputs => zero counts', () => {
  const r = fn([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.proximityGuard, 5);
  assert.equal(r.sourcesOnlyInWbs.length, 0);
  assert.equal(r.sourcesOnlyInPelt.length, 0);
});

test('axis-225 x axis-224: agree-aligned when both fire and CPs proximate', () => {
  const r = fn(
    [w('s1', 1, [30])],
    [p('s1', 1, [32])],
    5,
  );
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
  assert.equal(r.rows[0]!.jointAlignment, 'aligned');
  assert.equal(r.rows[0]!.nearestPairDistance, 2);
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.byJointAlignment.aligned, 1);
});

test('axis-225 x axis-224: agree-misaligned when both fire but CPs distant', () => {
  const r = fn([w('s1', 1, [10])], [p('s1', 1, [80])], 5);
  assert.equal(r.rows[0]!.bucket, 'agree-misaligned');
  assert.equal(r.rows[0]!.jointAlignment, 'misaligned');
  assert.equal(r.rows[0]!.nearestPairDistance, 70);
  assert.equal(r.byJointAlignment.misaligned, 1);
});

test('axis-225 x axis-224: wbs-only when only WBS decisive', () => {
  const r = fn([w('s1', 2, [10, 30])], [p('s1', 0, [])]);
  assert.equal(r.rows[0]!.bucket, 'wbs-only');
  assert.equal(r.rows[0]!.jointAlignment, null);
  assert.equal(r.rows[0]!.nearestPairDistance, Number.MAX_SAFE_INTEGER);
});

test('axis-225 x axis-224: pelt-only when only PELT decisive', () => {
  const r = fn([w('s1', 0, [])], [p('s1', 1, [40])]);
  assert.equal(r.rows[0]!.bucket, 'pelt-only');
  assert.equal(r.rows[0]!.jointAlignment, null);
});

test('axis-225 x axis-224: no-evidence when neither fires', () => {
  const r = fn([w('s1', 0, [])], [p('s1', 0, [])]);
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.rows[0]!.jointAlignment, null);
  assert.equal(r.atLeastOneDecisive, 0);
});

test('axis-225 x axis-224: nearestPairDistance is min over all pairs', () => {
  const r = fn(
    [w('s1', 3, [10, 50, 80])],
    [p('s1', 2, [60, 100])],
    5,
  );
  // distances: |10-60|=50, |10-100|=90, |50-60|=10, |50-100|=50, |80-60|=20, |80-100|=20
  // min = 10, > guard 5 => misaligned
  assert.equal(r.rows[0]!.nearestPairDistance, 10);
  assert.equal(r.rows[0]!.bucket, 'agree-misaligned');
});

test('axis-225 x axis-224: proximityGuard=0 forces exact match', () => {
  const r1 = fn([w('s1', 1, [40])], [p('s1', 1, [40])], 0);
  assert.equal(r1.rows[0]!.bucket, 'agree-aligned');
  const r2 = fn([w('s1', 1, [40])], [p('s1', 1, [41])], 0);
  assert.equal(r2.rows[0]!.bucket, 'agree-misaligned');
});

test('axis-225 x axis-224: bucket counts and partition invariants', () => {
  const wbs = [
    w('a', 1, [30]), // agree-aligned with p(a,1,[31])
    w('b', 2, [10, 80]), // agree-misaligned with p(b,1,[200])
    w('c', 1, [50]), // wbs-only
    w('d', 0, []), // pelt-only via p(d,1,[20])
    w('e', 0, []), // no-evidence
  ];
  const pelt = [
    p('a', 1, [31]),
    p('b', 1, [200]),
    p('c', 0, []),
    p('d', 1, [20]),
    p('e', 0, []),
  ];
  const r = fn(wbs, pelt, 5);
  assert.equal(r.bucketCounts['agree-aligned'], 1);
  assert.equal(r.bucketCounts['agree-misaligned'], 1);
  assert.equal(r.bucketCounts['wbs-only'], 1);
  assert.equal(r.bucketCounts['pelt-only'], 1);
  assert.equal(r.bucketCounts['no-evidence'], 1);
  // Partition invariant: bucketCounts sum = rows length
  let sum = 0;
  for (const k of Object.keys(r.bucketCounts) as Array<keyof typeof r.bucketCounts>) {
    sum += r.bucketCounts[k];
  }
  assert.equal(sum, r.rows.length);
  // bothDecisive partition: aligned + misaligned + ... PARTITION
  assert.equal(r.byJointAlignment.aligned + r.byJointAlignment.misaligned, r.bothDecisive);
  assert.equal(r.bothDecisiveMultiRegime + r.bothDecisiveSingleRegime, r.bothDecisive);
});

test('axis-225 x axis-224: sourcesOnlyInWbs / sourcesOnlyInPelt populated', () => {
  const wbs = [w('a', 0, []), w('b', 1, [10])];
  const pelt = [p('a', 0, []), p('c', 1, [20])];
  const r = fn(wbs, pelt, 5);
  assert.deepEqual(r.sourcesOnlyInWbs, ['b']);
  assert.deepEqual(r.sourcesOnlyInPelt, ['c']);
  // Only common source 'a' joins
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'a');
});

test('axis-225 x axis-224: rows sorted by source asc', () => {
  const wbs = [w('z', 0, []), w('a', 0, []), w('m', 0, [])];
  const pelt = [p('z', 0, []), p('a', 0, []), p('m', 0, [])];
  const r = fn(wbs, pelt, 5);
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['a', 'm', 'z'],
  );
});

test('axis-225 x axis-224: multiRegimeEither is true iff at least one m>=2', () => {
  const r = fn(
    [w('s1', 2, [10, 50]), w('s2', 1, [10]), w('s3', 0, [])],
    [p('s1', 1, [12]), p('s2', 2, [10, 50]), p('s3', 0, [])],
    5,
  );
  assert.equal(r.rows.find((x) => x.source === 's1')!.multiRegimeEither, true);
  assert.equal(r.rows.find((x) => x.source === 's2')!.multiRegimeEither, true);
  assert.equal(r.rows.find((x) => x.source === 's3')!.multiRegimeEither, false);
});

test('axis-225 x axis-224: jointAlignment is non-null iff bothDecisive', () => {
  const wbs = [w('a', 1, [10]), w('b', 1, [10]), w('c', 0, []), w('d', 0, [])];
  const pelt = [p('a', 1, [12]), p('b', 0, []), p('c', 1, [10]), p('d', 0, [])];
  const r = fn(wbs, pelt, 5);
  for (const row of r.rows) {
    if (row.wbsDecisive && row.peltDecisive) {
      assert.notEqual(row.jointAlignment, null);
    } else {
      assert.equal(row.jointAlignment, null);
    }
  }
});

test('axis-225 x axis-224: nearestPairDistance = MAX_SAFE_INTEGER iff one tau set is empty', () => {
  const r = fn(
    [w('a', 0, []), w('b', 1, [10])],
    [p('a', 1, [10]), p('b', 0, [])],
  );
  for (const row of r.rows) {
    if (row.wbsTauStar.length === 0 || row.peltTauStar.length === 0) {
      assert.equal(row.nearestPairDistance, Number.MAX_SAFE_INTEGER);
    } else {
      assert.notEqual(row.nearestPairDistance, Number.MAX_SAFE_INTEGER);
    }
  }
});
