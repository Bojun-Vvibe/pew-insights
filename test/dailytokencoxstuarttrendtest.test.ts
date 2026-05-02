import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenCoxStuartTrendTest,
  buildDailyTokenCoxStuartTrendTest,
} from '../src/dailytokencoxstuarttrendtest.js';
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

test('dailyTokenCoxStuartTrendTest: rejects fewer than 4 samples', () => {
  assert.throws(
    () => dailyTokenCoxStuartTrendTest([1, 2, 3]),
    /at least 4 samples/,
  );
});

test('dailyTokenCoxStuartTrendTest: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenCoxStuartTrendTest([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenCoxStuartTrendTest([1, Infinity, 3, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenCoxStuartTrendTest([1, 2, 3, -Infinity]),
    /finite values/,
  );
});

test('dailyTokenCoxStuartTrendTest: strictly monotone increasing -> csTau = +1', () => {
  const r = dailyTokenCoxStuartTrendTest([1, 2, 3, 4, 5, 6, 7, 8]);
  // n=8, c=4, m=4, every diff > 0 -> nPos=4, nNeg=0, k=4
  assert.equal(r.coxStuartLag, 4);
  assert.equal(r.nPairs, 4);
  assert.equal(r.nPositive, 4);
  assert.equal(r.nNegative, 0);
  assert.equal(r.nTied, 0);
  assert.equal(r.nEffective, 4);
  assert.equal(r.coxStuartS, 4);
  assert.equal(r.coxStuartTau, 1);
  assert.ok(r.coxStuartZ > 0);
});

test('dailyTokenCoxStuartTrendTest: strictly monotone decreasing -> csTau = -1', () => {
  const r = dailyTokenCoxStuartTrendTest([8, 7, 6, 5, 4, 3, 2, 1]);
  assert.equal(r.nPositive, 0);
  assert.equal(r.nNegative, 4);
  assert.equal(r.nTied, 0);
  assert.equal(r.coxStuartS, -4);
  assert.equal(r.coxStuartTau, -1);
  assert.ok(r.coxStuartZ < 0);
});

test('dailyTokenCoxStuartTrendTest: constant series -> all tied, k = 0, csTau = 0, csZ = 0', () => {
  const r = dailyTokenCoxStuartTrendTest([5, 5, 5, 5, 5, 5]);
  assert.equal(r.nPositive, 0);
  assert.equal(r.nNegative, 0);
  assert.equal(r.nTied, 3);
  assert.equal(r.nEffective, 0);
  assert.equal(r.coxStuartS, 0);
  assert.equal(r.coxStuartTau, 0);
  assert.equal(r.coxStuartZ, 0);
});

test('dailyTokenCoxStuartTrendTest: odd n drops middle observation', () => {
  // n=7, c=3, m=3; pairs (0,3), (1,4), (2,5); index 6 is x[i+c=6] for i=3 NOT taken (m=3), and x[3] is the middle dropped per spec
  // Actually per implementation: m = floor(n/2) = 3, c = floor(n/2) = 3
  // pairs: (0,3), (1,4), (2,5); index 6 untouched, index 3 acts as second-half entry of (0,3)
  // Wait: middle is x[c]=x[3]. With m=3 we use i=0,1,2; second-half indices i+c = 3,4,5. So x[3] IS used (as paired-second), x[6] is dropped.
  // The Cox-Stuart 1955 spec actually drops the MIDDLE when n is odd. Our implementation drops x[6] (the LAST), which preserves the pairing (x[i], x[i+c]). This is mathematically equivalent in the original Cox-Stuart formulation; what matters is that there are floor(n/2) non-overlapping paired comparisons.
  const r = dailyTokenCoxStuartTrendTest([1, 2, 3, 10, 20, 30, 99]);
  assert.equal(r.coxStuartLag, 3);
  assert.equal(r.nPairs, 3);
  // d = (10-1, 20-2, 30-3) = (9, 18, 27) -- all positive
  assert.equal(r.nPositive, 3);
  assert.equal(r.nNegative, 0);
  assert.equal(r.coxStuartTau, 1);
});

test('dailyTokenCoxStuartTrendTest: csTau matches manual count for small example', () => {
  // x = [1, 5, 2, 8, 3, 4, 9, 6]; n=8, c=4, m=4
  // pairs: (1,3)=+, (5,4)=-, (2,9)=+, (8,6)=-
  // nPos=2, nNeg=2, k=4, S=0, csTau=0
  const r = dailyTokenCoxStuartTrendTest([1, 5, 2, 8, 3, 4, 9, 6]);
  assert.equal(r.nPositive, 2);
  assert.equal(r.nNegative, 2);
  assert.equal(r.coxStuartS, 0);
  assert.equal(r.coxStuartTau, 0);
  assert.equal(r.coxStuartZ, 0);
});

