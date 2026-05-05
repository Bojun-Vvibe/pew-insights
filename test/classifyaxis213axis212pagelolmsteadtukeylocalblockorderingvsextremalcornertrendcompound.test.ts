import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAxis213Axis212PageLOlmsteadTukeyLocalBlockOrderingVsExtremalCornerTrendCompound as classify,
  summarizeAxis213Axis212PageLOlmsteadTukeyReport as summarize,
} from '../src/classifyaxis213axis212pagelolmsteadtukeylocalblockorderingvsextremalcornertrendcompound.ts';

const page = (source: string, pageZ: number, pagePValue: number) => ({
  source,
  pageZ,
  pagePValue,
});
const ot = (source: string, otQ: number, otZ: number, otPValue: number) => ({
  source,
  otQ,
  otZ,
  otPValue,
});

// ---------- empty / basic ----------

test('classify: empty inputs return empty report', () => {
  const r = classify([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.deepEqual(r.sourcesOnlyInPageL, []);
  assert.deepEqual(r.sourcesOnlyInOlmsteadTukey, []);
  assert.equal(r.bucketCounts['no-evidence'], 0);
});

test('classify: alpha defaults to 0.05', () => {
  const r = classify([page('a', 0.5, 0.6)], [ot('a', 1, 0.354, 0.7)]);
  assert.equal(r.alpha, 0.05);
});

test('classify: rejects non-finite alpha', () => {
  assert.throws(() => classify([], [], Number.NaN));
});

test('classify: rejects alpha <= 0', () => {
  assert.throws(() => classify([], [], 0));
  assert.throws(() => classify([], [], -0.1));
});

test('classify: rejects alpha > 0.5', () => {
  assert.throws(() => classify([], [], 0.6));
});

// ---------- input validation ----------

test('classify: rejects empty source name in page row', () => {
  assert.throws(() => classify([page('', 1, 0.1)], []));
});

test('classify: rejects non-finite pageZ', () => {
  assert.throws(() => classify([page('a', Number.NaN, 0.1)], []));
});

test('classify: rejects pagePValue <= 0', () => {
  assert.throws(() => classify([page('a', 1, 0)], []));
});

test('classify: rejects pagePValue > 1', () => {
  assert.throws(() => classify([page('a', 1, 1.5)], []));
});

test('classify: rejects duplicate page source', () => {
  assert.throws(() =>
    classify([page('a', 1, 0.1), page('a', 2, 0.05)], []),
  );
});

test('classify: rejects empty source name in OT row', () => {
  assert.throws(() => classify([], [ot('', 1, 0.354, 0.5)]));
});

test('classify: rejects non-finite otQ', () => {
  assert.throws(() => classify([], [ot('a', Number.NaN, 0.354, 0.5)]));
});

test('classify: rejects non-finite otZ', () => {
  assert.throws(() => classify([], [ot('a', 1, Number.NaN, 0.5)]));
});

test('classify: rejects otPValue 0', () => {
  assert.throws(() => classify([], [ot('a', 1, 0.354, 0)]));
});

test('classify: rejects otPValue > 1', () => {
  assert.throws(() => classify([], [ot('a', 1, 0.354, 1.5)]));
});

test('classify: rejects duplicate OT source', () => {
  assert.throws(() =>
    classify([], [ot('a', 1, 0.354, 0.5), ot('a', 2, 0.7, 0.5)]),
  );
});

// ---------- coverage / asymmetric joins ----------

test('classify: source only in pageL surfaces in sourcesOnlyInPageL', () => {
  const r = classify([page('a', 1, 0.1)], []);
  assert.deepEqual(r.sourcesOnlyInPageL, ['a']);
  assert.deepEqual(r.sourcesOnlyInOlmsteadTukey, []);
  assert.equal(r.rows.length, 0);
});

test('classify: source only in OT surfaces in sourcesOnlyInOlmsteadTukey', () => {
  const r = classify([], [ot('a', 1, 0.354, 0.5)]);
  assert.deepEqual(r.sourcesOnlyInPageL, []);
  assert.deepEqual(r.sourcesOnlyInOlmsteadTukey, ['a']);
});

test('classify: only intersection joined', () => {
  const r = classify(
    [page('a', 1, 0.5), page('b', 1, 0.5)],
    [ot('b', 1, 0.354, 0.5), ot('c', 1, 0.354, 0.5)],
  );
  assert.deepEqual(r.sourcesOnlyInPageL, ['a']);
  assert.deepEqual(r.sourcesOnlyInOlmsteadTukey, ['c']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'b');
});

test('classify: outputs sorted by source asc', () => {
  const r = classify(
    [page('z', 1, 0.5), page('a', 1, 0.5), page('m', 1, 0.5)],
    [ot('z', 1, 0.354, 0.5), ot('a', 1, 0.354, 0.5), ot('m', 1, 0.354, 0.5)],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['a', 'm', 'z'],
  );
});

// ---------- bucket assignment: no-evidence ----------

test('classify: neither decisive => no-evidence', () => {
  const r = classify([page('a', 1, 0.3)], [ot('a', 2, 0.707, 0.5)]);
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, null);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.byJointDirectionQuadrant.anyMissingDecisive, 1);
});

