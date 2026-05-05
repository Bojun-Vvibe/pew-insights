import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyHoggAdaptiveMannWhitneyDispatchRow,
  classifyHoggAdaptiveMannWhitneyDispatchAgreementCompound,
  type HoggMannWhitneyJoinedRow,
} from '../src/classifyhoggadaptivemannwhitneydispatchagreementcompound.js';

function row(
  overrides: Partial<HoggMannWhitneyJoinedRow> = {},
): HoggMannWhitneyJoinedRow {
  return {
    source: 'src',
    hoggZ: 0,
    hoggPValue: 0.5,
    hoggDispatch: 'HFR2-wilcoxon',
    mwZ: 0,
    mwPValue: 0.5,
    ...overrides,
  };
}

// ---------- per-row classifier: validation ----------

test('classifier: throws on alpha out of (0, 1)', () => {
  assert.throws(
    () => classifyHoggAdaptiveMannWhitneyDispatchRow(row(), 0),
    /alpha must be in/,
  );
  assert.throws(
    () => classifyHoggAdaptiveMannWhitneyDispatchRow(row(), 1),
    /alpha must be in/,
  );
});

test('classifier: throws on non-finite hoggZ', () => {
  assert.throws(
    () =>
      classifyHoggAdaptiveMannWhitneyDispatchRow(row({ hoggZ: Number.NaN })),
    /hoggZ must be finite/,
  );
});

test('classifier: throws on non-finite mwZ', () => {
  assert.throws(
    () => classifyHoggAdaptiveMannWhitneyDispatchRow(row({ mwZ: Number.NaN })),
    /mwZ must be finite/,
  );
});

test('classifier: throws on out-of-range hoggPValue', () => {
  assert.throws(
    () => classifyHoggAdaptiveMannWhitneyDispatchRow(row({ hoggPValue: 0 })),
    /hoggPValue must be in/,
  );
  assert.throws(
    () => classifyHoggAdaptiveMannWhitneyDispatchRow(row({ hoggPValue: 1.5 })),
    /hoggPValue must be in/,
  );
});

test('classifier: throws on out-of-range mwPValue', () => {
  assert.throws(
    () => classifyHoggAdaptiveMannWhitneyDispatchRow(row({ mwPValue: 0 })),
    /mwPValue must be in/,
  );
});

test('classifier: throws on unknown dispatch', () => {
  assert.throws(
    () =>
      classifyHoggAdaptiveMannWhitneyDispatchRow(
        row({ hoggDispatch: 'BOGUS' as never }),
      ),
    /unknown hoggDispatch/,
  );
});

// ---------- bucket coverage ----------

test('bucket coherent-location-wilcoxon-dispatch: all conditions met', () => {
  const r = row({
    hoggZ: 2.5,
    hoggPValue: 0.012,
    hoggDispatch: 'HFR2-wilcoxon',
    mwZ: 2.4,
    mwPValue: 0.016,
  });
  assert.equal(
    classifyHoggAdaptiveMannWhitneyDispatchRow(r),
    'coherent-location-wilcoxon-dispatch',
  );
});

test('bucket coherent-location-non-wilcoxon-dispatch: both sig same sign, non-Wilcoxon dispatch', () => {
  const r = row({
    hoggZ: 2.5,
    hoggPValue: 0.012,
    hoggDispatch: 'HFR1-mood-median',
    mwZ: 2.4,
    mwPValue: 0.016,
  });
  assert.equal(
    classifyHoggAdaptiveMannWhitneyDispatchRow(r),
    'coherent-location-non-wilcoxon-dispatch',
  );
});

test('bucket adaptive-only: hogg sig, mw not sig', () => {
  const r = row({
    hoggZ: 2.5,
    hoggPValue: 0.012,
    hoggDispatch: 'HFR1-mood-median',
    mwZ: 0.4,
    mwPValue: 0.7,
  });
  assert.equal(classifyHoggAdaptiveMannWhitneyDispatchRow(r), 'adaptive-only');
});

test('bucket wilcoxon-only: mw sig, hogg not sig', () => {
  const r = row({
    hoggZ: 0.5,
    hoggPValue: 0.6,
    hoggDispatch: 'HFR3-vanderwaerden',
    mwZ: 2.5,
    mwPValue: 0.012,
  });
  assert.equal(classifyHoggAdaptiveMannWhitneyDispatchRow(r), 'wilcoxon-only');
});

test('bucket direction-conflict: both sig but opposite signs', () => {
  const r = row({
    hoggZ: 2.5,
    hoggPValue: 0.012,
    hoggDispatch: 'HFR2-wilcoxon',
    mwZ: -2.4,
    mwPValue: 0.016,
  });
  assert.equal(
    classifyHoggAdaptiveMannWhitneyDispatchRow(r),
    'direction-conflict',
  );
});

test('bucket dispatch-veto: both ns AND non-Wilcoxon dispatch', () => {
  const r = row({
    hoggZ: 0.4,
    hoggPValue: 0.7,
    hoggDispatch: 'HFR1-mood-median',
    mwZ: 0.5,
    mwPValue: 0.6,
  });
  assert.equal(
    classifyHoggAdaptiveMannWhitneyDispatchRow(r),
    'dispatch-veto',
  );
});

