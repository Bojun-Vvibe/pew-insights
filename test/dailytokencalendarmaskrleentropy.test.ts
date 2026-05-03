import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenCalendarMaskRleEntropy,
  runLengthEncodeMask,
  shannonEntropyBitsOfLengths,
} from '../src/dailytokencalendarmaskrleentropy.js';
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

const GEN = '2026-05-04T12:00:00.000Z';

test('rle: empty mask -> empty', () => {
  assert.deepEqual(runLengthEncodeMask([]), []);
});

test('rle: all ones', () => {
  assert.deepEqual(runLengthEncodeMask([1, 1, 1, 1]), [4]);
});

test('rle: alternating', () => {
  assert.deepEqual(runLengthEncodeMask([1, 0, 1, 0, 1]), [1, 1, 1, 1, 1]);
});

test('rle: closed-form [1,1,1,0,0,1,0,0,0,1] -> [3,2,1,3,1]', () => {
  assert.deepEqual(
    runLengthEncodeMask([1, 1, 1, 0, 0, 1, 0, 0, 0, 1]),
    [3, 2, 1, 3, 1],
  );
});

test('entropy: empty / single -> 0', () => {
  assert.equal(shannonEntropyBitsOfLengths([]), 0);
  assert.equal(shannonEntropyBitsOfLengths([5]), 0);
});

test('entropy: two equal lengths -> 1 bit', () => {
  assert.equal(shannonEntropyBitsOfLengths([3, 3]), 1);
});

test('entropy: four equal lengths -> 2 bits', () => {
  const h = shannonEntropyBitsOfLengths([2, 2, 2, 2]);
  assert.ok(Math.abs(h - 2) < 1e-12, `expected 2 bits, got ${h}`);
});

test('entropy: skewed [9,1] < equal [5,5]', () => {
  const hSkew = shannonEntropyBitsOfLengths([9, 1]);
  const hEqual = shannonEntropyBitsOfLengths([5, 5]);
  assert.ok(hSkew < hEqual);
  assert.ok(hSkew > 0);
});

test('entropy: closed-form [1,1,8] -> 0.9219 bits', () => {
  const h = shannonEntropyBitsOfLengths([1, 1, 8]);
  // -2*(0.1)log2(0.1) - 0.8*log2(0.8) = 0.66439 + 0.25754 = 0.92193
  assert.ok(Math.abs(h - 0.9219280948) < 1e-9, `got ${h}`);
});

test('build: continuous source -> segmentCount=1, entropy=0', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'A', 5000),
    ql('2026-01-02T00:00:00.000Z', 'A', 5000),
    ql('2026-01-03T00:00:00.000Z', 'A', 5000),
  ];
  const r = buildDailyTokenCalendarMaskRleEntropy(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.segmentCount, 1);
  assert.equal(s.activeSegmentCount, 1);
  assert.equal(s.silentSegmentCount, 0);
  assert.equal(s.rleEntropyBits, 0);
  assert.equal(s.rleEntropyNormalised, 0);
  assert.equal(s.fragmentationRegime, 'continuous');
  assert.equal(s.spanDays, 3);
  assert.equal(s.longestSegmentLength, 3);
  assert.equal(s.shortestSegmentLength, 3);
});

test('build: one gap -> segmentCount=3, regime=low-fragment', () => {
  // active day-1, silent day-2..day-29 (28 zeros), active day-30
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'A', 5000),
    ql('2026-01-30T00:00:00.000Z', 'A', 5000),
  ];
  const r = buildDailyTokenCalendarMaskRleEntropy(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.spanDays, 30);
  assert.equal(s.segmentCount, 3);
  assert.equal(s.activeSegmentCount, 2);
  assert.equal(s.silentSegmentCount, 1);
  assert.equal(s.fragmentationRegime, 'low-fragment');
  assert.equal(s.longestSegmentLength, 28);
  assert.equal(s.shortestSegmentLength, 1);
  // Entropy of (1, 28, 1) over 30
  // p=(1/30, 28/30, 1/30) -> H = 2*(1/30)*log2(30) + (28/30)*log2(30/28)
  //                          ~= 2*0.1635 + 0.0644 = 0.3914? compute:
  // log2(30) = 4.9069; (1/30)*4.9069 = 0.1636; *2 = 0.3271
  // (28/30)*log2(30/28) = 0.9333 * 0.0995 = 0.0929
  // total ~ 0.4200
  assert.ok(Math.abs(s.rleEntropyBits - 0.4200) < 0.01, `H=${s.rleEntropyBits}`);
});

