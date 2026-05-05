import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound,
  summarizeAxis207Axis206PitmanMssdJonckheereTerpstraReport,
} from '../src/classifyaxis207axis206pitmanmssdjonckheereterpstraserialvsblocktrendcompound.js';

// ---------- validation ----------

test('compound: throws on invalid alpha', () => {
  assert.throws(() =>
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound([], [], 0),
  );
  assert.throws(() =>
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound([], [], 0.6),
  );
  assert.throws(() =>
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound([], [], Number.NaN),
  );
});

test('compound: throws on duplicate pitman-mssd source', () => {
  assert.throws(() =>
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [
        { source: 's', ppZ: 1, ppPValue: 0.5 },
        { source: 's', ppZ: 2, ppPValue: 0.4 },
      ],
      [],
    ),
  );
});

test('compound: throws on duplicate jt source', () => {
  assert.throws(() =>
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [],
      [
        { source: 's', jtZ: 1, jtPValue: 0.5 },
        { source: 's', jtZ: 2, jtPValue: 0.4 },
      ],
    ),
  );
});

test('compound: throws on invalid pitman ppZ', () => {
  assert.throws(() =>
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 's', ppZ: Number.NaN, ppPValue: 0.5 }],
      [],
    ),
  );
});

test('compound: throws on pitman ppPValue out of range', () => {
  assert.throws(() =>
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 's', ppZ: 1, ppPValue: 0 }],
      [],
    ),
  );
  assert.throws(() =>
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 's', ppZ: 1, ppPValue: 1.1 }],
      [],
    ),
  );
});

test('compound: throws on invalid jt jtZ', () => {
  assert.throws(() =>
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [],
      [{ source: 's', jtZ: Number.POSITIVE_INFINITY, jtPValue: 0.5 }],
    ),
  );
});

test('compound: throws on empty source string', () => {
  assert.throws(() =>
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: '', ppZ: 1, ppPValue: 0.5 }],
      [],
    ),
  );
});

// ---------- empty / asymmetric inputs ----------

test('compound: empty inputs give empty rows and zero counts', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound([], []);
  assert.deepEqual(r.rows, []);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
});

test('compound: source only in pitman surfaces', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 'lone', ppZ: 1, ppPValue: 0.5 }],
      [],
    );
  assert.deepEqual(r.sourcesOnlyInPitmanMssd, ['lone']);
  assert.deepEqual(r.sourcesOnlyInJonckheereTerpstra, []);
  assert.equal(r.rows.length, 0);
});

test('compound: source only in jt surfaces', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [],
      [{ source: 'lone', jtZ: 1, jtPValue: 0.5 }],
    );
  assert.deepEqual(r.sourcesOnlyInJonckheereTerpstra, ['lone']);
  assert.deepEqual(r.sourcesOnlyInPitmanMssd, []);
});

// ---------- bucket assignment ----------

test('compound: bucket = no-evidence when both p > alpha', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 's', ppZ: 0.5, ppPValue: 0.5 }],
      [{ source: 's', jtZ: 0.5, jtPValue: 0.5 }],
    );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bucketCounts['no-evidence'], 1);
  assert.equal(r.byJointSignQuadrant.anyMissingDecisive, 1);
});

test('compound: bucket = lag1-only when only pp decisive', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 's', ppZ: -3, ppPValue: 0.001 }],
      [{ source: 's', jtZ: 0.5, jtPValue: 0.5 }],
    );
  assert.equal(r.rows[0]!.bucket, 'lag1-only');
  assert.equal(r.bucketCounts['lag1-only'], 1);
});

test('compound: bucket = block-trend-only when only jt decisive', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 's', ppZ: 0.5, ppPValue: 0.5 }],
      [{ source: 's', jtZ: 3, jtPValue: 0.001 }],
    );
  assert.equal(r.rows[0]!.bucket, 'block-trend-only');
});

test('compound: bucket = coherent-smooth-drift when both decisive AND ppZ<0', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 's', ppZ: -3, ppPValue: 0.001 }],
      [{ source: 's', jtZ: 3, jtPValue: 0.001 }],
    );
  assert.equal(r.rows[0]!.bucket, 'coherent-smooth-drift');
  assert.equal(r.rows[0]!.jointSignQuadrant, 'smoothBlockTrendUp');
  assert.equal(r.byJointSignQuadrant.smoothBlockTrendUp, 1);
});

