import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceGapHoursCv } from '../src/sourcegaphourscv.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens = 100,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: total_tokens,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

test('source-gap-hours-cv: empty input -> empty report with defaults', () => {
  const r = buildSourceGapHoursCv([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalActiveHours, 0);
  assert.equal(r.totalGaps, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minActiveHours, 3);
  assert.equal(r.minMeanGap, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'cv');
  assert.equal(r.generatedAt, GEN);
});

test('source-gap-hours-cv: rejects bad minActiveHours', () => {
  assert.throws(() => buildSourceGapHoursCv([], { minActiveHours: 0 }));
  assert.throws(() => buildSourceGapHoursCv([], { minActiveHours: -1 }));
  assert.throws(() => buildSourceGapHoursCv([], { minActiveHours: 1.5 }));
});

test('source-gap-hours-cv: rejects bad minMeanGap', () => {
  assert.throws(() => buildSourceGapHoursCv([], { minMeanGap: -0.01 }));
  assert.throws(() => buildSourceGapHoursCv([], { minMeanGap: Number.NaN }));
  assert.throws(() =>
    buildSourceGapHoursCv([], { minMeanGap: Number.POSITIVE_INFINITY }),
  );
});

test('source-gap-hours-cv: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceGapHoursCv([], {
      // @ts-expect-error invalid sort key
      sort: 'bogus',
    }),
  );
});

test('source-gap-hours-cv: rejects bad top', () => {
  assert.throws(() => buildSourceGapHoursCv([], { top: 0 }));
  assert.throws(() => buildSourceGapHoursCv([], { top: 1.5 }));
});

test('source-gap-hours-cv: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceGapHoursCv([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceGapHoursCv([], { until: 'not-a-date' }),
  );
});

test('source-gap-hours-cv: clocked source has gapCv == 0 and flat=y', () => {
  // every gap is exactly 1h
  const q = [
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T01:00:00Z', 'a'),
    ql('2026-04-20T02:00:00Z', 'a'),
    ql('2026-04-20T03:00:00Z', 'a'),
  ];
  const r = buildSourceGapHoursCv(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const a = r.sources[0];
  assert.equal(a.source, 'a');
  assert.equal(a.hoursActive, 4);
  assert.equal(a.gaps, 3);
  assert.equal(a.meanGap, 1);
  assert.equal(a.stdGap, 0);
  assert.equal(a.gapCv, 0);
  assert.equal(a.minGap, 1);
  assert.equal(a.maxGap, 1);
  assert.equal(a.flat, true);
});

test('source-gap-hours-cv: spaced clocked source (every 6h) has gapCv==0', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T06:00:00Z', 'a'),
    ql('2026-04-20T12:00:00Z', 'a'),
    ql('2026-04-20T18:00:00Z', 'a'),
  ];
  const r = buildSourceGapHoursCv(q, { generatedAt: GEN });
  const a = r.sources[0];
  assert.equal(a.gaps, 3);
  assert.equal(a.meanGap, 6);
  assert.equal(a.stdGap, 0);
  assert.equal(a.gapCv, 0);
  assert.equal(a.minGap, 6);
  assert.equal(a.maxGap, 6);
  assert.equal(a.flat, true);
});

test('source-gap-hours-cv: bursty source has gapCv >> 0', () => {
  // gaps: 1, 1, 1, 100 -> mean = 25.75, std large -> CV >> 1
  const q = [
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T01:00:00Z', 'a'),
    ql('2026-04-20T02:00:00Z', 'a'),
    ql('2026-04-20T03:00:00Z', 'a'),
    ql('2026-04-24T07:00:00Z', 'a'), // +100h
  ];
  const r = buildSourceGapHoursCv(q, { generatedAt: GEN });
  const a = r.sources[0];
  assert.equal(a.gaps, 4);
  assert.equal(a.minGap, 1);
  assert.equal(a.maxGap, 100);
  assert.equal(a.meanGap, 25.75);
  // population stddev of [1,1,1,100] vs 25.75 ~= sqrt((24.75^2*3 + 74.25^2)/4) ~= 42.87
  assert.ok(a.stdGap > 40 && a.stdGap < 45, `stdGap was ${a.stdGap}`);
  assert.ok(a.gapCv > 1.5, `gapCv was ${a.gapCv}`);
  assert.equal(a.flat, false);
});

test('source-gap-hours-cv: same-hour duplicate rows collapse to one bucket', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T01:00:00Z', 'a'),
    ql('2026-04-20T02:00:00Z', 'a'),
  ];
  const r = buildSourceGapHoursCv(q, { generatedAt: GEN });
  const a = r.sources[0];
  assert.equal(a.hoursActive, 3);
  assert.equal(a.gaps, 2);
  assert.equal(a.meanGap, 1);
  assert.equal(a.gapCv, 0);
});

