/**
 * classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound:
 * cross-axis joiner reconciling axis-197 FOSTER-STUART
 * S-STATISTIC (`fsSZ`; bilateral upper + lower record
 * count, index 0 EXCLUDED, Foster-Stuart 1954 convention)
 * with axis-109 DAILY-TOKEN-UPPER-RECORDS-COUNT (`recordZ`;
 * unilateral upper-only Renyi count, index 0 INCLUDED as
 * trivial record) on a per-source join, producing
 * mutually-exclusive bivariate buckets that decompose the
 * extremum-event signal into a BILATERAL-DISPERSION-
 * INSTABILITY channel and a UNILATERAL-UPPER-TAIL channel.
 *
 * REFINEMENT OF axis-197 (v0.6.492 -> v0.6.493): the
 * Foster-Stuart S-statistic answers "ARE NEW EXTREMES (BOTH
 * UPPER AND LOWER) ARRIVING FASTER THAN THE iid HARMONIC
 * CLOCK PREDICTS?". This joiner answers the orthogonal
 * question "WHEN BILATERAL DISPERSION-INSTABILITY FIRES,
 * WHICH TAIL IS DRIVING IT -- THE UPPER (NEW HIGHS), THE
 * LOWER (NEW LOWS), OR BOTH?".
 *
 * MECHANISTIC ORTHOGONALITY. Both axes are functionals of
 * prefix-extremum events on the SAME gap-filled daily
 * series, but they are not redundant. Three structural
 * differences MAKE THE JOIN INFORMATIVE:
 *
 *   1. AXIS-109 IS UNILATERAL: it only sees `u_i = 1[x[i]
 *      > max(x[0..i-1])]` and is therefore BLIND to a
 *      collapsing lower tail. AXIS-197 IS BILATERAL: it
 *      sums `u_i + l_i`, so a series with stable upper tail
 *      but accumulating lower-tail extremes will fire
 *      `fsSZ > 0` while leaving `recordZ ~ 0`. This
 *      decoupling is mechanically REAL: any series of the
 *      form `x[i] = max(x[0..i-1]) - delta_i` with
 *      monotone-decreasing positive `delta_i` has `U
 *      = 0` and `L` growing without bound.
 *
 *   2. INDEX-0 CONVENTION DIFFERS: axis-109 counts the
 *      first observation as a trivial upper record (Renyi
 *      1962 record-indicator decomposition uses
 *      `Pr(record at i) = 1/(i+1)`, which equals 1 at
 *      `i = 0`); axis-197 EXCLUDES `i = 0` from both
 *      passes per Foster-Stuart 1954 sec. 2. Effect on
 *      short tenures (`n` ~ 10): the constant +1 offset
 *      in `nUpperRecords` shifts axis-109 `recordZ`
 *      UPWARD by `1 / sqrt(H_n - 1)`, which can be ~0.4
 *      at `n = 10`; axis-197 has no such offset, so
 *      `fsSZ` and `recordZ` will routinely disagree on
 *      sign at small `n` even when the underlying
 *      dynamics are iid.
 *
 *   3. VARIANCE NORMALISATION DIFFERS: axis-109 uses
 *      `Var[U_full] = H_n - H_n^(2)` (single Bernoulli
 *      pass); axis-197 uses `Var[S] ~ 2 * (H_n -
 *      H_n^(2))` (two independent Bernoulli passes,
 *      asymptotic-leading-order). The ratio of their
 *      reference SDs is `sqrt(2)`, so the joint
 *      `(recordZ, fsSZ)` plane has a NATURAL DIAGONAL --
 *      under iid continuous innovations and after
 *      adjusting for the index-0 offset, `fsSZ - recordZ
 *      / sqrt(2)` has variance `~ 1/2`, so deviations
 *      of more than ~1 standard deviation off the diagonal
 *      are mechanically diagnostic of asymmetric tail
 *      behaviour.
 *
 * Bucket map. Let `urReject = |recordZ| >= 1.96` and
 * `fsReject = |fsSZ| >= 1.96` (alpha = 0.05 two-sided
 * normal).
 *
 *   - `bilateral-and-upper-coherent`: both REJECT and
 *     directions AGREE (sign(fsSZ) == sign(recordZ)).
 *     Canonical "growth-plus-volatility" record signature:
 *     new highs accumulate AND total record arrivals
 *     exceed the iid clock. The most common signature for
 *     a maturing source whose usage is climbing AND
 *     spreading.
 *
 *   - `bilateral-only-lower-tail-driven`: `fsSZ`
 *     REJECTS but `recordZ` DOES NOT. The CANONICAL
 *     LOWER-TAIL-DOMINATED signature: bilateral
 *     dispersion-instability is real but the UPPER tail
 *     is well-behaved, so the lower-record stream `L`
 *     must be carrying the signal. Hand off to a
 *     lower-tail review (axis-185 Hampel outlier review
 *     on the deflated half).
 *
 *   - `upper-only-not-bilateral`: `recordZ` REJECTS but
 *     `fsSZ` DOES NOT. Diagnostic: the upper tail fires
 *     but the lower tail is so well-behaved that
 *     `S = U + L ~ U` is DILUTED below the bilateral
 *     null. Common when the gap-fill zero-padding
 *     suppresses lower records to a degenerate `L = 0`.
 *
 *   - `coherent-but-conflict-direction`: both REJECT but
 *     SIGNS DISAGREE. Watch-list: e.g. `recordZ` strongly
 *     positive (lots of new highs) yet `fsSZ` strongly
 *     negative (TOTAL records are FEWER than the
 *     bilateral null expects, meaning the lower-record
 *     stream `L` is REPRESSED far below its share). This
 *     is a signature of a one-sided drift that pins the
 *     running minimum and prevents lower records.
 *
 *   - `both-ns`: neither rejects. No detectable
 *     extremum-event anomaly on either axis.
 *
 * Headline counts:
 *
 *   - `bilateralAndUpperCoherent`: clean record
 *     accumulation across both tails.
 *   - `bilateralOnlyLowerTailDriven`: lower-tail-driven
 *     instability invisible to axis-109.
 *   - `upperOnlyNotBilateral`: upper-tail-only signal
 *     diluted by the bilateral normalisation.
 *   - `coherentButConflictDirection`: tail-asymmetry
 *     watch-list.
 *
 * Refs: Foster & Stuart 1954 *J. R. Statist. Soc. B*
 * 16(1):1-22; Renyi 1962 *Theory of probability and its
 * applications* 7:401-413; Glick 1978 *Amer. Math.
 * Monthly* 85:2-26 sec. 4 (asymptotic-independence of
 * record indicators).
 */

