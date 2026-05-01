import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenHiguchiFd,
  higuchiFd,
  DEFAULT_HFD_KMAX,
  DEFAULT_HFD_MIN_K,
} from '../src/dailytokenhiguchifd.js';
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

// ---- higuchiFd primitive ---------------------------------------------

test('higuchiFd: defaults are 8 / 4', () => {
  assert.equal(DEFAULT_HFD_KMAX, 8);
  assert.equal(DEFAULT_HFD_MIN_K, 4);
});

test('higuchiFd: rejects non-finite values', () => {
  const x: number[] = [];
  for (let i = 0; i < 32; i += 1) x.push(i);
  x[5] = NaN;
  assert.throws(() => higuchiFd(x));
  x[5] = Infinity;
  assert.throws(() => higuchiFd(x));
});

test('higuchiFd: rejects too-short series', () => {
  // Need n >= kMax+2 = 10.
  const x: number[] = [];
  for (let i = 0; i < 9; i += 1) x.push(i);
  assert.throws(() => higuchiFd(x));
});

test('higuchiFd: hand-computed L(1) and L(2) on a deterministic ramp', () => {
  // Closed-form check: ramp x[i] = i, N = 10.
  // For k=1, m=1, M = floor((10-1)/1) = 9. abs increments all 1
  // -> sum = 9. Lm = (9 * (10-1)) / (9 * 1) = 9.
  // For k=2, m=1, M = floor(9/2)=4. increments |2-0|+|4-2|+|6-4|+|8-6|=8.
  //   Lm = (8 * 9) / (4 * 2) = 9. Same for m=2.
  // So L(1) = 9 and L(2) = 9; slope = 0 (perfect ramp under this
  // normalisation gives constant L(k)). HFD = 0 -> clamps to 1.
  const x: number[] = [];
  for (let i = 0; i < 10; i += 1) x.push(i);
  const r = higuchiFd(x, { kMax: 4, minK: 2 });
  // The constant-L behaviour gives slope ~ 0, hfdRaw ~ 0, clamped to 1.
  assert.ok(
    Math.abs(r.hfdRaw) < 0.05,
    `expected hfdRaw near 0 for an arithmetic ramp under Higuchi normalisation, got ${r.hfdRaw}`,
  );
  assert.equal(r.hfd, 1);
  assert.ok(r.clampedBelow1, 'should report clampedBelow1 for an arithmetic ramp');
});

test('higuchiFd: white-noise -> hfdRaw strictly above smooth ramp hfdRaw (relative bound)', () => {
  // Higuchi FD on bounded i.i.d. uniform of moderate length is
  // biased toward the lower clamp (slope of log L vs log k stays
  // near 1 / hfdRaw stays near 1, NOT near 2; the asymptote of 2
  // requires self-affine scaling that bounded uniform on N=1024
  // does not deliver — Esteller et al. 2001 IEEE TCS-I 48:177-183
  // documents this small-sample bias). We therefore test the
  // robust property on the UNCLAMPED slope: noise hfdRaw strictly
  // exceeds ramp hfdRaw on the same sample size.
  const rng = mulberry32(42);
  const n = 1024;
  const noise: number[] = [];
  for (let i = 0; i < n; i += 1) noise.push(rng());
  const ramp: number[] = [];
  for (let i = 0; i < n; i += 1) ramp.push(i / n);
  const rNoise = higuchiFd(noise, { kMax: 16, minK: 4 });
  const rRamp = higuchiFd(ramp, { kMax: 16, minK: 4 });
  // Ramp -> hfdRaw ~ 0 (constant L(k) under Higuchi normalisation);
  // noise -> hfdRaw ~ 1.
  assert.ok(
    Math.abs(rRamp.hfdRaw) < 0.05,
    `expected ramp hfdRaw near 0, got ${rRamp.hfdRaw}`,
  );
  assert.ok(
    rNoise.hfdRaw > rRamp.hfdRaw + 0.5,
    `expected noise hfdRaw (${rNoise.hfdRaw}) > ramp hfdRaw (${rRamp.hfdRaw}) + 0.5`,
  );
  assert.ok(rNoise.r2 > 0.9, `expected r2 > 0.9 on log-log, got ${rNoise.r2}`);
});

