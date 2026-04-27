import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenBurstinessCoefficient } from '../src/sourcerowtokenburstinesscoefficient.js';
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

test('row-burst-b: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenBurstinessCoefficient([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 2);
  assert.equal(r.minB, -1);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'b-desc');
  assert.equal(r.generatedAt, GEN);
});

test('row-burst-b: rejects bad minRows / minB / top / sort / since / until', () => {
  assert.throws(() => buildSourceRowTokenBurstinessCoefficient([], { minRows: 1 }));
  assert.throws(() => buildSourceRowTokenBurstinessCoefficient([], { minRows: 2.5 }));
  assert.throws(() => buildSourceRowTokenBurstinessCoefficient([], { minB: -1.1 }));
  assert.throws(() => buildSourceRowTokenBurstinessCoefficient([], { minB: 1.1 }));
  assert.throws(() =>
    buildSourceRowTokenBurstinessCoefficient([], { minB: Number.NaN }),
  );
  assert.throws(() =>
    buildSourceRowTokenBurstinessCoefficient([], {
      minB: Number.POSITIVE_INFINITY,
    }),
  );
  assert.throws(() => buildSourceRowTokenBurstinessCoefficient([], { top: 0 }));
  assert.throws(() => buildSourceRowTokenBurstinessCoefficient([], { top: 1.5 }));
  assert.throws(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildSourceRowTokenBurstinessCoefficient([], { sort: 'bogus' as any }),
  );
  assert.throws(() =>
    buildSourceRowTokenBurstinessCoefficient([], { since: 'nope' }),
  );
  assert.throws(() =>
    buildSourceRowTokenBurstinessCoefficient([], { until: 'nope' }),
  );
});

test('row-burst-b: bad hour_start / bad tokens / negative tokens are dropped', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's', 100),
    ql('2026-04-25T00:00:00Z', 's', Number.NaN),
    ql('2026-04-25T01:00:00Z', 's', Number.POSITIVE_INFINITY),
    ql('2026-04-25T02:00:00Z', 's', -50),
    ql('2026-04-25T03:00:00Z', 's', 100),
    ql('2026-04-25T04:00:00Z', 's', 200),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 2);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.totalRowsKept, 2);
  assert.equal(r.sources.length, 1);
});

test('row-burst-b: source filter restricts to single source', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 100),
    ql('2026-04-25T01:00:00Z', 'a', 200),
    ql('2026-04-25T02:00:00Z', 'b', 300),
    ql('2026-04-25T03:00:00Z', 'b', 400),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.source, 'a');
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('row-burst-b: since/until window applies on hour_start', () => {
  const queue: QueueLine[] = [
    ql('2026-04-24T23:00:00Z', 's', 100),
    ql('2026-04-25T00:00:00Z', 's', 200),
    ql('2026-04-25T01:00:00Z', 's', 300),
    ql('2026-04-26T00:00:00Z', 's', 400),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    since: '2026-04-25T00:00:00Z',
    until: '2026-04-26T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.totalRowsKept, 2);
  assert.equal(r.sources[0]!.rowsKept, 2);
});

test('row-burst-b: minRows drops sources below floor', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'small', 100),
    ql('2026-04-25T01:00:00Z', 'big', 100),
    ql('2026-04-25T02:00:00Z', 'big', 200),
    ql('2026-04-25T03:00:00Z', 'big', 300),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    minRows: 3,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('row-burst-b: constant non-zero series -> b = -1, flat=true, degen=false', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 's', 500),
    ql('2026-04-25T01:00:00Z', 's', 500),
    ql('2026-04-25T02:00:00Z', 's', 500),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.stddev, 0);
  assert.equal(row.mean, 500);
  assert.equal(row.cv, 0);
  assert.equal(row.b, -1);
  assert.equal(row.flat, true);
  assert.equal(row.degenerate, false);
});

test('row-burst-b: all-zero series -> b = null, flat=true, degen=true, cv=null', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 's', 0),
    ql('2026-04-25T01:00:00Z', 's', 0),
    ql('2026-04-25T02:00:00Z', 's', 0),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.stddev, 0);
  assert.equal(row.mean, 0);
  assert.equal(row.cv, null);
  assert.equal(row.b, null);
  assert.equal(row.flat, true);
  assert.equal(row.degenerate, true);
});

