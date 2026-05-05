/**
 * classifyKamatMielkeValueExtremeVsRankExtremeCompound:
 * cross-axis agreement classifier joining axis-201
 * KAMAT 1956 SAMPLE-RANGE-RATIO scale test (`kamatZ`,
 * `kamatPValue`) with axis-200 MIELKE 1972 QUARTIC-
 * CENTERED-RANKS scale test (`mielkeZ`, `mielkePValue`)
 * on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both tests are PURE SCALE TESTS
 * targeting dispersion shifts concentrated in the
 * extremes — but they reduce data to extremes via TWO
 * FUNDAMENTALLY DIFFERENT PROJECTIONS:
 *
 *   - Mielke quartic uses POOLED-RANK extremes: the
 *     score a(R) = (R - (n+1)/2)^4 places ~99.5% of its
 *     variance on the 5 most extreme RANKS at n=30.
 *     The signal is driven by which HALF the extreme-
 *     rank observations land in. Equal-magnitude swap:
 *     two halves with the same set of extreme ranks
 *     produce the same |Mielke|.
 *
 *   - Kamat range uses RAW VALUE extremes: the
 *     statistic kamatStat = log(R_B / R_A) is driven
 *     by max(B) - min(B) vs max(A) - min(A) on the
 *     ACTUAL DATA VALUES. The signal is driven by the
 *     RAW MAGNITUDE of the per-half spread. Equal-rank
 *     swap: two halves with identical rank patterns
 *     can have radically different value ranges
 *     (e.g. [1,2,3,4] vs [1,2,3,1000] same ranks,
 *     R_A=3 vs R_B=999).
 *
 * The two tests therefore answer subtly different
 * questions about the SAME alternative hypothesis
 * H1: dispersion(B) != dispersion(A):
 *
 *   - Mielke: "do the EXTREME-RANK POSITIONS sit
 *     disproportionately in one half?" — sensitive to
 *     CONFIGURATION of extremes across halves.
 *   - Kamat: "is the RAW VALUE SPREAD bigger in one
 *     half?" — sensitive to MAGNITUDE of the per-half
 *     spread regardless of how many other values fall
 *     between min and max.
 *
 * The bucket label localises which projection drives
 * the rejection.
 *
 * Bucket map. Given per-source `kamatZ` and `mielkeZ`
 * with their two-sided p-values at configurable alpha
 * (default 0.05) and tolerance (default 1e-9):
 *
 *   - 'value-spike-second': SECOND half MORE dispersed
 *     (both Z > 0) AND `|kamatZ| > |mielkeZ|` by strict
 *     margin AND at least one decisive at alpha. The
 *     dispersion shift is driven by ISOLATED VALUE
 *     SPIKES in the second half — Kamat sees an
 *     exploded R_B from one or two outlier-magnitude
 *     days, while Mielke under-weights them because
 *     they only contribute one or two extreme-rank
 *     positions to the score sum. The CANONICAL
 *     token-spike-driven bucket: a small number of
 *     mega-token-days dilate R_B without proportionally
 *     dominating the rank-score sum.
 *   - 'value-spike-first': FIRST half MORE dispersed
 *     (both Z < 0) AND `|kamatZ| > |mielkeZ|` by strict
 *     margin AND at least one decisive.
 *   - 'rank-config-second': SECOND half MORE dispersed
 *     (both Z > 0) AND `|mielkeZ| > |kamatZ|` by strict
 *     margin AND at least one decisive. The dispersion
 *     shift is driven by RANK-CONFIGURATION — many
 *     extreme-rank positions sit in the second half
 *     but the raw value spread is comparable between
 *     halves. Diagnoses GRADUAL scale drift where the
 *     entire extreme-rank tail mass migrates without
 *     producing a single oversized day.
 *   - 'rank-config-first': FIRST half MORE dispersed
 *     (both Z < 0) AND `|mielkeZ| > |kamatZ|` by strict
 *     margin AND at least one decisive.
 *   - 'coherent': BOTH Z share sign AND
 *     `||kamatZ| - |mielkeZ|| <= tolerance` AND at
 *     least one decisive. The dispersion shift is
 *     equally well-detected by both raw-value-spread
 *     and rank-position projections — a clean
 *     parametric scale shift where extreme-rank
 *     positions and extreme-value spreads track each
 *     other proportionally. Strongest cross-axis
 *     evidence of a coherent scale alternative.
 *   - 'sign-conflict': signs DISAGREE (one Z > 0, the
 *     other Z < 0, BOTH non-zero) AND at least one
 *     decisive. Pathological — when the value-spread
 *     and rank-configuration signals disagree on
 *     which half is more dispersed. Surfaces under
 *     ASYMMETRIC TAIL CONFIGURATIONS where one half
 *     has a single large positive deviation while the
 *     other has a single large negative deviation
 *     with comparable absolute magnitude. Watch-list.
 *   - 'no-evidence': NEITHER axis decisive at alpha.
 *
 * Returns the joined-row table plus aggregate counts
 * (`bothDecisive`, `atLeastOneDecisive`, `signConflicts`,
 * `unanimousAgreement`) and the asymmetric source-
 * membership lists (`sourcesOnlyInKamat` /
 * `sourcesOnlyInMielke`).
 *
 * Pure function: no I/O, deterministic source-asc
 * ordering, throws on duplicate sources, non-finite
 * inputs, p-values outside (0, 1], or alpha outside
 * (0, 0.5]. Supports a strict `tolerance` parameter
 * for the coherent boundary (default 1e-9) so callers
 * can tune sensitivity.
 *
 * Reference:
 *   Kamat, A. R., "A two-sample distribution-free
 *     test", *Biometrika* 43(1/2) (1956), pp. 131-135.
 *   Mielke, P. W., "Asymptotic behavior of two-sample
 *     tests based on powers of ranks for detecting
 *     scale and location alternatives", *J. Amer.
 *     Statist. Assoc.* 67(340) (1972), pp. 850-854.
 */

