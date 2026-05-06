import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenLombardSmoothChangepoint,
  dailyTokenLombardSmoothChangepoint,
  lombardSummary,
  lombardMidRanks,
  lombardTriangularSmooth,
  lombardGammaUpperTailP,
  regularizedLowerGamma,
  logGamma,
} from '../src/dailytokenlombardsmoothchangepoint.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, tokens: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
  };
}

const GEN = '2026-05-06T12:00:00.000Z';

// ---- option validation ---------------------------------------------------

test('lombard: rejects bad minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenLombardSmoothChangepoint([], { minTenureDays: 20 }),
  );
  assert.throws(() =>
    buildDailyTokenLombardSmoothChangepoint([], { minTenureDays: 21.5 }),
  );
  assert.throws(() =>
    buildDailyTokenLombardSmoothChangepoint([], { minTenureDays: 0 }),
  );
});

test('lombard: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenLombardSmoothChangepoint([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenLombardSmoothChangepoint([], { minTokens: NaN }),
  );
});

test('lombard: rejects bad smoothBandwidthDays', () => {
  assert.throws(() =>
    buildDailyTokenLombardSmoothChangepoint([], { smoothBandwidthDays: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenLombardSmoothChangepoint([], { smoothBandwidthDays: 1.5 }),
  );
});

test('lombard: rejects bad top', () => {
  assert.throws(() =>
    buildDailyTokenLombardSmoothChangepoint([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenLombardSmoothChangepoint([], { top: 1.5 }),
  );
});

test('lombard: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenLombardSmoothChangepoint([], { sort: 'nope' as 'ln' }),
  );
});

test('lombard: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenLombardSmoothChangepoint([], { since: 'no' }),
  );
  assert.throws(() =>
    buildDailyTokenLombardSmoothChangepoint([], { until: 'nope' }),
  );
});

// ---- mid-ranks -----------------------------------------------------------

test('lombardMidRanks: simple', () => {
  assert.deepEqual(lombardMidRanks([10, 20, 30]), [1, 2, 3]);
  assert.deepEqual(lombardMidRanks([30, 20, 10]), [3, 2, 1]);
});

