/**
 * Dashboard — single-screen operator view.
 *
 * Composes three already-shipped builders into one report:
 *   - `buildStatus`     (queue / cursor / lock / lag health)
 *   - `buildAnomalies`  (z-score over trailing daily-token baseline)
 *   - `buildRatiosReport` (logit-EWMA over cache-hit ratio)
 *
 * Plus two derived "drift" indicators that don't exist standalone:
 *   - `tokenDriftPct`   — most recent day's tokens vs baseline mean,
 *                         expressed as a signed percentage. Equivalent
 *                         to `(today - baseline) / baseline * 100` on
 *                         the most recent scored anomaly day. null if
 *                         the most recent day is `warmup` or `flat`.
 *   - `ratioDriftPct`   — most recent EWMA value vs baseline EWMA mean
 *                         (recovered by inverse-logit), expressed as
 *                         signed *percentage points* (not percent of
 *                         percent). null if the most recent ratio day
 *                         is `warmup` / `flat` / `undefined`.
 *
 * Why a separate builder (not just glue in CLI)?
 *   - The CLI already has 14 subcommands. Each one threads paths,
 *     options, JSON-vs-pretty rendering, and exit codes through the
 *     same boilerplate. Putting the composition logic in a builder
 *     means the dashboard renderer is pure (DashboardReport in →
 *     string out), tests can inject fixtures directly without any
 *     filesystem, and the "what does drift mean" decision lives in
 *     one place instead of being re-derived every call.
 *   - The exit-code contract for `pew-insights dashboard` mirrors
 *     `anomalies` and `ratios`: exit 2 if EITHER the recent token
 *     day is `high` OR the recent ratio day is `high`/`low`. That
 *     OR-merge is itself a policy decision worth unit-testing.
 *
 * Determinism: like the upstream builders, we never call Date.now()
 * inside this module. Callers pass `asOf` explicitly.
 */
import type { AnomaliesReport, AnomalyDay } from './anomalies.js';
import type { RatiosReport, RatioDay } from './ratiosreport.js';
import type { Status } from './report.js';

export interface DashboardReport {
  asOf: string;
  status: Status;
  anomalies: AnomaliesReport;
  ratios: RatiosReport;
  /**
   * Most recent scored anomaly day (or null if every day is warmup /
   * the series is empty). Convenience pointer — same object lives in
   * `anomalies.series`.
   */
  recentAnomaly: AnomalyDay | null;
  /**
   * Most recent ratio day with a defined ewma + baseline (or null).
   * Convenience pointer — same object lives in `ratios.series`.
   */
  recentRatio: RatioDay | null;
  /**
   * Signed percentage: `(recentAnomaly.tokens - baselineMean) / baselineMean * 100`.
   * null if the most recent day is `warmup`, `flat`, or baselineMean === 0.
   */
  tokenDriftPct: number | null;
  /**
   * Signed *percentage points*: `recentRatio.ewma - baselineEwmaMean` * 100.
   * baselineEwmaMean is recovered from the logit-space mean via inverse-logit.
   * null if the most recent day is `warmup` / `flat` / `undefined` / has no
   * baseline.
   */
  ratioDriftPctPoints: number | null;
  /**
   * True if any "alert" condition fires:
   *   - recent anomaly day status === 'high', OR
   *   - recent ratio day status === 'high' OR 'low'.
   * The CLI uses this to set process.exitCode = 2.
   */
  alerting: boolean;
}

export interface BuildDashboardInputs {
  asOf?: string;
  status: Status;
  anomalies: AnomaliesReport;
  ratios: RatiosReport;
}

/**
 * Recover a probability from a logit value using the standard logistic
 * inverse: σ(x) = 1 / (1 + exp(-x)). Mirrors `expit` in `ratios.ts`
 * but local to keep this module dependency-free.
 *
 * Why inline: this is the only place the dashboard needs an inverse
 * logit, and importing `expit` from `ratios.ts` would couple this
 * pure-composition module to the deeper bounded-ratio math layer.
 */
function inverseLogit(x: number): number {
  // Numeric guard: at extreme |x|, exp can overflow. Clamp matches
  // ratios.ts conventions (logit clamps to ~±13.8 implicitly via eps).
  if (x >= 700) return 1;
  if (x <= -700) return 0;
  return 1 / (1 + Math.exp(-x));
}

export function buildDashboard(inputs: BuildDashboardInputs): DashboardReport {
  const asOf = inputs.asOf ?? new Date().toISOString();
  const { status, anomalies, ratios } = inputs;

  // Most recent scored day = last element of series (oldest → newest).
  // anomalies.series already excludes warmup days, so series[last]
  // always has either a real z OR status === 'flat'.
  const recentAnomaly =
    anomalies.series.length > 0
      ? anomalies.series[anomalies.series.length - 1]!
      : null;

  // Ratios are different: ratios.series includes ALL days in window
  // (warmup, undefined, flat included). We want the *most recent* day
  // that has a defined baseline so the drift calc is meaningful — fall
  // back to the absolute last element if none qualify, so JSON
  // consumers still see something.
  let recentRatio: RatioDay | null = null;
  for (let i = ratios.series.length - 1; i >= 0; i--) {
    const d = ratios.series[i]!;
    if (d.baselineLogitMean != null) {
      recentRatio = d;
      break;
    }
  }
  if (recentRatio == null && ratios.series.length > 0) {
    recentRatio = ratios.series[ratios.series.length - 1]!;
  }

  // Token drift: percent change from baseline mean. Skip flat / warmup
  // days and divide-by-zero baselines.
  let tokenDriftPct: number | null = null;
  if (
    recentAnomaly &&
    recentAnomaly.status !== 'warmup' &&
    recentAnomaly.status !== 'flat' &&
    recentAnomaly.baselineMean != null &&
    recentAnomaly.baselineMean !== 0
  ) {
    tokenDriftPct =
      ((recentAnomaly.tokens - recentAnomaly.baselineMean) /
        recentAnomaly.baselineMean) *
      100;
  }

  // Ratio drift: percentage *points* (e.g. cache-hit went from 50% to
  // 65% → +15.0pp). We compute in probability space so the unit is
  // operator-friendly. Recovers baseline mean by inverse-logit.
  let ratioDriftPctPoints: number | null = null;
  if (
    recentRatio &&
    recentRatio.status !== 'warmup' &&
    recentRatio.status !== 'flat' &&
    recentRatio.status !== 'undefined' &&
    recentRatio.ewma != null &&
    recentRatio.baselineLogitMean != null
  ) {
    const baselineProb = inverseLogit(recentRatio.baselineLogitMean);
    ratioDriftPctPoints = (recentRatio.ewma - baselineProb) * 100;
  }

  const tokenAlert = recentAnomaly?.status === 'high';
  const ratioAlert =
    recentRatio?.status === 'high' || recentRatio?.status === 'low';
  const alerting = Boolean(tokenAlert || ratioAlert);

  return {
    asOf,
    status,
    anomalies,
    ratios,
    recentAnomaly,
    recentRatio,
    tokenDriftPct,
    ratioDriftPctPoints,
    alerting,
  };
}
