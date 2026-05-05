import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPairedSignWsrRobustnessAgreement } from '../src/classifypairedsignwsrrobustnessagreement.js';

test('cpw: empty inputs => empty report', () => {
  const r = classifyPairedSignWsrRobustnessAgreement([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisiveAgreement, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.signConflicts, 0);
  assert.equal(r.wsrOnlyButRobustVeto, 0);
  assert.equal(r.signOnly, 0);
  assert.deepEqual(r.sourcesOnlyInPst, []);
  assert.deepEqual(r.sourcesOnlyInWsr, []);
});

test('cpw: both decisive same direction (positive) => both-decisive-second-larger', () => {
  const r = classifyPairedSignWsrRobustnessAgreement(
    [{ source: 'A', pstPTwoSided: 0.001, pstSign: 1, pstDelta: 0.5 }],
    [{ source: 'A', wsrPTwoSided: 0.001, wsrSign: 1, wsrRankBiserial: 0.6 }],
  );
  assert.equal(r.rows[0]!.bucket, 'both-decisive-second-larger');
  assert.equal(r.bothDecisiveAgreement, 1);
  assert.equal(r.bothDecisive, 1);
});

test('cpw: both decisive same direction (negative) => both-decisive-first-larger', () => {
  const r = classifyPairedSignWsrRobustnessAgreement(
    [{ source: 'A', pstPTwoSided: 0.01, pstSign: -1, pstDelta: -0.4 }],
    [{ source: 'A', wsrPTwoSided: 0.02, wsrSign: -1, wsrRankBiserial: -0.5 }],
  );
  assert.equal(r.rows[0]!.bucket, 'both-decisive-first-larger');
  assert.equal(r.bothDecisiveAgreement, 1);
});

test('cpw: both decisive opposite signs => sign-conflict', () => {
  const r = classifyPairedSignWsrRobustnessAgreement(
    [{ source: 'A', pstPTwoSided: 0.01, pstSign: 1, pstDelta: 0.4 }],
    [{ source: 'A', wsrPTwoSided: 0.02, wsrSign: -1, wsrRankBiserial: -0.5 }],
  );
  assert.equal(r.rows[0]!.bucket, 'sign-conflict');
  assert.equal(r.signConflicts, 1);
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.bothDecisiveAgreement, 0);
});

test('cpw: wsr only decisive => wsr-only bucket and robust-veto count', () => {
  const r = classifyPairedSignWsrRobustnessAgreement(
    [{ source: 'A', pstPTwoSided: 0.30, pstSign: -1, pstDelta: -0.2 }],
    [{ source: 'A', wsrPTwoSided: 0.01, wsrSign: -1, wsrRankBiserial: -0.4 }],
  );
  assert.equal(r.rows[0]!.bucket, 'wsr-only-decisive-first-larger');
  assert.equal(r.wsrOnlyButRobustVeto, 1);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 1);
});

test('cpw: sign-test only decisive => sign-only bucket', () => {
  const r = classifyPairedSignWsrRobustnessAgreement(
    [{ source: 'A', pstPTwoSided: 0.04, pstSign: 1, pstDelta: 0.3 }],
    [{ source: 'A', wsrPTwoSided: 0.20, wsrSign: 1, wsrRankBiserial: 0.2 }],
  );
  assert.equal(r.rows[0]!.bucket, 'sign-only-decisive-second-larger');
  assert.equal(r.signOnly, 1);
});

test('cpw: neither decisive => no-decisive-shift', () => {
  const r = classifyPairedSignWsrRobustnessAgreement(
    [{ source: 'A', pstPTwoSided: 0.30, pstSign: 1, pstDelta: 0.1 }],
    [{ source: 'A', wsrPTwoSided: 0.40, wsrSign: 1, wsrRankBiserial: 0.05 }],
  );
  assert.equal(r.rows[0]!.bucket, 'no-decisive-shift');
  assert.equal(r.atLeastOneDecisive, 0);
});

test('cpw: bucketCounts sums to row count', () => {
  const pst = [
    { source: 'A', pstPTwoSided: 0.001, pstSign: 1 as const, pstDelta: 0.5 },
    { source: 'B', pstPTwoSided: 0.5, pstSign: -1 as const, pstDelta: -0.1 },
    { source: 'C', pstPTwoSided: 0.04, pstSign: 1 as const, pstDelta: 0.4 },
    { source: 'D', pstPTwoSided: 0.2, pstSign: -1 as const, pstDelta: -0.3 },
  ];
  const wsr = [
    { source: 'A', wsrPTwoSided: 0.005, wsrSign: 1 as const, wsrRankBiserial: 0.6 },
    { source: 'B', wsrPTwoSided: 0.01, wsrSign: 1 as const, wsrRankBiserial: 0.4 },
    { source: 'C', wsrPTwoSided: 0.5, wsrSign: 1 as const, wsrRankBiserial: 0.1 },
    { source: 'D', wsrPTwoSided: 0.6, wsrSign: -1 as const, wsrRankBiserial: -0.1 },
  ];
  const r = classifyPairedSignWsrRobustnessAgreement(pst, wsr);
  let sum = 0;
  for (const k of Object.keys(r.bucketCounts) as Array<
    keyof typeof r.bucketCounts
  >) {
    sum += r.bucketCounts[k];
  }
  assert.equal(sum, r.rows.length);
  assert.equal(sum, 4);
});

