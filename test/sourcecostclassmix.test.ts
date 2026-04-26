import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceCostClassMix } from '../src/sourcecostclassmix.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hourStart: string,
  source: string,
  totalTokens: number,
): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: totalTokens,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

test('cost-class-mix: empty queue -> zero sources, zero totals', () => {
  const r = buildSourceCostClassMix([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalRows, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.smallMax, 1000);
  assert.equal(r.largeMin, 10000);
  assert.equal(r.minRows, 1);
  assert.equal(r.sort, 'tokens');
  assert.equal(r.generatedAt, GEN);
});

test('cost-class-mix: classifies rows into small/medium/large by total_tokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'a', 500), // small
    ql('2026-04-20T11:00:00.000Z', 'a', 999), // small (exclusive upper)
    ql('2026-04-20T12:00:00.000Z', 'a', 1000), // medium (inclusive lower)
    ql('2026-04-20T13:00:00.000Z', 'a', 5000), // medium
    ql('2026-04-20T14:00:00.000Z', 'a', 10000), // large (inclusive lower)
    ql('2026-04-20T15:00:00.000Z', 'a', 50000), // large
  ];
  const r = buildSourceCostClassMix(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'a');
  assert.equal(s.totalRows, 6);
  assert.equal(s.smallRows, 2);
  assert.equal(s.mediumRows, 2);
  assert.equal(s.largeRows, 2);
  assert.equal(s.smallTokens, 1499);
  assert.equal(s.mediumTokens, 6000);
  assert.equal(s.largeTokens, 60000);
  assert.equal(s.totalTokens, 1499 + 6000 + 60000);
  // pctRows sums to 1
  assert.ok(
    Math.abs(s.pctRowsSmall + s.pctRowsMedium + s.pctRowsLarge - 1) < 1e-12,
  );
  // pctTokens sums to 1
  assert.ok(
    Math.abs(s.pctTokensSmall + s.pctTokensMedium + s.pctTokensLarge - 1) <
      1e-12,
  );
});

test('cost-class-mix: drops non-positive token rows and bad hour_start', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'a', 500),
    ql('2026-04-20T10:00:00.000Z', 'a', 0),
    ql('2026-04-20T11:00:00.000Z', 'a', -5),
    ql('2026-04-20T12:00:00.000Z', 'a', 1500),
  ];
  const r = buildSourceCostClassMix(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalRows, 1);
  assert.equal(r.sources[0]!.mediumRows, 1);
});

test('cost-class-mix: source filter restricts and counts droppedSourceFilter', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'a', 500),
    ql('2026-04-20T11:00:00.000Z', 'b', 5000),
    ql('2026-04-20T12:00:00.000Z', 'b', 50000),
  ];
  const r = buildSourceCostClassMix(q, {
    source: 'b',
    generatedAt: GEN,
  });
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[0]!.totalRows, 2);
});

test('cost-class-mix: since/until window filters by hour_start', () => {
  const q: QueueLine[] = [
    ql('2026-04-19T10:00:00.000Z', 'a', 100),
    ql('2026-04-20T10:00:00.000Z', 'a', 200),
    ql('2026-04-21T10:00:00.000Z', 'a', 300),
  ];
  const r = buildSourceCostClassMix(q, {
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-21T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalRows, 1);
  assert.equal(r.sources[0]!.totalTokens, 200);
  assert.equal(r.windowStart, '2026-04-20T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-21T00:00:00.000Z');
});

test('cost-class-mix: minRows hides sources below floor', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'a', 500),
    ql('2026-04-20T11:00:00.000Z', 'b', 500),
    ql('2026-04-20T12:00:00.000Z', 'b', 500),
    ql('2026-04-20T13:00:00.000Z', 'b', 500),
  ];
  const r = buildSourceCostClassMix(q, { minRows: 3, generatedAt: GEN });
  assert.equal(r.totalSources, 2);
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});

test('cost-class-mix: top cap applied after sort, surplus reported', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'a', 100),
    ql('2026-04-20T10:00:00.000Z', 'b', 200),
    ql('2026-04-20T10:00:00.000Z', 'c', 300),
  ];
  const r = buildSourceCostClassMix(q, { top: 2, generatedAt: GEN });
  assert.equal(r.totalSources, 3);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
  // tokens-desc default: c then b
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[1]!.source, 'b');
});

