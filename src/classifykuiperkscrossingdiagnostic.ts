/**
 * classifyKuiperKsCrossingDiagnostic: cross-axis joiner
 * reconciling axis-192 KUIPER TWO-SAMPLE TEST (kpV =
 * sup(F_A - F_B) + sup(F_B - F_A); kpP) with axis-118
 * KOLMOGOROV-SMIRNOV TWO-SAMPLE TEST (ksD = max(sup(F_A
 * - F_B), sup(F_B - F_A)); ksP) on a per-source join,
 * into seven mutually-exclusive bivariate
 * SIGNIFICANCE x ECDF-CROSSING-SHAPE buckets.
 *
 * WHY THIS COMPOUND IS THE RIGHT JOIN. axis-118 and
 * axis-192 are structurally bracketed:
 *
 *     ksD <= kpV <= 2 * ksD
 *
 * with EQUALITY on the LEFT iff one of the two one-
 * sided suprema is zero (clean ONE-SIDED ECDF
 * crossing -- a monotone shift such that F_A is
 * uniformly above or uniformly below F_B), and
 * EQUALITY on the RIGHT iff the two one-sided suprema
 * are EXACTLY EQUAL (perfectly BALANCED TWO-SIDED ECDF
 * crossing -- e.g. a pure scale shift with equal
 * medians). The RATIO
 *
 *     kpV / ksD  in  [1, 2]
 *
 * is a SHAPE STATISTIC of the ECDF-difference: 1.0
 * means a clean one-sided shift, 2.0 means a perfectly
 * balanced two-sided crossing, intermediate values
 * mean a partial two-sided crossing. We bin the ratio
 * at 1.25 / 1.75 to surface three SHAPE classes:
 *
 *   - one-sided           : ratio in [1.00, 1.25)
 *                           dominated by a single
 *                           ECDF lobe; the alternative
 *                           is well-described as a
 *                           location/stochastic shift.
 *   - mixed-crossing      : ratio in [1.25, 1.75)
 *                           neither side negligible
 *                           but unbalanced; partial
 *                           two-sided ECDF gap.
 *   - balanced-crossing   : ratio in [1.75, 2.00]
 *                           the two lobes are roughly
 *                           equal; signature of a pure
 *                           SCALE / SHAPE shift with
 *                           little or no median
 *                           displacement (the
 *                           classical alternative
 *                           where Kuiper outperforms
 *                           KS by up to 2x in
 *                           detection power).
 *
 * Crossing the SHAPE class with the joint significance
 * pattern (both/either/neither rejecting at .05)
 * produces the diagnostic buckets.
 *
 * BUCKETS:
 *
 *   - both-reject-balanced-crossing : both axes reject
 *     AND the ECDF gap is two-sided-balanced. The
 *     archetypal ALL-EFFECT-BUT-NO-MEDIAN-SHIFT
 *     pattern (pure scale / multimodality emergence /
 *     bimodality flip). This is exactly the shape
 *     against which Kuiper's two-sided D+ + D-
 *     functional gives strictly more power than KS's
 *     max(D+, D-).
 *
 *   - both-reject-mixed-crossing : both axes reject
 *     AND the ECDF gap has substantial weight in BOTH
 *     directions but with one lobe dominating.
 *     Signature of a JOINT location-and-scale shift.
 *
 *   - both-reject-one-sided : both axes reject AND
 *     the ECDF gap is essentially one-sided. Signature
 *     of a CLEAN STOCHASTIC SHIFT (location move or
 *     dominance shift with little scale change).
 *
 *   - kuiper-only : Kuiper rejects but KS does NOT.
 *     SUSPICIOUS PATTERN: the two-sided summed gap is
 *     significant while the larger single lobe alone
 *     is not. Almost always pairs with
 *     balanced-crossing shape. Kuiper-recovers-power-
 *     vs-KS archetype.
 *
 *   - ks-only : KS rejects but Kuiper does NOT. RARE
 *     and slightly counter-intuitive: it can occur
 *     because Kuiper's inflation factor (sqrt(en) +
 *     0.155 + 0.24/sqrt(en)) is slightly larger than
 *     KS's (sqrt(en)) so for borderline-significant
 *     KS rejections the Kuiper-side null can be
 *     slightly more conservative once kpV is not much
 *     larger than ksD (one-sided shape).
 *
 *   - neither-reject : both axes ns. No detectable
 *     ECDF gap.
 *
 *   - degenerate : kpV == 0 (identical ECDFs); ratio
 *     is undefined; both p-values are 1.
 *
 * WHY THIS IS NOT A SIMPLE WRAPPER. The shape ratio
 * kpV/ksD is COMPUTABLE from the per-source row in
 * either underlying axis (both expose the suprema),
 * but its INTERPRETATION as a TWO-SIDED-CROSSING
 * DIAGNOSTIC requires the bracketing relation
 * ksD <= kpV <= 2*ksD as a MATHEMATICAL FACT, not a
 * data-driven observation. This compound surfaces
 * that diagnostic as a first-class output.
 *
 * Refs: Kuiper 1960 *Proc. Koninklijke Nederlandse
 * Akademie van Wetenschappen Series A* 63:38-47;
 * Stephens 1965 *Biometrika* 52(3-4):309-321; Massey
 * 1951 *J. American Statistical Association* 46(253):
 * 68-78; Press et al. 2007 *Numerical Recipes* 3rd ed.
 * sec. 14.3.
 */

