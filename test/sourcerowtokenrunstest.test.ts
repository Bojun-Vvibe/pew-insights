import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenRunsTest } from '../src/sourcerowtokenrunstest.js';
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

// helper to build an n-row series for source 's' with consecutive
// hours starting at 2026-04-25T00:00:00Z
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

test('runs-test: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenRunsTest([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.maxP, 1);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'abs-z-desc');
  assert.equal(r.generatedAt, GEN);
});

test('runs-test: rejects bad minRows / maxP / top / sort / since / until', () => {
  assert.throws(() => buildSourceRowTokenRunsTest([], { minRows: 3 }));
  assert.throws(() => buildSourceRowTokenRunsTest([], { minRows: 8.5 }));
  assert.throws(() => buildSourceRowTokenRunsTest([], { maxP: 0 }));
  assert.throws(() => buildSourceRowTokenRunsTest([], { maxP: 1.1 }));
  assert.throws(() => buildSourceRowTokenRunsTest([], { maxP: Number.NaN }));
  assert.throws(() => buildSourceRowTokenRunsTest([], { top: 0 }));
  assert.throws(() => buildSourceRowTokenRunsTest([], { top: 1.5 }));
  assert.throws(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildSourceRowTokenRunsTest([], { sort: 'bogus' as any }),
  );
  assert.throws(() => buildSourceRowTokenRunsTest([], { since: 'nope' }));
  assert.throws(() => buildSourceRowTokenRunsTest([], { until: 'nope' }));
});

test('runs-test: bad hour_start / bad tokens / negative tokens are dropped', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's', 100),
    ql('2026-04-25T00:00:00Z', 's', Number.NaN),
    ql('2026-04-25T01:00:00Z', 's', Number.POSITIVE_INFINITY),
    ql('2026-04-25T02:00:00Z', 's', -50),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 's'),
  ];
  const r = buildSourceRowTokenRunsTest(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 2);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.totalRowsKept, 8);
});

test('runs-test: source filter restricts to single source', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'a'),
    ...series([10, 20, 30, 40, 50, 60, 70, 80], 'b'),
  ];
  const r = buildSourceRowTokenRunsTest(queue, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.source, 'a');
  assert.equal(r.droppedSourceFilter, 8);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('runs-test: since/until window applies on hour_start', () => {
  const queue: QueueLine[] = [
    ql('2026-04-24T23:00:00Z', 's', 100),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 's'),
    ql('2026-04-26T00:00:00Z', 's', 999),
  ];
  const r = buildSourceRowTokenRunsTest(queue, {
    since: '2026-04-25T00:00:00Z',
    until: '2026-04-26T00:00:00Z',
    generatedAt: GEN,
  });
  // Only 8 hours of the synthetic series fall in [25, 26)
  assert.equal(r.totalRowsKept, 8);
});

test('runs-test: minRows drops sources below floor', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6], 'small'), // n=6 -> below default 8
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'big'),
  ];
  const r = buildSourceRowTokenRunsTest(queue, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('runs-test: all-equal series -> all rows are at-median, dropped, source not surfaced', () => {
  const queue: QueueLine[] = series([5, 5, 5, 5, 5, 5, 5, 5], 's');
  const r = buildSourceRowTokenRunsTest(queue, { generatedAt: GEN });
  assert.equal(r.droppedAtMedian, 8);
  // n1 = n2 = 0 -> droppedSingleClass
  assert.equal(r.droppedSingleClass, 1);
  assert.equal(r.sources.length, 0);
});

test('runs-test: monotone strictly-increasing series -> 2 runs, Z very negative (clumped)', () => {
  // 1..10; median = 5.5; first 5 below, last 5 above -> 2 runs
  const queue: QueueLine[] = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 's');
  const r = buildSourceRowTokenRunsTest(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.median, 5.5);
  assert.equal(row.n1, 5);
  assert.equal(row.n2, 5);
  assert.equal(row.runs, 2);
  // E[R] = 1 + 2*5*5/10 = 6
  assert.equal(row.expectedRuns, 6);
  // Var[R] = 2*25*(50-10)/(100*9) = 2000/900 ~= 2.222; std ~= 1.491
  assert.ok(Math.abs(row.stddevRuns - Math.sqrt(2000 / 900)) < 1e-9);
  // Z = (2 - 6) / 1.491 ~= -2.683
  assert.ok(row.z < -2.5);
  assert.ok(row.pValue < 0.01);
});

