/**
 * source-row-token-slope-ci-half-width-entropy
 *
 * Per-source CI HALF-WIDTH SHANNON ENTROPY diagnostic
 * (EIGHTEENTH cross-lens axis) for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six
 * per-source slope CIs as v0.6.227-v0.6.244 (percentile bootstrap,
 * jackknife normal, BCa, studentized-t, ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL SEVENTEEN prior cross-lens
 * diagnostics on TWO fundamental axes:
 *
 *   1. INPUT DOMAIN. Every prior axis operates on the six CI
 *      MIDPOINTS:
 *        - scale axes 1-13 (midpoint-dispersion SD, MAE, scaled
 *          MAD, range coverage volume, gini, ...);
 *        - single-lens identifier axes (LOO drop, precision-pull
 *          max, residual-Z outlier, MAD-vs-MAE tail lens);
 *        - rank/agreement axes on midpoint pairs (Spearman /
 *          Kendall, containment, overlap-graph);
 *        - PAV isotonic monotone fit of midpoint vs WIDTH
 *          (axis 15);
 *        - second-derivative curvature on width-sorted MIDPOINTS
 *          (axis 16);
 *        - tail-mass asymmetry of midpoints around their median
 *          (axis 17).
 *      Width-concordance (axis 3) is the only one that touches
 *      widths, and it does so as a RANK-CORRELATION between width
 *      and midpoint, NOT as an analysis of the width distribution
 *      ITSELF. NONE of the seventeen analyse the half-width
 *      distribution as a probability mass over the six lenses.
 *
 *   2. STATISTIC FAMILY. Axes 1-17 are all drawn from the
 *      moment / quantile / order-statistic / rank / curvature /
 *      asymmetry families. NONE of the seventeen is information-
 *      theoretic. Shannon entropy of a normalised half-width
 *      vector is a fundamentally different statistic family:
 *      it answers "how concentrated is precision in a single
 *      lens?" by quantifying how far the half-width vector is
 *      from a uniform distribution over the six lenses.
 *
 * The diagnostic:
 *
 *   For source s, let h_i = (ciUpper_i - ciLower_i) / 2 be the
 *   half-width of lens i (h_i >= 0). Define
 *
 *     hSum   = sum_i h_i
 *     p_i    = h_i / hSum             (degenerate convention if
 *                                      hSum == 0: uniform 1/6)
 *     H      = - sum_i p_i log2(p_i)  (with 0 log2 0 := 0)
 *     Hnorm  = H / log2(6)            in [0, 1]
 *
 *   Hnorm == 1 ⇔ all six half-widths are equal (precision is
 *                 perfectly uniformly allocated across lenses);
 *   Hnorm == 0 ⇔ one lens carries the entire half-width mass
 *                 (precision is fully concentrated in a single
 *                 lens; the other five are point-masses).
 *
 *   Effective number of lenses:
 *
 *     effLenses = 2^H                in [1, 6]
 *
 *   This is the Hill number of order 1 and is the natural
 *   "how many lenses are effectively contributing precision"
 *   read-out of the entropy.
 *
 *   Concentration is the dual:
 *
 *     concentration = 1 - Hnorm      in [0, 1]
 *
 *   plus the dominant lens (argmax_i h_i, canonical-order tie-
 *   break) and its share p_max.
 *
 * Per-source columns:
 *
 *   - `halfWidths`         — six half-widths in canonical lens
 *                            order;
 *   - `halfWidthSum`       — sum of `halfWidths`;
 *   - `probabilities`      — six normalised h_i in canonical
 *                            order; uniform 1/6 if `halfWidthSum
 *                            == 0`;
 *   - `entropyBits`        — Shannon entropy in bits (>= 0,
 *                            <= log2(6) ≈ 2.5849625);
 *   - `entropyNormalised`  — `entropyBits / log2(6)` in [0, 1];
 *   - `effectiveLenses`    — `2 ** entropyBits` in [1, 6];
 *   - `concentration`      — `1 - entropyNormalised` in [0, 1];
 *   - `dominantLens`       — argmax_i h_i in canonical order
 *                            (ties: canonical first wins);
 *   - `dominantShare`      — `p_max` in [1/6, 1];
 *   - `degenerateFlag`     — `halfWidthSum == 0` boolean. True ⇔
 *                            all six lenses report a degenerate
 *                            (zero-width) CI for this source.
 *
 * Per-report aggregates: `meanEntropyNormalised`,
 * `medianEntropyNormalised`, `meanEffectiveLenses`,
 * `meanConcentration`, `nDegenerate`, `nNearUniform` (count of
 * sources with `entropyNormalised >= NEAR_UNIFORM_THRESHOLD =
 * 0.95`), `nNearConcentrated` (count with `entropyNormalised <=
 * NEAR_CONCENTRATED_THRESHOLD = 0.30`), `globalDominantLens`
 * (mode of `dominantLens`; canonical-order tie-break).
 *
 * Edge cases:
 *   - Source missing from any of the six lenses → not reported
 *     (counted in `droppedMissingLens`).
 *   - All six half-widths zero → `halfWidthSum == 0`, uniform
 *     `probabilities` 1/6, `entropyBits == log2(6)`,
 *     `entropyNormalised == 1`, `effectiveLenses == 6`,
 *     `concentration == 0`, `dominantLens == bootstrap`,
 *     `dominantShare == 1/6`, `degenerateFlag == true`. By
 *     convention a fully-degenerate source is treated as MAX-
 *     entropy (no lens carries more mass than any other) and is
 *     therefore excluded from `nNearConcentrated` but DOES
 *     contribute to `nNearUniform`.
 *   - One lens has half-width zero, others non-zero → `0 log2 0`
 *     contributes 0 to the entropy sum; that lens has
 *     `probabilities[i] == 0`.
 *   - Negative half-width is impossible by construction
 *     (ciUpper >= ciLower after canonicalisation), but the
 *     primitive defends against it and throws.
 *
 * CLI options:
 *   - `--alert-concentration <f>` — only emit sources whose
 *                                   `concentration` is strictly
 *                                   GREATER than `f` (`f` in
 *                                   [0, 1]); surfaces precision-
 *                                   concentrated sources;
 *   - `--alert-uniform <f>`        — only emit sources whose
 *                                   `entropyNormalised` is
 *                                   strictly GREATER than `f`
 *                                   (`f` in [0, 1]); surfaces
 *                                   precision-balanced sources;
 *                                   (`--alert-concentration` and
 *                                   `--alert-uniform` are
 *                                   independently composable;
 *                                   both unset = no filter.)
 *
 * Why an 18th axis: scale, asymmetry, rank, curvature, and
 * monotonicity statistics on the six MIDPOINTS cannot tell you
 * how the PRECISION (i.e. half-width) is allocated across
 * lenses. A source whose midpoints are perfectly concordant
 * across lenses (axes 1-17 all benign) but whose half-widths
 * are 99% concentrated in one lens has wildly uneven precision
 * and is methodologically suspect — that single lens is doing
 * almost all the uncertainty-quantification work. Conversely a
 * source with uniform half-widths across lenses has well-
 * balanced precision allocation regardless of how its midpoints
 * disperse. Half-width Shannon entropy is the only diagnostic
 * in the suite that captures this dimension and is therefore
 * mechanically orthogonal to axes 1-17.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeHalfWidthEntropyLensName =
  (typeof SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES.length;
const LOG2_N_LENSES = Math.log2(N_LENSES);
const NEAR_UNIFORM_THRESHOLD = 0.95;
const NEAR_CONCENTRATED_THRESHOLD = 0.3;

export interface SourceRowTokenSlopeCiHalfWidthEntropyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertConcentration?: number | null;
  alertUniform?: number | null;
  top?: number | null;
  sort?:
    | 'entropy-asc'
    | 'entropy-desc'
    | 'concentration-desc'
    | 'concentration-asc'
    | 'effective-lenses-desc'
    | 'effective-lenses-asc'
    | 'dominant-share-desc'
    | 'halfwidth-sum-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiHalfWidthEntropyRow {
  source: string;
  rowsKept: number;
  halfWidths: number[];
  halfWidthSum: number;
  probabilities: number[];
  entropyBits: number;
  entropyNormalised: number;
  effectiveLenses: number;
  concentration: number;
  dominantLens: SlopeHalfWidthEntropyLensName;
  dominantShare: number;
  degenerateFlag: boolean;
}

export interface SourceRowTokenSlopeCiHalfWidthEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertConcentration: number | null;
  alertUniform: number | null;
  top: number | null;
  sort: NonNullable<
    SourceRowTokenSlopeCiHalfWidthEntropyOptions['sort']
  >;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedAboveAlert: number;
  meanEntropyNormalised: number;
  medianEntropyNormalised: number;
  meanEffectiveLenses: number;
  meanConcentration: number;
  nDegenerate: number;
  nNearUniform: number;
  nNearConcentrated: number;
  globalDominantLens: SlopeHalfWidthEntropyLensName | null;
  rows: SourceRowTokenSlopeCiHalfWidthEntropyRow[];
}

const VALID_SORTS = [
  'entropy-asc',
  'entropy-desc',
  'concentration-desc',
  'concentration-asc',
  'effective-lenses-desc',
  'effective-lenses-asc',
  'dominant-share-desc',
  'halfwidth-sum-desc',
  'rows',
  'source',
] as const;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[m]!;
  return (s[m - 1]! + s[m]!) / 2;
}

/**
 * Pure helper: given six half-widths in CANONICAL lens order,
 * compute the half-width Shannon-entropy diagnostic. Exposed
 * for direct unit-testing.
 */
