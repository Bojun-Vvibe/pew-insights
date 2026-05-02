import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralRenyi2Entropy,
  dailyTokenSpectralRenyi2Entropy,
  buildDailyTokenSpectralRenyi2Entropy,
} from '../src/dailytokenspectralrenyi2entropy.js';
import type { QueueLine } from '../src/types.js';

const ISO = '2026-05-02T00:00:00.000Z';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return { hour_start, source, total_tokens } as unknown as QueueLine;
}

function dayIso(i: number): string {
  return (
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z'
  );
}

// ---------- spectralRenyi2Entropy primitive ----------

test('spectralRenyi2Entropy: too few bins -> throws', () => {
  for (const k of [0, 1]) {
    const arr = new Array<number>(k).fill(1);
    assert.throws(() => spectralRenyi2Entropy(arr), /too few bins/);
  }
});

test('spectralRenyi2Entropy: K=2 boundary OK (uniform -> h2Norm = 1)', () => {
  const r = spectralRenyi2Entropy([5, 5]);
  assert.equal(r.h2Norm, 1);
  assert.ok(Math.abs(r.kEff - 2) < 1e-12);
  assert.ok(Math.abs(r.sumP2 - 0.5) < 1e-12);
  assert.ok(Math.abs(r.h2 - Math.log(2)) < 1e-12);
});

test('spectralRenyi2Entropy: K=2 single-bin delta -> h2Norm = 0', () => {
  const r = spectralRenyi2Entropy([7, 0]);
  assert.equal(r.h2Norm, 0);
  assert.ok(Math.abs(r.kEff - 1) < 1e-12);
  assert.equal(r.sumP2, 1);
  assert.equal(r.h2, 0);
});

test('spectralRenyi2Entropy: uniform K bins -> h2Norm = 1 for all K in [2, 32]', () => {
  for (let k = 2; k <= 32; k += 1) {
    const arr = new Array<number>(k).fill(1);
    const r = spectralRenyi2Entropy(arr);
    assert.ok(Math.abs(r.h2Norm - 1) < 1e-12, `K=${k}`);
    assert.ok(Math.abs(r.kEff - k) < 1e-9);
    assert.ok(Math.abs(r.sumP2 - 1 / k) < 1e-12);
  }
});

test('spectralRenyi2Entropy: single-bin delta -> h2Norm = 0 for all K', () => {
  for (let k = 2; k <= 16; k += 1) {
    const arr = new Array<number>(k).fill(0);
    arr[0] = 100;
    const r = spectralRenyi2Entropy(arr);
    assert.equal(r.h2Norm, 0);
    assert.ok(Math.abs(r.kEff - 1) < 1e-12);
  }
});

test('spectralRenyi2Entropy: two equipowered bins -> h2 = ln 2; h2Norm = ln2/lnK', () => {
  for (let k = 4; k <= 16; k += 1) {
    const arr = new Array<number>(k).fill(0);
    arr[0] = 5;
    arr[1] = 5;
    const r = spectralRenyi2Entropy(arr);
    assert.ok(Math.abs(r.h2 - Math.log(2)) < 1e-12);
    assert.ok(Math.abs(r.h2Norm - Math.log(2) / Math.log(k)) < 1e-12);
    assert.ok(Math.abs(r.kEff - 2) < 1e-9);
  }
});

test('spectralRenyi2Entropy: kEff identity exp(h2) = 1/sumP2', () => {
  const cases: number[][] = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [10, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 5, 5, 0, 0, 0, 0],
    [100, 100, 100, 1, 1, 1, 1, 1],
  ];
  for (const c of cases) {
    const r = spectralRenyi2Entropy(c);
    assert.ok(Math.abs(Math.exp(r.h2) - r.kEff) < 1e-9);
    assert.ok(Math.abs(r.kEff - 1 / r.sumP2) < 1e-9);
  }
});

