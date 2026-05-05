import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAxis210Axis209DanielsWallisMooreGlobalRankAlignmentVsLocalPhaseSmoothnessCompound as classifyDrWm,
  summarizeAxis210Axis209DanielsWallisMooreReport as summarize,
} from '../src/classifyaxis210axis209danielswallismooreglobalrankalignmentvslocalphasesmoothnesscompound.ts';

const OK = 0.001;
const NS = 0.5;

// ----- empty / coverage / mismatch -----

test('empty inputs: zero rows, zero counts', () => {
  const r = classifyDrWm([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.deepEqual(r.sourcesOnlyInDaniels, []);
  assert.deepEqual(r.sourcesOnlyInWallisMoore, []);
});

test('source only in daniels surfaced', () => {
  const r = classifyDrWm(
    [{ source: 'a', drZ: 1, drPValue: NS }],
    [],
  );
  assert.deepEqual(r.sourcesOnlyInDaniels, ['a']);
  assert.equal(r.rows.length, 0);
});

test('source only in wallis-moore surfaced', () => {
  const r = classifyDrWm(
    [],
    [{ source: 'b', wmZ: -1, wmPValue: NS }],
  );
  assert.deepEqual(r.sourcesOnlyInWallisMoore, ['b']);
});

// ----- bucket logic -----

test('bucket: smooth-up-trend (drZ>0 + wmZ<0, both decisive)', () => {
  const r = classifyDrWm(
    [{ source: 's', drZ: 4, drPValue: OK }],
    [{ source: 's', wmZ: -3, wmPValue: OK }],
  );
  assert.equal(r.rows[0]!.bucket, 'smooth-up-trend');
  assert.equal(r.rows[0]!.jointSignQuadrant, 'smoothUp');
  assert.equal(r.bucketCounts['smooth-up-trend'], 1);
  assert.equal(r.byJointSignQuadrant.smoothUp, 1);
  assert.equal(r.bothDecisive, 1);
});

test('bucket: smooth-down-trend (drZ<0 + wmZ<0, both decisive)', () => {
  const r = classifyDrWm(
    [{ source: 's', drZ: -4, drPValue: OK }],
    [{ source: 's', wmZ: -3, wmPValue: OK }],
  );
  assert.equal(r.rows[0]!.bucket, 'smooth-down-trend');
  assert.equal(r.rows[0]!.jointSignQuadrant, 'smoothDown');
});

test('bucket: zigzag-with-trend (wmZ>0 + drZ>0, both decisive)', () => {
  const r = classifyDrWm(
    [{ source: 's', drZ: 3, drPValue: OK }],
    [{ source: 's', wmZ: 3, wmPValue: OK }],
  );
  assert.equal(r.rows[0]!.bucket, 'zigzag-with-trend');
  assert.equal(r.rows[0]!.jointSignQuadrant, 'zigzagUp');
});

test('bucket: zigzag-with-trend (wmZ>0 + drZ<0, both decisive)', () => {
  const r = classifyDrWm(
    [{ source: 's', drZ: -3, drPValue: OK }],
    [{ source: 's', wmZ: 3, wmPValue: OK }],
  );
  assert.equal(r.rows[0]!.bucket, 'zigzag-with-trend');
  assert.equal(r.rows[0]!.jointSignQuadrant, 'zigzagDown');
});

test('bucket: smoothness-only-smooth (wm decisive smooth, dr not)', () => {
  const r = classifyDrWm(
    [{ source: 's', drZ: 0.2, drPValue: NS }],
    [{ source: 's', wmZ: -3, wmPValue: OK }],
  );
  assert.equal(r.rows[0]!.bucket, 'smoothness-only-smooth');
  assert.equal(r.rows[0]!.jointSignQuadrant, null);
  assert.equal(r.byJointSignQuadrant.anyMissingDecisive, 1);
});

test('bucket: smoothness-only-zigzag (wm decisive zigzag, dr not)', () => {
  const r = classifyDrWm(
    [{ source: 's', drZ: 0.2, drPValue: NS }],
    [{ source: 's', wmZ: 3, wmPValue: OK }],
  );
  assert.equal(r.rows[0]!.bucket, 'smoothness-only-zigzag');
});

test('bucket: daniels-only (dr decisive, wm not)', () => {
  const r = classifyDrWm(
    [{ source: 's', drZ: 3, drPValue: OK }],
    [{ source: 's', wmZ: 0.5, wmPValue: NS }],
  );
  assert.equal(r.rows[0]!.bucket, 'daniels-only');
  assert.equal(r.rows[0]!.jointSignQuadrant, null);
});

test('bucket: no-evidence (neither decisive)', () => {
  const r = classifyDrWm(
    [{ source: 's', drZ: 0.2, drPValue: NS }],
    [{ source: 's', wmZ: 0.3, wmPValue: NS }],
  );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.atLeastOneDecisive, 0);
});

// ----- signal direction -----

test('drTrendUpSignal = +drZ (positive=up); wmSmoothSignal = -wmZ', () => {
  const r = classifyDrWm(
    [{ source: 's', drZ: 2.5, drPValue: OK }],
    [{ source: 's', wmZ: -3.1, wmPValue: OK }],
  );
  assert.equal(r.rows[0]!.drTrendUpSignal, 2.5);
  assert.equal(r.rows[0]!.wmSmoothSignal, 3.1);
});

// ----- input validation -----

test('throws on duplicate daniels source', () => {
  assert.throws(() =>
    classifyDrWm(
      [
        { source: 'a', drZ: 1, drPValue: 0.5 },
        { source: 'a', drZ: 2, drPValue: 0.4 },
      ],
      [],
    ),
  );
});

test('throws on duplicate wm source', () => {
  assert.throws(() =>
    classifyDrWm(
      [],
      [
        { source: 'a', wmZ: 1, wmPValue: 0.5 },
        { source: 'a', wmZ: 2, wmPValue: 0.4 },
      ],
    ),
  );
});

test('throws on non-finite drZ', () => {
  assert.throws(() =>
    classifyDrWm(
      [{ source: 's', drZ: Number.NaN, drPValue: 0.5 }],
      [],
    ),
  );
});

test('throws on drPValue out of range', () => {
  assert.throws(() =>
    classifyDrWm(
      [{ source: 's', drZ: 1, drPValue: 1.5 }],
      [],
    ),
  );
});

test('throws on bad alpha', () => {
  assert.throws(() => classifyDrWm([], [], 0));
  assert.throws(() => classifyDrWm([], [], 0.7));
});

test('throws on empty source string', () => {
  assert.throws(() =>
    classifyDrWm([{ source: '', drZ: 1, drPValue: 0.5 }], []),
  );
});

// ----- ordering and joining -----

test('rows are sorted by source ascending', () => {
  const r = classifyDrWm(
    [
      { source: 'b', drZ: 1, drPValue: 0.5 },
      { source: 'a', drZ: 1, drPValue: 0.5 },
    ],
    [
      { source: 'b', wmZ: 1, wmPValue: 0.5 },
      { source: 'a', wmZ: 1, wmPValue: 0.5 },
    ],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['a', 'b'],
  );
});

test('only joined sources appear in rows; unmatched in onlyIn lists', () => {
  const r = classifyDrWm(
    [
      { source: 'a', drZ: 1, drPValue: 0.5 },
      { source: 'b', drZ: 1, drPValue: 0.5 },
    ],
    [
      { source: 'a', wmZ: 1, wmPValue: 0.5 },
      { source: 'c', wmZ: 1, wmPValue: 0.5 },
    ],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'a');
  assert.deepEqual(r.sourcesOnlyInDaniels, ['b']);
  assert.deepEqual(r.sourcesOnlyInWallisMoore, ['c']);
});

// ----- summarize -----

test('summarize: format string', () => {
  const r = classifyDrWm(
    [
      { source: 'a', drZ: 4, drPValue: OK },
      { source: 'b', drZ: -3, drPValue: OK },
    ],
    [
      { source: 'a', wmZ: -3, wmPValue: OK },
      { source: 'b', wmZ: -3, wmPValue: OK },
    ],
  );
  const s = summarize(r);
  assert.match(s, /^axis-210xaxis-209 alpha=0\.05 n=2 both=2\/2/);
  assert.match(s, /qd\[smU\/smD\/zgU\/zgD\]=1\/1\/0\/0/);
  assert.match(s, /buckets\[smU\/smD\/zwT\/sos\/soz\/do\/ne\]=1\/1\/0\/0\/0\/0\/0/);
});

test('summarize: empty report', () => {
  const r = classifyDrWm([], []);
  const s = summarize(r);
  assert.match(s, /n=0 both=0\/0/);
});