export function halfWidthEntropy(halfWidths: number[]): {
  halfWidths: number[];
  halfWidthSum: number;
  probabilities: number[];
  entropyBits: number;
  entropyNormalised: number;
  effectiveLenses: number;
  concentration: number;
  dominantLens: SlopeHalfWidthEntropyLensName;
  dominantShare: number;
  degenerateFlag: boolean;
} {
  if (halfWidths.length !== N_LENSES) {
    throw new Error(
      `halfWidthEntropy: expected ${N_LENSES} half-widths (got ${halfWidths.length})`,
    );
  }
  for (const h of halfWidths) {
    if (!Number.isFinite(h)) {
      throw new Error(
        `halfWidthEntropy: half-widths must be finite (got ${h})`,
      );
    }
    if (h < 0) {
      throw new Error(
        `halfWidthEntropy: half-widths must be non-negative (got ${h})`,
      );
    }
  }

  let halfWidthSum = 0;
  for (const h of halfWidths) halfWidthSum += h;

  const probabilities: number[] = new Array(N_LENSES).fill(0);
  let degenerateFlag = false;
  if (halfWidthSum === 0) {
    degenerateFlag = true;
    for (let i = 0; i < N_LENSES; i++) probabilities[i] = 1 / N_LENSES;
  } else {
    for (let i = 0; i < N_LENSES; i++) {
      probabilities[i] = halfWidths[i]! / halfWidthSum;
    }
  }

  let entropyBits = 0;
  for (const p of probabilities) {
    if (p > 0) entropyBits -= p * Math.log2(p);
  }
  // Numerical safety: clamp into [0, log2(N)].
  if (entropyBits < 0) entropyBits = 0;
  if (entropyBits > LOG2_N_LENSES) entropyBits = LOG2_N_LENSES;
  const entropyNormalised = entropyBits / LOG2_N_LENSES;
  const effectiveLenses = Math.pow(2, entropyBits);
  const concentration = 1 - entropyNormalised;

  // dominantLens = argmax_i halfWidths[i] in canonical order
  // (first index wins on ties). For the degenerate (all-zero)
  // case this is bootstrap by canonical-order convention.
  let dominantIdx = 0;
  let dominantHw = halfWidths[0]!;
  for (let i = 1; i < N_LENSES; i++) {
    if (halfWidths[i]! > dominantHw) {
      dominantHw = halfWidths[i]!;
      dominantIdx = i;
    }
  }
  const dominantLens = SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES[dominantIdx]!;
  const dominantShare = probabilities[dominantIdx]!;

  return {
    halfWidths,
    halfWidthSum,
    probabilities,
    entropyBits,
    entropyNormalised,
    effectiveLenses,
    concentration,
    dominantLens,
    dominantShare,
    degenerateFlag,
  };
}

