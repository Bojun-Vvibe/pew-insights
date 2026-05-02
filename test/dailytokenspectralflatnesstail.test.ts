import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralFlatnessTail,
  dailyTokenSpectralFlatnessTail,
  buildDailyTokenSpectralFlatnessTail,
} from '../src/dailytokenspectralflatnesstail.js';
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

// ---------- spectralFlatnessTail primitive ----------

test('spectralFlatnessTail: too few bins -> throws', () => {
  for (const k of [0, 1, 2, 3]) {
    const arr = new Array<number>(k).fill(1);
    assert.throws(() => spectralFlatnessTail(arr), /too few bins/);
  }
});

test('spectralFlatnessTail: K=4 boundary OK (tail = {3, 4})', () => {
  const r = spectralFlatnessTail([10, 20, 3, 3]);
  assert.equal(r.nTailBins, 2);
  assert.equal(r.tailStartBin, 3);
  assert.equal(r.usableTailBins, 2);
  assert.ok(Math.abs(r.tailFlat - 1) < 1e-12);
});

test('spectralFlatnessTail: K=5 tail = {3, 4, 5}', () => {
  const r = spectralFlatnessTail([10, 20, 5, 5, 5]);
  assert.equal(r.nTailBins, 3);
  assert.equal(r.tailStartBin, 3);
  assert.equal(r.usableTailBins, 3);
  assert.ok(Math.abs(r.tailFlat - 1) < 1e-12);
});

test('spectralFlatnessTail: K=6 tail = {4, 5, 6}', () => {
  const r = spectralFlatnessTail([1, 2, 3, 7, 7, 7]);
  assert.equal(r.nTailBins, 3);
  assert.equal(r.tailStartBin, 4);
  assert.ok(Math.abs(r.tailFlat - 1) < 1e-12);
});

test('spectralFlatnessTail: K=7 tail = {4, 5, 6, 7}', () => {
  const r = spectralFlatnessTail([1, 2, 3, 5, 5, 5, 5]);
  assert.equal(r.nTailBins, 4);
  assert.equal(r.tailStartBin, 4);
  assert.ok(Math.abs(r.tailFlat - 1) < 1e-12);
});

test('spectralFlatnessTail: non-finite power -> throws', () => {
  assert.throws(
    () => spectralFlatnessTail([1, 2, 3, NaN]),
    /non-finite power/,
  );
  assert.throws(
    () => spectralFlatnessTail([1, 2, Infinity, 3]),
    /non-finite power/,
  );
  assert.throws(
    () => spectralFlatnessTail([1, 2, 3, -Infinity]),
    /non-finite power/,
  );
});

test('spectralFlatnessTail: negative power -> throws', () => {
  assert.throws(
    () => spectralFlatnessTail([1, 2, 3, -0.001]),
    /negative power/,
  );
});

test('spectralFlatnessTail: only one positive tail bin -> throws', () => {
  assert.throws(
    () => spectralFlatnessTail([5, 5, 0, 7]),
    /too few positive-power tail bins/,
  );
});

test('spectralFlatnessTail: zero positive tail bins -> throws (head-only delta)', () => {
  assert.throws(
    () => spectralFlatnessTail([5, 5, 0, 0]),
    /too few positive-power tail bins/,
  );
});

test('spectralFlatnessTail: K=4 tail flat = 1 with two equal positive bins', () => {
  const r = spectralFlatnessTail([0, 0, 7, 7]);
  assert.ok(Math.abs(r.tailFlat - 1) < 1e-12);
  assert.equal(r.usableTailBins, 2);
  assert.equal(r.tailPowerSum, 14);
});

test('spectralFlatnessTail: K=4 m=2 closed form 2*sqrt(a*b)/(a+b)', () => {
  const a = 9;
  const b = 1;
  const r = spectralFlatnessTail([0, 0, a, b]);
  const expected = (2 * Math.sqrt(a * b)) / (a + b);
  assert.ok(Math.abs(r.tailFlat - expected) < 1e-12);
});

