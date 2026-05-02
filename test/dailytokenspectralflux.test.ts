import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralFlux,
  dailyTokenSpectralFlux,
  buildDailyTokenSpectralFlux,
  frameSeries,
} from '../src/dailytokenspectralflux.js';
import { spectralRenyi3Entropy } from '../src/dailytokenspectralrenyi3entropy.js';
import { periodogramOneSided } from '../src/dailytokenspectralentropy.js';
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

// ---------- frameSeries ----------

test('frameSeries: rejects window < 1', () => {
  assert.throws(() => frameSeries([1, 2, 3, 4], 0, 1), /windowSize/);
  assert.throws(() => frameSeries([1, 2, 3, 4], -1, 1), /windowSize/);
  assert.throws(() => frameSeries([1, 2, 3, 4], 1.5, 1), /windowSize/);
});

test('frameSeries: rejects hop < 1', () => {
  assert.throws(() => frameSeries([1, 2, 3, 4], 2, 0), /hop/);
  assert.throws(() => frameSeries([1, 2, 3, 4], 2, -1), /hop/);
  assert.throws(() => frameSeries([1, 2, 3, 4], 2, 1.5), /hop/);
});

test('frameSeries: rejects n < window', () => {
  assert.throws(() => frameSeries([1, 2, 3], 4, 1), /too short/);
});

test('frameSeries: hop=1 produces n-window+1 frames', () => {
  const f = frameSeries([1, 2, 3, 4, 5, 6, 7, 8], 4, 1);
  assert.equal(f.length, 5);
  assert.deepEqual(f[0], [1, 2, 3, 4]);
  assert.deepEqual(f[4], [5, 6, 7, 8]);
});

test('frameSeries: non-overlapping window=hop produces floor(n/window) frames', () => {
  const f = frameSeries([1, 2, 3, 4, 5, 6, 7, 8], 4, 4);
  assert.equal(f.length, 2);
  assert.deepEqual(f[0], [1, 2, 3, 4]);
  assert.deepEqual(f[1], [5, 6, 7, 8]);
});

test('frameSeries: fractional landings are floored down', () => {
  // n=9, window=4, hop=3 -> floor((9-4)/3)+1 = 2 frames at starts 0, 3.
  const f = frameSeries([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, 3);
  assert.equal(f.length, 2);
  assert.deepEqual(f[0], [1, 2, 3, 4]);
  assert.deepEqual(f[1], [4, 5, 6, 7]);
});

// ---------- spectralFlux primitive ----------

test('spectralFlux: rejects fewer than 2 frames', () => {
  assert.throws(() => spectralFlux([[1, 2, 3, 4]]), /at least 2 frames/);
});

test('spectralFlux: rejects non-finite frame value', () => {
  assert.throws(
    () =>
      spectralFlux([
        [1, 2, 3, 4],
        [Number.NaN, 2, 3, 4],
      ]),
    /non-finite/,
  );
});

test('spectralFlux: identical frames -> fluxMean = 0', () => {
  const f = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [1, 2, 3, 4, 5, 6, 7, 8],
    [1, 2, 3, 4, 5, 6, 7, 8],
  ];
  const r = spectralFlux(f);
  assert.equal(r.fluxMean, 0);
  assert.equal(r.fluxMax, 0);
  assert.equal(r.fluxMin, 0);
  assert.equal(r.nPairs, 2);
  assert.equal(r.nFramesZero, 0);
});

test('spectralFlux: constant frames count as zero-power and are dropped', () => {
  // Three constant frames: each has zero variance, so mean-centred PSD = 0.
  const f = [
    [5, 5, 5, 5, 5, 5, 5, 5],
    [3, 3, 3, 3, 3, 3, 3, 3],
    [7, 7, 7, 7, 7, 7, 7, 7],
  ];
  // No surviving frames -> no pairs.
  assert.throws(() => spectralFlux(f), /no frame pair/);
});

