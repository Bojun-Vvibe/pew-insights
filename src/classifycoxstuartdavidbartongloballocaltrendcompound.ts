/**
 * classifyCoxStuartDavidBartonGlobalLocalTrendCompound:
 * cross-axis 7-bucket diagnostic joining axis-205
 * COX & STUART 1955 SIGN-OF-PAIRED-DIFFERENCES TREND
 * TEST (`csZ`, `csPValue`) with axis-203 DAVID & BARTON
 * 1958 RUNS-UP-AND-DOWN TEST (`dbZ`, `dbPValue`) on a
 * per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes target trend-vs-mean-
 * reversion in the daily token series but use
 * STRUCTURALLY DIFFERENT primitives at DIFFERENT
 * SCALES:
 *
 *   - Cox-Stuart pairs the early observation v[i] with
 *     v[i+c] at spacing c=ceil(n/2) -- a MAXIMALLY-
 *     DISTANT, GLOBAL trend probe. csZ > 0 = late half
 *     systematically above early = monotonic increasing
 *     trend over the WHOLE tenure.
 *
 *       csTrendSignal = + csZ   ( + = global UP-trend
 *                                 - = global DOWN-trend )
 *
 *   - David-Barton counts maximal RUNS of identically-
 *     signed first differences -- a LAG-1, LOCAL
 *     oscillation probe. dbZ < 0 = too few runs = long
 *     monotone stretches = lag-1 PERSISTENCE / TREND.
 *     We recode it on the trend-positive axis as
 *
 *       dbTrendSignal = - dbZ   ( + = lag-1 persistence
 *                                     / monotone runs
 *                                 - = lag-1 oscillation
 *                                     / mean-reversion )
 *
 * The two probes operate at MAXIMALLY DIFFERENT TIME
 * SCALES (lag c=ceil(n/2) vs lag 1). They can AGREE --
 * a steady global up-drift produces csZ >> 0 AND long
 * monotone runs (dbZ << 0, dbTrendSignal > 0) -- or
 * DISAGREE in informative ways:
 *
 *   - A series with sharp daily oscillations around a
 *     slowly-rising baseline yields csZ >> 0 (global
 *     trend) but dbZ >> 0 (lag-1 oscillation,
 *     dbTrendSignal < 0). The "mean-reverting noise on
 *     a drifting baseline" pattern.
 *
 *   - A series with a smooth zigzag at period ~ tenure
 *     (e.g. up the first quarter, down the next quarter,
 *     up the next, down the last) yields csZ ~ 0
 *     (global ends match starts) but dbZ << 0 (long
 *     monotone runs, dbTrendSignal > 0). The "smooth
 *     LOCAL persistence with NO global drift" pattern.
 *
 * Bucket map. Given per-source `csZ` (axis-205) and
 * `dbZ` (axis-203) with their two-sided p-values at
 * configurable alpha (default 0.05):
 *
 *   - 'coherent-trend': csTrendSignal > 0 (csZ > 0)
 *     AND dbTrendSignal > 0 (dbZ < 0) AND BOTH
 *     decisive at alpha. Trend regime detected
 *     consistently at both the global-pair scale and
 *     the lag-1 sign-run scale -- the strongest
 *     cross-scale evidence of directional drift. Also
 *     covers coherent DOWN-trend: csZ < 0 AND dbZ < 0
 *     AND both decisive (both "global down-trend AND
 *     local persistence"). The bucket discriminates
 *     direction in `coherentTrendDirection`.
 *   - 'global-trend-on-local-noise': csZ decisive in
 *     either direction AND dbTrendSignal < 0 (dbZ > 0,
 *     local oscillation) AND BOTH decisive at alpha.
 *     Globally trending baseline with high-frequency
 *     daily mean-reverting noise -- the canonical
 *     "drift + AR(1)-noise" signature.
 *   - 'local-persistence-no-global-trend': csZ NOT
 *     decisive AND dbTrendSignal > 0 (dbZ < 0) AND dbZ
 *     decisive at alpha. Long monotone day-to-day runs
 *     but NO net global drift -- a smooth multi-segment
 *     zigzag pattern. Visible to David-Barton, invisible
 *     to Cox-Stuart.
 *   - 'global-trend-only': csZ decisive AND dbZ NOT
 *     decisive. Global-pair trend visible but lag-1 sign
 *     runs look i.i.d. -- a noisy step-shift or a slow
 *     drift dominated by lag-1 noise.
 *   - 'local-oscillation-no-global-trend': csZ NOT
 *     decisive AND dbTrendSignal < 0 (dbZ > 0) AND dbZ
 *     decisive. Strong lag-1 mean-reversion with no
 *     global drift. The pure stationary-cyclic case.
 *   - 'global-trend-with-decisive-cs-only-dual-direction':
 *     reserved direction-conflict bucket -- triggered
 *     when Cox-Stuart is decisive AND DB is decisive
 *     AND the trend-signal product exactly opposes
 *     (csZ>0 with dbZ>0 indicating "up-global-trend
 *     AND lag-1-oscillation" -- this is the same as
 *     'global-trend-on-local-noise' upward-flavoured
 *     case which already lives there). Kept SOLELY for
 *     symmetry-completeness; in practice never assigned
 *     because the upstream branches consume it. Always
 *     0 in valid joins; documented for reviewer audit.
 *   - 'no-evidence': neither decisive at alpha.
 *
 * Returns the joined-row table plus aggregate counts
 * (`bothDecisive`, `atLeastOneDecisive`, `coherentRows`,
 * `crossScaleSplitRows`, `scaleSpecificRows`) and the
 * asymmetric source-membership lists. The
 * `byCoherentDirection` cross-tab (#up-trend coherent
 * vs #down-trend coherent) is the headline scalar
 * payload and answers "of the sources that look
 * trending at BOTH scales, how many are going up vs
 * down".
 *
 * Pure function: no I/O, deterministic source-asc
 * ordering, throws on duplicate sources, non-finite
 * inputs, p-values outside (0, 1], or alpha outside
 * (0, 0.5].
 *
 * Reference:
 *   Cox, D. R. & Stuart, A., "Some quick sign tests
 *     for trend in location and dispersion",
 *     *Journal of the Royal Statistical Society: Series
 *     B (Methodological)* 17(1) (1955), pp. 222-228.
 *   David, F. N. & Barton, D. E., "A test for birth-
 *     order effects", *Biometrika* 45(1-2) (1958),
 *     pp. 253-256.
 *   Hollander, M., Wolfe, D. A. & Chicken, E.,
 *     *Nonparametric Statistical Methods*, 3rd ed.
 *     (Wiley 2014), sec. 3.1.
 */

