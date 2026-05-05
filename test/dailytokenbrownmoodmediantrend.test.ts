import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  brownMoodSampleMedian,
  brownMoodContingency,
  standardNormalUpperTailBrownMoodMedianTrend,
  dailyTokenBrownMoodMedianTrend,
  aggregateBrownMoodMedianTrend,
  buildDailyTokenBrownMoodMedianTrend,
} from '../src/dailytokenbrownmoodmediantrend.ts';
import type { QueueLine } from '../src/types.ts';

// ----- brownMoodSampleMedian -----

test('brownMoodSampleMedian: odd-length basic', () => {
  assert.equal(brownMoodSampleMedian([3, 1, 2]), 2);
});

test('brownMoodSampleMedian: even-length averages middle two', () => {
  assert.equal(brownMoodSampleMedian([4, 1, 3, 2]), 2.5);
});

test('brownMoodSampleMedian: stable on already-sorted', () => {
  assert.equal(brownMoodSampleMedian([1, 2, 3, 4, 5]), 3);
});

test('brownMoodSampleMedian: handles ties', () => {
  assert.equal(brownMoodSampleMedian([5, 5, 5, 5]), 5);
});

test('brownMoodSampleMedian: rejects empty', () => {
  assert.throws(() => brownMoodSampleMedian([]));
});

// ----- brownMoodContingency -----

test('brownMoodContingency: clean up-trend has c >> a', () => {
  // 12 values: first half low (0..5), second half high (10..15).
  const v = [0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15];
  const m = brownMoodSampleMedian(v); // (5+10)/2 = 7.5
  const { a, b, c, d, h, nAtMedian } = brownMoodContingency(v, m);
  assert.equal(h, 6);
  assert.equal(a, 0); // none of 0..5 > 7.5
  assert.equal(b, 6);
  assert.equal(c, 6); // all of 10..15 > 7.5
  assert.equal(d, 0);
  assert.equal(nAtMedian, 0);
});

test('brownMoodContingency: clean down-trend has a >> c', () => {
  const v = [15, 14, 13, 12, 11, 10, 5, 4, 3, 2, 1, 0];
  const m = brownMoodSampleMedian(v); // 7.5
  const { a, b, c, d } = brownMoodContingency(v, m);
  assert.equal(a, 6);
  assert.equal(b, 0);
  assert.equal(c, 0);
  assert.equal(d, 6);
});

test('brownMoodContingency: balanced series gives roughly equal cells', () => {
  const v = [1, 9, 2, 8, 3, 7, 4, 6, 5, 10, 1, 9];
  const m = brownMoodSampleMedian(v);
  const { a, b, c, d, h } = brownMoodContingency(v, m);
  assert.equal(a + b, h);
  assert.equal(c + d, v.length - h);
  assert.equal(a + b + c + d, v.length);
});

test('brownMoodContingency: ties at median go into NOT-ABOVE', () => {
  const v = [1, 2, 3, 4, 5, 5, 5, 5];
  const m = brownMoodSampleMedian(v); // 4.5
  const { a, b, c, d } = brownMoodContingency(v, m);
  // first half [1,2,3,4]: above 4.5 -> none; not -> 4
  assert.equal(a, 0);
  assert.equal(b, 4);
  // second half [5,5,5,5]: above 4.5 -> 4; not -> 0
  assert.equal(c, 4);
  assert.equal(d, 0);
});

test('brownMoodContingency: median-equal values count in nAtMedian', () => {
  const v = [3, 3, 3, 3];
  const m = brownMoodSampleMedian(v);
  const { nAtMedian } = brownMoodContingency(v, m);
  assert.equal(nAtMedian, 4);
});

test('brownMoodContingency: rejects single value', () => {
  assert.throws(() => brownMoodContingency([5], 5));
});

test('brownMoodContingency: odd n -> first half is floor(n/2)', () => {
  const v = [1, 2, 3, 4, 5, 6, 7];
  const m = brownMoodSampleMedian(v);
  const { h } = brownMoodContingency(v, m);
  assert.equal(h, 3);
});

// ----- standardNormalUpperTailBrownMoodMedianTrend -----

test('standard normal tail: Q(0) = 0.5', () => {
  assert.ok(
    Math.abs(standardNormalUpperTailBrownMoodMedianTrend(0) - 0.5) < 1e-6,
  );
});

test('standard normal tail: Q(1.96) ~ 0.025', () => {
  const q = standardNormalUpperTailBrownMoodMedianTrend(1.96);
  assert.ok(Math.abs(q - 0.025) < 1e-3, `q=${q}`);
});