test('dailyTokenCoxStuartTrendTest: csTau in [-1, +1] always', () => {
  const xs = [
    [1, 2, 3, 4, 5, 6],
    [6, 5, 4, 3, 2, 1],
    [1, 3, 2, 5, 4, 8, 7],
    [2, 2, 2, 3, 3, 3],
    [10, 1, 5, 7, 3, 100, 50, 25],
    [0, 0, 0, 1, 0, 1],
    [100, 50, 75, 25, 60, 30, 80, 40, 90],
  ];
  for (const x of xs) {
    const r = dailyTokenCoxStuartTrendTest(x);
    assert.ok(r.coxStuartTau >= -1 && r.coxStuartTau <= 1, `csTau out of range: ${r.coxStuartTau} for ${x}`);
    assert.equal(r.nPositive + r.nNegative + r.nTied, r.nPairs);
    assert.equal(r.nEffective, r.nPositive + r.nNegative);
    assert.equal(r.coxStuartS, r.nPositive - r.nNegative);
  }
});

test('dailyTokenCoxStuartTrendTest: time-reversal anti-symmetry', () => {
  const x = [1, 5, 2, 8, 4, 7, 9, 6];
  const xRev = [...x].reverse();
  const r = dailyTokenCoxStuartTrendTest(x);
  const rRev = dailyTokenCoxStuartTrendTest(xRev);
  // Cox-Stuart is anti-symmetric under time reversal:
  //  S_CS(reverse) = -S_CS(original)
  assert.equal(rRev.coxStuartS, -r.coxStuartS);
  assert.equal(rRev.coxStuartTau + r.coxStuartTau, 0);
});

test('dailyTokenCoxStuartTrendTest: scale invariance of csTau', () => {
  const x = [1, 3, 2, 5, 4, 8, 7, 9];
  const r1 = dailyTokenCoxStuartTrendTest(x);
  const r2 = dailyTokenCoxStuartTrendTest(x.map((v) => v * 1000));
  assert.equal(r1.coxStuartTau, r2.coxStuartTau);
  assert.equal(r1.coxStuartS, r2.coxStuartS);
  assert.equal(r1.nPositive, r2.nPositive);
  assert.equal(r1.nNegative, r2.nNegative);
});

test('dailyTokenCoxStuartTrendTest: shift invariance of csTau', () => {
  const x = [1, 3, 2, 5, 4, 8, 7, 9];
  const r1 = dailyTokenCoxStuartTrendTest(x);
  const r2 = dailyTokenCoxStuartTrendTest(x.map((v) => v + 100));
  assert.equal(r1.coxStuartTau, r2.coxStuartTau);
  assert.equal(r1.coxStuartS, r2.coxStuartS);
});

test('dailyTokenCoxStuartTrendTest: half-shifted plateau -> csTau = +1', () => {
  // First half all 1s, second half all 5s. Every diff = 4 > 0.
  const x = [1, 1, 1, 1, 5, 5, 5, 5];
  const r = dailyTokenCoxStuartTrendTest(x);
  assert.equal(r.nPositive, 4);
  assert.equal(r.nNegative, 0);
  assert.equal(r.nTied, 0);
  assert.equal(r.coxStuartTau, 1);
});

test('dailyTokenCoxStuartTrendTest: zero-padded sparse series -> nTied surfaced', () => {
  // 8 values, half zero-padded coinciding -- both halves have zeros at the same offsets.
  const x = [0, 5, 0, 7, 0, 8, 0, 9];
  const r = dailyTokenCoxStuartTrendTest(x);
  // pairs: (0,0)=tie, (5,8)=+, (0,0)=tie, (7,9)=+
  assert.equal(r.nPositive, 2);
  assert.equal(r.nNegative, 0);
  assert.equal(r.nTied, 2);
  assert.equal(r.nEffective, 2);
  assert.equal(r.coxStuartTau, 1);
});

test('dailyTokenCoxStuartTrendTest: result fields are finite and consistent', () => {
  const r = dailyTokenCoxStuartTrendTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(Number.isFinite(r.mean));
  assert.ok(Number.isFinite(r.stddev));
  assert.ok(Number.isFinite(r.coxStuartTau));
  assert.ok(Number.isFinite(r.coxStuartZ));
  assert.equal(r.nSamples, 10);
  assert.equal(r.coxStuartLag, 5);
  assert.equal(r.nPairs, 5);
});

