/**
 * classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound:
 * cross-axis 5-bucket diagnostic joining the v0.6.558
 * axis-223 INCLÁN-TIAO 1994 ICSS VARIANCE-CHANGEPOINT
 * TEST (`itStat`, `pApprox`, `kStar`, `directionSign`,
 * `logVarRatio`, `kCritical05`) with the v0.6.554
 * axis-222 LOMBARD 1987 RANK-BASED SMOOTH-CHANGEPOINT
 * TEST (`ln`, `pApprox`, `kStar`, `directionSign`,
 * `meanShift`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. ICSS and Lombard are mutually
 * orthogonal because they target DIFFERENT MOMENTS of the
 * series under COMPLEMENTARY NULLS:
 *
 *   1. MOMENT TARGETED: ICSS tests for a change in the
 *      SECOND MOMENT (variance) under the null of constant
 *      unconditional variance. Lombard tests for a change
 *      in the FIRST MOMENT (location) under the null of
 *      exchangeability with constant variance.
 *   2. INVARIANCES: ICSS is invariant under mean-shifts
 *      (mean-centring removes them); Lombard is invariant
 *      under monotone marginal transformations (rank-based)
 *      but NOT under variance-shifts. The two tests
 *      DECOUPLE the location and scale dimensions of a
 *      regime change.
 *   3. ASYMPTOTIC DISTRIBUTION: ICSS has a Kolmogorov-
 *      Smirnov sup-norm null (L-infinity functional of a
 *      Brownian bridge of squared residuals); Lombard has
 *      an Anderson-Darling-like integrated null (L-2
 *      functional of a Brownian bridge of smoothed ranks).
 *
 * ICSS-vs-Lombard is therefore the
 * MOMENT-TARGETED x FUNCTIONAL DOUBLE DUAL on the single-
 * changepoint surface. Joint behaviour is mechanistically
 * informative:
 *
 *   - icss-only (decisive ICSS, non-decisive Lombard): the
 *     regime change is a pure VARIANCE shift -- the mean is
 *     stable while the spread of daily total_tokens
 *     widens or narrows. Common when token volume becomes
 *     more bursty (e.g. heavier weekend / weekday split, a
 *     new model with longer responses interleaved).
 *   - lombard-only (decisive Lombard, non-decisive ICSS):
 *     the regime change is a pure LOCATION shift -- the
 *     mean drifts smoothly while the spread is stable.
 *     Common with linear / logistic ramps in adoption.
 *   - agree-aligned (both decisive AND argmax days within
 *     guard): a coupled regime change where mean AND
 *     variance shift around the same day. Strongest
 *     evidence for a true behavioural transition.
 *   - agree-misaligned (both decisive but argmax days
 *     differ by more than guard): two structurally distinct
 *     regime breaks -- one in the first moment, one in the
 *     second moment. Surface for further forensic review.
 *   - no-evidence: both null -- stationarity in both
 *     moments at the alpha threshold.
 *
 * 5-bucket compound (mirrors the axis-222 x axis-221
 * scheme):
 *
 * ```
 * 'agree-aligned'    icssDecisive AND lombardDecisive AND aligned
 * 'agree-misaligned' icssDecisive AND lombardDecisive AND NOT aligned
 * 'icss-only'        icssDecisive AND NOT lombardDecisive
 * 'lombard-only'     lombardDecisive AND NOT icssDecisive
 * 'no-evidence'      neither decisive
 * ```
 *
 * Decisiveness:
 *   - icssDecisive    := icssPApprox < alpha
 *                        OR icssItStat >= icssKCritical05
 *                        (defensive OR -- pApprox is the
 *                        Kolmogorov closed form, kCritical05
 *                        the Inclán-Tiao 1994 Table-1
 *                        asymptotic 1.358).
 *   - lombardDecisive := lombardPApprox < alpha.
 *
 * Aligned (when both decisive):
 *   - aligned := |icssKStar - lombardKStar| <= proximityGuard
 *
 * proximityGuard is supplied by the caller; default = 5
 * (days). Both axes report kStar in 0-based indexing
 * already (Lombard kStar = 0-based smooth-change centre;
 * ICSS kStar = 0-based variance-changepoint), so no
 * normalisation step is required.
 *
 * jointAlignment is set ONLY when both axes are decisive,
 * to one of: 'aligned', 'misaligned'. Otherwise null.
 *
 * Determinism: pure transform. No I/O, no clock.
 */