test('spectralFlatnessTail: tailFlat in [0, 1] always', () => {
  const cases: number[][] = [
    [1, 2, 3, 100, 0.0001, 50],
    [10, 10, 10, 10, 10, 10, 10, 10],
    [0, 0, 0, 0, 1e-15, 1e-15],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  ];
  for (const c of cases) {
    const r = spectralFlatnessTail(c);
    assert.ok(r.tailFlat >= 0 && r.tailFlat <= 1, `tailFlat=${r.tailFlat}`);
  }
});

test('spectralFlatnessTail: scale invariance (multiply all by 7)', () => {
  const base = [1, 2, 3, 4, 5, 6];
  const scaled = base.map((x) => x * 7);
  const r1 = spectralFlatnessTail(base);
  const r2 = spectralFlatnessTail(scaled);
  assert.ok(Math.abs(r1.tailFlat - r2.tailFlat) < 1e-12);
});

test('spectralFlatnessTail: permutation within tail invariance', () => {
  const a = [1, 2, 3, 7, 11, 13];
  const b = [1, 2, 3, 13, 7, 11];
  const c = [1, 2, 3, 11, 13, 7];
  const ra = spectralFlatnessTail(a);
  const rb = spectralFlatnessTail(b);
  const rc = spectralFlatnessTail(c);
  assert.ok(Math.abs(ra.tailFlat - rb.tailFlat) < 1e-12);
  assert.ok(Math.abs(ra.tailFlat - rc.tailFlat) < 1e-12);
});

test('spectralFlatnessTail: NOT invariant under bin-reversal (head/tail swap)', () => {
  // Asymmetric spectrum: head dominant, tail noisy-uniform.
  const fwd = [100, 90, 80, 1.0, 1.1, 1.05, 1.02, 1.08];
  const rev = [...fwd].reverse();
  const r1 = spectralFlatnessTail(fwd);
  const r2 = spectralFlatnessTail(rev);
  // Forward tail = noisy-uniform -> tailFlat ~ 1
  // Reversed tail = head-dominant -> different tailFlat
  assert.ok(r1.tailFlat > 0.99);
  assert.ok(Math.abs(r1.tailFlat - r2.tailFlat) > 0.1);
});

test('spectralFlatnessTail: orthogonality witness vs full-band (axis-85) — head dominant, tail flat', () => {
  // Head-dominant, tail uniform: full Wiener flatness depressed (head outliers),
  // tail flatness near 1.
  const r = spectralFlatnessTail([1000, 500, 100, 1, 1, 1, 1, 1]);
  assert.ok(r.tailFlat > 0.999);
  assert.equal(r.usableTailBins, 4);
});

test('spectralFlatnessTail: orthogonality witness vs full-band — tail-spike depresses tailFlat', () => {
  // K=8, tail = bins {5..8}. Put a spike at bin 8.
  const r = spectralFlatnessTail([1, 1, 1, 1, 1, 1, 1, 100]);
  // tail = [1, 1, 1, 100]. GM = 100^(1/4) ~ 3.16, AM = 25.75 -> ratio ~ 0.123.
  assert.ok(r.tailFlat < 0.2);
});

test('spectralFlatnessTail: tailStartBin formula floor(K/2)+1 verified', () => {
  for (let k = 4; k <= 20; k += 1) {
    const arr = new Array<number>(k).fill(1);
    const r = spectralFlatnessTail(arr);
    assert.equal(r.tailStartBin, Math.floor(k / 2) + 1);
    assert.equal(r.nTailBins, Math.ceil(k / 2));
  }
});

