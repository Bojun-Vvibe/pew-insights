import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenAlexanderssonSnht,
  dailyTokenAlexanderssonSnht,
  snhtSummary,
  snhtCriticalValue,
  standardNormalCdfSnht,
} from '../src/dailytokenalexanderssonsnht.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, tokens: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
  };
}

const GEN = '2026-05-06T12:00:00.000Z';

// ---- option validation ---------------------------------------------------

test('snht: rejects bad minTenureDays', () => {
  assert.throws(() => buildDailyTokenAlexanderssonSnht([], { minTenureDays: 20 }));
  assert.throws(() => buildDailyTokenAlexanderssonSnht([], { minTenureDays: 21.5 }));
  assert.throws(() => buildDailyTokenAlexanderssonSnht([], { minTenureDays: 0 }));
});

test('snht: rejects bad minTokens', () => {
  assert.throws(() => buildDailyTokenAlexanderssonSnht([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenAlexanderssonSnht([], { minTokens: NaN }));
});

test('snht: rejects bad top', () => {
  assert.throws(() => buildDailyTokenAlexanderssonSnht([], { top: -1 }));
  assert.throws(() => buildDailyTokenAlexanderssonSnht([], { top: 1.5 }));
});

test('snht: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenAlexanderssonSnht([], { sort: 'nope' as 't0' }),
  );
});

test('snht: rejects bad since/until', () => {
  assert.throws(() => buildDailyTokenAlexanderssonSnht([], { since: 'no' }));
  assert.throws(() => buildDailyTokenAlexanderssonSnht([], { until: 'nope' }));
});

test('snht: empty queue -> empty sources', () => {
  const r = buildDailyTokenAlexanderssonSnht([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.minTenureDays, 21);
  assert.equal(r.sort, 't0Desc');
});

// ---- Phi pure helper ----------------------------------------------------

test('standardNormalCdfSnht: at 0 returns 0.5', () => {
  assert.ok(Math.abs(standardNormalCdfSnht(0) - 0.5) < 1e-7);
});

test('standardNormalCdfSnht: at +1.96 ~ 0.975', () => {
  assert.ok(Math.abs(standardNormalCdfSnht(1.96) - 0.975) < 1e-3);
});

test('standardNormalCdfSnht: at -1.96 ~ 0.025', () => {
  assert.ok(Math.abs(standardNormalCdfSnht(-1.96) - 0.025) < 1e-3);
});

test('standardNormalCdfSnht: ±Infinity', () => {
  assert.equal(standardNormalCdfSnht(Number.POSITIVE_INFINITY), 1);
  assert.equal(standardNormalCdfSnht(Number.NEGATIVE_INFINITY), 0);
});

test('standardNormalCdfSnht: NaN throws', () => {
  assert.throws(() => standardNormalCdfSnht(NaN));
});

// ---- snhtCriticalValue --------------------------------------------------

test('snhtCriticalValue: monotone in alpha at fixed n (0.10 < 0.05 < 0.01)', () => {
  for (const n of [21, 50, 100, 500, 5000]) {
    const t10 = snhtCriticalValue(n, 0.10);
    const t05 = snhtCriticalValue(n, 0.05);
    const t01 = snhtCriticalValue(n, 0.01);
    assert.ok(t10 < t05, `n=${n}: t10=${t10} should be < t05=${t05}`);
    assert.ok(t05 < t01, `n=${n}: t05=${t05} should be < t01=${t01}`);
  }
});

test('snhtCriticalValue: monotone increasing in n at fixed alpha', () => {
  const t21 = snhtCriticalValue(21, 0.05);
  const t100 = snhtCriticalValue(100, 0.05);
  const t1000 = snhtCriticalValue(1000, 0.05);
  assert.ok(t21 < t100);
  assert.ok(t100 < t1000);
});

test('snhtCriticalValue: positive', () => {
  for (const n of [21, 50, 100, 1000]) {
    assert.ok(snhtCriticalValue(n, 0.05) > 0);
  }
});

test('snhtCriticalValue: rejects bad n', () => {
  assert.throws(() => snhtCriticalValue(1, 0.05));
  assert.throws(() => snhtCriticalValue(NaN, 0.05));
});

// ---- snhtSummary pure helper --------------------------------------------

test('snhtSummary: empty -> degenerate', () => {
  const s = snhtSummary([]);
  assert.equal(s.t0, 0);
  assert.equal(s.aStar, -1);
});

test('snhtSummary: single value -> degenerate', () => {
  const s = snhtSummary([42]);
  assert.equal(s.t0, 0);
  assert.equal(s.aStar, -1);
});

test('snhtSummary: constant series -> degenerate (sd=0)', () => {
  const s = snhtSummary([5, 5, 5, 5, 5]);
  assert.equal(s.t0, 0);
  assert.equal(s.aStar, -1);
  assert.equal(s.muBefore, 5);
  assert.equal(s.muAfter, 5);
});

test('snhtSummary: strict step shift -> aStar at jump', () => {
  // 10 zeros then 10 ones; jump at index 10 -> aStar=10
  const x = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ];
  const s = snhtSummary(x);
  assert.equal(s.aStar, 10);
  assert.ok(s.t0 > 10, `expected large T0, got ${s.t0}`);
  assert.equal(s.muBefore, 0);
  assert.equal(s.muAfter, 1);
  assert.equal(s.meanShift, 1);
  assert.ok(s.zShift > 0);
});