test('row-burst-b: closed-form B = (cv-1)/(cv+1) holds — exponential-like baseline near 0', () => {
  // Construct a series with cv == 1: e.g. {0, 200} -> mean=100, popstd=100, cv=1.
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 's', 0),
    ql('2026-04-25T01:00:00Z', 's', 200),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.mean, 100);
  assert.equal(row.stddev, 100);
  assert.equal(row.cv, 1);
  assert.equal(row.b, 0);
  assert.equal(row.flat, false);
  assert.equal(row.degenerate, false);
});

test('row-burst-b: bursty series (one huge row) -> b > 0', () => {
  // {1, 1, 1, 1, 1000}; mean = 200.8; popvar = ((sum sq) - n*mean^2)/n
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 's', 1),
    ql('2026-04-25T01:00:00Z', 's', 1),
    ql('2026-04-25T02:00:00Z', 's', 1),
    ql('2026-04-25T03:00:00Z', 's', 1),
    ql('2026-04-25T04:00:00Z', 's', 1000),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.rowsKept, 5);
  assert.equal(row.mean, 200.8);
  // popvar = mean(x^2) - mean^2 = (4 + 1_000_000)/5 - 200.8^2
  // = 200000.8 - 40320.64 = 159680.16; popstd = sqrt = ~399.6000...
  const expectedStd = Math.sqrt(159680.16);
  assert.ok(Math.abs(row.stddev - expectedStd) < 1e-9);
  const expectedCv = expectedStd / 200.8;
  assert.ok(Math.abs((row.cv ?? -1) - expectedCv) < 1e-9);
  const expectedB = (expectedStd - 200.8) / (expectedStd + 200.8);
  assert.ok(Math.abs((row.b ?? -2) - expectedB) < 1e-12);
  assert.ok(row.b! > 0);
});

test('row-burst-b: anti-bursty near-constant series -> b < 0', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 's', 99),
    ql('2026-04-25T01:00:00Z', 's', 100),
    ql('2026-04-25T02:00:00Z', 's', 101),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  // popstd = sqrt(2/3); cv = sqrt(2/3)/100 ~ 0.00816; b ~ (cv-1)/(cv+1) ~ -0.984
  assert.ok(row.b! < -0.9);
  assert.equal(row.flat, false);
  assert.equal(row.degenerate, false);
});

test('row-burst-b: B is in [-1, 1] for a randomized witness', () => {
  // Spread-out construct: many sources with random-ish fixed token volumes.
  const queue: QueueLine[] = [];
  const sources = ['s1', 's2', 's3', 's4', 's5'];
  // deterministic pseudo-random (xorshift-ish on simple counter)
  let h = 0;
  for (let i = 0; i < 200; i++) {
    h = ((h * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    const src = sources[i % sources.length]!;
    const tt = (h % 5000) + (i % 7 === 0 ? 50000 : 0);
    queue.push(ql(`2026-04-25T${(i % 24).toString().padStart(2, '0')}:00:00Z`, src, tt));
  }
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    generatedAt: GEN,
  });
  for (const row of r.sources) {
    if (row.b === null) continue;
    assert.ok(row.b >= -1 && row.b <= 1, `b out of range: ${row.b}`);
  }
});

test('row-burst-b: --min-b cohort floor drops sources whose b < f', () => {
  // s_flat: constant -> b = -1
  // s_pois: cv=1 -> b = 0
  // s_bursty: huge outlier -> b > 0
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 's_flat', 100),
    ql('2026-04-25T01:00:00Z', 's_flat', 100),
    ql('2026-04-25T00:00:00Z', 's_pois', 0),
    ql('2026-04-25T01:00:00Z', 's_pois', 200),
    ql('2026-04-25T00:00:00Z', 's_bursty', 1),
    ql('2026-04-25T01:00:00Z', 's_bursty', 1),
    ql('2026-04-25T02:00:00Z', 's_bursty', 1000),
  ];
  const r0 = buildSourceRowTokenBurstinessCoefficient(queue, {
    generatedAt: GEN,
  });
  assert.equal(r0.sources.length, 3);

  const rPos = buildSourceRowTokenBurstinessCoefficient(queue, {
    minB: 0,
    generatedAt: GEN,
  });
  assert.equal(rPos.droppedBelowMinB, 1); // s_flat dropped (b=-1)
  // s_pois has b=0 which is NOT < 0; s_bursty has b>0; both survive
  assert.equal(rPos.sources.length, 2);
  for (const row of rPos.sources) {
    assert.ok(row.b! >= 0);
  }
});

