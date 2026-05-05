/**
 * classifyAxis209Axis208WallisMooreSpearmanFootrulePhaseSmoothnessVsRankAlignmentCompound:
 * cross-axis 7-bucket diagnostic joining axis-209
 * WALLIS-MOORE 1941 PHASE-FREQUENCY (`wmZ`,
 * `wmPValue`) with axis-208 SPEARMAN 1906 FOOTRULE RANK
 * DISTANCE vs TIME (`sfZ`, `sfPValue`) on a per-source
 * basis.
 *
 * STRUCTURAL CLAIM. Both axes test for departure from
 * iid randomness in the gap-filled daily token series,
 * but at STRUCTURALLY ORTHOGONAL SCALES and via
 * DIFFERENT REDUCTIONS:
 *
 *   - WALLIS-MOORE PHASE-FREQUENCY (axis-209) is a
 *     LOCAL CONTIGUOUS-PHASE counting statistic on the
 *     SIGN PATTERN of consecutive first-differences. It
 *     captures SMOOTHNESS / OSCILLATION FREQUENCY:
 *       - wmZ << 0 = TOO FEW phases = SMOOTH /
 *         positively-serially-correlated (or trending)
 *         dynamics.
 *       - wmZ >> 0 = TOO MANY phases = ZIGZAG /
 *         negatively-serially-correlated dynamics.
 *
 *       wmSmoothSignal = -wmZ   ( + = smooth/trending,
 *                                 - = zigzag/oscillating )
 *
 *   - SPEARMAN FOOTRULE (axis-208) is a GLOBAL L1
 *     RANK-DISTANCE between the value-rank vector and
 *     the time-identity-rank vector. It captures
 *     MONOTONE-TREND DIRECTION and STRENGTH:
 *       - sfZ << 0 = monotone UP-TREND (value-rank
 *         tracks time-identity).
 *       - sfZ >> 0 = monotone DOWN-TREND.
 *
 *       sfTrendUpSignal = -sfZ   ( + = up-trend,
 *                                  - = down-trend )
 *
 * The two probes are STRUCTURALLY ORTHOGONAL because
 * they use DIFFERENT INFORMATION at DIFFERENT SCALES:
 *
 *   - DIFFERENT INFORMATION CONTENT.
 *     Wallis-Moore uses ONLY the SIGN PATTERN of
 *     consecutive differences (an L0-counting statistic
 *     on a sequence of binary signs). Footrule uses
 *     the FULL RANK PERMUTATION reduced to its L1
 *     distance from identity. A series that is
 *     locally smooth (long monotone phases) but with
 *     ranks shuffled away from time identity (e.g. a
 *     random permutation that happens to have few
 *     turning points) gives wmZ << 0 but sfZ near 0.
 *     Conversely, a series with perfect
 *     value-rank-vs-time-identity match (strict
 *     monotone trend) gives BOTH sfZ << 0 (perfect
 *     identity) AND wmZ << 0 (single phase).
 *
 *   - DIFFERENT SCALE.
 *     Wallis-Moore is LOCAL (sensitive to the
 *     sign-of-difference pattern at every consecutive
 *     pair). Footrule is GLOBAL (sensitive to the
 *     overall rank-vs-time alignment). A series with
 *     a monotone trend overlaid with high-frequency
 *     noise gives sfZ << 0 (clear trend in ranks) but
 *     wmZ near 0 or even >> 0 (noise dominates the
 *     phase count).
 *
 *   - DIFFERENT TIE BEHAVIOUR.
 *     Wallis-Moore SKIPS tied differences entirely
 *     (effective n is nNonTied <= n - 1). Footrule
 *     uses MID-RANKS for ties (effective n stays at n).
 *     A series with many zero-zero day pairs (very
 *     common in pew data with intermittent sources)
 *     gives Wallis-Moore much smaller effective n than
 *     footrule.
 *
 * They can:
 *
 *   - AGREE in the "smooth-monotone-trend" case: a
 *     trending series gives BOTH wmZ << 0 (smooth) AND
 *     sfZ << 0 (up-trend) -- bucket
 *     `smooth-up-trend`. Symmetric case
 *     `smooth-down-trend` for wmZ << 0 + sfZ >> 0.
 *
 *   - DISAGREE INFORMATIVELY in the "zigzag-with-trend"
 *     case: wmZ >> 0 (anti-correlated dynamics) AND sfZ
 *     decisive. This signature -- frequent reversals
 *     yet a clear rank-vs-time alignment -- points to
 *     SAWTOOTH-WITH-DRIFT or LIMIT-CYCLE-WITH-RAMP
 *     dynamics. Surfaced as `zigzag-with-trend`.
 *
 *   - SHOW only ONE decisive: smoothness without trend
 *     (smoothness-only-smooth or
 *     smoothness-only-zigzag) or trend without
 *     smoothness call (footrule-only).
 *
 *   - NEITHER decisive: `no-evidence`.
 *
 * Buckets (alpha default 0.05):
 *
 *   - `smooth-up-trend`: wm decisive (wmZ < 0) AND
 *     sf decisive (sfZ < 0) -- smooth + UP trend.
 *   - `smooth-down-trend`: wm decisive (wmZ < 0) AND
 *     sf decisive (sfZ > 0) -- smooth + DOWN trend.
 *   - `zigzag-with-trend`: wm decisive (wmZ > 0) AND
 *     sf decisive -- ANTI-CORRELATED dynamics yet a
 *     clear rank-vs-time alignment (sawtooth-with-drift).
 *   - `smoothness-only-smooth`: wm decisive (wmZ < 0)
 *     and sf NOT decisive -- smooth but no trend
 *     (positively-serially-correlated stationary
 *     process, or trend too weak for footrule).
 *   - `smoothness-only-zigzag`: wm decisive (wmZ > 0)
 *     and sf NOT decisive -- zigzag but no trend
 *     (negatively-serially-correlated stationary
 *     process).
 *   - `footrule-only`: sf decisive but wm NOT decisive
 *     -- a clear rank-vs-time alignment that the
 *     phase-count test fails to call (small n, or
 *     trend with neutral phase count).
 *   - `no-evidence`: neither decisive.
 *
 * The `byJointSignQuadrant` cross-tab counts each row
 * into exactly one of {smoothUp, smoothDown, zigzagUp,
 * zigzagDown, anyMissingDecisive}.
 *
 * Pure function: no I/O, deterministic source-asc
 * ordering, throws on duplicate sources, non-finite
 * inputs, p-values outside (0, 1], or alpha outside
 * (0, 0.5].
 *
 * References:
 *   Wallis, W. A. & Moore, G. H., "A significance test
 *     for time series analyses", *J. Amer. Statist.
 *     Assoc.* 36 (1941), pp. 401-409.
 *   Spearman, C., "Footrule for measuring correlation",
 *     *Brit. J. Psychol.* 2 (1906), pp. 89-108.
 *   Diaconis, P. & Graham, R. L., "Spearman's footrule
 *     as a measure of disarray", *J. Roy. Statist. Soc.
 *     B* 39 (1977), pp. 262-268.
 */

