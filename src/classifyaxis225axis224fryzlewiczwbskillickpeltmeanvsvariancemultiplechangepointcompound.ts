/**
 * classifyAxis225Axis224FryzlewiczWbsKillickPeltMeanVsVarianceMultipleChangepointCompound:
 * cross-axis 5-bucket diagnostic joining the v0.6.567
 * axis-225 FRYZLEWICZ 2014 WILD BINARY SEGMENTATION
 * (WBS) MULTIPLE-CHANGEPOINT MEAN estimator (`wbsM`,
 * `wbsTauStar`, `wbsMaxAbsCusum`, `wbsThreshold`,
 * `wbsMeanRangeRatio`, `wbsMeanHomogeneity`) with the
 * v0.6.563 axis-224 KILLICK-FEARNHEAD-ECKLEY 2012 PELT
 * MULTIPLE-CHANGEPOINT VARIANCE-SEGMENTATION (`peltM`,
 * `peltTauStar`, `peltVarRangeRatio`, `peltCostReduction`,
 * `peltVarHomogeneity`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes are MULTIPLE-CHANGEPOINT
 * estimators -- so the cardinality dimension is shared.
 * They are mutually orthogonal along three INDEPENDENT
 * dimensions:
 *
 *   1. MOMENT TARGETED. WBS targets the FIRST MOMENT
 *      (mean-shift CUSUM on the raw series). PELT targets
 *      the SECOND MOMENT (variance segmentation on the
 *      mean-centred series under Gaussian variance cost).
 *   2. ESTIMATION CRITERION. WBS uses a CUSUM-MAX TEST
 *      with a SIGMA-AND-LOG-N THRESHOLD calibrated by
 *      MAD-of-first-differences. PELT uses a BIC-PENALISED
 *      LIKELIHOOD with a Schwarz finite-sample penalty --
 *      no test threshold.
 *   3. ALGORITHMIC FAMILY. WBS is a RANDOMISED RECURSIVE
 *      CUSUM AGGREGATION over wild sub-intervals (with
 *      seedable mulberry32 determinism). PELT is a
 *      DETERMINISTIC DYNAMIC-PROGRAMMING RECURSION with
 *      sub-additivity pruning.
 *
 * The two estimators DECOUPLE the moment-targeted and the
 * test-criterion dimensions of multiple-changepoint
 * detection. Joint behaviour is mechanistically informative:
 *
 *   - wbs-only (WBS m>=1, PELT m=0): pure mean shifts that
 *     do not perturb the segment-wise variance enough to
 *     pay the BIC penalty. Common on slowly-drifting load
 *     where the within-segment scatter is roughly constant
 *     but the level moves.
 *   - pelt-only (PELT m>=1, WBS m=0): pure variance
 *     regime change with no detectable mean shift. Common
 *     on bursty / quiescent alternation around a stable
 *     long-run mean.
 *   - agree-aligned (both m>=1 AND nearest-neighbour CP
 *     proximity within proximityGuard days): joint MEAN-
 *     AND-VARIANCE regime change at the same epoch.
 *     Strongest evidence for a single underlying regime
 *     transition.
 *   - agree-misaligned (both m>=1 but every WBS tau is
 *     more than proximityGuard days from every PELT tau):
 *     two structurally distinct findings -- the source has
 *     a mean-shift schedule disjoint from its variance-
 *     shift schedule. Often diagnostic of compound
 *     pipeline events (e.g. config change vs traffic
 *     spike).
 *   - no-evidence: both report m=0 at their respective
 *     thresholds -- joint mean-and-variance stationarity.
 *
 * 5-bucket compound (mirrors the prior axis-22X x axis-22X
 * compounds):
 *
 * ```
 * 'agree-aligned'    wbsDecisive AND peltDecisive AND aligned
 * 'agree-misaligned' wbsDecisive AND peltDecisive AND NOT aligned
 * 'wbs-only'         wbsDecisive AND NOT peltDecisive
 * 'pelt-only'        peltDecisive AND NOT wbsDecisive
 * 'no-evidence'      neither decisive
 * ```
 *
 * Decisiveness:
 *   - wbsDecisive  := wbsM >= 1
 *   - peltDecisive := peltM >= 1
 *
 * Aligned (when both decisive):
 *   - aligned := exists (i, j) with
 *               |wbsTauStar[i] - peltTauStar[j]| <= proximityGuard
 *     i.e. NEAREST-NEIGHBOUR proximity in either direction.
 *     proximityGuard = 0 forces exact-match on a shared CP.
 *
 * Refs: Fryzlewicz 2014 *AnnStat* 42:2243-2281; Killick-
 * Fearnhead-Eckley 2012 *JASA* 107:1590-1598.
 */

