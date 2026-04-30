import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenPietraRatio,
  pietraOfVector,
} from '../src/dailytokenpietraratio.js';
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

const GEN = '2026-05-01T00:00:00.000Z';

// ---- pietraOfVector ------------------------------------------------------

test('pietraOfVector: empty -> 0', () => {
  const r = pietraOfVector([]);
  assert.equal(r.pietra, 0);
  assert.equal(r.nBelowMean, 0);
  assert.equal(r.belowMeanShare, 0);
  assert.equal(r.lorenzAtBelowMean, 0);
});

test('pietraOfVector: singleton -> 0', () => {
  const r = pietraOfVector([42]);
  assert.equal(r.pietra, 0);
});

test('pietraOfVector: all zeros -> 0', () => {
  const r = pietraOfVector([0, 0, 0, 0]);
  assert.equal(r.pietra, 0);
});

test('pietraOfVector: uniform -> 0', () => {
  const r = pietraOfVector([7, 7, 7, 7, 7]);
  assert.ok(Math.abs(r.pietra) < 1e-12);
  // Every D_i == mu, so all are "<= mu" -> belowMeanShare = 1.
  assert.equal(r.belowMeanShare, 1);
  // Lorenz at p=1 is 1 by construction; gap = 1 - 1 = 0.
  assert.ok(Math.abs(r.lorenzAtBelowMean - 1) < 1e-12);
});

test('pietraOfVector: max-skew (only top is nonzero) -> (n-1)/n', () => {
  // n=5, mu = 100/5 = 20.
  // |0-20|*4 + |100-20| = 80 + 80 = 160. P = 160 / (2*5*20) = 160/200 = 0.8.
  // Also (n-1)/n = 4/5 = 0.8.
  const r = pietraOfVector([0, 0, 0, 0, 100]);
  assert.ok(Math.abs(r.pietra - 0.8) < 1e-12);
  assert.equal(r.nBelowMean, 4);
  assert.ok(Math.abs(r.belowMeanShare - 0.8) < 1e-12);
  assert.ok(Math.abs(r.lorenzAtBelowMean - 0) < 1e-12);
  // aboveMeanLift = 100 / 20 = 5.
  assert.ok(Math.abs(r.aboveMeanLift - 5) < 1e-12);
});

test('pietraOfVector: rejects negative or non-finite', () => {
  assert.throws(() => pietraOfVector([1, -1]));
  assert.throws(() => pietraOfVector([1, NaN]));
  assert.throws(() => pietraOfVector([1, Infinity]));
});

test('pietraOfVector: order-invariant', () => {
  const a = [10, 1, 2, 3, 7];
  const b = [3, 7, 1, 10, 2];
  const pa = pietraOfVector(a);
  const pb = pietraOfVector(b);
  assert.ok(Math.abs(pa.pietra - pb.pietra) < 1e-12);
});

test('pietraOfVector: bounded in [0, 1-1/n]', () => {
  const cases = [
    [1, 1, 1, 1, 1, 1],
    [1, 2, 3, 4, 5],
    [0, 0, 0, 1, 1000000],
    [10, 10, 10, 10, 10000],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5000000],
  ];
  for (const c of cases) {
    const r = pietraOfVector(c);
    const upper = (c.length - 1) / c.length + 1e-12;
    assert.ok(r.pietra >= 0 && r.pietra <= upper, `pietra out of range: ${r.pietra} (cap ${upper})`);
    assert.ok(r.belowMeanShare >= 0 && r.belowMeanShare <= 1);
    assert.ok(r.lorenzAtBelowMean >= 0 && r.lorenzAtBelowMean <= 1);
  }
});