export interface CoxStuartRowForDavidBartonCompound {
  source: string;
  csZ: number;
  csPValue: number;
}

export interface DavidBartonRowForCoxStuartCompound {
  source: string;
  dbZ: number;
  dbPValue: number;
}

export type CoxStuartDavidBartonGlobalLocalTrendBucket =
  | 'coherent-trend'
  | 'global-trend-on-local-noise'
  | 'local-persistence-no-global-trend'
  | 'global-trend-only'
  | 'local-oscillation-no-global-trend'
  | 'global-trend-with-decisive-cs-only-dual-direction'
  | 'no-evidence';

export type CoxStuartDavidBartonCoherentDirection = 'up' | 'down' | null;

export interface CoxStuartDavidBartonGlobalLocalTrendJoinedRow {
  source: string;
  csZ: number;
  csPValue: number;
  dbZ: number;
  dbPValue: number;
  csDecisive: boolean;
  dbDecisive: boolean;
  /** +csZ in the trend-positive sign convention. */
  csTrendSignal: number;
  /** -dbZ in the trend-positive sign convention. */
  dbTrendSignal: number;
  bucket: CoxStuartDavidBartonGlobalLocalTrendBucket;
  /** 'up' or 'down' when bucket = 'coherent-trend'; null otherwise. */
  coherentTrendDirection: CoxStuartDavidBartonCoherentDirection;
}

export interface CoxStuartDavidBartonGlobalLocalTrendReport {
  alpha: number;
  rows: CoxStuartDavidBartonGlobalLocalTrendJoinedRow[];
  bucketCounts: Record<CoxStuartDavidBartonGlobalLocalTrendBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  coherentRows: number;
  crossScaleSplitRows: number;
  scaleSpecificRows: number;
  byCoherentDirection: { up: number; down: number };
  sourcesOnlyInCoxStuart: string[];
  sourcesOnlyInDavidBarton: string[];
}

