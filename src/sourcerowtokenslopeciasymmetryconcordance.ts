/**
 * source-row-token-slope-ci-asymmetry-concordance
 *
 * Per-source CI-SHAPE diagnostic for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six per-source
 * slope CIs that the rest of the cross-lens family consumes:
 *
 *   1. percentile bootstrap     (v0.6.220)
 *   2. jackknife normal         (v0.6.221)
 *   3. BCa bootstrap            (v0.6.222)
 *   4. studentized-t bootstrap  (v0.6.223)
 *   5. ABC bootstrap            (v0.6.224)
 *   6. profile-likelihood       (v0.6.225)
 *
 * Mechanically distinct from ALL FIVE prior cross-lens diagnostics:
 *
 *   - v0.6.227 Jaccard (set-overlap): how much do the CI intervals
 *     overlap as sets? Reduces 15 pairwise overlaps to a scalar.
 *   - v0.6.228 sign concordance: do the lenses agree on the SIGN of
 *     the slope? Pure direction.
 *   - v0.6.229 width concordance: do the lenses agree on CI WIDTH?
 *     Pure precision.
 *   - v0.6.230 overlap-graph: TOPOLOGY of the overlap relation
 *     (connectivity, isolates, max-clique).
 *   - v0.6.231 midpoint-dispersion: spread of the CI CENTERS
 *     around their own mean. Pure location.
 *
 *   This module measures something none of those touch: the CI
 *   ASYMMETRY around the point-estimate slope. For each lens we
 *   compute
 *
 *       asym_i = (ciUpper_i - slope_i) - (slope_i - ciLower_i)
 *              = ciUpper_i + ciLower_i - 2 * slope_i
 *
 *   Sign(asym_i) tells you which side of the point estimate is
 *   wider:
 *
 *       +1  -> right tail wider (CI skewed UP / above point)
 *        0  -> symmetric (right tail == left tail)
 *       -1  -> left tail wider  (CI skewed DOWN / below point)
 *
 *   Two CIs with identical midpoint, identical width, and identical
 *   overlap with their peers can have OPPOSITE asymmetry signs:
 *   one's right tail is fat, the other's left tail is fat. That is
 *   information about the underlying score function / pivot
 *   distribution that no other cross-lens diagnostic exposes.
 *
 * Per source we report:
 *
 *   - `asymmetries` — 6-vector of `asym_i` in canonical lens order;
 *   - `signs` — 6-vector of {-1, 0, +1};
 *   - `pluses`, `zeros`, `minuses` — counts of each sign in the 6;
 *   - `dominantSign` — the strict majority sign in {-1, 0, +1}, or
 *     `null` when no sign has > 3 of the 6 lenses (ties);
 *   - `concordance` — `max(pluses, minuses, zeros) / 6` in [1/6, 1].
 *     1.0 means all six lenses agree on which side is wider; 1/6
 *     means they're maximally split (rare with only 6);
 *   - `concordanceMinusBaseline` — `concordance - 1/3`; in
 *     [-1/6, 2/3]. Positive means more agreement than uniform-random
 *     over {-1, 0, +1}; negative would mean less, but with only 6
 *     lenses this can only reach -1/6;
 *   - `dissenters` — list of lens names whose sign disagrees with
 *     the dominant sign. Empty when concordance == 1.0 OR when
 *     there's no dominant sign (tie);
 *   - `meanAsym` — mean of the 6 asymmetries (signed; positive ->
 *     right-skewed CI on average);
 *   - `meanAbsAsym` — mean absolute asymmetry across the 6 lenses;
 *   - `meanWidth` — mean of the 6 CI widths;
 *   - `meanAbsAsymOverWidth` — `meanAbsAsym / meanWidth` in [0, 1];
 *     interpretable as "what fraction of a typical CI's width is
 *     the typical |asymmetry|". 0 == perfectly symmetric on every
 *     lens; 1 == every lens has the point estimate at one of the
 *     CI endpoints (extreme asymmetry);
 *   - `argMaxAbsLens` — name of the lens with the largest
 *     |asym_i|; the worst-asymmetry lens for this source;
 *   - `argMaxAbsValue` — the corresponding signed asymmetry;
 *   - `unanimousAsymmetric` — boolean: all 6 signs are non-zero AND
 *     identical (every lens agrees the CI is asymmetric in the
 *     same direction);
 *   - `unanimousSymmetric` — boolean: all 6 asymmetries are
 *     EXACTLY zero (every lens places the point estimate at the
 *     CI midpoint);
 *   - `mixed` — boolean: the 6 signs include BOTH +1 and -1 (the
 *     lenses disagree on which side is wider — a red flag).
 *
 * Sign computation uses an exact-zero comparator: the floating-
 * point representation comes straight from the lens kernels and
 * we deliberately do NOT apply a tolerance here, because each
 * lens kernel already controls its own numerical regime. A
 * deliberately-symmetric construction (identical resamples,
 * profile likelihood at exact saddle) will return zero exactly.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_ASYMMETRY_CONCORDANCE_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeAsymmetryConcordanceLensName =
  (typeof SLOPE_ASYMMETRY_CONCORDANCE_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_ASYMMETRY_CONCORDANCE_LENS_NAMES.length;

export interface SourceRowTokenSlopeCiAsymmetryConcordanceOptions {
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
   * If true, only emit sources whose 6-lens sign vector contains
   * BOTH +1 and -1 (the lenses disagree on which CI tail is wider).
   */
  alertMixed?: boolean;
  /**
   * If true, only emit sources where all 6 lenses agree on a
   * non-zero asymmetry sign (`unanimousAsymmetric`).
   */
  alertUnanimous?: boolean;
  top?: number | null;
  sort?:
    | 'concordance-desc'
    | 'concordance-asc'
    | 'mean-abs-asym-desc'
    | 'mean-abs-asym-asc'
    | 'mean-abs-over-width-desc'
    | 'mean-abs-over-width-asc'
    | 'mean-asym-desc'
    | 'mean-asym-asc'
    | 'arg-max-abs-desc'
    | 'arg-max-abs-asc'
    | 'pluses-desc'
    | 'minuses-desc'
    | 'zeros-desc'
    | 'dominant-sign-desc'
    | 'dominant-sign-asc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiAsymmetryConcordanceRow {
  source: string;
  rowsKept: number;
  /** 6-vector in canonical lens order. */
  asymmetries: number[];
  /** 6-vector of {-1, 0, +1} in canonical lens order. */
  signs: (-1 | 0 | 1)[];
  pluses: number;
  zeros: number;
  minuses: number;
  /** The strict-majority sign, or null when no bucket has > 3 of 6. */
  dominantSign: -1 | 0 | 1 | null;
  /** `max(pluses, zeros, minuses) / 6` in [1/6, 1]. */
  concordance: number;
  /** `concordance - 1/3`; positive == better than uniform-random. */
  concordanceMinusBaseline: number;
  /** Lens names whose sign != dominantSign. Empty when no dominant. */
  dissenters: SlopeAsymmetryConcordanceLensName[];
  meanAsym: number;
  meanAbsAsym: number;
  meanWidth: number;
  /** `meanAbsAsym / meanWidth`, in [0, 1]. */
  meanAbsAsymOverWidth: number;
  argMaxAbsLens: SlopeAsymmetryConcordanceLensName;
  argMaxAbsValue: number;
  unanimousAsymmetric: boolean;
  unanimousSymmetric: boolean;
  mixed: boolean;
}

