import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralFlatnessFlux,
  dailyTokenSpectralFlatnessFlux,
  buildDailyTokenSpectralFlatnessFlux,
} from '../src/dailytokenspectralflatnessflux.js';
import { spectralFlux, frameSeries } from '../src/dailytokenspectralflux.js';
import type { QueueLine } from '../src/types.js';

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

// ---------- spectralFlatnessFlux primitive ----------

test('spectralFlatnessFlux: rejects fewer than 2 frames', () => {
  assert.throws(
    () => spectralFlatnessFlux([[1, 2, 3, 4]]),
    /at least 2 frames/,
  );
});

test('spectralFlatnessFlux: rejects non-finite frame value', () => {
  assert.throws(
    () =>
      spectralFlatnessFlux([
        [1, 2, NaN, 4],
        [1, 2, 3, 4],
      ]),
    /non-finite/,
  );
});

test('spectralFlatnessFlux: identical frames -> fluxMean = 0, fluxMax = 0', () => {
  const f = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [1, 2, 3, 4, 5, 6, 7, 8],
    [1, 2, 3, 4, 5, 6, 7, 8],
  ];
  const r = spectralFlatnessFlux(f);
  assert.equal(r.nFrames, 3);
  assert.equal(r.nFramesZero, 0);
  assert.equal(r.nPairs, 2);
  assert.equal(r.fluxMean, 0);
  assert.equal(r.fluxMax, 0);
  assert.equal(r.fluxMin, 0);
  // identical frames -> identical phi -> flatnessMean is well-defined and finite.
  assert.ok(r.flatnessMean >= 0 && r.flatnessMean <= 1);
});

test('spectralFlatnessFlux: all-zero-power frames raise no-frame-pair', () => {
  // Constant frames -> mean-centred = all zero -> total power = 0 -> dropped.
  const f = [
    [3, 3, 3, 3],
    [5, 5, 5, 5],
    [7, 7, 7, 7],
  ];
  assert.throws(() => spectralFlatnessFlux(f), /no frame pair/);
});

test('spectralFlatnessFlux: fluxMean is in [0,1]', () => {
  // Synthesise random varied frames and check bound.
  const frames: number[][] = [];
  for (let i = 0; i < 8; i += 1) {
    const w: number[] = [];
    for (let j = 0; j < 8; j += 1) {
      w.push(Math.sin((i + 1) * (j + 1)) + 2 * Math.cos(i + 0.7 * j));
    }
    frames.push(w);
  }
  const r = spectralFlatnessFlux(frames);
  assert.ok(r.fluxMean >= 0);
  assert.ok(r.fluxMean <= 1, `fluxMean ${r.fluxMean} should be <= 1`);
  assert.ok(r.fluxMax <= 1);
  assert.ok(r.flatnessMean >= 0 && r.flatnessMean <= 1);
});

test('spectralFlatnessFlux: surfaces zero-power frames in nFramesZero', () => {
  // Mix constant (zero-power) frames and varying frames.
  const f = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [3, 3, 3, 3, 3, 3, 3, 3], // constant -> zero power
    [8, 7, 6, 5, 4, 3, 2, 1],
    [2, 5, 1, 9, 3, 7, 4, 6],
  ];
  const r = spectralFlatnessFlux(f);
  assert.equal(r.nFrames, 4);
  assert.equal(r.nFramesZero, 1);
  // 3 surviving frames -> 2 pairs.
  assert.equal(r.nPairs, 2);
});

// ---------- structural orthogonality vs axis-103 ----------

test('axis-104 is NOT a function of axis-103: equal-flatness orthogonal-PSD frames give flux104=0 but flux103>0', () => {
  // Build two synthetic length-8 frames whose mean-centred PSDs have
  // the SAME multiset of non-DC bin powers (so identical Wiener
  // flatness phi) but DIFFERENT bin assignments (so non-zero L2
  // distance between unit-energy PSD vectors). Witness: take frame A
  // built as a sinusoid at one frequency, and frame B at another
  // frequency with the same amplitude. Their non-DC periodograms
  // each concentrate (almost) all energy on a single bin -- so phi
  // is roughly the same for both (both peaky). The L2 distance
  // between unit-energy PSDs is large.
  const W = 8;
  const a: number[] = [];
  const b: number[] = [];
  for (let n = 0; n < W; n += 1) {
    a.push(Math.cos((2 * Math.PI * 1 * n) / W));
    b.push(Math.cos((2 * Math.PI * 3 * n) / W));
  }
  const r104 = spectralFlatnessFlux([a, b]);
  const r103 = spectralFlux([a, b]);
  // axis-103: orthogonal pure tones at distinct bins -> close to sqrt(2).
  assert.ok(r103.fluxMean > 1.0, `axis-103 flux should be large (got ${r103.fluxMean})`);
  // axis-104: both frames have nearly identical Wiener flatness (both
  // are pure tones with one dominant bin), so flatness flux is small.
  assert.ok(
    r104.fluxMean < 0.05,
    `axis-104 flux should be small for equal-shape pure tones (got ${r104.fluxMean})`,
  );
});