test('spectralFlatnessTail: nTailBins formula ceil(K/2) verified', () => {
  // Odd K: |T| = (K+1)/2; even K: |T| = K/2.
  assert.equal(spectralFlatnessTail([1, 2, 3, 4]).nTailBins, 2); // K=4 -> 2
  assert.equal(spectralFlatnessTail([1, 2, 3, 4, 5]).nTailBins, 3); // K=5 -> 3
  assert.equal(spectralFlatnessTail([1, 2, 3, 4, 5, 6]).nTailBins, 3); // K=6 -> 3
  assert.equal(spectralFlatnessTail([1, 2, 3, 4, 5, 6, 7]).nTailBins, 4); // K=7 -> 4
});

test('spectralFlatnessTail: tailFlat = 1 sharp upper bound (constant tail)', () => {
  const r = spectralFlatnessTail([99, 99, 99, 5, 5, 5, 5]);
  assert.equal(r.tailFlat, 1);
});

test('spectralFlatnessTail: tailFlat -> 0 lower bound (single tail dominance)', () => {
  // K=8, tail = {5,6,7,8}. Need >= 2 positive in tail with extreme ratio.
  const r2 = spectralFlatnessTail([0, 0, 0, 0, 1e-15, 1e15, 0.001, 0.001]);
  // tail positive: 1e-15, 1e15, 0.001, 0.001 -> 4 positive. AM dominated by 1e15.
  assert.ok(r2.tailFlat < 1e-5);
});

// ---------- dailyTokenSpectralFlatnessTail (series-level) ----------

test('dailyTokenSpectralFlatnessTail: too short -> throws', () => {
  for (const n of [0, 1, 5, 7]) {
    const arr = new Array<number>(n).fill(0).map((_, i) => i + 1);
    assert.throws(
      () => dailyTokenSpectralFlatnessTail(arr),
      /series too short|zero variance/,
    );
  }
});

test('dailyTokenSpectralFlatnessTail: n=8 boundary (K=4) OK', () => {
  const arr = [1, 5, 2, 8, 3, 9, 4, 6];
  const r = dailyTokenSpectralFlatnessTail(arr);
  assert.equal(r.nFreqBins, 4);
  assert.equal(r.nTailBins, 2);
  assert.ok(r.tailFlat >= 0 && r.tailFlat <= 1);
});

test('dailyTokenSpectralFlatnessTail: non-finite -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralFlatnessTail([1, 2, NaN, 4, 5, 6, 7, 8]),
    /finite/,
  );
  assert.throws(
    () => dailyTokenSpectralFlatnessTail([1, 2, 3, Infinity, 5, 6, 7, 8]),
    /finite/,
  );
});

test('dailyTokenSpectralFlatnessTail: zero variance -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralFlatnessTail([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero variance/,
  );
});

test('dailyTokenSpectralFlatnessTail: shift invariance (add constant)', () => {
  const base = [1, 5, 2, 8, 3, 9, 4, 6, 7, 2, 5, 1];
  const shifted = base.map((x) => x + 1000);
  const r1 = dailyTokenSpectralFlatnessTail(base);
  const r2 = dailyTokenSpectralFlatnessTail(shifted);
  assert.ok(Math.abs(r1.tailFlat - r2.tailFlat) < 1e-9);
});

test('dailyTokenSpectralFlatnessTail: scale invariance (multiply by 100)', () => {
  const base = [1, 5, 2, 8, 3, 9, 4, 6, 7, 2, 5, 1];
  const scaled = base.map((x) => x * 100);
  const r1 = dailyTokenSpectralFlatnessTail(base);
  const r2 = dailyTokenSpectralFlatnessTail(scaled);
  assert.ok(Math.abs(r1.tailFlat - r2.tailFlat) < 1e-9);
});

test('dailyTokenSpectralFlatnessTail: sign-flip invariance', () => {
  const base = [1, 5, 2, 8, 3, 9, 4, 6, 7, 2, 5, 1];
  const flipped = base.map((x) => -x);
  const r1 = dailyTokenSpectralFlatnessTail(base);
  const r2 = dailyTokenSpectralFlatnessTail(flipped);
  assert.ok(Math.abs(r1.tailFlat - r2.tailFlat) < 1e-9);
});