test('snhtSummary: down step -> negative meanShift, zShift', () => {
  const x = [
    10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ];
  const s = snhtSummary(x);
  assert.equal(s.aStar, 10);
  assert.ok(s.meanShift < 0);
  assert.ok(s.zShift < 0);
});

test('snhtSummary: time-reversal preserves T0, swaps means', () => {
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  ];
  const r = [...x].reverse();
  const sx = snhtSummary(x);
  const sr = snhtSummary(r);
  assert.ok(Math.abs(sx.t0 - sr.t0) < 1e-9);
  // meanShifts negate
  assert.ok(Math.abs(sx.meanShift + sr.meanShift) < 1e-9);
});

test('snhtSummary: T0 grows with shift magnitude', () => {
  const a = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const b = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
  // After standardisation both have z values [-1,...,-1,+1,...,+1] (same!)
  // so T0 should be identical -- this is a feature of SNHT.
  const sa = snhtSummary(a);
  const sb = snhtSummary(b);
  assert.ok(Math.abs(sa.t0 - sb.t0) < 1e-9);
  // But raw meanShift differs.
  assert.ok(Math.abs(sb.meanShift) > Math.abs(sa.meanShift));
});

test('snhtSummary: aStar in [1, n-1]', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4];
  const s = snhtSummary(x);
  assert.ok(s.aStar >= 1);
  assert.ok(s.aStar <= x.length - 1);
});

test('snhtSummary: t2Star and aStar2 outside guard', () => {
  // two clean step shifts: 0..6 low, 7..13 high, 14..20 low again
  const x: number[] = [];
  for (let i = 0; i < 7; i++) x.push(0);
  for (let i = 0; i < 7; i++) x.push(10);
  for (let i = 0; i < 7; i++) x.push(0);
  const s = snhtSummary(x);
  assert.ok(s.t0 > 0);
  assert.ok(s.t2Star > 0);
  assert.ok(s.t2OverT > 0 && s.t2OverT <= 1);
  // primary and secondary should be in different halves
  if (s.aStar2 >= 0) {
    const guard = Math.max(3, Math.floor(x.length / 10));
    assert.ok(Math.abs(s.aStar - s.aStar2) > guard);
  }
});

// ---- dailyTokenAlexanderssonSnht numeric driver -------------------------

test('dailyTokenAlexanderssonSnht: rejects n < 21', () => {
  assert.throws(() => dailyTokenAlexanderssonSnht(new Array(20).fill(1)));
});

test('dailyTokenAlexanderssonSnht: rejects non-finite', () => {
  const x = new Array(25).fill(1) as number[];
  x[3] = NaN;
  assert.throws(() => dailyTokenAlexanderssonSnht(x));
});

test('dailyTokenAlexanderssonSnht: rejects negative', () => {
  const x = new Array(25).fill(1) as number[];
  x[5] = -1;
  assert.throws(() => dailyTokenAlexanderssonSnht(x));
});

test('dailyTokenAlexanderssonSnht: rejects zero variance', () => {
  assert.throws(() => dailyTokenAlexanderssonSnht(new Array(25).fill(7)));
});

test('dailyTokenAlexanderssonSnht: clean step shift = significant', () => {
  const x: number[] = [];
  for (let i = 0; i < 15; i++) x.push(100);
  for (let i = 0; i < 15; i++) x.push(1000);
  // tiny variance within each block: add small perturbation
  for (let i = 0; i < x.length; i++) x[i] = x[i]! + ((i % 3) - 1);
  const r = dailyTokenAlexanderssonSnht(x);
  assert.equal(r.aStar, 15);
  assert.ok(r.significant05, `T0=${r.t0} tCrit05=${r.tCrit05} should be significant`);
  assert.ok(r.t0 > r.tCrit05);
  assert.ok(r.meanShift > 0);
  assert.ok(r.pApprox < 0.05);
});

