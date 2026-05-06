import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  classifyAxis227Axis226AdamsMackayBocpdMattesonJamesEcpBayesianOnlineVsBatchEnergyMultipleChangepointCompound,
  type AdamsMackayBocpdRowForEcpCompound,
  type MattesonJamesEcpRowForBocpdCompound,
} from '../src/classifyaxis227axis226adamsmackaybocpdmattesonjamesecpbayesianonlinevsbatchenergymultiplechangepointcompound.js';

function b(
  source: string,
  bocpdM: number,
  bocpdTauStar: number[],
  opts: Partial<AdamsMackayBocpdRowForEcpCompound> = {},
): AdamsMackayBocpdRowForEcpCompound {
  return {
    source,
    bocpdM,
    bocpdTauStar,
    bocpdCpProbability: opts.bocpdCpProbability ?? 0.05,
    bocpdMeanRunMap: opts.bocpdMeanRunMap ?? 10,
    bocpdPosteriorEntropy: opts.bocpdPosteriorEntropy ?? 0.5,
  };
}

function e(
  source: string,
  ecpM: number,
  ecpTauStar: number[],
  opts: Partial<MattesonJamesEcpRowForBocpdCompound> = {},
): MattesonJamesEcpRowForBocpdCompound {
  return {
    source,
    ecpM,
    ecpTauStar,
    ecpMaxQStar: opts.ecpMaxQStar ?? 100,
    ecpThreshold: opts.ecpThreshold ?? 50,
    ecpDistributionalHomogeneity: opts.ecpDistributionalHomogeneity ?? 0.5,
  };
}

const fn =
  classifyAxis227Axis226AdamsMackayBocpdMattesonJamesEcpBayesianOnlineVsBatchEnergyMultipleChangepointCompound;

// ---- argument validation -------------------------------------------------

test('axis-227 x axis-226: rejects bad proximityGuard', () => {
  assert.throws(() => fn([], [], -1));
  assert.throws(() => fn([], [], 1.5));
  assert.throws(() => fn([], [], NaN));
});

test('axis-227 x axis-226: rejects non-array inputs', () => {
  assert.throws(() => fn(null as unknown as [], []));
  assert.throws(() => fn([], null as unknown as []));
});

test('axis-227 x axis-226: rejects invalid bocpd row', () => {
  assert.throws(() =>
    fn(
      [{ ...b('a', 0, []), bocpdM: -1 } as AdamsMackayBocpdRowForEcpCompound],
      [],
    ),
  );
  assert.throws(() =>
    fn(
      [{ ...b('a', 1, [10]), bocpdTauStar: [] } as AdamsMackayBocpdRowForEcpCompound],
      [],
    ),
  );
  assert.throws(() => fn([{ ...b('a', 1, [0]) } as AdamsMackayBocpdRowForEcpCompound], []));
  assert.throws(() => fn([b('a', 2, [10, 5])], []));
  assert.throws(() => fn([b('', 0, [])], []));
  assert.throws(() =>
    fn(
      [
        { ...b('a', 0, []), bocpdCpProbability: 1.5 } as AdamsMackayBocpdRowForEcpCompound,
      ],
      [],
    ),
  );
  assert.throws(() =>
    fn(
      [
        { ...b('a', 0, []), bocpdPosteriorEntropy: -0.1 } as AdamsMackayBocpdRowForEcpCompound,
      ],
      [],
    ),
  );
});

test('axis-227 x axis-226: rejects invalid ecp row', () => {
  assert.throws(() =>
    fn([], [{ ...e('a', 0, []), ecpM: -1 } as MattesonJamesEcpRowForBocpdCompound]),
  );
  assert.throws(() =>
    fn([], [{ ...e('a', 1, [5]), ecpTauStar: [] } as MattesonJamesEcpRowForBocpdCompound]),
  );
  assert.throws(() =>
    fn(
      [],
      [
        {
          ...e('a', 0, []),
          ecpDistributionalHomogeneity: 1.5,
        } as MattesonJamesEcpRowForBocpdCompound,
      ],
    ),
  );
  assert.throws(() => fn([], [e('a', 2, [10, 5])]));
});

test('axis-227 x axis-226: rejects duplicate sources', () => {
  assert.throws(() => fn([b('x', 0, []), b('x', 0, [])], []));
  assert.throws(() => fn([], [e('x', 0, []), e('x', 0, [])]));
});

// ---- bucket assignment ---------------------------------------------------

test('axis-227 x axis-226: agree-aligned when both decisive within proximity', () => {
  const r = fn([b('a', 1, [30])], [e('a', 1, [32])], 5);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
  assert.equal(r.rows[0]!.jointAlignment, 'aligned');
  assert.equal(r.rows[0]!.nearestPairDistance, 2);
  assert.equal(r.bucketCounts['agree-aligned'], 1);
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.byJointAlignment.aligned, 1);
});

test('axis-227 x axis-226: agree-misaligned when both decisive outside proximity', () => {
  const r = fn([b('a', 1, [10])], [e('a', 1, [50])], 5);
  assert.equal(r.rows[0]!.bucket, 'agree-misaligned');
  assert.equal(r.rows[0]!.jointAlignment, 'misaligned');
  assert.equal(r.rows[0]!.nearestPairDistance, 40);
  assert.equal(r.byJointAlignment.misaligned, 1);
});

