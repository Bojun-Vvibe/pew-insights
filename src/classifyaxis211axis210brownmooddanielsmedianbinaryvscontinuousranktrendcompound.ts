/**
 * classifyAxis211Axis210BrownMoodDanielsMedianBinaryVsContinuousRankTrendCompound:
 * cross-axis 7-bucket diagnostic joining axis-211
 * BROWN-MOOD MEDIAN TREND TEST (`bmZ`, `bmPValue`)
 * with axis-210 DANIELS 1944 RANK CORRELATION WITH
 * TIME (`drZ`, `drPValue`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes test for monotone trend
 * in the gap-filled daily token series, but at
 * RADICALLY DIFFERENT INFORMATION-CONTENT REDUCTIONS:
 *
 *   - BROWN-MOOD MEDIAN TREND (axis-211) collapses
 *     each observation to a SINGLE BIT (above / not-
 *     above the global sample median) and bins it into
 *     one of TWO time buckets (first half / second
 *     half). It is the MAXIMALLY-COARSE 2x2 binary
 *     trend test:
 *       - bmZ >> 0 = MORE above-median in FIRST half =
 *         monotone DOWN-TREND.
 *       - bmZ << 0 = MORE above-median in SECOND half =
 *         monotone UP-TREND.
 *
 *       bmTrendUpSignal = -bmZ   ( + = up-trend,
 *                                  - = down-trend )
 *
 *     NB: the SIGN CONVENTION is OPPOSITE to axis-210
 *     Daniels (where drZ >> 0 = up-trend because
 *     Daniels is a CORRELATION, large = aligned with
 *     time). BM scores the FIRST-HALF above-median
 *     exceedance directly; large positive bmZ means
 *     the bulk has moved BELOW the median in the
 *     SECOND half = down-trend.
 *
 *   - DANIELS RANK CORRELATION (axis-210) uses the
 *     FULL VALUE-RANK PERMUTATION reduced to the L2
 *     correlation with time-identity. It is a
 *     CONTINUOUS-RANK trend statistic with maximal
 *     within-half resolution:
 *       - drZ >> 0 = ranks RISE WITH TIME = monotone
 *         UP-TREND.
 *       - drZ << 0 = ranks FALL WITH TIME = monotone
 *         DOWN-TREND.
 *
 *       drTrendUpSignal = +drZ   ( + = up-trend,
 *                                  - = down-trend )
 *
 *     The two TrendUpSignals are aligned on direction
 *     (both positive when the series is trending up)
 *     but the underlying STATISTICS measure
 *     fundamentally different things.
 *
 * STRUCTURAL ORTHOGONALITY at three levels:
 *
 *   - DIFFERENT INFORMATION CONTENT.
 *     Brown-Mood reduces each observation to ONE BIT.
 *     Daniels keeps the FULL midrank value. A series
 *     with one extreme outlier and otherwise no trend
 *     can give drZ moderate (the outlier moves its
 *     rank to position n) yet bmZ near 0 (the outlier
 *     contributes the same bit as a moderate above-
 *     median value). Conversely a series with smooth
 *     LEVEL-SHIFT exactly at the midpoint (first half
 *     all below median, second half all above) gives
 *     bmZ maximally negative (perfect 2x2) yet drZ
 *     only moderately positive (ranks are not
 *     monotonically rising; they jump in two flat
 *     blocks).
 *
 *   - DIFFERENT POWER PROFILE.
 *     Daniels has high power against SMOOTH MONOTONE
 *     trends. Brown-Mood has high power against
 *     ABRUPT LEVEL SHIFTS at the midpoint. A noisy
 *     ramp gives Daniels strong rejection but BM
 *     weak; a step function gives both strong but
 *     BM stronger relative to its asymptotic
 *     distribution.
 *
 *   - DIFFERENT ROBUSTNESS.
 *     Brown-Mood is OUTLIER-ROBUST in both directions:
 *     a single huge spike contributes the same single
 *     bit and at most shifts the global median by one
 *     order statistic. Daniels is more sensitive: a
 *     single huge spike receives rank n and contributes
 *     (n - i) to the rank-vs-time deviation, weighted
 *     L2.
 *
 * They can:
 *
 *   - AGREE in the "robust-monotone-trend" case: a
 *     trending series with no extreme outliers gives
 *     both decisive in the same direction. Buckets
 *     `robust-up-trend` and `robust-down-trend` --
 *     the strongest possible trend assertion (both
 *     a continuous-rank statistic and a maximally-
 *     coarse binary statistic agree).
 *
 *   - DISAGREE INFORMATIVELY in the "rank-only-trend"
 *     case: drZ decisive in some direction but bmZ
 *     non-decisive -- a SMOOTH SLOW DRIFT that is
 *     visible at the rank level but does not move
 *     above-median mass enough to flip the 2x2 chi-
 *     square. Surfaced as `daniels-only`.
 *
 *   - SHOW only BM decisive: median-level shift
 *     without rank-vs-time alignment -- a STEP-LIKE
 *     LEVEL JUMP at the midpoint that does not
 *     produce the smooth rank rise that Daniels
 *     prefers. Surfaced as `brown-mood-only`.
 *
 *   - DISAGREE ON SIGN: bmZ and drZ both decisive but
 *     in OPPOSITE directions (after sign-correction).
 *     This is the most diagnostic compound case: it
 *     means the 2x2 median split sees one direction
 *     while the continuous rank correlation sees the
 *     other -- typically driven by a HEAVILY SKEWED
 *     ABOVE-MEDIAN distribution where most values are
 *     just-above the median in one half and a few
 *     extreme spikes dominate the rank ordering in
 *     the other. Surfaced as `direction-conflict`.
 *
 *   - NEITHER decisive: `no-evidence`.
 *
 * Buckets (alpha default 0.05):
 *
 *   - `robust-up-trend`: both decisive, bmTrendUpSignal
 *     > 0 AND drTrendUpSignal > 0 (i.e. bmZ < 0 AND
 *     drZ > 0).
 *   - `robust-down-trend`: both decisive, bmTrendUpSignal
 *     < 0 AND drTrendUpSignal < 0 (i.e. bmZ > 0 AND
 *     drZ < 0).
 *   - `direction-conflict`: both decisive but signs of
 *     bmTrendUpSignal and drTrendUpSignal disagree.
 *   - `daniels-only`: dr decisive, bm non-decisive.
 *   - `brown-mood-only-up`: bm decisive (bmZ < 0 = up),
 *     dr non-decisive.
 *   - `brown-mood-only-down`: bm decisive (bmZ > 0 =
 *     down), dr non-decisive.
 *   - `no-evidence`: neither decisive.
 *
 * Pure function -- no I/O, no globals. Throws on
 * malformed input (duplicate sources, non-finite z or
 * pvalues, pvalue out of (0, 1]). Joins by exact source
 * string match; reports sources only-in-bm and only-in-
 * dr separately so callers can see asymmetric coverage.
 *
 * Refs: see axis-211 (Brown-Mood 1951) and axis-210
 * (Daniels 1944) module headers for primary references.
 */

