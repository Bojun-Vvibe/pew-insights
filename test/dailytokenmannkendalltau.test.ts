import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenMannKendallTau,
  buildDailyTokenMannKendallTau,
} from '../src/dailytokenmannkendalltau.js';
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

function expectedVarS(n: number): number {
  return (n * (n - 1) * (2 * n + 5)) / 18;
}

// ---------- primitive ----------

test('dailyTokenMannKendallTau: rejects fewer than 3 samples', () => {
  assert.throws(
    () => dailyTokenMannKendallTau([5, 6]),
    /at least 3 samples/,
  );
});

test('dailyTokenMannKendallTau: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenMannKendallTau([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenMannKendallTau([1, Infinity, 3]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenMannKendallTau([1, 2, 3, -Infinity]),
    /finite values/,
  );
});

test('dailyTokenMannKendallTau: strictly monotone increasing -> tau = +1', () => {
  const r = dailyTokenMannKendallTau([1, 2, 3, 4, 5, 6, 7, 8]);
  const n = 8;
  assert.equal(r.mannKendallS, (n * (n - 1)) / 2);
  assert.equal(r.mannKendallTau, 1);
  assert.equal(r.nConcordant, (n * (n - 1)) / 2);
  assert.equal(r.nDiscordant, 0);
  assert.equal(r.nTies, 0);
  assert.ok(r.mannKendallZ > 0);
});

test('dailyTokenMannKendallTau: strictly monotone decreasing -> tau = -1', () => {
  const r = dailyTokenMannKendallTau([8, 7, 6, 5, 4, 3, 2, 1]);
  const n = 8;
  assert.equal(r.mannKendallS, -((n * (n - 1)) / 2));
  assert.equal(r.mannKendallTau, -1);
  assert.equal(r.nConcordant, 0);
  assert.equal(r.nDiscordant, (n * (n - 1)) / 2);
  assert.equal(r.nTies, 0);
  assert.ok(r.mannKendallZ < 0);
});

test('dailyTokenMannKendallTau: constant series -> S = 0, tau = 0, all pairs tied', () => {
  const r = dailyTokenMannKendallTau([5, 5, 5, 5, 5, 5]);
  const n = 6;
  assert.equal(r.mannKendallS, 0);
  assert.equal(r.mannKendallTau, 0);
  assert.equal(r.nTies, (n * (n - 1)) / 2);
  assert.equal(r.nConcordant, 0);
  assert.equal(r.nDiscordant, 0);
  assert.equal(r.mannKendallZ, 0);
});

test('dailyTokenMannKendallTau: tent series (up then down) -> tau approx 0', () => {
  // 1,2,3,4,3,2,1: up 1->4 then down 4->1
  // pairs: i<j sgn diffs.
  const r = dailyTokenMannKendallTau([1, 2, 3, 4, 3, 2, 1]);
  // By symmetry around the apex (idx 3), the concordant and
  // discordant counts should differ but small.
  assert.ok(Math.abs(r.mannKendallTau) < 0.5);
});

test('dailyTokenMannKendallTau: tau matches manual count for small example', () => {
  // x = [1, 3, 2, 5, 4]
  // pairs (i,j): (0,1)=+, (0,2)=+, (0,3)=+, (0,4)=+,
  //              (1,2)=-, (1,3)=+, (1,4)=+,
  //              (2,3)=+, (2,4)=+,
  //              (3,4)=-
  // concordant=8, discordant=2, S=6, total=10, tau=0.6
  const r = dailyTokenMannKendallTau([1, 3, 2, 5, 4]);
  assert.equal(r.nConcordant, 8);
  assert.equal(r.nDiscordant, 2);
  assert.equal(r.mannKendallS, 6);
  assert.equal(r.nTies, 0);
  assert.equal(r.mannKendallTau, 0.6);
});

test('dailyTokenMannKendallTau: tau in [-1, +1] always', () => {
  const xs = [
    [1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1],
    [1, 3, 2, 5, 4],
    [2, 2, 2, 3, 3],
    [10, 1, 5, 7, 3],
    [0, 0, 0, 1, 0, 1],
    [100, 50, 75, 25, 60, 30, 80],
  ];
  for (const x of xs) {
    const r = dailyTokenMannKendallTau(x);
    assert.ok(r.mannKendallTau >= -1 && r.mannKendallTau <= 1);
  }
});

