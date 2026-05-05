/**
 * classifyFlignerKilleenCliffScaleVsDominanceCompound:
 * cross-axis joiner reconciling axis-196 FLIGNER-KILLEEN
 * MEDIAN-CENTERED SCALE TEST (fkX2; fkZ; fkPValue) with
 * axis-191 CLIFF'S DELTA bootstrap-percentile-CI
 * (cdDelta = P(B > A) - P(A > B); cdCiExcludesZero) on a
 * per-source join, producing mutually-exclusive bivariate
 * SCALE-vs-DOMINANCE buckets.
 *
 * REFINEMENT OF axis-196 (v0.6.491 -> v0.6.492): the
 * per-source Fligner-Killeen test answers "ARE THE TWO
 * HALVES EQUALLY DISPERSED (around their respective
 * medians)?". This joiner answers the orthogonal question
 * "DOES THE DISPERSION DIFFERENCE COME WITH SIGNED
 * STOCHASTIC DOMINANCE OR IS IT A PURE SCALE
 * REORGANISATION ABOUT EQUAL MEDIANS?".
 *
 * STRUCTURAL ORTHOGONALITY. Cliff's delta is a functional
 * of the FULL CROSS-PAIR INDICATOR
 *
 *   delta = ( #{(i,j): B_j > A_i} - #{(i,j): B_j < A_i} )
 *           / (n1 * n2)
 *
 * which is monotone in the rank sum and hence
 * INTRINSICALLY DIRECTIONAL. The Fligner-Killeen fkZ
 * is supported on the WITHIN-HALF-MEDIAN-CENTRED
 * |z|-rank distribution and is INTRINSICALLY a
 * dispersion functional ABOUT EACH HALF'S OWN MEDIAN --
 * by construction it CANCELS any uniform location shift
 * between the two halves before computing the statistic.
 * The two functionals are MAXIMALLY DECOUPLED on:
 *
 *   - PURE SCALE ALTERNATIVES with equal medians: FK
 *     rejects strongly (one half has wider |z|), Cliff CI
 *     straddles zero (cross-pair counts cancel because
 *     the wider half's mass is symmetric around the
 *     common median).
 *   - PURE LOCATION SHIFTS that preserve dispersion: Cliff
 *     CI excludes zero (every cross-pair leans one way),
 *     FK fkZ ~ 0 (within-half median-centring removes
 *     the shift before |z|-ranking).
 *
 * They CO-FIRE on alternatives where one half is BOTH
 * shifted AND more dispersed (the canonical "ramp-up"
 * signature of an established source whose later usage is
 * both larger AND noisier).
 *
 * Bucket map.
 *
 *   - `scale-and-dominance-coherent`: FK REJECTS and
 *     Cliff CI EXCLUDES ZERO and direction agreement
 *     (sign(fkZ) == sign(cdDelta)). Canonical "growth-
 *     plus-volatility" signature: the second half is
 *     BOTH larger AND more dispersed (or BOTH smaller
 *     AND tighter).
 *
 *   - `scale-only-no-dominance`: FK REJECTS but Cliff
 *     CI INCLUDES ZERO. The CANONICAL pure scale-
 *     reorganisation signature: dispersions differ
 *     about a stable median; e.g. a source whose late-
 *     period usage spreads symmetrically around its
 *     historic median.
 *
 *   - `dominance-only-no-scale`: Cliff CI EXCLUDES
 *     ZERO but FK does NOT REJECT. Canonical pure
 *     LOCATION SHIFT signature: every cross-pair leans
 *     one way but the two halves' median-centred |z|
 *     distributions are indistinguishable. Hand off to
 *     axis-176 Brunner-Munzel / axis-189 Hodges-Lehmann
 *     for the magnitude of the shift.
 *
 *   - `scale-and-dominance-conflict`: both REJECT but
 *     directions DISAGREE. Watch-list: the second half
 *     is more dispersed YET stochastically smaller
 *     (or vice versa). Signature of a heavy-LOWER-tail
 *     dispersion increase paired with an upper-tail
 *     truncation -- or the inverse. Rare; flags
 *     candidates for axis-185 Hampel outlier review and
 *     axis-181 medcouple-skewness inspection.
 *
 *   - `both-ns`: neither REJECTS. No detectable shift
 *     in either dispersion or stochastic dominance.
 *
 * Headline counts:
 *
 *   - `scaleAndDominanceCoherent`: clean ramp-up signal.
 *   - `scaleOnlyNoDominance`: pure scale reorganisation.
 *   - `dominanceOnlyNoScale`: pure location shift.
 *   - `scaleAndDominanceConflict`: tail-asymmetry watch-list.
 *
 * The Fligner-Killeen rejection threshold is |fkZ| >=
 * 1.96 (alpha = 0.05 two-sided, fkX2 >= 3.84 against the
 * chi^2(1) reference). The Cliff significance call is
 * the user-supplied cdCiExcludesZero (typically 95%
 * bootstrap percentile CI from axis-191).
 *
 * Cliff magnitude bins reused verbatim from axis-191
 * (Romano-Coraggio-Skowronski 2006 calibration):
 * 0.147 / 0.33 / 0.474 = small / medium / large.
 *
 * Refs: Fligner & Killeen 1976 *J. Amer. Statist. Assoc.*
 * 71:210-213; Conover, Johnson & Johnson 1981
 * *Technometrics* 23(4):351-361 Tab. 5; Cliff 1993
 * *Psychological Bulletin* 114(3):494-509;
 * Romano-Coraggio-Skowronski 2006 calibration bins.
 */

