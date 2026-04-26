import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceOutputTokensByHourCv } from '../src/sourceoutputtokensbyhourcv.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  output_tokens: number,
  opts: Partial<QueueLine> = {},
): QueueLine {
  return {
    source,
    model: opts.model ?? 'm1',
    hour_start,
    device_id: opts.device_id ?? 'd1',
    input_tokens: opts.input_tokens ?? 100,
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens:
      opts.total_tokens ?? (opts.input_tokens ?? 100) + output_tokens,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

test('source-output-tokens-by-hour-cv: empty input', () => {
  const r = buildSourceOutputTokensByHourCv([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minHours, 3);
  assert.equal(r.minRows, 1);
  assert.equal(r.sort, 'tokens');
  assert.equal(r.generatedAt, GEN);
});

test('source-output-tokens-by-hour-cv: rejects bad minHours', () => {
  assert.throws(() => buildSourceOutputTokensByHourCv([], { minHours: 0 }));
  assert.throws(() => buildSourceOutputTokensByHourCv([], { minHours: -1 }));
  assert.throws(() => buildSourceOutputTokensByHourCv([], { minHours: 25 }));
  assert.throws(() => buildSourceOutputTokensByHourCv([], { minHours: 1.5 }));
});

test('source-output-tokens-by-hour-cv: rejects bad minRows', () => {
  assert.throws(() => buildSourceOutputTokensByHourCv([], { minRows: 0 }));
  assert.throws(() => buildSourceOutputTokensByHourCv([], { minRows: -2 }));
  assert.throws(() => buildSourceOutputTokensByHourCv([], { minRows: 1.7 }));
});

test('source-output-tokens-by-hour-cv: rejects bad top', () => {
  assert.throws(() => buildSourceOutputTokensByHourCv([], { top: 0 }));
  assert.throws(() => buildSourceOutputTokensByHourCv([], { top: -2 }));
  assert.throws(() => buildSourceOutputTokensByHourCv([], { top: 1.5 }));
});

test('source-output-tokens-by-hour-cv: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceOutputTokensByHourCv([], {
      // @ts-expect-error invalid
      sort: 'bogus',
    }),
  );
});

test('source-output-tokens-by-hour-cv: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceOutputTokensByHourCv([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceOutputTokensByHourCv([], { until: 'not-a-date' }),
  );
});

test('source-output-tokens-by-hour-cv: flat source has CV ~ 0', () => {
  // Same per-row output across 3 different hours -> hourMean is identical
  // -> stddev=0 -> CV=0.
  const queue: QueueLine[] = [
    ql('2026-04-20T03:00:00Z', 'srcA', 200),
    ql('2026-04-20T09:00:00Z', 'srcA', 200),
    ql('2026-04-20T15:00:00Z', 'srcA', 200),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'srcA');
  assert.equal(s.hoursPopulated, 3);
  assert.equal(s.meanHourMean, 200);
  assert.equal(s.stdHourMean, 0);
  assert.equal(s.hourCv, 0);
  assert.equal(s.flatZero, false);
  assert.equal(s.singleHour, false);
});

test('source-output-tokens-by-hour-cv: lumpy source has CV > 0', () => {
  // Per-hour means: 100, 200, 600 -> mean=300, var=((200)^2+(100)^2+(300)^2)/3
  // stddev ≈ sqrt(46666.67) ≈ 216.02 -> CV ≈ 0.7201
  const queue: QueueLine[] = [
    ql('2026-04-20T03:00:00Z', 'srcA', 100),
    ql('2026-04-20T09:00:00Z', 'srcA', 200),
    ql('2026-04-20T15:00:00Z', 'srcA', 600),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.hoursPopulated, 3);
  assert.equal(s.meanHourMean, 300);
  // population stddev
  const expectedStd = Math.sqrt(
    ((100 - 300) ** 2 + (200 - 300) ** 2 + (600 - 300) ** 2) / 3,
  );
  assert.ok(Math.abs(s.stdHourMean - expectedStd) < 1e-9);
  assert.ok(Math.abs(s.hourCv - expectedStd / 300) < 1e-9);
  assert.equal(s.flatZero, false);
});

