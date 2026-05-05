import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMielkeMoodTailVsBulkCompound } from '../src/classifymielkemoodtailvsbulkcompound.js';

test('compound mielke+mood: empty inputs return empty report', () => {
  const r = classifyMielkeMoodTailVsBulkCompound([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.signConflicts, 0);
  assert.equal(r.unanimousAgreement, 0);
  assert.equal(r.alpha, 0.05);
  assert.equal(r.tolerance, 1e-9);
  assert.deepEqual(r.sourcesOnlyInMielke, []);
  assert.deepEqual(r.sourcesOnlyInMood, []);
});

test('compound mielke+mood: validates alpha range', () => {
  assert.throws(() => classifyMielkeMoodTailVsBulkCompound([], [], 0));
  assert.throws(() => classifyMielkeMoodTailVsBulkCompound([], [], 0.6));
  assert.throws(() => classifyMielkeMoodTailVsBulkCompound([], [], Number.NaN));
});

test('compound mielke+mood: validates tolerance', () => {
  assert.throws(() =>
    classifyMielkeMoodTailVsBulkCompound([], [], 0.05, -1),
  );
  assert.throws(() =>
    classifyMielkeMoodTailVsBulkCompound([], [], 0.05, Number.NaN),
  );
});

test('compound mielke+mood: rejects duplicate sources', () => {
  assert.throws(() =>
    classifyMielkeMoodTailVsBulkCompound(
      [
        { source: 'a', mielkeZ: 1, mielkePValue: 0.1 },
        { source: 'a', mielkeZ: 2, mielkePValue: 0.05 },
      ],
      [],
    ),
  );
  assert.throws(() =>
    classifyMielkeMoodTailVsBulkCompound(
      [],
      [
        { source: 'b', moodZ: 1, moodPValue: 0.1 },
        { source: 'b', moodZ: 2, moodPValue: 0.05 },
      ],
    ),
  );
});

test('compound mielke+mood: rejects invalid stat values', () => {
  assert.throws(() =>
    classifyMielkeMoodTailVsBulkCompound(
      [{ source: 'a', mielkeZ: Number.NaN, mielkePValue: 0.1 }],
      [],
    ),
  );
  assert.throws(() =>
    classifyMielkeMoodTailVsBulkCompound(
      [{ source: 'a', mielkeZ: 1, mielkePValue: 0 }],
      [],
    ),
  );
  assert.throws(() =>
    classifyMielkeMoodTailVsBulkCompound(
      [{ source: 'a', mielkeZ: 1, mielkePValue: 1.5 }],
      [],
    ),
  );
  assert.throws(() =>
    classifyMielkeMoodTailVsBulkCompound(
      [],
      [{ source: 'b', moodZ: Number.POSITIVE_INFINITY, moodPValue: 0.1 }],
    ),
  );
});

test('compound mielke+mood: rejects empty source string', () => {
  assert.throws(() =>
    classifyMielkeMoodTailVsBulkCompound(
      [{ source: '', mielkeZ: 1, mielkePValue: 0.1 }],
      [],
    ),
  );
});

test('compound mielke+mood: tail-amplified-second when |mielke|>>|mood| both positive and decisive', () => {
  const r = classifyMielkeMoodTailVsBulkCompound(
    [{ source: 'a', mielkeZ: 5.95, mielkePValue: 2.6e-9 }],
    [{ source: 'a', moodZ: 2.1, moodPValue: 0.036 }],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].bucket, 'tail-amplified-second');
  assert.equal(r.bucketCounts['tail-amplified-second'], 1);
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.atLeastOneDecisive, 1);
  assert.equal(r.unanimousAgreement, 1);
  assert.equal(r.signConflicts, 0);
});

test('compound mielke+mood: tail-amplified-first when both negative and |mielke|>|mood|', () => {
  const r = classifyMielkeMoodTailVsBulkCompound(
    [{ source: 'a', mielkeZ: -3.2, mielkePValue: 0.001 }],
    [{ source: 'a', moodZ: -2.0, moodPValue: 0.045 }],
  );
  assert.equal(r.rows[0].bucket, 'tail-amplified-first');
  assert.equal(r.bucketCounts['tail-amplified-first'], 1);
  assert.equal(r.unanimousAgreement, 1);
});

test('compound mielke+mood: bulk-amplified-second when |mood|>|mielke| both positive', () => {
  const r = classifyMielkeMoodTailVsBulkCompound(
    [{ source: 'a', mielkeZ: 1.2, mielkePValue: 0.23 }],
    [{ source: 'a', moodZ: 3.5, moodPValue: 4.6e-4 }],
  );
  assert.equal(r.rows[0].bucket, 'bulk-amplified-second');
  assert.equal(r.bucketCounts['bulk-amplified-second'], 1);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 1);
  assert.equal(r.unanimousAgreement, 1);
});

test('compound mielke+mood: bulk-amplified-first when |mood|>|mielke| both negative', () => {
  const r = classifyMielkeMoodTailVsBulkCompound(
    [{ source: 'a', mielkeZ: -1.0, mielkePValue: 0.32 }],
    [{ source: 'a', moodZ: -2.5, moodPValue: 0.012 }],
  );
  assert.equal(r.rows[0].bucket, 'bulk-amplified-first');
  assert.equal(r.unanimousAgreement, 1);
});

