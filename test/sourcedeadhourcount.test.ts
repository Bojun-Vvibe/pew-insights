import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceDeadHourCount,
  circularZeroRuns,
} from '../src/sourcedeadhourcount.js';
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

// ---- circularZeroRuns ------------------------------------------------------

test('circularZeroRuns: empty -> 0/0', () => {
  assert.deepEqual(circularZeroRuns([]), { longestRun: 0, runCount: 0 });
});

test('circularZeroRuns: all non-zero -> 0/0', () => {
  assert.deepEqual(circularZeroRuns([1, 2, 3]), { longestRun: 0, runCount: 0 });
});

test('circularZeroRuns: all zero on length-24 -> 24/1', () => {
  const v = new Array(24).fill(0);
  assert.deepEqual(circularZeroRuns(v), { longestRun: 24, runCount: 1 });
});

test('circularZeroRuns: single zero in middle -> 1/1', () => {
  const v = [1, 1, 0, 1, 1];
  assert.deepEqual(circularZeroRuns(v), { longestRun: 1, runCount: 1 });
});

test('circularZeroRuns: contiguous block in middle -> len/1', () => {
  const v = [1, 1, 0, 0, 0, 1, 1];
  assert.deepEqual(circularZeroRuns(v), { longestRun: 3, runCount: 1 });
});

test('circularZeroRuns: zeros wrap across 0/n-1 boundary merge into one run', () => {
  // length 6, zeros at 0,1,5  ->  circular wrap = run of 3 starting at 5
  const v = [0, 0, 1, 1, 1, 0];
  assert.deepEqual(circularZeroRuns(v), { longestRun: 3, runCount: 1 });
});

test('circularZeroRuns: two disjoint zero blocks -> count 2', () => {
  const v = [1, 0, 0, 1, 0, 1];
  assert.deepEqual(circularZeroRuns(v), { longestRun: 2, runCount: 2 });
});

test('circularZeroRuns: longest is the larger of two disjoint blocks', () => {
  const v = [0, 1, 0, 0, 0, 1]; // wrap: start=0..0 + 5..5? no, v[5]=1; non-wrap
  assert.deepEqual(circularZeroRuns(v), { longestRun: 3, runCount: 2 });
});

// ---- builder: validation ---------------------------------------------------

test('build: rejects negative minTokens', () => {
  assert.throws(() => buildSourceDeadHourCount([], { minTokens: -1 }));
});

test('build: rejects non-integer top', () => {
  assert.throws(() => buildSourceDeadHourCount([], { top: 1.5 }));
});

test('build: rejects minDeadHours out of [0,24]', () => {
  assert.throws(() => buildSourceDeadHourCount([], { minDeadHours: -1 }));
  assert.throws(() => buildSourceDeadHourCount([], { minDeadHours: 25 }));
  assert.throws(() => buildSourceDeadHourCount([], { minDeadHours: 1.5 }));
});

test('build: rejects unknown sort', () => {
  assert.throws(() =>
    buildSourceDeadHourCount([], { sort: 'nope' as 'tokens' }),
  );
});

test('build: rejects bad since/until', () => {
  assert.throws(() => buildSourceDeadHourCount([], { since: 'whatever' }));
  assert.throws(() => buildSourceDeadHourCount([], { until: 'nope' }));
});

// ---- builder: counting -----------------------------------------------------

