/**
 * classifyKuiperCliffShapeVsDominanceCompound: cross-axis
 * joiner reconciling axis-192 KUIPER TWO-SAMPLE TEST
 * (kpV = sup(F_A - F_B) + sup(F_B - F_A); kpP) with
 * axis-191 CLIFF'S DELTA bootstrap-percentile-CI
 * (deltaHat = (#{(i, j) : B_j > A_i} - #{(i, j) : B_j <
 * A_i}) / (m * n); cdCiExcludesZero) on a per-source
 * join, producing six mutually-exclusive bivariate
 * SHAPE-vs-DOMINANCE buckets.
 *
 * REFINEMENT OF axis-192 (v0.6.483): the Kuiper KS
 * crossing-shape diagnostic answered "WHAT SHAPE is the
 * ECDF gap?". This joiner answers the orthogonal
 * question "DOES THE ECDF GAP TRANSLATE TO STOCHASTIC
 * DOMINANCE?".
 *
 * STRUCTURAL ORTHOGONALITY. Kuiper V is an OMNIBUS ECDF-
 * difference functional that adds the deviation in BOTH
 * directions, so it is MAXIMISED by two-sided crossings
 * with NO MEDIAN SHIFT (pure scale, multimodality
 * emergence, bimodality flip). Cliff's delta is a
 * SIGNED ORDINAL DOMINANCE statistic
 *
 *     deltaHat = P(B > A) - P(A > B)   in  [-1, +1]
 *
 * which sits at EXACTLY ZERO under any symmetric two-
 * sided alternative (e.g. A = N(0, 1) vs B = N(0, 4):
 * P(B > A) = P(A > B) = 0.5 by symmetry, deltaHat = 0).
 * The two axes are therefore MAXIMALLY DECOUPLED on
 * exactly the alternative against which Kuiper was
 * designed -- and TIGHTLY COUPLED on monotone
 * stochastic shifts where both should agree.
 *
 * The bucket map exploits this orthogonality:
 *
 *   - shape-only-no-dominance : Kuiper REJECTS (kpP <=
 *     .05) but Cliff's delta CI INCLUDES ZERO. The
 *     CANONICAL pure-shape-shift signature: the ECDFs
 *     differ but neither half stochastically dominates
 *     the other. Diagnostic of pure scale shift,
 *     multimodality emergence, or bimodality flip --
 *     exactly the alternative Kuiper recovers vs MW /
 *     Cliff / KS.
 *
 *   - shape-and-dominance : Kuiper REJECTS AND Cliff's
 *     delta CI EXCLUDES ZERO. The COHERENT joint signal:
 *     ECDF gap PLUS ordinal dominance. Direction
 *     (`first-larger` vs `second-larger`) is taken from
 *     the SIGN of cdDelta. Signature of a clean
 *     stochastic shift that BOTH a shape test AND a
 *     dominance test confirm.
 *
 *   - dominance-only-shape-ns : Cliff's delta CI
 *     EXCLUDES ZERO but Kuiper does NOT reject. RARE:
 *     ordinal dominance is sufficiently large to
 *     bootstrap-CI-exclude zero, but the ECDF gap is
 *     sub-threshold for the asymptotic Kuiper null at
 *     .05. Signature of a SMALL, BROAD stochastic
 *     shift (every pair-comparison favours one half
 *     by a small but consistent margin; no localised
 *     ECDF gap large enough to drive Kuiper's
 *     supremum-sum). Also occurs at borderline n
 *     where Kuiper's asymptotic inflation is
 *     conservative.
 *
 *   - shape-with-large-effect-ns-ci : Kuiper REJECTS
 *     AND |cdDelta| is LARGE (>= 0.474, Romano-
 *     Coraggio-Skowronski 2006) but the bootstrap CI
 *     INCLUDES ZERO. Signature of a strong point-
 *     estimate dominance shift whose CI is too wide
 *     for inference (typically small n with high
 *     within-half variance). The shape signal carries
 *     more weight than the dominance signal here.
 *
 *   - both-ns-large-shape-ratio : neither axis rejects
 *     BUT |cdDelta| is at least `small` (>= 0.147).
 *     Suggestive but inconclusive joint pattern;
 *     surfaces "watch-list" sources whose two halves
 *     differ enough to flag but not enough to call.
 *
 *   - both-ns-negligible : both axes ns AND |cdDelta|
 *     is negligible (< 0.147). No detectable shift in
 *     EITHER shape OR ordinal dominance.
 *
 * WHY THIS IS NOT A SIMPLE WRAPPER. Each axis exposes
 * its own significance call independently; what this
 * joiner adds is the BIVARIATE INTERPRETATION of
 * (Kuiper REJECTS) x (Cliff CI EXCLUDES ZERO) as a
 * SHAPE-vs-DOMINANCE diagnostic. The
 * `shape-only-no-dominance` bucket is the
 * actionable headline: it surfaces sources whose two
 * halves differ in DISTRIBUTION SHAPE but NOT in
 * STOCHASTIC DOMINANCE -- the exact pattern where
 * follow-up scale tests (Brown-Forsythe axis-116,
 * Siegel-Tukey axis-117, Ansari-Bradley) are warranted.
 *
 * Refs: Kuiper 1960 *Proc. Koninklijke Nederlandse
 * Akademie van Wetenschappen Series A* 63:38-47;
 * Cliff 1993 *Psychological Bulletin* 114(3):494-509;
 * Romano, Coraggio & Skowronski 2006 *Annual Meeting of
 * the Florida Association of Institutional Research*;
 * Stephens 1965 *Biometrika* 52(3-4):309-321.
 */