export type FosterStuartUpperRecordsBilateralVsUnilateralBucket =
  | 'bilateral-and-upper-coherent'
  | 'bilateral-only-lower-tail-driven'
  | 'upper-only-not-bilateral'
  | 'coherent-but-conflict-direction'
  | 'both-ns';

export type FosterStuartUpperRecordsDirection =
  | 'records-growing'
  | 'records-suppressed'
  | 'mixed';

export interface FosterStuartRowForUpperRecordsJoin {
  source: string;
  /** Foster-Stuart S = U + L. */
  fsS: number;
  /** Foster-Stuart D = U - L. */
  fsD: number;
  /** Standardised S z-score under the iid harmonic null. */
  fsSZ: number;
  /** Standardised D z-score under the iid harmonic null. */
  fsDZ: number;
}

export interface UpperRecordsRowForFosterStuartJoin {
  source: string;
  /** Strict upper-record count INCLUDING the trivial index-0 record. */
  nUpperRecords: number;
  /** Iid expectation of nUpperRecords = H_n. */
  recordExpectedIid: number;
  /** Iid variance of nUpperRecords = H_n - H_n^(2). */
  recordVarIid: number;
  /** Standardised z-score against the Renyi iid null. */
  recordZ: number;
}

export interface ClassifiedFosterStuartUpperRecordsRow {
  source: string;
  fsS: number;
  fsD: number;
  fsSZ: number;
  fsAbsSZ: number;
  fsDZ: number;
  nUpperRecords: number;
  recordExpectedIid: number;
  recordZ: number;
  recordAbsZ: number;
  /** Direction inferred from joint sign behaviour. */
  direction: FosterStuartUpperRecordsDirection;
  bucket: FosterStuartUpperRecordsBilateralVsUnilateralBucket;
}

