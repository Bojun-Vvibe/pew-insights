/**
 * classifyMielkeMoodTailVsBulkCompound: cross-axis
 * agreement classifier joining axis-200 MIELKE 1972
 * QUARTIC-CENTERED-RANKS scale test (`mielkeZ`,
 * `mielkePValue`) with axis-179 MOOD 1954 SQUARED-
 * CENTERED-RANKS scale test (`moodZ`, `moodPValue`)
 * on a per-source basis.
 *
 * STRUCTURAL CLAIM. Both tests are members of the
 * MIELKE 1972 POWER-OF-RANKS family `T_p =
 * sum_{j in B} (R_j - (n+1)/2)^p`:
 *
 *   - Mood is `T_2` (quadratic centred-rank weight,
 *     bound `((n-1)/2)^2`).
 *   - Mielke quartic is `T_4` (quartic centred-rank
 *     weight, bound `((n-1)/2)^4`).
 *
 * Both are PURE SCALE TESTS with a U-shape symmetric
 * weight about the rank midpoint. Both have ZERO ARE
 * advantage over each other under any LOCATION-only
 * shift. They DIVERGE on WHERE in the rank distribution
 * the dispersion shift lives:
 *
 *   - Mood spreads weight uniformly across the U-shape
 *     (quadratic growth from the centre).
 *   - Mielke concentrates weight on the EXTREME ranks
 *     (quartic growth — at n = 16 the extreme score is
 *     7.5^4 = 3164 vs the median-rank score 0.5^4 =
 *     0.0625, a ~50000x ratio).
 *
 * The bucket label therefore localises the dispersion
 * alternative to a specific TAIL-vs-BULK regime.
 *
 * Bucket map. Given per-source `mielkeZ` and `moodZ`
 * with their two-sided p-values at configurable alpha
 * (default 0.05):
 *
 *   - 'tail-amplified-second': SECOND half MORE
 *     dispersed (both Z > 0) AND `|mielkeZ| > |moodZ|`
 *     by a strict margin AND at least one decisive at
 *     alpha. The dispersion shift is in the EXTREME
 *     UPPER OR LOWER TAIL where Mielke's quartic-rank
 *     weight quadratically dominates Mood's centred-
 *     rank weight. The CANONICAL token-spike-driven
 *     dispersion bucket: a few extreme-rank days
 *     dominate the second-half score sum.
 *   - 'tail-amplified-first': FIRST half MORE
 *     dispersed (both Z < 0) AND `|mielkeZ| > |moodZ|`
 *     by strict margin AND at least one decisive.
 *   - 'bulk-amplified-second': SECOND half MORE
 *     dispersed (both Z > 0) AND `|moodZ| > |mielkeZ|`
 *     by strict margin AND at least one decisive. The
 *     dispersion shift is in the SHOULDER (mid-to-
 *     upper ranks); Mood's broader U-shape catches
 *     the signal Mielke under-weights at non-extreme
 *     ranks. Diagnoses gradual scale drift rather
 *     than spike-driven shifts.
 *   - 'bulk-amplified-first': FIRST half MORE
 *     dispersed (both Z < 0) AND `|moodZ| > |mielkeZ|`
 *     by strict margin AND at least one decisive.
 *   - 'coherent': BOTH Z share sign AND
 *     `||mielkeZ| - |moodZ|| <= tolerance` AND at
 *     least one decisive. The dispersion shift is
 *     uniformly distributed across all rank classes
 *     in the U-shape — quartic vs quadratic weight
 *     gives the same standardised result. Strong
 *     evidence of a clean parametric scale shift.
 *   - 'sign-conflict': signs DISAGREE (one Z > 0, the
 *     other Z < 0, BOTH non-zero) AND at least one
 *     decisive. Pathological — both tests should
 *     agree on the sign of the dispersion shift since
 *     they share the U-shape weight pattern. Surfaces
 *     under bimodal-within-half configurations where
 *     Mood's bulk-rank mass and Mielke's tail-rank
 *     mass favour different halves. Watch-list.
 *   - 'no-evidence': NEITHER axis decisive at alpha.
 *
 * Returns the joined-row table plus aggregate counts
 * and an `unanimousAgreement` summary so the caller can
 * gate on cross-axis confirmation strength.
 *
 * Pure function: no I/O, deterministic source-asc
 * ordering, throws on duplicate sources, non-finite
 * inputs, p-values outside (0, 1], or alpha outside
 * (0, 0.5]. Supports a strict `tolerance` parameter
 * for the coherent boundary (default 1e-9) so callers
 * can tune sensitivity.
 *
 * Reference:
 *   Mielke, P. W., "Asymptotic behavior of two-sample
 *     tests based on powers of ranks for detecting
 *     scale and location alternatives", *J. Amer.
 *     Statist. Assoc.* 67(340) (1972), pp. 850-854.
 *   Mood, A. M., "On the asymptotic efficiency of
 *     certain nonparametric two-sample tests",
 *     *Ann. Math. Statist.* 25 (1954), pp. 514-522.
 */

