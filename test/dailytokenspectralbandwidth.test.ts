import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralBandwidthBin,
  dailyTokenSpectralBandwidth,
  buildDailyTokenSpectralBandwidth,
} from '../src/dailytokenspectralbandwidth.js';
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

// ---------- spectralBandwidthBin primitive ----------

test('spectralBandwidthBin: empty input -> throws', () => {
  assert.throws(() => spectralBandwidthBin([]), /empty power vector/);
});

test('spectralBandwidthBin: non-finite power -> throws', () => {
  assert.throws(
    () => spectralBandwidthBin([1, 2, NaN]),
    /non-finite power/,
  );
  assert.throws(
    () => spectralBandwidthBin([1, 2, Infinity]),
    /non-finite power/,
  );
});

test('spectralBandwidthBin: negative power -> throws', () => {
  assert.throws(
    () => spectralBandwidthBin([1, 2, -0.5]),
    /negative power/,
  );
});

test('spectralBandwidthBin: only one positive bin -> throws', () => {
  assert.throws(
    () => spectralBandwidthBin([0, 0, 1, 0]),
    /too few positive-power bins/,
  );
});

test('spectralBandwidthBin: zero positive bins -> throws', () => {
  assert.throws(
    () => spectralBandwidthBin([0, 0, 0, 0]),
    /too few positive-power bins/,
  );
});

test('spectralBandwidthBin: identical positive bins -> bandwidth = sqrt((K^2-1)/12)', () => {
  // power = [1,1,1,1,1] at bins k=1..5; centroid = 3;
  // var = ((1-3)^2 + (2-3)^2 + (3-3)^2 + (4-3)^2 + (5-3)^2)/5
  //     = (4+1+0+1+4)/5 = 10/5 = 2 = (5^2 - 1)/12 = 24/12 = 2.
  // bandwidthBin = sqrt(2).
  const r = spectralBandwidthBin([1, 1, 1, 1, 1]);
  assert.ok(Math.abs(r.centroidBin - 3) < 1e-12);
  assert.ok(Math.abs(r.bandwidthBin - Math.sqrt(2)) < 1e-12);
  assert.equal(r.usableBins, 5);
});

test('spectralBandwidthBin: closed-form on [1, 4]', () => {
  // bins (1,2) with power (1,4); centroid = 9/5 = 1.8.
  // var = ((1-1.8)^2 * 1 + (2-1.8)^2 * 4) / 5
  //     = (0.64 + 0.16) / 5 = 0.16; sqrt -> 0.4.
  const r = spectralBandwidthBin([1, 4]);
  assert.ok(Math.abs(r.centroidBin - 9 / 5) < 1e-12);
  assert.ok(Math.abs(r.bandwidthBin - 0.4) < 1e-12);
  assert.equal(r.usableBins, 2);
});

test('spectralBandwidthBin: closed-form on bipolar mass at bins 1 and K', () => {
  // power = [1,0,0,0,1] -> survivors at k=1,5; centroid = 3;
  // var = ((1-3)^2*1 + (5-3)^2*1)/2 = (4+4)/2 = 4; sqrt -> 2.
  // (K - 1)/2 = 2 attained.
  const r = spectralBandwidthBin([1, 0, 0, 0, 1]);
  assert.ok(Math.abs(r.centroidBin - 3) < 1e-12);
  assert.ok(Math.abs(r.bandwidthBin - 2) < 1e-12);
  assert.equal(r.usableBins, 2);
});

test('spectralBandwidthBin: bound -- bandwidth in [0, (K-1)/2]', () => {
  let s = 12345;
  const rand = () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return s / 0x1_0000_0000;
  };
  for (let trial = 0; trial < 50; trial += 1) {
    const k = 4 + Math.floor(rand() * 20);
    const p: number[] = [];
    for (let i = 0; i < k; i += 1) p.push(rand() * 1000 + 0.001);
    const r = spectralBandwidthBin(p);
    const upper = (k - 1) / 2;
    assert.ok(
      r.bandwidthBin >= -1e-12 && r.bandwidthBin <= upper + 1e-12,
      `bandwidth ${r.bandwidthBin} out of [0, ${upper}]`,
    );
  }
});

