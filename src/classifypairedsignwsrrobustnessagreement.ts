/**
 * classifyPairedSignWsrRobustnessAgreement: cross-axis
 * joiner reconciling axis-190 PAIRED BINOMIAL SIGN TEST
 * (`pstPTwoSided`, `pstSign`, `pstDelta`) with axis-189
 * WILCOXON SIGNED-RANK PAIRED TEST (`wsrPTwoSided`,
 * `wsrSign`, `wsrRankBiserial`) on a per-source join,
 * into eight mutually-exclusive bivariate ROBUSTNESS-
 * AGREEMENT x DIRECTION buckets.
 *
 * SIGN-CONVENTION ALIGNMENT (CRITICAL). Both axes
 * preserve the SECOND-half-positive convention on the
 * SAME pairing (d_i = B_i - A_i):
 *
 *   - axis-190: pstSign > 0 IFF S+ > N_nz/2 IFF more
 *     than half of within-pair half-deltas point up.
 *   - axis-189: wsrSign > 0 IFF W+ > E[W+] IFF the
 *     positive-rank mass exceeds expectation.
 *
 * Because they operate on the SAME paired differences,
 * sign agreement is the rule and sign conflict is rare
 * (it can occur only when sign and rank-magnitude
 * disagree -- e.g. a small majority of up-pairs where
 * the few down-pairs have outsized magnitudes).
 *
 * WHY THIS COMPOUND IS THE RIGHT JOIN. axis-190 and
 * axis-189 measure the SAME paired-shift alternative
 * through TWO COMPLEMENTARY INFERENTIAL BASES that
 * trade DISTRIBUTION-FREENESS against POWER:
 *
 *   - axis-190 (sign test) uses ONLY the within-pair
 *     directions sign(d_i). The null is per-pair
 *     exchangeability with negation -- the WEAKEST
 *     possible distributional assumption for a
 *     paired test. Type-I control survives ANY
 *     asymmetric, heavy-tailed, or otherwise
 *     contaminated paired distribution. The price
 *     paid is reduced power against symmetric
 *     alternatives (asymptotic relative efficiency
 *     2/pi ~= 0.637 vs Wilcoxon under normal d_i).
 *   - axis-189 (signed-rank test) uses the FULL
 *     RANKS of |d_i|. The null requires symmetry of
 *     F_d around 0 -- a STRONGER distributional
 *     assumption. The bonus is recovered power: Type-I
 *     control is still distribution-free under the
 *     symmetric-CDF null, and ARE = 0.955 vs the
 *     parametric paired-t under normal d_i.
 *
 * The cross-product is the TEXTBOOK ROBUSTNESS-
 * VS-EFFICIENCY DIAGNOSTIC for paired tests
 * (Lehmann 1975 chapter 4; Hollander-Wolfe-Chicken
 * 2014 chapter 3) and produces these archetypes:
 *
 *   - both DECISIVE + signs agree => the paired
 *     shift is REAL under both inferential bases.
 *     This is the "robust meaningful shift" cell:
 *     even the most distribution-free paired test
 *     rejects, AND the rank-magnitude test that
 *     could conceivably be inflated by asymmetric-
 *     tail leverage ALSO rejects. Maximally
 *     defensible directional call.
 *   - axis-189 ONLY decisive (sign-test ns) =>
 *     "rank-magnitude-only signal" archetype: a few
 *     pairs with large signed deviations dominate
 *     the rank statistic, but the sign balance
 *     itself is too close to 50/50 for the binomial
 *     null to reject. This is a CLASSIC SUSPICIOUS
 *     PATTERN: it is exactly what asymmetric-tail
 *     contamination produces (large deviations
 *     concentrated on one side that the symmetric-
 *     CDF wsr null misinterprets as a shift). axis-
 *     190 vetoes the wsr conclusion; the more
 *     conservative ROBUST decision is "ns".
 *   - axis-190 ONLY decisive (wsr ns) => a CLEAR
 *     SIGN MAJORITY but the within-pair magnitudes
 *     are noisy enough that the rank statistic
 *     does not reach significance. Less common
 *     (sign test typically less powerful) but
 *     possible when most non-zero pairs are
 *     clustered just above/below zero with similar
 *     magnitudes -- the binomial counts cleanly
 *     while the rank statistic dilutes among
 *     nearly-tied magnitudes.
 *   - sign conflict => rare, indicates the rank
 *     statistic and the sign count point in
 *     OPPOSITE directions. Always categorical
 *     red-flag; usually requires a tiny-N pair
 *     count combined with a few large opposite-
 *     direction pairs.
 *
 * UNLIKE classifyPermTstatA12SignificanceMagnitude
 * Compound (axes 188 + 187) which joins two
 * INDEPENDENT-DESIGN tests, THIS compound joins TWO
 * PAIRED-DESIGN tests on the SAME pairing. The
 * primary headline count `bothDecisiveAgreement` is
 * the direct count of sources where the paired-shift
 * directional call is ROBUST in the strongest
 * possible distributional sense -- both the most
 * conservative sign test AND the more powerful but
 * symmetric-CDF-assuming wsr agree.
 *
 * Refs: Lehmann 1975 *Nonparametrics* chapter 4;
 * Hollander, Wolfe & Chicken 2014 *Nonparametric
 * Statistical Methods* 3rd ed chapter 3; Hodges &
 * Lehmann 1956 *Annals Math. Stat.* 27:324-335
 * (relative efficiency).
 */

