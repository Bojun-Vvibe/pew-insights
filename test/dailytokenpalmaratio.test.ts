import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenPalmaRatio,
  palmaOfVector,
  lorenzMassAtRank,
} from '../src/dailytokenpalmaratio.js';
import { giniOfVector } from '../src/dailytokenginicoefficient.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-01T00:00:00.000Z';

// ---- lorenzMassAtRank ---------------------------------------------------

test('lorenzMassAtRank: q=0 returns 0', () => {
  assert.equal(lorenzMassAtRank([1, 2, 3, 4, 5], 15, 0), 0);
});

test('lorenzMassAtRank: q=1 returns 1', () => {
  assert.equal(lorenzMassAtRank([1, 2, 3, 4, 5], 15, 1), 1);
});

test('lorenzMassAtRank: empty -> 0', () => {
  assert.equal(lorenzMassAtRank([], 0, 0.5), 0);
});

test('lorenzMassAtRank: zero total -> 0', () => {
  assert.equal(lorenzMassAtRank([0, 0, 0], 0, 0.5), 0);
});

test('lorenzMassAtRank: equal vector at q -> q', () => {
  // 10 days each = 100; bottom 40% should hold 40% of mass.
  const v = Array(10).fill(100);
  assert.ok(Math.abs(lorenzMassAtRank(v, 1000, 0.4) - 0.4) < 1e-12);
  assert.ok(Math.abs(lorenzMassAtRank(v, 1000, 0.9) - 0.9) < 1e-12);
});

test('lorenzMassAtRank: one-day-takes-all -> 0 below top day', () => {
  const v = [0, 0, 0, 0, 100];
  assert.equal(lorenzMassAtRank(v, 100, 0.4), 0);
  assert.equal(lorenzMassAtRank(v, 100, 0.8), 0);
});

test('lorenzMassAtRank: interpolation across non-boundary cut', () => {
  // 5 sorted days [10,20,30,40,50]; total=150. q=0.3 => rankPos=1.5
  // => full day 0 (10) + 0.5 * day 1 (20) = 10 + 10 = 20 / 150.
  const v = [10, 20, 30, 40, 50];
  assert.ok(Math.abs(lorenzMassAtRank(v, 150, 0.3) - 20 / 150) < 1e-12);
});

// ---- palmaOfVector ------------------------------------------------------

test('palmaOfVector: empty -> 0', () => {
  const r = palmaOfVector([]);
  assert.equal(r.palma, 0);
  assert.equal(r.topShare, 0);
});

test('palmaOfVector: singleton -> 0', () => {
  assert.equal(palmaOfVector([42]).palma, 0);
});

test('palmaOfVector: all zeros -> 0', () => {
  assert.equal(palmaOfVector([0, 0, 0, 0]).palma, 0);
});

test('palmaOfVector: perfect equality -> palma = 0.1/0.4 = 0.25', () => {
  // 10 days each = 100 -> top10%=0.1, bot40%=0.4 -> palma = 0.25
  const r = palmaOfVector(Array(10).fill(100));
  assert.ok(Math.abs(r.palma - 0.25) < 1e-12);
  assert.ok(Math.abs(r.topShare - 0.1) < 1e-12);
  assert.ok(Math.abs(r.bottomShare - 0.4) < 1e-12);
});

test('palmaOfVector: one-day-takes-all -> +Inf', () => {
  const v = [0, 0, 0, 0, 0, 0, 0, 0, 0, 100];
  const r = palmaOfVector(v);
  assert.ok(r.bottomZero, 'bottomShare should be zero');
  assert.equal(r.palma, Number.POSITIVE_INFINITY);
});

test('palmaOfVector: interpolatedCutoffs false on n=10 default cuts', () => {
  // n=10, q=0.4 => 4 (boundary), q=0.9 => 9 (boundary). No interp.
  const r = palmaOfVector(Array(10).fill(100));
  assert.equal(r.interpolatedCutoffs, false);
});