test('runs-test: perfectly alternating series -> max runs, Z very positive', () => {
  // alt 1,10,1,10,1,10,1,10,1,10 -> median = 5.5; +,-,+,-,+,-,+,-,+,-
  // wait: 1<5.5 = '-', 10>5.5 = '+'. sequence = -+-+-+-+-+ -> 10 runs
  const queue: QueueLine[] = series(
    [1, 10, 1, 10, 1, 10, 1, 10, 1, 10],
    's',
  );
  const r = buildSourceRowTokenRunsTest(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.runs, 10);
  // E[R] = 6; Z = (10-6)/1.491 ~= +2.683
  assert.ok(row.z > 2.5);
  assert.ok(row.pValue < 0.01);
});

test('runs-test: single-class series (all > median is impossible, but all-zero followed by one big => most at median) flagged', () => {
  // All values strictly equal -> dropped at median (covered above).
  // Construct: 7 zeros + 1 huge -> median = 0; signs: 7 ties + 1 plus
  // -> n1=1, n2=0 -> droppedSingleClass.
  const queue: QueueLine[] = series([0, 0, 0, 0, 0, 0, 0, 1000], 's');
  const r = buildSourceRowTokenRunsTest(queue, { generatedAt: GEN });
  assert.equal(r.droppedAtMedian, 7);
  assert.equal(r.droppedSingleClass, 1);
  assert.equal(r.sources.length, 0);
});

test('runs-test: ordering matters — sorts samples by hour_start ascending, NOT insertion order', () => {
  // Insertion order is alternating but actual hour_start order is monotone.
  // The runs-test must see the temporal order (monotone) not insertion (alt).
  const queue: QueueLine[] = [];
  // insertion: alternate, but hour_start strictly increasing in pairs
  const hours: string[] = [];
  for (let i = 0; i < 10; i++) {
    hours.push(`2026-04-25T${i.toString().padStart(2, '0')}:00:00Z`);
  }
  // value at hour i = i+1; build it monotone
  // but PUSH in scrambled order to prove the builder sorts internally
  const order = [9, 0, 8, 1, 7, 2, 6, 3, 5, 4];
  for (const i of order) {
    queue.push(ql(hours[i]!, 's', i + 1));
  }
  const r = buildSourceRowTokenRunsTest(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // Same as monotone increasing 1..10: 2 runs, Z very negative
  assert.equal(row.runs, 2);
  assert.ok(row.z < -2.5);
});

test('runs-test: random-looking series -> Z near 0, large p-value', () => {
  // alternating-but-not-perfectly: -, +, -, -, +, +, -, +, +, -
  // values: 1, 10, 1, 1, 10, 10, 1, 10, 10, 1 (median = 5.5 -> 1=-, 10=+)
  const queue: QueueLine[] = series(
    [1, 10, 1, 1, 10, 10, 1, 10, 10, 1],
    's',
  );
  const r = buildSourceRowTokenRunsTest(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // signs: -+--++-++- -> runs: 7 (-, +, --, ++, -, ++, -)
  assert.equal(row.runs, 7);
  // E[R]=6; Z = (7-6)/1.491 ~= 0.671; p ~= 0.50
  assert.ok(Math.abs(row.z - (1 / Math.sqrt(2000 / 900))) < 1e-9);
  assert.ok(row.pValue > 0.4);
});

test('runs-test: max-p cohort filter drops near-random sources, surfaces only significant non-randomness', () => {
  // monotone source (very significant); near-random source.
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'monotone'),
    ...series([1, 10, 1, 1, 10, 10, 1, 10, 10, 1], 'random'),
  ];
  const r = buildSourceRowTokenRunsTest(queue, {
    maxP: 0.05,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'monotone');
  assert.equal(r.droppedAboveMaxP, 1);
});

test('runs-test: sort = abs-z-desc (default) puts most-non-random first', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'mono'), // Z << 0
    ...series([1, 10, 1, 10, 1, 10, 1, 10, 1, 10], 'alt'), // Z >> 0
    ...series([1, 10, 1, 1, 10, 10, 1, 10, 10, 1], 'rand'), // |Z| small
  ];
  const r = buildSourceRowTokenRunsTest(queue, { generatedAt: GEN });
  // mono and alt have |Z| ~ 2.683; rand has |Z| ~ 0.67
  // Tie between mono and alt -> source asc tiebreak: 'alt' first
  assert.deepEqual(r.sources.map((s) => s.source), ['alt', 'mono', 'rand']);
});

test('runs-test: sort = z-asc puts most-clumped (most negative Z) first', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'mono'),
    ...series([1, 10, 1, 10, 1, 10, 1, 10, 1, 10], 'alt'),
  ];
  const r = buildSourceRowTokenRunsTest(queue, {
    sort: 'z-asc',
    generatedAt: GEN,
  });
  assert.deepEqual(r.sources.map((s) => s.source), ['mono', 'alt']);
});

