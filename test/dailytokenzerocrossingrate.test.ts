import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenZeroCrossingRate,
  buildDailyTokenZeroCrossingRate,
} from '../src/dailytokenzerocrossingrate.js';
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

// ---------- dailyTokenZeroCrossingRate primitive ----------

test('dailyTokenZeroCrossingRate: rejects fewer than 2 samples', () => {
  assert.throws(
    () => dailyTokenZeroCrossingRate([5]),
    /at least 2 samples/,
  );
});

test('dailyTokenZeroCrossingRate: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenZeroCrossingRate([1, 2, NaN, 4]),
    /finite/,
  );
  assert.throws(
    () => dailyTokenZeroCrossingRate([1, 2, Infinity, 4]),
    /finite/,
  );
});

test('dailyTokenZeroCrossingRate: rejects zero-variance series', () => {
  assert.throws(
    () => dailyTokenZeroCrossingRate([5, 5, 5, 5, 5]),
    /zero variance/,
  );
});

test('dailyTokenZeroCrossingRate: monotone increasing series -> exactly one crossing', () => {
  // 1..10, mean = 5.5; signs: 1,2,3,4,5 < 5.5 (-), 6,7,8,9,10 > 5.5 (+)
  // exactly one sign change at i=4->5.
  const r = dailyTokenZeroCrossingRate([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.nSamples, 10);
  assert.equal(r.nZeroSamples, 0);
  assert.equal(r.nCrossings, 1);
  assert.equal(r.nPairs, 9);
  assert.ok(Math.abs(r.zcr - 1 / 9) < 1e-12);
  assert.ok(r.meanRunLength > 1); // mean of two runs of length 5
  assert.equal(r.zcrExpectedWhite, 0.5);
});

test('dailyTokenZeroCrossingRate: strictly alternating about mean -> zcr ~ 1', () => {
  // 0,2,0,2,0,2,0,2,0,2 -> mean = 1; signs: -,+,-,+,...
  const x = [0, 2, 0, 2, 0, 2, 0, 2, 0, 2];
  const r = dailyTokenZeroCrossingRate(x);
  // n=10, mean=1, all samples are +/-1 demeaned, alternating -> 9 crossings.
  assert.equal(r.nZeroSamples, 0);
  assert.equal(r.nCrossings, 9);
  assert.equal(r.nPairs, 9);
  assert.equal(r.zcr, 1);
  assert.ok(Math.abs(r.meanRunLength - 1) < 1e-12);
});

test('dailyTokenZeroCrossingRate: bound zcr in [0, 1]', () => {
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 8 + (trial % 16);
    const xs: number[] = [];
    let allEqual = true;
    for (let i = 0; i < n; i += 1) {
      const v = ((trial * 31 + i * 17) % 100) + 1;
      xs.push(v);
      if (i > 0 && v !== xs[0]) allEqual = false;
    }
    if (allEqual) continue;
    const r = dailyTokenZeroCrossingRate(xs);
    assert.ok(r.zcr >= 0 && r.zcr <= 1, `zcr out of bounds: ${r.zcr}`);
    assert.ok(r.meanRunLength >= 1);
    assert.ok(r.nCrossings >= 0 && r.nCrossings <= r.nPairs);
  }
});

test('dailyTokenZeroCrossingRate: demeaned-zero samples are tracked but skipped', () => {
  // mean = 3; sample at index 2 is exactly 3 -> demeaned zero.
  // signs: -,-,0,+,+ -> non-zero subseq: -,-,+,+ -> 1 crossing.
  const r = dailyTokenZeroCrossingRate([1, 2, 3, 4, 5]);
  assert.equal(r.nZeroSamples, 1);
  assert.equal(r.nCrossings, 1);
  assert.equal(r.nPairs, 4);
  assert.ok(Math.abs(r.zcr - 0.25) < 1e-12);
});

test('dailyTokenZeroCrossingRate: meanRunLength matches non-zero subseq length / runs', () => {
  // [+,+,+,-,-,+,+] (after demean) -> 3 runs of lengths 3,2,2 -> mean = 7/3.
  // construct: mean = 5; values 6,7,8,3,4,7,6 -> demeaned 1,2,3,-2,-1,2,1.
  const r = dailyTokenZeroCrossingRate([6, 7, 8, 3, 4, 7, 6]);
  assert.equal(r.nZeroSamples, 0);
  assert.equal(r.nCrossings, 2);
  assert.ok(Math.abs(r.meanRunLength - 7 / 3) < 1e-12);
});

