/**
 * daily-token-box-count-fd: per-source Box-Counting Fractal Dimension
 * (Mandelbrot 1967; classical implementation per Liebovitch & Toth
 * 1989, "A fast algorithm to determine fractal dimensions by box
 * counting", Phys. Lett. A 141(8-9):386-390) on the gap-filled daily
 * total_tokens series.
 *
 * SEVENTY-EIGHTH cross-source axis.
 *
 * For each source, build the per-UTC-day total_tokens series across
 * the source's tenure [firstActiveDay, lastActiveDay]. Missing
 * calendar days INSIDE that tenure are filled with 0 tokens (same
 * gap-fill convention as axes 67/68/69/70/71/72/73/74/75/76/77).
 *
 * Box-counting procedure (2D grid coverage on the unit square):
 *
 *   1. DOUBLE-NORMALIZE the waveform onto the unit square [0, 1]^2:
 *        x*[i] = i / (N - 1)               (uniform unit spacing)
 *        y*[i] = (y[i] - ymin) / (ymax - ymin)
 *
 *   2. For a sequence of GRID RESOLUTIONS m = m_min .. m_max
 *      (geometric progression by factor 2), partition [0, 1]^2 into
 *      an m x m grid of square boxes of side eps = 1/m. Sample the
 *      polyline by linear interpolation at sub-step resolution
 *      delta = eps / 4 (= 1/(4m)) along each segment, mark every
 *      (col, row) box that contains a sampled point. Count the
 *      number of UNIQUE marked boxes -> N(eps).
 *
 *   3. The box-counting fractal dimension is the OLS slope of
 *
 *        log(N(eps)) vs log(1 / eps) = log(m)
 *
 *      across the geometric ladder m = m_min .. m_max.
 *
 *      BFD = -slope_OLS(ln eps, ln N(eps)) = slope_OLS(ln m, ln N(m))
 *
 * Defaults: `min-tenure-days = 32`, `min-tokens = 1000`,
 * `m-min = 2`, `m-max = 32` (so the ladder is m in {2, 4, 8, 16, 32}
 * -> 5 OLS points). The choice m_max = 32 keeps the smallest box
 * side eps = 1/32 well above 1/(N-1) for our default N >= 32 floor,
 * so no eps probes a sub-step resolution finer than the data grid
 * (which would saturate at one box per sample).
 *
 * Reported `bfd` is clamped to [1, 2] for symmetry with axes 74
 * (HFD), 75 (KFD), 76 (PFD), 77 (SFD); un-clamped `bfdRaw`,
 * `clampedBelow1`, `clampedAbove2` counters surfaced for operators.
 * Also reports `nGridSteps` (number of OLS points), `gridMin`,
 * `gridMax`, `slopeR2` (OLS goodness-of-fit on the log-log ladder),
 * `boxCountsCsv` (the N(m) sequence joined by `|` for traceability),
 * `yRange` (raw informational), and `dxStep` (1/(N-1); informational).
 *
 * Reading BFD:
 *   - BFD ~ 1.0  = near-1D path on the unit square (smooth monotone
 *                  ramp; N(m) grows linearly in m).
 *   - BFD ~ 1.3  = moderately rough (N(m) grows faster than m).
 *   - BFD -> 2   = highly rough / near-space-filling on the unit
 *                  square (N(m) approaches m^2).
 *
 * STRUCTURAL ORTHOGONALITY -- MULTI-SCALE OLS LOG-LOG SLOPE OF 2D
 * GRID COVERAGE ON THE DOUBLE-NORMALIZED UNIT SQUARE, fundamentally
 * distinct from every shipped daily-token axis 32..77:
 *
 *   - vs `daily-token-sevcik-fd` (axis 77): SFD is a SINGLE-SCALE
 *     CLOSED-FORM ratio (no log-log fit; one path length L vs one
 *     denominator 2*(N-1)). BFD is a MULTI-SCALE OLS fit across a
 *     geometric grid ladder. Two series can share the same path
 *     length L (and hence the same SFD) yet differ in HOW that
 *     length is distributed across scales: a series with one big
 *     spike and otherwise smooth has the same total L as a series
 *     with many small spikes summing to the same L; box-counting
 *     at coarse m sees the big spike clearly but is insensitive to
 *     the many-small-spike series at the same m, while at fine m
 *     they converge. This produces different log-log slopes and
 *     different BFD values for the same SFD. The test file ships
 *     a `sameL_differentBFD` witness asserting they can disagree
 *     by > 1e-3 on hand-constructed series.
 *
 *   - vs `daily-token-petrosian-fd` (axis 76): PFD is purely
 *     BINARY post-sign-mapping; magnitudes drop out. BFD operates
 *     on range-normalized magnitudes through the y* coordinate,
 *     so two series with identical sign-of-diff sequences but
 *     different magnitude profiles share PFD but typically diverge
 *     on BFD. Conversely both are invariant under positive AFFINE
 *     rescale of y, but BFD is sensitive to non-affine monotone
 *     transforms (e.g. y' = sqrt(y) reshapes the y* coordinate and
 *     redistributes box coverage) that PFD ignores entirely.
 *
 *   - vs `daily-token-katz-fd` (axis 75): KFD is a single-scale
 *     closed-form using RAW path length and RAW max chord d as
 *     denominator. BFD is multi-scale and operates on the
 *     double-normalized unit square. KFD is dimensionally
 *     inconsistent (mixes unit x-spacing with raw-magnitude y);
 *     BFD has no such issue (both axes are dimensionless after
 *     normalization). They diverge sharply on series with one
 *     extreme outlier (inflates d -> KFD down; box coverage at
 *     coarse m sees one extra column -> BFD essentially unchanged).
 *
 *   - vs `daily-token-higuchi-fd` (axis 74): HFD is a multi-scale
 *     OLS power-law exponent on STRIDE-K SUBSAMPLED PATH LENGTHS
 *     L(k) (1D length scaling under reflexive-walk subsampling).
 *     BFD's multi-scale ladder is on 2D BOX COVERAGE N(eps); they
 *     are different complexity probes (path-length scaling vs
 *     coverage scaling) and use different dependent variables
 *     (L vs N) and different slope normalizations.
 *
 *   - vs `daily-token-hurst-rs` (axis 71) and `daily-token-dfa-
 *     alpha` (axis 72): R/S and DFA are VARIANCE-scaling estimators
 *     on cumulative deviations (DFA additionally detrends each
 *     window). BFD has no cumulative profile and no variance fit.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): SE summarises
 *     flatness of the global periodogram (frequency-domain). BFD
 *     is a time-domain geometric multi-scale slope.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70) and `daily-
 *     token-sample-entropy` (axis 73): both are pattern / template
 *     statistics; BFD is a pure 2D-coverage log-log slope with no
 *     embedding window or template matching.
 *
 *   - vs `daily-token-autocorrelation-lag1` / `lag7` (axes 67/68):
 *     ACF is a SECOND-MOMENT linear scalar at one fixed lag; BFD
 *     is a multi-scale geometric slope with no second-moment
 *     interpretation.
 *
 *   - vs all permutation-invariant dispersion / shape axes 32..67
 *     (Gini, Atkinson, Theil, GE, Hill, MC, L-skew, ...): those
 *     are shuffle-invariant; BFD is shuffle-sensitive (a sorted
 *     monotone sequence covers ~m boxes at each scale -> BFD ~ 1,
 *     while a shuffled noisy sequence covers many more boxes and
 *     yields a substantially higher BFD).
 *
 * Caveats:
 *
 *   - All-zero gap-filled series (vanishingly rare given upstream
 *     `tt > 0` filter) yield ymax = ymin and the y-normalization is
 *     degenerate; reported as `droppedZeroVariance` (mirrors axes
 *     74/75/76/77).
 *   - BFD is defined in [1, 2] in theory; reported `bfd` is
 *     clamped to that bracket. With finite N and discrete grids
 *     bfdRaw can drift slightly outside [1, 2] (especially for
 *     near-monotone or near-saturating sequences); `clampedBelow1`
 *     / `clampedAbove2` counters surface those cases.
 *   - BFD is invariant under any strictly-positive AFFINE transform
 *     of the y axis: y' = a*y + b with a > 0 leaves BFD unchanged
 *     because the range-normalization absorbs both a and b. It is
 *     NOT invariant under non-affine monotone transforms (e.g.
 *     y' = sqrt(y) reshapes the y* distribution and redistributes
 *     box coverage).
 *   - Sub-step interpolation is at delta = eps/4 (4 samples per
 *     box side) which is a standard polyline rasterization choice
 *     (Liebovitch & Toth 1989; see also Block, von Bloh & Schellnhuber
 *     1990). Coarser delta would under-count boxes on steep
 *     segments; finer delta would over-pay without meaningfully
 *     changing N(eps).
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * References:
 *   Mandelbrot, B. B., "How long is the coast of Britain?
 *     Statistical self-similarity and fractional dimension",
 *     Science 156(3775):636-638, 1967.
 *   Liebovitch, L. S. & Toth, T., "A fast algorithm to determine
 *     fractal dimensions by box counting", Phys. Lett. A
 *     141(8-9):386-390, 1989.
 *   Block, A., von Bloh, W., Schellnhuber, H. J., "Efficient
 *     box-counting determination of generalized fractal dimensions",
 *     Phys. Rev. A 42(4):1869-1874, 1990.
 */
