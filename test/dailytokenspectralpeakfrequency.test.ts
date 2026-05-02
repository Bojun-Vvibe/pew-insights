import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralPeakFrequency,
  dailyTokenSpectralPeakFrequency,
  buildDailyTokenSpectralPeakFrequency,
} from '../src/dailytokenspectralpeakfrequency.js';
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

// ---------- spectralPeakFrequency primitive ----------

test('spectralPeakFrequency: too few bins -> throws', () => {
  assert.throws(() => spectralPeakFrequency([]), /too few bins/);
  assert.throws(() => spectralPeakFrequency([1]), /too few bins/);
});

test('spectralPeakFrequency: non-finite power -> throws', () => {
  assert.throws(() => spectralPeakFrequency([1, NaN]), /non-finite power/);
  assert.throws(() => spectralPeakFrequency([1, Infinity]), /non-finite power/);
  assert.throws(
    () => spectralPeakFrequency([1, -Infinity]),
    /non-finite power/,
  );
});

test('spectralPeakFrequency: negative power -> throws', () => {
  assert.throws(() => spectralPeakFrequency([1, -2]), /negative power/);
});

test('spectralPeakFrequency: all-zero spectrum -> throws', () => {
  assert.throws(
    () => spectralPeakFrequency([0, 0, 0, 0]),
    /non-positive total power/,
  );
});

test('spectralPeakFrequency: constant PSD -> tied across bins, smallest-k wins', () => {
  const r = spectralPeakFrequency([5, 5, 5, 5, 5]);
  assert.equal(r.peakBin, 1);
  assert.equal(r.peakPower, 5);
  assert.equal(r.totalPower, 25);
  assert.equal(r.peakMassShare, 0.2);
});

test('spectralPeakFrequency: boundary spike at k=1 -> peakBin=1, mass=1', () => {
  const r = spectralPeakFrequency([1, 0, 0, 0]);
  assert.equal(r.peakBin, 1);
  assert.equal(r.peakPower, 1);
  assert.equal(r.totalPower, 1);
  assert.equal(r.peakMassShare, 1);
});

test('spectralPeakFrequency: boundary spike at k=K -> peakBin=K, mass=1', () => {
  const r = spectralPeakFrequency([0, 0, 0, 1]);
  assert.equal(r.peakBin, 4);
  assert.equal(r.peakMassShare, 1);
});

test('spectralPeakFrequency: interior spike at m -> peakBin=m', () => {
  for (let m = 1; m <= 5; m += 1) {
    const arr = [0, 0, 0, 0, 0];
    arr[m - 1] = 1;
    const r = spectralPeakFrequency(arr);
    assert.equal(r.peakBin, m, `interior spike at m=${m}`);
    assert.equal(r.peakMassShare, 1);
  }
});

test('spectralPeakFrequency: monotone ascending -> peakBin=K', () => {
  const r = spectralPeakFrequency([1, 2, 3, 4, 5]);
  assert.equal(r.peakBin, 5);
  assert.equal(r.peakPower, 5);
  assert.equal(r.totalPower, 15);
  assert.equal(r.peakMassShare, 5 / 15);
});

test('spectralPeakFrequency: monotone descending -> peakBin=1', () => {
  const r = spectralPeakFrequency([5, 4, 3, 2, 1]);
  assert.equal(r.peakBin, 1);
  assert.equal(r.peakPower, 5);
  assert.equal(r.totalPower, 15);
  assert.equal(r.peakMassShare, 5 / 15);
});

test('spectralPeakFrequency: bimodal equal peaks at k=1 and k=K -> argmax = 1 (smallest-k tie-break)', () => {
  const r = spectralPeakFrequency([7, 0, 0, 0, 7]);
  assert.equal(r.peakBin, 1);
  assert.equal(r.peakPower, 7);
  assert.equal(r.peakMassShare, 7 / 14);
});

test('spectralPeakFrequency: bimodal unequal peaks -> argmax = larger', () => {
  const r = spectralPeakFrequency([7, 0, 0, 0, 9]);
  assert.equal(r.peakBin, 5);
  assert.equal(r.peakPower, 9);
});

test('spectralPeakFrequency: scale-invariance of peakBin under positive scaling', () => {
  const base = [1, 5, 3, 4, 2];
  const a = spectralPeakFrequency(base);
  const b = spectralPeakFrequency(base.map((v) => v * 1e9));
  assert.equal(a.peakBin, b.peakBin);
  assert.equal(a.peakMassShare.toFixed(12), b.peakMassShare.toFixed(12));
});