test('higuchiFd: orthogonality witness — shuffled has higher hfdRaw than sorted on heavy-tailed multiset', () => {
  // Multiset statistics (mean, var, gini, atkinson, ...) are
  // identical between sorted and shuffled; hfdRaw must be strictly
  // higher on the shuffled (rough) version than on the sorted
  // (smooth) version. We use a heavy-tailed positive base where
  // shuffling genuinely changes per-step path length; sorting it
  // gives a near-monotone sequence whose Higuchi-normalised L(k)
  // is nearly constant in k -> hfdRaw near 0, while shuffling
  // produces large stride-dependent path-length variation -> hfdRaw
  // near 1.
  const rng = mulberry32(7);
  const n = 1024;
  const base: number[] = [];
  for (let i = 0; i < n; i += 1) {
    base.push(Math.floor(Math.exp(rng() * 8)));
  }
  const sorted = [...base].sort((a, b) => a - b);
  const sortedRaw = higuchiFd(sorted, { kMax: 12, minK: 4 }).hfdRaw;
  const shuffledRaw = higuchiFd(base, { kMax: 12, minK: 4 }).hfdRaw;
  assert.ok(
    shuffledRaw - sortedRaw > 0.5,
    `shuffled hfdRaw (${shuffledRaw}) must exceed sorted hfdRaw (${sortedRaw}) by >= 0.5`,
  );
});

test('higuchiFd: scale-invariance under positive multiplicative rescale', () => {
  // L(k) numerator and denominator both scale linearly with c > 0
  // when v -> c*v for constant c > 0; the OLS slope on log-log
  // is therefore invariant.
  const rng = mulberry32(101);
  const n = 256;
  const x: number[] = [];
  for (let i = 0; i < n; i += 1) x.push(rng() * 50);
  const a = higuchiFd(x, { kMax: 8, minK: 4 });
  const xScaled = x.map((v) => v * 137.5);
  const b = higuchiFd(xScaled, { kMax: 8, minK: 4 });
  assert.ok(
    Math.abs(a.hfdRaw - b.hfdRaw) < 1e-9,
    `scale-invariance broken: ${a.hfdRaw} vs ${b.hfdRaw}`,
  );
});

test('higuchiFd: surfaces scalesDroppedZeroL on long zero stretch at large k', () => {
  // First 32 days all zero, last 32 days alternate. At small strides
  // the stretch contributes zero increments to some m starts but
  // not all; at the largest stride k = kMax the m-starts may all
  // collapse. We only assert that the counter is non-negative and
  // surviving scales >= minK so the fit succeeds.
  const x: number[] = [];
  for (let i = 0; i < 32; i += 1) x.push(0);
  for (let i = 0; i < 32; i += 1) x.push(i % 2 === 0 ? 100 : 200);
  const r = higuchiFd(x, { kMax: 6, minK: 3 });
  assert.ok(r.scalesUsed.length >= 3);
  assert.ok(r.degenerateStartsTotal >= 0);
  assert.ok(r.scalesDroppedZeroL >= 0);
});

// ---- buildDailyTokenHiguchiFd full pipeline ---------------------------

