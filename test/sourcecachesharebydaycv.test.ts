import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceCacheShareByDayCv } from '../src/sourcecachesharebydaycv.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  input_tokens: number,
  cached_input_tokens: number,
  opts: Partial<QueueLine> = {},
): QueueLine {
  return {
    source,
    model: opts.model ?? 'm1',
    hour_start,
    device_id: opts.device_id ?? 'd1',
    input_tokens,
    cached_input_tokens,
    output_tokens: opts.output_tokens ?? 100,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens: opts.total_tokens ?? input_tokens + (opts.output_tokens ?? 100),
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

test('source-cache-share-by-day-cv: empty input', () => {
  const r = buildSourceCacheShareByDayCv([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minDays, 3);
  assert.equal(r.sort, 'tokens');
  assert.equal(r.minMeanShare, 0);
});

test('source-cache-share-by-day-cv: rejects bad minDays', () => {
  assert.throws(() => buildSourceCacheShareByDayCv([], { minDays: 0 }));
  assert.throws(() => buildSourceCacheShareByDayCv([], { minDays: -1 }));
  assert.throws(() => buildSourceCacheShareByDayCv([], { minDays: 1.5 }));
});

test('source-cache-share-by-day-cv: rejects bad top', () => {
  assert.throws(() => buildSourceCacheShareByDayCv([], { top: 0 }));
  assert.throws(() => buildSourceCacheShareByDayCv([], { top: -2 }));
  assert.throws(() => buildSourceCacheShareByDayCv([], { top: 1.5 }));
});

test('source-cache-share-by-day-cv: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceCacheShareByDayCv([], {
      // @ts-expect-error invalid sort
      sort: 'bogus',
    }),
  );
});

test('source-cache-share-by-day-cv: rejects bad minMeanShare', () => {
  assert.throws(() =>
    buildSourceCacheShareByDayCv([], { minMeanShare: -0.01 }),
  );
  assert.throws(() =>
    buildSourceCacheShareByDayCv([], { minMeanShare: 1.01 }),
  );
  assert.throws(() =>
    buildSourceCacheShareByDayCv([], { minMeanShare: Number.NaN }),
  );
});

test('source-cache-share-by-day-cv: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceCacheShareByDayCv([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceCacheShareByDayCv([], { until: 'not-a-date' }),
  );
});

test('source-cache-share-by-day-cv: stable source has CV ~ 0', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'srcA', 1000, 500),
    ql('2026-04-21T00:00:00Z', 'srcA', 2000, 1000),
    ql('2026-04-22T00:00:00Z', 'srcA', 4000, 2000),
  ];
  const r = buildSourceCacheShareByDayCv(queue, {
    generatedAt: GEN,
    minDays: 3,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'srcA');
  assert.equal(s.daysWithShare, 3);
  assert.ok(Math.abs(s.meanShare - 0.5) < 1e-9);
  assert.ok(s.shareCv < 1e-9);
  assert.equal(s.flatCold, false);
  assert.equal(s.pureWarm, false);
});

test('source-cache-share-by-day-cv: flatCold (all zero cached)', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'cold', 1000, 0),
    ql('2026-04-21T00:00:00Z', 'cold', 2000, 0),
    ql('2026-04-22T00:00:00Z', 'cold', 1500, 0),
  ];
  const r = buildSourceCacheShareByDayCv(queue, {
    generatedAt: GEN,
    minDays: 3,
  });
  const s = r.sources.find((x) => x.source === 'cold')!;
  assert.equal(s.meanShare, 0);
  assert.equal(s.shareCv, 0);
  assert.equal(s.flatCold, true);
  assert.equal(s.pureWarm, false);
});

