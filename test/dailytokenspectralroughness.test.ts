import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralRoughness,
  dailyTokenSpectralRoughness,
  buildDailyTokenSpectralRoughness,
} from '../src/dailytokenspectralroughness.js';
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

// ---------- spectralRoughness primitive ----------

test('spectralRoughness: too few bins -> throws', () => {
  assert.throws(() => spectralRoughness([]), /too few bins/);
  assert.throws(() => spectralRoughness([1]), /too few bins/);
});

test('spectralRoughness: non-finite power -> throws', () => {
  assert.throws(() => spectralRoughness([1, NaN]), /non-finite power/);
  assert.throws(() => spectralRoughness([1, Infinity]), /non-finite power/);
  assert.throws(() => spectralRoughness([1, -Infinity]), /non-finite power/);
});

test('spectralRoughness: negative power -> throws', () => {
  assert.throws(() => spectralRoughness([1, -2]), /negative power/);
});

test('spectralRoughness: all-zero spectrum -> throws', () => {
  assert.throws(
    () => spectralRoughness([0, 0, 0, 0]),
    /non-positive total power/,
  );
});

test('spectralRoughness: constant PSD -> roughness = 0', () => {
  const r = spectralRoughness([5, 5, 5, 5, 5]);
  assert.equal(r.roughness, 0);
  assert.equal(r.absDiffSum, 0);
  assert.equal(r.totalPower, 25);
});

test('spectralRoughness: K=2 [a,b] closed form roughness = |b-a|/(a+b)', () => {
  // [3, 1]: |1-3|/4 = 0.5
  const r1 = spectralRoughness([3, 1]);
  assert.equal(r1.roughness, 0.5);
  // [1, 0]: |0-1|/1 = 1
  const r2 = spectralRoughness([1, 0]);
  assert.equal(r2.roughness, 1);
  // [1, 1]: 0
  const r3 = spectralRoughness([1, 1]);
  assert.equal(r3.roughness, 0);
});

test('spectralRoughness: boundary spike P=[1,0,0,0] -> roughness = 1', () => {
  // adjacent diffs: |0-1|, |0-0|, |0-0| = 1; total = 1; roughness = 1
  const r = spectralRoughness([1, 0, 0, 0]);
  assert.equal(r.roughness, 1);
  assert.equal(r.absDiffSum, 1);
});

test('spectralRoughness: boundary spike P=[0,0,0,1] -> roughness = 1', () => {
  // diffs: 0, 0, |1-0| = 1
  const r = spectralRoughness([0, 0, 0, 1]);
  assert.equal(r.roughness, 1);
});

test('spectralRoughness: interior spike P=[0,1,0,0] -> roughness = 2 (TV upper bound)', () => {
  // diffs: |1-0|=1, |0-1|=1, |0-0|=0; sum = 2; total = 1; roughness = 2
  const r = spectralRoughness([0, 1, 0, 0]);
  assert.equal(r.roughness, 2);
});

test('spectralRoughness: alternating comb K=4 P=[1,0,1,0] -> roughness = (K-1)/ceil(K/2) = 3/2', () => {
  // diffs: 1,1,1; sum = 3; total = 2; roughness = 1.5
  const r = spectralRoughness([1, 0, 1, 0]);
  assert.equal(r.absDiffSum, 3);
  assert.equal(r.totalPower, 2);
  assert.equal(r.roughness, 1.5);
});

test('spectralRoughness: alternating comb K=5 P=[1,0,1,0,1] -> roughness = 4/3', () => {
  // diffs: 1,1,1,1; sum = 4; total = 3; roughness = 4/3
  const r = spectralRoughness([1, 0, 1, 0, 1]);
  assert.equal(r.absDiffSum, 4);
  assert.equal(r.totalPower, 3);
  assert.ok(Math.abs(r.roughness - 4 / 3) < 1e-12);
});

