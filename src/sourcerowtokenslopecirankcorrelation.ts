/**
 * source-row-token-slope-ci-rank-correlation
 *
 * Cross-source RANK-CORRELATION diagnostic for the v0.6.219 Deming-
 * slope uncertainty-quantification suite. Consumes the SAME six
 * per-source slope CIs that the rest of the cross-lens family
 * consumes (v0.6.220 percentile bootstrap, v0.6.221 jackknife,
 * v0.6.222 BCa, v0.6.223 studentized-t, v0.6.224 ABC, v0.6.225
 * profile-likelihood) but feeds them through a CROSS-SOURCE rank
 * comparison rather than a per-source pair classification.
 *
 * Mechanically distinct from ALL SEVEN prior cross-lens diagnostics
 * (v0.6.227 jaccard set-overlap, v0.6.228 sign concordance,
 * v0.6.229 width-ratio precision, v0.6.230 overlap-graph topology,
 * v0.6.231 midpoint-dispersion location, v0.6.232 asymmetry-shape,
 * v0.6.233 pair-inclusion classification) on a fundamental axis:
 *
 *   - All SEVEN prior diagnostics are PER-SOURCE: they emit one row
 *     per source and look at that source's six CIs in isolation.
 *     None of them ever compares source A to source B.
 *   - This module is CROSS-SOURCE: it asks, across the population
 *     of sources that have all six lenses, do the lenses agree on
 *     the RANK ORDER of source slopes? Two lenses can have radically
 *     different per-source CIs (failing every prior diagnostic) yet
 *     still rank sources monotonically the same way -- meaning their
 *     downstream "which source is fastest-growing" decision agrees.
 *     Conversely, two lenses can have tightly nested CIs (passing
 *     every prior diagnostic) yet still flip the rank order of two
 *     adjacent sources -- a subtle disagreement no per-source
 *     diagnostic can surface.
 *
 *   The 8th axis is therefore the ORDINAL / RANK axis, distinct
 *   from the prior 7 cardinal / set / shape / location axes.
 *
 *   For each of the C(6,2) = 15 lens pairs we report:
 *
 *     - `lensA`, `lensB` -- canonical lens names (with i < j over
 *       canonical lens order: bootstrap, jackknife, bca,
 *       studentizedT, abc, profileLikelihood);
 *     - `n` -- number of sources both lenses observed (after
 *       intersection across ALL six lenses; identical for every
 *       pair within one report);
 *     - `spearman` -- Spearman's rho in [-1, 1], computed as the
 *       Pearson correlation of the rank-transformed slope vectors
 *       with mid-rank tie handling;
 *     - `kendallTauB` -- Kendall's tau-b in [-1, 1], the
 *       tie-corrected variant: `(C - D) / sqrt((P - Tx)(P - Ty))`
 *       where `P = n*(n-1)/2`, `C` = concordant pairs, `D` =
 *       discordant pairs, `Tx`/`Ty` = ties on x / y respectively;
 *     - `concordant`, `discordant`, `tiedX`, `tiedY`, `tiedBoth` --
 *       raw Kendall pair counts (sum to `n*(n-1)/2`);
 *     - `flips` -- count of source pairs where lens A and lens B
 *       strictly disagree on rank order (== `discordant`); the
 *       headline "how many decisions would flip" metric;
 *     - `flipFraction` -- `flips / (n*(n-1)/2)` in [0, 1];
 *     - `agreement` -- `(spearman + kendallTauB) / 2` in [-1, 1],
 *       a single-number summary used as the default sort key;
 *     - `topKOverlap` -- size of `topK_A INTERSECT topK_B` divided
 *       by `topK` (default top-K = min(5, n)), in [0, 1]. This
 *       isolates the head-of-distribution disagreement from the
 *       tail.
 *
 *   Report-level fields:
 *
 *     - `meanSpearman`, `medianSpearman` -- across the 15 pairs;
 *     - `meanKendall`, `medianKendall` -- across the 15 pairs;
 *     - `minAgreementPair`, `maxAgreementPair` -- the lens pair
 *       with the worst / best `agreement` score;
 *     - `consensusRanks` -- average-rank consensus across all six
 *       lenses, per source. Sources are sorted ascending by
 *       consensus rank.
 *
 * Spearman with ties uses the standard mid-rank (average-rank)
 * approach: tied values share the average of the ranks they would
 * have occupied. The Pearson formula is then applied to the rank
 * vectors. Kendall tau-b applies the standard (C - D) /
 * sqrt((P - Tx)(P - Ty)) correction so that ties degrade the
 * denominator symmetrically and the metric stays in [-1, 1].
 *
 * Edge cases:
 *   - n < 2 sources: every metric is NaN; the report still emits
 *     all 15 pair rows so downstream tooling sees a stable shape.
 *   - All values tied on one or both sides: Spearman / Kendall
 *     denominator is zero; we emit 0 (NOT NaN) for both metrics,
 *     consistent with "no information" rather than "missing".
 */
