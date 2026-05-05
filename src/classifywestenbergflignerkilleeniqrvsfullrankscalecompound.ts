/**
 * classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound:
 * cross-axis joiner reconciling axis-198 WESTENBERG IQR-
 * EXCEEDANCE SCALE TEST (`westZ`; `westPValue`; based on
 * the COUNT of B observations falling outside A's IQR)
 * with axis-196 FLIGNER-KILLEEN MEDIAN-CENTERED SCALE
 * TEST (`fkZ`; `fkPValue`; based on HALF-NORMAL SCORES
 * applied to POOLED MID-RANKS of within-half median-
 * centred ABSOLUTE DEVIATIONS) on a per-source join,
 * producing five mutually-exclusive bivariate buckets
 * that decompose the dispersion-shift signal into a
 * MID-TAIL / IQR-MEMBERSHIP channel and a CONTINUOUS-
 * RANK-SCORE channel.
 *
 * REFINEMENT OF axis-198 (v0.6.495 -> v0.6.496). The
 * per-source Westenberg test answers "DO B's CROSS A's
 * QUARTILE BOUNDARIES MORE OFTEN THAN p = 0.5?". This
 * joiner answers the orthogonal question "DOES THE
 * DISPERSION DIFFERENCE SHOW UP ONLY AS TAIL-MASS
 * EXCHANGE ACROSS THE 25TH/75TH PERCENTILES, OR DOES
 * IT ALSO SHOW UP AS A SHIFT IN THE FULL |z|-RANK
 * DISTRIBUTION?".
 *
 * STRUCTURAL ORTHOGONALITY. Although BOTH axes test for
 * EQUALITY OF DISPERSION between two halves, they aggregate
 * the dispersion signal through MAXIMALLY DIFFERENT
 * functionals, and there are concrete configurations on
 * which they DISAGREE BY CONSTRUCTION:
 *
 *   1. **Information bandwidth differs**. Westenberg is a
 *      ONE-BIT-PER-OBSERVATION test on B (each B value is
 *      either INSIDE A's IQR or OUTSIDE -- two states).
 *      Fligner-Killeen is a CONTINUOUS-SCORE test (each
 *      observation contributes a real-valued half-normal
 *      score `Phi^{-1}(0.5 + R/(2(n+1)))` in `[0, +inf)`).
 *      FK extracts more dispersion information per
 *      observation when it exists; Westenberg extracts the
 *      same one bit regardless. They MUST disagree on
 *      power for sufficiently subtle dispersion shifts.
 *
 *   2. **Boundary location differs**. Westenberg's
 *      boundaries are the 25th and 75th percentiles of A
 *      ONLY. FK's effective "boundary" is the MEDIAN OF
 *      EACH HALF (used as the centring point for |z|).
 *      A dispersion change that REDISTRIBUTES MASS within
 *      A's IQR but symmetrically about each half's median
 *      will fire FK (the |z|-rank distribution shifts) but
 *      leave Westenberg unchanged (B's inside/outside
 *      status is invariant). Conversely, a dispersion
 *      change that PUSHES MASS ACROSS A's IQR boundaries
 *      while preserving the |z|-rank order within each
 *      tail will fire Westenberg but leave FK weak (the
 *      |z|-ranks are PERMUTED but their score-sum is
 *      unchanged at leading order).
 *
 *   3. **Median-centring scope differs**. FK centres each
 *      half by ITS OWN MEDIAN before computing |z|.
 *      Westenberg centres only by A's quartiles. A pure
 *      LOCATION SHIFT of B (with preserved dispersion)
 *      will fire Westenberg (B's inside/outside status of
 *      A's IQR changes) but leave FK exactly null (within-
 *      half median-centring removes the shift). This
 *      manifests as `westZ` rejecting while `fkZ ~ 0` on
 *      the canonical pure-shift signature -- a CLEAN
 *      LOCATION-CONFOUNDING DIAGNOSTIC for axis-198.
 *
 * Bucket map.
 *
 *   - `iqr-and-rank-coherent`: BOTH REJECT and direction
 *     agreement (`sign(westZ) == sign(fkZ)`). Canonical
 *     "broad dispersion shift" signature: the second
 *     half is more (or less) dispersed by BOTH the
 *     IQR-membership criterion AND the full-rank-score
 *     criterion. Strongest possible scale signal.
 *
 *   - `iqr-only-no-rank`: WESTENBERG REJECTS but FK does
 *     NOT REJECT. Two mechanistic interpretations: (a)
 *     pure LOCATION SHIFT of B (FK is shift-invariant by
 *     within-half median-centring; Westenberg is NOT) --
 *     hand off to axis-115 Mann-Whitney / axis-191 Cliff
 *     to confirm location; or (b) a tail-mass exchange
 *     across A's quartile boundaries that preserves the
 *     full |z|-rank distribution.
 *
 *   - `rank-only-no-iqr`: FK REJECTS but Westenberg does
 *     NOT REJECT. Canonical signature: the dispersion
 *     change REDISTRIBUTES MASS WITHIN A's IQR (e.g.
 *     B becomes more concentrated AROUND the median while
 *     preserving the inside/outside count). Westenberg
 *     is BLIND to this geometry; FK sees it via |z|-rank.
 *
 *   - `iqr-and-rank-conflict`: both REJECT but directions
 *     DISAGREE. Watch-list: Westenberg says one half is
 *     more dispersed (by tail-membership), FK says the
 *     other (by full-rank-score). Mechanically requires
 *     ASYMMETRIC dispersion change in the tails vs the
 *     shoulders. Rare; flags candidates for axis-181
 *     medcouple-skewness inspection.
 *
 *   - `both-ns`: neither REJECTS. No detectable
 *     dispersion shift on either functional.
 *
 * Headline counts:
 *
 *   - `iqrAndRankCoherent`: clean broad-dispersion signal.
 *   - `iqrOnlyNoRank`: tail-membership-only OR pure-shift
 *     candidate (axis-198's location-confound diagnostic).
 *   - `rankOnlyNoIqr`: within-IQR mass-redistribution
 *     signal that axis-198 cannot see.
 *   - `iqrAndRankConflict`: tail-vs-shoulder asymmetry
 *     watch-list.
 *
 * The Westenberg rejection threshold is `|westZ| >= 1.96`
 * (alpha = 0.05 two-sided, normal-approx Binomial(n2, 0.5)
 * tail). The FK rejection threshold is `|fkZ| >= 1.96`
 * (alpha = 0.05 two-sided, chi^2(1) `fkX2 >= 3.84`).
 *
 * Refs: Westenberg 1948 *Proc. Kon. Nederl. Akad.
 * Wetensch.* 51:252-261; Conover 1999 *Practical
 * Nonparametric Statistics* 3rd ed., sec. 5.3 pp.
 * 309-310; Fligner & Killeen 1976 *J. Amer. Statist.
 * Assoc.* 71:210-213; Conover, Johnson & Johnson 1981
 * *Technometrics* 23(4):351-361 Tab. 5.
 */