test('runs-test: sort = z-desc puts most-alternating (most positive Z) first', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'mono'),
    ...series([1, 10, 1, 10, 1, 10, 1, 10, 1, 10], 'alt'),
  ];
  const r = buildSourceRowTokenRunsTest(queue, {
    sort: 'z-desc',
    generatedAt: GEN,
  });
  assert.deepEqual(r.sources.map((s) => s.source), ['alt', 'mono']);
});

test('runs-test: sort = p-asc puts smallest p-value first', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'mono'),
    ...series([1, 10, 1, 1, 10, 10, 1, 10, 10, 1], 'rand'),
  ];
  const r = buildSourceRowTokenRunsTest(queue, {
    sort: 'p-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'mono');
});

test('runs-test: sort = rows / source', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'small'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'big'),
  ];
  const rRows = buildSourceRowTokenRunsTest(queue, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(rRows.sources[0]!.source, 'big');

  const rSrc = buildSourceRowTokenRunsTest(queue, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(rSrc.sources.map((s) => s.source), ['big', 'small']);
});

test('runs-test: top cap surfaces excess as droppedBelowTopCap', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'a'),
    ...series([1, 10, 1, 10, 1, 10, 1, 10, 1, 10], 'b'),
    ...series([1, 10, 1, 1, 10, 10, 1, 10, 10, 1], 'c'),
  ];
  const r = buildSourceRowTokenRunsTest(queue, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('runs-test: Z and p are well-defined and finite for all surviving rows', () => {
  const queue: QueueLine[] = [];
  const sources = ['s1', 's2', 's3', 's4'];
  let h = 1;
  for (let i = 0; i < 200; i++) {
    h = ((h * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    const src = sources[i % sources.length]!;
    const tt = h % 5000;
    const hh = i % 24;
    const day = 25 + Math.floor(i / 24);
    queue.push(
      ql(
        `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:00:00Z`,
        src,
        tt,
      ),
    );
  }
  const r = buildSourceRowTokenRunsTest(queue, { generatedAt: GEN });
  for (const row of r.sources) {
    assert.ok(Number.isFinite(row.z), `z not finite: ${row.z}`);
    assert.ok(row.pValue >= 0 && row.pValue <= 1, `p out of range: ${row.pValue}`);
    assert.ok(row.runs >= 1);
    assert.ok(row.expectedRuns > 0);
    assert.ok(row.stddevRuns > 0);
  }
});

test('runs-test: ties (== median) counted under droppedAtMedian and excluded from sign counts', () => {
  // values: 5,5,1,1,1,1,10,10,10,10,10
  // sorted: 1,1,1,1,5,5,10,10,10,10,10 (n=11) -> median = element[5] = 5
  // signs: 5(tie),5(tie),1(-),1(-),1(-),1(-),10(+),10(+),10(+),10(+),10(+)
  // drop 2 ties -> n1=5, n2=4, n=9 (>=8)
  // post-tie hour order: -,-,-,-,+,+,+,+,+ -> 2 runs
  const queue: QueueLine[] = series(
    [5, 5, 1, 1, 1, 1, 10, 10, 10, 10, 10],
    's',
  );
  const r = buildSourceRowTokenRunsTest(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1, `expected 1 source, got ${r.sources.length}; droppedBelowMinRows=${r.droppedBelowMinRows}`);
  const row = r.sources[0]!;
  assert.equal(row.median, 5);
  assert.equal(row.ties, 2);
  assert.equal(row.n1, 5);
  assert.equal(row.n2, 4);
  assert.equal(row.runs, 2);
  // n=9; very clumped
  assert.ok(row.z < -1.5);
  assert.equal(r.droppedAtMedian, 2);
});

test('runs-test: orthogonality witness — same marginal distribution, different ordering -> different Z', () => {
  // Same multiset {1,1,1,1,1,10,10,10,10,10}; mean, stddev, B, cv, gini all
  // identical. But ordering differs -> Z differs dramatically.
  const sortedAsc = [1, 1, 1, 1, 1, 10, 10, 10, 10, 10];
  const alternating = [1, 10, 1, 10, 1, 10, 1, 10, 1, 10];
  const queue: QueueLine[] = [
    ...series(sortedAsc, 'sorted'),
    ...series(alternating, 'alt'),
  ];
  const r = buildSourceRowTokenRunsTest(queue, {
    sort: 'source',
    generatedAt: GEN,
  });
  const altRow = r.sources.find((s) => s.source === 'alt')!;
  const sortedRow = r.sources.find((s) => s.source === 'sorted')!;
  // Same n1=n2=5 and same expectedRuns
  assert.equal(altRow.n1, sortedRow.n1);
  assert.equal(altRow.n2, sortedRow.n2);
  assert.equal(altRow.expectedRuns, sortedRow.expectedRuns);
  // But runs differ: sorted has 2, alt has 10
  assert.equal(sortedRow.runs, 2);
  assert.equal(altRow.runs, 10);
  // And Z signs are opposite, magnitudes equal
  assert.ok(Math.abs(altRow.z + sortedRow.z) < 1e-12);
  assert.ok(sortedRow.z < 0 && altRow.z > 0);
});

test('runs-test: rejects bad minAbsZ', () => {
  assert.throws(() => buildSourceRowTokenRunsTest([], { minAbsZ: -1 }));
  assert.throws(() => buildSourceRowTokenRunsTest([], { minAbsZ: Number.NaN }));
  assert.throws(() =>
    buildSourceRowTokenRunsTest([], { minAbsZ: Number.POSITIVE_INFINITY }),
  );
});

test('runs-test: --min-abs-z default 0 keeps every source (no behaviour change vs v0.6.101)', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'mono'),
    ...series([1, 10, 1, 1, 10, 10, 1, 10, 10, 1], 'rand'),
  ];
  const r = buildSourceRowTokenRunsTest(queue, { generatedAt: GEN });
  assert.equal(r.minAbsZ, 0);
  assert.equal(r.droppedBelowMinAbsZ, 0);
  assert.equal(r.sources.length, 2);
});