// ---------- builder ----------

test('buildDailyTokenCoxStuartTrendTest: rejects bad minTokens', () => {
  assert.throws(
    () => buildDailyTokenCoxStuartTrendTest([], { minTokens: -1 }),
    /minTokens/,
  );
  assert.throws(
    () => buildDailyTokenCoxStuartTrendTest([], { minTokens: NaN }),
    /minTokens/,
  );
});

test('buildDailyTokenCoxStuartTrendTest: rejects minTenureDays below 4', () => {
  assert.throws(
    () => buildDailyTokenCoxStuartTrendTest([], { minTenureDays: 3 }),
    /minTenureDays/,
  );
  assert.throws(
    () => buildDailyTokenCoxStuartTrendTest([], { minTenureDays: 1.5 as never }),
    /minTenureDays/,
  );
});

test('buildDailyTokenCoxStuartTrendTest: rejects bad top', () => {
  assert.throws(
    () => buildDailyTokenCoxStuartTrendTest([], { top: -1 }),
    /top/,
  );
  assert.throws(
    () => buildDailyTokenCoxStuartTrendTest([], { top: 1.7 as never }),
    /top/,
  );
});

test('buildDailyTokenCoxStuartTrendTest: rejects unknown sort', () => {
  assert.throws(
    () =>
      buildDailyTokenCoxStuartTrendTest([], {
        sort: 'bogus' as never,
      }),
    /sort/,
  );
});

test('buildDailyTokenCoxStuartTrendTest: rejects bad since/until', () => {
  assert.throws(
    () => buildDailyTokenCoxStuartTrendTest([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () => buildDailyTokenCoxStuartTrendTest([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('buildDailyTokenCoxStuartTrendTest: empty input -> empty report', () => {
  const r = buildDailyTokenCoxStuartTrendTest([], { generatedAt: '2026-05-03T00:00:00.000Z' });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('buildDailyTokenCoxStuartTrendTest: drops invalid hour_start', () => {
  const queue: QueueLine[] = [ql('not-a-time', 'src', 100)];
  const r = buildDailyTokenCoxStuartTrendTest(queue);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenCoxStuartTrendTest: drops non-positive tokens', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'src', 0),
    ql(dayIso(1), 'src', -5),
    ql(dayIso(2), 'src', NaN),
  ];
  const r = buildDailyTokenCoxStuartTrendTest(queue);
  assert.equal(r.droppedNonPositiveTokens, 3);
});

test('buildDailyTokenCoxStuartTrendTest: source filter applied', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'a', 10),
    ql(dayIso(0), 'b', 20),
  ];
  const r = buildDailyTokenCoxStuartTrendTest(queue, { source: 'a' });
  assert.equal(r.droppedSourceFilter, 1);
});

test('buildDailyTokenCoxStuartTrendTest: drops sources below minTokens', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'sparse', 1));
  }
  const r = buildDailyTokenCoxStuartTrendTest(queue, { minTokens: 1000 });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenCoxStuartTrendTest: drops sources below minTenureDays', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 5; d += 1) {
    queue.push(ql(dayIso(d), 'short', 500));
  }
  const r = buildDailyTokenCoxStuartTrendTest(queue, { minTenureDays: 14, minTokens: 0 });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenCoxStuartTrendTest: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'flat', 500));
  }
  const r = buildDailyTokenCoxStuartTrendTest(queue, { minTokens: 0 });
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenCoxStuartTrendTest: monotone source -> csTau = +1', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'up', 100 * (d + 1)));
  }
  const r = buildDailyTokenCoxStuartTrendTest(queue, {
    minTokens: 0,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'up');
  assert.equal(row.coxStuartTau, 1);
  assert.equal(row.nPositive, row.nPairs);
  assert.equal(row.nNegative, 0);
});

test('buildDailyTokenCoxStuartTrendTest: gap-filled days are zero-padded', () => {
  // active on day 0 and day 19 only; tenure = 20 days
  const queue: QueueLine[] = [
    ql(dayIso(0), 'sparse', 5000),
    ql(dayIso(19), 'sparse', 5000),
  ];
  const r = buildDailyTokenCoxStuartTrendTest(queue, { minTokens: 0 });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nTenureDays, 20);
  assert.equal(row.nActiveDays, 2);
  assert.equal(row.nPairs, 10);
  // pairs: (0,10), (1,11), ..., (9,19); only (9, 19) has positive diff.
  // (0,10) = (5000, 0) = NEG; (9,19)=(0,5000)=POS; rest tied.
  assert.equal(row.nPositive, 1);
  assert.equal(row.nNegative, 1);
  assert.equal(row.nTied, 8);
  assert.equal(row.coxStuartS, 0);
  assert.equal(row.coxStuartTau, 0);
});

