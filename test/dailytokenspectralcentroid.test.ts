import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralCentroidBin,
  dailyTokenSpectralCentroid,
  buildDailyTokenSpectralCentroid,
} from '../src/dailytokenspectralcentroid.js';
import type { QueueLine } from '../src/types.js';

const ISO = '2026-05-02T00:00:00.000Z';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    hour_start,
    source,
    total_tokens,
  } as unknown as QueueLine;
}

function dayIso(i: number): string {
  return (
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z'
  );
}

// ---------- spectralCentroidBin primitive ----------

test('spectralCentroidBin: empty input -> throws', () => {
  assert.throws(() => spectralCentroidBin([]), /empty power vector/);
});

test('spectralCentroidBin: non-finite power -> throws', () => {
  assert.throws(
    () => spectralCentroidBin([1, 2, NaN]),
    /non-finite power/,
  );
  assert.throws(
    () => spectralCentroidBin([1, 2, Infinity]),
    /non-finite power/,
  );
});

test('spectralCentroidBin: negative power -> throws', () => {
  assert.throws(
    () => spectralCentroidBin([1, 2, -0.5]),
    /negative power/,
  );
});

test('spectralCentroidBin: only one positive bin -> throws', () => {
  assert.throws(
    () => spectralCentroidBin([0, 0, 1, 0]),
    /too few positive-power bins/,
  );
});

test('spectralCentroidBin: zero positive bins -> throws', () => {
  assert.throws(
    () => spectralCentroidBin([0, 0, 0, 0]),
    /too few positive-power bins/,
  );
});

test('spectralCentroidBin: identical positive bins -> centroid = (K+1)/2', () => {
  // power = [1,1,1,1,1] at bins k=1..5; centroid = (1+2+3+4+5)/5 = 3.
  const r = spectralCentroidBin([1, 1, 1, 1, 1]);
  assert.ok(Math.abs(r.centroidBin - 3) < 1e-12);
  assert.equal(r.usableBins, 5);
});

test('spectralCentroidBin: closed-form on [1, 4]', () => {
  // bins (1,2) with power (1,4); centroid = (1*1 + 2*4)/(1+4) = 9/5.
  const r = spectralCentroidBin([1, 4]);
  assert.ok(Math.abs(r.centroidBin - 9 / 5) < 1e-12);
  assert.equal(r.usableBins, 2);
});

test('spectralCentroidBin: closed-form on [1, 2, 4, 8]', () => {
  // bins (1,2,3,4) with power (1,2,4,8); top heavy.
  // numerator = 1+4+12+32 = 49; total = 15; centroid = 49/15.
  const r = spectralCentroidBin([1, 2, 4, 8]);
  assert.ok(Math.abs(r.centroidBin - 49 / 15) < 1e-12);
  assert.equal(r.usableBins, 4);
});

test('spectralCentroidBin: bound -- centroid in [1, K]', () => {
  let s = 12345;
  const rand = () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return s / 0x1_0000_0000;
  };
  for (let trial = 0; trial < 50; trial += 1) {
    const k = 4 + Math.floor(rand() * 20);
    const p: number[] = [];
    for (let i = 0; i < k; i += 1) p.push(rand() * 1000 + 0.001);
    const r = spectralCentroidBin(p);
    assert.ok(
      r.centroidBin >= 1 - 1e-12 && r.centroidBin <= k + 1e-12,
      `centroid ${r.centroidBin} out of [1, ${k}]`,
    );
  }
});

test('spectralCentroidBin: zero bins skipped, count is positives only', () => {
  // Only bins 2,4,6 carry mass; centroid uses positive subset
  // weighted by their k indices: (2*1 + 4*1 + 6*1)/(3) = 4.
  const r = spectralCentroidBin([0, 1, 0, 1, 0, 1]);
  assert.ok(Math.abs(r.centroidBin - 4) < 1e-12);
  assert.equal(r.usableBins, 3);
});

test('spectralCentroidBin: bin permutation SENSITIVITY (orthogonality witness)', () => {
  // Same multiset of powers, different bin assignment => different centroid.
  const a = spectralCentroidBin([1, 4, 9, 16, 25]); // tilt up
  const b = spectralCentroidBin([25, 16, 9, 4, 1]); // tilt down
  assert.ok(
    Math.abs(a.centroidBin - b.centroidBin) > 1,
    `permutation invariance violation: ${a.centroidBin} vs ${b.centroidBin}`,
  );
});

