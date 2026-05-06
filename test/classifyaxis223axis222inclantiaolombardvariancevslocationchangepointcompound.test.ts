import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound,
  summarizeAxis223Axis222IcssLombardReport,
  type InclanTiaoIcssRowForLombardCompound,
  type LombardSmoothChangepointRowForIcssCompound,
} from '../src/classifyaxis223axis222inclantiaolombardvariancevslocationchangepointcompound.js';

function icssRow(
  source: string,
  itStat: number,
  pApprox: number,
  kStar: number,
  directionSign: number,
  logVarRatio: number,
): InclanTiaoIcssRowForLombardCompound {
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

function lombardRow(
  source: string,
  ln: number,
  pApprox: number,
  kStar: number,
  directionSign: number,
  meanShift: number,
): LombardSmoothChangepointRowForIcssCompound {
  return {
    source,
    lombardLn: ln,
    lombardPApprox: pApprox,
    lombardKStar: kStar,
    lombardDirectionSign: directionSign,
    lombardMeanShift: meanShift,
  };
}

// ---- option validation ---------------------------------------------------

test('axis-223 x axis-222: rejects invalid alpha', () => {
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [],
      [],
      0,
    ),
  );
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [],
      [],
      1,
    ),
  );
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [],
      [],
      Number.NaN,
    ),
  );
});

test('axis-223 x axis-222: rejects invalid proximityGuard', () => {
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [],
      [],
      0.05,
      -1,
    ),
  );
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [],
      [],
      0.05,
      1.5,
    ),
  );
});

test('axis-223 x axis-222: rejects non-array inputs', () => {
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      null as unknown as InclanTiaoIcssRowForLombardCompound[],
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [],
      null as unknown as LombardSmoothChangepointRowForIcssCompound[],
    ),
  );
});

// ---- input validation ----------------------------------------------------

test('axis-223 x axis-222: rejects empty source string', () => {
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('', 2, 0.001, 5, -1, 1)],
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [],
      [lombardRow('', 0.5, 0.001, 5, 1, 100)],
    ),
  );
});

test('axis-223 x axis-222: rejects negative itStat', () => {
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', -1, 0.5, 5, 0, 0)],
      [],
    ),
  );
});

test('axis-223 x axis-222: rejects pApprox out of [0,1]', () => {
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 1, 1.5, 5, 0, 0)],
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [],
      [lombardRow('A', 0.5, 1.5, 5, 0, 0)],
    ),
  );
});

test('axis-223 x axis-222: rejects non-integer kStar', () => {
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 1, 0.5, 5.5, 0, 0)],
      [],
    ),
  );
});

test('axis-223 x axis-222: rejects directionSign outside {-1,0,1}', () => {
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 1, 0.5, 5, 2, 0)],
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [],
      [lombardRow('A', 0.5, 0.5, 5, 2, 0)],
    ),
  );
});

test('axis-223 x axis-222: rejects non-finite logVarRatio', () => {
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 1, 0.5, 5, 0, Number.POSITIVE_INFINITY)],
      [],
    ),
  );
});

test('axis-223 x axis-222: rejects non-positive kCritical05', () => {
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [
        {
          source: 'A',
          icssItStat: 1,
          icssPApprox: 0.5,
          icssKCritical05: 0,
          icssKStar: 5,
          icssDirectionSign: 0,
          icssLogVarRatio: 0,
        },
      ],
      [],
    ),
  );
});

test('axis-223 x axis-222: rejects duplicate source in icss', () => {
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 1, 0.5, 5, 0, 0), icssRow('A', 1, 0.5, 5, 0, 0)],
      [],
    ),
  );
});

test('axis-223 x axis-222: rejects duplicate source in lombard', () => {
  assert.throws(() =>
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [],
      [
        lombardRow('A', 0.5, 0.5, 5, 0, 0),
        lombardRow('A', 0.5, 0.5, 5, 0, 0),
      ],
    ),
  );
});

// ---- bucket cases --------------------------------------------------------

test('axis-223 x axis-222: agree-aligned bucket', () => {
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 3, 1e-10, 30, -1, 1.5)],
      [lombardRow('A', 0.5, 1e-6, 32, 1, 200)],
    );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
  assert.equal(r.rows[0]!.jointAlignment, 'aligned');
  assert.equal(r.bucketCounts['agree-aligned'], 1);
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.atLeastOneDecisive, 1);
});