import type { QueueLine } from './types.js';
import { buildSourceRowTokenBootstrapSlopeCi } from './sourcerowtokenbootstrapslopeci.js';
import { buildSourceRowTokenJackknifeSlopeCi } from './sourcerowtokenjackknifeslopeci.js';
import { buildSourceRowTokenBcaBootstrapSlopeCi } from './sourcerowtokenbcabootstrapslopeci.js';
import { buildSourceRowTokenStudentizedBootstrapSlopeCi } from './sourcerowtokenstudentizedbootstrapslopeci.js';
import { buildSourceRowTokenAbcBootstrapSlopeCi } from './sourcerowtokenabcbootstrapslopeci.js';
import { buildSourceRowTokenProfileLikelihoodSlopeCi } from './sourcerowtokenprofilelikelihoodslopeci.js';

export const SLOPE_RANK_LENS_NAMES = [
  'bootstrap',
  'jackknife',
  'bca',
  'studentizedT',
  'abc',
  'profileLikelihood',
] as const;

export type SlopeRankLensName = (typeof SLOPE_RANK_LENS_NAMES)[number];

const ABSOLUTE_MIN_ROWS = 4;
const N_LENSES = SLOPE_RANK_LENS_NAMES.length;

/**
 * Mid-rank (average-rank) transform. Returns a vector of length
 * `xs.length`. Tied values share the average of the ranks they
 * would have occupied. Ranks are 1-based.
 */
export function midRanks(xs: number[]): number[] {
  const n = xs.length;
  const idx = [...Array(n).keys()].sort((a, b) => xs[a]! - xs[b]!);
  const r = new Array<number>(n).fill(0);
  let i = 0;
  while (i < n) {
    let j = i;
    // group of ties: same value in sorted order
    while (j + 1 < n && xs[idx[j + 1]!]! === xs[idx[i]!]!) j += 1;
    // ranks i+1 .. j+1 averaged
    const avg = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k++) r[idx[k]!] = avg;
    i = j + 1;
  }
  return r;
}

/**
 * Spearman's rho with mid-rank tie handling. Returns a value in
 * [-1, 1]. Returns 0 when n < 2 or when one side is fully tied
 * (zero variance), consistent with "no information" rather than
 * "missing".
 */
export function spearmanRho(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length) {
    throw new Error(
      `spearmanRho: length mismatch (xs=${xs.length}, ys=${ys.length})`,
    );
  }
  const n = xs.length;
  if (n < 2) return 0;
  const rx = midRanks(xs);
  const ry = midRanks(ys);
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += rx[i]!;
    sy += ry[i]!;
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const ax = rx[i]! - mx;
    const ay = ry[i]! - my;
    num += ax * ay;
    dx += ax * ax;
    dy += ay * ay;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return 0;
  let rho = num / den;
  if (rho > 1) rho = 1;
  if (rho < -1) rho = -1;
  return rho;
}

export interface KendallCounts {
  concordant: number;
  discordant: number;
  tiedX: number;
  tiedY: number;
  tiedBoth: number;
  tauB: number;
}

/**
 * Kendall's tau-b with full pair-count breakdown. The tie-corrected
 * variant: `(C - D) / sqrt((P - Tx)(P - Ty))`.
 *
 * `C` concordant, `D` discordant, `Tx` ties on X only, `Ty` ties
 * on Y only, `Tboth` ties on both. `P = n*(n-1)/2 = C + D + Tx +
 * Ty + Tboth`. Returns 0 when n < 2 or when one of the denominator
 * factors is zero (one side fully tied).
 */
