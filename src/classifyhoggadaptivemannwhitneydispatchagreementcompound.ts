/**
 * classifyHoggAdaptiveMannWhitneyDispatchAgreementCompound:
 * cross-axis compound classifier joining axis-204
 * HOGG-FISHER-RANDLES 1975 ADAPTIVE TWO-SAMPLE LOCATION
 * TEST (`hoggZ`, `hoggPValue`, `hoggDispatch`) with a
 * fixed-score MANN-WHITNEY two-sample location test
 * (`mwZ`, `mwPValue`) on the SAME first-half-vs-second-
 * half partition of the gap-filled daily total_tokens
 * series, on a per-source basis.
 *
 * Cross-axis 7-bucket diagnostic.
 *
 * Structural claim. Both probes target two-sample
 * LOCATION shifts on the SAME partition, but they are
 * STRUCTURALLY DIFFERENT in the score function used:
 *
 *   - Mann-Whitney always uses the FIXED Wilcoxon rank-
 *     sum score (linear in pooled mid-ranks).
 *   - Hogg-Adaptive routes through the pooled tail-
 *     weight selector Q to ONE OF THREE different score
 *     functions: median (HFR1), Wilcoxon (HFR2), or
 *     normal-scores (HFR3).
 *
 * When `hoggDispatch === 'HFR2-wilcoxon'`, the two probes
 * use IDENTICAL score functions and SHOULD agree exactly
 * up to the difference between Mann-Whitney's U-form
 * standardisation and Wilcoxon rank-sum's W-form
 * standardisation (these are AFFINE transforms of each
 * other under no ties; under ties they are equivalent
 * after consistent tie correction). When
 * `hoggDispatch === 'HFR1-mood-median'` or
 * `'HFR3-vanderwaerden'`, the two probes apply
 * DIFFERENT WEIGHT FUNCTIONS to the same data and can
 * legitimately DIVERGE: the adaptive selector says "the
 * pooled tail shape makes Wilcoxon SUB-OPTIMAL here,
 * use a different score". The compound exposes this
 * divergence as a primary diagnostic channel.
 *
 * Sign-axis recoding. Both statistics already share the
 * same SECOND-HALF-ABOVE-FIRST-HALF sign convention
 * (axis-204 hoggZ > 0 iff B located above A; axis-110
 * mwZ > 0 iff B located above A under the documented
 * mwZ convention). No recoding needed.
 *
 * Buckets (alpha default 0.05):
 *
 *   - `coherent-location-wilcoxon-dispatch`:
 *     `hoggDispatch === 'HFR2-wilcoxon'` AND both
 *     `hoggPValue < alpha` AND `mwPValue < alpha` AND
 *     `sign(hoggZ) === sign(mwZ)`. Both probes agree on
 *     a significant location shift in the SAME
 *     direction, AND Hogg confirms Wilcoxon is the
 *     RIGHT test for this tail shape.
 *   - `coherent-location-non-wilcoxon-dispatch`:
 *     `hoggDispatch !== 'HFR2-wilcoxon'` AND both
 *     significant AND same sign. Both probes agree on a
 *     significant location shift, BUT Hogg routed to
 *     Mood-median or van-der-Waerden because the pooled
 *     tail shape is non-symmetric. Wilcoxon's signal is
 *     STILL detectable but the ADAPTIVE test reports it
 *     via a DIFFERENT score that is more efficient
 *     under the actual tail shape.
 *   - `adaptive-only`:
 *     `hoggPValue < alpha` AND `mwPValue >= alpha`.
 *     Adaptive picked up signal that fixed Wilcoxon
 *     missed. Almost always paired with non-Wilcoxon
 *     dispatch (Hogg's score is more efficient under
 *     the actual tail shape).
 *   - `wilcoxon-only`:
 *     `hoggPValue >= alpha` AND `mwPValue < alpha`.
 *     Fixed Wilcoxon picked up signal that adaptive
 *     missed. Indicates the pooled tail-weight selector
 *     routed AWAY from Wilcoxon to a less efficient
 *     score for this particular alternative; potentially
 *     a SELECTOR FALSE-NEGATIVE warning.
 *   - `direction-conflict`:
 *     both significant AND opposite signs. Rare, but
 *     possible when an extreme spike in one half flips
 *     the median dichotomy while leaving the rank-sum
 *     centre-of-mass on the other side. Always worth
 *     manual review.
 *   - `dispatch-veto`:
 *     `hoggDispatch !== 'HFR2-wilcoxon'` AND both
 *     `hoggPValue >= alpha` AND `mwPValue >= alpha`.
 *     Adaptive specifically vetoed Wilcoxon (chose
 *     median or normal-scores) AND no significant
 *     location shift was found by either. Records the
 *     dispatch decision as a TAIL-WEIGHT FINGERPRINT
 *     even in the absence of location signal.
 *   - `no-evidence`:
 *     `hoggDispatch === 'HFR2-wilcoxon'` AND both
 *     non-significant. Symmetric medium-tail data with
 *     no detectable location shift on either probe.
 *
 * The bucket assignment is DETERMINISTIC and TOTAL: every
 * row maps to exactly one bucket. The asymmetric counts
 * (`adaptive-only` vs `wilcoxon-only`) and the
 * non-trivial intersection of `non-Wilcoxon dispatch` x
 * `wilcoxon-only` are the headline diagnostic signals.
 *
 * Reference inputs:
 *   - axis-204 `dailyTokenHoggAdaptiveHalves`
 *     -> `hoggZ`, `hoggPValue`, `hoggDispatch`
 *   - axis-110 `dailyTokenMannWhitneyHalves`
 *     -> `mwZ`, `mwPValue`
 */
