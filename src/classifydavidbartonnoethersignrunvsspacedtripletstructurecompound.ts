/**
 * classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound:
 * cross-axis 7-bucket diagnostic joining axis-203
 * DAVID & BARTON 1958 RUNS-UP-AND-DOWN TEST
 * (`dbZ`, `dbPValue`) with axis-202 NOETHER 1956
 * cyclical-trend test at LAG-m=2 (`noetherZ`,
 * `noetherPValue`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes target persistence-vs-
 * mean-reversion in the daily token series but use
 * STRUCTURALLY DIFFERENT primitives:
 *
 *   - David-Barton counts MAXIMAL RUNS of identically-
 *     signed FIRST DIFFERENCES (sign-flip rate at lag 1):
 *
 *       dbZ << 0  =  too few runs  =  LONG MONOTONE
 *                                      STRETCHES
 *                                      = lag-1
 *                                        PERSISTENCE
 *                                        / TREND
 *       dbZ >> 0  =  too many runs =  HIGH-FREQUENCY
 *                                      OSCILLATION
 *                                      = lag-1 MEAN-
 *                                        REVERSION
 *                                        / cyclic
 *
 *   - Noether at lag 2 counts MONOTONIC SPACED triplets
 *     (v[i], v[i+2], v[i+4]) -- monotonicity probe at
 *     a TWO-DAY scale:
 *
 *       noetherZ >> 0  =  more monotonic spaced triplets
 *                          than chance
 *                          = LAG-2 PERSISTENCE / TREND
 *       noetherZ << 0  =  fewer monotonic spaced triplets
 *                          = LAG-2 CYCLIC / mean-
 *                            reversion
 *
 * To compare them on a COMMON SIGN AXIS we recode each
 * z-statistic as a "trend signal at that scale":
 *
 *     dbTrendSignal      = - dbZ        ( + = lag-1
 *                                          first-diff-
 *                                          sign trend
 *                                         - = lag-1
 *                                          oscillation )
 *     noetherTrendSignal = + noetherZ   ( + = lag-2
 *                                          spaced-triplet
 *                                          trend
 *                                         - = lag-2
 *                                          cyclic )
 *
 * The two probes are STRUCTURALLY DIFFERENT (run counts
 * on first-difference signs vs monotonic-spaced-triplet
 * counts on raw values at lag 2) and operate at
 * DIFFERENT TIME SCALES (lag 1 vs lag 2). They can
 * AGREE -- a steady up-trend produces one long run
 * (`dbZ << 0`) AND many monotonic spaced triplets
 * (`noetherZ >> 0`) -- or DISAGREE in informative ways.
 * The compound classifier exploits this gap to
 * distinguish coherent regimes, scale-dependent flips,
 * single-scale-only signals, and no-evidence cases.
 *
 * Bucket map. Given per-source `dbZ` (axis-203) and
 * `noetherZ` (axis-202) with their two-sided p-values
 * at configurable alpha (default 0.05):
 *
 *   - 'coherent-trend': dbTrendSignal > 0 (dbZ < 0)
 *     AND noetherTrendSignal > 0 (noetherZ > 0) AND
 *     BOTH decisive at alpha. Trend regime detected
 *     consistently at both the lag-1 sign-run scale and
 *     the lag-2 spaced-triplet scale -- the strongest
 *     cross-scale evidence of a directional drift.
 *   - 'coherent-cyclic': dbTrendSignal < 0 (dbZ > 0)
 *     AND noetherTrendSignal < 0 (noetherZ < 0) AND
 *     BOTH decisive at alpha. Mean-reversion / cyclic
 *     regime detected consistently at both scales --
 *     bounded-range daily oscillation around a slowly-
 *     moving level.
 *   - 'cross-scale-flip-spaced-triplet-only':
 *     dbTrendSignal < 0 (dbZ > 0, lag-1 oscillating)
 *     AND noetherTrendSignal > 0 (noetherZ > 0, lag-2
 *     trend) AND BOTH decisive. The series alternates
 *     sign daily yet trends monotonically every two
 *     days -- a TWO-DAY-CYCLE-WITHIN-UPWARD-DRIFT
 *     pattern. Visible to Noether but inverted by
 *     David-Barton.
 *   - 'cross-scale-flip-sign-run-only':
 *     dbTrendSignal > 0 (dbZ < 0, long monotone runs)
 *     AND noetherTrendSignal < 0 (noetherZ < 0, lag-2
 *     cyclic) AND BOTH decisive. The series moves
 *     smoothly day-to-day but reverses direction at
 *     period ~4 -- a triangle-wave-like envelope.
 *     Rare; watch-list.
 *   - 'sign-run-only': dbZ decisive AND noetherZ NOT
 *     decisive. Structure visible only at the lag-1
 *     sign-run scale; lag-2 spaced triplets look
 *     i.i.d.
 *   - 'spaced-triplet-only': noetherZ decisive AND dbZ
 *     NOT decisive. Structure visible only at the lag-2
 *     monotonic-spaced-triplet scale; lag-1 sign runs
 *     look i.i.d. -- DIRECT EVIDENCE that the Noether
 *     probe carries non-redundant signal vs David-
 *     Barton.
 *   - 'no-evidence': neither decisive at alpha.
 *
 * Returns the joined-row table plus aggregate counts
 * (`bothDecisive`, `atLeastOneDecisive`, `coherentRows`,
 * `crossScaleFlipRows`, `scaleSpecificRows`) and the
 * asymmetric source-membership lists.
 *
 * Pure function: no I/O, deterministic source-asc
 * ordering, throws on duplicate sources, non-finite
 * inputs, p-values outside (0, 1], or alpha outside
 * (0, 0.5].
 *
 * Reference:
 *   David, F. N. & Barton, D. E., "A test for birth-
 *     order effects", *Biometrika* 45(1-2) (1958),
 *     pp. 253-256.
 *   Noether, G. E., "Two sequential tests against
 *     trend", *Annals of Mathematical Statistics*
 *     27(2) (1956), pp. 441-450.
 *   Bradley, J. V., *Distribution-Free Statistical
 *     Tests* (Prentice-Hall 1968), sec. 12.3.4.
 */

