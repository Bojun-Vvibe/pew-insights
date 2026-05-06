/**
 * classifyAxis222Axis221LombardAlexanderssonSmoothVsAbruptChangepointCompound:
 * cross-axis 5-bucket diagnostic joining the v0.6.554
 * axis-222 LOMBARD 1987 RANK-BASED SMOOTH-CHANGEPOINT TEST
 * (`ln`, `pApprox`, `kStar`, `directionSign`, `meanShift`)
 * with the v0.6.550 axis-221 ALEXANDERSSON 1986 SNHT
 * PARAMETRIC ABRUPT-STEP TEST (`t0`, `pApprox`, `aStar`,
 * `tCrit05`, `meanShift`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes test for a CHANGE IN
 * LOCATION at a single most-likely changepoint, but they
 * differ on TWO orthogonal axes simultaneously:
 *
 *   1. STATISTIC FAMILY: SNHT is PARAMETRIC L_2 on
 *      standardised magnitudes (Gaussian likelihood ratio);
 *      Lombard is RANK-BASED L_2 on smoothed Wilcoxon
 *      scores.
 *   2. CHANGE SHAPE: SNHT optimises a TWO-MEAN PARTITION
 *      (one ABRUPT step at a*); Lombard integrates the
 *      squared cumulative SMOOTHED rank deviation and is
 *      sensitive to a SMOOTH (gradual) transition over
 *      ~K days centred at kStar.
 *
 * Lombard vs SNHT is therefore the
 * STATISTIC-FAMILY x CHANGE-SHAPE DOUBLE DUAL on the
 * single-changepoint surface. AGREEMENT in decisiveness
 * AND argmax-day proximity flags a robust changepoint
 * detected by BOTH the parametric abrupt-step and the
 * rank-based smooth alternatives -- the strongest
 * possible evidence on this surface. CONFLICT is
 * MECHANISTICALLY DIAGNOSTIC:
 *
 *   - lombard-only (decisive Lombard, non-decisive SNHT):
 *     the change is GRADUAL over multiple days, so the
 *     two-mean partition under SNHT is "smeared" across
 *     many candidate splits and no single a* dominates.
 *     Common in series with logistic / linear ramps.
 *   - snht-only (decisive SNHT, non-decisive Lombard):
 *     the change is ABRUPT and dominated by one or two
 *     extreme magnitudes that the rank-smoothing washes
 *     out. Common in heavy-tailed sources with a single
 *     "regime jump" point (e.g. account quota change).
 *   - argmax conflict (both decisive but
 *     |kStar - aStar0| > guard): two different transition
 *     centres -- the parametric abrupt detector locks
 *     onto the largest single magnitude jump, the rank
 *     smooth detector locks onto the centre of the
 *     transition zone. Look at axis-222 secondPeakRatio
 *     and axis-221 t2OverT for regime multiplicity.
 *
 * 5-bucket compound (mirrors the axis-221 x axis-154
 * scheme):
 *
 * ```
 * 'agree-aligned'    lombardDecisive AND snhtDecisive AND aligned
 * 'agree-misaligned' lombardDecisive AND snhtDecisive AND NOT aligned
 * 'lombard-only'     lombardDecisive AND NOT snhtDecisive
 * 'snht-only'        snhtDecisive AND NOT lombardDecisive
 * 'no-evidence'      neither decisive
 * ```
 *
 * Decisiveness:
 *   - lombardDecisive := lombardPApprox < alpha
 *   - snhtDecisive    := snhtPApprox < alpha
 *                        OR snhtT0 >= snhtTCrit05 (defensive
 *                        OR -- pApprox is conservative)
 *
 * Aligned (when both decisive):
 *   - aligned := |lombardKStar - snhtAStarZeroBased|
 *                <= proximityGuard
 *
 * proximityGuard is supplied by the caller; default = 5
 * (days). axis-222 kStar is 0-based; axis-221 aStar is
 * 1-based (split BEFORE index a in 0-based) -- we
 * NORMALISE BOTH TO 0-BASED (split-BEFORE = last index of
 * the left segment) before computing the distance.
 *
 * jointAlignment is set ONLY when both axes are decisive,
 * to one of: 'aligned', 'misaligned'. Otherwise null.
 *
 * Determinism: pure transform. No I/O, no clock.
 */

export interface LombardSmoothChangepointRowForSnhtCompound {
  source: string;
  /** Lombard L_n statistic. */
  lombardLn: number;
  /** Lombard gamma upper-tail p. */
  lombardPApprox: number;
  /** Lombard 0-based smooth-change centre kStar in {0..n-1}. */
  lombardKStar: number;
  /** Lombard direction sign at kStar: -1, 0, or +1. */
  lombardDirectionSign: number;
  /** muAfter - muBefore on the raw scale, split AT kStar+1. */
  lombardMeanShift: number;
}