test('cost-class-mix: sort by pctLargeTokens orders by share of large mass desc', () => {
  const q: QueueLine[] = [
    // a: 1 small + 1 large -> large tokens dominate
    ql('2026-04-20T10:00:00.000Z', 'a', 500),
    ql('2026-04-20T11:00:00.000Z', 'a', 50000),
    // b: 100 small rows, no large -> 0% large
    ...Array.from({ length: 5 }, (_, i) =>
      ql(`2026-04-20T1${i}:00:00.000Z`, 'b', 500),
    ),
  ];
  const r = buildSourceCostClassMix(q, {
    sort: 'pctLargeTokens',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
  assert.equal(r.sources[1]!.pctTokensLarge, 0);
});

test('cost-class-mix: sort source orders alphabetically', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'zeta', 100),
    ql('2026-04-20T10:00:00.000Z', 'alpha', 200),
    ql('2026-04-20T10:00:00.000Z', 'mu', 300),
  ];
  const r = buildSourceCostClassMix(q, { sort: 'source', generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mu', 'zeta'],
  );
});

test('cost-class-mix: empty source string normalized to (unknown)', () => {
  const q: QueueLine[] = [ql('2026-04-20T10:00:00.000Z', '', 500)];
  const r = buildSourceCostClassMix(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('cost-class-mix: largeMin == smallMax collapses medium class to empty', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'a', 500),
    ql('2026-04-20T11:00:00.000Z', 'a', 1000),
    ql('2026-04-20T12:00:00.000Z', 'a', 5000),
  ];
  const r = buildSourceCostClassMix(q, {
    smallMax: 1000,
    largeMin: 1000,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.smallRows, 1);
  assert.equal(s.mediumRows, 0);
  assert.equal(s.largeRows, 2);
  assert.equal(s.mediumTokens, 0);
});

test('cost-class-mix: throws on bad knobs', () => {
  assert.throws(() =>
    buildSourceCostClassMix([], { smallMax: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceCostClassMix([], { smallMax: 1.5 as number, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceCostClassMix([], {
      smallMax: 1000,
      largeMin: 500,
      generatedAt: GEN,
    }),
  );
  assert.throws(() =>
    buildSourceCostClassMix([], { minRows: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceCostClassMix([], { top: -1, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceCostClassMix([], {
      sort: 'banana' as 'tokens',
      generatedAt: GEN,
    }),
  );
  assert.throws(() =>
    buildSourceCostClassMix([], { since: 'not-iso', generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceCostClassMix([], { until: 'not-iso', generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceCostClassMix([], {
      minLargePctTokens: -0.1,
      generatedAt: GEN,
    }),
  );
  assert.throws(() =>
    buildSourceCostClassMix([], {
      minLargePctTokens: 1.5,
      generatedAt: GEN,
    }),
  );
});

test('cost-class-mix: minLargePctTokens floor filters source rows below threshold', () => {
  const q: QueueLine[] = [
    // a: 100% large mass
    ql('2026-04-20T10:00:00.000Z', 'a', 50000),
    ql('2026-04-20T11:00:00.000Z', 'a', 60000),
    // b: only small/medium -> 0% large mass
    ql('2026-04-20T10:00:00.000Z', 'b', 500),
    ql('2026-04-20T11:00:00.000Z', 'b', 1500),
    // c: mixed -> ~50% large mass
    ql('2026-04-20T10:00:00.000Z', 'c', 10000),
    ql('2026-04-20T11:00:00.000Z', 'c', 5000),
    ql('2026-04-20T12:00:00.000Z', 'c', 5000),
  ];
  const r = buildSourceCostClassMix(q, {
    minLargePctTokens: 0.9,
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 3);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinLargePctTokens, 2);
  assert.equal(r.minLargePctTokens, 0.9);
});

test('cost-class-mix: minLargePctTokens=0 is a no-op', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'a', 500),
    ql('2026-04-20T11:00:00.000Z', 'b', 50000),
  ];
  const r = buildSourceCostClassMix(q, {
    minLargePctTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowMinLargePctTokens, 0);
});

test('cost-class-mix: minLargePctTokens applied AFTER sort, BEFORE top', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'a', 50000), // 100% large
    ql('2026-04-20T10:00:00.000Z', 'b', 500), // 0% large
    ql('2026-04-20T10:00:00.000Z', 'c', 60000), // 100% large
  ];
  const r = buildSourceCostClassMix(q, {
    minLargePctTokens: 0.5,
    top: 1,
    generatedAt: GEN,
  });
  // After filter we have a, c; after top=1 (sort tokens desc) we keep c
  assert.equal(r.droppedBelowMinLargePctTokens, 1);
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'c');
});