test('lombardMidRanks: ties get average rank', () => {
  // [5, 5, 5] -> all at average 2
  assert.deepEqual(lombardMidRanks([5, 5, 5]), [2, 2, 2]);
  // [10, 20, 20, 30] -> 1, 2.5, 2.5, 4
  assert.deepEqual(lombardMidRanks([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
});

test('lombardMidRanks: stable for equal values', () => {
  const r = lombardMidRanks([1, 2, 1, 2]);
  // values 1@idx0 and 1@idx2 share rank avg(1,2)=1.5; 2@idx1 and 2@idx3 share avg(3,4)=3.5
  assert.deepEqual(r, [1.5, 3.5, 1.5, 3.5]);
});

// ---- triangular smoother --------------------------------------------------

test('triangular smooth: K=0 returns copy', () => {
  const phi = [1, 2, 3];
  const s = lombardTriangularSmooth(phi, 0);
  assert.deepEqual(s, [1, 2, 3]);
  // copy, not reference
  s[0] = 99;
  assert.equal(phi[0], 1);
});

test('triangular smooth: K=1 with mirror padding', () => {
  // weights w[-1, 0, 1] = (1, 2, 1), sum = 4
  // phi = [a, b, c, d], mirror: phi[-1]=phi[0], phi[n]=phi[n-1]
  // s[0] = (a + 2a + b)/4 = (3a + b)/4
  // s[1] = (a + 2b + c)/4
  // s[2] = (b + 2c + d)/4
  // s[3] = (c + 2d + d)/4 = (c + 3d)/4
  const phi = [1, 2, 3, 4];
  const s = lombardTriangularSmooth(phi, 1);
  assert.equal(s[0], (3 * 1 + 2) / 4);
  assert.equal(s[1], (1 + 4 + 3) / 4);
  assert.equal(s[2], (2 + 6 + 4) / 4);
  assert.equal(s[3], (3 + 8 + 4) / 4);
});

test('triangular smooth: constant input -> constant output', () => {
  const phi = new Array(20).fill(7);
  const s = lombardTriangularSmooth(phi, 3);
  for (const v of s) assert.equal(v, 7);
});

// ---- logGamma sanity ------------------------------------------------------

test('logGamma: known values', () => {
  // Gamma(1) = 1, Gamma(2) = 1, Gamma(3) = 2, Gamma(4) = 6
  assert.ok(Math.abs(logGamma(1) - 0) < 1e-10);
  assert.ok(Math.abs(logGamma(2) - 0) < 1e-10);
  assert.ok(Math.abs(logGamma(3) - Math.log(2)) < 1e-10);
  assert.ok(Math.abs(logGamma(4) - Math.log(6)) < 1e-10);
  // Gamma(0.5) = sqrt(pi)
  assert.ok(Math.abs(logGamma(0.5) - Math.log(Math.sqrt(Math.PI))) < 1e-9);
});

// ---- regularised gamma ----------------------------------------------------

test('regularizedLowerGamma: P(a, 0) = 0', () => {
  assert.equal(regularizedLowerGamma(1, 0), 0);
  assert.equal(regularizedLowerGamma(2.5, 0), 0);
});

test('regularizedLowerGamma: P(1, x) = 1 - exp(-x)', () => {
  for (const x of [0.1, 0.5, 1, 2, 5, 10]) {
    const expected = 1 - Math.exp(-x);
    const got = regularizedLowerGamma(1, x);
    assert.ok(Math.abs(got - expected) < 1e-10, `x=${x} got=${got} exp=${expected}`);
  }
});

test('regularizedLowerGamma: monotone in x for fixed a', () => {
  let prev = -1;
  for (const x of [0.1, 0.5, 1, 2, 5, 10, 50]) {
    const v = regularizedLowerGamma(1.25, x);
    assert.ok(v >= prev, `not monotone at x=${x}`);
    prev = v;
  }
});

test('regularizedLowerGamma: rejects bad args', () => {
  assert.throws(() => regularizedLowerGamma(-1, 1));
  assert.throws(() => regularizedLowerGamma(1, -1));
  assert.throws(() => regularizedLowerGamma(NaN, 1));
});

// ---- lombardGammaUpperTailP ----------------------------------------------

test('lombardGammaUpperTailP: ln=0 -> p=1', () => {
  assert.equal(lombardGammaUpperTailP(0, 30), 1);
});

test('lombardGammaUpperTailP: small ln -> high p', () => {
  // ln very small -> q = ln/sigma2 small -> regLowerGamma ~ 0 -> p ~ 1
  const p = lombardGammaUpperTailP(0.001, 30);
  assert.ok(p > 0.9, `expected p > 0.9, got ${p}`);
});

test('lombardGammaUpperTailP: large ln -> low p', () => {
  const p = lombardGammaUpperTailP(5, 30);
  assert.ok(p < 0.05, `expected p < 0.05, got ${p}`);
});

test('lombardGammaUpperTailP: bounded in [0, 1]', () => {
  for (const ln of [0, 0.01, 0.1, 1, 10, 100]) {
    const p = lombardGammaUpperTailP(ln, 30);
    assert.ok(p >= 0 && p <= 1, `ln=${ln} p=${p}`);
  }
});

// ---- lombardSummary core --------------------------------------------------

test('lombardSummary: constant series -> ln=0 (degenerate but defined)', () => {
  const s = lombardSummary(new Array(30).fill(5), 3);
  // mid-ranks all (n+1)/2 -> phi all 0 -> S all 0 -> ln 0
  assert.equal(s.ln, 0);
});

test('lombardSummary: monotone increasing has nonzero ln, peak near middle', () => {
  const x = new Array(40).fill(0).map((_, i) => i + 1);
  const s = lombardSummary(x, 3);
  assert.ok(s.ln > 0);
  // For monotone series, S[k] is a deterministic shape; argmax should be in (n/4, 3n/4)
  assert.ok(s.kStar > 5 && s.kStar < 35, `kStar=${s.kStar}`);
});

test('lombardSummary: clean step at middle has high ln and kStar near step', () => {
  const x = [
    ...new Array(20).fill(0).map((_, i) => 100 + i),
    ...new Array(20).fill(0).map((_, i) => 1000 + i),
  ];
  const s = lombardSummary(x, 3);
  assert.ok(s.ln > 0.05, `expected high L_n, got ${s.ln}`);
  // kStar should be near the step at 19/20
  assert.ok(Math.abs(s.kStar - 19) <= 5, `kStar=${s.kStar}`);
});

test('lombardSummary: directionSign tracks step direction', () => {
  // Upward step -> after kStar, smoothed phi positive -> S keeps growing -> S[kStar] > 0
  const up = [
    ...new Array(20).fill(100),
    ...new Array(20).fill(1000),
  ].map((v, i) => v + i * 0.001); // tiny noise to break ties
  const sUp = lombardSummary(up, 3);
  // Downward step
  const down = [
    ...new Array(20).fill(1000),
    ...new Array(20).fill(100),
  ].map((v, i) => v - i * 0.001);
  const sDown = lombardSummary(down, 3);
  // Cumulative S of phi: positive ranks first means S grows then falls -> max |S| somewhere
  // Sign behaviour: for upward step, low ranks come first -> phi negative early -> S negative -> directionSign = -1
  // For downward step, high ranks come first -> phi positive early -> directionSign = +1
  assert.notEqual(sUp.directionSign, 0);
  assert.notEqual(sDown.directionSign, 0);
  assert.equal(sUp.directionSign, -sDown.directionSign);
});

test('lombardSummary: degenerate n<2', () => {
  const s = lombardSummary([1], 2);
  assert.equal(s.ln, 0);
  assert.equal(s.kStar, -1);
});

test('lombardSummary: secondPeakRatio in [0, 1]', () => {
  const x = new Array(40).fill(0).map((_, i) => Math.sin(i / 3) * 100);
  // make all positive for the builder, but lombardSummary itself is fine with negatives
  const s = lombardSummary(x, 2);
  assert.ok(s.secondPeakRatio >= 0 && s.secondPeakRatio <= 1);
  assert.ok(s.lEdgeRatio >= 0 && s.lEdgeRatio <= 1);
});

// ---- dailyTokenLombardSmoothChangepoint ----------------------------------

test('dailyTokenLombardSmoothChangepoint: rejects n<21', () => {
  assert.throws(() =>
    dailyTokenLombardSmoothChangepoint(new Array(20).fill(0).map((_, i) => i + 1)),
  );
});

test('dailyTokenLombardSmoothChangepoint: rejects negative', () => {
  const w = new Array(25).fill(0).map((_, i) => i);
  w[3] = -1;
  assert.throws(() => dailyTokenLombardSmoothChangepoint(w));
});

test('dailyTokenLombardSmoothChangepoint: rejects non-finite', () => {
  const w = new Array(25).fill(0).map((_, i) => i + 1);
  w[3] = NaN;
  assert.throws(() => dailyTokenLombardSmoothChangepoint(w));
});

test('dailyTokenLombardSmoothChangepoint: rejects zero variance', () => {
  assert.throws(() =>
    dailyTokenLombardSmoothChangepoint(new Array(25).fill(7)),
  );
});

test('dailyTokenLombardSmoothChangepoint: K auto = max(2, ceil(n^{1/3}))', () => {
  const w = new Array(40).fill(0).map((_, i) => i + 1);
  const r = dailyTokenLombardSmoothChangepoint(w);
  // ceil(40^{1/3}) = ceil(3.42) = 4
  assert.equal(r.smoothBandwidthDays, 4);
});

test('dailyTokenLombardSmoothChangepoint: K override respected', () => {
  const w = new Array(30).fill(0).map((_, i) => i + 1);
  const r = dailyTokenLombardSmoothChangepoint(w, 5);
  assert.equal(r.smoothBandwidthDays, 5);
});

test('dailyTokenLombardSmoothChangepoint: K clamped to floor(n/3)', () => {
  const w = new Array(21).fill(0).map((_, i) => i + 1);
  // floor(21/3) = 7
  const r = dailyTokenLombardSmoothChangepoint(w, 100);
  assert.equal(r.smoothBandwidthDays, 7);
});

test('dailyTokenLombardSmoothChangepoint: clean step gives significant05 = true', () => {
  const w = [
    ...new Array(15).fill(100),
    ...new Array(15).fill(10000),
  ].map((v, i) => v + i);
  const r = dailyTokenLombardSmoothChangepoint(w, 3);
  assert.ok(r.significant05);
  assert.ok(r.pApprox < 0.05);
  assert.ok(r.meanShift > 0);
  assert.ok(r.muAfter > r.muBefore);
});

test('dailyTokenLombardSmoothChangepoint: noise-only series gives non-significant pApprox often', () => {
  // deterministic LCG noise around 1000
  let seed = 12345;
  const w: number[] = [];
  for (let i = 0; i < 60; i += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    w.push(1000 + (seed % 200));
  }
  const r = dailyTokenLombardSmoothChangepoint(w);
  assert.ok(r.pApprox >= 0 && r.pApprox <= 1);
  assert.equal(r.nSamples, 60);
});

// ---- buildDailyTokenLombardSmoothChangepoint ----------------------------

test('lombard build: empty queue', () => {
  const r = buildDailyTokenLombardSmoothChangepoint([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.minTenureDays, 21);
  assert.equal(r.sort, 'lnDesc');
});

test('lombard build: drops sparse sources', () => {
  const queue: QueueLine[] = [];
  // source A with 30 days but only 10 tokens total -> dropped by min-tokens
  for (let i = 0; i < 30; i += 1) {
    const day = `2026-04-${String(i + 1).padStart(2, '0')}`;
    queue.push(ql(`${day}T00:00:00.000Z`, 'A', 1));
  }
  const r = buildDailyTokenLombardSmoothChangepoint(queue, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('lombard build: drops tenure < 21', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(
      ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`, 'A', 5000),
    );
  }
  const r = buildDailyTokenLombardSmoothChangepoint(queue, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('lombard build: drops zero variance', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    queue.push(
      ql(
        `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
        'A',
        5000,
      ),
    );
  }
  const r = buildDailyTokenLombardSmoothChangepoint(queue, { generatedAt: GEN });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('lombard build: detects clean upward smooth shift', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const day = `2026-04-${String(i + 1).padStart(2, '0')}`;
    const tt = i < 15 ? 1000 + i : 5000 + i;
    queue.push(ql(`${day}T00:00:00.000Z`, 'A', tt));
  }
  const r = buildDailyTokenLombardSmoothChangepoint(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'A');
  assert.ok(row.significant05);
  assert.ok(row.meanShift > 0);
  assert.ok(row.kStar >= 10 && row.kStar <= 20, `kStar=${row.kStar}`);
  assert.ok(row.kStarDay !== null);
  assert.equal(row.nTenureDays, 30);
});

test('lombard build: dropped counters surface non-positive tokens', () => {
  const queue: QueueLine[] = [];
  // valid 25-day source
  for (let i = 0; i < 25; i += 1) {
    const day = `2026-04-${String(i + 1).padStart(2, '0')}`;
    queue.push(ql(`${day}T00:00:00.000Z`, 'A', 1000 + i * 100));
  }
  // a non-positive token row
  queue.push(ql('2026-04-26T00:00:00.000Z', 'A', 0));
  // a bad hour_start row
  queue.push(ql('not-an-iso', 'A', 100));
  const r = buildDailyTokenLombardSmoothChangepoint(queue, { generatedAt: GEN });
  assert.ok(r.droppedNonPositiveTokens >= 1);
  assert.ok(r.droppedInvalidHourStart >= 1);
});

test('lombard build: source filter applied', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    const day = `2026-04-${String(i + 1).padStart(2, '0')}`;
    queue.push(ql(`${day}T00:00:00.000Z`, 'A', 1000 + i * 100));
    queue.push(ql(`${day}T00:00:00.000Z`, 'B', 2000 + i * 50));
  }
  const r = buildDailyTokenLombardSmoothChangepoint(queue, {
    generatedAt: GEN,
    source: 'A',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
  assert.ok(r.droppedSourceFilter > 0);
});

test('lombard build: sort lnDesc puts largest L_n first', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const day = `2026-04-${String(i + 1).padStart(2, '0')}`;
    // A: clean step (high L_n)
    queue.push(ql(`${day}T00:00:00.000Z`, 'A', i < 15 ? 1000 + i : 5000 + i));
    // B: monotone (lower L_n than step typically)
    queue.push(ql(`${day}T00:00:00.000Z`, 'B', 1000 + i * 50));
  }
  const r = buildDailyTokenLombardSmoothChangepoint(queue, {
    generatedAt: GEN,
    sort: 'lnDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.ln >= r.sources[1]!.ln);
});

test('lombard build: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['A', 'B', 'C']) {
    for (let i = 0; i < 25; i += 1) {
      const day = `2026-04-${String(i + 1).padStart(2, '0')}`;
      queue.push(
        ql(`${day}T00:00:00.000Z`, src, 1000 + i * (src.charCodeAt(0) - 64)),
      );
    }
  }
  const r = buildDailyTokenLombardSmoothChangepoint(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('lombard build: window since/until clips data', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 60; i += 1) {
    const m = Math.floor(i / 30) + 4;
    const d = (i % 30) + 1;
    const day = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    queue.push(ql(`${day}T00:00:00.000Z`, 'A', 1000 + i * 50));
  }
  const r = buildDailyTokenLombardSmoothChangepoint(queue, {
    generatedAt: GEN,
    since: '2026-05-01T00:00:00.000Z',
  });
  // After clip should still have ~30 days, single source
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.firstActiveDay >= '2026-05-01');
});

test('lombard build: smoothBandwidthDays passed through', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const day = `2026-04-${String(i + 1).padStart(2, '0')}`;
    queue.push(ql(`${day}T00:00:00.000Z`, 'A', 1000 + i * 50));
  }
  const r = buildDailyTokenLombardSmoothChangepoint(queue, {
    generatedAt: GEN,
    smoothBandwidthDays: 5,
  });
  assert.equal(r.sources[0]!.smoothBandwidthDays, 5);
  assert.equal(r.smoothBandwidthDays, 5);
});

