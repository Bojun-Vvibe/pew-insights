/**
 * classifyTukeyCliffTailVsBulkCompound: cross-axis joiner
 * reconciling axis-193 TUKEY'S QUICK TEST end-count
 * exceedance (tqW; tqSignedW; tqIndeterminate;
 * tqTwoSidedP) with axis-191 CLIFF'S DELTA bootstrap-
 * percentile-CI (deltaHat = P(B > A) - P(A > B);
 * cdCiExcludesZero) on a per-source join, producing
 * mutually-exclusive bivariate TAIL-vs-BULK buckets.
 *
 * REFINEMENT OF axis-193 (v0.6.485): the per-source
 * Tukey end-count answers "DO THE EXTREMES OF THE TWO
 * HALVES SEPARATE?". This joiner answers the orthogonal
 * question "DOES THE TAIL-SEPARATION COINCIDE WITH BULK
 * STOCHASTIC DOMINANCE?".
 *
 * STRUCTURAL ORTHOGONALITY. Cliff's delta is supported
 * on the FULL CROSS-PAIR INDICATOR
 *
 *   delta = ( #{(i,j): B_j > A_i} - #{(i,j): B_j < A_i} )
 *           / (n1 * n2)
 *
 * which uses ALL n1*n2 cross-pair comparisons. Tukey's
 * W is supported ONLY on the END-EXCEEDANCE PAIRS
 *
 *   tqW = #{B_j > maxA} + #{A_i < minB}     (B-high case)
 *
 * which is a strict subset of the cross-pair support.
 * The two functionals are MAXIMALLY DECOUPLED on
 * BULK-CENTRAL SHIFTS (every cross-pair favours one
 * side by a small margin -> Cliff rejects, Tukey W = 0)
 * and on SINGLE-OUTLIER TAIL SHIFTS (one or two values
 * escape the other half's support, dominating Tukey but
 * negligible over n1*n2 cross-pairs -> Tukey rejects,
 * Cliff CI may straddle zero). They are TIGHTLY COUPLED
 * on clean end-to-end stochastic shifts where both
 * should agree.
 *
 * The bucket map exploits this orthogonality:
 *
 *   - tail-only-no-bulk-dominance: Tukey REJECTS (tqW
 *     >= 7) but Cliff CI INCLUDES ZERO. The CANONICAL
 *     pure-tail-shift signature: extremes have separated
 *     but the bulk dominance is inferentially
 *     inconclusive. Diagnostic of SINGLE-OR-DOUBLE
 *     OUTLIER alternatives (one half acquired one or
 *     two values escaping the other half's support).
 *
 *   - tail-and-bulk-coherent: both REJECT and the
 *     directions AGREE (sign(tqSignedW) ==
 *     sign(cdDelta)). The COHERENT joint signal --
 *     EXTREMES SEPARATED AND bulk DOMINANCE in the
 *     SAME direction. The cleanest signature of a
 *     genuine end-to-end stochastic shift.
 *
 *   - bulk-dominance-only-no-tail-shift: Cliff CI
 *     EXCLUDES ZERO but Tukey W < 7 (and not
 *     indeterminate). The reverse disagreement: every
 *     cross-pair favours one half by a consistent
 *     margin but neither half has a value escaping the
 *     other's support. Signature of a UNIFORM CENTRAL
 *     SHIFT (location moved but extremes still overlap).
 *
 *   - tail-and-bulk-direction-conflict: both REJECT but
 *     directions DISAGREE. Very rare; indicates a
 *     MULTIMODAL FLIP -- one mode's extremes have
 *     crossed while the bulk centre-of-mass moved the
 *     other way. Watch-list: this often signals a
 *     regime change rather than a smooth shift.
 *
 *   - indeterminate-bulk-direction-ok: Tukey
 *     INDETERMINATE (one half's range envelopes the
 *     other) BUT Cliff CI excludes zero. The Tukey
 *     range-envelope masks a real dominance that Cliff
 *     resolves -- defer to Cliff. Signature of a
 *     SCALE-DOMINATED alternative where one half is
 *     more variable but the other has a consistent
 *     small location advantage.
 *
 *   - indeterminate-bulk-ns: Tukey INDETERMINATE AND
 *     Cliff CI INCLUDES ZERO. Range-envelope plus no
 *     bulk dominance -> SCALE-ONLY alternative. Hand
 *     off to scale-test axes (Brown-Forsythe, Siegel-
 *     Tukey, Ansari-Bradley).
 *
 *   - both-ns: neither REJECTS. No detectable shift in
 *     either tail or bulk.
 *
 * Headline counts:
 *
 *   - `tailOnlyNoBulkDominance`: count of pure-tail-shift
 *     sources (the canonical Tukey-vs-Cliff disagreement
 *     in Tukey's favour).
 *   - `tailAndBulkCoherent`: coherent-joint-signal count.
 *   - `bulkDominanceOnlyNoTailShift`: reverse
 *     disagreement count.
 *   - `directionConflict`: multimodal-flip watch-list.
 *
 * The Tukey rejection threshold is tqW >= 7 (Tukey 1959
 * Table 1 alpha = 0.05 critical value, nearly
 * distribution-free for 5 <= n1, n2 <= 30). The Cliff
 * significance call is the user-supplied
 * cdCiExcludesZero (typically 95% bootstrap percentile
 * CI from axis-191).
 *
 * Cliff magnitude bins reused verbatim from axis-191
 * (Romano-Coraggio-Skowronski 2006 calibration):
 * 0.147 / 0.33 / 0.474 = small / medium / large.
 *
 * Refs: Tukey 1959 *Technometrics* 1(1):31-48; Neave
 * 1966 *Technometrics* 8(2):241-249; Cliff 1993
 * *Psychological Bulletin* 114(3):494-509;
 * Romano-Coraggio-Skowronski 2006 calibration bins.
 */