test('pietraOfVector: identity P = belowMeanShare - lorenzAtBelowMean', () => {
  // Pietra equals the Lorenz gap at p* = #{D_i <= mu}/n.
  const cases = [
    [1, 2, 3, 4, 5],
    [0, 0, 0, 0, 100],
    [3, 3, 3, 100, 200, 1000],
    [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  ];
  for (const c of cases) {
    const r = pietraOfVector(c);
    const gap = r.belowMeanShare - r.lorenzAtBelowMean;
    assert.ok(
      Math.abs(r.pietra - gap) < 1e-12,
      `Pietra (${r.pietra}) != Lorenz gap (${gap}) for ${JSON.stringify(c)}`,
    );
  }
});

test('pietraOfVector: known case [1, 3]', () => {
  // n=2, mu=2, |1-2|+|3-2| = 2. P = 2 / (2*2*2) = 0.25.
  const r = pietraOfVector([1, 3]);
  assert.ok(Math.abs(r.pietra - 0.25) < 1e-12);
  assert.equal(r.nBelowMean, 1);
});

test('pietraOfVector: aboveMeanLift sanity', () => {
  // [1, 1, 1, 1, 96]: mu=20. aboveMeanLift = 96/20 = 4.8.
  const r = pietraOfVector([1, 1, 1, 1, 96]);
  assert.ok(Math.abs(r.aboveMeanLift - 4.8) < 1e-12);
});

// ---- builder: shape and filters -----------------------------------------

test('buildDailyTokenPietraRatio: empty queue -> empty report', () => {
  const r = buildDailyTokenPietraRatio([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.minDays, 2);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.sort, 'pietra');
  assert.equal(r.minPietra, 0);
});

test('buildDailyTokenPietraRatio: single source, uniform days -> P ~ 0', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-23T05:00:00.000Z', 'src-a', 5000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src-a');
  assert.equal(row.nDays, 4);
  assert.ok(Math.abs(row.pietra) < 1e-12);
  assert.equal(row.totalTokens, 20000);
});

test('buildDailyTokenPietraRatio: max-skew days -> P ~ (n-1)/n', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-23T05:00:00.000Z', 'src-a', 1_000_000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  const row = r.sources[0]!;
  assert.equal(row.nDays, 4);
  // Cap is 3/4 = 0.75; should be within 1% of cap.
  assert.ok(row.pietra > 0.74 && row.pietra <= 0.75 + 1e-12);
  assert.equal(row.maxDay, '2026-04-23');
  assert.equal(row.nBelowMean, 3);
});

test('buildDailyTokenPietraRatio: collapses multi-hour rows on same day', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T01:00:00.000Z', 'src-a', 2000),
    ql('2026-04-20T05:00:00.000Z', 'src-a', 3000),
    ql('2026-04-20T18:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 10000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  const row = r.sources[0]!;
  assert.equal(row.nDays, 2);
  assert.equal(row.totalTokens, 20000);
  assert.ok(Math.abs(row.pietra) < 1e-12);
});

test('buildDailyTokenPietraRatio: minTokens filter drops sparse sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 100),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 100),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 5000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-b');
});

test('buildDailyTokenPietraRatio: minDays filter drops too-short sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 50000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-b', 5000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 2,
  });
  assert.equal(r.droppedBelowMinDays, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-b');
});

test('buildDailyTokenPietraRatio: source filter and droppedSourceFilter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 5000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
    source: 'src-b',
  });
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-b');
});

test('buildDailyTokenPietraRatio: time window filter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-19T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 5000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-22T00:00:00.000Z',
  });
  const row = r.sources[0]!;
  assert.equal(row.nDays, 2);
  assert.equal(row.totalTokens, 10000);
});

test('buildDailyTokenPietraRatio: invalid hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'src-a', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('buildDailyTokenPietraRatio: non-positive tokens dropped', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 0),
    ql('2026-04-20T06:00:00.000Z', 'src-a', -10),
    ql('2026-04-20T07:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources[0]!.totalTokens, 10000);
});

test('buildDailyTokenPietraRatio: sort=pietra default DESC', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 1),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 1),
    ql('2026-04-22T05:00:00.000Z', 'src-b', 100000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources[0]!.source, 'src-b');
  assert.equal(r.sources[1]!.source, 'src-a');
});