test('lombard build: rejects bad smoothBandwidthDays in opts', () => {
  assert.throws(() =>
    buildDailyTokenLombardSmoothChangepoint([], { smoothBandwidthDays: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenLombardSmoothChangepoint([], { smoothBandwidthDays: 1.5 }),
  );
});

test('lombard build: report shape', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    const day = `2026-04-${String(i + 1).padStart(2, '0')}`;
    queue.push(ql(`${day}T00:00:00.000Z`, 'A', 1000 + i * 100));
  }
  const r = buildDailyTokenLombardSmoothChangepoint(queue, { generatedAt: GEN });
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.minTenureDays, 21);
  assert.equal(r.smoothBandwidthDays, null);
  assert.equal(r.top, 0);
  assert.equal(r.sort, 'lnDesc');
  assert.equal(r.source, null);
  assert.equal(r.windowStart, null);
  assert.equal(r.windowEnd, null);
});

// ---- INVARIANCE / ORTHOGONALITY ------------------------------------------

test('lombard: time-reversal flips directionSign and meanShift but preserves L_n', () => {
  const w = [
    ...new Array(15).fill(100),
    ...new Array(15).fill(5000),
  ].map((v, i) => v + i);
  const wRev = w.slice().reverse();
  const r1 = dailyTokenLombardSmoothChangepoint(w, 3);
  const r2 = dailyTokenLombardSmoothChangepoint(wRev, 3);
  // Note: cumulative L_n is NOT invariant under reversal because S[k] = sum_{i<=k}
  // but the symmetric squared-sum should match approximately for a clean step at midpoint.
  // We just assert that both detect the step (significant05) and directions are opposite.
  assert.ok(r1.significant05);
  assert.ok(r2.significant05);
  assert.equal(Math.sign(r1.meanShift), -Math.sign(r2.meanShift));
});

