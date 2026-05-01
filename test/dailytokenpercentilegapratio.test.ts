import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenPercentileGapRatio,
  percentileGapRatioOfVector,
  linearPercentileSorted,
} from '../src/dailytokenpercentilegapratio.js';
import { geFourOfVector } from '../src/dailytokengefourindex.js';
import { ge2OfVector } from '../src/dailytokenge2index.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-01T00:00:00.000Z';

// ---- linearPercentileSorted primitive --------------------------------

test('linearPercentileSorted: empty -> 0', () => {
  assert.equal(linearPercentileSorted([], 0.5), 0);
});

test('linearPercentileSorted: singleton -> the value', () => {
  assert.equal(linearPercentileSorted([42], 0.5), 42);
  assert.equal(linearPercentileSorted([42], 0.9), 42);
});

test('linearPercentileSorted: matches numpy "linear" / R type 7 on [1..10]', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  // P50 of [1..10] under type-7: h = 0.5 * 9 = 4.5; v[4] + 0.5*(v[5]-v[4]) = 5 + 0.5 = 5.5
  assert.ok(Math.abs(linearPercentileSorted(v, 0.5) - 5.5) < 1e-12);
  // P90: h = 0.9 * 9 = 8.1; v[8] + 0.1*(v[9]-v[8]) = 9 + 0.1 = 9.1
  assert.ok(Math.abs(linearPercentileSorted(v, 0.9) - 9.1) < 1e-12);
  // P25: h = 2.25; v[2] + 0.25*(v[3]-v[2]) = 3 + 0.25 = 3.25
  assert.ok(Math.abs(linearPercentileSorted(v, 0.25) - 3.25) < 1e-12);
  // P75: h = 6.75; v[6] + 0.75*(v[7]-v[6]) = 7 + 0.75 = 7.75
  assert.ok(Math.abs(linearPercentileSorted(v, 0.75) - 7.75) < 1e-12);
  // q=0 -> min, q=1 -> max
  assert.equal(linearPercentileSorted(v, 0), 1);
  assert.equal(linearPercentileSorted(v, 1), 10);
});

test('linearPercentileSorted: rejects q out of range', () => {
  assert.throws(() => linearPercentileSorted([1, 2, 3], -0.1));
  assert.throws(() => linearPercentileSorted([1, 2, 3], 1.1));
  assert.throws(() => linearPercentileSorted([1, 2, 3], Number.NaN));
});

// ---- percentileGapRatioOfVector primitive ---------------------------

test('percentileGapRatioOfVector: empty -> degenerate, pgr=1', () => {
  const r = percentileGapRatioOfVector([]);
  assert.equal(r.pgr, 1);
  assert.equal(r.degenerate, true);
});

test('percentileGapRatioOfVector: n=1 -> degenerate, pgr=1', () => {
  const r = percentileGapRatioOfVector([42]);
  assert.equal(r.pgr, 1);
  assert.equal(r.degenerate, true);
  assert.equal(r.p50, 42);
  assert.equal(r.p90, 42);
});

test('percentileGapRatioOfVector: perfect equality -> pgr=1, degenerate', () => {
  const r = percentileGapRatioOfVector([7, 7, 7, 7, 7, 7]);
  assert.equal(r.pgr, 1);
  assert.equal(r.degenerate, true);
});

test('percentileGapRatioOfVector: scale-invariant', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = percentileGapRatioOfVector(v);
  const b = percentileGapRatioOfVector(v.map((x) => x * 1e6));
  assert.ok(
    Math.abs(a.pgr - b.pgr) < 1e-12,
    `${a.pgr} vs ${b.pgr}`,
  );
});

test('percentileGapRatioOfVector: permutation-invariant', () => {
  const a = percentileGapRatioOfVector([1, 3, 7, 9, 4, 11]);
  const b = percentileGapRatioOfVector([11, 4, 9, 3, 7, 1]);
  assert.ok(Math.abs(a.pgr - b.pgr) < 1e-12);
});

test('percentileGapRatioOfVector: closed-form on [1..10] (PGR = 9.1/5.5)', () => {
  const r = percentileGapRatioOfVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(Math.abs(r.p50 - 5.5) < 1e-12);
  assert.ok(Math.abs(r.p90 - 9.1) < 1e-12);
  const expected = 9.1 / 5.5;
  assert.ok(
    Math.abs(r.pgr - expected) < 1e-12,
    `got ${r.pgr}, expected ${expected}`,
  );
  // IQR ratio: 7.75 / 3.25
  assert.ok(Math.abs(r.iqrRatio - 7.75 / 3.25) < 1e-12);
});

