import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenLSkewness,
  lSkewnessOfVector,
} from '../src/dailytokenlskewness.js';
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

const GEN = '2026-05-01T12:00:00.000Z';

// ---- lSkewnessOfVector primitive --------------------------------------

test('lSkewnessOfVector: rejects non-finite values', () => {
  assert.throws(() => lSkewnessOfVector([1, NaN, 3, 4]));
  assert.throws(() => lSkewnessOfVector([1, Infinity, 3, 4]));
});

test('lSkewnessOfVector: n<4 -> degenerate', () => {
  for (const v of [[], [1], [1, 2], [1, 2, 3]]) {
    const r = lSkewnessOfVector(v);
    assert.equal(r.degenerate, true, `n=${v.length}`);
    assert.equal(r.tau3, 0);
  }
});

test('lSkewnessOfVector: all-equal -> degenerate, tau3=0', () => {
  const r = lSkewnessOfVector([7, 7, 7, 7, 7, 7]);
  assert.equal(r.degenerate, true);
  assert.equal(r.tau3, 0);
  assert.equal(r.l2, 0);
  assert.equal(r.nDistinct, 1);
});

test('lSkewnessOfVector: symmetric vector -> tau3 ~ 0', () => {
  // Symmetric around 5: 1,3,5,7,9 (n=5)
  const r = lSkewnessOfVector([1, 3, 5, 7, 9]);
  assert.equal(r.degenerate, false);
  assert.ok(Math.abs(r.tau3) < 1e-12, `tau3=${r.tau3}`);
  // L-mean = sample mean = 5
  assert.ok(Math.abs(r.l1 - 5) < 1e-12);
});

test('lSkewnessOfVector: larger symmetric vector -> tau3 ~ 0', () => {
  // Symmetric arithmetic progression around 50.
  const xs: number[] = [];
  for (let i = 0; i < 21; i += 1) xs.push(i * 5);
  const r = lSkewnessOfVector(xs);
  assert.equal(r.degenerate, false);
  assert.ok(Math.abs(r.tau3) < 1e-12, `tau3=${r.tau3}`);
});

test('lSkewnessOfVector: right-skewed -> tau3 > 0', () => {
  // Many small + one huge.
  const r = lSkewnessOfVector([1, 1, 2, 2, 3, 3, 100]);
  assert.equal(r.degenerate, false);
  assert.ok(r.tau3 > 0.4, `expected tau3 > 0.4, got ${r.tau3}`);
  assert.ok(r.tau3 < 1);
});

test('lSkewnessOfVector: left-skewed -> tau3 < 0', () => {
  const r = lSkewnessOfVector([1, 98, 99, 99, 100, 100, 100]);
  assert.equal(r.degenerate, false);
  assert.ok(r.tau3 < -0.4, `expected tau3 < -0.4, got ${r.tau3}`);
  assert.ok(r.tau3 > -1);
});

test('lSkewnessOfVector: reflection witness — tau3(2m - X) = -tau3(X)', () => {
  const xs = [3, 5, 7, 11, 13, 19, 71];
  const r1 = lSkewnessOfVector(xs);
  const m = (Math.min(...xs) + Math.max(...xs)) / 2;
  const reflected = xs.map((x) => 2 * m - x);
  const r2 = lSkewnessOfVector(reflected);
  // l2 is invariant under reflection (it's a scale).
  assert.ok(Math.abs(r1.l2 - r2.l2) < 1e-9);
  // tau3 must flip sign.
  assert.ok(
    Math.abs(r1.tau3 + r2.tau3) < 1e-12,
    `expected tau3 to flip sign: ${r1.tau3} vs ${r2.tau3}`,
  );
});

test('lSkewnessOfVector: scale-invariance — tau3(c*X) = tau3(X) for c>0', () => {
  const xs = [2, 3, 5, 8, 13, 21];
  const r1 = lSkewnessOfVector(xs);
  const r2 = lSkewnessOfVector(xs.map((x) => 7.5 * x));
  assert.ok(
    Math.abs(r1.tau3 - r2.tau3) < 1e-12,
    `tau3 should be scale-invariant: ${r1.tau3} vs ${r2.tau3}`,
  );
  // l2 scales linearly.
  assert.ok(Math.abs(r2.l2 - 7.5 * r1.l2) < 1e-9);
});