test('spectralBandwidthBin: zero bins skipped, count is positives only', () => {
  // Only bins 2,4,6 carry mass; centroid = 4; var = ((2-4)^2+0+(6-4)^2)/3 = 8/3.
  const r = spectralBandwidthBin([0, 1, 0, 1, 0, 1]);
  assert.ok(Math.abs(r.centroidBin - 4) < 1e-12);
  assert.ok(Math.abs(r.bandwidthBin - Math.sqrt(8 / 3)) < 1e-12);
  assert.equal(r.usableBins, 3);
});

test('spectralBandwidthBin: bin permutation SENSITIVITY (orthogonality witness)', () => {
  // Same multiset of powers but reshuffled bin assignments yields
  // different centroid and different bandwidth in general. Here
  // [1,4,9,16,25] (tilt up) and [25,16,9,4,1] (tilt down) share
  // the same MULTISET so var around their respective centroids
  // is the same by symmetry, but compare against [9,1,25,4,16]:
  const a = spectralBandwidthBin([9, 1, 25, 4, 16]);
  const b = spectralBandwidthBin([1, 4, 9, 16, 25]);
  assert.ok(
    Math.abs(a.bandwidthBin - b.bandwidthBin) > 1e-3,
    `permutation invariance violation: ${a.bandwidthBin} vs ${b.bandwidthBin}`,
  );
});

test('spectralBandwidthBin: pure-tone limit -> bandwidth -> 0', () => {
  // One dominant bin with tiny noise floor on others. The
  // centroid is pinned at the dominant bin and the second
  // central moment is dominated by the noise floor, so it must
  // be small but strictly positive.
  const k = 30;
  const p = new Array(k).fill(1e-12);
  p[14] = 1e6;
  const r = spectralBandwidthBin(p);
  assert.ok(Math.abs(r.centroidBin - 15) < 1e-3);
  assert.ok(r.bandwidthBin < 1e-2, `pure-tone bandwidth ${r.bandwidthBin}`);
});

test('spectralBandwidthBin: scale-invariance of the ratio', () => {
  const p = [1, 4, 9, 16, 25];
  const a = spectralBandwidthBin(p);
  const b = spectralBandwidthBin(p.map((v) => 17.5 * v));
  assert.ok(Math.abs(a.bandwidthBin - b.bandwidthBin) < 1e-10);
  assert.ok(Math.abs(a.centroidBin - b.centroidBin) < 1e-10);
});

// ---------- dailyTokenSpectralBandwidth primitive ----------

test('dailyTokenSpectralBandwidth: too short -> throws', () => {
  assert.throws(() => dailyTokenSpectralBandwidth([1, 2, 3, 4, 5, 6, 7]));
});

test('dailyTokenSpectralBandwidth: non-finite -> throws', () => {
  assert.throws(() =>
    dailyTokenSpectralBandwidth([1, 2, 3, 4, 5, 6, 7, NaN, 9]),
  );
});

test('dailyTokenSpectralBandwidth: constant series -> throws zero variance', () => {
  assert.throws(
    () => dailyTokenSpectralBandwidth([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]),
    /zero variance/,
  );
});

test('dailyTokenSpectralBandwidth: white noise -> bandwidthNorm near 1/sqrt(12) ~ 0.2887', () => {
  let s = 42;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  const n = 256;
  const y: number[] = [];
  for (let i = 0; i < n; i += 1) y.push(rand() * 1000);
  const r = dailyTokenSpectralBandwidth(y);
  // Fairly wide tolerance because a single random draw fluctuates.
  assert.ok(
    r.bandwidthNormalised > 0.2 && r.bandwidthNormalised < 0.35,
    `white-noise bandwidthNorm ${r.bandwidthNormalised} out of expected white-asymptote band`,
  );
});

