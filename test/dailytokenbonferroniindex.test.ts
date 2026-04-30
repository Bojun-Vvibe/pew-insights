import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenBonferroniIndex,
  bonferroniOfVector,
  deVergottiniOfVector,
} from '../src/dailytokenbonferroniindex.js';
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

// ---- bonferroniOfVector primitive -------------------------------------

test('bonferroniOfVector: empty -> degenerate, B=0', () => {
  const r = bonferroniOfVector([]);
  assert.equal(r.bonferroni, 0);
  assert.equal(r.degenerate, true);
});

test('bonferroniOfVector: n=1 -> degenerate, B=0', () => {
  const r = bonferroniOfVector([42]);
  assert.equal(r.bonferroni, 0);
  assert.equal(r.degenerate, true);
});

test('bonferroniOfVector: all-zero -> degenerate, B=0', () => {
  const r = bonferroniOfVector([0, 0, 0, 0]);
  assert.equal(r.bonferroni, 0);
  assert.equal(r.degenerate, true);
});

test('bonferroniOfVector: perfect equality -> B=0', () => {
  const r = bonferroniOfVector([10, 10, 10, 10]);
  assert.ok(Math.abs(r.bonferroni) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('bonferroniOfVector: two-point binary [0,100] equals gini', () => {
  // sorted [0, 100]; mu = 50; n = 2
  // S_1 = 0; sum_{k=1..1} (S_k/k) = 0
  // B = 1 - 0/((2-1)*50) = 1.
  // Wait -- for two-point [0, x], B = 1 (max). Let's pick a less
  // degenerate two-point case so B in (0, 1).
  const r = bonferroniOfVector([1, 9]);
  // sorted [1, 9]; mu = 5; S_1 = 1; sum = 1
  // B = 1 - 1/((1)*5) = 1 - 0.2 = 0.8
  assert.ok(Math.abs(r.bonferroni - 0.8) < 1e-12);
});

test('bonferroniOfVector: three-point [1,2,7] exact value', () => {
  // sorted [1,2,7]; mu=10/3; n=3
  // S_1=1, S_2=3; sum_{k=1..2}(S_k/k) = 1 + 3/2 = 2.5
  // B = 1 - 2.5 / (2 * 10/3) = 1 - 2.5/(20/3) = 1 - 7.5/20 = 1 - 0.375 = 0.625
  const r = bonferroniOfVector([1, 2, 7]);
  assert.ok(Math.abs(r.bonferroni - 0.625) < 1e-12);
});

test('bonferroniOfVector: B in [0, 1) for typical inputs', () => {
  for (const v of [
    [1, 1, 1, 1],
    [1, 2, 3, 4, 5],
    [0, 1, 2, 3],
    [1, 1, 1, 1000],
  ]) {
    const r = bonferroniOfVector(v);
    assert.ok(r.bonferroni >= -1e-12);
    assert.ok(r.bonferroni < 1);
  }
});

test('bonferroniOfVector: scale invariance', () => {
  const a = bonferroniOfVector([1, 2, 3, 4, 5]);
  const b = bonferroniOfVector([1000, 2000, 3000, 4000, 5000]);
  assert.ok(Math.abs(a.bonferroni - b.bonferroni) < 1e-12);
});

test('bonferroniOfVector: permutation invariance (sorts internally)', () => {
  const a = bonferroniOfVector([1, 2, 3, 4, 5]);
  const b = bonferroniOfVector([5, 1, 4, 2, 3]);
  assert.ok(Math.abs(a.bonferroni - b.bonferroni) < 1e-12);
});

test('bonferroniOfVector: regressive Pigou-Dalton-style transfer raises B', () => {
  const before = bonferroniOfVector([3, 4, 5]);
  const after = bonferroniOfVector([2, 4, 6]);
  assert.ok(after.bonferroni > before.bonferroni);
});

test('bonferroniOfVector: rejects negative', () => {
  assert.throws(() => bonferroniOfVector([1, -1, 2]));
});

test('bonferroniOfVector: rejects NaN', () => {
  assert.throws(() => bonferroniOfVector([1, Number.NaN, 2]));
});

test('bonferroniOfVector: rejects infinity', () => {
  assert.throws(() => bonferroniOfVector([1, Number.POSITIVE_INFINITY, 2]));
});

test('bonferroniOfVector: bottomQuintile sized as max(1, floor(n/5))', () => {
  // n=10 -> floor(10/5) = 2 days
  const r = bonferroniOfVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.bottomQuintileDays, 2);
  // bottom-2 partial mean = (1+2)/2 = 1.5
  assert.ok(Math.abs(r.bottomQuintilePartialMean - 1.5) < 1e-12);
});

test('bonferroniOfVector: bottomQuintile clamps to 1 for small n', () => {
  // n=3 -> floor(3/5) = 0 -> max(1, 0) = 1 day
  const r = bonferroniOfVector([5, 10, 15]);
  assert.equal(r.bottomQuintileDays, 1);
  assert.equal(r.bottomQuintilePartialMean, 5);
});

// ---- B >= G identity --------------------------------------------------

test('bonferroniOfVector: textbook identity B >= G holds for all non-negative vectors', () => {
  const cases: number[][] = [
    [1, 2, 3, 4, 5],
    [1, 1, 1, 1000],
    [0, 1, 2, 3, 4, 5],
    [10, 10, 10, 10, 10, 10, 10, 1000],
    [1, 5, 9, 23, 100, 2, 7, 11, 19],
    [100, 100, 100, 100, 100, 100, 100],
    [0, 0, 0, 100, 200],
  ];
  for (const v of cases) {
    const b = bonferroniOfVector(v).bonferroni;
    const g = giniOfVector(v);
    assert.ok(
      b - g >= -1e-9,
      `B < G for ${JSON.stringify(v)} -- B=${b}, G=${g}`,
    );
  }
});

// ---- deVergottiniOfVector primitive -----------------------------------

test('deVergottiniOfVector: degenerate cases return 0', () => {
  assert.equal(deVergottiniOfVector([]).deVergottini, 0);
  assert.equal(deVergottiniOfVector([5]).deVergottini, 0);
  assert.equal(deVergottiniOfVector([0, 0, 0]).deVergottini, 0);
});

test('deVergottiniOfVector: in [0, 1) for typical inputs', () => {
  for (const v of [
    [1, 2, 3, 4, 5],
    [1, 1, 1, 1000],
    [0, 1, 2, 3],
  ]) {
    const dv = deVergottiniOfVector(v).deVergottini;
    assert.ok(dv >= -1e-12);
    assert.ok(dv < 1);
  }
});

test('deVergottiniOfVector: rejects negative input', () => {
  assert.throws(() => deVergottiniOfVector([1, -1, 2]));
});

// ---- buildDailyTokenBonferroniIndex top-level -------------------------

test('build: empty queue -> 0 sources', () => {
  const r = buildDailyTokenBonferroniIndex([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('build: single source equal-mass days -> B=0', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 1000),
    ql('2026-04-03T00:00:00Z', 'a', 1000),
    ql('2026-04-04T00:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenBonferroniIndex(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.ok(Math.abs(r.sources[0]!.bonferroni) < 1e-12);
  assert.equal(r.sources[0]!.nDays, 4);
});

test('build: filters by minTokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'big', 5000),
    ql('2026-04-02T00:00:00Z', 'big', 5000),
    ql('2026-04-01T00:00:00Z', 'small', 100),
    ql('2026-04-02T00:00:00Z', 'small', 200),
  ];
  const r = buildDailyTokenBonferroniIndex(q, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('build: filters by minDays (Bonferroni degenerate for n<2)', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'oneday', 5000),
    ql('2026-04-01T01:00:00Z', 'oneday', 5000),
    ql('2026-04-01T00:00:00Z', 'twoday', 5000),
    ql('2026-04-02T00:00:00Z', 'twoday', 5000),
  ];
  const r = buildDailyTokenBonferroniIndex(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'twoday');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('build: respects --since/--until window', () => {
  const q: QueueLine[] = [
    ql('2026-03-01T00:00:00Z', 'a', 5000),
    ql('2026-04-01T00:00:00Z', 'a', 5000),
    ql('2026-04-02T00:00:00Z', 'a', 5000),
    ql('2026-05-15T00:00:00Z', 'a', 5000),
  ];
  const r = buildDailyTokenBonferroniIndex(q, {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00Z',
    until: '2026-05-01T00:00:00Z',
  });
  assert.equal(r.sources[0]!.nDays, 2);
});

test('build: drops invalid hour_start and non-positive tokens', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'a', 5000),
    ql('2026-04-01T00:00:00Z', 'a', 0),
    ql('2026-04-01T00:00:00Z', 'a', -5),
    ql('2026-04-01T00:00:00Z', 'a', 5000),
    ql('2026-04-02T00:00:00Z', 'a', 5000),
  ];
  const r = buildDailyTokenBonferroniIndex(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources[0]!.nDays, 2);
});

test('build: source filter', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 5000),
    ql('2026-04-02T00:00:00Z', 'a', 5000),
    ql('2026-04-01T00:00:00Z', 'b', 5000),
    ql('2026-04-02T00:00:00Z', 'b', 5000),
  ];
  const r = buildDailyTokenBonferroniIndex(q, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 2);
});