export interface ClassifyFosterStuartUpperRecordsBilateralVsUnilateralReport {
  rows: ClassifiedFosterStuartUpperRecordsRow[];
  bucketCounts: Record<
    FosterStuartUpperRecordsBilateralVsUnilateralBucket,
    number
  >;
  /** Headline: clean both-tails record accumulation count. */
  bilateralAndUpperCoherent: number;
  /** Headline: lower-tail-only count (signature axis-109 cannot see). */
  bilateralOnlyLowerTailDriven: number;
  /** Headline: upper-tail-only count diluted by the bilateral normalisation. */
  upperOnlyNotBilateral: number;
  /** Headline: tail-asymmetry watch-list count. */
  coherentButConflictDirection: number;
  /** Sources present in fsRows but missing from urRows. */
  sourcesOnlyInFs: string[];
  /** Sources present in urRows but missing from fsRows. */
  sourcesOnlyInUr: string[];
}

const REJECT_ABS_Z = 1.959963984540054; // alpha = 0.05 two-sided.

export function classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound(
  fsRows: ReadonlyArray<FosterStuartRowForUpperRecordsJoin>,
  urRows: ReadonlyArray<UpperRecordsRowForFosterStuartJoin>,
): ClassifyFosterStuartUpperRecordsBilateralVsUnilateralReport {
  const seenF = new Set<string>();
  for (const r of fsRows) {
    if (seenF.has(r.source)) {
      throw new Error(
        `classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound: duplicate fs source '${r.source}'`,
      );
    }
    seenF.add(r.source);
    if (!Number.isFinite(r.fsS) || r.fsS < 0) {
      throw new Error(
        `classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound: fsS must be finite >= 0 for source '${r.source}' (got ${r.fsS})`,
      );
    }
    if (!Number.isFinite(r.fsD)) {
      throw new Error(
        `classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound: fsD must be finite for source '${r.source}' (got ${r.fsD})`,
      );
    }
    if (!Number.isFinite(r.fsSZ)) {
      throw new Error(
        `classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound: fsSZ must be finite for source '${r.source}' (got ${r.fsSZ})`,
      );
    }
    if (!Number.isFinite(r.fsDZ)) {
      throw new Error(
        `classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound: fsDZ must be finite for source '${r.source}' (got ${r.fsDZ})`,
      );
    }
  }
  const seenU = new Set<string>();
  for (const r of urRows) {
    if (seenU.has(r.source)) {
      throw new Error(
        `classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound: duplicate ur source '${r.source}'`,
      );
    }
    seenU.add(r.source);
    if (!Number.isInteger(r.nUpperRecords) || r.nUpperRecords < 1) {
      throw new Error(
        `classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound: nUpperRecords must be integer >= 1 for source '${r.source}' (got ${r.nUpperRecords})`,
      );
    }
    if (!Number.isFinite(r.recordExpectedIid) || r.recordExpectedIid <= 0) {
      throw new Error(
        `classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound: recordExpectedIid must be finite > 0 for source '${r.source}' (got ${r.recordExpectedIid})`,
      );
    }
    if (!Number.isFinite(r.recordVarIid) || r.recordVarIid < 0) {
      throw new Error(
        `classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound: recordVarIid must be finite >= 0 for source '${r.source}' (got ${r.recordVarIid})`,
      );
    }
    if (!Number.isFinite(r.recordZ)) {
      throw new Error(
        `classifyFosterStuartUpperRecordsBilateralVsUnilateralCompound: recordZ must be finite for source '${r.source}' (got ${r.recordZ})`,
      );
    }
  }

  const fsByName = new Map<string, FosterStuartRowForUpperRecordsJoin>();
  for (const r of fsRows) fsByName.set(r.source, r);
  const urByName = new Map<string, UpperRecordsRowForFosterStuartJoin>();
  for (const r of urRows) urByName.set(r.source, r);

  const sourcesOnlyInFs: string[] = [];
  const sourcesOnlyInUr: string[] = [];
  for (const r of fsRows) {
    if (!urByName.has(r.source)) sourcesOnlyInFs.push(r.source);
  }
  for (const r of urRows) {
    if (!fsByName.has(r.source)) sourcesOnlyInUr.push(r.source);
  }
  sourcesOnlyInFs.sort();
  sourcesOnlyInUr.sort();

  const rows: ClassifiedFosterStuartUpperRecordsRow[] = [];
  const bucketCounts: Record<
    FosterStuartUpperRecordsBilateralVsUnilateralBucket,
    number
  > = {
    'bilateral-and-upper-coherent': 0,
    'bilateral-only-lower-tail-driven': 0,
    'upper-only-not-bilateral': 0,
    'coherent-but-conflict-direction': 0,
    'both-ns': 0,
  };
  let bilateralAndUpperCoherent = 0;
  let bilateralOnlyLowerTailDriven = 0;
  let upperOnlyNotBilateral = 0;
  let coherentButConflictDirection = 0;

  for (const f of fsRows) {
    const u = urByName.get(f.source);
    if (!u) continue;

    const fsReject = Math.abs(f.fsSZ) >= REJECT_ABS_Z;
    const urReject = Math.abs(u.recordZ) >= REJECT_ABS_Z;
    const fsSign = f.fsSZ > 0 ? +1 : f.fsSZ < 0 ? -1 : 0;
    const urSign = u.recordZ > 0 ? +1 : u.recordZ < 0 ? -1 : 0;

    let bucket: FosterStuartUpperRecordsBilateralVsUnilateralBucket;
    let direction: FosterStuartUpperRecordsDirection;

    if (fsReject && urReject) {
      if (fsSign !== 0 && urSign !== 0 && fsSign !== urSign) {
        bucket = 'coherent-but-conflict-direction';
        direction = 'mixed';
      } else {
        bucket = 'bilateral-and-upper-coherent';
        const sign = fsSign !== 0 ? fsSign : urSign;
        direction = sign > 0 ? 'records-growing' : 'records-suppressed';
      }
    } else if (fsReject && !urReject) {
      bucket = 'bilateral-only-lower-tail-driven';
      direction =
        fsSign > 0 ? 'records-growing' : fsSign < 0 ? 'records-suppressed' : 'mixed';
    } else if (!fsReject && urReject) {
      bucket = 'upper-only-not-bilateral';
      direction =
        urSign > 0 ? 'records-growing' : urSign < 0 ? 'records-suppressed' : 'mixed';
    } else {
      bucket = 'both-ns';
      direction =
        fsSign > 0 || urSign > 0
          ? 'records-growing'
          : fsSign < 0 || urSign < 0
            ? 'records-suppressed'
            : 'mixed';
    }

    bucketCounts[bucket] += 1;
    if (bucket === 'bilateral-and-upper-coherent') bilateralAndUpperCoherent += 1;
    if (bucket === 'bilateral-only-lower-tail-driven')
      bilateralOnlyLowerTailDriven += 1;
    if (bucket === 'upper-only-not-bilateral') upperOnlyNotBilateral += 1;
    if (bucket === 'coherent-but-conflict-direction')
      coherentButConflictDirection += 1;

    rows.push({
      source: f.source,
      fsS: f.fsS,
      fsD: f.fsD,
      fsSZ: f.fsSZ,
      fsAbsSZ: Math.abs(f.fsSZ),
      fsDZ: f.fsDZ,
      nUpperRecords: u.nUpperRecords,
      recordExpectedIid: u.recordExpectedIid,
      recordZ: u.recordZ,
      recordAbsZ: Math.abs(u.recordZ),
      direction,
      bucket,
    });
  }

  rows.sort((a, b) =>
    a.source < b.source ? -1 : a.source > b.source ? 1 : 0,
  );

  return {
    rows,
    bucketCounts,
    bilateralAndUpperCoherent,
    bilateralOnlyLowerTailDriven,
    upperOnlyNotBilateral,
    coherentButConflictDirection,
    sourcesOnlyInFs,
    sourcesOnlyInUr,
  };
}