test('spectralFlux: orthogonal pure-tone frames -> fluxMean = sqrt(2)', () => {
  // Build two frames whose PSDs concentrate on different bins.
  const w = 16;
  const f1: number[] = [];
  const f2: number[] = [];
  for (let i = 0; i < w; i += 1) {
    f1.push(Math.sin((2 * Math.PI * i) / 4)); // period 4
    f2.push(Math.sin((2 * Math.PI * i) / 8)); // period 8
  }
  const r = spectralFlux([f1, f2]);
  assert.ok(Math.abs(r.fluxMean - Math.SQRT2) < 0.05, `fluxMean=${r.fluxMean}`);
  assert.equal(r.nPairs, 1);
});

test('spectralFlux: fluxMean is bounded above by sqrt(2)', () => {
  // Random-ish frames; flux on unit-energy PSDs cannot exceed sqrt(2).
  const w = 12;
  const frames: number[][] = [];
  let s = 99;
  const rng = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let f = 0; f < 6; f += 1) {
    const arr: number[] = [];
    for (let i = 0; i < w; i += 1) arr.push(rng());
    frames.push(arr);
  }
  const r = spectralFlux(frames);
  assert.ok(r.fluxMax <= Math.SQRT2 + 1e-9, `fluxMax=${r.fluxMax}`);
  assert.ok(r.fluxMean <= Math.SQRT2 + 1e-9);
  assert.ok(r.fluxMin >= 0);
});

test('spectralFlux: bridges single zero-power frame between two surviving frames', () => {
  const f1: number[] = [];
  const f2: number[] = [];
  const w = 12;
  for (let i = 0; i < w; i += 1) {
    f1.push(Math.sin((2 * Math.PI * i) / 4));
    f2.push(Math.sin((2 * Math.PI * i) / 6));
  }
  const flat = new Array(w).fill(2);
  const r = spectralFlux([f1, flat, f2]);
  assert.equal(r.nFrames, 3);
  assert.equal(r.nFramesZero, 1);
  // Pair count is 1 because flat is dropped, leaving f1->f2 as a single pair.
  assert.equal(r.nPairs, 1);
  assert.ok(r.fluxMean > 0);
});

test('spectralFlux: framePsdEnergy is mean of pre-norm total power on surviving frames', () => {
  const w = 8;
  const f1: number[] = [];
  for (let i = 0; i < w; i += 1) f1.push(Math.sin((2 * Math.PI * i) / 4));
  const f2 = f1.map((x) => x * 2); // 4x energy
  const psd1 = periodogramOneSided(f1.map((v) => v - f1.reduce((a, b) => a + b) / w));
  const psd2 = periodogramOneSided(f2.map((v) => v - f2.reduce((a, b) => a + b) / w));
  const e1 = psd1.reduce((a, b) => a + b);
  const e2 = psd2.reduce((a, b) => a + b);
  const r = spectralFlux([f1, f2]);
  assert.ok(Math.abs(r.framePsdEnergy - (e1 + e2) / 2) < 1e-9);
});

// ---------- dailyTokenSpectralFlux ----------

test('dailyTokenSpectralFlux: rejects bad window', () => {
  assert.throws(() => dailyTokenSpectralFlux([1, 2, 3, 4, 5, 6, 7, 8], 3, 1), /windowSize/);
  assert.throws(() => dailyTokenSpectralFlux([1, 2, 3, 4, 5, 6, 7, 8], 4.5, 1), /windowSize/);
});

test('dailyTokenSpectralFlux: rejects bad hop', () => {
  assert.throws(() => dailyTokenSpectralFlux([1, 2, 3, 4, 5, 6, 7, 8], 4, 0), /hop/);
});

test('dailyTokenSpectralFlux: rejects too-short series', () => {
  // Need n >= window + hop.
  assert.throws(() => dailyTokenSpectralFlux([1, 2, 3, 4], 4, 1), /too short/);
});

test('dailyTokenSpectralFlux: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenSpectralFlux([1, 2, Number.NaN, 4, 5, 6, 7, 8, 9, 10], 4, 1),
    /finite values/,
  );
});

test('dailyTokenSpectralFlux: rejects constant series', () => {
  assert.throws(
    () => dailyTokenSpectralFlux(new Array(20).fill(7), 4, 1),
    /zero variance/,
  );
});

