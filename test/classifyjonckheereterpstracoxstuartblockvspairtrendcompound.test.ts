import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound } from '../src/classifyjonckheereterpstracoxstuartblockvspairtrendcompound.js';

const ALPHA = 0.05;

// ---------- input validation ----------

test('classifier: rejects alpha out of (0, 0.5]', () => {
  assert.throws(() =>
    classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound([], [], 0),
  );
  assert.throws(() =>
    classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound([], [], 0.6),
  );
  assert.throws(() =>
    classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
      [],
      [],
      Number.NaN,
    ),
  );
});

test('classifier: rejects empty source string', () => {
  assert.throws(() =>
    classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
      [{ source: '', jtZ: 1, jtPValue: 0.5 }],
      [],
    ),
  );
});

test('classifier: rejects non-finite jtZ', () => {
  assert.throws(() =>
    classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
      [{ source: 'a', jtZ: Number.NaN, jtPValue: 0.5 }],
      [],
    ),
  );
});

test('classifier: rejects p-value <= 0 or > 1', () => {
  assert.throws(() =>
    classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
      [{ source: 'a', jtZ: 1, jtPValue: 0 }],
      [],
    ),
  );
  assert.throws(() =>
    classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
      [{ source: 'a', jtZ: 1, jtPValue: 1.5 }],
      [],
    ),
  );
});

test('classifier: rejects duplicate source in jt rows', () => {
  assert.throws(() =>
    classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
      [
        { source: 'a', jtZ: 1, jtPValue: 0.5 },
        { source: 'a', jtZ: 2, jtPValue: 0.5 },
      ],
      [],
    ),
  );
});

test('classifier: rejects duplicate source in cs rows', () => {
  assert.throws(() =>
    classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
      [],
      [
        { source: 'a', csZ: 1, csPValue: 0.5 },
        { source: 'a', csZ: 2, csPValue: 0.5 },
      ],
    ),
  );
});

// ---------- buckets ----------

test('classifier: no-evidence bucket', () => {
  const r = classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
    [{ source: 'a', jtZ: 0.3, jtPValue: 0.7 }],
    [{ source: 'a', csZ: 0.2, csPValue: 0.8 }],
    ALPHA,
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bucketCounts['no-evidence'], 1);
});

test('classifier: block-aggregate-only bucket', () => {
  const r = classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
    [{ source: 'a', jtZ: 3.5, jtPValue: 0.0001 }],
    [{ source: 'a', csZ: 0.5, csPValue: 0.6 }],
    ALPHA,
  );
  assert.equal(r.rows[0]!.bucket, 'block-aggregate-only');
  assert.equal(r.bucketCounts['block-aggregate-only'], 1);
  assert.equal(r.scaleSpecificRows, 1);
});

test('classifier: paired-sign-only bucket', () => {
  const r = classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
    [{ source: 'a', jtZ: 0.5, jtPValue: 0.6 }],
    [{ source: 'a', csZ: -3.5, csPValue: 0.0001 }],
    ALPHA,
  );
  assert.equal(r.rows[0]!.bucket, 'paired-sign-only');
});

test('classifier: coherent-global-trend (up) bucket', () => {
  const r = classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
    [{ source: 'a', jtZ: 4, jtPValue: 1e-5 }],
    [{ source: 'a', csZ: 3, csPValue: 0.001 }],
    ALPHA,
  );
  assert.equal(r.rows[0]!.bucket, 'coherent-global-trend');
  assert.equal(r.rows[0]!.coherentTrendDirection, 'up');
  assert.equal(r.byCoherentDirection.up, 1);
  assert.equal(r.byCoherentDirection.down, 0);
});

test('classifier: coherent-global-trend (down) bucket', () => {
  const r = classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
    [{ source: 'a', jtZ: -4, jtPValue: 1e-5 }],
    [{ source: 'a', csZ: -3, csPValue: 0.001 }],
    ALPHA,
  );
  assert.equal(r.rows[0]!.coherentTrendDirection, 'down');
  assert.equal(r.byCoherentDirection.down, 1);
});

test('classifier: sign-conflict-decisive-both bucket', () => {
  const r = classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
    [{ source: 'a', jtZ: 4, jtPValue: 1e-5 }],
    [{ source: 'a', csZ: -3, csPValue: 0.001 }],
    ALPHA,
  );
  assert.equal(r.rows[0]!.bucket, 'sign-conflict-decisive-both');
  assert.equal(r.signConflictRows, 1);
});

// ---------- alpha sensitivity ----------