test('spectralRoughness: monotone-increasing PSD = telescoping sum', () => {
  // For monotone PSD, sum |p[k+1]-p[k]| = p[K] - p[1] in the L1-normalised pmf.
  // [1,2,3,4,5,6,7,8] total=36; p[1]=1/36, p[8]=8/36; expected = (8-1)/36 = 7/36.
  const r = spectralRoughness([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(Math.abs(r.roughness - 7 / 36) < 1e-12);
});

test('spectralRoughness: monotone-decreasing PSD = telescoping (reverse) = p[1] - p[K]', () => {
  // [8,7,6,5,4,3,2,1] total=36; sum |p[k+1]-p[k]| = (8-1)/36 = 7/36 (same magnitude).
  const r = spectralRoughness([8, 7, 6, 5, 4, 3, 2, 1]);
  assert.ok(Math.abs(r.roughness - 7 / 36) < 1e-12);
});

test('spectralRoughness: dimensionless / scale-invariant', () => {
  const a = spectralRoughness([1, 2, 3, 4]);
  const b = spectralRoughness([1e9, 2e9, 3e9, 4e9]);
  const c = spectralRoughness([1e-9, 2e-9, 3e-9, 4e-9]);
  assert.ok(Math.abs(a.roughness - b.roughness) < 1e-12);
  assert.ok(Math.abs(a.roughness - c.roughness) < 1e-12);
});

test('spectralRoughness: bin-permutation SENSITIVE', () => {
  const sorted = spectralRoughness([1, 2, 3, 4, 5, 6, 7, 8]);
  const shuffled = spectralRoughness([1, 8, 2, 7, 3, 6, 4, 5]);
  assert.notEqual(sorted.roughness, shuffled.roughness);
});

test('spectralRoughness: bin-reversal INVARIANT (TV is reversal-blind in magnitude)', () => {
  const psds: number[][] = [
    [5, 4, 3, 2, 1],
    [1, 5, 1, 5, 1],
    [10, 1, 1, 1, 1, 10],
    [0, 0, 1, 2, 3, 4],
    [4, 3, 2, 1, 0, 0],
    [1, 2, 4, 8, 16, 32],
  ];
  for (const p of psds) {
    const fwd = spectralRoughness(p);
    const rev = spectralRoughness([...p].reverse());
    assert.ok(
      Math.abs(fwd.roughness - rev.roughness) < 1e-12,
      `roughness reversal mismatch for ${JSON.stringify(p)}: fwd=${fwd.roughness} rev=${rev.roughness}`,
    );
  }
});

test('spectralRoughness: roughness in [0, 2] across diverse PSDs', () => {
  const cases: number[][] = [
    [1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [10, 1, 1, 1, 1, 1, 1, 10],
    [1, 2, 3, 4, 5, 6, 7, 8],
    [1, 0, 1, 0, 1, 0, 1, 0],
  ];
  for (const c of cases) {
    const r = spectralRoughness(c);
    assert.ok(r.roughness >= 0, `non-negative: ${r.roughness}`);
    assert.ok(r.roughness <= 2 + 1e-12, `<= 2: ${r.roughness}`);
  }
});

test('spectralRoughness: interior spike location pins TV = 2 regardless of K', () => {
  for (const K of [4, 5, 6, 8, 10]) {
    const p = new Array(K).fill(0);
    p[Math.floor(K / 2)] = 1;
    const r = spectralRoughness(p);
    assert.equal(r.roughness, 2, `K=${K}`);
  }
});

test('spectralRoughness: boundary spike pins TV = 1 regardless of K', () => {
  for (const K of [4, 5, 6, 8, 10]) {
    const head = new Array(K).fill(0);
    head[0] = 1;
    const tail = new Array(K).fill(0);
    tail[K - 1] = 1;
    assert.equal(spectralRoughness(head).roughness, 1, `head K=${K}`);
    assert.equal(spectralRoughness(tail).roughness, 1, `tail K=${K}`);
  }
});

test('spectralRoughness: shape-rescale invariance -- pmf-only descriptor', () => {
  // Doubling every bin leaves the pmf unchanged; TV must match exactly.
  const a = spectralRoughness([3, 1, 4, 1, 5, 9, 2, 6]);
  const b = spectralRoughness([6, 2, 8, 2, 10, 18, 4, 12]);
  assert.ok(Math.abs(a.roughness - b.roughness) < 1e-12);
});

test('spectralRoughness: zero-bin handling -- diff treats zeros as actual values', () => {
  // [0, 1, 0, 1]: diffs 1, 1, 1; total = 2; roughness = 1.5
  const r = spectralRoughness([0, 1, 0, 1]);
  assert.equal(r.roughness, 1.5);
});

test('spectralRoughness: triangle PSD with single peak -- TV equals 2 * peak share', () => {
  // [0, 0, 1, 2, 1, 0, 0]: rises 0->0->1->2 (deltas 0,1,1), falls 2->1->0->0 (deltas 1,1,0)
  // sum |diff| = 0+1+1+1+1+0 = 4; total = 4; roughness = 1
  // But also: TV of unimodal pmf = 2 * (max - min) where min=0; max share=2/4=0.5;
  // 2 * 0.5 = 1. Pinned closed-form.
  const r = spectralRoughness([0, 0, 1, 2, 1, 0, 0]);
  assert.equal(r.roughness, 1);
});

// ---------- dailyTokenSpectralRoughness (primitive on series) ----------

test('dailyTokenSpectralRoughness: too short -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralRoughness([1, 2, 3, 4, 5, 6, 7]),
    /series too short/,
  );
});

test('dailyTokenSpectralRoughness: zero variance -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralRoughness([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero variance/,
  );
});

