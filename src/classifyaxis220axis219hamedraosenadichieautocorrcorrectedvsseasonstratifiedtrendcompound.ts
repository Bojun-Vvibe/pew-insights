/**
 * classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound:
 * cross-axis 4-quadrant diagnostic joining the v0.6.546
 * axis-220 HAMED-RAO 1998 AUTOCORRELATION-CORRECTED MANN-
 * KENDALL (`hrZ`, `hrPValue`, `hrTau`, `hrEta`) with the
 * v0.6.543 axis-219 SEN-ADICHIE 1967 ALIGNED RANK TREND
 * TEST (`saZ`, `saPValue`, `saRho`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes test for MONOTONE TREND on
 * the gap-filled daily total_tokens series and emit a
 * SIGNED standardised statistic. They differ ON HOW THEY
 * HANDLE SERIAL DEPENDENCE:
 *
 *   - axis-220 HAMED-RAO: UNSTRATIFIED Mann-Kendall S on
 *     the full n-series, with the null variance INFLATED
 *     by the OBSERVED rank-autocorrelation function across
 *     ALL significant lags 1..n-3. Captures ALL serial
 *     dependence (AR(1), period-7, longer memory) AS A
 *     VARIANCE CORRECTION.
 *
 *   - axis-219 SEN-ADICHIE: SEASON-STRATIFIED L_2 aligned-
 *     rank inner product across 7 weekday cohorts, with
 *     the null variance computed UNDER THE WORKING
 *     ASSUMPTION OF CROSS-COHORT INDEPENDENCE. Implicitly
 *     handles ONLY the period-7 component of serial
 *     dependence BY PARTITIONING; longer-memory
 *     autocorrelation is NOT folded into the null.
 *
 * Hamed-Rao vs Sen-Adichie is therefore the
 * SERIAL-DEPENDENCE-HANDLING dual of the season-
 * stratification axis. AGREEMENT in sign and decisiveness
 * indicates trend signal that is ROBUST TO BOTH the
 * autocorrelation correction AND the seasonal
 * stratification -- the strongest possible evidence for
 * monotone trend on this surface. CONFLICT is diagnostic:
 *
 *   - hr-only (decisive Hamed-Rao, non-decisive Sen-
 *     Adichie): the trend is dominated by CROSS-COHORT
 *     mean shift (which Sen-Adichie removes by alignment)
 *     and survives the autocorrelation correction.
 *   - sa-only (decisive Sen-Adichie, non-decisive Hamed-
 *     Rao): the trend lives WITHIN weekday cohorts and the
 *     overall MK statistic is too small after the
 *     autocorrelation inflation -- common when within-
 *     cohort trend is consistent but cross-cohort
 *     positions cancel each other out under the
 *     unstratified MK.
 *   - sign conflict (both decisive, opposite sign): a
 *     STRUCTURAL ANOMALY -- the unstratified S and the
 *     season-stratified rank inner product point in
 *     opposite directions. Typically caused by a strong
 *     period-7 AMPLITUDE pattern (one weekday cohort
 *     dominates) that drives unstratified MK in one
 *     direction while the within-cohort-aligned ranks
 *     trend the other.
 *
 * 4-QUADRANT SIGNED COMPOUND. Both axes are SIGNED, so
 * we use the classic direction-conflict scheme (axis-217
 * x axis-214, axis-213 x axis-212, axis-209 x axis-208,
 * axis-219 x axis-218, etc.):
 *
 * ```
 * 'agree-up'         hrDecisive AND saDecisive AND hrZ > 0 AND saZ > 0
 * 'agree-down'       hrDecisive AND saDecisive AND hrZ < 0 AND saZ < 0
 * 'conflict-hr-up'   hrDecisive AND saDecisive AND hrZ > 0 AND saZ < 0
 * 'conflict-hr-down' hrDecisive AND saDecisive AND hrZ < 0 AND saZ > 0
 * 'hr-only-up'       hrDecisive AND NOT saDecisive AND hrZ > 0
 * 'hr-only-down'     hrDecisive AND NOT saDecisive AND hrZ < 0
 * 'sa-only-up'       saDecisive AND NOT hrDecisive AND saZ > 0
 * 'sa-only-down'     saDecisive AND NOT hrDecisive AND saZ < 0
 * 'no-evidence'      neither decisive
 * ```
 *
 * Decisiveness:
 *   - hrDecisive  := hrPValue < alpha
 *   - saDecisive  := saPValue < alpha
 *
 * jointQuadrant is set ONLY when both axes are decisive,
 * to one of: 'agreeUp', 'agreeDown', 'conflictHrUp',
 * 'conflictHrDown'. Otherwise null.
 *
 * Determinism: pure transform.
 */