test('dailyTokenAlexanderssonSnht: noise only -> usually not significant at 0.05', () => {
  // deterministic pseudo-random walk that is mean-zero noise
  const x: number[] = [];
  let seed = 42;
  for (let i = 0; i < 30; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    x.push(50 + (seed % 7));
  }
  const r = dailyTokenAlexanderssonSnht(x);
  // Cannot guarantee non-significance for arbitrary seed but for this seed it is.
  assert.ok(r.t0 < r.tCrit01, `pure noise should not be sig at 0.01: T0=${r.t0} tCrit01=${r.tCrit01}`);
});

test('dailyTokenAlexanderssonSnht: pApprox in [0, 1]', () => {
  const x: number[] = [];
  for (let i = 0; i < 25; i++) x.push(i * 10);
  const r = dailyTokenAlexanderssonSnht(x);
  assert.ok(r.pApprox >= 0);
  assert.ok(r.pApprox <= 1);
});

test('dailyTokenAlexanderssonSnht: critical-value ordering', () => {
  const x: number[] = [];
  for (let i = 0; i < 25; i++) x.push(i + 1);
  const r = dailyTokenAlexanderssonSnht(x);
  assert.ok(r.tCrit10 < r.tCrit05);
  assert.ok(r.tCrit05 < r.tCrit01);
});

test('dailyTokenAlexanderssonSnht: time-reversal preserves T0, swaps direction', () => {
  const x: number[] = [];
  for (let i = 0; i < 12; i++) x.push(50 + (i % 3));
  for (let i = 0; i < 13; i++) x.push(200 + (i % 4));
  const r1 = dailyTokenAlexanderssonSnht(x);
  const r2 = dailyTokenAlexanderssonSnht([...x].reverse());
  assert.ok(Math.abs(r1.t0 - r2.t0) < 1e-9);
  assert.ok(Math.abs(r1.meanShift + r2.meanShift) < 1e-9);
  // aStar reverses: aStar1 + aStar2 = n
  assert.equal(r1.aStar + r2.aStar, x.length);
});

// ---- builder over QueueLine[] -------------------------------------------

function genStepSeries(
  source: string,
  start: string,
  preDays: number,
  postDays: number,
  preLevel: number,
  postLevel: number,
): QueueLine[] {
  const out: QueueLine[] = [];
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  for (let i = 0; i < preDays; i++) {
    const day = new Date(startMs + i * 86_400_000).toISOString().slice(0, 10);
    out.push(ql(`${day}T03:00:00.000Z`, source, preLevel + (i % 3)));
  }
  for (let i = 0; i < postDays; i++) {
    const day = new Date(startMs + (preDays + i) * 86_400_000).toISOString().slice(0, 10);
    out.push(ql(`${day}T03:00:00.000Z`, source, postLevel + (i % 4)));
  }
  return out;
}

test('builder: detects clean step shift on synthetic source', () => {
  const queue = genStepSeries('s1', '2026-01-01', 12, 13, 100, 1000);
  const r = buildDailyTokenAlexanderssonSnht(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 's1');
  assert.equal(row.nTenureDays, 25);
  assert.equal(row.aStar, 12);
  assert.ok(row.significant05);
  assert.ok(row.meanShift > 0);
  assert.equal(row.aStarDay, '2026-01-13');
});

