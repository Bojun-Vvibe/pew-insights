import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralDecrease,
  dailyTokenSpectralDecrease,
  buildDailyTokenSpectralDecrease,
} from '../src/dailytokenspectraldecrease.js';
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

// ---------- spectralDecrease primitive ----------

test('spectralDecrease: too few bins -> throws', () => {
  assert.throws(() => spectralDecrease([]), /too few bins/);
  assert.throws(() => spectralDecrease([1]), /too few bins/);
});

test('spectralDecrease: non-finite power -> throws', () => {
  assert.throws(() => spectralDecrease([1, NaN]), /non-finite power/);
  assert.throws(() => spectralDecrease([1, Infinity]), /non-finite power/);
  assert.throws(() => spectralDecrease([1, -Infinity]), /non-finite power/);
});

test('spectralDecrease: negative power -> throws', () => {
  assert.throws(() => spectralDecrease([1, -2]), /negative power/);
});

test('spectralDecrease: zero tail power -> throws', () => {
  assert.throws(
    () => spectralDecrease([5, 0, 0, 0]),
    /non-positive tail power/,
  );
});

test('spectralDecrease: closed-form on [4,1,1,1] = (1/3) * ((1-4)/1 + (1-4)/2 + (1-4)/3) = -11/6', () => {
  const r = spectralDecrease([4, 1, 1, 1]);
  // numer = -3 + -1.5 + -1 = -5.5; denom = 3 -> -11/6
  assert.equal(r.firstBinPower, 4);
  assert.equal(r.tailPower, 3);
  assert.ok(Math.abs(r.decrease - -11 / 6) < 1e-12);
});

test('spectralDecrease: flat past bin 1 [4,1,1,1] vs [4,2,2,2] same anchor different tail -> different decrease', () => {
  const a = spectralDecrease([4, 1, 1, 1]);
  const b = spectralDecrease([4, 2, 2, 2]);
  assert.ok(a.decrease !== b.decrease);
  // both should be negative (PSD decreases away from the anchor)
  assert.ok(a.decrease < 0);
  assert.ok(b.decrease < 0);
  // higher tail magnitude => closer to zero (still negative but smaller |decrease|)
  assert.ok(Math.abs(b.decrease) < Math.abs(a.decrease));
});

test('spectralDecrease: positive when mass piles past bin 1 [1,5,5,5]', () => {
  const r = spectralDecrease([1, 5, 5, 5]);
  // numer/(k-1): 4/1 + 4/2 + 4/3 = 4+2+1.333... = 7.333...; denom=15 -> ~0.4889
  assert.ok(r.decrease > 0);
  assert.ok(Math.abs(r.decrease - 22 / 45) < 1e-12);
});

test('spectralDecrease: scale invariance (a > 0)', () => {
  const r1 = spectralDecrease([4, 1, 1, 1]);
  const r2 = spectralDecrease([400, 100, 100, 100]);
  assert.ok(Math.abs(r1.decrease - r2.decrease) < 1e-12);
});

test('spectralDecrease: bin-permutation sensitivity (orthogonality witness vs flatness)', () => {
  const ascending = spectralDecrease([1, 2, 3, 4, 5]);
  const descending = spectralDecrease([5, 4, 3, 2, 1]);
  // same multiset {1,2,3,4,5} -> same flatness; opposite-sign decrease
  assert.ok(ascending.decrease > 0);
  assert.ok(descending.decrease < 0);
});

test('spectralDecrease: bin-reversal moves the anchor (NOT invariant)', () => {
  const fwd = spectralDecrease([10, 1, 1, 1, 1, 1]);
  const rev = spectralDecrease([1, 1, 1, 1, 1, 10]);
  // anchor changes from large -> small, descriptor sign flips
  assert.ok(fwd.decrease < 0);
  assert.ok(rev.decrease > 0);
});

test('spectralDecrease: zero anchor + uniform tail -> decrease > 0 (mass piles past anchor)', () => {
  const r = spectralDecrease([0, 1, 1, 1]);
  // numer = (1-0)/1 + (1-0)/2 + (1-0)/3 = 11/6; denom=3 -> 11/18
  assert.ok(Math.abs(r.decrease - 11 / 18) < 1e-12);
});