test('build: highly-fragmented source -> regime=fragmented', () => {
  // 5 active days, 4 single-day silent gaps interleaved -> 9 segments
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'A', 5000),
    ql('2026-01-03T00:00:00.000Z', 'A', 5000),
    ql('2026-01-05T00:00:00.000Z', 'A', 5000),
    ql('2026-01-07T00:00:00.000Z', 'A', 5000),
    ql('2026-01-09T00:00:00.000Z', 'A', 5000),
  ];
  const r = buildDailyTokenCalendarMaskRleEntropy(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.spanDays, 9);
  assert.equal(s.segmentCount, 9);
  assert.equal(s.activeSegmentCount, 5);
  assert.equal(s.silentSegmentCount, 4);
  assert.equal(s.fragmentationRegime, 'fragmented');
  // All segments length 1 -> uniform p=1/9 -> H = log2(9) ~= 3.1699, normalised=1
  assert.ok(Math.abs(s.rleEntropyBits - Math.log2(9)) < 1e-12);
  assert.ok(Math.abs(s.rleEntropyNormalised - 1) < 1e-12);
});

test('build: shattered regime (segmentCount in [10,49])', () => {
  // alternate active/silent for 20 days -> 20 segments of length 1
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 20; d += 2) {
    const day = String(d).padStart(2, '0');
    queue.push(ql(`2026-01-${day}T00:00:00.000Z`, 'A', 5000));
  }
  // last active day must be day-19 -> mask length 19, 10 active + 9 silent = 19 segs
  const r = buildDailyTokenCalendarMaskRleEntropy(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.spanDays, 19);
  assert.equal(s.segmentCount, 19);
  assert.equal(s.fragmentationRegime, 'shattered');
});

test('build: orthogonal to permutation-invariant axes (token magnitudes ignored in mask)', () => {
  // Two sources with different daily tokens but identical mask -> identical RLE entropy
  const a: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'A', 100),
    ql('2026-01-03T00:00:00.000Z', 'A', 100),
  ];
  const b: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'B', 1),
    ql('2026-01-03T00:00:00.000Z', 'B', 1000000),
  ];
  const ra = buildDailyTokenCalendarMaskRleEntropy(a, {
    generatedAt: GEN,
    minTokens: 1,
  });
  const rb = buildDailyTokenCalendarMaskRleEntropy(b, {
    generatedAt: GEN,
    minTokens: 1,
  });
  assert.equal(
    ra.sources[0]!.rleEntropyBits,
    rb.sources[0]!.rleEntropyBits,
  );
  assert.equal(ra.sources[0]!.segmentCount, rb.sources[0]!.segmentCount);
});

test('build: orthogonal to longest-zero-run (different LZR can give same RLE-H)', () => {
  // Source U: mask = 1,0,0,1,0,0,1 -> segs [1,2,1,2,1] LZR=2
  // Source V: mask = 1,1,0,0,0,0,1 -> segs [2,4,1] LZR=4
  // Different LZR, different RLE-H.
  const u: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'U', 5000),
    ql('2026-01-04T00:00:00.000Z', 'U', 5000),
    ql('2026-01-07T00:00:00.000Z', 'U', 5000),
  ];
  const v: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'V', 5000),
    ql('2026-01-02T00:00:00.000Z', 'V', 5000),
    ql('2026-01-07T00:00:00.000Z', 'V', 5000),
  ];
  const ru = buildDailyTokenCalendarMaskRleEntropy(u, { generatedAt: GEN });
  const rv = buildDailyTokenCalendarMaskRleEntropy(v, { generatedAt: GEN });
  assert.equal(ru.sources[0]!.segmentCount, 5);
  assert.equal(rv.sources[0]!.segmentCount, 3);
  assert.notEqual(ru.sources[0]!.rleEntropyBits, rv.sources[0]!.rleEntropyBits);
});

test('build: entropy bounded by log2(segmentCount)', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'A', 5000),
    ql('2026-01-05T00:00:00.000Z', 'A', 5000),
    ql('2026-01-09T00:00:00.000Z', 'A', 5000),
  ];
  const r = buildDailyTokenCalendarMaskRleEntropy(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.ok(s.rleEntropyBits >= 0);
  assert.ok(s.rleEntropyBits <= Math.log2(s.segmentCount) + 1e-12);
  assert.ok(s.rleEntropyNormalised >= 0 && s.rleEntropyNormalised <= 1 + 1e-12);
});

