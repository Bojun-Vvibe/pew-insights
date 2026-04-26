import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildCumulativeTokensMidpoint } from '../src/cumulativetokensmidpoint.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: Math.floor(total_tokens / 2),
    cached_input_tokens: 0,
    output_tokens: Math.floor(total_tokens / 2),
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

test('cumulative-tokens-midpoint: empty input → empty report', () => {
  const r = buildCumulativeTokensMidpoint([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minDays, 1);
  assert.equal(r.sort, 'tokens');
  assert.equal(r.top, null);
});

test('cumulative-tokens-midpoint: rejects bad minDays', () => {
  assert.throws(() => buildCumulativeTokensMidpoint([], { minDays: 0 }));
  assert.throws(() => buildCumulativeTokensMidpoint([], { minDays: -1 }));
  assert.throws(() => buildCumulativeTokensMidpoint([], { minDays: 1.5 }));
});

test('cumulative-tokens-midpoint: rejects bad top', () => {
  assert.throws(() => buildCumulativeTokensMidpoint([], { top: 0 }));
  assert.throws(() => buildCumulativeTokensMidpoint([], { top: -1 }));
  assert.throws(() => buildCumulativeTokensMidpoint([], { top: 1.5 }));
});

test('cumulative-tokens-midpoint: rejects bad sort', () => {
  assert.throws(() =>
    buildCumulativeTokensMidpoint([], {
      // @ts-expect-error invalid sort
      sort: 'bogus',
    }),
  );
});

test('cumulative-tokens-midpoint: rejects bad since/until', () => {
  assert.throws(() =>
    buildCumulativeTokensMidpoint([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildCumulativeTokensMidpoint([], { until: 'also-bad' }),
  );
});

test('cumulative-tokens-midpoint: single-day source -> singleDay=true, midPct=0', () => {
  const q = [
    ql('2026-04-10T00:00:00.000Z', 's1', 100),
    ql('2026-04-10T05:00:00.000Z', 's1', 200),
  ];
  const r = buildCumulativeTokensMidpoint(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 's1');
  assert.equal(row.tokens, 300);
  assert.equal(row.activeDays, 1);
  assert.equal(row.tenureDays, 1);
  assert.equal(row.singleDay, true);
  assert.equal(row.midpointDayIndex, 0);
  assert.equal(row.midpointPctTenure, 0);
  assert.equal(row.firstActiveDay, '2026-04-10T00:00:00.000Z');
  assert.equal(row.lastActiveDay, '2026-04-10T00:00:00.000Z');
});

test('cumulative-tokens-midpoint: uniform 5-day source -> midpoint at day 2 (index, ~0.5)', () => {
  // 5 consecutive days, 100 tokens each. Cum: 100,200,300,400,500. Half=250 -> index 2.
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 100),
    ql('2026-04-03T00:00:00.000Z', 's1', 100),
    ql('2026-04-04T00:00:00.000Z', 's1', 100),
    ql('2026-04-05T00:00:00.000Z', 's1', 100),
  ];
  const r = buildCumulativeTokensMidpoint(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.tenureDays, 5);
  assert.equal(row.activeDays, 5);
  assert.equal(row.midpointDayIndex, 2);
  assert.equal(row.midpointPctTenure, 0.5);
  assert.equal(row.singleDay, false);
});

test('cumulative-tokens-midpoint: front-loaded source -> midPct < 0.5', () => {
  // Day 0: 800. Days 1-4: 50 each. Half=500 -> index 0.
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 800),
    ql('2026-04-02T00:00:00.000Z', 's1', 50),
    ql('2026-04-03T00:00:00.000Z', 's1', 50),
    ql('2026-04-04T00:00:00.000Z', 's1', 50),
    ql('2026-04-05T00:00:00.000Z', 's1', 50),
  ];
  const r = buildCumulativeTokensMidpoint(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.midpointDayIndex, 0);
  assert.equal(row.midpointPctTenure, 0);
  assert.ok(row.midpointPctTenure < 0.5);
});

