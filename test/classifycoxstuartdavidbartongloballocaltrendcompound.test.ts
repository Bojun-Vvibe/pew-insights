import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCoxStuartDavidBartonGlobalLocalTrendCompound,
} from '../src/classifycoxstuartdavidbartongloballocaltrendcompound.js';

// ---------- validation ----------

test('compound: throws on alpha out of (0, 0.5]', () => {
  assert.throws(() =>
    classifyCoxStuartDavidBartonGlobalLocalTrendCompound([], [], 0),
  );
  assert.throws(() =>
    classifyCoxStuartDavidBartonGlobalLocalTrendCompound([], [], 0.6),
  );
  assert.throws(() =>
    classifyCoxStuartDavidBartonGlobalLocalTrendCompound([], [], Number.NaN),
  );
});

test('compound: accepts alpha 0.05 and 0.5 boundary', () => {
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound([], [], 0.5);
  assert.equal(r.alpha, 0.5);
});

test('compound: throws on duplicate cox-stuart source', () => {
  assert.throws(() =>
    classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
      [
        { source: 'a', csZ: 1, csPValue: 0.3 },
        { source: 'a', csZ: 2, csPValue: 0.1 },
      ],
      [],
    ),
  );
});

test('compound: throws on duplicate david-barton source', () => {
  assert.throws(() =>
    classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
      [],
      [
        { source: 'a', dbZ: 1, dbPValue: 0.3 },
        { source: 'a', dbZ: 2, dbPValue: 0.1 },
      ],
    ),
  );
});

test('compound: throws on bad source string', () => {
  assert.throws(() =>
    classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [{ source: '' as any, csZ: 1, csPValue: 0.3 }],
      [],
    ),
  );
});

test('compound: throws on non-finite cs values', () => {
  assert.throws(() =>
    classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
      [{ source: 'a', csZ: Number.NaN, csPValue: 0.3 }],
      [],
    ),
  );
  assert.throws(() =>
    classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
      [{ source: 'a', csZ: 1, csPValue: 0 }],
      [],
    ),
  );
  assert.throws(() =>
    classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
      [{ source: 'a', csZ: 1, csPValue: 1.1 }],
      [],
    ),
  );
});

test('compound: throws on non-finite db values', () => {
  assert.throws(() =>
    classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
      [],
      [{ source: 'a', dbZ: Number.POSITIVE_INFINITY, dbPValue: 0.3 }],
    ),
  );
});

// ---------- bucket assignment ----------

test('compound: empty inputs -> empty report', () => {
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.byCoherentDirection.up, 0);
  assert.equal(r.byCoherentDirection.down, 0);
  for (const c of Object.values(r.bucketCounts)) assert.equal(c, 0);
});

test('compound: no-evidence bucket when neither decisive', () => {
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
    [{ source: 'a', csZ: 0.5, csPValue: 0.6 }],
    [{ source: 'a', dbZ: 0.5, dbPValue: 0.6 }],
  );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bucketCounts['no-evidence'], 1);
});