test('compound mielke+mood: coherent when |mielke|≈|mood| within tolerance and any decisive', () => {
  const r = classifyMielkeMoodTailVsBulkCompound(
    [{ source: 'a', mielkeZ: 2.5, mielkePValue: 0.012 }],
    [{ source: 'a', moodZ: 2.5, moodPValue: 0.012 }],
  );
  assert.equal(r.rows[0].bucket, 'coherent');
  assert.equal(r.bucketCounts.coherent, 1);
  assert.equal(r.unanimousAgreement, 1);
});

test('compound mielke+mood: sign-conflict when signs disagree and any decisive', () => {
  const r = classifyMielkeMoodTailVsBulkCompound(
    [{ source: 'a', mielkeZ: 2.3, mielkePValue: 0.021 }],
    [{ source: 'a', moodZ: -2.4, moodPValue: 0.016 }],
  );
  assert.equal(r.rows[0].bucket, 'sign-conflict');
  assert.equal(r.signConflicts, 1);
  assert.equal(r.unanimousAgreement, 0);
  assert.equal(r.bothDecisive, 1);
});

test('compound mielke+mood: no-evidence when neither decisive', () => {
  const r = classifyMielkeMoodTailVsBulkCompound(
    [{ source: 'a', mielkeZ: 0.4, mielkePValue: 0.69 }],
    [{ source: 'a', moodZ: 0.5, moodPValue: 0.62 }],
  );
  assert.equal(r.rows[0].bucket, 'no-evidence');
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.unanimousAgreement, 0);
});

test('compound mielke+mood: sign-conflict ignored when neither decisive', () => {
  const r = classifyMielkeMoodTailVsBulkCompound(
    [{ source: 'a', mielkeZ: 0.5, mielkePValue: 0.62 }],
    [{ source: 'a', moodZ: -0.4, moodPValue: 0.69 }],
  );
  assert.equal(r.rows[0].bucket, 'no-evidence');
  assert.equal(r.signConflicts, 0);
});

test('compound mielke+mood: zero-Z on one side does NOT trigger sign-conflict', () => {
  const r = classifyMielkeMoodTailVsBulkCompound(
    [{ source: 'a', mielkeZ: 0, mielkePValue: 0.04 }],
    [{ source: 'a', moodZ: -2.5, moodPValue: 0.012 }],
  );
  assert.notEqual(r.rows[0].bucket, 'sign-conflict');
  assert.equal(r.signConflicts, 0);
});

test('compound mielke+mood: tracks asymmetric source membership', () => {
  const r = classifyMielkeMoodTailVsBulkCompound(
    [
      { source: 'a', mielkeZ: 1, mielkePValue: 0.3 },
      { source: 'b', mielkeZ: 2, mielkePValue: 0.04 },
    ],
    [
      { source: 'a', moodZ: 1, moodPValue: 0.3 },
      { source: 'c', moodZ: 2, moodPValue: 0.04 },
    ],
  );
  assert.deepEqual(r.sourcesOnlyInMielke, ['b']);
  assert.deepEqual(r.sourcesOnlyInMood, ['c']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].source, 'a');
});

test('compound mielke+mood: rows are deterministically source-asc ordered', () => {
  const r = classifyMielkeMoodTailVsBulkCompound(
    [
      { source: 'zebra', mielkeZ: 1, mielkePValue: 0.3 },
      { source: 'alpha', mielkeZ: 2, mielkePValue: 0.04 },
      { source: 'mango', mielkeZ: 0, mielkePValue: 0.5 },
    ],
    [
      { source: 'mango', moodZ: 0, moodPValue: 0.5 },
      { source: 'alpha', moodZ: 2, moodPValue: 0.04 },
      { source: 'zebra', moodZ: 1, moodPValue: 0.3 },
    ],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['alpha', 'mango', 'zebra'],
  );
});

test('compound mielke+mood: tolerance parameter widens coherent boundary', () => {
  const r = classifyMielkeMoodTailVsBulkCompound(
    [{ source: 'a', mielkeZ: 2.6, mielkePValue: 0.0093 }],
    [{ source: 'a', moodZ: 2.5, moodPValue: 0.012 }],
    0.05,
    0.5,
  );
  assert.equal(r.rows[0].bucket, 'coherent');
  assert.equal(r.tolerance, 0.5);
});

test('compound mielke+mood: bucketCounts sum equals row count', () => {
  const r = classifyMielkeMoodTailVsBulkCompound(
    [
      { source: 'a', mielkeZ: 5.95, mielkePValue: 2.6e-9 },
      { source: 'b', mielkeZ: -3.2, mielkePValue: 0.001 },
      { source: 'c', mielkeZ: 0.4, mielkePValue: 0.69 },
      { source: 'd', mielkeZ: 1.2, mielkePValue: 0.23 },
    ],
    [
      { source: 'a', moodZ: 2.1, moodPValue: 0.036 },
      { source: 'b', moodZ: -2.0, moodPValue: 0.045 },
      { source: 'c', moodZ: 0.5, moodPValue: 0.62 },
      { source: 'd', moodZ: 3.5, moodPValue: 4.6e-4 },
    ],
  );
  const total = Object.values(r.bucketCounts).reduce((a, b) => a + b, 0);
  assert.equal(total, r.rows.length);
  assert.equal(total, 4);
  assert.equal(r.bucketCounts['tail-amplified-second'], 1);
  assert.equal(r.bucketCounts['tail-amplified-first'], 1);
  assert.equal(r.bucketCounts['no-evidence'], 1);
  assert.equal(r.bucketCounts['bulk-amplified-second'], 1);
});
