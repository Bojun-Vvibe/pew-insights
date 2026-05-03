/**
 * daily-token-isoweek-day-of-week-entropy: per-source Shannon
 * entropy (base-2) of daily token mass across the seven days of
 * the ISO week, computed PER ISO WEEK and then AGGREGATED across
 * the source's active iso weeks.
 *
 * ONE-HUNDRED-AND-FIFTIETH cross-source axis.
 *
 * Construction:
 *   1. Collapse hourly buckets into per-UTC-day total_tokens.
 *   2. Group active days by ISO-8601 (year, week) pair. ISO weeks
 *      run Mon-Sun and the year is the iso-week-numbering-year
 *      (so 2025-12-29 .. 2026-01-04 is iso-week 2026-W01).
 *   3. Within each iso-week-with-tokens, compute the 7-bin DOW
 *      probability vector p_d = tokens(d) / weekTotalTokens for
 *      d in {Mon..Sun}. Days with no activity contribute p_d = 0
 *      (and the standard `0 * log2(0) = 0` convention).
 *   4. Per-week Shannon entropy H_w = - sum_d p_d * log2(p_d), in
 *      bits, normalised by log2(7) so the headline scalar lives in
 *      [0, 1]:
 *         H_w_norm = H_w / log2(7)
 *      H_w_norm = 1.0 iff the source's tokens that iso-week are
 *      EXACTLY uniform across all 7 days. H_w_norm = 0 iff all
 *      tokens that week land on a single day-of-week. Mass on
 *      exactly k of 7 days uniformly gives H_w_norm = log2(k) /
 *      log2(7).
 *   5. Headline scalar `meanWeeklyEntropyNorm` = TOKEN-WEIGHTED
 *      mean of H_w_norm across active iso weeks, weights =
 *      weekTotalTokens. We also surface the unweighted mean
 *      `unweightedMeanEntropyNorm` and the per-source min / max
 *      / std.
 *
 * RANGE / SEMANTICS
 *   - meanWeeklyEntropyNorm in [0, 1].
 *       0    = every active iso-week has all tokens on a single
 *              day-of-week (could be a different day each week).
 *       1    = every active iso-week perfectly uniform across 7
 *              days.
 *       log2(2) / log2(7) = 0.3562 = mass split evenly between
 *              two days-of-week each week.
 *       log2(5) / log2(7) = 0.8270 = workdays-only uniform.
 *   - unweightedMeanEntropyNorm same range; equals headline iff
 *     every week has equal totalTokens.
 *
 * STRUCTURAL ORTHOGONALITY vs prior 149 axes:
 *
 *   - vs permutation-invariant inequality / diversity axes (Gini,
 *     HHI, Pielou, Atkinson, Theil, Hoover, Pietra, Bonferroni,
 *     Mehran, Wolfson, Foster-Wolfson, Palma, Kolm-Pollak,
 *     Chakravarty, Amato, Esteban-Ray, FGT, GE family,
 *     Var-of-Logs, Log-MAD, Zenga, S-Gini, Hill-tail,
 *     decile-share-gap, quintile-share-ratio,
 *     percentile-gap-ratio, top-4-CR, ...): all of those see only
 *     the active-day VALUE multiset and have no concept of which
 *     iso-week or which day-of-week each value landed on. Two
 *     sources with identical daily multisets but values shuffled
 *     across calendar days have IDENTICAL Gini/HHI/Pielou and
 *     ANY meanWeeklyEntropyNorm in [0, 1]. Witness: D=[X, X]
 *     (two equal active days) has Gini=0 always, but
 *     meanWeeklyEntropyNorm = 1/log2(7) (~ 0.3562) when both days
 *     fall in the same iso week on different DOWs, vs 0 when both
 *     fall in different iso weeks each on a single DOW.
 *
 *   - vs path-dependent axes 145 (max-drawdown-rate), 146
 *     (longest-zero-run), 147 (calendar-mask-RLE-entropy): MDD,
 *     LZR are sequence functionals on the active-day order. RLE-H
 *     is on the calendar 0/1 mask. None of them aggregate
 *     PER ISO WEEK and they don't bin by DOW. Witness: a source
 *     active on every Mon for 10 weeks has MDD=0 (constant
 *     positive value pattern), LZR depends on calendar gaps, and
 *     RLE-H is some fixed function of the 0/1 mask, but
 *     meanWeeklyEntropyNorm = 0 (single-DOW each week). Compare
 *     to a source active on every Mon AND every Tue at half the
 *     mass: MDD class is similar, LZR similar, RLE-H some new
 *     value, and meanWeeklyEntropyNorm = 1/log2(7) (~0.3562).
 *
 *   - vs axis-148 weekend-vs-weekday-ratio: that is a GLOBAL
 *     partition over the whole span (sum weekend tokens vs sum
 *     weekday tokens, ratio). It cannot distinguish a source that
 *     is "uniform Mon-Fri every week" (weekendShare = 0,
 *     meanWeeklyEntropyNorm = log2(5)/log2(7) ~ 0.8270) from a
 *     source that is "all-Mon every week" (weekendShare = 0,
 *     meanWeeklyEntropyNorm = 0). Witness shipped.
 *
 *   - vs axis-149 month-end-vs-month-start-ratio: that is a GLOBAL
 *     intra-MONTH calendar-partition functional. Two sources can
 *     share an identical endShare while having any
 *     meanWeeklyEntropyNorm in [0, 1] depending on how their
 *     daily tokens are distributed WITHIN each iso week. Witness:
 *     all-Mon vs uniform-Mon-Fri can both be tuned to the same
 *     start/end split.
 *
 *   - vs `weekdayshare.ts` / `sourcedayofweektokenmassshare.ts`
 *     (7-bin DOW global histogram): those collapse the entire
 *     active span into a single 7-bin DOW vector and report
 *     shares. They cannot see PER-WEEK variability. A source that
 *     fires X tokens on Mon in iso-week A and X tokens on Tue in
 *     iso-week B has the same global DOW histogram (50% Mon, 50%
 *     Tue) as a source that fires X/2 tokens on Mon AND X/2 on
 *     Tue in EACH of the two iso weeks. Their global DOW shares
 *     are identical, but meanWeeklyEntropyNorm differs: 0 (single
 *     DOW per week) vs 1/log2(7) ~ 0.3562 (two DOWs per week).
 *     Witness shipped.
 *
 *   - vs autocorrelation axes (Pearson lag-1, lag-7, Kendall-tau,
 *     Spearman): autocorrelation measures translation-invariant
 *     dependence on the daily total series. A source with strict
 *     [X, 0, 0, 0, 0, 0, 0]-repeating pattern has lag-7 acf ~ 1
 *     and meanWeeklyEntropyNorm = 0; a source with strict
 *     [X, X, X, X, X, X, X]-uniform pattern has lag-7 acf ~ 1 and
 *     meanWeeklyEntropyNorm = 1. Same lag-7 acf, different
 *     headline. Conversely [X, 0, X, 0, X, 0, X]-repeating
 *     (every-other-day) has lag-7 acf ~ 1 and
 *     meanWeeklyEntropyNorm = log2(4)/log2(7) ~ 0.7124.
 *
 *   - vs spectral axes (peak-frequency, spectral-entropy,
 *     centroid, rolloff, ...): spectral axes are FFT-based on the
 *     full daily series and don't aggregate per-iso-week. Same
 *     witnesses as autocorrelation.
 *
 * REGIME LABEL
 *
 * Per-row `dowConcentrationRegime` bins meanWeeklyEntropyNorm:
 *   - 'single-dow'        : value < 0.05 (essentially all weeks
 *                           collapse to one day-of-week each).
 *   - 'two-dow'           : 0.05 <= value < 0.45 (concentrated on
 *                           ~1-2 days each week).
 *   - 'workweek-tilted'   : 0.45 <= value < 0.75 (most of the
 *                           Mon-Fri block per week).
 *   - 'broad-week'        : 0.75 <= value < 0.95 (close to
 *                           workdays-uniform or 6-of-7 uniform).
 *   - 'uniform-week'      : value >= 0.95 (essentially uniform
 *                           Mon-Sun each week).
 *   - 'degenerate'        : single active iso week with single
 *                           active day (entropy = 0 for trivial
 *                           reasons, not informative).
 *
 * Headline question:
 * **"Within each iso week this source is active, how SPREAD OUT
 *   across days-of-week is its token mass on average?"** -- one
 *   per-source scalar in [0, 1] that ranks cleanly across the
 *   suite and is INSENSITIVE to global day-of-week imbalance,
 *   weekend-vs-weekday tilt, and month-edge tilt.
 *
 * Determinism: pure builder. Wall clock only via opts.generatedAt.
 */