import type { HoggAdaptiveDispatch } from './dailytokenhoggadaptivehalves.js';

export type HoggAdaptiveMannWhitneyDispatchBucket =
  | 'coherent-location-wilcoxon-dispatch'
  | 'coherent-location-non-wilcoxon-dispatch'
  | 'adaptive-only'
  | 'wilcoxon-only'
  | 'direction-conflict'
  | 'dispatch-veto'
  | 'no-evidence';

export interface HoggMannWhitneyJoinedRow {
  source: string;
  hoggZ: number;
  hoggPValue: number;
  hoggDispatch: HoggAdaptiveDispatch;
  mwZ: number;
  mwPValue: number;
}

export interface HoggMannWhitneyClassifiedRow extends HoggMannWhitneyJoinedRow {
  bucket: HoggAdaptiveMannWhitneyDispatchBucket;
}

export interface HoggAdaptiveMannWhitneyDispatchAgreementReport {
  alpha: number;
  rowsTotal: number;
  rowsClassified: number;
  rowsSkipped: number;
  buckets: Record<HoggAdaptiveMannWhitneyDispatchBucket, number>;
  /**
   * Per-dispatch breakdown of how many rows landed in
   * each bucket — exposes the joint
   * (dispatch x agreement) cross-tabulation that is the
   * core diagnostic of this compound.
   */
  byDispatch: Record<
    HoggAdaptiveDispatch,
    Record<HoggAdaptiveMannWhitneyDispatchBucket, number>
  >;
  rows: HoggMannWhitneyClassifiedRow[];
}

const ZERO_BUCKETS: Record<HoggAdaptiveMannWhitneyDispatchBucket, number> = {
  'coherent-location-wilcoxon-dispatch': 0,
  'coherent-location-non-wilcoxon-dispatch': 0,
  'adaptive-only': 0,
  'wilcoxon-only': 0,
  'direction-conflict': 0,
  'dispatch-veto': 0,
  'no-evidence': 0,
};

function emptyByDispatch(): Record<
  HoggAdaptiveDispatch,
  Record<HoggAdaptiveMannWhitneyDispatchBucket, number>
> {
  return {
    'HFR1-mood-median': { ...ZERO_BUCKETS },
    'HFR2-wilcoxon': { ...ZERO_BUCKETS },
    'HFR3-vanderwaerden': { ...ZERO_BUCKETS },
  };
}

function isFiniteFinitePValue(p: number): boolean {
  return Number.isFinite(p) && p > 0 && p <= 1;
}

function isValidDispatch(d: unknown): d is HoggAdaptiveDispatch {
  return (
    d === 'HFR1-mood-median' ||
    d === 'HFR2-wilcoxon' ||
    d === 'HFR3-vanderwaerden'
  );
}

/**
 * Classify a single per-source joined row into one of
 * seven HOGG-ADAPTIVE x MANN-WHITNEY DISPATCH AGREEMENT
 * buckets at threshold `alpha` (default 0.05).
 *
 * Throws on malformed input (non-finite Z, p-value
 * outside (0, 1], unknown dispatch label).
 */
