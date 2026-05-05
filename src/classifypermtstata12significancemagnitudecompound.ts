/**
 * classifyPermTstatA12SignificanceMagnitudeCompound:
 * cross-axis joiner reconciling axis-188 PERMUTATION
 * WELCH-T SIGNIFICANCE (`permPTwoSided`, `permTStat`,
 * `permSign`) with axis-187 VARGHA-DELANEY A12
 * EFFECT-SIZE (`a12`, `vdMagnitude`, `vdCiExcludesHalf`)
 * on a per-source join, into eight mutually-exclusive
 * bivariate SIGNIFICANCE x MAGNITUDE x DIRECTION
 * buckets.
 *
 * SIGN-CONVENTION ALIGNMENT (CRITICAL). Both axes
 * preserve the SECOND-half-positive convention:
 *
 *   - axis-188: permTStat > 0  IFF the second-half
 *     mean is larger; permSign tracks sign(permTStat).
 *   - axis-187: a12 > 0.5  IFF the second-half day is
 *     stochastically larger.
 *
 * Therefore signs-agree is simply
 *
 *     (permSign > 0)  <=>  (a12 > 0.5)
 *     (permSign < 0)  <=>  (a12 < 0.5)
 *
 * WHY THIS COMPOUND IS THE RIGHT JOIN. axis-188 and
 * axis-187 measure the SAME location alternative
 * through TWO MAXIMALLY-INDEPENDENT INFERENTIAL
 * BASES that no prior compound spans:
 *
 *   - axis-188 uses the RAW values via the parametric
 *     Welch-t numerator/denominator BUT references it
 *     to a PERMUTATION null. Inherits t-stat
 *     efficiency under approximately-normal data while
 *     retaining EXACT type-I control under any
 *     exchangeable null. The decision is a
 *     DISTRIBUTION-FREE SIGNIFICANCE CALL.
 *   - axis-187 builds from POOLED RANKS into a
 *     SCALE-FREE EFFECT SIZE in [0, 1] with a
 *     probabilistic interpretation. The decision is
 *     an EFFECT-SIZE MAGNITUDE CALL with a Brunner-
 *     Munzel-2000 asymptotic CI on the placement
 *     statistic.
 *
 * The cross-product directly recovers the four
 * canonical reporting quadrants from the design-
 * of-experiments literature (significance x effect
 * size; e.g. Wilkinson & APA Task Force 1999
 * recommendations for effect-size reporting):
 *
 *   - both DECISIVE + LARGE/MEDIUM A12 + signs agree
 *     => clean, meaningful, distribution-free directional shift
 *   - both DECISIVE + SMALL/NEGLIGIBLE A12 + signs
 *     agree => "significant but trivial" archetype:
 *     the permutation null rejects but the effect
 *     size is below the meaningful threshold (rare
 *     for permutation tests on n=16; common when n
 *     is large)
 *   - axis-188 ONLY decisive, A12 CI straddles 0.5
 *     => the rank-CI on placement is wider than the
 *     pooled-permutation null (typical when ties
 *     are heavy and inflate the placement variance)
 *   - axis-187 ONLY decisive, axis-188 ns => the
 *     pooled-permutation null absorbs the observed
 *     t even though the rank placement excludes
 *     0.5 (typical when the data are heavy-tailed
 *     and one or two extreme values dominate the
 *     t-stat denominator). axis-188 is the more
 *     conservative test in this regime.
 *
 * UNLIKE classifyA12HlSignificanceMagnitudeCompound
 * (axes 187 + 186), THIS compound joins TWO
 * SIGNIFICANCE-DECISION axes (axis-188 distribution-
 * free p, axis-187 placement-CI) rather than ONE
 * effect-size + ONE point-estimator. The headline
 * actionable count `permDecisiveAndLargeA12` answers
 * "is the location shift on this source BOTH
 * decisively detectable under the strongest
 * distribution-free null AND meaningful in scale-
 * free Vargha-Delaney terms".
 */

import type { VarghaDelaneyMagnitude } from './dailytokenvarghadelaneyhalves.js';

export type PermTstatA12CompoundBucket =
  | 'agree-second-larger-meaningful'
  | 'agree-second-larger-trivial'
  | 'agree-first-larger-meaningful'
  | 'agree-first-larger-trivial'
  | 'perm-only-decisive'
  | 'a12-only-decisive'
  | 'sign-conflict'
  | 'no-decisive-shift';

