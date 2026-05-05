import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAxis211Axis210BrownMoodDanielsMedianBinaryVsContinuousRankTrendCompound as classify,
  summarizeAxis211Axis210BrownMoodDanielsReport as summarize,
} from '../src/classifyaxis211axis210brownmooddanielsmedianbinaryvscontinuousranktrendcompound.ts';

const ALPHA = 0.05;
// Helpers: bmZ < 0 is up-trend; bmZ > 0 is down-trend.
// drZ > 0 is up-trend; drZ < 0 is down-trend.
const decisivePValue = 0.001;
const nonDecisivePValue = 0.5;

// ----- happy path: empty inputs -----

test('classify: empty input returns empty report', () => {
  const r = classify([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  for (const v of Object.values(r.bucketCounts)) assert.equal(v, 0);
  assert.deepEqual(r.sourcesOnlyInBrownMood, []);
  assert.deepEqual(r.sourcesOnlyInDaniels, []);
});

// ----- bucket: robust-up-trend -----

test('classify: robust-up-trend (both decisive, both up-direction)', () => {
  const r = classify(
    [{ source: 's1', bmZ: -3.0, bmPValue: decisivePValue }],
    [{ source: 's1', drZ: 2.5, drPValue: decisivePValue }],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.bucket, 'robust-up-trend');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, 'robustUp');
  assert.equal(r.rows[0]!.bmTrendUpSignal, 3.0);
  assert.equal(r.rows[0]!.drTrendUpSignal, 2.5);
  assert.equal(r.bucketCounts['robust-up-trend'], 1);
  assert.equal(r.byJointDirectionQuadrant.robustUp, 1);
  assert.equal(r.bothDecisive, 1);
});

// ----- bucket: robust-down-trend -----

test('classify: robust-down-trend (both decisive, both down-direction)', () => {
  const r = classify(
    [{ source: 's1', bmZ: 2.8, bmPValue: decisivePValue }],
    [{ source: 's1', drZ: -2.5, drPValue: decisivePValue }],
  );
  assert.equal(r.rows[0]!.bucket, 'robust-down-trend');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, 'robustDown');
  assert.equal(r.byJointDirectionQuadrant.robustDown, 1);
});

// ----- bucket: direction-conflict (BM up, DR down) -----

test('classify: direction-conflict bm-up dr-down', () => {
  const r = classify(
    [{ source: 's1', bmZ: -3.0, bmPValue: decisivePValue }], // BM up
    [{ source: 's1', drZ: -2.5, drPValue: decisivePValue }], // DR down
  );
  assert.equal(r.rows[0]!.bucket, 'direction-conflict');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, 'conflictBmUpDrDown');
  assert.equal(r.byJointDirectionQuadrant.conflictBmUpDrDown, 1);
});

// ----- bucket: direction-conflict (BM down, DR up) -----

test('classify: direction-conflict bm-down dr-up', () => {
  const r = classify(
    [{ source: 's1', bmZ: 3.0, bmPValue: decisivePValue }], // BM down
    [{ source: 's1', drZ: 2.5, drPValue: decisivePValue }], // DR up
  );
  assert.equal(r.rows[0]!.bucket, 'direction-conflict');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, 'conflictBmDownDrUp');
  assert.equal(r.byJointDirectionQuadrant.conflictBmDownDrUp, 1);
});

// ----- bucket: daniels-only -----

test('classify: daniels-only (DR decisive, BM not)', () => {
  const r = classify(
    [{ source: 's1', bmZ: 0.5, bmPValue: nonDecisivePValue }],
    [{ source: 's1', drZ: 2.5, drPValue: decisivePValue }],
  );
  assert.equal(r.rows[0]!.bucket, 'daniels-only');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, null);
  assert.equal(r.byJointDirectionQuadrant.anyMissingDecisive, 1);
});

// ----- bucket: brown-mood-only-up -----

test('classify: brown-mood-only-up (BM decisive up, DR not)', () => {
  const r = classify(
    [{ source: 's1', bmZ: -3.0, bmPValue: decisivePValue }],
    [{ source: 's1', drZ: 0.3, drPValue: nonDecisivePValue }],
  );
  assert.equal(r.rows[0]!.bucket, 'brown-mood-only-up');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, null);
});

