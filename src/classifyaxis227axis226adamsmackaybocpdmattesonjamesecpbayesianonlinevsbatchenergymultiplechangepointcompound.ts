/**
 * classifyAxis227Axis226AdamsMackayBocpdMattesonJamesEcpBayesianOnlineVsBatchEnergyMultipleChangepointCompound:
 * cross-axis 5-bucket diagnostic joining the v0.6.571
 * axis-227 ADAMS-MACKAY 2007 BAYESIAN ONLINE
 * CHANGEPOINT DETECTION (BOCPD) MAP run-length surface
 * (`bocpdM`, `bocpdTauStar`, `bocpdCpProbability`,
 * `bocpdMeanRunMap`, `bocpdPosteriorEntropy`) with the
 * v0.6.569 axis-226 MATTESON-JAMES 2014 E-DIVISIVE
 * (ECP) BATCH MULTIPLE-CHANGEPOINT estimator (`ecpM`,
 * `ecpTauStar`, `ecpMaxQStar`, `ecpThreshold`,
 * `ecpDistributionalHomogeneity`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes are MULTIPLE-CHANGEPOINT
 * estimators on the SAME gap-filled daily total_tokens
 * series -- so the cardinality dimension is shared.
 * They are mutually orthogonal along three INDEPENDENT
 * dimensions:
 *
 *   1. INFERENCE PARADIGM. BOCPD (axis-227) is BAYESIAN
 *      with a proper geometric prior on segment length
 *      and produces a calibrated POSTERIOR over the
 *      latent run length r_t. ECP (axis-226) is
 *      FREQUENTIST: a deterministic argmax of an
 *      empirical energy-distance test statistic.
 *   2. INFORMATION USE. BOCPD is ONLINE / streaming /
 *      forward-only: the posterior at time t conditions
 *      only on x[1..t]. ECP is BATCH: every interior
 *      split scan reuses the entire segment in both
 *      directions.
 *   3. WHAT IS DETECTED. BOCPD is sensitive to ANY
 *      shift in the predictive distribution of x_t given
 *      the NIG UPM (mean + variance under the Student-t
 *      posterior predictive). ECP fires on ANY shift in
 *      the EMPIRICAL DISTRIBUTION (mean / variance /
 *      shape / tail / multimodality) under the
 *      distribution-free Szekely-Rizzo energy distance.
 *      The two windows on "distribution shift" are
 *      structurally distinct: parametric NIG predictive
 *      vs non-parametric pairwise distance.
 *
 * Joint behaviour is mechanistically informative:
 *
 *   - bocpd-only (BOCPD m>=1, ECP m=0): the BAYESIAN
 *     posterior records segment restarts driven by NIG
 *     predictive surprise that the energy-distance
 *     scan does not find sharp enough to clear its
 *     log-n threshold. Common on a series with many
 *     small / smooth distributional drifts inside a
 *     single ECP regime.
 *   - ecp-only (ECP m>=1, BOCPD m=0): the energy-
 *     distance argmax finds a clear distributional
 *     change but BOCPD's MAP run-length never restarts.
 *     Typical when the shift is in a moment beyond
 *     mean+variance (e.g. tail / shape) -- the NIG
 *     predictive accommodates it without sufficient
 *     surprise.
 *   - agree-aligned (both m>=1 AND nearest-neighbour
 *     CP proximity within proximityGuard days): joint
 *     online-Bayesian + batch-energy regime change at
 *     the same epoch. STRONGEST cross-paradigm evidence
 *     for a single underlying distributional event.
 *   - agree-misaligned (both m>=1 but every BOCPD tau
 *     is more than proximityGuard days from every ECP
 *     tau): two structurally distinct findings -- the
 *     online posterior restarts on different days than
 *     the batch energy scan declares.
 *   - no-evidence: both report m=0 -- joint
 *     distributional stationarity under both paradigms.
 *
 * 5-bucket compound (mirrors prior axis-22X x axis-22X
 * compounds):
 *
 * ```
 * 'agree-aligned'    bocpdDecisive AND ecpDecisive AND aligned
 * 'agree-misaligned' bocpdDecisive AND ecpDecisive AND NOT aligned
 * 'bocpd-only'       bocpdDecisive AND NOT ecpDecisive
 * 'ecp-only'         ecpDecisive AND NOT bocpdDecisive
 * 'no-evidence'      neither decisive
 * ```
 *
 * Decisiveness:
 *   - bocpdDecisive := bocpdM >= 1
 *   - ecpDecisive   := ecpM >= 1
 *
 * Aligned (when both decisive):
 *   - aligned := exists (i, j) with
 *               |bocpdTauStar[i] - ecpTauStar[j]| <= proximityGuard
 *
 * Refs: Adams-MacKay 2007 arXiv:0710.3742; Matteson-
 * James 2014 *JASA* 109:334-345.
 */

export interface AdamsMackayBocpdRowForEcpCompound {
  source: string;
  bocpdM: number;
  bocpdTauStar: number[];
  bocpdCpProbability: number;
  bocpdMeanRunMap: number;
  bocpdPosteriorEntropy: number;
}

