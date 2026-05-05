/**
 * classifyWaldWolfowitzCliffOmnibusVsDirectionCompound:
 * cross-axis joiner reconciling axis-194 WALD-WOLFOWITZ
 * TWO-SAMPLE RUNS TEST (wwR; wwZ; wwTwoSidedP;
 * wwSignedDirection) with axis-191 CLIFF'S DELTA bootstrap-
 * percentile-CI (cdDelta = P(B > A) - P(A > B);
 * cdCiExcludesZero) on a per-source join, producing
 * mutually-exclusive bivariate OMNIBUS-vs-DIRECTION
 * buckets.
 *
 * REFINEMENT OF axis-194 (v0.6.487): the per-source
 * Wald-Wolfowitz runs test answers "DO THE TWO HALVES
 * COME FROM THE SAME DISTRIBUTION (against ANY
 * alternative)?". This joiner answers the orthogonal
 * question "DOES THE OMNIBUS DISTRIBUTIONAL DIFFERENCE
 * COME WITH SIGNED STOCHASTIC DOMINANCE OR ONLY WITH
 * SCALE/SHAPE STRUCTURE?".
 *
 * STRUCTURAL ORTHOGONALITY. Cliff's delta is supported
 * on the FULL CROSS-PAIR INDICATOR
 *
 *   delta = ( #{(i,j): B_j > A_i} - #{(i,j): B_j < A_i} )
 *           / (n1 * n2)
 *
 * which is monotone in the rank sum and hence INTRINSICALLY
 * DIRECTIONAL. The Wald-Wolfowitz wwR is supported on the
 * LABEL-SEQUENCE ALTERNATION PATTERN of the pooled sort
 * and is INTRINSICALLY OMNIBUS (it has positive power
 * against location, scale, shape, multimodality
 * alternatives but cannot tell them apart). The two
 * functionals are MAXIMALLY DECOUPLED on:
 *
 *   - PURE SCALE/SHAPE ALTERNATIVES with equal medians:
 *     wwR rejects (labels cluster by half because one
 *     half's values disperse outward while the other's
 *     concentrate), Cliff CI may straddle zero (cross-
 *     pair counts cancel because half the pairs flip).
 *   - PURE LOCATION SHIFTS that are SMALL but UNIFORM:
 *     Cliff CI may exclude zero (every cross-pair leans
 *     one way by a small margin) while wwR is near E[R]
 *     (labels still well-mixed if the shift is small
 *     relative to within-half spread).
 *
 * They are TIGHTLY COUPLED on clean STRONG location
 * shifts where both should agree.
 *
 * Bucket map.
 *
 *   - `omnibus-and-direction-coherent`: both REJECT and
 *     direction agreement (sign(wwSignedDirection) ==
 *     sign(cdDelta)). The CLEANEST joint signal --
 *     omnibus distributional difference WITH directional
 *     stochastic dominance. Canonical strong-location-
 *     shift signature.
 *
 *   - `omnibus-only-no-direction`: wwR REJECTS but Cliff
 *     CI INCLUDES ZERO. The CANONICAL pure scale-or-
 *     shape signature: distributions differ but neither
 *     stochastically dominates. Hand off to scale-test
 *     axes (Brown-Forsythe, Siegel-Tukey, Ansari-
 *     Bradley, Conover-squared-ranks) for mechanism.
 *
 *   - `direction-only-no-omnibus`: Cliff CI EXCLUDES
 *     ZERO but wwR does NOT REJECT. Rare; signature of
 *     a UNIFORM SMALL LOCATION SHIFT where every cross-
 *     pair leans one way but the labels remain well-
 *     mixed in the pooled sort (the shift is small
 *     relative to within-half dispersion).
 *
 *   - `omnibus-and-direction-conflict`: both REJECT but
 *     directions DISAGREE (sign(wwSignedDirection) and
 *     sign(cdDelta) opposite). Watch-list: this can
 *     happen when median(B) > median(A) but the bulk of
 *     the cross-pair mass favours A (or vice versa) --
 *     a SKEW-DOMINATED ALTERNATIVE where the median and
 *     the cross-pair indicator disagree.
 *
 *   - `both-ns`: neither REJECTS. No detectable shift
 *     in either omnibus or direction.
 *
 * Headline counts.
 *
 *   - `omnibusAndDirectionCoherent`: clean strong-shift
 *     count.
 *   - `omnibusOnlyNoDirection`: pure scale/shape count
 *     (the signature Cliff cannot see).
 *   - `directionOnlyNoOmnibus`: small-uniform-shift
 *     count (the signature wwR cannot see).
 *   - `omnibusAndDirectionConflict`: skew-flip watch-
 *     list count.
 *
 * The Wald-Wolfowitz rejection threshold is |wwZ| >=
 * 1.96 (alpha = 0.05 two-sided, standard normal
 * approximation valid for n1, n2 >= 4). The Cliff
 * significance call is the user-supplied
 * cdCiExcludesZero (typically 95% bootstrap percentile
 * CI from axis-191).
 *
 * Cliff magnitude bins reused verbatim from axis-191
 * (Romano-Coraggio-Skowronski 2006 calibration):
 * 0.147 / 0.33 / 0.474 = small / medium / large.
 *
 * Refs: Wald & Wolfowitz 1940 *Annals of Mathematical
 * Statistics* 11(2):147-162; Granger 1963 *JRSS B*
 * 25(1):220-225; Cliff 1993 *Psychological Bulletin*
 * 114(3):494-509; Romano-Coraggio-Skowronski 2006
 * calibration bins.
 */

