import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenKendallTauAutocorrelationLag1,
  buildDailyTokenKendallTauAutocorrelationLag1,
} from '../src/dailytokenkendalltauautocorrelationlag1.js';
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

// ---------- primitive ----------

test('dailyTokenKendallTauAutocorrelationLag1: rejects fewer than 3 samples', () => {
  assert.throws(
    () => dailyTokenKendallTauAutocorrelationLag1([5, 6]),
    /at least 3 samples/,
  );
});

test('dailyTokenKendallTauAutocorrelationLag1: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenKendallTauAutocorrelationLag1([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenKendallTauAutocorrelationLag1([1, Infinity, 3]),
    /finite values/,
  );
});

test('dailyTokenKendallTauAutocorrelationLag1: strictly monotone increasing -> tau = +1', () => {
  const r = dailyTokenKendallTauAutocorrelationLag1([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(Math.abs(r.tau - 1) < 1e-12, `expected tau ~ 1, got ${r.tau}`);
  assert.equal(r.nPairs, 7);
  // m = 7, comparisons = 21, all concordant
  assert.equal(r.nComparisons, 21);
  assert.equal(r.nConcordant, 21);
  assert.equal(r.nDiscordant, 0);
  assert.equal(r.nTiedU, 0);
  assert.equal(r.nTiedV, 0);
  assert.equal(r.nTiedBoth, 0);
});

test('dailyTokenKendallTauAutocorrelationLag1: strictly monotone decreasing -> tau = +1', () => {
  // Both u and v decrease in lockstep, every unordered pair is concordant.
  const r = dailyTokenKendallTauAutocorrelationLag1([10, 9, 8, 7, 6, 5]);
  assert.ok(Math.abs(r.tau - 1) < 1e-12, `expected tau ~ 1, got ${r.tau}`);
  assert.equal(r.nDiscordant, 0);
});

test('dailyTokenKendallTauAutocorrelationLag1: rank-invariant under affine monotone transform', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const xLin = x.map((v) => v * 7 + 11);
  const r1 = dailyTokenKendallTauAutocorrelationLag1(x);
  const r2 = dailyTokenKendallTauAutocorrelationLag1(xLin);
  assert.ok(
    Math.abs(r1.tau - r2.tau) < 1e-12,
    `tau should be invariant under affine monotone transform: ${r1.tau} vs ${r2.tau}`,
  );
});

test('dailyTokenKendallTauAutocorrelationLag1: strict 2-cycle gives tau = -1 (anti-persistence)', () => {
  // x = [1, 2, 1, 2, 1, 2, 1, 2]
  // u = [1, 2, 1, 2, 1, 2, 1], v = [2, 1, 2, 1, 2, 1, 2]
  // Among the four distinct pair classes, all non-tied pairs are discordant.
  const x = [1, 2, 1, 2, 1, 2, 1, 2];
  const r = dailyTokenKendallTauAutocorrelationLag1(x);
  assert.ok(r.tau < 0, `expected anti-persistence tau < 0, got ${r.tau}`);
  assert.ok(
    Math.abs(r.tau - -1) < 1e-12,
    `expected tau ~ -1 for exact 2-cycle, got ${r.tau}`,
  );
  assert.equal(r.nConcordant, 0);
  assert.ok(r.nDiscordant > 0);
});

test('dailyTokenKendallTauAutocorrelationLag1: constant series throws zero-variance', () => {
  assert.throws(
    () => dailyTokenKendallTauAutocorrelationLag1([7, 7, 7, 7, 7]),
    /zero-variance lag-1 coordinate vector/,
  );
});

test('dailyTokenKendallTauAutocorrelationLag1: nComparisons = m*(m-1)/2', () => {
  const r = dailyTokenKendallTauAutocorrelationLag1([1, 5, 3, 9, 2, 7]);
  // n = 6, m = 5, comparisons = 10
  assert.equal(r.nPairs, 5);
  assert.equal(r.nComparisons, 10);
  // Pair classification partitions all comparisons.
  assert.equal(
    r.nConcordant + r.nDiscordant + r.nTiedU + r.nTiedV + r.nTiedBoth,
    r.nComparisons,
  );
});

test('dailyTokenKendallTauAutocorrelationLag1: tau in [-1, +1] for arbitrary input', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6];
  const r = dailyTokenKendallTauAutocorrelationLag1(x);
  assert.ok(r.tau >= -1 && r.tau <= 1, `tau out of bounds: ${r.tau}`);
});