test('row-burst-b: --min-b > -1 drops degenerate (all-zero) sources via droppedDegenerate', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'zeros', 0),
    ql('2026-04-25T01:00:00Z', 'zeros', 0),
    ql('2026-04-25T00:00:00Z', 'real', 100),
    ql('2026-04-25T01:00:00Z', 'real', 200),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    minB: -0.5,
    generatedAt: GEN,
  });
  // 'real' has cv = 1/3; b = (1/3 - 1)/(1/3 + 1) = -0.5; not strictly < -0.5 -> survives
  // 'zeros' is degenerate -> dropped under droppedDegenerate
  assert.equal(r.droppedDegenerate, 1);
  assert.equal(r.droppedBelowMinB, 0);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'real');
});

test("row-burst-b: --min-b == -1 (default) keeps every regime including b=-1", () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'flat', 500),
    ql('2026-04-25T01:00:00Z', 'flat', 500),
    ql('2026-04-25T00:00:00Z', 'wave', 100),
    ql('2026-04-25T01:00:00Z', 'wave', 300),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    generatedAt: GEN,
  });
  // default minB = -1 means droppedBelowMinB == 0 even for b=-1 sources
  assert.equal(r.droppedBelowMinB, 0);
  assert.equal(r.droppedDegenerate, 0);
  assert.equal(r.sources.length, 2);
});

test('row-burst-b: sort = b-desc puts most bursty first; degen sorts last', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'flat', 500),
    ql('2026-04-25T01:00:00Z', 'flat', 500),
    ql('2026-04-25T00:00:00Z', 'pois', 0),
    ql('2026-04-25T01:00:00Z', 'pois', 200),
    ql('2026-04-25T00:00:00Z', 'bursty', 1),
    ql('2026-04-25T01:00:00Z', 'bursty', 1),
    ql('2026-04-25T02:00:00Z', 'bursty', 1000),
    ql('2026-04-25T00:00:00Z', 'zero', 0),
    ql('2026-04-25T01:00:00Z', 'zero', 0),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    sort: 'b-desc',
    generatedAt: GEN,
  });
  const order = r.sources.map((s) => s.source);
  // bursty (highest b) > pois (b=0) > flat (b=-1) > zero (b=null sorts last)
  assert.deepEqual(order, ['bursty', 'pois', 'flat', 'zero']);
});

test('row-burst-b: sort = b-asc reverses non-null; degen still last', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'flat', 500),
    ql('2026-04-25T01:00:00Z', 'flat', 500),
    ql('2026-04-25T00:00:00Z', 'pois', 0),
    ql('2026-04-25T01:00:00Z', 'pois', 200),
    ql('2026-04-25T00:00:00Z', 'zero', 0),
    ql('2026-04-25T01:00:00Z', 'zero', 0),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    sort: 'b-asc',
    generatedAt: GEN,
  });
  assert.deepEqual(r.sources.map((s) => s.source), ['flat', 'pois', 'zero']);
});

test('row-burst-b: sort = abs-b-desc surfaces extreme regimes (both -1 and large positive) first', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'flat', 500),
    ql('2026-04-25T01:00:00Z', 'flat', 500),
    ql('2026-04-25T00:00:00Z', 'mid', 90),
    ql('2026-04-25T01:00:00Z', 'mid', 110),
    ql('2026-04-25T00:00:00Z', 'bursty', 1),
    ql('2026-04-25T01:00:00Z', 'bursty', 1),
    ql('2026-04-25T02:00:00Z', 'bursty', 1000),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    sort: 'abs-b-desc',
    generatedAt: GEN,
  });
  // flat: |b| = 1; mid: |b| ~ 0.9 (popstd=10/100=0.1cv -> b ~ -0.818); bursty: |b| ~ ??
  // Compute bursty: mean=200.8 popstd~399.6 -> b ~ (399.6-200.8)/(399.6+200.8) ~ 0.331
  // So |flat|=1 > |mid|~0.818 > |bursty|~0.331
  assert.deepEqual(r.sources.map((s) => s.source), ['flat', 'mid', 'bursty']);
});

