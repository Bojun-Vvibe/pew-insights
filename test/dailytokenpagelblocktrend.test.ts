import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pageLMidranks,
  pageLBlockHasTie,
  standardNormalUpperTailPageL,
  dailyTokenPageLBlockTrend,
  aggregatePageLBlockTrend,
  buildDailyTokenPageLBlockTrend,
} from '../src/dailytokenpagelblocktrend.ts';
import type { QueueLine } from '../src/types.ts';

// ---------- pageLMidranks ----------

test('pageLMidranks: distinct ascending', () => {
  assert.deepEqual(pageLMidranks([1, 2, 3]), [1, 2, 3]);
});

test('pageLMidranks: distinct descending', () => {
  assert.deepEqual(pageLMidranks([3, 2, 1]), [3, 2, 1]);
});

test('pageLMidranks: distinct unsorted', () => {
  assert.deepEqual(pageLMidranks([5, 2, 8]), [2, 1, 3]);
});

test('pageLMidranks: all-tied -> all rank 2', () => {
  assert.deepEqual(pageLMidranks([7, 7, 7]), [2, 2, 2]);
});

test('pageLMidranks: two-tied lowest', () => {
  assert.deepEqual(pageLMidranks([1, 1, 5]), [1.5, 1.5, 3]);
});

test('pageLMidranks: two-tied highest', () => {
  assert.deepEqual(pageLMidranks([5, 9, 9]), [1, 2.5, 2.5]);
});

test('pageLMidranks: empty', () => {
  assert.deepEqual(pageLMidranks([]), []);
});

test('pageLMidranks: midrank of {2,2,7}', () => {
  assert.deepEqual(pageLMidranks([2, 7, 2]), [1.5, 3, 1.5]);
});

// ---------- pageLBlockHasTie ----------

test('pageLBlockHasTie: distinct -> false', () => {
  assert.equal(pageLBlockHasTie([1, 2, 3]), false);
});

test('pageLBlockHasTie: first==second -> true', () => {
  assert.equal(pageLBlockHasTie([4, 4, 9]), true);
});

test('pageLBlockHasTie: second==third -> true', () => {
  assert.equal(pageLBlockHasTie([1, 9, 9]), true);
});

test('pageLBlockHasTie: first==third -> true', () => {
  assert.equal(pageLBlockHasTie([5, 8, 5]), true);
});

test('pageLBlockHasTie: all-equal -> true', () => {
  assert.equal(pageLBlockHasTie([3, 3, 3]), true);
});

test('pageLBlockHasTie: rejects wrong arity', () => {
  assert.throws(() => pageLBlockHasTie([1, 2]));
  assert.throws(() => pageLBlockHasTie([1, 2, 3, 4]));
});

// ---------- standardNormalUpperTailPageL ----------

test('standardNormalUpperTailPageL: at z=0 returns 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailPageL(0) - 0.5) < 1e-6);
});

test('standardNormalUpperTailPageL: at z=1.96 ~ 0.025', () => {
  assert.ok(Math.abs(standardNormalUpperTailPageL(1.96) - 0.025) < 1e-3);
});

test('standardNormalUpperTailPageL: symmetric', () => {
  const a = standardNormalUpperTailPageL(1.5);
  const b = standardNormalUpperTailPageL(-1.5);
  assert.ok(Math.abs(a + b - 1) < 1e-6);
});

test('standardNormalUpperTailPageL: rejects non-finite', () => {
  assert.throws(() => standardNormalUpperTailPageL(Number.NaN));
  assert.throws(() => standardNormalUpperTailPageL(Number.POSITIVE_INFINITY));
});

test('standardNormalUpperTailPageL: clamped to [0,1]', () => {
  const q = standardNormalUpperTailPageL(50);
  assert.ok(q >= 0 && q <= 1);
});

// ---------- dailyTokenPageLBlockTrend ----------

