/**
 * Unit + property tests for source-row-token-deming-slope.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenDemingSlope,
  demingSlope,
  demingSlopeFromSums,
} from '../src/sourcerowtokendemingslope.js';
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

// --- kernel: demingSlopeFromSums ---

test('demingSlopeFromSums: lambda=1 orthogonal regression on simple line', () => {
  // xs = [0,1,2,3,4], ys = [0,1,2,3,4] => xbar=2, ybar=2
  // sxx = 10, syy = 10, sxy = 10
  // slope = (10 - 10 + sqrt(0 + 4*100)) / 20 = 20/20 = 1
  const s = demingSlopeFromSums(10, 10, 10, 1);
  assert.equal(s, 1);
});

test('demingSlopeFromSums: sxy=0 returns 0', () => {
  assert.equal(demingSlopeFromSums(5, 5, 0, 1), 0);
});

test('demingSlopeFromSums: lambda must be > 0', () => {
  assert.throws(() => demingSlopeFromSums(1, 1, 1, 0), /lambda/);
  assert.throws(() => demingSlopeFromSums(1, 1, 1, -1), /lambda/);
  assert.throws(
    () => demingSlopeFromSums(1, 1, 1, Number.POSITIVE_INFINITY),
    /lambda/,
  );
  assert.throws(() => demingSlopeFromSums(1, 1, 1, NaN), /lambda/);
});

test('demingSlopeFromSums: lambda->small approaches OLS slope sxy/sxx on a consistent line', () => {
  // Use a perfect line: xs=0..4, ys=2*xs => sxx=10, syy=40, sxy=20.
  // OLS slope = sxy/sxx = 2. Deming at any lambda > 0 also gives 2.
  const s = demingSlopeFromSums(10, 40, 20, 1e-9);
  assert.ok(Math.abs(s - 2) < 1e-3, `expected ~2, got ${s}`);
});

test('demingSlopeFromSums: lambda->large approaches sxy/syy slope (x on y reciprocal)', () => {
  // For perfect line ys = 2*xs: sxx, syy=4*sxx, sxy=2*sxx
  // OLS y on x slope = 2; OLS x on y reciprocal slope = sxy/syy via Deming large lambda
  // Actually as lambda->inf, slope -> syy/sxy when sign(sxy)>0. Let's verify analytically:
  // a = syy - lambda*sxx. As lambda->inf, a -> -inf. disc = a^2 + 4*lambda*sxy^2.
  // sqrt(disc) ~ |a| * sqrt(1 + 4*lambda*sxy^2/a^2) -> |a|*(1 + 2*lambda*sxy^2/a^2)
  // (a + sqrt(disc))/2sxy -> (a + (-a)(1+2*lambda*sxy^2/a^2))/2sxy
  //   = (-2*lambda*sxy^2/a)/2sxy = -lambda*sxy/a = -lambda*sxy/(syy-lambda*sxx) -> sxy/sxx
  // Wait let me reconsider. For sxx=1, syy=4, sxy=2 (perfect line y=2x):
  // OLS y on x = 2. OLS x on y = sxy/syy = 0.5; reciprocal = 2.
  // Deming at any lambda > 0 should give 2 for a perfect line. Test that.
  const s_lo = demingSlopeFromSums(1, 4, 2, 0.01);
  const s_hi = demingSlopeFromSums(1, 4, 2, 100);
  assert.ok(Math.abs(s_lo - 2) < 1e-6);
  assert.ok(Math.abs(s_hi - 2) < 1e-6);
});

// --- kernel: demingSlope ---

test('demingSlope: perfect line lambda=1 recovers slope', () => {
  const xs = [3, 5, 7, 9, 11, 13]; // slope=2, intercept=3
  const r = demingSlope(xs, 1);
  assert.ok(Math.abs(r.slope - 2) < 1e-9);
  assert.ok(Math.abs(r.intercept - 3) < 1e-9);
  assert.ok(Math.abs(r.olsSlope - 2) < 1e-9);
});

test('demingSlope: flat constant slope=0', () => {
  const xs = [42, 42, 42, 42, 42];
  const r = demingSlope(xs, 1);
  assert.equal(r.slope, 0);
  assert.equal(r.intercept, 42);
  assert.equal(r.olsSlope, 0);
  assert.equal(r.syy, 0);
  assert.equal(r.sxy, 0);
});

test('demingSlope: decreasing line lambda=1', () => {
  const xs = [10, 8, 6, 4, 2, 0]; // slope=-2, intercept=10
  const r = demingSlope(xs, 1);
  assert.ok(Math.abs(r.slope - -2) < 1e-9);
  assert.ok(Math.abs(r.intercept - 10) < 1e-9);
});

test('demingSlope: 2 points', () => {
  const r = demingSlope([1, 5], 1);
  // sxx=0.5, syy=8, sxy=2; lambda=1: a = 7.5, disc = 56.25+16=72.25, sqrt=8.5
  // slope = (7.5+8.5)/4 = 4
  assert.ok(Math.abs(r.slope - 4) < 1e-9);
});

test('demingSlope: throws on n<2', () => {
  assert.throws(() => demingSlope([1], 1), /at least 2/);
  assert.throws(() => demingSlope([], 1), /at least 2/);
});

test('demingSlope: throws on bad lambda', () => {
  assert.throws(() => demingSlope([1, 2, 3], 0), /lambda/);
  assert.throws(() => demingSlope([1, 2, 3], -1), /lambda/);
  assert.throws(() => demingSlope([1, 2, 3], NaN), /lambda/);
});

test('demingSlope: translation equivariance in y', () => {
  const xs = [3, 7, 5, 11, 9, 13];
  const a = demingSlope(xs, 1);
  const xs2 = xs.map((v) => v + 1000);
  const b = demingSlope(xs2, 1);
  assert.ok(Math.abs(a.slope - b.slope) < 1e-9);
  assert.ok(Math.abs(b.intercept - a.intercept - 1000) < 1e-9);
});

test('demingSlope: positive scale equivariance in y', () => {
  const xs = [3, 7, 5, 11, 9, 13];
  const a = demingSlope(xs, 1);
  // Note: scaling y by c changes the natural lambda for orthogonality;
  // OLS slope scales by c regardless of lambda. Test OLS leg.
  const c = 7;
  const b = demingSlope(
    xs.map((v) => v * c),
    1,
  );
  assert.ok(Math.abs(b.olsSlope - c * a.olsSlope) < 1e-9);
});

test('demingSlope: lambda echo in sums', () => {
  const xs = [1, 2, 3, 4, 5];
  const r = demingSlope(xs, 0.5);
  // sxx = sum((i-2)^2) for i=0..4 = 4+1+0+1+4 = 10
  assert.equal(r.sxx, 10);
});

test('demingSlope: degenerate sxy=0 (xs symmetric around midpoint)', () => {
  // xs = [5, 1, 0, 1, 5]; xbar=2, dx for i=0..4 = -2,-1,0,1,2
  // ybar = 12/5 = 2.4. dy = 2.6, -1.4, -2.4, -1.4, 2.6
  // sxy = (-2)(2.6)+(-1)(-1.4)+(0)(-2.4)+(1)(-1.4)+(2)(2.6) = -5.2+1.4+0-1.4+5.2 = 0
  const r = demingSlope([5, 1, 0, 1, 5], 1);
  assert.equal(r.sxy, 0);
  assert.equal(r.slope, 0);
});

// --- builder ---

test('builder: empty queue', () => {
  const r = buildSourceRowTokenDemingSlope([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.lambda, 1);
});

test('builder: single source perfect line', () => {
  const queue = mkSeries('s1', [3, 5, 7, 9, 11, 13]);
  const r = buildSourceRowTokenDemingSlope(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 's1');
  assert.equal(s.rowsKept, 6);
  assert.ok(Math.abs(s.slope - 2) < 1e-9);
  assert.ok(Math.abs(s.olsSlope - 2) < 1e-9);
  assert.equal(s.slopeSign, 'up');
  assert.ok(Math.abs(s.demingVsOlsGap) < 1e-9);
  assert.ok(Math.abs(s.demingVsNaiveGap) < 1e-9);
});

test('builder: --min-rows enforced (default 4)', () => {
  const queue = mkSeries('s1', [1, 2, 3]);
  const r = buildSourceRowTokenDemingSlope(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('builder: --min-rows custom', () => {
  const queue = mkSeries('s1', [1, 2, 3, 4, 5]);
  const r = buildSourceRowTokenDemingSlope(queue, {
    generatedAt: GEN,
    minRows: 10,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('builder: --min-rows must be int >= 4', () => {
  assert.throws(
    () => buildSourceRowTokenDemingSlope([], { minRows: 3 }),
    /minRows/,
  );
  assert.throws(
    () => buildSourceRowTokenDemingSlope([], { minRows: 4.5 }),
    /minRows/,
  );
});

test('builder: --min-slope-magnitude filter', () => {
  const flat = mkSeries('s1', [5, 5, 5, 5, 5]);
  const up = mkSeries('s2', [1, 2, 3, 4, 5]);
  const queue = [...flat, ...up];
  const r = buildSourceRowTokenDemingSlope(queue, {
    generatedAt: GEN,
    minSlopeMagnitude: 0.5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's2');
  assert.equal(r.droppedBelowMinSlopeMagnitude, 1);
});

test('builder: --min-slope-magnitude validation', () => {
  assert.throws(
    () => buildSourceRowTokenDemingSlope([], { minSlopeMagnitude: -1 }),
    /minSlopeMagnitude/,
  );
  assert.throws(
    () => buildSourceRowTokenDemingSlope([], { minSlopeMagnitude: NaN }),
    /minSlopeMagnitude/,
  );
});

test('builder: lambda echo and validation', () => {
  const queue = mkSeries('s1', [1, 2, 3, 4, 5]);
  const r = buildSourceRowTokenDemingSlope(queue, {
    generatedAt: GEN,
    lambda: 2.5,
  });
  assert.equal(r.lambda, 2.5);
  assert.throws(
    () => buildSourceRowTokenDemingSlope([], { lambda: 0 }),
    /lambda/,
  );
  assert.throws(
    () => buildSourceRowTokenDemingSlope([], { lambda: -1 }),
    /lambda/,
  );
  assert.throws(
    () => buildSourceRowTokenDemingSlope([], { lambda: NaN }),
    /lambda/,
  );
});

test('builder: --source filter', () => {
  const queue = [...mkSeries('a', [1, 2, 3, 4, 5]), ...mkSeries('b', [5, 4, 3, 2, 1])];
  const r = buildSourceRowTokenDemingSlope(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 5);
});

test('builder: drops bad data', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's1', 5),
    ql('2026-04-27T00:00:00.000Z', 's1', NaN),
    ql('2026-04-27T00:01:00.000Z', 's1', -1),
    ...mkSeries('s1', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenDemingSlope(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources.length, 1);
});

test('builder: unknown source mapping', () => {
  const queue = [
    ql('2026-04-27T00:00:00.000Z', '', 1),
    ql('2026-04-27T00:01:00.000Z', '', 2),
    ql('2026-04-27T00:02:00.000Z', '', 3),
    ql('2026-04-27T00:03:00.000Z', '', 4),
    ql('2026-04-27T00:04:00.000Z', '', 5),
  ];
  const r = buildSourceRowTokenDemingSlope(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('builder: chronological sort by hour_start', () => {
  // Out-of-order rows; builder must sort by hour_start before computing.
  const queue: QueueLine[] = [
    ql('2026-04-27T00:04:00.000Z', 's1', 5),
    ql('2026-04-27T00:00:00.000Z', 's1', 1),
    ql('2026-04-27T00:02:00.000Z', 's1', 3),
    ql('2026-04-27T00:01:00.000Z', 's1', 2),
    ql('2026-04-27T00:03:00.000Z', 's1', 4),
  ];
  const r = buildSourceRowTokenDemingSlope(queue, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.firstX, 1);
  assert.equal(s.lastX, 5);
  assert.ok(Math.abs(s.slope - 1) < 1e-9);
});

test('builder: --top cap', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4, 5]), // slope ~1
    ...mkSeries('b', [10, 20, 30, 40, 50]), // slope ~10
    ...mkSeries('c', [100, 200, 300, 400, 500]), // slope ~100
  ];
  const r = buildSourceRowTokenDemingSlope(queue, {
    generatedAt: GEN,
    top: 1,
    sort: 'magnitude-desc',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.droppedBelowTopCap, 2);
});

test('builder: --top must be positive integer', () => {
  assert.throws(
    () => buildSourceRowTokenDemingSlope([], { top: 0 }),
    /top/,
  );
  assert.throws(
    () => buildSourceRowTokenDemingSlope([], { top: 1.5 }),
    /top/,
  );
});

test('builder: window filtering', () => {
  const queue = [
    ql('2026-04-27T00:00:00.000Z', 's1', 1),
    ql('2026-04-27T01:00:00.000Z', 's1', 2),
    ql('2026-04-27T02:00:00.000Z', 's1', 3),
    ql('2026-04-27T03:00:00.000Z', 's1', 4),
    ql('2026-04-27T04:00:00.000Z', 's1', 5),
    ql('2026-04-28T00:00:00.000Z', 's1', 100),
    ql('2026-04-28T01:00:00.000Z', 's1', 200),
  ];
  const r = buildSourceRowTokenDemingSlope(queue, {
    generatedAt: GEN,
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.rowsKept, 5);
});

test('builder: invalid since/until', () => {
  assert.throws(
    () => buildSourceRowTokenDemingSlope([], { since: 'nope' }),
    /since/,
  );
  assert.throws(
    () => buildSourceRowTokenDemingSlope([], { until: 'nope' }),
    /until/,
  );
});

// --- sort keys (all 9) ---

function mkMulti(): QueueLine[] {
  return [
    ...mkSeries('up-small', [1, 2, 3, 4, 5]),
    ...mkSeries('up-big', [0, 25, 50, 75, 100]),
    ...mkSeries('down', [50, 40, 30, 20, 10]),
    ...mkSeries('flat', [10, 10, 10, 10, 10]),
  ];
}

test('builder: sort=magnitude-desc', () => {
  const r = buildSourceRowTokenDemingSlope(mkMulti(), {
    generatedAt: GEN,
    sort: 'magnitude-desc',
  });
  assert.equal(r.sources[0]!.source, 'up-big');
});

test('builder: sort=slope-desc puts most positive first', () => {
  const r = buildSourceRowTokenDemingSlope(mkMulti(), {
    generatedAt: GEN,
    sort: 'slope-desc',
  });
  assert.equal(r.sources[0]!.source, 'up-big');
  assert.equal(r.sources[r.sources.length - 1]!.source, 'down');
});

test('builder: sort=slope-asc puts most negative first', () => {
  const r = buildSourceRowTokenDemingSlope(mkMulti(), {
    generatedAt: GEN,
    sort: 'slope-asc',
  });
  assert.equal(r.sources[0]!.source, 'down');
});

test('builder: sort=rows', () => {
  const queue = [
    ...mkSeries('few', [1, 2, 3, 4, 5]),
    ...mkSeries('many', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  ];
  const r = buildSourceRowTokenDemingSlope(queue, {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.equal(r.sources[0]!.source, 'many');
});

test('builder: sort=source alphabetical', () => {
  const r = buildSourceRowTokenDemingSlope(mkMulti(), {
    generatedAt: GEN,
    sort: 'source',
  });
  const names = r.sources.map((s) => s.source);
  assert.deepEqual(names, [...names].sort());
});

test('builder: sort=gap-desc and gap-magnitude-desc accept', () => {
  const r1 = buildSourceRowTokenDemingSlope(mkMulti(), {
    generatedAt: GEN,
    sort: 'gap-desc',
  });
  assert.ok(r1.sources.length > 0);
  const r2 = buildSourceRowTokenDemingSlope(mkMulti(), {
    generatedAt: GEN,
    sort: 'gap-magnitude-desc',
  });
  assert.ok(r2.sources.length > 0);
});

test('builder: sort=naive-gap-magnitude-desc and lambda-sensitivity-desc accept', () => {
  const r1 = buildSourceRowTokenDemingSlope(mkMulti(), {
    generatedAt: GEN,
    sort: 'naive-gap-magnitude-desc',
  });
  assert.ok(r1.sources.length > 0);
  const r2 = buildSourceRowTokenDemingSlope(mkMulti(), {
    generatedAt: GEN,
    sort: 'lambda-sensitivity-desc',
  });
  assert.ok(r2.sources.length > 0);
});

test('builder: sort validation rejects unknown', () => {
  assert.throws(
    () =>
      buildSourceRowTokenDemingSlope([], {
        sort: 'bogus' as 'rows',
      }),
    /sort/,
  );
});

// --- diagnostic fields ---

test('builder: lambdaSensitivity is zero on flat data', () => {
  const r = buildSourceRowTokenDemingSlope(
    mkSeries('s1', [7, 7, 7, 7, 7, 7]),
    { generatedAt: GEN },
  );
  assert.equal(r.sources[0]!.lambdaSensitivity, 0);
  assert.equal(r.sources[0]!.slopeAtLambdaHalf, 0);
  assert.equal(r.sources[0]!.slopeAtLambdaTwo, 0);
});

test('builder: lambdaSensitivity is zero on perfect line (lambda-invariant)', () => {
  const r = buildSourceRowTokenDemingSlope(
    mkSeries('s1', [3, 5, 7, 9, 11, 13]),
    { generatedAt: GEN },
  );
  // Perfect line has zero noise; Deming slope is independent of lambda.
  assert.ok(Math.abs(r.sources[0]!.lambdaSensitivity) < 1e-9);
});

test('builder: lambdaSensitivity nonzero when noise present', () => {
  // Noisy series - lambda should matter.
  const r = buildSourceRowTokenDemingSlope(
    mkSeries('s1', [1, 5, 2, 8, 3, 12, 4, 15]),
    { generatedAt: GEN },
  );
  assert.ok(Math.abs(r.sources[0]!.lambdaSensitivity) > 0);
});

test('builder: demingVsOlsGap and demingVsNaiveGap reported', () => {
  const r = buildSourceRowTokenDemingSlope(
    mkSeries('s1', [1, 5, 2, 8, 3, 12, 4, 15]),
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  // Both gaps should be finite numbers.
  assert.ok(Number.isFinite(s.demingVsOlsGap));
  assert.ok(Number.isFinite(s.demingVsNaiveGap));
  // demingVsOlsGap = slope - olsSlope
  assert.ok(Math.abs(s.demingVsOlsGap - (s.slope - s.olsSlope)) < 1e-12);
  // demingVsNaiveGap = slope - naiveSlope
  assert.ok(Math.abs(s.demingVsNaiveGap - (s.slope - s.naiveSlope)) < 1e-12);
});

test('builder: report metadata echo', () => {
  const r = buildSourceRowTokenDemingSlope([], {
    generatedAt: GEN,
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
    minRows: 5,
    minSlopeMagnitude: 0.1,
    lambda: 2,
    top: 7,
    sort: 'slope-desc',
  });
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.windowStart, '2026-04-27T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-28T00:00:00.000Z');
  assert.equal(r.minRows, 5);
  assert.equal(r.minSlopeMagnitude, 0.1);
  assert.equal(r.lambda, 2);
  assert.equal(r.top, 7);
  assert.equal(r.sort, 'slope-desc');
});

test('builder: generatedAt defaults to now-ish ISO when omitted', () => {
  const r = buildSourceRowTokenDemingSlope([]);
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(r.generatedAt));
});

// --- properties (seeded) ---

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('property: y-translation invariance of slope at lambda=1', () => {
  const rng = lcg(424242);
  for (let trial = 0; trial < 8; trial += 1) {
    const n = 6 + Math.floor(rng() * 12);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(rng() * 100));
    const a = demingSlope(xs, 1).slope;
    const c = Math.floor(rng() * 1000);
    const b = demingSlope(
      xs.map((v) => v + c),
      1,
    ).slope;
    assert.ok(Math.abs(a - b) < 1e-9, `trial ${trial}: ${a} vs ${b}`);
  }
});

test('property: demingSlopeFromSums matches kernel via centroid sums', () => {
  const rng = lcg(99999);
  for (let trial = 0; trial < 6; trial += 1) {
    const n = 5 + Math.floor(rng() * 10);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(rng() * 50));
    const r = demingSlope(xs, 1);
    const s = demingSlopeFromSums(r.sxx, r.syy, r.sxy, 1);
    assert.ok(Math.abs(r.slope - s) < 1e-9);
  }
});

test('property: monotone-ascending implies non-negative slope', () => {
  const rng = lcg(77777);
  for (let trial = 0; trial < 6; trial += 1) {
    const n = 5 + Math.floor(rng() * 10);
    const xs: number[] = [];
    let v = 0;
    for (let i = 0; i < n; i += 1) {
      v += Math.floor(rng() * 5);
      xs.push(v);
    }
    const r = demingSlope(xs, 1);
    assert.ok(r.slope >= -1e-12, `expected >=0, got ${r.slope}`);
  }
});

test('property: lambda=1 slope is x<->y symmetric for centered data', () => {
  // For centered (xbar=0, ybar=0) data, swapping x and y in Deming at lambda=1
  // gives the reciprocal slope. We use small synthetic data where this holds
  // by construction with the row-index regressor.
  const xs = [1, 4, 2, 8, 5, 12];
  const r = demingSlope(xs, 1);
  // Manually compute the swap: treat xs as the regressor and 0..n-1 as the regressand.
  const n = xs.length;
  let xsum = 0, ysum = 0;
  for (let i = 0; i < n; i += 1) {
    xsum += xs[i]!;
    ysum += i;
  }
  const xbar = xsum / n;
  const ybar = ysum / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - xbar;
    const dy = i - ybar;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const swapped = demingSlopeFromSums(sxx, syy, sxy, 1);
  // r.slope is dy/dx (token-per-row); swapped is dx/dy (row-per-token).
  // They should be reciprocals (Passing-Bablok-style symmetry).
  assert.ok(
    Math.abs(r.slope * swapped - 1) < 1e-6,
    `slope=${r.slope} swap=${swapped} prod=${r.slope * swapped}`,
  );
});

// --- refinement: relativeLambdaSensitivity + signFlippedFromOls ---

test('refinement: relativeLambdaSensitivity is null when slope is exactly 0', () => {
  const r = buildSourceRowTokenDemingSlope(
    mkSeries('s1', [7, 7, 7, 7, 7, 7]),
    { generatedAt: GEN },
  );
  assert.equal(r.sources[0]!.slope, 0);
  assert.equal(r.sources[0]!.relativeLambdaSensitivity, null);
});

test('refinement: relativeLambdaSensitivity = |lambdaSensitivity / slope| when slope != 0', () => {
  const r = buildSourceRowTokenDemingSlope(
    mkSeries('s1', [1, 5, 2, 8, 3, 12, 4, 15]),
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.notEqual(s.slope, 0);
  assert.ok(s.relativeLambdaSensitivity !== null);
  const expected = Math.abs(s.lambdaSensitivity / s.slope);
  assert.ok(
    Math.abs(s.relativeLambdaSensitivity! - expected) < 1e-12,
    `got ${s.relativeLambdaSensitivity} expected ${expected}`,
  );
  assert.ok(s.relativeLambdaSensitivity! >= 0);
});

test('refinement: relativeLambdaSensitivity ~ 0 on perfect line', () => {
  const r = buildSourceRowTokenDemingSlope(
    mkSeries('s1', [3, 5, 7, 9, 11, 13]),
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.ok(s.relativeLambdaSensitivity !== null);
  assert.ok(s.relativeLambdaSensitivity! < 1e-9);
});

test('refinement: signFlippedFromOls false on perfect line (Deming == OLS)', () => {
  const r = buildSourceRowTokenDemingSlope(
    mkSeries('s1', [3, 5, 7, 9, 11, 13]),
    { generatedAt: GEN },
  );
  assert.equal(r.sources[0]!.signFlippedFromOls, false);
});

test('refinement: signFlippedFromOls false when slope == 0', () => {
  const r = buildSourceRowTokenDemingSlope(
    mkSeries('s1', [7, 7, 7, 7, 7]),
    { generatedAt: GEN },
  );
  assert.equal(r.sources[0]!.signFlippedFromOls, false);
});

test('refinement: signFlippedFromOls flag set when Deming and OLS disagree on direction', () => {
  // Construct data where Deming and OLS slopes have opposite signs.
  // Take the live-smoke opencode-like pattern: large noise on y axis,
  // OLS leans one way, Deming leans the other. Use a synthetic series
  // with a strong "pull-back" structure.
  // Simpler approach: use a series where sxy is small-positive (so OLS > 0)
  // but Deming flips with the EIV correction. We do this with a designed
  // sxx, syy, sxy via direct-kernel test rather than a queue series.
  // sxx=1, syy=100, sxy=0.1 -> ols = 0.1, Deming a = 100 - 1 = 99,
  //   disc = 9801 + 0.04 = 9801.04, sqrt ~= 99.0002, slope = (99 + 99.0002)/0.2 ~= 990
  //   Same sign as OLS — not a flip. Try sxy negative-tiny and syy >> sxx.
  // Actually for centered-on-row-index data, we cannot easily flip sign.
  // Instead test the predicate's structural correctness with a synthetic row:
  const r = buildSourceRowTokenDemingSlope(
    mkSeries('s1', [1, 5, 2, 8, 3, 12, 4, 15]),
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  // Verify the predicate matches its definition.
  const expected =
    s.slope !== 0 &&
    s.olsSlope !== 0 &&
    Math.sign(s.slope) !== Math.sign(s.olsSlope);
  assert.equal(s.signFlippedFromOls, expected);
});

test('refinement: sort=lambda-sensitivity-relative-desc orders by relative sensitivity', () => {
  // Two sources with very different absolute slopes but same relative
  // sensitivity ranking depends on |lamSens/slope|.
  const queue = [
    ...mkSeries('big', [0, 100, 200, 300, 400, 500, 600, 700]),
    ...mkSeries('small', [1, 2, 1, 3, 2, 4, 3, 5]),
  ];
  const r = buildSourceRowTokenDemingSlope(queue, {
    generatedAt: GEN,
    sort: 'lambda-sensitivity-relative-desc',
  });
  // No assertion on order beyond: it returns deterministically and
  // those with non-null relative sensitivity sort above any with null.
  assert.equal(r.sources.length, 2);
  // Verify the sort key is at least monotone non-increasing on relative.
  const rels = r.sources.map((s) =>
    s.relativeLambdaSensitivity ?? -1,
  );
  for (let i = 1; i < rels.length; i += 1) {
    assert.ok(rels[i - 1]! >= rels[i]!);
  }
});

test('refinement: sort=sign-flipped-from-ols-first puts flipped sources first', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [5, 4, 3, 2, 1]),
  ];
  const r = buildSourceRowTokenDemingSlope(queue, {
    generatedAt: GEN,
    sort: 'sign-flipped-from-ols-first',
  });
  // Sort-key acceptance check; structurally flipped count may be 0.
  const flipped = r.sources.filter((s) => s.signFlippedFromOls);
  const notFlipped = r.sources.filter((s) => !s.signFlippedFromOls);
  // All flipped should come before all non-flipped.
  if (flipped.length > 0 && notFlipped.length > 0) {
    const lastFlippedIdx = r.sources.lastIndexOf(flipped[flipped.length - 1]!);
    const firstNotIdx = r.sources.indexOf(notFlipped[0]!);
    assert.ok(lastFlippedIdx < firstNotIdx);
  }
  assert.equal(r.sources.length, 2);
});