export type KuiperCliffShapeVsDominanceBucket =
  | 'shape-only-no-dominance'
  | 'shape-and-dominance'
  | 'dominance-only-shape-ns'
  | 'shape-with-large-effect-ns-ci'
  | 'both-ns-large-shape-ratio'
  | 'both-ns-negligible';

export type KuiperCliffShapeVsDominanceDirection =
  | 'first-larger'
  | 'second-larger'
  | 'balanced';

export interface KuiperRowForCliffJoin {
  source: string;
  /** Kuiper V two-sided supremum-sum statistic in [0, 2]. */
  kpV: number;
  /** Kuiper two-sided p-value in [0, 1]. */
  kpP: number;
}

export interface CliffRowForKuiperJoin {
  source: string;
  /** Cliff's delta in [-1, +1]. Sign convention: + means second half stochastically larger. */
  cdDelta: number;
  /** Bootstrap percentile CI low endpoint in [-1, +1]. */
  cdCiLow: number;
  /** Bootstrap percentile CI high endpoint in [-1, +1]. */
  cdCiHigh: number;
  /** Whether the bootstrap CI excludes zero (significance call at the underlying alpha). */
  cdCiExcludesZero: boolean;
}

export interface ClassifiedKuiperCliffRow {
  source: string;
  kpV: number;
  kpP: number;
  cdDelta: number;
  cdAbsDelta: number;
  cdCiLow: number;
  cdCiHigh: number;
  cdCiExcludesZero: boolean;
  cdMagnitude: 'negligible' | 'small' | 'medium' | 'large';
  /** Direction inferred from cdDelta sign; 'balanced' if cdDelta = 0. */
  direction: KuiperCliffShapeVsDominanceDirection;
  bucket: KuiperCliffShapeVsDominanceBucket;
}

export interface ClassifyKuiperCliffShapeVsDominanceReport {
  rows: ClassifiedKuiperCliffRow[];
  bucketCounts: Record<KuiperCliffShapeVsDominanceBucket, number>;
  /** Headline count of pure shape-only-no-dominance sources (the canonical Kuiper-vs-Cliff disagreement). */
  shapeOnlyNoDominance: number;
  /** Coherent joint-signal count. */
  shapeAndDominance: number;
  /** Reverse disagreement: ordinal dominance without ECDF gap. */
  dominanceOnlyShapeNs: number;
  /** Sources present in kpRows but missing from cdRows. */
  sourcesOnlyInKp: string[];
  /** Sources present in cdRows but missing from kpRows. */
  sourcesOnlyInCd: string[];
}

const ALPHA = 0.05;
const NEGLIGIBLE_BOUND = 0.147;
const SMALL_BOUND = 0.33;
const LARGE_BOUND = 0.474;

function magnitudeOf(
  absDelta: number,
): 'negligible' | 'small' | 'medium' | 'large' {
  if (absDelta >= LARGE_BOUND) return 'large';
  if (absDelta >= SMALL_BOUND) return 'medium';
  if (absDelta >= NEGLIGIBLE_BOUND) return 'small';
  return 'negligible';
}