export type KuiperKsCrossingShape =
  | 'one-sided'
  | 'mixed-crossing'
  | 'balanced-crossing';

export type KuiperKsCrossingBucket =
  | 'both-reject-balanced-crossing'
  | 'both-reject-mixed-crossing'
  | 'both-reject-one-sided'
  | 'kuiper-only'
  | 'ks-only'
  | 'neither-reject'
  | 'degenerate';

export interface KuiperRowForKsJoin {
  source: string;
  /** Kuiper V two-sided supremum-sum statistic in [0, 2]. */
  kpV: number;
  /** Kuiper two-sided p-value in [0, 1]. */
  kpP: number;
}

export interface KsRowForKuiperJoin {
  source: string;
  /** KS two-sided supremum statistic in [0, 1]. */
  ksD: number;
  /** KS two-sided p-value in [0, 1]. */
  ksP: number;
}

export interface ClassifiedKuiperKsRow {
  source: string;
  kpV: number;
  kpP: number;
  ksD: number;
  ksP: number;
  /**
   * Shape ratio kpV / ksD in [1, 2], or null when ksD = 0
   * (identical ECDFs).
   */
  shapeRatio: number | null;
  shape: KuiperKsCrossingShape | 'degenerate';
  bucket: KuiperKsCrossingBucket;
}

export interface ClassifyKuiperKsReport {
  rows: ClassifiedKuiperKsRow[];
  bucketCounts: Record<KuiperKsCrossingBucket, number>;
  /** Number of sources where BOTH axes reject at .05. */
  bothReject: number;
  /** Number where ONLY Kuiper rejects (recovers power). */
  kuiperOnly: number;
  /** Number where ONLY KS rejects. */
  ksOnly: number;
  /** Number where the ECDF crossing is balanced (ratio >= 1.75). */
  balancedCrossings: number;
  /** Sources present in kpRows but missing from ksRows. */
  sourcesOnlyInKp: string[];
  /** Sources present in ksRows but missing from kpRows. */
  sourcesOnlyInKs: string[];
}

const ALPHA = 0.05;
const SHAPE_LOW = 1.25;
const SHAPE_HIGH = 1.75;