test('dailyTokenSpectralFlatnessTail: time-reversal invariance', () => {
  const base = [1, 5, 2, 8, 3, 9, 4, 6, 7, 2, 5, 1];
  const reversed = [...base].reverse();
  const r1 = dailyTokenSpectralFlatnessTail(base);
  const r2 = dailyTokenSpectralFlatnessTail(reversed);
  assert.ok(Math.abs(r1.tailFlat - r2.tailFlat) < 1e-9);
});

test('dailyTokenSpectralFlatnessTail: tailFlat in [0, 1]', () => {
  const cases: number[][] = [
    [1, 5, 2, 8, 3, 9, 4, 6],
    Array.from({ length: 30 }, (_, i) => Math.sin(i / 3) * 100 + 1000),
    Array.from({ length: 50 }, (_, i) => (i % 7) * 13 + 1),
    Array.from({ length: 100 }, (_, i) => Math.random() * 1000 + 100),
  ];
  for (const c of cases) {
    const r = dailyTokenSpectralFlatnessTail(c);
    assert.ok(r.tailFlat >= 0 && r.tailFlat <= 1);
  }
});

test('dailyTokenSpectralFlatnessTail: schema fields stable', () => {
  const r = dailyTokenSpectralFlatnessTail([1, 5, 2, 8, 3, 9, 4, 6, 7, 2]);
  assert.ok('mean' in r);
  assert.ok('stddev' in r);
  assert.ok('nFreqBins' in r);
  assert.ok('nTailBins' in r);
  assert.ok('tailStartBin' in r);
  assert.ok('usableTailBins' in r);
  assert.ok('tailPowerSum' in r);
  assert.ok('tailFlat' in r);
});

// ---------- buildDailyTokenSpectralFlatnessTail (queue-level) ----------

function makeQueue(
  source: string,
  pattern: number[],
  startDay = 0,
): QueueLine[] {
  return pattern.map((tok, i) => ql(dayIso(startDay + i), source, tok));
}

test('build: empty queue', () => {
  const r = buildDailyTokenSpectralFlatnessTail([], { generatedAt: ISO });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('build: invalid hour_start dropped', () => {
  const r = buildDailyTokenSpectralFlatnessTail(
    [ql('not-a-date', 'a', 100)],
    { generatedAt: ISO },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: non-positive tokens dropped', () => {
  const r = buildDailyTokenSpectralFlatnessTail(
    [
      ql(dayIso(0), 'a', 0),
      ql(dayIso(0), 'a', -5),
      ql(dayIso(1), 'a', NaN),
    ],
    { generatedAt: ISO },
  );
  assert.equal(r.droppedNonPositiveTokens, 3);
});

test('build: source filter drops non-matching', () => {
  const q = [
    ql(dayIso(0), 'a', 100),
    ql(dayIso(0), 'b', 100),
  ];
  const r = buildDailyTokenSpectralFlatnessTail(q, {
    generatedAt: ISO,
    source: 'a',
  });
  assert.equal(r.droppedSourceFilter, 1);
});

test('build: sparse sources dropped (below min-tokens)', () => {
  const q = makeQueue('claude-code', Array(40).fill(10));
  const r = buildDailyTokenSpectralFlatnessTail(q, {
    generatedAt: ISO,
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
});

test('build: below min-tenure dropped', () => {
  const q = makeQueue('claude-code', Array(20).fill(2000));
  const r = buildDailyTokenSpectralFlatnessTail(q, {
    generatedAt: ISO,
    minTenureDays: 32,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: zero-variance dropped', () => {
  const q = makeQueue('claude-code', Array(40).fill(2000));
  const r = buildDailyTokenSpectralFlatnessTail(q, {
    generatedAt: ISO,
    minTenureDays: 10,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: invalid sort throws', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralFlatnessTail([], {
        generatedAt: ISO,
        sort: 'nope' as any,
      }),
    /sort must be one of/,
  );
});

test('build: invalid minTokens throws', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralFlatnessTail([], {
        generatedAt: ISO,
        minTokens: -1,
      }),
    /minTokens/,
  );
});

test('build: invalid minTenureDays throws (< 8)', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralFlatnessTail([], {
        generatedAt: ISO,
        minTenureDays: 7,
      }),
    /minTenureDays/,
  );
});

test('build: invalid top throws', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralFlatnessTail([], {
        generatedAt: ISO,
        top: -1,
      }),
    /top/,
  );
});