test('bucket no-evidence: both ns AND Wilcoxon dispatch', () => {
  const r = row({
    hoggZ: 0.4,
    hoggPValue: 0.7,
    hoggDispatch: 'HFR2-wilcoxon',
    mwZ: 0.5,
    mwPValue: 0.6,
  });
  assert.equal(classifyHoggAdaptiveMannWhitneyDispatchRow(r), 'no-evidence');
});

// ---------- alpha sensitivity ----------

test('alpha sensitivity: bucket flips when alpha crosses pValue', () => {
  const r = row({
    hoggZ: 2.0,
    hoggPValue: 0.04,
    hoggDispatch: 'HFR1-mood-median',
    mwZ: 2.0,
    mwPValue: 0.04,
  });
  assert.equal(
    classifyHoggAdaptiveMannWhitneyDispatchRow(r, 0.05),
    'coherent-location-non-wilcoxon-dispatch',
  );
  assert.equal(
    classifyHoggAdaptiveMannWhitneyDispatchRow(r, 0.01),
    'dispatch-veto',
  );
});

// ---------- batch: empty / skip ----------

test('batch: empty input returns zero counts', () => {
  const rep = classifyHoggAdaptiveMannWhitneyDispatchAgreementCompound([]);
  assert.equal(rep.rowsTotal, 0);
  assert.equal(rep.rowsClassified, 0);
  assert.equal(rep.rowsSkipped, 0);
  for (const v of Object.values(rep.buckets)) assert.equal(v, 0);
});

test('batch: malformed rows are skipped with counter', () => {
  const rep = classifyHoggAdaptiveMannWhitneyDispatchAgreementCompound([
    row({ source: '' }),
    row({ hoggZ: Number.NaN }),
    row({ mwPValue: 0 }),
    row({ hoggDispatch: 'NOPE' as never }),
  ]);
  assert.equal(rep.rowsTotal, 4);
  assert.equal(rep.rowsClassified, 0);
  assert.equal(rep.rowsSkipped, 4);
});

test('batch: byDispatch cross-tab tracks per-dispatch bucket counts', () => {
  const rep = classifyHoggAdaptiveMannWhitneyDispatchAgreementCompound([
    row({
      source: 'a',
      hoggZ: 2.5,
      hoggPValue: 0.01,
      hoggDispatch: 'HFR1-mood-median',
      mwZ: 2.5,
      mwPValue: 0.01,
    }),
    row({
      source: 'b',
      hoggZ: 2.5,
      hoggPValue: 0.01,
      hoggDispatch: 'HFR2-wilcoxon',
      mwZ: 2.5,
      mwPValue: 0.01,
    }),
    row({
      source: 'c',
      hoggZ: 0.4,
      hoggPValue: 0.7,
      hoggDispatch: 'HFR1-mood-median',
      mwZ: 0.4,
      mwPValue: 0.7,
    }),
  ]);
  assert.equal(rep.rowsClassified, 3);
  assert.equal(
    rep.byDispatch['HFR1-mood-median']['coherent-location-non-wilcoxon-dispatch'],
    1,
  );
  assert.equal(
    rep.byDispatch['HFR2-wilcoxon']['coherent-location-wilcoxon-dispatch'],
    1,
  );
  assert.equal(
    rep.byDispatch['HFR1-mood-median']['dispatch-veto'],
    1,
  );
});

test('batch: per-row bucket field is populated and matches per-row classifier', () => {
  const inputs = [
    row({
      source: 'a',
      hoggZ: 2.5,
      hoggPValue: 0.01,
      hoggDispatch: 'HFR2-wilcoxon',
      mwZ: 2.5,
      mwPValue: 0.01,
    }),
    row({
      source: 'b',
      hoggZ: 0.4,
      hoggPValue: 0.7,
      hoggDispatch: 'HFR3-vanderwaerden',
      mwZ: 2.5,
      mwPValue: 0.01,
    }),
  ];
  const rep = classifyHoggAdaptiveMannWhitneyDispatchAgreementCompound(inputs);
  assert.equal(rep.rows[0]!.bucket, 'coherent-location-wilcoxon-dispatch');
  assert.equal(rep.rows[1]!.bucket, 'wilcoxon-only');
});

test('batch: aggregate invariant — sum of bucket counts equals rowsClassified', () => {
  const rep = classifyHoggAdaptiveMannWhitneyDispatchAgreementCompound([
    row({ source: 'a', hoggZ: 2.5, hoggPValue: 0.01, mwZ: 2.5, mwPValue: 0.01 }),
    row({ source: 'b', hoggZ: 0.4, hoggPValue: 0.7, mwZ: 0.4, mwPValue: 0.7 }),
    row({
      source: 'c',
      hoggZ: 2.5,
      hoggPValue: 0.01,
      hoggDispatch: 'HFR1-mood-median',
      mwZ: -2.5,
      mwPValue: 0.01,
    }),
  ]);
  let total = 0;
  for (const v of Object.values(rep.buckets)) total += v;
  assert.equal(total, rep.rowsClassified);
});

test('batch: throws on bad alpha at batch entrypoint', () => {
  assert.throws(
    () =>
      classifyHoggAdaptiveMannWhitneyDispatchAgreementCompound([], 0),
    /alpha must be in/,
  );
});