export interface SourceRowTokenSlopeCiAsymmetryConcordanceReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertMixed: boolean;
  alertUnanimous: boolean;
  top: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiAsymmetryConcordanceOptions['sort']>;
  totalSources: number;
  totalRowsKept: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedNotMixed: number;
  droppedNotUnanimous: number;
  droppedBelowTopCap: number;
  /** Pre-filter count of sources with `mixed == true`. */
  mixedCount: number;
  /** Pre-filter count of sources with `unanimousAsymmetric == true`. */
  unanimousAsymmetricCount: number;
  /** Pre-filter count of sources with `unanimousSymmetric == true`. */
  unanimousSymmetricCount: number;
  sources: SourceRowTokenSlopeCiAsymmetryConcordanceRow[];
}

const VALID_SORTS = [
  'concordance-desc',
  'concordance-asc',
  'mean-abs-asym-desc',
  'mean-abs-asym-asc',
  'mean-abs-over-width-desc',
  'mean-abs-over-width-asc',
  'mean-asym-desc',
  'mean-asym-asc',
  'arg-max-abs-desc',
  'arg-max-abs-asc',
  'pluses-desc',
  'minuses-desc',
  'zeros-desc',
  'dominant-sign-desc',
  'dominant-sign-asc',
  'rows',
  'source',
] as const;