export type WaldWolfowitzCliffOmnibusVsDirectionBucket =
  | 'omnibus-and-direction-coherent'
  | 'omnibus-only-no-direction'
  | 'direction-only-no-omnibus'
  | 'omnibus-and-direction-conflict'
  | 'both-ns';

export type WaldWolfowitzCliffDirection =
  | 'first-larger'
  | 'second-larger'
  | 'balanced';

export interface WaldWolfowitzRowForCliffJoin {
  source: string;
  /** Run count R in [2, n]. */
  wwR: number;
  /** Continuity-corrected z; negative = clustering = signal. */
  wwZ: number;
  /** Two-sided p-value via standard normal. */
  wwTwoSidedP: number;
  /** Navigational sign(median(B) - median(A)) in {-1, 0, +1}. */
  wwSignedDirection: number;
}

export interface CliffRowForWaldWolfowitzJoin {
  source: string;
  /** Cliff's delta in [-1, +1]. Sign convention: + means second half stochastically larger. */
  cdDelta: number;
  /** Bootstrap percentile CI low endpoint. */
  cdCiLow: number;
  /** Bootstrap percentile CI high endpoint. */
  cdCiHigh: number;
  /** Whether the bootstrap CI excludes zero. */
  cdCiExcludesZero: boolean;
}

export interface ClassifiedWaldWolfowitzCliffRow {
  source: string;
  wwR: number;
  wwZ: number;
  wwAbsZ: number;
  wwTwoSidedP: number;
  wwSignedDirection: number;
  cdDelta: number;
  cdAbsDelta: number;
  cdCiLow: number;
  cdCiHigh: number;
  cdCiExcludesZero: boolean;
  cdMagnitude: 'negligible' | 'small' | 'medium' | 'large';
  /** Direction inferred from Cliff sign (preferred); falls back to ww median sign. */
  direction: WaldWolfowitzCliffDirection;
  bucket: WaldWolfowitzCliffOmnibusVsDirectionBucket;
}

export interface ClassifyWaldWolfowitzCliffOmnibusVsDirectionReport {
  rows: ClassifiedWaldWolfowitzCliffRow[];
  bucketCounts: Record<
    WaldWolfowitzCliffOmnibusVsDirectionBucket,
    number
  >;
  /** Headline: clean strong-shift count. */
  omnibusAndDirectionCoherent: number;
  /** Headline: pure scale/shape count (the signature Cliff cannot see). */
  omnibusOnlyNoDirection: number;
  /** Headline: small-uniform-shift count (the signature wwR cannot see). */
  directionOnlyNoOmnibus: number;
  /** Headline: skew-flip watch-list count. */
  omnibusAndDirectionConflict: number;
  /** Sources present in wwRows but missing from cdRows. */
  sourcesOnlyInWw: string[];
  /** Sources present in cdRows but missing from wwRows. */
  sourcesOnlyInCd: string[];
}