export function kendallTauBFull(xs: number[], ys: number[]): KendallCounts {
  if (xs.length !== ys.length) {
    throw new Error(
      `kendallTauBFull: length mismatch (xs=${xs.length}, ys=${ys.length})`,
    );
  }
  const n = xs.length;
  let c = 0;
  let d = 0;
  let tx = 0;
  let ty = 0;
  let tboth = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = xs[i]! - xs[j]!;
      const dy = ys[i]! - ys[j]!;
      if (dx === 0 && dy === 0) tboth += 1;
      else if (dx === 0) tx += 1;
      else if (dy === 0) ty += 1;
      else if (dx * dy > 0) c += 1;
      else d += 1;
    }
  }
  const P = (n * (n - 1)) / 2;
  let tauB = 0;
  if (P > 0) {
    const denom = Math.sqrt((P - tx - tboth) * (P - ty - tboth));
    if (denom > 0) {
      tauB = (c - d) / denom;
      if (tauB > 1) tauB = 1;
      if (tauB < -1) tauB = -1;
    }
  }
  return { concordant: c, discordant: d, tiedX: tx, tiedY: ty, tiedBoth: tboth, tauB };
}

export interface SourceRowTokenSlopeCiRankCorrelationOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  confidence?: number;
  lambda?: number;
  bootstraps?: number;
  seed?: number;
  topK?: number;
  alertWeak?: number | null;
  sort?:
    | 'agreement-desc'
    | 'agreement-asc'
    | 'spearman-desc'
    | 'spearman-asc'
    | 'kendall-desc'
    | 'kendall-asc'
    | 'flips-desc'
    | 'flips-asc'
    | 'flip-fraction-desc'
    | 'top-k-overlap-desc'
    | 'top-k-overlap-asc'
    | 'pair';
  generatedAt?: string;
}

export interface SourceRowTokenSlopeCiRankCorrelationPair {
  lensA: SlopeRankLensName;
  lensB: SlopeRankLensName;
  n: number;
  spearman: number;
  kendallTauB: number;
  concordant: number;
  discordant: number;
  tiedX: number;
  tiedY: number;
  tiedBoth: number;
  flips: number;
  flipFraction: number;
  agreement: number;
  topKOverlap: number;
}

export interface SourceRowTokenSlopeCiRankCorrelationConsensusRow {
  source: string;
  consensusRank: number;
  lensRanks: number[];
  rankSpread: number;
}

export interface SourceRowTokenSlopeCiRankCorrelationReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  bootstraps: number;
  seed: number;
  topK: number;
  alertWeak: number | null;
  sort: NonNullable<SourceRowTokenSlopeCiRankCorrelationOptions['sort']>;
  totalSources: number;
  sourcesWithAllLenses: number;
  droppedMissingLens: number;
  droppedAboveAlert: number;
  meanSpearman: number;
  medianSpearman: number;
  meanKendall: number;
  medianKendall: number;
  minAgreementPair: { lensA: SlopeRankLensName; lensB: SlopeRankLensName; agreement: number } | null;
  maxAgreementPair: { lensA: SlopeRankLensName; lensB: SlopeRankLensName; agreement: number } | null;
  pairs: SourceRowTokenSlopeCiRankCorrelationPair[];
  consensusRanks: SourceRowTokenSlopeCiRankCorrelationConsensusRow[];
}

const VALID_SORTS = [
  'agreement-desc',
  'agreement-asc',
  'spearman-desc',
  'spearman-asc',
  'kendall-desc',
  'kendall-asc',
  'flips-desc',
  'flips-asc',
  'flip-fraction-desc',
  'top-k-overlap-desc',
  'top-k-overlap-asc',
  'pair',
] as const;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[m]!;
  return (s[m - 1]! + s[m]!) / 2;
}