test('source-gap-hours-cv: zero total_tokens rows are dropped', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a', 100),
    ql('2026-04-20T01:00:00Z', 'a', 0), // dropped
    ql('2026-04-20T02:00:00Z', 'a', 100),
    ql('2026-04-20T03:00:00Z', 'a', 100),
  ];
  const r = buildSourceGapHoursCv(q, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokenMass, 1);
  const a = r.sources[0];
  assert.equal(a.hoursActive, 3);
  // gaps: t0->t2 = 2h, t2->t3 = 1h
  assert.equal(a.gaps, 2);
  assert.equal(a.minGap, 1);
  assert.equal(a.maxGap, 2);
});

test('source-gap-hours-cv: invalid hour_start surfaces as droppedInvalidHourStart', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a'),
    { ...ql('2026-04-20T01:00:00Z', 'a'), hour_start: 'not-a-date' },
    ql('2026-04-20T02:00:00Z', 'a'),
    ql('2026-04-20T03:00:00Z', 'a'),
  ] as QueueLine[];
  const r = buildSourceGapHoursCv(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0].hoursActive, 3);
});

test('source-gap-hours-cv: per-source partitioning is independent', () => {
  const q = [
    // a: clocked
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T01:00:00Z', 'a'),
    ql('2026-04-20T02:00:00Z', 'a'),
    // b: bursty (gaps 1, 50)
    ql('2026-04-20T00:00:00Z', 'b'),
    ql('2026-04-20T01:00:00Z', 'b'),
    ql('2026-04-22T03:00:00Z', 'b'),
  ];
  const r = buildSourceGapHoursCv(q, { generatedAt: GEN, sort: 'cv' });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 2);
  // sort by cv desc -> b first
  assert.equal(r.sources[0].source, 'b');
  assert.equal(r.sources[1].source, 'a');
  assert.equal(r.sources[1].gapCv, 0);
  assert.ok(r.sources[0].gapCv > 0);
});

test('source-gap-hours-cv: minActiveHours filters degenerate sources', () => {
  const q = [
    // a: 4 active hours
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T01:00:00Z', 'a'),
    ql('2026-04-20T02:00:00Z', 'a'),
    ql('2026-04-20T03:00:00Z', 'a'),
    // b: 2 active hours
    ql('2026-04-20T00:00:00Z', 'b'),
    ql('2026-04-20T05:00:00Z', 'b'),
  ];
  const r = buildSourceGapHoursCv(q, {
    generatedAt: GEN,
    minActiveHours: 3,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'a');
  assert.equal(r.droppedBelowMinActiveHours, 1);
});

test('source-gap-hours-cv: minActiveHours=1 keeps single-bucket sources with gapCv=0', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T01:00:00Z', 'a'),
    ql('2026-04-20T02:00:00Z', 'a'),
    ql('2026-04-20T05:00:00Z', 'b'), // single
  ];
  const r = buildSourceGapHoursCv(q, {
    generatedAt: GEN,
    minActiveHours: 1,
    sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  const b = r.sources.find((s) => s.source === 'b')!;
  assert.equal(b.hoursActive, 1);
  assert.equal(b.gaps, 0);
  assert.equal(b.gapCv, 0);
  assert.equal(b.flat, false);
});

test('source-gap-hours-cv: minMeanGap filters by typical spacing', () => {
  const q = [
    // a: dense (mean gap = 1)
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T01:00:00Z', 'a'),
    ql('2026-04-20T02:00:00Z', 'a'),
    ql('2026-04-20T03:00:00Z', 'a'),
    // b: sparse (mean gap = 6)
    ql('2026-04-20T00:00:00Z', 'b'),
    ql('2026-04-20T06:00:00Z', 'b'),
    ql('2026-04-20T12:00:00Z', 'b'),
    ql('2026-04-20T18:00:00Z', 'b'),
  ];
  const r = buildSourceGapHoursCv(q, {
    generatedAt: GEN,
    minMeanGap: 3,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'b');
  assert.equal(r.droppedBelowMinMeanGap, 1);
});

test('source-gap-hours-cv: top caps and reports droppedBelowTopCap', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T01:00:00Z', 'a'),
    ql('2026-04-20T02:00:00Z', 'a'),
    ql('2026-04-20T00:00:00Z', 'b'),
    ql('2026-04-20T01:00:00Z', 'b'),
    ql('2026-04-20T05:00:00Z', 'b'),
    ql('2026-04-20T00:00:00Z', 'c'),
    ql('2026-04-20T01:00:00Z', 'c'),
    ql('2026-04-20T03:00:00Z', 'c'),
  ];
  const r = buildSourceGapHoursCv(q, {
    generatedAt: GEN,
    top: 2,
    sort: 'cv',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('source-gap-hours-cv: source filter restricts and counts droppedSourceFilter', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T01:00:00Z', 'a'),
    ql('2026-04-20T02:00:00Z', 'a'),
    ql('2026-04-20T00:00:00Z', 'b'),
    ql('2026-04-20T01:00:00Z', 'b'),
  ];
  const r = buildSourceGapHoursCv(q, {
    generatedAt: GEN,
    source: 'a',
    minActiveHours: 1,
  });
  assert.equal(r.source, 'a');
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'a');
});

test('source-gap-hours-cv: window filtering by since/until', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T01:00:00Z', 'a'),
    ql('2026-04-20T02:00:00Z', 'a'),
    ql('2026-04-21T00:00:00Z', 'a'),
    ql('2026-04-21T01:00:00Z', 'a'),
    ql('2026-04-21T02:00:00Z', 'a'),
  ];
  const r = buildSourceGapHoursCv(q, {
    generatedAt: GEN,
    since: '2026-04-21T00:00:00Z',
  });
  assert.equal(r.sources[0].hoursActive, 3);
  assert.equal(r.sources[0].gaps, 2);
  assert.equal(r.sources[0].meanGap, 1);
});

