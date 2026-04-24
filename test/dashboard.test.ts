/**
 * Tests for the dashboard composer.
 *
 * The dashboard module is pure composition over already-tested builders
 * (status / anomalies / ratios), so we focus on:
 *   1. Drift math: tokenDriftPct + ratioDriftPctPoints — including the
 *      null cases (warmup, flat, undefined, zero baseline).
 *   2. recentAnomaly / recentRatio selection — particularly that
 *      recentRatio walks back to the most recent day with a defined
 *      baseline rather than blindly grabbing the last element.
 *   3. The OR-merge alerting logic — token-high alone, ratio-high
 *      alone, ratio-low alone, both, neither.
 *   4. inverseLogit numeric guards (extreme |x|) at module boundaries.
 *
 * We construct synthetic AnomaliesReport / RatiosReport / Status
 * fixtures directly rather than driving through the upstream builders,
 * so a regression in anomalies.ts cannot cascade into false dashboard
 * failures and vice versa.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildDashboard } from '../src/dashboard.ts';
import type {
  AnomaliesReport,
  AnomalyDay,
  AnomalyStatus,
} from '../src/anomalies.ts';
import type {
  RatiosReport,
  RatioDay,
  RatioStatus,
} from '../src/ratiosreport.ts';
import type { Status } from '../src/report.ts';

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function mkStatus(overrides: Partial<Status> = {}): Status {
  return {
    pewHome: '/tmp/pew',
    pendingQueueBytes: 0,
    pendingQueueLines: 0,
    queueFileSize: 0,
    queueOffset: 0,
    dirtyKeys: [],
    sessionQueueFileSize: 0,
    sessionQueueOffset: 0,
    pendingSessionQueueBytes: 0,
    lastSuccess: '2026-04-24T00:00:00Z',
    lastSuccessAgeSeconds: 60,
    trailingLockHolder: null,
    trailingLockAlive: null,
    lagFiles: [],
    runsCountApprox: 0,
    ...overrides,
  };
}

function mkAnomalyDay(
  day: string,
  tokens: number,
  baselineMean: number | null,
  baselineStdDev: number | null,
  status: AnomalyStatus,
  z: number | null = null,
): AnomalyDay {
  return { day, tokens, baselineMean, baselineStdDev, z, status };
}

function mkAnomalies(
  series: AnomalyDay[],
  overrides: Partial<AnomaliesReport> = {},
): AnomaliesReport {
  const flagged = series.filter((d) => d.status === 'high' || d.status === 'low');
  const recentHigh =
    series.length > 0 && series[series.length - 1]!.status === 'high';
  return {
    asOf: '2026-04-24T12:00:00Z',
    lookbackDays: 7,
    baselineDays: 7,
    threshold: 2.0,
    series,
    flagged,
    recentHigh,
    ...overrides,
  };
}

function mkRatioDay(
  day: string,
  ratio: number | null,
  ewma: number | null,
  baselineLogitMean: number | null,
  baselineLogitStdDev: number | null,
  status: RatioStatus,
  z: number | null = null,
): RatioDay {
  return {
    day,
    ratio,
    inputTokens: 0,
    cachedInputTokens: 0,
    ewma,
    baselineLogitMean,
    baselineLogitStdDev,
    z,
    status,
  };
}

function mkRatios(
  series: RatioDay[],
  overrides: Partial<RatiosReport> = {},
): RatiosReport {
  const flagged = series.filter((d) => d.status === 'high' || d.status === 'low');
  const last = series[series.length - 1];
  const recentHigh = last?.status === 'high';
  const recentLow = last?.status === 'low';
  // Most recent defined ewma
  let currentEwma: number | null = null;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i]!.ewma != null) {
      currentEwma = series[i]!.ewma;
      break;
    }
  }
  return {
    asOf: '2026-04-24T12:00:00Z',
    lookbackDays: 7,
    alpha: 0.3,
    baselineDays: 7,
    threshold: 2.0,
    eps: 1e-6,
    series,
    flagged,
    recentHigh: !!recentHigh,
    recentLow: !!recentLow,
    currentEwma,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// recentAnomaly / recentRatio selection
// ---------------------------------------------------------------------------

test('recentAnomaly: empty series → null', () => {
  const d = buildDashboard({
    asOf: '2026-04-24T12:00:00Z',
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([]),
  });
  assert.equal(d.recentAnomaly, null);
});

test('recentAnomaly: non-empty → last element', () => {
  const last = mkAnomalyDay('2026-04-24', 1000, 800, 100, 'normal', 2.0);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([
      mkAnomalyDay('2026-04-23', 800, 700, 50, 'normal', 2.0),
      last,
    ]),
    ratios: mkRatios([]),
  });
  assert.equal(d.recentAnomaly, last);
});

test('recentRatio: walks back to most recent day with defined baseline', () => {
  const goodDay = mkRatioDay('2026-04-22', 0.6, 0.55, 0.2, 0.1, 'normal', 1.0);
  const undefinedDay = mkRatioDay('2026-04-23', null, null, null, null, 'undefined');
  const warmupDay = mkRatioDay('2026-04-24', 0.7, 0.65, null, null, 'warmup');
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([goodDay, undefinedDay, warmupDay]),
  });
  // Walks back past warmupDay + undefinedDay to goodDay.
  assert.equal(d.recentRatio, goodDay);
});

test('recentRatio: no day with baseline → falls back to last element', () => {
  const w1 = mkRatioDay('2026-04-23', 0.5, null, null, null, 'warmup');
  const w2 = mkRatioDay('2026-04-24', 0.6, null, null, null, 'warmup');
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([w1, w2]),
  });
  assert.equal(d.recentRatio, w2);
});

test('recentRatio: empty series → null', () => {
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([]),
  });
  assert.equal(d.recentRatio, null);
});

// ---------------------------------------------------------------------------
// tokenDriftPct
// ---------------------------------------------------------------------------

test('tokenDriftPct: normal day → percent change from baseline mean', () => {
  // tokens=1200, baseline=1000 → +20%
  const day = mkAnomalyDay('2026-04-24', 1200, 1000, 100, 'normal', 2.0);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([day]),
    ratios: mkRatios([]),
  });
  assert.equal(d.tokenDriftPct, 20);
});

test('tokenDriftPct: high day → still computes', () => {
  const day = mkAnomalyDay('2026-04-24', 2000, 1000, 100, 'high', 10.0);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([day]),
    ratios: mkRatios([]),
  });
  assert.equal(d.tokenDriftPct, 100);
});

test('tokenDriftPct: low day → negative', () => {
  const day = mkAnomalyDay('2026-04-24', 500, 1000, 100, 'low', -5.0);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([day]),
    ratios: mkRatios([]),
  });
  assert.equal(d.tokenDriftPct, -50);
});

test('tokenDriftPct: flat day → null (no drift defined for flat baseline)', () => {
  const day = mkAnomalyDay('2026-04-24', 1100, 1000, 0, 'flat', null);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([day]),
    ratios: mkRatios([]),
  });
  assert.equal(d.tokenDriftPct, null);
});

test('tokenDriftPct: zero baselineMean → null (avoid div by zero)', () => {
  const day = mkAnomalyDay('2026-04-24', 100, 0, 0, 'normal', 0);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([day]),
    ratios: mkRatios([]),
  });
  assert.equal(d.tokenDriftPct, null);
});

test('tokenDriftPct: empty series → null', () => {
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([]),
  });
  assert.equal(d.tokenDriftPct, null);
});

// ---------------------------------------------------------------------------
// ratioDriftPctPoints
// ---------------------------------------------------------------------------

test('ratioDriftPctPoints: normal day → percentage points (logit baseline → prob)', () => {
  // baselineLogitMean=0 → prob 0.5; ewma=0.65 → +15pp
  const day = mkRatioDay('2026-04-24', 0.7, 0.65, 0, 0.1, 'normal', 1.5);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([day]),
  });
  assert.ok(d.ratioDriftPctPoints != null);
  assert.ok(Math.abs(d.ratioDriftPctPoints - 15) < 1e-9);
});

test('ratioDriftPctPoints: low day → negative pp', () => {
  // baseline prob = 0.5, ewma 0.30 → -20pp
  const day = mkRatioDay('2026-04-24', 0.25, 0.30, 0, 0.2, 'low', -3.0);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([day]),
  });
  assert.ok(d.ratioDriftPctPoints != null);
  assert.ok(Math.abs(d.ratioDriftPctPoints - -20) < 1e-9);
});

test('ratioDriftPctPoints: warmup → null', () => {
  const day = mkRatioDay('2026-04-24', 0.5, 0.5, null, null, 'warmup');
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([day]),
  });
  assert.equal(d.ratioDriftPctPoints, null);
});

test('ratioDriftPctPoints: undefined → null', () => {
  const day = mkRatioDay('2026-04-24', null, null, null, null, 'undefined');
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([day]),
  });
  assert.equal(d.ratioDriftPctPoints, null);
});

test('ratioDriftPctPoints: flat → null', () => {
  const day = mkRatioDay('2026-04-24', 0.5, 0.5, 0, 0, 'flat');
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([day]),
  });
  assert.equal(d.ratioDriftPctPoints, null);
});

test('ratioDriftPctPoints: empty series → null', () => {
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([]),
  });
  assert.equal(d.ratioDriftPctPoints, null);
});

// Live regression — 04-24 cache-hit jump 48% → 77% reproduced via logit
// math (logit(0.48) ≈ -0.080; ewma 0.77 - inverseLogit(-0.080) ≈ +29pp).
test('ratioDriftPctPoints: live 04-24 cache-hit jump reproduces ~+29pp', () => {
  // logit(0.48) = ln(0.48/0.52) ≈ -0.0800427
  const day = mkRatioDay('2026-04-24', 0.77, 0.77, -0.0800427, 0.05, 'high', 43.97);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([day]),
  });
  assert.ok(d.ratioDriftPctPoints != null);
  // 0.77 - 0.48 = 0.29 → +29pp (within rounding)
  assert.ok(
    Math.abs(d.ratioDriftPctPoints - 29) < 0.1,
    `expected ~+29pp, got ${d.ratioDriftPctPoints}`,
  );
});

// ---------------------------------------------------------------------------
// Alerting OR-merge
// ---------------------------------------------------------------------------

test('alerting: token high alone → true', () => {
  const day = mkAnomalyDay('2026-04-24', 5000, 1000, 100, 'high', 40.0);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([day]),
    ratios: mkRatios([]),
  });
  assert.equal(d.alerting, true);
});

test('alerting: ratio high alone → true', () => {
  const day = mkRatioDay('2026-04-24', 0.9, 0.85, 0, 0.1, 'high', 5.0);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([day]),
  });
  assert.equal(d.alerting, true);
});

test('alerting: ratio low alone → true (cache-hit drop is the bad one)', () => {
  const day = mkRatioDay('2026-04-24', 0.2, 0.25, 0.5, 0.1, 'low', -3.0);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([day]),
  });
  assert.equal(d.alerting, true);
});

test('alerting: token low alone → FALSE (a slow day is not an alert)', () => {
  // Mirrors the anomalies CLI exit-code contract: only `high` triggers
  // exit 2 because nobody pages on "we used fewer tokens than usual".
  const day = mkAnomalyDay('2026-04-24', 100, 1000, 100, 'low', -9.0);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([day]),
    ratios: mkRatios([]),
  });
  assert.equal(d.alerting, false);
});

test('alerting: both flagged → still true (no double-counting glitch)', () => {
  const tokenDay = mkAnomalyDay('2026-04-24', 5000, 1000, 100, 'high', 40.0);
  const ratioDay = mkRatioDay('2026-04-24', 0.2, 0.25, 0.5, 0.1, 'low', -3.0);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([tokenDay]),
    ratios: mkRatios([ratioDay]),
  });
  assert.equal(d.alerting, true);
});

test('alerting: neither → false', () => {
  const tokenDay = mkAnomalyDay('2026-04-24', 1000, 1000, 100, 'normal', 0);
  const ratioDay = mkRatioDay('2026-04-24', 0.5, 0.5, 0, 0.1, 'normal', 0);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([tokenDay]),
    ratios: mkRatios([ratioDay]),
  });
  assert.equal(d.alerting, false);
});

test('alerting: empty series both sides → false', () => {
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([]),
  });
  assert.equal(d.alerting, false);
});

// ---------------------------------------------------------------------------
// asOf passthrough + defaulting
// ---------------------------------------------------------------------------

test('asOf: passes through when provided', () => {
  const d = buildDashboard({
    asOf: '2026-04-24T12:00:00Z',
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([]),
  });
  assert.equal(d.asOf, '2026-04-24T12:00:00Z');
});

test('asOf: defaults to now when omitted (smoke — just non-empty)', () => {
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([]),
  });
  assert.ok(typeof d.asOf === 'string' && d.asOf.length > 0);
});

// ---------------------------------------------------------------------------
// inverseLogit numeric guard (via extreme baselineLogitMean values)
// ---------------------------------------------------------------------------

test('inverseLogit guard: very large positive logit → ratioDrift uses prob=1', () => {
  // baselineLogitMean = 1000 → guard returns 1; ewma 0.99 → -1pp.
  const day = mkRatioDay('2026-04-24', 0.99, 0.99, 1000, 0.1, 'normal', 0);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([day]),
  });
  assert.ok(d.ratioDriftPctPoints != null);
  assert.ok(Math.abs(d.ratioDriftPctPoints - -1) < 1e-9);
});

test('inverseLogit guard: very large negative logit → ratioDrift uses prob=0', () => {
  // baselineLogitMean = -1000 → guard returns 0; ewma 0.05 → +5pp.
  const day = mkRatioDay('2026-04-24', 0.05, 0.05, -1000, 0.1, 'normal', 0);
  const d = buildDashboard({
    status: mkStatus(),
    anomalies: mkAnomalies([]),
    ratios: mkRatios([day]),
  });
  assert.ok(d.ratioDriftPctPoints != null);
  assert.ok(Math.abs(d.ratioDriftPctPoints - 5) < 1e-9);
});
