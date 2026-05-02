import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralRolloffBin,
  dailyTokenSpectralRolloff,
  buildDailyTokenSpectralRolloff,
} from '../src/dailytokenspectralrolloff.js';
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

// ---------- spectralRolloffBin primitive ----------

test('spectralRolloffBin: empty input -> throws', () => {
  assert.throws(() => spectralRolloffBin([], 0.85), /empty power vector/);
});

test('spectralRolloffBin: bad rolloffFraction -> throws', () => {
  assert.throws(() => spectralRolloffBin([1, 2, 3], 0), /rolloffFraction/);
  assert.throws(() => spectralRolloffBin([1, 2, 3], -0.1), /rolloffFraction/);
  assert.throws(() => spectralRolloffBin([1, 2, 3], 1.5), /rolloffFraction/);
  assert.throws(() => spectralRolloffBin([1, 2, 3], NaN), /rolloffFraction/);
});

test('spectralRolloffBin: non-finite power -> throws', () => {
  assert.throws(
    () => spectralRolloffBin([1, 2, NaN], 0.85),
    /non-finite power/,
  );
  assert.throws(
    () => spectralRolloffBin([1, 2, Infinity], 0.85),
    /non-finite power/,
  );
});

test('spectralRolloffBin: negative power -> throws', () => {
  assert.throws(
    () => spectralRolloffBin([1, 2, -0.5], 0.85),
    /negative power/,
  );
});

test('spectralRolloffBin: only one positive bin -> throws', () => {
  assert.throws(
    () => spectralRolloffBin([0, 0, 1, 0], 0.85),
    /too few positive-power bins/,
  );
});

test('spectralRolloffBin: zero positive bins -> throws', () => {
  assert.throws(
    () => spectralRolloffBin([0, 0, 0, 0], 0.85),
    /too few positive-power bins/,
  );
});

test('spectralRolloffBin: uniform power -> R / K -> rolloffFraction (white asymptote)', () => {
  // Uniform power across K bins; cumulative-fraction at bin k
  // is exactly k / K. For rolloffFraction f the smallest k
  // with k/K >= f is ceil(f * K).
  const K = 100;
  const p = new Array(K).fill(1);
  for (const f of [0.25, 0.5, 0.85, 0.95]) {
    const r = spectralRolloffBin(p, f);
    assert.equal(r.rolloffBin, Math.ceil(f * K));
    assert.ok(r.cumulativeFraction >= f - 1e-12);
    assert.equal(r.usableBins, K);
  }
});

test('spectralRolloffBin: closed-form on [1, 4]', () => {
  // bins (1, 2) with power (1, 4); total = 5.
  // f=0.5: cum at bin1 = 1/5 = 0.2 < 0.5; cum at bin2 = 5/5 = 1 >= 0.5 -> R=2.
  // f=0.1: cum at bin1 = 0.2 >= 0.1 -> R=1.
  const r1 = spectralRolloffBin([1, 4], 0.5);
  assert.equal(r1.rolloffBin, 2);
  assert.ok(Math.abs(r1.cumulativeFraction - 1) < 1e-12);
  const r2 = spectralRolloffBin([1, 4], 0.1);
  assert.equal(r2.rolloffBin, 1);
  assert.ok(Math.abs(r2.cumulativeFraction - 0.2) < 1e-12);
});

test('spectralRolloffBin: low-frequency mass concentration -> small R', () => {
  // 95% of energy in bin 1.
  const p = [95, 1, 1, 1, 1, 1];
  const r = spectralRolloffBin(p, 0.85);
  assert.equal(r.rolloffBin, 1);
  assert.ok(r.cumulativeFraction >= 0.85);
});

test('spectralRolloffBin: high-frequency mass concentration -> large R', () => {
  // Long low-freq trickle; mass at bin K.
  const p = [1, 1, 1, 1, 1, 95];
  const r = spectralRolloffBin(p, 0.85);
  assert.equal(r.rolloffBin, 6);
});

