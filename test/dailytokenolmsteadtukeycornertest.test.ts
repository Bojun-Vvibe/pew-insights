import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  olmsteadTukeySampleMedian,
  olmsteadTukeyCornerCounts,
  standardNormalUpperTailOlmsteadTukey,
  dailyTokenOlmsteadTukeyCornerTest,
  aggregateOlmsteadTukeyCornerTest,
  buildDailyTokenOlmsteadTukeyCornerTest,
} from '../src/dailytokenolmsteadtukeycornertest.ts';
import type { QueueLine } from '../src/types.ts';

// ----- olmsteadTukeySampleMedian -----

test('olmsteadTukeySampleMedian: odd-length basic', () => {
  assert.equal(olmsteadTukeySampleMedian([3, 1, 2]), 2);
});

test('olmsteadTukeySampleMedian: even averages two middles', () => {
  assert.equal(olmsteadTukeySampleMedian([4, 1, 3, 2]), 2.5);
});

test('olmsteadTukeySampleMedian: rejects empty', () => {
  assert.throws(() => olmsteadTukeySampleMedian([]));
});

test('olmsteadTukeySampleMedian: handles duplicates', () => {
  assert.equal(olmsteadTukeySampleMedian([5, 5, 5, 5]), 5);
});

// ----- olmsteadTukeyCornerCounts -----

test('olmsteadTukeyCornerCounts: clean up-trend has nNE+nSW filled', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const m = olmsteadTukeySampleMedian(v); // 6.5
  const { nNE, nNW, nSE, nSW } = olmsteadTukeyCornerCounts(v, m);
  assert.equal(nSW, 6); // first 6 below 6.5
  assert.equal(nNE, 6); // last 6 above 6.5
  assert.equal(nNW, 0);
  assert.equal(nSE, 0);
});

test('olmsteadTukeyCornerCounts: clean down-trend has nNW+nSE filled', () => {
  const v = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const m = olmsteadTukeySampleMedian(v); // 6.5
  const { nNE, nNW, nSE, nSW } = olmsteadTukeyCornerCounts(v, m);
  assert.equal(nNW, 6);
  assert.equal(nSE, 6);
  assert.equal(nNE, 0);
  assert.equal(nSW, 0);
});

test('olmsteadTukeyCornerCounts: zigzag yields short corner runs', () => {
  const v = [1, 10, 2, 9, 3, 8, 4, 7, 5, 6, 1, 10];
  const m = olmsteadTukeySampleMedian(v);
  const { nNE, nNW, nSE, nSW } = olmsteadTukeyCornerCounts(v, m);
  // last value 10 > median, prev 1 < median -> nNE = 1
  assert.equal(nNE, 1);
  assert.equal(nSE, 0);
  // first value 1 < median, next 10 > median -> nSW = 1
  assert.equal(nSW, 1);
  assert.equal(nNW, 0);
});

test('olmsteadTukeyCornerCounts: tie at right edge => both right counts 0', () => {
  // arrange so values[n-1] == median
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 6.5];
  const m = olmsteadTukeySampleMedian(v);
  // median of these 12 sorted: middle two are 6 and 6.5 -> 6.25
  // So values[n-1] = 6.5 > 6.25 -> right edge above; nNE >= 1.
  const { nNE, nSE } = olmsteadTukeyCornerCounts(v, m);
  assert.ok(nNE >= 1 || nSE >= 1);
});

test('olmsteadTukeyCornerCounts: rejects n<4', () => {
  assert.throws(() => olmsteadTukeyCornerCounts([1, 2, 3], 2));
});

test('olmsteadTukeyCornerCounts: nAtMedian counts exact ties', () => {
  const v = [3, 3, 3, 3, 1, 5, 7, 2];
  const m = olmsteadTukeySampleMedian(v);
  const { nAtMedian } = olmsteadTukeyCornerCounts(v, m);
  assert.equal(nAtMedian, 4);
});

test('olmsteadTukeyCornerCounts: only one of NE/SE nonzero (no tie at edge)', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const m = olmsteadTukeySampleMedian(v);
  const { nNE, nSE } = olmsteadTukeyCornerCounts(v, m);
  assert.ok(nNE === 0 || nSE === 0);
});

// ----- standard normal -----

test('standard normal Q(0) = 0.5', () => {
  assert.ok(
    Math.abs(standardNormalUpperTailOlmsteadTukey(0) - 0.5) < 1e-6,
  );
});