test('spectralCentroidBin: pure-tone limit -> centroid pinned at the dominant bin', () => {
  // One dominant bin at index 1 with tiny noise floor on others.
  const k = 30;
  const p = new Array(k).fill(1e-9);
  p[0] = 1e6;
  const r = spectralCentroidBin(p);
  assert.ok(r.centroidBin < 1.001, `pure-tone centroid ${r.centroidBin}`);
});

test('spectralCentroidBin: scale-invariance of the ratio', () => {
  const p = [1, 4, 9, 16, 25];
  const a = spectralCentroidBin(p);
  const b = spectralCentroidBin(p.map((v) => 17.5 * v));
  assert.ok(Math.abs(a.centroidBin - b.centroidBin) < 1e-12);
});

// ---------- dailyTokenSpectralCentroid primitive ----------

test('dailyTokenSpectralCentroid: too short -> throws', () => {
  assert.throws(() => dailyTokenSpectralCentroid([1, 2, 3, 4, 5, 6, 7]));
});

test('dailyTokenSpectralCentroid: non-finite -> throws', () => {
  assert.throws(() =>
    dailyTokenSpectralCentroid([1, 2, 3, 4, 5, 6, 7, NaN, 9]),
  );
});

test('dailyTokenSpectralCentroid: constant series -> throws zero variance', () => {
  assert.throws(
    () => dailyTokenSpectralCentroid([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]),
    /zero variance/,
  );
});

test('dailyTokenSpectralCentroid: white noise -> centroidNorm near 0.5', () => {
  let s = 42;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  const n = 256;
  const y: number[] = [];
  for (let i = 0; i < n; i += 1) y.push(rand() * 1000);
  const r = dailyTokenSpectralCentroid(y);
  assert.ok(
    r.centroidNormalised > 0.3 && r.centroidNormalised < 0.7,
    `white-noise centroidNorm ${r.centroidNormalised} out of expected mid band`,
  );
});

test('dailyTokenSpectralCentroid: low-frequency sinusoid -> low centroid', () => {
  const n = 128;
  const y: number[] = [];
  // bin index k=2 (period n/2)
  for (let i = 0; i < n; i += 1) y.push(Math.sin((2 * Math.PI * 2 * i) / n));
  const r = dailyTokenSpectralCentroid(y);
  assert.ok(
    r.centroidNormalised < 0.1,
    `low-freq centroidNorm ${r.centroidNormalised} not low`,
  );
});

test('dailyTokenSpectralCentroid: high-frequency sinusoid -> high centroid', () => {
  const n = 128;
  const y: number[] = [];
  // near-Nyquist bin (k = n/2 - 1)
  const kTarget = n / 2 - 1;
  for (let i = 0; i < n; i += 1)
    y.push(Math.sin((2 * Math.PI * kTarget * i) / n));
  const r = dailyTokenSpectralCentroid(y);
  assert.ok(
    r.centroidNormalised > 0.9,
    `high-freq centroidNorm ${r.centroidNormalised} not high`,
  );
});

test('dailyTokenSpectralCentroid: shift-invariance', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 2, 3];
  const a = dailyTokenSpectralCentroid(y);
  const b = dailyTokenSpectralCentroid(y.map((v) => v + 1000));
  assert.ok(
    Math.abs(a.centroidBin - b.centroidBin) < 1e-9,
    `shift moved centroid from ${a.centroidBin} to ${b.centroidBin}`,
  );
});

test('dailyTokenSpectralCentroid: scale-invariance for any non-zero a', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const a = dailyTokenSpectralCentroid(y);
  const b = dailyTokenSpectralCentroid(y.map((v) => 17.5 * v));
  const c = dailyTokenSpectralCentroid(y.map((v) => -3 * v));
  assert.ok(Math.abs(a.centroidBin - b.centroidBin) < 1e-9);
  assert.ok(Math.abs(a.centroidBin - c.centroidBin) < 1e-9);
});

