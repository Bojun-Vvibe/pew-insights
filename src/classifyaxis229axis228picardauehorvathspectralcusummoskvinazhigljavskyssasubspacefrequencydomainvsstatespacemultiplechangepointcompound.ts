/**
 * classifyAxis229Axis228PicardAueHorvathSpectralCusumMoskvinaZhigljavskySsaSubspaceFrequencyDomainVsStateSpaceMultipleChangepointCompound:
 * cross-axis 5-bucket diagnostic joining the v0.6.574
 * axis-229 PICARD-AUE-HORVATH SPECTRAL CUSUM
 * (FREQUENCY-DOMAIN) multiple-changepoint surface
 * (`spectralM`, `spectralTauStar`, `spectralCMax`,
 * `spectralSigmaE`, `spectralCThreshold`) with the
 * v0.6.573 axis-228 MOSKVINA-ZHIGLJAVSKY SSA SUBSPACE
 * (STATE-SPACE / HANKEL DELAY-EMBEDDING) multiple-
 * changepoint surface (`ssaM`, `ssaTauStar`, `ssaDMax`,
 * `ssaDThreshold`, `ssaSubspaceRank`) on a per-source
 * basis.
 *
 * STRUCTURAL CLAIM. Both axes are MULTIPLE-CHANGEPOINT
 * estimators on the SAME gap-filled daily total_tokens
 * series -- so the cardinality dimension is shared. They
 * are mutually orthogonal along three INDEPENDENT
 * dimensions:
 *
 *   1. REPRESENTATION DOMAIN. Axis-229 lives in the
 *      FOURIER FREQUENCY DOMAIN: its statistic is built
 *      from the periodogram I(omega_j), an n-point
 *      DFT decomposition of x in the orthonormal
 *      complex-exponential basis. Axis-228 lives in the
 *      TIME-DOMAIN STATE SPACE: its statistic is the
 *      Frobenius distance between a test trajectory
 *      matrix and the SVD-extracted base subspace of an
 *      L-LAG HANKEL embedding. The DFT and the Hankel
 *      column space are linearly independent
 *      representations.
 *   2. WHAT IS DETECTED. Axis-229 fires on changes in
 *      SUB-BAND SPECTRAL ENERGY (a function of the
 *      spectral density restricted to the low-frequency
 *      band B). Axis-228 fires on changes in the L-LAG
 *      SUBSPACE (column span of the Hankel matrix).
 *      Spectrum and Hankel subspace are related (Karhunen
 *      / spectral theorem on the trajectory autocovariance)
 *      but not equal: a sub-band energy flip can occur
 *      with no Hankel rank change when the flip is between
 *      in-subspace modes; conversely an in-band
 *      frequency-phase reshuffle that preserves total
 *      band energy can change the Hankel subspace without
 *      moving the periodogram total in B.
 *   3. ALGORITHMIC FAMILY. Axis-229 combines an
 *      ORTHOGONAL DFT with a Picard standardised partial-
 *      sum CUSUM. Axis-228 uses an SVD/Jacobi
 *      eigendecomposition of an L x L Gram matrix and a
 *      Frobenius subspace-projection statistic. The DFT is
 *      shift-invariant in time; the SVD is rotation-
 *      invariant in column space — disjoint invariances.
 *
 * Joint behaviour is mechanistically informative:
 *
 *   - spectral-only (spectral m>=1, ssa m=0): the FOURIER
 *     CUSUM finds a sub-band energy break that the
 *     STATE-SPACE subspace projection does not see.
 *     Typical when the change is a periodicity / phase
 *     reshuffle inside the existing Hankel subspace
 *     (e.g. weekday-vs-weekend pattern flip with
 *     unchanged L-lag dynamics rank).
 *   - ssa-only (ssa m>=1, spectral m=0): the SSA
 *     subspace distance fires on a low-rank trajectory-
 *     basis rotation that leaves the sub-band integrated
 *     energy unchanged. Typical when a new lag-coupling
 *     mode appears whose mass spreads across the
 *     spectrum so no single sub-band crosses the CUSUM
 *     threshold.
 *   - agree-aligned (both m>=1 AND nearest-neighbour
 *     CP proximity within proximityGuard days): joint
 *     frequency-domain + state-space regime change at
 *     the same epoch. STRONGEST cross-paradigm evidence
 *     for a single underlying time-series event with
 *     simultaneous spectral and dynamical signature.
 *   - agree-misaligned (both m>=1 but every spectral tau
 *     is more than proximityGuard days from every ssa
 *     tau): two structurally distinct findings -- the
 *     spectrum shifts on different days than the L-lag
 *     subspace.
 *   - no-evidence: both report m=0 -- joint spectral
 *     and state-space stationarity.
 *
 * 5-bucket compound (mirrors prior axis-22X x axis-22X
 * compounds):
 *
 * ```
 * 'agree-aligned'    spectralDecisive AND ssaDecisive AND aligned
 * 'agree-misaligned' spectralDecisive AND ssaDecisive AND NOT aligned
 * 'spectral-only'    spectralDecisive AND NOT ssaDecisive
 * 'ssa-only'         ssaDecisive AND NOT spectralDecisive
 * 'no-evidence'      neither decisive
 * ```
 *
 * Decisiveness:
 *   - spectralDecisive := spectralM >= 1
 *   - ssaDecisive      := ssaM >= 1
 *
 * Aligned (when both decisive):
 *   - aligned := exists (i, j) with
 *               |spectralTauStar[i] - ssaTauStar[j]| <= proximityGuard
 *
 * Refs: Picard 1985 *Adv. Appl. Probab.* 17(4):841-867;
 * Aue, Hormann, Horvath & Reimherr 2009 *Ann. Statist.*
 * 37(6B):4046-4087; Moskvina & Zhigljavsky 2003 *Comm.
 * Statist. Simul. Comput.* 32(2):319-352.
 */