export type FlignerKilleenCliffScaleVsDominanceBucket =
  | 'scale-and-dominance-coherent'
  | 'scale-only-no-dominance'
  | 'dominance-only-no-scale'
  | 'scale-and-dominance-conflict'
  | 'both-ns';

export type FlignerKilleenCliffDirection =
  | 'first-larger'
  | 'second-larger'
  | 'balanced';

export interface FlignerKilleenRowForCliffJoin {
  source: string;
  /** Chi^2(1) statistic. */
  fkX2: number;
  /** Signed sqrt(fkX2); positive = SECOND half more dispersed. */
  fkZ: number;
  /** Two-sided p-value via standard normal / chi^2(1). */
  fkPValue: number;
}

export interface CliffRowForFlignerKilleenJoin {
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

export interface ClassifiedFlignerKilleenCliffRow {
  source: string;
  fkX2: number;
  fkZ: number;
  fkAbsZ: number;
  fkPValue: number;
  cdDelta: number;
  cdAbsDelta: number;
  cdCiLow: number;
  cdCiHigh: number;
  cdCiExcludesZero: boolean;
  cdMagnitude: 'negligible' | 'small' | 'medium' | 'large';
  /** Direction inferred from Cliff sign (preferred); falls back to FK fkZ sign. */
  direction: FlignerKilleenCliffDirection;
  bucket: FlignerKilleenCliffScaleVsDominanceBucket;
}

export interface ClassifyFlignerKilleenCliffScaleVsDominanceReport {
  rows: ClassifiedFlignerKilleenCliffRow[];
  bucketCounts: Record<
    FlignerKilleenCliffScaleVsDominanceBucket,
    number
  >;
  /** Headline: clean ramp-up signal count. */
  scaleAndDominanceCoherent: number;
  /** Headline: pure scale reorganisation count (signature Cliff cannot see). */
  scaleOnlyNoDominance: number;
  /** Headline: pure location-shift count (signature FK cannot see by construction). */
  dominanceOnlyNoScale: number;
  /** Headline: tail-asymmetry watch-list count. */
  scaleAndDominanceConflict: number;
  /** Sources present in fkRows but missing from cdRows. */
  sourcesOnlyInFk: string[];
  /** Sources present in cdRows but missing from fkRows. */
  sourcesOnlyInCd: string[];
}

const FK_REJECT_ABS_Z = 1.959963984540054; // alpha = 0.05 two-sided.
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

export function classifyFlignerKilleenCliffScaleVsDominanceCompound(
  fkRows: ReadonlyArray<FlignerKilleenRowForCliffJoin>,
  cdRows: ReadonlyArray<CliffRowForFlignerKilleenJoin>,
): ClassifyFlignerKilleenCliffScaleVsDominanceReport {
  const seenF = new Set<string>();
  for (const r of fkRows) {
    if (seenF.has(r.source)) {
      throw new Error(
        `classifyFlignerKilleenCliffScaleVsDominanceCompound: duplicate fk source '${r.source}'`,
      );
    }
    seenF.add(r.source);
    if (!Number.isFinite(r.fkX2) || r.fkX2 < 0) {
      throw new Error(
        `classifyFlignerKilleenCliffScaleVsDominanceCompound: fkX2 must be finite >= 0 for source '${r.source}' (got ${r.fkX2})`,
      );
    }
    if (!Number.isFinite(r.fkZ)) {
      throw new Error(
        `classifyFlignerKilleenCliffScaleVsDominanceCompound: fkZ must be finite for source '${r.source}' (got ${r.fkZ})`,
      );
    }
    if (
      !Number.isFinite(r.fkPValue) ||
      r.fkPValue < 0 ||
      r.fkPValue > 1
    ) {
      throw new Error(
        `classifyFlignerKilleenCliffScaleVsDominanceCompound: fkPValue must be finite in [0, 1] for source '${r.source}' (got ${r.fkPValue})`,
      );
    }
  }
  const seenC = new Set<string>();
  for (const r of cdRows) {
    if (seenC.has(r.source)) {
      throw new Error(
        `classifyFlignerKilleenCliffScaleVsDominanceCompound: duplicate cliff source '${r.source}'`,
      );
    }
    seenC.add(r.source);
    if (!Number.isFinite(r.cdDelta) || r.cdDelta < -1 || r.cdDelta > 1) {
      throw new Error(
        `classifyFlignerKilleenCliffScaleVsDominanceCompound: cdDelta must be finite in [-1, 1] for source '${r.source}' (got ${r.cdDelta})`,
      );
    }
    if (!Number.isFinite(r.cdCiLow) || r.cdCiLow < -1 || r.cdCiLow > 1) {
      throw new Error(
        `classifyFlignerKilleenCliffScaleVsDominanceCompound: cdCiLow must be finite in [-1, 1] for source '${r.source}' (got ${r.cdCiLow})`,
      );
    }
    if (!Number.isFinite(r.cdCiHigh) || r.cdCiHigh < -1 || r.cdCiHigh > 1) {
      throw new Error(
        `classifyFlignerKilleenCliffScaleVsDominanceCompound: cdCiHigh must be finite in [-1, 1] for source '${r.source}' (got ${r.cdCiHigh})`,
      );
    }
    if (r.cdCiLow > r.cdCiHigh) {
      throw new Error(
        `classifyFlignerKilleenCliffScaleVsDominanceCompound: cdCiLow (${r.cdCiLow}) > cdCiHigh (${r.cdCiHigh}) for source '${r.source}'`,
      );
    }
  }

  const fkByName = new Map<string, FlignerKilleenRowForCliffJoin>();
  for (const r of fkRows) fkByName.set(r.source, r);
  const cdByName = new Map<string, CliffRowForFlignerKilleenJoin>();
  for (const r of cdRows) cdByName.set(r.source, r);

  const sourcesOnlyInFk: string[] = [];
  const sourcesOnlyInCd: string[] = [];
  for (const r of fkRows) {
    if (!cdByName.has(r.source)) sourcesOnlyInFk.push(r.source);
  }
  for (const r of cdRows) {
    if (!fkByName.has(r.source)) sourcesOnlyInCd.push(r.source);
  }
  sourcesOnlyInFk.sort();
  sourcesOnlyInCd.sort();

  const rows: ClassifiedFlignerKilleenCliffRow[] = [];
  const bucketCounts: Record<
    FlignerKilleenCliffScaleVsDominanceBucket,
    number
  > = {
    'scale-and-dominance-coherent': 0,
    'scale-only-no-dominance': 0,
    'dominance-only-no-scale': 0,
    'scale-and-dominance-conflict': 0,
    'both-ns': 0,
  };
  let scaleAndDominanceCoherent = 0;
  let scaleOnlyNoDominance = 0;
  let dominanceOnlyNoScale = 0;
  let scaleAndDominanceConflict = 0;

  for (const f of fkRows) {
    const c = cdByName.get(f.source);
    if (!c) continue;

    const fkReject = Math.abs(f.fkZ) >= FK_REJECT_ABS_Z;
    const fkSign = f.fkZ > 0 ? +1 : f.fkZ < 0 ? -1 : 0;
    const cdSign = c.cdDelta > 0 ? +1 : c.cdDelta < 0 ? -1 : 0;
    const cdAbsDelta = Math.abs(c.cdDelta);
    const cdMag = magnitudeOf(cdAbsDelta);

    let bucket: FlignerKilleenCliffScaleVsDominanceBucket;
    let direction: FlignerKilleenCliffDirection;

    if (fkReject && c.cdCiExcludesZero) {
      // Both reject -- check direction agreement.
      if (fkSign !== 0 && cdSign !== 0 && fkSign !== cdSign) {
        bucket = 'scale-and-dominance-conflict';
        // Defer to Cliff for direction (cross-pair-based,
        // more interpretable than fk's dispersion-direction).
        direction = cdSign > 0 ? 'second-larger' : 'first-larger';
      } else {
        bucket = 'scale-and-dominance-coherent';
        const sign = cdSign !== 0 ? cdSign : fkSign;
        direction =
          sign > 0 ? 'second-larger' : sign < 0 ? 'first-larger' : 'balanced';
      }
    } else if (fkReject && !c.cdCiExcludesZero) {
      bucket = 'scale-only-no-dominance';
      // Direction inconclusive but report fk-sign hint.
      direction =
        fkSign > 0 ? 'second-larger' : fkSign < 0 ? 'first-larger' : 'balanced';
    } else if (!fkReject && c.cdCiExcludesZero) {
      bucket = 'dominance-only-no-scale';
      direction = cdSign > 0 ? 'second-larger' : 'first-larger';
    } else {
      bucket = 'both-ns';
      direction =
        cdSign > 0 ? 'second-larger' : cdSign < 0 ? 'first-larger' : 'balanced';
    }

    bucketCounts[bucket] += 1;
    if (bucket === 'scale-and-dominance-coherent')
      scaleAndDominanceCoherent += 1;
    if (bucket === 'scale-only-no-dominance') scaleOnlyNoDominance += 1;
    if (bucket === 'dominance-only-no-scale') dominanceOnlyNoScale += 1;
    if (bucket === 'scale-and-dominance-conflict')
      scaleAndDominanceConflict += 1;

    rows.push({
      source: f.source,
      fkX2: f.fkX2,
      fkZ: f.fkZ,
      fkAbsZ: Math.abs(f.fkZ),
      fkPValue: f.fkPValue,
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
    scaleAndDominanceCoherent,
    scaleOnlyNoDominance,
    dominanceOnlyNoScale,
    scaleAndDominanceConflict,
    sourcesOnlyInFk,
    sourcesOnlyInCd,
  };
}
