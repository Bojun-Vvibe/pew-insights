import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenIqrRatio } from '../src/sourcerowtokeniqrratio.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
  model = 'm1',
  device_id = 'd1',
): QueueLine {
  return {
    source,
    model,
    hour_start,
    device_id,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

test('row-iqr: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenIqrRatio([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 4);
  assert.equal(r.minIqrRatio, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'iqr-ratio-desc');
  assert.equal(r.generatedAt, GEN);
});

test('row-iqr: rejects bad minRows / minIqrRatio / top / sort / since / until', () => {
  assert.throws(() => buildSourceRowTokenIqrRatio([], { minRows: 3 }));
  assert.throws(() => buildSourceRowTokenIqrRatio([], { minRows: 4.5 }));
  assert.throws(() => buildSourceRowTokenIqrRatio([], { minIqrRatio: -0.1 }));
  assert.throws(() =>
    buildSourceRowTokenIqrRatio([], { minIqrRatio: Number.NaN }),
  );
  assert.throws(() =>
    buildSourceRowTokenIqrRatio([], { minIqrRatio: Number.POSITIVE_INFINITY }),
  );
  assert.throws(() => buildSourceRowTokenIqrRatio([], { top: 0 }));
  assert.throws(() => buildSourceRowTokenIqrRatio([], { top: 1.5 }));
  assert.throws(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildSourceRowTokenIqrRatio([], { sort: 'bogus' as any }),
  );
  assert.throws(() => buildSourceRowTokenIqrRatio([], { since: 'nope' }));
  assert.throws(() => buildSourceRowTokenIqrRatio([], { until: 'nope' }));
});

test('row-iqr: bad hour_start / bad tokens / negative tokens are dropped', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql('2026-04-27T00:00:00.000Z', 'a', Number.NaN),
    ql('2026-04-27T01:00:00.000Z', 'a', -10),
    ql('2026-04-27T02:00:00.000Z', 'a', 100),
    ql('2026-04-27T03:00:00.000Z', 'a', 200),
    ql('2026-04-27T04:00:00.000Z', 'a', 300),
    ql('2026-04-27T05:00:00.000Z', 'a', 400),
  ];
  const r = buildSourceRowTokenIqrRatio(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.totalRowsKept, 4);
  assert.equal(r.sources.length, 1);
});

test('row-iqr: known series 100,200,300,400 -> q1=175, median=250, q3=325, iqrRatio=0.6', () => {
  // Type-7 quantiles for [100,200,300,400] (n=4):
  //   p=0.25: h=0.75, x[0]+0.75*(x[1]-x[0]) = 100 + 75 = 175
  //   p=0.50: h=1.50, x[1]+0.50*(x[2]-x[1]) = 200 + 50 = 250
  //   p=0.75: h=2.25, x[2]+0.25*(x[3]-x[2]) = 300 + 25 = 325
  //   iqr = 325 - 175 = 150, iqrRatio = 150/250 = 0.6
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 200),
    ql('2026-04-27T02:00:00.000Z', 'a', 300),
    ql('2026-04-27T03:00:00.000Z', 'a', 400),
  ];
  const r = buildSourceRowTokenIqrRatio(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.q1, 175);
  assert.equal(s.median, 250);
  assert.equal(s.q3, 325);
  assert.equal(s.iqr, 150);
  assert.ok(s.iqrRatio !== null);
  assert.ok(Math.abs(s.iqrRatio! - 0.6) < 1e-9);
  assert.equal(s.flat, false);
  assert.equal(s.degenerate, false);
});

test('row-iqr: constant non-zero series -> iqr=0, iqrRatio=0, flat=true', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 50),
    ql('2026-04-27T01:00:00.000Z', 'a', 50),
    ql('2026-04-27T02:00:00.000Z', 'a', 50),
    ql('2026-04-27T03:00:00.000Z', 'a', 50),
    ql('2026-04-27T04:00:00.000Z', 'a', 50),
  ];
  const r = buildSourceRowTokenIqrRatio(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.iqr, 0);
  assert.equal(s.iqrRatio, 0);
  assert.equal(s.flat, true);
  assert.equal(s.degenerate, false);
});

test('row-iqr: degenerate sparse-burst (median=0, iqr>0) -> iqrRatio=null, degenerate=true', () => {
  // Six rows, four zeros + two bursts. With n=6 type-7:
  //   sorted = [0, 0, 0, 0, 1000, 5000]
  //   q1: h=1.25 -> 0+0.25*(0-0)=0
  //   median: h=2.5 -> 0+0.5*(0-0)=0
  //   q3: h=3.75 -> 0+0.75*(1000-0)=750
  //   iqr=750, median=0 -> degenerate.
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 0),
    ql('2026-04-27T01:00:00.000Z', 'a', 0),
    ql('2026-04-27T02:00:00.000Z', 'a', 0),
    ql('2026-04-27T03:00:00.000Z', 'a', 0),
    ql('2026-04-27T04:00:00.000Z', 'a', 1000),
    ql('2026-04-27T05:00:00.000Z', 'a', 5000),
  ];
  const r = buildSourceRowTokenIqrRatio(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.median, 0);
  assert.equal(s.iqr, 750);
  assert.equal(s.iqrRatio, null);
  assert.equal(s.degenerate, true);
  assert.equal(s.flat, false);
});