test('source-output-tokens-by-hour-cv: averages within an hour first', () => {
  // hour 3: rows 100 and 300 -> mean 200
  // hour 9: row 200 -> mean 200
  // hour 15: row 200 -> mean 200
  // -> CV should be 0 (proves we average within the hour, not pool rows)
  const queue: QueueLine[] = [
    ql('2026-04-20T03:00:00Z', 'srcA', 100),
    ql('2026-04-20T03:30:00Z', 'srcA', 300),
    ql('2026-04-20T09:00:00Z', 'srcA', 200),
    ql('2026-04-20T15:00:00Z', 'srcA', 200),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.hoursPopulated, 3);
  assert.equal(s.meanHourMean, 200);
  assert.equal(s.stdHourMean, 0);
  assert.equal(s.hourCv, 0);
  assert.equal(s.rowCount, 4);
});

test('source-output-tokens-by-hour-cv: flatZero when every hour has zero output', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T03:00:00Z', 'srcA', 0),
    ql('2026-04-20T09:00:00Z', 'srcA', 0),
    ql('2026-04-20T15:00:00Z', 'srcA', 0),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.meanHourMean, 0);
  assert.equal(s.stdHourMean, 0);
  assert.equal(s.hourCv, 0);
  assert.equal(s.flatZero, true);
});

test('source-output-tokens-by-hour-cv: clamps negative output to 0', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T03:00:00Z', 'srcA', -100),
    ql('2026-04-20T09:00:00Z', 'srcA', 100),
    ql('2026-04-20T15:00:00Z', 'srcA', 200),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  // hour means: 0, 100, 200 -> mean 100
  assert.equal(s.meanHourMean, 100);
  assert.equal(s.outputTokens, 300);
});

test('source-output-tokens-by-hour-cv: minHours floor drops thin sources', () => {
  const queue: QueueLine[] = [
    // srcA: 3 hours, survives default
    ql('2026-04-20T03:00:00Z', 'srcA', 100),
    ql('2026-04-20T09:00:00Z', 'srcA', 200),
    ql('2026-04-20T15:00:00Z', 'srcA', 300),
    // srcB: 1 hour, dropped at minHours=3
    ql('2026-04-20T05:00:00Z', 'srcB', 100),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'srcA');
  assert.equal(r.droppedBelowMinHours, 1);
});

test('source-output-tokens-by-hour-cv: singleHour flag when minHours=1', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00Z', 'srcSolo', 500),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 1,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.singleHour, true);
  assert.equal(s.hoursPopulated, 1);
  assert.equal(s.hourCv, 0);
});

test('source-output-tokens-by-hour-cv: source filter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T03:00:00Z', 'srcA', 100),
    ql('2026-04-20T09:00:00Z', 'srcA', 200),
    ql('2026-04-20T15:00:00Z', 'srcA', 300),
    ql('2026-04-20T05:00:00Z', 'srcB', 100),
    ql('2026-04-20T11:00:00Z', 'srcB', 100),
    ql('2026-04-20T17:00:00Z', 'srcB', 100),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
    source: 'srcA',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'srcA');
  assert.equal(r.droppedSourceFilter, 3);
});

test('source-output-tokens-by-hour-cv: window filter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-19T03:00:00Z', 'srcA', 100), // before since
    ql('2026-04-20T03:00:00Z', 'srcA', 200),
    ql('2026-04-20T09:00:00Z', 'srcA', 200),
    ql('2026-04-20T15:00:00Z', 'srcA', 200),
    ql('2026-04-25T03:00:00Z', 'srcA', 100), // after until (exclusive)
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-25T00:00:00Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowCount, 3);
  assert.equal(r.sources[0]!.meanHourMean, 200);
});