export interface KamatRowForCompound {
  source: string;
  kamatZ: number;
  kamatPValue: number;
}

export interface MielkeRowForKamatCompound {
  source: string;
  mielkeZ: number;
  mielkePValue: number;
}

export type KamatMielkeValueExtremeVsRankExtremeBucket =
  | 'value-spike-second'
  | 'value-spike-first'
  | 'rank-config-second'
  | 'rank-config-first'
  | 'coherent'
  | 'sign-conflict'
  | 'no-evidence';

export interface KamatMielkeValueExtremeVsRankExtremeJoinedRow {
  source: string;
  kamatZ: number;
  kamatPValue: number;
  mielkeZ: number;
  mielkePValue: number;
  kamatDecisive: boolean;
  mielkeDecisive: boolean;
  bucket: KamatMielkeValueExtremeVsRankExtremeBucket;
}

export interface KamatMielkeValueExtremeVsRankExtremeReport {
  alpha: number;
  tolerance: number;
  rows: KamatMielkeValueExtremeVsRankExtremeJoinedRow[];
  bucketCounts: Record<
    KamatMielkeValueExtremeVsRankExtremeBucket,
    number
  >;
  bothDecisive: number;
  atLeastOneDecisive: number;
  signConflicts: number;
  /**
   * Number of joined rows in 'coherent' or
   * 'value-spike-*' or 'rank-config-*' AND at least
   * one decisive.
   */
  unanimousAgreement: number;
  sourcesOnlyInKamat: string[];
  sourcesOnlyInMielke: string[];
}

