/**
 * classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound:
 * cross-axis 8-bucket diagnostic joining axis-217
 * LAPLACE 1773 MASS-WEIGHTED POSITION-CENTROID TREND
 * TEST (`lapZ`, `lapPValue`, `lapCBarNorm`) with
 * axis-214 THEIL-SEN MEDIAN PAIRWISE-SLOPE TREND
 * (`theilSenSlope`, `theilSenSlopeCiLow`,
 * `theilSenSlopeCiHigh`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes test for monotone trend
 * in the gap-filled daily token series, but at
 * MAXIMALLY-OPPOSITE STATISTICAL FUNCTIONALS:
 *
 *   - LAPLACE (axis-217) is a FIRST-MOMENT functional
 *     of the MASS-WEIGHTED POSITION CENTROID
 *
 *         cBar = sum(i * x_i) / sum(x_i)
 *
 *     standardised by the Cox-Lewis 1966 sec. 3.3
 *     EFFECTIVE-SAMPLE-SIZE-CORRECTED variance
 *     (n^2 - 1) / (12 * nEff). The test depends on
 *     VALUES DIRECTLY (mass-weighting): a single late
 *     spike has a huge effect because it carries large
 *     mass at large i. Sign convention:
 *       - lapZ > 0 = MASS BACK-LOADED (centroid LATE
 *         in tenure) = late-tenure mass concentration.
 *       - lapZ < 0 = MASS FRONT-LOADED.
 *
 *       lapTrendUpSignal = +lapZ   ( + = back-loaded
 *                                      / late-growing,
 *                                    - = front-loaded
 *                                      / declining )
 *
 *   - THEIL-SEN (axis-214) is a RANK-BASED estimator:
 *     the MEDIAN of the C(n, 2) PAIRWISE SLOPES
 *
 *         s_{i,j} = (x_j - x_i) / (j - i)   for i < j
 *
 *     The estimator and its Sen 1968 order-statistic
 *     CI are determined by the sign-pattern of pairs,
 *     making them ROBUST to outliers and INSENSITIVE
 *     to magnitude beyond rank ordering. A single large
 *     late spike contributes only `n - 1` positive
 *     pairs out of `n*(n-1)/2`, a small fraction. Sign
 *     convention:
 *       - theilSenSlope > 0 = MEDIAN PAIRWISE SLOPE
 *         positive = monotone increasing rank trend.
 *       - theilSenSlope < 0 = monotone decreasing.
 *
 *       tsTrendUpSignal = +theilSenSlope   ( + = up-trend,
 *                                            - = down-trend )
 *
 *     DECISIVENESS for axis-214 in this compound is
 *     defined as "Sen 1968 confidence interval EXCLUDES
 *     ZERO" (theilSenSlopeCiLow > 0 OR theilSenSlopeCiHigh < 0).
 *     This avoids the awkward asymptotic-vs-exact p-value
 *     conversion for the order-statistic CI.
 *
 *     Both axes are sign-CORRECTLY oriented: positive
 *     = up-trend / late-growing, negative = down-trend
 *     / declining. The compound classifier operates in
 *     the unified `*TrendUpSignal` frame for unambiguous
 *     direction-comparison.
 *
 * STRUCTURAL ORTHOGONALITY at four levels:
 *
 *   - DIFFERENT STATISTICAL FUNCTIONAL (the headline claim).
 *     Laplace is the L-1 / FIRST-MOMENT functional of
 *     the mass-weighted position distribution, sensitive
 *     to MAGNITUDE through mass-weighting. Theil-Sen is
 *     the MEDIAN of C(n, 2) pairwise slopes, sensitive
 *     ONLY to the SIGN-PATTERN of pairs. A series like
 *     [1, 1, ..., 1, 1.0001] (almost flat with the very
 *     last day fractionally higher) has positive
 *     theilSenSlope (every (i, n-1) pair is positive)
 *     but lapZ ~ 0 (mass essentially uniform). A series
 *     like [1, 1, ..., 1, 1e9] (one huge late spike)
 *     has lapZ >> 0 (mass dominated by position n) but
 *     a small theilSenSlope as a rank fraction (only
 *     n - 1 of n*(n-1)/2 pairs are positive due to the
 *     single endpoint).
 *
 *   - DIFFERENT NULL DISTRIBUTION FAMILY.
 *     Laplace: lapZ ~ N(0, 1) under H0 of mass uniform
 *     across positions, with closed-form Cox-Lewis
 *     (1966) variance.
 *     Theil-Sen: decisiveness via Sen 1968 distribution-
 *     free order-statistic CI on the median pairwise
 *     slope, derived from the Mann-Kendall S variance
 *     formula with the Kendall 1970 tie correction.
 *
 *   - DIFFERENT INVARIANCE PROFILE.
 *     Laplace is INVARIANT under positive scaling of
 *     mass (multiply every x_i by a > 0). Theil-Sen
 *     SLOPE SCALES with the value-scale (multiply by a
 *     gives slope multiplied by a) but its SIGN and CI
 *     SIGN are scale-invariant. Both NEGATE under
 *     reversal of the series along positions.
 *
 *   - DIFFERENT ROBUSTNESS PROFILE.
 *     Theil-Sen has 29% breakdown (Theil 1950); a
 *     handful of contaminated days do not flip the
 *     median pairwise slope. Laplace has effectively
 *     0% breakdown (one extreme value can dominate
 *     cBar). For series with a few late outliers but
 *     otherwise flat, theilSenSlope ~ 0 but lapZ >> 0.
 *
 * COMPOUND BUCKET SCHEME (the standard 4-quadrant
 * direction-conflict scheme used by axis-213 x axis-212,
 * axis-211 x axis-210, axis-209 x axis-208 etc., for
 * SIGNED-x-SIGNED axes both with directional sign):
 *
 * ```
 * 'robust-up-trend'           lapDecisive AND tsDecisive AND lapZ > 0 AND tsSlope > 0
 * 'robust-down-trend'         lapDecisive AND tsDecisive AND lapZ < 0 AND tsSlope < 0
 * 'direction-conflict'        lapDecisive AND tsDecisive AND signs disagree
 * 'mass-late-only'            lapDecisive AND NOT tsDecisive AND lapZ > 0
 * 'mass-early-only'           lapDecisive AND NOT tsDecisive AND lapZ < 0
 * 'rank-up-only'              tsDecisive AND NOT lapDecisive AND tsSlope > 0
 * 'rank-down-only'            tsDecisive AND NOT lapDecisive AND tsSlope < 0
 * 'no-evidence'               NOT lapDecisive AND NOT tsDecisive
 * ```
 *
 * The PRACTICAL READING is:
 *   - 'robust-up' and 'robust-down' = both magnitude-
 *     based AND rank-based trend agree. Maximum
 *     confidence in direction.
 *   - 'direction-conflict' = a series where mass is
 *     concentrating at one tenure-end while the
 *     PAIRWISE rank trend points the other way, e.g. an
 *     overall declining ramp punctuated by a single
 *     huge late spike (theilSenSlope < 0 but lapZ > 0).
 *     A diagnostically interesting case.
 *   - '*-only-up/down' = one functional disagrees on
 *     decisiveness with the other. Inspect for outlier
 *     contamination (rank-up but mass-uniform) or for
 *     mass-concentration with no monotone trend (mass-
 *     late but rank-flat).
 *
 * Pure deterministic; no I/O. Operates on already-built
 * axis-217 and axis-214 row arrays.
 */

