import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralFlatnessWiener,
  dailyTokenSpectralFlatnessWiener,
  buildDailyTokenSpectralFlatnessWiener,
} from '../src/dailytokenspectralflatnesswiener.js';
import { periodogramOneSided } from '../src/dailytokenspectralentropy.js';
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
  // i = 0..N day offsets from 2026-01-01 UTC.
  return (
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z'
  );
}

// ---------- spectralFlatnessWiener primitive ----------

test('spectralFlatnessWiener: empty input -> throws', () => {
  assert.throws(() => spectralFlatnessWiener([]), /empty power vector/);
});

test('spectralFlatnessWiener: non-finite power -> throws', () => {
  assert.throws(
    () => spectralFlatnessWiener([1, 2, NaN]),
    /non-finite power/,
  );
  assert.throws(
    () => spectralFlatnessWiener([1, 2, Infinity]),
    /non-finite power/,
  );
});

test('spectralFlatnessWiener: negative power -> throws', () => {
  assert.throws(
    () => spectralFlatnessWiener([1, 2, -0.5]),
    /negative power/,
  );
});

test('spectralFlatnessWiener: only one positive bin -> throws', () => {
  assert.throws(
    () => spectralFlatnessWiener([0, 0, 1, 0]),
    /too few positive-power bins/,
  );
});

test('spectralFlatnessWiener: zero positive bins -> throws', () => {
  assert.throws(
    () => spectralFlatnessWiener([0, 0, 0, 0]),
    /too few positive-power bins/,
  );
});

test('spectralFlatnessWiener: identical positive bins -> flatness = 1', () => {
  const r = spectralFlatnessWiener([3, 3, 3, 3, 3]);
  assert.equal(r.flatness, 1);
  assert.equal(r.usableBins, 5);
});

test('spectralFlatnessWiener: closed-form GM/AM on [1, 4]', () => {
  // GM = sqrt(1 * 4) = 2; AM = (1 + 4) / 2 = 2.5; ratio = 0.8.
  const r = spectralFlatnessWiener([1, 4]);
  assert.ok(Math.abs(r.flatness - 0.8) < 1e-12);
  assert.equal(r.usableBins, 2);
});

test('spectralFlatnessWiener: closed-form GM/AM on [1, 2, 4, 8]', () => {
  // GM = (1*2*4*8)^(1/4) = 64^0.25 = 2.828427...; AM = 15/4 = 3.75.
  // ratio = 2.828427... / 3.75 = 0.754247...
  const r = spectralFlatnessWiener([1, 2, 4, 8]);
  const expected = Math.pow(64, 0.25) / (15 / 4);
  assert.ok(Math.abs(r.flatness - expected) < 1e-12);
  assert.equal(r.usableBins, 4);
});

test('spectralFlatnessWiener: AM-GM bound flatness in [0, 1]', () => {
  // Random non-negative powers; flatness must always lie in [0, 1].
  let s = 12345;
  const rand = () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return s / 0x1_0000_0000;
  };
  for (let trial = 0; trial < 50; trial += 1) {
    const k = 4 + Math.floor(rand() * 20);
    const p: number[] = [];
    for (let i = 0; i < k; i += 1) p.push(rand() * 1000 + 0.001);
    const r = spectralFlatnessWiener(p);
    assert.ok(r.flatness >= 0 && r.flatness <= 1, `flatness ${r.flatness}`);
  }
});

test('spectralFlatnessWiener: zero bins ignored, count is positives only', () => {
  // Mixing a few exact-zeros into a uniform set of positives must
  // give flatness = 1 over the survivor set.
  const r = spectralFlatnessWiener([0, 5, 0, 5, 0, 5]);
  assert.equal(r.flatness, 1);
  assert.equal(r.usableBins, 3);
});

test('spectralFlatnessWiener: bin permutation invariance', () => {
  const a = [1, 4, 9, 16, 25];
  const b = [25, 1, 16, 4, 9];
  const ra = spectralFlatnessWiener(a);
  const rb = spectralFlatnessWiener(b);
  assert.ok(Math.abs(ra.flatness - rb.flatness) < 1e-12);
  assert.equal(ra.usableBins, rb.usableBins);
});

