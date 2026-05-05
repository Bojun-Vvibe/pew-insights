import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound,
  type FosterStuartRowForUpperRecordsJoin,
  type UpperRecordsRowForFosterStuartJoin,
} from '../src/classifyfosterstuartupperrecordsbilateralvsunilateralcompound.js';

function fs(
  source: string,
  fsS: number,
  fsD: number,
  fsSZ: number,
  fsDZ: number,
): FosterStuartRowForUpperRecordsJoin {
  return { source, fsS, fsD, fsSZ, fsDZ };
}

function ur(
  source: string,
  nUpperRecords: number,
  recordExpectedIid: number,
  recordVarIid: number,
  recordZ: number,
): UpperRecordsRowForFosterStuartJoin {
  return { source, nUpperRecords, recordExpectedIid, recordVarIid, recordZ };
}

test('classify fs-ur: empty inputs -> empty report', () => {
  const r = classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
    [],
    [],
  );
  assert.equal(r.rows.length, 0);
  assert.equal(r.bilateralAndUpperCoherent, 0);
  assert.equal(r.bilateralOnlyLowerTailDriven, 0);
  assert.equal(r.upperOnlyNotBilateral, 0);
  assert.equal(r.coherentButConflictDirection, 0);
  assert.equal(r.sourcesOnlyInFs.length, 0);
  assert.equal(r.sourcesOnlyInUr.length, 0);
});

test('classify fs-ur: bilateral-and-upper-coherent (both up)', () => {
  const fsRows = [fs('a', 30, 10, 4.5, 2.5)];
  const urRows = [ur('a', 12, 5.0, 1.5, 5.7)];
  const r = classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
    fsRows,
    urRows,
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.bucket, 'bilateral-and-upper-coherent');
  assert.equal(r.rows[0]!.direction, 'records-growing');
  assert.equal(r.bilateralAndUpperCoherent, 1);
});

test('classify fs-ur: bilateral-and-upper-coherent (both down)', () => {
  const fsRows = [fs('a', 1, -3, -2.4, -1.8)];
  const urRows = [ur('a', 1, 5.0, 1.5, -3.27)];
  const r = classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
    fsRows,
    urRows,
  );
  assert.equal(r.rows[0]!.bucket, 'bilateral-and-upper-coherent');
  assert.equal(r.rows[0]!.direction, 'records-suppressed');
});

test('classify fs-ur: bilateral-only-lower-tail-driven (fsSZ rejects, recordZ does not)', () => {
  const fsRows = [fs('a', 20, -8, 3.5, -2.0)];
  const urRows = [ur('a', 6, 5.5, 1.6, 0.4)];
  const r = classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
    fsRows,
    urRows,
  );
  assert.equal(r.rows[0]!.bucket, 'bilateral-only-lower-tail-driven');
  assert.equal(r.bilateralOnlyLowerTailDriven, 1);
  assert.equal(r.rows[0]!.direction, 'records-growing');
});

test('classify fs-ur: upper-only-not-bilateral (recordZ rejects, fsSZ does not)', () => {
  const fsRows = [fs('a', 6, 4, 0.5, 1.2)];
  const urRows = [ur('a', 11, 5.5, 1.6, 4.35)];
  const r = classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
    fsRows,
    urRows,
  );
  assert.equal(r.rows[0]!.bucket, 'upper-only-not-bilateral');
  assert.equal(r.upperOnlyNotBilateral, 1);
  assert.equal(r.rows[0]!.direction, 'records-growing');
});

test('classify fs-ur: coherent-but-conflict-direction (signs disagree)', () => {
  const fsRows = [fs('a', 2, -2, -2.5, -1.0)];
  const urRows = [ur('a', 11, 5.5, 1.6, 4.35)];
  const r = classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
    fsRows,
    urRows,
  );
  assert.equal(r.rows[0]!.bucket, 'coherent-but-conflict-direction');
  assert.equal(r.coherentButConflictDirection, 1);
  assert.equal(r.rows[0]!.direction, 'mixed');
});

test('classify fs-ur: both-ns when neither rejects', () => {
  const fsRows = [fs('a', 7, 3, 0.3, 0.8)];
  const urRows = [ur('a', 6, 5.5, 1.6, 0.4)];
  const r = classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
    fsRows,
    urRows,
  );
  assert.equal(r.rows[0]!.bucket, 'both-ns');
});

test('classify fs-ur: rejection threshold is exactly 1.96', () => {
  const fsRows = [fs('a', 10, 5, 1.96, 0.5)];
  const urRows = [ur('a', 6, 5.5, 1.6, 0.4)];
  const r = classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
    fsRows,
    urRows,
  );
  // 1.96 just below the canonical 1.959963984540054 threshold? Check.
  // Actually 1.96 < 1.959963984540054 is false (1.96 > 1.959963984540054).
  assert.equal(r.rows[0]!.bucket, 'bilateral-only-lower-tail-driven');
});

test('classify fs-ur: just-below-threshold does not reject', () => {
  const fsRows = [fs('a', 10, 5, 1.95, 0.5)];
  const urRows = [ur('a', 6, 5.5, 1.6, 0.4)];
  const r = classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
    fsRows,
    urRows,
  );
  assert.equal(r.rows[0]!.bucket, 'both-ns');
});