export type PairedSignWsrCompoundBucket =
  | 'both-decisive-second-larger'
  | 'both-decisive-first-larger'
  | 'wsr-only-decisive-second-larger'
  | 'wsr-only-decisive-first-larger'
  | 'sign-only-decisive-second-larger'
  | 'sign-only-decisive-first-larger'
  | 'sign-conflict'
  | 'no-decisive-shift';

export interface PairedSignRowForWsrJoin {
  source: string;
  /** Two-sided EXACT binomial p in [0, 1] from axis-190. */
  pstPTwoSided: number;
  /** Sign of (S+ - N_nz/2) in {-1, 0, +1}. */
  pstSign: -1 | 0 | 1;
  /** Sign-balance (S+ - S-) / N_nz in [-1, 1]. */
  pstDelta: number;
}

export interface WsrRowForPairedSignJoin {
  source: string;
  /** Two-sided normal-approx p in [0, 1] from axis-189. */
  wsrPTwoSided: number;
  /** Sign of Z (= sign of W+ - E[W+]) in {-1, 0, +1}. */
  wsrSign: -1 | 0 | 1;
  /** Matched-pairs rank-biserial in [-1, 1]. */
  wsrRankBiserial: number;
}

export interface ClassifiedPairedSignWsrRow {
  source: string;
  pstPTwoSided: number;
  pstSign: -1 | 0 | 1;
  pstDelta: number;
  wsrPTwoSided: number;
  wsrSign: -1 | 0 | 1;
  wsrRankBiserial: number;
  bucket: PairedSignWsrCompoundBucket;
}

export interface ClassifyPairedSignWsrReport {
  rows: ClassifiedPairedSignWsrRow[];
  bucketCounts: Record<PairedSignWsrCompoundBucket, number>;
  /** Both axes reject at .05 AND signs agree. */
  bothDecisiveAgreement: number;
  /** Both axes reject at .05 (regardless of agreement). */
  bothDecisive: number;
  /** At least one axis rejects at .05. */
  atLeastOneDecisive: number;
  /** Sign-conflict count (categorical red-flag). */
  signConflicts: number;
  /** wsr decisive but sign test ns -- "rank-magnitude only" pattern. */
  wsrOnlyButRobustVeto: number;
  /** sign test decisive but wsr ns -- clean sign majority, noisy magnitudes. */
  signOnly: number;
  sourcesOnlyInPst: string[];
  sourcesOnlyInWsr: string[];
}

/** alpha threshold for both axes' significance call. */
const ALPHA = 0.05;