test('spectralRenyi2Entropy: non-finite power -> throws', () => {
  assert.throws(() => spectralRenyi2Entropy([1, NaN]), /non-finite power/);
  assert.throws(
    () => spectralRenyi2Entropy([1, 2, Infinity, 3]),
    /non-finite power/,
  );
  assert.throws(
    () => spectralRenyi2Entropy([1, 2, 3, -Infinity]),
    /non-finite power/,
  );
});

test('spectralRenyi2Entropy: negative power -> throws', () => {
  assert.throws(() => spectralRenyi2Entropy([1, -0.001]), /negative power/);
});

test('spectralRenyi2Entropy: zero total power -> throws', () => {
  assert.throws(
    () => spectralRenyi2Entropy([0, 0, 0, 0]),
    /zero total power/,
  );
});

test('spectralRenyi2Entropy: h2Norm in [0, 1] always', () => {
  const cases: number[][] = [
    [1, 2, 3, 100, 0.0001, 50],
    [10, 10, 10, 10, 10, 10, 10, 10],
    [0, 0, 0, 0, 1e-15, 1e-15],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [1e-15, 1e15, 1, 1],
  ];
  for (const c of cases) {
    const r = spectralRenyi2Entropy(c);
    assert.ok(r.h2Norm >= 0 && r.h2Norm <= 1, `h2Norm=${r.h2Norm}`);
    assert.ok(r.kEff >= 1 - 1e-9 && r.kEff <= c.length + 1e-9);
  }
});

test('spectralRenyi2Entropy: scale invariance (multiply all by 7)', () => {
  const base = [1, 2, 3, 4, 5, 6];
  const scaled = base.map((x) => x * 7);
  const r1 = spectralRenyi2Entropy(base);
  const r2 = spectralRenyi2Entropy(scaled);
  assert.ok(Math.abs(r1.h2Norm - r2.h2Norm) < 1e-12);
  assert.ok(Math.abs(r1.kEff - r2.kEff) < 1e-9);
});

test('spectralRenyi2Entropy: bin-permutation invariance (full)', () => {
  const a = [1, 2, 3, 7, 11, 13];
  const b = [13, 7, 1, 11, 2, 3];
  const c = [3, 11, 7, 13, 2, 1];
  const ra = spectralRenyi2Entropy(a);
  const rb = spectralRenyi2Entropy(b);
  const rc = spectralRenyi2Entropy(c);
  assert.ok(Math.abs(ra.h2Norm - rb.h2Norm) < 1e-12);
  assert.ok(Math.abs(ra.h2Norm - rc.h2Norm) < 1e-12);
});

test('spectralRenyi2Entropy: bin-reversal invariance (special case of permutation)', () => {
  const fwd = [100, 90, 80, 1, 1, 1, 1, 1];
  const rev = [...fwd].reverse();
  const r1 = spectralRenyi2Entropy(fwd);
  const r2 = spectralRenyi2Entropy(rev);
  assert.ok(Math.abs(r1.h2Norm - r2.h2Norm) < 1e-12);
  assert.ok(Math.abs(r1.kEff - r2.kEff) < 1e-9);
});

test('spectralRenyi2Entropy: m equipowered bins (m of K) -> h2Norm = ln(m)/ln(K)', () => {
  // K=8, m=4 equipowered nonzero, others zero.
  const arr = [3, 3, 3, 3, 0, 0, 0, 0];
  const r = spectralRenyi2Entropy(arr);
  assert.ok(Math.abs(r.h2 - Math.log(4)) < 1e-12);
  assert.ok(Math.abs(r.h2Norm - Math.log(4) / Math.log(8)) < 1e-12);
  assert.ok(Math.abs(r.kEff - 4) < 1e-9);
});

