/**
 * classifyAxis216Axis215BuysBallotCoxStuartThirdsWeekdayPeriodicityVsHeadVsTailTrendCompound:
 * cross-axis 6-bucket diagnostic joining axis-216
 * BUYS-BALLOT 1847 PERIOD-7 ONE-WAY ANOVA F-TEST
 * (`bbF`, `bbEta2`, `bbPValue`) with axis-215 COX-STUART
 * 1955 sec. 5 THIRDS-VARIANT SIGN TEST (`csTZ`,
 * `csTPValue`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes are constructed from the
 * SAME gap-filled daily-token series, but they target
 * MAXIMALLY-OPPOSITE alternative hypotheses about how
 * the series departs from "iid noise about a constant
 * mean":
 *
 *   - BUYS-BALLOT (axis-216) is a PERIODIC-MEAN-
 *     STRUCTURE F-test at FIXED period 7 (weekday-of-
 *     week). It is sensitive to ANY non-trivial
 *     between-weekday mean shift INCLUDING non-monotone
 *     ones (e.g. only Saturday is high, all other days
 *     flat). It is INVARIANT under DETRENDING (linear
 *     trend leaves all 7 column means equally affected
 *     on average) and so is BLIND TO HEAD-VS-TAIL
 *     LOCATION SHIFT.
 *
 *       bbDecisive = bbPValue < alpha
 *       bbWeekdayEffectPresent = bbDecisive
 *
 *     bbF and bbEta2 are NON-NEGATIVE; the test is
 *     one-sided.
 *
 *   - COX-STUART THIRDS (axis-215) is a SIGN-TEST on
 *     paired differences x[i + ceil(2n/3)] - x[i] for
 *     i = 0..floor(n/3)-1, deliberately DROPPING THE
 *     MIDDLE THIRD. It is sensitive to MONOTONE HEAD-
 *     VS-TAIL LOCATION SHIFT (the late third
 *     systematically larger or smaller than the early
 *     third) and is INSENSITIVE TO PERIODIC STRUCTURE
 *     within either third (an even period-7 swing
 *     within both early and late thirds cancels at the
 *     2*n/3-day lag).
 *
 *       csTDecisive = csTPValue < alpha
 *       csTUpDriftSignal = +csTZ   (positive = up,
 *                                   negative = down)
 *
 * STRUCTURAL ORTHOGONALITY at four levels:
 *
 *   - DIFFERENT NULL DEPARTURE TARGETED.
 *     Buys-Ballot rejects when between-weekday mean
 *     variance dominates within-weekday residual
 *     variance. Cox-Stuart-thirds rejects when the
 *     HEAD vs TAIL location difference at lag
 *     ceil(2n/3) is systematically signed. The two
 *     statistics are mutually orthogonal in the sense
 *     that detrending the series leaves bbF unchanged
 *     and de-seasoning by subtracting the column mean
 *     leaves csTZ approximately unchanged (the column-
 *     mean subtraction is a constant within each column
 *     and so cancels under the lag-ceil(2n/3) pair-
 *     difference on average).
 *
 *   - DIFFERENT TIME-SCALE.
 *     Buys-Ballot is at the SHORT scale (period 7,
 *     within-week structure). Cox-Stuart-thirds is at
 *     the LONG scale (lag ~2*tenure/3, first-third vs
 *     last-third location). A series with strong weekly
 *     periodicity superimposed on a flat long-term mean
 *     has high bbF and zero csTZ; a series with a slow
 *     monotone drift but uniformly distributed noise
 *     across weekdays has low bbF and high |csTZ|.
 *
 *   - DIFFERENT DIRECTION SEMANTICS.
 *     Buys-Ballot's F is one-sided non-negative (the
 *     statistic carries no direction; it only asks "is
 *     there ANY weekday effect?"). Cox-Stuart-thirds is
 *     signed (csTZ > 0 = up-drift, csTZ < 0 = down-
 *     drift). The compound classifier therefore must
 *     bucket on (bbDecisive yes/no) x (csT direction
 *     up/down/non-decisive), giving 2*3 = 6 unambiguous
 *     buckets.
 *
 *   - DIFFERENT NULL DISTRIBUTION FAMILY.
 *     bbF ~ F(6, n - 7) under H0 of no weekday effect
 *     with iid Normal residuals (Scheffe 1959 sec. 2.4,
 *     exact F reference distribution). csTZ ~ N(0, 1)
 *     under H0 of no monotone trend via the binomial
 *     normal approximation on csTPlus ~ Bin(csTNonTies,
 *     1/2) (Cox-Stuart 1955 sec. 5 eq. 11; Hollander,
 *     Wolfe & Chicken 2014 sec. 3.1).
 *
 * Six buckets:
 *
 *     'weekday-and-up-drift'        bbDecisive AND csTDecisive AND csTZ > 0
 *     'weekday-and-down-drift'      bbDecisive AND csTDecisive AND csTZ < 0
 *     'weekday-only'                bbDecisive AND NOT csTDecisive
 *     'up-drift-only'               NOT bbDecisive AND csTDecisive AND csTZ > 0
 *     'down-drift-only'             NOT bbDecisive AND csTDecisive AND csTZ < 0
 *     'no-evidence'                 NOT bbDecisive AND NOT csTDecisive
 *
 * Ties in csTZ at exactly 0 (impossible from the live
 * estimator since csTNonTies >= 8 forces csTPlus to take
 * a discrete value half of which is non-integer when
 * csTNonTies is odd; the boundary csTZ == 0 corresponds
 * to csTPlus = csTNonTies / 2, which is integral only
 * when csTNonTies is even) are treated as up-drift by
 * convention: csTZ >= 0 ? up : down. This is a
 * documented choice; downstream consumers should treat
 * borderline csTZ as ambiguous.
 *
 * STRUCTURAL ORTHOGONALITY VS PRIOR COMPOUND
 * CLASSIFIERS in this suite:
 *
 *   - vs `classifyJonckheereTerpstraCoxStuartBlockVsPairTrendCompound`
 *     (axis-206 x axis-205): both axes there are
 *     SIGNED trend tests; no axis is a UNDIRECTED
 *     period-test. THIS classifier is the FIRST
 *     compound to pair a signed trend test with an
 *     UNDIRECTED ANOVA F-test, requiring the 2x3
 *     bucket scheme rather than the standard 4-quadrant
 *     direction-conflict scheme.
 *
 *   - vs `classifyAxis213Axis212PageLOlmsteadTukeyLocalBlockOrderingVsExtremalCornerTrendCompound`
 *     (axis-213 x axis-212): both axes there are
 *     SIGNED trend tests with a 4-quadrant direction
 *     comparison. THIS classifier abandons the
 *     direction-quadrant frame because the F-test
 *     contributes no direction.
 *
 *   - vs `classifyJonckheereTerpstraDanielsRankCorrelationCompound`
 *     and similar trend x trend classifiers: those test
 *     two MONOTONE alternatives. THIS classifier tests
 *     a PERIODIC alternative against a MONOTONE
 *     alternative -- the two are statistically and
 *     structurally orthogonal.
 *
 * Headline question:
 * **"For each source, does the gap-filled daily-token
 *   series exhibit (a) a statistically significant
 *   PERIOD-7 WEEKDAY-OF-WEEK MEAN STRUCTURE, (b) a
 *   statistically significant HEAD-VS-TAIL UP- or
 *   DOWN-DRIFT (Cox-Stuart thirds), (c) BOTH, or (d)
 *   NEITHER?"**
 *
 * References: see axis-216 (Buys-Ballot 1847; Brockwell
 * & Davis 1991 sec. 1.4; Wei 2006 sec. 2.7; Scheffe 1959
 * sec. 2.4; Numerical Recipes 3rd ed. sec. 6.4; Cohen
 * 1988 sec. 8.2.1) and axis-215 (Cox & Stuart 1955 JRSS-
 * B 17(1):222-228 sec. 5; Daniel 1990 sec. 2.2;
 * Hollander, Wolfe & Chicken 2014 sec. 3.1; Conover
 * 1999 p. 159).
 *
 * Determinism: pure function of the two input row
 * arrays; no I/O. Throws on duplicate sources or
 * malformed rows.
 */

