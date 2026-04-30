import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenHooverIndex,
  hooverOfVector,
} from '../src/dailytokenhooverindex.js';
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

// ---- hooverOfVector primitive -----------------------------------------

test('hooverOfVector: empty -> degenerate, hoover=0', () => {
  const r = hooverOfVector([]);
  assert.equal(r.hoover, 0);
  assert.equal(r.degenerate, true);
});

test('hooverOfVector: n=1 -> degenerate, hoover=0', () => {
  const r = hooverOfVector([42]);
  assert.equal(r.hoover, 0);
  assert.equal(r.degenerate, true);
});

test('hooverOfVector: all-zero -> degenerate, hoover=0', () => {
  const r = hooverOfVector([0, 0, 0, 0]);
  assert.equal(r.hoover, 0);
  assert.equal(r.degenerate, true);
});

test('hooverOfVector: perfect equality -> hoover=0', () => {
  const r = hooverOfVector([10, 10, 10, 10]);
  assert.equal(r.hoover, 0);
  assert.equal(r.degenerate, false);
  assert.equal(r.nAboveMean, 0);
  assert.equal(r.nBelowMean, 0);
  assert.equal(r.nAtMean, 4);
});

test('hooverOfVector: two-point binary distribution', () => {
  // [0, 100]: shares = [0, 1], uniform = 0.5
  // |0 - 0.5| + |1 - 0.5| = 1; hoover = 0.5
  const r = hooverOfVector([0, 100]);
  assert.equal(r.hoover, 0.5);
  assert.equal(r.nAboveMean, 1);
  assert.equal(r.nBelowMean, 1);
});

test('hooverOfVector: three-point asymmetric, exact value', () => {
  // [1, 2, 7]: total=10, shares=[0.1,0.2,0.7], uniform=1/3
  // |0.1-1/3|=0.2333..; |0.2-1/3|=0.1333..; |0.7-1/3|=0.3666..
  // sum = 0.7333..; hoover = 0.3666..
  const r = hooverOfVector([1, 2, 7]);
  assert.ok(Math.abs(r.hoover - 11 / 30) < 1e-12);
  assert.equal(r.nAboveMean, 1);
  assert.equal(r.nBelowMean, 2);
});

test('hooverOfVector: above-excess equals below-deficit equals hoover', () => {
  const r = hooverOfVector([1, 5, 9, 23, 100]);
  assert.ok(Math.abs(r.aboveMeanExcess - r.hoover) < 1e-12);
  assert.ok(Math.abs(r.belowMeanDeficit - r.hoover) < 1e-12);
});

test('hooverOfVector: hoover in [0, 1)', () => {
  for (const v of [
    [1, 1, 1],
    [1, 2, 3, 4, 5],
    [0, 0, 1],
    [1, 1, 1, 1000000],
  ]) {
    const r = hooverOfVector(v);
    assert.ok(r.hoover >= 0);
    assert.ok(r.hoover < 1);
  }
});

test('hooverOfVector: scale invariance', () => {
  const a = hooverOfVector([1, 2, 3, 4, 5]);
  const b = hooverOfVector([1000, 2000, 3000, 4000, 5000]);
  assert.ok(Math.abs(a.hoover - b.hoover) < 1e-12);
});

test('hooverOfVector: permutation invariance', () => {
  const a = hooverOfVector([1, 2, 3, 4, 5]);
  const b = hooverOfVector([5, 1, 4, 2, 3]);
  assert.ok(Math.abs(a.hoover - b.hoover) < 1e-12);
});

test('hooverOfVector: Pigou-Dalton -- mean-preserving regressive transfer raises hoover', () => {
  // start [3, 4, 5], move 1 unit from below-mean to above-mean
  const before = hooverOfVector([3, 4, 5]);
  const after = hooverOfVector([2, 4, 6]); // regressive
  assert.ok(after.hoover > before.hoover);
});

test('hooverOfVector: zero-mass days count below mean', () => {
  const r = hooverOfVector([0, 0, 100]);
  // shares = [0,0,1], uniform=1/3
  // hoover = 0.5 * (1/3 + 1/3 + 2/3) = 0.5 * 4/3 = 2/3
  assert.ok(Math.abs(r.hoover - 2 / 3) < 1e-12);
  assert.equal(r.nBelowMean, 2);
  assert.equal(r.nAboveMean, 1);
});

test('hooverOfVector: rejects negative', () => {
  assert.throws(() => hooverOfVector([1, -1, 2]));
});

test('hooverOfVector: rejects NaN', () => {
  assert.throws(() => hooverOfVector([1, Number.NaN, 2]));
});

test('hooverOfVector: rejects infinity', () => {
  assert.throws(() => hooverOfVector([1, Number.POSITIVE_INFINITY, 2]));
});

// ---- buildDailyTokenHooverIndex top-level -----------------------------