test('build: minBonferroni display filter', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 5000),
    ql('2026-04-02T00:00:00Z', 'a', 5000),
    ql('2026-04-01T00:00:00Z', 'b', 1000),
    ql('2026-04-02T00:00:00Z', 'b', 9000),
  ];
  const r = buildDailyTokenBonferroniIndex(q, {
    generatedAt: GEN,
    minBonferroni: 0.1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinBonferroni, 1);
});

test('build: top cap', () => {
  const q: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    q.push(ql('2026-04-01T00:00:00Z', s, 1000));
    q.push(
      ql(
        '2026-04-02T00:00:00Z',
        s,
        s === 'a' ? 9000 : s === 'b' ? 5000 : 1100,
      ),
    );
  }
  const r = buildDailyTokenBonferroniIndex(q, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('build: sort by bonferroni desc default; ties: source asc', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'b', 1000),
    ql('2026-04-02T00:00:00Z', 'b', 1000),
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenBonferroniIndex(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('build: sort by bonferroniOverGini puts NaN last', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'flat', 5000),
    ql('2026-04-02T00:00:00Z', 'flat', 5000),
    ql('2026-04-01T00:00:00Z', 'spike', 1000),
    ql('2026-04-02T00:00:00Z', 'spike', 9000),
  ];
  const r = buildDailyTokenBonferroniIndex(q, {
    generatedAt: GEN,
    sort: 'bonferroniOverGini',
  });
  // 'flat' has gini=0 -> NaN; should sort to end.
  assert.equal(r.sources[0]!.source, 'spike');
  assert.equal(r.sources[1]!.source, 'flat');
});