export interface WallisMoorePhaseRowForSpearmanFootruleCompound {
  source: string;
  wmZ: number;
  wmPValue: number;
}

export interface SpearmanFootruleRowForWallisMoorePhaseCompound {
  source: string;
  sfZ: number;
  sfPValue: number;
}

export type Axis209Axis208WallisMooreSpearmanFootruleBucket =
  | 'smooth-up-trend'
  | 'smooth-down-trend'
  | 'zigzag-with-trend'
  | 'smoothness-only-smooth'
  | 'smoothness-only-zigzag'
  | 'footrule-only'
  | 'no-evidence';

export interface Axis209Axis208WallisMooreSpearmanFootruleJoinedRow {
  source: string;
  wmZ: number;
  wmPValue: number;
  sfZ: number;
  sfPValue: number;
  wmDecisive: boolean;
  sfDecisive: boolean;
  /** -wmZ (positive = smooth/trending). */
  wmSmoothSignal: number;
  /** -sfZ (positive = up-trend). */
  sfTrendUpSignal: number;
  bucket: Axis209Axis208WallisMooreSpearmanFootruleBucket;
  /**
   * Joint quadrant when both are decisive:
   *   smoothUp | smoothDown | zigzagUp | zigzagDown
   * null when either is non-decisive.
   */
  jointSignQuadrant:
    | 'smoothUp'
    | 'smoothDown'
    | 'zigzagUp'
    | 'zigzagDown'
    | null;
}

export interface Axis209Axis208WallisMooreSpearmanFootruleReport {
  alpha: number;
  rows: Axis209Axis208WallisMooreSpearmanFootruleJoinedRow[];
  bucketCounts: Record<
    Axis209Axis208WallisMooreSpearmanFootruleBucket,
    number
  >;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointSignQuadrant: {
    smoothUp: number;
    smoothDown: number;
    zigzagUp: number;
    zigzagDown: number;
    anyMissingDecisive: number;
  };
  sourcesOnlyInWallisMoore: string[];
  sourcesOnlyInSpearmanFootrule: string[];
}