test('palmaOfVector: interpolatedCutoffs true on n=5', () => {
  // n=5, q=0.4 => 2 (boundary), q=0.9 => 4.5 (NOT boundary).
  const r = palmaOfVector([1, 2, 3, 4, 5]);
  assert.equal(r.interpolatedCutoffs, true);
});

test('palmaOfVector: shares sum to 1 (with middle)', () => {
  const r = palmaOfVector([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const sum = r.topShare + r.middleShare + r.bottomShare;
  assert.ok(Math.abs(sum - 1) < 1e-12, `shares sum to ${sum}`);
});

test('palmaOfVector: monotone increasing transfers raise palma', () => {
  const baseline = palmaOfVector([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
  const skewed = palmaOfVector([1, 1, 1, 1, 1, 1, 1, 1, 1, 100]);
  assert.ok(skewed.palma > baseline.palma);
});

test('palmaOfVector: throws on negative', () => {
  assert.throws(() => palmaOfVector([1, -2, 3]));
});

test('palmaOfVector: throws on non-finite', () => {
  assert.throws(() => palmaOfVector([1, Number.POSITIVE_INFINITY, 3]));
});

test('palmaOfVector: throws on invalid topQ', () => {
  assert.throws(() => palmaOfVector([1, 2], 0));
  assert.throws(() => palmaOfVector([1, 2], 1));
  assert.throws(() => palmaOfVector([1, 2], -0.5));
});

test('palmaOfVector: throws on invalid bottomQ', () => {
  assert.throws(() => palmaOfVector([1, 2], 0.9, 0));
  assert.throws(() => palmaOfVector([1, 2], 0.9, 1));
});

test('palmaOfVector: throws when bottomQ >= topQ', () => {
  assert.throws(() => palmaOfVector([1, 2, 3], 0.4, 0.4));
  assert.throws(() => palmaOfVector([1, 2, 3], 0.3, 0.5));
});

test('palmaOfVector: 20-20 ratio with custom cutoffs', () => {
  // (top 20% / bottom 20%) on equal vector = 1.
  const r = palmaOfVector(Array(10).fill(100), 0.8, 0.2);
  assert.ok(Math.abs(r.palma - 1) < 1e-12);
});

test('palmaOfVector: P95-P5 interquantile spread', () => {
  const r = palmaOfVector(Array(20).fill(100), 0.95, 0.05);
  assert.ok(Math.abs(r.palma - 1) < 1e-12);
});

// ---- buildDailyTokenPalmaRatio: scenarios ------------------------------

test('builder: empty queue -> empty sources', () => {
  const r = buildDailyTokenPalmaRatio([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('builder: single source basic palma', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'a', 100));
  }
  const r = buildDailyTokenPalmaRatio(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'a');
  assert.equal(row.nDays, 10);
  assert.ok(Math.abs(row.palma - 0.25) < 1e-12);
});

test('builder: respects min-tokens floor', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 10),
    ql('2026-04-02T00:00:00Z', 'a', 10),
  ];
  const r = buildDailyTokenPalmaRatio(q, {
    minTokens: 1000,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('builder: respects min-days floor', () => {
  const q: QueueLine[] = [ql('2026-04-01T00:00:00Z', 'a', 10000)];
  const r = buildDailyTokenPalmaRatio(q, {
    minTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinDays, 1);
});

test('builder: rejects minDays < 2', () => {
  assert.throws(() =>
    buildDailyTokenPalmaRatio([], { minDays: 1, generatedAt: GEN }),
  );
});

test('builder: rejects negative minTokens', () => {
  assert.throws(() =>
    buildDailyTokenPalmaRatio([], { minTokens: -1, generatedAt: GEN }),
  );
});

test('builder: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenPalmaRatio([], {
      sort: 'bogus' as never,
      generatedAt: GEN,
    }),
  );
});

test('builder: rejects bad quantiles', () => {
  assert.throws(() =>
    buildDailyTokenPalmaRatio([], { topQuantile: 1.5, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenPalmaRatio([], { bottomQuantile: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenPalmaRatio([], {
      topQuantile: 0.4,
      bottomQuantile: 0.5,
      generatedAt: GEN,
    }),
  );
});

test('builder: source filter narrows results', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 10000),
    ql('2026-04-02T00:00:00Z', 'a', 20000),
    ql('2026-04-01T00:00:00Z', 'b', 5000),
    ql('2026-04-02T00:00:00Z', 'b', 5000),
  ];
  const r = buildDailyTokenPalmaRatio(q, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 2);
});

test('builder: since/until window filter', () => {
  const q: QueueLine[] = [
    ql('2026-03-15T00:00:00Z', 'a', 10000),
    ql('2026-04-01T00:00:00Z', 'a', 10000),
    ql('2026-04-15T00:00:00Z', 'a', 10000),
  ];
  const r = buildDailyTokenPalmaRatio(q, {
    since: '2026-04-01T00:00:00Z',
    until: '2026-04-10T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinDays, 1);
});

test('builder: rejects invalid since', () => {
  assert.throws(() =>
    buildDailyTokenPalmaRatio([], { since: 'not-a-date', generatedAt: GEN }),
  );
});

test('builder: drops invalid hour_start', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'a', 10000),
    ql('2026-04-01T00:00:00Z', 'a', 10000),
    ql('2026-04-02T00:00:00Z', 'a', 10000),
  ];
  const r = buildDailyTokenPalmaRatio(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('builder: drops non-positive tokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 0),
    ql('2026-04-02T00:00:00Z', 'a', 10000),
    ql('2026-04-03T00:00:00Z', 'a', 10000),
  ];
  const r = buildDailyTokenPalmaRatio(q, { generatedAt: GEN });
  assert.equal(r.droppedNonPositiveTokens, 1);
});

test('builder: top cap applied after sort', () => {
  const q: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    q.push(ql('2026-04-01T00:00:00Z', s, 10000));
    q.push(ql('2026-04-02T00:00:00Z', s, 10000));
  }
  const r = buildDailyTokenPalmaRatio(q, { top: 2, generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('builder: minPalma display filter', () => {
  const q: QueueLine[] = [];
  // source a: skewed -> high palma
  for (let i = 0; i < 9; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'a', 1));
  }
  q.push(ql('2026-04-10T00:00:00Z', 'a', 100000));
  // source b: equal -> palma 0.25
  for (let i = 0; i < 10; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'b', 1000));
  }
  const r = buildDailyTokenPalmaRatio(q, {
    minPalma: 1,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinPalma, 1);
});

test('builder: palmaOverGini computed and finite for normal source', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'a', (i + 1) * 1000));
  }
  const r = buildDailyTokenPalmaRatio(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(Number.isFinite(row.palmaOverGini));
  assert.ok(row.palmaOverGini > 0);
});

