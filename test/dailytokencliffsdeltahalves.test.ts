import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cliffsDelta,
  cliffsDeltaMagnitude,
  cliffsDeltaDecision,
  cliffsDeltaBootstrapCi,
  dailyTokenCliffsDeltaHalves,
  buildDailyTokenCliffsDeltaHalves,
  makeMulberry32,
} from '../src/dailytokencliffsdeltahalves.js';
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

// ---------- cliffsDeltaMagnitude ----------

test('cd: magnitude negligible below .147', () => {
  assert.equal(cliffsDeltaMagnitude(0), 'negligible');
  assert.equal(cliffsDeltaMagnitude(0.1), 'negligible');
  assert.equal(cliffsDeltaMagnitude(0.146), 'negligible');
});

test('cd: magnitude small in [.147, .33)', () => {
  assert.equal(cliffsDeltaMagnitude(0.147), 'small');
  assert.equal(cliffsDeltaMagnitude(0.25), 'small');
  assert.equal(cliffsDeltaMagnitude(0.329), 'small');
});

test('cd: magnitude medium in [.33, .474)', () => {
  assert.equal(cliffsDeltaMagnitude(0.33), 'medium');
  assert.equal(cliffsDeltaMagnitude(0.4), 'medium');
  assert.equal(cliffsDeltaMagnitude(0.473), 'medium');
});

test('cd: magnitude large above .474', () => {
  assert.equal(cliffsDeltaMagnitude(0.474), 'large');
  assert.equal(cliffsDeltaMagnitude(0.7), 'large');
  assert.equal(cliffsDeltaMagnitude(1.0), 'large');
});

test('cd: magnitude throws on out-of-range', () => {
  assert.throws(() => cliffsDeltaMagnitude(-0.01), /\[0, 1\]/);
  assert.throws(() => cliffsDeltaMagnitude(1.01), /\[0, 1\]/);
  assert.throws(() => cliffsDeltaMagnitude(NaN), /\[0, 1\]/);
});

// ---------- cliffsDeltaDecision ----------

test('cd: decision ns when CI includes 0', () => {
  assert.equal(cliffsDeltaDecision(0.5, -0.1, 0.7), 'ns');
  assert.equal(cliffsDeltaDecision(0.0, -0.5, 0.5), 'ns');
  assert.equal(cliffsDeltaDecision(-0.3, -0.4, 0.05), 'ns');
});

test('cd: decision significant-large for |delta|>=.474 with CI excluding 0', () => {
  assert.equal(cliffsDeltaDecision(0.6, 0.2, 0.9), 'significant-large');
  assert.equal(cliffsDeltaDecision(-0.8, -0.95, -0.5), 'significant-large');
});

test('cd: decision significant-medium for |delta| in [.33, .474)', () => {
  assert.equal(cliffsDeltaDecision(0.4, 0.1, 0.6), 'significant-medium');
  assert.equal(cliffsDeltaDecision(-0.35, -0.6, -0.05), 'significant-medium');
});

test('cd: decision significant-small for |delta| in [.147, .33)', () => {
  assert.equal(cliffsDeltaDecision(0.2, 0.05, 0.4), 'significant-small');
});

test('cd: decision significant-negligible when CI excludes 0 but |delta| tiny', () => {
  assert.equal(
    cliffsDeltaDecision(0.05, 0.01, 0.09),
    'significant-negligible',
  );
});

test('cd: decision throws on bad inputs', () => {
  assert.throws(() => cliffsDeltaDecision(1.5, 0, 1), /\[-1, 1\]/);
  assert.throws(() => cliffsDeltaDecision(0.5, 0.6, 0.4), /ciLow/);
  assert.throws(() => cliffsDeltaDecision(0.5, NaN, 1), /finite/);
});

// ---------- cliffsDelta point estimate ----------

