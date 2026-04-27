import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenTurningPointCount } from '../src/sourcerowtokenturningpointcount.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
  model = 'm1',
  device_id = 'd1',
): QueueLine {
  return {
    source,
    model,
    hour_start,
    device_id,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

function series(values: number[], src = 's'): QueueLine[] {
  return values.map((v, i) => {
    const hh = Math.floor(i / 60) % 24;
    const mm = i % 60;
    const day = 25 + Math.floor(i / (24 * 60));
    return ql(
      `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
      src,
      v,
    );
  });
}

test('turning-point: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenTurningPointCount([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.maxP, 1);
  assert.equal(r.minAbsZ, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'abs-z-desc');
});

test('turning-point: rejects bad minRows / maxP / minAbsZ / top / sort / since / until', () => {
  assert.throws(() => buildSourceRowTokenTurningPointCount([], { minRows: 3 }));
  assert.throws(() => buildSourceRowTokenTurningPointCount([], { minRows: 8.5 }));
  assert.throws(() => buildSourceRowTokenTurningPointCount([], { maxP: 0 }));
  assert.throws(() => buildSourceRowTokenTurningPointCount([], { maxP: 1.1 }));
  assert.throws(() => buildSourceRowTokenTurningPointCount([], { minAbsZ: -1 }));
  assert.throws(() => buildSourceRowTokenTurningPointCount([], { top: 0 }));
  assert.throws(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildSourceRowTokenTurningPointCount([], { sort: 'bogus' as any }),
  );
  assert.throws(() => buildSourceRowTokenTurningPointCount([], { since: 'nope' }));
  assert.throws(() => buildSourceRowTokenTurningPointCount([], { until: 'nope' }));
});

test('turning-point: bad hour_start / bad tokens / negative tokens are dropped', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's', 100),
    ql('2026-04-25T00:00:00Z', 's', Number.NaN),
    ql('2026-04-25T01:00:00Z', 's', Number.POSITIVE_INFINITY),
    ql('2026-04-25T02:00:00Z', 's', -50),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 's'),
  ];
  const r = buildSourceRowTokenTurningPointCount(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 2);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.totalRowsKept, 8);
});

test('turning-point: source filter restricts to single source', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'a'),
    ...series([10, 20, 30, 40, 50, 60, 70, 80], 'b'),
  ];
  const r = buildSourceRowTokenTurningPointCount(queue, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.source, 'a');
  assert.equal(r.droppedSourceFilter, 8);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('turning-point: minRows drops sources below floor', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6], 'small'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'big'),
  ];
  const r = buildSourceRowTokenTurningPointCount(queue, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('turning-point: strictly monotone increasing -> T=0, Z very negative (too smooth)', () => {
  const queue: QueueLine[] = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 's');
  const r = buildSourceRowTokenTurningPointCount(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.rowsKept, 10);
  assert.equal(row.turningPoints, 0);
  assert.equal(row.tiePositions, 0);
  // E[T] = 2*(10-2)/3 = 16/3 ~= 5.333
  assert.ok(Math.abs(row.expectedTurningPoints - 16 / 3) < 1e-9);
  // Var = (16*10-29)/90 = 131/90 ~= 1.4555; std ~= 1.2065
  assert.ok(Math.abs(row.stddevTurningPoints - Math.sqrt(131 / 90)) < 1e-9);
  // Z = (0 - 5.333) / 1.2065 ~= -4.42
  assert.ok(row.z < -4);
  assert.ok(row.pValue < 0.001);
});

test('turning-point: perfectly alternating 1,10,1,10,... -> T = n-2, Z very positive (too jagged)', () => {
  const queue: QueueLine[] = series([1, 10, 1, 10, 1, 10, 1, 10, 1, 10], 's');
  const r = buildSourceRowTokenTurningPointCount(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // Every interior position is a peak or trough -> T = 8
  assert.equal(row.turningPoints, 8);
  // Z = (8 - 16/3) / sqrt(131/90) ~= +2.21
  assert.ok(row.z > 2);
  assert.ok(row.pValue < 0.05);
});

test('turning-point: all-equal series -> T=0 with all interior positions tied', () => {
  const queue: QueueLine[] = series([5, 5, 5, 5, 5, 5, 5, 5], 's');
  const r = buildSourceRowTokenTurningPointCount(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.turningPoints, 0);
  assert.equal(row.tiePositions, 6); // n=8 -> 6 interior positions, all tied
  // T=0, E[T]=2*6/3=4 -> Z = -4/sqrt((128-29)/90) = -4/sqrt(99/90)
  assert.ok(row.z < -3);
});

test('turning-point: ordering matters — sorts by hour_start, NOT insertion order', () => {
  const hours: string[] = [];
  for (let i = 0; i < 10; i++) {
    hours.push(`2026-04-25T${i.toString().padStart(2, '0')}:00:00Z`);
  }
  const order = [9, 0, 8, 1, 7, 2, 6, 3, 5, 4];
  const queue: QueueLine[] = order.map((i) => ql(hours[i]!, 's', i + 1));
  const r = buildSourceRowTokenTurningPointCount(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // After sort by hour_start: 1,2,3,4,5,6,7,8,9,10 (monotone) -> T=0
  assert.equal(row.turningPoints, 0);
});

test('turning-point: max-p drops near-iid sources, surfaces only significant non-randomness', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'monotone'), // very significant
    // a hand-picked random-ish 8-row sequence with T near E[T]=4
    ...series([3, 1, 4, 1, 5, 9, 2, 6], 'rand'),
  ];
  const r = buildSourceRowTokenTurningPointCount(queue, {
    maxP: 0.01,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'monotone');
  assert.ok(r.droppedAboveMaxP >= 1);
});

test('turning-point: min-abs-z gates on effect size, counted separately from max-p', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'mono'), // |Z| ~ 4.42
    ...series([3, 1, 4, 1, 5, 9, 2, 6], 'rand'), // |Z| likely small
  ];
  const r = buildSourceRowTokenTurningPointCount(queue, {
    minAbsZ: 3,
    generatedAt: GEN,
  });
  // mono survives, rand drops under min-abs-z
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'mono');
  assert.equal(r.droppedBelowMinAbsZ, 1);
  assert.equal(r.droppedAboveMaxP, 0);
});

test('turning-point: sort = abs-z-desc puts most non-iid first, source-asc tiebreak', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'mono'),
    ...series([1, 10, 1, 10, 1, 10, 1, 10, 1, 10], 'alt'),
  ];
  const r = buildSourceRowTokenTurningPointCount(queue, { generatedAt: GEN });
  // mono Z ~ -4.42 (|Z| 4.42); alt Z ~ +2.21 (|Z| 2.21) -> mono first
  assert.deepEqual(r.sources.map((s) => s.source), ['mono', 'alt']);
});

test('turning-point: sort = z-asc puts smoothest (most negative Z) first', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'mono'),
    ...series([1, 10, 1, 10, 1, 10, 1, 10, 1, 10], 'alt'),
  ];
  const r = buildSourceRowTokenTurningPointCount(queue, {
    sort: 'z-asc',
    generatedAt: GEN,
  });
  assert.deepEqual(r.sources.map((s) => s.source), ['mono', 'alt']);
});

test('turning-point: sort = z-desc puts most jagged (most positive Z) first', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'mono'),
    ...series([1, 10, 1, 10, 1, 10, 1, 10, 1, 10], 'alt'),
  ];
  const r = buildSourceRowTokenTurningPointCount(queue, {
    sort: 'z-desc',
    generatedAt: GEN,
  });
  assert.deepEqual(r.sources.map((s) => s.source), ['alt', 'mono']);
});

test('turning-point: top caps results, surplus reported under droppedBelowTopCap', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'a'),
    ...series([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 'b'),
    ...series([1, 10, 1, 10, 1, 10, 1, 10, 1, 10], 'c'),
  ];
  const r = buildSourceRowTokenTurningPointCount(queue, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('turning-point: since/until window applies on hour_start', () => {
  const queue: QueueLine[] = [
    ql('2026-04-24T23:00:00Z', 's', 100),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 's'),
    ql('2026-04-26T00:00:00Z', 's', 999),
  ];
  const r = buildSourceRowTokenTurningPointCount(queue, {
    since: '2026-04-25T00:00:00Z',
    until: '2026-04-26T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.totalRowsKept, 8);
});

test('turning-point: --max-tie-fraction drops plateau-dominated sources, counted separately', () => {
  // 'plat': 8 zeros + 2 distinct ramp values -> all 8 interior
  //   positions are ties (since v[i-1]==v[i]==v[i+1]==0 for first 6,
  //   and v[i]==v[i-1] at position 7). tiePositions / (n-2) = 8/8 = 1.0
  // 'mono': monotone, no ties. tieFrac = 0.
  const queue: QueueLine[] = [
    ...series([0, 0, 0, 0, 0, 0, 0, 0, 100, 200], 'plat'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'mono'),
  ];
  const r = buildSourceRowTokenTurningPointCount(queue, {
    maxTieFraction: 0.3,
    generatedAt: GEN,
  });
  // plat dropped under maxTieFraction; mono survives
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'mono');
  assert.equal(r.droppedAboveMaxTieFraction, 1);
  // It must NOT be counted under min-abs-z or max-p
  assert.equal(r.droppedBelowMinAbsZ, 0);
  assert.equal(r.droppedAboveMaxP, 0);
});

test('turning-point: --max-tie-fraction validates input', () => {
  assert.throws(() =>
    buildSourceRowTokenTurningPointCount([], { maxTieFraction: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenTurningPointCount([], { maxTieFraction: 1.1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenTurningPointCount([], {
      maxTieFraction: Number.NaN,
    }),
  );
});

test('turning-point: --max-tie-fraction defaults expose new fields', () => {
  const r = buildSourceRowTokenTurningPointCount([], { generatedAt: GEN });
  assert.equal(r.maxTieFraction, 1);
  assert.equal(r.droppedAboveMaxTieFraction, 0);
});

test('turning-point: tieFraction surfaced per row, in [0,1]', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'mono'),
    ...series([0, 0, 0, 0, 0, 0, 0, 0, 100, 200], 'plat'),
  ];
  const r = buildSourceRowTokenTurningPointCount(queue, { generatedAt: GEN });
  const mono = r.sources.find((s) => s.source === 'mono')!;
  const plat = r.sources.find((s) => s.source === 'plat')!;
  assert.equal(mono.tieFraction, 0);
  assert.equal(plat.tieFraction, 7 / 8);
  assert.ok(mono.tieFraction >= 0 && mono.tieFraction <= 1);
  assert.ok(plat.tieFraction >= 0 && plat.tieFraction <= 1);
});