test('dailyTokenPageLBlockTrend: rejects n < 12', () => {
  assert.throws(() =>
    dailyTokenPageLBlockTrend([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  );
});

test('dailyTokenPageLBlockTrend: rejects non-finite', () => {
  const v = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, Number.NaN,
  ];
  assert.throws(() => dailyTokenPageLBlockTrend(v));
});

test('dailyTokenPageLBlockTrend: rejects zero variance', () => {
  const v = new Array(15).fill(7);
  assert.throws(() => dailyTokenPageLBlockTrend(v));
});

test('dailyTokenPageLBlockTrend: clean monotone-up has pageL at maximum', () => {
  // 12 days strictly increasing => 4 blocks of (1,2,3) ranks => L = 4*(1+4+9)=56
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r = dailyTokenPageLBlockTrend(v);
  assert.equal(r.nBlocks, 4);
  assert.equal(r.nTrailingDropped, 0);
  assert.equal(r.pageL, 56);
  // E[L] = 12*4 = 48; Var[L] = 2*4 = 8; Z = (56-48)/sqrt(8)
  assert.ok(Math.abs(r.pageEL - 48) < 1e-9);
  assert.ok(Math.abs(r.pageVarL - 8) < 1e-9);
  assert.ok(Math.abs(r.pageZ - 8 / Math.sqrt(8)) < 1e-6);
  assert.ok(r.pagePValue < 0.005);
  assert.equal(r.nTiedBlocks, 0);
});

test('dailyTokenPageLBlockTrend: clean monotone-down has pageL at minimum', () => {
  // 12 days strictly decreasing => each block ranks (3,2,1) => 1*3+2*2+3*1 = 10; L = 4*10 = 40
  const v = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const r = dailyTokenPageLBlockTrend(v);
  assert.equal(r.pageL, 40);
  assert.equal(r.pageEL, 48);
  assert.ok(Math.abs(r.pageZ - (40 - 48) / Math.sqrt(8)) < 1e-6);
  assert.ok(r.pageZ < 0);
  assert.ok(r.pagePValue < 0.005);
});

test('dailyTokenPageLBlockTrend: trailing days dropped (n=13 -> drop 1)', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 99];
  const r = dailyTokenPageLBlockTrend(v);
  assert.equal(r.nBlocks, 4);
  assert.equal(r.nTrailingDropped, 1);
  // 99 is dropped so pageL same as the n=12 case
  assert.equal(r.pageL, 56);
});

test('dailyTokenPageLBlockTrend: trailing days dropped (n=14 -> drop 2)', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 99, 99];
  const r = dailyTokenPageLBlockTrend(v);
  assert.equal(r.nBlocks, 4);
  assert.equal(r.nTrailingDropped, 2);
  assert.equal(r.pageL, 56);
});

test('dailyTokenPageLBlockTrend: zigzag within blocks gives pageZ ~ 0', () => {
  // each block is (mid, low, high) -> ranks (2, 1, 3) -> 1*2+2*1+3*3 = 13
  // 4 blocks => L = 52; (52-48)/sqrt(2) = 4/sqrt(2) ~ 2.83 -- not zero,
  // because the within-block pattern is consistent. We adjust to a truly zero pattern:
  // alternate blocks (1,2,3) and (3,2,1):
  //   block A scores 14, block B scores 10
  //   2 of each -> L = 24+20 = 48 = E[L]
  const v = [1, 2, 3, 30, 20, 10, 4, 5, 6, 31, 21, 11];
  const r = dailyTokenPageLBlockTrend(v);
  assert.equal(r.pageL, 48);
  assert.ok(Math.abs(r.pageZ) < 1e-9);
  assert.ok(Math.abs(r.pagePValue - 1) < 1e-6);
});

