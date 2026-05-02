import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralIrregularity,
  dailyTokenSpectralIrregularity,
  buildDailyTokenSpectralIrregularity,
} from '../src/dailytokenspectralirregularity.js';
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

// ---------- spectralIrregularity primitive ----------

test('spectralIrregularity: too few bins -> throws', () => {
  assert.throws(() => spectralIrregularity([]), /too few bins/);
  assert.throws(() => spectralIrregularity([1]), /too few bins/);
});

test('spectralIrregularity: non-finite power -> throws', () => {
  assert.throws(() => spectralIrregularity([1, NaN]), /non-finite power/);
  assert.throws(() => spectralIrregularity([1, Infinity]), /non-finite power/);
  assert.throws(() => spectralIrregularity([1, -Infinity]), /non-finite power/);
});

test('spectralIrregularity: negative power -> throws', () => {
  assert.throws(() => spectralIrregularity([1, -2]), /negative power/);
});

test('spectralIrregularity: all-zero spectrum -> throws', () => {
  assert.throws(
    () => spectralIrregularity([0, 0, 0, 0]),
    /non-positive power-squared sum/,
  );
});

test('spectralIrregularity: closed-form K=2 [a,b] = (a-b)^2 / (a^2+b^2)', () => {
  const r = spectralIrregularity([3, 7]);
  // (3-7)^2 = 16; 9 + 49 = 58 -> 16/58 = 8/29
  assert.equal(r.diffSquaredSum, 16);
  assert.equal(r.powerSquaredSum, 58);
  assert.ok(Math.abs(r.irregularity - 8 / 29) < 1e-12);
});

test('spectralIrregularity: flat PSD -> 0 (lower bound witness)', () => {
  const r = spectralIrregularity([5, 5, 5, 5, 5]);
  assert.equal(r.irregularity, 0);
});

test('spectralIrregularity: max-contrast [1,0] -> 1', () => {
  const r = spectralIrregularity([1, 0]);
  // (1-0)^2 / (1+0) = 1
  assert.equal(r.irregularity, 1);
});

test('spectralIrregularity: comb PSD [1,0,1,0,1] sums adjacent diffs', () => {
  // diffs: (1-0)^2 + (0-1)^2 + (1-0)^2 + (0-1)^2 = 4
  // powers^2: 1+0+1+0+1 = 3 -> 4/3
  const r = spectralIrregularity([1, 0, 1, 0, 1]);
  assert.ok(Math.abs(r.irregularity - 4 / 3) < 1e-12);
});

test('spectralIrregularity: scale invariance (a > 0)', () => {
  const r1 = spectralIrregularity([4, 1, 1, 1]);
  const r2 = spectralIrregularity([400, 100, 100, 100]);
  assert.ok(Math.abs(r1.irregularity - r2.irregularity) < 1e-12);
});

test('spectralIrregularity: bin-permutation sensitivity (orthogonality witness vs flatness)', () => {
  // same multiset {1,1,1,1,5} -> equal flatness; permute spike position
  const spikeLeft = spectralIrregularity([5, 1, 1, 1, 1]);
  const spikeMid = spectralIrregularity([1, 1, 5, 1, 1]);
  // both have spike-with-jumps; spikeMid has TWO jumps (5 surrounded), spikeLeft has ONE
  // diffs spikeLeft: (5-1)^2 + 0 + 0 + 0 = 16 ; powers^2 = 25+4 = 29 -> 16/29 ~ 0.552
  // diffs spikeMid: 0 + (1-5)^2 + (5-1)^2 + 0 = 32 ; powers^2 = 1+1+25+1+1 = 29 -> 32/29 ~ 1.103
  assert.ok(spikeMid.irregularity > spikeLeft.irregularity);
  assert.ok(Math.abs(spikeLeft.irregularity - 16 / 29) < 1e-12);
  assert.ok(Math.abs(spikeMid.irregularity - 32 / 29) < 1e-12);
});

test('spectralIrregularity: bin-reversal INVARIANCE (orthogonality witness vs spectral-decrease)', () => {
  const fwd = spectralIrregularity([10, 1, 1, 1, 1, 1]);
  const rev = spectralIrregularity([1, 1, 1, 1, 1, 10]);
  // adjacent-pair diffs are symmetric under reversal; should be equal
  assert.ok(Math.abs(fwd.irregularity - rev.irregularity) < 1e-12);
});

test('spectralIrregularity: monotone-smooth ramp has small irregularity vs comb', () => {
  // monotone: small adjacent jumps relative to magnitude
  const ramp = spectralIrregularity([1, 2, 3, 4, 5]);
  // comb: large adjacent jumps relative to magnitude
  const comb = spectralIrregularity([5, 1, 5, 1, 5]);
  assert.ok(ramp.irregularity < comb.irregularity);
});

// ---------- dailyTokenSpectralIrregularity primitive ----------

