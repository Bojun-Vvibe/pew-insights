/**
 * classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound:
 * cross-axis 5-bucket diagnostic joining axis-207
 * PITMAN 1937 PERMUTATION TEST FOR RANDOMNESS via MSSD
 * (`ppZ`, `ppPValue`) with axis-206 JONCKHEERE 1954 /
 * TERPSTRA 1952 ORDERED-ALTERNATIVE RANK TEST
 * (`jtZ`, `jtPValue`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes test for departures from
 * EXCHANGEABLE ORDERING of the gap-filled daily token
 * series, but at STRUCTURALLY ORTHOGONAL SCALES:
 *
 *   - PITMAN MSSD (axis-207) tests for LAG-1 SERIAL
 *     EXCHANGEABILITY using the SQUARED MAGNITUDE of
 *     successive differences against a Monte-Carlo
 *     PERMUTATION REFERENCE on the RAW VALUES. Decisive
 *     ppZ << 0 = SMOOTHNESS / positive lag-1
 *     autocorrelation; ppZ >> 0 = OSCILLATION /
 *     negative lag-1 autocorrelation. The lag-1
 *     MICROSTRUCTURE probe.
 *
 *       ppSmoothnessSignal = -ppZ   ( + = smooth /
 *                                    autocorrelated
 *                                    - = oscillating /
 *                                    anti-autocorrelated )
 *
 *   - JT (axis-206) tests for MONOTONIC ORDERED-
 *     ALTERNATIVE across k=4 chronological blocks
 *     using rank-aggregated pairwise Mann-Whitney U
 *     comparisons. jtZ >> 0 = MONOTONIC INCREASING
 *     across blocks; jtZ << 0 = MONOTONIC DECREASING.
 *     The k=4 BLOCK-MACROSTRUCTURE probe.
 *
 *       jtTrendSignal = +jtZ   ( + = block-level
 *                                up-trend
 *                                - = block-level
 *                                down-trend )
 *
 * The two probes are STRUCTURALLY ORTHOGONAL because
 * they probe different exchangeability-violation modes
 * at different temporal scales. They can:
 *
 *   - DISAGREE INFORMATIVELY on multiple shape axes:
 *     a series with a steady linear trend + iid noise
 *     produces jtZ >> 0 (block-monotonic) but ppZ ~ 0
 *     (lag-1 exchangeability holds within each
 *     stationary noise contribution conditional on
 *     trend). Conversely, a stationary AR(1) process
 *     with no trend produces ppZ << 0 (smoothness)
 *     but jtZ ~ 0 (no block-monotonic ordering).
 *
 *   - AGREE in the "smooth-drift" signature: a series
 *     that is SMOOTHLY MONOTONIC (e.g. exponential
 *     growth) produces BOTH ppZ << 0 (adjacent days
 *     similar -- smoothness) AND jtZ >> 0 (late
 *     blocks outrank early -- block-monotonic). This
 *     is the unambiguous slow-drift signature.
 *
 *   - AGREE in the "drift+oscillation" signature: a
 *     series that has trend + ZIGZAG noise around the
 *     trend produces BOTH ppZ >> 0 (zigzag) AND
 *     jtZ >> 0 (block-monotonic). This is the
 *     "trending oscillator" signature.
 *
 *   - Both decisive AT-LEAST-ONE-SIGN-OPPOSED
 *     (smoothness + block-trend; or oscillation +
 *     block-counter-trend etc.) produces a four-way
 *     CROSS-TAB classification keyed by the joint
 *     sign pattern. We surface this via:
 *
 *       smoothBlockTrendUp   (ppZ << 0 AND jtZ >> 0)
 *       smoothBlockTrendDown (ppZ << 0 AND jtZ << 0)
 *       oscBlockTrendUp      (ppZ >> 0 AND jtZ >> 0)
 *       oscBlockTrendDown    (ppZ >> 0 AND jtZ << 0)
 *
 *     This is the headline scalar payload of the
 *     compound classifier and answers
 *     "of the sources with both lag-1 and block-level
 *     departures from exchangeability, what fraction
 *     are in each of the 4 microstructure-x-
 *     macrostructure quadrants".
 *
 * Buckets (alpha default 0.05):
 *
 *   - `coherent-smooth-drift`: ppZ decisive (ppZ < 0)
 *     AND jt decisive (any sign) -- the slow drift
 *     produces both lag-1 smoothness and block-level
 *     monotonic ordering. The macrostructure-
 *     microstructure agreement signature.
 *   - `lag1-only`: pp decisive, jt not -- pure lag-1
 *     dependence with no block-level trend (e.g.
 *     stationary AR(1), or stationary zigzag).
 *   - `block-trend-only`: jt decisive, pp not -- pure
 *     block-level trend with no lag-1 dependence (e.g.
 *     trend + iid noise -- the deterministic-drift
 *     signature, the "trend washes out within-block
 *     lag-1 microstructure" outcome).
 *   - `osc-with-block-trend`: pp decisive (ppZ > 0,
 *     oscillating) AND jt decisive (any sign) -- the
 *     "trending oscillator" signature; surfaced
 *     separately from coherent-smooth-drift to
 *     distinguish driver dynamics.
 *   - `no-evidence`: neither decisive.
 *
 * The `byJointSignQuadrant` cross-tab counts each row
 * into exactly one of {smoothBlockTrendUp,
 * smoothBlockTrendDown, oscBlockTrendUp,
 * oscBlockTrendDown, anyMissingDecisive}.
 *
 * Pure function: no I/O, deterministic source-asc
 * ordering, throws on duplicate sources, non-finite
 * inputs, p-values outside (0, 1], or alpha outside
 * (0, 0.5].
 *
 * Reference:
 *   Pitman, E. J. G., "Significance tests which may be
 *     applied to samples from any populations",
 *     *Biometrika* 29 (1937), pp. 322-335.
 *   von Neumann, J., "Distribution of the ratio of the
 *     mean square successive difference to the
 *     variance", *Annals of Mathematical Statistics*
 *     12 (1941), pp. 367-395.
 *   Terpstra, T. J., "The asymptotic normality and
 *     consistency of Kendall's test against trend, when
 *     ties are present in one ranking",
 *     *Indagationes Mathematicae* 14 (1952), pp. 327-333.
 *   Jonckheere, A. R., "A distribution-free k-sample
 *     test against ordered alternatives",
 *     *Biometrika* 41 (1954), pp. 133-145.
 */