test('cd: delta = +1 when B strictly dominates A', () => {
  const a = [1, 2, 3, 4];
  const b = [10, 11, 12, 13];
  const r = cliffsDelta(a, b);
  assert.equal(r.nGreater, 16);
  assert.equal(r.nLess, 0);
  assert.equal(r.nEqual, 0);
  assert.equal(r.delta, 1);
});

test('cd: delta = -1 when A strictly dominates B', () => {
  const a = [10, 11, 12, 13];
  const b = [1, 2, 3, 4];
  const r = cliffsDelta(a, b);
  assert.equal(r.nGreater, 0);
  assert.equal(r.nLess, 16);
  assert.equal(r.delta, -1);
});

test('cd: delta = 0 when samples are identical', () => {
  const a = [1, 2, 3, 4];
  const b = [1, 2, 3, 4];
  const r = cliffsDelta(a, b);
  assert.equal(r.delta, 0);
  assert.equal(r.nGreater, 6); // (1,2),(1,3),(1,4),(2,3),(2,4),(3,4)
  assert.equal(r.nLess, 6);
  assert.equal(r.nEqual, 4); // diagonal
});

test('cd: delta consistent with manual count', () => {
  const a = [1, 2, 3];
  const b = [2, 3, 4];
  // (a,b): (1,2)>(1,3)>(1,4)> => 3 greater
  // (2,2)= (2,3)> (2,4)> => 2 greater 1 equal
  // (3,2)< (3,3)= (3,4)> => 1 greater 1 less 1 equal
  // total greater=6, less=1, equal=2 (out of 9)
  const r = cliffsDelta(a, b);
  assert.equal(r.nGreater, 6);
  assert.equal(r.nLess, 1);
  assert.equal(r.nEqual, 2);
  assert.ok(Math.abs(r.delta - (6 - 1) / 9) < 1e-12);
});

test('cd: throws on empty samples', () => {
  assert.throws(() => cliffsDelta([], [1, 2]), /non-empty/);
  assert.throws(() => cliffsDelta([1], []), /non-empty/);
});

test('cd: throws on non-finite values', () => {
  assert.throws(() => cliffsDelta([1, NaN], [1, 2]), /finite/);
  assert.throws(() => cliffsDelta([1, 2], [Infinity]), /finite/);
});

test('cd: nGreater + nLess + nEqual = m*n always', () => {
  const a = [3, 1, 4, 1, 5, 9, 2, 6];
  const b = [5, 3, 5, 8, 9, 7, 9, 3];
  const r = cliffsDelta(a, b);
  assert.equal(r.nGreater + r.nLess + r.nEqual, a.length * b.length);
});

test('cd: delta sign-flips when samples are swapped', () => {
  const a = [1, 2, 3, 4, 5];
  const b = [3, 4, 5, 6, 7];
  const ab = cliffsDelta(a, b);
  const ba = cliffsDelta(b, a);
  assert.ok(Math.abs(ab.delta + ba.delta) < 1e-12);
});

// ---------- Mulberry32 PRNG ----------

test('cd: makeMulberry32 returns deterministic sequence for same seed', () => {
  const r1 = makeMulberry32('seed-A');
  const r2 = makeMulberry32('seed-A');
  for (let i = 0; i < 50; i += 1) {
    assert.equal(r1(), r2());
  }
});

test('cd: makeMulberry32 differs for different seeds', () => {
  const r1 = makeMulberry32('alpha');
  const r2 = makeMulberry32('beta');
  let differences = 0;
  for (let i = 0; i < 50; i += 1) {
    if (r1() !== r2()) differences += 1;
  }
  assert.ok(differences >= 45, `expected nearly all differ, got ${differences}/50`);
});