export interface FryzlewiczWbsRowForPeltCompound {
  source: string;
  wbsM: number;
  wbsTauStar: number[];
  wbsMaxAbsCusum: number;
  wbsThreshold: number;
  wbsMeanRangeRatio: number;
  wbsMeanHomogeneity: number;
}

export interface KillickPeltRowForWbsCompound {
  source: string;
  peltM: number;
  peltTauStar: number[];
  peltVarRangeRatio: number;
  peltCostReduction: number;
  peltVarHomogeneity: number;
}

export type Axis225Axis224WbsPeltBucket =
  | 'agree-aligned'
  | 'agree-misaligned'
  | 'wbs-only'
  | 'pelt-only'
  | 'no-evidence';

export type Axis225Axis224WbsPeltJointAlignment = 'aligned' | 'misaligned';

export interface Axis225Axis224WbsPeltJoinedRow {
  source: string;
  wbsM: number;
  wbsTauStar: number[];
  wbsMaxAbsCusum: number;
  wbsThreshold: number;
  wbsMeanRangeRatio: number;
  wbsMeanHomogeneity: number;
  peltM: number;
  peltTauStar: number[];
  peltVarRangeRatio: number;
  peltCostReduction: number;
  peltVarHomogeneity: number;
  wbsDecisive: boolean;
  peltDecisive: boolean;
  /** Min over all (i, j) pairs of |wbsTauStar[i] - peltTauStar[j]|; MAX_SAFE_INTEGER if either is empty. */
  nearestPairDistance: number;
  /** True iff WBS m>=2 OR PELT m>=2 (multi-regime evidence in at least one axis). */
  multiRegimeEither: boolean;
  bucket: Axis225Axis224WbsPeltBucket;
  jointAlignment: Axis225Axis224WbsPeltJointAlignment | null;
}

export interface Axis225Axis224WbsPeltReport {
  proximityGuard: number;
  rows: Axis225Axis224WbsPeltJoinedRow[];
  bucketCounts: Record<Axis225Axis224WbsPeltBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointAlignment: {
    aligned: number;
    misaligned: number;
    anyMissingDecisive: number;
  };
  bothDecisiveMultiRegime: number;
  bothDecisiveSingleRegime: number;
  sourcesOnlyInWbs: string[];
  sourcesOnlyInPelt: string[];
}