test('dailyTokenSpectralCentroid: sign-flip invariance', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const a = dailyTokenSpectralCentroid(y);
  const b = dailyTokenSpectralCentroid(y.map((v) => -v));
  assert.ok(Math.abs(a.centroidBin - b.centroidBin) < 1e-10);
});

test('dailyTokenSpectralCentroid: time-reversal invariance', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 4, 11];
  const r = [...y].reverse();
  const a = dailyTokenSpectralCentroid(y);
  const b = dailyTokenSpectralCentroid(r);
  assert.ok(
    Math.abs(a.centroidBin - b.centroidBin) < 1e-9,
    `reversal moved centroid from ${a.centroidBin} to ${b.centroidBin}`,
  );
});

test('dailyTokenSpectralCentroid: shuffle SENSITIVITY (whitens centroid toward midpoint)', () => {
  // Monotone ramp has low-frequency-tilted spectrum (low centroid).
  // Reversing halves whitens the spectrum and moves centroid up.
  const n = 64;
  const ramp: number[] = [];
  for (let i = 0; i < n; i += 1) ramp.push(i);
  const a = dailyTokenSpectralCentroid(ramp);
  const half = Math.floor(n / 2);
  const shuffled = [
    ...ramp.slice(half).reverse(),
    ...ramp.slice(0, half),
  ];
  const b = dailyTokenSpectralCentroid(shuffled);
  assert.notEqual(
    a.centroidBin.toFixed(6),
    b.centroidBin.toFixed(6),
    'shuffle did not move centroid at all',
  );
});

test('dailyTokenSpectralCentroid: usableBins <= nFreqBins = floor(n/2)', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 4, 11, 13];
  const r = dailyTokenSpectralCentroid(y);
  assert.equal(r.nFreqBins, Math.floor(y.length / 2));
  assert.ok(r.usableBins >= 2 && r.usableBins <= r.nFreqBins);
});

test('dailyTokenSpectralCentroid: centroidNormalised = centroidBin / K', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const r = dailyTokenSpectralCentroid(y);
  assert.ok(
    Math.abs(r.centroidNormalised - r.centroidBin / r.nFreqBins) < 1e-12,
  );
  assert.ok(r.centroidNormalised > 0 && r.centroidNormalised <= 1);
});

test('dailyTokenSpectralCentroid: mean and stddev match the input', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const r = dailyTokenSpectralCentroid(y);
  const mu = y.reduce((s, v) => s + v, 0) / y.length;
  let v = 0;
  for (const x of y) v += (x - mu) * (x - mu);
  const sd = Math.sqrt(v / y.length);
  assert.ok(Math.abs(r.mean - mu) < 1e-12);
  assert.ok(Math.abs(r.stddev - sd) < 1e-12);
});

test('dailyTokenSpectralCentroid: numerical stability across 1e9 / 1e-9 scale', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const r0 = dailyTokenSpectralCentroid(y);
  const rBig = dailyTokenSpectralCentroid(y.map((v) => 1e9 * v));
  const rSmall = dailyTokenSpectralCentroid(y.map((v) => 1e-9 * v));
  assert.ok(Math.abs(r0.centroidBin - rBig.centroidBin) < 1e-6);
  assert.ok(Math.abs(r0.centroidBin - rSmall.centroidBin) < 1e-6);
});

// ---------- buildDailyTokenSpectralCentroid orchestration ----------

test('buildDailyTokenSpectralCentroid: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenSpectralCentroid([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralCentroid([], { minTokens: NaN }),
  );
});

test('buildDailyTokenSpectralCentroid: rejects minTenureDays below 8', () => {
  assert.throws(() =>
    buildDailyTokenSpectralCentroid([], { minTenureDays: 7 }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralCentroid([], { minTenureDays: 7.5 }),
  );
});

test('buildDailyTokenSpectralCentroid: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenSpectralCentroid([], {
      sort: 'nope' as 'centroid',
    }),
  );
});

test('buildDailyTokenSpectralCentroid: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenSpectralCentroid([], { since: 'nope' }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralCentroid([], { until: 'nope' }),
  );
});

