/**
 * Unit + property tests for source-row-token-siegel-slope.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSiegelSlope,
  siegelSlope,
} from '../src/sourcerowtokensiegelslope.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-29T12:00:00.000Z';

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

test('siegelSlope: perfect line slope=2, intercept=3', () => {
  const xs = [3, 5, 7, 9, 11, 13];
  const r = siegelSlope(xs);
  assert.equal(r.slope, 2);
  assert.equal(r.intercept, 3);
  assert.equal(r.anchorsPositive, 6);
  assert.equal(r.anchorsNegative, 0);
  assert.equal(r.anchorsZero, 0);
  assert.equal(r.pairsTotal, 30);
  assert.equal(r.perAnchorMedianRange, 0); // every anchor sees slope 2
});

test('siegelSlope: flat constant series slope=0', () => {
  const xs = [42, 42, 42, 42, 42];
  const r = siegelSlope(xs);
  assert.equal(r.slope, 0);
  assert.equal(r.intercept, 42);
  assert.equal(r.anchorsPositive, 0);
  assert.equal(r.anchorsNegative, 0);
  assert.equal(r.anchorsZero, 5);
  assert.equal(r.perAnchorMedianRange, 0);
});

test('siegelSlope: strictly decreasing series slope<0', () => {
  const xs = [10, 8, 6, 4, 2];
  const r = siegelSlope(xs);
  assert.equal(r.slope, -2);
  assert.equal(r.intercept, 10);
  assert.equal(r.anchorsPositive, 0);
  assert.equal(r.anchorsNegative, 5);
  assert.equal(r.anchorsZero, 0);
});

test('siegelSlope: high breakdown — corrupting up to ~half points still recovers slope=1', () => {
  // 9 points: pristine y=i, then corrupt 4 of them (~44%) to wild outliers.
  // Theil-Sen would also survive 1, but Siegel survives many more because each
  // anchor's inner median is itself robust before being fed into the outer median.
  const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  // corrupt indices 0, 2, 5, 7 -> 4 of 9 ~ 44%
  xs[0] = -1e9;
  xs[2] = 1e9;
  xs[5] = -1e9;
  xs[7] = 1e9;
  const r = siegelSlope(xs);
  // The 5 pristine anchors (1, 3, 4, 6, 8) still see ~half their inner slopes
  // pristine, so their inner medians stay near 1; outer median over 9 anchors
  // has at least 5 near-1 values, so slope ~= 1.
  assert.ok(Math.abs(r.slope - 1) < 1e-9, `expected ~1, got ${r.slope}`);
});

test('siegelSlope: rejects n < 2', () => {
  assert.throws(() => siegelSlope([5]), /at least 2 points/);
});

test('siegelSlope: anchor counts always sum to n', () => {
  const xs = [3, -1, 4, 1, -5, 9, 2, 6];
  const r = siegelSlope(xs);
  assert.equal(
    r.anchorsPositive + r.anchorsNegative + r.anchorsZero,
    xs.length,
  );
  assert.equal(r.perAnchorMedians.length, xs.length);
});

test('siegelSlope: translation-equivariant in x (slope unchanged, intercept shifts)', () => {
  const xs = [1, 4, 2, 8, 5, 7];
  const r1 = siegelSlope(xs);
  const r2 = siegelSlope(xs.map((v) => v + 100));
  assert.equal(r2.slope, r1.slope);
  assert.equal(r2.intercept, r1.intercept + 100);
  assert.equal(r2.anchorsPositive, r1.anchorsPositive);
  assert.equal(r2.anchorsNegative, r1.anchorsNegative);
});

test('siegelSlope: scale-equivariant in x (slope and intercept scale by k)', () => {
  const xs = [1, 4, 2, 8, 5, 7];
  const r1 = siegelSlope(xs);
  const r2 = siegelSlope(xs.map((v) => v * 7));
  assert.ok(Math.abs(r2.slope - 7 * r1.slope) < 1e-12);
  assert.ok(Math.abs(r2.intercept - 7 * r1.intercept) < 1e-12);
});

test('siegelSlope: per-anchor range is 0 for any perfect line', () => {
  const xs = [100, 97, 94, 91, 88, 85, 82];
  const r = siegelSlope(xs);
  assert.equal(r.perAnchorMedianRange, 0);
  assert.equal(r.slope, -3);
});

test('siegelSlope: pairsTotal == n*(n-1)', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = siegelSlope(xs);
  assert.equal(r.pairsTotal, 90);
});

test('builder: rejects minRows < 4', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSiegelSlope([], { minRows: 3, generatedAt: GEN }),
    /minRows must be an integer >= 4/,
  );
});

test('builder: rejects negative minSlopeMagnitude', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSiegelSlope([], {
        minSlopeMagnitude: -0.1,
        generatedAt: GEN,
      }),
    /minSlopeMagnitude must be a finite, non-negative number/,
  );
});

test('builder: rejects non-positive maxPairs', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSiegelSlope([], { maxPairs: 0, generatedAt: GEN }),
    /maxPairs must be a positive integer/,
  );
});

test('builder: rejects unknown sort key', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSiegelSlope([], {
        sort: 'bogus' as never,
        generatedAt: GEN,
      }),
    /sort must be one of/,
  );
});

test('builder: end-to-end with two sources, distinct slopes', () => {
  const queue: QueueLine[] = [
    ...mkSeries('alpha', [1, 2, 3, 4, 5, 6]),
    ...mkSeries('beta', [10, 8, 6, 4, 2, 0]),
  ];
  const r = buildSourceRowTokenSiegelSlope(queue, { generatedAt: GEN });
  assert.equal(r.totalSources, 2);
  assert.equal(r.totalRowsKept, 12);
  const beta = r.sources.find((s) => s.source === 'beta')!;
  const alpha = r.sources.find((s) => s.source === 'alpha')!;
  assert.equal(beta.slope, -2);
  assert.equal(alpha.slope, 1);
  assert.equal(beta.slopeSign, 'down');
  assert.equal(alpha.slopeSign, 'up');
  // default sort is magnitude-desc; |beta| = 2 > |alpha| = 1
  assert.equal(r.sources[0]!.source, 'beta');
});

test('builder: drops sources below minRows', () => {
  const queue: QueueLine[] = [
    ...mkSeries('tiny', [1, 2, 3]),
    ...mkSeries('big', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenSiegelSlope(queue, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('builder: drops sources above pair cap', () => {
  // n=6 -> n*(n-1) = 30 ordered slopes; cap at 20 should drop it.
  const queue: QueueLine[] = mkSeries('big', [1, 2, 3, 4, 5, 6]);
  const r = buildSourceRowTokenSiegelSlope(queue, {
    maxPairs: 20,
    generatedAt: GEN,
  });
  assert.equal(r.droppedAbovePairCap, 1);
  assert.equal(r.sources.length, 0);
});

test('builder: applies min-slope-magnitude cohort filter', () => {
  const queue: QueueLine[] = [
    ...mkSeries('flat', [5, 5, 5, 5, 5]),
    ...mkSeries('steep', [0, 10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenSiegelSlope(queue, {
    minSlopeMagnitude: 1,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinSlopeMagnitude, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'steep');
});

test('builder: drops bad hour_start, bad/negative tokens', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 5),
    ql('2026-04-27T00:00:00.000Z', 'a', Number.NaN),
    ql('2026-04-27T00:01:00.000Z', 'a', -3),
    ...mkSeries('a', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenSiegelSlope(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 5);
});

test('builder: top cap surfaces droppedBelowTopCap', () => {
  const queue: QueueLine[] = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [5, 4, 3, 2, 1]),
    ...mkSeries('c', [2, 4, 6, 8, 10]),
  ];
  const r = buildSourceRowTokenSiegelSlope(queue, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.sources.length, 2);
});

test('builder: source filter restricts and counts droppedSourceFilter', () => {
  const queue: QueueLine[] = [
    ...mkSeries('keep', [1, 2, 3, 4, 5]),
    ...mkSeries('drop', [9, 9, 9, 9, 9]),
  ];
  const r = buildSourceRowTokenSiegelSlope(queue, {
    source: 'keep',
    generatedAt: GEN,
  });
  assert.equal(r.droppedSourceFilter, 5);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
});

test('builder: sort=slope-asc puts most negative first', () => {
  const queue: QueueLine[] = [
    ...mkSeries('up', [1, 2, 3, 4, 5]),
    ...mkSeries('downhard', [100, 80, 60, 40, 20]),
    ...mkSeries('downsoft', [10, 9, 8, 7, 6]),
  ];
  const r = buildSourceRowTokenSiegelSlope(queue, {
    sort: 'slope-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'downhard');
  assert.equal(r.sources[r.sources.length - 1]!.source, 'up');
});

test('builder: naiveSlope matches (last-first)/(n-1)', () => {
  // Pristine line slope=2, with one mid-row outlier. Siegel ignores it.
  const queue: QueueLine[] = mkSeries('s', [10, 12, 14, 100, 18, 20]);
  const r = buildSourceRowTokenSiegelSlope(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.firstX, 10);
  assert.equal(row.lastX, 20);
  assert.equal(row.naiveSlope, (20 - 10) / 5);
  assert.equal(row.slope, 2);
});

test('builder: empty source name maps to "unknown"', () => {
  const queue: QueueLine[] = mkSeries('', [1, 2, 3, 4]);
  const r = buildSourceRowTokenSiegelSlope(queue, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('builder: chronological sort respected even when input is shuffled', () => {
  const queue: QueueLine[] = [
    ql('2026-04-27T00:05:00.000Z', 's', 50),
    ql('2026-04-27T00:01:00.000Z', 's', 10),
    ql('2026-04-27T00:02:00.000Z', 's', 20),
    ql('2026-04-27T00:03:00.000Z', 's', 30),
    ql('2026-04-27T00:04:00.000Z', 's', 40),
  ];
  const r = buildSourceRowTokenSiegelSlope(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.firstX, 10);
  assert.equal(row.lastX, 50);
  assert.equal(row.slope, 10);
});

test('builder: anchor counts sum to rowsKept per source', () => {
  const queue: QueueLine[] = [
    ...mkSeries('a', [1, 1, 2, 3, 5, 8]),
    ...mkSeries('b', [3, 1, 4, 1, 5, 9, 2, 6]),
  ];
  const r = buildSourceRowTokenSiegelSlope(queue, { generatedAt: GEN });
  for (const row of r.sources) {
    assert.equal(
      row.anchorsPositive + row.anchorsNegative + row.anchorsZero,
      row.rowsKept,
    );
    assert.equal(row.pairsTotal, row.rowsKept * (row.rowsKept - 1));
  }
});

test('builder: report carries echoed options and counters', () => {
  const queue: QueueLine[] = mkSeries('s', [1, 2, 3, 4, 5]);
  const r = buildSourceRowTokenSiegelSlope(queue, {
    minRows: 4,
    minSlopeMagnitude: 0.5,
    maxPairs: 1000,
    sort: 'rows',
    top: 10,
    generatedAt: GEN,
  });
  assert.equal(r.minRows, 4);
  assert.equal(r.minSlopeMagnitude, 0.5);
  assert.equal(r.maxPairs, 1000);
  assert.equal(r.sort, 'rows');
  assert.equal(r.top, 10);
  assert.equal(r.generatedAt, GEN);
});

test('builder: perAnchorMedianRange is 0 for a perfect line', () => {
  const queue: QueueLine[] = mkSeries('s', [10, 13, 16, 19, 22, 25]);
  const r = buildSourceRowTokenSiegelSlope(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.perAnchorMedianRange, 0);
  assert.equal(row.slope, 3);
});

test('builder: perAnchorMedianRange grows with heterogeneous trend', () => {
  // First half climbs gently by 1, second half plummets by 20 (still
  // non-negative — the builder drops negative total_tokens). Anchors in
  // the first half see a near-zero/positive inner median, anchors in the
  // second half see strongly negative inner medians.
  const queue: QueueLine[] = mkSeries(
    's',
    [100, 101, 102, 103, 104, 105, 85, 65, 45, 25],
  );
  const r = buildSourceRowTokenSiegelSlope(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.rowsKept, 10);
  assert.ok(
    row.perAnchorMedianRange > 1,
    `expected wide per-anchor spread, got ${row.perAnchorMedianRange}`,
  );
});

test('builder: anchorAgreement is 1.0 for any monotone series', () => {
  const queue: QueueLine[] = mkSeries('mono', [1, 2, 3, 4, 5, 6, 7, 8]);
  const r = buildSourceRowTokenSiegelSlope(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // every anchor's inner median is positive -> anchorsPositive = 8, agreement = 1.
  assert.equal(row.anchorAgreement, 1);
  assert.equal(row.anchorsPositive, 8);
});

test('builder: anchorAgreement is 1.0 for a flat series (all anchors zero)', () => {
  const queue: QueueLine[] = mkSeries('flat', [9, 9, 9, 9, 9, 9]);
  const r = buildSourceRowTokenSiegelSlope(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.anchorAgreement, 1);
  assert.equal(row.anchorsZero, 6);
});

test('builder: anchorAgreement reflects dominant bucket fraction', () => {
  // Roughly 5 up anchors, 1 down anchor in a noisy increasing series.
  const queue: QueueLine[] = mkSeries('noisy', [1, 2, 3, 4, 5, 0]);
  const r = buildSourceRowTokenSiegelSlope(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  const dominant = Math.max(
    row.anchorsPositive,
    row.anchorsNegative,
    row.anchorsZero,
  );
  assert.equal(row.anchorAgreement, dominant / row.rowsKept);
  assert.ok(row.anchorAgreement >= 1 / 3 && row.anchorAgreement <= 1);
});

test('builder: sort=agreement-desc puts the most-unanimous source first', () => {
  const queue: QueueLine[] = [
    ...mkSeries('unanimous', [1, 2, 3, 4, 5, 6]), // agreement 1.0
    ...mkSeries('split', [10, 1, 10, 1, 10, 1]), // agreement < 1.0
  ];
  const r = buildSourceRowTokenSiegelSlope(queue, {
    sort: 'agreement-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'unanimous');
  assert.equal(r.sources[0]!.anchorAgreement, 1);
});