test('spectralPeakFrequency: bin-reversal flips argmax to K + 1 - k*', () => {
  const base = [10, 5, 3, 1];
  const a = spectralPeakFrequency(base);
  const b = spectralPeakFrequency([...base].reverse());
  assert.equal(a.peakBin, 1);
  assert.equal(b.peakBin, 4); // K + 1 - 1
  assert.equal(a.peakMassShare, b.peakMassShare);
});

test('spectralPeakFrequency: bin-permutation generally moves argmax', () => {
  const base = [1, 9, 2, 3];
  const r1 = spectralPeakFrequency(base);
  assert.equal(r1.peakBin, 2);
  const r2 = spectralPeakFrequency([9, 1, 2, 3]);
  assert.equal(r2.peakBin, 1);
  // peakMassShare is multiset-invariant (same numerator and denominator)
  assert.equal(r1.peakMassShare, r2.peakMassShare);
});

// ---------- dailyTokenSpectralPeakFrequency primitive ----------

test('dailyTokenSpectralPeakFrequency: too short -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralPeakFrequency([1, 2, 3, 4, 5, 6, 7]),
    /series too short/,
  );
});

test('dailyTokenSpectralPeakFrequency: zero variance -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralPeakFrequency([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero variance/,
  );
});

test('dailyTokenSpectralPeakFrequency: non-finite -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralPeakFrequency([1, 2, 3, 4, NaN, 6, 7, 8]),
    /requires finite values/,
  );
});

test('dailyTokenSpectralPeakFrequency: alternating sequence has high-frequency peak', () => {
  // Highest non-DC bin is K = floor(n/2). Alternating series has all
  // mass at the Nyquist bin, so peakBin should equal K (= 4 for n=8)
  const series = [1, -1, 1, -1, 1, -1, 1, -1];
  const r = dailyTokenSpectralPeakFrequency(series);
  assert.equal(r.nFreqBins, 4);
  assert.equal(r.peakBin, 4);
  assert.equal(r.peakFreqRatio, 1);
  assert.equal(r.peakNormalisedFreq, 0.5);
});

test('dailyTokenSpectralPeakFrequency: single low-frequency cosine -> peak near k=1', () => {
  // y[i] = cos(2*pi*i/n) for n=16 should have peak at k=1
  const n = 16;
  const series = Array.from({ length: n }, (_, i) =>
    Math.cos((2 * Math.PI * i) / n),
  );
  const r = dailyTokenSpectralPeakFrequency(series);
  assert.equal(r.nFreqBins, 8);
  assert.equal(r.peakBin, 1);
  assert.equal(r.peakFreqRatio, 0);
});

test('dailyTokenSpectralPeakFrequency: cosine at k=3 -> peakBin = 3', () => {
  const n = 16;
  const series = Array.from({ length: n }, (_, i) =>
    Math.cos((2 * Math.PI * 3 * i) / n),
  );
  const r = dailyTokenSpectralPeakFrequency(series);
  assert.equal(r.peakBin, 3);
  assert.equal(r.peakFreqRatio, (3 - 1) / (8 - 1));
  assert.equal(r.peakNormalisedFreq, 3 / 16);
});

test('dailyTokenSpectralPeakFrequency: shift-invariance', () => {
  const n = 16;
  const a = Array.from({ length: n }, (_, i) =>
    Math.cos((2 * Math.PI * 2 * i) / n),
  );
  const b = a.map((v) => v + 100);
  const ra = dailyTokenSpectralPeakFrequency(a);
  const rb = dailyTokenSpectralPeakFrequency(b);
  assert.equal(ra.peakBin, rb.peakBin);
  assert.equal(ra.peakFreqRatio, rb.peakFreqRatio);
});

test('dailyTokenSpectralPeakFrequency: scale-invariance for any non-zero a', () => {
  const n = 16;
  const a = Array.from({ length: n }, (_, i) =>
    Math.cos((2 * Math.PI * 2 * i) / n),
  );
  for (const factor of [1e-9, 1, 1e9, -3.7]) {
    const r = dailyTokenSpectralPeakFrequency(a.map((v) => v * factor));
    assert.equal(r.peakBin, 2, `scale ${factor}`);
  }
});

test('dailyTokenSpectralPeakFrequency: time-reversal-invariance', () => {
  const n = 16;
  const a = Array.from({ length: n }, (_, i) =>
    Math.cos((2 * Math.PI * 3 * i) / n) + Math.sin((2 * Math.PI * 1 * i) / n),
  );
  const ra = dailyTokenSpectralPeakFrequency(a);
  const rb = dailyTokenSpectralPeakFrequency([...a].reverse());
  assert.equal(ra.peakBin, rb.peakBin);
});

