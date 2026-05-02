import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralSpreadIqr,
  dailyTokenSpectralSpreadIqr,
  buildDailyTokenSpectralSpreadIqr,
} from '../src/dailytokenspectralspreadiqr.js';
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

// ---------- spectralSpreadIqr primitive ----------

test('spectralSpreadIqr: too few bins -> throws', () => {
  assert.throws(() => spectralSpreadIqr([]), /too few bins/);
  assert.throws(() => spectralSpreadIqr([1]), /too few bins/);
});

test('spectralSpreadIqr: non-finite power -> throws', () => {
  assert.throws(() => spectralSpreadIqr([1, NaN]), /non-finite power/);
  assert.throws(() => spectralSpreadIqr([1, Infinity]), /non-finite power/);
  assert.throws(() => spectralSpreadIqr([1, -Infinity]), /non-finite power/);
});

test('spectralSpreadIqr: negative power -> throws', () => {
  assert.throws(() => spectralSpreadIqr([1, -2]), /negative power/);
});

test('spectralSpreadIqr: all-zero spectrum -> throws', () => {
  assert.throws(
    () => spectralSpreadIqr([0, 0, 0, 0]),
    /non-positive total power/,
  );
});

test('spectralSpreadIqr: uniform PSD K=4 -> q1=1 q3=3 spread=0.5', () => {
  // cum: [0.25, 0.5, 0.75, 1.0]; q1Bin = 1 (>=0.25), q3Bin = 3 (>=0.75)
  const r = spectralSpreadIqr([1, 1, 1, 1]);
  assert.equal(r.q1Bin, 1);
  assert.equal(r.q3Bin, 3);
  assert.equal(r.totalPower, 4);
  assert.equal(r.spreadIqr, 0.5);
});

test('spectralSpreadIqr: all-mass-bin-1 -> q1=q3=1 spread=0', () => {
  const r = spectralSpreadIqr([1, 0, 0, 0]);
  assert.equal(r.q1Bin, 1);
  assert.equal(r.q3Bin, 1);
  assert.equal(r.spreadIqr, 0);
});

test('spectralSpreadIqr: all-mass-bin-K -> q1=q3=K spread=0', () => {
  const r = spectralSpreadIqr([0, 0, 0, 1]);
  assert.equal(r.q1Bin, 4);
  assert.equal(r.q3Bin, 4);
  assert.equal(r.spreadIqr, 0);
});

test('spectralSpreadIqr: bimodal [0,1,1,0] -> q1=2 q3=3 spread=0.25', () => {
  // cum: [0, 0.5, 1.0, 1.0]; q1Bin = 2 (first >= 0.25), q3Bin = 3 (first >= 0.75)
  const r = spectralSpreadIqr([0, 1, 1, 0]);
  assert.equal(r.q1Bin, 2);
  assert.equal(r.q3Bin, 3);
  assert.equal(r.spreadIqr, 0.25);
});

test('spectralSpreadIqr: dimensionless / scale-invariant', () => {
  const a = spectralSpreadIqr([1, 2, 3, 4]);
  const b = spectralSpreadIqr([1e9, 2e9, 3e9, 4e9]);
  const c = spectralSpreadIqr([1e-9, 2e-9, 3e-9, 4e-9]);
  assert.equal(a.spreadIqr, b.spreadIqr);
  assert.equal(a.spreadIqr, c.spreadIqr);
  assert.equal(a.q1Bin, b.q1Bin);
  assert.equal(a.q3Bin, c.q3Bin);
});

test('spectralSpreadIqr: bin-permutation SENSITIVE', () => {
  // a: [4,1,1,1] cum-shares = [0.571, 0.714, 0.857, 1.0]; q1=1, q3=3, spread=0.5
  // b: [1,4,1,1] cum-shares = [0.143, 0.714, 0.857, 1.0]; q1=2, q3=3, spread=0.25
  const a = spectralSpreadIqr([4, 1, 1, 1]);
  const b = spectralSpreadIqr([1, 4, 1, 1]);
  assert.notEqual(a.spreadIqr, b.spreadIqr);
});

test('spectralSpreadIqr: bin-reversal preserves spread magnitude', () => {
  // Two reversed PSDs should have equal spreadIqr (endpoints flip, width preserved).
  const fwd = [4, 3, 2, 1, 1, 1, 1, 1];
  const rev = [...fwd].reverse();
  const a = spectralSpreadIqr(fwd);
  const b = spectralSpreadIqr(rev);
  assert.equal(a.spreadIqr, b.spreadIqr);
  // q-bins are not equal in raw position, but their gap is.
  assert.equal(a.q3Bin - a.q1Bin, b.q3Bin - b.q1Bin);
});

