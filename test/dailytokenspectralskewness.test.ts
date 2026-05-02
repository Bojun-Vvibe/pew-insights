import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralSkewness,
  dailyTokenSpectralSkewness,
  buildDailyTokenSpectralSkewness,
} from '../src/dailytokenspectralskewness.js';
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

// ---------- spectralSkewness primitive ----------

test('spectralSkewness: empty input -> throws', () => {
  assert.throws(() => spectralSkewness([]), /empty power vector/);
});

test('spectralSkewness: non-finite power -> throws', () => {
  assert.throws(
    () => spectralSkewness([1, 2, 3, NaN]),
    /non-finite power/,
  );
  assert.throws(
    () => spectralSkewness([1, 2, 3, Infinity]),
    /non-finite power/,
  );
  assert.throws(
    () => spectralSkewness([1, 2, 3, -Infinity]),
    /non-finite power/,
  );
});

test('spectralSkewness: negative power -> throws', () => {
  assert.throws(
    () => spectralSkewness([1, 2, 3, -0.5]),
    /negative power/,
  );
});

test('spectralSkewness: only one positive bin -> throws', () => {
  assert.throws(
    () => spectralSkewness([0, 0, 1, 0]),
    /too few positive-power bins/,
  );
});

test('spectralSkewness: only two positive bins -> throws', () => {
  assert.throws(
    () => spectralSkewness([0, 1, 1, 0]),
    /too few positive-power bins/,
  );
});

test('spectralSkewness: zero positive bins -> throws', () => {
  assert.throws(
    () => spectralSkewness([0, 0, 0, 0]),
    /too few positive-power bins/,
  );
});

test('spectralSkewness: symmetric three-bin spectrum -> skewness ~ 0', () => {
  // Bins (1, 2, 3) with equal power (1, 1, 1); mu = 2;
  // (k - mu)^3 in {-1, 0, 1} -> third moment = 0; skewness = 0.
  const r = spectralSkewness([1, 1, 1]);
  assert.equal(r.usableBins, 3);
  assert.ok(Math.abs(r.centroidBin - 2) < 1e-12);
  assert.ok(Math.abs(r.skewness) < 1e-12);
});

test('spectralSkewness: symmetric power-weighted three-bin -> skewness ~ 0', () => {
  // Bins (1, 2, 3) with power (5, 1, 5); mu = (5+2+15)/11 = 2;
  // (k-mu)^3 = (-1, 0, 1); third moment = (-5 + 0 + 5)/11 = 0.
  const r = spectralSkewness([5, 1, 5]);
  assert.ok(Math.abs(r.centroidBin - 2) < 1e-12);
  assert.ok(Math.abs(r.skewness) < 1e-12);
});

test('spectralSkewness: right-skewed two-tone (mass low, tail high) -> positive skew', () => {
  // bins (1..5), power (4, 4, 0, 0, 1): centroid pulled below
  // 3, with a right-tail at bin 5. Compute by hand:
  //   total = 9; mu = (4+8+0+0+5)/9 = 17/9 ~ 1.889.
  // The right-tail (k=5) is far above mu; the bulk near k=1,2.
  // Therefore third central moment > 0 => skewness > 0.
  const r = spectralSkewness([4, 4, 0, 0, 1]);
  assert.equal(r.usableBins, 3);
  assert.ok(r.centroidBin < 3);
  assert.ok(r.skewness > 0, `expected positive skew, got ${r.skewness}`);
});

test('spectralSkewness: left-skewed two-tone (tail low, mass high) -> negative skew', () => {
  // Mirror of above: power (1, 0, 0, 4, 4) -> centroid pulled
  // toward bin 4; left tail at bin 1; expect skewness < 0.
  const r = spectralSkewness([1, 0, 0, 4, 4]);
  assert.ok(r.centroidBin > 3);
  assert.ok(r.skewness < 0, `expected negative skew, got ${r.skewness}`);
});

test('spectralSkewness: bin-reversal flips sign, preserves magnitude', () => {
  // p = [4, 4, 0, 0, 1] mirrored to [1, 0, 0, 4, 4]; |skewness|
  // must match; signs must be opposite.
  const a = spectralSkewness([4, 4, 0, 0, 1]);
  const b = spectralSkewness([1, 0, 0, 4, 4]);
  assert.ok(Math.abs(a.skewness + b.skewness) < 1e-12);
  assert.ok(Math.abs(Math.abs(a.skewness) - Math.abs(b.skewness)) < 1e-12);
});