test('dailyTokenMannKendallTau: ties are NOT counted as concordant or discordant', () => {
  // x = [1, 2, 2, 3]
  // pairs: (0,1)=+, (0,2)=+, (0,3)=+, (1,2)=0, (1,3)=+, (2,3)=+
  // concordant=5, discordant=0, ties=1
  const r = dailyTokenMannKendallTau([1, 2, 2, 3]);
  assert.equal(r.nConcordant, 5);
  assert.equal(r.nDiscordant, 0);
  assert.equal(r.nTies, 1);
  assert.equal(r.mannKendallS, 5);
  assert.equal(r.mannKendallTau, 5 / 6);
});

test('dailyTokenMannKendallTau: tie correction reduces Var[S]', () => {
  // No-tie series: full Var[S] = n*(n-1)*(2n+5)/18
  const noTie = dailyTokenMannKendallTau([1, 2, 3, 4, 5, 6, 7]);
  const n = 7;
  assert.ok(Math.abs(noTie.mannKendallVarS - expectedVarS(n)) < 1e-9);

  // Tied series: should be strictly less.
  const tied = dailyTokenMannKendallTau([0, 0, 0, 0, 1, 2, 3]);
  assert.ok(tied.mannKendallVarS < expectedVarS(n));
  // Tie correction for one group of size 4: 4*3*13 = 156; /18 = 8.6...
  // So Var = (7*6*19 - 156)/18 = (798 - 156)/18 = 642/18 = 35.6...
  assert.ok(Math.abs(tied.mannKendallVarS - 642 / 18) < 1e-9);
});

test('dailyTokenMannKendallTau: continuity correction subtracts sgn(S)', () => {
  // For monotone increasing n=4: S = 6, Var = 4*3*13/18 = 8.667
  // mkZ = (6 - 1) / sqrt(8.667) = 5 / 2.944 = 1.698
  const r = dailyTokenMannKendallTau([1, 2, 3, 4]);
  const expectedZ = 5 / Math.sqrt((4 * 3 * 13) / 18);
  assert.ok(Math.abs(r.mannKendallZ - expectedZ) < 1e-9);
});

test('dailyTokenMannKendallTau: S = 0 yields mkZ = 0 (no continuity correction)', () => {
  // tent of length 5: 1,2,3,2,1
  // pairs: (0,1)+, (0,2)+, (0,3)+, (0,4)0, (1,2)+, (1,3)0, (1,4)-, (2,3)-, (2,4)-, (3,4)-
  // concordant=4, discordant=4, ties=2, S=0
  const r = dailyTokenMannKendallTau([1, 2, 3, 2, 1]);
  assert.equal(r.mannKendallS, 0);
  assert.equal(r.mannKendallTau, 0);
  assert.equal(r.mannKendallZ, 0);
});

test('dailyTokenMannKendallTau: sign of S equals sign of tau', () => {
  const r1 = dailyTokenMannKendallTau([1, 5, 2, 8, 3, 9]);
  assert.equal(Math.sign(r1.mannKendallS), Math.sign(r1.mannKendallTau));
  const r2 = dailyTokenMannKendallTau([9, 3, 8, 2, 5, 1]);
  assert.equal(Math.sign(r2.mannKendallS), Math.sign(r2.mannKendallTau));
});

test('dailyTokenMannKendallTau: time-reversal flips sign', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 7];
  const fwd = dailyTokenMannKendallTau(x);
  const rev = dailyTokenMannKendallTau([...x].reverse());
  assert.equal(fwd.mannKendallS, -rev.mannKendallS);
  assert.equal(fwd.mannKendallTau, -rev.mannKendallTau);
});

test('dailyTokenMannKendallTau: nConcordant + nDiscordant + nTies = n*(n-1)/2', () => {
  const xs = [
    [1, 2, 3, 4],
    [4, 3, 2, 1],
    [0, 0, 0, 0, 0, 1],
    [1, 3, 2, 4, 2, 5, 3],
  ];
  for (const x of xs) {
    const r = dailyTokenMannKendallTau(x);
    const n = x.length;
    assert.equal(
      r.nConcordant + r.nDiscordant + r.nTies,
      (n * (n - 1)) / 2,
    );
  }
});