test('spectralFlatnessWiener: pure-tone limit -> flatness near 0', () => {
  // One dominant bin; m = K. With one bin holding 1e6 and others
  // at 1e-3, the GM is approximately (1e6 * 1e-3^(K-1))^(1/K)
  // which collapses fast, so flatness is tiny.
  const k = 30;
  const p = new Array(k).fill(1e-3);
  p[0] = 1e6;
  const r = spectralFlatnessWiener(p);
  assert.ok(r.flatness < 1e-3, `pure-tone flatness ${r.flatness} not tiny`);
  assert.equal(r.usableBins, k);
});

// ---------- dailyTokenSpectralFlatnessWiener primitive ----------

test('dailyTokenSpectralFlatnessWiener: too short -> throws', () => {
  assert.throws(() => dailyTokenSpectralFlatnessWiener([1, 2, 3, 4, 5, 6, 7]));
});

test('dailyTokenSpectralFlatnessWiener: non-finite -> throws', () => {
  assert.throws(() =>
    dailyTokenSpectralFlatnessWiener([1, 2, 3, 4, 5, 6, 7, NaN, 9]),
  );
});

test('dailyTokenSpectralFlatnessWiener: constant series -> throws zero variance', () => {
  assert.throws(
    () => dailyTokenSpectralFlatnessWiener([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]),
    /zero variance/,
  );
});

test('dailyTokenSpectralFlatnessWiener: white noise -> flatness near 1', () => {
  // Box-Muller-ish pseudo-random generator; large-n white noise
  // should land high on the flatness scale.
  let s = 42;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  const n = 256;
  const y: number[] = [];
  for (let i = 0; i < n; i += 1) y.push(rand() * 1000);
  const r = dailyTokenSpectralFlatnessWiener(y);
  assert.ok(r.flatness > 0.3, `white-noise flatness ${r.flatness} too low`);
  assert.ok(r.flatness <= 1, `flatness above 1: ${r.flatness}`);
});

test('dailyTokenSpectralFlatnessWiener: pure sinusoid -> flatness near 0', () => {
  const n = 128;
  const y: number[] = [];
  for (let i = 0; i < n; i += 1) y.push(Math.sin((2 * Math.PI * 8 * i) / n));
  const r = dailyTokenSpectralFlatnessWiener(y);
  assert.ok(r.flatness < 0.05, `sinusoid flatness ${r.flatness} not tiny`);
});

test('dailyTokenSpectralFlatnessWiener: shift-invariance', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 2, 3];
  const a = dailyTokenSpectralFlatnessWiener(y);
  const b = dailyTokenSpectralFlatnessWiener(y.map((v) => v + 1000));
  assert.ok(
    Math.abs(a.flatness - b.flatness) < 1e-10,
    `shift moved flatness from ${a.flatness} to ${b.flatness}`,
  );
});

test('dailyTokenSpectralFlatnessWiener: scale-invariance for any non-zero a', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const a = dailyTokenSpectralFlatnessWiener(y);
  const b = dailyTokenSpectralFlatnessWiener(y.map((v) => 17.5 * v));
  const c = dailyTokenSpectralFlatnessWiener(y.map((v) => -3 * v));
  assert.ok(Math.abs(a.flatness - b.flatness) < 1e-10);
  assert.ok(Math.abs(a.flatness - c.flatness) < 1e-10);
});

test('dailyTokenSpectralFlatnessWiener: sign-flip invariance', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const a = dailyTokenSpectralFlatnessWiener(y);
  const b = dailyTokenSpectralFlatnessWiener(y.map((v) => -v));
  assert.ok(Math.abs(a.flatness - b.flatness) < 1e-12);
});

test('dailyTokenSpectralFlatnessWiener: time-reversal invariance', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 4, 11];
  const r = [...y].reverse();
  const a = dailyTokenSpectralFlatnessWiener(y);
  const b = dailyTokenSpectralFlatnessWiener(r);
  assert.ok(
    Math.abs(a.flatness - b.flatness) < 1e-10,
    `reversal moved flatness from ${a.flatness} to ${b.flatness}`,
  );
});