test('builder: palmaOverGini = NaN for perfect equality', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'a', 1000));
  }
  const r = buildDailyTokenPalmaRatio(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.gini, 0);
  assert.ok(Number.isNaN(row.palmaOverGini));
});

test('builder: gini cross-anchor matches direct giniOfVector', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'a', (i + 1) * 100));
  }
  const r = buildDailyTokenPalmaRatio(q, { generatedAt: GEN });
  const direct = giniOfVector([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
  assert.ok(Math.abs(r.sources[0]!.gini - direct) < 1e-12);
});

test('builder: sort by tokens', () => {
  const q: QueueLine[] = [];
  q.push(ql('2026-04-01T00:00:00Z', 'low', 100));
  q.push(ql('2026-04-02T00:00:00Z', 'low', 100));
  q.push(ql('2026-04-01T00:00:00Z', 'high', 1000000));
  q.push(ql('2026-04-02T00:00:00Z', 'high', 1000000));
  const r = buildDailyTokenPalmaRatio(q, {
    minTokens: 0,
    sort: 'tokens',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'high');
});

test('builder: sort by source name (alpha)', () => {
  const q: QueueLine[] = [];
  for (const s of ['z', 'a', 'm']) {
    q.push(ql('2026-04-01T00:00:00Z', s, 10000));
    q.push(ql('2026-04-02T00:00:00Z', s, 10000));
  }
  const r = buildDailyTokenPalmaRatio(q, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'm', 'z'],
  );
});

