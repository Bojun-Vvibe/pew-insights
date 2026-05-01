import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenDfaAlpha,
  buildDfaScales,
  dfaAlpha,
  DEFAULT_DFA_MIN_WINDOW,
  DEFAULT_DFA_MAX_SCALES,
  DEFAULT_DFA_MIN_SCALES,
} from '../src/dailytokendfaalpha.js';
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

const GEN = '2026-05-02T12:00:00.000Z';

// ---- buildDfaScales primitive -----------------------------------------

test('buildDfaScales: rejects bad inputs', () => {
  assert.throws(() => buildDfaScales(0, 10, 5));
  assert.throws(() => buildDfaScales(4, 3, 5));
  assert.throws(() => buildDfaScales(4, 10, 0));
  assert.throws(() => buildDfaScales(4, 10, -1));
  assert.throws(() => buildDfaScales(4.5 as any, 10, 5));
});

test('buildDfaScales: lo=hi -> single scale', () => {
  assert.deepEqual(buildDfaScales(7, 7, 5), [7]);
});

test('buildDfaScales: produces ascending unique integers in range', () => {
  const s = buildDfaScales(4, 100, 12);
  assert.ok(s.length > 0 && s.length <= 12);
  for (let i = 0; i < s.length; i += 1) {
    assert.ok(Number.isInteger(s[i]));
    assert.ok(s[i]! >= 4 && s[i]! <= 100);
    if (i > 0) assert.ok(s[i]! > s[i - 1]!);
  }
  assert.equal(s[0], 4);
  assert.equal(s[s.length - 1], 100);
});

// ---- dfaAlpha primitive -----------------------------------------------

test('dfaAlpha: rejects non-finite values', () => {
  assert.throws(() => dfaAlpha([1, 2, NaN, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]));
  assert.throws(() => dfaAlpha([1, 2, Infinity, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]));
});

test('dfaAlpha: rejects too-short series', () => {
  // Need n >= 4*minWindow = 16; 15 is too short.
  const x: number[] = [];
  for (let i = 0; i < 15; i += 1) x.push(i);
  assert.throws(() => dfaAlpha(x));
});

test('dfaAlpha: linearly increasing ramp -> alpha clamps high', () => {
  // For a deterministic ramp x[i] = i, the cumulative profile Y[i]
  // is quadratic in i; per-window LINEAR detrending leaves
  // parabolic residuals whose F(s) ~ s^2 (alpha = 2). The estimator
  // either clamps at 2 or sits very close to it.
  const n = 256;
  const ramp: number[] = [];
  for (let i = 0; i < n; i += 1) ramp.push(i);
  const r = dfaAlpha(ramp);
  assert.ok(
    r.alpha >= 1.8,
    `expected alpha near 2 for linear ramp, got alpha=${r.alpha} (raw=${r.alphaRaw})`,
  );
  assert.ok(r.r2 > 0.99, `expected r2 > 0.99 on a clean ramp, got ${r.r2}`);
});