test('percentileGapRatioOfVector: pgr >= 1 by monotonicity of percentiles', () => {
  // 50 random positive vectors via deterministic LCG.
  let s = 12345;
  function rnd(): number {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    return (s + 1) / 0x80000000;
  }
  for (let trial = 0; trial < 50; trial++) {
    const n = 4 + Math.floor(rnd() * 60);
    const v: number[] = [];
    for (let i = 0; i < n; i++) v.push(1 + rnd() * 1000);
    const r = percentileGapRatioOfVector(v);
    assert.ok(r.pgr >= 1 - 1e-12, `pgr=${r.pgr} on n=${n}`);
  }
});

test('percentileGapRatioOfVector: throws on zero, negative, NaN', () => {
  assert.throws(() => percentileGapRatioOfVector([1, 0, 4]));
  assert.throws(() => percentileGapRatioOfVector([1, -3, 4]));
  assert.throws(() => percentileGapRatioOfVector([1, Number.NaN, 4]));
});

test('percentileGapRatioOfVector: error message names function and bad value', () => {
  try {
    percentileGapRatioOfVector([1, 2, -5, 3]);
    assert.fail('should have thrown');
  } catch (e) {
    const msg = (e as Error).message;
    assert.ok(
      msg.includes('percentileGapRatioOfVector') && msg.includes('-5'),
      `got: ${msg}`,
    );
  }
});

// ---- ORTHOGONALITY / NON-DEGENERACY: pgr robust to >P90 changes ---

test('percentileGapRatioOfVector: invariant to ANY change strictly above P90 (the robustness witness)', () => {
  // Take vector of length 10. Indices sorted: percentile P90 lies
  // between idx 8 and idx 9 (h = 8.1). So idx 9 (the maximum) sits
  // strictly ABOVE P90 at the q=0.9+epsilon region. Because P90 uses
  // a 0.1 weight on idx 9, the largest day DOES affect P90 here -
  // BUT the value strictly above the position f=0.1 between idx 8 and
  // idx 9 doesn't matter once the max is the only value above idx 8.
  // The cleaner robustness witness: in n=11, h_90 = 9, so P90 = v[9]
  // exactly and v[10] (the max) does NOT contribute. Demonstrate
  // pgr unchanged when v[10] grows arbitrarily.
  const baseN11 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const baseR = percentileGapRatioOfVector(baseN11);
  // Replace the max with something orders of magnitude larger.
  const spiked = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1_000_000_000];
  const spikedR = percentileGapRatioOfVector(spiked);
  // P50 of n=11: h = 5, P50 = v[5] = 6. P90 of n=11: h = 9, P90 = v[9] = 10.
  // pgr = 10/6 = 5/3.
  assert.ok(Math.abs(baseR.pgr - 5 / 3) < 1e-12, `base pgr ${baseR.pgr}`);
  assert.ok(
    Math.abs(spikedR.pgr - baseR.pgr) < 1e-12,
    `spiked pgr ${spikedR.pgr} != base pgr ${baseR.pgr} (PGR not robust to >P90 changes)`,
  );
  // Now for contrast: GE(2) and GE(4) MUST change when the max grows.
  const baseG2 = ge2OfVector(baseN11).ge2;
  const spikedG2 = ge2OfVector(spiked).ge2;
  assert.ok(
    spikedG2 > baseG2 * 10,
    `GE(2) must blow up: base=${baseG2}, spiked=${spikedG2}`,
  );
  const baseG4 = geFourOfVector(baseN11).gefour;
  const spikedG4 = geFourOfVector(spiked).gefour;
  assert.ok(
    spikedG4 > baseG4 * 10,
    `GE(4) must blow up: base=${baseG4}, spiked=${spikedG4}`,
  );
});