export interface MattesonJamesEcpRowForBocpdCompound {
  source: string;
  ecpM: number;
  ecpTauStar: number[];
  ecpMaxQStar: number;
  ecpThreshold: number;
  ecpDistributionalHomogeneity: number;
}

export type Axis227Axis226BocpdEcpBucket =
  | 'agree-aligned'
  | 'agree-misaligned'
  | 'bocpd-only'
  | 'ecp-only'
  | 'no-evidence';

export type Axis227Axis226BocpdEcpJointAlignment = 'aligned' | 'misaligned';

export interface Axis227Axis226BocpdEcpJoinedRow {
  source: string;
  bocpdM: number;
  bocpdTauStar: number[];
  bocpdCpProbability: number;
  bocpdMeanRunMap: number;
  bocpdPosteriorEntropy: number;
  ecpM: number;
  ecpTauStar: number[];
  ecpMaxQStar: number;
  ecpThreshold: number;
  ecpDistributionalHomogeneity: number;
  bocpdDecisive: boolean;
  ecpDecisive: boolean;
  /** Min over all (i, j) of |bocpdTauStar[i] - ecpTauStar[j]|; MAX_SAFE_INTEGER if either is empty. */
  nearestPairDistance: number;
  /** True iff bocpdM >= 2 OR ecpM >= 2. */
  multiRegimeEither: boolean;
  bucket: Axis227Axis226BocpdEcpBucket;
  jointAlignment: Axis227Axis226BocpdEcpJointAlignment | null;
}

export interface Axis227Axis226BocpdEcpReport {
  proximityGuard: number;
  rows: Axis227Axis226BocpdEcpJoinedRow[];
  bucketCounts: Record<Axis227Axis226BocpdEcpBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointAlignment: {
    aligned: number;
    misaligned: number;
    anyMissingDecisive: number;
  };
  bothDecisiveMultiRegime: number;
  bothDecisiveSingleRegime: number;
  sourcesOnlyInBocpd: string[];
  sourcesOnlyInEcp: string[];
}