test('standard normal tail: Q(-z) = 1 - Q(z)', () => {
  const z = 1.5;
  const sum =
    standardNormalUpperTailBrownMoodMedianTrend(z) +
    standardNormalUpperTailBrownMoodMedianTrend(-z);
  assert.ok(Math.abs(sum - 1) < 1e-6);
});

test('standard normal tail: rejects non-finite', () => {
  assert.throws(() => standardNormalUpperTailBrownMoodMedianTrend(NaN));
});

// ----- dailyTokenBrownMoodMedianTrend -----

test('dailyTokenBrownMoodMedianTrend: clean up-trend yields bmZ << 0', () => {
  const v: number[] = [];
  for (let i = 0; i < 24; i += 1) v.push(i + 1);
  const r = dailyTokenBrownMoodMedianTrend(v);
  // up-trend: more above-median in second half -> bmZ negative
  assert.ok(r.bmZ < -3, `bmZ=${r.bmZ}`);
  assert.ok(r.bmPValue < 0.01, `p=${r.bmPValue}`);
  assert.equal(r.aFirstAbove, 0);
  assert.equal(r.cSecondAbove, 12);
});

test('dailyTokenBrownMoodMedianTrend: clean down-trend yields bmZ >> 0', () => {
  const v: number[] = [];
  for (let i = 0; i < 24; i += 1) v.push(24 - i);
  const r = dailyTokenBrownMoodMedianTrend(v);
  assert.ok(r.bmZ > 3, `bmZ=${r.bmZ}`);
  assert.ok(r.bmPValue < 0.01, `p=${r.bmPValue}`);
  assert.equal(r.aFirstAbove, 12);
  assert.equal(r.cSecondAbove, 0);
});

test('dailyTokenBrownMoodMedianTrend: bmChi2 = bmZ^2 (algebraic identity)', () => {
  const v = [1, 5, 3, 8, 2, 7, 4, 9, 1, 6, 2, 8, 5, 10];
  const r = dailyTokenBrownMoodMedianTrend(v);
  assert.ok(
    Math.abs(r.bmChi2 - r.bmZ * r.bmZ) < 1e-9,
    `chi2=${r.bmChi2} z^2=${r.bmZ * r.bmZ}`,
  );
});

test('dailyTokenBrownMoodMedianTrend: balanced ~ no rejection', () => {
  // Symmetric noise around constant mean.
  const v = [10, 5, 11, 6, 9, 7, 12, 4, 8, 13, 3, 14];
  const r = dailyTokenBrownMoodMedianTrend(v);
  assert.ok(r.bmPValue > 0.05, `p=${r.bmPValue}`);
});

test('dailyTokenBrownMoodMedianTrend: rejects n < 12', () => {
  assert.throws(() => dailyTokenBrownMoodMedianTrend([1, 2, 3, 4, 5]));
});

test('dailyTokenBrownMoodMedianTrend: rejects non-finite', () => {
  const v: number[] = [];
  for (let i = 0; i < 12; i += 1) v.push(i);
  v[3] = NaN;
  assert.throws(() => dailyTokenBrownMoodMedianTrend(v));
});

test('dailyTokenBrownMoodMedianTrend: rejects zero-variance', () => {
  const v: number[] = [];
  for (let i = 0; i < 12; i += 1) v.push(7);
  assert.throws(() => dailyTokenBrownMoodMedianTrend(v));
});

test('dailyTokenBrownMoodMedianTrend: bmPValue is in [0, 1]', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r = dailyTokenBrownMoodMedianTrend(v);
  assert.ok(r.bmPValue >= 0 && r.bmPValue <= 1);
});

test('dailyTokenBrownMoodMedianTrend: cells sum to n', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7];
  const r = dailyTokenBrownMoodMedianTrend(v);
  assert.equal(
    r.aFirstAbove + r.bFirstNotAbove + r.cSecondAbove + r.dSecondNotAbove,
    v.length,
  );
  assert.equal(r.nFirst + r.nSecond, v.length);
});

test('dailyTokenBrownMoodMedianTrend: degenerate split throws (all values >= 0 with median 0)', () => {
  // Construct case where A = a + c = 0 (no value above median): impossible
  // unless many ties; engineer it with all values = 5 except slight noise that
  // still leaves zero column-totals. Use binary 0/1 with median 1: above=none.
  // Take 14 values: zeros and ones, but median = 1, "above" requires > 1.
  const v = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
  // median = 0.5; above 0.5 are the 1s -> A = 7, B = 7. Not degenerate.
  // Try: all 1s except varied (ensure not zero variance):
  const v2 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1];
  // sorted: 0,1,1,1,1,1,1,1,1,1,1,1,1,1; median = (1+1)/2 = 1; above 1 -> none.
  // A = 0 -> degenerate.
  assert.throws(() => dailyTokenBrownMoodMedianTrend(v2), /degenerate/);
});