// ----- bucket: brown-mood-only-down -----

test('classify: brown-mood-only-down (BM decisive down, DR not)', () => {
  const r = classify(
    [{ source: 's1', bmZ: 3.0, bmPValue: decisivePValue }],
    [{ source: 's1', drZ: -0.3, drPValue: nonDecisivePValue }],
  );
  assert.equal(r.rows[0]!.bucket, 'brown-mood-only-down');
});

// ----- bucket: no-evidence -----

test('classify: no-evidence (neither decisive)', () => {
  const r = classify(
    [{ source: 's1', bmZ: 0.5, bmPValue: nonDecisivePValue }],
    [{ source: 's1', drZ: 0.5, drPValue: nonDecisivePValue }],
  );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
});

// ----- alpha sensitivity -----

test('classify: alpha=0.01 makes a borderline pvalue non-decisive', () => {
  const r = classify(
    [{ source: 's1', bmZ: -2.0, bmPValue: 0.04 }],
    [{ source: 's1', drZ: 2.0, drPValue: 0.04 }],
    0.01,
  );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
});

test('classify: alpha=0.10 promotes a borderline pvalue to decisive', () => {
  const r = classify(
    [{ source: 's1', bmZ: -2.0, bmPValue: 0.07 }],
    [{ source: 's1', drZ: 2.0, drPValue: 0.07 }],
    0.10,
  );
  assert.equal(r.rows[0]!.bucket, 'robust-up-trend');
});

test('classify: rejects alpha <= 0', () => {
  assert.throws(() => classify([], [], 0));
});

test('classify: rejects alpha > 0.5', () => {
  assert.throws(() => classify([], [], 0.6));
});

test('classify: rejects non-finite alpha', () => {
  assert.throws(() => classify([], [], NaN));
});

// ----- input validation: brown-mood rows -----

test('classify: rejects bm row with empty source', () => {
  assert.throws(() =>
    classify([{ source: '', bmZ: 1, bmPValue: 0.1 }], []),
  );
});

test('classify: rejects bm row with non-finite bmZ', () => {
  assert.throws(() =>
    classify([{ source: 's', bmZ: NaN, bmPValue: 0.1 }], []),
  );
});

test('classify: rejects bm row with bmPValue = 0', () => {
  assert.throws(() =>
    classify([{ source: 's', bmZ: 1, bmPValue: 0 }], []),
  );
});

test('classify: rejects bm row with bmPValue > 1', () => {
  assert.throws(() =>
    classify([{ source: 's', bmZ: 1, bmPValue: 1.5 }], []),
  );
});

test('classify: rejects duplicate bm source', () => {
  assert.throws(() =>
    classify(
      [
        { source: 's1', bmZ: 1, bmPValue: 0.1 },
        { source: 's1', bmZ: 2, bmPValue: 0.2 },
      ],
      [],
    ),
  );
});

// ----- input validation: daniels rows -----

test('classify: rejects dr row with non-finite drPValue', () => {
  assert.throws(() =>
    classify([], [{ source: 's', drZ: 1, drPValue: NaN }]),
  );
});

test('classify: rejects dr row with empty source', () => {
  assert.throws(() =>
    classify([], [{ source: '', drZ: 1, drPValue: 0.1 }]),
  );
});

test('classify: rejects duplicate dr source', () => {
  assert.throws(() =>
    classify(
      [],
      [
        { source: 's1', drZ: 1, drPValue: 0.1 },
        { source: 's1', drZ: 2, drPValue: 0.2 },
      ],
    ),
  );
});

// ----- asymmetric coverage -----

test('classify: tracks sourcesOnlyInBrownMood', () => {
  const r = classify(
    [
      { source: 'a', bmZ: 1, bmPValue: 0.1 },
      { source: 'b', bmZ: 1, bmPValue: 0.1 },
    ],
    [{ source: 'a', drZ: 1, drPValue: 0.1 }],
  );
  assert.deepEqual(r.sourcesOnlyInBrownMood, ['b']);
  assert.deepEqual(r.sourcesOnlyInDaniels, []);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'a');
});

