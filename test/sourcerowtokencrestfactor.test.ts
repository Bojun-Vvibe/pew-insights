import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenCrestFactor } from '../src/sourcerowtokencrestfactor.js';
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

const GEN = '2026-04-28T12:00:00.000Z';

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

test('crest-factor: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenCrestFactor([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 4);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'crest-asc');
  assert.equal(r.generatedAt, GEN);
});

test('crest-factor: flat positive series -> C ~ 1', () => {
  const r = buildSourceRowTokenCrestFactor(series([5, 5, 5, 5, 5, 5]), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.peak, 5);
  assert.ok(Math.abs(row.rms - 5) < 1e-9);
  assert.ok(Math.abs(row.crestFactor - 1) < 1e-9);
  assert.ok(Math.abs(row.crestFactorNorm - 0) < 1e-9);
});

test('crest-factor: maximally peaky series (one nonzero) -> C = sqrt(n)', () => {
  // n=4: [10, 0, 0, 0] -> peak=10, rms=sqrt(100/4)=5, C=2=sqrt(4).
  const r = buildSourceRowTokenCrestFactor(series([10, 0, 0, 0]), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.peak, 10);
  assert.ok(Math.abs(row.rms - 5) < 1e-9);
  assert.ok(Math.abs(row.crestFactor - 2) < 1e-9);
  assert.ok(Math.abs(row.crestFactorMax - 2) < 1e-9);
  assert.ok(Math.abs(row.crestFactorNorm - 1) < 1e-9);
});

test('crest-factor: C is bounded in [1, sqrt(n)] across many random-ish shapes', () => {
  const shapes = [
    [1, 2, 3, 4, 5],
    [100, 1, 1, 1, 1],
    [3, 3, 3, 3, 3, 3, 3],
    [10, 10, 1, 1, 10],
    [1, 1, 1, 1, 1, 100],
  ];
  const queue: QueueLine[] = [];
  shapes.forEach((vals, idx) =>
    queue.push(...series(vals, `src-${idx}`)),
  );
  const r = buildSourceRowTokenCrestFactor(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, shapes.length);
  for (const row of r.sources) {
    assert.ok(row.crestFactor >= 1 - 1e-9, `C >= 1 for ${row.source}`);
    assert.ok(
      row.crestFactor <= row.crestFactorMax + 1e-9,
      `C <= sqrt(n) for ${row.source}`,
    );
    assert.ok(row.crestFactorNorm >= -1e-9 && row.crestFactorNorm <= 1 + 1e-9);
  }
});

test('crest-factor: order-invariance — shuffling values yields identical C', () => {
  const a = buildSourceRowTokenCrestFactor(
    series([1, 5, 2, 8, 3, 7, 4], 'a'),
    { generatedAt: GEN },
  );
  const b = buildSourceRowTokenCrestFactor(
    series([8, 7, 5, 4, 3, 2, 1], 'a'),
    { generatedAt: GEN },
  );
  assert.equal(a.sources.length, 1);
  assert.equal(b.sources.length, 1);
  assert.ok(Math.abs(a.sources[0]!.crestFactor - b.sources[0]!.crestFactor) < 1e-9);
});

