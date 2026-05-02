import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenDifferenceSignTest,
  buildDailyTokenDifferenceSignTest,
} from '../src/dailytokendifferencesigntest.js';
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

test('dailyTokenDifferenceSignTest: rejects fewer than 4 samples', () => {
  assert.throws(
    () => dailyTokenDifferenceSignTest([1, 2, 3]),
    /at least 4 samples/,
  );
});

test('dailyTokenDifferenceSignTest: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenDifferenceSignTest([1, 2, NaN, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenDifferenceSignTest([1, Infinity, 3, 4]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenDifferenceSignTest([1, 2, 3, -Infinity]),
    /finite values/,
  );
});

test('dailyTokenDifferenceSignTest: strictly monotone increasing -> S = n-1', () => {
  const r = dailyTokenDifferenceSignTest([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.dsN, 7);
  assert.equal(r.dsS, 7);
  assert.equal(r.dsSneg, 0);
  assert.equal(r.dsSzero, 0);
  // dZ = (7 - 3.5)/sqrt(1.75) = 3.5 / 1.3228... ~ 2.6457
  assert.ok(Math.abs(r.dsZ - 3.5 / Math.sqrt(1.75)) < 1e-9);
  assert.ok(r.dsZ > 2.5);
});

test('dailyTokenDifferenceSignTest: strictly monotone decreasing -> S = 0', () => {
  const r = dailyTokenDifferenceSignTest([8, 7, 6, 5, 4, 3, 2, 1]);
  assert.equal(r.dsS, 0);
  assert.equal(r.dsSneg, 7);
  assert.equal(r.dsSzero, 0);
  assert.ok(r.dsZ < -2.5);
});

test('dailyTokenDifferenceSignTest: monotone-down has dsZ that is the negative of monotone-up', () => {
  const up = dailyTokenDifferenceSignTest([1, 2, 3, 4, 5, 6, 7, 8]);
  const down = dailyTokenDifferenceSignTest([8, 7, 6, 5, 4, 3, 2, 1]);
  assert.ok(Math.abs(up.dsZ + down.dsZ) < 1e-12);
});

test('dailyTokenDifferenceSignTest: alternating series -> dZ near 0', () => {
  // 1, 2, 1, 2, 1, 2, 1, 2 -> diffs: +1,-1,+1,-1,+1,-1,+1 -> S=4, n-1=7
  const r = dailyTokenDifferenceSignTest([1, 2, 1, 2, 1, 2, 1, 2]);
  assert.equal(r.dsS, 4);
  assert.equal(r.dsSneg, 3);
  assert.equal(r.dsSzero, 0);
  // (4 - 3.5)/sqrt(1.75) = 0.5/1.323 ~ 0.378
  assert.ok(Math.abs(r.dsZ) < 1.0);
});

test('dailyTokenDifferenceSignTest: zero steps tracked separately and excluded from S+/S-', () => {
  // 1,1,2,2,3,3 -> diffs: 0,+1,0,+1,0 -> S=2, S-=0, S0=3
  const r = dailyTokenDifferenceSignTest([1, 1, 2, 2, 3, 3]);
  assert.equal(r.dsS, 2);
  assert.equal(r.dsSneg, 0);
  assert.equal(r.dsSzero, 3);
  // S + Sneg + Szero == n - 1
  assert.equal(r.dsS + r.dsSneg + r.dsSzero, r.dsN);
});

test('dailyTokenDifferenceSignTest: variance is (n-1)/4', () => {
  const r = dailyTokenDifferenceSignTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.dsN, 9);
  assert.equal(r.dsVar, 9 / 4);
});

test('dailyTokenDifferenceSignTest: scale and shift invariance of dsZ', () => {
  const x = [1, 3, 2, 5, 4, 8, 7, 9];
  const r1 = dailyTokenDifferenceSignTest(x);
  const r2 = dailyTokenDifferenceSignTest(x.map((v) => v * 1000 + 17));
  assert.equal(r1.dsS, r2.dsS);
  assert.equal(r1.dsZ, r2.dsZ);
});

test('dailyTokenDifferenceSignTest: NOT time-reversal invariant -- forward S vs reverse S satisfies S_rev = (n-1) - S - S0', () => {
  const x = [1, 5, 2, 8, 4, 7, 9, 6];
  const xRev = [...x].reverse();
  const f = dailyTokenDifferenceSignTest(x);
  const b = dailyTokenDifferenceSignTest(xRev);
  // Each strict ascent forward becomes a strict descent backward and vice versa.
  assert.equal(b.dsS, f.dsN - f.dsS - f.dsSzero);
  assert.equal(b.dsSneg, f.dsS);
  assert.equal(b.dsSzero, f.dsSzero);
  // dsZ flips sign.
  assert.ok(Math.abs(f.dsZ + b.dsZ) < 1e-12);
});