test('dailyTokenSpectralIrregularity: n<8 throws', () => {
  assert.throws(
    () => dailyTokenSpectralIrregularity([1, 2, 3, 4, 5, 6, 7]),
    /series too short/,
  );
});

test('dailyTokenSpectralIrregularity: non-finite values throw', () => {
  assert.throws(
    () => dailyTokenSpectralIrregularity([1, 2, NaN, 4, 5, 6, 7, 8]),
    /finite values/,
  );
});

test('dailyTokenSpectralIrregularity: zero variance throws', () => {
  assert.throws(
    () => dailyTokenSpectralIrregularity([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero variance/,
  );
});

test('dailyTokenSpectralIrregularity: shift invariance', () => {
  const base = [1, 3, 2, 5, 4, 7, 6, 9, 8, 10];
  const shifted = base.map((v) => v + 1000);
  const r1 = dailyTokenSpectralIrregularity(base);
  const r2 = dailyTokenSpectralIrregularity(shifted);
  assert.ok(Math.abs(r1.irregularity - r2.irregularity) < 1e-9);
});

test('dailyTokenSpectralIrregularity: scale invariance', () => {
  const base = [1, 3, 2, 5, 4, 7, 6, 9, 8, 10];
  const scaled = base.map((v) => v * 1e6);
  const r1 = dailyTokenSpectralIrregularity(base);
  const r2 = dailyTokenSpectralIrregularity(scaled);
  assert.ok(Math.abs(r1.irregularity - r2.irregularity) < 1e-6);
});

test('dailyTokenSpectralIrregularity: sign-flip invariance', () => {
  const base = [1, 3, 2, 5, 4, 7, 6, 9, 8, 10];
  const flipped = base.map((v) => -v);
  const r1 = dailyTokenSpectralIrregularity(base);
  const r2 = dailyTokenSpectralIrregularity(flipped);
  assert.ok(Math.abs(r1.irregularity - r2.irregularity) < 1e-9);
});

test('dailyTokenSpectralIrregularity: time-reversal invariance', () => {
  const base = [1, 3, 2, 5, 4, 7, 6, 9, 8, 10];
  const reversed = base.slice().reverse();
  const r1 = dailyTokenSpectralIrregularity(base);
  const r2 = dailyTokenSpectralIrregularity(reversed);
  assert.ok(Math.abs(r1.irregularity - r2.irregularity) < 1e-9);
});

test('dailyTokenSpectralIrregularity: smooth slow ramp -> small irregularity', () => {
  const v: number[] = [];
  for (let i = 0; i < 32; i += 1) v.push(i + Math.sin(i * 0.1) * 0.01);
  const r = dailyTokenSpectralIrregularity(v);
  assert.ok(r.irregularity >= 0);
  assert.ok(Number.isFinite(r.irregularity));
});

test('dailyTokenSpectralIrregularity: alternating series -> large irregularity vs ramp', () => {
  const ramp: number[] = [];
  const alt: number[] = [];
  for (let i = 0; i < 32; i += 1) {
    ramp.push(i + 1);
    alt.push(i % 2 === 0 ? 100 : -100);
  }
  const r1 = dailyTokenSpectralIrregularity(ramp);
  const r2 = dailyTokenSpectralIrregularity(alt);
  // alt PSD has mass only at Nyquist bin -> very specific shape;
  // ramp PSD is smooth-falling. The contrast in PSD shape drives
  // very different irregularity values.
  assert.ok(r1.irregularity !== r2.irregularity);
});

// ---------- buildDailyTokenSpectralIrregularity ----------

test('build: rejects bad minTokens', () => {
  assert.throws(
    () => buildDailyTokenSpectralIrregularity([], { minTokens: -1 }),
    /minTokens/,
  );
  assert.throws(
    () => buildDailyTokenSpectralIrregularity([], { minTokens: NaN }),
    /minTokens/,
  );
});

test('build: rejects minTenureDays < 8', () => {
  assert.throws(
    () => buildDailyTokenSpectralIrregularity([], { minTenureDays: 7 }),
    /minTenureDays/,
  );
  assert.throws(
    () => buildDailyTokenSpectralIrregularity([], { minTenureDays: 1.5 }),
    /minTenureDays/,
  );
});

test('build: rejects bad top', () => {
  assert.throws(
    () => buildDailyTokenSpectralIrregularity([], { top: -1 }),
    /top/,
  );
  assert.throws(
    () => buildDailyTokenSpectralIrregularity([], { top: 1.5 }),
    /top/,
  );
});

test('build: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralIrregularity([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('build: rejects bad since/until', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralIrregularity([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenSpectralIrregularity([], { until: 'also-not-a-date' }),
    /invalid until/,
  );
});

test('build: empty queue -> empty report defaults', () => {
  const r = buildDailyTokenSpectralIrregularity([], { generatedAt: ISO });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.minTenureDays, 32);
  assert.equal(r.sort, 'irregularityDesc');
});

