/**
 * classifyHlMwShiftAgreement: cross-axis joiner between
 * axis-186 HODGES-LEHMANN signed two-sample shift
 * estimator (`hlDelta`, `hlCiExcludesZero`, `hlSign`)
 * and axis-115 MANN-WHITNEY rank-sum location test
 * (`mwZ`).
 *
 * SIGN-CONVENTION ALIGNMENT (CRITICAL). The two axes
 * use OPPOSITE sign conventions on the same underlying
 * "second-half larger" alternative:
 *
 *   - axis-186: hlSign = +1 IFF hlDelta > 0 IFF the
 *     second-half median is larger.
 *   - axis-115: mwZ = (U_A - E[U_A]) / sqrt(Var) where
 *     U_A is computed from the FIRST-HALF rank sum, so
 *     mwZ > 0 IFF the first-half is stochastically
 *     larger.
 *
 * Therefore the "signs agree on the same alternative"
 * condition is
 *
 *     hlSign === +1   <=>   mwZ < 0
 *     hlSign === -1   <=>   mwZ > 0
 *
 * The classifier joins per-source rows from the two
 * axes by `source` and assigns each joined row to one
 * of six mutually-exclusive buckets at configurable
 * two-sided alpha (default 0.05):
 *
 *   - 'shift-agree-second-larger': both decisive (HL
 *     CI excludes 0; |mwZ| >= z_{alpha/2}) AND signs
 *     agree on second-half larger (hlSign > 0 AND
 *     mwZ < 0).
 *   - 'shift-agree-first-larger': both decisive AND
 *     signs agree on first-half larger (hlSign < 0
 *     AND mwZ > 0).
 *   - 'shift-only-hl-decisive': HL decisive, MW not
 *     (|mwZ| < z_{alpha/2}). Diagnoses heavy-tail
 *     pairs whose MEDIAN pairwise difference is
 *     bounded away from zero but whose POOLED RANK
 *     SUM is dominated by ties / sparse positive
 *     mass.
 *   - 'shift-only-mw-decisive': MW decisive, HL CI
 *     straddles zero. Diagnoses location departures
 *     for which the HL CI is widened by within-half
 *     dispersion despite the rank-sum being clearly
 *     unbalanced.
 *   - 'shift-sign-conflict': both decisive AND signs
 *     STRICTLY DISAGREE on the alternative
 *     (hlSign > 0 AND mwZ > 0, or hlSign < 0 AND
 *     mwZ < 0). Antipodal-influence diagnostic: the
 *     median-of-pairwise-diffs and the rank-sum
 *     disagree on which half is stochastically
 *     larger, only possible under a heavy-tied,
 *     bimodal-within-half distribution.
 *   - 'no-decisive-shift': neither axis decisive.
 *
 * Also returns the count of sources only in HL,
 * only in MW, the union of rejection events, the
 * intersection of rejection events, the count of
 * sign-conflicts, and the deterministic source-asc
 * ordering of the joined rows.
 */

export type HlMwShiftBucket =
  | 'shift-agree-second-larger'
  | 'shift-agree-first-larger'
  | 'shift-only-hl-decisive'
  | 'shift-only-mw-decisive'
  | 'shift-sign-conflict'
  | 'no-decisive-shift';

export interface HlRowForJoin {
  source: string;
  hlDelta: number;
  hlSign: -1 | 0 | 1;
  hlCiExcludesZero: boolean;
}

export interface MwRowForJoin {
  source: string;
  mwZ: number;
}

export interface ClassifiedHlMwShiftRow {
  source: string;
  hlDelta: number;
  hlSign: -1 | 0 | 1;
  hlCiExcludesZero: boolean;
  mwZ: number;
  bucket: HlMwShiftBucket;
}

export interface ClassifyHlMwShiftReport {
  alpha: number;
  zCritical: number;
  rows: ClassifiedHlMwShiftRow[];
  bucketCounts: Record<HlMwShiftBucket, number>;
  bothDecisive: number;
  atLeastOneDecisive: number;
  signConflicts: number;
  sourcesOnlyInHl: string[];
  sourcesOnlyInMw: string[];
}

import { inverseNormalCdfBsm } from './dailytokenhodgeslehmannshifthalves.js';