import type { QueueLine } from './types.js';

export type DailyTokenIsoWeekDayOfWeekEntropySort =
  | 'meanEntropy'
  | 'unweightedMeanEntropy'
  | 'minEntropy'
  | 'maxEntropy'
  | 'stdEntropy'
  | 'weeks'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily';

export interface DailyTokenIsoWeekDayOfWeekEntropyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum nDays per source to compute the axis. Default 2. */
  minDays?: number;
  /** Minimum number of active iso weeks per source. Default 1. */
  minWeeks?: number;
  top?: number;
  sort?: DailyTokenIsoWeekDayOfWeekEntropySort;
  /**
   * Display filter: hide rows whose `meanWeeklyEntropyNorm` is
   * strictly below this fraction in [0, 1]. Default null = no
   * filter.
   */
  minMeanEntropy?: number | null;
  generatedAt?: string;
}

export type DowConcentrationRegime =
  | 'single-dow'
  | 'two-dow'
  | 'workweek-tilted'
  | 'broad-week'
  | 'uniform-week'
  | 'degenerate';

export interface DailyTokenIsoWeekDayOfWeekEntropySourceRow {
  source: string;
  totalTokens: number;
  /** Number of UTC days on which the source was actually active. */
  nDays: number;
  /** Number of distinct iso weeks the source is active in. */
  nIsoWeeks: number;
  spanDays: number;
  firstDay: string;
  lastDay: string;
  /**
   * Token-weighted mean of per-iso-week normalised Shannon entropy
   * (base-2, divided by log2(7)) of the within-week DOW
   * distribution. In [0, 1]. Headline scalar.
   */
  meanWeeklyEntropyNorm: number;
  /** Unweighted mean of per-iso-week normalised entropy. */
  unweightedMeanEntropyNorm: number;
  /** Minimum per-iso-week normalised entropy across active weeks. */
  minWeeklyEntropyNorm: number;
  /** Maximum per-iso-week normalised entropy across active weeks. */
  maxWeeklyEntropyNorm: number;
  /**
   * Token-weighted standard deviation of per-iso-week normalised
   * entropy across active weeks. 0 if only one active iso week.
   */
  stdWeeklyEntropyNorm: number;
  dowConcentrationRegime: DowConcentrationRegime;
  meanDailyTokens: number;
  degenerate: boolean;
}