test('dailyTokenSpectralFlux: pure stationary tone -> low fluxMean', () => {
  // Same tone everywhere -> each window has the same mean-centred shape ->
  // PSDs are nearly identical -> flux ~ 0.
  const n = 64;
  const v: number[] = [];
  for (let i = 0; i < n; i += 1) {
    v.push(100 + 50 * Math.sin((2 * Math.PI * i) / 8));
  }
  const r = dailyTokenSpectralFlux(v, 16, 1);
  assert.ok(r.fluxMean < 0.5, `fluxMean=${r.fluxMean}`);
  assert.ok(r.nPairs > 0);
  assert.equal(r.nFreqBins, 8);
});

test('dailyTokenSpectralFlux: regime change -> larger fluxMax than stationary', () => {
  // Series alternates between a slow oscillation and a fast one.
  const n = 64;
  const stationary: number[] = [];
  const swapping: number[] = [];
  for (let i = 0; i < n; i += 1) {
    stationary.push(100 + 50 * Math.sin((2 * Math.PI * i) / 8));
    if (i < n / 2) swapping.push(100 + 50 * Math.sin((2 * Math.PI * i) / 8));
    else swapping.push(100 + 50 * Math.sin((2 * Math.PI * i) / 3));
  }
  const rStat = dailyTokenSpectralFlux(stationary, 8, 1);
  const rSwap = dailyTokenSpectralFlux(swapping, 8, 1);
  assert.ok(rSwap.fluxMax > rStat.fluxMax, `swap=${rSwap.fluxMax} stat=${rStat.fluxMax}`);
});

test('dailyTokenSpectralFlux: FRAME-ORDER SENSITIVE (orthogonal to whole-tenure spectral statistics)', () => {
  // Build a series; build another by reversing the per-window content (a
  // shuffle that preserves the multiset of windows generally changes flux).
  const n = 32;
  const v: number[] = [];
  for (let i = 0; i < n; i += 1) {
    v.push(100 + 60 * Math.sin((2 * Math.PI * i) / 4) + 30 * Math.cos((2 * Math.PI * i) / 7));
  }
  // Reverse non-overlapping length-8 blocks of frames to permute frame order
  // while keeping the per-frame SAMPLE multiset intact frame-by-frame.
  const w = 8;
  const f = frameSeries(v, w, w); // non-overlapping
  const original = spectralFlux(f);
  const shuffled = spectralFlux([f[0]!, f[2]!, f[1]!, f[3]!]);
  // Renyi-3 on the WHOLE-tenure PSD is invariant under frame shuffles only
  // if the underlying sample sequence is preserved -- here we directly
  // compare the FRAME-LEVEL flux: a frame reorder changes consecutive
  // pair distances and thus generally changes fluxMean.
  assert.notEqual(original.fluxMean, shuffled.fluxMean);
  // Sanity: spectralRenyi3Entropy is well-defined on PSD vectors.
  const psd = periodogramOneSided(v.map((x) => x - v.reduce((a, b) => a + b) / n));
  assert.ok(Number.isFinite(spectralRenyi3Entropy(psd).h3Norm));
});

// ---------- buildDailyTokenSpectralFlux ----------

test('build: rejects bad window', () => {
  assert.throws(
    () => buildDailyTokenSpectralFlux([], { windowSize: 3 }),
    /windowSize must be/,
  );
});

test('build: rejects bad hop', () => {
  assert.throws(
    () => buildDailyTokenSpectralFlux([], { windowSize: 7, hop: 0 }),
    /hop must be/,
  );
});

test('build: rejects min-tenure-days below window+hop floor', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralFlux([], {
        windowSize: 7,
        hop: 1,
        minTenureDays: 5,
      }),
    /must be an integer >= 8/,
  );
});

test('build: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralFlux([], {
        windowSize: 4,
        hop: 1,
        minTenureDays: 8,
        sort: 'nope' as never,
      }),
    /sort must be one of/,
  );
});

