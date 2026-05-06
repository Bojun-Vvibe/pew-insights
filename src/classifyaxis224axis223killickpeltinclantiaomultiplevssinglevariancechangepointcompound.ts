/**
 * classifyAxis224Axis223KillickPeltInclanTiaoMultipleVsSingleVarianceChangepointCompound:
 * cross-axis 5-bucket diagnostic joining the v0.6.563
 * axis-224 KILLICK-FEARNHEAD-ECKLEY 2012 PELT MULTIPLE-
 * CHANGEPOINT VARIANCE-SEGMENTATION (`mChangepoints`,
 * `tauStar`, `varRangeRatio`, `costReduction`,
 * `varHomogeneity`) with the v0.6.558 axis-223 INCLAN-
 * TIAO 1994 ICSS SINGLE-CHANGEPOINT VARIANCE TEST
 * (`itStat`, `pApprox`, `kStar`, `kCritical05`,
 * `directionSign`, `logVarRatio`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. PELT and ICSS both target VARIANCE
 * regime change but along three orthogonal dimensions:
 *
 *   1. CARDINALITY OF CHANGEPOINTS. ICSS is a SINGLE-
 *      CHANGEPOINT detector under H0 of constant variance
 *      vs H1 of exactly one variance shift. PELT is a
 *      MULTIPLE-CHANGEPOINT EXACT segmenter that returns
 *      the optimal m for m in {0, 1, 2, ...} jointly with
 *      the optimal {tau_j}.
 *   2. ESTIMATION CRITERION. ICSS uses the BROWNIAN-
 *      BRIDGE SUP-NORM functional with a Kolmogorov
 *      asymptotic null distribution. PELT uses the
 *      GAUSSIAN BIC-PENALISED LIKELIHOOD with a Schwarz
 *      finite-sample penalty -- no null distribution
 *      required.
 *   3. ALGORITHMIC FAMILY. ICSS is a CLOSED-FORM ARGMAX
 *      of a cumulative-sum-of-squares functional. PELT is
 *      a DYNAMIC-PROGRAMMING RECURSION with sub-additivity
 *      pruning.
 *
 * The two estimators DECOUPLE the regime-cardinality and
 * the test-criterion dimensions of variance changepoint
 * detection. Joint behaviour is mechanistically
 * informative:
 *
 *   - pelt-only (decisive PELT m>=1, non-decisive ICSS):
 *     PELT finds at least one BIC-significant variance
 *     changepoint that ICSS misses. Typically (a) MULTIPLE
 *     comparable-magnitude shifts that ICSS can only
 *     resolve as a single best |D[k]|, or (b) a localised
 *     shift where the cumulative-sum-of-squares functional
 *     never crosses 1.358 on the full window even though
 *     the BIC likelihood does prefer segmentation.
 *   - icss-only (decisive ICSS, PELT m=0): ICSS Kolmogorov
 *     asymptotic flags the series, but the BIC penalty is
 *     too aggressive to admit any partition. Common on
 *     short series (n near floor 21) or when the variance
 *     ratio is moderate (logVarRatio in (0.3, 0.8)).
 *   - agree-aligned (both decisive AND ICSS kStar within
 *     guard of the NEAREST PELT tau): coupled detection
 *     with concordant changepoint location -- strongest
 *     evidence for a single-strong variance shift.
 *   - agree-misaligned (both decisive but ICSS kStar
 *     differs from every PELT tau by more than guard): two
 *     structurally distinct findings -- ICSS picks one
 *     argmax, PELT picks a different (or larger) set of
 *     BIC-optimal changepoints. Often diagnostic of m >= 2
 *     real regimes.
 *   - no-evidence: both null -- variance stationarity
 *     at the alpha threshold AND under the BIC penalty.
 *
 * 5-bucket compound (mirrors prior axis-22X x axis-22X
 * compounds):
 *
 * ```
 * 'agree-aligned'    icssDecisive AND peltDecisive AND aligned
 * 'agree-misaligned' icssDecisive AND peltDecisive AND NOT aligned
 * 'pelt-only'        peltDecisive AND NOT icssDecisive
 * 'icss-only'        icssDecisive AND NOT peltDecisive
 * 'no-evidence'      neither decisive
 * ```
 *
 * Decisiveness:
 *   - icssDecisive := icssPApprox < alpha
 *                     OR icssItStat >= icssKCritical05
 *   - peltDecisive := peltMChangepoints >= 1
 *
 * Aligned (when both decisive):
 *   - aligned := min_j |icssKStar - peltTauStar[j]| <= proximityGuard
 *
 * proximityGuard default = 5 days. argmaxDistance is the
 * nearest-neighbour distance from icssKStar to any element
 * of peltTauStar (or +inf encoded as Number.MAX_SAFE_-
 * INTEGER if peltTauStar is empty).
 *
 * jointAlignment is set ONLY when both axes are decisive,
 * to one of: 'aligned', 'misaligned'. Otherwise null.
 *
 * Determinism: pure transform. No I/O, no clock.
 */