export interface PicardAueHorvathSpectralRowForSsaCompound {
  source: string;
  spectralM: number;
  spectralTauStar: number[];
  spectralCMax: number;
  spectralSigmaE: number;
  spectralCThreshold: number;
}

export interface MoskvinaZhigljavskySsaRowForSpectralCompound {
  source: string;
  ssaM: number;
  ssaTauStar: number[];
  ssaDMax: number;
  ssaDThreshold: number;
  ssaSubspaceRank: number;
}

export type Axis229Axis228SpectralSsaBucket =
  | 'agree-aligned'
  | 'agree-misaligned'
  | 'spectral-only'
  | 'ssa-only'
  | 'no-evidence';

export type Axis229Axis228SpectralSsaJointAlignment = 'aligned' | 'misaligned';

export interface Axis229Axis228SpectralSsaJoinedRow {
  source: string;
  spectralM: number;
  spectralTauStar: number[];
  spectralCMax: number;
  spectralSigmaE: number;
  spectralCThreshold: number;
  ssaM: number;
  ssaTauStar: number[];
  ssaDMax: number;
  ssaDThreshold: number;
  ssaSubspaceRank: number;
  spectralDecisive: boolean;
  ssaDecisive: boolean;
  /** Min over all (i, j) of |spectralTauStar[i] - ssaTauStar[j]|; MAX_SAFE_INTEGER if either is empty. */
  nearestPairDistance: number;
  /** True iff spectralM >= 2 OR ssaM >= 2. */
  multiRegimeEither: boolean;
  bucket: Axis229Axis228SpectralSsaBucket;
  jointAlignment: Axis229Axis228SpectralSsaJointAlignment | null;
}

export interface Axis229Axis228SpectralSsaReport {
  proximityGuard: number;
  rows: Axis229Axis228SpectralSsaJoinedRow[];
  bucketCounts: Record<Axis229Axis228SpectralSsaBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointAlignment: {
    aligned: number;
    misaligned: number;
    anyMissingDecisive: number;
  };
  bothDecisiveMultiRegime: number;
  bothDecisiveSingleRegime: number;
  sourcesOnlyInSpectral: string[];
  sourcesOnlyInSsa: string[];
}

