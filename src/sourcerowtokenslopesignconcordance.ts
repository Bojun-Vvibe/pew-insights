/**
 * source-row-token-slope-sign-concordance
 *
 * Sign-concordance diagnostic for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six per-source
 * CIs that v0.6.227 (cross-lens agreement) consumes:
 *
 *   1. percentile bootstrap     (v0.6.220)
 *   2. jackknife normal         (v0.6.221)
 *   3. BCa bootstrap            (v0.6.222)
 *   4. studentized-t bootstrap  (v0.6.223)
 *   5. ABC bootstrap            (v0.6.224)
 *   6. profile-likelihood       (v0.6.225)
 *
 * Mechanically distinct from v0.6.227. v0.6.227 measures *interval
 * geometry agreement* (Jaccard / overlap of `[ciLower, ciUpper]`).
 * This module measures *directional agreement* — the fraction of
 * lenses that point the same way as the per-source point estimate
 * (the bootstrap-lens slope is taken as the canonical point), and
 * separately the fraction of lenses whose CI strictly excludes zero
 * with a consistent sign. Two sources can be perfectly Jaccard-tied
 * (same wide envelope) yet disagree completely on whether the slope
 * is positive or negative; conversely two sources can have nearly
 * disjoint intervals yet agree unanimously on direction. This module
 * makes that distinction explicit.
 *
 * Per source it reports:
 *   - per-lens point slope, CI midpoint, signs of each, and a
 *     `sigDirection` ∈ {'+', '-', '0'} where '+' / '-' mean the
 *     whole CI lies strictly on one side of zero and '0' means the
 *     CI brackets zero (no significant direction at the chosen
 *     confidence level);
 *   - `pointSignConcordance` — fraction of the 6 lens point slopes
 *     whose sign matches the canonical point sign (in [0, 1], denom
 *     6);
 *   - `midpointSignConcordance` — fraction of the 6 lens CI
 *     midpoints whose sign matches the canonical point sign;
 *   - `sigDirectionalConcordance` — fraction of lenses whose CI
 *     excludes zero AND points the same way as the canonical point
 *     (in [0, 1], denom 6; lenses that include zero contribute 0,
 *     not NaN);
 *   - `lensesAllAgreePoint` — true iff all 6 lens point slopes
 *     share a common sign;
 *   - `lensesAllAgreeMidpoint` — true iff all 6 CI midpoints share
 *     a common sign;
 *   - `lensesAllSignificant` — true iff all 6 CIs strictly exclude
 *     zero;
 *   - `lensesAllSignificantSameDirection` — true iff `lensesAllSignificant`
 *     AND every lens points the same way;
 *   - `dominantDirection` ∈ {'+', '-', '0'} — majority point-sign
 *     across the 6 lenses; ties (3-3 or any tie that prevents a
 *     strict majority) resolve to '0';
 *   - `signDispersion` — Shannon entropy (base e) of the 6 lens
 *     point-sign distribution, in [0, ln 3], normalised to
 *     [0, 1] by dividing by ln 3 (so 0 = unanimous sign,
 *     1 = perfectly even split across {+, -, 0}).
 *
 * The point-sign convention treats slope == 0 as the third bin
 * '0' (Math.sign(0) === 0). For continuous Deming fits exact zero
 * is measure-zero in the population, but a degenerate input (e.g.
 * constant y) can produce slope === 0 deterministically and the
 * module reports it accurately rather than coercing to '+' / '-'.
 *
 * The bootstrap lens is taken as the canonical point because it is
 * the lens shipped first (v0.6.220) and is the upstream that every
 * later lens was benchmarked against; it is also the lens whose
 * "point slope" equals the unmodified Deming MLE on the original
 * (un-resampled) row population. Callers can recover any other
 * lens's directional agreement from the per-lens fields.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_SIGN_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeSignLensName = (typeof SLOPE_SIGN_LENS_NAMES)[number];

export type SignBin = '+' | '-' | '0';

const ABSOLUTE_MIN_ROWS = 4;

export interface SourceRowTokenSlopeSignConcordanceOptions {
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
  /** If true, only emit sources whose 6 lens point signs are NOT unanimous. */
  alertSignSplit?: boolean;
  /** If true, only emit sources where at least one lens CI brackets zero. */
  alertAnyInsignificant?: boolean;
  top?: number | null;
  sort?:
    | 'point-concordance-asc'
    | 'point-concordance-desc'
    | 'midpoint-concordance-asc'
    | 'midpoint-concordance-desc'
    | 'sig-concordance-asc'
    | 'sig-concordance-desc'
    | 'sign-dispersion-desc'
    | 'sign-dispersion-asc'
    | 'directional-confidence-asc'
    | 'directional-confidence-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeSignConcordancePerLens {
  lens: SlopeSignLensName;
  slope: number;
  ciLower: number;
  ciUpper: number;
  midpoint: number;
  pointSign: SignBin;
  midpointSign: SignBin;
  /** '+' / '-' when the CI strictly excludes zero, '0' otherwise. */
  sigDirection: SignBin;
  ciExcludesZero: boolean;
}

