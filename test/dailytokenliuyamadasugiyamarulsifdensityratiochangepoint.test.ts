import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint,
  rulsifScan,
  rulsifScoreSymmetric,
  rulsifPeStarOneSided,
  rulsifVerdict,
  median,
  medianPairwiseDist,
  equalSpacedQuantiles,
  choleskyDecompose,
  forwardSubstitute,
  backSubstituteTranspose,
  spdSolve,
} from '../src/dailytokenliuyamadasugiyamarulsifdensityratiochangepoint.js';
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

function synth(source: string, vals: number[], startDay = '2026-01-01'): QueueLine[] {
  return vals.map((v, i) => {
    const ms = Date.parse(`${startDay}T00:00:00.000Z`) + i * 86_400_000;
    const ts = new Date(ms).toISOString();
    return ql(ts, source, Math.max(1, Math.round(v)));
  });
}

// Seedable LCG for reproducible RNG.
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ---- helpers --------------------------------------------------------------

test('median: even and odd length', () => {
  assert.equal(median([1, 2, 3, 4, 5]), 3);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test('median: empty -> NaN', () => {
  assert.ok(Number.isNaN(median([])));
});

test('medianPairwiseDist: trivial', () => {
  // pairs: |1-2|=1, |1-3|=2, |2-3|=1 -> sorted [1,1,2] -> median 1
  assert.equal(medianPairwiseDist([1, 2, 3]), 1);
});

test('medianPairwiseDist: NaN for n<2', () => {
  assert.ok(Number.isNaN(medianPairwiseDist([])));
  assert.ok(Number.isNaN(medianPairwiseDist([5])));
});

test('equalSpacedQuantiles: B=4 on [0..9]', () => {
  // p in {0.125, 0.375, 0.625, 0.875}, idx = p*9 = {1.125,3.375,5.625,7.875}
  const q = equalSpacedQuantiles([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4);
  assert.equal(q.length, 4);
  assert.ok(Math.abs(q[0]! - 1.125) < 1e-9);
  assert.ok(Math.abs(q[3]! - 7.875) < 1e-9);
});

test('equalSpacedQuantiles: throws on bad B', () => {
  assert.throws(() => equalSpacedQuantiles([1, 2, 3], 0));
  assert.throws(() => equalSpacedQuantiles([1, 2, 3], 1.5));
});

test('equalSpacedQuantiles: throws on empty', () => {
  assert.throws(() => equalSpacedQuantiles([], 3));
});

// ---- linear solve ---------------------------------------------------------

test('cholesky: 2x2 SPD identity', () => {
  const L = choleskyDecompose([1, 0, 0, 1], 2);
  assert.deepEqual(L, [1, 0, 0, 1]);
});

test('cholesky: non-SPD throws', () => {
  // [[1,2],[2,1]] is symmetric but not PD (det = -3)
  assert.throws(() => choleskyDecompose([1, 2, 2, 1], 2));
});

test('cholesky: dimension mismatch throws', () => {
  assert.throws(() => choleskyDecompose([1, 0, 0], 2));
});

test('spdSolve: identity returns b', () => {
  const x = spdSolve([1, 0, 0, 0, 1, 0, 0, 0, 1], [3, 5, 7], 3);
  assert.deepEqual(x, [3, 5, 7]);
});

test('spdSolve: 2x2 round-trip', () => {
  // A = [[4,2],[2,3]]; b = [6,5]. Solve A x = b.
  // det = 8; A^{-1} = (1/8) [[3,-2],[-2,4]]; x = A^{-1} b = (1/8)[8, 8] = [1, 1].
  const x = spdSolve([4, 2, 2, 3], [6, 5], 2);
  assert.ok(Math.abs(x[0]! - 1) < 1e-9);
  assert.ok(Math.abs(x[1]! - 1) < 1e-9);
});

test('forwardSubstitute: identity', () => {
  assert.deepEqual(forwardSubstitute([1, 0, 0, 1], [3, 4], 2), [3, 4]);
});

test('backSubstituteTranspose: identity', () => {
  assert.deepEqual(backSubstituteTranspose([1, 0, 0, 1], [3, 4], 2), [3, 4]);
});

// ---- rulsifPeStarOneSided / rulsifScoreSymmetric --------------------------

test('rulsifPeStarOneSided: window mismatch throws', () => {
  assert.throws(() => rulsifPeStarOneSided([1, 2, 3, 4], [1, 2, 3]));
});

test('rulsifPeStarOneSided: w < 4 throws', () => {
  assert.throws(() => rulsifPeStarOneSided([1, 2, 3], [1, 2, 3]));
});

test('rulsifPeStarOneSided: bad alpha throws', () => {
  const a = [1, 2, 3, 4, 5];
  const b = [6, 7, 8, 9, 10];
  assert.throws(() => rulsifPeStarOneSided(a, b, { alpha: -0.1 }));
  assert.throws(() => rulsifPeStarOneSided(a, b, { alpha: 1 }));
  assert.throws(() => rulsifPeStarOneSided(a, b, { alpha: 1.5 }));
});

test('rulsifPeStarOneSided: bad basisCount throws', () => {
  const a = [1, 2, 3, 4, 5];
  const b = [6, 7, 8, 9, 10];
  assert.throws(() => rulsifPeStarOneSided(a, b, { basisCount: 1 }));
  assert.throws(() => rulsifPeStarOneSided(a, b, { basisCount: 1.5 }));
});

test('rulsifPeStarOneSided: bad lambdaRidge throws', () => {
  const a = [1, 2, 3, 4, 5];
  const b = [6, 7, 8, 9, 10];
  assert.throws(() => rulsifPeStarOneSided(a, b, { lambdaRidge: 0 }));
  assert.throws(() => rulsifPeStarOneSided(a, b, { lambdaRidge: -1 }));
});

test('rulsifPeStarOneSided: identical samples -> ~0 divergence', () => {
  const r = rng(42);
  const a = Array.from({ length: 30 }, () => r() * 10);
  const b = Array.from({ length: 30 }, () => r() * 10);
  // Both are uniform [0,10] from independent rng draws — same distribution, divergence ~ 0
  const pe = rulsifPeStarOneSided(a, b);
  // Should be small (close to 0); allow some sampling slack.
  assert.ok(Math.abs(pe) < 0.3, `expected |pe| < 0.3, got ${pe}`);
});

test('rulsifPeStarOneSided: shifted samples -> positive divergence', () => {
  const r = rng(7);
  const a = Array.from({ length: 30 }, () => r() * 5);     // uniform [0,5]
  const b = Array.from({ length: 30 }, () => r() * 5 + 50); // uniform [50,55]
  const pe = rulsifPeStarOneSided(a, b);
  assert.ok(pe > 0.01, `expected pe > 0.01 for big shift, got ${pe}`);
});

test('rulsifScoreSymmetric: nonneg and symmetric across direction', () => {
  const r = rng(99);
  const a = Array.from({ length: 30 }, () => r() * 5);
  const b = Array.from({ length: 30 }, () => r() * 5 + 30);
  const sAB = rulsifScoreSymmetric(a, b);
  const sBA = rulsifScoreSymmetric(b, a);
  // Symmetric statistic should match either direction (within numerical noise)
  assert.ok(Math.abs(sAB - sBA) < 1e-9);
});

// ---- rulsifScan core ------------------------------------------------------

test('rulsifScan: throws on N<16', () => {
  assert.throws(() => rulsifScan([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]));
});

test('rulsifScan: throws on bad windowFrac', () => {
  const x = new Array(40).fill(1).map((_, i) => i);
  assert.throws(() => rulsifScan(x, { windowFrac: -0.1 }));
  assert.throws(() => rulsifScan(x, { windowFrac: 0.5 }));
  assert.throws(() => rulsifScan(x, { windowFrac: 0.7 }));
});

test('rulsifScan: throws on bad thresholdScale', () => {
  const x = new Array(40).fill(1).map((_, i) => i);
  assert.throws(() => rulsifScan(x, { thresholdScale: 0 }));
  assert.throws(() => rulsifScan(x, { thresholdScale: -3 }));
});

test('rulsifScan: shape - scores length matches N - 2w + 1', () => {
  const r = rng(11);
  const x = Array.from({ length: 60 }, () => r() * 100);
  const res = rulsifScan(x, { windowFrac: 0.2 });
  // w = max(8, floor(0.2*60)) = 12; M = 60 - 2*12 + 1 = 37
  assert.equal(res.windowW, 12);
  assert.equal(res.scores.length, 37);
});

test('rulsifScan: argmax in [w, N-w] range', () => {
  const r = rng(13);
  const x = Array.from({ length: 80 }, () => r() * 50);
  const res = rulsifScan(x, { windowFrac: 0.2 });
  assert.ok(res.peStarArgmax >= res.windowW);
  assert.ok(res.peStarArgmax <= 80 - res.windowW);
});

test('rulsifScan: clear step-change is detected', () => {
  // first 40 days near 100, last 40 days near 1000 -> CP near t=40
  const r = rng(31);
  const x = [
    ...Array.from({ length: 40 }, () => 100 + r() * 10),
    ...Array.from({ length: 40 }, () => 1000 + r() * 50),
  ];
  const res = rulsifScan(x, { windowFrac: 0.2 });
  // peakRatio should be large; argmax should be near 40
  assert.ok(res.peakRatio > 3, `expected strong peakRatio, got ${res.peakRatio}`);
  assert.ok(Math.abs(res.peStarArgmax - 40) <= 12, `argmax=${res.peStarArgmax} not near 40`);
});

test('rulsifScan: pure noise -> low peakRatio', () => {
  const r = rng(53);
  const x = Array.from({ length: 80 }, () => 100 + r() * 10);
  const res = rulsifScan(x, { windowFrac: 0.2 });
  assert.ok(res.peakRatio < 5, `expected modest peakRatio for noise, got ${res.peakRatio}`);
});

test('rulsifScan: respects windowFrac floor', () => {
  // For very small N, w = max(8, floor(0.05*20)) = max(8, 1) = 8
  const r = rng(67);
  const x = Array.from({ length: 20 }, () => r() * 10);
  const res = rulsifScan(x, { windowFrac: 0.05 });
  assert.equal(res.windowW, 8);
});

test('rulsifScan: scores are non-negative (clamped)', () => {
  const r = rng(83);
  const x = Array.from({ length: 50 }, () => r() * 100);
  const res = rulsifScan(x, { windowFrac: 0.2 });
  for (const s of res.scores) assert.ok(s >= 0, `score should be >= 0, got ${s}`);
});

// ---- rulsifVerdict --------------------------------------------------------

test('rulsifVerdict: ladder', () => {
  assert.equal(rulsifVerdict(0.5), 'no-shift');
  assert.equal(rulsifVerdict(1.4), 'no-shift');
  assert.equal(rulsifVerdict(2.0), 'borderline');
  assert.equal(rulsifVerdict(2.99), 'borderline');
  assert.equal(rulsifVerdict(3.0), 'shift');
  assert.equal(rulsifVerdict(5.99), 'shift');
  assert.equal(rulsifVerdict(6.0), 'strong-shift');
  assert.equal(rulsifVerdict(100), 'strong-shift');
});

test('rulsifVerdict: NaN -> no-shift, Inf -> strong-shift', () => {
  assert.equal(rulsifVerdict(Number.NaN), 'no-shift');
  assert.equal(rulsifVerdict(Infinity), 'strong-shift');
});

// ---- builder validation ---------------------------------------------------

test('builder: bad minTokens throws', () => {
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { minTokens: Number.NaN }),
  );
});

test('builder: minTenureDays floor 21', () => {
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { minTenureDays: 20 }),
  );
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { minTenureDays: 21.5 }),
  );
});