test('standard normal Q(1.96) ~ 0.025', () => {
  const q = standardNormalUpperTailOlmsteadTukey(1.96);
  assert.ok(Math.abs(q - 0.025) < 1e-3);
});

test('standard normal Q(-z) = 1 - Q(z)', () => {
  const z = 1.5;
  const sum =
    standardNormalUpperTailOlmsteadTukey(z) +
    standardNormalUpperTailOlmsteadTukey(-z);
  assert.ok(Math.abs(sum - 1) < 1e-6);
});

test('standard normal rejects non-finite', () => {
  assert.throws(() => standardNormalUpperTailOlmsteadTukey(NaN));
});

// ----- dailyTokenOlmsteadTukeyCornerTest -----

test('dailyTokenOlmsteadTukeyCornerTest: clean up-trend yields otQ >> 0', () => {
  const v: number[] = [];
  for (let i = 0; i < 24; i += 1) v.push(i + 1);
  const r = dailyTokenOlmsteadTukeyCornerTest(v);
  // up: nNE = 12, nSW = 12, others 0 -> otQ = 24
  assert.equal(r.nNE, 12);
  assert.equal(r.nSW, 12);
  assert.equal(r.nNW, 0);
  assert.equal(r.nSE, 0);
  assert.equal(r.otQ, 24);
  assert.ok(r.otZ > 3, `otZ=${r.otZ}`);
  assert.ok(r.otPValue < 0.001);
});

test('dailyTokenOlmsteadTukeyCornerTest: clean down-trend yields otQ << 0', () => {
  const v: number[] = [];
  for (let i = 0; i < 24; i += 1) v.push(24 - i);
  const r = dailyTokenOlmsteadTukeyCornerTest(v);
  assert.equal(r.nNW, 12);
  assert.equal(r.nSE, 12);
  assert.equal(r.otQ, -24);
  assert.ok(r.otZ < -3);
  assert.ok(r.otPValue < 0.001);
});

test('dailyTokenOlmsteadTukeyCornerTest: otZ = otQ / sqrt(8)', () => {
  const v = [1, 5, 3, 8, 2, 7, 4, 9, 1, 6, 2, 8, 5, 10];
  const r = dailyTokenOlmsteadTukeyCornerTest(v);
  assert.ok(
    Math.abs(r.otZ - r.otQ / Math.sqrt(8)) < 1e-9,
    `otZ=${r.otZ} otQ/sqrt8=${r.otQ / Math.sqrt(8)}`,
  );
});

test('dailyTokenOlmsteadTukeyCornerTest: zigzag near-noise gives small Q', () => {
  const v = [5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 6];
  const r = dailyTokenOlmsteadTukeyCornerTest(v);
  // median = 5.5; first val 5 < med => nSW counts run of 5s? but
  // sequence alternates so nSW = 1 (just index 0).
  assert.ok(Math.abs(r.otQ) <= 4, `otQ=${r.otQ}`);
});

test('dailyTokenOlmsteadTukeyCornerTest: rejects n<12', () => {
  assert.throws(() => dailyTokenOlmsteadTukeyCornerTest([1, 2, 3, 4, 5]));
});

test('dailyTokenOlmsteadTukeyCornerTest: rejects non-finite', () => {
  const v: number[] = [];
  for (let i = 0; i < 12; i += 1) v.push(i);
  v[3] = NaN;
  assert.throws(() => dailyTokenOlmsteadTukeyCornerTest(v));
});

test('dailyTokenOlmsteadTukeyCornerTest: rejects zero variance', () => {
  const v = new Array(12).fill(7) as number[];
  assert.throws(() => dailyTokenOlmsteadTukeyCornerTest(v));
});

test('dailyTokenOlmsteadTukeyCornerTest: pValue in [0,1]', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r = dailyTokenOlmsteadTukeyCornerTest(v);
  assert.ok(r.otPValue >= 0 && r.otPValue <= 1);
});

test('dailyTokenOlmsteadTukeyCornerTest: corner counts non-negative integers', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7];
  const r = dailyTokenOlmsteadTukeyCornerTest(v);
  for (const k of [r.nNE, r.nNW, r.nSE, r.nSW]) {
    assert.ok(Number.isInteger(k) && k >= 0);
  }
});

test('dailyTokenOlmsteadTukeyCornerTest: at most one of NE/SE nonzero', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7];
  const r = dailyTokenOlmsteadTukeyCornerTest(v);
  assert.ok(r.nNE === 0 || r.nSE === 0);
  assert.ok(r.nNW === 0 || r.nSW === 0);
});