export interface BrownMoodMedianTrendRowForDanielsRankCorrelationCompound {
  source: string;
  bmZ: number;
  bmPValue: number;
}

export interface DanielsRankCorrelationRowForBrownMoodMedianTrendCompound {
  source: string;
  drZ: number;
  drPValue: number;
}

export type Axis211Axis210BrownMoodDanielsBucket =
  | 'robust-up-trend'
  | 'robust-down-trend'
  | 'direction-conflict'
  | 'daniels-only'
  | 'brown-mood-only-up'
  | 'brown-mood-only-down'
  | 'no-evidence';

export interface Axis211Axis210BrownMoodDanielsJoinedRow {
  source: string;
  bmZ: number;
  bmPValue: number;
  drZ: number;
  drPValue: number;
  bmDecisive: boolean;
  drDecisive: boolean;
  /** -bmZ (positive = up-trend; sign-inverted from raw bmZ). */
  bmTrendUpSignal: number;
  /** +drZ (positive = up-trend). */
  drTrendUpSignal: number;
  bucket: Axis211Axis210BrownMoodDanielsBucket;
  /**
   * Joint trend-direction quadrant when both are decisive:
   *   robustUp | robustDown | conflictBmUpDrDown | conflictBmDownDrUp
   * null when either is non-decisive.
   */
  jointDirectionQuadrant:
    | 'robustUp'
    | 'robustDown'
    | 'conflictBmUpDrDown'
    | 'conflictBmDownDrUp'
    | null;
}