export function classifyAxis209Axis208WallisMooreSpearmanFootrulePhaseSmoothnessVsRankAlignmentCompound(
  wallisMooreRows: ReadonlyArray<WallisMoorePhaseRowForSpearmanFootruleCompound>,
  spearmanFootruleRows: ReadonlyArray<SpearmanFootruleRowForWallisMoorePhaseCompound>,
  alpha = 0.05,
): Axis209Axis208WallisMooreSpearmanFootruleReport {
  const fnName =
    'classifyAxis209Axis208WallisMooreSpearmanFootrulePhaseSmoothnessVsRankAlignmentCompound';
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(`${fnName}: alpha must be in (0, 0.5] (got ${alpha})`);
  }

  const wmBySrc = new Map<
    string,
    WallisMoorePhaseRowForSpearmanFootruleCompound
  >();
  for (const r of wallisMooreRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `${fnName}: wallis-moore row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.wmZ) ||
      !Number.isFinite(r.wmPValue) ||
      r.wmPValue <= 0 ||
      r.wmPValue > 1
    ) {
      throw new Error(
        `${fnName}: wallis-moore row '${r.source}' has invalid wmZ/wmPValue`,
      );
    }
    if (wmBySrc.has(r.source)) {
      throw new Error(
        `${fnName}: duplicate wallis-moore source '${r.source}'`,
      );
    }
    wmBySrc.set(r.source, r);
  }

  const sfBySrc = new Map<
    string,
    SpearmanFootruleRowForWallisMoorePhaseCompound
  >();
  for (const r of spearmanFootruleRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `${fnName}: spearman-footrule row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.sfZ) ||
      !Number.isFinite(r.sfPValue) ||
      r.sfPValue <= 0 ||
      r.sfPValue > 1
    ) {
      throw new Error(
        `${fnName}: spearman-footrule row '${r.source}' has invalid sfZ/sfPValue`,
      );
    }
    if (sfBySrc.has(r.source)) {
      throw new Error(
        `${fnName}: duplicate spearman-footrule source '${r.source}'`,
      );
    }
    sfBySrc.set(r.source, r);
  }

  const sourcesOnlyInWallisMoore: string[] = [];
  const sourcesOnlyInSpearmanFootrule: string[] = [];
  for (const s of wmBySrc.keys()) {
    if (!sfBySrc.has(s)) sourcesOnlyInWallisMoore.push(s);
  }
  for (const s of sfBySrc.keys()) {
    if (!wmBySrc.has(s)) sourcesOnlyInSpearmanFootrule.push(s);
  }
  sourcesOnlyInWallisMoore.sort();
  sourcesOnlyInSpearmanFootrule.sort();

  const joinedSources: string[] = [];
  for (const s of wmBySrc.keys()) {
    if (sfBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis209Axis208WallisMooreSpearmanFootruleJoinedRow[] = [];
  const bucketCounts: Record<
    Axis209Axis208WallisMooreSpearmanFootruleBucket,
    number
  > = {
    'smooth-up-trend': 0,
    'smooth-down-trend': 0,
    'zigzag-with-trend': 0,
    'smoothness-only-smooth': 0,
    'smoothness-only-zigzag': 0,
    'footrule-only': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  const byJointSignQuadrant = {
    smoothUp: 0,
    smoothDown: 0,
    zigzagUp: 0,
    zigzagDown: 0,
    anyMissingDecisive: 0,
  };

  for (const src of joinedSources) {
    const wm = wmBySrc.get(src)!;
    const sf = sfBySrc.get(src)!;
    const wmDecisive = wm.wmPValue < alpha;
    const sfDecisive = sf.sfPValue < alpha;
    const anyDecisive = wmDecisive || sfDecisive;
    if (wmDecisive && sfDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    const wmSmoothSignal = -wm.wmZ;
    const sfTrendUpSignal = -sf.sfZ;

    let bucket: Axis209Axis208WallisMooreSpearmanFootruleBucket;
    let jointSignQuadrant:
      | 'smoothUp'
      | 'smoothDown'
      | 'zigzagUp'
      | 'zigzagDown'
      | null = null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointSignQuadrant.anyMissingDecisive += 1;
    } else if (wmDecisive && !sfDecisive) {
      bucket =
        wm.wmZ < 0 ? 'smoothness-only-smooth' : 'smoothness-only-zigzag';
      byJointSignQuadrant.anyMissingDecisive += 1;
    } else if (sfDecisive && !wmDecisive) {
      bucket = 'footrule-only';
      byJointSignQuadrant.anyMissingDecisive += 1;
    } else {
      // Both decisive: classify joint sign.
      const wmSmooth = wm.wmZ < 0;
      const sfUp = sf.sfZ < 0;
      if (wmSmooth && sfUp) {
        bucket = 'smooth-up-trend';
        jointSignQuadrant = 'smoothUp';
        byJointSignQuadrant.smoothUp += 1;
      } else if (wmSmooth && !sfUp) {
        bucket = 'smooth-down-trend';
        jointSignQuadrant = 'smoothDown';
        byJointSignQuadrant.smoothDown += 1;
      } else if (!wmSmooth && sfUp) {
        bucket = 'zigzag-with-trend';
        jointSignQuadrant = 'zigzagUp';
        byJointSignQuadrant.zigzagUp += 1;
      } else {
        bucket = 'zigzag-with-trend';
        jointSignQuadrant = 'zigzagDown';
        byJointSignQuadrant.zigzagDown += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      wmZ: wm.wmZ,
      wmPValue: wm.wmPValue,
      sfZ: sf.sfZ,
      sfPValue: sf.sfPValue,
      wmDecisive,
      sfDecisive,
      wmSmoothSignal,
      sfTrendUpSignal,
      bucket,
      jointSignQuadrant,
    });
  }

  return {
    alpha,
    rows,
    bucketCounts,
    bothDecisive,
    atLeastOneDecisive,
    byJointSignQuadrant,
    sourcesOnlyInWallisMoore,
    sourcesOnlyInSpearmanFootrule,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis209Axis208WallisMooreSpearmanFootruleReport.
 *
 *   axis-209xaxis-208 alpha=<a> n=<rows> both=<k>/<rows> qd[smU/smD/zgU/zgD]=a/b/c/d buckets[smU/smD/zwT/sos/soz/fo/ne]=v/w/x/y/z/u/t
 *
 * Pure deterministic; no I/O.
 */
export function summarizeAxis209Axis208WallisMooreSpearmanFootruleReport(
  report: Axis209Axis208WallisMooreSpearmanFootruleReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const q = report.byJointSignQuadrant;
  const b = report.bucketCounts;
  return (
    `axis-209xaxis-208 alpha=${a} n=${n} both=${report.bothDecisive}/${n} ` +
    `qd[smU/smD/zgU/zgD]=${q.smoothUp}/${q.smoothDown}/${q.zigzagUp}/${q.zigzagDown} ` +
    `buckets[smU/smD/zwT/sos/soz/fo/ne]=${b['smooth-up-trend']}/${b['smooth-down-trend']}/${b['zigzag-with-trend']}/${b['smoothness-only-smooth']}/${b['smoothness-only-zigzag']}/${b['footrule-only']}/${b['no-evidence']}`
  );
}

/**
 * Compute the SMOOTHNESS-COHERENT TREND DIRECTION
 * VERDICT over an
 * Axis209Axis208WallisMooreSpearmanFootruleReport.
 * Returns the dominant direction across the
 * `smooth-up-trend` and `smooth-down-trend` buckets:
 *
 *   - 'up'        if smooth-up-trend > smooth-down-trend
 *   - 'down'      if smooth-down-trend > smooth-up-trend
 *   - 'tied'      if equal AND non-zero
 *   - 'no-smooth-coherent-evidence' if both are zero
 *
 * The `zigzag-with-trend` bucket is INTENTIONALLY
 * EXCLUDED -- those rows have a clear rank-vs-time
 * alignment but ANTI-CORRELATED phase dynamics, which
 * is a sawtooth-with-drift signature, not a clean
 * smooth-trend verdict. Likewise the smoothness-only
 * and footrule-only buckets do not contribute (they
 * lack a both-axis-confirmed direction).
 *
 * Pure deterministic.
 */
export function smoothCoherentTrendDirectionVerdict(
  report: Axis209Axis208WallisMooreSpearmanFootruleReport,
): {
  direction: 'up' | 'down' | 'tied' | 'no-smooth-coherent-evidence';
  upCount: number;
  downCount: number;
  contributingRows: number;
} {
  const upCount = report.bucketCounts['smooth-up-trend'];
  const downCount = report.bucketCounts['smooth-down-trend'];
  const contributingRows = upCount + downCount;
  let direction: 'up' | 'down' | 'tied' | 'no-smooth-coherent-evidence';
  if (contributingRows === 0)
    direction = 'no-smooth-coherent-evidence';
  else if (upCount > downCount) direction = 'up';
  else if (downCount > upCount) direction = 'down';
  else direction = 'tied';
  return { direction, upCount, downCount, contributingRows };
}

/**
 * Render the smoothCoherentTrendDirectionVerdict result
 * as a single-line, log-friendly headline:
 *
 *   axis-209xaxis-208-verdict dir=<direction> up=<u> down=<d> contributing=<c>
 *
 * Pure deterministic; no I/O.
 */
export function summarizeSmoothCoherentTrendDirectionVerdict(
  verdict: ReturnType<typeof smoothCoherentTrendDirectionVerdict>,
): string {
  return (
    `axis-209xaxis-208-verdict dir=${verdict.direction} ` +
    `up=${verdict.upCount} down=${verdict.downCount} ` +
    `contributing=${verdict.contributingRows}`
  );
}