test('axis-104 frame-order sensitive: reordering frames changes fluxMean', () => {
  // Build 4 frames with diverse Wiener flatness, then compare flux
  // of order [0,1,2,3] vs [0,2,1,3].
  const f0 = [1, 2, 3, 4, 5, 6, 7, 8]; // ramp -> peaky low freq
  const f1 = [1, -1, 1, -1, 1, -1, 1, -1]; // alternating -> peaky high freq
  const f2 = [3, 1, 4, 1, 5, 9, 2, 6]; // mixed
  const f3 = [2, 7, 1, 8, 2, 8, 1, 9]; // mixed
  const ordered = spectralFlatnessFlux([f0, f1, f2, f3]).fluxMean;
  const swapped = spectralFlatnessFlux([f0, f2, f1, f3]).fluxMean;
  assert.notEqual(ordered, swapped);
});

// ---------- dailyTokenSpectralFlatnessFlux ----------

test('dailyTokenSpectralFlatnessFlux: rejects window < 4', () => {
  assert.throws(
    () => dailyTokenSpectralFlatnessFlux([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, 1),
    /windowSize/,
  );
});

test('dailyTokenSpectralFlatnessFlux: rejects hop < 1', () => {
  assert.throws(
    () => dailyTokenSpectralFlatnessFlux([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, 0),
    /hop/,
  );
});

test('dailyTokenSpectralFlatnessFlux: rejects too-short series', () => {
  assert.throws(
    () => dailyTokenSpectralFlatnessFlux([1, 2, 3, 4], 4, 1),
    /too short/,
  );
});

test('dailyTokenSpectralFlatnessFlux: rejects non-finite values', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, NaN, 9, 10];
  assert.throws(() => dailyTokenSpectralFlatnessFlux(xs, 4, 1), /finite/);
});

test('dailyTokenSpectralFlatnessFlux: rejects zero-variance series', () => {
  const xs = new Array(10).fill(5);
  assert.throws(() => dailyTokenSpectralFlatnessFlux(xs, 4, 1), /zero variance/);
});

test('dailyTokenSpectralFlatnessFlux: returns finite output on a non-trivial series', () => {
  const xs: number[] = [];
  for (let i = 0; i < 32; i += 1) {
    xs.push(10 + 5 * Math.sin(i / 2) + i * 0.5);
  }
  const r = dailyTokenSpectralFlatnessFlux(xs, 7, 1);
  assert.ok(Number.isFinite(r.fluxMean));
  assert.ok(r.fluxMean >= 0 && r.fluxMean <= 1);
  assert.ok(r.flatnessMean >= 0 && r.flatnessMean <= 1);
  assert.equal(r.nFreqBins, 3);
  assert.equal(r.nFrames, 26);
  assert.equal(r.nFrames, frameSeries(xs, 7, 1).length);
});

// ---------- buildDailyTokenSpectralFlatnessFlux ----------

test('build: rejects bad windowSize', () => {
  assert.throws(
    () => buildDailyTokenSpectralFlatnessFlux([], { windowSize: 3 }),
    /windowSize/,
  );
});

test('build: rejects bad hop', () => {
  assert.throws(
    () => buildDailyTokenSpectralFlatnessFlux([], { hop: 0 }),
    /hop/,
  );
});

test('build: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralFlatnessFlux([], {
        sort: 'bogus' as never,
      }),
    /sort/,
  );
});

test('build: surfaces sources with sufficient tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 32; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 1000 + 100 * i + (i % 5) * 50));
    queue.push(ql(dayIso(i), 'src-b', 2000 + 50 * i + (i % 3) * 80));
  }
  const r = buildDailyTokenSpectralFlatnessFlux(queue, {
    minTokens: 1000,
    windowSize: 7,
    hop: 1,
    generatedAt: '2026-05-02T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 2);
  for (const s of r.sources) {
    assert.ok(s.fluxMean >= 0 && s.fluxMean <= 1);
    assert.ok(s.flatnessMean >= 0 && s.flatnessMean <= 1);
    assert.equal(s.nFreqBins, 3);
    assert.equal(s.nTenureDays, 32);
  }
});

test('build: respects since/until window', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 32; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 1000 + 100 * i));
  }
  const r = buildDailyTokenSpectralFlatnessFlux(queue, {
    minTokens: 1,
    windowSize: 7,
    hop: 1,
    since: dayIso(40), // outside data
    generatedAt: '2026-05-02T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
});

test('build: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    for (let i = 0; i < 32; i += 1) {
      queue.push(ql(dayIso(i), `src-${s}`, 1000 + 100 * i + s * 23));
    }
  }
  const r = buildDailyTokenSpectralFlatnessFlux(queue, {
    minTokens: 1,
    windowSize: 7,
    hop: 1,
    top: 2,
    generatedAt: '2026-05-02T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 4);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('build: respects source filter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 32; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 1000 + 100 * i));
    queue.push(ql(dayIso(i), 'src-b', 1000 + 50 * i));
  }
  const r = buildDailyTokenSpectralFlatnessFlux(queue, {
    minTokens: 1,
    windowSize: 7,
    hop: 1,
    source: 'src-a',
    generatedAt: '2026-05-02T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.ok(r.droppedSourceFilter > 0);
});