export interface DavidBartonRowForNoetherCompound {
  source: string;
  dbZ: number;
  dbPValue: number;
}

export interface NoetherRowForDavidBartonCompound {
  source: string;
  noetherZ: number;
  noetherPValue: number;
}

export type DavidBartonNoetherSignRunSpacedTripletBucket =
  | 'coherent-trend'
  | 'coherent-cyclic'
  | 'cross-scale-flip-spaced-triplet-only'
  | 'cross-scale-flip-sign-run-only'
  | 'sign-run-only'
  | 'spaced-triplet-only'
  | 'no-evidence';

export interface DavidBartonNoetherSignRunSpacedTripletJoinedRow {
  source: string;
  dbZ: number;
  dbPValue: number;
  noetherZ: number;
  noetherPValue: number;
  dbDecisive: boolean;
  noetherDecisive: boolean;
  /** -dbZ in the trend-positive sign convention. */
  dbTrendSignal: number;
  /** +noetherZ in the trend-positive sign convention. */
  noetherTrendSignal: number;
  bucket: DavidBartonNoetherSignRunSpacedTripletBucket;
}

export interface DavidBartonNoetherSignRunSpacedTripletReport {
  alpha: number;
  rows: DavidBartonNoetherSignRunSpacedTripletJoinedRow[];
  bucketCounts: Record<DavidBartonNoetherSignRunSpacedTripletBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  coherentRows: number;
  crossScaleFlipRows: number;
  scaleSpecificRows: number;
  sourcesOnlyInDavidBarton: string[];
  sourcesOnlyInNoether: string[];
}

