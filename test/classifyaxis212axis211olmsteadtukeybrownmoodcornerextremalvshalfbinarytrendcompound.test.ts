import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAxis212Axis211OlmsteadTukeyBrownMoodCornerExtremalVsHalfBinaryTrendCompound as classify,
  summarizeAxis212Axis211OlmsteadTukeyBrownMoodReport as summarize,
} from '../src/classifyaxis212axis211olmsteadtukeybrownmoodcornerextremalvshalfbinarytrendcompound.ts';

const otRow = (
  source: string,
  otQ: number,
  otPValue: number,
  otZ = otQ / Math.sqrt(8),
) => ({ source, otQ, otZ, otPValue });

const bmRow = (source: string, bmZ: number, bmPValue: number) => ({
  source,
  bmZ,
  bmPValue,
});

// ----- input validation -----

test('alpha must be in (0, 0.5]', () => {
  assert.throws(() => classify([], [], 0));
  assert.throws(() => classify([], [], -0.1));
  assert.throws(() => classify([], [], 0.51));
  assert.throws(() => classify([], [], NaN));
  assert.doesNotThrow(() => classify([], [], 0.05));
  assert.doesNotThrow(() => classify([], [], 0.5));
});

test('OT row: empty source rejected', () => {
  assert.throws(() => classify([otRow('', 5, 0.01)], []));
});

test('OT row: non-string source rejected', () => {
  assert.throws(() => classify([{ source: 5 as unknown as string, otQ: 1, otZ: 0.35, otPValue: 0.5 }], []));
});

test('OT row: NaN otQ rejected', () => {
  assert.throws(() => classify([otRow('a', NaN, 0.5)], []));
});

test('OT row: NaN otZ rejected', () => {
  assert.throws(() => classify([{ source: 'a', otQ: 1, otZ: NaN, otPValue: 0.5 }], []));
});

test('OT row: pvalue out of range rejected', () => {
  assert.throws(() => classify([otRow('a', 1, 0)], []));
  assert.throws(() => classify([otRow('a', 1, -0.1)], []));
  assert.throws(() => classify([otRow('a', 1, 1.5)], []));
});

test('OT row: duplicate source rejected', () => {
  assert.throws(() =>
    classify([otRow('a', 1, 0.5), otRow('a', 2, 0.4)], []),
  );
});

test('BM row: empty source rejected', () => {
  assert.throws(() => classify([], [bmRow('', 1, 0.5)]));
});

test('BM row: NaN bmZ rejected', () => {
  assert.throws(() => classify([], [bmRow('a', NaN, 0.5)]));
});

test('BM row: pvalue out of range rejected', () => {
  assert.throws(() => classify([], [bmRow('a', 1, 0)]));
  assert.throws(() => classify([], [bmRow('a', 1, 1.1)]));
});

test('BM row: duplicate source rejected', () => {
  assert.throws(() =>
    classify([], [bmRow('a', 1, 0.5), bmRow('a', 2, 0.5)]),
  );
});

// ----- empty / asymmetric inputs -----

test('empty inputs produce empty report with zero counts', () => {
  const r = classify([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  for (const v of Object.values(r.bucketCounts)) assert.equal(v, 0);
});

test('only OT rows: all surface as sourcesOnlyInOlmsteadTukey', () => {
  const r = classify([otRow('a', 5, 0.5), otRow('b', 5, 0.5)], []);
  assert.deepEqual(r.sourcesOnlyInOlmsteadTukey, ['a', 'b']);
  assert.deepEqual(r.sourcesOnlyInBrownMood, []);
  assert.equal(r.rows.length, 0);
});

test('only BM rows: all surface as sourcesOnlyInBrownMood', () => {
  const r = classify([], [bmRow('x', 1, 0.5), bmRow('y', 1, 0.5)]);
  assert.deepEqual(r.sourcesOnlyInBrownMood, ['x', 'y']);
  assert.deepEqual(r.sourcesOnlyInOlmsteadTukey, []);
});

test('asymmetric: only intersect joins', () => {
  const r = classify(
    [otRow('a', 5, 0.5), otRow('b', 1, 0.5)],
    [bmRow('b', 0.1, 0.5), bmRow('c', 0.1, 0.5)],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'b');
  assert.deepEqual(r.sourcesOnlyInOlmsteadTukey, ['a']);
  assert.deepEqual(r.sourcesOnlyInBrownMood, ['c']);
});

// ----- robust-up-trend bucket -----

test('robust-up-trend: otQ > 0 decisive AND bmZ < 0 decisive', () => {
  const r = classify(
    [otRow('s', 12, 0.001)],
    [bmRow('s', -3.5, 0.0005)],
  );
  assert.equal(r.rows[0]!.bucket, 'robust-up-trend');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, 'robustUp');
  assert.ok(r.rows[0]!.otTrendUpSignal > 0);
  assert.ok(r.rows[0]!.bmTrendUpSignal > 0);
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.bucketCounts['robust-up-trend'], 1);
  assert.equal(r.byJointDirectionQuadrant.robustUp, 1);
});

