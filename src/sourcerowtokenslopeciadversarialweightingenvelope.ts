/**
 * source-row-token-slope-ci-adversarial-weighting-envelope
 *
 * Per-source ADVERSARIAL CONVEX-WEIGHTING envelope diagnostic for the
 * v0.6.219 Deming-slope uncertainty-quantification suite. Consumes the
 * SAME six per-source slope CIs that the rest of the cross-lens family
 * consumes (v0.6.220 percentile bootstrap, v0.6.221 jackknife normal,
 * v0.6.222 BCa, v0.6.223 studentized-t, v0.6.224 ABC, v0.6.225
 * profile-likelihood).
 *
 * Mechanically distinct from ALL ELEVEN prior cross-lens diagnostics
 * (v0.6.227 jaccard, v0.6.228 sign, v0.6.229 width, v0.6.230
 * overlap-graph, v0.6.231 midpoint-dispersion, v0.6.232 asymmetry,
 * v0.6.233 pair-inclusion, v0.6.234 rank-correlation, v0.6.235
 * coverage-volume, v0.6.237 leave-one-lens-out, v0.6.238
 * precision-pull) on a fundamental axis: it is the ONLY one that
 * asks "what is the FULL ATTAINABLE RANGE of the consensus midpoint
 * over the entire weight simplex?" — i.e. the worst-case (and
 * best-case) midpoint an adversarial analyst could report by
 * choosing any non-negative weighting of the six lenses that sums
 * to 1.
 *
 * Why this is a fresh, twelfth axis:
 *
 *   - jaccard / sign / width / overlap-graph / midpoint-dispersion /
 *     asymmetry / pair-inclusion / rank-correlation /
 *     coverage-volume all describe a STATIC equal-weight geometry
 *     of the six CIs. None of them asks how far the consensus
 *     could move under re-weighting at all.
 *   - leave-one-lens-out (v0.6.237) explores at most six specific
 *     weightings (drop one lens at full weight). It does NOT cover
 *     the full simplex; it never considers, e.g., dropping two
 *     lenses, or shifting weight smoothly between lenses.
 *   - precision-pull (v0.6.238) considers exactly ONE specific
 *     weighting — inverse-width (precision) pooling — and measures
 *     how far that single re-weighted midpoint sits from the
 *     equal-weight midpoint.
 *   - The adversarial-weighting envelope considers ALL convex
 *     weightings: w in the simplex (w_k >= 0, sum w_k = 1). The
 *     attained midpoint set is exactly the closed interval
 *     `[min(mids), max(mids)]` (a fundamental fact: the convex
 *     hull of n real numbers is the interval between their
 *     min and max). The envelope therefore captures the FULL
 *     manipulability of the consensus midpoint, of which both
 *     equal-weighting and precision-pooling are interior points,
 *     and of which LOO is a six-point sample.
 *
 * For each source we compute on the 6 CI midpoints `mid_k = (lo_k +
 * hi_k) / 2` and 6 widths `w_k = hi_k - lo_k`:
 *
 *   - `equalMid` = arithmetic mean of mid_1..mid_6 (sits inside
 *     the envelope by construction);
 *   - `equalWidth` = arithmetic mean of w_1..w_6;
 *   - `envelopeLow` = min_k(mid_k);
 *   - `envelopeHigh` = max_k(mid_k);
 *   - `envelopeRange` = envelopeHigh - envelopeLow (>= 0); the
 *     maximum possible shift in the consensus midpoint achievable
 *     by ANY convex re-weighting of the six lenses;
 *   - `equalRelativePosition` in [0, 1] = (equalMid - envelopeLow) /
 *     envelopeRange when envelopeRange > 0, else 0.5 by convention.
 *     0.5 means equal-weight consensus sits perfectly centered in
 *     the envelope; near 0 means equal-weight is already at the
 *     low extreme (most lenses agree on the low end, only one is
 *     high); near 1 means the opposite;
 *   - `worstCaseUpShift` = envelopeHigh - equalMid (>= 0); maximum
 *     UPWARD shift achievable by adversarial weighting;
 *   - `worstCaseDownShift` = equalMid - envelopeLow (>= 0);
 *   - `manipulability` = envelopeRange / equalWidth (unitless,
 *     comparable across sources; same normalization choice as
 *     pullStd / midShiftStd). 0 when envelopeRange == 0; large
 *     when the cross-lens midpoint spread is bigger than a typical
 *     CI width;
 *   - `asymmetryIndex` in [-1, 1] = (worstCaseUpShift -
 *     worstCaseDownShift) / envelopeRange when envelopeRange > 0,
 *     else 0. Positive = the envelope extends further UP from
 *     equal-weight than down (an adversary trying to push the
 *     slope up has more room than one trying to push it down).
 *     Note: this is independent of v0.6.232 asymmetry, which
 *     describes per-lens lo/hi asymmetry of CIs, NOT per-source
 *     manipulability of the cross-lens midpoint envelope;
 *   - `extremeUpLens` = lens whose midpoint equals envelopeHigh
 *     (canonical-order tie-break);
 *   - `extremeDownLens` = lens whose midpoint equals envelopeLow
 *     (canonical-order tie-break);
 *   - `extremeSpan` in [0, 1] = `extremeUpLens` and
 *     `extremeDownLens` are the same lens iff all midpoints are
 *     identical; the boolean
 *     `extremesDistinct` = extremeUpLens !== extremeDownLens;
 *   - `envelopeRobustnessScore` = 1 / (1 + manipulability) in
 *     (0, 1] — DEFAULT SORT KEY. 1.0 = consensus is invariant
 *     under any convex re-weighting (all six midpoints identical);
 *     near 0 = consensus is wildly manipulable through choice
 *     of weighting.
 *
 * Per-report aggregates: `meanEnvelopeRobustness`,
 * `medianEnvelopeRobustness`, `meanManipulability`,
 * `globalExtremeUpLens` (mode of `extremeUpLens` across sources;
 * canonical-order tie-break), `globalExtremeDownLens` (analog),
 * `globalAsymmetryDirection` ('up'/'down'/'neutral'; mode of
 * the sign of `asymmetryIndex` across sources, ties broken
 * 'up' > 'down' > 'neutral').
 *
 * Edge cases:
 *   - All six midpoints identical -> envelopeRange = 0,
 *     equalRelativePosition = 0.5, manipulability = 0,
 *     asymmetryIndex = 0, envelopeRobustnessScore = 1,
 *     extremeUpLens = extremeDownLens = first canonical lens,
 *     extremesDistinct = false.
 *   - equalWidth == 0 with envelopeRange > 0 -> manipulability
 *     is INFINITE in principle; we set manipulability = +Infinity
 *     and envelopeRobustnessScore = 0 to preserve sort behavior.
 *     This is a degenerate input (all six lenses report point CIs
 *     but disagree on the slope itself).
 *   - Source dropped from any of the six lenses -> not reported
 *     (counted in `droppedMissingLens`).
 *
 * `--alert-manipulable <f>` filters to sources whose
 * `envelopeRobustnessScore` is strictly less than f (in (0, 1])
 * — i.e. the sources where adversarial re-weighting WOULD
 * meaningfully move consensus.
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_ENVELOPE_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeEnvelopeLensName = (typeof SLOPE_ENVELOPE_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_ENVELOPE_LENS_NAMES.length;

export interface SourceRowTokenSlopeCiAdversarialWeightingEnvelopeOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  alertManipulable?: number | null;
  top?: number | null;
  sort?:
    | 'robustness-desc'
    | 'robustness-asc'
    | 'manipulability-desc'
    | 'manipulability-asc'
    | 'envelope-range-desc'
    | 'envelope-range-asc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiAdversarialWeightingEnvelopeRow {
  source: string;
  rowsKept: number;
  equalMid: number;
  equalWidth: number;
  envelopeLow: number;
  envelopeHigh: number;
  envelopeRange: number;
  equalRelativePosition: number;
  worstCaseUpShift: number;
  worstCaseDownShift: number;
  manipulability: number;
  asymmetryIndex: number;
  asymmetryDirection: 'up' | 'down' | 'neutral';
  extremeUpLens: SlopeEnvelopeLensName;
  extremeDownLens: SlopeEnvelopeLensName;
  extremesDistinct: boolean;
  envelopeRobustnessScore: number;
}

export interface SourceRowTokenSlopeCiAdversarialWeightingEnvelopeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  alertManipulable: number | null;
  top: number | null;
  sort: NonNullable<
    SourceRowTokenSlopeCiAdversarialWeightingEnvelopeOptions['sort']
  >;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedAboveAlert: number;
  meanEnvelopeRobustness: number;
  medianEnvelopeRobustness: number;
  meanManipulability: number;
  globalExtremeUpLens: SlopeEnvelopeLensName | null;
  globalExtremeDownLens: SlopeEnvelopeLensName | null;
  globalAsymmetryDirection: 'up' | 'down' | 'neutral' | null;
  rows: SourceRowTokenSlopeCiAdversarialWeightingEnvelopeRow[];
}

const VALID_SORTS = [
  'robustness-desc',
  'robustness-asc',
  'manipulability-desc',
  'manipulability-asc',
  'envelope-range-desc',
  'envelope-range-asc',
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
 * order, compute the adversarial-weighting envelope diagnostic for
 * that source. Exposed for direct unit-testing.
 */