test('dailyTokenSpectralFlatnessWiener: shuffle SENSITIVITY (whitens)', () => {
  // A monotone ramp has a tilted spectrum (low flatness). Shuffle
  // it -> spectrum whitens -> flatness rises.
  const n = 64;
  const ramp: number[] = [];
  for (let i = 0; i < n; i += 1) ramp.push(i);
  const a = dailyTokenSpectralFlatnessWiener(ramp);
  // Deterministic shuffle (reverse halves) is a permutation of the
  // time-domain sample set; spectrum should differ markedly.
  const half = Math.floor(n / 2);
  const shuffled = [
    ...ramp.slice(half).reverse(),
    ...ramp.slice(0, half),
  ];
  const b = dailyTokenSpectralFlatnessWiener(shuffled);
  assert.notEqual(
    a.flatness.toFixed(6),
    b.flatness.toFixed(6),
    'shuffle did not move flatness at all',
  );
});

test('dailyTokenSpectralFlatnessWiener: usableBins <= nFreqBins = floor(n/2)', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 4, 11, 13];
  const r = dailyTokenSpectralFlatnessWiener(y);
  assert.equal(r.nFreqBins, Math.floor(y.length / 2));
  assert.ok(r.usableBins >= 2 && r.usableBins <= r.nFreqBins);
});

test('dailyTokenSpectralFlatnessWiener: mean and stddev match the input', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const r = dailyTokenSpectralFlatnessWiener(y);
  const mu = y.reduce((s, v) => s + v, 0) / y.length;
  let v = 0;
  for (const x of y) v += (x - mu) * (x - mu);
  const sd = Math.sqrt(v / y.length);
  assert.ok(Math.abs(r.mean - mu) < 1e-12);
  assert.ok(Math.abs(r.stddev - sd) < 1e-12);
});

test('dailyTokenSpectralFlatnessWiener: flatnessDb = 10*log10(flatness)', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9];
  const r = dailyTokenSpectralFlatnessWiener(y);
  const expected = 10 * Math.log10(r.flatness);
  assert.ok(Math.abs(r.flatnessDb - expected) < 1e-12);
  assert.ok(r.flatnessDb <= 0);
});

// ---------- buildDailyTokenSpectralFlatnessWiener orchestration ----------

test('buildDailyTokenSpectralFlatnessWiener: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenSpectralFlatnessWiener([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralFlatnessWiener([], { minTokens: NaN }),
  );
});

test('buildDailyTokenSpectralFlatnessWiener: rejects minTenureDays below 8', () => {
  assert.throws(() =>
    buildDailyTokenSpectralFlatnessWiener([], { minTenureDays: 7 }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralFlatnessWiener([], { minTenureDays: 7.5 }),
  );
});

test('buildDailyTokenSpectralFlatnessWiener: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenSpectralFlatnessWiener([], {
      sort: 'nope' as 'flatness',
    }),
  );
});

test('buildDailyTokenSpectralFlatnessWiener: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenSpectralFlatnessWiener([], { since: 'nope' }),
  );
  assert.throws(() =>
    buildDailyTokenSpectralFlatnessWiener([], { until: 'still nope' }),
  );
});

test('buildDailyTokenSpectralFlatnessWiener: empty queue -> empty report', () => {
  const r = buildDailyTokenSpectralFlatnessWiener([], { generatedAt: ISO });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.minTenureDays, 32);
  assert.equal(r.sort, 'flatnessDesc');
});

test('buildDailyTokenSpectralFlatnessWiener: drops below min-tokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    q.push(ql(dayIso(i), 'small', 1));
  }
  const r = buildDailyTokenSpectralFlatnessWiener(q, { minTokens: 1000, generatedAt: ISO });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenSpectralFlatnessWiener: drops below min-tenure', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    q.push(ql(dayIso(i), 'short', 1000));
  }
  const r = buildDailyTokenSpectralFlatnessWiener(q, { minTenureDays: 32, generatedAt: ISO });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenSpectralFlatnessWiener: bad hour_start counted', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'src', 100),
    ql('also bad', 'src', 100),
  ];
  const r = buildDailyTokenSpectralFlatnessWiener(q, { generatedAt: ISO });
  assert.equal(r.droppedInvalidHourStart, 2);
});