test('axis-223 x axis-222: agree-misaligned bucket (argmax distance > guard)', () => {
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 3, 1e-10, 10, -1, 1.5)],
      [lombardRow('A', 0.5, 1e-6, 50, 1, 200)],
      0.05,
      5,
    );
  assert.equal(r.rows[0]!.bucket, 'agree-misaligned');
  assert.equal(r.rows[0]!.jointAlignment, 'misaligned');
  assert.equal(r.rows[0]!.argmaxDistance, 40);
});

test('axis-223 x axis-222: icss-only bucket (variance shift, no location shift)', () => {
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 3, 1e-10, 30, -1, 1.5)],
      [lombardRow('A', 0.05, 0.5, 32, 0, 0)],
    );
  assert.equal(r.rows[0]!.bucket, 'icss-only');
  assert.equal(r.rows[0]!.jointAlignment, null);
  assert.equal(r.bucketCounts['icss-only'], 1);
});

test('axis-223 x axis-222: lombard-only bucket (location shift, no variance shift)', () => {
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 0.5, 0.95, 30, 0, 0)],
      [lombardRow('A', 0.5, 1e-6, 32, 1, 200)],
    );
  assert.equal(r.rows[0]!.bucket, 'lombard-only');
  assert.equal(r.bucketCounts['lombard-only'], 1);
});

test('axis-223 x axis-222: no-evidence bucket', () => {
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 0.5, 0.95, 30, 0, 0)],
      [lombardRow('A', 0.05, 0.5, 32, 0, 0)],
    );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bucketCounts['no-evidence'], 1);
});

test('axis-223 x axis-222: ICSS OR-decisiveness via kCritical05 (pApprox above alpha)', () => {
  // pApprox above alpha but itStat above kCritical05 -> still decisive
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 1.5, 0.10, 30, -1, 1.0)],
      [lombardRow('A', 0.5, 1e-6, 32, 1, 200)],
    );
  // 1.5 > 1.358 so icssDecisive true via OR clause
  assert.equal(r.rows[0]!.icssDecisive, true);
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');
});

// ---- alignment / sign agreement ------------------------------------------

test('axis-223 x axis-222: proximityGuard 0 requires exact match', () => {
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 3, 1e-10, 30, -1, 1.5)],
      [lombardRow('A', 0.5, 1e-6, 30, 1, 200)],
      0.05,
      0,
    );
  assert.equal(r.rows[0]!.bucket, 'agree-aligned');

  const r2 =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 3, 1e-10, 30, -1, 1.5)],
      [lombardRow('A', 0.5, 1e-6, 31, 1, 200)],
      0.05,
      0,
    );
  assert.equal(r2.rows[0]!.bucket, 'agree-misaligned');
});

test('axis-223 x axis-222: signAgreement true when both shifts positive', () => {
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 3, 1e-10, 30, -1, 2.0)],
      [lombardRow('A', 0.5, 1e-6, 32, 1, 200)],
    );
  assert.equal(r.rows[0]!.signAgreement, true);
  assert.equal(r.bothDecisiveSignAgree, 1);
});

test('axis-223 x axis-222: signAgreement false when shifts disagree', () => {
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 3, 1e-10, 30, -1, 2.0)],
      [lombardRow('A', 0.5, 1e-6, 32, -1, -200)],
    );
  assert.equal(r.rows[0]!.signAgreement, false);
  assert.equal(r.bothDecisiveSignDisagree, 1);
});

test('axis-223 x axis-222: signAgreement false when one shift is zero', () => {
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 3, 1e-10, 30, 0, 0)],
      [lombardRow('A', 0.5, 1e-6, 32, 1, 200)],
    );
  assert.equal(r.rows[0]!.signAgreement, false);
});

// ---- alpha threshold sensitivity -----------------------------------------