test('row-iqr: source-filter restricts and counts dropped', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 200),
    ql('2026-04-27T02:00:00.000Z', 'a', 300),
    ql('2026-04-27T03:00:00.000Z', 'a', 400),
    ql('2026-04-27T04:00:00.000Z', 'b', 100),
    ql('2026-04-27T05:00:00.000Z', 'b', 100),
  ];
  const r = buildSourceRowTokenIqrRatio(q, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.source, 'a');
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalRowsKept, 4);
});

test('row-iqr: window since/until clamps rows', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 200),
    ql('2026-04-27T02:00:00.000Z', 'a', 300),
    ql('2026-04-27T03:00:00.000Z', 'a', 400),
    ql('2026-04-27T04:00:00.000Z', 'a', 500),
  ];
  const r = buildSourceRowTokenIqrRatio(q, {
    generatedAt: GEN,
    since: '2026-04-27T01:00:00.000Z',
    until: '2026-04-27T04:00:00.000Z',
  });
  // kept: 200, 300, 400 (3 rows). minRows defaults to 4 -> dropped.
  assert.equal(r.totalRowsKept, 3);
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('row-iqr: minRows below default keeps small cohorts (with explicit override)', () => {
  // The smallest legal minRows is 4 by API contract — verify rows < 4
  // are still tallied into totalRowsKept but excluded from sources[].
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 200),
    ql('2026-04-27T02:00:00.000Z', 'a', 300),
  ];
  const r = buildSourceRowTokenIqrRatio(q, {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(r.totalRowsKept, 3);
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('row-iqr: shuffling rows leaves IQR ratio invariant (order-independence)', () => {
  // Order-blindness — orthogonal to source-row-token-autocorrelation-lag1.
  const ordered = [
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 200),
    ql('2026-04-27T02:00:00.000Z', 'a', 300),
    ql('2026-04-27T03:00:00.000Z', 'a', 400),
    ql('2026-04-27T04:00:00.000Z', 'a', 500),
    ql('2026-04-27T05:00:00.000Z', 'a', 600),
  ];
  const reversed = ordered.slice().reverse();
  const r1 = buildSourceRowTokenIqrRatio(ordered, { generatedAt: GEN });
  const r2 = buildSourceRowTokenIqrRatio(reversed, { generatedAt: GEN });
  assert.equal(r1.sources[0]!.iqrRatio, r2.sources[0]!.iqrRatio);
  assert.equal(r1.sources[0]!.q1, r2.sources[0]!.q1);
  assert.equal(r1.sources[0]!.median, r2.sources[0]!.median);
  assert.equal(r1.sources[0]!.q3, r2.sources[0]!.q3);
});

test('row-iqr: outlier robustness — replacing the max with +1e15 leaves Q1/median/Q3 unchanged', () => {
  // The headline robustness story: order statistics are bounded by
  // *rank*, not value. CV / MAD-mean comparisons would shift wildly.
  const baseline = [
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 200),
    ql('2026-04-27T02:00:00.000Z', 'a', 300),
    ql('2026-04-27T03:00:00.000Z', 'a', 400),
    ql('2026-04-27T04:00:00.000Z', 'a', 500),
    ql('2026-04-27T05:00:00.000Z', 'a', 600),
  ];
  const withOutlier = baseline.slice(0, -1).concat([
    ql('2026-04-27T05:00:00.000Z', 'a', 1e15),
  ]);
  const r1 = buildSourceRowTokenIqrRatio(baseline, { generatedAt: GEN });
  const r2 = buildSourceRowTokenIqrRatio(withOutlier, { generatedAt: GEN });
  assert.equal(r1.sources[0]!.q1, r2.sources[0]!.q1);
  assert.equal(r1.sources[0]!.median, r2.sources[0]!.median);
  assert.equal(r1.sources[0]!.q3, r2.sources[0]!.q3);
  assert.equal(r1.sources[0]!.iqr, r2.sources[0]!.iqr);
  assert.equal(r1.sources[0]!.iqrRatio, r2.sources[0]!.iqrRatio);
});