test('dailyTokenDifferenceSignTest: all-zero diffs (constant) -> S=0, S-=0, S0=n-1, dsZ negative-and-large', () => {
  // The primitive does NOT throw on constant series (the builder filters
  // out zero-variance sources upstream). Constant input gives all zero
  // diffs, so S = 0 and dsZ = (0 - (n-1)/2)/sqrt((n-1)/4) = -sqrt(n-1).
  const r = dailyTokenDifferenceSignTest([5, 5, 5, 5]);
  assert.equal(r.dsS, 0);
  assert.equal(r.dsSneg, 0);
  assert.equal(r.dsSzero, 3);
  assert.ok(Math.abs(r.dsZ + Math.sqrt(3)) < 1e-12);
});

test('dailyTokenDifferenceSignTest: result fields finite and consistent', () => {
  const r = dailyTokenDifferenceSignTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(Number.isFinite(r.mean));
  assert.ok(Number.isFinite(r.stddev));
  assert.equal(r.nSamples, 10);
  assert.ok(r.dsS >= 0 && r.dsS <= r.dsN);
});

test('dailyTokenDifferenceSignTest: S in {0, .., n-1} for many series', () => {
  const xs = [
    [1, 2, 3, 4, 5, 6],
    [6, 5, 4, 3, 2, 1],
    [1, 3, 2, 5, 4, 8, 7],
    [10, 1, 5, 7, 3, 100, 50, 25],
    [100, 50, 75, 25, 60, 30, 80, 40, 90],
  ];
  for (const x of xs) {
    const r = dailyTokenDifferenceSignTest(x);
    assert.ok(
      r.dsS >= 0 && r.dsS <= x.length - 1,
      `S out of range: ${r.dsS} for ${x}`,
    );
    assert.equal(r.dsS + r.dsSneg + r.dsSzero, x.length - 1);
    assert.ok(Number.isFinite(r.dsZ));
    assert.ok(Number.isFinite(r.dsVar));
  }
});

test('dailyTokenDifferenceSignTest: S+, S-, S0 always sum to n-1', () => {
  // Property test over varied series including ties
  const series = [
    [1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1],
    [1, 1, 1, 1, 1, 1, 2],
    [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9],
    [0, 0, 1, 2, 0, 3, 0, 4, 5, 5],
  ];
  for (const x of series) {
    const r = dailyTokenDifferenceSignTest(x);
    assert.equal(r.dsS + r.dsSneg + r.dsSzero, x.length - 1);
  }
});

test('dailyTokenDifferenceSignTest: sinusoid has dsZ near 0 (test is blind to periodic alternatives)', () => {
  // Pure sinusoid: x[i] = sin(2*pi*i/T). Symmetric over a full period.
  const n = 64;
  const T = 8;
  const xs: number[] = [];
  for (let i = 0; i < n; i += 1) xs.push(Math.sin((2 * Math.PI * i) / T));
  const r = dailyTokenDifferenceSignTest(xs);
  // Number of strict positive diffs over a full period equals number of
  // strict negative diffs by symmetry, so |dsZ| should be small (<= ~1).
  assert.ok(
    Math.abs(r.dsZ) < 1.0,
    `expected sinusoid |dsZ| to be small, got ${r.dsZ}`,
  );
});

// ---------- builder ----------

test('buildDailyTokenDifferenceSignTest: rejects bad minTokens', () => {
  assert.throws(
    () => buildDailyTokenDifferenceSignTest([], { minTokens: -1 }),
    /minTokens/,
  );
  assert.throws(
    () => buildDailyTokenDifferenceSignTest([], { minTokens: NaN }),
    /minTokens/,
  );
});

test('buildDailyTokenDifferenceSignTest: rejects minTenureDays below 4', () => {
  assert.throws(
    () => buildDailyTokenDifferenceSignTest([], { minTenureDays: 3 }),
    /minTenureDays/,
  );
});

test('buildDailyTokenDifferenceSignTest: rejects bad top', () => {
  assert.throws(
    () => buildDailyTokenDifferenceSignTest([], { top: -1 }),
    /top/,
  );
});