test('dailyTokenMannKendallTau: mean and stddev are population moments', () => {
  const r = dailyTokenMannKendallTau([1, 2, 3, 4, 5]);
  assert.equal(r.mean, 3);
  // population stddev: sqrt(((-2)^2 + (-1)^2 + 0 + 1 + 4)/5) = sqrt(2)
  assert.ok(Math.abs(r.stddev - Math.sqrt(2)) < 1e-9);
});

test('dailyTokenMannKendallTau: nSamples reflects input length', () => {
  const r = dailyTokenMannKendallTau([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.nSamples, 10);
});

// ---------- builder ----------

test('buildDailyTokenMannKendallTau: dropped counters surface', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 5000),
    ql(dayIso(0), 'a', -100),
    ql(dayIso(0), 'a', 5000),
  ];
  const r = buildDailyTokenMannKendallTau(queue, {
    minTenureDays: 4,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 1);
});

test('buildDailyTokenMannKendallTau: source filter surfaces droppedSourceFilter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'a', 1000 + i * 100));
    queue.push(ql(dayIso(i), 'b', 1000));
  }
  const r = buildDailyTokenMannKendallTau(queue, {
    source: 'a',
    minTenureDays: 4,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedSourceFilter, 20);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('buildDailyTokenMannKendallTau: monotone-increasing source has tau approx +1', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'climbing', 1000 + i * 200));
  }
  const r = buildDailyTokenMannKendallTau(queue, {
    minTenureDays: 4,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.mannKendallTau, 1);
  assert.ok(s.mannKendallZ > 2);
});

test('buildDailyTokenMannKendallTau: monotone-decreasing source has tau approx -1', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'falling', 30000 - i * 500));
  }
  const r = buildDailyTokenMannKendallTau(queue, {
    minTenureDays: 4,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.mannKendallTau, -1);
  assert.ok(s.mannKendallZ < -2);
});

