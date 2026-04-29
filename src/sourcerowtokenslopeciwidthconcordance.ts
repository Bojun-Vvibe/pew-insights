/**
 * source-row-token-slope-ci-width-concordance
 *
 * Width-concordance / precision-agreement diagnostic for the
 * v0.6.219 Deming-slope uncertainty-quantification suite. Consumes
 * the SAME six per-source CIs that v0.6.227 (cross-lens agreement,
 * Jaccard) and v0.6.228 (sign concordance) consume:
 *
 *   1. percentile bootstrap     (v0.6.220)
 *   2. jackknife normal         (v0.6.221)
 *   3. BCa bootstrap            (v0.6.222)
 *   4. studentized-t bootstrap  (v0.6.223)
 *   5. ABC bootstrap            (v0.6.224)
 *   6. profile-likelihood       (v0.6.225)
 *
 * Mechanically distinct from BOTH prior cross-lens diagnostics:
 *
 *   - v0.6.227 measures *interval-geometry agreement* — Jaccard /
 *     overlap of `[ciLower, ciUpper]`. Two lenses can produce
 *     near-identical Jaccard 1.0 yet have wildly different absolute
 *     widths if both intervals collapse around the same point.
 *   - v0.6.228 measures *directional agreement* — fraction of lens
 *     point slopes / CI midpoints / CI exclusion-of-zero that point
 *     the canonical way. A fully sign-unanimous source can still
 *     have one lens claim a 0.001-wide CI and another claim a
 *     1.0-wide CI.
 *
 * This module measures *precision agreement* — do the six lenses
 * AGREE on HOW WIDE the CI is? It quantifies the magnitude
 * disagreement that the prior two diagnostics deliberately ignore.
 *
 * Per source it reports:
 *   - per-lens absolute `width = ciUpper - ciLower`, relative
 *     `relWidth = width / max(|midpoint|, eps)` with `eps = 1e-12`
 *     to keep finite values when midpoint is near zero, and a
 *     1-indexed `widthRank` (1 = narrowest of the 6, 6 = widest);
 *   - `widthMin`, `widthMax`, `widthMedian`, `widthMean` over the
 *     6 lens widths;
 *   - `widthRange = widthMax - widthMin` — absolute precision
 *     spread;
 *   - `widthRatio = widthMax / widthMin` — multiplicative precision
 *     spread; reported as `Infinity` if any lens has width === 0
 *     (a deterministic input where the kernel returned a
 *     point-mass interval) and as `NaN` if all six widths are 0;
 *   - `widthCv` — coefficient of variation `stdev(widths) /
 *     mean(widths)` (population stdev; bias-free here because all
 *     6 lenses are observed, not sampled), in [0, +∞); reported
 *     as 0 when mean is 0;
 *   - `widthGini` — Gini coefficient of the 6-vector of widths,
 *     in [0, 1]; 0 == perfect width agreement (all 6 widths
 *     identical), `5/6 ≈ 0.833` is the supremum (only one lens
 *     carries all the width mass);
 *   - `narrowestLens` / `widestLens` — names of the lens at
 *     `widthRank == 1` and `widthRank == 6` respectively; ties on
 *     the extremes resolve by the canonical lens order
 *     (`SLOPE_SIGN_LENS_NAMES`);
 *   - `tightConsensus` — boolean true iff `widthRatio <= 2` and
 *     all six widths are finite; a heuristic "the lenses agree
 *     within a factor of two on precision" check;
 *   - `widthVsBootstrapMaxRatio` — `widthMax / widthBootstrap`,
 *     measuring how much wider the widest non-bootstrap lens is
 *     than the canonical bootstrap lens; finite >= 1, or
 *     `Infinity` if the bootstrap width is 0.
 *
 * Filters:
 *   - `--alert-disagreement` keeps only sources where
 *     `widthRatio > 3` (precision spread of more than 3×);
 *   - `--alert-superwide` keeps only sources where
 *     `widthVsBootstrapMaxRatio > 10` (some non-bootstrap lens
 *     reports an interval more than 10× wider than the canonical
 *     bootstrap lens).
 *
 * The bootstrap lens is taken as the canonical reference for
 * `widthVsBootstrapMaxRatio` for the same reason v0.6.228 uses it
 * as the canonical sign — it is the lens shipped first (v0.6.220)
 * and the one whose interval is constructed without analytic
 * approximation.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_WIDTH_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeWidthLensName = (typeof SLOPE_WIDTH_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const REL_WIDTH_EPS = 1e-12;

export interface SourceRowTokenSlopeCiWidthConcordanceOptions {
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
  /** If true, only emit sources whose widthRatio > 3. */
  alertDisagreement?: boolean;
  /** If true, only emit sources whose widthVsBootstrapMaxRatio > 10. */
  alertSuperwide?: boolean;
  top?: number | null;
  sort?:
    | 'width-ratio-desc'
    | 'width-ratio-asc'
    | 'width-cv-desc'
    | 'width-cv-asc'
    | 'width-gini-desc'
    | 'width-gini-asc'
    | 'width-range-desc'
    | 'width-range-asc'
    | 'width-vs-bootstrap-desc'
    | 'width-vs-bootstrap-asc'
    | 'width-max-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiWidthConcordancePerLens {
  lens: SlopeWidthLensName;
  ciLower: number;
  ciUpper: number;
  midpoint: number;
  width: number;
  relWidth: number;
  widthRank: number;
}

