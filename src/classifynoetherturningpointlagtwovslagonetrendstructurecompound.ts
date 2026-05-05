/**
 * classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound:
 * cross-axis 7-bucket diagnostic joining axis-202
 * NOETHER 1956 cyclical-trend test at LAG-m=2
 * (`noetherZ`, `noetherPValue`) with the LAG-1 WALLIS-
 * MOORE turning-point rate (`tprZ`, `tprPValue`) on
 * a per-source basis.
 *
 * STRUCTURAL CLAIM. The two axes target IDENTICAL
 * structural alternatives (persistence vs cyclic-
 * reversion in the daily-token series) but PROBE
 * THEM AT DIFFERENT TIME SCALES:
 *
 *   - Wallis-Moore turning-point rate counts STRICT
 *     LOCAL EXTREMA at LAG 1 (adjacent triplets). Its
 *     z-statistic `tprZ` is signed so that
 *
 *       tprZ << 0  =  too few extrema  =  TOO SMOOTH
 *                                          (lag-1 trend
 *                                           / first-
 *                                           difference
 *                                           persistence)
 *       tprZ >> 0  =  too many extrema =  TOO JAGGED
 *                                          (lag-1 mean-
 *                                           reversion
 *                                           / day-to-day
 *                                           anti-
 *                                           persistence)
 *
 *   - Noether at LAG 2 counts MONOTONIC SPACED triplets
 *     (v[i], v[i+2], v[i+4]). Its z-statistic
 *     `noetherZ` is signed so that
 *
 *       noetherZ >> 0  =  more monotonic spaced triplets
 *                          than chance
 *                          =  LAG-2 PERSISTENCE / TREND
 *       noetherZ << 0  =  fewer monotonic spaced
 *                          triplets
 *                          =  LAG-2 CYCLIC / mean-
 *                             reversion
 *
 * To compare them on a COMMON SIGN AXIS we recode each
 * z-statistic as a "trend signal at that lag":
 *
 *     lag1TrendSignal = - tprZ      ( + = lag-1 trend
 *                                     - = lag-1 cyclic )
 *     lag2TrendSignal = + noetherZ  ( + = lag-2 trend
 *                                     - = lag-2 cyclic )
 *
 * The complement-of-Wallis-Moore-at-lag-1 result
 * (Wallis & Moore 1941, see also Hettmansperger 1984
 * sec. 4.5) makes Noether at LAG 1 affine-equivalent to
 * the negated turning-point count -- which is exactly
 * why this axis defaults to LAG 2 to be ORTHOGONAL by
 * construction. The compound classifier therefore
 * exploits the LAG-1 / LAG-2 GAP: a series can have a
 * CONSISTENT REGIME at both scales (coherent buckets)
 * or a SCALE-DEPENDENT FLIP (cross-lag-flip buckets) or
 * SIGNAL VISIBLE AT ONLY ONE LAG (lag-only buckets) or
 * NO STRUCTURE (no-evidence).
 *
 * Bucket map. Given per-source `tprZ` (lag-1 turning-
 * point z) and `noetherZ` (lag-2 spaced-triplet z) with
 * their two-sided p-values at configurable alpha
 * (default 0.05):
 *
 *   - 'coherent-trend': lag1TrendSignal > 0 (tprZ < 0)
 *     AND lag2TrendSignal > 0 (noetherZ > 0) AND
 *     BOTH decisive at alpha. Trend regime detected
 *     consistently at both lag 1 and lag 2 — the
 *     strongest cross-lag evidence of a directional
 *     drift.
 *   - 'coherent-cyclic': lag1TrendSignal < 0
 *     (tprZ > 0) AND lag2TrendSignal < 0 (noetherZ <
 *     0) AND BOTH decisive at alpha. Mean-reversion /
 *     cyclic regime detected consistently at both lag
 *     1 and lag 2 — characteristic of bounded-range
 *     daily oscillation around a slowly-moving level.
 *   - 'cross-lag-flip-trend-lag2-only': lag1TrendSignal
 *     < 0 (tprZ > 0, lag-1 jagged) AND
 *     lag2TrendSignal > 0 (noetherZ > 0, lag-2 trend)
 *     AND BOTH decisive. The series alternates daily
 *     (zig-zag) yet trends monotonically every two
 *     days -- a CHARACTERISTIC TWO-DAY-CYCLE-WITHIN-
 *     UPWARD-DRIFT pattern. CANONICAL Noether
 *     signature win: invisible to lag-1 statistics.
 *   - 'cross-lag-flip-trend-lag1-only': lag1TrendSignal
 *     > 0 (tprZ < 0, lag-1 smooth) AND
 *     lag2TrendSignal < 0 (noetherZ < 0, lag-2 cyclic)
 *     AND BOTH decisive. The series moves smoothly
 *     day-to-day but reverses direction every two
 *     days — a triangle-wave at period ~4. Rare;
 *     watch-list.
 *   - 'lag1-only': lag-1 (tprZ) decisive AND lag-2
 *     (noetherZ) NOT decisive. Structure visible only
 *     at the daily scale; lag-2 looks i.i.d.
 *   - 'lag2-only': lag-2 (noetherZ) decisive AND lag-1
 *     (tprZ) NOT decisive. Structure visible only at
 *     the two-day scale; lag-1 looks i.i.d. — DIRECT
 *     EVIDENCE of the Noether axis providing
 *     non-redundant signal.
 *   - 'no-evidence': neither decisive at alpha.
 *
 * Returns the joined-row table plus aggregate counts
 * (`bothDecisive`, `atLeastOneDecisive`, `coherentRows`,
 * `crossLagFlipRows`, `lagSpecificRows`) and the
 * asymmetric source-membership lists.
 *
 * Pure function: no I/O, deterministic source-asc
 * ordering, throws on duplicate sources, non-finite
 * inputs, p-values outside (0, 1], or alpha outside
 * (0, 0.5].
 *
 * Reference:
 *   Noether, G. E., "Two sequential tests against
 *     trend", *Annals of Mathematical Statistics*
 *     27(2) (1956), pp. 441-450.
 *   Wallis, W. A. & Moore, G. H., "A significance test
 *     for time series analyses", *J. Amer. Statist.
 *     Assoc.* 36(215) (1941), pp. 401-409.
 *   Hettmansperger, T. P., *Statistical Inference Based
 *     on Ranks* (Wiley 1984), sec. 4.5.
 */