test('dfaAlpha: shuffled-uniform series -> alpha near 0.5 (loose band)', () => {
  // Deterministic mulberry32 PRNG for reproducibility.
  function mulberry32(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(42);
  const n = 2048;
  const x: number[] = [];
  for (let i = 0; i < n; i += 1) x.push(rng());
  const r = dfaAlpha(x, { maxScales: 16 });
  // i.i.d. uniform of length 2048 has DFA-1 alpha tightly around
  // 0.5 (Kantelhardt et al. 2001). Use a loose band to absorb
  // small-sample bias.
  assert.ok(
    r.alpha > 0.35 && r.alpha < 0.7,
    `expected alpha near 0.5 for uniform iid (loose band), got ${r.alpha}`,
  );
  assert.ok(r.r2 > 0.85);
});

test('dfaAlpha: orthogonality witness — sorted vs shuffled multiset gives very different alpha', () => {
  function mulberry32(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(7);
  const n = 1024;
  const base: number[] = [];
  for (let i = 0; i < n; i += 1) base.push(Math.floor(rng() * 1000));
  const sorted = [...base].sort((a, b) => a - b);
  const aSorted = dfaAlpha(sorted).alpha;
  const aShuffled = dfaAlpha(base).alpha;
  // Every multiset statistic (mean, var, gini, atkinson, ...) is
  // identical; alpha must differ by >= 0.5 (sorted -> high, shuffled
  // -> ~0.5).
  assert.ok(
    aSorted - aShuffled > 0.5,
    `sorted alpha (${aSorted}) must exceed shuffled alpha (${aShuffled}) by >= 0.5`,
  );
});

test('dfaAlpha: surfaces degenerate-window count when series has all-zero stretch', () => {
  // A 128-day series whose first 64 days are 0 and last 64 days
  // alternate. The cumulative profile of an all-zero stretch is
  // itself a perfect linear function (after subtracting the global
  // mean); per-window linear detrending of a perfect line gives
  // residual ssr = 0 -> degenerate window.
  const x: number[] = [];
  for (let i = 0; i < 64; i += 1) x.push(0);
  for (let i = 0; i < 64; i += 1) x.push(i % 2 === 0 ? 100 : 200);
  const r = dfaAlpha(x, { minWindow: 4, maxScales: 8, minScales: 3 });
  assert.ok(
    r.degenerateWindows > 0,
    'should report at least one degenerate (perfect-fit) window',
  );
});

// ---- buildDailyTokenDfaAlpha full pipeline ----------------------------

test('buildDailyTokenDfaAlpha: validates option ranges', () => {
  assert.throws(() => buildDailyTokenDfaAlpha([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenDfaAlpha([], { minWindow: 3 }));
  assert.throws(() => buildDailyTokenDfaAlpha([], { maxScales: 2 }));
  assert.throws(() => buildDailyTokenDfaAlpha([], { minScales: 2 }));
  assert.throws(() => buildDailyTokenDfaAlpha([], { minScales: 8, maxScales: 4 }));
  // 4*minWindow = 16; 8 is below floor.
  assert.throws(() => buildDailyTokenDfaAlpha([], { minTenureDays: 8, minWindow: 4 }));
  assert.throws(() => buildDailyTokenDfaAlpha([], { top: -1 }));
  assert.throws(() => buildDailyTokenDfaAlpha([], { sort: 'nope' as any }));
  assert.throws(() => buildDailyTokenDfaAlpha([], { since: 'not-a-date' }));
  assert.throws(() => buildDailyTokenDfaAlpha([], { until: 'not-a-date' }));
});

test('buildDailyTokenDfaAlpha: empty queue -> empty report with zero rows', () => {
  const r = buildDailyTokenDfaAlpha([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minTenureDays, 32);
  assert.equal(r.minWindow, DEFAULT_DFA_MIN_WINDOW);
  assert.equal(r.maxScales, DEFAULT_DFA_MAX_SCALES);
  assert.equal(r.minScales, DEFAULT_DFA_MIN_SCALES);
});

test('buildDailyTokenDfaAlpha: drops bad hour_start, non-positive tokens, source filter', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's1', 100),
    ql('2026-01-01T00:00:00.000Z', 's1', 0),
    ql('2026-01-01T00:00:00.000Z', 's1', -50),
    ql('2026-01-01T00:00:00.000Z', 's2', 999),
  ];
  const r = buildDailyTokenDfaAlpha(queue, {
    generatedAt: GEN,
    source: 's1',
    minTokens: 1,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.droppedSourceFilter, 1);
});

test('buildDailyTokenDfaAlpha: drops sparse and short-tenure sources', () => {
  const queue: QueueLine[] = [];
  // s1 has only 100 tokens -> sparse
  queue.push(ql('2026-01-01T00:00:00.000Z', 's1', 100));
  // s2 has plenty of tokens but only 5 days tenure -> below min-tenure
  for (let d = 0; d < 5; d += 1) {
    const day = `2026-01-${String(d + 1).padStart(2, '0')}T00:00:00.000Z`;
    queue.push(ql(day, 's2', 10000));
  }
  const r = buildDailyTokenDfaAlpha(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenDfaAlpha: end-to-end on a synthetic ramp source', () => {
  // 64-day strictly-increasing ramp -> alpha clamps high.
  const queue: QueueLine[] = [];
  for (let d = 0; d < 64; d += 1) {
    const day = new Date(Date.parse('2026-01-01T00:00:00.000Z') + d * 86_400_000)
      .toISOString();
    queue.push(ql(day, 'ramp', 1000 + d * 10));
  }
  const r = buildDailyTokenDfaAlpha(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'ramp');
  assert.equal(row.nTenureDays, 64);
  assert.equal(row.nActiveDays, 64);
  assert.ok(row.alpha >= 1.8, `ramp alpha should be near 2, got ${row.alpha}`);
  assert.ok(row.r2 > 0.95);
  assert.ok(row.scalesUsed >= DEFAULT_DFA_MIN_SCALES);
  assert.ok(row.minScaleUsed >= DEFAULT_DFA_MIN_WINDOW);
  assert.ok(row.maxScaleUsed <= 16);
});

test('buildDailyTokenDfaAlpha: gap-fill is applied across missing days', () => {
  // Source has 64-day tenure but only 2 active days; rest are gap-filled to 0.
  // Many windows become perfect-linear-profile (degenerate) after detrending.
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'sparse', 50000),
    ql('2026-03-05T00:00:00.000Z', 'sparse', 60000),
  ];
  const r = buildDailyTokenDfaAlpha(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
  });
  // Either dropped at source level or surfaced with degenerate windows recorded.
  if (r.sources.length > 0) {
    assert.ok(r.sources[0]!.degenerateWindows > 0);
  } else {
    assert.equal(r.droppedTooFewScales, 1);
  }
});

test('buildDailyTokenDfaAlpha: top cap and droppedTopSources counter', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    for (let d = 0; d < 64; d += 1) {
      const day = new Date(Date.parse('2026-01-01T00:00:00.000Z') + d * 86_400_000)
        .toISOString();
      queue.push(ql(day, `src${s}`, 1000 + d * (s + 1)));
    }
  }
  const r = buildDailyTokenDfaAlpha(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenDfaAlpha: sort key absAlphaDeviationDesc puts alpha furthest from 0.5 first', () => {
  // Build two sources: one ramp (alpha high), one near-flat alternation (alpha lower).
  const queue: QueueLine[] = [];
  for (let d = 0; d < 64; d += 1) {
    const day = new Date(Date.parse('2026-01-01T00:00:00.000Z') + d * 86_400_000)
      .toISOString();
    queue.push(ql(day, 'ramp', 1000 + d * 10));
    queue.push(ql(day, 'altr', 10000 + (d % 2) * 100));
  }
  const r = buildDailyTokenDfaAlpha(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
    sort: 'absAlphaDeviationDesc',
  });
  assert.ok(r.sources.length === 2);
  const top = r.sources[0]!;
  const bottom = r.sources[1]!;
  assert.ok(
    Math.abs(top.alpha - 0.5) >= Math.abs(bottom.alpha - 0.5),
    `sort failed: top |alpha-.5|=${Math.abs(top.alpha - 0.5)} bottom=${Math.abs(bottom.alpha - 0.5)}`,
  );
});