export interface LaplaceCentroidRowForTheilSenSlopeCompound {
  source: string;
  lapZ: number;
  lapPValue: number;
  lapCBarNorm: number;
}

export interface TheilSenSlopeRowForLaplaceCentroidCompound {
  source: string;
  theilSenSlope: number;
  theilSenSlopeCiLow: number;
  theilSenSlopeCiHigh: number;
}

export type Axis217Axis214LaplaceTheilSenBucket =
  | 'robust-up-trend'
  | 'robust-down-trend'
  | 'direction-conflict'
  | 'mass-late-only'
  | 'mass-early-only'
  | 'rank-up-only'
  | 'rank-down-only'
  | 'no-evidence';

export interface Axis217Axis214LaplaceTheilSenJoinedRow {
  source: string;
  lapZ: number;
  lapPValue: number;
  lapCBarNorm: number;
  theilSenSlope: number;
  theilSenSlopeCiLow: number;
  theilSenSlopeCiHigh: number;
  lapDecisive: boolean;
  tsDecisive: boolean;
  lapTrendUpSignal: number;
  tsTrendUpSignal: number;
  bucket: Axis217Axis214LaplaceTheilSenBucket;
  jointDirectionQuadrant:
    | 'robustUp'
    | 'robustDown'
    | 'conflictLapUpTsDown'
    | 'conflictLapDownTsUp'
    | null;
}

