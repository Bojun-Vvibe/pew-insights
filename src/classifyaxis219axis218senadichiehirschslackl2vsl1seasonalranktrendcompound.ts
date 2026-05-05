/**
 * classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound:
 * cross-axis 4-quadrant diagnostic joining the v0.6.543
 * axis-219 SEN-ADICHIE 1967 ALIGNED RANK TREND TEST
 * (`saZ`, `saPValue`, `saRho`) with the v0.6.540 axis-218
 * HIRSCH-SLACK 1984 SEASONAL MANN-KENDALL TREND TEST
 * (`hsZ`, `hsPValue`, `hsTau`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes are SEASON-STRATIFIED rank
 * trend tests with period s = 7 and the SAME WORKING
 * NULL (no within-cohort monotone trend; cross-cohort
 * independence). They differ only in the RANK-INFLUENCE
 * FUNCTION applied per cohort:
 *
 *   - axis-218 HIRSCH-SLACK: per-cohort Kendall S =
 *     sum_{j<k} sign(x_k - x_j). Each concordant pair
 *     contributes +/- 1 regardless of rank gap. L_1-style
 *     sign-count influence. Robust to ties; equally
 *     weighted across all pairs.
 *
 *   - axis-219 SEN-ADICHIE: per-cohort linear-rank inner
 *     product L_g = sum_j (j - meanT_g) * (R_j -
 *     (n_g+1)/2). Each within-cohort observation
 *     contributes a product of CENTERED rank * CENTERED
 *     time position. L_2-style rank-magnitude influence.
 *     EXTREME within-cohort rank departures (R_j near 1
 *     or n_g) at extreme time positions (j near 0 or
 *     n_g - 1) contribute most.
 *
 * Hirsch-Slack vs Sen-Adichie is the SEASONAL-STRATIFIED
 * analogue of MANN-KENDALL vs SPEARMAN: both detect the
 * same monotone alternative, with KNOWN ARE (asymptotic
 * relative efficiency) of 9/pi^2 ~ 0.912 for Mann-Kendall
 * relative to Spearman under Gaussian alternatives
 * (Stuart 1954 *Biometrika* 41(1/2):275). The compound
 * classifier formalises three regimes: SIGN-AGREEMENT,
 * SIGN-CONFLICT, and STRENGTH-DIVERGENCE.
 *
 * 4-QUADRANT SIGNED COMPOUND. Both axes are SIGNED, so
 * we use the classic direction-conflict scheme (axis-217
 * x axis-214, axis-213 x axis-212, axis-209 x axis-208,
 * etc.):
 *
 * ```
 * 'agree-up'         saDecisive AND hsDecisive AND saZ > 0 AND hsZ > 0
 * 'agree-down'       saDecisive AND hsDecisive AND saZ < 0 AND hsZ < 0
 * 'conflict-sa-up'   saDecisive AND hsDecisive AND saZ > 0 AND hsZ < 0
 * 'conflict-sa-down' saDecisive AND hsDecisive AND saZ < 0 AND hsZ > 0
 * 'sa-only-up'       saDecisive AND NOT hsDecisive AND saZ > 0
 * 'sa-only-down'     saDecisive AND NOT hsDecisive AND saZ < 0
 * 'hs-only-up'       hsDecisive AND NOT saDecisive AND hsZ > 0
 * 'hs-only-down'     hsDecisive AND NOT saDecisive AND hsZ < 0
 * 'no-evidence'      neither decisive
 * ```
 *
 * Decisiveness:
 *   - saDecisive  := saPValue < alpha
 *   - hsDecisive  := hsPValue < alpha
 *
 * Sign convention: positive = within-cohort trend UP
 * across weeks; negative = trend DOWN. AGREEMENT in sign
 * is the EXPECTED outcome under any genuine within-cohort
 * monotone trend (both tests detect the same
 * alternative). CONFLICT in sign is a STRUCTURAL
 * ANOMALY: it indicates that the L_1 sign-count and the
 * L_2 rank-magnitude views of the SAME cohorts disagree
 * on direction -- typically because a small number of
 * extreme rank departures dominate the L_2 inner product
 * in one direction while the L_1 sign count tilts the
 * other way (e.g. one or two within-cohort outlier weeks
 * with extreme ranks reverse Sen-Adichie while the
 * majority of pairwise concordances under Hirsch-Slack
 * still point opposite).
 *
 * jointQuadrant is set ONLY when both axes are decisive,
 * to one of: 'agreeUp', 'agreeDown', 'conflictSaUp',
 * 'conflictSaDown'. Otherwise null.
 *
 * Determinism: pure transform.
 */

