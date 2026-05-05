/**
 * classifyAxis212Axis211OlmsteadTukeyBrownMoodCornerExtremalVsHalfBinaryTrendCompound:
 * cross-axis 7-bucket diagnostic joining axis-212
 * OLMSTEAD-TUKEY CORNER TEST FOR ASSOCIATION (`otQ`,
 * `otPValue`) with axis-211 BROWN-MOOD MEDIAN TREND
 * TEST (`bmZ`, `bmPValue`) on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes test for monotone trend
 * in the gap-filled daily token series via MEDIAN-BASED
 * BINARY (above/below) reductions, but at DIFFERENT
 * SPATIAL LOCALITIES along the time axis:
 *
 *   - OLMSTEAD-TUKEY CORNER (axis-212) collapses each
 *     observation to a SINGLE BIT (above / below the
 *     global sample median) AND ignores everything
 *     except the EDGE RUN-LENGTHS at the 4 corners of
 *     the (time, value) plane. It is a MAXIMALLY-
 *     EXTREMAL trend statistic:
 *       - otQ >> 0 = HIGH values cluster at HIGH x AND
 *         LOW values at LOW x = monotone UP-TREND.
 *       - otQ << 0 = monotone DOWN-TREND.
 *
 *       otTrendUpSignal = +otQ   ( + = up-trend,
 *                                  - = down-trend )
 *
 *   - BROWN-MOOD MEDIAN TREND (axis-211) ALSO collapses
 *     each observation to a SINGLE BIT (above / not-
 *     above the global sample median) but bins it into
 *     one of TWO time buckets (first half / second
 *     half) and counts EVERY observation's bit.
 *     Maximally-COARSE 2x2 binary trend test on the
 *     ENTIRE time window:
 *       - bmZ >> 0 = MORE above-median in FIRST half =
 *         monotone DOWN-TREND.
 *       - bmZ << 0 = MORE above-median in SECOND half =
 *         monotone UP-TREND.
 *
 *       bmTrendUpSignal = -bmZ   ( + = up-trend,
 *                                  - = down-trend )
 *
 *     NB: BM has the OPPOSITE raw-sign convention to
 *     OT (BM scores first-half above-median exceedance
 *     directly, OT scores up-trend directly). The
 *     compound classifier always operates in the
 *     sign-corrected `*TrendUpSignal` frame so
 *     direction-comparison is unambiguous.
 *
 * STRUCTURAL ORTHOGONALITY at three levels:
 *
 *   - DIFFERENT SPATIAL LOCALITY.
 *     Brown-Mood uses EVERY observation across the
 *     ENTIRE time window (n total bits collapsed into
 *     a 2x2 contingency). Olmstead-Tukey uses ONLY the
 *     edge run-lengths -- typically O(log n)
 *     observations near the 4 corners under H0, and
 *     IGNORES THE INTERIOR ENTIRELY. A series with
 *     strong middle-of-window structure (e.g. a deep
 *     mid-window dip then a return to baseline) gives
 *     bmZ != 0 (the interior bits dominate the half-
 *     counts) but otQ ~ 0 (the edges look ordinary).
 *     A series with quiet interior but strong corner
 *     agreement (e.g. one initial high spike, one
 *     final low spike, otherwise iid noise) gives the
 *     opposite.
 *
 *   - DIFFERENT POWER PROFILE.
 *     Brown-Mood has high power against ABRUPT LEVEL
 *     SHIFTS at the midpoint (perfect 2x2 split).
 *     Olmstead-Tukey has high power against EDGE-
 *     LOCALIZED extremes (the rare-but-decisive case
 *     where the smallest x-points are all on one side
 *     of the median and the largest are all on the
 *     other). For smooth slow drifts both are weak;
 *     for step functions BM dominates; for bracketed
 *     extremes OT dominates.
 *
 *   - DIFFERENT NULL DISTRIBUTION FAMILY.
 *     Brown-Mood: chi-square 1-df with bmZ ~ N(0,1)
 *     under H0. Olmstead-Tukey: each corner-count K_i
 *     approximately Geometric(1/2) under H0, otQ has
 *     moment-matched Var = 8, with Olmstead-Tukey 1947
 *     exact tables giving the dominant tail behaviour.
 *
 * They can:
 *
 *   - AGREE in the "median-binary-monotone-trend"
 *     case: both decisive in the same direction. The
 *     interior AND the edges all corroborate the
 *     trend. Buckets `robust-up-trend` and
 *     `robust-down-trend` -- the strongest possible
 *     median-binary trend assertion.
 *
 *   - DISAGREE INFORMATIVELY in the "interior-only"
 *     case: bmZ decisive in some direction but otQ
 *     non-decisive -- a series whose INTERIOR drives
 *     the median-half imbalance but whose edges sit
 *     near the median. Surfaced as `brown-mood-only-up`
 *     or `brown-mood-only-down`.
 *
 *   - SHOW only OT decisive: edge-EXTREMAL trend
 *     without whole-window median-half imbalance --
 *     a series where one edge has a strong above-
 *     median run and the opposite edge a strong below-
 *     median run, but the interior is balanced.
 *     Surfaced as `olmstead-tukey-only-up` or
 *     `olmstead-tukey-only-down`.
 *
 *   - DISAGREE ON SIGN: both decisive but in OPPOSITE
 *     directions (after sign-correction). Most
 *     diagnostic compound case: it means the EDGES say
 *     up-trend (or down) while the WHOLE-HALF MEDIAN
 *     SPLIT says the opposite -- typically driven by
 *     a series with a STRONG MID-WINDOW LEVEL SHIFT in
 *     one direction PLUS strong edge extremes in the
 *     opposite direction. Surfaced as
 *     `direction-conflict`.
 *
 *   - NEITHER decisive: `no-evidence`.
 *
 * Buckets (alpha default 0.05):
 *
 *   - `robust-up-trend`: both decisive, otTrendUpSignal
 *     > 0 AND bmTrendUpSignal > 0 (i.e. otQ > 0 AND
 *     bmZ < 0).
 *   - `robust-down-trend`: both decisive, otTrendUpSignal
 *     < 0 AND bmTrendUpSignal < 0 (i.e. otQ < 0 AND
 *     bmZ > 0).
 *   - `direction-conflict`: both decisive but signs of
 *     otTrendUpSignal and bmTrendUpSignal disagree.
 *   - `brown-mood-only-up`: bm decisive (bmZ < 0 = up),
 *     ot non-decisive.
 *   - `brown-mood-only-down`: bm decisive (bmZ > 0 =
 *     down), ot non-decisive.
 *   - `olmstead-tukey-only-up`: ot decisive (otQ > 0 =
 *     up), bm non-decisive.
 *   - `olmstead-tukey-only-down`: ot decisive (otQ < 0
 *     = down), bm non-decisive.
 *   - `no-evidence`: neither decisive.
 *
 * Pure function -- no I/O, no globals. Throws on
 * malformed input (duplicate sources, non-finite
 * statistics, pvalue out of (0, 1]). Joins by exact
 * source string match; reports sources only-in-ot and
 * only-in-bm separately so callers can see asymmetric
 * coverage.
 *
 * Refs: see axis-212 (Olmstead-Tukey 1947) and axis-211
 * (Brown-Mood 1951) module headers for primary references.
 */