test('axis-227 x axis-226: bocpd-only', () => {
  const r = fn([b('a', 2, [10, 50])], [e('a', 0, [])]);
  assert.equal(r.rows[0]!.bucket, 'bocpd-only');
  assert.equal(r.rows[0]!.jointAlignment, null);
  assert.equal(r.bucketCounts['bocpd-only'], 1);
  assert.equal(r.atLeastOneDecisive, 1);
  assert.equal(r.bothDecisive, 0);
});

test('axis-227 x axis-226: ecp-only', () => {
  const r = fn([b('a', 0, [])], [e('a', 1, [25])]);
  assert.equal(r.rows[0]!.bucket, 'ecp-only');
  assert.equal(r.rows[0]!.jointAlignment, null);
  assert.equal(r.bucketCounts['ecp-only'], 1);
});

test('axis-227 x axis-226: no-evidence when neither decisive', () => {
  const r = fn([b('a', 0, [])], [e('a', 0, [])]);
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.rows[0]!.jointAlignment, null);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.byJointAlignment.anyMissingDecisive, 1);
});

test('axis-227 x axis-226: nearestPairDistance is min over all pairs', () => {
  const r = fn([b('a', 3, [10, 20, 100])], [e('a', 2, [22, 99])], 5);
  // pairs: |10-22|=12, |10-99|=89, |20-22|=2, |20-99|=79, |100-22|=78, |100-99|=1
  assert.equal(r.rows[0]!.nearestPairDistance, 1);
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
});

test('axis-227 x axis-226: proximityGuard 0 forces exact match', () => {
  const exactly = fn([b('a', 1, [30])], [e('a', 1, [30])], 0);
  assert.equal(exactly.rows[0]!.bucket, 'agree-aligned');
  const off = fn([b('a', 1, [30])], [e('a', 1, [31])], 0);
  assert.equal(off.rows[0]!.bucket, 'agree-misaligned');
});

test('axis-227 x axis-226: only joined sources are scored', () => {
  const r = fn(
    [b('a', 0, []), b('only-bocpd', 1, [5])],
    [e('a', 0, []), e('only-ecp', 1, [5])],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'a');
  assert.deepEqual(r.sourcesOnlyInBocpd, ['only-bocpd']);
  assert.deepEqual(r.sourcesOnlyInEcp, ['only-ecp']);
});

test('axis-227 x axis-226: bucketCounts sum equals row count', () => {
  const r = fn(
    [b('a', 1, [10]), b('b', 1, [20]), b('c', 0, []), b('d', 0, [])],
    [e('a', 1, [11]), e('b', 1, [60]), e('c', 1, [30]), e('d', 0, [])],
    5,
  );
  let s = 0;
  for (const k of Object.keys(r.bucketCounts) as Array<keyof typeof r.bucketCounts>) {
    s += r.bucketCounts[k];
  }
  assert.equal(s, r.rows.length);
  assert.equal(s, 4);
  assert.equal(r.bucketCounts['agree-aligned'], 1);
  assert.equal(r.bucketCounts['agree-misaligned'], 1);
  assert.equal(r.bucketCounts['ecp-only'], 1);
  assert.equal(r.bucketCounts['no-evidence'], 1);
});

test('axis-227 x axis-226: multiRegimeEither tracks m>=2', () => {
  const r = fn([b('a', 2, [10, 50])], [e('a', 1, [11])], 5);
  assert.equal(r.rows[0]!.multiRegimeEither, true);
  assert.equal(r.bothDecisiveMultiRegime, 1);
  assert.equal(r.bothDecisiveSingleRegime, 0);
  const r2 = fn([b('a', 1, [10])], [e('a', 1, [11])], 5);
  assert.equal(r2.rows[0]!.multiRegimeEither, false);
  assert.equal(r2.bothDecisiveSingleRegime, 1);
});

test('axis-227 x axis-226: rows are sorted by source', () => {
  const r = fn(
    [b('z', 0, []), b('a', 0, []), b('m', 0, [])],
    [e('z', 0, []), e('a', 0, []), e('m', 0, [])],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['a', 'm', 'z'],
  );
});

test('axis-227 x axis-226: empty inputs return zero-row report', () => {
  const r = fn([], [], 5);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.deepEqual(r.sourcesOnlyInBocpd, []);
  assert.deepEqual(r.sourcesOnlyInEcp, []);
});

test('axis-227 x axis-226: nearestPairDistance is MAX_SAFE_INTEGER when either side empty', () => {
  const r1 = fn([b('a', 0, [])], [e('a', 1, [10])]);
  assert.equal(r1.rows[0]!.nearestPairDistance, Number.MAX_SAFE_INTEGER);
  const r2 = fn([b('a', 1, [10])], [e('a', 0, [])]);
  assert.equal(r2.rows[0]!.nearestPairDistance, Number.MAX_SAFE_INTEGER);
});

test('axis-227 x axis-226: proximityGuard validates default', () => {
  // default 5; aligned at distance 5
  const r = fn([b('a', 1, [10])], [e('a', 1, [15])]);
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
  // distance 6 -> misaligned
  const r2 = fn([b('a', 1, [10])], [e('a', 1, [16])]);
  assert.equal(r2.rows[0]!.bucket, 'agree-misaligned');
});