// ----- robust-down-trend -----

test('robust-down-trend: otQ < 0 decisive AND bmZ > 0 decisive', () => {
  const r = classify(
    [otRow('s', -12, 0.001)],
    [bmRow('s', 3.5, 0.0005)],
  );
  assert.equal(r.rows[0]!.bucket, 'robust-down-trend');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, 'robustDown');
  assert.ok(r.rows[0]!.otTrendUpSignal < 0);
  assert.ok(r.rows[0]!.bmTrendUpSignal < 0);
  assert.equal(r.byJointDirectionQuadrant.robustDown, 1);
});

// ----- direction-conflict (OT up, BM down) -----

test('direction-conflict: OT up + BM down', () => {
  const r = classify(
    [otRow('s', 12, 0.001)],
    [bmRow('s', 3.5, 0.0005)],
  );
  assert.equal(r.rows[0]!.bucket, 'direction-conflict');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, 'conflictOtUpBmDown');
  assert.equal(r.byJointDirectionQuadrant.conflictOtUpBmDown, 1);
});

// ----- direction-conflict (OT down, BM up) -----

test('direction-conflict: OT down + BM up', () => {
  const r = classify(
    [otRow('s', -12, 0.001)],
    [bmRow('s', -3.5, 0.0005)],
  );
  assert.equal(r.rows[0]!.bucket, 'direction-conflict');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, 'conflictOtDownBmUp');
  assert.equal(r.byJointDirectionQuadrant.conflictOtDownBmUp, 1);
});

// ----- single-decisive buckets -----

test('brown-mood-only-up: bm decisive (bmZ < 0), ot non-decisive', () => {
  const r = classify(
    [otRow('s', 0, 0.9)],
    [bmRow('s', -3.5, 0.001)],
  );
  assert.equal(r.rows[0]!.bucket, 'brown-mood-only-up');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, null);
  assert.equal(r.byJointDirectionQuadrant.anyMissingDecisive, 1);
});

test('brown-mood-only-down: bm decisive (bmZ > 0), ot non-decisive', () => {
  const r = classify(
    [otRow('s', 0, 0.9)],
    [bmRow('s', 3.5, 0.001)],
  );
  assert.equal(r.rows[0]!.bucket, 'brown-mood-only-down');
});

test('olmstead-tukey-only-up: ot decisive (otQ > 0), bm non-decisive', () => {
  const r = classify(
    [otRow('s', 12, 0.001)],
    [bmRow('s', 0.1, 0.9)],
  );
  assert.equal(r.rows[0]!.bucket, 'olmstead-tukey-only-up');
});

test('olmstead-tukey-only-down: ot decisive (otQ < 0), bm non-decisive', () => {
  const r = classify(
    [otRow('s', -12, 0.001)],
    [bmRow('s', 0.1, 0.9)],
  );
  assert.equal(r.rows[0]!.bucket, 'olmstead-tukey-only-down');
});

// ----- no-evidence -----