export interface OlmsteadTukeyCornerRowForBrownMoodCompound {
  source: string;
  otQ: number;
  otZ: number;
  otPValue: number;
}

export interface BrownMoodMedianTrendRowForOlmsteadTukeyCornerCompound {
  source: string;
  bmZ: number;
  bmPValue: number;
}

export type Axis212Axis211OlmsteadTukeyBrownMoodBucket =
  | 'robust-up-trend'
  | 'robust-down-trend'
  | 'direction-conflict'
  | 'brown-mood-only-up'
  | 'brown-mood-only-down'
  | 'olmstead-tukey-only-up'
  | 'olmstead-tukey-only-down'
  | 'no-evidence';

export interface Axis212Axis211OlmsteadTukeyBrownMoodJoinedRow {
  source: string;
  otQ: number;
  otZ: number;
  otPValue: number;
  bmZ: number;
  bmPValue: number;
  otDecisive: boolean;
  bmDecisive: boolean;
  /** +otQ (positive = up-trend; native sign). */
  otTrendUpSignal: number;
  /** -bmZ (positive = up-trend; sign-inverted from raw bmZ). */
  bmTrendUpSignal: number;
  bucket: Axis212Axis211OlmsteadTukeyBrownMoodBucket;
  /**
   * Joint trend-direction quadrant when both are
   * decisive:
   *   robustUp | robustDown | conflictOtUpBmDown | conflictOtDownBmUp
   * null when either is non-decisive.
   */
  jointDirectionQuadrant:
    | 'robustUp'
    | 'robustDown'
    | 'conflictOtUpBmDown'
    | 'conflictOtDownBmUp'
    | null;
}