export function classifyAxis229Axis228PicardAueHorvathSpectralCusumMoskvinaZhigljavskySsaSubspaceFrequencyDomainVsStateSpaceMultipleChangepointCompound(
  spectralRows: PicardAueHorvathSpectralRowForSsaCompound[],
  ssaRows: MoskvinaZhigljavskySsaRowForSpectralCompound[],
  proximityGuard = 5,
): Axis229Axis228SpectralSsaReport {
  const fnName =
    'classifyAxis229Axis228PicardAueHorvathSpectralCusumMoskvinaZhigljavskySsaSubspaceFrequencyDomainVsStateSpaceMultipleChangepointCompound';
  if (!Number.isInteger(proximityGuard) || proximityGuard < 0) {
    throw new Error(
      `${fnName}: proximityGuard must be a non-negative integer (got ${proximityGuard})`,
    );
  }
  if (!Array.isArray(spectralRows)) {
    throw new Error(`${fnName}: spectralRows must be an array`);
  }
  if (!Array.isArray(ssaRows)) {
    throw new Error(`${fnName}: ssaRows must be an array`);
  }

  const spectralBySrc = new Map<string, PicardAueHorvathSpectralRowForSsaCompound>();
  for (const r of spectralRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(`${fnName}: spectral row has invalid source: ${r.source}`);
    }
    if (
      !Number.isInteger(r.spectralM) ||
      r.spectralM < 0 ||
      !Array.isArray(r.spectralTauStar) ||
      r.spectralTauStar.length !== r.spectralM ||
      !Number.isFinite(r.spectralCMax) ||
      r.spectralCMax < 0 ||
      !Number.isFinite(r.spectralSigmaE) ||
      r.spectralSigmaE < 0 ||
      !Number.isFinite(r.spectralCThreshold) ||
      r.spectralCThreshold < 0
    ) {
      throw new Error(
        `${fnName}: spectral row '${r.source}' has invalid spectralM/tauStar/cMax/sigmaE/cThreshold`,
      );
    }
    for (let i = 0; i < r.spectralTauStar.length; i += 1) {
      if (
        !Number.isInteger(r.spectralTauStar[i]) ||
        (r.spectralTauStar[i] as number) < 1
      ) {
        throw new Error(
          `${fnName}: spectral row '${r.source}' tauStar[${i}] must be integer >= 1`,
        );
      }
      if (
        i > 0 &&
        (r.spectralTauStar[i] as number) <= (r.spectralTauStar[i - 1] as number)
      ) {
        throw new Error(
          `${fnName}: spectral row '${r.source}' tauStar must be strictly ascending`,
        );
      }
    }
    if (spectralBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate spectral source '${r.source}'`);
    }
    spectralBySrc.set(r.source, r);
  }

  const ssaBySrc = new Map<string, MoskvinaZhigljavskySsaRowForSpectralCompound>();
  for (const r of ssaRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(`${fnName}: ssa row has invalid source: ${r.source}`);
    }
    if (
      !Number.isInteger(r.ssaM) ||
      r.ssaM < 0 ||
      !Array.isArray(r.ssaTauStar) ||
      r.ssaTauStar.length !== r.ssaM ||
      !Number.isFinite(r.ssaDMax) ||
      r.ssaDMax < 0 ||
      r.ssaDMax > 1 ||
      !Number.isFinite(r.ssaDThreshold) ||
      r.ssaDThreshold < 0 ||
      r.ssaDThreshold > 1 ||
      !Number.isInteger(r.ssaSubspaceRank) ||
      r.ssaSubspaceRank < 1
    ) {
      throw new Error(
        `${fnName}: ssa row '${r.source}' has invalid ssaM/tauStar/dMax/dThreshold/subspaceRank`,
      );
    }
    for (let i = 0; i < r.ssaTauStar.length; i += 1) {
      if (!Number.isInteger(r.ssaTauStar[i]) || (r.ssaTauStar[i] as number) < 1) {
        throw new Error(
          `${fnName}: ssa row '${r.source}' tauStar[${i}] must be integer >= 1`,
        );
      }
      if (
        i > 0 &&
        (r.ssaTauStar[i] as number) <= (r.ssaTauStar[i - 1] as number)
      ) {
        throw new Error(
          `${fnName}: ssa row '${r.source}' tauStar must be strictly ascending`,
        );
      }
    }
    if (ssaBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate ssa source '${r.source}'`);
    }
    ssaBySrc.set(r.source, r);
  }

  const sourcesOnlyInSpectral: string[] = [];
  const sourcesOnlyInSsa: string[] = [];
  for (const s of spectralBySrc.keys()) {
    if (!ssaBySrc.has(s)) sourcesOnlyInSpectral.push(s);
  }
  for (const s of ssaBySrc.keys()) {
    if (!spectralBySrc.has(s)) sourcesOnlyInSsa.push(s);
  }
  sourcesOnlyInSpectral.sort();
  sourcesOnlyInSsa.sort();

  const joinedSources: string[] = [];
  for (const s of spectralBySrc.keys()) if (ssaBySrc.has(s)) joinedSources.push(s);
  joinedSources.sort();

  const rows: Axis229Axis228SpectralSsaJoinedRow[] = [];
  const bucketCounts: Record<Axis229Axis228SpectralSsaBucket, number> = {
    'agree-aligned': 0,
    'agree-misaligned': 0,
    'spectral-only': 0,
    'ssa-only': 0,
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
    const sp = spectralBySrc.get(src)!;
    const ss = ssaBySrc.get(src)!;
    const spectralDecisive = sp.spectralM >= 1;
    const ssaDecisive = ss.ssaM >= 1;

    let nearestPairDistance = Number.MAX_SAFE_INTEGER;
    if (sp.spectralTauStar.length > 0 && ss.ssaTauStar.length > 0) {
      let best = Number.MAX_SAFE_INTEGER;
      for (const x of sp.spectralTauStar) {
        for (const y of ss.ssaTauStar) {
          const d = Math.abs(x - y);
          if (d < best) best = d;
        }
      }
      nearestPairDistance = best;
    }
    const isAligned =
      spectralDecisive && ssaDecisive && nearestPairDistance <= proximityGuard;

    let bucket: Axis229Axis228SpectralSsaBucket;
    if (spectralDecisive && ssaDecisive) {
      bucket = isAligned ? 'agree-aligned' : 'agree-misaligned';
      bothDecisive += 1;
      if (isAligned) aligned += 1;
      else misaligned += 1;
      if (sp.spectralM >= 2 || ss.ssaM >= 2) bothDecisiveMultiRegime += 1;
      else bothDecisiveSingleRegime += 1;
    } else if (spectralDecisive) {
      bucket = 'spectral-only';
      anyMissingDecisive += 1;
    } else if (ssaDecisive) {
      bucket = 'ssa-only';
      anyMissingDecisive += 1;
    } else {
      bucket = 'no-evidence';
      anyMissingDecisive += 1;
    }
    if (spectralDecisive || ssaDecisive) atLeastOneDecisive += 1;

    bucketCounts[bucket] += 1;

    rows.push({
      source: src,
      spectralM: sp.spectralM,
      spectralTauStar: sp.spectralTauStar.slice(),
      spectralCMax: sp.spectralCMax,
      spectralSigmaE: sp.spectralSigmaE,
      spectralCThreshold: sp.spectralCThreshold,
      ssaM: ss.ssaM,
      ssaTauStar: ss.ssaTauStar.slice(),
      ssaDMax: ss.ssaDMax,
      ssaDThreshold: ss.ssaDThreshold,
      ssaSubspaceRank: ss.ssaSubspaceRank,
      spectralDecisive,
      ssaDecisive,
      nearestPairDistance,
      multiRegimeEither: sp.spectralM >= 2 || ss.ssaM >= 2,
      bucket,
      jointAlignment:
        spectralDecisive && ssaDecisive
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
    sourcesOnlyInSpectral,
    sourcesOnlyInSsa,
  };
}