test('buildDailyTokenDifferenceSignTest: rejects unknown sort', () => {
  assert.throws(
    () =>
      buildDailyTokenDifferenceSignTest([], {
        sort: 'bogus' as never,
      }),
    /sort/,
  );
});

test('buildDailyTokenDifferenceSignTest: rejects bad since/until', () => {
  assert.throws(
    () => buildDailyTokenDifferenceSignTest([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () => buildDailyTokenDifferenceSignTest([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('buildDailyTokenDifferenceSignTest: empty input -> empty report', () => {
  const r = buildDailyTokenDifferenceSignTest([], {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenDifferenceSignTest: drops invalid hour_start', () => {
  const queue: QueueLine[] = [ql('not-a-time', 'src', 100)];
  const r = buildDailyTokenDifferenceSignTest(queue);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenDifferenceSignTest: drops non-positive tokens', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'src', 0),
    ql(dayIso(1), 'src', -5),
    ql(dayIso(2), 'src', NaN),
  ];
  const r = buildDailyTokenDifferenceSignTest(queue);
  assert.equal(r.droppedNonPositiveTokens, 3);
});

test('buildDailyTokenDifferenceSignTest: source filter applied', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'a', 10),
    ql(dayIso(0), 'b', 20),
  ];
  const r = buildDailyTokenDifferenceSignTest(queue, { source: 'a' });
  assert.equal(r.droppedSourceFilter, 1);
});

test('buildDailyTokenDifferenceSignTest: drops sources below minTenureDays', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 5; d += 1) {
    queue.push(ql(dayIso(d), 'short', 500));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, {
    minTenureDays: 14,
    minTokens: 0,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenDifferenceSignTest: drops sources below minTokens', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'small', 1));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, { minTokens: 100 });
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenDifferenceSignTest: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'flat', 500));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, { minTokens: 0 });
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenDifferenceSignTest: monotone-up source -> dsS = n-1, dsZ > 0', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'up', 100 * (d + 1)));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, {
    minTokens: 0,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'up');
  assert.equal(row.dsN, 19);
  assert.equal(row.dsS, 19);
  assert.equal(row.dsSneg, 0);
  assert.ok(row.dsZ > 0);
});

test('buildDailyTokenDifferenceSignTest: gap-filled sparse days inflate zero-step count', () => {
  const queue: QueueLine[] = [
    ql(dayIso(0), 'sparse', 5000),
    ql(dayIso(19), 'sparse', 5000),
  ];
  const r = buildDailyTokenDifferenceSignTest(queue, { minTokens: 0 });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nTenureDays, 20);
  assert.equal(row.nActiveDays, 2);
  // Series: 5000, 0, 0, ..., 0, 5000 (20 entries).
  // Diffs: -5000, 0*17, +5000 -> S=1, S-=1, S0=17
  assert.equal(row.dsS, 1);
  assert.equal(row.dsSneg, 1);
  assert.equal(row.dsSzero, 17);
});

test('buildDailyTokenDifferenceSignTest: top truncates and droppedTopSources surfaces', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 0; d < 20; d += 1) {
      queue.push(ql(dayIso(d), src, 100 * (d + 1) + (src.charCodeAt(0) - 97)));
    }
  }
  const r = buildDailyTokenDifferenceSignTest(queue, {
    minTokens: 0,
    top: 2,
    sort: 'dZAbsDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenDifferenceSignTest: sort variants are accepted', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 's', 100 * (d + 1)));
  }
  for (const sort of [
    's',
    'sDesc',
    'dZ',
    'dZDesc',
    'dZAbs',
    'dZAbsDesc',
    'tokens',
    'tenure',
    'source',
  ] as const) {
    const r = buildDailyTokenDifferenceSignTest(queue, { minTokens: 0, sort });
    assert.equal(r.sort, sort);
    assert.equal(r.sources.length, 1);
  }
});

test('buildDailyTokenDifferenceSignTest: since/until window respected', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 30; d += 1) {
    queue.push(ql(dayIso(d), 'src', 100 * (d + 1)));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, {
    since: dayIso(5),
    until: dayIso(25),
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 20);
});

test('buildDailyTokenDifferenceSignTest: unknown source label normalised', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), '', 100 * (d + 1)));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, { minTokens: 0 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('buildDailyTokenDifferenceSignTest: report carries opts metadata', () => {
  const r = buildDailyTokenDifferenceSignTest([], {
    generatedAt: '2026-05-03T01:02:03.000Z',
    minTokens: 250,
    minTenureDays: 21,
    top: 5,
    sort: 'sDesc',
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-05-01T00:00:00.000Z',
    source: 'foo',
  });
  assert.equal(r.generatedAt, '2026-05-03T01:02:03.000Z');
  assert.equal(r.minTokens, 250);
  assert.equal(r.minTenureDays, 21);
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'sDesc');
  assert.equal(r.windowStart, '2026-04-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-05-01T00:00:00.000Z');
  assert.equal(r.source, 'foo');
});