test('spectralSpreadIqr: spread is in [0, 1)', () => {
  const cases: number[][] = [
    [1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [10, 1, 1, 1, 1, 1, 1, 10],
    [1, 2, 3, 4, 5, 6, 7, 8],
  ];
  for (const c of cases) {
    const r = spectralSpreadIqr(c);
    assert.ok(r.spreadIqr >= 0, `spread non-negative: ${r.spreadIqr}`);
    assert.ok(r.spreadIqr < 1, `spread < 1: ${r.spreadIqr}`);
  }
});

test('spectralSpreadIqr: zero-bin handling -- threshold 0.25 hit at first non-zero', () => {
  // [0, 0, 1, 0, 0]: cum = [0, 0, 1, 1, 1]; q1Bin = 3, q3Bin = 3
  const r = spectralSpreadIqr([0, 0, 1, 0, 0]);
  assert.equal(r.q1Bin, 3);
  assert.equal(r.q3Bin, 3);
  assert.equal(r.spreadIqr, 0);
});

test('spectralSpreadIqr: K=2 [a,b] closed form q1=1 q3 depends on share', () => {
  // [3, 1]: total=4, cum=[3,4]/4 = [0.75, 1.0]; q1Bin = 1 (>=0.25), q3Bin = 1 (>=0.75)
  const r1 = spectralSpreadIqr([3, 1]);
  assert.equal(r1.q1Bin, 1);
  assert.equal(r1.q3Bin, 1);
  assert.equal(r1.spreadIqr, 0);
  // [1, 3]: cum = [0.25, 1.0]; q1Bin = 1, q3Bin = 2
  const r2 = spectralSpreadIqr([1, 3]);
  assert.equal(r2.q1Bin, 1);
  assert.equal(r2.q3Bin, 2);
  assert.equal(r2.spreadIqr, 0.5);
});

test('spectralSpreadIqr: monotone-increasing PSD -- q-bins move right', () => {
  // [1,2,3,4,5,6,7,8]: total = 36
  // cum shares: 1/36, 3/36, 6/36, 10/36, 15/36, 21/36, 28/36, 36/36
  //          = 0.028, 0.083, 0.167, 0.278, 0.417, 0.583, 0.778, 1.0
  // q1Bin = 4 (first >= 0.25), q3Bin = 7 (first >= 0.75)
  const r = spectralSpreadIqr([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.q1Bin, 4);
  assert.equal(r.q3Bin, 7);
  assert.equal(r.spreadIqr, (7 - 4) / 8);
});

// ---------- dailyTokenSpectralSpreadIqr (primitive on series) ----------

test('dailyTokenSpectralSpreadIqr: too short -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralSpreadIqr([1, 2, 3, 4, 5, 6, 7]),
    /series too short/,
  );
});

test('dailyTokenSpectralSpreadIqr: zero variance -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralSpreadIqr([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero variance/,
  );
});

test('dailyTokenSpectralSpreadIqr: non-finite -> throws', () => {
  assert.throws(
    () => dailyTokenSpectralSpreadIqr([1, 2, NaN, 4, 5, 6, 7, 8]),
    /finite values/,
  );
});

test('dailyTokenSpectralSpreadIqr: scale-invariant on real series', () => {
  const ys = [1, 2, 3, 5, 4, 7, 6, 8, 2, 1];
  const a = dailyTokenSpectralSpreadIqr(ys);
  const b = dailyTokenSpectralSpreadIqr(ys.map((y) => y * 1e6));
  const c = dailyTokenSpectralSpreadIqr(ys.map((y) => -y));
  assert.equal(a.spreadIqr, b.spreadIqr);
  assert.equal(a.spreadIqr, c.spreadIqr);
  assert.equal(a.q1Bin, b.q1Bin);
  assert.equal(a.q3Bin, c.q3Bin);
});

test('dailyTokenSpectralSpreadIqr: shift-invariant (DC bin not used)', () => {
  const ys = [1, 2, 3, 5, 4, 7, 6, 8, 2, 1];
  const a = dailyTokenSpectralSpreadIqr(ys);
  const b = dailyTokenSpectralSpreadIqr(ys.map((y) => y + 1000));
  assert.equal(a.spreadIqr, b.spreadIqr);
  assert.equal(a.q1Bin, b.q1Bin);
  assert.equal(a.q3Bin, b.q3Bin);
});