export interface SourceRowTokenSlopeSignConcordanceRow {
  source: string;
  rowsKept: number;
  /** The bootstrap-lens point slope, treated as canonical. */
  canonicalSlope: number;
  canonicalSign: SignBin;
  perLens: SourceRowTokenSlopeSignConcordancePerLens[];
  pointSignConcordance: number;
  midpointSignConcordance: number;
  sigDirectionalConcordance: number;
  lensesAllAgreePoint: boolean;
  lensesAllAgreeMidpoint: boolean;
  lensesAllSignificant: boolean;
  lensesAllSignificantSameDirection: boolean;
  dominantDirection: SignBin;
  /** Counts of the 6 point signs in {+, -, 0}. Sums to 6. */
  pointSignCounts: { plus: number; minus: number; zero: number };
  /** Normalised Shannon entropy of the 3-bin point-sign histogram, in [0, 1]. */
  signDispersion: number;
  /**
   * Composite directional-confidence score in [0, 1], defined as
   * `pointSignConcordance * sigDirectionalConcordance`. Reaches 1
   * iff every lens's point slope AND every lens's CI agree on the
   * canonical direction; collapses to 0 if either factor is 0.
   * Distinct from both inputs: a source can score
   * `pointSignConcordance == 1` (unanimous direction) and still
   * land at `directionalConfidenceScore == 0` if no lens's CI
   * excludes zero on the canonical side.
   */
  directionalConfidenceScore: number;
}

export interface SourceRowTokenSlopeSignConcordanceReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertSignSplit: boolean;
  alertAnyInsignificant: boolean;
  top: number | null;
  sort: NonNullable<SourceRowTokenSlopeSignConcordanceOptions['sort']>;
  totalSources: number;
  totalRowsKept: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedNotSignSplit: number;
  droppedNotAnyInsignificant: number;
  droppedBelowTopCap: number;
  /** Number of sources with non-unanimous point sign across the 6 lenses. */
  signSplitCount: number;
  /** Number of sources where every lens CI strictly excludes zero. */
  allSignificantCount: number;
  sources: SourceRowTokenSlopeSignConcordanceRow[];
}

const VALID_SORTS = [
  'point-concordance-asc',
  'point-concordance-desc',
  'midpoint-concordance-asc',
  'midpoint-concordance-desc',
  'sig-concordance-asc',
  'sig-concordance-desc',
  'sign-dispersion-desc',
  'sign-dispersion-asc',
  'directional-confidence-asc',
  'directional-confidence-desc',
  'rows',
  'source',
] as const;

/**
 * Sign of a finite real, returned as the 3-bin '+' / '-' / '0'
 * label used throughout this module. Math.sign(0) === 0 is mapped
 * to '0'; NaN slopes are mapped to '0' (callers should not feed
 * NaN, but the choice is deterministic).
 */
export function signBin(x: number): SignBin {
  if (!Number.isFinite(x)) return '0';
  if (x > 0) return '+';
  if (x < 0) return '-';
  return '0';
}

/**
 * Normalised Shannon entropy of a 3-bin counts vector. Returns a
 * value in [0, 1] where 0 == unanimous (one bin holds all mass)
 * and 1 == perfectly even (mass split equally over all 3 bins).
 * Empty input (all counts 0) returns 0.
 */
export function normalisedSignEntropy(
  plus: number,
  minus: number,
  zero: number,
): number {
  const total = plus + minus + zero;
  if (total <= 0) return 0;
  const ps = [plus / total, minus / total, zero / total];
  let h = 0;
  for (const p of ps) {
    if (p > 0) h -= p * Math.log(p);
  }
  return h / Math.log(3);
}

/**
 * Strict majority sign across a 3-bin counts vector. Returns '+' /
 * '-' / '0' when one bin strictly dominates; returns '0' on any tie
 * (including the degenerate 2-2-2 split or an all-zero input).
 */