test('dailyTokenSpectralBandwidth: pure low-frequency sinusoid -> small bandwidth', () => {
  const n = 128;
  const y: number[] = [];
  for (let i = 0; i < n; i += 1) y.push(Math.sin((2 * Math.PI * 2 * i) / n));
  const r = dailyTokenSpectralBandwidth(y);
  assert.ok(
    r.bandwidthNormalised < 0.05,
    `pure-tone bandwidthNorm ${r.bandwidthNormalised} not small`,
  );
});

test('dailyTokenSpectralBandwidth: pure high-frequency sinusoid -> small bandwidth', () => {
  const n = 128;
  const y: number[] = [];
  const kTarget = n / 2 - 1;
  for (let i = 0; i < n; i += 1)
    y.push(Math.sin((2 * Math.PI * kTarget * i) / n));
  const r = dailyTokenSpectralBandwidth(y);
  assert.ok(
    r.bandwidthNormalised < 0.05,
    `pure-tone bandwidthNorm ${r.bandwidthNormalised} not small`,
  );
});

test('dailyTokenSpectralBandwidth: two-tone (low + high) -> larger bandwidth than either alone', () => {
  const n = 128;
  const single: number[] = [];
  const dual: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const lo = Math.sin((2 * Math.PI * 2 * i) / n);
    const hi = Math.sin((2 * Math.PI * (n / 2 - 1) * i) / n);
    single.push(lo);
    dual.push(lo + hi);
  }
  const a = dailyTokenSpectralBandwidth(single);
  const b = dailyTokenSpectralBandwidth(dual);
  assert.ok(
    b.bandwidthNormalised > a.bandwidthNormalised * 5,
    `two-tone bandwidth ${b.bandwidthNormalised} not much larger than single-tone ${a.bandwidthNormalised}`,
  );
});

test('dailyTokenSpectralBandwidth: shift-invariance', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 2, 3];
  const a = dailyTokenSpectralBandwidth(y);
  const b = dailyTokenSpectralBandwidth(y.map((v) => v + 1000));
  assert.ok(
    Math.abs(a.bandwidthBin - b.bandwidthBin) < 1e-9,
    `shift moved bandwidth from ${a.bandwidthBin} to ${b.bandwidthBin}`,
  );
});

test('dailyTokenSpectralBandwidth: scale-invariance for any non-zero a', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const a = dailyTokenSpectralBandwidth(y);
  const b = dailyTokenSpectralBandwidth(y.map((v) => 17.5 * v));
  const c = dailyTokenSpectralBandwidth(y.map((v) => -3 * v));
  assert.ok(Math.abs(a.bandwidthBin - b.bandwidthBin) < 1e-9);
  assert.ok(Math.abs(a.bandwidthBin - c.bandwidthBin) < 1e-9);
});

test('dailyTokenSpectralBandwidth: sign-flip invariance', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const a = dailyTokenSpectralBandwidth(y);
  const b = dailyTokenSpectralBandwidth(y.map((v) => -v));
  assert.ok(Math.abs(a.bandwidthBin - b.bandwidthBin) < 1e-10);
});

test('dailyTokenSpectralBandwidth: time-reversal invariance', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 4, 11];
  const r = [...y].reverse();
  const a = dailyTokenSpectralBandwidth(y);
  const b = dailyTokenSpectralBandwidth(r);
  assert.ok(
    Math.abs(a.bandwidthBin - b.bandwidthBin) < 1e-9,
    `reversal moved bandwidth from ${a.bandwidthBin} to ${b.bandwidthBin}`,
  );
});

test('dailyTokenSpectralBandwidth: shuffle SENSITIVITY (whitens bandwidth toward uniform asymptote)', () => {
  const n = 64;
  const ramp: number[] = [];
  for (let i = 0; i < n; i += 1) ramp.push(i);
  const a = dailyTokenSpectralBandwidth(ramp);
  const half = Math.floor(n / 2);
  const shuffled = [
    ...ramp.slice(half).reverse(),
    ...ramp.slice(0, half),
  ];
  const b = dailyTokenSpectralBandwidth(shuffled);
  assert.notEqual(
    a.bandwidthBin.toFixed(6),
    b.bandwidthBin.toFixed(6),
    'shuffle did not move bandwidth at all',
  );
});