test('cumulative-tokens-midpoint: back-loaded source -> midPct > 0.5', () => {
  // Days 0-3: 25 each (100 total). Day 4: 900. Half=500 -> index 4.
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 25),
    ql('2026-04-02T00:00:00.000Z', 's1', 25),
    ql('2026-04-03T00:00:00.000Z', 's1', 25),
    ql('2026-04-04T00:00:00.000Z', 's1', 25),
    ql('2026-04-05T00:00:00.000Z', 's1', 900),
  ];
  const r = buildCumulativeTokensMidpoint(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.midpointDayIndex, 4);
  assert.equal(row.midpointPctTenure, 1);
});

test('cumulative-tokens-midpoint: gap-filled tenure (sparse calendar)', () => {
  // Active on day 0 (100) and day 9 (100). Tenure=10 days. Half=100 -> index 0.
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-10T00:00:00.000Z', 's1', 100),
  ];
  const r = buildCumulativeTokensMidpoint(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.activeDays, 2);
  assert.equal(row.tenureDays, 10);
  assert.equal(row.midpointDayIndex, 0);
  assert.equal(row.midpointPctTenure, 0);
  assert.equal(row.midpointDayIso, '2026-04-01T00:00:00.000Z');
});

test('cumulative-tokens-midpoint: minDays floor + droppedBelowMinDays', () => {
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100), // 1 active day
    ql('2026-04-01T00:00:00.000Z', 's2', 50),
    ql('2026-04-02T00:00:00.000Z', 's2', 50),
    ql('2026-04-03T00:00:00.000Z', 's2', 50), // 3 active days
  ];
  const r = buildCumulativeTokensMidpoint(q, {
    minDays: 3,
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 2); // both kept globally
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's2');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('cumulative-tokens-midpoint: sort=midpoint surfaces front-loaded first', () => {
  const q = [
    // s1: front-loaded
    ql('2026-04-01T00:00:00.000Z', 's1', 1000),
    ql('2026-04-02T00:00:00.000Z', 's1', 10),
    ql('2026-04-03T00:00:00.000Z', 's1', 10),
    // s2: back-loaded
    ql('2026-04-01T00:00:00.000Z', 's2', 10),
    ql('2026-04-02T00:00:00.000Z', 's2', 10),
    ql('2026-04-03T00:00:00.000Z', 's2', 1000),
  ];
  const r = buildCumulativeTokensMidpoint(q, {
    sort: 'midpoint',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.sources[1]!.source, 's2');
  assert.ok(r.sources[0]!.midpointPctTenure < r.sources[1]!.midpointPctTenure);
});

test('cumulative-tokens-midpoint: top cap + droppedBelowTopCap', () => {
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 1000),
    ql('2026-04-01T00:00:00.000Z', 's2', 500),
    ql('2026-04-01T00:00:00.000Z', 's3', 100),
  ];
  const r = buildCumulativeTokensMidpoint(q, { top: 2, generatedAt: GEN });
  assert.equal(r.totalSources, 3);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.sources[1]!.source, 's2');
});

test('cumulative-tokens-midpoint: source filter + droppedSourceFilter', () => {
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-01T00:00:00.000Z', 's2', 100),
    ql('2026-04-02T00:00:00.000Z', 's2', 100),
  ];
  const r = buildCumulativeTokensMidpoint(q, {
    source: 's2',
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources[0]!.source, 's2');
  assert.equal(r.droppedSourceFilter, 1);
});

test('cumulative-tokens-midpoint: drops zero/negative tokens and bad hour_start', () => {
  const q = [
    ql('not-a-date', 's1', 100),
    ql('2026-04-01T00:00:00.000Z', 's1', 0),
    ql('2026-04-01T00:00:00.000Z', 's1', -10),
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
  ];
  const r = buildCumulativeTokensMidpoint(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.tokens, 100);
});

test('cumulative-tokens-midpoint: deterministic on shuffled input', () => {
  const q1 = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 100),
    ql('2026-04-03T00:00:00.000Z', 's1', 100),
  ];
  const q2 = [q1[2]!, q1[0]!, q1[1]!];
  const r1 = buildCumulativeTokensMidpoint(q1, { generatedAt: GEN });
  const r2 = buildCumulativeTokensMidpoint(q2, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});