export interface SenAdichieAlignedRankTrendRowForHirschSlackCompound {
  source: string;
  saZ: number;
  saPValue: number;
  saRho: number;
}

export interface HirschSlackSeasonalKendallRowForSenAdichieCompound {
  source: string;
  hsZ: number;
  hsPValue: number;
  hsTau: number;
}

export type Axis219Axis218SenAdichieHirschSlackBucket =
  | 'agree-up'
  | 'agree-down'
  | 'conflict-sa-up'
  | 'conflict-sa-down'
  | 'sa-only-up'
  | 'sa-only-down'
  | 'hs-only-up'
  | 'hs-only-down'
  | 'no-evidence';

export type Axis219Axis218SenAdichieHirschSlackJointQuadrant =
  | 'agreeUp'
  | 'agreeDown'
  | 'conflictSaUp'
  | 'conflictSaDown';

export interface Axis219Axis218SenAdichieHirschSlackJoinedRow {
  source: string;
  saZ: number;
  saPValue: number;
  saRho: number;
  hsZ: number;
  hsPValue: number;
  hsTau: number;
  saDecisive: boolean;
  hsDecisive: boolean;
  bucket: Axis219Axis218SenAdichieHirschSlackBucket;
  jointQuadrant: Axis219Axis218SenAdichieHirschSlackJointQuadrant | null;
}

export interface Axis219Axis218SenAdichieHirschSlackReport {
  alpha: number;
  rows: Axis219Axis218SenAdichieHirschSlackJoinedRow[];
  bucketCounts: Record<Axis219Axis218SenAdichieHirschSlackBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointQuadrant: {
    agreeUp: number;
    agreeDown: number;
    conflictSaUp: number;
    conflictSaDown: number;
    anyMissingDecisive: number;
  };
  sourcesOnlyInSenAdichie: string[];
  sourcesOnlyInHirschSlack: string[];
}