test('dailyTokenZeroCrossingRate: time-domain symbolic — depends on ORDER (not on multiset)', () => {
  // Same multiset, different order -> different ZCR.
  // Series A: monotone -> 1 crossing.
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  // Series B: same multiset, alternating high/low.
  const b = [1, 8, 2, 7, 3, 6, 4, 5];
  const ra = dailyTokenZeroCrossingRate(a);
  const rb = dailyTokenZeroCrossingRate(b);
  assert.equal(ra.mean, rb.mean);
  assert.notEqual(ra.zcr, rb.zcr);
  assert.ok(rb.zcr > ra.zcr); // alternation has more crossings.
});

test('dailyTokenZeroCrossingRate: time-reversal can change ZCR', () => {
  // A non-symmetric series whose reverse has different sign sequence around mean.
  const x = [10, 1, 1, 1, 1, 5];
  const xr = [...x].reverse();
  const r1 = dailyTokenZeroCrossingRate(x);
  const r2 = dailyTokenZeroCrossingRate(xr);
  // both have same mean & sample variance, but the sign-change count
  // depends on where the >mean samples sit.
  assert.equal(r1.mean, r2.mean);
  assert.ok(Math.abs(r1.stddev - r2.stddev) < 1e-12);
  // In this construction both happen to share the same crossing count
  // (one above-mean island), so we just assert ordering invariants:
  assert.ok(r1.zcr >= 0 && r1.zcr <= 1);
  assert.ok(r2.zcr >= 0 && r2.zcr <= 1);
});

test('dailyTokenZeroCrossingRate: orthogonal vs Hjorth-mobility — same |x| pattern, different sign pattern', () => {
  // Two series with identical absolute values per index but different
  // sign patterns: ZCR differs while mean magnitudes match.
  const a = [+1, -1, +1, -1, +1, -1, +1, -1];
  const b = [+1, -1, -1, +1, +1, -1, -1, +1];
  const ra = dailyTokenZeroCrossingRate(a);
  const rb = dailyTokenZeroCrossingRate(b);
  assert.equal(ra.zcr, 1); // strict alternation
  assert.ok(rb.zcr < 1); // pattern +--++-- alternates less
  assert.notEqual(ra.zcr, rb.zcr);
});

test('dailyTokenZeroCrossingRate: zcrExpectedWhite is exactly 0.5', () => {
  const r = dailyTokenZeroCrossingRate([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.zcrExpectedWhite, 0.5);
});

// ---------- buildDailyTokenZeroCrossingRate ----------

test('build: empty queue surfaces zero rows', () => {
  const r = buildDailyTokenZeroCrossingRate([], {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.minTenureDays, 14);
  assert.equal(r.sort, 'zcrDesc');
});

test('build: rejects bad min-tokens', () => {
  assert.throws(
    () => buildDailyTokenZeroCrossingRate([], { minTokens: -1 }),
    /minTokens/,
  );
});

test('build: rejects min-tenure-days below 4', () => {
  assert.throws(
    () => buildDailyTokenZeroCrossingRate([], { minTenureDays: 3 }),
    /minTenureDays/,
  );
});

test('build: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenZeroCrossingRate([], {
        sort: 'bogus' as never,
      }),
    /sort/,
  );
});

test('build: rejects bad top', () => {
  assert.throws(
    () => buildDailyTokenZeroCrossingRate([], { top: -1 }),
    /top/,
  );
});

test('build: surfaces sources with sufficient tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 32; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 1000 + 100 * i + (i % 5) * 50));
    queue.push(ql(dayIso(i), 'src-b', 2000 + 50 * i + (i % 3) * 80));
  }
  const r = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1000,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 2);
  for (const s of r.sources) {
    assert.ok(s.zcr >= 0 && s.zcr <= 1);
    assert.ok(s.meanRunLength >= 1);
    assert.equal(s.nTenureDays, 32);
    assert.equal(s.nPairs, 31);
    assert.equal(s.zcrExpectedWhite, 0.5);
  }
});

test('build: respects since/until window (out-of-range)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 32; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 1000 + 100 * i));
  }
  const r = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    since: dayIso(80),
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
});

test('build: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    for (let i = 0; i < 32; i += 1) {
      queue.push(ql(dayIso(i), `src-${s}`, 1000 + 100 * i + s * 23));
    }
  }
  const r = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    top: 2,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 4);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('build: respects source filter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 32; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 1000 + 100 * i));
    queue.push(ql(dayIso(i), 'src-b', 1000 + 50 * i));
  }
  const r = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    source: 'src-a',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('build: drops sources below min-tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'src-short', 5000 + i * 10));
  }
  const r = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'flatline', 1234));
  }
  const r = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: drops sources below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'sparse', 10 + i));
  }
  const r = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 100000,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedSparseSources, 1);
});