test('buildDailyTokenDifferenceSignTest: secondary tie-break is source ascending', () => {
  const queue: QueueLine[] = [];
  for (const src of ['zeta', 'alpha', 'mu']) {
    for (let d = 0; d < 16; d += 1) {
      queue.push(ql(dayIso(d), src, 100 * (d + 1)));
    }
  }
  const r = buildDailyTokenDifferenceSignTest(queue, {
    minTokens: 0,
    sort: 'dZAbsDesc',
  });
  // All three identical -> ties broken by source asc.
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mu', 'zeta'],
  );
});

test('buildDailyTokenDifferenceSignTest: sort dZ ascending puts most-negative dZ first', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'down', 100 * (20 - d)));
    queue.push(ql(dayIso(d), 'up', 100 * (d + 1)));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, {
    minTokens: 0,
    sort: 'dZ',
  });
  assert.ok(r.sources.length >= 2);
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.dsZ <= r.sources[i]!.dsZ);
  }
});

test('buildDailyTokenDifferenceSignTest: sort sDesc puts highest S first', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'down', 100 * (20 - d)));
    queue.push(ql(dayIso(d), 'up', 100 * (d + 1)));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, {
    minTokens: 0,
    sort: 'sDesc',
  });
  assert.ok(r.sources.length >= 2);
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.dsS >= r.sources[i]!.dsS);
  }
});

test('buildDailyTokenDifferenceSignTest: sort tokens descending', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'a', 100 * (d + 1)));
    queue.push(ql(dayIso(d), 'b', 1000 * (d + 1)));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, {
    minTokens: 0,
    sort: 'tokens',
  });
  assert.equal(r.sources[0]!.source, 'b');
});

test('buildDailyTokenDifferenceSignTest: totalTokens reflects accepted rows only', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'big', 1000 + d * 50));
    queue.push(ql(dayIso(d), 'tiny', 1));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, { minTokens: 100 });
  // Only "big" qualifies; total reflects only big.
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  let bigTotal = 0;
  for (let d = 0; d < 20; d += 1) bigTotal += 1000 + d * 50;
  assert.equal(r.totalTokens, bigTotal);
});

test('buildDailyTokenDifferenceSignTest: multi-source report aggregates correctly', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 14; d += 1) {
    queue.push(ql(dayIso(d), 'src1', 200 + d * 10));
    queue.push(ql(dayIso(d), 'src2', 500 - d * 10));
    queue.push(ql(dayIso(d), 'src3', 100 + (d % 3) * 50));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, { minTokens: 0 });
  assert.equal(r.sources.length, 3);
  for (const s of r.sources) {
    assert.equal(s.nTenureDays, 14);
    assert.equal(s.dsN, 13);
    assert.equal(s.dsS + s.dsSneg + s.dsSzero, 13);
  }
});

test('buildDailyTokenDifferenceSignTest: dsVar always equals (n-1)/4 in built rows', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'a', 100 * (d + 1)));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, { minTokens: 0 });
  for (const s of r.sources) {
    assert.equal(s.dsVar, (s.nTenureDays - 1) / 4);
  }
});

test('buildDailyTokenDifferenceSignTest: dsZ negative when down-trending source dominates', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'down', 100 * (20 - d)));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, { minTokens: 0 });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.dsZ < 0);
});

test('buildDailyTokenDifferenceSignTest: dsZ positive when up-trending source dominates', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'up', 100 * (d + 1)));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, { minTokens: 0 });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.dsZ > 0);
});

test('buildDailyTokenDifferenceSignTest: dsZAbs sort puts strongest absolute trend first', () => {
  const queue: QueueLine[] = [];
  // Strong-up source vs neutral source
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 'strong-up', 100 * (d + 1)));
    queue.push(ql(dayIso(d), 'noisy', 500 + ((d * 37) % 50)));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, {
    minTokens: 0,
    sort: 'dZAbsDesc',
  });
  assert.ok(r.sources.length >= 2);
  // strong-up should be first.
  assert.equal(r.sources[0]!.source, 'strong-up');
});