test('classify: tracks sourcesOnlyInDaniels', () => {
  const r = classify(
    [{ source: 'a', bmZ: 1, bmPValue: 0.1 }],
    [
      { source: 'a', drZ: 1, drPValue: 0.1 },
      { source: 'b', drZ: 1, drPValue: 0.1 },
    ],
  );
  assert.deepEqual(r.sourcesOnlyInDaniels, ['b']);
  assert.deepEqual(r.sourcesOnlyInBrownMood, []);
});

test('classify: only-in lists are sorted ascending', () => {
  const r = classify(
    [
      { source: 'zeta', bmZ: 1, bmPValue: 0.1 },
      { source: 'alpha', bmZ: 1, bmPValue: 0.1 },
      { source: 'mu', bmZ: 1, bmPValue: 0.1 },
    ],
    [],
  );
  assert.deepEqual(r.sourcesOnlyInBrownMood, ['alpha', 'mu', 'zeta']);
});

// ----- joined source ordering -----

test('classify: joined sources are sorted ascending in rows[]', () => {
  const r = classify(
    [
      { source: 'zeta', bmZ: 1, bmPValue: 0.1 },
      { source: 'alpha', bmZ: 1, bmPValue: 0.1 },
      { source: 'mu', bmZ: 1, bmPValue: 0.1 },
    ],
    [
      { source: 'mu', drZ: 1, drPValue: 0.1 },
      { source: 'alpha', drZ: 1, drPValue: 0.1 },
      { source: 'zeta', drZ: 1, drPValue: 0.1 },
    ],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['alpha', 'mu', 'zeta'],
  );
});

// ----- bucket-counts accounting -----

test('classify: bucketCounts sums to rows.length', () => {
  const r = classify(
    [
      { source: 'a', bmZ: -3, bmPValue: 0.001 }, // robust-up
      { source: 'b', bmZ: 3, bmPValue: 0.001 }, // bm-only-down
      { source: 'c', bmZ: 0.5, bmPValue: 0.5 }, // dr-only
      { source: 'd', bmZ: 0.5, bmPValue: 0.5 }, // no-evidence
    ],
    [
      { source: 'a', drZ: 3, drPValue: 0.001 },
      { source: 'b', drZ: 0.5, drPValue: 0.5 },
      { source: 'c', drZ: 3, drPValue: 0.001 },
      { source: 'd', drZ: 0.5, drPValue: 0.5 },
    ],
  );
  let sum = 0;
  for (const v of Object.values(r.bucketCounts)) sum += v;
  assert.equal(sum, r.rows.length);
  assert.equal(r.bucketCounts['robust-up-trend'], 1);
  assert.equal(r.bucketCounts['brown-mood-only-down'], 1);
  assert.equal(r.bucketCounts['daniels-only'], 1);
  assert.equal(r.bucketCounts['no-evidence'], 1);
});

// ----- atLeastOneDecisive accounting -----

test('classify: atLeastOneDecisive counts unions correctly', () => {
  const r = classify(
    [
      { source: 'a', bmZ: -3, bmPValue: 0.001 },
      { source: 'b', bmZ: 0.5, bmPValue: 0.5 },
      { source: 'c', bmZ: 0.5, bmPValue: 0.5 },
    ],
    [
      { source: 'a', drZ: 3, drPValue: 0.001 },
      { source: 'b', drZ: 3, drPValue: 0.001 },
      { source: 'c', drZ: 0.5, drPValue: 0.5 },
    ],
  );
  assert.equal(r.atLeastOneDecisive, 2);
  assert.equal(r.bothDecisive, 1);
});

// ----- jointDirectionQuadrant nullity -----

test('classify: jointDirectionQuadrant null when not bothDecisive', () => {
  const r = classify(
    [{ source: 's', bmZ: -3, bmPValue: 0.001 }],
    [{ source: 's', drZ: 0.5, drPValue: 0.5 }],
  );
  assert.equal(r.rows[0]!.jointDirectionQuadrant, null);
});

// ----- TrendUpSignal sign-inversion correctness -----

