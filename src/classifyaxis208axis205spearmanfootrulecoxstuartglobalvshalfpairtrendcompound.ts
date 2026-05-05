/**
 * classifyAxis208Axis205SpearmanFootruleCoxStuartGlobalVsHalfPairTrendCompound:
 * cross-axis 7-bucket diagnostic joining axis-208
 * SPEARMAN 1906 FOOTRULE RANK DISTANCE vs TIME
 * (`sfZ`, `sfPValue`) with axis-205 COX-STUART 1955
 * SIGN-PAIRS lag-c paired sign test
 * (`csZ`, `csPValue`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes test for MONOTONIC TREND
 * in the gap-filled daily token series, but at
 * STRUCTURALLY ORTHOGONAL SCALES and via DIFFERENT
 * REDUCTIONS:
 *
 *   - SPEARMAN FOOTRULE (axis-208) uses the FULL
 *     RANK-PERMUTATION of the n values and reduces it
 *     to the L1 DISTANCE from the time-identity rank
 *     vector. It is a GLOBAL measure that integrates
 *     EVERY rank displacement; sensitive to fine-grained
 *     monotone-trend structure across the WHOLE series.
 *     SIGN: sfZ << 0 = up-trend (rank-vector close to
 *     identity); sfZ >> 0 = down-trend.
 *
 *       sfTrendUpSignal = -sfZ   ( + = up-trend,
 *                                  - = down-trend )
 *
 *   - COX-STUART SIGN-PAIRS (axis-205) uses ONLY the
 *     SIGNS of the n/2 paired differences (v[i+c] - v[i])
 *     at lag c = ceil(n/2) -- a HALF-PERIOD-OFFSET
 *     pairing. It is a PAIRED-SIGN summary that loses
 *     all magnitude information AND all rank information
 *     EXCEPT the binary up/down across the half-series
 *     offset. SIGN: csZ >> 0 = up-trend (second half
 *     systematically higher than first); csZ << 0 =
 *     down-trend.
 *
 *       csTrendUpSignal = +csZ   ( + = up-trend,
 *                                  - = down-trend )
 *
 * The two probes are STRUCTURALLY ORTHOGONAL because
 * they use DIFFERENT INFORMATION and DIFFERENT METRICS:
 *
 *   - DIFFERENT INFORMATION CONTENT.
 *     Footrule uses ALL rank displacements; Cox-Stuart
 *     uses only n/2 paired SIGNS. A series whose first
 *     half is monotone increasing then crashes in the
 *     second half can show |sfZ| strongly negative
 *     (the rank pattern within each half mostly tracks
 *     time identity) while csZ is null-ish (paired
 *     differences split evenly between positive and
 *     negative across the halves).
 *
 *   - DIFFERENT TEMPORAL SCALES.
 *     Footrule probes the LOCAL rank-vs-time alignment
 *     at EVERY index; Cox-Stuart probes the GLOBAL
 *     first-half-vs-second-half offset. A pure step
 *     shift between halves (constant low for first
 *     half, constant high for second half) gives
 *     csZ very large (every paired difference positive)
 *     but a relatively MODEST sfZ (rank ties within
 *     each half spread out the L1 distance).
 *
 *   - DIFFERENT TIE BEHAVIOUR.
 *     Footrule uses MID-RANKS so ties contribute
 *     fractional rank displacements; Cox-Stuart drops
 *     tied paired differences from the count entirely.
 *     A series with many zero-zero day pairs (very
 *     common in pew data with intermittent sources)
 *     gives Cox-Stuart effective n much smaller than
 *     footrule effective n, biasing the two probes
 *     to different sensitivities.
 *
 * They can:
 *
 *   - AGREE strongly in the "coherent-monotone" case:
 *     a smoothly trending series gives BOTH sfZ << 0
 *     (or >> 0) AND csZ >> 0 (or << 0) with matching
 *     directional sign. We surface this as the four-way
 *     joint quadrant cross-tab when both decisive.
 *
 *   - AGREE in DIRECTION but only ONE is decisive:
 *     sfZ decisive + csZ borderline (or vice versa),
 *     same direction. Surfaced as the "global-only"
 *     or "half-pair-only" buckets.
 *
 *   - DISAGREE INFORMATIVELY: when they BOTH decisive
 *     but DIFFERENT directions, this is the signature
 *     of a NON-MONOTONIC SHAPE (e.g. U-shape,
 *     N-shape, regime-shift) where global rank ordering
 *     and half-pair ordering yield opposing directional
 *     conclusions. Surfaced as the
 *     `direction-conflict` bucket.
 *
 * Buckets (alpha default 0.05):
 *
 *   - `coherent-up-trend`: sfZ decisive (sfZ < 0) AND
 *     cs decisive (csZ > 0) -- both agree on
 *     INCREASING monotone trend.
 *   - `coherent-down-trend`: sfZ decisive (sfZ > 0)
 *     AND cs decisive (csZ < 0) -- both agree on
 *     DECREASING monotone trend.
 *   - `direction-conflict`: BOTH decisive but
 *     DIFFERENT directions -- non-monotonic shape
 *     (U, N, regime shift). Diagnostic for series
 *     that fool simple monotone-trend tests.
 *   - `global-only-up`: sfZ decisive up, cs not
 *     decisive -- the global rank-vs-time L1 distance
 *     rejects the uniform-permutation H0 at alpha but
 *     the half-pair sign test does not. Typical of
 *     series with many small consistent rank shifts
 *     that don't accumulate into half-pair sign
 *     differences (e.g. weak but consistent drift).
 *   - `global-only-down`: same, decreasing direction.
 *   - `half-pair-only`: cs decisive, sf not -- the
 *     half-pair sign test rejects but the global
 *     L1 rank distance does not. Typical of pure step
 *     shifts between halves where within-half rank
 *     order is otherwise random.
 *   - `no-evidence`: neither decisive.
 *
 * The `byJointSignQuadrant` cross-tab counts each row
 * into exactly one of {bothUp, bothDown,
 * sfUpCsDown, sfDownCsUp, anyMissingDecisive}. The
 * latter pair (sfUpCsDown, sfDownCsUp) coincide with
 * the `direction-conflict` bucket.
 *
 * Pure function: no I/O, deterministic source-asc
 * ordering, throws on duplicate sources, non-finite
 * inputs, p-values outside (0, 1], or alpha outside
 * (0, 0.5].
 *
 * Reference:
 *   Spearman, C., "Footrule for measuring correlation",
 *     *British Journal of Psychology* 2 (1906),
 *     pp. 89-108.
 *   Diaconis, P. & Graham, R. L., "Spearman's footrule
 *     as a measure of disarray", *J. Roy. Statist. Soc.
 *     Series B* 39 (1977), pp. 262-268.
 *   Cox, D. R. & Stuart, A., "Some quick sign tests for
 *     trend in location and dispersion", *Biometrika*
 *     42 (1955), pp. 80-95.
 */

