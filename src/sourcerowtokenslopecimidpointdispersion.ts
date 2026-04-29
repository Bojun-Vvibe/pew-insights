/**
 * source-row-token-slope-ci-midpoint-dispersion
 *
 * Per-source CENTRAL-TENDENCY disagreement diagnostic for the
 * v0.6.219 Deming-slope uncertainty-quantification suite. Consumes
 * the SAME six per-source CIs that v0.6.227 (Jaccard), v0.6.228
 * (sign), v0.6.229 (width), and v0.6.230 (overlap-graph topology)
 * consume:
 *
 *   1. percentile bootstrap     (v0.6.220)
 *   2. jackknife normal         (v0.6.221)
 *   3. BCa bootstrap            (v0.6.222)
 *   4. studentized-t bootstrap  (v0.6.223)
 *   5. ABC bootstrap            (v0.6.224)
 *   6. profile-likelihood       (v0.6.225)
 *
 * Mechanically distinct from ALL FOUR prior cross-lens diagnostics:
 *
 *   - v0.6.227 Jaccard / agreementIndex: scalar mean of 15 pairwise
 *     overlap ratios. Loses topology AND loses location.
 *   - v0.6.228 sign concordance: directional only. Two lenses with
 *     midpoints at +0.001 and +1000 are perfectly concordant.
 *   - v0.6.229 width concordance: precision only. Ignores where the
 *     CIs are centered.
 *   - v0.6.230 overlap-graph: topology of the overlap relation.
 *     Reports IF lenses overlap, not WHERE they sit.
 *
 *   This module measures *central-tendency disagreement* — for each
 *   source it summarises the spread of the six CI midpoints. Two
 *   sources whose lenses all overlap (density 1.0) and all have
 *   identical width and identical sign can STILL have very different
 *   midpoint dispersion: one lens family might cluster every midpoint
 *   at slope 0.42 while another spreads them across [0.1, 0.9].
 *
 * Per source we report:
 *
 *   - `midpoints` — 6-vector of `(ciLower + ciUpper) / 2` per lens,
 *     in canonical lens order;
 *   - `midMean`, `midMedian` — central summaries;
 *   - `midMin`, `midMax`, `midRange` — order statistics;
 *   - `midStd` — population standard deviation across the 6
 *     midpoints (n in denominator, not n-1; the 6 lenses are the
 *     full population for each source);
 *   - `midIqr` — interquartile range using linear interpolation
 *     between the closest ranks (Q3 − Q1);
 *   - `midMad` — median absolute deviation from the median;
 *   - `midCv` — coefficient of variation = `midStd / |midMean|`;
 *     when `midMean == 0` this is `Infinity` if `midStd > 0` else `0`;
 *   - `midRangeOverWidthMean` — `midRange` divided by the mean CI
 *     width across the six lenses; in [0, ∞). A "well-calibrated"
 *     source has this < 1 (the family of midpoints is tighter than
 *     a typical CI). > 1 means the lenses disagree on location by
 *     more than a single CI's width — a red flag;
 *   - `argMinLens`, `argMaxLens` — names of the lenses with the
 *     smallest and largest midpoint, in canonical order;
 *   - `outlierLens`, `outlierGap` — the lens furthest from the
 *     median midpoint, and its `|midpoint - midMedian|`. Null when
 *     all midpoints are identical;
 *   - `dispersed` — boolean true iff `midRangeOverWidthMean >= 1`
 *     (location disagreement exceeds a typical CI width);
 *   - `tightlyClustered` — boolean true iff
 *     `midRangeOverWidthMean <= 0.25` (location agreement is at
 *     least 4× tighter than a typical CI width).
 *
 * Order statistics use linear interpolation: with n=6 sorted values
 * `s[0..5]`, Q1 is at index 1.25 (0.75*s[1] + 0.25*s[2]) and Q3 is
 * at index 3.75 (0.25*s[3] + 0.75*s[4]). This matches numpy's
 * default `linear` interpolation so callers can cross-check.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_MIDPOINT_DISPERSION_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeMidpointDispersionLensName =
  (typeof SLOPE_MIDPOINT_DISPERSION_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_MIDPOINT_DISPERSION_LENS_NAMES.length;

export interface SourceRowTokenSlopeCiMidpointDispersionOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Drop sources with fewer than this many kept rows. Integer >= 4. */
  minRows?: number;
  /** Confidence level in (0, 1). Default 0.95. */
  confidence?: number;
  /** Variance ratio for the underlying Deming fit. Finite > 0. Default 1. */
  lambda?: number;
  /** Bootstrap replicate count. Integer >= 100. Default 1000. */
  bootstraps?: number;
  /** LCG seed shared across the three resample-based lenses. Default 42. */
  seed?: number;
  /**
   * If true, only emit sources whose `midRangeOverWidthMean >= 1`
   * (location disagreement exceeds a typical CI width — the lenses
   * disagree on WHERE the slope is by more than a single CI of
   * uncertainty).
   */
  alertDispersed?: boolean;
  /**
   * If true, only emit sources whose `midRangeOverWidthMean <= 0.25`
   * (location agreement at least 4× tighter than a typical CI width
   * — the lenses are surprisingly co-located).
   */
  alertTight?: boolean;
  top?: number | null;
  sort?:
    | 'std-desc'
    | 'std-asc'
    | 'iqr-desc'
    | 'iqr-asc'
    | 'mad-desc'
    | 'mad-asc'
    | 'range-desc'
    | 'range-asc'
    | 'cv-desc'
    | 'cv-asc'
    | 'range-over-width-desc'
    | 'range-over-width-asc'
    | 'outlier-gap-desc'
    | 'outlier-gap-asc'
    | 'mean-desc'
    | 'mean-asc'
    | 'skew-std-desc'
    | 'skew-std-asc'
    | 'skew-sign-desc'
    | 'skew-sign-asc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiMidpointDispersionRow {
  source: string;
  rowsKept: number;
  /** 6-vector in canonical lens order. */
  midpoints: number[];
  midMean: number;
  midMedian: number;
  midMin: number;
  midMax: number;
  midRange: number;
  midStd: number;
  midIqr: number;
  midMad: number;
  midCv: number;
  /** Mean of the six CI widths (`ciUpper - ciLower`) for this source. */
  meanWidth: number;
  /**
   * `midRange / meanWidth`. In [0, ∞). When `meanWidth == 0` this is
   * `0` if `midRange == 0`, else `Infinity`.
   */
  midRangeOverWidthMean: number;
  argMinLens: SlopeMidpointDispersionLensName;
  argMaxLens: SlopeMidpointDispersionLensName;
  /** Lens whose midpoint is furthest from the median. Null iff all six are equal. */
  outlierLens: SlopeMidpointDispersionLensName | null;
  /** `|outlierMidpoint - midMedian|`. 0 iff all midpoints are equal. */
  outlierGap: number;
  /**
   * Sign of `midMean - midMedian` rendered as -1, 0, or +1. Cheap
   * 1-byte indicator of whether the midpoint distribution skews
   * left (mean < median, -1), is symmetric (0), or skews right
   * (mean > median, +1). Useful as a stable group-by key alongside
   * the continuous `midRangeOverWidthMean` headline.
   */
  midSkewSign: -1 | 0 | 1;
  /**
   * `(midMean - midMedian) / midStd`, the standardised non-parametric
   * skew indicator (a.k.a. Pearson's second skewness coefficient
   * divided by std rather than 3). In [-1, 1] for any unimodal
   * distribution; we don't clip. NaN-safe: returns 0 when `midStd == 0`.
   */
  midSkewStd: number;
  dispersed: boolean;
  tightlyClustered: boolean;
}