test('spectralSkewness: scale-invariant for any non-zero a', () => {
  const p = [1, 2, 3, 4, 5];
  const a = spectralSkewness(p);
  for (const s of [0.001, 1, 7, 1e6]) {
    const r = spectralSkewness(p.map((x) => x * s));
    assert.ok(Math.abs(r.skewness - a.skewness) < 1e-9);
    assert.ok(Math.abs(r.centroidBin - a.centroidBin) < 1e-9);
    assert.ok(Math.abs(r.bandwidth - a.bandwidth) < 1e-9);
  }
});

test('spectralSkewness: bin-permutation -- shuffling changes skewness (key witness vs crest/flatness)', () => {
  // Same multiset, different bin order -> skewness moves; this
  // is the precise orthogonality witness vs crest/flatness/
  // entropy (which are bin-permutation INVARIANT).
  const a = spectralSkewness([4, 4, 0, 0, 1]);
  const b = spectralSkewness([0, 4, 1, 4, 0]);
  assert.ok(Math.abs(a.skewness - b.skewness) > 1e-6);
});

test('spectralSkewness: known closed form on uniform 5 bins', () => {
  // Uniform power on bins 1..5 -> mu = 3; sigma^2 = 2; third
  // central moment = 0 (symmetric); skewness = 0.
  const r = spectralSkewness([1, 1, 1, 1, 1]);
  assert.ok(Math.abs(r.centroidBin - 3) < 1e-12);
  assert.ok(Math.abs(r.bandwidth - Math.sqrt(2)) < 1e-12);
  assert.ok(Math.abs(r.skewness) < 1e-12);
});

test('spectralSkewness: closed form on (1,1,1,4) bins -> compute by hand', () => {
  // Bins 1..4, power (1,1,1,4); total=7; mu = (1+2+3+16)/7 =
  // 22/7 ~ 3.1429.
  // (k-mu): {-2.1429, -1.1429, -0.1429, 0.8571}
  // (k-mu)^2 weighted: 4.5918 + 1.3061 + 0.0204 + 4*0.7347 =
  //   4.5918 + 1.3061 + 0.0204 + 2.9388 = 8.8571 / 7 = 1.2653
  // sigma = sqrt(1.2653) ~ 1.1249.
  // (k-mu)^3 weighted: -9.8367 - 1.4927 - 0.0029 + 4*0.6297 =
  //   -9.8367 - 1.4927 - 0.0029 + 2.5188 = -8.8135 / 7 = -1.2591
  // skewness = -1.2591 / (1.1249^3) = -1.2591 / 1.4234 ~ -0.8846
  const r = spectralSkewness([1, 1, 1, 4]);
  assert.ok(Math.abs(r.centroidBin - 22 / 7) < 1e-9);
  assert.ok(r.skewness < 0);
  assert.ok(Math.abs(r.skewness - (-0.8846)) < 1e-2);
});

// ---------- dailyTokenSpectralSkewness primitive ----------

test('dailyTokenSpectralSkewness: too short -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralSkewness([1, 2, 3, 4, 5, 6, 7]),
    /too short/,
  );
});

test('dailyTokenSpectralSkewness: non-finite -> throws', () => {
  assert.throws(
    () =>
      dailyTokenSpectralSkewness([1, 2, 3, 4, 5, 6, 7, NaN]),
    /finite values/,
  );
});

test('dailyTokenSpectralSkewness: zero variance -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralSkewness(new Array(16).fill(7)),
    /zero variance/,
  );
});

test('dailyTokenSpectralSkewness: pure low-frequency sinusoid -> definite skewness sign', () => {
  // Build a cosine at k=2 of N=64; periodogram has a strong
  // peak at bin 2. With one dominant bin near the LOW end of
  // [1, 32], centroid ~ 2; the long right tail of leakage
  // pulls third moment positive -> right-skewed.
  const N = 64;
  const k0 = 2;
  const y: number[] = [];
  for (let i = 0; i < N; i += 1) {
    y.push(100 + 10 * Math.cos((2 * Math.PI * k0 * i) / N));
  }
  const r = dailyTokenSpectralSkewness(y);
  assert.equal(r.nFreqBins, N / 2);
  assert.ok(r.centroidBin < 10);
  assert.ok(
    r.skewness > 0,
    `expected positive skew on low-tone series, got ${r.skewness}`,
  );
});