export interface SourceRowTokenSlopeCiWidthConcordanceRow {
  source: string;
  rowsKept: number;
  perLens: SourceRowTokenSlopeCiWidthConcordancePerLens[];
  widthMin: number;
  widthMax: number;
  widthMedian: number;
  widthMean: number;
  widthRange: number;
  widthRatio: number;
  widthCv: number;
  widthGini: number;
  narrowestLens: SlopeWidthLensName;
  widestLens: SlopeWidthLensName;
  tightConsensus: boolean;
  widthVsBootstrapMaxRatio: number;
}

export interface SourceRowTokenSlopeCiWidthConcordanceReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertDisagreement: boolean;
  alertSuperwide: boolean;
  top: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiWidthConcordanceOptions['sort']>;
  totalSources: number;
  totalRowsKept: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedNotDisagreement: number;
  droppedNotSuperwide: number;
  droppedBelowTopCap: number;
  /** Number of sources with widthRatio > 3 (computed pre-filter). */
  disagreementCount: number;
  /** Number of sources with widthVsBootstrapMaxRatio > 10 (computed pre-filter). */
  superwideCount: number;
  /** Number of sources with tightConsensus == true (computed pre-filter). */
  tightConsensusCount: number;
  sources: SourceRowTokenSlopeCiWidthConcordanceRow[];
}

const VALID_SORTS = [
  'width-ratio-desc',
  'width-ratio-asc',
  'width-cv-desc',
  'width-cv-asc',
  'width-gini-desc',
  'width-gini-asc',
  'width-range-desc',
  'width-range-asc',
  'width-vs-bootstrap-desc',
  'width-vs-bootstrap-asc',
  'width-max-desc',
  'rows',
  'source',
] as const;

/**
 * Population Gini coefficient of a non-negative vector. Returns 0
 * for a constant vector (perfect equality), and approaches
 * `(n - 1) / n` as one element dominates. Returns 0 for empty
 * input or all-zero input.
 */
export function widthGini(values: readonly number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let sum = 0;
  let weighted = 0;
  for (let i = 0; i < n; i++) {
    const v = sorted[i]!;
    if (v < 0) {
      throw new Error(`widthGini requires non-negative values (got ${v})`);
    }
    sum += v;
    weighted += (i + 1) * v;
  }
  if (sum === 0) return 0;
  return (2 * weighted) / (n * sum) - (n + 1) / n;
}

/**
 * Population coefficient of variation `stdev / mean` of a vector.
 * Uses population (uncorrected) variance because all 6 lenses are
 * observed, not sampled. Returns 0 when mean is 0 (no precision
 * disagreement to report on a degenerate zero-width family).
 */
export function widthCoeffOfVariation(values: readonly number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / n;
  if (mean === 0) return 0;
  let ssq = 0;
  for (const v of values) {
    const d = v - mean;
    ssq += d * d;
  }
  return Math.sqrt(ssq / n) / mean;
}

/**
 * Median of a numeric vector. Sorts a copy; does not mutate input.
 * Throws on empty input.
 */
