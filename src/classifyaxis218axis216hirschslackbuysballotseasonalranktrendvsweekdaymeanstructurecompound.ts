/**
 * classifyAxis218Axis216HirschSlackBuysBallotSeasonalRankTrendVsWeekdayMeanStructureCompound:
 * cross-axis 6-bucket diagnostic joining axis-218
 * HIRSCH-SLACK 1984 SEASONAL MANN-KENDALL TREND TEST
 * (`hsZ`, `hsPValue`, `hsTau`) with axis-216 BUYS-BALLOT
 * 1847 PERIOD-7 ONE-WAY ANOVA F-TEST (`bbF`, `bbEta2`,
 * `bbPValue`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. The two axes are MUTUALLY ORTHOGONAL
 * by construction: each tests an alternative that the
 * OTHER takes as a NUISANCE.
 *
 *   - HIRSCH-SLACK (axis-218) tests for WITHIN-WEEKDAY
 *     MONOTONE TREND under H0 of no within-cohort trend,
 *     stratifying away the weekday MEAN STRUCTURE that
 *     Buys-Ballot tests against. The test is INVARIANT
 *     under any per-cohort additive shift -- precisely
 *     the deformation that Buys-Ballot picks up.
 *
 *       hsTrendUpSignal = +hsZ   ( + = within-cohort
 *                                    trend UP across
 *                                    weeks,
 *                                  - = within-cohort
 *                                    trend DOWN )
 *
 *   - BUYS-BALLOT (axis-216) tests for WEEKDAY MEAN
 *     STRUCTURE under H0 of equal weekday means and is
 *     INVARIANT under within-column DETRENDING (columns
 *     are mean-centered before the F-statistic) -- the
 *     deformation that Hirsch-Slack picks up. F-tests
 *     are UNSIGNED: the alternative is "any departure
 *     from H0", with no notion of direction.
 *
 *       bbF >= 0; bbEta2 in [0, 1] is the proportion of
 *       within-source variance explained by the
 *       weekday-mean factor.
 *
 * Because Buys-Ballot is UNSIGNED, this compound DOES
 * NOT use a 4-quadrant direction-conflict scheme like
 * axis-217xaxis-214 or axis-213xaxis-212. Instead we
 * surface the SIX BUCKETS that capture the
 * presence/absence and (for axis-218) the direction of
 * each effect:
 *
 * ```
 * 'weekday-and-up-cohort-trend'   bbDecisive AND hsDecisive AND hsZ > 0
 * 'weekday-and-down-cohort-trend' bbDecisive AND hsDecisive AND hsZ < 0
 * 'weekday-only'                  bbDecisive AND NOT hsDecisive
 * 'up-cohort-trend-only'          hsDecisive AND NOT bbDecisive AND hsZ > 0
 * 'down-cohort-trend-only'        hsDecisive AND NOT bbDecisive AND hsZ < 0
 * 'no-evidence'                   neither decisive
 * ```
 *
 * Decisiveness:
 *   - bbDecisive  := bbPValue < alpha
 *   - hsDecisive  := hsPValue < alpha
 *
 * STRUCTURAL ORTHOGONALITY at four levels:
 *
 *   - DIFFERENT NULL DISTRIBUTION FAMILY.
 *     Buys-Ballot: F(6, n-7) under H0 of equal weekday
 *     means.
 *     Hirsch-Slack: N(0, 1) under H0 of no within-cohort
 *     trend with closed-form Var(S^{HS}) under
 *     independence-across-cohorts.
 *
 *   - DIFFERENT ALTERNATIVE.
 *     Buys-Ballot: any DEPARTURE from equal weekday
 *     means -- a SHIFT in periodic STRUCTURE.
 *     Hirsch-Slack: a within-cohort MONOTONE TREND --
 *     a SLOW DRIFT visible after stratifying away
 *     periodic structure.
 *
 *   - COMPLEMENTARY INVARIANCE.
 *     Buys-Ballot is INVARIANT under within-column
 *     DETRENDING (so it sees no within-cohort trend);
 *     Hirsch-Slack is INVARIANT under per-cohort
 *     additive SHIFTS (so it sees no weekday mean
 *     structure). Each axis is BLIND in the direction
 *     where the other is SENSITIVE.
 *
 *   - INDEPENDENT BUCKETS.
 *     A series with strong weekday step but no within-
 *     cohort trend lands in 'weekday-only'. A series
 *     with smooth monotone drift but no weekday
 *     structure lands in 'up-cohort-trend-only' or
 *     'down-cohort-trend-only'. A series with both
 *     lands in 'weekday-and-up-cohort-trend' or
 *     'weekday-and-down-cohort-trend'. The four
 *     decisive buckets cover the FOUR INDEPENDENT
 *     CORNERS of the (periodic, monotone) plane.
 *
 * Headline question:
 * **"For each source, does the gap-filled daily-token
 *   series exhibit (a) a statistically significant
 *   PERIOD-7 WEEKDAY-OF-WEEK MEAN STRUCTURE, (b) a
 *   statistically significant SEASONAL-STRATIFIED
 *   WITHIN-COHORT MONOTONE TREND, (c) BOTH, or (d)
 *   NEITHER?"**
 *
 * References: see axis-218 (Hirsch & Slack 1984; Mann
 * 1945; Kendall 1975 sec. 4.2; Abramowitz-Stegun 7.1.26)
 * and axis-216 (Buys-Ballot 1847; Brockwell & Davis
 * 1991 sec. 1.4; Wei 2006 sec. 2.7; Scheffe 1959 sec.
 * 2.4).
 *
 * Determinism: pure function of the two input row
 * arrays; no I/O. Throws on duplicate sources or
 * malformed rows.
 */