export interface InclanTiaoIcssRowForLombardCompound {
  source: string;
  /** ICSS IT statistic, always >= 0. */
  icssItStat: number;
  /** ICSS Kolmogorov upper-tail p in [0, 1]. */
  icssPApprox: number;
  /** Inclán-Tiao 1994 Table-1 asymptotic critical at alpha=0.05 (== 1.358). */
  icssKCritical05: number;
  /** ICSS 0-based variance-changepoint index in {0..n-2}. */
  icssKStar: number;
  /** ICSS direction sign at kStar: -1, 0, or +1. */
  icssDirectionSign: number;
  /** ln(varAfter/varBefore) on the raw scale (finite). */
  icssLogVarRatio: number;
}

export interface LombardSmoothChangepointRowForIcssCompound {
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

export type Axis223Axis222IcssLombardBucket =
  | 'agree-aligned'
  | 'agree-misaligned'
  | 'icss-only'
  | 'lombard-only'
  | 'no-evidence';

export type Axis223Axis222IcssLombardJointAlignment = 'aligned' | 'misaligned';

export interface Axis223Axis222IcssLombardJoinedRow {
  source: string;
  icssItStat: number;
  icssPApprox: number;
  icssKCritical05: number;
  icssKStar: number;
  icssDirectionSign: number;
  icssLogVarRatio: number;
  lombardLn: number;
  lombardPApprox: number;
  lombardKStar: number;
  lombardDirectionSign: number;
  lombardMeanShift: number;
  icssDecisive: boolean;
  lombardDecisive: boolean;
  /** |icssKStar - lombardKStar|. */
  argmaxDistance: number;
  /** True iff the variance shift sign and the location shift sign both nonzero and equal. */
  signAgreement: boolean;
  bucket: Axis223Axis222IcssLombardBucket;
  jointAlignment: Axis223Axis222IcssLombardJointAlignment | null;
}

export interface Axis223Axis222IcssLombardReport {
  alpha: number;
  proximityGuard: number;
  rows: Axis223Axis222IcssLombardJoinedRow[];
  bucketCounts: Record<Axis223Axis222IcssLombardBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointAlignment: {
    aligned: number;
    misaligned: number;
    anyMissingDecisive: number;
  };
  bothDecisiveSignAgree: number;
  bothDecisiveSignDisagree: number;
  sourcesOnlyInIcss: string[];
  sourcesOnlyInLombard: string[];
}

export function classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound(
  icssRows: InclanTiaoIcssRowForLombardCompound[],
  lombardRows: LombardSmoothChangepointRowForIcssCompound[],
  alpha = 0.05,
  proximityGuard = 5,
): Axis223Axis222IcssLombardReport {
  const fnName =
    'classifyAxis223Axis222InclanTiaoLombardVarianceVsLocationChangepointCompound';
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new Error(`${fnName}: alpha must be in (0, 1) (got ${alpha})`);
  }
  if (!Number.isInteger(proximityGuard) || proximityGuard < 0) {
    throw new Error(
      `${fnName}: proximityGuard must be a non-negative integer (got ${proximityGuard})`,
    );
  }
  if (!Array.isArray(icssRows)) {
    throw new Error(`${fnName}: icssRows must be an array`);
  }
  if (!Array.isArray(lombardRows)) {
    throw new Error(`${fnName}: lombardRows must be an array`);
  }