test('row-iqr: sort modes and tiebreak by source asc', () => {
  // Three sources with distinct iqrRatios.
  const q: QueueLine[] = [];
  // a: 100,100,100,100 -> iqrRatio=0, flat
  for (let i = 0; i < 4; i += 1) {
    q.push(ql(`2026-04-27T0${i}:00:00.000Z`, 'a', 100));
  }
  // b: 100,200,300,400 -> iqrRatio=0.6
  q.push(ql('2026-04-27T00:00:00.000Z', 'b', 100));
  q.push(ql('2026-04-27T01:00:00.000Z', 'b', 200));
  q.push(ql('2026-04-27T02:00:00.000Z', 'b', 300));
  q.push(ql('2026-04-27T03:00:00.000Z', 'b', 400));
  // c: 100,150,200,250 -> iqrRatio = (212.5-137.5)/175 = 75/175 ~= 0.4286
  q.push(ql('2026-04-27T00:00:00.000Z', 'c', 100));
  q.push(ql('2026-04-27T01:00:00.000Z', 'c', 150));
  q.push(ql('2026-04-27T02:00:00.000Z', 'c', 200));
  q.push(ql('2026-04-27T03:00:00.000Z', 'c', 250));

  const desc = buildSourceRowTokenIqrRatio(q, {
    generatedAt: GEN,
    sort: 'iqr-ratio-desc',
  });
  assert.deepEqual(
    desc.sources.map((s) => s.source),
    ['b', 'c', 'a'],
  );

  const asc = buildSourceRowTokenIqrRatio(q, {
    generatedAt: GEN,
    sort: 'iqr-ratio-asc',
  });
  assert.deepEqual(
    asc.sources.map((s) => s.source),
    ['a', 'c', 'b'],
  );

  const bySource = buildSourceRowTokenIqrRatio(q, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    bySource.sources.map((s) => s.source),
    ['a', 'b', 'c'],
  );
});

test('row-iqr: top cap drops trailing rows and counts them', () => {
  const q: QueueLine[] = [];
  // Three sources, each with 4 rows of distinct iqrRatios.
  for (const [src, base, step] of [
    ['a', 100, 100],
    ['b', 100, 50],
    ['c', 100, 200],
  ] as const) {
    for (let i = 0; i < 4; i += 1) {
      q.push(ql(`2026-04-27T0${i}:00:00.000Z`, src, base + i * step));
    }
  }
  const r = buildSourceRowTokenIqrRatio(q, {
    generatedAt: GEN,
    top: 2,
    sort: 'iqr-ratio-desc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('row-iqr: degenerate rows are surfaced by default but excluded by --min-iqr-ratio > 0', () => {
  // Source a is a degenerate sparse-burst (median=0, iqr>0).
  // Source b is a normal source with iqrRatio ~ 0.6.
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 0),
    ql('2026-04-27T01:00:00.000Z', 'a', 0),
    ql('2026-04-27T02:00:00.000Z', 'a', 0),
    ql('2026-04-27T03:00:00.000Z', 'a', 0),
    ql('2026-04-27T04:00:00.000Z', 'a', 1000),
    ql('2026-04-27T05:00:00.000Z', 'a', 5000),

    ql('2026-04-27T00:00:00.000Z', 'b', 100),
    ql('2026-04-27T01:00:00.000Z', 'b', 200),
    ql('2026-04-27T02:00:00.000Z', 'b', 300),
    ql('2026-04-27T03:00:00.000Z', 'b', 400),
  ];
  const noFloor = buildSourceRowTokenIqrRatio(q, { generatedAt: GEN });
  // Both surface; degenerate sorts last under iqr-ratio-desc.
  assert.equal(noFloor.sources.length, 2);
  assert.equal(noFloor.sources[0]!.source, 'b');
  assert.equal(noFloor.sources[1]!.source, 'a');
  assert.equal(noFloor.sources[1]!.degenerate, true);
  assert.equal(noFloor.droppedDegenerate, 0);

  const withFloor = buildSourceRowTokenIqrRatio(q, {
    generatedAt: GEN,
    minIqrRatio: 0.1,
  });
  assert.equal(withFloor.sources.length, 1);
  assert.equal(withFloor.sources[0]!.source, 'b');
  assert.equal(withFloor.droppedDegenerate, 1);
  assert.equal(withFloor.droppedBelowMinIqrRatio, 0);
});

test('row-iqr: determinism — repeated calls return identical numeric output', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 250),
    ql('2026-04-27T02:00:00.000Z', 'a', 333),
    ql('2026-04-27T03:00:00.000Z', 'a', 777),
    ql('2026-04-27T00:00:00.000Z', 'b', 50),
    ql('2026-04-27T01:00:00.000Z', 'b', 60),
    ql('2026-04-27T02:00:00.000Z', 'b', 70),
    ql('2026-04-27T03:00:00.000Z', 'b', 80),
  ];
  const r1 = buildSourceRowTokenIqrRatio(q, { generatedAt: GEN });
  const r2 = buildSourceRowTokenIqrRatio(q, { generatedAt: GEN });
  assert.equal(JSON.stringify(r1), JSON.stringify(r2));
});