export function median(values: readonly number[]): number {
  const n = values.length;
  if (n === 0) throw new Error('median: empty input');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function buildSourceRowTokenSlopeCiWidthConcordance(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiWidthConcordanceOptions = {},
): SourceRowTokenSlopeCiWidthConcordanceReport {
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
  const alertDisagreement = opts.alertDisagreement ?? false;
  const alertSuperwide = opts.alertSuperwide ?? false;
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'width-ratio-desc';
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
  const lensReports: Record<SlopeWidthLensName, Map<string, PerLensRaw>> = {
    bootstrap: new Map(bootstrapReport.sources.map((r) => [r.source, r])),
    jackknife: new Map(jackknifeReport.sources.map((r) => [r.source, r])),
    bca: new Map(bcaReport.sources.map((r) => [r.source, r])),
    studentizedT: new Map(studReport.sources.map((r) => [r.source, r])),
    abc: new Map(abcReport.sources.map((r) => [r.source, r])),
    profileLikelihood: new Map(profileReport.sources.map((r) => [r.source, r])),
  };

  const allSources = new Set<string>();
  for (const lens of SLOPE_WIDTH_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_WIDTH_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }

  const rows: SourceRowTokenSlopeCiWidthConcordanceRow[] = [];

  for (const s of sharedSources) {
    const widths: number[] = [];
    const perLensRaw: {
      lens: SlopeWidthLensName;
      ciLower: number;
      ciUpper: number;
      midpoint: number;
      width: number;
      relWidth: number;
    }[] = [];
    let rowsKept = 0;
    let bootstrapWidth = 0;
    for (const lens of SLOPE_WIDTH_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const width = hi - lo;
      const midpoint = (lo + hi) / 2;
      const relWidth = width / Math.max(Math.abs(midpoint), REL_WIDTH_EPS);
      if (lens === 'bootstrap') bootstrapWidth = width;
      widths.push(width);
      perLensRaw.push({
        lens,
        ciLower: r.ciLower,
        ciUpper: r.ciUpper,
        midpoint,
        width,
        relWidth,
      });
    }

    // Rank by width (1 = narrowest). Stable tie-break by canonical
    // lens order via the original index.
    const indexed = perLensRaw.map((p, idx) => ({ ...p, _i: idx }));
    indexed.sort((a, b) => {
      if (a.width !== b.width) return a.width - b.width;
      return a._i - b._i;
    });
    const rankByLens = new Map<SlopeWidthLensName, number>();
    indexed.forEach((p, i) => rankByLens.set(p.lens, i + 1));
    const perLens: SourceRowTokenSlopeCiWidthConcordancePerLens[] = perLensRaw.map(
      (p) => ({
        lens: p.lens,
        ciLower: p.ciLower,
        ciUpper: p.ciUpper,
        midpoint: p.midpoint,
        width: p.width,
        relWidth: p.relWidth,
        widthRank: rankByLens.get(p.lens)!,
      }),
    );

    const widthMin = Math.min(...widths);
    const widthMax = Math.max(...widths);
    const widthMedianVal = median(widths);
    const widthMean = widths.reduce((a, b) => a + b, 0) / widths.length;
    const widthRange = widthMax - widthMin;
    let widthRatio: number;
    if (widthMin === 0 && widthMax === 0) widthRatio = NaN;
    else if (widthMin === 0) widthRatio = Infinity;
    else widthRatio = widthMax / widthMin;
    const widthCv = widthCoeffOfVariation(widths);
    const widthGiniVal = widthGini(widths);

    const narrowestLens = perLens.find((p) => p.widthRank === 1)!.lens;
    const widestLens = perLens.find(
      (p) => p.widthRank === SLOPE_WIDTH_LENS_NAMES.length,
    )!.lens;
    const allFinite = widths.every((w) => Number.isFinite(w));
    const tightConsensus =
      allFinite && Number.isFinite(widthRatio) && widthRatio <= 2;
    let widthVsBootstrapMaxRatio: number;
    if (bootstrapWidth === 0 && widthMax === 0) widthVsBootstrapMaxRatio = NaN;
    else if (bootstrapWidth === 0) widthVsBootstrapMaxRatio = Infinity;
    else widthVsBootstrapMaxRatio = widthMax / bootstrapWidth;

    rows.push({
      source: s,
      rowsKept,
      perLens,
      widthMin,
      widthMax,
      widthMedian: widthMedianVal,
      widthMean,
      widthRange,
      widthRatio,
      widthCv,
      widthGini: widthGiniVal,
      narrowestLens,
      widestLens,
      tightConsensus,
      widthVsBootstrapMaxRatio,
    });
  }

  // Pre-filter aggregate counts for header transparency.
  const disagreementCount = rows.filter(
    (r) => Number.isFinite(r.widthRatio) && r.widthRatio > 3,
  ).length;
  const superwideCount = rows.filter(
    (r) =>
      Number.isFinite(r.widthVsBootstrapMaxRatio) &&
      r.widthVsBootstrapMaxRatio > 10,
  ).length;
  const tightConsensusCount = rows.filter((r) => r.tightConsensus).length;

  let filtered = rows;
  let droppedNotDisagreement = 0;
  if (alertDisagreement) {
    const before = filtered.length;
    filtered = filtered.filter(
      (r) => Number.isFinite(r.widthRatio) && r.widthRatio > 3,
    );
    droppedNotDisagreement = before - filtered.length;
  }
  let droppedNotSuperwide = 0;
  if (alertSuperwide) {
    const before = filtered.length;
    filtered = filtered.filter(
      (r) =>
        Number.isFinite(r.widthVsBootstrapMaxRatio) &&
        r.widthVsBootstrapMaxRatio > 10,
    );
    droppedNotSuperwide = before - filtered.length;
  }

  // Sort. Non-finite values (NaN/Infinity) are pushed to the bottom
  // for descending sorts and to the top for ascending sorts so they
  // do not silently dominate or get hidden.
  const numCmp = (
    a: number,
    b: number,
    desc: boolean,
  ): number => {
    const aFin = Number.isFinite(a);
    const bFin = Number.isFinite(b);
    if (aFin && bFin) return desc ? b - a : a - b;
    if (!aFin && !bFin) return 0;
    if (desc) return aFin ? -1 : 1;
    return aFin ? -1 : 1;
  };
  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiWidthConcordanceRow,
      b: SourceRowTokenSlopeCiWidthConcordanceRow,
    ) => number
  > = {
    'width-ratio-desc': (a, b) => numCmp(a.widthRatio, b.widthRatio, true),
    'width-ratio-asc': (a, b) => numCmp(a.widthRatio, b.widthRatio, false),
    'width-cv-desc': (a, b) => b.widthCv - a.widthCv,
    'width-cv-asc': (a, b) => a.widthCv - b.widthCv,
    'width-gini-desc': (a, b) => b.widthGini - a.widthGini,
    'width-gini-asc': (a, b) => a.widthGini - b.widthGini,
    'width-range-desc': (a, b) => b.widthRange - a.widthRange,
    'width-range-asc': (a, b) => a.widthRange - b.widthRange,
    'width-vs-bootstrap-desc': (a, b) =>
      numCmp(a.widthVsBootstrapMaxRatio, b.widthVsBootstrapMaxRatio, true),
    'width-vs-bootstrap-asc': (a, b) =>
      numCmp(a.widthVsBootstrapMaxRatio, b.widthVsBootstrapMaxRatio, false),
    'width-max-desc': (a, b) => b.widthMax - a.widthMax,
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
    alertDisagreement,
    alertSuperwide,
    top,
    sort,
    totalSources: rows.length + droppedMissingLens,
    totalRowsKept,
    sourcesWithAllLenses: rows.length,
    droppedMissingLens,
    droppedNotDisagreement,
    droppedNotSuperwide,
    droppedBelowTopCap,
    disagreementCount,
    superwideCount,
    tightConsensusCount,
    sources: filtered,
  };
}

