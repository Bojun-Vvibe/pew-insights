/**
 * source-row-token-slope-ci-lens-residual-z
 *
 * Per-source PER-LENS STUDENTIZED-RESIDUAL diagnostic for the
 * v0.6.219 Deming-slope uncertainty-quantification suite. Consumes
 * the SAME six per-source slope CIs as v0.6.227-v0.6.239
 * (percentile bootstrap, jackknife normal, BCa, studentized-t,
 * ABC, profile-likelihood).
 *
 * Mechanically distinct from ALL TWELVE prior cross-lens
 * diagnostics on a fundamental axis: every prior axis collapses
 * the per-lens information into a single SOURCE-LEVEL scalar
 * (Jaccard, sign agreement, width concordance, overlap-graph
 * density, midpoint dispersion, asymmetry, pair inclusion, rank
 * correlation, coverage volume, LOO sensitivity, precision pull,
 * adversarial envelope range). NONE of them surface a per-LENS
 * diagnostic that says "lens K is the statistical outlier for
 * THIS source, given the per-lens precisions". This 13th axis is
 * the only PER-LENS-PER-SOURCE residual axis in the suite.
 *
 * For each source we compute on the 6 CI midpoints
 * `mid_k = (lo_k + hi_k) / 2` and 6 half-widths
 * `s_k = (hi_k - lo_k) / 2`:
 *
 *   - `equalMid` = arithmetic mean of mid_1..mid_6;
 *   - `lensResidual_k` = `mid_k - equalMid` (signed deviation of
 *     lens k from the equal-weight consensus);
 *   - `lensResidualZ_k` = `lensResidual_k / s_k` when `s_k > 0`,
 *     else 0 by convention. Interpretable as a "z-score"-style
 *     studentized residual: how many CI half-widths of lens k
 *     does its own midpoint sit away from the equal-weight
 *     consensus. A value >= 1 means consensus lies OUTSIDE this
 *     lens's own CI on the relevant side. Sign tells the
 *     direction (positive = this lens reports a HIGHER slope
 *     than consensus);
 *   - `lensResidualAbsZ_k` = `|lensResidualZ_k|`;
 *   - `outlierLens` = lens k* maximizing `lensResidualAbsZ_k`
 *     (canonical-order tie-break);
 *   - `outlierAbsZ` = `lensResidualAbsZ_{k*}` (per-source headline
 *     studentized residual);
 *   - `outlierSigned` = `lensResidualZ_{k*}` (with sign);
 *   - `outlierDirection` = `'up' | 'down' | 'neutral'` derived
 *     from sign of `outlierSigned`;
 *   - `outlierConsensusOutside` = `outlierAbsZ >= 1` boolean —
 *     iff the outlier lens's own CI does NOT contain the
 *     equal-weight consensus on the relevant side. This is the
 *     crisp "this lens disagrees with consensus by more than its
 *     own stated uncertainty" diagnostic;
 *   - `meanAbsZ` = arithmetic mean of `lensResidualAbsZ_1..6`
 *     (overall per-source residual magnitude across all six
 *     lenses, NOT just the worst);
 *   - `nResidualOutside` = count of lenses k with
 *     `lensResidualAbsZ_k >= 1` (i.e. how many lenses individually
 *     fail to contain the equal-weight consensus). Integer in
 *     [0, 6];
 *   - `signAgreement` = `'all-up' | 'all-down' | 'mixed' |
 *     'all-zero'` summarizing the signs of the six residuals.
 *     'mixed' is the typical case; 'all-up' or 'all-down' would
 *     be a degeneracy where every lens deviates from consensus
 *     in the same direction — by construction of the equal-weight
 *     mean, this can only happen when at least one residual is
 *     exactly zero (so it's a near-degeneracy diagnostic);
 *   - `lensConcordanceScore` = `1 / (1 + meanAbsZ)` in (0, 1] —
 *     DEFAULT SORT KEY. 1.0 = every lens midpoint sits exactly
 *     at consensus (no per-lens disagreement); near 0 = the
 *     average lens midpoint is many half-widths away from
 *     consensus.
 *
 * Per-report aggregates: `meanLensConcordance`,
 * `medianLensConcordance`, `meanOutlierAbsZ`,
 * `globalOutlierLens` (mode of `outlierLens` across sources,
 * canonical-order tie-break), `globalOutlierDirection` (mode of
 * `outlierDirection`, ties broken `up` > `down` > `neutral`),
 * `nSourcesWithConsensusOutside` (count of sources where
 * `outlierConsensusOutside` is true).
 *
 * `--alert-discordant <f>` filters to sources whose
 * `lensConcordanceScore` is strictly less than f (in (0, 1]) —
 * i.e. the sources whose lenses most disagree with their own
 * equal-weight consensus.
 *
 * `--alert-outside` filters to sources where
 * `outlierConsensusOutside` is true (i.e. at least one lens's
 * own CI does not contain the equal-weight consensus).
 * Independent of `--alert-discordant`; both can compose.
 *
 * Edge cases:
 *   - Source dropped from any of the six lenses → not reported
 *     (counted in `droppedMissingLens`).
 *   - All six widths == 0 → every `lensResidualZ_k = 0` by
 *     convention; `meanAbsZ = 0`; `lensConcordanceScore = 1`;
 *     `outlierAbsZ = 0`; `outlierDirection = 'neutral'`;
 *     `signAgreement = 'all-zero'`. This is the "every lens is
 *     a degenerate point CI agreeing exactly" branch.
 *   - All six midpoints identical → every residual is exactly 0,
 *     `lensConcordanceScore = 1`, `signAgreement = 'all-zero'`.
 *
 * Why a 13th axis: every prior axis is a SOURCE-LEVEL scalar
 * that aggregates over the six lenses (means, gini, range,
 * graph density, rank correlation, etc.). NONE name a SPECIFIC
 * outlier lens per source with a defensible studentized
 * residual that incorporates that lens's OWN precision. v0.6.238
 * precision-pull comes closest but identifies the dominant
 * (most-precise) lens, not the most-DISCREPANT one. v0.6.239
 * adversarial envelope identifies extreme-up / extreme-down
 * lenses by midpoint only, ignoring lens precision entirely.
 * This axis is the only one that asks the per-lens question:
 * "for THIS source, which lens reports a midpoint that is
 * furthest, in units of its OWN stated half-width, from what
 * the other lenses collectively report?" A large `outlierAbsZ`
 * with `outlierConsensusOutside == true` is the diagnostic
 * signature that one specific lens is meaningfully discrepant
 * and worth flagging in any cross-lens reporting.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_LENS_RESIDUAL_Z_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeLensResidualZLensName =
  (typeof SLOPE_LENS_RESIDUAL_Z_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_LENS_RESIDUAL_Z_LENS_NAMES.length;

export type LensResidualSignAgreement =
  | 'all-up'
  | 'all-down'
  | 'mixed'
  | 'all-zero';

export interface SourceRowTokenSlopeCiLensResidualZOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertDiscordant?: number | null;
  alertOutside?: boolean;
  top?: number | null;
  sort?:
    | 'concordance-desc'
    | 'concordance-asc'
    | 'outlier-abs-z-desc'
    | 'outlier-abs-z-asc'
    | 'mean-abs-z-desc'
    | 'mean-abs-z-asc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiLensResidualZRow {
  source: string;
  rowsKept: number;
  equalMid: number;
  lensResiduals: number[]; // signed, length 6, canonical lens order
  lensResidualZ: number[]; // signed studentized, length 6
  lensResidualAbsZ: number[]; // absolute studentized, length 6
  outlierLens: SlopeLensResidualZLensName;
  outlierAbsZ: number;
  outlierSigned: number;
  outlierDirection: 'up' | 'down' | 'neutral';
  outlierConsensusOutside: boolean;
  meanAbsZ: number;
  nResidualOutside: number;
  signAgreement: LensResidualSignAgreement;
  lensConcordanceScore: number;
}

export interface SourceRowTokenSlopeCiLensResidualZReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertDiscordant: number | null;
  alertOutside: boolean;
  top: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiLensResidualZOptions['sort']>;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedAboveAlert: number;
  meanLensConcordance: number;
  medianLensConcordance: number;
  meanOutlierAbsZ: number;
  globalOutlierLens: SlopeLensResidualZLensName | null;
  globalOutlierDirection: 'up' | 'down' | 'neutral' | null;
  nSourcesWithConsensusOutside: number;
  rows: SourceRowTokenSlopeCiLensResidualZRow[];
}

const VALID_SORTS = [
  'concordance-desc',
  'concordance-asc',
  'outlier-abs-z-desc',
  'outlier-abs-z-asc',
  'mean-abs-z-desc',
  'mean-abs-z-asc',
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
 * Pure helper: given 6 midpoints and 6 widths in canonical lens
 * order, compute the per-lens studentized-residual diagnostic
 * for that source. Exposed for direct unit-testing.
 */