export interface SourceRowTokenSlopeCiMidpointDispersionReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertDispersed: boolean;
  alertTight: boolean;
  top: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiMidpointDispersionOptions['sort']>;
  totalSources: number;
  totalRowsKept: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedNotDispersed: number;
  droppedNotTight: number;
  droppedBelowTopCap: number;
  /** Number of sources whose `midRangeOverWidthMean >= 1` (pre-filter). */
  dispersedCount: number;
  /** Number of sources whose `midRangeOverWidthMean <= 0.25` (pre-filter). */
  tightlyClusteredCount: number;
  sources: SourceRowTokenSlopeCiMidpointDispersionRow[];
}

const VALID_SORTS = [
  'std-desc',
  'std-asc',
  'iqr-desc',
  'iqr-asc',
  'mad-desc',
  'mad-asc',
  'range-desc',
  'range-asc',
  'cv-desc',
  'cv-asc',
  'range-over-width-desc',
  'range-over-width-asc',
  'outlier-gap-desc',
  'outlier-gap-asc',
  'mean-desc',
  'mean-asc',
  'skew-std-desc',
  'skew-std-asc',
  'skew-sign-desc',
  'skew-sign-asc',
  'rows',
  'source',
] as const;

/**
 * Population standard deviation of `xs` (denominator n). Returns 0
 * for the empty vector or a single-element vector.
 */