export function classifyHoggAdaptiveMannWhitneyDispatchRow(
  row: HoggMannWhitneyJoinedRow,
  alpha: number = 0.05,
): HoggAdaptiveMannWhitneyDispatchBucket {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new Error(
      `classifyHoggAdaptiveMannWhitneyDispatchRow: alpha must be in (0, 1) (got ${alpha})`,
    );
  }
  if (!Number.isFinite(row.hoggZ)) {
    throw new Error(
      `classifyHoggAdaptiveMannWhitneyDispatchRow: hoggZ must be finite (got ${row.hoggZ})`,
    );
  }
  if (!Number.isFinite(row.mwZ)) {
    throw new Error(
      `classifyHoggAdaptiveMannWhitneyDispatchRow: mwZ must be finite (got ${row.mwZ})`,
    );
  }
  if (!isFiniteFinitePValue(row.hoggPValue)) {
    throw new Error(
      `classifyHoggAdaptiveMannWhitneyDispatchRow: hoggPValue must be in (0, 1] (got ${row.hoggPValue})`,
    );
  }
  if (!isFiniteFinitePValue(row.mwPValue)) {
    throw new Error(
      `classifyHoggAdaptiveMannWhitneyDispatchRow: mwPValue must be in (0, 1] (got ${row.mwPValue})`,
    );
  }
  if (!isValidDispatch(row.hoggDispatch)) {
    throw new Error(
      `classifyHoggAdaptiveMannWhitneyDispatchRow: unknown hoggDispatch (got ${String(row.hoggDispatch)})`,
    );
  }
  const hoggSig = row.hoggPValue < alpha;
  const mwSig = row.mwPValue < alpha;
  const sameSign = Math.sign(row.hoggZ) === Math.sign(row.mwZ);
  const isWilcoxonDispatch = row.hoggDispatch === 'HFR2-wilcoxon';
  if (hoggSig && mwSig) {
    if (!sameSign) return 'direction-conflict';
    return isWilcoxonDispatch
      ? 'coherent-location-wilcoxon-dispatch'
      : 'coherent-location-non-wilcoxon-dispatch';
  }
  if (hoggSig && !mwSig) return 'adaptive-only';
  if (!hoggSig && mwSig) return 'wilcoxon-only';
  // Both non-significant.
  return isWilcoxonDispatch ? 'no-evidence' : 'dispatch-veto';
}

/**
 * Apply `classifyHoggAdaptiveMannWhitneyDispatchRow` to a
 * batch of joined per-source rows. Malformed rows are
 * SKIPPED with a counter rather than throwing, so the
 * classifier can be used on a noisy upstream join.
 */
export function classifyHoggAdaptiveMannWhitneyDispatchAgreementCompound(
  rows: ReadonlyArray<HoggMannWhitneyJoinedRow>,
  alpha: number = 0.05,
): HoggAdaptiveMannWhitneyDispatchAgreementReport {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new Error(
      `classifyHoggAdaptiveMannWhitneyDispatchAgreementCompound: alpha must be in (0, 1) (got ${alpha})`,
    );
  }
  const buckets = { ...ZERO_BUCKETS };
  const byDispatch = emptyByDispatch();
  const classified: HoggMannWhitneyClassifiedRow[] = [];
  let skipped = 0;
  for (const r of rows) {
    if (
      typeof r.source !== 'string' ||
      r.source === '' ||
      !Number.isFinite(r.hoggZ) ||
      !Number.isFinite(r.mwZ) ||
      !isFiniteFinitePValue(r.hoggPValue) ||
      !isFiniteFinitePValue(r.mwPValue) ||
      !isValidDispatch(r.hoggDispatch)
    ) {
      skipped += 1;
      continue;
    }
    const bucket = classifyHoggAdaptiveMannWhitneyDispatchRow(r, alpha);
    buckets[bucket] += 1;
    byDispatch[r.hoggDispatch][bucket] += 1;
    classified.push({ ...r, bucket });
  }
  return {
    alpha,
    rowsTotal: rows.length,
    rowsClassified: classified.length,
    rowsSkipped: skipped,
    buckets,
    byDispatch,
    rows: classified,
  };
}