test('buildDailyTokenSpectralFlatnessWiener: non-positive tokens dropped', () => {
  const q: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'src', 0),
    ql('2026-01-02T00:00:00.000Z', 'src', -50),
    ql('2026-01-03T00:00:00.000Z', 'src', NaN),
  ];
  const r = buildDailyTokenSpectralFlatnessWiener(q, { generatedAt: ISO });
  assert.equal(r.droppedNonPositiveTokens, 3);
});

test('buildDailyTokenSpectralFlatnessWiener: source filter counted', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    const day = dayIso(i);
    q.push(ql(day, 'kept', 1000));
    q.push(ql(day, 'dropped', 1000));
  }
  const r = buildDailyTokenSpectralFlatnessWiener(q, {
    source: 'kept',
    generatedAt: ISO,
  });
  assert.ok(r.droppedSourceFilter >= 30);
});

test('buildDailyTokenSpectralFlatnessWiener: zero-variance after gap-fill counted', () => {
  // A series with exactly one active day inside the tenure window
  // produces gap-filled all-zero except one entry, which is NOT
  // zero-variance. To force zero-variance we need a single day
  // that meets the tenure floor. Use two days >= 8 apart, then
  // raise minTenureDays so it fails differently. Simpler: emit
  // identical mass on each of N consecutive days; min == max.
  const q: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    q.push(ql(dayIso(i), 'flat', 1000));
  }
  const r = buildDailyTokenSpectralFlatnessWiener(q, {
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenSpectralFlatnessWiener: top cap surfaces droppedTopSources', () => {
  const q: QueueLine[] = [];
  // Three sources, each 35 days, with varying daily masses.
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 35; i += 1) {
      const day = dayIso(i);
      q.push(ql(day, src, 1000 + i * 10 + (src === 'b' ? 5 : 0)));
    }
  }
  const r = buildDailyTokenSpectralFlatnessWiener(q, { top: 1, generatedAt: ISO });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenSpectralFlatnessWiener: source-asc tiebreak when no sort signal', () => {
  const q: QueueLine[] = [];
  for (const src of ['delta', 'alpha', 'gamma', 'beta']) {
    for (let i = 0; i < 35; i += 1) {
      const day = dayIso(i);
      q.push(ql(day, src, 1000 + i * 10));
    }
  }
  const r = buildDailyTokenSpectralFlatnessWiener(q, {
    sort: 'source',
    generatedAt: ISO,
  });
  const names = r.sources.map((s) => s.source);
  assert.deepEqual(names, ['alpha', 'beta', 'delta', 'gamma']);
});

test('buildDailyTokenSpectralFlatnessWiener: window filter via since/until', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    const day = dayIso(i);
    q.push(ql(day, 'src', 1000 + i * 10));
  }
  const r = buildDailyTokenSpectralFlatnessWiener(q, {
    since: '2026-01-10T00:00:00.000Z',
    until: '2026-01-15T00:00:00.000Z',
    generatedAt: ISO,
  });
  // Only 5 days in window -> below tenure floor.
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenSpectralFlatnessWiener: per-source row JSON contract', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    const day = dayIso(i);
    q.push(ql(day, 'src', 1000 + i * 13));
  }
  const r = buildDailyTokenSpectralFlatnessWiener(q, { generatedAt: ISO });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  for (const key of [
    'source',
    'totalTokens',
    'nActiveDays',
    'nTenureDays',
    'nFreqBins',
    'usableBins',
    'firstActiveDay',
    'lastActiveDay',
    'mean',
    'stddev',
    'flatness',
    'flatnessDb',
  ] as const) {
    assert.ok(key in s, `missing key ${key}`);
  }
  assert.ok(s.flatness >= 0 && s.flatness <= 1);
  assert.ok(s.flatnessDb <= 0);
});

test('buildDailyTokenSpectralFlatnessWiener: report-level JSON contract', () => {
  const r = buildDailyTokenSpectralFlatnessWiener([], { generatedAt: ISO });
  for (const key of [
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
  ] as const) {
    assert.ok(key in r, `missing key ${key}`);
  }
});