export interface SpearmanFootruleRowForCoxStuartCompound {
  source: string;
  sfZ: number;
  sfPValue: number;
}

export interface CoxStuartRowForSpearmanFootruleCompound {
  source: string;
  csZ: number;
  csPValue: number;
}

export type Axis208Axis205SpearmanFootruleCoxStuartBucket =
  | 'coherent-up-trend'
  | 'coherent-down-trend'
  | 'direction-conflict'
  | 'global-only-up'
  | 'global-only-down'
  | 'half-pair-only'
  | 'no-evidence';

export interface Axis208Axis205SpearmanFootruleCoxStuartJoinedRow {
  source: string;
  sfZ: number;
  sfPValue: number;
  csZ: number;
  csPValue: number;
  sfDecisive: boolean;
  csDecisive: boolean;
  /** -sfZ in the trend-up-positive sign convention. */
  sfTrendUpSignal: number;
  /** +csZ in the trend-up-positive sign convention. */
  csTrendUpSignal: number;
  bucket: Axis208Axis205SpearmanFootruleCoxStuartBucket;
  /**
   * Joint quadrant when both are decisive:
   *   bothUp | bothDown | sfUpCsDown | sfDownCsUp
   * null when either is non-decisive.
   */
  jointSignQuadrant:
    | 'bothUp'
    | 'bothDown'
    | 'sfUpCsDown'
    | 'sfDownCsUp'
    | null;
}

export interface Axis208Axis205SpearmanFootruleCoxStuartReport {
  alpha: number;
  rows: Axis208Axis205SpearmanFootruleCoxStuartJoinedRow[];
  bucketCounts: Record<
    Axis208Axis205SpearmanFootruleCoxStuartBucket,
    number
  >;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointSignQuadrant: {
    bothUp: number;
    bothDown: number;
    sfUpCsDown: number;
    sfDownCsUp: number;
    anyMissingDecisive: number;
  };
  sourcesOnlyInSpearmanFootrule: string[];
  sourcesOnlyInCoxStuart: string[];
}