test('dailyTokenSpectralSkewness: pure high-frequency sinusoid -> definite skewness sign', () => {
  // Tone at high bin (near Nyquist) -> centroid ~ k0; long
  // left tail of leakage pulls third moment negative.
  const N = 64;
  const k0 = 30;
  const y: number[] = [];
  for (let i = 0; i < N; i += 1) {
    y.push(100 + 10 * Math.cos((2 * Math.PI * k0 * i) / N));
  }
  const r = dailyTokenSpectralSkewness(y);
  assert.ok(r.centroidBin > 20);
  assert.ok(
    r.skewness < 0,
    `expected negative skew on high-tone series, got ${r.skewness}`,
  );
});

test('dailyTokenSpectralSkewness: scale-invariance on real series', () => {
  const y = [10, 30, 5, 22, 18, 7, 14, 9, 25, 11, 8, 19, 6, 20, 13, 16];
  const a = dailyTokenSpectralSkewness(y);
  const b = dailyTokenSpectralSkewness(y.map((v) => 1000 * v));
  assert.ok(Math.abs(a.skewness - b.skewness) < 1e-9);
  assert.ok(Math.abs(a.centroidBin - b.centroidBin) < 1e-9);
});

test('dailyTokenSpectralSkewness: shift-invariance on real series', () => {
  const y = [10, 30, 5, 22, 18, 7, 14, 9, 25, 11, 8, 19, 6, 20, 13, 16];
  const a = dailyTokenSpectralSkewness(y);
  const b = dailyTokenSpectralSkewness(y.map((v) => v + 12345));
  // Shift only moves the DC bin; non-DC bins are identical.
  assert.ok(Math.abs(a.skewness - b.skewness) < 1e-9);
  assert.ok(Math.abs(a.centroidBin - b.centroidBin) < 1e-9);
});

test('dailyTokenSpectralSkewness: time-reversal-invariance', () => {
  const y = [10, 30, 5, 22, 18, 7, 14, 9, 25, 11, 8, 19, 6, 20, 13, 16];
  const a = dailyTokenSpectralSkewness(y);
  const b = dailyTokenSpectralSkewness([...y].reverse());
  assert.ok(Math.abs(a.skewness - b.skewness) < 1e-9);
});

test('dailyTokenSpectralSkewness: sign-flip-invariance', () => {
  const y = [10, 30, 5, 22, 18, 7, 14, 9, 25, 11, 8, 19, 6, 20, 13, 16];
  const a = dailyTokenSpectralSkewness(y);
  const b = dailyTokenSpectralSkewness(y.map((v) => -v));
  assert.ok(Math.abs(a.skewness - b.skewness) < 1e-9);
});

test('dailyTokenSpectralSkewness: bandwidth and centroid finite and positive', () => {
  const y = [10, 30, 5, 22, 18, 7, 14, 9, 25, 11, 8, 19, 6, 20, 13, 16];
  const r = dailyTokenSpectralSkewness(y);
  assert.ok(r.bandwidth > 0);
  assert.ok(r.centroidBin > 0);
  assert.ok(Number.isFinite(r.skewness));
});

// ---------- buildDailyTokenSpectralSkewness orchestrator ----------