export function classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound(
  davidBartonRows: ReadonlyArray<DavidBartonRowForNoetherCompound>,
  noetherRows: ReadonlyArray<NoetherRowForDavidBartonCompound>,
  alpha = 0.05,
): DavidBartonNoetherSignRunSpacedTripletReport {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }

  const dbBySrc = new Map<string, DavidBartonRowForNoetherCompound>();
  for (const r of davidBartonRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound: david-barton row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.dbZ) ||
      !Number.isFinite(r.dbPValue) ||
      r.dbPValue <= 0 ||
      r.dbPValue > 1
    ) {
      throw new Error(
        `classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound: david-barton row '${r.source}' has invalid dbZ/dbPValue`,
      );
    }
    if (dbBySrc.has(r.source)) {
      throw new Error(
        `classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound: duplicate david-barton source '${r.source}'`,
      );
    }
    dbBySrc.set(r.source, r);
  }

  const noetherBySrc = new Map<string, NoetherRowForDavidBartonCompound>();
  for (const r of noetherRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound: noether row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.noetherZ) ||
      !Number.isFinite(r.noetherPValue) ||
      r.noetherPValue <= 0 ||
      r.noetherPValue > 1
    ) {
      throw new Error(
        `classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound: noether row '${r.source}' has invalid noetherZ/noetherPValue`,
      );
    }
    if (noetherBySrc.has(r.source)) {
      throw new Error(
        `classifyDavidBartonNoetherSignRunVsSpacedTripletStructureCompound: duplicate noether source '${r.source}'`,
      );
    }
    noetherBySrc.set(r.source, r);
  }

  const sourcesOnlyInDavidBarton: string[] = [];
  const sourcesOnlyInNoether: string[] = [];
  for (const s of dbBySrc.keys()) {
    if (!noetherBySrc.has(s)) sourcesOnlyInDavidBarton.push(s);
  }
  for (const s of noetherBySrc.keys()) {
    if (!dbBySrc.has(s)) sourcesOnlyInNoether.push(s);
  }
  sourcesOnlyInDavidBarton.sort();
  sourcesOnlyInNoether.sort();

  const joinedSources: string[] = [];
  for (const s of dbBySrc.keys()) {
    if (noetherBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: DavidBartonNoetherSignRunSpacedTripletJoinedRow[] = [];
  const bucketCounts: Record<
    DavidBartonNoetherSignRunSpacedTripletBucket,
    number
  > = {
    'coherent-trend': 0,
    'coherent-cyclic': 0,
    'cross-scale-flip-spaced-triplet-only': 0,
    'cross-scale-flip-sign-run-only': 0,
    'sign-run-only': 0,
    'spaced-triplet-only': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  let coherentRows = 0;
  let crossScaleFlipRows = 0;
  let scaleSpecificRows = 0;

  for (const src of joinedSources) {
    const db = dbBySrc.get(src)!;
    const no = noetherBySrc.get(src)!;
    const dbDecisive = db.dbPValue < alpha;
    const noetherDecisive = no.noetherPValue < alpha;
    const anyDecisive = dbDecisive || noetherDecisive;
    if (dbDecisive && noetherDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    const dbTrendSignal = -db.dbZ;
    const noetherTrendSignal = no.noetherZ;

    let bucket: DavidBartonNoetherSignRunSpacedTripletBucket;
    if (!anyDecisive) {
      bucket = 'no-evidence';
    } else if (dbDecisive && !noetherDecisive) {
      bucket = 'sign-run-only';
      scaleSpecificRows += 1;
    } else if (noetherDecisive && !dbDecisive) {
      bucket = 'spaced-triplet-only';
      scaleSpecificRows += 1;
    } else {
      // both decisive: classify by sign agreement on
      // the trend-signal axis
      const dbSign =
        dbTrendSignal > 0 ? 1 : dbTrendSignal < 0 ? -1 : 0;
      const noSign =
        noetherTrendSignal > 0 ? 1 : noetherTrendSignal < 0 ? -1 : 0;
      if (dbSign > 0 && noSign > 0) {
        bucket = 'coherent-trend';
        coherentRows += 1;
      } else if (dbSign < 0 && noSign < 0) {
        bucket = 'coherent-cyclic';
        coherentRows += 1;
      } else if (dbSign < 0 && noSign > 0) {
        bucket = 'cross-scale-flip-spaced-triplet-only';
        crossScaleFlipRows += 1;
      } else if (dbSign > 0 && noSign < 0) {
        bucket = 'cross-scale-flip-sign-run-only';
        crossScaleFlipRows += 1;
      } else {
        // exact zero on one signal even though decisive
        // -- effectively unreachable in practice but
        // classified conservatively.
        bucket = dbSign === 0 ? 'spaced-triplet-only' : 'sign-run-only';
        scaleSpecificRows += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      dbZ: db.dbZ,
      dbPValue: db.dbPValue,
      noetherZ: no.noetherZ,
      noetherPValue: no.noetherPValue,
      dbDecisive,
      noetherDecisive,
      dbTrendSignal,
      noetherTrendSignal,
      bucket,
    });
  }

  return {
    alpha,
    rows,
    bucketCounts,
    bothDecisive,
    atLeastOneDecisive,
    coherentRows,
    crossScaleFlipRows,
    scaleSpecificRows,
    sourcesOnlyInDavidBarton,
    sourcesOnlyInNoether,
  };
}
