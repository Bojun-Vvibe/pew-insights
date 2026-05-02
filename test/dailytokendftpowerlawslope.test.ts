import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyTokenDftPowerLawSlope,
  dailyTokenDftPowerLawSlope,
  olsSlope,
} from '../src/dailytokendftpowerlawslope.js';
import type { QueueLine } from '../src/types.js';

const GEN = '2025-01-01T00:00:00.000Z';

function row(day: string, source: string, total_tokens: number): QueueLine {
  return {
    hour_start: `${day}T00:00:00.000Z`,
    source,
    total_tokens,
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    requests: 1,
    bucket: 'b',
    project_ref: null,
    file_offset: 0,
    file_size: 0,
  } as unknown as QueueLine;
}

function buildSeries(values: number[], source = 'src-a'): QueueLine[] {
  const out: QueueLine[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const ms = Date.parse('2024-01-01T00:00:00.000Z') + i * 86_400_000;
    const day = new Date(ms).toISOString().slice(0, 10);
    if (values[i]! > 0) out.push(row(day, source, values[i]!));
  }
  return out;
}

// ---- olsSlope primitive ------------------------------------------------

test('olsSlope: length mismatch -> throws', () => {
  assert.throws(() => olsSlope([1, 2], [1]));
});

test('olsSlope: single sample -> throws', () => {
  assert.throws(() => olsSlope([1], [1]));
});

test('olsSlope: non-finite x -> throws', () => {
  assert.throws(() => olsSlope([1, NaN], [1, 2]));
});

test('olsSlope: non-finite y -> throws', () => {
  assert.throws(() => olsSlope([1, 2], [1, Infinity]));
});

test('olsSlope: zero variance in x -> throws', () => {
  assert.throws(() => olsSlope([2, 2, 2], [1, 2, 3]));
});

test('olsSlope: perfect line y = 3 + 2x', () => {
  const fit = olsSlope([0, 1, 2, 3, 4], [3, 5, 7, 9, 11]);
  assert.ok(Math.abs(fit.slope - 2) < 1e-12);
  assert.ok(Math.abs(fit.intercept - 3) < 1e-12);
  assert.ok(Math.abs(fit.rSquared - 1) < 1e-12);
});

test('olsSlope: perfect line y = -1 - 0.5x (negative slope)', () => {
  const fit = olsSlope([0, 2, 4, 6], [-1, -2, -3, -4]);
  assert.ok(Math.abs(fit.slope - -0.5) < 1e-12);
  assert.ok(Math.abs(fit.intercept - -1) < 1e-12);
  assert.ok(Math.abs(fit.rSquared - 1) < 1e-12);
});

test('olsSlope: horizontal y=const -> slope 0, R^2 = 1', () => {
  const fit = olsSlope([0, 1, 2, 3], [5, 5, 5, 5]);
  assert.equal(fit.slope, 0);
  assert.ok(Math.abs(fit.intercept - 5) < 1e-12);
  assert.equal(fit.rSquared, 1);
});

test('olsSlope: noisy fit -> R^2 in (0, 1)', () => {
  const fit = olsSlope([0, 1, 2, 3, 4], [0, 1, 2.5, 2.5, 4]);
  assert.ok(fit.rSquared > 0.9);
  assert.ok(fit.rSquared < 1);
});

// ---- dailyTokenDftPowerLawSlope primitive -----------------------------

test('dailyTokenDftPowerLawSlope: too short -> throws', () => {
  assert.throws(() => dailyTokenDftPowerLawSlope([1, 2, 3, 4, 5, 6, 7]));
});

test('dailyTokenDftPowerLawSlope: non-finite -> throws', () => {
  assert.throws(() =>
    dailyTokenDftPowerLawSlope([1, 2, NaN, 4, 5, 6, 7, 8]),
  );
});

test('dailyTokenDftPowerLawSlope: constant series -> throws zero variance', () => {
  assert.throws(() =>
    dailyTokenDftPowerLawSlope([5, 5, 5, 5, 5, 5, 5, 5]),
  );
});