test('cd: makeMulberry32 outputs in [0, 1)', () => {
  const r = makeMulberry32('range-check');
  for (let i = 0; i < 200; i += 1) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out-of-range ${v}`);
  }
});

// ---------- bootstrap CI ----------

test('cd: bootstrap CI throws on bad nBoot', () => {
  const rng = makeMulberry32('x');
  assert.throws(
    () => cliffsDeltaBootstrapCi([1, 2], [3, 4], 50, 0.05, rng),
    /nBoot/,
  );
});

test('cd: bootstrap CI throws on bad alpha', () => {
  const rng = makeMulberry32('x');
  assert.throws(
    () => cliffsDeltaBootstrapCi([1, 2], [3, 4], 199, 0, rng),
    /alpha/,
  );
  assert.throws(
    () => cliffsDeltaBootstrapCi([1, 2], [3, 4], 199, 1, rng),
    /alpha/,
  );
});

test('cd: bootstrap CI brackets the point estimate for clear shift', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  const b = [10, 11, 12, 13, 14, 15, 16, 17];
  const rng = makeMulberry32('clear-shift');
  const r = cliffsDeltaBootstrapCi(a, b, 199, 0.05, rng);
  assert.ok(r.ciLow > 0.5, `ciLow=${r.ciLow}`);
  assert.ok(r.ciHigh <= 1.0);
  assert.ok(r.ciLow <= r.ciHigh);
});

test('cd: bootstrap CI deterministic for same seed', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  const b = [3, 4, 5, 6, 7, 8, 9, 10];
  const r1 = cliffsDeltaBootstrapCi(a, b, 199, 0.05, makeMulberry32('s'));
  const r2 = cliffsDeltaBootstrapCi(a, b, 199, 0.05, makeMulberry32('s'));
  assert.equal(r1.ciLow, r2.ciLow);
  assert.equal(r1.ciHigh, r2.ciHigh);
});

test('cd: bootstrap CI brackets 0 for identical-distribution samples', () => {
  // Same draws on both halves -> delta ~ 0, CI should include 0.
  const a = Array.from({ length: 50 }, (_, i) => (i * 17) % 23);
  const b = Array.from({ length: 50 }, (_, i) => ((i + 7) * 17) % 23);
  const rng = makeMulberry32('null');
  const r = cliffsDeltaBootstrapCi(a, b, 299, 0.05, rng);
  assert.ok(r.ciLow <= 0 && r.ciHigh >= 0, `CI=[${r.ciLow}, ${r.ciHigh}]`);
});

// ---------- dailyTokenCliffsDeltaHalves ----------

test('cd: halves throws on too-short input', () => {
  assert.throws(
    () => dailyTokenCliffsDeltaHalves([1, 2, 3, 4]),
    /at least 16/,
  );
});

test('cd: halves throws on non-finite', () => {
  const v = Array.from({ length: 16 }, (_, i) => i);
  v[5] = NaN;
  assert.throws(() => dailyTokenCliffsDeltaHalves(v), /finite/);
});

test('cd: halves on perfect shift returns delta = +1, CI excludes 0', () => {
  const v = Array.from({ length: 16 }, (_, i) => (i < 8 ? 100 : 1000));
  const r = dailyTokenCliffsDeltaHalves(v, { nBoot: 199, seed: 'shift' });
  assert.equal(r.delta, 1);
  assert.equal(r.m, 8);
  assert.equal(r.n, 8);
  assert.equal(r.nGreater, 64);
  assert.equal(r.nLess, 0);
  assert.ok(r.ciExcludesZero);
});

test('cd: halves on perfect reverse shift returns delta = -1', () => {
  const v = Array.from({ length: 16 }, (_, i) => (i < 8 ? 1000 : 100));
  const r = dailyTokenCliffsDeltaHalves(v, { nBoot: 199, seed: 'rev' });
  assert.equal(r.delta, -1);
  assert.equal(r.nLess, 64);
});

test('cd: halves drops median when N is odd', () => {
  const v = Array.from({ length: 17 }, (_, i) => 100 + i);
  const r = dailyTokenCliffsDeltaHalves(v, { nBoot: 199, seed: 'odd' });
  assert.equal(r.m, 8);
  assert.equal(r.n, 8);
});

test('cd: halves CI half-width shrinks with larger N (consistency)', () => {
  // Overlapping shifted distributions at two sample sizes; CI half-width
  // should shrink. Use noisy values so the CI is non-degenerate.
  const mk = (N: number) => {
    const v: number[] = [];
    let seed = 7;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed % 1000) / 1000;
    };
    for (let i = 0; i < N; i += 1) {
      // Add a modest shift in the second half plus uniform noise in [0,100].
      v.push((i < N / 2 ? 100 : 130) + rng() * 100);
    }
    return v;
  };
  const small = mk(20);
  const big = mk(200);
  const rs = dailyTokenCliffsDeltaHalves(small, { nBoot: 199, seed: 'sml' });
  const rb = dailyTokenCliffsDeltaHalves(big, { nBoot: 199, seed: 'big' });
  assert.ok(
    rb.ciHalfWidth < rs.ciHalfWidth,
    `bigHW=${rb.ciHalfWidth} smallHW=${rs.ciHalfWidth}`,
  );
});

// ---------- buildDailyTokenCliffsDeltaHalves ----------

test('cd: build returns deterministic report on synthetic shift', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-shift', i < 8 ? 1000 : 5000));
  }
  const report = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    nBoot: 199,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(report.totalSources, 1);
  assert.equal(report.sources.length, 1);
  const r = report.sources[0]!;
  assert.equal(r.source, 'src-shift');
  assert.equal(r.cdDelta, 1);
  assert.equal(r.cdSign, 1);
  assert.equal(r.cdMagnitude, 'large');
  assert.ok(r.cdCiExcludesZero);
  assert.equal(r.cdDecision, 'significant-large');
});

test('cd: build drops sparse sources by minTokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'big', 5000));
    queue.push(ql(dayIso(i), 'small', 10));
  }
  const report = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1000,
    minTenureDays: 16,
    nBoot: 199,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(report.totalSources, 2);
  assert.equal(report.droppedSparseSources, 1);
});

test('cd: build drops zero-variance flat sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 1000));
  }
  const report = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    nBoot: 199,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(report.droppedZeroVariance, 1);
  assert.equal(report.sources.length, 0);
});

test('cd: build sort=absDeltaDesc orders by |delta| desc', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-A', i < 8 ? 100 : 500));
  }
  for (let i = 0; i < 16; i += 1) {
    const second = i >= 8;
    const odd = i % 2 === 1;
    queue.push(ql(dayIso(i), 'src-B', second === odd ? 200 : 100));
  }
  const report = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    nBoot: 199,
    sort: 'absDeltaDesc',
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.ok(report.sources.length >= 1);
  assert.equal(report.sources[0]!.source, 'src-A');
});

test('cd: build invalid sort throws', () => {
  assert.throws(
    () =>
      buildDailyTokenCliffsDeltaHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('cd: build invalid minTenureDays throws', () => {
  assert.throws(
    () => buildDailyTokenCliffsDeltaHalves([], { minTenureDays: 4 }),
    /min-tenure|minTenureDays/i,
  );
});

test('cd: build invalid nBoot throws', () => {
  assert.throws(
    () => buildDailyTokenCliffsDeltaHalves([], { nBoot: 50 }),
    /nBoot/,
  );
});

test('cd: build invalid alpha throws', () => {
  assert.throws(
    () => buildDailyTokenCliffsDeltaHalves([], { alpha: 0 }),
    /alpha/,
  );
  assert.throws(
    () => buildDailyTokenCliffsDeltaHalves([], { alpha: 1 }),
    /alpha/,
  );
});

test('cd: build top caps and reports remainder', () => {
  const queue: QueueLine[] = [];
  for (const src of ['s1', 's2', 's3']) {
    for (let i = 0; i < 16; i += 1) {
      queue.push(ql(dayIso(i), src, i < 8 ? 100 : 500));
    }
  }
  const report = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    nBoot: 199,
    top: 2,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(report.sources.length, 2);
  assert.equal(report.droppedTopSources, 1);
});

test('cd: build alpha=0.1 yields tighter CI than alpha=0.01', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'src', i < 15 ? 100 + (i % 3) * 5 : 200 + (i % 3) * 5));
  }
  const r10 = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    nBoot: 199,
    alpha: 0.1,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  const r01 = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    nBoot: 199,
    alpha: 0.01,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.ok(
    r10.sources[0]!.cdCiHalfWidth <= r01.sources[0]!.cdCiHalfWidth + 1e-9,
    `90% HW=${r10.sources[0]!.cdCiHalfWidth} vs 99% HW=${r01.sources[0]!.cdCiHalfWidth}`,
  );
});

test('cd: build deterministic across two runs (seeded bootstrap)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src', i < 10 ? 100 + i * 3 : 250 + i * 3));
  }
  const r1 = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    nBoot: 199,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  const r2 = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    nBoot: 199,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r1.sources[0]!.cdCiLow, r2.sources[0]!.cdCiLow);
  assert.equal(r1.sources[0]!.cdCiHigh, r2.sources[0]!.cdCiHigh);
});

test('cd: build source filter restricts to one source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-A', i < 8 ? 100 : 500));
    queue.push(ql(dayIso(i), 'src-B', i < 8 ? 200 : 600));
  }
  const report = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    nBoot: 199,
    source: 'src-A',
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(report.sources.length, 1);
  assert.equal(report.sources[0]!.source, 'src-A');
  assert.ok(report.droppedSourceFilter > 0);
});

test('cd: build delta in [-1, +1] always (random fuzz)', () => {
  const queue: QueueLine[] = [];
  let seed = 12345;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed;
  };
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'rng', (rng() % 5000) + 1));
  }
  const report = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    nBoot: 199,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  for (const r of report.sources) {
    assert.ok(r.cdDelta >= -1 && r.cdDelta <= 1, `delta=${r.cdDelta}`);
    assert.ok(r.cdCiLow >= -1 && r.cdCiLow <= 1);
    assert.ok(r.cdCiHigh >= -1 && r.cdCiHigh <= 1);
    assert.ok(r.cdCiLow <= r.cdCiHigh);
  }
});

test('cd: build dominance counts add up to m*n', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src', i < 10 ? 100 + i : 150 + i));
  }
  const report = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    nBoot: 199,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  const r = report.sources[0]!;
  assert.equal(r.cdNGreater + r.cdNLess + r.cdNEqual, r.cdMSize * r.cdNSize);
});

// ---------- v0.6.481 refinement: extra edge-case tests ----------

test('cd: bootstrap CI is monotone in alpha (smaller alpha => wider or equal CI)', () => {
  // For the same data + seed, alpha=0.01 (99% CI) must be at least as wide
  // as alpha=0.05 (95% CI) which must be at least as wide as alpha=0.10 (90% CI).
  const a = Array.from({ length: 30 }, (_, i) => 100 + (i * 13) % 47);
  const b = Array.from({ length: 30 }, (_, i) => 130 + (i * 17) % 47);
  const widths: number[] = [];
  for (const alpha of [0.01, 0.05, 0.1]) {
    const rng = makeMulberry32('mono');
    const r = cliffsDeltaBootstrapCi(a, b, 299, alpha, rng);
    widths.push(r.ciHigh - r.ciLow);
  }
  assert.ok(
    widths[0]! >= widths[1]! - 1e-9,
    `99% width ${widths[0]} should be >= 95% ${widths[1]}`,
  );
  assert.ok(
    widths[1]! >= widths[2]! - 1e-9,
    `95% width ${widths[1]} should be >= 90% ${widths[2]}`,
  );
});

test('cd: ties-only sample yields delta=0 and large nEqual', () => {
  const a = [5, 5, 5, 5];
  const b = [5, 5, 5, 5];
  const r = cliffsDelta(a, b);
  assert.equal(r.nGreater, 0);
  assert.equal(r.nLess, 0);
  assert.equal(r.nEqual, 16);
  assert.equal(r.delta, 0);
});

test('cd: build seed is per-source (different sources => independent CIs)', () => {
  // Two sources with identical numerical data should still get DIFFERENT
  // bootstrap CIs because the seed is keyed on source name.
  const queue: QueueLine[] = [];
  const vals = [100, 200, 150, 250, 175, 225, 190, 210, 180, 220, 185, 215, 195, 205, 198, 202, 199, 201, 200, 200];
  for (let i = 0; i < vals.length; i += 1) {
    queue.push(ql(dayIso(i), 'src-X', vals[i]!));
    queue.push(ql(dayIso(i), 'src-Y', vals[i]!));
  }
  const report = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    nBoot: 199,
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(report.sources.length, 2);
  const x = report.sources.find((s) => s.source === 'src-X')!;
  const y = report.sources.find((s) => s.source === 'src-Y')!;
  // Point estimates are identical (same data, same split).
  assert.equal(x.cdDelta, y.cdDelta);
  // Bootstrap CIs differ because of the per-source seed.
  assert.notEqual(`${x.cdCiLow},${x.cdCiHigh}`, `${y.cdCiLow},${y.cdCiHigh}`);
});

test('cd: build sort=ciHalfWidth orders by tightest CI first', () => {
  const queue: QueueLine[] = [];
  // src-tight: 30 days, narrower CI expected.
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'src-tight', i < 15 ? 100 + i : 200 + i));
  }
  // src-wide: 16 days, wider CI expected.
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-wide', i < 8 ? 100 : 110));
  }
  const report = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    nBoot: 199,
    sort: 'ciHalfWidth',
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(report.sources.length, 2);
  assert.equal(report.sources[0]!.source, 'src-tight');
});

test('cd: build sort=absDeltaDescCiExcludesZero puts ci!=0 sources first', () => {
  const queue: QueueLine[] = [];
  // Big shift on src-decisive (CI excludes 0).
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'src-decisive', i < 15 ? 100 : 1000));
  }
  // Tiny noisy shift on src-noisy (CI includes 0, but very small magnitude).
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-noisy', i < 8 ? 100 : 100 + (i % 2)));
  }
  const report = buildDailyTokenCliffsDeltaHalves(queue, {
    minTokens: 1,
    minTenureDays: 16,
    nBoot: 199,
    sort: 'absDeltaDescCiExcludesZero',
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(report.sources[0]!.source, 'src-decisive');
  assert.ok(report.sources[0]!.cdCiExcludesZero);
});

test('cd: cliffs delta is bounded by [-1, +1] under random fuzz', () => {
  let s = 7777;
  const rng = () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s % 1000;
  };
  for (let trial = 0; trial < 50; trial += 1) {
    const m = 5 + (rng() % 20);
    const n = 5 + (rng() % 20);
    const a = Array.from({ length: m }, () => rng());
    const b = Array.from({ length: n }, () => rng());
    const r = cliffsDelta(a, b);
    assert.ok(r.delta >= -1 && r.delta <= 1, `trial=${trial} delta=${r.delta}`);
    assert.equal(r.nGreater + r.nLess + r.nEqual, m * n);
  }
});

test('cd: bootstrap CI endpoints are bounded by [-1, +1]', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  const b = [10, 11, 12, 13, 14, 15, 16, 17];
  const rng = makeMulberry32('bound-check');
  const r = cliffsDeltaBootstrapCi(a, b, 299, 0.05, rng);
  assert.ok(r.ciLow >= -1 && r.ciLow <= 1);
  assert.ok(r.ciHigh >= -1 && r.ciHigh <= 1);
  for (const d of r.bootDeltas) {
    assert.ok(d >= -1 && d <= 1);
  }
});
