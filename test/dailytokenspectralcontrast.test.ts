import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralContrast,
  dailyTokenSpectralContrast,
  buildDailyTokenSpectralContrast,
  logSpacedBinEdges,
} from '../src/dailytokenspectralcontrast.js';
import { spectralRenyi3Entropy } from '../src/dailytokenspectralrenyi3entropy.js';
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

// ---------- logSpacedBinEdges ----------

test('logSpacedBinEdges: rejects non-integer K', () => {
  assert.throws(() => logSpacedBinEdges(0, 6), /positive integer/);
  assert.throws(() => logSpacedBinEdges(-1, 6), /positive integer/);
  assert.throws(() => logSpacedBinEdges(1.5, 6), /positive integer/);
});

test('logSpacedBinEdges: rejects bands < 2', () => {
  assert.throws(() => logSpacedBinEdges(10, 1), /bands must be/);
  assert.throws(() => logSpacedBinEdges(10, 0), /bands must be/);
});

test('logSpacedBinEdges: monotone non-decreasing with first=0 last=K', () => {
  for (const k of [4, 5, 8, 10, 50, 100, 365]) {
    for (const b of [2, 4, 6, 8]) {
      const e = logSpacedBinEdges(k, b);
      assert.equal(e.length, b + 1);
      assert.equal(e[0], 0);
      assert.equal(e[b], k);
      for (let i = 1; i <= b; i += 1) {
        assert.ok(e[i]! >= e[i - 1]!, `K=${k},B=${b},i=${i}: ${e}`);
      }
    }
  }
});

test('logSpacedBinEdges: small K still produces a valid total partition', () => {
  // K=4, B=6 -> bands clamp tightly; final edge must be K.
  const e = logSpacedBinEdges(4, 6);
  assert.equal(e[0], 0);
  assert.equal(e[6], 4);
  for (let i = 1; i <= 6; i += 1) {
    assert.ok(e[i]! >= e[i - 1]!);
  }
});

// ---------- spectralContrast primitive ----------

test('spectralContrast: rejects bands < 2', () => {
  assert.throws(() => spectralContrast([1, 1, 1, 1, 1, 1, 1, 1], 1), /bands/);
});

test('spectralContrast: rejects K < bands', () => {
  assert.throws(() => spectralContrast([1, 1, 1], 6), /too few bins/);
});

test('spectralContrast: rejects non-finite power', () => {
  const arr = new Array(20).fill(1);
  arr[3] = Number.NaN;
  assert.throws(() => spectralContrast(arr, 4), /non-finite/);
});

test('spectralContrast: rejects negative power', () => {
  const arr = new Array(20).fill(1);
  arr[3] = -0.5;
  assert.throws(() => spectralContrast(arr, 4), /negative/);
});

test('spectralContrast: rejects zero total power', () => {
  assert.throws(() => spectralContrast(new Array(20).fill(0), 4), /zero total power/);
});

test('spectralContrast: uniform power -> contrastMean = 0 across all valid bands', () => {
  for (const k of [16, 32, 64, 100]) {
    const arr = new Array(k).fill(7);
    const r = spectralContrast(arr, 4);
    assert.equal(r.contrastMean, 0);
    assert.equal(r.contrastMax, 0);
    assert.equal(r.contrastMin, 0);
    assert.equal(r.nBandsSaturated, 0);
    assert.ok(r.nBandsValid >= 1);
  }
});

test('spectralContrast: bin-position SENSITIVE (orthogonal to Renyi-3)', () => {
  // Build two PSDs with IDENTICAL multiset (same bin-permutation
  // invariant Renyi-3) but DIFFERENT spatial layout.
  const sorted = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  const interleaved = [10, 0.5, 9, 0.5, 8, 0.5, 7, 0.5, 6, 0.5, 5, 4, 3, 2, 1, 0.5];
  // Renyi-3 is bin-permutation-invariant -> identical.
  const renyiSorted = spectralRenyi3Entropy(sorted);
  const renyiInter = spectralRenyi3Entropy(interleaved);
  assert.ok(Math.abs(renyiSorted.h3Norm - renyiInter.h3Norm) < 1e-12);
  // Spectral contrast IS position-sensitive -> generally differs.
  const cSorted = spectralContrast(sorted, 4);
  const cInter = spectralContrast(interleaved, 4);
  assert.notEqual(cSorted.contrastMean, cInter.contrastMean);
});