export interface PermRowForA12Join {
  source: string;
  /** Observed Welch-t statistic (signed; positive = second-half larger). */
  permTStat: number;
  /** Two-sided permutation p-value in [0, 1]. */
  permPTwoSided: number;
  /** Sign of permTStat in {-1, 0, +1}. */
  permSign: -1 | 0 | 1;
}

export interface A12RowForPermJoin {
  source: string;
  a12: number;
  vdMagnitude: VarghaDelaneyMagnitude;
  vdCiExcludesHalf: boolean;
}

export interface ClassifiedPermTstatA12Row {
  source: string;
  permTStat: number;
  permPTwoSided: number;
  permSign: -1 | 0 | 1;
  a12: number;
  vdMagnitude: VarghaDelaneyMagnitude;
  vdCiExcludesHalf: boolean;
  bucket: PermTstatA12CompoundBucket;
}

export interface ClassifyPermTstatA12Report {
  rows: ClassifiedPermTstatA12Row[];
  bucketCounts: Record<PermTstatA12CompoundBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  signConflicts: number;
  /** Decisive perm-t (p<=.05) AND A12 magnitude is 'large'. */
  permDecisiveAndLargeA12: number;
  /** Decisive perm-t (p<=.05) AND A12 magnitude is 'negligible'. */
  permDecisiveButNegligibleA12: number;
  sourcesOnlyInPerm: string[];
  sourcesOnlyInA12: string[];
}

/** alpha threshold for the perm-t significance call. */
const PERM_ALPHA = 0.05;

const VALID_MAGNITUDES: ReadonlySet<VarghaDelaneyMagnitude> = new Set([
  'negligible',
  'small',
  'medium',
  'large',
]);

function isMeaningful(m: VarghaDelaneyMagnitude): boolean {
  return m === 'medium' || m === 'large';
}

