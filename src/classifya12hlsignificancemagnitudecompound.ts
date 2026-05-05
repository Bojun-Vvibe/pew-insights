/**
 * classifyA12HlSignificanceMagnitudeCompound: cross-axis
 * joiner reconciling axis-187 VARGHA-DELANEY A12
 * EFFECT-SIZE (`a12`, `vdMagnitude`, `vdCiExcludesHalf`)
 * with axis-186 HODGES-LEHMANN SHIFT POINT-ESTIMATOR
 * (`hlDelta`, `hlSign`, `hlCiExcludesZero`) on a per-
 * source join, into eight mutually-exclusive bivariate
 * SIGNIFICANCE x MAGNITUDE x DIRECTION buckets.
 *
 * SIGN-CONVENTION ALIGNMENT (CRITICAL). axis-187 and
 * axis-186 SHARE the same SECOND-half-positive
 * convention (unlike axis-115 MW which is inverted), so
 * the alignment is straightforward:
 *
 *   - axis-187: a12 > 0.5  IFF the second-half day is
 *     stochastically larger; a12 < 0.5 IFF first-half
 *     is stochastically larger.
 *   - axis-186: hlSign = +1 IFF hlDelta > 0 IFF the
 *     second-half median is larger.
 *
 * Therefore the "signs agree on the same alternative"
 * condition is simply
 *
 *     (a12 > 0.5)   <=>  (hlSign > 0)
 *     (a12 < 0.5)   <=>  (hlSign < 0)
 *
 * WHY THIS COMPOUND IS INFORMATIVE. axis-187 and
 * axis-186 measure the SAME location alternative
 * through TWO COMPLEMENTARY LENSES that the existing
 * axis-186 + axis-115 joiner (`classifyHlMwShiftAgreement`)
 * does NOT span:
 *
 *   - axis-186 reports a SIGNED RAW-UNIT POINT
 *     ESTIMATE of the median pairwise shift (in
 *     tokens). Tells you how MUCH the location moved.
 *   - axis-187 reports an UNSIGNED-MAGNITUDE +
 *     SIGNED-DIRECTION SCALE-FREE EFFECT SIZE in
 *     [0, 1] with a probabilistic interpretation. Tells
 *     you how MEANINGFUL the move is regardless of the
 *     source's token volume.
 *
 * Their cross-product directly recovers the four
 * canonical reporting quadrants from Vargha-Delaney
 * 2000 sec. 4 (effect-size methodology) crossed with
 * the two HL decision states:
 *
 *   - both DECISIVE + LARGE/MEDIUM A12 + signs agree
 *     => clean meaningful directional shift
 *   - both DECISIVE + SMALL/NEGLIGIBLE A12 + signs agree
 *     => statistically distinguishable but
 *        meaningfully trivial directional shift
 *        (the "n is too large" archetype)
 *   - HL decisive + A12 CI straddles 0.5 => the rank
 *     SE inflates the A12 CI past 0.5 even though the
 *     pairwise-difference distribution is bounded
 *     away from 0; common when n1, n2 are small but
 *     hlDelta is far from 0
 *   - A12 decisive + HL CI straddles 0 => the
 *     pairwise-difference distribution has heavy tails
 *     widening the HL CI even though A12's
 *     placement-rank SE is small
 *   - neither decisive => no detectable shift
 *   - sign conflict => the median pairwise diff and
 *     the rank-based effect size disagree on which
 *     half is stochastically larger; only possible
 *     under heavy-tied bimodal-within-half data
 *
 * Reports per-bucket counts, the count of joined rows
 * that are LARGE-AND-SIGNIFICANT (the headline
 * actionable count), the count that are
 * SIGNIFICANT-BUT-NEGLIGIBLE (the "ignore this signal"
 * count surfaced for transparency), source-set
 * asymmetry, and deterministic source-asc ordering.
 */

export type A12HlCompoundBucket =
  | 'agree-second-larger-meaningful'
  | 'agree-second-larger-trivial'
  | 'agree-first-larger-meaningful'
  | 'agree-first-larger-trivial'
  | 'a12-only-decisive'
  | 'hl-only-decisive'
  | 'sign-conflict'
  | 'no-decisive-shift';

export type VdMagnitude = 'negligible' | 'small' | 'medium' | 'large';

export interface A12RowForJoin {
  source: string;
  a12: number;
  vdMagnitude: VdMagnitude;
  vdCiExcludesHalf: boolean;
}

export interface HlRowForA12Join {
  source: string;
  hlDelta: number;
  hlSign: -1 | 0 | 1;
  hlCiExcludesZero: boolean;
}

export interface ClassifiedA12HlRow {
  source: string;
  a12: number;
  vdMagnitude: VdMagnitude;
  vdCiExcludesHalf: boolean;
  hlDelta: number;
  hlSign: -1 | 0 | 1;
  hlCiExcludesZero: boolean;
  bucket: A12HlCompoundBucket;
}

export interface ClassifyA12HlReport {
  rows: ClassifiedA12HlRow[];
  bucketCounts: Record<A12HlCompoundBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  signConflicts: number;
  largeAndSignificant: number;
  significantButNegligible: number;
  sourcesOnlyInA12: string[];
  sourcesOnlyInHl: string[];
}

const VALID_MAGNITUDES: ReadonlySet<VdMagnitude> = new Set([
  'negligible',
  'small',
  'medium',
  'large',
]);

function isMeaningful(m: VdMagnitude): boolean {
  return m === 'medium' || m === 'large';
}

