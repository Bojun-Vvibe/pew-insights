import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralCrestFactor,
  dailyTokenSpectralCrestFactor,
  buildDailyTokenSpectralCrestFactor,
} from '../src/dailytokenspectralcrestfactor.js';
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

// ---------- spectralCrestFactor primitive ----------

test('spectralCrestFactor: empty input -> throws', () => {
  assert.throws(() => spectralCrestFactor([]), /empty power vector/);
});

test('spectralCrestFactor: non-finite power -> throws', () => {
  assert.throws(
    () => spectralCrestFactor([1, 2, NaN]),
    /non-finite power/,
  );
  assert.throws(
    () => spectralCrestFactor([1, 2, Infinity]),
    /non-finite power/,
  );
  assert.throws(
    () => spectralCrestFactor([1, 2, -Infinity]),
    /non-finite power/,
  );
});

test('spectralCrestFactor: negative power -> throws', () => {
  assert.throws(
    () => spectralCrestFactor([1, 2, -0.5]),
    /negative power/,
  );
});

test('spectralCrestFactor: only one positive bin -> throws', () => {
  assert.throws(
    () => spectralCrestFactor([0, 0, 1, 0]),
    /too few positive-power bins/,
  );
});

test('spectralCrestFactor: zero positive bins -> throws', () => {
  assert.throws(
    () => spectralCrestFactor([0, 0, 0, 0]),
    /too few positive-power bins/,
  );
});

test('spectralCrestFactor: uniform power -> crest = 1 (white-noise asymptote)', () => {
  // Uniform power -> peak/mean = 1 exactly; peakBin is the
  // FIRST max (lowest k). peakBinShare = 1/m.
  const K = 100;
  const p = new Array(K).fill(1);
  const r = spectralCrestFactor(p);
  assert.equal(r.crestFactor, 1);
  assert.equal(r.peakBin, 1);
  assert.equal(r.usableBins, K);
  assert.ok(Math.abs(r.peakBinShare - 1 / K) < 1e-12);
});

test('spectralCrestFactor: single-tone asymptote -> crest = usableBins', () => {
  // One huge bin and many strictly-positive small equal bins.
  // mean = (huge + (m-1)*small)/m; with huge -> infinity the
  // ratio approaches m. We test the exact algebra on a small
  // case: m=4 with bins [eps, eps, eps, BIG] -> crest = BIG /
  // ((3*eps + BIG)/4) -> 4 as eps -> 0.
  const eps = 1e-12;
  const BIG = 1;
  const p = [eps, eps, eps, BIG];
  const r = spectralCrestFactor(p);
  assert.equal(r.peakBin, 4);
  assert.equal(r.usableBins, 4);
  // crestFactor very close to its upper bound usableBins=4.
  assert.ok(r.crestFactor > 3.99 && r.crestFactor <= 4);
  assert.ok(r.peakBinShare > 0.999);
});

test('spectralCrestFactor: closed-form on [1, 4]', () => {
  // bins (1, 2) with power (1, 4); m=2; total = 5; mean = 2.5;
  // peak = 4; crest = 4/2.5 = 1.6; peakBin = 2; share = 0.8.
  const r = spectralCrestFactor([1, 4]);
  assert.equal(r.peakBin, 2);
  assert.equal(r.usableBins, 2);
  assert.ok(Math.abs(r.crestFactor - 1.6) < 1e-12);
  assert.ok(Math.abs(r.peakBinShare - 0.8) < 1e-12);
});

test('spectralCrestFactor: ties -> lowest k wins (deterministic argmax)', () => {
  // bins all equal -> argmax is the FIRST positive bin.
  const r = spectralCrestFactor([0, 5, 5, 5]);
  assert.equal(r.peakBin, 2);
  assert.equal(r.usableBins, 3);
  assert.equal(r.crestFactor, 1);
});