export interface DailyTokenIsoWeekDayOfWeekEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  minWeeks: number;
  top: number;
  sort: DailyTokenIsoWeekDayOfWeekEntropySort;
  minMeanEntropy: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinWeeks: number;
  droppedBelowMinMeanEntropy: number;
  droppedTopSources: number;
  sources: DailyTokenIsoWeekDayOfWeekEntropySourceRow[];
}

const LOG2_7 = Math.log2(7);

/**
 * Returns the ISO-8601 week-numbering (year, week) for a UTC day
 * key `YYYY-MM-DD`. Iso week is 1..53 and the year is the iso
 * week-year (so 2025-12-29 -> 2026-W01). Throws on bad input.
 */
export function isoWeekKey(day: string): { year: number; week: number } {
  const ms = Date.parse(day + 'T00:00:00.000Z');
  if (!Number.isFinite(ms)) {
    throw new Error(`isoWeekKey: invalid day ${day}`);
  }
  // ISO week algorithm (per ISO 8601):
  //   - Take the target date in UTC.
  //   - Shift it forward so Monday=1..Sunday=7.
  //   - The target's iso week-year is the year of the Thursday of
  //     that week.
  const d = new Date(ms);
  // getUTCDay returns Sun=0..Sat=6. Convert to Mon=1..Sun=7.
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  // Move to the Thursday of this week.
  const thursday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow + 3),
  );
  const year = thursday.getUTCFullYear();
  // First Thursday of that iso year:
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const firstThursday = new Date(
    Date.UTC(year, 0, 4 - jan4Dow + 3),
  );
  const week =
    1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { year, week };
}

/**
 * Day-of-week as Mon=0..Sun=6 for a UTC day key. Throws on bad
 * input.
 */
export function isoDayOfWeek(day: string): number {
  const ms = Date.parse(day + 'T00:00:00.000Z');
  if (!Number.isFinite(ms)) {
    throw new Error(`isoDayOfWeek: invalid day ${day}`);
  }
  const d = new Date(ms);
  return (d.getUTCDay() + 6) % 7;
}

/**
 * Normalised Shannon entropy in [0, 1] of a 7-bin probability /
 * mass vector (un-normalised mass; we re-normalise here). Returns
 * 0 if total mass is 0.
 */