test('build: bad option validation', () => {
  assert.throws(
    () => buildDailyTokenSpectralSkewness([], { minTokens: -1 }),
    /minTokens/,
  );
  assert.throws(
    () => buildDailyTokenSpectralSkewness([], { minTenureDays: 7 }),
    /minTenureDays/,
  );
  assert.throws(
    () =>
      buildDailyTokenSpectralSkewness([], {
        minTenureDays: 8.5 as unknown as number,
      }),
    /minTenureDays/,
  );
  assert.throws(
    () => buildDailyTokenSpectralSkewness([], { top: -1 }),
    /top/,
  );
  assert.throws(
    () =>
      buildDailyTokenSpectralSkewness([], {
        sort: 'bogus' as unknown as 'skew',
      }),
    /sort/,
  );
  assert.throws(
    () => buildDailyTokenSpectralSkewness([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () => buildDailyTokenSpectralSkewness([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('build: empty queue -> empty report with zero counters', () => {
  const r = buildDailyTokenSpectralSkewness([], { generatedAt: ISO });
  assert.equal(r.generatedAt, ISO);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedInvalidHourStart, 0);
  assert.equal(r.droppedNonPositiveTokens, 0);
  assert.equal(r.droppedSparseSources, 0);
  assert.equal(r.droppedBelowMinTenure, 0);
  assert.equal(r.droppedZeroBandwidth, 0);
  assert.equal(r.sort, 'absSkewDesc');
});

test('build: drop counters wired correctly', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql(dayIso(0), 'a', 0),
    ql(dayIso(1), 'a', -5),
  ];
  const r = buildDailyTokenSpectralSkewness(queue, {
    generatedAt: ISO,
    minTokens: 0,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources.length, 0);
});

test('build: source filter wires droppedSourceFilter and isolates the survivor', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'a', 100 + (i % 7) * 10));
    queue.push(ql(dayIso(i), 'b', 200 + (i % 5) * 5));
  }
  const r = buildDailyTokenSpectralSkewness(queue, {
    generatedAt: ISO,
    source: 'a',
    minTokens: 0,
  });
  assert.equal(r.droppedSourceFilter, 40);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.source, 'a');
});

test('build: minTokens shed -> droppedSparseSources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'tiny', 1));
    queue.push(ql(dayIso(i), 'big', 1000 + (i % 7) * 100));
  }
  const r = buildDailyTokenSpectralSkewness(queue, {
    generatedAt: ISO,
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('build: minTenureDays shed -> droppedBelowMinTenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'short', 100));
  }
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'long', 100 + (i % 7) * 10));
  }
  const r = buildDailyTokenSpectralSkewness(queue, {
    generatedAt: ISO,
    minTokens: 0,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'long');
  assert.equal(r.sources[0]!.nTenureDays, 40);
});

test('build: zero-variance source -> droppedZeroVariance', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 100));
  }
  const r = buildDailyTokenSpectralSkewness(queue, {
    generatedAt: ISO,
    minTokens: 0,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('build: sort + top wiring', () => {
  // Two sources with very different skewness signs.
  const queue: QueueLine[] = [];
  const N = 64;
  for (let i = 0; i < N; i += 1) {
    // 'low': cosine at low bin -> right-skewed PSD.
    queue.push(
      ql(
        dayIso(i),
        'low',
        Math.round(1000 + 200 * Math.cos((2 * Math.PI * 2 * i) / N)),
      ),
    );
    // 'high': cosine at high bin -> left-skewed PSD.
    queue.push(
      ql(
        dayIso(i),
        'high',
        Math.round(1000 + 200 * Math.cos((2 * Math.PI * 30 * i) / N)),
      ),
    );
  }
  const desc = buildDailyTokenSpectralSkewness(queue, {
    generatedAt: ISO,
    minTokens: 0,
    sort: 'skewDesc',
  });
  assert.equal(desc.sources.length, 2);
  // skewDesc: most positive first -> 'low' first.
  assert.equal(desc.sources[0]!.source, 'low');
  assert.equal(desc.sources[1]!.source, 'high');
  assert.ok(desc.sources[0]!.skewness > desc.sources[1]!.skewness);

  const asc = buildDailyTokenSpectralSkewness(queue, {
    generatedAt: ISO,
    minTokens: 0,
    sort: 'skew',
  });
  // skew asc: most negative first -> 'high' first.
  assert.equal(asc.sources[0]!.source, 'high');
  assert.equal(asc.sources[1]!.source, 'low');

  const top1 = buildDailyTokenSpectralSkewness(queue, {
    generatedAt: ISO,
    minTokens: 0,
    top: 1,
    sort: 'skewDesc',
  });
  assert.equal(top1.sources.length, 1);
  assert.equal(top1.droppedTopSources, 1);
  assert.equal(top1.sources[0]!.source, 'low');
});

test('build: sort=absSkewDesc orders by |skew| desc', () => {
  const queue: QueueLine[] = [];
  const N = 64;
  for (let i = 0; i < N; i += 1) {
    // Two sources: one with strong negative skew, one with mild
    // positive skew. absSkewDesc must put the stronger one
    // first regardless of sign.
    queue.push(
      ql(
        dayIso(i),
        'mild',
        Math.round(1000 + 50 * Math.cos((2 * Math.PI * 4 * i) / N)),
      ),
    );
    queue.push(
      ql(
        dayIso(i),
        'strong',
        Math.round(1000 + 200 * Math.cos((2 * Math.PI * 31 * i) / N)),
      ),
    );
  }
  const r = buildDailyTokenSpectralSkewness(queue, {
    generatedAt: ISO,
    minTokens: 0,
    sort: 'absSkewDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(
    Math.abs(r.sources[0]!.skewness) >= Math.abs(r.sources[1]!.skewness),
  );
});

test('build: sort=tokens orders by total tokens desc', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'a', 100 + (i % 7)));
    queue.push(ql(dayIso(i), 'b', 1_000_000 + (i % 5)));
  }
  const r = buildDailyTokenSpectralSkewness(queue, {
    generatedAt: ISO,
    minTokens: 0,
    sort: 'tokens',
  });
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[1]!.source, 'a');
});