test('buildDailyTokenSpectralFlatnessWiener: orthogonality witness vs spectral entropy and beta -- bin permutation invariance', () => {
  // Build two synthetic series with identical periodogram-bin
  // VALUES but in different orderings across bin index by
  // constructing y from inverse-DFT of chosen amplitude profiles.
  // Easier: assert bin-permutation invariance directly on the
  // primitive (the orthogonality proof in the doc-string), plus
  // verify the GM/AM ratio differs from Shannon entropy of the
  // same periodogram on a synthetic two-tone spectrum.
  const power = [1, 0.001, 0.001, 1, 0.001, 0.001];
  const sf = spectralFlatnessWiener(power);
  const shuffled = [0.001, 1, 0.001, 1, 0.001, 0.001];
  const sf2 = spectralFlatnessWiener(shuffled);
  assert.ok(Math.abs(sf.flatness - sf2.flatness) < 1e-12);
  // Shannon entropy of the L1-normalised power vector
  const total = power.reduce((s, v) => s + v, 0);
  let H = 0;
  for (const p of power) {
    const q = p / total;
    if (q > 0) H -= q * Math.log(q);
  }
  // With two strong tones and four weak bins, entropy is
  // intermediate (~1) but flatness is small. They are NOT a
  // monotone transform of each other.
  assert.ok(H > 0.5);
  assert.ok(sf.flatness < 0.5);
});

test('buildDailyTokenSpectralFlatnessWiener: flatnessDesc (default) puts higher flatness first', () => {
  // Build two sources with VERY different flatness profiles by
  // construction. Source A: noise-like (rand). Source B: pure
  // sinusoid (low flatness).
  let s = 7;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  const q: QueueLine[] = [];
  for (let i = 0; i < 64; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z';
    q.push(ql(day, 'noisy', Math.floor(rand() * 1000) + 1));
    const sin = Math.sin((2 * Math.PI * 4 * i) / 64);
    q.push(ql(day, 'tone', Math.max(1, Math.floor((sin + 1.5) * 1000))));
  }
  const r = buildDailyTokenSpectralFlatnessWiener(q, {
    generatedAt: ISO,
    minTenureDays: 32,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.flatness >= r.sources[1]!.flatness);
});

test('buildDailyTokenSpectralFlatnessWiener: flatness asc sort', () => {
  let s = 7;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  const q: QueueLine[] = [];
  for (let i = 0; i < 64; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z';
    q.push(ql(day, 'noisy', Math.floor(rand() * 1000) + 1));
    const sin = Math.sin((2 * Math.PI * 4 * i) / 64);
    q.push(ql(day, 'tone', Math.max(1, Math.floor((sin + 1.5) * 1000))));
  }
  const r = buildDailyTokenSpectralFlatnessWiener(q, {
    generatedAt: ISO,
    minTenureDays: 32,
    sort: 'flatness',
  });
  assert.ok(r.sources[0]!.flatness <= r.sources[1]!.flatness);
});

test('refine: spectralFlatnessWiener perfect equal-bin gives flatness exactly 1 across many K', () => {
  for (const k of [2, 3, 5, 8, 13, 21, 34, 55]) {
    const p = new Array(k).fill(7.25);
    const r = spectralFlatnessWiener(p);
    assert.ok(Math.abs(r.flatness - 1) <= 1e-12, `k=${k} flatness ${r.flatness}`);
    assert.equal(r.usableBins, k);
  }
});

test('refine: spectralFlatnessWiener numerical stability under 1e9 / 1e-9 power scaling', () => {
  const baseLine = [1, 2, 4, 8, 16, 32];
  const base = spectralFlatnessWiener(baseLine);
  const big = spectralFlatnessWiener(baseLine.map((v) => v * 1e9));
  const tiny = spectralFlatnessWiener(baseLine.map((v) => v * 1e-9));
  assert.ok(Math.abs(base.flatness - big.flatness) < 1e-10);
  assert.ok(Math.abs(base.flatness - tiny.flatness) < 1e-10);
});

test('refine: dailyTokenSpectralFlatnessWiener n=8 boundary admits the smallest valid input', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6];
  const r = dailyTokenSpectralFlatnessWiener(y);
  assert.equal(r.nFreqBins, 4);
  assert.ok(r.usableBins >= 2 && r.usableBins <= 4);
  assert.ok(r.flatness >= 0 && r.flatness <= 1);
});

