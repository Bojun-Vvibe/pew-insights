import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenBartelsRankVonNeumann,
  buildDailyTokenBartelsRankVonNeumann,
} from '../src/dailytokenbartelsrankvonneumann.js';
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

test('dailyTokenBartelsRankVonNeumann: rejects fewer than 4 samples', () => {
  assert.throws(
    () => dailyTokenBartelsRankVonNeumann([1, 2, 3]),
    /at least 4 samples/,
  );
});

test('dailyTokenBartelsRankVonNeumann: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenBartelsRankVonNeumann([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenBartelsRankVonNeumann([1, Infinity, 3, 4]),
    /finite values/,
  );
});

test('dailyTokenBartelsRankVonNeumann: rejects zero rank variance (constant)', () => {
  assert.throws(
    () => dailyTokenBartelsRankVonNeumann([5, 5, 5, 5, 5]),
    /zero rank variance/,
  );
});

test('dailyTokenBartelsRankVonNeumann: strictly monotone -> RVN = 12 / (n(n+1))', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenBartelsRankVonNeumann(x);
  // ranks (1..8); numerator = 7; denominator = 8*63/12 = 42; RVN = 7/42 = 1/6
  assert.equal(r.bartelsNumerator, 7);
  assert.equal(r.bartelsDenominator, 42);
  assert.ok(Math.abs(r.bartelsRvn - 7 / 42) < 1e-12);
  assert.equal(r.nTies, 0);
  // Monotone -> very negative bZ
  assert.ok(r.bartelsZ < -2.5);
});

test('dailyTokenBartelsRankVonNeumann: monotone-decreasing has same RVN as monotone-increasing', () => {
  const up = dailyTokenBartelsRankVonNeumann([1, 2, 3, 4, 5, 6, 7, 8]);
  const down = dailyTokenBartelsRankVonNeumann([8, 7, 6, 5, 4, 3, 2, 1]);
  assert.equal(up.bartelsRvn, down.bartelsRvn);
  assert.equal(up.bartelsNumerator, down.bartelsNumerator);
});

test('dailyTokenBartelsRankVonNeumann: extreme oscillation -> RVN large', () => {
  // ranks 1, 8, 2, 7, 3, 6, 4, 5 (values chosen to yield this rank ordering)
  const x = [1, 80, 2, 70, 3, 60, 4, 50];
  const r = dailyTokenBartelsRankVonNeumann(x);
  // Should significantly exceed RVN of monotone case
  assert.ok(r.bartelsRvn > 1.5, `oscillating RVN should be large, got ${r.bartelsRvn}`);
  assert.ok(r.bartelsZ > 0, `oscillation should give bZ > 0, got ${r.bartelsZ}`);
});

test('dailyTokenBartelsRankVonNeumann: RVN is in [0, 4]', () => {
  const xs = [
    [1, 2, 3, 4, 5, 6],
    [6, 5, 4, 3, 2, 1],
    [1, 3, 2, 5, 4, 8, 7],
    [10, 1, 5, 7, 3, 100, 50, 25],
    [100, 50, 75, 25, 60, 30, 80, 40, 90],
  ];
  for (const x of xs) {
    const r = dailyTokenBartelsRankVonNeumann(x);
    assert.ok(r.bartelsRvn >= 0 && r.bartelsRvn <= 4, `RVN out of range: ${r.bartelsRvn} for ${x}`);
    assert.ok(Number.isFinite(r.bartelsZ));
    assert.ok(Number.isFinite(r.bartelsVar));
  }
});

test('dailyTokenBartelsRankVonNeumann: time-reversal symmetry', () => {
  const x = [1, 5, 2, 8, 4, 7, 9, 6];
  const xRev = [...x].reverse();
  const r = dailyTokenBartelsRankVonNeumann(x);
  const rRev = dailyTokenBartelsRankVonNeumann(xRev);
  // Squared adjacent rank differences are reversal-symmetric, so RVN matches.
  assert.ok(Math.abs(r.bartelsRvn - rRev.bartelsRvn) < 1e-12);
});