import type { QueueLine } from './types.js';

export type DailyTokenBoxCountFdSort =
  | 'absBfdDeviationDesc'
  | 'bfd'
  | 'bfdDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenBoxCountFdOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4 so the smallest
   * grid (m=2) has at least 2 segments to cover.
   * Default 32 (matches axes 74/75/76/77).
   */
  minTenureDays?: number;
  /** Smallest grid size (default 2). Must be integer >= 2. */
  gridMin?: number;
  /** Largest grid size (default 32). Must be integer > gridMin and a power of 2 multiple via doubling. */
  gridMax?: number;
  top?: number;
  sort?: DailyTokenBoxCountFdSort;
  generatedAt?: string;
}

export interface DailyTokenBoxCountFdSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Box-counting fractal dimension clamped to [1, 2]. */
  bfd: number;
  /** Un-clamped box-counting fractal dimension. */
  bfdRaw: number;
  /** R^2 of the OLS fit on the log-log ladder. */
  slopeR2: number;
  /** Number of grid resolutions used in the OLS fit. */
  nGridSteps: number;
  /** Smallest grid resolution actually used (after capping at N-1). */
  gridMin: number;
  /** Largest grid resolution actually used. */
  gridMax: number;
  /** Pipe-joined N(m) sequence for traceability (e.g. "3|7|14|26|49"). */
  boxCountsCsv: string;
  /** Range of the raw series (ymax - ymin); informational. */
  yRange: number;
  /** Horizontal step on the unit square (= 1 / (N - 1)); informational. */
  dxStep: number;
  /** True if bfdRaw was clamped from below 1 to 1. */
  clampedBelow1: boolean;
  /** True if bfdRaw was clamped from above 2 to 2. */
  clampedAbove2: boolean;
}

export interface DailyTokenBoxCountFdReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  gridMin: number;
  gridMax: number;
  top: number;
  sort: DailyTokenBoxCountFdSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteBfd: number;
  droppedTopSources: number;
  clampedBelow1: number;
  clampedAbove2: number;
  sources: DailyTokenBoxCountFdSourceRow[];
}

/**
 * Box-counting fractal dimension on a real-valued series. Returns
 * the un-clamped BFD, OLS R^2 on the log-log ladder, the actual
 * grid range used, and the per-grid box counts.
 *
 * The grid ladder is `gridMin, 2*gridMin, 4*gridMin, ...`
 * (geometric doubling) up to and including `gridMax`. Any grid
 * level exceeding `(N - 1)` (the data x-resolution) is dropped
 * because box widths smaller than the data grid would saturate at
 * one box per sample and add no information.
 *
 * Throws when the surviving ladder has fewer than 2 grid points
 * (need at least two for an OLS slope), when y is constant
 * (degenerate normalization), or when the slope collapses to a
 * non-finite value.
 */
export function boxCountFd(
  values: number[],
  gridMin: number,
  gridMax: number,
): {
  bfd: number;
  bfdRaw: number;
  slopeR2: number;
  nGridSteps: number;
  gridMinUsed: number;
  gridMaxUsed: number;
  boxCounts: number[];
  yRange: number;
  dxStep: number;
  clampedBelow1: boolean;
  clampedAbove2: boolean;
} {
  const N = values.length;
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('boxCountFd requires finite values');
    }
  }
  if (N < 3) {
    throw new Error(`boxCountFd: series too short (n=${N}, need n >= 3)`);
  }
  if (!Number.isInteger(gridMin) || gridMin < 2) {
    throw new Error(`boxCountFd: gridMin must be integer >= 2 (got ${gridMin})`);
  }
  if (!Number.isInteger(gridMax) || gridMax <= gridMin) {
    throw new Error(
      `boxCountFd: gridMax must be integer > gridMin (got ${gridMax})`,
    );
  }
  let ymin = values[0]!;
  let ymax = values[0]!;
  for (let i = 1; i < N; i += 1) {
    const v = values[i]!;
    if (v < ymin) ymin = v;
    if (v > ymax) ymax = v;
  }
  const yRange = ymax - ymin;
  if (!(yRange > 0)) {
    throw new Error(`boxCountFd: zero y-range (ymin = ymax = ${ymin})`);
  }
  const dxStep = 1 / (N - 1);

  // Build geometric ladder by doubling, cap at gridMax and at (N-1).
  // Cap at (N-1) because eps = 1/m smaller than 1/(N-1) probes finer
  // than the data grid; one-box-per-sample saturation is uninformative.
  const ladderCap = Math.min(gridMax, N - 1);
  const grids: number[] = [];
  for (let m = gridMin; m <= ladderCap; m *= 2) {
    grids.push(m);
  }
  if (grids.length < 2) {
    throw new Error(
      `boxCountFd: need at least 2 grid steps, got ${grids.length} (N=${N}, gridMin=${gridMin}, gridMax=${gridMax})`,
    );
  }

  // Pre-normalize y to [0, 1].
  const yn: number[] = new Array(N);
  for (let i = 0; i < N; i += 1) {
    yn[i] = (values[i]! - ymin) / yRange;
  }

  const boxCounts: number[] = [];
  for (const m of grids) {
    const eps = 1 / m;
    const seen = new Set<number>();
    // For each segment [i, i+1], rasterize at sub-step delta = eps/4.
    for (let i = 0; i < N - 1; i += 1) {
      const x0 = i / (N - 1);
      const x1 = (i + 1) / (N - 1);
      const y0 = yn[i]!;
      const y1 = yn[i + 1]!;
      const segLen = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
      // Sub-samples per segment: at least 2 (endpoints), up to
      // ceil(4 * segLen / eps). The 4x factor is the standard
      // Liebovitch-Toth oversample.
      const nSub = Math.max(2, Math.ceil((4 * segLen) / eps) + 1);
      for (let k = 0; k < nSub; k += 1) {
        const t = k / (nSub - 1);
        const xt = x0 + t * (x1 - x0);
        const yt = y0 + t * (y1 - y0);
        let col = Math.floor(xt * m);
        let row = Math.floor(yt * m);
        if (col >= m) col = m - 1;
        if (row >= m) row = m - 1;
        if (col < 0) col = 0;
        if (row < 0) row = 0;
        // Encode (col, row) as col * m + row -- m <= N - 1 < 2^31 / 2 for
        // any realistic tenure, so the integer fits in a JS number key.
        seen.add(col * m + row);
      }
    }
    boxCounts.push(seen.size);
  }

  // OLS on (ln m, ln N(m)).
  const k = grids.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  const xs: number[] = new Array(k);
  const ys: number[] = new Array(k);
  for (let i = 0; i < k; i += 1) {
    xs[i] = Math.log(grids[i]!);
    ys[i] = Math.log(boxCounts[i]!);
    if (!Number.isFinite(ys[i]!)) {
      throw new Error(
        `boxCountFd: non-finite ln N(m) at m=${grids[i]} (N(m)=${boxCounts[i]})`,
      );
    }
    sx += xs[i]!;
    sy += ys[i]!;
    sxx += xs[i]! * xs[i]!;
    sxy += xs[i]! * ys[i]!;
  }
  const meanX = sx / k;
  const meanY = sy / k;
  const num = sxy - k * meanX * meanY;
  const den = sxx - k * meanX * meanX;
  if (!(den > 0)) {
    throw new Error(`boxCountFd: degenerate OLS (var(ln m) = 0)`);
  }
  const bfdRaw = num / den;
  if (!Number.isFinite(bfdRaw)) {
    throw new Error(`boxCountFd: non-finite slope (${bfdRaw})`);
  }
  // R^2 on the log-log fit.
  let ssRes = 0;
  let ssTot = 0;
  const intercept = meanY - bfdRaw * meanX;
  for (let i = 0; i < k; i += 1) {
    const yhat = intercept + bfdRaw * xs[i]!;
    ssRes += (ys[i]! - yhat) ** 2;
    ssTot += (ys[i]! - meanY) ** 2;
  }
  const slopeR2 = ssTot > 0 ? 1 - ssRes / ssTot : 1;
  const clampedBelow1 = bfdRaw < 1;
  const clampedAbove2 = bfdRaw > 2;
  const bfd = Math.max(1, Math.min(2, bfdRaw));
  return {
    bfd,
    bfdRaw,
    slopeR2,
    nGridSteps: k,
    gridMinUsed: grids[0]!,
    gridMaxUsed: grids[k - 1]!,
    boxCounts,
    yRange,
    dxStep,
    clampedBelow1,
    clampedAbove2,
  };
}