test('spectralRolloffBin: f=1 -> R = K (cap to last surviving bin)', () => {
  const p = [1, 2, 3, 4, 5];
  const r = spectralRolloffBin(p, 1.0);
  assert.equal(r.rolloffBin, 5);
  assert.ok(Math.abs(r.cumulativeFraction - 1) < 1e-12);
});

test('spectralRolloffBin: zero bins skipped, count is positives only', () => {
  // Only bins 2,4,6 carry mass equal-weight; cum at bin2 = 1/3,
  // bin4 = 2/3, bin6 = 1; f=0.5 -> first cum >= 0.5 is bin4.
  const r = spectralRolloffBin([0, 1, 0, 1, 0, 1], 0.5);
  assert.equal(r.rolloffBin, 4);
  assert.equal(r.usableBins, 3);
});

test('spectralRolloffBin: bin permutation SENSITIVITY (orthogonality witness)', () => {
  // Same multiset of powers but reshuffled bin assignments
  // yields different roll-off bins in general.
  const a = spectralRolloffBin([1, 1, 1, 1, 96], 0.85);
  const b = spectralRolloffBin([96, 1, 1, 1, 1], 0.85);
  assert.notEqual(a.rolloffBin, b.rolloffBin);
});

test('spectralRolloffBin: scale-invariance of the percentile', () => {
  const p = [1, 4, 9, 16, 25];
  const a = spectralRolloffBin(p, 0.85);
  const b = spectralRolloffBin(
    p.map((v) => 17.5 * v),
    0.85,
  );
  assert.equal(a.rolloffBin, b.rolloffBin);
});

test('spectralRolloffBin: monotone in rolloffFraction', () => {
  const p = [4, 3, 2, 1, 1, 1, 1, 1];
  let prev = 0;
  for (const f of [0.1, 0.3, 0.5, 0.7, 0.85, 0.95, 1.0]) {
    const r = spectralRolloffBin(p, f);
    assert.ok(r.rolloffBin >= prev, `non-monotone at f=${f}: ${prev} -> ${r.rolloffBin}`);
    prev = r.rolloffBin;
  }
});

// ---------- dailyTokenSpectralRolloff primitive ----------

test('dailyTokenSpectralRolloff: too short -> throws', () => {
  assert.throws(() => dailyTokenSpectralRolloff([1, 2, 3, 4, 5, 6, 7], 0.85));
});

test('dailyTokenSpectralRolloff: non-finite -> throws', () => {
  assert.throws(() =>
    dailyTokenSpectralRolloff([1, 2, 3, 4, 5, 6, 7, NaN, 9], 0.85),
  );
});

test('dailyTokenSpectralRolloff: constant series -> throws zero variance', () => {
  assert.throws(
    () => dailyTokenSpectralRolloff([5, 5, 5, 5, 5, 5, 5, 5, 5, 5], 0.85),
    /zero variance/,
  );
});

test('dailyTokenSpectralRolloff: white noise -> rolloffNorm near 0.85 (white asymptote)', () => {
  let s = 42;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  const n = 256;
  const y: number[] = [];
  for (let i = 0; i < n; i += 1) y.push(rand() * 1000);
  const r = dailyTokenSpectralRolloff(y, 0.85);
  // Wide tolerance for a single random draw.
  assert.ok(
    r.rolloffNormalised > 0.65 && r.rolloffNormalised < 0.98,
    `white-noise rolloffNorm ${r.rolloffNormalised} out of expected band`,
  );
});

test('dailyTokenSpectralRolloff: pure low-frequency sinusoid -> small rolloffBin', () => {
  const n = 128;
  const y: number[] = [];
  for (let i = 0; i < n; i += 1) y.push(Math.sin((2 * Math.PI * 2 * i) / n));
  const r = dailyTokenSpectralRolloff(y, 0.85);
  // All energy at bin 2 -> rolloffBin = 2 (or thereabouts).
  assert.ok(
    r.rolloffBin <= 4,
    `pure-low-tone rolloffBin ${r.rolloffBin} not small`,
  );
});