export interface BuysBallotPeriod7AnovaRowForCoxStuartThirdsCompound {
  source: string;
  bbF: number;
  bbEta2: number;
  bbPValue: number;
}

export interface CoxStuartThirdsTrendRowForBuysBallotPeriod7AnovaCompound {
  source: string;
  csTZ: number;
  csTPValue: number;
}

export type Axis216Axis215BuysBallotCoxStuartThirdsBucket =
  | 'weekday-and-up-drift'
  | 'weekday-and-down-drift'
  | 'weekday-only'
  | 'up-drift-only'
  | 'down-drift-only'
  | 'no-evidence';

export interface Axis216Axis215BuysBallotCoxStuartThirdsJoinedRow {
  source: string;
  bbF: number;
  bbEta2: number;
  bbPValue: number;
  csTZ: number;
  csTPValue: number;
  bbDecisive: boolean;
  csTDecisive: boolean;
  /** +csTZ (positive = up-drift; native sign). */
  csTUpDriftSignal: number;
  bucket: Axis216Axis215BuysBallotCoxStuartThirdsBucket;
  /**
   * Joint quadrant when both axes are decisive:
   *   weekdayUp | weekdayDown
   * null when either axis is non-decisive.
   */
  jointQuadrant: 'weekdayUp' | 'weekdayDown' | null;
}

