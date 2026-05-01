import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenHjorthMobility,
  hjorthMobility,
} from '../src/dailytokenhjorthmobility.js';
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

function dayN(n: number): string {
  // n=0 -> 2026-01-01
  const ms = Date.parse('2026-01-01T00:00:00.000Z') + n * 86_400_000;
  return new Date(ms).toISOString();
}

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

// ---- hjorthMobility primitive --------------------------------------

test('hjorthMobility: rejects non-finite values', () => {
  assert.throws(() => hjorthMobility([1, 2, NaN, 4]));
  assert.throws(() => hjorthMobility([1, 2, Infinity, 4]));
  assert.throws(() => hjorthMobility([1, -Infinity, 3]));
});

test('hjorthMobility: rejects too-short series (n < 3)', () => {
  assert.throws(() => hjorthMobility([]));
  assert.throws(() => hjorthMobility([1]));
  assert.throws(() => hjorthMobility([1, 2]));
});

test('hjorthMobility: rejects zero variance (constant series)', () => {
  assert.throws(() => hjorthMobility([7, 7, 7, 7, 7]));
});

test('hjorthMobility: monotone ramp -> small mobility', () => {
  // Ramp y[i] = i: var(y) = (N^2 - 1) / 12 (population). diff = 1
  // for all i: var(diff) = 0. mobility = 0.
  const N = 50;
  const v = Array.from({ length: N }, (_, i) => i);
  const r = hjorthMobility(v);
  assert.equal(r.varDv, 0);
  assert.equal(r.mobility, 0);
});

test('hjorthMobility: closed-form match on small hand-checked series', () => {
  // [0, 1, 0, 1, 0]: mean = 0.4, deviations = [-.4, .6, -.4, .6, -.4]
  // var_v (pop) = (.16 + .36 + .16 + .36 + .16) / 5 = 1.2 / 5 = 0.24
  // diffs = [1, -1, 1, -1], mean_dv = 0
  // var_dv (pop, M=4) = (1+1+1+1)/4 = 1
  // mobility = sqrt(1 / 0.24) = sqrt(25/6) ~ 2.04124
  const r = hjorthMobility([0, 1, 0, 1, 0]);
  assert.ok(Math.abs(r.varV - 0.24) < 1e-12);
  assert.ok(Math.abs(r.varDv - 1) < 1e-12);
  const expected = Math.sqrt(1 / 0.24);
  assert.ok(Math.abs(r.mobility - expected) < 1e-12);
});

test('hjorthMobility: scale-invariant (multiply by k > 0)', () => {
  const v = [1, 4, 2, 7, 3, 9, 1, 8, 2];
  const a = hjorthMobility(v);
  const b = hjorthMobility(v.map((x) => 17 * x));
  assert.ok(Math.abs(a.mobility - b.mobility) < 1e-12);
  // var scales by 17^2; ratio survives but absolute variances scale.
  assert.ok(Math.abs(b.varV - 17 * 17 * a.varV) < 1e-9);
});

test('hjorthMobility: shift-invariant (add constant)', () => {
  const v = [1, 4, 2, 7, 3, 9, 1, 8, 2];
  const a = hjorthMobility(v);
  const b = hjorthMobility(v.map((x) => x + 1000));
  assert.ok(Math.abs(a.mobility - b.mobility) < 1e-12);
  assert.ok(Math.abs(a.varV - b.varV) < 1e-9);
});

test('hjorthMobility: sign-flip-invariant', () => {
  const v = [1, 4, 2, 7, 3, 9, 1, 8, 2];
  const a = hjorthMobility(v);
  const b = hjorthMobility(v.map((x) => -x));
  assert.ok(Math.abs(a.mobility - b.mobility) < 1e-12);
});

test('hjorthMobility: time-reversal invariant', () => {
  const v = [1, 4, 2, 7, 3, 9, 1, 8, 2, 5, 6];
  const a = hjorthMobility(v);
  const b = hjorthMobility([...v].reverse());
  // Population variances of y and reverse(y) are identical;
  // diff(reverse(y))[i] = -diff(y)[N-2-i], so var_dv is identical.
  assert.ok(Math.abs(a.mobility - b.mobility) < 1e-12);
});