test('percentileGapRatioOfVector: rank flip vs GE(2) (the genuine orthogonality witness)', () => {
  // Construct two sources where:
  //   A: ranks HIGHER on PGR than B (its top-decile/median ratio is bigger),
  //   but LOWER on GE(2) (because GE(2) is dominated by extreme spikes
  //   above P90 that A lacks and B has).
  //
  // A: [1,1,1,1,1,1,3,3,3,3,3]  -- moderate step from low half to high half
  //    n=11; P50 = v[5] = 1; P90 = v[9] = 3; PGR = 3.
  //    GE(2) = (1/2) * CV^2 of [1*6, 3*5]: mean = 21/11 = 1.9091;
  //    var = (6*(1-1.9091)^2 + 5*(3-1.9091)^2)/11 = (6*0.8264 + 5*1.1901)/11
  //        = (4.9587 + 5.9504)/11 = 10.909/11 = 0.99174
  //    CV^2 = var/mean^2 = 0.99174/3.6446 = 0.272; GE(2) = 0.136.
  // B: [1,1,1,1,1,1,1,1,1,1,1000]  -- one massive spike, otherwise dead flat
  //    n=11; P50 = v[5] = 1; P90 = v[9] = 1; PGR = 1 (degenerate!).
  //    GE(2) of [1*10, 1000*1]: mean = 1010/11 = 91.82; the spike
  //    dominates; var huge; CV huge; GE(2) >>> A's GE(2).
  //
  // So: PGR(A) = 3 > PGR(B) = 1, but GE(2)(B) >>> GE(2)(A). Rank flip.
  const A = [1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3];
  const B = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1000];
  const pgrA = percentileGapRatioOfVector(A).pgr;
  const pgrB = percentileGapRatioOfVector(B).pgr;
  const ge2A = ge2OfVector(A).ge2;
  const ge2B = ge2OfVector(B).ge2;
  assert.ok(pgrA > pgrB, `pgrA=${pgrA} should > pgrB=${pgrB}`);
  assert.ok(
    ge2B > ge2A,
    `ge2B=${ge2B} should > ge2A=${ge2A} (rank flip vs PGR)`,
  );
});

test('percentileGapRatioOfVector: rank flip vs GE(4) (heavier upper-tail axis)', () => {
  // Similar construction; GE(4) raises shares to the 4th power so a
  // single spike completely dominates.
  const A = [10, 10, 10, 10, 10, 10, 30, 30, 30, 30, 30];
  const B = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10000];
  const pgrA = percentileGapRatioOfVector(A).pgr;
  const pgrB = percentileGapRatioOfVector(B).pgr;
  const g4A = geFourOfVector(A).gefour;
  const g4B = geFourOfVector(B).gefour;
  assert.ok(pgrA > pgrB);
  assert.ok(g4B > g4A * 100);
});

// ---- builder behaviour ----------------------------------------------

test('buildDailyTokenPercentileGapRatio: empty queue -> zero rows, zero counters', () => {
  const r = buildDailyTokenPercentileGapRatio([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.droppedInvalidHourStart, 0);
  assert.equal(r.droppedNonPositiveTokens, 0);
  assert.equal(r.droppedSourceFilter, 0);
  assert.equal(r.droppedSparseSources, 0);
  assert.equal(r.droppedBelowMinDays, 0);
  assert.equal(r.droppedBelowMinPgr, 0);
  assert.equal(r.droppedTopSources, 0);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.minDays, 4);
  assert.equal(r.sort, 'pgr');
});

test('buildDailyTokenPercentileGapRatio: one source mixed days computes pgr > 1', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 100),
    ql('2026-04-26T00:00:00Z', 'a', 400),
    ql('2026-04-27T00:00:00Z', 'a', 900),
    ql('2026-04-28T00:00:00Z', 'a', 1600),
  ];
  const r = buildDailyTokenPercentileGapRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'a');
  assert.equal(row.nDays, 4);
  assert.ok(row.pgr > 1);
  assert.equal(row.degenerate, false);
  assert.equal(row.minDay, '2026-04-25');
  assert.equal(row.maxDay, '2026-04-28');
});

test('buildDailyTokenPercentileGapRatio: equal days -> degenerate, pgr=1', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 100),
    ql('2026-04-26T00:00:00Z', 'a', 100),
    ql('2026-04-27T00:00:00Z', 'a', 100),
    ql('2026-04-28T00:00:00Z', 'a', 100),
  ];
  const r = buildDailyTokenPercentileGapRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.degenerate, true);
  assert.equal(r.sources[0]!.pgr, 1);
});