test('dailyTokenPageLBlockTrend: counts tied blocks', () => {
  // first block (5,5,9) tied; rest distinct
  const v = [5, 5, 9, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const r = dailyTokenPageLBlockTrend(v);
  assert.equal(r.nTiedBlocks, 1);
});

test('dailyTokenPageLBlockTrend: midrank applied to ties', () => {
  // single block (5,5,9): ranks 1.5, 1.5, 3 -> 1*1.5 + 2*1.5 + 3*3 = 13.5
  // The remaining blocks all (1,2,3): each gives 14; total 1*13.5 + 3*14 = 55.5
  const v = [5, 5, 9, 1, 2, 3, 1, 2, 3, 1, 2, 3];
  const r = dailyTokenPageLBlockTrend(v);
  assert.ok(Math.abs(r.pageL - 55.5) < 1e-9);
});

test('dailyTokenPageLBlockTrend: sample mean and stddev computed', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r = dailyTokenPageLBlockTrend(v);
  assert.ok(Math.abs(r.mean - 6.5) < 1e-9);
  assert.ok(r.stddev > 3 && r.stddev < 4);
  assert.equal(r.nSamples, 12);
});

test('dailyTokenPageLBlockTrend: pageZ matches E/Var formula', () => {
  // n=15 -> b=5 blocks; E[L] = 60; Var[L] = 2*5 = 10
  const v = [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3];
  const r = dailyTokenPageLBlockTrend(v);
  assert.equal(r.nBlocks, 5);
  assert.equal(r.pageEL, 60);
  assert.equal(r.pageVarL, 10);
  // each block scores 14; L = 70; Z = (70-60)/sqrt(10)
  assert.equal(r.pageL, 70);
  assert.ok(Math.abs(r.pageZ - (70 - 60) / Math.sqrt(10)) < 1e-9);
});

test('dailyTokenPageLBlockTrend: p-value within [0,1]', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r = dailyTokenPageLBlockTrend(v);
  assert.ok(r.pagePValue >= 0 && r.pagePValue <= 1);
});

// ---------- aggregatePageLBlockTrend ----------

test('aggregatePageLBlockTrend: empty rows returns zero/used=0', () => {
  const a = aggregatePageLBlockTrend([]);
  assert.equal(a.rowsUsed, 0);
  assert.equal(a.stoufferZ, 0);
  assert.equal(a.stoufferTwoSidedPValue, 1);
});

test('aggregatePageLBlockTrend: skips invalid rows', () => {
  const a = aggregatePageLBlockTrend([
    { pageZ: Number.NaN, pagePValue: 0.5, nTenureDays: 12 },
    { pageZ: 1.5, pagePValue: 0.13, nTenureDays: 11 }, // tenure too low
    { pageZ: 1.5, pagePValue: 0.13, nTenureDays: 20 },
  ]);
  assert.equal(a.rowsUsed, 1);
  assert.equal(a.rowsSkipped, 2);
  assert.ok(Math.abs(a.stoufferZ - 1.5) < 1e-9);
});

test('aggregatePageLBlockTrend: stouffer Z = sum(z)/sqrt(used)', () => {
  const a = aggregatePageLBlockTrend([
    { pageZ: 1.0, pagePValue: 0.32, nTenureDays: 12 },
    { pageZ: 2.0, pagePValue: 0.045, nTenureDays: 12 },
    { pageZ: -1.0, pagePValue: 0.32, nTenureDays: 12 },
    { pageZ: 2.0, pagePValue: 0.045, nTenureDays: 12 },
  ]);
  assert.ok(Math.abs(a.stoufferZ - 4 / 2) < 1e-9);
  assert.equal(a.rowsUsed, 4);
  assert.ok(Math.abs(a.meanPageZ - 1.0) < 1e-9);
});

test('aggregatePageLBlockTrend: tenure-weighted mean', () => {
  const a = aggregatePageLBlockTrend([
    { pageZ: 2.0, pagePValue: 0.045, nTenureDays: 30 },
    { pageZ: -1.0, pagePValue: 0.32, nTenureDays: 60 },
  ]);
  // weighted: (30*2 + 60*-1)/90 = 0
  assert.ok(Math.abs(a.tenureWeightedMeanPageZ - 0) < 1e-9);
});

// ---------- buildDailyTokenPageLBlockTrend ----------

