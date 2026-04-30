/**
 * source-row-token-slope-ci-tail-mass-asymmetry
 *
 * Per-source CI-MIDPOINT TAIL-MASS ASYMMETRY diagnostic
 * (SEVENTEENTH cross-lens axis) for the v0.6.219 Deming-slope
 * uncertainty-quantification suite. Consumes the SAME six
 * per-source slope CIs as v0.6.227-v0.6.243 (percentile bootstrap,
 * jackknife normal, BCa, studentized-t, ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL SIXTEEN prior cross-lens
 * diagnostics. Every prior axis is one of:
 *
 *   - a SCALE estimate of the six midpoints (midpoint-dispersion
 *     SD, MAE, scaled MAD, range coverage volume, gini, ...);
 *   - a single-lens identifier (LOO drop, precision-pull max,
 *     adversarial extreme, residual-Z outlier, MAD-vs-MAE tail
 *     lens);
 *   - an across-source rank / agreement statistic on lens pairs
 *     (Spearman / Kendall, containment nestedness, overlap-graph
 *     connectivity);
 *   - an order-restricted MONOTONIC fit (PAV isotonic precision-
 *     vs-midpoint, axis 15);
 *   - a discrete second-derivative curvature on width-sorted
 *     midpoints (axis 16).
 *
 * NONE of the sixteen ask: "within ONE source, of the six lens
 * midpoints, which SIDE of the median carries the heavier mass?"
 * Scale axes (SD, MAD, range) are by construction symmetric in
 * the midpoints around their centre. Curvature (axis 16) is
 * computed on midpoints sorted by CI WIDTH (precision proxy), not
 * by midpoint VALUE, and it captures local shape, not the gross
 * left-vs-right asymmetry of the midpoint distribution itself. A
 * source whose midpoints are perfectly symmetric around the
 * median and a source whose midpoints all sit ABOVE the median
 * by the same total absolute deviation can produce identical
 * dispersion / curvature / PAV scores while disagreeing
 * fundamentally on direction.
 *
 * This 17th axis fills exactly that gap by measuring tail-mass
 * asymmetry of the six midpoints around their median:
 *
 *   med        = median of mid_1..mid_6
 *   absDev_i   = |mid_i - med|
 *   absDevSum  = sum_i absDev_i
 *   upperMass  = sum_{i: mid_i > med} (mid_i - med)
 *   lowerMass  = sum_{i: mid_i < med} (med - mid_i)
 *   asymRatio  = upperMass / (upperMass + lowerMass)   in [0, 1]
 *   asymSigned = (upperMass - lowerMass) / absDevSum   in [-1, 1]
 *
 * asymRatio == 0.5  ⇔  upper and lower tails carry equal absolute
 *                      deviation mass (balanced);
 * asymRatio  > 0.5  ⇔  upper tail dominates (lenses skew HIGH);
 * asymRatio  < 0.5  ⇔  lower tail dominates (lenses skew LOW).
 *
 * asymSigned has the same sign as (asymRatio - 0.5) and the same
 * |sign change| structure but is rescaled to [-1, 1] for direct
 * comparison with axis 16's `convexityScore`.
 *
 * Per-source columns:
 *
 *   - `midpointMedian`     — median of the six midpoints;
 *   - `mids`               — six midpoints in canonical lens order;
 *   - `absDeviations`      — |mid_i - median| in canonical order;
 *   - `absDevSum`          — sum of `absDeviations`;
 *   - `upperLensCount`     — number of lenses with mid_i > median;
 *   - `lowerLensCount`     — number of lenses with mid_i < median;
 *   - `tieLensCount`       — number of lenses with mid_i == median;
 *   - `upperLenses`        — lens names (canonical-order) with
 *                            mid_i > median;
 *   - `lowerLenses`        — lens names (canonical-order) with
 *                            mid_i < median;
 *   - `upperTailMass`      — total mid_i - median over upperLenses;
 *   - `lowerTailMass`      — total median - mid_i over lowerLenses;
 *   - `asymmetryRatio`     — upperTailMass / (upperTailMass +
 *                            lowerTailMass) in [0, 1]; convention
 *                            0.5 when both masses are zero;
 *   - `asymmetrySigned`    — (upperTailMass - lowerTailMass) /
 *                            absDevSum in [-1, 1]; convention 0
 *                            when absDevSum == 0;
 *   - `direction`          — `upper` if asymmetrySigned >=
 *                            +DIRECTION_THRESHOLD; `lower` if
 *                            <= -DIRECTION_THRESHOLD; else
 *                            `balanced` (DIRECTION_THRESHOLD =
 *                            0.5);
 *   - `dominantLens`       — argmax_i absDev_i in canonical order
 *                            (the single farthest-from-median
 *                            lens; ties: canonical order);
 *   - `dominantLensSign`   — +1 / -1 / 0 sign of (mid - median) at
 *                            dominantLens;
 *   - `degenerateFlag`     — `absDevSum == 0` boolean. True ⇔ all
 *                            six midpoints identical.
 *
 * Per-report aggregates: `meanAsymmetryRatio` (over reported rows
 * only), `medianAsymmetryRatio`, `meanAsymmetrySigned`,
 * `nUpperDominant`, `nLowerDominant`, `nBalanced`, `nDegenerate`,
 * `globalAsymmetryDirection` (mode of `direction`; ties favour
 * `upper` > `lower` > `balanced`), `globalDominantLens` (mode of
 * `dominantLens`; canonical-order tie-break).
 *
 * Edge cases:
 *   - Source missing from any of the six lenses → not reported
 *     (counted in `droppedMissingLens`).
 *   - All six midpoints identical → `absDevSum == 0`,
 *     `upperTailMass == 0`, `lowerTailMass == 0`,
 *     `asymmetryRatio == 0.5`, `asymmetrySigned == 0`,
 *     `direction == 'balanced'`, `degenerateFlag == true`,
 *     `dominantLens == bootstrap` (canonical first), `dominantLensSign == 0`.
 *   - Source slope CI width zero from any lens → still consumed
 *     (only midpoint matters here).
 *
 * CLI options:
 *   - `--alert-asymmetry <f>` — only emit sources whose
 *                               |asymmetrySigned| is strictly
 *                               GREATER than `f` (`f` in [0, 1]);
 *                               surfaces one-sided sources;
 *   - `--alert-upper`         — only emit sources whose
 *                               `direction == 'upper'`;
 *   - `--alert-lower`         — only emit sources whose
 *                               `direction == 'lower'`;
 *                               (`--alert-upper` and
 *                               `--alert-lower` are mutually
 *                               exclusive; both unset = no
 *                               direction filter; both set throws.)
 *
 * Why a 17th axis: scale axes (1-13) are by construction
 * symmetric in the six midpoints around their centre — they
 * cannot tell whether the SD comes from upward or downward
 * deviation. PAV (axis 15) measures monotone fit of midpoint
 * against WIDTH; second-derivative curvature (axis 16) measures
 * local bending in width-sorted midpoint order. Neither indexes
 * which side of the midpoint median carries more mass. A source
 * whose lens midpoints are 0.20 above the median for the upper
 * three lenses and 0.20 below the median for the lower three
 * gets identical scores under axes 1-16 as a source whose six
 * midpoints are ALL 0.20 above the median except one outlier at
 * -1.00 below. The first is symmetric; the second is heavily
 * lower-tail-dominated. asymmetryRatio is the only diagnostic
 * that distinguishes them and is therefore mechanically
 * orthogonal to axes 1-16.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_TAILMASS_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeTailMassLensName =
  (typeof SLOPE_TAILMASS_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_TAILMASS_LENS_NAMES.length;
const DIRECTION_THRESHOLD = 0.5;

export type AsymmetryDirection = 'upper' | 'lower' | 'balanced';

export interface SourceRowTokenSlopeCiTailMassAsymmetryOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertAsymmetry?: number | null;
  alertUpper?: boolean;
  alertLower?: boolean;
  top?: number | null;
  sort?:
    | 'asymmetry-signed-desc'
    | 'asymmetry-signed-asc'
    | 'asymmetry-abs-desc'
    | 'asymmetry-ratio-desc'
    | 'asymmetry-ratio-asc'
    | 'absdev-sum-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiTailMassAsymmetryRow {
  source: string;
  rowsKept: number;
  midpointMedian: number;
  mids: number[];
  absDeviations: number[];
  absDevSum: number;
  upperLensCount: number;
  lowerLensCount: number;
  tieLensCount: number;
  upperLenses: SlopeTailMassLensName[];
  lowerLenses: SlopeTailMassLensName[];
  upperTailMass: number;
  lowerTailMass: number;
  asymmetryRatio: number;
  asymmetrySigned: number;
  direction: AsymmetryDirection;
  dominantLens: SlopeTailMassLensName;
  dominantLensSign: number;
  degenerateFlag: boolean;
}

export interface SourceRowTokenSlopeCiTailMassAsymmetryReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertAsymmetry: number | null;
  alertUpper: boolean;
  alertLower: boolean;
  top: number | null;
  sort: NonNullable<
    SourceRowTokenSlopeCiTailMassAsymmetryOptions['sort']
  >;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedAboveAlert: number;
  meanAsymmetryRatio: number;
  medianAsymmetryRatio: number;
  meanAsymmetrySigned: number;
  nUpperDominant: number;
  nLowerDominant: number;
  nBalanced: number;
  nDegenerate: number;
  globalAsymmetryDirection: AsymmetryDirection | null;
  globalDominantLens: SlopeTailMassLensName | null;
  rows: SourceRowTokenSlopeCiTailMassAsymmetryRow[];
}

const VALID_SORTS = [
  'asymmetry-signed-desc',
  'asymmetry-signed-asc',
  'asymmetry-abs-desc',
  'asymmetry-ratio-desc',
  'asymmetry-ratio-asc',
  'absdev-sum-desc',
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
 * Pure helper: given six midpoints in CANONICAL lens order,
 * compute the tail-mass-asymmetry diagnostic. Exposed for
 * direct unit-testing.
 */