function fmtFiniteOr(x: number, digits: number, fallback: string): string {
  if (!Number.isFinite(x)) return fallback;
  return x.toFixed(digits);
}

/**
 * Plain-text renderer. Self-contained, no chalk dependency.
 */
export function renderSourceRowTokenSlopeCiWidthConcordance(
  r: SourceRowTokenSlopeCiWidthConcordanceReport,
): string {
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-width-concordance');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses}, shown ${r.sources.length})    rows: ${r.totalRowsKept}    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-disagreement: ${r.alertDisagreement ? 'yes' : 'no'}    alert-superwide: ${r.alertSuperwide ? 'yes' : 'no'}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedNotDisagreement} not-disagreement (alert), ${r.droppedNotSuperwide} not-superwide (alert), ${r.droppedBelowTopCap} below top cap; disagreement: ${r.disagreementCount}; superwide: ${r.superwideCount}; tight-consensus: ${r.tightConsensusCount}`,
  );
  lines.push('');
  if (r.sources.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  widthMin    widthMax    widthRange  widthRatio  widthCv  widthGini  vsBoot   narrow            widest            tight',
  );
  lines.push(
    '---------------  ----  ----------  ----------  ----------  ----------  -------  ---------  -------  ----------------  ----------------  -----',
  );
  for (const row of r.sources) {
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        row.widthMin.toExponential(2).padStart(10),
        row.widthMax.toExponential(2).padStart(10),
        row.widthRange.toExponential(2).padStart(10),
        fmtFiniteOr(row.widthRatio, 3, '   inf').padStart(10),
        row.widthCv.toFixed(4).padStart(7),
        row.widthGini.toFixed(4).padStart(9),
        fmtFiniteOr(row.widthVsBootstrapMaxRatio, 2, '  inf').padStart(7),
        row.narrowestLens.padEnd(16),
        row.widestLens.padEnd(16),
        (row.tightConsensus ? 'yes' : 'NO').padStart(5),
      ].join('  '),
    );
  }
  return lines.join('\n');
}
