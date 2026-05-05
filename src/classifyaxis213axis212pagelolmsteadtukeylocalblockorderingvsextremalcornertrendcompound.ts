/**
 * classifyAxis213Axis212PageLOlmsteadTukeyLocalBlockOrderingVsExtremalCornerTrendCompound:
 * cross-axis 8-bucket diagnostic joining axis-213
 * PAGE'S L TEST FOR ORDERED ALTERNATIVES (`pageZ`,
 * `pagePValue`) with axis-212 OLMSTEAD-TUKEY CORNER
 * TEST FOR ASSOCIATION (`otQ`, `otPValue`) on a
 * per-source basis.
 *
 * STRUCTURAL CLAIM. Both axes test for monotone trend
 * in the gap-filled daily token series, but at
 * MAXIMALLY-OPPOSITE LOCALITY SCALES along the time
 * axis:
 *
 *   - PAGE'S L (axis-213) operates on WITHIN-BLOCK
 *     RANK ORDERINGS in TINY 3-day chunks scanned
 *     across the ENTIRE INTERIOR of the time window.
 *     Maximally-LOCAL ordered-alternative trend test:
 *       - pageZ >> 0 = within-block ranks
 *         SYSTEMATICALLY INCREASE early -> mid -> late
 *         across 3-day windows = LOCAL UP-TREND.
 *       - pageZ << 0 = LOCAL DOWN-TREND.
 *
 *       pageTrendUpSignal = +pageZ   ( + = up-trend,
 *                                      - = down-trend )
 *
 *   - OLMSTEAD-TUKEY CORNER (axis-212) operates on
 *     EDGE RUN-LENGTHS at the 4 corners of the (time,
 *     value) plane and IGNORES THE INTERIOR ENTIRELY.
 *     Maximally-EXTREMAL trend test:
 *       - otQ >> 0 = HIGH values cluster at HIGH x AND
 *         LOW values at LOW x = EDGE-LOCALIZED UP-
 *         TREND.
 *       - otQ << 0 = EDGE-LOCALIZED DOWN-TREND.
 *
 *       otTrendUpSignal = +otQ   ( + = up-trend,
 *                                  - = down-trend )
 *
 *     Both axes are sign-CORRECTLY oriented: positive
 *     = up-trend, negative = down-trend. The compound
 *     classifier operates in the unified
 *     `*TrendUpSignal` frame for unambiguous
 *     direction-comparison.
 *
 * STRUCTURAL ORTHOGONALITY at four levels:
 *
 *   - DIFFERENT SPATIAL LOCALITY (the headline claim).
 *     Page's L scans the ENTIRE INTERIOR in tiny 3-day
 *     chunks and uses every observation; Olmstead-
 *     Tukey uses ONLY the edge run-lengths and IGNORES
 *     the entire interior. A series with smooth interior
 *     drift but sharp edge corners gives otQ != 0 but
 *     pageZ ~ 0 (or vice versa); a series with strong
 *     within-3-day-chunk ordering across all interior
 *     blocks but flat edges gives the opposite.
 *
 *   - DIFFERENT RANK SCOPE.
 *     Page uses LOCAL within-block midranks (only 3
 *     values ranked at a time); OT uses GLOBAL
 *     above/below-median binarization (all n values
 *     binarized against ONE global median). Different
 *     rank resolution.
 *
 *   - DIFFERENT POWER PROFILE.
 *     Page has high power against SMOOTH MONOTONE LOCAL
 *     DRIFTS even with low magnitude (it accumulates
 *     evidence across n/3 blocks). OT has high power
 *     against EDGE-LOCALIZED EXTREMES (the rare-but-
 *     decisive case where the smallest x-points are
 *     all on one side of the median and the largest are
 *     all on the other). For series where the trend is
 *     concentrated entirely in the interior 3-day
 *     blocks (e.g. an even ramp), Page dominates; for
 *     series with extreme bracket values but a noisy
 *     interior, OT dominates.
 *
 *   - DIFFERENT NULL DISTRIBUTION FAMILY.
 *     Page: pageZ ~ N(0, 1) under H0 via Page 1963
 *     exact moments E[L] = 12 b, Var[L] = 2 b for T=3.
 *     OT: each corner-count K_i ~ Geometric(1/2) under
 *     H0, otQ has moment-matched Var = 8.
 *
 * They can:
 *
 *   - AGREE in the "interior-and-edge-monotone-trend"
 *     case: both decisive in the same direction. The
 *     within-block ordering AND the edges all
 *     corroborate the trend. Buckets `robust-up-trend`
 *     and `robust-down-trend` -- the strongest possible
 *     joint local+extremal trend assertion.
 *
 *   - DISAGREE INFORMATIVELY in the "edge-only" case:
 *     otQ decisive but pageZ non-decisive -- a series
 *     whose EDGE EXTREMES drive the trend signal but
 *     whose INTERIOR 3-day blocks are randomly ordered.
 *     Surfaced as `olmstead-tukey-only-up` /
 *     `olmstead-tukey-only-down`.
 *
 *   - SHOW only Page decisive: WITHIN-BLOCK MONOTONE
 *     ORDERING across the interior without edge-
 *     extremal agreement -- a series where the local
 *     3-day chunks ALL drift in the same direction but
 *     the edge values sit near the median. Surfaced as
 *     `page-l-only-up` / `page-l-only-down`.
 *
 *   - DISAGREE ON SIGN: both decisive but in OPPOSITE
 *     directions. Most diagnostic compound case: the
 *     INTERIOR 3-day blocks say up-trend (or down)
 *     while the EDGES say the opposite -- typically
 *     driven by a series with a smooth interior drift
 *     in one direction PLUS counter-extremes at the
 *     bracket. Surfaced as `direction-conflict`.
 *
 *   - NEITHER decisive: `no-evidence`.
 *
 * Buckets (alpha default 0.05):
 *
 *   - `robust-up-trend`: both decisive,
 *     pageTrendUpSignal > 0 AND otTrendUpSignal > 0
 *     (i.e. pageZ > 0 AND otQ > 0).
 *   - `robust-down-trend`: both decisive,
 *     pageTrendUpSignal < 0 AND otTrendUpSignal < 0
 *     (i.e. pageZ < 0 AND otQ < 0).
 *   - `direction-conflict`: both decisive but signs
 *     disagree.
 *   - `page-l-only-up`: page decisive (pageZ > 0 = up),
 *     ot non-decisive.
 *   - `page-l-only-down`: page decisive (pageZ < 0 =
 *     down), ot non-decisive.
 *   - `olmstead-tukey-only-up`: ot decisive (otQ > 0 =
 *     up), page non-decisive.
 *   - `olmstead-tukey-only-down`: ot decisive (otQ < 0
 *     = down), page non-decisive.
 *   - `no-evidence`: neither decisive.
 *
 * Pure function -- no I/O, no globals. Throws on
 * malformed input (duplicate sources, non-finite
 * statistics, pvalue out of (0, 1]). Joins by exact
 * source string match; reports sources only-in-page and
 * only-in-ot separately so callers can see asymmetric
 * coverage.
 *
 * Refs: see axis-213 (Page 1963) and axis-212
 * (Olmstead-Tukey 1947) module headers for primary
 * references.
 */