export function buildSourceRowTokenSlopeCiHalfWidthEntropy(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiHalfWidthEntropyOptions = {},
): SourceRowTokenSlopeCiHalfWidthEntropyReport {
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
  const alertConcentration = opts.alertConcentration ?? null;
  if (alertConcentration !== null) {
    if (
      !Number.isFinite(alertConcentration) ||
      alertConcentration < 0 ||
      alertConcentration > 1
    ) {
      throw new Error(
        `alertConcentration must be a finite number in [0, 1] (got ${opts.alertConcentration})`,
      );
    }
  }
  const alertUniform = opts.alertUniform ?? null;
  if (alertUniform !== null) {
    if (
      !Number.isFinite(alertUniform) ||
      alertUniform < 0 ||
      alertUniform > 1
    ) {
      throw new Error(
        `alertUniform must be a finite number in [0, 1] (got ${opts.alertUniform})`,
      );
    }
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'concentration-desc';
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
  const jackknifeReport = buildSourceRowTokenJackknifeSlopeCi(queue, sharedOpts);
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
    SlopeHalfWidthEntropyLensName,
    Map<string, PerLensRaw>
  > = {
    bootstrap: new Map(bootstrapReport.sources.map((r) => [r.source, r])),
    jackknife: new Map(jackknifeReport.sources.map((r) => [r.source, r])),
    bca: new Map(bcaReport.sources.map((r) => [r.source, r])),
    studentizedT: new Map(studReport.sources.map((r) => [r.source, r])),
    abc: new Map(abcReport.sources.map((r) => [r.source, r])),
    profileLikelihood: new Map(
      profileReport.sources.map((r) => [r.source, r]),
    ),
  };

  const allSources = new Set<string>();
  for (const lens of SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiHalfWidthEntropyRow[] = [];
  for (const s of sharedSources) {
    const halfWidths: number[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      halfWidths.push((hi - lo) / 2);
    }
    const computed = halfWidthEntropy(halfWidths);
    rows.push({
      source: s,
      rowsKept,
      ...computed,
    });
  }

  const ents = rows.map((r) => r.entropyNormalised);
  const meanEntropyNormalised =
    ents.length > 0 ? ents.reduce((a, b) => a + b, 0) / ents.length : 0;
  const medianEntropyNormalised = median(ents);
  const effs = rows.map((r) => r.effectiveLenses);
  const meanEffectiveLenses =
    effs.length > 0 ? effs.reduce((a, b) => a + b, 0) / effs.length : 0;
  const concs = rows.map((r) => r.concentration);
  const meanConcentration =
    concs.length > 0 ? concs.reduce((a, b) => a + b, 0) / concs.length : 0;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;
  const nNearUniform = rows.filter(
    (r) => r.entropyNormalised >= NEAR_UNIFORM_THRESHOLD,
  ).length;
  // A degenerate (all-zero) source has entropyNormalised == 1
  // and is therefore by construction NOT near-concentrated.
  const nNearConcentrated = rows.filter(
    (r) => r.entropyNormalised <= NEAR_CONCENTRATED_THRESHOLD,
  ).length;

  let globalDominantLens: SlopeHalfWidthEntropyLensName | null = null;
  if (rows.length > 0) {
    const lensCounts = new Map<SlopeHalfWidthEntropyLensName, number>();
    for (const lens of SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES) lensCounts.set(lens, 0);
    for (const r of rows) {
      lensCounts.set(r.dominantLens, lensCounts.get(r.dominantLens)! + 1);
    }
    let maxL = -1;
    for (const lens of SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES) {
      const c = lensCounts.get(lens)!;
      if (c > maxL) {
        maxL = c;
        globalDominantLens = lens;
      }
    }
  }

  let droppedAboveAlert = 0;
  let filtered = rows;
  if (alertConcentration !== null) {
    const before = filtered.length;
    filtered = filtered.filter(
      (r) => r.concentration > alertConcentration,
    );
    droppedAboveAlert += before - filtered.length;
  }
  if (alertUniform !== null) {
    const before = filtered.length;
    filtered = filtered.filter(
      (r) => r.entropyNormalised > alertUniform,
    );
    droppedAboveAlert += before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiHalfWidthEntropyRow,
      b: SourceRowTokenSlopeCiHalfWidthEntropyRow,
    ) => number
  > = {
    'entropy-asc': (a, b) => a.entropyNormalised - b.entropyNormalised,
    'entropy-desc': (a, b) => b.entropyNormalised - a.entropyNormalised,
    'concentration-desc': (a, b) => b.concentration - a.concentration,
    'concentration-asc': (a, b) => a.concentration - b.concentration,
    'effective-lenses-desc': (a, b) => b.effectiveLenses - a.effectiveLenses,
    'effective-lenses-asc': (a, b) => a.effectiveLenses - b.effectiveLenses,
    'dominant-share-desc': (a, b) => b.dominantShare - a.dominantShare,
    'halfwidth-sum-desc': (a, b) => b.halfWidthSum - a.halfWidthSum,
    rows: (a, b) => b.rowsKept - a.rowsKept,
    source: (a, b) => a.source.localeCompare(b.source),
  };
  filtered = [...filtered].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    return a.source.localeCompare(b.source);
  });
  if (top !== null) filtered = filtered.slice(0, top);

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
    alertConcentration,
    alertUniform,
    top,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    droppedAboveAlert,
    meanEntropyNormalised,
    medianEntropyNormalised,
    meanEffectiveLenses,
    meanConcentration,
    nDegenerate,
    nNearUniform,
    nNearConcentrated,
    globalDominantLens,
    rows: filtered,
  };
}

