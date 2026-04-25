import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildRollingBucketCv } from '../src/rollingbucketcv.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, tokens: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

// ---- option validation -----------------------------------------------------

test('rolling-bucket-cv: rejects bad windowSize', () => {
  assert.throws(() => buildRollingBucketCv([], { windowSize: 1 }));
  assert.throws(() => buildRollingBucketCv([], { windowSize: 1.5 }));
  assert.throws(() => buildRollingBucketCv([], { windowSize: -2 }));
});

test('rolling-bucket-cv: rejects bad top / minBuckets', () => {
  assert.throws(() => buildRollingBucketCv([], { top: -1 }));
  assert.throws(() => buildRollingBucketCv([], { top: 1.5 }));
  assert.throws(() => buildRollingBucketCv([], { minBuckets: -1 }));
});

test('rolling-bucket-cv: rejects bad since/until', () => {
  assert.throws(() => buildRollingBucketCv([], { since: 'no' }));
  assert.throws(() => buildRollingBucketCv([], { until: 'nope' }));
});

// ---- empty / sparse --------------------------------------------------------

test('rolling-bucket-cv: empty input has zero population', () => {
  const r = buildRollingBucketCv([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalWindows, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.windowSize, 12);
});

test('rolling-bucket-cv: source with fewer active buckets than windowSize is dropped sparse', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-01T01:00:00.000Z', 'a', 200),
    ql('2026-04-01T02:00:00.000Z', 'a', 300),
  ];
  const r = buildRollingBucketCv(queue, { windowSize: 4, generatedAt: GEN });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedSparseSources, 1);
  assert.deepEqual(r.sources, []);
});

// ---- core math -------------------------------------------------------------

test('rolling-bucket-cv: flat series has zero CV in every window', () => {
  const queue: QueueLine[] = [];
  for (let h = 0; h < 6; h++) {
    queue.push(
      ql(
        `2026-04-01T0${h}:00:00.000Z`,
        'flat',
        100,
      ),
    );
  }
  const r = buildRollingBucketCv(queue, { windowSize: 3, generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.windowCount, 4);
  assert.equal(row.minCv, 0);
  assert.equal(row.p50Cv, 0);
  assert.equal(row.p90Cv, 0);
  assert.equal(row.maxCv, 0);
  assert.equal(row.meanCv, 0);
  assert.equal(row.globalCv, 0);
  // peakWindowStart ties broken by earliest start.
  assert.equal(row.peakWindowStart, '2026-04-01T00:00:00.000Z');
});

test('rolling-bucket-cv: known spike isolates a peak window', () => {
  // 5 flat buckets (100 each) then a 1000 spike then 5 flat (100 each).
  const series = [100, 100, 100, 100, 100, 1000, 100, 100, 100, 100, 100];
  const queue = series.map((tt, i) => {
    const hh = i.toString().padStart(2, '0');
    return ql(`2026-04-01T${hh}:00:00.000Z`, 'spiky', tt);
  });
  const r = buildRollingBucketCv(queue, { windowSize: 3, generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.activeBuckets, 11);
  assert.equal(row.windowCount, 9);
  // The peak window is one of the three windows containing the spike.
  // For window-size 3 the spike at index 5 is contained in windows
  // starting at index 3, 4, 5 (i.e. covers indices [3..5], [4..6], [5..7]).
  // Of these the one centered on the spike (start=5: [1000,100,100])
  // and start=3: [100,100,1000] and start=4: [100,1000,100] all have
  // identical CV (same multiset). Tie-break is earliest start.
  assert.equal(row.peakWindowStart, '2026-04-01T03:00:00.000Z');
  // p50 over 9 windows: 6 of them are flat (CV=0), 3 are spike windows
  // (CV identical and positive). nearest-rank p50 = sorted[ceil(.5*9)-1] =
  // sorted[4] = 0.
  assert.equal(row.p50Cv, 0);
  // p90 = sorted[ceil(.9*9)-1] = sorted[8] = max = spike CV.
  assert.equal(row.p90Cv, row.maxCv);
  assert.ok(row.maxCv > 1, `expected maxCv > 1 for a 10x spike, got ${row.maxCv}`);
});

test('rolling-bucket-cv: per-source isolation (windows do not cross source boundaries)', () => {
  const queue: QueueLine[] = [];
  // source A flat
  for (let h = 0; h < 6; h++)
    queue.push(ql(`2026-04-01T0${h}:00:00.000Z`, 'A', 100));
  // source B spiky
  const series = [10, 10, 10, 1000];
  series.forEach((t, i) =>
    queue.push(ql(`2026-04-01T0${i}:00:00.000Z`, 'B', t)),
  );
  const r = buildRollingBucketCv(queue, { windowSize: 3, generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  const a = r.sources.find((s) => s.source === 'A')!;
  const b = r.sources.find((s) => s.source === 'B')!;
  assert.equal(a.maxCv, 0, 'A should be perfectly flat');
  assert.ok(b.maxCv > 0, 'B should show non-zero spikiness');
});

// ---- filters / windows -----------------------------------------------------

test('rolling-bucket-cv: source filter excludes rows', () => {
  const queue: QueueLine[] = [];
  for (let h = 0; h < 6; h++) {
    queue.push(ql(`2026-04-01T0${h}:00:00.000Z`, 'keep', 100));
    queue.push(ql(`2026-04-01T0${h}:00:00.000Z`, 'drop', 100));
  }
  const r = buildRollingBucketCv(queue, {
    source: 'keep',
    windowSize: 3,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 6);
  assert.equal(r.source, 'keep');
});

test('rolling-bucket-cv: top cap truncates and accounts for dropped count', () => {
  const queue: QueueLine[] = [];
  for (const src of ['big', 'mid', 'small']) {
    const mass = src === 'big' ? 1000 : src === 'mid' ? 500 : 100;
    for (let h = 0; h < 5; h++)
      queue.push(ql(`2026-04-01T0${h}:00:00.000Z`, src, mass));
  }
  const r = buildRollingBucketCv(queue, {
    windowSize: 3,
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.sources[1]!.source, 'mid');
  assert.equal(r.droppedTopSources, 1);
});

test('rolling-bucket-cv: report echoes resolved knobs', () => {
  const r = buildRollingBucketCv([], {
    generatedAt: GEN,
    windowSize: 6,
    top: 4,
    minBuckets: 2,
    source: null,
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.windowSize, 6);
  assert.equal(r.top, 4);
  assert.equal(r.minBuckets, 2);
  assert.equal(r.source, null);
  assert.equal(r.windowStart, '2026-04-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00.000Z');
});

test('rolling-bucket-cv: empty source string buckets as (unknown)', () => {
  const queue: QueueLine[] = [];
  for (let h = 0; h < 4; h++)
    queue.push(ql(`2026-04-01T0${h}:00:00.000Z`, '', 100));
  const r = buildRollingBucketCv(queue, { windowSize: 3, generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('rolling-bucket-cv: zero/negative tokens dropped', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's', 100),
    ql('2026-04-01T01:00:00.000Z', 's', 0),
    ql('2026-04-01T02:00:00.000Z', 's', -5),
    ql('2026-04-01T03:00:00.000Z', 's', 100),
  ];
  const r = buildRollingBucketCv(queue, { windowSize: 2, generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.sources[0]!.activeBuckets, 2);
});