export function classifyCoxStuartDavidBartonGlobalLocalTrendCompound(
  coxStuartRows: ReadonlyArray<CoxStuartRowForDavidBartonCompound>,
  davidBartonRows: ReadonlyArray<DavidBartonRowForCoxStuartCompound>,
  alpha = 0.05,
): CoxStuartDavidBartonGlobalLocalTrendReport {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `classifyCoxStuartDavidBartonGlobalLocalTrendCompound: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }

  const csBySrc = new Map<string, CoxStuartRowForDavidBartonCompound>();
  for (const r of coxStuartRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyCoxStuartDavidBartonGlobalLocalTrendCompound: cox-stuart row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.csZ) ||
      !Number.isFinite(r.csPValue) ||
      r.csPValue <= 0 ||
      r.csPValue > 1
    ) {
      throw new Error(
        `classifyCoxStuartDavidBartonGlobalLocalTrendCompound: cox-stuart row '${r.source}' has invalid csZ/csPValue`,
      );
    }
    if (csBySrc.has(r.source)) {
      throw new Error(
        `classifyCoxStuartDavidBartonGlobalLocalTrendCompound: duplicate cox-stuart source '${r.source}'`,
      );
    }
    csBySrc.set(r.source, r);
  }

  const dbBySrc = new Map<string, DavidBartonRowForCoxStuartCompound>();
  for (const r of davidBartonRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyCoxStuartDavidBartonGlobalLocalTrendCompound: david-barton row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.dbZ) ||
      !Number.isFinite(r.dbPValue) ||
      r.dbPValue <= 0 ||
      r.dbPValue > 1
    ) {
      throw new Error(
        `classifyCoxStuartDavidBartonGlobalLocalTrendCompound: david-barton row '${r.source}' has invalid dbZ/dbPValue`,
      );
    }
    if (dbBySrc.has(r.source)) {
      throw new Error(
        `classifyCoxStuartDavidBartonGlobalLocalTrendCompound: duplicate david-barton source '${r.source}'`,
      );
    }
    dbBySrc.set(r.source, r);
  }

  const sourcesOnlyInCoxStuart: string[] = [];
  const sourcesOnlyInDavidBarton: string[] = [];
  for (const s of csBySrc.keys()) {
    if (!dbBySrc.has(s)) sourcesOnlyInCoxStuart.push(s);
  }
  for (const s of dbBySrc.keys()) {
    if (!csBySrc.has(s)) sourcesOnlyInDavidBarton.push(s);
  }
  sourcesOnlyInCoxStuart.sort();
  sourcesOnlyInDavidBarton.sort();

  const joinedSources: string[] = [];
  for (const s of csBySrc.keys()) {
    if (dbBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: CoxStuartDavidBartonGlobalLocalTrendJoinedRow[] = [];
  const bucketCounts: Record<
    CoxStuartDavidBartonGlobalLocalTrendBucket,
    number
  > = {
    'coherent-trend': 0,
    'global-trend-on-local-noise': 0,
    'local-persistence-no-global-trend': 0,
    'global-trend-only': 0,
    'local-oscillation-no-global-trend': 0,
    'global-trend-with-decisive-cs-only-dual-direction': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  let coherentRows = 0;
  let crossScaleSplitRows = 0;
  let scaleSpecificRows = 0;
  const byCoherentDirection = { up: 0, down: 0 };

  for (const src of joinedSources) {
    const cs = csBySrc.get(src)!;
    const db = dbBySrc.get(src)!;
    const csDecisive = cs.csPValue < alpha;
    const dbDecisive = db.dbPValue < alpha;
    const anyDecisive = csDecisive || dbDecisive;
    if (csDecisive && dbDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    const csTrendSignal = cs.csZ;
    const dbTrendSignal = -db.dbZ;

    let bucket: CoxStuartDavidBartonGlobalLocalTrendBucket;
    let coherentTrendDirection: CoxStuartDavidBartonCoherentDirection = null;
    if (!anyDecisive) {
      bucket = 'no-evidence';
    } else if (csDecisive && !dbDecisive) {
      bucket = 'global-trend-only';
      scaleSpecificRows += 1;
    } else if (dbDecisive && !csDecisive) {
      // local-only: branch on db direction
      if (dbTrendSignal > 0) {
        bucket = 'local-persistence-no-global-trend';
      } else {
        bucket = 'local-oscillation-no-global-trend';
      }
      scaleSpecificRows += 1;
    } else {
      // both decisive: classify by sign agreement on
      // the trend-signal axes
      const csSign = csTrendSignal > 0 ? 1 : csTrendSignal < 0 ? -1 : 0;
      const dbSign = dbTrendSignal > 0 ? 1 : dbTrendSignal < 0 ? -1 : 0;
      if (dbSign > 0 && csSign !== 0) {
        // db says local persistence; cs says global trend
        // direction. If signs match -> coherent. If they
        // oppose -> still coherent in the trend sense
        // (the global probe and local probe both detect
        // a directional pattern; the local probe is
        // direction-blind so we accept either sign as
        // "coherent" with cs's direction).
        bucket = 'coherent-trend';
        coherentTrendDirection = csSign > 0 ? 'up' : 'down';
        coherentRows += 1;
        if (csSign > 0) byCoherentDirection.up += 1;
        else byCoherentDirection.down += 1;
      } else if (dbSign < 0) {
        // db says local oscillation; cs says global trend
        // -> drift-on-noise pattern
        bucket = 'global-trend-on-local-noise';
        crossScaleSplitRows += 1;
      } else {
        // dbSign === 0 and decisive (effectively
        // unreachable: dbZ exactly zero with dbPValue<alpha
        // is impossible under the standardisation) ->
        // classify conservatively as global-trend-only
        bucket = 'global-trend-only';
        scaleSpecificRows += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      csZ: cs.csZ,
      csPValue: cs.csPValue,
      dbZ: db.dbZ,
      dbPValue: db.dbPValue,
      csDecisive,
      dbDecisive,
      csTrendSignal,
      dbTrendSignal,
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
    crossScaleSplitRows,
    scaleSpecificRows,
    byCoherentDirection,
    sourcesOnlyInCoxStuart,
    sourcesOnlyInDavidBarton,
  };
}