export function classifyA12HlSignificanceMagnitudeCompound(
  a12Rows: ReadonlyArray<A12RowForJoin>,
  hlRows: ReadonlyArray<HlRowForA12Join>,
): ClassifyA12HlReport {
  const seenA = new Set<string>();
  for (const r of a12Rows) {
    if (seenA.has(r.source)) {
      throw new Error(
        `classifyA12HlSignificanceMagnitudeCompound: duplicate A12 source '${r.source}'`,
      );
    }
    seenA.add(r.source);
    if (!Number.isFinite(r.a12) || r.a12 < 0 || r.a12 > 1) {
      throw new Error(
        `classifyA12HlSignificanceMagnitudeCompound: a12 must be finite in [0, 1] for source '${r.source}' (got ${r.a12})`,
      );
    }
    if (!VALID_MAGNITUDES.has(r.vdMagnitude)) {
      throw new Error(
        `classifyA12HlSignificanceMagnitudeCompound: vdMagnitude must be one of 'negligible' | 'small' | 'medium' | 'large' for source '${r.source}'`,
      );
    }
  }
  const seenH = new Set<string>();
  for (const r of hlRows) {
    if (seenH.has(r.source)) {
      throw new Error(
        `classifyA12HlSignificanceMagnitudeCompound: duplicate HL source '${r.source}'`,
      );
    }
    seenH.add(r.source);
    if (!Number.isFinite(r.hlDelta)) {
      throw new Error(
        `classifyA12HlSignificanceMagnitudeCompound: hlDelta must be finite for source '${r.source}'`,
      );
    }
    if (r.hlSign !== -1 && r.hlSign !== 0 && r.hlSign !== 1) {
      throw new Error(
        `classifyA12HlSignificanceMagnitudeCompound: hlSign must be -1, 0, or 1 for source '${r.source}'`,
      );
    }
  }

  const hlByName = new Map<string, HlRowForA12Join>();
  for (const r of hlRows) hlByName.set(r.source, r);
  const a12ByName = new Map<string, A12RowForJoin>();
  for (const r of a12Rows) a12ByName.set(r.source, r);

  const sourcesOnlyInA12: string[] = [];
  const sourcesOnlyInHl: string[] = [];
  for (const r of a12Rows) {
    if (!hlByName.has(r.source)) sourcesOnlyInA12.push(r.source);
  }
  for (const r of hlRows) {
    if (!a12ByName.has(r.source)) sourcesOnlyInHl.push(r.source);
  }
  sourcesOnlyInA12.sort();
  sourcesOnlyInHl.sort();

  const rows: ClassifiedA12HlRow[] = [];
  const bucketCounts: Record<A12HlCompoundBucket, number> = {
    'agree-second-larger-meaningful': 0,
    'agree-second-larger-trivial': 0,
    'agree-first-larger-meaningful': 0,
    'agree-first-larger-trivial': 0,
    'a12-only-decisive': 0,
    'hl-only-decisive': 0,
    'sign-conflict': 0,
    'no-decisive-shift': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  let signConflicts = 0;
  let largeAndSignificant = 0;
  let significantButNegligible = 0;

  for (const a of a12Rows) {
    const h = hlByName.get(a.source);
    if (!h) continue;
    const aDecisive = a.vdCiExcludesHalf;
    const hDecisive = h.hlCiExcludesZero;
    const aDir = a.a12 > 0.5 ? 1 : a.a12 < 0.5 ? -1 : 0;
    let bucket: A12HlCompoundBucket;
    if (aDecisive && hDecisive) {
      bothDecisive += 1;
      atLeastOneDecisive += 1;
      // both decisive: agree iff signs match
      const signsAgree =
        (aDir > 0 && h.hlSign > 0) || (aDir < 0 && h.hlSign < 0);
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
      } else if (aDir === 0 || h.hlSign === 0) {
        // pathological: A12 exactly 0.5 with CI excluding 0.5,
        // or hlDelta exactly 0 with CI excluding 0. Defer
        // direction to whichever side is non-zero; if both
        // are zero, route to sign-conflict as the safest
        // surface (a CI excluding the null with point estimate
        // AT the null is itself anomalous).
        if (aDir === 0 && h.hlSign === 0) {
          bucket = 'sign-conflict';
          signConflicts += 1;
        } else {
          const dir = aDir !== 0 ? aDir : h.hlSign;
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
    } else if (aDecisive) {
      atLeastOneDecisive += 1;
      bucket = 'a12-only-decisive';
    } else if (hDecisive) {
      atLeastOneDecisive += 1;
      bucket = 'hl-only-decisive';
    } else {
      bucket = 'no-decisive-shift';
    }
    bucketCounts[bucket] += 1;
    if (
      bucket === 'agree-second-larger-meaningful' ||
      bucket === 'agree-first-larger-meaningful'
    ) {
      if (a.vdMagnitude === 'large') largeAndSignificant += 1;
    }
    if (
      (bucket === 'agree-second-larger-trivial' ||
        bucket === 'agree-first-larger-trivial') &&
      a.vdMagnitude === 'negligible'
    ) {
      significantButNegligible += 1;
    }
    rows.push({
      source: a.source,
      a12: a.a12,
      vdMagnitude: a.vdMagnitude,
      vdCiExcludesHalf: a.vdCiExcludesHalf,
      hlDelta: h.hlDelta,
      hlSign: h.hlSign,
      hlCiExcludesZero: h.hlCiExcludesZero,
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
    largeAndSignificant,
    significantButNegligible,
    sourcesOnlyInA12,
    sourcesOnlyInHl,
  };
}