export interface MielkeRowForCompound {
  source: string;
  mielkeZ: number;
  mielkePValue: number;
}

export interface MoodRowForCompound {
  source: string;
  moodZ: number;
  moodPValue: number;
}

export type MielkeMoodTailVsBulkBucket =
  | 'tail-amplified-second'
  | 'tail-amplified-first'
  | 'bulk-amplified-second'
  | 'bulk-amplified-first'
  | 'coherent'
  | 'sign-conflict'
  | 'no-evidence';

export interface MielkeMoodTailVsBulkJoinedRow {
  source: string;
  mielkeZ: number;
  mielkePValue: number;
  moodZ: number;
  moodPValue: number;
  mielkeDecisive: boolean;
  moodDecisive: boolean;
  bucket: MielkeMoodTailVsBulkBucket;
}

export interface MielkeMoodTailVsBulkReport {
  alpha: number;
  tolerance: number;
  rows: MielkeMoodTailVsBulkJoinedRow[];
  bucketCounts: Record<MielkeMoodTailVsBulkBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  signConflicts: number;
  /** Number of joined rows in 'coherent' or 'tail-amplified-*' or 'bulk-amplified-*' AND at least one decisive. */
  unanimousAgreement: number;
  sourcesOnlyInMielke: string[];
  sourcesOnlyInMood: string[];
}