export function normalisedDowEntropy(weights: number[]): number {
  if (weights.length !== 7) {
    throw new Error(`normalisedDowEntropy: expected 7 bins, got ${weights.length}`);
  }
  let sum = 0;
  for (const w of weights) {
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(`normalisedDowEntropy: invalid weight ${w}`);
    }
    sum += w;
  }
  if (sum <= 0) return 0;
  let h = 0;
  for (const w of weights) {
    if (w <= 0) continue;
    const p = w / sum;
    h -= p * Math.log2(p);
  }
  // Numerical clamp.
  const norm = h / LOG2_7;
  if (norm < 0) return 0;
  if (norm > 1) return 1;
  return norm;
}

/**
 * Classify meanWeeklyEntropyNorm into a regime label.
 */
export function classifyDowConcentrationRegime(
  meanEntropy: number,
  nWeeks: number,
  nDays: number,
): DowConcentrationRegime {
  if (nWeeks <= 1 && nDays <= 1) return 'degenerate';
  if (meanEntropy < 0.05) return 'single-dow';
  if (meanEntropy < 0.45) return 'two-dow';
  if (meanEntropy < 0.75) return 'workweek-tilted';
  if (meanEntropy < 0.95) return 'broad-week';
  return 'uniform-week';
}

function spanDaysInclusive(a: string, b: string): number {
  const aMs = Date.parse(a + 'T00:00:00.000Z');
  const bMs = Date.parse(b + 'T00:00:00.000Z');
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) {
    throw new Error(`spanDaysInclusive: invalid days ${a} ${b}`);
  }
  return Math.round((bMs - aMs) / 86400000) + 1;
}

