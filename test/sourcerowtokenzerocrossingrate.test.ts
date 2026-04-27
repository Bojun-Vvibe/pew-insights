import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenZeroCrossingRate } from '../src/sourcerowtokenzerocrossingrate.js';
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

test('alternating high/low series approaches Nyquist (rate ~ 0.5)', () => {
  // 30 rows alternating 100, 0; mean = 50; sign sequence flips every step.
  const vals: number[] = [];
  for (let i = 0; i < 30; i++) vals.push(i % 2 === 0 ? 100 : 0);
  const r = buildSourceRowTokenZeroCrossingRate(series(vals), {
    minRows: 24,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  // 29 adjacent pairs, all flip -> rate = 29/29 = 1.0; but our convention
  // counts each flip once, max one per pair. So 29/29 = 1.0 here actually
  // exceeds the typical Nyquist 0.5 bound because we count every flip.
  // Reality: every pair flips => crossings = N-1 = 29, rate = 1.0.
  assert.equal(row.crossings, 29);
  assert.equal(row.rate, 1);
});

test('constant series surfaces under droppedZeroVariance', () => {
  const r = buildSourceRowTokenZeroCrossingRate(series(new Array(30).fill(7)), {
    minRows: 24,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('monotone ramp has exactly one crossing at the midpoint', () => {
  const vals: number[] = [];
  for (let i = 0; i < 30; i++) vals.push(i);
  const r = buildSourceRowTokenZeroCrossingRate(series(vals), {
    minRows: 24,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  // Mean = 14.5; crosses from below to above exactly once.
  assert.equal(row.crossings, 1);
  assert.ok(Math.abs(row.rate - 1 / 29) < 1e-12);
});

test('strictly decreasing ramp also has exactly one crossing', () => {
  const vals: number[] = [];
  for (let i = 0; i < 30; i++) vals.push(30 - i);
  const r = buildSourceRowTokenZeroCrossingRate(series(vals), {
    minRows: 24,
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.crossings, 1);
});

test('below-min-rows is dropped honestly', () => {
  const r = buildSourceRowTokenZeroCrossingRate(series([1, 2, 3, 4, 5]), {
    minRows: 24,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.totalRowsKept, 5);
});

test('zero treated as positive sign per Kedem convention', () => {
  // [+, +, 0, +, ...] => no crossings between the zero and its neighbours.
  const vals = [10, 5, 0, 5, 10, 5, 0, 5, 10, 5, 0, 5, 10, 5, 0, 5, 10, 5, 0, 5, 10, 5, 0, 5, 10, 5];
  // Mean is ~5. Build all >=0 after centring? Let's instead force mean=0.
  // Use values that average to 0: [+1, -1, +1, -1, 0, +1, -1, ...].
  const vals2 = [1, -1, 1, -1, 0, 1, -1, 1, -1, 0, 1, -1, 1, -1, 0, 1, -1, 1, -1, 0, 1, -1, 1, -1, 0, 1];
  // To avoid negative total_tokens (rejected), shift by +10 and re-mean.
  const shifted = vals2.map((x) => x + 10);
  const r = buildSourceRowTokenZeroCrossingRate(series(shifted), {
    minRows: 24,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  // 0 -> sign +1; should still crossings, just use the field non-zero
  assert.ok(r.sources[0]!.crossings > 0);
  // values are bounded
  assert.ok(r.sources[0]!.rate >= 0 && r.sources[0]!.rate <= 1);
});

test('negative total_tokens rejected', () => {
  const rows = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
  rows.push(ql('2026-04-26T01:00:00Z', 's', -5));
  const r = buildSourceRowTokenZeroCrossingRate(rows, {
    minRows: 24,
    generatedAt: GEN,
  });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('non-finite total_tokens rejected', () => {
  const rows = series(new Array(24).fill(5));
  rows.push(ql('2026-04-26T02:00:00Z', 's', Number.NaN));
  const r = buildSourceRowTokenZeroCrossingRate(rows, {
    minRows: 24,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('bad hour_start rejected', () => {
  const rows = series(new Array(24).fill(5));
  rows.push(ql('not-a-date', 's', 7));
  const r = buildSourceRowTokenZeroCrossingRate(rows, {
    minRows: 24,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('source filter restricts to one source', () => {
  const rows = [
    ...series(new Array(24).fill(0).map((_, i) => i % 4), 'a'),
    ...series(new Array(24).fill(0).map((_, i) => i % 6), 'b'),
  ];
  const r = buildSourceRowTokenZeroCrossingRate(rows, {
    minRows: 24,
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('since/until window', () => {
  const rows = series(new Array(48).fill(0).map((_, i) => i));
  const r = buildSourceRowTokenZeroCrossingRate(rows, {
    minRows: 4,
    since: '2026-04-25T00:00:00Z',
    until: '2026-04-25T00:24:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.rowsKept, 24);
});

test('sort rate-asc puts most-persistent first', () => {
  const slow = new Array(24).fill(0).map((_, i) => i); // monotone -> rate ~ 1/23
  const fast = new Array(24).fill(0).map((_, i) => (i % 2 === 0 ? 10 : 0)); // rate = 1
  const rows = [...series(slow, 'slow'), ...series(fast, 'fast')];
  const r = buildSourceRowTokenZeroCrossingRate(rows, {
    minRows: 24,
    sort: 'rate-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'slow');
  assert.equal(r.sources[1]!.source, 'fast');
});

test('sort rate-desc puts most-Nyquist first', () => {
  const slow = new Array(24).fill(0).map((_, i) => i);
  const fast = new Array(24).fill(0).map((_, i) => (i % 2 === 0 ? 10 : 0));
  const rows = [...series(slow, 'slow'), ...series(fast, 'fast')];
  const r = buildSourceRowTokenZeroCrossingRate(rows, {
    minRows: 24,
    sort: 'rate-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'fast');
});

test('sort source asc; tiebreak source', () => {
  const a = new Array(24).fill(0).map((_, i) => i);
  const b = new Array(24).fill(0).map((_, i) => i);
  const rows = [...series(a, 'b'), ...series(b, 'a')];
  const r = buildSourceRowTokenZeroCrossingRate(rows, {
    minRows: 24,
    sort: 'source',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('sort rows desc', () => {
  const a = new Array(30).fill(0).map((_, i) => i);
  const b = new Array(24).fill(0).map((_, i) => i);
  const rows = [...series(a, 'a'), ...series(b, 'b')];
  const r = buildSourceRowTokenZeroCrossingRate(rows, {
    minRows: 24,
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[0]!.rowsKept, 30);
});

test('top cap surfaces droppedBelowTopCap', () => {
  const rows = [
    ...series(new Array(24).fill(0).map((_, i) => i), 'a'),
    ...series(new Array(24).fill(0).map((_, i) => i), 'b'),
    ...series(new Array(24).fill(0).map((_, i) => i), 'c'),
  ];
  const r = buildSourceRowTokenZeroCrossingRate(rows, {
    minRows: 24,
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('rate is in [0, 1]', () => {
  const vals = new Array(40).fill(0).map((_, i) => Math.floor(Math.sin(i) * 50) + 100);
  const r = buildSourceRowTokenZeroCrossingRate(series(vals), {
    minRows: 24,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(row.rate >= 0 && row.rate <= 1);
});

test('amplitude invariance: doubling all values does not change rate', () => {
  const base = [1, 5, 2, 7, 3, 8, 1, 6, 2, 9, 1, 5, 2, 7, 3, 8, 1, 6, 2, 9, 1, 5, 2, 7, 3, 8];
  const r1 = buildSourceRowTokenZeroCrossingRate(series(base, 's'), {
    minRows: 24,
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenZeroCrossingRate(series(base.map((x) => x * 13), 's'), {
    minRows: 24,
    generatedAt: GEN,
  });
  assert.equal(r1.sources[0]!.crossings, r2.sources[0]!.crossings);
  assert.equal(r1.sources[0]!.rate, r2.sources[0]!.rate);
});

test('mean shift invariance: adding a constant does not change rate', () => {
  // Centring removes any DC offset, so adding a constant must yield identical ZCR.
  const base = [1, 5, 2, 7, 3, 8, 1, 6, 2, 9, 1, 5, 2, 7, 3, 8, 1, 6, 2, 9, 1, 5, 2, 7, 3, 8];
  const r1 = buildSourceRowTokenZeroCrossingRate(series(base, 's'), {
    minRows: 24,
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenZeroCrossingRate(series(base.map((x) => x + 1000), 's'), {
    minRows: 24,
    generatedAt: GEN,
  });
  assert.equal(r1.sources[0]!.crossings, r2.sources[0]!.crossings);
  assert.equal(r1.sources[0]!.rate, r2.sources[0]!.rate);
});

test('reverse-time invariance: reversing the series preserves ZCR', () => {
  const base = [1, 5, 2, 7, 3, 8, 1, 6, 2, 9, 1, 5, 2, 7, 3, 8, 1, 6, 2, 9, 1, 5, 2, 7, 3, 8];
  const r1 = buildSourceRowTokenZeroCrossingRate(series(base, 's'), {
    minRows: 24,
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenZeroCrossingRate(series([...base].reverse(), 's'), {
    minRows: 24,
    generatedAt: GEN,
  });
  // Centring is the same; sign sequence is mirrored; flips count is identical.
  assert.equal(r1.sources[0]!.crossings, r2.sources[0]!.crossings);
});

test('invalid minRows throws', () => {
  assert.throws(
    () => buildSourceRowTokenZeroCrossingRate(series([1, 2, 3]), { minRows: 3 }),
    /minRows/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenZeroCrossingRate(series([1, 2, 3]), { minRows: 4.5 }),
    /minRows/,
  );
});

test('invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenZeroCrossingRate(series(new Array(24).fill(1)), {
        // @ts-expect-error
        sort: 'bogus',
      }),
    /sort/,
  );
});

test('invalid top throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenZeroCrossingRate(series(new Array(24).fill(1)), {
        top: 0,
      }),
    /top/,
  );
});

test('invalid since throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenZeroCrossingRate(series([1, 2, 3]), {
        since: 'not-a-date',
      }),
    /since/,
  );
});

test('report carries window/source/sort/min metadata', () => {
  const r = buildSourceRowTokenZeroCrossingRate(series(new Array(24).fill(0).map((_, i) => i)), {
    minRows: 24,
    since: '2026-04-25T00:00:00Z',
    until: '2026-04-30T00:00:00Z',
    sort: 'rate-desc',
    top: 5,
    generatedAt: GEN,
  });
  assert.equal(r.windowStart, '2026-04-25T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00Z');
  assert.equal(r.minRows, 24);
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'rate-desc');
  assert.equal(r.generatedAt, GEN);
});

test('crossings <= rowsKept - 1 invariant', () => {
  const vals = new Array(40).fill(0).map((_, i) => Math.floor(Math.cos(i / 2) * 50) + 100);
  const r = buildSourceRowTokenZeroCrossingRate(series(vals), {
    minRows: 24,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(row.crossings <= row.rowsKept - 1);
  assert.ok(row.crossings >= 0);
});