export type TukeyCliffTailVsBulkBucket =
  | 'tail-only-no-bulk-dominance'
  | 'tail-and-bulk-coherent'
  | 'bulk-dominance-only-no-tail-shift'
  | 'tail-and-bulk-direction-conflict'
  | 'indeterminate-bulk-direction-ok'
  | 'indeterminate-bulk-ns'
  | 'both-ns';

export type TukeyCliffTailVsBulkDirection =
  | 'first-larger'
  | 'second-larger'
  | 'balanced'
  | 'indeterminate';

export interface TukeyRowForCliffJoin {
  source: string;
  /** Tukey end-count statistic in [0, n1+n2-2]. */
  tqW: number;
  /** Signed Tukey end-count: + = SECOND half "high"; - = FIRST half "high"; 0 if indeterminate. */
  tqSignedW: number;
  /** True if one half's range envelopes the other; tqW is then 0. */
  tqIndeterminate: boolean;
  /** Tukey two-sided p-value via Neave 1966 closed form. */
  tqTwoSidedP: number;
}

export interface CliffRowForTukeyJoin {
  source: string;
  /** Cliff's delta in [-1, +1]. Sign convention: + means second half stochastically larger. */
  cdDelta: number;
  /** Bootstrap percentile CI low endpoint in [-1, +1]. */
  cdCiLow: number;
  /** Bootstrap percentile CI high endpoint in [-1, +1]. */
  cdCiHigh: number;
  /** Whether the bootstrap CI excludes zero (significance call at the underlying alpha). */
  cdCiExcludesZero: boolean;
}

export interface ClassifiedTukeyCliffRow {
  source: string;
  tqW: number;
  tqSignedW: number;
  tqIndeterminate: boolean;
  tqTwoSidedP: number;
  cdDelta: number;
  cdAbsDelta: number;
  cdCiLow: number;
  cdCiHigh: number;
  cdCiExcludesZero: boolean;
  cdMagnitude: 'negligible' | 'small' | 'medium' | 'large';
  /** Direction inferred from Cliff sign (preferred when determinate); falls back to Tukey sign. */
  direction: TukeyCliffTailVsBulkDirection;
  bucket: TukeyCliffTailVsBulkBucket;
}

export interface ClassifyTukeyCliffTailVsBulkReport {
  rows: ClassifiedTukeyCliffRow[];
  bucketCounts: Record<TukeyCliffTailVsBulkBucket, number>;
  /** Headline: pure-tail-shift sources (canonical Tukey-vs-Cliff disagreement in Tukey's favour). */
  tailOnlyNoBulkDominance: number;
  /** Headline: coherent-joint-signal count. */
  tailAndBulkCoherent: number;
  /** Headline: reverse disagreement (Cliff rejects, Tukey does not). */
  bulkDominanceOnlyNoTailShift: number;
  /** Headline: multimodal-flip watch-list count. */
  directionConflict: number;
  /** Sources present in tqRows but missing from cdRows. */
  sourcesOnlyInTq: string[];
  /** Sources present in cdRows but missing from tqRows. */
  sourcesOnlyInCd: string[];
}