export interface HirschSlackSeasonalKendallRowForBuysBallotPeriod7AnovaCompound {
  source: string;
  hsZ: number;
  hsPValue: number;
  hsTau: number;
}

export interface BuysBallotPeriod7AnovaRowForHirschSlackSeasonalKendallCompound {
  source: string;
  bbF: number;
  bbEta2: number;
  bbPValue: number;
}

export type Axis218Axis216HirschSlackBuysBallotBucket =
  | 'weekday-and-up-cohort-trend'
  | 'weekday-and-down-cohort-trend'
  | 'weekday-only'
  | 'up-cohort-trend-only'
  | 'down-cohort-trend-only'
  | 'no-evidence';

export interface Axis218Axis216HirschSlackBuysBallotJoinedRow {
  source: string;
  hsZ: number;
  hsPValue: number;
  hsTau: number;
  bbF: number;
  bbEta2: number;
  bbPValue: number;
  hsDecisive: boolean;
  bbDecisive: boolean;
  /** +hsZ (positive = within-cohort up-trend; native sign). */
  hsTrendUpSignal: number;
  bucket: Axis218Axis216HirschSlackBuysBallotBucket;
  /**
   * Joint quadrant when both axes are decisive:
   *   weekdayUpCohortTrend | weekdayDownCohortTrend
   * null when either axis is non-decisive.
   */
  jointQuadrant:
    | 'weekdayUpCohortTrend'
    | 'weekdayDownCohortTrend'
    | null;
}

export interface Axis218Axis216HirschSlackBuysBallotReport {
  alpha: number;
  rows: Axis218Axis216HirschSlackBuysBallotJoinedRow[];
  bucketCounts: Record<Axis218Axis216HirschSlackBuysBallotBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointQuadrant: {
    weekdayUpCohortTrend: number;
    weekdayDownCohortTrend: number;
    anyMissingDecisive: number;
  };
  sourcesOnlyInHirschSlack: string[];
  sourcesOnlyInBuysBallot: string[];
}