// ----- aggregateBrownMoodMedianTrend -----

test('aggregateBrownMoodMedianTrend: empty input', () => {
  const r = aggregateBrownMoodMedianTrend([]);
  assert.equal(r.rowsUsed, 0);
  assert.equal(r.stoufferZ, 0);
  assert.equal(r.stoufferTwoSidedPValue, 1);
});

test('aggregateBrownMoodMedianTrend: skips short tenure', () => {
  const r = aggregateBrownMoodMedianTrend([
    { bmZ: 1.5, bmPValue: 0.13, nTenureDays: 5 },
  ]);
  assert.equal(r.rowsSkipped, 1);
  assert.equal(r.rowsUsed, 0);
});

test('aggregateBrownMoodMedianTrend: combines two signed z values', () => {
  const r = aggregateBrownMoodMedianTrend([
    { bmZ: 2, bmPValue: 0.045, nTenureDays: 20 },
    { bmZ: -1, bmPValue: 0.32, nTenureDays: 40 },
  ]);
  assert.equal(r.rowsUsed, 2);
  // stouffer = (2 + -1)/sqrt(2) = 1/sqrt(2) ~ 0.7071
  assert.ok(Math.abs(r.stoufferZ - 1 / Math.sqrt(2)) < 1e-9);
  // tenure-weighted mean = (20*2 + 40*-1) / 60 = 0
  assert.ok(Math.abs(r.tenureWeightedMeanBmZ - 0) < 1e-9);
});

test('aggregateBrownMoodMedianTrend: skips NaN bmZ', () => {
  const r = aggregateBrownMoodMedianTrend([
    { bmZ: NaN, bmPValue: 0.5, nTenureDays: 30 },
  ]);
  assert.equal(r.rowsSkipped, 1);
});

test('aggregateBrownMoodMedianTrend: skips invalid pvalue', () => {
  const r = aggregateBrownMoodMedianTrend([
    { bmZ: 1, bmPValue: 1.5, nTenureDays: 30 },
    { bmZ: 1, bmPValue: -0.1, nTenureDays: 30 },
  ]);
  assert.equal(r.rowsSkipped, 2);
});

// ----- buildDailyTokenBrownMoodMedianTrend -----

function makeQueue(): QueueLine[] {
  // Two sources, 14 days each.
  const out: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    const day = `2026-04-${String(i + 1).padStart(2, '0')}`;
    out.push({
      hour_start: `${day}T00:00:00.000Z`,
      source: 'sourceA',
      total_tokens: (i + 1) * 100, // up-trend
    } as QueueLine);
    out.push({
      hour_start: `${day}T00:00:00.000Z`,
      source: 'sourceB',
      total_tokens: (14 - i) * 100, // down-trend
    } as QueueLine);
  }
  return out;
}

test('buildDailyTokenBrownMoodMedianTrend: returns rows for both sources', () => {
  const rep = buildDailyTokenBrownMoodMedianTrend(makeQueue(), {
    generatedAt: '2026-05-06T00:00:00.000Z',
    sort: 'source',
  });
  assert.equal(rep.sources.length, 2);
  const a = rep.sources.find((r) => r.source === 'sourceA')!;
  const b = rep.sources.find((r) => r.source === 'sourceB')!;
  assert.ok(a.bmZ < 0, `sourceA bmZ=${a.bmZ}`); // up-trend
  assert.ok(b.bmZ > 0, `sourceB bmZ=${b.bmZ}`); // down-trend
});

test('buildDailyTokenBrownMoodMedianTrend: sort bmZAbsDesc', () => {
  const rep = buildDailyTokenBrownMoodMedianTrend(makeQueue(), {
    generatedAt: '2026-05-06T00:00:00.000Z',
    sort: 'bmZAbsDesc',
  });
  for (let i = 1; i < rep.sources.length; i += 1) {
    assert.ok(
      Math.abs(rep.sources[i - 1]!.bmZ) >= Math.abs(rep.sources[i]!.bmZ),
    );
  }
});

test('buildDailyTokenBrownMoodMedianTrend: source filter', () => {
  const rep = buildDailyTokenBrownMoodMedianTrend(makeQueue(), {
    generatedAt: '2026-05-06T00:00:00.000Z',
    source: 'sourceA',
  });
  assert.equal(rep.sources.length, 1);
  assert.equal(rep.sources[0]!.source, 'sourceA');
});