export function classifyKuiperKsCrossingDiagnostic(
  kpRows: ReadonlyArray<KuiperRowForKsJoin>,
  ksRows: ReadonlyArray<KsRowForKuiperJoin>,
): ClassifyKuiperKsReport {
  const seenK = new Set<string>();
  for (const r of kpRows) {
    if (seenK.has(r.source)) {
      throw new Error(
        `classifyKuiperKsCrossingDiagnostic: duplicate kuiper source '${r.source}'`,
      );
    }
    seenK.add(r.source);
    if (!Number.isFinite(r.kpV) || r.kpV < 0 || r.kpV > 2) {
      throw new Error(
        `classifyKuiperKsCrossingDiagnostic: kpV must be finite in [0, 2] for source '${r.source}' (got ${r.kpV})`,
      );
    }
    if (!Number.isFinite(r.kpP) || r.kpP < 0 || r.kpP > 1) {
      throw new Error(
        `classifyKuiperKsCrossingDiagnostic: kpP must be finite in [0, 1] for source '${r.source}' (got ${r.kpP})`,
      );
    }
  }
  const seenS = new Set<string>();
  for (const r of ksRows) {
    if (seenS.has(r.source)) {
      throw new Error(
        `classifyKuiperKsCrossingDiagnostic: duplicate ks source '${r.source}'`,
      );
    }
    seenS.add(r.source);
    if (!Number.isFinite(r.ksD) || r.ksD < 0 || r.ksD > 1) {
      throw new Error(
        `classifyKuiperKsCrossingDiagnostic: ksD must be finite in [0, 1] for source '${r.source}' (got ${r.ksD})`,
      );
    }
    if (!Number.isFinite(r.ksP) || r.ksP < 0 || r.ksP > 1) {
      throw new Error(
        `classifyKuiperKsCrossingDiagnostic: ksP must be finite in [0, 1] for source '${r.source}' (got ${r.ksP})`,
      );
    }
  }

  const kpByName = new Map<string, KuiperRowForKsJoin>();
  for (const r of kpRows) kpByName.set(r.source, r);
  const ksByName = new Map<string, KsRowForKuiperJoin>();
  for (const r of ksRows) ksByName.set(r.source, r);

  const sourcesOnlyInKp: string[] = [];
  const sourcesOnlyInKs: string[] = [];
  for (const r of kpRows) {
    if (!ksByName.has(r.source)) sourcesOnlyInKp.push(r.source);
  }
  for (const r of ksRows) {
    if (!kpByName.has(r.source)) sourcesOnlyInKs.push(r.source);
  }
  sourcesOnlyInKp.sort();
  sourcesOnlyInKs.sort();

  const rows: ClassifiedKuiperKsRow[] = [];
  const bucketCounts: Record<KuiperKsCrossingBucket, number> = {
    'both-reject-balanced-crossing': 0,
    'both-reject-mixed-crossing': 0,
    'both-reject-one-sided': 0,
    'kuiper-only': 0,
    'ks-only': 0,
    'neither-reject': 0,
    degenerate: 0,
  };
  let bothReject = 0;
  let kuiperOnly = 0;
  let ksOnly = 0;
  let balancedCrossings = 0;

  for (const k of kpRows) {
    const s = ksByName.get(k.source);
    if (!s) continue;
    const kpReject = k.kpP <= ALPHA;
    const ksReject = s.ksP <= ALPHA;
    let shape: KuiperKsCrossingShape | 'degenerate';
    let shapeRatio: number | null;
    if (s.ksD === 0 && k.kpV === 0) {
      shape = 'degenerate';
      shapeRatio = null;
    } else if (s.ksD === 0) {
      // kpV > 0 but ksD = 0 violates the bracketing
      // relation; clamp to balanced-crossing for
      // pathological inputs.
      shape = 'balanced-crossing';
      shapeRatio = 2;
    } else {
      const rawRatio = k.kpV / s.ksD;
      // Clamp to the mathematically valid [1, 2] interval
      // in case of tiny floating-point excursions.
      const ratio = Math.max(1, Math.min(2, rawRatio));
      shapeRatio = ratio;
      if (ratio < SHAPE_LOW) shape = 'one-sided';
      else if (ratio < SHAPE_HIGH) shape = 'mixed-crossing';
      else shape = 'balanced-crossing';
    }

    let bucket: KuiperKsCrossingBucket;
    if (shape === 'degenerate') {
      bucket = 'degenerate';
    } else if (kpReject && ksReject) {
      bothReject += 1;
      if (shape === 'balanced-crossing') {
        bucket = 'both-reject-balanced-crossing';
        balancedCrossings += 1;
      } else if (shape === 'mixed-crossing') {
        bucket = 'both-reject-mixed-crossing';
      } else {
        bucket = 'both-reject-one-sided';
      }
    } else if (kpReject && !ksReject) {
      bucket = 'kuiper-only';
      kuiperOnly += 1;
      if (shape === 'balanced-crossing') balancedCrossings += 1;
    } else if (!kpReject && ksReject) {
      bucket = 'ks-only';
      ksOnly += 1;
      if (shape === 'balanced-crossing') balancedCrossings += 1;
    } else {
      bucket = 'neither-reject';
      if (shape === 'balanced-crossing') balancedCrossings += 1;
    }
    bucketCounts[bucket] += 1;
    rows.push({
      source: k.source,
      kpV: k.kpV,
      kpP: k.kpP,
      ksD: s.ksD,
      ksP: s.ksP,
      shapeRatio,
      shape,
      bucket,
    });
  }
  rows.sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0));

  return {
    rows,
    bucketCounts,
    bothReject,
    kuiperOnly,
    ksOnly,
    balancedCrossings,
    sourcesOnlyInKp,
    sourcesOnlyInKs,
  };
}