test('dailyTokenSpectralRoughness: non-finite -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralRoughness([1, 2, NaN, 4, 5, 6, 7, 8]),
    /finite values/,
  );
});

test('dailyTokenSpectralRoughness: scale-invariant on real series', () => {
  const ys = [1, 2, 3, 5, 4, 7, 6, 8, 2, 1];
  const a = dailyTokenSpectralRoughness(ys);
  const b = dailyTokenSpectralRoughness(ys.map((y) => y * 1e6));
  const c = dailyTokenSpectralRoughness(ys.map((y) => -y));
  assert.ok(Math.abs(a.roughness - b.roughness) < 1e-9);
  assert.ok(Math.abs(a.roughness - c.roughness) < 1e-9);
});

test('dailyTokenSpectralRoughness: shift-invariant (DC bin not used)', () => {
  const ys = [1, 2, 3, 5, 4, 7, 6, 8, 2, 1];
  const a = dailyTokenSpectralRoughness(ys);
  const b = dailyTokenSpectralRoughness(ys.map((y) => y + 1000));
  assert.ok(Math.abs(a.roughness - b.roughness) < 1e-9);
});

test('dailyTokenSpectralRoughness: time-reversal-invariant (|DFT|^2 reversal-blind)', () => {
  const ys = [1, 2, 3, 5, 4, 7, 6, 8, 2, 1];
  const a = dailyTokenSpectralRoughness(ys);
  const b = dailyTokenSpectralRoughness([...ys].reverse());
  assert.ok(Math.abs(a.roughness - b.roughness) < 1e-9);
});

test('dailyTokenSpectralRoughness: fields and bin count', () => {
  const ys = [1, 2, 3, 5, 4, 7, 6, 8, 2, 1, 9, 4];
  const r = dailyTokenSpectralRoughness(ys);
  assert.equal(r.nFreqBins, 6);
  assert.ok(r.roughness >= 0 && r.roughness <= 2 + 1e-9);
  assert.ok(r.totalPower > 0);
  assert.ok(r.absDiffSum >= 0);
  assert.ok(Number.isFinite(r.mean));
  assert.ok(r.stddev > 0);
});

// ---------- buildDailyTokenSpectralRoughness (full pipeline) ----------

test('buildDailyTokenSpectralRoughness: drops short tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) queue.push(ql(dayIso(i), 'src', 1000));
  const r = buildDailyTokenSpectralRoughness(queue, { generatedAt: ISO });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenSpectralRoughness: invalid sort -> throws', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralRoughness([], {
        sort: 'bogus' as never,
        generatedAt: ISO,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenSpectralRoughness: invalid minTenureDays -> throws', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralRoughness([], {
        minTenureDays: 4,
        generatedAt: ISO,
      }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('buildDailyTokenSpectralRoughness: invalid minTokens -> throws', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralRoughness([], {
        minTokens: -1,
        generatedAt: ISO,
      }),
    /minTokens must be a non-negative finite number/,
  );
});

test('buildDailyTokenSpectralRoughness: invalid top -> throws', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralRoughness([], {
        top: -2,
        generatedAt: ISO,
      }),
    /top must be a non-negative integer/,
  );
});

test('buildDailyTokenSpectralRoughness: source filter works', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'a', 1000 + i));
    queue.push(ql(dayIso(i), 'b', 100));
  }
  const r = buildDailyTokenSpectralRoughness(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    source: 'a',
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenSpectralRoughness: bad hour_start counted', () => {
  const queue: QueueLine[] = [ql('not-a-date', 'a', 1000)];
  const r = buildDailyTokenSpectralRoughness(queue, { generatedAt: ISO });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenSpectralRoughness: non-positive tokens dropped', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'a', 0),
    ql(dayIso(1), 'a', -5),
  ];
  const r = buildDailyTokenSpectralRoughness(queue, { generatedAt: ISO });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenSpectralRoughness: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    for (let i = 0; i < 40; i += 1) {
      queue.push(ql(dayIso(i), s, 1000 + i + s.charCodeAt(0)));
    }
  }
  const r = buildDailyTokenSpectralRoughness(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    top: 1,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenSpectralRoughness: sort=roughnessDesc orders descending', () => {
  const queue: QueueLine[] = [];
  // spike-y (rough): occasional huge bursts
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'rough', 1000 + (i % 7 === 0 ? 100000 : 0)));
  }
  // smooth: monotone ramp
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'smooth', 1000 + i));
  }
  const r = buildDailyTokenSpectralRoughness(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'roughnessDesc',
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.roughness >= r.sources[1]!.roughness);
});