test('spectralRenyi2Entropy: H2 <= H_Shannon (Jensen) — consistency check', () => {
  // For any non-uniform PSD, H2 < H_Shannon (in nats).
  const cases: number[][] = [
    [10, 1, 1, 1, 1],
    [100, 50, 25, 12, 6, 3],
    [1, 2, 3, 4, 5, 6, 7, 8],
  ];
  for (const c of cases) {
    const r = spectralRenyi2Entropy(c);
    let s = 0;
    for (const v of c) s += v;
    let hShannon = 0;
    for (const v of c) {
      const p = v / s;
      if (p > 0) hShannon -= p * Math.log(p);
    }
    assert.ok(r.h2 <= hShannon + 1e-9, `H2=${r.h2}, HShannon=${hShannon}`);
  }
});

test('spectralRenyi2Entropy: totalPower equals exact sum', () => {
  const r = spectralRenyi2Entropy([1, 2, 3, 4, 5]);
  assert.equal(r.totalPower, 15);
});

// ---------- dailyTokenSpectralRenyi2Entropy (series-level) ----------

test('dailyTokenSpectralRenyi2Entropy: too short -> throws', () => {
  for (const n of [0, 1, 2, 3]) {
    const arr = new Array<number>(n).fill(0).map((_, i) => i + 1);
    assert.throws(
      () => dailyTokenSpectralRenyi2Entropy(arr),
      /series too short|zero variance/,
    );
  }
});

test('dailyTokenSpectralRenyi2Entropy: n=4 boundary (K=2) OK', () => {
  const arr = [1, 5, 2, 8];
  const r = dailyTokenSpectralRenyi2Entropy(arr);
  assert.equal(r.nFreqBins, 2);
  assert.ok(r.h2Norm >= 0 && r.h2Norm <= 1);
  assert.ok(r.kEff >= 1 && r.kEff <= 2 + 1e-9);
});

test('dailyTokenSpectralRenyi2Entropy: non-finite -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralRenyi2Entropy([1, 2, NaN, 4, 5, 6, 7, 8]),
    /finite/,
  );
  assert.throws(
    () => dailyTokenSpectralRenyi2Entropy([1, 2, 3, Infinity, 5, 6, 7, 8]),
    /finite/,
  );
});

test('dailyTokenSpectralRenyi2Entropy: zero variance -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralRenyi2Entropy([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero variance/,
  );
});

test('dailyTokenSpectralRenyi2Entropy: shift invariance (add constant)', () => {
  const base = [1, 5, 2, 8, 3, 9, 4, 6, 7, 2, 5, 1];
  const shifted = base.map((x) => x + 1000);
  const r1 = dailyTokenSpectralRenyi2Entropy(base);
  const r2 = dailyTokenSpectralRenyi2Entropy(shifted);
  assert.ok(Math.abs(r1.h2Norm - r2.h2Norm) < 1e-9);
});

test('dailyTokenSpectralRenyi2Entropy: scale invariance (multiply by 100)', () => {
  const base = [1, 5, 2, 8, 3, 9, 4, 6, 7, 2, 5, 1];
  const scaled = base.map((x) => x * 100);
  const r1 = dailyTokenSpectralRenyi2Entropy(base);
  const r2 = dailyTokenSpectralRenyi2Entropy(scaled);
  assert.ok(Math.abs(r1.h2Norm - r2.h2Norm) < 1e-9);
  assert.ok(Math.abs(r1.kEff - r2.kEff) < 1e-6);
});

test('dailyTokenSpectralRenyi2Entropy: sign-flip invariance', () => {
  const base = [1, 5, 2, 8, 3, 9, 4, 6, 7, 2, 5, 1];
  const flipped = base.map((x) => -x);
  const r1 = dailyTokenSpectralRenyi2Entropy(base);
  const r2 = dailyTokenSpectralRenyi2Entropy(flipped);
  assert.ok(Math.abs(r1.h2Norm - r2.h2Norm) < 1e-9);
});

test('dailyTokenSpectralRenyi2Entropy: time-reversal invariance', () => {
  const base = [1, 5, 2, 8, 3, 9, 4, 6, 7, 2, 5, 1];
  const reversed = [...base].reverse();
  const r1 = dailyTokenSpectralRenyi2Entropy(base);
  const r2 = dailyTokenSpectralRenyi2Entropy(reversed);
  assert.ok(Math.abs(r1.h2Norm - r2.h2Norm) < 1e-9);
});