test('buildDailyTokenPercentileGapRatio: --include-p75-p25 surfaces p25/p75/iqrRatio', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 10; d++) {
    queue.push(ql(`2026-04-${String(d).padStart(2, '0')}T00:00:00Z`, 'a', d * 100));
  }
  const r = buildDailyTokenPercentileGapRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
    includeP75P25: true,
  });
  const row = r.sources[0]!;
  assert.ok(row.p25 !== undefined);
  assert.ok(row.p75 !== undefined);
  assert.ok(row.iqrRatio !== undefined);
  // P25 of [100..1000] = 325; P75 = 775; iqrRatio = 775/325
  assert.ok(Math.abs((row.p25 as number) - 325) < 1e-9);
  assert.ok(Math.abs((row.p75 as number) - 775) < 1e-9);
  assert.ok(Math.abs((row.iqrRatio as number) - 775 / 325) < 1e-9);
});

test('buildDailyTokenPercentileGapRatio: filters minTokens / minDays / minPgr', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'sparse', 100),
    ql('2026-04-26T00:00:00Z', 'sparse', 100),
    ql('2026-04-27T00:00:00Z', 'sparse', 100),
    ql('2026-04-28T00:00:00Z', 'sparse', 100),
    ql('2026-04-25T00:00:00Z', 'fewdays', 2000),
    ql('2026-04-26T00:00:00Z', 'fewdays', 2000),
    ql('2026-04-25T00:00:00Z', 'ok', 1000),
    ql('2026-04-26T00:00:00Z', 'ok', 2000),
    ql('2026-04-27T00:00:00Z', 'ok', 3000),
    ql('2026-04-28T00:00:00Z', 'ok', 4000),
  ];
  const r = buildDailyTokenPercentileGapRatio(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'ok');
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowMinDays, 1);
  const r2 = buildDailyTokenPercentileGapRatio(queue, {
    generatedAt: GEN,
    minPgr: 100.0,
  });
  assert.equal(r2.sources.length, 0);
  assert.equal(r2.droppedBelowMinPgr, 1);
});

test('buildDailyTokenPercentileGapRatio: top cap and sort respected', () => {
  const queue: QueueLine[] = [];
  for (let d = 25; d <= 28; d++) {
    queue.push(ql(`2026-04-${d}T00:00:00Z`, 'low', 1000 + d));
    queue.push(ql(`2026-04-${d}T00:00:00Z`, 'mid', d * d * 100));
    queue.push(ql(`2026-04-${d}T00:00:00Z`, 'high', d * d * d * 10));
  }
  const r = buildDailyTokenPercentileGapRatio(queue, {
    generatedAt: GEN,
    sort: 'pgr',
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.pgr >= r.sources[1]!.pgr);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenPercentileGapRatio: source filter restricts rows', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 1000),
    ql('2026-04-26T00:00:00Z', 'a', 2000),
    ql('2026-04-27T00:00:00Z', 'a', 3000),
    ql('2026-04-28T00:00:00Z', 'a', 4000),
    ql('2026-04-25T00:00:00Z', 'b', 5000),
    ql('2026-04-26T00:00:00Z', 'b', 6000),
    ql('2026-04-27T00:00:00Z', 'b', 7000),
    ql('2026-04-28T00:00:00Z', 'b', 8000),
  ];
  const r = buildDailyTokenPercentileGapRatio(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 4);
});