test('compound: coherent-trend up bucket (cs+, db-)', () => {
  // cs decisive +, db decisive negative dbZ (= persistence, dbTrendSignal+)
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
    [{ source: 'a', csZ: 3.0, csPValue: 0.001 }],
    [{ source: 'a', dbZ: -3.0, dbPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'coherent-trend');
  assert.equal(r.rows[0]!.coherentTrendDirection, 'up');
  assert.equal(r.byCoherentDirection.up, 1);
  assert.equal(r.byCoherentDirection.down, 0);
  assert.equal(r.coherentRows, 1);
});

test('compound: coherent-trend down bucket (cs-, db-)', () => {
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
    [{ source: 'a', csZ: -3.0, csPValue: 0.001 }],
    [{ source: 'a', dbZ: -3.0, dbPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'coherent-trend');
  assert.equal(r.rows[0]!.coherentTrendDirection, 'down');
  assert.equal(r.byCoherentDirection.down, 1);
});

test('compound: global-trend-on-local-noise (cs decisive, dbZ > 0 decisive)', () => {
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
    [{ source: 'a', csZ: 3.0, csPValue: 0.001 }],
    [{ source: 'a', dbZ: +3.0, dbPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'global-trend-on-local-noise');
  assert.equal(r.crossScaleSplitRows, 1);
});

test('compound: local-persistence-no-global-trend (cs not decisive, dbZ < 0 decisive)', () => {
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
    [{ source: 'a', csZ: 0.5, csPValue: 0.6 }],
    [{ source: 'a', dbZ: -3.0, dbPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'local-persistence-no-global-trend');
  assert.equal(r.scaleSpecificRows, 1);
});

test('compound: local-oscillation-no-global-trend (cs not decisive, dbZ > 0 decisive)', () => {
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
    [{ source: 'a', csZ: 0.5, csPValue: 0.6 }],
    [{ source: 'a', dbZ: +3.0, dbPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'local-oscillation-no-global-trend');
});

test('compound: global-trend-only (cs decisive, db not)', () => {
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
    [{ source: 'a', csZ: 3.0, csPValue: 0.001 }],
    [{ source: 'a', dbZ: 0.5, dbPValue: 0.6 }],
  );
  assert.equal(r.rows[0]!.bucket, 'global-trend-only');
  assert.equal(r.scaleSpecificRows, 1);
});

// ---------- alpha sensitivity ----------

test('compound: alpha sensitivity moves rows in/out of decisive', () => {
  const cs = [{ source: 'a', csZ: 1.7, csPValue: 0.09 }];
  const db = [{ source: 'a', dbZ: -1.7, dbPValue: 0.09 }];
  const r05 = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(cs, db, 0.05);
  const r10 = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(cs, db, 0.1);
  assert.equal(r05.rows[0]!.bucket, 'no-evidence');
  assert.equal(r10.rows[0]!.bucket, 'coherent-trend');
});

// ---------- asymmetric membership ----------

test('compound: sources only in cs / only in db are tracked separately', () => {
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
    [
      { source: 'shared', csZ: 1.0, csPValue: 0.3 },
      { source: 'cs-only', csZ: 2.0, csPValue: 0.04 },
    ],
    [
      { source: 'shared', dbZ: -1.0, dbPValue: 0.3 },
      { source: 'db-only', dbZ: -2.0, dbPValue: 0.04 },
    ],
  );
  assert.deepEqual(r.sourcesOnlyInCoxStuart, ['cs-only']);
  assert.deepEqual(r.sourcesOnlyInDavidBarton, ['db-only']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'shared');
});

// ---------- aggregate invariants ----------

test('compound: bucketCounts sum to rows.length', () => {
  const cs = [
    { source: 'a', csZ: 3, csPValue: 0.001 },
    { source: 'b', csZ: 0.1, csPValue: 0.92 },
    { source: 'c', csZ: -2.5, csPValue: 0.012 },
    { source: 'd', csZ: 0.5, csPValue: 0.6 },
    { source: 'e', csZ: 2.0, csPValue: 0.045 },
  ];
  const db = [
    { source: 'a', dbZ: -3, dbPValue: 0.001 },
    { source: 'b', dbZ: 0.05, dbPValue: 0.95 },
    { source: 'c', dbZ: 2.5, dbPValue: 0.012 },
    { source: 'd', dbZ: -2.5, dbPValue: 0.012 },
    { source: 'e', dbZ: 0.05, dbPValue: 0.95 },
  ];
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(cs, db);
  let sum = 0;
  for (const c of Object.values(r.bucketCounts)) sum += c;
  assert.equal(sum, r.rows.length);
  assert.equal(sum, 5);
});

test('compound: rows ordered by source asc', () => {
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
    [
      { source: 'zeta', csZ: 1, csPValue: 0.3 },
      { source: 'alpha', csZ: 1, csPValue: 0.3 },
      { source: 'mu', csZ: 1, csPValue: 0.3 },
    ],
    [
      { source: 'zeta', dbZ: 1, dbPValue: 0.3 },
      { source: 'alpha', dbZ: 1, dbPValue: 0.3 },
      { source: 'mu', dbZ: 1, dbPValue: 0.3 },
    ],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['alpha', 'mu', 'zeta'],
  );
});

test('compound: bothDecisive and atLeastOneDecisive counters', () => {
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
    [
      { source: 'both', csZ: 3, csPValue: 0.001 },
      { source: 'csonly', csZ: 3, csPValue: 0.001 },
      { source: 'dbonly', csZ: 0.5, csPValue: 0.6 },
      { source: 'neither', csZ: 0.1, csPValue: 0.9 },
    ],
    [
      { source: 'both', dbZ: -3, dbPValue: 0.001 },
      { source: 'csonly', dbZ: 0.5, dbPValue: 0.6 },
      { source: 'dbonly', dbZ: -3, dbPValue: 0.001 },
      { source: 'neither', dbZ: 0.1, dbPValue: 0.9 },
    ],
  );
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.atLeastOneDecisive, 3);
});

test('compound: byCoherentDirection up + down <= coherentRows', () => {
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
    [
      { source: 'u1', csZ: 3, csPValue: 0.001 },
      { source: 'u2', csZ: 4, csPValue: 0.0001 },
      { source: 'd1', csZ: -3, csPValue: 0.001 },
    ],
    [
      { source: 'u1', dbZ: -3, dbPValue: 0.001 },
      { source: 'u2', dbZ: -4, dbPValue: 0.0001 },
      { source: 'd1', dbZ: -3, dbPValue: 0.001 },
    ],
  );
  assert.equal(r.byCoherentDirection.up, 2);
  assert.equal(r.byCoherentDirection.down, 1);
  assert.equal(r.coherentRows, 3);
  assert.equal(
    r.byCoherentDirection.up + r.byCoherentDirection.down,
    r.coherentRows,
  );
});

test('compound: dual-direction bucket is reserved (always 0 in valid join)', () => {
  // Confirmed unreachable by upstream branches; explicit zero check.
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
    [
      { source: 'a', csZ: 3, csPValue: 0.001 },
      { source: 'b', csZ: -3, csPValue: 0.001 },
    ],
    [
      { source: 'a', dbZ: -3, dbPValue: 0.001 },
      { source: 'b', dbZ: 3, dbPValue: 0.001 },
    ],
  );
  assert.equal(
    r.bucketCounts['global-trend-with-decisive-cs-only-dual-direction'],
    0,
  );
});

test('compound: csTrendSignal === csZ and dbTrendSignal === -dbZ', () => {
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
    [{ source: 'a', csZ: 1.234, csPValue: 0.3 }],
    [{ source: 'a', dbZ: -2.345, dbPValue: 0.3 }],
  );
  assert.equal(r.rows[0]!.csTrendSignal, 1.234);
  assert.equal(r.rows[0]!.dbTrendSignal, 2.345);
});

test('compound: empty join when no shared sources', () => {
  const r = classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
    [{ source: 'a', csZ: 1, csPValue: 0.3 }],
    [{ source: 'b', dbZ: 1, dbPValue: 0.3 }],
  );
  assert.equal(r.rows.length, 0);
  assert.deepEqual(r.sourcesOnlyInCoxStuart, ['a']);
  assert.deepEqual(r.sourcesOnlyInDavidBarton, ['b']);
});
