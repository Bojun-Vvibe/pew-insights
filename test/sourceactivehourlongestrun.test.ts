import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceActiveHourLongestRun,
  circularPositiveRuns,
} from '../src/sourceactivehourlongestrun.js';
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

// ---- circularPositiveRuns --------------------------------------------------

test('circularPositiveRuns: empty -> 0/0/-1', () => {
  assert.deepEqual(circularPositiveRuns([]), {
    longestRun: 0,
    runCount: 0,
    longestRunStart: -1,
  });
});

test('circularPositiveRuns: all zero -> 0/0/-1', () => {
  assert.deepEqual(circularPositiveRuns([0, 0, 0]), {
    longestRun: 0,
    runCount: 0,
    longestRunStart: -1,
  });
});

test('circularPositiveRuns: all positive on length-24 -> 24/1/0', () => {
  const v = new Array(24).fill(5);
  assert.deepEqual(circularPositiveRuns(v), {
    longestRun: 24,
    runCount: 1,
    longestRunStart: 0,
  });
});

test('circularPositiveRuns: single positive in middle -> 1/1/start=2', () => {
  const v = [0, 0, 1, 0, 0];
  assert.deepEqual(circularPositiveRuns(v), {
    longestRun: 1,
    runCount: 1,
    longestRunStart: 2,
  });
});

test('circularPositiveRuns: contiguous block in middle -> len/1/start', () => {
  const v = [0, 0, 1, 1, 1, 0, 0];
  assert.deepEqual(circularPositiveRuns(v), {
    longestRun: 3,
    runCount: 1,
    longestRunStart: 2,
  });
});

test('circularPositiveRuns: positives wrap across boundary merge into one run', () => {
  // length 6, positives at 0,1,5 -> circular wrap = run of 3 starting at 5
  const v = [1, 1, 0, 0, 0, 1];
  const got = circularPositiveRuns(v);
  assert.equal(got.longestRun, 3);
  assert.equal(got.runCount, 1);
  assert.equal(got.longestRunStart, 5);
});

test('circularPositiveRuns: two disjoint positive blocks -> count 2', () => {
  const v = [0, 1, 1, 0, 1, 0];
  const got = circularPositiveRuns(v);
  assert.equal(got.longestRun, 2);
  assert.equal(got.runCount, 2);
});

test('circularPositiveRuns: longest is the larger of two disjoint blocks', () => {
  const v = [1, 0, 1, 1, 1, 0]; // runs: [0..0]len1, [2..4]len3; v[5]=0 so no wrap
  const got = circularPositiveRuns(v);
  assert.equal(got.longestRun, 3);
  assert.equal(got.runCount, 2);
  assert.equal(got.longestRunStart, 2);
});

// ---- builder: validation ---------------------------------------------------

test('build: rejects negative minTokens', () => {
  assert.throws(() => buildSourceActiveHourLongestRun([], { minTokens: -1 }));
});

test('build: rejects non-integer top', () => {
  assert.throws(() => buildSourceActiveHourLongestRun([], { top: 1.5 }));
});

test('build: rejects minLongestActiveRun out of [0,24]', () => {
  assert.throws(() =>
    buildSourceActiveHourLongestRun([], { minLongestActiveRun: -1 }),
  );
  assert.throws(() =>
    buildSourceActiveHourLongestRun([], { minLongestActiveRun: 25 }),
  );
  assert.throws(() =>
    buildSourceActiveHourLongestRun([], { minLongestActiveRun: 1.5 }),
  );
});

test('build: rejects unknown sort', () => {
  assert.throws(() =>
    buildSourceActiveHourLongestRun([], { sort: 'nope' as 'tokens' }),
  );
});

test('build: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceActiveHourLongestRun([], { since: 'whatever' }),
  );
  assert.throws(() => buildSourceActiveHourLongestRun([], { until: 'nope' }));
});

// ---- builder: counting -----------------------------------------------------