test('compound: bucket = osc-with-block-trend when both decisive AND ppZ>0', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 's', ppZ: 3, ppPValue: 0.001 }],
      [{ source: 's', jtZ: 3, jtPValue: 0.001 }],
    );
  assert.equal(r.rows[0]!.bucket, 'osc-with-block-trend');
  assert.equal(r.rows[0]!.jointSignQuadrant, 'oscBlockTrendUp');
  assert.equal(r.byJointSignQuadrant.oscBlockTrendUp, 1);
});

test('compound: smoothBlockTrendDown quadrant', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 's', ppZ: -3, ppPValue: 0.001 }],
      [{ source: 's', jtZ: -3, jtPValue: 0.001 }],
    );
  assert.equal(r.rows[0]!.jointSignQuadrant, 'smoothBlockTrendDown');
});

test('compound: oscBlockTrendDown quadrant', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 's', ppZ: 3, ppPValue: 0.001 }],
      [{ source: 's', jtZ: -3, jtPValue: 0.001 }],
    );
  assert.equal(r.rows[0]!.jointSignQuadrant, 'oscBlockTrendDown');
});

// ---------- signal recoding ----------

test('compound: ppSmoothnessSignal = -ppZ', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 's', ppZ: -2.5, ppPValue: 0.05 }],
      [{ source: 's', jtZ: 0.5, jtPValue: 0.5 }],
    );
  assert.equal(r.rows[0]!.ppSmoothnessSignal, 2.5);
});

test('compound: jtTrendSignal = +jtZ', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 's', ppZ: 0.5, ppPValue: 0.5 }],
      [{ source: 's', jtZ: 2.5, jtPValue: 0.05 }],
    );
  assert.equal(r.rows[0]!.jtTrendSignal, 2.5);
});

// ---------- alpha sensitivity ----------

test('compound: alpha=0.01 makes p=0.04 non-decisive', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 's', ppZ: -2, ppPValue: 0.04 }],
      [{ source: 's', jtZ: 2, jtPValue: 0.04 }],
      0.01,
    );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
});

test('compound: alpha=0.10 makes p=0.07 decisive', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [{ source: 's', ppZ: -2, ppPValue: 0.07 }],
      [{ source: 's', jtZ: 2, jtPValue: 0.07 }],
      0.1,
    );
  assert.equal(r.rows[0]!.bucket, 'coherent-smooth-drift');
});

// ---------- ordering / invariants ----------

test('compound: rows ordered by source asc', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [
        { source: 'zebra', ppZ: 1, ppPValue: 0.5 },
        { source: 'alpha', ppZ: 1, ppPValue: 0.5 },
        { source: 'mango', ppZ: 1, ppPValue: 0.5 },
      ],
      [
        { source: 'zebra', jtZ: 1, jtPValue: 0.5 },
        { source: 'alpha', jtZ: 1, jtPValue: 0.5 },
        { source: 'mango', jtZ: 1, jtPValue: 0.5 },
      ],
    );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['alpha', 'mango', 'zebra'],
  );
});

test('compound: bucketCounts sums to rows.length', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [
        { source: 'a', ppZ: -3, ppPValue: 0.001 },
        { source: 'b', ppZ: 3, ppPValue: 0.001 },
        { source: 'c', ppZ: 0.5, ppPValue: 0.5 },
        { source: 'd', ppZ: -2, ppPValue: 0.04 },
      ],
      [
        { source: 'a', jtZ: 3, jtPValue: 0.001 },
        { source: 'b', jtZ: 3, jtPValue: 0.001 },
        { source: 'c', jtZ: 0.5, jtPValue: 0.5 },
        { source: 'd', jtZ: 0.5, jtPValue: 0.5 },
      ],
    );
  const sum = Object.values(r.bucketCounts).reduce((a, b) => a + b, 0);
  assert.equal(sum, r.rows.length);
  assert.equal(r.rows.length, 4);
});