export function populationStd(xs: number[]): number {
  if (xs.length < 2) return 0;
  let mean = 0;
  for (const x of xs) mean += x;
  mean /= xs.length;
  let sq = 0;
  for (const x of xs) sq += (x - mean) * (x - mean);
  return Math.sqrt(sq / xs.length);
}

/**
 * Linear-interpolated quantile of `xs` for `q` in [0, 1]. Matches
 * numpy's default `linear` interpolation. Caller need not pre-sort:
 * this function sorts a defensive copy. Empty input throws.
 */
export function linearQuantile(xs: number[], q: number): number {
  if (xs.length === 0) throw new Error('linearQuantile: empty input');
  if (!Number.isFinite(q) || q < 0 || q > 1) {
    throw new Error(`linearQuantile: q must be in [0, 1] (got ${q})`);
  }
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 1) return s[0]!;
  const pos = q * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo]!;
  const frac = pos - lo;
  return s[lo]! * (1 - frac) + s[hi]! * frac;
}

/**
 * Median of `xs`. Linear interpolation between the two middle
 * values for even-length input. Empty input throws.
 */
export function median(xs: number[]): number {
  return linearQuantile(xs, 0.5);
}

/**
 * Median absolute deviation of `xs` from its own median. 0 for
 * single-element input. Empty input throws.
 */
export function medianAbsoluteDeviation(xs: number[]): number {
  if (xs.length === 0) throw new Error('medianAbsoluteDeviation: empty input');
  if (xs.length === 1) return 0;
  const m = median(xs);
  const dev = xs.map((x) => Math.abs(x - m));
  return median(dev);
}