export function classifyMielkeMoodTailVsBulkCompound(
  mielkeRows: ReadonlyArray<MielkeRowForCompound>,
  moodRows: ReadonlyArray<MoodRowForCompound>,
  alpha = 0.05,
  tolerance = 1e-9,
): MielkeMoodTailVsBulkReport {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `classifyMielkeMoodTailVsBulkCompound: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error(
      `classifyMielkeMoodTailVsBulkCompound: tolerance must be a non-negative finite number (got ${tolerance})`,
    );
  }

  const mielkeBySrc = new Map<string, MielkeRowForCompound>();
  for (const r of mielkeRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyMielkeMoodTailVsBulkCompound: mielke row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.mielkeZ) ||
      !Number.isFinite(r.mielkePValue) ||
      r.mielkePValue <= 0 ||
      r.mielkePValue > 1
    ) {
      throw new Error(
        `classifyMielkeMoodTailVsBulkCompound: mielke row '${r.source}' has invalid mielkeZ/mielkePValue`,
      );
    }
    if (mielkeBySrc.has(r.source)) {
      throw new Error(
        `classifyMielkeMoodTailVsBulkCompound: duplicate mielke source '${r.source}'`,
      );
    }
    mielkeBySrc.set(r.source, r);
  }

  const moodBySrc = new Map<string, MoodRowForCompound>();
  for (const r of moodRows) {
    if (typeof r.source !== 'string' || r.source === '') {
      throw new Error(
        `classifyMielkeMoodTailVsBulkCompound: mood row has invalid source: ${r.source}`,
      );
    }
    if (
      !Number.isFinite(r.moodZ) ||
      !Number.isFinite(r.moodPValue) ||
      r.moodPValue <= 0 ||
      r.moodPValue > 1
    ) {
      throw new Error(
        `classifyMielkeMoodTailVsBulkCompound: mood row '${r.source}' has invalid moodZ/moodPValue`,
      );
    }
    if (moodBySrc.has(r.source)) {
      throw new Error(
        `classifyMielkeMoodTailVsBulkCompound: duplicate mood source '${r.source}'`,
      );
    }
    moodBySrc.set(r.source, r);
  }

  const sourcesOnlyInMielke: string[] = [];
  const sourcesOnlyInMood: string[] = [];
  for (const s of mielkeBySrc.keys()) {
    if (!moodBySrc.has(s)) sourcesOnlyInMielke.push(s);
  }
  for (const s of moodBySrc.keys()) {
    if (!mielkeBySrc.has(s)) sourcesOnlyInMood.push(s);
  }
  sourcesOnlyInMielke.sort();
  sourcesOnlyInMood.sort();

  const joinedSources: string[] = [];
  for (const s of mielkeBySrc.keys()) {
    if (moodBySrc.has(s)) joinedSources.push(s);
  }
  joinedSources.sort();

  const rows: MielkeMoodTailVsBulkJoinedRow[] = [];
  const bucketCounts: Record<MielkeMoodTailVsBulkBucket, number> = {
    'tail-amplified-second': 0,
    'tail-amplified-first': 0,
    'bulk-amplified-second': 0,
    'bulk-amplified-first': 0,
    coherent: 0,
    'sign-conflict': 0,
    'no-evidence': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  let signConflicts = 0;
  let unanimousAgreement = 0;

  for (const src of joinedSources) {
    const mi = mielkeBySrc.get(src)!;
    const mo = moodBySrc.get(src)!;
    const mielkeDecisive = mi.mielkePValue < alpha;
    const moodDecisive = mo.moodPValue < alpha;
    const anyDecisive = mielkeDecisive || moodDecisive;
    if (mielkeDecisive && moodDecisive) bothDecisive += 1;
    if (anyDecisive) atLeastOneDecisive += 1;

    let bucket: MielkeMoodTailVsBulkBucket;
    if (!anyDecisive) {
      bucket = 'no-evidence';
    } else {
      const miSign = mi.mielkeZ > 0 ? 1 : mi.mielkeZ < 0 ? -1 : 0;
      const moSign = mo.moodZ > 0 ? 1 : mo.moodZ < 0 ? -1 : 0;
      const conflict = miSign !== 0 && moSign !== 0 && miSign !== moSign;
      if (conflict) {
        bucket = 'sign-conflict';
        signConflicts += 1;
      } else {
        const miAbs = Math.abs(mi.mielkeZ);
        const moAbs = Math.abs(mo.moodZ);
        const diff = miAbs - moAbs;
        const dominantSign = miSign !== 0 ? miSign : moSign;
        if (Math.abs(diff) <= tolerance) {
          bucket = 'coherent';
        } else if (diff > tolerance) {
          // Mielke larger -> tail-amplified
          bucket =
            dominantSign >= 0 ? 'tail-amplified-second' : 'tail-amplified-first';
        } else {
          // Mood larger -> bulk-amplified
          bucket =
            dominantSign >= 0 ? 'bulk-amplified-second' : 'bulk-amplified-first';
        }
        unanimousAgreement += 1;
      }
    }

    bucketCounts[bucket] += 1;
    rows.push({
      source: src,
      mielkeZ: mi.mielkeZ,
      mielkePValue: mi.mielkePValue,
      moodZ: mo.moodZ,
      moodPValue: mo.moodPValue,
      mielkeDecisive,
      moodDecisive,
      bucket,
    });
  }

  return {
    alpha,
    tolerance,
    rows,
    bucketCounts,
    bothDecisive,
    atLeastOneDecisive,
    signConflicts,
    unanimousAgreement,
    sourcesOnlyInMielke,
    sourcesOnlyInMood,
  };
}