function makeQueueLineFor(
  source: string,
  isoHour: string,
  totalTokens: number,
): QueueLine {
  return {
    hour_start: isoHour,
    source,
    project: 'p',
    model: 'm',
    provider: 'pr',
    bucket: 'b',
    total_tokens: totalTokens,
    input_tokens: totalTokens / 2,
    output_tokens: totalTokens / 2,
    cached_tokens: 0,
    cache_creation_tokens: 0,
    n_messages: 1,
  } as unknown as QueueLine;
}

function buildSeriesQueue(
  source: string,
  startDay: string,
  values: number[],
): QueueLine[] {
  const out: QueueLine[] = [];
  let cursor = startDay;
  for (const v of values) {
    out.push(makeQueueLineFor(source, `${cursor}T12:00:00.000Z`, v));
    const ms = Date.parse(`${cursor}T00:00:00.000Z`) + 86_400_000;
    cursor = new Date(ms).toISOString().slice(0, 10);
  }
  return out;
}

test('buildDailyTokenPageLBlockTrend: single source up-trend', () => {
  const queue = buildSeriesQueue(
    'a',
    '2026-01-01',
    [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000],
  );
  const r = buildDailyTokenPageLBlockTrend(queue);
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'a');
  assert.equal(s.nBlocks, 4);
  assert.equal(s.pageL, 56);
  assert.ok(s.pageZ > 0);
});