test('source-output-tokens-by-hour-cv: bad hour_start surfaces as drop', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'srcA', 100),
    ql('2026-04-20T03:00:00Z', 'srcA', 100),
    ql('2026-04-20T09:00:00Z', 'srcA', 200),
    ql('2026-04-20T15:00:00Z', 'srcA', 300),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('source-output-tokens-by-hour-cv: sort by cv desc surfaces lumpy first', () => {
  const queue: QueueLine[] = [
    // srcFlat: hours 0,6,12 each with output 100 -> CV = 0
    ql('2026-04-20T00:00:00Z', 'srcFlat', 100),
    ql('2026-04-20T06:00:00Z', 'srcFlat', 100),
    ql('2026-04-20T12:00:00Z', 'srcFlat', 100),
    // srcLumpy: hours 0,6,12 with outputs 100,200,600 (CV ~0.72)
    ql('2026-04-20T00:00:00Z', 'srcLumpy', 100),
    ql('2026-04-20T06:00:00Z', 'srcLumpy', 200),
    ql('2026-04-20T12:00:00Z', 'srcLumpy', 600),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
    sort: 'cv',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'srcLumpy');
  assert.equal(r.sources[1]!.source, 'srcFlat');
});

test('source-output-tokens-by-hour-cv: sort by source asc', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'zebra', 100),
    ql('2026-04-20T06:00:00Z', 'zebra', 100),
    ql('2026-04-20T12:00:00Z', 'zebra', 100),
    ql('2026-04-20T00:00:00Z', 'apple', 100),
    ql('2026-04-20T06:00:00Z', 'apple', 100),
    ql('2026-04-20T12:00:00Z', 'apple', 100),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
    sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'apple');
  assert.equal(r.sources[1]!.source, 'zebra');
});

test('source-output-tokens-by-hour-cv: top cap', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c', 'd']) {
    for (const h of [0, 6, 12]) {
      queue.push(
        ql(
          `2026-04-20T${String(h).padStart(2, '0')}:00:00Z`,
          src,
          src === 'a' ? 1000 : src === 'b' ? 500 : src === 'c' ? 200 : 100,
        ),
      );
    }
  }
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
  // tokens-sorted desc: a (1000+100=1100 *3 each), b, c, d
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('source-output-tokens-by-hour-cv: minRows floor', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'thin', 100),
    ql('2026-04-20T06:00:00Z', 'thin', 100),
    ql('2026-04-20T12:00:00Z', 'thin', 100),
    // fat source: 6 rows over 3 hours
    ql('2026-04-20T00:00:00Z', 'fat', 100),
    ql('2026-04-20T00:30:00Z', 'fat', 100),
    ql('2026-04-20T06:00:00Z', 'fat', 100),
    ql('2026-04-20T06:30:00Z', 'fat', 100),
    ql('2026-04-20T12:00:00Z', 'fat', 100),
    ql('2026-04-20T12:30:00Z', 'fat', 100),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
    minRows: 5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'fat');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('source-output-tokens-by-hour-cv: hour bucketing is UTC', () => {
  // 23:00 UTC and 00:00 UTC are different hour buckets even on
  // adjacent calendar boundaries.
  const queue: QueueLine[] = [
    ql('2026-04-20T23:00:00Z', 'srcA', 100),
    ql('2026-04-21T00:00:00Z', 'srcA', 200),
    ql('2026-04-21T01:00:00Z', 'srcA', 300),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.hoursPopulated, 3);
});

test('source-output-tokens-by-hour-cv: unknown source label', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T03:00:00Z', '', 100),
    ql('2026-04-20T09:00:00Z', '', 100),
    ql('2026-04-20T15:00:00Z', '', 100),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('source-output-tokens-by-hour-cv: deterministic tiebreak by source asc', () => {
  // Two sources with identical tokens -> tiebreak source asc.
  const queue: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'beta', 100),
    ql('2026-04-20T06:00:00Z', 'beta', 100),
    ql('2026-04-20T12:00:00Z', 'beta', 100),
    ql('2026-04-20T00:00:00Z', 'alpha', 100),
    ql('2026-04-20T06:00:00Z', 'alpha', 100),
    ql('2026-04-20T12:00:00Z', 'alpha', 100),
  ];
  const r = buildSourceOutputTokensByHourCv(queue, {
    generatedAt: GEN,
    minHours: 3,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'beta');
});