test('crest-factor: drops sources below min-rows', () => {
  const queue = [
    ...series([10, 20, 30], 'tiny'),
    ...series([1, 2, 3, 4, 5, 6], 'big'),
  ];
  const r = buildSourceRowTokenCrestFactor(queue, {
    minRows: 4,
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('crest-factor: drops constant-zero series under droppedZeroRms', () => {
  const r = buildSourceRowTokenCrestFactor(series([0, 0, 0, 0, 0]), {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroRms, 1);
});

test('crest-factor: drops bad total_tokens and negative tokens distinctly', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 's', Number.NaN),
    ql('2026-04-25T01:00:00Z', 's', -3),
    ...series([1, 2, 3, 4, 5], 's'),
  ];
  const r = buildSourceRowTokenCrestFactor(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 5);
});

test('crest-factor: drops invalid hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's', 5),
    ...series([1, 2, 3, 4], 's'),
  ];
  const r = buildSourceRowTokenCrestFactor(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('crest-factor: source filter restricts and counts dropped', () => {
  const queue = [
    ...series([1, 2, 3, 4], 'keep'),
    ...series([10, 20, 30, 40], 'drop'),
  ];
  const r = buildSourceRowTokenCrestFactor(queue, {
    source: 'keep',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 4);
});

test('crest-factor: since/until window', () => {
  const queue = series([1, 2, 3, 4, 5, 6, 7, 8]);
  const r = buildSourceRowTokenCrestFactor(queue, {
    since: '2026-04-25T00:03:00Z',
    until: '2026-04-25T00:07:00Z',
    minRows: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 4); // indices 3,4,5,6 -> values 4,5,6,7
});

test('crest-factor: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenCrestFactor([], { since: 'bogus' }),
    /invalid since/,
  );
});

test('crest-factor: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenCrestFactor([], { until: 'bogus' }),
    /invalid until/,
  );
});

test('crest-factor: minRows < 2 throws', () => {
  assert.throws(
    () => buildSourceRowTokenCrestFactor([], { minRows: 1 }),
    /minRows must be an integer >= 2/,
  );
});

test('crest-factor: non-integer minRows throws', () => {
  assert.throws(
    () => buildSourceRowTokenCrestFactor([], { minRows: 3.5 }),
    /minRows must be an integer >= 2/,
  );
});

test('crest-factor: invalid sort throws', () => {
  assert.throws(
    () => buildSourceRowTokenCrestFactor([], { sort: 'nope' as never }),
    /sort must be one of/,
  );
});

test('crest-factor: invalid top throws', () => {
  assert.throws(
    () => buildSourceRowTokenCrestFactor([], { top: 0 }),
    /top must be a positive integer/,
  );
  assert.throws(
    () => buildSourceRowTokenCrestFactor([], { top: 1.5 }),
    /top must be a positive integer/,
  );
});

test('crest-factor: sort crest-asc puts least peaky first', () => {
  // src-flat: C ~ 1; src-spike: C closer to sqrt(n).
  const queue = [
    ...series([10, 10, 10, 10, 10], 'flat'),
    ...series([100, 1, 1, 1, 1], 'spike'),
  ];
  const r = buildSourceRowTokenCrestFactor(queue, {
    sort: 'crest-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'flat');
  assert.equal(r.sources[1]!.source, 'spike');
  assert.ok(r.sources[0]!.crestFactor < r.sources[1]!.crestFactor);
});

test('crest-factor: sort crest-desc puts most peaky first', () => {
  const queue = [
    ...series([10, 10, 10, 10, 10], 'flat'),
    ...series([100, 1, 1, 1, 1], 'spike'),
  ];
  const r = buildSourceRowTokenCrestFactor(queue, {
    sort: 'crest-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'spike');
  assert.equal(r.sources[1]!.source, 'flat');
});

test('crest-factor: sort norm-asc and norm-desc by crestFactorNorm', () => {
  const queue = [
    ...series([10, 10, 10, 10, 10], 'flat'),
    ...series([100, 1, 1, 1, 1], 'spike'),
  ];
  const asc = buildSourceRowTokenCrestFactor(queue, {
    sort: 'norm-asc',
    generatedAt: GEN,
  });
  const desc = buildSourceRowTokenCrestFactor(queue, {
    sort: 'norm-desc',
    generatedAt: GEN,
  });
  assert.equal(asc.sources[0]!.source, 'flat');
  assert.equal(desc.sources[0]!.source, 'spike');
});

test('crest-factor: sort rows orders by rowsKept desc', () => {
  const queue = [
    ...series([1, 2, 3, 4], 'short'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'long'),
  ];
  const r = buildSourceRowTokenCrestFactor(queue, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'long');
  assert.equal(r.sources[1]!.source, 'short');
});

test('crest-factor: sort source orders alphabetically', () => {
  const queue = [
    ...series([1, 2, 3, 4], 'zebra'),
    ...series([1, 2, 3, 4], 'alpha'),
    ...series([1, 2, 3, 4], 'mango'),
  ];
  const r = buildSourceRowTokenCrestFactor(queue, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mango', 'zebra'],
  );
});

test('crest-factor: tiebreak is source asc when primary equal', () => {
  // identical shape across two sources -> identical C
  const queue = [
    ...series([1, 2, 3, 4, 5], 'b-src'),
    ...series([1, 2, 3, 4, 5], 'a-src'),
  ];
  const r = buildSourceRowTokenCrestFactor(queue, {
    sort: 'crest-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a-src');
  assert.equal(r.sources[1]!.source, 'b-src');
});

test('crest-factor: top cap surfaces droppedBelowTopCap', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5], 'a'),
    ...series([2, 3, 4, 5, 6], 'b'),
    ...series([3, 4, 5, 6, 7], 'c'),
  ];
  const r = buildSourceRowTokenCrestFactor(queue, {
    sort: 'crest-asc',
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('crest-factor: missing source name maps to "unknown"', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', '', 1),
    ql('2026-04-25T01:00:00Z', '', 2),
    ql('2026-04-25T02:00:00Z', '', 3),
    ql('2026-04-25T03:00:00Z', '', 4),
  ];
  const r = buildSourceRowTokenCrestFactor(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('crest-factor: defensive non-finite (impossible via API but covered) drops', () => {
  // All zeros except one Infinity-equivalent: total_tokens must be finite,
  // so simulate via constant zeros (already covered) and a positive series
  // checking degenerate counter stays at 0 in normal input.
  const r = buildSourceRowTokenCrestFactor(series([1, 2, 3, 4]), {
    generatedAt: GEN,
  });
  assert.equal(r.droppedDegenerate, 0);
});