function fmtNum(x: number, digits = 4): string {
  if (!Number.isFinite(x)) {
    return x === Infinity ? 'inf' : x === -Infinity ? '-inf' : 'NaN';
  }
  return x.toFixed(digits);
}

/**
 * Plain-text renderer.
 */
export function renderSourceRowTokenSlopeCiHalfWidthEntropy(
  r: SourceRowTokenSlopeCiHalfWidthEntropyReport,
  opts: {
    showSummary?: boolean;
    showEntropyAggregate?: boolean;
    showConcentrationAggregate?: boolean;
    showLensAttribution?: boolean;
    showProbabilities?: boolean;
    showEffectiveLensesBuckets?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showEntropyAggregate = opts.showEntropyAggregate ?? false;
  const showConcentrationAggregate = opts.showConcentrationAggregate ?? false;
  const showLensAttribution = opts.showLensAttribution ?? false;
  const showProbabilities = opts.showProbabilities ?? false;
  const showEffectiveLensesBuckets = opts.showEffectiveLensesBuckets ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-half-width-entropy');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-concentration: ${r.alertConcentration ?? '-'}    alert-uniform: ${r.alertUniform ?? '-'}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedAboveAlert} filtered-by-alert; meanEntropyNormalised: ${fmtNum(r.meanEntropyNormalised)}; medianEntropyNormalised: ${fmtNum(r.medianEntropyNormalised)}; meanEffectiveLenses: ${fmtNum(r.meanEffectiveLenses)}; meanConcentration: ${fmtNum(r.meanConcentration)}; nNearUniform: ${r.nNearUniform}; nNearConcentrated: ${r.nNearConcentrated}; nDegenerate: ${r.nDegenerate}; globalDominantLens: ${r.globalDominantLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  Hbits     Hnorm     effLens   concen    domLens            domShare  hwSum       flags',
  );
  lines.push(
    '---------------  ----  --------  --------  --------  --------  -----------------  --------  ----------  -----',
  );
  for (const row of r.rows) {
    const flags: string[] = [];
    if (row.degenerateFlag) flags.push('degen');
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        fmtNum(row.entropyBits).padStart(8),
        fmtNum(row.entropyNormalised).padStart(8),
        fmtNum(row.effectiveLenses).padStart(8),
        fmtNum(row.concentration).padStart(8),
        row.dominantLens.padEnd(17),
        fmtNum(row.dominantShare).padStart(8),
        fmtNum(row.halfWidthSum).padStart(10),
        (flags.join(',') || '-').padEnd(5),
      ].join('  '),
    );
    if (showSummary) {
      const flagStr = flags.length > 0 ? ` (${flags.join(',')})` : '';
      lines.push(
        `    summary: dominantLens=${row.dominantLens}(share=${fmtNum(row.dominantShare)}) Hnorm=${fmtNum(row.entropyNormalised)} effLenses=${fmtNum(row.effectiveLenses)} concentration=${fmtNum(row.concentration)}${flagStr}`,
      );
    }
    if (showProbabilities) {
      const parts: string[] = [];
      for (let i = 0; i < SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES.length; i++) {
        parts.push(
          `${SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES[i]}=${fmtNum(row.probabilities[i]!)}`,
        );
      }
      lines.push(`    probabilities: ${parts.join(' ')}`);
    }
  }
  if (showEntropyAggregate && r.rows.length > 0) {
    const uniFrac = r.nNearUniform / r.rows.length;
    const conFrac = r.nNearConcentrated / r.rows.length;
    lines.push(
      `[entropy aggregate] meanHnorm=${fmtNum(r.meanEntropyNormalised)} medianHnorm=${fmtNum(r.medianEntropyNormalised)} meanEffLenses=${fmtNum(r.meanEffectiveLenses)} nNearUniform=${r.nNearUniform}/${r.rows.length} (${fmtNum(uniFrac, 4)}) nNearConcentrated=${r.nNearConcentrated}/${r.rows.length} (${fmtNum(conFrac, 4)})`,
    );
  }
  if (showConcentrationAggregate && r.rows.length > 0) {
    const degFrac = r.nDegenerate / r.rows.length;
    lines.push(
      `[concentration aggregate] meanConcentration=${fmtNum(r.meanConcentration)} nDegenerate=${r.nDegenerate}/${r.rows.length} (${fmtNum(degFrac, 4)})`,
    );
  }
  if (showLensAttribution && r.rows.length > 0) {
    const counts = new Map<SlopeHalfWidthEntropyLensName, number>();
    for (const lens of SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES) counts.set(lens, 0);
    for (const row of r.rows) {
      counts.set(row.dominantLens, counts.get(row.dominantLens)! + 1);
    }
    const parts: string[] = [];
    for (const lens of SLOPE_HALFWIDTH_ENTROPY_LENS_NAMES) {
      const c = counts.get(lens)!;
      const frac = c / r.rows.length;
      parts.push(`${lens}=${c}/${r.rows.length} (${fmtNum(frac, 4)})`);
    }
    lines.push(
      `[lens attribution] ${parts.join(' ')} globalDominantLens=${r.globalDominantLens ?? '-'}`,
    );
  }
  if (showEffectiveLensesBuckets && r.rows.length > 0) {
    // Five buckets covering the full effLenses range [1, 6]:
    //   [1, 2), [2, 3), [3, 4), [4, 5), [5, 6]
    // The top bucket is closed on both ends so an exactly-uniform
    // source (effLenses == 6) lands in [5, 6].
    const buckets = [0, 0, 0, 0, 0];
    for (const row of r.rows) {
      const e = row.effectiveLenses;
      let idx: number;
      if (e < 2) idx = 0;
      else if (e < 3) idx = 1;
      else if (e < 4) idx = 2;
      else if (e < 5) idx = 3;
      else idx = 4;
      buckets[idx]! += 1;
    }
    const labels = ['[1,2)', '[2,3)', '[3,4)', '[4,5)', '[5,6]'];
    const parts: string[] = [];
    for (let i = 0; i < buckets.length; i++) {
      const c = buckets[i]!;
      const frac = c / r.rows.length;
      parts.push(`${labels[i]}=${c}/${r.rows.length} (${fmtNum(frac, 4)})`);
    }
    lines.push(`[effLenses buckets] ${parts.join(' ')}`);
  }
  return lines.join('\n');
}