test('lSkewnessOfVector: shift-invariance of tau3 (location shift)', () => {
  // tau_3 is location-invariant only after dividing by l_2; l_3 itself
  // is location-invariant because the alternating-sign coefficients
  // sum to zero (1 - 3 + 3 - 1 = 0 for l_4 and 1 - 2 + 1 = 0 weight
  // pattern hidden inside l_3's b_r combination).
  const xs = [1, 2, 4, 8, 16];
  const r1 = lSkewnessOfVector(xs);
  const r2 = lSkewnessOfVector(xs.map((x) => x + 1000));
  assert.ok(
    Math.abs(r1.tau3 - r2.tau3) < 1e-9,
    `tau3 should be location-invariant: ${r1.tau3} vs ${r2.tau3}`,
  );
  assert.ok(Math.abs(r1.l2 - r2.l2) < 1e-9);
  assert.ok(Math.abs(r2.l1 - r1.l1 - 1000) < 1e-9);
});

test('lSkewnessOfVector: tau3 stays in (-1, +1)', () => {
  const samples = [
    [1, 1, 1, 1, 1000000],
    [0, 0, 0, 0, 0, 0, 0, 1],
    [1, 100, 100, 100, 100],
  ];
  for (const s of samples) {
    const r = lSkewnessOfVector(s);
    assert.ok(r.tau3 >= -1 && r.tau3 <= 1, `tau3=${r.tau3} for ${s}`);
  }
});

test('lSkewnessOfVector: closed-form n=4 sanity', () => {
  // For n=4 sorted x_1<=x_2<=x_3<=x_4:
  //   b_0 = (x1+x2+x3+x4)/4
  //   b_1 = (1/4)*(x2*(1/3) + x3*(2/3) + x4*(3/3)) = (x2 + 2 x3 + 3 x4)/12
  //   b_2 = (1/4)*(x3*(2*1)/(3*2) + x4*(3*2)/(3*2)) = (x3 + 3 x4)/12
  //   l_2 = 2 b_1 - b_0
  //   l_3 = 6 b_2 - 6 b_1 + b_0
  const xs = [1, 2, 4, 8];
  const r = lSkewnessOfVector(xs);
  const b0 = (1 + 2 + 4 + 8) / 4;
  const b1 = (2 + 2 * 4 + 3 * 8) / 12;
  const b2 = (4 + 3 * 8) / 12;
  const l2 = 2 * b1 - b0;
  const l3 = 6 * b2 - 6 * b1 + b0;
  assert.ok(Math.abs(r.l1 - b0) < 1e-12, `l1: ${r.l1} vs ${b0}`);
  assert.ok(Math.abs(r.l2 - l2) < 1e-12, `l2: ${r.l2} vs ${l2}`);
  assert.ok(Math.abs(r.l3 - l3) < 1e-12, `l3: ${r.l3} vs ${l3}`);
  assert.ok(Math.abs(r.tau3 - l3 / l2) < 1e-12);
});

// ---- buildDailyTokenLSkewness builder ---------------------------------