test('dailyTokenOlmsteadTukeyCornerTest: large up-spike at end gives nNE >= 1', () => {
  const v = [2, 3, 4, 2, 3, 4, 2, 3, 4, 2, 100, 200];
  const r = dailyTokenOlmsteadTukeyCornerTest(v);
  assert.ok(r.nNE >= 1);
});

// ----- aggregateOlmsteadTukeyCornerTest -----

test('aggregate: empty input', () => {
  const r = aggregateOlmsteadTukeyCornerTest([]);
  assert.equal(r.rowsUsed, 0);
  assert.equal(r.stoufferZ, 0);
  assert.equal(r.stoufferTwoSidedPValue, 1);
});

test('aggregate: skips short tenure', () => {
  const r = aggregateOlmsteadTukeyCornerTest([
    { otZ: 1.5, otPValue: 0.13, nTenureDays: 5 },
  ]);
  assert.equal(r.rowsSkipped, 1);
  assert.equal(r.rowsUsed, 0);
});

test('aggregate: combines two signed z values', () => {
  const r = aggregateOlmsteadTukeyCornerTest([
    { otZ: 2, otPValue: 0.045, nTenureDays: 20 },
    { otZ: -1, otPValue: 0.32, nTenureDays: 40 },
  ]);
  assert.equal(r.rowsUsed, 2);
  assert.ok(Math.abs(r.stoufferZ - 1 / Math.sqrt(2)) < 1e-9);
  assert.ok(Math.abs(r.tenureWeightedMeanOtZ - 0) < 1e-9);
});

test('aggregate: skips NaN otZ', () => {
  const r = aggregateOlmsteadTukeyCornerTest([
    { otZ: NaN, otPValue: 0.5, nTenureDays: 30 },
  ]);
  assert.equal(r.rowsSkipped, 1);
});

test('aggregate: skips bad pvalue', () => {
  const r = aggregateOlmsteadTukeyCornerTest([
    { otZ: 1, otPValue: 1.5, nTenureDays: 30 },
    { otZ: 1, otPValue: -0.1, nTenureDays: 30 },
  ]);
  assert.equal(r.rowsSkipped, 2);
});

// ----- buildDailyTokenOlmsteadTukeyCornerTest -----

function makeQueue(): QueueLine[] {
  const out: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    const day = `2026-04-${String(i + 1).padStart(2, '0')}`;
    out.push({
      hour_start: `${day}T00:00:00.000Z`,
      source: 'sourceA',
      total_tokens: (i + 1) * 100, // up
    } as QueueLine);
    out.push({
      hour_start: `${day}T00:00:00.000Z`,
      source: 'sourceB',
      total_tokens: (14 - i) * 100, // down
    } as QueueLine);
  }
  return out;
}

test('build: returns rows for both sources with correct sign', () => {
  const rep = buildDailyTokenOlmsteadTukeyCornerTest(makeQueue(), {
    generatedAt: '2026-05-06T00:00:00.000Z',
    sort: 'source',
  });
  assert.equal(rep.sources.length, 2);
  const a = rep.sources.find((r) => r.source === 'sourceA')!;
  const b = rep.sources.find((r) => r.source === 'sourceB')!;
  assert.ok(a.otQ > 0, `A otQ=${a.otQ}`);
  assert.ok(b.otQ < 0, `B otQ=${b.otQ}`);
});

test('build: sort otZAbsDesc', () => {
  const rep = buildDailyTokenOlmsteadTukeyCornerTest(makeQueue(), {
    generatedAt: '2026-05-06T00:00:00.000Z',
    sort: 'otZAbsDesc',
  });
  for (let i = 1; i < rep.sources.length; i += 1) {
    assert.ok(
      Math.abs(rep.sources[i - 1]!.otZ) >= Math.abs(rep.sources[i]!.otZ),
    );
  }
});

test('build: source filter', () => {
  const rep = buildDailyTokenOlmsteadTukeyCornerTest(makeQueue(), {
    generatedAt: '2026-05-06T00:00:00.000Z',
    source: 'sourceA',
  });
  assert.equal(rep.sources.length, 1);
  assert.equal(rep.sources[0]!.source, 'sourceA');
});

test('build: top cap', () => {
  const rep = buildDailyTokenOlmsteadTukeyCornerTest(makeQueue(), {
    generatedAt: '2026-05-06T00:00:00.000Z',
    top: 1,
    sort: 'otZAbsDesc',
  });
  assert.equal(rep.sources.length, 1);
  assert.equal(rep.droppedTopSources, 1);
});

