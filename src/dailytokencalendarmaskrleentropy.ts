/**
 * daily-token-calendar-mask-rle-entropy: per-source SHANNON
 * ENTROPY (in bits) of the RUN-LENGTH ENCODING of the
 * 0/1 calendar mask `[firstActiveDay..lastActiveDay]` of the
 * per-day total_tokens series.
 *
 * ONE-HUNDRED-AND-FORTY-SEVENTH cross-source axis.
 *
 * The day vector is built by EXPANDING the source's active days
 * onto the full UTC calendar between firstActiveDay and
 * lastActiveDay, filling missing dates with zero. We then
 * RUN-LENGTH-ENCODE the alternating active/silent stretches
 * into a list of segment lengths `r_1, r_2, ..., r_K` (with
 * `sum(r_i) = spanDays`, `r_1` and `r_K` always active by
 * construction since both bookends are non-zero). The axis is
 * the Shannon entropy in bits of the LENGTH DISTRIBUTION
 * normalised by spanDays:
 *
 *   p_i = r_i / spanDays
 *   H   = -sum_i p_i * log2(p_i)
 *
 * H is in `[0, log2(K)]`. K = 1 (a single all-active segment,
 * i.e. perfectly continuous source) gives H = 0. Maximally
 * fragmented patterns where all K segments are equal length
 * give H = log2(K).
 *
 * THIRD PATH-DEPENDENT cross-source daily-token axis (after
 * axis-145 max-drawdown-rate and axis-146 longest-zero-run).
 * Structurally orthogonal to BOTH:
 *
 *   - vs axis-145 MDD: MDD is a magnitude / depth functional
 *     on the active-day VALUE vector (worst peak-to-trough
 *     proportional drop). RLE entropy is a SHAPE / FRAGMENT-
 *     ATION functional on the calendar 0/1 MASK. MDD ignores
 *     calendar gaps; RLE entropy ignores token magnitudes.
 *     Source U `[100,1,100]` adjacent: MDD = 0.99, RLE-H = 0
 *     (single active segment of length 3). Source V `[100,100]`
 *     on day-1+day-30: MDD = 0, RLE-H = -((1/30)log(1/30) +
 *     (28/30)log(28/30) + (1/30)log(1/30)) ~= 0.55 bits.
 *
 *   - vs axis-146 longest-zero-run: LZR is the MAX of the
 *     SILENT-segment lengths only. RLE-H is the entropy of
 *     ALL segment lengths (active + silent). Two sources can
 *     have IDENTICAL longestZeroRun but VERY DIFFERENT
 *     RLE-H:
 *       * source W: mask = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0]
 *         (10-day span, 5-on then 5-off-then-end... actually
 *         the trailing 0s are stripped because lastDay is by
 *         construction non-zero, so the realistic shape is
 *         [1,1,1,1,1,0,0,0,0,1] -- 10-day span, segments
 *         (5 active, 4 silent, 1 active). LZR = 4.
 *         Lengths (5, 4, 1) -> p = (.5, .4, .1) ->
 *         H = .5*1 + .4*1.3219 + .1*3.3219 = 1.3610 bits.
 *       * source X: mask = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1]
 *         (also 10-day span, LZR = 2 -- DIFFERENT). Different
 *         segments yield different H. The two functionals
 *         pick out different facets even when LZR collides.
 *
 *   - vs axis-141 (Pearson-2nd-skewness), axis-143 (HHI),
 *     axis-144 (Pielou-J): all PERMUTATION-INVARIANT on the
 *     active-day MULTISET; they cannot see calendar gaps.
 *     Sources W and X above with disjoint silent / active
 *     stretches have IDENTICAL Pearson-skew, HHI, Pielou
 *     (because all active values are equal) but DIFFERENT
 *     RLE-H.
 *
 * Distinct from any HOUR-OF-DAY entropy / mass-entropy axes
 * (those operate on the 24-bin circular hour vector pooled
 * across days). Distinct from spectral-entropy axes (those
 * operate on the FFT magnitude distribution of the daily token
 * sequence, capturing FREQUENCY-DOMAIN structure). RLE-H
 * operates entirely in the TIME-DOMAIN on the calendar mask,
 * making it a pure SHAPE-OF-DORMANCY descriptor.
 *
 * Distinct from permutation-entropy axes which operate on
 * order-patterns of consecutive value triples in the active-
 * day vector; they do not see calendar gaps.
 *
 * RANGE AND BOUNDS:
 *   - rleEntropyBits in `[0, log2(spanDays)]` (since at most
 *     `spanDays` segments of length 1 are possible). In practice
 *     bounded by `log2(K)` where K = segmentCount.
 *   - rleEntropyNormalised = rleEntropyBits / log2(K) in `[0, 1]`,
 *     interpretable as how UNIFORM the segment-length distribution
 *     is. 1 iff every segment is the same length. For K = 1
 *     (single active segment), normalised entropy is defined as
 *     0 (no fragmentation possible).
 *   - 0 iff the source was active on every UTC day (single
 *     all-active segment, perfect continuity).
 *
 * Headline question:
 * **"How FRAGMENTED is the source's calendar footprint -- is
 *   dormancy concentrated in one big silence (low RLE entropy)
 *   or scattered evenly across many similar-length stretches
 *   (high RLE entropy)?"**
 *
 * Determinism: pure builder. Wall clock only via opts.generatedAt.
 */