test('buildDailyTokenDifferenceSignTest: sort tenure descending', () => {
  const queue: QueueLine[] = [];
  // src-long: 30 days; src-short: 14 days (both kept above min-tenure-days=14)
  for (let d = 0; d < 30; d += 1) {
    queue.push(ql(dayIso(d), 'long', 100 * (d + 1)));
  }
  for (let d = 0; d < 14; d += 1) {
    queue.push(ql(dayIso(d), 'short', 100 * (d + 1)));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, {
    minTokens: 0,
    sort: 'tenure',
  });
  assert.equal(r.sources[0]!.source, 'long');
});

test('buildDailyTokenDifferenceSignTest: dsN field equals nTenureDays - 1', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 17; d += 1) {
    queue.push(ql(dayIso(d), 'src', 100 * (d + 1)));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, { minTokens: 0 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.dsN, r.sources[0]!.nTenureDays - 1);
});

test('buildDailyTokenDifferenceSignTest: aggregates same-day events into per-day totals', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 20; d += 1) {
    queue.push(ql(dayIso(d), 's', 100));
    queue.push(ql(dayIso(d), 's', 200));
  }
  const r = buildDailyTokenDifferenceSignTest(queue, { minTokens: 0 });
  // Each day contributes 300 tokens; constant -> dropped as zero-variance.
  assert.equal(r.droppedZeroVariance, 1);
});

// ---------- additional property anchors (refinement) ----------

test('dailyTokenDifferenceSignTest: dsZ exactly satisfies dZ(reverse(x)) = -dZ(x)', () => {
  // Time-reversal anti-symmetry of the standardised score is the
  // canonical defining property of a directional trend test
  // (Brockwell & Davis 1991 sec. 1.6). Verified pointwise.
  const xs = [
    [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9],
    [10, 3, 7, 4, 8, 1, 9, 6, 2, 5],
    [100, 50, 75, 25, 60, 30, 80, 40, 90, 110, 120, 70],
    [1, 2, 3, 4, 5, 6, 7, 8],
  ];
  for (const x of xs) {
    const f = dailyTokenDifferenceSignTest(x);
    const b = dailyTokenDifferenceSignTest([...x].reverse());
    assert.ok(
      Math.abs(f.dsZ + b.dsZ) < 1e-12,
      `dZ anti-symmetry violated for ${x}: dZ_forward=${f.dsZ}, dZ_reverse=${b.dsZ}`,
    );
  }
});

test('dailyTokenDifferenceSignTest: monotone-up has the maximum possible dsZ for a given n', () => {
  // For a strictly monotone-increasing series, S = n-1, which is
  // the supremum over all permutations -> dsZ = +sqrt(n-1) is
  // the maximum possible (and -sqrt(n-1) the minimum). We verify
  // that no permutation achieves a larger |dsZ|.
  const monotone = dailyTokenDifferenceSignTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const maxAbsZ = Math.abs(monotone.dsZ);
  const rng = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };
  const rand = rng(7);
  for (let trial = 0; trial < 20; trial += 1) {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    const r = dailyTokenDifferenceSignTest(arr);
    assert.ok(
      Math.abs(r.dsZ) <= maxAbsZ + 1e-12,
      `permutation ${arr} produced |dsZ|=${Math.abs(r.dsZ)} > monotone bound ${maxAbsZ}`,
    );
  }
});

test('dailyTokenDifferenceSignTest: dsZ is independent of any strictly-monotone univariate transform of values', () => {
  // The sign of x[i+1] - x[i] is preserved by any strictly-
  // increasing transform (Mood is rank-class for the sign
  // operator), so dsZ is invariant under such transforms.
  const x = [1, 5, 2, 8, 4, 7, 9, 6, 11, 3];
  const r1 = dailyTokenDifferenceSignTest(x);
  // x -> log(x + 1)
  const r2 = dailyTokenDifferenceSignTest(x.map((v) => Math.log(v + 1)));
  // x -> x^3 (strictly increasing for positive x)
  const r3 = dailyTokenDifferenceSignTest(x.map((v) => v ** 3));
  // x -> 2x + 100 (affine increasing)
  const r4 = dailyTokenDifferenceSignTest(x.map((v) => 2 * v + 100));
  assert.equal(r1.dsS, r2.dsS);
  assert.equal(r1.dsS, r3.dsS);
  assert.equal(r1.dsS, r4.dsS);
  assert.ok(Math.abs(r1.dsZ - r2.dsZ) < 1e-12);
  assert.ok(Math.abs(r1.dsZ - r3.dsZ) < 1e-12);
  assert.ok(Math.abs(r1.dsZ - r4.dsZ) < 1e-12);
});