test('no-evidence: both non-decisive', () => {
  const r = classify(
    [otRow('s', 1, 0.5)],
    [bmRow('s', 0.5, 0.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, null);
});

// ----- sign-correction frame correctness -----

test('otTrendUpSignal == otQ (native sign)', () => {
  const r = classify(
    [otRow('s', 7, 0.5)],
    [bmRow('s', 0.1, 0.5)],
  );
  assert.equal(r.rows[0]!.otTrendUpSignal, 7);
});

test('bmTrendUpSignal == -bmZ (sign-inverted)', () => {
  const r = classify(
    [otRow('s', 0.1, 0.5)],
    [bmRow('s', 2.5, 0.5)],
  );
  assert.equal(r.rows[0]!.bmTrendUpSignal, -2.5);
});

// ----- alpha sensitivity -----

test('alpha=0.01: marginal pvalues no longer decisive', () => {
  const r = classify(
    [otRow('s', 5, 0.03)],
    [bmRow('s', -2, 0.04)],
    0.01,
  );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
});

test('alpha=0.10: marginal pvalues become decisive', () => {
  const r = classify(
    [otRow('s', 5, 0.08)],
    [bmRow('s', -2, 0.07)],
    0.10,
  );
  assert.equal(r.rows[0]!.bucket, 'robust-up-trend');
});

// ----- decisive flags -----

test('otDecisive flag matches otPValue < alpha', () => {
  const r = classify(
    [otRow('a', 1, 0.04), otRow('b', 1, 0.06)],
    [bmRow('a', 0.1, 0.5), bmRow('b', 0.1, 0.5)],
  );
  assert.equal(r.rows.find((x) => x.source === 'a')!.otDecisive, true);
  assert.equal(r.rows.find((x) => x.source === 'b')!.otDecisive, false);
});

test('bmDecisive flag matches bmPValue < alpha', () => {
  const r = classify(
    [otRow('a', 0.1, 0.9), otRow('b', 0.1, 0.9)],
    [bmRow('a', -2, 0.04), bmRow('b', -2, 0.06)],
  );
  assert.equal(r.rows.find((x) => x.source === 'a')!.bmDecisive, true);
  assert.equal(r.rows.find((x) => x.source === 'b')!.bmDecisive, false);
});

// ----- bothDecisive / atLeastOneDecisive counts -----

test('bothDecisive counts only joint-decisive rows', () => {
  const r = classify(
    [otRow('a', 5, 0.001), otRow('b', 5, 0.001), otRow('c', 0, 0.9)],
    [bmRow('a', -3, 0.001), bmRow('b', 0.1, 0.9), bmRow('c', -3, 0.001)],
  );
  assert.equal(r.bothDecisive, 1); // only 'a'
  assert.equal(r.atLeastOneDecisive, 3);
});

test('atLeastOneDecisive includes every row with one decisive side', () => {
  const r = classify(
    [otRow('a', 5, 0.001), otRow('b', 0, 0.9)],
    [bmRow('a', 0, 0.9), bmRow('b', -3, 0.001)],
  );
  assert.equal(r.atLeastOneDecisive, 2);
  assert.equal(r.bothDecisive, 0);
});

// ----- bucketCounts comprehensiveness -----

test('bucketCounts initialized to zero for all buckets', () => {
  const r = classify([], []);
  const expected = [
    'robust-up-trend',
    'robust-down-trend',
    'direction-conflict',
    'brown-mood-only-up',
    'brown-mood-only-down',
    'olmstead-tukey-only-up',
    'olmstead-tukey-only-down',
    'no-evidence',
  ];
  for (const b of expected) {
    assert.equal((r.bucketCounts as Record<string, number>)[b], 0);
  }
});

test('bucketCounts sums to row count', () => {
  const r = classify(
    [
      otRow('a', 5, 0.001),
      otRow('b', -5, 0.001),
      otRow('c', 5, 0.001),
      otRow('d', 0, 0.9),
    ],
    [
      bmRow('a', -3, 0.001),
      bmRow('b', 3, 0.001),
      bmRow('c', 3, 0.001),
      bmRow('d', -3, 0.001),
    ],
  );
  const sum = Object.values(r.bucketCounts).reduce((a, b) => a + b, 0);
  assert.equal(sum, r.rows.length);
  assert.equal(sum, 4);
});

// ----- joint-quadrant accounting -----

test('byJointDirectionQuadrant counts cover bothDecisive + anyMissingDecisive', () => {
  const r = classify(
    [
      otRow('a', 5, 0.001), // robustUp
      otRow('b', -5, 0.001), // robustDown
      otRow('c', 5, 0.001), // conflict
      otRow('d', -5, 0.001), // conflict
      otRow('e', 0, 0.9), // bm-only
    ],
    [
      bmRow('a', -3, 0.001),
      bmRow('b', 3, 0.001),
      bmRow('c', 3, 0.001),
      bmRow('d', -3, 0.001),
      bmRow('e', -3, 0.001),
    ],
  );
  assert.equal(r.byJointDirectionQuadrant.robustUp, 1);
  assert.equal(r.byJointDirectionQuadrant.robustDown, 1);
  assert.equal(r.byJointDirectionQuadrant.conflictOtUpBmDown, 1);
  assert.equal(r.byJointDirectionQuadrant.conflictOtDownBmUp, 1);
  assert.equal(r.byJointDirectionQuadrant.anyMissingDecisive, 1);
});

// ----- joinedSources sort stability -----

test('rows sorted by source asc', () => {
  const r = classify(
    [otRow('zebra', 1, 0.5), otRow('alpha', 1, 0.5), otRow('mike', 1, 0.5)],
    [bmRow('zebra', 0, 0.5), bmRow('alpha', 0, 0.5), bmRow('mike', 0, 0.5)],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['alpha', 'mike', 'zebra'],
  );
});

test('sourcesOnlyInOlmsteadTukey sorted asc', () => {
  const r = classify(
    [otRow('zulu', 1, 0.5), otRow('alpha', 1, 0.5)],
    [],
  );
  assert.deepEqual(r.sourcesOnlyInOlmsteadTukey, ['alpha', 'zulu']);
});

test('sourcesOnlyInBrownMood sorted asc', () => {
  const r = classify(
    [],
    [bmRow('zulu', 1, 0.5), bmRow('alpha', 1, 0.5)],
  );
  assert.deepEqual(r.sourcesOnlyInBrownMood, ['alpha', 'zulu']);
});

// ----- borderline pvalues -----

test('pvalue exactly at alpha is NOT decisive (strict <)', () => {
  const r = classify(
    [otRow('s', 5, 0.05)],
    [bmRow('s', -3, 0.5)],
    0.05,
  );
  assert.equal(r.rows[0]!.otDecisive, false);
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
});

test('pvalue just below alpha IS decisive', () => {
  const r = classify(
    [otRow('s', 5, 0.0499)],
    [bmRow('s', -3, 0.5)],
    0.05,
  );
  assert.equal(r.rows[0]!.otDecisive, true);
});

// ----- mixed corpus -----

test('mixed corpus: 7 rows hitting 7 distinct buckets', () => {
  const r = classify(
    [
      otRow('a', 12, 0.001), // robust-up-trend
      otRow('b', -12, 0.001), // robust-down-trend
      otRow('c', 12, 0.001), // direction-conflict (OT up, BM down)
      otRow('d', 0, 0.9), // brown-mood-only-up
      otRow('e', 0, 0.9), // brown-mood-only-down
      otRow('f', 12, 0.001), // olmstead-tukey-only-up
      otRow('g', -12, 0.001), // olmstead-tukey-only-down
    ],
    [
      bmRow('a', -3, 0.001),
      bmRow('b', 3, 0.001),
      bmRow('c', 3, 0.001),
      bmRow('d', -3, 0.001),
      bmRow('e', 3, 0.001),
      bmRow('f', 0.1, 0.9),
      bmRow('g', 0.1, 0.9),
    ],
  );
  const map = new Map(r.rows.map((x) => [x.source, x.bucket]));
  assert.equal(map.get('a'), 'robust-up-trend');
  assert.equal(map.get('b'), 'robust-down-trend');
  assert.equal(map.get('c'), 'direction-conflict');
  assert.equal(map.get('d'), 'brown-mood-only-up');
  assert.equal(map.get('e'), 'brown-mood-only-down');
  assert.equal(map.get('f'), 'olmstead-tukey-only-up');
  assert.equal(map.get('g'), 'olmstead-tukey-only-down');
});

// ----- summary string -----

test('summarize: empty report', () => {
  const r = classify([], []);
  const s = summarize(r);
  assert.match(s, /axis-212xaxis-211 alpha=0.05 n=0/);
});

test('summarize: includes both, qd, buckets sections', () => {
  const r = classify(
    [otRow('a', 12, 0.001)],
    [bmRow('a', -3, 0.001)],
  );
  const s = summarize(r);
  assert.match(s, /n=1/);
  assert.match(s, /both=1\/1/);
  assert.match(s, /qd\[rUp\/rDn\/cOuBd\/cOdBu\]=1\/0\/0\/0/);
  assert.match(s, /buckets\[ru\/rd\/dc\/bmu\/bmd\/otu\/otd\/ne\]=1\/0\/0\/0\/0\/0\/0\/0/);
});

test('summarize: alpha echoed', () => {
  const r = classify([], [], 0.10);
  const s = summarize(r);
  assert.match(s, /alpha=0.1 /);
});

test('summarize is pure (idempotent)', () => {
  const r = classify(
    [otRow('a', 5, 0.001)],
    [bmRow('a', 0.1, 0.9)],
  );
  assert.equal(summarize(r), summarize(r));
});

// ----- otQ == 0 (no edge agreement) -----

test('otQ == 0 + decisive otPValue is impossible per OT semantics but if forced, otQ>0 branch needs strict >', () => {
  // engineered: decisive otPValue with otQ=0 (synthetic)
  const r = classify(
    [otRow('s', 0, 0.001)],
    [bmRow('s', 0.1, 0.9)],
  );
  // otQ==0 -> not > 0 -> falls into otdown branch
  assert.equal(r.rows[0]!.bucket, 'olmstead-tukey-only-down');
});

// ----- bmZ == 0 (impossible per BM semantics but) -----

test('bmZ == 0 + decisive bmPValue treated as down (strict <)', () => {
  const r = classify(
    [otRow('s', 0.1, 0.9)],
    [bmRow('s', 0, 0.001)],
  );
  // bmZ==0 -> not < 0 -> bm-only-down branch
  assert.equal(r.rows[0]!.bucket, 'brown-mood-only-down');
});

// ----- many rows scaling -----

test('100 rows: counts add up', () => {
  const ot: ReturnType<typeof otRow>[] = [];
  const bm: ReturnType<typeof bmRow>[] = [];
  for (let i = 0; i < 100; i += 1) {
    ot.push(otRow(`src${String(i).padStart(3, '0')}`, 12, 0.001));
    bm.push(bmRow(`src${String(i).padStart(3, '0')}`, -3, 0.001));
  }
  const r = classify(ot, bm);
  assert.equal(r.rows.length, 100);
  assert.equal(r.bothDecisive, 100);
  assert.equal(r.bucketCounts['robust-up-trend'], 100);
});

test('100 rows alternating directions: 50 up, 50 down', () => {
  const ot: ReturnType<typeof otRow>[] = [];
  const bm: ReturnType<typeof bmRow>[] = [];
  for (let i = 0; i < 100; i += 1) {
    const src = `s${String(i).padStart(3, '0')}`;
    if (i % 2 === 0) {
      ot.push(otRow(src, 12, 0.001));
      bm.push(bmRow(src, -3, 0.001));
    } else {
      ot.push(otRow(src, -12, 0.001));
      bm.push(bmRow(src, 3, 0.001));
    }
  }
  const r = classify(ot, bm);
  assert.equal(r.bucketCounts['robust-up-trend'], 50);
  assert.equal(r.bucketCounts['robust-down-trend'], 50);
});

// ----- output row carries forward inputs verbatim -----

test('joined row preserves otQ/otZ/otPValue from input', () => {
  const r = classify(
    [{ source: 's', otQ: 11, otZ: 11 / Math.sqrt(8), otPValue: 0.0001 }],
    [bmRow('s', -2, 0.001)],
  );
  assert.equal(r.rows[0]!.otQ, 11);
  assert.ok(Math.abs(r.rows[0]!.otZ - 11 / Math.sqrt(8)) < 1e-9);
  assert.equal(r.rows[0]!.otPValue, 0.0001);
});

test('joined row preserves bmZ/bmPValue from input', () => {
  const r = classify(
    [otRow('s', 5, 0.5)],
    [bmRow('s', -2.5, 0.012)],
  );
  assert.equal(r.rows[0]!.bmZ, -2.5);
  assert.equal(r.rows[0]!.bmPValue, 0.012);
});

// ----- jointDirectionQuadrant null when not bothDecisive -----

test('jointDirectionQuadrant null on no-evidence', () => {
  const r = classify(
    [otRow('s', 0.1, 0.9)],
    [bmRow('s', 0.1, 0.9)],
  );
  assert.equal(r.rows[0]!.jointDirectionQuadrant, null);
});

test('jointDirectionQuadrant null on single-decisive', () => {
  const r = classify(
    [otRow('s', 12, 0.001)],
    [bmRow('s', 0.1, 0.9)],
  );
  assert.equal(r.rows[0]!.jointDirectionQuadrant, null);
});

// ----- summary integer-only counts -----

test('summarize emits integer counts only', () => {
  const r = classify(
    [otRow('a', 12, 0.001), otRow('b', -12, 0.001)],
    [bmRow('a', -3, 0.001), bmRow('b', 3, 0.001)],
  );
  const s = summarize(r);
  // No floats in count fields (e.g. "1.5")
  assert.ok(!/\d+\.\d+\/\d/.test(s));
});

// ----- OT row otZ optional consistency check (we accept any otZ but require finite) -----

test('OT row with otZ != otQ/sqrt(8) is still accepted (we trust caller)', () => {
  const r = classify(
    [{ source: 's', otQ: 12, otZ: 0.5, otPValue: 0.5 }],
    [bmRow('s', 0.1, 0.5)],
  );
  assert.equal(r.rows[0]!.otZ, 0.5);
});

// ----- determinism -----

test('classify is deterministic', () => {
  const ot = [otRow('a', 5, 0.001), otRow('b', -5, 0.001)];
  const bm = [bmRow('a', -3, 0.001), bmRow('b', 3, 0.001)];
  const r1 = classify(ot, bm);
  const r2 = classify(ot, bm);
  assert.deepEqual(r1, r2);
});

// ----- frozen input safety (readonly arrays) -----

test('frozen input arrays accepted', () => {
  const ot = Object.freeze([otRow('a', 5, 0.001)]);
  const bm = Object.freeze([bmRow('a', -3, 0.001)]);
  const r = classify(ot, bm);
  assert.equal(r.rows[0]!.bucket, 'robust-up-trend');
});

// ----- summary contains alpha=0.05 when default used -----

test('default alpha = 0.05', () => {
  const r = classify([], []);
  assert.equal(r.alpha, 0.05);
});

// ----- explicit alpha echoed in report -----

test('alpha echoed verbatim', () => {
  const r = classify([], [], 0.025);
  assert.equal(r.alpha, 0.025);
});

// ----- additional cross-check tests -----

test('atLeastOneDecisive == sum over decisive flags', () => {
  const r = classify(
    [
      otRow('a', 5, 0.001),
      otRow('b', 0.1, 0.9),
      otRow('c', 5, 0.5),
    ],
    [
      bmRow('a', 0.1, 0.9),
      bmRow('b', -3, 0.001),
      bmRow('c', 0.1, 0.9),
    ],
  );
  let count = 0;
  for (const row of r.rows) {
    if (row.otDecisive || row.bmDecisive) count += 1;
  }
  assert.equal(r.atLeastOneDecisive, count);
});

test('bothDecisive <= atLeastOneDecisive', () => {
  const r = classify(
    [
      otRow('a', 5, 0.001),
      otRow('b', 0.1, 0.9),
    ],
    [
      bmRow('a', -3, 0.001),
      bmRow('b', -3, 0.001),
    ],
  );
  assert.ok(r.bothDecisive <= r.atLeastOneDecisive);
});

test('rows.length = joinedSources.length (no duplicates after join)', () => {
  const r = classify(
    [otRow('a', 1, 0.5), otRow('b', 1, 0.5), otRow('c', 1, 0.5)],
    [bmRow('a', 0, 0.5), bmRow('b', 0, 0.5)],
  );
  assert.equal(r.rows.length, 2);
});

test('non-overlapping inputs: empty rows but populated only-in lists', () => {
  const r = classify(
    [otRow('x', 1, 0.5)],
    [bmRow('y', 1, 0.5)],
  );
  assert.equal(r.rows.length, 0);
  assert.deepEqual(r.sourcesOnlyInOlmsteadTukey, ['x']);
  assert.deepEqual(r.sourcesOnlyInBrownMood, ['y']);
});

test('large alpha 0.5: nearly everything decisive', () => {
  const r = classify(
    [otRow('s', 1, 0.4)],
    [bmRow('s', 0.5, 0.4)],
    0.5,
  );
  // both p < 0.5, so both decisive
  assert.equal(r.bothDecisive, 1);
});
