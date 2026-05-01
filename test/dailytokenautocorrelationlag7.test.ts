import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenAutocorrelationLag7,
  pearsonAutocorrelationAtLag,
} from '../src/dailytokenautocorrelationlag7.js';
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

// ---- pearsonAutocorrelationAtLag primitive ---------------------------

test('pearsonAutocorrelationAtLag: rejects non-finite values', () => {
  assert.throws(() => pearsonAutocorrelationAtLag([1, NaN, 3, 4, 5, 6, 7, 8], 7));
  assert.throws(() => pearsonAutocorrelationAtLag([1, Infinity, 3, 4, 5, 6, 7, 8], 7));
});

test('pearsonAutocorrelationAtLag: rejects bad lag', () => {
  assert.throws(() => pearsonAutocorrelationAtLag([1, 2, 3], 0));
  assert.throws(() => pearsonAutocorrelationAtLag([1, 2, 3], -1));
  assert.throws(() => pearsonAutocorrelationAtLag([1, 2, 3], 1.5));
});

test('pearsonAutocorrelationAtLag: n <= k -> flat', () => {
  const r = pearsonAutocorrelationAtLag([1, 2, 3, 4, 5, 6, 7], 7);
  assert.equal(r.flat, true);
  assert.equal(r.rho, 0);
});

test('pearsonAutocorrelationAtLag: constant series -> flat, rho=0', () => {
  const r = pearsonAutocorrelationAtLag([5, 5, 5, 5, 5, 5, 5, 5, 5, 5], 7);
  assert.equal(r.flat, true);
  assert.equal(r.rho, 0);
});

test('pearsonAutocorrelationAtLag: rho7 strongly positive for perfect weekly cycle', () => {
  // Pattern of length 7 repeated 4 times -> exactly 28 entries.
  // With biased (1/n) divisor, n=28 entries and 21 perfectly-correlated
  // (i, i+7) pairs out of 28 squared-deviation contributions in the
  // denominator: rho7 = 21/28 = 0.75.
  const pattern = [10, 50, 30, 80, 20, 5, 100];
  const xs: number[] = [];
  for (let w = 0; w < 4; w += 1) xs.push(...pattern);
  const r = pearsonAutocorrelationAtLag(xs, 7);
  assert.equal(r.flat, false);
  assert.ok(r.rho > 0.7, `expected rho7 > 0.7 for repeating-week, got ${r.rho}`);
  assert.ok(Math.abs(r.rho - 0.75) < 1e-9, `expected rho7 = 21/28 = 0.75 exactly, got ${r.rho}`);
});

test('pearsonAutocorrelationAtLag: rho7 strongly negative for sign-flipped weekly pattern', () => {
  const A = [10, 50, 30, 80, 20, 5, 100];
  const B = A.map((x) => 100 - x);
  // 4 weeks alternating A B A B -> the lag-7 pairs are (A[i], B[i]) and (B[i], A[i]).
  // Same biased-divisor scale: |rho| = 21/28 = 0.75.
  const xs = [...A, ...B, ...A, ...B];
  const r = pearsonAutocorrelationAtLag(xs, 7);
  assert.equal(r.flat, false);
  assert.ok(r.rho < -0.7, `expected rho7 < -0.7 for alternating-week, got ${r.rho}`);
});

test('pearsonAutocorrelationAtLag: lag-7 differs from lag-1 on weekly-only signal', () => {
  // White-noise-ish daily values within a week, but week N+1 = week N exactly.
  // lag-1 within a week is uncorrelated; lag-7 across weeks is high.
  const week = [100, 5, 80, 20, 60, 10, 95];
  const xs = [...week, ...week, ...week, ...week];
  const r1 = pearsonAutocorrelationAtLag(xs, 1);
  const r7 = pearsonAutocorrelationAtLag(xs, 7);
  assert.ok(r7.rho > 0.7, `lag7 should be > 0.7, got ${r7.rho}`);
  // lag1 should be substantially lower than lag7 for this signal.
  assert.ok(
    r7.rho - r1.rho > 0.4,
    `lag7 (${r7.rho}) should dominate lag1 (${r1.rho}) for weekly-only signal`,
  );
});