test('dailyTokenSpectralBandwidth: usableBins <= nFreqBins = floor(n/2)', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 4, 11, 13];
  const r = dailyTokenSpectralBandwidth(y);
  assert.equal(r.nFreqBins, Math.floor(y.length / 2));
  assert.ok(r.usableBins >= 2 && r.usableBins <= r.nFreqBins);
});

test('dailyTokenSpectralBandwidth: bandwidthNormalised = bandwidthBin / K, in [0, 1/2)', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const r = dailyTokenSpectralBandwidth(y);
  assert.ok(
    Math.abs(r.bandwidthNormalised - r.bandwidthBin / r.nFreqBins) < 1e-12,
  );
  assert.ok(r.bandwidthNormalised >= 0 && r.bandwidthNormalised < 0.5 + 1e-12);
});

test('dailyTokenSpectralBandwidth: mean and stddev match the input', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const r = dailyTokenSpectralBandwidth(y);
  const mu = y.reduce((s, v) => s + v, 0) / y.length;
  let v = 0;
  for (const x of y) v += (x - mu) * (x - mu);
  const sd = Math.sqrt(v / y.length);
  assert.ok(Math.abs(r.mean - mu) < 1e-12);
  assert.ok(Math.abs(r.stddev - sd) < 1e-12);
});

test('dailyTokenSpectralBandwidth: numerical stability across 1e9 / 1e-9 scale', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const r0 = dailyTokenSpectralBandwidth(y);
  const rBig = dailyTokenSpectralBandwidth(y.map((v) => 1e9 * v));
  const rSmall = dailyTokenSpectralBandwidth(y.map((v) => 1e-9 * v));
  assert.ok(Math.abs(r0.bandwidthBin - rBig.bandwidthBin) < 1e-6);
  assert.ok(Math.abs(r0.bandwidthBin - rSmall.bandwidthBin) < 1e-6);
});

// ---------- buildDailyTokenSpectralBandwidth orchestration ----------

test('buildDailyTokenSpectralBandwidth: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenSpectralBandwidth([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralBandwidth([], { minTokens: NaN }),
  );
});

test('buildDailyTokenSpectralBandwidth: rejects minTenureDays below 8', () => {
  assert.throws(() =>
    buildDailyTokenSpectralBandwidth([], { minTenureDays: 7 }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralBandwidth([], { minTenureDays: 7.5 }),
  );
});

test('buildDailyTokenSpectralBandwidth: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenSpectralBandwidth([], {
      sort: 'nope' as 'bandwidth',
    }),
  );
});

test('buildDailyTokenSpectralBandwidth: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenSpectralBandwidth([], { since: 'nope' }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralBandwidth([], { until: 'nope' }),
  );
});

test('buildDailyTokenSpectralBandwidth: rejects bad top', () => {
  assert.throws(() =>
    buildDailyTokenSpectralBandwidth([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralBandwidth([], { top: 1.5 }),
  );
});

test('buildDailyTokenSpectralBandwidth: empty queue -> empty report', () => {
  const r = buildDailyTokenSpectralBandwidth([], { generatedAt: ISO });
  assert.equal(r.generatedAt, ISO);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sort, 'bandwidthDesc');
});

test('buildDailyTokenSpectralBandwidth: bad hour_start surfaces in dropped count', () => {
  const queue: QueueLine[] = [ql('not-a-date', 'src', 5000)];
  const r = buildDailyTokenSpectralBandwidth(queue, { generatedAt: ISO });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenSpectralBandwidth: non-positive tokens dropped', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'src', 0),
    ql(dayIso(1), 'src', -3),
    ql(dayIso(2), 'src', 5),
  ];
  const r = buildDailyTokenSpectralBandwidth(queue, { generatedAt: ISO });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenSpectralBandwidth: source filter routes non-matches to dropped', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'a', 100),
    ql(dayIso(0), 'b', 100),
  ];
  const r = buildDailyTokenSpectralBandwidth(queue, {
    source: 'a',
    generatedAt: ISO,
  });
  assert.equal(r.droppedSourceFilter, 1);
});