test('build: empty queue -> empty sources', () => {
  const r = buildSourceActiveHourLongestRun([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('build: source covering 1 hour -> activeHours=1, longestActiveRun=1, runs=1, share=1', () => {
  const q: QueueLine[] = [];
  for (let d = 1; d <= 5; d++) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T09:00:00.000Z`, 'codex', 5000));
  }
  const r = buildSourceActiveHourLongestRun(q, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'codex');
  assert.equal(s.totalTokens, 25000);
  assert.equal(s.activeHours, 1);
  assert.equal(s.longestActiveRun, 1);
  assert.equal(s.activeRunCount, 1);
  assert.equal(s.activeRunShare, 1);
  assert.equal(s.longestRunStart, 9);
});

test('build: source spanning all 24 hours -> activeHours=24, longestActiveRun=24, runs=1', () => {
  const q: QueueLine[] = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'codex', 5000));
  }
  const r = buildSourceActiveHourLongestRun(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.activeHours, 24);
  assert.equal(s.longestActiveRun, 24);
  assert.equal(s.activeRunCount, 1);
  assert.equal(s.activeRunShare, 1);
  assert.equal(s.longestRunStart, 0);
});

test('build: contiguous 5-hour block -> longestActiveRun=5/runs=1/share=1', () => {
  const q: QueueLine[] = [];
  for (const h of [6, 7, 8, 9, 10]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'codex', 1000));
  }
  const r = buildSourceActiveHourLongestRun(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.activeHours, 5);
  assert.equal(s.longestActiveRun, 5);
  assert.equal(s.activeRunCount, 1);
  assert.equal(s.activeRunShare, 1);
  assert.equal(s.longestRunStart, 6);
});

test('build: split active mass -> longestActiveRun smaller than activeHours, runs=2', () => {
  // active hours [3,4] and [15,16] -> 4 active hours, longest run 2,
  // both runs equal length so deterministic earliest start (3).
  const q: QueueLine[] = [];
  for (const h of [3, 4, 15, 16]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'codex', 2000));
  }
  const r = buildSourceActiveHourLongestRun(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.activeHours, 4);
  assert.equal(s.longestActiveRun, 2);
  assert.equal(s.activeRunCount, 2);
  assert.ok(Math.abs(s.activeRunShare - 0.5) < 1e-12);
  assert.equal(s.longestRunStart, 3);
});

test('build: scattered active hours alternate -> longestActiveRun=1, runs=12', () => {
  const q: QueueLine[] = [];
  for (let h = 0; h < 24; h += 2) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'scatter', 1500));
  }
  const r = buildSourceActiveHourLongestRun(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.activeHours, 12);
  assert.equal(s.longestActiveRun, 1);
  assert.equal(s.activeRunCount, 12);
});

test('build: active mass wraps midnight -> single contiguous run across boundary', () => {
  // active hours 22, 23, 0, 1 -> circular run of length 4 starting at 22
  const q: QueueLine[] = [];
  for (const h of [22, 23, 0, 1]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'nightowl', 1500));
  }
  const r = buildSourceActiveHourLongestRun(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.activeHours, 4);
  assert.equal(s.longestActiveRun, 4);
  assert.equal(s.activeRunCount, 1);
  assert.equal(s.activeRunShare, 1);
  assert.equal(s.longestRunStart, 22);
});

// ---- builder: filters ------------------------------------------------------

test('build: minTokens drops sparse sources', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'big', 5000),
    ql('2026-04-10T10:00:00.000Z', 'small', 100),
  ];
  const r = buildSourceActiveHourLongestRun(q, {
    generatedAt: GEN,
    minTokens: 1000,
  });
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
  const r = buildSourceActiveHourLongestRun(q, {
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
  const r = buildSourceActiveHourLongestRun(q, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.totalTokens, 5000);
});

test('build: non-positive tokens dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'a', 0),
    ql('2026-04-10T10:00:00.000Z', 'a', -100),
    ql('2026-04-10T11:00:00.000Z', 'a', 5000),
  ];
  const r = buildSourceActiveHourLongestRun(q, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources[0]!.totalTokens, 5000);
});

test('build: since/until window filter', () => {
  const q: QueueLine[] = [
    ql('2026-04-09T09:00:00.000Z', 'a', 5000),
    ql('2026-04-10T09:00:00.000Z', 'a', 5000),
    ql('2026-04-11T09:00:00.000Z', 'a', 5000),
  ];
  const r = buildSourceActiveHourLongestRun(q, {
    generatedAt: GEN,
    since: '2026-04-10T00:00:00.000Z',
    until: '2026-04-11T00:00:00.000Z',
    minTokens: 1000,
  });
  assert.equal(r.sources[0]!.totalTokens, 5000);
});

// ---- sorting / top ---------------------------------------------------------

test('build: sort=run orders by longestActiveRun desc', () => {
  const q: QueueLine[] = [];
  // a: 1 active hour
  q.push(ql('2026-04-10T09:00:00.000Z', 'a', 5000));
  // b: 5 contiguous hours
  for (const h of [6, 7, 8, 9, 10]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'b', 1500));
  }
  const r = buildSourceActiveHourLongestRun(q, {
    generatedAt: GEN,
    sort: 'run',
    minTokens: 1000,
  });
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[1]!.source, 'a');
});

test('build: sort=share orders by activeRunShare desc', () => {
  const q: QueueLine[] = [];
  // contiguous: 5 contiguous active hours -> share 1.0
  for (const h of [6, 7, 8, 9, 10]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'contig', 1500));
  }
  // split: 2+2 -> share 0.5
  for (const h of [3, 4, 15, 16]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'split', 2000));
  }
  const r = buildSourceActiveHourLongestRun(q, {
    generatedAt: GEN,
    sort: 'share',
    minTokens: 1000,
  });
  assert.equal(r.sources[0]!.source, 'contig');
  assert.equal(r.sources[1]!.source, 'split');
});

test('build: sort=source is alphabetical', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'zzz', 5000),
    ql('2026-04-10T10:00:00.000Z', 'aaa', 5000),
  ];
  const r = buildSourceActiveHourLongestRun(q, {
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
  const r = buildSourceActiveHourLongestRun(q, {
    generatedAt: GEN,
    top: 2,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

// ---- refinement: --min-longest-active-run ----------------------------------

test('build: minLongestActiveRun filters sources below threshold', () => {
  const q: QueueLine[] = [];
  // 'shift': 8 contiguous active hours
  for (let h = 0; h < 8; h++) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'shift', 1500));
  }
  // 'bursty': 4 scattered active hours, longestActiveRun=1
  for (const h of [0, 6, 12, 18]) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'bursty', 1500));
  }
  const all = buildSourceActiveHourLongestRun(q, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(all.sources.length, 2);

  const r = buildSourceActiveHourLongestRun(q, {
    generatedAt: GEN,
    minLongestActiveRun: 5,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'shift');
  assert.equal(r.droppedBelowMinLongestActiveRun, 1);
});

test('build: minLongestActiveRun=0 is no-op (default)', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'a', 5000),
    ql('2026-04-10T10:00:00.000Z', 'b', 5000),
  ];
  const r = buildSourceActiveHourLongestRun(q, {
    generatedAt: GEN,
    minLongestActiveRun: 0,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowMinLongestActiveRun, 0);
});

// ---- refinement (v0.6.45): --min-active-hours ------------------------------

test('build: rejects minActiveHours out of [0,24]', () => {
  assert.throws(() =>
    buildSourceActiveHourLongestRun([], { minActiveHours: -1 }),
  );
  assert.throws(() =>
    buildSourceActiveHourLongestRun([], { minActiveHours: 25 }),
  );
  assert.throws(() =>
    buildSourceActiveHourLongestRun([], { minActiveHours: 1.5 }),
  );
});

test('build: minActiveHours=0 is no-op (default)', () => {
  const q: QueueLine[] = [
    ql('2026-04-10T09:00:00.000Z', 'a', 5000),
    ql('2026-04-10T10:00:00.000Z', 'b', 5000),
  ];
  const r = buildSourceActiveHourLongestRun(q, {
    generatedAt: GEN,
    minActiveHours: 0,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowMinActiveHours, 0);
});

test('build: minActiveHours filters by raw count regardless of contiguity', () => {
  const q: QueueLine[] = [];
  // 'shift': 8 contiguous active hours -> activeHours=8, longestActiveRun=8
  for (let h = 0; h < 8; h++) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'shift', 1500));
  }
  // 'scattered': 12 alternating hours -> activeHours=12, longestActiveRun=1
  for (let h = 0; h < 24; h += 2) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'scattered', 1500));
  }
  const r = buildSourceActiveHourLongestRun(q, {
    generatedAt: GEN,
    minActiveHours: 10,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'scattered');
  assert.equal(r.droppedBelowMinActiveHours, 1);
});

test('build: minActiveHours and minLongestActiveRun compose by intersection', () => {
  const q: QueueLine[] = [];
  // 'a': 8 contiguous -> activeHours=8, longestActiveRun=8
  for (let h = 0; h < 8; h++) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'a', 1500));
  }
  // 'b': 12 alternating -> activeHours=12, longestActiveRun=1
  for (let h = 0; h < 24; h += 2) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'b', 1500));
  }
  // 'c': 14 contiguous -> activeHours=14, longestActiveRun=14
  for (let h = 0; h < 14; h++) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-10T${hh}:00:00.000Z`, 'c', 1500));
  }
  // require BOTH activeHours>=10 AND longestActiveRun>=6
  // a: activeHours=8 fails first gate -> dropped by minActiveHours? No,
  //    filter order is minLongestActiveRun first then minActiveHours.
  // Verify both gates eliminate the right rows in either order semantically.
  const r = buildSourceActiveHourLongestRun(q, {
    generatedAt: GEN,
    minActiveHours: 10,
    minLongestActiveRun: 6,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'c');
});