/**
 * Returns -1, 0, or +1 for a finite numeric input. Non-finite
 * inputs throw — the lens kernels never emit non-finite slopes
 * or CIs (they reject those upstream), so a non-finite here is
 * a contract violation.
 */
export function signOf(x: number): -1 | 0 | 1 {
  if (!Number.isFinite(x)) {
    throw new Error(`signOf: non-finite input (${x})`);
  }
  if (x > 0) return 1;
  if (x < 0) return -1;
  return 0;
}

/**
 * Asymmetry of a CI around its point estimate.
 *
 *   asym = (upper - point) - (point - lower)
 *        = upper + lower - 2 * point
 *
 * Positive => right tail wider; negative => left tail wider; zero
 * => point estimate sits exactly at the CI midpoint.
 *
 * Throws on non-finite inputs.
 */
export function ciAsymmetry(
  ciLower: number,
  ciUpper: number,
  point: number,
): number {
  if (!Number.isFinite(ciLower)) {
    throw new Error(`ciAsymmetry: non-finite ciLower (${ciLower})`);
  }
  if (!Number.isFinite(ciUpper)) {
    throw new Error(`ciAsymmetry: non-finite ciUpper (${ciUpper})`);
  }
  if (!Number.isFinite(point)) {
    throw new Error(`ciAsymmetry: non-finite point (${point})`);
  }
  const lo = Math.min(ciLower, ciUpper);
  const hi = Math.max(ciLower, ciUpper);
  return hi + lo - 2 * point;
}

/**
 * Strict-majority bucket of a 6-vector of signs. Returns the sign
 * that occurs > 3 times, or `null` if no bucket has a strict
 * majority (e.g. 3-3-0, 2-2-2, 3-2-1).
 */
export function dominantSignOf(signs: (-1 | 0 | 1)[]): -1 | 0 | 1 | null {
  let p = 0;
  let z = 0;
  let m = 0;
  for (const s of signs) {
    if (s > 0) p += 1;
    else if (s < 0) m += 1;
    else z += 1;
  }
  const half = signs.length / 2;
  if (p > half) return 1;
  if (m > half) return -1;
  if (z > half) return 0;
  return null;
}