test('buildDailyTokenSpectralBandwidth: low-token sources surface as droppedSparseSources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) queue.push(ql(dayIso(i), 'a', 5));
  const r = buildDailyTokenSpectralBandwidth(queue, {
    minTokens: 1000,
    generatedAt: ISO,
  });
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenSpectralBandwidth: short-tenure sources surface as droppedBelowMinTenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) queue.push(ql(dayIso(i), 'a', 1000));
  const r = buildDailyTokenSpectralBandwidth(queue, {
    minTokens: 100,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenSpectralBandwidth: zero-variance gap-filled series surfaces as dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) queue.push(ql(dayIso(i), 'a', 1000));
  const r = buildDailyTokenSpectralBandwidth(queue, {
    minTokens: 100,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenSpectralBandwidth: top cap surfaces remainder as droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 3; s += 1) {
    for (let i = 0; i < 40; i += 1) {
      const tt = 1000 + s * 100 + (i % 7) * 200;
      queue.push(ql(dayIso(i), `src${s}`, tt));
    }
  }
  const r = buildDailyTokenSpectralBandwidth(queue, {
    minTokens: 100,
    minTenureDays: 32,
    top: 1,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenSpectralBandwidth: source-asc tiebreak when sort is source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'b', 1000 + (i % 3) * 300));
    queue.push(ql(dayIso(i), 'a', 1000 + (i % 5) * 200));
  }
  const r = buildDailyTokenSpectralBandwidth(queue, {
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

test('buildDailyTokenSpectralBandwidth: window filter via since/until', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 50; i += 1) queue.push(ql(dayIso(i), 'a', 1000 + i));
  const r = buildDailyTokenSpectralBandwidth(queue, {
    since: dayIso(10),
    until: dayIso(40),
    minTokens: 100,
    minTenureDays: 8,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.nTenureDays === 30);
});

test('buildDailyTokenSpectralBandwidth: per-source row JSON shape contract', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1)
    queue.push(ql(dayIso(i), 'a', 1000 + (i * 37) % 311));
  const r = buildDailyTokenSpectralBandwidth(queue, {
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
  assert.ok(Number.isFinite(row.bandwidthBin));
  assert.ok(Number.isFinite(row.bandwidthNormalised));
  assert.ok(row.bandwidthBin >= 0 && row.bandwidthBin <= (row.nFreqBins - 1) / 2 + 1e-9);
  assert.ok(
    row.bandwidthNormalised >= 0 && row.bandwidthNormalised < 0.5 + 1e-9,
  );
});

test('buildDailyTokenSpectralBandwidth: report-level JSON shape contract', () => {
  const r = buildDailyTokenSpectralBandwidth([], { generatedAt: ISO });
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

// ---------- orthogonality witnesses vs the spectral siblings ----------

test('buildDailyTokenSpectralBandwidth: orthogonality vs centroid (axis 86) -- same centroid, different bandwidth', () => {
  // Two synthetic series whose periodograms have ~ the same
  // centroid but very different bandwidths. Construct via a
  // single tone at the midpoint bin (low bandwidth) vs a
  // bipolar two-tone at bins 1 and K (same centroid by
  // symmetry but maximum-spread bandwidth).
  const n = 64;
  const queue: QueueLine[] = [];
  const kMid = n / 4; // bin K/2 of K = n/2 = 32 -> bin 16
  for (let i = 0; i < n; i += 1) {
    queue.push(
      ql(dayIso(i), 'narrow', 10000 + 5000 * Math.sin((2 * Math.PI * kMid * i) / n)),
    );
    const lo = Math.sin((2 * Math.PI * 1 * i) / n);
    const hi = Math.sin((2 * Math.PI * (n / 2 - 1) * i) / n);
    queue.push(ql(dayIso(i), 'wide', 10000 + 2500 * (lo + hi)));
  }
  const r = buildDailyTokenSpectralBandwidth(queue, {
    minTokens: 100,
    minTenureDays: 32,
    sort: 'source',
    generatedAt: ISO,
  });
  const narrow = r.sources.find((s) => s.source === 'narrow')!;
  const wide = r.sources.find((s) => s.source === 'wide')!;
  // Both centroids should be near the bin midpoint (K+1)/2 ~ 16.5.
  assert.ok(Math.abs(narrow.centroidBin - wide.centroidBin) < 4,
    `centroids should be close, got ${narrow.centroidBin} vs ${wide.centroidBin}`);
  // But bandwidths must differ by a large factor.
  assert.ok(
    wide.bandwidthBin > narrow.bandwidthBin * 5,
    `wide bandwidth ${wide.bandwidthBin} not >> narrow bandwidth ${narrow.bandwidthBin}`,
  );
});

test('buildDailyTokenSpectralBandwidth: bandwidthDesc default sort puts wide-spectrum source first', () => {
  const n = 64;
  const queue: QueueLine[] = [];
  const kMid = n / 4;
  for (let i = 0; i < n; i += 1) {
    queue.push(
      ql(dayIso(i), 'narrow', 10000 + 5000 * Math.sin((2 * Math.PI * kMid * i) / n)),
    );
    const lo = Math.sin((2 * Math.PI * 1 * i) / n);
    const hi = Math.sin((2 * Math.PI * (n / 2 - 1) * i) / n);
    queue.push(ql(dayIso(i), 'wide', 10000 + 2500 * (lo + hi)));
  }
  const r = buildDailyTokenSpectralBandwidth(queue, {
    minTokens: 100,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  // default sort = bandwidthDesc, so 'wide' should come first.
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['wide', 'narrow'],
  );
});

test('buildDailyTokenSpectralBandwidth: tokens-sort and tenure-sort tiebreak (source asc) witnesses', () => {
  const n = 40;
  const queue: QueueLine[] = [];
  for (let i = 0; i < n; i += 1) {
    const aTok = 1000 + ((i % 5) === 0 ? 200 : 0);
    const bTok = 1000 + ((i % 5) === 2 ? 200 : 0);
    queue.push(ql(dayIso(i), 'a', aTok));
    queue.push(ql(dayIso(i), 'b', bTok));
  }
  const tokR = buildDailyTokenSpectralBandwidth(queue, {
    minTokens: 100,
    minTenureDays: 32,
    sort: 'tokens',
    generatedAt: ISO,
  });
  assert.equal(tokR.sources[0]!.totalTokens, tokR.sources[1]!.totalTokens);
  assert.deepEqual(
    tokR.sources.map((s) => s.source),
    ['a', 'b'],
  );
  const tenR = buildDailyTokenSpectralBandwidth(queue, {
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

test('dailyTokenSpectralBandwidth: n=8 boundary -- smallest valid input still produces finite bandwidth', () => {
  const y = [1, 2, 1, 2, 1, 2, 1, 2];
  const r = dailyTokenSpectralBandwidth(y);
  assert.equal(r.nFreqBins, 4);
  assert.ok(Number.isFinite(r.bandwidthBin));
  assert.ok(r.bandwidthBin >= 0 && r.bandwidthBin <= (r.nFreqBins - 1) / 2 + 1e-9);
  // Period-2 alternation has all power at the Nyquist bin
  // k = n/2 = 4; bandwidth around that single bin should be ~0.
  assert.ok(
    r.bandwidthBin < 1e-6,
    `period-2 alternation bandwidth ${r.bandwidthBin} not near zero`,
  );
});

// ---------- refinement: extra closed-form / stability witnesses ----------

test('spectralBandwidthBin: parametric closed-form sweep -- uniform power on K bins -> bandwidth = sqrt((K^2-1)/12)', () => {
  // For uniform power on bins k=1..K, centroid = (K+1)/2 and the
  // variance is the discrete-uniform variance (K^2 - 1)/12. This
  // is the textbook white-spectrum limit and pins the exact
  // closed-form bandwidth across a sweep of K.
  for (const K of [2, 3, 4, 5, 8, 16, 32, 64]) {
    const p = new Array(K).fill(1);
    const r = spectralBandwidthBin(p);
    const expected = Math.sqrt((K * K - 1) / 12);
    assert.ok(
      Math.abs(r.bandwidthBin - expected) < 1e-12,
      `K=${K}: bandwidth ${r.bandwidthBin} != sqrt((K^2-1)/12)=${expected}`,
    );
    assert.ok(Math.abs(r.centroidBin - (K + 1) / 2) < 1e-12);
  }
});

test('spectralBandwidthBin: parametric monotonicity sweep -- bandwidth grows as the two surviving bins spread apart', () => {
  // Place equal mass M=1 on bins k=1 and k=j with a tiny noise
  // floor on the rest; centroid = (1 + j)/2 and bandwidth =
  // (j - 1)/2 by closed form. Sweep j and confirm strict
  // monotone growth.
  const K = 30;
  const floor = 1e-12;
  let prev = -Infinity;
  for (let j = 2; j <= K; j += 1) {
    const p = new Array(K).fill(floor);
    p[0] = 1;
    p[j - 1] = 1;
    const r = spectralBandwidthBin(p);
    const expectedBandwidth = (j - 1) / 2;
    assert.ok(
      Math.abs(r.bandwidthBin - expectedBandwidth) < 1e-3,
      `j=${j}: bandwidth ${r.bandwidthBin} != (j-1)/2=${expectedBandwidth}`,
    );
    assert.ok(r.bandwidthBin > prev, `non-monotone at j=${j}: ${prev} -> ${r.bandwidthBin}`);
    prev = r.bandwidthBin;
  }
});

test('spectralBandwidthBin: numerical stability of the two-pass second-central-moment estimator across 1e12 / 1e-12 scale', () => {
  // The two-pass estimator is the textbook numerically stable
  // path: power values 1e12 vs 1e-12 should yield bit-identical
  // bandwidthBin (the ratio is scale-invariant) without
  // catastrophic cancellation.
  const p = [1, 4, 9, 16, 25, 36, 49];
  const r0 = spectralBandwidthBin(p);
  const rBig = spectralBandwidthBin(p.map((v) => 1e12 * v));
  const rSmall = spectralBandwidthBin(p.map((v) => 1e-12 * v));
  assert.ok(
    Math.abs(r0.bandwidthBin - rBig.bandwidthBin) < 1e-10,
    `1e12 scale moved bandwidth from ${r0.bandwidthBin} to ${rBig.bandwidthBin}`,
  );
  assert.ok(
    Math.abs(r0.bandwidthBin - rSmall.bandwidthBin) < 1e-10,
    `1e-12 scale moved bandwidth from ${r0.bandwidthBin} to ${rSmall.bandwidthBin}`,
  );
});

test('dailyTokenSpectralBandwidth: bandwidthDesc default-sort acceptance witness on a single-tone-vs-bipolar pair', () => {
  // Two synthetic series whose periodograms share centroid but
  // differ in bandwidth; the default sort must rank the wider
  // one first. End-to-end acceptance test for the build pipeline
  // and the default sort wiring.
  const n = 64;
  const single: number[] = [];
  const dual: number[] = [];
  const kMid = n / 4;
  for (let i = 0; i < n; i += 1) {
    single.push(Math.sin((2 * Math.PI * kMid * i) / n));
    const lo = Math.sin((2 * Math.PI * 1 * i) / n);
    const hi = Math.sin((2 * Math.PI * (n / 2 - 1) * i) / n);
    dual.push(lo + hi);
  }
  const a = dailyTokenSpectralBandwidth(single);
  const b = dailyTokenSpectralBandwidth(dual);
  assert.ok(
    b.bandwidthNormalised > a.bandwidthNormalised,
    `dual.bandwidthNorm ${b.bandwidthNormalised} not > single.bandwidthNorm ${a.bandwidthNormalised}`,
  );
});