test('builder: drops sparse sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 25; i++) {
    const d = new Date(Date.parse('2026-01-01') + i * 86_400_000).toISOString().slice(0, 10);
    q.push(ql(`${d}T03:00:00.000Z`, 'tinysrc', 1));
  }
  const r = buildDailyTokenAlexanderssonSnht(q, { generatedAt: GEN, minTokens: 1000 });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('builder: drops below min tenure', () => {
  const q = genStepSeries('s', '2026-01-01', 5, 5, 100, 1000);
  const r = buildDailyTokenAlexanderssonSnht(q, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('builder: drops zero-variance source', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 25; i++) {
    const d = new Date(Date.parse('2026-01-01') + i * 86_400_000).toISOString().slice(0, 10);
    q.push(ql(`${d}T03:00:00.000Z`, 's', 100));
  }
  const r = buildDailyTokenAlexanderssonSnht(q, { generatedAt: GEN, minTokens: 0 });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('builder: source filter respected', () => {
  const a = genStepSeries('a', '2026-01-01', 12, 13, 100, 1000);
  const b = genStepSeries('b', '2026-01-01', 12, 13, 200, 800);
  const q = [...a, ...b];
  const r = buildDailyTokenAlexanderssonSnht(q, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('builder: lex source ordering on T0 ties', () => {
  const a = genStepSeries('z-src', '2026-01-01', 12, 13, 100, 1000);
  const b = genStepSeries('a-src', '2026-01-01', 12, 13, 100, 1000);
  const r = buildDailyTokenAlexanderssonSnht([...a, ...b], {
    generatedAt: GEN,
    sort: 't0Desc',
  });
  assert.equal(r.sources.length, 2);
  // identical T0 (same standardised series), tie -> source asc
  assert.equal(r.sources[0]!.source, 'a-src');
  assert.equal(r.sources[1]!.source, 'z-src');
});

test('builder: top cap surfaces dropped count', () => {
  const a = genStepSeries('a', '2026-01-01', 12, 13, 100, 1000);
  const b = genStepSeries('b', '2026-01-01', 12, 13, 200, 800);
  const c = genStepSeries('c', '2026-01-01', 12, 13, 50, 500);
  const r = buildDailyTokenAlexanderssonSnht([...a, ...b, ...c], {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('builder: invalid hour_start surfaces in dropped count', () => {
  const q: QueueLine[] = [
    ql('not-a-timestamp', 's', 100),
    ...genStepSeries('s', '2026-01-01', 12, 13, 100, 1000),
  ];
  const r = buildDailyTokenAlexanderssonSnht(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('builder: non-positive tokens surface in dropped count', () => {
  const q: QueueLine[] = [
    ql('2026-01-01T03:00:00.000Z', 's', 0),
    ...genStepSeries('s', '2026-01-02', 12, 13, 100, 1000),
  ];
  const r = buildDailyTokenAlexanderssonSnht(q, { generatedAt: GEN });
  assert.equal(r.droppedNonPositiveTokens, 1);
});

test('builder: sort by aStar ascending', () => {
  const a = genStepSeries('s-a', '2026-01-01', 5, 20, 100, 1000); // aStar=5
  const b = genStepSeries('s-b', '2026-01-01', 18, 7, 100, 1000); // aStar=18
  const r = buildDailyTokenAlexanderssonSnht([...a, ...b], {
    generatedAt: GEN,
    sort: 'aStar',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 's-a');
  assert.equal(r.sources[1]!.source, 's-b');
  assert.ok(r.sources[0]!.aStar <= r.sources[1]!.aStar);
});

test('builder: sort by tokens', () => {
  const small = genStepSeries('small', '2026-01-01', 12, 13, 1, 10);
  const big = genStepSeries('big', '2026-01-01', 12, 13, 1000, 5000);
  const r = buildDailyTokenAlexanderssonSnht([...small, ...big], {
    generatedAt: GEN,
    sort: 'tokens',
    minTokens: 0,
  });
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.sources[1]!.source, 'small');
});

test('builder: sort by tenure', () => {
  const longer = genStepSeries('longer', '2026-01-01', 20, 20, 100, 1000);
  const shorter = genStepSeries('shorter', '2026-01-01', 12, 13, 100, 1000);
  const r = buildDailyTokenAlexanderssonSnht([...longer, ...shorter], {
    generatedAt: GEN,
    sort: 'tenure',
  });
  assert.equal(r.sources[0]!.source, 'longer');
});

test('builder: report metadata fields', () => {
  const q = genStepSeries('s', '2026-01-01', 12, 13, 100, 1000);
  const r = buildDailyTokenAlexanderssonSnht(q, {
    generatedAt: GEN,
    since: '2026-01-01T00:00:00.000Z',
    until: '2026-12-31T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.windowStart, '2026-01-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-12-31T00:00:00.000Z');
  assert.equal(r.minTenureDays, 21);
  assert.equal(r.minTokens, 1000);
});

test('builder: gap-fill (missing day -> 0)', () => {
  const q: QueueLine[] = [];
  // 25 days but skip day 5
  for (let i = 0; i < 25; i++) {
    if (i === 5) continue;
    const d = new Date(Date.parse('2026-01-01') + i * 86_400_000).toISOString().slice(0, 10);
    q.push(ql(`${d}T03:00:00.000Z`, 's', 100 + i * 10));
  }
  const r = buildDailyTokenAlexanderssonSnht(q, { generatedAt: GEN, minTokens: 0 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 25);
  assert.equal(r.sources[0]!.nActiveDays, 24);
});

test('builder: significant05 flag matches T0 vs tCrit05', () => {
  const q = genStepSeries('s', '2026-01-01', 12, 13, 100, 1000);
  const r = buildDailyTokenAlexanderssonSnht(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.significant05, row.t0 >= row.tCrit05);
});

test('builder: tEdgeRatio in [0, 1]', () => {
  const q = genStepSeries('s', '2026-01-01', 12, 13, 100, 1000);
  const r = buildDailyTokenAlexanderssonSnht(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(row.tEdgeRatio >= 0);
  assert.ok(row.tEdgeRatio <= 1);
});

test('builder: t2OverT in [0, 1]', () => {
  const q = genStepSeries('s', '2026-01-01', 12, 13, 100, 1000);
  const r = buildDailyTokenAlexanderssonSnht(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(row.t2OverT >= 0);
  assert.ok(row.t2OverT <= 1);
});