export function buildSourceRowTokenSlopeCiAsymmetryConcordance(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiAsymmetryConcordanceOptions = {},
): SourceRowTokenSlopeCiAsymmetryConcordanceReport {
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
  const alertMixed = opts.alertMixed ?? false;
  const alertUnanimous = opts.alertUnanimous ?? false;
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'concordance-desc';
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
    SlopeAsymmetryConcordanceLensName,
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
  for (const lens of SLOPE_ASYMMETRY_CONCORDANCE_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_ASYMMETRY_CONCORDANCE_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }

  const rows: SourceRowTokenSlopeCiAsymmetryConcordanceRow[] = [];

  for (const s of sharedSources) {
    const asymmetries: number[] = [];
    const signs: (-1 | 0 | 1)[] = [];
    const widths: number[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_ASYMMETRY_CONCORDANCE_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      const a = ciAsymmetry(lo, hi, r.slope);
      asymmetries.push(a);
      signs.push(signOf(a));
      widths.push(hi - lo);
    }

    let p = 0;
    let z = 0;
    let m = 0;
    for (const sg of signs) {
      if (sg > 0) p += 1;
      else if (sg < 0) m += 1;
      else z += 1;
    }
    const dominantSign = dominantSignOf(signs);
    const maxBucket = Math.max(p, z, m);
    const concordance = maxBucket / N_LENSES;
    const concordanceMinusBaseline = concordance - 1 / 3;

    const dissenters: SlopeAsymmetryConcordanceLensName[] = [];
    if (dominantSign !== null) {
      for (let i = 0; i < signs.length; i++) {
        if (signs[i]! !== dominantSign) {
          dissenters.push(SLOPE_ASYMMETRY_CONCORDANCE_LENS_NAMES[i]!);
        }
      }
    }

    let sumAsym = 0;
    let sumAbsAsym = 0;
    let sumWidth = 0;
    let argMaxAbsIdx = 0;
    let argMaxAbsAbs = -1;
    for (let i = 0; i < asymmetries.length; i++) {
      const v = asymmetries[i]!;
      sumAsym += v;
      const av = Math.abs(v);
      sumAbsAsym += av;
      sumWidth += widths[i]!;
      if (av > argMaxAbsAbs) {
        argMaxAbsAbs = av;
        argMaxAbsIdx = i;
      }
    }
    const meanAsym = sumAsym / N_LENSES;
    const meanAbsAsym = sumAbsAsym / N_LENSES;
    const meanWidth = sumWidth / N_LENSES;
    let meanAbsAsymOverWidth: number;
    if (meanWidth === 0) {
      meanAbsAsymOverWidth = meanAbsAsym === 0 ? 0 : Infinity;
    } else {
      meanAbsAsymOverWidth = meanAbsAsym / meanWidth;
    }

    const unanimousSymmetric = z === N_LENSES;
    const unanimousAsymmetric =
      (p === N_LENSES) || (m === N_LENSES);
    const mixed = p > 0 && m > 0;

    rows.push({
      source: s,
      rowsKept,
      asymmetries,
      signs,
      pluses: p,
      zeros: z,
      minuses: m,
      dominantSign,
      concordance,
      concordanceMinusBaseline,
      dissenters,
      meanAsym,
      meanAbsAsym,
      meanWidth,
      meanAbsAsymOverWidth,
      argMaxAbsLens: SLOPE_ASYMMETRY_CONCORDANCE_LENS_NAMES[argMaxAbsIdx]!,
      argMaxAbsValue: asymmetries[argMaxAbsIdx]!,
      unanimousAsymmetric,
      unanimousSymmetric,
      mixed,
    });
  }

  const mixedCount = rows.filter((r) => r.mixed).length;
  const unanimousAsymmetricCount = rows.filter(
    (r) => r.unanimousAsymmetric,
  ).length;
  const unanimousSymmetricCount = rows.filter(
    (r) => r.unanimousSymmetric,
  ).length;

  let filtered = rows;
  let droppedNotMixed = 0;
  if (alertMixed) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.mixed);
    droppedNotMixed = before - filtered.length;
  }
  let droppedNotUnanimous = 0;
  if (alertUnanimous) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.unanimousAsymmetric);
    droppedNotUnanimous = before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiAsymmetryConcordanceRow,
      b: SourceRowTokenSlopeCiAsymmetryConcordanceRow,
    ) => number
  > = {
    'concordance-desc': (a, b) => b.concordance - a.concordance,
    'concordance-asc': (a, b) => a.concordance - b.concordance,
    'mean-abs-asym-desc': (a, b) => b.meanAbsAsym - a.meanAbsAsym,
    'mean-abs-asym-asc': (a, b) => a.meanAbsAsym - b.meanAbsAsym,
    'mean-abs-over-width-desc': (a, b) =>
      b.meanAbsAsymOverWidth - a.meanAbsAsymOverWidth,
    'mean-abs-over-width-asc': (a, b) =>
      a.meanAbsAsymOverWidth - b.meanAbsAsymOverWidth,
    'mean-asym-desc': (a, b) => b.meanAsym - a.meanAsym,
    'mean-asym-asc': (a, b) => a.meanAsym - b.meanAsym,
    'arg-max-abs-desc': (a, b) =>
      Math.abs(b.argMaxAbsValue) - Math.abs(a.argMaxAbsValue),
    'arg-max-abs-asc': (a, b) =>
      Math.abs(a.argMaxAbsValue) - Math.abs(b.argMaxAbsValue),
    'pluses-desc': (a, b) => b.pluses - a.pluses,
    'minuses-desc': (a, b) => b.minuses - a.minuses,
    'zeros-desc': (a, b) => b.zeros - a.zeros,
    'dominant-sign-desc': (a, b) =>
      (b.dominantSign ?? -2) - (a.dominantSign ?? -2),
    'dominant-sign-asc': (a, b) =>
      (a.dominantSign ?? 2) - (b.dominantSign ?? 2),
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
    alertMixed,
    alertUnanimous,
    top,
    sort,
    totalSources: rows.length + droppedMissingLens,
    totalRowsKept,
    sourcesWithAllLenses: rows.length,
    droppedMissingLens,
    droppedNotMixed,
    droppedNotUnanimous,
    droppedBelowTopCap,
    mixedCount,
    unanimousAsymmetricCount,
    unanimousSymmetricCount,
    sources: filtered,
  };
}