export function lensResidualZ(
  mids: number[],
  widths: number[],
): {
  equalMid: number;
  lensResiduals: number[];
  lensResidualZ: number[];
  lensResidualAbsZ: number[];
  outlierLens: SlopeLensResidualZLensName;
  outlierAbsZ: number;
  outlierSigned: number;
  outlierDirection: 'up' | 'down' | 'neutral';
  outlierConsensusOutside: boolean;
  meanAbsZ: number;
  nResidualOutside: number;
  signAgreement: LensResidualSignAgreement;
  lensConcordanceScore: number;
} {
  if (mids.length !== N_LENSES || widths.length !== N_LENSES) {
    throw new Error(
      `lensResidualZ: expected ${N_LENSES} midpoints and widths (got mids=${mids.length}, widths=${widths.length})`,
    );
  }
  for (const m of mids) {
    if (!Number.isFinite(m)) {
      throw new Error(`lensResidualZ: midpoints must be finite (got ${m})`);
    }
  }
  for (const w of widths) {
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(
        `lensResidualZ: widths must be finite and non-negative (got ${w})`,
      );
    }
  }

  let sumMid = 0;
  for (let i = 0; i < N_LENSES; i++) sumMid += mids[i]!;
  const equalMid = sumMid / N_LENSES;

  const lensResiduals: number[] = new Array(N_LENSES);
  const lensResidualZArr: number[] = new Array(N_LENSES);
  const lensResidualAbsZ: number[] = new Array(N_LENSES);
  for (let i = 0; i < N_LENSES; i++) {
    const r = mids[i]! - equalMid;
    lensResiduals[i] = r;
    const halfWidth = widths[i]! / 2;
    const z = halfWidth === 0 ? 0 : r / halfWidth;
    lensResidualZArr[i] = z;
    lensResidualAbsZ[i] = Math.abs(z);
  }

  // Outlier = max abs Z, canonical-order tie-break.
  let outlierIdx = 0;
  let outlierAbsZ = lensResidualAbsZ[0]!;
  for (let i = 1; i < N_LENSES; i++) {
    if (lensResidualAbsZ[i]! > outlierAbsZ) {
      outlierAbsZ = lensResidualAbsZ[i]!;
      outlierIdx = i;
    }
  }
  const outlierLens = SLOPE_LENS_RESIDUAL_Z_LENS_NAMES[outlierIdx]!;
  const outlierSigned = lensResidualZArr[outlierIdx]!;
  let outlierDirection: 'up' | 'down' | 'neutral';
  if (outlierSigned > 0) outlierDirection = 'up';
  else if (outlierSigned < 0) outlierDirection = 'down';
  else outlierDirection = 'neutral';
  const outlierConsensusOutside = outlierAbsZ >= 1;

  let sumAbsZ = 0;
  for (let i = 0; i < N_LENSES; i++) sumAbsZ += lensResidualAbsZ[i]!;
  const meanAbsZ = sumAbsZ / N_LENSES;

  let nResidualOutside = 0;
  for (let i = 0; i < N_LENSES; i++) {
    if (lensResidualAbsZ[i]! >= 1) nResidualOutside += 1;
  }

  let nUp = 0;
  let nDown = 0;
  let nZero = 0;
  for (let i = 0; i < N_LENSES; i++) {
    const r = lensResiduals[i]!;
    if (r > 0) nUp += 1;
    else if (r < 0) nDown += 1;
    else nZero += 1;
  }
  let signAgreement: LensResidualSignAgreement;
  if (nZero === N_LENSES) signAgreement = 'all-zero';
  else if (nDown === 0 && nUp > 0) signAgreement = 'all-up';
  else if (nUp === 0 && nDown > 0) signAgreement = 'all-down';
  else signAgreement = 'mixed';

  const lensConcordanceScore = 1 / (1 + meanAbsZ);

  return {
    equalMid,
    lensResiduals,
    lensResidualZ: lensResidualZArr,
    lensResidualAbsZ,
    outlierLens,
    outlierAbsZ,
    outlierSigned,
    outlierDirection,
    outlierConsensusOutside,
    meanAbsZ,
    nResidualOutside,
    signAgreement,
    lensConcordanceScore,
  };
}