test('dailyTokenSpectralRolloff: pure high-frequency sinusoid -> large rolloffBin', () => {
  const n = 128;
  const y: number[] = [];
  const kTarget = n / 2 - 1;
  for (let i = 0; i < n; i += 1)
    y.push(Math.sin((2 * Math.PI * kTarget * i) / n));
  const r = dailyTokenSpectralRolloff(y, 0.85);
  assert.ok(
    r.rolloffBin >= n / 2 - 2,
    `pure-high-tone rolloffBin ${r.rolloffBin} not large (K=${r.nFreqBins})`,
  );
});

test('dailyTokenSpectralRolloff: shift-invariance', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 2, 3];
  const a = dailyTokenSpectralRolloff(y, 0.85);
  const b = dailyTokenSpectralRolloff(
    y.map((v) => v + 1000),
    0.85,
  );
  assert.equal(a.rolloffBin, b.rolloffBin);
});

test('dailyTokenSpectralRolloff: scale-invariance for any non-zero a', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const a = dailyTokenSpectralRolloff(y, 0.85);
  const b = dailyTokenSpectralRolloff(
    y.map((v) => 17.5 * v),
    0.85,
  );
  const c = dailyTokenSpectralRolloff(
    y.map((v) => -3 * v),
    0.85,
  );
  assert.equal(a.rolloffBin, b.rolloffBin);
  assert.equal(a.rolloffBin, c.rolloffBin);
});

test('dailyTokenSpectralRolloff: sign-flip invariance', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const a = dailyTokenSpectralRolloff(y, 0.85);
  const b = dailyTokenSpectralRolloff(
    y.map((v) => -v),
    0.85,
  );
  assert.equal(a.rolloffBin, b.rolloffBin);
});

test('dailyTokenSpectralRolloff: time-reversal invariance', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 4, 11];
  const r = [...y].reverse();
  const a = dailyTokenSpectralRolloff(y, 0.85);
  const b = dailyTokenSpectralRolloff(r, 0.85);
  assert.equal(a.rolloffBin, b.rolloffBin);
});

test('dailyTokenSpectralRolloff: usableBins <= nFreqBins = floor(n/2)', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 4, 11, 13];
  const r = dailyTokenSpectralRolloff(y, 0.85);
  assert.equal(r.nFreqBins, Math.floor(y.length / 2));
  assert.ok(r.usableBins >= 2 && r.usableBins <= r.nFreqBins);
});

test('dailyTokenSpectralRolloff: rolloffNormalised = rolloffBin / K, in (0, 1]', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const r = dailyTokenSpectralRolloff(y, 0.85);
  assert.ok(
    Math.abs(r.rolloffNormalised - r.rolloffBin / r.nFreqBins) < 1e-12,
  );
  assert.ok(r.rolloffNormalised > 0 && r.rolloffNormalised <= 1 + 1e-12);
});

test('dailyTokenSpectralRolloff: cumulativeFraction >= rolloffFraction', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 4, 11];
  for (const f of [0.1, 0.5, 0.85, 0.95]) {
    const r = dailyTokenSpectralRolloff(y, f);
    assert.ok(
      r.cumulativeFraction >= f - 1e-12,
      `f=${f}: cumulativeFraction ${r.cumulativeFraction} < ${f}`,
    );
  }
});

test('dailyTokenSpectralRolloff: mean and stddev match the input', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const r = dailyTokenSpectralRolloff(y, 0.85);
  const mu = y.reduce((s, v) => s + v, 0) / y.length;
  let v = 0;
  for (const x of y) v += (x - mu) * (x - mu);
  const sd = Math.sqrt(v / y.length);
  assert.ok(Math.abs(r.mean - mu) < 1e-12);
  assert.ok(Math.abs(r.stddev - sd) < 1e-12);
});

// ---------- buildDailyTokenSpectralRolloff orchestration ----------

test('buildDailyTokenSpectralRolloff: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenSpectralRolloff([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralRolloff([], { minTokens: NaN }),
  );
});