const WW_REJECT_ABS_Z = 1.959963984540054; // alpha = 0.05 two-sided.
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

export function classifyWaldWolfowitzCliffOmnibusVsDirectionCompound(
  wwRows: ReadonlyArray<WaldWolfowitzRowForCliffJoin>,
  cdRows: ReadonlyArray<CliffRowForWaldWolfowitzJoin>,
): ClassifyWaldWolfowitzCliffOmnibusVsDirectionReport {
  const seenW = new Set<string>();
  for (const r of wwRows) {
    if (seenW.has(r.source)) {
      throw new Error(
        `classifyWaldWolfowitzCliffOmnibusVsDirectionCompound: duplicate ww source '${r.source}'`,
      );
    }
    seenW.add(r.source);
    if (!Number.isFinite(r.wwR) || r.wwR < 1) {
      throw new Error(
        `classifyWaldWolfowitzCliffOmnibusVsDirectionCompound: wwR must be finite >= 1 for source '${r.source}' (got ${r.wwR})`,
      );
    }
    if (!Number.isFinite(r.wwZ)) {
      throw new Error(
        `classifyWaldWolfowitzCliffOmnibusVsDirectionCompound: wwZ must be finite for source '${r.source}' (got ${r.wwZ})`,
      );
    }
    if (
      !Number.isFinite(r.wwTwoSidedP) ||
      r.wwTwoSidedP < 0 ||
      r.wwTwoSidedP > 1
    ) {
      throw new Error(
        `classifyWaldWolfowitzCliffOmnibusVsDirectionCompound: wwTwoSidedP must be finite in [0, 1] for source '${r.source}' (got ${r.wwTwoSidedP})`,
      );
    }
    if (
      !Number.isFinite(r.wwSignedDirection) ||
      (r.wwSignedDirection !== -1 &&
        r.wwSignedDirection !== 0 &&
        r.wwSignedDirection !== 1)
    ) {
      throw new Error(
        `classifyWaldWolfowitzCliffOmnibusVsDirectionCompound: wwSignedDirection must be in {-1, 0, +1} for source '${r.source}' (got ${r.wwSignedDirection})`,
      );
    }
  }
  const seenC = new Set<string>();
  for (const r of cdRows) {
    if (seenC.has(r.source)) {
      throw new Error(
        `classifyWaldWolfowitzCliffOmnibusVsDirectionCompound: duplicate cliff source '${r.source}'`,
      );
    }
    seenC.add(r.source);
    if (!Number.isFinite(r.cdDelta) || r.cdDelta < -1 || r.cdDelta > 1) {
      throw new Error(
        `classifyWaldWolfowitzCliffOmnibusVsDirectionCompound: cdDelta must be finite in [-1, 1] for source '${r.source}' (got ${r.cdDelta})`,
      );
    }
    if (!Number.isFinite(r.cdCiLow) || r.cdCiLow < -1 || r.cdCiLow > 1) {
      throw new Error(
        `classifyWaldWolfowitzCliffOmnibusVsDirectionCompound: cdCiLow must be finite in [-1, 1] for source '${r.source}' (got ${r.cdCiLow})`,
      );
    }
    if (!Number.isFinite(r.cdCiHigh) || r.cdCiHigh < -1 || r.cdCiHigh > 1) {
      throw new Error(
        `classifyWaldWolfowitzCliffOmnibusVsDirectionCompound: cdCiHigh must be finite in [-1, 1] for source '${r.source}' (got ${r.cdCiHigh})`,
      );
    }
    if (r.cdCiLow > r.cdCiHigh) {
      throw new Error(
        `classifyWaldWolfowitzCliffOmnibusVsDirectionCompound: cdCiLow (${r.cdCiLow}) > cdCiHigh (${r.cdCiHigh}) for source '${r.source}'`,
      );
    }
  }

  const wwByName = new Map<string, WaldWolfowitzRowForCliffJoin>();
  for (const r of wwRows) wwByName.set(r.source, r);
  const cdByName = new Map<string, CliffRowForWaldWolfowitzJoin>();
  for (const r of cdRows) cdByName.set(r.source, r);

  const sourcesOnlyInWw: string[] = [];
  const sourcesOnlyInCd: string[] = [];
  for (const r of wwRows) {
    if (!cdByName.has(r.source)) sourcesOnlyInWw.push(r.source);
  }
  for (const r of cdRows) {
    if (!wwByName.has(r.source)) sourcesOnlyInCd.push(r.source);
  }
  sourcesOnlyInWw.sort();
  sourcesOnlyInCd.sort();

  const rows: ClassifiedWaldWolfowitzCliffRow[] = [];
  const bucketCounts: Record<
    WaldWolfowitzCliffOmnibusVsDirectionBucket,
    number
  > = {
    'omnibus-and-direction-coherent': 0,
    'omnibus-only-no-direction': 0,
    'direction-only-no-omnibus': 0,
    'omnibus-and-direction-conflict': 0,
    'both-ns': 0,
  };
  let omnibusAndDirectionCoherent = 0;
  let omnibusOnlyNoDirection = 0;
  let directionOnlyNoOmnibus = 0;
  let omnibusAndDirectionConflict = 0;

  for (const w of wwRows) {
    const c = cdByName.get(w.source);
    if (!c) continue;

    const wwReject = Math.abs(w.wwZ) >= WW_REJECT_ABS_Z;
    const wwSign =
      w.wwSignedDirection > 0 ? +1 : w.wwSignedDirection < 0 ? -1 : 0;
    const cdSign = c.cdDelta > 0 ? +1 : c.cdDelta < 0 ? -1 : 0;
    const cdAbsDelta = Math.abs(c.cdDelta);
    const cdMag = magnitudeOf(cdAbsDelta);

    let bucket: WaldWolfowitzCliffOmnibusVsDirectionBucket;
    let direction: WaldWolfowitzCliffDirection;

    if (wwReject && c.cdCiExcludesZero) {
      // Both reject -- check direction agreement.
      if (wwSign !== 0 && cdSign !== 0 && wwSign !== cdSign) {
        bucket = 'omnibus-and-direction-conflict';
        // Defer to Cliff for direction (rank-sum based,
        // more robust than median sign).
        direction = cdSign > 0 ? 'second-larger' : 'first-larger';
      } else {
        bucket = 'omnibus-and-direction-coherent';
        const sign = cdSign !== 0 ? cdSign : wwSign;
        direction =
          sign > 0 ? 'second-larger' : sign < 0 ? 'first-larger' : 'balanced';
      }
    } else if (wwReject && !c.cdCiExcludesZero) {
      bucket = 'omnibus-only-no-direction';
      // Direction inconclusive but report median-sign hint.
      direction =
        wwSign > 0 ? 'second-larger' : wwSign < 0 ? 'first-larger' : 'balanced';
    } else if (!wwReject && c.cdCiExcludesZero) {
      bucket = 'direction-only-no-omnibus';
      direction = cdSign > 0 ? 'second-larger' : 'first-larger';
    } else {
      bucket = 'both-ns';
      direction =
        cdSign > 0 ? 'second-larger' : cdSign < 0 ? 'first-larger' : 'balanced';
    }

    bucketCounts[bucket] += 1;
    if (bucket === 'omnibus-and-direction-coherent')
      omnibusAndDirectionCoherent += 1;
    if (bucket === 'omnibus-only-no-direction') omnibusOnlyNoDirection += 1;
    if (bucket === 'direction-only-no-omnibus') directionOnlyNoOmnibus += 1;
    if (bucket === 'omnibus-and-direction-conflict')
      omnibusAndDirectionConflict += 1;

    rows.push({
      source: w.source,
      wwR: w.wwR,
      wwZ: w.wwZ,
      wwAbsZ: Math.abs(w.wwZ),
      wwTwoSidedP: w.wwTwoSidedP,
      wwSignedDirection: w.wwSignedDirection,
      cdDelta: c.cdDelta,
      cdAbsDelta,
      cdCiLow: c.cdCiLow,
      cdCiHigh: c.cdCiHigh,
      cdCiExcludesZero: c.cdCiExcludesZero,
      cdMagnitude: cdMag,
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
    omnibusAndDirectionCoherent,
    omnibusOnlyNoDirection,
    directionOnlyNoOmnibus,
    omnibusAndDirectionConflict,
    sourcesOnlyInWw,
    sourcesOnlyInCd,
  };
}