export function buildSourceRowTokenSlopeCiLensResidualZ(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiLensResidualZOptions = {},
): SourceRowTokenSlopeCiLensResidualZReport {
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
  const alertDiscordant = opts.alertDiscordant ?? null;
  if (alertDiscordant !== null) {
    if (
      !Number.isFinite(alertDiscordant) ||
      alertDiscordant <= 0 ||
      alertDiscordant > 1
    ) {
      throw new Error(
        `alertDiscordant must be a finite number in (0, 1] (got ${opts.alertDiscordant})`,
      );
    }
  }
  const alertOutside = opts.alertOutside ?? false;
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
    SlopeLensResidualZLensName,
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
  for (const lens of SLOPE_LENS_RESIDUAL_Z_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_LENS_RESIDUAL_Z_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiLensResidualZRow[] = [];
  for (const s of sharedSources) {
    const mids: number[] = [];
    const widths: number[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_LENS_RESIDUAL_Z_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      mids.push((lo + hi) / 2);
      widths.push(hi - lo);
    }
    const computed = lensResidualZ(mids, widths);
    rows.push({
      source: s,
      rowsKept,
      ...computed,
    });
  }

  const concordances = rows.map((r) => r.lensConcordanceScore);
  const meanLensConcordance =
    concordances.length > 0
      ? concordances.reduce((a, b) => a + b, 0) / concordances.length
      : 0;
  const medianLensConcordance = median(concordances);
  const meanOutlierAbsZ =
    rows.length > 0
      ? rows.reduce((a, b) => a + b.outlierAbsZ, 0) / rows.length
      : 0;
  const nSourcesWithConsensusOutside = rows.filter(
    (r) => r.outlierConsensusOutside,
  ).length;

  let globalOutlierLens: SlopeLensResidualZLensName | null = null;
  let globalOutlierDirection: 'up' | 'down' | 'neutral' | null = null;
  if (rows.length > 0) {
    const outlierCounts = new Map<SlopeLensResidualZLensName, number>();
    for (const lens of SLOPE_LENS_RESIDUAL_Z_LENS_NAMES) {
      outlierCounts.set(lens, 0);
    }
    const dirCounts: Record<'up' | 'down' | 'neutral', number> = {
      up: 0,
      down: 0,
      neutral: 0,
    };
    for (const r of rows) {
      outlierCounts.set(r.outlierLens, outlierCounts.get(r.outlierLens)! + 1);
      dirCounts[r.outlierDirection] += 1;
    }
    let maxC = -1;
    for (const lens of SLOPE_LENS_RESIDUAL_Z_LENS_NAMES) {
      const c = outlierCounts.get(lens)!;
      if (c > maxC) {
        maxC = c;
        globalOutlierLens = lens;
      }
    }
    const dirOrder: Array<'up' | 'down' | 'neutral'> = ['up', 'down', 'neutral'];
    let maxD = -1;
    for (const d of dirOrder) {
      if (dirCounts[d] > maxD) {
        maxD = dirCounts[d];
        globalOutlierDirection = d;
      }
    }
  }

  let droppedAboveAlert = 0;
  let filtered = rows;
  if (alertDiscordant !== null) {
    const before = filtered.length;
    filtered = filtered.filter(
      (r) => r.lensConcordanceScore < alertDiscordant,
    );
    droppedAboveAlert += before - filtered.length;
  }
  if (alertOutside) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.outlierConsensusOutside);
    droppedAboveAlert += before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiLensResidualZRow,
      b: SourceRowTokenSlopeCiLensResidualZRow,
    ) => number
  > = {
    'concordance-desc': (a, b) =>
      b.lensConcordanceScore - a.lensConcordanceScore,
    'concordance-asc': (a, b) =>
      a.lensConcordanceScore - b.lensConcordanceScore,
    'outlier-abs-z-desc': (a, b) => b.outlierAbsZ - a.outlierAbsZ,
    'outlier-abs-z-asc': (a, b) => a.outlierAbsZ - b.outlierAbsZ,
    'mean-abs-z-desc': (a, b) => b.meanAbsZ - a.meanAbsZ,
    'mean-abs-z-asc': (a, b) => a.meanAbsZ - b.meanAbsZ,
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
    alertDiscordant,
    alertOutside,
    top,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    droppedAboveAlert,
    meanLensConcordance,
    medianLensConcordance,
    meanOutlierAbsZ,
    globalOutlierLens,
    globalOutlierDirection,
    nSourcesWithConsensusOutside,
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
 * Plain-text renderer. Self-contained, no chalk dependency.
 *
 * When `showResiduals` is true, a per-source 6-row sub-table is
 * appended showing each lens's signed residual, signed Z, and
 * abs Z (canonical lens order), useful for full per-lens
 * attribution of which lens is contributing how much to the
 * source's discordance.
 */
export function renderSourceRowTokenSlopeCiLensResidualZ(
  r: SourceRowTokenSlopeCiLensResidualZReport,
  opts: { showResiduals?: boolean } = {},
): string {
  const showResiduals = opts.showResiduals ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-lens-residual-z');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-discordant: ${r.alertDiscordant ?? '-'}    alert-outside: ${r.alertOutside}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedAboveAlert} filtered-by-alert; meanLensConcordance: ${fmtNum(r.meanLensConcordance)}; medianLensConcordance: ${fmtNum(r.medianLensConcordance)}; meanOutlierAbsZ: ${fmtNum(r.meanOutlierAbsZ)}; globalOutlierLens: ${r.globalOutlierLens ?? '-'}; globalOutlierDirection: ${r.globalOutlierDirection ?? '-'}; nSourcesWithConsensusOutside: ${r.nSourcesWithConsensusOutside}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  equalMid    outlierLens        outAbsZ   outSigned  dir   outside  meanAbsZ  nOut  signAgr     concord',
  );
  lines.push(
    '---------------  ----  ----------  -----------------  --------  ---------  ----  -------  --------  ----  ----------  --------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        fmtNum(row.equalMid).padStart(10),
        row.outlierLens.padEnd(17),
        fmtNum(row.outlierAbsZ).padStart(8),
        fmtNum(row.outlierSigned).padStart(9),
        row.outlierDirection.padEnd(4),
        (row.outlierConsensusOutside ? 'yes' : 'no').padEnd(7),
        fmtNum(row.meanAbsZ).padStart(8),
        String(row.nResidualOutside).padStart(4),
        row.signAgreement.padEnd(10),
        fmtNum(row.lensConcordanceScore).padStart(8),
      ].join('  '),
    );
    if (showResiduals) {
      lines.push('    lens               signedResid  signedZ      absZ');
      for (let i = 0; i < SLOPE_LENS_RESIDUAL_Z_LENS_NAMES.length; i++) {
        lines.push(
          [
            '   ',
            SLOPE_LENS_RESIDUAL_Z_LENS_NAMES[i]!.padEnd(17),
            fmtNum(row.lensResiduals[i]!).padStart(11),
            fmtNum(row.lensResidualZ[i]!).padStart(11),
            fmtNum(row.lensResidualAbsZ[i]!).padStart(8),
          ].join('  '),
        );
      }
    }
  }
  return lines.join('\n');
}