test('dailyTokenDftPowerLawSlope: random walk -> beta close to 2 (red)', () => {
  // Deterministic random walk; deltas alternate +1/-1 with occasional bigger jumps
  // to get a roughly Brownian profile. The exact beta depends on n; check >= 1.
  const n = 64;
  const deltas = [
    1, -1, 1, 1, -1, 1, -1, -1, 1, 1, 1, -1, -1, 1, -1, 1,
    1, -1, 1, 1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1, 1, 1,
    -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1,
    -1, 1, -1, 1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1, -1, -1,
  ];
  let acc = 100;
  const series = deltas.map((d) => (acc += d));
  const r = dailyTokenDftPowerLawSlope(series);
  assert.ok(r.beta > 1, `expected beta > 1 for random walk, got ${r.beta}`);
  assert.ok(r.usableBins >= 2);
  assert.ok(r.rSquared >= 0 && r.rSquared <= 1);
});

test('dailyTokenDftPowerLawSlope: pure sinusoid -> finite beta + low R^2', () => {
  // A pure sinusoid has all power in one Fourier bin; the OLS fit on
  // log10(P) vs log10(k) is dominated by the leak floor and one peak,
  // so R^2 is small and beta is finite but not interpretable as
  // a colour exponent. We only assert finiteness here.
  const n = 32;
  const series: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    series[i] = 10 + 5 * Math.sin((2 * Math.PI * i * 3) / n);
  }
  const r = dailyTokenDftPowerLawSlope(series);
  assert.ok(Number.isFinite(r.beta));
  assert.ok(r.rSquared < 0.5);
});

test('dailyTokenDftPowerLawSlope: shift-invariance', () => {
  const series = [
    1, 4, 2, 7, 3, 5, 8, 1, 4, 2, 9, 6, 3, 5, 1, 7,
    8, 2, 4, 6, 3, 1, 9, 5, 7, 2, 4, 8, 1, 6, 3, 5,
  ];
  const r1 = dailyTokenDftPowerLawSlope(series);
  const r2 = dailyTokenDftPowerLawSlope(series.map((v) => v + 1000));
  assert.ok(Math.abs(r1.beta - r2.beta) < 1e-9);
  assert.ok(Math.abs(r1.rSquared - r2.rSquared) < 1e-9);
});

test('dailyTokenDftPowerLawSlope: scale-invariance for k > 0', () => {
  const series = [
    1, 4, 2, 7, 3, 5, 8, 1, 4, 2, 9, 6, 3, 5, 1, 7,
    8, 2, 4, 6, 3, 1, 9, 5, 7, 2, 4, 8, 1, 6, 3, 5,
  ];
  const r1 = dailyTokenDftPowerLawSlope(series);
  const r2 = dailyTokenDftPowerLawSlope(series.map((v) => v * 17));
  assert.ok(Math.abs(r1.beta - r2.beta) < 1e-9);
  assert.ok(Math.abs(r1.rSquared - r2.rSquared) < 1e-9);
});

test('dailyTokenDftPowerLawSlope: sign-flip invariance (|.|^2 is sign-blind)', () => {
  const series = [
    1, 4, 2, 7, 3, 5, 8, 1, 4, 2, 9, 6, 3, 5, 1, 7,
  ];
  const r1 = dailyTokenDftPowerLawSlope(series);
  const r2 = dailyTokenDftPowerLawSlope(series.map((v) => -v));
  assert.ok(Math.abs(r1.beta - r2.beta) < 1e-9);
  assert.ok(Math.abs(r1.rSquared - r2.rSquared) < 1e-9);
});

test('dailyTokenDftPowerLawSlope: time-reversal invariance', () => {
  const series = [
    1, 4, 2, 7, 3, 5, 8, 1, 4, 2, 9, 6, 3, 5, 1, 7,
  ];
  const r1 = dailyTokenDftPowerLawSlope(series);
  const r2 = dailyTokenDftPowerLawSlope([...series].reverse());
  assert.ok(Math.abs(r1.beta - r2.beta) < 1e-9);
  assert.ok(Math.abs(r1.rSquared - r2.rSquared) < 1e-9);
});

