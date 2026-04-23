/**
 * Bounded-ratio helpers for metrics that live in [0, 1].
 *
 * Why this module exists
 * ----------------------
 * `anomalies` (0.4.1) scores raw token totals — an unbounded count
 * where mean ± k·σ is a perfectly fine yardstick. But several
 * metrics we want to score next live in a closed interval and break
 * that assumption:
 *
 *   - cache-hit ratio                 (cached_input / input)
 *   - reasoning-token share           (reasoning / total_output)
 *   - cost-per-token efficiency proxy (cached vs uncached share)
 *
 * For p ∈ [0, 1] you cannot just EWMA p directly and call ±2σ
 * "anomalous":
 *
 *   1. The variance is **bounded** (Var ≤ p(1-p) ≤ 0.25). A z-score
 *      of 4 against a baseline near 0.5 is mathematically possible;
 *      a z-score of 4 against a baseline of 0.98 usually isn't —
 *      the metric is up against the wall.
 *   2. Predictions can fall **outside** [0, 1]. EWMA(p)+kσ can yield
 *      1.07, which is meaningless as a ratio.
 *   3. A given absolute step is more meaningful near the boundaries:
 *      0.50 → 0.55 is "5pp drift"; 0.95 → 1.00 is "closing the
 *      remaining 100% of the gap". Z-scores in p-space treat them
 *      identically.
 *
 * The standard fix is to score in **logit space**:
 *
 *   logit(p) = ln(p / (1 - p))            (R, monotonic, symmetric around 0.5)
 *   expit(z) = 1 / (1 + e^-z)             (inverse — back into (0,1))
 *
 * In logit space, "0.5 → 0.55" and "0.95 → 0.99" have comparable
 * magnitudes, EWMA + variance behave like they would on an unbounded
 * series, and round-trip through `expit` keeps results in (0, 1).
 *
 * The boundary problem
 * --------------------
 * `logit(0)` and `logit(1)` are -∞ / +∞. Real data hits the
 * boundaries (a session with 0 cached tokens; a model whose output
 * is entirely reasoning tokens). We clamp with a small epsilon
 * before transforming. The clamp is **symmetric** — mapping 0 to
 * `eps` and 1 to `1 - eps` — so `logit` stays antisymmetric around
 * 0.5.
 *
 * Defaults below are deliberately conservative: `EPS = 1e-6` keeps
 * the boundary logits at ~±13.8, well outside any "normal" drift,
 * so a single clamped sample doesn't dominate an EWMA.
 *
 * No I/O, no CLI wiring, no global state. This is a pure helper
 * module that 0.5's webhook scorer will compose with the existing
 * `mean` / `stdDev` from `anomalies.ts`.
 */

/** Default clamp applied to bare 0 / 1 ratios before the logit transform. */
export const DEFAULT_RATIO_EPS = 1e-6;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function assertProbability(p: number, label = 'p'): void {
  if (!Number.isFinite(p)) {
    throw new Error(`${label} must be finite (got ${p})`);
  }
  if (p < 0 || p > 1) {
    throw new Error(`${label} must be in [0, 1] (got ${p})`);
  }
}

function assertEps(eps: number): void {
  if (!Number.isFinite(eps) || eps <= 0 || eps >= 0.5) {
    throw new Error(`eps must be in (0, 0.5) (got ${eps})`);
  }
}

// ---------------------------------------------------------------------------
// Clamp
// ---------------------------------------------------------------------------

/**
 * Symmetric epsilon clamp: maps 0 → eps and 1 → 1-eps, leaves
 * interior values untouched. Required before `logit` to keep the
 * result finite.
 *
 * Asymmetric clamps (e.g. only clamping the low end) bias the
 * round-trip and break logit's antisymmetry around 0.5. We never
 * provide one.
 */
export function clampProbability(p: number, eps: number = DEFAULT_RATIO_EPS): number {
  assertProbability(p);
  assertEps(eps);
  if (p < eps) return eps;
  if (p > 1 - eps) return 1 - eps;
  return p;
}