test('classify: bmTrendUpSignal inverts bmZ', () => {
  const r = classify(
    [{ source: 's', bmZ: -2.5, bmPValue: 0.5 }],
    [{ source: 's', drZ: 0, drPValue: 0.5 }],
  );
  assert.equal(r.rows[0]!.bmTrendUpSignal, 2.5);
});

test('classify: drTrendUpSignal preserves drZ', () => {
  const r = classify(
    [{ source: 's', bmZ: 0, bmPValue: 0.5 }],
    [{ source: 's', drZ: -1.7, drPValue: 0.5 }],
  );
  assert.equal(r.rows[0]!.drTrendUpSignal, -1.7);
});

// ----- summarize -----

test('summarize: empty report', () => {
  const r = classify([], []);
  const s = summarize(r);
  assert.match(s, /axis-211xaxis-210/);
  assert.match(s, /alpha=0\.05/);
  assert.match(s, /n=0/);
  assert.match(s, /both=0\/0/);
});

test('summarize: includes bucket counts', () => {
  const r = classify(
    [{ source: 'a', bmZ: -3, bmPValue: 0.001 }],
    [{ source: 'a', drZ: 3, drPValue: 0.001 }],
  );
  const s = summarize(r);
  assert.match(s, /buckets\[ru\/rd\/dc\/do\/bmu\/bmd\/ne\]=1\/0\/0\/0\/0\/0\/0/);
  assert.match(s, /qd\[rUp\/rDn\/cBuDd\/cBdDu\]=1\/0\/0\/0/);
});

test('summarize: includes alpha override', () => {
  const r = classify([], [], 0.10);
  const s = summarize(r);
  assert.match(s, /alpha=0\.1/);
});

// ----- realistic multi-source scenario -----

test('classify: realistic 5-source pew live-smoke replay', () => {
  // Replays the live-smoke axis-211 numbers paired with a plausible axis-210
  // signature: claude-code (BM up, DR up) -> robust-up; openclaw (BM down,
  // DR down per axis-210 v0.6.523) -> robust-down; opencode (BM down,
  // DR ~0) -> bm-only-down; vsc-redacted (BM down, DR down) -> robust-down;
  // hermes (neither) -> no-evidence.
  const bm = [
    { source: 'claude-code', bmZ: -2.5937, bmPValue: 9.494e-3 },
    { source: 'hermes', bmZ: -1.1624, bmPValue: 2.451e-1 },
    { source: 'openclaw', bmZ: 2.5185, bmPValue: 1.179e-2 },
    { source: 'opencode', bmZ: 2.0, bmPValue: 4.55e-2 },
    { source: 'vsc-redacted', bmZ: 2.1004, bmPValue: 3.569e-2 },
  ];
  const dr = [
    { source: 'claude-code', drZ: 4.0682, drPValue: 4.74e-5 },
    { source: 'hermes', drZ: 0.5657, drPValue: 5.716e-1 },
    { source: 'openclaw', drZ: -2.9029, drPValue: 3.698e-3 },
    { source: 'opencode', drZ: -1.4125, drPValue: 1.578e-1 },
    { source: 'vsc-redacted', drZ: -2.1731, drPValue: 2.977e-2 },
  ];
  const r = classify(bm, dr);
  assert.equal(r.rows.length, 5);
  const bySrc = Object.fromEntries(r.rows.map((x) => [x.source, x.bucket]));
  assert.equal(bySrc['claude-code'], 'robust-up-trend');
  assert.equal(bySrc['openclaw'], 'robust-down-trend');
  assert.equal(bySrc['vsc-redacted'], 'robust-down-trend');
  assert.equal(bySrc['opencode'], 'brown-mood-only-down');
  assert.equal(bySrc['hermes'], 'no-evidence');
  assert.equal(r.bucketCounts['robust-up-trend'], 1);
  assert.equal(r.bucketCounts['robust-down-trend'], 2);
  assert.equal(r.bucketCounts['brown-mood-only-down'], 1);
  assert.equal(r.bucketCounts['no-evidence'], 1);
  assert.equal(r.bucketCounts['direction-conflict'], 0);
  assert.equal(r.bothDecisive, 3);
  assert.equal(r.atLeastOneDecisive, 4);
});
