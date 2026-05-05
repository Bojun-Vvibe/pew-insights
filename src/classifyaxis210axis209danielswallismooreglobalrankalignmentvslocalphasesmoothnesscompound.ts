/**
 * classifyAxis210Axis209DanielsWallisMooreGlobalRankAlignmentVsLocalPhaseSmoothnessCompound:
 * cross-axis 7-bucket diagnostic joining axis-210
 * DANIELS 1944 RANK CORRELATION WITH TIME (`drZ`,
 * `drPValue`) with axis-209 WALLIS-MOORE 1941
 * PHASE-FREQUENCY (`wmZ`, `wmPValue`) on a per-source
 * basis.
 *
 * STRUCTURAL CLAIM. Both axes test for departure from
 * iid randomness in the gap-filled daily token series,
 * but at STRUCTURALLY ORTHOGONAL SCALES and via
 * DIFFERENT REDUCTIONS:
 *
 *   - DANIELS RANK CORRELATION (axis-210) is a GLOBAL
 *     L2 RANK-CORRELATION between value-ranks and the
 *     time-identity sequence. It captures MONOTONE-
 *     TREND DIRECTION and STRENGTH:
 *       - drZ >> 0 = ranks RISE WITH TIME = monotone
 *         UP-TREND.
 *       - drZ << 0 = ranks FALL WITH TIME = monotone
 *         DOWN-TREND.
 *
 *       drTrendUpSignal = +drZ   ( + = up-trend,
 *                                  - = down-trend )
 *
 *     NB: the SIGN CONVENTION is OPPOSITE to axis-208
 *     Spearman footrule (where sfZ << 0 = up-trend
 *     because footrule is the L1 DISTANCE from
 *     identity, and small footrule = aligned ranks).
 *     Daniels is a CORRELATION (large = aligned), not
 *     a distance (small = aligned).
 *
 *   - WALLIS-MOORE PHASE-FREQUENCY (axis-209) is a
 *     LOCAL CONTIGUOUS-PHASE counting statistic on the
 *     SIGN PATTERN of consecutive first-differences.
 *     It captures SMOOTHNESS / OSCILLATION FREQUENCY:
 *       - wmZ << 0 = TOO FEW phases = SMOOTH /
 *         positively-serially-correlated dynamics.
 *       - wmZ >> 0 = TOO MANY phases = ZIGZAG /
 *         negatively-serially-correlated dynamics.
 *
 *       wmSmoothSignal = -wmZ   ( + = smooth/trending,
 *                                 - = zigzag/oscillating )
 *
 * STRUCTURAL ORTHOGONALITY at three levels:
 *
 *   - DIFFERENT INFORMATION CONTENT.
 *     Wallis-Moore uses ONLY the SIGN PATTERN of
 *     consecutive differences (an L0-counting statistic
 *     on a binary-sign sequence). Daniels uses the
 *     FULL RANK PERMUTATION reduced to the L2
 *     correlation with time-identity. A series that
 *     is locally smooth (long monotone phases) but
 *     with ranks shuffled away from time identity
 *     gives wmZ << 0 yet drZ near 0. A globally
 *     trending but locally noisy series gives drZ >> 0
 *     yet wmZ near 0 (or even >> 0 if noise dominates).
 *
 *   - DIFFERENT SCALE.
 *     Wallis-Moore is LOCAL (sensitive to the
 *     sign-of-difference at every consecutive pair).
 *     Daniels is GLOBAL (sensitive to the overall
 *     rank-vs-time alignment across all n indices).
 *
 *   - DIFFERENT TIE BEHAVIOUR.
 *     Wallis-Moore SKIPS tied differences entirely
 *     (effective n is nNonTied <= n - 1). Daniels uses
 *     MID-RANKS for ties (effective n stays at n). On
 *     pew data with intermittent zero-token days this
 *     materially diverges.
 *
 * They can:
 *
 *   - AGREE in the "smooth-monotone-trend" case: a
 *     trending series gives wmZ << 0 (smooth) AND drZ
 *     decisive in the trend direction. Buckets
 *     `smooth-up-trend` and `smooth-down-trend`.
 *
 *   - DISAGREE INFORMATIVELY in the "zigzag-with-trend"
 *     case: wmZ >> 0 (anti-correlated dynamics) AND drZ
 *     decisive. SAWTOOTH-WITH-DRIFT or LIMIT-CYCLE-
 *     WITH-RAMP. Surfaced as `zigzag-with-trend`.
 *
 *   - SHOW only ONE decisive: smoothness without trend
 *     (smoothness-only-smooth or
 *     smoothness-only-zigzag) or trend without
 *     smoothness call (daniels-only).
 *
 *   - NEITHER decisive: `no-evidence`.
 *
 * Buckets (alpha default 0.05):
 *
 *   - `smooth-up-trend`: wm decisive (wmZ < 0) AND
 *     dr decisive (drZ > 0) -- smooth + UP trend.
 *   - `smooth-down-trend`: wm decisive (wmZ < 0) AND
 *     dr decisive (drZ < 0) -- smooth + DOWN trend.
 *   - `zigzag-with-trend`: wm decisive (wmZ > 0) AND
 *     dr decisive -- ANTI-CORRELATED dynamics yet a
 *     clear rank-vs-time alignment.
 *   - `smoothness-only-smooth`: wm decisive (wmZ < 0)
 *     and dr NOT decisive -- smooth but no trend
 *     (positively-serially-correlated stationary
 *     process, or trend too weak for Daniels).
 *   - `smoothness-only-zigzag`: wm decisive (wmZ > 0)
 *     and dr NOT decisive -- zigzag but no trend
 *     (negatively-serially-correlated stationary
 *     process).
 *   - `daniels-only`: dr decisive but wm NOT decisive
 *     -- a clear rank-vs-time alignment that the
 *     phase-count test fails to call.
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
 *   Daniels, H. E., "The relation between measures of
 *     correlation in the universe of sample
 *     permutations", *Biometrika* 33 (1944),
 *     pp. 129-135.
 *   Wallis, W. A. & Moore, G. H., "A significance test
 *     for time series analyses", *J. Amer. Statist.
 *     Assoc.* 36 (1941), pp. 401-409.
 *   Kendall, M. G., *Rank Correlation Methods*, 4th
 *     ed., Griffin (1970), chap. 4.
 */