test('buildDailyTokenSpectralRoughness: sort=roughness ascending mirror', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'rough', 1000 + (i % 7 === 0 ? 100000 : 0)));
  }
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'smooth', 1000 + i));
  }
  const r = buildDailyTokenSpectralRoughness(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'roughness',
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.roughness <= r.sources[1]!.roughness);
});

test('buildDailyTokenSpectralRoughness: sort=source asc deterministic', () => {
  const queue: QueueLine[] = [];
  for (const s of ['zzz', 'aaa']) {
    for (let i = 0; i < 40; i += 1) {
      queue.push(ql(dayIso(i), s, 1000 + i + s.charCodeAt(0)));
    }
  }
  const r = buildDailyTokenSpectralRoughness(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'source',
    generatedAt: ISO,
  });
  assert.equal(r.sources[0]!.source, 'aaa');
  assert.equal(r.sources[1]!.source, 'zzz');
});

test('buildDailyTokenSpectralRoughness: sort=tokens desc', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'big', 5000 + i));
    queue.push(ql(dayIso(i), 'small', 1000 + i));
  }
  const r = buildDailyTokenSpectralRoughness(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'tokens',
    generatedAt: ISO,
  });
  assert.equal(r.sources[0]!.source, 'big');
});

test('buildDailyTokenSpectralRoughness: sort=tenure desc', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 60; i += 1) queue.push(ql(dayIso(i), 'long', 1000 + i));
  for (let i = 0; i < 35; i += 1) queue.push(ql(dayIso(i), 'short', 1000 + i));
  const r = buildDailyTokenSpectralRoughness(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'tenure',
    generatedAt: ISO,
  });
  assert.equal(r.sources[0]!.source, 'long');
});

test('buildDailyTokenSpectralRoughness: invariant fields -- roughness consistent with absDiffSum/totalPower', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'a', 1000 + ((i * 13) % 97)));
  }
  const r = buildDailyTokenSpectralRoughness(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.ok(s.roughness >= 0);
  assert.ok(s.roughness <= 2 + 1e-9);
  assert.ok(s.totalPower > 0);
  assert.ok(s.absDiffSum >= 0);
  assert.ok(Math.abs(s.roughness - s.absDiffSum / s.totalPower) < 1e-9);
});

test('buildDailyTokenSpectralRoughness: window since/until honored', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) queue.push(ql(dayIso(i), 'a', 1000 + i));
  const r = buildDailyTokenSpectralRoughness(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    since: dayIso(5),
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.nTenureDays <= 35);
});

test('buildDailyTokenSpectralRoughness: zero-variance gap-filled series dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) queue.push(ql(dayIso(i), 'a', 1000));
  const r = buildDailyTokenSpectralRoughness(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenSpectralRoughness: invalid since string -> throws', () => {
  assert.throws(
    () => buildDailyTokenSpectralRoughness([], { since: 'nope', generatedAt: ISO }),
    /invalid since/,
  );
});

test('buildDailyTokenSpectralRoughness: invalid until string -> throws', () => {
  assert.throws(
    () => buildDailyTokenSpectralRoughness([], { until: 'nope', generatedAt: ISO }),
    /invalid until/,
  );
});

test('buildDailyTokenSpectralRoughness: report meta fields populated', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) queue.push(ql(dayIso(i), 'a', 1000 + i));
  const r = buildDailyTokenSpectralRoughness(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.generatedAt, ISO);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.minTenureDays, 32);
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalTokens, r.sources.reduce((a, s) => a + s.totalTokens, 0));
});