// ---------------------------------------------------------------------------
// logit / expit
// ---------------------------------------------------------------------------

/**
 * `logit(p) = ln(p / (1 - p))`.
 *
 * Throws on raw 0 or 1 — callers should pre-clamp via `safeLogit`
 * or `clampProbability`. This strictness is deliberate: silently
 * returning ±Infinity would let bad data poison a downstream EWMA
 * without any visible warning. If you want the clamping behavior,
 * ask for it explicitly.
 */
export function logit(p: number): number {
  assertProbability(p);
  if (p === 0 || p === 1) {
    throw new Error(`logit(${p}) is not finite; clamp first or use safeLogit`);
  }
  return Math.log(p / (1 - p));
}

/**
 * `expit(z) = 1 / (1 + e^-z)`. Maps R → (0, 1). Numerically stable
 * for very negative `z` (where `e^-z` overflows in naive form).
 */
export function expit(z: number): number {
  if (!Number.isFinite(z)) {
    // ±Infinity is a valid limit but not a useful EWMA output —
    // surface as a hard error so callers notice their data went bad.
    throw new Error(`expit requires a finite input (got ${z})`);
  }
  // For large positive z, e^-z underflows to 0 → result 1.
  // For large negative z, e^-z overflows; rewrite via e^z to stay finite.
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  } else {
    const e = Math.exp(z);
    return e / (1 + e);
  }
}

/**
 * `safeLogit(p, eps?)` — clamp then logit. Use this on ratios that
 * can legitimately hit the [0, 1] boundaries.
 */
export function safeLogit(p: number, eps: number = DEFAULT_RATIO_EPS): number {
  return logit(clampProbability(p, eps));
}

// ---------------------------------------------------------------------------
// EWMA in logit space
// ---------------------------------------------------------------------------

/**
 * Exponentially-weighted moving average over a series of bounded
 * ratios, computed in logit space and mapped back into (0, 1).
 *
 *   alpha ∈ (0, 1] — newer-sample weight. 0.3 weights the latest
 *                    sample at 30% and the prior EWMA at 70%.
 *                    alpha = 1 → degenerate, just returns the last sample.
 *
 * Empty series → throws (no defined value). One-sample series →
 * returns that sample (after clamp), independent of alpha.
 *
 * Why we don't expose a "linear-space EWMA": adding it would invite
 * the boundary bug this module exists to avoid. If you genuinely
 * want unbounded EWMA, use a different module on raw counts.
 */
export function ewmaLogit(
  series: ReadonlyArray<number>,
  alpha: number,
  eps: number = DEFAULT_RATIO_EPS,
): number {
  if (series.length === 0) {
    throw new Error('ewmaLogit requires a non-empty series');
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
    throw new Error(`alpha must be in (0, 1] (got ${alpha})`);
  }
  let acc = safeLogit(series[0]!, eps);
  for (let i = 1; i < series.length; i++) {
    const x = safeLogit(series[i]!, eps);
    acc = alpha * x + (1 - alpha) * acc;
  }
  return expit(acc);
}

/**
 * Same as `ewmaLogit`, but returns the running EWMA at every step
 * (in (0, 1) space) instead of only the final value. Useful for
 * plotting the smoothed series against the raw observations.
 */
export function ewmaLogitSeries(
  series: ReadonlyArray<number>,
  alpha: number,
  eps: number = DEFAULT_RATIO_EPS,
): number[] {
  if (series.length === 0) {
    throw new Error('ewmaLogitSeries requires a non-empty series');
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
    throw new Error(`alpha must be in (0, 1] (got ${alpha})`);
  }
  const out: number[] = [];
  let acc = safeLogit(series[0]!, eps);
  out.push(expit(acc));
  for (let i = 1; i < series.length; i++) {
    const x = safeLogit(series[i]!, eps);
    acc = alpha * x + (1 - alpha) * acc;
    out.push(expit(acc));
  }
  return out;
}