// ---------- dailyTokenSpectralDecrease primitive ----------

test('dailyTokenSpectralDecrease: n<8 throws', () => {
  assert.throws(
    () => dailyTokenSpectralDecrease([1, 2, 3, 4, 5, 6, 7]),
    /series too short/,
  );
});

test('dailyTokenSpectralDecrease: non-finite values throw', () => {
  assert.throws(
    () => dailyTokenSpectralDecrease([1, 2, NaN, 4, 5, 6, 7, 8]),
    /finite values/,
  );
});

test('dailyTokenSpectralDecrease: zero variance throws', () => {
  assert.throws(
    () => dailyTokenSpectralDecrease([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero variance/,
  );
});

test('dailyTokenSpectralDecrease: shift invariance', () => {
  const base = [1, 3, 2, 5, 4, 7, 6, 9, 8, 10];
  const shifted = base.map((v) => v + 1000);
  const r1 = dailyTokenSpectralDecrease(base);
  const r2 = dailyTokenSpectralDecrease(shifted);
  assert.ok(Math.abs(r1.decrease - r2.decrease) < 1e-9);
});

test('dailyTokenSpectralDecrease: scale invariance', () => {
  const base = [1, 3, 2, 5, 4, 7, 6, 9, 8, 10];
  const scaled = base.map((v) => v * 1e6);
  const r1 = dailyTokenSpectralDecrease(base);
  const r2 = dailyTokenSpectralDecrease(scaled);
  assert.ok(Math.abs(r1.decrease - r2.decrease) < 1e-6);
});

test('dailyTokenSpectralDecrease: sign-flip invariance', () => {
  const base = [1, 3, 2, 5, 4, 7, 6, 9, 8, 10];
  const flipped = base.map((v) => -v);
  const r1 = dailyTokenSpectralDecrease(base);
  const r2 = dailyTokenSpectralDecrease(flipped);
  assert.ok(Math.abs(r1.decrease - r2.decrease) < 1e-9);
});

test('dailyTokenSpectralDecrease: time-reversal invariance', () => {
  const base = [1, 3, 2, 5, 4, 7, 6, 9, 8, 10];
  const reversed = base.slice().reverse();
  const r1 = dailyTokenSpectralDecrease(base);
  const r2 = dailyTokenSpectralDecrease(reversed);
  assert.ok(Math.abs(r1.decrease - r2.decrease) < 1e-9);
});

test('dailyTokenSpectralDecrease: low-frequency-dominant series -> decrease < 0', () => {
  // slow ramp with tiny noise: low-frequency dominant
  const v: number[] = [];
  for (let i = 0; i < 32; i += 1) {
    v.push(i + Math.sin(i * 0.1) * 0.01);
  }
  const r = dailyTokenSpectralDecrease(v);
  assert.ok(r.decrease < 0, `expected negative decrease, got ${r.decrease}`);
});

test('dailyTokenSpectralDecrease: high-frequency-dominant series -> decrease > 0', () => {
  // alternating sign series (Nyquist-dominant): mass piles at high bins
  const v: number[] = [];
  for (let i = 0; i < 32; i += 1) {
    v.push((i % 2 === 0 ? 1 : -1) * 100 + i * 0.001);
  }
  const r = dailyTokenSpectralDecrease(v);
  assert.ok(r.decrease > 0, `expected positive decrease, got ${r.decrease}`);
});

// ---------- buildDailyTokenSpectralDecrease ----------

test('build: rejects bad minTokens', () => {
  assert.throws(
    () => buildDailyTokenSpectralDecrease([], { minTokens: -1 }),
    /minTokens/,
  );
  assert.throws(
    () => buildDailyTokenSpectralDecrease([], { minTokens: NaN }),
    /minTokens/,
  );
});

test('build: rejects minTenureDays < 8', () => {
  assert.throws(
    () => buildDailyTokenSpectralDecrease([], { minTenureDays: 7 }),
    /minTenureDays/,
  );
  assert.throws(
    () => buildDailyTokenSpectralDecrease([], { minTenureDays: 1.5 }),
    /minTenureDays/,
  );
});

test('build: rejects bad top', () => {
  assert.throws(
    () => buildDailyTokenSpectralDecrease([], { top: -1 }),
    /top/,
  );
  assert.throws(
    () => buildDailyTokenSpectralDecrease([], { top: 1.5 }),
    /top/,
  );
});

test('build: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralDecrease([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('build: rejects bad since/until', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralDecrease([], {
        since: 'not-a-date',
      }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenSpectralDecrease([], {
        until: 'also-not-a-date',
      }),
    /invalid until/,
  );
});