test('build: sort=tenure orders by tenure desc; ties -> source asc', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 50; i += 1) {
    queue.push(ql(dayIso(i), 'a', 100 + (i % 7)));
    queue.push(ql(dayIso(i), 'b', 100 + (i % 5)));
  }
  for (let i = 5; i < 45; i += 1) {
    queue.push(ql(dayIso(i), 'c', 100 + (i % 7) * 2));
  }
  const r = buildDailyTokenSpectralSkewness(queue, {
    generatedAt: ISO,
    minTokens: 0,
    sort: 'tenure',
  });
  assert.equal(r.sources.length, 3);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
  assert.equal(r.sources[2]!.source, 'c');
});

test('build: since/until window honoured', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 80; i += 1) {
    queue.push(ql(dayIso(i), 'a', 100 + (i % 7)));
  }
  const r = buildDailyTokenSpectralSkewness(queue, {
    generatedAt: ISO,
    minTokens: 0,
    since: dayIso(20),
    until: dayIso(60),
  });
  assert.equal(r.sources[0]!.nTenureDays, 40);
});

test('build: per-source row carries all fields', () => {
  const queue: QueueLine[] = [];
  const N = 64;
  const k0 = 4;
  for (let i = 0; i < N; i += 1) {
    queue.push(
      ql(
        dayIso(i),
        'sin',
        Math.round(1000 + 100 * Math.cos((2 * Math.PI * k0 * i) / N)),
      ),
    );
  }
  const r = buildDailyTokenSpectralSkewness(queue, {
    generatedAt: ISO,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'sin');
  assert.equal(row.nTenureDays, N);
  assert.equal(row.nFreqBins, N / 2);
  assert.ok(row.bandwidth > 0);
  assert.ok(row.centroidBin > 0);
  assert.ok(Number.isFinite(row.thirdCentralMoment));
  assert.ok(Number.isFinite(row.skewness));
  assert.ok(Number.isFinite(row.mean) && row.mean > 0);
  assert.ok(Number.isFinite(row.stddev) && row.stddev >= 0);
  assert.equal(row.firstActiveDay, dayIso(0).slice(0, 10));
  assert.equal(row.lastActiveDay, dayIso(N - 1).slice(0, 10));
});

test('build: gap-filling extends tenure across silent days', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'gappy', 100 + i));
  }
  for (let i = 30; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'gappy', 200 + i));
  }
  const r = buildDailyTokenSpectralSkewness(queue, {
    generatedAt: ISO,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 40);
  assert.equal(r.sources[0]!.nActiveDays, 20);
});

// ---------- structural orthogonality witness ----------

test('orthogonality: bandwidth-equal pair with opposite skew -- the WITNESS vs axis-87', () => {
  // p_a = (4, 1, 1, 0, 0): mass low; p_b = (0, 0, 1, 1, 4):
  // mass high. Same multiset -> same arithmetic moments
  // structure but mirrored across the centre. Both have
  // identical bandwidth (bin-reversal preserves spread) but
  // exactly opposite skewness (bin-reversal flips sign).
  const a = spectralSkewness([4, 1, 1, 0, 0]);
  const b = spectralSkewness([0, 0, 1, 1, 4]);
  assert.ok(Math.abs(a.bandwidth - b.bandwidth) < 1e-12);
  assert.ok(Math.abs(a.skewness + b.skewness) < 1e-12);
  // Crucially, bandwidth is identical but skewness is opposite
  // sign -- this is the structural orthogonality witness vs
  // axis-87.
  assert.ok(a.skewness * b.skewness < 0);
});

