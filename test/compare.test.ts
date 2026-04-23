import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  buildCompare,
  resolveComparePreset,
  welchT,
  type CompareWindow,
} from '../src/compare.ts';
import type { QueueLine } from '../src/types.ts';

function q(hour: string, total: number, model = 'gpt-5.4', source = 'cli'): QueueLine {
  return {
    source,
    model,
    hour_start: hour,
    device_id: 'd1',
    input_tokens: total,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

// ---------------------------------------------------------------------------
// welchT
// ---------------------------------------------------------------------------

test('welchT: returns null when either sample has < 2 values', () => {
  assert.equal(welchT([], [1, 2]), null);
  assert.equal(welchT([1], [1, 2]), null);
});

test('welchT: identical samples → 0', () => {
  assert.equal(welchT([5, 5, 5], [5, 5, 5]), 0);
});

test('welchT: clearly larger A vs B → positive t', () => {
  const t = welchT([100, 110, 105, 120], [10, 12, 11, 9]);
  assert.ok(t !== null && t > 5, `t=${t}`);
});

test('welchT: equal means with non-zero variance → ~0', () => {
  const t = welchT([10, 12, 8, 10], [9, 11, 11, 9]);
  assert.ok(t !== null && Math.abs(t) < 1.5);
});

test('welchT: zero-variance samples with different means → ±Infinity', () => {
  assert.equal(welchT([5, 5, 5], [3, 3, 3]), Infinity);
  assert.equal(welchT([1, 1, 1], [9, 9, 9]), -Infinity);
});

// ---------------------------------------------------------------------------
// resolveComparePreset
// ---------------------------------------------------------------------------

test('resolveComparePreset: this-week-vs-last-week aliases all return same result', () => {
  const at = '2026-04-22T12:00:00Z';
  const a = resolveComparePreset('this-week-vs-last-week', at);
  const b = resolveComparePreset('wow', at);
  const c = resolveComparePreset('week-over-week', at);
  assert.deepEqual(a, b);
  assert.deepEqual(b, c);
});

test('resolveComparePreset: this-week aligns to ISO Monday', () => {
  // 2026-04-22 Wed → Monday is 2026-04-20.
  const r = resolveComparePreset('wow', '2026-04-22T12:00:00Z');
  assert.ok(r);
  assert.equal(r!.a.from.slice(0, 10), '2026-04-20');
  assert.equal(r!.a.until.slice(0, 10), '2026-04-27');
  assert.equal(r!.b.from.slice(0, 10), '2026-04-13');
  assert.equal(r!.b.until.slice(0, 10), '2026-04-20');
});

test('resolveComparePreset: today-vs-yesterday', () => {
  const r = resolveComparePreset('dod', '2026-04-22T12:00:00Z');
  assert.ok(r);
  assert.equal(r!.a.label, 'today');
  assert.equal(r!.a.from.slice(0, 10), '2026-04-22');
  assert.equal(r!.b.from.slice(0, 10), '2026-04-21');
});

test('resolveComparePreset: last-7d-vs-prior-7d', () => {
  const r = resolveComparePreset('rolling-week', '2026-04-22T12:00:00Z');
  assert.ok(r);
  assert.equal(r!.a.label, 'last-7d');
  assert.equal(r!.b.label, 'prior-7d');
});

test('resolveComparePreset: unknown returns null', () => {
  assert.equal(resolveComparePreset('not-a-preset'), null);
});

// ---------------------------------------------------------------------------
// buildCompare
// ---------------------------------------------------------------------------

const A: CompareWindow = {
  label: 'A',
  from: '2026-04-15T00:00:00.000Z',
  until: '2026-04-22T00:00:00.000Z',
};
const B: CompareWindow = {
  label: 'B',
  from: '2026-04-08T00:00:00.000Z',
  until: '2026-04-15T00:00:00.000Z',
};

test('buildCompare: empty queue → no rows, totals zero', () => {
  const r = buildCompare([], A, B, 'model');
  assert.equal(r.rows.length, 0);
  assert.equal(r.aTotalTokens, 0);
  assert.equal(r.bTotalTokens, 0);
});

test('buildCompare: events outside both windows are ignored', () => {
  const queue: QueueLine[] = [
    q('2026-04-01T12:00:00.000Z', 1000), // before B
    q('2026-04-25T12:00:00.000Z', 1000), // after A
  ];
  const r = buildCompare(queue, A, B, 'model');
  assert.equal(r.rows.length, 0);
});

test('buildCompare: a single key in A only, B has no data', () => {
  const queue: QueueLine[] = [
    q('2026-04-16T12:00:00.000Z', 100, 'gpt-5.4'),
    q('2026-04-17T12:00:00.000Z', 200, 'gpt-5.4'),
  ];
  const r = buildCompare(queue, A, B, 'model');
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].key, 'gpt-5.4');
  assert.equal(r.rows[0].aTokens, 300);
  assert.equal(r.rows[0].bTokens, 0);
  assert.equal(r.rows[0].pct, null);
});

