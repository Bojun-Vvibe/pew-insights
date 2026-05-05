/**
 * classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound:
 * cross-axis 5-bucket diagnostic joining axis-206
 * JONCKHEERE 1954 / TERPSTRA 1952 ORDERED-ALTERNATIVE
 * RANK TEST (`jtZ`, `jtPValue`) with axis-205 COX &
 * STUART 1955 SIGN-OF-PAIRED-DIFFERENCES TREND TEST
 * (`csZ`, `csPValue`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes test for MONOTONIC TREND
 * over the entire tenure but use STRUCTURALLY DIFFERENT
 * primitives that give COMPLEMENTARY power against
 * different alternative shapes:
 *
 *   - JT (axis-206) partitions into k=4 chronological
 *     blocks and aggregates pairwise Mann-Whitney U
 *     across all 6 ordered block pairs -- a RANK
 *     U-AGGREGATE that is robust to within-block
 *     heterogeneity. jtZ > 0 = late blocks systematically
 *     OUTRANK early blocks.
 *
 *       jtTrendSignal = +jtZ   ( + = block-level
 *                                up-trend
 *                                - = block-level
 *                                down-trend )
 *
 *   - Cox-Stuart (axis-205) pairs v[i] with v[i+c] at
 *     lag c=ceil(n/2) -- a SINGLE FAR-PAIR-OFFSET probe
 *     that uses only floor(n/2) sign comparisons. csZ > 0
 *     = late half systematically above early.
 *
 *       csTrendSignal = +csZ   ( + = paired-sign
 *                                up-trend
 *                                - = paired-sign
 *                                down-trend )
 *
 * The two probes operate on the SAME GLOBAL trend null
 * but at DIFFERENT AGGREGATION SCALES (k=4 block
 * U-counts vs single far-paired sign counts). They can
 * AGREE -- a steady global up-drift produces jtZ >> 0
 * AND csZ >> 0 -- or DISAGREE in informative ways:
 *
 *   - A series with a single late-block burst (Q4 only
 *     elevated; Q1=Q2=Q3 flat at baseline) yields
 *     jtZ >> 0 (Q4 outranks all 3 earlier blocks in 3 of
 *     the 6 pairwise U-comparisons) but csZ ~ 0 (the
 *     v[i] / v[i+c] paired-sign null is not strongly
 *     violated when only the far-late tail is elevated
 *     and the early-late paired offset hits the burst
 *     only partially). The "late-burst signature".
 *
 *   - A series with linear up-drift over Q1-Q3 followed
 *     by a Q4 reversion to baseline yields csZ ~ 0
 *     (paired-sign cancellation when the lag-c offset
 *     spans the rise-and-revert) but jtZ MAY remain
 *     moderately positive (Q1 < Q2 < Q3 ordering
 *     dominates the U-sum). The "rise-and-revert
 *     signature".
 *
 *   - A series with a smooth global drift PLUS heavy
 *     within-day noise yields csZ marginal (paired-sign
 *     noise dominates) but jtZ >> 0 (block-aggregation
 *     averages out the within-block noise). The
 *     "noise-robust block detection" advantage.
 *
 *   - Both decisive with SIGN AGREEMENT
 *     -> coherent-global-trend (with direction tag).
 *     This is the unambiguous global-trend signature
 *     and the headline scalar payload.
 *
 *   - Both decisive with SIGN OPPOSITION (jtZ > 0 AND
 *     csZ < 0, or vice versa) -> sign-conflict. This
 *     is rare but indicates the series has block-level
 *     ordering that opposes the far-pair direction --
 *     typically a series with a late-tenure REVERSAL
 *     where the most recent few days are extreme but
 *     the block-aggregated trajectory still points the
 *     opposite way (or vice versa). Documented but
 *     handled as a separate bucket for audit.
 *
 * Buckets (alpha default 0.05):
 *
 *   - `coherent-global-trend` (with `coherentTrend
 *     Direction` = 'up' or 'down'): both decisive AND
 *     same sign on the trend axis.
 *   - `block-aggregate-only`: jt decisive, cs not --
 *     the noise-robust block detection or late-burst
 *     signature.
 *   - `paired-sign-only`: cs decisive, jt not -- the
 *     paired-design global-shift signature (rare since
 *     JT is generally more powerful).
 *   - `sign-conflict-decisive-both`: both decisive but
 *     opposite signs on the trend axis -- the late-
 *     tenure reversal signature.
 *   - `no-evidence`: neither decisive.
 *
 * The `byCoherentDirection` cross-tab (#up vs #down
 * coherent-global-trend rows) is the headline scalar
 * payload and answers "of the sources that look
 * trending at BOTH the block-aggregate and paired-sign
 * scales, how many are going up vs down".
 *
 * Pure function: no I/O, deterministic source-asc
 * ordering, throws on duplicate sources, non-finite
 * inputs, p-values outside (0, 1], or alpha outside
 * (0, 0.5].
 *
 * Reference:
 *   Terpstra, T. J., "The asymptotic normality and
 *     consistency of Kendall's test against trend, when
 *     ties are present in one ranking",
 *     *Indagationes Mathematicae* 14 (1952), pp. 327-333.
 *   Jonckheere, A. R., "A distribution-free k-sample
 *     test against ordered alternatives",
 *     *Biometrika* 41 (1954), pp. 133-145.
 *   Cox, D. R. & Stuart, A., "Some quick sign tests
 *     for trend in location and dispersion",
 *     *Journal of the Royal Statistical Society: Series
 *     B (Methodological)* 17(1) (1955), pp. 222-228.
 *   Hollander, M., Wolfe, D. A. & Chicken, E.,
 *     *Nonparametric Statistical Methods*, 3rd ed.
 *     (Wiley 2014), secs. 3.1, 6.2.
 */

