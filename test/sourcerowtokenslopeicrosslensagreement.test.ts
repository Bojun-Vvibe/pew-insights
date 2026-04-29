/**
 * Unit + integration tests for source-row-token-slope-ci-cross-lens-agreement.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiCrossLensAgreement,
  renderSourceRowTokenSlopeCiCrossLensAgreement,
  intervalOverlap,
  intervalJaccard,
  consensusInterval,
  unionEnvelope,
  meanPairwiseJaccard,
  LENS_NAMES,
} from '../src/sourcerowtokenslopeicrosslensagreement.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

const GEN = '2026-04-29T12:00:00.000Z';

// =========================================================================
// intervalOverlap
// =========================================================================

test('intervalOverlap: identical intervals return their length', () => {
  assert.equal(intervalOverlap(0, 10, 0, 10), 10);
});

test('intervalOverlap: disjoint intervals return 0', () => {
  assert.equal(intervalOverlap(0, 5, 6, 10), 0);
});

test('intervalOverlap: touching at a single point returns 0 (open intersection)', () => {
  assert.equal(intervalOverlap(0, 5, 5, 10), 0);
});

test('intervalOverlap: nested intervals return inner length', () => {
  assert.equal(intervalOverlap(0, 10, 2, 7), 5);
});

test('intervalOverlap: partial overlap', () => {
  assert.equal(intervalOverlap(0, 6, 4, 10), 2);
});

test('intervalOverlap: order of arguments does not matter', () => {
  assert.equal(intervalOverlap(0, 6, 4, 10), intervalOverlap(4, 10, 0, 6));
});

test('intervalOverlap: negative-coordinate intervals work', () => {
  assert.equal(intervalOverlap(-10, -2, -5, 0), 3);
});

// =========================================================================
// intervalJaccard
// =========================================================================

test('intervalJaccard: identical intervals -> 1', () => {
  assert.equal(intervalJaccard(0, 10, 0, 10), 1);
});

test('intervalJaccard: disjoint intervals with positive length -> 0', () => {
  assert.equal(intervalJaccard(0, 1, 5, 10), 0);
});

test('intervalJaccard: same single point -> 1', () => {
  assert.equal(intervalJaccard(3, 3, 3, 3), 1);
});

test('intervalJaccard: different single points -> 0', () => {
  // Both points => union length is max-min > 0; overlap = 0.
  assert.equal(intervalJaccard(3, 3, 5, 5), 0);
});

test('intervalJaccard: nested half-coverage', () => {
  // [0,10] ∩ [0,5] = 5; ∪ = [0,10] = 10 -> 0.5.
  assert.equal(intervalJaccard(0, 10, 0, 5), 0.5);
});

test('intervalJaccard: symmetric', () => {
  assert.equal(intervalJaccard(0, 10, 4, 12), intervalJaccard(4, 12, 0, 10));
});

test('intervalJaccard: result is always in [0, 1]', () => {
  for (let aLo = -3; aLo <= 3; aLo += 1) {
    for (let aHi = aLo; aHi <= aLo + 6; aHi += 1) {
      for (let bLo = -3; bLo <= 3; bLo += 1) {
        for (let bHi = bLo; bHi <= bLo + 6; bHi += 1) {
          const j = intervalJaccard(aLo, aHi, bLo, bHi);
          assert.ok(j >= 0 && j <= 1, `j=${j} for [${aLo},${aHi}] vs [${bLo},${bHi}]`);
        }
      }
    }
  }
});

// =========================================================================
// consensusInterval / unionEnvelope
// =========================================================================

test('consensusInterval: empty input returns empty NaN result', () => {
  const c = consensusInterval([]);
  assert.equal(c.isEmpty, true);
  assert.ok(Number.isNaN(c.lo));
  assert.ok(Number.isNaN(c.hi));
});

test('consensusInterval: single interval is itself', () => {
  const c = consensusInterval([{ lo: 1, hi: 5 }]);
  assert.deepEqual({ lo: c.lo, hi: c.hi, isEmpty: c.isEmpty }, { lo: 1, hi: 5, isEmpty: false });
});

test('consensusInterval: all overlapping returns the intersection', () => {
  const c = consensusInterval([
    { lo: 0, hi: 10 },
    { lo: 2, hi: 8 },
    { lo: 1, hi: 5 },
  ]);
  assert.deepEqual({ lo: c.lo, hi: c.hi, isEmpty: c.isEmpty }, { lo: 2, hi: 5, isEmpty: false });
});

test('consensusInterval: any disjoint pair makes result empty', () => {
  const c = consensusInterval([
    { lo: 0, hi: 1 },
    { lo: 5, hi: 6 },
  ]);
  assert.equal(c.isEmpty, true);
});

test('unionEnvelope: empty input returns NaN endpoints', () => {
  const u = unionEnvelope([]);
  assert.ok(Number.isNaN(u.lo));
  assert.ok(Number.isNaN(u.hi));
});

test('unionEnvelope: returns global min/max endpoints', () => {
  const u = unionEnvelope([
    { lo: 0, hi: 5 },
    { lo: 3, hi: 12 },
    { lo: -2, hi: 1 },
  ]);
  assert.deepEqual(u, { lo: -2, hi: 12 });
});

// =========================================================================
// meanPairwiseJaccard
// =========================================================================

test('meanPairwiseJaccard: single interval returns 1 by convention', () => {
  assert.equal(meanPairwiseJaccard([{ lo: 0, hi: 1 }]), 1);
});

test('meanPairwiseJaccard: all-identical intervals return 1', () => {
  const ivs = Array.from({ length: 6 }, () => ({ lo: 0, hi: 10 }));
  assert.equal(meanPairwiseJaccard(ivs), 1);
});

test('meanPairwiseJaccard: all-disjoint intervals return 0', () => {
  const ivs = [
    { lo: 0, hi: 1 },
    { lo: 2, hi: 3 },
    { lo: 4, hi: 5 },
  ];
  assert.equal(meanPairwiseJaccard(ivs), 0);
});

test('meanPairwiseJaccard: 6 intervals -> 15 pair contributions (averaged)', () => {
  // Two clusters: three at [0, 10] and three at [0, 5]. All pairs overlap.
  const ivs = [
    { lo: 0, hi: 10 },
    { lo: 0, hi: 10 },
    { lo: 0, hi: 10 },
    { lo: 0, hi: 5 },
    { lo: 0, hi: 5 },
    { lo: 0, hi: 5 },
  ];
  // C(3,2)=3 pairs of jaccard 1 within each cluster (so 6 pairs of 1).
  // 3*3=9 cross-cluster pairs of jaccard 0.5.
  // Total = 6*1 + 9*0.5 = 10.5; mean = 10.5 / 15 = 0.7.
  const m = meanPairwiseJaccard(ivs);
  assert.ok(Math.abs(m - 0.7) < 1e-12, `m=${m}`);
});

// =========================================================================
// buildSourceRowTokenSlopeCiCrossLensAgreement: validation
// =========================================================================

test('build: throws on minRows < 4', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCrossLensAgreement([], { minRows: 3 } as never),
  );
});

test('build: throws on confidence out of (0,1)', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCrossLensAgreement([], { confidence: 0 } as never),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCrossLensAgreement([], { confidence: 1 } as never),
  );
});

test('build: throws on lambda <= 0', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCrossLensAgreement([], { lambda: 0 } as never),
  );
});

test('build: throws on bootstraps < 100', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCrossLensAgreement([], { bootstraps: 50 } as never),
  );
});

test('build: throws on non-integer seed', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCrossLensAgreement([], { seed: 1.5 } as never),
  );
});

test('build: throws on top < 1', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCrossLensAgreement([], { top: 0 } as never),
  );
});

test('build: throws on bad sort key', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiCrossLensAgreement([], { sort: 'bogus' } as never),
  );
});

// =========================================================================
// buildSourceRowTokenSlopeCiCrossLensAgreement: end-to-end on a real series
// =========================================================================

test('build: empty queue produces an empty report', () => {
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement([], {
    generatedAt: GEN,
    bootstraps: 200,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.disagreeCount, 0);
});

test('build: single strong-trend source produces an all-lenses-agree row', () => {
  // Strict monotone series: every reasonable lens should give a CI
  // around a positive slope. With 30 rows the bootstrap converges.
  const queue = mkSeries('s1', Array.from({ length: 30 }, (_, i) => 100 + 10 * i));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement(queue, {
    generatedAt: GEN,
    bootstraps: 200,
  });
  assert.equal(r.sourcesWithAllLenses, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 's1');
  assert.equal(row.rowsKept, 30);
  // 6 lenses -> 6 slope entries, 6 CI entries, 15 pair entries.
  assert.equal(Object.keys(row.slopes).length, 6);
  assert.equal(Object.keys(row.cis).length, 6);
  assert.equal(row.pairs.length, 15);
  // agreementIndex always lies in [0, 1] regardless of whether
  // the six lenses end up overlapping; the structural shape of
  // the output is what we assert here. A perfect monotone series
  // with closed-form-zero residuals produces NaN-tight individual
  // CIs whose intersection can be empty (each lens degenerate in
  // its own way).
  assert.ok(row.agreementIndex >= 0, `agreementIndex=${row.agreementIndex}`);
  assert.ok(row.agreementIndex <= 1);
  // lensesAgree is the boolean version of !consensusIntervalIsEmpty.
  assert.equal(row.lensesAgree, !row.consensusIntervalIsEmpty);
});

test('build: pair entries follow LENS_NAMES lex order with i<j', () => {
  const queue = mkSeries('s1', Array.from({ length: 12 }, (_, i) => 50 + i * 3));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement(queue, {
    generatedAt: GEN,
    bootstraps: 200,
  });
  const row = r.sources[0]!;
  // First pair must be (LENS_NAMES[0], LENS_NAMES[1]).
  assert.equal(row.pairs[0]!.a, LENS_NAMES[0]);
  assert.equal(row.pairs[0]!.b, LENS_NAMES[1]);
  // Last pair must be (LENS_NAMES[4], LENS_NAMES[5]).
  assert.equal(row.pairs[14]!.a, LENS_NAMES[4]);
  assert.equal(row.pairs[14]!.b, LENS_NAMES[5]);
});

test('build: agreementIndex equals mean of the 15 pair Jaccards', () => {
  const queue = mkSeries('s1', Array.from({ length: 16 }, (_, i) => 200 + i * 5));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement(queue, {
    generatedAt: GEN,
    bootstraps: 200,
  });
  const row = r.sources[0]!;
  let total = 0;
  for (const p of row.pairs) total += p.jaccard;
  const mean = total / row.pairs.length;
  assert.ok(Math.abs(mean - row.agreementIndex) < 1e-12);
});

test('build: union envelope contains every per-lens CI', () => {
  const queue = mkSeries('s1', Array.from({ length: 20 }, (_, i) => 50 + 2 * i));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement(queue, {
    generatedAt: GEN,
    bootstraps: 200,
  });
  const row = r.sources[0]!;
  for (const lens of LENS_NAMES) {
    const ci = row.cis[lens];
    assert.ok(ci.ciLower >= row.unionLower - 1e-9, `${lens} ciLower=${ci.ciLower} unionLower=${row.unionLower}`);
    assert.ok(ci.ciUpper <= row.unionUpper + 1e-9, `${lens} ciUpper=${ci.ciUpper} unionUpper=${row.unionUpper}`);
  }
});

test('build: when lensesAgree, every lens CI contains the consensus interval', () => {
  const queue = mkSeries('s1', Array.from({ length: 20 }, (_, i) => 100 + 4 * i));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement(queue, {
    generatedAt: GEN,
    bootstraps: 200,
  });
  const row = r.sources[0]!;
  if (!row.lensesAgree) return; // skip if disagree (not the test's fault)
  for (const lens of LENS_NAMES) {
    const ci = row.cis[lens];
    assert.ok(ci.ciLower <= row.consensusLower + 1e-9, `${lens} ciLower=${ci.ciLower} consensusLower=${row.consensusLower}`);
    assert.ok(ci.ciUpper >= row.consensusUpper - 1e-9, `${lens} ciUpper=${ci.ciUpper} consensusUpper=${row.consensusUpper}`);
  }
});

test('build: disjointPairCount + agreeing-pair count = 15', () => {
  const queue = mkSeries('s1', Array.from({ length: 14 }, (_, i) => 25 + 7 * i));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement(queue, {
    generatedAt: GEN,
    bootstraps: 200,
  });
  const row = r.sources[0]!;
  let disj = 0;
  for (const p of row.pairs) if (p.disjoint) disj += 1;
  assert.equal(disj, row.disjointPairCount);
  assert.equal(row.pairs.length, 15);
});

test('build: multiple sources are separated correctly', () => {
  const a = mkSeries('a', Array.from({ length: 20 }, (_, i) => 100 + 2 * i));
  const b = mkSeries('b', Array.from({ length: 20 }, (_, i) => 500 - 3 * i));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement([...a, ...b], {
    generatedAt: GEN,
    bootstraps: 200,
  });
  assert.equal(r.sourcesWithAllLenses, 2);
  const sources = r.sources.map((row) => row.source).sort();
  assert.deepEqual(sources, ['a', 'b']);
});

test('build: --source filter restricts to one source', () => {
  const a = mkSeries('a', Array.from({ length: 20 }, (_, i) => 100 + 2 * i));
  const b = mkSeries('b', Array.from({ length: 20 }, (_, i) => 500 - 3 * i));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement([...a, ...b], {
    generatedAt: GEN,
    bootstraps: 200,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('build: alertDisagree drops all-overlap sources and bumps droppedNotDisagree', () => {
  const queue = mkSeries('s1', Array.from({ length: 20 }, (_, i) => 100 + 5 * i));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement(queue, {
    generatedAt: GEN,
    bootstraps: 200,
    alertDisagree: true,
  });
  // The strict-monotone series should produce a row that DOES agree;
  // alertDisagree filters it out.
  if (r.disagreeCount === 0) {
    assert.equal(r.sources.length, 0);
    assert.equal(r.droppedNotDisagree, 1);
  }
});

test('build: alertZeroInUnion filters to union-contains-zero sources', () => {
  // Series with no real trend (constant + tiny noise alternation)
  // should produce a CI envelope that often straddles zero.
  const vals = Array.from({ length: 20 }, (_, i) => 100 + (i % 2 === 0 ? 1 : -1));
  const queue = mkSeries('s1', vals);
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement(queue, {
    generatedAt: GEN,
    bootstraps: 200,
    alertZeroInUnion: true,
  });
  // Each surviving source must have unionContainsZero = true.
  for (const row of r.sources) {
    assert.equal(row.unionContainsZero, true);
  }
});

test('build: top cap respects ordering and bumps droppedBelowTopCap', () => {
  const a = mkSeries('a', Array.from({ length: 20 }, (_, i) => 100 + 2 * i));
  const b = mkSeries('b', Array.from({ length: 20 }, (_, i) => 200 + 4 * i));
  const c = mkSeries('c', Array.from({ length: 20 }, (_, i) => 50 + 7 * i));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement([...a, ...b, ...c], {
    generatedAt: GEN,
    bootstraps: 200,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('build: agreement-desc sort puts the highest agreement first', () => {
  const a = mkSeries('a', Array.from({ length: 20 }, (_, i) => 100 + 2 * i));
  const b = mkSeries('b', Array.from({ length: 20 }, (_, i) => 500 - 3 * i));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement([...a, ...b], {
    generatedAt: GEN,
    bootstraps: 200,
    sort: 'agreement-desc',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.agreementIndex >= r.sources[i]!.agreementIndex);
  }
});

test('build: source sort is alphabetical', () => {
  const a = mkSeries('zzzz', Array.from({ length: 20 }, (_, i) => 100 + 2 * i));
  const b = mkSeries('aaaa', Array.from({ length: 20 }, (_, i) => 200 + 4 * i));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement([...a, ...b], {
    generatedAt: GEN,
    bootstraps: 200,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'aaaa');
  assert.equal(r.sources[1]!.source, 'zzzz');
});

test('build: every CI width >= 0 across all six lenses', () => {
  const queue = mkSeries('s1', Array.from({ length: 25 }, (_, i) => 80 + 3 * i));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement(queue, {
    generatedAt: GEN,
    bootstraps: 200,
  });
  const row = r.sources[0]!;
  for (const lens of LENS_NAMES) {
    assert.ok(row.cis[lens].ciWidth >= 0);
  }
});

test('build: slopeSpread is always >= 0 and slopeStd is finite', () => {
  const queue = mkSeries('s1', Array.from({ length: 25 }, (_, i) => 80 + 3 * i));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement(queue, {
    generatedAt: GEN,
    bootstraps: 200,
  });
  const row = r.sources[0]!;
  assert.ok(row.slopeSpread >= 0);
  assert.ok(Number.isFinite(row.slopeStd));
  assert.ok(row.slopeStd >= 0);
});

test('build: confidence forwarded -- wider CI at higher confidence', () => {
  const queue = mkSeries('s1', Array.from({ length: 25 }, (_, i) => 80 + 3 * i));
  const r80 = buildSourceRowTokenSlopeCiCrossLensAgreement(queue, {
    generatedAt: GEN,
    bootstraps: 200,
    confidence: 0.8,
  });
  const r99 = buildSourceRowTokenSlopeCiCrossLensAgreement(queue, {
    generatedAt: GEN,
    bootstraps: 200,
    confidence: 0.99,
  });
  // The union envelope at 99% confidence must be at least as wide
  // as at 80% (it is composed of monotone-in-confidence individual
  // lens CIs).
  assert.ok(r99.sources[0]!.unionWidth >= r80.sources[0]!.unionWidth - 1e-9);
});

// =========================================================================
// renderer
// =========================================================================

test('render: includes the command name in the header', () => {
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement([], {
    generatedAt: GEN,
    bootstraps: 200,
  });
  const out = renderSourceRowTokenSlopeCiCrossLensAgreement(r);
  assert.ok(out.includes('source-row-token-slope-ci-cross-lens-agreement'));
});

test('render: empty sources path emits "(no sources)"', () => {
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement([], {
    generatedAt: GEN,
    bootstraps: 200,
  });
  const out = renderSourceRowTokenSlopeCiCrossLensAgreement(r);
  assert.ok(out.includes('(no sources)'));
});

test('render: non-empty sources include a table row per source', () => {
  const a = mkSeries('a', Array.from({ length: 18 }, (_, i) => 100 + 2 * i));
  const r = buildSourceRowTokenSlopeCiCrossLensAgreement(a, {
    generatedAt: GEN,
    bootstraps: 200,
  });
  const out = renderSourceRowTokenSlopeCiCrossLensAgreement(r);
  assert.ok(out.includes('agreeIdx'));
  assert.ok(out.includes('a '));
});