test('dailyTokenDftPowerLawSlope: shuffle SENSITIVITY (whitens spectrum)', () => {
  // A monotone ramp has strong low-frequency mass and a positive
  // beta. A non-symmetric deterministic permutation (reverse the
  // first half only) breaks the monotone trend and changes beta.
  const n = 64;
  const ramp: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) ramp[i] = i + 1;
  const r1 = dailyTokenDftPowerLawSlope(ramp);
  const sh = [...ramp];
  // Reverse the first half only -> not a symmetry of the periodogram.
  const half = Math.floor(n / 2);
  for (let i = 0, j = half - 1; i < j; i += 1, j -= 1) {
    const t = sh[i]!;
    sh[i] = sh[j]!;
    sh[j] = t;
  }
  const r2 = dailyTokenDftPowerLawSlope(sh);
  assert.ok(
    Math.abs(r1.beta - r2.beta) > 1e-6,
    `expected shuffle to change beta; r1=${r1.beta}, r2=${r2.beta}`,
  );
});

test('dailyTokenDftPowerLawSlope: usableBins <= nFreqBins = floor(n/2)', () => {
  const n = 30;
  const series: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) series[i] = (i * 7 + 3) % 11;
  const r = dailyTokenDftPowerLawSlope(series);
  assert.equal(r.nFreqBins, Math.floor(n / 2));
  assert.ok(r.usableBins <= r.nFreqBins);
  assert.ok(r.usableBins >= 2);
});

test('dailyTokenDftPowerLawSlope: mean and stddev match the input', () => {
  const series = [10, 20, 30, 40, 50, 60, 70, 80];
  const r = dailyTokenDftPowerLawSlope(series);
  assert.ok(Math.abs(r.mean - 45) < 1e-9);
  // population stddev of [10,20,..,80] = sqrt(525) ~= 22.9128784...
  assert.ok(Math.abs(r.stddev - Math.sqrt(525)) < 1e-9);
});

// ---- buildDailyTokenDftPowerLawSlope -----------------------------------

test('buildDailyTokenDftPowerLawSlope: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenDftPowerLawSlope([], { minTokens: -1 }),
  );
});

test('buildDailyTokenDftPowerLawSlope: rejects minTenureDays below 8', () => {
  assert.throws(() =>
    buildDailyTokenDftPowerLawSlope([], { minTenureDays: 7 }),
  );
});

test('buildDailyTokenDftPowerLawSlope: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenDftPowerLawSlope([], {
      sort: 'nope' as unknown as 'beta',
    }),
  );
});

test('buildDailyTokenDftPowerLawSlope: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenDftPowerLawSlope([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildDailyTokenDftPowerLawSlope([], { until: 'also-bad' }),
  );
});