export interface DanielsRankCorrelationRowForWallisMoorePhaseCompound {
  source: string;
  drZ: number;
  drPValue: number;
}

export interface WallisMoorePhaseRowForDanielsRankCorrelationCompound {
  source: string;
  wmZ: number;
  wmPValue: number;
}

export type Axis210Axis209DanielsWallisMooreBucket =
  | 'smooth-up-trend'
  | 'smooth-down-trend'
  | 'zigzag-with-trend'
  | 'smoothness-only-smooth'
  | 'smoothness-only-zigzag'
  | 'daniels-only'
  | 'no-evidence';

export interface Axis210Axis209DanielsWallisMooreJoinedRow {
  source: string;
  drZ: number;
  drPValue: number;
  wmZ: number;
  wmPValue: number;
  drDecisive: boolean;
  wmDecisive: boolean;
  /** +drZ (positive = up-trend). */
  drTrendUpSignal: number;
  /** -wmZ (positive = smooth). */
  wmSmoothSignal: number;
  bucket: Axis210Axis209DanielsWallisMooreBucket;
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

export interface Axis210Axis209DanielsWallisMooreReport {
  alpha: number;
  rows: Axis210Axis209DanielsWallisMooreJoinedRow[];
  bucketCounts: Record<Axis210Axis209DanielsWallisMooreBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointSignQuadrant: {
    smoothUp: number;
    smoothDown: number;
    zigzagUp: number;
    zigzagDown: number;
    anyMissingDecisive: number;
  };
  sourcesOnlyInDaniels: string[];
  sourcesOnlyInWallisMoore: string[];
}

export function classifyAxis210Axis209DanielsWallisMooreGlobalRankAlignmentVsLocalPhaseSmoothnessCompound(
  danielsRows: ReadonlyArray<DanielsRankCorrelationRowForWallisMoorePhaseCompound>,
  wallisMooreRows: ReadonlyArray<WallisMoorePhaseRowForDanielsRankCorrelationCompound>,
  alpha = 0.05,
): Axis210Axis209DanielsWallisMooreReport {
  const fnName =
    'classifyAxis210Axis209DanielsWallisMooreGlobalRankAlignmentVsLocalPhaseSmoothnessCompound';
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(`${fnName}: alpha must be in (0, 0.5] (got ${alpha})`);
  }

  const drBySrc = new Map<
    string,
    DanielsRankCorrelationRowForWallisMoorePhaseCompound
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

