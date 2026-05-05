/**
 * classifyAxis221Axis154AlexanderssonPettittParametricVsRankSingleChangepointCompound:
 * cross-axis 4-quadrant diagnostic joining the v0.6.550
 * axis-221 ALEXANDERSSON 1986 SNHT (`t0`, `pApprox`,
 * `aStar`, `meanShift`, `zShift`, `tCrit05`) with the
 * v0.6.514 axis-154 PETTITT 1979 NONPARAMETRIC RANK
 * CHANGEPOINT (`kt`, `pApprox`, `tStarIndex`, `meanShift`)
 * on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes test the SAME NULL ("no
 * structural break in distribution location") and surface
 * a SINGLE most-likely changepoint position. They differ
 * ON THE STATISTIC FAMILY:
 *
 *   - axis-221 ALEXANDERSSON SNHT: PARAMETRIC L_2
 *     likelihood-ratio under a Gaussian model. Operates on
 *     STANDARDISED MAGNITUDES z[i] = (x[i] - mean)/sd. T0
 *     uses squared mean differences -- SENSITIVE to single
 *     large outliers and to the Gaussian-tail assumption.
 *     Critical values from Khaliq-Ouarda 2007 polynomial
 *     fit to Alexandersson 1986 Monte-Carlo grid.
 *
 *   - axis-154 PETTITT: NONPARAMETRIC L_1 rank statistic.
 *     KT = max_t |U[t]| where U[t] = sum_{i<=t} sum_{j>t}
 *     sign(x[i] - x[j]) -- a Mann-Whitney-of-the-split.
 *     MAGNITUDE-BLIND (uses sign() only), breakdown ~0.5,
 *     distribution-free under H0. Asymptotic p-value via
 *     the closed form 2*exp(-6*KT^2/(n^3+n^2)).
 *
 * SNHT vs Pettitt is therefore the
 * STATISTIC-FAMILY DUAL on the single-changepoint surface.
 * AGREEMENT in decisiveness AND argmax-day proximity
 * indicates a changepoint that is ROBUST TO BOTH the
 * parametric Gaussian model AND the rank-based
 * distribution-free recovery -- the strongest possible
 * evidence for a single break on this surface. CONFLICT is
 * diagnostic:
 *
 *   - snht-only (decisive SNHT, non-decisive Pettitt):
 *     the change is dominated by a SHIFT IN MAGNITUDE
 *     that the rank statistic cannot see (e.g. one
 *     extreme outlier dragging the squared mean
 *     difference). Common in heavy-tailed sources.
 *   - pettitt-only (decisive Pettitt, non-decisive SNHT):
 *     the change is dominated by a CLEAN MEDIAN SHIFT in
 *     a heavy-tailed series where the SD inflates and the
 *     SNHT statistic is dragged down. Common in
 *     non-Gaussian sources.
 *   - argmax conflict (both decisive but
 *     |snhtAStar - pettittTStar| > guard): two roughly
 *     equal-strength candidate changepoints, and the
 *     parametric vs rank statistics weight them
 *     differently. Look at axis-221 t2OverT and axis-154
 *     kt2OverKt to confirm regime multiplicity.
 *
 * 2-AXIS DECISIVENESS COMPOUND (mirrors the axis-220 x
 * axis-219 family scheme, with the addition of an
 * argmax-proximity flag because both axes return an
 * explicit argmax index). 9 buckets:
 *
 * ```
 * 'agree-aligned'    snhtDecisive AND pettittDecisive AND aligned
 * 'agree-misaligned' snhtDecisive AND pettittDecisive AND NOT aligned
 * 'snht-only'        snhtDecisive AND NOT pettittDecisive
 * 'pettitt-only'     pettittDecisive AND NOT snhtDecisive
 * 'no-evidence'      neither decisive
 * ```
 *
 * Decisiveness:
 *   - snhtDecisive    := snhtPApprox < alpha
 *                        OR snhtT0 >= snhtTCrit05 (defensive
 *                        OR -- pApprox is conservative)
 *   - pettittDecisive := pettittPApprox < alpha
 *
 * Aligned (when both decisive):
 *   - aligned := |snhtAStar - pettittTStar| <= proximityGuard
 *
 * proximityGuard is supplied by the caller; default = 5
 * (days). The axis-154 tStarIndex is 0-based, axis-221
 * aStar is 1-based; the function NORMALISES BOTH TO 0-BASED
 * (split-BEFORE) before computing the distance.
 *
 * jointAlignment is set ONLY when both axes are decisive,
 * to one of: 'aligned', 'misaligned'. Otherwise null.
 *
 * Determinism: pure transform.
 */

export interface AlexanderssonSnhtRowForPettittCompound {
  source: string;
  /** SNHT T0 statistic. */
  snhtT0: number;
  /** SNHT conservative Bonferroni p-value. */
  snhtPApprox: number;
  /** SNHT Khaliq-Ouarda critical value at alpha=0.05. */
  snhtTCrit05: number;
  /** SNHT 1-based argmax in {1..n-1}. */
  snhtAStar: number;
  /** Standardised mean shift. */
  snhtZShift: number;
}