test('dailyTokenSpectralPeakFrequency: peakFreqRatio bounded in [0, 1]', () => {
  for (let trial = 0; trial < 20; trial += 1) {
    const series = Array.from(
      { length: 24 },
      () => Math.random() * 100 + 0.1,
    );
    const r = dailyTokenSpectralPeakFrequency(series);
    assert.ok(r.peakFreqRatio >= 0 && r.peakFreqRatio <= 1);
    assert.ok(r.peakBin >= 1 && r.peakBin <= r.nFreqBins);
    assert.ok(r.peakMassShare > 0 && r.peakMassShare <= 1);
  }
});

test('dailyTokenSpectralPeakFrequency: peakNormalisedFreq in (0, 0.5]', () => {
  for (let trial = 0; trial < 20; trial += 1) {
    const series = Array.from(
      { length: 24 },
      () => Math.random() * 100 + 0.1,
    );
    const r = dailyTokenSpectralPeakFrequency(series);
    assert.ok(r.peakNormalisedFreq > 0);
    assert.ok(r.peakNormalisedFreq <= 0.5 + 1e-12);
  }
});

// ---------- buildDailyTokenSpectralPeakFrequency end-to-end ----------

test('buildDailyTokenSpectralPeakFrequency: invalid minTokens -> throws', () => {
  assert.throws(
    () => buildDailyTokenSpectralPeakFrequency([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('buildDailyTokenSpectralPeakFrequency: invalid minTenureDays -> throws', () => {
  assert.throws(
    () => buildDailyTokenSpectralPeakFrequency([], { minTenureDays: 4 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('buildDailyTokenSpectralPeakFrequency: invalid top -> throws', () => {
  assert.throws(
    () => buildDailyTokenSpectralPeakFrequency([], { top: -1 }),
    /top must be a non-negative integer/,
  );
});

test('buildDailyTokenSpectralPeakFrequency: invalid sort -> throws', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralPeakFrequency([], {
        sort: 'wat' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenSpectralPeakFrequency: invalid since -> throws', () => {
  assert.throws(
    () => buildDailyTokenSpectralPeakFrequency([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('buildDailyTokenSpectralPeakFrequency: invalid until -> throws', () => {
  assert.throws(
    () => buildDailyTokenSpectralPeakFrequency([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('buildDailyTokenSpectralPeakFrequency: empty queue -> empty report', () => {
  const r = buildDailyTokenSpectralPeakFrequency([], {
    generatedAt: ISO,
    minTokens: 0,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenSpectralPeakFrequency: drops sparse sources below minTokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'tiny', 1));
  }
  const r = buildDailyTokenSpectralPeakFrequency(queue, {
    generatedAt: ISO,
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenSpectralPeakFrequency: drops below min tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'short', 5000));
  }
  const r = buildDailyTokenSpectralPeakFrequency(queue, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenSpectralPeakFrequency: drops zero-variance gap-filled series', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 5000));
  }
  const r = buildDailyTokenSpectralPeakFrequency(queue, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenSpectralPeakFrequency: drops non-positive tokens', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'a', 1000),
    ql(dayIso(1), 'a', 0),
    ql(dayIso(2), 'a', -5),
  ];
  const r = buildDailyTokenSpectralPeakFrequency(queue, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenSpectralPeakFrequency: drops invalid hour_start', () => {
  const queue: QueueLine[] = [ql('not-a-date', 'a', 1000)];
  const r = buildDailyTokenSpectralPeakFrequency(queue, {
    generatedAt: ISO,
    minTokens: 0,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenSpectralPeakFrequency: source filter restricts and counts', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'a', 5000 + i * 100));
    queue.push(ql(dayIso(i), 'b', 5000 + i * 100));
  }
  const r = buildDailyTokenSpectralPeakFrequency(queue, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
    source: 'a',
  });
  assert.ok(r.droppedSourceFilter > 0);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('buildDailyTokenSpectralPeakFrequency: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    for (const s of ['a', 'b', 'c']) {
      queue.push(ql(dayIso(i), s, 5000 + i * 100 + s.charCodeAt(0)));
    }
  }
  const r = buildDailyTokenSpectralPeakFrequency(queue, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenSpectralPeakFrequency: deterministic source-asc tie-break', () => {
  const queue: QueueLine[] = [];
  // Both sources get identical-shape series -> tied peakFreqRatio
  for (let i = 0; i < 16; i += 1) {
    const v = 1000 + 100 * Math.cos((2 * Math.PI * 2 * i) / 16);
    queue.push(ql(dayIso(i), 'b-src', v));
    queue.push(ql(dayIso(i), 'a-src', v));
  }
  const r = buildDailyTokenSpectralPeakFrequency(queue, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
    sort: 'peakFreqRatioDesc',
  });
  assert.equal(r.sources.length, 2);
  // peakFreqRatio identical -> source asc
  assert.equal(r.sources[0]!.source, 'a-src');
  assert.equal(r.sources[1]!.source, 'b-src');
  assert.equal(r.sources[0]!.peakBin, r.sources[1]!.peakBin);
});

test('buildDailyTokenSpectralPeakFrequency: sort by peakBin asc / desc', () => {
  const queue: QueueLine[] = [];
  // src-low: cos at k=1 (low)
  // src-high: cos at k=3 (higher)
  for (let i = 0; i < 16; i += 1) {
    queue.push(
      ql(dayIso(i), 'src-low', 1000 + 100 * Math.cos((2 * Math.PI * 1 * i) / 16)),
    );
    queue.push(
      ql(
        dayIso(i),
        'src-high',
        1000 + 100 * Math.cos((2 * Math.PI * 3 * i) / 16),
      ),
    );
  }
  const asc = buildDailyTokenSpectralPeakFrequency(queue, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
    sort: 'peakBin',
  });
  assert.equal(asc.sources[0]!.source, 'src-low');
  assert.equal(asc.sources[1]!.source, 'src-high');
  const desc = buildDailyTokenSpectralPeakFrequency(queue, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
    sort: 'peakBinDesc',
  });
  assert.equal(desc.sources[0]!.source, 'src-high');
  assert.equal(desc.sources[1]!.source, 'src-low');
});

test('buildDailyTokenSpectralPeakFrequency: sort by tokens desc / tenure desc / source asc', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'big', 50000 + 1000 * (i % 3)));
    queue.push(ql(dayIso(i), 'med', 5000 + 100 * (i % 3)));
  }
  const byTokens = buildDailyTokenSpectralPeakFrequency(queue, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
    sort: 'tokens',
  });
  assert.equal(byTokens.sources[0]!.source, 'big');
  const bySource = buildDailyTokenSpectralPeakFrequency(queue, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
    sort: 'source',
  });
  assert.equal(bySource.sources[0]!.source, 'big');
  assert.equal(bySource.sources[1]!.source, 'med');
});

test('buildDailyTokenSpectralPeakFrequency: shift-invariance carries to report', () => {
  const queue1: QueueLine[] = [];
  const queue2: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    const v = 5000 + 1000 * Math.cos((2 * Math.PI * 2 * i) / 16);
    queue1.push(ql(dayIso(i), 's', v));
    queue2.push(ql(dayIso(i), 's', v + 999));
  }
  const r1 = buildDailyTokenSpectralPeakFrequency(queue1, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
  });
  const r2 = buildDailyTokenSpectralPeakFrequency(queue2, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
  });
  assert.equal(r1.sources[0]!.peakBin, r2.sources[0]!.peakBin);
});

test('buildDailyTokenSpectralPeakFrequency: scale-invariance carries to report', () => {
  const queue1: QueueLine[] = [];
  const queue2: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    const v = 5000 + 1000 * Math.cos((2 * Math.PI * 2 * i) / 16);
    queue1.push(ql(dayIso(i), 's', v));
    queue2.push(ql(dayIso(i), 's', v * 1e6));
  }
  const r1 = buildDailyTokenSpectralPeakFrequency(queue1, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
  });
  const r2 = buildDailyTokenSpectralPeakFrequency(queue2, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
  });
  assert.equal(r1.sources[0]!.peakBin, r2.sources[0]!.peakBin);
  assert.equal(
    r1.sources[0]!.peakMassShare.toFixed(10),
    r2.sources[0]!.peakMassShare.toFixed(10),
  );
});

test('buildDailyTokenSpectralPeakFrequency: gap-filled tenure spans calendar days, not active count', () => {
  const queue: QueueLine[] = [];
  // active days at 0, 7, 14, 15 -> tenure spans 16 days
  for (const i of [0, 7, 14, 15]) {
    queue.push(ql(dayIso(i), 's', 10000 + i * 100));
  }
  const r = buildDailyTokenSpectralPeakFrequency(queue, {
    generatedAt: ISO,
    minTokens: 0,
    minTenureDays: 8,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 16);
  assert.equal(r.sources[0]!.nActiveDays, 4);
  assert.equal(r.sources[0]!.nFreqBins, 8);
});