// ---------- bucket assignment: page-l-only ----------

test('classify: page decisive up, OT not => page-l-only-up', () => {
  const r = classify([page('a', 3, 0.001)], [ot('a', 2, 0.707, 0.5)]);
  assert.equal(r.rows[0]!.bucket, 'page-l-only-up');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, null);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 1);
  assert.equal(r.byJointDirectionQuadrant.anyMissingDecisive, 1);
});

test('classify: page decisive down, OT not => page-l-only-down', () => {
  const r = classify([page('a', -3, 0.001)], [ot('a', 1, 0.354, 0.5)]);
  assert.equal(r.rows[0]!.bucket, 'page-l-only-down');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, null);
});

// ---------- bucket assignment: olmstead-tukey-only ----------

test('classify: OT decisive up, page not => olmstead-tukey-only-up', () => {
  const r = classify([page('a', 1, 0.3)], [ot('a', 10, 3.535, 0.0001)]);
  assert.equal(r.rows[0]!.bucket, 'olmstead-tukey-only-up');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, null);
});

test('classify: OT decisive down, page not => olmstead-tukey-only-down', () => {
  const r = classify([page('a', -1, 0.3)], [ot('a', -10, -3.535, 0.0001)]);
  assert.equal(r.rows[0]!.bucket, 'olmstead-tukey-only-down');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, null);
});

// ---------- bucket assignment: robust ----------

test('classify: both decisive up => robust-up-trend', () => {
  const r = classify([page('a', 3, 0.001)], [ot('a', 10, 3.535, 0.0001)]);
  assert.equal(r.rows[0]!.bucket, 'robust-up-trend');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, 'robustUp');
  assert.equal(r.byJointDirectionQuadrant.robustUp, 1);
  assert.equal(r.bothDecisive, 1);
});

test('classify: both decisive down => robust-down-trend', () => {
  const r = classify([page('a', -3, 0.001)], [ot('a', -10, -3.535, 0.0001)]);
  assert.equal(r.rows[0]!.bucket, 'robust-down-trend');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, 'robustDown');
  assert.equal(r.byJointDirectionQuadrant.robustDown, 1);
});

// ---------- bucket assignment: direction-conflict ----------

test('classify: page up, OT down => conflictPageUpOtDown', () => {
  const r = classify([page('a', 3, 0.001)], [ot('a', -10, -3.535, 0.0001)]);
  assert.equal(r.rows[0]!.bucket, 'direction-conflict');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, 'conflictPageUpOtDown');
  assert.equal(r.byJointDirectionQuadrant.conflictPageUpOtDown, 1);
});

test('classify: page down, OT up => conflictPageDownOtUp', () => {
  const r = classify([page('a', -3, 0.001)], [ot('a', 10, 3.535, 0.0001)]);
  assert.equal(r.rows[0]!.bucket, 'direction-conflict');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, 'conflictPageDownOtUp');
  assert.equal(r.byJointDirectionQuadrant.conflictPageDownOtUp, 1);
});

// ---------- joined row payload ----------

test('classify: joined row preserves stats', () => {
  const r = classify([page('a', 2.5, 0.012)], [ot('a', 7, 2.475, 0.0133)]);
  const row = r.rows[0]!;
  assert.equal(row.pageZ, 2.5);
  assert.equal(row.pagePValue, 0.012);
  assert.equal(row.otQ, 7);
  assert.equal(row.otZ, 2.475);
  assert.equal(row.otPValue, 0.0133);
  assert.equal(row.pageDecisive, true);
  assert.equal(row.otDecisive, true);
  assert.equal(row.pageTrendUpSignal, 2.5);
  assert.equal(row.otTrendUpSignal, 7);
});

// ---------- bucket counts comprehensive ----------