test('buildDailyTokenSpectralCentroid: rejects bad top', () => {
  assert.throws(() =>
    buildDailyTokenSpectralCentroid([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralCentroid([], { top: 1.5 }),
  );
});

test('buildDailyTokenSpectralCentroid: empty queue -> empty report', () => {
  const r = buildDailyTokenSpectralCentroid([], { generatedAt: ISO });
  assert.equal(r.generatedAt, ISO);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sort, 'centroidDesc');
});

test('buildDailyTokenSpectralCentroid: bad hour_start surfaces in dropped count', () => {
  const queue: QueueLine[] = [ql('not-a-date', 'src', 5000)];
  const r = buildDailyTokenSpectralCentroid(queue, { generatedAt: ISO });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenSpectralCentroid: non-positive tokens dropped', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'src', 0),
    ql(dayIso(1), 'src', -3),
    ql(dayIso(2), 'src', 5),
  ];
  const r = buildDailyTokenSpectralCentroid(queue, { generatedAt: ISO });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenSpectralCentroid: source filter routes non-matches to dropped', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'a', 100),
    ql(dayIso(0), 'b', 100),
  ];
  const r = buildDailyTokenSpectralCentroid(queue, {
    source: 'a',
    generatedAt: ISO,
  });
  assert.equal(r.droppedSourceFilter, 1);
});

test('buildDailyTokenSpectralCentroid: low-token sources surface as droppedSparseSources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) queue.push(ql(dayIso(i), 'a', 5));
  const r = buildDailyTokenSpectralCentroid(queue, {
    minTokens: 1000,
    generatedAt: ISO,
  });
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenSpectralCentroid: short-tenure sources surface as droppedBelowMinTenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) queue.push(ql(dayIso(i), 'a', 1000));
  const r = buildDailyTokenSpectralCentroid(queue, {
    minTokens: 100,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenSpectralCentroid: zero-variance gap-filled series surfaces as dropped', () => {
  const queue: QueueLine[] = [];
  // Same daily value for 40 consecutive days, no gaps -> filled is constant.
  for (let i = 0; i < 40; i += 1) queue.push(ql(dayIso(i), 'a', 1000));
  const r = buildDailyTokenSpectralCentroid(queue, {
    minTokens: 100,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenSpectralCentroid: top cap surfaces remainder as droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 3; s += 1) {
    for (let i = 0; i < 40; i += 1) {
      const tt = 1000 + s * 100 + (i % 7) * 200;
      queue.push(ql(dayIso(i), `src${s}`, tt));
    }
  }
  const r = buildDailyTokenSpectralCentroid(queue, {
    minTokens: 100,
    minTenureDays: 32,
    top: 1,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenSpectralCentroid: source-asc tiebreak when sort is source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'b', 1000 + (i % 3) * 300));
    queue.push(ql(dayIso(i), 'a', 1000 + (i % 5) * 200));
  }
  const r = buildDailyTokenSpectralCentroid(queue, {
    minTokens: 100,
    minTenureDays: 32,
    sort: 'source',
    generatedAt: ISO,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b'],
  );
});

test('buildDailyTokenSpectralCentroid: window filter via since/until', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 50; i += 1) queue.push(ql(dayIso(i), 'a', 1000 + i));
  const r = buildDailyTokenSpectralCentroid(queue, {
    since: dayIso(10),
    until: dayIso(40),
    minTokens: 100,
    minTenureDays: 8,
    generatedAt: ISO,
  });
  // 30 days windowed-in
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.nTenureDays === 30);
});

test('buildDailyTokenSpectralCentroid: per-source row JSON shape contract', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1)
    queue.push(ql(dayIso(i), 'a', 1000 + (i * 37) % 311));
  const r = buildDailyTokenSpectralCentroid(queue, {
    minTokens: 100,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'a');
  assert.ok(typeof row.totalTokens === 'number');
  assert.ok(typeof row.nActiveDays === 'number');
  assert.ok(typeof row.nTenureDays === 'number');
  assert.ok(typeof row.nFreqBins === 'number');
  assert.ok(typeof row.usableBins === 'number');
  assert.ok(typeof row.firstActiveDay === 'string');
  assert.ok(typeof row.lastActiveDay === 'string');
  assert.ok(Number.isFinite(row.mean));
  assert.ok(Number.isFinite(row.stddev));
  assert.ok(Number.isFinite(row.centroidBin));
  assert.ok(Number.isFinite(row.centroidNormalised));
  assert.ok(row.centroidBin >= 1 && row.centroidBin <= row.nFreqBins);
  assert.ok(
    row.centroidNormalised > 0 && row.centroidNormalised <= 1,
  );
});