test('buildDailyTokenBrownMoodMedianTrend: top cap', () => {
  const rep = buildDailyTokenBrownMoodMedianTrend(makeQueue(), {
    generatedAt: '2026-05-06T00:00:00.000Z',
    top: 1,
    sort: 'bmZAbsDesc',
  });
  assert.equal(rep.sources.length, 1);
  assert.equal(rep.droppedTopSources, 1);
});

test('buildDailyTokenBrownMoodMedianTrend: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenBrownMoodMedianTrend([], { minTokens: -1 }),
  );
});

test('buildDailyTokenBrownMoodMedianTrend: rejects minTenureDays < 12', () => {
  assert.throws(() =>
    buildDailyTokenBrownMoodMedianTrend([], { minTenureDays: 5 }),
  );
});

test('buildDailyTokenBrownMoodMedianTrend: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenBrownMoodMedianTrend([], {
      sort: 'bogus' as never,
    }),
  );
});

test('buildDailyTokenBrownMoodMedianTrend: rejects bad since', () => {
  assert.throws(() =>
    buildDailyTokenBrownMoodMedianTrend([], { since: 'not-a-date' }),
  );
});

test('buildDailyTokenBrownMoodMedianTrend: dropped counters track non-positive tokens', () => {
  const q: QueueLine[] = [
    { hour_start: '2026-04-01T00:00:00.000Z', source: 'x', total_tokens: 0 } as QueueLine,
    { hour_start: 'bad-iso', source: 'x', total_tokens: 100 } as QueueLine,
  ];
  const rep = buildDailyTokenBrownMoodMedianTrend(q);
  assert.equal(rep.droppedNonPositiveTokens, 1);
  assert.equal(rep.droppedInvalidHourStart, 1);
});

test('buildDailyTokenBrownMoodMedianTrend: report exposes contingency cells', () => {
  const rep = buildDailyTokenBrownMoodMedianTrend(makeQueue(), {
    generatedAt: '2026-05-06T00:00:00.000Z',
    sort: 'source',
  });
  for (const r of rep.sources) {
    assert.equal(
      r.aFirstAbove + r.bFirstNotAbove + r.cSecondAbove + r.dSecondNotAbove,
      r.nTenureDays,
    );
    assert.equal(r.nFirst + r.nSecond, r.nTenureDays);
  }
});

test('buildDailyTokenBrownMoodMedianTrend: Phi(|bmZ|) consistent with bmChi2', () => {
  const rep = buildDailyTokenBrownMoodMedianTrend(makeQueue(), {
    generatedAt: '2026-05-06T00:00:00.000Z',
    sort: 'source',
  });
  for (const r of rep.sources) {
    assert.ok(
      Math.abs(r.bmChi2 - r.bmZ * r.bmZ) < 1e-9,
      `chi2=${r.bmChi2} z^2=${r.bmZ * r.bmZ}`,
    );
  }
});

test('buildDailyTokenBrownMoodMedianTrend: tie-stable sort by source asc', () => {
  // Construct two sources with identical |bmZ| would be hard; instead just
  // verify that ties on numeric primary fall back to source asc ordering.
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
  const rep = buildDailyTokenBrownMoodMedianTrend(q, {
    generatedAt: '2026-05-06T00:00:00.000Z',
    sort: 'source',
  });
  assert.deepEqual(
    rep.sources.map((r) => r.source),
    ['alpha', 'zebra'],
  );
});

test('buildDailyTokenBrownMoodMedianTrend: tokens sort puts heaviest first', () => {
  // sourceB has 14 + 13 + ... = 105 * 100 = 10500.
  // sourceA has the same total. Build asymmetric:
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
  const rep = buildDailyTokenBrownMoodMedianTrend(q, {
    generatedAt: '2026-05-06T00:00:00.000Z',
    sort: 'tokens',
  });
  assert.equal(rep.sources[0]!.source, 'big');
  assert.equal(rep.sources[1]!.source, 'small');
});

test('buildDailyTokenBrownMoodMedianTrend: minTokens drops below-threshold sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) {
    const day = `2026-04-${String(i + 1).padStart(2, '0')}`;
    q.push({
      hour_start: `${day}T00:00:00.000Z`,
      source: 'tiny',
      total_tokens: 1, // total = 14
    } as QueueLine);
  }
  const rep = buildDailyTokenBrownMoodMedianTrend(q, { minTokens: 1000 });
  assert.equal(rep.sources.length, 0);
  assert.equal(rep.droppedSparseSources, 1);
});