export interface PageLBlockTrendRowForOlmsteadTukeyCornerCompound {
  source: string;
  pageZ: number;
  pagePValue: number;
}

export interface OlmsteadTukeyCornerRowForPageLBlockCompound {
  source: string;
  otQ: number;
  otZ: number;
  otPValue: number;
}

export type Axis213Axis212PageLOlmsteadTukeyBucket =
  | 'robust-up-trend'
  | 'robust-down-trend'
  | 'direction-conflict'
  | 'page-l-only-up'
  | 'page-l-only-down'
  | 'olmstead-tukey-only-up'
  | 'olmstead-tukey-only-down'
  | 'no-evidence';

export interface Axis213Axis212PageLOlmsteadTukeyJoinedRow {
  source: string;
  pageZ: number;
  pagePValue: number;
  otQ: number;
  otZ: number;
  otPValue: number;
  pageDecisive: boolean;
  otDecisive: boolean;
  /** +pageZ (positive = up-trend; native sign). */
  pageTrendUpSignal: number;
  /** +otQ (positive = up-trend; native sign). */
  otTrendUpSignal: number;
  bucket: Axis213Axis212PageLOlmsteadTukeyBucket;
  /**
   * Joint trend-direction quadrant when both are
   * decisive:
   *   robustUp | robustDown | conflictPageUpOtDown | conflictPageDownOtUp
   * null when either is non-decisive.
   */
  jointDirectionQuadrant:
    | 'robustUp'
    | 'robustDown'
    | 'conflictPageUpOtDown'
    | 'conflictPageDownOtUp'
    | null;
}