test('classifier: alpha sensitivity moves bucket from coherent to no-evidence', () => {
  const jt = [{ source: 'a', jtZ: 2.0, jtPValue: 0.046 }];
  const cs = [{ source: 'a', csZ: 1.99, csPValue: 0.047 }];
  const strict = classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
    jt,
    cs,
    0.01,
  );
  assert.equal(strict.rows[0]!.bucket, 'no-evidence');
  const loose = classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
    jt,
    cs,
    0.05,
  );
  assert.equal(loose.rows[0]!.bucket, 'coherent-global-trend');
});

// ---------- asymmetric membership ----------

test('classifier: sourcesOnlyIn lists report correctly', () => {
  const r = classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
    [
      { source: 'a', jtZ: 1, jtPValue: 0.5 },
      { source: 'b', jtZ: 1, jtPValue: 0.5 },
    ],
    [
      { source: 'b', csZ: 1, csPValue: 0.5 },
      { source: 'c', csZ: 1, csPValue: 0.5 },
    ],
  );
  assert.deepEqual(r.sourcesOnlyInJonckheereTerpstra, ['a']);
  assert.deepEqual(r.sourcesOnlyInCoxStuart, ['c']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'b');
});

// ---------- ordering / invariants ----------

test('classifier: source-asc row ordering', () => {
  const r = classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
    [
      { source: 'zebra', jtZ: 1, jtPValue: 0.5 },
      { source: 'alpha', jtZ: 1, jtPValue: 0.5 },
      { source: 'mango', jtZ: 1, jtPValue: 0.5 },
    ],
    [
      { source: 'mango', csZ: 1, csPValue: 0.5 },
      { source: 'zebra', csZ: 1, csPValue: 0.5 },
      { source: 'alpha', csZ: 1, csPValue: 0.5 },
    ],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['alpha', 'mango', 'zebra'],
  );
});

test('classifier: bucketCounts sum to row count', () => {
  const jt = [
    { source: 'a', jtZ: 4, jtPValue: 1e-5 },
    { source: 'b', jtZ: 0.3, jtPValue: 0.7 },
    { source: 'c', jtZ: -3, jtPValue: 0.001 },
    { source: 'd', jtZ: 0.5, jtPValue: 0.6 },
    { source: 'e', jtZ: 4, jtPValue: 1e-5 },
  ];
  const cs = [
    { source: 'a', csZ: 3, csPValue: 0.001 },
    { source: 'b', csZ: 0.2, csPValue: 0.8 },
    { source: 'c', csZ: 0.1, csPValue: 0.9 },
    { source: 'd', csZ: -2.5, csPValue: 0.012 },
    { source: 'e', csZ: -3, csPValue: 0.001 },
  ];
  const r = classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
    jt,
    cs,
  );
  let sum = 0;
  for (const v of Object.values(r.bucketCounts)) sum += v;
  assert.equal(sum, r.rows.length);
  assert.equal(sum, 5);
});

test('classifier: bothDecisive + atLeastOneDecisive correctness', () => {
  const r = classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
    [
      { source: 'a', jtZ: 4, jtPValue: 1e-5 },
      { source: 'b', jtZ: 0.3, jtPValue: 0.7 },
      { source: 'c', jtZ: 4, jtPValue: 1e-5 },
    ],
    [
      { source: 'a', csZ: 3, csPValue: 0.001 },
      { source: 'b', csZ: 3, csPValue: 0.001 },
      { source: 'c', csZ: 0.1, csPValue: 0.9 },
    ],
  );
  assert.equal(r.bothDecisive, 1); // only 'a'
  assert.equal(r.atLeastOneDecisive, 3);
});

test('classifier: empty inputs give empty bucketCounts but valid structure', () => {
  const r = classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
    [],
    [],
  );
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.coherentRows, 0);
  for (const v of Object.values(r.bucketCounts)) assert.equal(v, 0);
});

test('classifier: byCoherentDirection sums equal coherentRows', () => {
  const r = classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
    [
      { source: 'u1', jtZ: 4, jtPValue: 1e-5 },
      { source: 'u2', jtZ: 4, jtPValue: 1e-5 },
      { source: 'd1', jtZ: -4, jtPValue: 1e-5 },
    ],
    [
      { source: 'u1', csZ: 3, csPValue: 0.001 },
      { source: 'u2', csZ: 3, csPValue: 0.001 },
      { source: 'd1', csZ: -3, csPValue: 0.001 },
    ],
  );
  assert.equal(r.coherentRows, 3);
  assert.equal(
    r.byCoherentDirection.up + r.byCoherentDirection.down,
    r.coherentRows,
  );
  assert.equal(r.byCoherentDirection.up, 2);
  assert.equal(r.byCoherentDirection.down, 1);
});