test('row-burst-b: sort = mean-desc / rows / source', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 1000),
    ql('2026-04-25T01:00:00Z', 'a', 2000),
    ql('2026-04-25T00:00:00Z', 'b', 50),
    ql('2026-04-25T01:00:00Z', 'b', 50),
    ql('2026-04-25T02:00:00Z', 'b', 50),
    ql('2026-04-25T00:00:00Z', 'c', 100),
    ql('2026-04-25T01:00:00Z', 'c', 200),
  ];
  const rMean = buildSourceRowTokenBurstinessCoefficient(queue, {
    sort: 'mean-desc',
    generatedAt: GEN,
  });
  assert.deepEqual(rMean.sources.map((s) => s.source), ['a', 'c', 'b']);

  const rRows = buildSourceRowTokenBurstinessCoefficient(queue, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(rRows.sources[0]!.source, 'b');

  const rSrc = buildSourceRowTokenBurstinessCoefficient(queue, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(rSrc.sources.map((s) => s.source), ['a', 'b', 'c']);
});

test('row-burst-b: top cap surfaces excess as droppedBelowTopCap', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'a', 100),
    ql('2026-04-25T01:00:00Z', 'a', 200),
    ql('2026-04-25T00:00:00Z', 'b', 50),
    ql('2026-04-25T01:00:00Z', 'b', 60),
    ql('2026-04-25T00:00:00Z', 'c', 1000),
    ql('2026-04-25T01:00:00Z', 'c', 1010),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('row-burst-b: minRows = 2 (default) admits 2-row sources but minRows = 3 drops them', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'tiny', 100),
    ql('2026-04-25T01:00:00Z', 'tiny', 200),
  ];
  const r2 = buildSourceRowTokenBurstinessCoefficient(queue, {
    generatedAt: GEN,
  });
  assert.equal(r2.sources.length, 1);
  const r3 = buildSourceRowTokenBurstinessCoefficient(queue, {
    minRows: 3,
    generatedAt: GEN,
  });
  assert.equal(r3.sources.length, 0);
  assert.equal(r3.droppedBelowMinRows, 1);
});

test('row-burst-b: rejects bad minMean', () => {
  assert.throws(() =>
    buildSourceRowTokenBurstinessCoefficient([], { minMean: -1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenBurstinessCoefficient([], { minMean: Number.NaN }),
  );
  assert.throws(() =>
    buildSourceRowTokenBurstinessCoefficient([], {
      minMean: Number.POSITIVE_INFINITY,
    }),
  );
});

test('row-burst-b: --min-mean default 0 keeps every source (no behaviour change vs v0.6.99)', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'tiny', 1),
    ql('2026-04-25T01:00:00Z', 'tiny', 2),
    ql('2026-04-25T00:00:00Z', 'huge', 1000000),
    ql('2026-04-25T01:00:00Z', 'huge', 2000000),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.minMean, 0);
  assert.equal(r.droppedBelowMinMean, 0);
  assert.equal(r.sources.length, 2);
});

test('row-burst-b: --min-mean drops sources whose mean < f', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'tiny', 100),
    ql('2026-04-25T01:00:00Z', 'tiny', 200),
    ql('2026-04-25T00:00:00Z', 'huge', 1000000),
    ql('2026-04-25T01:00:00Z', 'huge', 2000000),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    minMean: 1000,
    generatedAt: GEN,
  });
  // tiny.mean = 150 < 1000 -> dropped; huge.mean = 1.5M -> survives
  assert.equal(r.droppedBelowMinMean, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'huge');
});