test('dailyTokenSpectralSpreadIqr: time-reversal-invariant (|DFT|^2 reversal-blind)', () => {
  const ys = [1, 2, 3, 5, 4, 7, 6, 8, 2, 1];
  const a = dailyTokenSpectralSpreadIqr(ys);
  const b = dailyTokenSpectralSpreadIqr([...ys].reverse());
  assert.equal(a.spreadIqr, b.spreadIqr);
  assert.equal(a.q1Bin, b.q1Bin);
  assert.equal(a.q3Bin, b.q3Bin);
});

test('dailyTokenSpectralSpreadIqr: fields and bin count', () => {
  const ys = [1, 2, 3, 5, 4, 7, 6, 8, 2, 1, 9, 4];
  const r = dailyTokenSpectralSpreadIqr(ys);
  assert.equal(r.nFreqBins, 6);
  assert.ok(r.q1Bin >= 1 && r.q1Bin <= 6);
  assert.ok(r.q3Bin >= r.q1Bin && r.q3Bin <= 6);
  assert.ok(r.spreadIqr >= 0 && r.spreadIqr < 1);
  assert.ok(r.totalPower > 0);
  assert.ok(Number.isFinite(r.mean));
  assert.ok(r.stddev > 0);
});

// ---------- buildDailyTokenSpectralSpreadIqr (full pipeline) ----------

test('buildDailyTokenSpectralSpreadIqr: drops short tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) queue.push(ql(dayIso(i), 'src', 1000));
  const r = buildDailyTokenSpectralSpreadIqr(queue, { generatedAt: ISO });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenSpectralSpreadIqr: invalid sort -> throws', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralSpreadIqr([], {
        sort: 'bogus' as never,
        generatedAt: ISO,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenSpectralSpreadIqr: invalid minTenureDays -> throws', () => {
  assert.throws(
    () =>
      buildDailyTokenSpectralSpreadIqr([], {
        minTenureDays: 4,
        generatedAt: ISO,
      }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('buildDailyTokenSpectralSpreadIqr: source filter works', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'a', 1000 + i));
    queue.push(ql(dayIso(i), 'b', 100));
  }
  const r = buildDailyTokenSpectralSpreadIqr(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    source: 'a',
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenSpectralSpreadIqr: bad hour_start counted', () => {
  const queue: QueueLine[] = [ql('not-a-date', 'a', 1000)];
  const r = buildDailyTokenSpectralSpreadIqr(queue, { generatedAt: ISO });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenSpectralSpreadIqr: non-positive tokens dropped', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'a', 0),
    ql(dayIso(1), 'a', -5),
  ];
  const r = buildDailyTokenSpectralSpreadIqr(queue, { generatedAt: ISO });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenSpectralSpreadIqr: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    for (let i = 0; i < 40; i += 1) {
      queue.push(ql(dayIso(i), s, 1000 + i + s.charCodeAt(0)));
    }
  }
  const r = buildDailyTokenSpectralSpreadIqr(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    top: 1,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenSpectralSpreadIqr: sort=spreadIqrDesc puts widest first', () => {
  // Two sources with deliberately different spread profiles.
  const queue: QueueLine[] = [];
  // narrow: mass concentrated at one day-of-week period
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'narrow', 1000 + (i % 7 === 0 ? 100000 : 0)));
  }
  // broad: nearly-uniform daily totals
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'broad', 1000 + i));
  }
  const r = buildDailyTokenSpectralSpreadIqr(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'spreadIqrDesc',
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.spreadIqr >= r.sources[1]!.spreadIqr);
});

test('buildDailyTokenSpectralSpreadIqr: sort=source asc deterministic', () => {
  const queue: QueueLine[] = [];
  for (const s of ['zzz', 'aaa']) {
    for (let i = 0; i < 40; i += 1) {
      queue.push(ql(dayIso(i), s, 1000 + i + s.charCodeAt(0)));
    }
  }
  const r = buildDailyTokenSpectralSpreadIqr(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'source',
    generatedAt: ISO,
  });
  assert.equal(r.sources[0]!.source, 'aaa');
  assert.equal(r.sources[1]!.source, 'zzz');
});