test('classify fs-ur: bucket counts sum to joined-row count', () => {
  const fsRows = [
    fs('a', 30, 10, 4.5, 2.5),
    fs('b', 20, -8, 3.5, -2.0),
    fs('c', 6, 4, 0.5, 1.2),
    fs('d', 7, 3, 0.3, 0.8),
    fs('e', 2, -2, -2.5, -1.0),
  ];
  const urRows = [
    ur('a', 12, 5.0, 1.5, 5.7),
    ur('b', 6, 5.5, 1.6, 0.4),
    ur('c', 11, 5.5, 1.6, 4.35),
    ur('d', 6, 5.5, 1.6, 0.4),
    ur('e', 11, 5.5, 1.6, 4.35),
  ];
  const r = classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
    fsRows,
    urRows,
  );
  const sum =
    r.bucketCounts['bilateral-and-upper-coherent'] +
    r.bucketCounts['bilateral-only-lower-tail-driven'] +
    r.bucketCounts['upper-only-not-bilateral'] +
    r.bucketCounts['coherent-but-conflict-direction'] +
    r.bucketCounts['both-ns'];
  assert.equal(sum, 5);
  assert.equal(r.rows.length, 5);
  assert.equal(r.bilateralAndUpperCoherent, 1);
  assert.equal(r.bilateralOnlyLowerTailDriven, 1);
  assert.equal(r.upperOnlyNotBilateral, 1);
  assert.equal(r.coherentButConflictDirection, 1);
  assert.equal(r.bucketCounts['both-ns'], 1);
});

test('classify fs-ur: rows sorted by source asc', () => {
  const fsRows = [
    fs('zeta', 7, 3, 0.3, 0.8),
    fs('alpha', 6, 4, 0.5, 1.2),
    fs('mid', 7, 3, 0.3, 0.8),
  ];
  const urRows = [
    ur('zeta', 6, 5.5, 1.6, 0.4),
    ur('alpha', 6, 5.5, 1.6, 0.4),
    ur('mid', 6, 5.5, 1.6, 0.4),
  ];
  const r = classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
    fsRows,
    urRows,
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['alpha', 'mid', 'zeta'],
  );
});

test('classify fs-ur: sourcesOnlyInFs / sourcesOnlyInUr captured', () => {
  const fsRows = [fs('a', 7, 3, 0.3, 0.8), fs('only-fs', 7, 3, 0.3, 0.8)];
  const urRows = [ur('a', 6, 5.5, 1.6, 0.4), ur('only-ur', 6, 5.5, 1.6, 0.4)];
  const r = classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
    fsRows,
    urRows,
  );
  assert.deepEqual(r.sourcesOnlyInFs, ['only-fs']);
  assert.deepEqual(r.sourcesOnlyInUr, ['only-ur']);
  assert.equal(r.rows.length, 1);
});

test('classify fs-ur: duplicate fs source throws', () => {
  assert.throws(
    () =>
      classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
        [fs('a', 7, 3, 0.3, 0.8), fs('a', 7, 3, 0.3, 0.8)],
        [],
      ),
    /duplicate fs source 'a'/,
  );
});

test('classify fs-ur: duplicate ur source throws', () => {
  assert.throws(
    () =>
      classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
        [],
        [ur('a', 6, 5.5, 1.6, 0.4), ur('a', 6, 5.5, 1.6, 0.4)],
      ),
    /duplicate ur source 'a'/,
  );
});

test('classify fs-ur: non-finite fsSZ throws', () => {
  assert.throws(
    () =>
      classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
        [fs('a', 7, 3, Number.NaN, 0.8)],
        [],
      ),
    /fsSZ must be finite/,
  );
});

test('classify fs-ur: negative fsS throws', () => {
  assert.throws(
    () =>
      classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
        [fs('a', -1, 3, 0.5, 0.8)],
        [],
      ),
    /fsS must be finite >= 0/,
  );
});

test('classify fs-ur: nUpperRecords zero rejected', () => {
  assert.throws(
    () =>
      classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
        [],
        [ur('a', 0, 5.5, 1.6, 0.4)],
      ),
    /nUpperRecords must be integer >= 1/,
  );
});

test('classify fs-ur: zero z scores -> both-ns balanced', () => {
  const fsRows = [fs('a', 10, 0, 0, 0)];
  const urRows = [ur('a', 6, 5.5, 1.6, 0)];
  const r = classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
    fsRows,
    urRows,
  );
  assert.equal(r.rows[0]!.bucket, 'both-ns');
  assert.equal(r.rows[0]!.direction, 'mixed');
});

test('classify fs-ur: row carries all numeric fields verbatim', () => {
  const fsRows = [fs('a', 30, 10, 4.5, 2.5)];
  const urRows = [ur('a', 12, 5.0, 1.5, 5.7)];
  const r = classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
    fsRows,
    urRows,
  );
  const row = r.rows[0]!;
  assert.equal(row.fsS, 30);
  assert.equal(row.fsD, 10);
  assert.equal(row.fsSZ, 4.5);
  assert.equal(row.fsAbsSZ, 4.5);
  assert.equal(row.fsDZ, 2.5);
  assert.equal(row.nUpperRecords, 12);
  assert.equal(row.recordExpectedIid, 5.0);
  assert.equal(row.recordZ, 5.7);
  assert.equal(row.recordAbsZ, 5.7);
});