test('builder: bad top throws', () => {
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { top: 1.5 }),
  );
});

test('builder: bad sort throws', () => {
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { sort: 'bogus' as never }),
  );
});

test('builder: bad windowFrac throws', () => {
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { windowFrac: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { windowFrac: 0.5 }),
  );
});

test('builder: bad alpha throws', () => {
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { alpha: -0.1 }),
  );
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { alpha: 1 }),
  );
});

test('builder: bad basisCount throws', () => {
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { basisCount: 1 }),
  );
});

test('builder: bad lambdaRidge throws', () => {
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { lambdaRidge: 0 }),
  );
});

test('builder: bad thresholdScale throws', () => {
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { thresholdScale: 0 }),
  );
});

test('builder: empty queue -> empty report', () => {
  const r = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('builder: drops below min-tenure', () => {
  // Need totalTokens >= 1000 so we don't drop on min-tokens first.
  const q = synth('s1', [400, 400, 400]);
  const r = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('builder: drops zero-variance flat series', () => {
  const flat = new Array(40).fill(500);
  const q = synth('flat', flat);
  const r = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('builder: drops below min-tokens', () => {
  // All values 1, total well below 1000.
  const q = synth('tiny', new Array(30).fill(1));
  const r = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedSparseSources, 1);
});

test('builder: drops invalid hour_start', () => {
  const q: QueueLine[] = [ql('not-a-date', 's', 1000)];
  const r = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('builder: drops non-positive tokens', () => {
  const q: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 's', 0),
    ql('2026-01-02T00:00:00.000Z', 's', -5),
  ];
  const r = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('builder: source filter drops other sources', () => {
  const a = synth('a', [100, 200, 300]);
  const b = synth('b', [400, 500, 600]);
  const r = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([...a, ...b], {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.droppedSourceFilter, 3);
  assert.equal(r.source, 'a');
});

test('builder: detects step change end-to-end', () => {
  // 50-day series with step change at day 25.
  const r = rng(101);
  const vals = [
    ...Array.from({ length: 25 }, () => 100 + r() * 5),
    ...Array.from({ length: 25 }, () => 1000 + r() * 50),
  ];
  const q = synth('step', vals);
  const rep = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint(q, {
    minTenureDays: 21,
    generatedAt: GEN,
  });
  assert.equal(rep.sources.length, 1);
  const row = rep.sources[0]!;
  assert.ok(row.peakRatio > 3, `expected peakRatio>3 on step series, got ${row.peakRatio}`);
  assert.notEqual(row.verdict, 'no-shift');
});

test('builder: top cap surfaces dropped count', () => {
  const r = rng(202);
  const queues: QueueLine[] = [];
  for (let i = 0; i < 4; i += 1) {
    const vals = [
      ...Array.from({ length: 20 }, () => 100 + r() * 5),
      ...Array.from({ length: 20 }, () => 1000 + r() * 50),
    ];
    queues.push(...synth(`s${i}`, vals));
  }
  const rep = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint(queues, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(rep.sources.length, 2);
  assert.equal(rep.droppedTopSources, 2);
});

test('builder: onlyShifts filter', () => {
  // Mix one quiet flat-noise source with one big-step source.
  const r = rng(303);
  const quiet = synth('quiet', Array.from({ length: 40 }, () => 100 + r() * 2));
  const step = synth(
    'step',
    [
      ...Array.from({ length: 20 }, () => 100 + r() * 5),
      ...Array.from({ length: 20 }, () => 5000 + r() * 100),
    ],
    '2026-02-01',
  );
  const rep = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([...quiet, ...step], {
    onlyShifts: true,
    generatedAt: GEN,
  });
  for (const row of rep.sources) {
    assert.notEqual(row.verdict, 'no-shift');
  }
});

test('builder: deterministic given seed (cross-call invariance)', () => {
  const r1 = rng(404);
  const vals1 = Array.from({ length: 60 }, (_, i) => (i < 30 ? 100 + r1() * 5 : 800 + r1() * 30));
  const r2 = rng(404);
  const vals2 = Array.from({ length: 60 }, (_, i) => (i < 30 ? 100 + r2() * 5 : 800 + r2() * 30));
  const a = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint(synth('a', vals1), {
    generatedAt: GEN,
  });
  const b = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint(synth('a', vals2), {
    generatedAt: GEN,
  });
  assert.equal(a.sources[0]!.peStarMax, b.sources[0]!.peStarMax);
  assert.equal(a.sources[0]!.peakRatio, b.sources[0]!.peakRatio);
});

test('builder: tauStarDays are valid YYYY-MM-DD strings', () => {
  const r = rng(505);
  const vals = [
    ...Array.from({ length: 25 }, () => 100 + r() * 5),
    ...Array.from({ length: 25 }, () => 2000 + r() * 50),
  ];
  const q = synth('s', vals, '2026-03-15');
  const rep = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint(q, {
    generatedAt: GEN,
  });
  const row = rep.sources[0]!;
  for (const day of row.tauStarDays) {
    assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.match(row.peStarArgmaxDay, /^\d{4}-\d{2}-\d{2}$/);
});

test('builder: sort by peStarMaxDesc orders rows correctly', () => {
  const r = rng(606);
  const queues: QueueLine[] = [];
  for (let i = 0; i < 3; i += 1) {
    const amp = (i + 1) * 1000;
    const vals = [
      ...Array.from({ length: 22 }, () => 100 + r() * 5),
      ...Array.from({ length: 22 }, () => amp + r() * 50),
    ];
    queues.push(...synth(`src${i}`, vals));
  }
  const rep = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint(queues, {
    sort: 'peStarMaxDesc',
    generatedAt: GEN,
  });
  for (let i = 1; i < rep.sources.length; i += 1) {
    assert.ok(rep.sources[i - 1]!.peStarMax >= rep.sources[i]!.peStarMax);
  }
});

test('builder: window/since filters apply', () => {
  const r = rng(707);
  const vals = Array.from({ length: 60 }, () => 100 + r() * 50);
  const q = synth('s', vals, '2026-01-01');
  const rep = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint(q, {
    since: '2026-02-01T00:00:00.000Z',
    until: '2026-03-01T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(rep.windowStart, '2026-02-01T00:00:00.000Z');
  assert.equal(rep.windowEnd, '2026-03-01T00:00:00.000Z');
});

test('builder: invalid since/until throws', () => {
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { since: 'not-iso' }),
  );
  assert.throws(() =>
    buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint([], { until: 'not-iso' }),
  );
});

// ---- refinement: additional invariants -----------------------------------

test('rulsifScan: peStarMax >= peStarMedian (invariant)', () => {
  const r = rng(909);
  const x = [
    ...Array.from({ length: 30 }, () => 100 + r() * 5),
    ...Array.from({ length: 30 }, () => 800 + r() * 30),
  ];
  const res = rulsifScan(x);
  assert.ok(res.peStarMax >= res.peStarMedian);
});

test('rulsifScan: changepoints respect w-spacing rule', () => {
  const r = rng(1010);
  // Three clear plateaus -> two CPs at least w apart.
  const x = [
    ...Array.from({ length: 30 }, () => 100 + r() * 5),
    ...Array.from({ length: 30 }, () => 800 + r() * 30),
    ...Array.from({ length: 30 }, () => 50 + r() * 3),
  ];
  const res = rulsifScan(x, { windowFrac: 0.18 });
  for (let i = 1; i < res.changepoints.length; i += 1) {
    const gap = res.changepoints[i]! - res.changepoints[i - 1]!;
    assert.ok(gap >= res.windowW, `CP gap ${gap} < w=${res.windowW}`);
  }
});

test('rulsifScan: thresholdUsed scales linearly with thresholdScale', () => {
  const r = rng(1111);
  const x = Array.from({ length: 60 }, () => 100 + r() * 50);
  const a = rulsifScan(x, { thresholdScale: 2.0 });
  const b = rulsifScan(x, { thresholdScale: 4.0 });
  // peStarMedian is identical for the same data; threshold should double.
  assert.ok(Math.abs(b.thresholdUsed / a.thresholdUsed - 2.0) < 1e-9);
});

test('builder: changepoints are within first..last day window', () => {
  const r = rng(1212);
  const vals = [
    ...Array.from({ length: 25 }, () => 100 + r() * 5),
    ...Array.from({ length: 25 }, () => 2000 + r() * 50),
  ];
  const q = synth('s', vals, '2026-03-01');
  const rep = buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint(q, {
    generatedAt: GEN,
  });
  const row = rep.sources[0]!;
  for (const day of row.tauStarDays) {
    assert.ok(day >= row.firstActiveDay, `${day} < ${row.firstActiveDay}`);
    assert.ok(day <= row.lastActiveDay, `${day} > ${row.lastActiveDay}`);
  }
});

test('rulsifScoreSymmetric: score for identical samples is small', () => {
  const r = rng(1313);
  // Same generator -> approximately same distribution.
  const a = Array.from({ length: 30 }, () => r() * 10 + 100);
  const b = Array.from({ length: 30 }, () => r() * 10 + 100);
  const s = rulsifScoreSymmetric(a, b);
  assert.ok(s < 0.5, `symmetric score for similar samples should be small, got ${s}`);
});
