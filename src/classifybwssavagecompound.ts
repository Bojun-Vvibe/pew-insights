/**
 * classifyBwsSavageCompound: cross-axis sign-and-decision
 * agreement classifier joining axis-184 SAVAGE (pure-
 * location, right-tail-sensitive rank score) per-source
 * verdicts with axis-185 BWS (combined location-and-scale
 * omnibus, ECDF-based) per-source verdicts.
 *
 * The two axes have antipodal influence design: Savage is
 * a SIGNED PURE-LOCATION test with infinite-derivative
 * influence at the maximum rank; BWS is an UNSIGNED
 * OMNIBUS test sensitive to ANY ECDF departure (location
 * OR scale). Joining them by source produces a four-way
 * cross-classification that surfaces departure SHAPE:
 *
 *   - 'joint-location-and-scale-second' — Savage SIGNED
 *     positive AND decisive at alpha; BWS decisive at
 *     alpha. The second-half ECDF is shifted right AND
 *     diverges in shape from the first half. The
 *     CANONICAL strong-mixed-shift bucket.
 *   - 'joint-location-and-scale-first' — Savage SIGNED
 *     negative AND decisive; BWS decisive. Same as above
 *     but with first-half dominance.
 *   - 'pure-location-second' — Savage SIGNED positive AND
 *     decisive; BWS NOT decisive. Strong location signal
 *     with no ECDF-shape departure. The DIAGNOSTIC bucket
 *     for clean monotone shifts in the body.
 *   - 'pure-location-first' — Savage SIGNED negative AND
 *     decisive; BWS NOT decisive. Same with first-half.
 *   - 'pure-scale-or-shape' — BWS decisive AND Savage NOT
 *     decisive. Major ECDF departure with negligible
 *     right-tail rank-mean shift. The classic
 *     pure-scale-or-shape diagnostic. Most informative
 *     when bwsSign === 0 (pooled-rank medians tied).
 *   - 'no-decisive-departure' — neither axis decisive.
 *   - 'sign-conflict' — both decisive, but Savage SIGN
 *     and BWS SIGN disagree (Savage says first-half
 *     larger, BWS says second-half larger by pooled-rank
 *     median, or vice versa). Antipodal-influence
 *     diagnostic: Savage's right-tail-sensitive sign
 *     differs from BWS's median-of-pooled-ranks sign,
 *     consistent with a heavy-tailed shift in one
 *     direction concurrent with a body shift in the
 *     opposite direction.
 *
 * Returns the joined-row table plus aggregate counts and
 * an `unanimousAndAllDecisive` summary so the caller can
 * gate on the strongest-evidence bucket.
 *
 * Pure function: no I/O, no allocation outside the input
 * arrays, deterministic ordering by source name asc.
 *
 * Reference:
 *   Baumgartner, W., Weiss, P. & Schindler, H., "A
 *     nonparametric test for the general two-sample
 *     problem", *Biometrics* 54 (1998), pp. 1129-1135.
 *   Savage, I. R., "Contributions to the theory of rank
 *     order statistics — the two-sample case",
 *     *Ann. Math. Stat.* 27 (1956), pp. 590-615.
 *   Marozzi, M., "Some notes on the location-scale
 *     Cucconi test", *Comm. Stat. Sim. Comp.* 38 (2009),
 *     pp. 1318-1334.
 */

export interface SavageRowForCompound {
  source: string;
  savZ: number;
  savPValue: number;
}

export interface BwsRowForCompound {
  source: string;
  bwsB: number;
  bwsPValue: number;
  bwsSign: -1 | 0 | 1;
}

export type BwsSavageCompoundBucket =
  | 'joint-location-and-scale-second'
  | 'joint-location-and-scale-first'
  | 'pure-location-second'
  | 'pure-location-first'
  | 'pure-scale-or-shape'
  | 'no-decisive-departure'
  | 'sign-conflict';

export interface BwsSavageCompoundJoinedRow {
  source: string;
  savZ: number;
  savPValue: number;
  bwsB: number;
  bwsPValue: number;
  bwsSign: -1 | 0 | 1;
  savDecisive: boolean;
  bwsDecisive: boolean;
  bucket: BwsSavageCompoundBucket;
}

export interface BwsSavageCompoundReport {
  alpha: number;
  rows: BwsSavageCompoundJoinedRow[];
  /** Number of joined rows in each bucket. */
  bucketCounts: Record<BwsSavageCompoundBucket, number>;
  /** Joined rows where both axes decisively reject AND signs agree. */
  jointAndAllDecisive: number;
  /** Joined rows where at least one of the two axes decisively rejects. */
  atLeastOneDecisive: number;
  /** Joined rows where both axes decisively reject. */
  bothDecisive: number;
  /** Sources present in only one of the two input tables. */
  sourcesOnlyInSavage: string[];
  sourcesOnlyInBws: string[];
}