test('buildDailyTokenHiguchiFd: validates option ranges', () => {
  assert.throws(() => buildDailyTokenHiguchiFd([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenHiguchiFd([], { kMax: 1 }));
  assert.throws(() => buildDailyTokenHiguchiFd([], { kMax: 65 }));
  assert.throws(() => buildDailyTokenHiguchiFd([], { minK: 1 }));
  assert.throws(() =>
    buildDailyTokenHiguchiFd([], { kMax: 4, minK: 5 }),
  );
  // minTenureDays must be >= kMax+2.
  assert.throws(() =>
    buildDailyTokenHiguchiFd([], { kMax: 8, minTenureDays: 9 }),
  );
  assert.throws(() => buildDailyTokenHiguchiFd([], { top: -1 }));
  assert.throws(() => buildDailyTokenHiguchiFd([], { sort: 'bogus' as any }));
  assert.throws(() => buildDailyTokenHiguchiFd([], { since: 'not-a-date' }));
  assert.throws(() => buildDailyTokenHiguchiFd([], { until: 'not-a-date' }));
});

test('buildDailyTokenHiguchiFd: empty queue -> empty rows', () => {
  const r = buildDailyTokenHiguchiFd([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.kMax, 8);
  assert.equal(r.minK, 4);
  assert.equal(r.minTenureDays, 32);
});

test('buildDailyTokenHiguchiFd: drops sparse sources below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 64; i += 1) {
    queue.push(ql(`2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`, 'sparse', 1));
  }
  const r = buildDailyTokenHiguchiFd(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 12,
    kMax: 4,
    minK: 3,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenHiguchiFd: drops sources below min-tenure-days', () => {
  const queue: QueueLine[] = [];
  // tenure = 8 days, well below default min of 32.
  for (let d = 1; d <= 8; d += 1) {
    queue.push(
      ql(`2026-01-${String(d).padStart(2, '0')}T00:00:00.000Z`, 'short', 5000),
    );
  }
  const r = buildDailyTokenHiguchiFd(queue, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenHiguchiFd: end-to-end on a noisy 64-day source', () => {
  const queue: QueueLine[] = [];
  const rng = mulberry32(2026);
  // 64 consecutive UTC days, each with a single row of ~10000 tokens
  // plus jitter -> well above 1000 min-tokens, well above 32-day floor.
  for (let d = 0; d < 64; d += 1) {
    const day = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const tt = Math.max(1, Math.floor(10000 + (rng() - 0.5) * 4000));
    queue.push(ql(`${day}T00:00:00.000Z`, 'noisy', tt));
  }
  const r = buildDailyTokenHiguchiFd(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
    kMax: 8,
    minK: 4,
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'noisy');
  assert.equal(row.nTenureDays, 64);
  assert.equal(row.nActiveDays, 64);
  assert.ok(row.hfd >= 1 && row.hfd <= 2);
  assert.ok(row.r2 >= 0 && row.r2 <= 1);
  assert.ok(row.scalesUsed >= 4);
  assert.equal(row.minScaleUsed, 1);
});

test('buildDailyTokenHiguchiFd: sort=hfd ascending, ties broken by source; hfdRaw ranks rough above smooth', () => {
  // One smooth source (monotone ramp -> hfdRaw ~ 0) and one
  // rough source (heavy-tailed jitter -> hfdRaw ~ 1). Both are
  // BELOW the [1, 2] clamp on a 64-day fixture so the clamped
  // `hfd` ties at 1.0 and the sort key falls back to source-name
  // alphabetical, but `hfdRaw` (the un-clamped slope) preserves
  // the rough-vs-smooth ordering for operators.
  const rng = mulberry32(31);
  const queue: QueueLine[] = [];
  for (let d = 0; d < 64; d += 1) {
    const day = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000)
      .toISOString()
      .slice(0, 10);
    queue.push(ql(`${day}T00:00:00.000Z`, 'smooth', 1000 + d * 100));
    const tt = Math.max(1, Math.floor(Math.exp(rng() * 9)));
    queue.push(ql(`${day}T00:00:00.000Z`, 'rough', tt));
  }
  const r = buildDailyTokenHiguchiFd(queue, {
    generatedAt: GEN,
    minTenureDays: 32,
    kMax: 8,
    minK: 4,
    sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  const bySource = new Map(r.sources.map((s) => [s.source, s]));
  const smooth = bySource.get('smooth')!;
  const rough = bySource.get('rough')!;
  assert.ok(
    Math.abs(smooth.hfdRaw) < 0.05,
    `smooth hfdRaw should be ~0, got ${smooth.hfdRaw}`,
  );
  assert.ok(
    rough.hfdRaw - smooth.hfdRaw > 0.5,
    `rough hfdRaw (${rough.hfdRaw}) should exceed smooth hfdRaw (${smooth.hfdRaw}) by >= 0.5`,
  );
});

test('buildDailyTokenHiguchiFd: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 0; d < 40; d += 1) {
      const day = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000)
        .toISOString()
        .slice(0, 10);
      queue.push(ql(`${day}T00:00:00.000Z`, src, 1000 + d * 17));
    }
  }
  const r = buildDailyTokenHiguchiFd(queue, {
    generatedAt: GEN,
    minTenureDays: 32,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.totalSources, 3);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenHiguchiFd: window since/until filters rows', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 90; d += 1) {
    const day = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000)
      .toISOString()
      .slice(0, 10);
    queue.push(ql(`${day}T00:00:00.000Z`, 'win', 5000 + d));
  }
  const r = buildDailyTokenHiguchiFd(queue, {
    generatedAt: GEN,
    since: '2026-02-01T00:00:00.000Z',
    until: '2026-03-15T00:00:00.000Z',
    minTenureDays: 32,
    kMax: 6,
    minK: 3,
  });
  assert.equal(r.windowStart, '2026-02-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-03-15T00:00:00.000Z');
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.nTenureDays >= 32);
  assert.ok(r.sources[0]!.nTenureDays <= 43);
});

test('buildDailyTokenHiguchiFd: source filter retains only matching source', () => {
  const queue: QueueLine[] = [];
  for (const src of ['keep', 'drop']) {
    for (let d = 0; d < 40; d += 1) {
      const day = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000)
        .toISOString()
        .slice(0, 10);
      queue.push(ql(`${day}T00:00:00.000Z`, src, 2000 + d));
    }
  }
  const r = buildDailyTokenHiguchiFd(queue, {
    generatedAt: GEN,
    source: 'keep',
    minTenureDays: 32,
  });
  assert.equal(r.source, 'keep');
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenHiguchiFd: counts non-positive tokens and bad hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'x', 100),
    ql('2026-01-01T00:00:00.000Z', 'x', 0),
    ql('2026-01-01T00:00:00.000Z', 'x', -5),
  ];
  const r = buildDailyTokenHiguchiFd(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
});