export interface Axis213Axis212PageLOlmsteadTukeyReport {
  alpha: number;
  rows: Axis213Axis212PageLOlmsteadTukeyJoinedRow[];
  bucketCounts: Record<Axis213Axis212PageLOlmsteadTukeyBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  byJointDirectionQuadrant: {
    robustUp: number;
    robustDown: number;
    conflictPageUpOtDown: number;
    conflictPageDownOtUp: number;
    anyMissingDecisive: number;
  };
  sourcesOnlyInPageL: string[];
  sourcesOnlyInOlmsteadTukey: string[];
}

export function classifyAxis213Axis212PageLOlmsteadTukeyLocalBlockOrderingVsExtremalCornerTrendCompound(
  pageLRows: ReadonlyArray<PageLBlockTrendRowForOlmsteadTukeyCornerCompound>,
  olmsteadTukeyRows: ReadonlyArray<OlmsteadTukeyCornerRowForPageLBlockCompound>,
  alpha = 0.05,
): Axis213Axis212PageLOlmsteadTukeyReport {
  const fnName =
    'classifyAxis213Axis212PageLOlmsteadTukeyLocalBlockOrderingVsExtremalCornerTrendCompound';
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(`${fnName}: alpha must be in (0, 0.5] (got ${alpha})`);
  }

  const pageBySrc = new Map<
    string,
    PageLBlockTrendRowForOlmsteadTukeyCornerCompound
  >();
  for (const r of pageLRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `${fnName}: page-l row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.pageZ) ||
      !Number.isFinite(r.pagePValue) ||
      r.pagePValue <= 0 ||
      r.pagePValue > 1
    ) {
      throw new Error(
        `${fnName}: page-l row '${r.source}' has invalid pageZ/pagePValue`,
      );
    }
    if (pageBySrc.has(r.source)) {
      throw new Error(`${fnName}: duplicate page-l source '${r.source}'`);
    }
    pageBySrc.set(r.source, r);
  }

  const otBySrc = new Map<
    string,
    OlmsteadTukeyCornerRowForPageLBlockCompound
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

  const sourcesOnlyInPageL: string[] = [];
  const sourcesOnlyInOlmsteadTukey: string[] = [];
  for (const s of pageBySrc.keys()) {
    if (!otBySrc.has(s)) sourcesOnlyInPageL.push(s);
  }
  for (const s of otBySrc.keys()) {
    if (!pageBySrc.has(s)) sourcesOnlyInOlmsteadTukey.push(s);
  }
  sourcesOnlyInPageL.sort();
  sourcesOnlyInOlmsteadTukey.sort();

  const joinedSources: string[] = [];
  for (const s of pageBySrc.keys()) {
    if (otBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: Axis213Axis212PageLOlmsteadTukeyJoinedRow[] = [];
  const bucketCounts: Record<
    Axis213Axis212PageLOlmsteadTukeyBucket,
    number
  > = {
    'robust-up-trend': 0,
    'robust-down-trend': 0,
    'direction-conflict': 0,
    'page-l-only-up': 0,
    'page-l-only-down': 0,
    'olmstead-tukey-only-up': 0,
    'olmstead-tukey-only-down': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  const byJointDirectionQuadrant = {
    robustUp: 0,
    robustDown: 0,
    conflictPageUpOtDown: 0,
    conflictPageDownOtUp: 0,
    anyMissingDecisive: 0,
  };

  for (const src of joinedSources) {
    const page = pageBySrc.get(src)!;
    const ot = otBySrc.get(src)!;
    const pageDecisive = page.pagePValue < alpha;
    const otDecisive = ot.otPValue < alpha;
    const anyDecisive = pageDecisive || otDecisive;
    if (pageDecisive && otDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    const pageTrendUpSignal = page.pageZ;
    const otTrendUpSignal = ot.otQ;

    let bucket: Axis213Axis212PageLOlmsteadTukeyBucket;
    let jointDirectionQuadrant:
      | 'robustUp'
      | 'robustDown'
      | 'conflictPageUpOtDown'
      | 'conflictPageDownOtUp'
      | null = null;

    if (!anyDecisive) {
      bucket = 'no-evidence';
      byJointDirectionQuadrant.anyMissingDecisive += 1;
    } else if (pageDecisive && !otDecisive) {
      bucket = page.pageZ > 0 ? 'page-l-only-up' : 'page-l-only-down';
      byJointDirectionQuadrant.anyMissingDecisive += 1;
    } else if (otDecisive && !pageDecisive) {
      bucket =
        ot.otQ > 0 ? 'olmstead-tukey-only-up' : 'olmstead-tukey-only-down';
      byJointDirectionQuadrant.anyMissingDecisive += 1;
    } else {
      const pageUp = pageTrendUpSignal > 0;
      const otUp = otTrendUpSignal > 0;
      if (pageUp && otUp) {
        bucket = 'robust-up-trend';
        jointDirectionQuadrant = 'robustUp';
        byJointDirectionQuadrant.robustUp += 1;
      } else if (!pageUp && !otUp) {
        bucket = 'robust-down-trend';
        jointDirectionQuadrant = 'robustDown';
        byJointDirectionQuadrant.robustDown += 1;
      } else if (pageUp && !otUp) {
        bucket = 'direction-conflict';
        jointDirectionQuadrant = 'conflictPageUpOtDown';
        byJointDirectionQuadrant.conflictPageUpOtDown += 1;
      } else {
        bucket = 'direction-conflict';
        jointDirectionQuadrant = 'conflictPageDownOtUp';
        byJointDirectionQuadrant.conflictPageDownOtUp += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      pageZ: page.pageZ,
      pagePValue: page.pagePValue,
      otQ: ot.otQ,
      otZ: ot.otZ,
      otPValue: ot.otPValue,
      pageDecisive,
      otDecisive,
      pageTrendUpSignal,
      otTrendUpSignal,
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
    sourcesOnlyInPageL,
    sourcesOnlyInOlmsteadTukey,
  };
}

/**
 * Render a one-line, log-friendly summary of an
 * Axis213Axis212PageLOlmsteadTukeyReport.
 *
 *   axis-213xaxis-212 alpha=<a> n=<rows> both=<k>/<rows> qd[rUp/rDn/cPuOd/cPdOu]=a/b/c/d buckets[ru/rd/dc/plu/pld/otu/otd/ne]=...
 *
 * Pure deterministic; no I/O.
 */
export function summarizeAxis213Axis212PageLOlmsteadTukeyReport(
  report: Axis213Axis212PageLOlmsteadTukeyReport,
): string {
  const n = report.rows.length;
  const a = report.alpha;
  const q = report.byJointDirectionQuadrant;
  const b = report.bucketCounts;
  return (
    `axis-213xaxis-212 alpha=${a} n=${n} both=${report.bothDecisive}/${n} ` +
    `qd[rUp/rDn/cPuOd/cPdOu]=${q.robustUp}/${q.robustDown}/${q.conflictPageUpOtDown}/${q.conflictPageDownOtUp} ` +
    `buckets[ru/rd/dc/plu/pld/otu/otd/ne]=${b['robust-up-trend']}/${b['robust-down-trend']}/${b['direction-conflict']}/${b['page-l-only-up']}/${b['page-l-only-down']}/${b['olmstead-tukey-only-up']}/${b['olmstead-tukey-only-down']}/${b['no-evidence']}`
  );
}