export function classifyAxis225Axis224FryzlewiczWbsKillickPeltMeanVsVarianceMultipleChangepointCompound(
  wbsRows: FryzlewiczWbsRowForPeltCompound[],
  peltRows: KillickPeltRowForWbsCompound[],
  proximityGuard = 5,
): Axis225Axis224WbsPeltReport {
  const fnName =
    'classifyAxis225Axis224FryzlewiczWbsKillickPeltMeanVsVarianceMultipleChangepointCompound';
  if (!Number.isInteger(proximityGuard) || proximityGuard < 0) {
    throw new Error(
      `${fnName}: proximityGuard must be a non-negative integer (got ${proximityGuard})`,
    );
  }
  if (!Array.isArray(wbsRows)) {
    throw new Error(`${fnName}: wbsRows must be an array`);
  }
  if (!Array.isArray(peltRows)) {
    throw new Error(`${fnName}: peltRows must be an array`);
  }

  const wbsBySrc = new Map<string, FryzlewiczWbsRowForPeltCompound>();
  for (const r of wbsRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(`${fnName}: wbs row has invalid source: ${r.source}`);
    }
    if (
      !Number.isInteger(r.wbsM) ||
      r.wbsM < 0 ||
      !Array.isArray(r.wbsTauStar) ||
      r.wbsTauStar.length !== r.wbsM ||
      !Number.isFinite(r.wbsMaxAbsCusum) ||
      r.wbsMaxAbsCusum < 0 ||
      !Number.isFinite(r.wbsThreshold) ||
      r.wbsThreshold < 0 ||
      !Number.isFinite(r.wbsMeanRangeRatio) ||
      r.wbsMeanRangeRatio < 1 ||
      !Number.isFinite(r.wbsMeanHomogeneity) ||
      r.wbsMeanHomogeneity < 0 ||
      r.wbsMeanHomogeneity > 1
    ) {
      throw new Error(
        `${fnName}: wbs row '${r.source}' has invalid wbsM/tauStar/maxAbsCusum/threshold/meanRangeRatio/meanHomogeneity`,
      );
    }
    for (let i = 0; i < r.wbsTauStar.length; i += 1) {
      if (
        !Number.isInteger(r.wbsTauStar[i]) ||
        (r.wbsTauStar[i] as number) < 1
      ) {
        throw new Error(
          `${fnName}: wbs row '${r.source}' tauStar[${i}] must be integer >= 1`,
        );
      }
      if (
        i > 0 &&
        (r.wbsTauStar[i] as number) <= (r.wbsTauStar[i - 1] as number)
      ) {
        throw new Error(
          `${fnName}: wbs row '${r.source}' tauStar must be strictly ascending`,
        );
      }
    }
    if (wbsBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate wbs source '${r.source}'`);
    }
    wbsBySrc.set(r.source, r);
  }

  const peltBySrc = new Map<string, KillickPeltRowForWbsCompound>();
  for (const r of peltRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(`${fnName}: pelt row has invalid source: ${r.source}`);
    }
    if (
      !Number.isInteger(r.peltM) ||
      r.peltM < 0 ||
      !Array.isArray(r.peltTauStar) ||
      r.peltTauStar.length !== r.peltM ||
      !Number.isFinite(r.peltVarRangeRatio) ||
      r.peltVarRangeRatio < 1 ||
      !Number.isFinite(r.peltCostReduction) ||
      r.peltCostReduction < 0 ||
      !Number.isFinite(r.peltVarHomogeneity) ||
      r.peltVarHomogeneity < 0 ||
      r.peltVarHomogeneity > 1
    ) {
      throw new Error(
        `${fnName}: pelt row '${r.source}' has invalid peltM/tauStar/varRangeRatio/costReduction/varHomogeneity`,
      );
    }
    for (let i = 0; i < r.peltTauStar.length; i += 1) {
      if (
        !Number.isInteger(r.peltTauStar[i]) ||
        (r.peltTauStar[i] as number) < 1
      ) {
        throw new Error(
          `${fnName}: pelt row '${r.source}' tauStar[${i}] must be integer >= 1`,
        );
      }
      if (
        i > 0 &&
        (r.peltTauStar[i] as number) <= (r.peltTauStar[i - 1] as number)
      ) {
        throw new Error(
          `${fnName}: pelt row '${r.source}' tauStar must be strictly ascending`,
        );
      }
    }
    if (peltBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate pelt source '${r.source}'`);
    }
    peltBySrc.set(r.source, r);
  }

  const sourcesOnlyInWbs: string[] = [];
  const sourcesOnlyInPelt: string[] = [];
  for (const s of wbsBySrc.keys()) {
    if (!peltBySrc.has(s)) sourcesOnlyInWbs.push(s);
  }
  for (const s of peltBySrc.keys()) {
    if (!wbsBySrc.has(s)) sourcesOnlyInPelt.push(s);
  }
  sourcesOnlyInWbs.sort();
  sourcesOnlyInPelt.sort();

  const joinedSources: string[] = [];
  for (const s of wbsBySrc.keys()) if (peltBySrc.has(s)) joinedSources.push(s);
  joinedSources.sort();

  const rows: Axis225Axis224WbsPeltJoinedRow[] = [];
  const bucketCounts: Record<Axis225Axis224WbsPeltBucket, number> = {
    'agree-aligned': 0,
    'agree-misaligned': 0,
    'wbs-only': 0,
    'pelt-only': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  let aligned = 0;
  let misaligned = 0;
  let anyMissingDecisive = 0;
  let bothDecisiveMultiRegime = 0;
  let bothDecisiveSingleRegime = 0;

  for (const src of joinedSources) {
    const w = wbsBySrc.get(src)!;
    const p = peltBySrc.get(src)!;
    const wbsDecisive = w.wbsM >= 1;
    const peltDecisive = p.peltM >= 1;

    let nearestPairDistance = Number.MAX_SAFE_INTEGER;
    if (w.wbsTauStar.length > 0 && p.peltTauStar.length > 0) {
      let best = Number.MAX_SAFE_INTEGER;
      for (const a of w.wbsTauStar) {
        for (const b of p.peltTauStar) {
          const d = Math.abs(a - b);
          if (d < best) best = d;
        }
      }
      nearestPairDistance = best;
    }
    const isAligned =
      wbsDecisive &&
      peltDecisive &&
      nearestPairDistance <= proximityGuard;

    let bucket: Axis225Axis224WbsPeltBucket;
    if (wbsDecisive && peltDecisive) {
      bucket = isAligned ? 'agree-aligned' : 'agree-misaligned';
      bothDecisive += 1;
      if (isAligned) aligned += 1;
      else misaligned += 1;
      if (w.wbsM >= 2 || p.peltM >= 2) bothDecisiveMultiRegime += 1;
      else bothDecisiveSingleRegime += 1;
    } else if (wbsDecisive) {
      bucket = 'wbs-only';
      anyMissingDecisive += 1;
    } else if (peltDecisive) {
      bucket = 'pelt-only';
      anyMissingDecisive += 1;
    } else {
      bucket = 'no-evidence';
      anyMissingDecisive += 1;
    }
    if (wbsDecisive || peltDecisive) atLeastOneDecisive += 1;

    bucketCounts[bucket] += 1;

    rows.push({
      source: src,
      wbsM: w.wbsM,
      wbsTauStar: w.wbsTauStar.slice(),
      wbsMaxAbsCusum: w.wbsMaxAbsCusum,
      wbsThreshold: w.wbsThreshold,
      wbsMeanRangeRatio: w.wbsMeanRangeRatio,
      wbsMeanHomogeneity: w.wbsMeanHomogeneity,
      peltM: p.peltM,
      peltTauStar: p.peltTauStar.slice(),
      peltVarRangeRatio: p.peltVarRangeRatio,
      peltCostReduction: p.peltCostReduction,
      peltVarHomogeneity: p.peltVarHomogeneity,
      wbsDecisive,
      peltDecisive,
      nearestPairDistance,
      multiRegimeEither: w.wbsM >= 2 || p.peltM >= 2,
      bucket,
      jointAlignment:
        wbsDecisive && peltDecisive
          ? isAligned
            ? 'aligned'
            : 'misaligned'
          : null,
    });
  }

  return {
    proximityGuard,
    rows,
    bucketCounts,
    bothDecisive,
    atLeastOneDecisive,
    byJointAlignment: {
      aligned,
      misaligned,
      anyMissingDecisive,
    },
    bothDecisiveMultiRegime,
    bothDecisiveSingleRegime,
    sourcesOnlyInWbs,
    sourcesOnlyInPelt,
  };
}