function addUtcDays(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`);
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

function dayDiffInclusive(a: string, b: string): number {
  const am = Date.parse(`${a}T00:00:00.000Z`);
  const bm = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((bm - am) / 86_400_000) + 1;
}

export function buildDailyTokenBoxCountFd(
  queue: QueueLine[],
  opts: DailyTokenBoxCountFdOptions = {},
): DailyTokenBoxCountFdReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 4) {
    throw new Error(
      `minTenureDays must be an integer >= 4 (got ${opts.minTenureDays})`,
    );
  }
  const gridMin = opts.gridMin ?? 2;
  if (!Number.isInteger(gridMin) || gridMin < 2) {
    throw new Error(`gridMin must be an integer >= 2 (got ${opts.gridMin})`);
  }
  const gridMax = opts.gridMax ?? 32;
  if (!Number.isInteger(gridMax) || gridMax <= gridMin) {
    throw new Error(
      `gridMax must be an integer > gridMin (got ${opts.gridMax})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenBoxCountFdSort = opts.sort ?? 'absBfdDeviationDesc';
  const validSorts: DailyTokenBoxCountFdSort[] = [
    'absBfdDeviationDesc',
    'bfd',
    'bfdDesc',
    'tokens',
    'tenure',
    'source',
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
    let accSrc = agg.get(src);
    if (!accSrc) {
      accSrc = {
        perDay: new Map<string, number>(),
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, accSrc);
    }
    accSrc.perDay.set(day, (accSrc.perDay.get(day) ?? 0) + tt);
    accSrc.totalTokens += tt;
    if (day < accSrc.firstDay) accSrc.firstDay = day;
    if (day > accSrc.lastDay) accSrc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let droppedBelowMinTenure = 0;
  let droppedZeroVariance = 0;
  let droppedNonFiniteBfd = 0;
  let clampedBelow1Count = 0;
  let clampedAbove2Count = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenBoxCountFdSourceRow[] = [];

  for (const [src, accSrc] of agg) {
    if (accSrc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nTenure = dayDiffInclusive(accSrc.firstDay, accSrc.lastDay);
    if (nTenure < minTenureDays) {
      droppedBelowMinTenure += 1;
      continue;
    }
    const filled: number[] = new Array(nTenure);
    let cursor = accSrc.firstDay;
    for (let i = 0; i < nTenure; i += 1) {
      filled[i] = accSrc.perDay.get(cursor) ?? 0;
      cursor = addUtcDays(cursor, 1);
    }
    let mn = filled[0]!;
    let mx = filled[0]!;
    for (let i = 1; i < nTenure; i += 1) {
      const v = filled[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    let result;
    try {
      result = boxCountFd(filled, gridMin, gridMax);
    } catch {
      droppedNonFiniteBfd += 1;
      continue;
    }
    if (result.clampedBelow1) clampedBelow1Count += 1;
    if (result.clampedAbove2) clampedAbove2Count += 1;
    rows.push({
      source: src,
      totalTokens: accSrc.totalTokens,
      nActiveDays: accSrc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: accSrc.firstDay,
      lastActiveDay: accSrc.lastDay,
      bfd: result.bfd,
      bfdRaw: result.bfdRaw,
      slopeR2: result.slopeR2,
      nGridSteps: result.nGridSteps,
      gridMin: result.gridMinUsed,
      gridMax: result.gridMaxUsed,
      boxCountsCsv: result.boxCounts.join('|'),
      yRange: result.yRange,
      dxStep: result.dxStep,
      clampedBelow1: result.clampedBelow1,
      clampedAbove2: result.clampedAbove2,
    });
    totalTokensSum += accSrc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'bfd':
        primary = a.bfd - b.bfd;
        break;
      case 'bfdDesc':
        primary = b.bfd - a.bfd;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'tenure':
        primary = b.nTenureDays - a.nTenureDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'absBfdDeviationDesc':
      default:
        // BFD is bounded below at 1 for non-degenerate sequences;
        // sort by distance from 1 (== bfd desc).
        primary = b.bfd - a.bfd;
        break;
    }
    if (Number.isNaN(primary) || primary === 0) {
      return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    return primary;
  });

  let droppedTopSources = 0;
  let kept = rows;
  if (top > 0 && rows.length > top) {
    droppedTopSources = rows.length - top;
    kept = rows.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    minTenureDays,
    gridMin,
    gridMax,
    top,
    sort,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinTenure,
    droppedZeroVariance,
    droppedNonFiniteBfd,
    droppedTopSources,
    clampedBelow1: clampedBelow1Count,
    clampedAbove2: clampedAbove2Count,
    sources: kept,
  };
}