test('buildDailyTokenSpectralRoughness: empty source key normalises to (unknown)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) queue.push(ql(dayIso(i), '', 1000 + i));
  const r = buildDailyTokenSpectralRoughness(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

// ---------- orthogonality witnesses ----------

test('spectralRoughness: orthogonality vs spread-IQR -- isolated spike has small IQR but large roughness', () => {
  // Single interior spike: q1Bin = q3Bin = spike bin -> spreadIqr = 0
  // But TV = 2 (the max).
  const spike = [0, 0, 0, 1, 0, 0, 0, 0];
  const r = spectralRoughness(spike);
  assert.equal(r.roughness, 2);
  // (We don't import spreadIqr here; the structural argument is that
  // q1Bin = q3Bin = 4 trivially -> spread = 0, separating the two axes.)
});

test('spectralRoughness: orthogonality vs irregularity -- L1 vs L2 distinction', () => {
  // Two PSDs designed so L1-TV agrees but L2 squared-diff disagrees.
  // PSD A = [1, 2, 1, 2] -> diffs |1|, |1|, |1| -> L1 = 3; L2 = 1+1+1 = 3
  // PSD B = [0, 3, 0, 3] -> diffs 3, 3, 3 -> L1-TV-on-pmf = 3/6 = 0.5
  //                                       -> L2-on-raw = 27 / sqrt or similar
  // Just confirm that scaling input (which leaves L1-TV-on-pmf unchanged)
  // changes the raw L2 statistic. This is the structural distinction.
  const a = spectralRoughness([1, 2, 1, 2]);
  const b = spectralRoughness([10, 20, 10, 20]);  // 10x scale
  // pmf-invariant: roughness identical
  assert.ok(Math.abs(a.roughness - b.roughness) < 1e-12);
  // but raw absDiffSum scales
  assert.equal(b.absDiffSum, 10 * a.absDiffSum);
});

test('spectralRoughness: orthogonality vs decrease -- bin-reversal flips decrease but preserves roughness', () => {
  // Monotone-decreasing PSD -- decrease is strongly negative.
  const dec = [10, 5, 3, 2, 1, 1, 1, 1];
  const inc = [...dec].reverse();  // monotone-increasing -- decrease is positive.
  // Roughness: same magnitude (TV is reversal-blind).
  assert.ok(
    Math.abs(spectralRoughness(dec).roughness - spectralRoughness(inc).roughness) < 1e-12,
  );
});

// ---------- refine: telescoping closed-form + comb K-sweep + zigzag bound ----------

test('spectralRoughness: monotone PSD telescopes to |p[K] - p[1]| (closed form)', () => {
  // For any monotone PSD, sum_{k} |p[k+1] - p[k]| = |p[K] - p[1]|
  // because all adjacent diffs share the same sign and so collapse.
  const psds: number[][] = [
    [10, 5, 3, 2, 1, 1, 1, 1],
    [1, 1, 1, 1, 2, 3, 5, 10],
    [100, 50, 25, 12, 6, 3],
    [1, 2, 4, 8, 16, 32, 64, 128],
  ];
  for (const p of psds) {
    const total = p.reduce((a, b) => a + b, 0);
    const expected = Math.abs(p[p.length - 1]! - p[0]!) / total;
    const r = spectralRoughness(p);
    assert.ok(
      Math.abs(r.roughness - expected) < 1e-12,
      `telescoping mismatch for ${JSON.stringify(p)}: got ${r.roughness}, expected ${expected}`,
    );
  }
});

test('spectralRoughness: alternating-comb K-sweep matches (K-1) / ceil(K/2) closed form', () => {
  for (const K of [3, 4, 5, 6, 7, 8, 9, 10]) {
    const p = new Array(K).fill(0).map((_, i) => (i % 2 === 0 ? 1 : 0));
    const ones = Math.ceil(K / 2);
    const expected = (K - 1) / ones;
    const r = spectralRoughness(p);
    assert.ok(
      Math.abs(r.roughness - expected) < 1e-12,
      `comb K=${K}: got ${r.roughness}, expected ${expected}`,
    );
  }
});

test('spectralRoughness: zigzag bound -- non-monotone perturbation INCREASES TV vs monotone baseline', () => {
  // Baseline: monotone-decreasing [4, 3, 2, 1] -> TV = (4-1)/10 = 0.3
  const baseline = spectralRoughness([4, 3, 2, 1]).roughness;
  // Perturbed (swap two interior bins): [4, 2, 3, 1] -> TV = (|2-4|+|3-2|+|1-3|)/10 = 5/10 = 0.5
  const perturbed = spectralRoughness([4, 2, 3, 1]).roughness;
  assert.ok(perturbed > baseline, `perturbed ${perturbed} should exceed baseline ${baseline}`);
});

test('spectralRoughness: boundary spike pins SUPREMUM 1 (not 2) -- single adjacent diff', () => {
  // Boundary spike has only ONE adjacent diff equal to 1, hence TV = 1 not 2.
  // Interior spike has TWO adjacent diffs of 1 each, hence TV = 2.
  // This pins the boundary-vs-interior asymmetry at the bound.
  for (const K of [4, 8, 16]) {
    const boundary = new Array(K).fill(0); boundary[0] = 1;
    const interior = new Array(K).fill(0); interior[Math.floor(K / 2)] = 1;
    assert.equal(spectralRoughness(boundary).roughness, 1);
    assert.equal(spectralRoughness(interior).roughness, 2);
  }
});