export function classifyBwsSavageCompound(
  savageRows: ReadonlyArray<SavageRowForCompound>,
  bwsRows: ReadonlyArray<BwsRowForCompound>,
  alpha = 0.05,
): BwsSavageCompoundReport {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `classifyBwsSavageCompound: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }
  const savBySrc = new Map<string, SavageRowForCompound>();
  for (const r of savageRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyBwsSavageCompound: savage row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.savZ) ||
      !Number.isFinite(r.savPValue) ||
      r.savPValue < 0 ||
      r.savPValue > 1
    ) {
      throw new Error(
        `classifyBwsSavageCompound: savage row ${r.source} has invalid savZ/savPValue`,
      );
    }
    if (savBySrc.has(r.source)) {
      throw new Error(
        `classifyBwsSavageCompound: duplicate savage source ${r.source}`,
      );
    }
    savBySrc.set(r.source, r);
  }
  const bwsBySrc = new Map<string, BwsRowForCompound>();
  for (const r of bwsRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyBwsSavageCompound: bws row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.bwsB) ||
      r.bwsB < 0 ||
      !Number.isFinite(r.bwsPValue) ||
      r.bwsPValue < 0 ||
      r.bwsPValue > 1
    ) {
      throw new Error(
        `classifyBwsSavageCompound: bws row ${r.source} has invalid bwsB/bwsPValue`,
      );
    }
    if (r.bwsSign !== -1 && r.bwsSign !== 0 && r.bwsSign !== 1) {
      throw new Error(
        `classifyBwsSavageCompound: bws row ${r.source} has invalid bwsSign ${r.bwsSign}`,
      );
    }
    if (bwsBySrc.has(r.source)) {
      throw new Error(
        `classifyBwsSavageCompound: duplicate bws source ${r.source}`,
      );
    }
    bwsBySrc.set(r.source, r);
  }

  const sourcesOnlyInSavage: string[] = [];
  const sourcesOnlyInBws: string[] = [];
  for (const s of savBySrc.keys()) {
    if (!bwsBySrc.has(s)) sourcesOnlyInSavage.push(s);
  }
  for (const s of bwsBySrc.keys()) {
    if (!savBySrc.has(s)) sourcesOnlyInBws.push(s);
  }
  sourcesOnlyInSavage.sort();
  sourcesOnlyInBws.sort();

  const joinedSources: string[] = [];
  for (const s of savBySrc.keys()) if (bwsBySrc.has(s)) joinedSources.push(s);
  joinedSources.sort();

  const rows: BwsSavageCompoundJoinedRow[] = [];
  const bucketCounts: Record<BwsSavageCompoundBucket, number> = {
    'joint-location-and-scale-second': 0,
    'joint-location-and-scale-first': 0,
    'pure-location-second': 0,
    'pure-location-first': 0,
    'pure-scale-or-shape': 0,
    'no-decisive-departure': 0,
    'sign-conflict': 0,
  };
  let jointAndAllDecisive = 0;
  let atLeastOneDecisive = 0;
  let bothDecisive = 0;

  for (const src of joinedSources) {
    const sav = savBySrc.get(src)!;
    const bws = bwsBySrc.get(src)!;
    const savDecisive = sav.savPValue < alpha;
    const bwsDecisive = bws.bwsPValue < alpha;
    const savSign = sav.savZ > 0 ? 1 : sav.savZ < 0 ? -1 : 0;
    let bucket: BwsSavageCompoundBucket;
    if (savDecisive && bwsDecisive) {
      // Both decisive — check sign agreement. bwsSign === 0
      // is treated as "no preferred direction"; aligns with
      // either savSign without conflict, but cannot itself
      // create a conflict.
      const conflict =
        savSign !== 0 && bws.bwsSign !== 0 && savSign !== bws.bwsSign;
      if (conflict) {
        bucket = 'sign-conflict';
      } else if (savSign > 0 || bws.bwsSign > 0) {
        bucket = 'joint-location-and-scale-second';
      } else if (savSign < 0 || bws.bwsSign < 0) {
        bucket = 'joint-location-and-scale-first';
      } else {
        // Both signs zero — pure-shape with no detectable
        // direction; categorise as pure-scale-or-shape
        // since BWS rejected.
        bucket = 'pure-scale-or-shape';
      }
    } else if (savDecisive && !bwsDecisive) {
      bucket = savSign >= 0 ? 'pure-location-second' : 'pure-location-first';
    } else if (!savDecisive && bwsDecisive) {
      bucket = 'pure-scale-or-shape';
    } else {
      bucket = 'no-decisive-departure';
    }
    bucketCounts[bucket] += 1;
    if (savDecisive && bwsDecisive) {
      bothDecisive += 1;
      if (
        bucket === 'joint-location-and-scale-second' ||
        bucket === 'joint-location-and-scale-first' ||
        bucket === 'pure-scale-or-shape'
      ) {
        jointAndAllDecisive += 1;
      }
    }
    if (savDecisive || bwsDecisive) atLeastOneDecisive += 1;

    rows.push({
      source: src,
      savZ: sav.savZ,
      savPValue: sav.savPValue,
      bwsB: bws.bwsB,
      bwsPValue: bws.bwsPValue,
      bwsSign: bws.bwsSign,
      savDecisive,
      bwsDecisive,
      bucket,
    });
  }

  return {
    alpha,
    rows,
    bucketCounts,
    jointAndAllDecisive,
    atLeastOneDecisive,
    bothDecisive,
    sourcesOnlyInSavage,
    sourcesOnlyInBws,
  };
}