test('buildDailyTokenPietraRatio: sort=tokens DESC', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 1000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 1000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 50000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 50000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
    sort: 'tokens',
  });
  assert.equal(r.sources[0]!.source, 'src-b');
  assert.equal(r.sources[1]!.source, 'src-a');
});

test('buildDailyTokenPietraRatio: top cap drops tail', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-c', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-c', 5000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources.length, 2);
});

test('buildDailyTokenPietraRatio: minPietra filter drops low-skew sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-20T05:00:00.000Z', 'src-b', 1),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 1),
    ql('2026-04-22T05:00:00.000Z', 'src-b', 100000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minPietra: 0.3,
  });
  assert.equal(r.droppedBelowMinPietra, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-b');
  assert.equal(r.minPietra, 0.3);
});

test('buildDailyTokenPietraRatio: rejects bad knobs', () => {
  assert.throws(() => buildDailyTokenPietraRatio([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenPietraRatio([], { minDays: 1 }));
  assert.throws(() => buildDailyTokenPietraRatio([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenPietraRatio([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenPietraRatio([], { sort: 'nope' as 'pietra' }),
  );
  assert.throws(() => buildDailyTokenPietraRatio([], { since: 'not-a-date' }));
  assert.throws(() => buildDailyTokenPietraRatio([], { until: 'not-a-date' }));
  assert.throws(() => buildDailyTokenPietraRatio([], { minPietra: -0.1 }));
  assert.throws(() => buildDailyTokenPietraRatio([], { minPietra: 1.1 }));
});

test('buildDailyTokenPietraRatio: orthogonality vs Gini -- same Pietra, different Gini', () => {
  // Two day-vectors hand-tuned so their Pietra ratios are identical
  // but the Lorenz curve shapes differ above and below the mean,
  // giving different Gini coefficients. Pietra anchors at p* = the
  // share at-or-below the mean and only sees the Lorenz value at
  // that single p; Gini integrates the gap.
  //
  // Vector A: [10, 10, 10, 10, 60]    mu=20, P = (40+40)/(2*5*20) = 0.4
  // Vector B: [0, 0, 20, 20, 60]      mu=20, P = (60+20+20)/(2*5*20) = 0.5
  // Skip B; instead try A vs A' = [5, 15, 10, 10, 60]: mu=20,
  //   |D - mu| = 15+5+10+10+40 = 80, P = 80/200 = 0.4. Same Pietra.
  // But A' has internal spread among the below-mean days that A lacks,
  // which moves the Lorenz curve and therefore Gini.
  const queueA: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 10),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 10),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 10),
    ql('2026-04-23T05:00:00.000Z', 'src-a', 10),
    ql('2026-04-24T05:00:00.000Z', 'src-a', 60),
  ];
  const queueAprime: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-b', 5),
    ql('2026-04-21T05:00:00.000Z', 'src-b', 15),
    ql('2026-04-22T05:00:00.000Z', 'src-b', 10),
    ql('2026-04-23T05:00:00.000Z', 'src-b', 10),
    ql('2026-04-24T05:00:00.000Z', 'src-b', 60),
  ];
  const rA = buildDailyTokenPietraRatio(queueA, {
    generatedAt: GEN,
    minTokens: 0,
  });
  const rB = buildDailyTokenPietraRatio(queueAprime, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.ok(Math.abs(rA.sources[0]!.pietra - rB.sources[0]!.pietra) < 1e-12);
  assert.ok(Math.abs(rA.sources[0]!.pietra - 0.4) < 1e-12);
});

// ---- refinement (v0.6.272): Gini comparison -----------------------------

import { classifyPietraGiniStyle, PIETRA_GINI_RATIO_THRESHOLDS } from '../src/dailytokenpietraratio.js';

test('classifyPietraGiniStyle: degenerate paths', () => {
  assert.equal(classifyPietraGiniStyle(0, 0), 'degenerate');
  assert.equal(classifyPietraGiniStyle(0, 0.5), 'degenerate');
  assert.equal(classifyPietraGiniStyle(0.5, 0), 'degenerate');
});

test('classifyPietraGiniStyle: ratio thresholds', () => {
  assert.equal(classifyPietraGiniStyle(0.9, 1.0), 'point-anchored');
  assert.equal(classifyPietraGiniStyle(0.4, 1.0), 'curve-spread');
  assert.equal(classifyPietraGiniStyle(0.6, 1.0), 'mixed');
  // Boundaries: just above 0.7 -> point-anchored, just below -> mixed
  assert.equal(
    classifyPietraGiniStyle(PIETRA_GINI_RATIO_THRESHOLDS.pointAnchoredLower + 0.001, 1),
    'point-anchored',
  );
  assert.equal(
    classifyPietraGiniStyle(PIETRA_GINI_RATIO_THRESHOLDS.pointAnchoredLower - 0.001, 1),
    'mixed',
  );
  // Below 0.55 -> curve-spread
  assert.equal(
    classifyPietraGiniStyle(PIETRA_GINI_RATIO_THRESHOLDS.curveSpreadUpper - 0.001, 1),
    'curve-spread',
  );
});

test('buildDailyTokenPietraRatio: showGiniComparison off by default omits gini fields', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 1_000_000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  const row = r.sources[0]!;
  assert.equal(r.showGiniComparison, false);
  assert.equal(row.gini, undefined);
  assert.equal(row.pietraToGiniRatio, undefined);
  assert.equal(row.concentrationStyle, undefined);
});

test('buildDailyTokenPietraRatio: showGiniComparison enforces P <= G', () => {
  // Exercise a wide variety of shapes.
  const cases: Array<[string, number[]]> = [
    ['uniform', [10, 10, 10, 10]],
    ['ramp', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
    ['two-point', [1, 1, 1, 1, 100]],
    ['three-cluster', [1, 1, 1, 50, 50, 1000]],
    ['bimodal', [1, 1, 1, 1, 100, 100, 100, 100]],
  ];
  for (const [label, vec] of cases) {
    const queue: QueueLine[] = vec.map((v, i) => {
      const day = String(20 + i).padStart(2, '0');
      return ql(`2026-04-${day}T05:00:00.000Z`, 'src-x', v);
    });
    const r = buildDailyTokenPietraRatio(queue, {
      generatedAt: GEN,
      minTokens: 0,
      showGiniComparison: true,
    });
    const row = r.sources[0]!;
    assert.ok(row.gini !== undefined, `${label}: gini undefined`);
    assert.ok(
      row.pietra <= row.gini! + 1e-12,
      `${label}: P (${row.pietra}) > G (${row.gini})`,
    );
    assert.ok(
      row.pietraToGiniRatio! >= 0 && row.pietraToGiniRatio! <= 1 + 1e-12,
      `${label}: P/G out of range: ${row.pietraToGiniRatio}`,
    );
    assert.ok(
      ['degenerate', 'point-anchored', 'mixed', 'curve-spread'].includes(
        row.concentrationStyle!,
      ),
    );
  }
});

test('buildDailyTokenPietraRatio: two-point distribution -> P = G', () => {
  // Theorem: for a two-valued vector, Pietra equals Gini exactly.
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-23T05:00:00.000Z', 'src-a', 1),
    ql('2026-04-24T05:00:00.000Z', 'src-a', 1_000_000),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
    showGiniComparison: true,
  });
  const row = r.sources[0]!;
  // Both should be very close to 4/5 = 0.8.
  assert.ok(Math.abs(row.pietra - row.gini!) < 1e-3);
  assert.equal(row.concentrationStyle, 'point-anchored');
});

test('buildDailyTokenPietraRatio: uniform -> degenerate style', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'src-a', 100),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 100),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 100),
    ql('2026-04-23T05:00:00.000Z', 'src-a', 100),
  ];
  const r = buildDailyTokenPietraRatio(queue, {
    generatedAt: GEN,
    minTokens: 0,
    showGiniComparison: true,
  });
  const row = r.sources[0]!;
  assert.equal(row.concentrationStyle, 'degenerate');
});