test('runs-test: --min-abs-z drops sources whose |Z| < g, counts under droppedBelowMinAbsZ', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'mono'), // |Z| ~ 2.683
    ...series([1, 10, 1, 1, 10, 10, 1, 10, 10, 1], 'rand'), // |Z| ~ 0.671
  ];
  const r = buildSourceRowTokenRunsTest(queue, {
    minAbsZ: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'mono');
  assert.equal(r.droppedBelowMinAbsZ, 1);
  assert.equal(r.droppedAboveMaxP, 0);
});

test('runs-test: --min-abs-z and --max-p combine via logical AND, with separate drop counters', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'mono'), // |Z| ~ 2.683, p ~ 0.0073
    ...series([1, 10, 1, 1, 10, 10, 1, 10, 10, 1], 'rand'), // |Z| ~ 0.671, p ~ 0.50
  ];
  // min-abs-z 2 alone -> only 'mono' survives, droppedBelowMinAbsZ=1
  const r1 = buildSourceRowTokenRunsTest(queue, {
    minAbsZ: 2,
    generatedAt: GEN,
  });
  assert.deepEqual(r1.sources.map((s) => s.source), ['mono']);
  assert.equal(r1.droppedBelowMinAbsZ, 1);
  assert.equal(r1.droppedAboveMaxP, 0);

  // max-p 0.05 alone -> only 'mono' survives, droppedAboveMaxP=1
  const r2 = buildSourceRowTokenRunsTest(queue, {
    maxP: 0.05,
    generatedAt: GEN,
  });
  assert.deepEqual(r2.sources.map((s) => s.source), ['mono']);
  assert.equal(r2.droppedAboveMaxP, 1);
  assert.equal(r2.droppedBelowMinAbsZ, 0);

  // Both together: 'rand' is killed by min-abs-z (gate runs first per impl).
  // Logical AND: only 'mono' survives.
  const r3 = buildSourceRowTokenRunsTest(queue, {
    minAbsZ: 2,
    maxP: 0.05,
    generatedAt: GEN,
  });
  assert.deepEqual(r3.sources.map((s) => s.source), ['mono']);
  // 'rand' gets counted under droppedBelowMinAbsZ (the first gate it hit).
  // 'mono' clears both gates.
  assert.equal(r3.droppedBelowMinAbsZ, 1);
  assert.equal(r3.droppedAboveMaxP, 0);
});

test('runs-test: --min-abs-z = 0 is no-op even when --max-p is restrictive', () => {
  const queue: QueueLine[] = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'mono'),
    ...series([1, 10, 1, 1, 10, 10, 1, 10, 10, 1], 'rand'),
  ];
  const r = buildSourceRowTokenRunsTest(queue, {
    maxP: 0.05,
    minAbsZ: 0,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinAbsZ, 0);
  assert.equal(r.droppedAboveMaxP, 1);
  assert.equal(r.sources.length, 1);
});