import type { QueueLine } from './types.js';

export type DailyTokenCalendarMaskRleEntropySort =
  | 'rleEntropyBits'
  | 'rleEntropyNormalised'
  | 'segmentCount'
  | 'spanDays'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily';

export interface DailyTokenCalendarMaskRleEntropyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenCalendarMaskRleEntropySort;
  minSegmentCount?: number | null;
  generatedAt?: string;
}

export interface DailyTokenCalendarMaskRleEntropySourceRow {
  source: string;
  totalTokens: number;
  /** Number of UTC days on which the source was actually active. */
  nDays: number;
  /** Calendar span: (lastActiveDay - firstActiveDay) + 1 in days. */
  spanDays: number;
  firstDay: string;
  lastDay: string;
  /**
   * Number of disjoint segments in the run-length encoding of the
   * calendar mask. By construction `firstDay` and `lastDay` are
   * active so the first and last segments are always 1-runs;
   * silent segments are only ever interior. K = 1 iff the source
   * has no calendar gaps.
   */
  segmentCount: number;
  /**
   * Number of ACTIVE segments in the RLE (the 1-runs). Always
   * `>= 1` and equals `ceil(segmentCount / 2)` since segments
   * always start and end with active.
   */
  activeSegmentCount: number;
  /**
   * Number of SILENT segments in the RLE (the 0-runs). Always
   * `>= 0` and equals `floor(segmentCount / 2)`.
   */
  silentSegmentCount: number;
  /**
   * Shannon entropy in bits of the segment-length probability
   * distribution `p_i = r_i / spanDays`. In `[0, log2(segmentCount)]`.
   * 0 iff `segmentCount = 1` (perfectly continuous source).
   */
  rleEntropyBits: number;
  /**
   * `rleEntropyBits / log2(segmentCount)` in `[0, 1]`.
   * For `segmentCount = 1` defined as 0 (no fragmentation).
   * 1 iff every segment in the RLE has identical length.
   */
  rleEntropyNormalised: number;
  /** Length of the longest segment (across both active and silent). */
  longestSegmentLength: number;
  /** Length of the shortest segment in the RLE. */
  shortestSegmentLength: number;
  /**
   * Refinement (v0.6.394): structural label binning the
   * fragmentation profile into five regimes:
   *   - 'continuous'   : segmentCount = 1 (no calendar gaps).
   *   - 'low-fragment' : segmentCount in [2, 3] (one or two silences).
   *   - 'fragmented'   : segmentCount in [4, 9].
   *   - 'shattered'    : segmentCount in [10, 49].
   *   - 'pulverised'   : segmentCount >= 50.
   *   - 'degenerate'   : spanDays < 2.
   */
  fragmentationRegime:
    | 'continuous'
    | 'low-fragment'
    | 'fragmented'
    | 'shattered'
    | 'pulverised'
    | 'degenerate';
  meanDailyTokens: number;
  degenerate: boolean;
}

export interface DailyTokenCalendarMaskRleEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenCalendarMaskRleEntropySort;
  minSegmentCount: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinSegmentCount: number;
  droppedTopSources: number;
  sources: DailyTokenCalendarMaskRleEntropySourceRow[];
}

/**
 * Run-length-encode a 0/1 mask into an ordered list of segment
 * lengths. Empty input returns empty array.
 */
export function runLengthEncodeMask(mask: number[]): number[] {
  const out: number[] = [];
  if (mask.length === 0) return out;
  let cur = mask[0] as number;
  let len = 1;
  for (let i = 1; i < mask.length; i += 1) {
    const v = mask[i] as number;
    if (v === cur) {
      len += 1;
    } else {
      out.push(len);
      cur = v;
      len = 1;
    }
  }
  out.push(len);
  return out;
}

/**
 * Shannon entropy in bits of the length distribution
 * `p_i = lengths[i] / sum(lengths)`. Returns 0 for an empty
 * input or a single-element input.
 */
export function shannonEntropyBitsOfLengths(lengths: number[]): number {
  if (lengths.length <= 1) return 0;
  let total = 0;
  for (const l of lengths) total += l;
  if (total <= 0) return 0;
  let h = 0;
  const ln2 = Math.log(2);
  for (const l of lengths) {
    if (l <= 0) continue;
    const p = l / total;
    h -= p * (Math.log(p) / ln2);
  }
  // Numerical hygiene: clamp tiny negatives produced by FP rounding.
  if (h < 0 && h > -1e-12) h = 0;
  return h;
}