export function classifyPairedSignWsrRobustnessAgreement(
  pstRows: ReadonlyArray<PairedSignRowForWsrJoin>,
  wsrRows: ReadonlyArray<WsrRowForPairedSignJoin>,
): ClassifyPairedSignWsrReport {
  const seenP = new Set<string>();
  for (const r of pstRows) {
    if (seenP.has(r.source)) {
      throw new Error(
        `classifyPairedSignWsrRobustnessAgreement: duplicate paired-sign source '${r.source}'`,
      );
    }
    seenP.add(r.source);
    if (
      !Number.isFinite(r.pstPTwoSided) ||
      r.pstPTwoSided < 0 ||
      r.pstPTwoSided > 1
    ) {
      throw new Error(
        `classifyPairedSignWsrRobustnessAgreement: pstPTwoSided must be finite in [0, 1] for source '${r.source}' (got ${r.pstPTwoSided})`,
      );
    }
    if (r.pstSign !== -1 && r.pstSign !== 0 && r.pstSign !== 1) {
      throw new Error(
        `classifyPairedSignWsrRobustnessAgreement: pstSign must be -1, 0, or 1 for source '${r.source}'`,
      );
    }
    if (!Number.isFinite(r.pstDelta) || r.pstDelta < -1 || r.pstDelta > 1) {
      throw new Error(
        `classifyPairedSignWsrRobustnessAgreement: pstDelta must be finite in [-1, 1] for source '${r.source}' (got ${r.pstDelta})`,
      );
    }
  }
  const seenW = new Set<string>();
  for (const r of wsrRows) {
    if (seenW.has(r.source)) {
      throw new Error(
        `classifyPairedSignWsrRobustnessAgreement: duplicate wsr source '${r.source}'`,
      );
    }
    seenW.add(r.source);
    if (
      !Number.isFinite(r.wsrPTwoSided) ||
      r.wsrPTwoSided < 0 ||
      r.wsrPTwoSided > 1
    ) {
      throw new Error(
        `classifyPairedSignWsrRobustnessAgreement: wsrPTwoSided must be finite in [0, 1] for source '${r.source}' (got ${r.wsrPTwoSided})`,
      );
    }
    if (r.wsrSign !== -1 && r.wsrSign !== 0 && r.wsrSign !== 1) {
      throw new Error(
        `classifyPairedSignWsrRobustnessAgreement: wsrSign must be -1, 0, or 1 for source '${r.source}'`,
      );
    }
    if (
      !Number.isFinite(r.wsrRankBiserial) ||
      r.wsrRankBiserial < -1 ||
      r.wsrRankBiserial > 1
    ) {
      throw new Error(
        `classifyPairedSignWsrRobustnessAgreement: wsrRankBiserial must be finite in [-1, 1] for source '${r.source}' (got ${r.wsrRankBiserial})`,
      );
    }
  }

  const pstByName = new Map<string, PairedSignRowForWsrJoin>();
  for (const r of pstRows) pstByName.set(r.source, r);
  const wsrByName = new Map<string, WsrRowForPairedSignJoin>();
  for (const r of wsrRows) wsrByName.set(r.source, r);

  const sourcesOnlyInPst: string[] = [];
  const sourcesOnlyInWsr: string[] = [];
  for (const r of pstRows) {
    if (!wsrByName.has(r.source)) sourcesOnlyInPst.push(r.source);
  }
  for (const r of wsrRows) {
    if (!pstByName.has(r.source)) sourcesOnlyInWsr.push(r.source);
  }
  sourcesOnlyInPst.sort();
  sourcesOnlyInWsr.sort();

  const rows: ClassifiedPairedSignWsrRow[] = [];
  const bucketCounts: Record<PairedSignWsrCompoundBucket, number> = {
    'both-decisive-second-larger': 0,
    'both-decisive-first-larger': 0,
    'wsr-only-decisive-second-larger': 0,
    'wsr-only-decisive-first-larger': 0,
    'sign-only-decisive-second-larger': 0,
    'sign-only-decisive-first-larger': 0,
    'sign-conflict': 0,
    'no-decisive-shift': 0,
  };
  let bothDecisiveAgreement = 0;
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  let signConflicts = 0;
  let wsrOnlyButRobustVeto = 0;
  let signOnly = 0;

  for (const p of pstRows) {
    const w = wsrByName.get(p.source);
    if (!w) continue;
    const pDecisive = p.pstPTwoSided <= ALPHA;
    const wDecisive = w.wsrPTwoSided <= ALPHA;
    let bucket: PairedSignWsrCompoundBucket;
    if (pDecisive && wDecisive) {
      bothDecisive += 1;
      atLeastOneDecisive += 1;
      const signsAgree =
        (p.pstSign > 0 && w.wsrSign > 0) ||
        (p.pstSign < 0 && w.wsrSign < 0);
      const dir = p.pstSign !== 0 ? p.pstSign : w.wsrSign;
      if (signsAgree) {
        bothDecisiveAgreement += 1;
        bucket =
          dir > 0
            ? 'both-decisive-second-larger'
            : 'both-decisive-first-larger';
      } else if (p.pstSign === 0 || w.wsrSign === 0) {
        // pathological: one of the two stats sits exactly
        // at its mean. Defer direction to whichever side
        // is non-zero; if both zero, treat as sign-conflict.
        if (p.pstSign === 0 && w.wsrSign === 0) {
          bucket = 'sign-conflict';
          signConflicts += 1;
        } else {
          bothDecisiveAgreement += 1;
          bucket =
            dir > 0
              ? 'both-decisive-second-larger'
              : 'both-decisive-first-larger';
        }
      } else {
        bucket = 'sign-conflict';
        signConflicts += 1;
      }
    } else if (wDecisive) {
      atLeastOneDecisive += 1;
      wsrOnlyButRobustVeto += 1;
      bucket =
        w.wsrSign > 0
          ? 'wsr-only-decisive-second-larger'
          : 'wsr-only-decisive-first-larger';
    } else if (pDecisive) {
      atLeastOneDecisive += 1;
      signOnly += 1;
      bucket =
        p.pstSign > 0
          ? 'sign-only-decisive-second-larger'
          : 'sign-only-decisive-first-larger';
    } else {
      bucket = 'no-decisive-shift';
    }
    bucketCounts[bucket] += 1;
    rows.push({
      source: p.source,
      pstPTwoSided: p.pstPTwoSided,
      pstSign: p.pstSign,
      pstDelta: p.pstDelta,
      wsrPTwoSided: w.wsrPTwoSided,
      wsrSign: w.wsrSign,
      wsrRankBiserial: w.wsrRankBiserial,
      bucket,
    });
  }
  rows.sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0));

  return {
    rows,
    bucketCounts,
    bothDecisiveAgreement,
    bothDecisive,
    atLeastOneDecisive,
    signConflicts,
    wsrOnlyButRobustVeto,
    signOnly,
    sourcesOnlyInPst,
    sourcesOnlyInWsr,
  };
}