export function classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound(
  senAdichieRows: SenAdichieAlignedRankTrendRowForHirschSlackCompound[],
  hirschSlackRows: HirschSlackSeasonalKendallRowForSenAdichieCompound[],
  alpha = 0.05,
): Axis219Axis218SenAdichieHirschSlackReport {
  const fnName =
    'classifyAxis219Axis218SenAdichieHirschSlackL2VsL1SeasonalRankTrendCompound';
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new Error(`${fnName}: alpha must be in (0, 1) (got ${alpha})`);
  }
  if (!Array.isArray(senAdichieRows)) {
    throw new Error(`${fnName}: senAdichieRows must be an array`);
  }
  if (!Array.isArray(hirschSlackRows)) {
    throw new Error(`${fnName}: hirschSlackRows must be an array`);
  }

  const saBySrc = new Map<
    string,
    SenAdichieAlignedRankTrendRowForHirschSlackCompound
  >();
  for (const r of senAdichieRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `${fnName}: sen-adichie row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.saZ) ||
      !Number.isFinite(r.saPValue) ||
      r.saPValue < 0 ||
      r.saPValue > 1 ||
      !Number.isFinite(r.saRho) ||
      r.saRho < -1.0000001 ||
      r.saRho > 1.0000001
    ) {
      throw new Error(
        `${fnName}: sen-adichie row '${r.source}' has invalid saZ/saPValue/saRho`,
      );
    }
    if (saBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate sen-adichie source '${r.source}'`);
    }
    saBySrc.set(r.source, r);
  }

  const hsBySrc = new Map<
    string,
    HirschSlackSeasonalKendallRowForSenAdichieCompound
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
      r.hsPValue < 0 ||
      r.hsPValue > 1 ||
      !Number.isFinite(r.hsTau) ||
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

  const sourcesOnlyInSenAdichie: string[] = [];
  const sourcesOnlyInHirschSlack: string[] = [];
  for (const s of saBySrc.keys()) {
    if (!hsBySrc.has(s)) sourcesOnlyInSenAdichie.push(s);
  }
  for (const s of hsBySrc.keys()) {
    if (!saBySrc.has(s)) sourcesOnlyInHirschSlack.push(s);
  }
  sourcesOnlyInSenAdichie.sort();
  sourcesOnlyInHirschSlack.sort();

  const joinedSources: string[] = [];
  for (const s of saBySrc.keys()) {
    if (hsBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis219Axis218SenAdichieHirschSlackJoinedRow[] = [];
  const bucketCounts: Record<Axis219Axis218SenAdichieHirschSlackBucket, number> = {
    'agree-up': 0,
    'agree-down': 0,
    'conflict-sa-up': 0,
    'conflict-sa-down': 0,
    'sa-only-up': 0,
    'sa-only-down': 0,
    'hs-only-up': 0,
    'hs-only-down': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  const byJointQuadrant = {
    agreeUp: 0,
    agreeDown: 0,
    conflictSaUp: 0,
    conflictSaDown: 0,
    anyMissingDecisive: 0,
  };

  for (const src of joinedSources) {
    const sa = saBySrc.get(src)!;
    const hs = hsBySrc.get(src)!;
    const saDecisive = sa.saPValue < alpha;
    const hsDecisive = hs.hsPValue < alpha;
    const anyDecisive = saDecisive || hsDecisive;
    if (saDecisive && hsDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    let bucket: Axis219Axis218SenAdichieHirschSlackBucket;
    let jointQuadrant: Axis219Axis218SenAdichieHirschSlackJointQuadrant | null =
      null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointQuadrant.anyMissingDecisive += 1;
    } else if (saDecisive && !hsDecisive) {
      bucket = sa.saZ >= 0 ? 'sa-only-up' : 'sa-only-down';
      byJointQuadrant.anyMissingDecisive += 1;
    } else if (hsDecisive && !saDecisive) {
      bucket = hs.hsZ >= 0 ? 'hs-only-up' : 'hs-only-down';
      byJointQuadrant.anyMissingDecisive += 1;
    } else {
      // both decisive
      const saUp = sa.saZ >= 0;
      const hsUp = hs.hsZ >= 0;
      if (saUp && hsUp) {
        bucket = 'agree-up';
        jointQuadrant = 'agreeUp';
        byJointQuadrant.agreeUp += 1;
      } else if (!saUp && !hsUp) {
        bucket = 'agree-down';
        jointQuadrant = 'agreeDown';
        byJointQuadrant.agreeDown += 1;
      } else if (saUp && !hsUp) {
        bucket = 'conflict-sa-up';
        jointQuadrant = 'conflictSaUp';
        byJointQuadrant.conflictSaUp += 1;
      } else {
        bucket = 'conflict-sa-down';
        jointQuadrant = 'conflictSaDown';
        byJointQuadrant.conflictSaDown += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      saZ: sa.saZ,
      saPValue: sa.saPValue,
      saRho: sa.saRho,
      hsZ: hs.hsZ,
      hsPValue: hs.hsPValue,
      hsTau: hs.hsTau,
      saDecisive,
      hsDecisive,
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
    sourcesOnlyInSenAdichie,
    sourcesOnlyInHirschSlack,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis219Axis218SenAdichieHirschSlackReport.
 */
export function summarizeAxis219Axis218SenAdichieHirschSlackReport(
  report: Axis219Axis218SenAdichieHirschSlackReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const q = report.byJointQuadrant;
  const b = report.bucketCounts;
  return (
    `axis-219xaxis-218 alpha=${a} n=${n} both=${report.bothDecisive}/${n} ` +
    `qd[au/ad/cu/cd]=${q.agreeUp}/${q.agreeDown}/${q.conflictSaUp}/${q.conflictSaDown} ` +
    `buckets[au/ad/cu/cd/sou/sod/hou/hod/ne]=${b['agree-up']}/${b['agree-down']}/${b['conflict-sa-up']}/${b['conflict-sa-down']}/${b['sa-only-up']}/${b['sa-only-down']}/${b['hs-only-up']}/${b['hs-only-down']}/${b['no-evidence']}`
  );
}