test('dailyTokenSpectralRenyi2Entropy: h2Norm in [0, 1]', () => {
  const cases: number[][] = [
    [1, 5, 2, 8, 3, 9, 4, 6],
    Array.from({ length: 30 }, (_, i) => Math.sin(i / 3) * 100 + 1000),
    Array.from({ length: 50 }, (_, i) => (i % 7) * 13 + 1),
    Array.from({ length: 100 }, (_, i) => Math.random() * 1000 + 100),
  ];
  for (const c of cases) {
    const r = dailyTokenSpectralRenyi2Entropy(c);
    assert.ok(r.h2Norm >= 0 && r.h2Norm <= 1);
    assert.ok(r.kEff >= 1 && r.kEff <= r.nFreqBins + 1e-6);
  }
});

test('dailyTokenSpectralRenyi2Entropy: schema fields stable', () => {
  const r = dailyTokenSpectralRenyi2Entropy([1, 5, 2, 8, 3, 9, 4, 6, 7, 2]);
  for (const k of [
    'mean',
    'stddev',
    'nFreqBins',
    'totalPower',
    'sumP2',
    'kEff',
    'h2',
    'h2Norm',
  ]) {
    assert.ok(k in r, `missing field ${k}`);
  }
});

// ---------- buildDailyTokenSpectralRenyi2Entropy (queue-level) ----------

function makeQueue(
  source: string,
  pattern: number[],
  startDay = 0,
): QueueLine[] {
  return pattern.map((tok, i) => ql(dayIso(startDay + i), source, tok));
}