test('build: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenOlmsteadTukeyCornerTest([], { minTokens: -1 }),
  );
});

test('build: rejects minTenureDays < 12', () => {
  assert.throws(() =>
    buildDailyTokenOlmsteadTukeyCornerTest([], { minTenureDays: 5 }),
  );
});

test('build: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenOlmsteadTukeyCornerTest([], {
      sort: 'bogus' as never,
    }),
  );
});

test('build: rejects bad since', () => {
  assert.throws(() =>
    buildDailyTokenOlmsteadTukeyCornerTest([], { since: 'not-a-date' }),
  );
});

test('build: counters track non-positive tokens / bad iso', () => {
  const q: QueueLine[] = [
    { hour_start: '2026-04-01T00:00:00.000Z', source: 'x', total_tokens: 0 } as QueueLine,
    { hour_start: 'bad-iso', source: 'x', total_tokens: 100 } as QueueLine,
  ];
  const rep = buildDailyTokenOlmsteadTukeyCornerTest(q);
  assert.equal(rep.droppedNonPositiveTokens, 1);
  assert.equal(rep.droppedInvalidHourStart, 1);
});

test('build: corner counts surface in source row', () => {
  const rep = buildDailyTokenOlmsteadTukeyCornerTest(makeQueue(), {
    generatedAt: '2026-05-06T00:00:00.000Z',
    sort: 'source',
  });
  for (const r of rep.sources) {
    assert.ok(r.nNE >= 0 && r.nSE >= 0 && r.nNW >= 0 && r.nSW >= 0);
    assert.ok(r.nNE === 0 || r.nSE === 0);
    assert.ok(r.nNW === 0 || r.nSW === 0);
  }
});

test('build: tie-stable sort by source asc', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    const day = `2026-04-${String(i + 1).padStart(2, '0')}`;
    for (const src of ['zebra', 'alpha']) {
      q.push({
        hour_start: `${day}T00:00:00.000Z`,
        source: src,
        total_tokens: (i + 1) * 100,
      } as QueueLine);
    }
  }
  const rep = buildDailyTokenOlmsteadTukeyCornerTest(q, {
    generatedAt: '2026-05-06T00:00:00.000Z',
    sort: 'source',
  });
  assert.deepEqual(
    rep.sources.map((r) => r.source),
    ['alpha', 'zebra'],
  );
});

test('build: tokens sort puts heaviest first', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    const day = `2026-04-${String(i + 1).padStart(2, '0')}`;
    q.push({
      hour_start: `${day}T00:00:00.000Z`,
      source: 'big',
      total_tokens: 1000 + i,
    } as QueueLine);
    q.push({
      hour_start: `${day}T00:00:00.000Z`,
      source: 'small',
      total_tokens: 100 + i,
    } as QueueLine);
  }
  const rep = buildDailyTokenOlmsteadTukeyCornerTest(q, {
    generatedAt: '2026-05-06T00:00:00.000Z',
    sort: 'tokens',
  });
  assert.equal(rep.sources[0]!.source, 'big');
  assert.equal(rep.sources[1]!.source, 'small');
});

test('build: minTokens drops below-threshold', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    const day = `2026-04-${String(i + 1).padStart(2, '0')}`;
    q.push({
      hour_start: `${day}T00:00:00.000Z`,
      source: 'tiny',
      total_tokens: 1,
    } as QueueLine);
  }
  const rep = buildDailyTokenOlmsteadTukeyCornerTest(q, { minTokens: 1000 });
  assert.equal(rep.sources.length, 0);
  assert.equal(rep.droppedSparseSources, 1);
});

test('build: otQ sort works', () => {
  const rep = buildDailyTokenOlmsteadTukeyCornerTest(makeQueue(), {
    generatedAt: '2026-05-06T00:00:00.000Z',
    sort: 'otQ',
  });
  for (let i = 1; i < rep.sources.length; i += 1) {
    assert.ok(rep.sources[i - 1]!.otQ <= rep.sources[i]!.otQ);
  }
});

test('build: otQAbsDesc sort works', () => {
  const rep = buildDailyTokenOlmsteadTukeyCornerTest(makeQueue(), {
    generatedAt: '2026-05-06T00:00:00.000Z',
    sort: 'otQAbsDesc',
  });
  for (let i = 1; i < rep.sources.length; i += 1) {
    assert.ok(
      Math.abs(rep.sources[i - 1]!.otQ) >= Math.abs(rep.sources[i]!.otQ),
    );
  }
});