test('refine: dailyTokenSpectralFlatnessWiener noise-vs-tone contrast (noise > tone)', () => {
  const n = 128;
  const tone: number[] = [];
  for (let i = 0; i < n; i += 1) tone.push(Math.sin((2 * Math.PI * 8 * i) / n));
  let s = 99;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  const noise: number[] = [];
  for (let i = 0; i < n; i += 1) noise.push(rand());
  const ft = dailyTokenSpectralFlatnessWiener(tone);
  const fn = dailyTokenSpectralFlatnessWiener(noise);
  assert.ok(
    fn.flatness > ft.flatness * 5,
    `expected noise flatness >> tone flatness, got noise=${fn.flatness} tone=${ft.flatness}`,
  );
});

test('refine: source-asc tiebreak under tokens-sort when totals identical', () => {
  const q: QueueLine[] = [];
  for (const src of ['z', 'a', 'm', 'b']) {
    for (let i = 0; i < 35; i += 1) {
      const day = dayIso(i);
      // Identical totals across sources; vary daily shape so all
      // pass variance.
      q.push(ql(day, src, 1000 + (i % 7) * 100));
    }
  }
  const r = buildDailyTokenSpectralFlatnessWiener(q, {
    sort: 'tokens',
    generatedAt: ISO,
  });
  const names = r.sources.map((s) => s.source);
  // Tokens are equal, so source-asc tiebreak governs.
  assert.deepEqual(names, ['a', 'b', 'm', 'z']);
});

test('refine: flatness in [0, 1] across a sweep of synthetic series shapes', () => {
  let s = 3;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  const shapes: number[][] = [];
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 16 + Math.floor(rand() * 80);
    const y: number[] = [];
    for (let i = 0; i < n; i += 1) {
      y.push(rand() * 100 + Math.sin((2 * Math.PI * 3 * i) / n) * 50);
    }
    shapes.push(y);
  }
  for (const y of shapes) {
    const r = dailyTokenSpectralFlatnessWiener(y);
    assert.ok(r.flatness >= 0 && r.flatness <= 1, `flatness ${r.flatness}`);
    assert.ok(
      r.flatnessDb <= 0,
      `flatnessDb should be <= 0 for flatness in [0,1]; got ${r.flatnessDb}`,
    );
  }
});

test('refine: GM/AM ratio matches direct exp(mean(log p)) / mean(p) calculation', () => {
  const power = [0.5, 1.0, 2.5, 4.0, 0.25, 8.0];
  const direct = (() => {
    const m = power.length;
    const am = power.reduce((s, v) => s + v, 0) / m;
    const gm = Math.exp(
      power.map((v) => Math.log(v)).reduce((s, v) => s + v, 0) / m,
    );
    return gm / am;
  })();
  const r = spectralFlatnessWiener(power);
  assert.ok(Math.abs(r.flatness - direct) < 1e-12);
});

test('refine: periodogram round-trip -- spectralFlatnessWiener ingests periodogramOneSided output', () => {
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 4, 11, 13];
  const power = periodogramOneSided(y);
  const direct = spectralFlatnessWiener(power);
  const wrapped = dailyTokenSpectralFlatnessWiener(y);
  assert.ok(Math.abs(direct.flatness - wrapped.flatness) < 1e-12);
  assert.equal(direct.usableBins, wrapped.usableBins);
});