test('source-gap-hours-cv: sort by mean-gap is descending, ties source asc', () => {
  const q = [
    // a: meanGap = 1
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T01:00:00Z', 'a'),
    ql('2026-04-20T02:00:00Z', 'a'),
    // b: meanGap = 6
    ql('2026-04-20T00:00:00Z', 'b'),
    ql('2026-04-20T06:00:00Z', 'b'),
    ql('2026-04-20T12:00:00Z', 'b'),
    // c: meanGap = 1 (tie with a)
    ql('2026-04-20T00:00:00Z', 'c'),
    ql('2026-04-20T01:00:00Z', 'c'),
    ql('2026-04-20T02:00:00Z', 'c'),
  ];
  const r = buildSourceGapHoursCv(q, { generatedAt: GEN, sort: 'mean-gap' });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'a', 'c'],
  );
});

test('source-gap-hours-cv: sort by source is asc lex', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'zeta'),
    ql('2026-04-20T01:00:00Z', 'zeta'),
    ql('2026-04-20T02:00:00Z', 'zeta'),
    ql('2026-04-20T00:00:00Z', 'alpha'),
    ql('2026-04-20T01:00:00Z', 'alpha'),
    ql('2026-04-20T02:00:00Z', 'alpha'),
  ];
  const r = buildSourceGapHoursCv(q, { generatedAt: GEN, sort: 'source' });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'zeta'],
  );
});

test('source-gap-hours-cv: sort by max-gap puts the source with biggest silence first', () => {
  const q = [
    // a: gaps 1,1 -> max 1
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T01:00:00Z', 'a'),
    ql('2026-04-20T02:00:00Z', 'a'),
    // b: gaps 1, 50 -> max 50
    ql('2026-04-20T00:00:00Z', 'b'),
    ql('2026-04-20T01:00:00Z', 'b'),
    ql('2026-04-22T03:00:00Z', 'b'),
  ];
  const r = buildSourceGapHoursCv(q, { generatedAt: GEN, sort: 'max-gap' });
  assert.equal(r.sources[0].source, 'b');
  assert.equal(r.sources[0].maxGap, 50);
});

test('source-gap-hours-cv: sort by active-hours puts most-active source first', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T01:00:00Z', 'a'),
    ql('2026-04-20T02:00:00Z', 'a'),
    ql('2026-04-20T00:00:00Z', 'b'),
    ql('2026-04-20T01:00:00Z', 'b'),
    ql('2026-04-20T02:00:00Z', 'b'),
    ql('2026-04-20T03:00:00Z', 'b'),
    ql('2026-04-20T04:00:00Z', 'b'),
  ];
  const r = buildSourceGapHoursCv(q, {
    generatedAt: GEN,
    sort: 'active-hours',
  });
  assert.equal(r.sources[0].source, 'b');
  assert.equal(r.sources[0].hoursActive, 5);
});

test('source-gap-hours-cv: empty source name normalised to "unknown"', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', ''),
    ql('2026-04-20T01:00:00Z', ''),
    ql('2026-04-20T02:00:00Z', ''),
  ];
  const r = buildSourceGapHoursCv(q, { generatedAt: GEN });
  assert.equal(r.sources[0].source, 'unknown');
});

test('source-gap-hours-cv: totalActiveHours and totalGaps aggregate correctly', () => {
  const q = [
    ql('2026-04-20T00:00:00Z', 'a'),
    ql('2026-04-20T01:00:00Z', 'a'),
    ql('2026-04-20T02:00:00Z', 'a'),
    ql('2026-04-20T00:00:00Z', 'b'),
    ql('2026-04-20T01:00:00Z', 'b'),
    ql('2026-04-20T02:00:00Z', 'b'),
    ql('2026-04-20T03:00:00Z', 'b'),
  ];
  const r = buildSourceGapHoursCv(q, { generatedAt: GEN });
  assert.equal(r.totalActiveHours, 7);
  assert.equal(r.totalGaps, 5); // 2 + 3
});

test('source-gap-hours-cv: window mirrored on output', () => {
  const r = buildSourceGapHoursCv([], {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-21T00:00:00Z',
  });
  assert.equal(r.windowStart, '2026-04-20T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-21T00:00:00Z');
});