test('dailyTokenBartelsRankVonNeumann: scale and shift invariance', () => {
  const x = [1, 3, 2, 5, 4, 8, 7, 9];
  const r1 = dailyTokenBartelsRankVonNeumann(x);
  const r2 = dailyTokenBartelsRankVonNeumann(x.map((v) => v * 1000 + 17));
  assert.equal(r1.bartelsRvn, r2.bartelsRvn);
  assert.equal(r1.bartelsZ, r2.bartelsZ);
});

test('dailyTokenBartelsRankVonNeumann: ties counted via mid-rank', () => {
  // 4 zeros followed by 4 distinct positive values. The 4 zeros all share mid-rank (1+2+3+4)/4 = 2.5.
  const r = dailyTokenBartelsRankVonNeumann([0, 0, 0, 0, 1, 2, 3, 4]);
  assert.equal(r.nTies, 4);
  // Adjacent diffs of ranks: 0,0,0, (5-2.5), 1, 1, 1 -> sums: 0+0+0+6.25+1+1+1=9.25
  assert.ok(Math.abs(r.bartelsNumerator - 9.25) < 1e-9);
});

test('dailyTokenBartelsRankVonNeumann: variance matches Bartels 1982 closed form', () => {
  // For n=10, Var = 4(n-2)(5n^2 - 2n - 9) / (5 n (n+1) (n-1)^2)
  //            = 4*8*(500 - 20 - 9) / (5*10*11*81)
  //            = 32 * 471 / 44550
  //            = 15072 / 44550
  const r = dailyTokenBartelsRankVonNeumann([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const expected = 15072 / 44550;
  assert.ok(Math.abs(r.bartelsVar - expected) < 1e-9);
});

test('dailyTokenBartelsRankVonNeumann: result fields finite and consistent', () => {
  const r = dailyTokenBartelsRankVonNeumann([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(Number.isFinite(r.mean));
  assert.ok(Number.isFinite(r.stddev));
  assert.equal(r.nSamples, 10);
  assert.ok(r.bartelsRvn > 0 && r.bartelsRvn < 4);
});

// ---------- builder ----------

test('buildDailyTokenBartelsRankVonNeumann: rejects bad minTokens', () => {
  assert.throws(
    () => buildDailyTokenBartelsRankVonNeumann([], { minTokens: -1 }),
    /minTokens/,
  );
  assert.throws(
    () => buildDailyTokenBartelsRankVonNeumann([], { minTokens: NaN }),
    /minTokens/,
  );
});

test('buildDailyTokenBartelsRankVonNeumann: rejects minTenureDays below 4', () => {
  assert.throws(
    () => buildDailyTokenBartelsRankVonNeumann([], { minTenureDays: 3 }),
    /minTenureDays/,
  );
});

test('buildDailyTokenBartelsRankVonNeumann: rejects bad top', () => {
  assert.throws(
    () => buildDailyTokenBartelsRankVonNeumann([], { top: -1 }),
    /top/,
  );
});

test('buildDailyTokenBartelsRankVonNeumann: rejects unknown sort', () => {
  assert.throws(
    () =>
      buildDailyTokenBartelsRankVonNeumann([], {
        sort: 'bogus' as never,
      }),
    /sort/,
  );
});

test('buildDailyTokenBartelsRankVonNeumann: rejects bad since/until', () => {
  assert.throws(
    () => buildDailyTokenBartelsRankVonNeumann([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () => buildDailyTokenBartelsRankVonNeumann([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('buildDailyTokenBartelsRankVonNeumann: empty input -> empty report', () => {
  const r = buildDailyTokenBartelsRankVonNeumann([], {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenBartelsRankVonNeumann: drops invalid hour_start', () => {
  const queue: QueueLine[] = [ql('not-a-time', 'src', 100)];
  const r = buildDailyTokenBartelsRankVonNeumann(queue);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenBartelsRankVonNeumann: drops non-positive tokens', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'src', 0),
    ql(dayIso(1), 'src', -5),
    ql(dayIso(2), 'src', NaN),
  ];
  const r = buildDailyTokenBartelsRankVonNeumann(queue);
  assert.equal(r.droppedNonPositiveTokens, 3);
});

test('buildDailyTokenBartelsRankVonNeumann: source filter applied', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'a', 10),
    ql(dayIso(0), 'b', 20),
  ];
  const r = buildDailyTokenBartelsRankVonNeumann(queue, { source: 'a' });
  assert.equal(r.droppedSourceFilter, 1);
});

test('buildDailyTokenBartelsRankVonNeumann: drops sources below minTenureDays', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 5; d += 1) {
    queue.push(ql(dayIso(d), 'short', 500));
  }
  const r = buildDailyTokenBartelsRankVonNeumann(queue, {
    minTenureDays: 14,
    minTokens: 0,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenBartelsRankVonNeumann: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'flat', 500));
  }
  const r = buildDailyTokenBartelsRankVonNeumann(queue, { minTokens: 0 });
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenBartelsRankVonNeumann: monotone source -> RVN < 2, bZ < 0', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'up', 100 * (d + 1)));
  }
  const r = buildDailyTokenBartelsRankVonNeumann(queue, {
    minTokens: 0,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'up');
  assert.ok(row.bartelsRvn < 2);
  assert.ok(row.bartelsZ < 0);
});

test('buildDailyTokenBartelsRankVonNeumann: gap-filled days are zero-padded', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'sparse', 5000),
    ql(dayIso(19), 'sparse', 5000),
  ];
  const r = buildDailyTokenBartelsRankVonNeumann(queue, { minTokens: 0 });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nTenureDays, 20);
  assert.equal(row.nActiveDays, 2);
  // 18 zero-padded days share the lowest mid-rank
  assert.ok(row.nTies >= 18);
});

test('buildDailyTokenBartelsRankVonNeumann: top truncates and droppedTopSources surfaces', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 0; d < 20; d += 1) {
      queue.push(ql(dayIso(d), src, 100 * (d + 1) + (src.charCodeAt(0) - 97)));
    }
  }
  const r = buildDailyTokenBartelsRankVonNeumann(queue, {
    minTokens: 0,
    top: 2,
    sort: 'bZAbsDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenBartelsRankVonNeumann: sort variants are accepted', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 's', 100 * (d + 1)));
  }
  for (const sort of [
    'rvn',
    'rvnDesc',
    'bZ',
    'bZDesc',
    'bZAbs',
    'bZAbsDesc',
    'tokens',
    'tenure',
    'source',
  ] as const) {
    const r = buildDailyTokenBartelsRankVonNeumann(queue, { minTokens: 0, sort });
    assert.equal(r.sort, sort);
    assert.equal(r.sources.length, 1);
  }
});