test('cpw: orphan sources surface in onlyIn arrays', () => {
  const r = classifyPairedSignWsrRobustnessAgreement(
    [
      { source: 'A', pstPTwoSided: 0.3, pstSign: 1, pstDelta: 0.1 },
      { source: 'B', pstPTwoSided: 0.5, pstSign: -1, pstDelta: -0.1 },
    ],
    [
      { source: 'A', wsrPTwoSided: 0.3, wsrSign: 1, wsrRankBiserial: 0.1 },
      { source: 'C', wsrPTwoSided: 0.5, wsrSign: -1, wsrRankBiserial: -0.1 },
    ],
  );
  assert.deepEqual(r.sourcesOnlyInPst, ['B']);
  assert.deepEqual(r.sourcesOnlyInWsr, ['C']);
  assert.equal(r.rows.length, 1); // intersection only
});

test('cpw: rows sorted by source asc', () => {
  const r = classifyPairedSignWsrRobustnessAgreement(
    [
      { source: 'zebra', pstPTwoSided: 0.5, pstSign: 1, pstDelta: 0.1 },
      { source: 'alpha', pstPTwoSided: 0.5, pstSign: 1, pstDelta: 0.1 },
      { source: 'mu', pstPTwoSided: 0.5, pstSign: 1, pstDelta: 0.1 },
    ],
    [
      { source: 'zebra', wsrPTwoSided: 0.5, wsrSign: 1, wsrRankBiserial: 0.1 },
      { source: 'alpha', wsrPTwoSided: 0.5, wsrSign: 1, wsrRankBiserial: 0.1 },
      { source: 'mu', wsrPTwoSided: 0.5, wsrSign: 1, wsrRankBiserial: 0.1 },
    ],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['alpha', 'mu', 'zebra'],
  );
});

test('cpw: throws on duplicate pst source', () => {
  assert.throws(
    () =>
      classifyPairedSignWsrRobustnessAgreement(
        [
          { source: 'A', pstPTwoSided: 0.5, pstSign: 1, pstDelta: 0.1 },
          { source: 'A', pstPTwoSided: 0.4, pstSign: 1, pstDelta: 0.2 },
        ],
        [],
      ),
    /duplicate paired-sign source/,
  );
});

test('cpw: throws on duplicate wsr source', () => {
  assert.throws(
    () =>
      classifyPairedSignWsrRobustnessAgreement(
        [],
        [
          { source: 'A', wsrPTwoSided: 0.5, wsrSign: 1, wsrRankBiserial: 0.1 },
          { source: 'A', wsrPTwoSided: 0.4, wsrSign: 1, wsrRankBiserial: 0.2 },
        ],
      ),
    /duplicate wsr source/,
  );
});

test('cpw: throws on out-of-range pstPTwoSided', () => {
  assert.throws(
    () =>
      classifyPairedSignWsrRobustnessAgreement(
        [{ source: 'A', pstPTwoSided: 1.5, pstSign: 1, pstDelta: 0.1 }],
        [],
      ),
    /pstPTwoSided/,
  );
});

test('cpw: throws on out-of-range pstDelta', () => {
  assert.throws(
    () =>
      classifyPairedSignWsrRobustnessAgreement(
        [{ source: 'A', pstPTwoSided: 0.1, pstSign: 1, pstDelta: 1.5 }],
        [],
      ),
    /pstDelta/,
  );
});

test('cpw: throws on out-of-range wsrRankBiserial', () => {
  assert.throws(
    () =>
      classifyPairedSignWsrRobustnessAgreement(
        [],
        [{ source: 'A', wsrPTwoSided: 0.1, wsrSign: 1, wsrRankBiserial: -2 }],
      ),
    /wsrRankBiserial/,
  );
});

test('cpw: throws on bad pstSign', () => {
  assert.throws(
    () =>
      classifyPairedSignWsrRobustnessAgreement(
        [{ source: 'A', pstPTwoSided: 0.1, pstSign: 5 as never, pstDelta: 0.1 }],
        [],
      ),
    /pstSign/,
  );
});

test('cpw: live cross-source mirror — claude-code both decisive +', () => {
  // Mirrors live-smoke values for axis-190 + axis-189 on
  // claude-code: both reject, both positive => both-
  // decisive-second-larger.
  const r = classifyPairedSignWsrRobustnessAgreement(
    [{ source: 'claude-code', pstPTwoSided: 8.13e-3, pstSign: 1, pstDelta: 0.5172 }],
    [{ source: 'claude-code', wsrPTwoSided: 1e-3, wsrSign: 1, wsrRankBiserial: 0.6 }],
  );
  assert.equal(r.rows[0]!.bucket, 'both-decisive-second-larger');
  assert.equal(r.bothDecisiveAgreement, 1);
});