test('row-burst-b: --min-mean is orthogonal to --min-b (gates distinct cohorts)', () => {
  // Three sources constructed as an explicit orthogonality witness:
  //   A: tiny mean (50) but high B (heavy-tailed regime)
  //      survives --min-b 0.3 alone, killed by --min-mean 1000
  //   B: huge mean (1.5M) but low B (mildly super-Poisson)
  //      survives --min-mean 1000 alone, killed by --min-b 0.3
  //   C: huge mean and high B (both)
  //      survives both filters
  const queue: QueueLine[] = [];
  // A: {1, 1, 1, 1, 246} -> mean = 50, popstd = sqrt((4 + 60516)/5 - 2500)
  //    = sqrt(12104 - 2500) = sqrt(9604) = 98; cv = 1.96; B = 0.96/2.96 = 0.3243
  for (let i = 0; i < 4; i++)
    queue.push(ql(`2026-04-25T${i.toString().padStart(2, '0')}:00:00Z`, 'A', 1));
  queue.push(ql('2026-04-25T04:00:00Z', 'A', 246));
  // B: {1000000, 2000000} -> mean = 1.5M, popstd = 500K; cv = 1/3; B = -0.5
  queue.push(ql('2026-04-25T00:00:00Z', 'B', 1000000));
  queue.push(ql('2026-04-25T01:00:00Z', 'B', 2000000));
  // C: {0,0,0,0,0,0,0,0,0, 50_000_000} -> n=10, mean=5M;
  //    var = 2.25e14, std = 1.5e7, cv = 3, B = 0.5
  for (let i = 0; i < 9; i++)
    queue.push(
      ql(
        `2026-04-25T${i.toString().padStart(2, '0')}:00:00Z`,
        'C',
        0,
      ),
    );
  queue.push(ql('2026-04-25T09:00:00Z', 'C', 50000000));

  // Sanity: no-filter run shows all three
  const r0 = buildSourceRowTokenBurstinessCoefficient(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r0.sources.length, 3);
  const aRow = r0.sources.find((s) => s.source === 'A')!;
  const bRow = r0.sources.find((s) => s.source === 'B')!;
  const cRow = r0.sources.find((s) => s.source === 'C')!;
  // Witness invariants
  assert.equal(aRow.mean, 50);
  assert.ok(aRow.b! > 0.3 && aRow.b! < 0.4);
  assert.equal(bRow.mean, 1500000);
  assert.ok(Math.abs(bRow.b! - -0.5) < 1e-12);
  assert.ok(cRow.mean > 1000);
  assert.ok(cRow.b! > 0.3, `cRow.b expected > 0.3, got ${cRow.b}`);

  // --min-b 0.3 alone: drops B (b=-0.5), keeps A and C
  const rB = buildSourceRowTokenBurstinessCoefficient(queue, {
    minB: 0.3,
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(rB.sources.map((s) => s.source), ['A', 'C']);
  assert.equal(rB.droppedBelowMinB, 1);
  assert.equal(rB.droppedBelowMinMean, 0);

  // --min-mean 1000 alone: drops A (mean=50), keeps B and C
  const rM = buildSourceRowTokenBurstinessCoefficient(queue, {
    minMean: 1000,
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(rM.sources.map((s) => s.source), ['B', 'C']);
  assert.equal(rM.droppedBelowMinMean, 1);
  assert.equal(rM.droppedBelowMinB, 0);

  // BOTH: only C survives — proves the two filters select distinct cohorts
  // and cannot be substituted for one another.
  const rBoth = buildSourceRowTokenBurstinessCoefficient(queue, {
    minB: 0.3,
    minMean: 1000,
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(rBoth.sources.map((s) => s.source), ['C']);
  assert.equal(rBoth.droppedBelowMinMean, 1); // A
  assert.equal(rBoth.droppedBelowMinB, 1); // B
});

test('row-burst-b: --min-mean applied before --min-b (low-mean degenerates counted under droppedBelowMinMean)', () => {
  // A degenerate (all-zero) source has mean = 0; with --min-mean > 0 it should
  // be dropped under droppedBelowMinMean *before* the --min-b degenerate
  // check is reached. This pins the documented filter order.
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'zero', 0),
    ql('2026-04-25T01:00:00Z', 'zero', 0),
    ql('2026-04-25T00:00:00Z', 'real', 100),
    ql('2026-04-25T01:00:00Z', 'real', 200),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    minB: -0.5,
    minMean: 50,
    generatedAt: GEN,
  });
  // 'zero' has mean = 0 < 50 -> dropped under droppedBelowMinMean.
  // It is NOT counted under droppedDegenerate because the min-mean
  // filter ran first.
  assert.equal(r.droppedBelowMinMean, 1);
  assert.equal(r.droppedDegenerate, 0);
  // 'real' has mean = 150 (survives min-mean), B = -0.5 (NOT strictly < -0.5,
  // survives min-b).
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'real');
});

test('row-burst-b: --min-mean = 0 (default) does NOT count any droppedBelowMinMean even for mean=0 degen sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 'zero', 0),
    ql('2026-04-25T01:00:00Z', 'zero', 0),
    ql('2026-04-25T00:00:00Z', 'real', 100),
    ql('2026-04-25T01:00:00Z', 'real', 200),
  ];
  const r = buildSourceRowTokenBurstinessCoefficient(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinMean, 0);
  // both survive; default minB = -1 keeps degenerate too
  assert.equal(r.sources.length, 2);
});