test('compound: bothDecisive count is correct', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [
        { source: 'a', ppZ: -3, ppPValue: 0.001 },
        { source: 'b', ppZ: -3, ppPValue: 0.001 },
        { source: 'c', ppZ: 0.5, ppPValue: 0.5 },
      ],
      [
        { source: 'a', jtZ: 3, jtPValue: 0.001 },
        { source: 'b', jtZ: 0.5, jtPValue: 0.5 },
        { source: 'c', jtZ: 3, jtPValue: 0.001 },
      ],
    );
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.atLeastOneDecisive, 3);
});

test('compound: byJointSignQuadrant cross-tab sums to bothDecisive + anyMissingDecisive', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [
        { source: 'a', ppZ: -3, ppPValue: 0.001 },
        { source: 'b', ppZ: 3, ppPValue: 0.001 },
        { source: 'c', ppZ: -3, ppPValue: 0.001 },
        { source: 'd', ppZ: 0.5, ppPValue: 0.5 },
      ],
      [
        { source: 'a', jtZ: 3, jtPValue: 0.001 },
        { source: 'b', jtZ: -3, jtPValue: 0.001 },
        { source: 'c', jtZ: -3, jtPValue: 0.001 },
        { source: 'd', jtZ: 0.5, jtPValue: 0.5 },
      ],
    );
  const q = r.byJointSignQuadrant;
  assert.equal(q.smoothBlockTrendUp, 1);
  assert.equal(q.oscBlockTrendDown, 1);
  assert.equal(q.smoothBlockTrendDown, 1);
  assert.equal(q.anyMissingDecisive, 1);
  assert.equal(
    q.smoothBlockTrendUp +
      q.smoothBlockTrendDown +
      q.oscBlockTrendUp +
      q.oscBlockTrendDown +
      q.anyMissingDecisive,
    r.rows.length,
  );
});

// ---------- mixed dataset realism ----------

test('compound: mixed realistic dataset distributes across all 5 buckets', () => {
  const pp = [
    { source: 'pure-smooth', ppZ: -3.5, ppPValue: 0.001 },
    { source: 'pure-osc', ppZ: 3.0, ppPValue: 0.002 },
    { source: 'lag1-only-src', ppZ: -2.5, ppPValue: 0.01 },
    { source: 'block-only-src', ppZ: 0.4, ppPValue: 0.7 },
    { source: 'noise', ppZ: 0.1, ppPValue: 0.9 },
    { source: 'osc-trend', ppZ: 2.5, ppPValue: 0.01 },
  ];
  const jt = [
    { source: 'pure-smooth', jtZ: 3.0, jtPValue: 0.002 }, // coherent
    { source: 'pure-osc', jtZ: 3.0, jtPValue: 0.002 },     // osc-with-block
    { source: 'lag1-only-src', jtZ: 0.4, jtPValue: 0.7 }, // lag1-only
    { source: 'block-only-src', jtZ: 3.0, jtPValue: 0.001 }, // block-only
    { source: 'noise', jtZ: 0.1, jtPValue: 0.9 },          // no-evidence
    { source: 'osc-trend', jtZ: 3.0, jtPValue: 0.001 },    // osc-with-block
  ];
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(pp, jt);
  assert.equal(r.bucketCounts['coherent-smooth-drift'], 1);
  assert.equal(r.bucketCounts['osc-with-block-trend'], 2);
  assert.equal(r.bucketCounts['lag1-only'], 1);
  assert.equal(r.bucketCounts['block-trend-only'], 1);
  assert.equal(r.bucketCounts['no-evidence'], 1);
});

test('compound: ppDecisive / jtDecisive flags match alpha threshold', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [
        { source: 'a', ppZ: -3, ppPValue: 0.04 },
        { source: 'b', ppZ: -3, ppPValue: 0.06 },
      ],
      [
        { source: 'a', jtZ: 3, jtPValue: 0.04 },
        { source: 'b', jtZ: 3, jtPValue: 0.06 },
      ],
      0.05,
    );
  assert.equal(r.rows[0]!.ppDecisive, true);
  assert.equal(r.rows[0]!.jtDecisive, true);
  assert.equal(r.rows[1]!.ppDecisive, false);
  assert.equal(r.rows[1]!.jtDecisive, false);
});