test('buildDailyTokenBartelsRankVonNeumann: since/until window respected', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 30; d += 1) {
    queue.push(ql(dayIso(d), 'src', 100 * (d + 1)));
  }
  const r = buildDailyTokenBartelsRankVonNeumann(queue, {
    since: dayIso(5),
    until: dayIso(25),
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 20);
});

test('buildDailyTokenBartelsRankVonNeumann: unknown source label normalised', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), '', 100 * (d + 1)));
  }
  const r = buildDailyTokenBartelsRankVonNeumann(queue, { minTokens: 0 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('buildDailyTokenBartelsRankVonNeumann: report carries opts metadata', () => {
  const r = buildDailyTokenBartelsRankVonNeumann([], {
    generatedAt: '2026-05-03T01:02:03.000Z',
    minTokens: 250,
    minTenureDays: 21,
    top: 5,
    sort: 'rvnDesc',
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-05-01T00:00:00.000Z',
    source: 'foo',
  });
  assert.equal(r.generatedAt, '2026-05-03T01:02:03.000Z');
  assert.equal(r.minTokens, 250);
  assert.equal(r.minTenureDays, 21);
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'rvnDesc');
  assert.equal(r.windowStart, '2026-04-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-05-01T00:00:00.000Z');
  assert.equal(r.source, 'foo');
});

test('buildDailyTokenBartelsRankVonNeumann: secondary tie-break is source ascending', () => {
  const queue: QueueLine[] = [];
  for (const src of ['zeta', 'alpha', 'mu']) {
    for (let d = 0; d < 16; d += 1) {
      queue.push(ql(dayIso(d), src, 100 * (d + 1)));
    }
  }
  const r = buildDailyTokenBartelsRankVonNeumann(queue, {
    minTokens: 0,
    sort: 'bZAbsDesc',
  });
  // All three identical -> ties broken by source asc.
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mu', 'zeta'],
  );
});