  const icssBySrc = new Map<string, InclanTiaoIcssRowForLombardCompound>();
  for (const r of icssRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(`${fnName}: icss row has invalid source: ${r.source}`);
    }
    if (
      !Number.isFinite(r.icssItStat) ||
      r.icssItStat < 0 ||
      !Number.isFinite(r.icssPApprox) ||
      r.icssPApprox < 0 ||
      r.icssPApprox > 1 ||
      !Number.isFinite(r.icssKCritical05) ||
      r.icssKCritical05 <= 0 ||
      !Number.isInteger(r.icssKStar) ||
      r.icssKStar < -1 ||
      !Number.isFinite(r.icssDirectionSign) ||
      ![-1, 0, 1].includes(r.icssDirectionSign) ||
      !Number.isFinite(r.icssLogVarRatio)
    ) {
      throw new Error(
        `${fnName}: icss row '${r.source}' has invalid itStat/pApprox/kCritical05/kStar/directionSign/logVarRatio`,
      );
    }
    if (icssBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate icss source '${r.source}'`);
    }
    icssBySrc.set(r.source, r);
  }

  const lombardBySrc = new Map<
    string,
    LombardSmoothChangepointRowForIcssCompound
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

  const sourcesOnlyInIcss: string[] = [];
  const sourcesOnlyInLombard: string[] = [];
  for (const s of icssBySrc.keys()) {
    if (!lombardBySrc.has(s)) sourcesOnlyInIcss.push(s);
  }
  for (const s of lombardBySrc.keys()) {
    if (!icssBySrc.has(s)) sourcesOnlyInLombard.push(s);
  }
  sourcesOnlyInIcss.sort();
  sourcesOnlyInLombard.sort();

  const joinedSources: string[] = [];
  for (const s of icssBySrc.keys()) {
    if (lombardBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis223Axis222IcssLombardJoinedRow[] = [];
  const bucketCounts: Record<Axis223Axis222IcssLombardBucket, number> = {
    'agree-aligned': 0,
    'agree-misaligned': 0,
    'icss-only': 0,
    'lombard-only': 0,
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
    const icss = icssBySrc.get(src)!;
    const lombard = lombardBySrc.get(src)!;
    const icssDecisive =
      icss.icssPApprox < alpha || icss.icssItStat >= icss.icssKCritical05;
    const lombardDecisive = lombard.lombardPApprox < alpha;
    const anyDecisive = icssDecisive || lombardDecisive;
    if (icssDecisive && lombardDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    const argmaxDistance = Math.abs(icss.icssKStar - lombard.lombardKStar);

    // Sign agreement: variance shift sign vs location shift sign. ICSS
    // logVarRatio > 0 means variance INCREASES after kStar; Lombard
    // lombardMeanShift > 0 means mean INCREASES after kStar. We compare
    // these two sign-defined regime directions.
    const vSign =
      icss.icssLogVarRatio > 0 ? 1 : icss.icssLogVarRatio < 0 ? -1 : 0;
    const lSign =
      lombard.lombardMeanShift > 0
        ? 1
        : lombard.lombardMeanShift < 0
          ? -1
          : 0;
    const signAgreement = vSign !== 0 && lSign !== 0 && vSign === lSign;

    let bucket: Axis223Axis222IcssLombardBucket;
    let jointAlignment: Axis223Axis222IcssLombardJointAlignment | null = null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointAlignment.anyMissingDecisive += 1;
    } else if (icssDecisive && !lombardDecisive) {
      bucket = 'icss-only';
      byJointAlignment.anyMissingDecisive += 1;
    } else if (lombardDecisive && !icssDecisive) {
      bucket = 'lombard-only';
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
      icssItStat: icss.icssItStat,
      icssPApprox: icss.icssPApprox,
      icssKCritical05: icss.icssKCritical05,
      icssKStar: icss.icssKStar,
      icssDirectionSign: icss.icssDirectionSign,
      icssLogVarRatio: icss.icssLogVarRatio,
      lombardLn: lombard.lombardLn,
      lombardPApprox: lombard.lombardPApprox,
      lombardKStar: lombard.lombardKStar,
      lombardDirectionSign: lombard.lombardDirectionSign,
      lombardMeanShift: lombard.lombardMeanShift,
      icssDecisive,
      lombardDecisive,
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
    sourcesOnlyInIcss,
    sourcesOnlyInLombard,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis223Axis222IcssLombardReport.
 */
export function summarizeAxis223Axis222IcssLombardReport(
  report: Axis223Axis222IcssLombardReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const g = report.proximityGuard;
  const j = report.byJointAlignment;
  const b = report.bucketCounts;
  return (
    `axis-223xaxis-222 alpha=${a} guard=${g} n=${n} both=${report.bothDecisive}/${n} ` +
    `signAgree=${report.bothDecisiveSignAgree}/${report.bothDecisive} ` +
    `align[a/m]=${j.aligned}/${j.misaligned} ` +
    `buckets[aa/am/io/lo/ne]=${b['agree-aligned']}/${b['agree-misaligned']}/${b['icss-only']}/${b['lombard-only']}/${b['no-evidence']}`
  );
}