test('classify: counts every bucket independently', () => {
  const r = classify(
    [
      page('ru', 3, 0.001),
      page('rd', -3, 0.001),
      page('cf1', 3, 0.001),
      page('cf2', -3, 0.001),
      page('plu', 3, 0.001),
      page('pld', -3, 0.001),
      page('otu', 1, 0.3),
      page('otd', 1, 0.3),
      page('ne', 1, 0.3),
    ],
    [
      ot('ru', 10, 3.535, 0.0001),
      ot('rd', -10, -3.535, 0.0001),
      ot('cf1', -10, -3.535, 0.0001),
      ot('cf2', 10, 3.535, 0.0001),
      ot('plu', 1, 0.354, 0.5),
      ot('pld', 1, 0.354, 0.5),
      ot('otu', 10, 3.535, 0.0001),
      ot('otd', -10, -3.535, 0.0001),
      ot('ne', 1, 0.354, 0.5),
    ],
  );
  assert.equal(r.bucketCounts['robust-up-trend'], 1);
  assert.equal(r.bucketCounts['robust-down-trend'], 1);
  assert.equal(r.bucketCounts['direction-conflict'], 2);
  assert.equal(r.bucketCounts['page-l-only-up'], 1);
  assert.equal(r.bucketCounts['page-l-only-down'], 1);
  assert.equal(r.bucketCounts['olmstead-tukey-only-up'], 1);
  assert.equal(r.bucketCounts['olmstead-tukey-only-down'], 1);
  assert.equal(r.bucketCounts['no-evidence'], 1);
  assert.equal(r.bothDecisive, 4);
  assert.equal(r.atLeastOneDecisive, 8);
  assert.equal(r.byJointDirectionQuadrant.robustUp, 1);
  assert.equal(r.byJointDirectionQuadrant.robustDown, 1);
  assert.equal(r.byJointDirectionQuadrant.conflictPageUpOtDown, 1);
  assert.equal(r.byJointDirectionQuadrant.conflictPageDownOtUp, 1);
  assert.equal(r.byJointDirectionQuadrant.anyMissingDecisive, 5);
});

// ---------- alpha sensitivity ----------

test('classify: tighter alpha shifts decisive -> non-decisive', () => {
  const r = classify(
    [page('a', 2.0, 0.0455)],
    [ot('a', 6, 2.121, 0.0339)],
    0.01,
  );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bothDecisive, 0);
});

test('classify: loose alpha shifts non-decisive -> decisive', () => {
  const r = classify(
    [page('a', 2.0, 0.0455)],
    [ot('a', 6, 2.121, 0.0339)],
    0.1,
  );
  assert.equal(r.rows[0]!.bucket, 'robust-up-trend');
});

// ---------- summary ----------