test('buildDailyTokenDftPowerLawSlope: empty queue -> empty report', () => {
  const r = buildDailyTokenDftPowerLawSlope([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.minTenureDays, 32);
  assert.equal(r.sort, 'betaDesc');
});

test('buildDailyTokenDftPowerLawSlope: drops below min-tokens', () => {
  const queue = buildSeries([100, 200, 300, 400, 500, 600, 700, 800]);
  const r = buildDailyTokenDftPowerLawSlope(queue, {
    generatedAt: GEN,
    minTenureDays: 8,
    minTokens: 1_000_000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenDftPowerLawSlope: drops below min-tenure', () => {
  // Tenure = 8 days; default min-tenure = 32
  const queue = buildSeries([100, 200, 300, 400, 500, 600, 700, 800]);
  const r = buildDailyTokenDftPowerLawSlope(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenDftPowerLawSlope: bad hour_start counted', () => {
  const q = [
    {
      hour_start: 'not-a-date',
      source: 'a',
      total_tokens: 100,
    } as unknown as QueueLine,
  ];
  const r = buildDailyTokenDftPowerLawSlope(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenDftPowerLawSlope: non-positive tokens dropped', () => {
  const q = [
    row('2024-01-01', 'a', 0),
    row('2024-01-02', 'a', -5),
    row('2024-01-03', 'a', 100),
  ];
  const r = buildDailyTokenDftPowerLawSlope(q, { generatedAt: GEN });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenDftPowerLawSlope: source filter counted', () => {
  const queue = [
    ...buildSeries([100, 200, 300, 400, 500, 600, 700, 800], 'wanted'),
    ...buildSeries([10, 20, 30, 40, 50, 60, 70, 80], 'other'),
  ];
  const r = buildDailyTokenDftPowerLawSlope(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minTenureDays: 8,
    source: 'wanted',
  });
  assert.equal(r.droppedSourceFilter, 8);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'wanted');
});

test('buildDailyTokenDftPowerLawSlope: zero-variance after gap-fill counted', () => {
  // First and last day same value, middle filled with 0 -> not constant,
  // so we need to construct a literally constant series. Place identical
  // tokens on every day of an 8-day tenure.
  const queue: QueueLine[] = [];
  for (let i = 0; i < 8; i += 1) {
    const ms = Date.parse('2024-01-01T00:00:00.000Z') + i * 86_400_000;
    const day = new Date(ms).toISOString().slice(0, 10);
    queue.push(row(day, 'flat', 100));
  }
  const r = buildDailyTokenDftPowerLawSlope(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minTenureDays: 8,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenDftPowerLawSlope: top cap surfaces droppedTopSources', () => {
  const queue = [
    ...buildSeries(
      Array.from({ length: 40 }, (_, i) => 100 + (i % 7) * 10),
      'a',
    ),
    ...buildSeries(
      Array.from({ length: 40 }, (_, i) => 100 + (i % 5) * 20),
      'b',
    ),
    ...buildSeries(
      Array.from({ length: 40 }, (_, i) => 100 + (i % 3) * 30),
      'c',
    ),
  ];
  const r = buildDailyTokenDftPowerLawSlope(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minTenureDays: 8,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('buildDailyTokenDftPowerLawSlope: source-asc tiebreak when no sort signal', () => {
  const queue = [
    ...buildSeries(
      Array.from({ length: 40 }, (_, i) => 100 + (i % 7) * 10),
      'b',
    ),
    ...buildSeries(
      Array.from({ length: 40 }, (_, i) => 100 + (i % 7) * 10),
      'a',
    ),
  ];
  const r = buildDailyTokenDftPowerLawSlope(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minTenureDays: 8,
    sort: 'source',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('buildDailyTokenDftPowerLawSlope: window filter via since/until', () => {
  const queue = buildSeries(
    Array.from({ length: 40 }, (_, i) => 100 + i),
    'a',
  );
  const r = buildDailyTokenDftPowerLawSlope(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minTenureDays: 8,
    since: '2024-01-10T00:00:00.000Z',
    until: '2024-02-05T00:00:00.000Z',
  });
  assert.equal(r.windowStart, '2024-01-10T00:00:00.000Z');
  assert.equal(r.windowEnd, '2024-02-05T00:00:00.000Z');
  assert.ok(r.sources.length === 0 || r.sources[0]!.nTenureDays <= 26);
});

test('buildDailyTokenDftPowerLawSlope: per-source row JSON contract', () => {
  const queue = buildSeries(
    Array.from({ length: 40 }, (_, i) => 100 + i * 7 + (i % 3) * 50),
    'a',
  );
  const r = buildDailyTokenDftPowerLawSlope(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minTenureDays: 8,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(typeof s.source, 'string');
  assert.equal(typeof s.totalTokens, 'number');
  assert.equal(typeof s.nActiveDays, 'number');
  assert.equal(typeof s.nTenureDays, 'number');
  assert.equal(typeof s.nFreqBins, 'number');
  assert.equal(typeof s.usableBins, 'number');
  assert.equal(typeof s.firstActiveDay, 'string');
  assert.equal(typeof s.lastActiveDay, 'string');
  assert.equal(typeof s.mean, 'number');
  assert.equal(typeof s.stddev, 'number');
  assert.equal(typeof s.beta, 'number');
  assert.equal(typeof s.rSquared, 'number');
  assert.ok(Number.isFinite(s.beta));
  assert.ok(s.rSquared >= 0 && s.rSquared <= 1);
  assert.ok(s.nFreqBins === Math.floor(s.nTenureDays / 2));
});

test('buildDailyTokenDftPowerLawSlope: report-level JSON contract', () => {
  const r = buildDailyTokenDftPowerLawSlope([], { generatedAt: GEN });
  assert.equal(typeof r.generatedAt, 'string');
  assert.equal(typeof r.minTokens, 'number');
  assert.equal(typeof r.minTenureDays, 'number');
  assert.equal(typeof r.top, 'number');
  assert.equal(typeof r.sort, 'string');
  assert.equal(typeof r.totalTokens, 'number');
  assert.equal(typeof r.totalSources, 'number');
  assert.equal(typeof r.droppedInvalidHourStart, 'number');
  assert.equal(typeof r.droppedNonPositiveTokens, 'number');
  assert.equal(typeof r.droppedSourceFilter, 'number');
  assert.equal(typeof r.droppedSparseSources, 'number');
  assert.equal(typeof r.droppedBelowMinTenure, 'number');
  assert.equal(typeof r.droppedZeroVariance, 'number');
  assert.equal(typeof r.droppedTooFewUsableBins, 'number');
  assert.equal(typeof r.droppedNonFiniteFit, 'number');
  assert.equal(typeof r.droppedTopSources, 'number');
  assert.ok(Array.isArray(r.sources));
});

test('buildDailyTokenDftPowerLawSlope: orthogonality witness vs spectral entropy -- sharp peak has low H but small beta', () => {
  // A pure sinusoid: spectral entropy is near 0 (one bin dominates),
  // but beta is small in magnitude (no log-log slope across bins).
  const n = 32;
  const series: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    series[i] = 100 + 50 * Math.sin((2 * Math.PI * i * 5) / n);
  }
  const r = dailyTokenDftPowerLawSlope(series);
  // We only assert: beta is finite and R^2 is small (the fit is bad
  // because the spectrum is NOT a power law).
  assert.ok(Number.isFinite(r.beta));
  assert.ok(r.rSquared < 0.5);
});

test('buildDailyTokenDftPowerLawSlope: betaDesc (default) puts higher beta first', () => {
  // Series 'a' is a strong drift (high beta); series 'b' is a fast
  // alternation (low / negative beta).
  const drift = Array.from({ length: 40 }, (_, i) => 100 + i * 10);
  const alt = Array.from({ length: 40 }, (_, i) => 100 + (i % 2 === 0 ? 50 : 0));
  const queue = [
    ...buildSeries(drift, 'drift-a'),
    ...buildSeries(alt, 'alt-b'),
  ];
  const r = buildDailyTokenDftPowerLawSlope(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minTenureDays: 8,
    sort: 'betaDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(
    r.sources[0]!.beta >= r.sources[1]!.beta,
    `betaDesc ordering: got ${r.sources[0]!.beta} then ${r.sources[1]!.beta}`,
  );
  assert.equal(r.sources[0]!.source, 'drift-a');
});

test('buildDailyTokenDftPowerLawSlope: rSquaredDesc sort', () => {
  const drift = Array.from({ length: 40 }, (_, i) => 100 + i * 10);
  const noisy = Array.from(
    { length: 40 },
    (_, i) => 100 + ((i * 17 + 3) % 31) * 7,
  );
  const queue = [
    ...buildSeries(drift, 'drift-a'),
    ...buildSeries(noisy, 'noisy-b'),
  ];
  const r = buildDailyTokenDftPowerLawSlope(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minTenureDays: 8,
    sort: 'rSquaredDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.rSquared >= r.sources[1]!.rSquared);
});

// ---- refine: parametric sweep + numerical-stability + closed-form ------

test('refine: olsSlope perfect-power-law recovery sweep over slopes [-3, -2, -1, -0.5, 0, 0.5, 1, 2]', () => {
  // For each target slope s we synthesise y = a + s*x on a uniform
  // x grid and check OLS recovers s exactly within FP noise.
  const slopes = [-3, -2, -1, -0.5, 0, 0.5, 1, 2];
  const x = Array.from({ length: 16 }, (_, i) => i + 1);
  for (const s of slopes) {
    const y = x.map((xi) => 7 + s * xi);
    const fit = olsSlope(x, y);
    assert.ok(
      Math.abs(fit.slope - s) < 1e-10,
      `slope ${s}: recovered ${fit.slope}`,
    );
    assert.ok(
      Math.abs(fit.intercept - 7) < 1e-10,
      `intercept for slope ${s}: recovered ${fit.intercept}`,
    );
    assert.ok(
      Math.abs(fit.rSquared - 1) < 1e-10,
      `R^2 for slope ${s}: recovered ${fit.rSquared}`,
    );
  }
});

test('refine: dailyTokenDftPowerLawSlope numerical stability under 1e9 / 1e-9 scaling', () => {
  // Both the same: stddev rescales by 1e9 and 1e-9 but beta and R^2
  // are scale-invariant for k > 0.
  const base = [
    1, 4, 2, 7, 3, 5, 8, 1, 4, 2, 9, 6, 3, 5, 1, 7,
    8, 2, 4, 6, 3, 1, 9, 5, 7, 2, 4, 8, 1, 6, 3, 5,
  ];
  const r0 = dailyTokenDftPowerLawSlope(base);
  const rBig = dailyTokenDftPowerLawSlope(base.map((v) => v * 1e9));
  const rSmall = dailyTokenDftPowerLawSlope(base.map((v) => v * 1e-9));
  assert.ok(
    Math.abs(r0.beta - rBig.beta) < 1e-7,
    `beta drift under 1e9 scale: ${r0.beta} vs ${rBig.beta}`,
  );
  assert.ok(
    Math.abs(r0.beta - rSmall.beta) < 1e-7,
    `beta drift under 1e-9 scale: ${r0.beta} vs ${rSmall.beta}`,
  );
  assert.ok(Math.abs(r0.rSquared - rBig.rSquared) < 1e-7);
  assert.ok(Math.abs(r0.rSquared - rSmall.rSquared) < 1e-7);
});

test('refine: dailyTokenDftPowerLawSlope drift-vs-alternation contrast (drift > alt)', () => {
  // Pure linear drift concentrates power at the lowest frequencies
  // -> beta should be POSITIVE and large in magnitude.
  // Pure alternation concentrates power at the highest frequency
  // (Nyquist) -> beta should be NEGATIVE.
  const n = 64;
  const drift = Array.from({ length: n }, (_, i) => 100 + i * 5);
  const alt = Array.from({ length: n }, (_, i) =>
    100 + (i % 2 === 0 ? 50 : 0),
  );
  const rDrift = dailyTokenDftPowerLawSlope(drift);
  const rAlt = dailyTokenDftPowerLawSlope(alt);
  assert.ok(
    rDrift.beta > rAlt.beta,
    `drift beta=${rDrift.beta} should exceed alternation beta=${rAlt.beta}`,
  );
  assert.ok(
    rDrift.beta > 0,
    `drift should have positive beta, got ${rDrift.beta}`,
  );
});

test('refine: dailyTokenDftPowerLawSlope n=8 boundary admits the smallest valid input', () => {
  // n=8 is the hard floor; K = floor(8/2) = 4 candidate Fourier bins.
  // A non-constant series with all four bins surviving the > 0 filter
  // must produce a finite beta and R^2 in [0, 1].
  const series = [10, 50, 30, 80, 20, 60, 40, 90];
  const r = dailyTokenDftPowerLawSlope(series);
  assert.equal(r.nFreqBins, 4);
  assert.ok(r.usableBins >= 2);
  assert.ok(Number.isFinite(r.beta));
  assert.ok(r.rSquared >= 0 && r.rSquared <= 1);
});

test('refine: source-asc tiebreak under tokens-sort when totals identical', () => {
  // Two sources with identical 8-day series carry identical totalTokens
  // and identical beta. tokens-sort therefore reduces to source-asc.
  const series = [100, 200, 300, 400, 500, 600, 700, 800];
  const queue = [
    ...buildSeries(series, 'zeta'),
    ...buildSeries(series, 'alpha'),
  ];
  const r = buildDailyTokenDftPowerLawSlope(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minTenureDays: 8,
    sort: 'tokens',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});