test('spectralContrast: monotone in within-band peak amplitude', () => {
  // Take a flat baseline and progressively raise the top-quartile
  // bins of the first band: contrastMean strictly increases.
  const k = 24;
  const baseline = new Array(k).fill(1);
  const c0 = spectralContrast(baseline, 4);
  const lifted1 = baseline.slice();
  lifted1[5] = 5;
  const c1 = spectralContrast(lifted1, 4);
  const lifted2 = baseline.slice();
  lifted2[5] = 50;
  const c2 = spectralContrast(lifted2, 4);
  assert.ok(c1.contrastMean > c0.contrastMean);
  assert.ok(c2.contrastMean > c1.contrastMean);
});

test('spectralContrast: counts saturated bands when bottom quartile is zero', () => {
  // Concentrate all power in the top quartile of one band, and
  // leave the bottom quartile of that band identically zero.
  const k = 32;
  const power = new Array(k).fill(0);
  // Push some power into the high indices so other bands are
  // not all-zero and thus carry contrast = 0 (vTop=vBot=0).
  for (let i = 0; i < k; i += 1) power[i] = i < k / 2 ? 0 : 1;
  const r = spectralContrast(power, 4);
  assert.ok(r.nBandsSaturated >= 1);
  assert.ok(r.contrastMax > 0);
  assert.ok(Number.isFinite(r.contrastMean));
});

test('spectralContrast: returns total power = sum of input', () => {
  const power = [3, 5, 2, 8, 1, 4, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16];
  const r = spectralContrast(power, 4);
  assert.equal(r.totalPower, power.reduce((a, b) => a + b, 0));
});

test('spectralContrast: all-zero band yields contrast = 0 (vTop = vBot = 0)', () => {
  // Concentrate all mass in the LAST band; earlier bands all
  // zero. Each all-zero band has vTop = vBot = 0, so
  // log(eps) - log(eps) = 0, and the contribution to
  // contrastMean is 0 from those bands.
  const k = 24;
  const power = new Array(k).fill(0);
  for (let i = k - 6; i < k; i += 1) power[i] = 1 + (i - (k - 6));
  const r = spectralContrast(power, 4);
  assert.ok(r.contrastMin >= 0);
  assert.equal(r.contrastMin, 0);
  assert.ok(r.contrastMax > 0);
  assert.ok(Number.isFinite(r.contrastMean));
});

// ---------- dailyTokenSpectralContrast ----------

test('dailyTokenSpectralContrast: rejects too-short series', () => {
  assert.throws(() => dailyTokenSpectralContrast([1, 2, 3], 2), /too short/);
});

test('dailyTokenSpectralContrast: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenSpectralContrast([1, 2, 3, Number.NaN, 5, 6, 7, 8], 2),
    /finite values/,
  );
});

test('dailyTokenSpectralContrast: rejects constant series', () => {
  assert.throws(
    () => dailyTokenSpectralContrast(new Array(20).fill(7), 4),
    /zero variance/,
  );
});

test('dailyTokenSpectralContrast: pure sine -> sharp band-local peak', () => {
  // n = 64 days, sine at period 8 days.
  const n = 64;
  const v: number[] = [];
  for (let i = 0; i < n; i += 1) {
    v.push(100 + 50 * Math.sin((2 * Math.PI * i) / 8));
  }
  const r = dailyTokenSpectralContrast(v, 6);
  assert.ok(r.contrastMax > 1, `contrastMax=${r.contrastMax}`);
  assert.ok(r.contrastMean > 0);
  assert.ok(r.nBandsValid >= 1);
});