test('source-cache-share-by-day-cv: pureWarm (cached == input)', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'warm', 1000, 1000),
    ql('2026-04-21T00:00:00Z', 'warm', 2000, 2000),
    ql('2026-04-22T00:00:00Z', 'warm', 500, 500),
  ];
  const r = buildSourceCacheShareByDayCv(queue, {
    generatedAt: GEN,
    minDays: 3,
  });
  const s = r.sources.find((x) => x.source === 'warm')!;
  assert.equal(s.meanShare, 1);
  assert.equal(s.shareCv, 0);
  assert.equal(s.flatCold, false);
  assert.equal(s.pureWarm, true);
});

test('source-cache-share-by-day-cv: unstable source has high CV', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'wild', 1000, 0),
    ql('2026-04-21T00:00:00Z', 'wild', 1000, 1000),
    ql('2026-04-22T00:00:00Z', 'wild', 1000, 0),
    ql('2026-04-23T00:00:00Z', 'wild', 1000, 1000),
  ];
  const r = buildSourceCacheShareByDayCv(queue, {
    generatedAt: GEN,
    minDays: 3,
  });
  const s = r.sources.find((x) => x.source === 'wild')!;
  assert.equal(s.daysWithShare, 4);
  assert.ok(Math.abs(s.meanShare - 0.5) < 1e-9);
  assert.ok(s.shareCv > 0.99);
});

test('source-cache-share-by-day-cv: zero-input day counted in daysWithZeroInput', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'src', 1000, 500),
    ql('2026-04-21T00:00:00Z', 'src', 0, 0),
    ql('2026-04-22T00:00:00Z', 'src', 2000, 1000),
    ql('2026-04-23T00:00:00Z', 'src', 1500, 750),
  ];
  const r = buildSourceCacheShareByDayCv(queue, {
    generatedAt: GEN,
    minDays: 3,
  });
  const s = r.sources.find((x) => x.source === 'src')!;
  assert.equal(s.activeDays, 4);
  assert.equal(s.daysWithShare, 3);
  assert.equal(s.daysWithZeroInput, 1);
  assert.ok(Math.abs(s.meanShare - 0.5) < 1e-9);
});

test('source-cache-share-by-day-cv: minDays floor surfaces drops', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'short', 1000, 500),
    ql('2026-04-21T00:00:00Z', 'short', 2000, 1000),
    ql('2026-04-20T00:00:00Z', 'long', 1000, 500),
    ql('2026-04-21T00:00:00Z', 'long', 1000, 500),
    ql('2026-04-22T00:00:00Z', 'long', 1000, 500),
  ];
  const r = buildSourceCacheShareByDayCv(queue, {
    generatedAt: GEN,
    minDays: 3,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'long');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('source-cache-share-by-day-cv: top cap surfaces drops', () => {
  const queue: QueueLine[] = [];
  for (let day = 0; day < 4; day++) {
    for (const src of ['a', 'b', 'c']) {
      queue.push(
        ql(`2026-04-2${day}T00:00:00Z`, src, 1000, 500),
      );
    }
  }
  const r = buildSourceCacheShareByDayCv(queue, {
    generatedAt: GEN,
    minDays: 3,
    top: 2,
  });
  assert.equal(r.totalSources, 3);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('source-cache-share-by-day-cv: minMeanShare surfaces drops', () => {
  const queue: QueueLine[] = [
    // src 'low' = mean share ~0.01
    ql('2026-04-20T00:00:00Z', 'low', 1000, 10),
    ql('2026-04-21T00:00:00Z', 'low', 1000, 10),
    ql('2026-04-22T00:00:00Z', 'low', 1000, 10),
    // src 'hi' = mean share ~0.5
    ql('2026-04-20T00:00:00Z', 'hi', 1000, 500),
    ql('2026-04-21T00:00:00Z', 'hi', 1000, 500),
    ql('2026-04-22T00:00:00Z', 'hi', 1000, 500),
  ];
  const r = buildSourceCacheShareByDayCv(queue, {
    generatedAt: GEN,
    minDays: 3,
    minMeanShare: 0.05,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'hi');
  assert.equal(r.droppedBelowMinMeanShare, 1);
});

test('source-cache-share-by-day-cv: source filter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'A', 1000, 500),
    ql('2026-04-21T00:00:00Z', 'A', 1000, 500),
    ql('2026-04-22T00:00:00Z', 'A', 1000, 500),
    ql('2026-04-20T00:00:00Z', 'B', 1000, 100),
  ];
  const r = buildSourceCacheShareByDayCv(queue, {
    generatedAt: GEN,
    minDays: 3,
    source: 'A',
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources[0]!.source, 'A');
  assert.equal(r.droppedSourceFilter, 1);
});

test('source-cache-share-by-day-cv: window filter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-19T00:00:00Z', 'A', 1000, 500),
    ql('2026-04-20T00:00:00Z', 'A', 1000, 500),
    ql('2026-04-21T00:00:00Z', 'A', 1000, 500),
    ql('2026-04-22T00:00:00Z', 'A', 1000, 500),
    ql('2026-04-25T00:00:00Z', 'A', 1000, 500),
  ];
  const r = buildSourceCacheShareByDayCv(queue, {
    generatedAt: GEN,
    minDays: 3,
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-23T00:00:00Z',
  });
  assert.equal(r.sources[0]!.activeDays, 3);
});