test('build: minTokens filter drops sparse sources', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'A', 5000),
    ql('2026-01-02T00:00:00.000Z', 'A', 5000),
    ql('2026-01-01T00:00:00.000Z', 'B', 100),
    ql('2026-01-02T00:00:00.000Z', 'B', 100),
  ];
  const r = buildDailyTokenCalendarMaskRleEntropy(queue, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources[0]!.source, 'A');
});

test('build: minDays filter drops single-day sources', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'A', 5000),
    ql('2026-01-01T01:00:00.000Z', 'A', 5000),
  ];
  const r = buildDailyTokenCalendarMaskRleEntropy(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinDays, 1);
});

test('build: source filter restricts and counts droppedSourceFilter', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'A', 5000),
    ql('2026-01-02T00:00:00.000Z', 'A', 5000),
    ql('2026-01-01T00:00:00.000Z', 'B', 5000),
    ql('2026-01-02T00:00:00.000Z', 'B', 5000),
  ];
  const r = buildDailyTokenCalendarMaskRleEntropy(queue, {
    generatedAt: GEN,
    source: 'A',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
  assert.equal(r.droppedSourceFilter, 2);
});

test('build: bad hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'A', 5000),
    ql('2026-01-01T00:00:00.000Z', 'A', 5000),
    ql('2026-01-02T00:00:00.000Z', 'A', 5000),
  ];
  const r = buildDailyTokenCalendarMaskRleEntropy(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('build: non-positive tokens dropped', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'A', 0),
    ql('2026-01-02T00:00:00.000Z', 'A', -5),
    ql('2026-01-01T00:00:00.000Z', 'A', 5000),
    ql('2026-01-02T00:00:00.000Z', 'A', 5000),
  ];
  const r = buildDailyTokenCalendarMaskRleEntropy(queue, { generatedAt: GEN });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: top cap reports droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['A', 'B', 'C']) {
    queue.push(ql('2026-01-01T00:00:00.000Z', src, 5000));
    queue.push(ql('2026-01-03T00:00:00.000Z', src, 5000));
  }
  const r = buildDailyTokenCalendarMaskRleEntropy(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('build: minSegmentCount filter', () => {
  const queue: QueueLine[] = [
    // continuous source A: 1 segment
    ql('2026-01-01T00:00:00.000Z', 'A', 5000),
    ql('2026-01-02T00:00:00.000Z', 'A', 5000),
    // fragmented source B: 5 segments
    ql('2026-01-01T00:00:00.000Z', 'B', 5000),
    ql('2026-01-03T00:00:00.000Z', 'B', 5000),
    ql('2026-01-05T00:00:00.000Z', 'B', 5000),
  ];
  const r = buildDailyTokenCalendarMaskRleEntropy(queue, {
    generatedAt: GEN,
    minSegmentCount: 3,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'B');
  assert.equal(r.droppedBelowMinSegmentCount, 1);
});

test('build: sort by segmentCount desc, ties by source asc', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'B', 5000),
    ql('2026-01-03T00:00:00.000Z', 'B', 5000),
    ql('2026-01-01T00:00:00.000Z', 'A', 5000),
    ql('2026-01-03T00:00:00.000Z', 'A', 5000),
    ql('2026-01-01T00:00:00.000Z', 'C', 5000),
    ql('2026-01-02T00:00:00.000Z', 'C', 5000),
  ];
  const r = buildDailyTokenCalendarMaskRleEntropy(queue, {
    generatedAt: GEN,
    sort: 'segmentCount',
  });
  // A and B tie at 3 segments; C has 1 segment. Order: A, B, C.
  assert.equal(r.sources[0]!.source, 'A');
  assert.equal(r.sources[1]!.source, 'B');
  assert.equal(r.sources[2]!.source, 'C');
});

test('build: invalid sort throws', () => {
  assert.throws(() =>
    buildDailyTokenCalendarMaskRleEntropy([], {
      generatedAt: GEN,
      // @ts-expect-error testing invalid value
      sort: 'bogus',
    }),
  );
});

test('build: invalid minTokens throws', () => {
  assert.throws(() =>
    buildDailyTokenCalendarMaskRleEntropy([], {
      generatedAt: GEN,
      minTokens: -1,
    }),
  );
});
