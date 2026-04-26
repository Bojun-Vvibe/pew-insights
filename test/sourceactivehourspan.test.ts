import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceActiveHourSpan,
  circularMinimumArcCover,
} from '../src/sourceactivehourspan.js';
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

const GEN = '2026-04-26T12:00:00.000Z';

// ---- circularMinimumArcCover ----------------------------------------------

test('circularMinimumArcCover: empty -> span 0', () => {
  assert.deepEqual(circularMinimumArcCover([]), {
    span: 0,
    startHour: -1,
    endHour: -1,
    largestGap: 0,
  });
});

test('circularMinimumArcCover: all zero -> span 0', () => {
  assert.deepEqual(circularMinimumArcCover(new Array(24).fill(0)), {
    span: 0,
    startHour: -1,
    endHour: -1,
    largestGap: 0,
  });
});

test('circularMinimumArcCover: all positive -> span n, gap 0', () => {
  const v = new Array(24).fill(5);
  assert.deepEqual(circularMinimumArcCover(v), {
    span: 24,
    startHour: 0,
    endHour: 23,
    largestGap: 0,
  });
});

test('circularMinimumArcCover: single positive -> span 1, gap n-1', () => {
  const v = new Array(24).fill(0);
  v[9] = 7;
  assert.deepEqual(circularMinimumArcCover(v), {
    span: 1,
    startHour: 9,
    endHour: 9,
    largestGap: 23,
  });
});

test('circularMinimumArcCover: contiguous block, no wrap', () => {
  // active hours 6..10 (5 hours)
  const v = new Array(24).fill(0);
  for (const h of [6, 7, 8, 9, 10]) v[h] = 1;
  // largest gap is 24 - 5 = 19, between 10 and 6 (wrap)
  // span = 5, starts at 6, ends at 10
  assert.deepEqual(circularMinimumArcCover(v), {
    span: 5,
    startHour: 6,
    endHour: 10,
    largestGap: 19,
  });
});

test('circularMinimumArcCover: wraparound active block', () => {
  // active hours 22, 23, 0, 1 (4 hours wrapping)
  const v = new Array(24).fill(0);
  for (const h of [22, 23, 0, 1]) v[h] = 1;
  // gaps between sorted actives [0,1,22,23]: 0->1 = 0, 1->22 = 20, 22->23 = 0; wrap 23->0 = 0
  // largest gap = 20, span = 24 - 20 = 4, starts after gap end -> active immediately after the gap
  // gap of 20 sits between active index 1 (hour 1) and active index 2 (hour 22), so start = 22
  assert.deepEqual(circularMinimumArcCover(v), {
    span: 4,
    startHour: 22,
    endHour: 1,
    largestGap: 20,
  });
});

test('circularMinimumArcCover: scattered actives -> span > activeHours', () => {
  // active at 0, 6, 18 -> sorted gaps: 0->6 = 5, 6->18 = 11, wrap 18->0 = 5
  // largest gap = 11, span = 24-11 = 13. Start = active after the gap = 18, end = (18+13-1) mod 24 = 6
  const v = new Array(24).fill(0);
  for (const h of [0, 6, 18]) v[h] = 1;
  assert.deepEqual(circularMinimumArcCover(v), {
    span: 13,
    startHour: 18,
    endHour: 6,
    largestGap: 11,
  });
});

test('circularMinimumArcCover: tie on gaps prefers earlier-indexed start (deterministic)', () => {
  // Two equal gaps: actives at [0, 12] -> gap 0->12 = 11, wrap 12->0 = 11
  // First gap of size 11 found at i=0 (between actives[0] and actives[1])
  // -> start = actives[1] = 12
  // (Determinism: first largest gap wins; the wrap gap is checked after.)
  const v = new Array(24).fill(0);
  v[0] = 1;
  v[12] = 1;
  const r = circularMinimumArcCover(v);
  assert.equal(r.span, 13);
  assert.equal(r.largestGap, 11);
  assert.equal(r.startHour, 12);
  assert.equal(r.endHour, 0);
});