export interface NoetherRowForLagCompound {
  source: string;
  noetherZ: number;
  noetherPValue: number;
}

export interface TurningPointRowForNoetherCompound {
  source: string;
  tprZ: number;
  tprPValue: number;
}

export type NoetherTurningPointLagBucket =
  | 'coherent-trend'
  | 'coherent-cyclic'
  | 'cross-lag-flip-trend-lag2-only'
  | 'cross-lag-flip-trend-lag1-only'
  | 'lag1-only'
  | 'lag2-only'
  | 'no-evidence';

export interface NoetherTurningPointLagJoinedRow {
  source: string;
  noetherZ: number;
  noetherPValue: number;
  tprZ: number;
  tprPValue: number;
  noetherDecisive: boolean;
  tprDecisive: boolean;
  /** -tprZ in the trend-positive sign convention. */
  lag1TrendSignal: number;
  /** +noetherZ in the trend-positive sign convention. */
  lag2TrendSignal: number;
  bucket: NoetherTurningPointLagBucket;
}

export interface NoetherTurningPointLagReport {
  alpha: number;
  rows: NoetherTurningPointLagJoinedRow[];
  bucketCounts: Record<NoetherTurningPointLagBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  coherentRows: number;
  crossLagFlipRows: number;
  lagSpecificRows: number;
  sourcesOnlyInNoether: string[];
  sourcesOnlyInTurningPoint: string[];
}