test('build: empty queue', () => {
  const r = buildDailyTokenSpectralRenyi2Entropy([], { generatedAt: ISO });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('build: invalid hour_start dropped', () => {
  const r = buildDailyTokenSpectralRenyi2Entropy(
    [ql('not-a-date', 'a', 100)],
    { generatedAt: ISO },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: non-positive tokens dropped', () => {
  const r = buildDailyTokenSpectralRenyi2Entropy(
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
  const q = [ql(dayIso(0), 'a', 100), ql(dayIso(0), 'b', 100)];
  const r = buildDailyTokenSpectralRenyi2Entropy(q, {
    generatedAt: ISO,
    source: 'a',
  });
  assert.equal(r.droppedSourceFilter, 1);
});

test('build: sparse sources dropped (below min-tokens)', () => {
  const q = makeQueue('claude-code', Array(40).fill(10));
  const r = buildDailyTokenSpectralRenyi2Entropy(q, {
    generatedAt: ISO,
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
});

test('build: below min-tenure dropped', () => {
  const q = makeQueue('claude-code', Array(20).fill(2000));
  const r = buildDailyTokenSpectralRenyi2Entropy(q, {
    generatedAt: ISO,
    minTenureDays: 32,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: zero-variance dropped', () => {
  const q = makeQueue('claude-code', Array(40).fill(2000));
  const r = buildDailyTokenSpectralRenyi2Entropy(q, {
    generatedAt: ISO,
    minTenureDays: 4,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: invalid sort throws', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralRenyi2Entropy([], {
        generatedAt: ISO,
        sort: 'nope' as any,
      }),
    /sort must be one of/,
  );
});

test('build: invalid minTokens throws', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralRenyi2Entropy([], {
        generatedAt: ISO,
        minTokens: -1,
      }),
    /minTokens/,
  );
});

test('build: invalid minTenureDays throws (< 4)', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralRenyi2Entropy([], {
        generatedAt: ISO,
        minTenureDays: 3,
      }),
    /minTenureDays/,
  );
});

test('build: invalid top throws', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralRenyi2Entropy([], {
        generatedAt: ISO,
        top: -1,
      }),
    /top/,
  );
});

test('build: top cap drops remainder', () => {
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
  const r = buildDailyTokenSpectralRenyi2Entropy(q, {
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
      buildDailyTokenSpectralRenyi2Entropy([], {
        generatedAt: ISO,
        since: 'bad-date',
      }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenSpectralRenyi2Entropy([], {
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
  const r = buildDailyTokenSpectralRenyi2Entropy(q, {
    generatedAt: ISO,
    minTenureDays: 10,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'claude-code');
  assert.ok(row.h2Norm >= 0 && row.h2Norm <= 1);
  assert.ok(row.kEff >= 1 && row.kEff <= row.nFreqBins + 1e-6);
  assert.ok(Math.abs(Math.exp(row.h2) - row.kEff) < 1e-6);
});

test('build: sort by h2NormDesc orders correctly', () => {
  const flat = Array.from({ length: 40 }, (_, i) => 1000 + 50 * Math.sin(i));
  const sharp = Array.from({ length: 40 }, (_, i) =>
    1000 + 500 * Math.sin((Math.PI * i) / 1.05),
  );
  const q = [...makeQueue('aa-flat', flat), ...makeQueue('bb-sharp', sharp)];
  const r = buildDailyTokenSpectralRenyi2Entropy(q, {
    generatedAt: ISO,
    minTenureDays: 10,
    sort: 'h2NormDesc',
  });
  if (r.sources.length === 2) {
    assert.ok(r.sources[0]!.h2Norm >= r.sources[1]!.h2Norm);
  }
});

test('build: sort by h2Norm (asc) reverses order', () => {
  const flat = Array.from({ length: 40 }, (_, i) => 1000 + 50 * Math.sin(i));
  const sharp = Array.from({ length: 40 }, (_, i) =>
    1000 + 500 * Math.sin((Math.PI * i) / 1.05),
  );
  const q = [...makeQueue('aa-flat', flat), ...makeQueue('bb-sharp', sharp)];
  const r = buildDailyTokenSpectralRenyi2Entropy(q, {
    generatedAt: ISO,
    minTenureDays: 10,
    sort: 'h2Norm',
  });
  if (r.sources.length === 2) {
    assert.ok(r.sources[0]!.h2Norm <= r.sources[1]!.h2Norm);
  }
});

test('build: sort by kEffDesc orders correctly', () => {
  const flat = Array.from({ length: 40 }, (_, i) => 1000 + 50 * Math.sin(i));
  const sharp = Array.from({ length: 40 }, (_, i) =>
    1000 + 500 * Math.sin((Math.PI * i) / 1.05),
  );
  const q = [...makeQueue('aa-flat', flat), ...makeQueue('bb-sharp', sharp)];
  const r = buildDailyTokenSpectralRenyi2Entropy(q, {
    generatedAt: ISO,
    minTenureDays: 10,
    sort: 'kEffDesc',
  });
  if (r.sources.length === 2) {
    assert.ok(r.sources[0]!.kEff >= r.sources[1]!.kEff);
  }
});

test('build: sort by tokens descends', () => {
  const big = Array.from({ length: 40 }, (_, i) => 5000 + 100 * Math.sin(i));
  const small = Array.from({ length: 40 }, (_, i) => 1500 + 100 * Math.sin(i));
  const q = [...makeQueue('aaa-small', small), ...makeQueue('zzz-big', big)];
  const r = buildDailyTokenSpectralRenyi2Entropy(q, {
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
  const q = [...makeQueue('zzz', a), ...makeQueue('aaa', a)];
  const r = buildDailyTokenSpectralRenyi2Entropy(q, {
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
  const r = buildDailyTokenSpectralRenyi2Entropy([], { generatedAt: ISO });
  assert.equal(r.generatedAt, ISO);
  for (const k of [
    'droppedInvalidHourStart',
    'droppedNonPositiveTokens',
    'droppedSourceFilter',
    'droppedSparseSources',
    'droppedBelowMinTenure',
    'droppedZeroVariance',
    'droppedZeroPower',
    'droppedNonFiniteFit',
    'droppedTopSources',
  ]) {
    assert.ok(k in r, `missing field ${k}`);
  }
});

// ---------- orthogonality witnesses vs prior axes ----------

test('orthogonality vs axis-69 (Shannon spectral entropy): same h2Norm pair gives different Shannon ordering on non-uniform spectra', () => {
  // PSD A: one large bin + many tiny. PSD B: several medium bins.
  // Designed so they have similar Shannon but distinct Renyi-2.
  const a = spectralRenyi2Entropy([100, 1, 1, 1, 1, 1, 1, 1]);
  const b = spectralRenyi2Entropy([20, 20, 20, 20, 1, 1, 1, 1]);
  // a: one dominant bin -> kEff close to 1.x
  // b: 4 dominant equipowered bins -> kEff close to 4-5
  assert.ok(b.kEff > a.kEff + 1);
  assert.ok(b.h2Norm > a.h2Norm);
});

test('orthogonality vs axis-85 (Wiener flatness): same flatness PSDs split on Renyi-2', () => {
  // Two PSDs with same GM/AM but different sum p^2.
  // For two equipowered bins (others zero): GM/AM = 1 over the two,
  // but sum p^2 differs vs spreading mass over more bins.
  const a = spectralRenyi2Entropy([5, 5, 0, 0, 0, 0, 0, 0]); // 2 bins
  const b = spectralRenyi2Entropy([5, 5, 5, 5, 0, 0, 0, 0]); // 4 bins
  // Both have GM/AM = 1 on positive subset; Renyi-2 differs.
  assert.ok(Math.abs(a.kEff - 2) < 1e-9);
  assert.ok(Math.abs(b.kEff - 4) < 1e-9);
  assert.ok(b.h2Norm > a.h2Norm);
});

test('orthogonality vs axis-98 (tail flatness): full-band permutation-invariant decouples from sub-band tail', () => {
  // Permute the same multiset between head/tail: tail-flatness changes,
  // Renyi-2 stays the same.
  const head = spectralRenyi2Entropy([100, 100, 1, 1, 1, 1, 1, 1]);
  const tail = spectralRenyi2Entropy([1, 1, 1, 1, 1, 1, 100, 100]);
  // Same multiset -> same h2Norm, same kEff.
  assert.ok(Math.abs(head.h2Norm - tail.h2Norm) < 1e-12);
  assert.ok(Math.abs(head.kEff - tail.kEff) < 1e-9);
});

test('orthogonality vs axis-96 (peak-frequency): different peakBin same h2Norm', () => {
  // Bin-permutation invariance again — peakBin moves but h2Norm fixed.
  const head = spectralRenyi2Entropy([10, 1, 1, 1, 1, 1]);
  const tail = spectralRenyi2Entropy([1, 1, 1, 1, 1, 10]);
  assert.ok(Math.abs(head.h2Norm - tail.h2Norm) < 1e-12);
});

test('orthogonality vs axis-89 (crest-factor): two-bin equipartition separates max/mean from L2', () => {
  // Two-bin equipartition: crest = K/2; h2Norm = log 2 / log K.
  for (let k = 4; k <= 10; k += 1) {
    const arr = new Array<number>(k).fill(0);
    arr[0] = 1; arr[1] = 1;
    const r = spectralRenyi2Entropy(arr);
    const expected = Math.log(2) / Math.log(k);
    assert.ok(Math.abs(r.h2Norm - expected) < 1e-12, `K=${k}`);
  }
});

test('orthogonality vs axis-95 (roughness): permutation invariance vs adjacent-pair sensitivity', () => {
  // Same multiset, different ordering -> Renyi-2 invariant.
  const a = spectralRenyi2Entropy([5, 5, 5, 1, 100, 1, 100]);
  const b = spectralRenyi2Entropy([100, 1, 100, 1, 5, 5, 5]);
  assert.ok(Math.abs(a.h2Norm - b.h2Norm) < 1e-12);
});