test('hjorthMobility: white-noise mobility approaches sqrt(2) for large N', () => {
  const rng = mulberry32(424242);
  const N = 5000;
  const v = Array.from({ length: N }, () => rng());
  const r = hjorthMobility(v);
  // Theoretical: for iid samples, E[var_dv] = 2 * E[var_v]; mobility -> sqrt(2).
  assert.ok(
    Math.abs(r.mobility - Math.SQRT2) < 0.05,
    `mobility=${r.mobility} not within 0.05 of sqrt(2)`,
  );
});

test('hjorthMobility: shuffleInflatesMobility witness', () => {
  // Slowly varying series: a sinusoid with period >> 1.
  // sorted-in-time mobility << shuffled mobility.
  const N = 200;
  const sorted = Array.from({ length: N }, (_, i) => Math.sin((2 * Math.PI * i) / N));
  const sortedR = hjorthMobility(sorted);
  const rng = mulberry32(99);
  const shuffled = [...sorted];
  for (let i = N - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  const shuffledR = hjorthMobility(shuffled);
  assert.ok(
    shuffledR.mobility >= 1.5 * sortedR.mobility,
    `shuffled mobility ${shuffledR.mobility} not >= 1.5x sorted ${sortedR.mobility}`,
  );
});

test('hjorthMobility: AR(1) link to lag-1 ACF (mobility^2 ~ 2*(1 - rho_1))', () => {
  // Generate AR(1): x[t] = rho * x[t-1] + eps_t. Theoretical mobility:
  //   var_x = sigma_eps^2 / (1 - rho^2)
  //   var_dx = 2 * var_x * (1 - rho)
  //   mobility = sqrt(2 * (1 - rho))
  const rho = 0.7;
  const N = 8000;
  const rng = mulberry32(777);
  const x: number[] = new Array(N);
  x[0] = 0;
  for (let i = 1; i < N; i += 1) {
    // Approx Gaussian via 12-uniform sum - 6 (CLT)
    let g = 0;
    for (let k = 0; k < 12; k += 1) g += rng();
    g -= 6;
    x[i] = rho * x[i - 1]! + g;
  }
  const r = hjorthMobility(x);
  const expected = Math.sqrt(2 * (1 - rho));
  assert.ok(
    Math.abs(r.mobility - expected) < 0.05,
    `mobility=${r.mobility} expected ~${expected.toFixed(4)} for AR(1) rho=${rho}`,
  );
});

// ---- buildDailyTokenHjorthMobility orchestration -------------------

test('buildDailyTokenHjorthMobility: empty queue -> zero rows', () => {
  const r = buildDailyTokenHjorthMobility([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('buildDailyTokenHjorthMobility: drops sparse / short-tenure sources', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'sparse', 100), // below default 1000
    ql('2026-01-01T00:00:00Z', 'short', 50000),
    ql('2026-01-02T00:00:00Z', 'short', 50000), // tenure = 2 < 32
  ];
  const r = buildDailyTokenHjorthMobility(queue, { generatedAt: GEN });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenHjorthMobility: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayN(i), 'flat', 5000));
  }
  const r = buildDailyTokenHjorthMobility(queue, { generatedAt: GEN });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenHjorthMobility: gap-fill + numeric correctness', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 2) {
    queue.push(ql(dayN(i), 'src', 10000));
  }
  const r = buildDailyTokenHjorthMobility(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src');
  assert.equal(row.nTenureDays, 39);
  assert.ok(row.mobility > 1, `expected mobility > 1 for alternating series, got ${row.mobility}`);
});

test('buildDailyTokenHjorthMobility: --source filter restricts and surfaces drops', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(dayN(i), 'a', i % 2 === 0 ? 5000 : 1000));
    queue.push(ql(dayN(i), 'b', 7000));
  }
  const r = buildDailyTokenHjorthMobility(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 40);
});