export interface PettittChangepointRowForSnhtCompound {
  source: string;
  /** Pettitt KT = max_t |U[t]|. */
  pettittKt: number;
  /** Pettitt asymptotic 2-sided p-value approximation. */
  pettittPApprox: number;
  /** Pettitt 0-based argmax in {0..n-2}. */
  pettittTStarIndex: number;
  /** muAfter - muBefore. */
  pettittMeanShift: number;
}

export type Axis221Axis154AlexanderssonPettittBucket =
  | 'agree-aligned'
  | 'agree-misaligned'
  | 'snht-only'
  | 'pettitt-only'
  | 'no-evidence';

export type Axis221Axis154AlexanderssonPettittJointAlignment =
  | 'aligned'
  | 'misaligned';

export interface Axis221Axis154AlexanderssonPettittJoinedRow {
  source: string;
  snhtT0: number;
  snhtPApprox: number;
  snhtTCrit05: number;
  /** Normalised to 0-based split-BEFORE index. */
  snhtAStarZeroBased: number;
  snhtZShift: number;
  pettittKt: number;
  pettittPApprox: number;
  /** Already 0-based. */
  pettittTStarIndex: number;
  pettittMeanShift: number;
  snhtDecisive: boolean;
  pettittDecisive: boolean;
  /** |snhtAStarZeroBased - pettittTStarIndex|. */
  argmaxDistance: number;
  bucket: Axis221Axis154AlexanderssonPettittBucket;
  jointAlignment: Axis221Axis154AlexanderssonPettittJointAlignment | null;
}

export interface Axis221Axis154AlexanderssonPettittReport {
  alpha: number;
  proximityGuard: number;
  rows: Axis221Axis154AlexanderssonPettittJoinedRow[];
  bucketCounts: Record<Axis221Axis154AlexanderssonPettittBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointAlignment: {
    aligned: number;
    misaligned: number;
    anyMissingDecisive: number;
  };
  sourcesOnlyInSnht: string[];
  sourcesOnlyInPettitt: string[];
}