export function classifyKuiperCliffShapeVsDominanceCompound(
  kpRows: ReadonlyArray<KuiperRowForCliffJoin>,
  cdRows: ReadonlyArray<CliffRowForKuiperJoin>,
): ClassifyKuiperCliffShapeVsDominanceReport {
  const seenK = new Set<string>();
  for (const r of kpRows) {
    if (seenK.has(r.source)) {
      throw new Error(
        `classifyKuiperCliffShapeVsDominanceCompound: duplicate kuiper source '${r.source}'`,
      );
    }
    seenK.add(r.source);
    if (!Number.isFinite(r.kpV) || r.kpV < 0 || r.kpV > 2) {
      throw new Error(
        `classifyKuiperCliffShapeVsDominanceCompound: kpV must be finite in [0, 2] for source '${r.source}' (got ${r.kpV})`,
      );
    }
    if (!Number.isFinite(r.kpP) || r.kpP < 0 || r.kpP > 1) {
      throw new Error(
        `classifyKuiperCliffShapeVsDominanceCompound: kpP must be finite in [0, 1] for source '${r.source}' (got ${r.kpP})`,
      );
    }
  }
  const seenC = new Set<string>();
  for (const r of cdRows) {
    if (seenC.has(r.source)) {
      throw new Error(
        `classifyKuiperCliffShapeVsDominanceCompound: duplicate cliff source '${r.source}'`,
      );
    }
    seenC.add(r.source);
    if (!Number.isFinite(r.cdDelta) || r.cdDelta < -1 || r.cdDelta > 1) {
      throw new Error(
        `classifyKuiperCliffShapeVsDominanceCompound: cdDelta must be finite in [-1, 1] for source '${r.source}' (got ${r.cdDelta})`,
      );
    }
    if (!Number.isFinite(r.cdCiLow) || r.cdCiLow < -1 || r.cdCiLow > 1) {
      throw new Error(
        `classifyKuiperCliffShapeVsDominanceCompound: cdCiLow must be finite in [-1, 1] for source '${r.source}' (got ${r.cdCiLow})`,
      );
    }
    if (!Number.isFinite(r.cdCiHigh) || r.cdCiHigh < -1 || r.cdCiHigh > 1) {
      throw new Error(
        `classifyKuiperCliffShapeVsDominanceCompound: cdCiHigh must be finite in [-1, 1] for source '${r.source}' (got ${r.cdCiHigh})`,
      );
    }
    if (r.cdCiLow > r.cdCiHigh) {
      throw new Error(
        `classifyKuiperCliffShapeVsDominanceCompound: cdCiLow (${r.cdCiLow}) > cdCiHigh (${r.cdCiHigh}) for source '${r.source}'`,
      );
    }
  }

  const kpByName = new Map<string, KuiperRowForCliffJoin>();
  for (const r of kpRows) kpByName.set(r.source, r);
  const cdByName = new Map<string, CliffRowForKuiperJoin>();
  for (const r of cdRows) cdByName.set(r.source, r);

  const sourcesOnlyInKp: string[] = [];
  const sourcesOnlyInCd: string[] = [];
  for (const r of kpRows) {
    if (!cdByName.has(r.source)) sourcesOnlyInKp.push(r.source);
  }
  for (const r of cdRows) {
    if (!kpByName.has(r.source)) sourcesOnlyInCd.push(r.source);
  }
  sourcesOnlyInKp.sort();
  sourcesOnlyInCd.sort();

  const rows: ClassifiedKuiperCliffRow[] = [];
  const bucketCounts: Record<KuiperCliffShapeVsDominanceBucket, number> = {
    'shape-only-no-dominance': 0,
    'shape-and-dominance': 0,
    'dominance-only-shape-ns': 0,
    'shape-with-large-effect-ns-ci': 0,
    'both-ns-large-shape-ratio': 0,
    'both-ns-negligible': 0,
  };
  let shapeOnlyNoDominance = 0;
  let shapeAndDominance = 0;
  let dominanceOnlyShapeNs = 0;

  for (const k of kpRows) {
    const c = cdByName.get(k.source);
    if (!c) continue;
    const kpReject = k.kpP <= ALPHA;
    const ciExcludes = c.cdCiExcludesZero;
    const absDelta = Math.abs(c.cdDelta);
    const magnitude = magnitudeOf(absDelta);
    const direction: KuiperCliffShapeVsDominanceDirection =
      c.cdDelta > 0
        ? 'second-larger'
        : c.cdDelta < 0
          ? 'first-larger'
          : 'balanced';

    let bucket: KuiperCliffShapeVsDominanceBucket;
    if (kpReject && ciExcludes) {
      bucket = 'shape-and-dominance';
      shapeAndDominance += 1;
    } else if (kpReject && !ciExcludes && magnitude === 'large') {
      bucket = 'shape-with-large-effect-ns-ci';
    } else if (kpReject && !ciExcludes) {
      bucket = 'shape-only-no-dominance';
      shapeOnlyNoDominance += 1;
    } else if (!kpReject && ciExcludes) {
      bucket = 'dominance-only-shape-ns';
      dominanceOnlyShapeNs += 1;
    } else if (
      !kpReject &&
      !ciExcludes &&
      magnitude !== 'negligible'
    ) {
      bucket = 'both-ns-large-shape-ratio';
    } else {
      bucket = 'both-ns-negligible';
    }
    bucketCounts[bucket] += 1;
    rows.push({
      source: k.source,
      kpV: k.kpV,
      kpP: k.kpP,
      cdDelta: c.cdDelta,
      cdAbsDelta: absDelta,
      cdCiLow: c.cdCiLow,
      cdCiHigh: c.cdCiHigh,
      cdCiExcludesZero: ciExcludes,
      cdMagnitude: magnitude,
      direction,
      bucket,
    });
  }
  rows.sort((a, b) =>
    a.source < b.source ? -1 : a.source > b.source ? 1 : 0,
  );

  return {
    rows,
    bucketCounts,
    shapeOnlyNoDominance,
    shapeAndDominance,
    dominanceOnlyShapeNs,
    sourcesOnlyInKp,
    sourcesOnlyInCd,
  };
}