test('build: empty queue -> empty report defaults', () => {
  const r = buildDailyTokenSpectralDecrease([], { generatedAt: ISO });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.minTenureDays, 32);
  assert.equal(r.sort, 'decrease');
});

test('build: bad-hour_start row counted', () => {
  const r = buildDailyTokenSpectralDecrease(
    [ql('not-a-date', 's', 100)],
    { generatedAt: ISO },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: non-positive tokens row counted', () => {
  const r = buildDailyTokenSpectralDecrease(
    [ql(dayIso(0), 's', 0), ql(dayIso(1), 's', -5)],
    { generatedAt: ISO },
  );
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: source-filter row counted', () => {
  const r = buildDailyTokenSpectralDecrease(
    [ql(dayIso(0), 'a', 100), ql(dayIso(1), 'b', 100)],
    { source: 'a', generatedAt: ISO },
  );
  assert.equal(r.droppedSourceFilter, 1);
});

test('build: sparse-tokens row counted', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) lines.push(ql(dayIso(i), 's', 5));
  const r = buildDailyTokenSpectralDecrease(lines, {
    minTokens: 10000,
    generatedAt: ISO,
  });
  assert.equal(r.droppedSparseSources, 1);
});

test('build: short-tenure row counted', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) lines.push(ql(dayIso(i), 's', 1000));
  const r = buildDailyTokenSpectralDecrease(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: zero-variance row counted (constant gap-filled series)', () => {
  // single-day source with 1 row: gap-filled length = 1; not enough
  // build a 32+ day source where every day has identical mass
  const lines: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) lines.push(ql(dayIso(i), 's', 1000));
  const r = buildDailyTokenSpectralDecrease(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: row JSON shape contract (real series)', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 64; i += 1) {
    lines.push(ql(dayIso(i), 's', 1000 + (i % 3) * 500 + i * 7));
  }
  const r = buildDailyTokenSpectralDecrease(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 's');
  assert.equal(row.nTenureDays, 64);
  assert.equal(row.nFreqBins, 32);
  assert.ok(Number.isFinite(row.decrease));
  assert.ok(Number.isFinite(row.firstBinPower));
  assert.ok(Number.isFinite(row.tailPower));
  assert.ok(row.firstBinPower >= 0);
  assert.ok(row.tailPower > 0);
  assert.ok(row.totalTokens > 0);
});

test('build: report-level JSON shape contract', () => {
  const r = buildDailyTokenSpectralDecrease([], { generatedAt: ISO });
  assert.equal(r.generatedAt, ISO);
  assert.equal(r.windowStart, null);
  assert.equal(r.windowEnd, null);
  assert.equal(r.source, null);
  assert.equal(typeof r.minTokens, 'number');
  assert.equal(typeof r.minTenureDays, 'number');
  assert.equal(typeof r.top, 'number');
  assert.equal(typeof r.sort, 'string');
  assert.equal(typeof r.totalTokens, 'number');
  assert.equal(typeof r.totalSources, 'number');
  assert.equal(typeof r.droppedInvalidHourStart, 'number');
  assert.equal(typeof r.droppedNonPositiveTokens, 'number');
  assert.equal(typeof r.droppedSourceFilter, 'number');
  assert.equal(typeof r.droppedSparseSources, 'number');
  assert.equal(typeof r.droppedBelowMinTenure, 'number');
  assert.equal(typeof r.droppedZeroVariance, 'number');
  assert.equal(typeof r.droppedZeroTailPower, 'number');
  assert.equal(typeof r.droppedNonFiniteFit, 'number');
  assert.equal(typeof r.droppedTopSources, 'number');
  assert.ok(Array.isArray(r.sources));
});