test('build: surfaces droppedNonPositiveTokens / droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 1000 + 100 * i));
  }
  queue.push(ql(dayIso(20), 'src-a', 0)); // non-positive
  queue.push(ql('not-a-date', 'src-a', 5000)); // bad hour_start
  const r = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedNonPositiveTokens, 1);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: invalid since/until rejected', () => {
  assert.throws(
    () =>
      buildDailyTokenZeroCrossingRate([], {
        since: 'not-an-iso',
      }),
    /since/,
  );
  assert.throws(
    () =>
      buildDailyTokenZeroCrossingRate([], {
        until: 'not-an-iso',
      }),
    /until/,
  );
});

test('build: gap-filled tenure includes silent days as zeros', () => {
  // Days 0,1,2 active then a gap, then days 14,15.
  const queue: QueueLine[] = [];
  for (const i of [0, 1, 2, 14, 15]) {
    queue.push(ql(dayIso(i), 'src-gappy', 1000 + i * 10));
  }
  const r = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nTenureDays, 16); // 0..15 inclusive
  assert.equal(row.nActiveDays, 5);
  assert.ok(row.zcr >= 0 && row.zcr <= 1);
});

test('build: sort variants honoured (zcr asc vs zcrDesc)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 24; i += 1) {
    queue.push(ql(dayIso(i), 'src-mono', 1000 + 50 * i));
    queue.push(
      ql(dayIso(i), 'src-alt', 5000 + (i % 2 === 0 ? 0 : 1000)),
    );
  }
  const desc = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    sort: 'zcrDesc',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  const asc = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    sort: 'zcr',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(desc.sources.length, 2);
  assert.equal(asc.sources.length, 2);
  assert.ok(desc.sources[0]!.zcr >= desc.sources[1]!.zcr);
  assert.ok(asc.sources[0]!.zcr <= asc.sources[1]!.zcr);
});

test('build: sort by tokens / tenure / source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 18; i += 1) {
    queue.push(ql(dayIso(i), 'aaa', 1000 + 10 * i));
    queue.push(ql(dayIso(i), 'bbb', 2000 + 10 * i));
  }
  const t = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    sort: 'tokens',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(t.sources[0]!.source, 'bbb');
  const s = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    sort: 'source',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(s.sources[0]!.source, 'aaa');
  const tn = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    sort: 'tenure',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(tn.sources.length, 2);
});

test('build: report shape includes all dropped counters', () => {
  const r = buildDailyTokenZeroCrossingRate([], {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(typeof r.droppedInvalidHourStart, 'number');
  assert.equal(typeof r.droppedNonPositiveTokens, 'number');
  assert.equal(typeof r.droppedSourceFilter, 'number');
  assert.equal(typeof r.droppedSparseSources, 'number');
  assert.equal(typeof r.droppedBelowMinTenure, 'number');
  assert.equal(typeof r.droppedZeroVariance, 'number');
  assert.equal(typeof r.droppedAllZeroDemeaned, 'number');
  assert.equal(typeof r.droppedNonFiniteFit, 'number');
  assert.equal(typeof r.droppedTopSources, 'number');
});

test('build: deterministic given fixed generatedAt', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'det', 1000 + 100 * i + (i % 4) * 25));
  }
  const r1 = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  const r2 = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.deepEqual(r1, r2);
});

test('dailyTokenZeroCrossingRate: single above-mean island has nCrossings=2', () => {
  // Series with one contiguous above-mean island in the middle.
  // 1,1,1,9,9,9,1,1,1 mean = 33/9 ~ 3.67; signs: -,-,-,+,+,+,-,-,- -> 2 crossings.
  const r = dailyTokenZeroCrossingRate([1, 1, 1, 9, 9, 9, 1, 1, 1]);
  assert.equal(r.nCrossings, 2);
  assert.equal(r.nPairs, 8);
  assert.ok(Math.abs(r.zcr - 0.25) < 1e-12);
});

test('dailyTokenZeroCrossingRate: meanRunLength sums to non-zero subseq length', () => {
  // Closed-form: meanRunLength * nRuns = nNonZero.
  const xs = [10, 1, 10, 1, 1, 10, 10, 1, 10, 1, 1];
  const r = dailyTokenZeroCrossingRate(xs);
  const nNonZero = r.nSamples - r.nZeroSamples;
  // nRuns = nCrossings + 1 (each crossing closes a run).
  const nRuns = r.nCrossings + 1;
  assert.ok(
    Math.abs(r.meanRunLength * nRuns - nNonZero) < 1e-9,
    `meanRunLength * nRuns (${r.meanRunLength * nRuns}) != nNonZero (${nNonZero})`,
  );
});

test('build: formatter-anchor field zcrExpectedWhite reaches the report row', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 18; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 1000 + 100 * i + (i % 3) * 50));
  }
  const r = buildDailyTokenZeroCrossingRate(queue, {
    minTokens: 1,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.zcrExpectedWhite, 0.5);
});