test('build: empty queue -> 0 sources', () => {
  const r = buildDailyTokenHooverIndex([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('build: single source equal-mass days -> hoover=0', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 1000),
    ql('2026-04-03T00:00:00Z', 'a', 1000),
    ql('2026-04-04T00:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenHooverIndex(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.hoover, 0);
  assert.equal(r.sources[0]!.nDays, 4);
});

test('build: two-point distribution has hoover=0.5 and h/g=1 (canonical)', () => {
  // [1000, 9000] across 2 days. Both indices read the same Lorenz curve.
  // For binary, hoover = gini, so hooverOverGini = 1 exactly.
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 9000),
  ];
  const r = buildDailyTokenHooverIndex(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  // shares 0.1, 0.9, uniform 0.5
  // hoover = 0.5 * (0.4 + 0.4) = 0.4
  assert.ok(Math.abs(row.hoover - 0.4) < 1e-12);
  assert.ok(Math.abs(row.hooverOverGini - 1.0) < 1e-9);
});

test('build: filters by minTokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'big', 5000),
    ql('2026-04-02T00:00:00Z', 'big', 5000),
    ql('2026-04-01T00:00:00Z', 'small', 100),
    ql('2026-04-02T00:00:00Z', 'small', 200),
  ];
  const r = buildDailyTokenHooverIndex(q, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('build: filters by minDays (Hoover degenerate for n<2)', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'oneday', 5000),
    ql('2026-04-01T01:00:00Z', 'oneday', 5000),
    ql('2026-04-01T00:00:00Z', 'twoday', 5000),
    ql('2026-04-02T00:00:00Z', 'twoday', 5000),
  ];
  const r = buildDailyTokenHooverIndex(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'twoday');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('build: respects --since/--until window', () => {
  const q: QueueLine[] = [
    ql('2026-03-01T00:00:00Z', 'a', 5000),
    ql('2026-04-01T00:00:00Z', 'a', 5000),
    ql('2026-04-02T00:00:00Z', 'a', 5000),
    ql('2026-05-15T00:00:00Z', 'a', 5000),
  ];
  const r = buildDailyTokenHooverIndex(q, {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00Z',
    until: '2026-05-01T00:00:00Z',
  });
  assert.equal(r.sources[0]!.nDays, 2);
});

test('build: drops invalid hour_start and non-positive tokens', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'a', 5000),
    ql('2026-04-01T00:00:00Z', 'a', 0),
    ql('2026-04-01T00:00:00Z', 'a', -5),
    ql('2026-04-01T00:00:00Z', 'a', 5000),
    ql('2026-04-02T00:00:00Z', 'a', 5000),
  ];
  const r = buildDailyTokenHooverIndex(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources[0]!.nDays, 2);
});

test('build: source filter', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 5000),
    ql('2026-04-02T00:00:00Z', 'a', 5000),
    ql('2026-04-01T00:00:00Z', 'b', 5000),
    ql('2026-04-02T00:00:00Z', 'b', 5000),
  ];
  const r = buildDailyTokenHooverIndex(q, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 2);
});

test('build: minHoover display filter', () => {
  // a: equal -> hoover=0; b: skewed -> hoover>0
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 5000),
    ql('2026-04-02T00:00:00Z', 'a', 5000),
    ql('2026-04-01T00:00:00Z', 'b', 1000),
    ql('2026-04-02T00:00:00Z', 'b', 9000),
  ];
  const r = buildDailyTokenHooverIndex(q, {
    generatedAt: GEN,
    minHoover: 0.1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowMinHoover, 1);
});

test('build: top cap', () => {
  const q: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    q.push(ql('2026-04-01T00:00:00Z', s, 1000));
    q.push(ql('2026-04-02T00:00:00Z', s, s === 'a' ? 9000 : s === 'b' ? 5000 : 1100));
  }
  const r = buildDailyTokenHooverIndex(q, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('build: sort by hoover desc default; ties: source asc', () => {
  // a, b both equal -> hoover=0 -> tied; sorted by source asc.
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'b', 1000),
    ql('2026-04-02T00:00:00Z', 'b', 1000),
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenHooverIndex(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('build: includeReferenceDeviation surfaces hoover/gini - 0.75', () => {
  // [1000, 9000]: hoover=0.4, gini=0.4 (binary), h/g=1.0, dev=0.25
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 9000),
  ];
  const r = buildDailyTokenHooverIndex(q, {
    generatedAt: GEN,
    includeReferenceDeviation: true,
  });
  const row = r.sources[0]!;
  assert.ok(row.referenceDeviation !== undefined);
  assert.ok(Math.abs(row.referenceDeviation! - 0.25) < 1e-9);
});

test('build: validates minDays >= 2', () => {
  assert.throws(() => buildDailyTokenHooverIndex([], { minDays: 1 }));
});

test('build: validates minHoover in [0, 1)', () => {
  assert.throws(() => buildDailyTokenHooverIndex([], { minHoover: 1 }));
  assert.throws(() => buildDailyTokenHooverIndex([], { minHoover: -0.1 }));
});

test('build: validates sort key', () => {
  assert.throws(() =>
    buildDailyTokenHooverIndex([], {
      // @ts-expect-error: bad sort key
      sort: 'bogus',
    }),
  );
});

test('build: validates since/until', () => {
  assert.throws(() => buildDailyTokenHooverIndex([], { since: 'bad' }));
  assert.throws(() => buildDailyTokenHooverIndex([], { until: 'bad' }));
});

test('build: hoover/gini ratio is in (0, 1] for non-degenerate data', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'a', (i + 1) * 1000));
  }
  const r = buildDailyTokenHooverIndex(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(row.hooverOverGini > 0);
  assert.ok(row.hooverOverGini <= 1);
});