test('cpw: pst decisive at sign=0 with non-zero wsr direction => deferred', () => {
  // Pathological: pst sits exactly at expectation but
  // somehow has p<=alpha -- defer direction to wsr.
  const r = classifyPairedSignWsrRobustnessAgreement(
    [{ source: 'A', pstPTwoSided: 0.04, pstSign: 0, pstDelta: 0 }],
    [{ source: 'A', wsrPTwoSided: 0.02, wsrSign: 1, wsrRankBiserial: 0.3 }],
  );
  assert.equal(r.rows[0]!.bucket, 'both-decisive-second-larger');
  assert.equal(r.bothDecisiveAgreement, 1);
});

test('cpw: both signs zero with both decisive => sign-conflict', () => {
  const r = classifyPairedSignWsrRobustnessAgreement(
    [{ source: 'A', pstPTwoSided: 0.04, pstSign: 0, pstDelta: 0 }],
    [{ source: 'A', wsrPTwoSided: 0.02, wsrSign: 0, wsrRankBiserial: 0 }],
  );
  assert.equal(r.rows[0]!.bucket, 'sign-conflict');
  assert.equal(r.signConflicts, 1);
});

test('cpw: row preserves all inputs', () => {
  const r = classifyPairedSignWsrRobustnessAgreement(
    [{ source: 'X', pstPTwoSided: 0.123, pstSign: 1, pstDelta: 0.456 }],
    [{ source: 'X', wsrPTwoSided: 0.789, wsrSign: -1, wsrRankBiserial: -0.234 }],
  );
  const row = r.rows[0]!;
  assert.equal(row.source, 'X');
  assert.equal(row.pstPTwoSided, 0.123);
  assert.equal(row.pstSign, 1);
  assert.equal(row.pstDelta, 0.456);
  assert.equal(row.wsrPTwoSided, 0.789);
  assert.equal(row.wsrSign, -1);
  assert.equal(row.wsrRankBiserial, -0.234);
});

test('cpw: counts a real 5-source live-smoke panel', () => {
  // Mirrors the four-real-source + one auxiliary live
  // panel at axis-190 publication time.
  const pst = [
    { source: 'claude-code', pstPTwoSided: 8.13e-3, pstSign: 1 as const, pstDelta: 0.5172 },
    { source: 'vscode-cp',   pstPTwoSided: 3.96e-2, pstSign: -1 as const, pstDelta: -0.2787 },
    { source: 'openclaw',    pstPTwoSided: 3.91e-2, pstSign: -1 as const, pstDelta: -0.7778 },
    { source: 'opencode',    pstPTwoSided: 2.89e-1, pstSign: -1 as const, pstDelta: -0.5000 },
    { source: 'hermes',      pstPTwoSided: 5.08e-1, pstSign: 1 as const, pstDelta: 0.3333 },
  ];
  // Approximate axis-189 wsr values from prior cadence
  // (matched signs, similar magnitudes).
  const wsr = [
    { source: 'claude-code', wsrPTwoSided: 1.0e-3, wsrSign: 1 as const, wsrRankBiserial: 0.65 },
    { source: 'vscode-cp',   wsrPTwoSided: 2.5e-2, wsrSign: -1 as const, wsrRankBiserial: -0.30 },
    { source: 'openclaw',    wsrPTwoSided: 4.0e-2, wsrSign: -1 as const, wsrRankBiserial: -0.78 },
    { source: 'opencode',    wsrPTwoSided: 0.30,   wsrSign: -1 as const, wsrRankBiserial: -0.45 },
    { source: 'hermes',      wsrPTwoSided: 0.50,   wsrSign: 1 as const, wsrRankBiserial: 0.30 },
  ];
  const r = classifyPairedSignWsrRobustnessAgreement(pst, wsr);
  assert.equal(r.rows.length, 5);
  // Three sources cross .05 in BOTH axes with matching signs:
  //   claude-code (+, +), vscode-cp (-, -), openclaw (-, -).
  assert.equal(r.bothDecisive, 3);
  assert.equal(r.bothDecisiveAgreement, 3);
  assert.equal(r.signConflicts, 0);
  // No wsr-only and no sign-only because both axes
  // agree on which sources cross.
  assert.equal(r.wsrOnlyButRobustVeto, 0);
  assert.equal(r.signOnly, 0);
  assert.equal(r.atLeastOneDecisive, 3);
  assert.equal(r.bucketCounts['both-decisive-second-larger'], 1);
  assert.equal(r.bucketCounts['both-decisive-first-larger'], 2);
  assert.equal(r.bucketCounts['no-decisive-shift'], 2);
});