export function classifyPermTstatA12SignificanceMagnitudeCompound(
  permRows: ReadonlyArray<PermRowForA12Join>,
  a12Rows: ReadonlyArray<A12RowForPermJoin>,
): ClassifyPermTstatA12Report {
  const seenP = new Set<string>();
  for (const r of permRows) {
    if (seenP.has(r.source)) {
      throw new Error(
        `classifyPermTstatA12SignificanceMagnitudeCompound: duplicate perm source '${r.source}'`,
      );
    }
    seenP.add(r.source);
    if (!Number.isFinite(r.permTStat)) {
      throw new Error(
        `classifyPermTstatA12SignificanceMagnitudeCompound: permTStat must be finite for source '${r.source}'`,
      );
    }
    if (
      !Number.isFinite(r.permPTwoSided) ||
      r.permPTwoSided < 0 ||
      r.permPTwoSided > 1
    ) {
      throw new Error(
        `classifyPermTstatA12SignificanceMagnitudeCompound: permPTwoSided must be finite in [0, 1] for source '${r.source}' (got ${r.permPTwoSided})`,
      );
    }
    if (r.permSign !== -1 && r.permSign !== 0 && r.permSign !== 1) {
      throw new Error(
        `classifyPermTstatA12SignificanceMagnitudeCompound: permSign must be -1, 0, or 1 for source '${r.source}'`,
      );
    }
  }
  const seenA = new Set<string>();
  for (const r of a12Rows) {
    if (seenA.has(r.source)) {
      throw new Error(
        `classifyPermTstatA12SignificanceMagnitudeCompound: duplicate A12 source '${r.source}'`,
      );
    }
    seenA.add(r.source);
    if (!Number.isFinite(r.a12) || r.a12 < 0 || r.a12 > 1) {
      throw new Error(
        `classifyPermTstatA12SignificanceMagnitudeCompound: a12 must be finite in [0, 1] for source '${r.source}' (got ${r.a12})`,
      );
    }
    if (!VALID_MAGNITUDES.has(r.vdMagnitude)) {
      throw new Error(
        `classifyPermTstatA12SignificanceMagnitudeCompound: vdMagnitude must be one of 'negligible' | 'small' | 'medium' | 'large' for source '${r.source}'`,
      );
    }
  }

  const permByName = new Map<string, PermRowForA12Join>();
  for (const r of permRows) permByName.set(r.source, r);
  const a12ByName = new Map<string, A12RowForPermJoin>();
  for (const r of a12Rows) a12ByName.set(r.source, r);

  const sourcesOnlyInPerm: string[] = [];
  const sourcesOnlyInA12: string[] = [];
  for (const r of permRows) {
    if (!a12ByName.has(r.source)) sourcesOnlyInPerm.push(r.source);
  }
  for (const r of a12Rows) {
    if (!permByName.has(r.source)) sourcesOnlyInA12.push(r.source);
  }
  sourcesOnlyInPerm.sort();
  sourcesOnlyInA12.sort();

  const rows: ClassifiedPermTstatA12Row[] = [];
  const bucketCounts: Record<PermTstatA12CompoundBucket, number> = {
    'agree-second-larger-meaningful': 0,
    'agree-second-larger-trivial': 0,
    'agree-first-larger-meaningful': 0,
    'agree-first-larger-trivial': 0,
    'perm-only-decisive': 0,
    'a12-only-decisive': 0,
    'sign-conflict': 0,
    'no-decisive-shift': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  let signConflicts = 0;
  let permDecisiveAndLargeA12 = 0;
  let permDecisiveButNegligibleA12 = 0;

  for (const p of permRows) {
    const a = a12ByName.get(p.source);
    if (!a) continue;
    const pDecisive = p.permPTwoSided <= PERM_ALPHA;
    const aDecisive = a.vdCiExcludesHalf;
    const aDir = a.a12 > 0.5 ? 1 : a.a12 < 0.5 ? -1 : 0;
    let bucket: PermTstatA12CompoundBucket;
    if (pDecisive && aDecisive) {
      bothDecisive += 1;
      atLeastOneDecisive += 1;
      const signsAgree =
        (p.permSign > 0 && aDir > 0) || (p.permSign < 0 && aDir < 0);
      if (signsAgree) {
        const meaningful = isMeaningful(a.vdMagnitude);
        if (aDir > 0) {
          bucket = meaningful
            ? 'agree-second-larger-meaningful'
            : 'agree-second-larger-trivial';
        } else {
          bucket = meaningful
            ? 'agree-first-larger-meaningful'
            : 'agree-first-larger-trivial';
        }
      } else if (p.permSign === 0 || aDir === 0) {
        // pathological: t exactly 0 with p<=alpha (only via discrete
        // permutation distribution at the median) or A12 exactly
        // 0.5 with CI excluding 0.5. Defer direction to whichever
        // side is non-zero; if both zero, sign-conflict.
        if (p.permSign === 0 && aDir === 0) {
          bucket = 'sign-conflict';
          signConflicts += 1;
        } else {
          const dir = p.permSign !== 0 ? p.permSign : aDir;
          const meaningful = isMeaningful(a.vdMagnitude);
          if (dir > 0) {
            bucket = meaningful
              ? 'agree-second-larger-meaningful'
              : 'agree-second-larger-trivial';
          } else {
            bucket = meaningful
              ? 'agree-first-larger-meaningful'
              : 'agree-first-larger-trivial';
          }
        }
      } else {
        bucket = 'sign-conflict';
        signConflicts += 1;
      }
    } else if (pDecisive) {
      atLeastOneDecisive += 1;
      bucket = 'perm-only-decisive';
    } else if (aDecisive) {
      atLeastOneDecisive += 1;
      bucket = 'a12-only-decisive';
    } else {
      bucket = 'no-decisive-shift';
    }
    bucketCounts[bucket] += 1;
    if (pDecisive && a.vdMagnitude === 'large') permDecisiveAndLargeA12 += 1;
    if (pDecisive && a.vdMagnitude === 'negligible')
      permDecisiveButNegligibleA12 += 1;
    rows.push({
      source: p.source,
      permTStat: p.permTStat,
      permPTwoSided: p.permPTwoSided,
      permSign: p.permSign,
      a12: a.a12,
      vdMagnitude: a.vdMagnitude,
      vdCiExcludesHalf: a.vdCiExcludesHalf,
      bucket,
    });
  }
  rows.sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0));

  return {
    rows,
    bucketCounts,
    bothDecisive,
    atLeastOneDecisive,
    signConflicts,
    permDecisiveAndLargeA12,
    permDecisiveButNegligibleA12,
    sourcesOnlyInPerm,
    sourcesOnlyInA12,
  };
}