export function adversarialWeightingEnvelope(
  mids: number[],
  widths: number[],
): {
  equalMid: number;
  equalWidth: number;
  envelopeLow: number;
  envelopeHigh: number;
  envelopeRange: number;
  equalRelativePosition: number;
  worstCaseUpShift: number;
  worstCaseDownShift: number;
  manipulability: number;
  asymmetryIndex: number;
  asymmetryDirection: 'up' | 'down' | 'neutral';
  extremeUpLens: SlopeEnvelopeLensName;
  extremeDownLens: SlopeEnvelopeLensName;
  extremesDistinct: boolean;
  envelopeRobustnessScore: number;
} {
  if (mids.length !== N_LENSES || widths.length !== N_LENSES) {
    throw new Error(
      `adversarialWeightingEnvelope: expected ${N_LENSES} midpoints and widths (got mids=${mids.length}, widths=${widths.length})`,
    );
  }
  for (const w of widths) {
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(
        `adversarialWeightingEnvelope: widths must be finite and non-negative (got ${w})`,
      );
    }
  }
  for (const m of mids) {
    if (!Number.isFinite(m)) {
      throw new Error(
        `adversarialWeightingEnvelope: midpoints must be finite (got ${m})`,
      );
    }
  }

  let sumMid = 0;
  let sumWidth = 0;
  let lo = mids[0]!;
  let hi = mids[0]!;
  let loIdx = 0;
  let hiIdx = 0;
  for (let i = 0; i < N_LENSES; i++) {
    sumMid += mids[i]!;
    sumWidth += widths[i]!;
    if (mids[i]! < lo) {
      lo = mids[i]!;
      loIdx = i;
    }
    if (mids[i]! > hi) {
      hi = mids[i]!;
      hiIdx = i;
    }
  }
  const equalMid = sumMid / N_LENSES;
  const equalWidth = sumWidth / N_LENSES;
  const envelopeLow = lo;
  const envelopeHigh = hi;
  const envelopeRange = hi - lo;

  const worstCaseUpShift = envelopeHigh - equalMid;
  const worstCaseDownShift = equalMid - envelopeLow;

  const equalRelativePosition =
    envelopeRange > 0 ? (equalMid - envelopeLow) / envelopeRange : 0.5;

  let manipulability: number;
  if (envelopeRange === 0) {
    manipulability = 0;
  } else if (equalWidth === 0) {
    manipulability = Infinity;
  } else {
    manipulability = envelopeRange / equalWidth;
  }

  const asymmetryIndex =
    envelopeRange > 0
      ? (worstCaseUpShift - worstCaseDownShift) / envelopeRange
      : 0;
  let asymmetryDirection: 'up' | 'down' | 'neutral';
  if (asymmetryIndex > 0) asymmetryDirection = 'up';
  else if (asymmetryIndex < 0) asymmetryDirection = 'down';
  else asymmetryDirection = 'neutral';

  const extremeUpLens = SLOPE_ENVELOPE_LENS_NAMES[hiIdx]!;
  const extremeDownLens = SLOPE_ENVELOPE_LENS_NAMES[loIdx]!;
  const extremesDistinct = hiIdx !== loIdx;

  const envelopeRobustnessScore =
    manipulability === Infinity ? 0 : 1 / (1 + manipulability);

  return {
    equalMid,
    equalWidth,
    envelopeLow,
    envelopeHigh,
    envelopeRange,
    equalRelativePosition,
    worstCaseUpShift,
    worstCaseDownShift,
    manipulability,
    asymmetryIndex,
    asymmetryDirection,
    extremeUpLens,
    extremeDownLens,
    extremesDistinct,
    envelopeRobustnessScore,
  };
}