test('buildDailyTokenSpectralCentroid: report-level JSON shape contract', () => {
  const r = buildDailyTokenSpectralCentroid([], { generatedAt: ISO });
  for (const k of [
    'generatedAt',
    'windowStart',
    'windowEnd',
    'minTokens',
    'minTenureDays',
    'top',
    'sort',
    'source',
    'totalTokens',
    'totalSources',
    'droppedInvalidHourStart',
    'droppedNonPositiveTokens',
    'droppedSourceFilter',
    'droppedSparseSources',
    'droppedBelowMinTenure',
    'droppedZeroVariance',
    'droppedTooFewUsableBins',
    'droppedNonFiniteFit',
    'droppedTopSources',
    'sources',
  ]) {
    assert.ok(k in r, `missing field ${k}`);
  }
});

test('buildDailyTokenSpectralCentroid: orthogonality vs flatness (axis 85) -- bin-permutation witness', () => {
  // Construct two synthetic series whose periodograms have the
  // same multiset of bin powers but in different bin assignments.
  // Easier path: use two sinusoids at different bin positions
  // with the same amplitude. Both have flatness near 0 (single
  // dominant bin), but very different centroids.
  const n = 64;
  const queue: QueueLine[] = [];
  for (let i = 0; i < n; i += 1) {
    queue.push(ql(dayIso(i), 'low', 1000 + 500 * Math.sin((2 * Math.PI * 2 * i) / n)));
    queue.push(ql(dayIso(i), 'high', 1000 + 500 * Math.sin((2 * Math.PI * (n / 2 - 1) * i) / n)));
  }
  const r = buildDailyTokenSpectralCentroid(queue, {
    minTokens: 100,
    minTenureDays: 32,
    sort: 'source',
    generatedAt: ISO,
  });
  const low = r.sources.find((s) => s.source === 'low')!;
  const high = r.sources.find((s) => s.source === 'high')!;
  assert.ok(low.centroidNormalised < 0.15, `low.centroidNorm = ${low.centroidNormalised}`);
  assert.ok(high.centroidNormalised > 0.85, `high.centroidNorm = ${high.centroidNormalised}`);
});

// ---------- refinement: additional edge cases ----------

test('spectralCentroidBin: closed-form on uniform-mass-on-half-the-bins (alternating zeros)', () => {
  // power = [0, 1, 0, 1, 0, 1] -> survivors at k = 2, 4, 6,
  // each carrying mass 1; centroid = (2 + 4 + 6) / 3 = 4.
  const r = spectralCentroidBin([0, 1, 0, 1, 0, 1]);
  assert.ok(Math.abs(r.centroidBin - 4) < 1e-12);
  assert.equal(r.usableBins, 3);
});

test('spectralCentroidBin: parametric sweep -- centroid grows monotonically as mass migrates upward', () => {
  // Place the same total mass M=10 on a single bin, sweep the
  // bin index k* across [1..K] with a tiny noise floor on the
  // remaining bins. centroidBin should track k* tightly.
  const K = 20;
  const floor = 1e-9;
  let prev = -Infinity;
  for (let kStar = 1; kStar <= K; kStar += 1) {
    const p = new Array(K).fill(floor);
    p[kStar - 1] = 10;
    const r = spectralCentroidBin(p);
    assert.ok(r.centroidBin > prev, `non-monotone at k*=${kStar}: ${prev} -> ${r.centroidBin}`);
    assert.ok(
      Math.abs(r.centroidBin - kStar) < 0.001,
      `centroidBin ${r.centroidBin} did not track k*=${kStar}`,
    );
    prev = r.centroidBin;
  }
});