test('axis-223 x axis-222: alpha tighter pushes near-decisive into no-evidence', () => {
  const r1 =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 0.5, 0.04, 30, -1, 1)],
      [lombardRow('A', 0.05, 0.04, 30, 1, 100)],
      0.05,
    );
  assert.equal(r1.rows[0]!.bucket, 'agree-aligned');

  const r2 =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 0.5, 0.04, 30, -1, 1)],
      [lombardRow('A', 0.05, 0.04, 30, 1, 100)],
      0.01,
    );
  assert.equal(r2.rows[0]!.bucket, 'no-evidence');
});

// ---- source set asymmetry ------------------------------------------------

test('axis-223 x axis-222: tracks sources only in icss', () => {
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [
        icssRow('A', 1, 0.5, 5, 0, 0),
        icssRow('B', 1, 0.5, 5, 0, 0),
      ],
      [lombardRow('B', 0.05, 0.5, 5, 0, 0)],
    );
  assert.deepEqual(r.sourcesOnlyInIcss, ['A']);
  assert.deepEqual(r.sourcesOnlyInLombard, []);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'B');
});

test('axis-223 x axis-222: tracks sources only in lombard', () => {
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [icssRow('A', 1, 0.5, 5, 0, 0)],
      [
        lombardRow('A', 0.05, 0.5, 5, 0, 0),
        lombardRow('C', 0.05, 0.5, 5, 0, 0),
      ],
    );
  assert.deepEqual(r.sourcesOnlyInIcss, []);
  assert.deepEqual(r.sourcesOnlyInLombard, ['C']);
});

test('axis-223 x axis-222: empty inputs -> empty report', () => {
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [],
      [],
    );
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.bucketCounts['no-evidence'], 0);
});

test('axis-223 x axis-222: rows sorted by source ascending', () => {
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [
        icssRow('Z', 0.5, 0.5, 10, 0, 0),
        icssRow('A', 0.5, 0.5, 10, 0, 0),
        icssRow('M', 0.5, 0.5, 10, 0, 0),
      ],
      [
        lombardRow('Z', 0.05, 0.5, 10, 0, 0),
        lombardRow('A', 0.05, 0.5, 10, 0, 0),
        lombardRow('M', 0.05, 0.5, 10, 0, 0),
      ],
    );
  assert.deepEqual(
    r.rows.map((row) => row.source),
    ['A', 'M', 'Z'],
  );
});

// ---- summary -------------------------------------------------------------

test('axis-223 x axis-222: summarize produces compact log-friendly string', () => {
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      [
        icssRow('A', 3, 1e-10, 30, -1, 1.5),
        icssRow('B', 0.5, 0.95, 30, 0, 0),
      ],
      [
        lombardRow('A', 0.5, 1e-6, 32, 1, 200),
        lombardRow('B', 0.05, 0.5, 30, 0, 0),
      ],
    );
  const s = summarizeAxis223Axis222IcssLombardReport(r);
  assert.match(s, /axis-223xaxis-222/);
  assert.match(s, /n=2/);
  assert.match(s, /both=1\/2/);
  assert.match(s, /buckets\[aa\/am\/io\/lo\/ne\]=1\/0\/0\/0\/1/);
});

// ---- end-to-end mixed buckets --------------------------------------------

test('axis-223 x axis-222: mixed bucket distribution', () => {
  const icss = [
    icssRow('A', 3, 1e-10, 30, -1, 2),       // strong variance shift
    icssRow('B', 3, 1e-10, 10, -1, 2),       // strong variance shift
    icssRow('C', 0.5, 0.95, 30, 0, 0),       // null
    icssRow('D', 0.5, 0.95, 30, 0, 0),       // null
  ];
  const lombard = [
    lombardRow('A', 0.5, 1e-6, 31, 1, 200),  // location shift aligned
    lombardRow('B', 0.05, 0.5, 30, 0, 0),    // location null
    lombardRow('C', 0.5, 1e-6, 30, 1, 200),  // location shift only
    lombardRow('D', 0.05, 0.5, 30, 0, 0),    // null
  ];
  const r =
    classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
      icss,
      lombard,
    );
  assert.equal(r.bucketCounts['agree-aligned'], 1);
  assert.equal(r.bucketCounts['icss-only'], 1);
  assert.equal(r.bucketCounts['lombard-only'], 1);
  assert.equal(r.bucketCounts['no-evidence'], 1);
  assert.equal(r.bucketCounts['agree-misaligned'], 0);
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.atLeastOneDecisive, 3);
});