export function classifyKamatMielkeValueExtremeVsRankExtremeCompound(
  kamatRows: ReadonlyArray<KamatRowForCompound>,
  mielkeRows: ReadonlyArray<MielkeRowForKamatCompound>,
  alpha = 0.05,
  tolerance = 1e-9,
): KamatMielkeValueExtremeVsRankExtremeReport {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `classifyKamatMielkeValueExtremeVsRankExtremeCompound: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error(
      `classifyKamatMielkeValueExtremeVsRankExtremeCompound: tolerance must be a non-negative finite number (got ${tolerance})`,
    );
  }

  const kamatBySrc = new Map<string, KamatRowForCompound>();
  for (const r of kamatRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyKamatMielkeValueExtremeVsRankExtremeCompound: kamat row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.kamatZ) ||
      !Number.isFinite(r.kamatPValue) ||
      r.kamatPValue <= 0 ||
      r.kamatPValue > 1
    ) {
      throw new Error(
        `classifyKamatMielkeValueExtremeVsRankExtremeCompound: kamat row '${r.source}' has invalid kamatZ/kamatPValue`,
      );
    }
    if (kamatBySrc.has(r.source)) {
      throw new Error(
        `classifyKamatMielkeValueExtremeVsRankExtremeCompound: duplicate kamat source '${r.source}'`,
      );
    }
    kamatBySrc.set(r.source, r);
  }

  const mielkeBySrc = new Map<string, MielkeRowForKamatCompound>();
  for (const r of mielkeRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyKamatMielkeValueExtremeVsRankExtremeCompound: mielke row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.mielkeZ) ||
      !Number.isFinite(r.mielkePValue) ||
      r.mielkePValue <= 0 ||
      r.mielkePValue > 1
    ) {
      throw new Error(
        `classifyKamatMielkeValueExtremeVsRankExtremeCompound: mielke row '${r.source}' has invalid mielkeZ/mielkePValue`,
      );
    }
    if (mielkeBySrc.has(r.source)) {
      throw new Error(
        `classifyKamatMielkeValueExtremeVsRankExtremeCompound: duplicate mielke source '${r.source}'`,
      );
    }
    mielkeBySrc.set(r.source, r);
  }

  const sourcesOnlyInKamat: string[] = [];
  const sourcesOnlyInMielke: string[] = [];
  for (const s of kamatBySrc.keys()) {
    if (!mielkeBySrc.has(s)) sourcesOnlyInKamat.push(s);
  }
  for (const s of mielkeBySrc.keys()) {
    if (!kamatBySrc.has(s)) sourcesOnlyInMielke.push(s);
  }
  sourcesOnlyInKamat.sort();
  sourcesOnlyInMielke.sort();

  const joinedSources: string[] = [];
  for (const s of kamatBySrc.keys()) {
    if (mielkeBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: KamatMielkeValueExtremeVsRankExtremeJoinedRow[] = [];
  const bucketCounts: Record<
    KamatMielkeValueExtremeVsRankExtremeBucket,
    number
  > = {
    'value-spike-second': 0,
    'value-spike-first': 0,
    'rank-config-second': 0,
    'rank-config-first': 0,
    coherent: 0,
    'sign-conflict': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  let signConflicts = 0;
  let unanimousAgreement = 0;

  for (const src of joinedSources) {
    const ka = kamatBySrc.get(src)!;
    const mi = mielkeBySrc.get(src)!;
    const kamatDecisive = ka.kamatPValue < alpha;
    const mielkeDecisive = mi.mielkePValue < alpha;
    const anyDecisive = kamatDecisive || mielkeDecisive;
    if (kamatDecisive && mielkeDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    let bucket: KamatMielkeValueExtremeVsRankExtremeBucket;
    if (!anyDecisive) {
      bucket = 'no-evidence';
    } else {
      const kaSign = ka.kamatZ > 0 ? 1 : ka.kamatZ < 0 ? -1 : 0;
      const miSign = mi.mielkeZ > 0 ? 1 : mi.mielkeZ < 0 ? -1 : 0;
      const conflict = kaSign !== 0 && miSign !== 0 && kaSign !== miSign;
      if (conflict) {
        bucket = 'sign-conflict';
        signConflicts += 1;
      } else {
        const kaAbs = Math.abs(ka.kamatZ);
        const miAbs = Math.abs(mi.mielkeZ);
        const diff = kaAbs - miAbs;
        const dominantSign = kaSign !== 0 ? kaSign : miSign;
        if (Math.abs(diff) <= tolerance) {
          bucket = 'coherent';
        } else if (diff > tolerance) {
          // Kamat larger -> value-spike (raw extremes
          // dominate the standardised score)
          bucket =
            dominantSign >= 0 ? 'value-spike-second' : 'value-spike-first';
        } else {
          // Mielke larger -> rank-config (rank
          // extremes dominate)
          bucket =
            dominantSign >= 0 ? 'rank-config-second' : 'rank-config-first';
        }
        unanimousAgreement += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      kamatZ: ka.kamatZ,
      kamatPValue: ka.kamatPValue,
      mielkeZ: mi.mielkeZ,
      mielkePValue: mi.mielkePValue,
      kamatDecisive,
      mielkeDecisive,
      bucket,
    });
  }

  return {
    alpha,
    tolerance,
    rows,
    bucketCounts,
    bothDecisive,
    atLeastOneDecisive,
    signConflicts,
    unanimousAgreement,
    sourcesOnlyInKamat,
    sourcesOnlyInMielke,
  };
}