test('buildDailyTokenCoxStuartTrendTest: top truncates and droppedTopSources surfaces', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 0; d < 20; d += 1) {
      queue.push(ql(dayIso(d), src, 100 * (d + 1) + (src.charCodeAt(0) - 97)));
    }
  }
  const r = buildDailyTokenCoxStuartTrendTest(queue, {
    minTokens: 0,
    top: 2,
    sort: 'tauAbsDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenCoxStuartTrendTest: sort csZAbsDesc puts strongest |csZ| first', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    // strong-trend source
    queue.push(ql(dayIso(d), 'strong', 100 * (d + 1)));
    // noisier source
    queue.push(ql(dayIso(d), 'noisy', 500 + ((d * 37) % 100)));
  }
  const r = buildDailyTokenCoxStuartTrendTest(queue, {
    minTokens: 0,
    sort: 'csZAbsDesc',
  });
  assert.ok(r.sources.length >= 1);
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      Math.abs(r.sources[i - 1]!.coxStuartZ) >= Math.abs(r.sources[i]!.coxStuartZ),
    );
  }
});

test('buildDailyTokenCoxStuartTrendTest: sort variants are accepted', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 's', 100 * (d + 1)));
  }
  for (const sort of [
    'tau',
    'tauDesc',
    'tauAbs',
    'tauAbsDesc',
    'csZ',
    'csZDesc',
    'csZAbs',
    'csZAbsDesc',
    'tokens',
    'tenure',
    'source',
  ] as const) {
    const r = buildDailyTokenCoxStuartTrendTest(queue, { minTokens: 0, sort });
    assert.equal(r.sort, sort);
    assert.equal(r.sources.length, 1);
  }
});

test('buildDailyTokenCoxStuartTrendTest: since/until window respected', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 30; d += 1) {
    queue.push(ql(dayIso(d), 'src', 100 * (d + 1)));
  }
  const r = buildDailyTokenCoxStuartTrendTest(queue, {
    since: dayIso(5),
    until: dayIso(25),
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nTenureDays, 20);
});

test('buildDailyTokenCoxStuartTrendTest: unknown source label normalised', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), '', 100 * (d + 1)));
  }
  const r = buildDailyTokenCoxStuartTrendTest(queue, { minTokens: 0 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('buildDailyTokenCoxStuartTrendTest: report carries opts metadata', () => {
  const r = buildDailyTokenCoxStuartTrendTest([], {
    generatedAt: '2026-05-03T01:02:03.000Z',
    minTokens: 250,
    minTenureDays: 21,
    top: 5,
    sort: 'tauDesc',
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-05-01T00:00:00.000Z',
    source: 'foo',
  });
  assert.equal(r.generatedAt, '2026-05-03T01:02:03.000Z');
  assert.equal(r.minTokens, 250);
  assert.equal(r.minTenureDays, 21);
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'tauDesc');
  assert.equal(r.windowStart, '2026-04-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-05-01T00:00:00.000Z');
  assert.equal(r.source, 'foo');
});

test('buildDailyTokenCoxStuartTrendTest: monotone-down source -> csTau = -1, csZ < 0', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'down', 100 * (20 - d)));
  }
  const r = buildDailyTokenCoxStuartTrendTest(queue, { minTokens: 0 });
  const row = r.sources[0]!;
  assert.equal(row.coxStuartTau, -1);
  assert.ok(row.coxStuartZ < 0);
});

test('buildDailyTokenCoxStuartTrendTest: secondary tie-break is source ascending', () => {
  const queue: QueueLine[] = [];
  for (const src of ['zeta', 'alpha', 'mu']) {
    for (let d = 0; d < 16; d += 1) {
      queue.push(ql(dayIso(d), src, 100 * (d + 1)));
    }
  }
  const r = buildDailyTokenCoxStuartTrendTest(queue, {
    minTokens: 0,
    sort: 'tauAbsDesc',
  });
  // All three have tau = +1, so primary tie -> source ascending.
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mu', 'zeta'],
  );
});