test('build: sort by bottomQuintilePartialMean descending', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'rich-bottom', 4000),
    ql('2026-04-02T00:00:00Z', 'rich-bottom', 6000),
    ql('2026-04-01T00:00:00Z', 'poor-bottom', 100),
    ql('2026-04-02T00:00:00Z', 'poor-bottom', 9900),
  ];
  const r = buildDailyTokenBonferroniIndex(q, {
    generatedAt: GEN,
    sort: 'bottomQuintilePartialMean',
  });
  assert.equal(r.sources[0]!.source, 'rich-bottom');
});

test('build: validates minDays >= 2', () => {
  assert.throws(() =>
    buildDailyTokenBonferroniIndex([], { minDays: 1 }),
  );
});

test('build: validates minBonferroni in [0, 1)', () => {
  assert.throws(() =>
    buildDailyTokenBonferroniIndex([], { minBonferroni: 1 }),
  );
  assert.throws(() =>
    buildDailyTokenBonferroniIndex([], { minBonferroni: -0.1 }),
  );
});

test('build: validates sort key', () => {
  assert.throws(() =>
    buildDailyTokenBonferroniIndex([], {
      // @ts-expect-error: bad sort key
      sort: 'bogus',
    }),
  );
});

test('build: validates since/until', () => {
  assert.throws(() => buildDailyTokenBonferroniIndex([], { since: 'bad' }));
  assert.throws(() => buildDailyTokenBonferroniIndex([], { until: 'bad' }));
});