test('build: empty queue -> empty sources', () => {
  const r = buildSourceDeadHourCount([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('build: source covering 1 hour -> deadHours=23, liveHours=1, longestDeadRun=23, runs=1', () => {
  const q: QueueLine[] = [];
  // every-day at 09:00 over 5 days, 5000 tokens each
  for (let d = 1; d <= 5; d++) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T09:00:00.000Z`, 'codex', 5000));
  }
  const r = buildSourceDeadHourCount(q, { generatedAt: GEN, minTokens: 1000 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'codex');
  assert.equal(s.totalTokens, 25000);
  assert.equal(s.deadHours, 23);
  assert.equal(s.liveHours, 1);
  assert.equal(s.longestDeadRun, 23);
  assert.equal(s.deadRunCount, 1);
  assert.ok(Math.abs(s.deadShare - 23 / 24) < 1e-12);
});

test('build: source spanning all 24 hours -> deadHours=0, runs=0', () => {
  const q: QueueLine[] = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'codex', 5000));
  }
  const r = buildSourceDeadHourCount(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.deadHours, 0);
  assert.equal(s.liveHours, 24);
  assert.equal(s.longestDeadRun, 0);
  assert.equal(s.deadRunCount, 0);
});

test('build: source with two blocks, wraparound in dead zone', () => {
  // active hours 6..10 (5 hours); dead hours 0..5 + 11..23 = 6 + 13 = 19
  // circular: dead 11..23 + 0..5 wraps into one run of length 19
  const q: QueueLine[] = [];
  for (const h of [6, 7, 8, 9, 10]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'codex', 1000));
  }
  const r = buildSourceDeadHourCount(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.deadHours, 19);
  assert.equal(s.liveHours, 5);
  assert.equal(s.longestDeadRun, 19);
  assert.equal(s.deadRunCount, 1);
});

test('build: source with two non-adjacent live windows -> two dead runs', () => {
  // active hours 3,4,15,16 -> live=4, dead=20.
  // dead runs (linear): [0..2], [5..14], [17..23] => length 3, 10, 7
  // wrap: 0 and 23 both zero, so [17..23] merges with [0..2] -> length 10
  // remaining: [5..14] length 10
  // both length 10 => longestDeadRun=10, deadRunCount=2
  const q: QueueLine[] = [];
  for (const h of [3, 4, 15, 16]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'codex', 2000));
  }
  const r = buildSourceDeadHourCount(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.deadHours, 20);
  assert.equal(s.liveHours, 4);
  assert.equal(s.longestDeadRun, 10);
  assert.equal(s.deadRunCount, 2);
});

// ---- builder: filters ------------------------------------------------------

test('build: minTokens drops sparse sources', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'big', 5000),
    ql('2026-04-10T10:00:00.000Z', 'small', 100),
  ];
  const r = buildSourceDeadHourCount(q, { generatedAt: GEN, minTokens: 1000 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.totalSources, 2);
});

test('build: source filter restricts and counts dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'a', 5000),
    ql('2026-04-10T10:00:00.000Z', 'b', 5000),
  ];
  const r = buildSourceDeadHourCount(q, {
    generatedAt: GEN,
    source: 'a',
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 1);
});

test('build: invalid hour_start surfaces in dropped count', () => {
  const q: QueueLine[] = [
    ql('not-an-iso', 'a', 5000),
    ql('2026-04-10T09:00:00.000Z', 'a', 5000),
  ];
  const r = buildSourceDeadHourCount(q, { generatedAt: GEN, minTokens: 1000 });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.totalTokens, 5000);
});

test('build: non-positive tokens dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'a', 0),
    ql('2026-04-10T10:00:00.000Z', 'a', -100),
    ql('2026-04-10T11:00:00.000Z', 'a', 5000),
  ];
  const r = buildSourceDeadHourCount(q, { generatedAt: GEN, minTokens: 1000 });
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources[0]!.totalTokens, 5000);
});

test('build: since/until window filter', () => {
  const q: QueueLine[] = [
    ql('2026-04-09T09:00:00.000Z', 'a', 5000),
    ql('2026-04-10T09:00:00.000Z', 'a', 5000),
    ql('2026-04-11T09:00:00.000Z', 'a', 5000),
  ];
  const r = buildSourceDeadHourCount(q, {
    generatedAt: GEN,
    since: '2026-04-10T00:00:00.000Z',
    until: '2026-04-11T00:00:00.000Z',
    minTokens: 1000,
  });
  assert.equal(r.sources[0]!.totalTokens, 5000);
});

// ---- sorting / top ---------------------------------------------------------

test('build: sort=dead orders by deadHours desc', () => {
  const q: QueueLine[] = [];
  // source A: 1 hour live (23 dead)
  q.push(ql('2026-04-10T09:00:00.000Z', 'a', 5000));
  // source B: 5 hours live (19 dead)
  for (const h of [6, 7, 8, 9, 10]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'b', 1500));
  }
  const r = buildSourceDeadHourCount(q, {
    generatedAt: GEN,
    sort: 'dead',
    minTokens: 1000,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('build: sort=live orders by liveHours desc (mirror of dead asc)', () => {
  const q: QueueLine[] = [];
  q.push(ql('2026-04-10T09:00:00.000Z', 'a', 5000));
  for (const h of [6, 7, 8, 9, 10]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'b', 1500));
  }
  const r = buildSourceDeadHourCount(q, {
    generatedAt: GEN,
    sort: 'live',
    minTokens: 1000,
  });
  assert.equal(r.sources[0]!.source, 'b');
});

test('build: sort=source is alphabetical', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'zzz', 5000),
    ql('2026-04-10T10:00:00.000Z', 'aaa', 5000),
  ];
  const r = buildSourceDeadHourCount(q, {
    generatedAt: GEN,
    sort: 'source',
    minTokens: 1000,
  });
  assert.equal(r.sources[0]!.source, 'aaa');
  assert.equal(r.sources[1]!.source, 'zzz');
});

test('build: top caps result and counts dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'a', 5000),
    ql('2026-04-10T10:00:00.000Z', 'b', 4000),
    ql('2026-04-10T11:00:00.000Z', 'c', 3000),
  ];
  const r = buildSourceDeadHourCount(q, {
    generatedAt: GEN,
    top: 2,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

// ---- refinement: --min-dead-hours ------------------------------------------

test('build: minDeadHours filters out dense sources', () => {
  const q: QueueLine[] = [];
  // a: 1 live hour -> 23 dead
  q.push(ql('2026-04-10T09:00:00.000Z', 'a', 5000));
  // b: covers all 24 -> 0 dead
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'b', 1000));
  }
  const r = buildSourceDeadHourCount(q, {
    generatedAt: GEN,
    minDeadHours: 12,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinDeadHours, 1);
});

test('build: minDeadHours=0 is no-op (default behavior)', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'a', 5000),
    ql('2026-04-10T10:00:00.000Z', 'b', 5000),
  ];
  const r = buildSourceDeadHourCount(q, {
    generatedAt: GEN,
    minDeadHours: 0,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowMinDeadHours, 0);
});

test('build: minDeadHours=24 keeps no one (since real sources always have at least 1 live hour)', () => {
  const q: QueueLine[] = [ql('2026-04-10T09:00:00.000Z', 'a', 5000)];
  const r = buildSourceDeadHourCount(q, {
    generatedAt: GEN,
    minDeadHours: 24,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinDeadHours, 1);
});