export function classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
  noetherRows: ReadonlyArray<NoetherRowForLagCompound>,
  turningPointRows: ReadonlyArray<TurningPointRowForNoetherCompound>,
  alpha = 0.05,
): NoetherTurningPointLagReport {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }

  const noetherBySrc = new Map<string, NoetherRowForLagCompound>();
  for (const r of noetherRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound: noether row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.noetherZ) ||
      !Number.isFinite(r.noetherPValue) ||
      r.noetherPValue <= 0 ||
      r.noetherPValue > 1
    ) {
      throw new Error(
        `classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound: noether row '${r.source}' has invalid noetherZ/noetherPValue`,
      );
    }
    if (noetherBySrc.has(r.source)) {
      throw new Error(
        `classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound: duplicate noether source '${r.source}'`,
      );
    }
    noetherBySrc.set(r.source, r);
  }

  const tprBySrc = new Map<string, TurningPointRowForNoetherCompound>();
  for (const r of turningPointRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound: turning-point row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.tprZ) ||
      !Number.isFinite(r.tprPValue) ||
      r.tprPValue <= 0 ||
      r.tprPValue > 1
    ) {
      throw new Error(
        `classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound: turning-point row '${r.source}' has invalid tprZ/tprPValue`,
      );
    }
    if (tprBySrc.has(r.source)) {
      throw new Error(
        `classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound: duplicate turning-point source '${r.source}'`,
      );
    }
    tprBySrc.set(r.source, r);
  }

  const sourcesOnlyInNoether: string[] = [];
  const sourcesOnlyInTurningPoint: string[] = [];
  for (const s of noetherBySrc.keys()) {
    if (!tprBySrc.has(s)) sourcesOnlyInNoether.push(s);
  }
  for (const s of tprBySrc.keys()) {
    if (!noetherBySrc.has(s)) sourcesOnlyInTurningPoint.push(s);
  }
  sourcesOnlyInNoether.sort();
  sourcesOnlyInTurningPoint.sort();

  const joinedSources: string[] = [];
  for (const s of noetherBySrc.keys()) {
    if (tprBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: NoetherTurningPointLagJoinedRow[] = [];
  const bucketCounts: Record<NoetherTurningPointLagBucket, number> = {
    'coherent-trend': 0,
    'coherent-cyclic': 0,
    'cross-lag-flip-trend-lag2-only': 0,
    'cross-lag-flip-trend-lag1-only': 0,
    'lag1-only': 0,
    'lag2-only': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  let coherentRows = 0;
  let crossLagFlipRows = 0;
  let lagSpecificRows = 0;

  for (const src of joinedSources) {
    const no = noetherBySrc.get(src)!;
    const tp = tprBySrc.get(src)!;
    const noetherDecisive = no.noetherPValue < alpha;
    const tprDecisive = tp.tprPValue < alpha;
    const anyDecisive = noetherDecisive || tprDecisive;
    if (noetherDecisive && tprDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    const lag1TrendSignal = -tp.tprZ;
    const lag2TrendSignal = no.noetherZ;

    let bucket: NoetherTurningPointLagBucket;
    if (!anyDecisive) {
      bucket = 'no-evidence';
    } else if (noetherDecisive && !tprDecisive) {
      bucket = 'lag2-only';
      lagSpecificRows += 1;
    } else if (tprDecisive && !noetherDecisive) {
      bucket = 'lag1-only';
      lagSpecificRows += 1;
    } else {
      // both decisive: classify by sign agreement on
      // the trend-signal axis
      const lag1Sign =
        lag1TrendSignal > 0 ? 1 : lag1TrendSignal < 0 ? -1 : 0;
      const lag2Sign =
        lag2TrendSignal > 0 ? 1 : lag2TrendSignal < 0 ? -1 : 0;
      if (lag1Sign > 0 && lag2Sign > 0) {
        bucket = 'coherent-trend';
        coherentRows += 1;
      } else if (lag1Sign < 0 && lag2Sign < 0) {
        bucket = 'coherent-cyclic';
        coherentRows += 1;
      } else if (lag1Sign < 0 && lag2Sign > 0) {
        bucket = 'cross-lag-flip-trend-lag2-only';
        crossLagFlipRows += 1;
      } else if (lag1Sign > 0 && lag2Sign < 0) {
        bucket = 'cross-lag-flip-trend-lag1-only';
        crossLagFlipRows += 1;
      } else {
        // exact zero on one signal even though decisive
        // -- should be effectively unreachable in
        // practice but classified conservatively as
        // lag-only based on which axis is decisive.
        // Both being decisive with exact zero on one
        // signal is a numerical edge case; bucket as
        // the SAME logic as lag-only on the non-zero
        // side.
        bucket =
          lag1Sign === 0 ? 'lag2-only' : 'lag1-only';
        lagSpecificRows += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      noetherZ: no.noetherZ,
      noetherPValue: no.noetherPValue,
      tprZ: tp.tprZ,
      tprPValue: tp.tprPValue,
      noetherDecisive,
      tprDecisive,
      lag1TrendSignal,
      lag2TrendSignal,
      bucket,
    });
  }

  return {
    alpha,
    rows,
    bucketCounts,
    bothDecisive,
    atLeastOneDecisive,
    coherentRows,
    crossLagFlipRows,
    lagSpecificRows,
    sourcesOnlyInNoether,
    sourcesOnlyInTurningPoint,
  };
}