export type WestenbergFlignerKilleenIqrVsFullRankScaleBucket =
  | 'iqr-and-rank-coherent'
  | 'iqr-only-no-rank'
  | 'rank-only-no-iqr'
  | 'iqr-and-rank-conflict'
  | 'both-ns';

export type WestenbergFlignerKilleenDirection =
  | 'first-larger'
  | 'second-larger'
  | 'balanced';

export interface WestenbergRowForFlignerKilleenJoin {
  source: string;
  /** Standardized z; positive = SECOND half MORE dispersed (more B's outside A's IQR). */
  westZ: number;
  /** Two-sided normal p-value. */
  westPValue: number;
}

export interface FlignerKilleenRowForWestenbergJoin {
  source: string;
  /** Chi^2(1) statistic. */
  fkX2: number;
  /** Signed sqrt(fkX2); positive = SECOND half more dispersed. */
  fkZ: number;
  /** Two-sided p-value via standard normal / chi^2(1). */
  fkPValue: number;
}

export interface ClassifiedWestenbergFlignerKilleenRow {
  source: string;
  westZ: number;
  westAbsZ: number;
  westPValue: number;
  fkX2: number;
  fkZ: number;
  fkAbsZ: number;
  fkPValue: number;
  /** Direction inferred from agreement of westZ and fkZ signs (or one alone if the other is zero). */
  direction: WestenbergFlignerKilleenDirection;
  bucket: WestenbergFlignerKilleenIqrVsFullRankScaleBucket;
}