export function buildSourceRowTokenSlopeCiRankCorrelation(
  queue: QueueLine[],
  opts: SourceRowTokenSlopeCiRankCorrelationOptions = {},
): SourceRowTokenSlopeCiRankCorrelationReport {
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
  const topK = opts.topK ?? 5;
  if (!Number.isInteger(topK) || topK < 1) {
    throw new Error(`topK must be a positive integer (got ${opts.topK})`);
  }
  const alertWeak = opts.alertWeak ?? null;
  if (alertWeak !== null) {
    if (!Number.isFinite(alertWeak) || alertWeak < -1 || alertWeak > 1) {
      throw new Error(
        `alertWeak must be a finite number in [-1, 1] (got ${opts.alertWeak})`,
      );
    }
  }
  const sort = opts.sort ?? 'agreement-desc';
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

  type PerLensRaw = { source: string; rowsKept: number; slope: number };
  const lensReports: Record<SlopeRankLensName, Map<string, PerLensRaw>> = {
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
  for (const lens of SLOPE_RANK_LENS_NAMES) {
    for (const s of lensReports[lens].keys()) allSources.add(s);
  }
  let droppedMissingLens = 0;
  const sharedSources: string[] = [];
  for (const s of allSources) {
    let presentInAll = true;
    for (const lens of SLOPE_RANK_LENS_NAMES) {
      if (!lensReports[lens].has(s)) {
        presentInAll = false;
        break;
      }
    }
    if (presentInAll) sharedSources.push(s);
    else droppedMissingLens += 1;
  }
  sharedSources.sort();

  const n = sharedSources.length;
  // Per-lens slope vectors aligned by sharedSources order
  const slopeByLens: Record<SlopeRankLensName, number[]> = {
    bootstrap: [],
    jackknife: [],
    bca: [],
    studentizedT: [],
    abc: [],
    profileLikelihood: [],
  };
  for (const s of sharedSources) {
    for (const lens of SLOPE_RANK_LENS_NAMES) {
      slopeByLens[lens].push(lensReports[lens].get(s)!.slope);
    }
  }

  const effectiveTopK = Math.min(topK, n);

  // Build top-K source-id sets per lens, ranked by slope desc
  const topKSetByLens: Record<SlopeRankLensName, Set<string>> = {
    bootstrap: new Set(),
    jackknife: new Set(),
    bca: new Set(),
    studentizedT: new Set(),
    abc: new Set(),
    profileLikelihood: new Set(),
  };
  for (const lens of SLOPE_RANK_LENS_NAMES) {
    const idx = [...Array(n).keys()].sort(
      (a, b) => slopeByLens[lens][b]! - slopeByLens[lens][a]!,
    );
    for (let i = 0; i < effectiveTopK; i++) {
      topKSetByLens[lens].add(sharedSources[idx[i]!]!);
    }
  }

  const pairs: SourceRowTokenSlopeCiRankCorrelationPair[] = [];
  for (let i = 0; i < N_LENSES; i++) {
    for (let j = i + 1; j < N_LENSES; j++) {
      const lensA = SLOPE_RANK_LENS_NAMES[i]!;
      const lensB = SLOPE_RANK_LENS_NAMES[j]!;
      const xs = slopeByLens[lensA];
      const ys = slopeByLens[lensB];
      const rho = spearmanRho(xs, ys);
      const k = kendallTauBFull(xs, ys);
      const P = (n * (n - 1)) / 2;
      const flipFraction = P > 0 ? k.discordant / P : 0;
      const agreement = (rho + k.tauB) / 2;
      let overlap = 0;
      const setA = topKSetByLens[lensA];
      const setB = topKSetByLens[lensB];
      for (const s of setA) if (setB.has(s)) overlap += 1;
      const topKOverlap = effectiveTopK > 0 ? overlap / effectiveTopK : 0;
      pairs.push({
        lensA,
        lensB,
        n,
        spearman: rho,
        kendallTauB: k.tauB,
        concordant: k.concordant,
        discordant: k.discordant,
        tiedX: k.tiedX,
        tiedY: k.tiedY,
        tiedBoth: k.tiedBoth,
        flips: k.discordant,
        flipFraction,
        agreement,
        topKOverlap,
      });
    }
  }

  const spearmans = pairs.map((p) => p.spearman);
  const kendalls = pairs.map((p) => p.kendallTauB);
  const meanSpearman =
    spearmans.length > 0
      ? spearmans.reduce((a, b) => a + b, 0) / spearmans.length
      : 0;
  const meanKendall =
    kendalls.length > 0
      ? kendalls.reduce((a, b) => a + b, 0) / kendalls.length
      : 0;
  const medianSpearman = median(spearmans);
  const medianKendall = median(kendalls);

  let minAgreementPair: SourceRowTokenSlopeCiRankCorrelationReport['minAgreementPair'] = null;
  let maxAgreementPair: SourceRowTokenSlopeCiRankCorrelationReport['maxAgreementPair'] = null;
  for (const p of pairs) {
    if (minAgreementPair === null || p.agreement < minAgreementPair.agreement) {
      minAgreementPair = { lensA: p.lensA, lensB: p.lensB, agreement: p.agreement };
    }
    if (maxAgreementPair === null || p.agreement > maxAgreementPair.agreement) {
      maxAgreementPair = { lensA: p.lensA, lensB: p.lensB, agreement: p.agreement };
    }
  }

  // Consensus ranks: average of per-lens ranks (descending = rank 1 is largest slope)
  const ranksPerLens: Record<SlopeRankLensName, number[]> = {
    bootstrap: [],
    jackknife: [],
    bca: [],
    studentizedT: [],
    abc: [],
    profileLikelihood: [],
  };
  for (const lens of SLOPE_RANK_LENS_NAMES) {
    // descending ranks: invert via negation for midRanks (which is ascending)
    const negated = slopeByLens[lens].map((v) => -v);
    ranksPerLens[lens] = midRanks(negated);
  }
  const consensus: SourceRowTokenSlopeCiRankCorrelationConsensusRow[] = [];
  for (let i = 0; i < n; i++) {
    const lensRanks: number[] = [];
    let sum = 0;
    let mn = Infinity;
    let mx = -Infinity;
    for (const lens of SLOPE_RANK_LENS_NAMES) {
      const r = ranksPerLens[lens][i]!;
      lensRanks.push(r);
      sum += r;
      if (r < mn) mn = r;
      if (r > mx) mx = r;
    }
    consensus.push({
      source: sharedSources[i]!,
      consensusRank: sum / N_LENSES,
      lensRanks,
      rankSpread: mx - mn,
    });
  }
  consensus.sort((a, b) => {
    if (a.consensusRank !== b.consensusRank) return a.consensusRank - b.consensusRank;
    return a.source.localeCompare(b.source);
  });

  let droppedAboveAlert = 0;
  let filteredPairs = pairs;
  if (alertWeak !== null) {
    const before = filteredPairs.length;
    filteredPairs = filteredPairs.filter((p) => p.agreement < alertWeak);
    droppedAboveAlert = before - filteredPairs.length;
  }

  const sortFns: Record<
    (typeof VALID_SORTS)[number],
    (
      a: SourceRowTokenSlopeCiRankCorrelationPair,
      b: SourceRowTokenSlopeCiRankCorrelationPair,
    ) => number
  > = {
    'agreement-desc': (a, b) => b.agreement - a.agreement,
    'agreement-asc': (a, b) => a.agreement - b.agreement,
    'spearman-desc': (a, b) => b.spearman - a.spearman,
    'spearman-asc': (a, b) => a.spearman - b.spearman,
    'kendall-desc': (a, b) => b.kendallTauB - a.kendallTauB,
    'kendall-asc': (a, b) => a.kendallTauB - b.kendallTauB,
    'flips-desc': (a, b) => b.flips - a.flips,
    'flips-asc': (a, b) => a.flips - b.flips,
    'flip-fraction-desc': (a, b) => b.flipFraction - a.flipFraction,
    'top-k-overlap-desc': (a, b) => b.topKOverlap - a.topKOverlap,
    'top-k-overlap-asc': (a, b) => a.topKOverlap - b.topKOverlap,
    pair: (a, b) => {
      const ai = SLOPE_RANK_LENS_NAMES.indexOf(a.lensA);
      const bi = SLOPE_RANK_LENS_NAMES.indexOf(b.lensA);
      if (ai !== bi) return ai - bi;
      const aj = SLOPE_RANK_LENS_NAMES.indexOf(a.lensB);
      const bj = SLOPE_RANK_LENS_NAMES.indexOf(b.lensB);
      return aj - bj;
    },
  };
  filteredPairs = [...filteredPairs].sort((a, b) => {
    const cmp = sortFns[sort](a, b);
    if (cmp !== 0) return cmp;
    const ai = SLOPE_RANK_LENS_NAMES.indexOf(a.lensA);
    const bi = SLOPE_RANK_LENS_NAMES.indexOf(b.lensA);
    if (ai !== bi) return ai - bi;
    const aj = SLOPE_RANK_LENS_NAMES.indexOf(a.lensB);
    const bj = SLOPE_RANK_LENS_NAMES.indexOf(b.lensB);
    return aj - bj;
  });

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
    topK: effectiveTopK,
    alertWeak,
    sort,
    totalSources: n + droppedMissingLens,
    sourcesWithAllLenses: n,
    droppedMissingLens,
    droppedAboveAlert,
    meanSpearman,
    medianSpearman,
    meanKendall,
    medianKendall,
    minAgreementPair,
    maxAgreementPair,
    pairs: filteredPairs,
    consensusRanks: consensus,
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
 * When `showConsensus` is true, the report is followed by a
 * per-source consensus-rank table: average rank across the six
 * lenses, ascending (rank 1 = largest slope by consensus). Useful
 * for quickly spotting which sources the lenses agree are at the
 * top of the slope distribution.
 */
export function renderSourceRowTokenSlopeCiRankCorrelation(
  r: SourceRowTokenSlopeCiRankCorrelationReport,
  opts: { showConsensus?: boolean } = {},
): string {
  const showConsensus = opts.showConsensus ?? false;
  const lines: string[] = [];
  lines.push('pew-insights source-row-token-slope-ci-rank-correlation');
  lines.push(
    `as of: ${r.generatedAt}    sources: ${r.totalSources} (with all lenses ${r.sourcesWithAllLenses})    min-rows: ${r.minRows}    confidence: ${r.confidence}    lambda: ${r.lambda}    bootstraps: ${r.bootstraps}    seed: ${r.seed}    top-k: ${r.topK}    alert-weak: ${r.alertWeak ?? '-'}    sort: ${r.sort}`,
  );
  lines.push(
    `dropped: ${r.droppedMissingLens} missing-from-some-lens, ${r.droppedAboveAlert} above-alert-threshold; meanSpearman: ${fmtNum(r.meanSpearman)}; medianSpearman: ${fmtNum(r.medianSpearman)}; meanKendall: ${fmtNum(r.meanKendall)}; medianKendall: ${fmtNum(r.medianKendall)}`,
  );
  if (r.minAgreementPair !== null && r.maxAgreementPair !== null) {
    lines.push(
      `min-agreement: ${r.minAgreementPair.lensA}~${r.minAgreementPair.lensB} = ${fmtNum(r.minAgreementPair.agreement)}    max-agreement: ${r.maxAgreementPair.lensA}~${r.maxAgreementPair.lensB} = ${fmtNum(r.maxAgreementPair.agreement)}`,
    );
  }
  if (r.sourcesWithAllLenses < 2) {
    lines.push(
      `(insufficient data: n=${r.sourcesWithAllLenses} < 2 sources with all six lenses; spearman / kendall require at least 2 sources -- every pair metric is 0 by convention, NOT NaN)`,
    );
  }
  lines.push('');
  if (r.pairs.length === 0) {
    lines.push('(no pairs)');
    return lines.join('\n');
  }
  lines.push(
    'lensA               lensB               n     spearman   kendall    C    D    Tx   Ty   Tb   flips  flipF    agree    topKO',
  );
  lines.push(
    '------------------  ------------------  ----  --------   --------   ---  ---  ---  ---  ---  -----  ------   ------   ------',
  );
  for (const p of r.pairs) {
    lines.push(
      [
        p.lensA.padEnd(18),
        p.lensB.padEnd(18),
        String(p.n).padStart(4),
        fmtNum(p.spearman).padStart(8),
        fmtNum(p.kendallTauB).padStart(8),
        String(p.concordant).padStart(3),
        String(p.discordant).padStart(3),
        String(p.tiedX).padStart(3),
        String(p.tiedY).padStart(3),
        String(p.tiedBoth).padStart(3),
        String(p.flips).padStart(5),
        p.flipFraction.toFixed(4).padStart(6),
        p.agreement.toFixed(4).padStart(6),
        p.topKOverlap.toFixed(4).padStart(6),
      ].join('  '),
    );
  }
  if (showConsensus && r.consensusRanks.length > 0) {
    lines.push('');
    lines.push('consensus ranks (ascending; rank 1 == largest slope by consensus)');
    lines.push('source           consensusRank   spread   lensRanks (b/j/bca/stT/abc/pL)');
    lines.push('---------------  -------------   ------   ---------------------------------');
    for (const c of r.consensusRanks) {
      lines.push(
        [
          c.source.padEnd(15),
          fmtNum(c.consensusRank, 2).padStart(13),
          fmtNum(c.rankSpread, 2).padStart(6),
          c.lensRanks.map((x) => fmtNum(x, 1)).join('/'),
        ].join('  '),
      );
    }
  }
  return lines.join('\n');
}