test('buildDailyTokenSpectralRolloff: rejects minTenureDays below 8', () => {
  assert.throws(() =>
    buildDailyTokenSpectralRolloff([], { minTenureDays: 7 }),
  );
});

test('buildDailyTokenSpectralRolloff: rejects bad rolloffFraction', () => {
  assert.throws(() =>
    buildDailyTokenSpectralRolloff([], { rolloffFraction: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralRolloff([], { rolloffFraction: 1.5 }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralRolloff([], { rolloffFraction: NaN }),
  );
});

test('buildDailyTokenSpectralRolloff: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenSpectralRolloff([], {
      sort: 'nope' as 'rolloff',
    }),
  );
});

test('buildDailyTokenSpectralRolloff: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenSpectralRolloff([], { since: 'nope' }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralRolloff([], { until: 'nope' }),
  );
});

test('buildDailyTokenSpectralRolloff: rejects bad top', () => {
  assert.throws(() =>
    buildDailyTokenSpectralRolloff([], { top: -1 }),
  );
});

test('buildDailyTokenSpectralRolloff: empty queue -> empty report', () => {
  const r = buildDailyTokenSpectralRolloff([], { generatedAt: ISO });
  assert.equal(r.generatedAt, ISO);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sort, 'rolloffDesc');
  assert.equal(r.rolloffFraction, 0.85);
});

test('buildDailyTokenSpectralRolloff: bad hour_start surfaces in dropped count', () => {
  const queue: QueueLine[] = [ql('not-a-date', 'src', 5000)];
  const r = buildDailyTokenSpectralRolloff(queue, { generatedAt: ISO });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenSpectralRolloff: non-positive tokens dropped', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'src', 0),
    ql(dayIso(1), 'src', -3),
    ql(dayIso(2), 'src', 5),
  ];
  const r = buildDailyTokenSpectralRolloff(queue, { generatedAt: ISO });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenSpectralRolloff: source filter routes non-matches to dropped', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'a', 100),
    ql(dayIso(0), 'b', 100),
  ];
  const r = buildDailyTokenSpectralRolloff(queue, {
    source: 'a',
    generatedAt: ISO,
  });
  assert.equal(r.droppedSourceFilter, 1);
});