test('buildDailyTokenDfaAlpha: respects --since/--until window', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 100; d += 1) {
    const day = new Date(Date.parse('2026-01-01T00:00:00.000Z') + d * 86_400_000)
      .toISOString();
    queue.push(ql(day, 'src', 1000 + d * 5));
  }
  const r = buildDailyTokenDfaAlpha(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
    since: '2026-01-15T00:00:00.000Z',
    until: '2026-03-20T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.nTenureDays >= 32 && row.nTenureDays <= 100);
  assert.equal(r.windowStart, '2026-01-15T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-03-20T00:00:00.000Z');
});

test('buildDailyTokenDfaAlpha: JSON-serialisable report carries every documented field', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 64; d += 1) {
    const day = new Date(Date.parse('2026-01-01T00:00:00.000Z') + d * 86_400_000)
      .toISOString();
    queue.push(ql(day, 'src', 1000 + d * 10));
  }
  const r = buildDailyTokenDfaAlpha(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
  });
  const round = JSON.parse(JSON.stringify(r));
  for (const k of [
    'generatedAt',
    'windowStart',
    'windowEnd',
    'minTokens',
    'minTenureDays',
    'minWindow',
    'maxScales',
    'minScales',
    'top',
    'sort',
    'source',
    'totalTokens',
    'totalSources',
    'droppedInvalidHourStart',
    'droppedNonPositiveTokens',
    'droppedSourceFilter',
    'droppedSparseSources',
    'droppedBelowMinTenure',
    'droppedBelowMinScales',
    'droppedTooFewScales',
    'droppedTopSources',
    'clampedBelow0',
    'clampedAbove2',
    'sources',
  ]) {
    assert.ok(k in round, `report missing key ${k}`);
  }
  assert.equal(round.sources.length, 1);
  for (const k of [
    'source',
    'totalTokens',
    'nActiveDays',
    'nTenureDays',
    'firstActiveDay',
    'lastActiveDay',
    'alpha',
    'alphaRaw',
    'intercept',
    'r2',
    'scalesUsed',
    'minScaleUsed',
    'maxScaleUsed',
    'degenerateWindows',
    'scalesDroppedZeroF',
    'clampedBelow0',
    'clampedAbove2',
  ]) {
    assert.ok(k in round.sources[0], `source row missing key ${k}`);
  }
});