function addUtcDays(day: string, daysToAdd: number): string {
  const ms = Date.parse(day + 'T00:00:00.000Z');
  if (!Number.isFinite(ms)) {
    throw new Error(`addUtcDays: invalid day ${day}`);
  }
  const d = new Date(ms + daysToAdd * 86400000);
  return d.toISOString().slice(0, 10);
}

function spanDaysInclusive(a: string, b: string): number {
  const aMs = Date.parse(a + 'T00:00:00.000Z');
  const bMs = Date.parse(b + 'T00:00:00.000Z');
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) {
    throw new Error(`spanDaysInclusive: invalid days ${a} ${b}`);
  }
  return Math.round((bMs - aMs) / 86400000) + 1;
}

export function buildDailyTokenCalendarMaskRleEntropy(
  queue: QueueLine[],
  opts: DailyTokenCalendarMaskRleEntropyOptions = {},
): DailyTokenCalendarMaskRleEntropyReport {
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
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minSegmentCount = opts.minSegmentCount ?? null;
  if (
    minSegmentCount !== null &&
    (!Number.isInteger(minSegmentCount) || minSegmentCount < 1)
  ) {
    throw new Error(
      `minSegmentCount must be an integer >= 1 or null (got ${opts.minSegmentCount})`,
    );
  }
  const sort: DailyTokenCalendarMaskRleEntropySort =
    opts.sort ?? 'rleEntropyBits';
  const validSorts: DailyTokenCalendarMaskRleEntropySort[] = [
    'rleEntropyBits',
    'rleEntropyNormalised',
    'segmentCount',
    'spanDays',
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
  let totalTokensSum = 0;
  const rows: DailyTokenCalendarMaskRleEntropySourceRow[] = [];

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
    const spanDays = spanDaysInclusive(acc.firstDay, acc.lastDay);
    const mask: number[] = new Array(spanDays);
    for (let i = 0; i < spanDays; i += 1) {
      const day = addUtcDays(acc.firstDay, i);
      mask[i] = acc.perDay.has(day) ? 1 : 0;
    }
    const rle = runLengthEncodeMask(mask);
    const segmentCount = rle.length;
    // By construction first segment is active (mask[0] = 1).
    let activeSegmentCount = 0;
    let silentSegmentCount = 0;
    for (let i = 0; i < segmentCount; i += 1) {
      if (i % 2 === 0) activeSegmentCount += 1;
      else silentSegmentCount += 1;
    }
    const h = shannonEntropyBitsOfLengths(rle);
    const hMax = segmentCount > 1 ? Math.log2(segmentCount) : 0;
    const hNorm = hMax > 0 ? h / hMax : 0;
    let longest = 0;
    let shortest = segmentCount > 0 ? rle[0] as number : 0;
    for (const l of rle) {
      if (l > longest) longest = l;
      if (l < shortest) shortest = l;
    }
    const degenerate = spanDays < 2;
    let meanDaily = 0;
    for (const v of acc.perDay.values()) meanDaily += v;
    meanDaily = meanDaily / nDays;
    let fragmentationRegime:
      | 'continuous'
      | 'low-fragment'
      | 'fragmented'
      | 'shattered'
      | 'pulverised'
      | 'degenerate';
    if (degenerate) {
      fragmentationRegime = 'degenerate';
    } else if (segmentCount === 1) {
      fragmentationRegime = 'continuous';
    } else if (segmentCount <= 3) {
      fragmentationRegime = 'low-fragment';
    } else if (segmentCount <= 9) {
      fragmentationRegime = 'fragmented';
    } else if (segmentCount <= 49) {
      fragmentationRegime = 'shattered';
    } else {
      fragmentationRegime = 'pulverised';
    }
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      spanDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      segmentCount,
      activeSegmentCount,
      silentSegmentCount,
      rleEntropyBits: h,
      rleEntropyNormalised: hNorm,
      longestSegmentLength: longest,
      shortestSegmentLength: shortest,
      fragmentationRegime,
      meanDailyTokens: meanDaily,
      degenerate,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinSegmentCount = 0;
  let filtered = rows;
  if (minSegmentCount !== null) {
    const next: DailyTokenCalendarMaskRleEntropySourceRow[] = [];
    for (const r of rows) {
      if (r.segmentCount >= minSegmentCount) next.push(r);
      else droppedBelowMinSegmentCount += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'days':
        primary = b.nDays - a.nDays;
        break;
      case 'spanDays':
        primary = b.spanDays - a.spanDays;
        break;
      case 'segmentCount':
        primary = b.segmentCount - a.segmentCount;
        break;
      case 'rleEntropyNormalised':
        primary = b.rleEntropyNormalised - a.rleEntropyNormalised;
        break;
      case 'source':
        primary = 0;
        break;
      case 'meanDaily':
        primary = b.meanDailyTokens - a.meanDailyTokens;
        break;
      case 'rleEntropyBits':
      default:
        primary = b.rleEntropyBits - a.rleEntropyBits;
        break;
    }
    if (primary !== 0) return primary;
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
    top,
    sort,
    minSegmentCount,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinSegmentCount,
    droppedTopSources,
    sources: kept,
  };
}