test('pearsonAutocorrelationAtLag: rho stays in [-1, 1] under fp noise', () => {
  const xs: number[] = [];
  for (let i = 0; i < 50; i += 1) xs.push(Math.cos(i / 7) + i * 1e-9);
  const r = pearsonAutocorrelationAtLag(xs, 7);
  assert.ok(r.rho >= -1 && r.rho <= 1);
});

// ---- buildDailyTokenAutocorrelationLag7 builder ---------------------

test('build: rejects bad opts', () => {
  assert.throws(() => buildDailyTokenAutocorrelationLag7([], { minTokens: -1 }));
  assert.throws(() =>
    buildDailyTokenAutocorrelationLag7([], { minTenureDays: 7 }),
  );
  assert.throws(() => buildDailyTokenAutocorrelationLag7([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenAutocorrelationLag7([], { minAbsRho7: 1.5 }),
  );
  assert.throws(() =>
    buildDailyTokenAutocorrelationLag7([], { sort: 'nope' as never }),
  );
  assert.throws(() =>
    buildDailyTokenAutocorrelationLag7([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildDailyTokenAutocorrelationLag7([], { until: 'not-a-date' }),
  );
});

test('build: empty queue', () => {
  const r = buildDailyTokenAutocorrelationLag7([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.generatedAt, GEN);
});

test('build: drops bad hour_start, non-positive tokens', () => {
  const lines: QueueLine[] = [
    ql('not-a-date', 'a', 1000),
    ql('2026-04-01T01:00:00Z', 'a', 0),
    ql('2026-04-01T02:00:00Z', 'a', 5000),
  ];
  const r = buildDailyTokenAutocorrelationLag7(lines, {
    minTokens: 1,
    minTenureDays: 8,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 1);
});

test('build: sparse source dropped via min-tokens', () => {
  const lines: QueueLine[] = [];
  // 14-day tenure for both sources; one tiny, one big.
  for (let d = 1; d <= 14; d += 1) {
    const dd = d.toString().padStart(2, '0');
    lines.push(
      ql(`2026-04-${dd}T00:00:00Z`, 'small', 10),
      ql(`2026-04-${dd}T01:00:00Z`, 'big', 5000),
    );
  }
  const r = buildDailyTokenAutocorrelationLag7(lines, {
    minTokens: 1000,
    minTenureDays: 14,
    generatedAt: GEN,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('build: tenure below floor dropped', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 7; d += 1) {
    const dd = d.toString().padStart(2, '0');
    lines.push(ql(`2026-04-${dd}T00:00:00Z`, 'short', 10000));
  }
  const r = buildDailyTokenAutocorrelationLag7(lines, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('build: positive weekly cycle -> rho7 strongly positive', () => {
  const lines: QueueLine[] = [];
  const pattern = [100, 500, 300, 800, 200, 50, 1000];
  // 4 weeks repeating exactly.
  for (let w = 0; w < 4; w += 1) {
    for (let d = 0; d < 7; d += 1) {
      const ms = Date.parse('2026-04-01T00:00:00Z') + (w * 7 + d) * 86_400_000;
      const iso = new Date(ms).toISOString().slice(0, 10) + 'T00:00:00Z';
      lines.push(ql(iso, 'cycle', pattern[d]!));
    }
  }
  const r = buildDailyTokenAutocorrelationLag7(lines, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.flat, false);
  assert.ok(row.rho7 > 0.7, `expected rho7 > 0.7, got ${row.rho7}`);
  assert.equal(row.nTenureDays, 28);
  assert.equal(row.nLag7Pairs, 21);
});

test('build: anti-periodic weekly cycle -> rho7 strongly negative', () => {
  const lines: QueueLine[] = [];
  const A = [100, 500, 300, 800, 200, 50, 1000];
  const B = A.map((x) => 1100 - x);
  // 4 weeks alternating A B A B.
  const weeks = [A, B, A, B];
  for (let w = 0; w < 4; w += 1) {
    for (let d = 0; d < 7; d += 1) {
      const ms = Date.parse('2026-04-01T00:00:00Z') + (w * 7 + d) * 86_400_000;
      const iso = new Date(ms).toISOString().slice(0, 10) + 'T00:00:00Z';
      lines.push(ql(iso, 'flip', weeks[w]![d]!));
    }
  }
  const r = buildDailyTokenAutocorrelationLag7(lines, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.rho7 < -0.7, `expected rho7 < -0.7, got ${row.rho7}`);
});

test('build: gap-fill happens for missing days inside tenure', () => {
  // Days 1, 8, 15: same heavy value; everything else missing -> filled with 0.
  const lines: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'sparse', 10000),
    ql('2026-04-08T00:00:00Z', 'sparse', 10000),
    ql('2026-04-15T00:00:00Z', 'sparse', 10000),
  ];
  const r = buildDailyTokenAutocorrelationLag7(lines, {
    minTokens: 1,
    minTenureDays: 8,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 3);
  assert.equal(row.nTenureDays, 15); // Apr 1 .. Apr 15 inclusive
  // The lag-7 pairs hit (Apr1, Apr8) and (Apr8, Apr15): both heavy-heavy.
  // Other pairs are (0, 0). rho7 should be strongly positive.
  assert.equal(row.flat, false);
  assert.ok(row.rho7 > 0.5, `gap-filled weekly hits should give rho7>0.5, got ${row.rho7}`);
});

test('build: source filter', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 14; d += 1) {
    const dd = d.toString().padStart(2, '0');
    lines.push(ql(`2026-04-${dd}T00:00:00Z`, 'A', 1000));
    lines.push(ql(`2026-04-${dd}T01:00:00Z`, 'B', 2000));
  }
  const r = buildDailyTokenAutocorrelationLag7(lines, {
    minTokens: 1,
    minTenureDays: 14,
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
  for (let d = 1; d <= 30; d += 1) {
    const dd = d.toString().padStart(2, '0');
    lines.push(ql(`2026-04-${dd}T00:00:00Z`, 'A', 1000 + d));
  }
  const r = buildDailyTokenAutocorrelationLag7(lines, {
    minTokens: 1,
    minTenureDays: 8,
    since: '2026-04-05T00:00:00Z',
    until: '2026-04-20T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  // days 5..19 inclusive (until exclusive at day 20)
  assert.equal(r.sources[0]!.nActiveDays, 15);
  assert.equal(r.sources[0]!.nTenureDays, 15);
});

test('build: top cap surfaces droppedTopSources', () => {
  const lines: QueueLine[] = [];
  for (const s of ['A', 'B', 'C']) {
    for (let d = 1; d <= 14; d += 1) {
      const dd = d.toString().padStart(2, '0');
      lines.push(ql(`2026-04-${dd}T00:00:00Z`, s, 1000 + d));
    }
  }
  const r = buildDailyTokenAutocorrelationLag7(lines, {
    minTokens: 1,
    minTenureDays: 14,
    top: 1,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('build: minAbsRho7 filter drops low-rho rows', () => {
  const lines: QueueLine[] = [];
  // Strongly periodic source.
  const pattern = [100, 500, 300, 800, 200, 50, 1000];
  for (let w = 0; w < 3; w += 1) {
    for (let d = 0; d < 7; d += 1) {
      const ms = Date.parse('2026-04-01T00:00:00Z') + (w * 7 + d) * 86_400_000;
      const iso = new Date(ms).toISOString().slice(0, 10) + 'T00:00:00Z';
      lines.push(ql(iso, 'PERIODIC', pattern[d]!));
    }
  }
  // Roughly i.i.d.-looking source (linear ramp; lag-7 is small but nonzero).
  for (let d = 1; d <= 21; d += 1) {
    const dd = d.toString().padStart(2, '0');
    lines.push(ql(`2026-04-${dd}T00:00:00Z`, 'RAMP', 1000 + d));
  }
  const r = buildDailyTokenAutocorrelationLag7(lines, {
    minTokens: 1,
    minTenureDays: 14,
    minAbsRho7: 0.5,
    generatedAt: GEN,
  });
  // PERIODIC kept (rho7 = 14/21 = 0.667), RAMP dropped (rho7 ~ 0.073) under 0.5 floor.
  const kept = r.sources.map((s) => s.source);
  assert.ok(kept.includes('PERIODIC'));
  assert.ok(!kept.includes('RAMP'));
  assert.ok(r.droppedBelowMinAbsRho7 >= 1);
});

test('build: degenerate flat source surfaces with rho7=0 / flat=true', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 14; d += 1) {
    const dd = d.toString().padStart(2, '0');
    lines.push(ql(`2026-04-${dd}T00:00:00Z`, 'flat', 5000));
  }
  const r = buildDailyTokenAutocorrelationLag7(lines, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.flat, true);
  assert.equal(r.sources[0]!.rho7, 0);
});

test('build: sort orderings work', () => {
  const lines: QueueLine[] = [];
  // PERIODIC: rho7 ~ +1
  const pattern = [100, 500, 300, 800, 200, 50, 1000];
  for (let w = 0; w < 3; w += 1) {
    for (let d = 0; d < 7; d += 1) {
      const ms = Date.parse('2026-04-01T00:00:00Z') + (w * 7 + d) * 86_400_000;
      const iso = new Date(ms).toISOString().slice(0, 10) + 'T00:00:00Z';
      lines.push(ql(iso, 'PERIODIC', pattern[d]!));
    }
  }
  // ANTI: rho7 ~ -1
  const A = [100, 500, 300, 800, 200, 50, 1000];
  const B = A.map((x) => 1100 - x);
  const weeks = [A, B, A];
  for (let w = 0; w < 3; w += 1) {
    for (let d = 0; d < 7; d += 1) {
      const ms = Date.parse('2026-04-01T00:00:00Z') + (w * 7 + d) * 86_400_000;
      const iso = new Date(ms).toISOString().slice(0, 10) + 'T00:00:00Z';
      lines.push(ql(iso, 'ANTI', weeks[w]![d]!));
    }
  }

  const sortedRho7Desc = buildDailyTokenAutocorrelationLag7(lines, {
    minTokens: 1,
    minTenureDays: 14,
    sort: 'rho7',
    generatedAt: GEN,
  });
  assert.equal(sortedRho7Desc.sources[0]!.source, 'PERIODIC');

  const sortedRho7Asc = buildDailyTokenAutocorrelationLag7(lines, {
    minTokens: 1,
    minTenureDays: 14,
    sort: 'rho7Asc',
    generatedAt: GEN,
  });
  assert.equal(sortedRho7Asc.sources[0]!.source, 'ANTI');
});

// ---- orthogonality witness vs lag-1 ----------------------------------

test('orthogonality witness: weekly-repeating signal has rho7 substantially > 0', () => {
  // Build a clean repeating week. lag-7 is high (matches across weeks);
  // lag-1 may be anything depending on within-week shape, but rho7
  // captures specifically the weekly echo regardless.
  const week = [100, 5, 80, 20, 60, 10, 95];
  const xs: number[] = [];
  for (let w = 0; w < 5; w += 1) xs.push(...week);
  const r7 = pearsonAutocorrelationAtLag(xs, 7);
  // 5 repeats of 7 -> n=35. lag-7 pairs: i in [0..27], so 28 of 35
  // squared-deviation contributions are perfectly correlated.
  // Expected rho7 = 28/35 = 0.8.
  assert.ok(
    Math.abs(r7.rho - 0.8) < 1e-9,
    `5-week repeating signal: expected rho7 = 28/35 = 0.8 exactly, got ${r7.rho}`,
  );
});

test('orthogonality witness: weekly-repeating signal independent from within-week shape', () => {
  // Two different weekly patterns produce identical rho7 = 28/35 even
  // though their within-week shapes (and lag-1) differ wildly.
  const wA = [100, 5, 80, 20, 60, 10, 95]; // alternating
  const wB = [10, 20, 30, 40, 50, 60, 70]; // monotone
  const xsA: number[] = [];
  const xsB: number[] = [];
  for (let w = 0; w < 5; w += 1) {
    xsA.push(...wA);
    xsB.push(...wB);
  }
  const rA = pearsonAutocorrelationAtLag(xsA, 7);
  const rB = pearsonAutocorrelationAtLag(xsB, 7);
  assert.ok(Math.abs(rA.rho - rB.rho) < 1e-9, `rho7 should match across patterns: ${rA.rho} vs ${rB.rho}`);
  // But lag-1 should differ: monotone has high positive rho1, alternating low/negative.
  const rA1 = pearsonAutocorrelationAtLag(xsA, 1);
  const rB1 = pearsonAutocorrelationAtLag(xsB, 1);
  assert.ok(rB1.rho - rA1.rho > 0.5, `lag-1 should differ: A=${rA1.rho}, B=${rB1.rho}`);
});