export interface JonckheereTerpstraRowForCoxStuartCompound {
  source: string;
  jtZ: number;
  jtPValue: number;
}

export interface CoxStuartRowForJonckheereTerpstraCompound {
  source: string;
  csZ: number;
  csPValue: number;
}

export type JonckheereTerpstraCoxStuartBlockVsPairTrendBucket =
  | 'coherent-global-trend'
  | 'block-aggregate-only'
  | 'paired-sign-only'
  | 'sign-conflict-decisive-both'
  | 'no-evidence';

export type JonckheereTerpstraCoxStuartCoherentDirection =
  | 'up'
  | 'down'
  | null;

export interface JonckheereTerpstraCoxStuartBlockVsPairTrendJoinedRow {
  source: string;
  jtZ: number;
  jtPValue: number;
  csZ: number;
  csPValue: number;
  jtDecisive: boolean;
  csDecisive: boolean;
  /** +jtZ in the trend-positive sign convention. */
  jtTrendSignal: number;
  /** +csZ in the trend-positive sign convention. */
  csTrendSignal: number;
  bucket: JonckheereTerpstraCoxStuartBlockVsPairTrendBucket;
  /** 'up' or 'down' when bucket = 'coherent-global-trend'; null otherwise. */
  coherentTrendDirection: JonckheereTerpstraCoxStuartCoherentDirection;
}

export interface JonckheereTerpstraCoxStuartBlockVsPairTrendReport {
  alpha: number;
  rows: JonckheereTerpstraCoxStuartBlockVsPairTrendJoinedRow[];
  bucketCounts: Record<
    JonckheereTerpstraCoxStuartBlockVsPairTrendBucket,
    number
  >;
  bothDecisive: number;
  atLeastOneDecisive: number;
  coherentRows: number;
  scaleSpecificRows: number;
  signConflictRows: number;
  byCoherentDirection: { up: number; down: number };
  sourcesOnlyInJonckheereTerpstra: string[];
  sourcesOnlyInCoxStuart: string[];
}