test('builder: sort by palmaOverGini handles NaN tie last', () => {
  const q: QueueLine[] = [];
  // equal -> NaN palmaOverGini
  for (let i = 0; i < 10; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'eq', 1000));
  }
  // skewed -> finite palmaOverGini
  for (let i = 0; i < 9; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'sk', 1));
  }
  q.push(ql('2026-04-10T00:00:00Z', 'sk', 5000));
  const r = buildDailyTokenPalmaRatio(q, {
    sort: 'palmaOverGini',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'sk');
  assert.equal(r.sources[1]!.source, 'eq');
});

test('builder: configurable cutoffs surface in report', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'a', 1000));
  }
  const r = buildDailyTokenPalmaRatio(q, {
    topQuantile: 0.8,
    bottomQuantile: 0.2,
    generatedAt: GEN,
  });
  assert.equal(r.topQuantile, 0.8);
  assert.equal(r.bottomQuantile, 0.2);
  assert.ok(Math.abs(r.sources[0]!.palma - 1) < 1e-12);
});

test('builder: middleShare derivable from top+bottom', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'a', (i + 1) * 100));
  }
  const r = buildDailyTokenPalmaRatio(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(
    Math.abs(row.middleShare - (1 - row.topShare - row.bottomShare)) < 1e-12,
  );
});

test('builder: maxDay and minDay surface correctly', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 100),
    ql('2026-04-02T00:00:00Z', 'a', 999999),
    ql('2026-04-03T00:00:00Z', 'a', 50),
  ];
  const r = buildDailyTokenPalmaRatio(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.maxDay, '2026-04-02');
  assert.equal(row.minDay, '2026-04-03');
});

test('builder: ascending Lorenz monotonicity holds for all rows', () => {
  // For any non-negative vector, topShare >= 1 - topQ on average doesn't
  // hold; but topShare + middleShare + bottomShare = 1 and all >= 0.
  const q: QueueLine[] = [];
  const sources = ['a', 'b', 'c', 'd'];
  for (const s of sources) {
    for (let i = 0; i < 10; i += 1) {
      const v = Math.floor(1000 * (1 + Math.sin(i + s.charCodeAt(0))));
      q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, s, v + 1));
    }
  }
  const r = buildDailyTokenPalmaRatio(q, { generatedAt: GEN });
  for (const row of r.sources) {
    assert.ok(row.topShare >= 0 && row.topShare <= 1);
    assert.ok(row.bottomShare >= 0 && row.bottomShare <= 1);
    assert.ok(row.middleShare >= 0 && row.middleShare <= 1);
    assert.ok(
      Math.abs(row.topShare + row.middleShare + row.bottomShare - 1) < 1e-9,
    );
  }
});

test('builder: report carries window bounds in echo', () => {
  const r = buildDailyTokenPalmaRatio([], {
    since: '2026-01-01T00:00:00Z',
    until: '2026-12-31T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.windowStart, '2026-01-01T00:00:00Z');
  assert.equal(r.windowEnd, '2026-12-31T00:00:00Z');
});

test('builder: emitted columns include rank-cutoff diagnostics', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'a', (i + 1) * 100));
  }
  const r = buildDailyTokenPalmaRatio(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok('palma' in row);
  assert.ok('topShare' in row);
  assert.ok('middleShare' in row);
  assert.ok('bottomShare' in row);
  assert.ok('gini' in row);
  assert.ok('palmaOverGini' in row);
  assert.ok('bottomZero' in row);
  assert.ok('interpolatedCutoffs' in row);
});

test('builder: zero-mass days surface in nZeroDays', () => {
  // Cannot inject zero via valid queue (filtered as non-positive), but
  // if a day's mass is later zeroed via filter logic, nZeroDays is 0
  // here by construction. Sanity: nZeroDays = 0 for normal data.
  const q: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'a', 100));
  }
  const r = buildDailyTokenPalmaRatio(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.nZeroDays, 0);
});