export interface AlexanderssonSnhtRowForLombardCompound {
  source: string;
  /** SNHT T0 statistic. */
  snhtT0: number;
  /** SNHT conservative Bonferroni p-value. */
  snhtPApprox: number;
  /** SNHT Khaliq-Ouarda critical value at alpha=0.05. */
  snhtTCrit05: number;
  /** SNHT 1-based argmax in {1..n-1}. */
  snhtAStar: number;
  /** muAfter - muBefore on raw scale (split before x[aStar]). */
  snhtMeanShift: number;
}

export type Axis222Axis221LombardSnhtBucket =
  | 'agree-aligned'
  | 'agree-misaligned'
  | 'lombard-only'
  | 'snht-only'
  | 'no-evidence';

export type Axis222Axis221LombardSnhtJointAlignment =
  | 'aligned'
  | 'misaligned';

export interface Axis222Axis221LombardSnhtJoinedRow {
  source: string;
  lombardLn: number;
  lombardPApprox: number;
  lombardKStar: number;
  lombardDirectionSign: number;
  lombardMeanShift: number;
  snhtT0: number;
  snhtPApprox: number;
  snhtTCrit05: number;
  /** 1-based aStar normalised to 0-based split-BEFORE. */
  snhtAStarZeroBased: number;
  snhtMeanShift: number;
  lombardDecisive: boolean;
  snhtDecisive: boolean;
  /** |lombardKStar - snhtAStarZeroBased|. */
  argmaxDistance: number;
  /** True iff lombardDirectionSign and sign(snhtMeanShift) agree (both nonzero). */
  signAgreement: boolean;
  bucket: Axis222Axis221LombardSnhtBucket;
  jointAlignment: Axis222Axis221LombardSnhtJointAlignment | null;
}

export interface Axis222Axis221LombardSnhtReport {
  alpha: number;
  proximityGuard: number;
  rows: Axis222Axis221LombardSnhtJoinedRow[];
  bucketCounts: Record<Axis222Axis221LombardSnhtBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointAlignment: {
    aligned: number;
    misaligned: number;
    anyMissingDecisive: number;
  };
  bothDecisiveSignAgree: number;
  bothDecisiveSignDisagree: number;
  sourcesOnlyInLombard: string[];
  sourcesOnlyInSnht: string[];
}