test('buildDailyTokenPageLBlockTrend: drops below min-tokens', () => {
  const queue = buildSeriesQueue(
    'a',
    '2026-01-01',
    new Array(14).fill(50),
  );
  const r = buildDailyTokenPageLBlockTrend(queue, { minTokens: 1000 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenPageLBlockTrend: drops below min-tenure-days', () => {
  // only 5 days, totalTokens enough but tenure too low (would be rejected anyway)
  const queue = buildSeriesQueue(
    'a',
    '2026-01-01',
    [200, 200, 200, 200, 200],
  );
  const r = buildDailyTokenPageLBlockTrend(queue, { minTokens: 100 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenPageLBlockTrend: drops zero-variance series', () => {
  const queue = buildSeriesQueue(
    'a',
    '2026-01-01',
    new Array(15).fill(500),
  );
  const r = buildDailyTokenPageLBlockTrend(queue, { minTokens: 100 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenPageLBlockTrend: drops invalid hour_start', () => {
  const good = buildSeriesQueue(
    'a',
    '2026-01-01',
    [500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600],
  );
  const bad: QueueLine = {
    hour_start: 'not-a-date',
    source: 'a',
    total_tokens: 100,
  } as unknown as QueueLine;
  const r = buildDailyTokenPageLBlockTrend([bad, ...good], { minTokens: 100 });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('buildDailyTokenPageLBlockTrend: drops non-positive tokens', () => {
  const good = buildSeriesQueue(
    'a',
    '2026-01-01',
    [500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600],
  );
  const bad = makeQueueLineFor('a', '2026-01-13T01:00:00.000Z', 0);
  const r = buildDailyTokenPageLBlockTrend([...good, bad], { minTokens: 100 });
  assert.equal(r.droppedNonPositiveTokens, 1);
});

test('buildDailyTokenPageLBlockTrend: source filter', () => {
  const a = buildSeriesQueue(
    'a',
    '2026-01-01',
    [500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600],
  );
  const b = buildSeriesQueue(
    'b',
    '2026-01-01',
    [500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600],
  );
  const r = buildDailyTokenPageLBlockTrend([...a, ...b], {
    minTokens: 100,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 12);
});

test('buildDailyTokenPageLBlockTrend: top cap surfaces droppedTopSources', () => {
  const queues: QueueLine[] = [];
  for (const src of ['a', 'b', 'c', 'd', 'e']) {
    queues.push(
      ...buildSeriesQueue('s' + src, '2026-01-01', [
        500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600,
      ]),
    );
  }
  const r = buildDailyTokenPageLBlockTrend(queues, {
    minTokens: 100,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('buildDailyTokenPageLBlockTrend: sort source asc', () => {
  const a = buildSeriesQueue(
    'zz',
    '2026-01-01',
    [500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600],
  );
  const b = buildSeriesQueue(
    'aa',
    '2026-01-01',
    [500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600],
  );
  const r = buildDailyTokenPageLBlockTrend([...a, ...b], {
    minTokens: 100,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'aa');
  assert.equal(r.sources[1]!.source, 'zz');
});

test('buildDailyTokenPageLBlockTrend: sort pageZAbsDesc default', () => {
  const upTrend = buildSeriesQueue(
    'up',
    '2026-01-01',
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  // flat-ish (small variance with single small bump)
  const flat = buildSeriesQueue(
    'fl',
    '2026-01-01',
    [100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101],
  );
  const r = buildDailyTokenPageLBlockTrend([...flat, ...upTrend], {
    minTokens: 0,
  });
  assert.equal(r.sources.length, 2);
  // up should come first (larger |Z|)
  assert.equal(r.sources[0]!.source, 'up');
});

test('buildDailyTokenPageLBlockTrend: sort tenure desc', () => {
  const a = buildSeriesQueue(
    'a',
    '2026-01-01',
    new Array(20).fill(0).map((_, i) => 100 + i),
  );
  const b = buildSeriesQueue(
    'b',
    '2026-01-01',
    new Array(15).fill(0).map((_, i) => 100 + i),
  );
  const r = buildDailyTokenPageLBlockTrend([...a, ...b], {
    minTokens: 0,
    sort: 'tenure',
  });
  assert.equal(r.sources[0]!.source, 'a');
});

test('buildDailyTokenPageLBlockTrend: rejects invalid sort', () => {
  assert.throws(() =>
    buildDailyTokenPageLBlockTrend([], { sort: 'bogus' as never }),
  );
});

test('buildDailyTokenPageLBlockTrend: rejects negative minTokens', () => {
  assert.throws(() =>
    buildDailyTokenPageLBlockTrend([], { minTokens: -1 }),
  );
});

test('buildDailyTokenPageLBlockTrend: rejects minTenureDays < 12', () => {
  assert.throws(() =>
    buildDailyTokenPageLBlockTrend([], { minTenureDays: 5 }),
  );
});

test('buildDailyTokenPageLBlockTrend: rejects negative top', () => {
  assert.throws(() =>
    buildDailyTokenPageLBlockTrend([], { top: -1 }),
  );
});

test('buildDailyTokenPageLBlockTrend: rejects bad since', () => {
  assert.throws(() =>
    buildDailyTokenPageLBlockTrend([], { since: 'not-iso' }),
  );
});

test('buildDailyTokenPageLBlockTrend: rejects bad until', () => {
  assert.throws(() =>
    buildDailyTokenPageLBlockTrend([], { until: 'not-iso' }),
  );
});

test('buildDailyTokenPageLBlockTrend: gap-filled days included as zeros', () => {
  // sparse data: first day, day 6, day 12
  const queue: QueueLine[] = [
    makeQueueLineFor('s', '2026-01-01T12:00:00.000Z', 1000),
    makeQueueLineFor('s', '2026-01-06T12:00:00.000Z', 5000),
    makeQueueLineFor('s', '2026-01-12T12:00:00.000Z', 9000),
  ];
  const r = buildDailyTokenPageLBlockTrend(queue, {
    minTokens: 100,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 12);
  assert.equal(r.sources[0]!.nActiveDays, 3);
});

test('buildDailyTokenPageLBlockTrend: report includes generatedAt and totals', () => {
  const queue = buildSeriesQueue(
    'a',
    '2026-01-01',
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  const r = buildDailyTokenPageLBlockTrend(queue, {
    minTokens: 0,
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2026-05-06T00:00:00.000Z');
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalTokens, 78);
});

test('buildDailyTokenPageLBlockTrend: sort pageL desc/asc orderings', () => {
  const up = buildSeriesQueue(
    'u',
    '2026-01-01',
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  const dn = buildSeriesQueue(
    'd',
    '2026-01-01',
    [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  );
  const r = buildDailyTokenPageLBlockTrend([...up, ...dn], {
    minTokens: 0,
    sort: 'pageL',
  });
  // ascending pageL: dn (40) before up (56)
  assert.equal(r.sources[0]!.source, 'd');
  assert.equal(r.sources[1]!.source, 'u');
});

test('buildDailyTokenPageLBlockTrend: sort pageZ asc puts down-trend first', () => {
  const up = buildSeriesQueue(
    'u',
    '2026-01-01',
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  const dn = buildSeriesQueue(
    'd',
    '2026-01-01',
    [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  );
  const r = buildDailyTokenPageLBlockTrend([...up, ...dn], {
    minTokens: 0,
    sort: 'pageZ',
  });
  assert.equal(r.sources[0]!.source, 'd');
});

test('buildDailyTokenPageLBlockTrend: pagePValue sort ascending = most-significant first', () => {
  const up = buildSeriesQueue(
    'u',
    '2026-01-01',
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  // weak signal: alternating up/down blocks, L = E[L]
  const wk = buildSeriesQueue(
    'w',
    '2026-01-01',
    [1, 2, 3, 30, 20, 10, 4, 5, 6, 31, 21, 11],
  );
  const r = buildDailyTokenPageLBlockTrend([...wk, ...up], {
    minTokens: 0,
    sort: 'pagePValue',
  });
  // up has tiny p, ranks first
  assert.equal(r.sources[0]!.source, 'u');
});

test('buildDailyTokenPageLBlockTrend: pagePValueDesc sort puts strongest p last', () => {
  const up = buildSeriesQueue(
    'u',
    '2026-01-01',
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  const wk = buildSeriesQueue(
    'w',
    '2026-01-01',
    [1, 2, 3, 30, 20, 10, 4, 5, 6, 31, 21, 11],
  );
  const r = buildDailyTokenPageLBlockTrend([...wk, ...up], {
    minTokens: 0,
    sort: 'pagePValueDesc',
  });
  assert.equal(r.sources[0]!.source, 'w');
});

test('buildDailyTokenPageLBlockTrend: pageLAbsDesc sorts by deviation from E[L]', () => {
  const up = buildSeriesQueue(
    'u',
    '2026-01-01',
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  // null pattern: alternating blocks (1,2,3) and (3,2,1) => L=48 = E[L], dev=0
  const nu = buildSeriesQueue(
    'n',
    '2026-01-01',
    [1, 2, 3, 30, 20, 10, 4, 5, 6, 31, 21, 11],
  );
  const r = buildDailyTokenPageLBlockTrend([...nu, ...up], {
    minTokens: 0,
    sort: 'pageLAbsDesc',
  });
  assert.equal(r.sources[0]!.source, 'u');
});

test('buildDailyTokenPageLBlockTrend: tokens sort desc', () => {
  const small = buildSeriesQueue(
    'a',
    '2026-01-01',
    new Array(12).fill(100),
  );
  // ensure variance to avoid drop
  small[5]!.total_tokens = 200;
  const big = buildSeriesQueue(
    'b',
    '2026-01-01',
    new Array(12).fill(0).map((_, i) => 1000 + i),
  );
  const r = buildDailyTokenPageLBlockTrend([...small, ...big], {
    minTokens: 0,
    sort: 'tokens',
  });
  assert.equal(r.sources[0]!.source, 'b');
});

test('buildDailyTokenPageLBlockTrend: window since/until filter', () => {
  const queue = buildSeriesQueue(
    'a',
    '2026-01-01',
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  );
  const r = buildDailyTokenPageLBlockTrend(queue, {
    minTokens: 0,
    since: '2026-01-04T00:00:00.000Z',
    until: '2026-01-16T00:00:00.000Z',
  });
  // 12 days kept (jan 4..15) -> nTenureDays = 12
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 12);
});