export interface HamedRaoMannKendallCorrectedRowForSenAdichieCompound {
  source: string;
  hrZ: number;
  hrPValue: number;
  hrTau: number;
  hrEta: number;
}

export interface SenAdichieAlignedRankTrendRowForHamedRaoCompound {
  source: string;
  saZ: number;
  saPValue: number;
  saRho: number;
}

export type Axis220Axis219HamedRaoSenAdichieBucket =
  | 'agree-up'
  | 'agree-down'
  | 'conflict-hr-up'
  | 'conflict-hr-down'
  | 'hr-only-up'
  | 'hr-only-down'
  | 'sa-only-up'
  | 'sa-only-down'
  | 'no-evidence';

export type Axis220Axis219HamedRaoSenAdichieJointQuadrant =
  | 'agreeUp'
  | 'agreeDown'
  | 'conflictHrUp'
  | 'conflictHrDown';

export interface Axis220Axis219HamedRaoSenAdichieJoinedRow {
  source: string;
  hrZ: number;
  hrPValue: number;
  hrTau: number;
  hrEta: number;
  saZ: number;
  saPValue: number;
  saRho: number;
  hrDecisive: boolean;
  saDecisive: boolean;
  bucket: Axis220Axis219HamedRaoSenAdichieBucket;
  jointQuadrant: Axis220Axis219HamedRaoSenAdichieJointQuadrant | null;
}

export interface Axis220Axis219HamedRaoSenAdichieReport {
  alpha: number;
  rows: Axis220Axis219HamedRaoSenAdichieJoinedRow[];
  bucketCounts: Record<Axis220Axis219HamedRaoSenAdichieBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointQuadrant: {
    agreeUp: number;
    agreeDown: number;
    conflictHrUp: number;
    conflictHrDown: number;
    anyMissingDecisive: number;
  };
  sourcesOnlyInHamedRao: string[];
  sourcesOnlyInSenAdichie: string[];
}