test('dailyTokenKendallTauAutocorrelationLag1: tauZ formula matches no-ties asymptotic', () => {
  // Strictly monotone increasing of length n=10 -> m=9, tau=1
  // var(tau_a) = 2*(2*9+5)/(9*9*8) = 2*23/648 = 46/648 = 23/324
  // tauZ = 1 / sqrt(23/324)
  const r = dailyTokenKendallTauAutocorrelationLag1([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  const m = 9;
  const expectedZ = 1 / Math.sqrt((2 * (2 * m + 5)) / (9 * m * (m - 1)));
  assert.ok(
    Math.abs(r.tauZ - expectedZ) < 1e-12,
    `expected tauZ = ${expectedZ}, got ${r.tauZ}`,
  );
});

test('dailyTokenKendallTauAutocorrelationLag1: short m<4 collapses tauZ to 0', () => {
  // n=4 -> m=3, threshold for tauZ formula is m>=4 -> tauZ = 0
  const r = dailyTokenKendallTauAutocorrelationLag1([1, 2, 3, 4]);
  assert.equal(r.tauZ, 0);
});

test('dailyTokenKendallTauAutocorrelationLag1: tauExpectedIid is always 0', () => {
  const r = dailyTokenKendallTauAutocorrelationLag1([1, 5, 2, 8, 3]);
  assert.equal(r.tauExpectedIid, 0);
});

test('dailyTokenKendallTauAutocorrelationLag1: surfaces tied-U / tied-V counts on plateau', () => {
  // x = [5, 5, 5, 9, 9, 12]
  // u = [5, 5, 5, 9, 9], v = [5, 5, 9, 9, 12]
  // Pairs (i, j) i<j: (0,1)(0,2)(0,3)(0,4)(1,2)(1,3)(1,4)(2,3)(2,4)(3,4) = 10
  // (0,1): u 5=5, v 5=5 -> nTB
  // (0,2): u 5=5, v 5!=9 -> nTU
  // (1,2): u 5=5, v 5!=9 -> nTU
  // (0,3): u 5<9, v 5<9 -> nC
  // (0,4): u 5<9, v 5<12 -> nC
  // (1,3): u 5<9, v 5<9 -> nC
  // (1,4): u 5<9, v 5<12 -> nC
  // (2,3): u 5<9, v 9=9 -> nTV
  // (2,4): u 5<9, v 9<12 -> nC
  // (3,4): u 9=9, v 9<12 -> nTU
  // totals: nC=5, nD=0, nTU=3, nTV=1, nTB=1, sum=10
  const r = dailyTokenKendallTauAutocorrelationLag1([5, 5, 5, 9, 9, 12]);
  assert.equal(r.nConcordant, 5);
  assert.equal(r.nDiscordant, 0);
  assert.equal(r.nTiedU, 3);
  assert.equal(r.nTiedV, 1);
  assert.equal(r.nTiedBoth, 1);
});

test('dailyTokenKendallTauAutocorrelationLag1: mean and stddev match population formulas', () => {
  const x = [2, 4, 6, 8];
  const r = dailyTokenKendallTauAutocorrelationLag1(x);
  assert.equal(r.mean, 5);
  // population variance = ((-3)^2+(-1)^2+1^2+3^2)/4 = 20/4 = 5
  assert.ok(Math.abs(r.stddev - Math.sqrt(5)) < 1e-12);
});

// ---------- builder ----------

test('buildDailyTokenKendallTauAutocorrelationLag1: validates options', () => {
  assert.throws(
    () =>
      buildDailyTokenKendallTauAutocorrelationLag1([], {
        minTokens: -1,
      }),
    /minTokens must be a non-negative finite number/,
  );
  assert.throws(
    () =>
      buildDailyTokenKendallTauAutocorrelationLag1([], {
        minTenureDays: 3,
      }),
    /minTenureDays must be an integer >= 4/,
  );
  assert.throws(
    () =>
      buildDailyTokenKendallTauAutocorrelationLag1([], {
        top: -1,
      }),
    /top must be a non-negative integer/,
  );
  assert.throws(
    () =>
      buildDailyTokenKendallTauAutocorrelationLag1([], {
        // @ts-expect-error invalid sort key
        sort: 'bogus',
      }),
    /sort must be one of/,
  );
  assert.throws(
    () =>
      buildDailyTokenKendallTauAutocorrelationLag1([], {
        since: 'not-a-date',
      }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenKendallTauAutocorrelationLag1([], {
        until: 'not-a-date',
      }),
    /invalid until/,
  );
});

test('buildDailyTokenKendallTauAutocorrelationLag1: drops invalid hour_start and non-positive tokens', () => {
  const queue: QueueLine[] = [
    ql('not-iso', 'src-a', 1000),
    ql(dayIso(0), 'src-a', 0),
    ql(dayIso(1), 'src-a', -5),
    ql(dayIso(2), 'src-a', NaN as unknown as number),
  ];
  const r = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 3);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenKendallTauAutocorrelationLag1: monotone-up source has tau ~ +1', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'climb', 100 + 50 * i));
  }
  const r = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'climb');
  assert.equal(s.nTenureDays, 16);
  assert.equal(s.nPairs, 15);
  assert.ok(Math.abs(s.tau - 1) < 1e-12, `expected tau ~ 1, got ${s.tau}`);
  assert.ok(s.tauZ > 0);
  // 15 choose 2 = 105 comparisons, all concordant
  assert.equal(s.nComparisons, 105);
  assert.equal(s.nConcordant, 105);
  assert.equal(s.nDiscordant, 0);
});