export function tailMassAsymmetry(mids: number[]): {
  midpointMedian: number;
  mids: number[];
  absDeviations: number[];
  absDevSum: number;
  upperLensCount: number;
  lowerLensCount: number;
  tieLensCount: number;
  upperLenses: SlopeTailMassLensName[];
  lowerLenses: SlopeTailMassLensName[];
  upperTailMass: number;
  lowerTailMass: number;
  asymmetryRatio: number;
  asymmetrySigned: number;
  direction: AsymmetryDirection;
  dominantLens: SlopeTailMassLensName;
  dominantLensSign: number;
  degenerateFlag: boolean;
} {
  if (mids.length !== N_LENSES) {
    throw new Error(
      `tailMassAsymmetry: expected ${N_LENSES} midpoints (got ${mids.length})`,
    );
  }
  for (const m of mids) {
    if (!Number.isFinite(m)) {
      throw new Error(
        `tailMassAsymmetry: midpoints must be finite (got ${m})`,
      );
    }
  }

  const midpointMedian = median(mids);
  const absDeviations: number[] = mids.map((m) =>
    Math.abs(m - midpointMedian),
  );
  let absDevSum = 0;
  for (const a of absDeviations) absDevSum += a;

  const upperLenses: SlopeTailMassLensName[] = [];
  const lowerLenses: SlopeTailMassLensName[] = [];
  let upperTailMass = 0;
  let lowerTailMass = 0;
  let tieLensCount = 0;
  for (let i = 0; i < N_LENSES; i++) {
    const d = mids[i]! - midpointMedian;
    const lens = SLOPE_TAILMASS_LENS_NAMES[i]!;
    if (d > 0) {
      upperLenses.push(lens);
      upperTailMass += d;
    } else if (d < 0) {
      lowerLenses.push(lens);
      lowerTailMass += -d;
    } else {
      tieLensCount += 1;
    }
  }
  const upperLensCount = upperLenses.length;
  const lowerLensCount = lowerLenses.length;

  let asymmetryRatio: number;
  const tailSum = upperTailMass + lowerTailMass;
  if (tailSum === 0) {
    asymmetryRatio = 0.5;
  } else {
    const raw = upperTailMass / tailSum;
    asymmetryRatio = raw < 0 ? 0 : raw > 1 ? 1 : raw;
  }

  let asymmetrySigned: number;
  if (absDevSum === 0) {
    asymmetrySigned = 0;
  } else {
    const raw = (upperTailMass - lowerTailMass) / absDevSum;
    asymmetrySigned = raw < -1 ? -1 : raw > 1 ? 1 : raw;
  }

  let direction: AsymmetryDirection;
  if (asymmetrySigned >= DIRECTION_THRESHOLD) direction = 'upper';
  else if (asymmetrySigned <= -DIRECTION_THRESHOLD) direction = 'lower';
  else direction = 'balanced';

  // dominantLens = argmax_i absDeviations[i] in canonical order
  // (first index wins on ties).
  let dominantIdx = 0;
  let dominantAbs = absDeviations[0]!;
  for (let i = 1; i < N_LENSES; i++) {
    if (absDeviations[i]! > dominantAbs) {
      dominantAbs = absDeviations[i]!;
      dominantIdx = i;
    }
  }
  const dominantLens = SLOPE_TAILMASS_LENS_NAMES[dominantIdx]!;
  const dominantDelta = mids[dominantIdx]! - midpointMedian;
  const dominantLensSign =
    dominantDelta > 0 ? 1 : dominantDelta < 0 ? -1 : 0;

  const degenerateFlag = absDevSum === 0;

  return {
    midpointMedian,
    mids,
    absDeviations,
    absDevSum,
    upperLensCount,
    lowerLensCount,
    tieLensCount,
    upperLenses,
    lowerLenses,
    upperTailMass,
    lowerTailMass,
    asymmetryRatio,
    asymmetrySigned,
    direction,
    dominantLens,
    dominantLensSign,
    degenerateFlag,
  };
}