export interface ClassifyWestenbergFlignerKilleenIqrVsFullRankScaleReport {
  rows: ClassifiedWestenbergFlignerKilleenRow[];
  bucketCounts: Record<
    WestenbergFlignerKilleenIqrVsFullRankScaleBucket,
    number
  >;
  /** Headline: clean broad-dispersion signal count. */
  iqrAndRankCoherent: number;
  /** Headline: IQR-only-OR-pure-shift candidate count (axis-198 location-confound diagnostic). */
  iqrOnlyNoRank: number;
  /** Headline: within-IQR mass-redistribution signal count (signature axis-198 cannot see). */
  rankOnlyNoIqr: number;
  /** Headline: tail-vs-shoulder asymmetry watch-list count. */
  iqrAndRankConflict: number;
  /** Sources present in westRows but missing from fkRows. */
  sourcesOnlyInWest: string[];
  /** Sources present in fkRows but missing from westRows. */
  sourcesOnlyInFk: string[];
}

const REJECT_ABS_Z = 1.959963984540054; // alpha = 0.05 two-sided.

export function classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound(
  westRows: ReadonlyArray<WestenbergRowForFlignerKilleenJoin>,
  fkRows: ReadonlyArray<FlignerKilleenRowForWestenbergJoin>,
): ClassifyWestenbergFlignerKilleenIqrVsFullRankScaleReport {
  const seenW = new Set<string>();
  for (const r of westRows) {
    if (seenW.has(r.source)) {
      throw new Error(
        `classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound: duplicate westenberg source '${r.source}'`,
      );
    }
    seenW.add(r.source);
    if (!Number.isFinite(r.westZ)) {
      throw new Error(
        `classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound: westZ must be finite for source '${r.source}' (got ${r.westZ})`,
      );
    }
    if (
      !Number.isFinite(r.westPValue) ||
      r.westPValue < 0 ||
      r.westPValue > 1
    ) {
      throw new Error(
        `classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound: westPValue must be finite in [0, 1] for source '${r.source}' (got ${r.westPValue})`,
      );
    }
  }
  const seenF = new Set<string>();
  for (const r of fkRows) {
    if (seenF.has(r.source)) {
      throw new Error(
        `classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound: duplicate fligner-killeen source '${r.source}'`,
      );
    }
    seenF.add(r.source);
    if (!Number.isFinite(r.fkX2) || r.fkX2 < 0) {
      throw new Error(
        `classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound: fkX2 must be finite >= 0 for source '${r.source}' (got ${r.fkX2})`,
      );
    }
    if (!Number.isFinite(r.fkZ)) {
      throw new Error(
        `classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound: fkZ must be finite for source '${r.source}' (got ${r.fkZ})`,
      );
    }
    if (
      !Number.isFinite(r.fkPValue) ||
      r.fkPValue < 0 ||
      r.fkPValue > 1
    ) {
      throw new Error(
        `classifyWestenbergFlignerKilleenIqrVsFullRankScaleCompound: fkPValue must be finite in [0, 1] for source '${r.source}' (got ${r.fkPValue})`,
      );
    }
  }

  const westByName = new Map<string, WestenbergRowForFlignerKilleenJoin>();
  for (const r of westRows) westByName.set(r.source, r);
  const fkByName = new Map<string, FlignerKilleenRowForWestenbergJoin>();
  for (const r of fkRows) fkByName.set(r.source, r);

  const sourcesOnlyInWest: string[] = [];
  const sourcesOnlyInFk: string[] = [];
  for (const r of westRows) {
    if (!fkByName.has(r.source)) sourcesOnlyInWest.push(r.source);
  }
  for (const r of fkRows) {
    if (!westByName.has(r.source)) sourcesOnlyInFk.push(r.source);
  }
  sourcesOnlyInWest.sort();
  sourcesOnlyInFk.sort();

  const rows: ClassifiedWestenbergFlignerKilleenRow[] = [];
  const bucketCounts: Record<
    WestenbergFlignerKilleenIqrVsFullRankScaleBucket,
    number
  > = {
    'iqr-and-rank-coherent': 0,
    'iqr-only-no-rank': 0,
    'rank-only-no-iqr': 0,
    'iqr-and-rank-conflict': 0,
    'both-ns': 0,
  };
  let iqrAndRankCoherent = 0;
  let iqrOnlyNoRank = 0;
  let rankOnlyNoIqr = 0;
  let iqrAndRankConflict = 0;

  for (const w of westRows) {
    const f = fkByName.get(w.source);
    if (!f) continue;

    const westReject = Math.abs(w.westZ) >= REJECT_ABS_Z;
    const fkReject = Math.abs(f.fkZ) >= REJECT_ABS_Z;
    const westSign = w.westZ > 0 ? +1 : w.westZ < 0 ? -1 : 0;
    const fkSign = f.fkZ > 0 ? +1 : f.fkZ < 0 ? -1 : 0;

    let bucket: WestenbergFlignerKilleenIqrVsFullRankScaleBucket;
    let direction: WestenbergFlignerKilleenDirection;

    if (westReject && fkReject) {
      if (westSign !== 0 && fkSign !== 0 && westSign !== fkSign) {
        bucket = 'iqr-and-rank-conflict';
        // Defer to FK for direction (continuous-rank-score is more
        // robust than the one-bit Westenberg call when they conflict).
        direction =
          fkSign > 0 ? 'second-larger' : 'first-larger';
      } else {
        bucket = 'iqr-and-rank-coherent';
        const sign = fkSign !== 0 ? fkSign : westSign;
        direction =
          sign > 0 ? 'second-larger' : sign < 0 ? 'first-larger' : 'balanced';
      }
    } else if (westReject && !fkReject) {
      bucket = 'iqr-only-no-rank';
      direction =
        westSign > 0 ? 'second-larger' : westSign < 0 ? 'first-larger' : 'balanced';
    } else if (!westReject && fkReject) {
      bucket = 'rank-only-no-iqr';
      direction =
        fkSign > 0 ? 'second-larger' : fkSign < 0 ? 'first-larger' : 'balanced';
    } else {
      bucket = 'both-ns';
      const sign = fkSign !== 0 ? fkSign : westSign;
      direction =
        sign > 0 ? 'second-larger' : sign < 0 ? 'first-larger' : 'balanced';
    }

    bucketCounts[bucket] += 1;
    if (bucket === 'iqr-and-rank-coherent') iqrAndRankCoherent += 1;
    if (bucket === 'iqr-only-no-rank') iqrOnlyNoRank += 1;
    if (bucket === 'rank-only-no-iqr') rankOnlyNoIqr += 1;
    if (bucket === 'iqr-and-rank-conflict') iqrAndRankConflict += 1;

    rows.push({
      source: w.source,
      westZ: w.westZ,
      westAbsZ: Math.abs(w.westZ),
      westPValue: w.westPValue,
      fkX2: f.fkX2,
      fkZ: f.fkZ,
      fkAbsZ: Math.abs(f.fkZ),
      fkPValue: f.fkPValue,
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
    iqrAndRankCoherent,
    iqrOnlyNoRank,
    rankOnlyNoIqr,
    iqrAndRankConflict,
    sourcesOnlyInWest,
    sourcesOnlyInFk,
  };
}