test('row-iqr: --min-median rejects negative / NaN / +Infinity', () => {
  assert.throws(() => buildSourceRowTokenIqrRatio([], { minMedian: -1 }));
  assert.throws(() =>
    buildSourceRowTokenIqrRatio([], { minMedian: Number.NaN }),
  );
  assert.throws(() =>
    buildSourceRowTokenIqrRatio([], { minMedian: Number.POSITIVE_INFINITY }),
  );
  // Default is 0 and surfaces in the report.
  const r = buildSourceRowTokenIqrRatio([], { generatedAt: GEN });
  assert.equal(r.minMedian, 0);
  assert.equal(r.droppedBelowMinMedian, 0);
});

test('row-iqr: --min-median drops sources whose median is below the floor', () => {
  // Source a: median ~ 250, big.   Source b: median ~ 65, small.
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 200),
    ql('2026-04-27T02:00:00.000Z', 'a', 300),
    ql('2026-04-27T03:00:00.000Z', 'a', 400),
    ql('2026-04-27T00:00:00.000Z', 'b', 50),
    ql('2026-04-27T01:00:00.000Z', 'b', 60),
    ql('2026-04-27T02:00:00.000Z', 'b', 70),
    ql('2026-04-27T03:00:00.000Z', 'b', 80),
  ];
  const r = buildSourceRowTokenIqrRatio(q, {
    generatedAt: GEN,
    minMedian: 100,
  });
  assert.equal(r.minMedian, 100);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedBelowMinMedian, 1);
});

test('row-iqr: --min-median is orthogonal to --min-iqr-ratio (gates distinct cohorts)', () => {
  // Construct an explicit orthogonality witness:
  //
  //   A: median=250 (big), iqrRatio=0.6 (spread)  -> survives BOTH gates.
  //   B: median=65  (tiny), iqrRatio=0.46 (spread) -> survives min-iqr-ratio,
  //                                                  killed by min-median.
  //   C: median=10000 (big), iqrRatio=0.05 (tight) -> survives min-median,
  //                                                  killed by min-iqr-ratio.
  //
  // For C: x=[9750, 9900, 10100, 10250]  -> q1=9862.5, med=10000,
  //        q3=10137.5, iqr=275, iqrRatio=0.0275.
  const q = [
    // A
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 200),
    ql('2026-04-27T02:00:00.000Z', 'a', 300),
    ql('2026-04-27T03:00:00.000Z', 'a', 400),
    // B
    ql('2026-04-27T00:00:00.000Z', 'b', 50),
    ql('2026-04-27T01:00:00.000Z', 'b', 60),
    ql('2026-04-27T02:00:00.000Z', 'b', 70),
    ql('2026-04-27T03:00:00.000Z', 'b', 80),
    // C
    ql('2026-04-27T00:00:00.000Z', 'c', 9750),
    ql('2026-04-27T01:00:00.000Z', 'c', 9900),
    ql('2026-04-27T02:00:00.000Z', 'c', 10100),
    ql('2026-04-27T03:00:00.000Z', 'c', 10250),
  ];

  // Just min-iqr-ratio at 0.1: drops C (iqrRatio 0.0275); keeps A and B.
  const onlyRatio = buildSourceRowTokenIqrRatio(q, {
    generatedAt: GEN,
    minIqrRatio: 0.1,
  });
  assert.deepEqual(
    onlyRatio.sources.map((s) => s.source).sort(),
    ['a', 'b'],
  );
  assert.equal(onlyRatio.droppedBelowMinIqrRatio, 1);
  assert.equal(onlyRatio.droppedBelowMinMedian, 0);

  // Just min-median at 100: drops B (median 65); keeps A and C.
  const onlyMedian = buildSourceRowTokenIqrRatio(q, {
    generatedAt: GEN,
    minMedian: 100,
  });
  assert.deepEqual(
    onlyMedian.sources.map((s) => s.source).sort(),
    ['a', 'c'],
  );
  assert.equal(onlyMedian.droppedBelowMinMedian, 1);
  assert.equal(onlyMedian.droppedBelowMinIqrRatio, 0);

  // Both gates together: only A survives. The two filters select
  // different cohorts (B vs C dropped), proving orthogonality.
  const both = buildSourceRowTokenIqrRatio(q, {
    generatedAt: GEN,
    minIqrRatio: 0.1,
    minMedian: 100,
  });
  assert.deepEqual(
    both.sources.map((s) => s.source),
    ['a'],
  );
  assert.equal(both.droppedBelowMinMedian, 1);
  assert.equal(both.droppedBelowMinIqrRatio, 1);
});