export function classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound(
  jonckheereTerpstraRows: ReadonlyArray<JonckheereTerpstraRowForCoxStuartCompound>,
  coxStuartRows: ReadonlyArray<CoxStuartRowForJonckheereTerpstraCompound>,
  alpha = 0.05,
): JonckheereTerpstraCoxStuartBlockVsPairTrendReport {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }

  const jtBySrc = new Map<
    string,
    JonckheereTerpstraRowForCoxStuartCompound
  >();
  for (const r of jonckheereTerpstraRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound: jonckheere-terpstra row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.jtZ) ||
      !Number.isFinite(r.jtPValue) ||
      r.jtPValue <= 0 ||
      r.jtPValue > 1
    ) {
      throw new Error(
        `classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound: jonckheere-terpstra row '${r.source}' has invalid jtZ/jtPValue`,
      );
    }
    if (jtBySrc.has(r.source)) {
      throw new Error(
        `classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound: duplicate jonckheere-terpstra source '${r.source}'`,
      );
    }
    jtBySrc.set(r.source, r);
  }

  const csBySrc = new Map<
    string,
    CoxStuartRowForJonckheereTerpstraCompound
  >();
  for (const r of coxStuartRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound: cox-stuart row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.csZ) ||
      !Number.isFinite(r.csPValue) ||
      r.csPValue <= 0 ||
      r.csPValue > 1
    ) {
      throw new Error(
        `classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound: cox-stuart row '${r.source}' has invalid csZ/csPValue`,
      );
    }
    if (csBySrc.has(r.source)) {
      throw new Error(
        `classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound: duplicate cox-stuart source '${r.source}'`,
      );
    }
    csBySrc.set(r.source, r);
  }

  const sourcesOnlyInJonckheereTerpstra: string[] = [];
  const sourcesOnlyInCoxStuart: string[] = [];
  for (const s of jtBySrc.keys()) {
    if (!csBySrc.has(s)) sourcesOnlyInJonckheereTerpstra.push(s);
  }
  for (const s of csBySrc.keys()) {
    if (!jtBySrc.has(s)) sourcesOnlyInCoxStuart.push(s);
  }
  sourcesOnlyInJonckheereTerpstra.sort();
  sourcesOnlyInCoxStuart.sort();

  const joinedSources: string[] = [];
  for (const s of jtBySrc.keys()) {
    if (csBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: JonckheereTerpstraCoxStuartBlockVsPairTrendJoinedRow[] = [];
  const bucketCounts: Record<
    JonckheereTerpstraCoxStuartBlockVsPairTrendBucket,
    number
  > = {
    'coherent-global-trend': 0,
    'block-aggregate-only': 0,
    'paired-sign-only': 0,
    'sign-conflict-decisive-both': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  let coherentRows = 0;
  let scaleSpecificRows = 0;
  let signConflictRows = 0;
  const byCoherentDirection = { up: 0, down: 0 };

  for (const src of joinedSources) {
    const jt = jtBySrc.get(src)!;
    const cs = csBySrc.get(src)!;
    const jtDecisive = jt.jtPValue < alpha;
    const csDecisive = cs.csPValue < alpha;
    const anyDecisive = jtDecisive || csDecisive;
    if (jtDecisive && csDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    const jtTrendSignal = jt.jtZ;
    const csTrendSignal = cs.csZ;

    let bucket: JonckheereTerpstraCoxStuartBlockVsPairTrendBucket;
    let coherentTrendDirection: JonckheereTerpstraCoxStuartCoherentDirection =
      null;
    if (!anyDecisive) {
      bucket = 'no-evidence';
    } else if (jtDecisive && !csDecisive) {
      bucket = 'block-aggregate-only';
      scaleSpecificRows += 1;
    } else if (csDecisive && !jtDecisive) {
      bucket = 'paired-sign-only';
      scaleSpecificRows += 1;
    } else {
      // both decisive: classify by sign agreement on
      // the trend-signal axes
      const jtSign = jtTrendSignal > 0 ? 1 : jtTrendSignal < 0 ? -1 : 0;
      const csSign = csTrendSignal > 0 ? 1 : csTrendSignal < 0 ? -1 : 0;
      if (jtSign !== 0 && csSign !== 0 && jtSign === csSign) {
        bucket = 'coherent-global-trend';
        coherentTrendDirection = jtSign > 0 ? 'up' : 'down';
        coherentRows += 1;
        if (jtSign > 0) byCoherentDirection.up += 1;
        else byCoherentDirection.down += 1;
      } else {
        bucket = 'sign-conflict-decisive-both';
        signConflictRows += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      jtZ: jt.jtZ,
      jtPValue: jt.jtPValue,
      csZ: cs.csZ,
      csPValue: cs.csPValue,
      jtDecisive,
      csDecisive,
      jtTrendSignal,
      csTrendSignal,
      bucket,
      coherentTrendDirection,
    });
  }

  return {
    alpha,
    rows,
    bucketCounts,
    bothDecisive,
    atLeastOneDecisive,
    coherentRows,
    scaleSpecificRows,
    signConflictRows,
    byCoherentDirection,
    sourcesOnlyInJonckheereTerpstra,
    sourcesOnlyInCoxStuart,
  };
}
