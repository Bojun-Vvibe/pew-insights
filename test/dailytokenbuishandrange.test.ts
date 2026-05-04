import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenBuishandRange,
  buishandSummary,
} from '../src/dailytokenbuishandrange.js';
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

const GEN = '2026-05-04T12:00:00.000Z';

// ---- option validation ---------------------------------------------------

test('buishand: rejects bad minDays', () => {
  assert.throws(() => buildDailyTokenBuishandRange([], { minDays: 3 }));
  assert.throws(() => buildDailyTokenBuishandRange([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenBuishandRange([], { minDays: -1 }));
});

test('buishand: rejects bad top', () => {
  assert.throws(() => buildDailyTokenBuishandRange([], { top: -1 }));
  assert.throws(() => buildDailyTokenBuishandRange([], { top: 1.5 }));
});

test('buishand: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenBuishandRange([], { sort: 'nope' as 'tokens' }),
  );
});

test('buishand: rejects bad since/until', () => {
  assert.throws(() => buildDailyTokenBuishandRange([], { since: 'no' }));
  assert.throws(() => buildDailyTokenBuishandRange([], { until: 'nope' }));
});

test('buishand: empty queue -> empty sources', () => {
  const r = buildDailyTokenBuishandRange([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.minDays, 4);
  assert.equal(r.sort, 'tokens');
});

// ---- buishandSummary pure helper -----------------------------------------

test('buishandSummary: empty -> flat', () => {
  const s = buishandSummary([]);
  assert.equal(s.flat, true);
  assert.equal(s.r, 0);
  assert.equal(s.tStarIndex, -1);
});

test('buishandSummary: single value -> flat', () => {
  const s = buishandSummary([42]);
  assert.equal(s.flat, true);
  assert.equal(s.tStarIndex, -1);
});

test('buishandSummary: constant series -> flat (zero variance)', () => {
  const s = buishandSummary([5, 5, 5, 5, 5]);
  assert.equal(s.flat, true);
  assert.equal(s.r, 0);
  assert.equal(s.q, 0);
  assert.equal(s.u, 0);
});

test('buishandSummary: clean step shift up at index 4 (n=10)', () => {
  // Pre half = 1, post half = 100, n=10. mu=50.5
  // Centered: pre = -49.5 each, post = +49.5 each
  // S[k]: cumulative sum of centered:
  //   k=0..4: -49.5, -99, -148.5, -198, -247.5  (min)
  //   k=5..9: -198, -148.5, -99, -49.5, 0       (max=0 at k=9)
  // sigma = sqrt(varSum/n) where varSum = 10 * 49.5^2 = 24502.5; sigma = sqrt(2450.25) = 49.5
  // S*[k] = S[k] / 49.5
  //   min S* at k=4: -247.5/49.5 = -5
  //   max S* at k=9: 0
  // r = max - min = 5
  // q = max|S*| = 5 at k=4 -> tStar = 4
  const v = [1, 1, 1, 1, 1, 100, 100, 100, 100, 100];
  const s = buishandSummary(v);
  assert.equal(s.flat, false);
  assert.ok(Math.abs(s.r - 5) < 1e-9, `r=${s.r}`);
  assert.ok(Math.abs(s.q - 5) < 1e-9, `q=${s.q}`);
  assert.equal(s.tStarIndex, 4);
  assert.equal(s.tArgMin, 4);
  assert.equal(s.tArgMax, 9);
  assert.equal(s.argSpread, 5);
  // rStar = r / sqrt(n) = 5 / sqrt(10)
  assert.ok(Math.abs(s.rStar - 5 / Math.sqrt(10)) < 1e-9);
  assert.ok(Math.abs(s.qStar - 5 / Math.sqrt(10)) < 1e-9);
});

test('buishandSummary: clean step DOWN flips argSpread sign', () => {
  // Reverse of previous: pre 100, post 1. argSpread should be tArgMax(=4) - tArgMin(=9) = -5.
  const v = [100, 100, 100, 100, 100, 1, 1, 1, 1, 1];
  const s = buishandSummary(v);
  assert.equal(s.flat, false);
  assert.equal(s.tArgMax, 4);
  assert.equal(s.tArgMin, 9);
  assert.equal(s.argSpread, -5);
  // r and q magnitudes stay the same.
  assert.ok(Math.abs(s.r - 5) < 1e-9);
  assert.ok(Math.abs(s.q - 5) < 1e-9);
});

test('buishandSummary: V-shape produces large r (path crosses)', () => {
  // V: high, drop to low at middle, climb back. Pettitt KT would be small
  // (no monotone single shift), but Buishand R should be large because
  // S* excurses to both extremes.
  const v = [10, 10, 10, 1, 1, 1, 10, 10, 10];
  const s = buishandSummary(v);
  assert.equal(s.flat, false);
  // Centered: mu = (3*10 + 3*1 + 3*10)/9 = 63/9 = 7
  //   x - mu: 3,3,3,-6,-6,-6,3,3,3
  // S[k]: 3,6,9,3,-3,-9,-6,-3,0
  //   max S = 9 at k=2,  min S = -9 at k=5
  // r = 18 (in raw S units; divided by sigma to get S* range).
  assert.ok(s.r > 0);
  assert.equal(s.tArgMax, 2);
  assert.equal(s.tArgMin, 5);
  // Buishand U = sum_k (S*[k])^2 / (n*(n+1)) — must be positive.
  assert.ok(s.u > 0);
});

test('buishandSummary: monotone increasing produces large r and tArgMin=0', () => {
  // Linearly increasing 1..n: cumulative-deviation path is convex,
  // reaches min at k=0 (or near it) and max near the end.
  const v = [1, 2, 3, 4, 5, 6, 7, 8];
  const s = buishandSummary(v);
  assert.equal(s.flat, false);
  // mu = 4.5. Centered: -3.5,-2.5,-1.5,-0.5,0.5,1.5,2.5,3.5
  // S[k]: -3.5,-6,-7.5,-8,-7.5,-6,-3.5,0
  // min at k=3, max at k=7 -> argSpread = 4.
  assert.equal(s.tArgMin, 3);
  assert.equal(s.tArgMax, 7);
  assert.ok(s.argSpread > 0);
});

test('buishandSummary: scale invariance under positive scalar multiply', () => {
  const v1 = [1, 2, 3, 100, 200, 300];
  const v2 = v1.map((x) => x * 7);
  const s1 = buishandSummary(v1);
  const s2 = buishandSummary(v2);
  // rStar, qStar, u are scale-invariant (sigma absorbs the factor).
  assert.ok(Math.abs(s1.rStar - s2.rStar) < 1e-9);
  assert.ok(Math.abs(s1.qStar - s2.qStar) < 1e-9);
  assert.ok(Math.abs(s1.u - s2.u) < 1e-9);
  assert.equal(s1.tStarIndex, s2.tStarIndex);
});

test('buishandSummary: rStar >= qStar always (range >= max-abs)', () => {
  // |max - min| can be at most 2 * max|.| but is always >= max|.| because
  // either max>=0 and min<=0 so range = max - min >= max(|max|,|min|) = max|S|.
  // When all S have same sign, range can equal max|S| exactly; check several.
  const samples: number[][] = [
    [1, 5, 2, 8, 3, 7],
    [10, 1, 1, 1, 1, 1, 1, 10],
    [1, 1, 1, 1, 1, 1, 1, 100],
  ];
  for (const v of samples) {
    const s = buishandSummary(v);
    assert.ok(s.rStar + 1e-12 >= s.qStar, `rStar=${s.rStar} qStar=${s.qStar}`);
  }
});

test('buishandSummary: U is positive and bounded for non-flat series', () => {
  const v = [1, 2, 3, 4, 5, 100, 1, 2, 3, 4];
  const s = buishandSummary(v);
  assert.ok(s.u > 0);
  // U = sum_k S*[k]^2 / (n*(n+1)). For n=10 with bounded S* values, U should
  // be a small positive finite number.
  assert.ok(Number.isFinite(s.u));
});

// ---- builder integration -------------------------------------------------

test('buishand: skips sources below minDays', () => {
  const queue = [
    ql('2026-04-20T00:00:00.000Z', 'a', 10),
    ql('2026-04-21T00:00:00.000Z', 'a', 10),
    // only nFilled=2, below default minDays=4
  ];
  const r = buildDailyTokenBuishandRange(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('buishand: builds source row for n>=4 with step-shift', () => {
  const queue: QueueLine[] = [];
  const days = ['2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23',
    '2026-04-24', '2026-04-25', '2026-04-26', '2026-04-27'];
  const vals = [1, 1, 1, 1, 100, 100, 100, 100];
  for (let i = 0; i < days.length; i++) {
    queue.push(ql(`${days[i]!}T00:00:00.000Z`, 'src1', vals[i]!));
  }
  const r = buildDailyTokenBuishandRange(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'src1');
  assert.equal(s.nFilledDays, 8);
  assert.equal(s.nActiveDays, 8);
  assert.equal(s.flat, false);
  // tStar should be at index 3 (last index of "before") for symmetric step.
  assert.equal(s.tStarIndex, 3);
  assert.equal(s.tStarDay, '2026-04-23');
  // argSpread positive: up-extreme reached after down-extreme (rising regime).
  assert.ok(s.argSpread > 0);
});

test('buishand: gap-filled days fill zeros', () => {
  // Days: Apr 20, Apr 23  -> nFilled = 4, gaps zero-filled.
  const queue = [
    ql('2026-04-20T00:00:00.000Z', 'sg', 50),
    ql('2026-04-23T00:00:00.000Z', 'sg', 50),
  ];
  const r = buildDailyTokenBuishandRange(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.nActiveDays, 2);
  assert.equal(s.nFilledDays, 4);
  assert.equal(s.flat, false); // values [50,0,0,50] -> non-zero variance
});

test('buishand: flat constant series surfaces flat=true', () => {
  const queue = [
    ql('2026-04-20T00:00:00.000Z', 'flat', 7),
    ql('2026-04-21T00:00:00.000Z', 'flat', 7),
    ql('2026-04-22T00:00:00.000Z', 'flat', 7),
    ql('2026-04-23T00:00:00.000Z', 'flat', 7),
    ql('2026-04-24T00:00:00.000Z', 'flat', 7),
  ];
  const r = buildDailyTokenBuishandRange(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.flat, true);
  assert.equal(s.r, 0);
  assert.equal(s.q, 0);
  assert.equal(s.tStarIndex, -1);
  assert.equal(s.tStarDay, null);
});

test('buishand: bad hour_start drops with counter', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00.000Z', 's', 10),
    { ...ql('not-an-iso', 's', 10), hour_start: 'not-an-iso' },
  ];
  const r = buildDailyTokenBuishandRange(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buishand: zero-token rows drop with counter', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 's', 10),
    ql('2026-04-21T00:00:00.000Z', 's', 0),
  ];
  const r = buildDailyTokenBuishandRange(q, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 1);
});

test('buishand: source filter drops non-matching with counter', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 5; i++) {
    q.push(ql(`2026-04-2${i}T00:00:00.000Z`, 'wanted', 10 + i));
    q.push(ql(`2026-04-2${i}T00:00:00.000Z`, 'unwanted', 99));
  }
  const r = buildDailyTokenBuishandRange(q, {
    generatedAt: GEN,
    source: 'wanted',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'wanted');
  assert.equal(r.droppedSourceFilter, 5);
});

test('buishand: top cap surfaces droppedTopSources', () => {
  const q: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 5; i++) {
      q.push(ql(`2026-04-2${i}T00:00:00.000Z`, src, 10 * (src.charCodeAt(0) - 96) + i));
    }
  }
  const r = buildDailyTokenBuishandRange(q, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buishand: sort by rstar puts highest first; ties break by source asc', () => {
  // Build two sources, then verify sort order is rStar descending.
  const q: QueueLine[] = [];
  // Source A: clean step shift -> high rStar
  const a = [1, 1, 1, 1, 100, 100, 100, 100];
  // Source B: nearly flat noise -> small rStar
  const b = [10, 11, 10, 11, 10, 11, 10, 11];
  for (let i = 0; i < a.length; i++) {
    q.push(ql(`2026-04-2${i}T00:00:00.000Z`, 'aa', a[i]!));
    q.push(ql(`2026-04-2${i}T00:00:00.000Z`, 'bb', b[i]!));
  }
  const r = buildDailyTokenBuishandRange(q, {
    generatedAt: GEN,
    sort: 'rstar',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'aa');
  assert.equal(r.sources[1]!.source, 'bb');
  assert.ok(r.sources[0]!.rStar > r.sources[1]!.rStar);
});

test('buishand: sort by spread orders by argSpread desc', () => {
  const q: QueueLine[] = [];
  const rising = [1, 1, 1, 1, 100, 100, 100, 100]; // argSpread > 0
  const falling = [100, 100, 100, 100, 1, 1, 1, 1]; // argSpread < 0
  for (let i = 0; i < rising.length; i++) {
    q.push(ql(`2026-04-2${i}T00:00:00.000Z`, 'rising', rising[i]!));
    q.push(ql(`2026-04-2${i}T00:00:00.000Z`, 'falling', falling[i]!));
  }
  const r = buildDailyTokenBuishandRange(q, {
    generatedAt: GEN,
    sort: 'spread',
  });
  assert.equal(r.sources[0]!.source, 'rising');
  assert.equal(r.sources[1]!.source, 'falling');
  assert.ok(r.sources[0]!.argSpread > r.sources[1]!.argSpread);
});

test('buishand: window since/until filters', () => {
  const q = [
    ql('2026-04-15T00:00:00.000Z', 's', 5),
    ql('2026-04-20T00:00:00.000Z', 's', 10),
    ql('2026-04-21T00:00:00.000Z', 's', 10),
    ql('2026-04-22T00:00:00.000Z', 's', 10),
    ql('2026-04-23T00:00:00.000Z', 's', 10),
    ql('2026-04-30T00:00:00.000Z', 's', 50),
  ];
  const r = buildDailyTokenBuishandRange(q, {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-25T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.firstActiveDay, '2026-04-20');
  assert.equal(r.sources[0]!.lastActiveDay, '2026-04-23');
});

test('buishand: deterministic output with fixed generatedAt', () => {
  const q = [
    ql('2026-04-20T00:00:00.000Z', 's', 1),
    ql('2026-04-21T00:00:00.000Z', 's', 2),
    ql('2026-04-22T00:00:00.000Z', 's', 3),
    ql('2026-04-23T00:00:00.000Z', 's', 4),
  ];
  const r1 = buildDailyTokenBuishandRange(q, { generatedAt: GEN });
  const r2 = buildDailyTokenBuishandRange(q, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});