export function buildSourceRowTokenSlopeCiAdversarialWeightingEnvelope(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiAdversarialWeightingEnvelopeOptions = {},
): SourceRowTokenSlopeCiAdversarialWeightingEnvelopeReport {
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
  const alertManipulable = opts.alertManipulable ?? null;
  if (alertManipulable !== null) {
    if (
      !Number.isFinite(alertManipulable) ||
      alertManipulable <= 0 ||
      alertManipulable > 1
    ) {
      throw new Error(
        `alertManipulable must be a finite number in (0, 1] (got ${opts.alertManipulable})`,
      );
    }
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'robustness-desc';
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
  const lensReports: Record<SlopeEnvelopeLensName, Map<string, PerLensRaw>> = {
    bootstrap: new Map(bootstrapReport.sources.map((r) => [r.source, r])),
    jackknife: new Map(jackknifeReport.sources.map((r) => [r.source, r])),
    bca: new Map(bcaReport.sources.map((r) => [r.source, r])),
    studentizedT: new Map(studReport.sources.map((r) => [r.source, r])),
    abc: new Map(abcReport.sources.map((r) => [r.source, r])),
    profileLikelihood: new Map(profileReport.sources.map((r) => [r.source, r])),
  };

  const allSources = new Set<string>();
  for (const lens of SLOPE_ENVELOPE_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_ENVELOPE_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const rows: SourceRowTokenSlopeCiAdversarialWeightingEnvelopeRow[] = [];
  for (const s of sharedSources) {
    const mids: number[] = [];
    const widths: number[] = [];
    let rowsKept = 0;
    for (const lens of SLOPE_ENVELOPE_LENS_NAMES) {
      const r = lensReports[lens].get(s)!;
      rowsKept = r.rowsKept;
      const lo = Math.min(r.ciLower, r.ciUpper);
      const hi = Math.max(r.ciLower, r.ciUpper);
      mids.push((lo + hi) / 2);
      widths.push(hi - lo);
    }
    const computed = adversarialWeightingEnvelope(mids, widths);
    rows.push({
      source: s,
      rowsKept,
      ...computed,
    });
  }

  const robustnessVals = rows.map((r) => r.envelopeRobustnessScore);
  const meanEnvelopeRobustness =
    robustnessVals.length > 0
      ? robustnessVals.reduce((a, b) => a + b, 0) / robustnessVals.length
      : 0;
  const medianEnvelopeRobustness = median(robustnessVals);
  const finiteManip = rows
    .map((r) => r.manipulability)
    .filter((x) => Number.isFinite(x));
  const meanManipulability =
    finiteManip.length > 0
      ? finiteManip.reduce((a, b) => a + b, 0) / finiteManip.length
      : 0;

  let globalExtremeUpLens: SlopeEnvelopeLensName | null = null;
  let globalExtremeDownLens: SlopeEnvelopeLensName | null = null;
  let globalAsymmetryDirection: 'up' | 'down' | 'neutral' | null = null;
  if (rows.length > 0) {
    const upCounts = new Map<SlopeEnvelopeLensName, number>();
    const downCounts = new Map<SlopeEnvelopeLensName, number>();
    for (const lens of SLOPE_ENVELOPE_LENS_NAMES) {
      upCounts.set(lens, 0);
      downCounts.set(lens, 0);
    }
    const dirCounts: Record<'up' | 'down' | 'neutral', number> = {
      up: 0,
      down: 0,
      neutral: 0,
    };
    for (const r of rows) {
      upCounts.set(r.extremeUpLens, upCounts.get(r.extremeUpLens)! + 1);
      downCounts.set(
        r.extremeDownLens,
        downCounts.get(r.extremeDownLens)! + 1,
      );
      dirCounts[r.asymmetryDirection] += 1;
    }
    let maxU = -1;
    for (const lens of SLOPE_ENVELOPE_LENS_NAMES) {
      const c = upCounts.get(lens)!;
      if (c > maxU) {
        maxU = c;
        globalExtremeUpLens = lens;
      }
    }
    let maxD = -1;
    for (const lens of SLOPE_ENVELOPE_LENS_NAMES) {
      const c = downCounts.get(lens)!;
      if (c > maxD) {
        maxD = c;
        globalExtremeDownLens = lens;
      }
    }
    const dirOrder: Array<'up' | 'down' | 'neutral'> = [
      'up',
      'down',
      'neutral',
    ];
    let maxA = -1;
    for (const d of dirOrder) {
      if (dirCounts[d] > maxA) {
        maxA = dirCounts[d];
        globalAsymmetryDirection = d;
      }
    }
  }

  let droppedAboveAlert = 0;
  let filtered = rows;
  if (alertManipulable !== null) {
    const before = filtered.length;
    filtered = filtered.filter(
      (r) => r.envelopeRobustnessScore < alertManipulable,
    );
    droppedAboveAlert = before - filtered.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiAdversarialWeightingEnvelopeRow,
      b: SourceRowTokenSlopeCiAdversarialWeightingEnvelopeRow,
    ) => number
  > = {
    'robustness-desc': (a, b) =>
      b.envelopeRobustnessScore - a.envelopeRobustnessScore,
    'robustness-asc': (a, b) =>
      a.envelopeRobustnessScore - b.envelopeRobustnessScore,
    'manipulability-desc': (a, b) => {
      const av = Number.isFinite(a.manipulability)
        ? a.manipulability
        : Number.MAX_VALUE;
      const bv = Number.isFinite(b.manipulability)
        ? b.manipulability
        : Number.MAX_VALUE;
      return bv - av;
    },
    'manipulability-asc': (a, b) => {
      const av = Number.isFinite(a.manipulability)
        ? a.manipulability
        : Number.MAX_VALUE;
      const bv = Number.isFinite(b.manipulability)
        ? b.manipulability
        : Number.MAX_VALUE;
      return av - bv;
    },
    'envelope-range-desc': (a, b) => b.envelopeRange - a.envelopeRange,
    'envelope-range-asc': (a, b) => a.envelopeRange - b.envelopeRange,
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
    alertManipulable,
    top,
    sort,
    totalSources: sharedSources.length + droppedMissingLens,
    sourcesWithAllLenses: sharedSources.length,
    droppedMissingLens,
    droppedAboveAlert,
    meanEnvelopeRobustness,
    medianEnvelopeRobustness,
    meanManipulability,
    globalExtremeUpLens,
    globalExtremeDownLens,
    globalAsymmetryDirection,
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
 * When `showExtremes` is true, a per-source one-line summary is
 * appended naming the extremeUpLens, extremeDownLens, the
 * worst-case up/down shifts, and the asymmetry direction.
 */
export function renderSourceRowTokenSlopeCiAdversarialWeightingEnvelope(
  r: SourceRowTokenSlopeCiAdversarialWeightingEnvelopeReport,
  opts: { showExtremes?: boolean } = {},
): string {
  const showExtremes = opts.showExtremes ?? false;
  const lines: string[] = [];
  lines.push(
    'pew-insights source-row-token-slope-ci-adversarial-weighting-envelope',
  );
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    alert-manipulable: ${r.alertManipulable ?? '-'}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedAboveAlert} above-alert-threshold; meanEnvelopeRobustness: ${fmtNum(r.meanEnvelopeRobustness)}; medianEnvelopeRobustness: ${fmtNum(r.medianEnvelopeRobustness)}; meanManipulability: ${fmtNum(r.meanManipulability)}; globalExtremeUpLens: ${r.globalExtremeUpLens ?? '-'}; globalExtremeDownLens: ${r.globalExtremeDownLens ?? '-'}; globalAsymmetryDirection: ${r.globalAsymmetryDirection ?? '-'}`,
  );
  lines.push('');
  if (r.rows.length === 0) {
    lines.push('(no sources)');
    return lines.join('\n');
  }
  lines.push(
    'source           rows  envLow         envHigh        envRange       equalRelPos  manip     asymIdx   dir   robust    extremeUpLens      extremeDownLens',
  );
  lines.push(
    '---------------  ----  -------------  -------------  -------------  -----------  --------  --------  ----  --------  -----------------  -----------------',
  );
  for (const row of r.rows) {
    lines.push(
      [
        row.source.padEnd(15),
        String(row.rowsKept).padStart(4),
        fmtNum(row.envelopeLow).padStart(13),
        fmtNum(row.envelopeHigh).padStart(13),
        fmtNum(row.envelopeRange).padStart(13),
        fmtNum(row.equalRelativePosition).padStart(11),
        fmtNum(row.manipulability).padStart(8),
        fmtNum(row.asymmetryIndex).padStart(8),
        row.asymmetryDirection.padEnd(4),
        fmtNum(row.envelopeRobustnessScore).padStart(8),
        row.extremeUpLens.padEnd(17),
        row.extremeDownLens.padEnd(17),
      ].join('  '),
    );
    if (showExtremes) {
      const arrow =
        row.asymmetryDirection === 'up'
          ? '^'
          : row.asymmetryDirection === 'down'
            ? 'v'
            : '=';
      lines.push(
        `    extremes: up=${row.extremeUpLens} (+${fmtNum(row.worstCaseUpShift)}) / down=${row.extremeDownLens} (-${fmtNum(row.worstCaseDownShift)}) ${arrow} asym=${fmtNum(row.asymmetryIndex)}`,
      );
    }
  }
  return lines.join('\n');
}