export interface PitmanMssdRowForJonckheereTerpstraCompound {
  source: string;
  ppZ: number;
  ppPValue: number;
}

export interface JonckheereTerpstraRowForPitmanMssdCompound {
  source: string;
  jtZ: number;
  jtPValue: number;
}

export type Axis207Axis206PitmanMssdJonckheereTerpstraBucket =
  | 'coherent-smooth-drift'
  | 'lag1-only'
  | 'block-trend-only'
  | 'osc-with-block-trend'
  | 'no-evidence';

export interface Axis207Axis206PitmanMssdJonckheereTerpstraJoinedRow {
  source: string;
  ppZ: number;
  ppPValue: number;
  jtZ: number;
  jtPValue: number;
  ppDecisive: boolean;
  jtDecisive: boolean;
  /** -ppZ in the smoothness-positive sign convention. */
  ppSmoothnessSignal: number;
  /** +jtZ in the trend-positive sign convention. */
  jtTrendSignal: number;
  bucket: Axis207Axis206PitmanMssdJonckheereTerpstraBucket;
  /**
   * Joint quadrant when both are decisive:
   *   smoothBlockTrendUp | smoothBlockTrendDown |
   *   oscBlockTrendUp | oscBlockTrendDown
   * null when either is non-decisive.
   */
  jointSignQuadrant:
    | 'smoothBlockTrendUp'
    | 'smoothBlockTrendDown'
    | 'oscBlockTrendUp'
    | 'oscBlockTrendDown'
    | null;
}

export interface Axis207Axis206PitmanMssdJonckheereTerpstraReport {
  alpha: number;
  rows: Axis207Axis206PitmanMssdJonckheereTerpstraJoinedRow[];
  bucketCounts: Record<
    Axis207Axis206PitmanMssdJonckheereTerpstraBucket,
    number
  >;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointSignQuadrant: {
    smoothBlockTrendUp: number;
    smoothBlockTrendDown: number;
    oscBlockTrendUp: number;
    oscBlockTrendDown: number;
    anyMissingDecisive: number;
  };
  sourcesOnlyInPitmanMssd: string[];
  sourcesOnlyInJonckheereTerpstra: string[];
}