  const wmBySrc = new Map<
    string,
    WallisMoorePhaseRowForDanielsRankCorrelationCompound
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

  const sourcesOnlyInDaniels: string[] = [];
  const sourcesOnlyInWallisMoore: string[] = [];
  for (const s of drBySrc.keys()) {
    if (!wmBySrc.has(s)) sourcesOnlyInDaniels.push(s);
  }
  for (const s of wmBySrc.keys()) {
    if (!drBySrc.has(s)) sourcesOnlyInWallisMoore.push(s);
  }
  sourcesOnlyInDaniels.sort();
  sourcesOnlyInWallisMoore.sort();

  const joinedSources: string[] = [];
  for (const s of drBySrc.keys()) {
    if (wmBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis210Axis209DanielsWallisMooreJoinedRow[] = [];
  const bucketCounts: Record<Axis210Axis209DanielsWallisMooreBucket, number> = {
    'smooth-up-trend': 0,
    'smooth-down-trend': 0,
    'zigzag-with-trend': 0,
    'smoothness-only-smooth': 0,
    'smoothness-only-zigzag': 0,
    'daniels-only': 0,
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
    const dr = drBySrc.get(src)!;
    const wm = wmBySrc.get(src)!;
    const drDecisive = dr.drPValue < alpha;
    const wmDecisive = wm.wmPValue < alpha;
    const anyDecisive = drDecisive || wmDecisive;
    if (drDecisive && wmDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    const drTrendUpSignal = dr.drZ;
    const wmSmoothSignal = -wm.wmZ;

    let bucket: Axis210Axis209DanielsWallisMooreBucket;
    let jointSignQuadrant:
      | 'smoothUp'
      | 'smoothDown'
      | 'zigzagUp'
      | 'zigzagDown'
      | null = null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointSignQuadrant.anyMissingDecisive += 1;
    } else if (wmDecisive && !drDecisive) {
      bucket =
        wm.wmZ < 0 ? 'smoothness-only-smooth' : 'smoothness-only-zigzag';
      byJointSignQuadrant.anyMissingDecisive += 1;
    } else if (drDecisive && !wmDecisive) {
      bucket = 'daniels-only';
      byJointSignQuadrant.anyMissingDecisive += 1;
    } else {
      // Both decisive: classify joint sign.
      const wmSmooth = wm.wmZ < 0;
      const drUp = dr.drZ > 0;
      if (wmSmooth && drUp) {
        bucket = 'smooth-up-trend';
        jointSignQuadrant = 'smoothUp';
        byJointSignQuadrant.smoothUp += 1;
      } else if (wmSmooth && !drUp) {
        bucket = 'smooth-down-trend';
        jointSignQuadrant = 'smoothDown';
        byJointSignQuadrant.smoothDown += 1;
      } else if (!wmSmooth && drUp) {
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
      drZ: dr.drZ,
      drPValue: dr.drPValue,
      wmZ: wm.wmZ,
      wmPValue: wm.wmPValue,
      drDecisive,
      wmDecisive,
      drTrendUpSignal,
      wmSmoothSignal,
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
    sourcesOnlyInDaniels,
    sourcesOnlyInWallisMoore,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis210Axis209DanielsWallisMooreReport.
 *
 *   axis-210xaxis-209 alpha=<a> n=<rows> both=<k>/<rows> qd[smU/smD/zgU/zgD]=a/b/c/d buckets[smU/smD/zwT/sos/soz/do/ne]=v/w/x/y/z/u/t
 *
 * Pure deterministic; no I/O.
 */
export function summarizeAxis210Axis209DanielsWallisMooreReport(
  report: Axis210Axis209DanielsWallisMooreReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const q = report.byJointSignQuadrant;
  const b = report.bucketCounts;
  return (
    `axis-210xaxis-209 alpha=${a} n=${n} both=${report.bothDecisive}/${n} ` +
    `qd[smU/smD/zgU/zgD]=${q.smoothUp}/${q.smoothDown}/${q.zigzagUp}/${q.zigzagDown} ` +
    `buckets[smU/smD/zwT/sos/soz/do/ne]=${b['smooth-up-trend']}/${b['smooth-down-trend']}/${b['zigzag-with-trend']}/${b['smoothness-only-smooth']}/${b['smoothness-only-zigzag']}/${b['daniels-only']}/${b['no-evidence']}`
  );
}