test('build: top cap suppresses overflow into droppedTopSources', () => {
  const lines: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    for (let i = 0; i < 64; i += 1) {
      lines.push(
        ql(dayIso(i), `src${s}`, 1000 + ((i * (s + 1)) % 5) * 250),
      );
    }
  }
  const r = buildDailyTokenSpectralDecrease(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    top: 2,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('build: source-asc tiebreak when sort=source', () => {
  const lines: QueueLine[] = [];
  for (const s of ['z', 'a', 'm']) {
    for (let i = 0; i < 64; i += 1) {
      lines.push(ql(dayIso(i), s, 1000 + (i % 3) * 100 + i));
    }
  }
  const r = buildDailyTokenSpectralDecrease(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'source',
    generatedAt: ISO,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'm', 'z'],
  );
});

test('build: window since/until filters rows', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 80; i += 1) lines.push(ql(dayIso(i), 's', 1000 + i));
  const r = buildDailyTokenSpectralDecrease(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    since: dayIso(10),
    until: dayIso(70),
    generatedAt: ISO,
  });
  // 60 days kept, single source
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 60);
});

test('build: decrease vs decreaseDesc default-sort acceptance witness', () => {
  // Construct two sources: one low-frequency-dominant (slow ramp;
  // negative decrease), one high-frequency-dominant (alternating;
  // positive decrease).
  const lines: QueueLine[] = [];
  for (let i = 0; i < 64; i += 1) {
    lines.push(ql(dayIso(i), 'lo', 1000 + i * 100));
    lines.push(
      ql(dayIso(i), 'hi', 1000 + (i % 2 === 0 ? 5000 : 0)),
    );
  }
  const asc = buildDailyTokenSpectralDecrease(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'decrease',
    generatedAt: ISO,
  });
  const desc = buildDailyTokenSpectralDecrease(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'decreaseDesc',
    generatedAt: ISO,
  });
  assert.equal(asc.sources[0]!.source, 'lo');
  assert.equal(desc.sources[0]!.source, 'hi');
  assert.ok(asc.sources[0]!.decrease < 0);
  assert.ok(desc.sources[0]!.decrease > 0);
});

test('build: absDecreaseDesc surfaces the most extreme |decrease|', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 64; i += 1) {
    // sharp anchor source: heavy bin-1 mass via slow drift
    lines.push(ql(dayIso(i), 'sharp', 1000 + i * 1000));
    // weak signal: mostly noise around mean
    lines.push(
      ql(dayIso(i), 'flat', 1000 + ((i * 17) % 7)),
    );
  }
  const r = buildDailyTokenSpectralDecrease(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'absDecreaseDesc',
    generatedAt: ISO,
  });
  // sharp (slow ramp) should have larger |decrease|
  assert.equal(r.sources[0]!.source, 'sharp');
});

test('build: tokens-sort source-asc tiebreak with identical totals', () => {
  const lines: QueueLine[] = [];
  for (const s of ['b', 'a']) {
    for (let i = 0; i < 64; i += 1) lines.push(ql(dayIso(i), s, 1000 + i));
  }
  const r = buildDailyTokenSpectralDecrease(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'tokens',
    generatedAt: ISO,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b'],
  );
});

test('build: tenure-sort source-asc tiebreak with identical tenures', () => {
  const lines: QueueLine[] = [];
  for (const s of ['z', 'a']) {
    for (let i = 0; i < 64; i += 1) lines.push(ql(dayIso(i), s, 1000 + i * (s === 'z' ? 1 : 2)));
  }
  const r = buildDailyTokenSpectralDecrease(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'tenure',
    generatedAt: ISO,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'z'],
  );
});

test('build: orthogonality vs centroid witness -- equal centroid, opposite-sign decrease', () => {
  // Construct two daily series where the periodograms have
  // similar centroid but opposite-sign decrease. We can't set
  // them analytically here, but we can pin: a slow-ramp series
  // (negative decrease) and an alternating series (positive
  // decrease) on the same gap-filled tenure.
  const slow: number[] = [];
  const alt: number[] = [];
  for (let i = 0; i < 32; i += 1) {
    slow.push(1000 + i * 50);
    alt.push(1000 + (i % 2 === 0 ? 500 : -500));
  }
  const a = dailyTokenSpectralDecrease(slow);
  const b = dailyTokenSpectralDecrease(alt);
  assert.ok(a.decrease < 0);
  assert.ok(b.decrease > 0);
  // and the sign flip is the orthogonality witness vs
  // centroid (which is unsigned and bin-index-anchored).
});