test('buildCompare: dimension="source" groups by source', () => {
  const queue: QueueLine[] = [
    q('2026-04-16T12:00:00.000Z', 100, 'm1', 'cli'),
    q('2026-04-16T12:00:00.000Z', 50, 'm2', 'cli'),
    q('2026-04-16T12:00:00.000Z', 200, 'm1', 'web'),
  ];
  const r = buildCompare(queue, A, B, 'source');
  const keys = r.rows.map((r) => r.key).sort();
  assert.deepEqual(keys, ['cli', 'web']);
});

test('buildCompare: rows sorted by absolute delta descending', () => {
  const queue: QueueLine[] = [
    q('2026-04-16T12:00:00.000Z', 1000, 'big'),
    q('2026-04-16T12:00:00.000Z', 50, 'small'),
    q('2026-04-09T12:00:00.000Z', 1, 'big'),
    q('2026-04-09T12:00:00.000Z', 1, 'small'),
  ];
  const r = buildCompare(queue, A, B, 'model');
  assert.equal(r.rows[0].key, 'big');
});

test('buildCompare: minTokens filters out small keys', () => {
  const queue: QueueLine[] = [
    q('2026-04-16T12:00:00.000Z', 1000, 'big'),
    q('2026-04-16T12:00:00.000Z', 5, 'tiny'),
  ];
  const r = buildCompare(queue, A, B, 'model', { minTokens: 100 });
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].key, 'big');
});

test('buildCompare: topN caps row count', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i++) {
    queue.push(q('2026-04-16T12:00:00.000Z', 100, `m${i}`));
  }
  const r = buildCompare(queue, A, B, 'model', { topN: 3 });
  assert.equal(r.rows.length, 3);
});

test('buildCompare: insufficient hint when < 2 days per window', () => {
  const queue: QueueLine[] = [
    // 1 day each window
    q('2026-04-16T12:00:00.000Z', 100, 'm1'),
    q('2026-04-09T12:00:00.000Z', 50, 'm1'),
  ];
  // Use single-day windows so series length forced to 1.
  const a1: CompareWindow = { label: 'A', from: '2026-04-16T00:00:00Z', until: '2026-04-17T00:00:00Z' };
  const b1: CompareWindow = { label: 'B', from: '2026-04-09T00:00:00Z', until: '2026-04-10T00:00:00Z' };
  const r = buildCompare(queue, a1, b1, 'model');
  assert.equal(r.rows[0].hint, 'insufficient');
});

test('buildCompare: significant hint when A clearly > B across days', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 7; i++) {
    const aDay = String(15 + i).padStart(2, '0');
    const bDay = String(8 + i).padStart(2, '0');
    queue.push(q(`2026-04-${aDay}T12:00:00.000Z`, 1000, 'm1'));
    queue.push(q(`2026-04-${bDay}T12:00:00.000Z`, 10, 'm1'));
  }
  const r = buildCompare(queue, A, B, 'model');
  assert.equal(r.rows[0].hint, 'significant');
  assert.ok(r.rows[0].t !== null && Math.abs(r.rows[0].t) >= 1.96);
});

test('buildCompare: not-significant or weak hint when A and B largely overlap', () => {
  // Identical means, identical variance — should land in n/s (Welch t == 0).
  const aVals = [100, 105, 95, 110, 98, 102, 97];
  const queue: QueueLine[] = [];
  for (let i = 0; i < 7; i++) {
    const aDay = String(15 + i).padStart(2, '0');
    const bDay = String(8 + i).padStart(2, '0');
    queue.push(q(`2026-04-${aDay}T12:00:00.000Z`, aVals[i], 'm1'));
    queue.push(q(`2026-04-${bDay}T12:00:00.000Z`, aVals[i], 'm1'));
  }
  const r = buildCompare(queue, A, B, 'model');
  assert.equal(r.rows[0].t, 0);
  assert.equal(r.rows[0].hint, 'n/s');
});

test('buildCompare: pct uses B as denominator and is null when B=0', () => {
  const queue: QueueLine[] = [
    q('2026-04-16T12:00:00.000Z', 200, 'm1'),
  ];
  const r = buildCompare(queue, A, B, 'model');
  assert.equal(r.rows[0].pct, null);

  const queue2: QueueLine[] = [
    q('2026-04-16T12:00:00.000Z', 200, 'm1'),
    q('2026-04-09T12:00:00.000Z', 100, 'm1'),
  ];
  const r2 = buildCompare(queue2, A, B, 'model');
  assert.equal(r2.rows[0].pct, 1.0);
});