// ---- DFA vs Hurst R/S divergence (cross-axis orthogonality witness) ---

test('buildDailyTokenDfaAlpha: clamps alpha into [0, 2] and surfaces clamp counter', () => {
  // A perfect ramp drives alpha to its theoretical 2 boundary
  // (cumulative profile is exactly quadratic; OLS of log(F) vs log(s)
  // gives a slope very close to 2 — depending on rounding it may or
  // may not clamp). The clampedAbove2 counter must be a non-negative
  // integer; the alpha field must be in [0, 2].
  const queue: QueueLine[] = [];
  for (let d = 0; d < 96; d += 1) {
    const day = new Date(Date.parse('2026-01-01T00:00:00.000Z') + d * 86_400_000)
      .toISOString();
    queue.push(ql(day, 'ramp', 1000 + d * 10));
  }
  const r = buildDailyTokenDfaAlpha(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.alpha >= 0 && row.alpha <= 2, `alpha out of [0,2]: ${row.alpha}`);
  assert.ok(Number.isInteger(r.clampedAbove2));
  assert.ok(Number.isInteger(r.clampedBelow0));
});

// ---- numerical-stability property: alpha and r2 always finite --------

test('dfaAlpha: alpha, alphaRaw, intercept, r2 are always finite numbers across diverse inputs', () => {
  // Property guard: regardless of input shape (constant-ish series,
  // pure noise, ramp-with-noise, alternation), the returned scalars
  // must be finite — never NaN or +/-Infinity. Catches accidental
  // log(0), 0/0, or unbounded OLS slopes from sub-normal F(s) values.
  function mulberry32(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const n = 256;
  const cases: number[][] = [];
  // Pure noise
  const rng = mulberry32(11);
  const noise: number[] = [];
  for (let i = 0; i < n; i += 1) noise.push(rng());
  cases.push(noise);
  // Ramp + noise
  const rampNoisy: number[] = [];
  const rng2 = mulberry32(13);
  for (let i = 0; i < n; i += 1) rampNoisy.push(i + rng2() * 5);
  cases.push(rampNoisy);
  // Alternation + tiny jitter
  const altr: number[] = [];
  const rng3 = mulberry32(17);
  for (let i = 0; i < n; i += 1) altr.push((i % 2 === 0 ? 100 : 200) + rng3());
  cases.push(altr);
  // Heavy-tailed positive series
  const heavy: number[] = [];
  const rng4 = mulberry32(19);
  for (let i = 0; i < n; i += 1) heavy.push(Math.floor(Math.exp(rng4() * 10)));
  cases.push(heavy);
  for (const x of cases) {
    const r = dfaAlpha(x);
    assert.ok(Number.isFinite(r.alpha), `alpha not finite: ${r.alpha}`);
    assert.ok(Number.isFinite(r.alphaRaw), `alphaRaw not finite: ${r.alphaRaw}`);
    assert.ok(Number.isFinite(r.intercept), `intercept not finite: ${r.intercept}`);
    assert.ok(Number.isFinite(r.r2), `r2 not finite: ${r.r2}`);
    assert.ok(r.alpha >= 0 && r.alpha <= 2, `alpha out of [0,2]: ${r.alpha}`);
    assert.ok(r.r2 >= 0 && r.r2 <= 1, `r2 out of [0,1]: ${r.r2}`);
  }
});