export function buildSourceRowTokenSlopeCiMidpointDispersion(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiMidpointDispersionOptions = {},
): SourceRowTokenSlopeCiMidpointDispersionReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const confidence = opts.confidence ?? 0.95;
  if (!Number.isFinite(confidence) || confidence <= 0 || confidence >= 1) {
    throw new Error(
      `confidence must be a finite number in (0, 1) (got ${opts.confidence})`,
    );
  }
  const lambda = opts.lambda ?? 1;
  if (!Number.isFinite(lambda) || lambda <= 0) {
    throw new Error(
      `lambda must be a finite, strictly positive number (got ${opts.lambda})`,
    );
  }
  const bootstraps = opts.bootstraps ?? 1000;
  if (!Number.isInteger(bootstraps) || bootstraps < 100) {
    throw new Error(
      `bootstraps must be an integer >= 100 (got ${opts.bootstraps})`,
    );
  }
  const seed = opts.seed ?? 42;
  if (!Number.isInteger(seed)) {
    throw new Error(`seed must be an integer (got ${opts.seed})`);
  }
  const alertDispersed = opts.alertDispersed ?? false;
  const alertTight = opts.alertTight ?? false;
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'range-over-width-desc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
    );
  }

  const sharedOpts = {
    since: opts.since ?? null,
    until: opts.until ?? null,
    source: opts.source ?? null,
    minRows,
    confidence,
    lambda,
  };

  const bootstrapReport = buildSourceRowTokenBootstrapSlopeCi(queue, {
    ...sharedOpts,
    bootstraps,
    seed,
  });
  const jackknifeReport = buildSourceRowTokenJackknifeSlopeCi(
    queue,
    sharedOpts,
  );
  const bcaReport = buildSourceRowTokenBcaBootstrapSlopeCi(queue, {
    ...sharedOpts,
    bootstraps,
    seed,
  });
  const studReport = buildSourceRowTokenStudentizedBootstrapSlopeCi(queue, {
    ...sharedOpts,
    bootstraps,
    seed,
  });
  const abcReport = buildSourceRowTokenAbcBootstrapSlopeCi(queue, sharedOpts);
  const profileReport = buildSourceRowTokenProfileLikelihoodSlopeCi(
    queue,
    sharedOpts,
  );

  type PerLensRaw = {
    source: string;
    rowsKept: number;
    slope: number;
    ciLower: number;
    ciUpper: number;
  };
  const lensReports: Record<
    SlopeMidpointDispersionLensName,
    Map<string, PerLensRaw>
  > = {
    bootstrap: new Map(bootstrapReport.sources.map((r) => [r.source, r])),
    jackknife: new Map(jackknifeReport.sources.map((r) => [r.source, r])),
    bca: new Map(bcaReport.sources.map((r) => [r.source, r])),
    studentizedT: new Map(studReport.sources.map((r) => [r.source, r])),
    abc: new Map(abcReport.sources.map((r) => [r.source, r])),
    profileLikelihood: new Map(profileReport.sources.map((r) => [r.source, r])),
  };

  const allSources = new Set<string>();
  for (const lens of SLOPE_MIDPOINT_DISPERSION_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_MIDPOINT_DISPERSION_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }

  const rows: SourceRowTokenSlopeCiMidpointDispersionRow[] = [];

  for (const s of sharedSources) {
    const midpoints: number[] = [];
    const widths: number[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_MIDPOINT_DISPERSION_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      midpoints.push((lo + hi) / 2);
      widths.push(hi - lo);
    }

    let mean = 0;
    for (const v of midpoints) mean += v;
    mean /= N_LENSES;
    const med = median(midpoints);
    let mn = midpoints[0]!;
    let mx = midpoints[0]!;
    let argMinIdx = 0;
    let argMaxIdx = 0;
    for (let i = 1; i < midpoints.length; i++) {
      const v = midpoints[i]!;
      if (v < mn) {
        mn = v;
        argMinIdx = i;
      }
      if (v > mx) {
        mx = v;
        argMaxIdx = i;
      }
    }
    const range = mx - mn;
    const std = populationStd(midpoints);
    const q1 = linearQuantile(midpoints, 0.25);
    const q3 = linearQuantile(midpoints, 0.75);
    const iqr = q3 - q1;
    const mad = medianAbsoluteDeviation(midpoints);
    let cv: number;
    if (mean === 0) {
      cv = std === 0 ? 0 : Infinity;
    } else {
      cv = std / Math.abs(mean);
    }
    let meanWidth = 0;
    for (const w of widths) meanWidth += w;
    meanWidth /= N_LENSES;
    let midRangeOverWidthMean: number;
    if (meanWidth === 0) {
      midRangeOverWidthMean = range === 0 ? 0 : Infinity;
    } else {
      midRangeOverWidthMean = range / meanWidth;
    }
    let outlierLens: SlopeMidpointDispersionLensName | null = null;
    let outlierGap = 0;
    for (let i = 0; i < midpoints.length; i++) {
      const g = Math.abs(midpoints[i]! - med);
      if (g > outlierGap) {
        outlierGap = g;
        outlierLens = SLOPE_MIDPOINT_DISPERSION_LENS_NAMES[i]!;
      }
    }
    const dispersed = midRangeOverWidthMean >= 1;
    const tightlyClustered = midRangeOverWidthMean <= 0.25;
    const meanMinusMed = mean - med;
    const midSkewSign: -1 | 0 | 1 =
      meanMinusMed > 0 ? 1 : meanMinusMed < 0 ? -1 : 0;
    const midSkewStd = std === 0 ? 0 : meanMinusMed / std;

    rows.push({
      source: s,
      rowsKept,
      midpoints,
      midMean: mean,
      midMedian: med,
      midMin: mn,
      midMax: mx,
      midRange: range,
      midStd: std,
      midIqr: iqr,
      midMad: mad,
      midCv: cv,
      meanWidth,
      midRangeOverWidthMean,
      argMinLens: SLOPE_MIDPOINT_DISPERSION_LENS_NAMES[argMinIdx]!,
      argMaxLens: SLOPE_MIDPOINT_DISPERSION_LENS_NAMES[argMaxIdx]!,
      outlierLens,
      outlierGap,
      midSkewSign,
      midSkewStd,
      dispersed,
      tightlyClustered,
    });
  }

  const dispersedCount = rows.filter((r) => r.dispersed).length;
  const tightlyClusteredCount = rows.filter((r) => r.tightlyClustered).length;

  let filtered = rows;
  let droppedNotDispersed = 0;
  if (alertDispersed) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.dispersed);
    droppedNotDispersed = before - filtered.length;
  }
  let droppedNotTight = 0;
  if (alertTight) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.tightlyClustered);
    droppedNotTight = before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiMidpointDispersionRow,
      b: SourceRowTokenSlopeCiMidpointDispersionRow,
    ) => number
  > = {
    'std-desc': (a, b) => b.midStd - a.midStd,
    'std-asc': (a, b) => a.midStd - b.midStd,
    'iqr-desc': (a, b) => b.midIqr - a.midIqr,
    'iqr-asc': (a, b) => a.midIqr - b.midIqr,
    'mad-desc': (a, b) => b.midMad - a.midMad,
    'mad-asc': (a, b) => a.midMad - b.midMad,
    'range-desc': (a, b) => b.midRange - a.midRange,
    'range-asc': (a, b) => a.midRange - b.midRange,
    'cv-desc': (a, b) => b.midCv - a.midCv,
    'cv-asc': (a, b) => a.midCv - b.midCv,
    'range-over-width-desc': (a, b) =>
      b.midRangeOverWidthMean - a.midRangeOverWidthMean,
    'range-over-width-asc': (a, b) =>
      a.midRangeOverWidthMean - b.midRangeOverWidthMean,
    'outlier-gap-desc': (a, b) => b.outlierGap - a.outlierGap,
    'outlier-gap-asc': (a, b) => a.outlierGap - b.outlierGap,
    'mean-desc': (a, b) => b.midMean - a.midMean,
    'mean-asc': (a, b) => a.midMean - b.midMean,
    'skew-std-desc': (a, b) => b.midSkewStd - a.midSkewStd,
    'skew-std-asc': (a, b) => a.midSkewStd - b.midSkewStd,
    'skew-sign-desc': (a, b) => b.midSkewSign - a.midSkewSign,
    'skew-sign-asc': (a, b) => a.midSkewSign - b.midSkewSign,
    rows: (a, b) => b.rowsKept - a.rowsKept,
    source: (a, b) => a.source.localeCompare(b.source),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return a.source.localeCompare(b.source);
  });

  let droppedBelowTopCap = 0;
  if (top !== null && filtered.length > top) {
    droppedBelowTopCap = filtered.length - top;
    filtered = filtered.slice(0, top);
  }

  const totalRowsKept = rows.reduce((acc, r) => acc + r.rowsKept, 0);

  return {
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: opts.source ?? null,
    minRows,
    confidence,
    lambda,
    bootstraps,
    seed,
    alertDispersed,
    alertTight,
    top,
    sort,
    totalSources: rows.length + droppedMissingLens,
    totalRowsKept,
    sourcesWithAllLenses: rows.length,
    droppedMissingLens,
    droppedNotDispersed,
    droppedNotTight,
    droppedBelowTopCap,
    dispersedCount,
    tightlyClusteredCount,
    sources: filtered,
  };
}