function fmtNum(x: number, digits = 4): string {
  if (!Number.isFinite(x)) {
    return x === Infinity ? 'inf' : x === -Infinity ? '-inf' : 'NaN';
  }
  return x.toFixed(digits);
}

function fmtSign(s: -1 | 0 | 1 | null): string {
  if (s === null) return '?';
  if (s > 0) return '+';
  if (s < 0) return '-';
  return '0';
}

/**
 * Plain-text renderer. Self-contained, no chalk dependency.
 *
 * When `showAsymmetries` is true, each source row is followed by a
 * second line printing the canonical 6-vector of asymmetries (one
 * per lens) in fixed order (bootstrap, jackknife, bca,
 * studentizedT, abc, profileLikelihood) -- useful for spotting
 * which specific lens swings the dominant sign without having to
 * re-run with --json.
 */
export function renderSourceRowTokenSlopeCiAsymmetryConcordance(
  r: SourceRowTokenSlopeCiAsymmetryConcordanceReport,
  opts: { showAsymmetries?: boolean } = {},
): string {
  const showAsymmetries = opts.showAsymmetries ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-asymmetry-concordance');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses}, shown ${r.sources.length})    rows: ${r.totalRowsKept}    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-mixed: ${r.alertMixed ? 'yes' : 'no'}    alert-unanimous: ${r.alertUnanimous ? 'yes' : 'no'}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedNotMixed} not-mixed (alert), ${r.droppedNotUnanimous} not-unanimous (alert), ${r.droppedBelowTopCap} below top cap; mixed: ${r.mixedCount}; unanimous-asym: ${r.unanimousAsymmetricCount}; unanimous-sym: ${r.unanimousSymmetricCount}`,
  );
  lines.push('');
  if (r.sources.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  +/0/-  dom  conc    cMinB    meanAsym      meanAbs      mWidth      mAbs/W   argMaxLens          argMaxVal     mix  unA  uS',
  );
  lines.push(
    '---------------  ----  -----  ---  ------  -------  ------------  -----------  ----------  -------  ------------------  ------------  ---  ---  ---',
  );
  for (const row of r.sources) {
    const cnts = `${row.pluses}/${row.zeros}/${row.minuses}`;
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        cnts.padStart(5),
        fmtSign(row.dominantSign).padStart(3),
        row.concordance.toFixed(4).padStart(6),
        row.concordanceMinusBaseline.toFixed(4).padStart(7),
        fmtNum(row.meanAsym).padStart(12),
        fmtNum(row.meanAbsAsym).padStart(11),
        fmtNum(row.meanWidth).padStart(10),
        fmtNum(row.meanAbsAsymOverWidth).padStart(7),
        row.argMaxAbsLens.padEnd(18),
        fmtNum(row.argMaxAbsValue).padStart(12),
        (row.mixed ? 'yes' : 'NO').padStart(3),
        (row.unanimousAsymmetric ? 'yes' : 'NO').padStart(3),
        (row.unanimousSymmetric ? 'yes' : 'NO').padStart(3),
      ].join('  '),
    );
    if (showAsymmetries) {
      const parts: string[] = [];
      for (let i = 0; i < row.asymmetries.length; i++) {
        const lens = SLOPE_ASYMMETRY_CONCORDANCE_LENS_NAMES[i]!;
        parts.push(`${lens}=${fmtNum(row.asymmetries[i]!)}`);
      }
      lines.push(`                 asym: ${parts.join('  ')}`);
    }
  }
  return lines.join('\n');
}