const TQ_REJECT_THRESHOLD = 7; // Tukey 1959 alpha=.05 critical value.
const NEGLIGIBLE_BOUND = 0.147;
const SMALL_BOUND = 0.33;
const LARGE_BOUND = 0.474;

function magnitudeOf(
  absDelta: number,
): 'negligible' | 'small' | 'medium' | 'large' {
  if (absDelta >= LARGE_BOUND) return 'large';
  if (absDelta >= SMALL_BOUND) return 'medium';
  if (absDelta >= NEGLIGIBLE_BOUND) return 'small';
  return 'negligible';
}

export function classifyTukeyCliffTailVsBulkCompound(
  tqRows: ReadonlyArray<TukeyRowForCliffJoin>,
  cdRows: ReadonlyArray<CliffRowForTukeyJoin>,
): ClassifyTukeyCliffTailVsBulkReport {
  const seenT = new Set<string>();
  for (const r of tqRows) {
    if (seenT.has(r.source)) {
      throw new Error(
        `classifyTukeyCliffTailVsBulkCompound: duplicate tukey source '${r.source}'`,
      );
    }
    seenT.add(r.source);
    if (!Number.isFinite(r.tqW) || r.tqW < 0) {
      throw new Error(
        `classifyTukeyCliffTailVsBulkCompound: tqW must be finite >= 0 for source '${r.source}' (got ${r.tqW})`,
      );
    }
    if (!Number.isFinite(r.tqSignedW)) {
      throw new Error(
        `classifyTukeyCliffTailVsBulkCompound: tqSignedW must be finite for source '${r.source}' (got ${r.tqSignedW})`,
      );
    }
    if (!Number.isFinite(r.tqTwoSidedP) || r.tqTwoSidedP < 0 || r.tqTwoSidedP > 1) {
      throw new Error(
        `classifyTukeyCliffTailVsBulkCompound: tqTwoSidedP must be finite in [0, 1] for source '${r.source}' (got ${r.tqTwoSidedP})`,
      );
    }
    if (r.tqIndeterminate && r.tqW !== 0) {
      throw new Error(
        `classifyTukeyCliffTailVsBulkCompound: tqIndeterminate=true requires tqW=0 for source '${r.source}' (got tqW=${r.tqW})`,
      );
    }
  }
  const seenC = new Set<string>();
  for (const r of cdRows) {
    if (seenC.has(r.source)) {
      throw new Error(
        `classifyTukeyCliffTailVsBulkCompound: duplicate cliff source '${r.source}'`,
      );
    }
    seenC.add(r.source);
    if (!Number.isFinite(r.cdDelta) || r.cdDelta < -1 || r.cdDelta > 1) {
      throw new Error(
        `classifyTukeyCliffTailVsBulkCompound: cdDelta must be finite in [-1, 1] for source '${r.source}' (got ${r.cdDelta})`,
      );
    }
    if (!Number.isFinite(r.cdCiLow) || r.cdCiLow < -1 || r.cdCiLow > 1) {
      throw new Error(
        `classifyTukeyCliffTailVsBulkCompound: cdCiLow must be finite in [-1, 1] for source '${r.source}' (got ${r.cdCiLow})`,
      );
    }
    if (!Number.isFinite(r.cdCiHigh) || r.cdCiHigh < -1 || r.cdCiHigh > 1) {
      throw new Error(
        `classifyTukeyCliffTailVsBulkCompound: cdCiHigh must be finite in [-1, 1] for source '${r.source}' (got ${r.cdCiHigh})`,
      );
    }
    if (r.cdCiLow > r.cdCiHigh) {
      throw new Error(
        `classifyTukeyCliffTailVsBulkCompound: cdCiLow (${r.cdCiLow}) > cdCiHigh (${r.cdCiHigh}) for source '${r.source}'`,
      );
    }
  }

  const tqByName = new Map<string, TukeyRowForCliffJoin>();
  for (const r of tqRows) tqByName.set(r.source, r);
  const cdByName = new Map<string, CliffRowForTukeyJoin>();
  for (const r of cdRows) cdByName.set(r.source, r);

  const sourcesOnlyInTq: string[] = [];
  const sourcesOnlyInCd: string[] = [];
  for (const r of tqRows) {
    if (!cdByName.has(r.source)) sourcesOnlyInTq.push(r.source);
  }
  for (const r of cdRows) {
    if (!tqByName.has(r.source)) sourcesOnlyInCd.push(r.source);
  }
  sourcesOnlyInTq.sort();
  sourcesOnlyInCd.sort();

  const rows: ClassifiedTukeyCliffRow[] = [];
  const bucketCounts: Record<TukeyCliffTailVsBulkBucket, number> = {
    'tail-only-no-bulk-dominance': 0,
    'tail-and-bulk-coherent': 0,
    'bulk-dominance-only-no-tail-shift': 0,
    'tail-and-bulk-direction-conflict': 0,
    'indeterminate-bulk-direction-ok': 0,
    'indeterminate-bulk-ns': 0,
    'both-ns': 0,
  };
  let tailOnlyNoBulkDominance = 0;
  let tailAndBulkCoherent = 0;
  let bulkDominanceOnlyNoTailShift = 0;
  let directionConflict = 0;

  for (const t of tqRows) {
    const c = cdByName.get(t.source);
    if (!c) continue;

    const tqReject = !t.tqIndeterminate && t.tqW >= TQ_REJECT_THRESHOLD;
    const tqSign = t.tqSignedW > 0 ? +1 : t.tqSignedW < 0 ? -1 : 0;
    const cdSign = c.cdDelta > 0 ? +1 : c.cdDelta < 0 ? -1 : 0;
    const cdAbsDelta = Math.abs(c.cdDelta);
    const cdMag = magnitudeOf(cdAbsDelta);

    let bucket: TukeyCliffTailVsBulkBucket;
    let direction: TukeyCliffTailVsBulkDirection;

    if (t.tqIndeterminate) {
      // Tukey range-envelope -> defer to Cliff for direction.
      if (c.cdCiExcludesZero) {
        bucket = 'indeterminate-bulk-direction-ok';
        direction =
          cdSign > 0 ? 'second-larger' : cdSign < 0 ? 'first-larger' : 'indeterminate';
      } else {
        bucket = 'indeterminate-bulk-ns';
        direction = 'indeterminate';
      }
    } else if (tqReject && c.cdCiExcludesZero) {
      // Both reject -- check direction agreement.
      if (tqSign !== 0 && cdSign !== 0 && tqSign !== cdSign) {
        bucket = 'tail-and-bulk-direction-conflict';
        // Direction is intentionally taken from Cliff (bulk wins).
        direction = cdSign > 0 ? 'second-larger' : 'first-larger';
      } else {
        bucket = 'tail-and-bulk-coherent';
        const sign = cdSign !== 0 ? cdSign : tqSign;
        direction =
          sign > 0 ? 'second-larger' : sign < 0 ? 'first-larger' : 'balanced';
      }
    } else if (tqReject && !c.cdCiExcludesZero) {
      bucket = 'tail-only-no-bulk-dominance';
      direction =
        tqSign > 0 ? 'second-larger' : tqSign < 0 ? 'first-larger' : 'balanced';
    } else if (!tqReject && c.cdCiExcludesZero) {
      bucket = 'bulk-dominance-only-no-tail-shift';
      direction = cdSign > 0 ? 'second-larger' : 'first-larger';
    } else {
      bucket = 'both-ns';
      direction = cdSign > 0 ? 'second-larger' : cdSign < 0 ? 'first-larger' : 'balanced';
    }

    bucketCounts[bucket] += 1;
    if (bucket === 'tail-only-no-bulk-dominance') tailOnlyNoBulkDominance += 1;
    if (bucket === 'tail-and-bulk-coherent') tailAndBulkCoherent += 1;
    if (bucket === 'bulk-dominance-only-no-tail-shift') bulkDominanceOnlyNoTailShift += 1;
    if (bucket === 'tail-and-bulk-direction-conflict') directionConflict += 1;

    rows.push({
      source: t.source,
      tqW: t.tqW,
      tqSignedW: t.tqSignedW,
      tqIndeterminate: t.tqIndeterminate,
      tqTwoSidedP: t.tqTwoSidedP,
      cdDelta: c.cdDelta,
      cdAbsDelta,
      cdCiLow: c.cdCiLow,
      cdCiHigh: c.cdCiHigh,
      cdCiExcludesZero: c.cdCiExcludesZero,
      cdMagnitude: cdMag,
      direction,
      bucket,
    });
  }

  rows.sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0));

  return {
    rows,
    bucketCounts,
    tailOnlyNoBulkDominance,
    tailAndBulkCoherent,
    bulkDominanceOnlyNoTailShift,
    directionConflict,
    sourcesOnlyInTq,
    sourcesOnlyInCd,
  };
}