test('spectralCrestFactor: bin-permutation invariant', () => {
  // Same multiset of powers -> same crest, same peakBinShare,
  // but peakBin moves with the permutation. Verifies the key
  // orthogonality witness vs rolloff/centroid/bandwidth.
  const a = spectralCrestFactor([1, 2, 3, 4, 5]);
  const b = spectralCrestFactor([5, 4, 3, 2, 1]);
  const c = spectralCrestFactor([3, 1, 5, 2, 4]);
  assert.ok(Math.abs(a.crestFactor - b.crestFactor) < 1e-12);
  assert.ok(Math.abs(a.crestFactor - c.crestFactor) < 1e-12);
  assert.ok(Math.abs(a.peakBinShare - b.peakBinShare) < 1e-12);
  assert.equal(a.peakBin, 5);
  assert.equal(b.peakBin, 1);
  assert.equal(c.peakBin, 3);
});

test('spectralCrestFactor: scale-invariant for any non-zero a', () => {
  const p = [1, 2, 3, 4, 5];
  const a = spectralCrestFactor(p);
  for (const s of [0.001, 1, 7, 1e6]) {
    const r = spectralCrestFactor(p.map((x) => x * s));
    assert.ok(Math.abs(r.crestFactor - a.crestFactor) < 1e-9);
    assert.equal(r.peakBin, a.peakBin);
  }
});

// ---------- dailyTokenSpectralCrestFactor primitive ----------

test('dailyTokenSpectralCrestFactor: too short -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralCrestFactor([1, 2, 3, 4, 5, 6, 7]),
    /too short/,
  );
});

test('dailyTokenSpectralCrestFactor: non-finite -> throws', () => {
  assert.throws(
    () =>
      dailyTokenSpectralCrestFactor([1, 2, 3, 4, 5, 6, 7, NaN]),
    /finite values/,
  );
});

test('dailyTokenSpectralCrestFactor: zero variance -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralCrestFactor(new Array(16).fill(7)),
    /zero variance/,
  );
});

test('dailyTokenSpectralCrestFactor: pure sinusoid -> crest concentrated at the tone bin', () => {
  // Build a sinusoid with period exactly N/k for k=3, N=64.
  // The mean-centred periodogram should have a strong peak at
  // bin 3 and tiny leakage elsewhere -> large crest factor.
  const N = 64;
  const k0 = 3;
  const y: number[] = [];
  for (let i = 0; i < N; i += 1) {
    y.push(100 + 10 * Math.cos((2 * Math.PI * k0 * i) / N));
  }
  const r = dailyTokenSpectralCrestFactor(y);
  assert.equal(r.peakBin, k0);
  assert.equal(r.nFreqBins, N / 2);
  assert.ok(r.crestFactor > 5, `expected crest > 5, got ${r.crestFactor}`);
  assert.ok(r.peakBinShare > 0.5);
  // Peak at bin 3 of K=32 -> peakBinNormalised = 3/32.
  assert.ok(Math.abs(r.peakBinNormalised - 3 / 32) < 1e-9);
});

test('dailyTokenSpectralCrestFactor: scale-invariance on real series', () => {
  const y = [10, 30, 5, 22, 18, 7, 14, 9, 25, 11, 8, 19, 6, 20, 13, 16];
  const a = dailyTokenSpectralCrestFactor(y);
  const b = dailyTokenSpectralCrestFactor(y.map((v) => 1000 * v));
  assert.ok(Math.abs(a.crestFactor - b.crestFactor) < 1e-9);
  assert.equal(a.peakBin, b.peakBin);
});

test('dailyTokenSpectralCrestFactor: shift-invariance on real series', () => {
  const y = [10, 30, 5, 22, 18, 7, 14, 9, 25, 11, 8, 19, 6, 20, 13, 16];
  const a = dailyTokenSpectralCrestFactor(y);
  const b = dailyTokenSpectralCrestFactor(y.map((v) => v + 12345));
  // Shift only moves the DC bin; non-DC bins are identical.
  assert.ok(Math.abs(a.crestFactor - b.crestFactor) < 1e-9);
  assert.equal(a.peakBin, b.peakBin);
});