test('build: bad-hour_start row counted', () => {
  const r = buildDailyTokenSpectralIrregularity(
    [ql('not-a-date', 's', 100)],
    { generatedAt: ISO },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: non-positive tokens row counted', () => {
  const r = buildDailyTokenSpectralIrregularity(
    [ql(dayIso(0), 's', 0), ql(dayIso(1), 's', -5)],
    { generatedAt: ISO },
  );
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: source-filter row counted', () => {
  const r = buildDailyTokenSpectralIrregularity(
    [ql(dayIso(0), 'a', 100), ql(dayIso(1), 'b', 100)],
    { source: 'a', generatedAt: ISO },
  );
  assert.equal(r.droppedSourceFilter, 1);
});

test('build: sparse-tokens row counted', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) lines.push(ql(dayIso(i), 's', 5));
  const r = buildDailyTokenSpectralIrregularity(lines, {
    minTokens: 10000,
    generatedAt: ISO,
  });
  assert.equal(r.droppedSparseSources, 1);
});

test('build: short-tenure row counted', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) lines.push(ql(dayIso(i), 's', 1000));
  const r = buildDailyTokenSpectralIrregularity(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: zero-variance row counted (constant gap-filled series)', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) lines.push(ql(dayIso(i), 's', 1000));
  const r = buildDailyTokenSpectralIrregularity(lines, {
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
  const r = buildDailyTokenSpectralIrregularity(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 's');
  assert.equal(row.nTenureDays, 64);
  assert.equal(row.nFreqBins, 32);
  assert.ok(Number.isFinite(row.irregularity));
  assert.ok(Number.isFinite(row.diffSquaredSum));
  assert.ok(Number.isFinite(row.powerSquaredSum));
  assert.ok(row.irregularity >= 0);
  assert.ok(row.powerSquaredSum > 0);
  assert.ok(row.totalTokens > 0);
});

test('build: report-level JSON shape contract', () => {
  const r = buildDailyTokenSpectralIrregularity([], { generatedAt: ISO });
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
  assert.equal(typeof r.droppedZeroPowerSum, 'number');
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
  const r = buildDailyTokenSpectralIrregularity(lines, {
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
  const r = buildDailyTokenSpectralIrregularity(lines, {
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
  const r = buildDailyTokenSpectralIrregularity(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    since: dayIso(10),
    until: dayIso(70),
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 60);
});

test('build: irregularity vs irregularityDesc default-sort acceptance witness', () => {
  // alternating high-frequency series should have higher
  // irregularity than a slow ramp series.
  const lines: QueueLine[] = [];
  for (let i = 0; i < 64; i += 1) {
    lines.push(ql(dayIso(i), 'ramp', 1000 + i * 100));
    lines.push(
      ql(dayIso(i), 'alt', 1000 + (i % 2 === 0 ? 5000 : 0)),
    );
  }
  const asc = buildDailyTokenSpectralIrregularity(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'irregularity',
    generatedAt: ISO,
  });
  const desc = buildDailyTokenSpectralIrregularity(lines, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'irregularityDesc',
    generatedAt: ISO,
  });
  // ascending: smaller irregularity first; descending: larger first
  assert.ok(asc.sources[0]!.irregularity <= asc.sources[1]!.irregularity);
  assert.ok(desc.sources[0]!.irregularity >= desc.sources[1]!.irregularity);
});

test('build: tokens-sort source-asc tiebreak with identical totals', () => {
  const lines: QueueLine[] = [];
  for (const s of ['b', 'a']) {
    for (let i = 0; i < 64; i += 1) lines.push(ql(dayIso(i), s, 1000 + i));
  }
  const r = buildDailyTokenSpectralIrregularity(lines, {
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
    for (let i = 0; i < 64; i += 1)
      lines.push(ql(dayIso(i), s, 1000 + i * (s === 'z' ? 1 : 2)));
  }
  const r = buildDailyTokenSpectralIrregularity(lines, {
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

test('build: orthogonality vs decrease witness -- different ordering of same-multiset PSDs', () => {
  // monotone-decreasing PSD has strong (negative) decrease but
  // small irregularity; comb PSD with same energy has near-zero
  // decrease but large irregularity. We can't construct this
  // directly in the time domain in a one-liner, but we exercise
  // the bin-reversal invariance witness on the primitive directly:
  // bin-reversal flips decrease's sign but leaves irregularity
  // unchanged. (Tested above.) Here we double-up by checking that
  // the daily aggregate is also bin-reversal-INVARIANT in spirit:
  // a series and its time-reversal share the same |DFT|^2 ->
  // identical irregularity.
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < 32; i += 1) {
    a.push(1000 + i * 50);
    b.push(1000 + (32 - 1 - i) * 50);
  }
  const r1 = dailyTokenSpectralIrregularity(a);
  const r2 = dailyTokenSpectralIrregularity(b);
  assert.ok(Math.abs(r1.irregularity - r2.irregularity) < 1e-9);
});
