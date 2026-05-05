import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyKamatMielkeValueExtremeVsRankExtremeCompound,
} from '../src/classifykamatmielkevalueextremevsrankextremecompound.js';

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: empty inputs', () => {
  const r = classifyKamatMielkeValueExtremeVsRankExtremeCompound([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.signConflicts, 0);
  assert.equal(r.unanimousAgreement, 0);
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: rejects bad alpha', () => {
  assert.throws(
    () =>
      classifyKamatMielkeValueExtremeVsRankExtremeCompound([], [], 0),
    /alpha/,
  );
  assert.throws(
    () =>
      classifyKamatMielkeValueExtremeVsRankExtremeCompound([], [], 0.6),
    /alpha/,
  );
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: rejects bad tolerance', () => {
  assert.throws(
    () =>
      classifyKamatMielkeValueExtremeVsRankExtremeCompound(
        [],
        [],
        0.05,
        -1,
      ),
    /tolerance/,
  );
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: rejects duplicates', () => {
  assert.throws(
    () =>
      classifyKamatMielkeValueExtremeVsRankExtremeCompound(
        [
          { source: 'a', kamatZ: 1, kamatPValue: 0.3 },
          { source: 'a', kamatZ: 1, kamatPValue: 0.3 },
        ],
        [],
      ),
    /duplicate kamat/,
  );
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: rejects bad p-value', () => {
  assert.throws(
    () =>
      classifyKamatMielkeValueExtremeVsRankExtremeCompound(
        [{ source: 'a', kamatZ: 1, kamatPValue: 0 }],
        [],
      ),
    /invalid kamatZ/,
  );
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: rejects empty source', () => {
  assert.throws(
    () =>
      classifyKamatMielkeValueExtremeVsRankExtremeCompound(
        [{ source: '', kamatZ: 1, kamatPValue: 0.3 }],
        [],
      ),
    /invalid source/,
  );
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: tracks asymmetric source memberships', () => {
  const r = classifyKamatMielkeValueExtremeVsRankExtremeCompound(
    [
      { source: 'a', kamatZ: 1, kamatPValue: 0.3 },
      { source: 'b', kamatZ: 1, kamatPValue: 0.3 },
    ],
    [
      { source: 'b', mielkeZ: 1, mielkePValue: 0.3 },
      { source: 'c', mielkeZ: 1, mielkePValue: 0.3 },
    ],
  );
  assert.deepEqual(r.sourcesOnlyInKamat, ['a']);
  assert.deepEqual(r.sourcesOnlyInMielke, ['c']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'b');
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: rows sorted source-asc', () => {
  const r = classifyKamatMielkeValueExtremeVsRankExtremeCompound(
    [
      { source: 'zeta', kamatZ: 1, kamatPValue: 0.3 },
      { source: 'alpha', kamatZ: 1, kamatPValue: 0.3 },
      { source: 'mu', kamatZ: 1, kamatPValue: 0.3 },
    ],
    [
      { source: 'zeta', mielkeZ: 1, mielkePValue: 0.3 },
      { source: 'alpha', mielkeZ: 1, mielkePValue: 0.3 },
      { source: 'mu', mielkeZ: 1, mielkePValue: 0.3 },
    ],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['alpha', 'mu', 'zeta'],
  );
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: no-evidence when neither decisive', () => {
  const r = classifyKamatMielkeValueExtremeVsRankExtremeCompound(
    [{ source: 'a', kamatZ: 0.5, kamatPValue: 0.6 }],
    [{ source: 'a', mielkeZ: 0.5, mielkePValue: 0.6 }],
  );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.unanimousAgreement, 0);
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: value-spike-second', () => {
  // Both Z > 0, |kamatZ| > |mielkeZ|, at least one
  // decisive at alpha=0.05.
  const r = classifyKamatMielkeValueExtremeVsRankExtremeCompound(
    [{ source: 'a', kamatZ: 3.5, kamatPValue: 0.0005 }],
    [{ source: 'a', mielkeZ: 1.0, mielkePValue: 0.32 }],
  );
  assert.equal(r.rows[0]!.bucket, 'value-spike-second');
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 1);
  assert.equal(r.unanimousAgreement, 1);
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: value-spike-first', () => {
  const r = classifyKamatMielkeValueExtremeVsRankExtremeCompound(
    [{ source: 'a', kamatZ: -3.5, kamatPValue: 0.0005 }],
    [{ source: 'a', mielkeZ: -1.0, mielkePValue: 0.32 }],
  );
  assert.equal(r.rows[0]!.bucket, 'value-spike-first');
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: rank-config-second', () => {
  // Both Z > 0, |mielkeZ| > |kamatZ|, decisive.
  const r = classifyKamatMielkeValueExtremeVsRankExtremeCompound(
    [{ source: 'a', kamatZ: 1.0, kamatPValue: 0.32 }],
    [{ source: 'a', mielkeZ: 3.5, mielkePValue: 0.0005 }],
  );
  assert.equal(r.rows[0]!.bucket, 'rank-config-second');
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: rank-config-first', () => {
  const r = classifyKamatMielkeValueExtremeVsRankExtremeCompound(
    [{ source: 'a', kamatZ: -1.0, kamatPValue: 0.32 }],
    [{ source: 'a', mielkeZ: -3.5, mielkePValue: 0.0005 }],
  );
  assert.equal(r.rows[0]!.bucket, 'rank-config-first');
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: coherent within tolerance', () => {
  const r = classifyKamatMielkeValueExtremeVsRankExtremeCompound(
    [{ source: 'a', kamatZ: 2.5, kamatPValue: 0.012 }],
    [{ source: 'a', mielkeZ: 2.5, mielkePValue: 0.012 }],
    0.05,
    1e-9,
  );
  assert.equal(r.rows[0]!.bucket, 'coherent');
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.unanimousAgreement, 1);
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: sign-conflict', () => {
  const r = classifyKamatMielkeValueExtremeVsRankExtremeCompound(
    [{ source: 'a', kamatZ: 2.5, kamatPValue: 0.012 }],
    [{ source: 'a', mielkeZ: -2.5, mielkePValue: 0.012 }],
  );
  assert.equal(r.rows[0]!.bucket, 'sign-conflict');
  assert.equal(r.signConflicts, 1);
  assert.equal(r.unanimousAgreement, 0);
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: bucketCounts add up to row count', () => {
  const r = classifyKamatMielkeValueExtremeVsRankExtremeCompound(
    [
      { source: 'a', kamatZ: 3.5, kamatPValue: 0.0005 },
      { source: 'b', kamatZ: -1.5, kamatPValue: 0.13 },
      { source: 'c', kamatZ: 0.5, kamatPValue: 0.6 },
      { source: 'd', kamatZ: 2.5, kamatPValue: 0.012 },
    ],
    [
      { source: 'a', mielkeZ: 1.0, mielkePValue: 0.32 },
      { source: 'b', mielkeZ: -3.5, mielkePValue: 0.0005 },
      { source: 'c', mielkeZ: 0.5, mielkePValue: 0.6 },
      { source: 'd', mielkeZ: -2.5, mielkePValue: 0.012 },
    ],
  );
  assert.equal(r.rows.length, 4);
  const total = Object.values(r.bucketCounts).reduce(
    (s, x) => s + x,
    0,
  );
  assert.equal(total, 4);
  assert.equal(r.bucketCounts['value-spike-second'], 1); // a
  assert.equal(r.bucketCounts['rank-config-first'], 1); // b
  assert.equal(r.bucketCounts['no-evidence'], 1); // c
  assert.equal(r.bucketCounts['sign-conflict'], 1); // d
});

test('classifyKamatMielkeValueExtremeVsRankExtremeCompound: tolerance gates the coherent boundary', () => {
  // |kamatZ| - |mielkeZ| = 0.5 — outside tolerance 1e-9
  // so falls into value-spike, not coherent.
  const r1 = classifyKamatMielkeValueExtremeVsRankExtremeCompound(
    [{ source: 'a', kamatZ: 2.5, kamatPValue: 0.012 }],
    [{ source: 'a', mielkeZ: 2.0, mielkePValue: 0.045 }],
    0.05,
    1e-9,
  );
  assert.equal(r1.rows[0]!.bucket, 'value-spike-second');

  // Same data but tolerance widened — now coherent.
  const r2 = classifyKamatMielkeValueExtremeVsRankExtremeCompound(
    [{ source: 'a', kamatZ: 2.5, kamatPValue: 0.012 }],
    [{ source: 'a', mielkeZ: 2.0, mielkePValue: 0.045 }],
    0.05,
    1.0,
  );
  assert.equal(r2.rows[0]!.bucket, 'coherent');
});