export function classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound(
  pitmanMssdRows: ReadonlyArray<PitmanMssdRowForJonckheereTerpstraCompound>,
  jonckheereTerpstraRows: ReadonlyArray<JonckheereTerpstraRowForPitmanMssdCompound>,
  alpha = 0.05,
): Axis207Axis206PitmanMssdJonckheereTerpstraReport {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }

  const ppBySrc = new Map<string, PitmanMssdRowForJonckheereTerpstraCompound>();
  for (const r of pitmanMssdRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound: pitman-mssd row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.ppZ) ||
      !Number.isFinite(r.ppPValue) ||
      r.ppPValue <= 0 ||
      r.ppPValue > 1
    ) {
      throw new Error(
        `classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound: pitman-mssd row '${r.source}' has invalid ppZ/ppPValue`,
      );
    }
    if (ppBySrc.has(r.source)) {
      throw new Error(
        `classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound: duplicate pitman-mssd source '${r.source}'`,
      );
    }
    ppBySrc.set(r.source, r);
  }

  const jtBySrc = new Map<string, JonckheereTerpstraRowForPitmanMssdCompound>();
  for (const r of jonckheereTerpstraRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound: jonckheere-terpstra row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.jtZ) ||
      !Number.isFinite(r.jtPValue) ||
      r.jtPValue <= 0 ||
      r.jtPValue > 1
    ) {
      throw new Error(
        `classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound: jonckheere-terpstra row '${r.source}' has invalid jtZ/jtPValue`,
      );
    }
    if (jtBySrc.has(r.source)) {
      throw new Error(
        `classifyAxis207Axis206PitmanMssdJonckheereTerpstraSerialVsBlockTrendCompound: duplicate jonckheere-terpstra source '${r.source}'`,
      );
    }
    jtBySrc.set(r.source, r);
  }

  const sourcesOnlyInPitmanMssd: string[] = [];
  const sourcesOnlyInJonckheereTerpstra: string[] = [];
  for (const s of ppBySrc.keys()) {
    if (!jtBySrc.has(s)) sourcesOnlyInPitmanMssd.push(s);
  }
  for (const s of jtBySrc.keys()) {
    if (!ppBySrc.has(s)) sourcesOnlyInJonckheereTerpstra.push(s);
  }
  sourcesOnlyInPitmanMssd.sort();
  sourcesOnlyInJonckheereTerpstra.sort();

  const joinedSources: string[] = [];
  for (const s of ppBySrc.keys()) {
    if (jtBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis207Axis206PitmanMssdJonckheereTerpstraJoinedRow[] = [];
  const bucketCounts: Record<
    Axis207Axis206PitmanMssdJonckheereTerpstraBucket,
    number
  > = {
    'coherent-smooth-drift': 0,
    'lag1-only': 0,
    'block-trend-only': 0,
    'osc-with-block-trend': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  const byJointSignQuadrant = {
    smoothBlockTrendUp: 0,
    smoothBlockTrendDown: 0,
    oscBlockTrendUp: 0,
    oscBlockTrendDown: 0,
    anyMissingDecisive: 0,
  };

  for (const src of joinedSources) {
    const pp = ppBySrc.get(src)!;
    const jt = jtBySrc.get(src)!;
    const ppDecisive = pp.ppPValue < alpha;
    const jtDecisive = jt.jtPValue < alpha;
    const anyDecisive = ppDecisive || jtDecisive;
    if (ppDecisive && jtDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    const ppSmoothnessSignal = -pp.ppZ;
    const jtTrendSignal = jt.jtZ;

    let bucket: Axis207Axis206PitmanMssdJonckheereTerpstraBucket;
    let jointSignQuadrant:
      | 'smoothBlockTrendUp'
      | 'smoothBlockTrendDown'
      | 'oscBlockTrendUp'
      | 'oscBlockTrendDown'
      | null = null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointSignQuadrant.anyMissingDecisive += 1;
    } else if (ppDecisive && !jtDecisive) {
      bucket = 'lag1-only';
      byJointSignQuadrant.anyMissingDecisive += 1;
    } else if (jtDecisive && !ppDecisive) {
      bucket = 'block-trend-only';
      byJointSignQuadrant.anyMissingDecisive += 1;
    } else {
      // both decisive: split coherent-smooth-drift
      // (ppZ<0 = smooth) vs osc-with-block-trend
      // (ppZ>0 = oscillating). Either way, populate
      // the joint sign quadrant.
      const smooth = pp.ppZ < 0;
      const trendUp = jt.jtZ > 0;
      if (smooth) {
        bucket = 'coherent-smooth-drift';
        if (trendUp) {
          jointSignQuadrant = 'smoothBlockTrendUp';
          byJointSignQuadrant.smoothBlockTrendUp += 1;
        } else {
          jointSignQuadrant = 'smoothBlockTrendDown';
          byJointSignQuadrant.smoothBlockTrendDown += 1;
        }
      } else {
        bucket = 'osc-with-block-trend';
        if (trendUp) {
          jointSignQuadrant = 'oscBlockTrendUp';
          byJointSignQuadrant.oscBlockTrendUp += 1;
        } else {
          jointSignQuadrant = 'oscBlockTrendDown';
          byJointSignQuadrant.oscBlockTrendDown += 1;
        }
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      ppZ: pp.ppZ,
      ppPValue: pp.ppPValue,
      jtZ: jt.jtZ,
      jtPValue: jt.jtPValue,
      ppDecisive,
      jtDecisive,
      ppSmoothnessSignal,
      jtTrendSignal,
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
    sourcesOnlyInPitmanMssd,
    sourcesOnlyInJonckheereTerpstra,
  };
}