export function buildDailyTokenIsoWeekDayOfWeekEntropy(
  queue: QueueLine[],
  opts: DailyTokenIsoWeekDayOfWeekEntropyOptions = {},
): DailyTokenIsoWeekDayOfWeekEntropyReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 1) {
    throw new Error(`minDays must be an integer >= 1 (got ${opts.minDays})`);
  }
  const minWeeks = opts.minWeeks ?? 1;
  if (!Number.isInteger(minWeeks) || minWeeks < 1) {
    throw new Error(`minWeeks must be an integer >= 1 (got ${opts.minWeeks})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minMeanEntropy = opts.minMeanEntropy ?? null;
  if (
    minMeanEntropy !== null &&
    (!Number.isFinite(minMeanEntropy) ||
      minMeanEntropy < 0 ||
      minMeanEntropy > 1)
  ) {
    throw new Error(
      `minMeanEntropy must be a finite number in [0, 1] or null (got ${opts.minMeanEntropy})`,
    );
  }
  const sort: DailyTokenIsoWeekDayOfWeekEntropySort = opts.sort ?? 'meanEntropy';
  const validSorts: DailyTokenIsoWeekDayOfWeekEntropySort[] = [
    'meanEntropy',
    'unweightedMeanEntropy',
    'minEntropy',
    'maxEntropy',
    'stdEntropy',
    'weeks',
    'tokens',
    'days',
    'source',
    'meanDaily',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;

  const sinceMs = opts.since != null ? Date.parse(opts.since) : null;
  const untilMs = opts.until != null ? Date.parse(opts.until) : null;
  if (opts.since != null && (sinceMs === null || !Number.isFinite(sinceMs))) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && (untilMs === null || !Number.isFinite(untilMs))) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  interface SrcAcc {
    perDay: Map<string, number>;
    totalTokens: number;
    firstDay: string;
    lastDay: string;
  }
  const agg = new Map<string, SrcAcc>();
  let droppedInvalidHourStart = 0;
  let droppedNonPositiveTokens = 0;
  let droppedSourceFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;
    const tt = Number(q.total_tokens);
    if (!Number.isFinite(tt) || tt <= 0) {
      droppedNonPositiveTokens += 1;
      continue;
    }
    const src =
      typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }
    const day = q.hour_start.slice(0, 10);
    let acc = agg.get(src);
    if (!acc) {
      acc = {
        perDay: new Map<string, number>(),
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, acc);
    }
    acc.perDay.set(day, (acc.perDay.get(day) ?? 0) + tt);
    acc.totalTokens += tt;
    if (day < acc.firstDay) acc.firstDay = day;
    if (day > acc.lastDay) acc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let droppedBelowMinDays = 0;
  let droppedBelowMinWeeks = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenIsoWeekDayOfWeekEntropySourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nDays = acc.perDay.size;
    if (nDays < minDays) {
      droppedBelowMinDays += 1;
      continue;
    }

    // Group by iso-week, accumulate per-DOW token mass.
    const weekBins = new Map<string, number[]>();
    for (const [day, v] of acc.perDay) {
      const { year, week } = isoWeekKey(day);
      const wk = `${year}-W${String(week).padStart(2, '0')}`;
      const dow = isoDayOfWeek(day);
      let bins = weekBins.get(wk);
      if (!bins) {
        bins = [0, 0, 0, 0, 0, 0, 0];
        weekBins.set(wk, bins);
      }
      bins[dow]! += v;
    }
    const nIsoWeeks = weekBins.size;
    if (nIsoWeeks < minWeeks) {
      droppedBelowMinWeeks += 1;
      continue;
    }

    // Per-week entropies + weights.
    const entropies: number[] = [];
    const weights: number[] = [];
    for (const bins of weekBins.values()) {
      const wTotal = bins.reduce((s, x) => s + x, 0);
      if (wTotal <= 0) continue;
      entropies.push(normalisedDowEntropy(bins));
      weights.push(wTotal);
    }

    // Token-weighted mean.
    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < entropies.length; i += 1) {
      weightedSum += entropies[i]! * weights[i]!;
      weightTotal += weights[i]!;
    }
    const meanWeighted = weightTotal > 0 ? weightedSum / weightTotal : 0;

    // Unweighted mean.
    let meanUnweighted = 0;
    if (entropies.length > 0) {
      let s = 0;
      for (const h of entropies) s += h;
      meanUnweighted = s / entropies.length;
    }

    // Min / max.
    let minH = 1;
    let maxH = 0;
    if (entropies.length === 0) {
      minH = 0;
      maxH = 0;
    } else {
      minH = entropies[0]!;
      maxH = entropies[0]!;
      for (const h of entropies) {
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
    }

    // Token-weighted std dev.
    let stdH = 0;
    if (entropies.length > 1 && weightTotal > 0) {
      let varSum = 0;
      for (let i = 0; i < entropies.length; i += 1) {
        const d = entropies[i]! - meanWeighted;
        varSum += weights[i]! * d * d;
      }
      stdH = Math.sqrt(varSum / weightTotal);
    }

    const spanDays = spanDaysInclusive(acc.firstDay, acc.lastDay);
    const meanDaily = acc.totalTokens / nDays;
    const degenerate = nDays < 2 || nIsoWeeks < 1;
    const dowConcentrationRegime = classifyDowConcentrationRegime(
      meanWeighted,
      nIsoWeeks,
      nDays,
    );

    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      nIsoWeeks,
      spanDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      meanWeeklyEntropyNorm: meanWeighted,
      unweightedMeanEntropyNorm: meanUnweighted,
      minWeeklyEntropyNorm: minH,
      maxWeeklyEntropyNorm: maxH,
      stdWeeklyEntropyNorm: stdH,
      dowConcentrationRegime,
      meanDailyTokens: meanDaily,
      degenerate,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinMeanEntropy = 0;
  let filtered = rows;
  if (minMeanEntropy !== null) {
    const next: DailyTokenIsoWeekDayOfWeekEntropySourceRow[] = [];
    for (const r of rows) {
      if (r.meanWeeklyEntropyNorm >= minMeanEntropy) next.push(r);
      else droppedBelowMinMeanEntropy += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'unweightedMeanEntropy':
        primary = b.unweightedMeanEntropyNorm - a.unweightedMeanEntropyNorm;
        break;
      case 'minEntropy':
        primary = b.minWeeklyEntropyNorm - a.minWeeklyEntropyNorm;
        break;
      case 'maxEntropy':
        primary = b.maxWeeklyEntropyNorm - a.maxWeeklyEntropyNorm;
        break;
      case 'stdEntropy':
        primary = b.stdWeeklyEntropyNorm - a.stdWeeklyEntropyNorm;
        break;
      case 'weeks':
        primary = b.nIsoWeeks - a.nIsoWeeks;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'days':
        primary = b.nDays - a.nDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'meanDaily':
        primary = b.meanDailyTokens - a.meanDailyTokens;
        break;
      case 'meanEntropy':
      default:
        primary = b.meanWeeklyEntropyNorm - a.meanWeeklyEntropyNorm;
        break;
    }
    if (primary !== 0) return primary;
    // Secondary tie-break: heavier sources first, then source asc.
    if (a.totalTokens !== b.totalTokens) return b.totalTokens - a.totalTokens;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedTopSources = 0;
  let kept = filtered;
  if (top > 0 && filtered.length > top) {
    droppedTopSources = filtered.length - top;
    kept = filtered.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    minDays,
    minWeeks,
    top,
    sort,
    minMeanEntropy,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinWeeks,
    droppedBelowMinMeanEntropy,
    droppedTopSources,
    sources: kept,
  };
}