export function dominantSign(
  plus: number,
  minus: number,
  zero: number,
): SignBin {
  const max = Math.max(plus, minus, zero);
  const winners = [
    plus === max ? '+' : null,
    minus === max ? '-' : null,
    zero === max ? '0' : null,
  ].filter((x): x is SignBin => x !== null);
  if (winners.length === 1) return winners[0]!;
  return '0';
}

export function buildSourceRowTokenSlopeSignConcordance(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeSignConcordanceOptions = {},
): SourceRowTokenSlopeSignConcordanceReport {
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
  const alertSignSplit = opts.alertSignSplit ?? false;
  const alertAnyInsignificant = opts.alertAnyInsignificant ?? false;
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'point-concordance-asc';
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
  const lensReports: Record<SlopeSignLensName, Map<string, PerLensRaw>> = {
    bootstrap: new Map(bootstrapReport.sources.map((r) => [r.source, r])),
    jackknife: new Map(jackknifeReport.sources.map((r) => [r.source, r])),
    bca: new Map(bcaReport.sources.map((r) => [r.source, r])),
    studentizedT: new Map(studReport.sources.map((r) => [r.source, r])),
    abc: new Map(abcReport.sources.map((r) => [r.source, r])),
    profileLikelihood: new Map(profileReport.sources.map((r) => [r.source, r])),
  };

  const allSources = new Set<string>(
    bootstrapReport.sources.map((r) => r.source),
  );
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_SIGN_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  for (const lens of SLOPE_SIGN_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) {
      if (!allSources.has(s)) {
        droppedMissingLens += 1;
        allSources.add(s);
      }
    }
  }

  const rows: SourceRowTokenSlopeSignConcordanceRow[] = [];

  for (const s of sharedSources) {
    const bootstrapRow = lensReports.bootstrap.get(s)!;
    const canonicalSlope = bootstrapRow.slope;
    const canonicalSign = signBin(canonicalSlope);

    const perLens: SourceRowTokenSlopeSignConcordancePerLens[] = [];
    let plus = 0;
    let minus = 0;
    let zero = 0;
    let pointMatch = 0;
    let midpointMatch = 0;
    let sigMatch = 0;
    let allSig = true;
    let allPointSign: SignBin | null = canonicalSign;
    let allMidSign: SignBin | null = null;
    let rowsKept = 0;

    for (const lens of SLOPE_SIGN_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const midpoint = (lo + hi) / 2;
      const pointSign = signBin(r.slope);
      const midpointSign = signBin(midpoint);
      const ciExcludesZero = lo > 0 || hi < 0;
      const sigDirection: SignBin = ciExcludesZero
        ? lo > 0
          ? '+'
          : '-'
        : '0';

      perLens.push({
        lens,
        slope: r.slope,
        ciLower: r.ciLower,
        ciUpper: r.ciUpper,
        midpoint,
        pointSign,
        midpointSign,
        sigDirection,
        ciExcludesZero,
      });

      if (pointSign === '+') plus += 1;
      else if (pointSign === '-') minus += 1;
      else zero += 1;

      if (pointSign === canonicalSign) pointMatch += 1;
      if (midpointSign === canonicalSign) midpointMatch += 1;
      if (ciExcludesZero && sigDirection === canonicalSign) sigMatch += 1;
      if (!ciExcludesZero) allSig = false;

      if (allPointSign !== null && pointSign !== allPointSign) {
        allPointSign = null;
      }
      if (allMidSign === null && lens === 'bootstrap') {
        allMidSign = midpointSign;
      } else if (allMidSign !== null && midpointSign !== allMidSign) {
        allMidSign = null;
      }
    }

    const denom = SLOPE_SIGN_LENS_NAMES.length;
    const pointSignConcordance = pointMatch / denom;
    const midpointSignConcordance = midpointMatch / denom;
    const sigDirectionalConcordance = sigMatch / denom;
    const lensesAllAgreePoint = allPointSign !== null;
    const lensesAllAgreeMidpoint = allMidSign !== null;
    const lensesAllSignificant = allSig;
    const lensesAllSignificantSameDirection =
      allSig && lensesAllAgreePoint && canonicalSign !== '0';
    const dominantDirection = dominantSign(plus, minus, zero);
    const signDispersion = normalisedSignEntropy(plus, minus, zero);

    rows.push({
      source: s,
      rowsKept,
      canonicalSlope,
      canonicalSign,
      perLens,
      pointSignConcordance,
      midpointSignConcordance,
      sigDirectionalConcordance,
      lensesAllAgreePoint,
      lensesAllAgreeMidpoint,
      lensesAllSignificant,
      lensesAllSignificantSameDirection,
      dominantDirection,
      pointSignCounts: { plus, minus, zero },
      signDispersion,
      directionalConfidenceScore: pointSignConcordance * sigDirectionalConcordance,
    });
  }

  let filtered = rows;
  let droppedNotSignSplit = 0;
  if (alertSignSplit) {
    const before = filtered.length;
    filtered = filtered.filter((r) => !r.lensesAllAgreePoint);
    droppedNotSignSplit = before - filtered.length;
  }
  let droppedNotAnyInsignificant = 0;
  if (alertAnyInsignificant) {
    const before = filtered.length;
    filtered = filtered.filter((r) => !r.lensesAllSignificant);
    droppedNotAnyInsignificant = before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeSignConcordanceRow,
      b: SourceRowTokenSlopeSignConcordanceRow,
    ) => number
  > = {
    'point-concordance-asc': (a, b) =>
      a.pointSignConcordance - b.pointSignConcordance,
    'point-concordance-desc': (a, b) =>
      b.pointSignConcordance - a.pointSignConcordance,
    'midpoint-concordance-asc': (a, b) =>
      a.midpointSignConcordance - b.midpointSignConcordance,
    'midpoint-concordance-desc': (a, b) =>
      b.midpointSignConcordance - a.midpointSignConcordance,
    'sig-concordance-asc': (a, b) =>
      a.sigDirectionalConcordance - b.sigDirectionalConcordance,
    'sig-concordance-desc': (a, b) =>
      b.sigDirectionalConcordance - a.sigDirectionalConcordance,
    'sign-dispersion-desc': (a, b) => b.signDispersion - a.signDispersion,
    'sign-dispersion-asc': (a, b) => a.signDispersion - b.signDispersion,
    'directional-confidence-asc': (a, b) =>
      a.directionalConfidenceScore - b.directionalConfidenceScore,
    'directional-confidence-desc': (a, b) =>
      b.directionalConfidenceScore - a.directionalConfidenceScore,
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

  const signSplitCount = rows.filter((r) => !r.lensesAllAgreePoint).length;
  const allSignificantCount = rows.filter((r) => r.lensesAllSignificant).length;
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
    alertSignSplit,
    alertAnyInsignificant,
    top,
    sort,
    totalSources: rows.length + droppedMissingLens,
    totalRowsKept,
    sourcesWithAllLenses: rows.length,
    droppedMissingLens,
    droppedNotSignSplit,
    droppedNotAnyInsignificant,
    droppedBelowTopCap,
    signSplitCount,
    allSignificantCount,
    sources: filtered,
  };
}