test('build: rejects bad opts', () => {
  assert.throws(() => buildDailyTokenLSkewness([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenLSkewness([], { minDays: 3 }));
  assert.throws(() => buildDailyTokenLSkewness([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenLSkewness([], { minAbsTau3: 1.5 }),
  );
  assert.throws(() =>
    buildDailyTokenLSkewness([], { sort: 'nope' as never }),
  );
  assert.throws(() => buildDailyTokenLSkewness([], { since: 'not-a-date' }));
  assert.throws(() => buildDailyTokenLSkewness([], { until: 'not-a-date' }));
});

test('build: empty queue', () => {
  const r = buildDailyTokenLSkewness([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.generatedAt, GEN);
});

test('build: drops bad hour_start, non-positive tokens', () => {
  const lines: QueueLine[] = [
    ql('not-a-date', 'a', 1000),
    { ...ql('2026-04-01T00:00:00Z', 'a', 0), total_tokens: 0 },
    ql('2026-04-01T01:00:00Z', 'a', 5000),
  ];
  const r = buildDailyTokenLSkewness(lines, {
    minTokens: 1,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 1);
});

test('build: sparse source dropped via min-tokens', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 6; d += 1) {
    lines.push(
      ql(`2026-04-0${d}T00:00:00Z`, 'small', 10),
      ql(`2026-04-0${d}T01:00:00Z`, 'big', 5000),
    );
  }
  const r = buildDailyTokenLSkewness(lines, {
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('build: below min-days dropped', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 3; d += 1) {
    lines.push(ql(`2026-04-0${d}T00:00:00Z`, 'a', 10000));
  }
  const r = buildDailyTokenLSkewness(lines, {
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinDays, 1);
  assert.equal(r.sources.length, 0);
});

test('build: right-skewed source has tau3 > 0', () => {
  // 6 small days + 1 huge day for source "spike".
  const lines: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'spike', 100),
    ql('2026-04-02T00:00:00Z', 'spike', 110),
    ql('2026-04-03T00:00:00Z', 'spike', 90),
    ql('2026-04-04T00:00:00Z', 'spike', 120),
    ql('2026-04-05T00:00:00Z', 'spike', 95),
    ql('2026-04-06T00:00:00Z', 'spike', 105),
    ql('2026-04-07T00:00:00Z', 'spike', 50000),
  ];
  const r = buildDailyTokenLSkewness(lines, {
    minTokens: 1,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.degenerate, false);
  assert.ok(row.tau3 > 0.5, `expected tau3 > 0.5, got ${row.tau3}`);
});

test('build: sort orderings work', () => {
  const lines: QueueLine[] = [];
  // Source A: right-skewed.
  for (let d = 1; d <= 6; d += 1) {
    lines.push(ql(`2026-04-0${d}T00:00:00Z`, 'A', 100 + d));
  }
  lines.push(ql('2026-04-07T00:00:00Z', 'A', 100000));
  // Source B: left-skewed (mirror).
  for (let d = 1; d <= 6; d += 1) {
    lines.push(ql(`2026-04-0${d}T00:00:00Z`, 'B', 100000 - d));
  }
  lines.push(ql('2026-04-07T00:00:00Z', 'B', 1));
  // Source C: roughly symmetric.
  for (let d = 1; d <= 7; d += 1) {
    lines.push(ql(`2026-04-0${d}T00:00:00Z`, 'C', 1000 + (d - 4) * 10));
  }

  const sortedTau3Desc = buildDailyTokenLSkewness(lines, {
    minTokens: 1,
    minDays: 4,
    sort: 'tau3',
    generatedAt: GEN,
  });
  // A should be most positive.
  assert.equal(sortedTau3Desc.sources[0]!.source, 'A');

  const sortedTau3Asc = buildDailyTokenLSkewness(lines, {
    minTokens: 1,
    minDays: 4,
    sort: 'tau3Asc',
    generatedAt: GEN,
  });
  // B should be most negative.
  assert.equal(sortedTau3Asc.sources[0]!.source, 'B');
});

test('build: source filter', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 7; d += 1) {
    lines.push(ql(`2026-04-0${d}T00:00:00Z`, 'A', 1000));
    lines.push(ql(`2026-04-0${d}T01:00:00Z`, 'B', 2000));
  }
  const r = buildDailyTokenLSkewness(lines, {
    minTokens: 1,
    minDays: 4,
    source: 'A',
    generatedAt: GEN,
  });
  assert.equal(r.source, 'A');
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
  assert.ok(r.droppedSourceFilter > 0);
});

test('build: window since/until', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 10; d += 1) {
    const dd = d.toString().padStart(2, '0');
    lines.push(ql(`2026-04-${dd}T00:00:00Z`, 'A', 1000 + d));
  }
  const r = buildDailyTokenLSkewness(lines, {
    minTokens: 1,
    minDays: 4,
    since: '2026-04-03T00:00:00Z',
    until: '2026-04-08T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nDays, 5); // days 3..7 inclusive (until exclusive)
});

test('build: top cap surfaces droppedTopSources', () => {
  const lines: QueueLine[] = [];
  for (const s of ['A', 'B', 'C']) {
    for (let d = 1; d <= 6; d += 1) {
      lines.push(ql(`2026-04-0${d}T00:00:00Z`, s, 1000 + d));
    }
  }
  const r = buildDailyTokenLSkewness(lines, {
    minTokens: 1,
    minDays: 4,
    top: 1,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('build: minAbsTau3 filter drops near-symmetric rows', () => {
  const lines: QueueLine[] = [];
  // Source SYM: nearly symmetric around 1000.
  for (let d = 1; d <= 7; d += 1) {
    lines.push(ql(`2026-04-0${d}T00:00:00Z`, 'SYM', 1000 + (d - 4) * 50));
  }
  // Source SKEW: hugely right-skewed.
  for (let d = 1; d <= 6; d += 1) {
    lines.push(ql(`2026-04-0${d}T00:00:00Z`, 'SKEW', 100));
  }
  lines.push(ql('2026-04-07T00:00:00Z', 'SKEW', 100000));
  const r = buildDailyTokenLSkewness(lines, {
    minTokens: 1,
    minDays: 4,
    minAbsTau3: 0.3,
    generatedAt: GEN,
  });
  // SYM (|tau3| ~ 0) should be dropped, SKEW kept.
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'SKEW');
  assert.equal(r.droppedBelowMinAbsTau3, 1);
});

test('build: degenerate all-equal source surfaces with tau3=0 / degenerate=true', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 6; d += 1) {
    lines.push(ql(`2026-04-0${d}T00:00:00Z`, 'flat', 5000));
  }
  const r = buildDailyTokenLSkewness(lines, {
    minTokens: 1,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.degenerate, true);
  assert.equal(r.sources[0]!.tau3, 0);
});

// ---- orthogonality witness vs medcouple --------------------------------

test('orthogonality witness: tau3 detects single-outlier asymmetry that MC barely sees', () => {
  // 8 values at ~ symmetric body + 1 huge outlier above. MC may stay
  // moderate (the median doesn't move, the kernel pairs are all
  // medians-times-others), but tau_3 should be strongly positive
  // because b_2 weights the top order statistic by (n-1)(n-2)/((n-1)(n-2))
  // = 1 (the maximum weight in the PWM scheme).
  const xs = [10, 11, 12, 13, 14, 15, 16, 17, 100000];
  const r = lSkewnessOfVector(xs);
  assert.ok(r.tau3 > 0.5, `tau3 should be strongly positive, got ${r.tau3}`);
});

// ---- refinement: Gaussian-baseline + closed-form n=5 anchor +
// ----             builder consistency witness vs primitive ------------

test('refinement: tau_3 of a roughly Gaussian sample is small (|tau_3| < 0.1)', () => {
  // Deterministic pseudo-Gaussian via Box-Muller on a fixed LCG seed.
  // (No Math.random in tests.)
  let state = 12345;
  function lcg(): number {
    // Numerical Recipes LCG.
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state + 1) / 0x100000001;
  }
  function boxMuller(): number {
    const u = lcg();
    const v = lcg();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const xs: number[] = [];
  for (let i = 0; i < 500; i += 1) xs.push(boxMuller());
  const r = lSkewnessOfVector(xs);
  assert.equal(r.degenerate, false);
  // True N(0,1) has tau_3 = 0; with n=500 our deterministic seed
  // should land well within 0.1.
  assert.ok(
    Math.abs(r.tau3) < 0.1,
    `Gaussian-baseline expects |tau_3| < 0.1, got ${r.tau3}`,
  );
  // And l_2 should be close to the Gaussian L-scale 1/sqrt(pi) ~= 0.5642.
  assert.ok(
    Math.abs(r.l2 - 1 / Math.sqrt(Math.PI)) < 0.1,
    `l_2 expected ~ 1/sqrt(pi) ~= 0.5642 for N(0,1), got ${r.l2}`,
  );
});

test('refinement: closed-form n=5 anchor against hand-computed PWM', () => {
  // n=5 unbiased PWM:
  //   b_0 = mean
  //   b_1 = (1/5) * sum_{j=2..5} (j-1)/4 * x_(j)
  //       = (1/20) * (x2 + 2 x3 + 3 x4 + 4 x5)
  //   b_2 = (1/5) * sum_{j=3..5} (j-1)(j-2)/(4*3) * x_(j)
  //       = (1/60) * (2 x3 + 6 x4 + 12 x5)
  //       = (x3 + 3 x4 + 6 x5) / 30
  const xs = [2, 3, 5, 7, 11];
  const r = lSkewnessOfVector(xs);
  const b0 = (2 + 3 + 5 + 7 + 11) / 5;
  const b1 = (3 + 2 * 5 + 3 * 7 + 4 * 11) / 20;
  const b2 = (5 + 3 * 7 + 6 * 11) / 30;
  const l2 = 2 * b1 - b0;
  const l3 = 6 * b2 - 6 * b1 + b0;
  assert.ok(Math.abs(r.l1 - b0) < 1e-12);
  assert.ok(Math.abs(r.l2 - l2) < 1e-12, `n=5 l2: ${r.l2} vs ${l2}`);
  assert.ok(Math.abs(r.l3 - l3) < 1e-12, `n=5 l3: ${r.l3} vs ${l3}`);
  assert.ok(Math.abs(r.tau3 - l3 / l2) < 1e-12);
});

test('refinement: builder row matches primitive on the per-day vector', () => {
  // Builder/primitive consistency witness: take a controlled queue,
  // recompute the per-day vector by hand, and assert the builder's
  // l_1, l_2, l_3, tau_3 exactly match lSkewnessOfVector(days).
  const lines: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'X', 100),
    ql('2026-04-01T05:00:00Z', 'X', 200), // day 1 total = 300
    ql('2026-04-02T00:00:00Z', 'X', 50),
    ql('2026-04-03T00:00:00Z', 'X', 1000),
    ql('2026-04-04T00:00:00Z', 'X', 75),
    ql('2026-04-05T00:00:00Z', 'X', 60),
    ql('2026-04-06T00:00:00Z', 'X', 90),
  ];
  const days = [300, 50, 1000, 75, 60, 90];
  const direct = lSkewnessOfVector(days);

  const r = buildDailyTokenLSkewness(lines, {
    minTokens: 1,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nDays, 6);
  assert.ok(Math.abs(row.l1 - direct.l1) < 1e-9);
  assert.ok(Math.abs(row.l2 - direct.l2) < 1e-9);
  assert.ok(Math.abs(row.l3 - direct.l3) < 1e-9);
  assert.ok(Math.abs(row.tau3 - direct.tau3) < 1e-12);
});