test('dailyTokenSpectralCrestFactor: time-reversal-invariance', () => {
  const y = [10, 30, 5, 22, 18, 7, 14, 9, 25, 11, 8, 19, 6, 20, 13, 16];
  const a = dailyTokenSpectralCrestFactor(y);
  const b = dailyTokenSpectralCrestFactor([...y].reverse());
  assert.ok(Math.abs(a.crestFactor - b.crestFactor) < 1e-9);
});

test('dailyTokenSpectralCrestFactor: bound respected (crest >= 1, <= usableBins)', () => {
  const y = [10, 30, 5, 22, 18, 7, 14, 9, 25, 11, 8, 19, 6, 20, 13, 16];
  const r = dailyTokenSpectralCrestFactor(y);
  assert.ok(r.crestFactor >= 1 - 1e-12);
  assert.ok(r.crestFactor <= r.usableBins + 1e-12);
});

// ---------- buildDailyTokenSpectralCrestFactor orchestrator ----------

test('build: bad option validation', () => {
  assert.throws(
    () => buildDailyTokenSpectralCrestFactor([], { minTokens: -1 }),
    /minTokens/,
  );
  assert.throws(
    () => buildDailyTokenSpectralCrestFactor([], { minTenureDays: 7 }),
    /minTenureDays/,
  );
  assert.throws(
    () =>
      buildDailyTokenSpectralCrestFactor([], {
        minTenureDays: 8.5 as unknown as number,
      }),
    /minTenureDays/,
  );
  assert.throws(
    () => buildDailyTokenSpectralCrestFactor([], { top: -1 }),
    /top/,
  );
  assert.throws(
    () =>
      buildDailyTokenSpectralCrestFactor([], {
        sort: 'bogus' as unknown as 'crest',
      }),
    /sort/,
  );
  assert.throws(
    () => buildDailyTokenSpectralCrestFactor([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () => buildDailyTokenSpectralCrestFactor([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('build: empty queue -> empty report with zero counters', () => {
  const r = buildDailyTokenSpectralCrestFactor([], { generatedAt: ISO });
  assert.equal(r.generatedAt, ISO);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedInvalidHourStart, 0);
  assert.equal(r.droppedNonPositiveTokens, 0);
  assert.equal(r.droppedSparseSources, 0);
  assert.equal(r.droppedBelowMinTenure, 0);
  assert.equal(r.sort, 'crestDesc');
});

test('build: drop counters wired correctly', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql(dayIso(0), 'a', 0),
    ql(dayIso(1), 'a', -5),
  ];
  const r = buildDailyTokenSpectralCrestFactor(queue, {
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
  const r = buildDailyTokenSpectralCrestFactor(queue, {
    generatedAt: ISO,
    source: 'a',
    minTokens: 0,
  });
  assert.equal(r.droppedSourceFilter, 40); // all of b's 40 rows
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
  const r = buildDailyTokenSpectralCrestFactor(queue, {
    generatedAt: ISO,
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('build: minTenureDays shed -> droppedBelowMinTenure', () => {
  const queue: QueueLine[] = [];
  // 'short' has only 10 days of history -> below default 32.
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'short', 100));
  }
  // 'long' has 40 days, varying.
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'long', 100 + (i % 7) * 10));
  }
  const r = buildDailyTokenSpectralCrestFactor(queue, {
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
  const r = buildDailyTokenSpectralCrestFactor(queue, {
    generatedAt: ISO,
    minTokens: 0,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('build: sort + top wiring', () => {
  // Two sources with very different crest factors.
  const queue: QueueLine[] = [];
  for (let i = 0; i < 64; i += 1) {
    // 'sin' is a strong sinusoid -> high crest.
    queue.push(
      ql(dayIso(i), 'sin', Math.round(1000 + 200 * Math.cos((2 * Math.PI * 5 * i) / 64))),
    );
    // 'mix' is a broadband mix of three tones -> low crest.
    queue.push(
      ql(
        dayIso(i),
        'mix',
        Math.round(
          1000 +
            50 * Math.cos((2 * Math.PI * 3 * i) / 64) +
            50 * Math.cos((2 * Math.PI * 7 * i) / 64) +
            50 * Math.cos((2 * Math.PI * 11 * i) / 64),
        ),
      ),
    );
  }
  const desc = buildDailyTokenSpectralCrestFactor(queue, {
    generatedAt: ISO,
    minTokens: 0,
  });
  assert.equal(desc.sources.length, 2);
  assert.equal(desc.sources[0]!.source, 'sin');
  assert.equal(desc.sources[1]!.source, 'mix');
  assert.ok(desc.sources[0]!.crestFactor > desc.sources[1]!.crestFactor);

  const asc = buildDailyTokenSpectralCrestFactor(queue, {
    generatedAt: ISO,
    minTokens: 0,
    sort: 'crest',
  });
  assert.equal(asc.sources[0]!.source, 'mix');
  assert.equal(asc.sources[1]!.source, 'sin');

  const top1 = buildDailyTokenSpectralCrestFactor(queue, {
    generatedAt: ISO,
    minTokens: 0,
    top: 1,
  });
  assert.equal(top1.sources.length, 1);
  assert.equal(top1.droppedTopSources, 1);
  assert.equal(top1.sources[0]!.source, 'sin');
});

test('build: sort=tokens orders by total tokens desc', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'a', 100 + (i % 7)));
    queue.push(ql(dayIso(i), 'b', 1_000_000 + (i % 5)));
  }
  const r = buildDailyTokenSpectralCrestFactor(queue, {
    generatedAt: ISO,
    minTokens: 0,
    sort: 'tokens',
  });
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[1]!.source, 'a');
});

test('build: sort=tenure orders by tenure desc; ties -> source asc', () => {
  const queue: QueueLine[] = [];
  // 'a' tenure 50, 'b' tenure 50 -> tie; should order a, b.
  for (let i = 0; i < 50; i += 1) {
    queue.push(ql(dayIso(i), 'a', 100 + (i % 7)));
    queue.push(ql(dayIso(i), 'b', 100 + (i % 5)));
  }
  // 'c' tenure 40 (later start) -> shorter, should sort last.
  for (let i = 5; i < 45; i += 1) {
    queue.push(ql(dayIso(i), 'c', 100 + (i % 7) * 2));
  }
  const r = buildDailyTokenSpectralCrestFactor(queue, {
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
  const r = buildDailyTokenSpectralCrestFactor(queue, {
    generatedAt: ISO,
    minTokens: 0,
    since: dayIso(20),
    until: dayIso(60),
  });
  assert.equal(r.sources[0]!.nTenureDays, 40);
});

test('build: per-source row carries all fields', () => {
  // Strong sinusoid, easy to verify peakBin and crest > 1.
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
  const r = buildDailyTokenSpectralCrestFactor(queue, {
    generatedAt: ISO,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'sin');
  assert.equal(row.nTenureDays, N);
  assert.equal(row.nFreqBins, N / 2);
  assert.equal(row.peakBin, k0);
  assert.ok(row.crestFactor > 1);
  assert.ok(row.peakBinShare > 0 && row.peakBinShare <= 1);
  assert.ok(row.peakBinNormalised > 0 && row.peakBinNormalised <= 1);
  assert.ok(Number.isFinite(row.mean) && row.mean > 0);
  assert.ok(Number.isFinite(row.stddev) && row.stddev >= 0);
  assert.equal(row.firstActiveDay, dayIso(0).slice(0, 10));
  assert.equal(row.lastActiveDay, dayIso(N - 1).slice(0, 10));
});

test('build: gap-filling extends tenure across silent days', () => {
  const queue: QueueLine[] = [];
  // Active on days 0..9 and 30..39 -> tenure spans 0..39 = 40.
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'gappy', 100 + i));
  }
  for (let i = 30; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'gappy', 200 + i));
  }
  const r = buildDailyTokenSpectralCrestFactor(queue, {
    generatedAt: ISO,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 40);
  assert.equal(r.sources[0]!.nActiveDays, 20);
});

// ---------- refinement coverage ----------

test('spectralCrestFactor: tight bound -- crest <= usableBins exactly at single-tone limit', () => {
  // Construct a strict single-tone limit: m=5 surviving bins
  // where four are exactly equal to eps and one carries the
  // mass; the upper bound usableBins = m must be respected
  // and approached as eps -> 0.
  for (const m of [3, 5, 8, 12]) {
    const eps = 1e-15;
    const p = new Array(m).fill(eps);
    p[m - 1] = 1;
    const r = spectralCrestFactor(p);
    assert.equal(r.usableBins, m);
    assert.ok(
      r.crestFactor <= m + 1e-9,
      `crest ${r.crestFactor} must be <= usableBins ${m}`,
    );
    assert.ok(
      r.crestFactor > m - 1e-6,
      `crest ${r.crestFactor} must approach usableBins ${m} as eps -> 0`,
    );
  }
});

test('spectralCrestFactor: bound respected on a hand-chosen mid-range case', () => {
  // bins (1, 1, 1, 5); m=4; total=8; mean=2; peak=5; crest=2.5;
  // share = 5/8 = 0.625; bound: 1 <= 2.5 <= 4. Sanity.
  const r = spectralCrestFactor([1, 1, 1, 5]);
  assert.equal(r.peakBin, 4);
  assert.equal(r.usableBins, 4);
  assert.ok(Math.abs(r.crestFactor - 2.5) < 1e-12);
  assert.ok(Math.abs(r.peakBinShare - 0.625) < 1e-12);
  assert.ok(r.crestFactor >= 1 && r.crestFactor <= r.usableBins);
});

test('build: --source round-trip pin -- single-source view matches the per-source row of the unfiltered view', () => {
  // Multi-source queue: building with --source X should
  // produce the SAME numeric row for X as the unfiltered build
  // (since the cross-source axis is per-source by definition).
  const queue: QueueLine[] = [];
  for (let i = 0; i < 50; i += 1) {
    queue.push(ql(dayIso(i), 'a', 100 + (i % 7) * 10));
    queue.push(ql(dayIso(i), 'b', 200 + (i % 5) * 5));
  }
  const all = buildDailyTokenSpectralCrestFactor(queue, {
    generatedAt: ISO,
    minTokens: 0,
  });
  const onlyA = buildDailyTokenSpectralCrestFactor(queue, {
    generatedAt: ISO,
    minTokens: 0,
    source: 'a',
  });
  const aRow = all.sources.find((s) => s.source === 'a')!;
  const aRowFiltered = onlyA.sources[0]!;
  assert.equal(aRowFiltered.source, aRow.source);
  assert.equal(aRowFiltered.peakBin, aRow.peakBin);
  assert.equal(aRowFiltered.usableBins, aRow.usableBins);
  assert.ok(Math.abs(aRowFiltered.crestFactor - aRow.crestFactor) < 1e-12);
  assert.ok(Math.abs(aRowFiltered.peakBinShare - aRow.peakBinShare) < 1e-12);
  assert.equal(aRowFiltered.nTenureDays, aRow.nTenureDays);
  assert.equal(aRowFiltered.totalTokens, aRow.totalTokens);
});

test('build: empty positive-power band (constant after gap-fill) surfaces under droppedZeroVariance, not droppedTooFewUsableBins', () => {
  // Single-source case where every gap-filled day is identical.
  // The variance-zero gate must catch this before periodogram
  // sees a degenerate input. Verifies counter routing.
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'flat2', 7));
  }
  const r = buildDailyTokenSpectralCrestFactor(queue, {
    generatedAt: ISO,
    minTokens: 0,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.droppedTooFewUsableBins, 0);
  assert.equal(r.droppedNonFiniteFit, 0);
});