export interface Axis212Axis211OlmsteadTukeyBrownMoodReport {
  alpha: number;
  rows: Axis212Axis211OlmsteadTukeyBrownMoodJoinedRow[];
  bucketCounts: Record<Axis212Axis211OlmsteadTukeyBrownMoodBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointDirectionQuadrant: {
    robustUp: number;
    robustDown: number;
    conflictOtUpBmDown: number;
    conflictOtDownBmUp: number;
    anyMissingDecisive: number;
  };
  sourcesOnlyInOlmsteadTukey: string[];
  sourcesOnlyInBrownMood: string[];
}

export function classifyAxis212Axis211OlmsteadTukeyBrownMoodCornerExtremalVsHalfBinaryTrendCompound(
  olmsteadTukeyRows: ReadonlyArray<OlmsteadTukeyCornerRowForBrownMoodCompound>,
  brownMoodRows: ReadonlyArray<BrownMoodMedianTrendRowForOlmsteadTukeyCornerCompound>,
  alpha = 0.05,
): Axis212Axis211OlmsteadTukeyBrownMoodReport {
  const fnName =
    'classifyAxis212Axis211OlmsteadTukeyBrownMoodCornerExtremalVsHalfBinaryTrendCompound';
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(`${fnName}: alpha must be in (0, 0.5] (got ${alpha})`);
  }

  const otBySrc = new Map<
    string,
    OlmsteadTukeyCornerRowForBrownMoodCompound
  >();
  for (const r of olmsteadTukeyRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `${fnName}: olmstead-tukey row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.otQ) ||
      !Number.isFinite(r.otZ) ||
      !Number.isFinite(r.otPValue) ||
      r.otPValue <= 0 ||
      r.otPValue > 1
    ) {
      throw new Error(
        `${fnName}: olmstead-tukey row '${r.source}' has invalid otQ/otZ/otPValue`,
      );
    }
    if (otBySrc.has(r.source)) {
      throw new Error(
        `${fnName}: duplicate olmstead-tukey source '${r.source}'`,
      );
    }
    otBySrc.set(r.source, r);
  }

  const bmBySrc = new Map<
    string,
    BrownMoodMedianTrendRowForOlmsteadTukeyCornerCompound
  >();
  for (const r of brownMoodRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `${fnName}: brown-mood row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.bmZ) ||
      !Number.isFinite(r.bmPValue) ||
      r.bmPValue <= 0 ||
      r.bmPValue > 1
    ) {
      throw new Error(
        `${fnName}: brown-mood row '${r.source}' has invalid bmZ/bmPValue`,
      );
    }
    if (bmBySrc.has(r.source)) {
      throw new Error(
        `${fnName}: duplicate brown-mood source '${r.source}'`,
      );
    }
    bmBySrc.set(r.source, r);
  }

  const sourcesOnlyInOlmsteadTukey: string[] = [];
  const sourcesOnlyInBrownMood: string[] = [];
  for (const s of otBySrc.keys()) {
    if (!bmBySrc.has(s)) sourcesOnlyInOlmsteadTukey.push(s);
  }
  for (const s of bmBySrc.keys()) {
    if (!otBySrc.has(s)) sourcesOnlyInBrownMood.push(s);
  }
  sourcesOnlyInOlmsteadTukey.sort();
  sourcesOnlyInBrownMood.sort();

  const joinedSources: string[] = [];
  for (const s of otBySrc.keys()) {
    if (bmBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis212Axis211OlmsteadTukeyBrownMoodJoinedRow[] = [];
  const bucketCounts: Record<
    Axis212Axis211OlmsteadTukeyBrownMoodBucket,
    number
  > = {
    'robust-up-trend': 0,
    'robust-down-trend': 0,
    'direction-conflict': 0,
    'brown-mood-only-up': 0,
    'brown-mood-only-down': 0,
    'olmstead-tukey-only-up': 0,
    'olmstead-tukey-only-down': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  const byJointDirectionQuadrant = {
    robustUp: 0,
    robustDown: 0,
    conflictOtUpBmDown: 0,
    conflictOtDownBmUp: 0,
    anyMissingDecisive: 0,
  };

  for (const src of joinedSources) {
    const ot = otBySrc.get(src)!;
    const bm = bmBySrc.get(src)!;
    const otDecisive = ot.otPValue < alpha;
    const bmDecisive = bm.bmPValue < alpha;
    const anyDecisive = otDecisive || bmDecisive;
    if (otDecisive && bmDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    // Native OT: positive = up-trend.
    const otTrendUpSignal = ot.otQ;
    // Sign-inverted BM: positive = up-trend.
    const bmTrendUpSignal = -bm.bmZ;

    let bucket: Axis212Axis211OlmsteadTukeyBrownMoodBucket;
    let jointDirectionQuadrant:
      | 'robustUp'
      | 'robustDown'
      | 'conflictOtUpBmDown'
      | 'conflictOtDownBmUp'
      | null = null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointDirectionQuadrant.anyMissingDecisive += 1;
    } else if (otDecisive && !bmDecisive) {
      bucket = ot.otQ > 0 ? 'olmstead-tukey-only-up' : 'olmstead-tukey-only-down';
      byJointDirectionQuadrant.anyMissingDecisive += 1;
    } else if (bmDecisive && !otDecisive) {
      bucket = bm.bmZ < 0 ? 'brown-mood-only-up' : 'brown-mood-only-down';
      byJointDirectionQuadrant.anyMissingDecisive += 1;
    } else {
      // Both decisive: classify in *TrendUpSignal frame.
      const otUp = otTrendUpSignal > 0; // i.e. otQ > 0
      const bmUp = bmTrendUpSignal > 0; // i.e. bmZ < 0
      if (otUp && bmUp) {
        bucket = 'robust-up-trend';
        jointDirectionQuadrant = 'robustUp';
        byJointDirectionQuadrant.robustUp += 1;
      } else if (!otUp && !bmUp) {
        bucket = 'robust-down-trend';
        jointDirectionQuadrant = 'robustDown';
        byJointDirectionQuadrant.robustDown += 1;
      } else if (otUp && !bmUp) {
        bucket = 'direction-conflict';
        jointDirectionQuadrant = 'conflictOtUpBmDown';
        byJointDirectionQuadrant.conflictOtUpBmDown += 1;
      } else {
        bucket = 'direction-conflict';
        jointDirectionQuadrant = 'conflictOtDownBmUp';
        byJointDirectionQuadrant.conflictOtDownBmUp += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      otQ: ot.otQ,
      otZ: ot.otZ,
      otPValue: ot.otPValue,
      bmZ: bm.bmZ,
      bmPValue: bm.bmPValue,
      otDecisive,
      bmDecisive,
      otTrendUpSignal,
      bmTrendUpSignal,
      bucket,
      jointDirectionQuadrant,
    });
  }

  return {
    alpha,
    rows,
    bucketCounts,
    bothDecisive,
    atLeastOneDecisive,
    byJointDirectionQuadrant,
    sourcesOnlyInOlmsteadTukey,
    sourcesOnlyInBrownMood,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis212Axis211OlmsteadTukeyBrownMoodReport.
 *
 *   axis-212xaxis-211 alpha=<a> n=<rows> both=<k>/<rows> qd[rUp/rDn/cOuBd/cOdBu]=a/b/c/d buckets[ru/rd/dc/bmu/bmd/otu/otd/ne]=...
 *
 * Pure deterministic; no I/O.
 */
export function summarizeAxis212Axis211OlmsteadTukeyBrownMoodReport(
  report: Axis212Axis211OlmsteadTukeyBrownMoodReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const q = report.byJointDirectionQuadrant;
  const b = report.bucketCounts;
  return (
    `axis-212xaxis-211 alpha=${a} n=${n} both=${report.bothDecisive}/${n} ` +
    `qd[rUp/rDn/cOuBd/cOdBu]=${q.robustUp}/${q.robustDown}/${q.conflictOtUpBmDown}/${q.conflictOtDownBmUp} ` +
    `buckets[ru/rd/dc/bmu/bmd/otu/otd/ne]=${b['robust-up-trend']}/${b['robust-down-trend']}/${b['direction-conflict']}/${b['brown-mood-only-up']}/${b['brown-mood-only-down']}/${b['olmstead-tukey-only-up']}/${b['olmstead-tukey-only-down']}/${b['no-evidence']}`
  );
}