function fmtNum(x: number, digits = 4): string {
  if (!Number.isFinite(x)) return x === Infinity ? 'inf' : x === -Infinity ? '-inf' : 'NaN';
  return x.toFixed(digits);
}

/**
 * Plain-text renderer. Self-contained, no chalk dependency.
 */
export function renderSourceRowTokenSlopeCiMidpointDispersion(
  r: SourceRowTokenSlopeCiMidpointDispersionReport,
): string {
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-midpoint-dispersion');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses}, shown ${r.sources.length})    rows: ${r.totalRowsKept}    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-dispersed: ${r.alertDispersed ? 'yes' : 'no'}    alert-tight: ${r.alertTight ? 'yes' : 'no'}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedNotDispersed} not-dispersed (alert), ${r.droppedNotTight} not-tight (alert), ${r.droppedBelowTopCap} below top cap; dispersed: ${r.dispersedCount}; tightly-clustered: ${r.tightlyClusteredCount}`,
  );
  lines.push('');
  if (r.sources.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  midMean   midMed    midStd    midIqr    midMad    midRange  meanWidth  range/W   cv        skewStd   skSg  outlierLens         gap       disp  tight',
  );
  lines.push(
    '---------------  ----  --------  --------  --------  --------  --------  --------  ---------  --------  --------  --------  ----  ------------------  --------  ----  -----',
  );
  for (const row of r.sources) {
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        fmtNum(row.midMean).padStart(8),
        fmtNum(row.midMedian).padStart(8),
        fmtNum(row.midStd).padStart(8),
        fmtNum(row.midIqr).padStart(8),
        fmtNum(row.midMad).padStart(8),
        fmtNum(row.midRange).padStart(8),
        fmtNum(row.meanWidth).padStart(9),
        fmtNum(row.midRangeOverWidthMean).padStart(8),
        fmtNum(row.midCv).padStart(8),
        fmtNum(row.midSkewStd).padStart(8),
        (row.midSkewSign > 0 ? '+1' : row.midSkewSign < 0 ? '-1' : ' 0').padStart(4),
        (row.outlierLens ?? '-').padEnd(18),
        fmtNum(row.outlierGap).padStart(8),
        (row.dispersed ? 'yes' : 'NO').padStart(4),
        (row.tightlyClustered ? 'yes' : 'NO').padStart(5),
      ].join('  '),
    );
  }
  return lines.join('\n');
}