test('orthogonality: crest-equal pair with different skew -- the WITNESS vs axis-89', () => {
  // Two spectra with the same peak/mean but different bin
  // arrangements -> same crest, different skewness. This is
  // the structural orthogonality witness vs axis-89.
  // p_a = (1, 1, 4, 1, 1): peak at centre -> symmetric -> ~0
  // skew. p_b = (1, 1, 1, 1, 4): peak at high end -> negative
  // skew. Both have peak=4, total=8, mean=8/5=1.6 -> crest =
  // 4/1.6 = 2.5 in both cases.
  const a = spectralSkewness([1, 1, 4, 1, 1]);
  const b = spectralSkewness([1, 1, 1, 1, 4]);
  // Algebraic check: by symmetry a.skewness must be exactly 0.
  assert.ok(Math.abs(a.skewness) < 1e-12);
  // b's skewness must be non-trivial and negative (mass below
  // mu, peak at top, but the BULK pulls centroid lower; the
  // single high peak at k=5 produces a positive (k-mu)^3 term
  // that dominates -> actually positive skew). Let's verify
  // direction by hand:
  //   total=8; mu = (1+2+3+4+20)/8 = 30/8 = 3.75.
  //   third moment ~ 1*(-2.75)^3 + 1*(-1.75)^3 + 1*(-0.75)^3 +
  //                  1*(0.25)^3 + 4*(1.25)^3
  //               ~ -20.80 + -5.36 + -0.42 + 0.016 + 7.81
  //               ~ -18.74 / 8 = -2.34 -> NEGATIVE. So bulk
  //   wins; right tail at k=5 is too close to mu to flip
  //   the sign. skewness < 0.
  assert.ok(b.skewness < 0, `expected b.skewness < 0, got ${b.skewness}`);
  assert.ok(Math.abs(a.skewness - b.skewness) > 1e-6);
});

// ---------- refinement: numerical guards ----------

test('refinement: spectralSkewness bandwidth-zero gate -- 3 equal bins at SAME index would be 0 spread', () => {
  // We cannot construct a real "3 equal bins at same index"
  // since the input is a vector indexed by position. The gate
  // is reachable in practice only if (k - mu)^2 telescopes to
  // zero across positive-power bins. The closest construction
  // is three equal bins at adjacent positions; bandwidth must
  // remain strictly positive then.
  const r = spectralSkewness([1, 1, 1]);
  assert.ok(r.bandwidth > 0);
  assert.ok(Number.isFinite(r.bandwidth));
  // Skewness on the perfectly symmetric (1,1,1) is exactly 0.
  assert.ok(Math.abs(r.skewness) < 1e-12);
});

test('refinement: Wilkins 1944 envelope respected on a real-series PSD', () => {
  // |skewness| <= sqrt(m-2) * (m-1) / sqrt(m); a generous bound
  // that must hold on every well-formed input.
  const y = [
    10, 30, 5, 22, 18, 7, 14, 9, 25, 11, 8, 19, 6, 20, 13, 16,
    12, 28, 4, 21, 17, 6, 15, 10, 24, 12, 9, 18, 7, 21, 14, 17,
  ];
  const r = dailyTokenSpectralSkewness(y);
  const m = r.usableBins;
  const envelope = (Math.sqrt(m - 2) * (m - 1)) / Math.sqrt(m);
  assert.ok(
    Math.abs(r.skewness) <= envelope + 1e-9,
    `|skewness|=${Math.abs(r.skewness)} must be <= Wilkins envelope ${envelope} on m=${m}`,
  );
});

test('refinement: centroidBin stays inside [1, K] (the mathematical range)', () => {
  // mu is a power-weighted mean of bin indices in {1,..,K}
  // restricted to bins with p > 0; therefore mu in [1, K].
  const y = [
    100, 50, 200, 75, 150, 60, 180, 90, 110, 40, 220, 70,
    130, 95, 160, 55,
  ];
  const r = dailyTokenSpectralSkewness(y);
  const K = r.nFreqBins;
  assert.ok(r.centroidBin >= 1 - 1e-12);
  assert.ok(r.centroidBin <= K + 1e-12);
  // Bandwidth (sigma) on a non-degenerate PSD is also bounded
  // above by (K - 1) / sqrt(2) (the standard discrete-uniform
  // bound on a {1,..,K} support); use a generous K bound here.
  assert.ok(r.bandwidth > 0);
  assert.ok(r.bandwidth <= K);
});