export function classifyHlMwShiftAgreement(
  hlRows: ReadonlyArray<HlRowForJoin>,
  mwRows: ReadonlyArray<MwRowForJoin>,
  alpha = 0.05,
): ClassifyHlMwShiftReport {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `classifyHlMwShiftAgreement: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }
  const seenHl = new Set<string>();
  for (const r of hlRows) {
    if (seenHl.has(r.source)) {
      throw new Error(
        `classifyHlMwShiftAgreement: duplicate HL source '${r.source}'`,
      );
    }
    seenHl.add(r.source);
    if (!Number.isFinite(r.hlDelta)) {
      throw new Error(
        `classifyHlMwShiftAgreement: hlDelta must be finite for source '${r.source}'`,
      );
    }
    if (r.hlSign !== -1 && r.hlSign !== 0 && r.hlSign !== 1) {
      throw new Error(
        `classifyHlMwShiftAgreement: hlSign must be -1, 0, or 1 for source '${r.source}'`,
      );
    }
  }
  const seenMw = new Set<string>();
  for (const r of mwRows) {
    if (seenMw.has(r.source)) {
      throw new Error(
        `classifyHlMwShiftAgreement: duplicate MW source '${r.source}'`,
      );
    }
    seenMw.add(r.source);
    if (!Number.isFinite(r.mwZ)) {
      throw new Error(
        `classifyHlMwShiftAgreement: mwZ must be finite for source '${r.source}'`,
      );
    }
  }
  const zCrit = inverseNormalCdfBsm(1 - alpha / 2);
  const mwByName = new Map<string, MwRowForJoin>();
  for (const r of mwRows) mwByName.set(r.source, r);
  const sourcesOnlyInHl: string[] = [];
  const sourcesOnlyInMw: string[] = [];
  for (const r of hlRows) {
    if (!mwByName.has(r.source)) sourcesOnlyInHl.push(r.source);
  }
  const hlByName = new Map<string, HlRowForJoin>();
  for (const r of hlRows) hlByName.set(r.source, r);
  for (const r of mwRows) {
    if (!hlByName.has(r.source)) sourcesOnlyInMw.push(r.source);
  }
  sourcesOnlyInHl.sort();
  sourcesOnlyInMw.sort();

  const rows: ClassifiedHlMwShiftRow[] = [];
  const bucketCounts: Record<HlMwShiftBucket, number> = {
    'shift-agree-second-larger': 0,
    'shift-agree-first-larger': 0,
    'shift-only-hl-decisive': 0,
    'shift-only-mw-decisive': 0,
    'shift-sign-conflict': 0,
    'no-decisive-shift': 0,
  };
  let bothDecisive = 0;
  let atLeastOneDecisive = 0;
  let signConflicts = 0;

  for (const h of hlRows) {
    const m = mwByName.get(h.source);
    if (!m) continue;
    const hlDecisive = h.hlCiExcludesZero;
    const mwDecisive = Math.abs(m.mwZ) >= zCrit;
    let bucket: HlMwShiftBucket;
    if (hlDecisive && mwDecisive) {
      bothDecisive += 1;
      atLeastOneDecisive += 1;
      // sign-agree on second-larger: hlSign > 0 AND mwZ < 0
      // sign-agree on first-larger:  hlSign < 0 AND mwZ > 0
      if (h.hlSign > 0 && m.mwZ < 0) bucket = 'shift-agree-second-larger';
      else if (h.hlSign < 0 && m.mwZ > 0) bucket = 'shift-agree-first-larger';
      else if (h.hlSign === 0) {
        // HL CI excludes 0 but hlDelta is exactly 0 — only
        // possible in pathological edge cases; defer to MW.
        bucket =
          m.mwZ < 0 ? 'shift-agree-second-larger' : 'shift-agree-first-larger';
      } else {
        bucket = 'shift-sign-conflict';
        signConflicts += 1;
      }
    } else if (hlDecisive) {
      atLeastOneDecisive += 1;
      bucket = 'shift-only-hl-decisive';
    } else if (mwDecisive) {
      atLeastOneDecisive += 1;
      bucket = 'shift-only-mw-decisive';
    } else {
      bucket = 'no-decisive-shift';
    }
    bucketCounts[bucket] += 1;
    rows.push({
      source: h.source,
      hlDelta: h.hlDelta,
      hlSign: h.hlSign,
      hlCiExcludesZero: h.hlCiExcludesZero,
      mwZ: m.mwZ,
      bucket,
    });
  }
  rows.sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0));

  return {
    alpha,
    zCritical: zCrit,
    rows,
    bucketCounts,
    bothDecisive,
    atLeastOneDecisive,
    signConflicts,
    sourcesOnlyInHl,
    sourcesOnlyInMw,
  };
}