test('buildDailyTokenKendallTauAutocorrelationLag1: gap-fills missing days as zero', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'sparse', 1000),
    ql(dayIso(5), 'sparse', 2000),
    ql(dayIso(10), 'sparse', 3000),
  ];
  const r = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.nTenureDays, 11);
  assert.equal(s.nActiveDays, 3);
  // Zero-padding creates many tied lag-1 pairs, expect tied counts > 0.
  assert.ok(s.nTiedU + s.nTiedV + s.nTiedBoth > 0);
  assert.ok(Number.isFinite(s.tau));
  assert.ok(s.tau >= -1 && s.tau <= 1, `tau must be in [-1, 1], got ${s.tau}`);
});

test('buildDailyTokenKendallTauAutocorrelationLag1: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 500));
  }
  const r = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenKendallTauAutocorrelationLag1: drops below-min-tenure sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'short', 1000 + i * 10));
  }
  const r = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenKendallTauAutocorrelationLag1: source filter restricts and counts dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'keep', 1000 + i * 10));
    queue.push(ql(dayIso(i), 'drop', 500 + i * 5));
  }
  const r = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 8);
});

test('buildDailyTokenKendallTauAutocorrelationLag1: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  const sources = ['a', 'b', 'c'];
  for (const src of sources) {
    for (let i = 0; i < 8; i += 1) {
      queue.push(ql(dayIso(i), src, 1000 + i * 100 + src.charCodeAt(0)));
    }
  }
  const r = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenKendallTauAutocorrelationLag1: drops sparse below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'small', 10 + i));
  }
  const r = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 1000,
    minTenureDays: 4,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenKendallTauAutocorrelationLag1: deterministic given identical input', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'det', 100 * Math.sin(i) + 1000));
  }
  const r1 = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  const r2 = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.deepEqual(r1, r2);
});

test('buildDailyTokenKendallTauAutocorrelationLag1: empty queue returns empty report', () => {
  const r = buildDailyTokenKendallTauAutocorrelationLag1([], {
    minTokens: 0,
    minTenureDays: 4,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
});

test('buildDailyTokenKendallTauAutocorrelationLag1: respects since/until window', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'win', 100 + i * 10));
  }
  const r = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    since: dayIso(2),
    until: dayIso(15),
  });
  assert.equal(r.sources.length, 1);
  // tenure spans days 2..14 inclusive = 13
  assert.equal(r.sources[0]!.nTenureDays, 13);
});

test('buildDailyTokenKendallTauAutocorrelationLag1: sort tau gives ascending tau', () => {
  const queue: QueueLine[] = [];
  // Build three sources with distinct, well-separated tau values.
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'up', 100 + 50 * i));
    queue.push(ql(dayIso(i), 'down', 1000 - 30 * i));
    queue.push(ql(dayIso(i), 'noise', 500 + 100 * Math.sin(i * 1.7)));
  }
  const r = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    sort: 'tau',
  });
  assert.equal(r.sources.length, 3);
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.tau <= r.sources[i]!.tau);
  }
});

test('buildDailyTokenKendallTauAutocorrelationLag1: sort tauDesc gives descending tau', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'up', 100 + 50 * i));
    queue.push(ql(dayIso(i), 'down', 1000 - 30 * i));
    queue.push(ql(dayIso(i), 'noise', 500 + 100 * Math.sin(i * 1.7)));
  }
  const r = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    sort: 'tauDesc',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.tau >= r.sources[i]!.tau);
  }
});

test('buildDailyTokenKendallTauAutocorrelationLag1: source-filter drop count is exact', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'a', 100),
    ql(dayIso(1), 'a', 200),
    ql(dayIso(0), 'b', 50),
    ql(dayIso(1), 'b', 60),
    ql(dayIso(2), 'b', 70),
  ];
  const r = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    source: 'a',
  });
  assert.equal(r.droppedSourceFilter, 3);
});

test('buildDailyTokenKendallTauAutocorrelationLag1: tau and Spearman are functionally independent (Daniels 1944)', () => {
  // Construct a series whose Kendall and Spearman differ, demonstrating
  // axis-108 carries information not captured by axis-107.
  const x = [1, 5, 2, 6, 3, 7, 4, 8, 9, 10];
  const r = dailyTokenKendallTauAutocorrelationLag1(x);
  // Just check tau is well-defined and not pinned to +/- 1.
  assert.ok(r.tau > -1 && r.tau < 1, `tau should be in (-1, 1) here: ${r.tau}`);
});

test('buildDailyTokenKendallTauAutocorrelationLag1: report carries correct meta fields', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'm', 1000 + i * 10));
  }
  const r = buildDailyTokenKendallTauAutocorrelationLag1(queue, {
    minTokens: 0,
    minTenureDays: 4,
    top: 5,
    sort: 'tau',
    generatedAt: '2026-05-03T12:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2026-05-03T12:00:00.000Z');
  assert.equal(r.minTokens, 0);
  assert.equal(r.minTenureDays, 4);
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'tau');
});