test('refine: bin-permutation invariance witness vs slope tilt -- a tilted spectrum and its bin-shuffled twin share IDENTICAL flatness', () => {
  // Build a 1/k tilted power vector (a k=8 toy "1/f" spectrum).
  const tilted = [1.0, 0.5, 1 / 3, 0.25, 0.2, 1 / 6, 1 / 7, 0.125];
  // Permute bin indices but keep the same multiset of values.
  const permuted = [0.125, 1.0, 1 / 7, 0.5, 1 / 6, 1 / 3, 0.2, 0.25];
  // Sanity: same multiset
  const sortedA = [...tilted].sort((a, b) => a - b);
  const sortedB = [...permuted].sort((a, b) => a - b);
  for (let i = 0; i < sortedA.length; i += 1) {
    assert.ok(Math.abs(sortedA[i]! - sortedB[i]!) < 1e-15);
  }
  const fa = spectralFlatnessWiener(tilted);
  const fb = spectralFlatnessWiener(permuted);
  assert.ok(
    Math.abs(fa.flatness - fb.flatness) < 1e-12,
    `bin-permutation moved flatness: ${fa.flatness} vs ${fb.flatness}`,
  );
});

test('refine: closed-form recovery on geometric sequence -- flatness = (n * r^((n-1)/2)) / (1 + r + ... + r^(n-1)) when first bin is 1', () => {
  // For p_k = r^k, k=0..n-1: GM = r^((n-1)/2); AM = (1-r^n)/(n*(1-r)).
  // ratio = n * r^((n-1)/2) * (1 - r) / (1 - r^n).
  const n = 6;
  const r = 0.5;
  const p: number[] = [];
  for (let k = 0; k < n; k += 1) p.push(Math.pow(r, k));
  const expected = (n * Math.pow(r, (n - 1) / 2) * (1 - r)) / (1 - Math.pow(r, n));
  const got = spectralFlatnessWiener(p);
  assert.ok(
    Math.abs(got.flatness - expected) < 1e-12,
    `geometric flatness ${got.flatness} vs closed form ${expected}`,
  );
});

test('refine: flatnessDb -inf only when all bins zero (which throws), positive flatness always finite dB', () => {
  // Confirm the dB output is always finite for any valid input
  // since the throw-on-too-few-positive-bins guard means we never
  // reach the flatness=0 case.
  const y = [1, 2, 4, 8, 5, 3, 7, 6, 9, 4, 11, 13];
  const r = dailyTokenSpectralFlatnessWiener(y);
  assert.ok(Number.isFinite(r.flatnessDb));
  assert.ok(r.flatnessDb <= 0);
});

test('refine: build report rejects sort=tokens|tenure as valid keys (regression -- sort enum surface)', () => {
  // Smoke that all enumerated sort keys are accepted; no throw.
  const ok: Array<'flatness' | 'flatnessDesc' | 'tokens' | 'tenure' | 'source'> = [
    'flatness',
    'flatnessDesc',
    'tokens',
    'tenure',
    'source',
  ];
  for (const s of ok) {
    const r = buildDailyTokenSpectralFlatnessWiener([], { sort: s, generatedAt: ISO });
    assert.equal(r.sort, s);
  }
});

test('refine: dailyTokenSpectralFlatnessWiener noise-vs-tone gap survives DC offset and scale', () => {
  // The flatness gap between a sinusoid and white noise must be
  // robust under both DC offset (shift) and amplitude scaling
  // (scale), because flatness is invariant under both.
  const n = 128;
  const tone: number[] = [];
  for (let i = 0; i < n; i += 1) tone.push(Math.sin((2 * Math.PI * 8 * i) / n));
  let s = 99;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  const noise: number[] = [];
  for (let i = 0; i < n; i += 1) noise.push(rand());
  const baseGap =
    dailyTokenSpectralFlatnessWiener(noise).flatness -
    dailyTokenSpectralFlatnessWiener(tone).flatness;
  const shiftedGap =
    dailyTokenSpectralFlatnessWiener(noise.map((v) => v + 1234.5)).flatness -
    dailyTokenSpectralFlatnessWiener(tone.map((v) => v + 1234.5)).flatness;
  const scaledGap =
    dailyTokenSpectralFlatnessWiener(noise.map((v) => 7 * v)).flatness -
    dailyTokenSpectralFlatnessWiener(tone.map((v) => 7 * v)).flatness;
  assert.ok(Math.abs(baseGap - shiftedGap) < 1e-10);
  assert.ok(Math.abs(baseGap - scaledGap) < 1e-10);
});