export interface Axis217Axis214LaplaceTheilSenReport {
  alpha: number;
  rows: Axis217Axis214LaplaceTheilSenJoinedRow[];
  bucketCounts: Record<Axis217Axis214LaplaceTheilSenBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointDirectionQuadrant: {
    robustUp: number;
    robustDown: number;
    conflictLapUpTsDown: number;
    conflictLapDownTsUp: number;
    anyMissingDecisive: number;
  };
  sourcesOnlyInLaplace: string[];
  sourcesOnlyInTheilSen: string[];
}

export function classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound(
  laplaceRows: ReadonlyArray<LaplaceCentroidRowForTheilSenSlopeCompound>,
  theilSenRows: ReadonlyArray<TheilSenSlopeRowForLaplaceCentroidCompound>,
  alpha = 0.05,
): Axis217Axis214LaplaceTheilSenReport {
  const fnName =
    'classifyAxis217Axis214LaplaceCentroidTheilSenFirstMomentVsRankSlopeTrendCompound';
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(`${fnName}: alpha must be in (0, 0.5] (got ${alpha})`);
  }

  const lapBySrc = new Map<string, LaplaceCentroidRowForTheilSenSlopeCompound>();
  for (const r of laplaceRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `${fnName}: laplace row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.lapZ) ||
      !Number.isFinite(r.lapPValue) ||
      !Number.isFinite(r.lapCBarNorm) ||
      r.lapPValue < 0 ||
      r.lapPValue > 1 ||
      r.lapCBarNorm < -1.0000001 ||
      r.lapCBarNorm > 1.0000001
    ) {
      throw new Error(
        `${fnName}: laplace row '${r.source}' has invalid lapZ/lapPValue/lapCBarNorm`,
      );
    }
    if (lapBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate laplace source '${r.source}'`);
    }
    lapBySrc.set(r.source, r);
  }

  const tsBySrc = new Map<string, TheilSenSlopeRowForLaplaceCentroidCompound>();
  for (const r of theilSenRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `${fnName}: theil-sen row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.theilSenSlope) ||
      !Number.isFinite(r.theilSenSlopeCiLow) ||
      !Number.isFinite(r.theilSenSlopeCiHigh) ||
      r.theilSenSlopeCiLow > r.theilSenSlopeCiHigh
    ) {
      throw new Error(
        `${fnName}: theil-sen row '${r.source}' has invalid slope/CI`,
      );
    }
    if (tsBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate theil-sen source '${r.source}'`);
    }
    tsBySrc.set(r.source, r);
  }

  const sourcesOnlyInLaplace: string[] = [];
  const sourcesOnlyInTheilSen: string[] = [];
  for (const s of lapBySrc.keys()) {
    if (!tsBySrc.has(s)) sourcesOnlyInLaplace.push(s);
  }
  for (const s of tsBySrc.keys()) {
    if (!lapBySrc.has(s)) sourcesOnlyInTheilSen.push(s);
  }
  sourcesOnlyInLaplace.sort();
  sourcesOnlyInTheilSen.sort();

  const joinedSources: string[] = [];
  for (const s of lapBySrc.keys()) {
    if (tsBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis217Axis214LaplaceTheilSenJoinedRow[] = [];
  const bucketCounts: Record<Axis217Axis214LaplaceTheilSenBucket, number> = {
    'robust-up-trend': 0,
    'robust-down-trend': 0,
    'direction-conflict': 0,
    'mass-late-only': 0,
    'mass-early-only': 0,
    'rank-up-only': 0,
    'rank-down-only': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  const byJointDirectionQuadrant = {
    robustUp: 0,
    robustDown: 0,
    conflictLapUpTsDown: 0,
    conflictLapDownTsUp: 0,
    anyMissingDecisive: 0,
  };

  for (const src of joinedSources) {
    const lap = lapBySrc.get(src)!;
    const ts = tsBySrc.get(src)!;
    const lapDecisive = lap.lapPValue < alpha;
    // Theil-Sen decisive if Sen CI excludes zero
    const tsDecisive =
      ts.theilSenSlopeCiLow > 0 || ts.theilSenSlopeCiHigh < 0;
    const anyDecisive = lapDecisive || tsDecisive;
    if (lapDecisive && tsDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    const lapTrendUpSignal = lap.lapZ;
    const tsTrendUpSignal = ts.theilSenSlope;

    let bucket: Axis217Axis214LaplaceTheilSenBucket;
    let jointDirectionQuadrant:
      | 'robustUp'
      | 'robustDown'
      | 'conflictLapUpTsDown'
      | 'conflictLapDownTsUp'
      | null = null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointDirectionQuadrant.anyMissingDecisive += 1;
    } else if (lapDecisive && !tsDecisive) {
      bucket = lap.lapZ >= 0 ? 'mass-late-only' : 'mass-early-only';
      byJointDirectionQuadrant.anyMissingDecisive += 1;
    } else if (tsDecisive && !lapDecisive) {
      bucket = ts.theilSenSlope >= 0 ? 'rank-up-only' : 'rank-down-only';
      byJointDirectionQuadrant.anyMissingDecisive += 1;
    } else {
      const lapUp = lapTrendUpSignal >= 0;
      const tsUp = tsTrendUpSignal >= 0;
      if (lapUp && tsUp) {
        bucket = 'robust-up-trend';
        jointDirectionQuadrant = 'robustUp';
        byJointDirectionQuadrant.robustUp += 1;
      } else if (!lapUp && !tsUp) {
        bucket = 'robust-down-trend';
        jointDirectionQuadrant = 'robustDown';
        byJointDirectionQuadrant.robustDown += 1;
      } else if (lapUp && !tsUp) {
        bucket = 'direction-conflict';
        jointDirectionQuadrant = 'conflictLapUpTsDown';
        byJointDirectionQuadrant.conflictLapUpTsDown += 1;
      } else {
        bucket = 'direction-conflict';
        jointDirectionQuadrant = 'conflictLapDownTsUp';
        byJointDirectionQuadrant.conflictLapDownTsUp += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      lapZ: lap.lapZ,
      lapPValue: lap.lapPValue,
      lapCBarNorm: lap.lapCBarNorm,
      theilSenSlope: ts.theilSenSlope,
      theilSenSlopeCiLow: ts.theilSenSlopeCiLow,
      theilSenSlopeCiHigh: ts.theilSenSlopeCiHigh,
      lapDecisive,
      tsDecisive,
      lapTrendUpSignal,
      tsTrendUpSignal,
      bucket,
      jointDirectionQuadrant,
    });
  }

  return {
    alpha,
    rows,
    bucketCounts,
    bothDecisive,
    atLeastOneDecisive,
    byJointDirectionQuadrant,
    sourcesOnlyInLaplace,
    sourcesOnlyInTheilSen,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis217Axis214LaplaceTheilSenReport.
 *
 *   axis-217xaxis-214 alpha=<a> n=<rows> both=<k>/<rows> qd[rUp/rDn/cLuTd/cLdTu]=a/b/c/d buckets[ru/rd/dc/mlo/meo/ruo/rdo/ne]=...
 *
 * Pure deterministic; no I/O.
 */
export function summarizeAxis217Axis214LaplaceTheilSenReport(
  report: Axis217Axis214LaplaceTheilSenReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const q = report.byJointDirectionQuadrant;
  const b = report.bucketCounts;
  return (
    `axis-217xaxis-214 alpha=${a} n=${n} both=${report.bothDecisive}/${n} ` +
    `qd[rUp/rDn/cLuTd/cLdTu]=${q.robustUp}/${q.robustDown}/${q.conflictLapUpTsDown}/${q.conflictLapDownTsUp} ` +
    `buckets[ru/rd/dc/mlo/meo/ruo/rdo/ne]=${b['robust-up-trend']}/${b['robust-down-trend']}/${b['direction-conflict']}/${b['mass-late-only']}/${b['mass-early-only']}/${b['rank-up-only']}/${b['rank-down-only']}/${b['no-evidence']}`
  );
}