test('compound: jointSignQuadrant is null when not bothDecisive', () => {
  const r =
    classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
      [
        { source: 'pp-only', ppZ: -3, ppPValue: 0.001 },
        { source: 'jt-only', ppZ: 0.5, ppPValue: 0.5 },
        { source: 'no-decisive', ppZ: 0.5, ppPValue: 0.5 },
      ],
      [
        { source: 'pp-only', jtZ: 0.5, jtPValue: 0.5 },
        { source: 'jt-only', jtZ: 3, jtPValue: 0.001 },
        { source: 'no-decisive', jtZ: 0.5, jtPValue: 0.5 },
      ],
    );
  for (const row of r.rows) {
    assert.equal(row.jointSignQuadrant, null);
  }
});

// ---------- summarizeAxis207Axis206PitmanMssdJonckheereTerpstraReport ----------

test('summarize: empty report renders zeros and stamps alpha', () => {
  const r = classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound([], [], 0.05);
  const s = summarizeAxis207Axis206PitmanMssdJonckheereTerpstraReport(r);
  assert.equal(
    s,
    'axis-207xaxis-206 alpha=0.05 n=0 both=0/0 qd[smU/smD/osU/osD]=0/0/0/0 buckets[csd/l1/bt/owb/ne]=0/0/0/0/0',
  );
});

test('summarize: format starts with axis-207xaxis-206 token and is single line', () => {
  const r = classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
    [{ source: 'a', ppZ: -3, ppPValue: 0.001 }],
    [{ source: 'a', jtZ: 4, jtPValue: 0.0001 }],
    0.05,
  );
  const s = summarizeAxis207Axis206PitmanMssdJonckheereTerpstraReport(r);
  assert.ok(s.startsWith('axis-207xaxis-206 '));
  assert.equal(s.includes('\n'), false);
});

test('summarize: counts reflect populated quadrants and buckets', () => {
  const r = classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
    [
      { source: 'csdUp', ppZ: -3.5, ppPValue: 0.0005 },
      { source: 'csdDown', ppZ: -3.0, ppPValue: 0.001 },
      { source: 'oscUp', ppZ: 3.5, ppPValue: 0.0005 },
      { source: 'lag1only', ppZ: -2.5, ppPValue: 0.01 },
      { source: 'btonly', ppZ: 0.4, ppPValue: 0.6 },
      { source: 'ne', ppZ: 0.2, ppPValue: 0.7 },
    ],
    [
      { source: 'csdUp', jtZ: 4.0, jtPValue: 0.0001 },
      { source: 'csdDown', jtZ: -4.0, jtPValue: 0.0001 },
      { source: 'oscUp', jtZ: 3.5, jtPValue: 0.0005 },
      { source: 'lag1only', jtZ: 0.3, jtPValue: 0.7 },
      { source: 'btonly', jtZ: 4.0, jtPValue: 0.0001 },
      { source: 'ne', jtZ: 0.4, jtPValue: 0.6 },
    ],
    0.05,
  );
  const s = summarizeAxis207Axis206PitmanMssdJonckheereTerpstraReport(r);
  assert.ok(s.includes('n=6'));
  assert.ok(s.includes('both=3/6'));
  assert.ok(s.includes('qd[smU/smD/osU/osD]=1/1/1/0'));
  assert.ok(s.includes('buckets[csd/l1/bt/owb/ne]=2/1/1/1/1'));
});

test('summarize: deterministic across repeated calls', () => {
  const r = classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
    [{ source: 'a', ppZ: 2.5, ppPValue: 0.01 }],
    [{ source: 'a', jtZ: -3.0, jtPValue: 0.002 }],
    0.05,
  );
  const a = summarizeAxis207Axis206PitmanMssdJonckheereTerpstraReport(r);
  const b = summarizeAxis207Axis206PitmanMssdJonckheereTerpstraReport(r);
  assert.equal(a, b);
});

test('summarize: alpha stamp reflects classifier alpha', () => {
  const r = classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound([], [], 0.01);
  const s = summarizeAxis207Axis206PitmanMssdJonckheereTerpstraReport(r);
  assert.ok(s.includes('alpha=0.01'));
});