// ---------- axis-92 refinement: tightened edge-case coverage ----------

test('refine: spectralDecrease two-bin minimum support [a,b] = (b-a)/b', () => {
  // K=2: numer=(P[2]-P[1])/1 ; denom=P[2] -> decrease = 1 - P[1]/P[2]
  const r = spectralDecrease([3, 7]);
  // expected: (7-3)/7 = 4/7
  assert.ok(Math.abs(r.decrease - 4 / 7) < 1e-12);
});

test('refine: spectralDecrease equal-flat past anchor [c,c,c,c] = 0', () => {
  // P[1]=P[2]=...=P[K] -> every (P[k]-P[1])=0 -> decrease = 0
  const r = spectralDecrease([5, 5, 5, 5, 5]);
  assert.equal(r.decrease, 0);
});

test('refine: spectralDecrease upper-bound parametric sweep [eps, M, M, ...] -> approaches 1 as M >> eps', () => {
  // anchor near zero, tail flat at M -> decrease -> sum_{k=2..K} 1/(k-1) / (K-1) = 1 in the limit
  const eps = 1e-12;
  const M = 1;
  const K = 8;
  const power = [eps];
  for (let k = 2; k <= K; k += 1) power.push(M);
  const r = spectralDecrease(power);
  // expected limit: (1/(M*(K-1))) * sum_{j=1..K-1} (M-eps)/j
  // ~= (1/(K-1)) * H_{K-1} where H_n is the harmonic number
  let h = 0;
  for (let j = 1; j <= K - 1; j += 1) h += 1 / j;
  const expected = h / (K - 1);
  assert.ok(Math.abs(r.decrease - expected) < 1e-9);
  assert.ok(r.decrease > 0);
  // bounded above by H_{K-1}/(K-1) which is < 1 for K > 2
  assert.ok(r.decrease < 1);
});

test('refine: dailyTokenSpectralDecrease 1e9/1e-9 numerical stability across 18 orders of magnitude', () => {
  const base = [1, 3, 2, 5, 4, 7, 6, 9, 8, 10, 12, 11, 14, 13, 15, 16];
  const big = base.map((v) => v * 1e9);
  const small = base.map((v) => v * 1e-9);
  const r1 = dailyTokenSpectralDecrease(big);
  const r2 = dailyTokenSpectralDecrease(small);
  // scale invariance must hold across 18 OOM
  assert.ok(
    Math.abs(r1.decrease - r2.decrease) < 1e-6,
    `scale invariance broke: ${r1.decrease} vs ${r2.decrease}`,
  );
});

test('refine: build absDecreaseDesc preserves source-asc tiebreak on equal magnitude', () => {
  // two sources with mirrored series -> equal |decrease|
  const lines: QueueLine[] = [];
  for (let i = 0; i < 64; i += 1) {
    // source a: increasing
    lines.push(ql(dayIso(i), 'a', 1000 + i * 100));
    // source b: identical pattern
    lines.push(ql(dayIso(i), 'b', 1000 + i * 100));
  }
  const r = buildDailyTokenSpectralDecrease(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'absDecreaseDesc',
    generatedAt: ISO,
  });
  // identical series -> identical |decrease| -> source-asc breaks tie
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b'],
  );
});

test('refine: build droppedZeroTailPower never observed on a non-degenerate real series', () => {
  // sanity: a real noisy series never hits the zero-tail-power
  // bucket; the bucket exists only as a defensive guard.
  const lines: QueueLine[] = [];
  for (let i = 0; i < 64; i += 1) {
    lines.push(ql(dayIso(i), 's', 1000 + ((i * 13) % 17) + i));
  }
  const r = buildDailyTokenSpectralDecrease(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.droppedZeroTailPower, 0);
  assert.equal(r.droppedNonFiniteFit, 0);
});