test('build: nAboveMean + nBelowMean + nAtMean = nDays', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 7; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'a', (i + 1) * 1000));
  }
  const r = buildDailyTokenHooverIndex(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.nAboveMean + row.nBelowMean + row.nAtMean, row.nDays);
});

test('build: aboveMeanExcess equals belowMeanDeficit equals hoover (identity)', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 11; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'a', (i % 5) * 1000 + 100));
  }
  const r = buildDailyTokenHooverIndex(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.aboveMeanExcess - row.hoover) < 1e-12);
  assert.ok(Math.abs(row.belowMeanDeficit - row.hoover) < 1e-12);
});

test('build: meanDailyTokens = totalTokens / nDays', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 2000),
    ql('2026-04-03T00:00:00Z', 'a', 3000),
    ql('2026-04-04T00:00:00Z', 'a', 4000),
  ];
  const r = buildDailyTokenHooverIndex(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.meanDailyTokens, 2500);
  assert.equal(row.totalTokens, 10000);
});

test('build: minDay/maxDay reflect extremes', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 5000),
    ql('2026-04-02T00:00:00Z', 'a', 1000),
    ql('2026-04-03T00:00:00Z', 'a', 9000),
  ];
  const r = buildDailyTokenHooverIndex(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.minDay, '2026-04-02');
  assert.equal(row.maxDay, '2026-04-03');
  assert.equal(row.minDailyTokens, 1000);
  assert.equal(row.maxDailyTokens, 9000);
});

test('build: sort by hooverOverGini asc-of-NaN-last', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'flat', 5000),
    ql('2026-04-02T00:00:00Z', 'flat', 5000),
    ql('2026-04-01T00:00:00Z', 'spike', 1000),
    ql('2026-04-02T00:00:00Z', 'spike', 9000),
  ];
  const r = buildDailyTokenHooverIndex(q, {
    generatedAt: GEN,
    sort: 'hooverOverGini',
  });
  // 'flat' has gini=0 -> NaN, should sort to end
  assert.equal(r.sources[0]!.source, 'spike');
  assert.equal(r.sources[1]!.source, 'flat');
});

test('build: sort by aboveMeanExcess descending', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'low', 4000),
    ql('2026-04-02T00:00:00Z', 'low', 6000),
    ql('2026-04-01T00:00:00Z', 'high', 1000),
    ql('2026-04-02T00:00:00Z', 'high', 9000),
  ];
  const r = buildDailyTokenHooverIndex(q, {
    generatedAt: GEN,
    sort: 'aboveMeanExcess',
  });
  assert.equal(r.sources[0]!.source, 'high');
  assert.equal(r.sources[1]!.source, 'low');
});

// ---- refinement: pietra cross-anchor ----------------------------------

test('refinement: includePietraCrossAnchor surfaces pietra and gap', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    q.push(ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'a', (i + 1) * 1000));
  }
  const r = buildDailyTokenHooverIndex(q, {
    generatedAt: GEN,
    includePietraCrossAnchor: true,
  });
  const row = r.sources[0]!;
  assert.ok(row.pietra !== undefined);
  assert.ok(row.hooverMinusPietra !== undefined);
  assert.ok(row.pietra! >= 0);
});

test('refinement: hoover >= pietra identity holds for all non-negative vectors', () => {
  // Exercise on multiple shapes.
  const cases: number[][] = [
    [1, 2, 3, 4, 5],
    [1, 1, 1, 1000],
    [0, 0, 0, 100, 200],
    [10, 10, 10, 10, 10, 10, 10, 1000],
    [1, 5, 9, 23, 100, 2, 7, 11, 19],
  ];
  for (const v of cases) {
    const q: QueueLine[] = v.map((tt, i) =>
      ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'src', tt),
    );
    const r = buildDailyTokenHooverIndex(q, {
      generatedAt: GEN,
      includePietraCrossAnchor: true,
      minTokens: 0,
    });
    const row = r.sources[0]!;
    assert.ok(
      row.hooverMinusPietra! >= -1e-12,
      `hoover < pietra for ${JSON.stringify(v)} -- hoover=${row.hoover}, pietra=${row.pietra}`,
    );
  }
});

test('refinement: pietra absent unless flag set', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 9000),
  ];
  const r = buildDailyTokenHooverIndex(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.pietra, undefined);
  assert.equal(r.sources[0]!.hooverMinusPietra, undefined);
});

test('refinement: n=2 binary case has hoover - pietra = 0', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 9000),
  ];
  const r = buildDailyTokenHooverIndex(q, {
    generatedAt: GEN,
    includePietraCrossAnchor: true,
  });
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.hooverMinusPietra!) < 1e-9);
});