test('buildDailyTokenPercentileGapRatio: invalid hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 1000),
    ql('2026-04-25T00:00:00Z', 'a', 1000),
    ql('2026-04-26T00:00:00Z', 'a', 2000),
    ql('2026-04-27T00:00:00Z', 'a', 3000),
    ql('2026-04-28T00:00:00Z', 'a', 4000),
  ];
  const r = buildDailyTokenPercentileGapRatio(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenPercentileGapRatio: rejects bad knobs', () => {
  assert.throws(() =>
    buildDailyTokenPercentileGapRatio([], { generatedAt: GEN, minDays: 1 }),
  );
  assert.throws(() =>
    buildDailyTokenPercentileGapRatio([], { generatedAt: GEN, minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenPercentileGapRatio([], { generatedAt: GEN, top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenPercentileGapRatio([], {
      generatedAt: GEN,
      minPgr: 0.5, // < 1
    }),
  );
  assert.throws(() =>
    buildDailyTokenPercentileGapRatio([], {
      generatedAt: GEN,
      sort: 'bogus' as never,
    }),
  );
  assert.throws(() =>
    buildDailyTokenPercentileGapRatio([], {
      generatedAt: GEN,
      since: 'not-iso',
    }),
  );
});

test('buildDailyTokenPercentileGapRatio: production-scale day totals stable', () => {
  // 1e9-scale day totals with a 10x spike. PGR should be in a sane
  // range and finite.
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 30; d++) {
    queue.push(
      ql(
        `2026-04-${String(d).padStart(2, '0')}T00:00:00Z`,
        'big',
        1e9 + d * 1e7,
      ),
    );
  }
  queue.push(ql('2026-05-01T00:00:00Z', 'big', 1e10));
  const r = buildDailyTokenPercentileGapRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  const row = r.sources[0]!;
  assert.ok(Number.isFinite(row.pgr), `pgr non-finite: ${row.pgr}`);
  assert.ok(row.pgr > 1);
  assert.ok(row.pgr < 100); // sanity
});

// ---- Refinement (post-release): additional structural edge cases ----

test('percentileGapRatioOfVector: degenerate when top half is constant (P50 == P90 without all-equal)', () => {
  // Construct a vector where the bottom half varies but the top half
  // (above the median) is flat. Then P50 == P90 -> pgr = 1, even
  // though the vector is NOT all-equal. This is a corner case unique
  // to quantile-ratio axes; no GE/Atkinson/Theil index would call this
  // distribution "equal" because the bottom half varies.
  // n=11. Sorted [1,2,3,4,5, 7,7,7,7,7,7]. P50 = sorted[5] = 7.
  // P90 = sorted[9] = 7. PGR = 1. Degenerate.
  const v = [1, 2, 3, 4, 5, 7, 7, 7, 7, 7, 7];
  const r = percentileGapRatioOfVector(v);
  assert.equal(r.p50, 7);
  assert.equal(r.p90, 7);
  assert.equal(r.pgr, 1);
  assert.equal(r.degenerate, true);
  // Sanity: GE(2) is positive on this vector even though pgr is
  // degenerate (the moment-based axis sees the bottom-half spread).
  const ge2 = ge2OfVector(v).ge2;
  assert.ok(ge2 > 0, `GE(2) sees bottom-half spread, got ${ge2}`);
});

test('percentileGapRatioOfVector: monotone-increasing in top-decile magnitude only when below P90 boundary moves', () => {
  // Test that PGR responds to changes inside the (P50, P90) window
  // but is invariant outside it. Use n=11 so P50 = sorted[5] and
  // P90 = sorted[9] exactly (no interpolation weight on sorted[10]).
  // Increasing sorted[7] from 8 to 80 raises P90 only via the exact
  // index-9 position -- but in our base vector sorted[9] is the only
  // value at q=0.9, so we need a careful construction.
  // Simpler witness: change sorted[9] (the P90 anchor) and watch PGR
  // strictly increase; change sorted[10] (above P90) and watch PGR
  // stay constant.
  const base = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const baseR = percentileGapRatioOfVector(base);
  // raise sorted[9] from 10 to 50 (still above sorted[8]=9)
  const raisedAtP90 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 50, 51];
  const raisedR = percentileGapRatioOfVector(raisedAtP90);
  assert.ok(
    raisedR.pgr > baseR.pgr,
    `PGR must rise when sorted[9] (the P90 anchor) rises: base=${baseR.pgr}, raised=${raisedR.pgr}`,
  );
  // raise only sorted[10] (above P90) from 11 to 1e9: PGR unchanged
  const raisedAboveP90 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1_000_000_000];
  const aboveR = percentileGapRatioOfVector(raisedAboveP90);
  assert.ok(
    Math.abs(aboveR.pgr - baseR.pgr) < 1e-12,
    `PGR must stay constant when only sorted[10] (above P90) rises: base=${baseR.pgr}, above=${aboveR.pgr}`,
  );
});

test('percentileGapRatioOfVector: PGR never reports a value below 1 even on near-uniform fp data', () => {
  // Defensive check: with values that differ only by fp noise, PGR
  // should be clamped to 1 and degenerate, not 0.999... (which
  // would violate the documented range [1, +inf)).
  const v: number[] = [];
  for (let i = 0; i < 100; i++) v.push(1 + i * 1e-15);
  const r = percentileGapRatioOfVector(v);
  assert.ok(r.pgr >= 1, `pgr must be >= 1, got ${r.pgr}`);
});