export interface Axis216Axis215BuysBallotCoxStuartThirdsReport {
  alpha: number;
  rows: Axis216Axis215BuysBallotCoxStuartThirdsJoinedRow[];
  bucketCounts: Record<Axis216Axis215BuysBallotCoxStuartThirdsBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointQuadrant: {
    weekdayUp: number;
    weekdayDown: number;
    anyMissingDecisive: number;
  };
  sourcesOnlyInBuysBallot: string[];
  sourcesOnlyInCoxStuartThirds: string[];
}

export function classifyAxis216Axis215BuysBallotCoxStuartThirdsWeekdayPeriodicityVsHeadVsTailTrendCompound(
  buysBallotRows: ReadonlyArray<BuysBallotPeriod7AnovaRowForCoxStuartThirdsCompound>,
  coxStuartThirdsRows: ReadonlyArray<CoxStuartThirdsTrendRowForBuysBallotPeriod7AnovaCompound>,
  alpha = 0.05,
): Axis216Axis215BuysBallotCoxStuartThirdsReport {
  const fnName =
    'classifyAxis216Axis215BuysBallotCoxStuartThirdsWeekdayPeriodicityVsHeadVsTailTrendCompound';
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(`${fnName}: alpha must be in (0, 0.5] (got ${alpha})`);
  }

  const bbBySrc = new Map<
    string,
    BuysBallotPeriod7AnovaRowForCoxStuartThirdsCompound
  >();
  for (const r of buysBallotRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `${fnName}: buys-ballot row has invalid source: ${r.source}`,
      );
    }
    if (
      Number.isNaN(r.bbF) ||
      r.bbF < 0 ||
      !Number.isFinite(r.bbEta2) ||
      r.bbEta2 < 0 ||
      r.bbEta2 > 1 ||
      !Number.isFinite(r.bbPValue) ||
      r.bbPValue < 0 ||
      r.bbPValue > 1
    ) {
      throw new Error(
        `${fnName}: buys-ballot row '${r.source}' has invalid bbF/bbEta2/bbPValue`,
      );
    }
    if (bbBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate buys-ballot source '${r.source}'`);
    }
    bbBySrc.set(r.source, r);
  }

  const csTBySrc = new Map<
    string,
    CoxStuartThirdsTrendRowForBuysBallotPeriod7AnovaCompound
  >();
  for (const r of coxStuartThirdsRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `${fnName}: cox-stuart-thirds row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.csTZ) ||
      !Number.isFinite(r.csTPValue) ||
      r.csTPValue <= 0 ||
      r.csTPValue > 1
    ) {
      throw new Error(
        `${fnName}: cox-stuart-thirds row '${r.source}' has invalid csTZ/csTPValue`,
      );
    }
    if (csTBySrc.has(r.source)) {
      throw new Error(
        `${fnName}: duplicate cox-stuart-thirds source '${r.source}'`,
      );
    }
    csTBySrc.set(r.source, r);
  }

  const sourcesOnlyInBuysBallot: string[] = [];
  const sourcesOnlyInCoxStuartThirds: string[] = [];
  for (const s of bbBySrc.keys()) {
    if (!csTBySrc.has(s)) sourcesOnlyInBuysBallot.push(s);
  }
  for (const s of csTBySrc.keys()) {
    if (!bbBySrc.has(s)) sourcesOnlyInCoxStuartThirds.push(s);
  }
  sourcesOnlyInBuysBallot.sort();
  sourcesOnlyInCoxStuartThirds.sort();

  const joinedSources: string[] = [];
  for (const s of bbBySrc.keys()) {
    if (csTBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis216Axis215BuysBallotCoxStuartThirdsJoinedRow[] = [];
  const bucketCounts: Record<
    Axis216Axis215BuysBallotCoxStuartThirdsBucket,
    number
  > = {
    'weekday-and-up-drift': 0,
    'weekday-and-down-drift': 0,
    'weekday-only': 0,
    'up-drift-only': 0,
    'down-drift-only': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  const byJointQuadrant = {
    weekdayUp: 0,
    weekdayDown: 0,
    anyMissingDecisive: 0,
  };

  for (const src of joinedSources) {
    const bb = bbBySrc.get(src)!;
    const csT = csTBySrc.get(src)!;
    const bbDecisive = bb.bbPValue < alpha;
    const csTDecisive = csT.csTPValue < alpha;
    const anyDecisive = bbDecisive || csTDecisive;
    if (bbDecisive && csTDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    const csTUpDriftSignal = csT.csTZ;
    // Convention: csTZ >= 0 -> up, csTZ < 0 -> down.
    const csTUp = csT.csTZ >= 0;

    let bucket: Axis216Axis215BuysBallotCoxStuartThirdsBucket;
    let jointQuadrant: 'weekdayUp' | 'weekdayDown' | null = null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointQuadrant.anyMissingDecisive += 1;
    } else if (bbDecisive && !csTDecisive) {
      bucket = 'weekday-only';
      byJointQuadrant.anyMissingDecisive += 1;
    } else if (csTDecisive && !bbDecisive) {
      bucket = csTUp ? 'up-drift-only' : 'down-drift-only';
      byJointQuadrant.anyMissingDecisive += 1;
    } else {
      // both decisive
      if (csTUp) {
        bucket = 'weekday-and-up-drift';
        jointQuadrant = 'weekdayUp';
        byJointQuadrant.weekdayUp += 1;
      } else {
        bucket = 'weekday-and-down-drift';
        jointQuadrant = 'weekdayDown';
        byJointQuadrant.weekdayDown += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      bbF: bb.bbF,
      bbEta2: bb.bbEta2,
      bbPValue: bb.bbPValue,
      csTZ: csT.csTZ,
      csTPValue: csT.csTPValue,
      bbDecisive,
      csTDecisive,
      csTUpDriftSignal,
      bucket,
      jointQuadrant,
    });
  }

  return {
    alpha,
    rows,
    bucketCounts,
    bothDecisive,
    atLeastOneDecisive,
    byJointQuadrant,
    sourcesOnlyInBuysBallot,
    sourcesOnlyInCoxStuartThirds,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis216Axis215BuysBallotCoxStuartThirdsReport.
 *
 *   axis-216xaxis-215 alpha=<a> n=<rows> both=<k>/<rows> jq[wUp/wDn]=a/b buckets[wUp/wDn/wo/upo/dno/ne]=...
 *
 * Pure deterministic; no I/O.
 */
export function summarizeAxis216Axis215BuysBallotCoxStuartThirdsReport(
  report: Axis216Axis215BuysBallotCoxStuartThirdsReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const q = report.byJointQuadrant;
  const b = report.bucketCounts;
  return (
    `axis-216xaxis-215 alpha=${a} n=${n} both=${report.bothDecisive}/${n} ` +
    `jq[wUp/wDn]=${q.weekdayUp}/${q.weekdayDown} ` +
    `buckets[wUp/wDn/wo/upo/dno/ne]=${b['weekday-and-up-drift']}/${b['weekday-and-down-drift']}/${b['weekday-only']}/${b['up-drift-only']}/${b['down-drift-only']}/${b['no-evidence']}`
  );
}