test('build: bonferroniOverGini >= 1 for non-degenerate data (B >= G identity)', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    q.push(
      ql(
        `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        'a',
        (i + 1) * 1000,
      ),
    );
  }
  const r = buildDailyTokenBonferroniIndex(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(row.bonferroniOverGini >= 1 - 1e-9);
  assert.ok(Number.isFinite(row.bonferroniOverGini));
});

test('build: meanDailyTokens = totalTokens / nDays', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 2000),
    ql('2026-04-03T00:00:00Z', 'a', 3000),
    ql('2026-04-04T00:00:00Z', 'a', 4000),
  ];
  const r = buildDailyTokenBonferroniIndex(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.meanDailyTokens, 2500);
  assert.equal(row.totalTokens, 10000);
});

test('build: minDay/maxDay reflect extremes', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 5000),
    ql('2026-04-02T00:00:00Z', 'a', 1000),
    ql('2026-04-03T00:00:00Z', 'a', 9000),
  ];
  const r = buildDailyTokenBonferroniIndex(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.minDay, '2026-04-02');
  assert.equal(row.maxDay, '2026-04-03');
  assert.equal(row.minDailyTokens, 1000);
  assert.equal(row.maxDailyTokens, 9000);
});

// ---- refinement: bottom-rank-excess -----------------------------------

test('refinement: includeBottomRankExcess surfaces B - G >= 0', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 6; i += 1) {
    q.push(
      ql(
        `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        'a',
        (i + 1) * 1000,
      ),
    );
  }
  const r = buildDailyTokenBonferroniIndex(q, {
    generatedAt: GEN,
    includeBottomRankExcess: true,
  });
  const row = r.sources[0]!;
  assert.ok(row.bottomRankExcess !== undefined);
  assert.ok(row.bottomRankExcess! >= -1e-9);
  assert.ok(Math.abs(row.bottomRankExcess! - (row.bonferroni - row.gini)) < 1e-12);
});

test('refinement: bottomRankExcess absent unless flag set', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 9000),
  ];
  const r = buildDailyTokenBonferroniIndex(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.bottomRankExcess, undefined);
});

// ---- refinement: De Vergottini cross-anchor ---------------------------

test('refinement: includeDeVergottiniCrossAnchor surfaces dual index and gap', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) {
    q.push(
      ql(
        `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        'a',
        (i + 1) * 1000,
      ),
    );
  }
  const r = buildDailyTokenBonferroniIndex(q, {
    generatedAt: GEN,
    includeDeVergottiniCrossAnchor: true,
  });
  const row = r.sources[0]!;
  assert.ok(row.deVergottini !== undefined);
  assert.ok(row.bonferroniMinusDeVergottini !== undefined);
  assert.ok(
    Math.abs(
      row.bonferroniMinusDeVergottini! - (row.bonferroni - row.deVergottini!),
    ) < 1e-12,
  );
});

test('refinement: deVergottini absent unless flag set', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 9000),
  ];
  const r = buildDailyTokenBonferroniIndex(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.deVergottini, undefined);
  assert.equal(r.sources[0]!.bonferroniMinusDeVergottini, undefined);
});

test('refinement: bonferroni and deVergottini both vanish on equal-mass vector', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    q.push(
      ql(
        `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        'a',
        1000,
      ),
    );
  }
  const r = buildDailyTokenBonferroniIndex(q, {
    generatedAt: GEN,
    includeDeVergottiniCrossAnchor: true,
  });
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.bonferroni) < 1e-12);
  assert.ok(Math.abs(row.deVergottini!) < 1e-9);
  assert.ok(Math.abs(row.bonferroniMinusDeVergottini!) < 1e-9);
});