test('summarize: produces axis-213xaxis-212 line with all buckets', () => {
  const r = classify(
    [page('a', 3, 0.001), page('b', 1, 0.3)],
    [ot('a', 10, 3.535, 0.0001), ot('b', 1, 0.354, 0.5)],
  );
  const s = summarize(r);
  assert.match(s, /axis-213xaxis-212/);
  assert.match(s, /alpha=0\.05/);
  assert.match(s, /n=2/);
  assert.match(s, /both=1\/2/);
  assert.match(s, /buckets\[/);
});

test('summarize: encodes alpha and quadrant counts verbatim', () => {
  const r = classify([], [], 0.01);
  const s = summarize(r);
  assert.match(s, /alpha=0\.01/);
  assert.match(s, /n=0/);
  assert.match(s, /both=0\/0/);
});

test('summarize: order of buckets preserved (ru/rd/dc/plu/pld/otu/otd/ne)', () => {
  const r = classify(
    [page('a', 3, 0.001)],
    [ot('a', 10, 3.535, 0.0001)],
  );
  const s = summarize(r);
  assert.match(s, /buckets\[ru\/rd\/dc\/plu\/pld\/otu\/otd\/ne\]=1\/0\/0\/0\/0\/0\/0\/0/);
});

// ---------- multi-source determinism ----------

test('classify: identical input twice gives identical bucket counts', () => {
  const pageRows = [page('a', 3, 0.001), page('b', -3, 0.001)];
  const otRows = [ot('a', 10, 3.535, 0.0001), ot('b', -10, -3.535, 0.0001)];
  const r1 = classify(pageRows, otRows);
  const r2 = classify(pageRows, otRows);
  assert.deepEqual(r1.bucketCounts, r2.bucketCounts);
  assert.deepEqual(r1.rows, r2.rows);
});

test('classify: pageZ exactly 0 with decisive p => treated as down (>= 0 false)', () => {
  // Edge case: pageZ = 0 but somehow decisive
  const r = classify([page('a', 0, 0.04)], [ot('a', 10, 3.535, 0.0001)]);
  // pageUp = (0 > 0) = false; otUp = true => conflictPageDownOtUp
  assert.equal(r.rows[0]!.bucket, 'direction-conflict');
  assert.equal(r.rows[0]!.jointDirectionQuadrant, 'conflictPageDownOtUp');
});

test('classify: otQ exactly 0 with decisive p => treated as down', () => {
  const r = classify([page('a', 3, 0.001)], [ot('a', 0, 0, 0.04)]);
  // otUp = (0 > 0) = false; pageUp = true => conflictPageUpOtDown
  assert.equal(r.rows[0]!.bucket, 'direction-conflict');
});

test('classify: pageZ exactly 0 non-decisive AND OT non-decisive => no-evidence', () => {
  const r = classify([page('a', 0, 0.5)], [ot('a', 1, 0.354, 0.5)]);
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
});

test('classify: only-page with pageZ=0 not surfaced (treated as down by sign)', () => {
  // pageZ = 0, decisive => pageZ > 0 false => page-l-only-down
  const r = classify([page('a', 0, 0.04)], [ot('a', 1, 0.354, 0.5)]);
  assert.equal(r.rows[0]!.bucket, 'page-l-only-down');
});

test('classify: only-OT with otQ=0 not surfaced (treated as down by sign)', () => {
  const r = classify([page('a', 1, 0.3)], [ot('a', 0, 0, 0.04)]);
  assert.equal(r.rows[0]!.bucket, 'olmstead-tukey-only-down');
});

// ---------- partial join with bucket coverage ----------

test('classify: asymmetric coverage with full classification on intersection', () => {
  const r = classify(
    [
      page('shared-up', 3, 0.001),
      page('only-page-up', 3, 0.001),
      page('shared-down', -3, 0.001),
    ],
    [
      ot('shared-up', 10, 3.535, 0.0001),
      ot('only-ot-up', 10, 3.535, 0.0001),
      ot('shared-down', -10, -3.535, 0.0001),
    ],
  );
  assert.equal(r.rows.length, 2);
  assert.deepEqual(r.sourcesOnlyInPageL, ['only-page-up']);
  assert.deepEqual(r.sourcesOnlyInOlmsteadTukey, ['only-ot-up']);
  assert.equal(r.bucketCounts['robust-up-trend'], 1);
  assert.equal(r.bucketCounts['robust-down-trend'], 1);
});

test('classify: source filter (none in common) => empty rows but split surfaces', () => {
  const r = classify(
    [page('a', 3, 0.001)],
    [ot('b', 10, 3.535, 0.0001)],
  );
  assert.equal(r.rows.length, 0);
  assert.deepEqual(r.sourcesOnlyInPageL, ['a']);
  assert.deepEqual(r.sourcesOnlyInOlmsteadTukey, ['b']);
});

test('classify: large number of sources retains bucket invariants', () => {
  const pageRows = [];
  const otRows = [];
  for (let i = 0; i < 50; i += 1) {
    pageRows.push(page(`s${i}`, 3, 0.001));
    otRows.push(ot(`s${i}`, 10, 3.535, 0.0001));
  }
  const r = classify(pageRows, otRows);
  assert.equal(r.rows.length, 50);
  assert.equal(r.bucketCounts['robust-up-trend'], 50);
  assert.equal(r.bothDecisive, 50);
  assert.equal(r.byJointDirectionQuadrant.robustUp, 50);
});

test('classify: alpha 0.5 boundary is inclusive of valid range', () => {
  const r = classify([page('a', 1, 0.4)], [ot('a', 2, 0.707, 0.4)], 0.5);
  // pagePValue 0.4 < 0.5 => decisive; otPValue 0.4 < 0.5 => decisive
  assert.equal(r.rows[0]!.bucket, 'robust-up-trend');
});

test('classify: pageDecisive flag set correctly', () => {
  const r = classify(
    [page('a', 1, 0.04)],
    [ot('a', 2, 0.707, 0.5)],
  );
  assert.equal(r.rows[0]!.pageDecisive, true);
  assert.equal(r.rows[0]!.otDecisive, false);
});

test('classify: report.alpha echoes input', () => {
  const r = classify([], [], 0.025);
  assert.equal(r.alpha, 0.025);
});

test('summarize: zero-row report still well-formed', () => {
  const r = classify([], []);
  const s = summarize(r);
  assert.match(s, /n=0/);
  assert.match(s, /qd\[rUp\/rDn\/cPuOd\/cPdOu\]=0\/0\/0\/0/);
});