export function classifyAxis208Axis205SpearmanFootruleCoxStuartGlobalVsHalfPairTrendCompound(
  spearmanFootruleRows: ReadonlyArray<SpearmanFootruleRowForCoxStuartCompound>,
  coxStuartRows: ReadonlyArray<CoxStuartRowForSpearmanFootruleCompound>,
  alpha = 0.05,
): Axis208Axis205SpearmanFootruleCoxStuartReport {
  const fnName =
    'classifyAxis208Axis205SpearmanFootruleCoxStuartGlobalVsHalfPairTrendCompound';
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(`${fnName}: alpha must be in (0, 0.5] (got ${alpha})`);
  }

  const sfBySrc = new Map<string, SpearmanFootruleRowForCoxStuartCompound>();
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

  const csBySrc = new Map<string, CoxStuartRowForSpearmanFootruleCompound>();
  for (const r of coxStuartRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `${fnName}: cox-stuart row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.csZ) ||
      !Number.isFinite(r.csPValue) ||
      r.csPValue <= 0 ||
      r.csPValue > 1
    ) {
      throw new Error(
        `${fnName}: cox-stuart row '${r.source}' has invalid csZ/csPValue`,
      );
    }
    if (csBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate cox-stuart source '${r.source}'`);
    }
    csBySrc.set(r.source, r);
  }

  const sourcesOnlyInSpearmanFootrule: string[] = [];
  const sourcesOnlyInCoxStuart: string[] = [];
  for (const s of sfBySrc.keys()) {
    if (!csBySrc.has(s)) sourcesOnlyInSpearmanFootrule.push(s);
  }
  for (const s of csBySrc.keys()) {
    if (!sfBySrc.has(s)) sourcesOnlyInCoxStuart.push(s);
  }
  sourcesOnlyInSpearmanFootrule.sort();
  sourcesOnlyInCoxStuart.sort();

  const joinedSources: string[] = [];
  for (const s of sfBySrc.keys()) {
    if (csBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis208Axis205SpearmanFootruleCoxStuartJoinedRow[] = [];
  const bucketCounts: Record<
    Axis208Axis205SpearmanFootruleCoxStuartBucket,
    number
  > = {
    'coherent-up-trend': 0,
    'coherent-down-trend': 0,
    'direction-conflict': 0,
    'global-only-up': 0,
    'global-only-down': 0,
    'half-pair-only': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  const byJointSignQuadrant = {
    bothUp: 0,
    bothDown: 0,
    sfUpCsDown: 0,
    sfDownCsUp: 0,
    anyMissingDecisive: 0,
  };

  for (const src of joinedSources) {
    const sf = sfBySrc.get(src)!;
    const cs = csBySrc.get(src)!;
    const sfDecisive = sf.sfPValue < alpha;
    const csDecisive = cs.csPValue < alpha;
    const anyDecisive = sfDecisive || csDecisive;
    if (sfDecisive && csDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    // Trend-up-positive signals (so positive = increasing):
    const sfTrendUpSignal = -sf.sfZ;
    const csTrendUpSignal = cs.csZ;

    let bucket: Axis208Axis205SpearmanFootruleCoxStuartBucket;
    let jointSignQuadrant:
      | 'bothUp'
      | 'bothDown'
      | 'sfUpCsDown'
      | 'sfDownCsUp'
      | null = null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointSignQuadrant.anyMissingDecisive += 1;
    } else if (sfDecisive && !csDecisive) {
      bucket = sf.sfZ < 0 ? 'global-only-up' : 'global-only-down';
      byJointSignQuadrant.anyMissingDecisive += 1;
    } else if (csDecisive && !sfDecisive) {
      bucket = 'half-pair-only';
      byJointSignQuadrant.anyMissingDecisive += 1;
    } else {
      // Both decisive: classify joint sign.
      const sfUp = sf.sfZ < 0;
      const csUp = cs.csZ > 0;
      if (sfUp && csUp) {
        bucket = 'coherent-up-trend';
        jointSignQuadrant = 'bothUp';
        byJointSignQuadrant.bothUp += 1;
      } else if (!sfUp && !csUp) {
        bucket = 'coherent-down-trend';
        jointSignQuadrant = 'bothDown';
        byJointSignQuadrant.bothDown += 1;
      } else if (sfUp && !csUp) {
        bucket = 'direction-conflict';
        jointSignQuadrant = 'sfUpCsDown';
        byJointSignQuadrant.sfUpCsDown += 1;
      } else {
        bucket = 'direction-conflict';
        jointSignQuadrant = 'sfDownCsUp';
        byJointSignQuadrant.sfDownCsUp += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      sfZ: sf.sfZ,
      sfPValue: sf.sfPValue,
      csZ: cs.csZ,
      csPValue: cs.csPValue,
      sfDecisive,
      csDecisive,
      sfTrendUpSignal,
      csTrendUpSignal,
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
    sourcesOnlyInSpearmanFootrule,
    sourcesOnlyInCoxStuart,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis208Axis205SpearmanFootruleCoxStuartReport.
 *
 *   axis-208xaxis-205 alpha=<alpha> n=<rows> both=<k>/<rows> qd[bU/bD/sUcD/sDcU]=a/b/c/d buckets[cuT/cdT/dc/goU/goD/hpo/ne]=v/w/x/y/z/u/t
 *
 * Quadrant cells:
 *   bU    = bothUp
 *   bD    = bothDown
 *   sUcD  = sfUpCsDown    (direction conflict)
 *   sDcU  = sfDownCsUp    (direction conflict)
 *
 * Bucket cells:
 *   cuT = coherent-up-trend
 *   cdT = coherent-down-trend
 *   dc  = direction-conflict
 *   goU = global-only-up
 *   goD = global-only-down
 *   hpo = half-pair-only
 *   ne  = no-evidence
 *
 * Pure deterministic function of the report; no I/O.
 */
export function summarizeAxis208Axis205SpearmanFootruleCoxStuartReport(
  report: Axis208Axis205SpearmanFootruleCoxStuartReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const q = report.byJointSignQuadrant;
  const b = report.bucketCounts;
  return (
    `axis-208xaxis-205 alpha=${a} n=${n} both=${report.bothDecisive}/${n} ` +
    `qd[bU/bD/sUcD/sDcU]=${q.bothUp}/${q.bothDown}/${q.sfUpCsDown}/${q.sfDownCsUp} ` +
    `buckets[cuT/cdT/dc/goU/goD/hpo/ne]=${b['coherent-up-trend']}/${b['coherent-down-trend']}/${b['direction-conflict']}/${b['global-only-up']}/${b['global-only-down']}/${b['half-pair-only']}/${b['no-evidence']}`
  );
}

/**
 * Compute the COHERENT TREND DIRECTION CONSENSUS over
 * an Axis208Axis205SpearmanFootruleCoxStuartReport.
 * Returns the dominant direction across the
 * coherent-up-trend and coherent-down-trend buckets,
 * weighted by row counts:
 *
 *   - 'up'        if coherent-up-trend > coherent-down-trend
 *   - 'down'      if coherent-down-trend > coherent-up-trend
 *   - 'tied'      if equal AND non-zero
 *   - 'no-coherent-evidence' if both are zero
 *
 * Useful for headline release-note one-liners:
 * "the corpus shows a coherent UP trend across N
 * sources" -- pulls the directional verdict out of the
 * 7-bucket diagnostic without forcing the caller to
 * inspect the bucketCounts map.
 *
 * The 'direction-conflict' bucket is INTENTIONALLY
 * EXCLUDED from this consensus -- those rows have
 * BOTH axes decisive but in OPPOSITE directions, which
 * is a non-monotonic-shape signature, not a directional
 * verdict.
 *
 * Also returns the count of contributing rows so the
 * caller can render "up across 3 sources" or
 * "down across 1 source". Pure deterministic.
 */
export function coherentTrendDirectionConsensus(
  report: Axis208Axis205SpearmanFootruleCoxStuartReport,
): {
  direction: 'up' | 'down' | 'tied' | 'no-coherent-evidence';
  upCount: number;
  downCount: number;
  contributingRows: number;
} {
  const upCount = report.bucketCounts['coherent-up-trend'];
  const downCount = report.bucketCounts['coherent-down-trend'];
  const contributingRows = upCount + downCount;
  let direction: 'up' | 'down' | 'tied' | 'no-coherent-evidence';
  if (contributingRows === 0) direction = 'no-coherent-evidence';
  else if (upCount > downCount) direction = 'up';
  else if (downCount > upCount) direction = 'down';
  else direction = 'tied';
  return { direction, upCount, downCount, contributingRows };
}