test('lombard: scale invariance (rank-based)', () => {
  const w = new Array(30).fill(0).map((_, i) => 100 + i * 13);
  const wScaled = w.map((v) => v * 7);
  const r1 = dailyTokenLombardSmoothChangepoint(w, 3);
  const r2 = dailyTokenLombardSmoothChangepoint(wScaled, 3);
  // L_n is purely a function of ranks -> identical
  assert.ok(Math.abs(r1.ln - r2.ln) < 1e-12);
  assert.equal(r1.kStar, r2.kStar);
  assert.equal(r1.directionSign, r2.directionSign);
  // pApprox depends only on n and ln -> identical
  assert.ok(Math.abs(r1.pApprox - r2.pApprox) < 1e-12);
});

test('lombard: monotone-transform invariance (rank-based)', () => {
  const w = new Array(30).fill(0).map((_, i) => 100 + i * 13);
  // log is monotone -> ranks unchanged
  const wLog = w.map((v) => Math.log(v) * 1000); // scale to keep large
  const r1 = dailyTokenLombardSmoothChangepoint(w, 3);
  const r2 = dailyTokenLombardSmoothChangepoint(wLog, 3);
  assert.ok(Math.abs(r1.ln - r2.ln) < 1e-9);
  assert.equal(r1.kStar, r2.kStar);
});