// ---- builder validation ----------------------------------------------------

test('build: rejects negative minTokens', () => {
  assert.throws(() => buildSourceActiveHourSpan([], { minTokens: -1 }));
});

test('build: rejects non-integer top', () => {
  assert.throws(() => buildSourceActiveHourSpan([], { top: 1.5 }));
});

test('build: rejects maxSpan out of [0,24]', () => {
  assert.throws(() => buildSourceActiveHourSpan([], { maxSpan: -1 }));
  assert.throws(() => buildSourceActiveHourSpan([], { maxSpan: 25 }));
  assert.throws(() => buildSourceActiveHourSpan([], { maxSpan: 1.5 }));
});

test('build: rejects unknown sort', () => {
  assert.throws(() =>
    buildSourceActiveHourSpan([], { sort: 'nope' as 'tokens' }),
  );
});

test('build: rejects bad since/until', () => {
  assert.throws(() => buildSourceActiveHourSpan([], { since: 'whatever' }));
  assert.throws(() => buildSourceActiveHourSpan([], { until: 'nope' }));
});

// ---- builder: counting ----------------------------------------------------

test('build: empty -> empty', () => {
  const r = buildSourceActiveHourSpan([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('build: one-hour source -> span 1, gap 23, density 1.0', () => {
  const q: QueueLine[] = [];
  for (let d = 1; d <= 5; d++) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T09:00:00.000Z`, 'codex', 5000));
  }
  const r = buildSourceActiveHourSpan(q, { generatedAt: GEN, minTokens: 1000 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.activeHours, 1);
  assert.equal(s.circularSpan, 1);
  assert.equal(s.spanStartHour, 9);
  assert.equal(s.spanEndHour, 9);
  assert.equal(s.largestQuietGap, 23);
  assert.equal(s.spanDensity, 1);
});

test('build: source covering all 24 hours -> span 24, density 1.0', () => {
  const q: QueueLine[] = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'codex', 5000));
  }
  const r = buildSourceActiveHourSpan(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.activeHours, 24);
  assert.equal(s.circularSpan, 24);
  assert.equal(s.largestQuietGap, 0);
  assert.equal(s.spanDensity, 1);
});

test('build: contiguous active block 6..10 -> span 5, gap 19', () => {
  const q: QueueLine[] = [];
  for (const h of [6, 7, 8, 9, 10]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'codex', 1000));
  }
  const r = buildSourceActiveHourSpan(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.activeHours, 5);
  assert.equal(s.circularSpan, 5);
  assert.equal(s.spanStartHour, 6);
  assert.equal(s.spanEndHour, 10);
  assert.equal(s.spanDensity, 1);
});

test('build: scattered actives expose density < 1.0', () => {
  // active at 0, 6, 18 -> activeHours=3, span=13, density=3/13
  const q: QueueLine[] = [];
  for (const h of [0, 6, 18]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'codex', 1500));
  }
  const r = buildSourceActiveHourSpan(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.activeHours, 3);
  assert.equal(s.circularSpan, 13);
  assert.equal(s.spanStartHour, 18);
  assert.equal(s.spanEndHour, 6);
  assert.ok(Math.abs(s.spanDensity - 3 / 13) < 1e-12);
});

// ---- filters ---------------------------------------------------------------

test('build: minTokens drops sparse', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'big', 5000),
    ql('2026-04-10T10:00:00.000Z', 'small', 100),
  ];
  const r = buildSourceActiveHourSpan(q, { generatedAt: GEN, minTokens: 1000 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('build: source filter restricts and counts dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'a', 5000),
    ql('2026-04-10T10:00:00.000Z', 'b', 5000),
  ];
  const r = buildSourceActiveHourSpan(q, {
    generatedAt: GEN,
    source: 'a',
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedSourceFilter, 1);
});

test('build: invalid hour_start surfaces in dropped count', () => {
  const q: QueueLine[] = [
    ql('not-an-iso', 'a', 5000),
    ql('2026-04-10T09:00:00.000Z', 'a', 5000),
  ];
  const r = buildSourceActiveHourSpan(q, { generatedAt: GEN, minTokens: 1000 });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: non-positive tokens dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'a', 0),
    ql('2026-04-10T10:00:00.000Z', 'a', 5000),
  ];
  const r = buildSourceActiveHourSpan(q, { generatedAt: GEN, minTokens: 1000 });
  assert.equal(r.droppedNonPositiveTokens, 1);
});

test('build: since/until window filter', () => {
  const q: QueueLine[] = [
    ql('2026-04-09T09:00:00.000Z', 'a', 5000),
    ql('2026-04-10T09:00:00.000Z', 'a', 5000),
    ql('2026-04-11T09:00:00.000Z', 'a', 5000),
  ];
  const r = buildSourceActiveHourSpan(q, {
    generatedAt: GEN,
    since: '2026-04-10T00:00:00.000Z',
    until: '2026-04-11T00:00:00.000Z',
    minTokens: 1000,
  });
  assert.equal(r.sources[0]!.totalTokens, 5000);
});

// ---- sorting / top ---------------------------------------------------------

test('build: sort=span orders by circularSpan desc', () => {
  const q: QueueLine[] = [];
  // a: 1 active hour -> span 1
  q.push(ql('2026-04-10T09:00:00.000Z', 'a', 5000));
  // b: scattered 0,6,18 -> span 13
  for (const h of [0, 6, 18]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'b', 1500));
  }
  const r = buildSourceActiveHourSpan(q, {
    generatedAt: GEN,
    sort: 'span',
    minTokens: 1000,
  });
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[1]!.source, 'a');
});

test('build: sort=density orders by spanDensity desc', () => {
  const q: QueueLine[] = [];
  // a: contiguous 6..10 -> density 1.0
  for (const h of [6, 7, 8, 9, 10]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'a', 1500));
  }
  // b: scattered 0,6,18 -> density 3/13
  for (const h of [0, 6, 18]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'b', 1500));
  }
  const r = buildSourceActiveHourSpan(q, {
    generatedAt: GEN,
    sort: 'density',
    minTokens: 1000,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('build: sort=source alphabetical', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'zzz', 5000),
    ql('2026-04-10T10:00:00.000Z', 'aaa', 5000),
  ];
  const r = buildSourceActiveHourSpan(q, {
    generatedAt: GEN,
    sort: 'source',
    minTokens: 1000,
  });
  assert.equal(r.sources[0]!.source, 'aaa');
});

test('build: top caps and counts dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'a', 5000),
    ql('2026-04-10T10:00:00.000Z', 'b', 4000),
    ql('2026-04-10T11:00:00.000Z', 'c', 3000),
  ];
  const r = buildSourceActiveHourSpan(q, {
    generatedAt: GEN,
    top: 2,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

// ---- refinement: --max-span -----------------------------------------------

test('build: maxSpan=0 is no-op (default)', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'a', 5000),
    ql('2026-04-10T18:00:00.000Z', 'a', 5000),
  ];
  const r = buildSourceActiveHourSpan(q, {
    generatedAt: GEN,
    maxSpan: 0,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedAboveMaxSpan, 0);
});

test('build: maxSpan filters sources with wide waking windows', () => {
  const q: QueueLine[] = [];
  // 'narrow': active 09..11 -> span 3
  for (const h of [9, 10, 11]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'narrow', 1500));
  }
  // 'wide': active 0,6,18 -> span 13
  for (const h of [0, 6, 18]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'wide', 1500));
  }
  const r = buildSourceActiveHourSpan(q, {
    generatedAt: GEN,
    maxSpan: 8,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'narrow');
  assert.equal(r.droppedAboveMaxSpan, 1);
});

test('build: maxSpan=24 keeps everyone (effective no-op while echoing the knob)', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'a', 5000),
    ql('2026-04-10T18:00:00.000Z', 'a', 5000),
  ];
  const r = buildSourceActiveHourSpan(q, {
    generatedAt: GEN,
    maxSpan: 24,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedAboveMaxSpan, 0);
});