/**
 * Plain-text renderer. Self-contained, no chalk dependency.
 */
export function renderSourceRowTokenSlopeSignConcordance(
  r: SourceRowTokenSlopeSignConcordanceReport,
): string {
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-sign-concordance');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses}, shown ${r.sources.length})    rows: ${r.totalRowsKept}    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-sign-split: ${r.alertSignSplit ? 'yes' : 'no'}    alert-any-insignificant: ${r.alertAnyInsignificant ? 'yes' : 'no'}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedNotSignSplit} sign-unanimous (alert), ${r.droppedNotAnyInsignificant} all-significant (alert), ${r.droppedBelowTopCap} below top cap; sign-split: ${r.signSplitCount}; all-significant: ${r.allSignificantCount}`,
  );
  lines.push('');
  if (r.sources.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  canonSign  ptConcord  midConcord  sigConcord  dirConf  +/-/0    domDir  signDisp  allPt  allSig',
  );
  lines.push(
    '---------------  ----  ---------  ---------  ----------  ----------  -------  -------  ------  --------  -----  ------',
  );
  for (const row of r.sources) {
    const counts = `${row.pointSignCounts.plus}/${row.pointSignCounts.minus}/${row.pointSignCounts.zero}`;
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        row.canonicalSign.padStart(9),
        row.pointSignConcordance.toFixed(4).padStart(9),
        row.midpointSignConcordance.toFixed(4).padStart(10),
        row.sigDirectionalConcordance.toFixed(4).padStart(10),
        row.directionalConfidenceScore.toFixed(4).padStart(7),
        counts.padStart(7),
        row.dominantDirection.padStart(6),
        row.signDispersion.toFixed(4).padStart(8),
        (row.lensesAllAgreePoint ? 'yes' : 'NO').padStart(5),
        (row.lensesAllSignificant ? 'yes' : 'NO').padStart(6),
      ].join('  '),
    );
  }
  return lines.join('\n');
}