export function classifyAxis227Axis226AdamsMackayBocpdMattesonJamesEcpBayesianOnlineVsBatchEnergyMultipleChangepointCompound(
  bocpdRows: AdamsMackayBocpdRowForEcpCompound[],
  ecpRows: MattesonJamesEcpRowForBocpdCompound[],
  proximityGuard = 5,
): Axis227Axis226BocpdEcpReport {
  const fnName =
    'classifyAxis227Axis226AdamsMackayBocpdMattesonJamesEcpBayesianOnlineVsBatchEnergyMultipleChangepointCompound';
  if (!Number.isInteger(proximityGuard) || proximityGuard < 0) {
    throw new Error(
      `${fnName}: proximityGuard must be a non-negative integer (got ${proximityGuard})`,
    );
  }
  if (!Array.isArray(bocpdRows)) {
    throw new Error(`${fnName}: bocpdRows must be an array`);
  }
  if (!Array.isArray(ecpRows)) {
    throw new Error(`${fnName}: ecpRows must be an array`);
  }

  const bocpdBySrc = new Map<string, AdamsMackayBocpdRowForEcpCompound>();
  for (const r of bocpdRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(`${fnName}: bocpd row has invalid source: ${r.source}`);
    }
    if (
      !Number.isInteger(r.bocpdM) ||
      r.bocpdM < 0 ||
      !Array.isArray(r.bocpdTauStar) ||
      r.bocpdTauStar.length !== r.bocpdM ||
      !Number.isFinite(r.bocpdCpProbability) ||
      r.bocpdCpProbability < 0 ||
      r.bocpdCpProbability > 1 ||
      !Number.isFinite(r.bocpdMeanRunMap) ||
      r.bocpdMeanRunMap < 0 ||
      !Number.isFinite(r.bocpdPosteriorEntropy) ||
      r.bocpdPosteriorEntropy < 0
    ) {
      throw new Error(
        `${fnName}: bocpd row '${r.source}' has invalid bocpdM/tauStar/cpProbability/meanRunMap/posteriorEntropy`,
      );
    }
    for (let i = 0; i < r.bocpdTauStar.length; i += 1) {
      if (!Number.isInteger(r.bocpdTauStar[i]) || (r.bocpdTauStar[i] as number) < 1) {
        throw new Error(
          `${fnName}: bocpd row '${r.source}' tauStar[${i}] must be integer >= 1`,
        );
      }
      if (
        i > 0 &&
        (r.bocpdTauStar[i] as number) <= (r.bocpdTauStar[i - 1] as number)
      ) {
        throw new Error(
          `${fnName}: bocpd row '${r.source}' tauStar must be strictly ascending`,
        );
      }
    }
    if (bocpdBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate bocpd source '${r.source}'`);
    }
    bocpdBySrc.set(r.source, r);
  }

  const ecpBySrc = new Map<string, MattesonJamesEcpRowForBocpdCompound>();
  for (const r of ecpRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(`${fnName}: ecp row has invalid source: ${r.source}`);
    }
    if (
      !Number.isInteger(r.ecpM) ||
      r.ecpM < 0 ||
      !Array.isArray(r.ecpTauStar) ||
      r.ecpTauStar.length !== r.ecpM ||
      !Number.isFinite(r.ecpMaxQStar) ||
      r.ecpMaxQStar < 0 ||
      !Number.isFinite(r.ecpThreshold) ||
      r.ecpThreshold < 0 ||
      !Number.isFinite(r.ecpDistributionalHomogeneity) ||
      r.ecpDistributionalHomogeneity < 0 ||
      r.ecpDistributionalHomogeneity > 1
    ) {
      throw new Error(
        `${fnName}: ecp row '${r.source}' has invalid ecpM/tauStar/maxQStar/threshold/distributionalHomogeneity`,
      );
    }
    for (let i = 0; i < r.ecpTauStar.length; i += 1) {
      if (!Number.isInteger(r.ecpTauStar[i]) || (r.ecpTauStar[i] as number) < 1) {
        throw new Error(
          `${fnName}: ecp row '${r.source}' tauStar[${i}] must be integer >= 1`,
        );
      }
      if (
        i > 0 &&
        (r.ecpTauStar[i] as number) <= (r.ecpTauStar[i - 1] as number)
      ) {
        throw new Error(
          `${fnName}: ecp row '${r.source}' tauStar must be strictly ascending`,
        );
      }
    }
    if (ecpBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate ecp source '${r.source}'`);
    }
    ecpBySrc.set(r.source, r);
  }

  const sourcesOnlyInBocpd: string[] = [];
  const sourcesOnlyInEcp: string[] = [];
  for (const s of bocpdBySrc.keys()) {
    if (!ecpBySrc.has(s)) sourcesOnlyInBocpd.push(s);
  }
  for (const s of ecpBySrc.keys()) {
    if (!bocpdBySrc.has(s)) sourcesOnlyInEcp.push(s);
  }
  sourcesOnlyInBocpd.sort();
  sourcesOnlyInEcp.sort();

  const joinedSources: string[] = [];
  for (const s of bocpdBySrc.keys()) if (ecpBySrc.has(s)) joinedSources.push(s);
  joinedSources.sort();

  const rows: Axis227Axis226BocpdEcpJoinedRow[] = [];
  const bucketCounts: Record<Axis227Axis226BocpdEcpBucket, number> = {
    'agree-aligned': 0,
    'agree-misaligned': 0,
    'bocpd-only': 0,
    'ecp-only': 0,
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
    const b = bocpdBySrc.get(src)!;
    const e = ecpBySrc.get(src)!;
    const bocpdDecisive = b.bocpdM >= 1;
    const ecpDecisive = e.ecpM >= 1;

    let nearestPairDistance = Number.MAX_SAFE_INTEGER;
    if (b.bocpdTauStar.length > 0 && e.ecpTauStar.length > 0) {
      let best = Number.MAX_SAFE_INTEGER;
      for (const x of b.bocpdTauStar) {
        for (const y of e.ecpTauStar) {
          const d = Math.abs(x - y);
          if (d < best) best = d;
        }
      }
      nearestPairDistance = best;
    }
    const isAligned =
      bocpdDecisive && ecpDecisive && nearestPairDistance <= proximityGuard;

    let bucket: Axis227Axis226BocpdEcpBucket;
    if (bocpdDecisive && ecpDecisive) {
      bucket = isAligned ? 'agree-aligned' : 'agree-misaligned';
      bothDecisive += 1;
      if (isAligned) aligned += 1;
      else misaligned += 1;
      if (b.bocpdM >= 2 || e.ecpM >= 2) bothDecisiveMultiRegime += 1;
      else bothDecisiveSingleRegime += 1;
    } else if (bocpdDecisive) {
      bucket = 'bocpd-only';
      anyMissingDecisive += 1;
    } else if (ecpDecisive) {
      bucket = 'ecp-only';
      anyMissingDecisive += 1;
    } else {
      bucket = 'no-evidence';
      anyMissingDecisive += 1;
    }
    if (bocpdDecisive || ecpDecisive) atLeastOneDecisive += 1;

    bucketCounts[bucket] += 1;

    rows.push({
      source: src,
      bocpdM: b.bocpdM,
      bocpdTauStar: b.bocpdTauStar.slice(),
      bocpdCpProbability: b.bocpdCpProbability,
      bocpdMeanRunMap: b.bocpdMeanRunMap,
      bocpdPosteriorEntropy: b.bocpdPosteriorEntropy,
      ecpM: e.ecpM,
      ecpTauStar: e.ecpTauStar.slice(),
      ecpMaxQStar: e.ecpMaxQStar,
      ecpThreshold: e.ecpThreshold,
      ecpDistributionalHomogeneity: e.ecpDistributionalHomogeneity,
      bocpdDecisive,
      ecpDecisive,
      nearestPairDistance,
      multiRegimeEither: b.bocpdM >= 2 || e.ecpM >= 2,
      bucket,
      jointAlignment:
        bocpdDecisive && ecpDecisive
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
    sourcesOnlyInBocpd,
    sourcesOnlyInEcp,
  };
}