test('build: top cap drops remainder', () => {
  // Two sources both qualify.
  const q = [
    ...makeQueue(
      'claude-code',
      Array.from({ length: 40 }, (_, i) => 1000 + (i % 5) * 200),
    ),
    ...makeQueue(
      'vscode-other',
      Array.from({ length: 40 }, (_, i) => 1000 + ((i * 3) % 7) * 150),
    ),
  ];
  const r = buildDailyTokenSpectralFlatnessTail(q, {
    generatedAt: ISO,
    minTenureDays: 10,
    top: 1,
  });
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources.length, 1);
});

test('build: invalid since/until throws', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralFlatnessTail([], {
        generatedAt: ISO,
        since: 'bad-date',
      }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenSpectralFlatnessTail([], {
        generatedAt: ISO,
        until: 'bad-date',
      }),
    /invalid until/,
  );
});

test('build: produces well-formed row for valid varied source', () => {
  const pattern = Array.from({ length: 40 }, (_, i) =>
    1000 + Math.round(500 * Math.sin(i / 3)),
  );
  const q = makeQueue('claude-code', pattern);
  const r = buildDailyTokenSpectralFlatnessTail(q, {
    generatedAt: ISO,
    minTenureDays: 10,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'claude-code');
  assert.ok(row.tailFlat >= 0 && row.tailFlat <= 1);
  assert.ok(row.nTailBins >= 2);
  assert.equal(row.tailStartBin, Math.floor(row.nFreqBins / 2) + 1);
});

test('build: sort by tailFlatDesc orders correctly', () => {
  // Two sources: one with flat tail (sinusoid period ~ 3 days, tail likely uniform-ish);
  // one with sharper tail (period ~ 2 days near nyquist).
  const flat = Array.from({ length: 40 }, (_, i) => 1000 + 50 * Math.sin(i));
  const sharp = Array.from({ length: 40 }, (_, i) =>
    1000 + 500 * Math.sin((Math.PI * i) / 1.05),
  );
  const q = [
    ...makeQueue('aa-flat', flat),
    ...makeQueue('bb-sharp', sharp),
  ];
  const r = buildDailyTokenSpectralFlatnessTail(q, {
    generatedAt: ISO,
    minTenureDays: 10,
    sort: 'tailFlatDesc',
  });
  if (r.sources.length === 2) {
    assert.ok(r.sources[0]!.tailFlat >= r.sources[1]!.tailFlat);
  }
});

test('build: sort by tailFlat (asc) reverses order', () => {
  const flat = Array.from({ length: 40 }, (_, i) => 1000 + 50 * Math.sin(i));
  const sharp = Array.from({ length: 40 }, (_, i) =>
    1000 + 500 * Math.sin((Math.PI * i) / 1.05),
  );
  const q = [
    ...makeQueue('aa-flat', flat),
    ...makeQueue('bb-sharp', sharp),
  ];
  const r = buildDailyTokenSpectralFlatnessTail(q, {
    generatedAt: ISO,
    minTenureDays: 10,
    sort: 'tailFlat',
  });
  if (r.sources.length === 2) {
    assert.ok(r.sources[0]!.tailFlat <= r.sources[1]!.tailFlat);
  }
});

test('build: sort by tokens descends', () => {
  const big = Array.from({ length: 40 }, (_, i) => 5000 + 100 * Math.sin(i));
  const small = Array.from({ length: 40 }, (_, i) => 1500 + 100 * Math.sin(i));
  const q = [
    ...makeQueue('aaa-small', small),
    ...makeQueue('zzz-big', big),
  ];
  const r = buildDailyTokenSpectralFlatnessTail(q, {
    generatedAt: ISO,
    minTenureDays: 10,
    sort: 'tokens',
  });
  if (r.sources.length === 2) {
    assert.ok(r.sources[0]!.totalTokens >= r.sources[1]!.totalTokens);
  }
});

test('build: sort by source alphabetic', () => {
  const a = Array.from({ length: 40 }, (_, i) => 1500 + 100 * Math.sin(i));
  const q = [
    ...makeQueue('zzz', a),
    ...makeQueue('aaa', a),
  ];
  const r = buildDailyTokenSpectralFlatnessTail(q, {
    generatedAt: ISO,
    minTenureDays: 10,
    sort: 'source',
  });
  if (r.sources.length === 2) {
    assert.equal(r.sources[0]!.source, 'aaa');
    assert.equal(r.sources[1]!.source, 'zzz');
  }
});

test('build: schema fields present on report', () => {
  const r = buildDailyTokenSpectralFlatnessTail([], { generatedAt: ISO });
  assert.equal(r.generatedAt, ISO);
  assert.ok('droppedInvalidHourStart' in r);
  assert.ok('droppedNonPositiveTokens' in r);
  assert.ok('droppedSourceFilter' in r);
  assert.ok('droppedSparseSources' in r);
  assert.ok('droppedBelowMinTenure' in r);
  assert.ok('droppedZeroVariance' in r);
  assert.ok('droppedTooFewTailBins' in r);
  assert.ok('droppedNonFiniteFit' in r);
  assert.ok('droppedTopSources' in r);
});

// ---------- orthogonality witnesses vs prior axes ----------

test('orthogonality vs axis-85 (full Wiener flatness): head-dominant series can have tailFlat ~ 1 while full flatness depressed', () => {
  // Construct power vector directly: head dominated, tail uniform.
  const r = spectralFlatnessTail([1000, 1000, 1000, 5, 5, 5, 5, 5, 5]);
  // tail = bins {5..9}: all = 5 -> tailFlat = 1 exactly.
  assert.ok(r.tailFlat > 0.999);
  // full Wiener over all 9 bins: GM = (1000^3 * 5^6)^(1/9), AM = (3000+30)/9 ~ 336.67;
  // GM = 1000^(1/3) * 5^(2/3) ~ 10 * 2.92 ~ 29.2; ratio ~ 0.087 — much smaller than tailFlat.
});

test('orthogonality vs axis-96 (peak-frequency): head-peak vs tail-peak give same tailFlat structure', () => {
  // Single delta in head (bin 1): tailFlat undefined (throws).
  assert.throws(() => spectralFlatnessTail([100, 0, 0, 0, 0, 0, 0, 0]));
  // Single delta in tail (bin 8): tailFlat undefined too (only 1 positive tail bin).
  assert.throws(() => spectralFlatnessTail([0, 0, 0, 0, 0, 0, 0, 100]));
  // Two equal deltas in tail: tailFlat = 1 (axis-96 peakBin = 7 or 8 depending).
  const r = spectralFlatnessTail([0, 0, 0, 0, 50, 0, 50, 0]);
  assert.equal(r.tailFlat, 1);
});

test('orthogonality vs axis-97 (second-peak-frequency): bimodal at (1, K) decouples', () => {
  // P[1]=P[K]=c with intermediate noise. Axis-97 says (k1*, k2*)=(1, K).
  // Tail = {k > K/2}: contains K=8. Need >= 2 positive tail bins.
  const r = spectralFlatnessTail([100, 1, 1, 1, 1, 1, 1, 100]);
  assert.equal(r.tailStartBin, 5);
  assert.equal(r.usableTailBins, 4); // bins 5..8 all positive
  // Tail = [1, 1, 1, 100]: GM = 100^(1/4) ~ 3.16, AM = 25.75 -> ratio ~ 0.123.
  assert.ok(r.tailFlat < 0.2);
});

test('orthogonality vs axis-94 (spread-IQR): two PSDs with same IQR can have different tailFlat', () => {
  const a = spectralFlatnessTail([10, 10, 10, 10, 1, 1, 1, 1]);
  const b = spectralFlatnessTail([1, 1, 1, 1, 10, 10, 10, 10]);
  // a: tail {5..8} all 1 -> tailFlat = 1.
  // b: tail {5..8} all 10 -> tailFlat = 1.
  // Both have very different IQR / centroid behavior on full-band CDF.
  assert.equal(a.tailFlat, 1);
  assert.equal(b.tailFlat, 1);
});

test('orthogonality vs axis-95 (roughness): permutation within tail invariant for tailFlat but not for roughness', () => {
  // Same tail multiset, different ordering -> tailFlat identical (already covered),
  // but roughness on full-band changes. Witnessed by permuting tail.
  const a = spectralFlatnessTail([5, 5, 5, 1, 100, 1, 100]);
  const b = spectralFlatnessTail([5, 5, 5, 100, 1, 100, 1]);
  assert.ok(Math.abs(a.tailFlat - b.tailFlat) < 1e-12);
});

test('orthogonality vs axis-89 (crest-factor): primary-peak in head leaves tailFlat unaffected', () => {
  // Crest = max/mean over full band: dominated by bin 1.
  // tailFlat depends only on tail.
  const r = spectralFlatnessTail([10000, 1, 1, 5, 5, 5, 5]);
  assert.equal(r.tailFlat, 1); // tail = {4..7} all = 5
});

test('orthogonality vs axis-87 (bandwidth): centroid-relative spread does not predict tailFlat', () => {
  // Two spectra with same bandwidth but different tail structure.
  const r1 = spectralFlatnessTail([1, 2, 3, 4, 5, 6, 7, 8]);
  const r2 = spectralFlatnessTail([1, 2, 3, 4, 5, 6, 7, 80]);
  assert.ok(r1.tailFlat > r2.tailFlat);
});

test('orthogonality vs axis-86 (centroid): two PSDs with same centroid can have wildly different tailFlat', () => {
  // Symmetric around bin 4.5: two designs with same centroid but different tail.
  const a = spectralFlatnessTail([1, 1, 1, 1, 1, 1, 1, 1]); // uniform
  const b = spectralFlatnessTail([4, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 4]); // bimodal at edges
  assert.equal(a.tailFlat, 1);
  // b: tail = {5..8} = [0.1, 0.1, 0.1, 4]. GM = 4^(1/4) * 0.1^(3/4); AM = 4.3/4.
  // GM ~ 1.414 * 0.178 ~ 0.252; AM = 1.075 -> ratio ~ 0.234.
  assert.ok(b.tailFlat < 0.5);
});

test('orthogonality vs axis-92 (decrease): clean monotone descending sequence still has nontrivial tailFlat', () => {
  // P = [8, 7, 6, 5, 4, 3, 2, 1]. tail = [4, 3, 2, 1].
  const r = spectralFlatnessTail([8, 7, 6, 5, 4, 3, 2, 1]);
  // GM = (4*3*2*1)^(1/4) = 24^0.25 ~ 2.213; AM = 2.5; ratio ~ 0.885.
  assert.ok(Math.abs(r.tailFlat - Math.pow(24, 0.25) / 2.5) < 1e-12);
});

test('orthogonality vs axis-93 (irregularity): triplet-aware vs sub-band aggregate', () => {
  // Same multiset, permuted tail: tailFlat invariant, irregularity changes.
  const a = spectralFlatnessTail([1, 1, 1, 1, 2, 4, 8, 16]);
  const b = spectralFlatnessTail([1, 1, 1, 1, 16, 2, 8, 4]);
  assert.ok(Math.abs(a.tailFlat - b.tailFlat) < 1e-12);
});