export function classifyAxis218Axis216HirschSlackBuysBallotSeasonalRankTrendVsWeekdayMeanStructureCompound(
  hirschSlackRows: ReadonlyArray<HirschSlackSeasonalKendallRowForBuysBallotPeriod7AnovaCompound>,
  buysBallotRows: ReadonlyArray<BuysBallotPeriod7AnovaRowForHirschSlackSeasonalKendallCompound>,
  alpha = 0.05,
): Axis218Axis216HirschSlackBuysBallotReport {
  const fnName =
    'classifyAxis218Axis216HirschSlackBuysBallotSeasonalRankTrendVsWeekdayMeanStructureCompound';
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(`${fnName}: alpha must be in (0, 0.5] (got ${alpha})`);
  }

  const hsBySrc = new Map<
    string,
    HirschSlackSeasonalKendallRowForBuysBallotPeriod7AnovaCompound
  >();
  for (const r of hirschSlackRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `${fnName}: hirsch-slack row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.hsZ) ||
      !Number.isFinite(r.hsPValue) ||
      !Number.isFinite(r.hsTau) ||
      r.hsPValue < 0 ||
      r.hsPValue > 1 ||
      r.hsTau < -1.0000001 ||
      r.hsTau > 1.0000001
    ) {
      throw new Error(
        `${fnName}: hirsch-slack row '${r.source}' has invalid hsZ/hsPValue/hsTau`,
      );
    }
    if (hsBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate hirsch-slack source '${r.source}'`);
    }
    hsBySrc.set(r.source, r);
  }

  const bbBySrc = new Map<
    string,
    BuysBallotPeriod7AnovaRowForHirschSlackSeasonalKendallCompound
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

  const sourcesOnlyInHirschSlack: string[] = [];
  const sourcesOnlyInBuysBallot: string[] = [];
  for (const s of hsBySrc.keys()) {
    if (!bbBySrc.has(s)) sourcesOnlyInHirschSlack.push(s);
  }
  for (const s of bbBySrc.keys()) {
    if (!hsBySrc.has(s)) sourcesOnlyInBuysBallot.push(s);
  }
  sourcesOnlyInHirschSlack.sort();
  sourcesOnlyInBuysBallot.sort();

  const joinedSources: string[] = [];
  for (const s of hsBySrc.keys()) {
    if (bbBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis218Axis216HirschSlackBuysBallotJoinedRow[] = [];
  const bucketCounts: Record<Axis218Axis216HirschSlackBuysBallotBucket, number> = {
    'weekday-and-up-cohort-trend': 0,
    'weekday-and-down-cohort-trend': 0,
    'weekday-only': 0,
    'up-cohort-trend-only': 0,
    'down-cohort-trend-only': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  const byJointQuadrant = {
    weekdayUpCohortTrend: 0,
    weekdayDownCohortTrend: 0,
    anyMissingDecisive: 0,
  };

  for (const src of joinedSources) {
    const hs = hsBySrc.get(src)!;
    const bb = bbBySrc.get(src)!;
    const hsDecisive = hs.hsPValue < alpha;
    const bbDecisive = bb.bbPValue < alpha;
    const anyDecisive = hsDecisive || bbDecisive;
    if (hsDecisive && bbDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    const hsTrendUpSignal = hs.hsZ;

    let bucket: Axis218Axis216HirschSlackBuysBallotBucket;
    let jointQuadrant:
      | 'weekdayUpCohortTrend'
      | 'weekdayDownCohortTrend'
      | null = null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointQuadrant.anyMissingDecisive += 1;
    } else if (bbDecisive && !hsDecisive) {
      bucket = 'weekday-only';
      byJointQuadrant.anyMissingDecisive += 1;
    } else if (hsDecisive && !bbDecisive) {
      bucket = hs.hsZ >= 0 ? 'up-cohort-trend-only' : 'down-cohort-trend-only';
      byJointQuadrant.anyMissingDecisive += 1;
    } else {
      // both decisive
      if (hs.hsZ >= 0) {
        bucket = 'weekday-and-up-cohort-trend';
        jointQuadrant = 'weekdayUpCohortTrend';
        byJointQuadrant.weekdayUpCohortTrend += 1;
      } else {
        bucket = 'weekday-and-down-cohort-trend';
        jointQuadrant = 'weekdayDownCohortTrend';
        byJointQuadrant.weekdayDownCohortTrend += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      hsZ: hs.hsZ,
      hsPValue: hs.hsPValue,
      hsTau: hs.hsTau,
      bbF: bb.bbF,
      bbEta2: bb.bbEta2,
      bbPValue: bb.bbPValue,
      hsDecisive,
      bbDecisive,
      hsTrendUpSignal,
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
    sourcesOnlyInHirschSlack,
    sourcesOnlyInBuysBallot,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis218Axis216HirschSlackBuysBallotReport.
 *
 *   axis-218xaxis-216 alpha=<a> n=<rows> both=<k>/<rows> qd[wuc/wdc]=a/b buckets[wuc/wdc/wo/uo/do/ne]=...
 *
 * Pure deterministic; no I/O.
 */
export function summarizeAxis218Axis216HirschSlackBuysBallotReport(
  report: Axis218Axis216HirschSlackBuysBallotReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const q = report.byJointQuadrant;
  const b = report.bucketCounts;
  return (
    `axis-218xaxis-216 alpha=${a} n=${n} both=${report.bothDecisive}/${n} ` +
    `qd[wuc/wdc]=${q.weekdayUpCohortTrend}/${q.weekdayDownCohortTrend} ` +
    `buckets[wuc/wdc/wo/uo/do/ne]=${b['weekday-and-up-cohort-trend']}/${b['weekday-and-down-cohort-trend']}/${b['weekday-only']}/${b['up-cohort-trend-only']}/${b['down-cohort-trend-only']}/${b['no-evidence']}`
  );
}