export function classifyAxis221Axis154AlexanderssonPettittParametricVsRankSingleChangepointCompound(
  snhtRows: AlexanderssonSnhtRowForPettittCompound[],
  pettittRows: PettittChangepointRowForSnhtCompound[],
  alpha = 0.05,
  proximityGuard = 5,
): Axis221Axis154AlexanderssonPettittReport {
  const fnName =
    'classifyAxis221Axis154AlexanderssonPettittParametricVsRankSingleChangepointCompound';
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new Error(`${fnName}: alpha must be in (0, 1) (got ${alpha})`);
  }
  if (!Number.isInteger(proximityGuard) || proximityGuard < 0) {
    throw new Error(
      `${fnName}: proximityGuard must be a non-negative integer (got ${proximityGuard})`,
    );
  }
  if (!Array.isArray(snhtRows)) {
    throw new Error(`${fnName}: snhtRows must be an array`);
  }
  if (!Array.isArray(pettittRows)) {
    throw new Error(`${fnName}: pettittRows must be an array`);
  }

  const snhtBySrc = new Map<string, AlexanderssonSnhtRowForPettittCompound>();
  for (const r of snhtRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(`${fnName}: snht row has invalid source: ${r.source}`);
    }
    if (
      !Number.isFinite(r.snhtT0) ||
      r.snhtT0 < 0 ||
      !Number.isFinite(r.snhtPApprox) ||
      r.snhtPApprox < 0 ||
      r.snhtPApprox > 1 ||
      !Number.isFinite(r.snhtTCrit05) ||
      r.snhtTCrit05 < 0 ||
      !Number.isInteger(r.snhtAStar) ||
      r.snhtAStar < 1 ||
      !Number.isFinite(r.snhtZShift)
    ) {
      throw new Error(
        `${fnName}: snht row '${r.source}' has invalid t0/pApprox/tCrit05/aStar/zShift`,
      );
    }
    if (snhtBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate snht source '${r.source}'`);
    }
    snhtBySrc.set(r.source, r);
  }

  const pettittBySrc = new Map<string, PettittChangepointRowForSnhtCompound>();
  for (const r of pettittRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(`${fnName}: pettitt row has invalid source: ${r.source}`);
    }
    if (
      !Number.isFinite(r.pettittKt) ||
      r.pettittKt < 0 ||
      !Number.isFinite(r.pettittPApprox) ||
      r.pettittPApprox < 0 ||
      r.pettittPApprox > 1 ||
      !Number.isInteger(r.pettittTStarIndex) ||
      r.pettittTStarIndex < -1 ||
      !Number.isFinite(r.pettittMeanShift)
    ) {
      throw new Error(
        `${fnName}: pettitt row '${r.source}' has invalid kt/pApprox/tStarIndex/meanShift`,
      );
    }
    if (pettittBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate pettitt source '${r.source}'`);
    }
    pettittBySrc.set(r.source, r);
  }

  const sourcesOnlyInSnht: string[] = [];
  const sourcesOnlyInPettitt: string[] = [];
  for (const s of snhtBySrc.keys()) {
    if (!pettittBySrc.has(s)) sourcesOnlyInSnht.push(s);
  }
  for (const s of pettittBySrc.keys()) {
    if (!snhtBySrc.has(s)) sourcesOnlyInPettitt.push(s);
  }
  sourcesOnlyInSnht.sort();
  sourcesOnlyInPettitt.sort();

  const joinedSources: string[] = [];
  for (const s of snhtBySrc.keys()) {
    if (pettittBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis221Axis154AlexanderssonPettittJoinedRow[] = [];
  const bucketCounts: Record<Axis221Axis154AlexanderssonPettittBucket, number> = {
    'agree-aligned': 0,
    'agree-misaligned': 0,
    'snht-only': 0,
    'pettitt-only': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  const byJointAlignment = {
    aligned: 0,
    misaligned: 0,
    anyMissingDecisive: 0,
  };

  for (const src of joinedSources) {
    const snht = snhtBySrc.get(src)!;
    const pettitt = pettittBySrc.get(src)!;
    // SNHT decisive: pApprox < alpha OR T0 >= tCrit05 (defensive OR --
    // pApprox is the conservative Bonferroni bound, tCrit05 is tighter).
    const snhtDecisive =
      snht.snhtPApprox < alpha || snht.snhtT0 >= snht.snhtTCrit05;
    const pettittDecisive = pettitt.pettittPApprox < alpha;
    const anyDecisive = snhtDecisive || pettittDecisive;
    if (snhtDecisive && pettittDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    // Normalise to 0-based split-BEFORE: SNHT aStar is 1-based (a in
    // {1..n-1}, split BEFORE index a in 0-based ranks); subtract 1 to
    // align with Pettitt's 0-based tStarIndex (split BEFORE index t+1).
    // Both then mean: the LAST INDEX of the LEFT segment (0-based).
    const snhtAStarZero = snht.snhtAStar - 1;
    const argmaxDistance = Math.abs(snhtAStarZero - pettitt.pettittTStarIndex);

    let bucket: Axis221Axis154AlexanderssonPettittBucket;
    let jointAlignment:
      | Axis221Axis154AlexanderssonPettittJointAlignment
      | null = null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointAlignment.anyMissingDecisive += 1;
    } else if (snhtDecisive && !pettittDecisive) {
      bucket = 'snht-only';
      byJointAlignment.anyMissingDecisive += 1;
    } else if (pettittDecisive && !snhtDecisive) {
      bucket = 'pettitt-only';
      byJointAlignment.anyMissingDecisive += 1;
    } else {
      // both decisive
      if (argmaxDistance <= proximityGuard) {
        bucket = 'agree-aligned';
        jointAlignment = 'aligned';
        byJointAlignment.aligned += 1;
      } else {
        bucket = 'agree-misaligned';
        jointAlignment = 'misaligned';
        byJointAlignment.misaligned += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      snhtT0: snht.snhtT0,
      snhtPApprox: snht.snhtPApprox,
      snhtTCrit05: snht.snhtTCrit05,
      snhtAStarZeroBased: snhtAStarZero,
      snhtZShift: snht.snhtZShift,
      pettittKt: pettitt.pettittKt,
      pettittPApprox: pettitt.pettittPApprox,
      pettittTStarIndex: pettitt.pettittTStarIndex,
      pettittMeanShift: pettitt.pettittMeanShift,
      snhtDecisive,
      pettittDecisive,
      argmaxDistance,
      bucket,
      jointAlignment,
    });
  }

  return {
    alpha,
    proximityGuard,
    rows,
    bucketCounts,
    bothDecisive,
    atLeastOneDecisive,
    byJointAlignment,
    sourcesOnlyInSnht,
    sourcesOnlyInPettitt,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis221Axis154AlexanderssonPettittReport.
 */
export function summarizeAxis221Axis154AlexanderssonPettittReport(
  report: Axis221Axis154AlexanderssonPettittReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const g = report.proximityGuard;
  const j = report.byJointAlignment;
  const b = report.bucketCounts;
  return (
    `axis-221xaxis-154 alpha=${a} guard=${g} n=${n} both=${report.bothDecisive}/${n} ` +
    `align[a/m]=${j.aligned}/${j.misaligned} ` +
    `buckets[aa/am/so/po/ne]=${b['agree-aligned']}/${b['agree-misaligned']}/${b['snht-only']}/${b['pettitt-only']}/${b['no-evidence']}`
  );
}