test('source-cache-share-by-day-cv: sort by cv asc', () => {
  const queue: QueueLine[] = [
    // stable ~0.5
    ql('2026-04-20T00:00:00Z', 'stable', 1000, 500),
    ql('2026-04-21T00:00:00Z', 'stable', 1000, 500),
    ql('2026-04-22T00:00:00Z', 'stable', 1000, 500),
    ql('2026-04-23T00:00:00Z', 'stable', 1000, 500),
    // wild
    ql('2026-04-20T00:00:00Z', 'wild', 1000, 0),
    ql('2026-04-21T00:00:00Z', 'wild', 1000, 1000),
    ql('2026-04-22T00:00:00Z', 'wild', 1000, 0),
    ql('2026-04-23T00:00:00Z', 'wild', 1000, 1000),
  ];
  const r = buildSourceCacheShareByDayCv(queue, {
    generatedAt: GEN,
    minDays: 3,
    sort: 'cv',
  });
  assert.equal(r.sources[0]!.source, 'stable');
  assert.equal(r.sources[1]!.source, 'wild');
});

test('source-cache-share-by-day-cv: sort by mean desc', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'low', 1000, 100),
    ql('2026-04-21T00:00:00Z', 'low', 1000, 100),
    ql('2026-04-22T00:00:00Z', 'low', 1000, 100),
    ql('2026-04-20T00:00:00Z', 'hi', 1000, 900),
    ql('2026-04-21T00:00:00Z', 'hi', 1000, 900),
    ql('2026-04-22T00:00:00Z', 'hi', 1000, 900),
  ];
  const r = buildSourceCacheShareByDayCv(queue, {
    generatedAt: GEN,
    minDays: 3,
    sort: 'mean',
  });
  assert.equal(r.sources[0]!.source, 'hi');
  assert.equal(r.sources[1]!.source, 'low');
});

test('source-cache-share-by-day-cv: cached>input is clipped to share=1', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'odd', 1000, 1500), // logger overcounted
    ql('2026-04-21T00:00:00Z', 'odd', 1000, 1000),
    ql('2026-04-22T00:00:00Z', 'odd', 1000, 1000),
  ];
  const r = buildSourceCacheShareByDayCv(queue, {
    generatedAt: GEN,
    minDays: 3,
  });
  const s = r.sources[0]!;
  assert.equal(s.meanShare, 1);
  assert.equal(s.pureWarm, true);
});

test('source-cache-share-by-day-cv: invalid hour_start surfaces drop', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'A', 1000, 500),
    ql('2026-04-20T00:00:00Z', 'A', 1000, 500),
    ql('2026-04-21T00:00:00Z', 'A', 1000, 500),
    ql('2026-04-22T00:00:00Z', 'A', 1000, 500),
  ];
  const r = buildSourceCacheShareByDayCv(queue, {
    generatedAt: GEN,
    minDays: 3,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.daysWithShare, 3);
});