test('buildDailyTokenHjorthMobility: --top caps and surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 40; i += 1) {
      queue.push(ql(dayN(i), src, 1000 + i * 100 + src.charCodeAt(0)));
    }
  }
  const r = buildDailyTokenHjorthMobility(queue, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenHjorthMobility: input validation', () => {
  assert.throws(() => buildDailyTokenHjorthMobility([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenHjorthMobility([], { minTenureDays: 3 }));
  assert.throws(() => buildDailyTokenHjorthMobility([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenHjorthMobility([], { sort: 'nonsense' as never }),
  );
  assert.throws(() => buildDailyTokenHjorthMobility([], { since: 'bad-date' }));
});

// ---- refinement: extra property tests ------------------------------

test('hjorthMobility: monotone-transform sensitivity witness (sqrt vs identity diverge)', () => {
  // Non-affine monotone transform y' = sqrt(y) reshapes both
  // variances differently and so produces a different mobility.
  // This documents that mobility is NOT a rank statistic.
  const N = 200;
  const v = Array.from({ length: N }, (_, i) => (i + 1) ** 2); // 1, 4, 9, ...
  const a = hjorthMobility(v);
  const b = hjorthMobility(v.map((x) => Math.sqrt(x))); // -> 1, 2, 3, ...
  // Pure ramps -> both have var_dv = 0 in the limit, but the
  // sqrt-transformed series is exactly a ramp (mobility = 0)
  // while the squared series has growing diffs (var_dv > 0).
  assert.equal(b.mobility, 0);
  assert.ok(a.mobility > 0, `expected nonzero mobility on x^2 ramp, got ${a.mobility}`);
  assert.ok(
    Math.abs(a.mobility - b.mobility) > 1e-3,
    `mobilities should diverge under non-affine transform, got a=${a.mobility} b=${b.mobility}`,
  );
});

test('hjorthMobility: outlier-amplification witness (one big spike sharply increases mobility)', () => {
  // Two series with identical mean and identical max-min range
  // but different outlier structure. Mobility should react more
  // strongly to the concentrated spike than to the smooth ramp.
  const N = 100;
  const ramp = Array.from({ length: N }, (_, i) => i / (N - 1));
  const spike = Array.from({ length: N }, () => 0);
  spike[Math.floor(N / 2)] = 1; // single delta in middle
  const a = hjorthMobility(ramp);
  const b = hjorthMobility(spike);
  // Spike series has huge var_dv vs var_v; ramp has tiny var_dv.
  assert.ok(
    b.mobility > 5 * a.mobility,
    `spike mobility ${b.mobility} should be >> ramp mobility ${a.mobility}`,
  );
});

test('hjorthMobility: numerical stability on large-magnitude series (1e12)', () => {
  // Real token series can hit 1e8+ per day; a Hjorth mobility
  // computed without care can lose precision via catastrophic
  // cancellation in the population variance. Verify stability.
  const N = 200;
  const rng = mulberry32(13);
  const small = Array.from({ length: N }, () => rng());
  const large = small.map((x) => x * 1e12);
  const a = hjorthMobility(small);
  const b = hjorthMobility(large);
  assert.ok(
    Math.abs(a.mobility - b.mobility) < 1e-6,
    `mobility should be invariant under 1e12 scale, got delta=${a.mobility - b.mobility}`,
  );
});

test('buildDailyTokenHjorthMobility: --sort source orders alphabetically', () => {
  const queue: QueueLine[] = [];
  for (const src of ['zebra', 'apple', 'mango']) {
    for (let i = 0; i < 40; i += 1) {
      queue.push(ql(dayN(i), src, 1000 + i * 100 + src.charCodeAt(0)));
    }
  }
  const r = buildDailyTokenHjorthMobility(queue, { generatedAt: GEN, sort: 'source' });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['apple', 'mango', 'zebra'],
  );
});