export interface InclanTiaoIcssRowForPeltCompound {
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

export interface KillickPeltRowForIcssCompound {
  source: string;
  /** Number of BIC-optimal variance changepoints; >= 0. */
  peltMChangepoints: number;
  /** Internal changepoint indices (ascending) in {1..n-1}; length = mChangepoints. */
  peltTauStar: number[];
  /** max(varSeg)/min(varSeg) across segments of length >= 3, varSeg > 0. */
  peltVarRangeRatio: number;
  /** baselineCost - F(n) >= 0; large = BIC strongly prefers segmentation. */
  peltCostReduction: number;
  /** 1 - logVarSpread / (logVarSpread + 1), in (0, 1]. */
  peltVarHomogeneity: number;
}

export type Axis224Axis223PeltIcssBucket =
  | 'agree-aligned'
  | 'agree-misaligned'
  | 'pelt-only'
  | 'icss-only'
  | 'no-evidence';

export type Axis224Axis223PeltIcssJointAlignment = 'aligned' | 'misaligned';

export interface Axis224Axis223PeltIcssJoinedRow {
  source: string;
  icssItStat: number;
  icssPApprox: number;
  icssKCritical05: number;
  icssKStar: number;
  icssDirectionSign: number;
  icssLogVarRatio: number;
  peltMChangepoints: number;
  peltTauStar: number[];
  peltVarRangeRatio: number;
  peltCostReduction: number;
  peltVarHomogeneity: number;
  icssDecisive: boolean;
  peltDecisive: boolean;
  /** Nearest-neighbour distance from icssKStar to any peltTauStar element; MAX_SAFE_INTEGER if empty. */
  argmaxDistance: number;
  /** True iff PELT finds m>=2 (multi-regime evidence) AND ICSS is decisive. */
  multiRegimeOverIcss: boolean;
  bucket: Axis224Axis223PeltIcssBucket;
  jointAlignment: Axis224Axis223PeltIcssJointAlignment | null;
}

export interface Axis224Axis223PeltIcssReport {
  alpha: number;
  proximityGuard: number;
  rows: Axis224Axis223PeltIcssJoinedRow[];
  bucketCounts: Record<Axis224Axis223PeltIcssBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointAlignment: {
    aligned: number;
    misaligned: number;
    anyMissingDecisive: number;
  };
  bothDecisiveMultiRegime: number;
  bothDecisiveSingleRegime: number;
  sourcesOnlyInIcss: string[];
  sourcesOnlyInPelt: string[];
}

export function classifyAxis224Axis223KillickPeltInclanTiaoMultipleVsSingleVarianceChangepointCompound(
  icssRows: InclanTiaoIcssRowForPeltCompound[],
  peltRows: KillickPeltRowForIcssCompound[],
  alpha = 0.05,
  proximityGuard = 5,
): Axis224Axis223PeltIcssReport {
  const fnName =
    'classifyAxis224Axis223KillickPeltInclanTiaoMultipleVsSingleVarianceChangepointCompound';
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
  if (!Array.isArray(peltRows)) {
    throw new Error(`${fnName}: peltRows must be an array`);
  }

  const icssBySrc = new Map<string, InclanTiaoIcssRowForPeltCompound>();
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

  const peltBySrc = new Map<string, KillickPeltRowForIcssCompound>();
  for (const r of peltRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(`${fnName}: pelt row has invalid source: ${r.source}`);
    }
    if (
      !Number.isInteger(r.peltMChangepoints) ||
      r.peltMChangepoints < 0 ||
      !Array.isArray(r.peltTauStar) ||
      r.peltTauStar.length !== r.peltMChangepoints ||
      !Number.isFinite(r.peltVarRangeRatio) ||
      r.peltVarRangeRatio < 0 ||
      !Number.isFinite(r.peltCostReduction) ||
      r.peltCostReduction < 0 ||
      !Number.isFinite(r.peltVarHomogeneity) ||
      r.peltVarHomogeneity <= 0 ||
      r.peltVarHomogeneity > 1
    ) {
      throw new Error(
        `${fnName}: pelt row '${r.source}' has invalid mChangepoints/tauStar/varRangeRatio/costReduction/varHomogeneity`,
      );
    }
    for (let i = 0; i < r.peltTauStar.length; i += 1) {
      const t = r.peltTauStar[i]!;
      if (!Number.isInteger(t) || t < 1) {
        throw new Error(
          `${fnName}: pelt row '${r.source}' tauStar[${i}] = ${t} not a positive integer`,
        );
      }
      if (i > 0 && t <= r.peltTauStar[i - 1]!) {
        throw new Error(
          `${fnName}: pelt row '${r.source}' tauStar not strictly ascending`,
        );
      }
    }
    if (peltBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate pelt source '${r.source}'`);
    }
    peltBySrc.set(r.source, r);
  }

  const sourcesOnlyInIcss: string[] = [];
  const sourcesOnlyInPelt: string[] = [];
  for (const s of icssBySrc.keys()) {
    if (!peltBySrc.has(s)) sourcesOnlyInIcss.push(s);
  }
  for (const s of peltBySrc.keys()) {
    if (!icssBySrc.has(s)) sourcesOnlyInPelt.push(s);
  }
  sourcesOnlyInIcss.sort();
  sourcesOnlyInPelt.sort();

  const joinedSources: string[] = [];
  for (const s of icssBySrc.keys()) {
    if (peltBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis224Axis223PeltIcssJoinedRow[] = [];
  const bucketCounts: Record<Axis224Axis223PeltIcssBucket, number> = {
    'agree-aligned': 0,
    'agree-misaligned': 0,
    'pelt-only': 0,
    'icss-only': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  let bothDecisiveMultiRegime = 0;
  let bothDecisiveSingleRegime = 0;
  const byJointAlignment = {
    aligned: 0,
    misaligned: 0,
    anyMissingDecisive: 0,
  };

  for (const src of joinedSources) {
    const icss = icssBySrc.get(src)!;
    const pelt = peltBySrc.get(src)!;
    const icssDecisive =
      icss.icssPApprox < alpha || icss.icssItStat >= icss.icssKCritical05;
    const peltDecisive = pelt.peltMChangepoints >= 1;
    const anyDecisive = icssDecisive || peltDecisive;
    if (icssDecisive && peltDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    let argmaxDistance: number;
    if (pelt.peltTauStar.length === 0) {
      argmaxDistance = Number.MAX_SAFE_INTEGER;
    } else {
      let best = Number.POSITIVE_INFINITY;
      for (const t of pelt.peltTauStar) {
        const d = Math.abs(icss.icssKStar - t);
        if (d < best) best = d;
      }
      argmaxDistance = best;
    }
    const multiRegimeOverIcss =
      icssDecisive && peltDecisive && pelt.peltMChangepoints >= 2;

    let bucket: Axis224Axis223PeltIcssBucket;
    let jointAlignment: Axis224Axis223PeltIcssJointAlignment | null = null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointAlignment.anyMissingDecisive += 1;
    } else if (peltDecisive && !icssDecisive) {
      bucket = 'pelt-only';
      byJointAlignment.anyMissingDecisive += 1;
    } else if (icssDecisive && !peltDecisive) {
      bucket = 'icss-only';
      byJointAlignment.anyMissingDecisive += 1;
    } else {
      // both decisive
      if (pelt.peltMChangepoints >= 2) bothDecisiveMultiRegime += 1;
      else bothDecisiveSingleRegime += 1;
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
      peltMChangepoints: pelt.peltMChangepoints,
      peltTauStar: pelt.peltTauStar.slice(),
      peltVarRangeRatio: pelt.peltVarRangeRatio,
      peltCostReduction: pelt.peltCostReduction,
      peltVarHomogeneity: pelt.peltVarHomogeneity,
      icssDecisive,
      peltDecisive,
      argmaxDistance,
      multiRegimeOverIcss,
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
    bothDecisiveMultiRegime,
    bothDecisiveSingleRegime,
    sourcesOnlyInIcss,
    sourcesOnlyInPelt,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis224Axis223PeltIcssReport.
 */
export function summarizeAxis224Axis223PeltIcssReport(
  report: Axis224Axis223PeltIcssReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const g = report.proximityGuard;
  const j = report.byJointAlignment;
  const b = report.bucketCounts;
  return (
    `axis-224xaxis-223 alpha=${a} guard=${g} n=${n} both=${report.bothDecisive}/${n} ` +
    `multi=${report.bothDecisiveMultiRegime}/${report.bothDecisive} ` +
    `align[a/m]=${j.aligned}/${j.misaligned} ` +
    `buckets[aa/am/po/io/ne]=${b['agree-aligned']}/${b['agree-misaligned']}/${b['pelt-only']}/${b['icss-only']}/${b['no-evidence']}`
  );
}