test('dailyTokenSpectralCentroid: n=8 boundary -- smallest valid input still produces finite centroid', () => {
  const y = [1, 2, 1, 2, 1, 2, 1, 2];
  const r = dailyTokenSpectralCentroid(y);
  assert.equal(r.nFreqBins, 4);
  assert.ok(Number.isFinite(r.centroidBin));
  assert.ok(r.centroidBin >= 1 && r.centroidBin <= r.nFreqBins);
  // Period-2 alternation has all power at the Nyquist bin
  // k = n/2 = 4, so centroidBin should be very close to 4.
  assert.ok(
    Math.abs(r.centroidBin - 4) < 1e-9,
    `period-2 alternation centroidBin ${r.centroidBin} not pinned at Nyquist`,
  );
});

test('dailyTokenSpectralCentroid: noise-vs-tone gap survives DC offset and amplitude scale', () => {
  // The contrast between a low-frequency tone (low centroid) and
  // a high-frequency tone (high centroid) must survive both DC
  // offset and amplitude rescaling, by SHIFT- and SCALE-
  // invariance acting independently.
  const n = 64;
  const low: number[] = [];
  const high: number[] = [];
  for (let i = 0; i < n; i += 1) {
    low.push(Math.sin((2 * Math.PI * 2 * i) / n));
    high.push(Math.sin((2 * Math.PI * (n / 2 - 1) * i) / n));
  }
  const lowR = dailyTokenSpectralCentroid(low);
  const highR = dailyTokenSpectralCentroid(high);
  const lowShifted = dailyTokenSpectralCentroid(low.map((v) => 1000 + 7.5 * v));
  const highShifted = dailyTokenSpectralCentroid(high.map((v) => 1000 + 7.5 * v));
  assert.ok(Math.abs(lowR.centroidBin - lowShifted.centroidBin) < 1e-9);
  assert.ok(Math.abs(highR.centroidBin - highShifted.centroidBin) < 1e-9);
  assert.ok(highR.centroidBin > lowR.centroidBin * 5, 'tone-frequency gap collapsed');
  assert.ok(
    highShifted.centroidBin > lowShifted.centroidBin * 5,
    'tone-frequency gap collapsed under shift+scale',
  );
});

test('buildDailyTokenSpectralCentroid: centroidDesc default sort puts high-freq before low-freq tone source', () => {
  const n = 64;
  const queue: QueueLine[] = [];
  for (let i = 0; i < n; i += 1) {
    queue.push(ql(dayIso(i), 'low', 10000 + 5000 * Math.sin((2 * Math.PI * 2 * i) / n)));
    queue.push(ql(dayIso(i), 'high', 10000 + 5000 * Math.sin((2 * Math.PI * (n / 2 - 1) * i) / n)));
  }
  const r = buildDailyTokenSpectralCentroid(queue, {
    minTokens: 100,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  // default sort = centroidDesc, so 'high' should come first.
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['high', 'low'],
  );
});

test('buildDailyTokenSpectralCentroid: tokens-sort and tenure-sort tiebreak (source asc) witnesses', () => {
  const n = 40;
  const queue: QueueLine[] = [];
  // Identical daily mass for both sources -> identical totalTokens
  // and identical tenure; sorts must fall through to source asc.
  // Inject a small per-source phase shift to keep variance > 0.
  for (let i = 0; i < n; i += 1) {
    const aTok = 1000 + ((i % 5) === 0 ? 200 : 0);
    const bTok = 1000 + ((i % 5) === 2 ? 200 : 0);
    queue.push(ql(dayIso(i), 'a', aTok));
    queue.push(ql(dayIso(i), 'b', bTok));
  }
  const tokR = buildDailyTokenSpectralCentroid(queue, {
    minTokens: 100,
    minTenureDays: 32,
    sort: 'tokens',
    generatedAt: ISO,
  });
  // Both sources share identical totalTokens (each day adds 1000
  // and the 200 bonus lands on the same number of days for each).
  assert.equal(tokR.sources[0]!.totalTokens, tokR.sources[1]!.totalTokens);
  assert.deepEqual(
    tokR.sources.map((s) => s.source),
    ['a', 'b'],
  );
  const tenR = buildDailyTokenSpectralCentroid(queue, {
    minTokens: 100,
    minTenureDays: 32,
    sort: 'tenure',
    generatedAt: ISO,
  });
  assert.equal(tenR.sources[0]!.nTenureDays, tenR.sources[1]!.nTenureDays);
  assert.deepEqual(
    tenR.sources.map((s) => s.source),
    ['a', 'b'],
  );
});