test('buildDailyTokenSpectralSpreadIqr: invariant fields q1<=q3 and bins consistent', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayIso(i), 'a', 1000 + (i * 13) % 97));
  }
  const r = buildDailyTokenSpectralSpreadIqr(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.ok(s.q1Bin >= 1);
  assert.ok(s.q3Bin >= s.q1Bin);
  assert.ok(s.q3Bin <= s.nFreqBins);
  assert.equal(s.spreadIqr, (s.q3Bin - s.q1Bin) / s.nFreqBins);
});

test('buildDailyTokenSpectralSpreadIqr: window since/until honored', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) queue.push(ql(dayIso(i), 'a', 1000 + i));
  const r = buildDailyTokenSpectralSpreadIqr(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    since: dayIso(5),
    generatedAt: ISO,
  });
  // 35 days remain -> tenure 35 >= 32, still passes
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.nTenureDays <= 35);
});

test('buildDailyTokenSpectralSpreadIqr: zero-variance gap-filled series dropped', () => {
  // Build a tenure where every day has exactly the same total.
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) queue.push(ql(dayIso(i), 'a', 1000));
  const r = buildDailyTokenSpectralSpreadIqr(queue, {
    minTokens: 1000,
    minTenureDays: 32,
    generatedAt: ISO,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenSpectralSpreadIqr: invalid since string -> throws', () => {
  assert.throws(
    () => buildDailyTokenSpectralSpreadIqr([], { since: 'nope', generatedAt: ISO }),
    /invalid since/,
  );
});

test('buildDailyTokenSpectralSpreadIqr: report meta fields populated', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) queue.push(ql(dayIso(i), 'a', 1000 + i));
  const r = buildDailyTokenSpectralSpreadIqr(queue, {
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

// ---------- refine: closed-form K=5 sweep + bin-reversal width sweep ----------

test('spectralSpreadIqr: K=5 cum-share sweep -- threshold-meets-equality boundary', () => {
  // [1,1,1,1,1]: total=5; cum-shares = [0.2, 0.4, 0.6, 0.8, 1.0]
  // 0.2 < 0.25 -> q1Bin = 2 (0.4 >= 0.25)
  // 0.6 < 0.75 -> q3Bin = 4 (0.8 >= 0.75)
  // spread = (4-2)/5 = 0.4
  const r = spectralSpreadIqr([1, 1, 1, 1, 1]);
  assert.equal(r.q1Bin, 2);
  assert.equal(r.q3Bin, 4);
  assert.equal(r.spreadIqr, 0.4);
});

test('spectralSpreadIqr: K=4 uniform meets exactly at boundary -- inclusive >=', () => {
  // [1,1,1,1]: cum-shares = [0.25, 0.5, 0.75, 1.0]
  // q1Bin = 1 (0.25 >= 0.25, exact-equality boundary), q3Bin = 3 (0.75 >= 0.75)
  // This pins the inclusive >= threshold semantics.
  const r = spectralSpreadIqr([1, 1, 1, 1]);
  assert.equal(r.q1Bin, 1);
  assert.equal(r.q3Bin, 3);
});

test('spectralSpreadIqr: bin-reversal width sweep across 6 random PSDs', () => {
  // For every reversal pair, |q3Bin - q1Bin| (and hence spreadIqr) must agree.
  const psds: number[][] = [
    [5, 4, 3, 2, 1],
    [1, 5, 1, 5, 1],
    [10, 1, 1, 1, 1, 10],
    [0, 0, 1, 2, 3, 4],
    [4, 3, 2, 1, 0, 0],
    [1, 2, 4, 8, 16, 32],
  ];
  for (const p of psds) {
    const fwd = spectralSpreadIqr(p);
    const rev = spectralSpreadIqr([...p].reverse());
    assert.equal(
      fwd.q3Bin - fwd.q1Bin,
      rev.q3Bin - rev.q1Bin,
      `width mismatch for ${JSON.stringify(p)}`,
    );
    assert.equal(fwd.spreadIqr, rev.spreadIqr);
  }
});

test('spectralSpreadIqr: q1 == q3 iff inner-50% mass is concentrated in one bin', () => {
  // Single dominant bin -> spread = 0.
  const a = spectralSpreadIqr([100, 1, 1, 1, 1, 1]);
  // cum-shares: 100/105, 101/105, 102/105, 103/105, 104/105, 1.0
  //         ~= 0.952, 0.962, 0.971, 0.981, 0.990, 1.0; q1Bin=q3Bin=1, spread=0
  assert.equal(a.q1Bin, a.q3Bin);
  assert.equal(a.spreadIqr, 0);
});