export function classifyAxis222Axis221LombardAlexanderssonSmoothVsAbruptChangepointCompound(
  lombardRows: LombardSmoothChangepointRowForSnhtCompound[],
  snhtRows: AlexanderssonSnhtRowForLombardCompound[],
  alpha = 0.05,
  proximityGuard = 5,
): Axis222Axis221LombardSnhtReport {
  const fnName =
    'classifyAxis222Axis221LombardAlexanderssonSmoothVsAbruptChangepointCompound';
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new Error(`${fnName}: alpha must be in (0, 1) (got ${alpha})`);
  }
  if (!Number.isInteger(proximityGuard) || proximityGuard < 0) {
    throw new Error(
      `${fnName}: proximityGuard must be a non-negative integer (got ${proximityGuard})`,
    );
  }
  if (!Array.isArray(lombardRows)) {
    throw new Error(`${fnName}: lombardRows must be an array`);
  }
  if (!Array.isArray(snhtRows)) {
    throw new Error(`${fnName}: snhtRows must be an array`);
  }

  const lombardBySrc = new Map<
    string,
    LombardSmoothChangepointRowForSnhtCompound
  >();
  for (const r of lombardRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(`${fnName}: lombard row has invalid source: ${r.source}`);
    }
    if (
      !Number.isFinite(r.lombardLn) ||
      r.lombardLn < 0 ||
      !Number.isFinite(r.lombardPApprox) ||
      r.lombardPApprox < 0 ||
      r.lombardPApprox > 1 ||
      !Number.isInteger(r.lombardKStar) ||
      r.lombardKStar < -1 ||
      !Number.isFinite(r.lombardDirectionSign) ||
      ![-1, 0, 1].includes(r.lombardDirectionSign) ||
      !Number.isFinite(r.lombardMeanShift)
    ) {
      throw new Error(
        `${fnName}: lombard row '${r.source}' has invalid ln/pApprox/kStar/directionSign/meanShift`,
      );
    }
    if (lombardBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate lombard source '${r.source}'`);
    }
    lombardBySrc.set(r.source, r);
  }

  const snhtBySrc = new Map<string, AlexanderssonSnhtRowForLombardCompound>();
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
      !Number.isFinite(r.snhtMeanShift)
    ) {
      throw new Error(
        `${fnName}: snht row '${r.source}' has invalid t0/pApprox/tCrit05/aStar/meanShift`,
      );
    }
    if (snhtBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate snht source '${r.source}'`);
    }
    snhtBySrc.set(r.source, r);
  }

  const sourcesOnlyInLombard: string[] = [];
  const sourcesOnlyInSnht: string[] = [];
  for (const s of lombardBySrc.keys()) {
    if (!snhtBySrc.has(s)) sourcesOnlyInLombard.push(s);
  }
  for (const s of snhtBySrc.keys()) {
    if (!lombardBySrc.has(s)) sourcesOnlyInSnht.push(s);
  }
  sourcesOnlyInLombard.sort();
  sourcesOnlyInSnht.sort();

  const joinedSources: string[] = [];
  for (const s of lombardBySrc.keys()) {
    if (snhtBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis222Axis221LombardSnhtJoinedRow[] = [];
  const bucketCounts: Record<Axis222Axis221LombardSnhtBucket, number> = {
    'agree-aligned': 0,
    'agree-misaligned': 0,
    'lombard-only': 0,
    'snht-only': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  let bothDecisiveSignAgree = 0;
  let bothDecisiveSignDisagree = 0;
  const byJointAlignment = {
    aligned: 0,
    misaligned: 0,
    anyMissingDecisive: 0,
  };

  for (const src of joinedSources) {
    const lombard = lombardBySrc.get(src)!;
    const snht = snhtBySrc.get(src)!;
    const lombardDecisive = lombard.lombardPApprox < alpha;
    const snhtDecisive =
      snht.snhtPApprox < alpha || snht.snhtT0 >= snht.snhtTCrit05;
    const anyDecisive = lombardDecisive || snhtDecisive;
    if (lombardDecisive && snhtDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    // Normalise SNHT 1-based aStar to 0-based split-BEFORE.
    const snhtAStarZero = snht.snhtAStar - 1;
    const argmaxDistance = Math.abs(lombard.lombardKStar - snhtAStarZero);

    // signAgreement: directionSign vs sign(snhtMeanShift). Note Lombard
    // directionSign = sign(S[kStar]) is OPPOSITE in convention to the raw
    // mean shift sign for an upward step (low ranks come first ->
    // S[kStar] < 0). We compare lombardMeanShift sign instead which is the
    // raw-scale shift -- consistent with snhtMeanShift.
    const lShiftSign =
      lombard.lombardMeanShift > 0
        ? 1
        : lombard.lombardMeanShift < 0
          ? -1
          : 0;
    const sShiftSign =
      snht.snhtMeanShift > 0 ? 1 : snht.snhtMeanShift < 0 ? -1 : 0;
    const signAgreement =
      lShiftSign !== 0 && sShiftSign !== 0 && lShiftSign === sShiftSign;

    let bucket: Axis222Axis221LombardSnhtBucket;
    let jointAlignment: Axis222Axis221LombardSnhtJointAlignment | null = null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointAlignment.anyMissingDecisive += 1;
    } else if (lombardDecisive && !snhtDecisive) {
      bucket = 'lombard-only';
      byJointAlignment.anyMissingDecisive += 1;
    } else if (snhtDecisive && !lombardDecisive) {
      bucket = 'snht-only';
      byJointAlignment.anyMissingDecisive += 1;
    } else {
      // both decisive
      if (signAgreement) bothDecisiveSignAgree += 1;
      else bothDecisiveSignDisagree += 1;
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
      lombardLn: lombard.lombardLn,
      lombardPApprox: lombard.lombardPApprox,
      lombardKStar: lombard.lombardKStar,
      lombardDirectionSign: lombard.lombardDirectionSign,
      lombardMeanShift: lombard.lombardMeanShift,
      snhtT0: snht.snhtT0,
      snhtPApprox: snht.snhtPApprox,
      snhtTCrit05: snht.snhtTCrit05,
      snhtAStarZeroBased: snhtAStarZero,
      snhtMeanShift: snht.snhtMeanShift,
      lombardDecisive,
      snhtDecisive,
      argmaxDistance,
      signAgreement,
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
    bothDecisiveSignAgree,
    bothDecisiveSignDisagree,
    sourcesOnlyInLombard,
    sourcesOnlyInSnht,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis222Axis221LombardSnhtReport.
 */
export function summarizeAxis222Axis221LombardSnhtReport(
  report: Axis222Axis221LombardSnhtReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const g = report.proximityGuard;
  const j = report.byJointAlignment;
  const b = report.bucketCounts;
  return (
    `axis-222xaxis-221 alpha=${a} guard=${g} n=${n} both=${report.bothDecisive}/${n} ` +
    `signAgree=${report.bothDecisiveSignAgree}/${report.bothDecisive} ` +
    `align[a/m]=${j.aligned}/${j.misaligned} ` +
    `buckets[aa/am/lo/so/ne]=${b['agree-aligned']}/${b['agree-misaligned']}/${b['lombard-only']}/${b['snht-only']}/${b['no-evidence']}`
  );
}