test('buildDailyTokenMannKendallTau: zero-variance source dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 5000));
  }
  const r = buildDailyTokenMannKendallTau(queue, {
    minTenureDays: 4,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenMannKendallTau: below min-tenure-days dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'shorty', 1000 + i * 100));
  }
  const r = buildDailyTokenMannKendallTau(queue, {
    minTenureDays: 14,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenMannKendallTau: below min-tokens dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'sparse', 10));
  }
  const r = buildDailyTokenMannKendallTau(queue, {
    minTokens: 1000,
    minTenureDays: 4,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenMannKendallTau: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), `src-${s}`, 1000 + i * (s + 1)));
    }
  }
  const r = buildDailyTokenMannKendallTau(queue, {
    minTenureDays: 4,
    top: 2,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('buildDailyTokenMannKendallTau: sort=tauDesc puts highest tau first', () => {
  const queue: QueueLine[] = [];
  // Source up: monotone increase
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'up', 1000 + i * 100));
  // Source down: monotone decrease
  for (let i = 0; i < 20; i += 1) queue.push(ql(dayIso(i), 'down', 5000 - i * 100));
  const r = buildDailyTokenMannKendallTau(queue, {
    minTenureDays: 4,
    sort: 'tauDesc',
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.source, 'up');
  assert.equal(r.sources[1]!.source, 'down');
});

test('buildDailyTokenMannKendallTau: invalid sort throws', () => {
  assert.throws(
    () =>
      buildDailyTokenMannKendallTau([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenMannKendallTau: invalid minTenureDays (< 4) throws', () => {
  assert.throws(
    () => buildDailyTokenMannKendallTau([], { minTenureDays: 3 }),
    /minTenureDays must be an integer >= 4/,
  );
});

test('buildDailyTokenMannKendallTau: invalid minTokens (negative) throws', () => {
  assert.throws(
    () => buildDailyTokenMannKendallTau([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('buildDailyTokenMannKendallTau: invalid since throws', () => {
  assert.throws(
    () => buildDailyTokenMannKendallTau([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('buildDailyTokenMannKendallTau: invalid until throws', () => {
  assert.throws(
    () => buildDailyTokenMannKendallTau([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('buildDailyTokenMannKendallTau: empty queue yields empty report', () => {
  const r = buildDailyTokenMannKendallTau([], {
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
});

test('buildDailyTokenMannKendallTau: gap-filled tenure inserts zero days', () => {
  const queue: QueueLine[] = [];
  // Day 0 and day 19 only -> tenure = 20 days, 18 zero days in between.
  queue.push(ql(dayIso(0), 'gappy', 5000));
  queue.push(ql(dayIso(19), 'gappy', 7000));
  const r = buildDailyTokenMannKendallTau(queue, {
    minTenureDays: 4,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.nTenureDays, 20);
  assert.equal(s.nActiveDays, 2);
  // first index 5000, last index 7000, 18 zeros in middle.
  // pairs: index 0 (5000) vs 18 zeros: 18 discordant; index 0 vs index 19 (7000): 1 concordant.
  // 18 zeros pairwise: 18*17/2 = 153 ties.
  // index 19 (7000) vs 18 zeros (preceding): 18 concordant (7000 > 0).
  // S = 1 (idx0->idx19) - 18 (idx0->zeros) + 18 (zeros->idx19) = 1.
  assert.equal(s.mannKendallS, 1);
});

test('buildDailyTokenMannKendallTau: invalid top throws', () => {
  assert.throws(
    () => buildDailyTokenMannKendallTau([], { top: -1 }),
    /top must be a non-negative integer/,
  );
});

test('buildDailyTokenMannKendallTau: deterministic generatedAt is preserved', () => {
  const r = buildDailyTokenMannKendallTau([], {
    generatedAt: '2026-05-03T12:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2026-05-03T12:00:00.000Z');
});

test('buildDailyTokenMannKendallTau: source-asc tie break for equal sort key', () => {
  const queue: QueueLine[] = [];
  // Both sources have the same monotone increase shape -> same tau.
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'zebra', 1000 + i * 100));
    queue.push(ql(dayIso(i), 'apple', 1000 + i * 100));
  }
  const r = buildDailyTokenMannKendallTau(queue, {
    minTenureDays: 4,
    sort: 'tauDesc',
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  // Same tau -> tie break by source asc.
  assert.equal(r.sources[0]!.source, 'apple');
  assert.equal(r.sources[1]!.source, 'zebra');
});

test('buildDailyTokenMannKendallTau: window since/until filters by hour_start ms', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'win', 1000 + i * 50));
  }
  const r = buildDailyTokenMannKendallTau(queue, {
    minTenureDays: 4,
    since: dayIso(5),
    until: dayIso(15),
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  // since inclusive, until exclusive -> 10 active days (5..14).
  assert.equal(s.nActiveDays, 10);
});

test('dailyTokenMannKendallTau: large monotone series stays exact (no float drift)', () => {
  // n=200 strictly increasing -> tau = +1 exactly, S = 200*199/2 = 19900.
  const x: number[] = [];
  for (let i = 0; i < 200; i += 1) x.push(i + 1);
  const r = dailyTokenMannKendallTau(x);
  assert.equal(r.mannKendallS, 19900);
  assert.equal(r.mannKendallTau, 1);
  assert.equal(r.nDiscordant, 0);
  assert.equal(r.nTies, 0);
});

test('dailyTokenMannKendallTau: tied-group key is the exact value (zero-pad bucket)', () => {
  // 10 zeros + a single 5 -> one tied group of size 10.
  // Pairs: 10*9/2 = 45 ties at zero, 10 conc (5 > 0 for each
  // zero preceding the 5 if 5 is last; here we put 5 last).
  const x = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5];
  const r = dailyTokenMannKendallTau(x);
  assert.equal(r.nTies, 45);
  assert.equal(r.nConcordant, 10);
  assert.equal(r.nDiscordant, 0);
  assert.equal(r.mannKendallS, 10);
  // Tie correction for one group of 10: 10*9*25 = 2250.
  // Var = (11*10*27 - 2250)/18 = (2970 - 2250)/18 = 720/18 = 40.
  assert.ok(Math.abs(r.mannKendallVarS - 40) < 1e-9);
});