test('build: empty queue -> zero rows', () => {
  const r = buildDailyTokenSpectralFlux([], {
    windowSize: 4,
    hop: 1,
    minTenureDays: 8,
    generatedAt: ISO,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('build: bad hour_start surfaces as droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [ql('not-a-date', 'src', 100)];
  const r = buildDailyTokenSpectralFlux(queue, {
    windowSize: 4,
    hop: 1,
    minTenureDays: 8,
    generatedAt: ISO,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: non-positive tokens dropped', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'src', 0),
    ql(dayIso(1), 'src', -5),
  ];
  const r = buildDailyTokenSpectralFlux(queue, {
    windowSize: 4,
    hop: 1,
    minTenureDays: 8,
    generatedAt: ISO,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: end-to-end sine source produces a finite flux row', () => {
  const queue: QueueLine[] = [];
  const n = 48;
  for (let i = 0; i < n; i += 1) {
    const tt = Math.max(1, Math.round(1000 + 800 * Math.sin((2 * Math.PI * i) / 6)));
    queue.push(ql(dayIso(i), 'sineSrc', tt));
  }
  const r = buildDailyTokenSpectralFlux(queue, {
    windowSize: 7,
    hop: 1,
    minTenureDays: 16,
    generatedAt: ISO,
    minTokens: 100,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'sineSrc');
  assert.ok(row.fluxMean >= 0);
  assert.ok(row.fluxMax >= row.fluxMean);
  assert.ok(row.fluxMin <= row.fluxMean);
  assert.ok(row.fluxMax <= Math.SQRT2 + 1e-9);
  assert.equal(row.nFreqBins, 3);
  assert.ok(row.nPairs > 0);
  assert.ok(Number.isFinite(row.fluxMean));
});

test('build: source filter restricts and surfaces dropped count', () => {
  const queue: QueueLine[] = [];
  const n = 48;
  for (let i = 0; i < n; i += 1) {
    queue.push(ql(dayIso(i), 'a', 200 + (i % 5)));
    queue.push(ql(dayIso(i), 'b', 300 + (i % 7)));
  }
  const r = buildDailyTokenSpectralFlux(queue, {
    windowSize: 4,
    hop: 1,
    minTenureDays: 8,
    minTokens: 100,
    source: 'a',
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('build: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  const n = 48;
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < n; i += 1) {
      queue.push(
        ql(
          dayIso(i),
          src,
          Math.max(
            1,
            Math.round(
              500 +
                400 *
                  Math.sin(
                    (2 * Math.PI * i) / (src === 'a' ? 4 : src === 'b' ? 6 : 8),
                  ),
            ),
          ),
        ),
      );
    }
  }
  const r = buildDailyTokenSpectralFlux(queue, {
    windowSize: 4,
    hop: 1,
    minTenureDays: 8,
    minTokens: 100,
    top: 2,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('build: zero variance surfaces as droppedZeroVariance', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 24; i += 1) queue.push(ql(dayIso(i), 'flat', 1000));
  const r = buildDailyTokenSpectralFlux(queue, {
    windowSize: 4,
    hop: 1,
    minTenureDays: 8,
    generatedAt: ISO,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('build: below min-tenure-days surfaces as droppedBelowMinTenure', () => {
  const queue: QueueLine[] = [];
  // Only 6 days of activity, but min-tenure-days is 12 (== window+hop floor with window=11,hop=1 would be 12; here use window=4,hop=1 -> floor 5, but we ask for 12).
  for (let i = 0; i < 6; i += 1) {
    queue.push(ql(dayIso(i), 'short', 1000 + i * 100));
  }
  const r = buildDailyTokenSpectralFlux(queue, {
    windowSize: 4,
    hop: 1,
    minTenureDays: 12,
    minTokens: 100,
    generatedAt: ISO,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('build: respects --window and --hop (changing window changes nFrames)', () => {
  const queue: QueueLine[] = [];
  const n = 48;
  for (let i = 0; i < n; i += 1) {
    queue.push(
      ql(dayIso(i), 's', Math.max(1, Math.round(500 + 400 * Math.sin((2 * Math.PI * i) / 5)))),
    );
  }
  const r4 = buildDailyTokenSpectralFlux(queue, {
    windowSize: 4,
    hop: 1,
    minTenureDays: 8,
    minTokens: 100,
    generatedAt: ISO,
  });
  const r8 = buildDailyTokenSpectralFlux(queue, {
    windowSize: 8,
    hop: 1,
    minTenureDays: 12,
    minTokens: 100,
    generatedAt: ISO,
  });
  assert.equal(r4.sources.length, 1);
  assert.equal(r8.sources.length, 1);
  assert.ok(r4.sources[0]!.nFrames > r8.sources[0]!.nFrames);
  assert.equal(r4.sources[0]!.nFreqBins, 2);
  assert.equal(r8.sources[0]!.nFreqBins, 4);
});

test('build: non-overlapping hop=window gives floor((n-w)/w)+1 frames', () => {
  const queue: QueueLine[] = [];
  const n = 32;
  for (let i = 0; i < n; i += 1) {
    queue.push(
      ql(dayIso(i), 's', Math.max(1, Math.round(500 + 400 * Math.sin((2 * Math.PI * i) / 7)))),
    );
  }
  const r = buildDailyTokenSpectralFlux(queue, {
    windowSize: 8,
    hop: 8,
    minTenureDays: 16,
    minTokens: 100,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nFrames, 4);
});

test('build: deterministic across two runs with the same generatedAt', () => {
  const queue: QueueLine[] = [];
  const n = 32;
  for (let i = 0; i < n; i += 1) {
    queue.push(ql(dayIso(i), 's', Math.max(1, 200 + ((i * 13) % 50))));
  }
  const r1 = buildDailyTokenSpectralFlux(queue, {
    windowSize: 4,
    hop: 1,
    minTenureDays: 8,
    minTokens: 100,
    generatedAt: ISO,
  });
  const r2 = buildDailyTokenSpectralFlux(queue, {
    windowSize: 4,
    hop: 1,
    minTenureDays: 8,
    minTokens: 100,
    generatedAt: ISO,
  });
  assert.deepEqual(r1, r2);
});

test('build: debug=true surfaces framePsdEnergy on each row', () => {
  const queue: QueueLine[] = [];
  const n = 32;
  for (let i = 0; i < n; i += 1) {
    queue.push(ql(dayIso(i), 's', Math.max(1, 200 + ((i * 13) % 50))));
  }
  const r = buildDailyTokenSpectralFlux(queue, {
    windowSize: 4,
    hop: 1,
    minTenureDays: 8,
    minTokens: 100,
    generatedAt: ISO,
    debug: true,
  });
  assert.equal(r.debug, true);
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.framePsdEnergy != null);
  assert.ok(row.framePsdEnergy! > 0);
});

test('build: debug=false (default) omits framePsdEnergy', () => {
  const queue: QueueLine[] = [];
  const n = 32;
  for (let i = 0; i < n; i += 1) {
    queue.push(ql(dayIso(i), 's', Math.max(1, 200 + ((i * 13) % 50))));
  }
  const r = buildDailyTokenSpectralFlux(queue, {
    windowSize: 4,
    hop: 1,
    minTenureDays: 8,
    minTokens: 100,
    generatedAt: ISO,
  });
  assert.equal(r.debug, false);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.framePsdEnergy, undefined);
});

test('build: report carries window/hop in the header', () => {
  const r = buildDailyTokenSpectralFlux([], {
    windowSize: 14,
    hop: 7,
    minTenureDays: 21,
    generatedAt: ISO,
  });
  assert.equal(r.windowSize, 14);
  assert.equal(r.hop, 7);
  assert.equal(r.minTenureDays, 21);
});

test('build: sort fluxMeanDesc puts larger fluxMean first', () => {
  const queue: QueueLine[] = [];
  const n = 48;
  // Source 'stable' has near-stationary spectrum; 'wild' alternates.
  for (let i = 0; i < n; i += 1) {
    queue.push(ql(dayIso(i), 'stable', Math.max(1, Math.round(500 + 200 * Math.sin((2 * Math.PI * i) / 8)))));
    const wild = i < n / 2 ? 500 + 400 * Math.sin((2 * Math.PI * i) / 3) : 500 + 400 * Math.cos((2 * Math.PI * i) / 9);
    queue.push(ql(dayIso(i), 'wild', Math.max(1, Math.round(wild))));
  }
  const r = buildDailyTokenSpectralFlux(queue, {
    windowSize: 7,
    hop: 1,
    minTenureDays: 16,
    minTokens: 100,
    generatedAt: ISO,
    sort: 'fluxMeanDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.fluxMean >= r.sources[1]!.fluxMean);
});