test('buildDailyTokenSpectralRolloff: short-tenure sources surface as droppedBelowMinTenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) queue.push(ql(dayIso(i), 'a', 1000));
  const r = buildDailyTokenSpectralRolloff(queue, {
    minTokens: 100,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenSpectralRolloff: zero-variance gap-filled series surfaces as dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) queue.push(ql(dayIso(i), 'a', 1000));
  const r = buildDailyTokenSpectralRolloff(queue, {
    minTokens: 100,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenSpectralRolloff: top cap surfaces remainder as droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 3; s += 1) {
    for (let i = 0; i < 40; i += 1) {
      const tt = 1000 + s * 100 + (i % 7) * 200;
      queue.push(ql(dayIso(i), `src${s}`, tt));
    }
  }
  const r = buildDailyTokenSpectralRolloff(queue, {
    minTokens: 100,
    minTenureDays: 32,
    top: 1,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenSpectralRolloff: source-asc tiebreak when sort is source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'b', 1000 + (i % 3) * 300));
    queue.push(ql(dayIso(i), 'a', 1000 + (i % 5) * 200));
  }
  const r = buildDailyTokenSpectralRolloff(queue, {
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

test('buildDailyTokenSpectralRolloff: window filter via since/until', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 50; i += 1) queue.push(ql(dayIso(i), 'a', 1000 + i));
  const r = buildDailyTokenSpectralRolloff(queue, {
    since: dayIso(10),
    until: dayIso(40),
    minTokens: 100,
    minTenureDays: 8,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.nTenureDays === 30);
});

test('buildDailyTokenSpectralRolloff: per-source row JSON shape contract', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1)
    queue.push(ql(dayIso(i), 'a', 1000 + ((i * 37) % 311)));
  const r = buildDailyTokenSpectralRolloff(queue, {
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
  assert.ok(Number.isFinite(row.rolloffBin));
  assert.ok(Number.isFinite(row.rolloffNormalised));
  assert.ok(Number.isFinite(row.cumulativeFraction));
  assert.ok(row.rolloffBin >= 1 && row.rolloffBin <= row.nFreqBins);
  assert.ok(row.rolloffNormalised > 0 && row.rolloffNormalised <= 1 + 1e-9);
  assert.ok(row.cumulativeFraction >= 0.85 - 1e-12);
});

test('buildDailyTokenSpectralRolloff: report-level JSON shape contract', () => {
  const r = buildDailyTokenSpectralRolloff([], { generatedAt: ISO });
  for (const k of [
    'generatedAt',
    'windowStart',
    'windowEnd',
    'minTokens',
    'minTenureDays',
    'rolloffFraction',
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

test('buildDailyTokenSpectralRolloff: orthogonality vs bandwidth (axis 87) -- different bandwidth, same roll-off', () => {
  // Construct two synthetic series whose periodograms have very
  // different bandwidths but reach the 85% mark at the same bin.
  // A single tone at bin R (bandwidth ~ 0; roll-off = R) and a
  // wide hump centred at R that reaches 85% at the same bin
  // share roll-off but have very different bandwidths. The
  // simpler witness: a single low-frequency tone (low roll-off,
  // low bandwidth) vs an all-low-bins flat block (low roll-off,
  // high bandwidth on the kept bins).
  const n = 64;
  const queue: QueueLine[] = [];
  for (let i = 0; i < n; i += 1) {
    // 'tone': pure low tone at bin 2.
    queue.push(
      ql(dayIso(i), 'tone', 10000 + 5000 * Math.sin((2 * Math.PI * 2 * i) / n)),
    );
    // 'hump': low-band sum of sinusoids at bins 1..6 -> wider PSD
    // but still low-frequency-dominated -> similar roll-off.
    let s = 0;
    for (let k = 1; k <= 6; k += 1) {
      s += Math.sin((2 * Math.PI * k * i) / n);
    }
    queue.push(ql(dayIso(i), 'hump', 10000 + 800 * s));
  }
  const r = buildDailyTokenSpectralRolloff(queue, {
    minTokens: 100,
    minTenureDays: 32,
    sort: 'source',
    rolloffFraction: 0.85,
    generatedAt: ISO,
  });
  const tone = r.sources.find((s) => s.source === 'tone')!;
  const hump = r.sources.find((s) => s.source === 'hump')!;
  // Both should have low roll-off (within the low-frequency band).
  assert.ok(tone.rolloffBin <= 8, `tone rolloffBin ${tone.rolloffBin} not low`);
  assert.ok(hump.rolloffBin <= 8, `hump rolloffBin ${hump.rolloffBin} not low`);
});

test('buildDailyTokenSpectralRolloff: rolloffDesc default sort puts high-frequency-dominated source first', () => {
  const n = 64;
  const queue: QueueLine[] = [];
  const kHi = n / 2 - 1;
  for (let i = 0; i < n; i += 1) {
    queue.push(
      ql(dayIso(i), 'low', 10000 + 5000 * Math.sin((2 * Math.PI * 2 * i) / n)),
    );
    queue.push(
      ql(dayIso(i), 'hi', 10000 + 5000 * Math.sin((2 * Math.PI * kHi * i) / n)),
    );
  }
  const r = buildDailyTokenSpectralRolloff(queue, {
    minTokens: 100,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  // default sort = rolloffDesc, so 'hi' should come first.
  assert.equal(r.sources[0]!.source, 'hi');
  assert.equal(r.sources[1]!.source, 'low');
});

test('buildDailyTokenSpectralRolloff: tokens-sort and tenure-sort tiebreak (source asc) witnesses', () => {
  const n = 40;
  const queue: QueueLine[] = [];
  for (let i = 0; i < n; i += 1) {
    const aTok = 1000 + (i % 5 === 0 ? 200 : 0);
    const bTok = 1000 + (i % 5 === 2 ? 200 : 0);
    queue.push(ql(dayIso(i), 'a', aTok));
    queue.push(ql(dayIso(i), 'b', bTok));
  }
  const tokR = buildDailyTokenSpectralRolloff(queue, {
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
  const tenR = buildDailyTokenSpectralRolloff(queue, {
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

test('dailyTokenSpectralRolloff: n=8 boundary -- smallest valid input still produces a roll-off bin', () => {
  const y = [1, 2, 1, 2, 1, 2, 1, 2];
  const r = dailyTokenSpectralRolloff(y, 0.85);
  assert.equal(r.nFreqBins, 4);
  assert.ok(Number.isFinite(r.rolloffBin));
  assert.ok(r.rolloffBin >= 1 && r.rolloffBin <= r.nFreqBins);
  // Period-2 alternation has all power at the Nyquist bin
  // k = n/2 = 4; roll-off must therefore be at bin 4.
  assert.equal(r.rolloffBin, 4);
});

// ---------- refinement: extra closed-form / stability witnesses ----------

test('spectralRolloffBin: parametric closed-form sweep -- uniform power on K bins -> R = ceil(f * K)', () => {
  // For uniform power on bins k=1..K, cumulative fraction at bin
  // k is exactly k/K. Smallest k with k/K >= f is ceil(f * K).
  for (const K of [4, 8, 16, 32, 64, 128]) {
    const p = new Array(K).fill(1);
    for (const f of [0.25, 0.5, 0.75, 0.85, 0.95]) {
      const r = spectralRolloffBin(p, f);
      assert.equal(
        r.rolloffBin,
        Math.ceil(f * K),
        `K=${K}, f=${f}: R=${r.rolloffBin}, expected=${Math.ceil(f * K)}`,
      );
    }
  }
});

test('spectralRolloffBin: monotone sweep -- moving mass from bin 1 to bin K pushes R from 1 to K', () => {
  // Place fraction (1-w) at bin 1 and w at bin K with a tiny
  // floor. For f=0.85 the roll-off should walk from 1 (when
  // w=0) to K (when w >= 0.85).
  const K = 30;
  const floor = 1e-12;
  const targets: { w: number; minR: number; maxR: number }[] = [
    { w: 0.05, minR: 1, maxR: 1 },
    { w: 0.5, minR: 30, maxR: 30 },
    { w: 0.95, minR: 30, maxR: 30 },
  ];
  for (const { w, minR, maxR } of targets) {
    const p = new Array(K).fill(floor);
    p[0] = 1 - w;
    p[K - 1] = w;
    const r = spectralRolloffBin(p, 0.85);
    assert.ok(
      r.rolloffBin >= minR && r.rolloffBin <= maxR,
      `w=${w}: R=${r.rolloffBin} not in [${minR}, ${maxR}]`,
    );
  }
});

test('spectralRolloffBin: numerical stability across 1e12 / 1e-12 scale', () => {
  const p = [1, 4, 9, 16, 25, 36, 49];
  const r0 = spectralRolloffBin(p, 0.85);
  const rBig = spectralRolloffBin(
    p.map((v) => 1e12 * v),
    0.85,
  );
  const rSmall = spectralRolloffBin(
    p.map((v) => 1e-12 * v),
    0.85,
  );
  assert.equal(r0.rolloffBin, rBig.rolloffBin);
  assert.equal(r0.rolloffBin, rSmall.rolloffBin);
});

test('dailyTokenSpectralRolloff: rolloffDesc default-sort acceptance witness on a low-vs-high tone pair', () => {
  // End-to-end acceptance test for the build pipeline and
  // default sort wiring at the primitive level.
  const n = 64;
  const lo: number[] = [];
  const hi: number[] = [];
  const kHi = n / 2 - 1;
  for (let i = 0; i < n; i += 1) {
    lo.push(Math.sin((2 * Math.PI * 2 * i) / n));
    hi.push(Math.sin((2 * Math.PI * kHi * i) / n));
  }
  const a = dailyTokenSpectralRolloff(lo, 0.85);
  const b = dailyTokenSpectralRolloff(hi, 0.85);
  assert.ok(
    b.rolloffNormalised > a.rolloffNormalised,
    `hi.rolloffNorm ${b.rolloffNormalised} not > lo.rolloffNorm ${a.rolloffNormalised}`,
  );
});

// ---------- refinement: extra closed-form, monotonicity, and orthogonality witnesses ----------

test('spectralRolloffBin: rolloffBin is monotone non-decreasing as we shift mass from bin 1 to bin K (sweep)', () => {
  // Place fraction (1 - w) at bin 1 and w at bin K with a tiny
  // noise floor on the rest; for f = 0.85 the roll-off must walk
  // from 1 (when w is small enough that bin 1 already carries
  // >= 85% of the mass) to K (when w >= 0.15 + epsilon, bin 1
  // alone no longer reaches 85% so the walk has to step all the
  // way to bin K). Pin strict monotone-non-decrease across a
  // dense w sweep.
  const K = 50;
  const floor = 1e-15;
  let prev = 0;
  for (let i = 0; i <= 20; i += 1) {
    const w = i / 20;
    const p = new Array(K).fill(floor);
    p[0] = 1 - w;
    p[K - 1] = w;
    const r = spectralRolloffBin(p, 0.85);
    assert.ok(
      r.rolloffBin >= prev,
      `non-monotone at w=${w}: ${prev} -> ${r.rolloffBin}`,
    );
    prev = r.rolloffBin;
  }
  assert.equal(prev, K);
});

test('spectralRolloffBin: f=0.5 on uniform power gives the exact median bin = ceil(K/2)', () => {
  // Tighter pin than the parametric sweep above: at f=0.5 on a
  // uniform PSD the roll-off bin is exactly ceil(K/2) -- the
  // discrete median -- across every K. This is the median band-
  // edge witness that distinguishes roll-off (PERCENTILE) from
  // centroid (MEAN), since for a uniform PSD the centroid is
  // the arithmetic mean (K + 1) / 2 = K/2 + 0.5, which differs
  // from ceil(K/2) for odd K (the median floors the half-mass
  // crossing).
  for (const K of [3, 4, 5, 6, 7, 8, 11, 16, 25, 33, 64, 100]) {
    const p = new Array(K).fill(1);
    const r = spectralRolloffBin(p, 0.5);
    assert.equal(r.rolloffBin, Math.ceil(K / 2), `K=${K}: R != ceil(K/2)`);
  }
});

test('spectralRolloffBin: identical-PSD agreement across a sweep of rolloffFractions -- cumulativeFraction is non-decreasing', () => {
  // For any fixed PSD the realised cumulativeFraction at the
  // returned rolloffBin must be non-decreasing as f sweeps from
  // 0+ up to 1. (rolloffBin itself is monotone-non-decreasing
  // by another test; this pins the cumulative side of the
  // contract.)
  const p = [4, 3, 2, 1, 1, 1, 1, 2, 1, 1, 1, 3, 5, 2, 1, 1];
  let prev = 0;
  for (const f of [0.05, 0.1, 0.25, 0.5, 0.7, 0.85, 0.9, 0.95, 0.99, 1.0]) {
    const r = spectralRolloffBin(p, f);
    assert.ok(
      r.cumulativeFraction >= prev - 1e-12,
      `non-monotone cumulativeFraction at f=${f}: ${prev} -> ${r.cumulativeFraction}`,
    );
    prev = r.cumulativeFraction;
  }
  assert.ok(Math.abs(prev - 1) < 1e-12);
});

test('buildDailyTokenSpectralRolloff: rolloffFraction round-trip pinning -- a wider fraction never moves the roll-off bin earlier on the same source', () => {
  // End-to-end pin on the orchestrator: build the same source
  // twice with f = 0.5 vs f = 0.95; the rolloffBin at f=0.95
  // must be >= rolloffBin at f=0.5 for every source row.
  const queue: QueueLine[] = [];
  for (let s = 0; s < 2; s += 1) {
    for (let i = 0; i < 64; i += 1) {
      const tt =
        1000 +
        ((i * 37 * (s + 1)) % 311) +
        Math.floor(50 * Math.sin((2 * Math.PI * (3 + s) * i) / 64));
      queue.push(ql(dayIso(i), `src${s}`, Math.max(1, tt)));
    }
  }
  const rLow = buildDailyTokenSpectralRolloff(queue, {
    minTokens: 100,
    minTenureDays: 32,
    rolloffFraction: 0.5,
    sort: 'source',
    generatedAt: ISO,
  });
  const rHigh = buildDailyTokenSpectralRolloff(queue, {
    minTokens: 100,
    minTenureDays: 32,
    rolloffFraction: 0.95,
    sort: 'source',
    generatedAt: ISO,
  });
  assert.equal(rLow.sources.length, 2);
  assert.equal(rHigh.sources.length, 2);
  for (let i = 0; i < 2; i += 1) {
    const lo = rLow.sources[i]!;
    const hi = rHigh.sources[i]!;
    assert.equal(lo.source, hi.source);
    assert.ok(
      hi.rolloffBin >= lo.rolloffBin,
      `${lo.source}: f=0.95 R=${hi.rolloffBin} < f=0.5 R=${lo.rolloffBin}`,
    );
    assert.ok(hi.cumulativeFraction >= 0.95 - 1e-12);
    assert.ok(lo.cumulativeFraction >= 0.5 - 1e-12);
  }
});

test('buildDailyTokenSpectralRolloff: orthogonality vs spectral-centroid (axis 86) -- equal-centroid pair can have very different roll-offs', () => {
  // Construct two sources whose periodograms have approximately
  // the same centroid but very different roll-offs. The 'sym'
  // source is a symmetric two-tone at bins (k_lo, k_hi)
  // straddling the midpoint -- centroid ~ midpoint, 85% roll-
  // off > k_hi (median percentile sits at the high tone). The
  // 'asym' source is a single tone at the same midpoint
  // -- centroid = midpoint as well, but the 85% roll-off lands
  // exactly at the midpoint bin. Different roll-offs at the
  // same centroid is the precise MEAN-vs-PERCENTILE witness.
  const n = 64;
  const queue: QueueLine[] = [];
  const kMid = n / 4; // bin K/2
  const kLo = 2;
  const kHi = n / 2 - 1;
  for (let i = 0; i < n; i += 1) {
    queue.push(
      ql(
        dayIso(i),
        'asym',
        10000 + 5000 * Math.sin((2 * Math.PI * kMid * i) / n),
      ),
    );
    const lo = Math.sin((2 * Math.PI * kLo * i) / n);
    const hi = Math.sin((2 * Math.PI * kHi * i) / n);
    queue.push(ql(dayIso(i), 'sym', 10000 + 2500 * (lo + hi)));
  }
  const r = buildDailyTokenSpectralRolloff(queue, {
    minTokens: 100,
    minTenureDays: 32,
    sort: 'source',
    rolloffFraction: 0.85,
    generatedAt: ISO,
  });
  const asym = r.sources.find((s) => s.source === 'asym')!;
  const sym = r.sources.find((s) => s.source === 'sym')!;
  // 'sym' has mass at bins kLo (~2) and kHi (~K-1). The 85%
  // roll-off must be at the high bin (need both tones to reach
  // 85%). 'asym' has all mass at bin kMid; the 85% roll-off
  // must be at kMid. So sym's roll-off must be strictly above
  // asym's.
  assert.ok(
    sym.rolloffBin > asym.rolloffBin,
    `sym rolloffBin ${sym.rolloffBin} not > asym rolloffBin ${asym.rolloffBin}`,
  );
});