export function buildSourceRowTokenSlopeCiTailMassAsymmetry(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiTailMassAsymmetryOptions = {},
): SourceRowTokenSlopeCiTailMassAsymmetryReport {
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
  const alertAsymmetry = opts.alertAsymmetry ?? null;
  if (alertAsymmetry !== null) {
    if (
      !Number.isFinite(alertAsymmetry) ||
      alertAsymmetry < 0 ||
      alertAsymmetry > 1
    ) {
      throw new Error(
        `alertAsymmetry must be a finite number in [0, 1] (got ${opts.alertAsymmetry})`,
      );
    }
  }
  const alertUpper = opts.alertUpper ?? false;
  const alertLower = opts.alertLower ?? false;
  if (alertUpper && alertLower) {
    throw new Error(
      'alertUpper and alertLower are mutually exclusive',
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'asymmetry-abs-desc';
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
  const lensReports: Record<SlopeTailMassLensName, Map<string, PerLensRaw>> = {
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
  for (const lens of SLOPE_TAILMASS_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_TAILMASS_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiTailMassAsymmetryRow[] = [];
  for (const s of sharedSources) {
    const mids: number[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_TAILMASS_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      mids.push((lo + hi) / 2);
    }
    const computed = tailMassAsymmetry(mids);
    rows.push({
      source: s,
      rowsKept,
      ...computed,
    });
  }

  const ratios = rows.map((r) => r.asymmetryRatio);
  const meanAsymmetryRatio =
    ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
  const medianAsymmetryRatio = median(ratios);
  const signed = rows.map((r) => r.asymmetrySigned);
  const meanAsymmetrySigned =
    signed.length > 0 ? signed.reduce((a, b) => a + b, 0) / signed.length : 0;
  const nUpperDominant = rows.filter((r) => r.direction === 'upper').length;
  const nLowerDominant = rows.filter((r) => r.direction === 'lower').length;
  const nBalanced = rows.filter((r) => r.direction === 'balanced').length;
  const nDegenerate = rows.filter((r) => r.degenerateFlag).length;

  let globalAsymmetryDirection: AsymmetryDirection | null = null;
  let globalDominantLens: SlopeTailMassLensName | null = null;
  if (rows.length > 0) {
    const counts: Record<AsymmetryDirection, number> = {
      upper: nUpperDominant,
      lower: nLowerDominant,
      balanced: nBalanced,
    };
    const dirOrder: AsymmetryDirection[] = ['upper', 'lower', 'balanced'];
    let maxC = -1;
    for (const d of dirOrder) {
      if (counts[d] > maxC) {
        maxC = counts[d];
        globalAsymmetryDirection = d;
      }
    }
    const lensCounts = new Map<SlopeTailMassLensName, number>();
    for (const lens of SLOPE_TAILMASS_LENS_NAMES) lensCounts.set(lens, 0);
    for (const r of rows) {
      lensCounts.set(r.dominantLens, lensCounts.get(r.dominantLens)! + 1);
    }
    let maxL = -1;
    for (const lens of SLOPE_TAILMASS_LENS_NAMES) {
      const c = lensCounts.get(lens)!;
      if (c > maxL) {
        maxL = c;
        globalDominantLens = lens;
      }
    }
  }

  let droppedAboveAlert = 0;
  let filtered = rows;
  if (alertAsymmetry !== null) {
    const before = filtered.length;
    filtered = filtered.filter(
      (r) => Math.abs(r.asymmetrySigned) > alertAsymmetry,
    );
    droppedAboveAlert += before - filtered.length;
  }
  if (alertUpper) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.direction === 'upper');
    droppedAboveAlert += before - filtered.length;
  }
  if (alertLower) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.direction === 'lower');
    droppedAboveAlert += before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiTailMassAsymmetryRow,
      b: SourceRowTokenSlopeCiTailMassAsymmetryRow,
    ) => number
  > = {
    'asymmetry-signed-desc': (a, b) => b.asymmetrySigned - a.asymmetrySigned,
    'asymmetry-signed-asc': (a, b) => a.asymmetrySigned - b.asymmetrySigned,
    'asymmetry-abs-desc': (a, b) =>
      Math.abs(b.asymmetrySigned) - Math.abs(a.asymmetrySigned),
    'asymmetry-ratio-desc': (a, b) => b.asymmetryRatio - a.asymmetryRatio,
    'asymmetry-ratio-asc': (a, b) => a.asymmetryRatio - b.asymmetryRatio,
    'absdev-sum-desc': (a, b) => b.absDevSum - a.absDevSum,
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
    alertAsymmetry,
    alertUpper,
    alertLower,
    top,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    droppedAboveAlert,
    meanAsymmetryRatio,
    medianAsymmetryRatio,
    meanAsymmetrySigned,
    nUpperDominant,
    nLowerDominant,
    nBalanced,
    nDegenerate,
    globalAsymmetryDirection,
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
export function renderSourceRowTokenSlopeCiTailMassAsymmetry(
  r: SourceRowTokenSlopeCiTailMassAsymmetryReport,
  opts: {
    showSummary?: boolean;
    showAsymmetryAggregate?: boolean;
    showDirectionAggregate?: boolean;
    showTailAttribution?: boolean;
    showLensMembership?: boolean;
  } = {},
): string {
  const showSummary = opts.showSummary ?? false;
  const showAsymmetryAggregate = opts.showAsymmetryAggregate ?? false;
  const showDirectionAggregate = opts.showDirectionAggregate ?? false;
  const showTailAttribution = opts.showTailAttribution ?? false;
  const showLensMembership = opts.showLensMembership ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-tail-mass-asymmetry');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-asymmetry: ${r.alertAsymmetry ?? '-'}    alert-upper: ${r.alertUpper}    alert-lower: ${r.alertLower}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedAboveAlert} filtered-by-alert; meanAsymmetryRatio: ${fmtNum(r.meanAsymmetryRatio)}; medianAsymmetryRatio: ${fmtNum(r.medianAsymmetryRatio)}; meanAsymmetrySigned: ${fmtNum(r.meanAsymmetrySigned)}; nUpperDominant: ${r.nUpperDominant}; nLowerDominant: ${r.nLowerDominant}; nBalanced: ${r.nBalanced}; nDegenerate: ${r.nDegenerate}; globalAsymmetryDirection: ${r.globalAsymmetryDirection ?? '-'}; globalDominantLens: ${r.globalDominantLens ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  direction  asymRatio  asymSigned  upperMass   lowerMass   absDevSum   dominantLens       domSign  flags',
  );
  lines.push(
    '---------------  ----  ---------  ---------  ----------  ----------  ----------  ----------  -----------------  -------  -----',
  );
  for (const row of r.rows) {
    const flags: string[] = [];
    if (row.degenerateFlag) flags.push('degen');
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        row.direction.padEnd(9),
        fmtNum(row.asymmetryRatio).padStart(9),
        fmtNum(row.asymmetrySigned).padStart(10),
        fmtNum(row.upperTailMass).padStart(10),
        fmtNum(row.lowerTailMass).padStart(10),
        fmtNum(row.absDevSum).padStart(10),
        row.dominantLens.padEnd(17),
        String(row.dominantLensSign).padStart(7),
        (flags.join(',') || '-').padEnd(5),
      ].join('  '),
    );
    if (showSummary) {
      const flagStr = flags.length > 0 ? ` (${flags.join(',')})` : '';
      lines.push(
        `    summary: ${row.direction} dominantLens=${row.dominantLens}(sign=${row.dominantLensSign}) asymRatio=${fmtNum(row.asymmetryRatio)} asymSigned=${fmtNum(row.asymmetrySigned)} upperLenses=${row.upperLensCount} lowerLenses=${row.lowerLensCount}${flagStr}`,
      );
    }
    if (showLensMembership) {
      const upperStr = row.upperLenses.length > 0 ? row.upperLenses.join(',') : '-';
      const lowerStr = row.lowerLenses.length > 0 ? row.lowerLenses.join(',') : '-';
      const tieN = row.tieLensCount;
      lines.push(
        `    membership: upper=[${upperStr}] lower=[${lowerStr}] tie=${tieN}`,
      );
    }
  }
  if (showAsymmetryAggregate && r.rows.length > 0) {
    const degFrac = r.nDegenerate / r.rows.length;
    lines.push(
      `[asymmetry aggregate] meanAsymmetryRatio=${fmtNum(r.meanAsymmetryRatio)} medianAsymmetryRatio=${fmtNum(r.medianAsymmetryRatio)} meanAsymmetrySigned=${fmtNum(r.meanAsymmetrySigned)} nDegenerate=${r.nDegenerate}/${r.rows.length} (${fmtNum(degFrac, 4)})`,
    );
  }
  if (showDirectionAggregate && r.rows.length > 0) {
    const upFrac = r.nUpperDominant / r.rows.length;
    const loFrac = r.nLowerDominant / r.rows.length;
    const baFrac = r.nBalanced / r.rows.length;
    lines.push(
      `[direction aggregate] upper=${r.nUpperDominant}/${r.rows.length} (${fmtNum(upFrac, 4)}) lower=${r.nLowerDominant}/${r.rows.length} (${fmtNum(loFrac, 4)}) balanced=${r.nBalanced}/${r.rows.length} (${fmtNum(baFrac, 4)}) globalAsymmetryDirection=${r.globalAsymmetryDirection ?? '-'}`,
    );
  }
  if (showTailAttribution && r.rows.length > 0) {
    const counts = new Map<SlopeTailMassLensName, number>();
    for (const lens of SLOPE_TAILMASS_LENS_NAMES) counts.set(lens, 0);
    for (const row of r.rows) {
      counts.set(row.dominantLens, counts.get(row.dominantLens)! + 1);
    }
    const parts: string[] = [];
    for (const lens of SLOPE_TAILMASS_LENS_NAMES) {
      const c = counts.get(lens)!;
      const frac = c / r.rows.length;
      parts.push(`${lens}=${c}/${r.rows.length} (${fmtNum(frac, 4)})`);
    }
    lines.push(
      `[tail attribution] ${parts.join(' ')} globalDominantLens=${r.globalDominantLens ?? '-'}`,
    );
  }
  return lines.join('\n');
}