export interface Axis211Axis210BrownMoodDanielsReport {
  alpha: number;
  rows: Axis211Axis210BrownMoodDanielsJoinedRow[];
  bucketCounts: Record<Axis211Axis210BrownMoodDanielsBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointDirectionQuadrant: {
    robustUp: number;
    robustDown: number;
    conflictBmUpDrDown: number;
    conflictBmDownDrUp: number;
    anyMissingDecisive: number;
  };
  sourcesOnlyInBrownMood: string[];
  sourcesOnlyInDaniels: string[];
}

export function classifyAxis211Axis210BrownMoodDanielsMedianBinaryVsContinuousRankTrendCompound(
  brownMoodRows: ReadonlyArray<BrownMoodMedianTrendRowForDanielsRankCorrelationCompound>,
  danielsRows: ReadonlyArray<DanielsRankCorrelationRowForBrownMoodMedianTrendCompound>,
  alpha = 0.05,
): Axis211Axis210BrownMoodDanielsReport {
  const fnName =
    'classifyAxis211Axis210BrownMoodDanielsMedianBinaryVsContinuousRankTrendCompound';
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(`${fnName}: alpha must be in (0, 0.5] (got ${alpha})`);
  }

  const bmBySrc = new Map<
    string,
    BrownMoodMedianTrendRowForDanielsRankCorrelationCompound
  >();
  for (const r of brownMoodRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `${fnName}: brown-mood row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.bmZ) ||
      !Number.isFinite(r.bmPValue) ||
      r.bmPValue <= 0 ||
      r.bmPValue > 1
    ) {
      throw new Error(
        `${fnName}: brown-mood row '${r.source}' has invalid bmZ/bmPValue`,
      );
    }
    if (bmBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate brown-mood source '${r.source}'`);
    }
    bmBySrc.set(r.source, r);
  }

  const drBySrc = new Map<
    string,
    DanielsRankCorrelationRowForBrownMoodMedianTrendCompound
  >();
  for (const r of danielsRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(`${fnName}: daniels row has invalid source: ${r.source}`);
    }
    if (
      !Number.isFinite(r.drZ) ||
      !Number.isFinite(r.drPValue) ||
      r.drPValue <= 0 ||
      r.drPValue > 1
    ) {
      throw new Error(
        `${fnName}: daniels row '${r.source}' has invalid drZ/drPValue`,
      );
    }
    if (drBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate daniels source '${r.source}'`);
    }
    drBySrc.set(r.source, r);
  }

  const sourcesOnlyInBrownMood: string[] = [];
  const sourcesOnlyInDaniels: string[] = [];
  for (const s of bmBySrc.keys()) {
    if (!drBySrc.has(s)) sourcesOnlyInBrownMood.push(s);
  }
  for (const s of drBySrc.keys()) {
    if (!bmBySrc.has(s)) sourcesOnlyInDaniels.push(s);
  }
  sourcesOnlyInBrownMood.sort();
  sourcesOnlyInDaniels.sort();

  const joinedSources: string[] = [];
  for (const s of bmBySrc.keys()) {
    if (drBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis211Axis210BrownMoodDanielsJoinedRow[] = [];
  const bucketCounts: Record<Axis211Axis210BrownMoodDanielsBucket, number> = {
    'robust-up-trend': 0,
    'robust-down-trend': 0,
    'direction-conflict': 0,
    'daniels-only': 0,
    'brown-mood-only-up': 0,
    'brown-mood-only-down': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  const byJointDirectionQuadrant = {
    robustUp: 0,
    robustDown: 0,
    conflictBmUpDrDown: 0,
    conflictBmDownDrUp: 0,
    anyMissingDecisive: 0,
  };

  for (const src of joinedSources) {
    const bm = bmBySrc.get(src)!;
    const dr = drBySrc.get(src)!;
    const bmDecisive = bm.bmPValue < alpha;
    const drDecisive = dr.drPValue < alpha;
    const anyDecisive = bmDecisive || drDecisive;
    if (bmDecisive && drDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    // Sign-inverted BM: positive = up-trend.
    const bmTrendUpSignal = -bm.bmZ;
    // Native Daniels: positive = up-trend.
    const drTrendUpSignal = dr.drZ;

    let bucket: Axis211Axis210BrownMoodDanielsBucket;
    let jointDirectionQuadrant:
      | 'robustUp'
      | 'robustDown'
      | 'conflictBmUpDrDown'
      | 'conflictBmDownDrUp'
      | null = null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointDirectionQuadrant.anyMissingDecisive += 1;
    } else if (bmDecisive && !drDecisive) {
      // bmZ < 0  ->  up-trend; bmZ > 0  ->  down-trend.
      bucket = bm.bmZ < 0 ? 'brown-mood-only-up' : 'brown-mood-only-down';
      byJointDirectionQuadrant.anyMissingDecisive += 1;
    } else if (drDecisive && !bmDecisive) {
      bucket = 'daniels-only';
      byJointDirectionQuadrant.anyMissingDecisive += 1;
    } else {
      // Both decisive: classify joint sign in the
      // bmTrendUpSignal/drTrendUpSignal frame (where +
      // means up-trend for both).
      const bmUp = bmTrendUpSignal > 0; // i.e. bmZ < 0
      const drUp = drTrendUpSignal > 0; // i.e. drZ > 0
      if (bmUp && drUp) {
        bucket = 'robust-up-trend';
        jointDirectionQuadrant = 'robustUp';
        byJointDirectionQuadrant.robustUp += 1;
      } else if (!bmUp && !drUp) {
        bucket = 'robust-down-trend';
        jointDirectionQuadrant = 'robustDown';
        byJointDirectionQuadrant.robustDown += 1;
      } else if (bmUp && !drUp) {
        bucket = 'direction-conflict';
        jointDirectionQuadrant = 'conflictBmUpDrDown';
        byJointDirectionQuadrant.conflictBmUpDrDown += 1;
      } else {
        bucket = 'direction-conflict';
        jointDirectionQuadrant = 'conflictBmDownDrUp';
        byJointDirectionQuadrant.conflictBmDownDrUp += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      bmZ: bm.bmZ,
      bmPValue: bm.bmPValue,
      drZ: dr.drZ,
      drPValue: dr.drPValue,
      bmDecisive,
      drDecisive,
      bmTrendUpSignal,
      drTrendUpSignal,
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
    sourcesOnlyInBrownMood,
    sourcesOnlyInDaniels,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis211Axis210BrownMoodDanielsReport.
 *
 *   axis-211xaxis-210 alpha=<a> n=<rows> both=<k>/<rows> qd[rUp/rDn/cBuDd/cBdDu]=a/b/c/d buckets[ru/rd/dc/do/bmu/bmd/ne]=v/w/x/y/z/u/t
 *
 * Pure deterministic; no I/O.
 */
export function summarizeAxis211Axis210BrownMoodDanielsReport(
  report: Axis211Axis210BrownMoodDanielsReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const q = report.byJointDirectionQuadrant;
  const b = report.bucketCounts;
  return (
    `axis-211xaxis-210 alpha=${a} n=${n} both=${report.bothDecisive}/${n} ` +
    `qd[rUp/rDn/cBuDd/cBdDu]=${q.robustUp}/${q.robustDown}/${q.conflictBmUpDrDown}/${q.conflictBmDownDrUp} ` +
    `buckets[ru/rd/dc/do/bmu/bmd/ne]=${b['robust-up-trend']}/${b['robust-down-trend']}/${b['direction-conflict']}/${b['daniels-only']}/${b['brown-mood-only-up']}/${b['brown-mood-only-down']}/${b['no-evidence']}`
  );
}