test('dailyTokenSpectralContrast: white-noise-like has lower contrastMax than pure tone', () => {
  // Deterministic pseudo-noise via LCG.
  let s = 12345;
  const rng = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const noisy: number[] = [];
  const tone: number[] = [];
  const n = 64;
  for (let i = 0; i < n; i += 1) {
    noisy.push(100 + (rng() - 0.5) * 30);
    tone.push(100 + 50 * Math.sin((2 * Math.PI * i) / 8));
  }
  const rNoisy = dailyTokenSpectralContrast(noisy, 6);
  const rTone = dailyTokenSpectralContrast(tone, 6);
  // The pure-tone case has a single dominant Fourier line ->
  // its peak band's top quartile dwarfs its bottom -> larger
  // max-band contrast than broadband-noise.
  assert.ok(
    rTone.contrastMax > rNoisy.contrastMax,
    `tone ${rTone.contrastMax} <= noise ${rNoisy.contrastMax}`,
  );
});

// ---------- buildDailyTokenSpectralContrast ----------

test('build: rejects bands < 2', () => {
  assert.throws(
    () => buildDailyTokenSpectralContrast([], { bands: 1 }),
    /bands must be/,
  );
});

test('build: rejects min-tenure-days below 2*bands floor', () => {
  assert.throws(
    () => buildDailyTokenSpectralContrast([], { bands: 6, minTenureDays: 8 }),
    /must be an integer >= 12/,
  );
});

test('build: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralContrast([], {
        bands: 4,
        minTenureDays: 8,
        sort: 'nope' as never,
      }),
    /sort must be one of/,
  );
});

test('build: empty queue -> zero rows', () => {
  const r = buildDailyTokenSpectralContrast([], {
    bands: 4,
    minTenureDays: 8,
    generatedAt: ISO,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('build: bad hour_start surfaces as droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [ql('not-a-date', 'src', 100)];
  const r = buildDailyTokenSpectralContrast(queue, {
    bands: 4,
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
  const r = buildDailyTokenSpectralContrast(queue, {
    bands: 4,
    minTenureDays: 8,
    generatedAt: ISO,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: end-to-end sine source produces a finite contrast row', () => {
  const queue: QueueLine[] = [];
  const n = 48;
  for (let i = 0; i < n; i += 1) {
    const tt = Math.max(1, Math.round(1000 + 800 * Math.sin((2 * Math.PI * i) / 6)));
    queue.push(ql(dayIso(i), 'sineSrc', tt));
  }
  const r = buildDailyTokenSpectralContrast(queue, {
    bands: 6,
    minTenureDays: 16,
    generatedAt: ISO,
    minTokens: 100,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'sineSrc');
  assert.ok(row.contrastMean > 0);
  assert.ok(row.contrastMax >= row.contrastMean);
  assert.ok(row.contrastMin <= row.contrastMean);
  assert.equal(row.nBandsRequested, 6);
  assert.ok(row.nBandsValid >= 1);
  assert.ok(Number.isFinite(row.contrastMean));
});

test('build: source filter restricts and surfaces dropped count', () => {
  const queue: QueueLine[] = [];
  const n = 48;
  for (let i = 0; i < n; i += 1) {
    queue.push(ql(dayIso(i), 'a', 200 + (i % 5)));
    queue.push(ql(dayIso(i), 'b', 300 + (i % 7)));
  }
  const r = buildDailyTokenSpectralContrast(queue, {
    bands: 4,
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
                  Math.sin((2 * Math.PI * i) / (src === 'a' ? 4 : src === 'b' ? 6 : 8)),
            ),
          ),
        ),
      );
    }
  }
  const r = buildDailyTokenSpectralContrast(queue, {
    bands: 4,
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
  const r = buildDailyTokenSpectralContrast(queue, {
    bands: 4,
    minTenureDays: 8,
    generatedAt: ISO,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('build: deterministic across two runs with the same generatedAt', () => {
  const queue: QueueLine[] = [];
  const n = 32;
  for (let i = 0; i < n; i += 1) {
    queue.push(ql(dayIso(i), 's', Math.max(1, 200 + (i * 13) % 50)));
  }
  const r1 = buildDailyTokenSpectralContrast(queue, {
    bands: 4,
    minTenureDays: 8,
    minTokens: 100,
    generatedAt: ISO,
  });
  const r2 = buildDailyTokenSpectralContrast(queue, {
    bands: 4,
    minTenureDays: 8,
    minTokens: 100,
    generatedAt: ISO,
  });
  assert.deepEqual(r1, r2);
});