export function classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound(
  hamedRaoRows: HamedRaoMannKendallCorrectedRowForSenAdichieCompound[],
  senAdichieRows: SenAdichieAlignedRankTrendRowForHamedRaoCompound[],
  alpha = 0.05,
): Axis220Axis219HamedRaoSenAdichieReport {
  const fnName =
    'classifyAxis220Axis219HamedRaoSenAdichieAutocorrCorrectedVsSeasonStratifiedTrendCompound';
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new Error(`${fnName}: alpha must be in (0, 1) (got ${alpha})`);
  }
  if (!Array.isArray(hamedRaoRows)) {
    throw new Error(`${fnName}: hamedRaoRows must be an array`);
  }
  if (!Array.isArray(senAdichieRows)) {
    throw new Error(`${fnName}: senAdichieRows must be an array`);
  }

  const hrBySrc = new Map<
    string,
    HamedRaoMannKendallCorrectedRowForSenAdichieCompound
  >();
  for (const r of hamedRaoRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `${fnName}: hamed-rao row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.hrZ) ||
      !Number.isFinite(r.hrPValue) ||
      r.hrPValue < 0 ||
      r.hrPValue > 1 ||
      !Number.isFinite(r.hrTau) ||
      r.hrTau < -1.0000001 ||
      r.hrTau > 1.0000001 ||
      !Number.isFinite(r.hrEta) ||
      r.hrEta < 1 - 1e-9
    ) {
      throw new Error(
        `${fnName}: hamed-rao row '${r.source}' has invalid hrZ/hrPValue/hrTau/hrEta`,
      );
    }
    if (hrBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate hamed-rao source '${r.source}'`);
    }
    hrBySrc.set(r.source, r);
  }

  const saBySrc = new Map<
    string,
    SenAdichieAlignedRankTrendRowForHamedRaoCompound
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

  const sourcesOnlyInHamedRao: string[] = [];
  const sourcesOnlyInSenAdichie: string[] = [];
  for (const s of hrBySrc.keys()) {
    if (!saBySrc.has(s)) sourcesOnlyInHamedRao.push(s);
  }
  for (const s of saBySrc.keys()) {
    if (!hrBySrc.has(s)) sourcesOnlyInSenAdichie.push(s);
  }
  sourcesOnlyInHamedRao.sort();
  sourcesOnlyInSenAdichie.sort();

  const joinedSources: string[] = [];
  for (const s of hrBySrc.keys()) {
    if (saBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis220Axis219HamedRaoSenAdichieJoinedRow[] = [];
  const bucketCounts: Record<Axis220Axis219HamedRaoSenAdichieBucket, number> = {
    'agree-up': 0,
    'agree-down': 0,
    'conflict-hr-up': 0,
    'conflict-hr-down': 0,
    'hr-only-up': 0,
    'hr-only-down': 0,
    'sa-only-up': 0,
    'sa-only-down': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  const byJointQuadrant = {
    agreeUp: 0,
    agreeDown: 0,
    conflictHrUp: 0,
    conflictHrDown: 0,
    anyMissingDecisive: 0,
  };

  for (const src of joinedSources) {
    const hr = hrBySrc.get(src)!;
    const sa = saBySrc.get(src)!;
    const hrDecisive = hr.hrPValue < alpha;
    const saDecisive = sa.saPValue < alpha;
    const anyDecisive = hrDecisive || saDecisive;
    if (hrDecisive && saDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    let bucket: Axis220Axis219HamedRaoSenAdichieBucket;
    let jointQuadrant: Axis220Axis219HamedRaoSenAdichieJointQuadrant | null =
      null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointQuadrant.anyMissingDecisive += 1;
    } else if (hrDecisive && !saDecisive) {
      bucket = hr.hrZ >= 0 ? 'hr-only-up' : 'hr-only-down';
      byJointQuadrant.anyMissingDecisive += 1;
    } else if (saDecisive && !hrDecisive) {
      bucket = sa.saZ >= 0 ? 'sa-only-up' : 'sa-only-down';
      byJointQuadrant.anyMissingDecisive += 1;
    } else {
      // both decisive
      const hrUp = hr.hrZ >= 0;
      const saUp = sa.saZ >= 0;
      if (hrUp && saUp) {
        bucket = 'agree-up';
        jointQuadrant = 'agreeUp';
        byJointQuadrant.agreeUp += 1;
      } else if (!hrUp && !saUp) {
        bucket = 'agree-down';
        jointQuadrant = 'agreeDown';
        byJointQuadrant.agreeDown += 1;
      } else if (hrUp && !saUp) {
        bucket = 'conflict-hr-up';
        jointQuadrant = 'conflictHrUp';
        byJointQuadrant.conflictHrUp += 1;
      } else {
        bucket = 'conflict-hr-down';
        jointQuadrant = 'conflictHrDown';
        byJointQuadrant.conflictHrDown += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      hrZ: hr.hrZ,
      hrPValue: hr.hrPValue,
      hrTau: hr.hrTau,
      hrEta: hr.hrEta,
      saZ: sa.saZ,
      saPValue: sa.saPValue,
      saRho: sa.saRho,
      hrDecisive,
      saDecisive,
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
    sourcesOnlyInHamedRao,
    sourcesOnlyInSenAdichie,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis220Axis219HamedRaoSenAdichieReport.
 */
export function summarizeAxis220Axis219HamedRaoSenAdichieReport(
  report: Axis220Axis219HamedRaoSenAdichieReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const q = report.byJointQuadrant;
  const b = report.bucketCounts;
  return (
    `axis-220xaxis-219 alpha=${a} n=${n} both=${report.bothDecisive}/${n} ` +
    `qd[au/ad/cu/cd]=${q.agreeUp}/${q.agreeDown}/${q.conflictHrUp}/${q.conflictHrDown} ` +
    `buckets[au/ad/cu/cd/hou/hod/sou/sod/ne]=${b['agree-up']}/${b['agree-down']}/${b['conflict-hr-up']}/${b['conflict-hr-down']}/${b['hr-only-up']}/${b['hr-only-down']}/${b['sa-only-up']}/${b['sa-only-down']}/${b['no-evidence']}`
  );
}
